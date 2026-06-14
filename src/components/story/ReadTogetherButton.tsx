'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Users, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'

/** Starts a co-op reading room for the story and navigates the host into it. */
export function ReadTogetherButton({ storyId }: { storyId: string }) {
  const { user, openAuthModal } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function start() {
    if (!user) {
      openAuthModal()
      return
    }
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storyId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not start a room')
      router.push(`/rooms/${data.roomId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start a room')
      setBusy(false)
    }
  }

  return (
    <button
      onClick={start}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-[11px] font-sans px-2.5 py-1 rounded-full border border-amber-400/30 text-amber-300/80 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
      Read together
    </button>
  )
}
