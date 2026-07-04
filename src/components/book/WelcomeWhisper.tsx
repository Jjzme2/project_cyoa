'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, X } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { trackEvent } from '@/lib/track-client'

const SEEN_KEY = 'chronicle:welcomed'

/**
 * The first-run whisper for someone who "jumped right in" — one warm line, not
 * a tour. Shows once (per browser) when the reader arrived via ?welcome=1, and
 * never again after dismissal.
 */
export function WelcomeWhisper() {
  const params = useSearchParams()
  const { user } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (params.get('welcome') !== '1') return
    try {
      if (localStorage.getItem(SEEN_KEY)) return
    } catch {}
    // Post-mount, external-store read — intentional one-shot.
    const t = setTimeout(() => {
      setShow(true)
      void trackEvent(user, 'onboarding.welcome_shown')
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on arrival
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {}
    setShow(false)
    void trackEvent(user, 'onboarding.welcome_dismissed')
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)]"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-stone-950/95 backdrop-blur px-4 py-3.5 shadow-2xl">
            <BookOpen className="h-4 w-4 text-amber-300/80 mt-0.5 shrink-0" />
            <p className="text-sm text-stone-200/90 leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
              Read. Choose. And when you reach a path no one has written&hairsp;—&hairsp;
              <em className="text-amber-200/90">write what happens next.</em>
            </p>
            <button onClick={dismiss} aria-label="Dismiss" className="p-1 -m-1 text-stone-400 hover:text-stone-200 transition-colors shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
