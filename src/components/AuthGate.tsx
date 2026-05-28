"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { hasApi } from "@/lib/api";
import { useAuth } from "./AuthProvider";

// Forces auth on every route except /auth itself. Without an API configured
// the app falls back to the legacy device-id flow so dev / offline still work.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const onAuthRoute = pathname.startsWith("/auth");

  useEffect(() => {
    if (!hasApi()) return; // offline / no-server mode — let through
    if (loading) return;
    if (!user && !onAuthRoute) {
      router.replace("/auth/");
    } else if (user && onAuthRoute) {
      router.replace("/");
    }
  }, [user, loading, onAuthRoute, router]);

  if (!hasApi()) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }
  if (!user && !onAuthRoute) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
        Redirecting…
      </div>
    );
  }
  return <>{children}</>;
}
