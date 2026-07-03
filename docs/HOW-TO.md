# Chronicle — The How-To Guide

**Who this is for:** anyone who wants to change this codebase — including someone
who has never seen it, and including someone working with an AI assistant.

**Why it exists:** there's a popular claim (recently aired in the Godot
community) that AI-assisted "vibe coding" should be rejected because the
developers behind it *lack knowledge of their own code*. This document is the
counter-argument in practice: **knowledge is not a feeling in an author's head —
it is a property of the repository.** If the architecture is legible, the
invariants are written down, the tests encode the intent, and the gates refuse
bad changes, then *anyone* — human, AI-assisted, or both — can work on the code
safely. What follows is that knowledge, made explicit and checkable.

---

## 1. The five-minute mental model

Chronicle is a **Next.js (App Router) + Firebase** app. Four layers, one
direction of dependency:

```
  Pages & components        src/app/**  ·  src/components/**
        │  fetch()
        ▼
  API routes (auth here)    src/app/api/**  — every mutation checks a Bearer token
        │  function calls
        ▼
  Domain libraries          src/lib/**  — firestore/ (data) · ai/ (prompts) · engine/ (simulation)
        │  typed by
        ▼
  Shared types              src/types/**  — one barrel: import from '@/types'
```

- **Pages** never touch Firestore directly. They call API routes or the cached
  server helpers.
- **API routes** are where auth, validation (zod), throttling, and credits
  live. The database is server-only (Firebase Admin SDK) — client Firestore
  access is denied by rules.
- **`src/lib/engine/`** is a deterministic, pure simulation (seeded RNG, no
  I/O) — which is why it's the most heavily unit-tested code in the repo.
- **`src/lib/ai/`** builds prompts. All world content funnels through ONE
  assembly seam (below).

## 2. The invariants — the things you must not break

These are the load-bearing rules. Each is enforced by code and most by tests;
if your change touches one, read the linked module first.

| Invariant | Where it lives |
|---|---|
| **World isolation:** one world's lore can never reach another world's prompt except via explicit, rating-gated multiverse links | `lib/ai/world-context.ts` (the single assembly seam) + `world-isolation.test.ts` |
| **Money is atomic:** credit grants/refunds commit in the same transaction as the status change they pay for | `lib/credit-manager.ts` (`grantCreditsInTxn`) + `lib/firestore/bounties.ts` |
| **Limits fail the right way:** the paid/credit path fails **closed** (never grant free AI when Redis is down); abuse throttles fail **open** (never block a real user on a Redis hiccup) | `lib/rate-limit.ts` |
| **Moderation floor:** the rules-based check is the floor; the AI judge can only escalate, never loosen | slot-fill route, `lib/moderation.ts` |
| **Rating containment:** a story ≤ its world's rating; age gating derives from verified claims | `lib/ratings.ts`, `lib/auth.ts` |
| **Auth pattern:** every mutating route resolves `getAuthContext(req)` (or verifies the Bearer token) before doing anything | `lib/auth.ts` |
| **Untrusted text is delimited:** user prompt text goes inside `<user_input>` tags, never interpolated as instructions | `lib/ai/prompts.ts` (`userInputBlock`) |
| **JSON-LD is escaped:** anything embedded in a `<script>` block goes through `jsonLdSafe`, never raw `JSON.stringify` | `lib/json-ld.ts` |

## 3. The loop — how any change ships

```bash
# 1. Find the seam (see the recipes and map below)
# 2. Make the change
npx tsc --noEmit     # types must be clean
npx vitest run       # all tests must pass (250+)
npx eslint <files>   # zero errors
# 3. Commit with a message that explains WHY, push, open a PR
#    CI (typecheck + tests + lint as hard gates) must be green before merge.
```

That loop *is* the safety argument. A contributor who follows it cannot merge a
type error, a failed invariant test, or unreviewed code — regardless of whether
a human or an AI typed the characters.

## 4. Recipes — the changes people actually make

**Add an API route.** Copy this shape (it encodes auth + validation + the
error net):

```ts
// src/app/api/thing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'

const Schema = z.object({ name: z.string().trim().min(1).max(80) })

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = await parseJson(req, Schema)
  if (!parsed.ok) return parsed.response
  // ... call a src/lib/firestore/* helper ...
  return NextResponse.json({ ok: true })
})
```

