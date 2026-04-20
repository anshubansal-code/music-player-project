// ============================================================
//  music.js  — 3-Layer In-App Playback (no redirects)
//  Layer 1 : iTunes 30-sec real MP3 preview
//  Layer 2 : YouTube iframe embedded in page
//  Layer 3 : Web Audio API synthesized fallback
// ============================================================

let currentAudio  = null;
let audioCtx      = null;
let analyserNode  = null;
let synthTimer    = null;
let waveFrame     = null;
let noteIdx       = 0;
let isPlaying     = false;
let playbackToken = 0;

/* Synth scales per emotion */
const SYNTH_CFG = {
  happy     : { notes:[0,4,7,12,7,4,0,4],  root:261.63, tempo:275,  wave:"triangle" },
  sad       : { notes:[0,3,7,10,7,3,0,3],  root:220,    tempo:700,  wave:"sine"     },
  angry     : { notes:[0,5,7,5,0,5,-5,0],  root:174.61, tempo:950,  wave:"sine"     },
  surprised : { notes:[0,4,7,9,12,9,7,4],  root:293.66, tempo:308,  wave:"square"   },
  fearful   : { notes:[0,2,5,7,9,7,5,2],   root:196,    tempo:1100, wave:"sine"     },
  disgusted : { notes:[0,4,7,9,11,9,7,4],  root:246.94, tempo:375,  wave:"triangle" },
  neutral   : { notes:[0,3,5,7,10,7,5,3],  root:233,    tempo:540,  wave:"sawtooth" }
};

