'use client'

import { useRef } from 'react'
import { Dices, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import type { WorldTheme, AmbientEffect } from '@/types'
import { BORDER_FRAMES, CoverBorder } from '@/components/book/cover-border'
import { WorldPortal } from './WorldPortal'
import {
  WORLD_GRADIENTS,
  WORLD_ACCENTS,
  WORLD_EMBLEMS,
  WORLD_PATTERNS,
  TONE_ATMOSPHERES,
  themeForTone,
  rollWorldTheme,
} from './world-theme'

const ATMOSPHERES: { id: AmbientEffect; label: string; emoji: string }[] = [
  { id: 'none',      label: 'Still',     emoji: '—'  },
  { id: 'rain',      label: 'Rain',      emoji: '🌧️' },
  { id: 'embers',    label: 'Embers',    emoji: '🔥' },
  { id: 'stars',     label: 'Starfall',  emoji: '✨' },
  { id: 'snow',      label: 'Snow',      emoji: '❄️' },
  { id: 'fireflies', label: 'Fireflies', emoji: '🪲' },
  { id: 'petals',    label: 'Petals',    emoji: '🌸' },
  { id: 'mist',      label: 'Mist',      emoji: '🌫️' },
  { id: 'motes',     label: 'Motes',     emoji: '🌬️' },
]

interface Props {
  value: WorldTheme
  onChange: (theme: WorldTheme) => void
  name: string
  tone: string
}

export function WorldThemeDesigner({ value, onChange, name, tone }: Props) {
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const accentRef = useRef<HTMLInputElement>(null)

  function update(partial: Partial<WorldTheme>) {
    onChange({ ...value, ...partial })
  }

  const hasToneMatch = Boolean(TONE_ATMOSPHERES[tone])

  return (
    <div className="space-y-5">
      {/* Live portal preview */}
      <WorldPortal theme={value} name={name || 'Your World'} tagline={tone} variant="banner" />

      {/* Action row */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onChange(rollWorldTheme(value))
            toast.success('A new world shimmers into view')
          }}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition-all"
        >
          <Dices className="h-3.5 w-3.5 transition-transform group-hover:rotate-[20deg]" />
          Surprise me
        </button>
        {hasToneMatch && (
          <button
            type="button"
            onClick={() => {
              onChange(themeForTone(tone, value))
              toast.success(`Atmosphere tuned to ${tone}`)
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Match “{tone}”
          </button>
        )}
      </div>

      {/* Gradient */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Portal Gradient</Label>
        <div className="grid grid-cols-6 gap-1.5">
          {WORLD_GRADIENTS.map((g) => {
            const active = value.fromColor === g.from && value.toColor === g.to
            return (
              <button
                key={g.label}
                type="button"
                title={g.label}
                onClick={() => update({ fromColor: g.from, toColor: g.to })}
                className={`h-8 rounded-md transition-all border-2 ${active ? 'border-amber-400 scale-105' : 'border-transparent hover:scale-105'}`}
                style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
              />
            )
          })}
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fromRef.current?.click()} className="w-7 h-7 rounded-md border border-white/20 cursor-pointer" style={{ background: value.fromColor }} title="Top color" />
            <input ref={fromRef} type="color" value={value.fromColor} onChange={(e) => update({ fromColor: e.target.value })} className="sr-only" title="Top gradient color" />
            <span className="text-[10px] text-muted-foreground/40">Top</span>
          </div>
          <div className="w-8 h-px bg-white/10" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toRef.current?.click()} className="w-7 h-7 rounded-md border border-white/20 cursor-pointer" style={{ background: value.toColor }} title="Bottom color" />
            <input ref={toRef} type="color" value={value.toColor} onChange={(e) => update({ toColor: e.target.value })} className="sr-only" title="Bottom gradient color" />
            <span className="text-[10px] text-muted-foreground/40">Bottom</span>
          </div>
        </div>
      </div>

      {/* Accent */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Accent</Label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {WORLD_ACCENTS.map((p) => (
            <button
              key={p.label}
              type="button"
              title={p.label}
              onClick={() => update({ accentColor: p.color })}
              className={`w-7 h-7 rounded-full border-2 transition-all ${value.accentColor === p.color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ background: p.color }}
            />
          ))}
          <button type="button" onClick={() => accentRef.current?.click()} className="w-7 h-7 rounded-full border-2 border-white/20 cursor-pointer ml-1" title="Custom accent" style={{ background: value.accentColor }} />
          <input ref={accentRef} type="color" value={value.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="sr-only" title="Custom accent color" />
        </div>
      </div>

      {/* Emblem */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Emblem</Label>
        <div className="grid grid-cols-8 gap-1">
          {WORLD_EMBLEMS.map((emblem) => (
            <button
              key={emblem}
              type="button"
              onClick={() => update({ emblem })}
              className={`h-8 text-lg rounded-md transition-all flex items-center justify-center ${value.emblem === emblem ? 'bg-amber-500/20 border border-amber-500/40 scale-110' : 'hover:bg-white/[0.06] border border-transparent'}`}
            >
              {emblem}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Pattern</Label>
        <div className="flex gap-2 flex-wrap">
          {WORLD_PATTERNS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => update({ pattern: p.id })}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${value.pattern === p.id ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-white/10 text-muted-foreground/40 hover:border-white/20'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Atmosphere */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Atmosphere</Label>
        <div className="flex flex-wrap gap-2">
          {ATMOSPHERES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => update({ ambientEffect: e.id })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${value.ambientEffect === e.id ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-white/10 text-muted-foreground/40 hover:border-white/20'}`}
            >
              <span>{e.emoji}</span>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Border frame */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Border Frame</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {BORDER_FRAMES.map((b) => {
            const active = (value.borderFrame ?? 'none') === b.id
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => update({ borderFrame: b.id })}
                title={b.label}
                className={`relative h-12 rounded-lg border transition-all flex items-center justify-center overflow-hidden ${active ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="absolute inset-1.5 rounded-[3px]" style={{ background: `linear-gradient(135deg, ${value.fromColor}, ${value.toColor})` }}>
                  <CoverBorder frame={b.id} accent={value.accentColor} insetPct={10} corner={b.corner ? 7 : 0} />
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
  )
}
