'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  CreditCard,
  Coins,
  Sparkles,
  BookOpen,
  Globe,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  Wand2,
  Check,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/Providers'
import { APP_CONFIG } from '@/lib/config'
import { AchievementDisplay } from '@/components/achievements/AchievementDisplay'

interface ProfileApiData {
  profile?: {
    tier: string
    purchasedCredits?: number
    lifetimeCreditsPurchased?: number
    stripeSubscriptionId?: string | null
    subscriptionStatus?: string | null
    subscriptionPeriodEnd?: string | null
  }
  credits?: {
    dailyRemaining: number
    dailyLimit: number
    purchasedCredits: number
    totalRemaining: number
  }
  isStripeMocked?: boolean
  stories?: { id: string; title: string; nodeCount: number; views: number }[]
  worlds?: { id: string; name: string; description?: string }[]
  pathStats?: { pathsWritten: number; totalReads: number; totalLoves: number }
}

// Wrap SearchParam usages in a fallback-enclosed Suspense component to satisfy Next.js SSR build rules
function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, openAuthModal } = useAuth()

  // State
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileApiData | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  
  // Gemini API Key State
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [deletingKey, setDeletingKey] = useState(false)

  // Load profile details from API
  const fetchProfile = useCallback(async () => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()
      setProfileData(data)

      // Fetch Gemini key status
      const keyRes = await fetch('/api/settings/keys', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (keyRes.ok) {
        const keyData = await keyRes.json()
        setHasKey(!!keyData.hasKey)
      }
    } catch {
      toast.error('Could not load profile settings.')
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  // Initial profile load — uses .then() chain so setState calls land in async callbacks
  useEffect(() => {
    if (!user) return
    user.getIdToken()
      .then((token) =>
        Promise.all([
          fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null),
          fetch('/api/settings/keys', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null),
        ])
      )
      .then(([profileD, keyD]) => {
        if (profileD) setProfileData(profileD)
        if (keyD) setHasKey(!!keyD.hasKey)
      })
      .catch(() => toast.error('Could not load profile settings.'))
      .finally(() => setProfileLoading(false))
  }, [user])

  // Handle URL callback parameters from Stripe Checkout redirects
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      openAuthModal()
      return
    }

    // Parse status flags from Stripe Checkout callbacks
    const checkoutStatus = searchParams.get('checkout_status')
    const mockCheckout = searchParams.get('mock_checkout')
    
    if (checkoutStatus === 'success') {
      toast.success('Your payment succeeded! Welcome to the new tier.')
      router.replace('/profile')
      user.getIdToken()
        .then((token) =>
          Promise.all([
            fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null),
            fetch('/api/settings/keys', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null),
          ])
        )
        .then(([profileD, keyD]) => {
          if (profileD) setProfileData(profileD)
          if (keyD) setHasKey(!!keyD.hasKey)
        })
        .finally(() => setProfileLoading(false))
    } else if (checkoutStatus === 'canceled') {
      toast.warning('Checkout was canceled.')
      router.replace('/profile')
    }

    // Process local sandbox checkout triggers
    if (mockCheckout === 'success') {
      const type = searchParams.get('type')
      const credits = Number(searchParams.get('credits') || 0)
      
      const processMock = async () => {
        try {
          const token = await user.getIdToken()
          const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              action: 'mock_checkout',
              type,
              creditsAmount: credits,
            }),
          })
          if (res.ok) {
            toast.success(`[Sandbox] Mock payment processed successfully! (${type === 'subscription' ? 'Premium active' : `+${credits} credits`})`)
            fetchProfile()
          }
        } catch {
          toast.error('[Sandbox] Failed to update mock profile.')
        } finally {
          router.replace('/profile')
        }
      }
      processMock()
    }
  }, [user, authLoading, searchParams, router, fetchProfile, openAuthModal]) // fetchProfile used in conditional checkout branches

  // Handle Checkout redirects
  const handlePurchase = async (type: 'subscription' | 'credits', packageId?: string) => {
    if (!user) return
    setCheckoutLoading(packageId || type)

    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, packageId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initialize checkout')

      if (data.isMock) {
        toast.info('[Sandbox] Simulating Stripe Checkout redirect...')
      }
      
      // Redirect to Stripe URL (or simulated local mock URL)
      router.push(data.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not launch checkout.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Handle Billing Portal Redirect
  const handleManageBilling = async () => {
    if (!user) return
    setCheckoutLoading('portal')
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'portal' }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.url.includes('mock_portal')) {
        toast.success('[Sandbox] Instantly canceled premium status!')
        // Instantly switch claims back to Free
        const mockRes = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'mock_checkout',
            type: 'subscription_cancel',
          }),
        })
        if (mockRes.ok) {
          fetchProfile()
        }
      } else {
        router.push(data.url)
      }
    } catch {
      toast.error('Could not load portal settings.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Handle API Key management
  const handleSaveApiKey = async () => {
    if (!user || !apiKey.trim()) return
    setSavingKey(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      if (!res.ok) throw new Error('Failed to encrypt key')
      toast.success('Gemini key encrypted and saved.')
      setHasKey(true)
      setApiKey('')
    } catch {
      toast.error('Could not save API Key.')
    } finally {
      setSavingKey(false)
    }
  }

  const handleDeleteApiKey = async () => {
    if (!user) return
    setDeletingKey(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/settings/keys', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      toast.success('Gemini key removed.')
      setHasKey(false)
    } catch {
      toast.error('Could not delete API Key.')
    } finally {
      setDeletingKey(false)
    }
  }

  if (authLoading || (profileLoading && !profileData)) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-24 space-y-8 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500 border-opacity-50" />
        <span className="text-muted-foreground/60 text-sm font-sans">Verifying ledger status...</span>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Unauthenticated</h1>
          <p className="text-muted-foreground/60 text-sm max-w-sm mx-auto">
            You must be logged in to view your profile settings, subscriptions, and authored universes.
          </p>
        </div>
        <Button
          onClick={openAuthModal}
          className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
        >
          Sign in
        </Button>
      </main>
    )
  }

  const { profile, credits, isStripeMocked, stories = [], worlds = [], pathStats } = profileData || {}
  const initials = user.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'U'

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Header Profile Info card */}
      <section className="glass border-white/10 p-6 rounded-xl flex flex-col sm:flex-row items-center gap-6 justify-between">
        <div className="flex items-center gap-4 flex-col sm:flex-row text-center sm:text-left">
          <div className="w-20 h-20 rounded-full ring-2 ring-amber-500/30 overflow-hidden bg-amber-500/10 flex items-center justify-center text-xl text-amber-300 font-sans font-bold">
            {user.photoURL ? (
              <Image src={user.photoURL} alt="Avatar" fill className="object-cover" sizes="80px" />
            ) : (
              initials
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight">{user.displayName || 'Chronicle Member'}</h1>
              {profile?.tier === 'PREMIUM' ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-sans tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10">
                  <Sparkles className="h-3 w-3" /> Premium
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-sans tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                  Free Account
                </span>
              )}

              {isStripeMocked && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Sandbox Active
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground/60">{user.email}</p>
          </div>
        </div>

        {profile?.tier === 'PREMIUM' && (
          <Button
            variant="outline"
            onClick={handleManageBilling}
            disabled={checkoutLoading !== null}
            className="text-xs border-white/10 hover:bg-white/5 gap-1.5 shrink-0"
          >
            {checkoutLoading === 'portal' ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-amber-500" />
            ) : (
              <CreditCard className="h-3.5 w-3.5 text-amber-400/70" />
            )}
            Manage Subscription
          </Button>
        )}
      </section>

      {/* Credits Meters Dashboard */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Daily limit tracker */}
        <div className="glass border-white/10 p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-amber-200/90 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-amber-400" />
              Daily AI Generation Limit
            </h3>
            <span className="text-xs font-mono font-medium text-amber-400/80">
              {credits?.dailyRemaining} / {credits?.dailyLimit} left
            </span>
          </div>

          <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
            Your daily free usage allowance resets at 00:00 UTC. Premium members receive 100 uses per day.
          </p>

          <div className="w-full bg-white/5 border border-white/[0.04] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500/80 to-amber-400 h-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  ((credits?.dailyRemaining ?? 0) / (credits?.dailyLimit ?? 20)) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Purchased credits ledger */}
        <div className="glass border-white/10 p-6 rounded-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-amber-200/90 flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" />
                Permanent Purchased Credits
              </h3>
              <span className="text-lg font-mono font-bold text-amber-400">
                {profile?.purchasedCredits ?? 0}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
              Permanent credits never expire and are automatically consumed only after your daily rate limit is fully depleted.
            </p>
          </div>

          <div className="text-[10px] text-muted-foreground/45 border-t border-white/[0.04] pt-2 flex justify-between">
            <span>Lifetime Purchased:</span>
            <span className="font-mono">{profile?.lifetimeCreditsPurchased ?? 0} credits</span>
          </div>
        </div>
      </section>

      {/* Subscription & Credit Shop */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-amber-400/80" />
          <h2 className="text-lg font-semibold text-amber-200/90">Chronicle Store & Billing</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Subscription Package Card */}
          <div className="glass-strong border-amber-500/20 p-6 rounded-xl flex flex-col justify-between space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-300 text-[9px] uppercase tracking-wider font-semibold px-3 py-1 rounded-bl-lg border-l border-b border-amber-500/20">
              Recurring Sub
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="text-xs uppercase tracking-widest text-amber-400/60 font-semibold font-sans">
                  Premium Membership
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-mono font-bold">$9.99</span>
                  <span className="text-xs text-muted-foreground/60">/ month</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Supercharge your universe. Upgrade to unlock massive daily AI capacities. Applies to checkout codes.
              </p>

              <ul className="space-y-2.5 text-xs text-foreground/80">
                {[
                  '100 daily AI uses (5x increase)',
                  'Sleek premium profile badge',
                  'Priority generation speed',
                  'Supports applying Stripe coupon codes',
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={() => handlePurchase('subscription')}
              disabled={checkoutLoading !== null || profile?.tier === 'PREMIUM'}
              className="w-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/30 text-amber-300"
            >
              {checkoutLoading === 'subscription' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t border-amber-500" />
              ) : profile?.tier === 'PREMIUM' ? (
                'Currently Active'
              ) : (
                'Subscribe with Stripe'
              )}
            </Button>
          </div>

          {/* Credits Tiers Storefront */}
          {APP_CONFIG.stripe.creditPackages.map((pkg) => (
            <div key={pkg.id} className="glass border-white/10 p-6 rounded-xl flex flex-col justify-between space-y-6 group">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold font-sans">
                    {pkg.name}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-mono font-bold text-amber-100">${pkg.price}</span>
                    <span className="text-xs text-muted-foreground/40 font-mono">one-time</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold text-amber-400/90 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5" />
                    {pkg.credits} permanent credits
                  </div>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    {pkg.description} Ideal for writing large story branches or creating gorgeous art nodes.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => handlePurchase('credits', pkg.id)}
                disabled={checkoutLoading !== null}
                className="w-full border-white/10 hover:bg-white/5"
              >
                {checkoutLoading === pkg.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t border-amber-500" />
                ) : (
                  `Purchase Pack`
                )}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Developer Sandbox Testing triggers */}
      {isStripeMocked && (
        <section className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-3">
          <div className="flex items-start gap-2.5 text-emerald-400">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Stripe Sandbox / Mock Mode is Active</h4>
              <p className="text-[11px] text-emerald-400/70 leading-relaxed">
                Stripe secret keys are not configured. Click any pricing button above to instantly execute simulated mock checkout credits/membership modifications locally.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Writer reputation — reads & reactions across paths this user has authored */}
      {pathStats && (
        <section className="glass border-white/10 p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400/70" />
            <h2 className="text-sm font-semibold text-amber-200/90">Your storytelling</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Paths written', value: pathStats.pathsWritten ?? 0 },
              { label: 'Total reads', value: pathStats.totalReads ?? 0 },
              { label: 'Reactions earned', value: pathStats.totalLoves ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold gold-text">
                  {Number(stat.value).toLocaleString()}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-sans mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievements */}
      <AchievementDisplay />

      {/* Settings Panel & Gemini Keys */}
      <section className="glass border-white/10 p-6 rounded-xl space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-400/80" />
          <h2 className="text-sm font-semibold text-amber-200/90">Personal Model Provisioning</h2>
        </div>

        <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-2xl">
          Optionally supply your own Gemini API Key to bypass platform daily limitations. When a key is saved, your adventure paths will use it directly. Keys are stored with high security encryption.
        </p>

        {hasKey ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg justify-between">
            <div className="flex items-center gap-2 text-[12px] text-amber-300">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>A custom Gemini API key is currently saved.</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteApiKey}
              disabled={deletingKey}
              className="text-xs gap-1.5 h-8 shrink-0"
            >
              {deletingKey ? (
                <div className="animate-spin rounded-full h-3 w-3 border-t border-white" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-lg">
            <Label htmlFor="gemini-key-input" className="text-[11px] opacity-40">Gemini API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="gemini-key-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 h-10 border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-75 transition-opacity"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={handleSaveApiKey}
                disabled={savingKey || !apiKey.trim()}
                className="h-10 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 px-4"
              >
                {savingKey ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t border-amber-500" />
                ) : (
                  'Encrypt & Save'
                )}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Authored Creations dashboard list */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authored Stories */}
        <div className="glass border-white/10 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <h3 className="text-sm font-semibold text-amber-200/90 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-400" />
              Stories Created
            </h3>
            <span className="text-xs font-mono opacity-50 bg-white/5 px-2 py-0.5 rounded-full">
              {stories.length}
            </span>
          </div>

          {stories.length > 0 ? (
            <div className="divide-y divide-white/[0.03] max-h-64 overflow-y-auto space-y-2">
              {stories.map((story) => (
                <div key={story.id} className="pt-2 flex justify-between items-center group">
                  <div className="space-y-0.5 min-w-0 pr-4">
                    <Link
                      href={`/stories/${story.id}`}
                      className="text-xs font-semibold text-foreground/80 hover:text-amber-300 transition-colors truncate block"
                    >
                      {story.title}
                    </Link>
                    <p className="text-[10px] text-muted-foreground/45 flex items-center gap-2">
                      <span>{story.nodeCount} nodes</span>
                      <span>•</span>
                      <span>{story.views} reads</span>
                    </p>
                  </div>
                  <Link href={`/stories/${story.id}`}>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-amber-300 transition-colors" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground/30">
              No stories created yet. Start a new book inside the library.
            </div>
          )}
        </div>

        {/* Authored Worlds */}
        <div className="glass border-white/10 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <h3 className="text-sm font-semibold text-amber-200/90 flex items-center gap-2">
              <Globe className="h-4 w-4 text-amber-400" />
              Worlds Configured
            </h3>
            <span className="text-xs font-mono opacity-50 bg-white/5 px-2 py-0.5 rounded-full">
              {worlds.length}
            </span>
          </div>

          {worlds.length > 0 ? (
            <div className="divide-y divide-white/[0.03] max-h-64 overflow-y-auto space-y-2">
              {worlds.map((world) => (
                <div key={world.id} className="pt-2 flex justify-between items-center group">
                  <div className="space-y-0.5 min-w-0 pr-4">
                    <div className="text-xs font-semibold text-foreground/80 truncate block">
                      {world.name}
                    </div>
                    <p className="text-[10px] text-muted-foreground/45 truncate">
                      {world.description || 'No lore description set.'}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground/30">
              No custom worlds configured yet. Start a world-building template.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-4xl mx-auto px-4 py-24 space-y-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500 border-opacity-50" />
          <span className="text-muted-foreground/60 text-sm font-sans">Verifying ledger status...</span>
        </main>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}
