import { describe, it, expect } from 'vitest'
import {
  resolveNarrativeMode,
  resolveStoryNarrativeMode,
  gentleModeDirective,
  darkModeDirective,
  absurdModeDirective,
  melancholicModeDirective,
  mysteryModeDirective,
  sliceOfLifeModeDirective,
  narrativeModeDirective,
  gentleGoapFilter,
} from '@/lib/engine/narrative-mode'
import { PlotPlanner } from '@/lib/engine/plot-planner'
import { DramaManager } from '@/lib/engine/drama-manager'
import { DifficultyManager } from '@/lib/engine/difficulty'
import { InterludeDirector } from '@/lib/engine/interlude-director'

const base = {
  tone: 'Epic Fantasy',
  rules: '• Magic has a price',
  lore: 'An old kingdom of storms.',
  description: 'A world of contested thrones.',
  rating: 'Teen' as const,
}

describe('resolveNarrativeMode', () => {
  it('defaults to dramatic for a typical world', () => {
    expect(resolveNarrativeMode(base)).toBe('dramatic')
  })

  it('an explicit author setting always wins', () => {
    expect(resolveNarrativeMode({ ...base, storySettings: { narrativeMode: 'gentle' } })).toBe('gentle')
    const gentleText = { ...base, rules: 'No bad happens here', storySettings: { narrativeMode: 'dramatic' as const } }
    expect(resolveNarrativeMode(gentleText)).toBe('dramatic')
  })

  it('a "no bad happens" declaration is decisive on its own', () => {
    expect(resolveNarrativeMode({ ...base, rules: '• No bad happens here, ever' })).toBe('gentle')
    expect(resolveNarrativeMode({ ...base, lore: 'Everyone is kind and everyone is safe.' })).toBe('gentle')
    expect(resolveNarrativeMode({ ...base, description: 'A violence-free meadow realm.' })).toBe('gentle')
  })

  it('soft signals need corroboration (Everyone rating + two keywords)', () => {
    const cozy = { ...base, rating: 'Everyone' as const, description: 'A cozy, wholesome village of soft mornings.' }
    expect(resolveNarrativeMode(cozy)).toBe('gentle')
    // One soft keyword alone, or a Teen rating, stays dramatic.
    expect(resolveNarrativeMode({ ...base, rating: 'Everyone', description: 'A cozy port town with pirate feuds.' })).toBe('dramatic')
    expect(resolveNarrativeMode({ ...cozy, rating: 'Teen' })).toBe('dramatic')
  })

  it('a gentle tone plus one soft keyword flips an Everyone world', () => {
    expect(
      resolveNarrativeMode({ ...base, tone: 'Whimsical Fairy Tale', rating: 'Everyone', description: 'A gentle land of sugar rivers.' }),
    ).toBe('gentle')
  })

  it('the gentle directive forbids manufactured conflict explicitly', () => {
    const d = gentleModeDirective()
    expect(d).toMatch(/no villains/i)
    expect(d).toMatch(/Do not manufacture conflict/i)
  })
})

describe('resolveStoryNarrativeMode (the world clamp)', () => {
  const gentleWorld = { ...base, rules: 'No bad happens here' }

  it('a dramatic world may host a gentle story', () => {
    expect(resolveStoryNarrativeMode(base, { narrativeMode: 'gentle' })).toBe('gentle')
  })

  it('a dramatic world may host a dark or absurd story too', () => {
    expect(resolveStoryNarrativeMode(base, { narrativeMode: 'dark' })).toBe('dark')
    expect(resolveStoryNarrativeMode(base, { narrativeMode: 'absurd' })).toBe('absurd')
  })

  it('a gentle world is law — a story can never be overridden dramatic, dark, or absurd', () => {
    expect(resolveStoryNarrativeMode(gentleWorld, { narrativeMode: 'dramatic' })).toBe('gentle')
    expect(resolveStoryNarrativeMode(gentleWorld, { narrativeMode: 'dark' })).toBe('gentle')
    expect(resolveStoryNarrativeMode(gentleWorld, { narrativeMode: 'absurd' })).toBe('gentle')
  })

  it('absent story mode inherits the world', () => {
    expect(resolveStoryNarrativeMode(base, {})).toBe('dramatic')
    expect(resolveStoryNarrativeMode(gentleWorld, undefined)).toBe('gentle')
  })
})

