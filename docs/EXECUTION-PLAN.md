# Chronicle — Tiered Execution Plan

The prioritized backlog. Companion to `ROADMAP.md` (history), `GROWTH-STRATEGY.md`
(the why), and `GAMEPLAY-SYSTEMS.md` (engine depth). Status: `[x]` done · `[ ]` open.

---

## ⏱️ The Speed Queue — everything open, ordered by time-to-done

The working order. Within each bucket, top-to-bottom is the suggested sequence;
★ marks the highest-impact item regardless of speed.

### ⚡ Quick wins (≤ ~1 hour each)

- [x] **Q1. Mode-aware wording polish.** The last dramatic-flavoured strings in
  shared surfaces: the chapter prompt's choice guidance ("one bold, one
  cautious, one cunning" / "moment of decision or tension"), the ending-invite
  metaphors ("the storm has passed"), and the Living World panel's tension
  labels — gentle worlds should read "Anticipation", not "At a knife's edge".
- [x] **Q2. Gentle-world badge.** Surface `resolveNarrativeMode` on world cards
  and the world page (a small leaf/heart badge) so gentle worlds are visibly
  gentle — useful for parents and for setting expectations before writing.
- [x] **Q3. `/api/track` event-name allowlist.** Client can currently emit any
  event name into analytics; constrain to a known list.
- [x] **Q4. Meter the remaining AI surfaces.** Rate-limit `/api/ai/assist`
  questions mode; meter world-genesis generation.

### 🚶 Same-day items (roughly 2–5 hours each)

- [x] ★ **S1. "Jump Right In" mode — the newcomer's first five minutes.** The
  app currently front-loads its depth (worlds, sagas, directors, engines) and
  can overwhelm; the goal is: *one tap to reading, one nudge to writing.*
  - **v1 scope:** a hero "Jump right in" action on the homepage that opens a
    curated featured story instantly — no account, no choices about choices.
  - A one-time, dismissible first-run whisper (not a tour): "Read. Choose.
    When you reach an open path — write what happens next."
  - At the first empty slot a newcomer meets, a warm nudge with a one-line
    starter suggestion; sign-in is asked for only at submit, and their written
    text survives the auth round-trip (draft-preserved).
  - A "60-second start" for writers: pick a template world → prefilled
    protagonist/opening via the existing AI-assist path → writing by minute two.
  - Funnel telemetry: `onboarding.jumped_in` → first choice → first written
    path → first story created.
  - *Deeper v2 (multi-day, later):* personalized starting shelf, a guided
    first-saga, homepage redesign around the flow.
- [x] **S2. Per-story narrative shape, clamped by the world.** A dramatic world
  may host a gentle story; a gentle world can never be overridden dramatic
  (same clamp philosophy as content ratings). Story-creator picker + clamp.
- [x] **S3. Season scheduler.** Auto-activate/rotate seasons so live-ops doesn't
  depend on an operator remembering (extends `/admin/seasons`).
- [x] **S4. GOAP filtering in gentle worlds.** The cast sim shouldn't even PLAN
  betray/attack/intimidate actions in a gentle world (today only the prose
  layer suppresses them).
- [x] **S5. Feedback priority tiers + ranked export.** Admins tag items T0–T3;
  the JSON task-list export orders by tier — feeding the coding-agent loop.
- [x] **S6. Money-path integration tests.** Slot-fill and Stripe-webhook
  handler tests reusing the proven in-memory firestore/rate-limit fakes.

### 🧗 Multi-day items

- [ ] **M1. Rooms lobby + global bounty board.** In-app discovery for the two
  social features that exist but are invisible (bounty board needs a
  collection-group index → ops step).
- [ ] **M2. Collapse the 3 sequential per-chapter LLM calls** (review → generate
  → judge) into fewer round-trips — the biggest latency/cost lever; needs
  careful behavioural testing.
