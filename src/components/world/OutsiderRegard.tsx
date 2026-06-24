import { Compass, TrendingUp, TrendingDown } from 'lucide-react'
import type { OutsiderRegard as Regard, OutsiderTier } from '@/lib/firestore-helpers'

const TIERS: Record<OutsiderTier, { label: string; blurb: string; color: string; bar: string }> = {
  reviled: {
    label: 'Reviled',
    blurb: 'This world has been wronged by outsiders. Strangers from beyond are met with suspicion, barred doors, and old grievance.',
    color: 'text-red-400/80 border-red-500/25 bg-red-500/10',
    bar: 'bg-red-500/60',
  },
  distrusted: {
    label: 'Distrusted',
    blurb: 'Outsiders have left a sour mark here. Newcomers are watched warily and welcomes given grudgingly.',
    color: 'text-orange-300/80 border-orange-500/25 bg-orange-500/10',
    bar: 'bg-orange-500/60',
  },
  unknown: {
    label: 'Unknown',
    blurb: 'Outsiders are an untested novelty — regarded with cautious curiosity, neither trusted nor feared.',
    color: 'text-slate-300/70 border-slate-400/20 bg-slate-400/10',
    bar: 'bg-slate-400/50',
  },
  welcomed: {
    label: 'Welcomed',
    blurb: 'Outsiders have earned this world goodwill. Doors open a little easier, the benefit of the doubt given more readily.',
    color: 'text-emerald-300/80 border-emerald-500/25 bg-emerald-500/10',
    bar: 'bg-emerald-500/60',
  },
  revered: {
    label: 'Revered',
    blurb: 'Outsiders are remembered as this world’s champions. Newcomers arrive to hope, deference, and high expectation.',
    color: 'text-violet-300/85 border-violet-500/30 bg-violet-500/10',
    bar: 'bg-violet-500/70',
  },
}

/**
 * A world's collective vision of "the outsiders" — how its people regard the
 * foreigners who play through personal sagas here, earned by every saga's deeds.
 * (Server component — read-only.)
 */
export function OutsiderRegard({ regard }: { regard: Regard }) {
  const tier = TIERS[regard.tier]
  // Map -1..1 onto a 0–100% marker position along the track.
  const pos = Math.round((regard.regard + 1) * 50)

  return (
    <section className="space-y-4 glass-card rounded-xl p-5 sm:p-6 border border-violet-500/10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-violet-300/70" />
          <h2 className="text-sm uppercase tracking-widest text-violet-300/60 font-sans">
            The Outsiders
          </h2>
        </div>
        <span className={`shrink-0 text-[11px] uppercase tracking-wider font-semibold font-sans px-2.5 py-1 rounded-full border ${tier.color}`}>
          {tier.label}
          {regard.trend === 'rising' && <TrendingUp className="inline h-3 w-3 ml-1 -mt-0.5" />}
          {regard.trend === 'falling' && <TrendingDown className="inline h-3 w-3 ml-1 -mt-0.5" />}
        </span>
      </div>

      <p className="text-sm text-muted-foreground/70 leading-relaxed">{tier.blurb}</p>

      {/* Disposition track: reviled (left) → revered (right). */}
      <div className="space-y-1.5">
        <div className="relative h-1.5 rounded-full bg-white/[0.06]">
          <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-white/15" />
          <span
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${tier.bar}`}
            style={{ left: `${pos}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wider font-sans text-muted-foreground/35">
          <span>Reviled</span>
          <span>{regard.deeds > 0 ? `${regard.deeds} ${regard.deeds === 1 ? 'deed' : 'deeds'} remembered` : 'Untested'}</span>
          <span>Revered</span>
        </div>
      </div>
    </section>
  )
}
