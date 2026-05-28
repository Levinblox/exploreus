"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapView } from "@/components/MapView";
import { MediaGallery } from "@/components/MediaGallery";
import { getTrail, networkLabel } from "@/lib/trails";
import { formatDistance } from "@/lib/geo";
import type { Trail } from "@/lib/types";

const NETWORK_STYLES: Record<string, string> = {
  nwn: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  rwn: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  lwn: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  iwn: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
};

export default function TrailDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
      <TrailDetail />
    </Suspense>
  );
}

function TrailDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const [trail, setTrail] = useState<Trail | null | undefined>(undefined);
  const [is3D, setIs3D] = useState(false);

  useEffect(() => {
    if (!id) {
      setTrail(null);
      return;
    }
    getTrail(id).then(setTrail);
  }, [id]);

  if (trail === undefined) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  if (trail === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-28 text-center">
        <h1 className="font-display text-2xl font-bold">Trail not found</h1>
        <Link
          href="/discover/"
          className="mt-6 inline-block rounded-2xl bg-emerald-600 px-5 py-2.5 font-semibold text-white"
        >
          Back to Discover
        </Link>
      </div>
    );
  }

  // Flatten segments into a single point array for MapView's polyline.
  const flat = trail.segments.flat().map((p) => ({ lat: p.lat, lng: p.lng, alt: null, t: 0 }));
  const badge = NETWORK_STYLES[trail.network ?? ""] ?? NETWORK_STYLES.lwn;

  return (
    <div className="flex flex-1 flex-col pb-28 animate-fade-up">
      <div className="relative h-[58vh] w-full">
        <MapView
          points={flat}
          userLocation={null}
          follow={false}
          is3D={is3D}
          fitOnLoad={true}
          className="absolute inset-0"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.875rem)" }}
        >
          <Link
            href="/discover/"
            aria-label="Back"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur-md dark:bg-zinc-900/95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="pointer-events-auto max-w-[60%] truncate rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-md dark:bg-zinc-900/95">
            {trail.ref ? `${trail.ref} · ` : ""}
            {trail.name}
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
        <div className="flex items-center gap-2">
          {trail.ref && (
            <span className="rounded-md bg-zinc-900 px-2 py-1 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {trail.ref}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge}`}>
            {networkLabel(trail.network)}
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{trail.name}</h1>
        {(trail.from || trail.to) && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {trail.from && trail.to ? `${trail.from} → ${trail.to}` : trail.from || trail.to}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <BigStat label="Distance" value={formatDistance(trail.distanceM)} />
          <BigStat label="Segments" value={trail.segments.length.toString()} />
        </div>

        <Link
          href={`/record/?trail=${encodeURIComponent(trail.id)}`}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          Follow this trail
        </Link>

        {trail.source === "uploaded" && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg font-bold tracking-tight">
              Photos &amp; videos
            </h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Show others what to expect on this trail.
            </p>
            <MediaGallery parentKind="user_trail" parentId={trail.id} />
          </section>
        )}

        <p className="mt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Trail data © OpenStreetMap contributors (ODbL)
        </p>
      </div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-app">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
