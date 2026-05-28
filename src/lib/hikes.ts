import type { Hike, HikeSummary } from "./types";
import {
  deleteHikeLocal,
  getHikeLocal,
  listHikesFullLocal,
  listHikesLocal,
  saveHikeLocal,
} from "./storage";
import { apiFetch, hasApi, tryApi } from "./api";

// Reads come from the API when configured + reachable, with localStorage as
// the offline fallback. Writes always go to localStorage immediately (so the
// UI is responsive offline) and are best-effort mirrored to the API.
// SyncBootstrap reconciles on app start.

export async function saveHike(hike: Hike): Promise<void> {
  saveHikeLocal(hike);
  if (hasApi()) {
    await tryApi(
      () =>
        apiFetch("/api/hikes", {
          method: "POST",
          body: JSON.stringify(hike),
        }),
      undefined
    );
  }
}

export async function listHikes(): Promise<HikeSummary[]> {
  if (hasApi()) {
    const remote = await tryApi<HikeSummary[] | null>(
      () => apiFetch<HikeSummary[]>("/api/hikes"),
      null
    );
    if (remote) return remote;
  }
  return listHikesLocal();
}

export async function listHikesFull(): Promise<Hike[]> {
  if (hasApi()) {
    const remote = await tryApi<Hike[] | null>(
      () => apiFetch<Hike[]>("/api/hikes/full"),
      null
    );
    if (remote) return remote;
  }
  return listHikesFullLocal();
}

export async function getHike(id: string): Promise<Hike | null> {
  if (hasApi()) {
    const remote = await tryApi<Hike | null>(
      () => apiFetch<Hike>(`/api/hikes/${encodeURIComponent(id)}`),
      null
    );
    if (remote) {
      saveHikeLocal(remote);
      return remote;
    }
  }
  return getHikeLocal(id);
}

export async function deleteHike(id: string): Promise<void> {
  deleteHikeLocal(id);
  if (hasApi()) {
    await tryApi(
      () =>
        apiFetch(`/api/hikes/${encodeURIComponent(id)}`, { method: "DELETE" }),
      undefined
    );
  }
}
