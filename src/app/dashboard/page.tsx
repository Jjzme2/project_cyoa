'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen, Globe, Eye, ChevronRight, GitBranch, CheckCircle2,
  Circle, Loader2, TreePine, BarChart3, Users, Feather,
} from 'lucide-react'
import { useAuth } from '@/components/Providers'
import type { Story, StoryTreeNode } from '@/types'

// ─── Story Tree ───────────────────────────────────────────────────────────────

function countNodes(node: StoryTreeNode): number {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0)
}

function countFilledSlots(node: StoryTreeNode): number {
  const own = node.slots.filter((s) => s.filled).length
  return own + node.children.reduce((s, c) => s + countFilledSlots(c), 0)
}

function countTotalSlots(node: StoryTreeNode): number {
  return node.slots.length + node.children.reduce((s, c) => s + countTotalSlots(c), 0)
}

function TreeNodeRow({
  node,
  storyId,
  depth = 0,
}: {
  node: StoryTreeNode
  storyId: string
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const filledSlots = node.slots.filter((s) => s.filled).length
  const pendingSlots = node.slots.filter((s) => !s.filled).length

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-1.5 px-2 rounded hover:bg-white/[0.03] transition-colors group cursor-default`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 mt-0.5 text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0 mt-0.5 h-3.5 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-white/15" />
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-sans text-muted-foreground/50 shrink-0">
              Ch.{node.depth + 1}
            </span>
            <span className="text-[12px] text-foreground/70 truncate">
              {node.choiceText ? (
                <span className="italic text-muted-foreground/50">↳ {node.choiceText}</span>
              ) : (
                <span>Opening chapter</span>
              )}
            </span>
            {node.imageUrl && (
              <span className="text-[9px] text-emerald-400/60 font-sans border border-emerald-500/20 px-1 py-0.5 rounded shrink-0">
                🎨
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5">
            {node.slots.map((slot, i) => (
              <div key={slot.id} className="flex items-center gap-1 text-[9px] font-sans">
                {slot.filled ? (
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400/60" />
                ) : (
                  <Circle className="h-2.5 w-2.5 text-muted-foreground/45" />
                )}
                <span className={slot.filled ? 'text-emerald-400/60' : 'text-muted-foreground/45'}>
                  {slot.filled ? slot.submitterName ?? 'Anon' : `Path ${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px] font-sans text-emerald-400/50">{filledSlots}✓</span>
          {pendingSlots > 0 && (
            <span className="text-[9px] font-sans text-muted-foreground/45">{pendingSlots}○</span>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow key={child.nodeId} node={child} storyId={storyId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryDashboardCard({ story }: { story: Story }) {
  const [expanded, setExpanded] = useState(false)
  const [tree, setTree] = useState<StoryTreeNode[] | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const { user } = useAuth()

  async function loadTree() {
    if (!user || tree) return
    setTreeLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${story.id}/tree`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTree(data.tree)
      }
    } finally {
      setTreeLoading(false)
    }
  }

  function handleExpand() {
    setExpanded((e) => {
      if (!e) loadTree()
      return !e
    })
  }

  const totalNodes = tree ? tree.reduce((s, n) => s + countNodes(n), 0) : story.nodeCount
  const totalSlots = tree ? tree.reduce((s, n) => s + countTotalSlots(n), 0) : story.nodeCount * 3
  const filledSlots = tree ? tree.reduce((s, n) => s + countFilledSlots(n), 0) : 0
  const completionPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0

  return (
    <div className="glass border-white/10 rounded-xl overflow-hidden">
      <div className="p-5 flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/stories/${story.id}`}
                className="text-base font-semibold text-foreground/85 hover:text-amber-300 transition-colors leading-snug"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {story.title}
              </Link>
              {story.tags && story.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 shrink-0">
                  {story.tags.map((tag) => (
                    <span key={tag} className="text-[9px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground/50">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground/45 mt-0.5">{story.worldName}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: BookOpen, label: 'Chapters', value: totalNodes },
              { icon: Eye, label: 'Views', value: story.views.toLocaleString() },
              { icon: GitBranch, label: 'Paths filled', value: tree ? filledSlots : '—' },
              { icon: Users, label: 'Completion', value: tree ? `${completionPct}%` : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-center">
                <Icon className="h-3.5 w-3.5 mx-auto mb-1 opacity-30" />
                <p className="text-sm font-mono font-bold text-amber-300/70">{value}</p>
                <p className="text-[9px] font-sans text-muted-foreground/50 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {tree && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-sans text-muted-foreground/40">
                <span>Branch completion</span>
                <span>{filledSlots}/{totalSlots} slots</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600/70 to-amber-400/70 rounded-full transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={`/stories/${story.id}`}
            className="text-[10px] font-sans px-3 py-1.5 rounded border border-white/10 text-muted-foreground/50 hover:text-muted-foreground hover:border-white/20 transition-colors"
          >
            Read
          </Link>
          <button
            onClick={handleExpand}
            className={`text-[10px] font-sans px-3 py-1.5 rounded border transition-colors flex items-center gap-1 ${
              expanded
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-white/10 text-muted-foreground/50 hover:border-white/20 hover:text-muted-foreground'
            }`}
          >
            <TreePine className="h-3 w-3" />
            Tree
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] p-3">
          {treeLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400/40" />
            </div>
          ) : tree && tree.length > 0 ? (
            <div className="space-y-0.5">
              {tree.map((root) => (
                <TreeNodeRow key={root.nodeId} node={root} storyId={story.id} depth={0} />
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground/50 py-4 font-sans">
              No branches to display yet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setStories(data.stories ?? [])
        }
      } finally {
        setFetching(false)
      }
    })
  }, [user])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  const totalViews = stories.reduce((s, st) => s + (st.views ?? 0), 0)
  const totalNodes = stories.reduce((s, st) => s + (st.nodeCount ?? 0), 0)

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-1">
        <p className="text-xs text-amber-400/50 uppercase tracking-widest font-sans">Chronicle</p>
        <h1 className="text-3xl font-bold gold-text">Author Dashboard</h1>
        <p className="text-sm text-muted-foreground/55">
          Manage your stories, explore branches, and track community contributions.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: 'Stories', value: stories.length },
          { icon: BarChart3, label: 'Total chapters', value: totalNodes },
          { icon: Eye,       label: 'Total views', value: totalViews.toLocaleString() },
          { icon: Feather,   label: 'Avg chapters/story', value: stories.length > 0 ? Math.round(totalNodes / stories.length) : 0 },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass border-white/10 rounded-xl p-5 text-center space-y-1">
            <Icon className="h-4 w-4 text-amber-400/60 mx-auto mb-2" />
            <p className="text-2xl font-mono font-bold text-amber-300/80">{value}</p>
            <p className="text-[10px] font-sans text-muted-foreground/55 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Story list */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <GitBranch className="h-4 w-4 text-amber-400/60" />
          <h2 className="text-base font-semibold text-amber-200/80">Your Stories</h2>
          <span className="text-xs text-muted-foreground/50 font-sans ml-1">
            Click &quot;Tree&quot; to explore branches
          </span>
        </div>

        {fetching ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400/40" />
          </div>
        ) : stories.length === 0 ? (
          <div className="glass border-white/10 rounded-xl p-10 text-center space-y-4">
            <Globe className="h-8 w-8 text-amber-400/20 mx-auto" />
            <p className="text-sm text-muted-foreground/40">
              You haven&apos;t started any stories yet.
            </p>
            <Link
              href="/stories/new"
              className="inline-flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200 transition-colors"
            >
              Start your first story →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {stories.map((story) => (
              <StoryDashboardCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
