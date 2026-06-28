'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2, ChevronRight, Sparkles, RotateCcw, Palette, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import { CONTENT_RATINGS, CONTENT_RATING_META, DEFAULT_CONTENT_RATING } from '@/types'
import type { ContentRating, WorldTheme } from '@/types'
import { AIAssistModal } from '@/components/ai/AIAssistModal'
import type { WorldAssistResult } from '@/components/ai/AIAssistModal'
import { WorldThemeDesigner } from '@/components/world/WorldThemeDesigner'
import { DEFAULT_WORLD_THEME, themeForTone } from '@/components/world/world-theme'
import { useDraft } from '@/hooks/useDraft'

const TONE_OPTIONS = [
  'Epic Fantasy',
  'Dark Fantasy',
  'Dark Horror',
  'Gothic Horror',
  'Cosmic Horror',
  'Supernatural Thriller',
  'Sci-Fi Adventure',
  'Space Opera',
  'Cyberpunk Dystopia',
  'Solarpunk',
  'Cozy Mystery',
  'Gritty Noir',
  'Political Intrigue',
  'High Drama',
  'Romantic Drama',
  'Slice of Life',
  'Whimsical Fairy Tale',
  'Mythological Epic',
  'Post-Apocalyptic',
  'Survival Horror',
  'LitRPG',
  'Steampunk Adventure',
]

interface WorldDraft {
  name: string
  description: string
  lore: string
  rules: string
  tone: string
  rating: ContentRating
  seed: string
  theme: WorldTheme
}

