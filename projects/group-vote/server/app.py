"""Group Vote API: one Lambda behind a function URL, one DynamoDB table.

A trip's page data (title, travelers, items), its votes and the Google Maps key go out only with the trip's password,
so the public page carries nothing but the trip id.

Routes
  GET  /trips/{trip}?code=...          -> {"ok": true, "trip": {page data}, "ballots": {name: {item_id: 0-3}},
                                       "thumbs": {name: [item_id]}, "mapsApiKey": "..."} (&only=ballots: just ballots and
                                       thumbs). 403 {"ok": false, "error": "code"} for a wrong password or an unknown trip.
                                       Both also carry "rev" (bumped whenever the places change) and "suggestions" (the last
                                       week's updates: Suggest Spot entries, Group Tastes comments and removals, and how
                                       each went). The page data leaves out the spots the group removed.
  POST /trips/{trip}/ballots           body {"code", "name", "votes", "up"} -> {"ok": true, "ballots": ..., "thumbs": ...}.
                                       "up": the Group Tastes spots this traveler gave a thumbs up (a good pick: the agent
                                       looks for more like them); left as it was when the body has none.
  POST /trips/{trip}/remove            body {"code", "name", "item", "undo"} -> {"ok": true, "suggestions": [...]}. A thumbs
                                       down: takes a Group Tastes or Coffee spot off the page, unless someone has voted it above MEH or
                                       another traveler gave it a thumbs up (409 {"ok": false, "error": "wanted", "by":
                                       [names]}). "undo": true puts it back; anyone can.
  POST /trips/{trip}/suggestions       body {"code", "name", "text", "why", "owner"} -> {"ok": true, "suggestions": [...],
                                       "held": bool}. One suggestion per line of text (up to 5): a Google Maps link, a
                                       Tabelog link or a name. Each is queued and the agent function (agent.py) is invoked to
                                       review and add it. With AGENT_HOLD=owner, only suggestions sent with the owner's code
                                       run at once and anyone else's are "held" until the owner OKs them. 429 "limit" past
                                       the traveler's daily cap.
  POST /trips/{trip}/sections          body {"code", "name", "section", "on"} -> {"ok": true, "sections": {...},
                                       "suggestions": [...]}. Turns a section's AI picks on, or off (suggestions only), or
                                       the trip's Google photos ("photos"), for everyone; logged in the updates. The page
                                       data carries "sections": {key: bool}.
  POST /trips/{trip}/categories        body {"code", "name", "categories": [{"key" (an existing one's; none for a new one),
                                       "label", "about"}]} -> {"ok": true, "categories": [...], "suggestions": [...]}. The
                                       places' categories, in order, for everyone: rename, describe (the agent reads "about"
                                       to sort suggestions), add, reorder or remove. Logged. The page data carries
                                       "categories"; places in a removed one show under More to Try.
  POST /trips/{trip}/goals             body {"code", "name", "primary", "secondary"} -> {"ok": true, "goals": {...},
                                       "suggestions": [...]}. The squad's goals for the trip: a primary goal and up to 6
                                       secondary ones, for everyone; logged. The page data carries "goals", and the agent
                                       reads them with every suggestion, Group Tastes update and search.
  POST /trips/{trip}/approve           body {"code", "owner", "ids", "run"} -> {"ok": true, "suggestions": [...]}. The owner
                                       runs held suggestions (run: true) or skips them (run: false). 403 "owner" without the
                                       owner's code.
  GET  /trips/{trip}/map?code=...      -> {"ok": true, "points": {place id: [lat, lng]}}: each place's coordinates, for the
                                       Trip Map. Looked up from Google by place id (location only) and kept up to 25 days.
  GET  /usage                          -> {"ok": true, "month": "YYYY-MM", "used": {...}, "limits": {...}}
  POST /usage                          body {"trip", "code", "kinds": ["search", "photo", "map"]} -> {"ok": true}; 403 "code" without a
                                       valid password; 409 {"ok": false, "error": "off"} for photos or lookups while the
                                       trip's photos are switched off (a map load still goes); 429 {"ok": false, "error": "limit"} only when the month's budget is spent;
                                       503 {"ok": false, "error": "busy"} on a passing error.
                                       Reserves one unit of each kind against this month's Google Maps budget.

Table layout (single table, on-demand)
  pk = "trip#<trip>", sk = "meta"          travelers [names], code_hash (see code_hash), owner_hash (the owner's code, same
                                           hash), page (page data as JSON), rev, created, updated
  pk = "trip#<trip>", sk = "ballot#<name>" votes {item_id: int}, up [item ids with this traveler's thumbs up], updated
  pk = "trip#<trip>", sk = "sections"      s_<section> (bool): a section (or "photos") flipped on the page; wins over the trip
                                           file's "sections"
  pk = "trip#<trip>", sk = "goals"         primary, secondary [..], by, updated: the squad's goals as edited on the page; wins over
                                           the trip file's "goals"
  pk = "trip#<trip>", sk = "categories"    list [{key, label, about, thumbs}], by, updated: the categories as edited on the page;
                                           wins over the trip file's "categories"
  pk = "trip#<trip>", sk = "removed#<item>" by, at, place: a Group Tastes or Coffee spot the group took off the page. The page data
                                           keeps the spot, so undo (or suggesting it again) brings it back as it was.
  pk = "trip#<trip>", sk = "sugg#<ms>-<r>" by, text, why, kind (spot, taste, remove, section), status (queued, working, added,
                                           duplicate, rejected, failed; held, declined; removed, restored), reason, item (the card's id),
                                           restoredBy, created, updated
  pk = "trip#<trip>", sk = "suggday#<date>#<name>" count (that traveler's suggestions that day, Pacific time)
  pk = "trip#<trip>", sk = "geo"           points {place id: [lat, lng, fetched at]}: coordinates for the Trip Map, kept up to 25 days
  pk = "usage#<YYYY-MM>", sk = "<kind>"    count (Google Maps calls made this month, Pacific time like Google billing)
"""
import hashlib
import hmac
import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError

TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
SSM = boto3.client("ssm")   # the Maps key and the agent's Claude credential, as SecureString parameters (free)
# "none" (the default): every traveler's suggestion runs at once. The owner pre-approves them as their own requests (Bill,
# 2026-11-04, for his private trip page). "owner": anyone else's wait for the owner's OK, given on a device holding the
# owner's code (an owner link); for a page where the owner's Claude subscription mustn't run other people's requests.
AGENT_HOLD = os.environ.get("AGENT_HOLD", "none")
# The page's sections: the plan's parts (STAGES), then the places' categories. Each shows AI picks plus everyone's
# suggestions (on), or suggestions only (off: AI picks are hidden there and the agent stops adding to it; suggestions
# are still looked up). Anyone can flip one, and so the trip's "photos" (Google photos on the cards; off, the trip's
# pages make no Google calls, which saves the month's budget).
STAGES = ("locations", "dates", "lodging")
# The places' categories, in order, each {"key", "label", "about": what goes in it (the agent reads it to sort
# suggestions), "thumbs": its cards get thumbs (up: a good pick; down: off the list while no one wants it)}. A trip's
# own list, from its file or edited on the page, replaces these.
DEFAULT_CATEGORIES = [
    {"key": "specialty", "label": "Regional Specialties", "about": "The dish or drink a region is famous for, at the places known for it.", "thumbs": False},
    {"key": "favorite", "label": "Local Favorites", "about": "Where locals go: everyday places with regulars.", "thumbs": False},
    {"key": "tastes", "label": "Group Tastes", "about": "Places picked for how this group eats and drinks. Most suggestions belong here.", "thumbs": True},
    {"key": "coffee", "label": "Coffee", "about": "Cafes, coffee stands and roasters, where coffee is the reason to go.", "thumbs": True},
    {"key": "event", "label": "Events", "about": "Anything to do, see or shop for: stores, sights, activities, onsen, festivals.", "thumbs": False},
]
CAT_MAX, CAT_LABEL_MAX, CAT_ABOUT_MAX = 12, 40, 200
CAT_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,23}$")
GOAL_MAX, GOALS_MAX = 120, 6   # characters per goal; secondary goals
LAMBDA = boto3.client("lambda")
# Each traveler's daily cap on suggestions (Pacific time). The agent's runs use the owner's Claude plan, so a cap bounds
# them, and each traveler has their own, so one busy traveler never uses up the others'.
SUGGEST_DAILY_LIMIT = int(os.environ.get("SUGGEST_DAILY_LIMIT", "40"))
SUGGEST_SHOW_DAYS = 7
_maps_key = {"value": None, "at": 0}
TRIP_RE = re.compile(r"^[a-z0-9-]{1,48}$")
ITEM_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
MAX_ITEMS = 300
# Monthly ceilings, kept just under Google's free monthly usage (Text Search Pro 5,000; Place Photos 1,000).
# Map loads (Dynamic Maps, 10,000 free) and coordinates (Place Details with location only, 10,000 free) have their own.
LIMITS = {"search": int(os.environ.get("SEARCH_MONTHLY_LIMIT", "4800")), "photo": int(os.environ.get("PHOTO_MONTHLY_LIMIT", "950")),
          "map": int(os.environ.get("MAP_MONTHLY_LIMIT", "9000")), "geo": int(os.environ.get("GEO_MONTHLY_LIMIT", "9000"))}
