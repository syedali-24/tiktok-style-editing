import { TextEditor, QUICK_STYLES } from "./textEditor.js";
import { SongLibrary } from "./songs.js";
import { exportVideo, downloadBlob } from "./exporter.js";

const $ = (id) => document.getElementById(id);

if (document.fonts) {
  document.fonts.load("400 40px 'TikTok Sans'");
  document.fonts.load("800 40px 'TikTok Sans'");
}

const video = $("sourceVideo");
const canvas = $("previewCanvas");
const ctx = canvas.getContext("2d");
const stage = $("stage");
const overlayLayer = $("overlayLayer");
const emptyState = $("emptyState");

let textEditor = null;
let audioTrack = null; // { name, blob, volume, offset, source: 'song'|'own' }
let includeOriginalAudio = true;
let rafId = null;
let hasClip = false;

// ---------------- Toast ----------------
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

// ---------------- Video loading ----------------
$("videoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadClip(file);
});

function loadClip(file) {
  const url = URL.createObjectURL(file);
  video.src = url;
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    textEditor = new TextEditor({
      stageEl: stage,
      overlayEl: overlayLayer,
      videoW: video.videoWidth,
      videoH: video.videoHeight,
      onSelect: renderInspector,
      onChange: renderTextTrack,
    });
    hasClip = true;
    emptyState.classList.add("hidden");
    $("projectName").textContent = file.name.replace(/\.[^.]+$/, "");
    $("playBtn").disabled = false;
    $("scrubber").disabled = false;
    $("addTextBtn").disabled = false;
    $("exportBtn").disabled = false;
    $("timeTotal").textContent = formatTime(video.duration);
    drawFrame();
    toast("Clip loaded — add captions and music, then export");
  };
}

// ---------------- Playback / preview loop ----------------
$("playBtn").addEventListener("click", () => {
  if (video.paused) {
    video.play();
    $("playBtn").textContent = "❚❚";
    loop();
  } else {
    video.pause();
    $("playBtn").textContent = "▶";
    cancelAnimationFrame(rafId);
  }
});

video.addEventListener("ended", () => {
  $("playBtn").textContent = "▶";
  cancelAnimationFrame(rafId);
});

$("scrubber").addEventListener("input", (e) => {
  if (!hasClip) return;
  const pct = e.target.value / 1000;
  video.currentTime = pct * video.duration;
  drawFrame();
});

function loop() {
  drawFrame();
  if (!video.paused && !video.ended) {
    rafId = requestAnimationFrame(loop);
  }
}

function drawFrame() {
  if (!hasClip) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (textEditor) textEditor.drawAt(ctx, canvas.width, canvas.height, video.currentTime);
  $("timeCurrent").textContent = formatTime(video.currentTime);
  $("scrubber").value = Math.floor((video.currentTime / video.duration) * 1000) || 0;
}

window.addEventListener("resize", () => {
  if (textEditor) textEditor.renderDom();
});

// ---------------- Text layers ----------------
$("addTextBtn").addEventListener("click", () => {
  if (!textEditor) return;
  textEditor.addLayer(video.duration);
  renderTextTrack();
});

function renderTextTrack() {
  const strip = $("textTrackStrip");
  strip.innerHTML = "";
  if (!textEditor || textEditor.layers.length === 0) {
    strip.innerHTML = `<span class="track-empty">No captions yet</span>`;
    return;
  }
  textEditor.layers.forEach((layer) => {
    const chip = document.createElement("div");
    chip.className = "caption-chip" + (layer.id === textEditor.selectedId ? " active" : "");
    chip.innerHTML = `<span class="chip-label"></span><span class="chip-remove">✕</span>`;
    chip.querySelector(".chip-label").textContent = truncate(layer.text, 16);
    chip.addEventListener("click", () => textEditor.select(layer.id));
    chip.querySelector(".chip-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      textEditor.removeLayer(layer.id);
    });
    strip.appendChild(chip);
  });
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ---------------- Inspector ----------------
const inspectorEmpty = $("inspectorEmpty");
const inspectorBody = $("inspectorBody");
function renderInspector(layer) {
  renderTextTrack();
  if (!layer) {
    inspectorEmpty.classList.remove("hidden");
    inspectorBody.classList.add("hidden");
    return;
  }
  inspectorEmpty.classList.add("hidden");
  inspectorBody.classList.remove("hidden");

  $("fText").value = layer.text;
  $("fFont").value = layer.fontFamily;
  $("fSize").value = layer.fontSize;
  $("fColor").value = layer.color;
  $("fStrokeOn").checked = layer.strokeOn;
  $("fStrokeColor").value = layer.strokeColor;
  $("fBg").value = layer.bgColor;
  $("fBgOn").checked = layer.bgOn;
  $("fBgMode").value = layer.bgMode;
  $("fBgOpacity").value = layer.bgOpacity;
  $("fRadius").value = layer.radius;
  $("fBold").checked = layer.bold;
  $("fItalic").checked = layer.italic;
  $("fAlign").value = layer.align;
  $("fStart").value = layer.start;
  $("fEnd").value = layer.end;
}

