'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, Globe, Loader2, ChevronRight, Plus, Palette, Sparkles, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import { STORY_TAGS, CONTENT_RATINGS, CONTENT_RATING_META, DEFAULT_CONTENT_RATING } from '@/types'
import { ratingRank } from '@/lib/ratings'
import { CoverDesigner, DEFAULT_COVER } from '@/components/book/CoverDesigner'
import type { World, CoverTheme, ReadingTheme, ContentRating, DirectorPersona, EndingCondition } from '@/types'
import { emptyDirector, isDirectorMeaningful } from '@/lib/director'
import { DirectorControls } from '@/components/story/DirectorControls'
import { StoryResourcesEditor, type StoryResourceDraft } from '@/components/story/StoryResourcesEditor'
import { ReadingThemePicker } from '@/components/book/ReadingThemePicker'
import { AdvancedEngineFeatures, type EconomyEffectRow } from '@/components/story/AdvancedEngineFeatures'
import { AIAssistModal } from '@/components/ai/AIAssistModal'
import type { StoryAssistResult } from '@/components/ai/AIAssistModal'
import { CreationWizard, type CreationMode, type WizardStep } from '@/components/creation/CreationWizard'
import { useDraft } from '@/hooks/useDraft'
import { SAGA_HANDOFF_KEY, type SagaHandoff } from '@/lib/saga-handoff'
import { resolveNarrativeMode } from '@/lib/engine/narrative-mode'

