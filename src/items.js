'use strict';
/* Items: blocks are items 1..255, everything else starts at 256. */
const ITEMS = [];          // id -> def
const I = {};              // key -> id
const RARITY = { common: '#e8e4dc', uncommon: '#6fdc6f', rare: '#5aa8ff', epic: '#c77dff', legendary: '#ffb02e' };

function regItem(key, o) {
  const id = 256 + Object.keys(I).length;
  I[key] = id;
  ITEMS[id] = Object.assign({ id, key, name: key, stack: 64, kind: 'misc', rarity: 'common', desc: '' }, o);
  return id;
}
// ---- materials
regItem('stick', { name: 'Stick', paint: 'stick', c: ['#8a6438'] });
regItem('wheat', { name: 'Wheat', paint: 'wheat', c: ['#e2c04a'] });
regItem('coal', { name: 'Coal', paint: 'lump', c: ['#2a2a30', '#4a4a52'] });
regItem('iron', { name: 'Iron Ingot', paint: 'ingot', c: ['#c8c8d0', '#f0f0f4'] });
regItem('gold', { name: 'Gold Coin', paint: 'coin', c: ['#f0c838', '#fff08a'] });
regItem('shard', { name: 'Crystal Shard', paint: 'shard', c: ['#56d2f0', '#c8f8ff'], rarity: 'uncommon' });
regItem('silk', { name: 'Crawler Silk', paint: 'silk', c: ['#e8e8f0'] });
regItem('leather', { name: 'Boar Hide', paint: 'hide', c: ['#9a6a3a', '#7a4a24'] });
regItem('arrow', { name: 'Arrow', paint: 'arrow', c: ['#8a6438', '#c8c8d0'] });
regItem('ember', { name: 'Living Ember', paint: 'shard', c: ['#ff7a2a', '#ffe46a'], rarity: 'uncommon' });
regItem('journal', { name: 'Journal Page', paint: 'page', c: ['#e8dcb4'], stack: 16, desc: 'A torn page. Someone wrote in a hurry.' });
regItem('key', { name: 'Deepseal Key', paint: 'key', c: ['#6ef0ff', '#2a8aa0'], stack: 1, rarity: 'epic', desc: 'Opens the Seal of the Deep beneath the Drowned Halls.' });
regItem('compass', { name: 'Wayfinder Compass', paint: 'compass', c: ['#d8a828', '#fff4c8'], stack: 1, rarity: 'uncommon', kind: 'compass', desc: 'Select it in your hotbar and right-click to open the Wayfinder (or press M).' });
// ---- food
regItem('bread', { name: "Traveller's Bread", kind: 'food', food: 5, heal: 0, paint: 'bread', c: ['#c8883a', '#e8b060'], stack: 16 });
regItem('globerry', { name: 'Globerries', kind: 'food', food: 2, heal: 1, paint: 'berries', c: ['#4a6ae0', '#9ab0ff'], stack: 32 });
regItem('venison', { name: 'Roast Venison', kind: 'food', food: 7, heal: 2, paint: 'meat', c: ['#a8582e', '#e8e0d0'], stack: 16 });
regItem('lapis', { name: 'Lapis Lazuli', paint: 'shard', c: ['#2a4ad8', '#8aa8ff'], rarity: 'uncommon', desc: 'A deep blue gem. Enchanting tables use it to imbue tools and armor.' });
// potions: drink them (right-click) for a timed effect; found in chests
const potion = (key, name, effect, lvl, dur, c, rarity, desc) => regItem(key, { name, kind: 'potion', effect, lvl, dur, paint: 'potion', c, stack: 4, rarity: rarity || 'uncommon', desc });
potion('pot_haste', 'Potion of Haste', 'haste', 1, 180, ['#e8c838', '#fff4b0'], 'uncommon', 'Mine blocks much faster for 3 minutes.');
potion('pot_haste2', 'Potion of Haste II', 'haste', 2, 90, ['#f0a020', '#fff0a0'], 'rare', 'Break blocks almost instantly for 90 seconds.');
potion('pot_swift', 'Potion of Swiftness', 'swift', 1, 180, ['#7ad8f0', '#e0f8ff'], 'uncommon', 'Move 30% faster for 3 minutes.');
potion('pot_strength', 'Potion of Strength', 'strength', 1, 180, ['#c83a2a', '#ffb0a0'], 'uncommon', 'Deal 40% more melee damage for 3 minutes.');
potion('pot_night', 'Potion of Night Vision', 'night', 1, 240, ['#3a4ad8', '#b0c0ff'], 'uncommon', 'See clearly in the dark for 4 minutes.');
potion('pot_leap', 'Potion of Leaping', 'leap', 1, 180, ['#6ae05a', '#d0ffc0'], 'uncommon', 'Jump higher and take less fall damage for 3 minutes.');
potion('pot_fire', 'Potion of Fire Resistance', 'fireres', 1, 240, ['#ff8a2a', '#ffe0b0'], 'rare', 'Immune to fire and lava for 4 minutes.');
potion('pot_regen', 'Potion of Regeneration', 'regen', 1, 45, ['#e85aa8', '#ffd0ec'], 'rare', 'Steadily heals you for 45 seconds.');
regItem('beef', { name: 'Hearty Steak', kind: 'food', food: 8, heal: 3, paint: 'meat', c: ['#8a3a22', '#e8e0d0'], stack: 16 });
regItem('pork', { name: 'Roast Pork', kind: 'food', food: 8, heal: 2, paint: 'meat', c: ['#c8724a', '#f0e4d0'], stack: 16 });
regItem('mutton', { name: 'Roast Mutton', kind: 'food', food: 6, heal: 2, paint: 'meat', c: ['#a8583a', '#e8dcc8'], stack: 16 });
regItem('chicken', { name: 'Roast Chicken', kind: 'food', food: 6, heal: 2, paint: 'drumstick', c: ['#d8984a', '#f4ecdc'], stack: 16 });
regItem('rabbit', { name: 'Roast Rabbit', kind: 'food', food: 5, heal: 2, paint: 'drumstick', c: ['#b8784a', '#f0e4d0'], stack: 16 });
regItem('fish', { name: 'Grilled Fish', kind: 'food', food: 5, heal: 2, paint: 'fish', c: ['#c8945a', '#e8d4a8'], stack: 16 });
regItem('honey', { name: 'Honeycomb', kind: 'food', food: 3, heal: 3, paint: 'comb', c: ['#f0b030', '#ffe080'], stack: 16 });
regItem('flesh', { name: 'Rotten Flesh', kind: 'food', food: 2, heal: 0, paint: 'meat', c: ['#7a8a4a', '#c8b890'], stack: 32, desc: 'Better than nothing. Barely.' });
regItem('bone', { name: 'Bone', paint: 'bone', c: ['#e8e4d4', '#c8c0a8'], desc: 'Wolves love these. Right-click a wolf to tame it.' });
regItem('feather', { name: 'Feather', paint: 'feather', c: ['#f4f2ea', '#c8c4b8'] });
regItem('ink', { name: 'Ink Sac', paint: 'lump', c: ['#1a1a2a', '#3a3a5a'] });
regItem('slimeball', { name: 'Slime Gel', paint: 'lump', c: ['#6ac85a', '#b8f0a0'] });
regItem('spore', { name: 'Spore Dust', paint: 'berries', c: ['#c8c0a8', '#f0e8d0'] });
regItem('pearl', { name: 'Hollow Pearl', kind: 'pearl', paint: 'pearl', c: ['#7a5aa8', '#e8d8ff'], stack: 16, rarity: 'uncommon', desc: 'Right-click to throw. You appear where it lands.' });
regItem('shears', { name: 'Shears', kind: 'shears', paint: 'shears', c: ['#c8c8d0', '#6a4a2a'], stack: 1, desc: 'Right-click a sheep to shear its wool.' });
regItem('ration', { name: 'Ranger Ration', kind: 'food', food: 10, heal: 8, paint: 'parcel', c: ['#c8a870', '#6a4a2a'], stack: 8, rarity: 'uncommon' });
regItem('potion', { name: 'Healing Draught', kind: 'food', food: 0, heal: 20, paint: 'potion', c: ['#e84a6a', '#ffd0dc'], stack: 8, rarity: 'uncommon', desc: 'Restores all health.' });
// ---- tools
const tool = (key, name, type, tier, mult, c, rarity, extra) => regItem(key, Object.assign({ name, kind: 'tool', toolType: type, tier, mult, stack: 1, paint: type, c, dmg: 2 + tier, aps: type === 'shovel' ? 1.0 : 1.2, reach: 4.5, rarity: rarity || 'common' }, extra || {}));
tool('wood_pick', 'Wooden Pickaxe', 'pick', 1, 2, ['#b08550', '#8a6438']);
tool('wood_axe', 'Wooden Axe', 'axe', 1, 2, ['#b08550', '#8a6438'], 'common', { dmg: 5, aps: 0.8 });
tool('wood_shovel', 'Wooden Shovel', 'shovel', 1, 2, ['#b08550', '#8a6438']);
tool('stone_pick', 'Stone Pickaxe', 'pick', 2, 4, ['#9a9aa0', '#8a6438']);
tool('stone_axe', 'Stone Axe', 'axe', 2, 4, ['#9a9aa0', '#8a6438'], 'common', { dmg: 7, aps: 0.8 });
tool('stone_shovel', 'Stone Shovel', 'shovel', 2, 4, ['#9a9aa0', '#8a6438']);
tool('crystal_pick', 'Crystal Pickaxe', 'pick', 3, 9, ['#56d2f0', '#4a4a60'], 'rare');
tool('crystal_axe', 'Crystal Axe', 'axe', 3, 9, ['#56d2f0', '#4a4a60'], 'rare', { dmg: 9, aps: 1.0 });
tool('crystal_shovel', 'Crystal Shovel', 'shovel', 3, 9, ['#56d2f0', '#4a4a60'], 'rare');
// ---- weapons
const weapon = (key, o) => regItem(key, Object.assign({ kind: 'weapon', stack: 1, reach: 3.6 }, o));
weapon('wood_sword', { name: 'Wooden Sword', dmg: 4, aps: 1.6, paint: 'sword', c: ['#b08550', '#8a6438'] });
weapon('stone_sword', { name: 'Stone Sword', dmg: 5, aps: 1.6, paint: 'sword', c: ['#9a9aa0', '#8a6438'] });
weapon('crystal_sword', { name: 'Crystal Longsword', dmg: 7, aps: 1.5, paint: 'sword', c: ['#56d2f0', '#4a4a60'], rarity: 'rare' });
weapon('gloomshiv', { name: 'Gloomshiv', dmg: 4, aps: 1.9, reach: 2.6, paint: 'dagger', c: ['#6a5a8a', '#2a2234'], rarity: 'epic', backstab: true, desc: 'Backstab: hits from behind deal double damage. 50% crit chance.' });
weapon('rune_maul', { name: 'Runebreaker Maul', dmg: 12, aps: 0.7, reach: 3.4, paint: 'maul', c: ['#7a7a84', '#6ef0ff'], rarity: 'epic', smash: true, desc: 'Charged swings shake the ground and knock back everything nearby.' });
weapon('colossus_edge', { name: 'Colossus Edge', dmg: 10, aps: 1.2, reach: 4, paint: 'greatsword', c: ['#9af0ff', '#d8a828'], rarity: 'legendary', wave: true, desc: 'Fully charged swings release a crystal wave.' });
regItem('ranger_bow', { name: "Ranger's Bow", kind: 'bow', stack: 1, power: 1, dmg: 6, paint: 'bow', c: ['#8a6438', '#e8e8f0'], rarity: 'uncommon', desc: 'Hold right-click to draw. Uses arrows.' });
regItem('prism_bow', { name: 'Prism Bow', kind: 'bow', stack: 1, power: 1.5, dmg: 10, paint: 'bow', c: ['#56d2f0', '#ffffff'], rarity: 'rare', desc: 'Hold right-click to draw. Uses arrows.' });
regItem('thunder_staff', { name: 'Thundercall Staff', kind: 'staff', stack: 1, dmg: 9, cd: 1.1, paint: 'staff', c: ['#6a4a2a', '#8ad8ff'], rarity: 'epic', desc: 'Right-click: chain lightning that arcs to 3 enemies.' });
// ---- armor
const armor = (key, name, slot, pts, set, c, rarity) => regItem(key, { name, kind: 'armor', slot, armor: pts, set, stack: 1, paint: ['helm', 'chestplate', 'greaves', 'boots'][slot], c, rarity });
armor('hide_helm', 'Hide Cap', 0, 1, 'hide', ['#9a6a3a', '#6a4424'], 'common');
armor('hide_chest', 'Hide Tunic', 1, 3, 'hide', ['#9a6a3a', '#6a4424'], 'common');
armor('hide_legs', 'Hide Leggings', 2, 2, 'hide', ['#9a6a3a', '#6a4424'], 'common');
armor('hide_boots', 'Hide Boots', 3, 1, 'hide', ['#9a6a3a', '#6a4424'], 'common');
armor('prism_helm', 'Prism Knight Helm', 0, 3, 'prism', ['#56d2f0', '#c8f8ff'], 'rare');
armor('prism_chest', 'Prism Knight Chestplate', 1, 7, 'prism', ['#56d2f0', '#c8f8ff'], 'rare');
armor('prism_legs', 'Prism Knight Greaves', 2, 5, 'prism', ['#56d2f0', '#c8f8ff'], 'rare');
armor('prism_boots', 'Prism Knight Boots', 3, 3, 'prism', ['#56d2f0', '#c8f8ff'], 'rare');
armor('warden_helm', 'Bastion Warden Helm', 0, 3, 'warden', ['#3c2f40', '#d8a828'], 'epic');
armor('warden_chest', 'Bastion Warden Chestplate', 1, 6, 'warden', ['#3c2f40', '#d8a828'], 'epic');
armor('warden_legs', 'Bastion Warden Greaves', 2, 4, 'warden', ['#3c2f40', '#d8a828'], 'epic');
armor('warden_boots', 'Bastion Warden Boots', 3, 2, 'warden', ['#3c2f40', '#d8a828'], 'epic');
// ---- relics
regItem('wolf_totem', { name: 'Wolfsblood Totem', kind: 'relic', stack: 1, relic: 'melee', paint: 'totem', c: ['#e8e0d0', '#a82020'], rarity: 'rare', desc: '+25% melee damage.' });
regItem('colossus_heart', { name: 'Heart of the Colossus', kind: 'relic', stack: 1, relic: 'heart', paint: 'heart', c: ['#6ef0ff', '#ffffff'], rarity: 'legendary', desc: '+10 max health and steady regeneration.' });
const relic = (key, name, r, c, desc, paint) => regItem(key, { name, kind: 'relic', stack: 1, relic: r, paint: paint || 'charm', c, rarity: 'rare', desc });
relic('hearth_charm', 'Hearthbread Charm', 'hunger', ['#e8b060', '#fff0c8'], 'Hunger drains 40% slower.');
relic('tide_charm', 'Tidecaller Charm', 'swim', ['#3a8ad8', '#c8f0ff'], 'Swim twice as fast.');
relic('miner_charm', "Miner's Charm", 'mine', ['#8a8a92', '#f2d23a'], 'Mine 25% faster.');
relic('feather_charm', 'Featherfall Charm', 'fall', ['#f4f2ea', '#8ad0ff'], 'You never take fall damage.');
relic('owl_charm', 'Owl-Eye Charm', 'night', ['#6a5aa8', '#ffe46a'], 'See clearly in the dark.');
relic('lucky_coin', 'Lucky Coin', 'luck', ['#f0c838', '#fff08a'], 'Creatures drop more loot.', 'coin');
relic('sun_amulet', 'Sun Amulet', 'swift', ['#f0a030', '#fff4b0'], 'Move 15% faster.');
regItem('ember_charm', { name: 'Emberward Charm', kind: 'relic', stack: 1, relic: 'fire', paint: 'charm', c: ['#ff7a2a', '#ffe46a'], rarity: 'rare', desc: 'Immunity to fire and lava burns.' });

