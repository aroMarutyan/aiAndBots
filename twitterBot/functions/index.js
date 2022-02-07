const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const dbRef = admin.firestore().doc("tokens/demo");

const twitterApi = require("twitter-api-v2").default;
const twitterClient = new twitterApi({
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
});

const callbackURL = "http://127.0.0.1:5000/faxnow-app/us-central1/callback";

// Step 1
exports.auth = functions.https.onRequest((req, res) => {
  const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
    callbackURL,
    {
      scope: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    }
  );

  // store verifier
  await dbRef.set({ codeVerifier, state });

  res.redirect(url);
});

// Step 2
exports.callback = functions.https.onRequest((req, res) => {
  const { state, code } = req.query;

  const dbSnapshot = await dbRef.get();
  const { codeVerifier, state: storedState } = dbSnapshot.data();

  if (state !== storedState) {
    return res.status(400).send("Stored tokens do not match!");
  }
  const {
    client: loggedClient,
    accessToken,
    refreshToken,
  } = await twitterClient.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: callbackURL,
  });
  await dbRef.set({ accessToken, refreshToken });
  res.sendStatus(200);
});

// Step 3
exports.tweet = functions.https.onRequest((req, res) => {
  const { refreshToken } = (await dbRef.get()).data();

  const {
    client: refreshedClient,
    accessToken,
    refreshToken: newRefreshToken,
  } = await twitterClient.refreshOAuth2Token(refreshToken);

  await dbRef.set({ accessToken, refreshToken: newRefreshToken });

  const nextTweet = await openai.createCompletion("text-davinci-001", {
    prompt: "tweet something cool for #techtwitter", //Play around with the prompt
    max_tokens: 64,
  });

  const { data } = await refreshedClient.v2.tweet(
    nextTweet.data.choices[0].text
  );

  res.send(data);
});

// Open AI config
const { Configuration, OpenAIpi } = require("openai");
const configuration = new Configuration({
  organization: "YOUR_OPENAI_ORG",
  apiKey: "YOUR_OPENAI_SECRET",
});

const openai = new OpenAIpi(configuration);
