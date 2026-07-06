'use client'

import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, Sparkles, RotateCcw, Plus, X, Coins, Swords, Crown, UserRound, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/Providers'
import { FactionManager } from '@/lib/engine/faction-manager'
import { EconomyManager } from '@/lib/engine/economy-manager'
import {
  initSandboxState,
  advanceTicks,
  advanceTicksWithEvents,
  nudgeFactionStat,
  setFactionSentiment,
  setMarket,
  setTension,
  setWorldFact,
  removeWorldFact,
  setPlayerMode,
  setHero,
  setGodAwareness,
  appendScene,
  resetNarrative,
  sandboxPulse,
  sandboxStakesLine,
  DEFAULT_COMMODITIES,
  type SandboxState,
  type PlayerMode,
  type GodAwareness,
} from '@/lib/world-sandbox'
import type { NarrativeMode } from '@/lib/engine/narrative-mode'
import type { GenesisFaction, GenesisCharacter } from '@/types'

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
  genesisCharacters,
  mode,
}: {
  worldId: string
  worldName: string
  worldSeed: number
  genesisFactions: GenesisFaction[]
  genesisCharacters: GenesisCharacter[]
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

  const { user, updateAiUses } = useAuth()
  const [heroNameDraft, setHeroNameDraft] = useState('')
  const [heroDescDraft, setHeroDescDraft] = useState('')
  const [actionText, setActionText] = useState('')
  const [choices, setChoices] = useState<string[]>([])
  const [narrating, setNarrating] = useState(false)
  const [narrateError, setNarrateError] = useState<string | null>(null)
  const [worldStirred, setWorldStirred] = useState<string[]>([])

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

  function choosePlayerMode(next: PlayerMode | null) {
    setState((s) => setPlayerMode(s, next))
    setChoices([])
    setNarrateError(null)
  }

  function beginHero() {
    if (!heroNameDraft.trim()) return
    setState((s) => setHero(s, { name: heroNameDraft, description: heroDescDraft || undefined }))
    setHeroNameDraft('')
    setHeroDescDraft('')
  }

  /** Quick-pick one of the world's own established figures instead of inventing a stranger. */
  function fillHeroFromCast(character: GenesisCharacter) {
    setHeroNameDraft(character.name)
    setHeroDescDraft([character.role, character.bio].filter(Boolean).join(' — '))
  }

  function restartStory() {
    setState((s) => resetNarrative(s))
    setChoices([])
    setActionText('')
    setNarrateError(null)
    setWorldStirred([])
  }

  /**
   * Every hero/god turn actually ticks the deterministic engine first — a
   * god's decree ripples further than one hero's personal choice, so it gets
   * more ticks — and the resulting faction/economy events are what the AI is
   * told happened, exactly like the real per-chapter path feeds its own
   * engine ticks into the prompt. This is what makes "Play it out" and
   * "Advance time" the SAME world instead of two disconnected toys: the tick
   * is only committed once the AI turn actually succeeds.
   */
  async function narrate(action: string) {
    if (!action.trim() || narrating) return
    if (!user) {
      setNarrateError('Sign in to narrate the sandbox with AI.')
      return
    }
    setNarrating(true)
    setNarrateError(null)
    const ticksThisTurn = state.narrative.playerMode === 'god' ? 2 : 1
    const { state: ticked, newEvents } = advanceTicksWithEvents(state, ticksThisTurn, gentle, factionManager, economyManager)
    try {
      const token = await user.getIdToken()
      const tickedPulse = sandboxPulse(ticked, mode)
      const briefing = [sandboxStakesLine(ticked, mode), tickedPulse.factions, tickedPulse.economy, ...newEvents]
        .filter(Boolean)
        .join(' ')
      const res = await fetch(`/api/worlds/${worldId}/sandbox/narrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          playerMode: state.narrative.playerMode,
          hero: state.narrative.hero,
          godAwareness: state.narrative.godAwareness,
          action,
          storyPath: state.narrative.scenes,
          sandboxBriefing: briefing,
        }),
      })
      const data = await res.json()
      if (typeof data.remaining === 'number') updateAiUses(data.remaining)
      if (!res.ok) throw new Error(data.error ?? 'Narration failed.')
      setState(() => appendScene(ticked, data.content, action))
      setChoices(Array.isArray(data.choices) ? data.choices : [])
      setWorldStirred(newEvents)
      setActionText('')
    } catch (err) {
      setNarrateError(err instanceof Error ? err.message : 'Narration failed.')
    } finally {
      setNarrating(false)
    }
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

      {/* Narrative sandbox — AI-driven, credit-costed, still entirely ephemeral */}
      <section className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-amber-200/90">Play it out</h2>
          <div className="flex gap-1.5">
            {(
              [
                { mode: null, label: 'Off', icon: null },
                { mode: 'hero' as const, label: 'Play a hero', icon: UserRound },
                { mode: 'god' as const, label: "Play the world's god", icon: Crown },
              ]
            ).map(({ mode: m, label, icon: Icon }) => {
              const active = state.narrative.playerMode === m
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => choosePlayerMode(m)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-sans border transition-all flex items-center gap-1 ${
                    active
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                      : 'border-white/10 text-muted-foreground/45 hover:border-white/20 hover:text-muted-foreground/70'
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {state.narrative.playerMode && (
          <p className="text-[11px] text-muted-foreground/45">
            Each turn is a real AI-written scene (1 credit) that actually ticks the factions and economy below — this
            is the same world, not a separate story. Nothing here is ever saved.
            {state.narrative.playerMode === 'god' &&
              " You're an unseen god shaping events — no personal protagonist, just the world reacting to your will, and your decrees ripple further than one hero's choice."}
          </p>
        )}

        {state.narrative.playerMode === 'god' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-sans">The world</span>
            {(
              [
                { value: 'hidden' as const, label: "doesn't know you exist" },
                { value: 'known' as const, label: 'knows you as their god' },
              ]
            ).map(({ value, label }) => {
              const active = state.narrative.godAwareness === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setState((s) => setGodAwareness(s, value as GodAwareness))}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-sans border transition-all ${
                    active
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                      : 'border-white/10 text-muted-foreground/45 hover:border-white/20 hover:text-muted-foreground/70'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {state.narrative.playerMode === 'hero' && !state.narrative.hero && (
          <div className="space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-xs text-muted-foreground/60">Who do you play as?</p>
            {genesisCharacters.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genesisCharacters.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => fillHeroFromCast(c)}
                    title={c.bio}
                    className="px-2 py-0.5 rounded-full text-[11px] font-sans border border-white/10 text-muted-foreground/55 hover:border-amber-500/30 hover:text-amber-300 transition-all"
                  >
                    {c.name}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground/35 self-center">or invent your own below</span>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={heroNameDraft}
                onChange={(e) => setHeroNameDraft(e.target.value)}
                placeholder="Hero name"
                className="h-8 text-xs"
              />
              <Input
                value={heroDescDraft}
                onChange={(e) => setHeroDescDraft(e.target.value)}
                placeholder="One-line description (optional)"
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && beginHero()}
              />
              <Button type="button" size="sm" onClick={beginHero} disabled={!heroNameDraft.trim()} className="h-8 shrink-0">
                Begin
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/40">
              This hero exists only for this sandbox session — never saved as a real character.
            </p>
          </div>
        )}

        {state.narrative.playerMode && (state.narrative.playerMode === 'god' || state.narrative.hero) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {state.narrative.hero && (
                <p className="text-xs text-amber-300/70">
                  Playing as <span className="font-semibold">{state.narrative.hero.name}</span>
                </p>
              )}
              {state.narrative.scenes.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={restartStory}
                  className="h-6 gap-1 text-[11px] text-muted-foreground/50 ml-auto"
                >
                  <RotateCcw className="h-3 w-3" /> Restart story
                </Button>
              )}
            </div>

            {state.narrative.scenes.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                {state.narrative.scenes.map((scene) => (
                  <div key={scene.id} className="space-y-1">
                    {scene.choiceText && (
                      <p className="text-[11px] text-amber-400/60 italic">→ {scene.choiceText}</p>
                    )}
                    <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{scene.content}</p>
                  </div>
                ))}
              </div>
            )}

            {worldStirred.length > 0 && (
              <div className="space-y-0.5 border-l-2 border-amber-500/20 pl-2.5">
                {worldStirred.map((line, i) => (
                  <p key={i} className="text-[11px] text-amber-400/50 italic">
                    Meanwhile: {line}
                  </p>
                ))}
              </div>
            )}

            {choices.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {choices.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={narrating}
                    onClick={() => narrate(c)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-sans border border-amber-500/25 text-amber-300/80 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder={
                  state.narrative.scenes.length === 0
                    ? state.narrative.playerMode === 'god'
                      ? 'What do you set in motion first?'
                      : `What does ${state.narrative.hero?.name} do first?`
                    : state.narrative.playerMode === 'god'
                      ? 'What do you set in motion next?'
                      : 'What do they do next?'
                }
                disabled={narrating}
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && narrate(actionText)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => narrate(actionText)}
                disabled={narrating || !actionText.trim()}
                className="h-8 gap-1.5 shrink-0"
              >
                {narrating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {state.narrative.scenes.length === 0 ? 'Begin' : 'Narrate'}
              </Button>
            </div>
            {narrateError && <p className="text-[11px] text-red-400/80">{narrateError}</p>}
          </div>
        )}
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
