import { getDeviceId } from "./identity";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function hasApi(): boolean {
  return BASE.length > 0;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL not configured");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": getDeviceId(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
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
