import './globals.css'
import { Inter } from 'next/font/google'
import { StarryCeiling } from './components/StarryCeiling'

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
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
