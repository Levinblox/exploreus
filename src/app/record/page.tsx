"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startLocationWatch, type LocationWatcher } from "@/lib/location";
import { MapView } from "@/components/MapView";
import {
  currentSpeedMps,
  elevationGainM,
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeed,
  haversineMeters,
  movingTime,
  totalDistanceM,
  trailProgress,
} from "@/lib/geo";
import { listHikesFull, saveHike } from "@/lib/hikes";
import { getTrail } from "@/lib/trails";
import {
  startHikeActivity,
  updateHikeActivity,
  endHikeActivity,
  type LiveActivityUpdate,
} from "@/lib/liveActivity";
import type { GeoPoint, Hike, Trail } from "@/lib/types";

type Status = "idle" | "recording" | "paused";

type UserLoc = {
  lat: number;
  lng: number;
  alt: number | null;
  heading: number | null;
  accuracy: number | null;
  t: number;
};

const DEFAULT_SIM_START = { lat: 47.0502, lng: 8.3093 }; // Lucerne, Switzerland
const MAX_TRACK_ACCURACY_M = 20;
// Reject GPS wobble: only record points that moved farther than the accuracy
// circle (or this floor, whichever is bigger).
const MIN_MOVEMENT_M = 4;

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
      <RecordInner />
    </Suspense>
  );
}

function RecordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const trailId = params.get("trail");
  const [followTrail, setFollowTrail] = useState<Trail | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [userLoc, setUserLoc] = useState<UserLoc | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [simulate, setSimulate] = useState(false);

  const statusRef = useRef<Status>("idle");
  statusRef.current = status;
  const watcherRef = useRef<LocationWatcher | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const lastLocRef = useRef<UserLoc | null>(null);
  const lastCompassTickRef = useRef(0);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [pastTracks, setPastTracks] = useState<GeoPoint[][]>([]);

  // Load the trail being followed (if we arrived via "Follow this trail").
  useEffect(() => {
    if (!trailId) {
      setFollowTrail(null);
      return;
    }
    let cancelled = false;
    getTrail(trailId).then((t) => !cancelled && setFollowTrail(t ?? null));
    return () => {
      cancelled = true;
    };
  }, [trailId]);

  // The followed trail's path, and a faint map overlay of it.
  const followPath = useMemo(
    () => (followTrail ? followTrail.segments.flat() : null),
    [followTrail]
  );
  const followTrack = useMemo<GeoPoint[] | null>(
    () => (followPath ? followPath.map((p) => ({ lat: p.lat, lng: p.lng, alt: null, t: 0 })) : null),
    [followPath]
  );

  const distanceM = totalDistanceM(points);
  const elevationM = elevationGainM(points);
  const speedMps = currentSpeedMps(points);
  const progress = followPath && userLoc ? trailProgress(followPath, userLoc) : null;
  const durationMs =
    startedAt != null
      ? (status === "paused" && pauseStartRef.current != null
          ? pauseStartRef.current
          : now) - startedAt - pausedMs
      : 0;

  // Latest stats for the iOS Live Activity. Kept in a ref so the push interval
  // below always reads current values without re-subscribing each second.
  const liveRef = useRef<LiveActivityUpdate | null>(null);
  liveRef.current = {
    elapsed: formatDuration(durationMs),
    distance: formatDistance(distanceM),
    remaining: progress ? formatDistance(progress.remainingM) : undefined,
    progress: progress?.fraction ?? 0,
    track: points.map((p) => ({ lat: p.lat, lng: p.lng })),
    current: userLoc ? { lat: userLoc.lat, lng: userLoc.lng } : undefined,
  };

  // Drive the lock-screen Live Activity for the length of a hike session.
  // iOS throttles updates, so we push every ~7s (no-op off iOS).
  const sessionActive = status !== "idle";
  const followName = followTrail?.name;
  useEffect(() => {
    if (!sessionActive) return;
    void startHikeActivity(followName ?? "Hike");
    const push = () => {
      if (liveRef.current) void updateHikeActivity(liveRef.current);
    };
    push();
    const id = setInterval(push, 7000);
    return () => {
      clearInterval(id);
      void endHikeActivity();
    };
  }, [sessionActive, followName]);

  // Location source: either real GPS or the fake walker.
  useEffect(() => {
    let cancelled = false;

    if (simulate) {
      const start = lastLocRef.current ?? DEFAULT_SIM_START;
      let lat = start.lat;
      let lng = start.lng;
      let alt = 500;
      let heading = Math.random() * 360;
      const speedMps = 1.4; // brisk walk

      const tick = () => {
        if (cancelled) return;
        heading += (Math.random() - 0.5) * 25;
        const rad = (heading * Math.PI) / 180;
        const dM = speedMps;
        const dLat = (dM * Math.cos(rad)) / 111_111;
        const dLng = (dM * Math.sin(rad)) / (111_111 * Math.cos((lat * Math.PI) / 180));
        lat += dLat;
        lng += dLng;
        alt += (Math.random() - 0.45) * 1.2;
        const u: UserLoc = {
          lat,
          lng,
          alt,
          heading: ((heading % 360) + 360) % 360,
          accuracy: 5,
          t: Date.now(),
        };
        lastLocRef.current = u;
        setUserLoc(u);
        if (statusRef.current === "recording") {
          setPoints((prev) => [...prev, { lat: u.lat, lng: u.lng, alt: u.alt, t: u.t }]);
        }
      };
      // Emit an immediate fix so the map centers right away.
      tick();
      const id = setInterval(tick, 1000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    // Real geolocation — background plugin on iOS, browser API on web.
    (async () => {
      try {
        const watcher = await startLocationWatch(
          (fix) => {
            if (cancelled) return;
            const u: UserLoc = {
              lat: fix.lat,
              lng: fix.lng,
              alt: fix.alt,
              heading: fix.heading,
              accuracy: fix.accuracy,
              t: fix.t,
            };
            lastLocRef.current = u;
            setUserLoc(u);
            const accurate =
              u.accuracy == null || u.accuracy <= MAX_TRACK_ACCURACY_M;
            if (statusRef.current === "recording" && accurate) {
              setPoints((prev) => {
                const next = { lat: u.lat, lng: u.lng, alt: u.alt, t: u.t };
                const last = prev[prev.length - 1];
                if (!last) return [next];
                const dist = haversineMeters(last, next);
                const minMove = Math.max(u.accuracy ?? 0, MIN_MOVEMENT_M);
                if (dist < minMove) return prev;
                return [...prev, next];
              });
            }
          },
          (err) => {
            if (cancelled) return;
            if (err.denied) setPermissionDenied(true);
            else setError(err.message);
          }
        );
        if (cancelled) {
          await watcher.stop();
        } else {
          watcherRef.current = watcher;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to start location.");
        }
      }
    })();

    return () => {
      cancelled = true;
      const w = watcherRef.current;
      watcherRef.current = null;
      if (w) void w.stop();
    };
  }, [simulate]);

  useEffect(() => {
    if (status !== "recording") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Pull past hikes once so we can render them as a faint underlay. Refreshed
  // when a recording finishes and the route changes away.
  useEffect(() => {
    let cancelled = false;
    listHikesFull().then((hikes) => {
      if (cancelled) return;
      setPastTracks(
        hikes
          .filter((h) => h.points.length > 1)
          .map((h) => h.points)
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Compass — magnetometer-based facing direction. Updates 10×/sec max.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceOrientationEvent) => {
      const wch = (e as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
      }).webkitCompassHeading;
      let heading: number | null = null;
      if (typeof wch === "number" && !Number.isNaN(wch)) {
        heading = wch;
      } else if (typeof e.alpha === "number") {
        heading = (360 - e.alpha) % 360;
      }
      if (heading == null) return;
      const now = Date.now();
      if (now - lastCompassTickRef.current < 100) return;
      lastCompassTickRef.current = now;
      setCompassHeading(heading);
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

  async function requestCompassPermission() {
    const DOE = (window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
    }).DeviceOrientationEvent;
    if (typeof DOE?.requestPermission === "function") {
      try {
        await DOE.requestPermission();
      } catch {
        // user declined or no compass — track will still work, no facing arrow.
      }
    }
  }

  function handleStart() {
    setError(null);
    void requestCompassPermission();
    const seed =
      userLoc &&
      (userLoc.accuracy == null || userLoc.accuracy <= MAX_TRACK_ACCURACY_M)
        ? [{ lat: userLoc.lat, lng: userLoc.lng, alt: userLoc.alt, t: userLoc.t }]
        : [];
    setPoints(seed);
    setPausedMs(0);
    pauseStartRef.current = null;
    setStartedAt(Date.now());
    setNow(Date.now());
    setStatus("recording");
  }

  function handlePause() {
    if (status !== "recording") return;
    pauseStartRef.current = Date.now();
    setStatus("paused");
  }

  function handleResume() {
    if (status !== "paused" || pauseStartRef.current == null) return;
    setPausedMs((ms) => ms + (Date.now() - (pauseStartRef.current ?? Date.now())));
    pauseStartRef.current = null;
    setStatus("recording");
  }

  async function handleStop() {
    if (status === "idle" || startedAt == null) return;
    const endedAt = Date.now();
    const finalPaused =
      status === "paused" && pauseStartRef.current != null
        ? pausedMs + (endedAt - pauseStartRef.current)
        : pausedMs;
    const { movingMs, restMs } = movingTime(points);
    const hike: Hike = {
      id: crypto.randomUUID(),
      name: defaultHikeName(),
      startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt - startedAt - finalPaused),
      distanceM: totalDistanceM(points),
      elevationGainM: elevationGainM(points),
      points,
      movingMs,
      restMs,
    };
    await saveHike(hike);
    router.push(`/hike/?id=${encodeURIComponent(hike.id)}`);
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <MapView
        points={points}
        userLocation={userLoc}
        compassHeading={compassHeading}
        backgroundTracks={followTrack ? [followTrack, ...pastTracks] : pastTracks}
        follow={true}
        styleControlPosition="top-left-offset"
        className="absolute inset-0"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <Link
          href="/"
          aria-label="Back"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md backdrop-blur dark:bg-zinc-900/95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        {status === "idle" ? (
          <div className="pointer-events-auto rounded-full bg-white/95 px-4 py-2 text-sm font-medium shadow-md backdrop-blur dark:bg-zinc-900/95">
            {simulate ? "Simulating" : userLoc ? "Ready" : "Finding your location…"}
          </div>
        ) : (
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md backdrop-blur ${
              status === "recording" ? "bg-red-600/95" : "bg-zinc-800/95"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full bg-white ${status === "recording" ? "animate-pulse" : ""}`}
            />
            {status === "recording" ? (simulate ? "Simulated" : "Recording") : "Paused"}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setSimulate((s) => !s);
            setPermissionDenied(false);
            setError(null);
          }}
          className={`pointer-events-auto flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-md backdrop-blur transition-colors ${
            simulate
              ? "bg-amber-500/95 text-white"
              : "bg-white/95 text-zinc-900 dark:bg-zinc-900/95 dark:text-zinc-100"
          }`}
          title="Fake a walker for testing"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13" cy="4" r="2" />
            <path d="m10 22 2-8 4 2-1 6" />
            <path d="m8 11 4-3 4 4 3 1" />
          </svg>
          {simulate ? "Sim on" : "Simulate"}
        </button>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-10 px-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-3xl rounded-[32px] bg-white/95 p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur-xl dark:bg-zinc-900/95 dark:ring-white/10">
          {permissionDenied && !simulate && (
            <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="font-semibold">Location is blocked.</div>
              <div className="mt-1 text-xs leading-relaxed">
                Click the lock icon in the address bar → set Location to <b>Allow</b> → reload.
                Or tap <b>Simulate</b> in the top-right to test with a fake walker.
              </div>
            </div>
          )}
          {error && !permissionDenied && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {followTrail && (
            <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                  Following · {followTrail.name}
                </span>
                {progress && (
                  <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {Math.round(progress.fraction * 100)}% done
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                {progress ? `${formatDistance(progress.remainingM)} to go` : "Waiting for GPS…"}
              </div>
              {progress && progress.offRouteM > 50 && (
                <div className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {formatDistance(progress.offRouteM)} off the trail
                </div>
              )}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/50">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
                  style={{ width: `${progress ? Math.min(100, progress.fraction * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-2 gap-y-3">
            <Stat label="Time" value={formatDuration(durationMs)} />
            <Stat label="Distance" value={formatDistance(distanceM)} />
            <Stat label="Speed" value={formatSpeed(speedMps)} />
            <Stat label="Elev. gain" value={formatElevation(elevationM)} />
          </div>

          <div className="mt-5 flex items-center gap-3">
            {status === "idle" && (
              <button
                type="button"
                onClick={handleStart}
                disabled={!userLoc}
                className="flex-1 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] active:bg-emerald-700 disabled:bg-zinc-300 disabled:shadow-none dark:disabled:bg-zinc-700"
              >
                {userLoc ? (simulate ? "Start simulated hike" : "Start hike") : "Waiting for GPS…"}
              </button>
            )}
            {status === "recording" && (
              <>
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 shadow-md active:scale-95 dark:bg-zinc-800 dark:text-zinc-100"
                  aria-label="Pause"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex-1 rounded-2xl bg-red-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] active:bg-red-700"
                >
                  Finish
                </button>
              </>
            )}
            {status === "paused" && (
              <>
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-red-300 text-base font-semibold text-red-700 active:bg-red-50 dark:border-red-900 dark:text-red-400 dark:active:bg-red-950/40"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleResume}
                  className="flex-1 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] active:bg-emerald-700"
                >
                  Resume
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-0.5 font-display text-2xl font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function defaultHikeName(): string {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return `${part} hike`;
}
