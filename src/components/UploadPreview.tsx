"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  files: File[];
  onCancel: () => void;
  onConfirm: (files: File[]) => void;
};

type Entry = { file: File; url: string | null; isVideo: boolean };

export function UploadPreview({ files, onCancel, onConfirm }: Props) {
  // Only photos get an object URL — videos show a card, since the raw clip
  // can't be decoded everywhere and the cover is chosen after upload.
  const entries = useMemo<Entry[]>(
    () =>
      files.map((file) => {
        const isVideo = file.type.startsWith("video");
        return { file, url: isVideo ? null : URL.createObjectURL(file), isVideo };
      }),
    [files]
  );

  useEffect(() => {
    return () => entries.forEach((e) => e.url && URL.revokeObjectURL(e.url));
  }, [entries]);

  const [busy, setBusy] = useState(false);
  const hasVideo = entries.some((e) => e.isVideo);

  if (typeof document === "undefined") return null;
  // Portal to <body> so the overlay escapes any transformed ancestor (the map)
  // and truly covers the viewport instead of being clipped inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-black">
      <div className="flex w-full max-w-md items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm font-medium text-white/80">
          Cancel
        </button>
        <span className="text-sm font-semibold">
          {entries.length === 1 ? "1 item" : `${entries.length} items`}
        </span>
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            onConfirm(files);
          }}
          disabled={busy}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      <div className="w-full max-w-md flex-1 overflow-y-auto px-4">
        {/* Center a single item; scroll when there are several. */}
        <div className="flex min-h-full flex-col justify-center gap-4 py-6">
          {entries.map((e, i) =>
            e.isVideo ? (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-4 text-white">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="14" height="14" rx="2" />
                    <path d="m22 8-6 4 6 4V8z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.file.name || "Video"}</p>
                  <p className="text-xs text-white/60">{(e.file.size / 1048576).toFixed(1)} MB</p>
                </div>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={e.url!} alt="" className="max-h-[60vh] w-full rounded-2xl object-contain" />
            )
          )}

          {hasVideo && (
            <p className="px-1 text-center text-xs text-white/50">
              Videos upload first, then you can open them to pick the cover frame.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
