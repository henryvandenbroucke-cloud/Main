'use strict';
/* Block registry, shared by the page and the world generator worker.
   Every block has a numeric id (its index), a model, textures per face and its physical rules.
   Block state is one byte per block; its meaning depends on the model (see the comments on each family).
   Directions: 0 down, 1 up, 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x). */
SHARED.push(function blocksModule(G) {
  const BLOCKS = [], BID = {};
  const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
  const STEMS = ['crimson', 'warped'];
  const DIR = { down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 };
  const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0], OPP = [1, 0, 3, 2, 5, 4];
  const FACE_NAMES = ['down', 'up', 'north', 'south', 'west', 'east'];

  function reg(name, o) {
    o = o || {};
    if (BID[name] !== undefined) throw new Error('duplicate block ' + name);
    const id = BLOCKS.length;
    const d = Object.assign({
      id, name, model: 'cube', layer: 0, solid: true, opacity: 15, light: 0, tint: null, fluid: null, replaceable: false,
      gravity: false, flam: null, climb: false, slip: 0.6, speed: 1, jump: 1, place: null, item: true, sound: 'stone',
      cullSame: false, waterlog: false, noAO: false, ticks: false,
    }, o);
    // texture shorthand: string, {all}, {top, bottom, side}, {end, side}, {front, side, top}
    const t = typeof d.tex === 'string' ? { all: d.tex } : (d.tex || { all: name });
    const side = t.side || t.all || name, end = t.end;
    d.tex = {
      up: t.top || end || t.all || side, down: t.bottom || end || t.top || t.all || side,
      north: t.north || t.front || side, south: t.south || side, west: t.west || side, east: t.east || side,
      front: t.front || side, side, extra: t.extra,
    };
    if (d.model !== 'cube' && o.opacity === undefined) d.opacity = 0;
    if (d.layer !== 0 && o.opacity === undefined && d.model === 'cube') d.opacity = 0;
    d.opaque = d.model === 'cube' && d.layer === 0 && d.opacity === 15;
    BLOCKS.push(d); BID[name] = id;
    return d;
  }
  const plant = (o) => Object.assign({ model: 'cross', layer: 1, solid: false, replaceable: false, sound: 'grass', noAO: true }, o);
  const leaves = (o) => Object.assign({ layer: 1, opacity: 1, tint: 'foliage', flam: [30, 60], sound: 'grass', place: 'leaves', ticks: true }, o);

  // ------------------------------------------------------------------ air and fluids
  reg('air', { model: 'none', solid: false, opacity: 0, replaceable: true, item: false });
  reg('cave_air', { model: 'none', solid: false, opacity: 0, replaceable: true, item: false });
  reg('void_air', { model: 'none', solid: false, opacity: 0, replaceable: true, item: false });
  // fluid state: bits 0-2 level (0 source, 1..7 flowing), bit 3 falling
  reg('water', { model: 'liquid', layer: 2, solid: false, opacity: 1, fluid: 'water', replaceable: true, tint: 'water', tex: { all: 'water_still', side: 'water_flow' }, item: false, cullSame: true, ticks: true });
  reg('lava', { model: 'liquid', layer: 0, solid: false, opacity: 1, light: 15, fluid: 'lava', replaceable: true, tex: { all: 'lava_still', side: 'lava_flow' }, item: false, cullSame: true, ticks: true });

  // ------------------------------------------------------------------ stone and earth
  reg('stone'); reg('granite'); reg('polished_granite'); reg('diorite'); reg('polished_diorite'); reg('andesite'); reg('polished_andesite');
  reg('deepslate', { tex: { side: 'deepslate', end: 'deepslate_top' }, place: 'axis', sound: 'deepslate' });
  for (const n of ['cobbled_deepslate', 'polished_deepslate', 'deepslate_bricks', 'cracked_deepslate_bricks', 'deepslate_tiles', 'cracked_deepslate_tiles', 'chiseled_deepslate']) reg(n, { sound: 'deepslate' });
  reg('reinforced_deepslate', { tex: { side: 'reinforced_deepslate_side', top: 'reinforced_deepslate_top', bottom: 'reinforced_deepslate_bottom' } });
  reg('tuff', { sound: 'tuff' }); reg('calcite'); reg('dripstone_block');
  reg('smooth_stone', { tex: { side: 'smooth_stone_slab_side', end: 'smooth_stone' } });
  reg('cobblestone'); reg('mossy_cobblestone');
  reg('bedrock');
  reg('grass_block', { tex: { top: 'grass_block_top', side: 'grass_block_side', bottom: 'dirt', extra: 'grass_block_snow' }, tint: 'grass', sound: 'grass', ticks: true });
  reg('dirt', { sound: 'gravel' }); reg('coarse_dirt', { sound: 'gravel' });
  reg('podzol', { tex: { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' }, sound: 'gravel' });
  reg('rooted_dirt', { sound: 'gravel' });
  reg('mycelium', { tex: { top: 'mycelium_top', side: 'mycelium_side', bottom: 'dirt' }, sound: 'grass', ticks: true });
  reg('dirt_path', { model: 'path', tex: { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' }, opacity: 0, sound: 'grass' });
  // farmland: bits 0-2 moisture
  reg('farmland', { model: 'path', tex: { top: 'farmland', side: 'dirt', bottom: 'dirt' }, opacity: 0, sound: 'gravel', ticks: true });
  reg('mud', { sound: 'mud' }); reg('packed_mud'); reg('mud_bricks');
  reg('clay', { sound: 'gravel' });
  reg('gravel', { gravity: true, sound: 'gravel' });
  reg('sand', { gravity: true, sound: 'sand' }); reg('red_sand', { gravity: true, sound: 'sand' });
  reg('suspicious_sand', { gravity: true, sound: 'sand' }); reg('suspicious_gravel', { gravity: true, sound: 'gravel' });
  reg('sandstone', { tex: { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_bottom' } });
  reg('chiseled_sandstone', { tex: { end: 'sandstone_top', side: 'chiseled_sandstone' } });
  reg('cut_sandstone', { tex: { end: 'sandstone_top', side: 'cut_sandstone' } });
  reg('smooth_sandstone', { tex: 'sandstone_top' });
  reg('red_sandstone', { tex: { top: 'red_sandstone_top', side: 'red_sandstone', bottom: 'red_sandstone_bottom' } });
  reg('chiseled_red_sandstone', { tex: { end: 'red_sandstone_top', side: 'chiseled_red_sandstone' } });
  reg('cut_red_sandstone', { tex: { end: 'red_sandstone_top', side: 'cut_red_sandstone' } });
  reg('smooth_red_sandstone', { tex: 'red_sandstone_top' });
  reg('obsidian'); reg('crying_obsidian', { light: 10 });
  reg('ice', { layer: 2, opacity: 1, slip: 0.98, cullSame: true, sound: 'glass', ticks: true });
  reg('packed_ice', { slip: 0.98, sound: 'glass' }); reg('blue_ice', { slip: 0.989, sound: 'glass' });
  reg('snow_block', { tex: 'snow', sound: 'snow' });
  // snow layer: bits 0-2 = layers - 1
  reg('snow', { model: 'layer', tex: 'snow', opacity: 0, replaceable: true, sound: 'snow', ticks: true });
  reg('powder_snow', { solid: false, sound: 'snow' });
  reg('moss_block', { sound: 'moss' }); reg('moss_carpet', { model: 'carpet', tex: 'moss_block', sound: 'moss' });
  reg('magma_block', { light: 3, tex: 'magma', sound: 'stone' });
  reg('amethyst_block', { sound: 'amethyst' }); reg('budding_amethyst', { sound: 'amethyst', ticks: true });
  for (const n of ['small_amethyst_bud', 'medium_amethyst_bud', 'large_amethyst_bud', 'amethyst_cluster']) reg(n, plant({ model: 'cross', place: 'facing6', light: n === 'amethyst_cluster' ? 5 : n === 'large_amethyst_bud' ? 4 : n === 'medium_amethyst_bud' ? 2 : 1, sound: 'amethyst' }));
  // pointed dripstone: bits 0-2 thickness, bit 3 hanging down
  reg('pointed_dripstone', plant({ model: 'cross', tex: 'pointed_dripstone_down_tip', place: 'dripstone', sound: 'stone' }));

  // ------------------------------------------------------------------ ores and storage blocks
  for (const o of ['coal', 'iron', 'copper', 'gold', 'redstone', 'emerald', 'lapis', 'diamond']) {
    reg(o + '_ore', o === 'redstone' ? { ticks: true } : {});
    reg('deepslate_' + o + '_ore', Object.assign({ sound: 'deepslate' }, o === 'redstone' ? { ticks: true } : {}));
  }
  reg('nether_gold_ore', { sound: 'nether_ore' }); reg('nether_quartz_ore', { sound: 'nether_ore' });
  reg('ancient_debris', { tex: { side: 'ancient_debris_side', end: 'ancient_debris_top' }, sound: 'ancient_debris' });
  for (const n of ['raw_iron_block', 'raw_copper_block', 'raw_gold_block', 'coal_block', 'iron_block', 'copper_block', 'gold_block', 'emerald_block', 'lapis_block', 'diamond_block', 'netherite_block']) reg(n, { sound: n === 'netherite_block' ? 'netherite' : 'metal' });
  reg('redstone_block', { sound: 'metal' });
  reg('exposed_copper', { sound: 'metal' }); reg('weathered_copper', { sound: 'metal' }); reg('oxidized_copper', { sound: 'metal' }); reg('cut_copper', { sound: 'metal' });

  // ------------------------------------------------------------------ wood (logs: bits 0-1 axis 0 y, 1 x, 2 z)
  for (const w of WOODS) {
    const sap = w === 'mangrove' ? 'mangrove_propagule' : w + '_sapling';
    reg(w + '_log', { tex: { side: w + '_log', end: w + '_log_top' }, place: 'axis', flam: [5, 5], sound: w === 'cherry' ? 'cherry_wood' : 'wood' });
    reg('stripped_' + w + '_log', { tex: { side: 'stripped_' + w + '_log', end: 'stripped_' + w + '_log_top' }, place: 'axis', flam: [5, 5], sound: 'wood' });
    reg(w + '_wood', { tex: w + '_log', place: 'axis', flam: [5, 5], sound: 'wood' });
    reg('stripped_' + w + '_wood', { tex: 'stripped_' + w + '_log', place: 'axis', flam: [5, 5], sound: 'wood' });
    reg(w + '_planks', { flam: [5, 20], sound: 'wood' });
    const tint = w === 'spruce' ? 0x619961 : w === 'birch' ? 0x80a755 : w === 'cherry' ? null : 'foliage';
    reg(w + '_leaves', leaves({ tint, sound: w === 'cherry' ? 'cherry_leaves' : 'grass' }));
    reg(sap, plant({ ticks: true, place: 'sapling' }));
  }
  for (const s of STEMS) {
    reg(s + '_stem', { tex: { side: s + '_stem', end: s + '_stem_top' }, place: 'axis', sound: 'stem', light: 0 });
    reg('stripped_' + s + '_stem', { tex: { side: 'stripped_' + s + '_stem', end: 'stripped_' + s + '_stem_top' }, place: 'axis', sound: 'stem' });
    reg(s + '_hyphae', { tex: s + '_stem', place: 'axis', sound: 'stem' });
    reg('stripped_' + s + '_hyphae', { tex: 'stripped_' + s + '_stem', place: 'axis', sound: 'stem' });
    reg(s + '_planks', { sound: 'nether_wood' });
    reg(s + '_nylium', { tex: { top: s + '_nylium', side: s + '_nylium_side', bottom: 'netherrack' }, sound: 'nylium', ticks: true });
    reg(s + '_fungus', plant({ sound: 'fungus', place: 'nether_plant', ticks: true }));
    reg(s + '_roots', plant({ sound: 'roots', place: 'nether_plant', replaceable: true }));
  }
  reg('nether_wart_block', { sound: 'wart' }); reg('warped_wart_block', { sound: 'wart' });
  reg('shroomlight', { light: 15, sound: 'shroomlight' });
  reg('nether_sprouts', plant({ sound: 'roots', replaceable: true, place: 'nether_plant' }));
  reg('weeping_vines', plant({ climb: true, sound: 'vine', place: 'hanging' })); reg('weeping_vines_plant', plant({ climb: true, sound: 'vine', item: false }));
  reg('twisting_vines', plant({ climb: true, sound: 'vine', place: 'twisting' })); reg('twisting_vines_plant', plant({ climb: true, sound: 'vine', item: false }));
  reg('bamboo_block', { tex: { side: 'bamboo_block', end: 'bamboo_block_top' }, place: 'axis', sound: 'bamboo_wood' });
  reg('bamboo_planks', { sound: 'bamboo_wood', flam: [5, 20] });

  // ------------------------------------------------------------------ plants
  reg('short_grass', plant({ tint: 'grass', replaceable: true, tex: 'short_grass', place: 'plant' }));
  reg('fern', plant({ tint: 'grass', replaceable: true, place: 'plant' }));
  reg('dead_bush', plant({ replaceable: true, place: 'dead_bush' }));
  // two-block plants: bit 3 = upper half
  for (const n of ['tall_grass', 'large_fern']) reg(n, plant({ model: 'tall', tint: 'grass', replaceable: true, place: 'tall_plant' }));
  for (const n of ['sunflower', 'lilac', 'rose_bush', 'peony']) reg(n, plant({ model: 'tall', place: 'tall_plant' }));
  for (const n of ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower'])
    reg(n, plant({ place: 'plant' }));
  reg('pink_petals', plant({ model: 'carpet_cross', place: 'plant' }));
  reg('brown_mushroom', plant({ light: 1, place: 'mushroom', ticks: true })); reg('red_mushroom', plant({ place: 'mushroom', ticks: true }));
  reg('brown_mushroom_block', { sound: 'wood' }); reg('red_mushroom_block', { sound: 'wood' }); reg('mushroom_stem', { sound: 'wood' });
  // sugar cane / cactus / bamboo / kelp: bits 0-3 age
  reg('sugar_cane', plant({ tint: 'grass', ticks: true, place: 'sugar_cane' }));
  reg('cactus', { model: 'cactus', tex: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_bottom' }, opacity: 0, ticks: true, sound: 'wool', place: 'cactus', layer: 1 });
  reg('bamboo', { model: 'bamboo', tex: 'bamboo_stalk', layer: 1, opacity: 0, ticks: true, sound: 'bamboo', place: 'bamboo' });
  // vine: bits 0-4 attached faces (north, south, west, east, up)
  reg('vine', plant({ model: 'vine', tint: 'foliage', climb: true, replaceable: true, ticks: true, place: 'vine', flam: [15, 100] }));
  reg('glow_lichen', plant({ model: 'vine', light: 7, replaceable: true, place: 'vine' }));
  reg('lily_pad', plant({ model: 'lily', tint: 0x208030, solid: true, place: 'lily' }));
  reg('pumpkin', { tex: { side: 'pumpkin_side', end: 'pumpkin_top' }, sound: 'wood' });
  reg('carved_pumpkin', { tex: { side: 'pumpkin_side', end: 'pumpkin_top', front: 'carved_pumpkin' }, place: 'facing_h', sound: 'wood' });
  reg('jack_o_lantern', { tex: { side: 'pumpkin_side', end: 'pumpkin_top', front: 'jack_o_lantern' }, place: 'facing_h', light: 15, sound: 'wood' });
  reg('melon', { tex: { side: 'melon_side', end: 'melon_top' }, sound: 'wood' });
  // stems: bits 0-2 age; attached: bits 0-2 facing
  for (const n of ['pumpkin_stem', 'melon_stem']) { reg(n, plant({ model: 'crop', tint: 'stem', ticks: true, item: false, tex: 'stem' })); reg('attached_' + n, plant({ model: 'stem_attached', tint: 0xe0c71c, item: false, tex: 'attached_stem' })); }
  // crops: bits 0-2 age
  reg('wheat', plant({ model: 'crop', ticks: true, item: false, tex: 'wheat_stage7' }));
  reg('carrots', plant({ model: 'crop', ticks: true, item: false, tex: 'carrots_stage3' }));
  reg('potatoes', plant({ model: 'crop', ticks: true, item: false, tex: 'potatoes_stage3' }));
  reg('beetroots', plant({ model: 'crop', ticks: true, item: false, tex: 'beetroots_stage3' }));
  reg('sweet_berry_bush', plant({ ticks: true, item: false, tex: 'sweet_berry_bush_stage3' }));
  reg('nether_wart', plant({ model: 'crop', ticks: true, item: false, tex: 'nether_wart_stage2' }));
  // cocoa: bits 0-2 facing (toward the log), bits 3-4 age
  reg('cocoa', { model: 'cocoa', layer: 1, opacity: 0, solid: true, ticks: true, item: false, tex: 'cocoa_stage2', sound: 'wood' });
  reg('kelp', plant({ fluidLog: true, ticks: true, place: 'water_plant', sound: 'wet_grass' })); reg('kelp_plant', plant({ fluidLog: true, item: false, sound: 'wet_grass' }));
  reg('seagrass', plant({ fluidLog: true, replaceable: true, place: 'water_plant', sound: 'wet_grass' }));
  reg('tall_seagrass', plant({ model: 'tall', fluidLog: true, replaceable: true, item: false, sound: 'wet_grass' }));
  // sea pickle: bits 0-1 count-1, bit 7 waterlogged
  reg('sea_pickle', { model: 'pickle', layer: 1, opacity: 0, light: 6, waterlog: true, sound: 'slime', place: 'pickle' });
  for (const c of ['tube', 'brain', 'bubble', 'fire', 'horn']) {
    reg(c + '_coral_block', { sound: 'coral' }); reg('dead_' + c + '_coral_block', {});
    reg(c + '_coral', plant({ fluidLog: true, sound: 'coral', place: 'water_plant' })); reg(c + '_coral_fan', plant({ fluidLog: true, sound: 'coral', place: 'water_plant' }));
  }
  reg('azalea', { model: 'azalea', layer: 1, opacity: 0, tex: { top: 'azalea_top', side: 'azalea_side' }, sound: 'azalea', place: 'plant' });
  reg('flowering_azalea', { model: 'azalea', layer: 1, opacity: 0, tex: { top: 'flowering_azalea_top', side: 'flowering_azalea_side' }, sound: 'azalea', place: 'plant' });
  reg('azalea_leaves', leaves({})); reg('flowering_azalea_leaves', leaves({}));
  reg('spore_blossom', plant({ place: 'ceiling' }));
  reg('hanging_roots', plant({ place: 'ceiling' }));
  reg('cave_vines', plant({ climb: true, light: 0, item: false, tex: 'cave_vines', ticks: true })); reg('cave_vines_plant', plant({ climb: true, item: false }));
  reg('big_dripleaf', { model: 'dripleaf', layer: 1, opacity: 0, place: 'facing_h', sound: 'big_dripleaf', tex: { top: 'big_dripleaf_top', side: 'big_dripleaf_stem' } });
  reg('small_dripleaf', plant({ model: 'tall', place: 'tall_plant', tex: 'small_dripleaf_top' }));
  reg('cobweb', plant({ solid: false, opacity: 1, sound: 'stone' }));
  reg('chorus_plant', { model: 'chorus', layer: 1, opacity: 0, sound: 'wood', tex: 'chorus_plant' });
  reg('chorus_flower', { model: 'chorus', layer: 1, opacity: 0, sound: 'wood', ticks: true, place: 'chorus_flower' });

  // ------------------------------------------------------------------ building blocks
  reg('bricks'); reg('stone_bricks'); reg('mossy_stone_bricks'); reg('cracked_stone_bricks'); reg('chiseled_stone_bricks');
  reg('infested_stone', { tex: 'stone' }); reg('infested_cobblestone', { tex: 'cobblestone' }); reg('infested_stone_bricks', { tex: 'stone_bricks' });
  reg('glass', { layer: 1, opacity: 0, cullSame: true, sound: 'glass' });
  reg('tinted_glass', { layer: 2, opacity: 15, cullSame: true, sound: 'glass' });
  // panes / bars / walls / fences connect to neighbours when drawn; bit 7 waterlogged
  reg('glass_pane', { model: 'pane', layer: 1, tex: { side: 'glass', top: 'glass_pane_top' }, sound: 'glass', waterlog: true });
  reg('iron_bars', { model: 'pane', layer: 1, tex: { side: 'iron_bars', top: 'iron_bars' }, sound: 'metal', waterlog: true });
  reg('chain', { model: 'chain', layer: 1, place: 'axis', sound: 'chain', waterlog: true });
  for (const c of COLORS) {
    reg(c + '_wool', { sound: 'wool', flam: [30, 60] });
    reg(c + '_carpet', { model: 'carpet', tex: c + '_wool', sound: 'wool', flam: [60, 20] });
    reg(c + '_terracotta');
    reg(c + '_glazed_terracotta', { place: 'facing_h', model: 'glazed' });
    reg(c + '_concrete');
    reg(c + '_concrete_powder', { gravity: true, sound: 'sand' });
    reg(c + '_stained_glass', { layer: 2, opacity: 0, cullSame: true, sound: 'glass' });
    reg(c + '_stained_glass_pane', { model: 'pane', layer: 2, tex: { side: c + '_stained_glass', top: c + '_stained_glass_pane_top' }, sound: 'glass', waterlog: true });
    // bed: bits 0-2 facing (toward the head), bit 3 head part, bit 4 occupied
    reg(c + '_bed', { model: 'bed', layer: 0, opacity: 0, place: 'bed', sound: 'wood', tex: c + '_wool' });
    reg(c + '_shulker_box', { model: 'cube', place: 'facing6', tex: { side: c + '_shulker_box_side', top: c + '_shulker_box_top', bottom: c + '_shulker_box_bottom' }, sound: 'stone' });
    reg(c + '_banner', { model: 'banner', layer: 0, solid: false, opacity: 0, place: 'banner', sound: 'wood', tex: c + '_wool' });
  }
  reg('shulker_box', { place: 'facing6', tex: { side: 'shulker_box_side', top: 'shulker_box_top', bottom: 'shulker_box_bottom' } });
  reg('terracotta');
  reg('bookshelf', { tex: { side: 'bookshelf', end: 'oak_planks' }, sound: 'wood', flam: [30, 20] });
  reg('chiseled_bookshelf', { tex: { front: 'chiseled_bookshelf_empty', side: 'chiseled_bookshelf_side', end: 'chiseled_bookshelf_top' }, place: 'facing_h', sound: 'wood' });
  reg('quartz_block', { tex: { side: 'quartz_block_side', top: 'quartz_block_top', bottom: 'quartz_block_bottom' } });
  reg('chiseled_quartz_block', { tex: { side: 'chiseled_quartz_block', end: 'chiseled_quartz_block_top' } });
  reg('quartz_pillar', { tex: { side: 'quartz_pillar', end: 'quartz_pillar_top' }, place: 'axis' });
  reg('quartz_bricks'); reg('smooth_quartz', { tex: 'quartz_block_bottom' });
  reg('prismarine'); reg('prismarine_bricks'); reg('dark_prismarine'); reg('sea_lantern', { light: 15, sound: 'glass' });
  reg('hay_block', { tex: { side: 'hay_block_side', end: 'hay_block_top' }, place: 'axis', sound: 'grass', flam: [60, 20] });
  reg('sponge', { sound: 'sponge' }); reg('wet_sponge', { sound: 'sponge' });
  reg('slime_block', { layer: 2, opacity: 1, sound: 'slime', bounce: true, slip: 0.8, cullSame: true });
  reg('honey_block', { model: 'honey', layer: 2, opacity: 1, sound: 'honey', speed: 0.4, jump: 0.5, cullSame: true, tex: { side: 'honey_block_side', top: 'honey_block_top', bottom: 'honey_block_bottom' } });
  reg('honeycomb_block', { sound: 'coral' });
  // bee nest / beehive: bits 0-2 facing, bits 3-5 honey level
  reg('bee_nest', { tex: { front: 'bee_nest_front', side: 'bee_nest_side', top: 'bee_nest_top', bottom: 'bee_nest_bottom' }, place: 'facing_h_opp', sound: 'wood' });
  reg('beehive', { tex: { front: 'beehive_front', side: 'beehive_side', end: 'beehive_end' }, place: 'facing_h_opp', sound: 'wood' });
  reg('mangrove_roots', { layer: 1, opacity: 0, tex: { side: 'mangrove_roots_side', end: 'mangrove_roots_top' }, sound: 'mangrove_roots', waterlog: true });
  reg('muddy_mangrove_roots', { tex: { side: 'muddy_mangrove_roots_side', end: 'muddy_mangrove_roots_top' }, place: 'axis', sound: 'mud' });
  reg('bone_block', { tex: { side: 'bone_block_side', end: 'bone_block_top' }, place: 'axis', sound: 'bone' });
  reg('dried_kelp_block', { tex: { side: 'dried_kelp_side', top: 'dried_kelp_top', bottom: 'dried_kelp_bottom' }, sound: 'grass' });

  // ------------------------------------------------------------------ the Nether and the End
  reg('netherrack', { sound: 'netherrack' });
  reg('soul_sand', { speed: 0.4, sound: 'soul_sand' }); reg('soul_soil', { sound: 'soul_soil' });
  reg('glowstone', { light: 15, sound: 'glass' });
  reg('basalt', { tex: { side: 'basalt_side', end: 'basalt_top' }, place: 'axis', sound: 'basalt' });
  reg('polished_basalt', { tex: { side: 'polished_basalt_side', end: 'polished_basalt_top' }, place: 'axis', sound: 'basalt' });
  reg('smooth_basalt', { sound: 'basalt' });
  reg('blackstone', { tex: { side: 'blackstone', end: 'blackstone_top' } });
  for (const n of ['polished_blackstone', 'polished_blackstone_bricks', 'cracked_polished_blackstone_bricks', 'chiseled_polished_blackstone', 'gilded_blackstone']) reg(n);
  reg('nether_bricks', { sound: 'nether_bricks' }); reg('cracked_nether_bricks', { sound: 'nether_bricks' }); reg('chiseled_nether_bricks', { sound: 'nether_bricks' }); reg('red_nether_bricks', { sound: 'nether_bricks' });
  reg('respawn_anchor', { tex: { side: 'respawn_anchor_side0', top: 'respawn_anchor_top_off', bottom: 'respawn_anchor_bottom' } });
  reg('lodestone', { tex: { side: 'lodestone_side', top: 'lodestone_top' }, sound: 'lodestone' });
  reg('end_stone'); reg('end_stone_bricks');
  reg('purpur_block'); reg('purpur_pillar', { tex: { side: 'purpur_pillar', end: 'purpur_pillar_top' }, place: 'axis' });
  reg('end_rod', { model: 'rod', layer: 1, light: 14, place: 'facing6', sound: 'wood' });
  reg('dragon_egg', { model: 'egg', layer: 0, opacity: 0, light: 1, gravity: true });
  // end portal frame: bits 0-2 facing, bit 3 has eye
  reg('end_portal_frame', { model: 'frame', tex: { top: 'end_portal_frame_top', side: 'end_portal_frame_side', bottom: 'end_stone' }, light: 1, place: 'facing_h_opp', opacity: 0 });
  reg('end_portal', { model: 'end_portal', solid: false, light: 15, item: false, layer: 0, opacity: 0 });
  reg('end_gateway', { model: 'end_portal', solid: false, light: 15, item: false, layer: 0, opacity: 0 });
  // nether portal: bit 0 axis (0 x, 1 z)
  reg('nether_portal', { model: 'portal', layer: 2, solid: false, light: 11, item: false, sound: 'glass' });
  reg('fire', { model: 'fire', layer: 1, solid: false, light: 15, item: false, replaceable: true, ticks: true, tex: 'fire_0' });
  reg('soul_fire', { model: 'fire', layer: 1, solid: false, light: 10, item: false, replaceable: true, tex: 'soul_fire_0' });

  // ------------------------------------------------------------------ workstations and storage
  reg('crafting_table', { tex: { top: 'crafting_table_top', bottom: 'oak_planks', front: 'crafting_table_front', side: 'crafting_table_side', west: 'crafting_table_front', north: 'crafting_table_side', south: 'crafting_table_front', east: 'crafting_table_side' }, sound: 'wood', flam: [5, 20] });
  // furnaces: bits 0-2 facing, bit 3 lit
  for (const f of ['furnace', 'blast_furnace', 'smoker']) reg(f, { tex: { front: f + '_front', side: f + '_side', top: f + '_top', bottom: f === 'smoker' ? 'smoker_bottom' : f + '_top' }, place: 'facing_h_opp' });
  // chests: bits 0-2 facing, bits 3-4 type (0 single, 1 left, 2 right)
  reg('chest', { model: 'chest', layer: 0, opacity: 0, place: 'chest', sound: 'wood', tex: 'chest' });
  reg('trapped_chest', { model: 'chest', layer: 0, opacity: 0, place: 'chest', sound: 'wood', tex: 'trapped_chest' });
  reg('ender_chest', { model: 'chest', layer: 0, opacity: 0, place: 'facing_h_opp', light: 7, tex: 'ender_chest' });
  reg('barrel', { tex: { top: 'barrel_top', side: 'barrel_side', bottom: 'barrel_bottom', front: 'barrel_top' }, place: 'facing6_opp', sound: 'wood' });
  for (const a of ['anvil', 'chipped_anvil', 'damaged_anvil']) reg(a, { model: 'anvil', opacity: 0, place: 'facing_h_rot', gravity: true, sound: 'anvil', tex: { top: a + '_top', side: 'anvil' } });
  reg('grindstone', { model: 'grindstone', opacity: 0, place: 'facing_h_rot', tex: { side: 'grindstone_side', top: 'grindstone_round', front: 'grindstone_pivot' } });
  reg('enchanting_table', { model: 'ench', opacity: 0, light: 7, tex: { top: 'enchanting_table_top', side: 'enchanting_table_side', bottom: 'enchanting_table_bottom' } });
  reg('brewing_stand', { model: 'brewing', layer: 1, opacity: 0, light: 1, tex: { top: 'brewing_stand', side: 'brewing_stand_base' }, sound: 'metal' });
  // cauldron: bits 0-1 level (water), bits 2-3 content (0 empty/water, 1 lava, 2 powder snow)
  reg('cauldron', { model: 'cauldron', opacity: 0, tex: { top: 'cauldron_top', side: 'cauldron_side', bottom: 'cauldron_bottom', extra: 'cauldron_inner' }, sound: 'metal' });
  reg('composter', { model: 'composter', opacity: 0, tex: { top: 'composter_top', side: 'composter_side', bottom: 'composter_bottom' }, sound: 'wood' });
  reg('stonecutter', { model: 'stonecutter', opacity: 0, layer: 1, place: 'facing_h_opp', tex: { top: 'stonecutter_top', side: 'stonecutter_side', bottom: 'stonecutter_bottom', front: 'stonecutter_saw' } });
  reg('loom', { tex: { top: 'loom_top', side: 'loom_side', bottom: 'loom_bottom', front: 'loom_front' }, place: 'facing_h_opp', sound: 'wood' });
  reg('smithing_table', { tex: { top: 'smithing_table_top', side: 'smithing_table_side', bottom: 'smithing_table_bottom', front: 'smithing_table_front', south: 'smithing_table_front' }, sound: 'wood' });
  reg('fletching_table', { tex: { top: 'fletching_table_top', side: 'fletching_table_side', bottom: 'birch_planks', front: 'fletching_table_front', south: 'fletching_table_front' }, sound: 'wood' });
  reg('cartography_table', { tex: { top: 'cartography_table_top', side: 'cartography_table_side1', bottom: 'dark_oak_planks', north: 'cartography_table_side3', south: 'cartography_table_side2' }, sound: 'wood' });
  reg('lectern', { model: 'lectern', opacity: 0, place: 'facing_h_opp', tex: { top: 'lectern_top', side: 'lectern_sides', front: 'lectern_front', bottom: 'oak_planks' }, sound: 'wood' });
  reg('bell', { model: 'bell', layer: 0, opacity: 0, place: 'facing_h', tex: { all: 'bell_body', side: 'dark_oak_planks' }, sound: 'metal' });
  reg('jukebox', { tex: { side: 'jukebox_side', top: 'jukebox_top', bottom: 'jukebox_side' }, sound: 'wood' });
  reg('note_block', { sound: 'wood' });
  reg('beacon', { model: 'beacon', layer: 2, light: 15, opacity: 1, sound: 'glass', tex: { side: 'beacon', extra: 'obsidian' } });
  reg('conduit', { model: 'conduit', layer: 1, light: 15, opacity: 0, waterlog: true });
  reg('spawner', { layer: 1, opacity: 1, sound: 'metal' });
  reg('trial_spawner', { layer: 1, opacity: 1, tex: { side: 'trial_spawner_side_inactive', top: 'trial_spawner_top_inactive', bottom: 'trial_spawner_bottom' }, sound: 'metal' });
  reg('flower_pot', { model: 'pot', layer: 1, opacity: 0, place: 'plant', sound: 'stone' });
  reg('scaffolding', { model: 'scaffolding', layer: 1, opacity: 0, climb: true, sound: 'scaffolding', place: 'scaffolding', tex: { top: 'scaffolding_top', side: 'scaffolding_side', bottom: 'scaffolding_bottom' } });
  reg('ladder', { model: 'ladder', layer: 1, solid: true, climb: true, place: 'wall', waterlog: true, sound: 'ladder' });
  // torches: wall versions keep bits 0-2 facing (away from the wall)
  reg('torch', { model: 'torch', layer: 1, solid: false, light: 14, place: 'torch', sound: 'wood' }); reg('wall_torch', { model: 'wall_torch', layer: 1, solid: false, light: 14, item: false, tex: 'torch', sound: 'wood' });
  reg('soul_torch', { model: 'torch', layer: 1, solid: false, light: 10, place: 'torch', sound: 'wood' }); reg('soul_wall_torch', { model: 'wall_torch', layer: 1, solid: false, light: 10, item: false, tex: 'soul_torch', sound: 'wood' });
  reg('redstone_torch', { model: 'torch', layer: 1, solid: false, light: 7, place: 'torch', sound: 'wood', tex: 'redstone_torch' });
  reg('redstone_wall_torch', { model: 'wall_torch', layer: 1, solid: false, light: 7, item: false, tex: 'redstone_torch', sound: 'wood' });
  // lanterns: bit 3 hanging
  reg('lantern', { model: 'lantern', layer: 1, light: 15, place: 'lantern', sound: 'lantern', waterlog: true });
  reg('soul_lantern', { model: 'lantern', layer: 1, light: 10, place: 'lantern', sound: 'lantern', waterlog: true });
  // campfires: bits 0-2 facing, bit 3 unlit
  reg('campfire', { model: 'campfire', layer: 1, light: 15, place: 'facing_h', sound: 'wood', tex: { side: 'campfire_log', top: 'campfire_log_lit', extra: 'campfire_fire' } });
  reg('soul_campfire', { model: 'campfire', layer: 1, light: 10, place: 'facing_h', sound: 'wood', tex: { side: 'campfire_log', top: 'soul_campfire_log_lit', extra: 'soul_campfire_fire' } });
  reg('cake', { model: 'cake', opacity: 0, tex: { top: 'cake_top', side: 'cake_side', bottom: 'cake_bottom', extra: 'cake_inner' }, sound: 'wool', place: 'plant' });
  for (const s of ['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'creeper_head', 'player_head', 'piglin_head', 'dragon_head'])
    reg(s, { model: 'skull', layer: 0, opacity: 0, place: 'skull', sound: 'stone', tex: s });
  // signs: standing bits 0-3 rotation, wall signs bits 0-2 facing
  for (const w of WOODS.concat(STEMS, ['bamboo'])) {
    reg(w + '_sign', { model: 'sign', solid: false, place: 'sign', sound: 'wood', tex: w + '_planks' });
    reg(w + '_wall_sign', { model: 'wall_sign', solid: false, item: false, sound: 'wood', tex: w + '_planks' });
  }

  // ------------------------------------------------------------------ redstone
  // wire: bits 0-3 power
  reg('redstone_wire', { model: 'wire', layer: 1, solid: false, item: false, tex: 'redstone_dust_dot', tint: 'redstone', place: 'floor', sound: 'stone' });
  // repeater: bits 0-2 facing, bits 3-4 delay-1, bit 5 powered, bit 6 locked
  reg('repeater', { model: 'repeater', opacity: 0, place: 'facing_h_opp', sound: 'stone', tex: { top: 'repeater', side: 'smooth_stone' } });
  // comparator: bits 0-2 facing, bit 3 subtract, bit 4 powered
  reg('comparator', { model: 'comparator', opacity: 0, place: 'facing_h_opp', sound: 'stone', tex: { top: 'comparator', side: 'smooth_stone' } });
  // lever and buttons: bits 0-2 facing, bits 3-4 face (0 floor, 1 wall, 2 ceiling), bit 5 powered
  reg('lever', { model: 'lever', layer: 1, solid: false, place: 'switch', sound: 'wood', tex: { side: 'cobblestone', top: 'lever' } });
  reg('stone_button', { model: 'button', solid: false, place: 'switch', tex: 'stone' });
  reg('polished_blackstone_button', { model: 'button', solid: false, place: 'switch', tex: 'polished_blackstone' });
  // pressure plates: bits 0-3 power
  reg('stone_pressure_plate', { model: 'plate', solid: false, place: 'floor', tex: 'stone' });
  reg('polished_blackstone_pressure_plate', { model: 'plate', solid: false, place: 'floor', tex: 'polished_blackstone' });
  reg('light_weighted_pressure_plate', { model: 'plate', solid: false, place: 'floor', tex: 'gold_block', sound: 'metal' });
  reg('heavy_weighted_pressure_plate', { model: 'plate', solid: false, place: 'floor', tex: 'iron_block', sound: 'metal' });
  // redstone lamp / redstone ore: bit 0 lit
  reg('redstone_lamp', { sound: 'glass' });
  // pistons: bits 0-2 facing, bit 3 extended; head: bits 0-2 facing, bit 3 sticky, bit 4 short
  reg('piston', { model: 'piston', opacity: 0, place: 'facing6_opp', tex: { top: 'piston_top', side: 'piston_side', bottom: 'piston_bottom', extra: 'piston_inner' } });
  reg('sticky_piston', { model: 'piston', opacity: 0, place: 'facing6_opp', tex: { top: 'piston_top_sticky', side: 'piston_side', bottom: 'piston_bottom', extra: 'piston_inner' } });
  reg('piston_head', { model: 'piston_head', opacity: 0, item: false, tex: { top: 'piston_top', side: 'piston_side', extra: 'piston_top_sticky' } });
  reg('moving_piston', { model: 'none', solid: false, item: false });
  // observer: bits 0-2 facing (the face that watches), bit 3 powered
  reg('observer', { tex: { front: 'observer_front', side: 'observer_side', top: 'observer_top', extra: 'observer_back' }, place: 'facing6' });
  // hopper: bits 0-2 facing (output), bit 3 disabled
  reg('hopper', { model: 'hopper', opacity: 0, place: 'hopper', sound: 'metal', tex: { top: 'hopper_top', side: 'hopper_outside', extra: 'hopper_inside' } });
  // dispenser / dropper: bits 0-2 facing, bit 3 triggered
  reg('dispenser', { tex: { front: 'dispenser_front', side: 'furnace_side', top: 'furnace_top', extra: 'dispenser_front_vertical' }, place: 'facing6_opp' });
  reg('dropper', { tex: { front: 'dropper_front', side: 'furnace_side', top: 'furnace_top', extra: 'dropper_front_vertical' }, place: 'facing6_opp' });
  reg('tnt', { tex: { side: 'tnt_side', top: 'tnt_top', bottom: 'tnt_bottom' }, sound: 'grass', flam: [15, 100] });
  // daylight detector: bits 0-3 power, bit 4 inverted
  reg('daylight_detector', { model: 'daylight', opacity: 0, sound: 'wood', tex: { top: 'daylight_detector_top', side: 'daylight_detector_side' } });
  reg('target', { tex: { side: 'target_side', top: 'target_top' }, sound: 'grass' });
  reg('tripwire_hook', { model: 'tripwire_hook', layer: 1, solid: false, place: 'wall', sound: 'wood' });
  reg('tripwire', { model: 'tripwire', layer: 1, solid: false, item: false });
  reg('lightning_rod', { model: 'rod', layer: 1, place: 'facing6', sound: 'metal', tex: 'lightning_rod' });
  // rails: bits 0-3 shape, bit 4 powered
  for (const r of ['rail', 'powered_rail', 'detector_rail', 'activator_rail']) reg(r, { model: 'rail', layer: 1, solid: false, place: 'rail', sound: 'metal' });
  reg('iron_door', { model: 'door', layer: 1, opacity: 0, place: 'door', sound: 'metal', tex: { top: 'iron_door_top', bottom: 'iron_door_bottom' } });
  reg('iron_trapdoor', { model: 'trapdoor', layer: 1, opacity: 0, place: 'trapdoor', sound: 'metal', waterlog: true });

  // ------------------------------------------------------------------ wooden fittings
  for (const w of WOODS.concat(STEMS, ['bamboo'])) {
    const planks = w + '_planks', snd = STEMS.includes(w) ? 'nether_wood' : w === 'bamboo' ? 'bamboo_wood' : 'wood', flam = STEMS.includes(w) ? null : [5, 20];
    reg(w + '_fence', { model: 'fence', tex: planks, sound: snd, flam, waterlog: true });
    reg(w + '_fence_gate', { model: 'gate', tex: planks, place: 'gate', sound: snd, flam });
    // doors: bits 0-2 facing, bit 3 upper half, bit 4 open, bit 5 hinge right, bit 6 powered
    reg(w + '_door', { model: 'door', layer: 1, opacity: 0, place: 'door', sound: snd, tex: { top: w + '_door_top', bottom: w + '_door_bottom' } });
    // trapdoors: bits 0-2 facing, bit 3 top half, bit 4 open, bit 6 powered
    reg(w + '_trapdoor', { model: 'trapdoor', layer: 1, opacity: 0, place: 'trapdoor', sound: snd, waterlog: true });
    reg(w + '_pressure_plate', { model: 'plate', solid: false, place: 'floor', tex: planks, sound: snd });
    reg(w + '_button', { model: 'button', solid: false, place: 'switch', tex: planks, sound: snd });
  }

  // ------------------------------------------------------------------ stairs, slabs and walls
  // slab: bits 3-4 type (0 bottom, 1 top, 2 double), bit 7 waterlogged; stairs: bits 0-2 facing, bit 3 upside down, bit 7 waterlogged
  const SHAPED = [
    // [prefix, texture source block, has stairs, has slab, has wall, sound]
    ['oak', 'oak_planks', 1, 1, 0, 'wood'], ['spruce', 'spruce_planks', 1, 1, 0, 'wood'], ['birch', 'birch_planks', 1, 1, 0, 'wood'], ['jungle', 'jungle_planks', 1, 1, 0, 'wood'],
    ['acacia', 'acacia_planks', 1, 1, 0, 'wood'], ['dark_oak', 'dark_oak_planks', 1, 1, 0, 'wood'], ['mangrove', 'mangrove_planks', 1, 1, 0, 'wood'], ['cherry', 'cherry_planks', 1, 1, 0, 'wood'],
    ['crimson', 'crimson_planks', 1, 1, 0, 'nether_wood'], ['warped', 'warped_planks', 1, 1, 0, 'nether_wood'], ['bamboo', 'bamboo_planks', 1, 1, 0, 'bamboo_wood'],
    ['stone', 'stone', 1, 1, 0], ['smooth_stone', 'smooth_stone', 0, 1, 0], ['cobblestone', 'cobblestone', 1, 1, 1], ['mossy_cobblestone', 'mossy_cobblestone', 1, 1, 1],
    ['stone_brick', 'stone_bricks', 1, 1, 1], ['mossy_stone_brick', 'mossy_stone_bricks', 1, 1, 1], ['granite', 'granite', 1, 1, 1], ['polished_granite', 'polished_granite', 1, 1, 0],
    ['diorite', 'diorite', 1, 1, 1], ['polished_diorite', 'polished_diorite', 1, 1, 0], ['andesite', 'andesite', 1, 1, 1], ['polished_andesite', 'polished_andesite', 1, 1, 0],
    ['cobbled_deepslate', 'cobbled_deepslate', 1, 1, 1], ['polished_deepslate', 'polished_deepslate', 1, 1, 1], ['deepslate_brick', 'deepslate_bricks', 1, 1, 1], ['deepslate_tile', 'deepslate_tiles', 1, 1, 1],
    ['brick', 'bricks', 1, 1, 1], ['mud_brick', 'mud_bricks', 1, 1, 1], ['sandstone', 'sandstone', 1, 1, 1], ['smooth_sandstone', 'smooth_sandstone', 1, 1, 0], ['cut_sandstone', 'cut_sandstone', 0, 1, 0],
    ['red_sandstone', 'red_sandstone', 1, 1, 1], ['smooth_red_sandstone', 'smooth_red_sandstone', 1, 1, 0], ['cut_red_sandstone', 'cut_red_sandstone', 0, 1, 0],
    ['prismarine', 'prismarine', 1, 1, 1], ['prismarine_brick', 'prismarine_bricks', 1, 1, 0], ['dark_prismarine', 'dark_prismarine', 1, 1, 0],
    ['nether_brick', 'nether_bricks', 1, 1, 1, 'nether_bricks'], ['red_nether_brick', 'red_nether_bricks', 1, 1, 1, 'nether_bricks'],
    ['quartz', 'quartz_block', 1, 1, 0], ['smooth_quartz', 'smooth_quartz', 1, 1, 0], ['purpur', 'purpur_block', 1, 1, 0], ['end_stone_brick', 'end_stone_bricks', 1, 1, 1],
    ['blackstone', 'blackstone', 1, 1, 1], ['polished_blackstone', 'polished_blackstone', 1, 1, 1], ['polished_blackstone_brick', 'polished_blackstone_bricks', 1, 1, 1],
    ['tuff', 'tuff', 1, 1, 1], ['cut_copper', 'cut_copper', 1, 1, 0, 'metal'],
  ];
  for (const [p, src, st, sl, wa, snd] of SHAPED) {
    const sb = BLOCKS[BID[src]], tex = { up: sb.tex.up, down: sb.tex.down, side: sb.tex.side };
    const wood = snd === 'wood';
    const base = { tex: { top: tex.up, bottom: tex.down, side: tex.side }, sound: snd || 'stone', src, flam: wood ? [5, 20] : null, waterlog: true };
    if (st) reg(p + '_stairs', Object.assign({ model: 'stairs', place: 'stairs', opacity: 15 }, base));
    if (sl) reg(p + '_slab', Object.assign({ model: 'slab', place: 'slab', opacity: 15 }, base, p === 'smooth_stone' ? { tex: { end: 'smooth_stone', side: 'smooth_stone_slab_side' } } : {}));
    if (wa) reg(p + '_wall', Object.assign({ model: 'wall' }, base));
  }
  reg('nether_brick_fence', { model: 'fence', tex: 'nether_bricks', sound: 'nether_bricks', waterlog: true });

  // ------------------------------------------------------------------ the rest of the game's 1.20/1.21 blocks
  reg('bamboo_mosaic', { sound: 'bamboo_wood', flam: [5, 20] });
  reg('stripped_bamboo_block', { tex: { side: 'stripped_bamboo_block', end: 'stripped_bamboo_block_top' }, place: 'axis', sound: 'bamboo_wood', flam: [5, 5] });
  for (const [p2, src] of [['bamboo_mosaic', 'bamboo_mosaic']]) { const base = { tex: src, sound: 'bamboo_wood', flam: [5, 20], waterlog: true }; reg(p2 + '_stairs', Object.assign({ model: 'stairs', place: 'stairs', opacity: 15 }, base)); reg(p2 + '_slab', Object.assign({ model: 'slab', place: 'slab', opacity: 15 }, base)); }
  reg('petrified_oak_slab', { model: 'slab', place: 'slab', opacity: 15, tex: 'oak_planks', waterlog: true });
  // hanging signs: like signs, made of stripped logs; standing ones hang under a block (bits 0-3 rotation, bit 4 attached)
  for (const w of WOODS.concat(STEMS, ['bamboo'])) {
    const t = w === 'bamboo' ? 'stripped_bamboo_block' : STEMS.includes(w) ? 'stripped_' + w + '_stem' : 'stripped_' + w + '_log';
    const snd = STEMS.includes(w) ? 'nether_wood' : w === 'bamboo' ? 'bamboo_wood' : 'wood';
    reg(w + '_hanging_sign', { model: 'hanging_sign', layer: 1, solid: false, place: 'hanging_sign', sound: snd, tex: t, flam: STEMS.includes(w) ? null : [5, 20] });
    reg(w + '_wall_hanging_sign', { model: 'wall_hanging_sign', layer: 1, solid: false, item: false, sound: snd, tex: t });
  }
  reg('infested_mossy_stone_bricks', { tex: 'mossy_stone_bricks' }); reg('infested_cracked_stone_bricks', { tex: 'cracked_stone_bricks' }); reg('infested_chiseled_stone_bricks', { tex: 'chiseled_stone_bricks' });
  reg('infested_deepslate', { tex: { side: 'deepslate', end: 'deepslate_top' }, place: 'axis', sound: 'deepslate' });
  // blocks only for building worlds (creative operators)
  reg('barrier', { model: 'none', opacity: 0, layer: 1, tex: 'barrier' });
  reg('light', { model: 'none', solid: false, opacity: 0, replaceable: true, light: 15, tex: 'light' });
  reg('structure_void', { model: 'none', solid: false, opacity: 0, replaceable: true, tex: 'structure_void' });
  for (const n of ['command_block', 'repeating_command_block', 'chain_command_block']) reg(n, { tex: { front: n + '_front', side: n + '_side', top: n + '_side', bottom: n + '_back' }, place: 'facing6_opp', sound: 'metal' });
  reg('structure_block', { tex: 'structure_block' }); reg('jigsaw', { tex: { side: 'jigsaw_side', top: 'jigsaw_top', bottom: 'jigsaw_bottom' } });
  // crops and plants of 1.20
  reg('torchflower_crop', plant({ model: 'crop', ticks: true, item: false, tex: 'torchflower_crop_stage1' }));
  reg('pitcher_crop', plant({ model: 'crop', ticks: true, item: false, tex: 'pitcher_crop_top_stage_4' }));
  reg('pitcher_plant', plant({ model: 'tall', place: 'tall_plant', tex: 'pitcher_plant_top' }));
  reg('bamboo_sapling', plant({ item: false, ticks: true, tex: 'bamboo_stage0', place: 'bamboo' }));
  reg('big_dripleaf_stem', plant({ item: false, tex: 'big_dripleaf_stem' }));
  reg('frosted_ice', { layer: 2, opacity: 2, slip: 0.98, ticks: true, item: false, sound: 'glass', tex: 'frosted_ice_0' });
  // eggs: turtle eggs (bits 0-1 count-1, bits 2-3 hatch stage), sniffer eggs (bits 0-1 hatch stage)
  reg('turtle_egg', { model: 'turtle_egg', layer: 1, opacity: 0, sound: 'stone', ticks: true });
  reg('sniffer_egg', { model: 'sniffer_egg', layer: 0, opacity: 0, sound: 'metal', ticks: true, tex: { top: 'sniffer_egg_not_cracked_top', side: 'sniffer_egg_not_cracked_east', bottom: 'sniffer_egg_not_cracked_bottom' } });
  reg('frogspawn', { model: 'lily', layer: 1, solid: false, opacity: 0, item: true, place: 'lily', tex: 'frogspawn', sound: 'slime' });
  // corals that died out of water, and the fans on walls (bits 0-2 facing)
  for (const k of ['tube', 'brain', 'bubble', 'fire', 'horn']) {
    reg('dead_' + k + '_coral', plant({ tex: 'dead_' + k + '_coral', place: 'water_plant_any', sound: 'stone', waterlog: true }));
    reg('dead_' + k + '_coral_fan', plant({ tex: 'dead_' + k + '_coral_fan', place: 'water_plant_any', sound: 'stone', waterlog: true }));
    reg('dead_' + k + '_coral_wall_fan', plant({ model: 'wall_fan', item: false, tex: 'dead_' + k + '_coral_fan', sound: 'stone', waterlog: true }));
    reg(k + '_coral_wall_fan', plant({ model: 'wall_fan', item: false, tex: k + '_coral_fan', sound: 'coral', fluidLog: true }));
  }
  // candles: bits 0-1 candles-1, bit 2 lit, bit 7 waterlogged; candle cakes: bit 2 lit
  for (const c of [''].concat(COLORS)) {
    const n = (c ? c + '_' : '') + 'candle';
    reg(n, { model: 'candle', layer: 1, opacity: 0, solid: true, place: 'candle', sound: 'wool', tex: n, waterlog: true });
    reg(n + '_cake', { model: 'candle_cake', opacity: 0, item: false, tex: { top: 'cake_top', side: 'cake_side', bottom: 'cake_bottom', extra: n }, sound: 'wool' });
  }
  // tuff family (1.21)
  reg('polished_tuff', { sound: 'tuff' }); reg('chiseled_tuff', { sound: 'tuff', tex: { side: 'chiseled_tuff', end: 'chiseled_tuff_top' } });
  reg('tuff_bricks', { sound: 'tuff' }); reg('chiseled_tuff_bricks', { sound: 'tuff', tex: { side: 'chiseled_tuff_bricks', end: 'chiseled_tuff_bricks_top' } });
  for (const [p2, src] of [['polished_tuff', 'polished_tuff'], ['tuff_brick', 'tuff_bricks']]) { const base = { tex: src, sound: 'tuff', waterlog: true }; reg(p2 + '_stairs', Object.assign({ model: 'stairs', place: 'stairs', opacity: 15 }, base)); reg(p2 + '_slab', Object.assign({ model: 'slab', place: 'slab', opacity: 15 }, base)); reg(p2 + '_wall', Object.assign({ model: 'wall' }, base)); }
  // sculk
  reg('sculk', { sound: 'sculk', tex: 'sculk' });
  reg('sculk_vein', plant({ model: 'vine', place: 'vine', replaceable: true, sound: 'sculk', tex: 'sculk_vein', tint: null }));
  reg('sculk_catalyst', { light: 6, sound: 'sculk', tex: { top: 'sculk_catalyst_top', side: 'sculk_catalyst_side', bottom: 'sculk_catalyst_bottom' } });
  reg('sculk_shrieker', { model: 'shrieker', opacity: 0, sound: 'sculk', waterlog: true, tex: { top: 'sculk_shrieker_top', side: 'sculk_shrieker_side', bottom: 'sculk_shrieker_bottom' } });
  reg('sculk_sensor', { model: 'sensor', layer: 1, opacity: 0, light: 1, sound: 'sculk', waterlog: true, tex: { top: 'sculk_sensor_top', side: 'sculk_sensor_side', bottom: 'sculk_sensor_bottom', extra: 'sculk_sensor_tendril_inactive' } });
  reg('calibrated_sculk_sensor', { model: 'sensor', layer: 1, opacity: 0, light: 1, sound: 'sculk', waterlog: true, place: 'facing_h', tex: { top: 'calibrated_sculk_sensor_top', side: 'sculk_sensor_side', bottom: 'sculk_sensor_bottom', extra: 'calibrated_sculk_sensor_amethyst' } });
  // the whole copper family: four stages of oxidation, each with a waxed twin that stops ageing
  const OX = ['', 'exposed_', 'weathered_', 'oxidized_'];
  for (const o of OX) {
    const blockName = o ? o + 'copper' : 'copper_block', cut = o + 'cut_copper';
    if (!BID[cut]) reg(cut, { sound: 'metal', ticks: !!0 || true });
    reg(o + 'chiseled_copper', { sound: 'metal', ticks: true });
    reg(o + 'copper_grate', { layer: 1, opacity: 0, sound: 'metal', waterlog: true, ticks: true });
    reg(o + 'copper_bulb', { sound: 'metal', ticks: true, tex: o + 'copper_bulb' });
    reg(o + 'copper_door', { model: 'door', layer: 1, opacity: 0, place: 'door', sound: 'metal', ticks: true, tex: { top: o + 'copper_door_top', bottom: o + 'copper_door_bottom' } });
    reg(o + 'copper_trapdoor', { model: 'trapdoor', layer: 1, opacity: 0, place: 'trapdoor', sound: 'metal', waterlog: true, ticks: true });
    if (o) { const base = { tex: cut, sound: 'metal', waterlog: true, ticks: true }; reg(o + 'cut_copper_stairs', Object.assign({ model: 'stairs', place: 'stairs', opacity: 15 }, base)); reg(o + 'cut_copper_slab', Object.assign({ model: 'slab', place: 'slab', opacity: 15 }, base)); }
    void blockName;
  }
  for (const o of OX) {
    const src = o ? o + 'copper' : 'copper_block';
    reg('waxed_' + src, { tex: src, sound: 'metal' });
    for (const n of ['cut_copper', 'chiseled_copper', 'copper_grate', 'copper_bulb']) { const d0 = BLOCKS[BID[o + n]]; reg('waxed_' + o + n, Object.assign({}, { tex: { top: d0.tex.up, bottom: d0.tex.down, side: d0.tex.side }, sound: 'metal' }, n === 'copper_grate' ? { layer: 1, opacity: 0, waterlog: true } : {})); }
    reg('waxed_' + o + 'cut_copper_stairs', { model: 'stairs', place: 'stairs', opacity: 15, tex: o + 'cut_copper', sound: 'metal', waterlog: true });
    reg('waxed_' + o + 'cut_copper_slab', { model: 'slab', place: 'slab', opacity: 15, tex: o + 'cut_copper', sound: 'metal', waterlog: true });
    reg('waxed_' + o + 'copper_door', { model: 'door', layer: 1, opacity: 0, place: 'door', sound: 'metal', tex: { top: o + 'copper_door_top', bottom: o + 'copper_door_bottom' } });
    reg('waxed_' + o + 'copper_trapdoor', { model: 'trapdoor', layer: 1, opacity: 0, place: 'trapdoor', sound: 'metal', waterlog: true, tex: o + 'copper_trapdoor' });
  }
  // froglights, the decorated pot, the crafter, the vault and the heavy core
  for (const f of ['ochre', 'verdant', 'pearlescent']) reg(f + '_froglight', { light: 15, place: 'axis', sound: 'froglight', tex: { side: f + '_froglight_side', end: f + '_froglight_top' } });
  reg('decorated_pot', { model: 'decorated_pot', opacity: 0, place: 'facing_h_opp', sound: 'decorated_pot', waterlog: true, tex: 'decorated_pot_side' });
  reg('crafter', { place: 'facing6_opp', sound: 'metal', tex: { front: 'crafter_north', side: 'crafter_east', top: 'crafter_top', bottom: 'crafter_bottom' } });
  reg('vault', { layer: 1, opacity: 1, place: 'facing_h_opp', light: 6, sound: 'metal', tex: { front: 'vault_front_off', side: 'vault_side_off', top: 'vault_top', bottom: 'vault_bottom' } });
  reg('heavy_core', { model: 'heavy_core', opacity: 0, sound: 'metal', waterlog: true, tex: { top: 'heavy_core_top', side: 'heavy_core_side', bottom: 'heavy_core_bottom' } });
  reg('bubble_column', { model: 'liquid', layer: 2, solid: false, opacity: 1, fluid: 'water', replaceable: true, tint: 'water', tex: { all: 'water_still', side: 'water_flow' }, item: false, cullSame: true, ticks: true });

  // copper that is not waxed ages over time (random ticks); frosted ice shows how far it has melted
  for (const d of BLOCKS) if (/(^|_)copper(_|$)/.test(d.name) && !d.name.startsWith('waxed_') && !/raw_|_ore|lightning_rod|copper_ingot/.test(d.name) && !d.name.startsWith('oxidized_')) d.ticks = true;
  BLOCKS[BID.frosted_ice].stateTex = s => 'frosted_ice_' + (s & 3);
  BLOCKS[BID.vault].ticks = false;

  // ------------------------------------------------------------------ light that depends on the block state
  // (LIGHT holds the most a block can give; lightFn gives the value for a state)
  const lit = (n, fn) => { const d = BLOCKS[BID[n]]; d.lightFn = fn; for (let st = 0; st < 256; st++) d.light = Math.max(d.light, fn(st)); };
  for (const c of [''].concat(COLORS)) { const n = (c ? c + '_' : '') + 'candle'; BLOCKS[BID[n]].light = 12; lit(n, s => (s & 4) ? 3 * ((s & 3) + 1) : 0); lit(n + '_cake', s => (s & 4) ? 3 : 0); }
  OX.forEach((o, i) => {
    const level = [15, 12, 8, 4][i];
    for (const n of [o + 'copper_bulb', 'waxed_' + o + 'copper_bulb']) {
      const d = BLOCKS[BID[n]], base = o + 'copper_bulb';
      d.stateTex = s => base + (s & 1 ? '_lit' : '') + (s & 2 ? '_powered' : '');
      lit(n, s => (s & 1) ? level : 0);
    }
  });
  for (const f of ['furnace', 'blast_furnace', 'smoker']) lit(f, s => (s & 8) ? 13 : 0);
  lit('redstone_lamp', s => (s & 1) ? 15 : 0);
  lit('sea_pickle', s => (s & 128) ? 3 * ((s & 3) + 2) : 0);
  lit('light', s => 15 - (s & 15));
  lit('campfire', s => (s & 8) ? 0 : 15); lit('soul_campfire', s => (s & 8) ? 0 : 10);
  lit('redstone_ore', s => (s & 1) ? 9 : 0); lit('deepslate_redstone_ore', s => (s & 1) ? 9 : 0);
  lit('cave_vines', s => (s & 8) ? 14 : 0); lit('cave_vines_plant', s => (s & 8) ? 14 : 0);
  lit('respawn_anchor', s => [0, 3, 7, 11, 15][Math.min(4, s & 7)]);
  lit('redstone_torch', s => (s & 8) ? 0 : 7); lit('redstone_wall_torch', s => (s & 8) ? 0 : 7);

  // ------------------------------------------------------------------ derived tables
  const N = BLOCKS.length;
  const T = (f) => { const a = new Uint8Array(N); for (const d of BLOCKS) a[d.id] = f(d) ? 1 : 0; return a; };
  const OPAQUE = T(d => d.opaque), SOLID = T(d => d.solid), REPLACEABLE = T(d => d.replaceable), FLUID = new Uint8Array(N), LIGHT = new Uint8Array(N), OPACITY = new Uint8Array(N);
  for (const d of BLOCKS) { FLUID[d.id] = d.fluid === 'water' ? 1 : d.fluid === 'lava' ? 2 : 0; LIGHT[d.id] = d.light; OPACITY[d.id] = d.opacity; }
  const isAir = id => id === 0 || id === BID.cave_air || id === BID.void_air;
  Object.assign(G, { BLOCKS, BID, COLORS, WOODS, STEMS, DIR, DX, DY, DZ, OPP, FACE_NAMES, OPAQUE, SOLID, REPLACEABLE, FLUID, LIGHT, OPACITY, isAir, NBLOCKS: N });
});
