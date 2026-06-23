'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Feather, ChevronRight, Scroll, Lock, PenLine, Wand2, ImagePlus, ShieldAlert, Check, Trash2, Hourglass, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BountyControl } from '@/components/book/BountyControl'
import { useAuth } from '@/components/Providers'
import { validatePromptLocal } from '@/lib/validate'
import { CreatorResourceManager } from '@/lib/creator-resources'
import type { ChoiceSlot, ResourceDefinition, ChoiceRequirement, ChoiceEffect, StoryCharacter, Protagonist } from '@/types'

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
}: Props) {
  const { user, tier, isAdmin, openAuthModal, aiUsesRemaining, updateAiUses } = useAuth()
  const [inputs, setInputs] = useState<Record<string, string>>({})
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

  // Best-effort popularity counter; never blocks navigation.
  function recordTraversal(slot: ChoiceSlot) {
    if (!slot.childNodeId) return
    fetch(`/api/stories/${storyId}/nodes/${nodeId}/slots/${slot.id}/traverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        <p className="text-[9px] uppercase tracking-[0.25em] opacity-35 font-sans">
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
                  <button
                    onClick={() => {
                      if (meetsReqs && slot.childNodeId) {
                        recordTraversal(slot)
                        onChoiceSelect(slot.childNodeId, slot.effects)
                      }
                    }}
                    disabled={!meetsReqs}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      meetsReqs
                        ? 'hover:brightness-90 active:scale-[0.98] shadow-md hover:shadow-lg'
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
                  </button>
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
                <div className="flex items-center gap-2.5 opacity-40">
                  <PenLine className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                  <span className="text-[12px] font-sans italic">
                    A storyteller is weaving path {i + 1}…
                  </span>
                </div>
                <div className="mt-2">
                  <BountyControl storyId={storyId} nodeId={nodeId} slot={slot} readOnly />
                </div>
              </div>
            ) : user ? (
              /* Logged-in: write the path */
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-sans opacity-35">
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
                      className="text-[13px] min-h-[68px] resize-none focus-visible:ring-1 placeholder:opacity-25"
                      style={{
                        background: 'color-mix(in oklch, var(--page-text) 8%, transparent)',
                        borderColor: errors[slot.id]
                          ? 'oklch(0.55 0.18 25 / 60%)'
                          : 'color-mix(in oklch, var(--page-text) 20%, transparent)',
                        fontFamily: 'Georgia, serif',
                        color: 'var(--page-text)',
                      }}
                    />
                    {errors[slot.id] && (
                      <p className="text-[11px] font-sans" style={{ color: 'oklch(0.60 0.18 25)' }}>
                        {errors[slot.id]}
                      </p>
                    )}
                    
                    {/* Path conditions and effects editor */}
                    {storyResources && storyResources.length > 0 && (
                      <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg space-y-3 mt-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-amber-500/70 font-semibold font-sans">
                          Path Requirements & Rewards
                        </div>
                        <div className="space-y-2">
                          {storyResources.map((resDef) => {
                            const isBool   = resDef.type === 'boolean'
                            const isArr    = resDef.type === 'array'
                            const hasChoices = resDef.isInitialChoice && resDef.choices && resDef.choices.length > 0
                            const defaultReqOp  = isArr ? 'contains' : '=='
                            const defaultEffOp  = isArr ? 'add' : '='
                            const defaultReqVal = isBool ? 'true' : ''
                            const defaultEffVal = isBool ? 'true' : ''
                            const req = slotReqs[slot.id]?.[resDef.name] ?? { enabled: false, op: defaultReqOp, val: defaultReqVal }
                            const eff = slotEffs[slot.id]?.[resDef.name] ?? { enabled: false, op: defaultEffOp, val: defaultEffVal }

                            function setReq(patch: Partial<typeof req>) {
                              setSlotReqs((prev) => ({
                                ...prev,
                                [slot.id]: { ...(prev[slot.id] ?? {}), [resDef.name]: { ...req, ...patch } },
                              }))
                            }
                            function setEff(patch: Partial<typeof eff>) {
                              setSlotEffs((prev) => ({
                                ...prev,
                                [slot.id]: { ...(prev[slot.id] ?? {}), [resDef.name]: { ...eff, ...patch } },
                              }))
                            }

                            return (
                              <div key={resDef.name} className="border-b border-white/[0.04] pb-2 last:border-0 last:pb-0 space-y-1.5">
                                <div className="text-[11px] font-sans font-medium text-foreground/75 flex justify-between">
                                  <span>
                                    {resDef.icon && <span className="mr-1">{resDef.icon}</span>}
                                    {resDef.name}
                                    <span className="opacity-30 text-[9px] font-normal ml-1">({resDef.type})</span>
                                  </span>
                                  {resDef.description && (
                                    <span className="opacity-40 text-[9px] font-normal max-w-[150px] truncate" title={resDef.description}>
                                      {resDef.description}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                                  {/* Requirement */}
                                  <div className="flex items-center gap-1.5 bg-white/[0.01] p-1.5 rounded border border-white/[0.03]">
                                    <input
                                      type="checkbox"
                                      title={`Enable requirement for ${resDef.name}`}
                                      checked={req.enabled}
                                      onChange={(e) => setReq({ enabled: e.target.checked })}
                                      className="rounded bg-background border-input h-3 w-3"
                                    />
                                    <span className="text-[10px] font-sans opacity-50 shrink-0">Req:</span>
                                    {req.enabled && (
                                      <div className="flex gap-1 items-center w-full">
                                        {/* Boolean: just a single is/is-not + true/false */}
                                        {isBool ? (
                                          <>
                                            <select
                                              value={req.op}
                                              title="Requirement operator"
                                              onChange={(e) => setReq({ op: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none"
                                            >
                                              <option value="==">is</option>
                                              <option value="!=">is not</option>
                                            </select>
                                            <select
                                              value={req.val}
                                              title="Requirement value"
                                              onChange={(e) => setReq({ val: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none flex-1"
                                            >
                                              <option value="true">true</option>
                                              <option value="false">false</option>
                                            </select>
                                          </>
                                        ) : hasChoices ? (
                                          /* isInitialChoice string: dropdown of choices */
                                          <>
                                            <select
                                              value={req.op}
                                              title="Requirement operator"
                                              onChange={(e) => setReq({ op: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none"
                                            >
                                              <option value="==">==</option>
                                              <option value="!=">!=</option>
                                            </select>
                                            <select
                                              value={req.val}
                                              title="Requirement value"
                                              onChange={(e) => setReq({ val: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none flex-1"
                                            >
                                              {resDef.choices!.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                              ))}
                                            </select>
                                          </>
                                        ) : (
                                          /* Standard operator + value input */
                                          <>
                                            <select
                                              value={req.op}
                                              title={`Requirement operator for ${resDef.name}`}
                                              onChange={(e) => setReq({ op: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none"
                                            >
                                              {isArr ? (
                                                <>
                                                  <option value="contains">contains</option>
                                                  <option value="not_contains">does not contain</option>
                                                </>
                                              ) : (
                                                <>
                                                  <option value="==">==</option>
                                                  <option value="!=">!=</option>
                                                </>
                                              )}
                                              {resDef.type === 'number' && (
                                                <>
                                                  <option value=">">&gt;</option>
                                                  <option value="<">&lt;</option>
                                                  <option value=">=">&gt;=</option>
                                                  <option value="<=">&lt;=</option>
                                                </>
                                              )}
                                            </select>
                                            <input
                                              type={resDef.type === 'number' ? 'number' : 'text'}
                                              value={req.val}
                                              placeholder={isArr ? 'e.g. Iron Key' : 'Value'}
                                              onChange={(e) => setReq({ val: e.target.value })}
                                              className="text-[9px] h-6 px-1.5 rounded border bg-background text-foreground w-full focus:outline-none"
                                            />
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Effect */}
                                  <div className="flex items-center gap-1.5 bg-white/[0.01] p-1.5 rounded border border-white/[0.03]">
                                    <input
                                      type="checkbox"
                                      title={`Enable modifier for ${resDef.name}`}
                                      checked={eff.enabled}
                                      onChange={(e) => setEff({ enabled: e.target.checked })}
                                      className="rounded bg-background border-input h-3 w-3"
                                    />
                                    <span className="text-[10px] font-sans opacity-50 shrink-0">Mod:</span>
                                    {eff.enabled && (
                                      <div className="flex gap-1 items-center w-full">
                                        {isBool ? (
                                          /* Boolean: set to true/false only */
                                          <>
                                            <span className="text-[9px] opacity-40 shrink-0">set to</span>
                                            <select
                                              value={eff.val}
                                              title="Effect value"
                                              onChange={(e) => setEff({ val: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none flex-1"
                                            >
                                              <option value="true">true</option>
                                              <option value="false">false</option>
                                            </select>
                                          </>
                                        ) : hasChoices ? (
                                          /* isInitialChoice string: dropdown */
                                          <>
                                            <span className="text-[9px] opacity-40 shrink-0">=</span>
                                            <select
                                              value={eff.val}
                                              title="Effect value"
                                              onChange={(e) => setEff({ val: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none flex-1"
                                            >
                                              {resDef.choices!.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                              ))}
                                            </select>
                                          </>
                                        ) : (
                                          /* Standard operator + value input */
                                          <>
                                            <select
                                              value={eff.op}
                                              title={`Modifier operator for ${resDef.name}`}
                                              onChange={(e) => setEff({ op: e.target.value })}
                                              className="text-[9px] h-6 px-1 rounded border bg-background text-foreground focus:outline-none"
                                            >
                                              <option value="=">=</option>
                                              {resDef.type === 'number' && (
                                                <>
                                                  <option value="+=">+=</option>
                                                  <option value="-=">-=</option>
                                                </>
                                              )}
                                              {isArr && (
                                                <>
                                                  <option value="add">add</option>
                                                  <option value="remove">remove</option>
                                                </>
                                              )}
                                            </select>
                                            <input
                                              type={resDef.type === 'number' ? 'number' : 'text'}
                                              value={eff.val}
                                              placeholder={isArr ? 'e.g. Iron Key' : 'Value'}
                                              onChange={(e) => setEff({ val: e.target.value })}
                                              className="text-[9px] h-6 px-1.5 rounded border bg-background text-foreground w-full focus:outline-none"
                                            />
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

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
                              ? 0.3
                              : imageEnabled[slot.id]
                              ? 1
                              : 0.5,
                          color: imageEnabled[slot.id]
                            ? 'oklch(0.55 0.12 200)'
                            : 'oklch(0.45 0.04 60)',
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
                      className="w-full text-xs gap-1.5 border"
                      style={{
                        background: 'oklch(0.35 0.07 55 / 16%)',
                        borderColor: 'oklch(0.40 0.07 55 / 28%)',
                        color: 'oklch(0.28 0.07 40)',
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
                <BountyControl storyId={storyId} nodeId={nodeId} slot={slot} onChange={onModerated} />
              </div>
            ) : (
              /* Logged-out: sign-in prompt */
              <div className="space-y-1.5">
              <button
                onClick={openAuthModal}
                className="w-full text-left px-4 py-3 rounded-lg border transition-all hover:brightness-95 active:scale-[0.98] group"
                style={{
                  background: 'color-mix(in oklch, var(--page-text) 5%, transparent)',
                  borderColor: 'color-mix(in oklch, var(--page-text) 15%, transparent)',
                  borderStyle: 'dashed',
                }}
              >
                <div className="flex items-center gap-2.5 opacity-40 group-hover:opacity-60 transition-opacity">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12px] font-sans italic">
                    Sign in to write path {i + 1}…
                  </span>
                </div>
              </button>
              <BountyControl storyId={storyId} nodeId={nodeId} slot={slot} readOnly />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