function bindInspectorField(id, prop, parse = (v) => v) {
  $(id).addEventListener("input", () => {
    if (!textEditor || !textEditor.selectedId) return;
    const el = $(id);
    const value = el.type === "checkbox" ? el.checked : parse(el.value);
    textEditor.updateLayer(textEditor.selectedId, { [prop]: value });
  });
}

bindInspectorField("fText", "text");
bindInspectorField("fFont", "fontFamily");
bindInspectorField("fSize", "fontSize", Number);
bindInspectorField("fColor", "color");
bindInspectorField("fStrokeOn", "strokeOn");
bindInspectorField("fStrokeColor", "strokeColor");
bindInspectorField("fBg", "bgColor");
bindInspectorField("fBgOn", "bgOn");
bindInspectorField("fBgMode", "bgMode");
bindInspectorField("fBgOpacity", "bgOpacity", Number);
bindInspectorField("fRadius", "radius", Number);
bindInspectorField("fBold", "bold");
bindInspectorField("fItalic", "italic");
bindInspectorField("fAlign", "align");
bindInspectorField("fStart", "start", Number);
bindInspectorField("fEnd", "end", Number);

document.querySelectorAll(".style-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (!textEditor || !textEditor.selectedId) return;
    textEditor.applyQuickStyle(textEditor.selectedId, chip.dataset.style);
  });
});

$("deleteTextBtn").addEventListener("click", () => {
  if (!textEditor || !textEditor.selectedId) return;
  textEditor.removeLayer(textEditor.selectedId);
});

document.addEventListener("click", (e) => {
  if (textEditor && !e.target.closest(".text-box") && !e.target.closest(".panel-inspector")) {
    textEditor.select(null);
  }
});

// ---------------- Audio track ----------------
function setAudioTrack(name, blob, source) {
  audioTrack = { name, blob, volume: 1, offset: 0, source };
  renderAudioTrack();
  toast(`"${name}" added to the sound track`);
}

$("ownAudioInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) setAudioTrack(file.name, file, "own");
});

function renderAudioTrack() {
  const strip = $("audioTrackStrip");
  strip.innerHTML = "";
  if (!audioTrack) {
    strip.innerHTML = `<span class="track-empty">No track added — pick a song or add your own audio</span>`;
    return;
  }
  const chip = document.createElement("div");
  chip.className = "audio-chip";
  chip.innerHTML = `
    <span class="chip-label"></span>
    <span class="field-narrow-inline">vol <input type="range" min="0" max="100" value="${audioTrack.volume * 100}"></span>
    <span class="chip-remove">✕</span>
  `;
  chip.querySelector(".chip-label").textContent = truncate(audioTrack.name, 22);
  chip.querySelector("input[type=range]").addEventListener("input", (e) => {
    audioTrack.volume = e.target.value / 100;
  });
  chip.querySelector(".chip-remove").addEventListener("click", () => {
    audioTrack = null;
    renderAudioTrack();
  });
  strip.appendChild(chip);
}

// ---------------- Songs library ----------------
const library = new SongLibrary({
  onUseSong: (song, blob) => setAudioTrack(`${song.title} — ${song.artist}`, blob, "song"),
  onToast: toast,
});
library.init();

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    $(`tab-${btn.dataset.tab}`).classList.remove("hidden");
  });
});

