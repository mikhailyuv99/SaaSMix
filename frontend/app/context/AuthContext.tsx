"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const USER_KEY = "saas_mix_user";
const TOKEN_KEY = "saas_mix_token";

export type AuthUser = { id: string; email: string } | null;

type AuthContextValue = {
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return;
    try {
      const u = JSON.parse(raw) as AuthUser;
      if (u?.id && u?.email) setUserState(u);
    } catch {
      // ignore
    }
  }, []);

  const setUser = useCallback((u: AuthUser) => {
    setUserState(u);
    window.dispatchEvent(new CustomEvent("saas_mix_auth_change"));
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    setUserState(null);
    window.dispatchEvent(new CustomEvent("saas_mix_auth_change"));
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
