// ─── Reader Pal — a deterministic, rule-based companion (NOT AI) ──────────────
//
// Levels up purely from the reader's total earned achievements (already-computed
// data, no new tracking needed) and reads a simple time-based mood from their
// last achievement activity. Flavor lines are picked deterministically from a
// canned pool — no randomness, no LLM, ever. The reader can reskin its species
// (appearance only — leveling logic is identical across species).

export type PetSpecies = 'bird' | 'dragon' | 'sprout'

export const PET_SPECIES: { id: PetSpecies; label: string }[] = [
  { id: 'bird', label: 'Bird' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'sprout', label: 'Sprout' },
]

export interface PetStage {
  level: number
  name: string
  emoji: string
  minAchievements: number
}

const STAGES: Record<PetSpecies, PetStage[]> = {
  bird: [
    { level: 1, name: 'Egg', emoji: '🥚', minAchievements: 0 },
    { level: 2, name: 'Hatchling', emoji: '🐣', minAchievements: 3 },
    { level: 3, name: 'Fledgling', emoji: '🐥', minAchievements: 6 },
    { level: 4, name: 'Soaring', emoji: '🦉', minAchievements: 10 },
    { level: 5, name: 'Legendary', emoji: '🦅', minAchievements: 15 },
  ],
  dragon: [
    { level: 1, name: 'Egg', emoji: '🥚', minAchievements: 0 },
    { level: 2, name: 'Hatchling', emoji: '🦎', minAchievements: 3 },
    { level: 3, name: 'Wyrmling', emoji: '🐊', minAchievements: 6 },
    { level: 4, name: 'Drake', emoji: '🐲', minAchievements: 10 },
    { level: 5, name: 'Legendary', emoji: '🐉', minAchievements: 15 },
  ],
  sprout: [
    { level: 1, name: 'Seed', emoji: '🌰', minAchievements: 0 },
    { level: 2, name: 'Sprout', emoji: '🌱', minAchievements: 3 },
    { level: 3, name: 'Budding', emoji: '🌿', minAchievements: 6 },
    { level: 4, name: 'Blooming', emoji: '🌸', minAchievements: 10 },
    { level: 5, name: 'Legendary', emoji: '🌳', minAchievements: 15 },
  ],
}

function stagesFor(species: PetSpecies): PetStage[] {
  return STAGES[species] ?? STAGES.bird
}

/** The highest stage the reader's achievement count qualifies for, in their chosen species. */
export function stageFor(species: PetSpecies, achievementsEarned: number): PetStage {
  const stages = stagesFor(species)
  let best = stages[0]
  for (const s of stages) {
    if (achievementsEarned >= s.minAchievements) best = s
  }
  return best
}

/** How many achievements still stand between this reader and their next stage (0 at max). */
export function achievementsToNextStage(species: PetSpecies, achievementsEarned: number): number {
  const next = stagesFor(species).find((s) => s.minAchievements > achievementsEarned)
  return next ? next.minAchievements - achievementsEarned : 0
}

/** The level-1 icon for each species, for a compact species-picker swatch. */
export function speciesPreviewEmoji(species: PetSpecies): string {
  return stagesFor(species)[0].emoji
}

export type PetMood = 'active' | 'idle'

/** Active if the reader has earned an achievement in the last 3 days, else idle. */
export function moodFor(lastActivityIso: string | undefined): PetMood {
  if (!lastActivityIso) return 'idle'
  const days = (Date.now() - new Date(lastActivityIso).getTime()) / 86_400_000
  return days <= 3 ? 'active' : 'idle'
}

const QUIPS: Record<PetMood, string[]> = {
  active: [
    'Ready for the next chapter!',
    'What happens next? I can’t wait.',
    'I love a good cliffhanger.',
    'You’re on a roll.',
  ],
  idle: [
    '...still here, whenever you’re ready.',
    'Dust is starting to gather. Just saying.',
    'Waiting patiently. Very patiently.',
    'A story doesn’t write itself. (It kind of does. But still.)',
  ],
}

/** A deterministic flavor line for the day — stable within a day, varies across days. */
export function quipFor(mood: PetMood, daySeedValue: number): string {
  const pool = QUIPS[mood]
  return pool[((daySeedValue % pool.length) + pool.length) % pool.length]
}

/** Days-since-epoch, for a stable daily seed with no Date-in-render weirdness. */
export function daySeed(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000)
}
