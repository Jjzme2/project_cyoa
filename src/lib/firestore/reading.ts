import { adminDb } from '../firebase-admin'
import type { Story } from '@/types'
import { getStory } from './stories'

// ─── Reading Progress ─────────────────────────────────────────────────────────

export interface ReadingProgress {
  currentNodeId: string
  nodeHistory: string[]
  updatedAt: string
}

function progressRef(userId: string, storyId: string) {
  return adminDb.collection('readingProgress').doc(`${userId}_${storyId}`)
}

export async function getReadingProgress(
  userId: string,
  storyId: string,
): Promise<ReadingProgress | null> {
  const doc = await progressRef(userId, storyId).get()
  if (!doc.exists) return null
  return doc.data() as ReadingProgress
}

export async function saveReadingProgress(
  userId: string,
  storyId: string,
  currentNodeId: string,
  nodeHistory: string[],
) {
  await progressRef(userId, storyId).set({
    userId,
    storyId,
    currentNodeId,
    nodeHistory,
    updatedAt: new Date().toISOString(),
  })
}

// ─── User API Keys ─────────────────────────────────────────────────────────────

// ─── Reading History ──────────────────────────────────────────────────────────

export async function getUserReadingHistory(
  userId: string,
  limit = 20,
): Promise<Array<{ progress: ReadingProgress; story: Story | null }>> {
  const snap = await adminDb
    .collection('readingProgress')
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get()

  if (snap.empty) return []

  const progressDocs = snap.docs.map((d) => d.data() as ReadingProgress & { storyId: string })
  const stories = await Promise.all(
    progressDocs.map((p) => getStory(p.storyId).catch(() => null)),
  )

  return progressDocs.map((progress, i) => ({ progress, story: stories[i] }))
}

// ─── Story Tree (for dashboard) ───────────────────────────────────────────────

