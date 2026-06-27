'use client'

import { useRef, useState } from 'react'
import { Sparkles, X, Loader2, ImageOff, Dices } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { CoverTheme } from '@/types'
import { COLOR_PRESETS, ACCENT_PRESETS, COVER_ICONS, PATTERNS, FONT_STYLES, coverFontFamily, rollCover } from './cover-theme'
import { BORDER_FRAMES, CoverBorder } from './cover-border'
import { BookCoverPreview, SpinePreview } from './BookCoverPreview'

// Re-exported for backward compatibility with existing import sites.
export { DEFAULT_COVER, patternStyle, coverFontFamily } from './cover-theme'

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

        {/* Surprise me */}
        <button
          type="button"
          onClick={() => {
            onChange(rollCover(value))
            toast.success('Cover rerolled — feeling lucky?')
          }}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition-all"
        >
          <Dices className="h-3.5 w-3.5 transition-transform group-hover:rotate-[20deg]" />
          Surprise me
        </button>

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
                  <span className="text-[10px] text-muted-foreground/55">Enter a title first</span>
                )}
                <span className="text-[10px] text-muted-foreground/45 flex items-center gap-1">
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
            <span className="text-[9px] text-muted-foreground/45 ml-1">
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
              <span className="text-[9px] text-muted-foreground/50">custom</span>
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
              className="flex-1 h-8 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground/70 placeholder:text-muted-foreground/45 focus:outline-none focus:border-amber-500/30"
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
            <span className="text-[9px] text-muted-foreground/45 shrink-0">
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

        {/* Border frame */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            Border Frame
          </Label>
          <div className="grid grid-cols-4 gap-1.5">
            {BORDER_FRAMES.map((b) => {
              const active = (value.borderFrame ?? 'none') === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => update({ borderFrame: b.id })}
                  title={b.label}
                  className={`relative h-12 rounded-lg border transition-all flex items-center justify-center overflow-hidden ${
                    active
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Tiny swatch showing the frame over the current gradient */}
                  <div
                    className="absolute inset-1.5 rounded-[3px]"
                    style={{ background: `linear-gradient(135deg, ${value.fromColor}, ${value.toColor})` }}
                  >
                    <CoverBorder frame={b.id} accent={accent} insetPct={10} corner={b.corner ? 7 : 0} />
                  </div>
                  <span className="absolute bottom-0.5 inset-x-0 text-center text-[7px] uppercase tracking-wider font-sans text-white/55">
                    {b.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Live Preview ── */}
      <div className="flex flex-col items-center gap-3 sticky top-4 md:pt-5">
        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 font-sans">
          Preview
        </p>
        <div className="flex gap-3 items-end">
          {/* Spine preview */}
          <div className="flex flex-col items-center gap-1.5">
            <SpinePreview theme={value} title={title} />
            <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/45 font-sans">Spine</p>
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
            <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/45 font-sans">Cover</p>
          </div>
        </div>
        <p
          className="text-[9px] text-muted-foreground/45 text-center max-w-[160px] leading-relaxed"
          style={{ fontFamily: coverFontFamily(value.fontStyle) }}
        >
          {title || 'Your story title'}
        </p>
      </div>
    </div>
  )
}
