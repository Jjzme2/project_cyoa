'use client'

import { useEffect, useState } from 'react'
import { Pencil, Check, X, Lock, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'
import {
  stageFor,
  levelsToNextStage,
  speciesPreviewEmoji,
  quipForEvent,
  PET_SPECIES,
  MOOD_LABELS,
  MAX_LEVEL,
} from '@/lib/pet'
import type { PetSpecies } from '@/lib/pet'
import {
  fetchProfileState,
  invalidateProfileState,
  type ProfilePetState,
} from '@/lib/profile-state-client'
import { COMPANION_HIDDEN_KEY } from '@/components/book/pal-companion-prefs'

const LAST_LEVEL_KEY = (uid: string) => `pal_lvl_${uid}`

const MOOD_DOT: Record<string, string> = {
  thrilled: 'bg-amber-400',
  active: 'bg-emerald-400',
  idle: 'bg-sky-400/70',
  dozing: 'bg-slate-400/60',
}

/**
 * Reader Pal — a rule-based (never AI) companion that grows from a bond XP
 * score derived from everything the reader has already done. Self-contained:
 * fetches its own state via the shared profile-state client.
 */
export function ReaderPal() {
  const { user } = useAuth()
  const [pet, setPet] = useState<ProfilePetState | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [companionOn, setCompanionOn] = useState(true)

  useEffect(() => {
    // Hydration-safe localStorage read (same justified pattern as PalCompanion).
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompanionOn(localStorage.getItem(COMPANION_HIDDEN_KEY) !== '1')
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchProfileState(user.uid, () => user.getIdToken())
      .then((state) => {
        if (!alive) return
        setPet(state.pet)
        // Level-up celebration: compare against the last level seen on this
        // device; first visit just records a baseline.
        try {
          const key = LAST_LEVEL_KEY(user.uid)
          const last = Number(localStorage.getItem(key))
          if (Number.isFinite(last) && last > 0 && state.pet.level > last) {
            toast.success(`${state.pet.name} evolved to level ${state.pet.level}!`, {
              description: quipForEvent('levelup', state.pet.level),
            })
          }
          localStorage.setItem(key, String(state.pet.level))
        } catch {}
      })
      .catch(() => {})
    return () => { alive = false }
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
      invalidateProfileState() // name changed — next read should be fresh
      setRenaming(false)
    } catch {
      toast.error('Could not rename — try again.')
    } finally {
      setSaving(false)
    }
  }

  async function reskin(species: PetSpecies) {
    if (!user || !pet || species === pet.species) return
    // Locked swatches are disabled in the UI; the server-provided unlocked list
    // is the belt-and-suspenders check (the API enforces it again regardless).
    if (!pet.unlockedSpecies.includes(species)) return
    const prev = pet
    // Optimistic — the bond level doesn't change, just the species/stage skin.
    setPet({ ...pet, species, stage: stageFor(species, pet.level) })
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/profile/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ species }),
      })
      if (!res.ok) throw new Error()
      invalidateProfileState()
    } catch {
      setPet(prev)
      toast.error('Could not reskin your pal — try again.')
    }
  }

  function toggleCompanion() {
    const next = !companionOn
    setCompanionOn(next)
    try {
      if (next) localStorage.removeItem(COMPANION_HIDDEN_KEY)
      else localStorage.setItem(COMPANION_HIDDEN_KEY, '1')
    } catch {}
  }

  if (!pet) return null

  const toNextStage = levelsToNextStage(pet.species, pet.level)
  const xpPct = pet.xp.needed > 0
    ? Math.min(100, Math.round((pet.xp.into / (pet.xp.into + pet.xp.needed)) * 100))
    : 100

  const stats: { label: string; value: number }[] = [
    { label: 'stories read', value: pet.stats.storiesRead },
    { label: 'paths written', value: pet.stats.pathsWritten },
    { label: 'endings witnessed', value: pet.stats.endingsWitnessed },
    { label: 'friends made', value: pet.stats.deepBonds },
  ]

  return (
    <section className="glass border-white/10 p-5 rounded-xl space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative text-5xl leading-none" title={pet.stage.name}>
          {pet.stage.emoji}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${MOOD_DOT[pet.mood] ?? 'bg-sky-400/70'}`}
            title={MOOD_LABELS[pet.mood]}
          />
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
              <button onClick={saveRename} disabled={saving} aria-label="Save name" className="text-emerald-400/80 hover:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setRenaming(false)} aria-label="Cancel rename" className="text-muted-foreground/50 hover:text-foreground/80">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-foreground/85">{pet.name}</h3>
              <button
                onClick={() => { setDraftName(pet.name); setRenaming(true) }}
                title="Rename your pal"
                aria-label="Rename your pal"
                className="text-muted-foreground/40 hover:text-amber-300 transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <span className="ml-1 text-[9px] uppercase tracking-wider font-sans text-muted-foreground/45">
                {MOOD_LABELS[pet.mood]}
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/50">
            Level {pet.level} · {pet.stage.name}
            {toNextStage > 0 && ` · evolves in ${toNextStage} level${toNextStage === 1 ? '' : 's'}`}
          </p>
          {/* Bond XP toward the next level */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 max-w-[220px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-300/80 transition-[width] duration-700"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/45">
              {pet.level >= MAX_LEVEL ? 'MAX' : `${pet.xp.into}/${pet.xp.into + pet.xp.needed} xp`}
            </span>
          </div>
          <p className="text-[11px] italic text-amber-300/60">“{pet.quip}”</p>
        </div>
      </div>

      {/* What the pal has witnessed at the reader's side */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-3">
        {stats.map((s) => (
          <span key={s.label} className="text-[10px] font-sans text-muted-foreground/50">
            <span className="font-mono font-semibold text-amber-300/70">{s.value}</span> {s.label}
          </span>
        ))}
      </div>

      {/* Species picker — three free, three earned through achievements */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {PET_SPECIES.map((s) => {
            const unlocked = pet.unlockedSpecies.includes(s.id)
            const label = unlocked
              ? `Reskin as ${s.label}`
              : `${s.label} — locked. ${s.requires?.hint ?? ''}`.trim()
            return (
              <button
                key={s.id}
                onClick={() => unlocked && reskin(s.id)}
                disabled={!unlocked}
                title={label}
                aria-label={label}
                aria-pressed={pet.species === s.id}
                className={`relative h-7 w-7 rounded-full flex items-center justify-center text-sm transition-all ${
                  pet.species === s.id
                    ? 'bg-amber-500/20 ring-1 ring-amber-400/50'
                    : unlocked
                      ? 'opacity-60 hover:opacity-100'
                      : 'opacity-25 grayscale cursor-not-allowed'
                }`}
              >
                {speciesPreviewEmoji(s.id)}
                {!unlocked && <Lock className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-white/70" />}
              </button>
            )
          })}
        </div>
        <button
          onClick={toggleCompanion}
          aria-pressed={companionOn}
          title="Whether your pal keeps you company in the reader"
          className={`flex items-center gap-1.5 text-[10px] font-sans px-2 py-1 rounded-md border transition-colors ${
            companionOn
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300/80'
              : 'border-white/10 text-muted-foreground/50 hover:text-muted-foreground/80'
          }`}
        >
          <BookOpen className="h-3 w-3" />
          {companionOn ? 'Reads with you' : 'Stays home'}
        </button>
      </div>
    </section>
  )
}
