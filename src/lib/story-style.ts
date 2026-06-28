import type { WorldStyleOption } from '@/types'

/**
 * Keep only the story's style picks that match one of the world's offered
 * options (label present + value is an allowed choice). Returns null when
 * nothing valid remains, so callers can omit the field. Shared by the story
 * and saga creation routes.
 */
export function sanitizeStyleChoices(
  choices: Record<string, string> | undefined,
  options: WorldStyleOption[] | undefined,
): Record<string, string> | null {
  if (!choices || !options?.length) return null
  const out: Record<string, string> = {}
  for (const opt of options) {
    const picked = choices[opt.label]
    if (picked && opt.choices.includes(picked)) out[opt.label] = picked
  }
  return Object.keys(out).length > 0 ? out : null
}
