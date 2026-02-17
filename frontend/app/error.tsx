"use client";

import { useEffect } from "react";

const isProd = process.env.NODE_ENV === "production";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client error:", error);
  }, [error]);

  const message = isProd
    ? "Une erreur inattendue s'est produite. Réessayez ou revenez à l'accueil."
    : (error.message || "Erreur côté client. Ouvre la console (F12) pour plus de détails.");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#060608] text-white font-sans">
      <h1 className="text-xl font-semibold text-white mb-2">Une erreur est survenue</h1>
      <p className="text-slate-400 text-sm mb-4 max-w-md text-center">
        {message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
