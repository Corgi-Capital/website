"""Find each trip item's Google place, and render contact sheets of its photos for choosing "photos" by eye.

  python tools/photo_sheets.py --trip niseko-2027 --code "<password>"                    # every item, 10 photos each
  python tools/photo_sheets.py --trip niseko-2027 --code "<password>" --items a,b --count 6
  python tools/photo_sheets.py --trip niseko-2027 --code "<password>" --ids-only         # place ids only, no photos

Google gives up to 10 photos per place with no "food" label, and its first is usually the storefront, so the food shots
are picked by eye: the sheets number each photo with its position, and those positions go in the item's "photos"
(best first). The place ids it prints go in "placeId" (Google lets you keep place ids; not photos).

It runs the Maps JavaScript API in Chrome (Playwright: pip install playwright) on corgi-capital.com, where the key works,
by serving a blank page there from this script. The key and the trip come from the vote server with the trip's
password, and every lookup and photo is reserved there like the page does, so it counts against the month's budget:
one lookup per item, plus --count photos per item unless --ids-only. Google also caps photos per day (Cloud console
quota "GetPhotoMediaRequest per day"); a full trip's sheets can use most of it.
Writes <out>/<trip>-NN.png and <out>/<trip>-places.json.
"""
import argparse
import asyncio
import json
import os
import urllib.parse
import urllib.request

API = "https://wqfjpicjcrlryczoxqob2zphba0cmnck.lambda-url.us-east-1.on.aws"   # VoteApiUrl, as in web/group-vote-config.js
SITE = "https://corgi-capital.com"

PAGE_JS = """
window.reserve = async kind => { const r = await fetch(API + "/usage", {method: "POST", headers: {"Content-Type": "application/json"},
  body: JSON.stringify({trip: TRIP, code: CODE, kinds: [kind]})}); const j = await r.json(); if (!j.ok) throw new Error("budget: " + JSON.stringify(j)); };
window.collect = async (items, count, region) => {
  await new Promise((res, rej) => { window.__ready = res; const s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(KEY) + "&v=weekly&loading=async&callback=__ready"; s.onerror = rej; document.head.appendChild(s); });
  const {Place} = await google.maps.importLibrary("places");
  const out = [];
  for (const it of items) {
    await reserve("search");
    let p = null;
    if (it.placeId) { p = new Place({id: it.placeId, requestedLanguage: "en"}); await p.fetchFields({fields: ["displayName", "formattedAddress", "photos"]}); }
    else if (it.q) { const r = await Place.searchByText({textQuery: it.q, fields: ["id", "displayName", "formattedAddress", "photos"], maxResultCount: 1, language: "en", region}); p = r.places && r.places[0]; }
    const ph = (p && p.photos) || [], shots = [];
    for (let i = 0; i < Math.min(count, ph.length); i++) { await reserve("photo"); shots.push({i, url: ph[i].getURI({maxWidth: 360, maxHeight: 360})}); }
    out.push({id: it.id, dish: it.dish || "", placeId: p ? p.id : null, name: p ? p.displayName : null, address: p ? p.formattedAddress : null, photos: ph.length, shots});
  }
  return out;
};
window.sheet = rows => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"})[c]);
  document.body.innerHTML = rows.map(r => `<div class="row"><div class="lab"><b>${esc(r.id)}</b><br>${esc(r.dish)}<br><i>${esc(r.name || "(not found)")}</i><br>${r.photos} photos</div>` +
    r.shots.map(s => `<div class="cell"><img src="${s.url}"><span>${s.i}</span></div>`).join("") + `</div>`).join("");
  return Promise.all([...document.images].map(im => im.complete ? 0 : new Promise(res => { im.onload = im.onerror = res })));
};
"""


async def main():
    from playwright.async_api import async_playwright
    import sys
    sys.stdout.reconfigure(encoding="utf-8")   # place names are often Japanese
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--trip", required=True)
    a.add_argument("--code", required=True, help="the trip's password")
    a.add_argument("--items", help="comma-separated item ids (default: all)")
    a.add_argument("--count", type=int, default=10, help="photos per item, up to Google's 10")
    a.add_argument("--ids-only", action="store_true", help="look up places only; fetch no photos")
    a.add_argument("--out", default="sheets")
    o = a.parse_args()
    j = json.load(urllib.request.urlopen(f"{API}/trips/{o.trip}?code={urllib.parse.quote(o.code)}"))
    if not j.get("ok"):
        raise SystemExit("Wrong password or unknown trip")
    items = j["trip"]["items"]
    if o.items:
        want = o.items.split(",")
        items = [i for i in items if i["id"] in want]
    count = 0 if o.ids_only else max(0, min(10, o.count))
    os.makedirs(o.out, exist_ok=True)
    html = ("<!doctype html><meta charset=utf-8><style>body{margin:0;background:#111;color:#eee;font:13px/1.35 system-ui;padding:8px}"
            ".row{display:flex;gap:6px;margin-bottom:8px}.lab{width:200px;flex:none;padding:4px}.cell{position:relative;width:200px;height:200px;background:#000;flex:none}"
            ".cell img{width:100%;height:100%;object-fit:contain}.cell span{position:absolute;left:4px;top:4px;background:#ffd400;color:#000;font:700 16px system-ui;padding:0 6px;border-radius:4px}</style>"
            f"<script>const API={json.dumps(API)}, TRIP={json.dumps(o.trip)}, CODE={json.dumps(o.code)}, KEY={json.dumps(j['mapsApiKey'])};{PAGE_JS}</script>")
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        page = await (await b.new_context(viewport={"width": 1400, "height": 900})).new_page()
        await page.route(SITE + "/__photo_sheets/", lambda r: r.fulfill(body=html, content_type="text/html; charset=utf-8"))
        await page.goto(SITE + "/__photo_sheets/")
        rows = await page.evaluate("([items, count, region]) => collect(items, count, region)", [items, count, j["trip"].get("region") or "us"])
        if count:
            for c in range(0, len(rows), 6):
                await page.evaluate("rows => sheet(rows)", rows[c:c + 6])
                path = os.path.join(o.out, f"{o.trip}-{c // 6:02d}.png")
                await page.screenshot(path=path, full_page=True)
                print(path)
        await b.close()
    places = {r["id"]: {k: r[k] for k in ("placeId", "name", "address", "photos")} for r in rows}
    with open(os.path.join(o.out, f"{o.trip}-places.json"), "w", encoding="utf-8") as f:
        json.dump(places, f, indent=1, ensure_ascii=False)
    for k, v in places.items():
        print(f"{k}: {v['placeId']}  {v['name']} | {v['address']} | {v['photos']} photos")


if __name__ == "__main__":
    asyncio.run(main())
