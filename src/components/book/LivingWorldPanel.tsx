'use client'

import { useState } from 'react'
import { Activity, ChevronDown, Swords, Coins, Users } from 'lucide-react'
import { tensionLabel, hasPulse } from '@/lib/engine/world-pulse'
import type { WorldPulse } from '@/types'

/**
 * Reader-facing "Living World" panel — makes the simulation visible. Renders the
 * server-computed {@link WorldPulse} (tension, factions, economy, cast mood) as a
 * compact, collapsible card themed to the current page colours. Shows nothing
 * when there's no pulse yet (e.g. the opening chapter).
 */
export function LivingWorldPanel({ pulse }: { pulse?: WorldPulse }) {
  const [open, setOpen] = useState(false)
  if (!hasPulse(pulse)) return null

  const pct = Math.round(pulse.tension * 100)
  // Dramatic worlds shift calm → fevered (green → red); gentle worlds read the
  // same curve as anticipation and warm from green → gold instead.
  const hue = pulse.gentle
    ? Math.round(140 - pulse.tension * 60) // 140 (green) → 80 (gold)
    : Math.round(140 - pulse.tension * 140) // 140 (green) → 0 (red)
  const tensionColor = `oklch(0.62 0.17 ${hue})`

  const border = 'color-mix(in oklch, var(--page-text) 16%, transparent)'
  const faint = 'color-mix(in oklch, var(--page-text) 6%, transparent)'

  return (
    <div className="rounded-lg border text-[12px]" style={{ borderColor: border, background: faint, color: 'var(--page-text)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 font-sans"
      >
        <Activity className="h-3.5 w-3.5" style={{ color: tensionColor }} />
        <span className="uppercase tracking-widest text-[10px] opacity-60">Living world</span>
        <span className="opacity-80" style={{ color: tensionColor }}>{tensionLabel(pulse.tension, pulse.gentle)}</span>
        <ChevronDown className={`h-3.5 w-3.5 ml-auto opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide opacity-55 font-sans">
              <span>{pulse.gentle ? 'Anticipation' : 'Tension'}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: faint }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tensionColor }} />
            </div>
          </div>

          {pulse.factions && <PulseRow icon={Swords} label="Powers" text={pulse.factions} />}
          {pulse.economy && <PulseRow icon={Coins} label="Markets" text={pulse.economy} />}
          {pulse.cast && <PulseRow icon={Users} label="The cast" text={pulse.cast} />}
        </div>
      )}
    </div>
  )
}

function PulseRow({ icon: Icon, label, text }: { icon: typeof Swords; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 opacity-50 shrink-0" />
      <div>
        <span className="opacity-50 font-sans text-[10px] uppercase tracking-wide mr-1.5">{label}</span>
        <span className="opacity-85" style={{ fontFamily: 'Georgia, serif' }}>{text}</span>
      </div>
    </div>
  )
}
