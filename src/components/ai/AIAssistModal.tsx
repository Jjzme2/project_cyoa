'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RotateCcw, ChevronLeft, Check, Wand2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import type { ContentRating } from '@/types'

export interface WorldAssistResult {
  name: string
  description: string
  lore: string
  rules: string
  tone: string
  rating: ContentRating
}

export interface StoryAssistResult {
  title: string
  description: string
  opening: string
  choice1: string
  choice2: string
  choice3: string
  protagonistName: string
  protagonistDesc: string
  tags: string[]
}

interface WorldAssistProps {
  type: 'world'
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (result: Partial<WorldAssistResult>) => void
  worldContext?: null
}

interface StoryAssistProps {
  type: 'story'
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (result: Partial<StoryAssistResult>) => void
  worldContext?: {
    name: string
    description: string
    lore: string
    rules: string
    tone: string
    rating?: ContentRating
  } | null
}

type Props = WorldAssistProps | StoryAssistProps

const PLACEHOLDERS: Record<'world' | 'story', string> = {
  world: 'e.g. "a town you can never escape", "a desert empire powered by stolen dreams", "a world where music is forbidden"',
  story: 'e.g. "a thief who steals memories", "survive a haunted lighthouse", "negotiate peace between two warring clans"',
}

/** An author-facing area of generation, mapped to one or more model fields. */
interface Area {
  key: string
  label: string
  fields: string[]
  optional?: boolean
}

const WORLD_AREAS: Area[] = [
  { key: 'name', label: 'Name', fields: ['name'] },
  { key: 'description', label: 'Description', fields: ['description'] },
  { key: 'lore', label: 'Lore', fields: ['lore'] },
  { key: 'rules', label: 'Rules & constraints', fields: ['rules'] },
  { key: 'tone', label: 'Tone', fields: ['tone'], optional: true },
  { key: 'rating', label: 'Content rating', fields: ['rating'], optional: true },
]

const STORY_AREAS: Area[] = [
  { key: 'title', label: 'Title', fields: ['title'] },
  { key: 'description', label: 'Description', fields: ['description'] },
  { key: 'opening', label: 'Opening chapter', fields: ['opening'] },
  { key: 'protagonist', label: 'Protagonist', fields: ['protagonistName', 'protagonistDesc'], optional: true },
  { key: 'choices', label: 'Seed paths', fields: ['choice1', 'choice2', 'choice3'], optional: true },
  { key: 'tags', label: 'Genre tags', fields: ['tags'], optional: true },
]

type Step = 'idea' | 'questions' | 'review'
type Results = Record<string, unknown>

