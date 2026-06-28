import { describe, it, expect } from 'vitest'
import { layoutRegions, regionLinks } from '@/lib/world-map'
import type { GenesisRegion, WorldBible } from '@/types'

const region = (name: string, biome = 'forest'): GenesisRegion => ({ name, biome, description: `${name} desc` })

describe('layoutRegions', () => {
  it('returns nothing for no regions', () => {
    expect(layoutRegions([], 1)).toEqual([])
    expect(layoutRegions(undefined, 1)).toEqual([])
  })

  it('places every region inside the [0,1] viewport with name+biome carried through', () => {
    const out = layoutRegions([region('Highspire', 'mountain'), region('Mistfen', 'swamp'), region('Sunreach')], 42)
    expect(out).toHaveLength(3)
    for (const r of out) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x).toBeLessThanOrEqual(1)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeLessThanOrEqual(1)
    }
    expect(out[0]).toMatchObject({ name: 'Highspire', biome: 'mountain' })
  })

  it('is deterministic for the same seed and shifts with a different seed', () => {
    const regions = [region('A'), region('B'), region('C')]
    expect(layoutRegions(regions, 7)).toEqual(layoutRegions(regions, 7))
    expect(layoutRegions(regions, 7)[1].x).not.toBe(layoutRegions(regions, 99)[1].x)
  })
})

describe('regionLinks', () => {
  it('connects faction seats by ally/rival, skipping unknown regions', () => {
    const bible: WorldBible = {
      regions: [region('North'), region('South')],
      factions: [
        { name: 'Wolves', archetype: 'clan', seat: 'North', founding: '', rivalOf: 'Crows', allyOf: 'Bears' },
        { name: 'Crows', archetype: 'order', seat: 'South', founding: '', rivalOf: null, allyOf: null },
        { name: 'Bears', archetype: 'kin', seat: 'Elsewhere', founding: '', rivalOf: null, allyOf: null },
      ],
      characters: [],
      history: [],
      generatedAt: '',
    }
    const links = regionLinks(bible)
    // North↔South rival is kept; North↔Elsewhere (Bears) ally is dropped (Elsewhere isn't a region)
    expect(links).toEqual([{ from: 'North', to: 'South', kind: 'rival' }])
  })
})
