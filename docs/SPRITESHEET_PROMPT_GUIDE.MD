# 📜 Reader Pal Spritesheet Generation Guide

This guide contains the exact specifications and prompts required to generate all spritesheets (base and evolution stages) for the 8 species in the Reader Pal system. You can feed these prompts directly into Midjourney, DALL-E 3, Stable Diffusion, or any other image generator.

---

## 📐 Spritesheet Specifications

Every spritesheet must adhere to these structural constraints to be correctly parsed by the renderer:

*   **File Format**: PNG with a transparent background.
*   **Dimensions**: **384 × 480 pixels** (or any size with a **3:4 aspect ratio** where width is divisible by 4 and height is divisible by 5).
*   **Layout Grid**: Exactly **4 columns** by **5 rows** of square cells (e.g., 96×96px per frame).
*   **Animation Row Order** (Top to Bottom):
    1.  **Row 1**: `idle`
    2.  **Row 2**: `sleep`
    3.  **Row 3**: `scared`
    4.  **Row 4**: `excited`
    5.  **Row 5**: `sad`
*   **Frame Count**: 4 frames per animation, progressing left to right. Pad shorter animations by repeating the final frame.
*   **Aesthetic Style**: Clean pixel art, 16-bit retro game aesthetic, cute chibi proportions, vibrant colors, clear outlines.

---

## 🎨 Master Prompt Template

Use the following template for all sprite generation:

```text
Pixel art spritesheet, 4 columns by 5 rows of 96x96 pixel cells (384x480 total), transparent background.
[SPECIES & STAGE DESCRIPTION].
Row 1 (idle): [IDLE DESCRIPTION].
Row 2 (sleep): [SLEEP DESCRIPTION].
Row 3 (scared): [SCARED DESCRIPTION].
Row 4 (excited): [EXCITED DESCRIPTION].
Row 5 (sad): [SAD DESCRIPTION].
Style: Clean pixel art, 16-bit retro game aesthetic, cute chibi proportions, vibrant colors.
Each frame is clearly separated in a grid. NO solid background - transparency only.
```

---

## 🐾 Prompts by Species

### 1. 🐕 Dog (NEW)
**Colors**: Golden-brown fur, light cream belly, pink tongue.

*   **`dog.png` (Base Sheet) / `dog-l7.png` (Adult)**
    > A cute golden-brown dog with floppy ears and a wagging tail.
    > *   **Row 1 (idle)**: Sitting calmly, tail wagging back and forth.
    > *   **Row 2 (sleep)**: Curled up in a cozy ball on the ground, eyes closed.
    > *   **Row 3 (scared)**: Cowering low, tail tucked between legs, ears flat.
    > *   **Row 4 (excited)**: Bouncing up and down, tail wagging rapidly, tongue out.
    > *   **Row 5 (sad)**: Sitting with head resting on front paws, whimpering eyes.
*   **`dog-l1.png` (Egg/Paw Cocoon)**
    > A round golden-brown woven basket/cocoon with a glowing paw-print emblem on the front.
    > *   **Row 1 (idle)**: Gentle warm golden pulse from the emblem.
    > *   **Row 2 (sleep)**: Still and cozy, dim warm glow.
    > *   **Row 3 (scared)**: Shaking nervously side to side.
    > *   **Row 4 (excited)**: Pulsing brightly, sparks flying out.
    > *   **Row 5 (sad)**: Dull, faint glow, looking cold.
*   **`dog-l2.png` (Baby/Puppy)**
    > An extremely tiny round golden puppy with oversized floppy ears dragging on the ground and massive eyes.
    > *   **Row 1 (idle)**: Clumsy sit with a head tilt.
    > *   **Row 2 (sleep)**: Sleeping flat on its back, paws in the air.
    > *   **Row 3 (scared)**: Hiding completely behind its own large ears.
    > *   **Row 4 (excited)**: Chasing its own tail in circles, rolling over.
    > *   **Row 5 (sad)**: Sitting with huge puppy dog eyes, looking upward.
*   **`dog-l3.png` (Juvenile)**
    > A small fluffy golden puppy, growing more proportionate, ears starting to stand up slightly.
    > *   **Row 1 (idle)**: Alert sit, tilting ears left and right.
    > *   **Row 2 (sleep)**: Curled up with nose tucked under tail.
    > *   **Row 3 (scared)**: Cowering backwards, ears flat.
    > *   **Row 4 (excited)**: Play-bow stance, tail high and wagging.
    > *   **Row 5 (sad)**: Standing with head and tail drooped.
