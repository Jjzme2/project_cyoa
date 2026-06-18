What's genuinely incomplete (architectural gaps, not bugs)

1. Economy ↔ Reader resources — the plan says "makes trade a viable strategic path." Today the
   economy simulation runs but its prices have no mechanical effect on Story.resources (the player's
   gold, provisions, etc.). This is a meaningful feature, not a quick fix — it requires adding
   resource-modifying effects triggered when market conditions cross thresholds, and surfacing that
   in the UI.

2. memoryEffects now exist on ChoiceSlot but nothing sets them — index.ts has ChoiceMemoryEffect and
   ChoiceSlot.memoryEffects, and the route now processes them. But there's no UI yet for story
   authors to declare which choices create positive/negative memories for named characters. That's
   the remaining author-facing piece.

3. Pre-existing lint errors — 26 errors in stripe.ts, creator-resources.ts, profile/page.tsx,
   dashboard/page.tsx, and NotificationBell.tsx. These all predate this branch. None are related to
   Layer 2.
