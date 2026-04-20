// ============================================================
//  app.js  — Main controller (wires everything together)
// ============================================================

let currentEmotion = null;
let songs          = [];
let currentIdx     = -1;

/* ── Boot ─────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  initCamera();
  window.addEventListener("resize", () => {
    const wc = document.getElementById("wave-canvas");
    if (wc) { wc.width = wc.offsetWidth; wc.height = 44; }
  });
});

function resetSongSearch() {
  stopAll();
  songs = [];
  currentIdx = -1;
  document.getElementById("artist-input").value = "";
  document.getElementById("song-list").innerHTML = "";
  document.getElementById("step3").classList.add("hidden");
  document.getElementById("step4").classList.add("hidden");
}

/* ── STEP 1 : Detect emotion ─────────────── */
async function detectEmotion() {
  if (!camReady) { showErr("Camera not ready — allow access and refresh."); return; }
  clearErr();
  resetSongSearch();

  const btn = document.getElementById("detect-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-icon">⟳</span> Reading your face...';

  // scan line animation
  const sl  = document.getElementById("scan-line");
  const camH = document.getElementById("cam-box").offsetHeight;
  let sp = 0;
  sl.style.opacity = "1";
  const scanTimer = setInterval(() => { sp = (sp+4) % camH; sl.style.top = sp+"px"; }, 14);

  try {
    const frame = captureFrame();
    if (!frame) throw new Error("Could not capture camera frame.");

    const result = await callClaudeEmotion(frame);
    const key    = EMOTIONS[result.emotion] ? result.emotion : "neutral";
    const emo    = EMOTIONS[key];
    const conf   = Math.round((result.confidence || 0.7) * 100);
    currentEmotion = key;

    // Populate emotion card
    document.getElementById("emo-empty").classList.add("hidden");
    document.getElementById("emo-result").classList.remove("hidden");
    document.getElementById("emo-name").textContent  = emo.label;
    document.getElementById("emo-name").style.color  = emo.color;
    document.getElementById("conf-pct").textContent  = conf + "%";
    document.getElementById("conf-pct").style.color  = emo.color;
    document.getElementById("conf-fill").style.width      = conf + "%";
    document.getElementById("conf-fill").style.background = emo.color;
    document.getElementById("emo-msg").textContent   = emo.msg;

    // Glow on camera + emotion card
    document.getElementById("cam-glow").style.boxShadow =
      `inset 0 0 0 2px ${emo.color}60`;
    document.getElementById("emotion-card").style.borderColor = emo.color + "55";

    // Show step 2 and focus artist input
    document.getElementById("step2").classList.remove("hidden");
    setTimeout(() => document.getElementById("artist-input").focus(), 150);

  } catch(e) {
    showErr("Detection failed: " + (e.message || "unknown error"));
  }

  clearInterval(scanTimer);
  sl.style.opacity = "0";
  btn.disabled = false;
  btn.innerHTML = "🎯 Re-detect";
}

/* ── STEP 2 : Find songs ─────────────────── */
async function findSongs() {
  const artist = document.getElementById("artist-input").value.trim();
  if (!artist)         { showErr("Please enter an artist name."); return; }
  if (!currentEmotion) { showErr("Detect your emotion first."); return; }
  clearErr();
  stopAll();

  const btn = document.getElementById("find-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-icon">⟳</span>';

  document.getElementById("step3").classList.remove("hidden");
  document.getElementById("song-list").innerHTML =
    '<div style="font-size:13px;color:var(--text2);padding:6px 2px">Finding perfect songs...</div>';
  document.getElementById("step4").classList.add("hidden");

  try {
    const data = await callClaudeSongs(currentEmotion, artist);
    songs = data.songs || [];
    renderSongs();
    if (songs.length > 0) playSong(0);
  } catch(e) {
    showErr("Song search failed: " + (e.message || "unknown error"));
    document.getElementById("song-list").innerHTML = "";
  }

  btn.disabled = false;
  btn.innerHTML = "Find Songs →";
}

/* ── Render song cards ───────────────────── */
function renderSongs() {
  const emo  = EMOTIONS[currentEmotion];
  const list = document.getElementById("song-list");
  list.innerHTML = "";

  if (!songs.length) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text2)">No songs found. Try a different artist name.</p>';
    return;
  }

  songs.forEach((song, i) => {
    const el = document.createElement("div");
    el.className = "song-item";
    el.id = "song-" + i;
    el.style.setProperty("--accent", emo.color);
    el.onclick = () => playSong(i);
    el.innerHTML = `
      <div class="song-num" id="snum-${i}">${i+1}</div>
      <div class="song-info">
        <div class="song-title">${song.title}</div>
        <div class="song-meta">${song.artist}${song.year ? " · "+song.year : ""}</div>
        <div class="song-mood">${song.mood_note}</div>
      </div>
      <div class="song-arrow">▷</div>`;
    list.appendChild(el);
  });
}

/* ── Play a song by index ────────────────── */
function playSong(idx) {
  if (idx < 0 || idx >= songs.length) return;
  currentIdx = idx;
  highlightSong(idx);
  const emo = EMOTIONS[currentEmotion];
  loadAndPlay(songs[idx], currentEmotion, emo.color);
}

/* ── Highlight active song row ───────────── */
function highlightSong(idx) {
  const emo = EMOTIONS[currentEmotion];
  songs.forEach((_, i) => {
    const el  = document.getElementById("song-" + i);
    const num = document.getElementById("snum-" + i);
    if (!el) return;
    el.classList.toggle("active", i === idx);
    if (num) {
      num.style.background = i === idx ? emo.color : "";
      num.style.color      = i === idx ? "#fff"    : "";
    }
  });
}

/* ── Prev / Next ─────────────────────────── */
function prevTrack() { if (currentIdx > 0) playSong(currentIdx - 1); }
function nextTrack() { if (currentIdx < songs.length - 1) playSong(currentIdx + 1); }

/* ── Error helpers ───────────────────────── */
function showErr(msg) {
  const el = document.getElementById("app-err");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearErr() {
  document.getElementById("app-err").classList.add("hidden");
}

/* ── Cleanup ─────────────────────────────── */
window.addEventListener("beforeunload", () => {
  stopAll();
  if (camStream) camStream.getTracks().forEach(t => t.stop());
});
