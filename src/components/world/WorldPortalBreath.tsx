'use client'

import { motion } from 'framer-motion'

/**
 * A slow, subtle breathing/parallax pair for the banner variant of
 * `WorldPortal` — the background drifts at one pace, the emblem at another,
 * so the portal feels like a living place rather than a static image. Kept
 * out of `WorldPortal` itself so that component stays server-safe for the
 * dense `card` variant used in world listings.
 */
export function WorldPortalBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{ scale: [1, 1.025, 1] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

export function WorldPortalEmblem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
