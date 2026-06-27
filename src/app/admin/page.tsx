'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldAlert, ShieldCheck, Loader2, ChevronRight, BookOpen, Globe, ClipboardList, Users, BarChart3, Sparkles, FlaskConical } from 'lucide-react'
import { useAuth } from '@/components/Providers'

interface Overview {
  pendingModeration: number
  pendingModerationCapped: boolean
  stories: number
  storiesCapped: boolean
  worlds: number
  worldsCapped: boolean
  eventsToday: number
  insightsToday: number
}

function fmt(n: number, capped: boolean): string {
  return capped ? `${n}+` : `${n}`
}

export default function AdminDashboardPage() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  // Non-admins have no business here. (Server still enforces every admin API.)
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/')
  }, [user, loading, isAdmin, router])

  useEffect(() => {
    if (!user || !isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setOverview(data)
        }
      } catch {
        // non-critical — the dashboard still renders its navigation
      } finally {
        if (!cancelled) setLoadingOverview(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, isAdmin])

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  const stats: { label: string; value: string; icon: typeof BookOpen; href?: string }[] = [
    {
      label: 'Awaiting moderation',
      value: overview ? fmt(overview.pendingModeration, overview.pendingModerationCapped) : '—',
      icon: ClipboardList,
      href: '/admin/moderation',
    },
    {
      label: 'Events today',
      value: overview ? `${overview.eventsToday}` : '—',
      icon: BarChart3,
      href: '/admin/analytics',
    },
    {
      label: 'Insights today',
      value: overview ? `${overview.insightsToday}` : '—',
      icon: Sparkles,
      href: '/admin/insights',
    },
    { label: 'Stories', value: overview ? fmt(overview.stories, overview.storiesCapped) : '—', icon: BookOpen },
    { label: 'Public worlds', value: overview ? fmt(overview.worlds, overview.worldsCapped) : '—', icon: Globe },
  ]

  const tools: {
    title: string
    description: string
    href: string
    icon: typeof ShieldAlert
    badge?: string | null
  }[] = [
    {
      title: 'Moderation queue',
      description: 'Review flagged routes — approve to publish, or remove to reopen the slot.',
      href: '/admin/moderation',
      icon: ShieldAlert,
      badge: overview && overview.pendingModeration > 0
        ? fmt(overview.pendingModeration, overview.pendingModerationCapped)
        : null,
    },
    {
      title: 'Users',
      description: 'Manage roles and tiers, grant or set credits, and refresh daily allowances.',
      href: '/admin/users',
      icon: Users,
    },
    {
      title: 'Analytics',
      description: 'Tracked product events and daily volume across the platform.',
      href: '/admin/analytics',
      icon: BarChart3,
    },
    {
      title: 'Insights',
      description: 'A feed of notable signals — admin actions, milestones, and anomalies.',
      href: '/admin/insights',
      icon: Sparkles,
    },
    {
      title: 'Tests',
      description: 'Run the Vitest suite in-app and review results and logs.',
      href: '/admin/tests',
      icon: FlaskConical,
    },
  ]

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-amber-400/60 text-xs uppercase tracking-widest font-sans">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </div>
        <h1 className="text-3xl font-bold gold-text">Dashboard</h1>
        <p className="text-sm text-muted-foreground/60">
          Administrative tools for the realm. Visible only to admins.
        </p>
      </div>

      {/* At-a-glance stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s) => {
          const Icon = s.icon
          const card = (
            <div className="glass-card rounded-xl p-5 border border-white/[0.07] h-full">
              <div className="flex items-center gap-2 text-muted-foreground/50 text-[11px] uppercase tracking-wider font-sans">
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <p className="mt-2 text-2xl font-bold gold-text tabular-nums">
                {loadingOverview ? <Loader2 className="h-5 w-5 animate-spin text-amber-400/40" /> : s.value}
              </p>
            </div>
          )
          return s.href ? (
            <Link key={s.label} href={s.href} className="block transition-transform hover:-translate-y-0.5">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          )
        })}
      </div>

      {/* Tools */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/45 font-sans">Tools</h2>
        {tools.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className="glass-card rounded-xl p-5 border border-white/[0.07] flex items-center gap-4 hover:border-amber-500/25 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg glass border border-amber-500/20 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-amber-400/70" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground/80">{t.title}</p>
                  {t.badge && (
                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                      {t.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/55 mt-0.5">{t.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-amber-400/60 transition-colors shrink-0" />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
