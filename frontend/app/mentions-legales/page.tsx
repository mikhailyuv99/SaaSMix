"use client";

import Link from "next/link";

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#060608] text-slate-400 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-slate-400 hover:text-white text-sm mb-6 inline-block">
          ← Retour à l&apos;accueil
        </Link>
        <h1 className="text-2xl font-semibold text-white mb-6">Mentions légales</h1>
        <div className="card p-6 space-y-6 text-sm text-slate-400">
          <section>
            <h2 className="text-white font-medium mb-2">Éditeur du site</h2>
            <p>
              Le site est édité par <strong>99SIBERIA</strong>, dont le siège social est situé au 1 Promenade des Anglais, 06000 Nice, France.
            </p>
            <p className="mt-2">
              SIRET : 948 313 945 000 40
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Hébergement</h2>
            <p>
              Ce site est hébergé par <strong>Netlify, Inc.</strong>, 2325 3rd Street, Suite 215, San Francisco, CA 94107, États-Unis.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Contact</h2>
            <p>
              Pour toute question relative aux mentions légales ou au site, vous pouvez nous contacter à l&apos;adresse :{" "}
              <a href="mailto:99siberia@gmail.com" className="text-slate-400 hover:text-white underline">99siberia@gmail.com</a>.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-2">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, visuels, logiciels) est protégé par le droit d&apos;auteur et appartient à 99SIBERIA ou à ses partenaires. Toute reproduction non autorisée peut constituer une contrefaçon.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
