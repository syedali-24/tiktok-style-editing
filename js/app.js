import { TextEditor, QUICK_STYLES } from "./textEditor.js";
import { SongLibrary } from "./songs.js";
import { exportVideo, downloadBlob } from "./exporter.js";

const $ = (id) => document.getElementById(id);

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
const fields = ["fText", "fFont", "fSize", "fColor", "fBg", "fBgOn", "fBgOpacity", "fRadius", "fBold", "fItalic", "fAlign", "fStart", "fEnd"];

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
  $("fBg").value = layer.bgColor;
  $("fBgOn").checked = layer.bgOn;
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
bindInspectorField("fBg", "bgColor");
bindInspectorField("fBgOn", "bgOn");
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
