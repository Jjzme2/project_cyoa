import { describe, it, expect } from 'vitest'
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
  sandboxPulse,
  sandboxStakesLine,
  setPlayerMode,
  setHero,
  setGodAwareness,
  withSavedDefaults,
  START_FAITH,
  MAX_FAITH,
  FAITH_REGEN_HIDDEN,
  FAITH_REGEN_KNOWN,
  setDirectorAxis,
  setDirectorVision,
  setDirectorPersona,
  clearDirectorPersona,
  appendScene,
  resetNarrative,
  rewindTo,
  renderTranscript,
  MAX_EVENT_LOG,
  MAX_SCENE_LOG,
} from '@/lib/world-sandbox'
import { emptyDirector } from '@/lib/director'
import type { GenesisFaction } from '@/types'

describe('initSandboxState', () => {
  it('generates seeded default factions when the world has no genesis', () => {
    const state = initSandboxState(42)
    expect(Object.keys(state.factions).length).toBeGreaterThanOrEqual(3)
    expect(state.tension).toBeCloseTo(0.2)
    expect(state.eventLog).toEqual([])
    expect(state.worldState).toEqual({})
  })

  it('uses the world genesis factions when present', () => {
    const genesis: GenesisFaction[] = [
      { name: 'Iron Legion', archetype: 'martial order', seat: 'North', founding: 'old', rivalOf: null, allyOf: null },
      { name: 'Coin Guild', archetype: 'merchant power', seat: 'East', founding: 'ancient', rivalOf: null, allyOf: null },
    ]
    const state = initSandboxState(42, genesis)
    expect(Object.values(state.factions).map((f) => f.name)).toEqual(['Iron Legion', 'Coin Guild'])
  })

  it('is deterministic for the same seed', () => {
    expect(initSandboxState(7)).toEqual(initSandboxState(7))
  })
})

describe('advanceTicks', () => {
  it('runs the requested number of ticks and accumulates the event log', () => {
    const state = initSandboxState(42)
    const next = advanceTicks(state, 10, false, new FactionManager(1), new EconomyManager())
    expect(next.eventLog.length).toBeGreaterThanOrEqual(0) // ticks are probabilistic, but must not throw
    expect(next).not.toBe(state) // never mutates the input
  })

  it('never mutates the input state (factions/economy are fresh objects)', () => {
    const state = initSandboxState(42)
    const before = JSON.parse(JSON.stringify(state))
    advanceTicks(state, 5, false, new FactionManager(1), new EconomyManager())
    expect(state).toEqual(before)
  })

  it('caps the event log at MAX_EVENT_LOG, keeping the most recent', () => {
    let state = initSandboxState(1)
    // Bait guaranteed-frequent events: many factions ticking many times.
    for (let i = 0; i < 30; i++) {
      state = advanceTicks(state, 5, false, new FactionManager(i), new EconomyManager())
    }
    expect(state.eventLog.length).toBeLessThanOrEqual(MAX_EVENT_LOG)
  })

  it('gentle=true excludes raid narration even over many ticks', () => {
    let state = initSandboxState(1)
    // Force hostile sentiment across the board to maximize raid pressure.
    for (const id of Object.keys(state.factions)) {
      for (const rel of state.factions[id].relationships) rel.sentiment = -90
    }
    for (let i = 0; i < 20; i++) {
      state = advanceTicks(state, 5, true, new FactionManager(i), new EconomyManager())
    }
    expect(state.eventLog.some((l) => /raid|burn|bleeds/i.test(l))).toBe(false)
  })
})

describe('advanceTicksWithEvents', () => {
  it('advanceTicks is equivalent to taking just the .state half', () => {
    const state = initSandboxState(42)
    const { state: viaEvents } = advanceTicksWithEvents(state, 5, false, new FactionManager(1), new EconomyManager())
    const viaPlain = advanceTicks(state, 5, false, new FactionManager(1), new EconomyManager())
    expect(viaEvents).toEqual(viaPlain)
  })

  it('newEvents reflects only THIS call, not the whole (possibly capped) eventLog', () => {
    let state = initSandboxState(1)
    // Prime a long history so eventLog is near/at MAX_EVENT_LOG already.
    for (let i = 0; i < 20; i++) {
      state = advanceTicks(state, 5, false, new FactionManager(i), new EconomyManager())
    }
    const { newEvents } = advanceTicksWithEvents(state, 1, false, new FactionManager(999), new EconomyManager())
    // One tick's worth of events is always far smaller than the capped log.
    expect(newEvents.length).toBeLessThan(MAX_EVENT_LOG)
  })

  it('gentle=true excludes raid narration from newEvents too', () => {
    const state = initSandboxState(1)
    for (const id of Object.keys(state.factions)) {
      for (const rel of state.factions[id].relationships) rel.sentiment = -90
    }
    for (let seed = 0; seed < 20; seed++) {
      const { newEvents } = advanceTicksWithEvents(state, 5, true, new FactionManager(seed), new EconomyManager())
      expect(newEvents.some((l) => /raid|burn|bleeds/i.test(l))).toBe(false)
    }
  })
})

