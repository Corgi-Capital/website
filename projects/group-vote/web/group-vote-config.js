// Shared settings for every group-vote trip page on corgi-capital.com.
// The Google Maps key is not stored here: the page fetches it from the vote server's /config route,
// which reads it from AWS Secrets Manager (secret "group-vote/maps-api-key").
window.GROUP_VOTE = {
  apiUrl: ""   // Lambda function URL from projects/group-vote/server (sam deploy output VoteApiUrl)
};
