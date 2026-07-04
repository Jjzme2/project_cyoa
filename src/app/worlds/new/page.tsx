'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe, Loader2, ChevronRight, Sparkles, RotateCcw, Palette, Plus, Link2 } from 'lucide-react'
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
import { CreationWizard, type CreationMode, type WizardStep } from '@/components/creation/CreationWizard'
import { useDraft } from '@/hooks/useDraft'
import { STYLE_OPTION_PRESETS, CURATED_STYLE_BUNDLES, applyBundle } from '@/lib/world-style-presets'

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
  const [mode, setMode] = useState<CreationMode>('simple')

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
  const [narrativeMode, setNarrativeMode] = useState<'auto' | 'dramatic' | 'gentle'>('auto')
  // Configurable style parameters each story in this world will choose from
  // (e.g. label "Rhyme scheme", choices "ABAB, ABBA, AABB, Free verse").
  const [styleOptions, setStyleOptions] = useState<{ label: string; choices: string }[]>([])
  // Opt-in multiverse: name a shared collective to pool this world's legends with
  // any other worlds in it.
  const [multiverseName, setMultiverseName] = useState('')
  // Existing public multiverse names, offered as suggestions so a collective is
  // joined by its exact, matching name.
  const [knownMultiverses, setKnownMultiverses] = useState<string[]>([])
  // Explicit links (fold 2): hand-picked worlds whose legends echo into this one.
  const [worldChoices, setWorldChoices] = useState<{ id: string; name: string }[]>([])
  const [links, setLinks] = useState<{ worldId: string; worldName: string; nexus: string }[]>([])

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

  // Offer existing public multiverse names so worlds join a collective by an
  // exact, matching name. Best-effort; failure just means no suggestions.
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/multiverses')
        if (!res.ok) return
        const data = await res.json()
        const names = ((data.multiverses ?? []) as { name?: string }[])
          .map((m) => m.name?.trim())
          .filter((n): n is string => !!n)
        setKnownMultiverses(Array.from(new Set(names)))
      } catch {
        /* suggestions are optional */
      }
    })()
  }, [])

  // Candidate worlds to link to explicitly (fold 2). Best-effort.
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/worlds/public')
        if (!res.ok) return
        const data = await res.json()
        const choices = ((data.worlds ?? []) as { id: string; name: string }[])
          .map((w) => ({ id: w.id, name: w.name }))
          .filter((w) => w.id && w.name)
        setWorldChoices(choices)
      } catch {
        /* link picker is optional */
      }
    })()
  }, [])

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
          multiverseName: multiverseName.trim() || undefined,
          links: links.length
            ? links.map((l) => ({ worldId: l.worldId, nexus: l.nexus.trim() || undefined }))
            : undefined,
          storySettings: {
            mandate: mandate.trim() || undefined,
            proseStyles: proseStyles.split('\n').map((s) => s.trim()).filter(Boolean),
            motifs: motifs.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
            ...(narrativeMode !== 'auto' ? { narrativeMode } : {}),
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

  // ── Section building blocks (shared by the guided steps and the advanced form) ──

  const identityCard = (
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
        <Label htmlFor="desc">Description</Label>
        <Textarea
          id="desc"
          placeholder="A realm of fractured magic and ancient prophecy, where the sky itself was shattered into drifting shards of raw power…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="min-h-[90px] resize-y text-sm leading-relaxed"
        />
        <p className="text-[11px] text-muted-foreground/45">
          The elevator pitch shown to authors choosing a world and to readers browsing it.
        </p>
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
  )

  const portalCard = (
    <div className="glass-card rounded-xl p-6 space-y-5">
      <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
        <Palette className="h-4 w-4 text-amber-400/55" />
        World Portal
        <span className="text-muted-foreground/55 font-normal text-xs">(the world&apos;s banner)</span>
      </h2>
      <p className="text-[11px] text-muted-foreground/45 -mt-2">
        This is the wide <strong>banner</strong> for the whole world — it heads the world&apos;s page and its
        shelf in the library. It&apos;s different from a <strong>book cover</strong>, which you design later for
        each individual story inside this world.
      </p>
      <WorldThemeDesigner value={theme} onChange={setTheme} name={name} tone={tone} />
    </div>
  )

  const loreCard = (
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
  )

  const rulesCard = (
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
  )

  const storytellingCard = (
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
        <Label htmlFor="narrativeMode" className="text-xs text-muted-foreground/60">
          Narrative shape{' '}
          <span className="text-muted-foreground/45">— what drives this world&apos;s stories</span>
        </Label>
        <select
          id="narrativeMode"
          value={narrativeMode}
          onChange={(e) => setNarrativeMode(e.target.value as 'auto' | 'dramatic' | 'gentle')}
          className="w-full h-9 px-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:border-ring"
        >
          <option value="auto">Auto — read it from my world&apos;s tone and rules</option>
          <option value="dramatic">Dramatic — traditional arcs: conflict, stakes, reckonings</option>
          <option value="gentle">Gentle — nothing bad here: wonder, friendship, and joy</option>
        </select>
        <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
          Gentle worlds get conflict-free story arcs — the climax is a shared wonder or a heartfelt moment, never a
          threat. Auto detects this from your rules (e.g. “no bad happens here”).
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

        {/* Curated profiles — one click configures several coherent options. */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-sans">Curated profiles</p>
          <div className="flex flex-wrap gap-1.5">
            {CURATED_STYLE_BUNDLES.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.description}
                onClick={() => setStyleOptions((prev) => applyBundle(prev, b))}
                className="px-2.5 py-1 rounded-md text-[11px] font-sans border border-white/10 text-muted-foreground/65 hover:border-violet-500/30 hover:text-violet-200/85 transition-all"
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Single quick-add options. */}
        <div className="flex flex-wrap gap-1.5">
          {STYLE_OPTION_PRESETS.map((p) => {
            const added = styleOptions.some((o) => o.label.trim().toLowerCase() === p.label.toLowerCase())
            return (
              <button
                key={p.label}
                type="button"
                disabled={added}
                onClick={() => setStyleOptions((prev) => [...prev, { label: p.label, choices: p.choices }])}
                className={`px-2 py-1 rounded-md text-[11px] font-sans border transition-all ${
                  added
                    ? 'border-white/5 text-muted-foreground/30 cursor-default'
                    : 'border-white/10 text-muted-foreground/60 hover:border-amber-500/25 hover:text-amber-200/80'
                }`}
              >
                + {p.label}
              </button>
            )
          })}
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
  )

  const multiverseCard = (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-400/55" />
          Multiverse
          <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
        </h2>
        <p className="text-[11px] text-muted-foreground/45 mt-1 leading-relaxed">
          By default a world is sealed — its legends never reach another world. A multiverse is a
          shared collective <em>anyone</em> can join: name yours into one and its legends pool with
          every other world in it, drifting between them as faint, clearly-foreign echoes that never
          override a world&apos;s own canon. Leave blank to keep this world fully self-contained.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="multiverse">Multiverse name</Label>
        <Input
          id="multiverse"
          list="my-multiverses"
          placeholder="e.g. The Sugar Multiverse"
          value={multiverseName}
          onChange={(e) => setMultiverseName(e.target.value)}
          maxLength={60}
        />
        {knownMultiverses.length > 0 && (
          <datalist id="my-multiverses">
            {knownMultiverses.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}
        <p className="text-[11px] text-muted-foreground/45">
          Any world named into the exact same multiverse shares one pool. Mature legends never echo
          into a lower-rated world.
        </p>
      </div>

      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <Label htmlFor="link-add">
          Linked worlds <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
        </Label>
        <p className="text-[11px] text-muted-foreground/45 leading-relaxed">
          Or hand-pick specific worlds whose legends echo into this one — whether or not they share a
          multiverse. Same rating safety applies.
        </p>
        <select
          id="link-add"
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            const w = worldChoices.find((c) => c.id === id)
            if (w && !links.some((l) => l.worldId === id)) {
              setLinks((prev) => [...prev, { worldId: w.id, worldName: w.name, nexus: '' }])
            }
          }}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{worldChoices.length ? 'Add a world to link…' : 'No other worlds to link yet'}</option>
          {worldChoices
            .filter((c) => !links.some((l) => l.worldId === c.id))
            .map((c) => (
              <option key={c.id} value={c.id} className="bg-background">{c.name}</option>
            ))}
        </select>

        {links.length > 0 && (
          <div className="space-y-2 pt-1">
            {links.map((l, i) => (
              <div key={l.worldId} className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-lg">
                <Link2 className="h-3.5 w-3.5 text-amber-400/45 shrink-0" />
                <span className="text-[12px] text-foreground/75 shrink-0 max-w-[30%] truncate">{l.worldName}</span>
                <Input
                  placeholder="how they're linked (optional) — e.g. a shimmering rift"
                  value={l.nexus}
                  onChange={(e) =>
                    setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, nexus: e.target.value } : x)))
                  }
                  maxLength={120}
                  className="h-8 text-[12px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                  className="h-7 px-2 text-red-400/80 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const reviewCard = (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
        <Globe className="h-4 w-4 text-amber-400/55" />
        Ready to forge
      </h2>
      <dl className="space-y-2 text-sm">
        <ReviewRow label="Name" value={name || <Missing>Unnamed</Missing>} />
        <ReviewRow label="Tone" value={tone} />
        <ReviewRow label="Rating" value={rating} />
        <ReviewRow
          label="Multiverse"
          value={
            [
              multiverseName.trim() ? `Pool: ${multiverseName.trim()}` : null,
              links.length ? `${links.length} linked world${links.length === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Self-contained'
          }
        />
        <ReviewRow label="Description" value={description.trim() || <Missing>Required</Missing>} />
      </dl>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-sans mb-1">Lore</p>
          <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-5">
            {lore.trim() || 'No lore yet — go back to the Lore step.'}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-sans mb-1">Rules</p>
          <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-5 whitespace-pre-wrap font-mono">
            {rules.trim() || 'No rules yet — go back to the Rules step.'}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/45">
        Want a per-chapter mandate, prose-style pool, motifs, or per-story style options? Switch to{' '}
        <strong>Advanced</strong> above — your work carries over.
      </p>
    </div>
  )

  const renderSubmit = (className: string) => (
    <Button
      type="submit"
      disabled={submitting || !name.trim() || !description.trim() || !lore.trim() || !rules.trim()}
      className={className}
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
  )

  const steps: WizardStep[] = [
    {
      id: 'identity',
      title: 'World identity',
      hint: 'Name your world, pitch it in a sentence, and set its tone and rating.',
      content: identityCard,
      canProceed: !!name.trim() && !!description.trim(),
    },
    {
      id: 'portal',
      title: 'World Portal',
      hint: 'Design the banner that represents the whole world.',
      content: portalCard,
    },
    {
      id: 'lore',
      title: 'World lore',
      hint: 'The history and geography the AI draws on for every story.',
      content: loreCard,
      canProceed: !!lore.trim(),
    },
    {
      id: 'rules',
      title: 'Rules & constraints',
      hint: 'The guardrails every chapter must respect.',
      content: rulesCard,
      canProceed: !!rules.trim(),
    },
    {
      id: 'multiverse',
      title: 'Multiverse',
      hint: 'Optionally join a shared pool or hand-pick worlds to link.',
      content: multiverseCard,
    },
    {
      id: 'review',
      title: 'Review & forge',
      hint: 'A last look before your world comes into being.',
      content: reviewCard,
    },
  ]

  const advanced = (
    <div className="space-y-5">
      {identityCard}
      {portalCard}
      {loreCard}
      {rulesCard}
      {storytellingCard}
      {multiverseCard}
      {renderSubmit('w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300')}
    </div>
  )

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
        onGenerated={(result: Partial<WorldAssistResult>) => {
          // Only fields the author chose to generate come back — merge those.
          if (result.name !== undefined) setName(result.name)
          if (result.description !== undefined) setDescription(result.description)
          if (result.lore !== undefined) setLore(result.lore)
          if (result.rules !== undefined) setRules(result.rules)
          if (result.tone !== undefined) {
            setTone(result.tone)
            // Auto-tune the world's atmosphere to match the AI's chosen tone.
            setTheme((prev) => themeForTone(result.tone!, prev))
          }
          if (result.rating !== undefined) setRating(result.rating)
        }}
      />

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

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-400/70">{children}</span>
}
