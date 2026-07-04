import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { Users, BookOpen } from 'lucide-react'
import { listActiveRooms } from '@/lib/rooms'

export const metadata: Metadata = {
  title: 'Reading rooms',
  description: 'Join a live "Read Together" room — vote on what happens next, together.',
  robots: { index: false }, // ephemeral, constantly-changing — not worth indexing
}

async function RoomsContent() {
  await connection() // live data — render at request time (Cache Components)
  const rooms = await listActiveRooms(30).catch(() => [])

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400/70 text-xs uppercase tracking-widest font-sans">
          <Users className="h-3.5 w-3.5" />
          Read together
        </div>
        <h1 className="text-3xl font-bold gold-text">Reading Rooms</h1>
        <p className="text-sm text-muted-foreground/60 max-w-2xl">
          Live rooms where a group reads the same story together, voting on what happens next. Rooms come and
          go — this list is only ever a snapshot of who&apos;s reading right now.
        </p>
      </header>

      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground/50">
          No open rooms right now.{' '}
          <Link href="/" className="text-amber-400/70 hover:text-amber-400 underline underline-offset-2">
            Start one from any story
          </Link>{' '}
          to read together.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link
                href={`/rooms/${r.id}`}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-amber-500/30 hover:bg-white/[0.04] transition-colors"
              >
                <BookOpen className="h-4 w-4 text-amber-400/50 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground/85 truncate group-hover:text-amber-200 transition-colors">
                    {r.storyTitle}
                  </div>
                  <div className="text-[11px] text-muted-foreground/45 capitalize">{r.status}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/55 font-sans shrink-0">
                  <Users className="h-3.5 w-3.5" />
                  {r.memberCount}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function RoomsSkeleton() {
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

export default function RoomsPage() {
  return (
    <Suspense fallback={<RoomsSkeleton />}>
      <RoomsContent />
    </Suspense>
  )
}
