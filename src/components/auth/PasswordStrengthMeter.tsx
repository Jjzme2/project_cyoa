'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react'
import { evaluatePasswordStrength, checkPasswordBreached } from '@/lib/password-strength'

interface Props {
  password: string
  email?: string
  name?: string
}

const BAR_COLORS = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']

/**
 * Live password feedback for the register form: a strength meter, the blocking
 * issues to fix, and an async "have I been pwned" breach check.
 */
export function PasswordStrengthMeter({ password, email, name }: Props) {
  const assessment = evaluatePasswordStrength(password, { email, name })
  const [breach, setBreach] = useState<{ status: 'idle' | 'checking' | 'done'; count: number | null }>({
    status: 'idle',
    count: null,
  })

  // Debounced breach lookup as the user types (only once it's long enough).
  // All state updates run inside timeout callbacks, never synchronously in the
  // effect body, to avoid cascading re-renders.
  useEffect(() => {
    let cancelled = false
    if (password.length < 8) {
      const id = setTimeout(() => {
        if (!cancelled) setBreach({ status: 'idle', count: null })
      }, 0)
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }
    const t = setTimeout(async () => {
      if (cancelled) return
      setBreach({ status: 'checking', count: null })
      const count = await checkPasswordBreached(password)
      if (!cancelled) setBreach({ status: 'done', count })
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [password])

  if (!password) return null

  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < assessment.score ? BAR_COLORS[assessment.score] : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] font-sans">
        <span className="text-muted-foreground/55">Strength: {assessment.label}</span>
        {breach.status === 'checking' && (
          <span className="flex items-center gap-1 text-muted-foreground/45">
            <Loader2 className="h-3 w-3 animate-spin" /> checking breaches…
          </span>
        )}
        {breach.status === 'done' && breach.count === 0 && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <ShieldCheck className="h-3 w-3" /> not in known breaches
          </span>
        )}
        {breach.status === 'done' && breach.count !== null && breach.count > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <ShieldAlert className="h-3 w-3" /> seen in {breach.count.toLocaleString()} breaches
          </span>
        )}
      </div>
      {assessment.issues.length > 0 && (
        <ul className="text-[11px] text-amber-400/70 font-sans space-y-0.5">
          {assessment.issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
