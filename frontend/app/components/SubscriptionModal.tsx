"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

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

type PlanOption = { id: string; name: string; priceDisplay: string; interval: string; priceId: string };

function SubscriptionForm({
  onSuccess,
  onClose,
  getAuthHeaders,
  onNeedLogin,
  initialPriceId,
  initialLabel,
}: {
  onSuccess: () => void;
  onClose: () => void;
  getAuthHeaders: () => Record<string, string>;
  onNeedLogin?: () => void;
  initialPriceId?: string | null;
  initialLabel?: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(initialPriceId ?? null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(initialLabel ?? null);
  const [plansData, setPlansData] = useState<{ plansMonthly: PlanOption[]; planAnnual: PlanOption | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPriceId) {
      setSelectedPriceId(initialPriceId);
      setSelectedLabel(initialLabel ?? null);
    }
  }, [initialPriceId, initialLabel]);

  useEffect(() => {
    fetch(`${API_BASE}/api/billing/plans`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.plansMonthly)) {
          setPlansData({ plansMonthly: d.plansMonthly, planAnnual: d.planAnnual ?? null });
        } else {
          setPlansData(null);
        }
      })
      .catch(() => setPlansData(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !selectedPriceId) return;
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
      const res = await fetch(`${API_BASE}/api/billing/create-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ price_id: selectedPriceId, payment_method_id: paymentMethod.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Connectez-vous pour vous abonner.");
        onNeedLogin?.();
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError((data.detail as string) || "Erreur lors de l'abonnement.");
        setLoading(false);
        return;
      }
      if (data.status === "requires_action" && data.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret);
        if (confirmError) {
          setError(confirmError.message || "Paiement échoué.");
          setLoading(false);
          return;
        }
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  const allPlans = [
    ...(plansData?.plansMonthly ?? []),
    ...(plansData?.planAnnual ? [plansData.planAnnual] : []),
  ];
  const displayLabel = selectedLabel || allPlans.find((p) => p.priceId === selectedPriceId)?.name || selectedPriceId ? "Abonnement" : null;
  const hasToken = !!getAuthHeaders().Authorization;

  if (!hasToken) {
    return (
      <div className="space-y-4">
        <p className="text-slate-400 text-sm">Vous devez être connecté pour vous abonner.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Fermer
          </button>
          <button type="button" onClick={() => { onNeedLogin?.(); onClose(); }} className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 text-sm">
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!selectedPriceId ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {allPlans.length === 0 && !plansData ? (
            <p className="text-slate-400 text-sm">Chargement des formules…</p>
          ) : (
            allPlans.map((plan) => (
              <button
                key={plan.priceId}
                type="button"
                onClick={() => {
                  setSelectedPriceId(plan.priceId);
                  setSelectedLabel(plan.name);
                }}
                className="flex-1 min-w-[140px] rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-400 hover:bg-white/10 hover:border-white/30 transition-colors text-left"
              >
                <span className="font-medium text-white">{plan.name}</span>
                <span className="text-tagline text-slate-400 block text-[10px]">{plan.priceDisplay}{plan.interval === "year" ? " / an" : " / mois"}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <p className="text-tagline text-slate-400 text-[10px]">
            {displayLabel ? `${displayLabel} – Paiement sécurisé` : "Paiement sécurisé"}
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <CardElement options={CARD_OPTIONS} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setSelectedPriceId(null); setSelectedLabel(null); }}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={!stripe || loading}
              className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? "En cours…" : "S'abonner"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

export function SubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  getAuthHeaders,
  onNeedLogin,
  initialPriceId,
  initialLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  getAuthHeaders: () => Record<string, string>;
  onNeedLogin?: () => void;
  initialPriceId?: string | null;
  initialLabel?: string | null;
}) {
  if (!isOpen) return null;
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4" onClick={onClose}>
        <div className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 p-6 max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
          <p className="text-slate-400 text-sm">Stripe non configuré (clé publique manquante).</p>
          <button type="button" onClick={onClose} className="mt-4 text-white text-sm underline">Fermer</button>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4" onClick={onClose}>
      <div className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 p-6 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none">&times;</button>
        <h2 className="text-xl font-medium text-white mb-1">{initialPriceId ? "Finaliser l'abonnement" : "Choisir une formule"}</h2>
        <p className="text-tagline text-slate-400 text-[10px] mb-6">Abonnement lié à votre compte. Paiement sécurisé Stripe.</p>
        {stripePromise && (
          <Elements stripe={stripePromise}>
            <SubscriptionForm
              onSuccess={onSuccess}
              onClose={onClose}
              getAuthHeaders={getAuthHeaders}
              onNeedLogin={onNeedLogin}
              initialPriceId={initialPriceId}
              initialLabel={initialLabel}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
