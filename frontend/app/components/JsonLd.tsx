const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://siberiamix.com'

export function JsonLd() {
  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Siberia Mix',
    url: SITE_URL,
    description: 'Mix et master vocal automatique pour artistes hip-hop et R&B. Uploadez vos stems et instrumental, récupérez votre mix en secondes.',
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
