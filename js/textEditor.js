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
