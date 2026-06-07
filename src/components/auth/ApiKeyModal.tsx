'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { KeyRound, Trash2, Eye, EyeOff } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/Providers'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeyModal({ open, onOpenChange }: Props) {
  const { user } = useAuth()
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open || !user) return
    user.getIdToken().then((token) =>
      fetch('/api/settings/keys', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setHasKey(!!d.hasKey))
        .catch(() => {}),
    )
  }, [open, user])

  async function handleSave() {
    if (!user || !apiKey.trim()) return
    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('API key saved and encrypted.')
      setHasKey(true)
      setApiKey('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save key')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!user) return
    setDeleting(true)
    try {
      const token = await user.getIdToken()
      await fetch('/api/settings/keys', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('API key removed.')
      setHasKey(false)
    } catch {
      toast.error('Failed to remove key')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md glass border-white/10">
        <div className="flex flex-col gap-5 p-1">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 text-amber-400/70" />
            <h2 className="text-sm font-semibold text-amber-200/90">Your Gemini API Key</h2>
          </div>

          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Optionally supply your own Gemini key to use for image and story generation. It is
            stored encrypted and never exposed client-side.
          </p>

          {hasKey ? (
            <div className="flex flex-col gap-3">
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-sans"
                style={{ background: 'oklch(0.25 0.05 55 / 25%)', color: 'oklch(0.65 0.10 70)' }}
              >
                <KeyRound className="h-3 w-3 shrink-0" />
                A key is stored — replace or remove it below.
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-1.5 self-start text-xs"
              >
                <Trash2 className="h-3 w-3" />
                {deleting ? 'Removing…' : 'Remove key'}
              </Button>
              <div className="border-t border-white/10 pt-3">
                <p className="text-[11px] text-muted-foreground mb-2">Replace with a new key:</p>
              </div>
            </div>
          ) : null}

          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="AIza…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-9 text-[13px] bg-white/5 border-white/15 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs"
          >
            <KeyRound className="h-3 w-3" />
            {saving ? 'Encrypting & saving…' : 'Save key'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
