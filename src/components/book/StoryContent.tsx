'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import Image from 'next/image'
import { ImagePlus, Volume2, Pause, Play, Square } from 'lucide-react'

interface Props {
  content: string
  depth: number
  choiceText?: string | null
  imageUrl?: string | null
}

type SpeechStatus = 'idle' | 'playing' | 'paused'

/**
 * Split prose into short utterances (sentence-grouped, ~220 chars). Browsers —
 * Chrome especially — silently cut off a single long utterance after ~15s, so
 * speaking many small ones in sequence keeps narration reliable to the end.
 */
function toSpeechChunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*\s*/g) ?? [text]
  const chunks: string[] = []
  let buf = ''
  for (const s of sentences) {
    if ((buf + s).length > 220 && buf) {
      chunks.push(buf.trim())
      buf = ''
    }
    buf += s
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks
}

/** Reads a chapter aloud via the Web Speech API, with play/pause and stop. */
function ListenControl({ text }: { text: string }) {
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<SpeechStatus>('idle')
  // Pending chunks left to speak.
  const remaining = useRef<string[]>([])
  // Bumped on every start/stop so a stale onend (fired by cancel()) can't
  // advance a queue that's already been replaced or torn down.
  const epoch = useRef(0)

  useEffect(() => {
    // Defer out of the synchronous effect body (avoids cascading-render lint).
    const id = setTimeout(
      () => setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window),
      0,
    )
    return () => clearTimeout(id)
  }, [])

  // Stop narration whenever the chapter text changes or the view unmounts —
  // otherwise the old chapter keeps reading over the new one. Clearing the queue
  // first means the cancel()-triggered onend finds nothing to speak.
  useEffect(() => {
    const queue = remaining
    return () => {
      queue.current = []
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [text])

  function stop() {
    epoch.current++
    remaining.current = []
    window.speechSynthesis.cancel()
    setStatus('idle')
  }

  function speakNext(myEpoch: number) {
    if (myEpoch !== epoch.current) return
    const next = remaining.current.shift()
    if (!next) {
      setStatus('idle')
      return
    }
    const u = new SpeechSynthesisUtterance(next)
    u.rate = 0.96 // a hair slower than default reads as narration
    u.onend = () => speakNext(myEpoch)
    window.speechSynthesis.speak(u)
  }

  function start() {
    const myEpoch = ++epoch.current
    window.speechSynthesis.cancel()
    remaining.current = toSpeechChunks(text)
    setStatus('playing')
    // Defer so the cancel() above fully clears the queue first (Safari quirk).
    setTimeout(() => speakNext(myEpoch), 0)
  }

  function toggle() {
    if (status === 'playing') {
      window.speechSynthesis.pause()
      setStatus('paused')
    } else if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
    } else {
      start()
    }
  }

  if (!supported) return null

  const idle = status === 'idle'
  return (
    <span className="inline-flex items-center gap-1 font-sans">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 transition-opacity hover:opacity-100"
        style={{
          color: 'var(--page-text)',
          opacity: idle ? 0.55 : 0.9,
          border: '1px solid color-mix(in oklch, var(--page-text) 22%, transparent)',
        }}
        aria-label={idle ? 'Listen to this chapter' : status === 'playing' ? 'Pause narration' : 'Resume narration'}
      >
        {idle ? (
          <Volume2 className="h-3 w-3" />
        ) : status === 'playing' ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {idle ? 'Listen' : status === 'playing' ? 'Pause' : 'Resume'}
      </button>
      {!idle && (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center rounded px-1 py-0.5 transition-opacity hover:opacity-100"
          style={{ color: 'var(--page-text)', opacity: 0.6 }}
          aria-label="Stop narration"
        >
          <Square className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

// Staggers each paragraph's own reveal rather than fading the whole chapter
// in as one flat block — the text unfurls, beat by beat.
const paragraphContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
}
const paragraphReveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export function StoryContent({ content, depth, choiceText, imageUrl }: Props) {
  const paragraphs = content.split('\n').filter((p) => p.trim())

  return (
    <motion.div
      key={content}
      initial="hidden"
      animate="visible"
      variants={paragraphContainer}
      className="flex flex-col h-full overflow-hidden"
    >
      {choiceText && (
        <motion.p variants={paragraphReveal} className="text-xs italic mb-5 pb-4 border-b border-amber-900/20 opacity-55">
          ❝ {choiceText} ❞
        </motion.p>
      )}

      <motion.div variants={paragraphReveal} className="flex items-center justify-between mb-4">
        <p className="text-[9px] uppercase tracking-[0.25em] opacity-35 font-sans">
          Chapter {depth + 1}
        </p>
        <div className="flex items-center gap-2">
          <ListenControl text={content} />
          {imageUrl && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans font-medium tracking-wider uppercase border select-none"
              style={{
                background: 'oklch(0.40 0.12 140 / 12%)',
                borderColor: 'oklch(0.45 0.12 140 / 25%)',
                color: 'oklch(0.48 0.12 140)',
              }}
            >
              <ImagePlus className="h-2.5 w-2.5" />
              Illustrated
            </span>
          )}
        </div>
      </motion.div>

      {imageUrl && (
        <motion.div variants={paragraphReveal} className="relative w-full mb-4 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <Image
            src={imageUrl}
            alt="Story illustration"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {paragraphs.map((p, i) => (
          <motion.p
            key={i}
            variants={paragraphReveal}
            className="text-[15px] leading-[1.9]"
            style={{ textIndent: i === 0 ? '1.5em' : undefined }}
          >
            {p}
          </motion.p>
        ))}
      </div>

      <div className="mt-6 text-center opacity-20 select-none text-sm">❧</div>
    </motion.div>
  )
}
