'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export type EconomyEffectRow = {
  commodityId: string
  condition: 'scarce' | 'cheap'
  resourceName: string
  operator: '=' | '+=' | '-='
  value: string
}

const COMMODITIES = [
  { id: 'food', name: 'Food' },
  { id: 'iron', name: 'Iron' },
  { id: 'lumber', name: 'Lumber' },
  { id: 'cloth', name: 'Cloth' },
  { id: 'weapons', name: 'Weapons' },
  { id: 'magic_dust', name: 'Magic Dust' },
] as const

/**
 * Opt-in engine features for a story: GOAP autonomous characters, procedural
 * quests, and market→resource rules (active only when GOAP is enabled).
 */
export function AdvancedEngineFeatures({
  goapEnabled,
  setGoapEnabled,
  implementQuests,
  setImplementQuests,
  economyEffects,
  setEconomyEffects,
}: {
  goapEnabled: boolean
  setGoapEnabled: Dispatch<SetStateAction<boolean>>
  implementQuests: boolean
  setImplementQuests: Dispatch<SetStateAction<boolean>>
  economyEffects: EconomyEffectRow[]
  setEconomyEffects: Dispatch<SetStateAction<EconomyEffectRow[]>>
}) {
  return (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400/55" />
            Advanced Engine Features
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="goapEnabled"
                checked={goapEnabled}
                onChange={(e) => setGoapEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded bg-background border-input text-amber-500 focus:ring-amber-500 disabled:opacity-60"
              />
              <div className="space-y-1">
                <Label htmlFor="goapEnabled" className="text-sm cursor-pointer">
                  Enable GOAP AI Characters
                </Label>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  Allows characters to autonomously form goals and execute plans behind the scenes based on the story&apos;s world state. 
                  This creates a dynamic, living world where characters act independently of the reader.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="implementQuests"
                checked={implementQuests}
                onChange={(e) => setImplementQuests(e.target.checked)}
                className="mt-1 h-4 w-4 rounded bg-background border-input text-amber-500 focus:ring-amber-500"
              />
              <div className="space-y-1">
                <Label htmlFor="implementQuests" className="text-sm cursor-pointer">Enable Procedural Quests</Label>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  Dynamically generates side-quests and minor encounters as the reader explores. This uses the world seed to ensure consistent generation.
                </p>
              </div>
            </div>

            {/* Economy ↔ Resource rules — only meaningful when GOAP runs the simulation */}
            {goapEnabled && (
              <div className="border-t border-white/[0.06] pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/80 font-sans">
                      Market Effects
                    </h3>
                    <p className="text-[11px] text-muted-foreground/45 mt-0.5">
                      When a commodity becomes scarce or cheap, modify reader resources automatically.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEconomyEffects((prev) => [
                      ...prev,
                      { commodityId: 'food', condition: 'scarce', resourceName: '', operator: '-=', value: '5' },
                    ])}
                    className="text-xs gap-1 border-white/10 hover:bg-white/5 shrink-0"
                  >
                    <Plus className="h-3 w-3" /> Add Rule
                  </Button>
                </div>

                {economyEffects.length > 0 && (
                  <div className="space-y-2">
                    {economyEffects.map((rule, idx) => {
                      function updateRule(patch: Partial<EconomyEffectRow>) {
                        setEconomyEffects((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], ...patch }
                          return next
                        })
                      }
                      return (
                        <div key={idx} className="flex flex-wrap gap-2 items-center bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-lg text-[11px]">
                          <span className="text-muted-foreground/50 font-sans shrink-0">When</span>
                          <select
                            value={rule.commodityId}
                            title="Commodity"
                            onChange={(e) => updateRule({ commodityId: e.target.value })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] focus:outline-none"
                          >
                            {COMMODITIES.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <span className="text-muted-foreground/50 font-sans shrink-0">is</span>
                          <select
                            value={rule.condition}
                            title="Market condition"
                            onChange={(e) => updateRule({ condition: e.target.value as EconomyEffectRow['condition'] })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] focus:outline-none"
                          >
                            <option value="scarce">scarce (&gt;1.5×)</option>
                            <option value="cheap">cheap (&lt;0.5×)</option>
                          </select>
                          <span className="text-muted-foreground/50 font-sans shrink-0">→</span>
                          <input
                            type="text"
                            value={rule.resourceName}
                            placeholder="Resource name"
                            onChange={(e) => updateRule({ resourceName: e.target.value })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] w-28 focus:outline-none"
                          />
                          <select
                            value={rule.operator}
                            title="Operator"
                            onChange={(e) => updateRule({ operator: e.target.value as EconomyEffectRow['operator'] })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] focus:outline-none"
                          >
                            <option value="+=">{'+='}</option>
                            <option value="-=">{'−='}</option>
                            <option value="=">{'='}</option>
                          </select>
                          <input
                            type="number"
                            value={rule.value}
                            title="Effect value"
                            placeholder="0"
                            onChange={(e) => updateRule({ value: e.target.value })}
                            className="h-7 px-1.5 rounded border border-input bg-background text-foreground text-[11px] w-16 focus:outline-none"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEconomyEffects((prev) => prev.filter((_, i) => i !== idx))}
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
  )
}
