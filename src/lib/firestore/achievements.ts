import { adminDb } from '../firebase-admin'
import { ENDING_TYPES, ACHIEVEMENT_DEFS, type EndingType, type UserAchievements } from '@/types'
import { CreditManager } from '../credit-manager'

// ─── Achievements ─────────────────────────────────────────────────────────────

function achievementsRef(userId: string) {
  return adminDb.collection('achievements').doc(userId)
}

function notificationsRef(userId: string) {
  return adminDb.collection('users').doc(userId).collection('notifications')
}

const EMPTY_COUNTS: UserAchievements['counts'] = {
  contributions: 0, storiesRead: 0, bookmarks: 0, worlds: 0, stories: 0, illustrations: 0,
}

export async function getUserAchievements(userId: string): Promise<UserAchievements> {
  const doc = await achievementsRef(userId).get()
  if (!doc.exists) {
    return { earned: [], counts: { ...EMPTY_COUNTS }, updatedAt: new Date().toISOString() }
  }
  return doc.data() as UserAchievements
}

export type AchievementEvent =
  | 'contribution' | 'illustration' | 'world_created' | 'story_created' | 'story_read'
  | 'bookmark' | 'ending_reached'
  | 'saga_created' | 'feedback_submitted' | 'bounty_posted' | 'bounty_filled'
  | 'world_standing' | 'npc_bond' | 'path_traversal_milestone' | 'first_choice'

/**
 * Update counts for `event`, then award any newly-earned achievements —
 * crediting their reward and notifying the reader, all in the same
 * transaction as the earn (no double-grant, no partial-grant window; see
 * `CreditManager.grantCreditsInTxn`, the same pattern bounty payouts use).
 */
export async function checkAndAwardAchievements(
  userId: string,
  event: AchievementEvent,
  meta?: { endingType?: EndingType; endingKey?: string; standing?: number; storyId?: string },
): Promise<string[]> {
  const ref = achievementsRef(userId)
  const newlyEarned: string[] = []

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const data: UserAchievements = doc.exists
      ? (doc.data() as UserAchievements)
      : { earned: [], counts: { ...EMPTY_COUNTS }, updatedAt: new Date().toISOString() }

    const counts = { ...data.counts }
    const earned = [...data.earned]

    if (event === 'contribution') counts.contributions = (counts.contributions ?? 0) + 1
    if (event === 'illustration') counts.illustrations = (counts.illustrations ?? 0) + 1
    if (event === 'world_created') counts.worlds = (counts.worlds ?? 0) + 1
    if (event === 'story_created') counts.stories = (counts.stories ?? 0) + 1
    if (event === 'bookmark') counts.bookmarks = (counts.bookmarks ?? 0) + 1
    if (event === 'saga_created') counts.sagasCreated = (counts.sagasCreated ?? 0) + 1
    if (event === 'feedback_submitted') counts.feedbackSubmitted = (counts.feedbackSubmitted ?? 0) + 1
    if (event === 'bounty_posted') counts.bountiesPosted = (counts.bountiesPosted ?? 0) + 1
    if (event === 'bounty_filled') counts.bountiesFilled = (counts.bountiesFilled ?? 0) + 1
    if (event === 'npc_bond') counts.deepBonds = (counts.deepBonds ?? 0) + 1
    if (event === 'path_traversal_milestone') counts.pathMilestones = (counts.pathMilestones ?? 0) + 1
    if (event === 'world_standing' && meta?.standing !== undefined) {
      counts.bestWorldStanding = Math.max(counts.bestWorldStanding ?? -1, meta.standing)
    }
    if (event === 'story_read') {
      // Idempotent per story: re-saving progress within the same story (every
      // page turn) never inflates the distinct-stories-read count.
      const ids = counts.storiesReadIds ?? []
      if (!meta?.storyId || !ids.includes(meta.storyId)) {
        counts.storiesRead = (counts.storiesRead ?? 0) + 1
        if (meta?.storyId && ids.length < 500) counts.storiesReadIds = [...ids, meta.storyId]
      }
    }
    if (event === 'ending_reached') {
      // Idempotent per ending: re-reaching (or re-posting) the same ending never
      // inflates the count. Keys are capped; overflow just stops dedup, which at
      // that scale can't matter for the achievements.
      const keys = counts.endingKeys ?? []
      const alreadyCounted = !!meta?.endingKey && keys.includes(meta.endingKey)
      if (!alreadyCounted) {
        counts.endingsReached = (counts.endingsReached ?? 0) + 1
        if (meta?.endingKey && keys.length < 500) counts.endingKeys = [...keys, meta.endingKey]
        if (meta?.endingType) {
          const types = new Set(counts.endingTypes ?? [])
          types.add(meta.endingType)
          counts.endingTypes = Array.from(types)
        }
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
    // v2 additions.
    check('wanderer', (counts.sagasCreated ?? 0) >= 1)
    check('voice_heard', (counts.feedbackSubmitted ?? 0) >= 1)
    check('patron', (counts.bountiesPosted ?? 0) >= 1)
    check('mercenary', (counts.bountiesFilled ?? 0) >= 1)
    check('renowned', (counts.bestWorldStanding ?? -1) >= 0.7)
    check('kindred_spirit', (counts.deepBonds ?? 0) >= 1)
    check('path_pioneer', (counts.pathMilestones ?? 0) >= 1)
    check('first_choice', event === 'first_choice')
    // Capstone — checked last so it sees everything earned this same round.
    check('completionist', earned.length >= ACHIEVEMENT_DEFS.length - 1)

    // Every page turn re-fires `story_read`; when the story's already counted
    // nothing here changes, so skip the (multi-KB, growing) doc rewrite entirely.
    const unchanged =
      doc.exists &&
      newlyEarned.length === 0 &&
      JSON.stringify(data.counts) === JSON.stringify(counts)
    if (unchanged) return

    txn.set(ref, { earned, counts, updatedAt: new Date().toISOString() })

    for (const id of newlyEarned) {
      const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
      if (!def) continue
      if (def.reward) CreditManager.grantCreditsInTxn(txn, userId, def.reward)
      txn.set(notificationsRef(userId).doc(), {
        userId,
        type: 'achievement_earned',
        achievementId: id,
        read: false,
        createdAt: new Date().toISOString(),
      })
    }
  })

  return newlyEarned
}
