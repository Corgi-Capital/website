# Hokkaido Eats Vote

Temporary page for the Feb 2027 Hokkaido trip: four travelers rank dishes and stops, with photos from Google Maps. Not linked from the site; `noindex`.

Live at https://corgi-capital.com/events/2026/niseko/

## Setup (two values in `CONFIG` at the top of `index.html`)

1. **Photos: `mapsApiKey`**
   - Google Cloud console: enable **Maps JavaScript API** and **Places API (New)**.
   - Create an API key. Restrict it to HTTP referrers `https://corgi-capital.com/*` and to those two APIs.
   - The key ships in page source; the referrer restriction is what protects it.
   - Usage is small (one text search per item per page load, lazy-loaded), well inside the monthly free allowance.

2. **Shared votes: `votesUrl`**
   - New Google Sheet > Extensions > Apps Script > paste `votes.gs`.
   - Project Settings > Script properties: `TRIP_CODE` = a code to share with the group.
   - Deploy > New deployment > Web app. Execute as **Me**, access **Anyone**. Copy the `/exec` URL.

Without either value the page still works: illustrations instead of photos, and votes saved only on each person's device.

## Remove after the trip

Delete `events/2026/niseko/`.
