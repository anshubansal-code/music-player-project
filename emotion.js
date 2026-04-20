// const EMOTIONS = {
//   happy     : { label:"Happy",     msg:"Your joy is electric! Let's match that energy.",  color:"#EF9F27" },
//   sad       : { label:"Sad",       msg:"Soft sounds to hold you close.",                  color:"#378ADD" },
//   angry     : { label:"Angry",     msg:"Let calm music ease the tension.",                color:"#D85A30" },
//   surprised : { label:"Surprised", msg:"Whoa! Dynamic music to match your energy.",       color:"#1DB954" },
//   fearful   : { label:"Fearful",   msg:"You're safe - peaceful sounds for your mind.",    color:"#9B7FD4" },
//   disgusted : { label:"Disgusted", msg:"Shaking that off - uplifting music incoming!",    color:"#639922" },
//   neutral   : { label:"Neutral",   msg:"Steady vibes for a steady state of mind.",        color:"#888780" }
// };

const EMOTIONS = {
  happy: {
    label:"Happy",
    msg:"Lagta hai kisi ne crush reply kar diya 😄🔥",
    color:"#EF9F27"
  },
  sad: {
    label:"Sad",
    msg:"Koi baat nahi... Arijit Singh sambhal lega 💔",
    color:"#378ADD"
  },
  angry: {
    label:"Angry",
    msg:"Shaant ho ja bhai... warna speaker toot jayega 😡",
    color:"#D85A30"
  },
  surprised: {
    label:"Surprised",
    msg:"Arey kya ho gaya?! 😲 Chalo music lagate hain",
    color:"#1DB954"
  },
  fearful: {
    label:"Fearful",
    msg:"Darr mat... main hoon na 😎",
    color:"#9B7FD4"
  },
  disgusted: {
    label:"Disgusted",
    msg:"Mood kharab? Music se reset karte hain 🤢➡️😄",
    color:"#639922"
  },
  neutral: {
    label:"Neutral",
    msg:"Bas vibe karte hain 😌🎶",
    color:"#888780"
  }
};

const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

let camStream   = null;
let camReady    = false;
let modelsReady = false;

async function initCamera() {
  const btn = document.getElementById("detect-btn");
  btn.disabled = true;
  btn.textContent = "Starting camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" }
    });
    camStream = stream;
    const video = document.getElementById("video");
    video.srcObject = stream;
    await new Promise(r => {
      video.onloadedmetadata = () => { video.play(); camReady = true; r(); };
    });
  } catch (e) {
    document.getElementById("cam-error").classList.remove("hidden");
    document.getElementById("video").classList.add("hidden");
    btn.disabled = false;
    btn.innerHTML = "Detect My Emotion";
    return;
  }

  btn.textContent = "Loading face model (~5s)...";

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    modelsReady = true;
    btn.innerHTML = "Detect My Emotion";
  } catch (e) {
    btn.textContent = "Model failed - check internet & refresh";
  }

  btn.disabled = false;
}

function captureFrame() {
  const video  = document.getElementById("video");
  const canvas = document.getElementById("frame-canvas");
  if (!video.videoWidth) return null;
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
}

async function callClaudeEmotion(_frame) {
  if (!modelsReady) throw new Error("Face model not ready - wait for the button to activate.");

  const video = document.getElementById("video");

  let detections = [];
  for (const inputSize of [416, 608, 320]) {
    try {
      detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.1 }))
        .withFaceExpressions();
    } catch (_) {}
    if (detections.length) break;
  }

  if (!detections.length) {
    throw new Error("No face detected - look directly at camera in good lighting and try again.");
  }

  const [top, score] = Object.entries(detections[0].expressions)
    .sort(([, a], [, b]) => b - a)[0];

  return { emotion: top, confidence: score };
}

async function callClaudeSongs(emotion, artist) {
  const moodNotes = {
    happy     : "Bright and uplifting energy",
    sad       : "Gentle and heartfelt melody",
    angry     : "Raw and powerful emotion",
    surprised : "Dynamic and exciting feel",
    fearful   : "Calm and reassuring tone",
    disgusted : "Fresh start energy",
    neutral   : "Balanced and steady flow"
  };

  // const q   = encodeURIComponent(artist);
  const q = encodeURIComponent(artist + " hindi songs");
  const res = await fetch(
    `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=50&attribute=artistTerm&country=in`
  );
  if (!res.ok) throw new Error("iTunes search failed - check your connection.");

  const data = await res.json();
  if (!data.results?.length) return { songs: [] };

  const shuffled = [...data.results].filter(t => t.trackName).sort(() => Math.random() - 0.5);

  const songs = shuffled.slice(0, 3).map(t => ({
    title      : t.trackName,
    artist     : t.artistName,
    year       : t.releaseDate ? t.releaseDate.slice(0, 4) : "",
    mood_note  : moodNotes[emotion] || "Perfect for this moment",
    itunes_term: `${t.artistName} ${t.trackName}`,
    youtube_id : ""
  }));

  return { songs };
}
