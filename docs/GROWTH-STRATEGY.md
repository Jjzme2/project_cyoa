# Chronicle — Growth Strategy

Living strategy doc. The companion to `ROADMAP.md` (what we're building) and
`GAMEPLAY-SYSTEMS.md` (engine depth). This one answers a different question:
**what turns a good creative platform into a phenomenon** — something that can
go viral, sustain a community for years, and eventually carry IP beyond the app
itself (characters, merch, an entertainment brand).

Status legend: 🎯 thesis · 🟢 in motion · 🔭 sequenced next · 🧊 deliberately not now.

---

## 🎯 The thesis

**Chronicle is a game and a character factory presented as a story website.**
Most "AI story" projects are a prompt box with a skin. Chronicle is not: worlds →
stories → sagas, a procedural engine (GOAP agents, factions, economy, procgen), a
shared multiverse, collectible endings, a credit economy with branch bounties,
co-op live reading, and continuity-enforced canon characters. The hard part —
the *game* — already exists.

The growth problem is therefore **not** "make the stories better." It's three
specific gaps that separate a good platform from a franchise:

1. **Text doesn't travel.** Every franchise we admire — Minecraft, Fortnite,
   Zelda, Pokémon — spreads as a *picture or a face*. Pikachu sells plushies; a
   paragraph does not. Chronicle's output is beautiful to read and nearly
   impossible to screenshot-and-spread. **We must manufacture visual,
   collectible, shareable artifacts out of the text we already generate.**

2. **Characters are trapped.** Our engine already mints persistent canon
   characters with enforced continuity — but they live as a sub-object
   (`StoryCharacter`) inside one story's prose. Pokémon is a franchise because
   creatures are *first-class, named, visual, collectible, and ownable*.
   Chronicle is uniquely positioned to be a character-IP firehose; today the
   characters are invisible the moment you close the book.

3. **There's no reason to come back on a Tuesday.** We have telemetry, an
   economy, and a multiverse, but no live-ops heartbeat — no seasons, events,
   or shared cultural moments. Live ops, not graphics, is what keeps Fortnite
   alive.

Everything below is downstream of these three.

---

## The franchise flywheel, mapped to systems we already have

The legends share four mechanics. We have the primitive for each — it's just
buried. The work is promotion, not invention.

| Legend principle | Their version | Our existing seed | The move |
| --- | --- | --- | --- |
| **Ownership** | "MY world / MY base" | Worlds, multiverse pools | A world is a *place people rep*, not a folder |
| **Collectibility** | Gotta catch 'em all | Endings collector | Collect *characters*, not just endings |
| **Beloved characters** | Mario, Pikachu, Link | Emergent canon cast + continuity | **Promote characters to first-class, ownable, visual objects** |
| **Social-proof artifact** | Fortnite clips | "Share path" link | A gorgeous auto-generated **card**, not a link |

---

## 🔭 Sequenced threads

Ordered as we're building them. Each is grounded in code that already exists, so
these are promotions of latent value, not green-field bets.

### 1. Growth-strategy doc 🟢
This document. Captures the thesis so the threads below share a why.

### 2. Share Card 🔭 — *the screenshot-able artifact*
**Highest ROI, lowest effort.** We already render branded 1200×630 OG cards via
`src/lib/og.tsx` (`renderOgImage`). The Share Card is the deliberate, *portrait*
-orientation, social-native (story/feed) version for three units:

- **Character card** — portrait + name + "appeared in 14 worlds."
- **Ending card** — "I reached *The Drowned Crown* — 1 of 340 who made it."
- **World-map card** — the world's map (we already build `WorldMap.tsx`) as a poster.

This is the TikTok / Instagram / Discord unit. *Nothing spreads until it exists.*
It's also the surface every later thread shares — characters, endings, and
events all become cards.

### 3. Seasons / Events (admin-defined) 🔭 — *the live-ops heartbeat*
A live-ops layer built on the economy + telemetry we already have. Admins define
time-boxed, multiverse-wide themed events ("The Sundering — a crisis everyone
writes into") from an admin screen. Gives players a *reason to return* and a
*shared cultural moment*, and gives us a recurring marketing beat. Starts as an
admin definition tool; surfaces to players as a banner + themed prompts + an
event-scoped leaderboard.

### 4. First-class Characters 🔭 — *the IP bet*
The big one. Promote the emergent canon cast from a story sub-object into a
**Character** entity: name, generated portrait (we already do cover-image
generation), one-line identity, and the worlds/stories they've appeared in.
Then:

- **Collect** characters across stories — an infinite, emergent "catch 'em all."
- **Travel the multiverse** — let a beloved character *cameo* in another world
  (we already built cross-world content pools; this is the Smash Bros. crossover
  instinct, and it's a viral engine).
- **Share** — a character page *is* a Share Card. That screenshots. That becomes
  a sticker, an enamel pin, a plush.

You don't need a toy factory to start an IP enterprise. You need **one
recognizable character people feel ownership of.** A platform that generates
thousands and lets the community vote the best to the top is a character-IP
source no studio can match.

---

## 🧊 Deliberately not now

- **Don't literally chase Minecraft/Fortnite.** They're real-time visual games
  with large teams. That's a category error for a text-AI platform and a path to
  burnout. Our real comp set is **Roblox / Scratch / AO3 / Character.AI** — UGC
  platforms that became institutions through *community and ownership*, not
  graphics. That legacy is reachable.
- **Don't add engine depth for marketing reasons.** The HTN planner, emotion
  models, and other `GAMEPLAY-SYSTEMS.md` items make stories better for people
  already inside. They do nothing for the cold-start virality problem. Build
  them because the craft deserves it — not to go viral.

---

## How to read this alongside the other docs

- **`ROADMAP.md`** — what shipped / what's outstanding, tracked against GitHub.
- **`GAMEPLAY-SYSTEMS.md`** — depth proposals for the procedural engine.
- **`GROWTH-STRATEGY.md`** (this) — *why* of the marketing/IP threads; the
  features it names graduate into `ROADMAP.md` as they ship.
</content>
</invoke>
