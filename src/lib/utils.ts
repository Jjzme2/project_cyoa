import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncate text at a word boundary so previews never cut mid-word
 * (e.g. "deem…", "peopl…"). Trailing punctuation is trimmed before
 * the ellipsis is appended.
 */
export function truncateAtWord(text: string, max: number, ellipsis = '…'): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed

  const slice = trimmed.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  // Fall back to the hard slice only for single very long words.
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice
  return cut.replace(/[\s.,;:!?—-]+$/, '') + ellipsis
}
