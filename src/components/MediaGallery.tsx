"use client";

import { useEffect, useState } from "react";
import { hasApi } from "@/lib/api";
import { deleteMedia, listMedia, uploadMedia } from "@/lib/media";
import type { Media, MediaParentKind } from "@/lib/types";

type Props = {
  parentKind: MediaParentKind;
  parentId: string;
  /** Show the upload control. Hide on items the user doesn't own. */
  canUpload?: boolean;
};

export function MediaGallery({ parentKind, parentId, canUpload = true }: Props) {
  const [items, setItems] = useState<Media[] | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Media | null>(null);

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

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(files.length);
    const uploaded: Media[] = [];
    for (const file of Array.from(files)) {
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
            <button
              key={m.id}
              type="button"
              onClick={() => setLightbox(m)}
              className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800"
            >
              {m.kind === "video" ? (
                <>
                  <video
                    src={m.url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    ▶
                  </span>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}

      {canUpload && (
        <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.98] disabled:opacity-60">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {uploading > 0 ? `Uploading ${uploading}…` : "Add photos or video"}
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
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {lightbox && (
        <Lightbox
          item={lightbox}
          onClose={() => setLightbox(null)}
          onDelete={canUpload ? () => { onDelete(lightbox); setLightbox(null); } : undefined}
        />
      )}
    </div>
  );
}

function Lightbox({
  item,
  onClose,
  onDelete,
}: {
  item: Media;
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close"
      />
      <div className="relative max-h-full max-w-full">
        {item.kind === "video" ? (
          <video src={item.url} controls autoPlay playsInline className="max-h-[85vh] max-w-full rounded-xl" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.url} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-lg"
        aria-label="Close"
      >
        ✕
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-full bg-red-600/95 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        >
          Delete
        </button>
      )}
    </div>
  );
}
