"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const PLAN_FEATURES: Record<string, string> = {
  starter: "10 téléchargements mix / mois\n3 téléchargements master / mois\n5 sauvegardes de projets",
  artiste: "30 téléchargements mix / mois\n15 téléchargements master / mois\n15 sauvegardes de projets",
  pro: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
  pro_annual: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
};

const CARD_OPTIONS = {
  style: {
    base: {
      fontSize: "14px",
      color: "#e2e8f0",
      "::placeholder": { color: "#94a3b8" },
      iconColor: "#94a3b8",
    },
    invalid: { color: "#f87171" },
  },
};

function UpdateCardForm({
  onSuccess,
  onClose,
  getAuthHeaders,
}: {
  onSuccess: () => void;
  onClose: () => void;
  getAuthHeaders: () => Record<string, string>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;
    setLoading(true);
    setError(null);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardEl,
      });
      if (pmError) {
        setError(pmError.message || "Carte refusée.");
        setLoading(false);
        return;
      }
      if (!paymentMethod?.id) {
        setError("Impossible de créer le moyen de paiement.");
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/billing/update-payment-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ payment_method_id: paymentMethod.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Session expirée. Reconnectez-vous.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError((data.detail as string) || "Erreur.");
        setLoading(false);
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <CardElement options={CARD_OPTIONS} />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "En cours…" : "Enregistrer la carte"}
        </button>
      </div>
    </form>
  );
}