PAGE_KINDS = ("search", "photo", "map")   # what a page may reserve; "geo" is the server's own
GEO_KEEP = 25 * 86400   # Google's terms let an app keep coordinates from Places for up to 30 days
PLACE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,300}$")


def _month():
    return datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m")


def _usage():
    month = _month()
    used = {k: 0 for k in LIMITS}
    for it in TABLE.query(KeyConditionExpression=Key("pk").eq(f"usage#{month}"))["Items"]:
        if it["sk"] in used:
            used[it["sk"]] = int(it.get("count", 0))
    return {"ok": True, "month": month, "used": used, "limits": LIMITS}


def _bump(month, kind, by, limit=None):
    kw = {"Key": {"pk": f"usage#{month}", "sk": kind}, "UpdateExpression": "ADD #c :by",
          "ExpressionAttributeNames": {"#c": "count"}, "ExpressionAttributeValues": {":by": by}}
    if limit is not None:
        kw["ConditionExpression"] = "attribute_not_exists(#c) OR #c < :limit"
        kw["ExpressionAttributeValues"][":limit"] = limit
    TABLE.update_item(**kw)


def _reserve(kinds):
    """Add one unit to each kind unless that would pass its monthly limit. True if reserved, False if the budget is spent.

    One conditional update per kind, not a transaction: DynamoDB applies concurrent updates to an item one after
    another, while concurrent TransactWriteItems on the same two counters cancel each other (TransactionConflict, about
    9 in 10 in a burst), which the transaction version misreported as a spent budget. If a later kind is refused, the
    earlier ones are handed back. Any other DynamoDB error is raised; the route answers 503 and the page retries.
    """
    month, taken = _month(), []
    try:
        for k in kinds:
            _bump(month, k, 1, LIMITS[k])
            taken.append(k)
        return True
    except (BotoCoreError, ClientError) as e:
        for k in taken:
            try:
                _bump(month, k, -1)
            except (BotoCoreError, ClientError):
                pass  # the count stays one high: the safe direction for a budget
        if isinstance(e, ClientError) and e.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def _reserve_n(kind, n):
    """n units of one kind at once, unless that would pass its monthly limit. True if reserved."""
    try:
        TABLE.update_item(Key={"pk": f"usage#{_month()}", "sk": kind}, UpdateExpression="ADD #c :n",
                          ConditionExpression="attribute_not_exists(#c) OR #c <= :most", ExpressionAttributeNames={"#c": "count"},
                          ExpressionAttributeValues={":n": n, ":most": LIMITS[kind] - n})
        return True
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def _place_location(key, place_id):
    """A place's coordinates from Google (Place Details, location only), or None."""
    req = urllib.request.Request(f"https://places.googleapis.com/v1/places/{place_id}",
                                 headers={"X-Goog-Api-Key": key, "Referer": "https://corgi-capital.com/", "X-Goog-FieldMask": "location"})
    try:
        with urllib.request.urlopen(req, timeout=4) as r:
            loc = json.loads(r.read()).get("location") or {}
        return (loc["latitude"], loc["longitude"]) if "latitude" in loc and "longitude" in loc else None
    except Exception:
        return None


def _geo(trip, page):
    """Each place's coordinates, for the Trip Map: {place id: [lat, lng]}. Looked up from Google by place id and kept up to
    25 days (Google's terms allow 30). One call looks up at most 60 missing or old ones, in parallel, counted against the
    month's "geo" budget; the rest come with the next call."""
    now = int(time.time())
    row = TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "geo"}, ConsistentRead=True).get("Item") or {}
    old = row.get("points") or {}
    have = {k: v for k, v in old.items() if now - int(v[2]) <= GEO_KEEP}
    want = ({i["placeId"] for i in page.get("items", []) if isinstance(i.get("placeId"), str)}
            | {x["placeId"] for x in page.get("lodging", []) if isinstance(x, dict) and isinstance(x.get("placeId"), str)})
    need = sorted(p for p in want if p not in have and PLACE_ID_RE.match(p))[:60]
    key = _get_maps_key() if need else None
    if need and key and _reserve_n("geo", len(need)):
        with ThreadPoolExecutor(max_workers=12) as ex:
            for pid, loc in zip(need, ex.map(lambda x: _place_location(key, x), need)):
                if loc:
                    have[pid] = [Decimal(str(round(loc[0], 6))), Decimal(str(round(loc[1], 6))), now]
    kept = {k: v for k, v in have.items() if k in want}
    if kept != old:
        TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": "geo", "points": kept, "updated": now})
    return {k: [float(v[0]), float(v[1])] for k, v in kept.items()}


