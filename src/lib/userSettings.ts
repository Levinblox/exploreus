import { apiFetch, hasApi, tryApi } from "./api";

const KEY = "exploreus.user.v1";

export type MapStyle = "outdoors" | "satellite" | "streets";

export type UserSettings = {
  name: string;
  mapStyle: MapStyle;
};

const DEFAULT: UserSettings = {
  name: "Levin Hansen",
  mapStyle: "outdoors",
};

function read(): UserSettings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

function write(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}

// Sync reads come from the cache. SyncBootstrap hydrates on app start.
export function getUserSettings(): UserSettings {
  return read();
}

export function updateUserName(name: string): UserSettings {
  const next = { ...read(), name: name.trim() || DEFAULT.name };
  write(next);
  pushSettings({ name: next.name });
  return next;
}

export function updateMapStyle(mapStyle: MapStyle): UserSettings {
  const next = { ...read(), mapStyle };
  write(next);
  pushSettings({ mapStyle });
  return next;
}

function pushSettings(patch: Partial<UserSettings>): void {
  if (!hasApi()) return;
  void tryApi(
    () =>
      apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    undefined
  );
}

// Used by SyncBootstrap to overwrite the local cache with server state.
export function replaceLocalSettings(s: Partial<UserSettings>): void {
  write({ ...read(), ...s });
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
