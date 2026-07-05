/**
 * Escape a single CSV cell.
 *
 * Two concerns:
 *  1. Structural — a value containing a comma, quote, or newline is wrapped in
 *     double quotes with embedded quotes doubled (RFC 4180).
 *  2. Formula injection — a value beginning with `= + - @` (or a tab/CR) is
 *     interpreted as a formula by Excel/Sheets, so it's prefixed with a single
 *     quote to neutralize it (OWASP). Applied before structural quoting.
 */
export function csvEscape(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}
