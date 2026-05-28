"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { BottomNav } from "./BottomNav";

// Hides the bottom navigation on full-screen auth pages.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const onAuth = pathname.startsWith("/auth");
  return (
    <>
      <main className="flex flex-1 flex-col">{children}</main>
      {!onAuth && <BottomNav />}
    </>
  );
}
