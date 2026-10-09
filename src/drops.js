'use strict';
/* What blocks drop (vanilla loot rules: silk touch, fortune, ores, leaves, crops, gravel...), and the dropped
   item and experience orb entities. */
const Drops = (() => {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const oreFortune = (n, f) => n * (f > 0 ? Math.max(0, Math.floor(Math.random() * (f + 2)) - 1) + 1 : 1);
  // can this tool harvest the block (get its drops)?
  function canHarvest(id, tool) {
    const md = MCDATA.blocks[BLOCKS[id].name]; if (!md) return true;
    const need = md[5]; if (!need) return true;
    const it = tool ? ITEMS[tool.id] : null;
    if (need === -1) return !!(it && it.tool && it.tool.kind === 'shears');
    const kind = md[4] || 'pickaxe';
    if (!it || !it.tool) return false;
    if (it.tool.kind !== kind && !(kind === 'sword' && it.tool.kind === 'shears')) return false;
    return it.tool.tier >= need;
  }
  // list of [item name, count] for breaking block id with state using tool
  function forBlock(id, state, tool, x, y, z) {
    const d = BLOCKS[id], n = d.name;
    const silk = enchLevel(tool, 'silk_touch') > 0, fortune = enchLevel(tool, 'fortune');
    const toolKind = tool && ITEMS[tool.id].tool ? ITEMS[tool.id].tool.kind : null;
    const shears = toolKind === 'shears';
    const self = () => { const iid = ITEM_OF_BLOCK[id]; return iid >= 0 ? [[ITEMS[iid].name, 1]] : []; };
    if (!canHarvest(id, tool)) return [];
    // silk touch keeps the block itself for most things
    const silkable = /_ore$|^glass|_glass|_glass_pane$|^ice$|^packed_ice$|^blue_ice$|^grass_block$|^mycelium$|^podzol$|^stone$|^deepslate$|bookshelf|glowstone|sea_lantern|^melon$|^clay$|^snow_block$|^ender_chest$|_mushroom_block$|mushroom_stem|^gravel$|^campfire$|^soul_campfire$|^bee_nest$|_coral|amethyst_cluster|^turtle_egg$|^infested|^dirt_path$|^farmland$|^snow$|^beehive$|^gilded_blackstone$|^ancient_debris$|^nylium|_nylium$|^tall_seagrass$/;
    if (silk && silkable.test(n)) {
      if (n === 'dirt_path' || n === 'farmland') return [['dirt', 1]];
      if (n.startsWith('infested_')) return [[n.replace('infested_', ''), 1]];
      if (n === 'snow') return [['snow', (state & 7) + 1]];
      return self();
    }
    switch (n) {
      case 'stone': return [['cobblestone', 1]];
      case 'deepslate': return [['cobbled_deepslate', 1]];
      case 'grass_block': case 'mycelium': case 'podzol': case 'dirt_path': case 'farmland': return [['dirt', 1]];
      case 'coal_ore': case 'deepslate_coal_ore': return [['coal', oreFortune(1, fortune)]];
      case 'diamond_ore': case 'deepslate_diamond_ore': return [['diamond', oreFortune(1, fortune)]];
      case 'emerald_ore': case 'deepslate_emerald_ore': return [['emerald', oreFortune(1, fortune)]];
      case 'iron_ore': case 'deepslate_iron_ore': return [['raw_iron', oreFortune(1, fortune)]];
      case 'gold_ore': case 'deepslate_gold_ore': return [['raw_gold', oreFortune(1, fortune)]];
      case 'copper_ore': case 'deepslate_copper_ore': return [['raw_copper', oreFortune(r(2, 5), fortune)]];
      case 'lapis_ore': case 'deepslate_lapis_ore': return [['lapis_lazuli', oreFortune(r(4, 9), fortune)]];
      case 'redstone_ore': case 'deepslate_redstone_ore': return [['redstone', r(4, 5) + r(0, fortune)]];
      case 'nether_quartz_ore': return [['quartz', oreFortune(1, fortune)]];
      case 'nether_gold_ore': return [['gold_nugget', oreFortune(r(2, 6), fortune)]];
      case 'gilded_blackstone': return Math.random() < [0.1, 0.143, 0.25, 1][Math.min(3, fortune)] ? [['gold_nugget', r(2, 5)]] : [['gilded_blackstone', 1]];
      case 'glowstone': return [['glowstone_dust', Math.min(4, r(2, 4) + r(0, fortune))]];
      case 'sea_lantern': return [['prismarine_crystals', Math.min(5, r(2, 3) + r(0, fortune))]];
      case 'melon': return [['melon_slice', Math.min(9, r(3, 7) + r(0, fortune))]];
      case 'bookshelf': return [['book', 3]];
      case 'clay': return [['clay_ball', 4]];
      case 'snow_block': return [['snowball', 4]];
      case 'snow': return toolKind === 'shovel' ? [['snowball', (state & 7) + 1]] : [];
      case 'gravel': return Math.random() < [0.1, 0.14, 0.25, 1][Math.min(3, fortune)] ? [['flint', 1]] : [['gravel', 1]];
      case 'cobweb': return shears || toolKind === 'sword' && silk ? [['cobweb', 1]] : (toolKind === 'sword' || shears ? [['string', 1]] : []);
      case 'short_grass': case 'fern': return shears ? self() : Math.random() < 0.125 ? [['wheat_seeds', 1 + r(0, fortune * 2)]] : [];
      case 'tall_grass': case 'large_fern': if (state & 8) return []; return shears ? [[n === 'tall_grass' ? 'short_grass' : 'fern', 2]] : Math.random() < 0.125 ? [['wheat_seeds', 1]] : [];
      case 'dead_bush': return shears ? self() : [['stick', r(0, 2)]];
      case 'vine': case 'glow_lichen': case 'seagrass': case 'tall_seagrass': case 'hanging_roots': case 'nether_sprouts': return shears ? self() : [];
      case 'twisting_vines': case 'twisting_vines_plant': case 'weeping_vines': case 'weeping_vines_plant': return shears || Math.random() < 0.33 + fortune * 0.22 ? [[n.replace('_plant', ''), 1]] : [];
      case 'cave_vines': case 'cave_vines_plant': return state & 8 ? [['glow_berries', 1]] : [];
      case 'kelp': case 'kelp_plant': return [['kelp', 1]];
      case 'glass': case 'glass_pane': case 'ice': case 'tinted_glass': return n === 'tinted_glass' ? self() : [];
      case 'packed_ice': case 'blue_ice': case 'spawner': case 'budding_amethyst': case 'infested_stone': case 'infested_cobblestone': case 'infested_stone_bricks': case 'bee_nest': case 'trial_spawner': case 'reinforced_deepslate': case 'suspicious_sand': case 'suspicious_gravel': return [];
      case 'ender_chest': return [['obsidian', 8]];
      case 'brown_mushroom_block': case 'red_mushroom_block': { const k = Math.max(0, r(-7, 2)); return k ? [[n === 'brown_mushroom_block' ? 'brown_mushroom' : 'red_mushroom', k]] : []; }
      case 'mushroom_stem': return [];
      case 'campfire': return [['charcoal', 2]];
      case 'soul_campfire': return [['soul_soil', 1]];
      case 'amethyst_cluster': return toolKind === 'pickaxe' ? [['amethyst_shard', 4 * (fortune > 0 ? Math.max(1, oreFortune(1, fortune)) : 1)]] : [['amethyst_shard', 2]];
      case 'small_amethyst_bud': case 'medium_amethyst_bud': case 'large_amethyst_bud': return [];
      case 'chorus_plant': return Math.random() < 0.5 ? [['chorus_fruit', 1]] : [];
      case 'sea_pickle': return [['sea_pickle', (state & 3) + 1]];
      case 'wheat': return (state & 7) === 7 ? [['wheat', 1], ['wheat_seeds', binom(3 + fortune, 0.5714) + 1]] : [['wheat_seeds', 1]];
      case 'carrots': return (state & 7) === 7 ? [['carrot', binom(3 + fortune, 0.5714) + 1]] : [['carrot', 1]];
      case 'potatoes': { const out = (state & 7) === 7 ? [['potato', binom(3 + fortune, 0.5714) + 1]] : [['potato', 1]]; if ((state & 7) === 7 && Math.random() < 0.02) out.push(['poisonous_potato', 1]); return out; }
      case 'beetroots': return (state & 7) >= 3 ? [['beetroot', 1], ['beetroot_seeds', binom(3 + fortune, 0.5714) + 1]] : [['beetroot_seeds', 1]];
      case 'nether_wart': return [['nether_wart', (state & 7) >= 3 ? r(2, 4) + r(0, fortune) : 1]];
      case 'cocoa': return [['cocoa_beans', ((state >> 3) & 3) >= 2 ? 3 : 1]];
      case 'sweet_berry_bush': { const a = state & 3; return a === 3 ? [['sweet_berries', r(2, 3)]] : a === 2 ? [['sweet_berries', r(1, 2)]] : []; }
      case 'pumpkin_stem': case 'melon_stem': { const a = state & 7; const k = binom(3, (a + 1) / 15); return k ? [[n === 'pumpkin_stem' ? 'pumpkin_seeds' : 'melon_seeds', k]] : []; }
      case 'attached_pumpkin_stem': case 'attached_melon_stem': return [[n.includes('pumpkin') ? 'pumpkin_seeds' : 'melon_seeds', binom(3, 0.53)]];
      case 'cake': case 'fire': case 'soul_fire': case 'nether_portal': case 'end_portal': case 'end_gateway': case 'piston_head': case 'moving_piston': case 'frosted_ice': case 'bedrock': case 'tripwire': return n === 'tripwire' ? [['string', 1]] : [];
      case 'flower_pot': { const p = Models.POT_PLANTS[state & 31]; return p ? [['flower_pot', 1], [p, 1]] : [['flower_pot', 1]]; }
      case 'tube_coral_block': case 'brain_coral_block': case 'bubble_coral_block': case 'fire_coral_block': case 'horn_coral_block': return [['dead_' + n, 1]];
      case 'redstone_wire': return [['redstone', 1]];
      case 'powder_snow': return [];
    }
    if (/_coral$|_coral_fan$/.test(n) && !n.startsWith('dead_')) return [];
    if (/_leaves$/.test(n)) {
      if (shears) return self();
      const out = [];
      const sap = n === 'jungle_leaves' ? 1 / (40 - fortune * 4) : 1 / (20 - fortune * 4);
      const sapling = { oak_leaves: 'oak_sapling', spruce_leaves: 'spruce_sapling', birch_leaves: 'birch_sapling', jungle_leaves: 'jungle_sapling', acacia_leaves: 'acacia_sapling', dark_oak_leaves: 'dark_oak_sapling', cherry_leaves: 'cherry_sapling', azalea_leaves: 'azalea', flowering_azalea_leaves: 'flowering_azalea', mangrove_leaves: null }[n];
      if (sapling && Math.random() < sap) out.push([sapling, 1]);
      if (Math.random() < 0.02 + fortune * 0.0022) out.push(['stick', r(1, 2)]);
      if ((n === 'oak_leaves' || n === 'dark_oak_leaves') && Math.random() < 0.005 + fortune * 0.00056) out.push(['apple', 1]);
      return out;
    }
    if (/_stained_glass(_pane)?$/.test(n)) return [];
    if (d.model === 'slab' && ((state >> 3) & 3) === 2) return [[n, 2]];
    if (d.model === 'door' && (state & 8)) return [];
    if (d.model === 'tall' && (state & 8)) return [];
    if (d.model === 'bed' && !(state & 8)) return [];
    if (n === 'twisting_vines_plant' || n === 'weeping_vines_plant') return [];
    return self();
  }
  function binom(n, p) { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < p) k++; return k; }
  function xpFor(id, tool) {
    if (enchLevel(tool, 'silk_touch')) return 0;
    const n = BLOCKS[id].name.replace('deepslate_', '');
    switch (n) { case 'coal_ore': return r(0, 2); case 'diamond_ore': case 'emerald_ore': return r(3, 7); case 'lapis_ore': return r(2, 5); case 'redstone_ore': return r(1, 5); case 'nether_quartz_ore': return r(2, 5); case 'nether_gold_ore': return r(0, 1); case 'spawner': return r(15, 43); }
    return 0;
  }
  // ---------------------------------------------------------------- dropped items
  function spawnItem(x, y, z, s, scatter, o) {
    if (!s || s.count <= 0) return null;
    const e = new ItemEntity(x, y, z, Object.assign({}, s));
    if (scatter) { const a = Math.random() * Math.PI * 2, f = Math.random() * 0.5; e.vx = -Math.sin(a) * f * 0.6; e.vz = Math.cos(a) * f * 0.6; e.vy = 0.2; }
    else { e.vx = (Math.random() - 0.5) * 0.2; e.vy = 0.2; e.vz = (Math.random() - 0.5) * 0.2; }
    if (o) Object.assign(e, o);
    return Entities.add(e);
  }
  function spawnXp(x, y, z, n) {
    // split into orbs of the game's standard sizes
    const sizes = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
    while (n > 0) { const s = sizes.find(v => v <= n) || 1; n -= s; const e = Entities.add(new XpOrb(x, y, z, s)); e.vx = (Math.random() - 0.5) * 0.4; e.vy = Math.random() * 0.2 + 0.1; e.vz = (Math.random() - 0.5) * 0.4; }
  }
  function dropBlock(id, state, tool, x, y, z) {
    if (!Game.rules.doTileDrops) return;
    // banners keep their patterns
    const tag = (BLOCKS[id].model === 'banner' || BLOCKS[id].model === 'wall_banner') && typeof Banners !== 'undefined' ? Banners.dropTag(x, y, z) : null;
    for (const [name, count] of forBlock(id, state, tool, x, y, z)) {
      if (count <= 0 || IID[name] === undefined) continue;
      if (tag && name.endsWith('_banner')) { spawnItem(x + 0.5, y + 0.5, z + 0.5, stack(name, 1, { tag })); continue; }
      let left = count;
      while (left > 0) { const n = Math.min(left, ITEMS[IID[name]].stack); left -= n; spawnItem(x + 0.5 + (Math.random() - 0.5) * 0.5, y + 0.25 + Math.random() * 0.5, z + 0.5 + (Math.random() - 0.5) * 0.5, stack(name, n)); }
    }
    const xp = xpFor(id, tool); if (xp) spawnXp(x + 0.5, y + 0.5, z + 0.5, xp);
  }
  return { forBlock, canHarvest, spawnItem, spawnXp, dropBlock, xpFor };
})();

