import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { Coins, BookOpen } from 'lucide-react'
import { listOpenBounties } from '@/lib/firestore-helpers'

export const metadata: Metadata = {
  title: 'Bounty board',
  description: 'Open bounties across every story — write the next path and claim the reward.',
  alternates: { canonical: '/bounties' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

async function BountiesContent() {
  await connection() // live data — render at request time (Cache Components)
  let bounties: Awaited<ReturnType<typeof listOpenBounties>> = []
  let ready = true
  try {
    bounties = await listOpenBounties(30)
  } catch {
    ready = false
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400/70 text-xs uppercase tracking-widest font-sans">
          <Coins className="h-3.5 w-3.5" />
          Bounty board
        </div>
        <h1 className="text-3xl font-bold gold-text">Open Bounties</h1>
        <p className="text-sm text-muted-foreground/60 max-w-2xl">
          Credits escrowed by authors on empty paths across every story — write what happens next and claim
          the reward once it publishes.
        </p>
      </header>

      {!ready ? (
        <p className="text-sm text-muted-foreground/50">The bounty board isn&apos;t ready yet — check back soon.</p>
      ) : bounties.length === 0 ? (
        <p className="text-sm text-muted-foreground/50">No open bounties right now — check back soon.</p>
      ) : (
        <ul className="space-y-2.5">
          {bounties.map((b) => (
            <li key={`${b.storyId}-${b.slotId}`}>
              <Link
                href={`/stories/${b.storyId}`}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-amber-500/30 hover:bg-white/[0.04] transition-colors"
              >
                <BookOpen className="h-4 w-4 text-amber-400/50 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground/85 truncate group-hover:text-amber-200 transition-colors">
                    {b.storyTitle}
                  </div>
                  <div className="text-[11px] text-muted-foreground/45 truncate">
                    {b.promptHint || 'No hint given'} · posted by {b.posterName} · {timeAgo(b.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-300 shrink-0">
                  <Coins className="h-3.5 w-3.5" />
                  {b.reward}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function BountiesSkeleton() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="h-3 w-24 rounded bg-white/5 shimmer" />
      <div className="h-9 w-1/2 rounded bg-white/5 shimmer" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5 shimmer" />
        ))}
      </div>
    </main>
  )
}

export default function BountiesPage() {
  return (
    <Suspense fallback={<BountiesSkeleton />}>
      <BountiesContent />
    </Suspense>
  )
}
