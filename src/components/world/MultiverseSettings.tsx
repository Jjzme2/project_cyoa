'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Link2, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WorldLink } from '@/types'

interface Props {
  worldId: string
  authorId: string
  initialMultiverseName: string
  initialLinks: WorldLink[]
}

type EditLink = { worldId: string; worldName: string; nexus: string }

/**
 * Owner/admin editor for an EXISTING world's multiverse membership and explicit
 * links — so worlds made before the multiverse system (or any time) can opt in
 * or out. Non-owners see a compact read-only summary (or nothing, if the world
 * is self-contained). Stories inherit automatically: generation reads the live
 * world doc, so a change here takes effect on the next chapter.
 */
export function MultiverseSettings({ worldId, authorId, initialMultiverseName, initialLinks }: Props) {
  const { user, isAdmin } = useAuth()
  const isOwner = !!user && user.uid === authorId
  const canEdit = isOwner || isAdmin

  const [multiverseName, setMultiverseName] = useState(initialMultiverseName)
  const [links, setLinks] = useState<EditLink[]>(initialLinks.map((l) => ({ ...l, nexus: l.nexus ?? '' })))
  const [worldChoices, setWorldChoices] = useState<{ id: string; name: string }[]>([])
  const [knownMultiverses, setKnownMultiverses] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canEdit) return
    ;(async () => {
      try {
        const [wRes, mRes] = await Promise.all([fetch('/api/worlds/public'), fetch('/api/multiverses')])
        if (wRes.ok) {
          const data = await wRes.json()
          setWorldChoices(
            ((data.worlds ?? []) as { id: string; name: string }[])
              .filter((w) => w.id && w.name && w.id !== worldId)
              .map((w) => ({ id: w.id, name: w.name })),
          )
        }
        if (mRes.ok) {
          const data = await mRes.json()
          setKnownMultiverses(
            Array.from(new Set(((data.multiverses ?? []) as { name?: string }[]).map((m) => m.name?.trim()).filter((n): n is string => !!n))),
          )
        }
      } catch {
        /* optional */
      }
    })()
  }, [canEdit, worldId])

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/worlds/${worldId}/multiverse`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          multiverseName: multiverseName.trim() || undefined,
          links: links.length ? links.map((l) => ({ worldId: l.worldId, nexus: l.nexus.trim() || undefined })) : undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
      toast.success('Multiverse settings saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Read-only view for non-owners: show membership if any, else render nothing.
  if (!canEdit) {
    if (!initialMultiverseName && initialLinks.length === 0) return null
    return (
      <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-400/50 font-sans">
          <Link2 className="h-3.5 w-3.5" /> Multiverse
        </div>
        {initialMultiverseName && (
          <p className="text-sm text-muted-foreground/65">
            Part of the <strong className="text-foreground/80">{initialMultiverseName}</strong> multiverse.
          </p>
        )}
        {initialLinks.length > 0 && (
          <p className="text-[12px] text-muted-foreground/55">
            Linked to {initialLinks.map((l) => l.worldName).join(', ')}.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-400/55" /> Multiverse
        </h2>
        <p className="text-[11px] text-muted-foreground/45 mt-1 leading-relaxed">
          Join a shared collective (anyone naming the same multiverse pools legends together) and/or
          hand-pick worlds to link. Mature legends never echo into a lower-rated world. Takes effect
          on the next chapter.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mv-name">Multiverse name</Label>
        <Input
          id="mv-name"
          list="mv-known"
          placeholder="e.g. The Sugar Multiverse"
          value={multiverseName}
          onChange={(e) => setMultiverseName(e.target.value)}
          maxLength={60}
        />
        {knownMultiverses.length > 0 && (
          <datalist id="mv-known">
            {knownMultiverses.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}
      </div>

      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <Label htmlFor="mv-link-add">
          Linked worlds <span className="text-muted-foreground/55 font-normal text-xs">(optional)</span>
        </Label>
        <select
          id="mv-link-add"
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
                  placeholder="how they're linked (optional)"
                  value={l.nexus}
                  onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, nexus: e.target.value } : x)))}
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

      <Button
        type="button"
        onClick={save}
        disabled={saving}
        className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Save multiverse settings
      </Button>
    </div>
  )
}
