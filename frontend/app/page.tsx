"use client";

import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { CustomSelect } from "./components/CustomSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Category = "lead_vocal" | "adlibs_backs" | "instrumental";

export interface MixParams {
  delay: boolean;
  reverb: boolean;
  reverb_mode: 1 | 2 | 3;
  tone_low: 1 | 2 | 3;
  tone_mid: 1 | 2 | 3;
  tone_high: 1 | 2 | 3;
  air: boolean;
  bpm: number;
  delay_division: "1/4" | "1/2" | "1/8";
  phone_fx: boolean;
  doubler: boolean;
  robot: boolean;
}

const DEFAULT_MIX_PARAMS: MixParams = {
  delay: true,
  reverb: true,
  reverb_mode: 2,
  tone_low: 2,
  tone_mid: 2,
  tone_high: 2,
  air: false,
  bpm: 120,
  delay_division: "1/4",
  phone_fx: false,
  doubler: false,
  robot: false,
};

interface Track {
  id: string;
  file: File | null;
  category: Category;
  gain: number;
  rawAudioUrl: string | null;
  mixedAudioUrl: string | null;
  isMixing: boolean;
  playMode: "raw" | "mixed";
  mixParams: MixParams;
  paramsOpen?: boolean;
  waveformPeaks?: number[];
  waveformDuration?: number;
  /** Après restauration depuis sessionStorage : nom du fichier pour recharger depuis IndexedDB */
  rawFileName?: string | null;
}

const CATEGORY_LABELS: Record<Category, string> = {
  lead_vocal: "LEAD VOCAL",
  adlibs_backs: "ADLIBS/BACKS",
  instrumental: "INSTRUMENTALE",
};

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function extractMixedTrackId(mixedAudioUrl: string | null): string | undefined {
  if (!mixedAudioUrl) return undefined;
  try {
    const url = mixedAudioUrl.startsWith("http") ? mixedAudioUrl : `${API_BASE}${mixedAudioUrl}`;
    const params = new URL(url).searchParams;
    return params.get("id") ?? undefined;
  } catch {
    const m = mixedAudioUrl.match(/[?&]id=([a-f0-9\-]{36})/i);
    return m ? m[1] : undefined;
  }
}

const WAVEFORM_POINTS = 200;
const TRACKS_STORAGE_KEY = "saas_mix_tracks";
const FILES_DB_NAME = "saas_mix_files";
const FILES_STORE_NAME = "files";

function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILES_DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => req.result.createObjectStore(FILES_STORE_NAME, { keyPath: "id" });
  });
}

function saveFileToIDB(trackId: string, file: File): void {
  if (typeof window === "undefined") return;
  openFilesDB().then((db) => {
    const tx = db.transaction(FILES_STORE_NAME, "readwrite");
    const store = tx.objectStore(FILES_STORE_NAME);
    store.put({ id: trackId, blob: file, fileName: file.name });
    db.close();
  }).catch(() => {});
}

function getFileFromIDB(trackId: string): Promise<{ blob: Blob; fileName: string } | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return openFilesDB().then((db) => {
    return new Promise<{ blob: Blob; fileName: string } | null>((resolve) => {
      const tx = db.transaction(FILES_STORE_NAME, "readonly");
      const req = tx.objectStore(FILES_STORE_NAME).get(trackId);
      req.onsuccess = () => {
        const row = req.result as { blob: Blob; fileName: string } | undefined;
        db.close();
        resolve(row ? { blob: row.blob, fileName: row.fileName } : null);
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  }).catch(() => null);
}

function deleteFileFromIDB(trackId: string): void {
  if (typeof window === "undefined") return;
  openFilesDB().then((db) => {
    const tx = db.transaction(FILES_STORE_NAME, "readwrite");
    tx.objectStore(FILES_STORE_NAME).delete(trackId);
    db.close();
  }).catch(() => {});
}

/** Sauvegarde sérialisable d'une piste (sans File ni blob URLs) pour sessionStorage */
function tracksToStorage(tracks: Track[]): string {
  return JSON.stringify(
    tracks.map((t) => ({
      id: t.id,
      category: t.category,
      gain: t.gain,
      mixParams: t.mixParams,
      mixedAudioUrl: t.mixedAudioUrl,
      rawFileName: t.file?.name ?? t.rawFileName ?? null,
    }))
  );
}

/** Restaure des pistes depuis sessionStorage (file et rawAudioUrl à null) */
function tracksFromStorage(): Track[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TRACKS_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as Array<{
      id: string;
      category: Category;
      gain: number;
      mixParams: MixParams;
      mixedAudioUrl: string | null;
      rawFileName?: string | null;
    }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((t) => ({
      id: t.id,
      file: null,
      category: t.category,
      gain: t.gain,
      rawAudioUrl: null,
      mixedAudioUrl: t.mixedAudioUrl ?? null,
      isMixing: false,
      playMode: "mixed" as const,
      mixParams: t.mixParams ?? { ...DEFAULT_MIX_PARAMS },
      paramsOpen: false,
      rawFileName: t.rawFileName ?? null,
    }));
  } catch {
    return null;
  }
}

function computeWaveformPeaks(buffer: AudioBuffer, numPoints: number): number[] {
  const data = buffer.length > 0 ? buffer.getChannelData(0) : new Float32Array(0);
  const blockSize = Math.floor(data.length / numPoints);
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

const Waveform = memo(function Waveform({
  peaks,
  duration,
  currentTime,
  onSeek,
  className = "",
}: {
  peaks: number[];
  duration: number;
  currentTime?: number;
  onSeek: (time: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  if (!peaks.length || duration <= 0) return null;
  const maxPeak = useMemo(() => Math.max(...peaks, 0.01), [peaks]);
  const playheadPercent = currentTime != null ? (currentTime / duration) * 100 : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onSeek(fraction * duration);
  };

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const el = containerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            onSeek(0.5 * duration);
          }
        }
      }}
      className={`relative h-12 w-full cursor-pointer rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden transition-opacity hover:opacity-90 ${className}`}
      title="Cliquer pour aller à ce moment"
    >
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
              className="text-slate-500"
            />
          );
        })}
      </svg>
      {currentTime != null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/60 pointer-events-none transition-[left] duration-75 ease-linear"
          style={{ left: `${playheadPercent}%` }}
        />
      )}
    </div>
  );
});

function getDefaultTracks(): Track[] {
  return [
    {
      id: generateId(),
      file: null,
      category: "lead_vocal",
      gain: 100,
      rawAudioUrl: null,
      mixedAudioUrl: null,
      isMixing: false,
      playMode: "mixed",
      mixParams: { ...DEFAULT_MIX_PARAMS },
    },
    {
      id: generateId(),
      file: null,
      category: "instrumental",
      gain: 100,
      rawAudioUrl: null,
      mixedAudioUrl: null,
      isMixing: false,
      playMode: "mixed",
      mixParams: { ...DEFAULT_MIX_PARAMS },
    },
  ];
}

