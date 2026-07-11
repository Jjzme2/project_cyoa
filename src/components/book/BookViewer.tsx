'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { AchievementUnlockToast } from './AchievementUnlockToast'
import { ChevronLeft, Sparkles, Volume2, VolumeX, Waves, Trophy, Users, Map as MapIcon } from 'lucide-react'
import { StoryContent } from './StoryContent'
import { ChoiceSlots } from './ChoiceSlots'
import { NodeReactions } from './NodeReactions'
import { SaveSlotPicker, loadSaveSlots, getActiveSlotId, upsertSaveSlot } from './SaveSlotPicker'
import { SharePathButton } from './SharePathButton'
import { BeginSagaControl } from './BeginSagaControl'
import { LivingWorldPanel } from './LivingWorldPanel'
import { EndingReveal } from './EndingReveal'
import { WelcomeWhisper } from './WelcomeWhisper'
import { FirstSoundNotice } from './FirstSoundNotice'
import { BookmarkButton } from './BookmarkButton'
import { GalleryButton } from './GalleryButton'
import { AmbientBackground } from './AmbientBackground'
import { JourneyMap } from './JourneyMap'
import { PalCompanion } from './PalCompanion'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'
import { trackEvent } from '@/lib/track-client'
import { CreatorResourceManager } from '@/lib/creator-resources'
import { EconomyManager } from '@/lib/engine/economy-manager'
import {
  playPageTurn,
  isPageSoundMuted,
  setPageSoundMuted,
  startAmbient,
  stopAmbient,
  isAmbientOn,
  setAmbientOn,
} from '@/lib/page-sound'
import { ACHIEVEMENT_DEFS } from '@/types'
import type { Story, StoryNode, ChoiceSlot, ChoiceEffect, SaveSlot, WorldBible, AmbientEffect } from '@/types'
import {
  type DiscoveredEnding,
  type Direction,
  loadDiscoveredEndings,
  saveDiscoveredEndings,
  isEndingNode,
  PAGE_PALETTES,
  pageVariants,
  pageTransition,
  loadLocalProgress,
  saveLocalProgress,
  resolveAmbientSound,
  resolveAmbientVisual,
} from './book-viewer-internals'
import { CastDialog, EndingsDialog, MapDialog } from './ReaderDialogs'

interface Props {
  story: Story
  initialNode: StoryNode
  endingCount?: number
  worldGenesis?: WorldBible
  worldSeed?: number
  /** The story's world's default ambient — inherited when the story has none of its own. */
  worldAmbientEffect?: AmbientEffect
}


