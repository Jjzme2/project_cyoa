'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Feather, ChevronRight, Scroll, Lock, PenLine, Wand2, ImagePlus, ShieldAlert, Check, Trash2, Hourglass, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BountyControl } from '@/components/book/BountyControl'
import { useAuth } from '@/components/Providers'
import { validatePromptLocal } from '@/lib/validate'
import { CreatorResourceManager } from '@/lib/creator-resources'
import { metEndingCondition } from '@/lib/engine/ending-conditions'
import { SlotRequirementsEditor } from './SlotRequirementsEditor'
import type { ChoiceSlot, ResourceDefinition, ChoiceRequirement, ChoiceEffect, StoryCharacter, Protagonist, EndingCondition } from '@/types'

interface Props {
  storyId: string
  nodeId: string
  slots: ChoiceSlot[]
  onChoiceSelect: (nodeId: string, effects?: ChoiceEffect[]) => void
  onSlotFilled: (slot: ChoiceSlot, nodeId: string, pendingReview?: boolean) => void
  onModerated?: () => void
  currentResources?: Record<string, number | string | string[] | number[]>
  storyResources?: ResourceDefinition[]
  storyCharacters?: StoryCharacter[]
  protagonist?: Protagonist
  /** Sagas (the reader plays as themselves) don't carry bounties. */
  isSaga?: boolean
  /** Author win/lose conditions — when met by the reader's resources, the path
   * they write becomes a definitive ending. */
  endingConditions?: EndingCondition[]
}

function checkRequirements(slot: ChoiceSlot, currentRes: Record<string, number | string | string[] | number[]>): boolean {
  return CreatorResourceManager.evaluateRequirements(slot.requirements, currentRes)
}

