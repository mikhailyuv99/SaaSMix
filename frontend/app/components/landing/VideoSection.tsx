"use client";

import { ObserveSection } from "../ObserveSection";

// TODO (vidéo explicative) : quand la vidéo YouTube est prête, ajouter dans .env.local :
//   NEXT_PUBLIC_YOUTUBE_EXPLAINER_VIDEO_ID=https://www.youtube.com/watch?v=XXX
// (ou juste l'ID : NEXT_PUBLIC_YOUTUBE_EXPLAINER_VIDEO_ID=XXX)
// Puis redémarrer le serveur (npm run dev).

function getYouTubeVideoId(value: string | undefined): string {
  if (!value?.trim()) return "";
  const v = value.trim();
  const match = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : v;
}

const YOUTUBE_VIDEO_ID = getYouTubeVideoId(process.env.NEXT_PUBLIC_YOUTUBE_EXPLAINER_VIDEO_ID);

export function VideoSection() {
  return (
    <section className="px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5">
      <ObserveSection>
        <div className="mx-auto max-w-4xl max-lg:max-w-none">
          <div className="text-center observe-stagger-1">
            <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 max-md:text-xs">
              Tutoriel
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-white sm:text-3xl max-lg:text-xl max-md:text-lg">
              Comment utiliser l'outil
            </h2>
            <p className="mt-2 text-slate-400 text-sm sm:text-base max-md:text-xs">
              Une vidéo pour tout comprendre en quelques minutes.
            </p>
          </div>

          <div className="mt-5 observe-stagger-2 sm:mt-6 max-lg:mt-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-xl shadow-black/30 aspect-video max-lg:rounded-xl">
              {YOUTUBE_VIDEO_ID ? (
                <iframe
                  src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
                  title="Tutoriel Siberia Mix"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-white/[0.03] text-slate-400">
                  <button
                    type="button"
                    disabled
                    className="w-12 h-12 max-md:w-11 max-md:h-11 flex items-center justify-center rounded-full bg-white/10 text-white transition-colors shrink-0 cursor-default"
                    aria-label="Tutoriel bientôt disponible"
                  >
                    <svg className="w-5 h-5 max-md:w-4 max-md:h-4 shrink-0" fill="currentColor" viewBox="-0.333 0 24 24" aria-hidden>
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  </button>
                  <p className="text-sm font-medium uppercase tracking-wide text-white/90">Tutoriel bientôt disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
