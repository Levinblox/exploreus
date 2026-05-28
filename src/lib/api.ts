import { getDeviceId } from "./identity";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const TOKEN_KEY = "exploreus.token.v1";

export function hasApi(): boolean {
  return BASE.length > 0;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL not configured");
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  // Prefer JWT; include X-Device-Id so the server can still serve unauth'd
  // requests during the migration window.
  if (token) headers.Authorization = `Bearer ${token}`;
  else headers["X-Device-Id"] = getDeviceId();

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    // Surface server-provided message when present.
    let detail = "";
    try {
      const j = (await res.clone().json()) as { error?: string };
      if (j.error) detail = ` — ${j.error}`;
    } catch {
      // body wasn't json, ignore
    }
    throw new Error(`API ${res.status} on ${path}${detail}`);
  }
  return res.json() as Promise<T>;
}

// Best-effort: swallows errors and returns a fallback. Use for non-critical
// background syncs where offline behavior is acceptable.
export async function tryApi<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
