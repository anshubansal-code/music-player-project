# Emotion Music Player

Detects your facial emotion via webcam → asks for a singer → plays music directly in the browser (no redirects, no external apps). No API key required.

---

## Project Files

```
Emotion_Based_Music_Player/
├── index.html   - Main page (UI structure)
├── style.css    - All styles (dark theme)
├── config.js    - App configuration
├── emotion.js   - Webcam + face-api.js emotion detection
├── music.js     - iTunes + YouTube + AI synth player
├── app.js       - Main controller
└── README.md    - This file
```

---

## How to Run

### Option 1 — VS Code Live Server (recommended)
1. Install [VS Code](https://code.visualstudio.com)
2. Install the **Live Server** extension (by Ritwick Dey)
3. Open the project folder in VS Code
4. Right-click `index.html` → **Open with Live Server**
5. Browser opens at `http://localhost:5500`

### Option 2 — Python
```bash
python -m http.server 5500
```
Then open `http://localhost:5500` in your browser.

### Option 3 — Node.js
```bash
npx serve .
```

> Do NOT open index.html directly as a file:// URL — camera requires a local server.

---

## How to Use

1. **Allow camera** when browser asks
2. Wait for button to say **"Detect My Emotion"** (model loads in ~5s)
3. Click **"Detect My Emotion"** — make an expression!
4. Type a singer name (e.g. `Arijit Singh`, `Adele`, `BTS`, `Drake`)
5. Click **Find Songs** → pick a song → music plays instantly

---

## Music Layers (tried in order)

| # | Layer | What it does |
|---|-------|-------------|
| 1 | **iTunes Preview** | Real 30-sec MP3 from Apple. Free, no key needed. |
| 2 | **YouTube Embed** | Embeds YouTube player inside the page. |
| 3 | **AI Synth** | Web Audio API generates mood-matched music in the browser. |

---

## Supported Emotions

`happy` · `sad` · `angry` · `surprised` · `fearful` · `disgusted` · `neutral`

---

## Technologies

- HTML / CSS / JavaScript (frontend only)
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) — in-browser face & emotion detection
- iTunes Search API — free song search (no key needed)
