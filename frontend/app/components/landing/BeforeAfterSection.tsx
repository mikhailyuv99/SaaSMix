"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ObserveSection } from "../ObserveSection";
import { Waveform, computeWaveformPeaks, WAVEFORM_POINTS } from "../Waveform";

type DemoId = "hublot" | "motema" | "hiver";

const DEMOS: { id: DemoId; title: string; desc: string }[] = [
  { id: "hublot", title: "IKHA x 2face - HUBLOT", desc: "Avant / Après mix." },
  { id: "motema", title: "Sellig - MOTEMA", desc: "Avant / Après mix." },
  { id: "hiver", title: "Ikha - HIVER", desc: "Avant / Après mix." },
];

function getDemoAudioUrls(id: DemoId): { avant: string; apres: string } {
  return {
    avant: `/audio/demos/${id}-avant.wav`,
    apres: `/audio/demos/${id}-apres.wav`,
  };
}

function DemoCard({
  demo,
  index,
  registerAsSpaceTarget,
}: {
  demo: (typeof DEMOS)[number];
  index: number;
  registerAsSpaceTarget?: (playPause: () => void, getIsPlaying: () => boolean) => void;
}) {
  const [mode, setMode] = useState<"avant" | "apres">("avant");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [waveforms, setWaveforms] = useState<{
    avant: { peaks: number[]; duration: number } | null;
    apres: { peaks: number[]; duration: number } | null;
  }>({ avant: null, apres: null });
  const [loadError, setLoadError] = useState(false);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const decodedBuffersRef = useRef<{ avant: AudioBuffer | null; apres: AudioBuffer | null }>({ avant: null, apres: null });
  const playbackRef = useRef<{
    ctx: AudioContext;
    avantGain: GainNode;
    apresGain: GainNode;
    startTime: number;
    startOffset: number;
    duration: number;
  } | null>(null);
  const playPauseRef = useRef<() => void>(() => {});

  const urls = useMemo(() => getDemoAudioUrls(demo.id), [demo.id]);
  const currentWaveform = mode === "avant" ? waveforms.avant : waveforms.apres;
  const currentDuration = currentWaveform?.duration ?? 0;
  const maxDuration = useMemo(
    () => Math.max(waveforms.avant?.duration ?? 0, waveforms.apres?.duration ?? 0),
    [waveforms.avant?.duration, waveforms.apres?.duration]
  );

  const stopPlayback = useCallback(() => {
    const p = playbackRef.current;
    if (!p) return;
    try {
      p.ctx.close();
    } catch (_) {}
    playbackRef.current = null;
  }, []);

  // Decode both files only when card is in view (avoids OOM: 6 WAVs decoded at once). Store buffers for Web Audio playback (comme section mix).
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    setIsLoading(true);
    const obs = new IntersectionObserver(
      (entries) => {
        if (cancelled || !entries[0]?.isIntersecting) return;
        obs.disconnect();
        setLoadError(false);
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        Promise.all([
          fetch(urls.avant)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .then((ab) => (ab ? ctx.decodeAudioData(ab.slice(0)) : null)),
          fetch(urls.apres)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .then((ab) => (ab ? ctx.decodeAudioData(ab.slice(0)) : null)),
        ])
          .then(([bufAvant, bufApres]) => {
            if (cancelled) return;
            if (bufAvant) decodedBuffersRef.current.avant = bufAvant;
            if (bufApres) decodedBuffersRef.current.apres = bufApres;
            setWaveforms({
              avant: bufAvant ? { peaks: computeWaveformPeaks(bufAvant, WAVEFORM_POINTS), duration: bufAvant.duration } : null,
              apres: bufApres ? { peaks: computeWaveformPeaks(bufApres, WAVEFORM_POINTS), duration: bufApres.duration } : null,
            });
          })
          .catch(() => {
            if (!cancelled) setLoadError(true);
          })
          .finally(() => {
            if (!cancelled) setIsLoading(false);
            ctx.close();
          });
      },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => {
      cancelled = true;
      obs.disconnect();
      stopPlayback();
    };
  }, [urls.avant, urls.apres, stopPlayback]);

  const handleEnded = useCallback(() => {
    stopPlayback();
    setIsPlaying(false);
    setCurrentTime(0);
  }, [stopPlayback]);

  const startPlaybackAtOffset = useCallback(
    (offset: number) => {
      const buffers = decodedBuffersRef.current;
      if (!buffers.avant || !buffers.apres) return;
      const duration = Math.min(buffers.avant.duration, buffers.apres.duration);
      const safeOffset = Math.max(0, Math.min(offset, duration - 0.01));
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        ctx.resume?.();
        const avantGain = ctx.createGain();
        const apresGain = ctx.createGain();
        avantGain.gain.value = mode === "avant" ? 1 : 0;
        apresGain.gain.value = mode === "apres" ? 1 : 0;
        avantGain.connect(ctx.destination);
        apresGain.connect(ctx.destination);

        let ended = false;
        const onEnd = () => {
          if (ended) return;
          ended = true;
          handleEnded();
        };

        const avantSrc = ctx.createBufferSource();
        avantSrc.buffer = buffers.avant;
        avantSrc.connect(avantGain);
        avantSrc.onended = onEnd;
        avantSrc.start(0, safeOffset);

        const apresSrc = ctx.createBufferSource();
        apresSrc.buffer = buffers.apres;
        apresSrc.connect(apresGain);
        apresSrc.onended = onEnd;
        apresSrc.start(0, safeOffset);

        const startTime = ctx.currentTime;
        playbackRef.current = { ctx, avantGain, apresGain, startTime, startOffset: safeOffset, duration };
        setIsPlaying(true);
      } catch (_) {
        setIsPlaying(false);
      }
    },
    [mode, handleEnded]
  );

  const handlePlay = useCallback(() => {
    registerAsSpaceTarget?.(() => playPauseRef.current?.(), () => isPlaying);
    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
      return;
    }
    startPlaybackAtOffset(currentTime);
  }, [isPlaying, currentTime, startPlaybackAtOffset, stopPlayback, registerAsSpaceTarget]);

  useEffect(() => {
    playPauseRef.current = handlePlay;
  }, [handlePlay]);

  // Playhead: RAF loop when playing (comme section mix)
  useEffect(() => {
    if (!isPlaying) return;
    const tick = (now: number) => {
      const p = playbackRef.current;
      if (p) {
        const t = p.startOffset + (p.ctx.currentTime - p.startTime);
        if (now - lastTickRef.current >= 80) {
          lastTickRef.current = now;
          setCurrentTime(t);
        }
        if (t >= p.duration - 0.05) {
          handleEnded();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, handleEnded]);

  const hasAudio = (waveforms.avant != null && waveforms.apres != null) && !loadError;
  const canPlayCurrent = hasAudio;

  const handleSeek = useCallback(
    (time: number) => {
      registerAsSpaceTarget?.(() => playPauseRef.current?.(), () => isPlaying);
      setCurrentTime(time);
      const wasPlaying = !!playbackRef.current;
      if (playbackRef.current) stopPlayback();
      if (wasPlaying) startPlaybackAtOffset(time);
    },
    [stopPlayback, startPlaybackAtOffset, registerAsSpaceTarget]
  );

  // Switch Avant/Après via gains (comme section mix) — instant sur PC et mobile.
  const setModeAvant = useCallback(() => {
    const p = playbackRef.current;
    if (p) {
      p.avantGain.gain.value = 1;
      p.apresGain.gain.value = 0;
    }
    setMode("avant");
  }, []);
  const setModeApres = useCallback(() => {
    const p = playbackRef.current;
    if (p) {
      p.avantGain.gain.value = 0;
      p.apresGain.gain.value = 1;
    }
    setMode("apres");
  }, []);

  return (
    <div
      ref={cardRef}
      className={`landing-card group p-5 sm:p-6 flex flex-col min-w-0 max-lg:p-4 max-md:p-3 ${index === 0 ? "observe-stagger-1" : index === 1 ? "observe-stagger-2" : "observe-stagger-3"}`}
    >
      <p className="font-heading font-semibold text-white max-md:text-sm">{demo.title}</p>
      <p className="mt-0.5 text-sm text-slate-400 max-md:text-xs">{demo.desc}</p>

      {/* Waveform (current mode) or loading spinner - prend toute la largeur dispo */}
      <div className="mt-4 w-full min-w-0 rounded-lg border border-white/[0.06] h-12 overflow-hidden relative">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center bg-white/[0.04]">
            <svg className="animate-spin h-6 w-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="absolute inset-0 min-w-0">
            <Waveform
              peaks={currentWaveform?.peaks ?? []}
              duration={maxDuration > 0 ? maxDuration : currentDuration}
              currentTime={currentTime}
              onSeek={handleSeek}
              className="h-full w-full"
            />
          </div>
        )}
      </div>

      {/* Play + Avant / Après — sur mobile: même taille/icônes que les pistes mix (max-md:w-11, SVG w-4) */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlay}
          disabled={!canPlayCurrent}
          className="flex h-10 w-10 max-md:h-11 max-md:w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? "Pause" : "Lecture"}
        >
          {isPlaying ? (
            <>
              <span className="text-lg leading-none max-md:hidden">&#10074;&#10074;</span>
              <svg className="hidden w-4 h-4 shrink-0 max-md:block" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </>
          ) : (
            <>
              <span className="ml-0.5 text-lg leading-none max-md:hidden">&#9654;</span>
              <svg className="hidden w-4 h-4 shrink-0 max-md:block" fill="currentColor" viewBox="-0.333 0 24 24" aria-hidden><path d="M8 5v14l11-7L8 5z"/></svg>
            </>
          )}
        </button>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={setModeAvant}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "avant" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Avant
          </button>
          <button
            type="button"
            onClick={setModeApres}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "apres" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Après
          </button>
        </div>
      </div>

    </div>
  );
}

