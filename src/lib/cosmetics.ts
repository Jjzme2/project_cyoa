// ─── Profile cosmetics ──────────────────────────────────────────────────────

/** A profile avatar frame — purely cosmetic, unlocked by earning its achievement. */
export interface FrameSkin {
  id: string
  name: string
  /** Achievement id required to unlock this frame; null = always available. */
  unlockedBy: string | null
  /** Tailwind classes applied to the avatar's ring. */
  ringClassName: string
}

export const FRAME_SKINS: FrameSkin[] = [
  { id: 'default', name: 'Classic', unlockedBy: null, ringClassName: 'ring-2 ring-amber-500/30' },
  { id: 'bronze', name: 'Bronze', unlockedBy: 'first_step', ringClassName: 'ring-[3px] ring-orange-700/60' },
  { id: 'explorer', name: 'Explorer', unlockedBy: 'explorer', ringClassName: 'ring-[3px] ring-teal-400/60' },
  { id: 'storyteller', name: 'Storyteller', unlockedBy: 'storyteller', ringClassName: 'ring-[3px] ring-violet-400/60' },
  { id: 'ending', name: 'The End', unlockedBy: 'the_end', ringClassName: 'ring-[3px] ring-yellow-400/70 shadow-[0_0_12px_-2px] shadow-yellow-400/50' },
  { id: 'secret', name: 'Secret Keeper', unlockedBy: 'secret_keeper', ringClassName: 'ring-[3px] ring-purple-500/70 shadow-[0_0_12px_-2px] shadow-purple-500/50' },
  { id: 'pioneer', name: 'Path Pioneer', unlockedBy: 'path_pioneer', ringClassName: 'ring-[3px] ring-sky-400/70 shadow-[0_0_12px_-2px] shadow-sky-400/50' },
  { id: 'renowned', name: 'Renowned', unlockedBy: 'renowned', ringClassName: 'ring-[3px] ring-rose-400/70 shadow-[0_0_12px_-2px] shadow-rose-400/50' },
  {
    id: 'completionist',
    name: 'Completionist',
    unlockedBy: 'completionist',
    ringClassName: 'ring-[3px] ring-amber-300/80 shadow-[0_0_18px_-2px] shadow-fuchsia-400/60',
  },
]

export function findFrame(id: string | undefined): FrameSkin {
  return FRAME_SKINS.find((f) => f.id === id) ?? FRAME_SKINS[0]
}

/** Whether `earned` (a reader's earned achievement ids) unlocks `frame`. */
export function isFrameUnlocked(frame: FrameSkin, earned: string[]): boolean {
  return frame.unlockedBy === null || earned.includes(frame.unlockedBy)
}
