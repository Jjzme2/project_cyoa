'use client'

import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { MailWarning, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'

/**
 * Shown to signed-in users with an unverified email/password account, with a
 * resend action. Google accounts arrive verified, so they never see this.
 */
export function VerifyEmailBanner() {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!user || user.emailVerified) return null
  const isPasswordAccount = user.providerData.some((p) => p.providerId === 'password')
  if (!isPasswordAccount) return null

  async function resend() {
    if (!user) return
    setSending(true)
    try {
      await sendEmailVerification(user)
      setSent(true)
      toast.success('Verification email sent — check your inbox.')
    } catch {
      toast.error('Couldn’t send right now. Please try again shortly.')
    } finally {
      setSending(false)
    }
  }

  async function recheck() {
    if (!user) return
    await user.reload()
    if (user.emailVerified) {
      toast.success('Email verified — thank you!')
      window.location.reload()
    } else {
      toast.message('Not verified yet. Click the link in your email, then try again.')
    }
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
      <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap text-[12px] font-sans text-amber-200/90">
        <MailWarning className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span>Please verify your email to secure your account.</span>
        <div className="flex items-center gap-3 ml-auto">
          <button onClick={resend} disabled={sending || sent} className="underline hover:text-amber-100 disabled:opacity-50">
            {sending ? <Loader2 className="h-3 w-3 animate-spin inline" /> : sent ? 'Sent ✓' : 'Resend email'}
          </button>
          <button onClick={recheck} className="underline hover:text-amber-100">I’ve verified</button>
        </div>
      </div>
    </div>
  )
}
