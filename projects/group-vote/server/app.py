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
                                       down: takes a Group Tastes spot off the page, unless someone has voted it above MEH or
                                       another traveler gave it a thumbs up (409 {"ok": false, "error": "wanted", "by":
                                       [names]}). "undo": true puts it back; anyone can.
  POST /trips/{trip}/suggestions       body {"code", "name", "text", "why", "owner"} -> {"ok": true, "suggestions": [...],
                                       "held": bool}. One suggestion per line of text (up to 5): a Google Maps link, a
                                       Tabelog link or a name. Each is queued and the agent function (agent.py) is invoked to
                                       review and add it. With AGENT_HOLD=owner, only suggestions sent with the owner's code
                                       run at once and anyone else's are "held" until the owner OKs them. 429 "limit" past
                                       the trip's daily cap.
  POST /trips/{trip}/sections          body {"code", "name", "section", "on"} -> {"ok": true, "sections": {...},
                                       "suggestions": [...]}. Turns a section's picks on, or off (suggestions only), for
                                       everyone; logged in the updates. The page data carries "sections": {key: bool}.
  POST /trips/{trip}/approve           body {"code", "owner", "ids", "run"} -> {"ok": true, "suggestions": [...]}. The owner
                                       runs held suggestions (run: true) or skips them (run: false). 403 "owner" without the
                                       owner's code.
  GET  /usage                          -> {"ok": true, "month": "YYYY-MM", "used": {...}, "limits": {...}}
  POST /usage                          body {"trip", "code", "kinds": ["search", "photo"]} -> {"ok": true}; 403 "code" without a
                                       valid password; 429 {"ok": false, "error": "limit"} only when the month's budget is spent;
                                       503 {"ok": false, "error": "busy"} on a passing error.
                                       Reserves one unit of each kind against this month's Google Maps budget.

Table layout (single table, on-demand)
  pk = "trip#<trip>", sk = "meta"          travelers [names], code_hash (see code_hash), owner_hash (the owner's code, same
                                           hash), page (page data as JSON), rev, created, updated
  pk = "trip#<trip>", sk = "ballot#<name>" votes {item_id: int}, up [item ids with this traveler's thumbs up], updated
  pk = "trip#<trip>", sk = "sections"      s_<section> (bool): a section flipped on the page; wins over the trip file's "sections"
  pk = "trip#<trip>", sk = "removed#<item>" by, at, place: a Group Tastes spot the group took off the page. The page data
                                           keeps the spot, so undo (or suggesting it again) brings it back as it was.
  pk = "trip#<trip>", sk = "sugg#<ms>-<r>" by, text, why, kind (spot, taste, remove, section), status (queued, working, added,
                                           duplicate, rejected, failed; held, declined; removed, restored), reason, item (the card's id),
                                           restoredBy, created, updated
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
SSM = boto3.client("ssm")   # the Maps key and the agent's Claude credential, as SecureString parameters (free)
# "none" (the default): every traveler's suggestion runs at once. The owner pre-approves them as their own requests (Bill,
# 2026-11-04, for his private trip page). "owner": anyone else's wait for the owner's OK, given on a device holding the
# owner's code (an owner link); for a page where the owner's Claude subscription mustn't run other people's requests.
AGENT_HOLD = os.environ.get("AGENT_HOLD", "none")
# The page's sections. Each shows our picks plus everyone's suggestions (on), or suggestions only (off: our picks are
# hidden there and the agent stops adding to it; suggestions are still looked up). Anyone can flip one.
SECTIONS = ("locations", "dates", "lodging", "specialty", "favorite", "tastes", "event")
LAMBDA = boto3.client("lambda")
SUGGEST_DAILY_LIMIT = int(os.environ.get("SUGGEST_DAILY_LIMIT", "25"))
SUGGEST_SHOW_DAYS = 7
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
    page["sections"] = _sections(trip, page)
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
    if not take_daily(trip, len(lines)):
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


def _sections(trip, page):
    """Each section's state: True shows our picks, False is suggestions only. The trip file's "sections" sets where it
    starts; a flip on the page wins."""
    on = {k: True for k in SECTIONS}
    on.update({k: v for k, v in (page.get("sections") or {}).items() if k in SECTIONS and isinstance(v, bool)})
    row = TABLE.get_item(Key={"pk": f"trip#{trip}", "sk": "sections"}, ConsistentRead=True).get("Item") or {}
    on.update({k: bool(row[f"s_{k}"]) for k in SECTIONS if f"s_{k}" in row})
    return on


def _set_section(trip, meta, body):
    """Anyone turns a section's picks on or off, for everyone (the page asks them to confirm). Logged; open pages reload."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name, key, on = body.get("name"), body.get("section"), body.get("on")
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    if key not in SECTIONS or not isinstance(on, bool):
        return _resp(400, {"ok": False, "error": "section"})
    now = int(time.time())
    TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": "sections"}, UpdateExpression="SET #k = :v, updated = :u",
                      ExpressionAttributeNames={"#k": f"s_{key}"}, ExpressionAttributeValues={":v": on, ":u": now})
    TABLE.put_item(Item={"pk": f"trip#{trip}", "sk": f"sugg#{int(time.time() * 1000):013d}-{os.urandom(2).hex()}", "by": name,
                         "text": key, "kind": "section", "status": "on" if on else "off", "created": now, "updated": now})
    bump_rev(trip)
    return _resp(200, {"ok": True, "sections": _sections(trip, json.loads(meta.get("page") or "{}")), "suggestions": _suggestions(trip)})


def take_daily(trip, n):
    """Counts n suggestions against the trip's daily cap (Pacific time), all or none. False if that would pass it. The
    agent's own finds count too (agent.discover)."""
    day = datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")
    try:
        TABLE.update_item(Key={"pk": f"trip#{trip}", "sk": f"suggday#{day}"}, UpdateExpression="ADD #c :n",
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
    """A thumbs down on a Group Tastes spot takes it off the page, unless someone has voted it above MEH (the remover
    included) or another traveler gave it a thumbs up. The page data keeps the spot, so "undo" (anyone's) puts it back.
    Both go in the updates log and bump the trip's revision, so open pages reload."""
    if not _code_ok(meta, body.get("code")):
        return _resp(403, {"ok": False, "error": "code"})
    name, iid, undo = body.get("name"), body.get("item"), body.get("undo") is True
    if name not in meta.get("travelers", []):
        return _resp(400, {"ok": False, "error": "name"})
    items = {i.get("id"): i for i in json.loads(meta.get("page") or "{}").get("items", [])}
    it = items.get(iid) if isinstance(iid, str) else None
    if not it or it.get("group") != "tastes" or it.get("stage"):
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
        ballots, thumbs = _ballots(trip)
        live = {"rev": int(meta.get("rev", 0)), "suggestions": _suggestions(trip), "ballots": ballots, "thumbs": thumbs}
        if qs.get("owner"):   # whether this device's owner code is right
            live["owner"] = _owner_ok(meta, qs["owner"])
        if qs.get("only") == "ballots":  # the page's refresh
            return _resp(200, {"ok": True, **live})
        return _resp(200, {"ok": True, "trip": _page(trip, meta), "mapsApiKey": _get_maps_key(), **live})

    if method == "POST" and len(parts) == 3 and parts[2] in ("suggestions", "remove", "approve", "sections"):
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"ok": False, "error": "json"})
        route = {"suggestions": _suggest, "remove": _remove, "approve": _approve, "sections": _set_section}[parts[2]]
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
