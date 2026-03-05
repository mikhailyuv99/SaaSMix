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
              className="font-heading max-lg:hidden flex items-center shrink-0 transition-opacity hover:opacity-90"
            >
              <svg className="h-8 sm:h-9 w-auto shrink-0" viewBox="18 64 124 28" fill="none" aria-hidden>
                <path fill="#fff" d="M41.14,76.09c.13.11.17.29.09.44l-6.72,12.44c-.08.14-.2.21-.32.21-.06,0-.13-.02-.18-.06-.18-.12-.26-.36-.18-.59l3.5-12.39c.03-.1,0-.21-.05-.3l-3.31-4.65c-.13-.17-.12-.41.01-.58.13-.17.33-.2.49-.06l6.68,5.52ZM33.79,76.5c.01-.11-.01-.23-.06-.32l-2.48-4.62c-.05-.1-.14-.16-.23-.16h0c-.09,0-.17.07-.23.16l-2.35,4.58c-.05.1-.06.21-.04.32l2.47,12.07c.03.17.14.27.26.27.12,0,.23-.12.26-.27l2.4-12.04ZM21.04,76.09c-.13.11-.17.29-.09.44l6.72,12.44c.08.14.2.21.32.21.06,0,.13-.02.18-.06.18-.12.26-.36.18-.59l-3.5-12.39c-.03-.1,0-.21.05-.3l3.31-4.65c.13-.17.12-.41-.01-.58-.13-.17-.33-.2-.49-.06l-6.68,5.52Z"/>
                <g fill="#fff">
                  <path d="M51.39,78.37h-1.51c-1.25,0-1.93-.66-1.93-1.86s.65-1.76,1.93-1.76h4.89v-1.89h-4.63c-2.73,0-4.01,1.14-4.01,3.61s1.36,3.79,4.03,3.79h1.48c1.63,0,2.45.71,2.45,2.11s-.85,2.17-2.45,2.17h-5.38v1.89h5.13c3.02,0,4.49-1.32,4.49-4.02s-1.48-4.04-4.51-4.04Z"/>
                  <path d="M58.58,72.86v.33l1.85,1.86v-2.18h-1.85ZM58.58,75.11v11.32h1.85v-9.47l-1.85-1.85Z"/>
                  <path d="M72.18,78.14l-.36-.09.34-.16c.73-.34,1.1-1.02,1.1-2.08,0-1.95-1.23-2.95-3.67-2.95h-6.2v13.57h6.62c3.06,0,4.55-1.44,4.55-4.4,0-2.18-.8-3.48-2.37-3.89ZM65.24,74.74h4.69c1.21,0,1.46.73,1.46,1.34s-.25,1.3-1.46,1.3h-4.69v-2.64ZM70.14,84.53h-4.9v-5.26h4.86c1.72,0,2.58.88,2.58,2.61s-.86,2.64-2.55,2.64Z"/>
                  <path d="M85.34,74.75v-1.89h-8.16v13.57h8.04v-1.89h-6.17v-4.2l5.55.02v-1.89h-5.55v-3.71h6.3Z"/>
                  <path d="M94.9,82.07c2.73-.26,4.05-1.77,4.05-4.63,0-3.08-1.58-4.58-4.81-4.58h-6.38v13.57h1.87v-4.34h3.1l3.92,7.05h2.05l-4.01-7.05.2-.02ZM89.64,80.19v-5.45h4.77c1.83,0,2.75.92,2.75,2.72s-.92,2.73-2.75,2.73h-4.77Z"/>
                  <path d="M101.71,75.08v11.35h1.85v-9.5l-1.85-1.85ZM101.71,72.86v.3l1.85,1.85v-2.15h-1.85Z"/>
                  <path d="M112.63,73.01l-7.06,13.41h2.11l1.03-2.17h7.98l2.45,4.89,1.89.05-8.39-16.17ZM109.57,82.35l3.14-5.53,3.11,5.53h-6.25Z"/>
                </g>
                <g fill="#fff">
                  <path d="M124.09,84.25v-5.86h.77l2.1,2.78,2.06-2.78h.77v5.86h-.66v-4.85l-2.17,2.79-2.2-2.79v4.85h-.66Z"/>
                  <path d="M131.23,84.25v-5.86h.66v5.86h-.66Z"/>
                  <path d="M132.58,84.25l2.34-3.03-2.18-2.83h.84l1.73,2.3,1.74-2.3h.84l-2.18,2.83,2.34,3.03h-.84l-1.9-2.51-1.89,2.51h-.84Z"/>
                </g>
              </svg>
            </Link>
            <Link
              href="/"
              onClick={handleAccueilClick}
              className="font-heading lg:hidden flex items-center shrink-0 transition-opacity hover:opacity-90"
            >
              <svg className="h-7 sm:h-8 w-auto shrink-0" viewBox="18 64 124 28" fill="none" aria-hidden>
                <path fill="#fff" d="M41.14,76.09c.13.11.17.29.09.44l-6.72,12.44c-.08.14-.2.21-.32.21-.06,0-.13-.02-.18-.06-.18-.12-.26-.36-.18-.59l3.5-12.39c.03-.1,0-.21-.05-.3l-3.31-4.65c-.13-.17-.12-.41.01-.58.13-.17.33-.2.49-.06l6.68,5.52ZM33.79,76.5c.01-.11-.01-.23-.06-.32l-2.48-4.62c-.05-.1-.14-.16-.23-.16h0c-.09,0-.17.07-.23.16l-2.35,4.58c-.05.1-.06.21-.04.32l2.47,12.07c.03.17.14.27.26.27.12,0,.23-.12.26-.27l2.4-12.04ZM21.04,76.09c-.13.11-.17.29-.09.44l6.72,12.44c.08.14.2.21.32.21.06,0,.13-.02.18-.06.18-.12.26-.36.18-.59l-3.5-12.39c-.03-.1,0-.21.05-.3l3.31-4.65c.13-.17.12-.41-.01-.58-.13-.17-.33-.2-.49-.06l-6.68,5.52Z"/>
                <g fill="#fff">
                  <path d="M51.39,78.37h-1.51c-1.25,0-1.93-.66-1.93-1.86s.65-1.76,1.93-1.76h4.89v-1.89h-4.63c-2.73,0-4.01,1.14-4.01,3.61s1.36,3.79,4.03,3.79h1.48c1.63,0,2.45.71,2.45,2.11s-.85,2.17-2.45,2.17h-5.38v1.89h5.13c3.02,0,4.49-1.32,4.49-4.02s-1.48-4.04-4.51-4.04Z"/>
                  <path d="M58.58,72.86v.33l1.85,1.86v-2.18h-1.85ZM58.58,75.11v11.32h1.85v-9.47l-1.85-1.85Z"/>
                  <path d="M72.18,78.14l-.36-.09.34-.16c.73-.34,1.1-1.02,1.1-2.08,0-1.95-1.23-2.95-3.67-2.95h-6.2v13.57h6.62c3.06,0,4.55-1.44,4.55-4.4,0-2.18-.8-3.48-2.37-3.89ZM65.24,74.74h4.69c1.21,0,1.46.73,1.46,1.34s-.25,1.3-1.46,1.3h-4.69v-2.64ZM70.14,84.53h-4.9v-5.26h4.86c1.72,0,2.58.88,2.58,2.61s-.86,2.64-2.55,2.64Z"/>
                  <path d="M85.34,74.75v-1.89h-8.16v13.57h8.04v-1.89h-6.17v-4.2l5.55.02v-1.89h-5.55v-3.71h6.3Z"/>
                  <path d="M94.9,82.07c2.73-.26,4.05-1.77,4.05-4.63,0-3.08-1.58-4.58-4.81-4.58h-6.38v13.57h1.87v-4.34h3.1l3.92,7.05h2.05l-4.01-7.05.2-.02ZM89.64,80.19v-5.45h4.77c1.83,0,2.75.92,2.75,2.72s-.92,2.73-2.75,2.73h-4.77Z"/>
                  <path d="M101.71,75.08v11.35h1.85v-9.5l-1.85-1.85ZM101.71,72.86v.3l1.85,1.85v-2.15h-1.85Z"/>
                  <path d="M112.63,73.01l-7.06,13.41h2.11l1.03-2.17h7.98l2.45,4.89,1.89.05-8.39-16.17ZM109.57,82.35l3.14-5.53,3.11,5.53h-6.25Z"/>
                </g>
                <g fill="#fff">
                  <path d="M124.09,84.25v-5.86h.77l2.1,2.78,2.06-2.78h.77v5.86h-.66v-4.85l-2.17,2.79-2.2-2.79v4.85h-.66Z"/>
                  <path d="M131.23,84.25v-5.86h.66v5.86h-.66Z"/>
                  <path d="M132.58,84.25l2.34-3.03-2.18-2.83h.84l1.73,2.3,1.74-2.3h.84l-2.18,2.83,2.34,3.03h-.84l-1.9-2.51-1.89,2.51h-.84Z"/>
                </g>
              </svg>
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
