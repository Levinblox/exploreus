"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AllHikesMap } from "@/components/AllHikesMap";
import { HikeCard } from "@/components/HikeCard";
import { useAuth } from "@/components/AuthProvider";
import { ACTIVITIES } from "@/lib/auth";
import { importGpxFilesAsHikes } from "@/lib/gpx";
import { listHikesFull } from "@/lib/hikes";
import {
  avgSpeedMps,
  formatDistance,
  formatDuration,
  formatSpeed,
} from "@/lib/geo";
import { initialsFor } from "@/lib/userSettings";
import type { Hike } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [hikes, setHikes] = useState<Hike[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ kind: "success" | "warn" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = user?.name ?? user?.username ?? "Hiker";
  const activityLabels = user
    ? user.activities
        .map((a) => ACTIVITIES.find((x) => x.value === a))
        .filter((x): x is (typeof ACTIVITIES)[number] => Boolean(x))
    : [];

  async function refresh() {
    setHikes(await listHikesFull());
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleLogout() {
    logout();
    router.replace("/auth/");
  }

  const loading = hikes === null;
  const list = hikes ?? [];
  const totalDistance = list.reduce((sum, h) => sum + h.distanceM, 0);
  const totalDuration = list.reduce((sum, h) => sum + h.durationMs, 0);
  const totalMoving = list.reduce((sum, h) => sum + (h.movingMs ?? h.durationMs), 0);
  const totalElev = list.reduce((sum, h) => sum + h.elevationGainM, 0);
  const avgSpeed = avgSpeedMps(totalDistance, totalMoving);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    setImportMessage(null);
    const { imported, failed, skippedNoTime } = await importGpxFilesAsHikes(files);
    setImporting(false);
    if (imported === 0 && failed > 0) {
      setImportMessage({ kind: "error", text: `Couldn't read ${failed} file${failed > 1 ? "s" : ""}. Check it's a valid GPX.` });
    } else if (failed > 0) {
      setImportMessage({ kind: "warn", text: `Added ${imported}, skipped ${failed} bad file${failed > 1 ? "s" : ""}.` });
    } else if (skippedNoTime > 0) {
      setImportMessage({ kind: "warn", text: `Added ${imported}. ${skippedNoTime} had no time data — duration & speed will show "—".` });
    } else {
      setImportMessage({ kind: "success", text: `Added ${imported} hike${imported > 1 ? "s" : ""}.` });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-8 pb-32 animate-fade-up">
      <header className="mb-6 flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 opacity-50 blur-md" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 font-display text-3xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-zinc-950">
            {initialsFor(name)}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold tracking-tight">
            @{user?.username ?? name}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {list.length} hike{list.length === 1 ? "" : "s"} · {formatDistance(totalDistance)} total
            {user?.age != null && <> · {user.age}</>}
          </p>
        </div>
      </header>

      {activityLabels.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {activityLabels.map((a) => (
            <span
              key={a.value}
              className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-app"
            >
              <span>{a.emoji}</span>
              <span>{a.label}</span>
            </span>
          ))}
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {name.split(" ")[0]}&rsquo;s Map of Trails
          </h2>
          {list.length > 0 && <span className="text-xs text-zinc-400">tap a trail</span>}
        </div>
        {loading ? (
          <div className="h-[280px] animate-pulse rounded-3xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ) : list.length === 0 ? (
          <div className="rounded-3xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-app">
            <p className="font-display text-base font-semibold">No hikes on the map yet</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Record a hike or import GPX files of past ones to fill the map.
            </p>
          </div>
        ) : (
          <div className="relative h-[300px] overflow-hidden rounded-3xl shadow-sm ring-1 ring-app">
            <AllHikesMap hikes={list} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/15 to-transparent" />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-md backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-300">
              {list.length} trail{list.length === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </section>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <BigStat label="Total distance" value={formatDistance(totalDistance)} />
        <BigStat label="Total time" value={formatDuration(totalDuration)} />
        <BigStat label="Elev. gain" value={`${Math.round(totalElev)} m`} />
        <BigStat label="Avg moving" value={formatSpeed(avgSpeed)} />
      </div>

      <Link
        href="/mockups/"
        className="mb-8 block rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm ring-1 ring-app dark:text-zinc-200"
      >
        Design preview · Direction arrows →
      </Link>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight">All hikes</h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
          {importing ? "Importing…" : "Import past hike"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml,application/octet-stream"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {importMessage && (
        <div
          className={`mb-3 rounded-2xl px-4 py-3 text-sm ${
            importMessage.kind === "success"
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : importMessage.kind === "warn"
                ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                : "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {importMessage.text}
        </div>
      )}

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[88px] animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </ul>
      ) : list.length === 0 ? (
        <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-app">
          <p className="font-display text-base font-semibold">No hikes yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Record one, or tap <span className="font-semibold text-emerald-600 dark:text-emerald-400">Import past hike</span> above.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((h) => (
            <li key={h.id}>
              <HikeCard
                hike={{
                  ...h,
                  preview: h.points
                    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 50)) === 0)
                    .map((p) => ({ lat: p.lat, lng: p.lng })),
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {user && (
        <button
          type="button"
          onClick={handleLogout}
          className="mt-10 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      )}
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
