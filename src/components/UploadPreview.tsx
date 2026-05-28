"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { captureFrame, seekTo } from "@/lib/videoPoster";

export type UploadItem = { file: File; poster: File | null };

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
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [times, setTimes] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const items: UploadItem[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      let poster: File | null = null;
      if (e.isVideo) {
        const v = videoRefs.current[i];
        if (v) {
          await seekTo(v, v.currentTime); // ensure the chosen frame is decoded
          poster = await captureFrame(v);
        }
      }
      items.push({ file: e.file, poster });
    }
    onConfirm(items);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
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

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-8">
        {entries.map((e, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-zinc-900">
            {e.isVideo ? (
              <div>
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={e.url}
                  muted
                  playsInline
                  preload="auto"
                  className="max-h-[55vh] w-full bg-black object-contain"
                  onLoadedMetadata={(ev) => {
                    const v = ev.currentTarget;
                    const dur = v.duration || 0;
                    // Default cover ~1s in (or 10% for very short clips).
                    const t = Math.min(1, (dur || 1) * 0.1);
                    setDurations((d) => ({ ...d, [i]: dur }));
                    setTimes((s) => ({ ...s, [i]: t }));
                    seekTo(v, t);
                  }}
                />
                <div className="px-3 py-3">
                  <label className="mb-1 block text-xs font-medium text-white/70">
                    Drag to choose cover
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={durations[i] || 0}
                    step={0.05}
                    value={times[i] ?? 0}
                    onChange={(ev) => {
                      const t = Number(ev.target.value);
                      setTimes((s) => ({ ...s, [i]: t }));
                      const v = videoRefs.current[i];
                      if (v) seekTo(v, t);
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={e.url} alt="" className="max-h-[60vh] w-full object-contain" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
