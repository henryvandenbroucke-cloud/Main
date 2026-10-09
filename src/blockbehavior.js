'use strict';
/* What blocks do: being placed, removed, used (right click), neighbour updates (support rules, falling sand,
   fluids), random ticks (crops, grass spreading, saplings, leaves decaying, ice melting) and scheduled ticks. */
const Blocks = (() => {
  const B = BID;
  const isFluid = id => BLOCKS[id].fluid;
  // ---------------------------------------------------------------- removing
  function remove(x, y, z, p, quiet) {
    const id = World.getBlock(x, y, z), st = World.getState(x, y, z), d = BLOCKS[id];
    const waterlogged = (d.waterlog && (st & 128)) || d.fluidLog;
    World.setBlock(x, y, z, waterlogged ? B.water : 0, 0);
    if (waterlogged) Ticks.schedule(x, y, z, 5);
    // the other half of two-block things
    if (d.model === 'door' || d.model === 'tall') { const oy = st & 8 ? y - 1 : y + 1; if (World.getBlock(x, oy, z) === id) { const ost = World.getState(x, oy, z); const wl = BLOCKS[id].fluidLog; World.setBlock(x, oy, z, wl ? B.water : 0, 0); void ost; } }
    if (d.model === 'bed') { const f = st & 7, s = st & 8 ? -1 : 1; const ox = x + DX[f] * s, oz = z + DZ[f] * s; if (World.getBlock(x, y, z) !== id && World.getBlock(ox, y, oz) === id) World.setBlock(ox, y, oz, 0, 0); }
    if (d.model === 'chest') { const t = (st >> 3) & 3; if (t) { const f = st & 7, side = { 2: [5, 4], 3: [4, 5], 4: [2, 3], 5: [3, 2] }[f][t === 1 ? 0 : 1]; const ox = x + DX[side], oz = z + DZ[side]; if (World.getBlock(ox, y, oz) === id) World.setBlock(ox, y, oz, id, World.getState(ox, y, oz) & 7, 4); } }
    if (d.model === 'piston' && (st & 8)) { const f = st & 7; if (World.getBlock(x + DX[f], y + DY[f], z + DZ[f]) === B.piston_head) World.setBlock(x + DX[f], y + DY[f], z + DZ[f], 0, 0); }
    if (d.model === 'piston_head') { const f = st & 7; const bx = x - DX[f], by = y - DY[f], bz = z - DZ[f]; const b = World.getBlock(bx, by, bz); if (b === B.piston || b === B.sticky_piston) { if (!(p && p.creative)) Drops.dropBlock(b, 0, null, bx, by, bz); World.setBlock(bx, by, bz, 0, 0); } }
    if (id === B.ice && !quiet && !(p && p.creative)) { const below = World.getBlock(x, y - 1, z); if (SOLID[below] || isFluid(below)) { World.setBlock(x, y, z, B.water, 0); Ticks.schedule(x, y, z, 5); } }
    if (d.name === 'nether_portal' || d.name === 'obsidian') Portals.onBreak(x, y, z);
    if (d.name === 'end_portal_frame') Portals.onEndFrameBreak(x, y, z);
    // string cut with shears is disarmed first and does not set off its hooks
    if (id === B.tripwire || id === B.tripwire_hook) Tripwire.removed(x, y, z, id, id === B.tripwire && p && p.inv && p.inv.held && ITEMS[p.inv.held.id].name === 'shears' ? st | 4 : st);
    World.setBE(x, y, z, null);
    updateAround(x, y, z);
    Redstone.update(x, y, z);
  }
  function onPlaced(x, y, z, id, st, p, s) {
    const d = BLOCKS[id];
    GameEvents.emit('block_place', x + 0.5, y + 0.5, z + 0.5, p || GameEvents.actor, id);
    BlockExtras.onPlaced(x, y, z, id, st);
    // block entities for containers and machines
    const be = newBE(d.name);
    if (be) { if (s && s.tag && s.tag.items) be.items = s.tag.items.slice(); if (s && s.tag && s.tag.name) be.customName = s.tag.name; World.setBE(x, y, z, be); }
    if (d.name === 'decorated_pot') Pots.placed(x, y, z, s);
    if (d.name === 'bee_nest' || d.name === 'beehive') Bees.placed(x, y, z, s);
    if (d.name === 'redstone_wire' || d.model === 'repeater' || d.model === 'comparator' || d.name.includes('redstone') || d.model === 'lever' || d.model === 'door' || d.model === 'trapdoor' || d.model === 'piston' || d.name === 'observer' || d.name === 'tnt' || d.name === 'redstone_lamp' || d.name === 'note_block' || d.model === 'gate' || d.name === 'dispenser' || d.name === 'dropper' || d.name === 'hopper' || d.model === 'rail') Redstone.onPlaced(x, y, z, id, st);
    if (d.fluid) Ticks.schedule(x, y, z, Fluids.delay(id));
    if (d.gravity) Ticks.schedule(x, y, z, 2);
    if (id === B.tripwire || id === B.tripwire_hook) Tripwire.placed(x, y, z, id, st);
    if (d.model === 'banner' || d.model === 'wall_banner') Banners.placed(x, y, z, s);
    if (d.name === 'carved_pumpkin' || d.name === 'wither_skeleton_skull') Golems.check(x, y, z, p);
    if (d.name === 'fire') Portals.tryLight(x, y, z);
    if (d.name === 'sponge') Sponge.absorb(x, y, z);
    if (d.name === 'sign' || d.model === 'sign' || d.model === 'wall_sign' || d.model === 'hanging_sign' || d.model === 'wall_hanging_sign') { World.setBE(x, y, z, { type: 'sign', lines: ['', '', '', ''] }); if (p && p.isPlayer) UI.open('sign', { x, y, z }); }
    updateAround(x, y, z);
    Redstone.update(x, y, z);
  }
  function newBE(name) {
    if (name === 'chest' || name === 'trapped_chest' || name === 'barrel' || name.endsWith('shulker_box')) return { type: 'container', items: new Array(27).fill(null) };
    if (name === 'furnace' || name === 'blast_furnace' || name === 'smoker') return { type: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, cook: 0, cookMax: 200, xp: 0 };
    if (name === 'dispenser' || name === 'dropper') return { type: 'container', items: new Array(9).fill(null) };
    if (name === 'hopper') return { type: 'hopper', items: new Array(5).fill(null), cooldown: 0 };
    if (name === 'brewing_stand') return { type: 'brewing', items: [null, null, null, null, null], fuel: 0, time: 0 };
    if (name === 'jukebox') return { type: 'jukebox', disc: null };
    if (name === 'decorated_pot') return { type: 'pot', items: [null] };
    if (name === 'chiseled_bookshelf') return { type: 'bookshelf', items: new Array(6).fill(null) };
    if (name === 'sculk_sensor' || name === 'calibrated_sculk_sensor') return { type: 'sensor', power: 0, freq: 0 };
    if (name === 'sculk_shrieker') return { type: 'shrieker', warning: 0 };
    if (name === 'sculk_catalyst') return { type: 'catalyst', cursors: [] };
    if (name === 'trial_spawner') return Trials.newBE();
    if (name === 'bee_nest' || name === 'beehive') return Bees.newBE();
    if (name === 'vault') return Trials.newVault();
    if (name === 'campfire' || name === 'soul_campfire') return { type: 'campfire', items: [null, null, null, null], times: [0, 0, 0, 0] };
    if (name === 'beacon') return { type: 'beacon', levels: 0, primary: null, secondary: null };
    if (name === 'lectern') return { type: 'lectern', book: null };
    if (name === 'spawner') return { type: 'spawner', mob: 'pig', delay: 20 };
    if (name === 'enchanting_table') return { type: 'enchanting' };
    if (name === 'end_gateway') return { type: 'gateway' };
    if (name === 'comparator') return { type: 'comparator', out: 0 };
    if (name === 'crafter') return { type: 'crafter', items: new Array(9).fill(null), disabled: new Array(9).fill(false), craftTicks: 0 };
    if (name === 'daylight_detector') return { type: 'daylight' };
    return null;
  }
  // tell the six neighbours that something changed next to them
  function updateAround(x, y, z) {
    for (let f = 0; f < 6; f++) neighborChanged(x + DX[f], y + DY[f], z + DZ[f], x, y, z);
  }
  function neighborChanged(x, y, z, fx, fy, fz) {
    const id = World.getBlock(x, y, z); if (!id) return;
    const d = BLOCKS[id], st = World.getState(x, y, z);
    if (d.fluid) { Ticks.schedule(x, y, z, Fluids.delay(id)); return; }
    BlockExtras.neighborChanged(x, y, z, id);
    if ((d.waterlog && (st & 128)) || d.fluidLog) Ticks.schedule(x, y, z, 5, B.water);
    if (d.gravity) Ticks.schedule(x, y, z, 2);
    if (d.name === 'redstone_wire' || d.model === 'repeater' || d.model === 'comparator' || d.model === 'piston' || d.name === 'redstone_lamp' || d.model === 'door' || d.model === 'trapdoor' || d.model === 'gate' || d.name === 'tnt' || d.name === 'note_block' || d.name === 'dispenser' || d.name === 'dropper' || d.name === 'observer' || d.name === 'hopper' || d.model === 'rail' || d.name.startsWith('redstone_') && d.model.includes('torch')) Redstone.neighbor(x, y, z, id, st, fx, fy, fz);
    // things that need support pop off
    if (!Place.canSurvive(id, st, x, y, z)) {
      if (d.model === 'tall' && (st & 8) && World.getBlock(x, y - 1, z) !== id) { World.setBlock(x, y, z, d.fluidLog ? B.water : 0, 0); return; }
      Drops.dropBlock(id, st, null, x, y, z);
      remove(x, y, z, null, true);
      return;
    }
    // nether portals break when their frame does
    if (id === B.nether_portal) Portals.checkFrame(x, y, z);
    // snowy grass under snow
    if (id === B.grass_block || id === B.podzol || id === B.mycelium) { const snowy = World.getBlock(x, y + 1, z) === B.snow || World.getBlock(x, y + 1, z) === B.snow_block ? 1 : 0; if ((st & 1) !== snowy) World.setBlock(x, y, z, id, snowy, 1); }
    if (id === B.farmland && SOLID[World.getBlock(x, y + 1, z)] && BLOCKS[World.getBlock(x, y + 1, z)].model === 'cube') World.setBlock(x, y, z, B.dirt, 0);
  }
  // ---------------------------------------------------------------- scheduled ticks
  function scheduledTick(x, y, z, id, st, water) {
    const d = BLOCKS[id];
    if (d.fluid) return Fluids.tick(x, y, z, id, st);
    if (!water && typeof Sculk !== 'undefined' && Sculk.scheduledTick(x, y, z, id, st)) return;
    if (water || (((d.waterlog && (st & 128)) || d.fluidLog) && !Redstone.isComponent(id))) { Fluids.tick(x, y, z, B.water, 0); return; }
    if (d.gravity) return Falling.check(x, y, z, id, st);
    if (BlockExtras.scheduledTick(x, y, z, id, st)) return;
    if (Redstone.isComponent(id)) return Redstone.scheduled(x, y, z, id, st);
    if (id === B.fire || id === B.soul_fire) return Fire.tick(x, y, z, id, st);
    if (d.model === 'button') { World.setBlock(x, y, z, id, st & ~32); Sound.play('click_off', null, { x, y, z }); Redstone.update(x, y, z); return; }
    if (d.model === 'plate') return Redstone.plateTick(x, y, z, id, st);
    if (id === B.scaffolding) return;
  }
  // ---------------------------------------------------------------- random ticks
  function randomTick(x, y, z, id, st) {
    if (BlockExtras.randomTick(x, y, z, id, st)) return;
    const d = BLOCKS[id], n = d.name;
    const light = World.lightLevel(x, y + 1, z);
    switch (n) {
      case 'grass_block': case 'mycelium': {
        // dies under opaque blocks; spreads to dirt next to it in light
        const ab = World.getBlock(x, y + 1, z);
        if (OPACITY[ab] >= 2 && !(BLOCKS[ab].name === 'snow' && (World.getState(x, y + 1, z) & 7) === 0)) { if (World.lightLevel(x, y + 1, z) < 4) World.setBlock(x, y, z, B.dirt, 0); return; }
        if (light >= 9) for (let i = 0; i < 4; i++) {
          const tx = x + Math.floor(Math.random() * 3) - 1, ty = y + Math.floor(Math.random() * 5) - 3, tz = z + Math.floor(Math.random() * 3) - 1;
          if (World.getBlock(tx, ty, tz) === B.dirt && World.getState(tx, ty, tz) === 0 && OPACITY[World.getBlock(tx, ty + 1, tz)] < 2 && World.lightLevel(tx, ty + 1, tz) >= 4) World.setBlock(tx, ty, tz, id, 0);
        }
        return;
      }
      case 'farmland': {
        const wet = waterNear(x, y, z, 4) || Weather.rainingAt(x, y + 1, z);
        const m = st & 7;
        if (wet) { if (m < 7) World.setBlock(x, y, z, id, 7); }
        else if (m > 0) World.setBlock(x, y, z, id, m - 1);
        else if (!['wheat', 'carrots', 'potatoes', 'beetroots', 'pumpkin_stem', 'melon_stem', 'attached_pumpkin_stem', 'attached_melon_stem'].includes(BLOCKS[World.getBlock(x, y + 1, z)].name)) World.setBlock(x, y, z, B.dirt, 0);
        return;
      }
      case 'wheat': case 'carrots': case 'potatoes': case 'beetroots': case 'pumpkin_stem': case 'melon_stem': case 'nether_wart': {
        const max = n === 'beetroots' || n === 'nether_wart' ? 3 : 7, age = st & 7;
        if (n !== 'nether_wart' && World.lightLevel(x, y + 1, z) < 9) return;
        if (age < max) { const g = n === 'nether_wart' ? 0.1 : growthChance(x, y, z, id); if (Math.random() < g) World.setBlock(x, y, z, id, age + 1); }
        else if (n === 'pumpkin_stem' || n === 'melon_stem') {
          const f = [2, 3, 4, 5][Math.floor(Math.random() * 4)], fx = x + DX[f], fz = z + DZ[f];
          const below = World.getBlock(fx, y - 1, fz);
          if (World.getBlock(fx, y, fz) === 0 && (below === B.farmland || Place.soil(below))) { World.setBlock(fx, y, fz, n === 'pumpkin_stem' ? B.pumpkin : B.melon, 0); World.setBlock(x, y, z, n === 'pumpkin_stem' ? B.attached_pumpkin_stem : B.attached_melon_stem, f); }
        }
        return;
      }
      case 'sweet_berry_bush': if ((st & 3) < 3 && light >= 9 && Math.random() < 0.2) World.setBlock(x, y, z, id, (st & ~3) | ((st & 3) + 1)); return;
      case 'cocoa': { const a = (st >> 3) & 3; if (a < 2 && Math.random() < 0.2) World.setBlock(x, y, z, id, (st & 7) | ((a + 1) << 3)); return; }
      case 'sugar_cane': case 'cactus': {
        if (World.getBlock(x, y + 1, z) !== 0) return;
        let h = 1; while (World.getBlock(x, y - h, z) === id) h++;
        if (h >= 3) return;
        const age = st & 15;
        if (age >= 15) { World.setBlock(x, y, z, id, 0); if (Place.canSurvive(id, 0, x, y + 1, z)) { World.setBlock(x, y + 1, z, id, 0); } else if (id === B.cactus) Drops.dropBlock(id, 0, null, x, y + 1, z); }
        else World.setBlock(x, y, z, id, age + 1, 1);
        return;
      }
      case 'bamboo': { if (World.getBlock(x, y + 1, z) !== 0 || light < 9) return; let h = 1; while (World.getBlock(x, y - h, z) === id) h++; if (h < 12 + (x * 31 + z * 17 & 3) && Math.random() < 0.33) { World.setBlock(x, y + 1, z, id, 2 << 1); if (h > 1) World.setBlock(x, y, z, id, 1 << 1); } return; }
      case 'kelp': { if ((st & 31) < 25 && World.getBlock(x, y + 1, z) === B.water && (World.getState(x, y + 1, z) & 15) === 0 && Math.random() < 0.14) { World.setBlock(x, y, z, B.kelp_plant, 0); World.setBlock(x, y + 1, z, B.kelp, (st & 31) + 1); } return; }
      case 'vine': {
        if (Math.random() > 0.25) return;
        const below = World.getBlock(x, y - 1, z);
        if (below === 0 && y > MINY && Math.random() < 0.5) World.setBlock(x, y - 1, z, B.vine, st & 15);
        return;
      }
      case 'brown_mushroom': case 'red_mushroom': {
        if (Math.random() > 0.04) return;
        let count = 0; for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = -1; dy <= 1; dy++) if (World.getBlock(x + dx, y + dy, z + dz) === id) count++;
        if (count >= 5) return;
        const tx = x + Math.floor(Math.random() * 3) - 1, ty = y + Math.floor(Math.random() * 2) - Math.floor(Math.random() * 2), tz = z + Math.floor(Math.random() * 3) - 1;
        if (World.getBlock(tx, ty, tz) === 0 && Place.canSurvive(id, 0, tx, ty, tz)) World.setBlock(tx, ty, tz, id, 0);
        return;
      }
      case 'ice': if (World.blockLight(x, y, z) > 11 - OPACITY[id] || (World.dim === 'nether')) { World.setBlock(x, y, z, World.dim === 'nether' ? 0 : B.water, 0); Ticks.schedule(x, y, z, 5); } return;
      case 'snow': if (World.blockLight(x, y, z) > 11) { Drops.dropBlock(id, st, null, x, y, z); World.setBlock(x, y, z, 0, 0); } return;
      case 'redstone_ore': case 'deepslate_redstone_ore': if (st & 1) World.setBlock(x, y, z, id, 0); return;
      case 'budding_amethyst': {
        if (Math.random() > 0.2) return;
        const f = Math.floor(Math.random() * 6), tx = x + DX[f], ty = y + DY[f], tz = z + DZ[f], t = World.getBlock(tx, ty, tz);
        const order = [B.small_amethyst_bud, B.medium_amethyst_bud, B.large_amethyst_bud, B.amethyst_cluster];
        if (t === 0 || t === B.water) World.setBlock(tx, ty, tz, order[0], f);
        else { const k = order.indexOf(t); if (k >= 0 && k < 3 && World.getState(tx, ty, tz) === f) World.setBlock(tx, ty, tz, order[k + 1], f); }
        return;
      }
      case 'chorus_flower': return Chorus.grow(x, y, z, st);
      case 'crimson_nylium': case 'warped_nylium': if (OPACITY[World.getBlock(x, y + 1, z)] >= 15) World.setBlock(x, y, z, B.netherrack, 0); return;
      case 'turtle_egg': return;
      case 'cave_vines': if (!(st & 8) && Math.random() < 0.11) World.setBlock(x, y, z, id, st | 8); return;
      case 'fire': return;
    }
    if (n.endsWith('_sapling') || n === 'mangrove_propagule') { if (light >= 9 && Math.random() < 1 / 7) growSapling(x, y, z, id, st); return; }
    if (n.endsWith('_leaves')) { if (!(st & 8)) Leaves.check(x, y, z, id); return; }
  }
  function waterNear(x, y, z, r) { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = 0; dy <= 1; dy++) { const b = World.getBlock(x + dx, y + dy, z + dz); if (BLOCKS[b].fluid === 'water' || BLOCKS[b].fluidLog || (BLOCKS[b].waterlog && World.getState(x + dx, y + dy, z + dz) & 128)) return true; } return false; }
  // the crop growth chance from the farmland around it (the game's getGrowthSpeed)
  function growthChance(x, y, z, id) {
    let f = 1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = World.getBlock(x + dx, y - 1, z + dz); let g = 0;
      if (b === B.farmland) { g = 1; if ((World.getState(x + dx, y - 1, z + dz) & 7) > 0) g = 3; }
      if (dx || dz) g /= 4;
      f += g;
    }
    // crops in rows grow faster than crops in a solid block
    const same = (dx, dz) => World.getBlock(x + dx, y, z + dz) === id;
    const ns = same(0, -1) || same(0, 1), ew = same(-1, 0) || same(1, 0), diag = same(-1, -1) || same(1, -1) || same(1, 1) || same(-1, 1);
    if (diag || (ns && ew)) f /= 2;
    return 1 / (Math.floor(25 / f) + 1);
  }
  function growSapling(x, y, z, id, st) {
    const n = BLOCKS[id].name;
    if (!(st & 1)) { World.setBlock(x, y, z, id, st | 1); return; }
    const w = { get: (a, b, c) => World.getBlock(a, b, c), getState: (a, b, c) => World.getState(a, b, c), set: (a, b, c, i, s) => { const cur = World.getBlock(a, b, c); if (cur === 0 || BLOCKS[cur].replaceable || BLOCKS[cur].name.endsWith('_leaves') || BLOCKS[cur].model === 'cross' || (a === x && b === y && c === z) || BLOCKS[cur].name.endsWith('_sapling') || cur === B.dirt || cur === B.grass_block || cur === B.podzol || cur === B.water) World.setBlock(a, b, c, i, s); } };
    // 2x2 saplings grow the giant trees
    let big = null;
    for (const [ox, oz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if ([0, 1].every(a => [0, 1].every(b => World.getBlock(x + ox + a, y, z + oz + b) === id))) { big = [x + ox, z + oz]; break; }
    const r = new Rand((Math.random() * 1e9) | 0);
    if (big && (n === 'spruce_sapling' || n === 'jungle_sapling' || n === 'dark_oak_sapling')) {
      for (const a of [0, 1]) for (const b of [0, 1]) World.setBlock(big[0] + a, y, big[1] + b, 0, 0);
      Features.growSapling(w, r, big[0], y, big[1], n, true);
      return;
    }
    if (n === 'dark_oak_sapling') return;
    World.setBlock(x, y, z, 0, 0);
    // no room to grow: put it back
    for (let i = 1; i < 5; i++) { const b = World.getBlock(x, y + i, z); if (b && !BLOCKS[b].replaceable && !BLOCKS[b].name.endsWith('_leaves')) { World.setBlock(x, y, z, id, st); return; } }
    Features.growSapling(w, r, x, y, z, n, false);
  }
  // ---------------------------------------------------------------- right click on a block
  function use(p, hit) {
    const { x, y, z } = hit, id = World.getBlock(x, y, z), st = World.getState(x, y, z), d = BLOCKS[id], n = d.name;
    if (p.spectator) return false;
    const held = p.inv.held;
    if (BlockExtras.use(p, hit, id, st, held)) return true;
    if (id === B.redstone_wire && !p.sneaking && p.gamemode !== 'adventure') return Redstone.useWire(x, y, z, st);
    switch (d.model) {
      case 'door': if (n === 'iron_door') return false; { const by = st & 8 ? y - 1 : y; const bs = World.getState(x, by, z); World.setBlock(x, by, z, id, bs ^ 16); World.setBlock(x, by + 1, z, id, World.getState(x, by + 1, z) ^ 16); Sound.play(bs & 16 ? 'door_close' : 'door_open', null, { x, y, z, iron: false }); return true; }
      case 'trapdoor': if (n === 'iron_trapdoor') return false; World.setBlock(x, y, z, id, st ^ 16); Sound.play(st & 16 ? 'trapdoor_close' : 'trapdoor_open', null, { x, y, z }); return true;
      case 'gate': { let s2 = st ^ 16; if (!(st & 16)) { const L = Place.lookDir(p); if ((st & 7) === OPP[L]) s2 = (s2 & ~7) | L; } World.setBlock(x, y, z, id, s2); Sound.play(st & 16 ? 'gate_close' : 'gate_open', null, { x, y, z }); return true; }
      case 'lever': World.setBlock(x, y, z, id, st ^ 32); Sound.play('click', null, { x, y, z, on: !(st & 32) }); Redstone.update(x, y, z); Redstone.updateAttached(x, y, z, st); return true;
      case 'button': if (st & 32) return true; World.setBlock(x, y, z, id, st | 32); Ticks.schedule(x, y, z, n.includes('stone') || n.includes('blackstone') ? 20 : 30); Sound.play('click', null, { x, y, z, on: true }); Redstone.update(x, y, z); Redstone.updateAttached(x, y, z, st); return true;
      case 'repeater': World.setBlock(x, y, z, id, (st & ~24) | ((((st >> 3) & 3) + 1) & 3) << 3); Sound.play('click', null, { x, y, z, on: true }); return true;
      case 'comparator': World.setBlock(x, y, z, id, st ^ 8); Sound.play('click', null, { x, y, z, on: !(st & 8) }); Redstone.update(x, y, z); return true;
      case 'daylight': World.setBlock(x, y, z, id, st ^ 16); Redstone.update(x, y, z); return true;
      case 'bed': return Beds.use(p, x, y, z, st);
      case 'cake': {
        if (p.food >= 20 && !p.creative) return false;
        p.eat(2, 0.1); Sound.play('eat', p);
        if ((st & 7) >= 6) World.setBlock(x, y, z, 0, 0); else World.setBlock(x, y, z, id, st + 1);
        return true;
      }
      case 'chest': case 'cube': case 'hopper': case 'brewing': case 'ench': case 'anvil': case 'grindstone': case 'stonecutter': case 'lectern': case 'composter': case 'cauldron': case 'campfire': case 'pot': case 'bell': case 'frame': case 'beacon': case 'wall_sign': case 'sign': case 'crop': case 'cross': case 'stem_attached': break;
    }
    return BlockUse.use(p, hit, id, st, d, held);
  }
  function onAttack(p, x, y, z) {
    const id = World.getBlock(x, y, z), n = BLOCKS[id].name;
    if (n === 'note_block') Redstone.playNote(x, y, z);
    if (n === 'redstone_ore' || n === 'deepslate_redstone_ore') World.setBlock(x, y, z, id, 1);
    if (n === 'dragon_egg' && !p.creative) { DragonEgg.teleport(x, y, z); return; }
    // fire on top of a block is put out by hitting it
    if (World.getBlock(x, y + 1, z) === B.fire && Interact.target && Interact.target.face === 1) { World.setBlock(x, y + 1, z, 0, 0); Sound.play('extinguish', null, { x, y, z }); }
  }
  return { remove, onPlaced, updateAround, neighborChanged, scheduledTick, randomTick, use, onAttack, newBE, growthChance, growSapling, waterNear };
})();