export function BeforeAfterSection({
  registerDemoPlayback,
}: {
  registerDemoPlayback?: (playPause: () => void, getIsPlaying: () => boolean) => void;
} = {}) {
  const router = useRouter();
  return (
    <section className="w-full max-w-full overflow-x-hidden px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5">
      <ObserveSection>
        <div className="w-full max-w-3xl mx-auto text-center box-border">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1 max-md:text-xs">
            Avant / Après
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2 max-lg:text-2xl max-md:text-xl">
            Écoutez le résultat
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3 max-lg:text-sm max-md:text-xs">
            Exemples mixés avec Siberia Mix.
          </p>
        </div>
        <div className="w-full max-w-5xl mx-auto mt-5 grid gap-6 sm:grid-cols-3 max-lg:mt-4 max-lg:gap-4 max-md:mt-3 max-md:gap-3 box-border">
          {DEMOS.map((demo, i) => (
            <DemoCard key={demo.id} demo={demo} index={i} registerAsSpaceTarget={registerDemoPlayback} />
          ))}
        </div>
        <div className="w-full max-w-2xl mx-auto mt-5 text-center observe-stagger-4 max-lg:mt-4 max-md:mt-3 box-border">
          <Link
            href="/mix"
            className="btn-cta-secondary inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-medium sm:w-auto max-lg:py-3 max-md:text-xs"
            onClick={(e) => { e.preventDefault(); router.push("/mix"); }}
          >
            Mixer votre propre morceau
          </Link>
        </div>
      </ObserveSection>
    </section>
  );
}
