'use client'

import { motion, useReducedMotion } from 'framer-motion'

/**
 * A slow, subtle breathing/parallax pair for the banner variant of
 * `WorldPortal` — the background drifts at one pace, the emblem at another,
 * so the portal feels like a living place rather than a static image. Kept
 * out of `WorldPortal` itself so that component stays server-safe for the
 * dense `card` variant used in world listings.
 *
 * Both honor `prefers-reduced-motion`: when set, they render static (no
 * infinite framer-motion loop ticking the main thread).
 */
export function WorldPortalBackdrop({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="absolute inset-0"
      animate={reduce ? undefined : { scale: [1, 1.025, 1] }}
      transition={reduce ? undefined : { duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

export function WorldPortalEmblem({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -3, 0] }}
      transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
