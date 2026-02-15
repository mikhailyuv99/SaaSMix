"use client";

import { useState } from "react";
import { ObserveSection } from "../ObserveSection";

const INSTAGRAM_URL = "https://instagram.com/siberiamix";
const FONT = "'Plus Jakarta Sans', sans-serif";
const CONTACT_EMAIL = "99siberia@gmail.com";

const faqs = [
  {
    q: "C'est quoi Siberia Mix ?",
    a: "Siberia Mix est un outil de mix vocal en ligne. Vous uploadez vos stems vocaux et votre instrumental en WAV, vous choisissez vos réglages (de-esser, réverb, delay, tonalité…), lancez le mix et récupérez un mix + master prêt à sortir en quelques minutes. Pas besoin d'ingé son ni de plugins.",
  },
  {
    q: "Quels formats sont acceptés ?",
    a: "Nous utilisons le WAV pour le traitement (44,1 kHz ou 48 kHz). Uploadez vos pistes vocales (lead, adlibs, backs) et votre instrumental séparément.",
  },
  {
    q: "Est-ce que je garde les droits sur ma musique ?",
    a: "Oui. Vous conservez 100 % de vos droits. Siberia Mix ne revendique aucun droit sur vos morceaux.",
  },
  {
    q: "Comment fonctionnent les tokens ?",
    a: "Les tokens servent à payer les exports (mix final). Les tarifs et volumes par formule seront communiqués bientôt. Vous pourrez tester le service en aperçu avant de consommer des tokens.",
  },
  {
    q: "Combien de temps prend un mix ?",
    a: "Le traitement d’un morceau prend en général quelques dizaines de secondes. Vous pouvez écouter l’aperçu en pleine longueur avant de télécharger le fichier final.",
  },
  {
    q: "Ça marche sur mobile et tablette ?",
    a: "Oui. Siberia Mix fonctionne dans le navigateur sur Mac, PC, tablette et smartphone. Aucune installation n’est requise.",
  },
  {
    q: "Puis-je réutiliser le même projet plus tard ?",
    a: "Oui. Vos projets et pistes sont enregistrés. Vous pouvez revenir modifier le mix, changer des réglages ou retélécharger le fichier tant que votre session est active.",
  },
  {
    q: "Quelle est la durée maximale d'un morceau ?",
    a: "Les limites dépendent de votre formule. En général, les morceaux de quelques minutes sont gérés sans problème. Les détails seront précisés dans les offres.",
  },
  {
    q: "Le mix est-il fait par une IA ?",
    a: "Siberia Mix combine des algorithmes de traitement du signal et des réglages inspirés des pratiques de mix professionnel, pour un résultat cohérent et rapide.",
  }
];

export function FAQContactSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [formState, setFormState] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`[Siberia Mix] Contact depuis le site`);
    const body = encodeURIComponent(
      `Nom: ${formState.name}\nEmail: ${formState.email}\n\nMessage:\n${formState.message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <section id="faq-contact" className="scroll-mt-20 px-4 py-6 sm:py-8 font-sans">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-400 observe-stagger-1">
            Support
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            FAQ & Contact
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Questions fréquentes et formulaire de contact.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-5xl sm:mt-10 flex flex-col lg:flex-row lg:items-start gap-8 sm:gap-10">
          <ul className="space-y-0 observe-stagger-1 min-w-0 flex-1 lg:max-w-[480px]">
            {faqs.map((faq, i) => (
              <li
                key={i}
                className={`group border-b border-white/[0.06] last:border-b-0 transition-colors hover:border-white/10 ${
                  openIndex === i ? "border-white/10" : ""
                }`}
              >
                <button
                  type="button"
                  className="faq-question flex w-full items-start justify-between gap-4 py-5 sm:py-6 text-left transition-colors font-normal"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  aria-expanded={openIndex === i}
                >
                  <span className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <span
                      className={`mt-2 shrink-0 w-1.5 h-1.5 rounded-full transition-colors ${
                        openIndex === i ? "bg-white/80" : "bg-white/40 group-hover:bg-white/60"
                      }`}
                      aria-hidden
                    />
                    <span className="faq-font faq-question-text font-normal text-[15px] sm:text-base leading-snug text-white">
                      {faq.q}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 mt-1.5 text-slate-400 transition-transform duration-200 ${
                      openIndex === i ? "rotate-180" : ""
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-200 ease-out ${
                    openIndex === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="faq-font pl-8 sm:pl-9 pr-0 pb-5 sm:pb-6 pt-0 text-sm sm:text-[15px] leading-relaxed text-slate-400">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="observe-stagger-2 flex flex-col w-full min-h-0 lg:w-[380px] lg:shrink-0">
            <div className="font-sans pt-5 px-6 pb-6 sm:pt-6 sm:px-7 sm:pb-7 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col flex-1 min-h-0">
              <h3 className="font-heading font-semibold text-white">Nous contacter</h3>
              <p className="mt-1 text-sm text-slate-400">
                Un message ou une question ? Envoyez-nous un mail.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4 flex flex-col flex-1 min-h-0">
                <div>
                  <label htmlFor="contact-name" className="mb-1 block text-xs font-medium text-slate-400">
                    Nom
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                    style={{ fontFamily: FONT }}
                    className="contact-input w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-400 transition-colors focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-1 block text-xs font-medium text-slate-400">
                    E-mail
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                    required
                    style={{ fontFamily: FONT }}
                    className="contact-input w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-400 transition-colors focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="vous@exemple.com"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="mb-1 block text-xs font-medium text-slate-400">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={formState.message}
                    onChange={(e) => setFormState((s) => ({ ...s, message: e.target.value }))}
                    style={{ fontFamily: FONT }}
                    className="contact-input w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-400 transition-colors focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Votre message..."
                  />
                </div>
                <button
                  type="submit"
                  style={{ fontFamily: FONT }}
                  className="contact-submit btn-cta-primary w-full py-3 text-sm font-semibold font-sans"
                >
                  Envoyer
                </button>
              </form>
              <div className="mt-5 flex items-center gap-3 border-t border-white/[0.06] pt-5 mt-auto">
                <span className="text-xs text-slate-400">Ou suivez-nous :</span>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white transition-all hover:border-white/30 hover:bg-white/10 hover:-translate-y-0.5"
                  aria-label="Instagram @siberiamix"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x={2} y={2} width={20} height={20} rx={5} ry={5} />
                    <circle cx={12} cy={12} r={4} />
                    <circle cx={12} cy={12} r={1.5} fill="currentColor" stroke="none" />
                  </svg>
                </a>
                <span className="text-xs text-slate-400">@siberiamix</span>
              </div>
            </div>
          </div>
        </div>
      </ObserveSection>
    </section>
  );
}
