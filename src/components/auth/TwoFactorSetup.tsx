'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ShieldCheck, ShieldPlus, Loader2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/Providers'

function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

/** Custom TOTP 2FA enrolment + management (server-verified; no Firebase MFA). */
export function TwoFactorSetup() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [qr, setQr] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const api = useCallback(
    async (path: string, body?: object) => {
      if (!user) throw new Error('Not signed in')
      const token = await user.getIdToken()
      const res = await fetch(`/api/account/2fa/${path}`, {
        method: body !== undefined ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      return data
    },
    [user],
  )

  const refresh = useCallback(async () => {
    try {
      const d = await api('status')
      setEnabled(!!d.enabled)
      return !!d.enabled
    } catch {
      setEnabled(false)
      return false
    }
  }, [api])
  useEffect(() => {
    // refresh() only setStates after an awaited /status fetch, never
    // synchronously — this one-shot mount sync is exactly what the effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void refresh()
  }, [user, refresh])

  async function beginSetup() {
    setBusy(true)
    try {
      const { otpauthUrl } = await api('setup', {})
      setSecretKey(secretFromUri(otpauthUrl))
      setQr(await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 }))
      setCode('')
      setPhase('setup')
    } catch (e) {
      // The server is the source of truth. Setup rejects if 2FA is already
      // enabled (e.g. enrolled in another tab/session since this page loaded),
      // so re-sync from /status: the UI flips to the manage view instead of
      // stranding the user on "Enable" with a confusing error.
      const nowEnabled = await refresh()
      toast.error(
        nowEnabled
          ? 'Two-factor authentication is already enabled on your account.'
          : e instanceof Error ? e.message : 'Could not start setup',
      )
    } finally {
      setBusy(false)
    }
  }

  async function completeSetup() {
    setBusy(true)
    try {
      await api('enable', { code: code.trim() })
      toast.success('Two-factor authentication is now enabled.')
      setPhase('idle')
      setCode('')
      // This session is already trusted — mark it verified so the gate doesn't fire.
      if (user) sessionStorage.setItem(`2fa_ok_${user.uid}`, '1')
      setEnabled(true)
    } catch (e) {
      // If enable actually persisted server-side but the client saw a
      // network/parse error, reconcile so the UI reflects the true state.
      await refresh()
      toast.error(e instanceof Error ? e.message : 'Could not enable 2FA')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDisable() {
    setBusy(true)
    try {
      await api('disable', { code: code.trim() })
      toast.success('Two-factor authentication disabled.')
      setPhase('idle')
      setCode('')
      setEnabled(false)
    } catch (e) {
      await refresh()
      toast.error(e instanceof Error ? e.message : 'Could not disable 2FA')
    } finally {
      setBusy(false)
    }
  }

  if (!user || enabled === null) return null

  return (
    <section className="glass border-white/10 p-6 rounded-xl space-y-4">
      <div className="flex items-center gap-2.5">
        {enabled ? <ShieldCheck className="h-5 w-5 text-emerald-400" /> : <ShieldPlus className="h-5 w-5 text-amber-400/80" />}
        <h2 className="text-lg font-semibold">Two-factor authentication</h2>
        {enabled && (
          <span className="ml-auto text-[10px] uppercase tracking-wider font-sans font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            On
          </span>
        )}
      </div>

      {phase === 'setup' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground/70">
            Scan with an authenticator app (Google Authenticator, Authy, 1Password…), then enter the 6-digit code.
          </p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="2FA QR code" className="rounded-lg bg-white p-2 w-44 h-44" />
          )}
          {secretKey && (
            <button
              onClick={() => navigator.clipboard.writeText(secretKey).then(() => toast.success('Secret key copied.'))}
              className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/70 hover:text-foreground break-all"
            >
              <Copy className="h-3 w-3 shrink-0" /> {secretKey}
            </button>
          )}
          <div className="flex gap-2 max-w-xs">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="font-mono tracking-widest"
            />
            <Button onClick={completeSetup} disabled={busy || code.length < 6} className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & enable'}
            </Button>
          </div>
          <button onClick={() => { setPhase('idle'); setCode('') }} className="text-[11px] text-muted-foreground/55 hover:text-foreground">
            Cancel
          </button>
        </div>
      ) : phase === 'disable' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground/70">Enter a current code to turn off two-factor authentication.</p>
          <div className="flex gap-2 max-w-xs">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="font-mono tracking-widest"
            />
            <Button onClick={confirmDisable} disabled={busy || code.length < 6} variant="outline" className="border-red-500/20 text-red-400/80 hover:bg-red-500/10">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable'}
            </Button>
          </div>
          <button onClick={() => { setPhase('idle'); setCode('') }} className="text-[11px] text-muted-foreground/55 hover:text-foreground">
            Cancel
          </button>
        </div>
      ) : enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground/70">
            Your account is protected. You’ll be asked for a code from your authenticator app each new session.
          </p>
          <Button onClick={() => { setPhase('disable'); setCode('') }} variant="outline" size="sm" className="text-xs border-red-500/20 text-red-400/80 hover:bg-red-500/10">
            Disable 2FA
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground/70">
            Add a second layer of security with an authenticator app — a one-time code required when you sign in.
          </p>
          <Button onClick={beginSetup} disabled={busy} className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
            Enable two-factor authentication
          </Button>
        </div>
      )}
    </section>
  )
}
