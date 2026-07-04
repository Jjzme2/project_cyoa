import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { listFeedback } from '@/lib/firestore-helpers'
import { sortForExport, isFeedbackType, isFeedbackStatus } from '@/lib/feedback'

/**
 * Admin-only: export feedback as a JSON task list to hand to an AI coding agent.
 * Filterable by `type` and `status` (comma-separated). Defaults to the
 * actionable backlog: bug + feature items that are open / planned / in progress.
 * Returned as a download.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const typeFilter = (url.searchParams.get('type')?.split(',').filter(isFeedbackType)) ?? ['bug', 'feature']
  const statusFilter =
    url.searchParams.get('status')?.split(',').filter(isFeedbackStatus) ?? ['open', 'planned', 'in_progress']

  // Optional ?tier=0,1 narrows to specific priority tiers.
  const tierParam = url.searchParams.get('tier')
  const tierFilter = tierParam
    ? new Set(tierParam.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 3))
    : null

  const items = sortForExport(await listFeedback()).filter(
    (f) =>
      typeFilter.includes(f.type) &&
      statusFilter.includes(f.status) &&
      (!tierFilter || (f.tier !== undefined && tierFilter.has(f.tier))),
  )

  const tasks = items.map((f) => ({
    id: f.id,
    tier: f.tier ?? null,
    type: f.type,
    title: f.title,
    detail: f.body,
    status: f.status,
    votes: f.votes,
    createdAt: f.createdAt,
  }))

  return NextResponse.json(
    { count: tasks.length, filter: { type: typeFilter, status: statusFilter, ...(tierFilter ? { tier: [...tierFilter] } : {}) }, tasks },
    { headers: { 'Content-Disposition': 'attachment; filename="chronicle-feedback-tasks.json"' } },
  )
}
