import { ScrollText, Crown, Skull } from 'lucide-react'
import type { ChronicleEntry } from '@/types'

interface Props {
  chronicle: ChronicleEntry[]
  legends: {
    revered: { name: string; standing: number }[]
    reviled: { name: string; standing: number }[]
  }
}

/**
 * The world's shared history: legendary deeds recorded by personal sagas, and
 * the figures most revered or reviled here. (Server component — read-only.)
 */
export function WorldLore({ chronicle, legends }: Props) {
  const hasLegends = legends.revered.length > 0 || legends.reviled.length > 0
  if (chronicle.length === 0 && !hasLegends) return null

  return (
    <section className="space-y-5 glass-card rounded-xl p-5 sm:p-6 border border-amber-500/10">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-amber-400/70" />
        <h2 className="text-sm uppercase tracking-widest text-amber-400/60 font-sans">
          Chronicle &amp; Legends
        </h2>
      </div>

      {hasLegends && (
        <div className="grid sm:grid-cols-2 gap-4">
          {legends.revered.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-sans text-emerald-300/70">
                <Crown className="h-3 w-3" /> Revered
              </p>
              {legends.revered.map((f) => (
                <p key={f.name} className="text-sm text-foreground/75">
                  {f.name}
                  <span className="text-emerald-400/50 text-xs"> · {f.standing.toFixed(2)}</span>
                </p>
              ))}
            </div>
          )}
          {legends.reviled.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-sans text-red-400/70">
                <Skull className="h-3 w-3" /> Reviled
              </p>
              {legends.reviled.map((f) => (
                <p key={f.name} className="text-sm text-foreground/75">
                  {f.name}
                  <span className="text-red-400/50 text-xs"> · {f.standing.toFixed(2)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {chronicle.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider font-sans text-muted-foreground/45">
            Recent deeds
          </p>
          <ul className="space-y-1.5">
            {chronicle.slice(0, 8).map((e, i) => (
              <li key={i} className="text-[13px] leading-snug text-foreground/70 flex gap-2">
                <span className={e.conduct >= 0 ? 'text-emerald-400/50' : 'text-red-400/50'}>—</span>
                <span>
                  {e.text} <span className="text-muted-foreground/35 text-xs">({e.byName})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