class ItemEntity extends Entity {
  constructor(x, y, z, s) { super('item', x, y, z); this.stack = s; this.w = 0.25; this.h = 0.25; this.pickupDelay = 10; this.bobOffset = Math.random() * Math.PI * 2; this.health = 5; this.stepHeight = 0; }
  tick() {
    this.tickBase();
    if (this.pickupDelay > 0 && this.pickupDelay < 32767) this.pickupDelay--;
    if (this.inWater && this.vy < 0.06) this.vy += 0.0005 * 10; else if (this.inLava) this.vy += 0.01; else if (!this.noGravity) this.vy -= 0.04;
    if (this.inLava && !ITEMS[this.stack.id].fireproof) { this.removed = true; Sound.play('fizz', this); return; }
    Phys.move(this, this.vx, this.vy, this.vz);
    const fr = this.onGround ? World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5), Math.floor(this.z)) : 0;
    const f = this.onGround ? BLOCKS[fr].slip * 0.98 : 0.98;
    this.vx *= f; this.vy *= 0.98; this.vz *= f;
    if (this.onGround) this.vy *= -0.5;
    // merge with nearby identical stacks
    if (this.age % 10 === 0) for (const o of Entities.list) {
      if (o === this || o.type !== 'item' || o.removed || !sameItem(o.stack, this.stack)) continue;
      if (Math.abs(o.x - this.x) > 0.5 || Math.abs(o.y - this.y) > 0.5 || Math.abs(o.z - this.z) > 0.5) continue;
      const max = maxStack(this.stack); if (o.stack.count + this.stack.count > max) continue;
      this.stack.count += o.stack.count; o.removed = true; this.age = Math.min(this.age, o.age);
    }
    // cactus and fire destroy dropped items
    if (Phys.touching(this, id => id === BID.cactus || id === BID.fire, 0.05) && !ITEMS[this.stack.id].fireproof) { this.removed = true; return; }
    if (this.age >= 6000 && this.pickupDelay !== 32767) this.removed = true; // despawn after 5 minutes
  }
  hurt(n, src) { if (src === 'explosion' && ITEMS[this.stack.id].name === 'nether_star') return; if ((src === 'lava' || src === 'inFire' || src === 'onFire') && ITEMS[this.stack.id].fireproof) return; this.health -= n; if (this.health <= 0) this.removed = true; }
}
class XpOrb extends Entity {
  constructor(x, y, z, value) { super('xp_orb', x, y, z); this.value = value; this.w = 0.5; this.h = 0.5; this.stepHeight = 0; }
  tick() {
    this.tickBase();
    this.vy -= 0.03;
    if (this.inWater) this.vy += 0.035;
    const p = Game.player;
    if (p && !p.dead && !p.spectator) {
      const dx = p.x - this.x, dy = p.y + p.eyeH / 2 - this.y, dz = p.z - this.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) / 8;
      if (d < 1) { const k = (1 - d) * (1 - d); this.vx += dx / (d * 8 + 0.01) * k * 0.1; this.vy += dy / (d * 8 + 0.01) * k * 0.1; this.vz += dz / (d * 8 + 0.01) * k * 0.1; }
    }
    Phys.move(this, this.vx, this.vy, this.vz);
    const f = this.onGround ? 0.6 * 0.98 : 0.98;
    this.vx *= f; this.vy *= 0.98; this.vz *= f;
    if (this.onGround) this.vy *= -0.9;
    if (this.age >= 6000) this.removed = true;
    if (p && !p.dead && !p.spectator && Math.abs(p.x - this.x) < 1 && Math.abs(p.y + 0.9 - this.y) < 1.5 && Math.abs(p.z - this.z) < 1 && (p.xpCooldown || 0) <= 0) {
      p.xpCooldown = 2; this.removed = true;
      // Mending repairs damaged gear first (2 durability per experience point)
      let v = this.value;
      const mend = [p.inv.selected, 40, 36, 37, 38, 39].map(i => p.inv.get(i)).filter(s => s && s.dmg > 0 && enchLevel(s, 'mending'));
      if (mend.length) { const s = mend[Math.floor(Math.random() * mend.length)]; const fix = Math.min(s.dmg, v * 2); s.dmg -= fix; v -= Math.ceil(fix / 2); }
      if (v > 0) p.addXp(v);
      Sound.play('orb', p);
    }
  }
}
