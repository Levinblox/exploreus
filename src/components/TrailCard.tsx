import Link from "next/link";
import { RoutePreview } from "./RoutePreview";
import { formatDistance } from "@/lib/geo";
import { networkLabel } from "@/lib/trails";
import type { TrailSummary } from "@/lib/types";

const NETWORK_STYLES: Record<string, string> = {
  nwn: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  rwn: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  lwn: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  iwn: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
};

export function TrailCard({ trail }: { trail: TrailSummary }) {
  const badge = NETWORK_STYLES[trail.network ?? ""] ?? NETWORK_STYLES.lwn;
  return (
    <Link
      href={`/trail/?id=${encodeURIComponent(trail.id)}`}
      className="group flex items-center gap-4 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-app transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 via-emerald-500/10 to-sky-500/15 ring-1 ring-black/5 dark:ring-white/5">
        <RoutePreview points={trail.preview} className="h-full w-full p-1.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {trail.source === "uploaded" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
              </svg>
              Imported
            </span>
          )}
          {trail.featured && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 2l2.95 6.6 7.05.8-5.3 4.85L18.1 22 12 18.27 5.9 22l1.4-7.75L2 9.4l7.05-.8z" /></svg>
              Featured
            </span>
          )}
          {trail.ref && (
            <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {trail.ref}
            </span>
          )}
          {trail.network && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
              {networkLabel(trail.network)}
            </span>
          )}
        </div>
        <div className="mt-1 truncate font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {trail.name}
        </div>
        {(trail.from || trail.to) && (
          <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {trail.from && trail.to ? `${trail.from} → ${trail.to}` : trail.from || trail.to}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="font-display text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatDistance(trail.distanceM)}
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
