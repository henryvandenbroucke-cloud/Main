# Plan: turn Blockhollow into plain Minecraft

## Goal

Replace the fantasy RPG (quests, bosses, magic staffs, waystones, lore) with a browser recreation of **plain vanilla Minecraft (Java Edition 1.21)**. It should have the same blocks, items, crafting recipes, dimensions, mobs, tools and survival rules, and look like the vanilla game with no shader pack.

The rules for building it:

1. **Research first.** Look up every feature before adding it, and check that it really is in the game.
2. **No shaders.** No shadow maps, bloom, god rays, normal maps, reflections or post-processing. Use the vanilla look: textured blocks, per-face shading, smooth lighting with ambient occlusion, distance fog, a flat sky and blocky clouds. This keeps it light enough for a modest computer.
3. **Run smoothly.** World generation runs in a background Web Worker. Chunk lighting and meshing get a per-frame time budget, so the frame rate stays steady while the world streams in.
4. **Still offline, still one file.** No build step, no network needed, and `tools/build_single.py` still produces a single HTML file. All textures are painted in code; no Mojang files are copied.

The old RPG remains in git history. Its single-file build is kept as `legacy/Blockhollow.html`.

## Research sources

- **Game data** (extracted from the real game) comes from the open-source `PrismarineJS/minecraft-data` project (MIT), for Java Edition 1.21.1. It covers:
  - 1,060 blocks with hardness, blast resistance, harvest tools, light emission and drops;
  - 1,333 items with stack sizes and durability;
  - all 782 crafting recipes;
  - food and saturation values;
  - mobs with their sizes;
  - the 64 biomes with temperatures;
  - 42 enchantments with maximum levels;
  - status effects;
  - block and mob loot tables.

  The game's tables are generated from this data, so recipes, hardness and drops match the real game.
