'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface Props {
  storyId: string
  nodeHistory: string[]
  currentNodeId: string
}

export function SharePathButton({ storyId, nodeHistory, currentNodeId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const path = [...nodeHistory, currentNodeId].join(',')
    const url = `${window.location.origin}/stories/${storyId}/share?path=${path}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button
      onClick={handleShare}
      title="Share this path"
      className="flex items-center gap-1 text-[10px] font-sans text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors px-2 py-1 rounded border border-white/[0.05] hover:border-white/10 bg-white/[0.01]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-3 w-3" />
          <span>Share path</span>
        </>
      )}
    </button>
  )
}
