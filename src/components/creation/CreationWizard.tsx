'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Check, Layers, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface WizardStep {
  id: string
  title: string
  hint?: string
  content: ReactNode
  /** When false, the Next button is disabled on this step. Defaults to true. */
  canProceed?: boolean
}

export type CreationMode = 'simple' | 'advanced'

interface Props {
  mode: CreationMode
  onModeChange: (mode: CreationMode) => void
  /** The guided, one-at-a-time steps shown in Simple mode. */
  steps: WizardStep[]
  /** The full single-page form shown in Advanced mode (includes its own submit). */
  advanced: ReactNode
  /** The submit control; rendered by the wizard on its final step. */
  submitButton: ReactNode
}

/**
 * Two ways to create the same thing: a guided step-by-step flow (Simple) and the
 * full single-page form (Advanced). Both write to the same parent state — the
 * wizard only arranges which fields are visible at a time.
 */
export function CreationWizard({ mode, onModeChange, steps, advanced, submitButton }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  // How far the author has advanced — lets them jump back to any visited step.
  const [furthest, setFurthest] = useState(0)

  const clampedIndex = Math.min(stepIndex, steps.length - 1)
  const step = steps[clampedIndex]
  const isLast = clampedIndex === steps.length - 1
  const canProceed = step?.canProceed ?? true

  function goTo(i: number) {
    const next = Math.max(0, Math.min(i, steps.length - 1))
    setStepIndex(next)
    setFurthest((f) => Math.max(f, next))
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onModeChange('simple')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              mode === 'simple' ? 'bg-amber-500/20 text-amber-300' : 'text-muted-foreground/55 hover:text-foreground/80'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Guided
          </button>
          <button
            type="button"
            onClick={() => onModeChange('advanced')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              mode === 'advanced' ? 'bg-amber-500/20 text-amber-300' : 'text-muted-foreground/55 hover:text-foreground/80'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Advanced
          </button>
        </div>
      </div>

      {mode === 'advanced' ? (
        advanced
      ) : (
        <div className="space-y-5">
          {/* Progress rail */}
          <ol className="flex items-center gap-1.5">
            {steps.map((s, i) => {
              const done = i < clampedIndex
              const active = i === clampedIndex
              const reachable = i <= furthest
              return (
                <li key={s.id} className="flex items-center gap-1.5 flex-1 last:flex-none">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(i)}
                    title={s.title}
                    className={`flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-semibold shrink-0 border transition-all ${
                      active
                        ? 'bg-amber-500/25 border-amber-500/50 text-amber-200'
                        : done
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300/70'
                          : 'border-white/10 text-muted-foreground/40'
                    } ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  {i < steps.length - 1 && (
                    <span
                      className={`h-px flex-1 ${i < clampedIndex ? 'bg-amber-500/30' : 'bg-white/10'}`}
                    />
                  )}
                </li>
              )
            })}
          </ol>

          {/* Step heading */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-amber-400/50 font-sans">
              Step {clampedIndex + 1} of {steps.length}
            </p>
            <h2 className="text-lg font-semibold text-foreground/85">{step?.title}</h2>
            {step?.hint && <p className="text-xs text-muted-foreground/55 leading-relaxed">{step.hint}</p>}
          </div>

          {/* Active step content */}
          <div>{step?.content}</div>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={clampedIndex === 0}
              onClick={() => goTo(clampedIndex - 1)}
              className="gap-1 text-muted-foreground/60 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {isLast ? (
              submitButton
            ) : (
              <Button
                type="button"
                disabled={!canProceed}
                onClick={() => goTo(clampedIndex + 1)}
                className="gap-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
