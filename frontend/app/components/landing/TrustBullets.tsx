import { ObserveSection } from "../ObserveSection";

const CardIcon = () => (
  <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x={1} y={4} width={22} height={16} rx={2} ry={2} />
    <line x1={1} y1={10} x2={23} y2={10} />
  </svg>
);

const items = [
  { label: "Aperçu pleine longueur", desc: "Écoutez le résultat avant de télécharger.", icon: "▶" },
  { label: "Pas de carte bancaire", desc: "Pour commencer, rien à enregistrer.", iconNode: <CardIcon /> },
  { label: "Vous gardez vos droits", desc: "100 % de vos masters, toujours.", icon: "✓" },
];

export function TrustBullets() {
  return (
    <section className="px-4 -mt-2 pb-4 sm:-mt-1 sm:pb-5">
      <ObserveSection>
        <div className="mx-auto flex max-w-4xl flex-col gap-8 sm:flex-row sm:justify-between sm:gap-10">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-start gap-4 text-center sm:text-left group ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : "observe-stagger-3"}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-base text-slate-400 transition-all duration-300 group-hover:scale-105 group-hover:border-white/25 group-hover:bg-white/10 sm:mx-auto sm:mb-1 sm:flex">
                {"iconNode" in item && item.iconNode ? item.iconNode : item.icon}
              </span>
              <div className="flex-1">
                <p className="font-heading font-semibold text-white whitespace-nowrap">{item.label}</p>
                <p className="mt-0.5 text-sm text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </ObserveSection>
    </section>
  );
}
