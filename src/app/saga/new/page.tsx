'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2, ChevronRight, Plus, Palette, Feather, Sparkles, DoorOpen, Trash2, Clapperboard, Wand2, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import { STORY_TAGS, CONTENT_RATINGS, CONTENT_RATING_META, DEFAULT_CONTENT_RATING } from '@/types'
import { ratingRank } from '@/lib/ratings'
import { CoverDesigner, DEFAULT_COVER } from '@/components/book/CoverDesigner'
import { useDraft } from '@/hooks/useDraft'
import type { World, CoverTheme, ReadingTheme, PageStyle, AmbientEffect, ContentRating, DirectorPersona } from '@/types'
import {
  DIRECTOR_AXES,
  DIRECTOR_ARCHETYPES,
  describeDirector,
  emptyDirector,
  isDirectorMeaningful,
  personaMatches,
  type DirectorArchetype,
} from '@/lib/director'

const PAGE_STYLES: { id: PageStyle; label: string; bg: string; text: string }[] = [
  { id: 'parchment', label: 'Parchment',    bg: '#f0e6d0', text: '#3d2b1f' },
  { id: 'sepia',     label: 'Sepia',        bg: '#d4b896', text: '#2d1a0e' },
  { id: 'night',     label: 'Night Scroll', bg: '#1a1a2e', text: '#c0c8e0' },
  { id: 'forest',    label: 'Forest',       bg: '#e8f0e0', text: '#1a2d15' },
  { id: 'ocean',     label: 'Ocean',        bg: '#e0eef0', text: '#0d2535' },
  { id: 'rose',      label: 'Rose',         bg: '#f0e0e4', text: '#2d1518' },
]

const AMBIENT_EFFECTS: { id: AmbientEffect; label: string; emoji: string }[] = [
  { id: 'none',   label: 'None',      emoji: '—'  },
  { id: 'rain',   label: 'Rain',      emoji: '🌧️' },
  { id: 'embers', label: 'Embers',    emoji: '🔥' },
  { id: 'stars',  label: 'Starfall',  emoji: '✨' },
  { id: 'snow',   label: 'Snow',      emoji: '❄️' },
]

const MAX_ENTRY_POINTS = 4

type EntryPoint = { label: string; premise: string }

const ENTRY_PLACEHOLDERS: EntryPoint[] = [
  { label: 'Wash ashore, half-drowned and nameless', premise: 'You survive a shipwreck and are pulled from the surf by wary fisherfolk who don\'t yet trust you.' },
  { label: 'Arrive with the merchant caravan', premise: 'You ride in through the gates as a hired hand on a trade caravan, seeing the city for the first time.' },
  { label: 'Marched in among the prisoners', premise: 'You are brought into the world in chains, mistaken for someone — or something — you are not.' },
]

