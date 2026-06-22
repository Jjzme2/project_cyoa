/**
 * Password security helpers used when a user creates a new password.
 *
 * - `evaluatePasswordStrength` runs entirely locally: length, character
 *   variety, common-password and personal-info checks.
 * - `checkPasswordBreached` uses the Have I Been Pwned "range" API with
 *   k-anonymity: only the first 5 chars of the SHA-1 hash ever leave the
 *   browser, and the lookup runs client-side, so the password itself is never
 *   transmitted. Fails open (returns null) if the check can't be reached.
 */

// A compact set of the most-abused passwords. Not exhaustive — the breach
// check (HIBP) is the real backstop; this just gives instant local feedback.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '1234567', '12345678', '123456789',
  '12345', 'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'welcome1', 'admin',
  'iloveyou', '111111', '123123', 'dragon', 'monkey', 'football', 'sunshine', 'princess',
  'login', 'passw0rd', 'starwars', 'whatever', 'trustno1', 'master', 'changeme', 'secret',
])

export interface PasswordAssessment {
  /** 0 (very weak) – 4 (strong). */
  score: number
  label: string
  /** Blocking problems that must be fixed before the password is acceptable. */
  issues: string[]
  /** True when all hard requirements are met. */
  ok: boolean
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

export function evaluatePasswordStrength(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordAssessment {
  const pw = password ?? ''
  const lower = pw.toLowerCase()
  const issues: string[] = []

  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasNumber = /\d/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)

  if (pw.length < 8) issues.push('Use at least 8 characters')
  if (!hasLower || !hasUpper) issues.push('Mix upper- and lower-case letters')
  if (!hasNumber) issues.push('Include at least one number')
  if (COMMON_PASSWORDS.has(lower)) issues.push('This is a commonly used password')

  const localPart = context.email?.split('@')[0]?.toLowerCase()
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    issues.push('Don’t base your password on your email')
  }
  const name = context.name?.trim().toLowerCase()
  if (name && name.length >= 3 && lower.includes(name)) {
    issues.push('Don’t base your password on your name')
  }

  // Score (independent of the hard requirements above).
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (hasLower && hasUpper && hasNumber) score++
  if (hasSymbol) score++
  if (COMMON_PASSWORDS.has(lower)) score = Math.min(score, 1)
  score = Math.max(0, Math.min(score, 4))

  const ok =
    pw.length >= 8 &&
    hasLower &&
    hasUpper &&
    hasNumber &&
    !COMMON_PASSWORDS.has(lower) &&
    !(localPart && localPart.length >= 3 && lower.includes(localPart)) &&
    !(name && name.length >= 3 && lower.includes(name))

  return { score, label: STRENGTH_LABELS[score], issues, ok }
}

/**
 * Returns how many times the password appears in known breaches (0 = clean),
 * or null if the check couldn't run (offline / blocked). Uses HIBP k-anonymity:
 * only the SHA-1 prefix is sent.
 */
export async function checkPasswordBreached(password: string): Promise<number | null> {
  try {
    if (!password || typeof crypto === 'undefined' || !crypto.subtle) return null
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return null

    const text = await res.text()
    for (const line of text.split('\n')) {
      const [suf, count] = line.trim().split(':')
      if (suf === suffix) return parseInt(count, 10) || 0
    }
    return 0
  } catch {
    return null
  }
}
