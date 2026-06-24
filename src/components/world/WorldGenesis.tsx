import { Map, Swords, Users, ScrollText } from 'lucide-react'
import type { WorldBible } from '@/types'

/** Renders a world's generated canon — its regions, powers, figures, and history. */
export function WorldGenesis({ genesis }: { genesis: WorldBible }) {
  return (
    <section className="space-y-5 glass-card rounded-xl p-5 sm:p-6 border border-violet-500/10">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-violet-300/70" />
        <h2 className="text-sm uppercase tracking-widest text-violet-300/60 font-sans">The Chronicle of this World</h2>
      </div>

      {genesis.regions?.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-sans text-muted-foreground/55">
            <Map className="h-3 w-3" /> Realms
          </p>
          {genesis.regions.map((r) => (
            <p key={r.name} className="text-[13px] leading-snug text-foreground/75">
              <span className="text-foreground/90 font-medium">{r.name}</span>{' '}
              <span className="text-muted-foreground/45 text-xs">({r.biome})</span> — {r.description}
            </p>
          ))}
        </div>
      )}

      {genesis.factions?.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-sans text-muted-foreground/55">
            <Swords className="h-3 w-3" /> Powers
          </p>
          {genesis.factions.map((f) => (
            <p key={f.name} className="text-[13px] leading-snug text-foreground/75">
              <span className="text-foreground/90 font-medium">{f.name}</span> — {f.founding}
              {f.rivalOf && <span className="text-red-400/55"> Rivals {f.rivalOf}.</span>}
              {f.allyOf && <span className="text-emerald-400/55"> Allied with {f.allyOf}.</span>}
            </p>
          ))}
        </div>
      )}

      {genesis.characters?.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-sans text-muted-foreground/55">
            <Users className="h-3 w-3" /> Figures of note
          </p>
          {genesis.characters.map((c) => (
            <p key={c.name} className="text-[13px] leading-snug text-foreground/75">
              <span className="text-foreground/90 font-medium">{c.name}</span>
              <span className="text-muted-foreground/50 text-xs">, {c.role}{c.faction ? ` of ${c.faction}` : ''}</span> — {c.bio}
              {c.tie && <span className="text-muted-foreground/55"> {c.tie}</span>}
            </p>
          ))}
        </div>
      )}

      {genesis.history?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider font-sans text-muted-foreground/55">Ages past</p>
          <ul className="space-y-1">
            {genesis.history.map((h, i) => (
              <li key={i} className="text-[13px] leading-snug text-foreground/70">
                <span className="text-foreground/85 font-medium">{h.title}</span>{' '}
                <span className="text-muted-foreground/45 text-xs">· {h.era}</span> — {h.account}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