def _resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body)}


def _meta(trip):
    return TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "meta"}, ConsistentRead=True).get("Item")


def code_hash(code):
    """Passwords match trimmed and in any case, so a phone's capitalized first letter still works. create_trip.py
    stores the same hash."""
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()


def _owner_ok(meta, owner):
    """The owner's code: their device runs the agent at once (it's their Claude subscription)."""
    return bool(meta and meta.get("owner_hash") and isinstance(owner, str) and owner.strip()
                and hmac.compare_digest(code_hash(owner), meta["owner_hash"]))


def _code_ok(meta, code):
    if not meta or "code_hash" not in meta or not isinstance(code, str) or not code.strip():
        return False
    return hmac.compare_digest(code_hash(code), meta["code_hash"])


def _tastes(trip):
    """The Group Tastes doc: what the group loves and avoids, edited by the agent from travelers' comments. Lives in its
    own row so a trip upload never overwrites it."""
    return TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "tastes"}, ConsistentRead=True).get("Item")


def _removed(trip):
    """The Group Tastes spots the group took off the page (a thumbs down): {item_id: row}."""
    # Strongly consistent, like every read of a trip: a page that reloads right after an undo must see it.
    q = TABLE.query(KeyConditionExpression=Key("pk").eq(f"trip#{trip}") & Key("sk").begins_with("removed#"), ConsistentRead=True)
    return {r["sk"].split("#", 1)[1]: r for r in q["Items"]}


def bump_rev(trip):
    """Open pages reload the places when the trip's revision changes."""
    TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": "meta"}, UpdateExpression="ADD #r :one",
                      ExpressionAttributeNames={"#r": "rev"}, ExpressionAttributeValues={":one": 1})


def _page(trip, meta):
    page = json.loads(meta.get("page") or "{}")
    page.update(id=trip, travelers=list(meta.get("travelers", [])))
    gone = _removed(trip)
    if gone:
        page["items"] = [i for i in page.get("items", []) if i.get("id") not in gone]
    page["agentHold"] = AGENT_HOLD == "owner"   # the page says suggestions wait for the owner's OK
    page["categories"] = _categories(trip, page)
    page["sections"] = _sections(trip, page, page["categories"])
    page["goals"] = _goals(trip, page)
    doc = _tastes(trip)
    if doc:   # the doc, once anyone has commented, wins over the trip file's starting text
        page.update(tastes=doc.get("brief", page.get("tastes", "")), tastesLine=doc.get("line", page.get("tastesLine", "")))
        if doc.get("summary"):   # {"loves", "avoids", "examples"}: the short lists in the Group Tastes dialog
            page["tastesSummary"] = {k: list(doc["summary"].get(k) or []) for k in ("loves", "avoids", "examples")}
    return page


def _ballots(trip):
    """Each traveler's votes and thumbs up: ({name: {item_id: 0-3}}, {name: [item_id]})."""
    votes, ups, kwargs = {}, {}, {"KeyConditionExpression": Key("pk").eq(f"trip#{trip}") & Key("sk").begins_with("ballot#"), "ConsistentRead": True}
    while True:
        page = TABLE.query(**kwargs)
        for it in page["Items"]:
            name = it["sk"].split("#", 1)[1]
            votes[name] = {k: int(v) for k, v in it.get("votes", {}).items()}
            if it.get("up"):
                ups[name] = sorted(str(x) for x in it["up"])
        if "LastEvaluatedKey" not in page:
            return votes, ups
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def _suggestion_rows(trip, limit=40):
    """The newest suggestion rows, newest first."""
    q = TABLE.query(KeyConditionExpression=Key("pk").eq(f"trip#{trip}") & Key("sk").begins_with("sugg#"), ScanIndexForward=False, Limit=limit,
                    ConsistentRead=True)
    return q["Items"]