export default function NewWorldPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lore, setLore] = useState('')
  const [rules, setRules] = useState('')
  const [tone, setTone] = useState('Epic Fantasy')
  const [rating, setRating] = useState<ContentRating>(DEFAULT_CONTENT_RATING)
  const [seed, setSeed] = useState('')
  const [theme, setTheme] = useState<WorldTheme>(() => themeForTone('Epic Fantasy', DEFAULT_WORLD_THEME))
  // World-level storytelling rules (optional): a per-chapter mandate, a pool of
  // prose styles the engine rotates through, and recurring motifs.
  const [mandate, setMandate] = useState('')
  const [proseStyles, setProseStyles] = useState('') // one per line
  const [motifs, setMotifs] = useState('') // comma- or newline-separated
  // Configurable style parameters each story in this world will choose from
  // (e.g. label "Rhyme scheme", choices "ABAB, ABBA, AABB, Free verse").
  const [styleOptions, setStyleOptions] = useState<{ label: string; choices: string }[]>([])

  const draft = useDraft<WorldDraft>('chronicle:draft:world')

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  // Read draft availability once after mount (not during render) so the server
  // and client agree on first paint; the banner then appears if a draft exists.
  // The flag stays dismissable via setHasDraft(false) in the handlers below.
  useEffect(() => {
    const saved = draft.load()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount external-store read; see note above
    if (saved && (saved.data.name || saved.data.lore)) setHasDraft(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function restoreDraft() {
    const saved = draft.load()
    if (!saved) return
    const d = saved.data
    setName(d.name)
    setDescription(d.description)
    setLore(d.lore)
    setRules(d.rules)
    setTone(d.tone)
    setRating(d.rating)
    setSeed(d.seed || '')
    if (d.theme) setTheme({ ...DEFAULT_WORLD_THEME, ...d.theme })
    setHasDraft(false)
    toast.success('Draft restored')
  }

  function discardDraft() {
    draft.clear()
    setHasDraft(false)
  }

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
          rating,
          seed: seed.trim() ? parseInt(seed.trim(), 10) : undefined,
          theme,
          storySettings: {
            mandate: mandate.trim() || undefined,
            proseStyles: proseStyles.split('\n').map((s) => s.trim()).filter(Boolean),
            motifs: motifs.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
            styleOptions: styleOptions
              .map((o) => ({ label: o.label.trim(), choices: o.choices.split(',').map((c) => c.trim()).filter(Boolean) }))
              .filter((o) => o.label && o.choices.length > 0),
          },
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create world')
      draft.clear()
      toast.success(`"${name}" has been forged into existence!`)
      router.push('/stories/new')
    } catch (err) {
      draft.save({ name, description, lore, rules, tone, rating, seed, theme })
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      toast.info('Draft saved — your world is preserved for next time.')
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

      {hasDraft && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-300/80">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            You have an unsaved world draft.
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

      <AIAssistModal
        type="world"
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        onGenerated={(result: WorldAssistResult) => {
          setName(result.name)
          setDescription(result.description)
          setLore(result.lore)
          setRules(result.rules)
          setTone(result.tone)
          setRating(result.rating)
          // Auto-tune the world's atmosphere to match the AI's chosen tone.
          setTheme((prev) => themeForTone(result.tone, prev))
        }}
      />

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

          <div className="space-y-2">
            <Label htmlFor="rating">Content rating</Label>
            <select
              id="rating"
              value={rating}
              onChange={(e) => setRating(e.target.value as ContentRating)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CONTENT_RATINGS.map((r) => (
                <option key={r} value={r} className="bg-background">
                  {r} ({CONTENT_RATING_META[r].abbr})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground/45">
              {CONTENT_RATING_META[rating].description} A moderator may adjust this if needed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seed">World Seed (Optional)</Label>
            <Input
              id="seed"
              type="number"
              placeholder="e.g. 12345"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground/45">
              Used for deterministic procedural generation. Leave blank to let the system generate one.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400/55" />
            World Portal
            <span className="text-muted-foreground/55 font-normal text-xs">(its face across the Chronicle)</span>
          </h2>
          <WorldThemeDesigner value={theme} onChange={setTheme} name={name} tone={tone} />
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <div>
            <Label htmlFor="lore" className="text-sm font-medium text-foreground/65 block">World lore</Label>
            <p className="text-xs text-muted-foreground/45 mt-1">
              History, geography, factions, and the major events that shaped your world.
            </p>
          </div>
          <Textarea
            id="lore"
            placeholder="Once, the five kingdoms were united under a crystalline sky. When the Sundering occurred three centuries ago, the sky itself fractured into shards of pure magic that drifted like frozen lightning across the land…"
            value={lore}
            onChange={(e) => setLore(e.target.value)}
            required
            className="min-h-[160px] resize-none text-sm leading-relaxed"
          />
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <div>
            <Label htmlFor="rules" className="text-sm font-medium text-foreground/65 block">Rules &amp; constraints</Label>
            <p className="text-xs text-muted-foreground/45 mt-1">
              What the AI must always follow — magic systems, forbidden topics, narrative tone.
            </p>
          </div>
          <Textarea
            id="rules"
            placeholder={`• Magic requires a physical cost — the caster ages with each spell\n• Technology is medieval — no firearms, no electricity\n• The protagonist must always have agency\n• Keep violence tasteful, not gratuitous`}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            required
            className="min-h-[140px] resize-none text-xs leading-relaxed font-mono"
          />
        </div>

        {/* ── World storytelling (optional) ── */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground/65 block">
              Storytelling style{' '}
              <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground/45 mt-1">
              World-level rules that shape how every chapter is written — applied to every story in this world.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mandate" className="text-xs text-muted-foreground/60">Per-chapter mandate</Label>
            <Input
              id="mandate"
              placeholder="e.g. Every chapter must contain at least one line of poetic prose"
              value={mandate}
              onChange={(e) => setMandate(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proseStyles" className="text-xs text-muted-foreground/60">
              Prose styles{' '}
              <span className="text-muted-foreground/45">— one per line; the engine rotates through them per chapter</span>
            </Label>
            <Textarea
              id="proseStyles"
              placeholder={'lyrical and image-rich\nspare and haunting\nornate, formal, almost liturgical'}
              value={proseStyles}
              onChange={(e) => setProseStyles(e.target.value)}
              rows={3}
              className="resize-none text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motifs" className="text-xs text-muted-foreground/60">
              Recurring motifs{' '}
              <span className="text-muted-foreground/45">— comma-separated; woven in where they fit</span>
            </Label>
            <Input
              id="motifs"
              placeholder="e.g. water, mirrors, the turning of seasons"
              value={motifs}
              onChange={(e) => setMotifs(e.target.value)}
            />
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground/60">
                Style options{' '}
                <span className="text-muted-foreground/45">— each story picks one choice per option at creation</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStyleOptions((prev) => [...prev, { label: '', choices: '' }])}
                className="text-xs gap-1 border-white/10 hover:bg-white/5 h-7"
              >
                <Plus className="h-3 w-3" /> Add option
              </Button>
            </div>
            {styleOptions.map((opt, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input
                  placeholder="Label — e.g. Rhyme scheme"
                  value={opt.label}
                  onChange={(e) =>
                    setStyleOptions((prev) => prev.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))
                  }
                  className="w-44 h-9 text-xs"
                />
                <Input
                  placeholder="Choices, comma-separated — e.g. ABAB, ABBA, AABB, Free verse"
                  value={opt.choices}
                  onChange={(e) =>
                    setStyleOptions((prev) => prev.map((o, j) => (j === i ? { ...o, choices: e.target.value } : o)))
                  }
                  className="flex-1 h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStyleOptions((prev) => prev.filter((_, j) => j !== i))}
                  className="h-9 px-2 text-red-400/70 hover:text-red-300 hover:bg-red-500/10"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
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
