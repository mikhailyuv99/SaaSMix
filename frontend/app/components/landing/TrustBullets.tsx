import { ObserveSection } from "../ObserveSection";

const items = [
  { label: "Aperçu pleine longueur", desc: "Écoutez le résultat avant de télécharger.", icon: "▶" },
  { label: "Pas de carte bancaire", desc: "Pour commencer, rien à enregistrer.", icon: "◆" },
  { label: "Vous gardez vos droits", desc: "100 % de vos masters, toujours.", icon: "✓" },
];

export function TrustBullets() {
  return (
    <section className="px-4 pt-2 pb-4 sm:pt-3 sm:pb-5">
      <ObserveSection>
        <div className="mx-auto flex max-w-4xl flex-col gap-8 sm:flex-row sm:justify-between sm:gap-10">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-start gap-4 text-center sm:text-left group ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : "observe-stagger-3"}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-base text-slate-400 transition-all duration-300 group-hover:scale-105 group-hover:border-white/25 group-hover:bg-white/10 sm:mx-auto sm:mb-1 sm:flex">
                {item.icon}
              </span>
              <div className="flex-1">
                <p className="font-heading font-semibold text-white">{item.label}</p>
                <p className="mt-0.5 text-sm text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </ObserveSection>
    </section>
  );
}