// resolve block drops of the form 'item:x'
for (const d of BLK) if (typeof d.drop === 'string') d.drop = I[d.drop.slice(5)];

function itemDef(id) { return id < 256 ? blockItemDef(id) : ITEMS[id]; }
const _blockDefs = [];
function blockItemDef(id) {
  if (!_blockDefs[id]) { const b = BLK[id]; _blockDefs[id] = { id, key: b.key, name: b.name, stack: 64, kind: 'block', rarity: 'common', desc: b.desc || '' }; }
  return _blockDefs[id];
}
const SET_BONUS = { prism: 'Set bonus: +15% damage', warden: 'Set bonus: immune to knockback and fire', hide: '' };

// ---------------------------------------------------------------- recipes
// Shaped recipes use a pattern (rows of characters) and a key; '.' or ' ' is an empty cell.
// Shapeless recipes list one item per grid cell. Patterns larger than 2x2 need a crafting table.
const RECIPES = [];
function shaped(out, n, pat, key) {
  const need = {}; for (const row of pat) for (const ch of row) if (ch !== ' ' && ch !== '.') need[key[ch]] = (need[key[ch]] || 0) + 1;
  const w = Math.max(...pat.map(r => r.length)), h = pat.length;
  RECIPES.push({ out: [out, n], pat: pat.map(r => r.padEnd(w, ' ')), key, need: Object.entries(need).map(([id, k]) => [+id, k]), w, h, table: w > 2 || h > 2 });
}
function shapeless(out, n, list) {
  const need = {}; for (const id of list) need[id] = (need[id] || 0) + 1;
  RECIPES.push({ out: [out, n], list, need: Object.entries(need).map(([id, k]) => [+id, k]), table: list.length > 4 });
}
(function defineRecipes() {
  const P = B.PLANKS, S = I.stick, C = B.COBBLE, X = I.shard, Ir = I.iron, G = I.gold, L = I.leather, K = I.silk, E = I.ember;
  // --- basics
  shaped(B.PLANKS, 4, ['L'], { L: B.LOG });
  shaped(B.PLANKS_DARK, 4, ['L'], { L: B.DARKLOG });
  RECIPES[RECIPES.length - 1].exact = RECIPES[RECIPES.length - 2].exact = true; // a log always gives its own planks
  shaped(S, 4, ['P', 'P'], { P });
  shaped(B.TABLE, 1, ['PP', 'PP'], { P });
  shaped(B.TORCH, 4, ['C', 'S'], { C: I.coal, S });
  shaped(B.CHEST, 1, ['PPP', 'P P', 'PPP'], { P });
  shaped(B.BARREL, 1, ['PSP', 'P P', 'PSP'], { P, S });
  shaped(B.CRATE, 2, ['SPS', 'P P', 'SPS'], { P, S });
  shaped(B.LADDER, 3, ['S S', 'SSS', 'S S'], { S });
  shaped(B.FENCE, 3, ['PSP', 'PSP'], { P, S });
  shaped(B.FURNACE, 1, ['CCC', 'C C', 'CCC'], { C });
  shaped(B.FIRE, 1, [' S ', 'SCS', 'LLL'], { S, C: I.coal, L: B.LOG });
  shaped(B.LAMP, 2, ['IXI', ' T '], { I: Ir, X, T: B.TORCH });
  shaped(B.BOOKSHELF, 1, ['PPP', 'JJJ', 'PPP'], { P, J: I.journal });
  shaped(B.RAIL, 8, ['I I', 'ISI', 'I I'], { I: Ir, S });
  shaped(B.CAULDRON, 1, ['I I', 'I I', 'III'], { I: Ir });
  shaped(B.POT, 1, ['T T', ' T '], { T: B.TERRACOTTA });
  shaped(B.BANNER, 2, ['RRR', 'RRR', ' S '], { R: B.WOOL_RED, S });
  shaped(B.WAYSTONE, 1, ['PXP', 'XEX', 'PXP'], { P: B.POLISHED, X, E });
  shaped(I.compass, 1, [' I ', 'IXI', ' I '], { I: Ir, X });
  // --- stone & masonry
  shaped(B.POLISHED, 4, ['CC', 'CC'], { C });
  shaped(B.STONEBRICK, 4, ['PP', 'PP'], { P: B.POLISHED });
  shaped(B.STONEPOST, 4, ['P', 'P'], { P: B.POLISHED });
  shapeless(B.STONE, 1, [C, I.coal]);
  shapeless(B.MOSSYCOBBLE, 1, [C, B.MUSHROOM]);
  shapeless(B.MOSSYBRICK, 1, [B.STONEBRICK, B.MUSHROOM]);
  shapeless(B.CRACKEDBRICK, 1, [B.STONEBRICK, I.coal]);
  shapeless(B.GRAVEL, 2, [C, C]);
  shaped(B.SANDSTONE, 1, ['SS', 'SS'], { S: B.SAND });
  shaped(B.SANDBRICK, 4, ['SS', 'SS'], { S: B.SANDSTONE });
  shapeless(B.TERRACOTTA, 2, [B.DIRT, B.SAND]);
  shaped(B.REDBRICK, 4, ['TT', 'TT'], { T: B.TERRACOTTA });
  shaped(B.ROOF_RED, 6, ['TTT'], { T: B.TERRACOTTA });
  shaped(B.ROOF_BLUE, 6, ['PPP'], { P: B.POLISHED });
  shaped(B.DARKBRICK, 4, ['BB', 'BB'], { B: B.BASALT });
  shapeless(B.DARKBRICK_CRACKED, 1, [B.DARKBRICK, E]);
  shapeless(B.GLASS, 2, [B.SAND, I.coal]);
  shapeless(B.PLASTER, 4, [B.SAND, B.DIRT, B.SAND, B.DIRT]);
  shapeless(B.TIMBER, 2, [B.PLASTER, S, S]);
  shaped(B.THATCH, 4, ['WWW', 'WWW'], { W: I.wheat });
  shaped(B.HAY, 1, ['WWW', 'WWW', 'WWW'], { W: I.wheat });
  shaped(B.IRON_BLOCK, 1, ['III', 'III', 'III'], { I: Ir });
  shaped(B.GOLD_BLOCK, 1, ['GGG', 'GGG', 'GGG'], { G });
  shapeless(B.ANCIENT_GOLD, 1, [B.GOLD_BLOCK, X, X, X, X]);
  shaped(B.CRYSTAL, 1, ['XX', 'XX'], { X });
  shapeless(B.CRYSTAL_ROSE, 1, [B.CRYSTAL, B.FLOWER_RED]);
  // --- cloth
  shaped(B.WOOL_WHITE, 1, ['KK', 'KK'], { K });
  shapeless(B.WOOL_RED, 1, [B.WOOL_WHITE, B.FLOWER_RED]);
  shapeless(B.WOOL_BLUE, 1, [B.WOOL_WHITE, B.FLOWER_BLUE]);
  shapeless(B.WOOL_YELLOW, 1, [B.WOOL_WHITE, B.FLOWER_YELLOW]);
  shapeless(B.WOOL_GREEN, 1, [B.WOOL_WHITE, B.CACTUS]);
  shapeless(B.WOOL_PURPLE, 1, [B.WOOL_WHITE, B.FLOWER_RED, B.FLOWER_BLUE]);
  // --- tools: pickaxe, axe, shovel, sword per material
  for (const [m, pick, axe, shovel, sword] of [[P, I.wood_pick, I.wood_axe, I.wood_shovel, I.wood_sword], [C, I.stone_pick, I.stone_axe, I.stone_shovel, I.stone_sword]]) {
    shaped(pick, 1, ['MMM', ' S ', ' S '], { M: m, S });
    shaped(axe, 1, ['MM', 'MS', ' S'], { M: m, S });
    shaped(shovel, 1, ['M', 'S', 'S'], { M: m, S });
    shaped(sword, 1, ['M', 'M', 'S'], { M: m, S });
  }
  shaped(I.crystal_pick, 1, ['XIX', ' S ', ' S '], { X, I: Ir, S });
  shaped(I.crystal_axe, 1, ['XX', 'XS', 'IS'], { X, I: Ir, S });
  shaped(I.crystal_shovel, 1, ['X', 'I', 'S'], { X, I: Ir, S });
  shaped(I.crystal_sword, 1, ['X', 'X', 'S'], { X, S });
  // --- ranged & magic & special weapons
  shaped(I.arrow, 4, ['F', 'S'], { F: C, S });
  shaped(I.arrow, 6, ['C', 'S', 'F'], { C, S, F: I.feather });
  shaped(I.shears, 1, [' I', 'I '], { I: Ir });
  shaped(B.ENCHANT_TABLE, 1, [' J ', 'LIL', 'PPP'], { J: I.journal, L: I.lapis, I: Ir, P: B.POLISHED });
  shapeless(B.MUSHROOM, 1, [I.spore, I.spore]);
  shapeless(I.journal, 2, [I.ink, I.wheat, I.wheat]);
  shaped(I.ranger_bow, 1, [' SK', 'S K', ' SK'], { S, K });
  shaped(I.prism_bow, 1, [' XK', 'G K', ' XK'], { X, K, G });
  shaped(I.gloomshiv, 1, ['I', 'E', 'S'], { I: Ir, E, S });
  shaped(I.rune_maul, 1, ['III', 'IXI', ' S '], { I: Ir, X, S });
  shaped(I.thunder_staff, 1, [' XE', ' SX', 'S  '], { X, E, S });
  shaped(I.colossus_edge, 1, ['  A', 'XA ', 'SX '], { A: B.ANCIENT_GOLD, X, S });
  // --- armor (helm, chest, legs, boots)
  const sets = [['hide', { M: L }, null], ['prism', { M: X }, Ir], ['warden', { M: Ir }, E]];
  for (const [set, key, extra] of sets) {
    const k = Object.assign({}, key, extra ? { Y: extra } : {});
    shaped(I[set + '_helm'], 1, extra ? ['MYM', 'M M'] : ['MMM', 'M M'], k);
    shaped(I[set + '_chest'], 1, extra ? ['M M', 'MYM', 'MMM'] : ['M M', 'MMM', 'MMM'], k);
    shaped(I[set + '_legs'], 1, extra ? ['MYM', 'M M', 'M M'] : ['MMM', 'M M', 'M M'], k);
    shaped(I[set + '_boots'], 1, extra ? ['Y Y', 'M M'] : ['M M', 'M M'], k);
  }
  // --- relics & consumables
  shaped(I.wolf_totem, 1, ['LGL', 'GVG', 'LGL'], { L, G, V: I.venison });
  shaped(I.ember_charm, 1, ['GEG', 'EIE', 'GEG'], { G, E, I: Ir });
  shaped(I.colossus_heart, 1, ['XAX', 'AEA', 'XAX'], { X, A: B.ANCIENT_GOLD, E });
  shaped(I.bread, 1, ['WWW'], { W: I.wheat });
  shapeless(I.ration, 1, [I.bread, I.venison, I.globerry, I.globerry]);
  shapeless(I.potion, 1, [B.GLASS, I.globerry, I.globerry, I.wheat]);
})();
// match the contents of a crafting grid (array of {id,n}|null, size×size) against all recipes
// both kinds of wood are interchangeable in every recipe (except log -> planks, which keeps its colour)
const WOOD_ALIAS = { [B.PLANKS_DARK]: B.PLANKS, [B.DARKLOG]: B.LOG };
const woodKey = id => WOOD_ALIAS[id] || id;
const woodFamily = id => id === B.PLANKS ? [B.PLANKS, B.PLANKS_DARK] : id === B.LOG ? [B.LOG, B.DARKLOG] : [id];
function matchRecipe(grid, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1; const ids = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const s = grid[x + y * size]; if (s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); ids.push(s.id); } }
  if (!ids.length) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cell = (x, y) => { const s = grid[(x0 + x) + (y0 + y) * size]; return s ? s.id : 0; };
  for (const r of RECIPES) {
    if (r.pat) {
      if (r.w !== w || r.h !== h) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) { const ch = r.pat[y][mirror ? w - 1 - x : x]; const want = (ch === ' ' || ch === '.') ? 0 : r.key[ch]; const c = cell(x, y); if (c !== want && (r.exact || woodKey(c) !== want)) ok = false; }
        if (ok) return r;
      }
    } else if (r.list.length === ids.length) {
      const a = ids.map(woodKey).sort(), b = r.list.map(woodKey).sort();
      if (a.every((v, i) => v === b[i])) return r;
    }
  }
  return null;
}
const CRAFTABLE = new Set(RECIPES.map(r => r.out[0]));

