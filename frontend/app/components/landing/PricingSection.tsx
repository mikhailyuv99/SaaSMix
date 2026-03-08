"use client";

import { useState } from "react";
import { ObserveSection } from "../ObserveSection";

const plansMensuel = [
  {
    name: "Starter",
    subtitle: "Pour découvrir",
    price: "9,99 €",
    features: "10 téléchargements mix / mois\n3 téléchargements master / mois\n5 sauvegardes de projets",
    cta: "Choisir ce plan",
    featured: false,
  },
  {
    name: "Artiste",
    subtitle: "Pour les artistes réguliers",
    price: "19,99 €",
    features: "30 téléchargements mix / mois\n15 téléchargements master / mois\n15 sauvegardes de projets",
    cta: "Choisir ce plan",
    featured: true,
  },
  {
    name: "Pro",
    subtitle: "Mix + master à volonté",
    price: "29,99 €",
    features: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
    cta: "Choisir ce plan",
    featured: false,
  },
];

const planAnnuel = {
  name: "Pro annuel",
  subtitle: "Économisez 25 %",
  price: "269 €",
  features: "Téléchargements mix illimités\nTéléchargements master illimités\nSauvegardes de projets illimités",
  cta: "Choisir ce plan",
  featured: true,
};

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"mensuel" | "annuel">("mensuel");

  return (
    <section id="tarifs" className="scroll-mt-20 w-full max-w-full overflow-x-hidden px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5 max-sm:px-2">
      <ObserveSection>
        <div className="w-full max-w-3xl mx-auto text-center box-border">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1 max-md:text-xs">
            Tarification
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2 max-lg:text-2xl max-md:text-xl">
            Tarifs
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3 max-lg:text-sm max-md:text-xs font-sans">
            Choisissez la formule qui vous convient.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel */}
        <div className="w-full max-w-5xl mx-auto mt-6 flex justify-center observe-stagger-4 max-lg:mt-5 max-md:mt-4 box-border">
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-transparent p-1 max-lg:flex-wrap max-lg:justify-center max-md:p-0.5">
            <button
              type="button"
              onClick={() => setBillingPeriod("mensuel")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors max-md:px-3 max-md:py-1.5 max-md:text-xs ${
                billingPeriod === "mensuel"
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annuel")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-md:px-3 max-md:py-1.5 max-md:text-xs ${
                billingPeriod === "annuel"
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Annuel
              <span className="badge-shimmer-loop rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold text-white max-md:text-[10px] max-md:px-1.5">
                −25%
              </span>
            </button>
          </div>
        </div>

        <div className="w-full max-w-5xl mx-auto mt-5 box-border overflow-x-hidden pb-1">
          <div className="mt-5 grid grid-cols-3 gap-6 sm:gap-6 max-lg:gap-3 max-md:mt-4 max-md:gap-2 max-sm:gap-1.5 items-stretch max-md:[grid-auto-rows:minmax(340px,1fr)] max-sm:[grid-auto-rows:minmax(340px,1fr)]">
          {(billingPeriod === "mensuel"
            ? plansMensuel.map((plan, i) => ({ plan, invisible: false, index: i }))
            : [
                { plan: plansMensuel[0], invisible: true, index: 0 },
                { plan: planAnnuel, invisible: false, index: 1 },
                { plan: plansMensuel[2], invisible: true, index: 2 },
              ]
          ).map(({ plan, invisible, index: i }) => {
            const badgeLabel = plan.name === "Pro annuel" ? "−25%" : (plan.featured ? "Populaire" : null);
            const cardContent = (
              <>
                <div className="flex items-center justify-between gap-1 min-h-[2rem] min-w-0 shrink-0 max-sm:min-h-[1.5rem]">
                  <h3 className="font-heading text-xl font-semibold text-white max-lg:text-sm max-md:text-xs max-sm:text-[11px] truncate">{plan.name}</h3>
                  {badgeLabel && (
                    <span className="badge-shimmer-loop shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-400 max-lg:text-[9px] max-lg:px-1.5 max-md:text-[8px] max-md:px-1 max-sm:text-[8px] max-sm:px-1">
                      {badgeLabel}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-400 max-lg:text-xs max-md:text-[10px] max-sm:text-[10px] break-words font-sans">{plan.subtitle}</p>
                <p className={`min-h-[2.5rem] flex items-center font-heading text-2xl font-bold text-white max-lg:text-lg max-md:text-base max-sm:text-sm mt-4 shrink-0 ${i === 0 || plan.name === "Pro annuel" ? "max-lg:mt-8" : ""}`}>{plan.price}</p>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-400 flex-1 min-h-0 min-w-0 max-lg:space-y-1 max-lg:text-xs max-md:text-[10px] max-md:space-y-0.5 max-sm:text-[10px] max-sm:space-y-0.5 overflow-hidden font-sans">
                  {plan.features.split("\n").map((line, j) => (
                    <li key={j} className="flex items-start gap-2.5 max-lg:gap-1.5 max-sm:gap-0.5 min-w-0 break-words">
                      <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-white/50 max-lg:size-1 max-sm:size-1" aria-hidden />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 shrink-0 max-sm:mt-2 max-sm:pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (invisible) return;
                      window.dispatchEvent(new CustomEvent("openPlanModal"));
                    }}
                    className={`pricing-plan-btn font-sans w-full rounded-xl border px-4 py-2.5 text-center text-sm transition-colors uppercase max-lg:py-2 max-lg:text-xs max-md:py-1.5 max-md:text-[10px] max-sm:py-1 max-sm:text-[10px] max-sm:px-2 ${
                      plan.featured
                        ? "btn-cta-accent !py-2.5 max-lg:!py-2 max-md:!py-1.5 max-sm:!py-1"
                        : "border-white/15 bg-transparent text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </>
            );
            const observeClass = i === 0 ? "observe-stagger-4" : i === 1 ? "observe-stagger-5" : "observe-stagger-6";
            return (
              <div
                key={plan.name + (invisible ? "-ghost" : "")}
                className={`rounded-2xl border p-6 transition-all duration-300 sm:p-8 flex flex-col min-h-[380px] max-lg:min-h-[340px] max-lg:p-3 max-lg:rounded-xl max-md:p-2 max-sm:p-1.5 min-w-0 overflow-hidden ${
                  invisible ? "invisible" : ""
                } ${observeClass} ${
                  plan.featured
                    ? "glow-border border-white/15 bg-white/[0.04] hover:border-white/20"
                    : "landing-card border-white/10"
                }`}
              >
                {cardContent}
              </div>
            );
          })}
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
