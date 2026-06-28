import { describe, it, expect } from 'vitest'
import { buildWorldContext } from '@/lib/ai/world-context'
import { buildPrompt, buildSagaOpeningPrompt } from '@/lib/ai/prompts'
import { toMultiverseId, mergeEchoes } from '@/lib/multiverse'
import type { World } from '@/types'

/**
 * Cross-world isolation guarantee.
 *
 * One world's lore, canon, chronicle, and style must never reach another world's
 * AI prompt. These tests lock that contract at the only seam where world content
 * is assembled (`buildWorldContext`) and where it is rendered into a prompt
 * (`buildPrompt` / `buildSagaOpeningPrompt`). A foreign world's content can only
 * appear if a caller explicitly hands it in — there is no hidden path.
 */

const FOREIGN = 'tartness lemon-zest forbidden-tang' // a phrase from a different world

function makeWorld(over: Partial<World> = {}): World {
  return {
    id: 'world-sunshine',
    name: 'Sunshine Hollow',
    description: 'A bright, gentle candy-land where everything is good.',
    lore: 'Rolling meadows of spun sugar and warm light.',
    rules: '• Be kind • No darkness',
    tone: 'Whimsical Fairy Tale',
    authorId: 'u1',
    authorName: 'Author',
    rating: 'Everyone',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('buildWorldContext (isolation seam)', () => {
  it('only surfaces the world it was given', () => {
    const ctx = buildWorldContext(makeWorld())
    expect(ctx.name).toBe('Sunshine Hollow')
    expect(ctx.lore).toContain('spun sugar')
    // Nothing from any other world leaks in.
    expect(JSON.stringify(ctx)).not.toContain('tartness')
  })

  it('omits the chronicle unless legends are explicitly provided', () => {
    const ctx = buildWorldContext(makeWorld())
    expect(ctx.chronicle).toBeUndefined()
  })

  it('carries only the legends handed to it, verbatim', () => {
    const ctx = buildWorldContext(makeWorld(), { chronicle: ['A baker tamed the marshmallow tide.'] })
    expect(ctx.chronicle).toEqual(['A baker tamed the marshmallow tide.'])
  })

  it('defaults rating to the world, but lets the caller override', () => {
    expect(buildWorldContext(makeWorld({ rating: 'Teen' })).rating).toBe('Teen')
    expect(buildWorldContext(makeWorld({ rating: 'Teen' }), { rating: 'Everyone' }).rating).toBe('Everyone')
  })
})

describe('prompt builders never invent foreign-world content', () => {
  it('a saga opening contains the world but no foreign legends', () => {
    const prompt = buildSagaOpeningPrompt(
      buildWorldContext(makeWorld()),
      'The hollow prepares for the honey festival.',
      { label: 'Arrive at the gate', premise: 'You walk in as a curious traveller.' },
    )
    expect(prompt).toContain('Sunshine Hollow')
    expect(prompt).not.toContain('tartness')
    expect(prompt).not.toContain('lemon-zest')
    // A fresh saga opening must not carry a WORLD CHRONICLE block at all.
    expect(prompt).not.toContain('WORLD CHRONICLE')
  })

  it('a story node only echoes legends from its own world context', () => {
    const ours = buildWorldContext(makeWorld(), { chronicle: ['The honey-knight kept her vow.'] })
    const prompt = buildPrompt(ours, [], 'Greet the gingerbread sentry', false)
    expect(prompt).toContain('The honey-knight kept her vow.')
    expect(prompt).not.toContain(FOREIGN)
    expect(prompt).not.toContain('tartness')
  })

  it('injecting a foreign legend requires passing it in — it never appears on its own', () => {
    const clean = buildPrompt(buildWorldContext(makeWorld()), [], 'Look around', false)
    expect(clean).not.toContain('tartness')
    // Only when a caller explicitly injects it (which the multiverse layer gates)
    // does cross-world text appear — proving there is no implicit path.
    const injected = buildPrompt(buildWorldContext(makeWorld(), { chronicle: [FOREIGN] }), [], 'Look around', false)
    expect(injected).toContain(FOREIGN)
  })
})

describe('multiverse echoes (the only sanctioned cross-world path)', () => {
  it('an unconnected world renders no MULTIVERSE ECHOES block', () => {
    const prompt = buildPrompt(buildWorldContext(makeWorld()), [], 'Walk on', false)
    expect(prompt).not.toContain('MULTIVERSE ECHOES')
  })

  it('echoes appear only when the world opted into a multiverse and legends are pooled', () => {
    const ctx = buildWorldContext(makeWorld(), {
      echoes: [{ worldName: 'Tartwater Reach', nexus: 'a shimmering rift', legends: ['The river ran sour for a year.'] }],
    })
    const prompt = buildPrompt(ctx, [], 'Walk on', false)
    expect(prompt).toContain('MULTIVERSE ECHOES')
    expect(prompt).toContain('Tartwater Reach')
    expect(prompt).toContain('a shimmering rift')
    expect(prompt).toContain('The river ran sour for a year.')
    // Foreign legends are explicitly framed as from ELSEWHERE, not native canon.
    expect(prompt).toContain('ELSEWHERE')
  })

  it('an echo bundle with no usable legends renders nothing', () => {
    const ctx = buildWorldContext(makeWorld(), { echoes: [{ worldName: 'Empty', legends: ['   '] }] })
    expect(ctx.echoes).toBeDefined()
    expect(buildPrompt(ctx, [], 'Walk on', false)).not.toContain('MULTIVERSE ECHOES')
  })

  it('a saga opening surfaces multiverse echoes too when the world declares them', () => {
    const ctx = buildWorldContext(makeWorld(), {
      echoes: [{ worldName: 'Tartwater Reach', legends: ['A baker crossed the rift.'] }],
    })
    const prompt = buildSagaOpeningPrompt(ctx, '', { label: 'Arrive', premise: 'You step in.' })
    expect(prompt).toContain('MULTIVERSE ECHOES')
    expect(prompt).toContain('A baker crossed the rift.')
  })
})

describe('toMultiverseId (global collective key)', () => {
  it('is a stable, normalized, author-independent key so anyone naming the same multiverse pools together', () => {
    expect(toMultiverseId('The Sugar Multiverse')).toBe('the-sugar-multiverse')
    expect(toMultiverseId('  the   sugar   multiverse  ')).toBe('the-sugar-multiverse')
    expect(toMultiverseId('The-Sugar-Multiverse!')).toBe('the-sugar-multiverse')
    // Same name from any creator → same pool (a public collective).
    expect(toMultiverseId('The Sugar Multiverse')).toBe(toMultiverseId('the sugar multiverse'))
  })

  it('returns null for an empty / symbol-only name', () => {
    expect(toMultiverseId('   ')).toBeNull()
    expect(toMultiverseId('✨✨')).toBeNull()
  })
})

describe('mergeEchoes (pool + explicit links)', () => {
  it('combines both sources', () => {
    const pool = [{ worldName: 'A', legends: ['la'] }]
    const links = [{ worldName: 'B', legends: ['lb'] }]
    expect(mergeEchoes(pool, links)).toHaveLength(2)
  })

  it('dedupes by source world name (a linked world that is also a pool sibling appears once)', () => {
    const pool = [{ worldName: 'Tartwater', legends: ['from pool'] }]
    const links = [{ worldName: 'tartwater', nexus: 'a rift', legends: ['from link'] }]
    const merged = mergeEchoes(pool, links)
    expect(merged).toHaveLength(1)
    // First occurrence wins (pool listed first here).
    expect(merged[0].legends).toEqual(['from pool'])
  })

  it('is empty when neither source has echoes', () => {
    expect(mergeEchoes([], [])).toEqual([])
  })
})
