// textEditor.js — caption layers: create, drag/resize on the stage,
// style panel binding, and drawing the exact same look onto the export canvas.

const QUICK_STYLES = {
  classic: { color: "#ffffff", bgOn: false, bold: true, italic: false, fontFamily: "'Inter', sans-serif" },
  "bold-block": { color: "#ffffff", bgOn: true, bgColor: "#000000", bgOpacity: 90, bold: true, radius: 6, fontFamily: "'Archivo Black', sans-serif" },
  minimal: { color: "#ffffff", bgOn: false, bold: false, italic: false, fontFamily: "'Inter', sans-serif" },
  highlight: { color: "#14120f", bgOn: true, bgColor: "#e8543a", bgOpacity: 100, bold: true, radius: 4, fontFamily: "'Poppins', sans-serif" },
};

let idCounter = 1;

export function createDefaultLayer(duration) {
  return {
    id: "t" + idCounter++,
    text: "New caption",
    xPct: 0.5, yPct: 0.8, wPct: 0.7,
    fontFamily: "'Inter', sans-serif",
    fontSize: 40,
    color: "#ffffff",
    bgOn: false,
    bgColor: "#000000",
    bgOpacity: 70,
    radius: 8,
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
      this.styleBoxText(box, layer);
      box.textContent = layer.text;

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

  styleBoxText(box, layer) {
    const scale = this.stageEl.clientWidth / (this.videoW || this.stageEl.clientWidth || 1);
    box.style.fontFamily = layer.fontFamily;
    box.style.fontSize = layer.fontSize * scale + "px";
    box.style.color = layer.color;
    box.style.fontWeight = layer.bold ? "700" : "400";
    box.style.fontStyle = layer.italic ? "italic" : "normal";
    box.style.textAlign = layer.align;
    box.style.borderRadius = layer.radius + "px";
    box.style.background = layer.bgOn
      ? hexToRgba(layer.bgColor, layer.bgOpacity / 100)
      : "transparent";
  }

  refreshScale() {
    this.layers.forEach((l) => {
      const box = [...this.overlayEl.children].find((_, i) => this.layers[i] === l);
    });
    this.renderDom();
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
    const fontSize = layer.fontSize * (canvasW / (this.videoW || canvasW));
    const weight = layer.bold ? "700" : "400";
    const style = layer.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${fontSize}px ${layer.fontFamily.replace(/'/g, "")}`;
    ctx.textAlign = layer.align;
    ctx.textBaseline = "middle";

    const cx = layer.xPct * canvasW;
    const cy = layer.yPct * canvasH;
    const maxWidth = layer.wPct * canvasW;

    const lines = wrapText(ctx, layer.text, maxWidth);
    const lineHeight = fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;

    if (layer.bgOn) {
      let widest = 0;
      lines.forEach((line) => { widest = Math.max(widest, ctx.measureText(line).width); });
      const padX = fontSize * 0.4;
      const padY = fontSize * 0.25;
      const boxW = widest + padX * 2;
      const boxH = totalHeight + padY * 2;
      const boxX = cx - boxW / 2;
      const boxY = cy - boxH / 2;
      ctx.fillStyle = hexToRgba(layer.bgColor, layer.bgOpacity / 100);
      roundRect(ctx, boxX, boxY, boxW, boxH, layer.radius * (canvasW / (this.videoW || canvasW)));
      ctx.fill();
    }

    ctx.fillStyle = layer.color;
    const startY = cy - totalHeight / 2 + lineHeight / 2;
    let anchorX = cx;
    if (layer.align === "left") anchorX = cx - maxWidth / 2;
    if (layer.align === "right") anchorX = cx + maxWidth / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, anchorX, startY + i * lineHeight);
    });
  }
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
