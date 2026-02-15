"use client";

import { useState } from "react";

const PLANS_MENSUEL = [
  { name: "Starter", subtitle: "Pour découvrir", price: "—", tokens: "Tokens inclus : à définir", cta: "Bientôt", featured: false },
  { name: "Creator", subtitle: "Pour les artistes réguliers", price: "—", tokens: "Tokens inclus : à définir", cta: "Bientôt", featured: true },
  { name: "Pro", subtitle: "Mix + master à volonté", price: "—", tokens: "Tokens inclus : à définir", cta: "Bientôt", featured: false },
];

const PLAN_ANNUEL = {
  name: "Pro annuel",
  subtitle: "Économisez sur l'année",
  price: "—",
  tokens: "Prix avantageux, à définir",
  cta: "Bientôt",
  featured: true,
};

export function ChoosePlanModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [billingPeriod, setBillingPeriod] = useState<"mensuel" | "annuel">("mensuel");

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md" aria-modal="true" role="dialog" onClick={onClose}>
      <div className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-lg font-semibold text-white">Choisir un plan</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none p-1" aria-label="Fermer">&times;</button>
        </div>
        <p className="text-slate-400 text-sm mb-4 text-center">
          Choisissez la formule qui vous convient.
        </p>

        {/* Toggle Mensuel / Annuel */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("mensuel")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "mensuel" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annuel")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "annuel" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Annuel
            </button>
          </div>
        </div>

        {billingPeriod === "mensuel" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS_MENSUEL.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-5 transition-all ${
                  plan.featured ? "border-white/25 bg-white/[0.06] ring-1 ring-white/10" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-lg font-semibold text-white">{plan.name}</h3>
                  {plan.featured && (
                    <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                      Populaire
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">{plan.subtitle}</p>
                <p className="mt-4 font-heading text-xl font-bold text-white">{plan.price}</p>
                <p className="mt-0.5 text-xs text-slate-400">{plan.tokens}</p>
                <div className="mt-4">
                  <span className="inline-block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-center text-sm text-slate-400">
                    {plan.cta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-white/[0.06] ring-1 ring-white/10 p-5">
              {PLAN_ANNUEL.featured && (
                <span className="inline-block rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-400 mb-2">
                  Avantageux
                </span>
              )}
              <h3 className="font-heading text-lg font-semibold text-white">{PLAN_ANNUEL.name}</h3>
              <p className="text-sm text-slate-400 mt-1">{PLAN_ANNUEL.subtitle}</p>
              <p className="mt-4 font-heading text-xl font-bold text-white">{PLAN_ANNUEL.price}</p>
              <p className="mt-0.5 text-xs text-slate-400">{PLAN_ANNUEL.tokens}</p>
              <div className="mt-4">
                <span className="inline-block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-center text-sm text-slate-400">
                  {PLAN_ANNUEL.cta}
                </span>
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Les tarifs et volumes de tokens seront fixés prochainement. Lien Stripe à venir.
        </p>
      </div>
    </div>
  );
}