/* Falling blocks: sand, gravel, concrete powder, anvils, dragon eggs and pointed dripstone fall as entities. */
const Falling = (() => {
  function check(x, y, z, id, st) {
    if (y <= MINY) return;
    const below = World.getBlock(x, y - 1, z);
    if (!(below === 0 || BLOCKS[below].fluid || BLOCKS[below].name === 'fire' || (BLOCKS[below].replaceable && !SOLID[below]))) return;
    World.setBlock(x, y, z, 0, 0);
    Entities.add(new FallingBlock(x + 0.5, y, z + 0.5, id, st));
  }
  return { check };
})();
class FallingBlock extends Entity {
  constructor(x, y, z, id, st) { super('falling_block', x, y, z); this.block = id; this.state = st; this.w = 0.98; this.h = 0.98; this.stepHeight = 0; this.time = 0; this.noPick = true; }
  tick() {
    this.tickBase(); this.time++;
    this.vy -= 0.04; Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
    const bx = Math.floor(this.x), by = Math.floor(this.y + 0.001), bz = Math.floor(this.z), d = BLOCKS[this.block];
    // concrete powder hardens in water
    if (d.name.endsWith('_concrete_powder') && this.inWater) { World.setBlock(bx, by, bz, BID[d.name.replace('_powder', '')], 0); this.removed = true; return; }
    // anvils hurt what they land on
    if (d.model === 'anvil' && this.vy < -0.1) for (const e of Entities.list.concat([Game.player])) if (e && e.living && e.intersects(this.bb())) e.hurt(Math.min(40, Math.ceil(this.fallDist * 2) || 2), 'anvil');
    this.fallDist = (this.fallDist || 0) + Math.max(0, -this.vy);
    if (this.onGround) {
      this.removed = true;
      const cur = World.getBlock(bx, by, bz);
      if (cur === 0 || BLOCKS[cur].replaceable || BLOCKS[cur].fluid) {
        let st = this.state;
        if (d.model === 'anvil' && this.fallDist > 1 && Math.random() < 0.05 + this.fallDist * 0.05) { const next = { anvil: 'chipped_anvil', chipped_anvil: 'damaged_anvil', damaged_anvil: null }[d.name]; if (!next) { Sound.play('anvil_destroy', this); return; } this.block = BID[next]; }
        World.setBlock(bx, by, bz, this.block, st);
        Blocks.updateAround(bx, by, bz);
        if (d.model === 'anvil') Sound.play('anvil_land', this);
      } else if (Game.rules.doTileDrops) Drops.dropBlock(this.block, this.state, null, bx, by, bz);
    }
    if (this.time > 600 || this.y < MINY - 64) this.removed = true;
  }
}
