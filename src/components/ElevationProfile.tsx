"use client";

import { useMemo, useRef, useState } from "react";
import { haversineMeters } from "@/lib/geo";
import type { GeoPoint } from "@/lib/types";

type Sample = { d: number; alt: number; p: GeoPoint };

type Props = {
  points: GeoPoint[];
  onScrub?: (p: GeoPoint | null) => void;
  className?: string;
};

const W = 200;
const H = 64;

export function ElevationProfile({ points, onScrub, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);

  const samples = useMemo<Sample[]>(() => {
    const out: Sample[] = [];
    let dist = 0;
    let prev: GeoPoint | null = null;
    for (const p of points) {
      if (prev) dist += haversineMeters(prev, p);
      if (p.alt != null && Number.isFinite(p.alt)) out.push({ d: dist, alt: p.alt, p });
      prev = p;
    }
    return out;
  }, [points]);

  if (samples.length < 2) {
    return (
      <div
        className={`rounded-2xl bg-white px-4 py-6 text-center text-xs text-zinc-500 shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 ${className ?? ""}`}
      >
        No elevation data for this hike.
      </div>
    );
  }

  let minAlt = Infinity;
  let maxAlt = -Infinity;
  for (const s of samples) {
    if (s.alt < minAlt) minAlt = s.alt;
    if (s.alt > maxAlt) maxAlt = s.alt;
  }
  const altRange = Math.max(1, maxAlt - minAlt);
  const totalD = samples[samples.length - 1].d || 1;

  const linePath = samples
    .map((s, i) => {
      const x = (s.d / totalD) * W;
      const y = H - ((s.alt - minAlt) / altRange) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${linePath} L${W} ${H} L0 ${H} Z`;

  function findIdx(clientX: number): number | null {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = ratio * totalD;
    let lo = 0;
    let hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].d < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(samples[lo - 1].d - target) < Math.abs(samples[lo].d - target)) {
      return lo - 1;
    }
    return lo;
  }

  function setFromEvent(e: React.PointerEvent) {
    const idx = findIdx(e.clientX);
    if (idx == null) return;
    setScrubIdx(idx);
    onScrub?.(samples[idx].p);
  }

  function endScrub() {
    setScrubIdx(null);
    onScrub?.(null);
  }

  const scrubX = scrubIdx != null ? (samples[scrubIdx].d / totalD) * W : null;
  const scrubY =
    scrubIdx != null
      ? H - ((samples[scrubIdx].alt - minAlt) / altRange) * H
      : null;

  return (
    <div
      ref={containerRef}
      className={`relative touch-none select-none overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-zinc-800 ${className ?? ""}`}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setFromEvent(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType !== "touch") return;
        setFromEvent(e);
      }}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
    >
      <div className="flex items-center justify-between px-4 pt-3 text-xs">
        <span className="font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
          {Math.round(maxAlt)} m
        </span>
        {scrubIdx != null ? (
          <span className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white tabular-nums">
            {Math.round(samples[scrubIdx].alt)} m · {(samples[scrubIdx].d / 1000).toFixed(2)} km
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">Drag to inspect</span>
        )}
      </div>

      <div className="relative px-3 pb-2 pt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-24 w-full"
        >
          <defs>
            <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#elev-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {scrubX != null && scrubY != null && (
            <>
              <line
                x1={scrubX}
                y1={0}
                x2={scrubX}
                y2={H}
                stroke="#0ea5e9"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={scrubX}
                cy={scrubY}
                r="2.2"
                fill="#0ea5e9"
                stroke="white"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
        <span>{Math.round(minAlt)} m</span>
        <span>{(totalD / 1000).toFixed(2)} km</span>
      </div>
    </div>
  );
}
