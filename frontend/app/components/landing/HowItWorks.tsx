"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ObserveSection } from "../ObserveSection";
import { ObserveElement } from "../ObserveElement";

const CIRCLE_BG = "#1e1d2c";

const steps = [
  {
    num: 1,
    title: "Uploadez vos stems et votre instrumentale",
    desc: "Glissez-déposez vos pistes vocales et votre instrumentale en WAV. Compatible navigateur sur Mac, PC, tablette et mobile.",
    icon: "upload",
  },
  {
    num: 2,
    title: "Choisissez la catégorie de chaque piste",
    desc: "Indiquez pour chaque fichier s'il s'agit d'un lead vocal, d'adlibs/backs ou de l'instrumentale. Le moteur adapte le traitement en conséquence.",
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

const SEGMENT_STARTS = [0, 0.12, 0.52, 0.72, 0.88];
const SEGMENT_ENDS = [0.12, 0.52, 0.72, 0.88, 1];
const CIRCLE_THRESHOLDS = [0.12, 0.52, 0.72, 0.88];
const SMOOTH_FACTOR = 0.09;

export function HowItWorks() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segmentWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segmentFillRefs = useRef<(HTMLDivElement | null)[]>([]);

  const targetRef = useRef(0);
  const smoothedRef = useRef(0);
  const rafId = useRef<number | null>(null);
  const smoothRafId = useRef<number | null>(null);
  const prevGlow = useRef<boolean[]>([false, false, false, false]);

  const applySmoothed = useCallback((val: number) => {
    for (let s = 0; s < 5; s++) {
      const start = SEGMENT_STARTS[s];
      const span = SEGMENT_ENDS[s] - start;
      const fill = span > 0 ? Math.min(1, Math.max(0, (val - start) / span)) : 0;
      const el = segmentFillRefs.current[s];
      if (el) el.style.transform = `scaleY(${fill})`;
    }
  }, []);

  const applyGlow = useCallback((progress: number) => {
    for (let i = 0; i < 4; i++) {
      const glowing = progress >= CIRCLE_THRESHOLDS[i];
      if (glowing === prevGlow.current[i]) continue;
      prevGlow.current[i] = glowing;
      const el = circleRefs.current[i];
      if (!el) continue;
      if (glowing) {
        el.classList.add("hiw-glow");
        el.classList.remove("hiw-dim");
      } else {
        el.classList.remove("hiw-glow");
        el.classList.add("hiw-dim");
      }
    }
  }, []);

  const computeLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const contRect = container.getBoundingClientRect();
    const contTop = contRect.top;
    const contH = contRect.height;

    const circleTops: number[] = [];
    const circleBottoms: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      const circleEl = circleRefs.current[i];
      if (!circleEl) continue;
      const r = circleEl.getBoundingClientRect();
      circleTops.push(r.top - contTop);
      circleBottoms.push(r.top - contTop + r.height);
    }
    if (circleTops.length < 4) return;

    const positions = [
      { top: 0, height: Math.max(0, circleTops[0]) },
      { top: circleBottoms[0], height: Math.max(0, circleTops[1] - circleBottoms[0]) },
      { top: circleBottoms[1], height: Math.max(0, circleTops[2] - circleBottoms[1]) },
      { top: circleBottoms[2], height: Math.max(0, circleTops[3] - circleBottoms[2]) },
      { top: circleBottoms[3], height: Math.max(0, contH - circleBottoms[3]) },
    ];
    for (let s = 0; s < 5; s++) {
      const el = segmentWrapRefs.current[s];
      if (el) {
        el.style.top = `${positions[s].top}px`;
        el.style.height = `${positions[s].height}px`;
      }
    }
  }, []);

  const startSmoothing = useCallback(() => {
    if (smoothRafId.current !== null) return;
    const tick = () => {
      const diff = targetRef.current - smoothedRef.current;
      if (Math.abs(diff) < 0.0005) {
        smoothedRef.current = targetRef.current;
        applySmoothed(targetRef.current);
        smoothRafId.current = null;
        return;
      }
      smoothedRef.current += diff * SMOOTH_FACTOR;
      applySmoothed(smoothedRef.current);
      smoothRafId.current = requestAnimationFrame(tick);
    };
    smoothRafId.current = requestAnimationFrame(tick);
  }, [applySmoothed]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const rect = section.getBoundingClientRect();
        const vh = window.innerHeight;
        const effectiveH = vh + rect.height * 0.35;
        const progress = Math.min(1, Math.max(0, (vh - rect.top) / effectiveH));
        targetRef.current = progress;
        applyGlow(progress);
        computeLayout();
        startSmoothing();
      });
    };

    const onResize = () => requestAnimationFrame(computeLayout);
    computeLayout();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      if (smoothRafId.current !== null) cancelAnimationFrame(smoothRafId.current);
    };
  }, [applyGlow, computeLayout, startSmoothing]);

  return (
    <section ref={sectionRef} id="comment-ca-marche" className="scroll-mt-20 w-full max-w-full px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5">
      <ObserveSection>
        <div className="w-full max-w-3xl mx-auto text-center box-border">
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
      </ObserveSection>

      <div ref={containerRef} className="w-full max-w-4xl mx-auto relative isolate mt-8 sm:mt-10 max-lg:mt-6 max-md:mt-5 box-border" style={{ transformStyle: "preserve-3d" }}>
          <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ zIndex: -1, transform: "translateZ(-1px)" }}>
          {[0, 1, 2, 3, 4].map((segIndex) => (
            <div
              key={segIndex}
              ref={(el) => { segmentWrapRefs.current[segIndex] = el; }}
              className="absolute left-1/2 w-px -translate-x-1/2 overflow-hidden"
            >
              <div className="absolute inset-0 w-px bg-white/20" />
              <div
                ref={(el) => { segmentFillRefs.current[segIndex] = el; }}
                className="absolute left-0 top-0 h-full w-px origin-top bg-white will-change-transform"
                style={{
                  transform: "scaleY(0)",
                  boxShadow: "0 0 12px rgba(105,163,255,0.7), 0 0 24px rgba(105,163,255,0.35)",
                }}
              />
            </div>
          ))}
          </div>

          <div className="relative z-10 min-h-0" style={{ transform: "translateZ(0)" }}>
          {steps.map((step, i) => {
            const isLeft = i % 2 === 0;
            return (
              <div
                key={step.num}
                className={`relative z-10 flex items-center gap-0 max-lg:flex-col max-lg:items-stretch max-lg:gap-4 ${i < steps.length - 1 ? "mb-6 sm:mb-8 max-lg:mb-5 max-md:mb-4" : ""}`}
              >
                <div className={`relative z-10 flex-1 max-lg:w-full ${isLeft ? "pr-4 sm:pr-6 max-lg:pr-0" : "sm:pr-6 max-lg:pr-0"}`}>
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

                <div
                  ref={(el) => { circleRefs.current[i] = el; }}
                  className="hiw-dim relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-heading text-sm font-bold shadow-lg transition-all duration-500 sm:h-12 sm:w-12 max-lg:self-center max-lg:order-first max-lg:-order-1"
                >
                  <span className="hiw-glow-ring pointer-events-none absolute inset-0 rounded-full" />
                  <span className="relative z-[1]">{step.num}</span>
                </div>

                <div className={`relative z-10 flex-1 max-lg:w-full ${!isLeft ? "pl-4 sm:pl-6 max-lg:pl-0" : "sm:pl-6 max-lg:pl-0"}`}>
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
      </div>

      <ObserveSection>
        <div className="w-full max-w-2xl mx-auto mt-8 space-y-5 sm:mt-10 observe-stagger-4 max-lg:mt-6 max-md:mt-5 max-md:space-y-4 box-border pt-2">
          <div className="text-center -mt-2 relative z-10">
            <Link
              href="/mix"
              className="btn-cta-secondary inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-medium sm:w-auto max-lg:py-3 max-md:text-xs"
              onClick={(e) => { e.preventDefault(); router.push("/mix"); }}
            >
              Essayer ces 4 étapes avec vos pistes
            </Link>
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
