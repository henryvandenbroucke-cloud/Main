# Blockhollow revamp plan

The goal is to make Blockhollow look and feel like Minecraft with a top-tier shader pack (BSL or Complementary style), while keeping everything the game already has.

## What stays the same

- **World and places:** the world generator, the six biomes, and every village, landmark, camp and dungeon, in the same places with the same layouts and purposes.
- **Game rules:** the 30-quest chain, the power-ups, crafting recipes, items, enchanting and potions.
- **Modes:** Survival, Creative and Parkour, including the Skyward Spiral, its checkpoints and its timer.
- **Creatures:** all 40+ creatures and both bosses, with their behaviour and attacks.
- **Saving:** saves keep working, and the game still runs offline from one file (`Blockhollow.html`).

Nothing is rebuilt from scratch. Each part is upgraded where it already lives in the code.

---

## Phase 1: Blocks that look like Minecraft

**Problem now:** every 16×16 texture is blown up 4× and smoothed, so blocks look blurry and "painted". Real Minecraft, even with shaders, keeps sharp square pixels.

- Show textures with **sharp pixels** (nearest-neighbour), like vanilla. Mipmaps and padding stay, so far-away blocks don't shimmer.
- **Repaint every block** in the vanilla style. That includes grass (with the side overhang), dirt, stone, cobblestone, gravel, sand and sandstone, logs and planks, leaves, ores, bricks, stone bricks, mossy and cracked variants, wool, glass, the workshop blocks, flowers, crops and fluids. Everything is still drawn in code, not copied from Minecraft's files.
- **Grass and leaves change colour by biome,** like Minecraft: lush green in the meadow, deep green in the ancient forest, olive in the marsh, and so on.
- **3D relief that follows the pixels** (normal maps), so stone and bricks catch the light the way shader packs with PBR textures do. It stays crisp.

## Phase 2: Shaders, sky and atmosphere (BSL / Complementary look)

Reference: popular shader packs keep vanilla textures and add soft moving shadows, god rays through leaves at dawn and dusk, volumetric fog, bloom on light sources, reflective wavy water, waving plants, blocky but 3D-shaded clouds, vivid skies and filmic colour.

- **Sunlight and shadows:** warmer, stronger sun, cooler blue sky light in the shade, and softer shadow edges that get blurrier further from the object.
- **Torches and lanterns:** warm orange light that falls off smoothly, gives a cozy glow at night, and blooms.
- **God rays:** real light shafts. Trees and buildings block them, so beams come through gaps in leaves at sunrise and sunset.
- **Sky:**
  - deeper blue at noon and rich orange and pink sunsets;
  - a square, Minecraft-style sun and moon, with moon phases;
  - twinkling stars;
  - **blocky Minecraft clouds with real 3D shading**, lit from the sun and pink at sunset.
- **Fog:** much less of the white haze seen now. Distant land fades into a soft blue, and there's gentle valley mist at dawn.
- **Water:** clear in the shallows and deep blue further out, with reflections of the world and sky, wave sparkles, see-through refraction and gentle foam.
- **Moving plants:** leaves, grass, flowers, crops, vines and lily pads sway in the wind.
- **Colour grading:** filmic tone curve (ACES), richer but not oversaturated colours, and less vignette.
- **Night:** moonlit blue, dark but still readable, so villages glow warmly.

## Phase 3: Structures, and a real king

**The Knelt Sovereign** is rebuilt as a statue you'd recognise as a king from far away:

- a large crown with points and gems;
- a face with brows, eyes, nose and a full beard, bowed in respect;
- a long royal cape with a fur trim, draping onto the ground behind him;
- a detailed breastplate, pauldrons and gauntlets;
- both hands resting on the pommel of a huge greatsword planted in the stone.

It stands on a tiered stone plinth with steps, gold trim and braziers, among banners, hedges, flower beds and a reflecting pool, about 30 blocks tall.

**Every other structure** keeps its location, layout and use, but gets cozier details:

- window frames and shutters, flower boxes, and chimneys with smoke;
- lanterns by the doors, fences and gardens;
- properly shaped roofs with overhangs and trim;
- furnished interiors (beds, tables, bookshelves, carpets) with warm light inside;
- paths edged with gravel and grass.

The Ashen Bastion, the Drowned Halls and the other dungeons get more depth, texture variety and lighting mood.

## Phase 4: Animations, creatures and bosses

**One shared animation system** replaces the separate sine-wave hacks:

- **Walking:** legs move with the distance travelled, so feet don't slide. Walking blends smoothly into trotting and running.
- **Looking around:** heads turn toward you smoothly, within natural limits.
- **Bounce:** ears, tails, manes and wattles follow through with a spring.
- **Jumping and landing:** squash and stretch.
- **Getting hit:** a red flash and a knockback flinch.
- **Dying:** a Minecraft-style tip-over followed by a puff of smoke.

**Creature models:**