// ---------------------------------------------------------------- loot tables  [item, min, max, chance]
const LOOT = {
  house: [[I.pot_night, 1, 1, 0.12], [I.pot_regen, 1, 1, 0.06], [I.bread, 1, 3, 0.8], [I.gold, 1, 3, 0.5], [I.coal, 1, 3, 0.3], [B.TORCH, 2, 4, 0.4], [I.stick, 2, 5, 0.3]],
  farm: [[I.wheat, 3, 8, 1], [I.bread, 1, 3, 0.8], [I.globerry, 2, 4, 0.5], [I.gold, 1, 2, 0.4]],
  fish: [[I.bread, 1, 2, 0.7], [I.silk, 1, 3, 0.6], [I.gold, 1, 3, 0.5], [I.potion, 1, 1, 0.25]],
  library: [[I.pot_night, 1, 1, 0.35], [I.pot_haste, 1, 1, 0.25], [I.lapis, 2, 5, 0.5], [I.journal, 1, 2, 1], [I.gold, 2, 5, 0.8], [I.potion, 1, 1, 0.4], [I.shard, 1, 2, 0.4]],
  market: [[I.bread, 2, 4, 1], [I.globerry, 2, 5, 0.7], [I.gold, 1, 4, 0.7], [I.ration, 1, 1, 0.3]],
  desert: [[I.pot_fire, 1, 1, 0.3], [I.pot_swift, 1, 1, 0.3], [I.lapis, 1, 4, 0.4], [I.gold, 2, 6, 1], [I.potion, 1, 1, 0.5], [B.POT, 1, 2, 0.5], [I.shard, 1, 2, 0.3], [I.silk, 1, 3, 0.4]],
  mine: [[I.pot_haste, 1, 1, 0.5], [I.pot_haste2, 1, 1, 0.15], [I.pot_night, 1, 1, 0.3], [I.lapis, 2, 6, 0.6], [I.iron, 2, 5, 1], [I.coal, 3, 8, 1], [I.shard, 1, 3, 0.6], [B.TORCH, 4, 8, 0.6], [I.gold, 1, 3, 0.4]],
  camp: [[I.pot_swift, 1, 1, 0.25], [I.pot_leap, 1, 1, 0.2], [I.bread, 1, 2, 0.8], [I.arrow, 4, 10, 0.6], [I.stick, 3, 6, 0.6], [I.gold, 1, 2, 0.4], [I.leather, 1, 3, 0.3]],
  ruins: [[I.pot_strength, 1, 1, 0.35], [I.lapis, 3, 6, 0.5], [I.pot_haste, 1, 1, 0.3], [I.journal, 1, 1, 1], [I.gold, 3, 7, 1], [I.shard, 1, 3, 0.6], [I.potion, 1, 1, 0.5]],
  royal: [[I.pot_strength, 1, 2, 0.6], [I.pot_regen, 1, 1, 0.5], [I.gold, 6, 12, 1], [I.shard, 2, 5, 1], [I.potion, 1, 2, 0.8], [I.wolf_totem, 1, 1, 1]],
  fort: [[I.pot_fire, 1, 2, 0.8], [I.pot_strength, 1, 1, 0.4], [I.iron, 3, 7, 1], [I.gold, 4, 9, 1], [I.ember, 1, 3, 0.8], [I.potion, 1, 2, 0.6], [I.arrow, 6, 12, 0.6]],
  armory: [[I.warden_helm, 1, 1, 1], [I.warden_chest, 1, 1, 1], [I.warden_legs, 1, 1, 1], [I.warden_boots, 1, 1, 1], [I.ember_charm, 1, 1, 1]],
  tower: [[I.ranger_bow, 1, 1, 1], [I.arrow, 12, 20, 1], [I.journal, 1, 1, 1], [I.ration, 1, 2, 0.8]],
  witch: [[I.pot_leap, 1, 2, 0.6], [I.pot_night, 1, 1, 0.6], [I.pot_swift, 1, 1, 0.6], [I.gloomshiv, 1, 1, 1], [I.potion, 2, 3, 1], [I.globerry, 3, 6, 0.8]],
  supply: [[I.wood_pick, 1, 1, 1], [I.wood_axe, 1, 1, 1], [I.bread, 3, 3, 1], [B.TORCH, 8, 8, 1], [I.stick, 4, 4, 1]],
  coffer: [[I.pot_haste2, 1, 1, 0.4], [I.lapis, 4, 8, 0.7], [I.gold, 4, 8, 1], [I.potion, 1, 2, 0.8], [I.arrow, 8, 16, 0.6], [I.shard, 2, 4, 0.7]],
  vault: [[I.pot_haste2, 1, 2, 1], [I.pot_regen, 1, 2, 1], [I.crystal_pick, 1, 1, 1], [I.thunder_staff, 1, 1, 1], [I.gold, 8, 14, 1], [I.shard, 4, 8, 1]],
  warden: [[I.key, 1, 1, 1], [I.rune_maul, 1, 1, 1], [I.potion, 2, 2, 1]],
  barrel: [[I.pot_haste, 1, 1, 0.1], [I.wheat, 2, 6, 0.6], [I.coal, 1, 4, 0.5], [I.bread, 1, 2, 0.4], [I.globerry, 1, 3, 0.4], [I.arrow, 2, 6, 0.3]],
  crate: [[I.pot_swift, 1, 1, 0.08], [I.stick, 2, 6, 0.6], [B.TORCH, 1, 4, 0.5], [I.leather, 1, 2, 0.3], [I.iron, 1, 2, 0.25], [B.PLANKS, 2, 6, 0.5]],
  hoard: [[I.colossus_edge, 1, 1, 1], [I.colossus_heart, 1, 1, 1], [I.gold, 20, 30, 1], [B.ANCIENT_GOLD, 2, 4, 1]],
};
const CHEST_NAMES = {
  house: 'Cottage Chest', farm: 'Granary Chest', fish: "Fisher's Trunk", library: 'Archive Chest', market: 'Merchant Crate',
  desert: 'Oasis Coffer', mine: 'Miner\'s Locker', camp: 'Camp Supplies', ruins: 'Weathered Chest', royal: 'Sovereign\'s Offering',
  fort: 'Bastion Strongbox', armory: 'Armory Locker', tower: "Watchkeeper's Chest", witch: "Bog Hag's Trunk", supply: 'Old Supply Chest',
  coffer: 'Drowned Coffer', vault: 'Hidden Vault', warden: "Mirewarden's Hoard", hoard: 'Hoard of the Colossus', barrel: 'Barrel', crate: 'Supply Crate',
};
function rollLoot(table, r) {
  r = r || Math.random;
  const out = [];
  for (const [it, lo, hi, p] of LOOT[table] || LOOT.house) if (r() <= p) out.push({ id: it, n: lo + Math.floor(r() * (hi - lo + 1)) });
  return out;
}

