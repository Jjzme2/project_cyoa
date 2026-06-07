'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { ImagePlus } from 'lucide-react'

interface Props {
  content: string
  depth: number
  choiceText?: string | null
  imageUrl?: string | null
}

export function StoryContent({ content, depth, choiceText, imageUrl }: Props) {
  const paragraphs = content.split('\n').filter((p) => p.trim())

  return (
    <motion.div
      key={content}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
      className="flex flex-col h-full overflow-hidden"
    >
      {choiceText && (
        <p className="text-xs italic mb-5 pb-4 border-b border-amber-900/20 opacity-55">
          ❝ {choiceText} ❞
        </p>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-[9px] uppercase tracking-[0.25em] opacity-35 font-sans">
          Chapter {depth + 1}
        </p>
        {imageUrl && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans font-medium tracking-wider uppercase border select-none"
            style={{
              background: 'oklch(0.40 0.12 140 / 12%)',
              borderColor: 'oklch(0.45 0.12 140 / 25%)',
              color: 'oklch(0.48 0.12 140)',
            }}
          >
            <ImagePlus className="h-2.5 w-2.5" />
            Illustrated
          </span>
        )}
      </div>

      {imageUrl && (
        <div className="relative w-full mb-4 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <Image
            src={imageUrl}
            alt="Story illustration"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[15px] leading-[1.9]"
            style={{ textIndent: i === 0 ? '1.5em' : undefined }}
          >
            {p}
          </p>
        ))}
      </div>

      <div className="mt-6 text-center opacity-20 select-none text-sm">❧</div>
    </motion.div>
  )
}
