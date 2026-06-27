'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Check, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'

/**
 * Self-contained Gemini API-key provisioning: checks whether a key is on file,
 * and saves (encrypted) or removes it. Owns its own state and network calls.
 */
export function ApiKeySettings() {
  const { user } = useAuth()
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [deletingKey, setDeletingKey] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/settings/keys', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setHasKey(!!data.hasKey)
        }
      } catch {
        // non-critical
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSaveApiKey = async () => {
    if (!user || !apiKey.trim()) return
    setSavingKey(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      if (!res.ok) throw new Error('Failed to encrypt key')
      toast.success('Gemini key encrypted and saved.')
      setHasKey(true)
      setApiKey('')
    } catch {
      toast.error('Could not save API Key.')
    } finally {
      setSavingKey(false)
    }
  }

  const handleDeleteApiKey = async () => {
    if (!user) return
    setDeletingKey(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/settings/keys', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      toast.success('Gemini key removed.')
      setHasKey(false)
    } catch {
      toast.error('Could not delete API Key.')
    } finally {
      setDeletingKey(false)
    }
  }

  return (
      <section className="glass border-white/10 p-6 rounded-xl space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-400/80" />
          <h2 className="text-sm font-semibold text-amber-200/90">Personal Model Provisioning</h2>
        </div>

        <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-2xl">
          Optionally supply your own Gemini API Key to bypass platform daily limitations. When a key is saved, your adventure paths will use it directly. Keys are stored with high security encryption.
        </p>

        {hasKey ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg justify-between">
            <div className="flex items-center gap-2 text-[12px] text-amber-300">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>A custom Gemini API key is currently saved.</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteApiKey}
              disabled={deletingKey}
              className="text-xs gap-1.5 h-8 shrink-0"
            >
              {deletingKey ? (
                <div className="animate-spin rounded-full h-3 w-3 border-t border-white" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-lg">
            <Label htmlFor="gemini-key-input" className="text-[11px] opacity-40">Gemini API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="gemini-key-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 h-10 border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-75 transition-opacity"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={handleSaveApiKey}
                disabled={savingKey || !apiKey.trim()}
                className="h-10 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 px-4"
              >
                {savingKey ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t border-amber-500" />
                ) : (
                  'Encrypt & Save'
                )}
              </Button>
            </div>
          </div>
        )}
      </section>
  )
}
