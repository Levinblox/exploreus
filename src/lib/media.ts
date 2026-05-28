import { apiFetch, hasApi } from "./api";
import { compressImage } from "./imageCompress";
import type { Media, MediaParentKind } from "./types";

// Sanity cap to avoid runaway uploads. Server re-encodes anything that lands
// here down to ~1080p H.264, so even big originals end up small in storage.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

type Presigned = {
  id: string;
  key: string;
  uploadUrl: string;
  publicUrl: string;
};

function extOf(file: File): string {
  const n = file.name;
  const dot = n.lastIndexOf(".");
  return dot >= 0 ? n.slice(dot + 1).toLowerCase() : "";
}

// Two-step upload: ask the API for a presigned URL, PUT the file directly to
// R2, then tell the API where it landed. `posterTime` is the timestamp (sec)
// the user scrubbed to; the server cuts the video cover there during transcode.
export async function uploadMedia(
  parentKind: MediaParentKind,
  parentId: string,
  file: File,
  posterTime?: number | null
): Promise<Media> {
  if (!hasApi()) throw new Error("API not configured");
  const kind: "photo" | "video" = file.type.startsWith("video") ? "video" : "photo";

  if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is ${(file.size / 1024 / 1024).toFixed(1)} MB — please pick one under ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`
    );
  }

  if (kind === "photo") {
    file = await compressImage(file);
  }

  // R2 signs the content-type into the URL, so the PUT must send the same value.
  const contentType = file.type || (kind === "video" ? "video/mp4" : "image/jpeg");
  const presigned = await apiFetch<Presigned>("/api/upload/presign", {
    method: "POST",
    body: JSON.stringify({ kind, contentType, ext: extOf(file), parentKind, parentId }),
  });
  const putRes = await fetch(presigned.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);

  await apiFetch("/api/media", {
    method: "POST",
    body: JSON.stringify({
      id: presigned.id,
      parentKind,
      parentId,
      kind,
      storageKey: presigned.key,
      posterTime: kind === "video" ? posterTime ?? null : null,
      contentType,
      sizeBytes: file.size,
    }),
  });

  return {
    id: presigned.id,
    kind,
    storageKey: presigned.key,
    url: presigned.publicUrl,
    posterUrl: null, // server generates the cover during transcode
    contentType,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
  };
}

export async function listMedia(
  parentKind: MediaParentKind,
  parentId: string
): Promise<Media[]> {
  if (!hasApi()) return [];
  return apiFetch<Media[]>(
    `/api/media?parentKind=${parentKind}&parentId=${encodeURIComponent(parentId)}`
  );
}

export async function deleteMedia(id: string): Promise<void> {
  if (!hasApi()) return;
  await apiFetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Re-cut a video's cover at `time` seconds (server-side, on the transcoded
// file). Returns the new poster URL.
export async function setCover(id: string, time: number): Promise<string> {
  const r = await apiFetch<{ posterUrl: string }>(
    `/api/media/${encodeURIComponent(id)}/cover`,
    { method: "POST", body: JSON.stringify({ time }) }
  );
  return r.posterUrl;
}
