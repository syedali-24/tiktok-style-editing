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
