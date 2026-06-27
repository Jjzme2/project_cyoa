import { vi, describe, it, expect, beforeEach } from 'vitest'

// Query-capable in-memory Firestore fake supporting where('<') / orderBy / limit
// / get(), plus batch().delete()/commit().
const h = vi.hoisted(() => {
  const collections = new Map<string, Map<string, Record<string, unknown>>>()
  const coll = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map())
    return collections.get(name)!
  }

  interface Filter {
    field: string
    op: string
    value: unknown
  }
  const query = (name: string, filters: Filter[], order: string | null, lim: number | null) => ({
    where: (field: string, op: string, value: unknown) =>
      query(name, [...filters, { field, op, value }], order, lim),
    orderBy: (field: string) => query(name, filters, field, lim),
    limit: (n: number) => query(name, filters, order, n),
    get: async () => {
      let docs = [...coll(name).entries()].map(([id, data]) => ({ id, data }))
      for (const f of filters) {
        if (f.op === '<') docs = docs.filter((d) => (d.data[f.field] as string) < (f.value as string))
      }
      if (order) docs.sort((a, b) => ((a.data[order] as string) < (b.data[order] as string) ? -1 : 1))
      if (lim != null) docs = docs.slice(0, lim)
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map((d) => ({ id: d.id, ref: { name, id: d.id }, data: () => d.data })),
      }
    },
  })

  const adminDb = {
    collection: (name: string) => query(name, [], null, null),
    batch: () => {
      const ops: { name: string; id: string }[] = []
      return {
        delete: (ref: { name: string; id: string }) => ops.push(ref),
        commit: async () => ops.forEach((r) => coll(r.name).delete(r.id)),
      }
    },
  }

  return { collections, coll, adminDb }
})

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }), serverTimestamp: () => 'ts' },
}))
vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))

import { pruneChannel, pruneTelemetry, cutoffIso } from '@/lib/telemetry-retention'

const NOW = Date.UTC(2026, 0, 31) // 2026-01-31
const CUTOFF = cutoffIso(30, NOW) // 2026-01-01

function seed(name: string, isoDates: string[]) {
  h.coll(name).clear()
  isoDates.forEach((createdAt, i) => h.coll(name).set(`${name}-${i}`, { createdAt }))
}

beforeEach(() => h.collections.clear())

describe('cutoffIso', () => {
  it('returns an ISO timestamp exactly N days before now', () => {
    expect(cutoffIso(30, NOW)).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('pruneChannel', () => {
  it('deletes only events older than the cutoff', async () => {
    seed('analyticsEvents', [
      '2025-12-01T00:00:00.000Z',
      '2025-12-31T00:00:00.000Z',
      '2026-01-10T00:00:00.000Z', // newer than cutoff — kept
      '2026-01-20T00:00:00.000Z', // kept
    ])
    const res = await pruneChannel('analytics', CUTOFF, 100)
    expect(res.deleted).toBe(2)
    expect(res.hasMore).toBe(false)
    expect(h.coll('analyticsEvents').size).toBe(2)
  })

  it('respects the per-run budget and reports hasMore', async () => {
    seed(
      'analyticsEvents',
      Array.from({ length: 5 }, (_, i) => `2025-12-0${i + 1}T00:00:00.000Z`),
    )
    const res = await pruneChannel('analytics', CUTOFF, 2)
    expect(res.deleted).toBe(2)
    expect(res.hasMore).toBe(true)
    expect(h.coll('analyticsEvents').size).toBe(3) // 3 expired events remain for next run
  })

  it('is a no-op when nothing is expired', async () => {
    seed('insightsEvents', ['2026-01-15T00:00:00.000Z'])
    const res = await pruneChannel('insights', CUTOFF, 100)
    expect(res.deleted).toBe(0)
    expect(res.hasMore).toBe(false)
  })
})

describe('pruneTelemetry', () => {
  it('prunes every channel and keeps daily rollups untouched', async () => {
    seed('analyticsEvents', ['2025-11-01T00:00:00.000Z', '2026-01-20T00:00:00.000Z'])
    seed('insightsEvents', ['2025-10-01T00:00:00.000Z'])
    h.coll('telemetryDaily').set('analytics_2025-11-01', { total: 1 }) // rollup must survive

    const out = await pruneTelemetry({ retentionDays: 30, now: NOW })
    expect(out.cutoff).toBe(CUTOFF)
    const byChannel = Object.fromEntries(out.results.map((r) => [r.channel, r.deleted]))
    expect(byChannel.analytics).toBe(1)
    expect(byChannel.insights).toBe(1)
    expect(h.coll('telemetryDaily').size).toBe(1)
  })
})
