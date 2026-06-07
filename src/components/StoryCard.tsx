import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { Story } from '@/types'

// Deep, rich cover gradients — look good at portrait aspect ratio
const COVERS = [
  { cover: 'from-violet-950 via-purple-900 to-indigo-950', spine: 'from-violet-700 to-purple-800', accent: 'oklch(0.70 0.18 290)' },
  { cover: 'from-amber-950 via-yellow-900 to-orange-950', spine: 'from-amber-600 to-orange-700',  accent: 'oklch(0.78 0.14 80)'  },
  { cover: 'from-cyan-950 via-sky-900 to-blue-950',       spine: 'from-cyan-700 to-blue-800',    accent: 'oklch(0.72 0.14 220)' },
  { cover: 'from-rose-950 via-pink-900 to-red-950',       spine: 'from-rose-700 to-pink-800',    accent: 'oklch(0.68 0.20 10)'  },
  { cover: 'from-emerald-950 via-teal-900 to-green-950',  spine: 'from-emerald-700 to-teal-800', accent: 'oklch(0.70 0.15 165)' },
  { cover: 'from-indigo-950 via-violet-900 to-purple-950', spine: 'from-indigo-700 to-violet-800', accent: 'oklch(0.68 0.18 270)' },
]

interface Props {
  story: Story
}

export function StoryCard({ story }: Props) {
  const theme = COVERS[Math.abs(story.id.charCodeAt(0) % COVERS.length)]

  return (
    <Link href={`/stories/${story.id}`} className="group block">
      {/*
        Outer wrapper keeps the shelf-shadow anchored in place
        while the book itself lifts on hover.
      */}
      <div className="relative pb-3">
        {/* The book */}
        <div
          className={`
            relative flex rounded-sm overflow-hidden cursor-pointer
            transition-all duration-300 ease-out
            group-hover:-translate-y-5
            shadow-[0_6px_18px_-4px_rgba(0,0,0,0.65),0_2px_5px_-1px_rgba(0,0,0,0.45)]
            group-hover:shadow-[0_32px_56px_-10px_rgba(0,0,0,0.90),0_14px_28px_-6px_rgba(0,0,0,0.65)]
          `}
          style={{ aspectRatio: '2/3' }}
        >
          {/* Spine — vertical strip on left edge */}
          <div
            className={`w-3 shrink-0 bg-gradient-to-b ${theme.spine} relative`}
            style={{
              boxShadow:
                'inset -3px 0 6px rgba(0,0,0,0.40), inset 1px 0 2px rgba(255,255,255,0.10)',
            }}
          >
            {/* Spine title — rotated text */}
            <span
              className="absolute inset-0 flex items-center justify-center text-[7px] font-sans tracking-widest text-white/20 overflow-hidden"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {story.title}
            </span>
          </div>

          {/* Cover */}
          <div
            className={`flex-1 bg-gradient-to-br ${theme.cover} relative flex flex-col justify-between p-3 overflow-hidden`}
          >
            {/* Top — world badge */}
            <div>
              <span className="text-[8px] uppercase tracking-[0.22em] font-sans"
                style={{ color: `${theme.accent}80` }}>
                {story.worldName}
              </span>
            </div>

            {/* Center — decorative icon */}
            <div className="flex items-center justify-center flex-1 py-2">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: `${theme.accent}12`, border: `1px solid ${theme.accent}20` }}
              >
                <BookOpen className="h-5 w-5" style={{ color: `${theme.accent}45` }} />
              </div>
            </div>

            {/* Bottom — title + author */}
            <div className="space-y-1">
              <h3
                className="text-[12px] leading-snug text-white/90 line-clamp-3"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {story.title}
              </h3>
              <p className="text-[9px] font-sans text-white/30">by {story.authorName}</p>
            </div>

            {/* Subtle right page-edge */}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white/8" />

            {/* Hover brightening */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/6 transition-colors duration-300 pointer-events-none" />
          </div>
        </div>

        {/* Shelf shadow — stays put while book lifts away */}
        <div
          className="absolute bottom-0 inset-x-2 h-3 blur-lg transition-opacity duration-300
            opacity-60 group-hover:opacity-25 pointer-events-none"
          style={{ background: 'oklch(0.20 0.04 60)' }}
        />

        {/* Stats — slide in below on hover */}
        <div
          className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-2
            text-[9px] font-sans text-muted-foreground/0 group-hover:text-muted-foreground/40
            transition-colors duration-300 pt-1"
        >
          <span>{story.views.toLocaleString()} reads</span>
          <span className="opacity-40">·</span>
          <span>{story.nodeCount} {story.nodeCount === 1 ? 'chapter' : 'chapters'}</span>
        </div>
      </div>
    </Link>
  )
}
