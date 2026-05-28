// Client-side image downscale + JPEG re-encode. Drops a typical iPhone photo
// (~4 MB) to ~200–400 KB with no perceptible quality loss on a phone screen.

export type CompressOptions = {
  /** Max length of the longer edge in pixels. */
  maxDim: number;
  /** JPEG quality, 0–1. */
  quality: number;
};

const DEFAULTS: CompressOptions = { maxDim: 1440, quality: 0.85 };

export async function compressImage(
  file: File,
  opts: Partial<CompressOptions> = {}
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Don't bother if already small — re-encoding tiny images can grow them.
  if (file.size < 200_000) return file;

  const { maxDim, quality } = { ...DEFAULTS, ...opts };

  let bitmap: ImageBitmap;
  try {
    // createImageBitmap respects EXIF orientation by default in modern browsers.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Format not supported (rare HEIC etc.) — ship the original.
    return file;
  }

  const { width, height } = bitmap;
  const scale = Math.min(maxDim / Math.max(width, height), 1);
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  // High-quality downscale (browsers default to bilinear; this hints trilinear-ish).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  if (!blob) return file;
  // If re-encoding actually grew the file (rare, e.g. simple PNG), keep original.
  if (blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
