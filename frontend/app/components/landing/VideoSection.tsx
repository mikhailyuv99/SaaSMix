"use client";

import { ObserveSection } from "../ObserveSection";

// TODO (vidéo explicative) : quand la vidéo YouTube est prête, ajouter dans .env.local :
//   NEXT_PUBLIC_YOUTUBE_EXPLAINER_VIDEO_ID=https://www.youtube.com/watch?v=XXX
// (ou juste l’ID : NEXT_PUBLIC_YOUTUBE_EXPLAINER_VIDEO_ID=XXX)
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
    <section className="px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-4xl">
          <div className="text-center observe-stagger-1">
            <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Tutoriel
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-white sm:text-3xl">
              Comment utiliser l’outil
            </h2>
            <p className="mt-2 text-slate-400 text-sm sm:text-base">
              Une vidéo pour tout comprendre en quelques minutes.
            </p>
          </div>

          <div className="mt-5 observe-stagger-2 sm:mt-6">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-xl shadow-black/30 aspect-video">
              {YOUTUBE_VIDEO_ID ? (
                <iframe
                  src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
                  title="Tutoriel Siberia Mix"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white/[0.03] text-slate-400">
                  <svg className="h-14 w-14 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium">Vidéo à venir</p>
                  <p className="text-xs text-slate-400">
                    Ajoutez l’ID YouTube dans <code className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">NEXT_PUBLIC_YOUTUBE_EXPLAINER_VIDEO_ID</code>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
