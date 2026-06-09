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
  stripe: {
    premiumPriceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID || 'price_premium_mock',
    creditPackages: [
      { id: 'pkg_50', name: 'Adventurer Pack', credits: 50, price: 4.99, priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_50 || 'price_50_mock', description: 'Good for ~16 illustrated chapters or 50 text chapters.' },
      { id: 'pkg_150', name: 'Hero Pack', credits: 150, price: 11.99, priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_150 || 'price_150_mock', description: 'Good for ~50 illustrated chapters or 150 text chapters.' },
      { id: 'pkg_400', name: 'Legend Pack', credits: 400, price: 24.99, priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_400 || 'price_400_mock', description: 'Best value for prolific creators and world-builders.' }
    ]
  },
  ai: {
    freeDailyLimit: 20,
    premiumDailyLimit: 100,
    imageCost: 3,
    textCost: 1,
  }
}