def _suggestions(trip):
    """The last few days' suggestions as the page shows them."""
    since = int(time.time()) - SUGGEST_SHOW_DAYS * 86400
    keep = ("by", "text", "why", "status", "reason", "item", "kind", "restoredBy")
    return [{"id": r["sk"], **{k: str(r.get(k, "")) for k in keep}, "created": int(r.get("created", 0)), "updated": int(r.get("updated", 0))}
            for r in _suggestion_rows(trip) if int(r.get("created", 0)) >= since]


def _suggest(trip, meta, body):
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name = body.get("name")
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    text, why, kind = body.get("text"), body.get("why") or "", "taste" if body.get("kind") == "taste" else "spot"
    if kind == "taste":   # one comment on the group's tastes, for the agent to fold into the Group Tastes doc
        lines = [" ".join(text.split())] if isinstance(text, str) and text.strip() else []
    else:                 # one suggested spot per line
        lines = list(dict.fromkeys(l.strip() for l in text.splitlines() if l.strip())) if isinstance(text, str) else []
    if not lines or len(lines) > 5 or any(len(l) > 500 for l in lines) or not isinstance(why, str):
        return _resp(400, {"ok": False, "error": "text"})
    if not take_daily(trip, len(lines), name):
        return _resp(429, {"ok": False, "error": "limit"})
    held = AGENT_HOLD == "owner" and not _owner_ok(meta, body.get("owner"))
    now, ids = time.time(), []
    for n, line in enumerate(lines):
        sk = f"sugg#{int(now * 1000) + n:013d}-{os.urandom(2).hex()}"
        TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": sk, "by": name, "text": line, "why": why.strip()[:200], "kind": kind,
                             "status": "held" if held else "queued", "created": int(now), "updated": int(now)})
        ids.append(sk)
    if not held:
        LAMBDA.invoke(FunctionName=os.environ["AGENT_FUNCTION"], InvocationType="Event", Payload=json.dumps({"trip": trip, "ids": ids}).encode())
    return _resp(200, {"ok": True, "suggestions": _suggestions(trip), "held": held})


def _categories(trip, page):
    """The trip's categories for its places, in order: the page's edit wins over the trip file's "categories", which win
    over DEFAULT_CATEGORIES."""
    row = TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "categories"}, ConsistentRead=True).get("Item") or {}
    cats = row.get("list") or page.get("categories") or DEFAULT_CATEGORIES
    return [{"key": str(c["key"]), "label": str(c.get("label") or c["key"]), "about": str(c.get("about") or ""), "thumbs": bool(c.get("thumbs"))}
            for c in cats]


def switch_keys(cats):
    """What can be switched: the plan's parts, the categories, and the trip's photos."""
    return STAGES + tuple(c["key"] for c in cats) + ("photos",)


def _sections(trip, page, cats):
    """Each switch's state. A section: True shows AI picks, False is suggestions only. "photos": Google photos on the
    cards. The trip file's "sections" sets where each starts; a flip on the page wins."""
    keys = switch_keys(cats)
    on = {k: True for k in keys}
    on.update({k: v for k, v in (page.get("sections") or {}).items() if k in keys and isinstance(v, bool)})
    row = TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "sections"}, ConsistentRead=True).get("Item") or {}
    on.update({k: bool(row[f"s_{k}"]) for k in keys if f"s_{k}" in row})
    return on


