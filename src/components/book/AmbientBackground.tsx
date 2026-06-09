'use client'

import { useRef } from 'react'
import type { AmbientEffect } from '@/types'

interface Particle {
  left: number
  top: number
  delay: number
  duration: number
  size: number
  opacity: number
}

function useParticles(count: number): Particle[] {
  const ref = useRef<Particle[] | null>(null)
  if (!ref.current) {
    // Seeded pseudo-random so particles are stable across re-renders
    let seed = 42
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff
      return Math.abs(seed) / 0x7fffffff
    }
    ref.current = Array.from({ length: count }, () => ({
      left:     rng() * 100,
      top:      rng() * 100,
      delay:    rng() * 4,
      duration: 0.6 + rng() * 1.2,
      size:     0.5 + rng() * 1.5,
      opacity:  0.3 + rng() * 0.7,
    }))
  }
  return ref.current
}

function RainEffect() {
  const drops = useParticles(35)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {drops.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `-${p.size * 40}px`,
            width: `${p.size * 0.6}px`,
            height: `${p.size * 60 + 30}px`,
            background: `rgba(160,200,255,${p.opacity * 0.25})`,
            animationName: 'rain-fall',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

function EmbersEffect() {
  const sparks = useParticles(28)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {sparks.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: `${p.top * 0.3}%`,
            width: `${p.size * 3 + 2}px`,
            height: `${p.size * 3 + 2}px`,
            background: `radial-gradient(circle, rgba(255,${100 + Math.floor(p.opacity * 80)},0,${p.opacity * 0.9}) 0%, transparent 70%)`,
            animationName: 'ember-rise',
            animationTimingFunction: 'ease-out',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${2.5 + p.duration * 2}s`,
          }}
        />
      ))}
    </div>
  )
}

function StarsEffect() {
  const stars = useParticles(60)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {stars.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top:  `${p.top}%`,
            width:  `${p.size + 1}px`,
            height: `${p.size + 1}px`,
            background: `rgba(255,255,240,${p.opacity * 0.8})`,
            boxShadow: `0 0 ${p.size * 2}px rgba(255,255,200,${p.opacity * 0.5})`,
            animationName: 'star-twinkle',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${1.5 + p.duration * 2}s`,
          }}
        />
      ))}
    </div>
  )
}

function SnowEffect() {
  const flakes = useParticles(40)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {flakes.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top:  `-${p.size * 5}px`,
            width:  `${p.size * 3 + 2}px`,
            height: `${p.size * 3 + 2}px`,
            background: `rgba(220,235,255,${p.opacity * 0.75})`,
            animationName: 'snow-fall',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${2 + p.duration * 2}s`,
          }}
        />
      ))}
    </div>
  )
}

interface Props {
  effect: AmbientEffect
}

export function AmbientBackground({ effect }: Props) {
  if (effect === 'none') return null
  if (effect === 'rain')   return <RainEffect />
  if (effect === 'embers') return <EmbersEffect />
  if (effect === 'stars')  return <StarsEffect />
  if (effect === 'snow')   return <SnowEffect />
  return null
}
