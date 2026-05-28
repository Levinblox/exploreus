// A per-install random ID. The server uses it to scope rows to a user without
// a real login. Replace with proper auth when we add accounts.
const KEY = "exploreus.deviceId.v1";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (id && id.length >= 16) return id;
  id = (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).replace(/-/g, "");
  window.localStorage.setItem(KEY, id);
  return id;
}