export default function NewSagaPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [worlds, setWorlds] = useState<World[]>([])
  const [loadingWorlds, setLoadingWorlds] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [worldId, setWorldId] = useState('')
  const [rating, setRating] = useState<ContentRating>(DEFAULT_CONTENT_RATING)
  const [tags, setTags] = useState<string[]>([])
  const [premise, setPremise] = useState('')
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([
    { label: '', premise: '' },
    { label: '', premise: '' },
  ])
  const [shared, setShared] = useState(true)
  const [director, setDirector] = useState<DirectorPersona>(emptyDirector)
  const [coverTheme, setCoverTheme] = useState<CoverTheme>(DEFAULT_COVER)
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>({ pageStyle: 'parchment', ambientEffect: 'none' })
  const [hasDraft, setHasDraft] = useState(false)

  const draft = useDraft<{
    title: string; description: string; worldId: string; rating: ContentRating
    tags: string[]; premise: string; entryPoints: EntryPoint[]; shared: boolean
    director: DirectorPersona; coverTheme: CoverTheme; readingTheme: ReadingTheme
  }>('chronicle:draft:saga')

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  useEffect(() => {
    const saved = draft.load()
    if (saved && (saved.data.title || saved.data.premise || saved.data.entryPoints?.some((e) => e.label || e.premise))) {
      // One-time read of a persisted draft on mount; not reactive state sync.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasDraft(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function restoreDraft() {
    const saved = draft.load()
    if (!saved) return
    const d = saved.data
    setTitle(d.title)
    setDescription(d.description)
    if (d.worldId) setWorldId(d.worldId)
    setRating(d.rating)
    setTags(d.tags)
    setPremise(d.premise)
    if (d.entryPoints?.length) setEntryPoints(d.entryPoints)
    setShared(d.shared ?? true)
    if (d.director) setDirector({ ...emptyDirector(), ...d.director })
    setCoverTheme(d.coverTheme)
    setReadingTheme(d.readingTheme)
    setHasDraft(false)
    toast.success('Draft restored')
  }

  function discardDraft() {
    draft.clear()
    setHasDraft(false)
  }

  useEffect(() => {
    if (!user) return
    fetch('/api/worlds/public')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const list: World[] = data.worlds ?? []
        setWorlds(list)
        if (list.length > 0) {
          const preselect = new URLSearchParams(window.location.search).get('world')
          const match = preselect ? list.find((w) => w.id === preselect) : undefined
          const chosen = match ?? list[0]
          setWorldId(chosen.id)
          if (chosen.rating) setRating(chosen.rating)
        }
      })
      .finally(() => setLoadingWorlds(false))
  }, [user])

  function updateEntry(index: number, patch: Partial<EntryPoint>) {
    setEntryPoints((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const readyEntries = entryPoints.filter((e) => e.label.trim() && e.premise.trim())
  const canSubmit = !!title.trim() && !!worldId && readyEntries.length >= 1 && !submitting

  function applyArchetype(a: DirectorArchetype) {
    // If the preset is already active, toggle it off back to neutral.
    setDirector((cur) => (personaMatches(cur, a.persona) ? emptyDirector() : { ...emptyDirector(), ...a.persona }))
  }

  function resetDirector() {
    setDirector(emptyDirector())
  }

  const directorNotes = describeDirector(director)
  const directorTouched = isDirectorMeaningful(director)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !canSubmit) return

    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const selectedWorld = worlds.find((w) => w.id === worldId)!

      const res = await fetch('/api/sagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          worldId,
          worldName: selectedWorld.name,
          rating,
          tags,
          coverTheme,
          readingTheme,
          shared,
          premise: premise.trim() || null,
          entryPoints: readyEntries.map((ep) => ({ label: ep.label.trim(), premise: ep.premise.trim() })),
          director: isDirectorMeaningful(director)
            ? { ...director, vision: (director.vision ?? '').trim() }
            : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create saga')

      draft.clear()
      toast.success('Your saga awaits its first traveller!')
      router.push(`/stories/${data.id}`)
    } catch (err) {
      draft.save({
        title, description, worldId, rating, tags, premise, entryPoints,
        shared, director, coverTheme, readingTheme,
      })
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      toast.info('Draft saved — your saga is preserved for next time.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!loadingWorlds && worlds.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="glass-card rounded-xl p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/20 flex items-center justify-center mx-auto">
            <Globe className="h-6 w-6 text-amber-400/50" />
          </div>
          <div className="space-y-1.5">
            <p className="text-foreground/70 font-medium">No worlds yet</p>
            <p className="text-muted-foreground/45 text-sm">A saga needs a world to live in. Create one first.</p>
          </div>
          <Link href="/worlds/new">
            <Button size="sm" className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Create a world
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  const worldRating = worlds.find((w) => w.id === worldId)?.rating
  const allowedRatings = worldRating
    ? CONTENT_RATINGS.filter((r) => ratingRank(r) <= ratingRank(worldRating))
    : CONTENT_RATINGS

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-1.5">
        <p className="text-xs text-amber-400/50 uppercase tracking-widest font-sans flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Personal Saga
        </p>
        <h1 className="text-2xl font-bold gold-text">Open a saga in this world</h1>
        <p className="text-sm text-muted-foreground/60 max-w-md">
          A saga is a doorway, not a story you write line by line. You play as <em>yourself</em>, and your
          reputation follows you across the world. Set the situation, sketch a few ways travellers can step
          in, and the storyteller renders each opening for you.
        </p>
      </div>

      {hasDraft && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-300/80">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            You have an unsaved saga draft.
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={discardDraft}
              className="h-7 px-2.5 text-xs text-muted-foreground/50 hover:text-muted-foreground"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={restoreDraft}
              className="h-7 px-2.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
            >
              Restore
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Saga details ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Feather className="h-4 w-4 text-amber-400/55" /> Saga details
          </h2>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="The Tide-Worn Coast" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">
              Description <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
            </Label>
            <Input id="desc" placeholder="A brief tagline for your saga…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Genre tags <span className="text-muted-foreground/55 font-normal text-xs">(up to 5)</span></Label>
            <div className="flex flex-wrap gap-2">
              {STORY_TAGS.map((tag) => {
                const active = tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setTags((prev) => (active ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev))
                    }
                    className={`px-2.5 py-1 rounded-full text-[11px] font-sans border transition-all ${
                      active
                        ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                        : 'border-white/10 text-muted-foreground/40 hover:border-white/20 hover:text-muted-foreground/60'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="world">World</Label>
            {loadingWorlds ? (
              <div className="h-10 rounded-md glass animate-pulse" />
            ) : (
              <select
                id="world"
                value={worldId}
                onChange={(e) => {
                  setWorldId(e.target.value)
                  const w = worlds.find((x) => x.id === e.target.value)
                  if (w?.rating) setRating(w.rating)
                }}
                required
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {worlds.map((w) => (
                  <option key={w.id} value={w.id} className="bg-background">{w.name}</option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-muted-foreground/45">
              Your standing carries across every saga in this world — its people remember how you&apos;ve treated them.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saga-rating">Content rating</Label>
            <select
              id="saga-rating"
              value={rating}
              onChange={(e) => setRating(e.target.value as ContentRating)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {allowedRatings.map((r) => (
                <option key={r} value={r} className="bg-background">{r} ({CONTENT_RATING_META[r].abbr})</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground/45">
              {CONTENT_RATING_META[rating].description}{' '}
              {worldRating ? `Can't exceed the world's ${worldRating} rating.` : 'Defaults to the world’s rating.'}
            </p>
          </div>
        </div>

        {/* ── The situation ── */}
        <div className="glass-card rounded-xl p-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400/55" /> The situation
            </h2>
            <p className="text-[11px] text-muted-foreground/45 mt-1">
              Set the stage that <em>every</em> traveller drops into — the tension in the air, what&apos;s at stake,
              what kind of saga this is. You&apos;re writing a premise, not prose; the storyteller renders the openings.
            </p>
          </div>
          <Textarea
            placeholder="e.g. The coast is on the brink of war between the harbour guilds and the tide-priests. Outsiders are eyed with suspicion — but desperately needed. Anyone who arrives here is quickly forced to take a side…"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            className="min-h-[120px] resize-none text-[14px] leading-relaxed"
            style={{ fontFamily: 'Georgia, serif' }}
          />
        </div>

        {/* ── Entry points ── */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-amber-400/55" /> Ways in
              </h2>
              <p className="text-[11px] text-muted-foreground/45 mt-1 max-w-sm">
                Each is a doorway the reader can choose at the threshold. Give it a short label (what they pick) and a
                premise (what that opening should establish). The storyteller writes each opening in second person.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={entryPoints.length >= MAX_ENTRY_POINTS}
              onClick={() => setEntryPoints((prev) => [...prev, { label: '', premise: '' }])}
              className="text-xs gap-1 border-white/10 hover:bg-white/5 shrink-0"
            >
              <Plus className="h-3 w-3" /> Add way in
            </Button>
          </div>

          <div className="space-y-3">
            {entryPoints.map((ep, index) => (
              <div key={index} className="space-y-2.5 bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-amber-500/70 font-semibold font-sans">
                    Doorway {index + 1}
                  </span>
                  {entryPoints.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEntryPoints((prev) => prev.filter((_, i) => i !== index))}
                      className="h-6 px-1.5 text-red-400/80 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] opacity-50">Label — what the reader picks</Label>
                  <Input
                    placeholder={ENTRY_PLACEHOLDERS[index]?.label ?? 'e.g. Slip in through the smugglers’ tunnel'}
                    value={ep.label}
                    onChange={(e) => updateEntry(index, { label: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] opacity-50">Premise — what this opening establishes</Label>
                  <Textarea
                    placeholder={ENTRY_PLACEHOLDERS[index]?.premise ?? 'A sentence or two the storyteller will render into the opening chapter…'}
                    value={ep.premise}
                    onChange={(e) => updateEntry(index, { premise: e.target.value })}
                    maxLength={600}
                    className="min-h-[70px] resize-none text-[13px] leading-relaxed"
                    style={{ fontFamily: 'Georgia, serif' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/40">
            Rendering costs <strong>1 credit per doorway</strong> — each opening is written when you create the saga.
          </p>
        </div>

        {/* ── Director ── */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-amber-400/60" />
                Director <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground/45 mt-1 max-w-md">
                Shape <em>how</em> every chapter is directed — its craft, mood, and pacing.
                Always stays within your content rating.
              </p>
            </div>
            {directorTouched && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetDirector}
                className="h-7 px-2 shrink-0 text-[11px] text-muted-foreground/50 hover:text-muted-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>

          {/* Archetype presets — one click to a recognizable sensibility */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-sans">
              Start from a style
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DIRECTOR_ARCHETYPES.map((a) => {
                const active = personaMatches(director, a.persona)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => applyArchetype(a)}
                    title={a.tagline}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${
                      active
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                        : 'border-white/10 text-muted-foreground/55 hover:border-amber-500/25 hover:text-amber-200/80'
                    }`}
                  >
                    <span>{a.emoji}</span>
                    {a.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fine-tune each axis */}
          <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3 pt-1">
            {DIRECTOR_AXES.map((axis) => {
              const v = director[axis.key] ?? 0
              return (
                <div key={axis.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-sans">
                    <span className={v < -0.3 ? 'text-amber-300/80' : 'text-muted-foreground/55'}>
                      {axis.left}
                    </span>
                    <span className={v > 0.3 ? 'text-amber-300/80' : 'text-muted-foreground/55'}>
                      {axis.right}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={v}
                    onChange={(e) => setDirector((d) => ({ ...d, [axis.key]: Number(e.target.value) }))}
                    className="w-full accent-amber-500"
                    aria-label={`${axis.left} to ${axis.right}`}
                  />
                  <p className="text-[10px] text-muted-foreground/35">{axis.hint}</p>
                </div>
              )
            })}
          </div>

          <Input
            placeholder="Optional: a one-line directorial vision (e.g. “a tense saga about earning trust”)"
            value={director.vision ?? ''}
            onChange={(e) => setDirector((d) => ({ ...d, vision: e.target.value }))}
            maxLength={300}
          />

          {/* Live preview — exactly the guidance the AI will receive */}
          {directorNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3.5 py-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/60 font-sans flex items-center gap-1.5">
                <Wand2 className="h-3 w-3" /> How your director will shape each chapter
              </p>
              <ul className="space-y-1">
                {directorNotes.map((n, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground/65 leading-snug flex gap-1.5">
                    <span className="text-amber-400/50 shrink-0">›</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/35 italic">
              Neutral — the AI directs with its own instincts. Pick a style above or nudge a slider to guide it.
            </p>
          )}
        </div>

        {/* ── Share ── */}
        <div className="glass-card rounded-xl p-6 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-amber-500" />
            <span className="text-sm">Share with the community</span>
          </label>
          <p className="text-[11px] text-muted-foreground/45">
            {shared
              ? 'Listed in the Personal Saga browse, for anyone to play as themselves.'
              : 'Kept personal — hidden from public listings (still reachable by direct link and from your dashboard).'}
          </p>
        </div>

        {/* ── Cover ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400/55" /> Book Cover Design
          </h2>
          <CoverDesigner
            value={coverTheme}
            onChange={setCoverTheme}
            title={title}
            onGenerateImage={async () => {
              if (!user) return null
              const token = await user.getIdToken()
              const world = worlds.find((w) => w.id === worldId)
              const res = await fetch('/api/ai/cover-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  title: title.trim(),
                  description: description.trim(),
                  tags,
                  worldName: world?.name ?? '',
                  worldDescription: world?.description ?? '',
                }),
              })
              if (!res.ok) return null
              const data = await res.json()
              return data.url ?? null
            }}
          />
        </div>

        {/* ── Reading atmosphere ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Feather className="h-4 w-4 text-amber-400/55" /> Reading Atmosphere
            <span className="text-muted-foreground/55 font-normal text-xs">(readers will see this)</span>
          </h2>
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Page Style</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PAGE_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setReadingTheme((t) => ({ ...t, pageStyle: s.id }))}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                    readingTheme.pageStyle === s.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="w-8 h-10 rounded-sm shadow-inner" style={{ background: s.bg }}>
                    <div className="w-full h-full flex flex-col justify-end p-1 gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-px rounded-full opacity-30" style={{ background: s.text }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[9px] font-sans text-muted-foreground/50">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground/60 uppercase tracking-wider">Ambient Effect</Label>
            <div className="flex flex-wrap gap-2">
              {AMBIENT_EFFECTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setReadingTheme((t) => ({ ...t, ambientEffect: e.id }))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all ${
                    readingTheme.ambientEffect === e.id
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'border-white/10 text-muted-foreground/40 hover:border-white/20'
                  }`}
                >
                  <span>{e.emoji}</span>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Rendering {readyEntries.length} opening{readyEntries.length === 1 ? '' : 's'}…
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4" />
              Open this saga ({readyEntries.length} {readyEntries.length === 1 ? 'doorway' : 'doorways'})
            </>
          )}
        </Button>
      </form>
    </main>
  )
}