- proportions and faces tuned closer to Minecraft's mobs;
- sharp pixel-art skins;
- the same 40+ creatures, names and roles.

**Bosses (the Mirewarden and the Sleeping Colossus):**

- more detailed models, with glowing weak points;
- clear wind-up, then impact, then recovery on every attack;
- tuned hit-stop, screen shake and particles;
- better death sequences.

**The player:**

- a Minecraft-style arm and swing arc;
- held items sized and placed like vanilla (no more compass covering a quarter of the screen);
- vanilla-style view bobbing and placing animations;
- dropped items bob and spin;
- blocks break with Minecraft-style cracks and particles that use the block's own texture.

## Phase 5: Clean, human-made UI (from the design critique)

The critique is at the bottom of this file. In short, the gold serif headings, italic taglines, monospace text, dark see-through panels and browser-default blue sliders are what make it feel AI-generated.

- **One pixel font** for the whole game (embedded, works offline), with white text and a drop shadow like Minecraft.
- **Minecraft-style panels:** light grey bevelled windows with sunken slots for the inventory, chests, crafting and enchanting.
- **Chunky stone-grey buttons** with a hover highlight on every menu. The title screen gets the classic centred layout, with a yellow tilted splash text.
- **HUD:**
  - hearts, hunger, hotbar and crosshair laid out exactly like Minecraft;
  - the quest card becomes a small, collapsible line;
  - fewer pop-ups.
- **Settings in tabs** (Video, Audio, Controls, Gameplay). Sliders show their value, for example "Render Distance: 8 Chunks".
- **Easier to play:**
  - shorter labels;
  - armour slots shown as outlines instead of words;
  - pause always closes other windows;
  - clearer hints the first time you see something;
  - an optional auto-jump.

## Phase 6: Polish, speed and checks

- Make sure the Low, Medium, High and Ultra presets still keep the frame rate smooth.
- Screenshot-test every biome, village, dungeon, boss and time of day.
- Rebuild `Blockhollow.html` and update the README.

---

## Appendix: design critique of the current UI

### Overall impression

The game is packed with good features, and the hotbar and hearts already feel like Minecraft. Everything around them uses a dark "fantasy RPG" theme: gold serif headings, italic taglines, monospace body text and dark see-through panels. That mix, together with long explanatory labels, is what reads as AI-generated. The biggest win is to use Minecraft's own UI language throughout.

### Usability

| Finding | Severity | Recommendation |
|---|---|---|
| The held item (the compass) covers about a quarter of the screen in first person | 🔴 Critical | Shrink it and move it lower right, like vanilla |
| Pause opens on top of the inventory, so both show at once | 🟡 Moderate | Pause closes every other window first |
| The quest card always takes five lines of the top-left corner | 🟡 Moderate | One compact line that expands with J and hides during menus |
| Settings is a single 20-row scroll with browser-default blue sliders and no values shown | 🟡 Moderate | Tabs, plus Minecraft slider buttons that show the value |
| Crafting header is long ("Crafting (2×2 · stand near a crafting table for 3×3)") | 🟢 Minor | "Crafting", with the 3×3 hint only when it matters |
| Armour slots are written as words (Helm, Chest…) | 🟢 Minor | Grey armour outlines, like vanilla |
| Recipes you can't make yet are dimmed to very low contrast | 🟢 Minor | Keep them readable and mark the missing ingredients in red |

### Visual hierarchy

- **What you see first in play:** the held compass and the quest card, before the world. It should be the world and the crosshair.
- **Title screen:** the logo leads well, but the left-aligned menu box and italic tagline compete with each other. A centred stack reads faster.
- **Inventory:** three equal columns compete for attention. The inventory grid should be the anchor, with the recipe book secondary.

### Consistency

| Element | Issue | Recommendation |
|---|---|---|
| Fonts | Georgia serif, italic serif and monospace all mixed | One pixel font everywhere |
| Accent colour | Gold is used for headings, borders, rewards and buttons alike | Neutral grey UI; colour only for meaning (rewards, warnings, enchantments) |
| Form controls | Browser-default blue sliders, white checkboxes and native drop-downs | Custom Minecraft-style buttons and sliders |
| Buttons | Left-aligned text on the title, centred in pause | One button style |

### Accessibility

- **Contrast:** small grey monospace text on see-through dark panels (quest progress, dimmed recipes) falls to about 2–3:1. Use white text with a shadow on solid panels (over 7:1).
- **Click targets:** 44px slots and 36px buttons are fine.
- **Readability:** small italic serif text is hard to read over a moving 3D scene.

### What works well

- The hotbar, hearts and hunger row already match Minecraft's layout.
- The title screen fly-over tour is a lovely background.
- The recipe book that auto-fills the grid is a great ease-of-play feature.
- The game-mode cards are clear.

### Priorities

1. One pixel font plus Minecraft grey panels and buttons. This is the biggest change to how human-made it feels.
2. Declutter the HUD (held item size, quest card, pop-ups).
3. Rebuild settings into tabs with visible values.
