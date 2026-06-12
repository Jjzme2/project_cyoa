import type { MetadataRoute } from 'next'
import { APP_CONFIG } from '@/lib/config'
import { getStories, getPublicWorlds } from '@/lib/firestore-helpers'

const BASE = APP_CONFIG.site.url.replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/worlds`, changeFrequency: 'daily', priority: 0.8 },
  ]

  // Firestore reads are best-effort: a misconfigured build should still ship
  // a valid sitemap of the static routes rather than failing outright.
  const [stories, worlds] = await Promise.all([
    getStories(200).catch(() => []),
    getPublicWorlds(100).catch(() => []),
  ])

  const storyRoutes: MetadataRoute.Sitemap = stories.map((s) => ({
    url: `${BASE}/stories/${s.id}`,
    lastModified: s.createdAt || undefined,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const worldRoutes: MetadataRoute.Sitemap = worlds.map((w) => ({
    url: `${BASE}/worlds/${w.id}`,
    lastModified: w.createdAt || undefined,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...worldRoutes, ...storyRoutes]
}
