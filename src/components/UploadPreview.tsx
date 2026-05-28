"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type UploadItem = { file: File; posterTime: number | null };

type Props = {
  files: File[];
  onCancel: () => void;
  onConfirm: (items: UploadItem[]) => void;
};

type Entry = { file: File; url: string; isVideo: boolean };

export function UploadPreview({ files, onCancel, onConfirm }: Props) {
  const entries = useMemo<Entry[]>(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith("video"),
      })),
    [files]
  );

  // Revoke object URLs when this preview unmounts.
  useEffect(() => {
    return () => entries.forEach((e) => URL.revokeObjectURL(e.url));
  }, [entries]);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [busy, setBusy] = useState(false);

  function confirm() {
    setBusy(true);
    const items: UploadItem[] = entries.map((e, i) => ({
      file: e.file,
      // Whatever frame the native player is paused on becomes the cover.
      posterTime: e.isVideo ? videoRefs.current[i]?.currentTime ?? null : null,
    }));
    onConfirm(items);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-black/95">
      <div className="flex w-full max-w-md items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm font-medium text-white/80">
          Cancel
        </button>
        <span className="text-sm font-semibold">
          {entries.length === 1 ? "1 item" : `${entries.length} items`}
        </span>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      <div className="w-full max-w-md flex-1 overflow-y-auto px-4">
        {/* Center a single item; scroll when there are several. */}
        <div className="flex min-h-full flex-col justify-center gap-6 py-6">
          {entries.map((e, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-zinc-900">
              {e.isVideo ? (
                <>
                  <video
                    ref={(el) => {
                      videoRefs.current[i] = el;
                    }}
                    src={e.url}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="max-h-[60vh] w-full bg-black object-contain"
                    onLoadedMetadata={(ev) => {
                      // Default cover ~1s in (or 10% for very short clips).
                      const v = ev.currentTarget;
                      v.currentTime = Math.min(1, (v.duration || 1) * 0.1);
                    }}
                  />
                  <p className="px-3 py-2.5 text-xs text-white/70">
                    A cover is picked automatically — open the video after upload to change it.
                  </p>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={e.url} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
