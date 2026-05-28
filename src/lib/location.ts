import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location as BgLocation,
} from "@capacitor-community/background-geolocation";

// registerPlugin doesn't execute native code — it just wires up the bridge.
// Methods only get invoked behind the `isNative()` guard below.
const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type LocationFix = {
  lat: number;
  lng: number;
  alt: number | null;
  heading: number | null;
  accuracy: number | null;
  speed: number | null;
  t: number;
};

export type LocationError = { denied: boolean; message: string };

export type LocationWatcher = { stop: () => Promise<void> };

function isNative() {
  return Capacitor.getPlatform() !== "web";
}

export async function startLocationWatch(
  onFix: (fix: LocationFix) => void,
  onError: (err: LocationError) => void
): Promise<LocationWatcher> {
  if (isNative()) {
    return startNativeBackgroundWatch(onFix, onError);
  }
  return startWebWatch(onFix, onError);
}

async function startNativeBackgroundWatch(
  onFix: (fix: LocationFix) => void,
  onError: (err: LocationError) => void
): Promise<LocationWatcher> {
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: "Recording your hike location.",
      backgroundTitle: "Exploreus is recording your hike",
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    },
    (location: BgLocation | undefined, error: CallbackError | undefined) => {
      if (error) {
        const denied = error.code === "NOT_AUTHORIZED";
        onError({
          denied,
          message: error.message || (denied ? "Location permission denied" : "Location error"),
        });
        if (denied) {
          void BackgroundGeolocation.openSettings();
        }
        return;
      }
      if (!location) return;
      onFix({
        lat: location.latitude,
        lng: location.longitude,
        alt: location.altitude ?? null,
        heading: location.bearing ?? null,
        accuracy: location.accuracy ?? null,
        speed: location.speed ?? null,
        t: location.time ?? Date.now(),
      });
    }
  );

  return {
    stop: async () => {
      await BackgroundGeolocation.removeWatcher({ id });
    },
  };
}

async function startWebWatch(
  onFix: (fix: LocationFix) => void,
  onError: (err: LocationError) => void
): Promise<LocationWatcher> {
  try {
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") {
      onError({ denied: true, message: "Location permission denied" });
      return { stop: async () => {} };
    }
  } catch {
    // Browser handles permission via the prompt on first watchPosition.
  }

  const id = await Geolocation.watchPosition(
    { enableHighAccuracy: true, timeout: 30_000 },
    (pos, err) => {
      if (err) {
        const message =
          typeof err === "string"
            ? err
            : (err as { message?: string }).message ?? "Location error";
        const denied = /denied|permission/i.test(message);
        onError({ denied, message });
        return;
      }
      if (!pos) return;
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        alt: pos.coords.altitude,
        heading: pos.coords.heading,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        t: pos.timestamp,
      });
    }
  );

  return {
    stop: async () => {
      await Geolocation.clearWatch({ id });
    },
  };
}
