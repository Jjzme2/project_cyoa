import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { getNotifications, markAllNotificationsRead } from '@/lib/firestore-helpers'

async function verifyUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    return await adminAuth.verifyIdToken(token)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const decoded = await verifyUser(req)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await getNotifications(decoded.uid)
  const unreadCount = notifications.filter((n) => !n.read).length
  return NextResponse.json({ notifications, unreadCount })
}

export async function POST(req: NextRequest) {
  const decoded = await verifyUser(req)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, z.object({ action: z.string() }))
  if (!parsed.ok) return parsed.response

  if (parsed.data.action === 'mark_all_read') {
    await markAllNotificationsRead(decoded.uid)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
