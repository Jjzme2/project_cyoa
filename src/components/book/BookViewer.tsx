'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, Sparkles, Volume2, VolumeX, Waves, Trophy } from 'lucide-react'
import { StoryContent } from './StoryContent'
import { ChoiceSlots } from './ChoiceSlots'
import { NodeReactions } from './NodeReactions'
import { SaveSlotPicker, loadSaveSlots, getActiveSlotId, upsertSaveSlot } from './SaveSlotPicker'
import { SharePathButton } from './SharePathButton'
import { BookmarkButton } from './BookmarkButton'
import { GalleryButton } from './GalleryButton'
import { AmbientBackground } from './AmbientBackground'
import { JourneyMap } from './JourneyMap'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/components/Providers'
import { CreatorResourceManager } from '@/lib/creator-resources'
import {
  playPageTurn,
  isPageSoundMuted,
  setPageSoundMuted,
  startAmbient,
  stopAmbient,
  isAmbientOn,
  setAmbientOn,
} from '@/lib/page-sound'
import type { Story, StoryNode, ChoiceSlot, ChoiceEffect, SaveSlot } from '@/types'

interface DiscoveredEnding {
  id: string
  excerpt: string
}

const ENDINGS_KEY = (storyId: string) => `cyoa:endings:${storyId}`

function loadDiscoveredEndings(storyId: string): DiscoveredEnding[] {
  try {
    return JSON.parse(localStorage.getItem(ENDINGS_KEY(storyId)) || '[]')
  } catch {
    return []
  }
}

// A page with no onward navigable path is an ending / story frontier.
function isEndingNode(n: StoryNode): boolean {
  return !n.slots.some((s) => s.filled && s.childNodeId)
}

// ── Page theme palette ─────────────────────────────────────────────────────────
const PAGE_PALETTES: Record<string, { bg: string; text: string; spine: string }> = {
  parchment: { bg: '#f0e6d0', text: '#3d2b1f', spine: 'rgba(61,43,31,0.15)' },
  sepia:     { bg: '#d4b896', text: '#2d1a0e', spine: 'rgba(45,26,14,0.15)' },
  night:     { bg: '#1a1a2e', text: '#c0c8e0', spine: 'rgba(192,200,224,0.10)' },
  forest:    { bg: '#e8f0e0', text: '#1a2d15', spine: 'rgba(26,45,21,0.12)' },
  ocean:     { bg: '#e0eef0', text: '#0d2535', spine: 'rgba(13,37,53,0.12)' },
  rose:      { bg: '#f0e0e4', text: '#2d1518', spine: 'rgba(45,21,24,0.12)' },
}

interface Props {
  story: Story
  initialNode: StoryNode
  endingCount?: number
}

type Direction = 'forward' | 'back'

const pageVariants = {
  enter: (dir: Direction) => ({
    rotateY: dir === 'forward' ? 32 : -32,
    x: dir === 'forward' ? '7%' : '-7%',
    opacity: 0,
    scale: 0.955,
  }),
  center: { rotateY: 0, x: 0, opacity: 1, scale: 1 },
  exit: (dir: Direction) => ({
    rotateY: dir === 'forward' ? -32 : 32,
    x: dir === 'forward' ? '-7%' : '7%',
    opacity: 0,
    scale: 0.955,
  }),
}

const pageTransition = {
  duration: 0.54,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}

const LOCAL_KEY = (storyId: string) => `cyoa:progress:${storyId}`

