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
import type { World, CoverTheme, ReadingTheme, ContentRating, DirectorPersona } from '@/types'
import { emptyDirector, isDirectorMeaningful } from '@/lib/director'
import { DirectorControls } from '@/components/story/DirectorControls'
import { StoryResourcesEditor, type StoryResourceDraft } from '@/components/story/StoryResourcesEditor'
import { ReadingThemePicker } from '@/components/book/ReadingThemePicker'
import { AdvancedEngineFeatures, type EconomyEffectRow } from '@/components/story/AdvancedEngineFeatures'
import { AIAssistModal } from '@/components/ai/AIAssistModal'
import type { StoryAssistResult } from '@/components/ai/AIAssistModal'
import { useDraft } from '@/hooks/useDraft'

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
      const selectedWorld = worlds.find((w) => w.id === worldId)!

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
          worldName: selectedWorld.name,
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

          <DirectorControls value={director} onChange={setDirector} />

          {styleOptions.length > 0 && (
            <div className="space-y-3 border-t border-white/[0.06] pt-5">
              <div>
                <Label className="text-sm font-medium text-foreground/65 block">This world&apos;s style choices</Label>
                <p className="text-[11px] text-muted-foreground/45 mt-1">
                  {worlds.find((w) => w.id === worldId)?.name} lets each story pick how these are handled.
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

        {/* ── Cover Designer ── */}
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

        <ReadingThemePicker value={readingTheme} onChange={setReadingTheme} />

        <AdvancedEngineFeatures goapEnabled={goapEnabled} setGoapEnabled={setGoapEnabled} implementQuests={implementQuests} setImplementQuests={setImplementQuests} economyEffects={economyEffects} setEconomyEffects={setEconomyEffects} />

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
