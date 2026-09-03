<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ClipDesk — caption &amp; sound editor</title>
<link rel="stylesheet" href="css/style.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=TikTok+Sans:opsz,wght@12..36,300..900&display=swap" rel="stylesheet" />
</head>
<body>

<div class="app">

  <!-- Top bar -->
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark">◈</span>
      <span class="brand-name">ClipDesk</span>
    </div>
    <div class="project-name" id="projectName">untitled clip</div>
    <div class="topbar-actions">
      <label class="btn btn-ghost" for="videoInput">Open clip</label>
      <input type="file" id="videoInput" accept="video/*" hidden />
      <button class="btn btn-primary" id="exportBtn" disabled>Export video</button>
    </div>
  </header>

  <div class="workspace">

    <!-- Left: library -->
    <aside class="panel panel-library">
      <div class="panel-tabs">
        <button class="tab-btn active" data-tab="songs">Songs</button>
        <button class="tab-btn" data-tab="favorites">Favorites</button>
      </div>

      <div class="tab-panel" id="tab-songs">
        <p class="panel-hint">Weekly list, updated on your command. Attach your own audio file to any track to use it.</p>
        <div class="song-list" id="songList"></div>
      </div>

      <div class="tab-panel hidden" id="tab-favorites">
        <p class="panel-hint">Starred tracks. These stay put — updating the weekly list never removes them.</p>
        <div class="song-list" id="favoriteList"></div>
      </div>

      <div class="library-footer">
        <label class="btn btn-ghost btn-block" for="ownAudioInput">Add your own audio</label>
        <input type="file" id="ownAudioInput" accept="audio/*" hidden />
      </div>
    </aside>

    <!-- Center: stage -->
    <main class="panel panel-stage">
      <div class="stage-wrap">
        <div class="stage" id="stage">
          <canvas id="previewCanvas"></canvas>
          <video id="sourceVideo" playsinline hidden></video>
          <div class="empty-state" id="emptyState">
            <span class="empty-glyph">▷</span>
            <p>Open a clip to start editing</p>
          </div>
          <div class="overlay-layer" id="overlayLayer"></div>
        </div>
      </div>

      <div class="transport">
        <button class="icon-btn" id="playBtn" disabled>▶</button>
        <span class="time-code" id="timeCurrent">00:00.0</span>
        <input type="range" id="scrubber" min="0" max="1000" value="0" disabled />
        <span class="time-code" id="timeTotal">00:00.0</span>
      </div>

      <div class="track-row">
        <div class="track-label">Sound</div>
        <div class="track-strip" id="audioTrackStrip">
          <span class="track-empty">No track added — pick a song or add your own audio</span>
        </div>
      </div>

      <div class="track-row">
        <div class="track-label">Captions</div>
        <div class="track-strip" id="textTrackStrip"></div>
        <button class="btn btn-small" id="addTextBtn" disabled>+ Add text</button>
      </div>
    </main>

    <!-- Right: inspector -->
    <aside class="panel panel-inspector" id="inspector">
      <div class="inspector-empty" id="inspectorEmpty">
        <p>Select a caption on the stage to style it, or add a new one.</p>
      </div>

      <div class="inspector-body hidden" id="inspectorBody">
        <label class="field">
          <span>Text</span>
          <textarea id="fText" rows="2"></textarea>
        </label>

        <div class="field-row">
          <label class="field">
            <span>Font</span>
            <select id="fFont">
              <option value="'TikTok Sans', sans-serif">TikTok Sans</option>
              <option value="'Inter', sans-serif">Inter</option>
              <option value="'Poppins', sans-serif">Poppins</option>
              <option value="'IBM Plex Mono', monospace">Plex Mono</option>
              <option value="'Georgia', serif">Georgia</option>
              <option value="'Archivo Black', sans-serif">Archivo Black</option>
            </select>
          </label>
          <label class="field field-narrow">
            <span>Size</span>
            <input type="number" id="fSize" min="10" max="160" value="40" />
          </label>
        </div>

        <div class="field-row">
          <label class="field field-narrow">
            <span>Text color</span>
            <input type="color" id="fColor" value="#ffffff" />
          </label>
          <label class="field field-narrow checkbox-field">
            <input type="checkbox" id="fStrokeOn" />
            <span>Outline</span>
          </label>
          <label class="field field-narrow">
            <span>Outline color</span>
            <input type="color" id="fStrokeColor" value="#000000" />
          </label>
        </div>

        <div class="field-row">
          <label class="field field-narrow checkbox-field">
            <input type="checkbox" id="fBgOn" />
            <span>Show bg</span>
          </label>
          <label class="field field-narrow">
            <span>Background</span>
            <input type="color" id="fBg" value="#000000" />
          </label>
          <label class="field">
            <span>Bg shape</span>
            <select id="fBgMode">
              <option value="line">Per-line pill</option>
              <option value="block">Single box</option>
            </select>
          </label>
        </div>
        <p class="field-note" id="lineBgNote">Per-line pill background only renders while playing/scrubbing and in the export — not while dragging.</p>

        <label class="field">
          <span>Background opacity</span>
          <input type="range" id="fBgOpacity" min="0" max="100" value="70" />
        </label>

        <label class="field">
          <span>Corner rounding</span>
          <input type="range" id="fRadius" min="0" max="40" value="8" />
        </label>

        <div class="field-row">
          <label class="field field-narrow checkbox-field">
            <input type="checkbox" id="fBold" />
            <span>Bold</span>
          </label>
          <label class="field field-narrow checkbox-field">
            <input type="checkbox" id="fItalic" />
            <span>Italic</span>
          </label>
          <label class="field">
            <span>Align</span>
            <select id="fAlign">
              <option value="center">Center</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>

        <div class="quick-styles">
          <span class="field-label">Quick styles</span>
          <div class="style-chip-row">
            <button class="style-chip" data-style="classic">Classic outline</button>
            <button class="style-chip" data-style="sticker">Sticker (white)</button>
            <button class="style-chip" data-style="pill">Color pill</button>
            <button class="style-chip" data-style="minimal">Minimal</button>
          </div>
        </div>

        <div class="field-row">
          <label class="field field-narrow">
            <span>Appears at</span>
            <input type="number" id="fStart" min="0" step="0.1" />
          </label>
          <label class="field field-narrow">
            <span>Disappears at</span>
            <input type="number" id="fEnd" min="0" step="0.1" />
          </label>
        </div>

        <button class="btn btn-danger btn-block" id="deleteTextBtn">Delete this caption</button>
      </div>
    </aside>

  </div>
