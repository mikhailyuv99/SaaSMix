"use client";

import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { CustomSelect } from "../components/CustomSelect";
import { SubscriptionModal } from "../components/SubscriptionModal";
import { ManageSubscriptionModal } from "../components/ManageSubscriptionModal";
import {
  TrustBullets,
  HowItWorks,
  VideoSection,
  BeforeAfterSection,
  FeaturesSection,
  PricingSection,
  FAQContactSection,
} from "../components/landing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/** Types d'input où Espace = caractère espace (on ne fait pas play/pause) */
const INPUT_TYPES_FOR_TYPING = ["text", "search", "email", "url", "tel", "password", "number"];

function formatApiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Failed to fetch" || /NetworkError|Load failed|Failed to fetch/i.test(String(msg)))
    return "Impossible de joindre le serveur (api.siberiamix.com). Vérifiez votre connexion ou réessayez.";
  return msg;
}

type Category = "lead_vocal" | "adlibs_backs" | "instrumental";

export interface MixParams {
  delay: boolean;
  reverb: boolean;
  reverb_mode: 1 | 2 | 3;
  deesser: boolean;
  deesser_mode: 1 | 2 | 3;
  tone_low: 1 | 2 | 3;
  tone_mid: 1 | 2 | 3;
  tone_high: 1 | 2 | 3;
  air: boolean;
  bpm: number;
  delay_division: "1/4" | "1/2" | "1/8";
  delay_intensity: 1 | 2 | 3;
  phone_fx: boolean;
  doubler: boolean;
  robot: boolean;
}

