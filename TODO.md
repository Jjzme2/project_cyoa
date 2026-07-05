# Chronicle — Running Task List

Actionable running checklist (companion to the higher-level `docs/ROADMAP.md`).
Items are ordered by importance within each tier. Everything currently checked
off lives on branch `claude/elegant-einstein-pcfbr3`, pending merge to `main`.

Legend: `[x]` done · `[ ]` open · 🔒 blocked on ops/deploy (can't be done from
the codebase alone).

---

## ✅ Recently shipped (this branch)

- [x] **Director creation overhaul** — archetype presets, 7 expressive axes,
  per-axis hints, live "how it shapes each chapter" preview, shared
  `src/lib/director.ts` consumed by UI + prompt builder + API.
- [x] **Director UI parity in the saga creator** (`/saga/new`).
- [x] **SEO** — fixed `robots.ts` sitemap URL, added `/admin` disallow,
  `WebSite`+`Organization` JSON-LD, web manifest, canonical + richer meta.
- [x] **Admin hub** (`/admin`) with overview stats; whole `/admin/*` tree
  `noindex`ed.
- [x] **Telemetry** — `analytics.track()` / `insights.track()`
  (`src/lib/telemetry.ts`), Firestore-backed with per-day rollups; client
  bridge at `POST /api/track`.
- [x] **Admin Users** (`/admin/users`) — roles, tiers, give/set credits,
  refresh daily allowance; backed by `/api/admin/users(/credits|/role)`.
- [x] **Admin Analytics & Insights** pages + APIs.
- [x] **Brand tab icons** via `APP_CONFIG.site.logoUrl` (env-overridable),
  wired into metadata icons, manifest, and JSON-LD logo.
- [x] **Broaden analytics instrumentation** — `world.created`,
  `route.contributed`, `purchase.completed`, plus `subscription.checkout`
  insight (in addition to `story.created` / `saga.created`).
- [x] **Saga draft persistence** — `useDraft` restore/discard banner on
  `/saga/new`, mirroring the story creator.
- [x] **🔴 Stripe webhook idempotency** — claim each `event.id` in a
  `stripeEvents` collection before processing; no more double-credit on
  Stripe's redeliveries.
- [x] **🔴 AI input bounds** — cap the assist prompt (4k chars) before it costs
  a credit; coerce `worldContext` into a bounded shape; wrap user text in
  `<user_input>` delimiters as a prompt-injection guard.
- [x] **🟠 Rate-limiter observability** — log loudly when Redis is unreachable
  instead of silently failing open.
- [x] **🟠 Test runner + first tests** — Vitest with the `@` alias; 28 tests
  over the highest-risk pure logic (ratings/age-gating, moderation, director).
- [x] **🟠 CI** — `.github/workflows/ci.yml`: typecheck + tests as hard gates,
  lint informational (pending debt cleanup).
- [x] **🟠 App Router error/loading UI** — root `error.tsx`,
  `global-error.tsx`, `not-found.tsx`, `loading.tsx`.
