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
    <section className="px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1">
            Fonctionnalités
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            Ce que vous obtenez
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Un workflow simple pour des résultats pro.
          </p>
        </div>
        <div className="mx-auto mt-5 max-w-4xl sm:mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
          <table className="w-full border-collapse">
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={f.title}
                  className={`border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/[0.03] ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : i === 2 ? "observe-stagger-3" : i === 3 ? "observe-stagger-4" : i === 4 ? "observe-stagger-4" : "observe-stagger-4"}`}
                >
                  <td className="font-heading font-semibold text-white align-top py-4 pl-5 pr-4 sm:pl-6 sm:pr-5 w-[38%] min-w-[8rem] sm:w-[32%]">
                    {f.title}
                  </td>
                  <td className="text-sm leading-relaxed text-slate-400 py-4 pr-5 pl-4 sm:pr-6 sm:pl-5">
                    {f.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ObserveSection>
    </section>
  );
}
