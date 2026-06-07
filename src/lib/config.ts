/**
 * App Configuration Module
 * Centralized settings, metadata, and constants to satisfy the
 * Configuration-Driven Architecture constraint.
 */

export const APP_CONFIG = {
  site: {
    name: 'Chronicle',
    domain: 'chronicle.cyoa', // Placeholder domain
    titleTemplate: '%s — Chronicle',
    defaultTitle: 'Chronicle — Community CYOA',
    defaultDescription: 'Build worlds, write stories, shape destinies together. A community-built choose-your-own-adventure library.',
    openGraph: {
      type: 'website',
      siteName: 'Chronicle',
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@chronicle_cyoa',
    },
  },
}
