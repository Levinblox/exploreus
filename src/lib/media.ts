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

// PUT a file straight to R2 via a presigned URL. `parent` is omitted for the
// poster sidecar so it doesn't count against the per-hike cap.
async function putToR2(
  kind: "photo" | "video",
  file: File,
  parent?: { parentKind: MediaParentKind; parentId: string }
): Promise<Presigned> {
  const contentType = file.type || (kind === "video" ? "video/mp4" : "image/jpeg");
  const presigned = await apiFetch<Presigned>("/api/upload/presign", {
    method: "POST",
    body: JSON.stringify({ kind, contentType, ext: extOf(file), ...parent }),
  });
  // R2 signs the content-type into the URL, so the PUT must send the same value.
  const res = await fetch(presigned.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return presigned;
}

// Two-step upload: ask the API for a presigned URL, PUT the file directly to
// R2, then tell the API where it landed. `poster` is a client-chosen cover
// frame for videos — uploaded as a sidecar image and stored as the thumbnail.
export async function uploadMedia(
  parentKind: MediaParentKind,
  parentId: string,
  file: File,
  poster?: File | null
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

  const presigned = await putToR2(kind, file, { parentKind, parentId });
  const contentType = file.type || (kind === "video" ? "video/mp4" : "image/jpeg");

  // Upload the chosen cover frame (videos only). Best-effort: if it fails the
  // video still uploads and the server transcode will make a fallback poster.
  let thumbKey: string | null = null;
  let posterUrl: string | null = null;
  if (kind === "video" && poster) {
    try {
      const t = await putToR2("photo", poster);
      thumbKey = t.key;
      posterUrl = t.publicUrl;
    } catch {
      thumbKey = null;
    }
  }

  await apiFetch("/api/media", {
    method: "POST",
    body: JSON.stringify({
      id: presigned.id,
      parentKind,
      parentId,
      kind,
      storageKey: presigned.key,
      thumbStorageKey: thumbKey,
      contentType,
      sizeBytes: file.size,
    }),
  });

  return {
    id: presigned.id,
    kind,
    storageKey: presigned.key,
    url: presigned.publicUrl,
    posterUrl,
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
