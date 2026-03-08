"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";

type LegalModalType = "mentions" | "politique" | "cgu" | null;

function LegalModalContent({ type }: { type: NonNullable<LegalModalType> }) {
  if (type === "mentions") {
    return (
      <>
        <h1 id="legal-modal-title" className="font-heading text-xl font-semibold text-white mb-4">Mentions légales</h1>
        <div className="space-y-5 text-sm text-slate-400">
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Éditeur du site</h2>
            <p>
              Le site est édité par <strong>99SIBERIA</strong>, dont le siège social est situé au 1 Promenade des Anglais, 06000 Nice, France.
            </p>
            <p className="mt-2">SIRET : 948 313 945 000 40</p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Hébergement</h2>
            <p>
              Ce site est hébergé par <strong>Netlify, Inc.</strong>, 2325 3rd Street, Suite 215, San Francisco, CA 94107, États-Unis.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Contact</h2>
            <p>
              Pour toute question relative aux mentions légales ou au site, vous pouvez nous contacter à l&apos;adresse :{" "}
              <a href="mailto:99siberia@gmail.com" className="text-slate-400 hover:text-white underline">99siberia@gmail.com</a>.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, visuels, logiciels) est protégé par le droit d&apos;auteur et appartient à 99SIBERIA ou à ses partenaires. Toute reproduction non autorisée peut constituer une contrefaçon.
            </p>
          </section>
        </div>
      </>
    );
  }
  if (type === "politique") {
    return (
      <>
        <h1 id="legal-modal-title" className="font-heading text-xl font-semibold text-white mb-4">Politique de confidentialité</h1>
        <div className="space-y-5 text-sm text-slate-400">
          <p>
            La société <strong>99SIBERIA</strong> s&apos;engage à protéger la vie privée des utilisateurs du site. Cette politique décrit les données que nous collectons et comment nous les utilisons.
          </p>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Données collectées</h2>
            <p>
              Nous pouvons collecter : adresse e-mail, mot de passe (stocké de manière sécurisée), fichiers audio que vous uploadez pour le mix et le mastering, et données techniques (adresse IP, type de navigateur) pour le bon fonctionnement du service.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Finalité</h2>
            <p>
              Les données sont utilisées pour fournir le service (mix et master automatique), gérer votre compte, et améliorer nos services. Nous ne vendons pas vos données à des tiers.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Durée de conservation</h2>
            <p>
              Les données de compte et les projets sauvegardés sont conservés tant que votre compte est actif. Vous pouvez demander la suppression de votre compte et de vos données à tout moment.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Vos droits (RGPD)</h2>
            <p>
              Conformément au Règlement général sur la protection des données (RGPD), vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données, ainsi que d&apos;un droit d&apos;opposition et de limitation du traitement. Pour exercer ces droits, contactez-nous à{" "}
              <a href="mailto:99siberia@gmail.com" className="text-slate-400 hover:text-white underline">99siberia@gmail.com</a>. Vous pouvez également introduire une réclamation auprès de la CNIL.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-white font-medium mb-2">Cookies</h2>
            <p>
              Le site peut utiliser des cookies ou stockage local (session, préférences) pour le fonctionnement du service (connexion, sauvegarde de projets). Nous n&apos;utilisons pas de cookies publicitaires tiers sans votre consentement.
            </p>
          </section>
        </div>
      </>
    );
  }
  // cgu
  return (
    <>
      <h1 id="legal-modal-title" className="font-heading text-xl font-semibold text-white mb-4">Conditions générales d&apos;utilisation (CGU)</h1>
      <div className="space-y-5 text-sm text-slate-400">
        <p>
          L&apos;utilisation du site et des services proposés par <strong>99SIBERIA</strong> implique l&apos;acceptation des présentes conditions générales d&apos;utilisation.
        </p>
        <section>
          <h2 className="font-heading text-white font-medium mb-2">Objet du service</h2>
          <p>
            Le site propose un service de mix et de mastering automatique de pistes audio. L&apos;utilisateur uploade ses fichiers, configure les paramètres et obtient des rendus mixés et masterisés.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-white font-medium mb-2">Compte utilisateur</h2>
          <p>
            La création d&apos;un compte peut être requise pour certaines fonctionnalités (sauvegarde de projets, téléchargement, etc.). L&apos;utilisateur est responsable du caractère confidentiel de ses identifiants et des actions effectuées depuis son compte.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-white font-medium mb-2">Contenu et propriété intellectuelle</h2>
          <p>
            Les fichiers audio uploadés restent la propriété de l&apos;utilisateur. 99SIBERIA ne revendique aucun droit sur le contenu créé par l&apos;utilisateur. L&apos;utilisateur s&apos;engage à ne mettre en ligne que des contenus dont il détient les droits.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-white font-medium mb-2">Responsabilité</h2>
          <p>
            99SIBERIA s&apos;efforce d&apos;assurer la disponibilité et la qualité du service mais ne peut être tenue responsable des interruptions, pertes de données ou dommages indirects. Le service est fourni « en l&apos;état ».
          </p>
        </section>
        <section>
          <h2 className="font-heading text-white font-medium mb-2">Modification et résiliation</h2>
          <p>
            99SIBERIA se réserve le droit de modifier les présentes CGU et les fonctionnalités du site. En cas de manquement grave aux présentes conditions, 99SIBERIA peut suspendre ou résilier l&apos;accès au compte de l&apos;utilisateur.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-white font-medium mb-2">Droit applicable</h2>
          <p>
            Les présentes CGU sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents de France.
          </p>
        </section>
      </div>
    </>
  );
}

export function FooterWithLegalModals() {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const openMentions = useCallback(() => setLegalModal("mentions"), []);
  const openPolitique = useCallback(() => setLegalModal("politique"), []);
  const openCGU = useCallback(() => setLegalModal("cgu"), []);
  const closeModal = useCallback(() => setLegalModal(null), []);

  return (
    <>
      <footer className="relative z-20 mt-auto py-6 px-4 max-lg:py-5 max-lg:px-3 max-md:py-4 max-md:px-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-[11px] sm:text-xs text-slate-400 max-md:gap-2 max-md:text-[10px]">
          <span className="font-heading font-medium">© 2026 Siberia Mix</span>
          <button type="button" onClick={openMentions} className="uppercase transition-colors hover:text-white min-h-6 px-1">
            Mentions légales
          </button>
          <button type="button" onClick={openPolitique} className="uppercase transition-colors hover:text-white min-h-6 px-1">
            Politique de confidentialité
          </button>
          <button type="button" onClick={openCGU} className="transition-colors hover:text-white min-h-6 px-1">
            CGU
          </button>
        </div>
      </footer>

      {legalModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-backdrop-slate fixed inset-0 z-[9999] flex items-center justify-center p-4 max-lg:p-3"
            onClick={closeModal}
            aria-modal="true"
            role="dialog"
            aria-labelledby="legal-modal-title"
          >
            <div className="backdrop-blur-layer" aria-hidden="true" />
            <div className="backdrop-tint-layer" aria-hidden="true" />
            <div
              className="modal-panel-dark font-sans rounded-2xl border border-white/15 backdrop-blur-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto max-lg:max-w-[calc(100vw-1.5rem)] max-lg:p-4 max-lg:rounded-xl max-lg:max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-2 text-slate-400 hover:text-white transition-colors"
                  aria-label="Fermer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <LegalModalContent type={legalModal} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
