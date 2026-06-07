import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Header } from '@/components/layout/Header'
import { APP_CONFIG } from '@/lib/config'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.site.defaultTitle,
    template: APP_CONFIG.site.titleTemplate,
  },
  description: APP_CONFIG.site.defaultDescription,
  openGraph: {
    title: APP_CONFIG.site.defaultTitle,
    description: APP_CONFIG.site.defaultDescription,
    type: 'website',
    siteName: APP_CONFIG.site.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_CONFIG.site.defaultTitle,
    description: APP_CONFIG.site.defaultDescription,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="antialiased">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
