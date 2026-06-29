'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { countdownLabel } from '@/lib/seasons'
import type { Season } from '@/types'

const DISMISS_KEY = 'chronicle:season:dismissed'

/**
 * Player-facing live-event banner. Fetches the current live season and shows a
 * dismissible strip with a countdown, linking to the events page. The live-ops
 * heartbeat made visible — a reason to come back this week.
 */
export function SeasonBanner() {
  const [season, setSeason] = useState<Season | null>(null)
  const [dismissed, setDismissed] = useState(true) // assume dismissed until we know

  useEffect(() => {
    let cancelled = false
    fetch('/api/seasons/active')
      .then((r) => (r.ok ? r.json() : { seasons: [] }))
      .then((data: { seasons: Season[] }) => {
        if (cancelled) return
        const featured = data.seasons?.[0] ?? null
        setSeason(featured)
        if (featured) {
          const stored = typeof window !== 'undefined' ? window.localStorage.getItem(DISMISS_KEY) : null
          setDismissed(stored === featured.id)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!season || dismissed) return null

  const accent = season.accent ?? '#f5d896'

  function dismiss() {
    if (season && typeof window !== 'undefined') window.localStorage.setItem(DISMISS_KEY, season.id)
    setDismissed(true)
  }

  return (
    <div
      className="relative border-b border-white/[0.06]"
      style={{ background: `linear-gradient(90deg, ${accent}1a 0%, rgba(10,10,15,0) 70%)` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: accent }} />
        <Link href="/events" className="flex-1 min-w-0 group flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground/90 shrink-0">{season.name}</span>
          <span className="text-sm text-muted-foreground/55 truncate hidden sm:inline">— {season.tagline}</span>
          <span className="text-[11px] font-sans px-1.5 py-0.5 rounded-full border shrink-0" style={{ color: accent, borderColor: `${accent}55` }}>
            {countdownLabel(season, new Date())}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
        </Link>
        <button onClick={dismiss} title="Dismiss" className="p-1 rounded text-muted-foreground/40 hover:text-foreground/70 transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
