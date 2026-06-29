import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Sparkles, CalendarRange, Feather } from 'lucide-react'
import { getLiveSeasons } from '@/lib/firestore-helpers'
import { countdownLabel } from '@/lib/seasons'

export const metadata: Metadata = {
  title: 'Events',
  description: 'Live, time-boxed events across Chronicle — themed happenings everyone writes into.',
  alternates: { canonical: '/events' },
}

async function EventsContent() {
  const seasons = await getLiveSeasons()
  const now = new Date()

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400/70 text-xs uppercase tracking-widest font-sans">
          <Sparkles className="h-3.5 w-3.5" />
          Live events
        </div>
        <h1 className="text-3xl font-bold gold-text">What&apos;s happening now</h1>
        <p className="text-sm text-muted-foreground/60">
          Time-boxed, themed events the whole community writes into. Jump in while they last.
        </p>
      </header>

      {seasons.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-10 text-center space-y-3">
          <CalendarRange className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground/60">No events are live right now.</p>
          <Link href="/worlds" className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200 transition-colors">
            <Feather className="h-4 w-4" />
            Explore worlds in the meantime
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {seasons.map((s) => {
            const accent = s.accent ?? '#f5d896'
            return (
              <li key={s.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <div className="h-1.5 w-full" style={{ background: accent }} />
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold text-foreground/90">{s.name}</h2>
                      <p className="text-muted-foreground/70 italic" style={{ fontFamily: 'Georgia, serif' }}>
                        {s.tagline}
                      </p>
                    </div>
                    <span
                      className="text-xs font-sans px-2.5 py-1 rounded-full border shrink-0"
                      style={{ color: accent, borderColor: `${accent}55` }}
                    >
                      {countdownLabel(s, now)}
                    </span>
                  </div>

                  {s.description && <p className="text-sm text-muted-foreground/65 leading-relaxed">{s.description}</p>}

                  {s.prompt && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground/45 font-sans mb-1.5">
                        <Feather className="h-3 w-3" />
                        Your invitation
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{s.prompt}</p>
                    </div>
                  )}

                  <div className="pt-1">
                    <Link
                      href="/worlds"
                      className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition-colors"
                    >
                      <Feather className="h-4 w-4" />
                      Write into it
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function EventsSkeleton() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="h-3 w-24 rounded bg-white/5 shimmer" />
      <div className="h-9 w-2/3 rounded bg-white/5 shimmer" />
      <div className="h-28 w-full rounded-2xl bg-white/5 shimmer" />
    </main>
  )
}

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <EventsContent />
    </Suspense>
  )
}
