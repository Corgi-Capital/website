"""Group Vote API: one Lambda behind a function URL, one DynamoDB table.

A trip's page data (title, travelers, items), its votes and the Google Maps key go out only with the trip's password,
so the public page carries nothing but the trip id.

Routes
  GET  /trips/{trip}?code=...          -> {"ok": true, "trip": {page data}, "ballots": {name: {item_id: 0-3}}, "mapsApiKey": "..."}
                                       (&only=ballots: just {"ok": true, "ballots": ...}). 403 {"ok": false, "error": "code"}
                                       for a wrong password or an unknown trip.
                                       Both also carry "rev" (bumped whenever the places change) and "suggestions" (the last
                                       few days' Suggest Spot entries and how each went).
  POST /trips/{trip}/ballots           body {"code", "name", "votes"} -> {"ok": true, "ballots": ...}
  POST /trips/{trip}/suggestions       body {"code", "name", "text", "why"} -> {"ok": true, "suggestions": [...]}. One
                                       suggestion per line of text (up to 5): a Google Maps link, a Tabelog link or a
                                       name. Each is queued and the agent function (agent.py) is invoked to review and
                                       add it. 429 "limit" past the trip's daily cap.
  GET  /usage                          -> {"ok": true, "month": "YYYY-MM", "used": {...}, "limits": {...}}
  POST /usage                          body {"trip", "code", "kinds": ["search", "photo"]} -> {"ok": true}; 403 "code" without a
                                       valid password; 429 {"ok": false, "error": "limit"} only when the month's budget is spent;
                                       503 {"ok": false, "error": "busy"} on a passing error.
                                       Reserves one unit of each kind against this month's Google Maps budget.

Table layout (single table, on-demand)
  pk = "trip#<trip>", sk = "meta"          travelers [names], code_hash (see code_hash), page (page data as JSON), rev,
                                           created, updated
  pk = "trip#<trip>", sk = "ballot#<name>" votes {item_id: int}, updated
  pk = "trip#<trip>", sk = "sugg#<ms>-<r>" by, text, why, status (queued, working, added, duplicate, rejected, failed),
                                           reason, item (the card's id), created, updated
  pk = "trip#<trip>", sk = "suggday#<date>" count (suggestions that day, Pacific time)
  pk = "usage#<YYYY-MM>", sk = "<kind>"    count (Google Maps calls made this month, Pacific time like Google billing)
"""
import hashlib
import hmac
import json
import os
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError

TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
SECRETS = boto3.client("secretsmanager")
LAMBDA = boto3.client("lambda")
SUGGEST_DAILY_LIMIT = int(os.environ.get("SUGGEST_DAILY_LIMIT", "25"))
SUGGEST_SHOW_DAYS = 4
_maps_key = {"value": None, "at": 0}
TRIP_RE = re.compile(r"^[a-z0-9-]{1,48}$")
ITEM_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
MAX_ITEMS = 300
# Monthly ceilings, kept just under Google's free monthly usage (Text Search Pro 5,000; Place Photos 1,000).
LIMITS = {"search": int(os.environ.get("SEARCH_MONTHLY_LIMIT", "4800")), "photo": int(os.environ.get("PHOTO_MONTHLY_LIMIT", "950"))}


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


def _resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body)}


def _meta(trip):
    return TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "meta"}).get("Item")


def code_hash(code):
    """Passwords match trimmed and in any case, so a phone's capitalized first letter still works. create_trip.py
    stores the same hash."""
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()


def _code_ok(meta, code):
    if not meta or "code_hash" not in meta or not isinstance(code, str) or not code.strip():
        return False
    return hmac.compare_digest(code_hash(code), meta["code_hash"])


def _page(trip, meta):
    page = json.loads(meta.get("page") or "{}")
    page.update(id=trip, travelers=list(meta.get("travelers", [])))
    return page


