/**
 * Synthesized audio via the Web Audio API — a page-turn "fwip" and optional
 * looping ambient soundscapes — so there are no audio assets to ship. Sound is
 * always started from a user gesture (page turn / toggle), satisfying autoplay
 * policies. Ambient defaults OFF.
 */

import type { AmbientEffect } from '@/types'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

const MUTE_KEY = 'cyoa:page-sound-muted'

export function isPageSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setPageSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // ignore
  }
}

export function playPageTurn(): void {
  if (isPageSoundMuted()) return
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume().catch(() => {})

  const now = ac.currentTime
  const duration = 0.34

  // Decaying white noise = the paper rustle.
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration))
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    const t = i / frames
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2)
  }

  const src = ac.createBufferSource()
  src.buffer = buffer

  // Band-pass sweep up gives the "fwip" of a turning page.
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(850, now)
  bp.frequency.exponentialRampToValueAtTime(2600, now + duration)
  bp.Q.value = 0.7

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  src.connect(bp).connect(gain).connect(ac.destination)
  src.start(now)
  src.stop(now + duration)
}

// ─── Ambient soundscapes (looping, opt-in) ───────────────────────────────────

const AMBIENT_KEY = 'cyoa:ambient-on'

export function isAmbientOn(): boolean {
  try {
    return localStorage.getItem(AMBIENT_KEY) === '1'
  } catch {
    return false
  }
}

export function setAmbientOn(on: boolean): void {
  try {
    localStorage.setItem(AMBIENT_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

let ambient: { source: AudioBufferSourceNode; gain: GainNode } | null = null

function noiseBuffer(ac: AudioContext, seconds = 2): AudioBuffer {
  const frames = Math.max(1, Math.floor(ac.sampleRate * seconds))
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

export function stopAmbient(): void {
  if (!ambient) return
  try {
    ambient.source.stop()
  } catch {
    // already stopped
  }
  try {
    ambient.source.disconnect()
  } catch {
    // ignore
  }
  ambient = null
}

/** Start a low, looping soundscape matching the reading theme's ambient effect. */
export function startAmbient(effect: AmbientEffect): void {
  if (effect === 'none') return
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume().catch(() => {})

  stopAmbient()

  const source = ac.createBufferSource()
  source.buffer = noiseBuffer(ac, 2)
  source.loop = true

  const filter = ac.createBiquadFilter()
  const gain = ac.createGain()

  switch (effect) {
    case 'rain':
      filter.type = 'highpass'
      filter.frequency.value = 1100
      gain.gain.value = 0.05
      break
    case 'embers':
      filter.type = 'lowpass'
      filter.frequency.value = 480
      gain.gain.value = 0.06
      break
    case 'snow':
      filter.type = 'bandpass'
      filter.frequency.value = 5500
      filter.Q.value = 0.5
      gain.gain.value = 0.03
      break
    case 'stars':
      filter.type = 'bandpass'
      filter.frequency.value = 8000
      filter.Q.value = 0.7
      gain.gain.value = 0.025
      break
    case 'mist':
      filter.type = 'lowpass'
      filter.frequency.value = 320
      gain.gain.value = 0.045
      break
    case 'fireflies':
      filter.type = 'bandpass'
      filter.frequency.value = 2600
      filter.Q.value = 0.4
      gain.gain.value = 0.02
      break
    case 'petals':
      filter.type = 'highpass'
      filter.frequency.value = 900
      gain.gain.value = 0.025
      break
    case 'motes':
      filter.type = 'lowpass'
      filter.frequency.value = 700
      gain.gain.value = 0.022
      break
    case 'aurora':
      filter.type = 'bandpass'
      filter.frequency.value = 1400
      filter.Q.value = 0.3
      gain.gain.value = 0.02
      break
    case 'lightning':
      filter.type = 'lowpass'
      filter.frequency.value = 260
      gain.gain.value = 0.07
      break
    case 'moonbeams':
      filter.type = 'bandpass'
      filter.frequency.value = 3200
      filter.Q.value = 0.5
      gain.gain.value = 0.018
      break
    default:
      gain.gain.value = 0.03
  }

  source.connect(filter).connect(gain).connect(ac.destination)
  source.start()
  ambient = { source, gain }
}
