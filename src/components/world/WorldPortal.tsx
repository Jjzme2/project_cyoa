import type { WorldTheme } from '@/types'
import { patternStyle } from '@/components/book/cover-theme'
import { CoverBorder } from '@/components/book/cover-border'
import { ContainedAmbient } from '@/components/book/ContainedAmbient'

interface Props {
  theme: WorldTheme
  /** Optional name overlaid on the portal (cards omit it; heroes may show it). */
  name?: string
  tagline?: string
  /** banner = full-width hero; card = compact header strip. */
  variant?: 'banner' | 'card'
  /** Render the drifting particle layer. Off by default for dense lists. */
  animate?: boolean
  className?: string
}

/**
 * A world's atmospheric "portal": gradient + pattern + drifting ambience +
 * emblem + frame. Purely presentational; safe to render on the server (the
 * animated layer is a client component).
 */
export function WorldPortal({ theme, name, tagline, variant = 'card', animate = true, className }: Props) {
  const isBanner = variant === 'banner'
  const accent = theme.accentColor || '#fbbf24'
  const emblemSize = isBanner ? 'text-5xl sm:text-6xl' : 'text-3xl'

  return (
    <div
      className={`relative overflow-hidden ${isBanner ? 'rounded-2xl' : 'rounded-lg'} ${className ?? ''}`}
      style={{
        background: `linear-gradient(140deg, ${theme.fromColor}, ${theme.toColor})`,
        height: isBanner ? 184 : 96,
      }}
    >
      {/* Pattern */}
      {theme.pattern !== 'none' && (
        <div className="absolute inset-0 pointer-events-none opacity-60" style={patternStyle(theme.pattern)} />
      )}

      {/* Drifting atmosphere */}
      {animate && <ContainedAmbient effect={theme.ambientEffect} density={isBanner ? 1.2 : 0.7} />}

      {/* Vignette for legibility */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/55 via-transparent to-black/15" />

      {/* Frame */}
      <CoverBorder frame={theme.borderFrame} accent={accent} insetPct={isBanner ? 4 : 7} corner={isBanner ? 16 : 9} />

      {/* Emblem */}
      <div className={`absolute inset-0 flex items-center justify-center ${name ? 'opacity-25' : 'opacity-90'}`}>
        <span className={emblemSize} style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}>
          {theme.emblem}
        </span>
      </div>

      {/* Optional name / tagline overlay */}
      {name && (
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 z-10">
          <h2
            className="font-bold leading-tight text-2xl sm:text-3xl"
            style={{ color: accent, fontFamily: 'Georgia, serif', textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}
          >
            {name}
          </h2>
          {tagline && (
            <p className="text-white/70 text-xs sm:text-sm mt-1 line-clamp-1 max-w-2xl">{tagline}</p>
          )}
        </div>
      )}
    </div>
  )
}
