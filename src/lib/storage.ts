import type { GeoPoint, Hike, HikeSummary } from "./types";

const KEY = "exploreus.hikes.v1";

function readAll(): Hike[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Hike[];
  } catch {
    return [];
  }
}

function writeAll(hikes: Hike[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(hikes));
}

function downsample(points: GeoPoint[], max = 60): { lat: number; lng: number }[] {
  if (points.length <= max) return points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const step = (points.length - 1) / (max - 1);
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < max; i++) {
    const p = points[Math.round(i * step)];
    out.push({ lat: p.lat, lng: p.lng });
  }
  return out;
}

export function saveHikeLocal(hike: Hike): void {
  const all = readAll();
  const idx = all.findIndex((h) => h.id === hike.id);
  if (idx >= 0) all[idx] = hike;
  else all.unshift(hike);
  writeAll(all);
}

export function listHikesLocal(): HikeSummary[] {
  return readAll()
    .map(({ points, ...rest }) => ({
      ...rest,
      preview: downsample(points),
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function listHikesFullLocal(): Hike[] {
  return readAll().sort((a, b) => b.startedAt - a.startedAt);
}

export function getHikeLocal(id: string): Hike | null {
  return readAll().find((h) => h.id === id) ?? null;
}

export function deleteHikeLocal(id: string): void {
  writeAll(readAll().filter((h) => h.id !== id));
}
