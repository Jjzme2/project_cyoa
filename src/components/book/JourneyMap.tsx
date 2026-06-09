'use client'

import { useState } from 'react'
import { Map, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StoryNode } from '@/types'

interface Props {
  history: StoryNode[]
  currentNode: StoryNode
  onNavigate: (nodeId: string) => void
}

export function JourneyMap({ history, currentNode, onNavigate }: Props) {
  const [open, setOpen] = useState(false)

  const total = history.length + 1

  if (total < 2) return null

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors font-sans w-full justify-center py-1"
      >
        <Map className="h-3 w-3" />
        Journey Map · {total} {total === 1 ? 'page' : 'pages'}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-3 glass-card rounded-xl p-4 space-y-1 max-h-64 overflow-y-auto">
          {/* Visited nodes */}
          {history.map((node, idx) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onNavigate(node.id)}
              className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors text-left group"
            >
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-sans font-bold mt-0.5"
                style={{
                  background: 'oklch(0.30 0.05 60 / 60%)',
                  color: 'oklch(0.75 0.12 75)',
                }}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                {node.choiceText && (
                  <p className="text-[9px] text-amber-400/50 font-sans uppercase tracking-wider truncate mb-0.5">
                    {node.choiceText}
                  </p>
                )}
                <p className="text-[11px] text-foreground/55 line-clamp-2 leading-relaxed group-hover:text-foreground/75 transition-colors"
                   style={{ fontFamily: 'Georgia, serif' }}>
                  {node.content
                    ? node.content.slice(0, 80) + (node.content.length > 80 ? '…' : '')
                    : `Chapter ${idx + 1}`}
                </p>
              </div>
            </button>
          ))}

          {/* Current node — not clickable */}
          <div className="w-full flex items-start gap-3 px-3 py-2 rounded-lg bg-amber-500/[0.07] border border-amber-500/20">
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
              style={{
                background: 'oklch(0.60 0.14 75 / 40%)',
              }}
            >
              <BookOpen className="h-2.5 w-2.5 text-amber-400" />
            </span>
            <div className="min-w-0 flex-1">
              {currentNode.choiceText && (
                <p className="text-[9px] text-amber-400/70 font-sans uppercase tracking-wider truncate mb-0.5">
                  {currentNode.choiceText}
                </p>
              )}
              <p className="text-[11px] text-foreground/80 line-clamp-2 leading-relaxed"
                 style={{ fontFamily: 'Georgia, serif' }}>
                {currentNode.content
                  ? currentNode.content.slice(0, 80) + (currentNode.content.length > 80 ? '…' : '')
                  : 'Current chapter'}
              </p>
              <p className="text-[8px] text-amber-400/40 mt-1 font-sans">You are here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
