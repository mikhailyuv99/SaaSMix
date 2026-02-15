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
  onSeek,
  className = "",
}: {
  peaks: number[];
  duration: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maxPeak = useMemo(() => Math.max(...peaks, 0.01), [peaks]);
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  // Étirer le contenu sur toute la largeur si la piste a du silence en fin (ex. Hiver)
  const contentEnd = useMemo(() => {
    const threshold = maxPeak * 0.02;
    let last = peaks.length - 1;
    while (last > 0 && peaks[last] < threshold) last--;
    return Math.max(last, 1);
  }, [peaks, maxPeak]);
  const scaleX = (i: number) => (contentEnd > 0 ? (i / contentEnd) * 100 : (i / (peaks.length - 1 || 1)) * 100);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration <= 0 || !onSeek) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, x / rect.width));
      onSeek(fraction * duration);
    },
    [duration, onSeek]
  );

  if (!peaks.length || duration <= 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      role={onSeek ? "button" : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? handleClick : undefined}
      onKeyDown={
        onSeek
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSeek(0.5 * duration);
              }
            }
          : undefined
      }
      className={`relative h-12 w-full min-w-0 rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden cursor-pointer ${className}`}
      title={onSeek ? "Cliquer pour aller à ce moment" : undefined}
    >
      <svg className="absolute inset-0 w-full h-full min-w-0 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
        {peaks.slice(0, contentEnd + 1).map((p, i) => {
          const x = Math.min(100, scaleX(i));
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
}: {
  demo: (typeof DEMOS)[number];
  index: number;
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
  const audioAvantRef = useRef<HTMLAudioElement | null>(null);
  const audioApresRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  const urls = useMemo(() => getDemoAudioUrls(demo.id), [demo.id]);
  const currentWaveform = mode === "avant" ? waveforms.avant : waveforms.apres;
  const currentDuration = currentWaveform?.duration ?? 0;
  const maxDuration = useMemo(
    () => Math.max(waveforms.avant?.duration ?? 0, waveforms.apres?.duration ?? 0),
    [waveforms.avant?.duration, waveforms.apres?.duration]
  );

  // Decode both files only when card is in view (avoids OOM: 6 WAVs decoded at once)
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
    };
  }, [urls.avant, urls.apres]);

  // Mute/unmute when switching Avant/Après + resync both to same currentTime (évite décalage si fichiers légèrement désalignés)
  useEffect(() => {
    const a = audioAvantRef.current;
    const b = audioApresRef.current;
    if (!a || !b) return;
    const t = a.currentTime;
    a.currentTime = t;
    b.currentTime = t;
    a.muted = mode !== "avant";
    b.muted = mode !== "apres";
  }, [mode]);

  const handleEnded = useCallback(() => {
    if (audioAvantRef.current) audioAvantRef.current.pause();
    if (audioApresRef.current) audioApresRef.current.pause();
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handlePlay = useCallback(() => {
    const a = audioAvantRef.current;
    const b = audioApresRef.current;
    if (!a || !b) return;
    if (isPlaying) {
      a.pause();
      b.pause();
      setIsPlaying(false);
    } else {
      const t = currentTime;
      a.currentTime = t;
      b.currentTime = t;
      a.muted = mode !== "avant";
      b.muted = mode !== "apres";
      Promise.all([a.play(), b.play()]).catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [isPlaying, mode, currentTime]);

  // Playhead: RAF loop when playing, read from avant (both in sync)
  useEffect(() => {
    if (!isPlaying) return;
    const tick = (now: number) => {
      const el = audioAvantRef.current;
      if (el) {
        const t = el.currentTime;
        if (now - lastTickRef.current >= 80) {
          lastTickRef.current = now;
          setCurrentTime(t);
        }
        if (el.ended) {
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const hasAudio = (waveforms.avant != null && waveforms.apres != null) && !loadError;
  const canPlayCurrent = hasAudio;

  const handleSeek = useCallback(
    (time: number) => {
      const a = audioAvantRef.current;
      const b = audioApresRef.current;
      if (a) a.currentTime = time;
      if (b) b.currentTime = time;
      setCurrentTime(time);
    },
    []
  );

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
            <DemoWaveform
              peaks={currentWaveform?.peaks ?? []}
              duration={maxDuration > 0 ? maxDuration : currentDuration}
              currentTime={currentTime}
              onSeek={handleSeek}
              className="h-full w-full"
            />
          </div>
        )}
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

      {/* Two audio elements, play both in sync, mute one according to mode */}
      {hasAudio && (
        <>
          <audio
            ref={audioAvantRef}
            src={urls.avant}
            onEnded={handleEnded}
            preload="auto"
            className="hidden"
          />
          <audio
            ref={audioApresRef}
            src={urls.apres}
            onEnded={handleEnded}
            preload="auto"
            className="hidden"
          />
        </>
      )}

    </div>
  );
}

export function BeforeAfterSection() {
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
            <DemoCard key={demo.id} demo={demo} index={i} />
          ))}
        </div>
        <div className="w-full max-w-2xl mx-auto mt-5 text-center observe-stagger-4 max-lg:mt-4 max-md:mt-3 box-border">
          <Link
            href="/mix"
            className="btn-cta-secondary inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-medium sm:w-auto max-lg:py-3 max-md:text-xs"
          >
            Mixer votre propre morceau
          </Link>
        </div>
      </ObserveSection>
    </section>
  );
}
