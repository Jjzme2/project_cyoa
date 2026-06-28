'use client'

import { useState } from 'react'
import { ImageDown, Check, Loader2 } from 'lucide-react'

interface Props {
  /** Absolute or root-relative URL of the Share Card PNG route. */
  cardUrl: string
  /** Download filename (without extension). */
  filename: string
  /** Title used by the native share sheet when available. */
  shareTitle?: string
  label?: string
  className?: string
}

/**
 * Fetches a generated Share Card PNG and hands it to the OS share sheet when
 * available (mobile), otherwise downloads it. The artifact — not a link — is
 * the thing that travels, so this is the button that makes a story shareable.
 */
export function ShareImageButton({ cardUrl, filename, shareTitle, label = 'Share image', className }: Props) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle')

  async function handleClick() {
    if (state === 'working') return
    setState('working')
    try {
      const res = await fetch(cardUrl)
      if (!res.ok) throw new Error(`card ${res.status}`)
      const blob = await res.blob()
      const file = new File([blob], `${filename}.png`, { type: 'image/png' })

      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: shareTitle })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      setState('done')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      // Fall back to just opening the image so the user still gets the card.
      window.open(cardUrl, '_blank', 'noopener')
      setState('idle')
    }
  }

  return (
    <button
      onClick={handleClick}
      title="Save a shareable image"
      className={
        className ??
        'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors'
      }
    >
      {state === 'working' ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Preparing…</span>
        </>
      ) : state === 'done' ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-400">Ready!</span>
        </>
      ) : (
        <>
          <ImageDown className="h-3.5 w-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
