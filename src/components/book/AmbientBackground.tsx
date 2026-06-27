'use client'

import { useState } from 'react'
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
  // Lazy initial state: computed once and stable across re-renders. The fixed
  // seed keeps particles deterministic, so server and client render identically.
  const [particles] = useState<Particle[]>(() => {
    let seed = 42
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff
      return Math.abs(seed) / 0x7fffffff
    }
    return Array.from({ length: count }, () => ({
      left:     rng() * 100,
      top:      rng() * 100,
      delay:    rng() * 4,
      duration: 0.6 + rng() * 1.2,
      size:     0.5 + rng() * 1.5,
      opacity:  0.3 + rng() * 0.7,
    }))
  })
  return particles
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

function FirefliesEffect() {
  const flies = useParticles(26)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {flies.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size * 2 + 2}px`,
            height: `${p.size * 2 + 2}px`,
            background: `radial-gradient(circle, rgba(190,255,120,${p.opacity * 0.95}) 0%, rgba(120,200,40,0.15) 55%, transparent 75%)`,
            boxShadow: `0 0 ${p.size * 5 + 3}px rgba(170,255,90,${p.opacity * 0.6})`,
            animationName: 'firefly-drift',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${4 + p.duration * 4}s`,
          }}
        />
      ))}
    </div>
  )
}

function PetalsEffect() {
  const petals = useParticles(24)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {petals.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: `-${p.size * 5}px`,
            width: `${p.size * 6 + 4}px`,
            height: `${p.size * 5 + 3}px`,
            background: `rgba(255,${170 + Math.floor(p.opacity * 50)},200,${p.opacity * 0.7})`,
            borderRadius: '60% 0 60% 0',
            animationName: 'petal-fall',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${5 + p.duration * 4}s`,
          }}
        />
      ))}
    </div>
  )
}

function MistEffect() {
  const banks = useParticles(7)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {banks.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left - 30}%`,
            top: `${p.top}%`,
            width: `${p.size * 220 + 260}px`,
            height: `${p.size * 90 + 90}px`,
            background: `radial-gradient(ellipse, rgba(200,210,225,${p.opacity * 0.10}) 0%, transparent 70%)`,
            filter: 'blur(22px)',
            animationName: 'mist-drift',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${14 + p.duration * 10}s`,
          }}
        />
      ))}
    </div>
  )
}

function MotesEffect() {
  const motes = useParticles(34)
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {motes.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size + 1}px`,
            height: `${p.size + 1}px`,
            background: `rgba(255,240,210,${p.opacity * 0.6})`,
            boxShadow: `0 0 ${p.size * 2}px rgba(255,230,180,${p.opacity * 0.4})`,
            animationName: 'mote-float',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${p.delay}s`,
            animationDuration: `${7 + p.duration * 6}s`,
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
  switch (effect) {
    case 'rain':      return <RainEffect />
    case 'embers':    return <EmbersEffect />
    case 'stars':     return <StarsEffect />
    case 'snow':      return <SnowEffect />
    case 'fireflies': return <FirefliesEffect />
    case 'petals':    return <PetalsEffect />
    case 'mist':      return <MistEffect />
    case 'motes':     return <MotesEffect />
    default:          return null
  }
}
