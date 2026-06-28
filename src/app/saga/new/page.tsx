'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2, ChevronRight, ChevronLeft, Check, Plus, Palette, Feather, Sparkles, DoorOpen, Trash2, RotateCcw } from 'lucide-react'
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
import type { World, CoverTheme, ReadingTheme, ContentRating, DirectorPersona } from '@/types'
import { emptyDirector, isDirectorMeaningful } from '@/lib/director'
import { DirectorControls } from '@/components/story/DirectorControls'
import { ReadingThemePicker } from '@/components/book/ReadingThemePicker'

const MAX_ENTRY_POINTS = 4

type EntryPoint = { label: string; premise: string }

const ENTRY_PLACEHOLDERS: EntryPoint[] = [
  { label: 'Wash ashore, half-drowned and nameless', premise: 'You survive a shipwreck and are pulled from the surf by wary fisherfolk who don\'t yet trust you.' },
  { label: 'Arrive with the merchant caravan', premise: 'You ride in through the gates as a hired hand on a trade caravan, seeing the city for the first time.' },
  { label: 'Marched in among the prisoners', premise: 'You are brought into the world in chains, mistaken for someone — or something — you are not.' },
]

// The wizard groups the saga form into ordered, validated steps. Step copy lives
// here so the progress header and panel headings stay in sync.
const STEPS = [
  { id: 'foundation', label: 'Foundation', blurb: 'World, title, and rating' },
  { id: 'situation', label: 'The saga', blurb: 'The situation and ways in' },
  { id: 'voice', label: 'Voice', blurb: 'Direction and style' },
  { id: 'look', label: 'Look & share', blurb: 'Cover, reading, visibility' },
  { id: 'review', label: 'Review', blurb: 'Confirm and open the saga' },
] as const

