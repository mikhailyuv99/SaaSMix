"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "saas_mix_token";
const USER_KEY = "saas_mix_user";

export default function ConnexionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inscrit = searchParams.get("inscrit");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm">
        <h1 className="text-xl font-medium text-white mb-1 text-center">Connexion</h1>
        <p className="text-tagline text-slate-500 text-center text-[10px] mb-6">Accéder à votre compte</p>
        {inscrit && <p className="text-center text-green-400 text-sm mb-4">Compte créé. Connectez-vous.</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-tagline text-slate-500 text-[10px] mb-1">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
              placeholder="vous@exemple.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-tagline text-slate-500 text-[10px] mb-1">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="text-tagline text-slate-500 text-center text-[10px] mt-4">
          Pas de compte ?{" "}
          <Link href="/inscription" className="text-slate-400 hover:text-white underline">Inscription</Link>
        </p>
      </div>
      <Link href="/" className="text-tagline text-slate-500 text-[10px] mt-6 hover:text-white">← Retour à l'accueil</Link>
    </div>
  );
}
