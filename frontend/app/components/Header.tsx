"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context";
import { useLeaveWarning } from "../context/LeaveWarningContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useState, useEffect, useCallback } from "react";
import { PricingModal } from "./PricingModal";

const ManageSubscriptionModal = dynamic(
  () => import("./ManageSubscriptionModal").then((m) => ({ default: m.ManageSubscriptionModal })),
  { ssr: false }
);
const SubscriptionModal = dynamic(
  () => import("./SubscriptionModal").then((m) => ({ default: m.SubscriptionModal })),
  { ssr: false }
);

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, openAuthModal } = useAuth();
  const { hasUnsavedChanges, setShowLeaveModal, setLeaveIntent, setLeaveConfirmAction, showLeaveModal, leaveIntent, leaveConfirmAction, onBeforeLeave } = useLeaveWarning();
  const { isPro, openManageSubscription, setIsPro } = useSubscription();
  const isHome = pathname === "/";
  const isMix = pathname === "/mix";
  const [manageSubscriptionOpen, setManageSubscriptionOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [checkoutLabel, setCheckoutLabel] = useState<string | null>(null);
  const [pendingPlanAfterLogin, setPendingPlanAfterLogin] = useState<{ priceId: string; label: string } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const t = localStorage.getItem("saas_mix_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // Après connexion/inscription, ouvrir le paiement pour le plan choisi si pending
  useEffect(() => {
    if (user && pendingPlanAfterLogin) {
      setCheckoutPriceId(pendingPlanAfterLogin.priceId);
      setCheckoutLabel(pendingPlanAfterLogin.label);
      setSubscriptionModalOpen(true);
      setPendingPlanAfterLogin(null);
    }
  }, [user, pendingPlanAfterLogin]);

  const handleAccueilClick = (e: React.MouseEvent) => {
    if (isMix && hasUnsavedChanges) {
      e.preventDefault();
      setLeaveIntent("navigate");
      setShowLeaveModal(true);
    }
  };

  const handleLeaveConfirm = () => {
    onBeforeLeave?.();
    if (leaveIntent === "disconnect") {
      if (typeof window !== "undefined") sessionStorage.removeItem("saas_mix_tracks");
      logout();
    } else if (leaveIntent === "load_project") {
      leaveConfirmAction?.();
    } else {
      // Naviguer vers accueil sans sauvegarder : effacer les pistes pour que /mix reparte à zéro
      if (typeof window !== "undefined") sessionStorage.removeItem("saas_mix_tracks");
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
    if (user && isPro) {
      if (openManageSubscription) {
        openManageSubscription();
      } else {
        setManageSubscriptionOpen(true);
      }
    } else {
      setPricingModalOpen(true);
    }
  };

  const handlePricingSelectPlan = useCallback((priceId: string, planName: string) => {
    if (user) {
      setPricingModalOpen(false);
      setCheckoutPriceId(priceId);
      setCheckoutLabel(planName);
      setSubscriptionModalOpen(true);
    } else {
      setPendingPlanAfterLogin({ priceId, label: planName });
      setPricingModalOpen(false);
      openAuthModal?.("login");
    }
  }, [user, openAuthModal]);

  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<{ priceId: string; planName: string } | undefined>)?.detail;
      if (user && isPro) {
        setManageSubscriptionOpen(true);
      } else if (detail?.priceId && detail?.planName) {
        handlePricingSelectPlan(detail.priceId, detail.planName);
      } else {
        setPricingModalOpen(true);
      }
    };
    window.addEventListener("openPlanModal", open);
    return () => window.removeEventListener("openPlanModal", open);
  }, [user, isPro, handlePricingSelectPlan]);

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

  const [burgerOpen, setBurgerOpen] = useState(false);

  const closeBurger = () => setBurgerOpen(false);

  return (
    <>
      <header className="relative z-50 w-full bg-transparent">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 max-lg:flex-nowrap max-lg:py-3 max-lg:min-h-14">
          <>
            <Link
              href="/"
              className="font-heading max-lg:hidden flex items-center gap-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl shrink-0 transition-colors hover:text-white/90"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              <span>SIBERIA</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2 L22 12 L12 22 L2 12 Z" />
              </svg>
              <span>MIX</span>
            </Link>
            <Link
              href="/"
              onClick={handleAccueilClick}
              className="font-heading lg:hidden flex items-center gap-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl shrink-0 transition-colors hover:text-white/90"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              <span>SIBERIA</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2 L22 12 L12 22 L2 12 Z" />
              </svg>
              <span>MIX</span>
            </Link>
          </>

          {/* Desktop: nav + auth */}
          <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 sm:gap-6 flex-nowrap max-lg:hidden">
            {isHome && (
              <>
                <a href="#tarifs" className="text-sm text-white/90 transition-colors hover:text-white">Tarifs</a>
                <a href="#faq-contact" className="text-sm text-white/90 transition-colors hover:text-white">FAQ & Contact</a>
              </>
            )}
            {!isHome && (
              <Link href="/" onClick={handleAccueilClick} className="text-sm text-white/90 transition-colors hover:text-white">Accueil</Link>
            )}
            {!isHome && <a href={isMix ? "#faq-contact" : "/#faq-contact"} className="text-sm text-white/90 transition-colors hover:text-white">FAQ & Contact</a>}
            <button type="button" onClick={handlePlanClick} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 bg-transparent border-none cursor-pointer font-inherit p-0 uppercase">
              {user && isPro ? "GÉRER MON ABONNEMENT" : "CHOISIR UN PLAN"}
            </button>
          </nav>

          <div className="flex items-center gap-4 sm:gap-6 flex-nowrap shrink-0 max-lg:hidden">
            {user ? (
              <>
                <span className="text-sm text-white/90 truncate max-w-[140px] sm:max-w-[200px] uppercase" title={user.email}>{user.email}</span>
                <button type="button" onClick={handleLogoutClick} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 bg-transparent border-none cursor-pointer font-inherit p-0 uppercase">DÉCONNEXION</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => openAuthModal?.("login")} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 uppercase bg-transparent border-none cursor-pointer font-inherit p-0">CONNEXION</button>
                <button type="button" onClick={() => openAuthModal?.("register")} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 uppercase bg-transparent border-none cursor-pointer font-inherit p-0">INSCRIPTION</button>
              </>
            )}
          </div>

          {/* Mobile/tablet: burger button */}
          <button
            type="button"
            onClick={() => setBurgerOpen((o) => !o)}
            className="lg:hidden p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={burgerOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={burgerOpen}
          >
            {burgerOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Burger panel (mobile/tablet) - même style que le site : flou, pas noir plein */}
        {burgerOpen && (
          <div className="lg:hidden fixed inset-0 z-40 top-14 sm:top-16 bg-black/40 backdrop-blur-xl border-t border-white/10 overflow-y-auto">
            <nav className="flex flex-col p-4 gap-1 max-w-6xl mx-auto">
              {isHome && (
                <>
                  <a href="#tarifs" onClick={closeBurger} className="py-3 px-4 text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">Tarifs</a>
                  <a href="#faq-contact" onClick={closeBurger} className="py-3 px-4 text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">FAQ & Contact</a>
                </>
              )}
              {!isHome && (
                <Link
                  href="/"
                  onClick={(e) => {
                    if (isMix && hasUnsavedChanges) {
                      e.preventDefault();
                      setLeaveIntent("navigate");
                      setShowLeaveModal(true);
                      closeBurger();
                    } else {
                      closeBurger();
                    }
                  }}
                  className="py-3 px-4 text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase"
                >
                  Accueil
                </Link>
              )}
              {!isHome && <a href={isMix ? "#faq-contact" : "/#faq-contact"} onClick={closeBurger} className="py-3 px-4 text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">FAQ & Contact</a>}
              <button type="button" onClick={() => { handlePlanClick(); closeBurger(); }} className="py-3 px-4 text-left text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">
                {user && isPro ? "Gérer mon abonnement" : "Choisir un plan"}
              </button>
              <div className="border-t border-white/10 my-2" />
              {user ? (
                <>
                  <p className="py-2 px-4 text-slate-400 text-xs truncate" title={user.email}>{user.email}</p>
                  <button type="button" onClick={() => { handleLogoutClick(); closeBurger(); }} className="py-3 px-4 text-left text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">Déconnexion</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { openAuthModal?.("login"); closeBurger(); }} className="py-3 px-4 text-left text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">Connexion</button>
                  <button type="button" onClick={() => { openAuthModal?.("register"); closeBurger(); }} className="py-3 px-4 text-left text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">Inscription</button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {showLeaveModal && (
        <div className="modal-backdrop-dark fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md max-lg:p-3" aria-modal="true" role="dialog">
          <div className="modal-panel-dark rounded-2xl border border-white/15 backdrop-blur-xl shadow-xl shadow-black/20 p-6 w-full max-w-sm max-lg:p-4 max-lg:max-w-[calc(100vw-1.5rem)]">
            <p className="text-tagline text-slate-300 text-center text-sm mb-6">
              {isLeaveForDisconnect
                ? "Vous avez des modifications non sauvegardées. Se déconnecter quand même ?"
                : isLeaveForLoadProject
                  ? "Sans sauvegarde, votre progression actuelle ne sera pas enregistrée. Charger un autre projet peut faire perdre vos modifications. Continuer ?"
                  : "Quitter cette page sans sauvegarder ? Vous perdrez toute progression en cours. Continuer ?"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLeaveCancel}
                className="modal-btn-subtle flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 transition-colors text-sm"
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

      {user && manageSubscriptionOpen && (
        <ManageSubscriptionModal
          isOpen={manageSubscriptionOpen}
          onClose={() => setManageSubscriptionOpen(false)}
          getAuthHeaders={getAuthHeaders}
          onSubscriptionUpdated={async () => {
            try {
              const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
              const res = await fetch(`${API_BASE}/api/billing/me`, { headers: getAuthHeaders() });
              const data = await res.json().catch(() => ({}));
              if (data.isPro !== undefined) setIsPro(!!data.isPro);
            } catch {
              setIsPro(true);
            }
          }}
          onRequestCheckout={(priceId, planName) => {
            setManageSubscriptionOpen(false);
            setCheckoutPriceId(priceId);
            setCheckoutLabel(planName);
            setSubscriptionModalOpen(true);
          }}
        />
      )}
      <PricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        onSelectPlan={handlePricingSelectPlan}
      />
      {subscriptionModalOpen && (
        <SubscriptionModal
          isOpen={subscriptionModalOpen}
          onClose={() => {
          setSubscriptionModalOpen(false);
          setCheckoutPriceId(null);
          setCheckoutLabel(null);
        }}
        onNeedLogin={() => {
          setSubscriptionModalOpen(false);
          setCheckoutPriceId(null);
          setCheckoutLabel(null);
          openAuthModal?.("login");
        }}
        onSuccess={async () => {
          setSubscriptionModalOpen(false);
          setCheckoutPriceId(null);
          setCheckoutLabel(null);
          try {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
            const res = await fetch(`${API_BASE}/api/billing/me`, { headers: getAuthHeaders() });
            const data = await res.json().catch(() => ({}));
            if (data.isPro !== undefined) setIsPro(data.isPro);
          } catch {
            setIsPro(true);
          }
        }}
        getAuthHeaders={getAuthHeaders}
        initialPriceId={checkoutPriceId}
        initialLabel={checkoutLabel}
      />
      )}
    </>
  );
}
