import './globals.css'
import { JsonLd } from './components/JsonLd'
import { Header } from './components/Header'
import { PageBackground } from './components/PageBackground'
import { LandingTheme } from './components/LandingTheme'
import { FooterWithLegalModals } from './components/FooterWithLegalModals'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { OfflineBanner } from './components/OfflineBanner'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plus-jakarta',
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
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/logo-black.png',
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
    <html lang="fr" className={plusJakarta.variable}>
      <head>
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="alternate icon" href="/favicon.ico" />
        {process.env.NEXT_PUBLIC_FB_APP_ID ? (
          <meta property="fb:app_id" content={process.env.NEXT_PUBLIC_FB_APP_ID} />
        ) : null}
      </head>
      <body className={`${plusJakarta.className} antialiased text-slate-400 uppercase`}>
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
