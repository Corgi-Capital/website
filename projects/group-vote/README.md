# Group Vote

Reusable ballot for group trip planning: each traveler marks items Must / Keen / Maybe / Skip, the list re-ranks by group total, and each item shows a live Google Maps photo.

- `web/`: the page engine (`group-vote.js`, `group-vote.css`) and shared settings (`group-vote-config.js`). Served by GitHub Pages.
- `server/`: AWS SAM app. One Lambda function URL and one DynamoDB table hold every trip's votes.
- Trip pages live under `events/` (first one: `events/2026/niseko/`). Each defines `window.TRIP` and loads the engine.

## One-time setup

**1. Vote server (AWS)**

```bash
cd projects/group-vote/server
sam build && sam deploy --guided   # stack name: group-vote; accept defaults
```

Copy the `VoteApiUrl` output into `web/group-vote-config.js` as `apiUrl`. Note the `TableName` output.

Cost: DynamoDB on-demand plus Lambda; a few trips' worth of votes stays inside the AWS free tier. Concurrency is capped at 5.

**2. Google Maps key (photos)**

Create a key with Maps JavaScript API and Places API (New), restricted to `https://corgi-capital.com/*`. Paste it into `web/group-vote-config.js` as `mapsApiKey`.

## Each new trip

1. Copy `events/2026/niseko/` to a new folder, e.g. `events/2027/tokyo/`.
2. In its `index.html`, set `id`, `title`, `intro`, `travelers`, `region` (country code for photo search), `regions`, and `items`. Each item has an `art` key (illustration shown until the photo loads; see `ART` in `web/group-vote.js`) and a `q` Google Maps search string.
3. Register the trip and its code:
   ```bash
   python server/create_trip.py --table <TableName> --trip tokyo-2027 --travelers "A,B,C" --code <code>
   ```
4. Push. Share the URL and the code.

Votes are protected by the trip code (stored hashed). It keeps out strangers, not determined attackers; don't put anything private in a ballot.
