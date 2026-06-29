'use client'

import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { useDraft } from '@/hooks/useDraft'
import { SAGA_HANDOFF_KEY, type SagaHandoff } from '@/lib/saga-handoff'
import { DEFAULT_COVER } from '@/components/book/CoverDesigner'
import { emptyDirector } from '@/lib/director'
import type { Story } from '@/types'

/**
 * Author-only control to spin a saved story off into a NEW, separate saga,
 * carrying its cast and world-tied settings along (the original story is left
 * untouched). Hidden for non-authors and for stories that are already sagas.
 */
export function TurnIntoSagaButton({ story }: { story: Story }) {
  const { user } = useAuth()
  const router = useRouter()
  const handoff = useDraft<SagaHandoff>(SAGA_HANDOFF_KEY)

  // Already a saga, or not the author → nothing to offer.
  if (story.youMode || !user || user.uid !== story.authorId) return null

  function turn() {
    handoff.save({
      title: story.title,
      description: story.description ?? '',
      worldId: story.worldId,
      rating: story.rating ?? 'Everyone',
      tags: story.tags ?? [],
      director: story.director ? { ...emptyDirector(), ...story.director } : emptyDirector(),
      styleChoices: story.styleChoices ?? {},
      coverTheme: story.coverTheme ?? DEFAULT_COVER,
      readingTheme: story.readingTheme ?? { pageStyle: 'parchment', ambientEffect: 'none' },
      shared: !story.unlisted,
      // A saga is played in second person, so the prose can't transfer verbatim;
      // carry the premise from the description and let the cast continue.
      premise: story.description ?? '',
      entryPoints: [],
      characters: story.characters ?? [],
      sourceStoryId: story.id,
      source: 'story',
    })
    router.push('/saga/new')
  }

  return (
    <button
      onClick={turn}
      title="Spin this story into a new Personal Saga"
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200/90 transition-colors"
    >
      <Sparkles className="h-3 w-3" />
      Turn into a saga
    </button>
  )
}
