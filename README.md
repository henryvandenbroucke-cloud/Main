# Blockhollow

A voxel fantasy RPG that runs in the browser. It is plain JavaScript on Three.js, with no build step and no network needed.
All textures, models, creatures, structures, names and lore are original and generated in code.

## Run it
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and visit http://localhost:8000.
Click **Play → Create New World**, enter a world name (it doubles as the seed), pick **Survival** or **Creative**, and click to begin. Progress autosaves to the browser; the save card under **Play** resumes it.

## Features
- **Game modes:**
  - *Survival*: a chain of 30 quests (shown top-left, J to hide) that starts with very easy steps (walk, chop a tree, craft planks) and teaches the whole game, up to the two bosses. Each quest gives items or a permanent **power-up**: Miner's Grit, Hearthglow (a warm light follows you at night), extra hearts, Keen Edge, Swift Feet, Night Eyes, Iron Stomach and more.
  - *Creative*: fly (double-tap Space; Space/Shift to rise/fall), every block and item in a searchable, tabbed creative inventory, instant breaking, endless blocks, no damage or hunger, middle-click pick block, and pause-menu tools for time of day and hostile mobs.
  - *Parkour*: you start on the green block of the Skyward Spiral. There are no mobs, no damage and no hunger, and you can't break blocks; press R to go back to the start.
- **Sound:** synthesised in the browser: material-based dig, place and footstep sounds, combat sounds, birds by day, crickets at night, crackling fires, water, and a soft generative soundtrack. Master, music and effects volumes are in Settings.
- **World:** endless procedural voxel world (chunks stream in around you; the 256×256 starting realm holds the hand-built villages and dungeons) with six biomes: Meadowbrook Vale, Ancient Forest (giant oaks), Mystic Marsh, Sunscorch Dunes, Crystal Highlands (aurora at night) and the Ashlands (lava). It has rivers, lakes, ores and a day/night cycle with sun, moon, stars and blocky clouds.
- **Shaders:** sun and moon shadow mapping with soft (PCF) edges; linear-space lighting (golden-hour sun, cool sky ambient, warm flickering lantern light whose falloff is squared); Fresnel water with sun glints; HDR bloom, sun rays, a filmic tone curve, warm grading and a vignette. These can be turned off in Settings.
- **Rendering:** procedural 16×16 pixel textures, smooth lighting with ambient occlusion, sky light plus warm torch light, animated water and lava, swaying plants, per-biome fog, and particles (chimney smoke, fireflies, embers, crystal sparkles).
- **The Skyward Spiral:** a long parkour course (about 80–100 jumps) of floating blocks that spirals around a stone spire from the ground to the top of the sky, near Wheatmere. The block themes change on the way up (wool, wood, stone, glass and crystal, lanterns and gold), and there are easy hops, sprint-jumps, drops and thin posts. Gold platforms are checkpoints: if you fall you are caught and put back on the last one, without fall damage. A timer starts when you leave the green start block, and your best time is saved. A reward chest waits on the summit.
- **Villages:**
  - *Wheatmere*: farming village with a windmill whose sails turn, a barn and loft, wheat fields, a market, a fountain and a waystone.
  - *Stiltwick*: stilt fishing village with boardwalks, nets and a boat workshop.
  - *Sahra Oasis*: desert town with rooftop terraces, awnings and an artifact hall.
  - *Shardholm*: mining village with an ore face, rails and a smithy.
- **Landmarks and camps:** The Knelt Sovereign, The Shattered Oath, Beacon Lookout, Wrecked Wagon, Hollowmere Graveyard, Deepvein Mine, Ruins of Ostmere, the Ashen Bastion (lava moat and watchtowers) and five camps.
- **Dungeons:**
  - *Ruined Watchtower*: multi-floor, with ladders and a rooftop altar.
  - *Bog Hag's Hut*.
  - *The Drowned Halls*: a sunken citadel with spike traps, a hidden vault behind cracked bricks, and the **Mirewarden** boss, who drops the Deepseal Key. The key opens the seal to the colossus arena, where the multi-phase **Sleeping Colossus** fight happens: shield pylons, shockwaves and spike fields, then "The Heart Awakens". After the fight, an escape portal opens.
