import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Begin a New Story',
  description: 'Write the opening chapter of a new choose-your-own-adventure story and define its resources.',
  openGraph: {
    title: 'Begin a New Story',
    description: 'Write the opening chapter of a new choose-your-own-adventure story and define its resources.',
    type: 'website',
  },
}

export default function NewStoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
