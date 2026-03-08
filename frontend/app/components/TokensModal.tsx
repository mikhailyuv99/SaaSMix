"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { loadStripe } from "@stripe/stripe-js/pure";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const CARD_OPTIONS = {
  style: {
    base: {
      fontSize: "14px",
      color: "#f2f4f7",
      "::placeholder": { color: "#94a3b8" },
      iconColor: "#94a3b8",
    },
    invalid: { color: "#f87171" },
  },
};

type Usage = {
  plan: string;
  mix_used: number;
  master_used: number;
  mix_tokens_purchased: number;
  master_tokens_purchased: number;
  mix_limit: number | null;
  master_limit: number | null;
};

type TokenOffer = { type: string; quantity: number; priceDisplay: string; priceId: string };

function TokenPaymentForm({
  offer,
  onSuccess,
  onCancel,
  getAuthHeaders,
}: {
  offer: TokenOffer;
  onSuccess: () => void;
  onCancel: () => void;
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
      const res = await fetch(`${API_BASE}/api/billing/create-payment-intent-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ price_id: offer.priceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Connectez-vous pour acheter des tokens.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError((data.detail as string) || "Erreur lors de la création du paiement.");
        setLoading(false);
        return;
      }
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: { card: cardEl },
      });
      if (confirmError) {
        setError(confirmError.message || "Paiement refusé.");
        setLoading(false);
        return;
      }
      if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
        const confirmRes = await fetch(`${API_BASE}/api/billing/confirm-token-purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
        });
        if (!confirmRes.ok) {
          const confirmData = await confirmRes.json().catch(() => ({}));
          setError((confirmData.detail as string) || "Erreur lors de l’enregistrement.");
          setLoading(false);
          return;
        }
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-slate-400 text-sm">
        {offer.quantity} token{offer.quantity > 1 ? "s" : ""} {offer.type} — {offer.priceDisplay}
      </p>
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <CardElement options={CARD_OPTIONS} />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="pricing-plan-btn rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={!stripe || loading} className="pricing-plan-btn flex-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors">
          {loading ? "Paiement en cours…" : "Payer"}
        </button>
      </div>
    </form>
  );
}

