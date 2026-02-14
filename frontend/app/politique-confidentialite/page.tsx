"use client";

import Link from "next/link";

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-[#060608] text-slate-400 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-slate-400 hover:text-white text-sm mb-6 inline-block">
          ← Retour à l&apos;accueil
        </Link>
        <h1 className="text-2xl font-semibold text-white mb-6">Politique de confidentialité</h1>
        <div className="card p-6 space-y-6 text-sm text-slate-400">
          <p>
            La société <strong>99SIBERIA</strong> s&apos;engage à protéger la vie privée des utilisateurs du site. Cette politique décrit les données que nous collectons et comment nous les utilisons.
          </p>
          <section>
            <h2 className="text-white font-medium mb-2">Données collectées</h2>
            <p>
              Nous pouvons collecter : adresse e-mail, mot de passe (stocké de manière sécurisée), fichiers audio que vous uploadez pour le mix et le mastering, et données techniques (adresse IP, type de navigateur) pour le bon fonctionnement du service.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Finalité</h2>
            <p>
              Les données sont utilisées pour fournir le service (mix et master automatique), gérer votre compte, et améliorer nos services. Nous ne vendons pas vos données à des tiers.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Durée de conservation</h2>
            <p>
              Les données de compte et les projets sauvegardés sont conservés tant que votre compte est actif. Vous pouvez demander la suppression de votre compte et de vos données à tout moment.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Vos droits (RGPD)</h2>
            <p>
              Conformément au Règlement général sur la protection des données (RGPD), vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données, ainsi que d&apos;un droit d&apos;opposition et de limitation du traitement. Pour exercer ces droits, contactez-nous à{" "}
              <a href="mailto:99siberia@gmail.com" className="text-slate-400 hover:text-white underline">99siberia@gmail.com</a>. Vous pouvez également introduire une réclamation auprès de la CNIL.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Cookies</h2>
            <p>
              Le site peut utiliser des cookies ou stockage local (session, préférences) pour le fonctionnement du service (connexion, sauvegarde de projets). Nous n&apos;utilisons pas de cookies publicitaires tiers sans votre consentement.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