// ---------------- Export ----------------
$("exportBtn").addEventListener("click", async () => {
  if (!hasClip) return;
  video.pause();
  $("playBtn").textContent = "▶";
  cancelAnimationFrame(rafId);

  const overlay = $("exportOverlay");
  const status = $("exportStatus");
  overlay.classList.remove("hidden");
  status.textContent = "Rendering… 0%";

  try {
    const blob = await exportVideo({
      video,
      textEditor,
      audioTrack,
      includeOriginalAudio,
      onProgress: (p) => { status.textContent = `Rendering… ${Math.round(p * 100)}%`; },
    });
    const name = ($("projectName").textContent || "clip").replace(/\s+/g, "_") + ".webm";
    downloadBlob(blob, name);
    toast("Export finished — check your downloads");
  } catch (err) {
    console.error(err);
    toast("Export failed — see console for details");
  } finally {
    overlay.classList.add("hidden");
  }
});

// ---------------- Utils ----------------
function formatTime(t) {
  if (!isFinite(t)) return "00:00.0";
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// exporter.js — re-plays the clip through an offscreen canvas (drawing the
// video frame + active captions every tick) and records canvas + mixed audio
// with MediaRecorder. This is what "bakes in" the captions and music.

export async function exportVideo({ video, textEditor, audioTrack, includeOriginalAudio, onProgress }) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();

  const cleanups = [];

  if (includeOriginalAudio) {
    const srcNode = audioCtx.createMediaElementSource(video);
    srcNode.connect(dest);
    // Route to nowhere audible so it doesn't also play through speakers twice —
    // captureStream + this node together are enough for the recording.
  }

  let audioEl = null;
  if (audioTrack && audioTrack.blob) {
    audioEl = new Audio(URL.createObjectURL(audioTrack.blob));
    audioEl.crossOrigin = "anonymous";
    const gain = audioCtx.createGain();
    gain.gain.value = audioTrack.volume ?? 1;
    const node = audioCtx.createMediaElementSource(audioEl);
    node.connect(gain);
    gain.connect(dest);
    cleanups.push(() => URL.revokeObjectURL(audioEl.src));
  }

  const canvasStream = canvas.captureStream(30);
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  video.muted = true;
  video.currentTime = 0;

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      cleanups.forEach((fn) => fn());
      audioCtx.close();
      resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
    };
    recorder.onerror = (e) => reject(e.error);

    let rafId;
    const drawLoop = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      textEditor.drawAt(ctx, canvas.width, canvas.height, video.currentTime);
      onProgress && onProgress(video.currentTime / video.duration);
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(drawLoop);
      }
    };

    video.onended = () => {
      cancelAnimationFrame(rafId);
      if (audioEl) audioEl.pause();
      recorder.stop();
    };

    video.play().then(() => {
      if (audioEl) {
        audioEl.currentTime = audioTrack.offset || 0;
        audioEl.play().catch(() => {});
      }
      recorder.start();
      drawLoop();
    }).catch(reject);
  });
}

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// songs.js — trending list rendering, favorites persistence, audio attachment.
//
// Favorites live in IndexedDB (store: "favorites"), completely separate from
// data/trending-songs.json. That file is the only thing meant to be replaced
// on a weekly "update songs" command — favorites are never touched by it.

const DB_NAME = "clipdesk";
const DB_VERSION = 1;
const STORE = "favorites";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeMode) {
  const db = await openDB();
  return db.transaction(STORE, storeMode).objectStore(STORE);
}

