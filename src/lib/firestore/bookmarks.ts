import { adminDb } from '../firebase-admin'
import type { Bookmark, Story } from '@/types'

// ─── Bookmarks ────────────────────────────────────────────────────────────────

function bookmarkRef(userId: string, storyId: string) {
  return adminDb.collection('bookmarks').doc(`${userId}_${storyId}`)
}

export async function createBookmark(userId: string, story: Story): Promise<void> {
  await bookmarkRef(userId, story.id).set({
    userId,
    storyId: story.id,
    storyTitle: story.title,
    storyAuthorName: story.authorName,
    worldName: story.worldName,
    coverGradient: story.coverGradient ?? '',
    createdAt: new Date().toISOString(),
  })
}

export async function deleteBookmark(userId: string, storyId: string): Promise<void> {
  await bookmarkRef(userId, storyId).delete()
}

export async function isBookmarked(userId: string, storyId: string): Promise<boolean> {
  const doc = await bookmarkRef(userId, storyId).get()
  return doc.exists
}

export async function getUserBookmarks(userId: string): Promise<Bookmark[]> {
  const snap = await adminDb
    .collection('bookmarks')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bookmark))
}

