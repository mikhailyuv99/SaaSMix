"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const DISPLAY_PLANS_MENSUEL = [
  { name: "Starter", subtitle: "Pour découvrir", price: "9,99 €", features: "10 téléchargements mix / mois\n3 téléchargements master / mois\n5 sauvegardes de projets", cta: "Choisir ce plan", featured: false },
  { name: "Artiste", subtitle: "Pour les artistes réguliers", price: "19,99 €", features: "30 téléchargements mix / mois\n15 téléchargements master / mois\n15 sauvegardes de projets", cta: "Choisir ce plan", featured: true },
  { name: "Pro", subtitle: "Mix + master à volonté", price: "29,99 €", features: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités", cta: "Choisir ce plan", featured: false },
];

const DISPLAY_PLAN_ANNUEL = {
  name: "Pro annuel",
  subtitle: "Économisez 25 %",
  price: "269 €",
  features: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
  cta: "Choisir ce plan",
  featured: true,
};

type PlanFromApi = { name: string; priceId: string };

export function PricingModal({
  isOpen,
  onClose,
  onSelectPlan,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (priceId: string, planName: string) => void;
}) {
  const [billingPeriod, setBillingPeriod] = useState<"mensuel" | "annuel">("mensuel");
  const [nameToPriceId, setNameToPriceId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/api/billing/plans`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const map: Record<string, string> = {};
        (d.plansMonthly || []).forEach((p: PlanFromApi) => {
          map[p.name] = p.priceId;
        });
        if (d.planAnnual) map[d.planAnnual.name] = d.planAnnual.priceId;
        setNameToPriceId(map);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const plansForPeriod =
    billingPeriod === "mensuel"
      ? DISPLAY_PLANS_MENSUEL.map((plan, i) => ({ plan, invisible: false, index: i }))
      : [
          { plan: DISPLAY_PLANS_MENSUEL[0], invisible: true, index: 0 },
          { plan: DISPLAY_PLAN_ANNUEL, invisible: false, index: 1 },
          { plan: DISPLAY_PLANS_MENSUEL[2], invisible: true, index: 2 },
        ];

  return (
    <div className="modal-backdrop-slate fixed inset-0 z-[9999] flex items-center justify-center p-4 max-lg:p-3 overflow-y-auto" onClick={onClose}>
      <div className="backdrop-blur-layer" aria-hidden="true" />
      <div className="backdrop-tint-layer" aria-hidden="true" />
      <div
        className="modal-panel-dark rounded-2xl border border-white/15 backdrop-blur-xl shadow-xl shadow-black/20 w-full max-w-5xl max-h-[90vh] overflow-y-auto my-auto relative max-lg:max-w-[calc(100vw-1.5rem)] max-lg:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-slate-400 hover:text-white text-lg leading-none p-1"
          aria-label="Fermer"
        >
          &times;
        </button>

        <div className="p-6 sm:p-8 max-lg:p-4 max-sm:p-2">
          <div className="text-center mb-6 max-lg:mb-4">
            <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 max-md:text-xs">Tarification</p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-white sm:text-3xl max-lg:text-xl">Choisir une formule</h2>
            <p className="mt-2 text-slate-400 text-sm max-md:text-xs">Abonnement lié à votre compte. Paiement sécurisé Stripe.</p>
          </div>

          <div className="flex justify-center mb-5 max-md:mb-4">
            <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 max-md:p-0.5">
              <button
                type="button"
                onClick={() => setBillingPeriod("mensuel")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors max-md:px-3 max-md:py-1.5 max-md:text-xs ${
                  billingPeriod === "mensuel" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annuel")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-md:px-3 max-md:py-1.5 max-md:text-xs ${
                  billingPeriod === "annuel" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Annuel
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold text-white ring-1 ring-white/30 max-md:text-[10px] max-md:px-1.5">−25%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-4 max-lg:gap-3 max-md:gap-2 max-sm:gap-1.5 items-stretch">
            {plansForPeriod.map(({ plan, invisible, index: i }) => {
              const priceId = nameToPriceId[plan.name];
              const badgeLabel = plan.name === "Pro annuel" ? "−25%" : plan.featured ? "Populaire" : null;
              return (
                <div
                  key={plan.name + (invisible ? "-ghost" : "")}
                  className={`rounded-2xl border p-5 sm:p-6 flex flex-col min-h-[320px] max-lg:min-h-[300px] max-lg:p-3 max-lg:rounded-xl max-md:p-2 max-md:min-h-[300px] max-sm:p-1.5 max-sm:min-h-[300px] min-w-0 overflow-hidden ${
                    invisible ? "invisible" : ""
                  } ${
                    plan.featured
                      ? "border-white/25 bg-white/[0.06] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2),0_0_40px_rgba(255,255,255,0.22)] ring-1 ring-white/10 hover:border-white/30"
                      : "border-white/10 bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 min-h-[2rem] min-w-0 shrink-0 max-sm:min-h-[1.5rem]">
                    <h3 className="font-heading text-lg font-semibold text-white max-md:text-sm max-sm:text-[11px] truncate">{plan.name}</h3>
                    {badgeLabel && (
                      <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-400 max-md:text-[9px] max-md:px-1.5 max-sm:text-[8px] max-sm:px-1">
                        {badgeLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-400 max-md:text-xs max-sm:text-[10px] break-words">{plan.subtitle}</p>
                  <p className={`font-heading text-xl font-bold text-white max-md:text-base max-sm:text-sm mt-3 shrink-0 ${i === 0 || plan.name === "Pro annuel" ? "max-lg:mt-8" : ""}`}>{plan.price}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-400 flex-1 min-h-0 min-w-0 max-md:text-xs max-md:space-y-0.5 max-sm:text-[10px] max-sm:space-y-0.5 overflow-hidden">
                    {plan.features.split("\n").map((line, j) => (
                      <li key={j} className="flex items-start gap-2 max-md:gap-1 max-sm:gap-0.5 min-w-0 break-words">
                        <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-white/50 max-md:size-1 max-sm:size-1" aria-hidden />
                        <span className="min-w-0">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-3 shrink-0 max-sm:mt-2 max-sm:pt-2">
                    <button
                      type="button"
                      disabled={invisible || !priceId}
                      onClick={() => {
                        if (invisible || !priceId) return;
                        onSelectPlan(priceId, plan.name);
                      }}
                      className={`w-full rounded-xl border px-4 py-2.5 text-center text-sm transition-colors uppercase max-md:py-2 max-md:text-xs max-sm:py-1 max-sm:text-[10px] max-sm:px-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        plan.featured ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "border-white/15 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
