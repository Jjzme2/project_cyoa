'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, Globe, Loader2, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import type { World } from '@/types'

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
  const [resources, setResources] = useState<{ name: string; type: 'number' | 'string'; defaultValue: string }[]>([])

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    user
      .getIdToken()
      .then(async (token) => {
        const res = await fetch('/api/worlds', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setWorlds(data.worlds)
          if (data.worlds.length > 0) setWorldId(data.worlds[0].id)
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
        .map((r) => ({
          name: r.name.trim(),
          type: r.type,
          defaultValue: r.type === 'number' ? Number(r.defaultValue || 0) : r.defaultValue,
        }))
        .filter((r) => r.name.length > 0)

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
                {resources.map((res, index) => (
                  <div key={index} className="flex gap-2.5 items-end bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[11px] opacity-40">Variable Name</Label>
                      <Input
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
                    <div className="w-28 space-y-1.5">
                      <Label className="text-[11px] opacity-40">Type</Label>
                      <select
                        value={res.type}
                        onChange={(e) => {
                          const t = e.target.value as 'number' | 'string'
                          setResources((prev) => {
                            const next = [...prev]
                            next[index] = {
                              ...next[index],
                              type: t,
                              defaultValue: t === 'number' ? '0' : '',
                            }
                            return next
                          })
                        }}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                      >
                        <option value="number">Number</option>
                        <option value="string">String</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[11px] opacity-40">Starting Value</Label>
                      <Input
                        placeholder={res.type === 'number' ? '0' : 'None'}
                        type={res.type === 'number' ? 'number' : 'text'}
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
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-medium text-foreground/65">Opening chapter</h2>
          <Textarea
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
            <Label className="text-xs text-muted-foreground/45">Path 1</Label>
            <Input
              placeholder="Where might the first path lead?"
              value={choice1}
              onChange={(e) => setChoice1(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground/45">Path 2</Label>
            <Input
              placeholder="Where might the second path lead?"
              value={choice2}
              onChange={(e) => setChoice2(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground/45">Path 3</Label>
            <Input
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