</div>

<div class="toast" id="toast"></div>
<div class="export-overlay hidden" id="exportOverlay">
  <div class="export-card">
    <div class="export-spinner"></div>
    <p id="exportStatus">Rendering…</p>
  </div>
</div>

<script type="module" src="js/app.js"></script>
</body>
</html>

# ClipDesk

A private, no-feed clip editor for adding TikTok-style captions and music to your own videos — built so you don't need TikTok installed just to edit.

Everything runs client-side in the browser. Nothing is uploaded anywhere.

## What it does

- **Open a clip** (any video file) and preview it on a 9:16 stage.
- **Add captions**: drag to position, resize the box, and style each one independently — font, size, color, background color/opacity, corner rounding, bold/italic, alignment, and a few quick-style presets (classic caption, bold block, minimal, highlight bar). Each caption has its own appear/disappear time.
- **Add sound**: attach your own audio file, or pick a track from the Songs library and attach audio to it yourself (see note on trending songs below). Volume is adjustable.
- **Favorites**: star any song and it's saved to your browser's local database (IndexedDB), including any audio you attached to it. Favorites are never touched by a weekly list refresh.
- **Export**: renders captions + music into an actual downloadable `.webm` video, baked in — the same way CapCut/TikTok "burn in" captions.

## Running it

No build step. Options:
- Open `index.html` directly in a browser, or
- Push the folder to GitHub and deploy on Netlify (drag-and-drop the folder onto Netlify, or connect the repo) — it's a static site.

## About the trending songs list

`data/trending-songs.json` holds **metadata only** (title / artist / vibe tag) — I'm not able to fetch or bundle actual copyrighted audio files, and I won't act on a schedule automatically. The workflow is:

1. About once a week, tell me (Claude) something like: **"update the trending songs list."**
2. I'll search for what's currently trending and rewrite the `songs` array in `data/trending-songs.json` with fresh metadata.
3. Your **Favorites** tab is untouched — it lives in IndexedDB, a separate store this file never writes to.
4. For any song (favorited or not), click **Attach** to link an audio file you own to that entry. If you then star it, the file is saved permanently in your browser; if you don't star it, the attachment only lasts for that session.

## File map

```
clipdesk/
├── index.html
├── css/style.css
├── js/
│   ├── app.js         — playback, transport, inspector wiring, export trigger
│   ├── textEditor.js  — caption layers: drag/resize, styling, canvas drawing
│   ├── songs.js        — trending list rendering + IndexedDB favorites
│   └── exporter.js     — canvas capture + Web Audio mixing + MediaRecorder
└── data/trending-songs.json  — weekly-refreshed song metadata (see above)
```

## Notes / limitations

- Export format is `.webm` (via `MediaRecorder`) since that's what browsers can encode natively without extra libraries. Most players (VLC, phones, uploaders) handle it fine; if you specifically need `.mp4`, that'd mean adding an ffmpeg.wasm conversion step, which I can add later if it matters to you.
- Only one music track at a time, to keep this close to how you'd actually use it (one caption pass + one sound), per your "keep it basic" steer. Say the word if you want a second track later.
- Everything (favorites, attached audio) lives in that browser's IndexedDB — it won't follow you to a different browser or device unless you export/re-attach there too.