describe('dark and absurd mode directives', () => {
  it('the dark directive demands real, undone-able cost', () => {
    const d = darkModeDirective()
    expect(d).toMatch(/dread/i)
    expect(d).toMatch(/do not soften/i)
  })

  it('the absurd directive demands deadpan sincerity', () => {
    const d = absurdModeDirective()
    expect(d).toMatch(/deadpan/i)
    expect(d).toMatch(/surreal/i)
  })

  it('narrativeModeDirective dispatches to the right block, and is empty for dramatic', () => {
    expect(narrativeModeDirective('dramatic')).toBe('')
    expect(narrativeModeDirective('gentle')).toBe(gentleModeDirective())
    expect(narrativeModeDirective('dark')).toBe(darkModeDirective())
    expect(narrativeModeDirective('absurd')).toBe(absurdModeDirective())
    expect(narrativeModeDirective('melancholic')).toBe(melancholicModeDirective())
    expect(narrativeModeDirective('mystery')).toBe(mysteryModeDirective())
    expect(narrativeModeDirective('slice_of_life')).toBe(sliceOfLifeModeDirective())
  })
})

describe('melancholic, mystery, and slice-of-life mode directives', () => {
  it('the melancholic directive asks for quiet ache, not villains', () => {
    const d = melancholicModeDirective()
    expect(d).toMatch(/bittersweet/i)
    expect(d).toMatch(/memory/i)
    expect(d).not.toMatch(/villain/i)
  })

  it('the mystery directive demands concrete, followable clues', () => {
    const d = mysteryModeDirective()
    expect(d).toMatch(/clues/i)
    expect(d).toMatch(/red herrings/i)
  })

  it('the slice-of-life directive keeps stakes genuinely small', () => {
    const d = sliceOfLifeModeDirective()
    expect(d).toMatch(/low-stakes/i)
    expect(d).toMatch(/never a cliffhanger/i)
  })
})

describe('gentleGoapFilter (the cast never plans hostility)', () => {
  it('strips hostile actions and anti-protagonist goals', () => {
    const config = {
      goals: [
        { sentiment: 'pro_protagonist' },
        { sentiment: 'anti_protagonist' },
      ],
      availableActions: ['social_offer_aid', 'social_betray', 'social_intimidate', 'combat_attack_player', 'utility_observe'],
      personality: {},
    }
    const out = gentleGoapFilter(config)
    expect(out.goals).toHaveLength(1)
    expect(out.goals[0].sentiment).toBe('pro_protagonist')
    expect(out.availableActions).toEqual(['social_offer_aid', 'utility_observe'])
  })

  it('leaves a friendly config untouched', () => {
    const config = { goals: [{ sentiment: 'pro_protagonist' }], availableActions: ['social_offer_aid'], personality: {} }
    expect(gentleGoapFilter(config)).toEqual(config)
  })
})

describe('gentle arcs in the plot planner', () => {
  const GENTLE_IDS = ['shared_wonder', 'the_gathering', 'new_friend', 'something_grown']

  it('a gentle world only draws gentle arcs, and chains within them', () => {
    let state = PlotPlanner.init('The Sweetest Meadow', undefined, undefined, 'gentle')
    expect(GENTLE_IDS).toContain(state.arcId)
    // Run far enough to complete several arcs; every chained arc stays gentle.
    for (let i = 0; i < 30; i++) {
      state = PlotPlanner.advance(state)
      expect(GENTLE_IDS).toContain(state.arcId)
    }
    expect(state.arcsCompleted ?? 0).toBeGreaterThan(0)
  })

  it('a dramatic world never draws a gentle arc', () => {
    let state = PlotPlanner.init('The Broken Crown', undefined, undefined, 'dramatic')
    for (let i = 0; i < 30; i++) {
      state = PlotPlanner.advance(state)
      expect(GENTLE_IDS).not.toContain(state.arcId)
    }
  })

  it('gentle arc directives carry no threat language', () => {
    let state = PlotPlanner.init('The Sweetest Meadow', undefined, undefined, 'gentle')
    for (let i = 0; i < 16; i++) {
      const d = PlotPlanner.directive(state).toLowerCase()
      expect(d).not.toMatch(/threat|betray|enemy|danger/)
      state = PlotPlanner.advance(state)
    }
  })
})