*   **`dog-l5.png` (Adolescent)**
    > A gangly teenage golden dog with long legs and a lean build, high energy.
    > *   **Row 1 (idle)**: Standing alert, looking side to side.
    > *   **Row 2 (sleep)**: Sprawled out lazily on its side.
    > *   **Row 3 (scared)**: Tense stance, backing away, ears alert but flat.
    > *   **Row 4 (excited)**: Running zoomies, jumping enthusiastically.
    > *   **Row 5 (sad)**: Sitting, looking away with ears back.
*   **`dog-l9.png` (Elder)**
    > A dignified old dog with a grey muzzle, gentle knowing eyes, and slightly slower movements.
    > *   **Row 1 (idle)**: Calm sit, slow gentle tail wag.
    > *   **Row 2 (sleep)**: Deep peaceful nap, occasional nose twitch.
    > *   **Row 3 (scared)**: Alert but steady, cautious look.
    > *   **Row 4 (excited)**: Happy panting, gentle happy hops.
    > *   **Row 5 (sad)**: Quietly resting head on paws, sighing.
*   **`dog-l10.png` (Legendary/Cosmic Wolf)**
    > A majestic starlight golden wolf-dog with a celestial mane, constellation patterns, and an aurora trail.
    > *   **Row 1 (idle)**: Floating majestically, stardust drifting from tail.
    > *   **Row 2 (sleep)**: Resting on a cloud of nebulae, starfield glow.
    > *   **Row 3 (scared)**: Growling defensively, celestial aura flickering.
    > *   **Row 4 (excited)**: Howling at a glowing crescent moon, aura expanding.
    > *   **Row 5 (sad)**: Sinking low, starlight dimming.

---

### 2. 🐇 Bunny (NEW)
**Colors**: White/cream fur, soft pink ears, pink nose, cotton tail.

*   **`bunny.png` (Base Sheet) / `bunny-l7.png` (Adult)**
    > A cute white bunny with long ears and a fluffy pink cotton tail.
    > *   **Row 1 (idle)**: Sitting, nose twitching, ears rotating.
    > *   **Row 2 (sleep)**: Flopped over on its side, sleeping peacefully.
    > *   **Row 3 (scared)**: Frozen alert, eyes wide, ears pressed flat to back.
    > *   **Row 4 (excited)**: Doing a "binky" (jumping and twisting mid-air).
    > *   **Row 5 (sad)**: Hunched over, ears drooped forward over eyes.
*   **`bunny-l1.png` (Egg)**
    > A pastel pink and white speckled egg with a tiny fluffy cotton tail attached to the top.
    > *   **Row 1 (idle)**: Rocking gently side to side.
    > *   **Row 2 (sleep)**: Still and quiet.
    > *   **Row 3 (scared)**: Shaking rapidly.
    > *   **Row 4 (excited)**: Bouncing up and down happily.
    > *   **Row 5 (sad)**: Leaning to one side, dim color.
*   **`bunny-l2.png` (Baby/Kit)**
    > A tiny round white fluffball kitten/kit, ears barely visible nubs, squinty eyes, pink nose.
    > *   **Row 1 (idle)**: Nose wiggling, tiny ear twitches.
    > *   **Row 2 (sleep)**: Curled into a tiny bean shape.
    > *   **Row 3 (scared)**: Shivering, eyes shut tight.
    > *   **Row 4 (excited)**: Making tiny micro-hops.
    > *   **Row 5 (sad)**: Flattened out like a pancake.
*   **`bunny-l3.png` (Juvenile)**
    > A small bunny with ears growing upright, starting to hop actively, fluffy cottontail.
    > *   **Row 1 (idle)**: Sitting, cleaning its face with its paws.
    > *   **Row 2 (sleep)**: Side-flop sleeping.
    > *   **Row 3 (scared)**: Thumping its back foot in alarm.
    > *   **Row 4 (excited)**: Mini binky hops.
    > *   **Row 5 (sad)**: Sitting huddled, ears back.
*   **`bunny-l5.png` (Adolescent)**
    > A medium cream bunny, long ears, sleek active build, curious expression.
    > *   **Row 1 (idle)**: Sitting up on hind legs, sniffing the air.
    > *   **Row 2 (sleep)**: Tucked in a tight loaf shape.
    > *   **Row 3 (scared)**: Bolting/alert stance, ready to run.
    > *   **Row 4 (excited)**: Full energetic binky leaps.
    > *   **Row 5 (sad)**: Flat on stomach, chin touching the floor.
*   **`bunny-l9.png` (Elder)**
    > A wise, soft, round grey-tipped bunny with half-lidded eyes and slow movements.
    > *   **Row 1 (idle)**: Slow nose twitch, serene sitting pose.
    > *   **Row 2 (sleep)**: Deep comfortable doze.
    > *   **Row 3 (scared)**: Quick ear flick, alert but calm.
    > *   **Row 4 (excited)**: Gentle happy hops.
    > *   **Row 5 (sad)**: Sitting quietly, ears resting low.
