'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { StoryContent } from './StoryContent'
import { ChoiceSlots } from './ChoiceSlots'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'
import type { Story, StoryNode, ChoiceSlot, ChoiceEffect } from '@/types'

interface Props {
  story: Story
  initialNode: StoryNode
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
  resources?: Record<string, number | string>
  resourcesHistory?: Record<string, number | string>[]
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
  resources?: Record<string, number | string>,
  resourcesHistory?: Record<string, number | string>[]
) {
  try {
    localStorage.setItem(
      LOCAL_KEY(storyId),
      JSON.stringify({ currentNodeId, nodeHistory, resources, resourcesHistory })
    )
  } catch {
    // storage full or unavailable
  }
}

export function BookViewer({ story, initialNode }: Props) {
  const { user } = useAuth()
  const [node, setNode] = useState<StoryNode>(initialNode)
  const [history, setHistory] = useState<StoryNode[]>([])
  const [fetchingNode, setFetchingNode] = useState(false)
  const [direction, setDirection] = useState<Direction>('forward')
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [resources, setResources] = useState<Record<string, number | string>>({})
  const [resourcesHistory, setResourcesHistory] = useState<Record<string, number | string>[]>([])
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore saved progress on mount
  useEffect(() => {
    async function restore() {
      // Try localStorage first for instant restore
      const local = loadLocalProgress(story.id)

      if (local?.resources) {
        setResources(local.resources)
        if (local.resourcesHistory) {
          setResourcesHistory(local.resourcesHistory)
        }
      } else if (story.resources) {
        const initial: Record<string, number | string> = {}
        story.resources.forEach((r) => {
          initial[r.name] = r.type === 'number' ? Number(r.defaultValue) : String(r.defaultValue)
        })
        setResources(initial)
      }

      if (local?.currentNodeId && local.currentNodeId !== initialNode.id) {
        // Fetch each node in the history chain to rebuild state
        await restoreProgress(local.currentNodeId, local.nodeHistory)
      } else if (user) {
        // Fetch from server if no local progress
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
        } catch {
          // non-critical
        }
      }

      setProgressLoaded(true)
    }

    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function restoreProgress(currentNodeId: string, historyIds: string[]) {
    try {
      // Fetch the saved current node
      const res = await fetch(`/api/stories/${story.id}/nodes?nodeId=${currentNodeId}`)
      if (!res.ok) return
      const data = await res.json()

      // Rebuild history as shallow node stubs — only the current node needs full slot data
      const historyNodes: StoryNode[] = historyIds.map((id) => ({
        id,
        storyId: story.id,
        content: '',
        depth: 0,
        parentId: null,
        choiceText: null,
        slots: [],
        authorId: null,
        aiGenerated: false,
        aiModel: null,
        imageUrl: null,
        createdAt: '',
      }))

      setHistory(historyNodes)
      setNode(data.node)
    } catch {
      // fall back to initial node silently
    }
  }

  function persistProgress(
    currentNodeId: string,
    historyNodes: StoryNode[],
    updatedResources?: Record<string, number | string>,
    updatedResHistory?: Record<string, number | string>[]
  ) {
    const historyIds = historyNodes.map((n) => n.id)
    saveLocalProgress(story.id, currentNodeId, historyIds, updatedResources ?? resources, updatedResHistory ?? resourcesHistory)

    if (!user) return
    // Debounce server save — no need to hit the API on every rapid navigation
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const token = await user.getIdToken()
        await fetch(`/api/progress/${story.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentNodeId, nodeHistory: historyIds }),
        })
      } catch {
        // non-critical
      }
    }, 800)
  }

  async function goToNode(nodeId: string, effects?: ChoiceEffect[]) {
    setFetchingNode(true)
    setDirection('forward')
    try {
      const res = await fetch(`/api/stories/${story.id}/nodes?nodeId=${nodeId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()

      // Apply resource effects if any exist
      let updatedResources = { ...resources }
      let nextResHistory = [...resourcesHistory, resources]
      
      if (effects && effects.length > 0) {
        effects.forEach((eff) => {
          const currentVal = updatedResources[eff.resourceName]
          if (currentVal !== undefined) {
            if (typeof currentVal === 'number') {
              const delta = Number(eff.value)
              if (eff.operator === '+=') {
                updatedResources[eff.resourceName] = currentVal + delta
              } else if (eff.operator === '-=') {
                updatedResources[eff.resourceName] = currentVal - delta
              } else if (eff.operator === '=') {
                updatedResources[eff.resourceName] = delta
              }
            } else {
              if (eff.operator === '=') {
                updatedResources[eff.resourceName] = String(eff.value)
              }
            }
          }
        })
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
    } catch {
      toast.error('Could not load that path.')
    } finally {
      setFetchingNode(false)
    }
  }

  function goBack() {
    const prev = history.at(-1)
    if (!prev) return
    setDirection('back')

    let updatedResources = { ...resources }
    let nextResHistory = [...resourcesHistory]
    
    // Rewind resources
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
      // If the restored history node is a stub, navigate for real
      if (!prev.content) {
        goToNode(prev.id)
        return next
      }
      persistProgress(prev.id, next, updatedResources, nextResHistory)
      return next
    })
    if (prev.content) setNode(prev)
  }

  function handleSlotFilled(slot: ChoiceSlot, nodeId: string) {
    setNode((n) => ({
      ...n,
      slots: n.slots.map((s) =>
        s.id === slot.id ? { ...s, filled: true, childNodeId: nodeId } : s,
      ),
    }))
    // Auto-progress: the writer's choice immediately advances the story
    goToNode(nodeId)
  }

  const pageNumber = history.length + 1

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-4xl mx-auto">
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
            {story.resources.map((resDef) => {
              const val = resources[resDef.name] ?? resDef.defaultValue
              return (
                <div
                  key={resDef.name}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-sans border bg-white/5"
                  style={{
                    borderColor: 'oklch(0.50 0.06 60 / 15%)',
                  }}
                >
                  <span className="opacity-45">{resDef.name}:</span>
                  <span className="font-semibold text-amber-300">{val}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="w-full">
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
        </div>
      )}

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
            <div className="book-page page-texture p-8 lg:p-12 min-h-[560px] md:min-h-[640px] h-auto max-h-[850px] flex flex-col relative">
              <div
                className="absolute top-4 left-4 w-8 h-8 opacity-15 pointer-events-none select-none"
                style={{ backgroundImage: 'radial-gradient(circle at top left, oklch(0.45 0.10 60) 0%, transparent 70%)' }}
              />
              <StoryContent content={node.content} depth={node.depth} choiceText={node.choiceText} imageUrl={node.imageUrl} />
              <p className="mt-4 text-center text-[10px] font-sans opacity-20 tracking-widest select-none">
                — {pageNumber * 2 - 1} —
              </p>
            </div>

            <div className="book-spine hidden md:block" />

            <div className="book-page page-texture p-8 lg:p-12 min-h-[560px] md:min-h-[640px] h-auto max-h-[850px] flex flex-col relative">
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

      <p className="text-[11px] text-muted-foreground/30 font-sans tracking-wide">
        {story.title} · {story.authorName} · {story.nodeCount}{' '}
        {story.nodeCount === 1 ? 'chapter' : 'chapters'}
      </p>
    </div>
  )
}
