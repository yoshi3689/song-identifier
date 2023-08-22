require("dotenv").config();
const twilio = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const WaveFile = require("wavefile").WaveFile;
const VoiceResponse = require("twilio").twiml.VoiceResponse;
const express = require("express");
const axios = require("axios");

const app = express();

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get('/', async (req, res) => {
  res.send("welcome to song identifier!");
})

app.post("/record", async (req, res) => {
  console.log(req.body)
  const twiml = new VoiceResponse();
  twiml.record({
    action: "/identify",
    maxLength: "5",
  });
  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/identify", async (req, res) => {
  const twiml = new VoiceResponse();
  let response;

  // Fetch recording by URL.
  // Request needs to be polled since recording may be processing
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  while (true) {
    await delay(1000);
    response = await axios
      .get(req.body.RecordingUrl, { responseType: "arraybuffer" })
      .catch((err) => {});
    if (response) break;
  }

  console.log(data);
  // Reformat recording for API
  wav = new WaveFile();
  wav.fromBuffer(response.data);
  wav.toSampleRate(44100);
  const wavBuffer = wav.toBuffer();
  const base64String = new Buffer.from(wavBuffer).toString("base64");

  // If track is identified, send sms of track info. Else, record and identify the next 5 seconds of the song
  const track = await fetchTrack(base64String);
  if (track) {
    sendSMS(track, req.body.Caller);
    await twiml.hangup();
  } else {
    twiml.redirect("/record");
  }
  res.type("text/xml");
  res.send(twiml.toString());
});

async function fetchTrack(base64String) {
  const options = {
    method: "POST",
    url: "https://shazam.p.rapidapi.com/songs/v2/detect",
    headers: {
      "content-type": "text/plain",
      "X-RapidAPI-Key": process.env.RAPID_API_KEY,
      "X-RapidAPI-Host": "shazam.p.rapidapi.com",
    },
    data: base64String,
  };

  const response = await axios.request(options).catch(function (error) {
    console.error(error);
  });
  if (response.data.matches.length) return response.data.track;
  else return null;
}

async function sendSMS(track, caller) {
  twilio.messages
    .create({
      body: `Song detected: ${track.title} - ${track.subtitle}\n\n${track.url}`,
      from: process.env.TWILIO_NUMBER,
      mediaUrl: [track.images.coverart],
      to: caller,
    })
    .then((message) => console.log(message.sid));
}

app.listen(3000, () => {
  console.log(`Listening on port 3000`);
});
