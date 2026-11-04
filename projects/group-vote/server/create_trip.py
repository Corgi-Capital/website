"""Create or update a trip on the Group Vote server.

A trip's page data (title, intro, travelers, items, and optionally its trip dates and lodging) lives in a JSON file under
projects/group-vote/trips/, which git ignores because this repo is public, and on the server, which sends it only with
the trip's password. See ../trip.example.json for the format.

  python create_trip.py --table <TableName> --file ../trips/niseko-2027.json --code "<password to share>"
  python create_trip.py --table <TableName> --file ../trips/niseko-2027.json     # new page data, same password
  python create_trip.py --table <TableName> --export niseko-2027 > ../trips/niseko-2027.json   # file back from the server

Ballots are kept either way. Passwords match trimmed and in any case (a phone may capitalize the first letter).

Places added on the page through Suggest Spot live only on the server until you --export. An upload that would drop
any of them stops and lists them; --export first (or pass --drop-suggested). Every upload bumps the trip's revision, so
open pages reload the places.
"""
import argparse
import hashlib
import json
import re
import sys
import time

import boto3
from botocore.exceptions import ClientError

TRIP_RE = re.compile(r"^[a-z0-9-]{1,48}$")
ITEM_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")


def code_hash(code):  # must match app.code_hash
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()


