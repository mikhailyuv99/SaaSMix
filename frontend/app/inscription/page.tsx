"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function InscriptionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
      // Inscription réussie : on envoie vers la connexion (le register ne renvoie pas de token dans cette API, juste l'user)
      // En fait le register renvoie UserResponse (id, email), pas de token. Donc on redirige vers connexion pour qu'il se connecte.
      router.push("/connexion?inscrit=1");
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm">
        <h1 className="text-xl font-medium text-white mb-1 text-center">Inscription</h1>
        <p className="text-tagline text-slate-400 text-center text-[10px] mb-6">Créer un compte</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-tagline text-slate-400 text-[10px] mb-1">E-mail</label>
            <input
              id="email"
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
            <label htmlFor="password" className="block text-tagline text-slate-400 text-[10px] mb-1">Mot de passe (8 caractères min.)</label>
            <input
              id="password"
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
        <p className="text-tagline text-slate-400 text-center text-[10px] mt-4">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="text-slate-400 hover:text-white underline">Connexion</Link>
        </p>
      </div>
      <Link href="/" className="text-tagline text-slate-400 text-[10px] mt-6 hover:text-white">← Retour à l'accueil</Link>
    </div>
  );
}
