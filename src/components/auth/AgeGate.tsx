'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, CalendarDays } from 'lucide-react'
import type { User } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MIN_SITE_AGE, ageFromDob } from '@/lib/ratings'

interface Props {
  open: boolean
  user: User | null
  onComplete: () => void | Promise<void>
}

/**
 * One-time age gate shown to any signed-in user without a date of birth on
 * file. Chronicle is not directed to children under 13; mature content is
 * additionally gated to 18+. Age is self-reported (DOB + explicit confirmation).
 */
export function AgeGate({ open, user, onComplete }: Props) {
  const [dob, setDob] = useState('')
  const [attested, setAttested] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Computed in the change handler (not during render) so this component, which
  // lives in the root layout, never reads the current time during prerender.
  const [tooYoung, setTooYoung] = useState(false)

  function handleDobChange(value: string) {
    setDob(value)
    const age = ageFromDob(value)
    setTooYoung(age !== null && age < MIN_SITE_AGE)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !dob || !attested || tooYoung) return
    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_dob', dateOfBirth: dob, attestation: true }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save your date of birth.')
      toast.success('Thanks — your age has been confirmed.')
      await onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Non-dismissable: stays open until a valid DOB is provided.
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="glass-strong border-white/15 sm:max-w-[420px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-center gap-3 space-y-0 pb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/30 to-amber-600/30 border border-amber-500/30 flex items-center justify-center shrink-0">
            <CalendarDays className="h-4 w-4 text-amber-400" />
          </div>
          <DialogTitle className="gold-text text-xl">Confirm your age</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground/65 leading-relaxed">
          Chronicle is a community storytelling platform and is{' '}
          <span className="text-foreground/80">not directed to children under {MIN_SITE_AGE}</span>.
          Enter your date of birth so we only show you age-appropriate stories. Mature stories
          require you to be 18 or older.
        </p>

        <form onSubmit={submit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="dob" className="text-xs">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => handleDobChange(e.target.value)}
              required
            />
            {tooYoung && (
              <p className="text-[11px] text-red-400">
                You must be at least {MIN_SITE_AGE} years old to use Chronicle.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              className="mt-0.5 rounded bg-background border-input h-3.5 w-3.5"
            />
            <span className="text-[12px] text-muted-foreground/60 leading-snug">
              I confirm that the date of birth above is accurate and that I meet the minimum age
              requirement.
            </span>
          </label>

          <Button
            type="submit"
            disabled={submitting || !dob || !attested || tooYoung}
            className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Confirm & continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
