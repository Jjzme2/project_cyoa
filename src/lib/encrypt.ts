import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO = 'aes-256-gcm'
const VERSION = 'v2'
const SALT_LEN = 16
const IV_LEN = 12
const KEY_LEN = 32
// scrypt cost — fine for the infrequent encrypt/decrypt of stored API keys.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }

function secret(): string {
  const s = process.env.ENCRYPTION_SECRET
  if (!s) throw new Error('ENCRYPTION_SECRET env var is not set')
  return s
}

/** Strong key derivation: scrypt(secret, per-record salt) → 32-byte key. */
function deriveKey(salt: Buffer): Buffer {
  return scryptSync(secret(), salt, KEY_LEN, SCRYPT_PARAMS)
}

/**
 * Legacy key derivation (pre-v2): the secret padded/truncated to 32 bytes, with
 * no salt or KDF. Retained ONLY so ciphertexts written before the upgrade can
 * still be decrypted; never used for new encryption.
 */
function legacyKey(): Buffer {
  return Buffer.from(secret().padEnd(KEY_LEN, '0').slice(0, KEY_LEN), 'utf8')
}

/**
 * Encrypt with AES-256-GCM under a scrypt-derived key and a fresh random salt.
 * Output: `v2:salt:iv:tag:ciphertext` (all hex). The salt is stored per record
 * so each ciphertext uses a distinct key.
 */
export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, deriveKey(salt), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, salt.toString('hex'), iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')

  // v2 (current): version:salt:iv:tag:ciphertext, scrypt-derived key.
  if (parts[0] === VERSION) {
    const [, saltHex, ivHex, tagHex, dataHex] = parts
    if (!saltHex || !ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext format')
    const decipher = createDecipheriv(ALGO, deriveKey(Buffer.from(saltHex, 'hex')), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8')
  }

  // Legacy: iv:tag:ciphertext under the padded key. Read-only back-compat.
  const [ivHex, tagHex, dataHex] = parts
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext format')
  const decipher = createDecipheriv(ALGO, legacyKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8')
}
