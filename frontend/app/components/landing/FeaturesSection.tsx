import { ObserveSection } from "../ObserveSection";

const features = [
  {
    title: "Mix vocal intelligent",
    desc: "Voix qui s'intègrent au beat : vous réglez de-esser, réverb, delay et tonalité selon vos goûts, puis le moteur applique le mix.",
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
];

export function FeaturesSection() {
  return (
    <section className="px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-500 observe-stagger-1">
            Fonctionnalités
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            Ce que vous obtenez
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Un workflow simple pour des résultats pro.
          </p>
        </div>
        <div className="mx-auto mt-5 grid max-w-4xl gap-6 sm:grid-cols-2 sm:mt-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`landing-card relative overflow-hidden p-6 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-gradient-to-b before:from-white/20 before:to-white/5 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : i === 2 ? "observe-stagger-3" : "observe-stagger-4"}`}
            >
              <h3 className="font-heading font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </ObserveSection>
    </section>
  );
}
