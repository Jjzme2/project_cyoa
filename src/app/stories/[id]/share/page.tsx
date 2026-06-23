import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, ChevronRight, ArrowLeft } from 'lucide-react'
import { getStory, getStoryNode } from '@/lib/firestore-helpers'
import type { StoryNode } from '@/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ path?: string }>
}

async function ShareContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ path?: string }>
}) {
  const { id: storyId } = await params
  const { path } = await searchParams

  const story = await getStory(storyId)
  if (!story) notFound()

  const nodeIds = path ? path.split(',').filter(Boolean).slice(0, 40) : []
  if (nodeIds.length === 0) notFound()

  const nodes = await Promise.all(
    nodeIds.map((nodeId) => getStoryNode(storyId, nodeId).catch(() => null)),
  )
  const validNodes = nodes.filter((n): n is StoryNode => n !== null)
  if (validNodes.length === 0) notFound()

  return (
    <>
      <div className="space-y-3">
        <Link
          href={`/stories/${storyId}`}
          className="inline-flex items-center gap-1.5 text-xs text-amber-400/50 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to story
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/40 font-sans uppercase tracking-widest">
            <BookOpen className="h-3.5 w-3.5" />
            Shared path · {validNodes.length} chapters
          </div>
          <h1
            className="text-3xl font-bold text-foreground/90"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {story.title}
          </h1>
          <p className="text-sm text-muted-foreground/50">
            by {story.authorName} · {story.worldName}
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.07]" />

      <div className="space-y-10">
        {validNodes.map((node, i) => {
          const isLast = i === validNodes.length - 1
          return (
            <article key={node.id} className="space-y-4">
              {node.choiceText && (
                <p
                  className="text-xs italic text-muted-foreground/45 pb-3 border-b border-amber-900/20"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  ❝ {node.choiceText} ❞
                </p>
              )}

              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-[0.25em] opacity-30 font-sans">
                  Chapter {node.depth + 1}
                </span>
                {node.imageUrl && (
                  <span className="text-[9px] font-sans text-emerald-400/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    Illustrated
                  </span>
                )}
              </div>

              {node.imageUrl && (
                <div
                  className="relative w-full rounded-xl overflow-hidden"
                  style={{ aspectRatio: '16/9' }}
                >
                  <Image
                    src={node.imageUrl}
                    alt="Chapter illustration"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 672px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
              )}

              <div className="space-y-4">
                {node.content
                  .split('\n')
                  .filter((p) => p.trim())
                  .map((p, j) => (
                    <p
                      key={j}
                      className="text-[16px] leading-[1.9] text-foreground/80"
                      style={{
                        fontFamily: 'Georgia, serif',
                        textIndent: j === 0 ? '1.5em' : undefined,
                      }}
                    >
                      {p}
                    </p>
                  ))}
              </div>

              {!isLast && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <ChevronRight className="h-3 w-3 text-white/20" />
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="border-t border-white/[0.07] pt-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground/50" style={{ fontFamily: 'Georgia, serif' }}>
          This is one path through the story. Countless others remain unwritten.
        </p>
        <Link
          href={`/stories/${storyId}`}
          className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          Read and write your own path
        </Link>
        <p className="text-[10px] text-muted-foreground/45 font-sans">Chronicle · Community CYOA</p>
      </div>
    </>
  )
}

function ShareContentSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-white/5" />
        <div className="h-8 w-72 rounded bg-white/5" />
        <div className="h-4 w-40 rounded bg-white/5" />
      </div>
      <div className="border-t border-white/[0.07]" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-4/5 rounded bg-white/5" />
        <div className="h-4 w-3/4 rounded bg-white/5" />
      </div>
    </div>
  )
}

// Synchronous page shell — all dynamic work (params, searchParams, Firestore) inside Suspense
export default function SharePathPage({ params, searchParams }: Props) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <Suspense fallback={<ShareContentSkeleton />}>
        <ShareContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
