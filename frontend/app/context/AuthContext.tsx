"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const USER_KEY = "saas_mix_user";
const TOKEN_KEY = "saas_mix_token";

export type AuthUser = { id: string; email: string } | null;

export type AuthModalMode = "login" | "register";

type AuthContextValue = {
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  logout: () => void;
  /** When on /mix, the mix page sets this so the header can open the auth modal instead of navigating. */
  openAuthModal: ((mode?: AuthModalMode) => void) | null;
  setOpenAuthModal: (fn: ((mode?: AuthModalMode) => void) | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser>(null);
  const [openAuthModalState, setOpenAuthModalState] = useState<((mode?: AuthModalMode) => void) | null>(null);

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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("saas_mix_auth_change"));
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent("saas_mix_auth_change"));
    }
    setUserState(null);
  }, []);

  const setOpenAuthModal = useCallback((fn: ((mode?: AuthModalMode) => void) | null) => {
    setOpenAuthModalState(() => fn);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, logout, openAuthModal: openAuthModalState, setOpenAuthModal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
