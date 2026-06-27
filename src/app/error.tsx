'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Route-segment error boundary. Catches render/data errors below the root
 * layout and offers a retry without a full reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[route error]', error)
  }, [error])

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-20">
      <div className="glass-card rounded-xl p-10 text-center space-y-5 border border-white/[0.07]">
        <div className="w-14 h-14 rounded-2xl glass-card border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6 text-red-400/60" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold gold-text">Something went wrong</h1>
          <p className="text-sm text-muted-foreground/55">
            An unexpected error interrupted this page. You can try again, or head back to the library.
          </p>
          {error.digest && (
            <p className="text-[11px] text-muted-foreground/35 font-mono pt-1">ref: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm border border-white/10 text-muted-foreground/60 hover:text-foreground hover:border-white/20 transition-colors"
          >
            Return to the library
          </Link>
        </div>
      </div>
    </main>
  )
}
