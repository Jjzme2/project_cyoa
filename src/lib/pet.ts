// ─── Reader Pal — a deterministic, rule-based companion (NOT AI) ──────────────
//
// v2: the pal grows from a "bond" XP score derived ENTIRELY from data the
// achievement system already tracks (stories read, paths written, endings,
// bonds, bounties, achievements earned) — no new tracking, no new writes on
// any hot path. Ten levels with per-species evolution stages, four time-based
// moods, and event-aware flavor lines for the in-reader companion. Everything
// here is a pure function of already-persisted counts plus a day seed — no
// randomness, no LLM, ever. Species are cosmetic; three are unlocked by
// specific achievements (same philosophy as avatar frames).

// ─── Species ──────────────────────────────────────────────────────────────────

export type PetSpecies = 'bird' | 'dragon' | 'sprout' | 'cat' | 'wisp' | 'leviathan' | 'dog' | 'bunny'

export interface PetSpeciesDef {
  id: PetSpecies
  label: string
  /** Achievement gate — absent means unlocked for everyone from the start. */
  requires?: { achievementId: string; hint: string }
}

export const PET_SPECIES: PetSpeciesDef[] = [
  { id: 'bird', label: 'Bird' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'sprout', label: 'Sprout' },
  { id: 'cat', label: 'Cat', requires: { achievementId: 'bookworm', hint: 'Read 10 different stories' } },
  { id: 'wisp', label: 'Wisp', requires: { achievementId: 'secret_keeper', hint: 'Discover a secret ending' } },
  { id: 'leviathan', label: 'Leviathan', requires: { achievementId: 'chronicler', hint: 'Contribute 50 story paths' } },
  { id: 'dog', label: 'Dog' },
  { id: 'bunny', label: 'Bunny', requires: { achievementId: 'trailblazer', hint: 'Discover 25 unique paths' } },
]

export function isSpeciesUnlocked(species: PetSpecies, earnedAchievements: string[]): boolean {
  const def = PET_SPECIES.find((s) => s.id === species)
  if (!def) return false
  return !def.requires || earnedAchievements.includes(def.requires.achievementId)
}

export function unlockedSpecies(earnedAchievements: string[]): PetSpecies[] {
  return PET_SPECIES.filter((s) => isSpeciesUnlocked(s.id, earnedAchievements)).map((s) => s.id)
}

/**
 * Adopting a NEW pal costs purchased credits (the kind achievements reward) —
 * your first pal is free, pals you already own are freely switchable, and
 * gated species additionally require their achievement. A pal is a companion,
 * not a costume.
 */
export const PAL_ADOPTION_COST = 20

// ─── Bond XP & levels ─────────────────────────────────────────────────────────

/** The already-tracked counts the pal grows from (subset of UserAchievements.counts). */
export interface PalCounts {
  contributions?: number
  storiesRead?: number
  bookmarks?: number
  worlds?: number
  stories?: number
  illustrations?: number
  endingsReached?: number
  sagasCreated?: number
  feedbackSubmitted?: number
  bountiesPosted?: number
  bountiesFilled?: number
  deepBonds?: number
  pathMilestones?: number
}

/**
 * Bond XP: a weighted sum of everything the reader/writer has done. Weights
 * favor finishing and connecting (endings, deep bonds, popular paths) over
 * volume, so the pal reflects a journey, not a grind.
 */
export function bondXp(achievementsEarned: number, counts: PalCounts): number {
  const c = counts
  return (
    achievementsEarned * 25 +
    (c.storiesRead ?? 0) * 10 +
    (c.contributions ?? 0) * 8 +
    (c.endingsReached ?? 0) * 12 +
    (c.worlds ?? 0) * 15 +
    (c.stories ?? 0) * 10 +
    (c.sagasCreated ?? 0) * 10 +
    (c.illustrations ?? 0) * 5 +
    (c.bookmarks ?? 0) * 2 +
    (c.feedbackSubmitted ?? 0) * 5 +
    (c.bountiesPosted ?? 0) * 5 +
    (c.bountiesFilled ?? 0) * 10 +
    (c.deepBonds ?? 0) * 15 +
    (c.pathMilestones ?? 0) * 20
  )
}