*   **`bunny-l10.png` (Legendary/Moon Rabbit)**
    > An ethereal lunar rabbit with glowing white fur, crescent-moon shaped ears, and a sparkling stardust trail.
    > *   **Row 1 (idle)**: Floating gently, soft silver glow.
    > *   **Row 2 (sleep)**: Sleeping curled inside a glowing moonbeam.
    > *   **Row 3 (scared)**: Glow turns deep purple, protective shield.
    > *   **Row 4 (excited)**: Dashes leaving a shooting-star trail.
    > *   **Row 5 (sad)**: Glow dimming like a waning crescent moon.

---

### 3. 🐦 Bird
**Colors**: Teal-blue body, orange beak, orange feet.

*   **`bird-l1.png` (Egg)**: Speckled teal-blue egg with wing markings. idle=wobble, sleep=still, scared=shake, excited=glow bounce, sad=teardrop.
*   **`bird-l2.png` (Baby)**: Tiny teal chick, huge head, wing nubs. idle=hops, sleep=closed eyes, scared=puffed trembling, excited=nub flap bounce, sad=droop.
*   **`bird-l3.png` (Juvenile)**: Small bird, tail growing. idle=wing stretch, sleep=head tucked, scared=ruffled, excited=flutter-jumps, sad=drooping.
*   **`bird-l5.png` (Adolescent)**: Medium bird, full feathers. idle=perched tail bob, sleep=roosting, scared=wings spread, excited=loop flying, sad=hunched.
*   **`bird-l7.png` (Adult)**: (Uses `bird.png` or `bird-l7.png`) Teal bird. idle=preening, sleep=peaceful roost, scared=alert wings, excited=soaring, sad=head down.
*   **`bird-l9.png` (Elder)**: Grey-streaked teal, spectacles. idle=wise nod, sleep=doze, scared=wide eyes, excited=dignified flutter, sad=contemplative.
*   **`bird-l10.png` (Legendary)**: Phoenix-like, trailing starlight feathers. idle=majestic float, sleep=stardust curl, scared=aura flicker, excited=radiant burst, sad=dim glow.

---

### 4. 🐉 Dragon
**Colors**: Red-orange scales, yellow/orange belly, small wings.

*   **`dragon-l1.png` (Egg)**: Red egg, glowing lava cracks. idle=pulse, sleep=dim, scared=flash, excited=bright glow, sad=fade.
*   **`dragon-l2.png` (Baby)**: Tiny red dragon, wing buds. idle=wobble walk, sleep=curled, scared=smoke hiccup, excited=fire burp, sad=tail droop.
*   **`dragon-l3.png` (Juvenile)**: Small dragon, wing horns. idle=tail swish, sleep=curled smoke, scared=wing huddle, excited=fire play, sad=head down.
*   **`dragon-l5.png` (Adolescent)**: Medium dragon, glide wings. idle=flame flicker, sleep=wing-blanket, scared=defensive flame, excited=glides, sad=sighs.
*   **`dragon-l7.png` (Adult)**: (Uses `dragon.png` or `dragon-l7.png`) Regal dragon. idle=regal sit, sleep=coiled, scared=defensive pose, excited=fire breath, sad=wings low.
*   **`dragon-l9.png` (Elder)**: Grey scale details, spiraled horns. idle=smoke rings, sleep=slumber, scared=weathered concern, excited=sage joy, sad=sorrow.
*   **`dragon-l10.png` (Legendary)**: Cosmic fire dragon, gold/red nebulae. idle=cosmic float, sleep=nebula coil, scared=reality ripple, excited=supernova, sad=dying star.

---

### 5. 🌱 Sprout
**Colors**: Light green, dark green leaves, brown soil base.

*   **`sprout-l1.png` (Seed)**: Acorn seed, tiny green crack. idle=rock, sleep=still root, scared=crack widen, excited=green pulse, sad=dull.
*   **`sprout-l2.png` (Baby)**: Single leaf, face in soil. idle=leaf wave, sleep=leaf hat, scared=burrow down, excited=pop up bounce, sad=wilt.
*   **`sprout-l3.png` (Juvenile)**: 2-3 leaves, walking root-feet. idle=leaf sway, sleep=curled, scared=flatten, excited=spin, sad=droop.
*   **`sprout-l5.png` (Adolescent)**: Flower bud, root-legs. idle=stretch, sleep=closed petals, scared=thorns out, excited=bloom tease, sad=curled.
*   **`sprout-l7.png` (Adult)**: (Uses `sprout.png` or `sprout-l7.png`) Flowering plant. idle=sway with pollen, sleep=closed bloom, scared=thorns, excited=bloom, sad=petals drop.
*   **`sprout-l9.png` (Elder)**: Tree bark texture, autumn leaves. idle=leaf drift, sleep=dormant, scared=shedding, excited=fruit, sad=bare branches.
*   **`sprout-l10.png` (Legendary)**: World Tree spirit, bioluminescent crystal. idle=pulse, sleep=dim glow, scared=root wall, excited=bloom burst, sad=rain.

