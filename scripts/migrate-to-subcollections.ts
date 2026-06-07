/**
 * Migrates Firestore data from flat collections to subcollection hierarchy:
 *   story_nodes  → stories/{storyId}/nodes/{nodeId}
 *   choice_slots → stories/{storyId}/nodes/{nodeId}/slots/{slotId}
 *
 * Run with:
 *   npx tsx scripts/migrate-to-subcollections.ts
 *
 * Flags:
 *   --dry-run    Print what would happen without writing anything
 *   --delete-old Delete source collections after successful migration
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, WriteBatch } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const DRY_RUN = process.argv.includes('--dry-run')
const DELETE_OLD = process.argv.includes('--delete-old')
const BATCH_SIZE = 400 // Firestore batch limit is 500; leave headroom

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const app = getAdminApp()
const db = getFirestore(app)

async function commitBatch(batch: WriteBatch, label: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [dry-run] Would commit batch: ${label}`)
    return
  }
  await batch.commit()
  console.log(`  Committed: ${label}`)
}

async function deleteCollection(collectionPath: string): Promise<number> {
  let deleted = 0
  let snap = await db.collection(collectionPath).limit(BATCH_SIZE).get()
  while (!snap.empty) {
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    if (!DRY_RUN) await batch.commit()
    deleted += snap.docs.length
    snap = await db.collection(collectionPath).limit(BATCH_SIZE).get()
  }
  return deleted
}

async function migrateNodes(): Promise<{ migrated: number; skipped: number }> {
  console.log('\n── Migrating story_nodes → stories/{id}/nodes/{id} ──')
  let migrated = 0
  let skipped = 0

  const allNodes = await db.collection('story_nodes').get()
  console.log(`  Found ${allNodes.size} nodes to migrate`)

  // Group by storyId to batch efficiently
  const byStory = new Map<string, typeof allNodes.docs>()
  for (const doc of allNodes.docs) {
    const storyId: string = doc.data().storyId
    if (!storyId) {
      console.warn(`  SKIP node ${doc.id}: missing storyId`)
      skipped++
      continue
    }
    if (!byStory.has(storyId)) byStory.set(storyId, [])
    byStory.get(storyId)!.push(doc)
  }

  for (const [storyId, docs] of byStory) {
    // Verify the parent story exists
    const storyDoc = await db.collection('stories').doc(storyId).get()
    if (!storyDoc.exists) {
      console.warn(`  SKIP ${docs.length} nodes for missing story ${storyId}`)
      skipped += docs.length
      continue
    }

    let batch = db.batch()
    let batchCount = 0

    for (const doc of docs) {
      const destRef = db
        .collection('stories')
        .doc(storyId)
        .collection('nodes')
        .doc(doc.id)

      batch.set(destRef, doc.data())
      batchCount++
      migrated++

      if (batchCount >= BATCH_SIZE) {
        await commitBatch(batch, `${batchCount} nodes for story ${storyId}`)
        batch = db.batch()
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await commitBatch(batch, `${batchCount} nodes for story ${storyId}`)
    }
  }

  return { migrated, skipped }
}

async function migrateSlots(): Promise<{ migrated: number; skipped: number }> {
  console.log('\n── Migrating choice_slots → stories/{id}/nodes/{id}/slots/{id} ──')
  let migrated = 0
  let skipped = 0

  const allSlots = await db.collection('choice_slots').get()
  console.log(`  Found ${allSlots.size} slots to migrate`)

  // Group by nodeId → then look up storyId from the (already migrated) subcollection node
  // Build a nodeId→storyId map from the flat story_nodes collection first
  const nodeToStory = new Map<string, string>()
  const nodesSnap = await db.collection('story_nodes').get()
  for (const doc of nodesSnap.docs) {
    const storyId: string = doc.data().storyId
    if (storyId) nodeToStory.set(doc.id, storyId)
  }

  let batch = db.batch()
  let batchCount = 0

  for (const doc of allSlots.docs) {
    const nodeId: string = doc.data().nodeId
    if (!nodeId) {
      console.warn(`  SKIP slot ${doc.id}: missing nodeId`)
      skipped++
      continue
    }

    const storyId = nodeToStory.get(nodeId)
    if (!storyId) {
      console.warn(`  SKIP slot ${doc.id}: nodeId ${nodeId} has no storyId mapping`)
      skipped++
      continue
    }

    const destRef = db
      .collection('stories')
      .doc(storyId)
      .collection('nodes')
      .doc(nodeId)
      .collection('slots')
      .doc(doc.id)

    // Enrich slot with storyId for future collection-group queries
    batch.set(destRef, { ...doc.data(), storyId })
    batchCount++
    migrated++

    if (batchCount >= BATCH_SIZE) {
      await commitBatch(batch, `${batchCount} slots`)
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) {
    await commitBatch(batch, `${batchCount} slots`)
  }

  return { migrated, skipped }
}

async function verify(): Promise<boolean> {
  console.log('\n── Verification ──')

  const [oldNodes, oldSlots] = await Promise.all([
    db.collection('story_nodes').count().get(),
    db.collection('choice_slots').count().get(),
  ])

  const oldNodeCount = oldNodes.data().count
  const oldSlotCount = oldSlots.data().count

  const [newNodes, newSlots] = await Promise.all([
    db.collectionGroup('nodes').count().get(),
    db.collectionGroup('slots').count().get(),
  ])

  const newNodeCount = newNodes.data().count
  const newSlotCount = newSlots.data().count

  console.log(`  story_nodes:   ${oldNodeCount} → stories/*/nodes/*: ${newNodeCount}`)
  console.log(`  choice_slots:  ${oldSlotCount} → stories/*/nodes/*/slots/*: ${newSlotCount}`)

  const nodesOk = newNodeCount >= oldNodeCount
  const slotsOk = newSlotCount >= oldSlotCount

  if (nodesOk && slotsOk) {
    console.log('  ✓ Counts match — migration looks complete')
  } else {
    console.error('  ✗ Count mismatch — DO NOT delete old collections')
  }

  return nodesOk && slotsOk
}

async function main() {
  console.log(`Migration starting (dry-run=${DRY_RUN}, delete-old=${DELETE_OLD})`)
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}`)

  const nodeResult = await migrateNodes()
  const slotResult = await migrateSlots()

  console.log('\n── Summary ──')
  console.log(`  Nodes: ${nodeResult.migrated} migrated, ${nodeResult.skipped} skipped`)
  console.log(`  Slots: ${slotResult.migrated} migrated, ${slotResult.skipped} skipped`)

  if (!DRY_RUN) {
    const ok = await verify()

    if (ok && DELETE_OLD) {
      console.log('\n── Deleting old flat collections ──')
      const deletedNodes = await deleteCollection('story_nodes')
      const deletedSlots = await deleteCollection('choice_slots')
      console.log(`  Deleted ${deletedNodes} story_nodes, ${deletedSlots} choice_slots`)
    } else if (!ok) {
      console.error('\nVerification failed. Old collections preserved.')
      process.exit(1)
    } else {
      console.log('\nOld collections preserved. Re-run with --delete-old to remove them.')
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
