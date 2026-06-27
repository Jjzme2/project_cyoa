'use client'

import { useState } from 'react'
import type { AmbientEffect } from '@/types'

interface MiniParticle { left: number; top: number; delay: number; dur: number; size: number; op: number }

function useMiniParticles(count: number): MiniParticle[] {
  // Deterministic seed → identical server/client render (no hydration drift).
  const [p] = useState<MiniParticle[]>(() => {
    let seed = 7
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff
      return Math.abs(seed) / 0x7fffffff
    }
    return Array.from({ length: count }, () => ({
      left: rng() * 100,
      top: rng() * 100,
      delay: rng() * 3,
      dur: 0.6 + rng() * 1.4,
      size: 0.5 + rng() * 1.5,
      op: 0.3 + rng() * 0.7,
    }))
  })
  return p
}

/**
 * A box-contained version of the reader ambient effect, for previews and world
 * portals. Unlike the full-screen `AmbientBackground`, this fills its nearest
 * `relative` ancestor and uses container-scoped fall/rise animations.
 */
export function ContainedAmbient({ effect, density = 1 }: { effect: AmbientEffect; density?: number }) {
  const particles = useMiniParticles(effect === 'mist' ? Math.round(4 * density) : Math.round(16 * density))
  if (effect === 'none') return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => {
        const base: React.CSSProperties = {
          position: 'absolute',
          left: `${p.left}%`,
          animationIterationCount: 'infinite',
          animationDelay: `${p.delay}s`,
          animationTimingFunction: 'linear',
        }
        switch (effect) {
          case 'rain':
            return <span key={i} style={{ ...base, top: '-10%', width: 1, height: `${p.size * 8 + 6}px`, background: `rgba(160,200,255,${p.op * 0.4})`, animationName: 'mini-fall', animationDuration: `${0.5 + p.dur}s` }} />
          case 'snow':
            return <span key={i} className="rounded-full" style={{ ...base, top: '-10%', width: p.size * 2 + 1, height: p.size * 2 + 1, background: `rgba(220,235,255,${p.op * 0.8})`, animationName: 'mini-fall', animationDuration: `${1.6 + p.dur * 2}s` }} />
          case 'petals':
            return <span key={i} style={{ ...base, top: '-10%', width: p.size * 4 + 3, height: p.size * 3 + 2, background: `rgba(255,190,210,${p.op * 0.7})`, borderRadius: '60% 0 60% 0', animationName: 'mini-fall', animationDuration: `${1.8 + p.dur * 2}s` }} />
          case 'embers':
            return <span key={i} className="rounded-full" style={{ ...base, top: '90%', width: p.size * 2 + 2, height: p.size * 2 + 2, background: `radial-gradient(circle, rgba(255,150,40,${p.op}) 0%, transparent 70%)`, animationName: 'mini-rise', animationTimingFunction: 'ease-out', animationDuration: `${1.6 + p.dur * 2}s` }} />
          case 'stars':
            return <span key={i} className="rounded-full" style={{ ...base, top: `${p.top}%`, width: p.size + 1, height: p.size + 1, background: `rgba(255,255,240,${p.op})`, boxShadow: `0 0 ${p.size * 2}px rgba(255,255,200,0.6)`, animationName: 'star-twinkle', animationTimingFunction: 'ease-in-out', animationDuration: `${1.4 + p.dur * 2}s` }} />
          case 'fireflies':
            return <span key={i} className="rounded-full" style={{ ...base, top: `${p.top}%`, width: p.size * 2 + 2, height: p.size * 2 + 2, background: `radial-gradient(circle, rgba(190,255,120,${p.op}) 0%, transparent 70%)`, boxShadow: `0 0 ${p.size * 4}px rgba(170,255,90,0.5)`, animationName: 'firefly-drift', animationTimingFunction: 'ease-in-out', animationDuration: `${3 + p.dur * 3}s` }} />
          case 'motes':
            return <span key={i} className="rounded-full" style={{ ...base, top: `${p.top}%`, width: p.size + 1, height: p.size + 1, background: `rgba(255,240,210,${p.op * 0.7})`, animationName: 'mote-float', animationTimingFunction: 'ease-in-out', animationDuration: `${4 + p.dur * 3}s` }} />
          case 'mist':
            return <span key={i} className="rounded-full" style={{ ...base, top: `${p.top}%`, left: `${p.left - 20}%`, width: p.size * 60 + 70, height: p.size * 26 + 26, background: `radial-gradient(ellipse, rgba(200,210,225,${p.op * 0.18}) 0%, transparent 70%)`, filter: 'blur(8px)', animationName: 'mist-drift', animationTimingFunction: 'ease-in-out', animationDuration: `${6 + p.dur * 5}s` }} />
          default:
            return null
        }
      })}
    </div>
  )
}
