'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bug, Lightbulb, MessageSquare, ChevronUp, Loader2, Send, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/components/Providers'
import { FEEDBACK_TYPES, FEEDBACK_STATUSES, type FeedbackType, type FeedbackStatus } from '@/types'

interface BoardItem {
  id: string
  type: FeedbackType
  title: string
  body: string
  status: FeedbackStatus
  authorName: string
  votes: number
  votedByMe: boolean
  isMine: boolean
  adminNote?: string
  createdAt: string
}

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug; cls: string }> = {
  bug: { label: 'Bug', icon: Bug, cls: 'text-red-300 bg-red-500/10 border-red-500/25' },
  feature: { label: 'Feature', icon: Lightbulb, cls: 'text-violet-300 bg-violet-500/10 border-violet-500/25' },
  feedback: { label: 'Feedback', icon: MessageSquare, cls: 'text-sky-300 bg-sky-500/10 border-sky-500/25' },
}

const STATUS_META: Record<FeedbackStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  planned: { label: 'Planned', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/25' },
  in_progress: { label: 'In progress', cls: 'text-violet-300 bg-violet-500/10 border-violet-500/25' },
  done: { label: 'Done', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' },
  declined: { label: 'Declined', cls: 'text-stone-400 bg-stone-500/10 border-stone-500/20' },
}

export default function FeedbackPage() {
  const { user, isAdmin } = useAuth()
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<FeedbackType>('feature')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | FeedbackType>('all')

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = {}
      if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`
      const res = await fetch('/api/feedback', { headers })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setItems(data.feedback)
    } catch {
      toast.error('Could not load the feedback board')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const t = setTimeout(() => void load(), 0)
    return () => clearTimeout(t)
  }, [load])

  async function submit() {
    if (!user) return toast.error('Sign in to post feedback')
    if (title.trim().length < 3 || body.trim().length < 5) return toast.error('Add a title and a little detail')
    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, title: title.trim(), body: body.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to submit')
      toast.success('Thanks — your feedback is posted')
      setTitle('')
      setBody('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  async function vote(item: BoardItem) {
    if (!user) return toast.error('Sign in to vote')
    // Optimistic.
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, votedByMe: !i.votedByMe, votes: i.votes + (i.votedByMe ? -1 : 1) } : i,
      ),
    )
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/feedback/${item.id}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('vote failed')
      const data = await res.json()
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, votes: data.votes, votedByMe: data.voted } : i)))
    } catch {
      await load() // reconcile on error
      toast.error('Could not record your vote')
    }
  }

  async function setStatus(item: BoardItem, status: FeedbackStatus) {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/feedback/${item.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('status failed')
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)))
    } catch {
      toast.error('Could not update status')
    }
  }

  async function exportTasks() {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/feedback/export', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'chronicle-feedback-tasks.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  )

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400/70 text-xs uppercase tracking-widest font-sans">
          <MessageSquare className="h-3.5 w-3.5" />
          Help build Chronicle
        </div>
        <h1 className="text-3xl font-bold gold-text">Feedback &amp; ideas</h1>
        <p className="text-sm text-muted-foreground/60 max-w-2xl">
          Report a bug, request a feature, or share an idea. Upvote what matters to you — the most-wanted ideas rise to
          the top and help steer what we build next.
        </p>
      </header>

      {/* Submit */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
        <div className="flex gap-2">
          {FEEDBACK_TYPES.map((t) => {
            const M = TYPE_META[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  type === t ? M.cls : 'text-muted-foreground/55 border-white/10 bg-white/[0.02]'
                }`}
              >
                <M.icon className="h-3.5 w-3.5" />
                {M.label}
              </button>
            )
          })}
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short, clear title" maxLength={140} />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, or what would you like to see? The more detail, the better."
          rows={4}
          maxLength={4000}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/45">{user ? '' : 'Sign in to post.'}</span>
          <Button onClick={submit} disabled={submitting || !user} className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </Button>
        </div>
      </section>

      {/* Filter + admin export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(['all', ...FEEDBACK_TYPES] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === f ? 'text-amber-200 border-amber-500/30 bg-amber-500/10' : 'text-muted-foreground/50 border-white/10'
              }`}
            >
              {f === 'all' ? 'All' : TYPE_META[f].label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={exportTasks} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-foreground/70 transition-colors">
            <Download className="h-3.5 w-3.5" />
            Export tasks (JSON)
          </button>
        )}
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground/50">Nothing here yet. Be the first to post.</p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((item) => {
            const TM = TYPE_META[item.type]
            const SM = STATUS_META[item.status]
            return (
              <li key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex gap-4">
                <button
                  onClick={() => vote(item)}
                  className={`flex flex-col items-center justify-center shrink-0 w-12 rounded-lg border transition-colors ${
                    item.votedByMe ? 'text-amber-200 border-amber-500/40 bg-amber-500/15' : 'text-muted-foreground/55 border-white/10 hover:bg-white/[0.04]'
                  }`}
                  title={item.votedByMe ? 'Remove your vote' : 'Upvote'}
                >
                  <ChevronUp className="h-4 w-4" />
                  <span className="text-sm font-semibold">{item.votes}</span>
                </button>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-sans ${TM.cls}`}>
                      <TM.icon className="h-3 w-3" />
                      {TM.label}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-sans ${SM.cls}`}>{SM.label}</span>
                  </div>
                  <h3 className="font-semibold text-foreground/90">{item.title}</h3>
                  <p className="text-sm text-muted-foreground/65 whitespace-pre-wrap">{item.body}</p>
                  {item.adminNote && (
                    <p className="text-xs text-amber-300/70 border-l-2 border-amber-500/30 pl-2 mt-1">{item.adminNote}</p>
                  )}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-muted-foreground/40 font-sans">
                      by {item.isMine ? 'you' : item.authorName}
                    </span>
                    {isAdmin && (
                      <select
                        value={item.status}
                        onChange={(e) => setStatus(item, e.target.value as FeedbackStatus)}
                        className="text-[11px] bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-muted-foreground/70"
                      >
                        {FEEDBACK_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-stone-900">
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    )}
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
