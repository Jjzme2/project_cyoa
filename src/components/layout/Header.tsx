'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from 'firebase/auth'
import { toast } from 'sonner'
import { BookOpen, Plus, LogOut, Sparkles, Menu, Wand2, KeyRound, Globe, LayoutDashboard, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/components/Providers'
import { ApiKeyModal } from '@/components/auth/ApiKeyModal'
import { NotificationBell } from '@/components/notifications/NotificationBell'

async function getFirebaseAuth() {
  const { auth } = await import('@/lib/firebase-client')
  return auth
}

export function Header() {
  const { user, loading, tier, isAdmin, openAuthModal, aiUsesRemaining } = useAuth()
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)

  async function handleSignOut() {
    const auth = await getFirebaseAuth()
    await signOut(auth)
    toast('Signed out. Your stories remain.')
  }

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) ?? 'U'

  const navLinks = (
    <>
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Library
      </Link>
      <Link href="/worlds" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <Globe className="h-3.5 w-3.5 opacity-60" />
        Worlds
      </Link>
      <Link href="/saga" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5 opacity-60" />
        Sagas
      </Link>
      {user && (
        <>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <LayoutDashboard className="h-3.5 w-3.5 opacity-60" />
            Dashboard
          </Link>
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Profile
          </Link>
        </>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          className="text-sm text-amber-400/70 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Admin
        </Link>
      )}
    </>
  )

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/30 to-amber-600/30 border border-amber-500/30 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-amber-400" />
            </div>
            <span className="font-semibold text-lg tracking-tight gold-text">Chronicle</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6">{navLinks}</nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!loading && (
              <>
                {user ? (
                  <>
                    <Link href="/stories/new">
                      <Button
                        size="sm"
                        className="hidden sm:flex gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New Story
                      </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                      {aiUsesRemaining !== null && (
                        <Badge
                          className="hidden sm:flex gap-1 text-xs"
                          style={{
                            background: aiUsesRemaining === 0
                              ? 'oklch(0.35 0.12 25 / 20%)'
                              : 'oklch(0.35 0.07 55 / 16%)',
                            borderColor: aiUsesRemaining === 0
                              ? 'oklch(0.50 0.15 25 / 35%)'
                              : 'oklch(0.40 0.07 55 / 28%)',
                            color: aiUsesRemaining === 0
                              ? 'oklch(0.75 0.18 25)'
                              : 'oklch(0.65 0.10 55)',
                          }}
                          title="Daily AI story uses remaining"
                        >
                          <Wand2 className="h-3 w-3" />
                          {aiUsesRemaining} / {tier === 'PREMIUM' ? 100 : 20}
                        </Badge>
                      )}
                      {tier === 'PREMIUM' && (
                        <Badge className="hidden sm:flex bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1 text-xs">
                          <Sparkles className="h-3 w-3" />
                          Premium
                        </Badge>
                      )}
                      {/* Notification bell */}
                      <div className="hidden sm:flex">
                        <NotificationBell />
                      </div>
                      <button
                        onClick={() => setApiKeyModalOpen(true)}
                        className="hidden sm:flex items-center justify-center h-8 w-8 rounded-full text-amber-400/40 hover:text-amber-400/80 transition-colors"
                        title="Your Gemini API key"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href="/profile"
                        className="flex items-center gap-1.5 group"
                        title="Your profile & billing settings"
                      >
                        <Avatar className="h-8 w-8 ring-1 ring-amber-500/30 group-hover:ring-amber-500/60 transition-all">
                          <AvatarImage src={user.photoURL ?? undefined} />
                          <AvatarFallback className="bg-amber-500/20 text-amber-300 text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="hidden sm:flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                        title="Sign out"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={openAuthModal}
                    className="gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
                  >
                    Sign in
                  </Button>
                )}
              </>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger className="sm:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="right" className="glass border-white/10 w-64">
                <nav className="flex flex-col gap-4 mt-8">
                  {navLinks}
                  {user ? (
                    <>
                      <Link
                        href="/stories/new"
                        className="text-sm text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New Story
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="text-sm text-left text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={openAuthModal}
                      className="text-sm text-left text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      Sign in
                    </button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <ApiKeyModal open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen} />
    </>
  )
}
