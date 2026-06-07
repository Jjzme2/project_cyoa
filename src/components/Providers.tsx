'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { Toaster } from '@/components/ui/sonner'
import { AuthModal } from '@/components/auth/AuthModal'

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
  openAuthModal: () => void
  aiUsesRemaining: number | null
  updateAiUses: (remaining: number) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  tier: 'FREE',
  openAuthModal: () => {},
  aiUsesRemaining: null,
  updateAiUses: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<'FREE' | 'PREMIUM'>('FREE')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [aiUsesRemaining, setAiUsesRemaining] = useState<number | null>(null)

  const openAuthModal = useCallback(() => setAuthModalOpen(true), [])
  const updateAiUses = useCallback((remaining: number) => setAiUsesRemaining(remaining), [])

  useEffect(() => {
    let unsubscribe = () => {}
    getAuth().then((auth) => {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser)
        if (firebaseUser) {
          const idTokenResult = await firebaseUser.getIdTokenResult()
          setTier((idTokenResult.claims.tier as 'FREE' | 'PREMIUM') ?? 'FREE')

          // Fetch current daily AI uses without consuming a token
          firebaseUser.getIdToken().then(async (token) => {
            try {
              const res = await fetch('/api/usage', {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (res.ok) {
                const data = await res.json()
                setAiUsesRemaining(data.remaining)
              }
            } catch {
              // non-critical
            }
          })
        } else {
          setTier('FREE')
          setAiUsesRemaining(null)
        }
        setLoading(false)
      })
    })
    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, tier, openAuthModal, aiUsesRemaining, updateAiUses }}>
      {children}
      <Toaster theme="dark" position="bottom-right" richColors />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </AuthContext.Provider>
  )
}
