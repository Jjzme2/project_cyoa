import { describe, it, expect } from 'vitest'
import { csvEscape } from '@/lib/csv'

describe('csvEscape', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('story.created')).toBe('story.created')
  })

  it('quotes values containing commas, quotes, or newlines (RFC 4180)', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('neutralizes formula-injection prefixes (= + - @ / tab / CR) with a leading quote', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(csvEscape('+1')).toBe("'+1")
    expect(csvEscape('-1')).toBe("'-1")
    expect(csvEscape('@cmd')).toBe("'@cmd")
    expect(csvEscape('\tstuff')).toBe("'\tstuff")
  })

  it('quote-wraps a guarded value that also contains a comma', () => {
    expect(csvEscape('=a,b')).toBe('"\'=a,b"')
  })
})
