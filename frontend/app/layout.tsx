import './globals.css'
import { Inter } from 'next/font/google'
import { StarryCeiling } from './components/StarryCeiling'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'Siberia Mix — Mix & master automatique | siberiamix.com',
  description: 'Mixs et masters automatique pour les artistes indépendants. Siberia Mix par siberiamix.com',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} antialiased text-slate-200`}>
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
