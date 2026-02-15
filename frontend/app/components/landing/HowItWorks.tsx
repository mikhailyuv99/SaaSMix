"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ObserveSection } from "../ObserveSection";
import { ObserveElement } from "../ObserveElement";

/** Play-button blue-gray from landing (Aperçu pleine longueur) */
const CIRCLE_BG = "#2C313B";

const steps = [
  {
    num: 1,
    title: "Uploadez vos stems et votre instrumental",
    desc: "Glissez-déposez vos pistes vocales et votre instrumentale en WAV. Compatible navigateur sur Mac, PC, tablette et mobile.",
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
  const sectionRef = useRef<HTMLElement>(null);
  const [lineProgress, setLineProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const sectionH = rect.height;
      const sectionTop = rect.top;
      // Progress 0→1 over ~50% of section scroll so step 4 is reached without scrolling too far
      const effectiveHeight = viewportH + sectionH * 0.5;
      const progress = (viewportH - sectionTop) / effectiveHeight;
      setLineProgress(Math.min(1, Math.max(0, progress)));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={sectionRef} id="comment-ca-marche" className="scroll-mt-20 px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center max-lg:max-w-none">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1 max-md:text-xs">
            Process
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2 max-lg:text-2xl max-md:text-xl">
            Comment ça marche
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3 max-lg:text-sm max-md:text-xs">
            De la piste brute au morceau fini en quatre étapes — sans plugin, tout dans le navigateur.
          </p>
        </div>

        <div className="relative mx-auto mt-8 max-w-4xl sm:mt-10 max-lg:mt-6 max-md:mt-5">
          {/* Ligne verticale : fond + progression blanche lumineuse */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/20" />
          <div
            className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-white transition-all duration-500 ease-out"
            style={{
              height: `${lineProgress * 100}%`,
              boxShadow: "0 0 12px rgba(255,255,255,0.8), 0 0 24px rgba(255,255,255,0.4)",
            }}
          />

          {steps.map((step, i) => {
            const isLeft = i % 2 === 0;
            const threshold = (i + 0.5) / steps.length;
            const isGlowing = lineProgress >= threshold;
            return (
              <div
                key={step.num}
                className={`relative flex items-center gap-0 max-lg:flex-col max-lg:items-stretch max-lg:gap-4 ${i < steps.length - 1 ? "mb-6 sm:mb-8 max-lg:mb-5 max-md:mb-4" : ""}`}
              >
                {/* Partie gauche */}
                <div className={`flex-1 max-lg:w-full ${isLeft ? "pr-4 sm:pr-6 max-lg:pr-0" : "sm:pr-6 max-lg:pr-0"}`}>
                  {isLeft && (
                    <ObserveElement className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-6 max-lg:p-4 max-md:p-3">
                      <div className="flex items-start gap-4 max-md:gap-3">
                        <StepIcon icon={step.icon} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-lg font-semibold text-white sm:text-xl max-lg:text-base max-md:text-sm">{step.title}</h3>
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

                {/* Centre : cercle sur la ligne (couleur play button + glow au scroll) */}
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-heading text-sm font-bold shadow-lg transition-all duration-500 sm:h-12 sm:w-12 max-lg:self-center max-lg:order-first max-lg:-order-1 ${
                    isGlowing
                      ? "border-white/80 bg-white/15 text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]"
                      : "border-white/25 text-white/90"
                  }`}
                  style={{ backgroundColor: isGlowing ? undefined : CIRCLE_BG }}
                >
                  {isGlowing && (
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        boxShadow: "0 0 20px rgba(255,255,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)",
                      }}
                    />
                  )}
                  <span className="relative z-[1]">{step.num}</span>
                </div>

                {/* Partie droite */}
                <div className={`flex-1 max-lg:w-full ${!isLeft ? "pl-4 sm:pl-6 max-lg:pl-0" : "sm:pl-6 max-lg:pl-0"}`}>
                  {!isLeft && (
                    <ObserveElement className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-6 max-lg:p-4 max-md:p-3">
                      <div className="flex items-start gap-4 max-md:gap-3">
                        <StepIcon icon={step.icon} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-lg font-semibold text-white sm:text-xl max-lg:text-base max-md:text-sm">{step.title}</h3>
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

        <div className="mx-auto mt-8 max-w-2xl space-y-5 sm:mt-10 observe-stagger-4 max-lg:mt-6 max-md:mt-5 max-md:space-y-4">
          <div className="text-center">
            <Link href="/mix" className="btn-cta-secondary inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-medium sm:w-auto max-lg:py-3 max-md:text-xs">
              Essayer ces 4 étapes avec vos pistes
            </Link>
          </div>
          <div className="flex flex-nowrap items-center justify-center gap-6 text-xs text-slate-400 sm:gap-8 whitespace-nowrap flex-wrap max-lg:gap-3 max-md:gap-2 max-md:text-[10px]">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-[10px] text-slate-400">▶</span>
              Aperçu pleine longueur
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x={1} y={4} width={22} height={16} rx={2} ry={2} />
                  <line x1={1} y1={10} x2={23} y2={10} />
                </svg>
              </span>
              Pas de carte bancaire
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-400">✓</span>
              Vous gardez vos droits
            </span>
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
