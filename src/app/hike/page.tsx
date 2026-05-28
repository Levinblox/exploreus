"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MapView } from "@/components/MapView";
import { MediaGallery } from "@/components/MediaGallery";
import { ElevationProfile } from "@/components/ElevationProfile";
import { deleteHike, getHike } from "@/lib/hikes";
import {
  avgSpeedMps,
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeed,
} from "@/lib/geo";
import type { GeoPoint, Hike } from "@/lib/types";

export default function HikeDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
      <HikeDetail />
    </Suspense>
  );
}

function HikeDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [hike, setHike] = useState<Hike | null | undefined>(undefined);
  const [is3D, setIs3D] = useState(false);
  const [highlight, setHighlight] = useState<GeoPoint | null>(null);

  useEffect(() => {
    if (!id) {
      setHike(null);
      return;
    }
    getHike(id).then(setHike);
  }, [id]);

  if (hike === undefined) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  if (hike === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-28 text-center">
        <h1 className="font-display text-2xl font-bold">Hike not found</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          It may have been deleted or recorded on another device.
        </p>
        <Link
          href="/profile/"
          className="mt-6 inline-block rounded-2xl bg-emerald-600 px-5 py-2.5 font-semibold text-white"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  async function onDelete() {
    if (!hike) return;
    if (!confirm("Delete this hike?")) return;
    await deleteHike(hike.id);
    router.push("/profile/");
  }

  return (
    <div className="flex flex-1 flex-col pb-28 animate-fade-up">
      <div className="relative h-[58vh] w-full">
        <MapView
          points={hike.points}
          userLocation={null}
          highlightPoint={highlight}
          follow={false}
          is3D={is3D}
          fitOnLoad={true}
          showDirection={true}
          className="absolute inset-0"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.875rem)" }}
        >
          <Link
            href="/profile/"
            aria-label="Back"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur-md dark:bg-zinc-900/95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>

          <div className="pointer-events-auto max-w-[60%] truncate rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-md dark:bg-zinc-900/95">
            {hike.name}
          </div>

          <div className="h-11 w-11" />
        </div>

        <button
          type="button"
          onClick={() => setIs3D((v) => !v)}
          className="absolute bottom-5 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white font-display text-sm font-bold text-zinc-900 shadow-xl ring-1 ring-black/5 active:scale-95 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10"
          aria-label={is3D ? "Switch to 2D" : "Switch to 3D"}
        >
          {is3D ? "2D" : "3D"}
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pt-5">
        <ElevationProfile points={hike.points} onScrub={setHighlight} />

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
            {new Date(hike.startedAt).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{hike.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Started at{" "}
            {new Date(hike.startedAt).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <BigStat label="Distance" value={formatDistance(hike.distanceM)} />
          <BigStat label="Total time" value={formatDuration(hike.durationMs)} />
          {hike.movingMs != null && (
            <BigStat
              label="Moving time"
              value={formatDuration(hike.movingMs)}
              hint={percent(hike.movingMs, hike.durationMs)}
            />
          )}
          {hike.restMs != null && (
            <BigStat
              label="Rest time"
              value={formatDuration(hike.restMs)}
              hint={percent(hike.restMs, hike.durationMs)}
            />
          )}
          <BigStat
            label={hike.movingMs ? "Avg moving" : "Avg speed"}
            value={formatSpeed(
              avgSpeedMps(hike.distanceM, hike.movingMs ?? hike.durationMs)
            )}
          />
          <BigStat label="Elevation" value={formatElevation(hike.elevationGainM)} />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold tracking-tight">Photos &amp; videos</h2>
          <MediaGallery parentKind="hike" parentId={hike.id} />
        </section>

        <button
          type="button"
          onClick={onDelete}
          className="mt-8 w-full rounded-2xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Delete hike
        </button>
      </div>
    </div>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-app">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums">{value}</div>
      {hint && (
        <div className="mt-0.5 text-[11px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function percent(part: number, total: number): string {
  if (total <= 0) return "";
  return `${Math.round((part / total) * 100)}% of total`;
}
