// Shared settings for every group-vote trip page on corgi-capital.com.
// The Google Maps key is not stored here: the vote server reads it from AWS Parameter Store (SecureString
// "/group-vote/maps-api-key") and sends it with the trip, once the trip's password checks out.
window.GROUP_VOTE = {
  apiUrl: "https://wqfjpicjcrlryczoxqob2zphba0cmnck.lambda-url.us-east-1.on.aws/"   // Lambda function URL from projects/group-vote/server (sam deploy output VoteApiUrl)
};
