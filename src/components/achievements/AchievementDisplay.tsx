'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { ACHIEVEMENT_DEFS } from '@/types'

interface EnrichedAchievement {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
  earnedAt?: string
}

export function AchievementDisplay() {
  const { user } = useAuth()
  const [achievements, setAchievements] = useState<EnrichedAchievement[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch('/api/achievements', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setAchievements(data.achievements)
          setCounts(data.counts)
        }
      } finally {
        setLoading(false)
      }
    })
  }, [user])

  if (!user) return null

  const earned = achievements.filter((a) => a.earned)
  const locked = achievements.filter((a) => !a.earned)

  return (
    <section className="glass border-white/10 p-6 rounded-xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400/80" />
          <h2 className="text-sm font-semibold text-amber-200/90">Achievements</h2>
        </div>
        <span className="text-xs font-mono text-amber-400/60 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
          {earned.length} / {ACHIEVEMENT_DEFS.length}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/[0.03] shimmer" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Earned */}
          {earned.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-sans font-semibold">
                Earned
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {earned.map((a) => (
                  <div
                    key={a.id}
                    title={`${a.name}: ${a.description}`}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] text-center group cursor-default"
                  >
                    <span className="text-2xl leading-none">{a.icon}</span>
                    <span className="text-[9px] font-sans font-semibold text-amber-300/80 leading-tight">
                      {a.name}
                    </span>
                    <span className="text-[8px] font-sans text-muted-foreground/30 leading-tight hidden group-hover:block absolute bg-background border border-white/10 rounded-lg p-2 z-10 max-w-[140px] shadow-xl mt-16 text-left">
                      {a.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locked */}
          {locked.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-sans font-semibold">
                Locked
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {locked.map((a) => (
                  <div
                    key={a.id}
                    title={a.description}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] text-center opacity-35 cursor-default"
                  >
                    <span className="text-2xl leading-none grayscale">{a.icon}</span>
                    <span className="text-[9px] font-sans font-semibold text-muted-foreground leading-tight">
                      {a.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contribution stats */}
          <div className="border-t border-white/[0.04] pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Paths written', value: counts.contributions ?? 0 },
              { label: 'Stories read', value: counts.storiesRead ?? 0 },
              { label: 'Bookmarks', value: counts.bookmarks ?? 0 },
              { label: 'Worlds created', value: counts.worlds ?? 0 },
              { label: 'Stories started', value: counts.stories ?? 0 },
              { label: 'Illustrations', value: counts.illustrations ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center space-y-0.5">
                <p className="text-lg font-mono font-bold text-amber-300/80">{value}</p>
                <p className="text-[9px] font-sans text-muted-foreground/35 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
