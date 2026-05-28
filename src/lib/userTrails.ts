import type { Trail } from "./types";
import { apiFetch, hasApi, tryApi } from "./api";

const KEY = "exploreus.userTrails.v1";

function readAll(): Trail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Trail[];
  } catch {
    return [];
  }
}

function writeAll(trails: Trail[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(trails));
}

// Sync reads come from the local cache. SyncBootstrap hydrates the cache from
// the API on app start; writes mirror to the API in the background.
export function listUserTrails(): Trail[] {
  return readAll().sort((a, b) => {
    const aTs = parseInt(a.id.split("-")[1] ?? "0", 10);
    const bTs = parseInt(b.id.split("-")[1] ?? "0", 10);
    return bTs - aTs;
  });
}

export function getUserTrail(id: string): Trail | null {
  return readAll().find((t) => t.id === id) ?? null;
}

export function saveUserTrail(trail: Trail): void {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === trail.id);
  if (idx >= 0) all[idx] = trail;
  else all.unshift(trail);
  writeAll(all);
  pushTrail(trail);
}

export function deleteUserTrail(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id));
  if (hasApi()) {
    void tryApi(
      () =>
        apiFetch(`/api/user-trails/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
      undefined
    );
  }
}

export function renameUserTrail(id: string, name: string): void {
  const all = readAll();
  const t = all.find((x) => x.id === id);
  if (!t) return;
  t.name = name;
  writeAll(all);
  pushTrail(t);
}

// Fire-and-forget. We don't await — callers stay sync.
function pushTrail(trail: Trail): void {
  if (!hasApi()) return;
  void tryApi(
    () =>
      apiFetch("/api/user-trails", {
        method: "POST",
        body: JSON.stringify(trail),
      }),
    undefined
  );
}

// Used by SyncBootstrap to replace local cache with server state.
export function replaceLocalUserTrails(trails: Trail[]): void {
  writeAll(trails);
}