export async function getFavorites() {
  const store = await tx("readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFavorite(song) {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(song);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function removeFavorite(id) {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// In-memory attachment cache for non-favorited songs (session only —
// favoriting a song is what makes an attached file stick around).
const sessionAudio = new Map();

export async function loadTrendingList() {
  try {
    const res = await fetch("data/trending-songs.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no trending file");
    const json = await res.json();
    return json.songs || [];
  } catch {
    return [];
  }
}

export class SongLibrary {
  constructor({ onUseSong, onToast }) {
    this.onUseSong = onUseSong;
    this.onToast = onToast || (() => {});
    this.trending = [];
    this.favorites = [];
  }

  async init() {
    this.trending = await loadTrendingList();
    this.favorites = await getFavorites();
    this.render();
  }

  isFavorite(id) {
    return this.favorites.some((f) => f.id === id);
  }

  getAudioFor(song) {
    if (song.audioBlob) return song.audioBlob;
    return sessionAudio.get(song.id) || null;
  }

  async attachAudio(song, file) {
    if (this.isFavorite(song.id)) {
      const fav = this.favorites.find((f) => f.id === song.id);
      fav.audioBlob = file;
      await saveFavorite(fav);
    } else {
      sessionAudio.set(song.id, file);
    }
    this.onToast(`Audio attached to "${song.title}"`);
    this.render();
  }

  async toggleFavorite(song) {
    if (this.isFavorite(song.id)) {
      await removeFavorite(song.id);
      this.favorites = this.favorites.filter((f) => f.id !== song.id);
      this.onToast(`Removed "${song.title}" from favorites`);
    } else {
      const audioBlob = this.getAudioFor(song) || null;
      const favSong = { ...song, audioBlob };
      await saveFavorite(favSong);
      this.favorites.push(favSong);
      this.onToast(`Saved "${song.title}" to favorites — won't be touched by weekly updates`);
    }
    this.render();
  }

  render() {
    this.renderList("songList", this.mergedTrending(), false);
    this.renderList("favoriteList", this.favorites, true);
  }

  // Trending list merged with favorite-attached audio, so a favorited
  // trending song shows its attached audio even after a weekly refresh.
  mergedTrending() {
    return this.trending.map((s) => {
      const fav = this.favorites.find((f) => f.id === s.id);
      return fav ? { ...s, audioBlob: fav.audioBlob } : s;
    });
  }

  renderList(containerId, list, isFavoritesTab) {
    const el = document.getElementById(containerId);
    el.innerHTML = "";

    if (list.length === 0) {
      const msg = isFavoritesTab
        ? "No favorites yet — star a track to keep it here for good."
        : "No songs loaded yet. Ask Claude to fetch this week's trending list.";
      el.innerHTML = `<div class="empty-note">${msg}</div>`;
      return;
    }

    list.forEach((song) => {
      const card = document.createElement("div");
      card.className = "song-card";
      const fav = this.isFavorite(song.id);
      const hasAudio = !!this.getAudioFor(song);

      card.innerHTML = `
        <div class="song-card-top">
          <div>
            <div class="song-title"></div>
            <div class="song-artist"></div>
            ${song.tag ? `<span class="song-tag">${escapeHtml(song.tag)}</span>` : ""}
          </div>
          <button class="star-btn ${fav ? "active" : ""}" title="Favorite">${fav ? "★" : "☆"}</button>
        </div>
        <div class="song-card-actions">
          <button class="btn btn-small use-btn" ${hasAudio ? "" : "disabled"}>${hasAudio ? "Use in editor" : "No audio yet"}</button>
          <label class="btn btn-small attach-btn">Attach<input type="file" accept="audio/*" hidden></label>
        </div>
      `;
      card.querySelector(".song-title").textContent = song.title;
      card.querySelector(".song-artist").textContent = song.artist || "";

      card.querySelector(".star-btn").addEventListener("click", () => this.toggleFavorite(song));
      card.querySelector(".use-btn").addEventListener("click", () => {
        const blob = this.getAudioFor(song);
        if (blob) this.onUseSong(song, blob);
      });
      card.querySelector(".attach-btn input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.attachAudio(song, file);
      });

      el.appendChild(card);
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// textEditor.js — caption layers: create, drag/resize on the stage,
// style panel binding, and drawing the exact same look onto the export canvas.

// Presets tuned to look right immediately, no slider-fiddling needed.
// "classic" = TikTok's default typed caption: bold white text with a thick
//   black outline and no background box at all.
// "sticker" = the white "note" caption where each line gets its own tight
//   rounded box that hugs just that line's text, stacked so they read as
//   one jagged shape (this is a close approximation of TikTok's own
//   per-line box, not a pixel-identical shape union).
// "pill" = same per-line box idea, but a solid color with white text —
//   the red/highlight caption style.
const QUICK_STYLES = {
  classic: {
    color: "#ffffff", bgOn: false,
    strokeOn: true, strokeColor: "#000000", strokeWidth: 9,
    bold: true, italic: false, fontFamily: "'TikTok Sans', sans-serif",
  },
  sticker: {
    color: "#14120f", bgOn: true, bgMode: "line",
    bgColor: "#ffffff", bgOpacity: 100, radius: 10,
    strokeOn: false, bold: true, italic: false, fontFamily: "'TikTok Sans', sans-serif",
  },
  pill: {
    color: "#ffffff", bgOn: true, bgMode: "line",
    bgColor: "#e8543a", bgOpacity: 100, radius: 8,
    strokeOn: false, bold: true, italic: false, fontFamily: "'TikTok Sans', sans-serif",
  },
  minimal: {
    color: "#ffffff", bgOn: false,
    strokeOn: false, bold: false, italic: false, fontFamily: "'Inter', sans-serif",
  },
};

let idCounter = 1;

export function createDefaultLayer(duration) {
  return {
    id: "t" + idCounter++,
    text: "New caption",
    xPct: 0.5, yPct: 0.8, wPct: 0.7,
    fontFamily: "'TikTok Sans', sans-serif",
    fontSize: 40,
    color: "#ffffff",
    bgOn: false,
    bgMode: "line", // "line" = per-line pill (TikTok-style), "block" = one box around everything
    bgColor: "#000000",
    bgOpacity: 70,
    radius: 8,
    strokeOn: true,
    strokeColor: "#000000",
    strokeWidth: 9,
    bold: true,
    italic: false,
    align: "center",
    start: 0,
    end: Math.min(duration || 5, duration || 5),
  };
}

export class TextEditor {
  constructor({ stageEl, overlayEl, videoW, videoH, onSelect, onChange }) {
    this.stageEl = stageEl;
    this.overlayEl = overlayEl;
    this.videoW = videoW;
    this.videoH = videoH;
    this.layers = [];
    this.selectedId = null;
    this.onSelect = onSelect;
    this.onChange = onChange;
  }

  setVideoSize(w, h) {
    this.videoW = w;
    this.videoH = h;
  }

  addLayer(duration) {
    const layer = createDefaultLayer(duration);
    this.layers.push(layer);
    this.select(layer.id);
    this.renderDom();
    this.onChange();
    return layer;
  }

  removeLayer(id) {
    this.layers = this.layers.filter((l) => l.id !== id);
    if (this.selectedId === id) this.select(null);
    this.renderDom();
    this.onChange();
  }

  getLayer(id) {
    return this.layers.find((l) => l.id === id);
  }

  select(id) {
    this.selectedId = id;
    this.renderDom();
    this.onSelect(id ? this.getLayer(id) : null);
  }

  applyQuickStyle(id, styleName) {
    const layer = this.getLayer(id);
    const style = QUICK_STYLES[styleName];
    if (!layer || !style) return;
    Object.assign(layer, style);
    this.renderDom();
    this.onChange();
    this.onSelect(layer);
  }

  updateLayer(id, patch) {
    const layer = this.getLayer(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this.renderDom();
    this.onChange();
  }

  // Visibility gate used both by the live preview and the exporter.
  activeLayersAt(time) {
    return this.layers.filter((l) => time >= l.start && time <= l.end);
  }

  // ---------- DOM preview ----------

  renderDom() {
    this.overlayEl.innerHTML = "";
    this.layers.forEach((layer) => {
      const box = document.createElement("div");
      box.className = "text-box" + (layer.id === this.selectedId ? " selected" : "");
      box.style.left = layer.xPct * 100 + "%";
      box.style.top = layer.yPct * 100 + "%";
      box.style.width = layer.wPct * 100 + "%";
      box.style.transform = "translate(-50%, -50%)";
      box.style.textAlign = layer.align;

      const inner = document.createElement("span");
      this.styleInnerText(inner, layer);
      inner.textContent = layer.text;
      box.appendChild(inner);

      const handle = document.createElement("div");
      handle.className = "resize-handle";
      box.appendChild(handle);

      box.addEventListener("pointerdown", (e) => this.startDrag(e, layer, box));
      handle.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.startResize(e, layer);
      });
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        this.select(layer.id);
      });

      this.overlayEl.appendChild(box);
    });
  }

  // Styles the inner <span> that actually carries text and outline.
  // Note: the per-line pill background ("bgMode: line") is intentionally
  // NOT drawn here. CSS's box-decoration-break rounds every wrapped line
  // independently, which is exactly the pinched-corner bug from stacking
  // separately-rounded boxes — there's no CSS-only fix for that. The
  // canvas renderer below builds one true merged, correctly-rounded
  // outline instead, so the accurate shape shows during playback/scrub
  // and in the exported video. While dragging, you'll see plain text.
  styleInnerText(el, layer) {
    const scale = this.stageEl.clientWidth / (this.videoW || this.stageEl.clientWidth || 1);
    const fontSize = layer.fontSize * scale;
    el.style.display = "inline";
    el.style.whiteSpace = "pre-wrap";
    el.style.fontFamily = layer.fontFamily;
    el.style.fontSize = fontSize + "px";
    el.style.fontWeight = layer.bold ? "800" : "400";
    el.style.fontStyle = layer.italic ? "italic" : "normal";
    el.style.lineHeight = "1.45";
    el.style.color = layer.color;
    el.style.boxDecorationBreak = "clone";
    el.style.webkitBoxDecorationBreak = "clone";

    if (layer.bgOn && layer.bgMode !== "line") {
      el.style.background = hexToRgba(layer.bgColor, layer.bgOpacity / 100);
      el.style.borderRadius = layer.radius + "px";
      el.style.padding = `${fontSize * 0.25}px ${fontSize * 0.4}px`;
      el.style.boxShadow = "none";
    } else {
      el.style.background = "transparent";
      el.style.padding = "0";
    }

    if (layer.strokeOn) {
      el.style.webkitTextStroke = `${layer.strokeWidth * scale}px ${layer.strokeColor}`;
      el.style.paintOrder = "stroke fill";
    } else {
      el.style.webkitTextStroke = "0px transparent";
    }
  }

  startDrag(e, layer, box) {
    e.preventDefault();
    this.select(layer.id);
    const rect = this.stageEl.getBoundingClientRect();
    const move = (ev) => {
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      layer.xPct = clamp(x, 0, 1);
      layer.yPct = clamp(y, 0, 1);
      this.renderDom();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.onChange();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  startResize(e, layer) {
    e.preventDefault();
    const rect = this.stageEl.getBoundingClientRect();
    const move = (ev) => {
      const x = (ev.clientX - rect.left) / rect.width;
      const w = Math.abs(x - layer.xPct) * 2;
      layer.wPct = clamp(w, 0.1, 1);
      this.renderDom();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.onChange();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ---------- Canvas draw (shared by live preview canvas + export) ----------

  drawAt(ctx, canvasW, canvasH, time) {
    this.activeLayersAt(time).forEach((layer) => {
      this.drawLayer(ctx, canvasW, canvasH, layer);
    });
  }

  drawLayer(ctx, canvasW, canvasH, layer) {
    const scale = canvasW / (this.videoW || canvasW);
    const fontSize = layer.fontSize * scale;
    const weight = layer.bold ? "800" : "400";
    const style = layer.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${fontSize}px ${layer.fontFamily.replace(/'/g, "")}`;
    ctx.textAlign = layer.align;
    ctx.textBaseline = "middle";

    const cx = layer.xPct * canvasW;
    const cy = layer.yPct * canvasH;
    const maxWidth = layer.wPct * canvasW;

    const lines = wrapText(ctx, layer.text, maxWidth);
    const lineHeight = fontSize * 1.45;
    const totalHeight = lines.length * lineHeight;
    const startY = cy - totalHeight / 2 + lineHeight / 2;

    let anchorX = cx;
    if (layer.align === "left") anchorX = cx - maxWidth / 2;
    if (layer.align === "right") anchorX = cx + maxWidth / 2;

    if (layer.bgOn && layer.bgMode === "line") {
      // Build one continuous outline across all lines (a "staircase"
      // silhouette where widths differ) and round the WHOLE shape as a
      // single path — this is what avoids the double-corner pinch you'd
      // get from rounding each line's box independently.
      const padX = fontSize * 0.48;
      const rects = lines.map((line, i) => {
        const w = ctx.measureText(line).width;
        const boxW = w + padX * 2;
        const top = cy - totalHeight / 2 + i * lineHeight;
        const bottom = top + lineHeight;
        let left, right;
        if (layer.align === "left") { left = anchorX - padX; right = left + boxW; }
        else if (layer.align === "right") { right = anchorX + padX; left = right - boxW; }
        else { left = cx - boxW / 2; right = cx + boxW / 2; }
        return { left, right, top, bottom };
      });
      const radius = safeRadiusFor(rects, lineHeight, layer.radius * scale);
      ctx.fillStyle = hexToRgba(layer.bgColor, layer.bgOpacity / 100);
      roundedPolygonPath(ctx, buildStackPolygon(rects), radius);
      ctx.fill();
    } else if (layer.bgOn) {
      // Single box around the whole multi-line block.
      let widest = 0;
      lines.forEach((line) => { widest = Math.max(widest, ctx.measureText(line).width); });
      const padX = fontSize * 0.4;
      const padY = fontSize * 0.25;
      const boxW = widest + padX * 2;
      const boxH = totalHeight + padY * 2;
      ctx.fillStyle = hexToRgba(layer.bgColor, layer.bgOpacity / 100);
      roundRect(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, layer.radius * scale);
      ctx.fill();
    }

    if (layer.strokeOn) {
      ctx.lineWidth = layer.strokeWidth * scale;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = "round";
      lines.forEach((line, i) => ctx.strokeText(line, anchorX, startY + i * lineHeight));
    }

    ctx.fillStyle = layer.color;
    lines.forEach((line, i) => ctx.fillText(line, anchorX, startY + i * lineHeight));
  }
}

// Traces the outline of a vertically-stacked set of rects (one per text
// line, all touching with no gaps) into a single ordered vertex list —
// a rectilinear "staircase" polygon where widths differ between lines.
function buildStackPolygon(rects) {
  const pts = [];
  pts.push({ x: rects[0].left, y: rects[0].top });
  pts.push({ x: rects[0].right, y: rects[0].top });
  for (let i = 0; i < rects.length; i++) {
    pts.push({ x: rects[i].right, y: rects[i].bottom });
    if (i + 1 < rects.length && rects[i + 1].right !== rects[i].right) {
      pts.push({ x: rects[i + 1].right, y: rects[i].bottom });
    }
  }
  pts.push({ x: rects[rects.length - 1].left, y: rects[rects.length - 1].bottom });
  for (let i = rects.length - 1; i >= 0; i--) {
    pts.push({ x: rects[i].left, y: rects[i].top });
    if (i - 1 >= 0 && rects[i - 1].left !== rects[i].left) {
      pts.push({ x: rects[i - 1].left, y: rects[i].top });
    }
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01) pts.pop();
  return pts;
}

// Rounds every corner of an arbitrary closed polygon by the same radius —
// works for both convex corners (bulge out) and concave/reflex corners
// (smooth curve inward), which is exactly what makes stacked lines of
// different widths read as one continuous blob instead of stacked boxes.
function roundedPolygonPath(ctx, points, radius) {
  const n = points.length;
  if (n < 3) return;
  ctx.beginPath();
  const last = points[n - 1];
  const start = points[0];
  ctx.moveTo((last.x + start.x) / 2, (last.y + start.y) / 2);
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const next = points[(i + 1) % n];
    ctx.arcTo(curr.x, curr.y, next.x, next.y, radius);
  }
  ctx.closePath();
}

// Keeps the radius from exceeding half the shortest edge in the stack,
// so a very narrow single-word line never produces overlapping arcs.
function safeRadiusFor(rects, lineHeight, desired) {
  let minW = Infinity;
  rects.forEach((r) => { minW = Math.min(minW, r.right - r.left); });
  return Math.max(0, Math.min(desired, minW / 2, lineHeight / 2));
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];
  paragraphs.forEach((para) => {
    const words = para.split(" ");
    let current = "";
    words.forEach((word) => {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    lines.push(current);
  });
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export { QUICK_STYLES };
