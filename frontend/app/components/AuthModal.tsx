"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../context";
import type { AuthModalMode } from "../context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "saas_mix_token";
const USER_KEY = "saas_mix_user";

export function AuthModal() {
  const searchParams = useSearchParams();
  const { setUser, setOpenAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  useEffect(() => {
    setOpenAuthModal((m) => {
      setIsOpen(true);
      setMode(m ?? "login");
      setError("");
      setRegisterSuccess(false);
    });
    return () => setOpenAuthModal(null);
  }, [setOpenAuthModal]);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login" || auth === "register") {
      setIsOpen(true);
      setMode(auth);
      setError("");
      setRegisterSuccess(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("inscrit");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, [searchParams]);

  const close = () => {
    setIsOpen(false);
    setError("");
    setRegisterSuccess(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-md p-4 max-lg:p-3"
      onClick={close}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 p-6 w-full max-w-sm relative max-lg:max-w-[calc(100vw-1.5rem)] max-lg:p-4 max-lg:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none"
          aria-label="Fermer"
        >
          &times;
        </button>

        {mode === "login" ? (
          <>
            <h2 className="text-xl font-medium text-white mb-1 text-center">Connexion</h2>
            <p className="text-tagline text-slate-400 text-center text-xs mb-6">Accéder à votre compte</p>
            {registerSuccess && (
              <p className="text-center text-green-400 text-sm mb-4">Compte créé. Connectez-vous.</p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(data.detail || "E-mail ou mot de passe incorrect.");
                    setLoading(false);
                    return;
                  }
                  if (data.access_token && data.user) {
                    if (typeof window !== "undefined") {
                      localStorage.setItem(TOKEN_KEY, data.access_token);
                      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                    }
                    setUser(data.user);
                    close();
                    setEmail("");
                    setPassword("");
                    setError("");
                    setRegisterSuccess(false);
                  }
                } catch {
                  setError("Impossible de joindre le serveur.");
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="auth-login-email" className="block text-tagline text-slate-400 text-xs mb-1">
                  E-mail
                </label>
                <input
                  id="auth-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                  placeholder="vous@exemple.com"
                />
              </div>
              <div>
                <label htmlFor="auth-login-password" className="block text-tagline text-slate-400 text-xs mb-1">
                  Mot de passe
                </label>
                <input
                  id="auth-login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
            <p className="text-tagline text-slate-400 text-center text-xs mt-4">
              Pas de compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Inscription
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-medium text-white mb-1 text-center">Inscription</h2>
            <p className="text-tagline text-slate-400 text-center text-xs mb-6">Créer un compte</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(data.detail || "Erreur lors de l'inscription.");
                    setLoading(false);
                    return;
                  }
                  setRegisterSuccess(true);
                  setMode("login");
                  setError("");
                } catch {
                  setError("Impossible de joindre le serveur.");
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="auth-register-email" className="block text-tagline text-slate-400 text-xs mb-1">
                  E-mail
                </label>
                <input
                  id="auth-register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                  placeholder="vous@exemple.com"
                />
              </div>
              <div>
                <label htmlFor="auth-register-password" className="block text-tagline text-slate-400 text-xs mb-1">
                  Mot de passe (8 caractères min.)
                </label>
                <input
                  id="auth-register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? "Création…" : "Créer mon compte"}
              </button>
            </form>
            <p className="text-tagline text-slate-400 text-center text-xs mt-4">
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Connexion
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
