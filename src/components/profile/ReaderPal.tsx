'use client'

import { useEffect, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'
import { achievementsToNextStage, speciesPreviewEmoji, PET_SPECIES, type PetStage, type PetMood, type PetSpecies } from '@/lib/pet'

interface PetData {
  name: string
  species: PetSpecies
  stage: PetStage
  mood: PetMood
  quip: string
  achievementsEarned: number
}

/**
 * Reader Pal — a small, rule-based (never AI) companion that levels up purely
 * from the reader's total earned achievements. Self-contained: fetches its own
 * state, so it drops into the profile with no plumbing from the page.
 */
export function ReaderPal() {
  const { user } = useAuth()
  const [pet, setPet] = useState<PetData | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(async (token) => {
      const res = await fetch('/api/profile/pet', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setPet(await res.json())
    })
  }, [user])

  async function saveRename() {
    if (!user || !pet || !draftName.trim()) return
    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/profile/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: draftName.trim() }),
      })
      if (!res.ok) throw new Error()
      setPet({ ...pet, name: draftName.trim() })
      setRenaming(false)
    } catch {
      toast.error('Could not rename — try again.')
    } finally {
      setSaving(false)
    }
  }

  async function reskin(species: PetSpecies) {
    if (!user || !pet || species === pet.species) return
    const prev = pet
    // Optimistic — the level (achievement count) doesn't change, just the species.
    setPet({ ...pet, species })
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/profile/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ species }),
      })
      if (!res.ok) throw new Error()
      // Re-fetch so the stage/emoji reflect the new species at the current level.
      const fresh = await fetch('/api/profile/pet', { headers: { Authorization: `Bearer ${token}` } })
      if (fresh.ok) setPet(await fresh.json())
    } catch {
      setPet(prev)
      toast.error('Could not reskin your pal — try again.')
    }
  }

  if (!pet) return null

  const toNext = achievementsToNextStage(pet.species, pet.achievementsEarned)

  return (
    <section className="glass border-white/10 p-5 rounded-xl flex items-center gap-4">
      <div className="text-4xl leading-none" title={pet.stage.name}>
        {pet.stage.emoji}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              maxLength={24}
              className="text-sm font-semibold bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-foreground/90 w-32"
            />
            <button onClick={saveRename} disabled={saving} className="text-emerald-400/80 hover:text-emerald-300">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setRenaming(false)} className="text-muted-foreground/50 hover:text-foreground/80">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-foreground/85">{pet.name}</h3>
            <button
              onClick={() => { setDraftName(pet.name); setRenaming(true) }}
              title="Rename your pal"
              className="text-muted-foreground/40 hover:text-amber-300 transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/50">
          Level {pet.stage.level} · {pet.stage.name}
          {toNext > 0 && ` · ${toNext} more achievement${toNext === 1 ? '' : 's'} to evolve`}
        </p>
        <p className="text-[11px] italic text-amber-300/60">“{pet.quip}”</p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {PET_SPECIES.map((s) => (
          <button
            key={s.id}
            onClick={() => reskin(s.id)}
            title={`Reskin as ${s.label}`}
            className={`h-6 w-6 rounded-full flex items-center justify-center text-xs transition-all ${
              pet.species === s.id ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'opacity-50 hover:opacity-90'
            }`}
          >
            {speciesPreviewEmoji(s.id)}
          </button>
        ))}
      </div>
    </section>
  )
}
