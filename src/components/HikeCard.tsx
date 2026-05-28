import Link from "next/link";
import { RoutePreview } from "./RoutePreview";
import { formatDistance, formatDuration } from "@/lib/geo";
import type { HikeSummary } from "@/lib/types";

export function HikeCard({ hike }: { hike: HikeSummary }) {
  return (
    <Link
      href={`/hike/?id=${encodeURIComponent(hike.id)}`}
      className="group flex items-center gap-4 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-app transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 via-amber-500/10 to-sky-500/10 ring-1 ring-black/5 dark:ring-white/5">
        <RoutePreview points={hike.preview} className="h-full w-full p-1.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {hike.name}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {new Date(hike.startedAt).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
          {" · "}
          {new Date(hike.startedAt).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatDistance(hike.distanceM)}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          {formatDuration(hike.durationMs)} · {Math.round(hike.elevationGainM)} m
        </div>
      </div>
      <svg
        className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
