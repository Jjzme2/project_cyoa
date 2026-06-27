import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-20">
      <div className="glass-card rounded-xl p-10 text-center space-y-5 border border-white/[0.07]">
        <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/20 flex items-center justify-center mx-auto">
          <Compass className="h-6 w-6 text-amber-400/55" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold gold-text">Lost in the archives</h1>
          <p className="text-sm text-muted-foreground/55">
            This page doesn&apos;t exist — or the path that led here has since branched away.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition-colors"
        >
          Return to the library
        </Link>
      </div>
    </main>
  )
}
