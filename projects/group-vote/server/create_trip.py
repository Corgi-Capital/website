"""Create or update a trip on the Group Vote server.

A trip's page data (title, intro, travelers, items) lives in a JSON file under projects/group-vote/trips/, which git
ignores because this repo is public, and on the server, which sends it only with the trip's password.
See ../trip.example.json for the format.

  python create_trip.py --table <TableName> --file ../trips/niseko-2027.json --code "<password to share>"
  python create_trip.py --table <TableName> --file ../trips/niseko-2027.json     # new page data, same password
  python create_trip.py --table <TableName> --export niseko-2027 > ../trips/niseko-2027.json   # file back from the server

Ballots are kept either way. Passwords match trimmed and in any case (a phone may capitalize the first letter).
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
    lost = sorted({str(i.get("r")) for i in items} - set(page.get("regions") or []))
    if bad or dupes or lost:
        raise SystemExit(f"bad item ids: {bad}; duplicate item ids: {dupes}; regions missing from 'regions': {lost}")


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("--table", required=True)
p.add_argument("--region", default="us-east-1")
g = p.add_mutually_exclusive_group(required=True)
g.add_argument("--file", help="the trip's JSON file")
g.add_argument("--export", metavar="TRIP", help="print a trip's JSON as the server has it")
p.add_argument("--code", help="the password travelers type in: needed the first time, optional after")
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
now = int(time.time())
fields = {"travelers": names, "page": json.dumps(page, ensure_ascii=False, separators=(",", ":")), "updated": now}
if a.code is not None:
    if not a.code.strip():
        raise SystemExit("The password can't be blank")
    fields["code_hash"] = code_hash(a.code)
kw = {
    "Key": {"pk": f"trip#{trip}", "sk": "meta"},
    "UpdateExpression": "SET " + ", ".join(f"#{k} = :{k}" for k in fields) + ", #created = if_not_exists(#created, :now)",
    "ExpressionAttributeNames": {**{f"#{k}": k for k in fields}, "#created": "created"},
    "ExpressionAttributeValues": {**{f":{k}": v for k, v in fields.items()}, ":now": now},
}
if a.code is None:
    kw["ConditionExpression"] = "attribute_exists(code_hash)"  # new page data only: the trip must already have a password
try:
    table.update_item(**kw)
except ClientError as e:
    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
        raise SystemExit(f"{trip} isn't on the server yet: give it a password with --code")
    raise
print(f"Trip {trip}: {len(page['items'])} items for {', '.join(names)}; password {'set' if a.code else 'unchanged'}")
