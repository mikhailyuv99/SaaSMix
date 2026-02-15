"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context";
import { useLeaveWarning } from "../context/LeaveWarningContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useState } from "react";
import { ChoosePlanModal } from "./ChoosePlanModal";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, openAuthModal } = useAuth();
  const { hasUnsavedChanges, setShowLeaveModal, setLeaveIntent, setLeaveConfirmAction, showLeaveModal, leaveIntent, leaveConfirmAction } = useLeaveWarning();
  const { isPro, openManageSubscription } = useSubscription();
  const isHome = pathname === "/";
  const isMix = pathname === "/mix";
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const handleAccueilClick = (e: React.MouseEvent) => {
    if (isMix && hasUnsavedChanges) {
      e.preventDefault();
      setLeaveIntent("navigate");
      setShowLeaveModal(true);
    }
  };

  const handleLeaveConfirm = () => {
    if (leaveIntent === "disconnect") {
      logout();
    } else if (leaveIntent === "load_project") {
      leaveConfirmAction?.();
    } else {
      window.location.href = "/";
    }
    setLeaveConfirmAction(null);
    setShowLeaveModal(false);
    setLeaveIntent(null);
  };

  const handleLeaveCancel = () => {
    setLeaveConfirmAction(null);
    setShowLeaveModal(false);
    setLeaveIntent(null);
  };

  const handlePlanClick = () => {
    if (user && isPro && openManageSubscription) {
      openManageSubscription();
    } else if (user && isPro && !openManageSubscription) {
      router.push("/mix?open=manage");
    } else {
      setPlanModalOpen(true);
    }
  };

  const handleLogoutClick = () => {
    if (hasUnsavedChanges) {
      setLeaveIntent("disconnect");
      setShowLeaveModal(true);
    } else {
      logout();
    }
  };

  const isLeaveForDisconnect = leaveIntent === "disconnect";
  const isLeaveForLoadProject = leaveIntent === "load_project";

  return (
    <>
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
              <Link
                href="/"
                onClick={handleAccueilClick}
                className="text-sm text-white/90 transition-colors hover:text-white"
              >
                Accueil
              </Link>
            )}
            <button
              type="button"
              onClick={handlePlanClick}
              className="text-sm text-white/90 transition-colors hover:text-white shrink-0 bg-transparent border-none cursor-pointer font-inherit p-0 uppercase"
            >
              {user && isPro ? "GÉRER MON ABONNEMENT" : "CHOISIR UN PLAN"}
            </button>
            {user ? (
              <>
                <span className="text-sm text-white/90 truncate max-w-[140px] sm:max-w-[200px] uppercase" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="text-sm text-white/90 transition-colors hover:text-white shrink-0 bg-transparent border-none cursor-pointer font-inherit p-0 uppercase"
                >
                  DÉCONNEXION
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => openAuthModal?.("login")} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 uppercase bg-transparent border-none cursor-pointer font-inherit p-0">
                  CONNEXION
                </button>
                <button type="button" onClick={() => openAuthModal?.("register")} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 uppercase bg-transparent border-none cursor-pointer font-inherit p-0">
                  INSCRIPTION
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {showLeaveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md" aria-modal="true" role="dialog">
          <div className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 p-6 w-full max-w-sm">
            <p className="text-tagline text-slate-300 text-center text-sm mb-6">
              {isLeaveForDisconnect
                ? "Vous avez des modifications non sauvegardées. Se déconnecter quand même ?"
                : isLeaveForLoadProject
                  ? "Charger ce projet remplacera les pistes actuelles. Continuer ?"
                  : "Quitter cette page sans sauvegarder ? Vous perdrez toute progression en cours. Continuer ?"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLeaveCancel}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleLeaveConfirm}
                className="flex-1 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
              >
                {isLeaveForDisconnect ? "Se déconnecter" : "Continuer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChoosePlanModal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} />
    </>
  );
}
