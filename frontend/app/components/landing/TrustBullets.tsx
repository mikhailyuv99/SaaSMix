import { ObserveSection } from "../ObserveSection";

const PlayIcon = () => (
  <svg className="w-5 h-5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M9 6v12l9-6z" />
  </svg>
);

const CardIcon = () => (
  <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x={1} y={4} width={22} height={16} rx={2} ry={2} />
    <line x1={1} y1={10} x2={23} y2={10} />
  </svg>
);

const items = [
  { label: "Aperçu pleine longueur", desc: "Écoutez le résultat avant de télécharger.", iconNode: <PlayIcon /> },
  { label: "Pas de carte bancaire", desc: "Pour commencer, rien à enregistrer.", iconNode: <CardIcon /> },
  { label: "Vous gardez vos droits", desc: "100 % de vos masters, toujours.", icon: "✓" },
];

export function TrustBullets() {
  return (
    <section className="w-full max-w-full overflow-x-hidden px-4 pt-8 pb-4 sm:pt-10 sm:pb-5 max-lg:px-3 max-md:pt-6 max-md:pb-3">
      <ObserveSection>
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 sm:flex-row sm:justify-between sm:gap-10 max-lg:gap-5 max-md:gap-4 box-border">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-start gap-4 text-center sm:text-left group max-lg:gap-3 ${i === 0 ? "observe-stagger-1" : i === 1 ? "observe-stagger-2" : "observe-stagger-3"}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-400 transition-colors duration-300 group-hover:border-white/25 group-hover:bg-white/10 sm:mx-auto sm:mb-1 sm:flex [&>svg]:block max-lg:h-9 max-lg:w-9 [&>svg]:max-lg:w-4 [&>svg]:max-lg:h-4">
                {"iconNode" in item && item.iconNode ? item.iconNode : <span className="text-base max-lg:text-sm">{item.icon}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-white whitespace-nowrap max-lg:whitespace-normal max-lg:text-sm max-md:text-xs">{item.label}</p>
                <p className="mt-0.5 text-sm text-slate-400 max-lg:text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </ObserveSection>
    </section>
  );
}
