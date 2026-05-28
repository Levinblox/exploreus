import { getUserTrail, listUserTrails } from "./userTrails";
import type { Trail, TrailSummary } from "./types";

let bundledCache: Trail[] | null = null;
let inflight: Promise<Trail[]> | null = null;

async function loadBundled(): Promise<Trail[]> {
  if (bundledCache) return bundledCache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/data/trails-mallorca.json");
      if (!res.ok) throw new Error(`Failed to load trails: ${res.status}`);
      const data = (await res.json()) as Trail[];
      bundledCache = data.map((t) => ({ ...t, source: "bundled" as const }));
      inflight = null;
      return bundledCache;
    } catch {
      bundledCache = [];
      inflight = null;
      return bundledCache;
    }
  })();
  return inflight;
}

export async function listTrails(): Promise<TrailSummary[]> {
  const [bundled, user] = await Promise.all([loadBundled(), Promise.resolve(listUserTrails())]);
  return [...user, ...bundled].map(({ segments: _s, ...rest }) => rest);
}

export async function getTrail(id: string): Promise<Trail | null> {
  const user = getUserTrail(id);
  if (user) return { ...user, source: "uploaded" };
  const bundled = await loadBundled();
  return bundled.find((t) => t.id === id) ?? null;
}

export function invalidateTrailsCache() {
  bundledCache = null;
}

export function networkLabel(network: string | null): string {
  switch (network) {
    case "iwn":
      return "International";
    case "nwn":
      return "National";
    case "rwn":
      return "Regional";
    case "lwn":
      return "Local";
    default:
      return "Other";
  }
}
