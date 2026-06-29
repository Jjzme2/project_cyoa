'use client'

import { motion } from 'framer-motion'
import { Crown, HeartCrack, Sparkles, Moon, Flower2 } from 'lucide-react'
import { ShareImageButton } from '@/components/share/ShareImageButton'
import type { EndingType } from '@/types'

const TYPE_META: Record<EndingType, { label: string; icon: typeof Crown; accent: string }> = {
  triumphant: { label: 'A Triumphant End', icon: Crown, accent: '#f5d896' },
  tragic: { label: 'A Tragic End', icon: HeartCrack, accent: '#f08a8a' },
  bittersweet: { label: 'A Bittersweet End', icon: Flower2, accent: '#c4a3e8' },
  mysterious: { label: 'A Mysterious End', icon: Moon, accent: '#7fd1d1' },
  secret: { label: 'A Secret Ending', icon: Sparkles, accent: '#6ee7b7' },
}

/**
 * The "The End" reveal for a definitive, typed ending — an animated, type-themed
 * close with the ending's title and a share CTA (the shareable ending card is the
 * viral payoff). Shown in place of choices on a terminal chapter.
 */
export function EndingReveal({
  storyId,
  nodeId,
  title,
  type,
  discovered,
  total,
}: {
  storyId: string
  nodeId: string
  title: string
  type: EndingType
  discovered: number
  total?: number
}) {
  const meta = TYPE_META[type] ?? TYPE_META.bittersweet
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center text-center py-6"
      style={{ color: 'var(--page-text)' }}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 140, damping: 12 }}
        className="flex items-center justify-center h-14 w-14 rounded-full mb-3"
        style={{ background: `${meta.accent}22`, border: `1px solid ${meta.accent}66` }}
      >
        <Icon className="h-7 w-7" style={{ color: meta.accent }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[10px] uppercase tracking-[0.35em] font-sans opacity-55"
        style={{ color: meta.accent }}
      >
        {meta.label}
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-2xl sm:text-3xl font-bold mt-2"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {title}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-1 text-[11px] font-sans tracking-widest uppercase opacity-40"
      >
        ❦ The End ❦
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-5 flex flex-col items-center gap-2"
      >
        <ShareImageButton
          cardUrl={`/api/share-card/story/${storyId}?node=${nodeId}`}
          filename={`chronicle-ending-${nodeId}`}
          shareTitle={title}
          label="Share this ending"
        />
        <span className="text-[11px] font-sans opacity-45">
          {total ? `Ending ${discovered} of ${total} discovered` : `${discovered} ending${discovered === 1 ? '' : 's'} discovered`}
        </span>
      </motion.div>
    </motion.div>
  )
}
