'use strict';
/* Items. Names, stack sizes, durability, food and repair materials come from the game data (src/data/mcdata.js);
   tool speeds and tiers, weapon damage and attack speed, armour points and toughness, fuel burn times and the
   smelting recipes are the Java Edition 1.21 values. Every block that has an item form is an item too. */
const ITEMS = [], IID = {};
const MD = MCDATA;
function prettify(n) { return n.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '); }
function regItem(name, o) {
  if (IID[name] !== undefined) return Object.assign(ITEMS[IID[name]], o || {});
  const md = MD.items[name];
  const it = Object.assign({
    id: ITEMS.length, name, display: md ? md[0] : (MD.blocks[name] ? MD.blocks[name][0] : prettify(name)),
    stack: md ? md[1] : 64, dur: md ? md[2] : 0, enchCat: md ? md[3] : [], repair: md ? md[4] : [],
    block: -1, icon: null, tool: null, dmg: 1, aspd: 4, armor: null, food: null, fuel: 0, use: null, rarity: 0,
  }, o || {});
  ITEMS.push(it); IID[name] = it.id;
  return it;
}
// tool materials: harvest tier, mining speed, durability (from data), enchantability
const TIERS = {
  wooden: { tier: 1, speed: 2, ench: 15 }, stone: { tier: 2, speed: 4, ench: 5 }, iron: { tier: 3, speed: 6, ench: 14 },
  golden: { tier: 1, speed: 12, ench: 22 }, diamond: { tier: 4, speed: 8, ench: 10 }, netherite: { tier: 5, speed: 9, ench: 15 },
};
const WEAPON = { // [damage, attack speed]
  sword: { wooden: [4, 1.6], stone: [5, 1.6], iron: [6, 1.6], golden: [4, 1.6], diamond: [7, 1.6], netherite: [8, 1.6] },
  axe: { wooden: [7, 0.8], stone: [9, 0.8], iron: [9, 0.9], golden: [7, 1.0], diamond: [9, 1.0], netherite: [10, 1.0] },
  pickaxe: { wooden: [2, 1.2], stone: [3, 1.2], iron: [4, 1.2], golden: [2, 1.2], diamond: [5, 1.2], netherite: [6, 1.2] },
  shovel: { wooden: [2.5, 1], stone: [3.5, 1], iron: [4.5, 1], golden: [2.5, 1], diamond: [5.5, 1], netherite: [6.5, 1] },
  hoe: { wooden: [1, 1], stone: [1, 2], iron: [1, 3], golden: [1, 1], diamond: [1, 4], netherite: [1, 4] },
};
const ARMOR = { // points per slot (head, chest, legs, feet), toughness, knockback resistance, enchantability
  leather: [[1, 3, 2, 1], 0, 0, 15], chainmail: [[2, 5, 4, 1], 0, 0, 12], iron: [[2, 6, 5, 2], 0, 0, 9],
  golden: [[2, 5, 3, 1], 0, 0, 25], diamond: [[3, 8, 6, 3], 2, 0, 10], netherite: [[3, 8, 6, 3], 3, 0.1, 15],
};
const SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];

