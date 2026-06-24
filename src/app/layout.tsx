import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Header } from '@/components/layout/Header'
import { VerifyEmailBanner } from '@/components/auth/VerifyEmailBanner'
import { TwoFactorGate } from '@/components/auth/TwoFactorGate'
import { APP_CONFIG } from '@/lib/config'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(APP_CONFIG.site.url),
  title: {
    default: APP_CONFIG.site.defaultTitle,
    template: APP_CONFIG.site.titleTemplate,
  },
  description: APP_CONFIG.site.defaultDescription,
  applicationName: APP_CONFIG.site.name,
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, address: false, email: false },
  keywords: [
    'choose your own adventure',
    'CYOA',
    'interactive fiction',
    'collaborative writing',
    'branching stories',
    'community storytelling',
  ],
  openGraph: {
    title: APP_CONFIG.site.defaultTitle,
    description: APP_CONFIG.site.defaultDescription,
    type: 'website',
    siteName: APP_CONFIG.site.name,
    locale: 'en_US',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_CONFIG.site.defaultTitle,
    description: APP_CONFIG.site.defaultDescription,
    creator: APP_CONFIG.site.twitter.creator,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

// Structured data so search engines can render rich results for the site and
// its publisher. Kept in sync with APP_CONFIG (the single source of site truth).
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${APP_CONFIG.site.url}/#website`,
      url: APP_CONFIG.site.url,
      name: APP_CONFIG.site.name,
      description: APP_CONFIG.site.defaultDescription,
      inLanguage: 'en',
      publisher: { '@id': `${APP_CONFIG.site.url}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${APP_CONFIG.site.url}/#organization`,
      name: APP_CONFIG.site.name,
      url: APP_CONFIG.site.url,
      description: APP_CONFIG.site.defaultDescription,
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <Providers>
          <Header />
          <VerifyEmailBanner />
          <TwoFactorGate>{children}</TwoFactorGate>
        </Providers>
      </body>
    </html>
  )
}
