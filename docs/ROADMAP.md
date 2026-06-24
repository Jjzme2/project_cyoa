# Chronicle — Roadmap & Task Tracker

Living record of work discussed and delivered. Status legend: ✅ shipped (merged to `main`) · 🛠️ outstanding (ops/verify) · 🔮 planned.

GitHub trackers:
- **Post-merge checklist:** [#4](https://github.com/Jjzme2/project_cyoa/issues/4)
- **Co-op live reading rooms (plan):** [#5](https://github.com/Jjzme2/project_cyoa/issues/5)

---

## ✅ Shipped

### SEO & discoverability
- Per-route metadata, generated OG/Twitter images (home, story, world), `sitemap.ts`, `robots.ts`, `metadataBase`.
- New `/worlds/[id]` route (world detail + its stories); world cards link to it.
- Homepage "Read a featured story" CTA + "How it works" strip; world lore truncated at word boundaries; zero-count hidden.
- **Bug fix:** new users can create a story in any shared world (was scoped to own worlds).

### Access control & moderation
- **RBAC:** admin role via Firebase custom claims + `ADMIN_EMAILS` bootstrap (`scripts/set-admin.ts`, `/api/me`). Admin "Moderation" link in header.
- **Rules-based, rating-aware moderation:** always-refuse (slurs / CSAE / mass-harm); violence, profanity, sexual & frightening themes judged against the story's rating — flagged or refused when they exceed it. Applied to opening chapters + contributed routes.
- **Per-route visibility:** flagged/rejected routes hidden from non-admins; admin Approve/Remove inline + `/admin/moderation` queue (reject reopens the slot).

### Content ratings & age gating
- **World + story content ratings** (Everyone / Teen / Mature); author-set, admin-overridable.
- **Rating containment:** story rating clamped ≤ world rating (create + edit); lowering a world's rating cascades down to its stories.
- **Age gating:** 13+ to use, 18+ for Mature; self-reported DOB + attestation via one-time `AgeGate`; under-13 refused. Pragmatic enforcement — authed node/story API returns 403 above allowance, Teen/Mature pages client-gate the reader, listings hide too-mature stories. Not directed to children under 13.

### Reading experience
- Synthesized **page-turn sound** + **ambient soundscapes** (rain/embers/snow/stars) via Web Audio, with toggles (ambient off by default).
- **Endings collector** (discovered X/Y + toast), **path popularity** ("% chose this") + author attribution on choices, **illustration gallery**.
- **Author-defined protagonist** + **emergent canon characters** with continuity enforcement folded into the single generation call (no extra model cost); Cast dialog.
- **Writer reputation** stats on the profile (paths written, reads, reactions).

### Economy
- **Branch bounties:** escrow a credit reward (purchased credits only) on an empty path; paid to whoever fills it once published/approved; refund on cancel; can't claim your own. Deferred payout for flagged contributions (paid on approve, returned to pool on reject).

### Seed content
- `scripts/seed.ts` (`npm run seed`) — hand-authored starter worlds/stories flagged `seeded` with a "Seeded — not community-built" badge.

---

## 🛠️ Outstanding (ops / verify) — see [#4](https://github.com/Jjzme2/project_cyoa/issues/4)

- [ ] Deploy Firestore indexes (`firestore.indexes.json`): `nodes.moderation.status` (moderation queue) + `nodes.authorId` field override (writer stats).
- [ ] Set `ADMIN_EMAILS` (jjzettler@gmail.com) in Vercel Production + Preview; redeploy.
- [ ] Confirm `NEXT_PUBLIC_APP_URL` is the real production domain.
- [ ] Run `npm run seed` with admin creds.
- [ ] **Smoke-test bounty credit flows** (never runtime-tested): post→fill→pay, cancel→refund, flagged→approve→pay / reject→reopen, can't-claim-own.
- [ ] Smoke-test age gating, rating containment, character continuity, reader polish.

---

## 🔮 Planned

### Co-op live reading rooms — [#5](https://github.com/Jjzme2/project_cyoa/issues/5)
Group reads a story together and votes on each choice; everyone advances in sync; pause-to-write at frontiers. Realtime via Firestore `onSnapshot` (reads) + Admin-SDK API (writes); read-only client rules.
- **PR 1 (core) — built**, pending: deploy `firestore.rules` (`firebase deploy --only firestore:rules`) and **2-browser smoke test** (create/join by link, vote, countdown resolve + sync advance, age-ineligible join). Create/join/vote/resolve/heartbeat/leave, live voting + countdown + presence, "Read together" entry.
- **PR 2 (polish) — planned:** frontier write-pause, host kick, ended summary, stale-room cleanup.

### Global leaderboards
Most-loved / most-traveled paths and top writers. Needs denormalized aggregate counters (beyond the per-node traversal/reaction counts already in place).

### Global bounty board
Discovery surface for open bounties across stories (currently bounties only appear inline on slots). Needs a collection-group query + index.

### Saga draft persistence
The story creator autosaves/restores a draft via `useDraft` (`chronicle:draft:story`); the Personal Saga creator (`/saga/new`) has no equivalent, so an interrupted saga is lost on reload. Wire the same draft restore/discard banner into the saga form (entry points, premise, director, cover/reading theme). Parked from the Director-UI work.

### Open product decision
- Anonymous vs. named authorship policy (named authorship builds community).

---

## Locked design decisions (for reference)
- **Age model:** 13+ to use the site, 18+ for Mature; self-reported **DOB + attestation**; **pragmatic** enforcement (authed-API gate + interstitial + client-side listing hide).
- **Moderation:** rules-only (no AI dependency), **rating-aware**.
- **Bounties:** funded from **purchased credits only**, escrow hold, release only on published/approved.
- **Characters:** author-defined protagonist, **emergent** cast, **harsh** continuity — all folded into the existing generation call (no extra AI call).
- **Co-op rooms:** Firestore `onSnapshot` reads + Admin-SDK writes; timed vote rounds with idempotent resolve; rooms read-only to clients via security rules.
