"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrailCard } from "@/components/TrailCard";
import { listTrails } from "@/lib/trails";
import { importGpxFilesAsTrails } from "@/lib/gpx";
import type { TrailSummary } from "@/lib/types";

export default function DiscoverPage() {
  const [trails, setTrails] = useState<TrailSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const t = await listTrails();
      setTrails(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trails");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    setError(null);
    const { imported, failed } = await importGpxFilesAsTrails(files);
    setImporting(false);
    if (failed > 0 && imported === 0) {
      setError(`Couldn't read ${failed} file${failed > 1 ? "s" : ""}. Make sure it's a valid GPX.`);
    } else if (failed > 0) {
      setError(`Imported ${imported}, skipped ${failed} bad file${failed > 1 ? "s" : ""}.`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refresh();
  }

  const filtered = useMemo(() => {
    if (!trails) return null;
    const q = query.trim().toLowerCase();
    if (!q) return trails;
    return trails.filter((t) => `${t.name} ${t.ref ?? ""}`.toLowerCase().includes(q));
  }, [trails, query]);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-32 animate-fade-up">
      <header className="mb-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Discover
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Trails to follow.</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Import a GPX file from Wikiloc, Komoot, or any hiking site.
        </p>
      </header>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="group relative block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-6 text-left shadow-[0_20px_60px_-15px_rgba(245,158,11,0.55)] transition-all active:scale-[0.985] disabled:opacity-70"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
              {importing ? "Importing…" : "Add a trail"}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-white">
              Import GPX file
            </div>
            <div className="mt-1 text-sm text-amber-50/90">
              From Wikiloc · Komoot · AllTrails · GPS device
            </div>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40 backdrop-blur transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
            </svg>
          </div>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/octet-stream"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {trails && trails.length > 0 && (
        <div className="mt-5 mb-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trails…"
              className="w-full rounded-full bg-surface py-2.5 pl-9 pr-4 text-sm shadow-sm ring-1 ring-app placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}

      <section className="mt-6">
        {trails == null ? (
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[88px] animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60"
              />
            ))}
          </ul>
        ) : trails.length === 0 ? (
          <EmptyState />
        ) : filtered && filtered.length === 0 ? (
          <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-app">
            <p className="font-display text-base font-semibold">No matches</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Try a different search.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered?.map((t) => (
              <li key={t.id}>
                <TrailCard trail={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-surface px-6 py-10 text-center shadow-sm ring-1 ring-app">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-black/5 dark:ring-white/10">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7l9-4 9 4-9 4z" />
          <path d="M3 12l9 4 9-4" />
          <path d="M3 17l9 4 9-4" />
        </svg>
      </div>
      <p className="font-display text-base font-semibold">No trails yet</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Tap the orange button above to import a GPX file.
      </p>
      <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-left text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="mb-1 font-semibold text-zinc-700 dark:text-zinc-300">Where to find GPX files:</p>
        <ul className="space-y-1">
          <li>
            <span className="font-medium">Wikiloc</span> · free account, 10 downloads/month
          </li>
          <li>
            <span className="font-medium">Komoot</span> · public routes are downloadable
          </li>
          <li>
            <span className="font-medium">caminsdetramuntana.com</span> · official Tramuntana routes
          </li>
          <li>
            <span className="font-medium">AllTrails / Strava routes</span> · export from any saved trail
          </li>
        </ul>
      </div>
    </div>
  );
}
