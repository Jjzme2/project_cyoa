/**
 * Normalize a multiverse name into a stable, GLOBAL pool key.
 *
 * A multiverse is a public collective: anyone who names their world into the
 * same multiverse joins the same pool, regardless of author. The key is just the
 * normalized name, so "The Sugar Multiverse", "the  sugar  multiverse", and
 * "The-Sugar-Multiverse" all resolve to one shared pool. Cross-world echoes are
 * still strictly opt-in (a world only pools if its creator named it in) and
 * rating-gated downstream. Returns null when the name has no usable characters.
 */
export function toMultiverseId(name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || null
}
