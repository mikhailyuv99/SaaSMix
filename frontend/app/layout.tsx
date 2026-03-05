import './globals.css'
import { JsonLd } from './components/JsonLd'
import { Header } from './components/Header'
import { PageBackground } from './components/PageBackground'
import { LandingTheme } from './components/LandingTheme'
import { FooterWithLegalModals } from './components/FooterWithLegalModals'
import localFont from 'next/font/local'
import { OfflineBanner } from './components/OfflineBanner'
import { SafariDetect } from './components/SafariDetect'

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Variable.ttf',
  display: 'swap',
  variable: '--font-space-grotesk',
})

const questrial = localFont({
  src: './fonts/Questrial-Regular.ttf',
  display: 'swap',
  variable: '--font-questrial',
  weight: '400',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://siberiamix.com'
const OG_IMAGE_URL = `${SITE_URL.replace(/\/$/, '')}/logo-og.png`

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SIBERIA MIX | MIX VOCAL EN LIGNE',
    template: '%s | Siberia Mix',
  },
  description: 'Le site n°1 de mix vocal en ligne. Transformez vos pistes brutes en un morceau fini en quelques minutes. Zéro ingé son, zéro plugin.',
  keywords: [
    'mix vocal', 'mix vocal en ligne', 'mix vocal automatique', 'master vocal', 'master automatique', 'mastering en ligne', 'master en ligne',
    'mix et master', 'mix master vocal', 'mix stems', 'stem mixing', 'mix instrumental', 'mixer voix sur instrumental', 'voix sur instrumentale',
    'logiciel mix vocal', 'outil mix vocal', 'application mix vocal', 'mix en ligne', 'mixage en ligne', 'mastering en ligne pas cher',
    'artistes indépendants', 'artistes indés', 'rappeurs', 'chanteurs', 'beatmakers', 'home studio',
    'hip-hop', 'rap', 'R&B', 'mix hip-hop', 'mix rap', 'mix R&B',
    'stems WAV', 'stems vocaux', 'lead vocal', 'instrumental', 'instrumentale', 'mix vocal automatique', 'WAV',
    'mixer sans logiciel', 'mixer sans studio', 'mix rapide', 'comment mixer sa voix', 'comment masteriser',
    'Siberia Mix', 'siberiamix', '99SIBERIA',
  ],
  authors: [{ name: '99SIBERIA', url: SITE_URL }],
  creator: '99SIBERIA',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: 'Siberia Mix',
    title: 'SIBERIA MIX | MIX VOCAL EN LIGNE',
    description: "Le site n°1 de mix vocal en ligne. Transformez vos pistes brutes en un morceau fini en quelques minutes. Zéro ingé son, zéro plugin.",
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: 'Siberia Mix' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIBERIA MIX | MIX VOCAL EN LIGNE',
    description: "Le site n°1 de mix vocal en ligne. Transformez vos pistes brutes en un morceau fini en quelques minutes. Zéro ingé son, zéro plugin.",
    images: [OG_IMAGE_URL],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: SITE_URL },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${spaceGrotesk.variable} ${questrial.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var u=navigator.userAgent,v=navigator.vendor;var isSafari=v&&v.indexOf("Apple")>=0||(u.indexOf("Safari")>=0&&u.indexOf("Chrome")<0&&u.indexOf("CriOS")<0);if(isSafari){document.documentElement.classList.add("safari-webkit");var m=u.match(/Version\\/(\\d+)/);var ver=m?parseInt(m[1],10):0;var isIOS=/iPhone|iPad|iPod/.test(u);var isOldSafari=(ver>0&&ver<18)||(isIOS&&(ver<18||ver===0));if(isOldSafari){document.documentElement.classList.add("safari-webkit-old");if(isIOS)document.documentElement.classList.add("safari-ios-old");}}})();`,
          }}
        />
        <link rel="preconnect" href="https://js.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://api.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://m.stripe.network" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://m.stripe.network" />
        <link rel="preconnect" href="https://r.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://r.stripe.com" />
        <link rel="preconnect" href="https://q.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://q.stripe.com" />
        <link rel="preconnect" href="https://b.stripecdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://b.stripecdn.com" />
        <link rel="preconnect" href="https://hooks.stripe.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://hooks.stripe.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://api.siberiamix.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.siberiamix.com" />
        <link rel="preconnect" href="https://api-staging.siberiamix.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api-staging.siberiamix.com" />
        <link rel="preload" href="/fonts/Questrial-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/SpaceGrotesk-Variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        {process.env.NEXT_PUBLIC_FB_APP_ID ? (
          <meta property="fb:app_id" content={process.env.NEXT_PUBLIC_FB_APP_ID} />
        ) : null}
      </head>
        <body className={`${questrial.className} antialiased text-brand-gray uppercase`}>
        <SafariDetect />
        <JsonLd />
        <OfflineBanner />
        <div className="relative min-h-screen flex flex-col">
          <PageBackground />
          <LandingTheme>
            <>
              <Header />
              <div className="relative z-10 flex-1">{children}</div>
              <FooterWithLegalModals />
            </>
          </LandingTheme>
        </div>
      </body>
    </html>
  )
}
