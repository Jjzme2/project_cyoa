'use client'

import { motion } from 'framer-motion'

/** A celebratory toast body (rendered via `toast.custom`) for a newly-earned
 * achievement — a spring-popped icon with a brief radiating burst behind it. */
export function AchievementUnlockToast({ icon, name }: { icon: string; name: string }) {
  return (
    <div className="relative flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-[#1a1420] shadow-lg overflow-hidden">
      <motion.div
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)' }}
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <motion.span
        className="relative text-2xl leading-none shrink-0"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 140, damping: 10 }}
      >
        {icon}
      </motion.span>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
      >
        <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-sans">Achievement unlocked</p>
        <p className="text-sm font-semibold text-amber-100">{name}</p>
      </motion.div>
    </div>
  )
}
