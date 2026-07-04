import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getDailyBuckets, type DailyBucket } from '@/lib/telemetry'

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function toCsv(buckets: DailyBucket[]): string {
  const rows = ['date,event,count']
  for (const b of buckets) {
    const entries = Object.entries(b.events)
    if (entries.length === 0) {
      rows.push(`${b.date},,0`)
      continue
    }
    for (const [name, count] of entries) {
      rows.push(`${b.date},${csvEscape(name)},${count}`)
    }
  }
  return rows.join('\n')
}

/** Admin-only: export the analytics window as CSV or JSON for offline analysis. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 14, 1), 90)
  const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'json'
  const buckets = await getDailyBuckets('analytics', days)

  if (format === 'csv') {
    return new NextResponse(toCsv(buckets), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="chronicle-analytics-${days}d.csv"`,
      },
    })
  }

  return NextResponse.json(
    { days, buckets },
    { headers: { 'Content-Disposition': `attachment; filename="chronicle-analytics-${days}d.json"` } },
  )
}
