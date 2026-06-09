'use client'

import { useState, useRef, useEffect } from 'react'
import { Save, ChevronDown, Plus, Check, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SaveSlot } from '@/types'

const SAVES_KEY = (storyId: string) => `cyoa:saves:${storyId}`
const ACTIVE_KEY = (storyId: string) => `cyoa:active:${storyId}`

export function loadSaveSlots(storyId: string): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY(storyId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getActiveSlotId(storyId: string): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY(storyId))
  } catch {
    return null
  }
}

export function upsertSaveSlot(storyId: string, slot: SaveSlot): void {
  try {
    const slots = loadSaveSlots(storyId)
    const idx = slots.findIndex((s) => s.id === slot.id)
    if (idx >= 0) {
      slots[idx] = slot
    } else {
      slots.unshift(slot)
    }
    localStorage.setItem(SAVES_KEY(storyId), JSON.stringify(slots.slice(0, 8)))
    localStorage.setItem(ACTIVE_KEY(storyId), slot.id)
  } catch {}
}

interface Props {
  storyId: string
  activeSlotId: string | null
  onSwitchSlot: (slot: SaveSlot) => void
  onSaveAs: (name: string) => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function SaveSlotPicker({ storyId, activeSlotId, onSwitchSlot, onSaveAs }: Props) {
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<SaveSlot[]>([])
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSlots(loadSaveSlots(storyId))
  }, [storyId, open])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setNaming(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const activeSlot = slots.find((s) => s.id === activeSlotId)

  function handleSaveAs() {
    if (!newName.trim()) return
    onSaveAs(newName.trim())
    setNewName('')
    setNaming(false)
    setOpen(false)
    setTimeout(() => setSlots(loadSaveSlots(storyId)), 100)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] font-sans text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors px-2 py-1 rounded border border-white/[0.06] hover:border-white/10 bg-white/[0.02]"
        title="Save slots"
      >
        <Save className="h-3 w-3" />
        <span>{activeSlot?.name ?? 'Auto Save'}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-8 w-56 z-50 glass border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-sans font-semibold">
                Save Slots
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {slots.length === 0 ? (
                <p className="px-3 py-4 text-[11px] text-muted-foreground/30 text-center font-sans">
                  No named saves yet
                </p>
              ) : (
                slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => {
                      onSwitchSlot(slot)
                      setOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] last:border-0 ${
                      slot.id === activeSlotId ? 'bg-amber-500/[0.05]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {slot.id === activeSlotId && (
                          <Check className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                        )}
                        <span className="text-[11px] font-medium text-foreground/80 truncate">
                          {slot.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground/30 font-sans">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{timeAgo(slot.savedAt)}</span>
                        <span>·</span>
                        <span>p.{slot.nodeHistory.length + 1}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-white/[0.06] p-2">
              {naming ? (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
                    placeholder="Slot name…"
                    className="flex-1 h-7 text-[11px] px-2 rounded border border-white/10 bg-background text-foreground focus:outline-none focus:border-amber-500/40"
                  />
                  <button
                    onClick={handleSaveAs}
                    className="h-7 px-2 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] hover:bg-amber-500/30 transition-colors"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setNaming(true)}
                  className="w-full flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors py-1 font-sans"
                >
                  <Plus className="h-3 w-3" />
                  Save current position as…
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
