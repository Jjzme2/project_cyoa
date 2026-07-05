'use client'

import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, Sparkles, RotateCcw, Plus, X, Coins, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FactionManager } from '@/lib/engine/faction-manager'
import { EconomyManager } from '@/lib/engine/economy-manager'
import {
  initSandboxState,
  advanceTicks,
  nudgeFactionStat,
  setFactionSentiment,
  setMarket,
  setTension,
  setWorldFact,
  removeWorldFact,
  sandboxPulse,
  sandboxStakesLine,
  DEFAULT_COMMODITIES,
  type SandboxState,
} from '@/lib/world-sandbox'
import type { NarrativeMode } from '@/lib/engine/narrative-mode'
import type { GenesisFaction } from '@/types'

function storageKey(worldId: string) {
  return `world_sandbox_${worldId}`
}

function loadSaved(worldId: string): SandboxState | null {
  try {
    const raw = localStorage.getItem(storageKey(worldId))
    return raw ? (JSON.parse(raw) as SandboxState) : null
  } catch {
    return null
  }
}

export function WorldSandbox({
  worldId,
  worldName,
  worldSeed,
  genesisFactions,
  mode,
}: {
  worldId: string
  worldName: string
  worldSeed: number
  genesisFactions: GenesisFaction[]
  mode: NarrativeMode
}) {
  const gentle = mode === 'gentle'
  // One manager instance for the component's lifetime — their own seeded RNG
  // (for narrative-variant phrasing) advances naturally across ticks, same as
  // the real per-story engine keeps one instance per read. Lazy initializers
  // (not useRef, which would re-evaluate `new FactionManager(...)` every render)
  // so the impure Date.now() seed is only ever read once.
  const [factionManager] = useState(() => new FactionManager(worldSeed ^ Date.now()))
  const [economyManager] = useState(() => new EconomyManager())

  const [state, setState] = useState<SandboxState>(() => initSandboxState(worldSeed, genesisFactions))
  const [loaded, setLoaded] = useState(false)
  const [factKey, setFactKey] = useState('')
  const [factValue, setFactValue] = useState('')

  useEffect(() => {
    // Hydration-safe localStorage read: SSR/first paint uses the fresh init
    // state, then the client resumes a saved sandbox if one exists.
    const saved = loadSaved(worldId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState(saved)
    setLoaded(true)
  }, [worldId])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey(worldId), JSON.stringify(state))
    } catch {}
  }, [state, worldId, loaded])

  const pulse = useMemo(() => sandboxPulse(state, mode), [state, mode])
  const stakesLine = useMemo(() => sandboxStakesLine(state, mode), [state, mode])
  const factionList = Object.values(state.factions)

  function reset() {
    setState(initSandboxState(worldSeed, genesisFactions))
  }

  function addFact() {
    if (!factKey.trim()) return
    const n = Number(factValue)
    const value: string | number | boolean =
      factValue === 'true' ? true : factValue === 'false' ? false : !Number.isNaN(n) && factValue.trim() !== '' ? n : factValue
    setState((s) => setWorldFact(s, factKey.trim(), value))
    setFactKey('')
    setFactValue('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
        <FlaskConical className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          <strong className="font-semibold">Sandbox mode.</strong> Tinker with {worldName}&apos;s factions, economy,
          and tension directly — no chapters are written, nothing here is saved to any story, and it never costs
          credits or affects real readers. Purely for fun. Your tinkering is saved only in this browser.
          {gentle && ' This world is gentle, so hostile faction actions (raids) are switched off here too.'}
        </p>
      </div>

      {/* World Pulse preview — the same panel a real reader would see */}
      <section className="glass-card rounded-xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-200/90 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Living World preview
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="h-7 gap-1.5 text-[11px] text-muted-foreground/60">
            <RotateCcw className="h-3 w-3" /> Reset sandbox
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/70 italic">{stakesLine}</p>
        {pulse.factions && <p className="text-xs text-muted-foreground/60">{pulse.factions}</p>}
        {pulse.economy && <p className="text-xs text-muted-foreground/60">{pulse.economy}</p>}
        <div className="flex items-center gap-3 pt-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-sans w-16">Tension</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.tension}
            onChange={(e) => setState((s) => setTension(s, Number(e.target.value)))}
            className="flex-1 accent-amber-500"
            aria-label="Tension"
          />
          <span className="text-[10px] font-mono text-muted-foreground/50 w-8 text-right">{Math.round(state.tension * 100)}%</span>
        </div>
      </section>

      {/* Advance ticks + event log */}
      <section className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-amber-200/90">Advance time</h2>
          <div className="flex gap-1.5">
            {[1, 5, 10].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setState((s) => advanceTicks(s, n, gentle, factionManager, economyManager))}
                className="h-7 text-xs"
              >
                +{n} tick{n === 1 ? '' : 's'}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-muted-foreground/65">
          {state.eventLog.length === 0 ? (
            <p className="text-muted-foreground/40 italic">Nothing has happened yet — advance time to see the world move.</p>
          ) : (
            [...state.eventLog].reverse().map((line, i) => <p key={i}>· {line}</p>)
          )}
        </div>
      </section>

      {/* Factions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-amber-200/90 flex items-center gap-1.5">
          <Swords className="h-3.5 w-3.5" /> Factions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {factionList.map((f) => (
            <div key={f.id} className="glass-card rounded-xl p-4 space-y-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground/85">{f.name}</p>
                <p className="text-[11px] text-muted-foreground/50">{f.description}</p>
              </div>
              {(['wealth', 'influence'] as const).map((stat) => (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-sans w-14">{stat}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/60"
                      style={{ width: `${Math.min(100, f[stat])}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50 w-7 text-right">{Math.round(f[stat])}</span>
                  <div className="flex gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setState((s) => nudgeFactionStat(s, f.id, stat, -10))}
                      aria-label={`Decrease ${f.name}'s ${stat}`}
                      className="h-5 w-5 rounded bg-white/5 text-muted-foreground/60 hover:text-foreground text-xs"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((s) => nudgeFactionStat(s, f.id, stat, 10))}
                      aria-label={`Increase ${f.name}'s ${stat}`}
                      className="h-5 w-5 rounded bg-white/5 text-muted-foreground/60 hover:text-foreground text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {f.relationships.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-white/[0.05]">
                  {f.relationships.map((r) => {
                    const target = state.factions[r.factionId]
                    if (!target) return null
                    return (
                      <div key={r.factionId} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/45 w-20 truncate" title={target.name}>
                          {target.name}
                        </span>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={5}
                          value={r.sentiment}
                          onChange={(e) => setState((s) => setFactionSentiment(s, f.id, r.factionId, Number(e.target.value)))}
                          className="flex-1 accent-amber-500 h-1"
                          aria-label={`${f.name}'s sentiment toward ${target.name}`}
                        />
                        <span
                          className={`text-[10px] font-mono w-9 text-right ${r.sentiment < -40 ? 'text-red-400/70' : r.sentiment > 40 ? 'text-emerald-400/70' : 'text-muted-foreground/45'}`}
                        >
                          {r.sentiment}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Economy */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-amber-200/90 flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" /> Economy
        </h2>
        <div className="glass-card rounded-xl p-4 space-y-3">
          {DEFAULT_COMMODITIES.map((c) => {
            const market = state.economy.markets[c.id]
            if (!market) return null
            return (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/80">{c.name}</span>
                  <span className="text-[11px] font-mono text-amber-300/80">{market.currentPrice.toFixed(1)}g</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['supply', 'demand'] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-sans w-11">{key}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={market[key]}
                        onChange={(e) => setState((s) => setMarket(s, c.id, { [key]: Number(e.target.value) }))}
                        className="flex-1 accent-amber-500"
                        aria-label={`${c.name} ${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* World facts — a generic, freeform control surface */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-amber-200/90">World facts</h2>
        <div className="glass-card rounded-xl p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground/50">
            Set any fact about the world (e.g. <code>harvest_failed</code> = true) — the same simple key/value
            state the story engine tracks internally.
          </p>
          {Object.entries(state.worldState).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(state.worldState).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground/75">{key}</span>
                  <span className="text-muted-foreground/50">=</span>
                  <span className="font-mono text-amber-300/80">{String(value)}</span>
                  <button
                    type="button"
                    onClick={() => setState((s) => removeWorldFact(s, key))}
                    aria-label={`Remove ${key}`}
                    className="ml-auto text-muted-foreground/40 hover:text-red-400/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={factKey}
              onChange={(e) => setFactKey(e.target.value)}
              placeholder="fact name"
              className="h-8 text-xs"
            />
            <Input
              value={factValue}
              onChange={(e) => setFactValue(e.target.value)}
              placeholder="value (true/false/number/text)"
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && addFact()}
            />
            <Button type="button" size="sm" onClick={addFact} className="h-8 gap-1 shrink-0">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
