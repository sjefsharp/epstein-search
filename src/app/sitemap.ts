import { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://epstein-search.vercel.app'
  const pages = ['', '/about', '/privacy', '/faq']
  
  const sitemapEntries: MetadataRoute.Sitemap = []
  
  // Generate entries for all locales and pages
  routing.locales.forEach((locale) => {
    pages.forEach((page) => {
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : 0.8,
      })
    })
  })
  
  return sitemapEntries
}
