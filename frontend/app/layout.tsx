import './globals.css'
import { Inter } from 'next/font/google'
import { StarryCeiling } from './components/StarryCeiling'
import { JsonLd } from './components/JsonLd'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://siberiamix.com'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SIBERIA MIX | MIX VOCAL EN LIGNE',
    template: '%s | Siberia Mix',
  },
  description: 'Uploadez vos pistes en WAV, choisissez un preset, téléchargez votre mix final.',
  keywords: [
    'mix vocal', 'mix vocal en ligne', 'mix vocal automatique', 'master vocal', 'master automatique', 'mastering en ligne', 'master en ligne',
    'mix et master', 'mix master vocal', 'mix stems', 'stem mixing', 'mix instrumental', 'mixer voix sur instrumental', 'voix sur beat',
    'logiciel mix vocal', 'outil mix vocal', 'application mix vocal', 'mix en ligne', 'mixage en ligne', 'mastering en ligne pas cher',
    'artistes indépendants', 'artistes indés', 'rappeurs', 'chanteurs', 'beatmakers', 'home studio',
    'hip-hop', 'rap', 'R&B', 'mix hip-hop', 'mix rap', 'mix R&B',
    'stems WAV', 'stems vocaux', 'lead vocal', 'instrumental', 'beat', 'preset mix', 'preset vocal', 'WAV',
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
    description: "Logiciel de mix vocal en ligne. Stems + instrumental, mix + master en quelques secondes pour les artistes indépendants. 0 ingé son, 0 plugin, tout se fait en ligne!",
    images: [{ url: '/logo-black.png', width: 512, height: 512, alt: 'Siberia Mix' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIBERIA MIX | MIX VOCAL EN LIGNE',
    description: "Logiciel de mix vocal en ligne. Stems + instrumental, mix + master en quelques secondes pour les artistes indépendants. 0 ingé son, 0 plugin, tout se fait en ligne!",
    images: ['/logo-black.png'],
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="alternate icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} antialiased text-slate-200`}>
        <JsonLd />
        {/* <StarryCeiling /> */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-white/10 py-4 px-4 mt-auto">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-tagline text-[10px] sm:text-xs text-slate-500">
              <span>© {new Date().getFullYear()} 99SIBERIA</span>
              <Link href="/mentions-legales" className="hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">Mentions légales</Link>
              <Link href="/politique-confidentialite" className="hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">Politique de confidentialité</Link>
              <Link href="/cgu" className="hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)] transition-colors">CGU</Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
