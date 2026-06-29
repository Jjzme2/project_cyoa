import { describe, it, expect, beforeAll } from 'vitest'
import { createCipheriv, randomBytes } from 'crypto'
import { encrypt, decrypt } from '@/lib/encrypt'

const SECRET = 'test-encryption-secret-value'

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = SECRET
})

describe('encrypt / decrypt (v2: scrypt + per-record salt)', () => {
  it('round-trips a value', () => {
    const out = encrypt('sk-supersecret-api-key')
    expect(decrypt(out)).toBe('sk-supersecret-api-key')
  })

  it('emits the v2 envelope with a per-record salt', () => {
    const out = encrypt('hello')
    const parts = out.split(':')
    expect(parts[0]).toBe('v2')
    expect(parts).toHaveLength(5)
  })

  it('uses a fresh salt + iv each time (distinct ciphertexts for the same input)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'))
  })

  it('rejects a tampered ciphertext (GCM auth)', () => {
    const out = encrypt('tamper-me')
    const parts = out.split(':')
    parts[4] = parts[4].slice(0, -2) + (parts[4].endsWith('00') ? 'ff' : '00')
    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('throws on a malformed envelope', () => {
    expect(() => decrypt('not-valid')).toThrow()
  })

  it('still decrypts legacy (pre-v2) ciphertexts written under the padded key', () => {
    // Reproduce the old format: iv:tag:ciphertext under secret.padEnd(32,'0').
    const key = Buffer.from(SECRET.padEnd(32, '0').slice(0, 32), 'utf8')
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const enc = Buffer.concat([cipher.update('legacy-value', 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const legacy = `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
    expect(decrypt(legacy)).toBe('legacy-value')
  })
})
