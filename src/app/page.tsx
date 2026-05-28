"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HikeCard } from "@/components/HikeCard";
import { listHikes } from "@/lib/hikes";
import { formatDistance } from "@/lib/geo";
import type { HikeSummary } from "@/lib/types";

export default function HomePage() {
  const [hikes, setHikes] = useState<HikeSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listHikes().then((h) => {
      setHikes(h);
      setLoaded(true);
    });
  }, []);

  const totalDistance = hikes.reduce((sum, h) => sum + h.distanceM, 0);
  const totalElev = hikes.reduce((sum, h) => sum + h.elevationGainM, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-32 animate-fade-up">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Exploreus
        </div>
        <h1 className="mt-3 font-display text-[44px] font-bold leading-[1.05] tracking-tight">
          Ready for the trail?
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Track every step. Save the view. Share the route.
        </p>
      </header>

      <Link
        href="/record/"
        className="group relative block overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-7 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.55)] transition-all active:scale-[0.985]"
      >
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
              New hike
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-white">Start recording</div>
            <div className="mt-1 text-sm text-emerald-50/90">GPS · distance · elevation · speed</div>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40 backdrop-blur transition-transform group-hover:scale-105 group-active:scale-95">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 400 200"
          className="pointer-events-none absolute -bottom-2 left-0 right-0 h-32 w-full opacity-30"
          preserveAspectRatio="none"
        >
          <path d="M0 160 C 80 100, 160 180, 240 120 S 360 80, 400 130 L400 200 L0 200 Z" fill="white" />
          <path d="M0 180 C 60 140, 140 200, 220 160 S 340 130, 400 170 L400 200 L0 200 Z" fill="white" opacity="0.5" />
        </svg>
      </Link>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatTile label="Hikes" value={hikes.length.toString()} />
        <StatTile label="Distance" value={formatDistance(totalDistance)} />
        <StatTile label="Elev. gain" value={`${Math.round(totalElev)} m`} />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight">Recent hikes</h2>
          <Link href="/profile/" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            See all →
          </Link>
        </div>

        {!loaded ? (
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[88px] animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
            ))}
          </ul>
        ) : hikes.length === 0 ? (
          <EmptyHikes />
        ) : (
          <ul className="space-y-2">
            {hikes.slice(0, 4).map((h) => (
              <li key={h.id}>
                <HikeCard hike={h} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center shadow-sm ring-1 ring-app">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function EmptyHikes() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-app">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-amber-500/15 ring-1 ring-black/5 dark:ring-white/10">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 19l5-8 4 5 3-3 6 6" />
          <path d="M14 4h7v7" />
          <path d="M21 4l-9 9" />
        </svg>
      </div>
      <p className="font-display text-base font-semibold">No hikes yet</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Tap <span className="font-semibold text-emerald-600 dark:text-emerald-400">Start recording</span> to log your first one.
      </p>
    </div>
  );
}
