import { Capacitor, registerPlugin } from "@capacitor/core";

// Bridge to the native iOS Live Activity (lock screen / Dynamic Island). The
// native plugin is added in the Xcode project; until it exists these calls are
// safe no-ops, so the web build and Android are unaffected.

export type LiveActivityUpdate = {
  /** "1:23:45" */
  elapsed: string;
  /** "4.20 km" */
  distance: string;
  /** "2.10 km" — only when following a saved trail */
  remaining?: string;
  /** 0–1 along the followed trail (0 when not following) */
  progress: number;
  /** Recorded track so far, for the mini-map. */
  track: { lat: number; lng: number }[];
  /** Current position, for the mini-map marker. */
  current?: { lat: number; lng: number };
};

interface LiveActivityPlugin {
  start(options: { title: string }): Promise<{ status?: string }>;
  update(options: {
    elapsed: string;
    distance: string;
    remaining?: string;
    progress: number;
    trackJson: string;
    curLat?: number;
    curLng?: number;
  }): Promise<void>;
  end(): Promise<void>;
}

const Plugin = registerPlugin<LiveActivityPlugin>("LiveActivity");

// Live Activities are iOS-only (16.2+). Elsewhere everything no-ops.
const supported = Capacitor.getPlatform() === "ios";

// Returns a short status so the UI can surface why a Live Activity didn't show
// (e.g. "started", "activities-disabled-in-settings", "no-plugin: ...").
export async function startHikeActivity(title: string): Promise<string> {
  if (!supported) return "not-ios";
  try {
    const r = await Plugin.start({ title });
    return r?.status ?? "started";
  } catch (e) {
    return "no-plugin: " + (e instanceof Error ? e.message : String(e));
  }
}

export async function updateHikeActivity(u: LiveActivityUpdate): Promise<void> {
  if (!supported) return;
  try {
    await Plugin.update({
      elapsed: u.elapsed,
      distance: u.distance,
      remaining: u.remaining,
      progress: u.progress,
      trackJson: JSON.stringify(u.track),
      curLat: u.current?.lat,
      curLng: u.current?.lng,
    });
  } catch {
    // ignore
  }
}

export async function endHikeActivity(): Promise<void> {
  if (!supported) return;
  try {
    await Plugin.end();
  } catch {
    // ignore
  }
}
