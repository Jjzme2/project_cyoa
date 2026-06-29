import { NextResponse } from 'next/server'

/**
 * Wrap a route handler so any unhandled exception becomes a clean JSON 500
 * instead of a framework error (which may not be JSON, breaking clients that
 * always `res.json()`). Validation/auth/business errors should still return
 * their own specific status from inside the handler — this is the safety net for
 * the unexpected (a thrown DB error, a null deref, an upstream timeout).
 *
 * Usage:
 *   export const POST = apiHandler(async (req, { params }) => { ... })
 *
 * Generic over the context arg so it composes with dynamic-route `{ params }`.
 */
export function apiHandler<Req extends Request, Ctx>(
  handler: (req: Req, ctx: Ctx) => Promise<Response> | Response,
): (req: Req, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      console.error('[api] Unhandled route error:', err)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
  }
}
