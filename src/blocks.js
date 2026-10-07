'use strict';
/* Block registry. render: cube | cutout | cross | liquid | flat | ladder | box */
const BLK = [];
const B = {};
function regBlock(key, o) {
  const id = BLK.length;
  B[key] = id;
  const d = Object.assign({
    id, key, name: key.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    render: 'cube', solid: true, opaque: true, light: 0, hardness: 1, tool: null, drop: id, tex: 'stone',
    anim: 0, emissive: false, climb: false, hurt: 0, box: null, cutLike: false,
  }, o);
  if (d.render !== 'cube') d.opaque = false;
  if (['cross', 'liquid', 'flat', 'ladder'].includes(d.render) && o.solid === undefined) d.solid = false;
  if (typeof d.tex === 'string') d.tex = { top: d.tex, bottom: d.tex, side: d.tex, front: d.tex };
  else { d.tex.side = d.tex.side || d.tex.top; d.tex.bottom = d.tex.bottom || d.tex.top; d.tex.front = d.tex.front || d.tex.side; d.tex.top = d.tex.top || d.tex.side; }
  BLK.push(d);
  return id;
}
regBlock('AIR', { render: 'none', solid: false, opaque: false, drop: 0 });
regBlock('GRASS', { tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 'DIRT' });
regBlock('DIRT', { tex: 'dirt', hardness: 0.5, tool: 'shovel' });
regBlock('STONE', { tex: 'stone', hardness: 1.5, tool: 'pick', drop: 'COBBLE' });
regBlock('COBBLE', { tex: 'cobble', hardness: 2, tool: 'pick' });
regBlock('MOSSYCOBBLE', { tex: 'mossycobble', hardness: 2, tool: 'pick' });
regBlock('SAND', { tex: 'sand', hardness: 0.5, tool: 'shovel' });
regBlock('SANDSTONE', { tex: { top: 'sandstone_top', side: 'sandstone' }, hardness: 0.8, tool: 'pick' });
regBlock('SANDBRICK', { tex: 'sandbrick', hardness: 1.2, tool: 'pick' });
regBlock('TERRACOTTA', { tex: 'terracotta', hardness: 1.2, tool: 'pick' });
regBlock('GRAVEL', { tex: 'gravel', hardness: 0.6, tool: 'shovel' });
regBlock('SNOW', { tex: { top: 'snow', side: 'snow_side', bottom: 'stone' }, hardness: 0.4, tool: 'shovel' });
regBlock('BEDROCK', { tex: 'bedrock', hardness: -1 });
regBlock('WATER', { render: 'liquid', tex: 'water', hardness: -1, anim: 2, drop: 0 });
regBlock('LAVA', { render: 'liquid', tex: 'lava', hardness: -1, anim: 1, light: 15, emissive: true, hurt: 4, drop: 0 });
regBlock('LOG', { tex: { top: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', name: 'Oak Log', desc: 'Light wood from ordinary trees. Crafts into Oak Planks.' });
regBlock('DARKLOG', { tex: { top: 'log_dark_top', side: 'log_dark_side' }, hardness: 2, tool: 'axe', name: 'Gnarled Log', desc: 'Dark wood from the big gnarled trees of the Ancient Forest. Crafts into Gnarled Planks.' });
regBlock('LEAVES', { render: 'cutout', tex: 'leaves', hardness: 0.2, anim: 3, drop: 0, cutLike: true });
regBlock('LEAVES_DARK', { render: 'cutout', tex: 'leaves_dark', hardness: 0.2, anim: 3, drop: 0, cutLike: true });
regBlock('LEAVES_BLOSSOM', { render: 'cutout', tex: 'leaves_blossom', hardness: 0.2, anim: 3, drop: 0, cutLike: true });
regBlock('PLANKS', { tex: 'planks', hardness: 2, tool: 'axe', name: 'Oak Planks', desc: 'Light planks. Work in every recipe, exactly like Gnarled Planks.' });
regBlock('PLANKS_DARK', { tex: 'planks_dark', hardness: 2, tool: 'axe', name: 'Gnarled Planks', desc: 'Dark planks. Work in every recipe, exactly like Oak Planks.' });
regBlock('STONEBRICK', { tex: 'stonebrick', hardness: 2, tool: 'pick', name: 'Stone Bricks' });
regBlock('MOSSYBRICK', { tex: 'mossybrick', hardness: 2, tool: 'pick', name: 'Mossy Bricks' });
regBlock('CRACKEDBRICK', { tex: 'crackedbrick', hardness: 0.8, tool: 'pick', name: 'Cracked Stone Bricks' });
regBlock('DARKBRICK', { tex: 'darkbrick', hardness: 3, tool: 'pick', name: 'Ashen Bricks' });
regBlock('DARKBRICK_CRACKED', { tex: 'darkbrick_cracked', hardness: 3, tool: 'pick', light: 4, name: 'Smoldering Bricks' });
regBlock('REDBRICK', { tex: 'redbrick', hardness: 2, tool: 'pick', name: 'Bricks' });
regBlock('POLISHED', { tex: 'polished', hardness: 2, tool: 'pick', name: 'Polished Stone' });
regBlock('BASALT', { tex: 'basalt', hardness: 2, tool: 'pick' });
regBlock('ASH', { tex: 'ash', hardness: 0.6, tool: 'shovel', name: 'Ash Soil' });
regBlock('MUD', { tex: 'mud', hardness: 0.5, tool: 'shovel' });
regBlock('SWAMPGRASS', { tex: { top: 'swamp_grass', side: 'swamp_grass_side', bottom: 'mud' }, hardness: 0.6, tool: 'shovel', drop: 'MUD', name: 'Marsh Grass' });
regBlock('THATCH', { tex: 'thatch', hardness: 0.5 });
regBlock('ROOF_RED', { tex: 'roof_red', hardness: 1.2, tool: 'pick', name: 'Red Roof Tiles' });
regBlock('ROOF_BLUE', { tex: 'roof_blue', hardness: 1.2, tool: 'pick', name: 'Blue Roof Tiles' });
regBlock('PLASTER', { tex: 'plaster', hardness: 1 });
regBlock('TIMBER', { tex: 'timber', hardness: 1.2, tool: 'axe', name: 'Timber Frame' });
regBlock('GLASS', { render: 'cutout', tex: 'glass', hardness: 0.3, drop: 0 });
regBlock('WOOL_RED', { tex: 'wool_red', hardness: 0.6, name: 'Red Canvas' });
regBlock('WOOL_WHITE', { tex: 'wool_white', hardness: 0.6, name: 'White Canvas' });
regBlock('WOOL_BLUE', { tex: 'wool_blue', hardness: 0.6, name: 'Blue Canvas' });
regBlock('WOOL_GREEN', { tex: 'wool_green', hardness: 0.6, name: 'Green Canvas' });
regBlock('WOOL_YELLOW', { tex: 'wool_yellow', hardness: 0.6, name: 'Yellow Canvas' });
regBlock('WOOL_PURPLE', { tex: 'wool_purple', hardness: 0.6, name: 'Purple Canvas' });
regBlock('HAY', { tex: { top: 'hay_top', side: 'hay_side' }, hardness: 0.5, name: 'Hay Bale' });
regBlock('BOOKSHELF', { tex: { top: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe' });
regBlock('CHEST', { render: 'box', box: [0.06, 0, 0.06, 0.94, 0.875, 0.94], tex: { top: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', drop: 'PLANKS' });
regBlock('BARREL', { tex: { top: 'barrel_top', side: 'barrel_side' }, hardness: 2, tool: 'axe' });
regBlock('CRATE', { tex: 'crate', hardness: 1.5, tool: 'axe', name: 'Supply Crate' });
regBlock('FURNACE', { tex: { top: 'furnace_side', side: 'furnace_side', front: 'furnace_front' }, hardness: 3, tool: 'pick', light: 12 });
regBlock('TABLE', { tex: { top: 'table_top', side: 'table_side', bottom: 'planks' }, hardness: 2, tool: 'axe', name: 'Crafting Table' });
regBlock('LAMP', { tex: 'lamp', hardness: 1, light: 15, emissive: true, name: 'Rune Lantern' });
regBlock('TORCH', { render: 'cross', tex: 'torch', hardness: 0.05, light: 14, emissive: true });
regBlock('FIRE', { render: 'cross', tex: 'fire', hardness: 0.05, light: 15, emissive: true, hurt: 2, anim: 3, drop: 0, name: 'Campfire' });
regBlock('TABLET', { tex: { top: 'tablet_side', side: 'tablet', bottom: 'tablet_side' }, hardness: -1, name: 'Lore Tablet' });
regBlock('WAYSTONE', { tex: { top: 'waystone_top', side: 'waystone', bottom: 'waystone_top' }, hardness: -1, light: 11, emissive: true });
regBlock('SPAWNER', { render: 'cutout', tex: 'spawner', hardness: 5, tool: 'pick', light: 6, drop: 0, name: 'Shadow Cage' });
regBlock('ALTAR', { tex: 'altar', hardness: -1, name: 'Seal of the Deep' });
regBlock('IRON_BLOCK', { tex: 'iron_block', hardness: 4, tool: 'pick' });
regBlock('GOLD_BLOCK', { tex: 'gold_block', hardness: 4, tool: 'pick' });
regBlock('ANCIENT_GOLD', { tex: 'ancient_gold', hardness: 4, tool: 'pick', light: 6, name: 'Ancient Gold Block' });
regBlock('CRYSTAL', { tex: 'crystal', hardness: 1.5, tool: 'pick', light: 10, emissive: true, drop: 'item:shard' });
regBlock('CRYSTAL_ROSE', { tex: 'crystal_rose', hardness: 1.5, tool: 'pick', light: 9, emissive: true, drop: 'item:shard' });
regBlock('IRON_ORE', { tex: 'iron_ore', hardness: 3, tool: 'pick', drop: 'item:iron' });
regBlock('GOLD_ORE', { tex: 'gold_ore', hardness: 3, tool: 'pick', drop: 'item:gold' });
regBlock('COAL_ORE', { tex: 'coal_ore', hardness: 2.5, tool: 'pick', drop: 'item:coal' });
regBlock('CACTUS', { tex: { top: 'cactus_top', side: 'cactus_side' }, hardness: 0.4, hurt: 1 });
regBlock('FARMLAND', { tex: { top: 'farmland', side: 'dirt' }, hardness: 0.5, tool: 'shovel', drop: 'DIRT' });
regBlock('PATH', { tex: { top: 'path', side: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 'DIRT', name: 'Dirt Path' });
regBlock('CAULDRON', { tex: { top: 'cauldron', side: 'furnace_side' }, hardness: 2, tool: 'pick' });
regBlock('POT', { render: 'box', box: [0.25, 0, 0.25, 0.75, 0.6, 0.75], tex: 'pot', hardness: 0.2, drop: 'item:gold', name: 'Clay Pot' });
regBlock('FENCE', { render: 'box', box: [0.375, 0, 0.375, 0.625, 1, 0.625], tex: 'planks', hardness: 1.5, tool: 'axe', name: 'Wooden Post' });
regBlock('STONEPOST', { render: 'box', box: [0.3, 0, 0.3, 0.7, 1, 0.7], tex: 'stonebrick', hardness: 2, tool: 'pick', name: 'Stone Post' });
regBlock('BANNER', { render: 'box', box: [0.1, 0, 0.45, 0.9, 1, 0.55], tex: 'banner_red', hardness: 0.5, solid: false, name: 'Royal Banner' });
regBlock('RUNEPILLAR', { tex: { top: 'polished', side: 'runepillar' }, hardness: -1, light: 5, name: 'Rune Obelisk' });
regBlock('ENERGY', { render: 'box', box: [0.2, 0, 0.2, 0.8, 1, 0.8], tex: 'energy', hardness: -1, light: 13, emissive: true, name: 'Energy Pillar' });
regBlock('PORTAL', { render: 'cutout', tex: 'portal', hardness: -1, solid: false, light: 13, emissive: true, anim: 1 });
regBlock('LADDER', { render: 'ladder', tex: 'ladder', hardness: 0.4, tool: 'axe', climb: true });
regBlock('VINES', { render: 'ladder', tex: 'vines', hardness: 0.2, climb: true, drop: 0 });
regBlock('RAIL', { render: 'flat', tex: 'rail', hardness: 0.7, tool: 'pick' });
regBlock('LILYPAD', { render: 'flat', tex: 'lilypad', hardness: 0.05, drop: 0, name: 'Lily Pad' });
regBlock('NET', { render: 'cross', tex: 'net', hardness: 0.2, drop: 0, name: 'Fishing Net' });
regBlock('WEB', { render: 'cross', tex: 'web', hardness: 0.6, drop: 0, name: 'Cobweb' });
regBlock('SPIKES', { render: 'cross', tex: 'spikes', hardness: -1, hurt: 3, name: 'Spike Trap' });
regBlock('TALLGRASS', { render: 'cross', tex: 'tallgrass', hardness: 0, anim: 3, drop: 0, name: 'Tall Grass' });
regBlock('FLOWER_RED', { render: 'cross', tex: 'flower_red', hardness: 0, anim: 3, name: 'Poppy' });
regBlock('FLOWER_YELLOW', { render: 'cross', tex: 'flower_yellow', hardness: 0, anim: 3, name: 'Buttercup' });
regBlock('FLOWER_BLUE', { render: 'cross', tex: 'flower_blue', hardness: 0, anim: 3, name: 'Bluebell' });
regBlock('WHEAT', { render: 'cross', tex: 'wheat', hardness: 0, anim: 3, drop: 'item:wheat' });
regBlock('DEADBUSH', { render: 'cross', tex: 'deadbush', hardness: 0, drop: 'item:stick', name: 'Dead Bush' });
regBlock('MUSHROOM', { render: 'cross', tex: 'mushroom', hardness: 0 });
regBlock('GLOWSHROOM', { render: 'cross', tex: 'glowshroom', hardness: 0, light: 10, emissive: true, name: 'Glowcap' });
regBlock('CRYSTAL_CLUSTER', { render: 'cross', tex: 'crystal_cluster', hardness: 0.3, light: 8, emissive: true, drop: 'item:shard' });
regBlock('DEADTREE', { render: 'cross', tex: 'sapling_dead', hardness: 0, drop: 'item:stick', name: 'Charred Twig' });
regBlock('BERRYBUSH', { render: 'cross', tex: 'berrybush', hardness: 0, drop: 'item:globerry', name: 'Globerry Bush' });
regBlock('STARSTONE', { tex: 'fallen_star', hardness: 3, tool: 'pick', light: 7, emissive: true, drop: 'item:shard', name: 'Sky-Glass' });

regBlock('LAPIS_ORE', { tex: 'lapis_ore', hardness: 3, tool: 'pick', drop: 'item:lapis', name: 'Lapis Lazuli Ore' });
regBlock('ENCHANT_TABLE', { render: 'box', box: [0, 0, 0, 1, 0.75, 1], tex: { top: 'ench_top', side: 'ench_side', bottom: 'ench_bottom' }, hardness: 5, tool: 'pick', light: 7, name: 'Enchanting Table' });

// resolve string drops ('DIRT' -> id). 'item:x' drops are resolved by items.js.
for (const d of BLK) if (typeof d.drop === 'string' && !d.drop.startsWith('item:')) d.drop = B[d.drop];

const SOLID = new Uint8Array(256), OPAQUE = new Uint8Array(256), LIGHTEMIT = new Uint8Array(256), CLIMB = new Uint8Array(256), HURT = new Uint8Array(256);
for (const d of BLK) { SOLID[d.id] = d.solid ? 1 : 0; OPAQUE[d.id] = d.opaque ? 1 : 0; LIGHTEMIT[d.id] = d.light; CLIMB[d.id] = d.climb ? 1 : 0; HURT[d.id] = d.hurt; }
// light passes through anything that isn't opaque; leaves dim it a little
const LIGHTCOST = new Uint8Array(256);
for (const d of BLK) LIGHTCOST[d.id] = d.opaque ? 15 : (d.cutLike ? 2 : (d.id === B.WATER ? 2 : 1));
