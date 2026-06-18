import Link from 'next/link'
import { coverFontFamily, patternStyle } from '@/components/book/CoverDesigner'
import type { Story, CoverTheme } from '@/types'

// Fallback covers for stories that predate the cover designer
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

// Mini cover face — shown in the hover popup above the spine
function CoverPopup({
  theme,
  title,
  authorName,
}: {
  theme: CoverTheme
  title: string
  authorName: string
}) {
  const accent = theme.accentColor ?? '#fbbf24'
  return (
    <div
      className="relative w-full overflow-hidden rounded-sm border border-white/10"
      style={{ aspectRatio: '2/3' }}
    >
      {theme.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.coverImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom right, ${theme.fromColor}, ${theme.toColor})`,
          }}
        />
      )}

      {!theme.coverImageUrl && theme.pattern !== 'none' && (
        <div className="absolute inset-0 pointer-events-none" style={patternStyle(theme.pattern)} />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/20 pointer-events-none" />

      <div className="absolute inset-x-2 bottom-2 space-y-0.5">
        <h3
          className="text-[10px] leading-snug line-clamp-3"
          style={{
            fontFamily: coverFontFamily(theme.fontStyle),
            color: accent,
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}
        >
          {title}
        </h3>
        <p className="text-[7px] font-sans" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {authorName}
        </p>
      </div>
    </div>
  )
}

interface Props {
  story: Story
}

export function StoryCard({ story }: Props) {
  const theme: CoverTheme = story.coverTheme ?? legacyTheme(story.id)
  const accent = theme.accentColor ?? '#fbbf24'

  return (
    <Link
      href={`/stories/${story.id}`}
      className="group relative block shrink-0"
      style={{ width: 38 }}
    >
      <div className="relative pb-2">
        {/* ── Spine ── */}
        <div
          className="relative w-full overflow-hidden rounded-[2px] cursor-pointer
            transition-all duration-300 ease-out
            group-hover:-translate-y-5
            shadow-[2px_3px_12px_-2px_rgba(0,0,0,0.65)]
            group-hover:shadow-[4px_20px_36px_-6px_rgba(0,0,0,0.9)]"
          style={{ height: 180 }}
        >
          {/* Gradient fill */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, ${theme.fromColor}, ${theme.toColor})`,
              filter: 'brightness(1.3)',
            }}
          />

          {/* Pattern overlay */}
          {theme.pattern !== 'none' && (
            <div
              className="absolute inset-0 pointer-events-none opacity-50"
              style={patternStyle(theme.pattern)}
            />
          )}

          {/* Left edge highlight */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20" />
          {/* Right edge shadow */}
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-black/35 to-transparent" />

          {/* Emblem at top */}
          {theme.icon && (
            <div className="absolute top-2.5 inset-x-0 flex justify-center">
              <span
                className="text-[11px] leading-none"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}
              >
                {theme.icon}
              </span>
            </div>
          )}

          {/* Title — vertical, reads top to bottom */}
          <div className="absolute inset-x-0 top-8 bottom-5 flex items-center justify-center overflow-hidden">
            <span
              className="text-[10.5px] leading-none tracking-wide"
              style={{
                writingMode: 'vertical-rl',
                color: accent,
                fontFamily: coverFontFamily(theme.fontStyle),
                textShadow: `0 1px 4px rgba(0,0,0,0.7)`,
                maxHeight: '100%',
              }}
            >
              {story.title}
            </span>
          </div>

          {/* Author — very small at bottom */}
          <div className="absolute bottom-1.5 inset-x-0 flex justify-center overflow-hidden">
            <span
              className="text-[6.5px] font-sans"
              style={{
                writingMode: 'vertical-rl',
                color: 'rgba(255,255,255,0.22)',
              }}
            >
              {story.authorName}
            </span>
          </div>

          {/* Hover brightening */}
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors duration-300 pointer-events-none" />
        </div>

        {/* Shelf shadow */}
        <div
          className="absolute bottom-0 inset-x-0 h-2 blur-md opacity-50 group-hover:opacity-20 transition-opacity pointer-events-none"
          style={{ background: '#111' }}
        />
      </div>

      {/* ── Cover popup on hover ── */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          opacity-0 group-hover:opacity-100
          scale-90 group-hover:scale-100
          transition-all duration-200
          pointer-events-none z-30 origin-bottom"
        style={{
          width: 100,
          filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.85))',
        }}
      >
        <CoverPopup theme={theme} title={story.title} authorName={story.authorName} />
        <div className="mt-1 text-center">
          <p className="text-[8px] font-sans text-muted-foreground/40 leading-relaxed">
            {story.views.toLocaleString()} reads · {story.nodeCount}{' '}
            {story.nodeCount === 1 ? 'ch' : 'chs'}
          </p>
        </div>
      </div>
    </Link>
  )
}
