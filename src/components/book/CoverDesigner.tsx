'use client'

import { useRef } from 'react'
import { BookOpen } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { CoverTheme, CoverPattern, CoverFontStyle } from '@/types'

// ── Presets ────────────────────────────────────────────────────────────────────

export const DEFAULT_COVER: CoverTheme = {
  fromColor: '#1e0840',
  toColor: '#0a0322',
  icon: '📖',
  pattern: 'none',
  fontStyle: 'serif',
}

const COLOR_PRESETS = [
  { label: 'Twilight',  from: '#1e0840', to: '#0a0322' },
  { label: 'Ember',     from: '#3d1200', to: '#180700' },
  { label: 'Abyss',     from: '#001838', to: '#000c18' },
  { label: 'Jade',      from: '#001e10', to: '#000a06' },
  { label: 'Crimson',   from: '#3d0012', to: '#180007' },
  { label: 'Obsidian',  from: '#18182e', to: '#08080f' },
  { label: 'Bronze',    from: '#2d1800', to: '#120b00' },
  { label: 'Frost',     from: '#00182d', to: '#00090f' },
  { label: 'Dusk',      from: '#280a2e', to: '#0f0412' },
  { label: 'Forest',    from: '#001a08', to: '#000703' },
  { label: 'Volcano',   from: '#3d0e00', to: '#150400' },
  { label: 'Midnight',  from: '#050520', to: '#02020c' },
]

const COVER_ICONS = [
  '📖', '🐉', '🗡️', '👑', '🔮', '⚔️', '🏰', '🧙',
  '🦄', '🌙', '⚡', '🌊', '🌿', '🌸', '🌲', '🦅',
  '☀️', '⭐', '🌋', '🔍', '🕯️', '🗝️', '💀', '🦇',
  '🚀', '🌌', '🤖', '💫', '🌀', '🌹', '✨', '🦊',
  '🐺', '🌪️', '⚓', '🗺️', '🪄', '🔥', '💎', '🌺',
  '🦁', '🐦', '⚜️', '🌠', '🏹', '🧪', '🌑', '🫀',
]

const PATTERNS: { id: CoverPattern; label: string }[] = [
  { id: 'none',  label: 'Plain'  },
  { id: 'stars', label: 'Stars'  },
  { id: 'grid',  label: 'Grid'   },
  { id: 'dots',  label: 'Dots'   },
  { id: 'lines', label: 'Filigree' },
]

const FONT_STYLES: { id: CoverFontStyle; label: string; sample: string }[] = [
  { id: 'serif',  label: 'Classic',     sample: 'Georgia, "Times New Roman", serif' },
  { id: 'gothic', label: 'Gothic',      sample: '"Palatino Linotype", Palatino, serif' },
  { id: 'script', label: 'Handwritten', sample: 'cursive' },
]

// ── Pattern helper ─────────────────────────────────────────────────────────────

function patternStyle(pattern: CoverPattern): React.CSSProperties {
  switch (pattern) {
    case 'stars':
      return {
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }
    case 'grid':
      return {
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }
    case 'dots':
      return {
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)',
        backgroundSize: '14px 14px',
      }
    case 'lines':
      return {
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)',
      }
    default:
      return {}
  }
}

// ── Font family helper ─────────────────────────────────────────────────────────

export function coverFontFamily(style: CoverFontStyle): string {
  switch (style) {
    case 'gothic': return '"Palatino Linotype", Palatino, "Book Antiqua", serif'
    case 'script': return 'cursive'
    default:       return 'Georgia, "Times New Roman", serif'
  }
}

// ── BookCoverPreview ───────────────────────────────────────────────────────────

interface PreviewProps {
  theme: CoverTheme
  title: string
  size?: 'sm' | 'md'
}

