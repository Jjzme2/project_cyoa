'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'

interface Props {
  storyId: string
  nodeId: string
  nodeHistory: string[]
  /** Hidden on stories that are already sagas. */
  isSaga: boolean
  /** How many readers have branched a saga from this chapter. */
  sagaBranches?: number
}

/**
 * "Begin your saga here" — lets a reader step in at any chapter and spin it into
 * their own personal saga, seeded by a written prompt plus the path they've
 * read. A 4th branch type: it doesn't fill a community choice slot. Shows how
 * many readers have begun a saga from this chapter.
 */
export function BeginSagaControl({ storyId, nodeId, nodeHistory, isSaga, sagaBranches = 0 }: Props) {
  const { user, openAuthModal } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)

  if (isSaga) return null

  async function begin() {
    if (!user) {
      setOpen(false)
      openAuthModal()
      return
    }
    if (prompt.trim().length < 1) return toast.error('Write how your saga begins')
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${storyId}/saga-branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nodeId, nodeHistory, prompt: prompt.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.existingId) {
        toast.info('You already have a saga in this world — opening it.')
        router.push(`/stories/${data.existingId}`)
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Could not begin your saga')
      toast.success('Your saga begins…')
      router.push(`/stories/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not begin your saga')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Step in and begin your own saga from this chapter"
        className="flex items-center gap-1 text-[10px] font-sans text-violet-300/60 hover:text-violet-200/90 transition-colors px-2 py-1 rounded border border-violet-400/15 hover:border-violet-400/30 bg-violet-500/[0.04]"
      >
        <Sparkles className="h-3 w-3" />
        <span>Begin your saga</span>
        {sagaBranches > 0 && <span className="opacity-60">· {sagaBranches}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Begin your own saga</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground/65">
              Step into this world as <em>yourself</em>, picking up from where you are now. Write how your story
              begins — the chapters you&apos;ve read become its backdrop.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="I slip away from the others and follow the sound of water into the dark…"
              rows={4}
              maxLength={1000}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/45">Costs 1 credit · one saga per world</span>
              <Button onClick={begin} disabled={busy} className="gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-200">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Begin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