export function AIAssistModal(props: Props) {
  const { type, open, onOpenChange, onGenerated } = props
  const { user, updateAiUses } = useAuth()
  const areas = type === 'world' ? WORLD_AREAS : STORY_AREAS

  const [step, setStep] = useState<Step>('idea')
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(areas.map((a) => a.key)))
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [results, setResults] = useState<Results>({})
  const [busy, setBusy] = useState(false) // a full-flow action (questions/generate) is running
  const [rerolling, setRerolling] = useState<string | null>(null) // area key being rerolled
  const [error, setError] = useState<string | null>(null)

  const worldContext = props.type === 'story' ? props.worldContext ?? null : null
  const selectedAreas = areas.filter((a) => selected.has(a.key))
  const selectedFields = selectedAreas.flatMap((a) => a.fields)

  function reset() {
    setStep('idea')
    setPrompt('')
    setSelected(new Set(areas.map((a) => a.key)))
    setQuestions([])
    setAnswers([])
    setResults({})
    setBusy(false)
    setRerolling(null)
    setError(null)
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  function toggleArea(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function callApi(body: Record<string, unknown>) {
    if (!user) throw new Error('Not signed in')
    const token = await user.getIdToken()
    const res = await fetch('/api/ai/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, prompt: prompt.trim(), worldContext, ...body }),
    })
    const data = await res.json()
    if (typeof data.remaining === 'number') updateAiUses(data.remaining)
    if (!res.ok) {
      const msg =
        res.status === 429
          ? 'Not enough credits. Your daily allowance resets soon, or you can purchase more.'
          : data.error ?? 'Something went wrong. Please try again.'
      throw new Error(msg)
    }
    return data
  }

  async function handleAskQuestions() {
    if (!prompt.trim()) return
    setBusy(true)
    setError(null)
    try {
      const data = await callApi({ mode: 'questions' })
      const qs: string[] = Array.isArray(data.questions) ? data.questions : []
      setQuestions(qs)
      setAnswers(qs.map(() => ''))
      setStep('questions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load questions.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerate() {
    if (!prompt.trim() || selectedFields.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const data = await callApi({
        mode: 'generate',
        fields: selectedFields,
        answers: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
      })
      setResults((prev) => ({ ...prev, ...(data.fields ?? {}) }))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReroll(area: Area) {
    setRerolling(area.key)
    setError(null)
    try {
      const data = await callApi({
        mode: 'reroll',
        fields: area.fields,
        current: results,
        answers: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
      })
      setResults((prev) => ({ ...prev, ...(data.fields ?? {}) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reroll failed.')
    } finally {
      setRerolling(null)
    }
  }

  function handleApply() {
    onGenerated(results as never)
    close()
  }

  const label = type === 'world' ? 'world' : 'story'

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Inspire {label} with AI
          </DialogTitle>
          <DialogDescription>
            {step === 'idea' && (
              <>Describe your idea and pick what to generate. Answering a few questions first sharpens the result.</>
            )}
            {step === 'questions' && (
              <>Answer what you like — skip anything you don&apos;t care about. Blank answers are fine.</>
            )}
            {step === 'review' && (
              <>Review each piece and reroll anything you want to change, then apply it to your draft.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: idea + area selection ── */}
        {step === 'idea' && (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="ai-assist-prompt">Your idea</Label>
              <Textarea
                id="ai-assist-prompt"
                placeholder={PLACEHOLDERS[type]}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[90px] resize-none text-sm"
                disabled={busy}
              />
              {type === 'story' && worldContext && (
                <p className="text-[11px] text-muted-foreground/45">
                  Tailored to the world <span className="text-amber-400/60">{worldContext.name}</span>.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>What should the AI write?</Label>
              <div className="flex flex-wrap gap-1.5">
                {areas.map((area) => {
                  const on = selected.has(area.key)
                  return (
                    <button
                      key={area.key}
                      type="button"
                      onClick={() => toggleArea(area.key)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-sans border transition-all flex items-center gap-1 ${
                        on
                          ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                          : 'border-white/10 text-muted-foreground/45 hover:border-white/20 hover:text-muted-foreground/70'
                      }`}
                    >
                      {on && <Check className="h-3 w-3" />}
                      {area.label}
                      {area.optional && <span className="opacity-50">· optional</span>}
                    </button>
                  )
                })}
              </div>
              {selectedFields.length === 0 && (
                <p className="text-[11px] text-amber-400/70">Pick at least one area to generate.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Step: follow-up questions ── */}
        {step === 'questions' && (
          <div className="space-y-4 py-1">
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">No questions — go ahead and generate.</p>
            ) : (
              questions.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  <Label htmlFor={`ai-q-${i}`} className="text-xs text-muted-foreground/70 leading-relaxed">
                    {q}
                  </Label>
                  <Input
                    id={`ai-q-${i}`}
                    value={answers[i] ?? ''}
                    onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                    placeholder="Your answer (optional)…"
                    className="text-sm"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Step: review + reroll ── */}
        {step === 'review' && (
          <div className="space-y-3 py-1">
            {selectedAreas.map((area) => (
              <div key={area.key} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-amber-500/70 font-semibold font-sans">
                    {area.label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={rerolling !== null || busy}
                    onClick={() => handleReroll(area)}
                    className="h-6 px-2 text-[11px] gap-1 text-violet-300/80 hover:text-violet-200 hover:bg-violet-500/10"
                    title="Generate a fresh alternative (1 credit)"
                  >
                    {rerolling === area.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Reroll
                  </Button>
                </div>
                <AreaPreview area={area} results={results} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'idea' && (
            <>
              <Button variant="ghost" onClick={close} disabled={busy} className="text-muted-foreground/60">
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={busy || !prompt.trim() || selectedFields.length === 0}
                className="gap-1.5 border-amber-500/25 text-amber-300/80 hover:bg-amber-500/10"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Skip &amp; generate
              </Button>
              <Button
                onClick={handleAskQuestions}
                disabled={busy || !prompt.trim() || selectedFields.length === 0}
                className="gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Ask me first
              </Button>
            </>
          )}

          {step === 'questions' && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep('idea')}
                disabled={busy}
                className="gap-1 text-muted-foreground/60"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={busy}
                className="gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate (1 credit)
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep('idea')}
                disabled={rerolling !== null}
                className="gap-1 text-muted-foreground/60"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Start over
              </Button>
              <Button
                onClick={handleApply}
                disabled={rerolling !== null}
                className="gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
              >
                <Check className="h-3.5 w-3.5" />
                Apply to draft
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Read-only preview of an area's generated value(s) on the review step. */
function AreaPreview({ area, results }: { area: Area; results: Results }) {
  const str = (k: string) => {
    const v = results[k]
    if (Array.isArray(v)) return v.join(', ')
    return typeof v === 'string' ? v : ''
  }

  if (area.key === 'protagonist') {
    const name = str('protagonistName')
    const desc = str('protagonistDesc')
    if (!name && !desc) return <Empty />
    return (
      <p className="text-[13px] text-foreground/75 leading-relaxed">
        {name || 'Unnamed'}
        {desc && <span className="text-muted-foreground/60"> — {desc}</span>}
      </p>
    )
  }

  if (area.key === 'choices') {
    const choices = ['choice1', 'choice2', 'choice3'].map(str).filter(Boolean)
    if (choices.length === 0) return <Empty />
    return (
      <ul className="space-y-0.5">
        {choices.map((c, i) => (
          <li key={i} className="text-[13px] text-foreground/75 leading-relaxed flex gap-1.5">
            <span className="text-amber-500/50">{i + 1}.</span>
            {c}
          </li>
        ))}
      </ul>
    )
  }

  const value = str(area.fields[0])
  if (!value) return <Empty />
  return <p className="text-[13px] text-foreground/75 leading-relaxed whitespace-pre-wrap">{value}</p>
}

function Empty() {
  return <p className="text-[12px] text-muted-foreground/40 italic">Nothing generated.</p>
}
