"use client";

import { useState } from "react";
import { ObserveSection } from "../ObserveSection";

const INSTAGRAM_URL = "https://instagram.com/siberiamix";
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
    q: "L'outil s'adapte-t-il à mon style de musique ?",
    a: "Vous pilotez le rendu en choisissant vos réglages : de-esser, réverb, delay, tonalité, etc. Écoutez l'aperçu, ajustez à votre goût puis exportez le fichier final.",
  },
  {
    q: "Puis-je annuler ou me faire rembourser ?",
    a: "Les conditions d’annulation et de remboursement sont détaillées dans nos CGU. En cas de question, contactez-nous via le formulaire ou par e-mail.",
  },
];

export function FAQContactSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
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
    <section id="faq-contact" className="scroll-mt-20 px-4 py-6 sm:py-8">
      <ObserveSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-slate-500 observe-stagger-1">
            Support
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl observe-stagger-2">
            FAQ & Contact
          </h2>
          <p className="mt-3 text-slate-400 observe-stagger-3">
            Questions fréquentes et formulaire de contact.
          </p>
        </div>

        <div className="mx-auto mt-5 grid max-w-5xl gap-8 lg:grid-cols-[1fr,400px]">
          <div className="space-y-3 observe-stagger-1">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="landing-card overflow-hidden transition-all duration-300"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left font-medium text-white transition-colors hover:bg-white/[0.03] sm:px-6"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  aria-expanded={openIndex === i}
                >
                  <span>{faq.q}</span>
                  <span
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
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
                    <div className="border-t border-white/10 px-5 py-3 text-sm leading-relaxed text-slate-400 sm:px-6">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="observe-stagger-2 lg:sticky lg:top-24 lg:self-start">
            <div className="landing-card p-6 shadow-xl shadow-black/20">
              <h3 className="font-heading font-semibold text-white">Nous contacter</h3>
              <p className="mt-1 text-sm text-slate-500">
                Un message ou une question ? Envoyez-nous un mail.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="contact-name" className="mb-1 block text-xs font-medium text-slate-500">
                    Nom
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-1 block text-xs font-medium text-slate-500">
                    E-mail
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="vous@exemple.com"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="mb-1 block text-xs font-medium text-slate-500">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={formState.message}
                    onChange={(e) => setFormState((s) => ({ ...s, message: e.target.value }))}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Votre message..."
                  />
                </div>
                <button
                  type="submit"
                  className="btn-cta-primary w-full py-3 text-sm font-semibold"
                >
                  Envoyer (ouvre votre messagerie)
                </button>
              </form>
              <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-5">
                <span className="text-xs text-slate-500">Ou suivez-nous :</span>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white transition-all hover:border-white/30 hover:bg-white/10 hover:-translate-y-0.5"
                  aria-label="Instagram @siberiamix"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.024.06 1.379.06 3.808 0 2.43-.013 2.784-.06 3.808-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.024.048-1.379.06-3.808.06-2.43 0-2.784-.013-3.808-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.024-.06-1.379-.06-3.808 0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2zM12 7.377a4.623 4.623 0 100 9.246 4.623 4.623 0 000-9.246zM12 20.25a8.25 8.25 0 100-16.5 8.25 8.25 0 000 16.5z"
                      clipRule="evenodd"
                    />
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