def check_page(page):
    trip, names, items = page.get("id"), page.get("travelers"), page.get("items")
    if not isinstance(trip, str) or not TRIP_RE.match(trip):
        raise SystemExit("id must be lowercase letters, digits and hyphens, and match window.TRIP.id in the trip's page")
    if not isinstance(names, list) or not names or not all(isinstance(n, str) and n.strip() for n in names):
        raise SystemExit("travelers must be a list of names")
    if not isinstance(items, list) or not items:
        raise SystemExit("items must be a non-empty list")
    ids = [i.get("id") for i in items]
    bad = [i for i in ids if not isinstance(i, str) or not ITEM_RE.match(i)]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    stays = page.get("lodging", [])
    stay_ids = {x.get("id") for x in stays} if isinstance(stays, list) else set()
    # stage: "dates" or "lodging" for a trip-date or lodging option (a lodging option names its stay); other items are
    # the places on the ballot, each in one of the regions.
    lost = sorted({str(i.get("r")) for i in items if not i.get("stage")} - set(page.get("regions") or []))
    bad_stage = [i.get("id") for i in items if "stage" in i and not (i["stage"] in ("locations", "dates", "lodging") and
                 (i["stage"] != "lodging" or i.get("stay") in stay_ids))]
    # dates: {"decided": "Thu Feb 18 - Mon Mar 1, 2027", "note": "...", "head": ["", "Lands", "Flies Home"], "rows": [[...]]};
    # without "decided", the trip-date options (stage "dates") are on the ballot.
    dates = page.get("dates", {})
    # dates.flights: {"<traveler>": [{"date", "flight", "route", "times", "note"?}, ...]}, shown collapsed per person
    fl = dates.get("flights", {}) if isinstance(dates, dict) else {}
    if not isinstance(fl, dict) or any(not isinstance(v, list) or any(not isinstance(x, dict) or not all(isinstance(x.get(k, ""), str) for k in ("date", "flight", "route", "times", "note"))
                                                                    for x in v) for v in fl.values()):
        raise SystemExit('dates.flights must map travelers to lists of {"date", "flight", "route", "times", "note"} (text)')
    bad_dates = not (isinstance(dates, dict) and all(isinstance(dates.get(k, ""), str) for k in ("decided", "note")) and
                     all(isinstance(r, list) and all(isinstance(x, str) for x in r) for r in [dates.get("head", [])] + list(dates.get("rows", []))))
    # lodging: the stays in order, each {"id", "where", "when", "status": "booked" | "open"} plus optional nights, name,
    # area, url, note, and its Google place (placeId, q) for a Google Maps button. An open stay's options are the items
    # with "stay" set to its id.
    bad_stays = not isinstance(stays, list) or any(not isinstance(x, dict) or not ITEM_RE.match(str(x.get("id", ""))) or
                                                   x.get("status") not in ("booked", "open") or
                                                   not all(isinstance(x.get(k, ""), str) for k in ("where", "when", "name", "area", "url", "note", "q")) or
                                                   not re.match(r"^([A-Za-z0-9_-]{8,})?$", str(x.get("placeId", ""))) or
                                                   not isinstance(x.get("nights", 0), int) for x in stays)
    # placeId: a Google place id. photos: positions 0-9 in that place's Google photo list, best first.
    bad_place = [i.get("id") for i in items if "placeId" in i and not (isinstance(i["placeId"], str) and re.match(r"^[A-Za-z0-9_-]{8,}$", i["placeId"]))]
    bad_photos = [i.get("id") for i in items if "photos" in i and not (isinstance(i["photos"], list) and
                  all(isinstance(n, int) and not isinstance(n, bool) and 0 <= n <= 9 for n in i["photos"]))]
    # Optional labels the page sorts and filters on, and slot: a dedicated itinerary slot (true or e.g. "Fri dinner").
    # categories: the places' sections, in order, each {"key", "label", "about" (what goes in it; the agent reads it),
    # "thumbs"}; without them, app.DEFAULT_CATEGORIES. A place's "group" is a category key (any other shows under More to Try).
    cats = page.get("categories")
    if cats is not None:
        ck = [c.get("key") for c in cats] if isinstance(cats, list) else []
        if (not isinstance(cats, list) or not 1 <= len(cats) <= 12 or len(set(ck)) != len(ck)
                or any(not isinstance(c, dict) or not isinstance(c.get("key"), str) or not re.match(r"^[a-z0-9][a-z0-9-]{0,23}$", c["key"])
                       or c["key"] in ("locations", "dates", "lodging", "photos") or not isinstance(c.get("label"), str) or not 0 < len(c["label"]) <= 40
                       or not isinstance(c.get("about", ""), str) or len(c.get("about", "")) > 200 or not isinstance(c.get("thumbs", False), bool) for c in cats)):
            raise SystemExit('categories must be 1-12 of {"key": "a-z0-9-", "label": "...", "about": "...", "thumbs": true|false}')
    cat_keys = [c["key"] for c in cats] if cats else ["specialty", "favorite", "tastes", "coffee", "event"]
    allowed = {"kind": {"meal", "sweets", "drinks", "coffee", "event"}, "tier": {"casual", "mid", "splurge"}}
    bad_labels = [f"{i.get('id')}.{k}" for i in items for k, ok in allowed.items() if k in i and i[k] not in ok]
    bad_slot = [i.get("id") for i in items if "slot" in i and not (isinstance(i["slot"], bool) or (isinstance(i["slot"], str) and 0 < len(i["slot"]) <= 40))]
    bad_flags = [i.get("id") for i in items if "izakaya" in i and not isinstance(i["izakaya"], bool)]   # the Izakaya pill
    known = page.get("knownFor", {})
    bad_known = not isinstance(known, dict) or any(not isinstance(v, list) or not all(isinstance(x, str) for x in v) for v in known.values())
    # time: per region, the stays there, e.g. ["2/19 1PM - 2/21 12PM", "2/20 10AM - 5PM", "2/22"] (a bare date is 9AM-11PM)
    span = re.compile(r"^\d{1,2}/\d{1,2}(\s+\d{1,2}(:\d\d)?\s*[AP]M)?(\s*-\s*(\d{1,2}/\d{1,2}\s*)?(\d{1,2}(:\d\d)?\s*[AP]M)?)?$", re.I)
    when = page.get("time", {})
    bad_time = [r for r, v in (when.items() if isinstance(when, dict) else [("time", None)])
                if r not in (page.get("regions") or []) or not isinstance(v, list) or not all(isinstance(x, str) and span.match(x) for x in v)]
    sections = page.get("sections", {})
    known = ("locations", "dates", "lodging", *cat_keys, "photos")   # must match app.switch_keys
    if not isinstance(sections, dict) or any(k not in known or not isinstance(v, bool) for k, v in sections.items()):
        raise SystemExit(f"sections must map {known} to true (AI picks; photos on) or false (suggestions only; photos off)")
    # goals: {"primary": "...", "secondary": ["...", ...]}, the squad's goals (editable on the page; the agent reads them)
    goals = page.get("goals", {})
    if not (isinstance(goals, dict) and isinstance(goals.get("primary", ""), str) and len(goals.get("primary", "")) <= 120
            and isinstance(goals.get("secondary", []), list) and len(goals.get("secondary", [])) <= 6
            and all(isinstance(x, str) and len(x) <= 120 for x in goals.get("secondary", []))):
        raise SystemExit('goals must be {"primary": "...", "secondary": ["...", ...]}: up to 6 secondary goals, each up to 120 characters')
    if not isinstance(page.get("photosOffNote", ""), str) or len(page.get("photosOffNote", "")) > 60:
        raise SystemExit("photosOffNote (why photos are off, e.g. \"Until final vote day\") must be text up to 60 characters")
    if "owner" in page and page["owner"] not in names:
        raise SystemExit("owner must be one of the travelers")
    if bad_stage or bad_dates or bad_stays:
        raise SystemExit(f"bad stage (\"dates\", or \"lodging\" with a stay from 'lodging'): {bad_stage}; "
                         f"dates: {'bad' if bad_dates else 'ok'}; lodging: {'bad' if bad_stays else 'ok'}")
    if bad or dupes or lost or bad_place or bad_photos or bad_labels or bad_slot or bad_flags or bad_known or bad_time:
        if bad_time:
            raise SystemExit(f"time must map regions to lists like \"2/19 1PM - 2/21 12PM\" or \"2/22\": bad {bad_time}")
        raise SystemExit(f"bad item ids: {bad}; duplicate item ids: {dupes}; regions missing from 'regions': {lost}; "
                         f"bad placeId: {bad_place}; bad photos (positions 0-9): {bad_photos}; bad labels: {bad_labels} "
                         f"(allowed: {allowed}); bad slot (true or a label up to 40 characters): {bad_slot}; "
                         f"izakaya must be true or false: {bad_flags}; "
                         f"knownFor must map regions to lists of text: {'bad' if bad_known else 'ok'}")


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("--table", required=True)
p.add_argument("--region", default="us-east-1")
g = p.add_mutually_exclusive_group(required=True)
g.add_argument("--file", help="the trip's JSON file")
g.add_argument("--export", metavar="TRIP", help="print a trip's JSON as the server has it")
p.add_argument("--code", help="the password travelers type in: needed the first time, optional after")
p.add_argument("--owner-code", help="the owner's own code (keep it to yourself): a device holding it runs the agent at once, "
               "since the agent runs on the owner's Claude subscription; anyone else's suggestions wait for the owner's OK")
