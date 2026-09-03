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