- **Creatures (40+, all original models):** every creature is built from jointed parts with per-pixel painted fur, feathers, scales and faces (16 texels per block, packed into one atlas per creature and merged per joint for speed). They walk with real gaits (diagonal pairs, bending knees and hocks), look at you, blink, flick their ears, wag their tails, graze, breathe, recoil when hit and fall over when they die.
  - *Farm and wild:* cows, pigs, sheep (shear them), chickens, rabbits, horses, camels, mountain goats, foxes, wolves (tame them with a bone), cats, brown bears, frogs, sea turtles, bumblebees, bats, squid and fish, plus the Antlered Deer and Bristleback Boar. Feed animals their favourite food to breed them; babies grow up over time.
  - *Villages:* villagers (farmer, fisher, smith, librarian) who chat and trade for gold coins, cats, chickens and a Hearth Guardian that fights off monsters.
  - *Night and caves:* zombies (and desert husks), skeleton archers (frost, mossy and ashen variants), spiders that climb walls, cave spiders, Boomshrooms (a walking toadstool that swells and bursts), the Hollow Stalker (don't stare at it; it drops a throwable teleporting pearl), hedge witches, mire and magma slimes that split, stone mites, raiders, ash wraiths and dusk gliders. The undead burn in sunlight.
  - Plus Shades, Dune Crawlers (scorpions), Crystal Golems, Shard Wisps, Fire Elementals, Magma Imps, Drowned Knights and Rune Sentinels. Every creature has a spawn egg in the creative inventory.
- **Boss fights:** the Mirewarden and the Sleeping Colossus are fully animated, with readable wind-ups, heavy impacts, recovery windows where they take extra damage, leaps, sweeps, roars, a stagger meter that drops them to their knees, an enrage phase, and a slow-motion death in which they kneel, fall and crumble. Hits have hit-stop, knockback and impact particles.
- **Combat:**
  - charged swings and crits;
  - Gloomshiv backstabs;
  - Runebreaker Maul ground smash;
  - Colossus Edge crystal wave;
  - bows with draw time and arrows;
  - Thundercall Staff chain lightning;
  - floating damage numbers and boss health bars.
- **Survival and items:**
  - hearts and hunger (hunger can be turned off in settings);
  - food, armor sets with set bonuses and relics;
  - mining with tool tiers and crack stages;
  - block placing, a 36-slot inventory and loot chests;
  - a recipe-book crafting system (some recipes need a crafting table).
- **Crafting & storage:** 2×2 crafting grid in the inventory, 3×3 next to a crafting table, with shaped and shapeless recipes and a recipe book that auto-fills the grid. Containers open their own screen: loot chests (27 slots, Take all), storage barrels (36 slots with Sort, Store matching, Take all and Store all) and supply crates (18 slots). Looking at a chest, barrel, table or waystone shows its name under the crosshair.
- **Potions:** found in chests: Haste (I and II, near-instant mining), Swiftness, Strength, Night Vision, Leaping, Fire Resistance and Regeneration. Active effects show in the top right.
- **Enchanting:** mine lapis lazuli (blue-flecked ore deep underground and in the Deepvein Mine), craft an Enchanting Table and spend lapis on Efficiency, Fortune, Sharpness, Fire Aspect, Knockback, Looting, Power, Flame, Infinity, Protection or Feather Falling. Bookshelves around the table make offers stronger; enchanted items shimmer.
- **Combat timing:** Minecraft-style attack cooldown: each weapon has its own swing speed, damage and knockback scale with how charged the swing is, and creatures are briefly immune after a hit.
- **Feel:** first-person arm with a chop/punch swing that loops while mining; tools are held in the hand.
- **AI:** mobs use weighted A* pathfinding on the voxel grid (step-ups, safe drops, hazard avoidance), within a per-frame budget.
- **Performance:** Low/Medium/High/Ultra presets, render scale, auto performance (dynamic resolution), particle density, chunk distance culling and a live system info panel.
- **Exploration UI:**
  - location banners and the "Discovered" cinematic camera pan;
  - the Wayfinder's Compass (M), with tabs and Follow tracking;
  - lore tablets with pixel-art illustrations;
  - waystone attunement for respawning.
- **Menus:** title screen, world creation, pause, settings (sensitivity, FOV, view distance, hunger, cinematics, FPS), controls and a death screen.

## Controls
WASD move · Space jump/swim/climb · Shift, Ctrl or double-tap W sprint (sprint-jumping works) · C sneak · Left click attack/mine · Right click use/place/draw bow/cast ·
Middle click pick block · 1–9 / wheel hotbar · E inventory & crafting (creative inventory in Creative) · M (or right-click the compass) Wayfinder · J quests · Q drop · Esc pause ·
Creative: double-tap Space to fly, Space up, Shift down

## Layout
`src/textures.js` texture atlas · `blocks.js` block registry · `world.js` terrain + lighting · `items.js` items, recipes, loot, icons ·
`structures.js` villages/landmarks/dungeons · `models.js` creature skins, atlases, rigs and models · `render.js` mesher, shaders, sky, particles · `entities.js` creature AI, animation, bosses, spawning, projectiles ·
`postfx.js` shadows + post-processing · `ui.js` HUD, menus, creative inventory · `quests.js` quest chain and power-ups · `audio.js` synthesised sound · `main.js` player, combat, survival, saving, main loop. `lib/three.min.js` is Three.js r147 (MIT).

Run `python3 tools/build_single.py` to rebuild the one-file `Blockhollow.html`.
