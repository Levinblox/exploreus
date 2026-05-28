"use client";

import { useEffect } from "react";
import { apiFetch, getAuthToken, hasApi, tryApi } from "@/lib/api";
import { replaceLocalUserTrails } from "@/lib/userTrails";
import { replaceLocalSettings, type MapStyle } from "@/lib/userSettings";
import type { Trail } from "@/lib/types";

// The server is the source of truth. This pulls canonical trail + settings
// state into the local cache (which drives the synchronous reads in
// userTrails/userSettings). It deliberately does NOT push local hikes — doing
// so on every launch resurrected deletes, because a stale localStorage copy
// would re-upload a hike another device had already removed. Hikes are written
// straight to the server on save/delete and read fresh via listHikes().
export function SyncBootstrap() {
  useEffect(() => {
    if (!hasApi() || !getAuthToken()) return;
    void run();
  }, []);
  return null;
}

let started = false;

async function run() {
  if (started) return;
  started = true;

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
}
