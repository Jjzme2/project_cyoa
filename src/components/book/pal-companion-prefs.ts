/**
 * Whether the Reader Pal companion accompanies the reader in the book view —
 * a purely client-side preference shared between the profile panel's toggle
 * and the in-reader companion. '1' = hidden ("stays home"); absent = shown.
 */
export const COMPANION_HIDDEN_KEY = 'pal_companion_hidden'

export function isCompanionHidden(): boolean {
  try {
    return localStorage.getItem(COMPANION_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

export function setCompanionHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(COMPANION_HIDDEN_KEY, '1')
    else localStorage.removeItem(COMPANION_HIDDEN_KEY)
  } catch {}
}
