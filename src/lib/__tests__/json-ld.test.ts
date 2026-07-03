import { describe, it, expect } from 'vitest'
import { jsonLdSafe } from '@/lib/json-ld'

describe('jsonLdSafe', () => {
  it('neutralizes script-breakout payloads', () => {
    const out = jsonLdSafe({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script')
  })

  it('remains valid JSON that round-trips to the original value', () => {
    const value = { name: 'A < B', tag: 'line\u2028sep' }
    expect(JSON.parse(jsonLdSafe(value))).toEqual(value)
  })
})