---

### 6. 🐱 Cat
**Colors**: Orange striped coat, pink nose, green/yellow eyes.

*   **`cat-l1.png` (Paw Cocoon)**: Round fuzzy paw pod. idle=pulse, sleep=still, scared=shake, excited=glow, sad=dim.
*   **`cat-l2.png` (Kitten)**: Tiny orange kitten. idle=tilt head, sleep=curled ball, scared=poof tail, excited=toy pounce, sad=mew.
*   **`cat-l3.png` (Juvenile)**: Small striped cat. idle=paw lick, sleep=sprawled, scared=arch back, excited=pounce, sad=ears low.
*   **`cat-l5.png` (Adolescent)**: Lean teenage cat. idle=tail swish, sleep=loaf, scared=bristle, excited=zoomies, sad=sulk.
*   **`cat-l7.png` (Adult)**: (Uses `cat.png` or `cat-l7.png`) Orange tabby. idle=sit, sleep=loaf, scared=alert crouch, excited=run, sad=ignore.
*   **`cat-l9.png` (Elder)**: Grey muzzle, knowing eyes. idle=slow blink, sleep=nap, scared=alert, excited=purr, sad=contemplate.
*   **`cat-l10.png` (Legendary)**: Celestial starlight cat. idle=starlight float, sleep=moonbeam sleep, scared=scatter, excited=aurora trail, sad=eclipse.

---

### 7. ✨ Wisp
**Colors**: Blue-purple flame core, lighter particle trail.

*   **`wisp-l1.png` (Spark)**: Single sparkle. idle=twinkle, sleep=dim, scared=flicker, excited=pulse, sad=fade.
*   **`wisp-l2.png` (Baby)**: Small orb, tiny face. idle=bob, sleep=dim settle, scared=vibrate, excited=spin, sad=sink.
*   **`wisp-l3.png` (Juvenile)**: Teardrop shape, trail. idle=float sway, sleep=dim curl, scared=scatter, excited=spiral, sad=drip.
*   **`wisp-l5.png` (Adolescent)**: Flowing flame shape. idle=drift, sleep=pulse, scared=shrink, excited=burst, sad=flicker.
*   **`wisp-l7.png` (Adult)**: (Uses `wisp.png` or `wisp-l7.png`) Ghostly flame. idle=float, sleep=rest glow, scared=flicker, excited=radiant, sad=dim.
*   **`wisp-l9.png` (Elder)**: Runes in flame, silver trails. idle=wise drift, sleep=dormant, scared=ward, excited=rune glow, sad=fading.
*   **`wisp-l10.png` (Legendary)**: Nebula swirl, galaxy core. idle=nebula float, sleep=starfield rest, scared=warp, excited=supernova, sad=void.

---

### 8. 🐋 Leviathan
**Colors**: Deep blue-teal scales, light blue fins, white belly.

*   **`leviathan-l1.png` (Bubble)**: Translucent egg. idle=wobble, sleep=still, scared=ripple, excited=glow, sad=sink.
*   **`leviathan-l2.png` (Baby)**: Tiny seahorse. idle=wiggle, sleep=curl, scared=fin hide, excited=splash, sad=sink.
*   **`leviathan-l3.png` (Juvenile)**: Small serpent. idle=swim sway, sleep=coil, scared=puff, excited=loop, sad=droop.
*   **`leviathan-l5.png` (Adolescent)**: Medium serpent. idle=undulate, sleep=coil rest, scared=coil shield, excited=breach, sad=drift.
*   **`leviathan-l7.png` (Adult)**: (Uses `leviathan.png` or `leviathan-l7.png`) Sea serpent. idle=regal float, sleep=deep coil, scared=flared, excited=breaching, sad=sinking.
*   **`leviathan-l9.png` (Elder)**: Barnacles, faded teal scales. idle=drift, sleep=ocean bed sleep, scared=rumble, excited=surge, sad=abyss.
*   **`leviathan-l10.png` (Legendary)**: Cosmic ocean god, star scales. idle=cosmic swim, sleep=deep sea nebula, scared=tidal wave, excited=supercell, sad=void.
