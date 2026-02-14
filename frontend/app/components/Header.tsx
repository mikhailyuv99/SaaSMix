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
          className="font-heading flex items-center gap-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl shrink-0 transition-colors hover:text-white/90"
        >
          <span>SIBERIA</span>
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2 L22 12 L12 22 L2 12 Z" />
          </svg>
          <span>MIX</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-8 flex-wrap sm:flex-nowrap">
          {isHome && (
            <>
              <a href="#tarifs" className="text-sm text-white/90 transition-colors hover:text-white">
                Tarifs
              </a>
              <a href="#faq-contact" className="text-sm text-white/90 transition-colors hover:text-white">
                FAQ & Contact
              </a>
            </>
          )}
          {!isHome && (
            <Link href="/" className="text-sm text-white/90 transition-colors hover:text-white">
              Accueil
            </Link>
          )}
          <Link href="/connexion" className="text-sm text-white/90 transition-colors hover:text-white shrink-0">
            Connexion
          </Link>
          <Link href="/inscription" className="text-sm text-white/90 transition-colors hover:text-white shrink-0">
            Inscription
          </Link>
        </div>
      </div>
    </header>
  );
}
