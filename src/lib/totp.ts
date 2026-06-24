import crypto from 'crypto'
import { encrypt, decrypt } from './encrypt'

/**
 * Custom TOTP (RFC 6238) second factor — self-implemented with Node crypto, no
 * third-party library and no Firebase Identity Platform. Secrets are generated
 * and verified server-side and stored encrypted (see lib/encrypt). HMAC-SHA1,
 * 6 digits, 30s period, with a ±1 step window to tolerate clock skew.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of clean) {
    const idx = BASE32.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 1_000_000).toString().padStart(6, '0')
}

/** A fresh base32 secret (160-bit). */
export function newTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

/** otpauth:// URI for authenticator apps to scan. */
export function totpKeyUri(accountName: string, secret: string): string {
  const label = encodeURIComponent(`Chronicle:${accountName || 'account'}`)
  const params = new URLSearchParams({ secret, issuer: 'Chronicle', algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Verify a 6-digit token against the secret, allowing ±1 time step. */
export function verifyTotp(token: string, secret: string, window = 1): boolean {
  const clean = (token ?? '').replace(/\D/g, '')
  if (clean.length !== 6) return false
  const key = base32Decode(secret)
  if (key.length === 0) return false
  const step = Math.floor(Date.now() / 1000 / 30)
  for (let w = -window; w <= window; w++) {
    // Constant-time-ish compare per candidate.
    const candidate = hotp(key, step + w)
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(clean))) return true
  }
  return false
}

export const encryptSecret = encrypt
export const decryptSecret = decrypt
