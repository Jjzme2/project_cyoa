'use client'

import { motion } from 'framer-motion'
import type { CoverTheme } from '@/types'
import { coverFontFamily, patternStyle } from './cover-theme'
import { CoverBorder } from './cover-border'

interface PreviewProps {
  theme: CoverTheme
  title: string
  size?: 'sm' | 'md'
}

export function BookCoverPreview({ theme, title, size = 'md' }: PreviewProps) {
  const isSmall = size === 'sm'
  const spineW  = isSmall ? 'w-2.5' : 'w-3.5'
  const pad     = isSmall ? 'p-2.5' : 'p-3.5'
  const titleSz = isSmall ? 'text-[9px]' : 'text-[12px]'
  const accent  = theme.accentColor ?? '#fbbf24'

  return (
    <div
      className="relative flex rounded-sm overflow-hidden"
      style={{ aspectRatio: '2/3', width: isSmall ? 72 : 120 }}
    >
      {/* Spine (shows icon + faint title) */}
      <div
        className={`${spineW} shrink-0 relative`}
        style={{
          background: `linear-gradient(to bottom, ${theme.fromColor}, ${theme.toColor})`,
          filter: 'brightness(1.3)',
          boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.4), inset 1px 0 2px rgba(255,255,255,0.08)',
        }}
      >
        {theme.icon && !isSmall && (
          <div className="absolute top-1.5 inset-x-0 flex justify-center">
            <span className="text-[8px]" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>
              {theme.icon}
            </span>
          </div>
        )}
        <div
          className="absolute inset-x-0 top-6 bottom-2 flex items-center justify-center overflow-hidden"
          style={{ writingMode: 'vertical-rl' }}
        >
          <span className="text-[6px] opacity-20 text-white truncate px-0.5"
            style={{ fontFamily: coverFontFamily(theme.fontStyle) }}>
            {title || 'Title'}
          </span>
        </div>
      </div>

      {/* Cover face — clean: gradient/image + title at bottom only. Keyed by
          coverImageUrl so a freshly-generated (or removed) image remounts
          and plays its reveal flourish. */}
      <motion.div
        key={theme.coverImageUrl ?? 'gradient'}
        initial={theme.coverImageUrl ? { opacity: 0, scale: 1.06 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`flex-1 relative flex flex-col justify-end ${pad} overflow-hidden`}
        style={{
          background: theme.coverImageUrl
            ? `url(${theme.coverImageUrl}) center/cover no-repeat`
            : `linear-gradient(to bottom right, ${theme.fromColor}, ${theme.toColor})`,
        }}
      >
        {theme.coverImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 35%, rgba(0,0,0,0.70) 100%)` }}
          />
        )}
        {!theme.coverImageUrl && (
          <div className="absolute inset-0 pointer-events-none" style={patternStyle(theme.pattern)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />

        <CoverBorder frame={theme.borderFrame} accent={accent} corner={isSmall ? 0 : 9} />

        <h3
          className={`${titleSz} leading-snug line-clamp-3 relative z-10`}
          style={{
            fontFamily: coverFontFamily(theme.fontStyle),
            color: accent,
            textShadow: theme.coverImageUrl ? `0 1px 3px rgba(0,0,0,0.9)` : `0 0 8px ${accent}40`,
          }}
        >
          {title || 'Untitled Story'}
        </h3>

        <div className="absolute right-0 top-0 bottom-0 w-px bg-white/8 z-10" />
      </motion.div>
    </div>
  )
}

// ── SpinePreview ───────────────────────────────────────────────────────────────

export function SpinePreview({ theme, title }: { theme: CoverTheme; title: string }) {
  const accent = theme.accentColor ?? '#fbbf24'
  return (
    <div
      className="relative overflow-hidden rounded-[2px]"
      style={{
        width: 38,
        height: 160,
        background: `linear-gradient(to bottom, ${theme.fromColor}, ${theme.toColor})`,
        filter: 'brightness(1.3)',
        boxShadow:
          'inset -3px 0 8px rgba(0,0,0,0.45), inset 1px 0 2px rgba(255,255,255,0.12), 2px 2px 10px rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20" />
      {theme.pattern !== 'none' && (
        <div className="absolute inset-0 pointer-events-none opacity-40" style={patternStyle(theme.pattern)} />
      )}
      {theme.icon && (
        <div className="absolute top-2.5 inset-x-0 flex justify-center">
          <span className="text-[11px]" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}>
            {theme.icon}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 top-8 bottom-6 flex items-center justify-center overflow-hidden">
        <span
          className="text-[10px] leading-none tracking-wide"
          style={{
            writingMode: 'vertical-rl',
            color: accent,
            fontFamily: coverFontFamily(theme.fontStyle),
            textShadow: `0 1px 4px rgba(0,0,0,0.7)`,
          }}
        >
          {title || 'Your story title'}
        </span>
      </div>
      <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
        <span className="text-[6px] text-white/20 font-sans" style={{ writingMode: 'vertical-rl' }}>
          Author
        </span>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-black/30 to-transparent" />
    </div>
  )
}

// ── CoverDesigner ──────────────────────────────────────────────────────────────

