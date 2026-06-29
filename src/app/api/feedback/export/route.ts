import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { listFeedback } from '@/lib/firestore-helpers'
import { sortFeedback, isFeedbackType, isFeedbackStatus } from '@/lib/feedback'

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

  const items = sortFeedback(await listFeedback()).filter(
    (f) => typeFilter.includes(f.type) && statusFilter.includes(f.status),
  )

  const tasks = items.map((f) => ({
    id: f.id,
    type: f.type,
    title: f.title,
    detail: f.body,
    status: f.status,
    votes: f.votes,
    createdAt: f.createdAt,
  }))

  return NextResponse.json(
    { count: tasks.length, filter: { type: typeFilter, status: statusFilter }, tasks },
    { headers: { 'Content-Disposition': 'attachment; filename="chronicle-feedback-tasks.json"' } },
  )
}
