"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { hasApi, getAuthToken } from "@/lib/api";
import { loadMe, logout as doLogout, type AuthUser } from "@/lib/auth";
import { clearHikesLocal } from "@/lib/storage";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!hasApi() || !getAuthToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await loadMe();
      setUser(me);
    } catch {
      // Token invalid/expired — clear it and bounce to /auth.
      doLogout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    doLogout();
    // Drop the local hike cache so the next account doesn't inherit it.
    clearHikesLocal();
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