def _set_categories(trip, meta, body):
    """Anyone edits the places' categories, for everyone: renames or describes one (the agent reads "about" to sort
    suggestions), adds, reorders or removes them. The body lists them all, in order; a kept one carries its key, a new
    one none (it gets one from its label). Places in a removed category show under More to Try. Logged; pages reload."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name = body.get("name")
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    old = {c["key"]: c for c in _categories(trip, json.loads(meta.get("page") or "{}"))}
    raw, tidy = body.get("categories"), (lambda s: " ".join(s.split()) if isinstance(s, str) else None)
    if not isinstance(raw, list) or not 1 <= len(raw) <= CAT_MAX or not all(isinstance(c, dict) for c in raw):
        return _resp(400, {"ok": False, "error": "categories"})
    out, taken = [], set(STAGES) | {"photos"}
    for c in raw:
        label, about, key = tidy(c.get("label")), tidy(c.get("about") or ""), c.get("key")
        if not label or len(label) > CAT_LABEL_MAX or about is None or len(about) > CAT_ABOUT_MAX or (key is not None and key not in old):
            return _resp(400, {"ok": False, "error": "categories"})
        if key is None:   # a new category: a key from its label, never one that's in use
            base = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:20] or "cat"
            key, n = base, 2
            while key in taken or key in old:
                key, n = f"{base}-{n}", n + 1
        if key in taken:
            return _resp(400, {"ok": False, "error": "categories"})
        taken.add(key)
        out.append({"key": key, "label": label, "about": about, "thumbs": old[key]["thumbs"] if key in old else True})
    now = int(time.time())
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": "categories", "list": out, "by": name, "updated": now})
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": f"sugg#{int(time.time() * 1000):013d}-{os.urandom(2).hex()}", "by": name,
                         "text": ", ".join(c["label"] for c in out)[:200], "kind": "categories", "status": "updated", "created": now, "updated": now})
    bump_rev(trip)
    return _resp(200, {"ok": True, "categories": out, "suggestions": _suggestions(trip)})


def _goals(trip, page):
    """The squad's goals: {"primary": "...", "secondary": [...]}. The page's edit wins over the trip file's "goals"."""
    row = TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "goals"}, ConsistentRead=True).get("Item")
    g = row or page.get("goals") or {}
    return {"primary": str(g.get("primary") or ""), "secondary": [str(x) for x in (g.get("secondary") or [])]}


def _set_goals(trip, meta, body):
    """Anyone edits the squad's goals, for everyone: a primary goal (needed) and up to 6 secondary ones. Logged; open
    pages reload."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name = body.get("name")
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    tidy = lambda s: " ".join(s.split()) if isinstance(s, str) else None
    primary, more = tidy(body.get("primary")), body.get("secondary")
    secondary = [tidy(x) for x in more] if isinstance(more, list) else None
    if (not primary or len(primary) > GOAL_MAX or secondary is None or len(secondary) > GOALS_MAX
            or any(x is None or len(x) > GOAL_MAX for x in secondary)):
        return _resp(400, {"ok": False, "error": "goals"})
    secondary, now = [x for x in dict.fromkeys(secondary) if x], int(time.time())
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": "goals", "primary": primary, "secondary": secondary, "by": name, "updated": now})
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": f"sugg#{int(time.time() * 1000):013d}-{os.urandom(2).hex()}", "by": name,
                         "text": primary, "kind": "goals", "status": "updated", "created": now, "updated": now})
    bump_rev(trip)
    return _resp(200, {"ok": True, "goals": {"primary": primary, "secondary": secondary}, "suggestions": _suggestions(trip)})


def _set_section(trip, meta, body):
    """Anyone turns a section's AI picks on or off (the page asks them to confirm), or the trip's photos, for everyone.
    Logged; open pages reload."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name, key, on = body.get("name"), body.get("section"), body.get("on")
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    page = json.loads(meta.get("page") or "{}")
    if key not in switch_keys(_categories(trip, page)) or not isinstance(on, bool):
        return _resp(400, {"ok": False, "error": "section"})
    now = int(time.time())
    TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": "sections"}, UpdateExpression="SET #k = :v, updated = :u",
                      ExpressionAttributeNames={"#k": f"s_{key}"}, ExpressionAttributeValues={":v": on, ":u": now})
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": f"sugg#{int(time.time() * 1000):013d}-{os.urandom(2).hex()}", "by": name,
                         "text": key, "kind": "section", "status": "on" if on else "off", "created": now, "updated": now})
    bump_rev(trip)
    return _resp(200, {"ok": True, "sections": _sections(trip, page, _categories(trip, page)), "suggestions": _suggestions(trip)})


