"use client";

import Link from "next/link";
import { useState } from "react";
import { MapView, type ArrowVariant } from "@/components/MapView";
import type { GeoPoint } from "@/lib/types";

// A loopy sample track around Lucerne that goes through a U-turn so
// you can clearly see whether arrows really follow walking direction.
const SAMPLE_TRACK: GeoPoint[] = (() => {
  const pts: GeoPoint[] = [];
  const cx = 47.0502;
  const cy = 8.3093;
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Lissajous-ish curve so we get straights + curves + back-tracks.
    const lat = cx + 0.004 * Math.sin(2 * Math.PI * t);
    const lng = cy + 0.006 * Math.sin(4 * Math.PI * t);
    pts.push({ lat, lng, alt: 500 + 30 * Math.sin(8 * Math.PI * t), t: i * 30_000 });
  }
  return pts;
})();

type Variant = {
  id: string;
  key: ArrowVariant;
  label: string;
  blurb: string;
  spacing: number;
};

const DOUBLE_CHEVRON_DENSITIES: Variant[] = [
  { id: "b-110", key: "double-chevron", label: "B · Loose (110 px)", blurb: "Current spacing.", spacing: 110 },
  { id: "b-70", key: "double-chevron", label: "B+ · Medium (70 px)", blurb: "Roughly 1.5× denser.", spacing: 70 },
  { id: "b-50", key: "double-chevron", label: "B++ · Tight (50 px)", blurb: "Twice as dense.", spacing: 50 },
  { id: "b-35", key: "double-chevron", label: "B+++ · Very tight (35 px)", blurb: "About 3× denser — quite busy.", spacing: 35 },
];

const FLOWING: Variant[] = [
  { id: "G", key: "curved-chevron", label: "G · Curved chevron", blurb: "Soft sweep, no sharp angles.", spacing: 90 },
  { id: "H", key: "teardrop", label: "H · Teardrop", blurb: "Rounded body, organic forward motion.", spacing: 100 },
  { id: "I", key: "comet", label: "I · Comet", blurb: "Arrowhead with a fading trail.", spacing: 110 },
  { id: "J", key: "wing", label: "J · Wing / paper plane", blurb: "Aerodynamic, swept-back edges.", spacing: 100 },
  { id: "K", key: "brushstroke", label: "K · Brushstroke", blurb: "Single calligraphic stroke.", spacing: 95 },
  { id: "L", key: "dot-trail", label: "L · Dot trail", blurb: "Three dots growing toward direction.", spacing: 80 },
];

const ANGULAR: Variant[] = [
  { id: "A", key: "chevron", label: "A · Single chevron", blurb: "Current default. White with shadow.", spacing: 90 },
  { id: "B", key: "double-chevron", label: "B · Double chevron", blurb: ">> Stronger directional emphasis.", spacing: 110 },
  { id: "C", key: "triangle", label: "C · Solid triangle", blurb: "Filled white triangle, bold and obvious.", spacing: 100 },
  { id: "D", key: "full-arrow", label: "D · Full arrow (shaft + head)", blurb: "Classic arrow with shaft and arrowhead.", spacing: 120 },
  { id: "E", key: "minimal", label: "E · Minimal pip", blurb: "Tiny, low-key. Tighter spacing.", spacing: 60 },
  { id: "F", key: "amber", label: "F · Amber chevron", blurb: "Same shape as A, app accent color.", spacing: 90 },
];

export default function MockupsPage() {
  const [focused, setFocused] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-8 pb-24">
      <div className="mb-4">
        <Link
          href="/profile/"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
        >
          ← Back
        </Link>
      </div>

      <h1 className="font-display text-3xl font-bold tracking-tight">
        Direction-arrow mockups
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Same sample track, different arrow styles. The track has straights, curves,
        and a U-turn so you can verify arrows actually follow walking direction.
      </p>

      <h2 className="mt-7 font-display text-xl font-bold tracking-tight">
        Double chevron · pick a density
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Same shape as B, different spacing. Tell me which feels right.
      </p>
      <Grid variants={DOUBLE_CHEVRON_DENSITIES} focused={focused} setFocused={setFocused} />

      <h2 className="mt-10 font-display text-xl font-bold tracking-tight">
        Flowing — curved &amp; organic
      </h2>
      <Grid variants={FLOWING} focused={focused} setFocused={setFocused} />

      <h2 className="mt-10 font-display text-xl font-bold tracking-tight">
        Angular — sharp &amp; geometric
      </h2>
      <Grid variants={ANGULAR} focused={focused} setFocused={setFocused} />

      <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Tap a card to mark your pick — tell me which letter and I&apos;ll wire it in.
      </p>
    </div>
  );
}

function Grid({
  variants,
  focused,
  setFocused,
}: {
  variants: Variant[];
  focused: string | null;
  setFocused: (v: string | null) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => setFocused(focused === v.id ? null : v.id)}
          className={`group flex flex-col overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 transition-all ${
            focused === v.id
              ? "ring-2 ring-emerald-500"
              : "ring-app hover:ring-zinc-300 dark:hover:ring-zinc-700"
          }`}
        >
          <div className="relative h-64 w-full">
            <MapView
              points={SAMPLE_TRACK}
              userLocation={null}
              showDirection
              arrowVariant={v.key}
              arrowSpacing={v.spacing}
              fitOnLoad
              follow={false}
              showStyleControl={false}
              className="absolute inset-0"
            />
          </div>
          <div className="px-4 py-3">
            <div className="font-display text-sm font-bold tracking-tight">
              {v.label}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {v.blurb}
            </div>
            {focused === v.id && (
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Selected
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
