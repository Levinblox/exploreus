// Capture a poster frame from a <video> element that's playing a local file
// (a blob: object URL, so the canvas isn't tainted and toBlob works). Used by
// the upload preview so the user picks the cover before we send the video.

/** Seek the video to `time` (seconds) and resolve once the frame is ready. */
export function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const t = Math.max(0, Math.min(time, (video.duration || time) - 0.05));
    if (Math.abs(video.currentTime - t) < 0.01 && video.readyState >= 2) {
      resolve();
      return;
    }
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

/** Draw the video's current frame to a downscaled JPEG File, or null on failure. */
export async function captureFrame(
  video: HTMLVideoElement,
  maxDim = 720
): Promise<File | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const scale = Math.min(maxDim / Math.max(w, h), 1);
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, cw, ch);
  } catch {
    return null; // frame not decodable / tainted
  }

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", 0.85)
  );
  if (!blob) return null;
  return new File([blob], "cover.jpg", { type: "image/jpeg", lastModified: Date.now() });
}