- **Web searches** (the Minecraft Wiki can't be opened directly from this machine, so search summaries were used) for:
  - breaking speed formula, tool tiers and the Efficiency bonus;
  - player physics (gravity 0.08, drag 0.98, jump 0.42, 20 ticks per second);
  - hunger, saturation and exhaustion values;
  - armour and Protection formulas;
  - XP level formula;
  - 1.18+ ore heights;
  - mob spawning (block light 0, mob cap 70, 24–128 block range);
  - day and night cycle (24,000 ticks, 20 minutes, 8 moon phases);
  - furnace fuel times;
  - brewing recipes;
  - the enchanting table and its 15 bookshelves;
  - Nether portals (4×5 frame, 8:1 scale);
  - strongholds and End portals (12 frames);
  - Nether fortresses;
  - the Ender Dragon (200 HP, 10 obsidian spikes, caged crystals);
  - redstone (power 0–15, repeaters, torches, strong and weak power, pistons);
  - water and lava flow;
  - crop growth and random ticks;
  - explosions (TNT power 4, creeper power 3);
  - villager professions and trades;
  - game modes and difficulty;
  - mob behaviour (endermen, creepers, skeletons, spiders).

## Engine (rebuilt for this)

| Part | Design |
|---|---|
| World | 16×16 chunks, Y from −64 to 191 (256 tall), sea level 63. Each dimension (Overworld, Nether, End) has its own chunk map. Block ids, block states and light (sky + block, packed) are typed arrays per chunk. |
| Generation | Runs in a Web Worker built from the shared modules, so it works from `file://` and from the one-file build. |
| Overworld terrain | 1.18-style multi-noise:<br>• continentalness, erosion, peaks and valleys shape the height;<br>• temperature and humidity pick the biome;<br>• cheese, spaghetti and noodle caves, plus underground lava and water pools;<br>• deepslate below Y 0;<br>• ores at their 1.18 heights. |
| Lighting | Flood-fill sky light and block light (0–15) across chunk borders, with incremental add and remove when blocks change. |
| Meshing | Per 16×16×16 section, with a time budget per frame. Vanilla face shading (top 1.0, north/south 0.8, east/west 0.6, bottom 0.5) and smooth lighting with ambient occlusion. Separate passes for opaque, cutout (leaves, plants) and translucent (water, glass, ice). |
| Textures | Procedural 16×16 pixel art in a texture array (sharp pixels, mipmaps, no bleeding). Grass, leaves and water take biome colours. Water, lava, fire and portals are animated. |
| Sky | Sky and fog colour per biome and time of day, sunrise and sunset glow, square sun and moon with 8 phases, stars, blocky clouds, rain and snow. Nether and End have their own skies. |
| Ticks | Fixed 20 game ticks per second. Random ticks (speed 3) grow crops and spread grass; scheduled ticks run fluids and redstone. Rendering interpolates between ticks. |
| Physics | Vanilla player physics:<br>• 0.6×1.8 hitbox, eye height 1.62;<br>• 0.6 step height;<br>• sprinting, sneaking (you don't walk off edges), swimming, ladders and vines;<br>• slippery ice and bouncy slime;<br>• creative flying. |
| Saving | IndexedDB holds several worlds. Only changed chunks are stored, with their block entities (chests, furnaces, signs…) and entities. |

## Content

### Blocks (about 450 blocks with their states)

- **Natural:**
  - grass, dirt, coarse dirt, podzol, mycelium, mud, clay, gravel, sand and red sand;
  - stone, cobblestone, granite, diorite, andesite, deepslate, tuff, calcite and bedrock;
  - obsidian, ice, packed ice, blue ice, snow and snow layers, water and lava.
- **Ores:** coal, iron, copper, gold, redstone, lapis, diamond and emerald, each with a deepslate version; Nether quartz, Nether gold and ancient debris; the raw ore blocks and storage blocks.
- **Wood:** oak, spruce, birch, jungle, acacia, dark oak, mangrove and cherry, plus the crimson and warped stems. Each has:
  - log, stripped log, wood, planks and leaves;
  - sapling, stairs, slab, fence, fence gate, door and trapdoor;
  - button, pressure plate and sign.
- **Plants:** short and tall grass, ferns, dead bush, every flower (including the tall ones), sugar cane, cactus, bamboo, vines, lily pads, mushrooms and mushroom blocks. Also pumpkins and melons with their stems, wheat, carrots, potatoes, beetroots, sweet berries, cocoa, kelp, seagrass, sea pickles and coral.
- **Building:**
  - bricks, stone bricks (mossy, cracked, chiseled), smooth stone, the sandstone family and quartz;
  - prismarine and sea lanterns;
  - 16 colours each of wool, carpet, terracotta, glazed terracotta, concrete, concrete powder, stained glass and panes;
  - glass and panes, iron bars and chains;
  - every stairs, slab and wall made from these materials.
- **Workstations:**
  - crafting table, furnace, blast furnace, smoker, campfire and soul campfire;
  - chest (single and double), trapped chest, ender chest and barrel;
  - anvil, grindstone, enchanting table, brewing stand, cauldron and composter;
  - stonecutter, loom, smithing table, fletching table, cartography table and lectern;
  - beds in 16 colours, bookshelf, jukebox, note block and beacon.
- **Redstone:**
  - dust, torch, repeater and comparator;
  - lever, buttons and pressure plates;
  - redstone lamp, piston and sticky piston, observer, hopper, dispenser and dropper;
  - TNT, daylight detector, target block and slime block;
  - all four kinds of rail, doors, trapdoors and fence gates.
- **Nether:**
  - netherrack, soul sand and soul soil, glowstone, magma and basalt;
  - blackstone, Nether bricks (and red), Nether wart, shroomlight;
  - crimson and warped nylium, fungi, roots and wart blocks;
  - weeping and twisting vines, the Nether portal and crying obsidian.
- **End:** end stone and end stone bricks, purpur, end rods, chorus plants and flowers, end portal frames and portal, end gateway and the dragon egg.

### Items

- **Tools and weapons:** wood, stone, iron, gold, diamond and netherite swords, pickaxes, axes, shovels and hoes. Also bow, crossbow, arrows, trident, shield, fishing rod, flint and steel, shears, compass, clock and lead.
- **Armour:** leather, chainmail, iron, gold, diamond and netherite; turtle helmet, elytra and carved pumpkin.
- **Food:** every food from the data, with its hunger and saturation, and the effects of golden apples, rotten flesh, spider eyes, pufferfish and suspicious stew.
- **Materials:** ingots, nuggets, raw ores, gems, dyes, string, feathers, gunpowder, leather, bones, bone meal and slimeballs. Also ender pearls, eyes of ender, blaze rods and powder, ghast tears, magma cream, Nether wart, paper, books and enchanted books.
- **Other:**
  - buckets (water, lava, milk, fish);
  - glass bottles, potions, splash and lingering potions;
  - bottles o' enchanting, snowballs and eggs;
  - minecarts (plain, chest, hopper, TNT) and boats;
  - saddles, name tags, paintings, item frames, armour stands, signs and flower pots;
  - spawn eggs for every mob.

### Recipes

- **Crafting:** every recipe in the game data, shaped and shapeless, with tags such as "any planks". 2×2 in the inventory, 3×3 at a crafting table, and the recipe book.
- **Smelting:** all furnace recipes. The blast furnace only takes ores and armour and works twice as fast; the smoker only takes food, also twice as fast. Campfire cooking, fuel burn times and XP from smelting.
- **Other stations:** stonecutter, smithing table (netherite upgrade), loom and grindstone.
- **Brewing:** the full chart. Water bottle → Awkward (Nether wart) → effect ingredient, then redstone (longer), glowstone (stronger), fermented spider eye (corrupted), gunpowder (splash) and dragon's breath (lingering).
- **Enchanting:** the table with up to 15 bookshelves, three offers, lapis and level cost, and enchantability per material. All 42 enchantments, with their conflicts. The anvil combines, repairs and renames.

### Mobs

| Group | Mobs |
|---|---|
| Passive | pig, cow, mooshroom, sheep (shearing, wool regrowth, dyeing), chicken (eggs), rabbit, horse, donkey and mule (taming, saddles), llama, cat, ocelot, wolf (taming, sitting, collars), fox, parrot, bat, squid, glow squid, cod, salmon, tropical fish, pufferfish, dolphin, turtle, polar bear, panda, bee, goat, frog, axolotl, armadillo, camel, strider |
| Villages | villager (professions from job site blocks, trading levels Novice→Master), wandering trader, iron golem, snow golem |
| Hostile | zombie (and baby, villager and armoured versions), husk, drowned, skeleton, stray, creeper (and charged), spider, cave spider, enderman, witch, slime, silverfish, phantom, pillager, vindicator, evoker, ravager, guardian, elder guardian |
| Nether | blaze, ghast, magma cube, wither skeleton, zombified piglin, piglin (bartering with gold), piglin brute, hoglin, zoglin |
| End | enderman, endermite, shulker |
| Bosses | Ender Dragon, Wither |

Each mob gets:
- its vanilla size, health, speed, damage on each difficulty, drops and XP;
- its vanilla behaviour (creepers hiss and flee cats, endermen get angry when you look at them, skeletons strafe, spiders are neutral by day, zombies and skeletons burn in sunlight…);
- breeding with the right food, and babies that grow up;
- a vanilla-style box model with a walk cycle, a red flash when hurt and the tip-over death with a smoke puff.

Spawning follows vanilla rules: hostile mobs need block light 0, there are mob caps, and mobs despawn by distance.

### Dimensions and structures

- **Overworld biomes (all 53):**
  - plains, sunflower plains, snowy plains and ice spikes;
  - desert and the three badlands;
  - savannas, forests, flower forest, birch and old-growth birch, dark forest;
  - the taigas, jungles (sparse, bamboo), swamp and mangrove swamp;
  - meadow, cherry grove, grove, snowy slopes and the three peaks;
  - the windswept biomes and mushroom fields;
  - rivers, beaches, stony shore and every ocean;
  - dripstone caves, lush caves and the deep dark.
- **Overworld structures:**
  - villages in five styles, desert pyramid, jungle temple, swamp hut, igloo;
  - pillager outpost, ruined portal, shipwreck, ocean ruins and buried treasure;
  - mineshaft, dungeon (monster spawner), stronghold (library, portal room), ocean monument and woodland mansion;
  - each with vanilla loot.
- **The Nether:**
  - the five biomes, a lava sea at Y 31, and a bedrock floor and ceiling;
  - Nether fortresses (blaze spawners, Nether wart) and bastion remnants;
  - portal linking at the 8:1 scale.
- **The End:**
  - the main island with 10 obsidian spikes and End crystals (two in iron cages);
  - the Ender Dragon fight with its boss bar, then the exit portal, the dragon egg and an End gateway;
  - the outer islands with chorus forests, End cities and shulkers (elytra in the End ship).

### Survival systems

- **Health and food:**
  - 20 health, with absorption and regeneration;
  - hunger, saturation and exhaustion with the vanilla costs;
  - starvation by difficulty.
- **Damage:** fall damage (blocks fallen − 3), drowning (air bubbles), fire and lava, cactus, suffocation, the void, explosions, lightning and freezing.
- **Armour:** armour points, toughness and Protection Factor (EPF).
- **Experience:** orbs and levels with the vanilla formula.
- **Effects:** all status effects, with their particles and HUD icons.
- **Other:**
  - mining speed, tool tiers, Silk Touch and Fortune, and durability with Unbreaking and Mending;
  - beds (sleep through the night, set spawn; they explode in the Nether and the End);
  - weather (rain, snow, thunderstorms with lightning);
  - farming (tilling, hydration, crop stages, bone meal, saplings into trees);
  - water and lava flow (sources, infinite water, obsidian, cobblestone and stone generators);
  - falling sand, gravel, anvils and concrete powder, and fire spread;
  - TNT and creeper explosions with blast resistance;
  - redstone with power 0–15, strong and weak power, repeater delays, torch burnout and pistons pushing up to 12 blocks;
  - minecarts on rails, boats, riding horses and pigs (carrot on a stick);
  - fishing loot, villager trading, piglin bartering and raids.

### Interface

- **Menus:**
  - title screen with a panorama and a splash text;
  - Singleplayer list (several worlds: create with name, seed and mode; play; delete);
  - Options (FOV, render distance, smooth lighting, clouds, particles, max framerate, GUI scale, brightness, view bobbing, sensitivity, volumes, difficulty);
  - Controls.
- **HUD:**
  - hotbar, hearts (poison, wither, absorption and hardcore hearts), armour, hunger, air and the XP bar;
  - boss bar and the item-name popup;
  - chat with commands (`/gamemode`, `/time`, `/weather`, `/give`, `/tp`, `/summon`, `/effect`, `/enchant`, `/xp`, `/kill`, `/difficulty`, `/gamerule`, `/locate`, `/seed`, `/spawnpoint`, `/setblock`, `/fill`, `/clear`);
  - F3 debug screen, F1 to hide the HUD, F5 for the camera.
- **Overlays:** underwater, fire, portal, pumpkin, nausea and damage tilt.
- **Screens:**
  - survival inventory (armour, off-hand and 2×2 crafting) and creative inventory (tabs, search);
  - crafting table, furnace (and blast furnace, smoker), chests and double chests;
  - enchanting, anvil, brewing stand, villager trading, beacon, hopper, dispenser and stonecutter.
- **Inventory handling:** the vanilla mouse rules (click, right-click to split or place one, shift-click, drag to spread, double-click to collect).
- **Game modes:** Survival, Creative, Adventure, Spectator and Hardcore. Difficulties: Peaceful, Easy, Normal and Hard.
- **Sound:** synthesised in the browser for every material, mob, tool and UI action, with cave ambience and calm generative music. There are no audio files.

## Build order

1. **Engine:** worker generation, chunks, lighting, the section mesher, texture array, sky, player physics, breaking and placing, the hotbar.
2. **Blocks and items:** the data-driven registry, every texture, tool tiers, mining and drops.
3. **Inventory and crafting:** inventory screens, crafting, smelting, containers and the recipe book.
4. **Overworld:** biomes, caves, ores, trees and plants, and structures with loot.
5. **Mobs:** models, animation, AI and pathfinding, spawning, combat, breeding, villagers and trading.
6. **Survival:** health, hunger, XP, armour, effects, beds, weather and death.
7. **Other dimensions:** the Nether and the End, portals, fortresses, the stronghold, the dragon and the Wither.
8. **World mechanics:** fluids, gravity blocks, farming, fire, TNT and redstone.
9. **Advanced stations:** enchanting, anvil, brewing, the remaining workstations and beacons.
10. **Finish:** menus, options, saving, chat and commands, F3, audio polish, a performance pass, the one-file build and the README.

Each step is committed separately.
