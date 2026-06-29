# Chronicle — Tiered Execution Plan

The prioritized backlog. Companion to `ROADMAP.md` (history), `GROWTH-STRATEGY.md`
(the why), and `GAMEPLAY-SYSTEMS.md` (engine depth). Status: `[x]` done · `[ ]` open.

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
  _v2 follow-up: author win/lose conditions (resource thresholds → forced
  triumphant/tragic endings) need resource-condition plumbing + author UI._
- [x] **9. Narrative-aware achievements.** Reaching a definitive ending now
  awards in-fiction achievements (first ending, a *secret* ending, all five
  ending types) — verified server-side from the node. Each earned achievement
  has its own **share card** (`/api/share-card/achievement/[id]`), surfaced as a
  hover-share on the profile and a toast on unlock. Endings-reached added to the
  profile stats.
- [ ] **9b. (more) Narrative-aware achievements** (secret endings, NPC bonds, faction
  outcomes, "path chosen by N readers") — each auto-generating a share card.
- [ ] **10. In-app discovery** — a public-rooms lobby and a bounty-board page
  (plumbing exists; both are dead without out-of-band links today).
- [ ] **11. A season scheduler** so the live-ops heartbeat doesn't depend on an
  operator remembering.

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
