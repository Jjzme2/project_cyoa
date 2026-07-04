'use client'

import { Clapperboard, RotateCcw, Shuffle, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DirectorPersona } from '@/types'
import {
  DIRECTOR_AXES,
  DIRECTOR_ARCHETYPES,
  describeDirector,
  emptyDirector,
  isDirectorMeaningful,
  personaMatches,
  surpriseDirector,
  type DirectorArchetype,
} from '@/lib/director'

/**
 * Authoring control for the story "Director" — archetype presets, per-axis
 * sliders, a vision line, and a live preview of the guidance the AI receives.
 * Fully controlled via `value`/`onChange`; shared by the story and saga creators.
 */
export function DirectorControls({
  value,
  onChange,
}: {
  value: DirectorPersona
  onChange: (next: DirectorPersona) => void
}) {
  const notes = describeDirector(value)
  const touched = isDirectorMeaningful(value)

  function applyArchetype(a: DirectorArchetype) {
    onChange(personaMatches(value, a.persona) ? emptyDirector() : { ...emptyDirector(), ...a.persona })
  }

  return (
          <div className="space-y-4 border-t border-white/[0.06] pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-amber-400/60" />
                  Director{' '}
                  <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
                </Label>
                <p className="text-[11px] text-muted-foreground/45 mt-1 max-w-md">
                  Shape <em>how</em> each chapter is directed — its craft, mood, and pacing.
                  Always stays within your content rating.
                </p>
              </div>
              {touched && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(emptyDirector())}
                  className="h-7 px-2 shrink-0 text-[11px] text-muted-foreground/50 hover:text-muted-foreground gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              )}
            </div>

            {/* Archetype presets — one click to a recognizable sensibility */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-sans">
                  Start from a style
                </p>
                <button
                  type="button"
                  onClick={() => onChange(surpriseDirector())}
                  title="Land on a random, coherent style to start from"
                  className="flex items-center gap-1 text-[11px] font-sans text-muted-foreground/50 hover:text-amber-200/80 transition-colors"
                >
                  <Shuffle className="h-3 w-3" /> Surprise me
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIRECTOR_ARCHETYPES.map((a) => {
                  const active = personaMatches(value, a.persona)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => applyArchetype(a)}
                      title={a.tagline}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${
                        active
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                          : 'border-white/10 text-muted-foreground/55 hover:border-amber-500/25 hover:text-amber-200/80'
                      }`}
                    >
                      <span>{a.emoji}</span>
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Fine-tune each axis */}
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3 pt-1">
              {DIRECTOR_AXES.map((axis) => {
                const v = value[axis.key] ?? 0
                return (
                  <div key={axis.key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <span className={v < -0.3 ? 'text-amber-300/80' : 'text-muted-foreground/55'}>
                        {axis.left}
                      </span>
                      <span className={v > 0.3 ? 'text-amber-300/80' : 'text-muted-foreground/55'}>
                        {axis.right}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.1}
                      value={v}
                      onChange={(e) => onChange({ ...value, [axis.key]: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                      aria-label={`${axis.left} to ${axis.right}`}
                    />
                    <p className="text-[10px] text-muted-foreground/35">{axis.hint}</p>
                  </div>
                )
              })}
            </div>

            <Input
              placeholder="Optional: a one-line directorial vision (e.g. “a tender story about quiet courage”)"
              value={value.vision ?? ''}
              onChange={(e) => onChange({ ...value, vision: e.target.value })}
              maxLength={300}
            />

            {/* Live preview — exactly the guidance the AI will receive */}
            {notes.length > 0 ? (
              <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3.5 py-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-amber-400/60 font-sans flex items-center gap-1.5">
                  <Wand2 className="h-3 w-3" /> How your director will shape each chapter
                </p>
                <ul className="space-y-1">
                  {notes.map((n, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground/65 leading-snug flex gap-1.5">
                      <span className="text-amber-400/50 shrink-0">›</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/35 italic">
                Neutral — the AI directs with its own instincts. Pick a style above or nudge a slider to guide it.
              </p>
            )}
          </div>
  )
}