const DEFAULT_TRACKS: Track[] = getDefaultTracks();

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPausedPosition, setHasPausedPosition] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [pausedAtSeconds, setPausedAtSeconds] = useState<number>(0);
  const [isRenderingMix, setIsRenderingMix] = useState(false);
  const [isMastering, setIsMastering] = useState(false);
  const [masterResult, setMasterResult] = useState<{ mixUrl: string; masterUrl: string } | null>(null);
  const [masterPlaybackMode, setMasterPlaybackMode] = useState<"mix" | "master">("master");
  const [masterWaveforms, setMasterWaveforms] = useState<{
    mix: { peaks: number[]; duration: number };
    master: { peaks: number[]; duration: number };
  } | null>(null);
  const [masterPlaybackCurrentTime, setMasterPlaybackCurrentTime] = useState(0);
  const [isMasterResultPlaying, setIsMasterResultPlaying] = useState(false);
  const [masterResumeFrom, setMasterResumeFrom] = useState(0);
  const [gainSliderHoveredTrackId, setGainSliderHoveredTrackId] = useState<string | null>(null);
  const [focusedCategoryTrackId, setFocusedCategoryTrackId] = useState<string | null>(null);
  const [fileChooserActiveTrackId, setFileChooserActiveTrackId] = useState<string | null>(null);
  const [focusedBpmTrackId, setFocusedBpmTrackId] = useState<string | null>(null);
  const [focusedToneSelect, setFocusedToneSelect] = useState<{ trackId: string; type: "tone_low" | "tone_mid" | "tone_high" } | null>(null);
  const [noFileMessageTrackId, setNoFileMessageTrackId] = useState<string | null>(null);
  const [showMasterMessage, setShowMasterMessage] = useState(false);
  const [showPlayNoFileMessage, setShowPlayNoFileMessage] = useState(false);
  const [mixedPreloadReady, setMixedPreloadReady] = useState<Record<string, boolean>>({});
  const [showLoginMixMessage, setShowLoginMixMessage] = useState(false);
  const [showLoginMasterMessage, setShowLoginMasterMessage] = useState(false);
  const [showLoginMasterDownloadMessage, setShowLoginMasterDownloadMessage] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string; created_at: string | null }[]>([]);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);
  const [mixProgress, setMixProgress] = useState<Record<string, number>>({});
  const mixSimulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mixSimulationStartRef = useRef<number>(0);
  const mixFinishIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mixProgressTargetRef = useRef<Record<string, number>>({}); // cible % backend (job) pour affichage lissé
  const mixSmoothIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MIX_ESTIMATED_DURATION_MS = 85000; // 0→99% temps (fallback backend synchrone)
  const MIX_PROGRESS_TICK_MS = 50;
  type AppModal =
    | { type: "prompt"; title: string; defaultValue?: string; onConfirm: (value: string) => void; onCancel: () => void }
    | { type: "confirm"; message: string; onConfirm: () => void; onCancel: () => void }
    | { type: "alert"; message: string; onClose: () => void }
    | null;
  const [appModal, setAppModal] = useState<AppModal>(null);
  const [promptInputValue, setPromptInputValue] = useState("");

  useEffect(() => {
    if (appModal?.type === "prompt") setPromptInputValue(appModal.defaultValue ?? "");
  }, [appModal]);

  const masterMixBufferRef = useRef<AudioBuffer | null>(null);
  const masterMasterBufferRef = useRef<AudioBuffer | null>(null);
  const masterPlaybackRef = useRef<{
    mixSource: AudioBufferSourceNode;
    masterSource: AudioBufferSourceNode;
    mixGain: GainNode;
    masterGain: GainNode;
  } | null>(null);
  const masterStartTimeRef = useRef<number>(0);

  const contextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const buffersRef = useRef<Map<string, { raw: AudioBuffer | null; mixed: AudioBuffer | null }>>(new Map());
  const startTimeRef = useRef<number>(0);
  const resumeFromRef = useRef<number | null>(null);
  const lastSeekRef = useRef<{ offset: number; time: number }>({ offset: -1, time: 0 });
  const userPausedRef = useRef<boolean>(false);
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const preloadMixedRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isFirstSaveRef = useRef(true);
  const playAllRef = useRef<(override?: { playable?: Track[]; startOffset?: number }) => void>(() => {});

  // Utilisateur connecté (localStorage) + restauration des pistes depuis sessionStorage (après hydratation)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("saas_mix_user");
      if (raw) {
        const u = JSON.parse(raw) as { id: string; email: string };
        if (u?.id && u?.email) setUser(u);
      }
      const restored = tracksFromStorage();
      if (restored && restored.length > 0) setTracks(restored);
    } catch (_) {}
  }, []);

  // Sauvegarder les pistes dans sessionStorage (débounce 300ms pour éviter écritures répétées = fluidité)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(TRACKS_STORAGE_KEY, tracksToStorage(tracks));
      } catch (_) {}
    }, 300);
    return () => clearTimeout(t);
  }, [tracks]);

  // Playhead pour les waveforms : mise à jour throttlée (~10/s) pour garder l'UI fluide
  const playbackThrottleRef = useRef<number>(0);
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const throttleMs = 100;
    const tick = () => {
      const ctx = contextRef.current;
      if (ctx) {
        const now = Date.now();
        if (now - playbackThrottleRef.current >= throttleMs) {
          playbackThrottleRef.current = now;
          setPlaybackPosition(ctx.currentTime - startTimeRef.current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const currentTimeForWaveform = isPlaying ? playbackPosition : pausedAtSeconds;

  // Quand on change de résultat master, arrêter le playback
  useEffect(() => {
    if (!masterResult) {
      const nodes = masterPlaybackRef.current;
      if (nodes) {
        try {
          nodes.mixSource.onended = null;
          nodes.masterSource.onended = null;
          nodes.mixSource.disconnect();
          nodes.masterSource.disconnect();
          nodes.mixSource.stop();
          nodes.masterSource.stop();
        } catch (_) {}
        masterPlaybackRef.current = null;
      }
      setIsMasterResultPlaying(false);
      setMasterWaveforms(null);
      masterMixBufferRef.current = null;
      masterMasterBufferRef.current = null;
    }
  }, [masterResult]);

  // Waveforms du résultat master (mix + master) quand on a les URLs
  useEffect(() => {
    if (!masterResult) return;
    let cancelled = false;
    (async () => {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      try {
        const [mixRes, masterRes] = await Promise.all([
          fetch(masterResult.mixUrl),
          fetch(masterResult.masterUrl),
        ]);
        if (cancelled) return;
        const [mixBuf, masterBuf] = await Promise.all([
          mixRes.arrayBuffer().then((b) => ctx.decodeAudioData(b)),
          masterRes.arrayBuffer().then((b) => ctx.decodeAudioData(b)),
        ]);
        if (cancelled) return;
        masterMixBufferRef.current = mixBuf;
        masterMasterBufferRef.current = masterBuf;
        setMasterWaveforms({
          mix: {
            peaks: computeWaveformPeaks(mixBuf, WAVEFORM_POINTS),
            duration: mixBuf.duration,
          },
          master: {
            peaks: computeWaveformPeaks(masterBuf, WAVEFORM_POINTS),
            duration: masterBuf.duration,
          },
        });
      } catch (_) {
        if (!cancelled) setMasterWaveforms(null);
      } finally {
        ctx.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [masterResult]);

  // Au démontage (ex. navigation vers Connexion/Inscription) : arrêter toute lecture pour éviter "ghost" audio au retour
  useEffect(() => {
    return () => {
      const trackNodes = Array.from(trackPlaybackRef.current.entries());
      trackPlaybackRef.current.clear();
      for (const [, nodes] of trackNodes) {
        try {
          if (nodes.type === "instrumental") {
            if ("bufferNode" in nodes && nodes.bufferNode) {
              try {
                nodes.bufferNode.onended = null;
                nodes.bufferNode.stop();
                nodes.bufferNode.disconnect();
              } catch (_) {}
            } else if ("media" in nodes) {
              nodes.media.element.onended = null;
              nodes.media.element.pause();
              if (nodes.media.source) nodes.media.source.disconnect();
            }
          } else {
            if (nodes.rawMedia) {
              nodes.rawMedia.element.onended = null;
              nodes.rawMedia.element.pause();
              if (nodes.rawMedia.source) if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect();
            }
            if (nodes.rawBufferNode) {
              try {
                nodes.rawBufferNode.onended = null;
                nodes.rawBufferNode.stop();
                nodes.rawBufferNode.disconnect();
              } catch (_) {}
            }
            if (nodes.rawUnlockGain) nodes.rawUnlockGain.disconnect();
            if (nodes.mixedMedia) {
              nodes.mixedMedia.element.onended = null;
              nodes.mixedMedia.element.pause();
              if (nodes.mixedMedia.source) if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect();
            }
            if (nodes.mixedBufferNode) {
              try {
                nodes.mixedBufferNode.stop();
                nodes.mixedBufferNode.disconnect();
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
      const masterNodes = masterPlaybackRef.current;
      if (masterNodes) {
        try {
          masterNodes.mixSource.onended = null;
          masterNodes.masterSource.onended = null;
          masterNodes.mixSource.disconnect();
          masterNodes.masterSource.disconnect();
          masterNodes.mixSource.stop();
          masterNodes.masterSource.stop();
        } catch (_) {}
        masterPlaybackRef.current = null;
      }
      const ctx = contextRef.current;
      if (ctx) {
        try {
          ctx.close();
        } catch (_) {}
        contextRef.current = null;
      }
    };
  }, []);

  // Déblocage audio mobile : au premier touch/click, créer le contexte, jouer un buffer silencieux + un <audio> silencieux (iOS)
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  useEffect(() => {
    function doUnlock() {
      if (audioUnlockedRef.current) return;
      try {
        let ctx = contextRef.current;
        if (!ctx) {
          ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          contextRef.current = ctx;
        }
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
          const numSamples = Math.max(1, Math.min(Math.ceil(ctx.sampleRate * 0.05), 4096));
          const buf = ctx.createBuffer(1, numSamples, ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
        const au = new Audio(SILENT_WAV);
        au.volume = 0;
        au.play().catch(() => {});
        audioUnlockedRef.current = true;
      } catch (_) {}
    }
    const events: (keyof DocumentEventMap)[] = ["touchstart", "touchend", "mousedown", "click"];
    const handler = () => {
      doUnlock();
      events.forEach((ev) => document.documentElement.removeEventListener(ev, handler));
    };
    events.forEach((ev) => document.documentElement.addEventListener(ev, handler, { passive: true }));
    return () => events.forEach((ev) => document.documentElement.removeEventListener(ev, handler));
  }, []);

  // Pré-décode des buffers dès qu’un fichier est choisi (contexte déjà créé par premier touch). Au tap Play les buffers sont prêts = 0 latence + son sur mobile.
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    const playable = tracks.filter((t) => t.file && t.rawAudioUrl);
    for (const t of playable) {
      const rawUrl = t.rawAudioUrl
        ? t.rawAudioUrl.startsWith("http") || t.rawAudioUrl.startsWith("blob:")
          ? t.rawAudioUrl
          : `${API_BASE}${t.rawAudioUrl}`
        : null;
      const mixedUrl =
        t.playMode === "mixed" && t.mixedAudioUrl
          ? t.mixedAudioUrl.startsWith("http")
            ? t.mixedAudioUrl
            : `${API_BASE}${t.mixedAudioUrl}`
          : null;
      decodeTrackBuffers(t.id, rawUrl, mixedUrl).catch(() => {});
    }
  }, [tracks]);

  // Quand la fenêtre reprend le focus (ex. fermeture du sélecteur de fichiers), retirer le glow "fichier .wav"
  useEffect(() => {
    const onWindowFocus = () => setFileChooserActiveTrackId(null);
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, []);

  // Playhead du master : throttlé pour fluidité
  const masterPlaybackThrottleRef = useRef<number>(0);
  useEffect(() => {
    if (!isMasterResultPlaying) return;
    let raf = 0;
    const throttleMs = 100;
    const tick = () => {
      const ctx = contextRef.current;
      if (ctx) {
        const now = Date.now();
        if (now - masterPlaybackThrottleRef.current >= throttleMs) {
          masterPlaybackThrottleRef.current = now;
          setMasterPlaybackCurrentTime(ctx.currentTime - masterStartTimeRef.current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isMasterResultPlaying]);

  type VocalNodes = {
    type: "vocal";
    rawMedia: { element: HTMLAudioElement; source: MediaElementAudioSourceNode | null } | null;
    rawBufferNode: AudioBufferSourceNode | null;
    rawUnlockGain: GainNode | null;
    mixedMedia: { element: HTMLAudioElement; source: MediaElementAudioSourceNode | null } | null;
    mixedBufferNode: AudioBufferSourceNode | null;
    rawGain: GainNode;
    mixedGain: GainNode;
    mainGain: GainNode;
  };
  type InstrumentalNodes =
    | { type: "instrumental"; bufferNode: AudioBufferSourceNode; mainGain: GainNode }
    | { type: "instrumental"; media: { element: HTMLAudioElement; source: MediaElementAudioSourceNode | null }; mainGain: GainNode };
  const trackPlaybackRef = useRef<Map<string, VocalNodes | InstrumentalNodes>>(new Map());
  const isMobileRef = useRef(false);
  if (typeof window !== "undefined") isMobileRef.current = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  const addTrack = useCallback(() => {
    setTracks((prev) => {
      const isSecondTrack = prev.length === 1;
      return [
        ...prev,
        {
          id: generateId(),
          file: null,
          category: isSecondTrack ? "instrumental" : "lead_vocal",
          gain: 100,
          rawAudioUrl: null,
          mixedAudioUrl: null,
          isMixing: false,
          playMode: "mixed",
          mixParams: { ...DEFAULT_MIX_PARAMS },
        },
      ];
    });
  }, []);

  const removeTrack = useCallback((id: string) => {
    deleteFileFromIDB(id);
    const nodes = trackPlaybackRef.current.get(id);
    if (nodes) {
      if (nodes.type === "instrumental") {
        try {
          if ("bufferNode" in nodes && nodes.bufferNode) {
            nodes.bufferNode.stop();
            nodes.bufferNode.disconnect();
          } else if ("media" in nodes) {
            nodes.media.element.pause();
            if (nodes.media.source) nodes.media.source.disconnect();
          }
        } catch (_) {}
      } else {
        try {
          if (nodes.rawMedia) {
            nodes.rawMedia.element.pause();
            if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect();
          }
          if (nodes.rawBufferNode) {
            try {
              nodes.rawBufferNode.stop();
              nodes.rawBufferNode.disconnect();
            } catch (_) {}
          }
          if (nodes.rawUnlockGain) nodes.rawUnlockGain.disconnect();
          if (nodes.mixedMedia) {
            nodes.mixedMedia.element.pause();
            if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect();
          }
          if (nodes.mixedBufferNode) {
            try {
              nodes.mixedBufferNode.stop();
              nodes.mixedBufferNode.disconnect();
            } catch (_) {}
          }
        } catch (_) {}
      }
      trackPlaybackRef.current.delete(id);
    }
    if (trackPlaybackRef.current.size === 0) setIsPlaying(false);
    buffersRef.current.delete(id);
    setTracks((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t?.rawAudioUrl) URL.revokeObjectURL(t.rawAudioUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearTrackFile = useCallback((id: string) => {
    deleteFileFromIDB(id);
    const nodes = trackPlaybackRef.current.get(id);
    if (nodes) {
      if (nodes.type === "instrumental") {
        try {
          if ("bufferNode" in nodes && nodes.bufferNode) {
            nodes.bufferNode.stop();
            nodes.bufferNode.disconnect();
          } else if ("media" in nodes) {
            nodes.media.element.pause();
            if (nodes.media.source) nodes.media.source.disconnect();
          }
        } catch (_) {}
      } else {
        try {
          if (nodes.rawMedia) {
            nodes.rawMedia.element.pause();
            if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect();
          }
          if (nodes.rawBufferNode) {
            try {
              nodes.rawBufferNode.stop();
              nodes.rawBufferNode.disconnect();
            } catch (_) {}
          }
          if (nodes.rawUnlockGain) nodes.rawUnlockGain.disconnect();
          if (nodes.mixedMedia) {
            nodes.mixedMedia.element.pause();
            if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect();
          }
          if (nodes.mixedBufferNode) {
            try {
              nodes.mixedBufferNode.stop();
              nodes.mixedBufferNode.disconnect();
            } catch (_) {}
          }
        } catch (_) {}
      }
      trackPlaybackRef.current.delete(id);
    }
    if (trackPlaybackRef.current.size === 0) setIsPlaying(false);
    buffersRef.current.delete(id);
    setTracks((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t?.rawAudioUrl) URL.revokeObjectURL(t.rawAudioUrl);
      return prev.map((p) =>
        p.id === id
          ? {
              ...p,
              file: null,
              rawAudioUrl: null,
              rawFileName: null,
              mixedAudioUrl: null,
              waveformPeaks: undefined,
              waveformDuration: undefined,
            }
          : p
      );
    });
    if (typeof document !== "undefined") {
      const input = document.getElementById(`file-${id}`) as HTMLInputElement | null;
      if (input) input.value = "";
      const inputMob = document.getElementById(`file-mob-${id}`) as HTMLInputElement | null;
      if (inputMob) inputMob.value = "";
    }
  }, []);

  const updateTrack = useCallback(
    (id: string, updates: Partial<Omit<Track, "id">>) => {
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      if ("gain" in updates && updates.gain !== undefined) {
        const nodes = trackPlaybackRef.current.get(id);
        if (nodes) nodes.mainGain.gain.value = updates.gain / 100;
      }
    },
    []
  );

  // Réhydrater les fichiers depuis IndexedDB pour les pistes restaurées (rawFileName mais pas de file)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toHydrate = tracks.filter((t) => t.rawFileName && !t.file);
    toHydrate.forEach((track) => {
      const id = track.id;
      getFileFromIDB(id).then((data) => {
        if (!data) return;
        const file = new File([data.blob], data.fileName, { type: data.blob.type || "audio/wav" });
        const rawAudioUrl = URL.createObjectURL(file);
        updateTrack(id, { file, rawAudioUrl, rawFileName: null });
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        fetch(rawAudioUrl)
          .then((res) => res.arrayBuffer())
          .then((buf) => ctx.decodeAudioData(buf))
          .then((buffer) => {
            ctx.close();
            const peaks = computeWaveformPeaks(buffer, WAVEFORM_POINTS);
            updateTrack(id, { waveformPeaks: peaks, waveformDuration: buffer.duration });
          })
          .catch(() => ctx.close());
      });
    });
  }, [tracks, updateTrack]);

  const onFileSelect = useCallback(
    (id: string, file: File | null) => {
      if (file) saveFileToIDB(id, file);
      else deleteFileFromIDB(id);
      const rawAudioUrl =
        file && file.type.startsWith("audio/")
          ? URL.createObjectURL(file)
          : null;
      setTracks((prev) => {
        const track = prev.find((t) => t.id === id);
        if (!track) return prev;
        if (track.rawAudioUrl) URL.revokeObjectURL(track.rawAudioUrl);
        buffersRef.current.delete(id);
        return prev.map((t) =>
          t.id === id
            ? { ...t, file, rawAudioUrl, rawFileName: file?.name ?? null, playMode: "raw", waveformPeaks: undefined, waveformDuration: undefined }
            : t
        );
      });
      if (rawAudioUrl) {
        (async () => {
          try {
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const res = await fetch(rawAudioUrl);
            const buf = await res.arrayBuffer();
            const buffer = await ctx.decodeAudioData(buf);
            ctx.close();
            const peaks = computeWaveformPeaks(buffer, WAVEFORM_POINTS);
            updateTrack(id, {
              waveformPeaks: peaks,
              waveformDuration: buffer.duration,
            });
          } catch (_) {}
        })();
        (async () => {
          try {
            const ctx = contextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            if (!contextRef.current) contextRef.current = ctx;
            const res = await fetch(rawAudioUrl);
            const buf = await res.arrayBuffer();
            const decoded = await ctx.decodeAudioData(buf);
            const entry = buffersRef.current.get(id) ?? { raw: null, mixed: null };
            entry.raw = decoded;
            buffersRef.current.set(id, entry);
          } catch (_) {}
        })();
      }
    },
    [updateTrack]
  );

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("saas_mix_token");
    const h: Record<string, string> = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, []);

  const doCreateNewProject = useCallback(async (name: string) => {
    const defaultTracks = getDefaultTracks();
    const payload = defaultTracks.map((t) => ({
      id: t.id,
      category: t.category,
      gain: t.gain,
      mixParams: t.mixParams,
      mixedAudioUrl: null,
      rawFileName: null,
    }));
    const form = new FormData();
    form.append("name", name.trim());
    form.append("data", JSON.stringify(payload));
    setIsSavingProject(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: form,
      });
      if (res.status === 401) {
        localStorage.removeItem("saas_mix_token");
        localStorage.removeItem("saas_mix_user");
        setUser(null);
        setAppModal({ type: "alert", message: "Session expirée. Reconnectez-vous.", onClose: () => {} });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Erreur création");
      setCurrentProject({ id: data.id, name: data.name });
      setTracks(defaultTracks);
      setMasterResult(null);
      if (typeof window !== "undefined") {
        try {
          const db = await openFilesDB();
          const tx = db.transaction(FILES_STORE_NAME, "readwrite");
          await new Promise<void>((resolve, reject) => {
            const req = tx.objectStore(FILES_STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
          db.close();
        } catch (_) {}
        sessionStorage.removeItem(TRACKS_STORAGE_KEY);
      }
      setAppModal({ type: "alert", message: "Projet créé.", onClose: () => {} });
    } catch (e) {
      setAppModal({ type: "alert", message: e instanceof Error ? e.message : "Erreur lors de la création.", onClose: () => {} });
    } finally {
      setIsSavingProject(false);
    }
  }, [getAuthHeaders]);

  const createNewProject = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
    if (!token) return;
    setAppModal({
      type: "prompt",
      title: "Nom du projet ?",
      onConfirm: (value) => { if (value?.trim()) doCreateNewProject(value); },
      onCancel: () => {},
    });
  }, [doCreateNewProject]);

  const doSaveProject = useCallback(async (name: string | null) => {
    const isUpdate = currentProject != null;
    const payload = tracks.map((t) => ({
      id: t.id,
      category: t.category,
      gain: t.gain,
      mixParams: t.mixParams,
      mixedAudioUrl: t.mixedAudioUrl,
      rawFileName: t.file?.name ?? t.rawFileName ?? null,
    }));
    const form = new FormData();
    form.append("data", JSON.stringify(payload));
    tracks.forEach((t) => {
      if (t.file) form.append("files", t.file);
    });
    if (isUpdate) form.append("name", currentProject!.name);
    else if (name?.trim()) form.append("name", name.trim());

    setIsSavingProject(true);
    try {
      const url = isUpdate ? `${API_BASE}/api/projects/${currentProject!.id}` : `${API_BASE}/api/projects`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: form,
      });
      if (res.status === 401) {
        localStorage.removeItem("saas_mix_token");
        localStorage.removeItem("saas_mix_user");
        setUser(null);
        setAppModal({ type: "alert", message: "Session expirée. Reconnectez-vous.", onClose: () => {} });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Erreur sauvegarde");
      if (!isUpdate) setCurrentProject({ id: data.id, name: data.name });
      setAppModal({ type: "alert", message: isUpdate ? "Projet mis à jour." : "Projet sauvegardé avec les fichiers.", onClose: () => {} });
    } catch (e) {
      setAppModal({ type: "alert", message: e instanceof Error ? e.message : "Erreur lors de la sauvegarde.", onClose: () => {} });
    } finally {
      setIsSavingProject(false);
    }
  }, [tracks, getAuthHeaders, currentProject]);

  const saveProject = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
    if (!token) return;
    const isUpdate = currentProject != null;
    if (isUpdate) {
      doSaveProject(null);
    } else {
      setAppModal({
        type: "prompt",
        title: "Nom du projet ?",
        onConfirm: (value) => { if (value?.trim()) doSaveProject(value); },
        onCancel: () => {},
      });
    }
  }, [currentProject, doSaveProject]);

  const fetchProjectsList = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/projects`, { headers: getAuthHeaders() });
    if (res.status === 401) {
      localStorage.removeItem("saas_mix_token");
      localStorage.removeItem("saas_mix_user");
      setUser(null);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setProjectsList(data.projects || []);
  }, [getAuthHeaders]);

  const renameProject = useCallback(
    async (projectId: string, newName: string) => {
      if (!newName?.trim()) return;
      try {
        const form = new FormData();
        form.append("name", newName.trim());
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: form,
        });
        if (res.status === 401) {
          localStorage.removeItem("saas_mix_token");
          localStorage.removeItem("saas_mix_user");
          setUser(null);
          setAppModal({ type: "alert", message: "Session expirée. Reconnectez-vous.", onClose: () => {} });
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Erreur renommage");
        if (currentProject?.id === projectId) setCurrentProject({ id: projectId, name: data.name });
        await fetchProjectsList();
        setAppModal({ type: "alert", message: "Projet renommé.", onClose: () => {} });
      } catch (e) {
        setAppModal({ type: "alert", message: e instanceof Error ? e.message : "Erreur lors du renommage.", onClose: () => {} });
      }
    },
    [getAuthHeaders, fetchProjectsList, currentProject?.id]
  );

  const openRenameProjectPrompt = useCallback(
    (projectId: string, currentName: string) => {
      setAppModal({
        type: "prompt",
        title: "Nouveau nom du projet",
        defaultValue: currentName,
        onConfirm: (value) => {
          if (value?.trim()) renameProject(projectId, value.trim());
        },
        onCancel: () => {},
      });
    },
    [renameProject]
  );

  const loadProject = useCallback(
    async (projectId: string) => {
      setIsLoadingProject(true);
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, { headers: getAuthHeaders() });
        if (res.status === 401) {
          localStorage.removeItem("saas_mix_token");
          localStorage.removeItem("saas_mix_user");
          setUser(null);
          setAppModal({ type: "alert", message: "Session expirée. Reconnectez-vous.", onClose: () => {} });
          return;
        }
        const project = await res.json().catch(() => null);
        if (!res.ok || !project?.data) {
          setAppModal({ type: "alert", message: "Projet introuvable ou erreur.", onClose: () => {} });
          return;
        }
        const rawTracks = project.data as Array<{
          id: string;
          category: Category;
          gain: number;
          mixParams: MixParams;
          mixedAudioUrl?: string | null;
          rawFileName?: string | null;
          rawFileUrl?: string;
        }>;
        const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
        const authHeaders = getAuthHeaders();
        const newTracks: Track[] = await Promise.all(
          rawTracks.map(async (t) => {
            const base: Track = {
              id: t.id,
              file: null,
              category: t.category,
              gain: t.gain ?? 100,
              rawAudioUrl: null,
              mixedAudioUrl: t.mixedAudioUrl ?? null,
              isMixing: false,
              playMode: "mixed",
              mixParams: t.mixParams ?? { ...DEFAULT_MIX_PARAMS },
              paramsOpen: false,
              rawFileName: t.rawFileName ?? null,
            };
            const fileUrl = t.rawFileUrl;
            if (!fileUrl || !token) return base;
            const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${API_BASE}${fileUrl}`;
            const fileRes = await fetch(fullUrl, { headers: authHeaders });
            if (!fileRes.ok) return base;
            const blob = await fileRes.blob();
            const fileName = t.rawFileName || "track.wav";
            const file = new File([blob], fileName, { type: "audio/wav" });
            saveFileToIDB(t.id, file);
            const rawAudioUrl = URL.createObjectURL(file);
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            let waveformPeaks: number[] | undefined;
            let waveformDuration: number | undefined;
            try {
              const buf = await file.arrayBuffer();
              const buffer = await ctx.decodeAudioData(buf);
              waveformPeaks = computeWaveformPeaks(buffer, WAVEFORM_POINTS);
              waveformDuration = buffer.duration;
            } finally {
              ctx.close();
            }
            return {
              ...base,
              file,
              rawAudioUrl,
              rawFileName: null,
              waveformPeaks,
              waveformDuration,
            };
          })
        );
        setTracks(newTracks);
        setCurrentProject({ id: projectId, name: project.name ?? "Sans nom" });
        setShowProjectsModal(false);
      } catch (e) {
        setAppModal({ type: "alert", message: e instanceof Error ? e.message : "Erreur lors du chargement.", onClose: () => {} });
      } finally {
        setIsLoadingProject(false);
      }
    },
    [getAuthHeaders]
  );

  const deleteProject = useCallback(
    (projectId: string) => {
      setAppModal({
        type: "confirm",
        message: "Supprimer ce projet (fichiers inclus) ?",
        onConfirm: () => doDeleteProject(projectId),
        onCancel: () => {},
      });
    },
    [currentProject?.id]
  );

  const doDeleteProject = useCallback(
    async (projectId: string) => {
      setAppModal(null);
      const wasCurrentProject = currentProject?.id === projectId;
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (res.status === 401) {
          localStorage.removeItem("saas_mix_token");
          localStorage.removeItem("saas_mix_user");
          setUser(null);
          return;
        }
        if (wasCurrentProject) {
          setCurrentProject(null);
          const defaultTracks = getDefaultTracks();
          setTracks(defaultTracks);
          setMasterResult(null);
          buffersRef.current.clear();
          if (typeof window !== "undefined") {
            try {
              const db = await openFilesDB();
              const tx = db.transaction(FILES_STORE_NAME, "readwrite");
              await new Promise<void>((resolve, reject) => {
                const req = tx.objectStore(FILES_STORE_NAME).clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              });
              db.close();
            } catch (_) {}
            sessionStorage.removeItem(TRACKS_STORAGE_KEY);
          }
        }
        await fetchProjectsList();
      } catch (_) {}
    },
    [getAuthHeaders, fetchProjectsList, currentProject?.id]
  );

  async function decodeTrackBuffers(
    id: string,
    rawUrl: string | null,
    mixedUrl: string | null
  ) {
    const ctx = contextRef.current;
    if (!ctx) return;
    const entry = buffersRef.current.get(id) ?? { raw: null, mixed: null };
    if (rawUrl && !entry.raw) {
      const res = await fetch(rawUrl);
      const buf = await res.arrayBuffer();
      entry.raw = await ctx.decodeAudioData(buf);
    }
    if (mixedUrl && !entry.mixed) {
      const fullUrl = mixedUrl.startsWith("http") ? mixedUrl : `${API_BASE}${mixedUrl}`;
      const res = await fetch(fullUrl);
      const buf = await res.arrayBuffer();
      entry.mixed = await ctx.decodeAudioData(buf);
    }
    buffersRef.current.set(id, entry);
  }

  /** Charge tous les buffers (raw + mixed si besoin). Si déjà pré-décodés, retour immédiat = 0 latence au tap Play. */
  async function ensureAllBuffersLoaded(playable: Track[]): Promise<void> {
    let allReady = true;
    for (const t of playable) {
      const entry = buffersRef.current.get(t.id) ?? { raw: null, mixed: null };
      if (!entry.raw) {
        allReady = false;
        break;
      }
      if (t.playMode === "mixed" && t.mixedAudioUrl && !entry.mixed) {
        allReady = false;
        break;
      }
    }
    if (allReady) return;

    const fullRaw = (t: Track) =>
      t.rawAudioUrl
        ? t.rawAudioUrl.startsWith("http") || t.rawAudioUrl.startsWith("blob:")
          ? t.rawAudioUrl
          : `${API_BASE}${t.rawAudioUrl}`
        : null;
    const fullMixed = (t: Track) =>
      t.playMode === "mixed" && t.mixedAudioUrl
        ? t.mixedAudioUrl.startsWith("http")
          ? t.mixedAudioUrl
          : `${API_BASE}${t.mixedAudioUrl}`
        : null;
    await Promise.all(playable.map((t) => decodeTrackBuffers(t.id, fullRaw(t), fullMixed(t))));
    for (const t of playable) {
      const entry = buffersRef.current.get(t.id) ?? { raw: null, mixed: null };
      if (!entry.raw) throw new Error("Chargement du fichier en cours ou échoué. Réessayez.");
      if (t.playMode === "mixed" && t.mixedAudioUrl && !entry.mixed)
        throw new Error("Chargement du mix en cours ou échoué. Réessayez.");
    }
  }

  function stopAll() {
    userPausedRef.current = true;
    const ctx = contextRef.current;
    const nodesMap = Array.from(trackPlaybackRef.current.entries());
    if (ctx && nodesMap.length > 0) {
      const pos = Math.max(0, ctx.currentTime - startTimeRef.current);
      resumeFromRef.current = pos;
      setPausedAtSeconds(pos);
      setHasPausedPosition(true);
    } else {
      resumeFromRef.current = null;
      setHasPausedPosition(false);
    }
    trackPlaybackRef.current.clear();
    setIsPlaying(false);
    for (const [, nodes] of nodesMap) {
      try {
        if (nodes.type === "instrumental") {
          try {
            if ("bufferNode" in nodes && nodes.bufferNode) {
              nodes.bufferNode.stop();
              nodes.bufferNode.disconnect();
            } else if ("media" in nodes) {
              nodes.media.element.pause();
              if (nodes.media.source) nodes.media.source.disconnect();
            }
          } catch (_) {}
        } else {
          if (nodes.rawMedia) {
            nodes.rawMedia.element.pause();
            if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect();
          }
          if (nodes.rawBufferNode) {
            try {
              nodes.rawBufferNode.stop();
              nodes.rawBufferNode.disconnect();
            } catch (_) {}
          }
          if (nodes.rawUnlockGain) nodes.rawUnlockGain.disconnect();
          if (nodes.mixedMedia) {
            nodes.mixedMedia.element.pause();
            if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect();
          }
          if (nodes.mixedBufferNode) {
            try {
              nodes.mixedBufferNode.stop();
              nodes.mixedBufferNode.disconnect();
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  }

  const startPlaybackAtOffset = useCallback(
    (ctx: AudioContext, playable: Track[], offset: number) => {
      const toStop = Array.from(trackPlaybackRef.current.entries());
      trackPlaybackRef.current.clear();
      for (const [, nodes] of toStop) {
        try {
          if (nodes.type === "instrumental") {
            if ("bufferNode" in nodes && nodes.bufferNode) {
              try {
                nodes.bufferNode.onended = null;
                nodes.bufferNode.stop();
                nodes.bufferNode.disconnect();
              } catch (_) {}
            } else if ("media" in nodes) {
              nodes.media.element.onended = null;
              nodes.media.element.pause();
              if (nodes.media.source) nodes.media.source.disconnect();
            }
          } else {
            if (nodes.rawMedia) {
              nodes.rawMedia.element.onended = null;
              nodes.rawMedia.element.pause();
              if (nodes.rawMedia.source) if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect();
            }
            if (nodes.rawBufferNode) {
              try {
                nodes.rawBufferNode.onended = null;
                nodes.rawBufferNode.stop();
                nodes.rawBufferNode.disconnect();
              } catch (_) {}
            }
            if (nodes.rawUnlockGain) nodes.rawUnlockGain.disconnect();
            if (nodes.mixedMedia) {
              nodes.mixedMedia.element.onended = null;
              nodes.mixedMedia.element.pause();
              if (nodes.mixedMedia.source) if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect();
            }
            if (nodes.mixedBufferNode) {
              try {
                nodes.mixedBufferNode.stop();
                nodes.mixedBufferNode.disconnect();
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      let endedCount = 0;
      const totalTracks = playable.length;
      const now = ctx.currentTime;
      startTimeRef.current = now - offset;

      const fullUrl = (url: string) => (url.startsWith("http") || url.startsWith("blob:") ? url : `${API_BASE}${url}`);

      if (isMobileRef.current) {
        const mediaToPlay: HTMLAudioElement[] = [];
        const mainGain = ctx.createGain();
        mainGain.connect(ctx.destination);
        for (const track of playable) {
          if (!track.rawAudioUrl) continue;
          const onEnd = () => {
            trackPlaybackRef.current.delete(track.id);
            endedCount++;
            if (endedCount >= totalTracks) {
              setIsPlaying(false);
              setHasPausedPosition(false);
            }
          };
          if (track.category === "instrumental") {
            const audio = new Audio(fullUrl(track.rawAudioUrl));
            audio.volume = track.gain / 100;
            audio.onended = onEnd;
            mediaToPlay.push(audio);
            trackPlaybackRef.current.set(track.id, { type: "instrumental", media: { element: audio, source: null }, mainGain });
          } else {
            const rawGain = ctx.createGain();
            const mixedGain = ctx.createGain();
            rawGain.connect(mainGain);
            mixedGain.connect(mainGain);
            rawGain.gain.value = track.playMode === "mixed" && track.mixedAudioUrl ? 0 : 1;
            mixedGain.gain.value = track.playMode === "mixed" && track.mixedAudioUrl ? 1 : 0;
            const onEndVocal = () => {
              trackPlaybackRef.current.delete(track.id);
              endedCount++;
              if (endedCount >= totalTracks) {
                setIsPlaying(false);
                setHasPausedPosition(false);
              }
            };
            const rawVol = (track.playMode === "mixed" && track.mixedAudioUrl ? 0 : 1) * (track.gain / 100);
            const mixedVol = (track.playMode === "mixed" && track.mixedAudioUrl ? 1 : 0) * (track.gain / 100);
            const rawAudio = new Audio(fullUrl(track.rawAudioUrl));
            rawAudio.volume = rawVol;
            rawAudio.onended = onEndVocal;
            mediaToPlay.push(rawAudio);
            let mixedMedia: { element: HTMLAudioElement; source: MediaElementAudioSourceNode | null } | null = null;
            if (track.mixedAudioUrl) {
              const mixedAudio = new Audio(fullUrl(track.mixedAudioUrl));
              mixedAudio.volume = mixedVol;
              mixedAudio.onended = onEndVocal;
              mediaToPlay.push(mixedAudio);
              mixedMedia = { element: mixedAudio, source: null };
            }
            trackPlaybackRef.current.set(track.id, {
              type: "vocal",
              rawMedia: { element: rawAudio, source: null },
              rawBufferNode: null,
              rawUnlockGain: null,
              mixedMedia,
              mixedBufferNode: null,
              rawGain,
              mixedGain,
              mainGain,
            });
          }
        }
        Promise.all(
          mediaToPlay.map(
            (el) =>
              new Promise<void>((resolve) => {
                if (el.readyState >= 3) {
                  resolve();
                  return;
                }
                el.addEventListener("canplaythrough", () => resolve(), { once: true });
                el.addEventListener("error", () => resolve(), { once: true });
              })
          )
        ).then(() => {
          for (let i = 0; i < mediaToPlay.length; i++) {
            mediaToPlay[i].currentTime = offset;
          }
          for (let i = 0; i < mediaToPlay.length; i++) {
            mediaToPlay[i].play().catch(() => {});
          }
        });
        setIsPlaying(true);
        return;
      }

      for (const track of playable) {
        if (!track.rawAudioUrl) continue;
        const entry = buffersRef.current.get(track.id) ?? { raw: null, mixed: null };
        if (!entry.raw) continue;

        const mainGain = ctx.createGain();
        mainGain.gain.value = track.gain / 100;
        mainGain.connect(ctx.destination);

        const onEnd = () => {
          trackPlaybackRef.current.delete(track.id);
          endedCount++;
          if (endedCount >= totalTracks) {
            setIsPlaying(false);
            setHasPausedPosition(false);
          }
        };

        if (track.category === "instrumental") {
          const src = ctx.createBufferSource();
          src.buffer = entry.raw;
          src.connect(mainGain);
          src.onended = onEnd;
          const duration = Math.max(0, entry.raw.duration - offset);
          src.start(now, offset, duration);
          trackPlaybackRef.current.set(track.id, { type: "instrumental", bufferNode: src, mainGain });
        } else {
          const rawGain = ctx.createGain();
          const mixedGain = ctx.createGain();
          rawGain.connect(mainGain);
          mixedGain.connect(mainGain);
          if (!track.mixedAudioUrl) {
            rawGain.gain.value = 1;
            mixedGain.gain.value = 0;
          } else {
            rawGain.gain.value = track.playMode === "mixed" ? 0 : 1;
            mixedGain.gain.value = track.playMode === "mixed" ? 1 : 0;
          }
          const onEndVocal = () => {
            trackPlaybackRef.current.delete(track.id);
            endedCount++;
            if (endedCount >= totalTracks) {
              setIsPlaying(false);
              setHasPausedPosition(false);
            }
          };
          const rawBuf = entry.raw;
          const rawUnlockGain = ctx.createGain();
          rawUnlockGain.gain.value = 0;
          rawUnlockGain.connect(mainGain);
          const srcRaw = ctx.createBufferSource();
          srcRaw.buffer = rawBuf;
          srcRaw.connect(rawGain);
          srcRaw.onended = onEndVocal;
          const durationRaw = Math.max(0, rawBuf.duration - offset);
          srcRaw.start(now, offset, durationRaw);
          let mixedBufferNode: AudioBufferSourceNode | null = null;
          if (track.mixedAudioUrl && entry.mixed) {
            const srcMixed = ctx.createBufferSource();
            srcMixed.buffer = entry.mixed;
            srcMixed.connect(mixedGain);
            srcMixed.onended = onEndVocal;
            const durationMixed = Math.max(0, entry.mixed.duration - offset);
            srcMixed.start(now, offset, durationMixed);
            mixedBufferNode = srcMixed;
          }
          trackPlaybackRef.current.set(track.id, {
            type: "vocal",
            rawMedia: null,
            rawBufferNode: srcRaw,
            rawUnlockGain,
            mixedMedia: null,
            mixedBufferNode,
            rawGain,
            mixedGain,
            mainGain,
          });
        }
      }
      setIsPlaying(true);
    },
    []
  );

  const seekTo = useCallback(
    (offset: number) => {
      const ctx = contextRef.current;
      const playable = tracksRef.current.filter((t) => t.file && t.rawAudioUrl);
      if (playable.length === 0) return;
      const safeOffset = Math.max(0, offset);
      const now = Date.now();
      if (now - lastSeekRef.current.time < 120 && Math.abs(lastSeekRef.current.offset - safeOffset) < 0.05) return;
      lastSeekRef.current = { offset: safeOffset, time: now };

      if (isPlaying && ctx && trackPlaybackRef.current.size > 0) {
        startTimeRef.current = ctx.currentTime - safeOffset;
        for (const [id, nodes] of Array.from(trackPlaybackRef.current.entries())) {
          try {
            if (nodes.type === "instrumental") {
              if ("media" in nodes && nodes.media) {
                nodes.media.element.currentTime = safeOffset;
              } else if ("bufferNode" in nodes && nodes.bufferNode) {
                const buf = buffersRef.current.get(id)?.raw;
                if (buf) {
                  const when = ctx.currentTime;
                  try {
                    nodes.bufferNode.onended = null;
                    nodes.bufferNode.stop(when);
                    nodes.bufferNode.disconnect();
                  } catch (_) {}
                  const src = ctx.createBufferSource();
                  src.buffer = buf;
                  src.connect(nodes.mainGain);
                  src.onended = () => {
                    trackPlaybackRef.current.delete(id);
                    if (trackPlaybackRef.current.size === 0) {
                      setIsPlaying(false);
                      setHasPausedPosition(false);
                    }
                  };
                  const duration = Math.max(0, buf.duration - safeOffset);
                  src.start(when, safeOffset, duration);
                  trackPlaybackRef.current.set(id, { type: "instrumental", bufferNode: src, mainGain: nodes.mainGain });
                }
              }
            } else {
              if (nodes.rawMedia) nodes.rawMedia.element.currentTime = safeOffset;
              if (nodes.rawBufferNode) {
                const rawBuf = buffersRef.current.get(id)?.raw;
                if (rawBuf) {
                  const when = ctx.currentTime;
                  try {
                    nodes.rawBufferNode.onended = null;
                    nodes.rawBufferNode.stop(when);
                    nodes.rawBufferNode.disconnect();
                  } catch (_) {}
                  const src = ctx.createBufferSource();
                  src.buffer = rawBuf;
                  src.connect(nodes.rawGain);
                  src.onended = () => {
                    trackPlaybackRef.current.delete(id);
                    if (trackPlaybackRef.current.size === 0) {
                      setIsPlaying(false);
                      setHasPausedPosition(false);
                    }
                  };
                  const duration = Math.max(0, rawBuf.duration - safeOffset);
                  src.start(when, safeOffset, duration);
                  (nodes as VocalNodes).rawBufferNode = src;
                }
              }
              if (nodes.mixedMedia) nodes.mixedMedia.element.currentTime = safeOffset;
              if (nodes.mixedBufferNode) {
                const mixedBuf = buffersRef.current.get(id)?.mixed;
                if (mixedBuf) {
                  const when = ctx.currentTime;
                  try {
                    nodes.mixedBufferNode.onended = null;
                    nodes.mixedBufferNode.stop(when);
                    nodes.mixedBufferNode.disconnect();
                  } catch (_) {}
                  const src = ctx.createBufferSource();
                  src.buffer = mixedBuf;
                  src.connect(nodes.mixedGain);
                  src.onended = () => {
                    trackPlaybackRef.current.delete(id);
                    if (trackPlaybackRef.current.size === 0) {
                      setIsPlaying(false);
                      setHasPausedPosition(false);
                    }
                  };
                  const duration = Math.max(0, mixedBuf.duration - safeOffset);
                  src.start(when, safeOffset, duration);
                  (nodes as VocalNodes).mixedBufferNode = src;
                }
              }
            }
          } catch (_) {}
        }
      } else {
        resumeFromRef.current = safeOffset;
        setPausedAtSeconds(safeOffset);
        setHasPausedPosition(true);
      }
    },
    [isPlaying]
  );

  /** Débloque l’audio sur mobile (iOS/Android) : joue un buffer silencieux dans le geste utilisateur. */
  function unlockAudioContextSync(ctx: AudioContext): void {
    if (audioUnlockedRef.current) return;
    try {
      const numSamples = Math.max(1, Math.min(Math.ceil(ctx.sampleRate * 0.05), 4096));
      const buf = ctx.createBuffer(1, numSamples, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      audioUnlockedRef.current = true;
    } catch (_) {}
  }

  const playAll = useCallback(
    async (override?: { playable?: Track[]; startOffset?: number }) => {
      userPausedRef.current = false;
      let ctx = contextRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        contextRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {}); // lance le resume dans le geste, sans attendre
        unlockAudioContextSync(ctx);
        await ctx.resume().catch(() => {
          setIsPlaying(false);
          return;
        });
      }
      const playable = override?.playable ?? tracksRef.current.filter((t) => t.file && t.rawAudioUrl);
      const startOffset = override?.startOffset ?? resumeFromRef.current ?? 0;
      if (playable.length === 0) {
        setShowPlayNoFileMessage(true);
        setTimeout(() => setShowPlayNoFileMessage(false), 3000);
        return;
      }
      if (!isMobileRef.current) {
        try {
          await ensureAllBuffersLoaded(playable);
        } catch (e) {
          setAppModal({
            type: "alert",
            message: e instanceof Error ? e.message : "Impossible de charger les pistes. Réessayez.",
            onClose: () => {},
          });
          return;
        }
      }
      if (trackPlaybackRef.current.size > 0) {
        for (const [, nodes] of Array.from(trackPlaybackRef.current.entries())) {
          try {
            if (nodes.type === "instrumental") {
              if ("bufferNode" in nodes && nodes.bufferNode) {
                try {
                  nodes.bufferNode.onended = null;
                  nodes.bufferNode.stop();
                  nodes.bufferNode.disconnect();
                } catch (_) {}
              } else if ("media" in nodes) {
                nodes.media.element.pause();
                if (nodes.media.source) nodes.media.source.disconnect();
              }
            } else {
              if (nodes.rawMedia) {
                nodes.rawMedia.element.pause();
                if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect();
              }
              if (nodes.rawBufferNode) {
                try {
                  nodes.rawBufferNode.onended = null;
                  nodes.rawBufferNode.stop();
                  nodes.rawBufferNode.disconnect();
                } catch (_) {}
              }
              if (nodes.rawUnlockGain) nodes.rawUnlockGain.disconnect();
              if (nodes.mixedMedia) {
                nodes.mixedMedia.element.pause();
                if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect();
              }
              if (nodes.mixedBufferNode) {
                try {
                  nodes.mixedBufferNode.onended = null;
                  nodes.mixedBufferNode.stop();
                  nodes.mixedBufferNode.disconnect();
                } catch (_) {}
              }
            }
          } catch (_) {}
        }
        trackPlaybackRef.current.clear();
      }
      resumeFromRef.current = null;
      setHasPausedPosition(false);
      setIsPlaying(true);
      startPlaybackAtOffset(ctx, playable, startOffset);
    },
    [startPlaybackAtOffset]
  );

  playAllRef.current = playAll;

  const togglePlayMode = useCallback(
    (id: string, targetMode: "raw" | "mixed") => {
      const nodes = trackPlaybackRef.current.get(id);
      if (nodes?.type === "vocal") {
        nodes.rawGain.gain.value = targetMode === "raw" ? 1 : 0;
        nodes.mixedGain.gain.value = targetMode === "mixed" ? 1 : 0;
      }
      updateTrack(id, { playMode: targetMode });
    },
    [updateTrack]
  );

  const runMix = useCallback(
    async (id: string) => {
      const track = tracks.find((t) => t.id === id);
      if (!track?.file) return;

      const clearProgress = () => {
        if (mixSimulationIntervalRef.current) {
          clearInterval(mixSimulationIntervalRef.current);
          mixSimulationIntervalRef.current = null;
        }
        if (mixSmoothIntervalRef.current) {
          clearInterval(mixSmoothIntervalRef.current);
          mixSmoothIntervalRef.current = null;
        }
        if (mixFinishIntervalRef.current) {
          clearInterval(mixFinishIntervalRef.current);
          mixFinishIntervalRef.current = null;
        }
        setMixProgress((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      };

      setMixProgress((prev) => ({ ...prev, [id]: 0 }));
      updateTrack(id, { isMixing: true });

      // Une seule progression 0→99% basée sur le temps (smooth, pas de backend)
      mixSimulationStartRef.current = Date.now();
      const tickSmooth = () => {
        const elapsed = Date.now() - mixSimulationStartRef.current;
        const pct = Math.min(99, (elapsed / MIX_ESTIMATED_DURATION_MS) * 99);
        setMixProgress((prev) => (prev[id] === 100 ? prev : { ...prev, [id]: Math.round(pct * 10) / 10 }));
      };
      tickSmooth();
      mixSimulationIntervalRef.current = setInterval(tickSmooth, MIX_PROGRESS_TICK_MS);

      const form = new FormData();
      form.append("file", track.file);
      form.append("category", track.category);
      const p = track.mixParams;
      form.append("delay", String(p.delay));
      form.append("reverb", String(p.reverb));
      form.append("reverb_mode", String(p.reverb_mode));
      form.append("tone_low", String(p.tone_low));
      form.append("tone_mid", String(p.tone_mid));
      form.append("tone_high", String(p.tone_high));
      form.append("air", String(p.air));
      form.append("bpm", String(p.bpm));
      form.append("delay_division", p.delay_division);
      form.append("phone_fx", String(p.phone_fx));
      form.append("doubler", String(p.doubler));
      form.append("robot", String(p.robot));

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/track/mix`, {
          method: "POST",
          headers,
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          localStorage.removeItem("saas_mix_token");
          localStorage.removeItem("saas_mix_user");
          setUser(null);
          throw new Error("Session expirée. Reconnectez-vous.");
        }
        if (!res.ok) {
          const msg = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ") : JSON.stringify(data.detail ?? data);
          throw new Error(msg || "Mix failed");
        }

        // Backend : job (poll + % réel) ou synchrone (timer 0→99% seulement)
        const jobId = data.jobId as string | undefined;
        const directMixedUrl = data.mixedTrackUrl as string | undefined;

        let path: string;
        if (jobId) {
          // Mode job : on passe à la progression réelle (backend), affichage lissé
          if (mixSimulationIntervalRef.current) {
            clearInterval(mixSimulationIntervalRef.current);
            mixSimulationIntervalRef.current = null;
          }
          mixProgressTargetRef.current[id] = 0;
          if (mixSmoothIntervalRef.current) {
            clearInterval(mixSmoothIntervalRef.current);
            mixSmoothIntervalRef.current = null;
          }
          mixSmoothIntervalRef.current = setInterval(() => {
            setMixProgress((prev) => {
              const cur = prev[id] ?? 0;
              const target = mixProgressTargetRef.current[id] ?? cur;
              const effectiveTarget = Math.max(cur, Math.min(99, target));
              if (cur >= effectiveTarget) return prev;
              const next = cur + (effectiveTarget - cur) * 0.2;
              return { ...prev, [id]: Math.round(Math.min(next, effectiveTarget) * 10) / 10 };
            });
          }, MIX_PROGRESS_TICK_MS);

          let statusData: { status: string; percent: number; step?: string; mixedTrackUrl?: string; error?: string } = { status: "running", percent: 0 };
          while (statusData.status === "running") {
            await new Promise((r) => setTimeout(r, 500));
            const statusRes = await fetch(`${API_BASE}/api/track/mix/status?job_id=${encodeURIComponent(jobId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!statusRes.ok) {
              statusData = { status: "error", percent: 0, error: "Impossible de récupérer le statut du mix" };
              break;
            }
            statusData = await statusRes.json();
            mixProgressTargetRef.current[id] = Math.max(mixProgressTargetRef.current[id] ?? 0, statusData.percent);
          }

          if (mixSmoothIntervalRef.current) {
            clearInterval(mixSmoothIntervalRef.current);
            mixSmoothIntervalRef.current = null;
          }
          setMixProgress((prev) => ({ ...prev, [id]: 100 }));

          if (statusData.status === "error") {
            clearProgress();
            updateTrack(id, { isMixing: false });
            setAppModal({ type: "alert", message: "Erreur lors du mix : " + (statusData.error || "Échec inconnu"), onClose: () => {} });
            return;
          }
          path = statusData.mixedTrackUrl as string;
        } else if (directMixedUrl) {
          path = directMixedUrl;
        } else {
          clearProgress();
          updateTrack(id, { isMixing: false });
          setAppModal({ type: "alert", message: "Réponse API invalide (jobId ou mixedTrackUrl manquant).", onClose: () => {} });
          return;
        }

        const fromSyncBackend = !!directMixedUrl && !jobId;

        if (!path) {
          clearProgress();
          updateTrack(id, { isMixing: false });
          setAppModal({ type: "alert", message: "Mix terminé mais URL introuvable.", onClose: () => {} });
          return;
        }

        const mixedAudioUrl = path.startsWith("http") ? path : `${API_BASE}${path}`;
        const fullUrl = mixedAudioUrl.startsWith("http") ? mixedAudioUrl : `${API_BASE}${mixedAudioUrl}`;
        const entry = buffersRef.current.get(id) ?? { raw: null, mixed: null };
        entry.mixed = null;
        buffersRef.current.set(id, entry);

        try {
          const ctx = contextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          if (!contextRef.current) contextRef.current = ctx;
          const audioRes = await fetch(fullUrl);
          const ab = await audioRes.arrayBuffer();
          const decoded = await ctx.decodeAudioData(ab);
          const e = buffersRef.current.get(id);
          if (!e) throw new Error("track entry missing");
          e.mixed = decoded;
          if (mixSimulationIntervalRef.current) {
            clearInterval(mixSimulationIntervalRef.current);
            mixSimulationIntervalRef.current = null;
          }
          updateTrack(id, { mixedAudioUrl, isMixing: false, playMode: "mixed" });
          setMixedPreloadReady((p) => ({ ...p, [id]: true }));
          const preload = new Audio(fullUrl);
          preload.preload = "auto";
          preload.load();
          preloadMixedRef.current.set(id, preload);
          resumeFromRef.current = null;
          setHasPausedPosition(false);

          setMixProgress((prev) => ({ ...prev, [id]: 100 }));
          // Toujours redémarrer toutes les pistes depuis 0 pour garder instru + vocal en phase
          const basePlayable = tracksRef.current.filter((t) => t.file && t.rawAudioUrl);
          const patchedPlayable = basePlayable.map((t) =>
            t.id === id ? { ...t, mixedAudioUrl, playMode: "mixed" as const } : t
          );
          if (isMobileRef.current) {
            // Sur mobile : ne pas lancer la lecture ici (hors geste utilisateur → iOS bloque le son).
            // L'utilisateur appuie sur Play pour écouter (dans le geste).
            setIsPlaying(false);
          } else {
            if (ctx.state === "suspended") {
              ctx.resume().catch(() => {});
              unlockAudioContextSync(ctx);
              await ctx.resume().catch(() => {});
            }
            startPlaybackAtOffset(ctx, patchedPlayable, 0);
            setIsPlaying(true);
          }
          setTimeout(clearProgress, 500);
        } catch (decodeErr) {
          if (mixFinishIntervalRef.current) {
            clearInterval(mixFinishIntervalRef.current);
            mixFinishIntervalRef.current = null;
          }
          clearProgress();
          updateTrack(id, { mixedAudioUrl, isMixing: false, playMode: "mixed" });
          if (isPlayingRef.current) stopAll();
          const prev = preloadMixedRef.current.get(id);
          if (prev) prev.src = "";
          const preload = new Audio(fullUrl);
          preload.preload = "auto";
          preload.load();
          preload.addEventListener("canplay", () => setMixedPreloadReady((p) => ({ ...p, [id]: true })), { once: true });
          preloadMixedRef.current.set(id, preload);
        }
      } catch (e) {
        if (mixSimulationIntervalRef.current) {
          clearInterval(mixSimulationIntervalRef.current);
          mixSimulationIntervalRef.current = null;
        }
        if (mixFinishIntervalRef.current) {
          clearInterval(mixFinishIntervalRef.current);
          mixFinishIntervalRef.current = null;
        }
        clearProgress();
        updateTrack(id, { isMixing: false });
        console.error(e);
        const errMsg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
        setAppModal({ type: "alert", message: "Erreur lors du mix : " + errMsg, onClose: () => {} });
      }
    },
    [tracks, updateTrack, startPlaybackAtOffset]
  );

  const isVocal = (c: Category) =>
    c === "lead_vocal" || c === "adlibs_backs";

  const buildTrackSpecsAndFiles = useCallback(() => {
    const specs = tracks.map((t) => ({
      category: t.category,
      gain: t.gain,
      mixedTrackId: extractMixedTrackId(t.mixedAudioUrl) ?? undefined,
    }));
    const files = tracks
      .filter((t) => !t.mixedAudioUrl && t.file)
      .map((t) => t.file!);
    return { specs, files };
  }, [tracks]);

  const downloadMix = useCallback(async () => {
    const { specs, files } = buildTrackSpecsAndFiles();
    if (specs.length === 0) return;
    setIsRenderingMix(true);
    try {
      const form = new FormData();
      form.append("track_specs", JSON.stringify(specs));
      files.forEach((f) => form.append("files", f));
      const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/render/mix`, { method: "POST", headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        localStorage.removeItem("saas_mix_token");
        localStorage.removeItem("saas_mix_user");
        setUser(null);
        setAppModal({ type: "alert", message: "Session expirée. Reconnectez-vous.", onClose: () => {} });
        return;
      }
      if (!res.ok) throw new Error((data.detail as string) || "Render mix échoué");
      const mixUrl = (data.mixUrl as string).startsWith("http") ? data.mixUrl : `${API_BASE}${data.mixUrl}`;
      window.open(mixUrl, "_blank");
    } catch (e) {
      console.error(e);
      setAppModal({ type: "alert", message: "Erreur : " + (e instanceof Error ? e.message : String(e)), onClose: () => {} });
    } finally {
      setIsRenderingMix(false);
    }
  }, [buildTrackSpecsAndFiles]);

  const runMaster = useCallback(async () => {
    const hasAnyMixed = tracks.some((t) => t.mixedAudioUrl);
    if (!hasAnyMixed) {
      setShowMasterMessage(true);
      setTimeout(() => setShowMasterMessage(false), 3000);
      return;
    }
    const { specs, files } = buildTrackSpecsAndFiles();
    if (specs.length === 0) return;
    setIsMastering(true);
    setMasterResult(null);
    try {
      const form = new FormData();
      form.append("track_specs", JSON.stringify(specs));
      files.forEach((f) => form.append("files", f));
      const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/master`, { method: "POST", headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        localStorage.removeItem("saas_mix_token");
        localStorage.removeItem("saas_mix_user");
        setUser(null);
        setAppModal({ type: "alert", message: "Session expirée. Reconnectez-vous.", onClose: () => {} });
        return;
      }
      if (!res.ok) throw new Error((data.detail as string) || "Masterisation échouée");
      const mixUrl = (data.mixUrl as string).startsWith("http") ? data.mixUrl : `${API_BASE}${data.mixUrl}`;
      const masterUrl = (data.masterUrl as string).startsWith("http") ? data.masterUrl : `${API_BASE}${data.masterUrl}`;
      setMasterResult({ mixUrl, masterUrl });
      setMasterPlaybackMode("master");
    } catch (e) {
      console.error(e);
      setAppModal({ type: "alert", message: "Erreur : " + (e instanceof Error ? e.message : String(e)), onClose: () => {} });
    } finally {
      setIsMastering(false);
    }
  }, [buildTrackSpecsAndFiles, tracks]);

  const startMasterPlayback = useCallback((offset?: number) => {
    const mixBuf = masterMixBufferRef.current;
    const masterBuf = masterMasterBufferRef.current;
    if (!mixBuf || !masterBuf) return;
    let ctx = contextRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      contextRef.current = ctx;
    }
    if (ctx.state === "suspended") ctx.resume();
    const startOffset = Math.max(0, offset ?? masterResumeFrom);
    const now = ctx.currentTime;
    masterStartTimeRef.current = now - startOffset;

    const mixSource = ctx.createBufferSource();
    mixSource.buffer = mixBuf;
    const masterSource = ctx.createBufferSource();
    masterSource.buffer = masterBuf;
    const mixGain = ctx.createGain();
    const masterGain = ctx.createGain();
    mixSource.connect(mixGain);
    masterSource.connect(masterGain);
    mixGain.connect(ctx.destination);
    masterGain.connect(ctx.destination);
    const isMaster = masterPlaybackMode === "master";
    mixGain.gain.value = isMaster ? 0 : 1;
    masterGain.gain.value = isMaster ? 1 : 0;

    mixSource.start(now, startOffset);
    masterSource.start(now, startOffset);
    const duration = Math.max(mixBuf.duration, masterBuf.duration);
    const onEnd = () => {
      if (!masterPlaybackRef.current) return;
      masterPlaybackRef.current = null;
      setIsMasterResultPlaying(false);
      setMasterResumeFrom(0);
      setMasterPlaybackCurrentTime(0);
    };
    mixSource.onended = () => {
      if (ctx.currentTime - masterStartTimeRef.current >= duration - 0.05) onEnd();
    };
    masterSource.onended = () => {
      if (ctx.currentTime - masterStartTimeRef.current >= duration - 0.05) onEnd();
    };
    masterPlaybackRef.current = { mixSource, masterSource, mixGain, masterGain };
    setIsMasterResultPlaying(true);
  }, [masterPlaybackMode, masterResumeFrom]);

  const stopMasterPlayback = useCallback(() => {
    const nodes = masterPlaybackRef.current;
    if (nodes) {
      try {
        nodes.mixSource.onended = null;
        nodes.masterSource.onended = null;
        nodes.mixSource.disconnect();
        nodes.masterSource.disconnect();
        nodes.mixSource.stop();
        nodes.masterSource.stop();
      } catch (_) {}
      masterPlaybackRef.current = null;
      const ctx = contextRef.current;
      if (ctx) {
        const pos = Math.max(0, ctx.currentTime - masterStartTimeRef.current);
        setMasterResumeFrom(pos);
        setMasterPlaybackCurrentTime(pos);
      }
    }
    setIsMasterResultPlaying(false);
  }, []);

  const toggleMasterPlaybackMode = useCallback(() => {
    const nodes = masterPlaybackRef.current;
    setMasterPlaybackMode((m) => {
      const next = m === "master" ? "mix" : "master";
      if (nodes) {
        nodes.mixGain.gain.value = next === "master" ? 0 : 1;
        nodes.masterGain.gain.value = next === "master" ? 1 : 0;
      }
      return next;
    });
  }, []);

  const seekMaster = useCallback(
    (time: number) => {
      const safe = Math.max(0, time);
      setMasterResumeFrom(safe);
      setMasterPlaybackCurrentTime(safe);
      if (isMasterResultPlaying) {
        const nodes = masterPlaybackRef.current;
        if (nodes) {
          try {
            nodes.mixSource.onended = null;
            nodes.masterSource.onended = null;
            nodes.mixSource.disconnect();
            nodes.masterSource.disconnect();
            nodes.mixSource.stop();
            nodes.masterSource.stop();
          } catch (_) {}
          masterPlaybackRef.current = null;
        }
        setIsMasterResultPlaying(false);
        startMasterPlayback(safe);
      }
    },
    [isMasterResultPlaying, startMasterPlayback]
  );

  const hasAnyPlayable = tracks.some(
    (t) => t.file && (t.rawAudioUrl || (t.mixedAudioUrl && isVocal(t.category)))
  );

  return (
    <main className="min-h-screen">
      {appModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" aria-modal="true" role="dialog">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-xl max-w-sm w-full shadow-xl overflow-hidden">
            {appModal.type === "prompt" && (
              <>
                <div className="p-4 border-b border-white/10">
                  <p className="text-tagline text-slate-300 text-center text-sm tracking-wide">{appModal.title}</p>
                </div>
                <div className="p-4">
                  <input
                    type="text"
                    value={promptInputValue}
                    onChange={(e) => setPromptInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        appModal.onConfirm(promptInputValue);
                        setAppModal(null);
                      }
                      if (e.key === "Escape") {
                        appModal.onCancel();
                        setAppModal(null);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-tagline text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                    placeholder="Nom du projet"
                    autoFocus
                  />
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { appModal.onCancel(); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-500 hover:bg-white/5 transition-colors text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => { appModal.onConfirm(promptInputValue); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-300 hover:bg-white/5 transition-colors text-sm border-l border-white/10"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
            {appModal.type === "confirm" && (
              <>
                <div className="p-4">
                  <p className="text-tagline text-slate-300 text-center text-sm tracking-wide">{appModal.message}</p>
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { appModal.onCancel(); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-500 hover:bg-white/5 transition-colors text-sm"
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    onClick={() => { appModal.onConfirm(); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-300 hover:bg-white/5 transition-colors text-sm border-l border-white/10"
                  >
                    Oui
                  </button>
                </div>
              </>
            )}
            {appModal.type === "alert" && (
              <>
                <div className="p-4">
                  <p className="text-tagline text-slate-300 text-center text-sm tracking-wide">{appModal.message}</p>
                </div>
                <div className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { appModal.onClose(); setAppModal(null); }}
                    className="w-full py-3 text-tagline text-slate-300 hover:bg-white/5 transition-colors text-sm"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10 max-w-4xl max-lg:py-6 max-md:px-3 max-md:py-4">
        <header className="text-center mb-10 md:mb-12 max-lg:mb-8 max-md:mb-6">
          <nav className="max-lg:hidden flex justify-center items-center gap-2 mb-4 text-tagline text-slate-500 tracking-[0.2em] uppercase text-xs sm:text-sm max-md:gap-1.5 max-md:mb-3 max-md:text-[10px]">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => { setShowProjectsModal(true); fetchProjectsList(); }}
                  className="text-slate-500 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer"
                >
                  MES PROJETS
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  disabled={isSavingProject}
                  onClick={createNewProject}
                  className="text-slate-500 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer disabled:opacity-50"
                  title="Créer un nouveau projet et l’enregistrer dans Mes projets"
                >
                  CRÉER UN PROJET
                </button>
                <span className="text-slate-600">|</span>
                <div className="relative flex flex-col items-center">
                  <button
                    type="button"
                    disabled={isSavingProject}
                    onClick={saveProject}
                    className="text-slate-500 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProject ? "SAUVEGARDE…" : "SAUVEGARDER"}
                  </button>
                  {user && currentProject && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-slate-500 text-[10px] whitespace-nowrap max-w-[140px] truncate" title={currentProject.name}>
                      {currentProject.name}
                    </span>
                  )}
                </div>
                <span className="text-slate-600">|</span>
                <span className="truncate max-w-[200px]" title={user.email}>{user.email}</span>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("saas_mix_token");
                    localStorage.removeItem("saas_mix_user");
                    setUser(null);
                  }}
                  className="text-slate-500 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer"
                >
                  DÉCONNEXION
                </button>
              </>
            ) : (
              <>
                <Link href="/connexion" className="text-slate-500 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                  CONNEXION
                </Link>
                <span className="text-slate-600">|</span>
                <Link href="/inscription" className="text-slate-500 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                  INSCRIPTION
                </Link>
              </>
            )}
          </nav>

          {/* Menu burger mobile / tablette uniquement */}
          <div className="lg:hidden flex flex-col items-center mb-4 relative">
            <button
              type="button"
              onClick={() => setNavMenuOpen((o) => !o)}
              className="text-tagline text-slate-500 tracking-[0.2em] uppercase text-xs sm:text-sm max-md:text-[10px] p-2 -m-2 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors"
              aria-label="Menu"
              aria-expanded={navMenuOpen}
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
              </svg>
            </button>
            {navMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setNavMenuOpen(false)}
                />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[200px] py-2 rounded-lg bg-[#0f0f0f] border border-white/10 shadow-xl text-tagline text-slate-500 tracking-[0.2em] uppercase text-xs sm:text-sm max-md:text-[10px] text-center">
                  {user ? (
                    <>
                      <button
                        type="button"
                        onClick={() => { setNavMenuOpen(false); setShowProjectsModal(true); fetchProjectsList(); }}
                        className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        MES PROJETS
                      </button>
                      <button
                        type="button"
                        disabled={isSavingProject}
                        onClick={() => { setNavMenuOpen(false); createNewProject(); }}
                        className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        CRÉER UN PROJET
                      </button>
                      <button
                        type="button"
                        disabled={isSavingProject}
                        onClick={() => { setNavMenuOpen(false); saveProject(); }}
                        className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isSavingProject ? "SAUVEGARDE…" : "SAUVEGARDER"}
                      </button>
                      {user && currentProject && (
                        <p className="px-4 py-1.5 text-[10px] text-slate-600 truncate max-w-[220px] mx-auto" title={currentProject.name}>
                          {currentProject.name}
                        </p>
                      )}
                      <p className="px-4 py-2 text-[10px] text-slate-600 truncate max-w-[220px] mx-auto" title={user.email}>
                        {user.email}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setNavMenuOpen(false);
                          localStorage.removeItem("saas_mix_token");
                          localStorage.removeItem("saas_mix_user");
                          setUser(null);
                        }}
                        className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors border-t border-white/10 mt-1 pt-2"
                      >
                        DÉCONNEXION
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/connexion" onClick={() => setNavMenuOpen(false)} className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors">
                        CONNEXION
                      </Link>
                      <Link href="/inscription" onClick={() => setNavMenuOpen(false)} className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors">
                        INSCRIPTION
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <h1 className="mb-2 flex justify-center">
            <img
              src="/siberia-logo.png"
              alt="Siberia Mix"
              className="max-h-28 sm:max-h-36 md:max-h-44 lg:max-h-52 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl object-contain"
            />
          </h1>
          <p className="text-tagline text-slate-500 max-md:text-[10px] max-md:px-2">
            Mix & master automatique pour les artistes indépendants
          </p>
        </header>

        {showProjectsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" aria-modal="true" role="dialog">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-medium text-white">Mes projets</h2>
                <button
                  type="button"
                  onClick={() => setShowProjectsModal(false)}
                  className="p-2 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
                {projectsList.length === 0 && !isLoadingProject && (
                  <p className="text-slate-500 text-sm">Aucun projet sauvegardé.</p>
                )}
                {projectsList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white truncate">{p.name}</p>
                      {p.created_at && (
                        <p className="text-slate-500 text-xs mt-0.5">
                          {new Date(p.created_at).toLocaleDateString("fr-FR", { dateStyle: "short" })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isLoadingProject}
                        onClick={() => loadProject(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-50 transition-colors"
                      >
                        Charger
                      </button>
                      <button
                        type="button"
                        disabled={isLoadingProject}
                        onClick={() => openRenameProjectPrompt(p.id, p.name)}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-sm disabled:opacity-50 transition-colors"
                      >
                        Renommer
                      </button>
                      <button
                        type="button"
                        disabled={isLoadingProject}
                        onClick={() => deleteProject(p.id)}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-sm disabled:opacity-50 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tracks.length > 0 && (() => {
          return (
          <section className="mb-8 max-lg:mb-6 max-md:mb-4">
            <h2 className="sr-only">Lecture</h2>
            <div className="flex justify-center gap-2 max-md:gap-1.5">
              {!isPlaying ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => playAll()}
                    className="w-11 h-11 flex items-center justify-center rounded-lg border border-white/20 bg-white text-[#060608] hover:bg-white/90 transition-colors max-lg:w-10 max-lg:h-10 max-md:w-9 max-md:h-9 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={hasPausedPosition ? "Reprendre" : "Play tout"}
                    title={undefined}
                  >
                    <svg className="w-5 h-5 shrink-0 max-lg:w-4 max-lg:h-4 max-md:w-3.5 max-md:h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7L8 5z"/></svg>
                  </button>
                  {showPlayNoFileMessage && (
                    <p className="absolute left-1/2 top-full z-10 -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-300 text-center text-[10px] leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                      Veuillez choisir un fichier
                    </p>
                  )}
                </div>
              ) : (
                <button type="button" onClick={stopAll} className="btn-primary w-11 h-11 flex items-center justify-center rounded-lg max-lg:w-10 max-lg:h-10 max-md:w-9 max-md:h-9" aria-label="Pause">
                  <svg className="w-5 h-5 shrink-0 max-lg:w-4 max-lg:h-4 max-md:w-3.5 max-md:h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
              )}
            </div>
          </section>
          );
        })()}

        <section className="space-y-4 mt-8 max-lg:mt-6 max-lg:space-y-3 max-md:mt-4 max-md:space-y-2.5" aria-label="Pistes">
          {tracks.map((track) => (
            <div key={track.id} className="card p-5 relative max-lg:p-4">
              <button
                type="button"
                onClick={() => removeTrack(track.id)}
                className="absolute top-4 right-4 p-2 rounded text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors z-10 max-lg:top-2 max-lg:right-2 max-lg:p-1.5"
                title="Supprimer la piste"
              >
                ✕
              </button>

              {/* Affichage PC : 3 colonnes (Choisir, Catégorie, Gain) pour instrumental, 6 colonnes pour vocal */}
              <div
                className="grid w-full pr-10 gap-x-4 gap-y-1.5 max-lg:hidden"
                style={{
                  gridTemplateColumns: track.category === "instrumental" ? "1fr 1.2fr 1fr" : "1fr 1fr 1fr 1fr 1.2fr 1fr",
                }}
              >
                {track.category === "instrumental" ? (
                  <>
                    <div className="flex items-center justify-center min-h-[32px] min-w-0">
                      <span className="text-tagline text-center whitespace-nowrap block min-w-0">Fichier WAV</span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className={focusedCategoryTrackId === track.id ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Catégorie</span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className={gainSliderHoveredTrackId === track.id ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Gain {track.gain}%</span>
                    </div>
                    <div className="flex items-center min-w-0">
                      <label
                        htmlFor={`file-${track.id}`}
                        className="group w-full min-w-0 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tagline cursor-pointer hover:bg-white/10 transition-colors text-center px-4"
                        onClick={() => setFileChooserActiveTrackId(track.id)}
                      >
                        <span className={!track.file ? "glow-blink-slow transition-colors" : "text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors"}>CHOISIR</span>
                      </label>
                      <input
                        id={`file-${track.id}`}
                        type="file"
                        accept=".wav,audio/wav"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          onFileSelect(track.id, file);
                          if (file) setFileChooserActiveTrackId(null);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center min-w-0">
                      <CustomSelect
                        value={track.category}
                        onChange={(v) => {
                          const newCategory = v as Category;
                          updateTrack(track.id, {
                            category: newCategory,
                            mixParams: {
                              ...track.mixParams,
                              phone_fx: newCategory === "adlibs_backs",
                            },
                          });
                        }}
                        onFocus={() => setFocusedCategoryTrackId(track.id)}
                        onBlur={() => setFocusedCategoryTrackId(null)}
                        variant="category"
                        className="w-full min-w-0"
                        options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({
                          value: c,
                          label: CATEGORY_LABELS[c],
                        }))}
                      />
                    </div>
                    <div
                      className="flex items-center h-9"
                      onMouseEnter={() => setGainSliderHoveredTrackId(track.id)}
                      onMouseLeave={() => setGainSliderHoveredTrackId(null)}
                    >
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={track.gain}
                        onChange={(e) =>
                          updateTrack(track.id, {
                            gain: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 rounded appearance-none bg-white/10 accent-slate-400"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`flex items-center justify-center min-h-[32px] min-w-0 ${fileChooserActiveTrackId === track.id ? "" : "overflow-hidden"}`}>
                      <span className={`text-tagline text-center whitespace-nowrap block min-w-0 ${fileChooserActiveTrackId === track.id ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "overflow-hidden text-ellipsis"}`}>
                        Fichier WAV{track.file ? ` ${track.file.name}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className={track.isMixing ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>MIXER</span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className={track.paramsOpen ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>RÉGLAGES</span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className="text-tagline text-center whitespace-nowrap">AVANT / APRÈS</span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className={focusedCategoryTrackId === track.id ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Catégorie</span>
                    </div>
                    <div className="flex items-center justify-center min-h-[32px]">
                      <span className={gainSliderHoveredTrackId === track.id ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Gain {track.gain}%</span>
                    </div>
                    <div className="flex items-center min-w-0">
                      <label
                        htmlFor={`file-${track.id}`}
                        className="group w-full min-w-0 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tagline cursor-pointer hover:bg-white/10 transition-colors text-center px-4"
                        onClick={() => setFileChooserActiveTrackId(track.id)}
                      >
                        <span className={!track.file ? "glow-blink-slow transition-colors" : "text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors"}>CHOISIR</span>
                      </label>
                      <input
                        id={`file-${track.id}`}
                        type="file"
                        accept=".wav,audio/wav"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          onFileSelect(track.id, file);
                          if (file) setFileChooserActiveTrackId(null);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (!track.file) {
                            setNoFileMessageTrackId(track.id);
                            setTimeout(() => setNoFileMessageTrackId(null), 3000);
                            return;
                          }
                          runMix(track.id);
                        }}
                        disabled={track.isMixing}
                        className={`w-full h-9 flex items-center justify-center rounded-lg border text-tagline disabled:cursor-not-allowed ${
                          track.isMixing
                            ? "border-white/30 bg-slate-800 text-white"
                            : "border-white/20 bg-white text-[#060608] hover:bg-white/90 disabled:opacity-50"
                        }`}
                      >
                        {track.isMixing ? (
                          <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                            MIXAGE<span className="inline-block animate-mix-dot [animation-delay:0ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:200ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:400ms]">.</span>
                          </span>
                        ) : (
                          "Mixer"
                        )}
                      </button>
                      {noFileMessageTrackId === track.id && (
                        <p className="absolute left-1/2 top-full z-10 -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-300 text-center text-[10px] leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                          Veuillez choisir un fichier
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          updateTrack(track.id, {
                            paramsOpen: !track.paramsOpen,
                          })
                        }
                        className="group w-full h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-tagline"
                      >
                        <span className="text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                          {track.paramsOpen ? "Masquer" : "Réglages"}
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          track.mixedAudioUrl &&
                          togglePlayMode(
                            track.id,
                            track.playMode === "raw" ? "mixed" : "raw"
                          )
                        }
                        disabled={!track.mixedAudioUrl}
                        className="w-full h-9 flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:hover:bg-white/5 disabled:cursor-default text-tagline disabled:opacity-80 px-4"
                      >
                        <span
                          className={
                            track.mixedAudioUrl && track.playMode === "raw"
                              ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                              : "text-slate-400"
                          }
                        >
                          AVANT
                        </span>
                        <span className="text-slate-500">/</span>
                        <span
                          className={
                            track.mixedAudioUrl && track.playMode === "mixed"
                              ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                              : "text-slate-400"
                          }
                        >
                          APRÈS
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center justify-center min-w-0">
                      <CustomSelect
                        value={track.category}
                        onChange={(v) => {
                          const newCategory = v as Category;
                          updateTrack(track.id, {
                            category: newCategory,
                            mixParams: {
                              ...track.mixParams,
                              phone_fx: newCategory === "adlibs_backs",
                            },
                          });
                        }}
                        onFocus={() => setFocusedCategoryTrackId(track.id)}
                        onBlur={() => setFocusedCategoryTrackId(null)}
                        variant="category"
                        className="w-full min-w-0"
                        options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({
                          value: c,
                          label: CATEGORY_LABELS[c],
                        }))}
                      />
                    </div>
                    <div
                      className="flex items-center h-9"
                      onMouseEnter={() => setGainSliderHoveredTrackId(track.id)}
                      onMouseLeave={() => setGainSliderHoveredTrackId(null)}
                    >
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={track.gain}
                        onChange={(e) =>
                          updateTrack(track.id, {
                            gain: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 rounded appearance-none bg-white/10 accent-slate-400"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Interface mobile : instrumental = empilement vertical (Choisir, Catégorie, Gain) comme lead ; vocal = layout avec Mixer/Réglages/Avant-Après */}
              <div className="lg:hidden space-y-4 mt-4">
                <div className={track.category === "instrumental" ? "space-y-3" : "space-y-3"}>
                  {track.category === "instrumental" ? (
                    <>
                      <div>
                        <span className="text-tagline text-slate-500 text-[10px] block mb-1 max-md:text-[9px]">Fichier WAV</span>
                        <label
                          htmlFor={`file-mob-${track.id}`}
                          className="block w-full py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline cursor-pointer hover:bg-white/10 transition-colors text-center text-[10px] max-md:text-[9px]"
                        >
                          <span className={!track.file ? "glow-blink-slow" : "text-slate-500"}>{!track.file ? "CHOISIR UN FICHIER" : "CHANGER"}</span>
                        </label>
                        <input
                          id={`file-mob-${track.id}`}
                          type="file"
                          accept=".wav,audio/wav"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            onFileSelect(track.id, file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      <div>
                        <span className="text-tagline text-slate-500 text-[10px] block mb-1 max-md:text-[9px]">Catégorie</span>
                        <CustomSelect
                          value={track.category}
                          onChange={(v) => {
                            const c = v as Category;
                            updateTrack(track.id, { category: c, mixParams: { ...track.mixParams, phone_fx: c === "adlibs_backs" } });
                          }}
                          onFocus={() => setFocusedCategoryTrackId(track.id)}
                          onBlur={() => setFocusedCategoryTrackId(null)}
                          variant="category"
                          className="w-full text-[10px] max-md:text-[9px]"
                          options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
                        />
                      </div>
                      <div>
                        <span className="text-tagline text-slate-500 text-[10px] block mb-1 max-md:text-[9px]">Gain {track.gain}%</span>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={track.gain}
                          onChange={(e) =>
                            updateTrack(track.id, {
                              gain: Number(e.target.value),
                            })
                          }
                          className="w-full h-2 rounded appearance-none bg-white/10 accent-slate-400 max-md:h-1.5"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-tagline text-slate-500 text-[10px] block mb-1 max-md:text-[9px]">Fichier WAV{track.file ? ` · ${track.file.name}` : ""}</span>
                        <label
                          htmlFor={`file-mob-${track.id}`}
                          className="block w-full py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline cursor-pointer hover:bg-white/10 transition-colors text-center text-[10px] max-md:text-[9px]"
                        >
                          <span className={!track.file ? "glow-blink-slow" : "text-slate-500"}>{!track.file ? "CHOISIR UN FICHIER" : "CHANGER"}</span>
                        </label>
                        <input
                          id={`file-mob-${track.id}`}
                          type="file"
                          accept=".wav,audio/wav"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            onFileSelect(track.id, file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-md:gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!track.file) {
                              setNoFileMessageTrackId(track.id);
                              setTimeout(() => setNoFileMessageTrackId(null), 3000);
                              return;
                            }
                            runMix(track.id);
                          }}
                          disabled={track.isMixing}
                          className={`py-2.5 rounded-lg border text-tagline text-[10px] max-md:text-[9px] ${
                            track.isMixing
                              ? "border-white/30 bg-slate-800 text-white disabled:opacity-50"
                              : "border-white/20 bg-white text-[#060608] hover:bg-white/90 disabled:opacity-50"
                          }`}
                        >
                          {track.isMixing ? (
                            <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                              MIXAGE<span className="inline-block animate-mix-dot [animation-delay:0ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:200ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:400ms]">.</span>
                            </span>
                          ) : (
                            "Mixer"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTrack(track.id, { paramsOpen: !track.paramsOpen })}
                          className="py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline text-[10px] max-md:text-[9px] hover:bg-white/10"
                        >
                          {track.paramsOpen ? "Masquer" : "Réglages"}
                        </button>
                        <button
                          type="button"
                          onClick={() => track.mixedAudioUrl && togglePlayMode(track.id, track.playMode === "raw" ? "mixed" : "raw")}
                          disabled={!track.mixedAudioUrl}
                          className="py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline text-[10px] max-md:text-[9px] hover:bg-white/10 disabled:opacity-50 col-span-2 flex items-center justify-center gap-1"
                        >
                          <span className={track.mixedAudioUrl && track.playMode === "raw" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-slate-400"}>AVANT</span>
                          <span className="text-slate-500">/</span>
                          <span className={track.mixedAudioUrl && track.playMode === "mixed" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-slate-400"}>APRÈS</span>
                        </button>
                      </div>
                      <div>
                        <span className="text-tagline text-slate-500 text-[10px] block mb-1 max-md:text-[9px]">Catégorie</span>
                        <CustomSelect
                          value={track.category}
                          onChange={(v) => {
                            const c = v as Category;
                            updateTrack(track.id, { category: c, mixParams: { ...track.mixParams, phone_fx: c === "adlibs_backs" } });
                          }}
                          onFocus={() => setFocusedCategoryTrackId(track.id)}
                          onBlur={() => setFocusedCategoryTrackId(null)}
                          variant="category"
                          className="w-full text-[10px] max-md:text-[9px]"
                          options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
                        />
                      </div>
                      <div>
                        <span className="text-tagline text-slate-500 text-[10px] block mb-1 max-md:text-[9px]">Gain {track.gain}%</span>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={track.gain}
                          onChange={(e) => updateTrack(track.id, { gain: Number(e.target.value) })}
                          className="w-full h-2 rounded appearance-none bg-white/10 accent-slate-400 max-md:h-1.5"
                        />
                      </div>
                    </>
                  )}
                </div>
                {noFileMessageTrackId === track.id && (
                  <p className="text-tagline text-slate-300 text-[10px] max-md:text-[9px] text-center">Choisir un fichier pour mixer.</p>
                )}
              </div>

              {track.waveformPeaks != null && track.waveformDuration != null && track.waveformDuration > 0 && (
                <div className="mt-4 w-full">
                  <div className="relative">
                    <Waveform
                      peaks={track.waveformPeaks}
                      duration={track.waveformDuration}
                      currentTime={currentTimeForWaveform}
                      onSeek={seekTo}
                      className="w-full"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearTrackFile(track.id);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 right-0.5 w-5 h-5 rounded p-1 text-white hover:bg-white/5 flex items-center justify-center text-base leading-none transition-colors"
                      title="Supprimer le fichier de la piste"
                      aria-label="Supprimer le fichier de la piste"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="h-0 overflow-visible relative">
                    <p className="absolute top-[0.15rem] left-0 right-0 text-tagline text-slate-500 text-[10px] max-md:text-[9px] text-center truncate w-full pointer-events-none" title={track.file?.name ?? track.rawFileName ?? ""}>
                      {track.file?.name ?? track.rawFileName ?? ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Paramètres mix : vocal = tout, instrumental = basses/mids/aigus uniquement — affichage PC uniquement */}
              {track.paramsOpen && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-3 gap-4 max-lg:hidden">
                  {/* Basses / Mids / Aigus : pour toutes les pistes */}
                  <div>
                    <span className={focusedToneSelect?.trackId === track.id && focusedToneSelect?.type === "tone_low" ? "text-tagline block mb-1 text-center text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline block mb-1 text-center"}>Basses</span>
                    <CustomSelect
                      value={track.mixParams.tone_low}
                      onChange={(v) =>
                        updateTrack(track.id, {
                          mixParams: {
                            ...track.mixParams,
                            tone_low: Number(v) as 1 | 2 | 3,
                          },
                        })
                      }
                      onFocus={() => setFocusedToneSelect({ trackId: track.id, type: "tone_low" })}
                      onBlur={() => setFocusedToneSelect(null)}
                      className="w-full"
                      options={[
                        { value: 1, label: "1" },
                        { value: 2, label: "2" },
                        { value: 3, label: "3" },
                      ]}
                    />
                  </div>
                  <div>
                    <span className={focusedToneSelect?.trackId === track.id && focusedToneSelect?.type === "tone_mid" ? "text-tagline block mb-1 text-center text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline block mb-1 text-center"}>Mids</span>
                    <CustomSelect
                      value={track.mixParams.tone_mid}
                      onChange={(v) =>
                        updateTrack(track.id, {
                          mixParams: {
                            ...track.mixParams,
                            tone_mid: Number(v) as 1 | 2 | 3,
                          },
                        })
                      }
                      onFocus={() => setFocusedToneSelect({ trackId: track.id, type: "tone_mid" })}
                      onBlur={() => setFocusedToneSelect(null)}
                      className="w-full"
                      options={[
                        { value: 1, label: "1" },
                        { value: 2, label: "2" },
                        { value: 3, label: "3" },
                      ]}
                    />
                  </div>
                  <div>
                    <span className={focusedToneSelect?.trackId === track.id && focusedToneSelect?.type === "tone_high" ? "text-tagline block mb-1 text-center text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline block mb-1 text-center"}>Aigus</span>
                    <CustomSelect
                      value={track.mixParams.tone_high}
                      onChange={(v) =>
                        updateTrack(track.id, {
                          mixParams: {
                            ...track.mixParams,
                            tone_high: Number(v) as 1 | 2 | 3,
                          },
                        })
                      }
                      onFocus={() => setFocusedToneSelect({ trackId: track.id, type: "tone_high" })}
                      onBlur={() => setFocusedToneSelect(null)}
                      className="w-full"
                      options={[
                        { value: 1, label: "1" },
                        { value: 2, label: "2" },
                        { value: 3, label: "3" },
                      ]}
                    />
                  </div>
                  {/* Delay + Division, Reverb + Reverb box, Air + BPM : vocal uniquement */}
                  {isVocal(track.category) && (
                    <>
                      <div className="flex flex-col min-w-0">
                        <label className="flex items-center justify-center gap-2 mb-4">
                          <input
                            type="checkbox"
                            checked={track.mixParams.delay}
                            onChange={(e) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  delay: e.target.checked,
                                },
                              })
                            }
                            className="checkbox-reglages rounded border border-white/10 bg-white/5"
                          />
                          <span className={track.mixParams.delay ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Delay</span>
                        </label>
                        <div>
                          <CustomSelect
                            value={track.mixParams.delay_division}
                            onChange={(v) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  delay_division: v as "1/4" | "1/2" | "1/8",
                                },
                              })
                            }
                            className="w-full"
                            options={[
                              { value: "1/4", label: "1/4" },
                              { value: "1/2", label: "1/2" },
                              { value: "1/8", label: "1/8" },
                            ]}
                          />
                        </div>
                        <label className="flex items-center justify-center gap-2 mt-4">
                          <input
                            type="checkbox"
                            checked={track.mixParams.robot ?? false}
                            onChange={(e) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  robot: e.target.checked,
                                },
                              })
                            }
                            className="checkbox-reglages rounded border border-white/10 bg-white/5"
                          />
                          <span className={track.mixParams.robot ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>FX robot</span>
                        </label>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <label className="flex items-center justify-center gap-2 mb-4">
                          <input
                            type="checkbox"
                            checked={track.mixParams.air}
                            onChange={(e) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  air: e.target.checked,
                                },
                              })
                            }
                            className="checkbox-reglages rounded border border-white/10 bg-white/5"
                          />
                          <span className={track.mixParams.air ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Air</span>
                        </label>
                        <div className="flex items-center justify-center w-full min-w-0 min-h-[2rem] rounded-lg border border-white/10 bg-white/5 px-2 box-border">
                          <span className={`text-tagline shrink-0 ${focusedBpmTrackId === track.id ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : ""}`}>BPM</span>
                          <input
                            type="number"
                            min={60}
                            max={200}
                            value={track.mixParams.bpm}
                            onChange={(e) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  bpm: Number(e.target.value) || 120,
                                },
                              })
                            }
                            onFocus={() => setFocusedBpmTrackId(track.id)}
                            onBlur={() => setFocusedBpmTrackId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                                setFocusedBpmTrackId(null);
                              }
                            }}
                            className={`input-bpm w-10 bg-transparent border-none text-tagline text-center focus:outline-none focus:ring-0 p-0 ml-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${focusedBpmTrackId === track.id ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}
                          />
                        </div>
                        {isVocal(track.category) && (
                          <label className="flex items-center justify-center gap-2 mt-4">
                            <input
                              type="checkbox"
                              checked={track.mixParams.phone_fx}
                              onChange={(e) =>
                                updateTrack(track.id, {
                                  mixParams: {
                                    ...track.mixParams,
                                    phone_fx: e.target.checked,
                                  },
                                })
                              }
                              className="checkbox-reglages rounded border border-white/10 bg-white/5"
                            />
                            <span className={track.mixParams.phone_fx ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>FX téléphone</span>
                          </label>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <label className="flex items-center justify-center gap-2 mb-4">
                          <input
                            type="checkbox"
                            checked={track.mixParams.reverb}
                            onChange={(e) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  reverb: e.target.checked,
                                },
                              })
                            }
                            className="checkbox-reglages rounded border border-white/10 bg-white/5"
                          />
                          <span className={track.mixParams.reverb ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Reverb</span>
                        </label>
                        <div>
                          <CustomSelect
                            value={track.mixParams.reverb_mode}
                            onChange={(v) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  reverb_mode: Number(v) as 1 | 2 | 3,
                                },
                              })
                            }
                            className="w-full"
                            options={[
                              { value: 1, label: "Léger" },
                              { value: 2, label: "Moyen" },
                              { value: 3, label: "Fort" },
                            ]}
                          />
                        </div>
                        <label className="flex items-center justify-center gap-2 mt-4">
                          <input
                            type="checkbox"
                            checked={track.mixParams.doubler ?? false}
                            onChange={(e) =>
                              updateTrack(track.id, {
                                mixParams: {
                                  ...track.mixParams,
                                  doubler: e.target.checked,
                                },
                              })
                            }
                            className="checkbox-reglages rounded border border-white/10 bg-white/5"
                          />
                          <span className={track.mixParams.doubler ? "text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-tagline"}>Doubler</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Réglages mobile / tablette : 8 LIGNES HORIZONTALES, toutes alignées (même hauteur de ligne, même largeur colonne label, même hauteur box). PC non touché. */}
              {track.paramsOpen && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] lg:hidden flex flex-col gap-2">
                  {/* Grille : colonne label 5.5rem fixe, colonne control 1fr — toutes les lignes min-h-[2.25rem] et h-9 pour les selects */}
                  <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                    <span className={`text-tagline text-[10px] max-md:text-[9px] ${focusedToneSelect?.trackId === track.id && focusedToneSelect?.type === "tone_low" ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>Basses</span>
                    <CustomSelect value={track.mixParams.tone_low} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_low: Number(v) as 1 | 2 | 3 } })} onFocus={() => setFocusedToneSelect({ trackId: track.id, type: "tone_low" })} onBlur={() => setFocusedToneSelect(null)} className="w-full min-w-0 h-9 text-[10px] max-md:text-[9px]" options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
                  </div>
                  <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                    <span className={`text-tagline text-[10px] max-md:text-[9px] ${focusedToneSelect?.trackId === track.id && focusedToneSelect?.type === "tone_mid" ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>Mids</span>
                    <CustomSelect value={track.mixParams.tone_mid} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_mid: Number(v) as 1 | 2 | 3 } })} onFocus={() => setFocusedToneSelect({ trackId: track.id, type: "tone_mid" })} onBlur={() => setFocusedToneSelect(null)} className="w-full min-w-0 h-9 text-[10px] max-md:text-[9px]" options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
                  </div>
                  <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                    <span className={`text-tagline text-[10px] max-md:text-[9px] ${focusedToneSelect?.trackId === track.id && focusedToneSelect?.type === "tone_high" ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>Aigus</span>
                    <CustomSelect value={track.mixParams.tone_high} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_high: Number(v) as 1 | 2 | 3 } })} onFocus={() => setFocusedToneSelect({ trackId: track.id, type: "tone_high" })} onBlur={() => setFocusedToneSelect(null)} className="w-full min-w-0 h-9 text-[10px] max-md:text-[9px]" options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
                  </div>
                  {isVocal(track.category) && (
                    <>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <label className={`flex items-center gap-1.5 text-tagline text-[10px] max-md:text-[9px] ${track.mixParams.reverb ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>
                          <input type="checkbox" checked={track.mixParams.reverb} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, reverb: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          Reverb
                        </label>
                        <CustomSelect value={track.mixParams.reverb_mode} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, reverb_mode: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-[10px] max-md:text-[9px]" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <label className={`flex items-center gap-1.5 text-tagline text-[10px] max-md:text-[9px] ${track.mixParams.delay ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>
                          <input type="checkbox" checked={track.mixParams.delay} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          Delay
                        </label>
                        <CustomSelect value={track.mixParams.delay_division} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay_division: v as "1/4" | "1/2" | "1/8" } })} className="w-full min-w-0 h-9 text-[10px] max-md:text-[9px]" options={[{ value: "1/4", label: "1/4" }, { value: "1/2", label: "1/2" }, { value: "1/8", label: "1/8" }]} />
                      </div>
                      <div className="flex items-center justify-between min-h-[2.25rem] px-0 text-tagline text-[10px] max-md:text-[9px]">
                        <label className={`flex items-center gap-1.5 shrink-0 ${track.mixParams.phone_fx ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>
                          <input type="checkbox" checked={track.mixParams.phone_fx} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, phone_fx: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          FX téléphone
                        </label>
                        <label className={`flex items-center gap-1.5 shrink-0 w-[5.5rem] ${track.mixParams.robot ?? false ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>
                          <input type="checkbox" checked={track.mixParams.robot ?? false} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, robot: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          <span>FX robot</span>
                        </label>
                      </div>
                      <div className="flex items-center justify-between min-h-[2.25rem] px-0 text-tagline text-[10px] max-md:text-[9px]">
                        <label className={`flex items-center gap-1.5 shrink-0 ${track.mixParams.air ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>
                          <input type="checkbox" checked={track.mixParams.air} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, air: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          Air
                        </label>
                        <label className={`flex items-center gap-1.5 shrink-0 w-[5.5rem] ${track.mixParams.doubler ?? false ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>
                          <input type="checkbox" checked={track.mixParams.doubler ?? false} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, doubler: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          <span>Doubler</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <span className={`text-tagline text-[10px] max-md:text-[9px] ${focusedBpmTrackId === track.id ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}>BPM</span>
                        <div className="flex items-center h-9 w-full min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 box-border">
                          <input
                            type="number"
                            min={60}
                            max={200}
                            value={track.mixParams.bpm}
                            onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, bpm: Number(e.target.value) || 120 } })}
                            onFocus={() => setFocusedBpmTrackId(track.id)}
                            onBlur={() => setFocusedBpmTrackId(null)}
                            className={`input-bpm w-full min-w-0 bg-transparent border-none text-center focus:outline-none focus:ring-0 p-0 text-[10px] max-md:text-[9px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${focusedBpmTrackId === track.id ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-500"}`}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          ))}
        </section>

        <div className="group flex flex-col items-center gap-2 mt-6 mb-2 max-lg:mt-4 max-lg:gap-1.5 max-md:mt-3">
          <button
            type="button"
            onClick={addTrack}
            className="flex items-center justify-center w-12 h-12 rounded-full border border-white/20 bg-white/5 text-slate-500 transition-colors hover:bg-white/10 hover:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#060608] group-hover:text-white max-lg:w-11 max-lg:h-11 max-md:w-10 max-md:h-10"
            aria-label="Ajouter une piste"
          >
            <svg className="w-5 h-5 shrink-0 max-lg:w-4 max-lg:h-4 max-md:w-3.5 max-md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <p className="text-tagline text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors max-md:text-[10px]">AJOUTER UNE PISTE</p>
        </div>

        {tracks.length > 0 && (
          <div className="flex flex-col items-center gap-3 mt-6 max-lg:gap-2 max-lg:mt-4 max-md:gap-1.5 max-md:mt-3">
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (!user) { setShowLoginMixMessage(true); setTimeout(() => setShowLoginMixMessage(false), 4000); return; }
                  downloadMix();
                }}
                disabled={isRenderingMix}
                className="btn-primary group flex items-center justify-center text-center disabled:opacity-50 disabled:cursor-not-allowed max-lg:py-2 max-md:py-1.5 max-md:px-3"
              >
                <span className="text-tagline text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors max-md:text-[10px]">
                  {isRenderingMix ? "RENDU…" : "TÉLÉCHARGER LE MIX"}
                </span>
              </button>
              {showLoginMixMessage && !user && (
                <p className="absolute left-1/2 top-full z-10 -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-300 text-center text-[10px] leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                  Connectez-vous pour télécharger le mix.
                </p>
              )}
            </div>
            <div className="relative flex justify-center">
              <button
                type="button"
                onClick={() => {
                  if (!user) { setShowLoginMasterMessage(true); setTimeout(() => setShowLoginMasterMessage(false), 4000); return; }
                  runMaster();
                }}
                disabled={isMastering}
                className="h-9 px-5 flex items-center justify-center rounded-lg border border-white/20 bg-white text-[#060608] hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed text-tagline shrink-0 max-lg:h-8 max-lg:px-4 max-md:h-8 max-md:px-3 max-md:text-[10px]"
              >
                {isMastering ? "MASTERISATION…" : "MASTERISER"}
              </button>
              {showLoginMasterMessage && !user && (
                <p className="absolute left-1/2 top-full z-10 -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-300 text-center text-[10px] leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                  Connectez-vous pour masteriser.
                </p>
              )}
              {user && showMasterMessage && (
                <p className="absolute left-1/2 top-full z-10 -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-300 text-center text-[10px] leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                  Veuillez d&apos;abord effectuer un mix
                </p>
              )}
            </div>
          </div>
        )}

        {masterResult && (
          <section className="mt-10 max-w-xl mx-auto" aria-label="Résultat du master">
            <div className="card p-5 flex flex-col items-center text-center">
              <h2 className="text-tagline text-slate-400 mb-4">Résultat du master</h2>
              <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
                {!isMasterResultPlaying ? (
                  <button
                    type="button"
                    onClick={() => startMasterPlayback()}
                    disabled={!masterWaveforms}
                    className="btn-primary-accent disabled:opacity-50 w-11 h-11 flex items-center justify-center rounded-lg"
                    aria-label={masterResumeFrom > 0 ? "Reprendre" : "Play"}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7L8 5z"/></svg>
                  </button>
                ) : (
                  <button type="button" onClick={stopMasterPlayback} className="btn-primary w-11 h-11 flex items-center justify-center rounded-lg" aria-label="Pause">
                    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleMasterPlaybackMode}
                  className="h-9 flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-tagline px-4"
                >
                  <span
                    className={
                      masterPlaybackMode === "mix"
                        ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                        : "text-slate-400"
                    }
                  >
                    AVANT
                  </span>
                  <span className="text-slate-500">/</span>
                  <span
                    className={
                      masterPlaybackMode === "mix"
                        ? "text-slate-400"
                        : "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    }
                  >
                    APRÈS
                  </span>
                </button>
              </div>
              {masterWaveforms && (
                <div className="w-full mb-4">
                  <Waveform
                    peaks={
                      masterPlaybackMode === "mix"
                        ? masterWaveforms.mix.peaks
                        : masterWaveforms.master.peaks
                    }
                    duration={
                      masterPlaybackMode === "mix"
                        ? masterWaveforms.mix.duration
                        : masterWaveforms.master.duration
                    }
                    currentTime={isMasterResultPlaying ? masterPlaybackCurrentTime : masterResumeFrom}
                    onSeek={seekMaster}
                    className="mt-1"
                  />
                </div>
              )}
              {user ? (
                <a
                  href={masterResult.masterUrl}
                  download="master.wav"
                  className="btn-primary group inline-flex items-center justify-center text-center mt-2"
                >
                  <span className="text-tagline text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                    TÉLÉCHARGER LE MASTER
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowLoginMasterDownloadMessage(true); setTimeout(() => setShowLoginMasterDownloadMessage(false), 4000); }}
                  className="btn-primary group inline-flex items-center justify-center text-center mt-2 relative"
                >
                  <span className="text-tagline text-slate-500 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                    TÉLÉCHARGER LE MASTER
                  </span>
                  {showLoginMasterDownloadMessage && !user && (
                    <span className="absolute left-1/2 top-full -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-300 text-center text-[10px] leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg z-10">
                      Connectez-vous pour télécharger le master.
                    </span>
                  )}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
