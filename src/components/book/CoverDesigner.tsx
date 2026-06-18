'use client'

import { useRef, useState } from 'react'
import { Sparkles, X, Loader2, ImageOff } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { CoverTheme, CoverPattern, CoverFontStyle } from '@/types'

// ── Presets ────────────────────────────────────────────────────────────────────

export const DEFAULT_COVER: CoverTheme = {
  fromColor: '#1e0840',
  toColor: '#0a0322',
  icon: '📖',
  pattern: 'none',
  fontStyle: 'serif',
  borderFrame: 'none',
  accentColor: '#fbbf24',
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
  { id: 'none',       label: 'Plain'      },
  { id: 'stars',      label: 'Stars'      },
  { id: 'grid',       label: 'Grid'       },
  { id: 'dots',       label: 'Dots'       },
  { id: 'lines',      label: 'Filigree'   },
  { id: 'diamonds',   label: 'Diamonds'   },
  { id: 'waves',      label: 'Waves'      },
  { id: 'crosshatch', label: 'Crosshatch' },
]

const FONT_STYLES: { id: CoverFontStyle; label: string; sample: string }[] = [
  { id: 'serif',  label: 'Classic',     sample: 'Georgia, "Times New Roman", serif' },
  { id: 'gothic', label: 'Gothic',      sample: '"Palatino Linotype", Palatino, serif' },
  { id: 'script', label: 'Handwritten', sample: 'cursive' },
  { id: 'mono',   label: 'Monospace',   sample: '"Courier New", Courier, monospace' },
]

const ACCENT_PRESETS = [
  { label: 'Gold',    color: '#fbbf24' },
  { label: 'Silver',  color: '#d1d5db' },
  { label: 'Copper',  color: '#cd7f32' },
  { label: 'Crimson', color: '#ef4444' },
  { label: 'Emerald', color: '#34d399' },
  { label: 'Sapphire',color: '#60a5fa' },
  { label: 'Violet',  color: '#a78bfa' },
  { label: 'Rose',    color: '#fb7185' },
]

// ── Pattern helper ─────────────────────────────────────────────────────────────

export function patternStyle(pattern: CoverPattern): React.CSSProperties {
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
    case 'diamonds':
      return {
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 12px)',
      }
    case 'waves':
      return {
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)',
        backgroundSize: '100% 18px',
      }
    case 'crosshatch':
      return {
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 16px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 16px)',
      }
    default:
      return { backgroundImage: 'none' }
  }
}

// ── Font family helper ─────────────────────────────────────────────────────────

export function coverFontFamily(style: CoverFontStyle): string {
  switch (style) {
    case 'gothic': return '"Palatino Linotype", Palatino, "Book Antiqua", serif'
    case 'script': return 'cursive'
    case 'mono':   return '"Courier New", Courier, monospace'
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

      {/* Cover face — clean: gradient/image + title at bottom only */}
      <div
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
      </div>
    </div>
  )
}

// ── SpinePreview ───────────────────────────────────────────────────────────────

