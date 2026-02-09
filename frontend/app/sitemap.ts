import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://siberiamix.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/mentions-legales',
    '/politique-confidentialite',
    '/cgu',
    '/connexion',
    '/inscription',
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' as const : 'monthly' as const,
    priority: path === '' ? 1 : 0.7,
  }))
  return routes
}
