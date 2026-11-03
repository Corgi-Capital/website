# Niseko trip page

Trip page for the Group Vote tool in `projects/group-vote/`, trip id `niseko-2027`. The page itself (title, travelers, items) is in `projects/group-vote/trips/niseko-2027.json`, which stays out of git; the vote server sends it only with the trip's password.

To change the page, edit that file and run, from `projects/group-vote/server`:

```bash
python create_trip.py --table <TableName> --file ../trips/niseko-2027.json
```

Add `--code "<new password>"` to change the password. Remove this folder after the trip.
