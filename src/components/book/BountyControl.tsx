'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Coins, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'
import type { ChoiceSlot } from '@/types'

interface Props {
  storyId: string
  nodeId: string
  slot: ChoiceSlot
  /** Display the bounty badge only — no offer/cancel controls. */
  readOnly?: boolean
  onChange?: () => void
}

/**
 * Shows an open bounty on a slot and (when writable) lets a signed-in user
 * offer one — credits escrowed until someone writes the path. The poster can
 * cancel an unclaimed bounty for a refund.
 */
export function BountyControl({ storyId, nodeId, slot, readOnly, onChange }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reward, setReward] = useState('5')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const bounty = slot.bounty && slot.bounty.status === 'open' ? slot.bounty : null
  const isPoster = !!user && bounty?.posterId === user.uid
  const endpoint = `/api/stories/${storyId}/nodes/${nodeId}/slots/${slot.id}/bounty`

  async function place() {
    if (!user) return
    const amt = Number(reward)
    if (!Number.isInteger(amt) || amt <= 0) {
      toast.error('Enter a positive number of credits.')
      return
    }
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reward: amt, promptHint: hint.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not place bounty')
      toast.success(`Bounty of ${amt} credits placed.`)
      setOpen(false)
      onChange?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not place bounty')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!user) return
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not cancel bounty')
      toast.success('Bounty cancelled and refunded.')
      onChange?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel bounty')
    } finally {
      setBusy(false)
    }
  }

  // Open bounty badge (everyone sees the incentive).
  if (bounty) {
    return (
      <div
        className="flex items-center gap-1.5 text-[11px] font-sans"
        style={{ color: 'oklch(0.5 0.13 80)' }}
      >
        <Coins className="h-3 w-3 shrink-0" />
        <span>
          {bounty.reward} credit bounty
          {bounty.promptHint ? ` — “${bounty.promptHint}”` : ''}
        </span>
        {!readOnly && isPoster && (
          <button onClick={cancel} disabled={busy} className="underline opacity-60 hover:opacity-100">
            cancel
          </button>
        )}
      </div>
    )
  }

  if (readOnly || !user) return null

  return open ? (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={reward}
        onChange={(e) => setReward(e.target.value)}
        className="w-16 h-7 text-[11px] rounded border border-input bg-background px-1.5 text-foreground focus:outline-none"
        aria-label="Bounty reward in credits"
      />
      <input
        placeholder="hint (optional)"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        className="flex-1 h-7 text-[11px] rounded border border-input bg-background px-1.5 text-foreground focus:outline-none"
      />
      <Button size="sm" onClick={place} disabled={busy} className="h-7 px-2 text-[11px] gap-1">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
        Offer
      </Button>
      <button onClick={() => setOpen(false)} className="opacity-50 hover:opacity-100" aria-label="Cancel">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-[10px] font-sans opacity-45 hover:opacity-80 transition-opacity"
    >
      <Coins className="h-3 w-3" />
      Offer a bounty for this path
    </button>
  )
}
