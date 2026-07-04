'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { trackEvent } from '@/lib/track-client'
import { Button } from '@/components/ui/button'

export interface TeaserChoice {
  id: string
  promptText: string
  childNodeId: string
}

/**
 * The homepage's "Jump right in" moment, made interactive: a real excerpt from
 * the featured story plus its actual (already-written) choices, right on the
 * landing page. Picking one reveals a taste of where it leads before asking
 * for anything — the payoff comes before the commitment.
 */
export function InteractiveTeaser({
  storyId,
  storyTitle,
  excerpt,
  choices,
}: {
  storyId: string
  storyTitle: string
  excerpt: string
  choices: TeaserChoice[]
}) {
  const { user } = useAuth()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function pick(choice: TeaserChoice, index: number) {
    if (pickedId) return
    setPickedId(choice.id)
    setLoading(true)
    void trackEvent(user, 'onboarding.teaser_choice_clicked', { props: { storyId, choiceIndex: index } })
    try {
      const res = await fetch(`/api/stories/${storyId}/nodes?nodeId=${choice.childNodeId}`)
      if (res.ok) {
        const data = await res.json()
        const content: string | undefined = data.node?.content
        if (content) setPreview(content.slice(0, 220).trim())
      }
    } catch {
      // best-effort — the "Continue reading" link below still works either way
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <div
        className="book-page page-texture rounded-xl p-5 text-[13.5px] leading-relaxed text-foreground/80"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {excerpt}…
      </div>

      {!pickedId ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest font-sans text-amber-400/55">What do you do?</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((c, i) => (
              <button
                key={c.id}
                onClick={() => pick(c, i)}
                className="text-xs font-sans px-3 py-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90 hover:bg-amber-500/15 hover:border-amber-500/40 transition-colors"
              >
                {c.promptText}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50 font-sans">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Turning the page…
              </div>
            ) : preview ? (
              <p className="text-xs text-muted-foreground/60 italic leading-relaxed">{preview}…</p>
            ) : null}
            <Link href={`/stories/${storyId}?welcome=1`}>
              <Button className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
                <BookOpen className="h-4 w-4" />
                Continue “{storyTitle}”
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
