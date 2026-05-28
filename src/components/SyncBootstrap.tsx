"use client";

import { useEffect } from "react";
import { apiFetch, hasApi, tryApi } from "@/lib/api";
import { listHikesFullLocal } from "@/lib/storage";
import { replaceLocalUserTrails } from "@/lib/userTrails";
import { replaceLocalSettings, type MapStyle } from "@/lib/userSettings";
import type { Hike, Trail } from "@/lib/types";

// Runs once on mount. Pushes anything in localStorage up to the API (idempotent
// upserts) then pulls the canonical state down to keep the cache fresh.
// If the API is unreachable the app keeps working in local-only mode.
export function SyncBootstrap() {
  useEffect(() => {
    if (!hasApi()) return;
    void run();
  }, []);
  return null;
}

let started = false;

async function run() {
  if (started) return;
  started = true;

  // 1. Push local hikes to the server (POST is upsert).
  const localHikes = listHikesFullLocal();
  for (const h of localHikes) {
    await tryApi(
      () => apiFetch("/api/hikes", { method: "POST", body: JSON.stringify(h) }),
      undefined
    );
  }

  // 2. Pull canonical data and update the local caches that drive sync reads.
  const trails = await tryApi<Trail[] | null>(
    () => apiFetch<Trail[]>("/api/user-trails"),
    null
  );
  if (trails) replaceLocalUserTrails(trails);

  const settings = await tryApi<{ name: string; mapStyle: MapStyle } | null>(
    () => apiFetch("/api/settings"),
    null
  );
  if (settings) replaceLocalSettings(settings);

  // Hikes are read async via listHikes()/getHike() so they pull fresh on demand —
  // no need to mirror server state into the hike cache here.
}
