# Minecraft Web Edition

A browser recreation of plain vanilla **Minecraft: Java Edition 1.21**, written in JavaScript on Three.js.

- It runs offline, with no build step and no install.
- It has no shaders: the look is the vanilla one, with textured blocks, per-face shading, smooth lighting with ambient occlusion, fog, a flat sky and blocky clouds.
- The game's rules come from the game's own data: recipes, loot tables, tags, hardness, drops, biomes, spawn lists, structure placement, trial spawner configs and advancements.
- Behaviour was checked against the game's code and the Minecraft Wiki.
- Textures, models, sounds and music are all made in code. No Mojang files are included.

This is a fan project. It is not affiliated with Mojang or Microsoft.

## Run it

**Single file:** open `Minecraft.html` in Chrome, Edge or Firefox.

**From the folder:** serve it with `python3 -m http.server`, then open <http://localhost:8000>.

Then click **Singleplayer → Create New World**. You can pick:
- the game mode: Survival, Hardcore, Creative or Spectator;
- the difficulty;
- the world type: Default or Superflat;
- how common structures are: More Common (the default, about four times as many) or Normal (the game's own spacing);
- a seed.

Worlds save to the browser automatically. **Save and Quit** keeps your progress.

To rebuild the single file after changing the code, run `python3 tools/build_single.py`.

### Controls (rebindable in Options → Controls)

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| W A S D | move | Space | jump (double-tap to fly in Creative) |
| Shift | sneak | Ctrl | sprint |
| Left mouse | break / attack | Right mouse | use / place |
| Middle mouse | pick block | E | inventory |
| Q | drop | F | swap hands |
| 1–9 / wheel | hotbar | T / `/` | chat / commands |
| L | advancements | F3 | debug screen |
| F5 | camera view | F1 | hide the HUD |
| F2 | screenshot | | |

## What's in it

**World generation.** The game runs in a background Web Worker.
- **Overworld:** the overworld biomes from the game's climate rules, with rivers, beaches, aquifers, caves and ravines, plus ores, trees, flowers and vegetation.
- **Cave biomes:** lush caves, dripstone caves and the deep dark.
- **Underground features:** amethyst geodes and fossils.
- **Structures:** villages, desert and jungle temples, witch huts, igloos, outposts, ruined portals, shipwrecks, ocean ruins, buried treasure, desert wells, mineshafts, strongholds, ocean monuments, woodland mansions, trail ruins, ancient cities and trial chambers.
- **Nether:** its five biomes, with fortresses and bastions.
- **The End:** the main island, outer islands, End cities and gateways.

**Blocks and items.** Every 1.21 block and item, with the game's crafting, smelting, stonecutting and smithing recipes.
- **Redstone:**
  - dust, torches, repeaters, comparators, observers, pistons, hoppers, droppers, dispensers, crafters;
  - rails and tripwire;
  - copper bulbs, sculk sensors, target blocks, daylight detectors and lightning rods.
- **Containers and stations:**
  - chests, barrels and shulker boxes, furnaces, brewing stands, enchanting, anvils, grindstones, looms, cartography and smithing (armour trims), beacons;
  - lecterns and chiseled bookshelves;
  - decorated pots with sherds;
  - archaeology: brushing suspicious sand and gravel.
- **Blocks with their own rules:**
  - fluids, fire, gravity blocks, crops and farming, trees, bamboo, kelp and sugar cane;
  - pointed dripstone, which grows, drips into cauldrons and falls;
  - signs, banners, beds, respawn anchors, portals and maps.

**Mobs.** Every 1.21 mob, with its own AI, model, animation, sounds and loot:
- villagers with professions, trading and reputation (gossip changes prices, and iron golems defend villagers from players who hurt them);
- raids and patrols;
- breeding, taming and riding, with the jump bar for horses and camels;
- cat, wolf, axolotl and tropical fish variants;
- buckets of fish, axolotls and tadpoles that keep the mob inside;
- pufferfish that puff up and sting, and axolotls that hunt, play dead and help players;
- allays that collect items and deliver them to a player or a note block, dance to jukeboxes and duplicate;
- breezes that leap and turn projectiles back, camels with two riders and a dash, sniffers that dig up seeds, and armadillos that roll up;
- bees and bogged;
- the Warden, the Wither and the Ender Dragon, including respawning the dragon.

**Survival.**
- **Health and food:** hunger and saturation, fall damage, drowning, fire and freezing.
- **Effects:** potions and status effects.
- **Combat:** armour and enchantments, 1.9+ combat with the attack cooldown, critical hits and sweeping, shields, and the mace and its smash attack.
- **Movement:** elytra flight, swimming and crawling.
- **Time and weather:** day and night, weather, sleeping and spawn points.
- **Experience:** experience and levels.
- **Rules:** difficulty, game rules and Hardcore.

**Progression.**
- All 122 advancements, with the game's criteria, the advancement screen, toasts and rewards.
- Statistics.
- Commands such as `/give`, `/tp`, `/time`, `/weather`, `/gamemode`, `/effect`, `/enchant`, `/summon`, `/locate`, `/setblock`, `/fill`, `/advancement`, `/kill`, `/gamerule` and more. See `/help`.

## Differences from the real game

- **World height.** The world is 256 blocks tall (y −64 to 191), not 384. This keeps chunk memory and meshing light. The two height-based advancements (Caves & Cliffs, Star Trader) are measured against this world's top instead.
- **Art and sound.** Textures, models, sounds and music are recreated in code, so they look and sound close to the game but not identical.
- **Single player only.** There is no multiplayer, Realms, resource packs or data packs.
- **Approximate generation.** Structure layouts are drawn in code in the style of the game's rather than from its template files.
- **Structure spacing.** New worlds use More Common structures unless you pick Normal.

## Project layout

- **`index.html`:** loads the scripts in order.
- **`src/`:** the game (no framework, no bundler).
- **`src/shared/`:** world generation and structures. These files also run in the generator worker.
- **`src/data/`:** the game data compiled from [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data) and [misode/mcmeta](https://github.com/misode/mcmeta).
- **`lib/`:** Three.js.
- **`tools/`:** the single-file builder and the data generator.
- **`legacy/Blockhollow.html`:** the earlier fantasy RPG this project started from.
