'use client'

import { Feather } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { ReadingTheme, PageStyle, AmbientEffect } from '@/types'

const PAGE_STYLES: { id: PageStyle; label: string; bg: string; text: string }[] = [
  { id: 'parchment', label: 'Parchment',    bg: '#f0e6d0', text: '#3d2b1f' },
  { id: 'sepia',     label: 'Sepia',        bg: '#d4b896', text: '#2d1a0e' },
  { id: 'night',     label: 'Night Scroll', bg: '#1a1a2e', text: '#c0c8e0' },
  { id: 'forest',    label: 'Forest',       bg: '#e8f0e0', text: '#1a2d15' },
  { id: 'ocean',     label: 'Ocean',        bg: '#e0eef0', text: '#0d2535' },
  { id: 'rose',      label: 'Rose',         bg: '#f0e0e4', text: '#2d1518' },
]

const AMBIENT_EFFECTS: { id: AmbientEffect; label: string; emoji: string }[] = [
  { id: 'none',   label: 'None',      emoji: '—'  },
  { id: 'rain',   label: 'Rain',      emoji: '🌧️' },
  { id: 'embers', label: 'Embers',    emoji: '🔥' },
  { id: 'stars',  label: 'Starfall',  emoji: '✨' },
  { id: 'snow',   label: 'Snow',      emoji: '❄️' },
]

/** Reader-facing page style + ambient effect picker (controlled). */
export function ReadingThemePicker({
  value,
  onChange,
}: {
  value: ReadingTheme
  onChange: (next: ReadingTheme) => void
}) {
  return (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Feather className="h-4 w-4 text-amber-400/55" />
            Reading Atmosphere
            <span className="text-muted-foreground/55 font-normal text-xs">(readers will see this)</span>
          </h2>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Page Style</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PAGE_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ ...value, pageStyle: s.id })}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                    value.pageStyle === s.id
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className="w-8 h-10 rounded-sm shadow-inner"
                    style={{ background: s.bg }}
                  >
                    <div className="w-full h-full flex flex-col justify-end p-1 gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-px rounded-full opacity-30" style={{ background: s.text }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[9px] font-sans text-muted-foreground/50">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Ambient Effect</Label>
            <div className="flex flex-wrap gap-2">
              {AMBIENT_EFFECTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onChange({ ...value, ambientEffect: e.id })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${
                    value.ambientEffect === e.id
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'border-white/10 text-muted-foreground/40 hover:border-white/20'
                  }`}
                >
                  <span>{e.emoji}</span>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>
  )
}
