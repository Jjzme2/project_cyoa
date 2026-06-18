'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
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
  onGenerated: (result: WorldAssistResult) => void
  worldContext?: null
}

interface StoryAssistProps {
  type: 'story'
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (result: StoryAssistResult) => void
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

export function AIAssistModal(props: Props) {
  const { type, open, onOpenChange, onGenerated } = props
  const { user, updateAiUses } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!user || !prompt.trim()) return
    setGenerating(true)
    setError(null)

    try {
      const token = await user.getIdToken()
      const worldContext = props.type === 'story' ? props.worldContext ?? null : null
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: prompt.trim(), type, worldContext }),
      })

      const data = await res.json()
      if (typeof data.remaining === 'number') updateAiUses(data.remaining)
      if (!res.ok) {
        if (res.status === 429) {
          setError('Not enough credits. Your daily allowance resets soon, or you can purchase more.')
        } else {
          setError(data.error ?? 'Generation failed. Please try again.')
        }
        return
      }

      if (type === 'world') {
        ;(onGenerated as WorldAssistProps['onGenerated'])(data as WorldAssistResult)
      } else {
        ;(onGenerated as StoryAssistProps['onGenerated'])(data as StoryAssistResult)
      }

      setPrompt('')
      onOpenChange(false)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const label = type === 'world' ? 'world' : 'story'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            AI {label} assist
          </DialogTitle>
          <DialogDescription>
            Describe your idea and the AI will generate a full {label} for you to edit freely.{' '}
            <span className="text-amber-400/80 font-medium">Costs 1 credit.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <Label htmlFor="ai-assist-prompt">Your idea</Label>
          <Textarea
            id="ai-assist-prompt"
            placeholder={PLACEHOLDERS[type]}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] resize-none text-sm"
            disabled={generating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
            }}
          />
          {type === 'story' && props.worldContext && (
            <p className="text-[11px] text-muted-foreground/45">
              The AI will tailor the story to the world <span className="text-amber-400/60">{props.worldContext.name}</span>.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => { setPrompt(''); setError(null); onOpenChange(false) }}
            disabled={generating}
            className="text-muted-foreground/60"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate (1 credit)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
