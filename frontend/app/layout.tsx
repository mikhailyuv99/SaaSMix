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
    default: 'Siberia Mix — Mix & master vocal automatique | siberiamix.com',
    template: '%s | Siberia Mix',
  },
  description: 'Mix et master vocal automatique pour artistes hip-hop et R&B. Uploadez vos stems, choisissez un preset, récupérez votre mix en quelques secondes. Par 99SIBERIA.',
  keywords: ['mix vocal', 'master automatique', 'mix hip-hop', 'stem mixing', 'siberia mix', 'mix en ligne', 'mastering en ligne'],
  authors: [{ name: '99SIBERIA', url: SITE_URL }],
  creator: '99SIBERIA',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: 'Siberia Mix',
    title: 'Siberia Mix — Mix & master vocal automatique',
    description: 'Mix et master vocal automatique pour artistes. Stems + instrumental = mix Pro en secondes.',
    images: [{ url: '/logo-black.png', width: 512, height: 512, alt: 'Siberia Mix' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Siberia Mix — Mix & master vocal automatique',
    description: 'Mix et master vocal automatique pour artistes. Stems + instrumental = mix Pro en secondes.',
    images: ['/logo-black.png'],
  },
  icons: {
    icon: '/favicon.ico',
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