(function buildItems() {
  // block items first, in registry order
  const placeAs = { redstone_wire: 'redstone', wheat: 'wheat_seeds', carrots: 'carrot', potatoes: 'potato', beetroots: 'beetroot_seeds', cocoa: 'cocoa_beans', pumpkin_stem: 'pumpkin_seeds',
    melon_stem: 'melon_seeds', sweet_berry_bush: 'sweet_berries', tripwire: 'string', cave_vines: 'glow_berries' };
  for (const d of BLOCKS) {
    if (!d.item && !placeAs[d.name]) continue;
    const name = placeAs[d.name] || d.name;
    regItem(name, { block: d.id });
    if (d.name === 'kelp') ITEMS[IID.kelp].block = d.id;
  }
  // wall versions are placed by the floor item
  const wallOf = { torch: 'wall_torch', soul_torch: 'soul_wall_torch', redstone_torch: 'redstone_wall_torch' };
  for (const k in wallOf) ITEMS[IID[k]].wall = BID[wallOf[k]];
  for (const w of WOODS.concat(STEMS, ['bamboo'])) ITEMS[IID[w + '_sign']].wall = BID[w + '_wall_sign'];
  // tools and weapons
  for (const mat in TIERS) {
    for (const kind of ['sword', 'shovel', 'pickaxe', 'axe', 'hoe']) {
      const [dmg, aspd] = WEAPON[kind][mat];
      regItem(mat + '_' + kind, { tool: { kind, tier: TIERS[mat].tier, speed: TIERS[mat].speed, mat }, dmg, aspd, ench: TIERS[mat].ench, icon: { sprite: mat + '_' + kind }, fireproof: mat === 'netherite' });
    }
  }
  regItem('shears', { tool: { kind: 'shears', tier: 1, speed: 1.5 }, use: 'shears' });
  // armour
  for (const mat in ARMOR) SLOTS.forEach((slot, i) => {
    const [pts, tough, kb, ench] = ARMOR[mat];
    regItem(mat + '_' + slot, { armor: { slot: i, pts: pts[i], tough, kb, mat }, ench, use: 'equip', fireproof: mat === 'netherite' });
  });
  regItem('turtle_helmet', { armor: { slot: 0, pts: 2, tough: 0, kb: 0, mat: 'turtle' }, ench: 9, use: 'equip' });
  regItem('elytra', { armor: { slot: 1, pts: 0, tough: 0, kb: 0, mat: 'elytra' }, use: 'equip', rarity: 1 });
  ITEMS[IID.carved_pumpkin].armor = { slot: 0, pts: 0, tough: 0, kb: 0, mat: 'pumpkin' };
  for (const s of ['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'creeper_head', 'player_head', 'piglin_head', 'dragon_head']) ITEMS[IID[s]].armor = { slot: 0, pts: 0, tough: 0, kb: 0, mat: 'head' };
  for (const h of ['leather', 'iron', 'golden', 'diamond']) regItem(h + '_horse_armor', { use: null });
  // ranged and other gear
  regItem('bow', { use: 'bow', ench: 1 }); regItem('crossbow', { use: 'crossbow', ench: 1 }); regItem('arrow'); regItem('spectral_arrow'); regItem('tipped_arrow');
  regItem('trident', { use: 'trident', dmg: 9, aspd: 1.1, ench: 1, rarity: 3 }); regItem('shield', { use: 'shield' }); regItem('fishing_rod', { use: 'fishing_rod', ench: 1 });
  regItem('flint_and_steel', { use: 'flint_and_steel' }); regItem('fire_charge', { use: 'fire_charge' });
  regItem('compass', { use: null }); regItem('recovery_compass'); regItem('clock'); regItem('spyglass', { use: 'spyglass' }); regItem('lead', { use: 'lead' }); regItem('name_tag', { use: 'name_tag' });
  regItem('saddle', { use: 'saddle' }); regItem('carrot_on_a_stick', { use: 'carrot_on_a_stick' }); regItem('warped_fungus_on_a_stick', { use: 'carrot_on_a_stick' }); regItem('brush', { use: 'brush' });
  regItem('totem_of_undying', { rarity: 1 }); regItem('map', { use: 'map' }); regItem('filled_map'); regItem('writable_book', { use: 'book' }); regItem('written_book', { use: 'book' }); regItem('book'); regItem('enchanted_book', { rarity: 1 });
  regItem('paper'); regItem('bowl'); regItem('glass_bottle', { use: 'glass_bottle' }); regItem('potion', { use: 'drink' }); regItem('splash_potion', { use: 'throw' }); regItem('lingering_potion', { use: 'throw' });
  regItem('experience_bottle', { use: 'throw', rarity: 1 }); regItem('ender_pearl', { use: 'throw' }); regItem('ender_eye', { use: 'ender_eye' }); regItem('snowball', { use: 'throw' }); regItem('egg', { use: 'throw' });
  regItem('end_crystal', { use: 'end_crystal', rarity: 1 }); regItem('firework_rocket', { use: 'firework' }); regItem('firework_star');
  regItem('bucket', { use: 'bucket' }); regItem('water_bucket', { use: 'bucket' }); regItem('lava_bucket', { use: 'bucket', fuel: 20000 }); regItem('milk_bucket', { use: 'drink' }); regItem('powder_snow_bucket', { use: 'bucket' });
  for (const f of ['cod', 'salmon', 'tropical_fish', 'pufferfish', 'axolotl', 'tadpole']) regItem(f + '_bucket', { use: 'bucket' });
  regItem('minecart', { use: 'minecart' }); for (const m of ['chest', 'hopper', 'tnt', 'furnace']) regItem(m + '_minecart', { use: 'minecart' });
  for (const w of WOODS) { if (w === 'mangrove' || true) { regItem(w + '_boat', { use: 'boat' }); regItem(w + '_chest_boat', { use: 'boat' }); } }
  regItem('bamboo_raft', { use: 'boat' }); regItem('bamboo_chest_raft', { use: 'boat' });
  regItem('painting', { use: 'hang' }); regItem('item_frame', { use: 'hang' }); regItem('glow_item_frame', { use: 'hang' }); regItem('armor_stand', { use: 'armor_stand' });
  for (const c of COLORS) regItem(c + '_dye', { use: 'dye' });
  for (const d of ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait', 'pigstep', 'otherside']) regItem('music_disc_' + d, { use: 'disc', rarity: 2 });
  // materials
  for (const n of ['stick', 'coal', 'charcoal', 'diamond', 'emerald', 'lapis_lazuli', 'quartz', 'amethyst_shard', 'raw_iron', 'raw_copper', 'raw_gold', 'iron_ingot', 'copper_ingot', 'gold_ingot',
    'netherite_ingot', 'netherite_scrap', 'iron_nugget', 'gold_nugget', 'glowstone_dust', 'feather', 'gunpowder', 'flint', 'leather', 'rabbit_hide', 'rabbit_foot', 'bone', 'bone_meal', 'ink_sac', 'glow_ink_sac',
    'slime_ball', 'magma_cream', 'blaze_rod', 'blaze_powder', 'ghast_tear', 'nether_star', 'prismarine_shard', 'prismarine_crystals', 'nautilus_shell', 'heart_of_the_sea', 'turtle_scute', 'phantom_membrane',
    'shulker_shell', 'dragon_breath', 'echo_shard', 'clay_ball', 'brick', 'nether_brick', 'wheat', 'sugar', 'honeycomb', 'popped_chorus_fruit', 'fermented_spider_eye', 'glistering_melon_slice',
    'netherite_upgrade_smithing_template', 'disc_fragment_5', 'goat_horn', 'armadillo_scute', 'breeze_rod', 'heavy_core', 'wind_charge', 'mace']) regItem(n);
  ITEMS[IID.bone_meal].use = 'bone_meal'; ITEMS[IID.wind_charge].use = 'throw'; ITEMS[IID.mace].dmg = 6; ITEMS[IID.mace].aspd = 0.6;
  ITEMS[IID.nether_star].rarity = 2; ITEMS[IID.heart_of_the_sea].rarity = 2; ITEMS[IID.dragon_breath].rarity = 1;
  // food (hunger and saturation from the data)
  for (const n of ['apple', 'golden_apple', 'enchanted_golden_apple', 'melon_slice', 'chorus_fruit', 'golden_carrot', 'baked_potato', 'poisonous_potato', 'beetroot', 'dried_kelp', 'beef', 'cooked_beef',
    'porkchop', 'cooked_porkchop', 'mutton', 'cooked_mutton', 'chicken', 'cooked_chicken', 'rabbit', 'cooked_rabbit', 'cod', 'cooked_cod', 'salmon', 'cooked_salmon', 'tropical_fish', 'pufferfish',
    'bread', 'cookie', 'pumpkin_pie', 'rotten_flesh', 'spider_eye', 'mushroom_stew', 'beetroot_soup', 'rabbit_stew', 'suspicious_stew', 'honey_bottle']) regItem(n);
  for (const n in MD.foods) if (IID[n] !== undefined) { ITEMS[IID[n]].food = MD.foods[n]; if (!ITEMS[IID[n]].use) ITEMS[IID[n]].use = 'eat'; }
  // food effects (vanilla)
  const fx = (n, list) => { if (IID[n] !== undefined) ITEMS[IID[n]].foodFx = list; };
  fx('golden_apple', [['regeneration', 100, 1], ['absorption', 2400, 0]]);
  fx('enchanted_golden_apple', [['regeneration', 400, 1], ['absorption', 2400, 3], ['resistance', 6000, 0], ['fire_resistance', 6000, 0]]);
  fx('rotten_flesh', [['hunger', 600, 0, 0.8]]); fx('spider_eye', [['poison', 100, 0]]); fx('poisonous_potato', [['poison', 100, 0, 0.6]]);
  fx('chicken', [['hunger', 600, 0, 0.3]]); fx('pufferfish', [['poison', 1200, 1], ['hunger', 300, 2], ['nausea', 300, 0]]); fx('honey_bottle', [['clear', 'poison']]);
  ITEMS[IID.golden_apple].rarity = 1; ITEMS[IID.enchanted_golden_apple].rarity = 2; ITEMS[IID.golden_apple].alwaysEat = true; ITEMS[IID.enchanted_golden_apple].alwaysEat = true; ITEMS[IID.chorus_fruit].alwaysEat = true;
  for (const n of ['mushroom_stew', 'beetroot_soup', 'rabbit_stew', 'suspicious_stew']) ITEMS[IID[n]].leftover = 'bowl';
  ITEMS[IID.honey_bottle].leftover = 'glass_bottle';
  ITEMS[IID.cake].use = null;
  // spawn eggs
  for (const m of MOB_LIST) regItem(m + '_spawn_egg', { use: 'spawn_egg', mob: m });
  // fuel (ticks)
  const F = (n, t) => { if (IID[n] !== undefined) ITEMS[IID[n]].fuel = t; };
  F('coal', 1600); F('charcoal', 1600); F('coal_block', 16000); F('blaze_rod', 2400); F('dried_kelp_block', 4001); F('lava_bucket', 20000);
  for (const it of ITEMS) {
    const n = it.name, bd = it.block >= 0 ? BLOCKS[it.block] : null;
    if (it.fuel) continue;
    const woody = /(^|_)(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo)_/.test(n) || n.startsWith('stripped_');
    if (n.endsWith('_planks') && !n.startsWith('crimson') && !n.startsWith('warped')) it.fuel = 300;
    else if (/_(log|wood)$/.test(n) && !/crimson|warped/.test(n)) it.fuel = 300;
    else if (woody && /_(slab)$/.test(n)) it.fuel = 150;
    else if (woody && /_(stairs|fence|fence_gate|trapdoor|pressure_plate)$/.test(n)) it.fuel = 300;
    else if (woody && /_(door|sign)$/.test(n)) it.fuel = 200;
    else if (woody && /_button$/.test(n)) it.fuel = 100;
    else if (woody && /_(boat|chest_boat|raft|chest_raft)$/.test(n)) it.fuel = 1200;
    else if (/^wooden_/.test(n)) it.fuel = 200;
    else if (/_sapling$|propagule|^bowl$|^stick$/.test(n)) it.fuel = 100;
    else if (/_wool$/.test(n)) it.fuel = 100; else if (/_carpet$/.test(n)) it.fuel = 67;
    else if (['crafting_table', 'chest', 'trapped_chest', 'bookshelf', 'jukebox', 'note_block', 'ladder', 'barrel', 'composter', 'lectern', 'loom', 'cartography_table', 'fletching_table', 'smithing_table', 'daylight_detector', 'bow', 'crossbow', 'fishing_rod', 'brown_mushroom_block', 'red_mushroom_block', 'mushroom_stem', 'chiseled_bookshelf', 'bee_nest', 'beehive'].includes(n)) it.fuel = 300;
    else if (n === 'bamboo' || n === 'scaffolding') it.fuel = 50;
    else if (n === 'azalea' || n === 'flowering_azalea' || n === 'dead_bush') it.fuel = 100;
    void bd;
  }
})();
// block id -> the item it drops / is picked as
const ITEM_OF_BLOCK = new Int16Array(BLOCKS.length).fill(-1);
for (const it of ITEMS) if (it.block >= 0 && ITEM_OF_BLOCK[it.block] < 0) ITEM_OF_BLOCK[it.block] = it.id;
for (const [w, f] of [['wall_torch', 'torch'], ['soul_wall_torch', 'soul_torch'], ['redstone_wall_torch', 'redstone_torch']]) ITEM_OF_BLOCK[BID[w]] = IID[f];
for (const w of WOODS.concat(STEMS, ['bamboo'])) ITEM_OF_BLOCK[BID[w + '_wall_sign']] = IID[w + '_sign'];
ITEM_OF_BLOCK[BID.kelp_plant] = IID.kelp; ITEM_OF_BLOCK[BID.weeping_vines_plant] = IID.weeping_vines; ITEM_OF_BLOCK[BID.twisting_vines_plant] = IID.twisting_vines;
ITEM_OF_BLOCK[BID.cave_vines_plant] = IID.glow_berries; ITEM_OF_BLOCK[BID.attached_pumpkin_stem] = IID.pumpkin_seeds; ITEM_OF_BLOCK[BID.attached_melon_stem] = IID.melon_seeds;
ITEM_OF_BLOCK[BID.water] = IID.water_bucket; ITEM_OF_BLOCK[BID.lava] = IID.lava_bucket; ITEM_OF_BLOCK[BID.tall_seagrass] = IID.seagrass;
ITEM_OF_BLOCK[BID.piston_head] = IID.piston; ITEM_OF_BLOCK[BID.fire] = IID.flint_and_steel; ITEM_OF_BLOCK[BID.soul_fire] = IID.flint_and_steel;

// ---------------------------------------------------------------- item stacks
function stack(name, count, o) { const id = typeof name === 'number' ? name : IID[name]; if (id === undefined) throw new Error('unknown item ' + name); return Object.assign({ id, count: count === undefined ? 1 : count, dmg: 0 }, o || {}); }
const sameItem = (a, b) => a && b && a.id === b.id && a.dmg === b.dmg && JSON.stringify(a.tag || null) === JSON.stringify(b.tag || null);
const maxStack = s => ITEMS[s.id].stack;
const itemName = s => (s.tag && s.tag.name) || potionName(s) || ITEMS[s.id].display;
function potionName(s) { if (!s.tag || !s.tag.potion) return null; const it = ITEMS[s.id]; if (!/potion|tipped_arrow/.test(it.name)) return null; return typeof Potions !== 'undefined' ? Potions.displayName(s) : null; }
const enchOf = s => (s && s.tag && s.tag.ench) || null;
const enchLevel = (s, e) => (s && s.tag && s.tag.ench && s.tag.ench[e]) || 0;

// ---------------------------------------------------------------- crafting recipes (from the data) and smelting
const Recipes = (() => {
  const list = [];
  const tagMembers = name => name && name[0] === '#' ? name.slice(1).split('|') : null;
  const okName = n => n === null || (tagMembers(n) ? tagMembers(n).some(m => IID[m] !== undefined) : IID[n] !== undefined);
  for (const r of MD.recipes) {
    if (IID[r.r] === undefined) continue;
    const cells = r.s ? r.s.flat() : r.i;
    if (!cells.every(okName)) continue;
    // planks come from any of their logs (log, wood, stripped log, stripped wood)
    list.push(r);
  }
  // the data lists only one log per planks recipe; the game takes the whole log tag
  for (const w of WOODS.concat(STEMS)) {
    const p = list.find(r => r.r === w + '_planks' && r.i);
    const logs = STEMS.includes(w) ? [w + '_stem', 'stripped_' + w + '_stem', w + '_hyphae', 'stripped_' + w + '_hyphae'] : [w + '_log', 'stripped_' + w + '_log', w + '_wood', 'stripped_' + w + '_wood'];
    if (p) p.i = ['#' + logs.join('|')];
  }
  // dyeing wool, carpet, beds, terracotta, glass and concrete powder: any colour + dye
  for (const c of COLORS) {
    for (const k of ['wool', 'carpet']) list.push({ r: c + '_' + k, n: 1, i: [c + '_dye', '#' + COLORS.filter(o => o !== c).map(o => o + '_' + k).join('|')] });
    list.push({ r: c + '_bed', n: 1, i: [c + '_dye', '#' + COLORS.filter(o => o !== c).map(o => o + '_bed').join('|')] });
  }
  const shaped = list.filter(r => r.s), shapeless = list.filter(r => r.i);
  const matches = (want, s) => {
    if (want === null) return !s;
    if (!s) return false;
    const tag = tagMembers(want);
    const n = ITEMS[s.id].name;
    return tag ? tag.includes(n) : n === want;
  };
  // grid: array of w*h stacks (null for empty); returns { result, recipe } or null
  function match(grid, w) {
    const h = grid.length / w;
    // trim to the used rectangle
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[x + y * w]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const cell = (x, y) => grid[(x0 + x) + (y0 + y) * w];
    for (const r of shaped) {
      const rh = r.s.length, rw = r.s[0].length;
      if (rw !== tw || rh !== th) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < th && ok; y++) for (let x = 0; x < tw && ok; x++) if (!matches(r.s[y][mirror ? tw - 1 - x : x], cell(x, y))) ok = false;
        if (ok) return { result: stack(r.r, r.n), recipe: r };
      }
    }
    const items = grid.filter(s => s);
    for (const r of shapeless) {
      if (r.i.length !== items.length) continue;
      const used = new Array(items.length).fill(false);
      let ok = true;
      for (const want of r.i) { const k = items.findIndex((s, i) => !used[i] && matches(want, s)); if (k < 0) { ok = false; break; } used[k] = true; }
      if (ok) return { result: stack(r.r, r.n), recipe: r };
    }
    // special recipes: repairing two damaged tools of the same kind, firework rockets, map cloning, etc.
    if (items.length === 2 && items[0].id === items[1].id && ITEMS[items[0].id].dur > 0 && ITEMS[items[0].id].stack === 1) {
      const it = ITEMS[items[0].id], a = it.dur - items[0].dmg, b = it.dur - items[1].dmg, dur = Math.min(it.dur, a + b + Math.floor(it.dur * 0.05));
      return { result: stack(it.id, 1, { dmg: it.dur - dur }), recipe: { special: 'repair' } };
    }
    if (items.length >= 2 && items.length <= 4 && items.some(s => ITEMS[s.id].name === 'paper') && items.filter(s => ITEMS[s.id].name === 'gunpowder').length === items.length - 1) {
      const g = items.length - 1; return { result: stack('firework_rocket', 3, { tag: { flight: g } }), recipe: { special: 'firework' } };
    }
    // tipped arrows: 8 arrows around a lingering potion
    if (w === 3 && grid.length === 9 && grid[4] && ITEMS[grid[4].id].name === 'lingering_potion' && grid.every((s, i) => i === 4 || (s && ITEMS[s.id].name === 'arrow'))) return { result: stack('tipped_arrow', 8, { tag: { potion: grid[4].tag && grid[4].tag.potion } }), recipe: { special: 'tipped' } };
    return null;
  }
  // every recipe that makes an item (for the recipe book)
  function forItem(name) { return list.filter(r => r.r === name); }
  return { list, match, forItem, tagMembers };
})();

const Smelting = (() => {
  // [input (name or tag list), output, xp, kinds: f furnace, b blast furnace, s smoker, c campfire]
  const R = [];
  const add = (inp, out, xp, kinds) => R.push({ inp: Array.isArray(inp) ? inp : [inp], out, xp, kinds: kinds || 'f' });
  add(['raw_iron', 'iron_ore', 'deepslate_iron_ore'], 'iron_ingot', 0.7, 'fb'); add(['raw_gold', 'gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'], 'gold_ingot', 1, 'fb');
  add(['raw_copper', 'copper_ore', 'deepslate_copper_ore'], 'copper_ingot', 0.7, 'fb'); add(['coal_ore', 'deepslate_coal_ore'], 'coal', 0.1, 'fb');
  add(['diamond_ore', 'deepslate_diamond_ore'], 'diamond', 1, 'fb'); add(['emerald_ore', 'deepslate_emerald_ore'], 'emerald', 1, 'fb');
  add(['lapis_ore', 'deepslate_lapis_ore'], 'lapis_lazuli', 0.2, 'fb'); add(['redstone_ore', 'deepslate_redstone_ore'], 'redstone', 0.7, 'fb');
  add('nether_quartz_ore', 'quartz', 0.2, 'fb'); add('ancient_debris', 'netherite_scrap', 2, 'fb');
  add(['sand', 'red_sand'], 'glass', 0.1); add('cobblestone', 'stone', 0.1); add('stone', 'smooth_stone', 0.1); add('cobbled_deepslate', 'deepslate', 0.1);
  add('stone_bricks', 'cracked_stone_bricks', 0.1); add('deepslate_bricks', 'cracked_deepslate_bricks', 0.1); add('deepslate_tiles', 'cracked_deepslate_tiles', 0.1);
  add('nether_bricks', 'cracked_nether_bricks', 0.1); add('polished_blackstone_bricks', 'cracked_polished_blackstone_bricks', 0.1);
  add('sandstone', 'smooth_sandstone', 0.1); add('red_sandstone', 'smooth_red_sandstone', 0.1); add('quartz_block', 'smooth_quartz', 0.1); add('basalt', 'smooth_basalt', 0.1);
  add('clay_ball', 'brick', 0.3); add('clay', 'terracotta', 0.35); add('netherrack', 'nether_brick', 0.1);
  for (const c of COLORS) add(c + '_terracotta', c + '_glazed_terracotta', 0.1);
  add(WOODS.flatMap(w => [w + '_log', 'stripped_' + w + '_log', w + '_wood', 'stripped_' + w + '_wood']), 'charcoal', 0.15);
  add('cactus', 'green_dye', 1); add('sea_pickle', 'lime_dye', 0.1); add('kelp', 'dried_kelp', 0.1, 'fsc'); add('wet_sponge', 'sponge', 0.15); add('chorus_fruit', 'popped_chorus_fruit', 0.1);
  for (const [a, b] of [['beef', 'cooked_beef'], ['porkchop', 'cooked_porkchop'], ['chicken', 'cooked_chicken'], ['mutton', 'cooked_mutton'], ['rabbit', 'cooked_rabbit'], ['cod', 'cooked_cod'], ['salmon', 'cooked_salmon'], ['potato', 'baked_potato']]) add(a, b, 0.35, 'fsc');
  const metalGear = m => ['sword', 'shovel', 'pickaxe', 'axe', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots'].map(k => m + '_' + k).concat(m === 'iron' ? ['chainmail_helmet', 'chainmail_chestplate', 'chainmail_leggings', 'chainmail_boots', 'iron_horse_armor'] : ['golden_horse_armor']);
  add(metalGear('iron'), 'iron_nugget', 0.1, 'fb'); add(metalGear('golden'), 'gold_nugget', 0.1, 'fb');
  function find(s, kind) {
    if (!s) return null;
    const n = ITEMS[s.id].name;
    for (const r of R) if (r.kinds.includes(kind) && r.inp.includes(n)) return r;
    return null;
  }
  return { R, find };
})();
