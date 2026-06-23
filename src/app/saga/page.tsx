import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Feather } from 'lucide-react'
import { AgeFilteredStoryGrid } from '@/components/library/AgeFilteredStoryGrid'
import { getYouModeStories } from '@/lib/firestore-helpers'
import { APP_CONFIG } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Personal Sagas',
  description: 'Stories you play as yourself — your choices and reputation follow you across the world.',
}

export default async function SagaPage() {
  const stories = await getYouModeStories(60).catch(() => [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-6">
      <div className="space-y-2 max-w-2xl">
        <p className="text-[11px] text-amber-400/55 uppercase tracking-widest font-sans flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Personal Saga
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold gold-text leading-tight">Play as yourself</h1>
        <p className="text-muted-foreground/60 text-sm">
          In these stories you are the protagonist. Your choices build a reputation that follows you
          across every story in a world — the cast remembers how you’ve treated them. Begin a new
          chapter and the people will recall your name.
        </p>
        <div className="pt-1">
          <Link
            href="/stories/new"
            className="inline-flex items-center gap-1.5 text-[12px] font-sans px-3 py-1.5 rounded-full border border-amber-400/30 text-amber-300/85 hover:bg-amber-500/10 transition-colors"
          >
            <Feather className="h-3.5 w-3.5" /> Create a Personal Saga
          </Link>
        </div>
      </div>

      {stories.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground/40 text-sm">
          No shared Personal Sagas yet — be the first to{' '}
          <Link href="/stories/new" className="text-amber-300/80 hover:underline">create one</Link>.
        </p>
      ) : (
        <AgeFilteredStoryGrid stories={stories} />
      )}

      <p className="text-[11px] text-muted-foreground/50 font-sans pt-4">
        {APP_CONFIG.site.name} · Personal Sagas are shared by their authors; you can keep your own personal if you prefer.
      </p>
    </div>
  )
}
