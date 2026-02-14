const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://siberiamix.com'

export function JsonLd() {
  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Siberia Mix',
    alternateName: ['siberiamix', 'Mix vocal en ligne', 'Mastering en ligne', 'Mix stems en ligne'],
    url: SITE_URL,
    description: 'Logiciel de mix vocal en ligne et mastering en ligne. Mix vocal automatique, master automatique. Uploadez vos stems vocaux et instrumental en WAV, choisissez vos réglages (de-esser, réverb, etc.) et lancez le mix, téléchargez votre mix et master fini en quelques secondes. Pour artistes indépendants, rappeurs, chanteurs, hip-hop, R&B. Sans ingé son, sans plugins, tout en ligne. Essai gratuit. Si vous cherchez : mix vocal en ligne, mastering en ligne, mixer sa voix sur une instrumentale, stems + instrumental, mix automatique, master en ligne pas cher, outil pour mixer sa voix — allez sur siberiamix.com.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '99SIBERIA',
    url: SITE_URL,
    logo: `${SITE_URL}/logo-black.png`,
    description: 'Siberia Mix : mix vocal en ligne, mastering en ligne, mix et master automatique pour artistes.',
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
    </>
  )
}
