'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { Toaster } from '@/components/ui/sonner'
import { AuthModal } from '@/components/auth/AuthModal'
import { AgeGate } from '@/components/auth/AgeGate'

let authInstance: import('firebase/auth').Auth | null = null

async function getAuth() {
  if (!authInstance) {
    const { auth } = await import('@/lib/firebase-client')
    authInstance = auth
  }
  return authInstance
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  tier: 'FREE' | 'PREMIUM'
  isAdmin: boolean
  /** Highest content rank the viewer may see (0 Everyone … 2 Mature). */
  allowedRank: number
  openAuthModal: () => void
  aiUsesRemaining: number | null
  updateAiUses: (remaining: number) => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  tier: 'FREE',
  isAdmin: false,
  allowedRank: 0,
  openAuthModal: () => {},
  aiUsesRemaining: null,
  updateAiUses: () => {},
  refreshMe: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<'FREE' | 'PREMIUM'>('FREE')
  const [isAdmin, setIsAdmin] = useState(false)
  const [allowedRank, setAllowedRank] = useState(0)
  const [needsAgeGate, setNeedsAgeGate] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [aiUsesRemaining, setAiUsesRemaining] = useState<number | null>(null)

  const openAuthModal = useCallback(() => setAuthModalOpen(true), [])
  const updateAiUses = useCallback((remaining: number) => setAiUsesRemaining(remaining), [])

  // Re-fetch the resolved role / age gating. `force` refreshes the ID token so
  // a freshly-set custom claim (role, dob) propagates immediately.
  const refreshMe = useCallback(async (force = false) => {
    const auth = await getAuth()
    const u = auth.currentUser
    if (!u) return
    try {
      const token = await u.getIdToken(force)
      const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      if (meRes.ok) {
        const me = await meRes.json()
        setIsAdmin(!!me.isAdmin)
        setAllowedRank(typeof me.allowedRank === 'number' ? me.allowedRank : 0)
        setNeedsAgeGate(!me.hasDob)
      }
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    let unsubscribe = () => {}
    getAuth().then((auth) => {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser)
        if (firebaseUser) {
          const idTokenResult = await firebaseUser.getIdTokenResult()
          setTier((idTokenResult.claims.tier as 'FREE' | 'PREMIUM') ?? 'FREE')

          firebaseUser.getIdToken().then(async (token) => {
            try {
              const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
              if (res.ok) {
                const data = await res.json()
                setAiUsesRemaining(data.remaining)
              }
            } catch {
              // non-critical
            }
          })
          await refreshMe()
        } else {
          setTier('FREE')
          setIsAdmin(false)
          setAllowedRank(0)
          setNeedsAgeGate(false)
          setAiUsesRemaining(null)
        }
        setLoading(false)
      })
    })
    return () => unsubscribe()
  }, [refreshMe])

  return (
    <AuthContext.Provider
      value={{ user, loading, tier, isAdmin, allowedRank, openAuthModal, aiUsesRemaining, updateAiUses, refreshMe }}
    >
      {children}
      <Toaster theme="dark" position="bottom-right" richColors />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <AgeGate
        open={needsAgeGate && !!user}
        user={user}
        onComplete={async () => {
          await refreshMe(true)
        }}
      />
    </AuthContext.Provider>
  )
}
