"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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
const TokensModal = dynamic(
  () => import("./TokensModal").then((m) => ({ default: m.TokensModal })),
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
  const [tokensModalOpen, setTokensModalOpen] = useState(false);

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
    const openTokens = () => setTokensModalOpen(true);
    window.addEventListener("openPlanModal", open);
    window.addEventListener("openTokensModal", openTokens);
    return () => {
      window.removeEventListener("openPlanModal", open);
      window.removeEventListener("openTokensModal", openTokens);
    };
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
              className="font-heading max-lg:hidden flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90"
            >
              <svg className="h-7 sm:h-8 w-auto shrink-0" viewBox="0 0 160 160" fill="none" aria-hidden>
                <defs>
                  <linearGradient id="logo-grad-d" x1="21.57" y1="88.38" x2="40.35" y2="69.6" gradientUnits="userSpaceOnUse">
                    <stop offset=".09" stopColor="#1e1d2c"/>
                    <stop offset=".5" stopColor="#5389e6"/>
                    <stop offset=".81" stopColor="#9dcffd"/>
                    <stop offset=".96" stopColor="#fff"/>
                  </linearGradient>
                </defs>
                <path fill="url(#logo-grad-d)" d="M43.13,75.37c.16.13.21.36.11.55l-8.31,15.38c-.09.17-.24.26-.4.26-.07,0-.16-.02-.22-.07-.22-.15-.32-.44-.22-.73l4.32-15.31c.04-.13.01-.27-.07-.37l-4.1-5.74c-.15-.21-.15-.51.02-.71.16-.21.41-.24.61-.07l8.26,6.83ZM34.04,75.88c.02-.13-.02-.29-.08-.4l-3.06-5.71c-.06-.13-.17-.2-.28-.2h0c-.11.01-.21.09-.28.2l-2.91,5.66c-.06.12-.07.26-.05.4l3.05,14.92c.04.21.17.34.32.34.15-.01.29-.14.32-.34l2.97-14.88ZM18.29,75.37c-.16.13-.21.36-.11.55l8.31,15.38c.09.17.24.26.4.26.07,0,.16-.02.22-.07.22-.15.32-.44.22-.73l-4.32-15.31c-.04-.13-.01-.27.07-.37l4.1-5.74c.15-.21.15-.51-.02-.71-.16-.21-.41-.24-.61-.07l-8.26,6.83Z"/>
                <g fill="#f2f4f7">
                  <path d="M55.8,78.19h-1.86c-1.54,0-2.39-.81-2.39-2.3s.81-2.17,2.39-2.17h6.05v-2.33h-5.72c-3.38,0-4.95,1.41-4.95,4.46s1.68,4.68,4.98,4.68h1.84c2.01,0,3.03.88,3.03,2.61s-1.05,2.68-3.03,2.68h-6.65v2.34h6.34c3.74,0,5.55-1.63,5.55-4.97s-1.83-4.99-5.57-4.99Z"/>
                  <path d="M64.69,71.38v.4l2.28,2.29v-2.7h-2.28ZM64.69,74.17v13.99h2.28v-11.7l-2.28-2.28Z"/>
                  <path d="M81.5,77.9l-.45-.11.42-.2c.91-.42,1.36-1.26,1.36-2.57,0-2.42-1.53-3.65-4.54-3.65h-7.67v16.77h8.18c3.78,0,5.63-1.78,5.63-5.44,0-2.7-.99-4.31-2.93-4.8ZM72.92,73.71h5.8c1.5,0,1.81.9,1.81,1.66s-.31,1.6-1.81,1.6h-5.8v-3.26ZM78.97,85.8h-6.06v-6.5h6.01c2.13,0,3.19,1.09,3.19,3.23s-1.06,3.27-3.15,3.27Z"/>
                  <path d="M97.77,73.72v-2.33h-10.08v16.77h9.93v-2.34h-7.63v-5.19l6.86.02v-2.34h-6.86v-4.59h7.78Z"/>
                  <path d="M109.58,82.76c3.37-.32,5.01-2.18,5.01-5.72,0-3.81-1.95-5.66-5.95-5.66h-7.88v16.77h2.31v-5.37h3.83l4.84,8.72h2.54l-4.95-8.72.25-.02ZM103.08,80.44v-6.73h5.9c2.26,0,3.4,1.13,3.4,3.36s-1.14,3.37-3.4,3.37h-5.9Z"/>
                  <path d="M118,74.13v14.03h2.28v-11.74l-2.28-2.28ZM118,71.38v.37l2.28,2.28v-2.66h-2.28Z"/>
                  <path d="M131.49,71.57l-8.73,16.57h2.6l1.27-2.69h9.86l3.03,6.05,2.33.06-10.37-19.99ZM127.71,83.11l3.88-6.84,3.85,6.84h-7.72Z"/>
                </g>
              </svg>
              <span className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: "#f2f4f7" }}>MIX</span>
            </Link>
            <Link
              href="/"
              onClick={handleAccueilClick}
              className="font-heading lg:hidden flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90"
            >
              <svg className="h-7 sm:h-8 w-auto shrink-0" viewBox="0 0 160 160" fill="none" aria-hidden>
                <defs>
                  <linearGradient id="logo-grad-m" x1="21.57" y1="88.38" x2="40.35" y2="69.6" gradientUnits="userSpaceOnUse">
                    <stop offset=".09" stopColor="#1e1d2c"/>
                    <stop offset=".5" stopColor="#5389e6"/>
                    <stop offset=".81" stopColor="#9dcffd"/>
                    <stop offset=".96" stopColor="#fff"/>
                  </linearGradient>
                </defs>
                <path fill="url(#logo-grad-m)" d="M43.13,75.37c.16.13.21.36.11.55l-8.31,15.38c-.09.17-.24.26-.4.26-.07,0-.16-.02-.22-.07-.22-.15-.32-.44-.22-.73l4.32-15.31c.04-.13.01-.27-.07-.37l-4.1-5.74c-.15-.21-.15-.51.02-.71.16-.21.41-.24.61-.07l8.26,6.83ZM34.04,75.88c.02-.13-.02-.29-.08-.4l-3.06-5.71c-.06-.13-.17-.2-.28-.2h0c-.11.01-.21.09-.28.2l-2.91,5.66c-.06.12-.07.26-.05.4l3.05,14.92c.04.21.17.34.32.34.15-.01.29-.14.32-.34l2.97-14.88ZM18.29,75.37c-.16.13-.21.36-.11.55l8.31,15.38c.09.17.24.26.4.26.07,0,.16-.02.22-.07.22-.15.32-.44.22-.73l-4.32-15.31c-.04-.13-.01-.27.07-.37l4.1-5.74c.15-.21.15-.51-.02-.71-.16-.21-.41-.24-.61-.07l-8.26,6.83Z"/>
                <g fill="#f2f4f7">
                  <path d="M55.8,78.19h-1.86c-1.54,0-2.39-.81-2.39-2.3s.81-2.17,2.39-2.17h6.05v-2.33h-5.72c-3.38,0-4.95,1.41-4.95,4.46s1.68,4.68,4.98,4.68h1.84c2.01,0,3.03.88,3.03,2.61s-1.05,2.68-3.03,2.68h-6.65v2.34h6.34c3.74,0,5.55-1.63,5.55-4.97s-1.83-4.99-5.57-4.99Z"/>
                  <path d="M64.69,71.38v.4l2.28,2.29v-2.7h-2.28ZM64.69,74.17v13.99h2.28v-11.7l-2.28-2.28Z"/>
                  <path d="M81.5,77.9l-.45-.11.42-.2c.91-.42,1.36-1.26,1.36-2.57,0-2.42-1.53-3.65-4.54-3.65h-7.67v16.77h8.18c3.78,0,5.63-1.78,5.63-5.44,0-2.7-.99-4.31-2.93-4.8ZM72.92,73.71h5.8c1.5,0,1.81.9,1.81,1.66s-.31,1.6-1.81,1.6h-5.8v-3.26ZM78.97,85.8h-6.06v-6.5h6.01c2.13,0,3.19,1.09,3.19,3.23s-1.06,3.27-3.15,3.27Z"/>
                  <path d="M97.77,73.72v-2.33h-10.08v16.77h9.93v-2.34h-7.63v-5.19l6.86.02v-2.34h-6.86v-4.59h7.78Z"/>
                  <path d="M109.58,82.76c3.37-.32,5.01-2.18,5.01-5.72,0-3.81-1.95-5.66-5.95-5.66h-7.88v16.77h2.31v-5.37h3.83l4.84,8.72h2.54l-4.95-8.72.25-.02ZM103.08,80.44v-6.73h5.9c2.26,0,3.4,1.13,3.4,3.36s-1.14,3.37-3.4,3.37h-5.9Z"/>
                  <path d="M118,74.13v14.03h2.28v-11.74l-2.28-2.28ZM118,71.38v.37l2.28,2.28v-2.66h-2.28Z"/>
                  <path d="M131.49,71.57l-8.73,16.57h2.6l1.27-2.69h9.86l3.03,6.05,2.33.06-10.37-19.99ZM127.71,83.11l3.88-6.84,3.85,6.84h-7.72Z"/>
                </g>
              </svg>
              <span className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: "#f2f4f7" }}>MIX</span>
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
              <>
                <Link href="/" onClick={handleAccueilClick} className="text-sm text-white/90 transition-colors hover:text-white">Accueil</Link>
                <a href={isMix ? "#faq-contact" : "/#faq-contact"} className="text-sm text-white/90 transition-colors hover:text-white">FAQ & Contact</a>
              </>
            )}
            <button type="button" onClick={() => setTokensModalOpen(true)} className="text-sm text-white/90 transition-colors hover:text-white shrink-0 bg-transparent border-none cursor-pointer font-inherit p-0 uppercase">
              Tokens
            </button>
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

        {/* Burger panel (mobile/tablet) - portail vers body pour backdrop-filter Safari 17 / iOS 17 */}
        {burgerOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div className="header-burger-overlay lg:hidden fixed inset-0 z-40 top-14 sm:top-16 border-t border-white/10 overflow-y-auto">
              <div className="backdrop-blur-layer" aria-hidden="true" />
              <div className="backdrop-tint-layer" aria-hidden="true" />
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
              <button type="button" onClick={() => { setTokensModalOpen(true); closeBurger(); }} className="py-3 px-4 text-left text-white/90 hover:text-white hover:bg-white/10 rounded-xl text-sm uppercase">Tokens</button>
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
          </div>,
            document.body
          )}
      </header>

      {showLeaveModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="modal-backdrop-dark fixed inset-0 z-[200] flex items-center justify-center p-4 max-lg:p-3" aria-modal="true" role="dialog">
          <div className="backdrop-blur-layer" aria-hidden="true" />
          <div className="backdrop-tint-layer" aria-hidden="true" />
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
        </div>,
          document.body
        )}

      <TokensModal
        isOpen={tokensModalOpen}
        onClose={() => { setTokensModalOpen(false); window.dispatchEvent(new Event("billingChanged")); }}
        getAuthHeaders={getAuthHeaders}
        onNeedLogin={() => { setTokensModalOpen(false); openAuthModal?.("login"); }}
      />
      {user && manageSubscriptionOpen && (
        <ManageSubscriptionModal
          isOpen={manageSubscriptionOpen}
          onClose={() => { setManageSubscriptionOpen(false); window.dispatchEvent(new Event("billingChanged")); }}
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
            window.dispatchEvent(new Event("billingChanged"));
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
