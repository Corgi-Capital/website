# Group Vote

Reusable ballot for group trip planning: each traveler marks items Must / Keen / Maybe / Skip, the list re-ranks by group total, and each item shows a live Google Maps photo.

- `web/`: the page engine (`group-vote.js`, `group-vote.css`) and shared settings (`group-vote-config.js`). Served by GitHub Pages.
- `server/`: AWS SAM app. One Lambda function URL and one DynamoDB table hold every trip's votes.
- Trip pages live under `events/` (first one: `events/2026/niseko/`). Each defines `window.TRIP` and loads the engine.

## One-time setup

**1. Store the Google Maps key in Secrets Manager**

```bash
aws secretsmanager create-secret --region us-east-1 --name group-vote/maps-api-key --secret-string "<browser key>"
# to rotate later: aws secretsmanager put-secret-value --region us-east-1 --secret-id group-vote/maps-api-key --secret-string "<new key>"
```

The key is a browser key: it still reaches every visitor's browser (via the server's `/config` route). Keeping it in Secrets Manager keeps it out of the public repo and lets you rotate it without a commit. Its real protection is the referrer restriction to `https://corgi-capital.com/*`. Cost: $0.40 a month for the secret.

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

The server keeps a monthly count of Google calls (Pacific-time months, matching Google billing) and refuses any photo lookup that would pass the limits: 950 photos and 4,800 searches by default, just under Google's free 1,000 and 5,000. Change them with `sam deploy --parameter-overrides PhotoMonthlyLimit=... SearchMonthlyLimit=...`. Check usage any time at `<VoteApiUrl>usage`.

The page reserves a search just before it runs and a photo only once a search finds one. If Google fails before any lookup works, it stops looking for the rest of that page view, so a broken key costs one search per view. Photos load once per page view, so a 32-item page uses its 950 photos in about 29 fully scrolled views a month across the whole group; raise `PhotoMonthlyLimit` if that's too few (Google bills photos past its free 1,000).

The count covers every trip page, since they share one key. It governs the pages; Google's own daily caps (set generously in the Cloud console) and a $5 budget alert stay in place as the backstop against anyone using the key outside the pages.

## Each new trip

1. Copy `events/2026/niseko/` to a new folder, e.g. `events/2027/tokyo/`.
2. In its `index.html`, set `id`, `title`, `intro`, `travelers`, `region` (country code for photo search), `regions`, and `items`. Each item has an `art` key (illustration shown until the photo loads; see `ART` in `web/group-vote.js`) and a `q` Google Maps search string.
3. Register the trip and its code:
   ```bash
   python server/create_trip.py --table <TableName> --trip tokyo-2027 --travelers "A,B,C" --code <code>
   ```
4. Push. Share the URL and the code.

Votes are protected by the trip code (stored hashed). It keeps out strangers, not determined attackers; don't put anything private in a ballot.