**Add a field to a story/world.** ① Add it to the interface in `src/types/`
(with a doc comment saying what it means). ② Accept it in the create route's
zod schema, bounded (`.slice()`/`.max()`). ③ Write it in the `createStory`/
`createWorld` call. ④ Read it where needed. Firestore is schemaless — no
migration required; make the field optional and handle absence.

**Change how chapters are generated.** The prompt is assembled in
`lib/ai/prompts.ts` (`buildPrompt`); the simulation context that feeds it comes
from `lib/engine/narrative-builder.ts` (`buildContext` → `formatForPrompt`).
Engine behaviour (pacing, arcs, encounters) changes in `lib/engine/*` — pure
modules, each with a test file; extend the tests with your change.

**Add a new narrative shape** (see the evaluation in `GAMEPLAY-SYSTEMS.md`):
add the mode to `lib/engine/narrative-mode.ts`, an arc pool in
`plot-planner.ts`, and directive variants in `drama-manager.ts` /
`difficulty.ts`. Everything else follows the resolver.

**Add an achievement.** Define it in `src/types/social.ts`
(`ACHIEVEMENT_DEFS`), award it in `lib/firestore/achievements.ts`
(`checkAndAwardAchievements`), and it appears on the profile automatically.
Make the award idempotent (see the ending-key pattern).

**Add an admin screen.** Page under `src/app/admin/<name>/page.tsx` using
`useAdminGuard()` from `admin-ui.tsx`; API under `src/app/api/admin/<name>/`
checking `auth.isAdmin`; add a tile in `src/app/admin/page.tsx`.

## 5. Where things live — the map

| I want to touch… | Look in |
|---|---|
| Reading experience (the book) | `src/components/book/` (`BookViewer` orchestrates) |
| Choice slots / writing a path | `src/components/book/ChoiceSlots.tsx` + `api/stories/[id]/nodes/[nodeId]/slots/[slotId]/route.ts` |
| Story/saga creation | `src/app/stories/new/`, `src/app/saga/new/`, `api/stories/`, `api/sagas/` |
| Worlds, multiverse, genesis | `src/app/worlds/`, `lib/firestore/worlds.ts`, `lib/firestore/multiverse.ts` |
| The simulation (arcs, factions, GOAP…) | `src/lib/engine/` — start at `narrative-builder.ts` |
| Prompts & AI calls | `src/lib/ai/` — start at `prompts.ts` |
| Credits, bounties, Stripe | `lib/credit-manager.ts`, `lib/firestore/bounties.ts`, `api/stripe/` |
| Endings & achievements | `lib/engine/ending*.ts`, `lib/firestore/achievements.ts`, `components/book/EndingReveal.tsx` |
| Characters (collectible) | `lib/firestore/characters.ts`, `src/app/characters/` |
| Share cards / OG images | `lib/share-card.tsx`, `lib/og.tsx`, `api/share-card/` |
| Seasons/events, feedback board | `lib/firestore/seasons.ts` + `/events`; `lib/firestore/feedback.ts` + `/feedback` |
| Moderation & ratings | `lib/moderation.ts`, `lib/ratings.ts`, `/admin/moderation` |

## 6. The argument, stated plainly

When someone says *"AI-assisted contributors don't know their own code"*, this
repo is the rebuttal:

1. **The knowledge is written down** — this guide, `EXECUTION-PLAN.md` (audited,
   tiered backlog), `GROWTH-STRATEGY.md` (why), `GAMEPLAY-SYSTEMS.md` (engine
   design + honest evaluation), and doc comments at every non-obvious seam.
2. **The knowledge is executable** — 250+ tests encode the invariants (world
   isolation, money atomicity, moderation, ending logic). If a contributor —
   any contributor — breaks an invariant, CI says no.
3. **The knowledge is auditable** — security passes are recorded with findings
   *and* fixes (scrypt key derivation, XSS escaping, brute-force caps, atomic
   escrow). Compare: plenty of hand-written codebases have none of this.
4. **The failure mode the critics fear is a process failure, not a typing-method
   failure.** A human who merges unreviewed, untested code "knows" it no better
   than an AI. Gates — types, tests, lint, review, invariant docs — are what
   create durable knowledge. This repo has the gates.

The honest caveat, which strengthens the argument rather than weakening it:
AI assistance does not remove the need for **human judgment** on product intent,
for ops/secrets handled outside the repo, or for the manual smoke tests listed
in the plan. It removes the excuse for *illegible* code — which is the actual
thing the critics are worried about.
