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
  const [accordionOpen, setAccordionOpen] = useState<number>(1);

  return (
    <section id="tarifs" className="scroll-mt-20 w-full max-w-full overflow-x-hidden px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5">
      <ObserveSection>
        <div className="w-full max-w-3xl mx-auto text-center box-border">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1 max-md:text-xs">
            Tarification
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2 max-lg:text-2xl max-md:text-xl">
            Tarifs
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3 max-lg:text-sm max-md:text-xs">
            Choisissez la formule qui vous convient.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel */}
        <div className="w-full max-w-5xl mx-auto mt-6 flex justify-center observe-stagger-4 max-lg:mt-5 max-md:mt-4 box-border">
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 max-lg:flex-wrap max-lg:justify-center max-md:p-0.5">
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
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold text-white ring-1 ring-white/30 max-md:text-[10px] max-md:px-1.5">
                −25%
              </span>
            </button>
          </div>
        </div>

        <div className="w-full max-w-5xl mx-auto mt-5 box-border">
          {/* Desktop: grid */}
          <div className={`gap-6 sm:grid-cols-3 max-lg:gap-4 max-md:mt-4 max-md:gap-3 ${billingPeriod === "mensuel" ? "mt-5 grid max-lg:hidden" : "mt-5 grid"}`}>
          {billingPeriod === "mensuel" ? (
            plansMensuel.map((plan, i) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 transition-all duration-300 sm:p-8 flex flex-col min-h-[380px] max-lg:min-h-0 max-lg:p-5 max-md:p-4 ${
                  i === 0 ? "observe-stagger-4" : i === 1 ? "observe-stagger-5" : "observe-stagger-6"
                } ${
                  plan.featured
                    ? "scale-[1.02] border-white/25 bg-white/[0.06] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2),0_0_40px_rgba(255,255,255,0.22)] ring-1 ring-white/10 hover:border-white/30 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35),0_0_48px_rgba(255,255,255,0.28)]"
                    : "landing-card border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2 max-md:flex-wrap">
                  <h3 className="font-heading text-xl font-semibold text-white max-lg:text-lg max-md:text-base">{plan.name}</h3>
                  {plan.featured && (
                    <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-400 max-md:text-[10px] max-md:px-2">
                      Populaire
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-400 max-md:text-xs">{plan.subtitle}</p>
                <p className="mt-5 font-heading text-2xl font-bold text-white max-lg:mt-4 max-lg:text-xl max-md:text-lg">{plan.price}</p>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-400 max-lg:space-y-2 max-md:text-xs">
                  {plan.features.split("\n").map((line, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-white/50" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 mt-auto">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("openPlanModal"))}
                    className={`w-full rounded-xl border px-4 py-2.5 text-center text-sm transition-colors uppercase ${
                      plan.featured ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "border-white/15 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="observe-stagger-4" aria-hidden />
              <div className="rounded-2xl border border-white/25 bg-white/[0.06] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2),0_0_40px_rgba(255,255,255,0.22)] ring-1 ring-white/10 p-6 sm:p-8 observe-stagger-5 sm:scale-[1.02] flex flex-col min-h-[380px] max-lg:min-h-0 max-lg:p-5 max-md:p-4">
                <div className="flex items-start justify-between gap-2 max-md:flex-wrap">
                  <h3 className="font-heading text-xl font-semibold text-white max-lg:text-lg max-md:text-base">{planAnnuel.name}</h3>
                  {planAnnuel.featured && (
                    <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-400 max-md:text-[10px] max-md:px-2">
                      Économisez 25%
                    </span>
                  )}
                </div>
                <p className="mt-5 font-heading text-2xl font-bold text-white max-lg:mt-4 max-lg:text-xl max-md:text-lg">{planAnnuel.price}</p>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-400 max-lg:space-y-2 max-md:text-xs">
                  {planAnnuel.features.split("\n").map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-white/50" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 mt-auto">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("openPlanModal"))}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-center text-sm text-white transition-colors hover:bg-white/10 uppercase"
                  >
                    {planAnnuel.cta}
                  </button>
                </div>
              </div>
              <div className="observe-stagger-6" aria-hidden />
            </>
          )}
          </div>

          {/* Mobile/tablet: accordion (mensuel only), Artiste ouvert par défaut */}
          {billingPeriod === "mensuel" && (
            <div className="lg:hidden flex flex-row gap-2 mt-5 w-full max-w-5xl mx-auto">
              {plansMensuel.map((plan, i) => (
                <div
                  key={plan.name}
                  className={`flex-1 min-w-0 flex flex-col rounded-xl border transition-all duration-200 overflow-hidden ${
                    accordionOpen === i
                      ? "border-white/25 bg-white/[0.06] ring-1 ring-white/10"
                      : "landing-card border-white/10"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setAccordionOpen(i)}
                    className="w-full py-4 px-3 text-center border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <h3 className="font-heading font-semibold text-white text-sm truncate">{plan.name}</h3>
                    <p className="mt-0.5 font-heading text-lg font-bold text-white">{plan.price}</p>
                    {plan.featured && (
                      <span className="mt-1 inline-block rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">Populaire</span>
                    )}
                  </button>
                  {accordionOpen === i && (
                    <div className="p-3 flex flex-col flex-1 min-h-0">
                      <p className="text-xs text-slate-400">{plan.subtitle}</p>
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
                        {plan.features.split("\n").map((line, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 size-1 rounded-full bg-white/50" aria-hidden />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("openPlanModal"))}
                        className={`mt-4 w-full rounded-lg border px-3 py-2 text-center text-xs transition-colors uppercase ${
                          plan.featured ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "border-white/15 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {plan.cta}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ObserveSection>
    </section>
  );
}
