'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'

const TONE_OPTIONS = [
  'Epic Fantasy',
  'Dark Horror',
  'Sci-Fi Adventure',
  'Cozy Mystery',
  'High Drama',
  'Cosmic Horror',
  'Whimsical Fairy Tale',
  'Gritty Noir',
]

export default function NewWorldPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lore, setLore] = useState('')
  const [rules, setRules] = useState('')
  const [tone, setTone] = useState('Epic Fantasy')

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          lore: lore.trim(),
          rules: rules.trim(),
          tone,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create world')
      toast.success(`"${name}" has been forged into existence!`)
      router.push('/stories/new')
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

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-1">
        <p className="text-xs text-amber-400/50 uppercase tracking-widest font-sans">Chronicle</p>
        <h1 className="text-2xl font-bold gold-text">Forge a new world</h1>
        <p className="text-sm text-muted-foreground/60 max-w-sm">
          Define the rules and lore of your world. The AI uses this to generate consistent, immersive stories.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-400/55" />
            World identity
          </h2>

          <div className="space-y-2">
            <Label htmlFor="name">World name</Label>
            <Input
              id="name"
              placeholder="The Shattered Realm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Brief description</Label>
            <Input
              id="desc"
              placeholder="A realm of fractured magic and ancient prophecy…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t} className="bg-background">
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-foreground/65">World lore</h2>
            <p className="text-xs text-muted-foreground/45 mt-1">
              History, geography, factions, and the major events that shaped your world.
            </p>
          </div>
          <Textarea
            placeholder="Once, the five kingdoms were united under a crystalline sky. When the Sundering occurred three centuries ago, the sky itself fractured into shards of pure magic that drifted like frozen lightning across the land…"
            value={lore}
            onChange={(e) => setLore(e.target.value)}
            required
            className="min-h-[160px] resize-none text-sm leading-relaxed"
          />
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-foreground/65">Rules &amp; constraints</h2>
            <p className="text-xs text-muted-foreground/45 mt-1">
              What the AI must always follow — magic systems, forbidden topics, narrative tone.
            </p>
          </div>
          <Textarea
            placeholder={`• Magic requires a physical cost — the caster ages with each spell\n• Technology is medieval — no firearms, no electricity\n• The protagonist must always have agency\n• Keep violence tasteful, not gratuitous`}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            required
            className="min-h-[140px] resize-none text-xs leading-relaxed font-mono"
          />
        </div>

        <Button
          type="submit"
          disabled={
            submitting ||
            !name.trim() ||
            !description.trim() ||
            !lore.trim() ||
            !rules.trim()
          }
          className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating world…
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4" />
              Forge this world
            </>
          )}
        </Button>
      </form>
    </main>
  )
}