export function BookViewer({ story, initialNode, endingCount, worldGenesis, worldSeed, worldAmbientEffect }: Props) {
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
  const [castOpen, setCastOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const hasMap = !!worldGenesis?.regions && worldGenesis.regions.length > 0
  // Locations the reader has passed through, plus where they are now.
  const visitedLocations = [...history, node]
    .map((n) => n.location)
    .filter((l): l is string => !!l)
  const [showInitialChoices, setShowInitialChoices] = useState(false)
  const [pendingChoices, setPendingChoices] = useState<Record<string, string>>({})
  // Mobile split viewer: below md the spread can't fit side by side, so the
  // reader sees ONE page at a time — story first, then a page turn to the
  // choices. Keyed by node id so every new chapter derives back to 'story'
  // without an effect; md+ ignores this entirely and shows both pages.
  const [mobileView, setMobileView] = useState<{ nodeId: string; page: 'story' | 'choices' }>({
    nodeId: initialNode.id,
    page: 'story',
  })
  const mobilePage = mobileView.nodeId === node.id ? mobileView.page : 'story'
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openedTrackedRef = useRef<string | null>(null)
  // Tracks the deepest chapter depth we've reported for the current story, so
  // the drop-off signal fires once per new personal best (not per page turn).
  const depthTrackedRef = useRef<{ storyId: string; maxDepth: number }>({ storyId: '', maxDepth: -1 })

  // Analytics: a reader opened this story. Fire once per story id, once we have
  // an authenticated user (the track endpoint requires auth).
  useEffect(() => {
    if (!user || openedTrackedRef.current === story.id) return
    openedTrackedRef.current = story.id
    void trackEvent(user, 'story.opened', {
      props: { storyId: story.id, worldId: story.worldId, source: 'solo' },
    })
  }, [user, story.id, story.worldId])

  // Analytics: how deep the reader gets before they leave. Emitting only on a new
  // maximum depth keeps this to a handful of events per read while still giving a
  // depth histogram to answer "where do readers drop off".
  useEffect(() => {
    if (!user) return
    const tracked = depthTrackedRef.current
    if (tracked.storyId !== story.id) {
      tracked.storyId = story.id
      tracked.maxDepth = -1
    }
    if (node.depth <= tracked.maxDepth) return
    tracked.maxDepth = node.depth
    void trackEvent(user, 'chapter.reached', {
      props: { storyId: story.id, nodeId: node.id, depth: node.depth },
    })
  }, [user, node, story.id])

  const hasCast = !!story.protagonist?.name || (story.characters?.length ?? 0) > 0

  // An untouched story inherits its world's default ambient (visual and,
  // via 'match'/'auto', sound too).
  const ambientEffect = resolveAmbientVisual(story.readingTheme, worldAmbientEffect)
  // The sound can diverge from the visual: in 'auto' mode it follows this
  // chapter's own detected scene cue (falling back to the visual when the
  // current chapter has none), or it can be silenced outright — see
  // resolveAmbientSound.
  const ambientSound = resolveAmbientSound(story.readingTheme, node.sceneAmbient, worldAmbientEffect)

  // Start/stop the looping soundscape with the toggle (and clean up on unmount).
  // Delayed slightly: ambient can auto-start from a preference saved in a PRIOR
  // session, with no fresh gesture — the short delay gives FirstSoundNotice
  // (shown ~300ms after mount) time to be on screen before audio actually begins.
  useEffect(() => {
    if (!(ambientOn && ambientSound !== 'none')) return
    const id = setTimeout(() => startAmbient(ambientSound), 500)
    return () => {
      clearTimeout(id)
      stopAmbient()
    }
  }, [ambientOn, ambientSound])

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
    const isNew = !prev.some((e) => e.id === n.id)
    // Analytics: track every ending reached (with whether it's a first discovery),
    // so we can see completion vs where readers drop off.
    void trackEvent(user, 'ending.reached', {
      props: { storyId: story.id, nodeId: n.id, isNew },
    })
    if (!isNew) return
    const next = [...prev, {
      id: n.id,
      excerpt: (n.content || '').slice(0, 140),
      ...(n.endingTitle ? { title: n.endingTitle } : {}),
      ...(n.endingType ? { type: n.endingType } : {}),
    }]
    saveDiscoveredEndings(story.id, next)
    setDiscoveredEndings(next)
    toast.success(endingCount ? `Ending discovered! (${next.length}/${endingCount})` : 'Ending discovered!')

    // A definitive, authored ending may earn narrative achievements — award them
    // server-side (which re-verifies the node) and celebrate any new ones.
    if (n.isEnding && user) {
      void (async () => {
        try {
          const token = await user.getIdToken()
          const res = await fetch('/api/achievements/ending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ storyId: story.id, nodeId: n.id }),
          })
          if (!res.ok) return
          const { newlyEarned }: { newlyEarned: string[] } = await res.json()
          for (const id of newlyEarned ?? []) {
            const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
            if (def) toast.custom(() => <AchievementUnlockToast icon={def.icon} name={def.name} />, { duration: 4500 })
          }
        } catch {
          /* best-effort */
        }
      })()
    }
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
          } else if (r.type === 'boolean') {
            initial[r.name] = r.defaultValue === true || r.defaultValue === 'true' ? 'true' : 'false'
          } else {
            initial[r.name] = String(r.defaultValue || '')
          }
        })
        setResources(initial)

        const initChoiceResources = story.resources.filter(
          (r) => r.isInitialChoice && r.choices && r.choices.length > 0,
        )
        if (initChoiceResources.length > 0) {
          const defaults: Record<string, string> = {}
          initChoiceResources.forEach((r) => { defaults[r.name] = r.choices![0] })
          setPendingChoices(defaults)
          setShowInitialChoices(true)
        }
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

  async function goToNode(nodeId: string, effects?: ChoiceEffect[], historyNode?: StoryNode) {
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
      }

      // Apply economy-linked resource effects if the node has economy state
      if (story.economyEffects && story.economyEffects.length > 0 && data.node.engineState?.economy) {
        const ecoEffects = EconomyManager.computeEconomyEffects(data.node.engineState.economy, story.economyEffects)
        if (ecoEffects.length > 0) {
          updatedResources = CreatorResourceManager.applyEffects(ecoEffects, updatedResources, story.resources)
          const changed = ecoEffects.map((e) => `${e.resourceName} ${e.operator} ${e.value}`).join(', ')
          toast.info(`Market conditions: ${changed}`)
        }
      }

      const resourcesChanged = updatedResources !== resources || (effects && effects.length > 0)
      if (resourcesChanged) {
        setResourcesHistory(nextResHistory)
        setResources(updatedResources)
      } else {
        setResourcesHistory(nextResHistory)
      }

      const nodeToSave = historyNode ?? node
      setHistory((h) => {
        const next = [...h, nodeToSave]
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

    const newHistory = history.slice(0, -1)
    const prevRes = resourcesHistory.at(-1)
    const newResHistory = prevRes ? resourcesHistory.slice(0, -1) : resourcesHistory
    const newResources = prevRes ?? resources

    setHistory(newHistory)
    setResourcesHistory(newResHistory)
    if (prevRes) setResources(prevRes)

    if (prev.content) {
      setNode(prev)
      persistProgress(prev.id, newHistory, newResources, newResHistory)
    } else {
      // Node was restored from ID without content — fetch it without touching history
      setFetchingNode(true)
      fetchNode(prev.id)
        .then(async (res) => {
          if (!res.ok) throw new Error()
          const data = await res.json()
          setNode(data.node)
          persistProgress(data.node.id, newHistory, newResources, newResHistory)
        })
        .catch(() => toast.error('Could not load that page.'))
        .finally(() => setFetchingNode(false))
    }
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
    const updatedNode: StoryNode = {
      ...node,
      slots: node.slots.map((s) => (s.id === slot.id ? { ...s, filled: true, childNodeId: nodeId } : s)),
    }
    setNode(updatedNode)
    goToNode(nodeId, undefined, updatedNode)
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

  /** Flip the mobile viewer between the story page and the choices page. */
  function turnMobilePage(page: 'story' | 'choices') {
    if (page === mobilePage) return
    if (soundOn) playPageTurn()
    setMobileView({ nodeId: node.id, page })
  }

  const pageNumber = history.length + 1
  const palette = PAGE_PALETTES[story.readingTheme?.pageStyle ?? 'parchment'] ?? PAGE_PALETTES.parchment

  function confirmInitialChoices() {
    setResources((prev) => ({ ...prev, ...pendingChoices }))
    setShowInitialChoices(false)
  }

  const initialChoiceResources = (story.resources ?? []).filter(
    (r) => r.isInitialChoice && r.choices && r.choices.length > 0,
  )

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-4xl mx-auto">
      <AmbientBackground effect={ambientEffect} />
      <FirstSoundNotice />
      <WelcomeWhisper />

      {/* Initial choice overlay — shown once before story begins */}
      {showInitialChoices && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border p-8 space-y-7"
            style={{
              background: palette.bg,
              borderColor: `${palette.text}30`,
              color: palette.text,
            }}
          >
            <div className="text-center space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-sans">
                Before you begin
              </p>
              <h2
                className="text-xl font-bold"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Shape your journey
              </h2>
              <p className="text-[13px] opacity-55">
                These choices will define your path through the story.
              </p>
            </div>

            <div className="space-y-6">
              {initialChoiceResources.map((resDef) => (
                <div key={resDef.name} className="space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">
                      {resDef.icon && <span className="mr-1.5">{resDef.icon}</span>}
                      {resDef.description || resDef.name}
                    </p>
                    <p className="text-[11px] opacity-40 font-sans">Choose one:</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {resDef.choices!.map((choice) => {
                      const selected = pendingChoices[resDef.name] === choice
                      const accent = resDef.color ?? '#fbbf24'
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setPendingChoices((p) => ({ ...p, [resDef.name]: choice }))}
                          className="px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left"
                          style={{
                            background: selected ? `${accent}22` : `${palette.text}08`,
                            borderColor: selected ? `${accent}80` : `${palette.text}20`,
                            color: selected ? accent : palette.text,
                            boxShadow: selected ? `inset 3px 0 0 ${accent}` : undefined,
                          }}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={confirmInitialChoices}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: palette.text,
                color: palette.bg,
              }}
            >
              Begin your adventure
            </button>
          </div>
        </div>
      )}

      {/* Resources bar */}
      {story.resources && story.resources.length > 0 && (
        <div
          className="w-full p-3 rounded-xl border flex flex-wrap gap-3 items-center"
          style={{
            background: 'oklch(0.92 0.02 80 / 55%)',
            borderColor: 'oklch(0.50 0.06 60 / 25%)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-500/70 tracking-wider uppercase font-sans shrink-0">
            <Sparkles className="h-3 w-3" />
            Resources
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            {story.resources.filter((r) => !r.hidden).map((resDef) => {
              const val = resources[resDef.name] ?? resDef.defaultValue
              const accent = resDef.color ?? '#fbbf24'
              const displayAs = resDef.displayAs ?? (
                resDef.type === 'boolean' ? 'checkbox' :
                resDef.type === 'array'   ? 'badge'    : 'value'
              )

              if (displayAs === 'bar' && resDef.type === 'number') {
                const numVal = Number(val)
                const min = resDef.min ?? 0
                const max = resDef.max ?? 100
                const pct = max > min
                  ? Math.min(100, Math.max(0, ((numVal - min) / (max - min)) * 100))
                  : 0
                return (
                  <div
                    key={resDef.name}
                    title={resDef.description}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans border bg-white/5"
                    style={{ borderColor: 'oklch(0.50 0.06 60 / 15%)' }}
                  >
                    {resDef.icon && <span className="text-sm leading-none">{resDef.icon}</span>}
                    <span className="opacity-50 text-[10px]">{resDef.name}</span>
                    <div className="w-16 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, background: accent }}
                      />
                    </div>
                    <span className="font-semibold text-[10px]" style={{ color: accent }}>
                      {numVal}{max ? `/${max}` : ''}
                    </span>
                  </div>
                )
              }

              if (displayAs === 'checkbox' || resDef.type === 'boolean') {
                const checked = val === 'true'
                return (
                  <div
                    key={resDef.name}
                    title={resDef.description}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans border bg-white/5"
                    style={{ borderColor: 'oklch(0.50 0.06 60 / 15%)' }}
                  >
                    {resDef.icon && <span className="text-sm leading-none">{resDef.icon}</span>}
                    <div
                      className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                      style={{
                        background: checked ? accent : 'transparent',
                        borderColor: checked ? accent : 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {checked && <span className="text-[8px] text-black font-bold leading-none">✓</span>}
                    </div>
                    <span className={checked ? 'opacity-80' : 'opacity-40'} style={{ color: checked ? accent : undefined }}>
                      {resDef.name}
                    </span>
                  </div>
                )
              }

              if (displayAs === 'badge' || resDef.type === 'array') {
                const items = Array.isArray(val) ? val as string[] : []
                return (
                  <div
                    key={resDef.name}
                    title={resDef.description}
                    className="flex items-center gap-1 flex-wrap"
                  >
                    {resDef.icon && <span className="text-sm leading-none">{resDef.icon}</span>}
                    <span className="text-[10px] opacity-40 font-sans">{resDef.name}:</span>
                    {items.length === 0 ? (
                      <span className="text-[10px] opacity-25 font-sans italic">empty</span>
                    ) : items.map((item) => (
                      <span
                        key={item}
                        className="px-1.5 py-0.5 rounded text-[10px] font-sans border"
                        style={{ borderColor: `${accent}40`, color: accent, background: `${accent}12` }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )
              }

              // default: value display
              return (
                <div
                  key={resDef.name}
                  title={resDef.description}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans border bg-white/5"
                  style={{ borderColor: 'oklch(0.50 0.06 60 / 15%)' }}
                >
                  {resDef.icon && <span className="text-sm leading-none">{resDef.icon}</span>}
                  <span className="opacity-45">{resDef.name}:</span>
                  <span className="font-semibold" style={{ color: accent }}>
                    {Array.isArray(val) ? val.join(', ') || '—' : String(val)}
                  </span>
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
          {hasMap && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              title="World map"
              aria-label="World map"
              className="flex items-center justify-center h-8 w-8 rounded-full text-amber-400/50 hover:text-amber-300 transition-colors"
            >
              <MapIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setEndingsOpen(true)}
            title="Endings discovered"
            aria-label="Endings discovered"
            className="flex items-center gap-1 h-8 px-2 rounded-full text-amber-400/55 hover:text-amber-300 transition-colors text-xs font-sans"
          >
            <Trophy className="h-3.5 w-3.5" />
            {discoveredEndings.length}
            {endingCount ? `/${endingCount}` : ''}
          </button>
          {hasCast && (
            <button
              type="button"
              onClick={() => setCastOpen(true)}
              title="Cast of characters"
              aria-label="Cast of characters"
              className="flex items-center justify-center h-8 w-8 rounded-full text-amber-400/50 hover:text-amber-300 transition-colors"
            >
              <Users className="h-4 w-4" />
            </button>
          )}
          <GalleryButton storyId={story.id} />
          {ambientSound !== 'none' && (
            <button
              type="button"
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
            type="button"
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
          <BeginSagaControl
            storyId={story.id}
            nodeId={node.id}
            nodeHistory={history.map((n) => n.id)}
            isSaga={!!story.youMode}
            sagaBranches={node.sagaBranches}
          />
        </div>
      </div>

      {/* Breadcrumb */}
      <JourneyMap
        history={history}
        currentNode={node}
        onNavigate={(nodeId) => {
          setDirection('back')
          goToNode(nodeId)
          setHistory((h) => {
            const idx = h.findIndex((n) => n.id === nodeId)
            return idx >= 0 ? h.slice(0, idx) : h
          })
        }}
      />

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
            {/* Left page — story content + reactions (the only page below md while reading) */}
            <div
              className={`book-page page-texture p-6 sm:p-8 lg:p-12 min-h-[480px] md:min-h-[640px] h-auto max-h-[850px] flex-col relative ${
                mobilePage === 'story' ? 'flex' : 'hidden'
              } md:flex`}
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
              {/* Mobile: the reading flow's natural next step — turn to the facing page */}
              <button
                type="button"
                onClick={() => turnMobilePage('choices')}
                className="md:hidden mt-5 w-full py-2.5 rounded-xl border text-sm font-medium opacity-70 hover:opacity-100 active:opacity-100 transition-opacity"
                style={{ borderColor: 'color-mix(in oklab, var(--page-text) 30%, transparent)' }}
              >
                {node.isEnding ? 'Turn the page — the end awaits' : 'Turn the page — make your choice'}
              </button>
              <p className="mt-2 text-center text-[10px] font-sans opacity-20 tracking-widest select-none">
                — {pageNumber * 2 - 1} —
              </p>
            </div>

            <div className="book-spine hidden md:block" />

            {/* Right page — choices (its own page below md, reached by a page turn) */}
            <div
              className={`book-page page-texture p-6 sm:p-8 lg:p-12 min-h-[480px] md:min-h-[640px] h-auto max-h-[850px] flex-col relative ${
                mobilePage === 'choices' ? 'flex' : 'hidden'
              } md:flex`}
              style={{ '--page-bg': palette.bg, '--page-text': palette.text } as React.CSSProperties}
            >
              <div
                className="absolute top-4 right-4 w-8 h-8 opacity-15 pointer-events-none select-none"
                style={{ backgroundImage: 'radial-gradient(circle at top right, oklch(0.45 0.10 60) 0%, transparent 70%)' }}
              />
              {node.isEnding ? (
                <EndingReveal
                  storyId={story.id}
                  nodeId={node.id}
                  title={node.endingTitle ?? 'The End'}
                  type={node.endingType ?? 'bittersweet'}
                  discovered={discoveredEndings.length}
                  total={endingCount}
                />
              ) : (
                <>
                  {node.worldPulse && (
                    <div className="mb-4">
                      <LivingWorldPanel pulse={node.worldPulse} />
                    </div>
                  )}
                  <ChoiceSlots
                    storyId={story.id}
                    nodeId={node.id}
                    slots={node.slots}
                    onChoiceSelect={goToNode}
                    onSlotFilled={handleSlotFilled}
                    onModerated={refreshCurrentNode}
                    currentResources={resources}
                    storyResources={story.resources}
                    storyCharacters={story.characters}
                    protagonist={story.protagonist}
                    isSaga={!!story.youMode}
                    endingConditions={story.endingConditions}
                  />
                </>
              )}
              {/* Mobile: flip back to reread before committing to a choice */}
              <button
                type="button"
                onClick={() => turnMobilePage('story')}
                className="md:hidden mt-5 mx-auto flex items-center gap-1 text-xs font-sans opacity-50 hover:opacity-80 active:opacity-80 transition-opacity"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to the story
              </button>
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

      {/* Mobile page switcher — which side of the spread is open (md+ shows both) */}
      <div className="md:hidden flex items-center gap-1 rounded-full border border-amber-500/25 bg-background/60 backdrop-blur p-1">
        {(['story', 'choices'] as const).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => turnMobilePage(page)}
            aria-pressed={mobilePage === page}
            className={`px-4 py-1.5 rounded-full text-xs font-sans font-medium transition-colors ${
              mobilePage === page
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-muted-foreground/60 hover:text-foreground/80'
            }`}
          >
            {page === 'story'
              ? 'Story'
              : node.isEnding
                ? 'The End'
                : `Choices${node.slots.length > 0 ? ` (${node.slots.length})` : ''}`}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/50 font-sans tracking-wide">
        {story.title} · {story.authorName} · {story.nodeCount}{' '}
        {story.nodeCount === 1 ? 'chapter' : 'chapters'}
        {story.protagonist?.name ? ` · playing as ${story.protagonist.name}` : ''}
      </p>

      <CastDialog open={castOpen} onOpenChange={setCastOpen} story={story} />

      <MapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        genesis={worldGenesis}
        seed={worldSeed}
        currentLocation={node.location}
        visited={visitedLocations}
      />

      <EndingsDialog open={endingsOpen} onOpenChange={setEndingsOpen} discoveredEndings={discoveredEndings} endingCount={endingCount} />

      {/* Reader Pal, along for the read (signed-in only; dismissible; profile toggle).
          It feels the story too — high Living World tension frightens it. */}
      <PalCompanion depth={node.depth} isEnding={!!node.isEnding} tension={node.worldPulse?.tension} />
    </div>
  )
}