/** XP required to REACH each level (index 0 = level 1). Ten levels total. */
export const LEVEL_XP = [0, 30, 80, 160, 280, 450, 680, 980, 1360, 1840] as const
export const MAX_LEVEL = LEVEL_XP.length

export function levelFor(xp: number): number {
  let level = 1
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1
  }
  return level
}

export interface XpProgress {
  level: number
  /** XP accumulated inside the current level. */
  into: number
  /** XP still needed for the next level (0 at max level). */
  needed: number
  total: number
}

export function xpProgress(xp: number): XpProgress {
  const level = levelFor(xp)
  const base = LEVEL_XP[level - 1]
  if (level >= MAX_LEVEL) return { level, into: xp - base, needed: 0, total: xp }
  return { level, into: xp - base, needed: LEVEL_XP[level] - xp, total: xp }
}

// ─── Life stages ──────────────────────────────────────────────────────────────
//
// Every species grows through the SAME seven life stages — it hatches, then
// grows up from Baby — so art direction and sprite-sheet naming stay uniform
// across species (a per-stage sheet is `{species}-l{minLevel}.png`).

export interface PetStage {
  name: string
  emoji: string
  /** The bond level at which this stage begins. */
  minLevel: number
}

/** The universal life arc, in order. Shared by all species, present and future. */
export const LIFE_STAGES = ['Egg', 'Baby', 'Juvenile', 'Adolescent', 'Adult', 'Elder', 'Legendary'] as const

/** The bond level each life stage begins at (index-aligned with LIFE_STAGES).
 * Exported for the sprite system: per-stage sheets are named by these levels. */
export const STAGE_LEVELS = [1, 2, 3, 5, 7, 9, 10] as const

/** Each species' look at every life stage (index-aligned with LIFE_STAGES). */
const STAGE_EMOJI: Record<PetSpecies, string[]> = {
  bird: ['🥚', '🐣', '🐥', '🐦', '🕊️', '🦉', '🦅'],
  dragon: ['🥚', '🦎', '🐊', '🦖', '🐲', '🐉', '🔥'],
  sprout: ['🌰', '🌱', '🌿', '🪴', '🌷', '🌸', '🌳'],
  cat: ['🐾', '🐱', '🐈', '🐈‍⬛', '🐆', '🐯', '🦁'],
  wisp: ['✨', '💫', '🔮', '🌟', '☄️', '🌠', '🌌'],
  leviathan: ['🫧', '🐟', '🐠', '🐬', '🐳', '🐋', '🌊'],
  dog: ['🐾', '🐶', '🐕', '🦮', '🐕‍🦺', '🐺', '🌟'],
  bunny: ['🥚', '🐇', '🐰', '🐇', '🐰', '🐇', '🌙'],
}

function stageBands(species: PetSpecies): PetStage[] {
  const emoji = STAGE_EMOJI[species] ?? STAGE_EMOJI.bird
  return LIFE_STAGES.map((name, i) => ({ name, emoji: emoji[i], minLevel: STAGE_LEVELS[i] }))
}

/** The highest evolution stage this bond level qualifies for, in the chosen species. */
export function stageFor(species: PetSpecies, level: number): PetStage {
  const bands = stageBands(species)
  let best = bands[0]
  for (const s of bands) {
    if (level >= s.minLevel) best = s
  }
  return best
}

/** Bond levels remaining until the pal's next evolution (0 at final form). */
export function levelsToNextStage(species: PetSpecies, level: number): number {
  const next = stageBands(species).find((s) => s.minLevel > level)
  return next ? next.minLevel - level : 0
}

/** A recognizable mid-evolution icon for species-picker swatches (eggs all look alike). */
export function speciesPreviewEmoji(species: PetSpecies): string {
  return stageBands(species)[2].emoji
}

// ─── Moods ────────────────────────────────────────────────────────────────────

export type PetMood = 'thrilled' | 'active' | 'idle' | 'dozing'

/** Time-based mood from the reader's last achievement activity. */
export function moodFor(lastActivityIso: string | undefined, now: number = Date.now()): PetMood {
  if (!lastActivityIso) return 'idle'
  const days = (now - new Date(lastActivityIso).getTime()) / 86_400_000
  if (days <= 1) return 'thrilled'
  if (days <= 3) return 'active'
  if (days <= 14) return 'idle'
  return 'dozing'
}

