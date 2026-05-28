import {
  elevationGainM,
  haversineMeters,
  movingTime,
  totalDistanceM,
} from "./geo";
import { saveHike } from "./hikes";
import { saveUserTrail } from "./userTrails";
import type { GeoPoint, Hike, LatLng, Trail } from "./types";

type ParsedPoint = {
  lat: number;
  lng: number;
  alt: number | null;
  t: number | null;
};

export type ParsedGpx = {
  name: string;
  segments: ParsedPoint[][];
  hasTime: boolean;
};

export function parseGpx(xml: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid GPX file");
  }

  const segments: ParsedPoint[][] = [];
  let name: string | null = null;

  for (const trk of Array.from(doc.getElementsByTagName("trk"))) {
    if (!name) name = trk.getElementsByTagName("name")[0]?.textContent?.trim() || null;
    for (const seg of Array.from(trk.getElementsByTagName("trkseg"))) {
      const pts = extractPoints(seg, "trkpt");
      if (pts.length >= 2) segments.push(pts);
    }
  }

  if (segments.length === 0) {
    for (const rte of Array.from(doc.getElementsByTagName("rte"))) {
      if (!name) name = rte.getElementsByTagName("name")[0]?.textContent?.trim() || null;
      const pts = extractPoints(rte, "rtept");
      if (pts.length >= 2) segments.push(pts);
    }
  }

  if (segments.length === 0) {
    throw new Error("No tracks or routes found in the GPX file");
  }

  const hasTime = segments.some((seg) => seg.some((p) => p.t != null));

  return { name: name || "Imported trail", segments, hasTime };
}

function extractPoints(parent: Element, tagName: string): ParsedPoint[] {
  const out: ParsedPoint[] = [];
  for (const pt of Array.from(parent.getElementsByTagName(tagName))) {
    const lat = parseFloat(pt.getAttribute("lat") || "");
    const lng = parseFloat(pt.getAttribute("lon") || "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const eleEl = pt.getElementsByTagName("ele")[0];
    const timeEl = pt.getElementsByTagName("time")[0];
    const altRaw = eleEl ? parseFloat(eleEl.textContent || "") : NaN;
    const timeRaw = timeEl?.textContent ? Date.parse(timeEl.textContent) : NaN;
    out.push({
      lat,
      lng,
      alt: Number.isFinite(altRaw) ? altRaw : null,
      t: Number.isFinite(timeRaw) ? timeRaw : null,
    });
  }
  return out;
}

function downsample(points: LatLng[], max: number): LatLng[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

export function gpxToTrail(parsed: ParsedGpx): Trail {
  const segmentsLL: LatLng[][] = parsed.segments.map((seg) =>
    seg.map((p) => ({ lat: p.lat, lng: p.lng }))
  );
  const flat = segmentsLL.flat();
  let distanceM = 0;
  for (const seg of segmentsLL) {
    for (let i = 1; i < seg.length; i++) {
      distanceM += haversineMeters(seg[i - 1], seg[i]);
    }
  }
  return {
    id: `gpx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: parsed.name,
    ref: null,
    network: null,
    from: null,
    to: null,
    distanceM: Math.round(distanceM),
    start: { lat: flat[0].lat, lng: flat[0].lng },
    preview: downsample(flat, 50),
    segments: segmentsLL,
    featured: false,
    source: "uploaded",
  };
}

export function gpxToHike(parsed: ParsedGpx): Hike {
  // Flatten all segments, fill missing timestamps with synthetic ones so
  // downstream stats logic (movingTime, polyline ordering) stays consistent.
  let synthT = Date.now() - parsed.segments.flat().length * 1000;
  const points: GeoPoint[] = [];
  for (const seg of parsed.segments) {
    for (const p of seg) {
      points.push({
        lat: p.lat,
        lng: p.lng,
        alt: p.alt,
        t: p.t ?? synthT,
      });
      synthT += 1000;
    }
  }
  if (points.length < 2) throw new Error("Not enough GPS points to make a hike");

  const startedAt = parsed.hasTime ? points[0].t : Date.now();
  const endedAt = parsed.hasTime ? points[points.length - 1].t : startedAt;
  const durationMs = parsed.hasTime ? endedAt - startedAt : 0;
  const distanceM = totalDistanceM(points);
  const elev = elevationGainM(points);
  const { movingMs, restMs } = parsed.hasTime
    ? movingTime(points)
    : { movingMs: 0, restMs: 0 };

  return {
    id: crypto.randomUUID(),
    name: parsed.name === "Imported trail" ? "Imported hike" : parsed.name,
    startedAt,
    endedAt,
    durationMs,
    distanceM: Math.round(distanceM),
    elevationGainM: Math.round(elev),
    points,
    movingMs: parsed.hasTime ? movingMs : undefined,
    restMs: parsed.hasTime ? restMs : undefined,
  };
}

export async function importGpxFilesAsHikes(
  files: FileList | File[]
): Promise<{ imported: number; failed: number; skippedNoTime: number }> {
  let imported = 0;
  let failed = 0;
  let skippedNoTime = 0;
  for (const file of Array.from(files)) {
    try {
      const text = await file.text();
      const parsed = parseGpx(text);
      if (parsed.name === "Imported trail") {
        parsed.name = file.name.replace(/\.gpx$/i, "");
      }
      const hike = gpxToHike(parsed);
      await saveHike(hike);
      imported++;
      if (!parsed.hasTime) skippedNoTime++;
    } catch (e) {
      console.warn("GPX hike import failed for", file.name, e);
      failed++;
    }
  }
  return { imported, failed, skippedNoTime };
}

export async function importGpxFilesAsTrails(
  files: FileList | File[]
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  for (const file of Array.from(files)) {
    try {
      const text = await file.text();
      const parsed = parseGpx(text);
      if (parsed.name === "Imported trail") {
        parsed.name = file.name.replace(/\.gpx$/i, "");
      }
      const trail = gpxToTrail(parsed);
      saveUserTrail(trail);
      imported++;
    } catch (e) {
      console.warn("GPX trail import failed for", file.name, e);
      failed++;
    }
  }
  return { imported, failed };
}
