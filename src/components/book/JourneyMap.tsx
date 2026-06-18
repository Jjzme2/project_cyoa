'use client'

import { ChevronRight } from 'lucide-react'
import type { StoryNode } from '@/types'

interface Props {
  history: StoryNode[]
  currentNode: StoryNode
  onNavigate: (nodeId: string) => void
}

export function JourneyMap({ history, currentNode, onNavigate }: Props) {
  if (history.length === 0) return null

  function label(node: StoryNode, idx: number) {
    return node.choiceText || `Ch. ${idx + 1}`
  }

  return (
    <nav
      aria-label="Story path"
      className="w-full flex items-center gap-0.5 text-[10px] font-sans overflow-x-auto py-1 scrollbar-none"
    >
      {history.map((node, idx) => (
        <span key={node.id} className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate(node.id)}
            title={node.content ? node.content.slice(0, 100) : label(node, idx)}
            className="max-w-[96px] truncate px-1.5 py-0.5 rounded text-amber-400/45 hover:text-amber-400/75 hover:bg-amber-400/8 transition-colors"
          >
            {label(node, idx)}
          </button>
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-amber-400/20" />
        </span>
      ))}
      <span className="shrink-0 px-1.5 py-0.5 text-amber-400/80 font-medium">
        {currentNode.choiceText || `Ch. ${history.length + 1}`}
      </span>
    </nav>
  )
}