export default function NewStoryPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [worlds, setWorlds] = useState<World[]>([])
  const [loadingWorlds, setLoadingWorlds] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)

  // "60-second start": arriving with ?assist=1 opens the AI inspiration wizard
  // immediately, so a newcomer is writing within a couple of taps.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('assist') !== '1') return
    const t = setTimeout(() => setAiModalOpen(true), 400)
    return () => clearTimeout(t)
  }, [])
  const [hasDraft, setHasDraft] = useState(false)
  const [mode, setMode] = useState<CreationMode>('simple')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [worldId, setWorldId] = useState('')
  const [rating, setRating] = useState<ContentRating>(DEFAULT_CONTENT_RATING)
  const [protagonistName, setProtagonistName] = useState('')
  const [protagonistDesc, setProtagonistDesc] = useState('')
  const [shared, setShared] = useState(true)
  const [director, setDirector] = useState<DirectorPersona>(emptyDirector)
  // This story's pick for each of the selected world's configurable style options.
  const [styleChoices, setStyleChoices] = useState<Record<string, string>>({})
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

  const [economyEffects, setEconomyEffects] = useState<EconomyEffectRow[]>([])
  const [endingConditions, setEndingConditions] = useState<EndingCondition[]>([])
  const [storyNarrativeMode, setStoryNarrativeMode] = useState<'inherit' | 'gentle'>('inherit')
  const [resources, setResources] = useState<StoryResourceDraft[]>([])

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

  // One-shot transfer into the saga creator, so deciding to make a saga mid-way
  // doesn't discard what's already been written.
  const sagaHandoff = useDraft<SagaHandoff>(SAGA_HANDOFF_KEY)

  function handoffToSaga() {
    // Carry the written opening (or the description) as the saga's premise, and
    // turn the authored protagonist into a seeded doorway — best-effort, since a
    // saga is played in second person.
    const seededPremise = (opening.trim() || description.trim()).slice(0, 1000)
    const doorway = (protagonistDesc.trim() || opening.trim()).slice(0, 600)
    const entryPoints = doorway
      ? [
          {
            label: (protagonistName.trim() ? `In the path of ${protagonistName.trim()}` : 'Begin your tale').slice(0, 120),
            premise: doorway,
          },
          { label: '', premise: '' },
        ]
      : []
    sagaHandoff.save({
      title: title.trim(),
      description: description.trim(),
      worldId,
      rating,
      tags,
      director,
      styleChoices,
      coverTheme,
      readingTheme,
      shared,
      premise: seededPremise,
      entryPoints,
      source: 'story-draft',
    })
    router.push('/saga/new')
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  // Read draft availability once after mount (not during render) so the server
  // and client agree on first paint; the banner then appears if a draft exists.
  // The flag stays dismissable via setHasDraft(false) in the handlers below.
  useEffect(() => {
    const saved = draft.load()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount external-store read; see note above
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
    if (d.director) setDirector({ ...emptyDirector(), ...d.director })
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

  // The currently-selected world (drives the description preview, style options,
  // and rating ceiling below).
  const selectedWorld = worlds.find((w) => w.id === worldId)
  // The selected world's configurable style options (empty for most worlds).
  const styleOptions = selectedWorld?.storySettings?.styleOptions ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title.trim() || !worldId || !opening.trim()) return

    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const selected = worlds.find((w) => w.id === worldId)!

      const formattedResources = resources
        .filter((r) => r.name.trim() !== '')
        .map((r) => {
          let defaultValue: string | number | boolean | string[] = r.defaultValue
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
          worldName: selected.name,
          rating,
          shared,
          protagonist: protagonistName.trim()
            ? { name: protagonistName.trim(), description: protagonistDesc.trim() }
            : undefined,
          director: isDirectorMeaningful(director)
            ? { ...director, vision: (director.vision ?? '').trim() }
            : undefined,
          // Default any untouched option to its first choice.
          styleChoices: styleOptions.length > 0
            ? Object.fromEntries(styleOptions.map((o) => [o.label, styleChoices[o.label] ?? o.choices[0]]))
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
                .filter((eff) => eff.resourceName.trim() !== '' && eff.value.trim() !== '')
                .map((eff) => ({ ...eff, value: Number(eff.value) }))
            : undefined,
          narrativeMode: storyNarrativeMode === 'gentle' ? 'gentle' : undefined,
          endingConditions: endingConditions.length > 0
            ? endingConditions.filter((c) => c.resourceName.trim() !== '' && c.title.trim() !== '')
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
  const worldRating = selectedWorld?.rating
  const allowedRatings = worldRating
    ? CONTENT_RATINGS.filter((r) => ratingRank(r) <= ratingRank(worldRating))
    : CONTENT_RATINGS

  // ── Section building blocks (shared by the guided steps and the advanced form) ──

  const basicsCard = (
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
        <Textarea
          id="desc"
          placeholder="A short blurb that sets the hook for your story…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px] resize-y text-sm leading-relaxed"
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
        {selectedWorld?.description && (
          <div className="mt-1 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <Globe className="h-3.5 w-3.5 text-amber-400/55 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              {selectedWorld.description}
            </p>
          </div>
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

      {/* Story mood — only offered when the world itself isn't gentle (a gentle
          world is law: all its stories are gentle, no override possible). */}
      {selectedWorld && resolveNarrativeMode(selectedWorld) !== 'gentle' && (
        <div className="space-y-2">
          <Label htmlFor="story-mood">Story mood</Label>
          <select
            id="story-mood"
            value={storyNarrativeMode}
            onChange={(e) => setStoryNarrativeMode(e.target.value as 'inherit' | 'gentle')}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="inherit" className="bg-background">Match the world — dramatic arcs, real stakes</option>
            <option value="gentle" className="bg-background">🌿 Gentle — wonder, friendship, and joy; no conflict</option>
          </select>
          <p className="text-[11px] text-muted-foreground/45">
            A gentle story has climaxes of connection and discovery — never threats or villains.
          </p>
        </div>
      )}
    </div>
  )

  const protagonistCard = (
    <div className="glass-card rounded-xl p-6 space-y-2">
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
          <button
            type="button"
            onClick={handoffToSaga}
            className="text-amber-300/85 hover:underline font-medium"
          >
            Turn this into a Personal Saga
          </button>{' '}
          instead — it’s built for that, and brings your work along.
        </p>
      </div>
    </div>
  )

  const shareCard = (
    <div className="glass-card rounded-xl p-6 space-y-2">
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
  )

  const advancedOptionsCard = (
    <div className="glass-card rounded-xl p-6 space-y-5">
      <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400/55" />
        Direction &amp; advanced options
      </h2>

      <DirectorControls value={director} onChange={setDirector} />

      {styleOptions.length > 0 && (
        <div className="space-y-3 border-t border-white/[0.06] pt-5">
          <div>
            <Label className="text-sm font-medium text-foreground/65 block">This world&apos;s style choices</Label>
            <p className="text-[11px] text-muted-foreground/45 mt-1">
              {selectedWorld?.name} lets each story pick how these are handled.
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

      <StoryResourcesEditor resources={resources} setResources={setResources} />
    </div>
  )

  const coverCard = (
    <div className="glass-card rounded-xl p-6 space-y-5">
      <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
        <Palette className="h-4 w-4 text-amber-400/55" />
        Book Cover Design
      </h2>
      <p className="text-[11px] text-muted-foreground/45 -mt-2">
        The cover for <em>this story</em> — its spine on the shelf. The world&apos;s own banner is set once,
        when the world is created.
      </p>
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
  )

  const openingCard = (
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
  )

  const choicesCard = (
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
        <Input id="path1" placeholder="Where might the first path lead?" value={choice1} onChange={(e) => setChoice1(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="path2" className="text-xs text-muted-foreground/45">Path 2</Label>
        <Input id="path2" placeholder="Where might the second path lead?" value={choice2} onChange={(e) => setChoice2(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="path3" className="text-xs text-muted-foreground/45">Path 3</Label>
        <Input id="path3" placeholder="Where might the third path lead?" value={choice3} onChange={(e) => setChoice3(e.target.value)} />
      </div>
    </div>
  )

  const readingThemeSection = <ReadingThemePicker value={readingTheme} onChange={setReadingTheme} />

  const engineSection = (
    <AdvancedEngineFeatures
      goapEnabled={goapEnabled}
      setGoapEnabled={setGoapEnabled}
      implementQuests={implementQuests}
      setImplementQuests={setImplementQuests}
      economyEffects={economyEffects}
      setEconomyEffects={setEconomyEffects}
      endingConditions={endingConditions}
      setEndingConditions={setEndingConditions}
      resourceNames={resources.map((r) => r.name.trim()).filter(Boolean)}
    />
  )

  const seedCount = [choice1, choice2, choice3].filter((c) => c.trim()).length
  const reviewCard = (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-amber-400/55" />
        Ready to begin
      </h2>
      <dl className="space-y-2 text-sm">
        <ReviewRow label="Title" value={title || <Missing>Untitled</Missing>} />
        <ReviewRow label="World" value={selectedWorld?.name ?? '—'} />
        <ReviewRow label="Rating" value={rating} />
        <ReviewRow label="Genres" value={tags.length ? tags.join(', ') : <Muted>None</Muted>} />
        <ReviewRow
          label="Protagonist"
          value={protagonistName.trim() ? protagonistName : <Muted>Reader decides</Muted>}
        />
        <ReviewRow label="Seed paths" value={seedCount ? `${seedCount} suggested` : <Muted>Open-ended</Muted>} />
        <ReviewRow label="Visibility" value={shared ? 'Shared with the community' : 'Personal (unlisted)'} />
      </dl>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-sans mb-1">Opening preview</p>
        <p className="text-[13px] text-foreground/75 leading-relaxed line-clamp-4" style={{ fontFamily: 'Georgia, serif' }}>
          {opening.trim() || 'No opening written yet — go back to the opening step.'}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground/45">
        Want a director, custom resources, the simulation engine, or a reading theme? Switch to{' '}
        <strong>Advanced</strong> above — your work carries over.
      </p>
    </div>
  )

  const renderSubmit = (className: string) => (
    <Button
      type="submit"
      disabled={submitting || !title.trim() || !worldId || !opening.trim()}
      className={className}
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
  )

  const steps: WizardStep[] = [
    {
      id: 'basics',
      title: 'The basics',
      hint: 'Name your story, choose its world, and set the rating and genres.',
      content: basicsCard,
      canProceed: !!title.trim() && !!worldId,
    },
    {
      id: 'hero',
      title: 'Hero & sharing',
      hint: 'Optional — who the reader plays as, and whether to share it.',
      content: <div className="space-y-5">{protagonistCard}{shareCard}</div>,
    },
    {
      id: 'opening',
      title: 'The opening',
      hint: 'Write the first chapter, then optionally seed where it might go.',
      content: <div className="space-y-5">{openingCard}{choicesCard}</div>,
      canProceed: !!opening.trim(),
    },
    {
      id: 'cover',
      title: 'The cover',
      hint: 'Design the book cover — or leave it and refine later.',
      content: coverCard,
    },
    {
      id: 'review',
      title: 'Review & begin',
      hint: 'A last look before your story is born.',
      content: reviewCard,
    },
  ]

  const advanced = (
    <div className="space-y-5">
      {basicsCard}
      {protagonistCard}
      {shareCard}
      {advancedOptionsCard}
      {coverCard}
      {readingThemeSection}
      {engineSection}
      {openingCard}
      {choicesCard}
      {renderSubmit('w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300')}
    </div>
  )

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
        worldContext={selectedWorld ?? null}
        onGenerated={(result: Partial<StoryAssistResult>) => {
          // Only fields the author chose to generate come back — merge those.
          if (result.title !== undefined) setTitle(result.title)
          if (result.description !== undefined) setDescription(result.description)
          if (result.opening !== undefined) setOpening(result.opening)
          if (result.choice1 !== undefined) setChoice1(result.choice1)
          if (result.choice2 !== undefined) setChoice2(result.choice2)
          if (result.choice3 !== undefined) setChoice3(result.choice3)
          if (result.protagonistName !== undefined) setProtagonistName(result.protagonistName)
          if (result.protagonistDesc !== undefined) setProtagonistDesc(result.protagonistDesc)
          if (result.tags !== undefined) setTags(result.tags)
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
        <CreationWizard
          mode={mode}
          onModeChange={setMode}
          steps={steps}
          advanced={advanced}
          submitButton={renderSubmit('gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300')}
        />
      </form>
    </main>
  )
}

// ── Review-step helpers ───────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-sans w-24 shrink-0">{label}</dt>
      <dd className="text-foreground/80 text-[13px]">{value}</dd>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/45 italic">{children}</span>
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-400/70">{children}</span>
}
