/**
 * Whether developer "mock" checkout is active — i.e. checkout that grants
 * credits / PREMIUM with NO real charge.
 *
 * Mock mode is ONLY ever available OUTSIDE production. In production the app
 * always uses real Stripe; a missing/placeholder key there does NOT enable mock
 * mode (payments fail cleanly instead of minting credits). Pure and
 * env-injected so the security-critical gate is unit-testable in isolation.
 */
export function computeStripeMocked(nodeEnv: string | undefined, secretKey: string | undefined): boolean {
  const keyLooksReal = !!secretKey && !secretKey.includes('placeholder')
  return nodeEnv !== 'production' && !keyLooksReal
}