export function BookCoverPreview({ theme, title, size = 'md' }: PreviewProps) {
  const isSmall = size === 'sm'
  const spineW  = isSmall ? 'w-2.5' : 'w-3.5'
  const pad     = isSmall ? 'p-2' : 'p-3'
  const iconSz  = isSmall ? 'text-xl' : 'text-3xl'
  const titleSz = isSmall ? 'text-[9px]' : 'text-[12px]'

  return (
    <div
      className="relative flex rounded-sm overflow-hidden"
      style={{ aspectRatio: '2/3', width: isSmall ? 72 : 120 }}
    >
      {/* Spine */}
      <div
        className={`${spineW} shrink-0 relative`}
        style={{
          background: `linear-gradient(to bottom, ${theme.fromColor}, ${theme.toColor})`,
          filter: 'brightness(1.3)',
          boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.4), inset 1px 0 2px rgba(255,255,255,0.08)',
        }}
      />
      {/* Cover */}
      <div
        className={`flex-1 relative flex flex-col justify-between ${pad} overflow-hidden`}
        style={{
          background: `linear-gradient(to bottom right, ${theme.fromColor}, ${theme.toColor})`,
          ...patternStyle(theme.pattern),
        }}
      >
        {/* Pattern overlay blends atop gradient */}
        <div className="absolute inset-0 pointer-events-none" style={patternStyle(theme.pattern)} />

        <span className="text-[6px] uppercase tracking-[0.2em] text-white/25 font-sans relative z-10">
          Chronicle
        </span>

        <div className="flex items-center justify-center flex-1 py-1 relative z-10">
          <span className={iconSz}>{theme.icon}</span>
        </div>

        <h3
          className={`${titleSz} leading-snug text-white/90 line-clamp-3 relative z-10`}
          style={{ fontFamily: coverFontFamily(theme.fontStyle) }}
        >
          {title || 'Untitled Story'}
        </h3>

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

// ── CoverDesigner ──────────────────────────────────────────────────────────────

interface Props {
  value: CoverTheme
  onChange: (theme: CoverTheme) => void
  title: string
}

export function CoverDesigner({ value, onChange, title }: Props) {
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef   = useRef<HTMLInputElement>(null)

  function update(partial: Partial<CoverTheme>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
      {/* ── Controls ── */}
      <div className="space-y-5">

        {/* Color gradient */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Cover Gradient
          </Label>

          {/* Preset swatches */}
          <div className="grid grid-cols-6 gap-1.5">
            {COLOR_PRESETS.map((p) => {
              const active = value.fromColor === p.from && value.toColor === p.to
              return (
                <button
                  key={p.label}
                  type="button"
                  title={p.label}
                  onClick={() => update({ fromColor: p.from, toColor: p.to })}
                  className={`h-8 rounded-md transition-all border-2 ${
                    active ? 'border-amber-400 scale-105' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                />
              )
            })}
          </div>

          {/* Custom pickers */}
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fromRef.current?.click()}
                className="w-7 h-7 rounded-md border border-white/20 cursor-pointer"
                style={{ background: value.fromColor }}
                title="Top color"
              />
              <input
                ref={fromRef}
                type="color"
                value={value.fromColor}
                onChange={(e) => update({ fromColor: e.target.value })}
                className="sr-only"
              />
              <span className="text-[10px] text-muted-foreground/40">Top</span>
            </div>
            <div className="w-8 h-px bg-white/10" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toRef.current?.click()}
                className="w-7 h-7 rounded-md border border-white/20 cursor-pointer"
                style={{ background: value.toColor }}
                title="Bottom color"
              />
              <input
                ref={toRef}
                type="color"
                value={value.toColor}
                onChange={(e) => update({ toColor: e.target.value })}
                className="sr-only"
              />
              <span className="text-[10px] text-muted-foreground/40">Bottom</span>
            </div>
            <span className="text-[9px] text-muted-foreground/25 ml-1">
              or click a swatch above
            </span>
          </div>
        </div>

        {/* Icon picker */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Cover Emblem
          </Label>
          <div className="grid grid-cols-8 gap-1">
            {COVER_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => update({ icon })}
                className={`h-8 text-lg rounded-md transition-all flex items-center justify-center ${
                  value.icon === icon
                    ? 'bg-amber-500/20 border border-amber-500/40 scale-110'
                    : 'hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Pattern */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Background Pattern
          </Label>
          <div className="flex gap-2 flex-wrap">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => update({ pattern: p.id })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${
                  value.pattern === p.id
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'border-white/10 text-muted-foreground/40 hover:border-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font style */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Title Font
          </Label>
          <div className="flex gap-2">
            {FONT_STYLES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => update({ fontStyle: f.id })}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                  value.fontStyle === f.id
                    ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                    : 'border-white/10 text-muted-foreground/40 hover:border-white/20'
                }`}
                style={{ fontFamily: f.sample }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Preview ── */}
      <div className="flex flex-col items-center gap-2 sticky top-4 md:pt-5">
        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/30 font-sans">
          Preview
        </p>
        <div
          className="relative pb-3"
          style={{
            filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.7))',
          }}
        >
          <BookCoverPreview theme={value} title={title} size="md" />
          {/* Shelf shadow */}
          <div
            className="absolute bottom-0 inset-x-1 h-2 blur-md pointer-events-none opacity-50"
            style={{ background: '#111' }}
          />
        </div>
        <p
          className="text-[9px] text-muted-foreground/25 text-center max-w-[130px] leading-relaxed"
          style={{ fontFamily: coverFontFamily(value.fontStyle) }}
        >
          {title || 'Your story title'}
        </p>
      </div>
    </div>
  )
}
