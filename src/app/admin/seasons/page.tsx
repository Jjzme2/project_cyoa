'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Pencil, CalendarRange, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAdminGuard, AdminSpinner, AdminHeading } from '../admin-ui'
import { seasonPhase, countdownLabel, type SeasonPhase } from '@/lib/seasons'
import type { Season } from '@/types'

interface FormState {
  id?: string
  name: string
  tagline: string
  description: string
  prompt: string
  startsAt: string // datetime-local value
  endsAt: string // datetime-local value
  accent: string
  published: boolean
  recurrence: 'none' | 'monthly' | 'yearly'
}

const EMPTY: FormState = {
  name: '',
  tagline: '',
  description: '',
  prompt: '',
  startsAt: '',
  endsAt: '',
  accent: '#f5d896',
  published: false,
  recurrence: 'none',
}

function isoToLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(v: string): string {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

const PHASE_STYLE: Record<SeasonPhase, string> = {
  live: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  upcoming: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  ended: 'text-stone-400 bg-stone-500/10 border-stone-500/20',
  draft: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
}

export default function AdminSeasonsPage() {
  const { user, ready } = useAdminGuard()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Refresh "now" each minute so countdowns/phases stay honest.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/seasons', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load seasons')
      const data = await res.json()
      setSeasons(data.seasons)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load seasons')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!ready) return
    const handle = setTimeout(() => void load(), 0)
    return () => clearTimeout(handle)
  }, [ready, load])

  const editing = Boolean(form.id)

  const save = useCallback(async () => {
    if (!user) return
    const startsAt = localInputToIso(form.startsAt)
    const endsAt = localInputToIso(form.endsAt)
    if (!form.name.trim() || !form.tagline.trim()) return toast.error('Name and tagline are required')
    if (!startsAt || !endsAt) return toast.error('Set a start and end time')
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return toast.error('End must be after start')

    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: form.id,
          name: form.name.trim(),
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          prompt: form.prompt.trim() || undefined,
          startsAt,
          endsAt,
          accent: form.accent,
          published: form.published,
          recurrence: form.recurrence,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      toast.success(editing ? 'Season updated' : 'Season created')
      setForm(EMPTY)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [user, form, editing, load])

  const startEdit = useCallback((s: Season) => {
    setForm({
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      description: s.description ?? '',
      prompt: s.prompt ?? '',
      startsAt: isoToLocalInput(s.startsAt),
      endsAt: isoToLocalInput(s.endsAt),
      accent: s.accent ?? '#f5d896',
      published: s.published,
      recurrence: s.recurrence ?? 'none',
    })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const remove = useCallback(
    async (s: Season) => {
      if (!user) return
      if (!confirm(`Delete “${s.name}”? This can't be undone.`)) return
      try {
        const token = await user.getIdToken()
        const res = await fetch(`/api/admin/seasons/${s.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed')
        toast.success('Season deleted')
        if (form.id === s.id) setForm(EMPTY)
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    },
    [user, form.id, load],
  )

  const sorted = useMemo(
    () =>
      [...seasons].sort((a, b) => {
        const order: Record<SeasonPhase, number> = { live: 0, upcoming: 1, draft: 2, ended: 3 }
        return order[seasonPhase(a, now)] - order[seasonPhase(b, now)] || Date.parse(b.startsAt) - Date.parse(a.startsAt)
      }),
    [seasons, now],
  )

  if (!ready) return <AdminSpinner />

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <AdminHeading
        eyebrow="Admin"
        title="Seasons & Events"
        subtitle="Define time-boxed, themed events — the live-ops heartbeat. Published events show players a banner and a creative invitation while they're live."
      />

      {/* Editor */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-sans uppercase tracking-widest text-muted-foreground/50">
          <CalendarRange className="h-4 w-4" />
          {editing ? 'Edit event' : 'New event'}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground/60">Name</span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="The Sundering" maxLength={80} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground/60">Tagline</span>
            <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="A crisis everyone writes into." maxLength={140} />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs text-muted-foreground/60">Description</span>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's happening, and why it matters." rows={2} maxLength={2000} />
        </label>

        <label className="space-y-1.5 block">
          <span className="text-xs text-muted-foreground/60">Creative invitation (prompt)</span>
          <Textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="What are writers invited to do this season?" rows={2} maxLength={2000} />
        </label>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground/60">Starts</span>
            <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground/60">Ends</span>
            <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground/60">Repeats</span>
            <select
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value as FormState['recurrence'] })}
              className="w-full h-9 px-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none"
            >
              <option value="none">Never — one-shot</option>
              <option value="monthly">Monthly — rolls forward automatically</option>
              <option value="yearly">Yearly — rolls forward automatically</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground/60">Accent</span>
            <div className="flex items-center gap-2">
              <input type="color" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} className="h-9 w-12 rounded bg-transparent border border-white/10 cursor-pointer" />
              <Input value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} className="font-mono text-xs" />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={() => setForm({ ...form, published: !form.published })}
            className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              form.published
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-muted-foreground/60 bg-white/[0.02] border-white/10'
            }`}
          >
            {form.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {form.published ? 'Published — visible to players' : 'Draft — hidden'}
          </button>

          <div className="flex items-center gap-2">
            {editing && (
              <Button variant="ghost" onClick={() => setForm(EMPTY)} className="text-muted-foreground/60">
                Cancel
              </Button>
            )}
            <Button onClick={save} disabled={saving} className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editing ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-3">
        <div className="text-sm font-sans uppercase tracking-widest text-muted-foreground/50">All events</div>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground/50">No events yet. Create the first one above.</p>
        ) : (
          <ul className="space-y-2.5">
            {sorted.map((s) => {
              const phase = seasonPhase(s, now)
              return (
                <li key={s.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex items-start gap-4">
                  <div className="h-10 w-1.5 rounded-full shrink-0" style={{ background: s.accent ?? '#f5d896' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground/90 truncate">{s.name}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-sans ${PHASE_STYLE[phase]}`}>
                        {phase}
                      </span>
                      <span className="text-[11px] text-muted-foreground/45 font-sans">{countdownLabel(s, now)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground/60 truncate">{s.tagline}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(s)} title="Edit" className="p-2 rounded-lg hover:bg-white/[0.05] text-muted-foreground/60 hover:text-foreground/80 transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(s)} title="Delete" className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground/60 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
