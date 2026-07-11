# Reader Pal sprite sheets

Drop a PNG in this folder and the pal animates — no code changes, no manifest,
for existing species and any you add later.

## File naming

| File                        | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `{species}.png`             | Base sheet for a species (e.g. `bird.png`, `cat.png`)          |
| `{species}-l{level}.png`    | Optional per-life-stage sheet; `level` ∈ `1, 2, 3, 5, 7, 9, 10` |

Life stages (same arc for every species — it hatches, then grows up):

| Level | Stage       |
| ----- | ----------- |
| 1     | Egg         |
| 2     | Baby        |
| 3     | Juvenile    |
| 5     | Adolescent  |
| 7     | Adult       |
| 9     | Elder       |
| 10    | Legendary   |

Species ids today: `bird`, `dragon`, `sprout`, `cat`, `wisp`, `leviathan`, `dog`, `bunny`
(see `src/lib/pet.ts` — a new species there + a PNG here is all it takes).

Lookup order at runtime: the current stage's sheet → each earlier stage's
sheet (closest form wins) → the base sheet. So you can ship one base sheet per
species first, then add evolution sheets whenever. Sprite art is the default
look everywhere (including the species-picker swatches, which show the held
first idle frame of the Juvenile form); the stage emoji appears only as a last
resort for a species with no sheets at all, never as a loading placeholder.

## Sheet layout (the only hard rules)

- **5 rows** of **square** frames, in this exact top-to-bottom order:
  1. `idle`
  2. `sleep`
  3. `scared`
  4. `excited`
  5. `sad`
- Every row has the **same frame count** (pad a short animation by repeating
  its last frame).
- Any frame count, any resolution: the renderer measures the image —
  `frame size = image height ÷ 5`, `frames per row = image width ÷ frame size`.
- Transparent background PNG. Pixel art renders crisply (`image-rendering:
  pixelated`); the pal displays at ~44 px in the reader and ~64 px on the
  profile, so 64–128 px frames are plenty.

Example: a 4-frame sheet at 96 px cells → a **384 × 480** PNG.

## When each animation plays

| Animation | Profile panel (mood)      | In the reader                                  |
| --------- | ------------------------- | ---------------------------------------------- |
| `excited` | Thrilled (active ≤ 1 day) | Reaching an ending; being patted               |
| `idle`    | Content (≤ 3 days)        | Default while reading                          |
| `sad`     | Waiting (≤ 14 days)       | —                                              |
| `sleep`   | Dozing (> 14 days)        | No page turn for a few minutes                 |
| `scared`  | —                         | The story's tension pulse runs high (≥ 0.7)    |

Playback speeds live in `src/lib/pal-sprites.ts` (`ANIMATION_FPS`).
Readers with reduced motion enabled see the first frame, held.
