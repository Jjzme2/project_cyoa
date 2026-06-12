'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, Globe, Loader2, ChevronRight, Plus, Palette, Feather } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import { STORY_TAGS } from '@/types'
import { CoverDesigner, DEFAULT_COVER } from '@/components/book/CoverDesigner'
import type { World, CoverTheme, ReadingTheme, PageStyle, AmbientEffect } from '@/types'

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

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [worldId, setWorldId] = useState('')
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

  const [resources, setResources] = useState<{
    name: string
    type: 'number' | 'string' | 'array'
    defaultValue: string
    description?: string
    min?: number
    max?: number
    hidden?: boolean
  }[]>([])

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

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
          setWorldId(match?.id ?? list[0].id)
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
          }

          return {
            name: r.name.trim(),
            type: r.type,
            defaultValue,
            description: r.description?.trim() || undefined,
            min: r.type === 'number' && r.min !== undefined ? Number(r.min) : undefined,
            max: r.type === 'number' && r.max !== undefined ? Number(r.max) : undefined,
            hidden: r.hidden || false,
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
          published: true,
          coverGradient: null,
          resources: formattedResources,
          tags,
          coverTheme,
          readingTheme,
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

      toast.success('Your story has been born!')
      router.push(`/stories/${storyId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
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

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-1">
        <p className="text-xs text-amber-400/50 uppercase tracking-widest font-sans">Chronicle</p>
        <h1 className="text-2xl font-bold gold-text">Begin a new story</h1>
        <p className="text-sm text-muted-foreground/60 max-w-sm">
          Write the opening chapter. The community will weave everything that follows.
        </p>
      </div>

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
              <span className="text-muted-foreground/35 font-normal text-xs">(optional)</span>
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
              <span className="text-muted-foreground/35 font-normal text-xs">(up to 5)</span>
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
                onChange={(e) => setWorldId(e.target.value)}
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

          <div className="space-y-4 border-t border-white/[0.06] pt-5 mt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500/80 font-sans">
                  Story Resources
                </h3>
                <p className="text-[11px] text-muted-foreground/45 mt-0.5">
                  Define numeric stats (Gold, Health) or item strings (Weapon, CurrentTown) for this book.
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
                  const valId = `resource-val-${index}`
                  return (
                    <div key={index} className="space-y-2.5 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
                      <div className="flex gap-2.5 items-end">
                        <div className="flex-1 space-y-1.5">
                          <Label htmlFor={nameId} className="text-[11px] opacity-40">Variable Name</Label>
                          <Input
                            id={nameId}
                            placeholder="e.g. Gold"
                            value={res.name}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '')
                              setResources((prev) => {
                                const next = [...prev]
                                next[index] = { ...next[index], name: val }
                                return next
                              })
                            }}
                          />
                        </div>
                        <div className="w-36 space-y-1.5">
                          <Label htmlFor={typeId} className="text-[11px] opacity-40">Type</Label>
                          <select
                            id={typeId}
                            value={res.type}
                            onChange={(e) => {
                              const t = e.target.value as 'number' | 'string' | 'array'
                              setResources((prev) => {
                                const next = [...prev]
                                next[index] = {
                                  ...next[index],
                                  type: t,
                                  defaultValue: t === 'number' ? '0' : '',
                                  min: undefined,
                                  max: undefined,
                                }
                                return next
                              })
                            }}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                          >
                            <option value="number">Number</option>
                            <option value="string">String</option>
                            <option value="array">Array (Inventory)</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <Label htmlFor={valId} className="text-[11px] opacity-40">Starting Value</Label>
                          <Input
                            id={valId}
                            placeholder={res.type === 'number' ? '0' : res.type === 'array' ? 'e.g. key, sword' : 'None'}
                            type="text"
                            value={res.defaultValue}
                            onChange={(e) => {
                              const val = e.target.value
                              setResources((prev) => {
                                const next = [...prev]
                                next[index] = { ...next[index], defaultValue: val }
                                return next
                              })
                            }}
                          />
                        </div>
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
                      
                      {/* Secondary row for description, bounds, and secret visibility */}
                      <div className="flex flex-wrap gap-3 items-center pt-2.5 border-t border-white/[0.03]">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <Label htmlFor={`resource-desc-${index}`} className="text-[9px] opacity-35">Description (optional)</Label>
                          <Input
                            id={`resource-desc-${index}`}
                            placeholder="e.g. Tracks items carried by the reader"
                            value={res.description || ''}
                            onChange={(e) => {
                              setResources((prev) => {
                                const next = [...prev]
                                next[index] = { ...next[index], description: e.target.value }
                                return next
                              })
                            }}
                            className="h-8 text-xs placeholder:opacity-50"
                          />
                        </div>

                        {res.type === 'number' && (
                          <>
                            <div className="w-20 space-y-1">
                              <Label htmlFor={`resource-min-${index}`} className="text-[9px] opacity-35">Min Value</Label>
                              <Input
                                id={`resource-min-${index}`}
                                type="number"
                                placeholder="None"
                                value={res.min !== undefined ? res.min : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value)
                                  setResources((prev) => {
                                    const next = [...prev]
                                    next[index] = { ...next[index], min: val }
                                    return next
                                  })
                                }}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <Label htmlFor={`resource-max-${index}`} className="text-[9px] opacity-35">Max Value</Label>
                              <Input
                                id={`resource-max-${index}`}
                                type="number"
                                placeholder="None"
                                value={res.max !== undefined ? res.max : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value)
                                  setResources((prev) => {
                                    const next = [...prev]
                                    next[index] = { ...next[index], max: val }
                                    return next
                                  })
                                }}
                                className="h-8 text-xs"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-1.5 pt-4">
                          <input
                            type="checkbox"
                            id={`resource-hidden-${index}`}
                            checked={res.hidden || false}
                            onChange={(e) => {
                              setResources((prev) => {
                                const next = [...prev]
                                next[index] = { ...next[index], hidden: e.target.checked }
                                return next
                              })
                            }}
                            className="rounded bg-background border-input h-3.5 w-3.5"
                          />
                          <Label htmlFor={`resource-hidden-${index}`} className="text-[10px] opacity-50 cursor-pointer">
                            Hide from readers (secret variable)
                          </Label>
                        </div>
                      </div>
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
          <CoverDesigner value={coverTheme} onChange={setCoverTheme} title={title} />
        </div>

        {/* ── Reading Theme ── */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Feather className="h-4 w-4 text-amber-400/55" />
            Reading Atmosphere
            <span className="text-muted-foreground/35 font-normal text-xs">(readers will see this)</span>
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
              <span className="text-muted-foreground/35 font-normal text-xs">(optional)</span>
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
