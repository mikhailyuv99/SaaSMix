"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FILES_DB_NAME = "saas_mix_files";
const FILES_STORE_NAME = "files";
const HERO_UPLOAD_ID = "hero_upload";
const HERO_UPLOAD_COUNT_KEY = "hero_upload_count";

function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILES_DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(FILES_STORE_NAME)) {
        req.result.createObjectStore(FILES_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function saveHeroUploadFiles(files: File[]): Promise<void> {
  if (typeof window === "undefined" || files.length === 0) return Promise.resolve();
  return openFilesDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE_NAME, "readwrite");
      const store = tx.objectStore(FILES_STORE_NAME);
      store.put({ id: HERO_UPLOAD_COUNT_KEY, count: files.length });
      files.forEach((file, i) => {
        store.put({ id: `${HERO_UPLOAD_ID}_${i}`, blob: file, fileName: file.name });
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
}

export function HeroSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isAudioFile = (file: File) =>
    file.type.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(file.name);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const files = Array.from(fileList).filter(isAudioFile);
      if (files.length === 0) return;
      try {
        await saveHeroUploadFiles(files);
        router.push("/mix?from=hero");
      } catch {
        router.push("/mix");
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const onClickCard = () => inputRef.current?.click();

  return (
    <section className="relative min-h-0 overflow-hidden px-4 pt-6 pb-10 sm:pt-8 sm:pb-12">
      <div className="mx-auto grid max-w-6xl items-center gap-6 sm:gap-8 lg:grid-cols-[1fr,380px] lg:gap-12">
        <div className="max-w-xl">
          <h1
            className="font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl animate-fade-up"
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}
          >
            <span className="text-white">Le site n°1</span>
            <br />
            <span className="text-white">de mix vocal en ligne</span>
          </h1>
          <p
            className="mt-4 text-lg text-slate-400 sm:text-xl animate-fade-up"
            style={{ animationDelay: "0.25s", animationFillMode: "both" }}
          >
            Transformez vos pistes brutes en un morceau fini en quelques minutes.
          </p>
          <p
            className="mt-3 text-sm text-slate-400 sm:text-base animate-fade-up"
            style={{ animationDelay: "0.3s", animationFillMode: "both" }}
          >
            Zéro ingé son, zéro plugin — tout se fait en ligne.
          </p>
          <ul
            className="mt-4 space-y-2 animate-fade-up"
            style={{ animationDelay: "0.4s", animationFillMode: "both" }}
          >
            {[
              "Mix en quelques minutes",
              "Voix qui s'intègrent à l'instrumentale",
              "Export WAV prêt à sortir",
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-400">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="animate-fade-up"
          style={{ animationDelay: "0.35s", animationFillMode: "both" }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aac"
            multiple
            onChange={onFileInputChange}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClickCard}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`hero-dropzone font-sans uppercase flex min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center shadow-xl shadow-black/20 backdrop-blur-2xl transition-all duration-200 sm:min-h-[240px] ${
              isDragging ? "border-white/25 bg-white/[0.08]" : "hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            <span className="font-heading text-base font-medium text-white sm:text-lg">
              {isDragging ? "Déposez le fichier" : "Glissez vos pistes ici"}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1={12} y1={3} x2={12} y2={15} />
              </svg>
            </span>
            <span className="text-sm text-slate-400">
              ou cliquez pour choisir un fichier
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
