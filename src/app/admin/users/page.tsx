'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Coins, RefreshCw, ShieldCheck, Crown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'
import { useAdminGuard, AdminSpinner, AdminHeading } from '../admin-ui'

interface AdminUserRow {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  role: 'user' | 'admin'
  tier: 'FREE' | 'PREMIUM'
  disabled: boolean
  createdAt: string | null
  lastSignIn: string | null
  purchasedCredits: number
}

export default function AdminUsersPage() {
  const { ready } = useAdminGuard()
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    async (pageToken?: string) => {
      if (!user) return
      try {
        const token = await user.getIdToken()
        const url = pageToken ? `/api/admin/users?pageToken=${encodeURIComponent(pageToken)}` : '/api/admin/users'
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load users')
        const data = await res.json()
        setUsers((prev) => (pageToken ? [...prev, ...data.users] : data.users))
        setNextPageToken(data.nextPageToken ?? null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load users')
      } finally {
        setLoadingList(false)
      }
    },
    [user],
  )

  useEffect(() => {
    if (!ready) return
    ;(async () => {
      await load()
    })()
  }, [ready, load])

  async function postAction(path: string, body: Record<string, unknown>, label: string) {
    if (!user) return
    setBusy((body.uid as string) + label)
    try {
      const token = await user.getIdToken()
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      return data
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
      return null
    } finally {
      setBusy(null)
    }
  }

  function patchUser(uid: string, patch: Partial<AdminUserRow>) {
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...patch } : u)))
  }

  async function giveCredits(u: AdminUserRow) {
    const input = window.prompt(`Grant how many credits to ${u.email ?? u.uid}?`, '50')
    if (input === null) return
    const amount = Math.floor(Number(input))
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a positive number')
    const data = await postAction('/api/admin/users/credits', { uid: u.uid, action: 'grant', amount }, 'grant')
    if (data) {
      patchUser(u.uid, { purchasedCredits: data.purchasedCredits })
      toast.success(`Granted ${amount} credits`)
    }
  }

  async function setCredits(u: AdminUserRow) {
    const input = window.prompt(`Set ${u.email ?? u.uid}'s credit balance to:`, String(u.purchasedCredits))
    if (input === null) return
    const amount = Math.floor(Number(input))
    if (!Number.isFinite(amount) || amount < 0) return toast.error('Enter a non-negative number')
    const data = await postAction('/api/admin/users/credits', { uid: u.uid, action: 'set', amount }, 'set')
    if (data) {
      patchUser(u.uid, { purchasedCredits: data.purchasedCredits })
      toast.success('Balance updated')
    }
  }

  async function refreshDaily(u: AdminUserRow) {
    const data = await postAction('/api/admin/users/credits', { uid: u.uid, action: 'refreshDaily' }, 'daily')
    if (data) toast.success(`Daily allowance refreshed for ${u.displayName ?? u.email ?? 'user'}`)
  }

  async function setTier(u: AdminUserRow, tier: 'FREE' | 'PREMIUM') {
    const data = await postAction('/api/admin/users/role', { uid: u.uid, tier }, 'tier')
    if (data) {
      patchUser(u.uid, { tier })
      toast.success(`Tier set to ${tier}`)
    }
  }

  async function setRole(u: AdminUserRow, role: 'user' | 'admin') {
    const data = await postAction('/api/admin/users/role', { uid: u.uid, role }, 'role')
    if (data) {
      patchUser(u.uid, { role })
      toast.success(`Role set to ${role}`)
    }
  }

  if (!ready) return <AdminSpinner />

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <AdminHeading eyebrow="Admin" title="Users" subtitle="Manage roles, tiers, and credit balances. Changes apply on the user's next sign-in or token refresh." />

      {loadingList ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center border border-white/[0.07]">
          <p className="text-muted-foreground/55 text-sm">No users found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isBusy = !!busy && busy.startsWith(u.uid)
            return (
              <div key={u.uid} className="glass-card rounded-xl p-4 border border-white/[0.07] space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground/85 truncate">
                        {u.displayName || u.email || u.uid}
                      </p>
                      {u.role === 'admin' && (
                        <span className="text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-1">
                          <ShieldCheck className="h-2.5 w-2.5" /> admin
                        </span>
                      )}
                      <span className={`text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        u.tier === 'PREMIUM'
                          ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                          : 'border-white/10 bg-white/[0.03] text-muted-foreground/50'
                      }`}>
                        {u.tier}
                      </span>
                      {u.disabled && (
                        <span className="text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300">
                          disabled
                        </span>
                      )}
                    </div>
                    {u.email && u.displayName && (
                      <p className="text-xs text-muted-foreground/45 truncate">{u.email}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/35 font-mono truncate">{u.uid}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-sm">
                    <Coins className="h-4 w-4 text-amber-400/60" />
                    <span className="tabular-nums font-medium text-foreground/80">{u.purchasedCredits}</span>
                    <span className="text-muted-foreground/40 text-xs">credits</span>
                    {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400/50 ml-1" />}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/[0.04]">
                  <ActionButton onClick={() => giveCredits(u)} disabled={isBusy} icon={Plus}>Give credits</ActionButton>
                  <ActionButton onClick={() => setCredits(u)} disabled={isBusy} icon={Coins}>Set balance</ActionButton>
                  <ActionButton onClick={() => refreshDaily(u)} disabled={isBusy} icon={RefreshCw}>Refresh daily</ActionButton>
                  {u.tier === 'FREE' ? (
                    <ActionButton onClick={() => setTier(u, 'PREMIUM')} disabled={isBusy} icon={Crown}>Make Premium</ActionButton>
                  ) : (
                    <ActionButton onClick={() => setTier(u, 'FREE')} disabled={isBusy} icon={Crown}>Make Free</ActionButton>
                  )}
                  {u.role === 'user' ? (
                    <ActionButton onClick={() => setRole(u, 'admin')} disabled={isBusy} icon={ShieldCheck}>Make admin</ActionButton>
                  ) : (
                    <ActionButton onClick={() => setRole(u, 'user')} disabled={isBusy} icon={ShieldCheck}>Remove admin</ActionButton>
                  )}
                </div>
              </div>
            )
          })}

          {nextPageToken && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => load(nextPageToken)} className="border-white/10 hover:bg-white/5">
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  icon: typeof Coins
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-sans border border-white/10 text-muted-foreground/60 hover:border-amber-500/25 hover:text-amber-200/80 disabled:opacity-40 disabled:pointer-events-none transition-all"
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  )
}
