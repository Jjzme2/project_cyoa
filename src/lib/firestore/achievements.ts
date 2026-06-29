import { adminDb } from '../firebase-admin'
import { ENDING_TYPES, type EndingType, type UserAchievements } from '@/types'

// ─── Achievements ─────────────────────────────────────────────────────────────

function achievementsRef(userId: string) {
  return adminDb.collection('achievements').doc(userId)
}

export async function getUserAchievements(userId: string): Promise<UserAchievements> {
  const doc = await achievementsRef(userId).get()
  if (!doc.exists) {
    return {
      earned: [],
      counts: { contributions: 0, storiesRead: 0, bookmarks: 0, worlds: 0, stories: 0, illustrations: 0 },
      updatedAt: new Date().toISOString(),
    }
  }
  return doc.data() as UserAchievements
}

export async function checkAndAwardAchievements(
  userId: string,
  event: 'contribution' | 'illustration' | 'world_created' | 'story_created' | 'story_read' | 'bookmark' | 'ending_reached',
  meta?: { endingType?: EndingType },
): Promise<string[]> {
  const ref = achievementsRef(userId)
  const newlyEarned: string[] = []

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const data: UserAchievements = doc.exists
      ? (doc.data() as UserAchievements)
      : {
          earned: [],
          counts: { contributions: 0, storiesRead: 0, bookmarks: 0, worlds: 0, stories: 0, illustrations: 0 },
          updatedAt: new Date().toISOString(),
        }

    const counts = { ...data.counts }
    const earned = [...data.earned]

    if (event === 'contribution') counts.contributions = (counts.contributions ?? 0) + 1
    if (event === 'illustration') counts.illustrations = (counts.illustrations ?? 0) + 1
    if (event === 'world_created') counts.worlds = (counts.worlds ?? 0) + 1
    if (event === 'story_created') counts.stories = (counts.stories ?? 0) + 1
    if (event === 'story_read') counts.storiesRead = (counts.storiesRead ?? 0) + 1
    if (event === 'bookmark') counts.bookmarks = (counts.bookmarks ?? 0) + 1
    if (event === 'ending_reached') {
      counts.endingsReached = (counts.endingsReached ?? 0) + 1
      if (meta?.endingType) {
        const types = new Set(counts.endingTypes ?? [])
        types.add(meta.endingType)
        counts.endingTypes = Array.from(types)
      }
    }

    function check(id: string, condition: boolean) {
      if (condition && !earned.includes(id)) {
        earned.push(id)
        newlyEarned.push(id)
      }
    }

    check('first_step', counts.contributions >= 1)
    check('prolific', counts.contributions >= 10)
    check('chronicler', counts.contributions >= 50)
    check('sage', counts.contributions >= 100)
    check('illustrator', counts.illustrations >= 1)
    check('world_builder', counts.worlds >= 1)
    check('storyteller', counts.stories >= 1)
    check('explorer', counts.storiesRead >= 5)
    check('bookworm', counts.storiesRead >= 10)
    check('librarian', counts.bookmarks >= 10)
    // Narrative-aware (earned in-fiction).
    check('the_end', (counts.endingsReached ?? 0) >= 1)
    check('secret_keeper', (counts.endingTypes ?? []).includes('secret'))
    check('every_ending', ENDING_TYPES.every((t) => (counts.endingTypes ?? []).includes(t)))

    txn.set(ref, { earned, counts, updatedAt: new Date().toISOString() })
  })

  return newlyEarned
}