const DEFAULT_MIX_PARAMS: MixParams = {
  delay: true,
  reverb: true,
  reverb_mode: 2,
  deesser: true,
  deesser_mode: 2,
  tone_low: 2,
  tone_mid: 2,
  tone_high: 2,
  air: false,
  bpm: 120,
  delay_division: "1/4",
  delay_intensity: 2,
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
  lead_vocal: "LEAD VOIX",
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
const HERO_UPLOAD_ID = "hero_upload";

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

const HERO_UPLOAD_COUNT_KEY = "hero_upload_count";

function getHeroUploadFiles(): Promise<{ blob: Blob; fileName: string }[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  return openFilesDB().then((db) => {
    return new Promise<{ blob: Blob; fileName: string }[]>((resolve) => {
      const tx = db.transaction(FILES_STORE_NAME, "readonly");
      const store = tx.objectStore(FILES_STORE_NAME);
      const countReq = store.get(HERO_UPLOAD_COUNT_KEY);
      countReq.onsuccess = () => {
        const count = (countReq.result as { count?: number } | undefined)?.count ?? 0;
        if (count <= 0) {
          db.close();
          resolve([]);
          return;
        }
        const results: { blob: Blob; fileName: string }[] = [];
        let done = 0;
        for (let i = 0; i < count; i++) {
          const req = store.get(`${HERO_UPLOAD_ID}_${i}`);
          req.onsuccess = () => {
            const row = req.result as { blob: Blob; fileName: string } | undefined;
            if (row) results.push({ blob: row.blob, fileName: row.fileName });
            done++;
            if (done === count) {
              db.close();
              resolve(results);
            }
          };
        }
      };
      countReq.onerror = () => { db.close(); resolve([]); };
    });
  }).catch(() => []);
}

function clearHeroUploadFromIDB(count: number): void {
  if (typeof window === "undefined" || count <= 0) return;
  openFilesDB().then((db) => {
    const tx = db.transaction(FILES_STORE_NAME, "readwrite");
    const store = tx.objectStore(FILES_STORE_NAME);
    store.delete(HERO_UPLOAD_COUNT_KEY);
    for (let i = 0; i < count; i++) store.delete(`${HERO_UPLOAD_ID}_${i}`);
    db.close();
  }).catch(() => {});
}

function deleteFileFromIDB(trackId: string): void {
  if (typeof window === "undefined") return;
  openFilesDB().then((db) => {
    const tx = db.transaction(FILES_STORE_NAME, "readwrite");
    tx.objectStore(FILES_STORE_NAME).delete(trackId);
    db.close();
  }).catch(() => {});
}

// ─── Persistent caches (attached to window) ────────────────────────
// Survive component unmount/remount, module hot-reload, and client-side navigation.
// Only destroyed on full page reload (F5 / Ctrl+R).
function getAbCache(): Map<string, ArrayBuffer> {
  if (typeof window === "undefined") return new Map();
  const w = window as unknown as Record<string, unknown>;
  if (!w.__saas_ab) w.__saas_ab = new Map<string, ArrayBuffer>();
  return w.__saas_ab as Map<string, ArrayBuffer>;
}
function getBufCache(): Map<string, { raw: AudioBuffer | null; mixed: AudioBuffer | null }> {
  if (typeof window === "undefined") return new Map();
  const w = window as unknown as Record<string, unknown>;
  if (!w.__saas_buf) w.__saas_buf = new Map<string, { raw: AudioBuffer | null; mixed: AudioBuffer | null }>();
  return w.__saas_buf as Map<string, { raw: AudioBuffer | null; mixed: AudioBuffer | null }>;
}


/** Sauvegarde sérialisable d'une piste pour sessionStorage.
 *  Inclut rawAudioUrl (blob URL) — survit aux navigations client-side (login). */
function tracksToStorage(tracks: Track[]): string {
  return JSON.stringify(
    tracks.map((t) => ({
      id: t.id,
      category: t.category,
      gain: t.gain,
      mixParams: t.mixParams,
      mixedAudioUrl: t.mixedAudioUrl,
      rawAudioUrl: t.rawAudioUrl ?? null,
      rawFileName: t.file?.name ?? t.rawFileName ?? null,
    }))
  );
}

/** Restaure des pistes depuis sessionStorage. rawAudioUrl (blob) survit aux nav client-side. */
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
      rawAudioUrl?: string | null;
      rawFileName?: string | null;
    }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((t) => ({
      id: t.id,
      file: null,
      category: t.category,
      gain: t.gain,
      rawAudioUrl: t.rawAudioUrl ?? null,
      mixedAudioUrl: t.mixedAudioUrl ?? null,
      isMixing: false,
      playMode: "mixed" as const,
      mixParams: { ...DEFAULT_MIX_PARAMS, ...(t.mixParams || {}) },
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
              className="text-slate-400"
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
  return [];
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
  const [activePlayer, setActivePlayer] = useState<"mix" | "master">("mix");
  const [masterResumeFrom, setMasterResumeFrom] = useState(0);
  const [gainSliderHoveredTrackId, setGainSliderHoveredTrackId] = useState<string | null>(null);
  const [focusedCategoryTrackId, setFocusedCategoryTrackId] = useState<string | null>(null);
  const [fileChooserActiveTrackId, setFileChooserActiveTrackId] = useState<string | null>(null);
  const [noFileMessageTrackId, setNoFileMessageTrackId] = useState<string | null>(null);
  const [showMasterMessage, setShowMasterMessage] = useState(false);
  const [showPlayNoFileMessage, setShowPlayNoFileMessage] = useState(false);
  const [projectBpm, setProjectBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState("120");
  const [mixedPreloadReady, setMixedPreloadReady] = useState<Record<string, boolean>>({});

  // BPM box : wheel non-passive pour que la molette modifie le BPM sans scroller la page
  useEffect(() => {
    const el = bpmBoxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const step = e.shiftKey ? 10 : 1;
      setProjectBpm((b) => {
        const next = Math.max(1, Math.min(300, b + delta * step));
        setBpmInput(String(next));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const [showLoginMixMessage, setShowLoginMixMessage] = useState(false);
  const [showLoginMasterMessage, setShowLoginMasterMessage] = useState(false);
  const [showLoginMasterDownloadMessage, setShowLoginMasterDownloadMessage] = useState(false);
  const [isDownloadingMaster, setIsDownloadingMaster] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [manageSubscriptionModalOpen, setManageSubscriptionModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerSuccess, setRegisterSuccess] = useState(false);
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
  const [categoryModal, setCategoryModal] = useState<{
    trackId?: string;
    file: File;
    fromHero?: boolean;
    nextHeroFiles?: { blob: Blob; fileName: string }[];
    nextFiles?: File[];
  } | null>(null);
  const mixDropzoneInputRef = useRef<HTMLInputElement>(null);
  const [mixDropzoneDragging, setMixDropzoneDragging] = useState(false);
  const addTrackDropzoneInputRef = useRef<HTMLInputElement>(null);
  const [addTrackDropzoneDragging, setAddTrackDropzoneDragging] = useState(false);

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
  const masterResultSectionRef = useRef<HTMLElement | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const buffersRef = useRef(getBufCache());
  // Cache raw ArrayBuffers so we can re-decode without re-fetching when AudioContext changes (mobile)
  const abCacheRef = useRef(getAbCache());
  // On remount, re-attach to the window-level Maps (in case useRef created a new wrapper)
  buffersRef.current = getBufCache();
  abCacheRef.current = getAbCache();
  // Mobile iOS: route AudioContext output through MediaStreamDestination → HTMLAudioElement
  // so iOS actually sends audio to the speaker (ctx.destination alone doesn't work on iOS).
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const outputElRef = useRef<HTMLAudioElement | null>(null);
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
  const pendingPlayableAfterMixRef = useRef<Track[] | null>(null);
  const bpmBoxRef = useRef<HTMLDivElement | null>(null);

  // Préchargement depuis le hero (dropzone accueil) : un ou plusieurs fichiers en IDB
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "hero") return;
    getHeroUploadFiles().then((files) => {
      window.history.replaceState(null, "", window.location.pathname);
      if (!files.length) return;
      clearHeroUploadFromIDB(files.length);
      const first = files[0];
      const file = new File([first.blob], first.fileName, { type: first.blob.type || "audio/wav" });
      const next = files.slice(1);
      setCategoryModal({ file, fromHero: true, nextHeroFiles: next });
    }).catch(() => {
      window.history.replaceState(null, "", window.location.pathname);
    });
  }, []);

  // Utilisateur connecté (localStorage) + restauration des pistes depuis sessionStorage.
  // rawAudioUrl (blob URL) survit aux navigations client-side (login) et est restauré directement.
  // Le fichier File sera réhydraté en background par le useEffect per-track ci-dessous.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("saas_mix_user");
      if (raw) {
        const u = JSON.parse(raw) as { id: string; email: string };
        if (u?.id && u?.email) setUser(u);
      }
      if (window.location.search.includes("from=hero")) return;
      const restored = tracksFromStorage();
      if (!restored || restored.length === 0) return;
      setTracks(restored);

      // Ensure an AudioContext exists so the pre-decode useEffect can fire.
      if (!contextRef.current || contextRef.current.state === "closed") {
        contextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      // Compute waveforms. If we already have decoded buffers from before navigation
      // (module-level cache survives remount), use them directly — zero network I/O, zero decoding.
      const withUrl = restored.filter((t) => t.rawAudioUrl);
      if (withUrl.length === 0) return;

      const wCtx = contextRef.current;
      Promise.all(
        withUrl.map(async (track) => {
          try {
            // Fast path: use cached decoded buffer (survives remount via module-level Map)
            const cached = buffersRef.current.get(track.id);
            if (cached?.raw) {
              const peaks = computeWaveformPeaks(cached.raw, WAVEFORM_POINTS);
              return { id: track.id, peaks, duration: cached.raw.duration };
            }
            // Slow path: fetch + decode (first load or full page refresh)
            const cacheKey = `raw:${track.rawAudioUrl}`;
            let ab = abCacheRef.current.get(cacheKey);
            if (!ab) {
              const res = await fetch(track.rawAudioUrl!);
              if (!res.ok) return null;
              ab = await res.arrayBuffer();
              abCacheRef.current.set(cacheKey, ab.slice(0));
            }
            const decoded = await wCtx.decodeAudioData(ab.slice(0));
            const peaks = computeWaveformPeaks(decoded, WAVEFORM_POINTS);
            return { id: track.id, peaks, duration: decoded.duration };
          } catch (_) {
            return null;
          }
        })
      ).then((results) => {
        const updates = results.filter(Boolean) as Array<{
          id: string; peaks: number[]; duration: number;
        }>;
        if (updates.length === 0) return;
        setTracks((prev) =>
          prev.map((t) => {
            const u = updates.find((x) => x.id === t.id);
            if (!u) return t;
            return { ...t, waveformPeaks: u.peaks, waveformDuration: u.duration };
          })
        );
      });
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

  // Waveforms du résultat master (fallback — normally decoded in runMaster before isMastering=false)
  useEffect(() => {
    if (!masterResult) return;
    // Skip if already decoded in runMaster
    if (masterMixBufferRef.current && masterMasterBufferRef.current && masterWaveforms) return;
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

  // Auto-scroll to master result card when mastering finishes
  useEffect(() => {
    if (masterResult && masterResultSectionRef.current) {
      setTimeout(() => {
        masterResultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
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
                nodes.mixedBufferNode.onended = null;
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
      if (outputElRef.current) {
        try { outputElRef.current.pause(); outputElRef.current.srcObject = null; } catch (_) {}
        outputElRef.current = null;
      }
      streamDestRef.current = null;
      const ctx = contextRef.current;
      if (ctx) {
        try {
          ctx.close();
        } catch (_) {}
        contextRef.current = null;
      }
    };
  }, []);

  // Generate a proper silent WAV blob URL with REAL (quiet) audio data.
  // The old base64 SILENT_WAV had zero data bytes — iOS Safari ignored it entirely.
  const silentWavUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const sr = 44100;
    const nSamples = 4410; // 100ms
    const dataBytes = nSamples * 2;
    const buf = new ArrayBuffer(44 + dataBytes);
    const v = new DataView(buf);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + dataBytes, true); w(8, "WAVE");
    w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, dataBytes, true);
    for (let i = 0; i < nSamples; i++) v.setInt16(44 + i * 2, 1, true); // amplitude 1/32768 — inaudible but non-zero
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }, []);
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
          // Play non-zero buffer — iOS ignores all-zero buffers
          const numSamples = Math.max(1, Math.min(Math.ceil(ctx.sampleRate * 0.05), 4096));
          const buf = ctx.createBuffer(1, numSamples, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = 1e-7;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
        const au = new Audio(silentWavUrl);
        au.volume = 0.01; // must be > 0 for iOS to activate audio session
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
    const playable = tracks.filter((t) => t.rawAudioUrl);
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
  if (typeof window !== "undefined") {
    // Use user agent to detect actual mobile devices — NOT touch support.
    // Touchscreen PCs (Windows) have maxTouchPoints > 0 but must use the PC (AudioBufferSourceNode) path.
    const ua = navigator.userAgent;
    isMobileRef.current = /Android|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    // The Macintosh + maxTouchPoints > 1 check detects iPad (iPadOS reports desktop UA).
  }
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
              nodes.mixedBufferNode.onended = null;
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
              nodes.mixedBufferNode.onended = null;
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

  const applyGainToNodes = useCallback(
    (id: string, gainVal: number, playMode?: "raw" | "mixed", hasMixed?: boolean) => {
      const g = Math.max(0, Math.min(2, Number(gainVal) / 100));
      if (!Number.isFinite(g)) return;
      try {
        const nodes = trackPlaybackRef.current.get(id);
        if (!nodes) return;
        const t = tracksRef.current.find((tr) => tr.id === id);
        const pm = playMode ?? t?.playMode ?? "raw";
        const hm = hasMixed ?? Boolean(t?.mixedAudioUrl);
        if (nodes.mainGain?.gain != null) nodes.mainGain.gain.value = g;
        if (nodes.type === "instrumental" && "media" in nodes && nodes.media?.element) {
          if (!nodes.media.source) nodes.media.element.volume = Math.min(1, g);
        }
        if (nodes.type === "vocal") {
          // PC (Web Audio): raw/mixed gains control which buffer is heard; keep in sync with playMode
          if (nodes.rawGain?.gain != null) nodes.rawGain.gain.value = pm === "raw" || !hm ? 1 : 0;
          if (nodes.mixedGain?.gain != null) nodes.mixedGain.gain.value = pm === "mixed" && hm ? 1 : 0;
          // Mobile (HTML5 Audio): element volumes
          if (!nodes.rawMedia?.source && !nodes.mixedMedia?.source) {
            const rawVol = (pm === "raw" || !hm ? 1 : 0) * Math.min(1, g);
            const mixedVol = (pm === "mixed" && hm ? 1 : 0) * Math.min(1, g);
            if (nodes.rawMedia?.element) nodes.rawMedia.element.volume = rawVol;
            if (nodes.mixedMedia?.element) nodes.mixedMedia.element.volume = mixedVol;
          }
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const updateTrack = useCallback(
    (id: string, updates: Partial<Omit<Track, "id">>) => {
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      if ("gain" in updates && updates.gain !== undefined) {
        applyGainToNodes(id, updates.gain);
      }
    },
    [applyGainToNodes]
  );

  // Synchroniser le gain (slider) et le volume Avant/Après avec les nodes en cours de lecture
  useEffect(() => {
    try {
      tracks.forEach((t) => {
        if (trackPlaybackRef.current.has(t.id)) {
          applyGainToNodes(t.id, t.gain ?? 100, t.playMode, Boolean(t.mixedAudioUrl));
        }
      });
    } catch (_) {
      // ignore
    }
  }, [tracks, applyGainToNodes]);

  // Réhydrater les fichiers File depuis IndexedDB (nécessaire pour le mixage qui upload le fichier).
  // rawAudioUrl est déjà restauré depuis sessionStorage — on ne le remplace pas s'il est déjà valide.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toHydrate = tracks.filter((t) => t.rawFileName && !t.file);
    toHydrate.forEach((track) => {
      const id = track.id;
      getFileFromIDB(id).then((data) => {
        if (!data) return;
        const file = new File([data.blob], data.fileName, { type: data.blob.type || "audio/wav" });
        const updates: Partial<Omit<Track, "id">> = { file, rawFileName: null };
        // Only set rawAudioUrl if there isn't one already (avoid replacing a valid blob URL)
        const current = tracksRef.current.find((t) => t.id === id);
        if (!current?.rawAudioUrl) {
          updates.rawAudioUrl = URL.createObjectURL(file);
        }
        updateTrack(id, updates);
      });
    });
  }, [tracks, updateTrack]);

  const applyFileWithCategory = useCallback(
    (id: string, file: File, category: Category) => {
      saveFileToIDB(id, file);
      const rawAudioUrl = file.type.startsWith("audio/") ? URL.createObjectURL(file) : null;
      setTracks((prev) => {
        const track = prev.find((t) => t.id === id);
        if (!track) return prev;
        if (track.rawAudioUrl) URL.revokeObjectURL(track.rawAudioUrl);
        buffersRef.current.delete(id);
        return prev.map((t) =>
          t.id === id
            ? {
                ...t,
                file,
                category,
                rawAudioUrl,
                rawFileName: file.name ?? null,
                playMode: "raw",
                waveformPeaks: undefined,
                waveformDuration: undefined,
                mixParams: { ...t.mixParams, phone_fx: category === "adlibs_backs" },
              }
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
            updateTrack(id, { waveformPeaks: peaks, waveformDuration: buffer.duration });
          } catch (_) {}
        })();
        (async () => {
          try {
            const existingCtx = contextRef.current;
            const ctx = existingCtx && existingCtx.state !== "closed"
              ? existingCtx
              : new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const shouldClose = ctx !== existingCtx;
            const res = await fetch(rawAudioUrl);
            const buf = await res.arrayBuffer();
            const decoded = await ctx.decodeAudioData(buf);
            if (shouldClose) ctx.close();
            const entry = buffersRef.current.get(id) ?? { raw: null, mixed: null };
            entry.raw = decoded;
            buffersRef.current.set(id, entry);
          } catch (_) {}
        })();
      }
    },
    [updateTrack]
  );

  const onFileSelect = useCallback(
    (id: string, file: File | null) => {
      if (file) {
        setCategoryModal({ trackId: id, file, fromHero: false });
        return;
      }
      deleteFileFromIDB(id);
      setTracks((prev) => {
        const track = prev.find((t) => t.id === id);
        if (!track) return prev;
        if (track.rawAudioUrl) URL.revokeObjectURL(track.rawAudioUrl);
        buffersRef.current.delete(id);
        return prev.map((t) =>
          t.id === id
            ? { ...t, file: null, rawAudioUrl: null, rawFileName: null, playMode: "raw", waveformPeaks: undefined, waveformDuration: undefined }
            : t
        );
      });
      if (typeof document !== "undefined") {
        const input = document.getElementById(`file-${id}`) as HTMLInputElement | null;
        if (input) input.value = "";
        const inputMob = document.getElementById(`file-mob-${id}`) as HTMLInputElement | null;
        if (inputMob) inputMob.value = "";
      }
    },
    []
  );

  const createTrackFromFile = useCallback((file: File, category: Category) => {
    const newId = generateId();
    saveFileToIDB(newId, file);
    const rawAudioUrl = file.type.startsWith("audio/") ? URL.createObjectURL(file) : null;
    const track: Track = {
      id: newId,
      file,
      category,
      gain: 100,
      rawAudioUrl,
      mixedAudioUrl: null,
      isMixing: false,
      playMode: "raw",
      mixParams: { ...DEFAULT_MIX_PARAMS, phone_fx: category === "adlibs_backs" },
      paramsOpen: false,
      rawFileName: file.name,
    };
    setTracks((prev) => [...prev, track]);
    if (rawAudioUrl) {
      (async () => {
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const res = await fetch(rawAudioUrl);
          const ab = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(ab.slice(0));
          ctx.close();
          const peaks = computeWaveformPeaks(decoded, WAVEFORM_POINTS);
          const entry = buffersRef.current.get(newId) ?? { raw: null, mixed: null };
          entry.raw = decoded;
          buffersRef.current.set(newId, entry);
          setTracks((prev) =>
            prev.map((t) =>
              t.id === newId ? { ...t, waveformPeaks: peaks, waveformDuration: decoded.duration } : t
            )
          );
        } catch (_) {}
      })();
    }
  }, []);

  const applyCategoryChoice = useCallback(
    (category: Category) => {
      if (!categoryModal) return;
      const { trackId, file, fromHero, nextHeroFiles, nextFiles } = categoryModal;
      setCategoryModal(null);
      if (fromHero) {
        createTrackFromFile(file, category);
        if (nextHeroFiles?.length) {
          const next = nextHeroFiles[0];
          const nextFile = new File([next.blob], next.fileName, { type: next.blob.type || "audio/wav" });
          setCategoryModal({ file: nextFile, fromHero: true, nextHeroFiles: nextHeroFiles.slice(1) });
        }
        return;
      }
      if (nextFiles !== undefined) {
        createTrackFromFile(file, category);
        if (nextFiles.length) {
          setCategoryModal({ file: nextFiles[0], nextFiles: nextFiles.slice(1) });
        }
        return;
      }
      if (trackId) {
        applyFileWithCategory(trackId, file, category);
        if (typeof document !== "undefined") {
          const input = document.getElementById(`file-${trackId}`) as HTMLInputElement | null;
          if (input) input.value = "";
          const inputMob = document.getElementById(`file-mob-${trackId}`) as HTMLInputElement | null;
          if (inputMob) inputMob.value = "";
        }
      }
    },
    [categoryModal, applyFileWithCategory, createTrackFromFile]
  );

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("saas_mix_token");
    const h: Record<string, string> = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, []);

  const fetchBilling = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/billing/me`, { headers: getAuthHeaders() });
      if (res.status === 401) return;
      const data = await res.json().catch(() => ({}));
      setIsPro(Boolean(data.isPro));
    } catch (_) {}
  }, [getAuthHeaders]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
    if (token) fetchBilling();
  }, [user?.id, fetchBilling]);

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
              mixParams: { ...DEFAULT_MIX_PARAMS, ...(t.mixParams || {}) },
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
      const cacheKey = `raw:${rawUrl}`;
      let ab = abCacheRef.current.get(cacheKey);
      if (!ab) {
        try {
          const res = await fetch(rawUrl);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          ab = await res.arrayBuffer();
          abCacheRef.current.set(cacheKey, ab);
        } catch (_) {
          // Blob URL is stale (full page reload) — fallback to IDB
          const data = await getFileFromIDB(id);
          if (data) {
            const file = new File([data.blob], data.fileName, { type: data.blob.type || "audio/wav" });
            const freshUrl = URL.createObjectURL(file);
            const res2 = await fetch(freshUrl);
            ab = await res2.arrayBuffer();
            abCacheRef.current.set(`raw:${freshUrl}`, ab);
            // Update the track with the new valid blob URL
            updateTrack(id, { file, rawAudioUrl: freshUrl, rawFileName: data.fileName });
          }
        }
      }
      if (ab) entry.raw = await ctx.decodeAudioData(ab.slice(0));
    }
    if (mixedUrl && !entry.mixed) {
      const fullUrl = mixedUrl.startsWith("http") ? mixedUrl : `${API_BASE}${mixedUrl}`;
      const cacheKey = `mixed:${fullUrl}`;
      let ab = abCacheRef.current.get(cacheKey);
      if (!ab) {
        const res = await fetch(fullUrl);
        ab = await res.arrayBuffer();
        abCacheRef.current.set(cacheKey, ab);
      }
      entry.mixed = await ctx.decodeAudioData(ab.slice(0));
    }
    buffersRef.current.set(id, entry);
  }

  /** Charge tous les buffers (raw + mixed si disponible). Si déjà pré-décodés, retour immédiat = 0 latence au tap Play. */
  async function ensureAllBuffersLoaded(playable: Track[]): Promise<void> {
    let allReady = true;
    for (const t of playable) {
      const entry = buffersRef.current.get(t.id) ?? { raw: null, mixed: null };
      if (!entry.raw) {
        allReady = false;
        break;
      }
      // Load mixed buffer whenever mixedAudioUrl exists (needed for Avant/Après toggle)
      if (t.mixedAudioUrl && !entry.mixed) {
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
      t.mixedAudioUrl
        ? t.mixedAudioUrl.startsWith("http")
          ? t.mixedAudioUrl
          : `${API_BASE}${t.mixedAudioUrl}`
        : null;
    await Promise.all(playable.map((t) => decodeTrackBuffers(t.id, fullRaw(t), fullMixed(t))));
    for (const t of playable) {
      const entry = buffersRef.current.get(t.id) ?? { raw: null, mixed: null };
      if (!entry.raw) throw new Error("Chargement du fichier en cours ou échoué. Réessayez.");
      if (t.mixedAudioUrl && !entry.mixed)
        throw new Error("Chargement du mix en cours ou échoué. Réessayez.");
    }
  }

  function stopAll() {
    userPausedRef.current = true;
    const nodesMap = Array.from(trackPlaybackRef.current.entries());
    const ctx = contextRef.current;
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
          if ("bufferNode" in nodes && nodes.bufferNode) {
            try { nodes.bufferNode.onended = null; nodes.bufferNode.stop(); nodes.bufferNode.disconnect(); } catch (_) {}
          }
          if ("media" in nodes) {
            try { nodes.media.element.pause(); if (nodes.media.source) nodes.media.source.disconnect(); } catch (_) {}
          }
        } else {
          if (nodes.rawBufferNode) { try { nodes.rawBufferNode.onended = null; nodes.rawBufferNode.stop(); nodes.rawBufferNode.disconnect(); } catch (_) {} }
          if (nodes.rawMedia) { try { nodes.rawMedia.element.pause(); if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect(); } catch (_) {} }
          if (nodes.rawUnlockGain) try { nodes.rawUnlockGain.disconnect(); } catch (_) {}
          if (nodes.mixedBufferNode) { try { nodes.mixedBufferNode.onended = null; nodes.mixedBufferNode.stop(); nodes.mixedBufferNode.disconnect(); } catch (_) {} }
          if (nodes.mixedMedia) { try { nodes.mixedMedia.element.pause(); if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect(); } catch (_) {} }
        }
      } catch (_) {}
    }
    // Pause the iOS output element (HTMLAudioElement connected to MediaStreamDestination)
    if (outputElRef.current) {
      try { outputElRef.current.pause(); } catch (_) {}
    }
  }

  const startPlaybackAtOffset = useCallback(
    (ctx: AudioContext, playable: Track[], offset: number) => {
      // Stop all existing playback
      const toStop = Array.from(trackPlaybackRef.current.entries());
      trackPlaybackRef.current.clear();
      for (const [, nodes] of toStop) {
        try {
          if (nodes.type === "instrumental") {
            if ("bufferNode" in nodes && nodes.bufferNode) {
              try { nodes.bufferNode.onended = null; nodes.bufferNode.stop(); nodes.bufferNode.disconnect(); } catch (_) {}
            }
            if ("media" in nodes) {
              try { nodes.media.element.onended = null; nodes.media.element.pause(); if (nodes.media.source) nodes.media.source.disconnect(); } catch (_) {}
            }
          } else {
            if (nodes.rawBufferNode) { try { nodes.rawBufferNode.onended = null; nodes.rawBufferNode.stop(); nodes.rawBufferNode.disconnect(); } catch (_) {} }
            if (nodes.rawMedia) { try { nodes.rawMedia.element.onended = null; nodes.rawMedia.element.pause(); if (nodes.rawMedia.source) nodes.rawMedia.source.disconnect(); } catch (_) {} }
            if (nodes.rawUnlockGain) try { nodes.rawUnlockGain.disconnect(); } catch (_) {}
            if (nodes.mixedBufferNode) { try { nodes.mixedBufferNode.onended = null; nodes.mixedBufferNode.stop(); nodes.mixedBufferNode.disconnect(); } catch (_) {} }
            if (nodes.mixedMedia) { try { nodes.mixedMedia.element.onended = null; nodes.mixedMedia.element.pause(); if (nodes.mixedMedia.source) nodes.mixedMedia.source.disconnect(); } catch (_) {} }
          }
        } catch (_) {}
      }

      // AudioBufferSourceNode playback — sample-accurate sync via scheduleAt
      let endedCount = 0;
      const totalTracks = playable.length;
      // On mobile: 150ms lead time gives iOS audio hardware time to fully activate after context creation.
      // On PC: 20ms is enough (context is long-lived, hardware already active).
      const leadTime = isMobileRef.current ? 0.15 : 0.02;
      const scheduleAt = ctx.currentTime + leadTime;
      startTimeRef.current = scheduleAt - offset;

      for (const track of playable) {
        if (!track.rawAudioUrl) continue;
        const bufEntry = buffersRef.current.get(track.id);
        if (!bufEntry?.raw) continue; // buffer not decoded — skip

        const trackMainGain = ctx.createGain();
        trackMainGain.gain.value = Math.max(0, Math.min(2, track.gain / 100));
        // On mobile: route through MediaStreamDestination → HTMLAudioElement (iOS audio fix)
        // On PC: connect directly to ctx.destination
        const audioOutput = streamDestRef.current ?? ctx.destination;
        trackMainGain.connect(audioOutput);

        const safeOffset = Math.min(offset, bufEntry.raw.duration);

        if (track.category === "instrumental") {
          const src = ctx.createBufferSource();
          src.buffer = bufEntry.raw;
          src.connect(trackMainGain);
          const currentSrc = src;
          src.onended = () => {
            const entry = trackPlaybackRef.current.get(track.id);
            if (entry && "bufferNode" in entry && entry.bufferNode === currentSrc) {
              trackPlaybackRef.current.delete(track.id);
              endedCount++;
              if (endedCount >= totalTracks) {
                setIsPlaying(false);
                setHasPausedPosition(false);
                resumeFromRef.current = 0;
              }
            }
          };
          src.start(scheduleAt, safeOffset);
          trackPlaybackRef.current.set(track.id, { type: "instrumental", bufferNode: src, mainGain: trackMainGain });
        } else {
          // Vocal track: raw + mixed buffer sources through separate gains
          const playMixed = track.playMode === "mixed" && track.mixedAudioUrl;
          const rawGain = ctx.createGain();
          const mixedGain = ctx.createGain();
          rawGain.connect(trackMainGain);
          mixedGain.connect(trackMainGain);
          rawGain.gain.value = playMixed ? 0 : 1;
          mixedGain.gain.value = playMixed ? 1 : 0;

          let vocalEnded = false;
          const onEndVocal = () => {
            if (vocalEnded) return;
            vocalEnded = true;
            trackPlaybackRef.current.delete(track.id);
            endedCount++;
            if (endedCount >= totalTracks) {
              setIsPlaying(false);
              setHasPausedPosition(false);
              resumeFromRef.current = 0;
            }
          };

          // Raw buffer source
          const rawSrc = ctx.createBufferSource();
          rawSrc.buffer = bufEntry.raw;
          rawSrc.connect(rawGain);
          rawSrc.onended = onEndVocal;
          rawSrc.start(scheduleAt, safeOffset);

          // Mixed buffer source (if available)
          let mixedBufNode: AudioBufferSourceNode | null = null;
          if (bufEntry.mixed) {
            const mixedSafeOffset = Math.min(offset, bufEntry.mixed.duration);
            const mixedSrc = ctx.createBufferSource();
            mixedSrc.buffer = bufEntry.mixed;
            mixedSrc.connect(mixedGain);
            mixedSrc.onended = onEndVocal;
            mixedSrc.start(scheduleAt, mixedSafeOffset);
            mixedBufNode = mixedSrc;
          }

          trackPlaybackRef.current.set(track.id, {
            type: "vocal",
            rawMedia: null,
            rawBufferNode: rawSrc,
            rawUnlockGain: null,
            mixedMedia: null,
            mixedBufferNode: mixedBufNode,
            rawGain,
            mixedGain,
            mainGain: trackMainGain,
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
      const playable = tracksRef.current.filter((t) => t.rawAudioUrl);
      if (playable.length === 0) return;
      const safeOffset = Math.max(0, offset);
      const now = Date.now();
      if (now - lastSeekRef.current.time < 120 && Math.abs(lastSeekRef.current.offset - safeOffset) < 0.05) return;
      lastSeekRef.current = { offset: safeOffset, time: now };

      if (isPlaying && ctx && trackPlaybackRef.current.size > 0) {
        // Seek = stop all + recreate at new offset. Sample-accurate via scheduleAt.
        const playable = tracksRef.current.filter((t) => t.rawAudioUrl);
        startPlaybackAtOffset(ctx, playable, safeOffset);
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
    try {
      // 1) Play a near-zero buffer — iOS ignores all-zero buffers and won't activate the audio session
      const numSamples = Math.max(1, Math.min(Math.ceil(ctx.sampleRate * 0.05), 4096));
      const buf = ctx.createBuffer(1, numSamples, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = 0.01; // quiet but audible enough for iOS to register
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      // 2) Brief oscillator — activates iOS audio hardware after long pauses
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.01;
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(0);
      osc.stop(ctx.currentTime + 0.1);
      audioUnlockedRef.current = true;
    } catch (_) {}
  }

  const playAll = useCallback(
    async (override?: { playable?: Track[]; startOffset?: number }) => {
      userPausedRef.current = false;

      // --- AudioContext setup FIRST (MUST be synchronous in user gesture for iOS) ---
      const isMob = isMobileRef.current;
      let ctx = contextRef.current;

      if (isMob) {
        if (outputElRef.current) {
          try { outputElRef.current.pause(); outputElRef.current.srcObject = null; } catch (_) {}
          outputElRef.current = null;
        }
        streamDestRef.current = null;
        if (ctx && ctx.state !== "closed") {
          try { ctx.close(); } catch (_) {}
        }
        ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        contextRef.current = ctx;
        audioUnlockedRef.current = false;

        try {
          const dest = ctx.createMediaStreamDestination();
          streamDestRef.current = dest;
          const outputEl = new Audio();
          outputEl.srcObject = dest.stream;
          outputEl.play().catch(() => {});
          outputElRef.current = outputEl;
        } catch (_) {
          streamDestRef.current = null;
          outputElRef.current = null;
        }
      } else if (!ctx || ctx.state === "closed") {
        ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        contextRef.current = ctx;
        audioUnlockedRef.current = false;
      }

      unlockAudioContextSync(ctx);
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      // --- Resolve playable tracks ---
      // Include tracks with rawFileName (can be loaded from IDB even without rawAudioUrl)
      let playable = override?.playable ?? pendingPlayableAfterMixRef.current ?? tracksRef.current.filter((t) => t.rawAudioUrl || t.rawFileName);
      if (playable.length > 0 && pendingPlayableAfterMixRef.current != null && !override?.playable) {
        pendingPlayableAfterMixRef.current = null;
      }
      const startOffset = override?.startOffset ?? resumeFromRef.current ?? 0;

      // For tracks missing rawAudioUrl but having rawFileName, load from IDB
      const needsIDB = playable.filter((t) => !t.rawAudioUrl && t.rawFileName);
      if (needsIDB.length > 0) {
        await Promise.all(
          needsIDB.map(async (track) => {
            try {
              const data = await getFileFromIDB(track.id);
              if (!data) return;
              const file = new File([data.blob], data.fileName, { type: data.blob.type || "audio/wav" });
              const freshUrl = URL.createObjectURL(file);
              updateTrack(track.id, { file, rawAudioUrl: freshUrl, rawFileName: null });
              // Update local reference (React state won't update until next render)
              (track as { rawAudioUrl: string | null }).rawAudioUrl = freshUrl;
            } catch (_) {}
          })
        );
        // Filter out tracks that still have no URL after IDB attempt
        playable = playable.filter((t) => t.rawAudioUrl);
      }

      if (playable.length === 0) {
        setShowPlayNoFileMessage(true);
        setTimeout(() => setShowPlayNoFileMessage(false), 3000);
        return;
      }
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
    [startPlaybackAtOffset, silentWavUrl]
  );

  playAllRef.current = playAll;

  const lastTogglePlayModeRef = useRef<{ id: string; ts: number } | null>(null);
  const togglePlayMode = useCallback(
    (id: string, targetMode: "raw" | "mixed") => {
      const now = Date.now();
      const last = lastTogglePlayModeRef.current;
      if (last?.id === id && now - last.ts < 120) return;
      lastTogglePlayModeRef.current = { id, ts: now };

      try {
        const nodes = trackPlaybackRef.current.get(id);
        if (nodes?.type === "vocal") {
          // Both raw and mixed buffer sources are already playing sample-locked.
          // Just switch gains — instant, no seeking needed.
          try {
            if (nodes.rawGain?.gain != null) nodes.rawGain.gain.value = targetMode === "raw" ? 1 : 0;
            if (nodes.mixedGain?.gain != null) nodes.mixedGain.gain.value = targetMode === "mixed" ? 1 : 0;
          } catch {}
        }
      } catch (_) {}
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

      // Resume AudioContext on user gesture (Run mix click) so it's running when mix completes for autoplay
      if (typeof window !== "undefined") {
        const ctx = contextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (!contextRef.current) contextRef.current = ctx;
        if (ctx.state === "suspended") {
          unlockAudioContextSync(ctx);
          ctx.resume().catch(() => {});
        }
      }

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
      form.append("deesser", String(p.deesser));
      form.append("deesser_mode", String(p.deesser_mode));
      form.append("delay", String(p.delay));
      form.append("delay_intensity", String(p.delay_intensity));
      form.append("reverb", String(p.reverb));
      form.append("reverb_mode", String(p.reverb_mode));
      form.append("bpm", String(projectBpm));
      form.append("delay_division", p.delay_division);
      form.append("tone_low", String(p.tone_low));
      form.append("tone_mid", String(p.tone_mid));
      form.append("tone_high", String(p.tone_high));
      form.append("air", String(p.air));
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
            let errMsg = statusData.error || "Échec inconnu";
            if (String(errMsg).includes("3221226505") || String(errMsg).includes("0xC0000409")) {
              errMsg = "Le moteur de mix a planté (crash Windows). Réessayez avec un fichier plus court, ou vérifiez les logs backend.";
            } else if (String(errMsg).includes("Unable to allocate") || String(errMsg).includes("MiB for an array")) {
              errMsg = "Mémoire serveur insuffisante. Essayez un fichier audio plus court (ex. < 2 minutes).";
            }
            setAppModal({ type: "alert", message: "Erreur lors du mix : " + errMsg, onClose: () => {} });
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
          // Cache the ArrayBuffer for mobile re-decode (playAll creates fresh context and clears decoded buffers).
          // Must clone BEFORE decodeAudioData which detaches the original.
          abCacheRef.current.set(`mixed:${fullUrl}`, ab.slice(0));
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
          const preload = new Audio();
          preload.crossOrigin = "anonymous";
          preload.preload = "auto";
          preload.src = fullUrl;
          preload.load();
          preloadMixedRef.current.set(id, preload);
          setMixProgress((prev) => ({ ...prev, [id]: 100 }));

          // Stop existing playback without marking as user-paused (stopAll sets userPausedRef = true)
          {
            const oldNodes = Array.from(trackPlaybackRef.current.entries());
            trackPlaybackRef.current.clear();
            setIsPlaying(false);
            for (const [, nd] of oldNodes) {
              try {
                if (nd.type === "instrumental") {
                  if ("bufferNode" in nd && nd.bufferNode) { try { nd.bufferNode.onended = null; nd.bufferNode.stop(); nd.bufferNode.disconnect(); } catch (_) {} }
                  else if ("media" in nd) { nd.media.element.onended = null; nd.media.element.pause(); if (nd.media.source) nd.media.source.disconnect(); }
                } else {
                  if (nd.rawMedia) { nd.rawMedia.element.onended = null; nd.rawMedia.element.pause(); if (nd.rawMedia.source) nd.rawMedia.source.disconnect(); }
                  if (nd.rawBufferNode) { try { nd.rawBufferNode.onended = null; nd.rawBufferNode.stop(); nd.rawBufferNode.disconnect(); } catch (_) {} }
                  if (nd.rawUnlockGain) nd.rawUnlockGain.disconnect();
                  if (nd.mixedMedia) { nd.mixedMedia.element.onended = null; nd.mixedMedia.element.pause(); if (nd.mixedMedia.source) nd.mixedMedia.source.disconnect(); }
                  if (nd.mixedBufferNode) { try { nd.mixedBufferNode.onended = null; nd.mixedBufferNode.stop(); nd.mixedBufferNode.disconnect(); } catch (_) {} }
                }
              } catch (_) {}
            }
          }
          const basePlayable = tracksRef.current.filter((t) => t.rawAudioUrl);
          const patchedPlayable = basePlayable.map((t) =>
            t.id === id ? { ...t, mixedAudioUrl, playMode: "mixed" as const } : t
          );
          // After mix: store patched playable and reset cursor to 0 for both platforms.
          pendingPlayableAfterMixRef.current = patchedPlayable;
          resumeFromRef.current = 0;
          setPausedAtSeconds(0);
          setHasPausedPosition(false);
          setTimeout(clearProgress, 500);
        } catch (decodeErr) {
          if (mixFinishIntervalRef.current) {
            clearInterval(mixFinishIntervalRef.current);
            mixFinishIntervalRef.current = null;
          }
          clearProgress();
          updateTrack(id, { mixedAudioUrl, isMixing: false, playMode: "mixed" });
          if (isPlayingRef.current) {
            stopAll();
            resumeFromRef.current = null;
            setPausedAtSeconds(0);
            setHasPausedPosition(false);
          }
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
        let errMsg = formatApiError(e);
        const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
        if (raw.includes("3221226505") || raw.includes("0xC0000409")) errMsg = "Le moteur de mix a planté (crash Windows). Réessayez avec un fichier plus court, ou vérifiez les logs backend.";
        else if (raw.includes("Unable to allocate") || raw.includes("MiB for an array")) errMsg = "Mémoire serveur insuffisante. Essayez un fichier audio plus court (ex. < 2 minutes).";
        setAppModal({ type: "alert", message: "Erreur lors du mix : " + errMsg, onClose: () => {} });
      }
    },
    [tracks, updateTrack, projectBpm]
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
      if (res.status === 402) {
        setSubscriptionModalOpen(true);
        return;
      }
      if (!res.ok) throw new Error((data.detail as string) || "Render mix échoué");
      const mixUrl = (data.mixUrl as string).startsWith("http") ? data.mixUrl : `${API_BASE}${data.mixUrl}`;
      // Fetch as blob and download locally — avoids popup/new tab on all platforms
      const dlRes = await fetch(mixUrl);
      const blob = await dlRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "mix.wav";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
      setAppModal({ type: "alert", message: "Erreur : " + formatApiError(e), onClose: () => {} });
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
      if (res.status === 402) {
        setSubscriptionModalOpen(true);
        return;
      }
      if (!res.ok) throw new Error((data.detail as string) || "Masterisation échouée");
      const mixUrl = (data.mixUrl as string).startsWith("http") ? data.mixUrl : `${API_BASE}${data.mixUrl}`;
      const masterUrl = (data.masterUrl as string).startsWith("http") ? data.masterUrl : `${API_BASE}${data.masterUrl}`;
      // Decode waveforms BEFORE ending the mastering animation so everything is ready to play
      try {
        const decodeCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const [mixBufRes, masterBufRes] = await Promise.all([fetch(mixUrl), fetch(masterUrl)]);
        const [mixBuf, masterBuf] = await Promise.all([
          mixBufRes.arrayBuffer().then((b) => decodeCtx.decodeAudioData(b)),
          masterBufRes.arrayBuffer().then((b) => decodeCtx.decodeAudioData(b)),
        ]);
        masterMixBufferRef.current = mixBuf;
        masterMasterBufferRef.current = masterBuf;
        setMasterWaveforms({
          mix: { peaks: computeWaveformPeaks(mixBuf, WAVEFORM_POINTS), duration: mixBuf.duration },
          master: { peaks: computeWaveformPeaks(masterBuf, WAVEFORM_POINTS), duration: masterBuf.duration },
        });
        decodeCtx.close();
      } catch (_) {
        // Waveform decode failed — still show result, useEffect will retry
      }
      stopAll();
      setMasterResult({ mixUrl, masterUrl });
      setMasterPlaybackMode("master");
      setActivePlayer("master");
    } catch (e) {
      console.error(e);
      setAppModal({ type: "alert", message: "Erreur : " + formatApiError(e), onClose: () => {} });
    } finally {
      setIsMastering(false);
    }
  }, [buildTrackSpecsAndFiles, tracks, stopAll]);

  const startMasterPlayback = useCallback((offset?: number, mode?: "mix" | "master") => {
    const mixBuf = masterMixBufferRef.current;
    const masterBuf = masterMasterBufferRef.current;
    if (!mixBuf || !masterBuf) return;
    const isMob = isMobileRef.current;
    // On mobile: create fresh AudioContext + MediaStreamDestination (same pattern as playAll)
    if (isMob) {
      if (outputElRef.current) {
        try { outputElRef.current.pause(); outputElRef.current.srcObject = null; } catch (_) {}
        outputElRef.current = null;
      }
      streamDestRef.current = null;
      const oldCtx = contextRef.current;
      if (oldCtx && oldCtx.state !== "closed") { try { oldCtx.close(); } catch (_) {} }
      const freshCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      contextRef.current = freshCtx;
      try {
        const dest = freshCtx.createMediaStreamDestination();
        streamDestRef.current = dest;
        const outputEl = new Audio();
        outputEl.srcObject = dest.stream;
        outputEl.play().catch(() => {});
        outputElRef.current = outputEl;
      } catch (_) {}
    }
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
    // On mobile: route through MediaStreamDestination → HTMLAudioElement (same as track playback)
    const audioOutput = streamDestRef.current ?? ctx.destination;
    mixGain.connect(audioOutput);
    masterGain.connect(audioOutput);
    const isMaster = mode !== undefined ? mode === "master" : masterPlaybackMode === "master";
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
    // Pause the iOS output element
    if (outputElRef.current) {
      try { outputElRef.current.pause(); } catch (_) {}
    }
    setIsMasterResultPlaying(false);
  }, []);

  // Espace = play/pause du dernier player cliqué (mix ou master).
  // Si aucun master n'existe, Space contrôle toujours le mix.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = document.activeElement as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement | null;
      const isTypingField =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" &&
            INPUT_TYPES_FOR_TYPING.includes((target as HTMLInputElement).type)));
      if (isTypingField) return;
      e.preventDefault();
      e.stopPropagation();
      (document.activeElement as HTMLElement)?.blur();
      if (activePlayer === "master" && masterResult) {
        if (isMasterResultPlaying) stopMasterPlayback();
        else startMasterPlayback();
        return;
      }
      if (isPlaying) stopAll();
      else playAll();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isPlaying, playAll, stopAll, masterResult, isMasterResultPlaying, startMasterPlayback, stopMasterPlayback, activePlayer]);

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
    <main className="relative z-10 min-h-screen font-heading">
      {appModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md" aria-modal="true" role="dialog">
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-black/20 max-w-sm w-full overflow-hidden">
            {appModal.type === "prompt" && (
              <>
                <div className="p-4 border-b border-white/10">
                  <p className="text-tagline text-slate-400 text-center text-sm tracking-wide">{appModal.title}</p>
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
                    className="flex-1 py-3 text-tagline text-slate-400 hover:bg-white/5 transition-colors text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => { appModal.onConfirm(promptInputValue); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-400 hover:bg-white/5 transition-colors text-sm border-l border-white/10"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
            {appModal.type === "confirm" && (
              <>
                <div className="p-4">
                  <p className="text-tagline text-slate-400 text-center text-sm tracking-wide">{appModal.message}</p>
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { appModal.onCancel(); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-400 hover:bg-white/5 transition-colors text-sm"
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    onClick={() => { appModal.onConfirm(); setAppModal(null); }}
                    className="flex-1 py-3 text-tagline text-slate-400 hover:bg-white/5 transition-colors text-sm border-l border-white/10"
                  >
                    Oui
                  </button>
                </div>
              </>
            )}
            {appModal.type === "alert" && (
              <>
                <div className="p-4">
                  <p className="text-tagline text-slate-400 text-center text-sm tracking-wide">{appModal.message}</p>
                </div>
                <div className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { appModal.onClose(); setAppModal(null); }}
                    className="w-full py-3 text-tagline text-slate-400 hover:bg-white/5 transition-colors text-sm"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {categoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md" aria-modal="true" role="dialog" aria-labelledby="category-modal-title">
          <div className="rounded-2xl border border-white/15 backdrop-blur-xl shadow-xl shadow-black/20 p-6 w-full max-w-sm overflow-hidden" style={{ backgroundColor: "rgba(15, 23, 42, 0.4)" }}>
            <div className="pb-4 border-b border-white/10">
              <p id="category-modal-title" className="font-heading text-tagline text-slate-400 text-center text-sm tracking-wide">
                Quelle catégorie pour cette piste ?
              </p>
              <p className="mt-1.5 text-center text-white text-xs font-medium truncate px-2" title={categoryModal.file.name}>
                {categoryModal.file.name}
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => applyCategoryChoice("lead_vocal")}
                className="group w-full py-3 rounded-xl border border-white/10 hover:bg-white/10 text-tagline text-slate-300 text-sm font-medium transition-all duration-200"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <span className="group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] group-hover:text-white transition-all duration-200">Lead vocal</span>
              </button>
              <button
                type="button"
                onClick={() => applyCategoryChoice("adlibs_backs")}
                className="group w-full py-3 rounded-xl border border-white/10 hover:bg-white/10 text-tagline text-slate-300 text-sm font-medium transition-all duration-200"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <span className="group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] group-hover:text-white transition-all duration-200">Adlibs / Backs</span>
              </button>
              <button
                type="button"
                onClick={() => applyCategoryChoice("instrumental")}
                className="group w-full py-3 rounded-xl border border-white/10 hover:bg-white/10 text-tagline text-slate-300 text-sm font-medium transition-all duration-200"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <span className="group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] group-hover:text-white transition-all duration-200">Instrumentale</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-10 max-lg:py-8 max-md:px-3 max-md:py-6">
        <header className="text-center mb-10 md:mb-12 max-lg:mb-8 max-md:mb-6">
          <nav className="max-lg:hidden flex flex-col items-center justify-center gap-2 mb-4 font-heading text-slate-400 tracking-[0.2em] uppercase text-sm sm:text-base max-md:gap-1.5 max-md:mb-3 max-md:text-xs">
            {user ? (
              <>
                <div className="flex flex-nowrap justify-center items-center gap-2">
                  <span className="whitespace-nowrap shrink-0" title={user.email}>{user.email}</span>
                  <span className="text-slate-400 shrink-0">|</span>
                  {!isPro && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSubscriptionModalOpen(true)}
                        className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        PASSER EN PRO
                      </button>
                      <span className="text-slate-400 shrink-0">|</span>
                    </>
                  )}
                  {isPro && (
                    <>
                      <button
                        type="button"
                        onClick={() => setManageSubscriptionModalOpen(true)}
                        className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        GÉRER MON ABONNEMENT
                      </button>
                      <span className="text-slate-400 shrink-0">|</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("saas_mix_token");
                      localStorage.removeItem("saas_mix_user");
                      setUser(null);
                    }}
                    className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    DÉCONNEXION
                  </button>
                </div>
                <div className="flex flex-nowrap justify-center items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowProjectsModal(true); fetchProjectsList(); }}
                    className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    MES PROJETS
                  </button>
                  <span className="text-slate-400 shrink-0">|</span>
                  <button
                    type="button"
                    disabled={isSavingProject}
                    onClick={createNewProject}
                  className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  title="Créer un nouveau projet et l’enregistrer dans Mes projets"
                >
                  CRÉER UN PROJET
                </button>
                <span className="text-slate-400 shrink-0">|</span>
                <div className="relative flex flex-col items-center">
                  <button
                    type="button"
                    disabled={isSavingProject}
                    onClick={saveProject}
                    className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {isSavingProject ? <span className="animate-dots">SAUVEGARDE</span> : "SAUVEGARDER"}
                  </button>
                  {user && currentProject && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-slate-400 text-xs whitespace-nowrap" title={currentProject.name}>
                      {currentProject.name}
                    </span>
                  )}
                </div>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setAuthMode("login"); setShowLoginModal(true); }} className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0">
                  CONNEXION
                </button>
                <span className="text-slate-400 shrink-0">|</span>
                <button type="button" onClick={() => { setAuthMode("register"); setShowLoginModal(true); }} className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0">
                  INSCRIPTION
                </button>
                <span className="text-slate-400 shrink-0">|</span>
                <button type="button" onClick={() => { setAuthMode("login"); setShowLoginModal(true); }} className="text-slate-400 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors cursor-pointer whitespace-nowrap shrink-0" title="Connectez-vous pour accéder à l’abonnement Pro">
                  PASSER EN PRO
                </button>
              </>
            )}
          </nav>

          {/* Menu burger mobile / tablette uniquement */}
          <div className="lg:hidden flex flex-col items-center mb-4 relative">
            <button
              type="button"
              onClick={() => setNavMenuOpen((o) => !o)}
              className="text-tagline text-slate-400 tracking-[0.2em] uppercase text-xs sm:text-sm max-md:text-[10px] p-2 -m-2 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors"
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
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[200px] py-2 rounded-lg bg-[#0f0f0f] border border-white/10 shadow-xl text-tagline text-slate-400 tracking-[0.2em] uppercase text-xs sm:text-sm max-md:text-[10px] text-center">
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
                        {isSavingProject ? <span className="animate-dots">SAUVEGARDE</span> : "SAUVEGARDER"}
                      </button>
                      {user && currentProject && (
                        <p className="px-4 py-1.5 text-xs text-slate-400 truncate max-w-[220px] mx-auto" title={currentProject.name}>
                          {currentProject.name}
                        </p>
                      )}
                      <p className="px-4 py-2 text-xs text-slate-400 truncate max-w-[220px] mx-auto" title={user.email}>
                        {user.email}
                      </p>
                      {user && !isPro && (
                        <button
                          type="button"
                          onClick={() => { setNavMenuOpen(false); setSubscriptionModalOpen(true); }}
                          className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors border-t border-white/10"
                        >
                          PASSER EN PRO
                        </button>
                      )}
                      {user && isPro && (
                        <button
                          type="button"
                          onClick={() => { setNavMenuOpen(false); setManageSubscriptionModalOpen(true); }}
                          className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors border-t border-white/10"
                        >
                          GÉRER MON ABONNEMENT
                        </button>
                      )}
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
                      <button type="button" onClick={() => { setNavMenuOpen(false); setAuthMode("login"); setShowLoginModal(true); }} className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                        CONNEXION
                      </button>
                      <button type="button" onClick={() => { setNavMenuOpen(false); setAuthMode("register"); setShowLoginModal(true); }} className="block w-full text-center px-4 py-2.5 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                        INSCRIPTION
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

        </header>

        <div className="mt-8 max-lg:mt-6 max-md:mt-4 rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
        {showProjectsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md" aria-modal="true" role="dialog">
            <div className="rounded-2xl border border-white/15 bg-slate-900/70 backdrop-blur-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-xl shadow-black/20">
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
                  <p className="text-slate-400 text-sm">Aucun projet sauvegardé.</p>
                )}
                {projectsList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white truncate">{p.name}</p>
                      {p.created_at && (
                        <p className="text-slate-400 text-xs mt-0.5">
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
                        {isLoadingProject ? <span className="animate-dots">Chargement</span> : "Charger"}
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

        <section className={`${tracks.length > 0 ? "pt-4 max-lg:pt-3 max-md:pt-2" : "pt-6 max-lg:pt-5 max-md:pt-4"} px-4 max-lg:px-3 max-md:px-3`} aria-label="Pistes">
          <div className="space-y-4 max-lg:space-y-3 max-md:space-y-2.5">
          {tracks.length === 0 && (
            <>
              <input
                ref={mixDropzoneInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aac"
                multiple
                className="sr-only"
                aria-hidden
                onChange={(e) => {
                  const fileList = e.target.files;
                  if (!fileList?.length) return;
                  const files = Array.from(fileList).filter((f) => f.type.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f.name));
                  if (files.length === 0) return;
                  e.target.value = "";
                  setCategoryModal({ file: files[0], nextFiles: files.slice(1) });
                }}
              />
              <button
                type="button"
                onClick={() => mixDropzoneInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMixDropzoneDragging(false);
                  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f.name));
                  if (files.length === 0) return;
                  setCategoryModal({ file: files[0], nextFiles: files.slice(1) });
                }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setMixDropzoneDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setMixDropzoneDragging(false); }}
                className={`font-sans uppercase flex min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center shadow-xl shadow-black/20 backdrop-blur-2xl transition-all duration-200 sm:min-h-[240px] ${
                  mixDropzoneDragging ? "border-white/25 bg-white/[0.08]" : "hover:border-white/15 hover:bg-white/[0.06]"
                }`}
              >
                <span className="font-heading text-base font-medium text-white sm:text-lg">
                  {mixDropzoneDragging ? "Déposez les fichiers" : "Glissez vos pistes ici"}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1={12} y1={3} x2={12} y2={15} />
                  </svg>
                </span>
                <span className="text-sm text-slate-400">ou cliquez pour choisir un ou plusieurs fichiers</span>
              </button>
            </>
          )}
          {tracks.map((track) => (
            <div key={track.id} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 relative max-lg:p-4 transition-colors hover:border-white/15">
              <button
                type="button"
                onClick={() => removeTrack(track.id)}
                className="absolute top-4 right-4 p-2 rounded text-slate-400 hover:bg-white/5 hover:text-slate-400 transition-colors z-10 max-lg:top-0.5 max-lg:right-2 max-lg:p-1.5"
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
                        aria-label="Choisir un fichier WAV"
                      >
                        <span className={`inline-flex items-center justify-center ${!track.file ? "glow-blink-slow transition-colors" : "text-slate-400 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors"}`} aria-hidden>
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </span>
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
                        value={track.gain ?? 100}
                        onInput={(e) => {
                          const v = Math.max(0, Math.min(200, Number((e.target as HTMLInputElement).value) || 0));
                          applyGainToNodes(track.id, v, track.playMode, Boolean(track.mixedAudioUrl));
                        }}
                        onChange={(e) =>
                          updateTrack(track.id, {
                            gain: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-full h-1.5 rounded appearance-none bg-white/10 accent-slate-400"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center min-h-[32px] min-w-0">
                      <span className={`text-tagline text-center whitespace-nowrap block min-w-0 ${fileChooserActiveTrackId === track.id ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : ""}`}>
                        Fichier WAV
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
                        aria-label="Choisir un fichier WAV"
                      >
                        <span className={`inline-flex items-center justify-center ${!track.file ? "glow-blink-slow transition-colors" : "text-slate-400 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors"}`} aria-hidden>
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </span>
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
                        <p className="absolute left-1/2 top-full z-10 -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-400 text-center text-xs leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
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
                        <span className="text-slate-400 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
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
                        <span className="text-slate-400">/</span>
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
                        value={track.gain ?? 100}
                        onInput={(e) => {
                          const v = Math.max(0, Math.min(200, Number((e.target as HTMLInputElement).value) || 0));
                          applyGainToNodes(track.id, v, track.playMode, Boolean(track.mixedAudioUrl));
                        }}
                        onChange={(e) =>
                          updateTrack(track.id, {
                            gain: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
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
                        <span className="text-tagline text-slate-400 text-xs block mb-1 max-md:text-[10px]">Fichier WAV</span>
                        <label
                          htmlFor={`file-mob-${track.id}`}
                          className="block w-full py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline cursor-pointer hover:bg-white/10 transition-colors text-center text-sm max-md:text-xs"
                          aria-label={!track.file ? "Choisir un fichier WAV" : "Changer le fichier"}
                        >
                          <span className={`inline-flex items-center justify-center ${!track.file ? "glow-blink-slow" : "text-slate-400"}`} aria-hidden>
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </span>
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
                        <span className="text-tagline text-slate-400 text-xs block mb-1 max-md:text-[10px]">Catégorie</span>
                        <CustomSelect
                          value={track.category}
                          onChange={(v) => {
                            const c = v as Category;
                            updateTrack(track.id, { category: c, mixParams: { ...track.mixParams, phone_fx: c === "adlibs_backs" } });
                          }}
                          onFocus={() => setFocusedCategoryTrackId(track.id)}
                          onBlur={() => setFocusedCategoryTrackId(null)}
                          variant="category"
                          className="w-full text-sm max-md:text-xs"
                          options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
                        />
                      </div>
                      <div>
                        <span className="text-tagline text-slate-400 text-xs block mb-1 max-md:text-[10px]">Gain {track.gain}%</span>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={track.gain ?? 100}
                          onInput={(e) => {
                            const v = Math.max(0, Math.min(200, Number((e.target as HTMLInputElement).value) || 0));
                            applyGainToNodes(track.id, v, track.playMode, Boolean(track.mixedAudioUrl));
                          }}
                          onChange={(e) =>
                            updateTrack(track.id, {
                              gain: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-full h-1.5 rounded appearance-none bg-white/10 accent-slate-400 max-md:h-1.5"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor={`file-mob-${track.id}`}
                          className="block w-full py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline cursor-pointer hover:bg-white/10 transition-colors text-center text-sm max-md:text-xs"
                          aria-label={!track.file ? "Choisir un fichier WAV" : "Changer le fichier"}
                        >
                          <span className={`inline-flex items-center justify-center ${!track.file ? "glow-blink-slow" : "text-slate-400"}`} aria-hidden>
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </span>
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
                          className={`py-2.5 rounded-lg border text-tagline text-sm max-md:text-xs ${
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
                          className="py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline text-sm max-md:text-xs hover:bg-white/10"
                        >
                          <span className={track.paramsOpen ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}>{track.paramsOpen ? "Masquer" : "Réglages"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => track.mixedAudioUrl && togglePlayMode(track.id, track.playMode === "raw" ? "mixed" : "raw")}
                          disabled={!track.mixedAudioUrl}
                          className="py-2.5 rounded-lg border border-white/10 bg-white/5 text-tagline text-sm max-md:text-xs hover:bg-white/10 disabled:opacity-50 col-span-2 flex items-center justify-center gap-1"
                        >
                          <span className={track.mixedAudioUrl && track.playMode === "raw" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-slate-400"}>AVANT</span>
                          <span className="text-slate-400">/</span>
                          <span className={track.mixedAudioUrl && track.playMode === "mixed" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-slate-400"}>APRÈS</span>
                        </button>
                      </div>
                      <div>
                        <span className="text-tagline text-slate-400 text-xs block mb-1 max-md:text-[10px]">Catégorie</span>
                        <CustomSelect
                          value={track.category}
                          onChange={(v) => {
                            const c = v as Category;
                            updateTrack(track.id, { category: c, mixParams: { ...track.mixParams, phone_fx: c === "adlibs_backs" } });
                          }}
                          onFocus={() => setFocusedCategoryTrackId(track.id)}
                          onBlur={() => setFocusedCategoryTrackId(null)}
                          variant="category"
                          className="w-full text-sm max-md:text-xs"
                          options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
                        />
                      </div>
                      <div>
                        <span className="text-tagline text-slate-400 text-xs block mb-1 max-md:text-[10px]">Gain {track.gain}%</span>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={track.gain ?? 100}
                          onInput={(e) => {
                            const v = Math.max(0, Math.min(200, Number((e.target as HTMLInputElement).value) || 0));
                            applyGainToNodes(track.id, v, track.playMode, Boolean(track.mixedAudioUrl));
                          }}
                          onChange={(e) => updateTrack(track.id, { gain: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })}
                          className="w-full h-1.5 rounded appearance-none bg-white/10 accent-slate-400 max-md:h-1.5"
                        />
                      </div>
                    </>
                  )}
                </div>
                {noFileMessageTrackId === track.id && (
                  <p className="text-tagline text-slate-400 text-sm max-md:text-xs text-center">Choisir un fichier pour mixer.</p>
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
                    <p className="absolute top-[0.15rem] left-0 right-0 text-tagline text-slate-400 text-[10px] max-md:text-[9px] text-center truncate w-full pointer-events-none" title={track.file?.name ?? track.rawFileName ?? ""}>
                      {track.file?.name ?? track.rawFileName ?? ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Paramètres mix desktop : L1 Basses/Mids/Aigus, L2 Reverb/Delay/De-esser, L3 col1 Doubler+FX robot | col2 BPM (taille Delay) | col3 FX tel+Air — mobile inchangé */}
              {track.paramsOpen && isVocal(track.category) && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col gap-4 max-lg:hidden">
                  {/* Ligne 1 : Basses, Mids, Aigus — libellés en glow+blanc quand la box réglages est ouverte */}
                  <div className="grid grid-cols-3 gap-4 min-h-[3rem] items-end">
                    <div className="flex flex-col min-w-0">
                      <span className="text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)] block mb-1.5 text-center text-xs uppercase tracking-wider">Basses</span>
                      <CustomSelect value={track.mixParams.tone_low} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_low: Number(v) as 1 | 2 | 3 } })} className="w-full" options={[{ value: 1, label: "Réduction" }, { value: 2, label: "Par Défaut" }, { value: 3, label: "Boost" }]} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)] block mb-1.5 text-center text-xs uppercase tracking-wider">Mids</span>
                      <CustomSelect value={track.mixParams.tone_mid} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_mid: Number(v) as 1 | 2 | 3 } })} className="w-full" options={[{ value: 1, label: "Réduction" }, { value: 2, label: "Par Défaut" }, { value: 3, label: "Boost" }]} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-tagline text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)] block mb-1.5 text-center text-xs uppercase tracking-wider">Aigus</span>
                      <CustomSelect value={track.mixParams.tone_high} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_high: Number(v) as 1 | 2 | 3 } })} className="w-full" options={[{ value: 1, label: "Réduction" }, { value: 2, label: "Par Défaut" }, { value: 3, label: "Boost" }]} />
                    </div>
                  </div>
                  {/* Ligne 2 : Reverb, Delay, De-esser */}
                  <div className="grid grid-cols-3 gap-4 min-h-[3rem] items-end">
                    <div className="flex flex-col min-w-0">
                      <label className="flex items-center justify-center gap-2 mb-1.5">
                        <input type="checkbox" checked={track.mixParams.reverb} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, reverb: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                        <span className={`text-tagline text-xs uppercase tracking-wider ${track.mixParams.reverb ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>Reverb</span>
                      </label>
                      <CustomSelect value={track.mixParams.reverb_mode} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, reverb_mode: Number(v) as 1 | 2 | 3 } })} className="w-full" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <label className="flex items-center justify-center gap-2 mb-1.5">
                        <input type="checkbox" checked={track.mixParams.delay} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                        <span className={`text-tagline text-xs uppercase tracking-wider ${track.mixParams.delay ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>Delay</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <CustomSelect value={track.mixParams.delay_division} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay_division: v as "1/4" | "1/2" | "1/8" } })} className="w-full" options={[{ value: "1/4", label: "1/4" }, { value: "1/2", label: "1/2" }, { value: "1/8", label: "1/8" }]} />
                        <CustomSelect value={track.mixParams.delay_intensity} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay_intensity: Number(v) as 1 | 2 | 3 } })} className="w-full" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <label className="flex items-center justify-center gap-2 mb-1.5">
                        <input type="checkbox" checked={track.mixParams.deesser} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, deesser: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                        <span className={`text-tagline text-xs uppercase tracking-wider ${track.mixParams.deesser ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>De-esser</span>
                      </label>
                      <CustomSelect value={track.mixParams.deesser_mode} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, deesser_mode: Number(v) as 1 | 2 | 3 } })} className="w-full" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                    </div>
                  </div>
                  {/* Ligne 3 : Doubler | FX robot | FX téléphone | Air — glow identique à L2 (sur le span texte) */}
                  <div className="grid grid-cols-4 gap-4 min-h-[3rem] items-end">
                    <label className="flex flex-col items-center justify-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={track.mixParams.doubler ?? false} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, doubler: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                      <span className={`text-tagline text-xs uppercase tracking-wider text-center ${track.mixParams.doubler ?? false ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>Doubler</span>
                    </label>
                    <label className="flex flex-col items-center justify-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={track.mixParams.robot ?? false} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, robot: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                      <span className={`text-tagline text-xs uppercase tracking-wider text-center ${track.mixParams.robot ?? false ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>FX robot</span>
                    </label>
                    <label className="flex flex-col items-center justify-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={track.mixParams.phone_fx} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, phone_fx: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                      <span className={`text-tagline text-xs uppercase tracking-wider text-center ${track.mixParams.phone_fx ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>FX téléphone</span>
                    </label>
                    <label className="flex flex-col items-center justify-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={track.mixParams.air} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, air: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5" />
                      <span className={`text-tagline text-xs uppercase tracking-wider text-center ${track.mixParams.air ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>Air</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Réglages mobile / tablette : vocal uniquement. PC non touché. */}
              {track.paramsOpen && isVocal(track.category) && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] lg:hidden flex flex-col gap-2">
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <span className="text-tagline text-sm max-md:text-xs text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]">Basses</span>
                        <CustomSelect value={track.mixParams.tone_low} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_low: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: 1, label: "Réduction" }, { value: 2, label: "Par Défaut" }, { value: 3, label: "Boost" }]} />
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <span className="text-tagline text-sm max-md:text-xs text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]">Mids</span>
                        <CustomSelect value={track.mixParams.tone_mid} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_mid: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: 1, label: "Réduction" }, { value: 2, label: "Par Défaut" }, { value: 3, label: "Boost" }]} />
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <span className="text-tagline text-sm max-md:text-xs text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]">Aigus</span>
                        <CustomSelect value={track.mixParams.tone_high} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, tone_high: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: 1, label: "Réduction" }, { value: 2, label: "Par Défaut" }, { value: 3, label: "Boost" }]} />
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <label className={`flex items-center gap-1.5 text-tagline text-sm max-md:text-xs ${track.mixParams.deesser ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.deesser} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, deesser: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          De-esser
                        </label>
                        <CustomSelect value={track.mixParams.deesser_mode} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, deesser_mode: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <label className={`flex items-center gap-1.5 text-tagline text-sm max-md:text-xs ${track.mixParams.reverb ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.reverb} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, reverb: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          Reverb
                        </label>
                        <CustomSelect value={track.mixParams.reverb_mode} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, reverb_mode: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                      </div>
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center min-h-[2.25rem] min-w-0">
                        <label className={`flex items-center gap-1.5 text-tagline text-sm max-md:text-xs ${track.mixParams.delay ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.delay} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          Delay
                        </label>
                        <div className="grid grid-cols-2 gap-1 min-w-0">
                          <CustomSelect value={track.mixParams.delay_division} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay_division: v as "1/4" | "1/2" | "1/8" } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: "1/4", label: "1/4" }, { value: "1/2", label: "1/2" }, { value: "1/8", label: "1/8" }]} />
                          <CustomSelect value={track.mixParams.delay_intensity} onChange={(v) => updateTrack(track.id, { mixParams: { ...track.mixParams, delay_intensity: Number(v) as 1 | 2 | 3 } })} className="w-full min-w-0 h-9 text-sm max-md:text-xs" options={[{ value: 1, label: "Léger" }, { value: 2, label: "Moyen" }, { value: 3, label: "Fort" }]} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between min-h-[2.25rem] px-0 text-tagline text-sm max-md:text-xs">
                        <label className={`flex items-center gap-1.5 shrink-0 ${track.mixParams.phone_fx ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.phone_fx} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, phone_fx: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          FX téléphone
                        </label>
                        <label className={`flex items-center gap-1.5 shrink-0 w-[5.5rem] ${track.mixParams.robot ?? false ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.robot ?? false} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, robot: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          <span>FX robot</span>
                        </label>
                      </div>
                      <div className="flex items-center justify-between min-h-[2.25rem] px-0 text-tagline text-sm max-md:text-xs">
                        <label className={`flex items-center gap-1.5 shrink-0 ${track.mixParams.air ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.air} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, air: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          Air
                        </label>
                        <label className={`flex items-center gap-1.5 shrink-0 w-[5.5rem] ${track.mixParams.doubler ?? false ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]" : "text-slate-400"}`}>
                          <input type="checkbox" checked={track.mixParams.doubler ?? false} onChange={(e) => updateTrack(track.id, { mixParams: { ...track.mixParams, doubler: e.target.checked } })} className="checkbox-reglages rounded border border-white/10 bg-white/5 shrink-0" />
                          <span>Doubler</span>
                        </label>
                      </div>
                </div>
              )}

            </div>
          ))}
          </div>

          {tracks.length >= 1 && (
            <div className="mt-4 max-lg:mt-3 max-md:mt-2.5">
              <input
                ref={addTrackDropzoneInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aac"
                multiple
                className="sr-only"
                aria-hidden
                onChange={(e) => {
                  const fileList = e.target.files;
                  if (!fileList?.length) return;
                  const files = Array.from(fileList).filter((f) => f.type.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f.name));
                  if (files.length === 0) return;
                  e.target.value = "";
                  setCategoryModal({ file: files[0], nextFiles: files.slice(1) });
                }}
              />
              <button
                type="button"
                onClick={() => addTrackDropzoneInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAddTrackDropzoneDragging(false);
                  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f.name));
                  if (files.length === 0) return;
                  setCategoryModal({ file: files[0], nextFiles: files.slice(1) });
                }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAddTrackDropzoneDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setAddTrackDropzoneDragging(false); }}
                className={`group w-full max-w-2xl mx-auto rounded-xl border backdrop-blur-sm py-5 max-lg:py-4 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 focus:outline-none focus:ring-0 ${
                  addTrackDropzoneDragging ? "border-white/25 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
                }`}
                aria-label="Glisser-déposer ou choisir des pistes"
              >
                <span className="font-heading text-sm uppercase tracking-[0.2em] text-slate-400 group-hover:text-white transition-colors">
                  {addTrackDropzoneDragging ? "Déposez les fichiers" : "Glissez vos pistes ici"}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1={12} y1={3} x2={12} y2={15} />
                  </svg>
                </span>
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">ou cliquez pour choisir un ou plusieurs fichiers</span>
              </button>
            </div>
          )}
        </section>

        {showPlayNoFileMessage && (
          <div className="fixed left-1/2 top-24 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-lg bg-[#0a0a0a]/98 border border-white/20 shadow-xl shadow-black/50 text-tagline text-slate-400 text-sm text-center whitespace-nowrap">
            Veuillez d&apos;abord sélectionner un fichier pour chaque piste
          </div>
        )}

        <div className={`grid gap-3 px-4 py-4 max-lg:px-3 max-lg:py-3 w-full max-w-6xl mx-auto ${tracks.length > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1"}`}>
            <div className="flex items-center justify-center">
            {tracks.length > 0 ? (
              !isPlaying ? (
                <button
                  type="button"
                  onClick={() => { setActivePlayer("mix"); playAll(); }}
                  className="w-12 h-12 max-md:w-11 max-md:h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0"
                  aria-label={hasPausedPosition ? "Reprendre" : "Lancer la lecture"}
                  title={hasPausedPosition ? "Reprendre" : "Lancer la lecture"}
                >
                  <svg className="w-5 h-5 max-md:w-4 max-md:h-4 shrink-0" fill="currentColor" viewBox="-0.333 0 24 24" aria-hidden><path d="M8 5v14l11-7L8 5z"/></svg>
                </button>
              ) : (
                <button type="button" onClick={() => { setActivePlayer("mix"); stopAll(); }} className="w-12 h-12 max-md:w-11 max-md:h-11 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors shrink-0" aria-label="Pause" title="Pause">
                  <svg className="w-5 h-5 max-md:w-4 max-md:h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
              )
            ) : (
              <div className="w-12 h-12 max-md:w-11 max-md:h-11 shrink-0" />
            )}
            </div>

            {tracks.length > 0 && (
            <div className="flex items-center justify-center">
            <div
              ref={bpmBoxRef}
              className="h-10 max-md:h-9 rounded-lg px-4 flex flex-row items-center justify-center gap-2 border border-white/10 bg-white/5 select-none overflow-visible shrink-0 min-w-[7.5rem] text-tagline text-xs max-md:text-[10px]"
              title="Molette (desktop) ou toucher la valeur (mobile) pour saisir le BPM (1–300)"
            >
              <span className="uppercase tracking-wider text-slate-400">BPM</span>
              <div className="relative inline-flex items-center justify-center min-w-[2rem] h-full cursor-text" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
                <span className="tabular-nums text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)] pointer-events-none">
                  {bpmInput}
                </span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={bpmInput}
                  onChange={(e) => setBpmInput(e.target.value)}
                  onBlur={() => {
                    const n = Number(bpmInput);
                    if (!bpmInput || isNaN(n) || n < 1) {
                      setProjectBpm(120);
                      setBpmInput("120");
                    } else {
                      const clamped = Math.max(1, Math.min(300, Math.round(n)));
                      setProjectBpm(clamped);
                      setBpmInput(String(clamped));
                    }
                  }}
                  className="absolute inset-0 w-full opacity-0 text-center bg-transparent border-none text-tagline text-xs max-md:text-[10px] tabular-nums text-white focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                  aria-label="BPM"
                />
              </div>
            </div>
            </div>
            )}

            {tracks.length > 0 && (
              <>
                <div className="relative shrink-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) { setShowLoginMixMessage(true); setTimeout(() => setShowLoginMixMessage(false), 4000); return; }
                      downloadMix();
                    }}
                    disabled={isRenderingMix}
                    className={`h-10 max-md:h-9 rounded-lg px-4 flex items-center justify-center text-center text-tagline text-xs max-md:text-[10px] disabled:cursor-not-allowed whitespace-nowrap ${
                      isRenderingMix
                        ? "border border-white/30 bg-slate-800 text-white"
                        : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors disabled:opacity-50"
                    }`}
                  >
                    {isRenderingMix ? (
                      <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                        RENDU<span className="inline-block animate-mix-dot [animation-delay:0ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:200ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:400ms]">.</span>
                      </span>
                    ) : (
                      "TÉLÉCHARGER LE MIX"
                    )}
                  </button>
                  {showLoginMixMessage && !user && (
                    <p className="absolute left-1/2 top-full z-[60] -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-400 text-center text-xs leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                      Connectez-vous pour télécharger le mix.
                    </p>
                  )}
                </div>
                <div className="relative shrink-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) { setShowLoginMasterMessage(true); setTimeout(() => setShowLoginMasterMessage(false), 4000); return; }
                      runMaster();
                    }}
                    disabled={isMastering}
                    className={`h-10 max-md:h-9 rounded-lg px-4 flex items-center justify-center text-center text-tagline text-xs max-md:text-[10px] disabled:cursor-not-allowed whitespace-nowrap min-w-[7.5rem] ${
                      isMastering
                        ? "border border-white/30 bg-slate-800 text-white"
                        : "border border-white/20 bg-white text-[#060608] hover:bg-white/90 disabled:opacity-50"
                    }`}
                  >
                    {isMastering ? (
                      <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                        MASTERING<span className="inline-block animate-mix-dot [animation-delay:0ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:200ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:400ms]">.</span>
                      </span>
                    ) : "MASTERISER"}
                  </button>
                  {showLoginMasterMessage && !user && (
                    <p className="absolute left-1/2 top-full z-[60] -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-400 text-center text-xs leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                      Connectez-vous pour masteriser.
                    </p>
                  )}
                  {user && showMasterMessage && (
                    <p className="absolute left-1/2 top-full z-[60] -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-400 text-center text-xs leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg">
                      Veuillez d&apos;abord effectuer un mix
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {masterResult && (
          <section ref={masterResultSectionRef} className="mt-10 max-w-xl mx-auto" aria-label="Résultat du master">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm shadow-lg shadow-black/20 p-6 flex flex-col items-center text-center">
              <h2 className="text-tagline text-slate-400 mb-4">Résultat du master</h2>
              <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
                {!isMasterResultPlaying ? (
                  <button
                    type="button"
                    onClick={() => { setActivePlayer("master"); startMasterPlayback(); }}
                    disabled={!masterWaveforms}
                    className="btn-primary-accent disabled:opacity-50 w-11 h-11 flex items-center justify-center rounded-lg"
                    aria-label={masterResumeFrom > 0 ? "Reprendre" : "Play"}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7L8 5z"/></svg>
                  </button>
                ) : (
                  <button type="button" onClick={() => { setActivePlayer("master"); stopMasterPlayback(); }} className="btn-primary w-11 h-11 flex items-center justify-center rounded-lg" aria-label="Pause">
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
                  <span className="text-slate-400">/</span>
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
                <button
                  type="button"
                  disabled={isDownloadingMaster}
                  onClick={async () => {
                    setIsDownloadingMaster(true);
                    try {
                      const res = await fetch(masterResult.masterUrl);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "master.wav";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      /* fallback : ouvre l'URL directement */
                      window.open(masterResult.masterUrl, "_blank");
                    } finally {
                      setIsDownloadingMaster(false);
                    }
                  }}
                  className={`inline-flex items-center justify-center text-center mt-2 rounded-lg px-4 py-2.5 text-tagline disabled:cursor-not-allowed ${
                    isDownloadingMaster
                      ? "border border-white/30 bg-slate-800 text-white"
                      : "btn-primary group"
                  }`}
                >
                  {isDownloadingMaster ? (
                    <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                      TÉLÉCHARGEMENT<span className="inline-block animate-mix-dot [animation-delay:0ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:200ms]">.</span><span className="inline-block animate-mix-dot [animation-delay:400ms]">.</span>
                    </span>
                  ) : (
                    <span className="text-tagline text-slate-400 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                      TÉLÉCHARGER LE MASTER
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowLoginMasterDownloadMessage(true); setTimeout(() => setShowLoginMasterDownloadMessage(false), 4000); }}
                  className="btn-primary group inline-flex items-center justify-center text-center mt-2 relative"
                >
                  <span className="text-tagline text-slate-400 group-hover:text-white group-hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">
                    TÉLÉCHARGER LE MASTER
                  </span>
                  {showLoginMasterDownloadMessage && !user && (
                    <span className="absolute left-1/2 top-full -translate-x-1/2 mt-1 px-2 py-1 rounded text-tagline text-slate-400 text-center text-xs leading-tight whitespace-nowrap bg-[#0a0a0a]/95 border border-white/10 shadow-lg z-10">
                      Connectez-vous pour télécharger le master.
                    </span>
                  )}
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      <TrustBullets />
      <HowItWorks />
      <VideoSection />
      <BeforeAfterSection />
      <FeaturesSection />
      <PricingSection />
      <FAQContactSection />

      {/* ─── Subscription Pro (modal Stripe Elements, sans quitter la page) ─── */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSuccess={() => { fetchBilling(); }}
        getAuthHeaders={getAuthHeaders}
      />
      <ManageSubscriptionModal
        isOpen={manageSubscriptionModalOpen}
        onClose={() => setManageSubscriptionModalOpen(false)}
        getAuthHeaders={getAuthHeaders}
        onSubscriptionUpdated={() => { fetchBilling(); }}
      />
      {/* ─── Auth Modal (login + register — stays on same page, preserves all audio state) ─── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4" onClick={() => { setShowLoginModal(false); setRegisterSuccess(false); }}>
          <div className="rounded-2xl border border-white/15 bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-black/20 p-6 w-full max-w-sm relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { setShowLoginModal(false); setRegisterSuccess(false); }} className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none">&times;</button>

            {authMode === "login" ? (
              <>
                <h2 className="text-xl font-medium text-white mb-1 text-center">Connexion</h2>
                <p className="text-tagline text-slate-400 text-center text-xs mb-6">Accéder à votre compte</p>
                {registerSuccess && <p className="text-center text-green-400 text-sm mb-4">Compte créé. Connectez-vous.</p>}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLoginError("");
                    setLoginLoading(true);
                    try {
                      const res = await fetch(`${API_BASE}/auth/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setLoginError(data.detail || "E-mail ou mot de passe incorrect.");
                        setLoginLoading(false);
                        return;
                      }
                      if (data.access_token && data.user) {
                        localStorage.setItem("saas_mix_token", data.access_token);
                        localStorage.setItem("saas_mix_user", JSON.stringify(data.user));
                        setUser(data.user);
                        fetchBilling();
                        setShowLoginModal(false);
                        setLoginEmail("");
                        setLoginPassword("");
                        setLoginError("");
                        setRegisterSuccess(false);
                      }
                    } catch {
                      setLoginError("Impossible de joindre le serveur.");
                    } finally {
                      setLoginLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="login-email" className="block text-tagline text-slate-400 text-xs mb-1">E-mail</label>
                    <input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                      placeholder="vous@exemple.com" />
                  </div>
                  <div>
                    <label htmlFor="login-password" className="block text-tagline text-slate-400 text-xs mb-1">Mot de passe</label>
                    <input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                      placeholder="••••••••" />
                  </div>
                  {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
                  <button type="submit" disabled={loginLoading} className="btn-primary w-full py-2.5">
                    {loginLoading ? "Connexion…" : "Se connecter"}
                  </button>
                </form>
                <p className="text-tagline text-slate-400 text-center text-xs mt-4">
                  Pas de compte ?{" "}
                  <button type="button" onClick={() => { setAuthMode("register"); setLoginError(""); }} className="text-slate-400 hover:text-white underline cursor-pointer">Inscription</button>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-medium text-white mb-1 text-center">Inscription</h2>
                <p className="text-tagline text-slate-400 text-center text-xs mb-6">Créer un compte</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLoginError("");
                    setLoginLoading(true);
                    try {
                      const res = await fetch(`${API_BASE}/auth/register`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setLoginError(data.detail || "Erreur lors de l'inscription.");
                        setLoginLoading(false);
                        return;
                      }
                      // Registration succeeded — switch to login with success message
                      setRegisterSuccess(true);
                      setAuthMode("login");
                      setLoginError("");
                    } catch {
                      setLoginError("Impossible de joindre le serveur.");
                    } finally {
                      setLoginLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="register-email" className="block text-tagline text-slate-400 text-xs mb-1">E-mail</label>
                    <input id="register-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                      placeholder="vous@exemple.com" />
                  </div>
                  <div>
                    <label htmlFor="register-password" className="block text-tagline text-slate-400 text-xs mb-1">Mot de passe (8 caractères min.)</label>
                    <input id="register-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                      placeholder="••••••••" />
                  </div>
                  {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
                  <button type="submit" disabled={loginLoading} className="btn-primary w-full py-2.5">
                    {loginLoading ? "Création…" : "Créer mon compte"}
                  </button>
                </form>
                <p className="text-tagline text-slate-400 text-center text-xs mt-4">
                  Déjà un compte ?{" "}
                  <button type="button" onClick={() => { setAuthMode("login"); setLoginError(""); }} className="text-slate-400 hover:text-white underline cursor-pointer">Connexion</button>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
