# Chronicle — Tiered Execution Plan

A prioritized, tier-bucketed backlog of the work that remains, so the most
important things ship first and the rest is legible (and exportable to an AI
coding agent). Companion to `ROADMAP.md` (history), `GROWTH-STRATEGY.md` (the
why), and `GAMEPLAY-SYSTEMS.md` (engine depth).

Tiers: **T0** do-now / critical · **T1** next · **T2** later · **🔒 Ops** can't
be done from the codebase alone.

> Note on interpretation: "Tier 0" is read here as the top-priority execution
> bucket — the work that hardens and completes what just shipped before we add
> more surface area.

---

## T0 — now / critical

- [x] **Abuse-guard the new public write endpoints.** The feedback board and the
  `/api/track` bridge are authenticated but otherwise unthrottled — a single
  account could spam them. Add a lightweight, fail-open Redis throttle and apply
  it to `POST /api/feedback` (a few posts/hour) and `POST /api/track` (drop
  excess events silently). _(Was also flagged in `TODO.md` → abuse guard on
  track.)_
- [x] **Reconcile the docs.** Fold everything shipped recently (multiverse
  echoes + character cameos, first-class Characters + portraits, Seasons/Events,
  Share Cards, the feedback board, story→saga carry-over, saga branch-in) into
  `ROADMAP.md`'s shipped section so the planning docs reflect reality.
- [ ] 🔒 **Smoke-test the saga work** (manual, 2 accounts): branch a saga from a
  chapter, confirm the one-saga-per-world block (409 → opens the existing one),
  the per-chapter counter increments, and bounties no longer appear on sagas.

## T1 — next

- [ ] **Feedback priority tiers + ranked export.** Let admins tag each feedback
  item with a tier (T0–T3); have the JSON export order/filter by tier so the
  coding agent gets the most important work first. (Directly extends the
  export-to-agent workflow.)
- [ ] **Feedback vote throttle + edit/delete.** Throttle vote toggling; let an
  author edit or withdraw their own post; let admins remove abuse.
- [ ] **Character Fold 2d.** Author-claimed / curated characters with community
  voting; an opt-in "guest star" control for hand-picked cameos beyond the
  automatic connection-based ones.
- [ ] **Co-op rooms PR2** (planned in `ROADMAP.md`): frontier write-pause, host
  kick, ended summary, stale-room cleanup.

## T2 — later

- [ ] **Global leaderboards** (most-loved / most-travelled paths, top writers) —
  denormalized aggregate counters.
- [ ] **Global bounty board** — discovery surface for open bounties
  (collection-group query + index).
- [ ] **Engine depth** (`GAMEPLAY-SYSTEMS.md`): per-agent world-state
  namespacing, drama manager, relationship graph + gossip.
- [ ] **Richer per-page SEO** — `CreativeWork`/`Article` + breadcrumb JSON-LD on
  story/world pages.

## 🔒 Ops / deploy (not codeable here)

- [ ] Host the brand logo; set `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`,
  `NEXT_PUBLIC_LOGO_URL` in Vercel.
- [ ] Deploy `firestore.indexes.json` + `firestore.rules`; run `npm run seed`.
- [ ] Confirm Upstash Redis env is set in production (the throttle + rate limiter
  fail safely without it, but it should be configured).
