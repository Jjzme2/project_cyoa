# Gameplay Systems — Enhancement Proposal

Building on the procedural engine (GOAP agents, factions, economy, procgen). Each
item lists **what it is**, **how it helps *this* game**, and **effort/impact**.
Ordered by recommended sequencing. ★ = recommended next.

## Deepen what already exists

### ★ 1. Per-agent world-state namespacing + recurring goals  *(impact: high · effort: low-med)*
GOAP currently shares one global fact namespace, so once one NPC sets
`player.trustsAgent`/`agent.hasAdvantage` it counts for everyone and the sim
goes quiet after ~2 turns. Scope facts per agent (`agent.<name>.hasAdvantage`,
`rel.<name>.trust`) and let goals re-open (trust can be lost, advantage spent).
*This is the direct follow-up to the GOAP fix and the single biggest "feels
alive" win.*

### ★ 2. Drama Manager / AI Director  *(impact: high · effort: med)*
A meta-controller (cf. *Left 4 Dead*'s Director, Mateas & Stern's beat manager)
that tracks a **tension curve** and paces the existing encounter/quest/faction
generators — forcing lulls after spikes, escalating when the story stalls,
seeding a twist when tension flatlines. Turns random procgen into *paced* drama.

### 3. Story grammars / Propp functions for quests  *(impact: med · effort: med)*
`implementQuests` currently emits isolated fetch/kill/escort prompts. Structure
them with Proppian functions (villainy → departure → struggle → reward) or a
small grammar so quests form coherent arcs with setup and payoff.

### 4. Utility-AI action scoring  *(impact: med · effort: med)*
We already nudge goal choice by memory sentiment. Extend to **need curves**
(fear, greed, loyalty, fatigue) scoring *actions*, so behaviour is graded and
context-sensitive rather than binary. Complements GOAP (utility picks the goal,
GOAP plans the route).

## New systems

### ★ 5. Relationship graph + gossip propagation  *(impact: high · effort: med)*
A NPC↔NPC and NPC↔player affinity matrix. Betray one character and word spreads
(weighted by the faction graph we already have) → others grow wary; help someone
and allies warm to you. Reputation becomes systemic, not per-scene.

### 6. NPC belief/knowledge model (fog of war for minds)  *(impact: med · effort: med)*
NPCs aren't omniscient — they track *beliefs* about the player and the world,
updated by what they witness. Enables intrigue: deception, mistaken identity,
information as currency (ties into `social_persuade`/`hasInformation`).

### 7. Emotion appraisal (OCC / PAD model)  *(impact: med · effort: med)*
Give agents an emotional state derived from goal outcomes (hope/fear/anger/
relief) that colours the prose the AI is told to write. Cheap depth on top of
GOAP outcomes.

### 8. Mood finite-state machines  *(impact: low-med · effort: low)*
Per-NPC FSM (calm → suspicious → hostile → broken) gating dialogue tone and
available actions. Low effort, immediately readable in the prose.

### 9. Dynamic difficulty / pacing for stat games  *(impact: med · effort: med)*
For stories using resources, scale encounter danger to the player's current
standing (DDA) so it stays tense but fair. Pairs with the Drama Manager.

### 10. HTN plot planner (ambitious)  *(impact: high · effort: high)*
A story-level planner (Hierarchical Task Networks) that sets *plot* goals
("the betrayal must land by act 2") and decomposes them into beats the
per-NPC GOAP then executes. The visionary end-state: planned narrative, not
just reactive NPCs.

---

## Recommended sequence
1 → 2 → 5 → 3. Per-agent state makes NPCs feel alive; the Director paces the
whole; the relationship graph makes consequences systemic; story grammars give
quests shape. 6–10 are strong follow-ons once the core loop feels good.

---

# Narrative modes — evaluation & enhancement strategy

*(added after shipping the gentle narrative mode)*

## What shipped, and why it's sound

Every world now has a **narrative shape** — `dramatic` (traditional conflict
arcs) or `gentle` (conflict-free: wonder, friendship, joy) — resolved at ONE
seam (`lib/engine/narrative-mode.ts`) from an explicit author setting or the
world's own tone/rules/lore. The mode then reshapes the engine *systemically*,
not just as a prose instruction: the arc pool, pacing language, encounter
tables, stakes semantics, interlude flavour, and what the faction/economy sim is
allowed to narrate. Strengths worth preserving:

- **One resolver, many consumers.** Every subsystem asks the same function, so
  a new shape is an additive change, and modes can never disagree mid-story.
- **Conservative auto-detection.** Only explicit "no bad happens" declarations
  flip a world alone; soft signals need corroboration + an Everyone rating. A
  false "gentle" would be far worse than a missed one.
- **Suppression at the source.** Faction raids and market scarcity still *tick*
  (world continuity) but are never narrated in gentle mode — the model can't
  weave in conflict it never sees.
- **Family-locked arc chaining.** A long gentle story can never drift into a
  betrayal arc on movement 2.

## Known gaps (honest) and the strategy for each

1. **Detection is English keyword matching.** A world declared gentle in
   Spanish, or in idiosyncratic phrasing, won't auto-flip. *Enhancement:*
   classify once at world creation with the existing AI assist path and cache
   the result on the world doc (the explicit picker already covers the miss
   today).
2. **No per-story shape inside a dramatic world.** A gentle world locks all its
   stories gentle (correct — that's the world's law), but a dramatic world
   can't host one gentle story. *Enhancement:* a story-level `narrativeMode`
   clamped by the world exactly like content ratings are (a gentle WORLD can
   never be overridden dramatic).
3. **GOAP cast can still act hostile in a gentle world** (opt-in feature; the
   action library includes betray/attack/intimidate). The governing prompt
   block suppresses it in prose, but the sim shouldn't plan it at all.
   *Enhancement:* mode-filter the GOAP action library and goal set.
4. **Residual dramatic wording in shared surfaces.** The base chapter prompt's
   choice guidance ("one bold, one cautious, one cunning") and "moment of
   decision or tension", the ending-invite metaphors ("the storm has passed"),
   and the Living World panel's tension labels ("At a knife's edge") read
   dramatic. *Enhancement:* small mode-aware variants; panel says
   "Anticipation" in gentle worlds.
5. **Two shapes today.** The architecture is ready for more: `melancholic`
   (loss without villains), `mystery` (curiosity without danger), `slice-of-life`
   (no arc pressure at all — beats become vignettes). Each is: an arc pool +
   directive variants + (optionally) an encounter table. Add them as authors
   ask, not speculatively.
6. **No reader-facing signal.** A gentle world could show a small badge (nice
   for parents choosing with kids) and be a library filter. *Enhancement:*
   surface `resolveNarrativeMode` on world cards/detail.

Suggested order: **2 → 4 → 3 → 6 → 1 → 5** — per-story shape and wording
polish are cheap and immediately felt; GOAP filtering matters once gentle
worlds enable the cast sim; new shapes ride demand.