describe('gentle pacing & stakes language', () => {
  it('drama directives reframe escalation as delight', () => {
    const dm = new DramaManager()
    expect(dm.directive('escalate', 'gentle')).toMatch(/delightful/i)
    expect(dm.directive('escalate', 'gentle')).not.toMatch(/threat/i)
    // Dramatic default unchanged.
    expect(dm.directive('escalate')).toMatch(/threat/i)
  })

  it('difficulty directives measure meaning, not danger', () => {
    expect(DifficultyManager.directive(0.9, 'gentle')).not.toMatch(/danger|threat/i)
    expect(DifficultyManager.directive(0.9, 'gentle')).toMatch(/matters deeply/i)
    expect(DifficultyManager.directive(0.9)).toMatch(/dangerous/i)
  })
})

describe('dark & absurd pacing, stakes, and interludes', () => {
  it('drama directives lean dark toward dread, absurd toward nonsense', () => {
    const dm = new DramaManager()
    expect(dm.directive('escalate', 'dark')).toMatch(/dread/i)
    expect(dm.directive('respite', 'dark')).toMatch(/grim/i)
    expect(dm.directive('escalate', 'absurd')).toMatch(/absurdity/i)
    expect(dm.directive('respite', 'absurd')).toMatch(/deadpan/i)
  })

  it('difficulty directives read dark as cost and absurd as escalating illogic', () => {
    expect(DifficultyManager.directive(0.9, 'dark')).toMatch(/irreversible|grim/i)
    expect(DifficultyManager.directive(0.9, 'absurd')).toMatch(/illogic|over-the-top/i)
  })

  it('interludes pick the mode-appropriate table', () => {
    const darkOut = InterludeDirector.decide({
      nodePath: 'a', turnCount: 10, lastInterlude: 0, plotBeatIndex: 2, betrayalThisTurn: false, mode: 'dark',
    })
    expect(darkOut.fired).toBe(true)
    expect(darkOut.directive).toMatch(/unsettling/i)

    const absurdOut = InterludeDirector.decide({
      nodePath: 'a', turnCount: 10, lastInterlude: 0, plotBeatIndex: 2, betrayalThisTurn: false, mode: 'absurd',
    })
    expect(absurdOut.fired).toBe(true)
    expect(absurdOut.directive).toMatch(/bizarre/i)
  })
})

describe('melancholic, mystery, and slice-of-life pacing, stakes, and interludes', () => {
  it('drama directives read melancholic as feeling, mystery as clue-chasing, slice-of-life as ordinary rhythm', () => {
    const dm = new DramaManager()
    expect(dm.directive('escalate', 'melancholic')).toMatch(/memory|feeling/i)
    expect(dm.directive('escalate', 'mystery')).toMatch(/clue/i)
    expect(dm.directive('escalate', 'slice_of_life')).toMatch(/ordinary/i)
  })

  it('difficulty directives read each mode along its own axis', () => {
    expect(DifficultyManager.directive(0.9, 'melancholic')).toMatch(/ache runs deep/i)
    expect(DifficultyManager.directive(0.9, 'mystery')).toMatch(/truth is close/i)
    expect(DifficultyManager.directive(0.9, 'slice_of_life')).toMatch(/quiet significance/i)
  })

  it('interludes pick the mode-appropriate table', () => {
    const melancholicOut = InterludeDirector.decide({
      nodePath: 'a', turnCount: 10, lastInterlude: 0, plotBeatIndex: 2, betrayalThisTurn: false, mode: 'melancholic',
    })
    expect(melancholicOut.fired).toBe(true)
    expect(melancholicOut.directive).toMatch(/wistful/i)

    const mysteryOut = InterludeDirector.decide({
      nodePath: 'a', turnCount: 10, lastInterlude: 0, plotBeatIndex: 2, betrayalThisTurn: false, mode: 'mystery',
    })
    expect(mysteryOut.fired).toBe(true)
    expect(mysteryOut.directive).toMatch(/INSIGHT/i)

    const sliceOut = InterludeDirector.decide({
      nodePath: 'a', turnCount: 10, lastInterlude: 0, plotBeatIndex: 2, betrayalThisTurn: false, mode: 'slice_of_life',
    })
    expect(sliceOut.fired).toBe(true)
    expect(sliceOut.directive).toMatch(/daydream/i)
  })
})