- [ ] **M3. Scale denormalization.** Node ancestry (`pathIds`), bounded/paginated
  author reads, sharded reaction counters.
- [ ] **M4. Characters Fold 2d.** Community curation/voting to surface the best
  characters; hand-picked "guest star" cameos beyond connection-based ones.
- [ ] **M5. Co-op rooms PR2.** Frontier write-pause, host kick, ended summary,
  stale-room cleanup.
- [ ] **M6. New narrative shapes + AI-assisted detection** (melancholic /
  mystery / slice-of-life; classify-at-creation) — build as authors ask.

### 🔒 Ops (not codeable from the repo)

- [ ] **O1. Two-account smoke test:** saga branch-in, endings (incl. win/lose
  conditions), story reset, bounty escrow flows, gentle-world generation.
- [ ] **O2. Standing deploy list:** env vars, Firestore indexes/rules, seed,
  brand logo hosting.

---

## Tier 0 — Correctness & safety (do first)

- [x] **1. Encrypt with scrypt + per-record salt.** `src/lib/encrypt.ts` derived
  the AES key by padding/truncating the secret (no KDF, no salt). Now scrypt with
  a fresh random salt per record (`v2:salt:iv:tag:ct`); legacy ciphertexts still
  decrypt. (+6 tests.)
- [x] **2. Ownership / root-exists guard on `POST /api/stories/[id]/nodes`.** Root
  creation now requires the author and that no root exists yet; a contribution
  requires its parent to exist in the same story.
- [x] **3. Bind 2FA to the session server-side.** A valid TOTP now stamps a
  `twofaVerifiedAt` custom claim (server-authoritative, not client-trusted),
  surfaced on `AuthContext`; the verify response asks the client to refresh its
  token. _Follow-up: require a recent `twofaVerifiedAt` on the most sensitive
  mutations + clear it on sign-out._
- [x] **4. Shared error wrapper → JSON 500.** `apiHandler()` wraps a route so any
  unhandled throw becomes a clean JSON 500. Applied to the money path (bounty)
  and a community write (feedback). _Follow-up: roll out across the remaining
  routes._
- [x] **5. Atomic bounty/moderation credit grants.** Payouts/refunds now happen
  inside the same transaction as the status change (`grantCreditsInTxn`), closing
  the paid-but-not-credited window; the moderation-approve payout also re-reads to
  prevent double-pay.

## Tier 1 — The fun unlock (highest leverage)

- [x] **6. Frame the real loop (copy).** Product call: keep the CYOA — the reader
  *chooses by writing* where they go, the AI brings the chapter to life, and it
  becomes a community path the next reader can take. Homepage "How it works"
  reworded to that loop (no silent auto-continue; authoring stays the point).