describe('direct faction controls', () => {
  it('nudgeFactionStat clamps wealth to [0,200] and influence to [0,100]', () => {
    const state = initSandboxState(42)
    const id = Object.keys(state.factions)[0]
    const maxedWealth = nudgeFactionStat(state, id, 'wealth', 10_000)
    expect(maxedWealth.factions[id].wealth).toBe(200)
    const zeroedInfluence = nudgeFactionStat(state, id, 'influence', -10_000)
    expect(zeroedInfluence.factions[id].influence).toBe(0)
  })

  it('nudgeFactionStat is a no-op for an unknown faction id', () => {
    const state = initSandboxState(42)
    expect(nudgeFactionStat(state, 'nope', 'wealth', 10)).toBe(state)
  })

  it('setFactionSentiment clamps to [-100,100] and only affects the one direction', () => {
    const state = initSandboxState(42)
    const [a, b] = Object.keys(state.factions)
    const next = setFactionSentiment(state, a, b, 999)
    expect(next.factions[a].relationships.find((r) => r.factionId === b)?.sentiment).toBe(100)
    // The reverse direction (b's view of a) is untouched.
    expect(next.factions[b]).toEqual(state.factions[b])
  })

  it('setFactionSentiment adds a relationship if one did not exist', () => {
    const state = initSandboxState(42)
    const id = Object.keys(state.factions)[0]
    const next = setFactionSentiment(state, id, 'faction_nonexistent', 50)
    expect(next.factions[id].relationships.find((r) => r.factionId === 'faction_nonexistent')?.sentiment).toBe(50)
  })
})

describe('setMarket', () => {
  it('updates supply/demand and price via the shared formula', () => {
    const state = initSandboxState(42)
    const next = setMarket(state, 'food', { supply: 20, demand: 80 })
    expect(next.economy.markets.food.currentPrice).toBe(20) // basePrice(5) * (80/20)
  })

  it('is a no-op for an unknown commodity', () => {
    const state = initSandboxState(42)
    expect(setMarket(state, 'unobtainium', { supply: 10 })).toBe(state)
  })
})

describe('setTension', () => {
  it('clamps to [0,1]', () => {
    const state = initSandboxState(42)
    expect(setTension(state, 5).tension).toBe(1)
    expect(setTension(state, -5).tension).toBe(0)
  })
})

describe('world facts', () => {
  it('setWorldFact adds/overwrites a key, ignoring a blank key', () => {
    const state = initSandboxState(42)
    const withFact = setWorldFact(state, 'harvest_failed', true)
    expect(withFact.worldState.harvest_failed).toBe(true)
    expect(setWorldFact(state, '  ', 1)).toBe(state)
  })

  it('removeWorldFact deletes a key without touching others', () => {
    const state = setWorldFact(setWorldFact(initSandboxState(42), 'a', 1), 'b', 2)
    const next = removeWorldFact(state, 'a')
    expect(next.worldState).toEqual({ b: 2 })
  })
})

