import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { setFeedbackStatus } from '@/lib/firestore-helpers'
import { insights } from '@/lib/telemetry'
import { FEEDBACK_STATUSES } from '@/types'

const StatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  adminNote: z.string().trim().max(500).optional(),
  // Priority tier for the coding-agent export: 0 (do first) … 3 (someday).
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
})

/** Admin-only: triage a feedback item (set its status + optional note). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJson(req, StatusSchema)
  if (!parsed.ok) return parsed.response
  const { id } = await params
  const { status, adminNote, tier } = parsed.data

  await setFeedbackStatus(id, status, adminNote, tier)
  await insights.track('feedback.triaged', { uid: auth.uid, props: { feedbackId: id, status, tier } })

  return NextResponse.json({ ok: true })
}
