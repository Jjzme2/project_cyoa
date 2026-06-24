'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/Providers'

type Gate = 'ok' | 'checking' | 'locked'

/**
 * Post-login second-factor gate. After Firebase sign-in, if the user has custom
 * TOTP enabled and this session hasn't been verified, it blocks the app until a
 * valid code is entered (verified server-side). The "verified" mark is
 * session-scoped and cleared on sign-out.
 */
export function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [gate, setGate] = useState<Gate>('ok')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading) return
    let cancelled = false
    // All state updates happen inside this async helper, never synchronously in
    // the effect body.
    async function decide() {
      if (!user) {
        // Signed out — drop any session verification so re-login re-gates.
        for (const k of Object.keys(sessionStorage)) if (k.startsWith('2fa_ok_')) sessionStorage.removeItem(k)
        if (!cancelled) setGate('ok')
        return
      }
      if (sessionStorage.getItem(`2fa_ok_${user.uid}`)) {
        if (!cancelled) setGate('ok')
        return
      }
      if (!cancelled) setGate('checking')
      try {
        const t = await user.getIdToken()
        const r = await fetch('/api/account/2fa/status', { headers: { Authorization: `Bearer ${t}` } })
        const d = await r.json()
        if (!cancelled) setGate(d.enabled ? 'locked' : 'ok')
      } catch {
        if (!cancelled) setGate('ok')
      }
    }
    decide()
    return () => {
      cancelled = true
    }
  }, [user, loading])

  const verify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!user) return
      setBusy(true)
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/account/2fa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code: code.trim() }),
        })
        const data = await res.json()
        if (data.ok) {
          sessionStorage.setItem(`2fa_ok_${user.uid}`, '1')
          setGate('ok')
          setCode('')
        } else {
          toast.error('Invalid code — enter the current 6-digit code.')
        }
      } catch {
        toast.error('Could not verify. Try again.')
      } finally {
        setBusy(false)
      }
    },
    [user, code],
  )

  async function signOut() {
    const { auth } = await import('@/lib/firebase-client')
    await auth.signOut()
  }

  if (gate === 'checking') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
      </div>
    )
  }

  if (gate === 'locked') {
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center px-4">
        <form onSubmit={verify} className="glass-strong border border-white/15 rounded-2xl p-7 w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-semibold">Two-factor verification</h1>
          </div>
          <p className="text-sm text-muted-foreground/65">
            Enter the current 6-digit code from your authenticator app to continue.
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="font-mono tracking-[0.4em] text-center text-lg"
          />
          <Button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify
          </Button>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/55 hover:text-foreground mx-auto"
          >
            <LogOut className="h-3 w-3" /> Sign out instead
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
