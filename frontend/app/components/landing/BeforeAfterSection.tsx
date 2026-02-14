import Link from "next/link";
import { ObserveSection } from "../ObserveSection";

const demos = [
  { id: 1, title: "Hip-Hop", artist: "Démo à venir", desc: "Voix claire sur instrumentale, prête à sortir." },
  { id: 2, title: "R&B", artist: "Démo à venir", desc: "Mix chaleureux et spatial." },
  { id: 3, title: "Rap", artist: "Démo à venir", desc: "Punch et présence vocale." },
];

export function BeforeAfterSection() {
  return (
    <section className="px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1">
            Avant / Après
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            Écoutez le résultat
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Exemples mixés avec Siberia Mix (démos à venir).
          </p>
        </div>
        <div className="mx-auto mt-5 grid max-w-5xl gap-6 sm:grid-cols-3">
          {demos.map((demo, i) => (
            <div
              key={demo.id}
              className={`landing-card group p-5 sm:p-6 ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : "observe-stagger-3"}`}
            >
              <div
                className="flex h-28 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-slate-400 transition-colors group-hover:border-white/25 sm:h-32"
                style={{ animation: "pulse-soft 3s ease-in-out infinite" }}
              >
                <span className="text-xs font-medium sm:text-sm">Avant / Après</span>
              </div>
              <p className="mt-4 font-heading font-semibold text-white">{demo.title}</p>
              <p className="text-sm text-slate-400">{demo.artist}</p>
              <p className="mt-1 text-sm text-slate-400">{demo.desc}</p>
              <Link
                href="/mix"
                className="mt-4 inline-block text-sm font-medium text-white underline decoration-white/40 underline-offset-2 transition-colors hover:decoration-white"
              >
                Essayer une démo
              </Link>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-5 max-w-3xl text-center observe-stagger-4">
          <Link
            href="/mix"
            className="btn-cta-primary inline-flex rounded-xl px-6 py-3.5 text-sm font-semibold"
          >
            Mixer votre propre morceau
          </Link>
        </div>
      </ObserveSection>
    </section>
  );
}