- [x] **🟠 Rate limiter fails closed** (review #6) — when Redis is unreachable
  the daily/free path now denies free generations and falls through to
  purchased credits (Firestore), closing the cost leak while keeping the paid
  path open. Covered by `rate-limit.test.ts`.
- [x] **Degraded vs out-of-credits messaging** — AI routes return a 503
  "temporarily unavailable" on a degraded limiter instead of a misleading 429
  "insufficient credits" (shared `lib/credit-response.ts`).
- [x] **Client-side reader analytics** — `BookViewer` emits `story.opened`
  (once per open) and `ending.reached` (with `isNew`) via `POST /api/track`
  through the new `lib/track-client.ts` helper, so the dashboard reflects
  reading, not just authoring.
- [x] **Admin hub live counts** — `/admin` overview now shows Events today and
  Insights today (cheap per-day rollup reads), linking to the analytics and
  insights pages.
- [x] **In-app test runner** — `/admin/tests` runs the Vitest suite via an
  admin-only API (fixed command, no shell) and **streams logs live** (NDJSON),
  showing pass/fail per file, failure messages, and a live-tailing output
  panel. Gated off in production unless `ENABLE_ADMIN_TEST_RUNNER=true`.
- [x] **Track group reads** — `RoomReader` (co-op) now emits `story.opened`
  tagged `source:'room'`; solo opens are tagged `source:'solo'`, so reads are
  attributable by mode.

---

## P0 — next up (engineering)

_All cleared — see P1 for the next wave (broader test coverage, zod
validation, lint-debt cleanup)._

### Post-ship review of PRs #49–#51 (efficiency / security / aesthetic)

Done in this pass:

- [x] **🔴 Credit mint via forged reading progress** — `story_read` /
  `first_choice` granted spendable credits off unvalidated, non-guest-gated
  `POST /api/progress`. Now: reads awarded only to registered accounts, and
  only when the story and reported node actually exist (`storyNodeExists`).
- [x] **🟠 Reward events reachable by guests** — `voice_heard` (feedback) is
  now registered-only; character voting rejects anonymous accounts (also
  closes anonymous vote-stuffing of the "most loved" sort).
- [x] **🟠 Reaction-counter regression** — dropped the shard subcollection
  (which kept the single-doc write it was meant to remove *and* added ~10
  reads/chapter-view). Per-type counts are now one `reactions` map on the node
  with atomic per-field increments; a chapter view reads one doc.
- [x] **🟠 Per-page-turn / per-choice Firestore waste** — achievements txn
  skips the (growing) doc rewrite when nothing changed; `incrementTraversal`
  returns the new count from its transaction (no second read; fixes the
  Path-Pioneer equality race).
- [x] **🟠 No `prefers-reduced-motion` + lightning strobe** — global CSS
  reduced-motion guard neutralizes ambient/shimmer/flash motion; the
  full-viewport lightning collapsed from 3 stacked 0.9-opacity layers to one
  at 0.4; `WorldPortalBreath` honors `useReducedMotion()`.

Remaining (P2/P3 — from the same review):

- [ ] **Ambient "None" can't override a world default** — `resolveAmbientVisual`
  treats explicit `'none'` as unset; distinguish `undefined` (inherit) from off.
  _Deferred: `ReadingTheme.ambientEffect` is a required field defaulting to
  `'none'`, so "off" and "untouched" are indistinguishable — a proper fix makes
  the field optional and migrates existing content (behavioral change), not a
  safe drive-by._
- [x] **Header nav overflows at tablet widths** (Rooms + Bounties pushed it to
  ~10 links from `sm:`) — desktop nav now shows at `lg:`; the hamburger sheet
  holds the links below that, so they no longer cram at tablet widths.
- [x] **Profile page makes 3 API calls** (frame/pet/achievements re-read the
  same docs) — one `GET /api/profile/state` now reads `userSettings` +
  achievements ONCE and returns all three slices; a small request-deduping
  client (`profile-state-client.ts`) makes the three self-contained panels
  share a single fetch per visit (invalidated on mutation). The old
  frame/pet GET handlers and the achievements route were removed (their POST
  mutations remain). Covered by `profile-state-client.test.ts`.
- [x] **Chapter unfurl stagger unbounded** — the per-child stagger now scales
  down with child count so the whole reveal fits a fixed ~0.9s budget; a long
  chapter no longer hides its last line ~2s behind the page turn, while short
  chapters keep the full beat.
- [x] **Unlisted-story titles leak** through the public bounty board / rooms
  lobby — both `listOpenBounties` and `listActiveRooms` now resolve each
  listing's story and drop unlisted (and unresolvable) ones, so a private
  story's title / link never surfaces publicly. Covered by
  `unlisted-listings.test.ts`.
- [x] **Character votes stored as a growing `voterIds` array** on the character
  doc — votes now live in a `votes/{uid}` marker subcollection (one doc per
  voter, so the character doc no longer grows or gets rewritten per vote), with
  `voteCount` denormalized for the "loved" sort. Legacy `voterIds` entries are
  still honored and removed on un-vote (array only shrinks; no backfill).
  Covered by the expanded `characters-fold2d.test.ts`.
- [~] **Polish** (partly done): `ProfileAvatar` circle now has `relative` (fill
  Image); `aria-label`s added to the frame, Reader Pal, and API-key/menu
  icon-only buttons; CSV export prefix-guards `=/+/-/@`/tab/CR (shared
  `lib/csv.ts`, unit-tested). _Remaining: guest-star buttons' labels; swap the
  achievement toast's ad-hoc `bg-[#1a1420]` for `glass-card` tokens._
- [x] **Residual — Path Pioneer self-farm** — the traverse endpoint was
  unauthenticated, so an author could script 25 hits on their own slot to mint
  the one-time 15-credit reward. Now: the public `traversals` popularity counter
  still counts every (incl. anonymous) read, but the credit-bearing MILESTONE
  counts only a distinct, registered, non-author reader, deduped once per
  (reader, slot) via a `slotTraversers` marker doc. Self-traversal and repeat
  hits from one account no longer move it, so "chosen by 25 readers" means 25
  genuinely different readers. Covered by `traversal-milestone.test.ts`.

## P1

- [x] **🟠 Expand test coverage** (review #4) — `CreditManager`, `rate-limit`,
  and the engine's deterministic pieces (seed-rng, goap-planner,
  faction-manager). Firestore/Redis-backed bits need light mocking.
  _Done: `rate-limit` covered in P0; added `credit-manager`, `seed-rng`,
  `goap-planner`, and `faction-manager` suites (+58 tests, in-memory
  Firestore + rate-limit fakes for the I/O-backed paths)._
- [x] **🟡 Schema validation layer** (review #8) — adopted zod via a shared
  `parseJson(req, schema)` helper (`src/lib/api-validation.ts`) returning a
  typed `{ ok, data }` / 400-response union. Migrated every body-parsing API
  route (~30) off ad-hoc `req.json()` to co-located zod schemas; malformed JSON
  and validation failures now return uniform 400s. Covered by
  `api-validation.test.ts` (+9 tests).
- [x] **🟠 Clear lint debt → make CI lint blocking** — 12 pre-existing errors
  across 8 files (`react-hooks/*`, `no-explicit-any`); fix, then drop
  `continue-on-error` from the CI lint step.
  _Done: all 12 errors fixed (typed Stripe/Firestore `any`s — incidentally
  correcting `current_period_end`, which now reads from the subscription
  item; derived the library world filter from the URL; moved external-store
  reads to lazy init / event handlers; two justified `set-state-in-effect`
  disables for the hydration-safe draft banner). Lint is now a hard CI gate;
  5 unused-var/exhaustive-deps warnings remain (non-blocking)._
- [x] **🟢 Generation observability** (review, green) — shared
  `generation-telemetry.ts` emits uniform `generation.completed` /
  `generation.failed` analytics events (with `kind`, net `credits`, `source`,
  and a categorized `reason`) from all four AI paths (assist, cover image,
  in-story chapter, saga). Failures distinguish model errors, safety refusals,
  editorial voids, and failed images; the chapter route reports net credits
  after image refunds. Reader drop-off is captured by a deduped
  `chapter.reached` event (depth, fired once per new max depth) in `BookViewer`.
  Daily rollups now answer "how many failed / how much did they cost / where do
  readers leave". Covered by `generation-telemetry.test.ts` (+4 tests)._
- [ ] **Reconcile `docs/ROADMAP.md`** once this branch merges (move the
  shipped items into its ✅ section).
- [x] **Admin Users search/filter** — debounced search box on `/admin/users`;
  the API does exact email/uid lookups plus a bounded substring scan
  (capped, with a "narrow your search" notice). Pure matcher in
  `lib/admin-user-search.ts`, unit-tested.
- [x] **Telemetry retention** — daily Vercel Cron (`vercel.json` →
  `/api/cron/telemetry-retention`, CRON_SECRET-gated) prunes raw `*Events`
  older than `TELEMETRY_RETENTION_DAYS` (30) in bounded batches, keeping the
  daily rollups. Logic in `lib/telemetry-retention.ts`, unit-tested.

## P2 — planned features (see `docs/ROADMAP.md`)

- [x] **🟡 Split oversized files** (review #9) — target ~500 LOC/file, SRP.
  - [x] `firestore-helpers.ts` 1451 → 15 domain modules (barrel; all <336).
  - [x] `ai.ts` 884 → 5 modules (prompts/shared/images/content/review; <255).
  - [x] `types/index.ts` 615 → 8 domain modules (barrel).
  - [x] `CoverDesigner.tsx` 640 → editor 387 + cover-theme + BookCoverPreview.
  - [x] `stories/new/page.tsx` 1255 → 624 (4 SRP sub-components, 2 shared).
  - [x] `saga/new/page.tsx` 698 → 504 (reuses the shared creator components).
  - [x] `profile/page.tsx` 741 → 607 (self-contained ApiKeySettings).
  - [x] `ChoiceSlots.tsx` 782 → 554 (SlotRequirementsEditor).
  - [x] `BookViewer.tsx` 977 → 823 (internals + dialogs extracted).
  - _Note: the lib/type files are fully <500. The reader-heavy component pages
    (stories/new 624, profile 607, ChoiceSlots 554, BookViewer 823) sit above
    target — the remainder is irreducible form/reader orchestration. Further
    splitting needs deep render extraction (risky prop-drilling) — left as a
    focused follow-up rather than forcing it._
- [x] **Co-op reading rooms PR 2** — frontier write-pause (write the next
  chapter in-room via the existing contribution endpoint; room advances for
  everyone once published), host kick, ended summary (chapters traversed +
  reader count), stale-member cleanup (>90s heartbeat prune, host
  reassignment). Since followed by guest (read-only) accounts, a Living World
  panel + join interstitial + reading-phase "Ready" gate, and softened benign
  write-race errors.
- [ ] Global leaderboards (denormalized aggregate counters).
- [ ] Global bounty board (collection-group query + index).
- [x] **Reader Pal** — v2 shipped: bond XP (10 levels) derived entirely from
  already-tracked achievement counts (zero new writes), 6 species with 3
  achievement-gated (cat/wisp/leviathan), 6 evolution stages each, 4 time-based
  moods, event-aware deterministic quips, level-up celebration + stat row on
  the profile panel, and a dismissible in-reader companion (`PalCompanion`)
  that reacts to chapter turns and endings. Still rule-based, never AI.
  Covered by the expanded `pet.test.ts`.
- [ ] **Custom AI-generated narrative shapes** — an author spends credits to
  have the AI generate a wholly custom narrative shape for their world (its
  own arc pool, pacing/stakes flavor, climax types), instead of picking from a
  fixed dramatic/gentle/preset list. Distinct from EXECUTION-PLAN.md M6 (more
  *preset* shapes chosen by the team + AI auto-classification) — this is
  per-world, author-initiated, and AI-generated on demand.

## 💡 Ideas & suggestions (surfaced while building)

Candidates that emerged from this session's work — not yet committed, ordered
roughly by value. (Reader analytics, admin hub live counts, Users search, and
telemetry retention already graduated into P0/P1 above; the `/api/track`
abuse guard below was also already covered by the Tier-3 throttle work.)

- [ ] **Author-reusable director presets** — let authors save a tuned director
  as a named preset and reuse it across stories; optionally share community
  presets alongside the built-in archetypes.
- [x] **"Surprise me" director** — `surpriseDirector()` picks a random
  archetype and jitters each axis ±0.15; a "Shuffle" button next to the
  archetype presets in `DirectorControls`.
- [x] **Director-aware cover art** — `describeDirectorForCoverArt()` translates
  the persona's axes/vision into art-direction notes (palette, composition,
  mood) folded into the cover-image prompt; wired from both `/stories/new`
  and `/saga/new`.
- [ ] **Funnel & retention in admin analytics** — a conversion view
  (worlds → stories → reads → purchases) and DAU/retention, beyond raw counts.
- [ ] **Per-user activity drill-down** — from `/admin/users`, open a user's
  tracked events, authored stories, and credit history.
- [x] **Admin audit trail** — `/admin/insights` got an "Admin actions only"
  toggle (count badge, `Shield` icon) that filters to `admin.*` events
  (credits adjusted, role changed) client-side from the same feed; no new
  index needed since the insights channel is already a low-volume signal
  feed, not a firehose.
- [x] **Richer per-page SEO** — `CreativeWork` + `BreadcrumbList` JSON-LD on
  `/stories/[id]` (linked to its world via `isPartOf`) and `/worlds/[id]`;
  story pages also picked up a missing `alternates.canonical`.
- [ ] **Logo-based brand assets** — once the logo is hosted, generate a proper
  multi-size favicon/PWA icon set and a logo-bearing OG image.
- [x] **Analytics export** — `GET /api/admin/analytics/export` (CSV or JSON,
  admin-only) + CSV/JSON download buttons on `/admin/analytics`, mirroring
  the existing feedback-export pattern.
- [x] **Abuse guard on `POST /api/track`** — already throttled (`throttle('track:${uid}', 120, 60)`
  in `src/app/api/track/route.ts`), same pass that covered `/api/feedback`.

## 🎨 Atmosphere & animation pass

There's already real infrastructure here — 9 reading page-styles × 9 ambient
effects, 12 cover gradients × 8 accents × 48 icons × 8 patterns × 8 border
frames, a 21-tone → atmosphere preset map for worlds, and framer-motion
already driving the page-flip and ending reveal. This pass expands the
presets and makes ambient dynamic rather than a single static per-story pick.

- [x] **More ReadingTheme presets** — 4 new page styles (Candlelight, Moonlit,
  Aurora, Storm; 9→13) and 3 new ambient effects (Aurora, Lightning,
  Moonbeams; 9→12), each with a full-screen particle effect, a contained
  mini preview, and a synthesized ambient soundscape.
- [x] **More cover/world atmosphere presets** — 4 new gradients (Amber,
  Orchid, Teal, Storm), 3 new accents (Teal, Indigo, Coral), 8 new
  emblems/icons each for covers and worlds, and 2 new patterns (Chevron,
  Honeycomb — a new `CoverPattern` value with its own `patternStyle()`
  case). All 22 `VALID_TONES` were already 1:1 covered in
  `TONE_ATMOSPHERES`, so no new tone mappings were needed. Also folded the
  3 new ambient effects (aurora/lightning/moonbeams) into `rollWorldTheme`'s
  pool, closing a gap left by the ReadingTheme preset expansion.
- [x] **Decouple ambient sound from ambient visual** — new
  `ReadingTheme.ambientSoundMode` (`match` / `auto` / `off`) resolved via
  `resolveAmbientSound()`; the visual (`ambientEffect`) is unchanged and
  always author-set, while the sound can now mirror it, go silent, or
  (once the next item lands) auto-follow the chapter's own scene.
- [x] **Per-world default ambient** — `resolveAmbientVisual()` falls back to
  the world's `theme.ambientEffect` when a story hasn't set its own; sound
  inherits the same fallback via `resolveAmbientSound`. Threaded
  `worldAmbientEffect` through `stories/[id]/page.tsx` →
  `BookViewerClient`/`GatedStoryReader` → `BookViewer`.
- [x] **Auto per-chapter ambient matching** — a new `AMBIENT: <effect>` marker
  (mirrors `LOCATION:`/`ENDING:`) folded into the existing chapter-generation
  and saga-opening prompts, so there's no added AI cost. Parsed by
  `parseAIResponse`, validated against the known effect list (unrecognized
  → no cue, graceful fallback), and stored as `StoryNode.sceneAmbient`.
  With `ambientSoundMode: 'auto'`, `BookViewer` now resolves the sound from
  the current chapter's own cue — falling back to the visual/world default
  on chapters with none.
- [x] **Achievement unlock celebration animation** — a new
  `AchievementUnlockToast` (framer-motion: spring-popped icon + a brief
  radiating burst) rendered via `toast.custom()` in `BookViewer`, replacing
  the plain text toast on a newly-earned ending achievement.
- [x] **Cover reveal flourish animation** — `BookCoverPreview`'s cover face and
  `CoverDesigner`'s thumbnail both fade + scale in (framer-motion, keyed by
  `coverImageUrl`) whenever a fresh AI cover is generated, regenerated, or
  removed.
- [x] **World portal ambiance animation** — the banner variant's
  pattern/atmosphere layer slowly breathes (scale) and the emblem drifts at
  its own pace (parallax), via a new `WorldPortalBreath.tsx` client wrapper;
  the dense `card` variant (world listings) is untouched and stays
  server-safe.
- [x] **Choice/chapter micro-interaction animations** — a written choice
  button now springs on tap (`whileTap`); `StoryContent` replaced its
  flat fade-in with a staggered, block-by-block reveal (quote → header →
  image → each paragraph) so a new chapter unfurls rather than snapping
  in as one piece.

## 🔒 Blocked on ops / deploy

- [ ] 🔒 Create + host the brand logo at
  `media.ilytat.com/chronicles-logo.png` (referenced by the tab icons).
- [ ] 🔒 Set env in Vercel: `NEXT_PUBLIC_APP_URL` (prod domain),
  `ADMIN_EMAILS`, optional `NEXT_PUBLIC_LOGO_URL` override.
- [ ] 🔒 Deploy `firestore.indexes.json` + `firestore.rules`. (New telemetry
  collections need only auto single-field indexes; the catch-all
  `allow read, write: if false` already denies client access to them.)
- [ ] 🔒 Run `npm run seed` with admin creds.
- [ ] 🔒 Smoke-test: bounty credit flows, age gating, rating containment,
  character continuity, co-op rooms (2-browser).
