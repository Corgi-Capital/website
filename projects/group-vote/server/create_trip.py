"""Create or update a trip on the Group Vote server.

  python create_trip.py --table <TableName> --trip niseko-2027 \
      --travelers Bill,Edwin,Mikey,Alice --code <trip code to share>

Re-running updates the traveler list or code; existing ballots are kept.
"""
import argparse
import hashlib
import re
import time

import boto3

p = argparse.ArgumentParser()
p.add_argument("--table", required=True)
p.add_argument("--trip", required=True, help="lowercase letters, digits, hyphens; must match TRIP.id in the page")
p.add_argument("--travelers", required=True, help="comma-separated names, exactly as shown on the page")
p.add_argument("--code", required=True, help="the code travelers type into the page")
a = p.parse_args()

if not re.match(r"^[a-z0-9-]{1,48}$", a.trip):
    raise SystemExit("trip id must be lowercase letters, digits and hyphens")
names = [n.strip() for n in a.travelers.split(",") if n.strip()]
boto3.resource("dynamodb").Table(a.table).put_item(Item={
    "pk": f"trip#{a.trip}", "sk": "meta", "travelers": names,
    "code_hash": hashlib.sha256(a.code.encode()).hexdigest(), "created": int(time.time()),
})
print(f"Trip {a.trip} ready for {', '.join(names)}")
