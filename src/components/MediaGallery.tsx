"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hasApi } from "@/lib/api";
import { deleteMedia, listMedia, setCover, uploadMedia } from "@/lib/media";
import type { Media, MediaParentKind } from "@/lib/types";
import { UploadPreview } from "./UploadPreview";

type Props = {
  parentKind: MediaParentKind;
  parentId: string;
  /** Show the upload control. Hide on items the user doesn't own. */
  canUpload?: boolean;
};

// Keep in sync with MAX_MEDIA_PER_PARENT on the server.
const MAX_ITEMS = 10;

export function MediaGallery({ parentKind, parentId, canUpload = true }: Props) {
  const [items, setItems] = useState<Media[] | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const [pending, setPending] = useState<File[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    listMedia(parentKind, parentId)
      .then((m) => !cancelled && setItems(m))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [parentKind, parentId]);

  // Pick files → open the preview sheet (where the user picks video covers).
  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = MAX_ITEMS - (items?.length ?? 0);
    if (remaining <= 0) {
      setError(`You've reached the ${MAX_ITEMS}-item limit for this hike.`);
      return;
    }
    let chosen = Array.from(files);
    if (chosen.length > remaining) {
      chosen = chosen.slice(0, remaining);
      setError(`Only ${remaining} more allowed — keeping the first ${remaining}.`);
    }
    setPending(chosen);
  }

  // Confirmed from the preview: upload each file. Video covers are auto-cut
  // server-side and can be changed afterward via the viewer.
  async function runUpload(toUpload: File[]) {
    setPending(null);
    setUploading(toUpload.length);
    const uploaded: Media[] = [];
    for (const file of toUpload) {
      try {
        const m = await uploadMedia(parentKind, parentId, file);
        uploaded.push(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    setItems((prev) => [...(prev ?? []), ...uploaded]);
    // Covers are cut server-side during transcode; poll briefly so they
    // appear without the user having to leave and return to the hike.
    if (uploaded.some((m) => m.kind === "video")) pollForPosters();
  }

  function pollForPosters() {
    let tries = 0;
    const tick = async () => {
      tries++;
      const fresh = await listMedia(parentKind, parentId).catch(() => null);
      if (fresh) setItems(fresh);
      const missing = fresh?.some((m) => m.kind === "video" && !m.posterUrl) ?? false;
      if (missing && tries < 8) setTimeout(tick, 3000);
    };
    setTimeout(tick, 3000);
  }

  async function onDelete(m: Media) {
    if (!confirm("Delete this " + m.kind + "?")) return;
    setItems((prev) => prev?.filter((x) => x.id !== m.id) ?? null);
    try {
      await deleteMedia(m.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (!hasApi()) {
    return (
      <p className="text-xs text-zinc-400">
        Media uploads require the API. Offline mode only shows trail data.
      </p>
    );
  }

  const showEmpty = items != null && items.length === 0 && !canUpload;
  if (showEmpty) return null;

  const count = items?.length ?? 0;
  const atCap = count >= MAX_ITEMS;

  return (
    <div>
      {items == null ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No photos yet. {canUpload && "Tap the button below to add some."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((m) => (
            <div
              key={m.id}
              className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800"
            >
              <button type="button" onClick={() => setLightbox(m)} className="absolute inset-0 h-full w-full">
                {m.kind === "video" ? (
                  m.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    /* No poster yet (transcode still running) — seek past the
                       usually-black first frame as a stopgap. */
                    <video
                      src={m.url + "#t=0.5"}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </button>
              {m.kind === "video" && (
                <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  ▶
                </span>
              )}
              {canUpload && (
                <button
                  type="button"
                  onClick={() => onDelete(m)}
                  aria-label={`Delete ${m.kind}`}
                  className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canUpload && atCap ? (
        <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {MAX_ITEMS}-item limit reached. Delete one to add more.
        </p>
      ) : canUpload ? (
        <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.98] disabled:opacity-60">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {uploading > 0 ? `Uploading ${uploading}…` : `Add photos or video (${count}/${MAX_ITEMS})`}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {lightbox && (
        <Lightbox
          item={lightbox}
          onClose={() => setLightbox(null)}
          onDelete={canUpload ? () => { onDelete(lightbox); setLightbox(null); } : undefined}
          onSetCover={
            canUpload && lightbox.kind === "video"
              ? async (time) => {
                  const posterUrl = await setCover(lightbox.id, time);
                  setItems((prev) => prev?.map((x) => (x.id === lightbox.id ? { ...x, posterUrl } : x)) ?? null);
                  setLightbox((l) => (l ? { ...l, posterUrl } : l));
                }
              : undefined
          }
        />
      )}

      {pending && (
        <UploadPreview
          files={pending}
          onCancel={() => setPending(null)}
          onConfirm={runUpload}
        />
      )}
    </div>
  );
}

function Lightbox({
  item,
  onClose,
  onDelete,
  onSetCover,
}: {
  item: Media;
  onClose: () => void;
  onDelete?: () => void;
  onSetCover?: (time: number) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [coverState, setCoverState] = useState<"idle" | "saving" | "done">("idle");

  async function saveCover() {
    const v = videoRef.current;
    if (!v || !onSetCover) return;
    setCoverState("saving");
    try {
      await onSetCover(v.currentTime);
      setCoverState("done");
      setTimeout(() => setCoverState("idle"), 2000);
    } catch {
      setCoverState("idle");
    }
  }

  if (typeof document === "undefined") return null;
  // Portal to <body> so the overlay escapes any transformed ancestor (the map)
  // and covers the whole viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      {/* Contained card so portrait/landscape media both sit neatly. */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === "video" ? (
          <video
            ref={videoRef}
            src={item.url}
            poster={item.posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
            className="max-h-[75vh] w-full bg-black object-contain"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.url} alt="" className="max-h-[75vh] w-full bg-black object-contain" />
        )}

        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
          aria-label="Close"
        >
          ✕
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
            aria-label={`Delete ${item.kind}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        )}

        {onSetCover && item.kind === "video" && (
          <>
            <p className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
              Drag the video to your cover frame
            </p>
            <button
              type="button"
              onClick={saveCover}
              disabled={coverState === "saving"}
              className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg active:scale-95 disabled:opacity-70"
            >
              {coverState === "saving" ? "Saving…" : coverState === "done" ? "Cover set ✓" : "Set as cover"}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
