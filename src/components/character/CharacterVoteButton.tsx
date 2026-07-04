'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'

/** Community "best character" vote — self-contained, fetches its own voted/count state. */
export function CharacterVoteButton({ characterId, initialCount }: { characterId: string; initialCount: number }) {
  const { user, openAuthModal } = useAuth()
  const [voted, setVoted] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(async (token) => {
      const res = await fetch(`/api/characters/${characterId}/vote`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setVoted(data.voted)
        setCount(data.count)
      }
    })
  }, [user, characterId])

  async function toggle() {
    if (!user) {
      openAuthModal()
      return
    }
    setBusy(true)
    const prevVoted = voted
    const prevCount = count
    setVoted(!prevVoted)
    setCount(prevVoted ? prevCount - 1 : prevCount + 1)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/characters/${characterId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setVoted(data.voted)
      setCount(data.count)
    } catch {
      setVoted(prevVoted)
      setCount(prevCount)
      toast.error('Could not record your vote — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={voted ? 'Remove your vote' : 'Vote for this character'}
      className={`inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1.5 rounded-md border transition-colors ${
        voted
          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
          : 'border-white/10 text-muted-foreground/70 hover:border-rose-500/30 hover:text-rose-300'
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${voted ? 'fill-current' : ''}`} />
      {count}
    </button>
  )
}
