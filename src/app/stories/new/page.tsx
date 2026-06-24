'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, Globe, Loader2, ChevronRight, Plus, Palette, Feather, Sparkles, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import { STORY_TAGS, CONTENT_RATINGS, CONTENT_RATING_META, DEFAULT_CONTENT_RATING } from '@/types'
import { ratingRank } from '@/lib/ratings'
import { CoverDesigner, DEFAULT_COVER } from '@/components/book/CoverDesigner'
import type { World, CoverTheme, ReadingTheme, PageStyle, AmbientEffect, ContentRating } from '@/types'
import { AIAssistModal } from '@/components/ai/AIAssistModal'
import type { StoryAssistResult } from '@/components/ai/AIAssistModal'
import { useDraft } from '@/hooks/useDraft'

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

export default function NewStoryPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [worlds, setWorlds] = useState<World[]>([])
  const [loadingWorlds, setLoadingWorlds] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [worldId, setWorldId] = useState('')
  const [rating, setRating] = useState<ContentRating>(DEFAULT_CONTENT_RATING)
  const [protagonistName, setProtagonistName] = useState('')
  const [protagonistDesc, setProtagonistDesc] = useState('')
  const [shared, setShared] = useState(true)
  const [director, setDirector] = useState({ experimental: 0, intensity: 0, darkness: 0, pace: 0, vision: '' })
  const [opening, setOpening] = useState('')
  const [choice1, setChoice1] = useState('')
  const [choice2, setChoice2] = useState('')
  const [choice3, setChoice3] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [coverTheme, setCoverTheme] = useState<CoverTheme>(DEFAULT_COVER)
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>({
    pageStyle: 'parchment',
    ambientEffect: 'none',
  })
  const [goapEnabled, setGoapEnabled] = useState(false)
  const [implementQuests, setImplementQuests] = useState(false)

  type EconomyEffectRow = {
    commodityId: string
    condition: 'scarce' | 'cheap'
    resourceName: string
    operator: '=' | '+=' | '-='
    value: string
  }
  const [economyEffects, setEconomyEffects] = useState<EconomyEffectRow[]>([])

  const COMMODITIES = [
    { id: 'food', name: 'Food' },
    { id: 'iron', name: 'Iron' },
    { id: 'lumber', name: 'Lumber' },
    { id: 'cloth', name: 'Cloth' },
    { id: 'weapons', name: 'Weapons' },
    { id: 'magic_dust', name: 'Magic Dust' },
  ] as const

  const [resources, setResources] = useState<{
    name: string
    type: 'number' | 'string' | 'array' | 'boolean'
    defaultValue: string
    description?: string
    min?: number
    max?: number
    hidden?: boolean
    icon?: string
    displayAs?: 'value' | 'bar' | 'badge' | 'checkbox'
    color?: string
    isInitialChoice?: boolean
    choices?: string
  }[]>([])

  const draft = useDraft<{
    title: string; description: string; worldId: string; rating: ContentRating
    protagonistName: string; protagonistDesc: string; opening: string
    choice1: string; choice2: string; choice3: string; tags: string[]
    coverTheme: CoverTheme; readingTheme: ReadingTheme
    resources: typeof resources
    goapEnabled: boolean; implementQuests: boolean
    director: typeof director
    shared: boolean
  }>('chronicle:draft:story')

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  useEffect(() => {
    const saved = draft.load()
    if (saved && (saved.data.title || saved.data.opening)) setHasDraft(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function restoreDraft() {
    const saved = draft.load()
    if (!saved) return
    const d = saved.data
    setTitle(d.title)
    setDescription(d.description)
    if (d.worldId) setWorldId(d.worldId)
    setRating(d.rating)
    setProtagonistName(d.protagonistName)
    setProtagonistDesc(d.protagonistDesc)
    setOpening(d.opening)
    setChoice1(d.choice1)
    setChoice2(d.choice2)
    setChoice3(d.choice3)
    setTags(d.tags)
    setCoverTheme(d.coverTheme)
    setReadingTheme(d.readingTheme)
    setResources(d.resources)
    setGoapEnabled(d.goapEnabled ?? false)
    setImplementQuests(d.implementQuests ?? false)
    if (d.director) setDirector(d.director)
    setShared(d.shared ?? true)
    setHasDraft(false)
    toast.success('Draft restored')
  }

  function discardDraft() {
    draft.clear()
    setHasDraft(false)
  }

  useEffect(() => {
    if (!user) return
    // Worlds are shared — any signed-in user can author a story in any public
    // world, not just worlds they created. Use the public registry here.
    fetch('/api/worlds/public')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const list: World[] = data.worlds ?? []
        setWorlds(list)
        if (list.length > 0) {
          // Honour ?world=<id> preselection coming from a world page.
          const preselect = new URLSearchParams(window.location.search).get('world')
          const match = preselect ? list.find((w) => w.id === preselect) : undefined
          const chosen = match ?? list[0]
          setWorldId(chosen.id)
          // Default the story's rating to its world's rating.
          if (chosen.rating) setRating(chosen.rating)
        }
      })
      .finally(() => setLoadingWorlds(false))
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title.trim() || !worldId || !opening.trim()) return

    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const selectedWorld = worlds.find((w) => w.id === worldId)!

      const formattedResources = resources
        .filter((r) => r.name.trim() !== '')
        .map((r) => {
          let defaultValue: any = r.defaultValue
          if (r.type === 'array') {
            defaultValue = typeof r.defaultValue === 'string'
              ? r.defaultValue.split(',').map(s => s.trim()).filter(Boolean)
              : []
          } else if (r.type === 'number') {
            defaultValue = Number(r.defaultValue || 0)
          } else if (r.type === 'boolean') {
            defaultValue = r.defaultValue === 'true'
          }

          return {
            name: r.name.trim(),
            type: r.type,
            defaultValue,
            description: r.description?.trim() || undefined,
            min: r.type === 'number' && r.min !== undefined ? Number(r.min) : undefined,
            max: r.type === 'number' && r.max !== undefined ? Number(r.max) : undefined,
            hidden: r.hidden || false,
            icon: r.icon?.trim() || undefined,
            displayAs: r.displayAs || undefined,
            color: r.color || undefined,
            isInitialChoice: r.isInitialChoice || false,
            choices: r.isInitialChoice && r.choices
              ? r.choices.split('\n').map(s => s.trim()).filter(Boolean)
              : undefined,
          }
        })

      const storyRes = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          worldId,
          worldName: selectedWorld.name,
          rating,
          shared,
          protagonist: protagonistName.trim()
            ? { name: protagonistName.trim(), description: protagonistDesc.trim() }
            : undefined,
          director:
            director.experimental || director.intensity || director.darkness || director.pace || director.vision.trim()
              ? { ...director, vision: director.vision.trim() }
              : undefined,
          published: true,
          coverGradient: null,
          resources: formattedResources,
          tags,
          coverTheme,
          readingTheme,
          goapEnabled,
          implementQuests,
          economyEffects: goapEnabled && economyEffects.length > 0
            ? economyEffects
                .filter((e) => e.resourceName.trim() !== '' && e.value.trim() !== '')
                .map((e) => ({ ...e, value: Number(e.value) }))
            : undefined,
        }),
      })
      if (!storyRes.ok) {
        throw new Error((await storyRes.json()).error ?? 'Failed to create story')
      }
      const { id: storyId } = await storyRes.json()

      const choices = [choice1, choice2, choice3].map((c) => c.trim()).filter(Boolean)
      const nodeRes = await fetch(`/api/stories/${storyId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: opening.trim(), depth: 0, choices }),
      })
      if (!nodeRes.ok) throw new Error('Failed to create opening chapter')

      draft.clear()
      toast.success('Your story has been born!')
      router.push(`/stories/${storyId}`)
    } catch (err) {
      draft.save({
        title, description, worldId, rating,
        protagonistName, protagonistDesc, opening,
        choice1, choice2, choice3, tags,
        coverTheme, readingTheme, resources,
        goapEnabled, implementQuests, director, shared,
      })
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      toast.info('Draft saved — your story is preserved for next time.')
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
            <p className="text-muted-foreground/45 text-sm">
              A story needs a world to exist in. Create one first.
            </p>
          </div>
          <Link href="/worlds/new">
            <Button
              size="sm"
              className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create a world
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  // A story can't be rated more mature than its world.
  const worldRating = worlds.find((w) => w.id === worldId)?.rating
  const allowedRatings = worldRating
    ? CONTENT_RATINGS.filter((r) => ratingRank(r) <= ratingRank(worldRating))
    : CONTENT_RATINGS

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-1">
        <p className="text-xs text-amber-400/50 uppercase tracking-widest font-sans">Chronicle</p>
        <h1 className="text-2xl font-bold gold-text">Begin a new story</h1>
        <p className="text-sm text-muted-foreground/60 max-w-sm">
          Write the opening chapter. The community will weave everything that follows.
        </p>
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAiModalOpen(true)}
            className="gap-1.5 border-amber-500/25 text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Inspire with AI
          </Button>
        </div>
      </div>

      <AIAssistModal
        type="story"
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        worldContext={worlds.find((w) => w.id === worldId) ?? null}
        onGenerated={(result: StoryAssistResult) => {
          setTitle(result.title)
          setDescription(result.description)
          setOpening(result.opening)
          setChoice1(result.choice1)
          setChoice2(result.choice2)
          setChoice3(result.choice3)
          setProtagonistName(result.protagonistName)
          setProtagonistDesc(result.protagonistDesc)
          setTags(result.tags)
        }}
      />

      {hasDraft && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-300/80">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            You have an unsaved story draft.
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
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400/55" />
            Story details
          </h2>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="The Shattered Crown"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">
              Description{' '}
              <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="desc"
              placeholder="A brief tagline for your story…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Genre tags{' '}
              <span className="text-muted-foreground/55 font-normal text-xs">(up to 5)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {STORY_TAGS.map((tag) => {
                const active = tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setTags((prev) =>
                        active ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev,
                      )
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
                  <option key={w.id} value={w.id} className="bg-background">
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="story-rating">Content rating</Label>
            <select
              id="story-rating"
              value={rating}
              onChange={(e) => setRating(e.target.value as ContentRating)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {allowedRatings.map((r) => (
                <option key={r} value={r} className="bg-background">
                  {r} ({CONTENT_RATING_META[r].abbr})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground/45">
              {CONTENT_RATING_META[rating].description}{' '}
              {worldRating
                ? `Can't exceed the world's ${worldRating} rating.`
                : 'Defaults to the world’s rating; a moderator may adjust it.'}
            </p>
          </div>

          <div className="space-y-2 border-t border-white/[0.06] pt-5">
            <Label htmlFor="protagonist" className="block">
              Protagonist{' '}
              <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="protagonist"
              placeholder="Who does the reader play as? e.g. Elara, a cautious thief"
              value={protagonistName}
              onChange={(e) => setProtagonistName(e.target.value)}
            />
            {protagonistName.trim() && (
              <Input
                placeholder="A short description the AI should keep consistent (optional)"
                value={protagonistDesc}
                onChange={(e) => setProtagonistDesc(e.target.value)}
              />
            )}
            <p className="text-[11px] text-muted-foreground/45">
              The AI writes the story around this character by name. The rest of the cast emerges
              as your story grows.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400/70 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
                Want the reader to play as <em>themselves</em>, with a reputation that follows them across the
                world?{' '}
                <Link href="/saga/new" className="text-amber-300/85 hover:underline font-medium">
                  Create a Personal Saga
                </Link>{' '}
                instead — it’s built for that.
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/[0.06] pt-5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="accent-amber-500"
              />
              <span className="text-sm">Share with the community</span>
            </label>
            <p className="text-[11px] text-muted-foreground/45">
              {shared
                ? 'Listed in the library for anyone to read.'
                : 'Kept personal — hidden from public listings (still reachable by direct link and from your dashboard).'}
            </p>
          </div>

          <div className="space-y-3 border-t border-white/[0.06] pt-5">
            <Label>
              Director{' '}
              <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
            </Label>
            <p className="text-[11px] text-muted-foreground/45 -mt-1">
              Sets the directorial sensibility — how chapters are directed, within your rating.
            </p>
            {([
              { key: 'experimental', left: 'Traditional', right: 'Experimental' },
              { key: 'intensity', left: 'Sensitive', right: 'Assertive' },
              { key: 'darkness', left: 'Romantic', right: 'Scary' },
              { key: 'pace', left: 'Slow-burn', right: 'Propulsive' },
            ] as const).map(({ key, left, right }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-sans text-muted-foreground/55">
                  <span>{left}</span>
                  <span>{right}</span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={director[key]}
                  onChange={(e) => setDirector((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  className="w-full accent-amber-500"
                  aria-label={`${left} to ${right}`}
                />
              </div>
            ))}
            <Input
              placeholder="Optional: a one-line directorial vision (e.g. “a tender story about quiet courage”)"
              value={director.vision}
              onChange={(e) => setDirector((d) => ({ ...d, vision: e.target.value }))}
              maxLength={300}
            />
          </div>

          <div className="space-y-4 border-t border-white/[0.06] pt-5 mt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500/80 font-sans">
                  Story Resources
                </h3>
                <p className="text-[11px] text-muted-foreground/45 mt-0.5">
                  Stats, inventory, flags, and reader choices. Locked once the story is published.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResources((prev) => [...prev, { name: '', type: 'number', defaultValue: '0' }])}
                className="text-xs gap-1 border-white/10 hover:bg-white/5"
              >
                <Plus className="h-3 w-3" /> Add Resource
              </Button>
            </div>

            {resources.length > 0 && (
              <div className="space-y-3 mt-3">
                {resources.map((res, index) => {
                  const nameId = `resource-name-${index}`
                  const typeId = `resource-type-${index}`
                  const valId  = `resource-val-${index}`
                  function updateRes(patch: Partial<typeof resources[0]>) {
                    setResources((prev) => {
                      const next = [...prev]
                      next[index] = { ...next[index], ...patch }
                      return next
                    })
                  }
                  return (
                    <div key={index} className="space-y-2.5 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">

                      {/* ── Row 1: name / type / default / delete ── */}
                      <div className="flex gap-2.5 items-end">
                        <div className="flex-1 space-y-1.5">
                          <Label htmlFor={nameId} className="text-[11px] opacity-40">Variable Name</Label>
                          <Input
                            id={nameId}
                            placeholder="e.g. Gold"
                            value={res.name}
                            onChange={(e) => updateRes({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                          />
                        </div>
                        <div className="w-40 space-y-1.5">
                          <Label htmlFor={typeId} className="text-[11px] opacity-40">Type</Label>
                          <select
                            id={typeId}
                            value={res.type}
                            onChange={(e) => {
                              const t = e.target.value as typeof res.type
                              updateRes({
                                type: t,
                                defaultValue: t === 'number' ? '0' : t === 'boolean' ? 'false' : '',
                                min: undefined,
                                max: undefined,
                                displayAs: undefined,
                                isInitialChoice: false,
                                choices: '',
                              })
                            }}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                          >
                            <option value="number">Number (stat)</option>
                            <option value="string">String (text)</option>
                            <option value="array">Array (inventory)</option>
                            <option value="boolean">Boolean (flag)</option>
                          </select>
                        </div>

                        {/* Starting value — hidden for boolean (uses a toggle instead) */}
                        {res.type !== 'boolean' && (
                          <div className="flex-1 space-y-1.5">
                            <Label htmlFor={valId} className="text-[11px] opacity-40">Starting Value</Label>
                            <Input
                              id={valId}
                              placeholder={res.type === 'number' ? '0' : res.type === 'array' ? 'e.g. key, sword' : 'None'}
                              value={res.defaultValue}
                              onChange={(e) => updateRes({ defaultValue: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Boolean starting state */}
                        {res.type === 'boolean' && (
                          <div className="space-y-1.5">
                            <Label className="text-[11px] opacity-40">Default</Label>
                            <select
                              value={res.defaultValue}
                              onChange={(e) => updateRes({ defaultValue: e.target.value })}
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                            >
                              <option value="false">False</option>
                              <option value="true">True</option>
                            </select>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setResources((prev) => prev.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 px-2.5"
                        >
                          Delete
                        </Button>
                      </div>

                      {/* ── Row 2: description / bounds ── */}
                      <div className="flex flex-wrap gap-3 items-center pt-2.5 border-t border-white/[0.03]">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <Label htmlFor={`resource-desc-${index}`} className="text-[9px] opacity-35">Description (tooltip for readers)</Label>
                          <Input
                            id={`resource-desc-${index}`}
                            placeholder="e.g. How much gold you're carrying"
                            value={res.description || ''}
                            onChange={(e) => updateRes({ description: e.target.value })}
                            className="h-8 text-xs placeholder:opacity-50"
                          />
                        </div>

                        {res.type === 'number' && (
                          <>
                            <div className="w-20 space-y-1">
                              <Label htmlFor={`resource-min-${index}`} className="text-[9px] opacity-35">Min</Label>
                              <Input
                                id={`resource-min-${index}`}
                                type="number"
                                placeholder="None"
                                value={res.min !== undefined ? res.min : ''}
                                onChange={(e) => updateRes({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <Label htmlFor={`resource-max-${index}`} className="text-[9px] opacity-35">Max</Label>
                              <Input
                                id={`resource-max-${index}`}
                                type="number"
                                placeholder="None"
                                value={res.max !== undefined ? res.max : ''}
                                onChange={(e) => updateRes({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── Row 3: display options ── */}
                      <div className="flex flex-wrap gap-3 items-center pt-2.5 border-t border-white/[0.03]">
                        <div className="space-y-1">
                          <Label className="text-[9px] opacity-35">Display As</Label>
                          <select
                            value={res.displayAs || ''}
                            onChange={(e) => updateRes({ displayAs: (e.target.value || undefined) as typeof res.displayAs })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
                          >
                            <option value="">Default</option>
                            {res.type === 'number' && (
                              <>
                                <option value="value">Value</option>
                                <option value="bar">Progress Bar</option>
                              </>
                            )}
                            {res.type === 'array' && (
                              <>
                                <option value="value">Comma list</option>
                                <option value="badge">Badges</option>
                              </>
                            )}
                            {res.type === 'boolean' && (
                              <option value="checkbox">Checkbox</option>
                            )}
                            {res.type === 'string' && (
                              <option value="value">Value</option>
                            )}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[9px] opacity-35">Icon (emoji)</Label>
                          <Input
                            placeholder="⚔️"
                            value={res.icon || ''}
                            onChange={(e) => updateRes({ icon: e.target.value })}
                            className="h-8 w-16 text-center text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[9px] opacity-35">Accent Color</Label>
                          <input
                            type="color"
                            value={res.color || '#fbbf24'}
                            onChange={(e) => updateRes({ color: e.target.value })}
                            className="h-8 w-10 rounded-md border border-input bg-background cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 pt-4">
                          <input
                            type="checkbox"
                            id={`resource-hidden-${index}`}
                            checked={res.hidden || false}
                            onChange={(e) => updateRes({ hidden: e.target.checked })}
                            className="rounded bg-background border-input h-3.5 w-3.5"
                          />
                          <Label htmlFor={`resource-hidden-${index}`} className="text-[10px] opacity-50 cursor-pointer">
                            Hidden (secret variable)
                          </Label>
                        </div>
                      </div>

                      {/* ── Row 4: Initial choice (string type only) ── */}
                      {res.type === 'string' && (
                        <div className="pt-2.5 border-t border-white/[0.03] space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`resource-initial-${index}`}
                              checked={res.isInitialChoice || false}
                              onChange={(e) => updateRes({ isInitialChoice: e.target.checked, choices: '' })}
                              className="rounded bg-background border-input h-3.5 w-3.5"
                            />
                            <Label htmlFor={`resource-initial-${index}`} className="text-[10px] text-amber-400/70 cursor-pointer font-medium">
                              Reader picks this once at the start (class selection, origin, etc.)
                            </Label>
                          </div>
                          {res.isInitialChoice && (
                            <div className="space-y-1 pl-5">
                              <Label className="text-[9px] opacity-35">Options (one per line)</Label>
                              <textarea
                                placeholder={"Warrior\nMage\nRogue"}
                                value={res.choices || ''}
                                onChange={(e) => updateRes({ choices: e.target.value })}
                                rows={3}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground/70 placeholder:opacity-30 focus:outline-none focus:border-amber-500/30 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Cover Designer ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400/55" />
            Book Cover Design
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

        {/* ── Reading Theme ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Feather className="h-4 w-4 text-amber-400/55" />
            Reading Atmosphere
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
                    readingTheme.pageStyle === s.id
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className="w-8 h-10 rounded-sm shadow-inner"
                    style={{ background: s.bg }}
                  >
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

        {/* ── Advanced Engine Features ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400/55" />
            Advanced Engine Features
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="goapEnabled"
                checked={goapEnabled}
                onChange={(e) => setGoapEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded bg-background border-input text-amber-500 focus:ring-amber-500 disabled:opacity-60"
              />
              <div className="space-y-1">
                <Label htmlFor="goapEnabled" className="text-sm cursor-pointer">
                  Enable GOAP AI Characters
                </Label>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  Allows characters to autonomously form goals and execute plans behind the scenes based on the story&apos;s world state. 
                  This creates a dynamic, living world where characters act independently of the reader.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="implementQuests"
                checked={implementQuests}
                onChange={(e) => setImplementQuests(e.target.checked)}
                className="mt-1 h-4 w-4 rounded bg-background border-input text-amber-500 focus:ring-amber-500"
              />
              <div className="space-y-1">
                <Label htmlFor="implementQuests" className="text-sm cursor-pointer">Enable Procedural Quests</Label>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  Dynamically generates side-quests and minor encounters as the reader explores. This uses the world seed to ensure consistent generation.
                </p>
              </div>
            </div>

            {/* Economy ↔ Resource rules — only meaningful when GOAP runs the simulation */}
            {goapEnabled && (
              <div className="border-t border-white/[0.06] pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/80 font-sans">
                      Market Effects
                    </h3>
                    <p className="text-[11px] text-muted-foreground/45 mt-0.5">
                      When a commodity becomes scarce or cheap, modify reader resources automatically.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEconomyEffects((prev) => [
                      ...prev,
                      { commodityId: 'food', condition: 'scarce', resourceName: '', operator: '-=', value: '5' },
                    ])}
                    className="text-xs gap-1 border-white/10 hover:bg-white/5 shrink-0"
                  >
                    <Plus className="h-3 w-3" /> Add Rule
                  </Button>
                </div>

                {economyEffects.length > 0 && (
                  <div className="space-y-2">
                    {economyEffects.map((rule, idx) => {
                      function updateRule(patch: Partial<EconomyEffectRow>) {
                        setEconomyEffects((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], ...patch }
                          return next
                        })
                      }
                      return (
                        <div key={idx} className="flex flex-wrap gap-2 items-center bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-lg text-[11px]">
                          <span className="text-muted-foreground/50 font-sans shrink-0">When</span>
                          <select
                            value={rule.commodityId}
                            title="Commodity"
                            onChange={(e) => updateRule({ commodityId: e.target.value })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] focus:outline-none"
                          >
                            {COMMODITIES.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <span className="text-muted-foreground/50 font-sans shrink-0">is</span>
                          <select
                            value={rule.condition}
                            title="Market condition"
                            onChange={(e) => updateRule({ condition: e.target.value as EconomyEffectRow['condition'] })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] focus:outline-none"
                          >
                            <option value="scarce">scarce (&gt;1.5×)</option>
                            <option value="cheap">cheap (&lt;0.5×)</option>
                          </select>
                          <span className="text-muted-foreground/50 font-sans shrink-0">→</span>
                          <input
                            type="text"
                            value={rule.resourceName}
                            placeholder="Resource name"
                            onChange={(e) => updateRule({ resourceName: e.target.value })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] w-28 focus:outline-none"
                          />
                          <select
                            value={rule.operator}
                            title="Operator"
                            onChange={(e) => updateRule({ operator: e.target.value as EconomyEffectRow['operator'] })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] focus:outline-none"
                          >
                            <option value="+=">{'+='}</option>
                            <option value="-=">{'−='}</option>
                            <option value="=">{'='}</option>
                          </select>
                          <input
                            type="number"
                            value={rule.value}
                            title="Effect value"
                            placeholder="0"
                            onChange={(e) => updateRule({ value: e.target.value })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] w-16 focus:outline-none"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEconomyEffects((prev) => prev.filter((_, i) => i !== idx))}
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <Label htmlFor="opening" className="text-sm font-medium text-foreground/65 block">Opening chapter</Label>
          <Textarea
            id="opening"
            placeholder="Set the scene. Introduce your world. Hook the reader from the very first sentence…"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            required
            className="min-h-[200px] resize-none text-[15px] leading-relaxed"
            style={{ fontFamily: 'Georgia, serif' }}
          />
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-foreground/65">
              Seed choices{' '}
              <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
            </h2>
            <p className="text-xs text-muted-foreground/45 mt-1">
              Suggest where the story might go. Leave blank for open-ended community discovery.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="path1" className="text-xs text-muted-foreground/45">Path 1</Label>
            <Input
              id="path1"
              placeholder="Where might the first path lead?"
              value={choice1}
              onChange={(e) => setChoice1(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="path2" className="text-xs text-muted-foreground/45">Path 2</Label>
            <Input
              id="path2"
              placeholder="Where might the second path lead?"
              value={choice2}
              onChange={(e) => setChoice2(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="path3" className="text-xs text-muted-foreground/45">Path 3</Label>
            <Input
              id="path3"
              placeholder="Where might the third path lead?"
              value={choice3}
              onChange={(e) => setChoice3(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting || !title.trim() || !worldId || !opening.trim()}
          className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating story…
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4" />
              Begin this tale
            </>
          )}
        </Button>
      </form>
    </main>
  )
}
