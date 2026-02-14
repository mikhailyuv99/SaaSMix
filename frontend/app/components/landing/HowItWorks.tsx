"use client";

import { useState } from "react";
import Link from "next/link";
import { ObserveSection } from "../ObserveSection";
import { ObserveElement } from "../ObserveElement";

const steps = [
  {
    num: 1,
    title: "Uploadez vos stems et votre instrumental",
    desc: "Glissez-déposez vos pistes vocales et votre beat en WAV. Compatible navigateur sur Mac, PC, tablette et mobile.",
    icon: "upload",
  },
  {
    num: 2,
    title: "Choisissez la catégorie de chaque piste",
    desc: "Indiquez pour chaque fichier s’il s’agit d’un lead vocal, d’adlibs/backs ou de l’instrumentale. Le moteur adapte le traitement en conséquence.",
    icon: "category",
  },
  {
    num: 3,
    title: "Réglez et lancez le mix",
    desc: "Ajustez de-esser, réverb, delay, tonalité et autres options par piste, puis lancez le mix. Résultat en quelques secondes.",
    icon: "ai",
  },
  {
    num: 4,
    title: "Écoutez, ajustez et téléchargez",
    desc: "Comparez avant/après, modifiez vos réglages si besoin, puis exportez votre mix final en WAV prêt pour les plateformes.",
    icon: "download",
  },
];

function StepIcon({ icon }: { icon: string }) {
  if (icon === "upload") {
    return (
      <svg className="h-6 w-6 shrink-0 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    );
  }
  if (icon === "ai") {
    return (
      <svg className="h-6 w-6 shrink-0 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  }
  if (icon === "download") {
    return (
      <svg className="h-6 w-6 shrink-0 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    );
  }
  if (icon === "category") {
    return (
      <svg className="h-6 w-6 shrink-0 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    );
  }
  return null;
}

export function HowItWorks() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section id="comment-ca-marche" className="scroll-mt-20 px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1">
            Process
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            Comment ça marche
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            De la piste brute au morceau fini en quatre étapes — sans plugin, tout dans le navigateur.
          </p>
        </div>

        <div className="relative mx-auto mt-8 max-w-4xl sm:mt-10">
          {/* Ligne verticale (pleine hauteur) */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/20" />

          {steps.map((step, i) => {
            const isLeft = i % 2 === 0;
            return (
              <div
                key={step.num}
                className={`relative flex items-center gap-0 ${i < steps.length - 1 ? "mb-6 sm:mb-8" : ""}`}
              >
                {/* Partie gauche */}
                <div className={`flex-1 ${isLeft ? "pr-4 sm:pr-6" : "sm:pr-6"}`}>
                  {isLeft && (
                    <ObserveElement className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-6">
                      <div className="flex items-start gap-4">
                        <StepIcon icon={step.icon} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-lg font-semibold text-white sm:text-xl">{step.title}</h3>
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === step.num ? null : step.num)}
                            className="mt-2 flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
                          >
                            Lire la suite
                            <svg className={`h-4 w-4 transition-transform ${expanded === step.num ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {expanded === step.num && <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.desc}</p>}
                        </div>
                      </div>
                    </ObserveElement>
                  )}
                </div>

                {/* Centre : cercle sur la ligne */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-[#0a0a0a] font-heading text-sm font-bold text-white shadow-lg sm:h-12 sm:w-12">
                  {step.num}
                </div>

                {/* Partie droite */}
                <div className={`flex-1 ${!isLeft ? "pl-4 sm:pl-6" : "sm:pl-6"}`}>
                  {!isLeft && (
                    <ObserveElement className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-6">
                      <div className="flex items-start gap-4">
                        <StepIcon icon={step.icon} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-lg font-semibold text-white sm:text-xl">{step.title}</h3>
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === step.num ? null : step.num)}
                            className="mt-2 flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
                          >
                            Lire la suite
                            <svg className={`h-4 w-4 transition-transform ${expanded === step.num ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {expanded === step.num && <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.desc}</p>}
                        </div>
                      </div>
                    </ObserveElement>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-8 max-w-2xl space-y-5 sm:mt-10 observe-stagger-4">
          <div className="text-center">
            <Link href="/mix" className="btn-cta-secondary inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-medium sm:w-auto">
              Essayer ces 4 étapes avec vos pistes
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 sm:gap-8">
            <span>Aperçu pleine longueur</span>
            <span>Pas de carte bancaire</span>
            <span>Vous gardez vos droits</span>
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
