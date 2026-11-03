"""Group Vote API: one Lambda behind a function URL, one DynamoDB table.

Routes
  GET  /config                         -> {"ok": true, "mapsApiKey": "..."} (browser key, read from Secrets Manager)
  GET  /trips/{trip}?code=...          -> {"ok": true, "ballots": {name: {item_id: 0-3}}}
  POST /trips/{trip}/ballots           body {"code", "name", "votes"} -> same as GET

Table layout (single table, on-demand)
  pk = "trip#<trip>", sk = "meta"          travelers [names], code_hash (sha256 hex), created
  pk = "trip#<trip>", sk = "ballot#<name>" votes {item_id: int}, updated
"""
import hashlib
import hmac
import json
import os
import re
import time

import boto3
from boto3.dynamodb.conditions import Key

TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
SECRETS = boto3.client("secretsmanager")
_maps_key = {"value": None, "at": 0}
TRIP_RE = re.compile(r"^[a-z0-9-]{1,48}$")
ITEM_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
MAX_ITEMS = 300


def _resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body)}


def _meta(trip):
    return TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "meta"}).get("Item")


def _code_ok(meta, code):
    if not meta or not isinstance(code, str):
        return False
    given = hashlib.sha256(code.encode()).hexdigest()
    return hmac.compare_digest(given, meta["code_hash"])


def _ballots(trip):
    out, kwargs = {}, {"KeyConditionExpression": Key("pk").eq(f"trip#{trip}") & Key("sk").begins_with("ballot#")}
    while True:
        page = TABLE.query(**kwargs)
        for it in page["Items"]:
            out[it["sk"].split("#", 1)[1]] = {k: int(v) for k, v in it.get("votes", {}).items()}
        if "LastEvaluatedKey" not in page:
            return out
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def _get_maps_key():
    # Cached for an hour so a rotated key takes effect without a redeploy.
    if _maps_key["value"] is None or time.time() - _maps_key["at"] > 3600:
        _maps_key["value"] = SECRETS.get_secret_value(SecretId=os.environ["MAPS_SECRET_ID"])["SecretString"].strip()
        _maps_key["at"] = time.time()
    return _maps_key["value"]


def handler(event, _context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    parts = [p for p in event.get("rawPath", "/").split("/") if p]
    if method == "GET" and parts == ["config"]:
        try:
            return _resp(200, {"ok": True, "mapsApiKey": _get_maps_key()})
        except Exception:  # missing secret or permissions: page falls back to illustrations
            return _resp(503, {"ok": False, "error": "config"})
    if len(parts) < 2 or parts[0] != "trips" or not TRIP_RE.match(parts[1]):
        return _resp(404, {"ok": False, "error": "not_found"})
    trip = parts[1]
    meta = _meta(trip)

    if method == "GET" and len(parts) == 2:
        code = (event.get("queryStringParameters") or {}).get("code")
        if not _code_ok(meta, code):
            return _resp(403, {"ok": False, "error": "code"})
        return _resp(200, {"ok": True, "ballots": _ballots(trip)})

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
        TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": f"ballot#{name}", "votes": votes, "updated": int(time.time())})
        return _resp(200, {"ok": True, "ballots": _ballots(trip)})

    return _resp(405, {"ok": False, "error": "method"})