function formatPeriodEnd(ts: number | null | undefined): string {
  if (ts == null || ts <= 0) return "—";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function ManageSubscriptionModal({
  isOpen,
  onClose,
  getAuthHeaders,
  onSubscriptionUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  getAuthHeaders: () => Record<string, string>;
  onSubscriptionUpdated: () => void;
}) {
  type Sub = {
    current_period_end: number | null;
    cancel_at_period_end: boolean;
    interval: "month" | "year";
    current_plan_id?: string;
  };
  type PlanOption = { id: string; name: string; priceDisplay: string; interval: string; priceId: string };
  const [subscription, setSubscription] = useState<Sub | null>(null);
  const [plansMonthly, setPlansMonthly] = useState<PlanOption[]>([]);
  const [planAnnual, setPlanAnnual] = useState<PlanOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateCard, setShowUpdateCard] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [changePlanView, setChangePlanView] = useState(false);
  const [changePlanLoading, setChangePlanLoading] = useState<string | null>(null);
  const [changePlanError, setChangePlanError] = useState<string | null>(null);
  const [proInterval, setProInterval] = useState<"year" | "month">("year");
  const [featuresOpen, setFeaturesOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSubscription(null);
    setPlansMonthly([]);
    setPlanAnnual(null);
    setShowUpdateCard(false);
    setChangePlanView(false);
    setChangePlanError(null);
    setProInterval("year");
    setFeaturesOpen(null);
    Promise.all([
      fetch(`${API_BASE}/api/billing/subscription`, { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch(`${API_BASE}/api/billing/plans`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([subData, plansData]) => {
        setSubscription(subData.subscription || null);
        if (plansData && Array.isArray(plansData.plansMonthly)) {
          setPlansMonthly(plansData.plansMonthly);
        }
        if (plansData?.planAnnual) {
          setPlanAnnual(plansData.planAnnual);
        }
      })
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }, [isOpen, getAuthHeaders]);

  const handleCancelClick = () => setShowCancelConfirm(true);

  const handleCancelConfirm = async () => {
    setShowCancelConfirm(false);
    setCancelError(null);
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/cancel-subscription`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSubscriptionUpdated();
        setSubscription((s) => (s ? { ...s, cancel_at_period_end: true } : null));
      } else {
        setCancelError(data.detail || "Erreur lors de l'annulation.");
      }
    } catch {
      setCancelError("Erreur réseau.");
    } finally {
      setCancelLoading(false);
    }
  };

  const currentPlanId = subscription?.current_plan_id ?? null;
  const isCurrentPlan = (planId: string) => {
    if (!currentPlanId) return false;
    if (currentPlanId === "pro_annual") return planId === "pro";
    return currentPlanId === planId;
  };
  const currentPlanLabel =
    subscription?.interval === "year"
      ? "Pro annuel"
      : currentPlanId === "starter"
        ? "Starter"
        : currentPlanId === "artiste"
          ? "Artiste"
          : currentPlanId === "pro" || currentPlanId === "pro_annual"
            ? "Pro"
            : "Pro";
  const planSuffix = subscription?.interval === "year" ? " annuel" : " mensuel";

  const handleChangePlan = async (priceId: string) => {
    setChangePlanError(null);
    setChangePlanLoading(priceId);
    try {
      const res = await fetch(`${API_BASE}/api/billing/change-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ price_id: priceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSubscriptionUpdated();
        const subRes = await fetch(`${API_BASE}/api/billing/subscription`, { headers: getAuthHeaders() });
        const subData = await subRes.json().catch(() => ({}));
        setSubscription(subData.subscription || null);
        setChangePlanView(false);
      } else {
        setChangePlanError((data.detail as string) || "Erreur lors du changement de plan.");
      }
    } catch {
      setChangePlanError("Erreur réseau.");
    } finally {
      setChangePlanLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4" onClick={onClose}>
      <div className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 p-6 max-w-md w-full relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none">&times;</button>

        {changePlanView ? (
          <>
            <button type="button" onClick={() => { setChangePlanView(false); setChangePlanError(null); }} className="text-slate-400 hover:text-white text-sm mb-2 flex items-center gap-1">
              ← Retour
            </button>
            <h2 className="text-xl font-medium text-white mb-1">Changer de plan</h2>
            <p className="text-slate-400 text-[10px] mb-4">Choisissez une formule. Le prorata est appliqué automatiquement.</p>
            {changePlanError && <p className="text-red-400 text-sm mb-3">{changePlanError}</p>}
            <div className="space-y-3">
              {plansMonthly.map((plan) => {
                const isProPlan = plan.id === "pro";
                const useProAnnual = isProPlan && proInterval === "year" && !!planAnnual;
                const proPriceId = useProAnnual ? planAnnual!.priceId : plan.priceId;
                const proPriceDisplay = useProAnnual ? `${planAnnual!.priceDisplay} / an` : `${plan.priceDisplay} / mois`;
                const displayPrice = isProPlan ? proPriceDisplay : `${plan.priceDisplay} / mois`;
                const priceIdToUse = isProPlan ? proPriceId : plan.priceId;
                const planIdForCurrent = useProAnnual ? "pro_annual" : plan.id;
                const proLabel = isProPlan ? (useProAnnual ? "Pro annuel" : "Pro mensuel") : null;
                const isCurrent = isCurrentPlan(planIdForCurrent);
                const featuresKey = isProPlan && proInterval === "year" ? "pro_annual" : plan.id;
                const features = PLAN_FEATURES[featuresKey] || "";
                const rowKey = plan.id + (isProPlan ? `_${proInterval}` : "");
                const isFeaturesOpen = featuresOpen === rowKey;
                return (
                  <div
                    key={plan.id + (isProPlan ? proInterval : "")}
                    className={`rounded-xl border p-4 transition-colors ${isCurrent ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium text-white">{proLabel ?? plan.name}</p>
                        <p className="text-slate-400 text-sm">{displayPrice}</p>
                        {isCurrent && (
                          <span className="inline-block mt-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                            Votre plan actuel
                          </span>
                        )}
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          disabled={!!changePlanLoading}
                          onClick={() => handleChangePlan(priceIdToUse)}
                          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                        >
                          {changePlanLoading === priceIdToUse ? "En cours…" : "Passer à ce plan"}
                        </button>
                      )}
                    </div>
                    {isProPlan && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px] uppercase tracking-wider">Facturation</span>
                          <div className="inline-flex items-center rounded-lg border border-white/10 bg-black/20 p-0.5">
                            <button
                              type="button"
                              onClick={() => setProInterval("year")}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${proInterval === "year" ? "bg-white/15 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                            >
                              Annuel
                            </button>
                            <button
                              type="button"
                              onClick={() => setProInterval("month")}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${proInterval === "month" ? "bg-white/15 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                            >
                              Mensuel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {features && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setFeaturesOpen(isFeaturesOpen ? null : rowKey)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                        >
                          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Inclus dans ce plan</span>
                          <svg className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${isFeaturesOpen ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 4.5 L6 7.5 L9 4.5" />
                          </svg>
                        </button>
                        <div className={`overflow-hidden transition-all duration-200 ease-out ${isFeaturesOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                          <ul className="mt-2 space-y-2 rounded-lg border border-white/5 bg-black/20 py-2.5 pl-3 pr-3">
                            {features.split("\n").map((line, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-400">
                                <span className="mt-1.5 shrink-0 size-1.5 rounded-full bg-emerald-500/60" aria-hidden />
                                <span className="leading-snug">{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {plansMonthly.length === 0 && !loading && <p className="text-slate-400 text-sm">Aucune formule disponible.</p>}
          </>
        ) : (
          <>
            <h2 className="text-xl font-medium text-white mb-1">Gérer mon abonnement</h2>
            <p className="text-tagline text-slate-400 text-[10px] mb-6">Modifier votre carte, changer de plan ou annuler l&apos;abonnement.</p>

        {loading ? (
          <p className="text-slate-400 text-sm">Chargement…</p>
        ) : showUpdateCard ? (
          <>
            <p className="text-slate-400 text-sm mb-4">Nouvelle carte de paiement :</p>
            {stripePromise && (
              <Elements stripe={stripePromise}>
                <UpdateCardForm
                  onSuccess={() => { onSubscriptionUpdated(); setShowUpdateCard(false); }}
                  onClose={() => setShowUpdateCard(false)}
                  getAuthHeaders={getAuthHeaders}
                />
              </Elements>
            )}
          </>
        ) : subscription ? (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Plan : <strong>{currentPlanLabel}{planSuffix}</strong>
            </p>
            <p className="text-slate-400 text-sm">
              {subscription.cancel_at_period_end ? (
                <>Annulé. Accès Pro jusqu'au <strong>{formatPeriodEnd(subscription.current_period_end)}</strong>.</>
              ) : (
                <>Prochaine facturation le <strong>{formatPeriodEnd(subscription.current_period_end)}</strong>.</>
              )}
            </p>
            {cancelError && (
              <p className="text-red-400 text-sm">{cancelError}</p>
            )}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              {!subscription.cancel_at_period_end && (
                <button
                  type="button"
                  onClick={() => setChangePlanView(true)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-slate-400 hover:bg-white/10 transition-colors"
                >
                  Changer de plan
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowUpdateCard(true)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-slate-400 hover:bg-white/10 transition-colors"
              >
                Mettre à jour ma carte
              </button>
              {!subscription.cancel_at_period_end && (
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={cancelLoading}
                  className="w-full rounded-lg border border-red-500/50 text-red-400 px-4 py-2.5 text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {cancelLoading ? "En cours…" : "Annuler l'abonnement"}
                </button>
              )}
            </div>
            {showCancelConfirm && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#0f0f0f]/95 border border-white/10 p-4">
                <div className="text-center max-w-sm">
                  <p className="text-slate-400 text-sm mb-4">Annuler l&apos;abonnement ? Vous garderez l&apos;accès Pro jusqu&apos;à la fin de la période en cours.</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-slate-400 text-sm hover:bg-white/10"
                    >
                      Non
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelConfirm}
                      className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm hover:bg-red-500/30"
                    >
                      Oui, annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Aucun abonnement actif.</p>
        )}
          </>
        )}
      </div>
    </div>
  );
}
