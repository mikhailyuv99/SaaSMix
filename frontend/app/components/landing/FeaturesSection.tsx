import { ObserveSection } from "../ObserveSection";

const features = [
  {
    title: "Mix vocal intelligent",
    desc: "Voix qui s'intègrent à l'instrumentale : vous réglez de-esser, réverb, delay et tonalité selon vos goûts, puis le moteur applique le mix.",
  },
  {
    title: "Réglages à la carte",
    desc: "Vous choisissez de-esser, réverb, delay, tonalité et les autres options avant de lancer le mix. Chaque piste peut avoir ses propres réglages.",
  },
  {
    title: "Export WAV prêt à sortir",
    desc: "Téléchargez votre mix final en haute qualité, prêt pour Spotify, Apple Music, YouTube et les distributeurs.",
  },
  {
    title: "Sans installation",
    desc: "Tout se fait dans le navigateur. Aucun logiciel à installer, aucun plugin à configurer.",
  },
  {
    title: "Aperçu illimité",
    desc: "Écoutez le résultat en pleine longueur avant de télécharger. Ajustez vos réglages et relancez le mix autant que nécessaire.",
  },
  {
    title: "Mastering inclus",
    desc: "Une fois le mix validé, lancez le mastering en un clic pour un rendu prêt à distribuer, sans passer par un autre outil.",
  },
];

export function FeaturesSection() {
  return (
    <section className="px-4 py-6 sm:py-8 max-lg:px-3 max-md:py-5">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center max-lg:max-w-none">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1 max-md:text-xs">
            Fonctionnalités
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2 max-lg:text-2xl max-md:text-xl">
            Ce que vous obtenez
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3 max-lg:text-sm max-md:text-xs">
            Un workflow simple pour des résultats pro.
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-3xl sm:mt-10 max-lg:mt-6 max-md:mt-5">
          <ul className="space-y-0">
            {features.map((f, i) => (
              <li
                key={f.title}
                className={`group flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8 py-5 sm:py-6 border-b border-white/[0.06] last:border-b-0 transition-colors hover:border-white/10 max-lg:py-4 max-md:py-3 ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : i === 2 ? "observe-stagger-3" : "observe-stagger-4"}`}
              >
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 max-lg:gap-3">
                  <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-white/40 group-hover:bg-white/70 transition-colors" aria-hidden />
                  <div className="min-w-0">
                    <h3 className="font-heading font-semibold text-white text-[15px] sm:text-base tracking-tight max-md:text-sm">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm sm:text-[15px] leading-relaxed text-slate-400 max-md:text-xs">
                      {f.desc}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </ObserveSection>
    </section>
  );
}
