"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ObserveSection } from "../ObserveSection";

const WAVEFORM_POINTS = 120;

function computeWaveformPeaks(buffer: AudioBuffer, numPoints: number): number[] {
  const data = buffer.length > 0 ? buffer.getChannelData(0) : new Float32Array(0);
  const blockSize = Math.floor(data.length / numPoints) || 1;
  const peaks: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize && start + j < data.length; j++) {
      const v = Math.abs(data[start + j]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

function DemoWaveform({
  peaks,
  duration,
  currentTime,
  className = "",
}: {
  peaks: number[];
  duration: number;
  currentTime: number;
  className?: string;
}) {
  const maxPeak = useMemo(() => Math.max(...peaks, 0.01), [peaks]);
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!peaks.length || duration <= 0) {
    return (
      <div
        className={`h-12 w-full rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-500 text-xs ${className}`}
      >
        Démo à venir
      </div>
    );
  }

  return (
    <div className={`relative h-12 w-full rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden ${className}`}>
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {peaks.map((p, i) => {
          const x = (i / (peaks.length - 1 || 1)) * 100;
          const halfH = (p / maxPeak) * 50;
          return (
            <line
              key={i}
              x1={x}
              y1={50 - halfH}
              x2={x}
              y2={50 + halfH}
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-slate-400"
            />
          );
        })}
      </svg>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/60 pointer-events-none transition-[left] duration-75 ease-linear"
        style={{ left: `${playheadPercent}%` }}
      />
    </div>
  );
}

type DemoId = "hiphop" | "rnb" | "rap";

const DEMOS: { id: DemoId; title: string; desc: string }[] = [
  { id: "hiphop", title: "Hip-Hop", desc: "Voix claire sur instrumentale." },
  { id: "rnb", title: "R&B", desc: "Mix chaleureux et spatial." },
  { id: "rap", title: "Rap", desc: "Punch et présence vocale." },
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
}: {
  demo: (typeof DEMOS)[number];
  index: number;
}) {
  const [mode, setMode] = useState<"avant" | "apres">("avant");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveforms, setWaveforms] = useState<{
    avant: { peaks: number[]; duration: number } | null;
    apres: { peaks: number[]; duration: number } | null;
  }>({ avant: null, apres: null });
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const urls = useMemo(() => getDemoAudioUrls(demo.id), [demo.id]);
  const currentWaveform = mode === "avant" ? waveforms.avant : waveforms.apres;
  const currentDuration = currentWaveform?.duration ?? 0;

  // Decode both files only when card is in view (avoids OOM: 6 WAVs decoded at once)
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    const obs = new IntersectionObserver(
      (entries) => {
        if (cancelled || !entries[0]?.isIntersecting) return;
        obs.disconnect();
        setLoadError(false);
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        Promise.all([
          fetch(urls.avant)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .then((ab) => (ab ? ctx.decodeAudioData(ab) : null)),
          fetch(urls.apres)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .then((ab) => (ab ? ctx.decodeAudioData(ab) : null)),
        ])
          .then(([bufAvant, bufApres]) => {
            if (cancelled) return;
            setWaveforms({
              avant: bufAvant ? { peaks: computeWaveformPeaks(bufAvant, WAVEFORM_POINTS), duration: bufAvant.duration } : null,
              apres: bufApres ? { peaks: computeWaveformPeaks(bufApres, WAVEFORM_POINTS), duration: bufApres.duration } : null,
            });
          })
          .catch(() => {
            if (!cancelled) setLoadError(true);
          })
          .finally(() => {
            ctx.close();
          });
      },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [urls.avant, urls.apres]);

  // Single audio element: switch src when mode changes
  const currentSrc = mode === "avant" ? urls.avant : urls.apres;

  // Reset playhead and stop when switching mode
  useEffect(() => {
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, [mode]);

  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (el) setCurrentTime(el.currentTime);
  }, []);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);
  const handlePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [isPlaying]);
  const handleCanPlay = useCallback(() => {
    const el = audioRef.current;
    if (el && isPlaying) el.play().catch(() => {});
  }, [isPlaying]);

  // Sync currentTime from audio element (playhead)
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const el = audioRef.current;
      if (el) setCurrentTime(el.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const hasAudio = (waveforms.avant != null || waveforms.apres != null) && !loadError;
  const canPlayCurrent = currentWaveform != null;

  return (
    <div
      ref={cardRef}
      className={`landing-card group p-5 sm:p-6 flex flex-col ${index === 0 ? "observe-stagger-1" : index === 1 ? "observe-stagger-2" : "observe-stagger-3"}`}
    >
      <p className="font-heading font-semibold text-white">{demo.title}</p>
      <p className="mt-0.5 text-sm text-slate-400">{demo.desc}</p>

      {/* Waveform (one, for current mode) */}
      <div className="mt-4 w-full">
        <DemoWaveform
          peaks={currentWaveform?.peaks ?? []}
          duration={currentDuration}
          currentTime={currentTime}
        />
      </div>

      {/* Play + Avant / Après */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlay}
          disabled={!canPlayCurrent}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? "Pause" : "Lecture"}
        >
          {isPlaying ? (
            <span className="text-lg leading-none">&#10074;&#10074;</span>
          ) : (
            <span className="ml-0.5 text-lg leading-none">&#9654;</span>
          )}
        </button>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setMode("avant")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "avant" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Avant
          </button>
          <button
            type="button"
            onClick={() => setMode("apres")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "apres" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Après
          </button>
        </div>
      </div>

      {/* Hidden audio for playback */}
      {hasAudio && (
        <audio
          ref={audioRef}
          src={currentSrc}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onCanPlayThrough={handleCanPlay}
          preload="auto"
          className="hidden"
        />
      )}

      <Link
        href="/mix"
        className="mt-4 inline-block text-sm font-medium text-white underline decoration-white/40 underline-offset-2 transition-colors hover:decoration-white"
      >
        Essayer une démo
      </Link>
    </div>
  );
}

export function BeforeAfterSection() {
  return (
    <section className="px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1">
            Avant / Après
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            Écoutez le résultat
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Exemples mixés avec Siberia Mix.
          </p>
        </div>
        <div className="mx-auto mt-5 grid max-w-5xl gap-6 sm:grid-cols-3">
          {DEMOS.map((demo, i) => (
            <DemoCard key={demo.id} demo={demo} index={i} />
          ))}
        </div>
        <div className="mx-auto mt-5 max-w-2xl text-center observe-stagger-4">
          <Link
            href="/mix"
            className="btn-cta-secondary inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-medium sm:w-auto"
          >
            Mixer votre propre morceau
          </Link>
        </div>
      </ObserveSection>
    </section>
  );
}
