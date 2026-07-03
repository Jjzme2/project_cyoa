/**
 * Serialize an object for embedding inside a <script type="application/ld+json">
 * block. Plain JSON.stringify does NOT escape `<`, so a value containing
 * `</script><script>...` would break out of the block and execute -- a classic
 * stored-XSS vector when any field is user- or AI-influenced. Escaping `<` (and
 * the U+2028/2029 line separators, which are legal JSON but illegal JS) keeps
 * the payload inert while remaining valid JSON-LD.
 */
export function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
