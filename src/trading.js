'use strict';
/* Villager trading as in Java Edition 1.21: professions come from job site blocks, each level adds two trades
   from that level's pool, trades give the villager experience (levels at 10, 70, 150 and 250), prices follow
   demand (price + base * demand * multiplier) and the Hero of the Village discount, and villagers restock at
   their job site up to twice a day. */
const Trading = (() => {
  const LEVELS = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];
  const XP_AT = [0, 10, 70, 150, 250];
  const COLORS16 = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  // trade kinds (the game's VillagerTrades listings):
  //  buy: [item, count, maxUses, xp]                   -> count x item for an emerald (EmeraldForItems)
  //  sell: [item, emeralds, count, maxUses, xp, mult]   -> count x item for emeralds (ItemsForEmeralds)
  //  swap: [emeralds, from, fromCount, to, toCount, maxUses, xp] (ItemsAndEmeraldsToItems)
  //  ench: [item, emeralds, maxUses, xp, mult]         -> an enchanted tool or armour piece
  //  book: [xp]                                         -> an enchanted book for emeralds and a book
  //  dyed: [item, emeralds, maxUses, xp]                -> randomly dyed leather
  //  map: [emeralds, structure, maxUses, xp]           -> an explorer map for emeralds and a compass
  const T = {
    farmer: { job: 'composter', levels: [
      [['buy', 'wheat', 20, 16, 2], ['buy', 'potato', 26, 16, 2], ['buy', 'carrot', 22, 16, 2], ['buy', 'beetroot', 15, 16, 2], ['sell', 'bread', 1, 6, 16, 1]],
      [['buy', 'pumpkin', 6, 12, 10], ['sell', 'pumpkin_pie', 1, 4, 12, 5], ['sell', 'apple', 1, 4, 16, 5]],
      [['sell', 'cookie', 3, 18, 12, 10], ['buy', 'melon', 4, 12, 20]],
      [['sell', 'cake', 1, 1, 12, 15], ['stew', 1, 12, 15]],
      [['sell', 'golden_carrot', 3, 3, 12, 30], ['sell', 'glistering_melon_slice', 4, 3, 12, 30]]] },
    fisherman: { job: 'barrel', levels: [
      [['buy', 'string', 20, 16, 2], ['buy', 'coal', 10, 16, 2], ['swap', 1, 'cod', 6, 'cooked_cod', 6, 16, 1], ['sell', 'cod_bucket', 3, 1, 16, 1]],
      [['buy', 'cod', 15, 16, 10], ['swap', 1, 'salmon', 6, 'cooked_salmon', 6, 16, 5], ['sell', 'campfire', 2, 1, 12, 5]],
      [['buy', 'salmon', 13, 16, 20], ['ench', 'fishing_rod', 3, 3, 10, 0.2]],
      [['buy', 'tropical_fish', 6, 12, 30]],
      [['buy', 'pufferfish', 4, 12, 30], ['boat', 1, 12, 30]]] },
    shepherd: { job: 'loom', levels: [
      [['buy', 'white_wool', 18, 16, 2], ['buy', 'brown_wool', 18, 16, 2], ['buy', 'black_wool', 18, 16, 2], ['buy', 'gray_wool', 18, 16, 2], ['sell', 'shears', 2, 1, 12, 1]],
      [['buy', 'white_dye', 12, 16, 10], ['buy', 'gray_dye', 12, 16, 10], ['buy', 'black_dye', 12, 16, 10], ['buy', 'light_blue_dye', 12, 16, 10], ['buy', 'lime_dye', 12, 16, 10]].concat(COLORS16.map(c => ['sell', c + '_wool', 1, 1, 16, 5]), COLORS16.map(c => ['sell', c + '_carpet', 1, 4, 16, 5])),
      [['buy', 'yellow_dye', 12, 16, 20], ['buy', 'light_gray_dye', 12, 16, 20], ['buy', 'orange_dye', 12, 16, 20], ['buy', 'red_dye', 12, 16, 20], ['buy', 'pink_dye', 12, 16, 20]].concat(COLORS16.map(c => ['sell', c + '_bed', 3, 1, 12, 10])),
      [['buy', 'brown_dye', 12, 16, 30], ['buy', 'purple_dye', 12, 16, 30], ['buy', 'blue_dye', 12, 16, 30], ['buy', 'green_dye', 12, 16, 30], ['buy', 'magenta_dye', 12, 16, 30], ['buy', 'cyan_dye', 12, 16, 30]].concat(COLORS16.map(c => ['sell', c + '_banner', 3, 1, 12, 15])),
      [['sell', 'painting', 2, 3, 12, 30]]] },
    fletcher: { job: 'fletching_table', levels: [
      [['buy', 'stick', 32, 16, 2], ['sell', 'arrow', 1, 16, 12, 1], ['swap', 1, 'gravel', 10, 'flint', 10, 12, 1]],
      [['buy', 'flint', 26, 12, 10], ['sell', 'bow', 2, 1, 12, 5]],
      [['buy', 'string', 14, 16, 20], ['sell', 'crossbow', 3, 1, 12, 10]],
      [['buy', 'feather', 24, 16, 30], ['ench', 'bow', 2, 3, 15]],
      [['buy', 'tripwire_hook', 8, 12, 30], ['ench', 'crossbow', 3, 3, 15], ['tipped', 2, 5, 12, 30]]] },
    librarian: { job: 'lectern', levels: [
      [['buy', 'paper', 24, 16, 2], ['book', 1], ['sell', 'bookshelf', 9, 1, 12, 1]],
      [['buy', 'book', 4, 12, 10], ['book', 5], ['sell', 'lantern', 1, 1, 12, 5]],
      [['buy', 'ink_sac', 5, 12, 20], ['book', 10], ['sell', 'glass', 1, 4, 12, 10]],
      [['buy', 'writable_book', 2, 12, 30], ['book', 15], ['sell', 'clock', 5, 1, 12, 15], ['sell', 'compass', 4, 1, 12, 15]],
      [['sell', 'name_tag', 20, 1, 12, 30]]] },
    cartographer: { job: 'cartography_table', levels: [
      [['buy', 'paper', 24, 16, 2], ['sell', 'map', 7, 1, 12, 1]],
      [['buy', 'glass_pane', 11, 16, 10], ['map', 13, 'monument', 12, 5], ['map', 12, 'trial_chambers', 12, 5]],
      [['buy', 'compass', 1, 12, 20], ['map', 14, 'mansion', 12, 10]],
      [['sell', 'item_frame', 7, 1, 12, 15]].concat(COLORS16.map(c => ['sell', c + '_banner', 3, 1, 12, 15])),
      [['sell', 'globe_banner_pattern', 8, 1, 12, 30]]] },
    cleric: { job: 'brewing_stand', levels: [
      [['buy', 'rotten_flesh', 32, 16, 2], ['sell', 'redstone', 1, 2, 12, 1]],
      [['buy', 'gold_ingot', 3, 12, 10], ['sell', 'lapis_lazuli', 1, 1, 12, 5]],
      [['buy', 'rabbit_foot', 2, 12, 20], ['sell', 'glowstone', 4, 1, 12, 10]],
      [['buy', 'turtle_scute', 4, 12, 30], ['buy', 'glass_bottle', 9, 12, 30], ['sell', 'ender_pearl', 5, 1, 12, 15]],
      [['buy', 'nether_wart', 22, 12, 30], ['sell', 'experience_bottle', 3, 1, 12, 30]]] },
    armorer: { job: 'blast_furnace', levels: [
      [['buy', 'coal', 15, 16, 2], ['sell', 'iron_leggings', 7, 1, 12, 1, 0.2], ['sell', 'iron_boots', 4, 1, 12, 1, 0.2], ['sell', 'iron_helmet', 5, 1, 12, 1, 0.2], ['sell', 'iron_chestplate', 9, 1, 12, 1, 0.2]],
      [['buy', 'iron_ingot', 4, 12, 10], ['sell', 'bell', 36, 1, 12, 5, 0.2], ['sell', 'chainmail_boots', 1, 1, 12, 5, 0.2], ['sell', 'chainmail_leggings', 3, 1, 12, 5, 0.2]],
      [['buy', 'lava_bucket', 1, 12, 20], ['buy', 'diamond', 1, 12, 20], ['sell', 'chainmail_helmet', 1, 1, 12, 10, 0.2], ['sell', 'chainmail_chestplate', 4, 1, 12, 10, 0.2], ['sell', 'shield', 5, 1, 12, 10, 0.2]],
      [['ench', 'diamond_leggings', 14, 3, 15, 0.2], ['ench', 'diamond_boots', 8, 3, 15, 0.2]],
      [['ench', 'diamond_helmet', 8, 3, 30, 0.2], ['ench', 'diamond_chestplate', 16, 3, 30, 0.2]]] },
    weaponsmith: { job: 'grindstone', levels: [
      [['buy', 'coal', 15, 16, 2], ['sell', 'iron_axe', 3, 1, 12, 1, 0.2], ['ench', 'iron_sword', 2, 3, 1]],
      [['buy', 'iron_ingot', 4, 12, 10], ['sell', 'bell', 36, 1, 12, 5, 0.2]],
      [['buy', 'flint', 24, 12, 20]],
      [['buy', 'diamond', 1, 12, 30], ['ench', 'diamond_axe', 12, 3, 15, 0.2]],
      [['ench', 'diamond_sword', 8, 3, 30, 0.2]]] },
    toolsmith: { job: 'smithing_table', levels: [
      [['buy', 'coal', 15, 16, 2], ['sell', 'stone_axe', 1, 1, 12, 1, 0.2], ['sell', 'stone_shovel', 1, 1, 12, 1, 0.2], ['sell', 'stone_pickaxe', 1, 1, 12, 1, 0.2], ['sell', 'stone_hoe', 1, 1, 12, 1, 0.2]],
      [['buy', 'iron_ingot', 4, 12, 10], ['sell', 'bell', 36, 1, 12, 5, 0.2]],
      [['buy', 'flint', 30, 12, 20], ['ench', 'iron_axe', 1, 3, 10, 0.2], ['ench', 'iron_shovel', 2, 3, 10, 0.2], ['ench', 'iron_pickaxe', 3, 3, 10, 0.2], ['sell', 'diamond_hoe', 4, 1, 3, 10, 0.2]],
      [['buy', 'diamond', 1, 12, 30], ['ench', 'diamond_axe', 12, 3, 15, 0.2], ['ench', 'diamond_shovel', 5, 3, 15, 0.2]],
      [['ench', 'diamond_pickaxe', 13, 3, 30, 0.2]]] },
    butcher: { job: 'smoker', levels: [
      [['buy', 'chicken', 14, 16, 2], ['buy', 'porkchop', 7, 16, 2], ['buy', 'rabbit', 4, 16, 2], ['sell', 'rabbit_stew', 1, 1, 12, 1]],
      [['buy', 'coal', 15, 16, 2], ['sell', 'cooked_porkchop', 1, 5, 16, 5], ['sell', 'cooked_chicken', 1, 8, 16, 5]],
      [['buy', 'mutton', 7, 16, 20], ['buy', 'beef', 10, 16, 20]],
      [['buy', 'dried_kelp_block', 10, 12, 30]],
      [['buy', 'sweet_berries', 10, 12, 30]]] },
    leatherworker: { job: 'cauldron', levels: [
      [['buy', 'leather', 6, 16, 2], ['dyed', 'leather_leggings', 3, 12, 1], ['dyed', 'leather_chestplate', 7, 12, 1]],
      [['buy', 'flint', 26, 12, 10], ['dyed', 'leather_helmet', 5, 12, 5], ['dyed', 'leather_boots', 4, 12, 5]],
      [['buy', 'rabbit_hide', 9, 12, 20], ['dyed', 'leather_chestplate', 7, 12, 10]],
      [['buy', 'turtle_scute', 4, 12, 30], ['dyed', 'leather_horse_armor', 6, 12, 15]],
      [['sell', 'saddle', 6, 1, 12, 30, 0.2], ['dyed', 'leather_helmet', 5, 12, 30]]] },
    mason: { job: 'stonecutter', levels: [
      [['buy', 'clay_ball', 10, 16, 2], ['sell', 'brick', 1, 10, 16, 1]],
      [['buy', 'stone', 20, 16, 10], ['sell', 'chiseled_stone_bricks', 1, 4, 16, 5]],
      [['buy', 'granite', 16, 16, 20], ['buy', 'andesite', 16, 16, 20], ['buy', 'diorite', 16, 16, 20], ['sell', 'dripstone_block', 1, 4, 16, 10], ['sell', 'polished_andesite', 1, 4, 16, 10], ['sell', 'polished_diorite', 1, 4, 16, 10], ['sell', 'polished_granite', 1, 4, 16, 10]],
      [['buy', 'quartz', 12, 12, 30]].concat(COLORS16.map(c => ['sell', c + '_terracotta', 1, 1, 12, 15]), COLORS16.map(c => ['sell', c + '_glazed_terracotta', 1, 1, 12, 15])),
      [['sell', 'quartz_pillar', 1, 1, 12, 30], ['sell', 'quartz_block', 1, 1, 12, 30]]] },
  };
  const JOB_OF = {}; for (const p in T) JOB_OF[T[p].job] = p;
  const isJobSite = id => JOB_OF[BLOCKS[id].name] !== undefined || /cauldron$/.test(BLOCKS[id].name);
  const professionFor = id => JOB_OF[BLOCKS[id].name] || (/cauldron$/.test(BLOCKS[id].name) ? 'leatherworker' : null);
  // the wandering trader: five ordinary offers and one rare one
  const WANDER = [
    ['sell', 'sea_pickle', 2, 1, 5, 1], ['sell', 'slime_ball', 4, 1, 5, 1], ['sell', 'glowstone', 2, 1, 5, 1], ['sell', 'nautilus_shell', 5, 1, 5, 1], ['sell', 'fern', 1, 1, 12, 1],
    ['sell', 'sugar_cane', 1, 1, 8, 1], ['sell', 'pumpkin', 1, 1, 4, 1], ['sell', 'kelp', 3, 1, 12, 1], ['sell', 'cactus', 3, 1, 8, 1], ['sell', 'dandelion', 1, 1, 12, 1], ['sell', 'poppy', 1, 1, 12, 1],
    ['sell', 'blue_orchid', 1, 1, 8, 1], ['sell', 'allium', 1, 1, 12, 1], ['sell', 'azure_bluet', 1, 1, 12, 1], ['sell', 'red_tulip', 1, 1, 12, 1], ['sell', 'orange_tulip', 1, 1, 12, 1], ['sell', 'white_tulip', 1, 1, 12, 1],
    ['sell', 'pink_tulip', 1, 1, 12, 1], ['sell', 'oxeye_daisy', 1, 1, 12, 1], ['sell', 'cornflower', 1, 1, 12, 1], ['sell', 'lily_of_the_valley', 1, 1, 7, 1], ['sell', 'wheat_seeds', 1, 1, 12, 1], ['sell', 'beetroot_seeds', 1, 1, 12, 1],
    ['sell', 'pumpkin_seeds', 1, 1, 12, 1], ['sell', 'melon_seeds', 1, 1, 12, 1], ['sell', 'acacia_sapling', 5, 1, 8, 1], ['sell', 'birch_sapling', 5, 1, 8, 1], ['sell', 'dark_oak_sapling', 5, 1, 8, 1], ['sell', 'jungle_sapling', 5, 1, 8, 1],
    ['sell', 'oak_sapling', 5, 1, 8, 1], ['sell', 'spruce_sapling', 5, 1, 8, 1], ['sell', 'cherry_sapling', 5, 1, 8, 1], ['sell', 'mangrove_propagule', 5, 1, 8, 1]].concat(
    COLORS16.map(c => ['sell', c + '_dye', 1, 3, 12, 1]), ['brain', 'bubble', 'fire', 'horn', 'tube'].map(c => ['sell', c + '_coral_block', 3, 1, 8, 1]),
    [['sell', 'vine', 1, 1, 12, 1], ['sell', 'brown_mushroom', 1, 1, 12, 1], ['sell', 'red_mushroom', 1, 1, 12, 1], ['sell', 'lily_pad', 1, 2, 5, 1], ['sell', 'small_dripleaf', 1, 2, 5, 1], ['sell', 'sand', 1, 8, 8, 1],
      ['sell', 'red_sand', 1, 4, 6, 1], ['sell', 'pointed_dripstone', 1, 2, 5, 1], ['sell', 'rooted_dirt', 1, 2, 5, 1], ['sell', 'moss_block', 1, 2, 5, 1]]);
  const WANDER_RARE = [['sell', 'tropical_fish_bucket', 5, 1, 4, 1], ['sell', 'pufferfish_bucket', 5, 1, 4, 1], ['sell', 'packed_ice', 3, 1, 6, 1], ['sell', 'blue_ice', 6, 1, 6, 1], ['sell', 'gunpowder', 1, 1, 8, 1],
    ['sell', 'podzol', 3, 3, 6, 1]].concat(['acacia', 'birch', 'dark_oak', 'jungle', 'oak', 'spruce', 'cherry', 'mangrove'].map(w => ['sell', w + '_log', 1, 8, 4, 1]));

  const rnd = n => Math.floor(Math.random() * n);
  const em = n => stack('emerald', n);
  // ---------------------------------------------------------------- making offers
  function offer(spec, v) {
    const k = spec[0];
    const o = (a, b, out, max, xp, mult) => ({ a, b, out, max, xp, mult: mult === undefined ? 0.05 : mult, uses: 0, demand: 0, special: 0, reward: true });
    switch (k) {
      case 'buy': return o(stack(spec[1], spec[2]), null, em(1), spec[3], spec[4]);
      case 'sell': return o(em(spec[2]), null, stack(spec[1], spec[3]), spec[4], spec[5], spec[6]);
      case 'swap': return o(em(spec[1]), stack(spec[2], spec[3]), stack(spec[4], spec[5]), spec[6], spec[7]);
      case 'ench': {
        // a random enchantment at level 5-19, priced at the base cost plus that level
        const lvl = 5 + rnd(15), it = ITEMS[IID[spec[1]]];
        const s = Enchant.apply(stack(spec[1]), Enchant.select(it, lvl, MCDATA.enchantTags.on_traded_equipment || Enchant.group('#tradeable')));
        return o(em(Math.min(spec[2] + lvl, 64)), null, s, spec[3], spec[4], spec[5] === undefined ? 0.05 : spec[5]);
      }
      case 'book': {
        const list = (MCDATA.enchantTags.tradeable || []).filter(n => MCDATA.enchantments[n]);
        const e = list[rnd(list.length)], d = MCDATA.enchantments[e], lvl = 1 + rnd(d.max);
        let price = 2 + rnd(5 + lvl * 10) + 3 * lvl;
        if ((MCDATA.enchantTags.double_trade_price || []).includes(e)) price *= 2;
        const out = stack('enchanted_book'); out.tag = { stored: { [e]: lvl } };
        return o(em(Math.min(price, 64)), stack('book'), out, 12, spec[1], 0.2);
      }
      case 'dyed': {
        const out = stack(spec[1]);
        // one to three random dyes mixed, like the game's DyedArmorForEmeralds
        const cols = []; const n = 1 + (Math.random() < 0.7 ? 0 : 1) + (Math.random() < 0.8 ? 0 : 1);
        for (let i = 0; i < n; i++) cols.push(Tex.CLR[COLORS16[rnd(16)]]);
        let r = 0, g = 0, b = 0, mx = 0; for (const c of cols) { const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255; r += cr; g += cg; b += cb; mx += Math.max(cr, cg, cb); }
        r /= n; g /= n; b /= n; const avg = mx / n, m = Math.max(r, g, b); const f = m ? avg / m : 1;
        out.tag = { color: (Math.round(r * f) << 16) | (Math.round(g * f) << 8) | Math.round(b * f) };
        return o(em(spec[2]), null, out, spec[3], spec[4], 0.2);
      }
      case 'map': { const out = stack('filled_map'); out.tag = { explorer: spec[2], name: { monument: 'Ocean Explorer Map', mansion: 'Woodland Explorer Map', trial_chambers: 'Trial Explorer Map' }[spec[2]] }; return o(em(spec[1]), stack('compass'), out, spec[3], spec[4], 0.2); }
      case 'stew': { const fx = [['night_vision', 100], ['jump_boost', 160], ['weakness', 140], ['blindness', 120], ['poison', 280], ['saturation', 7]][rnd(6)]; const out = stack('suspicious_stew'); out.tag = { stew: [fx] }; return o(em(spec[1]), null, out, spec[2], spec[3]); }
      case 'tipped': { const pots = Object.keys(Potions.P).filter(p => !['water', 'mundane', 'thick', 'awkward', 'luck'].includes(p) && Potions.effectsOf(p).length); const out = stack('tipped_arrow', 5); out.tag = { potion: pots[rnd(pots.length)] }; return o(em(spec[1]), stack('arrow', spec[2]), out, spec[3], spec[4]); }
      case 'boat': { const BOAT = { plains: 'oak_boat', taiga: 'spruce_boat', snow: 'spruce_boat', desert: 'jungle_boat', jungle: 'jungle_boat', savanna: 'acacia_boat', swamp: 'dark_oak_boat' }; return o(stack(BOAT[(v && v.vtype) || 'plains'], 1), null, em(spec[1]), spec[2], spec[3]); }
    }
    return null;
  }
  // two new offers from a level's pool (or all of them when there are only two)
  function addLevel(v, level) {
    const pool = T[v.profession].levels[level - 1].slice();
    const picks = [];
    for (let i = 0; i < 2 && pool.length; i++) picks.push(pool.splice(rnd(pool.length), 1)[0]);
    for (const p of picks) { const o = offer(p, v); if (o) v.trades.push(o); }
  }
  function ensureTrades(v) {
    if (v.type === 'wandering_trader') {
      if (!v.trades) { v.trades = []; const pool = WANDER.slice(); for (let i = 0; i < 5; i++) v.trades.push(offer(pool.splice(rnd(pool.length), 1)[0], v)); v.trades.push(offer(WANDER_RARE[rnd(WANDER_RARE.length)], v)); for (const o of v.trades) o.traderXp = true; }
      return;
    }
    if (!v.trades) { v.trades = []; v.level = v.level || 1; for (let l = 1; l <= v.level; l++) addLevel(v, l); }
  }
  // the price after demand, reputation and the Hero of the Village discount
  function costA(o, p) {
    const base = o.a.count;
    const dem = Math.max(0, Math.floor(base * o.demand * o.mult));
    let special = o.special;
    const hero = p && p.effect && p.effect('hero_of_the_village');
    if (hero) special -= Math.max(Math.floor((0.3 + 0.0625 * hero.amp) * base), 1);
    return Math.max(1, Math.min(maxStack(o.a), base + dem + special));
  }
  const outOfStock = o => o.uses >= o.max;
  // ---------------------------------------------------------------- the villager's side
  function trade(v, o, p) {
    o.uses++;
    if (v.type !== 'wandering_trader') {
      v.xp = (v.xp || 0) + o.xp;
      if (v.level < 5 && v.xp >= XP_AT[v.level]) v.levelUpIn = 40;
    }
    // the player gets 3-6 experience (and 5 more when the villager levels up)
    if (o.reward) Drops.spawnXp(v.x, v.y + 0.5, v.z, 3 + rnd(4) + (v.levelUpIn === 40 ? 5 : 0));
    v.lastTraded = p; v.ambientDelay = 0;
    Sound.play('villager_yes', v);
    Stats.add('custom', 'traded_with_villager');
  }
  function levelUp(v) {
    v.level++; addLevel(v, v.level);
    v.addEffect && v.addEffect('regeneration', 200, 0);
    Sound.play('villager_celebrate', v);
    Particles.happy && Particles.happy(v, 10);
    if (Screens.current && Screens.current.villager === v) Screens.current.refresh();
  }
  // restocking: twice a day at most, standing at the job site during work hours
  function restock(v) {
    for (const o of v.trades) { o.demand = o.demand + o.uses - (o.max - o.uses); o.uses = 0; }
    v.restocks = (v.restocks || 0) + 1; v.lastRestock = World.time;
    Sound.play('villager_work', v);
  }
  // the villager's job: find a free job site block nearby, walk to it, take the profession; restock there
  function jobTick(v) {
    if (v.type !== 'villager' || v.baby || v.dead) return;
    if (v.levelUpIn > 0 && --v.levelUpIn === 0) levelUp(v);
    if ((v.age + v.id) % 20 !== 0) return;
    const day = Math.floor(World.time / 24000);
    if (v.restockDay !== day) { v.restockDay = day; v.restocks = 0; }
    if (v.job) {
      const id = World.getBlock(v.job.x, v.job.y, v.job.z);
      if (World.loaded(v.job.x, v.job.z) && !isJobSite(id)) {
        // the job site is gone: a villager who never traded loses the profession
        v.job = null;
        if ((v.xp || 0) === 0 && v.level <= 1) { v.profession = null; v.trades = null; v.model = 'villager'; }
        return;
      }
      const tod = World.time % 24000;
      if (v.profession && tod > 2000 && tod < 9000) {
        const d = Math.hypot(v.x - v.job.x - 0.5, v.z - v.job.z - 0.5);
        if (d > 2 && Math.random() < 0.05) v.nav.moveTo(v.job.x + 0.5, v.job.y, v.job.z + 0.5, 0.5);
        const used = v.trades && v.trades.some(o => o.uses > 0);
        if (d <= 2.2 && used && (v.restocks || 0) < 2 && World.time > (v.lastRestock || -1e9) + 2400) restock(v);
      }
      return;
    }
    if (v.profession === 'nitwit') return;
    if (v.profession && v.xp > 0) return; // keeps a profession it has traded with
    // look for an unclaimed job site within 16 blocks
    if (Math.random() > 0.2) return;
    const claimed = new Set(Entities.list.filter(e => e.type === 'villager' && e.job && e !== v).map(e => e.job.x + ',' + e.job.y + ',' + e.job.z));
    const bx = Math.floor(v.x), by = Math.floor(v.y), bz = Math.floor(v.z);
    let best = null, bd = 1e9;
    for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) for (let dy = -4; dy <= 4; dy++) {
      const id = World.getBlock(bx + dx, by + dy, bz + dz);
      if (!isJobSite(id) || claimed.has((bx + dx) + ',' + (by + dy) + ',' + (bz + dz))) continue;
      const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = [bx + dx, by + dy, bz + dz, id]; }
    }
    if (!best) return;
    if (bd > 5) { v.nav.moveTo(best[0] + 0.5, best[1], best[2] + 0.5, 0.5); return; }
    const prof = professionFor(best[3]);
    if (v.profession && v.profession !== prof) return;
    v.job = { x: best[0], y: best[1], z: best[2] };
    if (!v.profession) { v.profession = prof; v.level = 1; v.xp = 0; v.trades = null; ensureTrades(v); }
    v.model = 'villager_' + v.profession;
    Particles.happy && Particles.happy(v, 8);
    Sound.play('villager_work', v);
  }
  function open(p, v) {
    if (v.type === 'villager' && (!v.profession || v.profession === 'nitwit')) { v.shake = 40; Sound.play('villager_no', v); return; }
    ensureTrades(v);
    if (!v.trades.length) { v.shake = 40; Sound.play('villager_no', v); return; }
    Sound.play('villager_trade', v);
    Screens.open(new MerchantScreen(v));
  }
  return { open, ensureTrades, costA, trade, outOfStock, jobTick, restock, LEVELS, XP_AT, T, isJobSite, professionFor };
})();

