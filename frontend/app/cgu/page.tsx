"use client";

import Link from "next/link";

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-[#060608] text-slate-400 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-slate-400 hover:text-white text-sm mb-6 inline-block">
          ← Retour à l&apos;accueil
        </Link>
        <h1 className="text-2xl font-semibold text-white mb-6">Conditions générales d&apos;utilisation (CGU)</h1>
        <div className="card p-6 space-y-6 text-sm text-slate-400">
          <p>
            L&apos;utilisation du site et des services proposés par <strong>99SIBERIA</strong> implique l&apos;acceptation des présentes conditions générales d&apos;utilisation.
          </p>
          <section>
            <h2 className="text-white font-medium mb-2">Objet du service</h2>
            <p>
              Le site propose un service de mix et de mastering automatique de pistes audio. L&apos;utilisateur uploade ses fichiers, configure les paramètres et obtient des rendus mixés et masterisés.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Compte utilisateur</h2>
            <p>
              La création d&apos;un compte peut être requise pour certaines fonctionnalités (sauvegarde de projets, téléchargement, etc.). L&apos;utilisateur est responsable du caractère confidentiel de ses identifiants et des actions effectuées depuis son compte.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Contenu et propriété intellectuelle</h2>
            <p>
              Les fichiers audio uploadés restent la propriété de l&apos;utilisateur. 99SIBERIA ne revendique aucun droit sur le contenu créé par l&apos;utilisateur. L&apos;utilisateur s&apos;engage à ne mettre en ligne que des contenus dont il détient les droits.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Responsabilité</h2>
            <p>
              99SIBERIA s&apos;efforce d&apos;assurer la disponibilité et la qualité du service mais ne peut être tenue responsable des interruptions, pertes de données ou dommages indirects. Le service est fourni « en l&apos;état ».
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Modification et résiliation</h2>
            <p>
              99SIBERIA se réserve le droit de modifier les présentes CGU et les fonctionnalités du site. En cas de manquement grave aux présentes conditions, 99SIBERIA peut suspendre ou résilier l&apos;accès au compte de l&apos;utilisateur.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents de France.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
