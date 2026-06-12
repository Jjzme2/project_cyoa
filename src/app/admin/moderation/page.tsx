'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ShieldAlert, Check, Trash2, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'

interface QueueItem {
  storyId: string
  storyTitle: string
  nodeId: string
  parentId: string | null
  content: string
  choiceText: string | null
  categories: string[]
  reason: string | null
  authorId: string | null
  createdAt: string
}

export default function ModerationPage() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  // Non-admins have no business here.
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/')
  }, [user, loading, isAdmin, router])

  useEffect(() => {
    if (!user || !isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/admin/moderation', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setQueue(data.queue ?? [])
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoadingQueue(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, isAdmin])

  async function act(item: QueueItem, action: 'approve' | 'reject') {
    if (!user) return
    setActing(item.nodeId)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${item.storyId}/nodes/${item.nodeId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed')
      toast.success(action === 'approve' ? 'Route approved.' : 'Route removed.')
      setQueue((q) => q.filter((i) => i.nodeId !== item.nodeId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-amber-400/60 text-xs uppercase tracking-widest font-sans">
          <ShieldAlert className="h-3.5 w-3.5" />
          Admin
        </div>
        <h1 className="text-3xl font-bold gold-text">Moderation queue</h1>
        <p className="text-sm text-muted-foreground/60">
          Routes auto-flagged by the content guidelines. Approve to publish, or remove to delete the
          route and reopen its slot.
        </p>
      </div>

      {loadingQueue ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
        </div>
      ) : queue.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center border border-white/[0.07]">
          <p className="text-muted-foreground/55 text-sm">Nothing awaiting review. The realm is tidy.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.nodeId} className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                  href={`/stories/${item.storyId}`}
                  className="text-sm font-medium text-amber-300/80 hover:text-amber-300 flex items-center gap-1"
                >
                  {item.storyTitle}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  {item.categories.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {item.choiceText && (
                <p className="text-xs text-muted-foreground/50 italic">Prompt: “{item.choiceText}”</p>
              )}
              <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {item.content}
              </p>
              {item.reason && (
                <p className="text-[11px] text-amber-400/55 font-sans">{item.reason}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => act(item, 'approve')}
                  disabled={acting === item.nodeId}
                  className="gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300"
                >
                  {acting === item.nodeId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  onClick={() => act(item, 'reject')}
                  disabled={acting === item.nodeId}
                  className="gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
