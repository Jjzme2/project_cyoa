'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { quipForEvent, daySeed } from '@/lib/pet'
import { fetchProfileState, type ProfilePetState } from '@/lib/profile-state-client'
import { isCompanionHidden, setCompanionHidden } from './pal-companion-prefs'

/** Speak on every Nth chapter so the pal is company, not commentary. */
const CHAPTER_QUIP_EVERY = 3
const CHAPTER_BUBBLE_MS = 6_000
const ENDING_BUBBLE_MS = 9_000

/**
 * The Reader Pal, along for the read — a small, dismissible companion pinned
 * to the corner of the book view. Purely rule-based (never AI): it reacts to
 * chapter turns and endings with deterministic canned lines, drawn from the
 * same pal state the profile shows (shared, deduped fetch — no extra reads).
 * Signed-out readers, and readers who set it to "stays home", never see it.
 */
export function PalCompanion({ depth, isEnding }: { depth: number; isEnding: boolean }) {
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const [pet, setPet] = useState<ProfilePetState | null>(null)
  const [hidden, setHidden] = useState(true) // resolved from localStorage after mount
  const [bubble, setBubble] = useState<string | null>(null)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevDepth = useRef<number | null>(null)
  const endingSpoken = useRef(false)

  useEffect(() => {
    // Hydration-safe localStorage read: SSR renders hidden, the client reveals
    // after mount — same justified pattern as the draft-restore banner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(isCompanionHidden())
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchProfileState(user.uid, () => user.getIdToken())
      .then((state) => { if (alive) setPet(state.pet) })
      .catch(() => {})
    return () => { alive = false }
  }, [user])

  // React to the read as it happens — endings always, chapters occasionally.
  useEffect(() => {
    if (!pet || hidden) return

    const say = (text: string, ms: number) => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
      setBubble(text)
      bubbleTimer.current = setTimeout(() => setBubble(null), ms)
    }

    if (isEnding && !endingSpoken.current) {
      endingSpoken.current = true
      say(quipForEvent('ending', daySeed() + depth), ENDING_BUBBLE_MS)
      return
    }
    if (!isEnding) endingSpoken.current = false

    // Only on a real chapter CHANGE (not the initial mount/restore), and only
    // every few chapters, so the pal never competes with the story.
    const prev = prevDepth.current
    prevDepth.current = depth
    if (prev !== null && depth !== prev && depth > 0 && depth % CHAPTER_QUIP_EVERY === 0) {
      say(quipForEvent('chapter', daySeed() + depth), CHAPTER_BUBBLE_MS)
    }
  }, [depth, isEnding, pet, hidden])

  useEffect(() => () => { if (bubbleTimer.current) clearTimeout(bubbleTimer.current) }, [])

  if (!user || !pet || hidden) return null

  return (
    <div className="fixed bottom-4 left-4 z-40 select-none group" aria-live="polite">
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.95 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute bottom-full left-0 mb-2 w-max max-w-[210px] rounded-xl rounded-bl-sm border border-amber-500/25 bg-background/90 backdrop-blur px-3 py-2 text-[11px] italic text-amber-200/85 shadow-lg"
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setBubble((b) => (b ? null : quipForEvent('chapter', daySeed() + depth + 1)))}
        title={`${pet.name} — level ${pet.level} ${pet.stage.name}`}
        aria-label={`Your pal ${pet.name}. Tap for a word of encouragement.`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/25 bg-background/80 backdrop-blur text-2xl shadow-lg transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        {pet.stage.emoji}
      </button>

      <button
        type="button"
        onClick={() => { setCompanionHidden(true); setHidden(true) }}
        title="Send your pal home (re-enable from your profile)"
        aria-label="Hide your reading companion"
        className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-background/90 border border-white/15 text-muted-foreground/60 hover:text-foreground"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}
