'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, X } from 'lucide-react'

const SEEN_KEY = 'chronicle:sound-notice-seen'

/**
 * A one-time, session-scoped heads-up that stories have sound — shown before
 * the reader's first page-turn can startle them. Page-turn sound defaults ON
 * (ambient soundscapes are already opt-in), so the very first choice a
 * newcomer makes would otherwise make unexpected noise with no warning.
 *
 * sessionStorage (not localStorage): "for the session" — a fresh tab/session
 * sees it again, matching the ask, without nagging within one visit.
 */
export function FirstSoundNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return
    } catch {
      return
    }
    const showTimer = setTimeout(() => setShow(true), 300)
    const hideTimer = setTimeout(() => dismiss(), 6300)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  function dismiss() {
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {}
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[calc(100%-2rem)]"
        >
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-stone-950/95 backdrop-blur px-3.5 py-2.5 shadow-xl">
            <Volume2 className="h-3.5 w-3.5 text-amber-300/75 shrink-0" />
            <p className="text-[12px] text-stone-300/85 leading-snug">
              This story has soft sound effects — mute anytime with the speaker icon.
            </p>
            <button onClick={dismiss} aria-label="Dismiss" className="p-1 -m-1 text-stone-400 hover:text-stone-200 transition-colors shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