function SpinePreview({ theme, title }: { theme: CoverTheme; title: string }) {
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

interface Props {
  value: CoverTheme
  onChange: (theme: CoverTheme) => void
  title: string
  onGenerateImage?: () => Promise<string | null>
}

export function CoverDesigner({ value, onChange, title, onGenerateImage }: Props) {
  const fromRef    = useRef<HTMLInputElement>(null)
  const toRef      = useRef<HTMLInputElement>(null)
  const accentRef  = useRef<HTMLInputElement>(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [customIcon, setCustomIcon] = useState('')

  function update(partial: Partial<CoverTheme>) {
    onChange({ ...value, ...partial })
  }

  async function handleGenerateImage() {
    if (!onGenerateImage) return
    setGeneratingImage(true)
    try {
      const url = await onGenerateImage()
      if (url) {
        update({ coverImageUrl: url })
        toast.success('Cover image generated!')
      } else {
        toast.error('Image generation failed — try again')
      }
    } finally {
      setGeneratingImage(false)
    }
  }

  function handleCustomIconKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = customIcon.trim()
      if (trimmed) {
        update({ icon: trimmed })
        setCustomIcon('')
      }
    }
  }

  const accent = value.accentColor ?? '#fbbf24'

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
      {/* ── Controls ── */}
      <div className="space-y-5">

        {/* AI Cover Image */}
        {onGenerateImage && (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
              AI-Generated Cover Art
            </Label>

            {value.coverImageUrl ? (
              <div className="flex items-start gap-3">
                <div className="relative rounded-lg overflow-hidden border border-white/10 shrink-0" style={{ width: 72, height: 108 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={value.coverImageUrl}
                    alt="Generated cover"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                    AI-generated cover is active. The gradient shows as a spine accent only.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateImage}
                      disabled={generatingImage}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                    >
                      {generatingImage ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ coverImageUrl: undefined })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-white/10 text-muted-foreground/50 hover:border-white/20 hover:text-muted-foreground/70 transition-all"
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generatingImage || !title.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Cover Image
                    </>
                  )}
                </button>
                {!title.trim() && (
                  <span className="text-[10px] text-muted-foreground/35">Enter a title first</span>
                )}
                <span className="text-[10px] text-muted-foreground/25 flex items-center gap-1">
                  <ImageOff className="h-3 w-3" />
                  uses 3 credits
                </span>
              </div>
            )}
          </div>
        )}

        {/* Color gradient */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            {value.coverImageUrl ? 'Spine & Accent Gradient' : 'Cover Gradient'}
          </Label>

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
                title="Top gradient color"
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
                title="Bottom gradient color"
              />
              <span className="text-[10px] text-muted-foreground/40">Bottom</span>
            </div>
            <span className="text-[9px] text-muted-foreground/25 ml-1">
              or click a swatch above
            </span>
          </div>
        </div>

        {/* Accent color */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Title &amp; Emblem Accent
          </Label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {ACCENT_PRESETS.map((p) => {
              const active = value.accentColor === p.color
              return (
                <button
                  key={p.label}
                  type="button"
                  title={p.label}
                  onClick={() => update({ accentColor: p.color })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    active ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: p.color }}
                />
              )
            })}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => accentRef.current?.click()}
                className="w-7 h-7 rounded-full border-2 border-white/20 cursor-pointer relative overflow-hidden"
                title="Custom accent color"
                style={{ background: accent }}
              />
              <input
                ref={accentRef}
                type="color"
                value={accent}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="sr-only"
                title="Custom accent color"
              />
              <span className="text-[9px] text-muted-foreground/30">custom</span>
            </div>
          </div>
        </div>

        {/* Icon picker */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Spine Emblem
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
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value)}
              onKeyDown={handleCustomIconKeyDown}
              placeholder="Type any emoji & press Enter…"
              className="flex-1 h-8 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground/70 placeholder:text-muted-foreground/25 focus:outline-none focus:border-amber-500/30"
            />
            {customIcon.trim() && (
              <button
                type="button"
                onClick={() => {
                  update({ icon: customIcon.trim() })
                  setCustomIcon('')
                }}
                className="h-8 px-3 rounded-md text-[11px] border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                Use
              </button>
            )}
            <span className="text-[9px] text-muted-foreground/25 shrink-0">
              current: <span className="text-base leading-none">{value.icon}</span>
            </span>
          </div>
        </div>

        {/* Pattern — hidden when cover image is active */}
        {!value.coverImageUrl && (
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
        )}

        {/* Font style */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Title Font
          </Label>
          <div className="flex gap-2 flex-wrap">
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
      <div className="flex flex-col items-center gap-3 sticky top-4 md:pt-5">
        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/30 font-sans">
          Preview
        </p>
        <div className="flex gap-3 items-end">
          {/* Spine preview */}
          <div className="flex flex-col items-center gap-1.5">
            <SpinePreview theme={value} title={title} />
            <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/20 font-sans">Spine</p>
          </div>
          {/* Cover preview */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="relative pb-3"
              style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.7))' }}
            >
              <BookCoverPreview theme={value} title={title} size="md" />
              <div
                className="absolute bottom-0 inset-x-1 h-2 blur-md pointer-events-none opacity-50"
                style={{ background: '#111' }}
              />
            </div>
            <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/20 font-sans">Cover</p>
          </div>
        </div>
        <p
          className="text-[9px] text-muted-foreground/25 text-center max-w-[160px] leading-relaxed"
          style={{ fontFamily: coverFontFamily(value.fontStyle) }}
        >
          {title || 'Your story title'}
        </p>
      </div>
    </div>
  )
}
