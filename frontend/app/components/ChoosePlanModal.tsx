"use client";

import { useState } from "react";

const PLANS_MENSUEL = [
  {
    name: "Starter",
    subtitle: "Pour découvrir",
    price: "9,99 €",
    features: "10 téléchargements mix / mois\n3 téléchargements master / mois\n5 sauvegardes de projets",
    cta: "Bientôt",
    featured: false,
  },
  {
    name: "Creator",
    subtitle: "Pour les artistes réguliers",
    price: "19,99 €",
    features: "30 téléchargements mix / mois\n15 téléchargements master / mois\n15 sauvegardes de projets",
    cta: "Bientôt",
    featured: true,
  },
  {
    name: "Pro",
    subtitle: "Mix + master à volonté",
    price: "29,99 €",
    features: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
    cta: "Bientôt",
    featured: false,
  },
];

const PLAN_ANNUEL = {
  name: "Pro annuel",
  subtitle: "Économisez 25 %",
  price: "269 €",
  features: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
  cta: "Bientôt",
  featured: true,
};

export function ChoosePlanModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [billingPeriod, setBillingPeriod] = useState<"mensuel" | "annuel">("mensuel");

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md" aria-modal="true" role="dialog" onClick={onClose}>
      <div className="rounded-2xl border border-white/15 bg-black/10 backdrop-blur-xl shadow-xl shadow-black/20 w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-lg font-semibold text-white">Choisir un plan</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none p-1" aria-label="Fermer">&times;</button>
        </div>
        <p className="text-slate-400 text-sm mb-4 text-center">
          Choisissez la formule qui vous convient.
        </p>

        {/* Toggle Mensuel / Annuel */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
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
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "annuel" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Annuel
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold text-white ring-1 ring-white/30">
                −25%
              </span>
            </button>
          </div>
        </div>

        {billingPeriod === "mensuel" ? (
          <div className="grid gap-6 sm:grid-cols-3">
            {PLANS_MENSUEL.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 transition-all sm:p-8 ${
                  plan.featured ? "border-white/25 bg-white/[0.06] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2),0_0_40px_rgba(255,255,255,0.22)] ring-1 ring-white/10" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-xl font-semibold text-white">{plan.name}</h3>
                  {plan.featured && (
                    <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-400">
                      Populaire
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-400">{plan.subtitle}</p>
                <p className="mt-5 font-heading text-2xl font-bold text-white">{plan.price}</p>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-400">
                  {plan.features.split("\n").map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-white/50" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <span
                    className={`inline-block w-full rounded-xl border px-4 py-2.5 text-center text-sm ${
                      plan.featured ? "border-white/20 bg-white/5 text-slate-400" : "border-white/15 bg-white/5 text-slate-400"
                    }`}
                  >
                    {plan.cta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            <div aria-hidden />
            <div className="rounded-2xl border border-white/25 bg-white/[0.06] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2),0_0_40px_rgba(255,255,255,0.22)] ring-1 ring-white/10 p-6 sm:p-8 min-h-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-heading text-xl font-semibold text-white">{PLAN_ANNUEL.name}</h3>
                {PLAN_ANNUEL.featured && (
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-400">
                      Plus avantageux
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">Économisez 25%</span>
                  </div>
                )}
              </div>
              <p className="mt-5 font-heading text-2xl font-bold text-white">{PLAN_ANNUEL.price}</p>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-400">
                {PLAN_ANNUEL.features.split("\n").map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-white/50" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <span className="inline-block w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-center text-sm text-slate-400">
                  {PLAN_ANNUEL.cta}
                </span>
              </div>
            </div>
            <div aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
