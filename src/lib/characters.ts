import type { Character, CharacterScope } from '@/types'

/**
 * Pure helpers for the first-class Character registry. Dependency-free so they
 * run on server, client, and in tests identically.
 *
 * A Character's identity is (scope, ownerId, normalized name): an author's named
 * hero is one identity across all THEIR stories (collectible), while a world's
 * canon figure is one identity across stories in that world. Same name under a
 * different owner stays a different character — no accidental merging.
 */

/** Normalize a name into a stable slug for ids and dedup. */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Deterministic document id for a character identity. */
export function characterId(scope: CharacterScope, ownerId: string, name: string): string {
  return `${scope}__${ownerId}__${slugifyName(name)}`
}

/** First-letters monogram (max 2) for the portrait fallback. */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** A stable, pleasant accent colour derived from the name (for the monogram bg). */
export function nameAccent(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h} 55% 45%)`
}

/** "Appeared in 3 stories across 2 worlds" — the collectible summary. */
export function appearanceSummary(c: Pick<Character, 'storyCount' | 'worldIds'>): string {
  const stories = `${c.storyCount} ${c.storyCount === 1 ? 'story' : 'stories'}`
  const worlds = c.worldIds.length
  if (worlds <= 1) return `Appeared in ${stories}`
  return `Appeared in ${stories} across ${worlds} worlds`
}

/** True when a character has crossed worlds — the multiverse-cameo signal. */
export function isCrossWorld(c: Pick<Character, 'worldIds'>): boolean {
  return c.worldIds.length > 1
}
