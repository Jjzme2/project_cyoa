'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/components/Providers'

function descriptor(s: number): { label: string; tone: string } {
  if (s > 0.6) return { label: 'reveres you', tone: 'text-emerald-300' }
  if (s > 0.25) return { label: 'regards you warmly', tone: 'text-emerald-300/80' }
  if (s < -0.6) return { label: 'reviles you', tone: 'text-red-400' }
  if (s < -0.25) return { label: 'eyes you warily', tone: 'text-amber-400' }
  return { label: 'barely knows you yet', tone: 'text-muted-foreground/55' }
}

/** Shows the signed-in reader their personal standing in a world ("You" mode). */
export function WorldStandingBadge({ worldId, worldName }: { worldId: string; worldName: string }) {
  const { user } = useAuth()
  const [standing, setStanding] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    user
      .getIdToken()
      .then((token) =>
        fetch(`/api/worlds/${worldId}/standing`, { headers: { Authorization: `Bearer ${token}` } }),
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setStanding(typeof d.standing === 'number' ? d.standing : 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, worldId])

  if (!user || standing === null) return null
  const d = descriptor(standing)
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-sans ${d.tone}`}
      title={`Your standing in ${worldName}: ${standing.toFixed(2)}`}
    >
      <Sparkles className="h-3 w-3" />
      {worldName} {d.label}
    </span>
  )
}