def _ballots(trip):
    out, kwargs = {}, {"KeyConditionExpression": Key("pk").eq(f"trip#{trip}") & Key("sk").begins_with("ballot#")}
    while True:
        page = TABLE.query(**kwargs)
        for it in page["Items"]:
            out[it["sk"].split("#", 1)[1]] = {k: int(v) for k, v in it.get("votes", {}).items()}
        if "LastEvaluatedKey" not in page:
            return out
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def _suggestion_rows(trip, limit=40):
    """The newest suggestion rows, newest first."""
    q = TABLE.query(KeyConditionExpression=Key("pk").eq(f"trip#{trip}") & Key("sk").begins_with("sugg#"), ScanIndexForward=False, Limit=limit)
    return q["Items"]


def _suggestions(trip):
    """The last few days' suggestions as the page shows them."""
    since = int(time.time()) - SUGGEST_SHOW_DAYS * 86400
    keep = ("by", "text", "why", "status", "reason", "item")
    return [{"id": r["sk"], **{k: str(r.get(k, "")) for k in keep}, "created": int(r.get("created", 0)), "updated": int(r.get("updated", 0))}
            for r in _suggestion_rows(trip) if int(r.get("created", 0)) >= since]


def _suggest(trip, meta, body):
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name = body.get("name")
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    text, why = body.get("text"), body.get("why") or ""
    lines = list(dict.fromkeys(l.strip() for l in text.splitlines() if l.strip())) if isinstance(text, str) else []
    if not lines or len(lines) > 5 or any(len(l) > 500 for l in lines) or not isinstance(why, str):
        return _resp(400, {"ok": False, "error": "text"})
    day = datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")
    try:
        TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": f"suggday#{day}"}, UpdateExpression="ADD #c :n",
                          ConditionExpression="attribute_not_exists(#c) OR #c <= :most", ExpressionAttributeNames={"#c": "count"},
                          ExpressionAttributeValues={":n": len(lines), ":most": SUGGEST_DAILY_LIMIT - len(lines)})
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return _resp(429, {"ok": False, "error": "limit"})
        raise
    now, ids = time.time(), []
    for n, line in enumerate(lines):
        sk = f"sugg#{int(now * 1000) + n:013d}-{os.urandom(2).hex()}"
        TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": sk, "by": name, "text": line, "why": why.strip()[:200],
                             "status": "queued", "created": int(now), "updated": int(now)})
        ids.append(sk)
    LAMBDA.invoke(FunctionName=os.environ["AGENT_FUNCTION"], InvocationType="Event", Payload=json.dumps({"trip": trip, "ids": ids}).encode())
    return _resp(200, {"ok": True, "suggestions": _suggestions(trip)})


def _get_maps_key():
    # Cached for an hour so a rotated key takes effect without a redeploy. None if the secret can't be read: the page
    # then shows illustrations.
    try:
        if _maps_key["value"] is None or time.time() - _maps_key["at"] > 3600:
            _maps_key["value"] = SECRETS.get_secret_value(SecretId=os.environ["MAPS_SECRET_ID"])["SecretString"].strip()
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
            if not isinstance(trip, str) or not TRIP_RE.match(trip) or not _code_ok(_meta(trip), body.get("code")):
                return _resp(403, {"ok": False, "error": "code"})
            kinds = sorted(set(k for k in kinds if isinstance(k, str) and k in LIMITS)) if isinstance(kinds, list) else []
            if not kinds:
                return _resp(400, {"ok": False, "error": "kinds"})
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
        live = {"rev": int(meta.get("rev", 0)), "suggestions": _suggestions(trip)}
        if qs.get("only") == "ballots":  # the page's refresh
            return _resp(200, {"ok": True, "ballots": _ballots(trip), **live})
        return _resp(200, {"ok": True, "trip": _page(trip, meta), "ballots": _ballots(trip), "mapsApiKey": _get_maps_key(), **live})

    if method == "POST" and len(parts) == 3 and parts[2] == "suggestions":
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"ok": False, "error": "json"})
        return _suggest(trip, meta, body if isinstance(body, dict) else {})

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
