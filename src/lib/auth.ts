import { apiFetch, setAuthToken } from "./api";
import { getDeviceId } from "./identity";

export type Activity =
  | "hiking"
  | "trail-running"
  | "cycling"
  | "climbing"
  | "skiing"
  | "walking";

export const ACTIVITIES: { value: Activity; label: string; emoji: string }[] = [
  { value: "hiking", label: "Hiking", emoji: "🥾" },
  { value: "trail-running", label: "Trail running", emoji: "🏃" },
  { value: "cycling", label: "Cycling", emoji: "🚵" },
  { value: "climbing", label: "Climbing", emoji: "🧗" },
  { value: "skiing", label: "Skiing", emoji: "⛷️" },
  { value: "walking", label: "Walking", emoji: "🚶" },
];

export type AuthUser = {
  id: string;
  username: string;
  age: number | null;
  activities: Activity[];
  name: string;
  mapStyle: "outdoors" | "satellite" | "streets";
};

export type AuthResponse = { token: string; userId: string };

export async function signup(input: {
  username: string;
  password: string;
  age?: number | null;
  activities: Activity[];
}): Promise<AuthUser> {
  const res = await apiFetch<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      // Hand the device id over so the server can adopt any existing
      // anonymous rows for this device under the new account.
      deviceId: getDeviceId(),
    }),
  });
  setAuthToken(res.token);
  return loadMe();
}

export async function login(input: {
  username: string;
  password: string;
}): Promise<AuthUser> {
  const res = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthToken(res.token);
  return loadMe();
}

export async function loadMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

export function logout(): void {
  setAuthToken(null);
}
