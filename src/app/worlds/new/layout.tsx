import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forge a New World',
  description: 'Forge a new world, define its lore, rules, tone, and constraints.',
  openGraph: {
    title: 'Forge a New World',
    description: 'Forge a new world, define its lore, rules, tone, and constraints.',
    type: 'website',
  },
}

export default function NewWorldLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