def take_daily(trip, n, who):
    """Counts n suggestions against this traveler's daily cap (Pacific time), all or none. False if that would pass it.
    The agent's own finds count toward the traveler whose comment led to them (agent.discover)."""
    day = datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")
    try:
        TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": f"suggday#{day}#{who}"}, UpdateExpression="ADD #c :n",
                          ConditionExpression="attribute_not_exists(#c) OR #c <= :most", ExpressionAttributeNames={"#c": "count"},
                          ExpressionAttributeValues={":n": n, ":most": SUGGEST_DAILY_LIMIT - n})
        return True
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def _approve(trip, meta, body):
    """The owner runs (or skips) suggestions held for their OK."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    if not _owner_ok(meta, body.get("owner")):
        return _resp(403, {"ok": False, "error": "owner"})
    ids = body.get("ids")
    ids = [i for i in ids if isinstance(i, str) and i.startswith("sugg#")][:25] if isinstance(ids, list) else []
    run, go, now = body.get("run") is not False, [], int(time.time())
    for sk in ids:
        try:   # only a held row moves: a second tap, or a row already run, does nothing
            TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": sk}, UpdateExpression="SET #s = :s, updated = :u",
                              ConditionExpression="#s = :held", ExpressionAttributeNames={"#s": "status"},
                              ExpressionAttributeValues={":s": "queued" if run else "declined", ":held": "held", ":u": now})
            go.append(sk)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
    if run and go:
        LAMBDA.invoke(FunctionName=os.environ["AGENT_FUNCTION"], InvocationType="Event", Payload=json.dumps({"trip": trip, "ids": go}).encode())
    return _resp(200, {"ok": True, "suggestions": _suggestions(trip)})


def _remove(trip, meta, body):
    """A thumbs down on a Group Tastes or Coffee spot takes it off the page, unless someone has voted it above MEH (the remover
    included) or another traveler gave it a thumbs up. The page data keeps the spot, so "undo" (anyone's) puts it back.
    Both go in the updates log and bump the trip's revision, so open pages reload."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name, iid, undo = body.get("name"), body.get("item"), body.get("undo") is True
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    items = {i.get("id"): i for i in json.loads(meta.get("page") or "{}").get("items", [])}
    it = items.get(iid) if isinstance(iid, str) else None
    thumbed = {c["key"] for c in _categories(trip, json.loads(meta.get("page") or "{}")) if c["thumbs"]}
    if not it or it.get("group") not in thumbed or it.get("stage"):
        return _resp(400, {"ok": False, "error": "item"})
    key, now = {"pk": f"trip#{trip}", "sk": f"removed#{iid}"}, int(time.time())
    if undo:
        try:
            TABLE.delete_item(Key=key, ConditionExpression="attribute_exists(sk)")
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
            return _resp(200, {"ok": True, "suggestions": _suggestions(trip)})   # already back
        for r in _suggestion_rows(trip):   # the log shows it came back, and who brought it
            if r.get("kind") == "remove" and r.get("item") == iid and r.get("status") == "removed":
                TABLE.update_item(Key={"pk": r["pk"], "sk": r["sk"]}, UpdateExpression="SET #s = :s, restoredBy = :b, updated = :u",
                                  ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":s": "restored", ":b": name, ":u": now})
                break
        bump_rev(trip)
        return _resp(200, {"ok": True, "suggestions": _suggestions(trip)})
    ballots, thumbs = _ballots(trip)
    wanted = [p for p in meta.get("travelers", [])
              if (ballots.get(p) or {}).get(iid, -1) >= 2 or (p != name and iid in (thumbs.get(p) or []))]
    if wanted:
        return _resp(409, {"ok": False, "error": "wanted", "by": wanted})
    try:
        TABLE.put_item(Item={**key, "by": name, "at": now, "place": str(it.get("place", ""))}, ConditionExpression="attribute_not_exists(sk)")
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        return _resp(200, {"ok": True, "suggestions": _suggestions(trip)})   # someone else just removed it
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": f"sugg#{int(time.time() * 1000):013d}-{os.urandom(2).hex()}", "by": name,
                         "text": str(it.get("place") or iid), "kind": "remove", "status": "removed", "item": iid, "created": now, "updated": now})
    if iid in (thumbs.get(name) or []):   # a thumbs down replaces your own thumbs up
        TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": f"ballot#{name}"}, UpdateExpression="SET up = :u",
                          ExpressionAttributeValues={":u": [x for x in thumbs[name] if x != iid]})
    bump_rev(trip)
    return _resp(200, {"ok": True, "suggestions": _suggestions(trip)})


def _get_maps_key():
    # Cached for an hour so a rotated key takes effect without a redeploy. None if the secret can't be read: the page
    # then shows illustrations.
    try:
        if _maps_key["value"] is None or time.time() - _maps_key["at"] > 3600:
            _maps_key["value"] = SSM.get_parameter(Name=os.environ["MAPS_PARAM"], WithDecryption=True)["Parameter"]["Value"].strip()
            _maps_key["at"] = time.time()
    except Exception:
        return None
    return _maps_key["value"]