function loadLocalProgress(storyId: string): {
  currentNodeId: string
  nodeHistory: string[]
  resources?: Record<string, number | string | string[] | number[]>
  resourcesHistory?: Record<string, number | string | string[] | number[]>[]
} | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(storyId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLocalProgress(
  storyId: string,
  currentNodeId: string,
  nodeHistory: string[],
  resources?: Record<string, number | string | string[] | number[]>,
  resourcesHistory?: Record<string, number | string | string[] | number[]>[],
) {
  try {
    localStorage.setItem(
      LOCAL_KEY(storyId),
      JSON.stringify({ currentNodeId, nodeHistory, resources, resourcesHistory }),
    )
  } catch {}
}

export function BookViewer({ story, initialNode, endingCount }: Props) {
  const { user } = useAuth()
  const [node, setNode] = useState<StoryNode>(initialNode)
  const [history, setHistory] = useState<StoryNode[]>([])
  const [fetchingNode, setFetchingNode] = useState(false)
  const [direction, setDirection] = useState<Direction>('forward')
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [resources, setResources] = useState<Record<string, number | string | string[] | number[]>>({})
  const [resourcesHistory, setResourcesHistory] = useState<Record<string, number | string | string[] | number[]>[]>([])
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  // Lazy init reads the saved preference once; BookViewer is client-only (ssr:false).
  const [soundOn, setSoundOn] = useState(() => !isPageSoundMuted())
  const [ambientOn, setAmbientState] = useState(() => isAmbientOn())
  const [discoveredEndings, setDiscoveredEndings] = useState<DiscoveredEnding[]>(() =>
    loadDiscoveredEndings(story.id),
  )
  const [endingsOpen, setEndingsOpen] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ambientEffect = story.readingTheme?.ambientEffect ?? 'none'

  // Start/stop the looping soundscape with the toggle (and clean up on unmount).
  useEffect(() => {
    if (ambientOn && ambientEffect !== 'none') startAmbient(ambientEffect)
    return () => stopAmbient()
  }, [ambientOn, ambientEffect])

  function toggleAmbient() {
    setAmbientState((on) => {
      const next = !on
      setAmbientOn(next)
      return next
    })
  }

  // Record reaching an ending/frontier (deduped, persisted) and celebrate it.
  function recordEnding(n: StoryNode) {
    if (!isEndingNode(n)) return
    const prev = loadDiscoveredEndings(story.id)
    if (prev.some((e) => e.id === n.id)) return
    const next = [...prev, { id: n.id, excerpt: (n.content || '').slice(0, 140) }]
    try {
      localStorage.setItem(ENDINGS_KEY(story.id), JSON.stringify(next))
    } catch {}
    setDiscoveredEndings(next)
    toast.success(endingCount ? `Ending discovered! (${next.length}/${endingCount})` : 'Ending discovered!')
  }

  function toggleSound() {
    setSoundOn((on) => {
      const next = !on
      setPageSoundMuted(!next)
      if (next) playPageTurn() // brief preview when enabling
      return next
    })
  }

  // ── Progress restore ──────────────────────────────────────────────────────

  useEffect(() => {
    async function restore() {
      const local = loadLocalProgress(story.id)

      if (local?.resources) {
        setResources(local.resources)
        if (local.resourcesHistory) setResourcesHistory(local.resourcesHistory)
      } else if (story.resources) {
        const initial: Record<string, number | string | string[] | number[]> = {}
        story.resources.forEach((r) => {
          if (r.type === 'array') {
            initial[r.name] = Array.isArray(r.defaultValue)
              ? r.defaultValue
              : typeof r.defaultValue === 'string'
              ? r.defaultValue.split(',').map((s) => s.trim()).filter(Boolean)
              : []
          } else if (r.type === 'number') {
            initial[r.name] = Number(r.defaultValue || 0)
          } else {
            initial[r.name] = String(r.defaultValue || '')
          }
        })
        setResources(initial)
      }

      // Restore active slot from localStorage save slots
      const savedSlotId = getActiveSlotId(story.id)
      const slots = loadSaveSlots(story.id)
      const activeSlot = slots.find((s) => s.id === savedSlotId)
      setActiveSlotId(savedSlotId)

      if (local?.currentNodeId && local.currentNodeId !== initialNode.id) {
        await restoreProgress(local.currentNodeId, local.nodeHistory)
      } else if (user) {
        try {
          const token = await user.getIdToken()
          const res = await fetch(`/api/progress/${story.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.currentNodeId && data.currentNodeId !== initialNode.id) {
              saveLocalProgress(story.id, data.currentNodeId, data.nodeHistory ?? [], local?.resources, local?.resourcesHistory)
              await restoreProgress(data.currentNodeId, data.nodeHistory ?? [])
            }
          }
        } catch {}
      }

      setProgressLoaded(true)
    }
    restore()
  }, [])

  // Fetch a node, attaching the user's token when signed in so admins receive
  // unpublished/flagged routes that readers don't.
  async function fetchNode(nodeId: string): Promise<Response> {
    const headers: Record<string, string> = {}
    if (user) {
      try {
        headers.Authorization = `Bearer ${await user.getIdToken()}`
      } catch {}
    }
    return fetch(`/api/stories/${story.id}/nodes?nodeId=${nodeId}`, { headers })
  }

  async function refreshCurrentNode() {
    try {
      const res = await fetchNode(node.id)
      if (!res.ok) return
      const data = await res.json()
      setNode(data.node)
    } catch {}
  }

  async function restoreProgress(currentNodeId: string, historyIds: string[]) {
    try {
      const res = await fetchNode(currentNodeId)
      if (!res.ok) return
      const data = await res.json()
      const historyNodes: StoryNode[] = historyIds.map((id) => ({
        id, storyId: story.id, content: '', depth: 0, parentId: null,
        choiceText: null, slots: [], authorId: null, aiGenerated: false,
        aiModel: null, imageUrl: null, published: true, createdAt: '',
      }))
      setHistory(historyNodes)
      setNode(data.node)
      recordEnding(data.node)
    } catch {}
  }

  function persistProgress(
    currentNodeId: string,
    historyNodes: StoryNode[],
    updatedResources?: Record<string, number | string | string[] | number[]>,
    updatedResHistory?: Record<string, number | string | string[] | number[]>[],
  ) {
    const historyIds = historyNodes.map((n) => n.id)
    saveLocalProgress(story.id, currentNodeId, historyIds, updatedResources ?? resources, updatedResHistory ?? resourcesHistory)

    // Update active named slot if one is set
    if (activeSlotId) {
      const slots = loadSaveSlots(story.id)
      const slot = slots.find((s) => s.id === activeSlotId)
      if (slot) {
        upsertSaveSlot(story.id, {
          ...slot,
          currentNodeId,
          nodeHistory: historyIds,
          resources: (updatedResources ?? resources) as Record<string, number | string | string[]>,
          savedAt: new Date().toISOString(),
        })
      }
    }

    if (!user) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const token = await user.getIdToken()
        await fetch(`/api/progress/${story.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentNodeId, nodeHistory: historyIds }),
        })
      } catch {}
    }, 800)
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async function goToNode(nodeId: string, effects?: ChoiceEffect[]) {
    if (soundOn) playPageTurn()
    setFetchingNode(true)
    setDirection('forward')
    try {
      const res = await fetchNode(nodeId)
      if (!res.ok) throw new Error()
      const data = await res.json()

      let updatedResources = { ...resources }
      const nextResHistory = [...resourcesHistory, resources]
      if (effects && effects.length > 0) {
        updatedResources = CreatorResourceManager.applyEffects(effects, updatedResources, story.resources)
        setResourcesHistory(nextResHistory)
        setResources(updatedResources)
      } else {
        setResourcesHistory(nextResHistory)
      }

      setHistory((h) => {
        const next = [...h, node]
        persistProgress(nodeId, next, updatedResources, nextResHistory)
        return next
      })
      setNode(data.node)
      recordEnding(data.node)
    } catch {
      toast.error('Could not load that path.')
    } finally {
      setFetchingNode(false)
    }
  }

  function goBack() {
    const prev = history.at(-1)
    if (!prev) return
    if (soundOn) playPageTurn()
    setDirection('back')

    let updatedResources = { ...resources }
    let nextResHistory = [...resourcesHistory]

    setResourcesHistory((rh) => {
      const prevRes = rh.at(-1)
      if (prevRes) {
        updatedResources = prevRes
        nextResHistory = rh.slice(0, -1)
        setResources(prevRes)
        return nextResHistory
      }
      return rh
    })

    setHistory((h) => {
      const next = h.slice(0, -1)
      if (!prev.content) { goToNode(prev.id); return next }
      persistProgress(prev.id, next, updatedResources, nextResHistory)
      return next
    })
    if (prev.content) setNode(prev)
  }

  function handleSlotFilled(slot: ChoiceSlot, nodeId: string, pendingReview?: boolean) {
    if (pendingReview) {
      // Flagged contribution: hidden pending review. Reflect locally, don't navigate.
      setNode((n) => ({
        ...n,
        slots: n.slots.map((s) =>
          s.id === slot.id ? { ...s, filled: true, childNodeId: null, pendingReview: true } : s,
        ),
      }))
      return
    }
    setNode((n) => ({
      ...n,
      slots: n.slots.map((s) => (s.id === slot.id ? { ...s, filled: true, childNodeId: nodeId } : s)),
    }))
    goToNode(nodeId)
  }

  // ── Save slots ────────────────────────────────────────────────────────────

  function handleSwitchSlot(slot: SaveSlot) {
    setActiveSlotId(slot.id)
    localStorage.setItem(`cyoa:active:${story.id}`, slot.id)
    restoreProgress(slot.currentNodeId, slot.nodeHistory).then(() => {
      if (slot.resources) setResources(slot.resources as Record<string, number | string | string[] | number[]>)
    })
    toast(`Switched to "${slot.name}"`)
  }

  function handleSaveAs(name: string) {
    const slotId = `slot_${Date.now()}`
    const slot: SaveSlot = {
      id: slotId,
      name,
      currentNodeId: node.id,
      nodeHistory: history.map((n) => n.id),
      resources: resources as Record<string, number | string | string[]>,
      savedAt: new Date().toISOString(),
    }
    upsertSaveSlot(story.id, slot)
    setActiveSlotId(slotId)
    toast.success(`Saved as "${name}"`)
  }

  const pageNumber = history.length + 1
  const palette = PAGE_PALETTES[story.readingTheme?.pageStyle ?? 'parchment'] ?? PAGE_PALETTES.parchment

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-4xl mx-auto">
      <AmbientBackground effect={ambientEffect} />

      {/* Resources bar */}
      {story.resources && story.resources.length > 0 && (
        <div
          className="w-full p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between"
          style={{
            background: 'oklch(0.92 0.02 80 / 55%)',
            borderColor: 'oklch(0.50 0.06 60 / 25%)',
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500/80 tracking-wider uppercase font-sans">
            <Sparkles className="h-3.5 w-3.5" />
            Resources & Inventory
          </div>
          <div className="flex flex-wrap gap-3">
            {story.resources.filter((r) => !r.hidden).map((resDef) => {
              const val = resources[resDef.name] ?? resDef.defaultValue
              return (
                <div
                  key={resDef.name}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-sans border bg-white/5"
                  style={{ borderColor: 'oklch(0.50 0.06 60 / 15%)' }}
                >
                  <span className="opacity-45">{resDef.name}:</span>
                  <span className="font-semibold text-amber-300">{Array.isArray(val) ? val.join(', ') || '—' : String(val)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Navigation + toolbar */}
      <div className="w-full flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={fetchingNode}
              className="gap-1.5 text-amber-400/55 hover:text-amber-300"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous page
            </Button>
          )}
          <SaveSlotPicker
            storyId={story.id}
            activeSlotId={activeSlotId}
            onSwitchSlot={handleSwitchSlot}
            onSaveAs={handleSaveAs}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEndingsOpen(true)}
            title="Endings discovered"
            aria-label="Endings discovered"
            className="flex items-center gap-1 h-8 px-2 rounded-full text-amber-400/55 hover:text-amber-300 transition-colors text-xs font-sans"
          >
            <Trophy className="h-3.5 w-3.5" />
            {discoveredEndings.length}
            {endingCount ? `/${endingCount}` : ''}
          </button>
          <GalleryButton storyId={story.id} />
          {ambientEffect !== 'none' && (
            <button
              onClick={toggleAmbient}
              title={ambientOn ? 'Turn off ambient sound' : 'Turn on ambient sound'}
              aria-label={ambientOn ? 'Turn off ambient sound' : 'Turn on ambient sound'}
              className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
                ambientOn ? 'text-amber-300' : 'text-amber-400/40 hover:text-amber-300'
              }`}
            >
              <Waves className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleSound}
            title={soundOn ? 'Mute page-turn sound' : 'Unmute page-turn sound'}
            aria-label={soundOn ? 'Mute page-turn sound' : 'Unmute page-turn sound'}
            className="flex items-center justify-center h-8 w-8 rounded-full text-amber-400/50 hover:text-amber-300 transition-colors"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <BookmarkButton storyId={story.id} />
          <SharePathButton
            storyId={story.id}
            nodeHistory={history.map((n) => n.id)}
            currentNodeId={node.id}
          />
        </div>
      </div>

      {/* Book */}
      <div className="relative w-full" style={{ perspective: '2400px' }}>
        <div
          className="absolute inset-x-6 -bottom-px h-4 rounded-b-xl pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, oklch(0.75 0.03 75), oklch(0.88 0.04 80) 25%, oklch(0.91 0.03 82) 50%, oklch(0.86 0.04 80) 75%, oklch(0.72 0.03 74))',
            boxShadow: '0 3px 0 oklch(0.68 0.04 65 / 55%), 0 5px 0 oklch(0.62 0.04 60 / 35%), 0 7px 0 oklch(0.57 0.03 55 / 20%)',
          }}
        />
        <div className="absolute inset-x-10 -bottom-4 h-20 blur-3xl bg-black/70 rounded-full pointer-events-none" />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={node.id}
            custom={direction}
            variants={pageVariants}
            initial={progressLoaded ? 'enter' : false}
            animate="center"
            exit="exit"
            transition={pageTransition}
            style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
            className="grid grid-cols-1 md:grid-cols-[1fr_10px_1fr] rounded-2xl overflow-hidden shadow-[0_30px_100px_-18px_rgba(0,0,0,0.92),0_8px_32px_-8px_rgba(0,0,0,0.55)]"
          >
            {/* Left page — story content + reactions */}
            <div
              className="book-page page-texture p-8 lg:p-12 min-h-[560px] md:min-h-[640px] h-auto max-h-[850px] flex flex-col relative"
              style={{ '--page-bg': palette.bg, '--page-text': palette.text } as React.CSSProperties}
            >
              <div
                className="absolute top-4 left-4 w-8 h-8 opacity-15 pointer-events-none select-none"
                style={{ backgroundImage: 'radial-gradient(circle at top left, oklch(0.45 0.10 60) 0%, transparent 70%)' }}
              />
              <StoryContent
                content={node.content}
                depth={node.depth}
                choiceText={node.choiceText}
                imageUrl={node.imageUrl}
              />
              <NodeReactions storyId={story.id} nodeId={node.id} />
              <p className="mt-2 text-center text-[10px] font-sans opacity-20 tracking-widest select-none">
                — {pageNumber * 2 - 1} —
              </p>
            </div>

            <div className="book-spine hidden md:block" />

            {/* Right page — choices */}
            <div
              className="book-page page-texture p-8 lg:p-12 min-h-[560px] md:min-h-[640px] h-auto max-h-[850px] flex flex-col relative"
              style={{ '--page-bg': palette.bg, '--page-text': palette.text } as React.CSSProperties}
            >
              <div
                className="absolute top-4 right-4 w-8 h-8 opacity-15 pointer-events-none select-none"
                style={{ backgroundImage: 'radial-gradient(circle at top right, oklch(0.45 0.10 60) 0%, transparent 70%)' }}
              />
              <ChoiceSlots
                storyId={story.id}
                nodeId={node.id}
                slots={node.slots}
                onChoiceSelect={goToNode}
                onSlotFilled={handleSlotFilled}
                onModerated={refreshCurrentNode}
                currentResources={resources}
                storyResources={story.resources}
              />
              <p className="mt-4 text-center text-[10px] font-sans opacity-20 tracking-widest select-none">
                — {pageNumber * 2} —
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {fetchingNode && (
          <div className="absolute inset-0 rounded-2xl bg-amber-50/8 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="w-10 h-10 border-2 border-amber-900/25 border-t-amber-800/70 rounded-full animate-spin" />
          </div>
        )}
      </div>

      <JourneyMap
        history={history}
        currentNode={node}
        onNavigate={(nodeId) => {
          setDirection('back')
          goToNode(nodeId)
          // Trim history to the point before this node
          setHistory((h) => {
            const idx = h.findIndex((n) => n.id === nodeId)
            return idx >= 0 ? h.slice(0, idx) : h
          })
        }}
      />

      <p className="text-[11px] text-muted-foreground/30 font-sans tracking-wide">
        {story.title} · {story.authorName} · {story.nodeCount}{' '}
        {story.nodeCount === 1 ? 'chapter' : 'chapters'}
      </p>

      <Dialog open={endingsOpen} onOpenChange={setEndingsOpen}>
        <DialogContent className="glass-strong border-white/15 sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gold-text text-lg flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Endings discovered
              {endingCount ? ` — ${discoveredEndings.length}/${endingCount}` : ''}
            </DialogTitle>
          </DialogHeader>

          {discoveredEndings.length === 0 ? (
            <p className="text-sm text-muted-foreground/55 py-4">
              You haven&apos;t reached an ending yet. Follow the paths to their conclusions — each
              one you find is recorded here.
            </p>
          ) : (
            <ul className="space-y-2">
              {discoveredEndings.map((e, i) => (
                <li key={e.id} className="glass-card rounded-lg p-3 border border-white/[0.07]">
                  <span className="text-[10px] uppercase tracking-widest text-amber-400/45 font-sans">
                    Ending {i + 1}
                  </span>
                  <p className="text-sm text-foreground/75 leading-snug mt-1">{e.excerpt}…</p>
                </li>
              ))}
            </ul>
          )}

          {endingCount != null && endingCount > discoveredEndings.length && (
            <p className="text-[11px] text-muted-foreground/40 font-sans text-center pt-1">
              {endingCount - discoveredEndings.length} more waiting to be found.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
