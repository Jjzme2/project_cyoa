'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Star, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { Button } from '@/components/ui/button'

interface Props {
  worldId: string
  authorId: string
  initialCharacterIds: string[]
}

interface CharacterOption {
  id: string
  name: string
  tagline?: string
}

/**
 * Owner/admin editor for a world's hand-picked "guest star" Characters
 * (Characters Fold 2d) — independent of the multiverse/links system, which
 * only ever surfaces figures from explicitly connected worlds. Non-owners see
 * a compact read-only summary (or nothing, if none are set).
 */
export function GuestStarSettings({ worldId, authorId, initialCharacterIds }: Props) {
  const { user, isAdmin } = useAuth()
  const isOwner = !!user && user.uid === authorId
  const canEdit = isOwner || isAdmin

  const [characterIds, setCharacterIds] = useState<string[]>(initialCharacterIds)
  const [options, setOptions] = useState<CharacterOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canEdit) return
    fetch('/api/characters?limit=200')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setOptions(data.characters ?? []))
      .catch(() => {})
  }, [canEdit])

  const picked = characterIds.map((id) => options.find((o) => o.id === id)).filter((o): o is CharacterOption => !!o)
  const pickedNames = new Map(picked.map((o) => [o.id, o.name]))

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/worlds/${worldId}/guest-stars`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ characterIds }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
      toast.success('Guest stars saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    if (initialCharacterIds.length === 0) return null
    return (
      <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-400/50 font-sans">
          <Star className="h-3.5 w-3.5" /> Guest Stars
        </div>
        <p className="text-[12px] text-muted-foreground/55">
          {initialCharacterIds.length} hand-picked character{initialCharacterIds.length === 1 ? '' : 's'} may cross into this world.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400/55" /> Guest Stars
        </h2>
        <p className="text-[11px] text-muted-foreground/45 mt-1 leading-relaxed">
          Hand-pick up to 5 characters from the registry to feature as rare guest stars in this world —
          independent of any multiverse connection. Takes effect on the next chapter.
        </p>
      </div>

      <select
        value=""
        onChange={(e) => {
          const id = e.target.value
          if (!id || characterIds.includes(id) || characterIds.length >= 5) return
          setCharacterIds((prev) => [...prev, id])
        }}
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{characterIds.length >= 5 ? 'Maximum of 5 reached' : 'Add a guest star…'}</option>
        {options
          .filter((o) => !characterIds.includes(o.id))
          .map((o) => (
            <option key={o.id} value={o.id} className="bg-background">{o.name}</option>
          ))}
      </select>

      {characterIds.length > 0 && (
        <div className="space-y-2">
          {characterIds.map((id) => (
            <div key={id} className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-lg">
              <Star className="h-3.5 w-3.5 text-amber-400/45 shrink-0" />
              <span className="text-[12px] text-foreground/75 flex-1 truncate">{pickedNames.get(id) ?? id}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCharacterIds((prev) => prev.filter((x) => x !== id))}
                className="h-7 px-2 text-red-400/80 hover:text-red-300 hover:bg-red-500/10 shrink-0"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={save}
        disabled={saving}
        className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
        Save guest stars
      </Button>
    </div>
  )
}
