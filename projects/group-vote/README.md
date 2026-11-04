# Group Vote

Reusable ballot for group trip planning, in the order a trip gets planned: **Trip Dates**, then **Lodging**, then the places to eat, drink and go. Each traveler marks every option MUST / I WANT / MEH / NAH (3 / 2 / 1 / 0 points; trip-date options read BEST / WORKS / IF NEEDED / CAN'T); the places sort by region or by the group's total, the page flags the ones that got a slot on the itinerary, and it keeps score of how many of each person's picks made it.

Each trip sits behind a password. The public page holds only the trip id and shows a password gate in the corgi-capital.com home page style; the server sends the page data (title, travelers, places), the votes and the Maps key once the password checks out. The browser remembers the password until someone taps "Lock".

- `web/`: the page engine (`group-vote.js`, `group-vote.css`) and shared settings (`group-vote-config.js`). Served by GitHub Pages.
- `server/`: AWS SAM app. One Lambda function URL and one DynamoDB table hold every trip's page data, password hash and votes.
- `trips/<id>.json`: each trip's page data. Git ignores this folder because the repo is public; `trip.example.json` shows the format.
- `tools/photo_sheets.py`: finds each place on Google and renders numbered contact sheets of its photos, for picking the food shots.
- `tools/invite_email.py`: renders a trip's invitation email (trip plan and vote buttons, the password, the route) from the trip file's `invite` block.
- Trip pages live under `events/` (first one: `events/2026/niseko/`). Each sets `window.TRIP = { id: "..." }` and loads the engine.

## The page

- **Trip Dates and Lodging** come first, each with a jump button at the top (with a red count of the options you haven't voted on). Trip Dates is either decided (the dates and everyone's arrival and departure) or a vote on date options. Lodging lists each stay as booked or to decide; an open stay's options are cards like the places (photos, links, votes), with the leader on points under its heading.
- Each place is a card: a photo strip you can swipe (arrows on desktop, tap for full screen), a title-case heading, the place's Tabelog score and tags, a **Tabelog** button (or the place's own site) and a **Google Maps** button for every photo and review, your vote, and the group's tally with each person's initial in their vote's color.
- **Region** groups places by where you'll be, each region split into regional specialties and local favorites, under a "Known for" line. **Ranking** sorts by the group's total.
- Each region's heading gives its spots, the days the group is there (9AM-11PM counts as a day) and the time windows, then four sections: Regional Specialties, Local Favorites, Group Tastes (picked for how this group eats; suggestions land here) and Events.
- Filters: On the Itinerary, Casual, Splurge, Sweets & Drinks, Events, Needs Rating (places you haven't rated, with a red count).
- The Tabelog number is colored by its rank within its own region, and the group's points by their average vote, both along the vote colors. A USD / JPY switch shows every price in the notes either way.
- **Suggest Spot** (next to "You've rated"): paste Google Maps links, Tabelog links or names, one per line, up to 5. The server queues each one and the agent (`server/agent.py`) reviews it with Claude Code running on the owner's Claude subscription (or an API key; see below): it pins down the place, reads its Tabelog page, checks whether Instagram creators feature it, writes the card like the others and adds it, or says why not (already listed, closed, outside the regions, can't tell which). The **Updates** panel at the top shows each one's progress (one line, the newest update, until it's opened; each device remembers open or closed), and open pages pick up new places within seconds. About 15-40 seconds each; 25 a day per trip at most. Every Claude run logs its turns, seconds, tokens, web searches and what it would cost at API prices (`cost` in the AgentFunction's CloudWatch logs; the subscription itself pays nothing extra), which is the number to watch before running this for anyone else on an API key. The comment button by each Group Tastes heading opens the Group Tastes as they stand (what the group loves and avoids, and the Spots That Nail It: places someone called exactly the kind the group wants, each a button to its card; anyone can read it) and takes a note on what the group loves or avoids. The same agent folds the note into the Group Tastes doc (the line under the heading, the short lists in the dialog, and the brief it uses to judge suggestions), or turns it down if it isn't about tastes. Point at a spot on the page ("the chicken-broth dipping soba is exactly what we want") and it becomes one of the Spots That Nail It, which the next search uses as its model. After an update it searches for up to 3 new spots that fit the change and queues each as a suggestion from the commenter, so they get the usual review; it only ever adds spots, never removes them. The doc lives in its own server row (`sk = "tastes"`, with the last 50 comments), so trip uploads never overwrite it. Google's `?cid=` links can't be read without a browser; the Share button's links and the address bar's `/maps/place/...` links work.
- **Group Tastes thumbs.** Each Group Tastes card has a thumbs up (a good pick: the agent's next search looks for more like it) and a thumbs down, which takes the spot off the list, but only while no one has voted it above MEH and no one else has given it a thumbs up (the button says who wants it). Anyone can undo a removal from the toast or the Updates panel, and suggesting the spot again brings it back; the agent never suggests a removed spot again. Removed spots stay in the trip's data (`removed#<id>` rows hide them), so votes and photos come back with them.
- **The owner's OK.** A Claude subscription may only run its owner's own requests: Anthropic's terms bar routing other people's requests through Free, Pro, Max or Ultra plan credentials, and its usage policy from Nov 12, 2026 bars services that do. So while the agent runs on the owner's subscription (`AgentAuth=subscription`, the default), a suggestion or Group Tastes comment from anyone else waits in Updates as "Awaiting OK" until the owner taps Run (or Skip) on a device opened with the owner link. The owner's own run at once, and the agent's follow-up searches are part of the run the owner started. Votes, thumbs and removals never touch Claude. With an API key instead (deploy with `AgentAuth=api`), everyone's suggestions run at once.
- Vote colors: green, light green, yellow, red. **Color-blind colors** (next to the key) switches to blue, pale blue, pale yellow, orange, which stay distinct with red-green or blue-yellow color blindness; each device remembers the choice. Both sets were picked by measured color difference, readable as text and as fills.
- The scoreboard at the top counts, per person, how many of their MUSTs, I WANTs, MEHs and NAHs got a dedicated itinerary slot. Every place stays on the itinerary as an alternative; `slot` marks the ones with a slot of their own.

## What it costs

Checked Nov 4, 2026, two days after launch:

- **Claude:** runs on the Claude subscription, and paid extra usage is off for the account, so the agent can't bill past the plan. It runs only the owner's own requests (see The owner's OK). Each run still logs what it would cost on the API (`cost`); the first four logged runs came to $0.42.
- **AWS:** about nothing. The Maps key and the Claude credential are Parameter Store SecureString parameters, which are free at the standard tier (Secrets Manager charges $0.40 a month per secret; the stack used it for its first two days). Lambda, DynamoDB, S3 and CloudWatch for this stack come to well under a cent a month at this size.
- **Google Maps:** the server's monthly budget (below) stops short of Google's free usage, so photos and lookups cost nothing; when it's spent, the page shows illustrations until the next month.

## One-time setup

**1. Store the Google Maps key in Parameter Store**

```bash
aws ssm put-parameter --region us-east-1 --name /group-vote/maps-api-key --type SecureString --value "<browser key>"
# to rotate later: the same with --overwrite (open pages pick it up within the hour)
```

The key is a browser key: it reaches the browser of everyone who enters a trip's password (the server sends it with the trip). Keeping it in Parameter Store keeps it out of the public repo and lets you rotate it without a commit. Its real protection is the referrer restriction to `https://corgi-capital.com/*`. Cost: nothing (standard parameters are free).

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

**Suggest Spot agent.** Deployed with the stack as `AgentFunction`. It needs a Claude credential in Parameter Store as `/group-vote/claude-oauth-token` (SecureString): a Claude Code OAuth token from `claude setup-token`, which runs on that Claude subscription and so only for the owner (see The owner's OK), or an API key (`sk-ant-api...`, billed per call), with the stack deployed with `--parameter-overrides AgentAuth=api`. The function fetches the pinned Claude Code build (`ClaudeCodeVersion`) from npm into `/tmp` on a cold start and checks it against `ClaudeCodeSha512`; to move to a newer version, update both (`npm view @anthropic-ai/claude-code-linux-arm64@<version> dist.integrity`). It runs Claude with only WebSearch and WebFetch, no settings, hooks or MCP servers, and every field of its reply is checked before anything is written.

**3. Google Maps key**

Create a key with Maps JavaScript API, Places API (New), Routes API and Geocoding API, restricted to `https://corgi-capital.com/*`, and put it in the parameter from step 1.

## Google Maps budget

The server keeps a monthly count of Google calls (Pacific-time months, matching Google billing) and refuses any lookup that would pass the limits: 950 photos and 4,800 lookups by default, just under Google's free 1,000 and 5,000. Change them with `sam deploy --parameter-overrides PhotoMonthlyLimit=... SearchMonthlyLimit=...`. Check usage any time at `<VoteApiUrl>usage`.

The page looks a place up as its card nears the screen, then fetches the strip's first photo; the others load only when someone swipes to them, and full screen reuses the same photos, so each photo costs once per page view. If Google fails before any lookup works, the page stops looking for that view; if Google refuses photos (its daily cap, below), it stops asking at the first refusal and says so. Either way the Google Maps buttons still work: they're plain links that need no API call.

The count covers every trip page, since they share one key. Reserving needs a trip's password, so strangers can't spend the budget. Google's own quotas in the Cloud console are the backstop, together with a $5 budget alert. One of them caps photos per day ("GetPhotoMediaRequest per day", 300 on this project as of Nov 2026, so one busy day can use it up); when it runs out, photos stop for everyone until midnight Pacific and the page says when they come back. Raise it there if the group hits it.

## Each new trip

1. Write `trips/<id>.json`, starting from `trip.example.json`:
   - Trip: `id`, `title`, `intro`, `travelers`, `region` (country code for searches), `regions` (in order), `knownFor` (per region, a few things it's known for). Optional: `year`, `time` (per region, the stays there: `["2/19 1PM - 2/21 12PM", "2/20 10AM - 5PM"]`; a missing time is 9AM to start and 11PM to end, so a bare date is that whole day; a shorter stay inside another region's, like a day trip, counts toward its own region's days), `fx`, `currency` and `currencySymbol` (notes are written in USD at `fx` local units per dollar; the switch converts), `tastes` (a paragraph the Suggest Spot agent uses to judge fit) and `tastesLine` (shown under Group Tastes). For the planning votes before the places: `dates` (`decided`, like "Thu Feb 18 – Mon Mar 1, 2027", with optional `note`, `head` and `rows` for who arrives and leaves when; without `decided`, the date options below are on the ballot), `lodging` (the stays in order, each `id`, `where`, `when`, `status` "booked" or "open", and optional `nights`, `name`, `area`, `url`, `note`) and `spotsTitle` (the places' heading, "Eats & Events" by default).
   - Each trip-date or lodging option is an item too, with `stage` "dates" or "lodging" (and `stay`: the open stay's id), `dish` (its name or the dates), `place` (where, or how many nights), and optional `badge`, `note`, `fits`, `tier`, `url`, `q` and `art` ("hotel", "calendar"). They never reach the Suggest Spot agent.
   - Each place: `id`, `r` (its region), `dish`, `place`, `area`, `score` (Tabelog, or "n/a"), `badge`, `note`, `url` (its Tabelog page, or its own site), `art` (the illustration shown until a photo loads; see `ART` in `web/group-vote.js`) and `q` (a Google Maps search that finds it). Optional: `kind` (meal / sweets / drinks / event), `tier` (casual / mid / splurge), `group` (specialty / favorite / tastes / event), `izakaya` (true shows an Izakaya pill), `fits` (why it suits the group, shown with a heart), `ig` (an unpaid post or reel by an Instagram creator recommending the place, shown as an IG pill: wisdom of the crowd, so never the place's own account or sponsored, affiliate or PR content), `placeId`, `photos`, `slot`. Write `dish` and `badge` in plain sentence case; the page shows them in title case. Places added through Suggest Spot also carry `suggestedBy`, `suggested` and `why`; they exist only on the server until you `--export`, and an upload that would drop them stops and lists them.
2. Upload it with a password:
   ```bash
   python server/create_trip.py --table <TableName> --file trips/tokyo-2027.json --code "<password>"
   ```
   Add `--owner-code "<a code only you know>"` (8+ characters) to set the owner's code, and `"owner": "<your name>"` in the trip file. Then open the page once on each of your own devices as `<page URL>#owner=<that code>`: the device keeps the code (the address bar drops it), runs your suggestions at once and shows Run and Skip on everyone else's. A wrong code is forgotten.
   After editing the file, run it again without `--code` to keep the password; with `--code` to change it (likewise `--owner-code`). Ballots are kept either way. `--export <id>` prints the server's copy if the file goes missing.
3. Pick the photos: `python tools/photo_sheets.py --trip <id> --code "<password>"` prints each place's id and renders numbered contact sheets. Put the id in `placeId` (lookups by id always find the same place) and the positions of the best food shots in `photos`, best first. Without `photos`, the page shows positions 1, 2, 3, then 0, since Google's first photo is usually the storefront. Google can reorder a place's photos over time; rerun the sheets if a card starts showing the wrong thing. Upload again.
4. Copy `events/2026/niseko/index.html` to a new folder, e.g. `events/2027/tokyo/`, and set its `id`.
5. Push. Share the URL and the password.
6. Once the itinerary is set, give each place that got a slot of its own `"slot": "Fri dinner"` (or `true`) and upload again.

The password is stored hashed and matches in any letter case, since phones capitalize the first letter. It's one shared password, not accounts: anyone who has it can see the page and vote under any traveler's name. Don't put anything in a trip you couldn't stand to have forwarded.

Google's terms: cards leave off photographer credits, which Google allows for gallery-size photos when the full-size view shows them ("if space is limited (such as in a gallery or for thumbnails), the author attribution can be omitted, provided that the user is able to access a larger version of the image that includes the full author attribution"); full screen credits each photographer, and each card photo carries its photographer as `data-credit` metadata, not shown. "Google Maps" appears as written and untranslated.
