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
  const [subscription, setSubscription] = useState<{
    current_period_end: number | null;
    cancel_at_period_end: boolean;
    interval: "month" | "year";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateCard, setShowUpdateCard] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSubscription(null);
    setShowUpdateCard(false);
    fetch(`${API_BASE}/api/billing/subscription`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setSubscription(data.subscription || null);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4" onClick={onClose}>
      <div className="rounded-2xl border border-white/15 bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-black/20 p-6 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none">&times;</button>
        <h2 className="text-xl font-medium text-white mb-1">Gérer mon abonnement</h2>
        <p className="text-tagline text-slate-400 text-[10px] mb-6">Modifier votre carte ou annuler l'abonnement.</p>

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
              Plan : <strong>Pro {subscription.interval === "year" ? "annuel" : "mensuel"}</strong>
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
      </div>
    </div>
  );
}
