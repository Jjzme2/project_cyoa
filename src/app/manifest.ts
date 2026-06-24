import type { MetadataRoute } from 'next'
import { APP_CONFIG } from '@/lib/config'

/**
 * Web app manifest (served at /manifest.webmanifest and auto-linked by Next).
 * Improves installability and gives crawlers a richer app description.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.site.defaultTitle,
    short_name: APP_CONFIG.site.name,
    description: APP_CONFIG.site.defaultDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    categories: ['entertainment', 'books', 'games'],
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  }
}
