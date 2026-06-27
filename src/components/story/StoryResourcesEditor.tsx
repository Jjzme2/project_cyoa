'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface StoryResourceDraft {
  name: string
  type: 'number' | 'string' | 'array' | 'boolean'
  defaultValue: string
  description?: string
  min?: number
  max?: number
  hidden?: boolean
  icon?: string
  displayAs?: 'value' | 'bar' | 'badge' | 'checkbox'
  color?: string
  isInitialChoice?: boolean
  choices?: string
}

/**
 * Editor for a story's authored resources (stats, inventory, flags, and
 * one-time reader choices). Controlled via `resources`/`setResources`; locked
 * once the story is published.
 */
export function StoryResourcesEditor({
  resources,
  setResources,
}: {
  resources: StoryResourceDraft[]
  setResources: Dispatch<SetStateAction<StoryResourceDraft[]>>
}) {
  return (
          <div className="space-y-4 border-t border-white/[0.06] pt-5 mt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500/80 font-sans">
                  Story Resources
                </h3>
                <p className="text-[11px] text-muted-foreground/45 mt-0.5">
                  Stats, inventory, flags, and reader choices. Locked once the story is published.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResources((prev) => [...prev, { name: '', type: 'number', defaultValue: '0' }])}
                className="text-xs gap-1 border-white/10 hover:bg-white/5"
              >
                <Plus className="h-3 w-3" /> Add Resource
              </Button>
            </div>

            {resources.length > 0 && (
              <div className="space-y-3 mt-3">
                {resources.map((res, index) => {
                  const nameId = `resource-name-${index}`
                  const typeId = `resource-type-${index}`
                  const valId  = `resource-val-${index}`
                  function updateRes(patch: Partial<typeof resources[0]>) {
                    setResources((prev) => {
                      const next = [...prev]
                      next[index] = { ...next[index], ...patch }
                      return next
                    })
                  }
                  return (
                    <div key={index} className="space-y-2.5 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">

                      {/* ── Row 1: name / type / default / delete ── */}
                      <div className="flex gap-2.5 items-end">
                        <div className="flex-1 space-y-1.5">
                          <Label htmlFor={nameId} className="text-[11px] opacity-40">Variable Name</Label>
                          <Input
                            id={nameId}
                            placeholder="e.g. Gold"
                            value={res.name}
                            onChange={(e) => updateRes({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                          />
                        </div>
                        <div className="w-40 space-y-1.5">
                          <Label htmlFor={typeId} className="text-[11px] opacity-40">Type</Label>
                          <select
                            id={typeId}
                            value={res.type}
                            onChange={(e) => {
                              const t = e.target.value as typeof res.type
                              updateRes({
                                type: t,
                                defaultValue: t === 'number' ? '0' : t === 'boolean' ? 'false' : '',
                                min: undefined,
                                max: undefined,
                                displayAs: undefined,
                                isInitialChoice: false,
                                choices: '',
                              })
                            }}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                          >
                            <option value="number">Number (stat)</option>
                            <option value="string">String (text)</option>
                            <option value="array">Array (inventory)</option>
                            <option value="boolean">Boolean (flag)</option>
                          </select>
                        </div>

                        {/* Starting value — hidden for boolean (uses a toggle instead) */}
                        {res.type !== 'boolean' && (
                          <div className="flex-1 space-y-1.5">
                            <Label htmlFor={valId} className="text-[11px] opacity-40">Starting Value</Label>
                            <Input
                              id={valId}
                              placeholder={res.type === 'number' ? '0' : res.type === 'array' ? 'e.g. key, sword' : 'None'}
                              value={res.defaultValue}
                              onChange={(e) => updateRes({ defaultValue: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Boolean starting state */}
                        {res.type === 'boolean' && (
                          <div className="space-y-1.5">
                            <Label className="text-[11px] opacity-40">Default</Label>
                            <select
                              value={res.defaultValue}
                              onChange={(e) => updateRes({ defaultValue: e.target.value })}
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                            >
                              <option value="false">False</option>
                              <option value="true">True</option>
                            </select>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setResources((prev) => prev.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 px-2.5"
                        >
                          Delete
                        </Button>
                      </div>

                      {/* ── Row 2: description / bounds ── */}
                      <div className="flex flex-wrap gap-3 items-center pt-2.5 border-t border-white/[0.03]">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <Label htmlFor={`resource-desc-${index}`} className="text-[9px] opacity-35">Description (tooltip for readers)</Label>
                          <Input
                            id={`resource-desc-${index}`}
                            placeholder="e.g. How much gold you're carrying"
                            value={res.description || ''}
                            onChange={(e) => updateRes({ description: e.target.value })}
                            className="h-8 text-xs placeholder:opacity-50"
                          />
                        </div>

                        {res.type === 'number' && (
                          <>
                            <div className="w-20 space-y-1">
                              <Label htmlFor={`resource-min-${index}`} className="text-[9px] opacity-35">Min</Label>
                              <Input
                                id={`resource-min-${index}`}
                                type="number"
                                placeholder="None"
                                value={res.min !== undefined ? res.min : ''}
                                onChange={(e) => updateRes({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <Label htmlFor={`resource-max-${index}`} className="text-[9px] opacity-35">Max</Label>
                              <Input
                                id={`resource-max-${index}`}
                                type="number"
                                placeholder="None"
                                value={res.max !== undefined ? res.max : ''}
                                onChange={(e) => updateRes({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── Row 3: display options ── */}
                      <div className="flex flex-wrap gap-3 items-center pt-2.5 border-t border-white/[0.03]">
                        <div className="space-y-1">
                          <Label className="text-[9px] opacity-35">Display As</Label>
                          <select
                            value={res.displayAs || ''}
                            onChange={(e) => updateRes({ displayAs: (e.target.value || undefined) as typeof res.displayAs })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
                          >
                            <option value="">Default</option>
                            {res.type === 'number' && (
                              <>
                                <option value="value">Value</option>
                                <option value="bar">Progress Bar</option>
                              </>
                            )}
                            {res.type === 'array' && (
                              <>
                                <option value="value">Comma list</option>
                                <option value="badge">Badges</option>
                              </>
                            )}
                            {res.type === 'boolean' && (
                              <option value="checkbox">Checkbox</option>
                            )}
                            {res.type === 'string' && (
                              <option value="value">Value</option>
                            )}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[9px] opacity-35">Icon (emoji)</Label>
                          <Input
                            placeholder="⚔️"
                            value={res.icon || ''}
                            onChange={(e) => updateRes({ icon: e.target.value })}
                            className="h-8 w-16 text-center text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[9px] opacity-35">Accent Color</Label>
                          <input
                            type="color"
                            value={res.color || '#fbbf24'}
                            onChange={(e) => updateRes({ color: e.target.value })}
                            className="h-8 w-10 rounded-md border border-input bg-background cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 pt-4">
                          <input
                            type="checkbox"
                            id={`resource-hidden-${index}`}
                            checked={res.hidden || false}
                            onChange={(e) => updateRes({ hidden: e.target.checked })}
                            className="rounded bg-background border-input h-3.5 w-3.5"
                          />
                          <Label htmlFor={`resource-hidden-${index}`} className="text-[10px] opacity-50 cursor-pointer">
                            Hidden (secret variable)
                          </Label>
                        </div>
                      </div>

                      {/* ── Row 4: Initial choice (string type only) ── */}
                      {res.type === 'string' && (
                        <div className="pt-2.5 border-t border-white/[0.03] space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`resource-initial-${index}`}
                              checked={res.isInitialChoice || false}
                              onChange={(e) => updateRes({ isInitialChoice: e.target.checked, choices: '' })}
                              className="rounded bg-background border-input h-3.5 w-3.5"
                            />
                            <Label htmlFor={`resource-initial-${index}`} className="text-[10px] text-amber-400/70 cursor-pointer font-medium">
                              Reader picks this once at the start (class selection, origin, etc.)
                            </Label>
                          </div>
                          {res.isInitialChoice && (
                            <div className="space-y-1 pl-5">
                              <Label className="text-[9px] opacity-35">Options (one per line)</Label>
                              <textarea
                                placeholder={"Warrior\nMage\nRogue"}
                                value={res.choices || ''}
                                onChange={(e) => updateRes({ choices: e.target.value })}
                                rows={3}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground/70 placeholder:opacity-30 focus:outline-none focus:border-amber-500/30 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
  )
}
