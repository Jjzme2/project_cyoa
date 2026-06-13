/**
 * Seeds a few starter worlds and short branching stories so the library isn't
 * empty. Everything created here is hand-authored by the Chronicle team and
 * flagged `seeded: true` (shown with a "Seeded" badge) — it is NOT community
 * content. Community contributions can still extend these via the open slots.
 *
 * Run with:
 *   npx tsx scripts/seed.ts            # create seed content (skips if present)
 *   npx tsx scripts/seed.ts --force    # create even if seed content exists
 *
 * Idempotency: by default the script refuses to run if any seeded world already
 * exists, to avoid duplicates.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const FORCE = process.argv.includes('--force')
const SEED_AUTHOR_ID = 'chronicle-seed'
const SEED_AUTHOR_NAME = 'Chronicle'

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

const db: Firestore = getFirestore(getAdminApp())
const now = () => new Date().toISOString()

type Rating = 'Everyone' | 'Teen' | 'Mature'

interface SeedNode {
  content: string
  children?: { prompt: string; node: SeedNode }[]
  openPrompts?: string[]
}

interface SeedWorld {
  name: string
  description: string
  lore: string
  rules: string
  tone: string
  tags: string[]
  rating: Rating
}

interface SeedStory {
  title: string
  description: string
  rating: Rating
  tags: string[]
  coverTheme: { fromColor: string; toColor: string; icon: string; pattern: string; fontStyle: string }
  root: SeedNode
}

// Write a node whose id is known in advance (so the parent slot can link it).
async function writeChildWithId(
  storyId: string,
  nodeId: string,
  node: SeedNode,
  parentId: string,
  depth: number,
  choiceText: string,
): Promise<number> {
  const nodeRef = db.collection('stories').doc(storyId).collection('nodes').doc(nodeId)
  await nodeRef.set({
    storyId,
    content: node.content,
    depth,
    parentId,
    choiceText,
    authorId: SEED_AUTHOR_ID,
    aiGenerated: false,
    aiModel: null,
    imageUrl: null,
    published: true,
    moderation: { status: 'approved', reviewedBy: null, reviewedAt: null },
    createdAt: now(),
  })

  let count = 1
  let slotIndex = 0
  const batch = db.batch()

  for (const child of node.children ?? []) {
    const childId = db.collection('stories').doc(storyId).collection('nodes').doc().id
    count += await writeChildWithId(storyId, childId, child.node, nodeId, depth + 1, child.prompt)
    const slotRef = nodeRef.collection('slots').doc()
    batch.set(slotRef, {
      nodeId, storyId, slotIndex: slotIndex++, promptText: child.prompt,
      filled: true, childNodeId: childId, submittedBy: SEED_AUTHOR_ID,
      submitterName: SEED_AUTHOR_NAME, locked: false, lockedBy: null, lockedAt: null, createdAt: now(),
    })
  }
  for (const prompt of node.openPrompts ?? []) {
    const slotRef = nodeRef.collection('slots').doc()
    batch.set(slotRef, {
      nodeId, storyId, slotIndex: slotIndex++, promptText: prompt,
      filled: false, childNodeId: null, submittedBy: null, submitterName: null,
      locked: false, lockedBy: null, lockedAt: null, createdAt: now(),
    })
  }

  await batch.commit()
  return count
}

async function createWorld(w: SeedWorld): Promise<string> {
  const ref = db.collection('worlds').doc()
  await ref.set({
    name: w.name,
    description: w.description,
    lore: w.lore,
    rules: w.rules,
    tone: w.tone,
    tags: w.tags,
    rating: w.rating,
    ratingOverriddenBy: null,
    seeded: true,
    authorId: SEED_AUTHOR_ID,
    authorName: SEED_AUTHOR_NAME,
    createdAt: now(),
  })
  return ref.id
}

async function createStory(worldId: string, worldName: string, s: SeedStory): Promise<void> {
  const storyRef = db.collection('stories').doc()
  await storyRef.set({
    title: s.title,
    description: s.description,
    worldId,
    worldName,
    authorId: SEED_AUTHOR_ID,
    authorName: SEED_AUTHOR_NAME,
    rootNodeId: null,
    published: true,
    coverGradient: 'from-amber-900 to-stone-900',
    coverTheme: s.coverTheme,
    views: 0,
    nodeCount: 0,
    rating: s.rating,
    ratingOverriddenBy: null,
    seeded: true,
    tags: s.tags,
    createdAt: now(),
    updatedAt: now(),
  })

  // Write the root node with a known id so we can set rootNodeId.
  const rootId = db.collection('stories').doc(storyRef.id).collection('nodes').doc().id
  // Reuse writeChildWithId for the root (parentId null is fine to store).
  const nodeRef = db.collection('stories').doc(storyRef.id).collection('nodes').doc(rootId)
  await nodeRef.set({
    storyId: storyRef.id, content: s.root.content, depth: 0, parentId: null,
    choiceText: null, authorId: SEED_AUTHOR_ID, aiGenerated: false, aiModel: null,
    imageUrl: null, published: true,
    moderation: { status: 'approved', reviewedBy: null, reviewedAt: null }, createdAt: now(),
  })

  let count = 1
  let slotIndex = 0
  const batch = db.batch()
  for (const child of s.root.children ?? []) {
    const childId = db.collection('stories').doc(storyRef.id).collection('nodes').doc().id
    count += await writeChildWithId(storyRef.id, childId, child.node, rootId, 1, child.prompt)
    const slotRef = nodeRef.collection('slots').doc()
    batch.set(slotRef, {
      nodeId: rootId, storyId: storyRef.id, slotIndex: slotIndex++, promptText: child.prompt,
      filled: true, childNodeId: childId, submittedBy: SEED_AUTHOR_ID,
      submitterName: SEED_AUTHOR_NAME, locked: false, lockedBy: null, lockedAt: null, createdAt: now(),
    })
  }
  for (const prompt of s.root.openPrompts ?? []) {
    const slotRef = nodeRef.collection('slots').doc()
    batch.set(slotRef, {
      nodeId: rootId, storyId: storyRef.id, slotIndex: slotIndex++, promptText: prompt,
      filled: false, childNodeId: null, submittedBy: null, submitterName: null,
      locked: false, lockedBy: null, lockedAt: null, createdAt: now(),
    })
  }
  await batch.commit()

  await storyRef.update({ rootNodeId: rootId, nodeCount: count })
  console.log(`  · story "${s.title}" (${s.rating}) — ${count} chapters`)
}

// ─── Seed content ───────────────────────────────────────────────────────────

const LANTERN_VALE: SeedWorld = {
  name: 'The Lantern Vale',
  description: 'A gentle valley where every cottage keeps a lantern lit for travellers, and small kindnesses ripple outward.',
  lore: 'Long ago the Vale folk learned that no one should walk the night road alone. Each household hangs a lantern by the gate; a lit lantern means a warm hearth and a story to share. The hills are home to shy moss-foxes, singing kettles, and a postman who has never once been late.',
  rules: '• Keep the tone warm and wholesome — wonder over danger.\n• Conflicts resolve through cleverness and kindness, never cruelty.\n• Magic is small and domestic: kettles that hum, lanterns that never gutter.',
  tone: 'Whimsical Fairy Tale',
  tags: ['Fairy Tale', 'Adventure', 'Comedy'],
  rating: 'Everyone',
}

const EMBERFALL: SeedWorld = {
  name: 'Emberfall',
  description: 'A frontier of drifting sky-islands and salvage crews, where storms carry both fortune and ruin.',
  lore: 'After the Shatter, the land broke into islands that drift on slow currents of wind. Salvage crews ride patched airships between them, trading scrap and stories. The great storms — the Embers — strip islands bare but leave behind rare sky-glass worth a season\'s wages.',
  rules: '• Adventure and tension are welcome; keep violence non-graphic.\n• Characters are capable but fallible; danger has real stakes.\n• Technology is patchwork and analog — gears, glass, and rope.',
  tone: 'Sci-Fi Adventure',
  tags: ['Adventure', 'Sci-Fi', 'Steampunk'],
  rating: 'Teen',
}

const STORY_KETTLE: SeedStory = {
  title: 'The Kettle That Wouldn\'t Sing',
  description: 'Old Marn\'s kettle has gone silent, and in the Vale a silent kettle means trouble is brewing.',
  rating: 'Everyone',
  tags: ['Fairy Tale', 'Comedy'],
  coverTheme: { fromColor: '#2a1a08', toColor: '#0f0a03', icon: '🫖', pattern: 'dots', fontStyle: 'serif' },
  root: {
    content:
      'For forty years, Marn\'s copper kettle had hummed a little tune each morning — a sure sign the day would be kind. But this morning it sat cold and silent on the hearth, and Marn felt a worry settle over the cottage like fog. She pulled on her boots. A silent kettle was not a thing to ignore.',
    children: [
      {
        prompt: 'Ask the moss-fox who sleeps under the porch',
        node: {
          content:
            'The moss-fox blinked its lantern-yellow eyes and yawned. "The kettle?" it said, for animals in the Vale will talk if you share your breakfast. "It\'s sulking. It heard you say you might buy one of those shiny town kettles. Kettles have feelings, you know." Marn flushed. She had said that, hadn\'t she, only in passing.',
          openPrompts: [
            'Apologise to the kettle properly',
            'Bake the kettle\'s favourite cinnamon loaf as a peace offering',
          ],
        },
      },
      {
        prompt: 'Walk to the village to ask the late postman',
        node: {
          content:
            'The postman — never late, not once — was waiting at her gate before she\'d even decided to go. "Three silent kettles this week," he murmured, sorting letters that hummed faintly in his bag. "All on the east lane. Something\'s gone quiet in the hills, and the kettles feel it first." He handed her a letter with no name, only a small drawing of a lantern, unlit.',
          openPrompts: [
            'Follow the east lane into the hills',
            'Gather the other kettle-keepers first',
          ],
        },
      },
    ],
  },
}

const STORY_LANTERN: SeedStory = {
  title: 'The Lantern Left Unlit',
  description: 'On the coldest night of the year, one gate on the night road stands dark.',
  rating: 'Everyone',
  tags: ['Fairy Tale', 'Mystery'],
  coverTheme: { fromColor: '#0a1424', toColor: '#03060f', icon: '🏮', pattern: 'stars', fontStyle: 'serif' },
  root: {
    content:
      'Every gate on the night road glowed, save one. The Hollis cottage stood dark, its lantern cold — and in the Vale, an unlit lantern on a winter night is a quiet cry for help. You are the night-walker this season, and the road is yours to keep. You lift your own lantern higher and start toward the dark gate.',
    children: [
      {
        prompt: 'Knock softly at the Hollis door',
        node: {
          content:
            'No answer — but a thin voice from the woodshed: young Pell Hollis, knees to chest, out of matches and too proud to wake the neighbours. "Gran\'s away," she whispered, "and I let it go out. Now everyone will know I couldn\'t keep one small flame." You kneel and offer your lantern\'s light to hers.',
          openPrompts: ['Teach Pell the trick of the never-gutter wick', 'Sit with her until the cottage is warm again'],
        },
      },
      {
        prompt: 'Check the lantern itself first',
        node: {
          content:
            'The wick was fine; the oil was full. But tucked inside the lantern\'s base was a folded note in a child\'s hand: "Borrowed the flame to find the lost lamb. Back by dawn. — Pell." Far off across the white fields, a single spark of light bobbed and wove. Pell was out there alone, chasing something into the dark.',
          openPrompts: ['Follow the bobbing light across the fields', 'Ring the gate-bell to rouse the village'],
        },
      },
    ],
  },
}

const STORY_SALVAGE: SeedStory = {
  title: 'Salvage Rights',
  description: 'A fresh-stripped island drifts into your crew\'s waters, glittering with sky-glass — and it isn\'t empty.',
  rating: 'Teen',
  tags: ['Adventure', 'Sci-Fi'],
  coverTheme: { fromColor: '#241006', toColor: '#0f0603', icon: '⛵', pattern: 'lines', fontStyle: 'gothic' },
  root: {
    content:
      'The Ember had passed in the night, and at dawn a stripped island came drifting into your crew\'s waters — bare rock studded with veins of sky-glass that caught the light like frozen fire. A season\'s wages, right there. But as your patched airship drew alongside, you saw another vessel already moored on the far side: lean, fast, and flying no colours at all. Captain Vane turned to you. "Your call, quartermaster."',
    children: [
      {
        prompt: 'Hail the other ship and propose splitting the haul',
        node: {
          content:
            'You raise the speaking-trumpet and call across the gap. After a long silence a figure appears at the other rail — young, wary, hand near but not on a blade. "Split it?" they call back. "You\'re the first crew in a year that didn\'t just start cutting lines. Half each, and we both make it home. Deal?" Behind you, Vane watches to see what kind of officer you are.',
          openPrompts: ['Shake on the deal and work the island together', 'Set a fair boundary line down the middle first'],
        },
      },
      {
        prompt: 'Move quietly to claim the richest vein before they notice',
        node: {
          content:
            'You signal the crew to muffle the winches and drift toward the brightest seam of glass. You\'re close enough to taste the ozone when the rock underfoot shudders — the island is still venting storm-charge, and your boots prickle with it. One wrong strike on a live vein and the whole seam could discharge. The other crew hasn\'t spotted you. Yet.',
          openPrompts: ['Ground the charge with a salvage chain before cutting', 'Pull back — the vein is too unstable to risk'],
        },
      },
    ],
  },
}

async function main() {
  if (!FORCE) {
    const existing = await db.collection('worlds').where('seeded', '==', true).limit(1).get()
    if (!existing.empty) {
      console.log('Seed content already exists. Re-run with --force to add it again.')
      return
    }
  }

  console.log('Seeding worlds and stories…')

  const valeId = await createWorld(LANTERN_VALE)
  console.log(`World "${LANTERN_VALE.name}" (${LANTERN_VALE.rating})`)
  await createStory(valeId, LANTERN_VALE.name, STORY_KETTLE)
  await createStory(valeId, LANTERN_VALE.name, STORY_LANTERN)

  const emberId = await createWorld(EMBERFALL)
  console.log(`World "${EMBERFALL.name}" (${EMBERFALL.rating})`)
  await createStory(emberId, EMBERFALL.name, STORY_SALVAGE)

  console.log('Done. Seed content is flagged seeded:true and shows a "Seeded" badge.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
