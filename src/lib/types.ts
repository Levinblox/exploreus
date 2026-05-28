export type GeoPoint = {
  lat: number;
  lng: number;
  alt: number | null;
  t: number;
};

export type Hike = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  distanceM: number;
  elevationGainM: number;
  points: GeoPoint[];
  movingMs?: number;
  restMs?: number;
};

export type HikeSummary = Omit<Hike, "points"> & {
  preview: { lat: number; lng: number }[];
};

export type LatLng = { lat: number; lng: number };

export type Trail = {
  id: string;
  name: string;
  ref: string | null;
  network: string | null;
  from: string | null;
  to: string | null;
  distanceM: number;
  start: LatLng;
  preview: LatLng[];
  segments: LatLng[][];
  featured?: boolean;
  source?: "bundled" | "uploaded";
};

export type TrailSummary = Omit<Trail, "segments">;

export type Media = {
  id: string;
  kind: "photo" | "video";
  storageKey: string;
  url: string;
  /** Poster frame for videos (generated server-side). Null until transcode finishes. */
  posterUrl?: string | null;
  contentType?: string | null;
  caption?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

export type MediaParentKind = "user_trail" | "hike";
