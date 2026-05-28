import type { GeoPoint } from "./types";

const EARTH_RADIUS_M = 6_371_000;

type LatLngLike = { lat: number; lng: number };

export function haversineMeters(a: LatLngLike, b: LatLngLike): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export function totalDistanceM(points: GeoPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += haversineMeters(points[i - 1], points[i]);
  return sum;
}

// Sum of upward altitude deltas, ignoring noise below the threshold (m).
export function elevationGainM(points: GeoPoint[], minStepM = 1.5): number {
  let gain = 0;
  let last: number | null = null;
  for (const p of points) {
    if (p.alt == null) continue;
    if (last == null) {
      last = p.alt;
      continue;
    }
    const delta = p.alt - last;
    if (delta > minStepM) {
      gain += delta;
      last = p.alt;
    } else if (delta < -minStepM) {
      last = p.alt;
    }
  }
  return gain;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatElevation(m: number): string {
  return `${Math.round(m)} m`;
}

// Speed across the points captured in the last `lookbackS` seconds.
// Returns 0 when there isn't enough recent data to compute a rate.
export function currentSpeedMps(points: GeoPoint[], lookbackS = 10): number {
  if (points.length < 2) return 0;
  const last = points[points.length - 1];
  const cutoff = last.t - lookbackS * 1000;
  let fromIdx = points.length - 1;
  for (let i = points.length - 2; i >= 0; i--) {
    fromIdx = i;
    if (points[i].t <= cutoff) break;
  }
  if (fromIdx >= points.length - 1) return 0;
  let dist = 0;
  for (let i = fromIdx + 1; i < points.length; i++) {
    dist += haversineMeters(points[i - 1], points[i]);
  }
  const dtSec = (last.t - points[fromIdx].t) / 1000;
  if (dtSec <= 0) return 0;
  return dist / dtSec;
}

export function avgSpeedMps(distanceM: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return distanceM / (durationMs / 1000);
}

// Classifies each inter-point segment as moving or resting based on its speed,
// and returns the totals. Gaps larger than 30 s are ignored (e.g., GPS lost fix).
export function movingTime(
  points: GeoPoint[],
  thresholdMps = 0.5
): { movingMs: number; restMs: number } {
  let movingMs = 0;
  let restMs = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    if (dt <= 0 || dt > 30_000) continue;
    const d = haversineMeters(points[i - 1], points[i]);
    const speed = d / (dt / 1000);
    if (speed >= thresholdMps) movingMs += dt;
    else restMs += dt;
  }
  return { movingMs, restMs };
}

export function formatSpeed(mps: number): string {
  if (!Number.isFinite(mps) || mps <= 0) return "0.0 km/h";
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

// ───────── following a saved trail ─────────

// Cumulative along-path distance at each vertex (cum[0] = 0).
function cumulativeDistances(path: LatLngLike[]): number[] {
  const cum = new Array<number>(path.length);
  cum[0] = 0;
  for (let i = 1; i < path.length; i++) {
    cum[i] = cum[i - 1] + haversineMeters(path[i - 1], path[i]);
  }
  return cum;
}

export type TrailProgress = {
  /** Total length of the trail, metres. */
  totalM: number;
  /** Distance from the trail start to the point nearest you, metres. */
  coveredM: number;
  /** Distance from the point nearest you to the trail end, metres. */
  remainingM: number;
  /** 0–1 fraction of the way along the trail. */
  fraction: number;
  /** How far you are from the trail line, metres (off-route distance). */
  offRouteM: number;
};

// Where you are along a trail, by snapping your position to the nearest vertex
// of the trail's path. Assumes you're walking it start → end. Returns null if
// the path is too short to measure.
export function trailProgress(path: LatLngLike[], current: LatLngLike): TrailProgress | null {
  if (path.length < 2) return null;
  const cum = cumulativeDistances(path);
  const totalM = cum[cum.length - 1];
  if (totalM <= 0) return null;

  let nearestIdx = 0;
  let offRouteM = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversineMeters(current, path[i]);
    if (d < offRouteM) {
      offRouteM = d;
      nearestIdx = i;
    }
  }

  const coveredM = cum[nearestIdx];
  const remainingM = Math.max(0, totalM - coveredM);
  return {
    totalM,
    coveredM,
    remainingM,
    fraction: coveredM / totalM,
    offRouteM,
  };
}
