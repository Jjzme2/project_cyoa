'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Clock } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import type { Story } from '@/types'
import { StoryCard } from '@/components/StoryCard'

interface ProgressItem {
  progress: { currentNodeId: string; nodeHistory: string[]; updatedAt: string }
  story: Story | null
}

interface BookmarkItem {
  id: string
  storyId: string
  storyTitle: string
  storyAuthorName: string
  worldName: string
  coverGradient: string
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function ContinueReadingSection() {
  const { user, loading } = useAuth()
  const [history, setHistory] = useState<ProgressItem[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    // Nothing to fetch until auth resolves; the component renders null in this
    // state regardless, so there's no flag to flip here.
    if (loading || !user) return
    async function load() {
      try {
        const token = await user!.getIdToken()
        const [histRes, bmRes] = await Promise.all([
          fetch('/api/reading-history', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/bookmarks', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (histRes.ok) {
          const data = await histRes.json()
          setHistory((data.history ?? []).filter((h: ProgressItem) => h.story))
        }
        if (bmRes.ok) {
          const data = await bmRes.json()
          setBookmarks(data.bookmarks ?? [])
        }
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [user, loading])

  if (loading || !user || fetching) return null
  if (history.length === 0 && bookmarks.length === 0) return null

  return (
    <div className="space-y-12">
      {/* Continue Reading */}
      {history.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-amber-400/60">
              <Clock className="h-4 w-4" />
              <h2
                className="text-[17px] font-semibold text-foreground/65 tracking-tight"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Continue Reading
              </h2>
            </div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, oklch(1 0 0 / 7%), transparent)' }} />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 sm:gap-5">
            {history.slice(0, 7).map(({ progress, story }) => {
              if (!story) return null
              const depth = progress.nodeHistory.length + 1
              return (
                <div key={story.id} className="relative group">
                  <StoryCard story={story} />
                  <div className="absolute -bottom-1 inset-x-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-[8px] font-sans text-amber-400/70 bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      p.{depth} · {timeAgo(progress.updatedAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="relative h-5 -mx-1">
            <div
              className="absolute inset-0 rounded-[3px]"
              style={{
                background: 'linear-gradient(to bottom, oklch(0.33 0.065 53), oklch(0.27 0.055 51) 45%, oklch(0.23 0.045 49))',
                boxShadow: '0 5px 14px -2px rgba(0,0,0,0.60), inset 0 1px 0 oklch(1 0 0 / 9%), inset 0 -1px 0 oklch(0 0 0 / 35%)',
              }}
            />
          </div>
        </section>
      )}

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-amber-400/60">
              <Bookmark className="h-4 w-4" />
              <h2
                className="text-[17px] font-semibold text-foreground/65 tracking-tight"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Bookmarked
              </h2>
            </div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, oklch(1 0 0 / 7%), transparent)' }} />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 sm:gap-5">
            {bookmarks.slice(0, 7).map((bm) => (
              <Link
                key={bm.id}
                href={`/stories/${bm.storyId}`}
                className="group block relative"
              >
                <div className="relative pb-3">
                  <div
                    className="relative flex rounded-sm overflow-hidden cursor-pointer transition-all duration-300 ease-out group-hover:-translate-y-5 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.65)] group-hover:shadow-[0_32px_56px_-10px_rgba(0,0,0,0.90)]"
                    style={{ aspectRatio: '2/3', background: 'linear-gradient(to br, oklch(0.25 0.04 60), oklch(0.18 0.04 55))' }}
                  >
                    <div className="w-3 shrink-0 bg-gradient-to-b from-amber-600 to-amber-800" />
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <span className="text-[8px] uppercase tracking-[0.22em] font-sans text-amber-400/50">
                        {bm.worldName}
                      </span>
                      <div className="flex items-center justify-center flex-1">
                        <Bookmark className="h-5 w-5 text-amber-400/30" />
                      </div>
                      <div>
                        <h3 className="text-[12px] leading-snug text-white/80 line-clamp-3" style={{ fontFamily: 'Georgia, serif' }}>
                          {bm.storyTitle}
                        </h3>
                        <p className="text-[9px] font-sans text-white/25 mt-0.5">by {bm.storyAuthorName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-2 h-3 blur-lg opacity-60 group-hover:opacity-25 transition-opacity pointer-events-none" style={{ background: 'oklch(0.20 0.04 60)' }} />
                </div>
              </Link>
            ))}
          </div>

          <div className="relative h-5 -mx-1">
            <div
              className="absolute inset-0 rounded-[3px]"
              style={{
                background: 'linear-gradient(to bottom, oklch(0.33 0.065 53), oklch(0.27 0.055 51) 45%, oklch(0.23 0.045 49))',
                boxShadow: '0 5px 14px -2px rgba(0,0,0,0.60), inset 0 1px 0 oklch(1 0 0 / 9%), inset 0 -1px 0 oklch(0 0 0 / 35%)',
              }}
            />
          </div>
        </section>
      )}
    </div>
  )
}
