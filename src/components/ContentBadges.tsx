import { Sparkles } from 'lucide-react'
import { CONTENT_RATING_META } from '@/types'
import type { ContentRating } from '@/types'

/** Content-rating chip. `abbr` renders the compact E/T/M form for tight spots. */
export function RatingBadge({ rating, abbr = false }: { rating?: ContentRating; abbr?: boolean }) {
  if (!rating) return null
  const meta = CONTENT_RATING_META[rating]
  return (
    <span
      className={`inline-flex items-center font-sans font-semibold rounded-full border ${meta.className} ${
        abbr ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
      }`}
      title={`${rating} — ${meta.description}`}
    >
      {abbr ? meta.abbr : rating}
    </span>
  )
}

/** Marks content authored by the Chronicle team rather than the community. */
export function SeededBadge({ abbr = false }: { abbr?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-sans font-medium rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-300/80 ${
        abbr ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
      title="Authored by the Chronicle team as starter content — not community-built"
    >
      <Sparkles className="h-2.5 w-2.5" />
      Seeded
    </span>
  )
}