export function ChoiceSlots({
  storyId,
  nodeId,
  slots,
  onChoiceSelect,
  onSlotFilled,
  onModerated,
  currentResources,
  storyResources,
  isSaga,
  endingConditions,
}: Props) {
  const { user, tier, isAdmin, openAuthModal, aiUsesRemaining, updateAiUses } = useAuth()
  const [inputs, setInputs] = useState<Record<string, string>>({})

  // A newcomer's words survive the sign-in round-trip: drafts written while
  // signed out are mirrored to localStorage before auth opens; when the user
  // arrives (popup OR redirect), restore them into the editors and clean up.
  useEffect(() => {
    if (!user) return
    // Deferred a tick: an external-store (localStorage) read, applied off the
    // effect body so it can't cascade renders.
    const t = setTimeout(() => {
      const restored: Record<string, string> = {}
      for (const slot of slots) {
        try {
          const key = `chronicle:slotdraft:${storyId}:${slot.id}`
          const saved = localStorage.getItem(key)
          if (saved) {
            restored[slot.id] = saved
            localStorage.removeItem(key)
          }
        } catch {}
      }
      if (Object.keys(restored).length > 0) {
        setInputs((prev) => ({ ...restored, ...prev }))
        toast.success('Welcome! Your words are right where you left them — press publish when ready.')
      }
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore on sign-in
  }, [user])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageEnabled, setImageEnabled] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [moderating, setModerating] = useState<string | null>(null)
  const [flagging, setFlagging] = useState<string | null>(null)
  const [flagCounts, setFlagCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(slots.filter((s) => s.flagVoteCount).map((s) => [s.id, s.flagVoteCount!])),
  )
  const [userFlagVotes, setUserFlagVotes] = useState<Record<string, boolean>>({})

  // Total reads across the filled paths from this page, for "% went here".
  const filledTotal = slots.reduce(
    (sum, s) => sum + (s.filled && !s.pendingReview ? s.traversals ?? 0 : 0),
    0,
  )

  // Best-effort popularity counter; never blocks navigation. Sends the reader's
  // token when signed in so a genuine read can count toward the path author's
  // Path Pioneer milestone (the server dedupes and excludes self-traversal).
  async function recordTraversal(slot: ChoiceSlot) {
    if (!slot.childNodeId) return
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (user) {
      try {
        headers.Authorization = `Bearer ${await user.getIdToken()}`
      } catch {
        // fall through as an anonymous (popularity-only) traversal
      }
    }
    fetch(`/api/stories/${storyId}/nodes/${nodeId}/slots/${slot.id}/traverse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ childNodeId: slot.childNodeId }),
    }).catch(() => {})
  }

  async function moderateRoute(slot: ChoiceSlot, action: 'approve' | 'reject') {
    if (!user || !slot.childNodeId) return
    setModerating(slot.id)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${storyId}/nodes/${slot.childNodeId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Moderation failed')
      toast.success(action === 'approve' ? 'Route approved and published.' : 'Route removed.')
      onModerated?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Moderation failed')
    } finally {
      setModerating(null)
    }
  }
  
  // Outer key: slotId, Inner key: resourceName
  const [slotReqs, setSlotReqs] = useState<Record<string, Record<string, { enabled: boolean; op: string; val: string }>>>({})
  const [slotEffs, setSlotEffs] = useState<Record<string, Record<string, { enabled: boolean; op: string; val: string }>>>({})
  const IMAGE_CREDITS = 3

  const aiLimit = tier === 'PREMIUM' ? 100 : 20
  const outOfUses = aiUsesRemaining !== null && aiUsesRemaining <= 0

  async function handleSubmit(slot: ChoiceSlot) {
    if (!user) {
      openAuthModal()
      return
    }
    const text = inputs[slot.id]?.trim()
    if (!text) return

    const localCheck = validatePromptLocal(text)
    if (!localCheck.valid) {
      setErrors((prev) => ({ ...prev, [slot.id]: localCheck.reason! }))
      return
    }
    setErrors((prev) => { const n = { ...prev }; delete n[slot.id]; return n })

    // Build requirements and effects to send
    const reqsToSend: ChoiceRequirement[] = []
    const effsToSend: ChoiceEffect[] = []

    if (storyResources) {
      storyResources.forEach((res) => {
        const req = slotReqs[slot.id]?.[res.name]
        if (req?.enabled && req.val.trim() !== '') {
          reqsToSend.push({
            resourceName: res.name,
            operator: req.op as ChoiceRequirement['operator'],
            value: res.type === 'number' ? Number(req.val) : req.val,
          })
        }

        const eff = slotEffs[slot.id]?.[res.name]
        if (eff?.enabled && eff.val.trim() !== '') {
          effsToSend.push({
            resourceName: res.name,
            operator: eff.op as ChoiceEffect['operator'],
            value: res.type === 'number' ? Number(eff.val) : eff.val,
          })
        }
      })
    }

    const metCondition = metEndingCondition(endingConditions, currentResources)

    setSubmitting(slot.id)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${storyId}/nodes/${nodeId}/slots/${slot.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          promptText: text,
          includeImage: imageEnabled[slot.id] ?? false,
          requirements: reqsToSend,
          effects: effsToSend,
          worldState: currentResources ?? {},
          // Author win/lose: if the reader's resources already meet a condition,
          // the chapter they're writing becomes that definitive ending.
          ...(metCondition ? { forceEnding: { type: metCondition.type, title: metCondition.title } } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Generation failed')
      }

      if (typeof data.remaining === 'number') updateAiUses(data.remaining)

      if (data.pendingReview) {
        // Flagged by the guidelines — stored but hidden until an admin reviews.
        toast.info('Your path was submitted and is awaiting review before it appears.')
      } else if (imageEnabled[slot.id] && !data.imageUrl) {
        toast.warning(
          data.imageError
            ? `Your path has been woven, but the illustration failed: ${data.imageError}`
            : 'Your path has been woven, but the illustration failed.'
        )
      } else {
        toast.success('Your path has been woven into the story!')
      }

      onSlotFilled(slot, data.nodeId, data.pendingReview === true)
      setInputs((prev) => {
        const next = { ...prev }
        delete next[slot.id]
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(null)
    }
  }

  async function handleFlag(slot: ChoiceSlot) {
    if (!user) { openAuthModal(); return }
    setFlagging(slot.id)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${storyId}/nodes/${nodeId}/slots/${slot.id}/flag`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not register vote'); return }
      setFlagCounts((prev) => ({ ...prev, [slot.id]: data.flagVoteCount }))
      setUserFlagVotes((prev) => ({ ...prev, [slot.id]: data.userHasFlagged }))
      if (data.autoRemoved) {
        toast.info('This path has been removed by community vote.')
        onModerated?.()
      } else if (data.userHasFlagged) {
        toast.success('Your vote has been counted.')
      } else {
        toast('Vote retracted.')
      }
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setFlagging(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] uppercase tracking-[0.25em] opacity-60 font-sans">
          Choose your path
        </p>
        {user && aiUsesRemaining !== null && (
          <div
            className="flex items-center gap-1 text-[9px] font-sans opacity-50"
            title="Daily AI uses remaining"
          >
            <Wand2 className="h-2.5 w-2.5" />
            <span style={{ color: outOfUses ? 'oklch(0.65 0.18 25)' : undefined }}>
              {aiUsesRemaining}/{aiLimit}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3">
        {slots.map((slot, i) => (
          <motion.div
            key={slot.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 + 0.18, duration: 0.35 }}
          >
            {slot.pendingReview ? (
              <div
                className="px-4 py-3 rounded-lg border"
                style={{
                  background: 'color-mix(in oklch, var(--page-text) 5%, transparent)',
                  borderColor: 'color-mix(in oklch, var(--page-text) 15%, transparent)',
                  borderStyle: 'dashed',
                }}
              >
                <div className="flex items-center gap-2.5 opacity-50">
                  <Hourglass className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12px] font-sans italic">
                    A path here is awaiting review…
                  </span>
                </div>
              </div>
            ) : slot.filled ? (
              (() => {
                const meetsReqs = checkRequirements(slot, currentResources ?? {})
                const showAdmin = isAdmin && slot.childModeration === 'flagged'
                const pct =
                  filledTotal >= 5 && slot.traversals
                    ? Math.round((slot.traversals / filledTotal) * 100)
                    : null
                return (
                  <div className="space-y-1.5">
                  <motion.button
                    onClick={() => {
                      if (meetsReqs && slot.childNodeId) {
                        recordTraversal(slot)
                        onChoiceSelect(slot.childNodeId, slot.effects)
                      }
                    }}
                    disabled={!meetsReqs}
                    whileTap={meetsReqs ? { scale: 0.96 } : undefined}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      meetsReqs
                        ? 'hover:brightness-90 shadow-md hover:shadow-lg'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    style={{
                      background: meetsReqs
                        ? 'color-mix(in oklch, var(--page-text) 22%, transparent)'
                        : 'color-mix(in oklch, var(--page-text) 5%, transparent)',
                      borderColor: meetsReqs
                        ? 'color-mix(in oklch, var(--page-text) 45%, transparent)'
                        : 'color-mix(in oklch, var(--page-text) 10%, transparent)',
                      color: 'var(--page-text)',
                      boxShadow: meetsReqs
                        ? 'inset 3px 0 0 color-mix(in oklch, var(--page-text) 55%, transparent)'
                        : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="flex items-start gap-2.5">
                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[13.5px] leading-snug">{slot.promptText}</span>
                          {(slot.submitterName || pct !== null) && (
                            <div className="flex items-center gap-1.5 text-[10px] font-sans opacity-45">
                              {slot.submitterName && <span>by {slot.submitterName}</span>}
                              {slot.submitterName && pct !== null && <span>·</span>}
                              {pct !== null && <span>{pct}% chose this</span>}
                            </div>
                          )}
                          {!meetsReqs && slot.requirements && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {slot.requirements.map((req, rIdx) => (
                                <span key={rIdx} className="text-[10px] font-sans font-medium text-red-400 bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 rounded">
                                  Requires {req.resourceName} {req.operator} {req.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {meetsReqs && slot.childHasImage && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans font-medium tracking-wider uppercase border shrink-0 select-none mt-0.5"
                          style={{
                            background: 'oklch(0.40 0.12 140 / 12%)',
                            borderColor: 'oklch(0.45 0.12 140 / 25%)',
                            color: 'oklch(0.48 0.12 140)',
                          }}
                          title="This path contains an illustration"
                        >
                          <ImagePlus className="h-2.5 w-2.5" />
                          Illustrated
                        </span>
                      )}
                    </div>
                  </motion.button>
                  {showAdmin && (
                    <div
                      className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                      style={{ background: 'oklch(0.92 0.04 25 / 30%)', borderColor: 'oklch(0.55 0.14 25 / 35%)' }}
                    >
                      <span
                        className="flex items-center gap-1 text-[10px] font-sans font-medium uppercase tracking-wider"
                        style={{ color: 'oklch(0.50 0.16 25)' }}
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Flagged for review
                      </span>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={() => moderateRoute(slot, 'approve')}
                        disabled={moderating === slot.id}
                        className="h-7 px-2 gap-1 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => moderateRoute(slot, 'reject')}
                        disabled={moderating === slot.id}
                        className="h-7 px-2 gap-1 text-[11px] bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  )}
                  {/* Community flag-to-remove row — hidden from path's own submitter */}
                  {meetsReqs && user && user.uid !== slot.submittedBy && (
                    (() => {
                      const count = flagCounts[slot.id] ?? 0
                      const hasFlagged = userFlagVotes[slot.id] ?? false
                      return (
                        <div className="flex items-center justify-end gap-1.5">
                          {count > 0 && (
                            <span className="text-[9px] font-sans opacity-40">
                              {count} {count === 1 ? 'reader' : 'readers'} flagged
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleFlag(slot)}
                            disabled={flagging === slot.id}
                            title={hasFlagged ? 'Retract your flag' : 'Flag this path as inappropriate'}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans transition-all hover:opacity-80 border"
                            style={{
                              color: hasFlagged
                                ? 'oklch(0.55 0.18 25)'
                                : 'color-mix(in oklch, var(--page-text) 55%, transparent)',
                              borderColor: hasFlagged
                                ? 'oklch(0.55 0.18 25 / 35%)'
                                : 'color-mix(in oklch, var(--page-text) 22%, transparent)',
                              background: hasFlagged ? 'oklch(0.55 0.18 25 / 8%)' : 'transparent',
                              opacity: flagging === slot.id ? 0.5 : 1,
                            }}
                          >
                            <Flag className="h-3 w-3" />
                            {hasFlagged ? 'Flagged' : 'Flag'}
                          </button>
                        </div>
                      )
                    })()
                  )}
                  </div>
                )
              })()
            ) : slot.locked ? (
              /* Slot being written by another user */
              <div
                className="px-4 py-3 rounded-lg border"
                style={{
                  background: 'color-mix(in oklch, var(--page-text) 5%, transparent)',
                  borderColor: 'color-mix(in oklch, var(--page-text) 15%, transparent)',
                  borderStyle: 'dashed',
                }}
              >
                <div className="flex items-center gap-2.5 opacity-65">
                  <PenLine className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                  <span className="text-[12px] font-sans italic">
                    A storyteller is weaving path {i + 1}…
                  </span>
                </div>
                <div className="mt-2">
                  {!isSaga && <BountyControl storyId={storyId} nodeId={nodeId} slot={slot} readOnly />}
                </div>
              </div>
            ) : user ? (
              /* Logged-in: write the path */
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-sans opacity-60">
                  <Scroll className="h-3 w-3" />
                  Path {i + 1} — awaiting a storyteller
                </div>
                {outOfUses ? (
                  <div
                    className="px-4 py-3 rounded-lg border text-[12px] font-sans italic opacity-50"
                    style={{
                      background: 'oklch(0.90 0.02 25 / 20%)',
                      borderColor: 'oklch(0.50 0.10 25 / 20%)',
                      color: 'oklch(0.45 0.12 25)',
                    }}
                  >
                    Daily limit reached — returns tomorrow.
                  </div>
                ) : (
                  <>
                    <Textarea
                      placeholder={`Write where path ${i + 1} leads…`}
                      value={inputs[slot.id] ?? ''}
                      onChange={(e) => {
                        setInputs((prev) => ({ ...prev, [slot.id]: e.target.value }))
                        if (errors[slot.id]) setErrors((prev) => { const n = { ...prev }; delete n[slot.id]; return n })
                      }}
                      disabled={submitting === slot.id}
                      // Override the base muted-gray placeholder (invisible on
                      // light page colorings) with the adaptive page-text colour.
                      className="text-[13px] min-h-[68px] resize-none focus-visible:ring-1 placeholder:text-[var(--page-text)] placeholder:opacity-60"
                      style={{
                        background: 'color-mix(in oklch, var(--page-text) 10%, transparent)',
                        borderColor: errors[slot.id]
                          ? 'oklch(0.55 0.18 25 / 60%)'
                          : 'color-mix(in oklch, var(--page-text) 32%, transparent)',
                        fontFamily: 'Georgia, serif',
                        color: 'var(--page-text)',
                      }}
                    />
                    {errors[slot.id] && (
                      <p className="text-[11px] font-sans" style={{ color: 'oklch(0.60 0.18 25)' }}>
                        {errors[slot.id]}
                      </p>
                    )}
                    
                    <SlotRequirementsEditor slot={slot} storyResources={storyResources} slotReqs={slotReqs} setSlotReqs={setSlotReqs} slotEffs={slotEffs} setSlotEffs={setSlotEffs} />

                    {/* Image toggle */}
                    {aiUsesRemaining !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          setImageEnabled((prev) => ({ ...prev, [slot.id]: !prev[slot.id] }))
                        }
                        disabled={
                          submitting === slot.id ||
                          (!imageEnabled[slot.id] && (aiUsesRemaining ?? 0) < IMAGE_CREDITS)
                        }
                        className="flex items-center gap-1.5 text-[10px] font-sans transition-opacity"
                        style={{
                          opacity:
                            (aiUsesRemaining ?? 0) < IMAGE_CREDITS && !imageEnabled[slot.id]
                              ? 0.4
                              : imageEnabled[slot.id]
                              ? 1
                              : 0.7,
                          color: imageEnabled[slot.id]
                            ? 'oklch(0.62 0.13 200)'
                            : 'var(--page-text)',
                        }}
                        title={`Generate an illustration (+${IMAGE_CREDITS - 1} extra credits)`}
                      >
                        <ImagePlus className="h-3 w-3" />
                        {imageEnabled[slot.id]
                          ? `Illustration on (${IMAGE_CREDITS} credits)`
                          : `Add illustration (+${IMAGE_CREDITS - 1} credits)`}
                      </button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleSubmit(slot)}
                      disabled={!inputs[slot.id]?.trim() || submitting === slot.id}
                      className="w-full text-xs gap-1.5 border font-medium"
                      style={{
                        background: 'color-mix(in oklch, var(--page-text) 14%, transparent)',
                        borderColor: 'color-mix(in oklch, var(--page-text) 34%, transparent)',
                        color: 'var(--page-text)',
                      }}
                    >
                      {submitting === slot.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {imageEnabled[slot.id] ? 'Weaving + illustrating…' : 'Weaving the tale…'}
                        </>
                      ) : (
                        <>
                          <Feather className="h-3 w-3" />
                          Contribute this path
                        </>
                      )}
                    </Button>
                  </>
                )}
                {!isSaga && <BountyControl storyId={storyId} nodeId={nodeId} slot={slot} onChange={onModerated} />}
              </div>
            ) : (
              /* Logged-out: write first, sign in only to publish. The words are
                 kept in state AND mirrored to localStorage before auth, so
                 nothing a newcomer writes is ever lost to the sign-in step. */
              <div
                className="space-y-2 px-4 py-3 rounded-lg border"
                style={{
                  background: 'color-mix(in oklch, var(--page-text) 5%, transparent)',
                  borderColor: 'color-mix(in oklch, var(--page-text) 15%, transparent)',
                  borderStyle: 'dashed',
                }}
              >
                <div className="flex items-center gap-2 opacity-70">
                  <Feather className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12px] font-sans italic">
                    This path hasn&apos;t been written yet — it&apos;s waiting for you.
                  </span>
                </div>
                <Textarea
                  placeholder={slot.promptText ? `Perhaps: ${slot.promptText}` : 'Write where this path leads…'}
                  value={inputs[slot.id] ?? ''}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                  className="text-[13px] min-h-[68px] resize-none focus-visible:ring-1 placeholder:text-[var(--page-text)] placeholder:opacity-60"
                  style={{
                    background: 'color-mix(in oklch, var(--page-text) 10%, transparent)',
                    borderColor: 'color-mix(in oklch, var(--page-text) 32%, transparent)',
                    fontFamily: 'Georgia, serif',
                    color: 'var(--page-text)',
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-sans opacity-45">Your words are kept safe through sign-in.</span>
                  <button
                    onClick={() => {
                      const text = (inputs[slot.id] ?? '').trim()
                      if (text) {
                        try {
                          localStorage.setItem(`chronicle:slotdraft:${storyId}:${slot.id}`, text)
                        } catch {}
                      }
                      openAuthModal()
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-sans px-2.5 py-1.5 rounded border transition-all hover:brightness-110"
                    style={{
                      background: 'color-mix(in oklch, var(--page-text) 14%, transparent)',
                      borderColor: 'color-mix(in oklch, var(--page-text) 34%, transparent)',
                      color: 'var(--page-text)',
                    }}
                  >
                    <Lock className="h-3 w-3" />
                    {(inputs[slot.id] ?? '').trim() ? 'Sign in to publish your path' : `Sign in to write path ${i + 1}`}
                  </button>
                </div>
                {!isSaga && <BountyControl storyId={storyId} nodeId={nodeId} slot={slot} readOnly />}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