export default function NewSagaPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [worlds, setWorlds] = useState<World[]>([])
  const [loadingWorlds, setLoadingWorlds] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)

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
  const [styleChoices, setStyleChoices] = useState<Record<string, string>>({})
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
    setStep(0)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // The form only submits for real on the final step; on earlier steps a stray
    // Enter keypress is a no-op (the Next button drives navigation).
    if (step < STEPS.length - 1) return
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
          styleChoices: styleOptions.length > 0
            ? Object.fromEntries(styleOptions.map((o) => [o.label, styleChoices[o.label] ?? o.choices[0]]))
            : undefined,
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

  const selectedWorld = worlds.find((w) => w.id === worldId)
  const styleOptions = selectedWorld?.storySettings?.styleOptions ?? []

  const worldRating = selectedWorld?.rating
  const allowedRatings = worldRating
    ? CONTENT_RATINGS.filter((r) => ratingRank(r) <= ratingRank(worldRating))
    : CONTENT_RATINGS

  // Per-step gating: a step must be valid before the wizard lets you advance.
  const stepValidity = [
    !!title.trim() && !!worldId,
    readyEntries.length >= 1,
    true,
    true,
    canSubmit,
  ]
  const currentValid = stepValidity[step]
  const isLast = step === STEPS.length - 1

  function goNext() {
    if (currentValid && step < STEPS.length - 1) setStep((s) => s + 1)
  }
  function goBack() {
    setStep((s) => Math.max(0, s - 1))
  }

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

      {/* ── Progress header ── */}
      <div className="mb-7">
        <div className="flex items-end gap-1.5">
          {STEPS.map((s, i) => {
            const reached = i <= step
            const done = i < step
            return (
              <button
                key={s.id}
                type="button"
                // Let travellers jump back to a completed step, but not skip ahead
                // past unvalidated ones.
                onClick={() => { if (i < step) setStep(i) }}
                disabled={i > step}
                className={`group flex-1 text-left ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`h-1 rounded-full transition-colors ${reached ? 'bg-amber-400/70' : 'bg-white/10'}`} />
                <span className={`mt-1.5 hidden sm:flex items-center gap-1 text-[10px] uppercase tracking-wider font-sans transition-colors ${
                  i === step ? 'text-amber-300/85' : done ? 'text-amber-400/45' : 'text-muted-foreground/35'
                }`}>
                  {done && <Check className="h-2.5 w-2.5" />}
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/45 font-sans">
          Step {step + 1} of {STEPS.length} — {STEPS[step].blurb}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Step 1: Foundation ── */}
        {step === 0 && (
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
            <Textarea
              id="desc"
              placeholder="A short blurb that sets the hook for your saga…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-y text-sm leading-relaxed"
            />
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
            {selectedWorld?.description && (
              <div className="mt-1 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <Globe className="h-3.5 w-3.5 text-amber-400/55 mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  {selectedWorld.description}
                </p>
              </div>
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
        )}

        {/* ── Step 2: The saga (situation + ways in) ── */}
        {step === 1 && (
        <>
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
        </>
        )}

        {/* ── Step 3: Voice (director + style) ── */}
        {step === 2 && (
        <>
        <div className="glass-card rounded-xl p-6 space-y-4">
          <DirectorControls value={director} onChange={setDirector} />
        </div>

        {styleOptions.length > 0 && (
          <div className="glass-card rounded-xl p-6 space-y-3">
            <div>
              <Label className="text-sm font-medium text-foreground/65 block">This world&apos;s style choices</Label>
              <p className="text-[11px] text-muted-foreground/45 mt-1">
                {selectedWorld?.name} lets each saga pick how these are handled.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {styleOptions.map((opt) => (
                <div key={opt.label} className="space-y-1.5">
                  <Label htmlFor={`style-${opt.label}`} className="text-xs text-muted-foreground/60">{opt.label}</Label>
                  <select
                    id={`style-${opt.label}`}
                    value={styleChoices[opt.label] ?? opt.choices[0]}
                    onChange={(e) => setStyleChoices((prev) => ({ ...prev, [opt.label]: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {opt.choices.map((c) => (
                      <option key={c} value={c} className="bg-background">{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
        {styleOptions.length === 0 && (
          <p className="text-[11px] text-muted-foreground/40 px-1">
            This world doesn&apos;t expose any per-saga style choices. Direction above is all you need.
          </p>
        )}
        </>
        )}

        {/* ── Step 4: Look & share ── */}
        {step === 3 && (
        <>
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

        <ReadingThemePicker value={readingTheme} onChange={setReadingTheme} />

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
        </>
        )}

        {/* ── Step 5: Review ── */}
        {step === 4 && (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Check className="h-4 w-4 text-amber-400/55" /> Review &amp; open
          </h2>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground/45">World</dt>
              <dd className="text-foreground/80 text-right">{selectedWorld?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground/45">Title</dt>
              <dd className="text-foreground/80 text-right">{title.trim() || <span className="text-red-400/70">Missing</span>}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground/45">Rating</dt>
              <dd className="text-foreground/80 text-right">{rating}</dd>
            </div>
            {tags.length > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground/45">Tags</dt>
                <dd className="text-foreground/80 text-right">{tags.join(', ')}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground/45">Direction</dt>
              <dd className="text-foreground/80 text-right">{isDirectorMeaningful(director) ? 'Custom' : 'Storyteller’s choice'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground/45">Visibility</dt>
              <dd className="text-foreground/80 text-right">{shared ? 'Shared with community' : 'Personal'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground/45">Doorways</dt>
              <dd className="text-foreground/80 text-right">
                {readyEntries.length > 0
                  ? `${readyEntries.length} ready`
                  : <span className="text-red-400/70">None yet — add at least one</span>}
              </dd>
            </div>
          </dl>

          {readyEntries.length > 0 && (
            <ul className="space-y-1.5 border-t border-white/[0.06] pt-4">
              {readyEntries.map((ep, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground/65">
                  <DoorOpen className="h-3.5 w-3.5 text-amber-400/45 mt-0.5 shrink-0" />
                  <span>{ep.label}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground/45 border-t border-white/[0.06] pt-4">
            Rendering costs <strong>1 credit per doorway</strong> — {readyEntries.length} opening{readyEntries.length === 1 ? '' : 's'} will be written now.
          </p>
        </div>
        )}

        {/* ── Wizard navigation ── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={submitting}
              className="gap-1.5 text-muted-foreground/60 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}

          {!isLast ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!currentValid}
              className="gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!canSubmit}
              className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
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
          )}
        </div>
      </form>
    </main>
  )
}
