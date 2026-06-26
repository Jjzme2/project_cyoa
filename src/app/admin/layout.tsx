import type { Metadata } from 'next'

/**
 * Admin surfaces are gated client-side by the `admin` role (and all data is
 * enforced admin-only server-side). Belt-and-suspenders for SEO: keep the whole
 * /admin/* tree out of search indexes regardless of robots.txt.
 */
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
