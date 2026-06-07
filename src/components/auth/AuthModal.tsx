'use client'

import { useState } from 'react'
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { toast } from 'sonner'
import { LogIn, Eye, EyeOff, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

async function getFirebase() {
  const { auth, googleProvider } = await import('@/lib/firebase-client')
  return { auth, googleProvider }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export function AuthModal({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function reset() {
    setEmail('')
    setPassword('')
    setDisplayName('')
    setShowPassword(false)
    setLoading(false)
  }

  function handleClose(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      const { auth, googleProvider } = await getFirebase()
      await signInWithPopup(auth, googleProvider)
      toast.success('Welcome to Chronicle!')
      onOpenChange(false)
      reset()
    } catch {
      toast.error('Google sign in failed. Please try again.')
      setLoading(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { auth } = await getFirebase()
      await signInWithEmailAndPassword(auth, email, password)
      toast.success('Welcome back to Chronicle!')
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const msg =
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'Invalid email or password.'
          : code === 'auth/user-not-found'
          ? 'No account found with this email.'
          : 'Sign in failed. Please try again.'
      toast.error(msg)
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { auth } = await getFirebase()
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: displayName.trim() })
      toast.success('Your chronicle begins! Welcome.')
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const msg =
        code === 'auth/email-already-in-use'
          ? 'An account with this email already exists.'
          : code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : 'Registration failed. Please try again.'
      toast.error(msg)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-strong border-white/15 sm:max-w-[420px]">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 pb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/30 to-amber-600/30 border border-amber-500/30 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4 text-amber-400" />
          </div>
          <DialogTitle className="gold-text text-xl">Join Chronicle</DialogTitle>
        </DialogHeader>

        <Button
          variant="outline"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full gap-3 border-white/15 bg-white/5 hover:bg-white/10 text-foreground/80"
        >
          <GoogleLogo />
          Continue with Google
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-popover px-3 text-[11px] uppercase tracking-widest text-muted-foreground/35">
              or
            </span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'register')}>
          <TabsList className="w-full bg-white/5 border border-white/10 h-9">
            <TabsTrigger value="signin" className="flex-1 text-xs">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="register" className="flex-1 text-xs">
              Create account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="si-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="si-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-password" className="text-xs">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="si-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 mt-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs">
                  Display name
                </Label>
                <Input
                  id="reg-name"
                  placeholder="Your name in the chronicles"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !displayName.trim()}
                className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 mt-1"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Begin my chronicle
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
