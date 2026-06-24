'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'

/** Shown to a world's creator/admin when it has no genesis canon yet. */
export function GenerateGenesisButton({ worldId, authorId }: { worldId: string; authorId: string }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!user || (user.uid !== authorId && !isAdmin)) return null

  async function generate() {
    if (!user) return
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/worlds/${worldId}/genesis`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not generate canon')
      toast.success('This world’s canon has been written.')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate canon')
      setBusy(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-2 text-sm font-sans px-3.5 py-2 rounded-lg border border-violet-400/30 text-violet-200/85 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {busy ? 'Writing the world’s canon…' : 'Generate this world’s canon'}
    </button>
  )
}
