"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FILES_DB_NAME = "saas_mix_files";
const FILES_STORE_NAME = "files";
const HERO_UPLOAD_ID = "hero_upload";

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

function saveFileToIDB(id: string, file: File): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return openFilesDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE_NAME, "readwrite");
      const store = tx.objectStore(FILES_STORE_NAME);
      store.put({ id, blob: file, fileName: file.name });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  });
}

export function HeroSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const isAudio =
        file.type.startsWith("audio/") ||
        /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(file.name);
      if (!isAudio) return;
      try {
        await saveFileToIDB(HERO_UPLOAD_ID, file);
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
      const file = e.dataTransfer.files[0];
      handleFile(file || null);
    },
    [handleFile]
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
      const file = e.target.files?.[0];
      handleFile(file || null);
      e.target.value = "";
    },
    [handleFile]
  );

  const onClickCard = () => inputRef.current?.click();

  return (
    <section className="relative min-h-[80vh] overflow-hidden px-4 pt-6 pb-2 sm:pt-8 sm:pb-3">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr,380px] lg:gap-16">
        <div className="max-w-xl">
          <h1
            className="font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl animate-fade-up"
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}
          >
            <span className="gradient-text">Le site n°1</span>
            <br />
            <span className="text-white">de mix vocal en ligne</span>
          </h1>
          <p
            className="mt-5 text-lg text-slate-300 sm:text-xl animate-fade-up"
            style={{ animationDelay: "0.25s", animationFillMode: "both" }}
          >
            Transformez vos pistes brutes en un morceau fini en quelques minutes.
          </p>
          <p
            className="mt-3 text-sm text-slate-500 sm:text-base animate-fade-up"
            style={{ animationDelay: "0.3s", animationFillMode: "both" }}
          >
            Zéro ingé son, zéro plugin — tout se fait en ligne.
          </p>
          <ul
            className="mt-6 space-y-2 animate-fade-up"
            style={{ animationDelay: "0.4s", animationFillMode: "both" }}
          >
            {[
              "Mix en quelques minutes",
              "Voix qui s'intègrent au beat",
              "Export WAV prêt à sortir",
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-300">
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
            className={`font-sans flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center shadow-xl shadow-black/20 backdrop-blur-2xl transition-all duration-200 sm:min-h-[300px] ${
              isDragging ? "border-white/25 bg-white/[0.08]" : "hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            <span className="font-heading text-base font-medium text-white sm:text-lg">
              {isDragging ? "Déposez le fichier" : "Glissez-déposez vos pistes ici"}
            </span>
            <span className="mt-1.5 text-sm text-slate-500">
              ou cliquez pour choisir un fichier
            </span>
            <span className="mt-6 text-xs text-slate-500">
              Aperçu pleine longueur · Pas de CB · Vous gardez vos droits
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
