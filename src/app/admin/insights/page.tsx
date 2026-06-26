'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { useAdminGuard, AdminSpinner, AdminHeading } from '../admin-ui'

interface InsightEvent {
  id: string
  name: string
  uid: string | null
  props: Record<string, unknown>
  createdAt: string
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function AdminInsightsPage() {
  const { ready } = useAdminGuard()
  const { user } = useAuth()
  const [events, setEvents] = useState<InsightEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/insights?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setEvents((await res.json()).events ?? [])
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!ready) return
    ;(async () => {
      await load()
    })()
  }, [ready, load])

  if (!ready) return <AdminSpinner />

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <AdminHeading eyebrow="Admin" title="Insights" subtitle="Notable signals — admin actions, milestones, and anomalies, newest first." />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading insights…
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center border border-white/[0.07] space-y-2">
          <Sparkles className="h-6 w-6 text-amber-400/40 mx-auto" />
          <p className="text-muted-foreground/55 text-sm">No insights recorded yet.</p>
          <p className="text-muted-foreground/35 text-xs">
            Signals appear here once <code className="text-amber-300/60">insights.track()</code> runs (e.g. an admin grants credits).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="glass-card rounded-xl p-4 border border-white/[0.07] flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg glass border border-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400/60" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-mono text-amber-300/80 truncate">{e.name}</p>
                  <span className="text-[10px] text-muted-foreground/40 shrink-0">{relativeTime(e.createdAt)}</span>
                </div>
                {Object.keys(e.props).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(e.props).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-muted-foreground/55">
                        <span className="text-muted-foreground/40">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