/* ── Stop all audio ─────────────────────── */
function stopAll() {
  playbackToken++;
  if (currentAudio)  {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
  if (synthTimer)    { clearInterval(synthTimer); synthTimer = null; }
  if (waveFrame)     { cancelAnimationFrame(waveFrame); waveFrame = null; }
  if (audioCtx)      { audioCtx.close().catch(() => {}); audioCtx = null; }
  analyserNode = null;
  isPlaying    = false;

  document.getElementById("yt-wrap").innerHTML = "";
  document.getElementById("yt-wrap").classList.add("hidden");
  document.getElementById("wave-wrap").classList.add("hidden");
  document.getElementById("progress-row").classList.add("hidden");
  document.getElementById("disc").classList.remove("spinning");
  setPlayIcon("▶");
}

/* ── Load + auto-try all 3 layers ─────── */
async function loadAndPlay(song, emotion, color) {
  stopAll();
  const token = playbackToken;
  setTrackInfo(song.title, `${song.artist}${song.year ? " · "+song.year : ""}`, "Loading...", color, null);
  document.getElementById("step4").classList.remove("hidden");
  document.getElementById("player").style.borderColor = color + "55";
  setTimeout(() => document.getElementById("step4").scrollIntoView({ behavior:"smooth", block:"nearest" }), 120);

  let ok = false;

  // Layer 1 — iTunes preview
  try   { ok = await tryItunes(song, color, emotion, token); }
  catch { /* blocked or unavailable */ }
  if (token !== playbackToken) return;

  // Layer 2 — YouTube iframe
  if (!ok) ok = tryYouTube(song, color);
  if (token !== playbackToken) return;

  // Layer 3 — Web Audio synth
  if (!ok) playSynth(song, emotion, color);
}

/* ── Layer 1: iTunes ─────────────────── */
async function tryItunes(song, color, emotion, token) {
  const q    = encodeURIComponent(song.itunes_term || `${song.artist} ${song.title}`);
  const res  = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=5`);
  const data = await res.json();
  if (token !== playbackToken) return false;

  const track = data.results?.find(t => t.previewUrl);
  if (!track?.previewUrl) return false;

  const art = track.artworkUrl100?.replace("100x100bb","300x300bb") || null;
  setTrackInfo(track.trackName, `${track.artistName} · ${track.collectionName}`,
    "🎵 iTunes preview · 30 sec · playing in-app", color, art);

  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.src = track.previewUrl;

  await audio.play(); // throws if browser blocks
  if (token !== playbackToken) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    return false;
  }

  currentAudio = audio;
  isPlaying    = true;
  setPlayIcon("⏸");
  document.getElementById("disc").classList.add("spinning");
  document.getElementById("progress-row").classList.remove("hidden");

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("ended", () => {
    isPlaying = false; setPlayIcon("▶");
    document.getElementById("disc").classList.remove("spinning");
    nextTrack();
  });
  return true;
}

/* ── Layer 2: YouTube iframe ─────────── */
function tryYouTube(song, color) {
  if (!song.youtube_id || song.youtube_id.length !== 11) return false;
  setTrackInfo(song.title, `${song.artist}${song.year ? " · "+song.year : ""}`,
    "▶ YouTube · embedded in-app · no redirect", color, null);
  const yw = document.getElementById("yt-wrap");
  yw.classList.remove("hidden");
  yw.innerHTML = `<iframe
    src="https://www.youtube.com/embed/${song.youtube_id}?autoplay=1&rel=0&modestbranding=1"
    height="200"
    allow="autoplay; encrypted-media; picture-in-picture"
    allowfullscreen
    style="border:0;display:block;width:100%">
  </iframe>`;
  isPlaying = true; setPlayIcon("⏸");
  return true;
}

/* ── Layer 3: Web Audio synth ─────────── */
function playSynth(song, emotion, color) {
  const cfg = SYNTH_CFG[emotion] || SYNTH_CFG.neutral;
  setTrackInfo(song.title, song.artist, "✦ AI mood music · generated in-app", color, null);

  const wc  = document.getElementById("wave-canvas");
  wc.width  = wc.offsetWidth; wc.height = 44;
  document.getElementById("wave-wrap").classList.remove("hidden");

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx  = ctx;
  const an  = ctx.createAnalyser(); an.fftSize = 64; analyserNode = an;

  // Reverb
  const conv = ctx.createConvolver();
  const bl   = Math.floor(ctx.sampleRate * 1.2);
  const rb   = ctx.createBuffer(2, bl, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = rb.getChannelData(ch);
    for (let i = 0; i < bl; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/bl, 5);
  }
  conv.buffer = rb;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);
  master.connect(an);
  const rev = ctx.createGain(); rev.gain.value = 0.18;
  conv.connect(rev); rev.connect(an); an.connect(ctx.destination);

  noteIdx = 0;
  function playNote() {
    if (!audioCtx) return;
    const semi = cfg.notes[noteIdx % cfg.notes.length];
    const freq = cfg.root * Math.pow(2, semi / 12);
    const osc  = ctx.createOscillator();
    const env  = ctx.createGain();
    osc.type = cfg.wave; osc.frequency.value = freq;
    osc.connect(env); env.connect(master);
    const dry = ctx.createGain(); dry.gain.value = 0.3;
    osc.connect(dry); dry.connect(conv);
    const t = ctx.currentTime, dur = (cfg.tempo/1000)*0.7;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t+0.025);
    env.gain.exponentialRampToValueAtTime(0.001, t+dur);
    osc.start(t); osc.stop(t+dur+0.1); noteIdx++;
  }
  playNote();
  synthTimer = setInterval(playNote, cfg.tempo);
  isPlaying  = true; setPlayIcon("⏸");

  // Waveform visualizer
  const wctx = wc.getContext("2d");
  function draw() {
    if (!analyserNode) return;
    const W = wc.width, H = wc.height;
    wctx.clearRect(0, 0, W, H);
    const buf = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(buf);
    const n  = Math.min(buf.length, 32);
    const bw = Math.max(2, (W - n*2) / n);
    buf.slice(0, n).forEach((v, i) => {
      const h = Math.max(3, (v/255)*H);
      wctx.fillStyle = color;
      wctx.globalAlpha = 0.4 + (v/255)*0.6;
      wctx.fillRect(i*(bw+2), H-h, bw, h);
    });
    wctx.globalAlpha = 1;
    waveFrame = requestAnimationFrame(draw);
  }
  draw();
}

/* ── Toggle play/pause (iTunes only) ─── */
function togglePlay() {
  if (!currentAudio) return;
  if (isPlaying) {
    currentAudio.pause(); isPlaying = false; setPlayIcon("▶");
    document.getElementById("disc").classList.remove("spinning");
  } else {
    currentAudio.play(); isPlaying = true; setPlayIcon("⏸");
    document.getElementById("disc").classList.add("spinning");
  }
}

/* ── Seek (iTunes only) ──────────────── */
function seekAudio(e) {
  if (!currentAudio?.duration) return;
  const track = document.getElementById("prog-track");
  currentAudio.currentTime = (e.offsetX / track.offsetWidth) * currentAudio.duration;
}

/* ── Progress bar ────────────────────── */
function updateProgress() {
  if (!currentAudio?.duration) return;
  const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
  document.getElementById("prog-fill").style.width = pct + "%";
  document.getElementById("t-cur").textContent = fmtTime(currentAudio.currentTime);
  document.getElementById("t-dur").textContent = fmtTime(currentAudio.duration);
}

/* ── Helpers ─────────────────────────── */
function setTrackInfo(title, sub, mode, color, artUrl) {
  document.getElementById("track-title").textContent = title;
  document.getElementById("track-sub").textContent   = sub;
  document.getElementById("track-mode").innerHTML    = `<span style="color:${color}">${mode}</span>`;
  document.getElementById("prog-fill").style.background = color;
  document.getElementById("play-btn").style.borderColor = color + "80";
  const disc = document.getElementById("disc");
  disc.style.boxShadow = `0 0 0 2.5px ${color}`;
  if (artUrl) { disc.innerHTML = `<img src="${artUrl}" alt="">`; disc.style.background = ""; }
  else        { disc.innerHTML = "🎵"; }
}

function setPlayIcon(icon) { document.getElementById("play-btn").textContent = icon; }

function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  return Math.floor(s/60) + ":" + String(~~(s%60)).padStart(2,"0");
}
