# Group Vote

Reusable ballot for group trip planning. Each traveler marks every place MUST / I WANT / MEH / NAH (3 / 2 / 1 / 0 points); the page sorts by region or by the group's total, flags the places that got a slot on the itinerary, and keeps score of how many of each person's picks made it.

Each trip sits behind a password. The public page holds only the trip id and shows a password gate in the corgi-capital.com home page style; the server sends the page data (title, travelers, places), the votes and the Maps key once the password checks out. The browser remembers the password until someone taps "Lock".

- `web/`: the page engine (`group-vote.js`, `group-vote.css`) and shared settings (`group-vote-config.js`). Served by GitHub Pages.
- `server/`: AWS SAM app. One Lambda function URL and one DynamoDB table hold every trip's page data, password hash and votes.
- `trips/<id>.json`: each trip's page data. Git ignores this folder because the repo is public; `trip.example.json` shows the format.
- `tools/photo_sheets.py`: finds each place on Google and renders numbered contact sheets of its photos, for picking the food shots.
- Trip pages live under `events/` (first one: `events/2026/niseko/`). Each sets `window.TRIP = { id: "..." }` and loads the engine.

## The page

- Each place is a card: a photo strip you can swipe (arrows on desktop, tap for full screen), a title-case heading, the place's Tabelog score and tags, a **Tabelog** button (or the place's own site) and a **Google Maps** button for every photo and review, your vote, and the group's tally with each person's initial in their vote's color.
- **Region** groups places by where you'll be, each region split into regional specialties and local favorites, under a "Known for" line. **Ranking** sorts by the group's total.
- Filters: On the Itinerary, Casual, Splurge, Izakaya, Sweets & Drinks, Needs Rating (places you haven't rated).
- Vote colors: green, light green, yellow, red. **Color-blind colors** (next to the key) switches to blue, pale blue, pale yellow, orange, which stay distinct with red-green or blue-yellow color blindness; each device remembers the choice. Both sets were picked by measured color difference, readable as text and as fills.
- The scoreboard at the top counts, per person, how many of their MUSTs, I WANTs, MEHs and NAHs got a dedicated itinerary slot. Every place stays on the itinerary as an alternative; `slot` marks the ones with a slot of their own.

## One-time setup

**1. Store the Google Maps key in Secrets Manager**

```bash
aws secretsmanager create-secret --region us-east-1 --name group-vote/maps-api-key --secret-string "<browser key>"
# to rotate later: aws secretsmanager put-secret-value --region us-east-1 --secret-id group-vote/maps-api-key --secret-string "<new key>"
```

The key is a browser key: it reaches the browser of everyone who enters a trip's password (the server sends it with the trip). Keeping it in Secrets Manager keeps it out of the public repo and lets you rotate it without a commit. Its real protection is the referrer restriction to `https://corgi-capital.com/*`. Cost: $0.40 a month for the secret.

**2. Vote server (AWS)**

```bash
cd projects/group-vote/server
sam build && sam deploy --guided   # stack name: group-vote, region us-east-1; answer y to the IAM and "no authentication" prompts
```

Copy the `VoteApiUrl` output into `web/group-vote-config.js` as `apiUrl`. Note the `TableName` output.

To ship a later change to `app.py`, build outside any OneDrive-synced folder: OneDrive locks `.aws-sam/build`, so `sam build` fails with "Access is denied", and a deploy from the half-cleaned folder uploads an empty package (CloudFormation rolls it back).

```bash
sam build --build-dir <dir outside OneDrive> && sam deploy --template-file <that dir>/template.yaml --stack-name group-vote --region us-east-1 --capabilities CAPABILITY_IAM --resolve-s3
```

Cost: DynamoDB on-demand plus Lambda; a few trips' worth of votes stays inside the AWS free tier. Concurrency is capped at 5.

**3. Google Maps key**

Create a key with Maps JavaScript API, Places API (New), Routes API and Geocoding API, restricted to `https://corgi-capital.com/*`, and put it in the secret from step 1.

## Google Maps budget

The server keeps a monthly count of Google calls (Pacific-time months, matching Google billing) and refuses any lookup that would pass the limits: 950 photos and 4,800 lookups by default, just under Google's free 1,000 and 5,000. Change them with `sam deploy --parameter-overrides PhotoMonthlyLimit=... SearchMonthlyLimit=...`. Check usage any time at `<VoteApiUrl>usage`.

The page looks a place up as its card nears the screen, then fetches the strip's first photo; the others load only when someone swipes to them, and full screen reuses the same photos, so each photo costs once per page view. If Google fails before any lookup works, the page stops looking for that view; if Google refuses photos (its daily cap, below), it stops asking at the first refusal and says so. Either way the Google Maps buttons still work: they're plain links that need no API call.

The count covers every trip page, since they share one key. Reserving needs a trip's password, so strangers can't spend the budget. Google's own quotas in the Cloud console are the backstop, together with a $5 budget alert. One of them caps photos per day ("GetPhotoMediaRequest per day"); when it runs out, photos stop for everyone until midnight Pacific. Raise it there if the group hits it.

## Each new trip

1. Write `trips/<id>.json`, starting from `trip.example.json`:
   - Trip: `id`, `title`, `intro`, `travelers`, `region` (country code for searches), `regions` (in order), `knownFor` (per region, a few things it's known for).
   - Each place: `id`, `r` (its region), `dish`, `place`, `area`, `score` (Tabelog, or "n/a"), `badge`, `note`, `url` (its Tabelog page, or its own site), `art` (the illustration shown until a photo loads; see `ART` in `web/group-vote.js`) and `q` (a Google Maps search that finds it). Optional: `kind` (meal / sweets / drinks), `tier` (casual / mid / splurge), `group` (specialty / favorite), `izakaya` (true puts it under the Izakaya filter), `placeId`, `photos`, `slot`. Write `dish` and `badge` in plain sentence case; the page shows them in title case.
2. Upload it with a password:
   ```bash
   python server/create_trip.py --table <TableName> --file trips/tokyo-2027.json --code "<password>"
   ```
   After editing the file, run it again without `--code` to keep the password; with `--code` to change it. Ballots are kept either way. `--export <id>` prints the server's copy if the file goes missing.
3. Pick the photos: `python tools/photo_sheets.py --trip <id> --code "<password>"` prints each place's id and renders numbered contact sheets. Put the id in `placeId` (lookups by id always find the same place) and the positions of the best food shots in `photos`, best first. Without `photos`, the page shows positions 1, 2, 3, then 0, since Google's first photo is usually the storefront. Google can reorder a place's photos over time; rerun the sheets if a card starts showing the wrong thing. Upload again.
4. Copy `events/2026/niseko/index.html` to a new folder, e.g. `events/2027/tokyo/`, and set its `id`.
5. Push. Share the URL and the password.
6. Once the itinerary is set, give each place that got a slot of its own `"slot": "Fri dinner"` (or `true`) and upload again.

The password is stored hashed and matches in any letter case, since phones capitalize the first letter. It's one shared password, not accounts: anyone who has it can see the page and vote under any traveler's name. Don't put anything in a trip you couldn't stand to have forwarded.

Google's terms: cards leave off photographer credits, which Google allows for gallery-size photos when the full-size view shows them; full screen credits each photographer. "Google Maps" appears as written and untranslated.
