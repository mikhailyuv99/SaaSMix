"use client";

import { useState } from "react";
import Link from "next/link";
import { ObserveSection } from "../ObserveSection";

const plansMensuel = [
  { name: "Starter", subtitle: "Pour découvrir", price: "—", tokens: "Tokens inclus : à définir", cta: "Bientôt", featured: false },
  { name: "Creator", subtitle: "Pour les artistes réguliers", price: "—", tokens: "Tokens inclus : à définir", cta: "Bientôt", featured: true },
  { name: "Pro", subtitle: "Mix + master à volonté", price: "—", tokens: "Tokens inclus : à définir", cta: "Bientôt", featured: false },
];

const planAnnuel = {
  name: "Pro annuel",
  subtitle: "Économisez sur l'année",
  price: "—",
  tokens: "Prix avantageux, à définir",
  cta: "Bientôt",
  featured: true,
};

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"mensuel" | "annuel">("mensuel");

  return (
    <section id="tarifs" className="scroll-mt-20 px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1">
            Tarification
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            Tarifs
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Choisissez la formule qui vous convient.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel */}
        <div className="mx-auto mt-6 flex justify-center observe-stagger-4">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("mensuel")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "annuel"
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Annuel
            </button>
          </div>
        </div>

        <div className="mx-auto mt-5 grid max-w-5xl gap-6 sm:grid-cols-3">
          {billingPeriod === "mensuel" ? (
            plansMensuel.map((plan, i) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 transition-all duration-300 sm:p-8 ${
                  i === 0 ? "observe-stagger-4" : i === 1 ? "observe-stagger-5" : "observe-stagger-6"
                } ${
                  plan.featured
                    ? "scale-[1.02] border-white/25 bg-white/[0.06] shadow-xl shadow-black/20 ring-1 ring-white/10 hover:border-white/30 hover:shadow-2xl hover:shadow-black/30"
                    : "landing-card border-white/10"
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
                <p className="mt-1 text-sm text-slate-400">{plan.tokens}</p>
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
            ))
          ) : (
            <div className="sm:col-span-3 flex justify-center">
              <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-white/[0.06] shadow-xl shadow-black/20 ring-1 ring-white/10 p-6 sm:p-8 observe-stagger-4">
                {planAnnuel.featured && (
                  <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-400">
                    Avantageux
                  </span>
                )}
                <h3 className="mt-3 font-heading text-xl font-semibold text-white">{planAnnuel.name}</h3>
                <p className="text-sm text-slate-400">{planAnnuel.subtitle}</p>
                <p className="mt-5 font-heading text-2xl font-bold text-white">{planAnnuel.price}</p>
                <p className="mt-1 text-sm text-slate-400">{planAnnuel.tokens}</p>
                <div className="mt-6">
                  <span className="inline-block w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-center text-sm text-slate-400">
                    {planAnnuel.cta}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-slate-400 observe-stagger-4">
          Les tarifs et volumes de tokens seront fixés prochainement. En attendant, vous pouvez{" "}
          <Link
            href="/mix"
            className="font-medium text-white underline decoration-white/40 underline-offset-2 transition-colors hover:decoration-white"
          >
            tester le mix gratuitement
          </Link>
          .
        </p>
      </ObserveSection>
    </section>
  );
}
