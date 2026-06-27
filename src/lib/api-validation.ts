import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Shared request-body validation for API route handlers.
 *
 * Routes used to parse bodies ad hoc — a bare `await req.json()` (which throws
 * on malformed input and crashes the handler) followed by hand-rolled
 * `typeof x === 'string'` checks. This wraps both concerns in one place: a JSON
 * parse guard plus a zod schema, returning either the typed, validated data or a
 * ready-to-return 400 response.
 *
 * Usage:
 * ```ts
 * const parsed = await parseJson(req, MySchema)
 * if (!parsed.ok) return parsed.response
 * const { field } = parsed.data // fully typed
 * ```
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

/** Collapse a ZodError into a single human-readable, client-safe message. */
export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request body'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Parse and validate a JSON request body against a zod schema.
 *
 * Returns `{ ok: true, data }` with the schema's inferred type on success, or
 * `{ ok: false, response }` carrying a 400 `NextResponse` on malformed JSON or
 * a validation failure. The handler stays in control of the response — no
 * throwing.
 */
export async function parseJson<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<ParseResult<z.infer<T>>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: formatZodError(result.error) }, { status: 400 }),
    }
  }

  return { ok: true, data: result.data }
}

/**
 * Validate an already-parsed value (e.g. query params assembled into an object,
 * or a body parsed elsewhere) against a schema. Same return shape as
 * {@link parseJson} without the JSON-parse step.
 */
export function parseData<T extends z.ZodType>(
  value: unknown,
  schema: T,
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(value)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: formatZodError(result.error) }, { status: 400 }),
    }
  }
  return { ok: true, data: result.data }
}