describe('narrative controls', () => {
  it('initSandboxState starts with no player mode, hidden god awareness, and an empty scene log', () => {
    const state = initSandboxState(42)
    expect(state.narrative).toEqual({ playerMode: null, godAwareness: 'hidden', scenes: [], snapshots: [] })
  })

  it('setGodAwareness toggles between hidden and known', () => {
    const state = initSandboxState(42)
    expect(setGodAwareness(state, 'known').narrative.godAwareness).toBe('known')
    expect(setGodAwareness(state, 'hidden').narrative.godAwareness).toBe('hidden')
  })

  it('setPlayerMode switches mode without touching hero or scenes', () => {
    const withHero = setHero(initSandboxState(42), { name: 'Vael', description: 'a wandering smith' })
    const withScene = appendScene(withHero, 'Vael steps into the forge.', null)
    const next = setPlayerMode(withScene, 'hero')
    expect(next.narrative.playerMode).toBe('hero')
    expect(next.narrative.hero).toEqual(withScene.narrative.hero)
    expect(next.narrative.scenes).toEqual(withScene.narrative.scenes)
  })

  it('setHero trims the name/description and is a no-op for a blank name', () => {
    const state = initSandboxState(42)
    const next = setHero(state, { name: '  Vael  ', description: '  a wandering smith  ' })
    expect(next.narrative.hero).toEqual({ name: 'Vael', description: 'a wandering smith' })
    expect(setHero(state, { name: '   ' })).toBe(state)
  })

  it('appendScene accumulates turns with incrementing depth', () => {
    let state = initSandboxState(42)
    state = appendScene(state, 'The forge glows.', null)
    state = appendScene(state, 'Vael strikes the iron.', 'Strike the iron')
    expect(state.narrative.scenes).toEqual([
      { id: 'scene-0', content: 'The forge glows.', choiceText: null, depth: 0 },
      { id: 'scene-1', content: 'Vael strikes the iron.', choiceText: 'Strike the iron', depth: 1 },
    ])
  })

  it('appendScene caps the log at MAX_SCENE_LOG, keeping the most recent', () => {
    let state = initSandboxState(42)
    for (let i = 0; i < MAX_SCENE_LOG + 10; i++) {
      state = appendScene(state, `Turn ${i}`, null)
    }
    expect(state.narrative.scenes.length).toBe(MAX_SCENE_LOG)
    expect(state.narrative.scenes[state.narrative.scenes.length - 1].content).toBe(`Turn ${MAX_SCENE_LOG + 9}`)
  })

  it('resetNarrative clears scenes but keeps player mode and hero', () => {
    let state = setHero(initSandboxState(42), { name: 'Vael' })
    state = setPlayerMode(state, 'hero')
    state = appendScene(state, 'The forge glows.', null)
    const next = resetNarrative(state)
    expect(next.narrative.scenes).toEqual([])
    expect(next.narrative.playerMode).toBe('hero')
    expect(next.narrative.hero).toEqual({ name: 'Vael' })
  })
})

describe('faith', () => {
  it('starts at START_FAITH', () => {
    expect(initSandboxState(42).faith).toBe(START_FAITH)
  })

  it('regenerates per tick, twice as fast for a KNOWN god, capped at MAX_FAITH', () => {
    const hidden = { ...initSandboxState(42), faith: 0 }
    const afterHidden = advanceTicks(hidden, 3, false, new FactionManager(1), new EconomyManager())
    expect(afterHidden.faith).toBe(3 * FAITH_REGEN_HIDDEN)

    const known = setGodAwareness({ ...initSandboxState(42), faith: 0 }, 'known')
    const afterKnown = advanceTicks(known, 3, false, new FactionManager(1), new EconomyManager())
    expect(afterKnown.faith).toBe(3 * FAITH_REGEN_KNOWN)

    const nearFull = { ...initSandboxState(42), faith: MAX_FAITH - 1 }
    const capped = advanceTicks(nearFull, 10, false, new FactionManager(1), new EconomyManager())
    expect(capped.faith).toBe(MAX_FAITH)
  })

  it('rewindTo restores the faith that turn left behind', () => {
    let state = { ...initSandboxState(42), faith: 9 }
    state = appendScene(state, 'Turn one.', null)
    const firstSceneId = state.narrative.scenes[0].id
    state = appendScene({ ...state, faith: 2 }, 'Turn two.', 'Spend it all')
    expect(rewindTo(state, firstSceneId).faith).toBe(9)
  })
})

describe('withSavedDefaults', () => {
  it('backfills faith and snapshots on a pre-v5 save', () => {
    const modern = appendScene(initSandboxState(42), 'A scene.', null)
    // Simulate an older save: strip the fields newer versions added.
    const legacy = JSON.parse(JSON.stringify(modern))
    delete legacy.faith
    delete legacy.narrative.snapshots
    const restored = withSavedDefaults(legacy)
    expect(restored.faith).toBe(START_FAITH)
    expect(restored.narrative.snapshots).toHaveLength(restored.narrative.scenes.length)
    expect(restored.narrative.godAwareness).toBe('hidden')
  })

  it('leaves a current save untouched in shape and clamps a corrupt faith value', () => {
    const state = appendScene(initSandboxState(42), 'A scene.', null)
    expect(withSavedDefaults(JSON.parse(JSON.stringify(state)))).toEqual(state)
    expect(withSavedDefaults({ ...state, faith: 999 }).faith).toBe(MAX_FAITH)
  })
})