export const MOOD_LABELS: Record<PetMood, string> = {
  thrilled: 'Thrilled',
  active: 'Content',
  idle: 'Waiting',
  dozing: 'Dozing',
}

// ─── Flavor lines ─────────────────────────────────────────────────────────────

const QUIPS: Record<PetMood, string[]> = {
  thrilled: [
    'THAT was a chapter. Do it again.',
    'I could not be prouder. Onward!',
    'We’re unstoppable today.',
    'Did you feel that plot twist? I felt that plot twist.',
    'New heights! New pages! New everything!',
    'I told the bookmarks about you. They’re impressed.',
  ],
  active: [
    'Ready for the next chapter!',
    'What happens next? I can’t wait.',
    'I love a good cliffhanger.',
    'You’re on a roll.',
    'I’ve been keeping our place. Shall we?',
    'The story misses you already.',
  ],
  idle: [
    '...still here, whenever you’re ready.',
    'Dust is starting to gather. Just saying.',
    'Waiting patiently. Very patiently.',
    'A story doesn’t write itself. (It kind of does. But still.)',
    'I reread our favorite part while you were gone.',
    'No rush. Stories keep.',
  ],
  dozing: [
    'zzz… oh! You’re back. I knew you’d come back.',
    '*stretches* …how long was I out?',
    'I dreamt we finished the story. Let’s make it real.',
    'The bookmark and I have become close friends.',
    'Was beginning to think you’d been written out.',
  ],
}

/** A deterministic flavor line for the day — stable within a day, varies across days. */
export function quipFor(mood: PetMood, daySeedValue: number): string {
  const pool = QUIPS[mood]
  return pool[((daySeedValue % pool.length) + pool.length) % pool.length]
}

/** In-reader moments the companion reacts to. */
export type PalEvent = 'chapter' | 'ending' | 'levelup' | 'scared' | 'pat'

const EVENT_QUIPS: Record<PalEvent, string[]> = {
  chapter: [
    'Ooh, turn the page, turn the page!',
    'I have a good feeling about this one.',
    'Bold choice. I respect it.',
    'Wait — don’t leave me on this cliffhanger.',
    'I’d have picked the same. Probably.',
    'The plot thickens. I love it when it thickens.',
  ],
  ending: [
    'We actually finished it. WE FINISHED IT.',
    'An ending! I’ll remember this one.',
    'What a ride. I need a minute.',
    '*applauds with whatever limbs I currently have*',
    'That’s one for the collection.',
  ],
  levelup: [
    'I… I feel different. Stronger. Shinier?',
    'Our bond grew — look at me now!',
    'Evolution complete. Please admire me.',
    'All those stories… they changed me.',
  ],
  scared: [
    'D-did you hear that?! …I’ll be right behind you.',
    'Hold the page closer, please.',
    'I’m not scared. YOU’RE scared.',
    'We survive this chapter together. Agreed?',
    '*peeks through paws* …tell me when it’s over.',
  ],
  pat: [
    '!! …do that again?',
    '*happy wiggle*',
    'Bond strengthened. I felt it.',
    'Best. Reader. Ever.',
    'Okay okay — NOW we can face anything.',
  ],
}

/** A deterministic event reaction — same seed, same line; vary the seed to vary the line. */
export function quipForEvent(event: PalEvent, seed: number): string {
  const pool = EVENT_QUIPS[event]
  return pool[((seed % pool.length) + pool.length) % pool.length]
}

// ─── Companion stats ──────────────────────────────────────────────────────────

export interface PalStats {
  storiesRead: number
  pathsWritten: number
  endingsWitnessed: number
  deepBonds: number
}

/** What the pal has "witnessed" at the reader's side — for the profile stat row. */
export function palStats(counts: PalCounts): PalStats {
  return {
    storiesRead: counts.storiesRead ?? 0,
    pathsWritten: counts.contributions ?? 0,
    endingsWitnessed: counts.endingsReached ?? 0,
    deepBonds: counts.deepBonds ?? 0,
  }
}

/** Days-since-epoch, for a stable daily seed with no Date-in-render weirdness. */
export function daySeed(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000)
}