- [x] **7. Surface the simulation.** A reader-facing **"Living World" panel** —
  tension meter, faction standings, market state, and cast-affinity ("Kael has
  grown cold") — built server-side into a compact `WorldPulse` on each chapter
  (no engine classes shipped to the client) and rendered, page-themed and
  collapsible, in the reader. (+4 tests.)
- [x] **8. Turn the safe engine layers ON by default.** Drama/pacing,
  environment, factions, and economy now run for every story (GOAP agents +
  quests stay opt-in inside the builder). _Follow-up: reframe "Advanced" as a
  "Living World" you tune down, not opt into._

## Tier 2 — Stickiness & growth

- [x] **Story endings (v1).** Stories can now genuinely *conclude*. The engine
  invites an ending — rarely, only when earned — past a minimum depth and when
  the plot through-line resolves, the path runs long, or tension spikes and
  settles; the model writes a final chapter and emits `ENDING: title | type`
  (triumphant / tragic / bittersweet / mysterious / secret). The node is terminal
  (no slots), gets an **animated, type-themed "The End" reveal** in the reader,
  and a **type-coloured share card** (the viral payoff). +8 tests.
- [x] **Story endings (v2) — author win/lose conditions.** Authors define
  resource thresholds (e.g. `Health <= 0 → tragic "The Last Breath"`) in the
  story creator's Advanced Engine Features. When the reader's resources meet a
  condition, the next chapter they write is forced into that definitive ending
  (server guarantees it terminal). Pure evaluator `metEndingCondition` (+6
  tests); persisted on the story; editor with resource/operator/threshold/
  type/title rows.
- [x] **9. Narrative-aware achievements.** Reaching a definitive ending now
  awards in-fiction achievements (first ending, a *secret* ending, all five
  ending types) — verified server-side from the node. Each earned achievement
  has its own **share card** (`/api/share-card/achievement/[id]`), surfaced as a
  hover-share on the profile and a toast on unlock. Endings-reached added to the
  profile stats.
- [x] **Gentle narrative mode.** The engine no longer assumes a conflict arc.
  Each world has a narrative SHAPE — `dramatic` (traditional) or `gentle`
  (conflict-free: wonder, friendship, joy) — resolved from an explicit author
  setting or derived from the world's own tone/rules/lore ("no bad happens
  here" is decisive). Gentle worlds get their own arc pool (climaxes of shared
  wonder / gathering / friendship / a labor of love), delight-flavoured pacing
  & encounter hooks, meaning-not-danger stakes, reverie interludes, and no
  faction-rivalry/scarcity narration; a governing prompt block leads the system
  events (and saga openings). Author picker on `/worlds/new`. (+11 tests.)
- [ ] **9b. (more) Narrative-aware achievements** (secret endings, NPC bonds, faction
  outcomes, "path chosen by N readers") — each auto-generating a share card.
- [ ] **10. In-app discovery** — a public-rooms lobby and a bounty-board page
  (plumbing exists; both are dead without out-of-band links today).
- [ ] **11. A season scheduler** so the live-ops heartbeat doesn't depend on an
  operator remembering.

## Audit 2 — post-feature security & integrity pass *(all fixed inline)*

Fresh pass over everything added since the Tier-0 hardening (endings, cameos,
feedback, achievements, gentle mode, reset):

- [x] **JSON-LD XSS (high).** Character-page structured data embedded raw
  `JSON.stringify` in a `<script>` — a name containing `</script><script>…`
  escaped the block. Fixed with `jsonLdSafe()` (escapes `<`, U+2028/9), used
  uniformly (character page + root layout). +2 tests.
- [x] **2FA brute force (high).** No attempt cap on the 6-digit TOTP space —
  now 8 attempts / 5 min per user.
- [x] **Feedback vote spam (med).** Toggle now throttled 30/min per user.
- [x] **Share-card render cost (med).** All card image routes now send
  `Cache-Control: public, s-maxage=300, stale-while-revalidate` so the CDN
  absorbs repeats of the expensive satori renders.
- [x] **Ending-achievement integrity (med).** Re-POSTing the same ending no
  longer inflates `endingsReached` — counted keys tracked per user (idempotent).

Reviewed and found sound: saga-branch node access (path-scoped refs prevent
cross-story reads), reset authorization + escrow refunds, portrait route
authorization + credit refund path, feedback voter-id privacy, seasons public
read caching, prompt-injection delimiters on user text.

## Tier 3 — Scale hardening (before traffic grows)

- [ ] **12. Collapse the 3 sequential per-chapter LLM calls.**
- [ ] **13. Denormalize node ancestry (pathIds)** + bound/paginate author reads +
  sharded reaction counters.
- [ ] **14. Cache the share-card / OG routes.**
- [ ] **15. Handler/integration tests** for slot-fill and the Stripe webhook money
  paths (reuse the proven `credit-manager.test.ts` firebase-admin mock).
- [x] **16. Rate-limit non-credit write endpoints** — fail-open throttle on
  `/api/feedback` and `/api/track`. _Remaining: meter world genesis, rate-limit
  `/api/ai/assist` questions mode, allowlist `/api/track` event names._
