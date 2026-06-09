import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { Story, CoverTheme } from '@/types'

// Fallback cover themes for stories that predate the cover designer
const LEGACY_COVERS = [
  { fromColor: '#1e0840', toColor: '#0a0322' },
  { fromColor: '#3d1200', toColor: '#180700' },
  { fromColor: '#001838', toColor: '#000c18' },
  { fromColor: '#3d0012', toColor: '#180007' },
  { fromColor: '#001a08', toColor: '#000703' },
  { fromColor: '#18182e', toColor: '#08080f' },
]

function legacyTheme(storyId: string): CoverTheme {
  const idx = Math.abs(storyId.charCodeAt(0)) % LEGACY_COVERS.length
  return {
    ...LEGACY_COVERS[idx],
    icon: '📖',
    pattern: 'none',
    fontStyle: 'serif',
  }
}

interface Props {
  story: Story
}

export function StoryCard({ story }: Props) {
  const theme: CoverTheme = story.coverTheme ?? legacyTheme(story.id)

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
          {/* Spine */}
          <div
            className="w-3 shrink-0 relative"
            style={{
              background: `linear-gradient(to bottom, ${theme.fromColor}, ${theme.toColor})`,
              filter: 'brightness(1.35)',
              boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.40), inset 1px 0 2px rgba(255,255,255,0.10)',
            }}
          >
            <span
              className="absolute inset-0 flex items-center justify-center text-[7px] font-sans tracking-widest text-white/20 overflow-hidden"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {story.title}
            </span>
          </div>

          {/* Cover */}
          <div
            className="flex-1 relative flex flex-col justify-between p-3 overflow-hidden"
            style={{
              background: `linear-gradient(to bottom right, ${theme.fromColor}, ${theme.toColor})`,
            }}
          >
            {/* Pattern overlay */}
            {theme.pattern === 'stars' && (
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }} />
            )}
            {theme.pattern === 'grid' && (
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }} />
            )}
            {theme.pattern === 'dots' && (
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)',
                  backgroundSize: '14px 14px',
                }} />
            )}
            {theme.pattern === 'lines' && (
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)',
                }} />
            )}

            {/* Top — world badge */}
            <div className="relative z-10">
              <span className="text-[8px] uppercase tracking-[0.22em] font-sans text-white/30">
                {story.worldName}
              </span>
            </div>

            {/* Center — emblem */}
            <div className="flex items-center justify-center flex-1 py-2 relative z-10">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                {theme.icon || <BookOpen className="h-5 w-5 text-white/30" />}
              </div>
            </div>

            {/* Bottom — title + author */}
            <div className="space-y-1 relative z-10">
              <h3
                className="text-[12px] leading-snug text-white/90 line-clamp-3"
                style={{
                  fontFamily: theme.fontStyle === 'gothic'
                    ? '"Palatino Linotype", Palatino, serif'
                    : theme.fontStyle === 'script'
                    ? 'cursive'
                    : 'Georgia, "Times New Roman", serif',
                }}
              >
                {story.title}
              </h3>
              <p className="text-[9px] font-sans text-white/30">by {story.authorName}</p>
            </div>

            {/* Page edge + hover brightening */}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white/8 z-10" />
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/6 transition-colors duration-300 pointer-events-none z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Shelf shadow */}
        <div
          className="absolute bottom-0 inset-x-2 h-3 blur-lg transition-opacity duration-300
            opacity-60 group-hover:opacity-25 pointer-events-none"
          style={{ background: 'oklch(0.20 0.04 60)' }}
        />

        {/* Stats */}
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
