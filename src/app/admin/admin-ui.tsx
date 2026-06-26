'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/components/Providers'

/**
 * Client-side admin gate shared by the /admin pages. Redirects non-admins home.
 * `ready` is true only once we've confirmed an authenticated admin — render the
 * page body behind it. (Every admin API also enforces the role server-side.)
 */
export function useAdminGuard() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/')
  }, [user, loading, isAdmin, router])

  return { user, ready: !loading && !!user && isAdmin }
}

export function AdminSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )
}

export function AdminHeading({ eyebrow, title, subtitle }: { eyebrow: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <Link href="/admin" className="inline-flex items-center gap-1 text-amber-400/60 text-xs uppercase tracking-widest font-sans hover:text-amber-300 transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        {eyebrow}
      </Link>
      <h1 className="text-3xl font-bold gold-text">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground/60">{subtitle}</p>}
    </div>
  )
}
