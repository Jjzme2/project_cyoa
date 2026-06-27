'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { ChoiceSlot, ResourceDefinition } from '@/types'

export type SlotRuleMap = Record<string, Record<string, { enabled: boolean; op: string; val: string }>>

/**
 * Per-slot editor for path requirements (gates) and effects (rewards) over a
 * story's resources. Controlled via the shared slotReqs/slotEffs maps keyed by
 * slot id + resource name. Renders nothing when the story has no resources.
 */
export function SlotRequirementsEditor({
  slot,
  storyResources,
  slotReqs,
  setSlotReqs,
  slotEffs,
  setSlotEffs,
}: {
  slot: ChoiceSlot
  storyResources?: ResourceDefinition[]
  slotReqs: SlotRuleMap
  setSlotReqs: Dispatch<SetStateAction<SlotRuleMap>>
  slotEffs: SlotRuleMap
  setSlotEffs: Dispatch<SetStateAction<SlotRuleMap>>
}) {
  if (!storyResources || storyResources.length === 0) return null
  return (
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
  )
}
