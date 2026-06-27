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

---

## P0 — next up (engineering)

- [ ] **Admin hub live counts** — surface today's analytics total + open
  insights count on the `/admin` overview cards.
- [ ] **Track group reads** — `RoomReader` (co-op) doesn't yet emit
  `story.opened`; extend reader analytics to cover it.

## P1

- [ ] **🟠 Expand test coverage** (review #4) — `CreditManager`, `rate-limit`,
  and the engine's deterministic pieces (seed-rng, goap-planner,
  faction-manager). Firestore/Redis-backed bits need light mocking.
- [ ] **🟡 Schema validation layer** (review #8) — adopt zod (or extend
  `lib/validate.ts`) so the ~52 API routes parse request bodies uniformly
  instead of ad-hoc `req.json()` handling.
- [ ] **🟠 Clear lint debt → make CI lint blocking** — 12 pre-existing errors
  across 8 files (`react-hooks/*`, `no-explicit-any`); fix, then drop
  `continue-on-error` from the CI lint step.
- [ ] **🟢 Generation observability** (review, green) — track AI generation
  failures, credit cost, and reader drop-off via the telemetry channels so we
  can answer "how many failed / how much did they cost / where do readers
  leave" before adding engine depth.
- [ ] **Reconcile `docs/ROADMAP.md`** once this branch merges (move the
  shipped items into its ✅ section).
- [ ] **Admin Users search/filter** — by email/uid; the list is currently
  page-token pagination only.
- [ ] **Telemetry retention** — periodic prune of raw `*Events` docs (keep the
  daily rollups). Needs a scheduled job.

## P2 — planned features (see `docs/ROADMAP.md`)

- [ ] **🟡 Split oversized files** (review #9) — `firestore-helpers.ts` (~1451)
  by domain (stories/rooms/users), extract the story-creator form
  (`stories/new/page.tsx` ~1251) into sub-components; also `BookViewer.tsx`,
  `ai.ts`. Mechanical but wide — do as focused, test-backed passes.
- [ ] Co-op reading rooms **PR 2** (frontier write-pause, host kick, ended
  summary, stale-room cleanup).
- [ ] Global leaderboards (denormalized aggregate counters).
- [ ] Global bounty board (collection-group query + index).

## 💡 Ideas & suggestions (surfaced while building)

Candidates that emerged from this session's work — not yet committed, ordered
roughly by value. (Reader analytics, admin hub live counts, Users search, and
telemetry retention already graduated into P0/P1 above.)

- [ ] **Author-reusable director presets** — let authors save a tuned director
  as a named preset and reuse it across stories; optionally share community
  presets alongside the built-in archetypes.
- [ ] **"Surprise me" director** — a randomize button that lands on a coherent
  archetype with slight jitter, for authors who want a starting point.
- [ ] **Director-aware cover art** — feed the director's vision/axes into the
  cover-image generation prompt so the art matches the intended tone.
- [ ] **Funnel & retention in admin analytics** — a conversion view
  (worlds → stories → reads → purchases) and DAU/retention, beyond raw counts.
- [ ] **Per-user activity drill-down** — from `/admin/users`, open a user's
  tracked events, authored stories, and credit history.
- [ ] **Admin audit trail** — the `insights` channel already logs `admin.*`
  actions; surface a filtered audit view (who granted credits / changed roles).
- [ ] **Richer per-page SEO** — `CreativeWork`/`Article` + breadcrumb JSON-LD
  for story and world pages (the root only has WebSite/Organization today).
- [ ] **Logo-based brand assets** — once the logo is hosted, generate a proper
  multi-size favicon/PWA icon set and a logo-bearing OG image.
- [ ] **Analytics export** — CSV/JSON export of the analytics window for
  offline analysis.
- [ ] **Abuse guard on `POST /api/track`** — rate-limit client-emitted events so
  the telemetry collections can't be spammed.

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
