import { describe, it, expect } from 'vitest'
import { isFeedbackType, isFeedbackStatus, applyVote, sortFeedback } from '@/lib/feedback'
import type { Feedback } from '@/types'

describe('isFeedbackType / isFeedbackStatus', () => {
  it('accepts known values, rejects others', () => {
    expect(isFeedbackType('bug')).toBe(true)
    expect(isFeedbackType('feature')).toBe(true)
    expect(isFeedbackType('spam')).toBe(false)
    expect(isFeedbackType(3)).toBe(false)
    expect(isFeedbackStatus('planned')).toBe(true)
    expect(isFeedbackStatus('nope')).toBe(false)
  })
})

describe('applyVote', () => {
  it('adds a vote when absent', () => {
    expect(applyVote([], 'u1')).toEqual({ voters: ['u1'], votes: 1, voted: true })
  })
  it('removes a vote when present (toggle off)', () => {
    expect(applyVote(['u1', 'u2'], 'u1')).toEqual({ voters: ['u2'], votes: 1, voted: false })
  })
})

function fb(over: Partial<Feedback>): Feedback {
  return {
    id: 'x',
    type: 'feature',
    title: 't',
    body: 'b',
    status: 'open',
    authorId: 'a',
    authorName: 'A',
    votes: 0,
    voters: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('sortFeedback', () => {
  it('ranks open above done/declined, then by votes', () => {
    const done = fb({ id: 'done', status: 'done', votes: 99 })
    const openLow = fb({ id: 'low', status: 'open', votes: 1 })
    const openHigh = fb({ id: 'high', status: 'open', votes: 5 })
    const declined = fb({ id: 'declined', status: 'declined', votes: 50 })
    const order = sortFeedback([done, openLow, openHigh, declined]).map((f) => f.id)
    expect(order).toEqual(['high', 'low', 'done', 'declined'])
  })

  it('breaks vote ties by recency', () => {
    const older = fb({ id: 'older', votes: 2, createdAt: '2026-01-01T00:00:00.000Z' })
    const newer = fb({ id: 'newer', votes: 2, createdAt: '2026-02-01T00:00:00.000Z' })
    expect(sortFeedback([older, newer]).map((f) => f.id)).toEqual(['newer', 'older'])
  })
})
