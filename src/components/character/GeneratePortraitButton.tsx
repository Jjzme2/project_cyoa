'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import type { CharacterScope } from '@/types'

interface Props {
  characterId: string
  scope: CharacterScope
  ownerId: string
  hasPortrait: boolean
}

const PORTRAIT_COST = 3

/**
 * Owner/admin control to generate (or regenerate) a character's portrait via the
 * cover-image pipeline. Hidden from everyone else; the API enforces the same
 * rule server-side. Visible client-side for an admin or the author who owns an
 * author-scoped hero (world figures are gated server-side to the world's author).
 */
export function GeneratePortraitButton({ characterId, scope, ownerId, hasPortrait }: Props) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const canEdit = !!user && (isAdmin || (scope === 'author' && user.uid === ownerId))
  if (!canEdit) return null

  async function generate() {
    if (!user || busy) return
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/characters/${characterId}/portrait`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      toast.success('Portrait generated')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 transition-colors disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {busy ? 'Generating…' : hasPortrait ? 'Regenerate portrait' : `Generate portrait (${PORTRAIT_COST} cr)`}
    </button>
  )
}