// ---------------------------------------------------------------- the trading screen
class MerchantScreen extends Screens.Screen {
  constructor(v) {
    super(v.type === 'wandering_trader' ? 'Wandering Trader' : 'Villager', 276, 166);
    this.villager = v; this.pay = [null, null]; this.sel = -1; this.scroll = 0; this.result = null;
    v.tradingWith = Game.player;
    this.p0 = Object.assign(this.slot(null, 0, 136, 37, { onChange: () => this.update() }), Stations.mk(this.pay, 0));
    this.p1 = Object.assign(this.slot(null, 1, 162, 37, { onChange: () => this.update() }), Stations.mk(this.pay, 1));
    this.out = this.slot(null, 2, 220, 37, { output: true, get: () => this.result, set: () => {}, onTake: () => this.take() });
    this.playerSlots(108, 84); this.invLabel = [108, 72];
    this.parts.push({ kind: 'el', node: part2('tradelistbg', 4, 17, 97, 142) });
    this.list = part2('tradelist', 5, 18, 88, 140); this.list.style.pointerEvents = 'auto'; this.parts.push({ kind: 'el', node: this.list });
    this.list.addEventListener('wheel', e => { e.preventDefault(); const n = this.villager.trades.length; this.scroll = Math.max(0, Math.min(Math.max(0, n - 7), this.scroll + Math.sign(e.deltaY))); this.drawList(); });
    this.titleEl = elAt('tradetitle', 101, 6, ''); this.parts.push({ kind: 'el', node: this.titleEl });
    this.xpbar = elAt('tradexp', 136, 16, ''); this.xpbar.innerHTML = '<i></i><b></b>'; this.parts.push({ kind: 'el', node: this.xpbar });
    this.parts.push({ kind: 'el', node: elAt('craftarrow', 186, 36, GUI.css('craft_arrow')) });
    this.err = elAt('anvilerr', 186, 36, ''); this.parts.push({ kind: 'el', node: this.err });
    this.label('Trades', 34, 6);
  }
  refresh() { this.drawList(); this.update(); Screens.render(); }
  build() { super.build(); this.drawList(); }
  drawList() {
    const v = this.villager, S = GUI.S, p = Game.player;
    let h = '';
    v.trades.slice(this.scroll, this.scroll + 7).forEach((o, k) => {
      const i = k + this.scroll, a = Trading.costA(o, p), out = Trading.outOfStock(o);
      const aStack = Object.assign({}, o.a, { count: a });
      h += `<div class="tradebtn${i === this.sel ? ' sel' : ''}${out ? ' out' : ''}" data-i="${i}" style="top:${k * 20 * S}px">`;
      h += `<span class="ta">${iconHTML(aStack)}${a !== o.a.count ? `<s>${o.a.count}</s>` : ''}</span>`;
      if (o.b) h += `<span class="tb">${iconHTML(o.b)}</span>`;
      h += `<span class="tarrow${out ? ' x' : ''}"></span><span class="tout">${iconHTML(o.out)}</span></div>`;
    });
    this.list.innerHTML = h;
    for (const el of this.list.querySelectorAll('.tradebtn')) {
      const i = +el.dataset.i;
      el.addEventListener('mousedown', e => { e.stopPropagation(); this.select(i); });
      el.addEventListener('mouseenter', () => Slots.showTip(v.trades[i].out));
      el.addEventListener('mouseleave', () => Slots.hideTip());
    }
  }
  // choosing an offer moves the payment back into the inventory and fills it again for that offer
  select(i) {
    const p = Game.player, o = this.villager.trades[i];
    this.sel = i;
    for (let k = 0; k < 2; k++) { if (this.pay[k]) { const left = p.inv.add(this.pay[k], 0, 36); this.pay[k] = left; } }
    const fill = (k, want) => {
      if (!want || this.pay[k]) return;
      let n = 0; const max = maxStack(want);
      for (let s = 0; s < 36 && n < max; s++) { const t = p.inv.get(s); if (t && t.id === want.id && sameItem(Object.assign({}, t, { count: 1 }), Object.assign({}, want, { count: 1, dmg: t.dmg }))) { const take = Math.min(t.count, max - n); n += take; t.count -= take; p.inv.set(s, t.count ? t : null); } }
      if (n) this.pay[k] = Object.assign({}, want, { count: n });
    };
    if (o) { fill(0, o.a); fill(1, o.b); }
    this.update(); this.drawList(); Screens.render();
  }
  // does the payment cover offer o? (the selected one first, then any other)
  covers(o) {
    if (Trading.outOfStock(o)) return false;
    const p = Game.player, a = Trading.costA(o, p);
    const okA = s => s && s.id === o.a.id && s.count >= a, okB = s => (!o.b && !s) || (o.b && s && s.id === o.b.id && s.count >= o.b.count);
    if (okA(this.pay[0]) && okB(this.pay[1])) return 'ab';
    if (!o.b && okA(this.pay[1]) && !this.pay[0]) return 'ba';
    if (o.b && okA(this.pay[1]) && this.pay[0] && this.pay[0].id === o.b.id && this.pay[0].count >= o.b.count) return 'swap';
    return false;
  }
  update() {
    const v = this.villager; this.result = null; this.match = -1;
    const order = this.sel >= 0 ? [this.sel].concat(v.trades.map((_, i) => i).filter(i => i !== this.sel)) : v.trades.map((_, i) => i);
    for (const i of order) { if (this.covers(v.trades[i])) { this.match = i; this.result = Object.assign({}, v.trades[i].out, { tag: v.trades[i].out.tag ? JSON.parse(JSON.stringify(v.trades[i].out.tag)) : undefined }); if (!this.result.tag) delete this.result.tag; break; } }
  }
  take() {
    const v = this.villager, o = v.trades[this.match], p = Game.player; if (!o) return;
    const how = this.covers(o), a = Trading.costA(o, p);
    const use = (k, n) => { const s = this.pay[k]; s.count -= n; if (s.count <= 0) this.pay[k] = null; };
    if (how === 'ab') { use(0, a); if (o.b) use(1, o.b.count); }
    else if (how === 'ba') use(1, a);
    else if (how === 'swap') { use(1, a); use(0, o.b.count); }
    Trading.trade(v, o, p);
    this.update(); this.drawList();
  }
  renderExtra() {
    const v = this.villager;
    const title = v.type === 'wandering_trader' ? '' : `${(v.profession || '').replace(/^./, c => c.toUpperCase()).replace('_', ' ')} - ${Trading.LEVELS[(v.level || 1) - 1]}`;
    if (this.titleEl.textContent !== title) this.titleEl.textContent = title;
    const show = v.type !== 'wandering_trader';
    this.xpbar.style.display = show ? '' : 'none';
    if (show) {
      const lv = v.level || 1, lo = Trading.XP_AT[lv - 1], hi = Trading.XP_AT[Math.min(4, lv)];
      const f = lv >= 5 ? 1 : Math.max(0, Math.min(1, ((v.xp || 0) - lo) / (hi - lo)));
      this.xpbar.querySelector('i').style.width = (f * 100) + '%';
      // the pending experience of the selected trade shows as a lighter part
      const o = v.trades[this.sel], add = o && lv < 5 ? Math.min(1 - f, o.xp / (hi - lo)) : 0;
      const b = this.xpbar.querySelector('b'); b.style.left = (f * 100) + '%'; b.style.width = (add * 100) + '%';
    }
    this.err.style.display = (this.pay[0] || this.pay[1]) && !this.result ? '' : 'none';
  }
  quickMove(s) {
    if (s === this.out) {
      // shift-click on the result trades as many times as the payment allows
      for (let n = 0; n < 64 && this.result; n++) { const r = this.result; const left = Game.player.inv.add(r, 0, 36); if (left) { if (left.count < r.count) { this.take(); ItemUse.drop(Game.player, left); } break; } this.take(); }
      return;
    }
    super.quickMove(s);
  }
  quickTargets() { return [this.p0, this.p1]; }
  onClose() { this.villager.tradingWith = null; Stations.giveBack(Game.player, this.pay[0]); Stations.giveBack(Game.player, this.pay[1]); Slots.hideTip(); }
}
