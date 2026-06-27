import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseJson, parseData, formatZodError } from '@/lib/api-validation'

/** Build a minimal Request whose `.json()` resolves to `body`. */
function jsonRequest(body: unknown): Request {
  return new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** A Request whose body is not valid JSON. */
function badRequest(): Request {
  return new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ not json',
  })
}

const Schema = z.object({
  name: z.string().min(1),
  count: z.number().int().optional(),
})

describe('parseJson', () => {
  it('returns typed data for a valid body', async () => {
    const parsed = await parseJson(jsonRequest({ name: 'hi', count: 3 }), Schema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.name).toBe('hi')
      expect(parsed.data.count).toBe(3)
    }
  })

  it('strips unknown keys by default (object schema)', async () => {
    const parsed = await parseJson(jsonRequest({ name: 'hi', sneaky: true }), Schema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect('sneaky' in parsed.data).toBe(false)
    }
  })

  it('returns a 400 with a field-scoped message on validation failure', async () => {
    const parsed = await parseJson(jsonRequest({ name: '' }), Schema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400)
      const body = await parsed.response.json()
      expect(body.error).toMatch(/^name:/)
    }
  })

  it('returns a 400 "Invalid JSON" on malformed JSON', async () => {
    const parsed = await parseJson(badRequest(), Schema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400)
      const body = await parsed.response.json()
      expect(body.error).toBe('Invalid JSON')
    }
  })

  it('treats a missing body as a validation failure, not a crash', async () => {
    const parsed = await parseJson(jsonRequest(undefined), Schema)
    expect(parsed.ok).toBe(false)
  })
})

describe('parseData', () => {
  it('validates an already-parsed value', () => {
    const parsed = parseData({ name: 'hi' }, Schema)
    expect(parsed.ok).toBe(true)
  })

  it('returns a 400 response on failure', async () => {
    const parsed = parseData({ count: 'nope' }, Schema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400)
    }
  })
})

describe('formatZodError', () => {
  it('prefixes the field path', () => {
    const result = Schema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatZodError(result.error)).toMatch(/^name:/)
    }
  })

  it('omits the field-path prefix for root-level errors', () => {
    const result = z.string().safeParse(123)
    expect(result.success).toBe(false)
    if (!result.success) {
      // Root error has an empty path, so the message is returned verbatim
      // (no `field:` prefix prepended by formatZodError).
      expect(formatZodError(result.error)).toBe(result.error.issues[0].message)
    }
  })
})
