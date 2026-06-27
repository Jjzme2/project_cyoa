import { adminDb } from '../firebase-admin'
import type { Notification, NotificationType } from '@/types'

// ─── Notifications ────────────────────────────────────────────────────────────

function notifCollection(userId: string) {
  return adminDb.collection('users').doc(userId).collection('notifications')
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Partial<Omit<Notification, 'id' | 'userId' | 'type' | 'read' | 'createdAt'>>,
): Promise<void> {
  await notifCollection(userId).add({
    userId,
    type,
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  })
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const snap = await notifCollection(userId)
    .orderBy('createdAt', 'desc')
    .limit(40)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
}

export async function markNotificationRead(userId: string, notifId: string): Promise<void> {
  await notifCollection(userId).doc(notifId).update({ read: true })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await notifCollection(userId).where('read', '==', false).get()
  if (snap.empty) return
  const batch = adminDb.batch()
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}