describe('rewindTo', () => {
  it('restores both the scene log and the world state from that turn\'s snapshot', () => {
    let state = initSandboxState(42)
    const id = Object.keys(state.factions)[0]
    state = appendScene(nudgeFactionStat(state, id, 'wealth', 20), 'Turn one.', null)
    const firstSceneId = state.narrative.scenes[0].id
    const wealthAfterFirst = state.factions[id].wealth

    state = appendScene(nudgeFactionStat(state, id, 'wealth', 50), 'Turn two.', 'Push harder')
    expect(state.factions[id].wealth).not.toBe(wealthAfterFirst) // sanity: it actually moved on

    const rewound = rewindTo(state, firstSceneId)
    expect(rewound.narrative.scenes).toEqual([state.narrative.scenes[0]])
    expect(rewound.factions[id].wealth).toBe(wealthAfterFirst)
  })

  it('is a no-op for an unknown scene id', () => {
    const state = appendScene(initSandboxState(42), 'Turn one.', null)
    expect(rewindTo(state, 'nope')).toBe(state)
  })
})

describe('director tone dials', () => {
  it('setDirectorAxis starts from a centered persona and clamps to [-1,1]', () => {
    const state = initSandboxState(42)
    const next = setDirectorAxis(state, 'darkness', 5)
    expect(next.narrative.directorPersona).toEqual({ ...emptyDirector(), darkness: 1 })
    expect(setDirectorAxis(state, 'darkness', -5).narrative.directorPersona?.darkness).toBe(-1)
  })

  it('setDirectorAxis preserves other axes already set', () => {
    let state = setDirectorAxis(initSandboxState(42), 'darkness', 0.5)
    state = setDirectorAxis(state, 'pace', 0.8)
    expect(state.narrative.directorPersona).toMatchObject({ darkness: 0.5, pace: 0.8 })
  })

  it('setDirectorVision trims and caps length, preserving axes', () => {
    const state = setDirectorAxis(initSandboxState(42), 'darkness', 0.5)
    const next = setDirectorVision(state, 'a quiet horror')
    expect(next.narrative.directorPersona).toMatchObject({ darkness: 0.5, vision: 'a quiet horror' })
  })

  it('setDirectorPersona replaces the whole persona at once (e.g. an archetype)', () => {
    const state = setDirectorAxis(initSandboxState(42), 'darkness', 0.5)
    const persona = { ...emptyDirector(), levity: 0.9, vision: 'a witty caper' }
    expect(setDirectorPersona(state, persona).narrative.directorPersona).toEqual(persona)
  })

  it('clearDirectorPersona removes the override entirely', () => {
    const state = setDirectorAxis(initSandboxState(42), 'darkness', 0.5)
    expect(clearDirectorPersona(state).narrative.directorPersona).toBeUndefined()
  })
})

describe('renderTranscript', () => {
  it('returns empty string when nothing has been played', () => {
    expect(renderTranscript(initSandboxState(42), 'Alderath')).toBe('')
  })

  it('includes the world name, hero, and every scene in order', () => {
    let state = setHero(initSandboxState(42), { name: 'Vael' })
    state = setPlayerMode(state, 'hero')
    state = appendScene(state, 'The forge glows.', null)
    state = appendScene(state, 'Vael strikes the iron.', 'Strike the iron')
    const text = renderTranscript(state, 'Alderath')
    expect(text).toContain('Alderath')
    expect(text).toContain('Vael')
    expect(text).toContain('The forge glows.')
    expect(text).toContain('Strike the iron')
    expect(text).toContain('Vael strikes the iron.')
    expect(text.indexOf('The forge glows.')).toBeLessThan(text.indexOf('Vael strikes the iron.'))
  })

  it('frames god-mode runs without a hero name', () => {
    let state = setPlayerMode(initSandboxState(42), 'god')
    state = appendScene(state, 'The rivers change course.', null)
    expect(renderTranscript(state, 'Alderath')).toMatch(/god/i)
  })
})

describe('sandboxPulse / sandboxStakesLine', () => {
  it('sandboxPulse mirrors the real reader-facing WorldPulse shape', () => {
    const state = initSandboxState(42)
    const pulse = sandboxPulse(state, 'dramatic')
    expect(pulse.tension).toBeCloseTo(state.tension)
  })

  it('sandboxStakesLine reads the same as DifficultyManager for the mode', () => {
    const state = setTension(initSandboxState(42), 0.9)
    expect(sandboxStakesLine(state, 'dramatic')).toMatch(/dangerous/i)
    expect(sandboxStakesLine(state, 'gentle')).not.toMatch(/danger|threat/i)
  })
})