p.add_argument("--drop-suggested", action="store_true", help="upload even if it drops places added through Suggest Spot")
a = p.parse_args()
table = boto3.resource("dynamodb", region_name=a.region).Table(a.table)

if a.export:
    meta = table.get_item(Key={"pk": f"trip#{a.export}", "sk": "meta"}).get("Item")
    if not meta:
        raise SystemExit(f"No trip {a.export} on the server")
    page = {"id": a.export, **json.loads(meta.get("page") or "{}")}
    page["travelers"] = list(meta.get("travelers", []))
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(page, indent=1, ensure_ascii=False))
    raise SystemExit

with open(a.file, encoding="utf-8") as f:
    page = json.load(f)
check_page(page)
trip, names = page.pop("id"), [n.strip() for n in page.pop("travelers")]
old = table.get_item(Key={"pk": f"trip#{trip}", "sk": "meta"}).get("Item") or {}
mine = {i["id"] for i in page["items"]}
lost = [i for i in json.loads(old.get("page") or "{}").get("items", []) if i.get("suggestedBy") and i["id"] not in mine]
if lost and not a.drop_suggested:
    raise SystemExit("The server has places added through Suggest Spot that this file doesn't: "
                     + ", ".join(f"{i['id']} ({i.get('place')}, by {i['suggestedBy']})" for i in lost)
                     + f"\nRun --export {trip} into the file first, or pass --drop-suggested to remove them.")
now = int(time.time())
fields = {"travelers": names, "page": json.dumps(page, ensure_ascii=False, separators=(",", ":")), "updated": now,
          "rev": int(old.get("rev", 0)) + 1}
if a.code is not None:
    if not a.code.strip():
        raise SystemExit("The password can't be blank")
    fields["code_hash"] = code_hash(a.code)
if a.owner_code is not None:
    if len(a.owner_code.strip()) < 8:
        raise SystemExit("The owner code needs at least 8 characters")
    fields["owner_hash"] = code_hash(a.owner_code)
kw = {
    "Key": {"pk": f"trip#{trip}", "sk": "meta"},
    "UpdateExpression": "SET " + ", ".join(f"#{k} = :{k}" for k in fields) + ", #created = if_not_exists(#created, :now)",
    "ExpressionAttributeNames": {**{f"#{k}": k for k in fields}, "#created": "created"},
    "ExpressionAttributeValues": {**{f":{k}": v for k, v in fields.items()}, ":now": now, ":oldrev": int(old.get("rev", 0))},
    # Nothing (a suggestion, say) may have changed the trip since it was read above.
    "ConditionExpression": "(attribute_not_exists(#rev) OR #rev = :oldrev)",
}
if a.code is None:
    if "code_hash" not in old:
        raise SystemExit(f"{trip} isn't on the server yet: give it a password with --code")
    kw["ConditionExpression"] += " AND attribute_exists(code_hash)"  # new page data only: keep the password
try:
    table.update_item(**kw)
except ClientError as e:
    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
        raise SystemExit(f"{trip} changed on the server while uploading (a suggestion was probably just added). Run it again.")
    raise
opts = sum(bool(i.get("stage")) for i in page["items"])
print(f"Trip {trip}: {len(page['items']) - opts} places and {opts} date or lodging options for {', '.join(names)}; "
      f"password {'set' if a.code else 'unchanged'}")
