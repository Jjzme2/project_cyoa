/**
 * Synthesized page-turn sound via the Web Audio API — a short band-passed noise
 * "fwip", so there's no audio asset to ship. Always triggered by a user gesture
 * (turning a page), which satisfies browser autoplay policies.
 */

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