def handler(event, _context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    parts = [p for p in event.get("rawPath", "/").split("/") if p]
    if parts == ["usage"]:
        if method == "GET":
            return _resp(200, _usage())
        if method == "POST":
            try:
                body = json.loads(event.get("body") or "{}")
                kinds = body.get("kinds") or []
            except (json.JSONDecodeError, AttributeError):
                return _resp(400, {"ok": False, "error": "json"})
            trip = body.get("trip")
            meta = _meta(trip) if isinstance(trip, str) and TRIP_RE.match(trip) else None
            if not _code_ok(meta, body.get("code")):
                return _resp(403, {"ok": False, "error": "code"})
            kinds = sorted(set(k for k in kinds if isinstance(k, str) and k in PAGE_KINDS)) if isinstance(kinds, list) else []
            if not kinds:
                return _resp(400, {"ok": False, "error": "kinds"})
            if {"photo", "search"} & set(kinds) and not _sections(trip, json.loads(meta.get("page") or "{}"), [])["photos"]:
                return _resp(409, {"ok": False, "error": "off"})   # photos are switched off: a page loaded before the switch stops
            try:
                reserved = _reserve(kinds)
            except (BotoCoreError, ClientError):
                return _resp(503, {"ok": False, "error": "busy"})  # not a budget answer: the page retries
            return _resp(200, {"ok": True}) if reserved else _resp(429, {"ok": False, "error": "limit"})
    if len(parts) < 2 or parts[0] != "trips" or not TRIP_RE.match(parts[1]):
        return _resp(404, {"ok": False, "error": "not_found"})
    trip = parts[1]
    meta = _meta(trip)

    if method == "GET" and len(parts) == 2:
        qs = event.get("queryStringParameters") or {}
        if not _code_ok(meta, qs.get("code")):
            return _resp(403, {"ok": False, "error": "code"})
        ballots, thumbs = _ballots(trip)
        live = {"rev": int(meta.get("rev", 0)), "suggestions": _suggestions(trip), "ballots": ballots, "thumbs": thumbs}
        if qs.get("owner"):   # whether this device's owner code is right
            live["owner"] = _owner_ok(meta, qs["owner"])
        if qs.get("only") == "ballots":  # the page's refresh
            return _resp(200, {"ok": True, **live})
        return _resp(200, {"ok": True, "trip": _page(trip, meta), "mapsApiKey": _get_maps_key(), **live})

    if method == "GET" and len(parts) == 3 and parts[2] == "map":   # the Trip Map's coordinates
        if not _code_ok(meta, (event.get("queryStringParameters") or {}).get("code")):
            return _resp(403, {"ok": False, "error": "code"})
        return _resp(200, {"ok": True, "points": _geo(trip, json.loads(meta.get("page") or "{}"))})

    if method == "POST" and len(parts) == 3 and parts[2] in ("suggestions", "remove", "approve", "sections", "goals", "categories"):
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"ok": False, "error": "json"})
        route = {"suggestions": _suggest, "remove": _remove, "approve": _approve, "sections": _set_section, "goals": _set_goals, "categories": _set_categories}[parts[2]]
        return route(trip, meta, body if isinstance(body, dict) else {})

    if method == "POST" and len(parts) == 3 and parts[2] == "ballots":
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"ok": False, "error": "json"})
        if not _code_ok(meta, body.get("code")):
            return _resp(403, {"ok": False, "error": "code"})
        name = body.get("name")
        if name not in meta.get("travelers", []):
            return _resp(400, {"ok": False, "error": "name"})
        raw = body.get("votes") or {}
        if not isinstance(raw, dict) or len(raw) > MAX_ITEMS:
            return _resp(400, {"ok": False, "error": "votes"})
        votes = {k: v for k, v in raw.items() if ITEM_RE.match(str(k)) and v in (0, 1, 2, 3) and not isinstance(v, bool)}
        up = body.get("up")
        if up is not None and (not isinstance(up, list) or len(up) > MAX_ITEMS):
            return _resp(400, {"ok": False, "error": "votes"})
        fields = {"votes": votes, "updated": int(time.time())}
        if up is not None:   # a page from before thumbs sends none: leave them as they were
            fields["up"] = sorted({x for x in up if isinstance(x, str) and ITEM_RE.match(x)})
        TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": f"ballot#{name}"}, UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
                          ExpressionAttributeNames={f"#{k}": k for k in fields}, ExpressionAttributeValues={f":{k}": v for k, v in fields.items()})
        ballots, thumbs = _ballots(trip)
        return _resp(200, {"ok": True, "ballots": ballots, "thumbs": thumbs})

    return _resp(405, {"ok": False, "error": "method"})
