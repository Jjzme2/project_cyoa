'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { quipFor, quipForEvent, daySeed } from '@/lib/pet'
import { companionAnimation, SCARED_TENSION } from '@/lib/pal-sprites'
import { fetchProfileState, type ProfilePetState } from '@/lib/profile-state-client'
import { PalSprite } from '@/components/pal/PalSprite'
import { isCompanionHidden, setCompanionHidden } from './pal-companion-prefs'

/** Speak on every Nth chapter so the pal is company, not commentary. */
const CHAPTER_QUIP_EVERY = 3
const CHAPTER_BUBBLE_MS = 6_000
const ENDING_BUBBLE_MS = 9_000
const PAT_BUBBLE_MS = 3_500
/** How long the pat's happy burst lasts. */
const PAT_MS = 2_500
/** No page turn for this long → the pal nods off. */
const INACTIVITY_MS = 3 * 60_000

/** Chapters read with the pal at your side, on this device — a keepsake, not telemetry. */
const CHAPTERS_TOGETHER_KEY = (uid: string) => `pal_chapters_${uid}`

export function bumpChaptersTogether(uid: string): void {
  try {
    const key = CHAPTERS_TOGETHER_KEY(uid)
    localStorage.setItem(key, String((Number(localStorage.getItem(key)) || 0) + 1))
  } catch {}
}

export function chaptersTogether(uid: string): number {
  try {
    return Number(localStorage.getItem(CHAPTERS_TOGETHER_KEY(uid))) || 0
  } catch {
    return 0
  }
}

/**
 * The Reader Pal, along for the read — a small, dismissible companion pinned
 * to the corner of the book view, like a stuffed animal brought to story time.
 * Purely rule-based (never AI): it greets you when you open a book, pipes up
 * every few chapters, gets scared when the Living World's tension runs high,
 * celebrates endings, nods off if you wander away, and can be patted for
 * courage. Art comes from drop-in sprite sheets (public/pals/README.md) with
 * an emoji fallback; state comes from the shared, deduped profile fetch.
 */
export function PalCompanion({
  depth,
  isEnding,
  tension,
}: {
  depth: number
  isEnding: boolean
  tension?: number
}) {
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const [pet, setPet] = useState<ProfilePetState | null>(null)
  const [hidden, setHidden] = useState(true) // resolved from localStorage after mount
  const [bubble, setBubble] = useState<string | null>(null)
  const [patted, setPatted] = useState(false)
  const [inactive, setInactive] = useState(false)

  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const patTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevDepth = useRef<number | null>(null)
  const endingSpoken = useRef(false)
  const wasScared = useRef(false)

  const say = useCallback((text: string, ms: number) => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
    setBubble(text)
    bubbleTimer.current = setTimeout(() => setBubble(null), ms)
  }, [])

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

  // Greet once per session when story time begins — the mood line doubles as
  // "I missed you" / "let's go" depending on how long the reader was away.
  useEffect(() => {
    if (!pet || hidden) return
    try {
      if (sessionStorage.getItem('pal_greeted') === '1') return
      sessionStorage.setItem('pal_greeted', '1')
    } catch {}
    const t = setTimeout(() => say(quipFor(pet.mood, daySeed()), CHAPTER_BUBBLE_MS), 1200)
    return () => clearTimeout(t)
  }, [pet, hidden, say])

  // Doze off when the page hasn't turned in a while; any turn (or pat) wakes.
  // Resetting synchronously here (not in a callback) is exactly the point: the
  // wake must be immediate on the same render as the triggering turn/pat.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInactive(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setInactive(true), INACTIVITY_MS)
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [depth, patted])

  // React to the read as it happens — endings always, fear when tension spikes,
  // ordinary chapters only occasionally.
  useEffect(() => {
    if (!pet || hidden) return

    if (isEnding && !endingSpoken.current) {
      endingSpoken.current = true
      say(quipForEvent('ending', daySeed() + depth), ENDING_BUBBLE_MS)
      return
    }
    if (!isEnding) endingSpoken.current = false

    const scaredNow = (tension ?? 0) >= SCARED_TENSION
    const prev = prevDepth.current
    prevDepth.current = depth
    const turned = prev !== null && depth !== prev

    if (turned && user) bumpChaptersTogether(user.uid)

    if (scaredNow && !wasScared.current) {
      // Fear speaks the moment it sets in, not on a schedule.
      say(quipForEvent('scared', daySeed() + depth), CHAPTER_BUBBLE_MS)
    } else if (turned && !scaredNow && depth > 0 && depth % CHAPTER_QUIP_EVERY === 0) {
      say(quipForEvent('chapter', daySeed() + depth), CHAPTER_BUBBLE_MS)
    }
    wasScared.current = scaredNow
  }, [depth, isEnding, tension, pet, hidden, user, say])

  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
    if (patTimer.current) clearTimeout(patTimer.current)
  }, [])

  function pat() {
    setPatted(true)
    if (patTimer.current) clearTimeout(patTimer.current)
    patTimer.current = setTimeout(() => setPatted(false), PAT_MS)
    say(quipForEvent('pat', daySeed() + depth + (bubble ? 1 : 0)), PAT_BUBBLE_MS)
  }

  if (!user || !pet || hidden) return null

  const animation = companionAnimation({
    mood: pet.mood,
    tension,
    isEnding,
    inactive,
    patted,
  })

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

      <motion.button
        type="button"
        onClick={pat}
        animate={patted && !reduceMotion ? { rotate: [0, -8, 8, -6, 6, 0] } : { rotate: 0 }}
        transition={{ duration: 0.6 }}
        title={`${pet.name} — level ${pet.level} ${pet.stage.name}. Pat for courage.`}
        aria-label={`Your pal ${pet.name}. Pat for courage.`}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/25 bg-background/80 backdrop-blur shadow-lg transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <PalSprite
          species={pet.species}
          stageMinLevel={pet.stage.minLevel}
          fallbackEmoji={pet.stage.emoji}
          animation={animation}
          size={34}
        />
      </motion.button>

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