export function TokensModal({
  isOpen,
  onClose,
  onSuccess,
  getAuthHeaders,
  onNeedLogin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  getAuthHeaders: () => Record<string, string>;
  onNeedLogin?: () => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [offers, setOffers] = useState<TokenOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<TokenOffer | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [authExpired, setAuthExpired] = useState(false);

  useEffect(() => {
    if (isOpen && PUBLISHABLE_KEY && !stripePromise) {
      setStripePromise(loadStripe(PUBLISHABLE_KEY));
    }
  }, [isOpen, stripePromise]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelectedOffer(null);
    setAuthExpired(false);
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      setUsage(null);
      setOffers([]);
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_BASE}/api/billing/usage`, { headers }),
      fetch(`${API_BASE}/api/billing/token-offers`, { headers }),
    ])
      .then(async ([usageRes, offersRes]) => {
        if (usageRes.status === 401 || offersRes.status === 401) {
          setUsage(null);
          setOffers([]);
          setAuthExpired(true);
          return;
        }
        const usageData = usageRes.ok ? await usageRes.json().catch(() => null) : null;
        const offersData = offersRes.ok ? await offersRes.json().catch(() => null) : null;
        if (usageData && typeof usageData.mix_used === "number") {
          setUsage(usageData as Usage);
        } else {
          setUsage(null);
        }
        setOffers(offersData?.offers ?? []);
      })
      .catch(() => {
        setUsage(null);
        setOffers([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, getAuthHeaders]);

  const hasToken = !!getAuthHeaders().Authorization;
  const hasUnlimitedTokens = usage?.plan === "pro" || usage?.plan === "pro_annual";
  const isPro = hasUnlimitedTokens;
  const mixOffers = offers.filter((o) => o.type === "mix");
  const masterOffers = offers.filter((o) => o.type === "master");

  const handlePaymentSuccess = () => {
    setSelectedOffer(null);
    const headers = getAuthHeaders();
    if (headers.Authorization) {
      fetch(`${API_BASE}/api/billing/usage`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setUsage(d as Usage))
        .catch(() => {});
    }
    onSuccess?.();
  };

  if (!isOpen) return null;

  const content = (
    <div className="modal-backdrop-slate fixed inset-0 z-[9999] flex items-center justify-center p-4 max-lg:p-3 overflow-y-auto" onClick={onClose}>
      <div className="backdrop-blur-layer" aria-hidden="true" />
      <div className="backdrop-tint-layer" aria-hidden="true" />
      <div
        className="modal-panel-dark font-sans rounded-2xl border border-white/15 backdrop-blur-xl p-6 max-w-lg w-full relative max-lg:max-w-[calc(100vw-1.5rem)] max-lg:p-4 max-lg:rounded-xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none">
          &times;
        </button>
        <h2 className="font-heading text-xl font-medium text-white mb-1">Tokens</h2>
        <p className="text-tagline text-slate-400 text-[10px] mb-6">Besoin de plus ? Refaites le plein.</p>

        {!hasToken || authExpired ? (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              {authExpired
                ? "Session expirée. Reconnectez-vous pour voir et acheter des tokens."
                : "Connectez-vous pour acheter des tokens (mix ou master)."}
            </p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={onClose} className="pricing-plan-btn rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors shrink-0">
                Fermer
              </button>
              <button type="button" onClick={() => { onNeedLogin?.(); onClose(); }} className="pricing-plan-btn rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 text-sm shrink-0">
                Se connecter
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="text-slate-400 text-sm">Chargement…</p>
        ) : selectedOffer ? (
          stripePromise && (
            <Elements stripe={stripePromise}>
              <TokenPaymentForm
                offer={selectedOffer}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setSelectedOffer(null)}
                getAuthHeaders={getAuthHeaders}
              />
            </Elements>
          )
        ) : isPro ? (
          <div className="space-y-4">
            <p className="text-white font-medium">Accès illimité</p>
            <p className="text-slate-400 text-sm">Votre plan Pro inclut des téléchargements mix et master illimités. Vous n&apos;avez pas besoin d&apos;acheter des tokens.</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Tokens Mix</p>
                {mixOffers.map((o) => (
                  <button key={o.priceId} type="button" onClick={() => setSelectedOffer(o)} className="pricing-plan-btn w-full mt-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors text-left">
                    {o.quantity} token{o.quantity > 1 ? "s" : ""} — {o.priceDisplay}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Tokens Master</p>
                {masterOffers.map((o) => (
                  <button key={o.priceId} type="button" onClick={() => setSelectedOffer(o)} className="pricing-plan-btn w-full mt-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors text-left">
                    {o.quantity} token{o.quantity > 1 ? "s" : ""} — {o.priceDisplay}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {usage && (() => {
              const unlimited = usage.plan === "pro" || usage.plan === "pro_annual";
              const mixRemaining = unlimited ? null : (usage.plan === "free" ? usage.mix_tokens_purchased : Math.max(0, (usage.mix_limit ?? 0) - usage.mix_used) + usage.mix_tokens_purchased);
              const masterRemaining = unlimited ? null : (usage.plan === "free" ? usage.master_tokens_purchased : Math.max(0, (usage.master_limit ?? 0) - usage.master_used) + usage.master_tokens_purchased);
              return (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Tokens mix restants</p>
                    <p className="text-white font-medium mt-1">{mixRemaining === null ? "Illimité" : mixRemaining}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Tokens master restants</p>
                    <p className="text-white font-medium mt-1">{masterRemaining === null ? "Illimité" : masterRemaining}</p>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Tokens Mix</p>
                {mixOffers.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aucune offre configurée. Vérifiez les variables STRIPE_PRICE_MIX_1 / MIX_5 sur le serveur.</p>
                ) : (
                  mixOffers.map((o) => (
                    <button key={o.priceId} type="button" onClick={() => setSelectedOffer(o)} className="pricing-plan-btn w-full mt-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors text-left">
                      {o.quantity} token{o.quantity > 1 ? "s" : ""} — {o.priceDisplay}
                    </button>
                  ))
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Tokens Master</p>
                {masterOffers.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aucune offre configurée. Vérifiez les variables STRIPE_PRICE_MASTER_1 / MASTER_5 sur le serveur.</p>
                ) : (
                  masterOffers.map((o) => (
                    <button key={o.priceId} type="button" onClick={() => setSelectedOffer(o)} className="pricing-plan-btn w-full mt-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors text-left">
                      {o.quantity} token{o.quantity > 1 ? "s" : ""} — {o.priceDisplay}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document !== "undefined") return createPortal(content, document.body);
  return content;
}