// ---------------------------------------------------------------- icons
const ICON_CACHE = {};
function iconCanvas(id) {
  if (ICON_CACHE[id]) return ICON_CACHE[id];
  const cv = document.createElement('canvas');
  if (id < 256) { cv.width = cv.height = 32; drawBlockIcon(cv, id); }
  else { cv.width = cv.height = 16; drawItemIcon(cv, ITEMS[id]); }
  ICON_CACHE[id] = cv;
  return cv;
}
function iconURL(id) {
  const c = iconCanvas(id);
  if (!c._url) c._url = c.toDataURL();
  return c._url;
}
function tileXY(name) { const i = Atlas.tiles[name]; return [(i % ATLAS_N) * TILE, Math.floor(i / ATLAS_N) * TILE]; }
function drawBlockIcon(cv, id) {
  const ctx = cv.getContext('2d'), b = BLK[id];
  ctx.imageSmoothingEnabled = false;
  if (['cross', 'flat', 'ladder'].includes(b.render) || b.id === B.BANNER) {
    const [sx, sy] = tileXY(b.tex.side); ctx.drawImage(Atlas.canvas, sx, sy, 16, 16, 0, 0, 32, 32); return;
  }
  const face = (name, m, shade) => {
    const [sx, sy] = tileXY(name);
    ctx.save(); ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(Atlas.canvas, sx, sy, 16, 16, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,' + shade + ')'; ctx.fillRect(0, 0, 16, 16); ctx.restore();
  };
  face(b.tex.top, [1, 0.5, -1, 0.5, 16, 0], 0);
  face(b.tex.front || b.tex.side, [1, 0.5, 0, 1, 0, 8], 0.25);
  face(b.tex.side, [1, -0.5, 0, 1, 16, 16], 0.42);
}
function drawItemIcon(cv, it) {
  const ctx = cv.getContext('2d'), img = ctx.createImageData(16, 16), px = [];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const c0 = hex(it.c[0]), c1 = hex(it.c[1] || it.c[0]);
  const lit = c => c.map(v => Math.min(255, v * 1.3 + 30)), dk = c => c.map(v => v * 0.65);
  const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 16 && y < 16) px[x + y * 16] = c; };
  const L = (x0, y0, x1, y1, c, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; P(x, y, c); if (w) P(x + 1, y, c); } };
  const C = (cx, cy, r, c, ring) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - cx, y - cy); if (ring ? Math.abs(d - r) < 0.6 : d <= r) P(x, y, c); } };
  const Rr = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, c); };
  const handle = (x0, y0, x1, y1) => L(x0, y0, x1, y1, hex('#7a5430'));
  switch (it.paint) {
    case 'stick': L(4, 12, 12, 4, c0); L(5, 12, 12, 5, dk(c0)); break;
    case 'wheat': for (let k = 0; k < 4; k++) { L(5 + k, 14, 7 + k * 2, 3, k % 2 ? c0 : dk(c0)); P(7 + k * 2, 3, lit(c0)); } L(4, 10, 11, 10, hex('#8a2a1a')); break;
    case 'lump': C(8, 8, 4.5, c0); C(7, 7, 2, c1); break;
    case 'ingot': for (let y = 6; y <= 11; y++) for (let x = 3 + (11 - y) / 2; x <= 12 - (11 - y) / 2; x++) P(x, y, y === 6 ? lit(c0) : y > 9 ? dk(c0) : c0); break;
    case 'coin': C(8, 8, 5, dk(c0)); C(8, 8, 4, c0); C(8, 8, 2, c1, true); break;
    case 'shard': for (let y = 2; y < 15; y++) { const w = y < 8 ? (y - 2) * 0.6 : (14 - y) * 0.5; for (let x = 8 - w; x <= 8 + w; x++) P(x, y, x < 8 ? c1 : c0); } break;
    case 'silk': C(8, 8, 5, c0, true); C(8, 8, 3, c0, true); C(8, 8, 1, c0); break;
    case 'hide': Rr(3, 3, 12, 12, c0); for (let i = 3; i <= 12; i += 3) { P(3, i, [0, 0, 0, 0]); P(12, i + 1, [0, 0, 0, 0]); } Rr(5, 5, 10, 10, c1); break;
    case 'arrow': L(3, 13, 12, 4, c0); L(10, 3, 13, 3, c1); L(13, 3, 13, 6, c1); L(3, 11, 3, 13, [240, 240, 240]); L(3, 13, 5, 13, [240, 240, 240]); break;
    case 'page': Rr(4, 2, 11, 13, c0); for (let y = 4; y < 12; y += 2) L(5, y, 10, y, [120, 100, 70]); break;
    case 'key': C(5, 5, 3, c0, true); C(5, 5, 3.8, dk(c1), true); L(7, 7, 13, 13, c0); L(11, 13, 13, 11, c0); L(9, 11, 11, 9, c0); break;
    case 'compass': C(8, 8, 6, dk(c0)); C(8, 8, 5, c0); C(8, 8, 4, c1); L(8, 8, 11, 5, [210, 40, 40]); L(8, 8, 5, 11, [80, 80, 90]); P(8, 8, [30, 30, 30]); break;
    case 'bread': for (let y = 5; y <= 12; y++) for (let x = 2; x <= 13; x++) if (((x - 7.5) / 6) ** 2 + ((y - 9) / 3.5) ** 2 <= 1) P(x, y, y < 8 ? c1 : c0); L(5, 7, 6, 8, dk(c0)); L(8, 6, 9, 7, dk(c0)); L(11, 7, 12, 8, dk(c0)); break;
    case 'berries': for (const [x, y] of [[6, 7], [10, 8], [8, 11], [5, 11], [11, 12]]) { C(x, y, 2, c0); P(x - 1, y - 1, c1); } L(8, 2, 8, 6, hex('#3e7a2a')); break;
    case 'egg': for (let y = 2; y <= 14; y++) for (let x = 3; x <= 12; x++) { const X = (x - 7.5) / 4.6, Y = (y - 8.6) / 6.2 * (y < 8 ? 1.15 : 1); if (X * X + Y * Y <= 1) P(x, y, ((x * 7 + y * 13) % 11 < 3) ? c1 : (x < 7 && y < 8 ? lit(c0) : c0)); } break;
    case 'drumstick': C(9, 7, 4.5, c0); C(8, 6, 2, lit(c0)); L(6, 10, 3, 13, c1, true); C(2, 13, 1.2, c1); C(4, 14, 1.2, c1); break;
    case 'stew': C(8, 10, 5.5, hex('#6a4a2a')); C(8, 10, 4.5, hex('#8a6038')); C(8, 9, 3.5, c0); P(6, 8, hex('#e8a040')); P(9, 9, hex('#5a8a3a')); P(10, 8, hex('#e8a040')); break;
    case 'fish': for (let y = 5; y <= 11; y++) for (let x = 2; x <= 11; x++) if (((x - 6.5) / 4.8) ** 2 + ((y - 8) / 3) ** 2 <= 1) P(x, y, y < 8 ? lit(c0) : c0); L(12, 5, 14, 3, c0); L(12, 11, 14, 13, c0); L(11, 8, 14, 8, c0); Rr(12, 6, 13, 10, c0); P(4, 7, [20, 20, 20]); L(6, 10, 10, 10, c1); break;
    case 'comb': for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) P(x, y, ((x + (y % 2)) % 3 === 0 || y % 3 === 0) ? dk(c0) : (x + y) % 5 ? c0 : c1); break;
    case 'bone': L(4, 12, 11, 5, c0, true); C(3.5, 12.5, 1.6, c0); C(5, 13.5, 1.4, c0); C(12, 4, 1.6, c0); C(11, 2.5, 1.4, c0); L(5, 12, 11, 6, c1); break;
    case 'feather': L(3, 13, 12, 3, c1); for (let i = 0; i < 8; i++) { const x = 5 + i, y = 11 - i; L(x, y, x - 2, y - 3, c0); L(x, y, x + 2, y + 1, c0); } break;
    case 'pearl': C(8, 8, 5.5, dk(c0)); C(8, 8, 4.5, c0); C(7, 7, 2.5, c1); C(9, 9, 1.5, dk(c0)); P(6, 6, [255, 255, 255]); break;
    case 'shears': L(3, 3, 10, 10, c0, true); L(3, 10, 10, 3, c0, true); C(11.5, 11.5, 2.2, c1, true); C(11.5, 4, 2.2, c1, true); P(7, 7, [60, 60, 60]); break;
    case 'meat': C(9, 7, 4.5, c0); C(8, 6, 2, lit(c0)); L(5, 10, 2, 13, c1, true); C(2, 13, 1, c1); break;
    case 'parcel': Rr(3, 5, 12, 12, c0); L(3, 8, 12, 8, c1); L(7, 5, 7, 12, c1); Rr(6, 3, 8, 5, c1); break;
    case 'potion': C(8, 10, 4.5, [200, 220, 235]); C(8, 10, 3.5, c0); P(7, 9, c1); Rr(7, 3, 9, 6, [200, 220, 235]); Rr(7, 2, 9, 3, hex('#7a5430')); break;
    case 'sword': { // long pointed blade, crossguard, grip, pommel
      for (let i = 0; i <= 9; i++) { const x = 5 + i, y = 10 - i; P(x, y, c0); if (i < 9) P(x + 1, y, c0); P(x, y - 1, lit(c0)); }
      P(15, 0, lit(c0));
      L(2, 9, 7, 14, hex('#c8a040'), false); L(3, 9, 7, 13, hex('#e8c860'), false);
      L(4, 11, 2, 13, hex('#6a4424'), true); P(1, 14, hex('#c8a040')); P(1, 15, hex('#8a6a28'));
      break; }
    case 'dagger': L(6, 9, 12, 3, c0, true); L(6, 8, 11, 3, lit(c0)); L(4, 8, 7, 11, c1); handle(5, 10, 3, 12); P(2, 13, hex('#a83ae0')); break;
    case 'greatsword': L(4, 10, 14, 0, c0, true); L(5, 10, 15, 0, c0); L(4, 9, 13, 0, lit(c0)); L(2, 8, 7, 13, c1, true); handle(3, 11, 1, 13); P(0, 14, c1); break;
    case 'maul': handle(3, 13, 10, 6); Rr(8, 1, 14, 7, c0); Rr(8, 1, 14, 2, lit(c0)); P(11, 4, c1); P(10, 5, c1); P(12, 5, c1); break;
    case 'staff': handle(3, 13, 11, 5); C(12, 4, 2.5, c1); P(11, 3, [255, 255, 255]); P(14, 1, c1); P(15, 5, c1); break;
    case 'bow': for (let t = 0; t <= 1; t += 0.05) { const x = 3 + 10 * t - 3 * Math.sin(t * Math.PI), y = 13 - 10 * t - 3 * Math.sin(t * Math.PI); P(x, y, c0); } L(4, 12, 12, 4, c1); break;
    case 'pick': { // double-pointed curved head across the top of a diagonal handle
      L(2, 14, 10, 6, hex('#7a5430'), true);
      for (let t = -1; t <= 1.001; t += 0.05) { const ux = 0.707, uy = 0.707, vx = 0.707, vy = -0.707; const x = 10 + t * ux * 6.5 + (1 - t * t) * vx * 2.6, y = 5.5 + t * uy * 6.5 + (1 - t * t) * vy * 2.6; P(x, y, c0); P(x + 0.7, y - 0.7, lit(c0)); P(x - 0.6, y + 0.6, dk(c0)); }
      break; }
    case 'axe': { // handle with a broad crescent blade on its upper-left side
      L(3, 14, 11, 5, hex('#7a5430'), true);
      const rows = [[3, 7, 10], [4, 5, 11], [5, 4, 11], [6, 4, 11], [7, 5, 10], [8, 7, 9]];
      for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) P(x, y, x === x0 ? lit(c0) : x === x0 + 1 ? lit(c0) : x >= x1 - 1 ? dk(c0) : c0);
      P(11, 4, hex('#7a5430')); P(12, 3, hex('#7a5430'));
      break; }
    case 'shovel': { // rounded spade at the end of the handle
      L(2, 14, 9, 7, hex('#7a5430'), true);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x - 11.3, dy = y - 4.7, a = (dx - dy) * 0.707, b = (dx + dy) * 0.707; if (Math.abs(a) < 2.8 && b > -3.6 && b < 3.2 && (b < 1.8 || Math.abs(a) < 2.8 - (b - 1.8) * 1.4)) P(x, y, Math.abs(a) < 0.8 ? dk(c0) : c0); }
      break; }
    case 'helm': Rr(3, 4, 12, 10, c0); Rr(3, 4, 12, 5, lit(c0)); Rr(5, 8, 10, 10, [0, 0, 0, 0]); Rr(5, 8, 6, 9, c1); Rr(9, 8, 10, 9, c1); break;
    case 'chestplate': Rr(3, 3, 12, 13, c0); Rr(6, 3, 9, 5, [0, 0, 0, 0]); Rr(3, 8, 3, 13, [0, 0, 0, 0]); Rr(12, 8, 12, 13, [0, 0, 0, 0]); L(7, 7, 8, 11, c1); break;
    case 'greaves': Rr(4, 3, 11, 5, c0); Rr(4, 6, 7, 13, c0); Rr(8, 6, 11, 13, c0); L(4, 3, 11, 3, c1); break;
    case 'boots': Rr(3, 7, 6, 12, c0); Rr(9, 7, 12, 12, c0); Rr(1, 11, 6, 13, dk(c0)); Rr(9, 11, 14, 13, dk(c0)); L(3, 7, 6, 7, c1); L(9, 7, 12, 7, c1); break;
    case 'totem': for (let y = 2; y < 14; y++) { const x = 6 + Math.sin(y / 4) * 3; P(x, y, c0); P(x + 1, y, c0); } L(4, 3, 12, 3, c1); C(8, 3, 1.5, c1); break;
    case 'heart': for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const X = (x - 7.5) / 6, Y = (y - 7) / 6; if ((X * X + Y * Y - 0.6) ** 3 - X * X * (-Y) ** 3 * 1.2 < 0) P(x, y, (x + y) % 4 ? c0 : c1); } break;
    case 'charm': C(8, 9, 4.5, c0); C(8, 9, 2.5, c1); L(8, 1, 8, 4, [200, 200, 200]); break;
    default: Rr(4, 4, 11, 11, c0);
  }
  // auto outline
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const c = px[x + y * 16];
    const o = (x + y * 16) * 4;
    if (c && c.length === 3) { img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; continue; }
    let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = px[(x + dx) + (y + dy) * 16]; if (x + dx >= 0 && x + dx < 16 && y + dy >= 0 && y + dy < 16 && n && n.length === 3) edge = true; }
    if (edge) { img.data[o] = 24; img.data[o + 1] = 18; img.data[o + 2] = 28; img.data[o + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
}
