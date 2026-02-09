import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://siberiamix.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      // ChatGPT / OpenAI search uses OAI-SearchBot — allow so the site can appear in ChatGPT answers
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: ['/api/'],
      },
      // Optional: block GPTBot if you don't want content used for AI training (does not affect ChatGPT Search)
      // { userAgent: 'GPTBot', disallow: '/' },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
