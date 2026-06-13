'use client'

import { useEffect, useState } from 'react'
import { Lock, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookViewerClient } from '@/components/book/BookViewerClient'
import { useAuth } from '@/components/Providers'
import { ratingRank, MATURE_MIN_AGE, MIN_SITE_AGE } from '@/lib/ratings'
import type { Story, StoryNode } from '@/types'

/**
 * Client gate for Teen/Mature stories. The opening chapter is never rendered on
 * the server for gated stories; instead we resolve the viewer's allowance and
 * fetch the root node through the authed (age-enforcing) endpoint.
 */
export function GatedStoryReader({ story }: { story: Story }) {
  const { user, loading, allowedRank, openAuthModal } = useAuth()
  const [node, setNode] = useState<StoryNode | null>(null)
  const [denied, setDenied] = useState(false)
  const [errored, setErrored] = useState(false)

  const storyRank = ratingRank(story.rating)
  const requiredAge = storyRank >= 2 ? MATURE_MIN_AGE : MIN_SITE_AGE
  // Decided at render time — no setState needed for these.
  const blockedByAge = !loading && allowedRank < storyRank
  const empty = !story.rootNodeId

  useEffect(() => {
    if (loading || blockedByAge || empty) return
    let cancelled = false
    ;(async () => {
      try {
        const headers: Record<string, string> = {}
        if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`
        const res = await fetch(`/api/stories/${story.id}/nodes?nodeId=${story.rootNodeId}`, { headers })
        if (cancelled) return
        if (res.status === 403) {
          setDenied(true)
          return
        }
        if (!res.ok) {
          setErrored(true)
          return
        }
        const data = await res.json()
        if (!cancelled) setNode(data.node)
      } catch {
        if (!cancelled) setErrored(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, blockedByAge, empty, user, story.id, story.rootNodeId])

  if (!loading && node && !blockedByAge && !denied) {
    return <BookViewerClient story={story} initialNode={node} />
  }

  if (blockedByAge || denied) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/20 flex items-center justify-center mx-auto">
          <Lock className="h-6 w-6 text-amber-400/60" />
        </div>
        <div className="space-y-1.5">
          <p className="text-foreground/80 font-medium">
            This story is rated {story.rating}
          </p>
          <p className="text-muted-foreground/55 text-sm">
            You must be {requiredAge} or older to read it.{' '}
            {!user
              ? 'Sign in and confirm your date of birth to continue.'
              : 'It looks like your age on file doesn’t meet this rating.'}
          </p>
        </div>
        {!user && (
          <Button
            onClick={openAuthModal}
            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
          >
            Sign in
          </Button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <div className="glass-card rounded-2xl p-14 text-center">
        <p className="text-muted-foreground/45 text-sm">
          This story doesn&apos;t have an opening chapter yet.
        </p>
      </div>
    )
  }

  if (errored) {
    return (
      <div className="glass-card rounded-2xl p-14 text-center space-y-2">
        <ShieldAlert className="h-5 w-5 text-amber-400/50 mx-auto" />
        <p className="text-muted-foreground/45 text-sm">Could not load this story right now.</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl min-h-[400px] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-amber-400/50" />
    </div>
  )
}
