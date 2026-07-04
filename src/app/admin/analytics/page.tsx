'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, BarChart3, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'
import { useAdminGuard, AdminSpinner, AdminHeading } from '../admin-ui'

interface DailyBucket {
  date: string
  total: number
  events: Record<string, number>
}
interface AnalyticsData {
  days: number
  grandTotal: number
  topEvents: { name: string; count: number }[]
  buckets: DailyBucket[]
}

export default function AdminAnalyticsPage() {
  const { ready } = useAdminGuard()
  const { user } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/analytics?days=14', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setData(await res.json())
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

  const exportWindow = useCallback(async (format: 'csv' | 'json') => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/admin/analytics/export?days=14&format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chronicle-analytics-14d.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }, [user])

  if (!ready) return <AdminSpinner />

  const maxDay = data ? Math.max(1, ...data.buckets.map((b) => b.total)) : 1
  const maxEvent = data && data.topEvents.length ? data.topEvents[0].count : 1

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <AdminHeading eyebrow="Admin" title="Analytics" subtitle="Tracked product events over the last 14 days." />
        {!loading && data && data.grandTotal > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportWindow('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans border border-white/10 text-muted-foreground/55 hover:border-amber-500/25 hover:text-amber-200/80 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => exportWindow('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans border border-white/10 text-muted-foreground/55 hover:border-amber-500/25 hover:text-amber-200/80 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> JSON
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : !data || data.grandTotal === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center border border-white/[0.07] space-y-2">
          <BarChart3 className="h-6 w-6 text-amber-400/40 mx-auto" />
          <p className="text-muted-foreground/55 text-sm">No events tracked yet in this window.</p>
          <p className="text-muted-foreground/35 text-xs">
            Events appear here once <code className="text-amber-300/60">analytics.track()</code> runs (e.g. creating a story).
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card rounded-xl p-5 border border-white/[0.07]">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-sans">Total events ({data.days}d)</p>
            <p className="mt-1 text-3xl font-bold gold-text tabular-nums">{data.grandTotal.toLocaleString()}</p>
          </div>

          {/* Daily volume */}
          <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/45 font-sans">Daily volume</h2>
            <div className="space-y-1.5">
              {[...data.buckets].reverse().map((b) => (
                <div key={b.date} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground/40 w-16 shrink-0">{b.date.slice(5)}</span>
                  <div className="flex-1 h-4 rounded bg-white/[0.03] overflow-hidden">
                    <div
                      className="h-full bg-amber-500/30 rounded"
                      style={{ width: `${Math.round((b.total / maxDay) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground/55 w-10 text-right shrink-0">{b.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top events */}
          <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/45 font-sans">Top events</h2>
            <div className="space-y-2">
              {data.topEvents.map((e) => (
                <div key={e.name} className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-amber-300/70 w-44 shrink-0 truncate">{e.name}</span>
                  <div className="flex-1 h-2.5 rounded bg-white/[0.03] overflow-hidden">
                    <div
                      className="h-full bg-violet-500/40 rounded"
                      style={{ width: `${Math.round((e.count / maxEvent) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground/55 w-12 text-right shrink-0">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
