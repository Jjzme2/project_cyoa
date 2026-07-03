'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'
import type { Story } from '@/types'

/**
 * Author/admin control to reset a story back to its opening so it can be
 * retried in place — without recreating the story or its world. Destructive to
 * written chapters (they regenerate under the world's CURRENT settings, e.g.
 * after a world turned gentle), so it sits behind an explicit confirm.
 */
export function ResetStoryButton({ story }: { story: Story }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const canReset = !!user && (isAdmin || user.uid === story.authorId)
  if (!canReset) return null

  async function reset() {
    if (!user || busy) return
    setBusy(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${story.id}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Reset failed')
      toast.success(`Story reset — ${data.deleted} chapter${data.deleted === 1 ? '' : 's'} cleared. A fresh start awaits.`)
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Reset this story back to its opening"
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-500/20 bg-red-500/[0.06] hover:bg-red-500/15 text-red-300/80 transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Reset story
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset this story?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground/70">
              This clears every chapter after the opening{story.youMode ? ' doorways' : ''} — for everyone — so the
              story can be retold from the start under the world&apos;s current settings. Open bounties on cleared
              paths are refunded. <strong>Written chapters cannot be recovered.</strong>
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground/60">
                Keep the story
              </Button>
              <Button
                onClick={reset}
                disabled={busy}
                className="gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reset to the beginning
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
