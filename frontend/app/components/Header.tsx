"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="relative z-50 w-full bg-transparent">
      <div className="mx-auto flex h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:h-16 sm:flex-nowrap sm:gap-6 sm:px-6">
        <Link
          href="/"
          className={`font-heading text-lg font-semibold tracking-tight sm:text-xl shrink-0 transition-colors ${
            isHome ? "text-slate-900 hover:text-slate-800" : "text-white hover:text-white/90"
          }`}
        >
          SIBERIA MIX
        </Link>

        <div className="flex items-center gap-4 sm:gap-8 flex-wrap sm:flex-nowrap">
          {isHome && (
            <>
              <a href="#tarifs" className={`text-sm transition-colors ${isHome ? "text-slate-800 hover:text-slate-900" : "text-white/90 hover:text-white"}`}>
                Tarifs
              </a>
              <a href="#faq-contact" className={`text-sm transition-colors ${isHome ? "text-slate-800 hover:text-slate-900" : "text-white/90 hover:text-white"}`}>
                FAQ & Contact
              </a>
            </>
          )}
          <Link
            href={isHome ? "/mix" : "/"}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
              isHome
                ? "border-slate-700 bg-white/20 text-slate-900 hover:bg-white/30 hover:border-slate-600"
                : "border-white/30 bg-transparent text-white hover:bg-white/10 hover:border-white/40"
            }`}
          >
            {isHome ? "Charger un fichier" : "Accueil"}
          </Link>
        </div>
      </div>
    </header>
  );
}
