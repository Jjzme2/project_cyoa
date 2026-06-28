/**
 * Normalize a multiverse name into a stable pool key, scoped to its author.
 *
 * Pooling is deliberately author-scoped: your "Sugarverse" pools only YOUR
 * worlds, never a stranger's identically-named one — so cross-world content can
 * only ever flow between worlds the same person chose to link. Returns null when
 * the name has no usable characters (treated as "no multiverse").
 */
export function toMultiverseId(authorId: string, name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  if (!slug || !authorId) return null
  return `${authorId}:${slug}`
}
