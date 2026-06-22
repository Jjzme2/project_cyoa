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
