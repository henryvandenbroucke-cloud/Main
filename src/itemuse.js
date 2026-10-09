'use strict';
/* Using items: eating and drinking (32 ticks), bows (charge up to 20 ticks), crossbows (25 ticks), tridents,
   shields, throwing, buckets, bone meal, hoes, shovels and axes on blocks, flint and steel, spawn eggs,
   minecarts and boats, armour, maps, and dropping items. */
const ItemUse = (() => {
  const B = BID;
  const consume = p => BlockUse.consume(p);
  const swapHeld = (p, s, offhand) => { if (offhand) p.inv.set(40, s); else p.inv.held = s; };
  // replace one of the held stack with another item (filling buckets and bottles)
  function exchange(p, offhand, newStack) {
    if (p.creative) { if (p.inv.find(s => sameItem(s, newStack)) < 0) p.inv.addItem(newStack); return; }
    const s = offhand ? p.inv.offhand : p.inv.held;
    if (s.count === 1) { swapHeld(p, newStack, offhand); return; }
    s.count--; p.inv.changed();
    const left = p.inv.addItem(newStack); if (left) drop(p, left);
  }
  function drop(p, s, far) {
    if (!s) return;
    const e = Drops.spawnItem(p.x, p.eyeY - 0.3, p.z, s);
    const lv = p.lookVec(), sp = 0.3;
    e.vx = lv[0] * sp + (Math.random() - 0.5) * 0.04; e.vy = lv[1] * sp + 0.1; e.vz = lv[2] * sp + (Math.random() - 0.5) * 0.04;
    e.pickupDelay = 40; e.thrower = p;
    Stats.add('dropped', ITEMS[s.id].name);
  }
  // ---------------------------------------------------------------- on a block
  function onBlock(p, s, hit, offhand) {
    const it = ITEMS[s.id], n = it.name, { x, y, z } = hit, id = World.getBlock(x, y, z), st = World.getState(x, y, z), d = BLOCKS[id];
    const up = World.getBlock(x, y + 1, z);
    if (p.gamemode === 'adventure' && it.block >= 0) return false;
    // a brush sweeps whatever block it is used on (see Archaeology)
    if (n === 'brush') { startUse(p, s, offhand, 200); return true; }
    // hoe: till dirt into farmland
    if (it.tool && it.tool.kind === 'hoe' && hit.face !== 0 && (up === 0 || BLOCKS[up].replaceable && !BLOCKS[up].fluid)) {
      const to = { grass_block: B.farmland, dirt: B.farmland, dirt_path: B.farmland, coarse_dirt: B.dirt, rooted_dirt: B.dirt }[d.name];
      if (to !== undefined && (d.name !== 'dirt' || st === 0)) { if (up) World.setBlock(x, y + 1, z, 0, 0); World.setBlock(x, y, z, to, 0); if (d.name === 'rooted_dirt') Drops.spawnItem(x + 0.5, y + 1, z + 0.5, stack('hanging_roots')); Sound.play('hoe_till', null, { x, y, z }); p.swingArm(); p.inv.damageHeld(1, p); return true; }
    }
    // shovel: dirt path; put out campfires
    if (it.tool && it.tool.kind === 'shovel') {
      if (['grass_block', 'dirt', 'podzol', 'mycelium', 'coarse_dirt', 'rooted_dirt'].includes(d.name) && hit.face !== 0 && up === 0) { World.setBlock(x, y, z, B.dirt_path, 0); Sound.play('shovel_flatten', null, { x, y, z }); p.swingArm(); p.inv.damageHeld(1, p); return true; }
      if ((d.name === 'campfire' || d.name === 'soul_campfire') && !(st & 8)) { World.setBlock(x, y, z, id, st | 8); Sound.play('extinguish', null, { x, y, z }); p.swingArm(); return true; }
    }
    // axe: strip logs and wood
    if (it.tool && it.tool.kind === 'axe') {
      const m = d.name.match(/^(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|crimson|warped)_(log|wood|stem|hyphae)$/) || (d.name === 'bamboo_block' ? [0, 'bamboo', 'block'] : null);
      if (m) { const to = B['stripped_' + d.name]; if (to !== undefined) { World.setBlock(x, y, z, to, st); Sound.play('axe_strip', null, { x, y, z }); p.swingArm(); p.inv.damageHeld(1, p); return true; } }
      if (BlockExtras.axe(p, x, y, z, id, st)) return true;
    }
    switch (n) {
      case 'honeycomb': if (BlockExtras.wax(p, x, y, z, id, st)) { if (!p.creative) { s.count--; if (!s.count) swapHeld(p, null, offhand); p.inv.changed(); } p.swingArm(); return true; } break;
      case 'bone_meal': if (boneMeal(x, y, z, p)) { if (!p.creative) { s.count--; if (!s.count) swapHeld(p, null, offhand); p.inv.changed(); } p.swingArm(); return true; } break;
      case 'flint_and_steel': case 'fire_charge': {
        if (d.name === 'tnt') return false; // BlockUse handles it
        if ((d.name === 'campfire' || d.name === 'soul_campfire') && (st & 8)) { World.setBlock(x, y, z, id, st & ~8); fireUsed(p, n, offhand); return true; }
        if (BlockExtras.light(x, y, z, id, st)) { fireUsed(p, n, offhand); return true; }
        const fx = x + DX[hit.face], fy = y + DY[hit.face], fz = z + DZ[hit.face];
        if (World.getBlock(fx, fy, fz) === 0) {
          const below = World.getBlock(fx, fy - 1, fz);
          const fire = below === B.soul_sand || below === B.soul_soil ? B.soul_fire : B.fire;
          World.setBlock(fx, fy, fz, fire, 0);
          Portals.tryLight(fx, fy, fz);
          if (World.getBlock(fx, fy, fz) === fire && !Place.canSurvive(fire, 0, fx, fy, fz)) World.setBlock(fx, fy, fz, 0, 0);
          fireUsed(p, n, offhand);
          return true;
        }
        return false;
      }
      case 'water_bucket': case 'lava_bucket': case 'powder_snow_bucket': case 'cod_bucket': case 'salmon_bucket': case 'tropical_fish_bucket': case 'pufferfish_bucket': case 'axolotl_bucket': case 'tadpole_bucket': {
        const fluid = n === 'lava_bucket' ? B.lava : n === 'powder_snow_bucket' ? B.powder_snow : B.water;
        // waterlog a block that takes water
        if (fluid === B.water && d.waterlog && !(st & 128)) { World.setBlock(x, y, z, id, st | 128); Ticks.schedule(x, y, z, 5); emptied(p, offhand, n); return true; }
        let tx = x, ty = y, tz = z;
        if (!d.replaceable) { tx += DX[hit.face]; ty += DY[hit.face]; tz += DZ[hit.face]; }
        const t = World.getBlock(tx, ty, tz), td = BLOCKS[t];
        if (fluid === B.water && td.waterlog && !(World.getState(tx, ty, tz) & 128)) { World.setBlock(tx, ty, tz, t, World.getState(tx, ty, tz) | 128); emptied(p, offhand, n); return true; }
        if (!(t === 0 || td.replaceable || td.fluid)) return false;
        if (fluid === B.water && World.dim === 'nether') { Sound.play('fizz', null, { x: tx, y: ty, z: tz }); Particles.smoke(tx + 0.5, ty + 0.5, tz + 0.5, 8); emptied(p, offhand, n); return true; }
        if (t && !td.fluid && Game.rules.doTileDrops) Drops.dropBlock(t, World.getState(tx, ty, tz), null, tx, ty, tz);
        World.setBlock(tx, ty, tz, fluid, 0);
        if (fluid !== B.powder_snow) Ticks.schedule(tx, ty, tz, 1);
        Sound.play(fluid === B.lava ? 'bucket_empty_lava' : 'bucket_empty', null, { x: tx, y: ty, z: tz });
        if (n.endsWith('_bucket') && !['water_bucket', 'lava_bucket', 'powder_snow_bucket'].includes(n)) Mobs.spawn(n.replace('_bucket', ''), tx + 0.5, ty, tz + 0.5);
        emptied(p, offhand, n);
        return true;
      }
      case 'bucket': return false; // handled in the air (it needs to see fluids)
      case 'glass_bottle': return false;
      case 'minecart': case 'chest_minecart': case 'hopper_minecart': case 'tnt_minecart': case 'furnace_minecart':
        if (BLOCKS[id].model === 'rail') { Vehicles.spawnMinecart(n, x + 0.5, y + 0.0625, z + 0.5); consumeFrom(p, offhand); return true; }
        return false;
      case 'armor_stand': { const fx = x + DX[hit.face], fy = y + DY[hit.face], fz = z + DZ[hit.face]; if (hit.face === 1 && World.getBlock(fx, fy, fz) === 0 && World.getBlock(fx, fy + 1, fz) === 0) { Decor.armorStand(fx + 0.5, fy, fz + 0.5, p.yaw + Math.PI); consumeFrom(p, offhand); return true; } return false; }
      case 'painting': case 'item_frame': case 'glow_item_frame': if (hit.face >= 0) { if (Decor.hang(n, x, y, z, hit.face, p)) { consumeFrom(p, offhand); return true; } } return false;
      case 'end_crystal': if ((d.name === 'obsidian' || d.name === 'bedrock') && World.getBlock(x, y + 1, z) === 0 && World.getBlock(x, y + 2, z) === 0) { Entities.add(new EndCrystal(x + 0.5, y + 1, z + 0.5, false)); consumeFrom(p, offhand); return true; } return false;
      case 'firework_rocket': { Projectiles.firework(x + 0.5 + DX[hit.face] * 0.5, y + 0.5 + DY[hit.face] * 0.5, z + 0.5 + DZ[hit.face] * 0.5, s.tag, null); consumeFrom(p, offhand); return true; }
      case 'ender_eye': return false;
      case 'lead': if (d.model === 'fence') return Leads.tieToFence(p, x, y, z); return false;
    }
    if (n.endsWith('_spawn_egg')) {
      if (d.name === 'spawner') { const be = World.getBE(x, y, z) || Blocks.newBE('spawner'); be.mob = it.mob; World.setBE(x, y, z, be); consumeFrom(p, offhand); return true; }
      if (d.name === 'trial_spawner') { const be = World.getBE(x, y, z) || Blocks.newBE('trial_spawner'); be.customMob = it.mob; World.setBE(x, y, z, be); consumeFrom(p, offhand); return true; }
      let fx = x + DX[hit.face], fy = y + DY[hit.face], fz = z + DZ[hit.face];
      if (d.replaceable) { fx = x; fy = y; fz = z; }
      const m = Mobs.spawn(it.mob, fx + 0.5, fy, fz + 0.5, { fromEgg: true, name: s.tag && s.tag.name });
      if (m) { consumeFrom(p, offhand); return true; }
      return false;
    }
    if (n.endsWith('_boat') || n.endsWith('_raft')) { if (Vehicles.spawnBoat(n, hit.px, hit.py, hit.pz, p.yaw)) { consumeFrom(p, offhand); return true; } return false; }
    if (it.block >= 0) return Place.tryPlace(p, s, hit, offhand);
    return false;
  }
  function fireUsed(p, n, offhand) { Sound.play(n === 'fire_charge' ? 'fire_charge' : 'flint_and_steel', p); p.swingArm(); if (n === 'flint_and_steel') { if (offhand) damageItem(p.inv.offhand, 1, p, () => p.inv.set(40, null)); else p.inv.damageHeld(1, p); } else consumeFrom(p, offhand); }
  function emptied(p, offhand, n) { p.swingArm(); if (!p.creative) swapHeld(p, stack('bucket'), offhand); }
  function consumeFrom(p, offhand) { if (p.creative) { p.swingArm(); return; } const s = offhand ? p.inv.offhand : p.inv.held; s.count--; if (s.count <= 0) swapHeld(p, null, offhand); p.inv.changed(); p.swingArm(); }
  // ---------------------------------------------------------------- bone meal
  function boneMeal(x, y, z, p) {
    const id = World.getBlock(x, y, z), st = World.getState(x, y, z), d = BLOCKS[id], n = d.name;
    let ok = false;
    if (BlockExtras.boneMeal(x, y, z)) ok = true;
    else if (['wheat', 'carrots', 'potatoes', 'beetroots', 'pumpkin_stem', 'melon_stem'].includes(n)) {
      const max = n === 'beetroots' ? 3 : 7, age = st & 7;
      if (age < max) { World.setBlock(x, y, z, id, Math.min(max, age + (n === 'beetroots' ? (Math.random() < 0.75 ? 1 : 0) || 1 : 2 + Math.floor(Math.random() * 4)))); ok = true; }
      else if (n.endsWith('_stem')) { Blocks.randomTick(x, y, z, id, st); ok = true; }
    } else if (n.endsWith('_sapling') || n === 'mangrove_propagule' || n === 'azalea' || n === 'flowering_azalea') {
      ok = true; if (Math.random() < 0.45) { if (n.includes('azalea')) { const w = { get: World.getBlock.bind(World), set: (a, b, c, i, s2) => World.setBlock(a, b, c, i, s2) }; World.setBlock(x, y, z, 0, 0); Features.azaleaTree(w, new Rand(Math.random() * 1e9 | 0), x, y, z); } else Blocks.growSapling(x, y, z, id, st | 1); }
    } else if (n === 'grass_block') {
      ok = true;
      for (let i = 0; i < 64; i++) {
        let tx = x, ty = y + 1, tz = z; let good = true;
        for (let j = 0; j < i / 16; j++) { tx += Math.floor(Math.random() * 3) - 1; ty += Math.floor((Math.random() * 3 - 1) * Math.random() * 3 / 2); tz += Math.floor(Math.random() * 3) - 1; if (World.getBlock(tx, ty - 1, tz) !== B.grass_block || OPAQUE[World.getBlock(tx, ty, tz)]) { good = false; break; } }
        if (!good || World.getBlock(tx, ty, tz) !== 0) continue;
        if (Math.random() < 0.125) { const bio = BIOMES[World.biomeAt(tx, tz)].name; const f = bio === 'flower_forest' ? [B.dandelion, B.poppy, B.allium, B.azure_bluet, B.red_tulip, B.oxeye_daisy, B.cornflower, B.lily_of_the_valley][Math.random() * 8 | 0] : bio === 'swamp' ? B.blue_orchid : (Math.random() < 0.66 ? B.dandelion : B.poppy); World.setBlock(tx, ty, tz, f, 0); }
        else World.setBlock(tx, ty, tz, B.short_grass, 0);
      }
    } else if (['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley'].includes(n)) { ok = true; }
    else if (d.model === 'tall' && ['sunflower', 'lilac', 'rose_bush', 'peony'].includes(n)) { Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack(n)); ok = true; }
    else if (n === 'short_grass' || n === 'fern') { if (World.getBlock(x, y + 1, z) === 0) { const t = n === 'fern' ? B.large_fern : B.tall_grass; World.setBlock(x, y, z, t, 0); World.setBlock(x, y + 1, z, t, 8); ok = true; } }
    else if (n === 'sweet_berry_bush' && (st & 3) < 3) { World.setBlock(x, y, z, id, st + 1); ok = true; }
    else if (n === 'cocoa' && ((st >> 3) & 3) < 2) { World.setBlock(x, y, z, id, st + 8); ok = true; }
    else if (n === 'brown_mushroom' || n === 'red_mushroom') { ok = true; if (Math.random() < 0.4) { const w = { get: World.getBlock.bind(World), set: (a, b, c, i, s2) => { const cur = World.getBlock(a, b, c); if (cur === 0 || BLOCKS[cur].replaceable || (a === x && b === y && c === z)) World.setBlock(a, b, c, i, s2); } }; World.setBlock(x, y, z, 0, 0); Features.hugeMushroom(w, new Rand(Math.random() * 1e9 | 0), x, y, z, n === 'red_mushroom'); } }
    else if (n === 'bamboo') { let ty = y; while (World.getBlock(x, ty + 1, z) === id) ty++; if (World.getBlock(x, ty + 1, z) === 0) { World.setBlock(x, ty + 1, z, id, 2 << 1); ok = true; } }
    else if (n === 'sugar_cane' || n === 'cactus') return false;
    else if (n === 'moss_block') { ok = true; for (let i = 0; i < 20; i++) { const tx = x + Math.floor(Math.random() * 7) - 3, tz = z + Math.floor(Math.random() * 7) - 3; for (let ty = y + 2; ty >= y - 2; ty--) { const b = World.getBlock(tx, ty, tz); if (['stone', 'dirt', 'grass_block', 'deepslate', 'tuff', 'granite', 'diorite', 'andesite'].includes(BLOCKS[b].name) && World.getBlock(tx, ty + 1, tz) === 0) { World.setBlock(tx, ty, tz, B.moss_block, 0); break; } } } }
    else if (n === 'crimson_nylium' || n === 'warped_nylium') { ok = true; for (let i = 0; i < 24; i++) { const tx = x + Math.floor(Math.random() * 7) - 3, tz = z + Math.floor(Math.random() * 7) - 3; if (World.getBlock(tx, y, tz) === id && World.getBlock(tx, y + 1, tz) === 0) World.setBlock(tx, y + 1, tz, n === 'crimson_nylium' ? (Math.random() < 0.8 ? B.crimson_roots : B.crimson_fungus) : (Math.random() < 0.7 ? B.warped_roots : Math.random() < 0.5 ? B.nether_sprouts : B.warped_fungus), 0); } }
    else if (n === 'kelp' || n === 'seagrass') { if (n === 'seagrass' && World.getBlock(x, y + 1, z) === B.water) { World.setBlock(x, y, z, B.tall_seagrass, 0); World.setBlock(x, y + 1, z, B.tall_seagrass, 8); ok = true; } else if (n === 'kelp') { Blocks.randomTick(x, y, z, id, st); ok = true; } }
    else if (n === 'cave_vines' || n === 'cave_vines_plant') { if (!(st & 8)) { World.setBlock(x, y, z, id, st | 8); ok = true; } }
    if (ok) { Particles.happy && Particles.happy(x, y, z); Sound.play('bone_meal', null, { x, y, z }); }
    return ok;
  }
  // ---------------------------------------------------------------- in the air
  function inAir(p, s, offhand) {
    const it = ITEMS[s.id], n = it.name;
    // a boat used while looking at water goes on the water's surface
    if (n.endsWith('_boat') || n.endsWith('_raft')) {
      const lv = p.lookVec(), h = Phys.raycast(p.x, p.eyeY, p.z, lv[0], lv[1], lv[2], 5, id => BLOCKS[id].fluid === 'water' || SOLID[id]);
      if (h && BLOCKS[h.id].fluid === 'water' && Vehicles.spawnBoat(n, h.px, h.y + 0.5, h.pz, p.yaw)) { consumeFrom(p, offhand); return true; }
      return false;
    }
    if (p.useCooldown && p.useCooldown[n] > Game.gameTime) return false;
    if (it.food) {
      if (p.food >= 20 && !it.alwaysEat && !p.creative) return false;
      startUse(p, s, offhand, n === 'dried_kelp' ? 16 : 32); return true;
    }
    switch (n) {
      case 'potion': case 'milk_bucket': case 'honey_bottle': case 'ominous_bottle': startUse(p, s, offhand, n === 'honey_bottle' ? 40 : 32); return true;
      case 'bow': if (p.creative || p.inv.find(x => ['arrow', 'spectral_arrow', 'tipped_arrow'].includes(ITEMS[x.id].name)) >= 0 || enchLevel(s, 'infinity')) { startUse(p, s, offhand, 72000); return true; } return false;
      case 'crossbow': if (s.tag && s.tag.charged) { Projectiles.crossbow(p, s); s.tag.charged = null; p.inv.changed(); return true; } if (p.creative || p.inv.find(x => ['arrow', 'spectral_arrow', 'tipped_arrow', 'firework_rocket'].includes(ITEMS[x.id].name)) >= 0) { startUse(p, s, offhand, 72000); return true; } return false;
      case 'trident': if (s.dmg >= it.dur - 1) return false; startUse(p, s, offhand, 72000); return true;
      case 'shield': if (p.shieldCooldown > 0) return false; startUse(p, s, offhand, 72000); return true;
      case 'spyglass': startUse(p, s, offhand, 1200); Sound.play('spyglass', p); return true;
      case 'goat_horn': Sound.play('goat_horn', p); cooldown(p, n, 140); return true;
      case 'snowball': case 'egg': case 'ender_pearl': case 'splash_potion': case 'lingering_potion': case 'experience_bottle': case 'wind_charge':
        Projectiles.throwItem(p, s); if (n === 'ender_pearl') cooldown(p, n, 20); if (n === 'wind_charge') cooldown(p, n, 10); consumeFrom(p, offhand); Stats.add('used', n); return true;
      case 'ender_eye': { const t = Structures.nearestStronghold ? Structures.nearestStronghold(p.x, p.z) : null; if (!t || World.dim !== 'overworld') return false; Projectiles.eyeOfEnder(p, t); consumeFrom(p, offhand); return true; }
      case 'bucket': {
        const lv = p.lookVec();
        const hit = Phys.raycast(p.x, p.eyeY, p.z, lv[0], lv[1], lv[2], Interact.reach(p), (id, x, y, z) => { const d = BLOCKS[id]; return (d.fluid && (World.getState(x, y, z) & 15) === 0) || (d.waterlog && (World.getState(x, y, z) & 128)) || id === BID.powder_snow || SOLID[id]; });
        if (!hit) return false;
        const d = BLOCKS[hit.id];
        if (d.fluid) { World.setBlock(hit.x, hit.y, hit.z, 0, 0); Blocks.updateAround(hit.x, hit.y, hit.z); exchange(p, offhand, stack(d.fluid === 'water' ? 'water_bucket' : 'lava_bucket')); Sound.play(d.fluid === 'lava' ? 'bucket_fill_lava' : 'bucket_fill', p); p.swingArm(); return true; }
        if (d.waterlog && (hit.state & 128)) { World.setBlock(hit.x, hit.y, hit.z, hit.id, hit.state & ~128); exchange(p, offhand, stack('water_bucket')); Sound.play('bucket_fill', p); return true; }
        if (hit.id === BID.powder_snow) { World.setBlock(hit.x, hit.y, hit.z, 0, 0); exchange(p, offhand, stack('powder_snow_bucket')); return true; }
        return false;
      }
      case 'glass_bottle': {
        const lv = p.lookVec();
        const hit = Phys.raycast(p.x, p.eyeY, p.z, lv[0], lv[1], lv[2], Interact.reach(p), id => BLOCKS[id].fluid === 'water' || SOLID[id]);
        if (hit && BLOCKS[hit.id].fluid === 'water') { exchange(p, offhand, stack('potion', 1, { tag: { potion: 'water' } })); Sound.play('bottle_fill', p); return true; }
        // dragon's breath from the dragon's breath cloud
        if (typeof Clouds2 !== 'undefined' && Clouds2.breathAt(p)) { exchange(p, offhand, stack('dragon_breath')); return true; }
        return false;
      }
      case 'water_bucket': case 'lava_bucket': {
        const lv = p.lookVec();
        const hit = Phys.raycast(p.x, p.eyeY, p.z, lv[0], lv[1], lv[2], Interact.reach(p), id => !BLOCKS[id].replaceable || BLOCKS[id].fluid);
        if (hit) return onBlock(p, s, hit, offhand);
        return false;
      }
      case 'fishing_rod': Fishing.use(p, s); p.swingArm(); return true;
      case 'firework_rocket': if (p.gliding) { Projectiles.firework(p.x, p.y, p.z, s.tag, p); consumeFrom(p, offhand); return true; } return false;
      case 'map': { const m = stack('filled_map', 1, { tag: { map: Maps.create(p) } }); exchange(p, offhand, m); return true; }
      case 'writable_book': case 'written_book': if (typeof Books !== 'undefined') { Books.open(p, s); return true; } return false;
      case 'carrot_on_a_stick': case 'warped_fungus_on_a_stick': if (Vehicles.useStick(p, s)) { p.inv.changed(); return true; } return false;
    }
    // right click with armour puts it on
    if (it.armor) {
      const slot = 36 + it.armor.slot, cur = p.inv.get(slot);
      if (cur && enchLevel(cur, 'binding_curse') && !p.creative) return false;
      p.inv.set(slot, Object.assign({}, s, { count: 1 }));
      if (s.count > 1) { s.count--; p.inv.changed(); const l = cur ? p.inv.addItem(cur) : null; if (l) drop(p, l); }
      else swapHeld(p, cur, offhand);
      p.updateArmor(); Sound.play('equip', p, { mat: it.armor.mat }); p.swingArm();
      return true;
    }
    return false;
  }
  function cooldown(p, n, t) { p.useCooldown = p.useCooldown || {}; p.useCooldown[n] = Game.gameTime + t; HUD.cooldown && HUD.cooldown(n, t); }
  function startUse(p, s, offhand, max) { p.using = s; p.useOff = !!offhand; p.useTicks = 0; p.useMax = max; p.sprinting = false; }
  // called every tick while right click is held
  function tickUse(p) {
    const s = p.using; if (!s) return;
    const cur = p.useOff ? p.inv.offhand : p.inv.held;
    if (cur !== s) { p.using = null; return; }
    p.useTicks++;
    const it = ITEMS[s.id], n = it.name;
    if ((it.food || n === 'potion' || n === 'milk_bucket' || n === 'honey_bottle' || n === 'ominous_bottle') && p.useTicks % 4 === 0 && p.useTicks > 7) { Sound.play(it.food ? 'eat' : 'drink', p); if (it.food) Particles.eat && Particles.eat(p, s); }
    if (n === 'crossbow' && p.useTicks === Math.max(5, 25 - 5 * enchLevel(s, 'quick_charge'))) { Sound.play('crossbow_loaded', p); }
    if (n === 'brush') { Archaeology.brushTick(p, s); if (!p.using) return; }
    if (p.useTicks >= p.useMax) finishUse(p);
  }
  function finishUse(p) {
    const s = p.using, it = ITEMS[s.id], n = it.name;
    p.using = null;
    if (it.food) {
      p.eat(it.food[0], it.food[1] / Math.max(1, it.food[0]) / 2);
      for (const f of it.foodFx || []) { if (f[0] === 'clear') { p.removeEffect(f[1]); continue; } if (Math.random() < (f[3] === undefined ? 1 : f[3])) p.addEffect(f[0], f[1], f[2]); }
      if (n === 'suspicious_stew' && s.tag && s.tag.effect) p.addEffect(s.tag.effect, s.tag.dur || 160, 0);
      if (n === 'chorus_fruit') chorusTeleport(p);
      Sound.play('burp', p);
      Stats.add('used', n); Advancements.onEat && Advancements.onEat(n);
      if (!p.creative) { s.count--; if (s.count <= 0) swapHeld(p, it.leftover ? stack(it.leftover) : null, p.useOff); else if (it.leftover) { const l = p.inv.addItem(stack(it.leftover)); if (l) drop(p, l); } p.inv.changed(); }
      if (n === 'chorus_fruit') cooldown(p, n, 20);
      return;
    }
    if (n === 'milk_bucket') { p.effects.clear(); p.maxHealth = 20; p.absorption = 0; if (!p.creative) swapHeld(p, stack('bucket'), p.useOff); return; }
    if (n === 'honey_bottle') { p.eat(6, 0.1); p.removeEffect('poison'); if (!p.creative) swapHeld(p, s.count > 1 ? Object.assign(s, { count: s.count - 1 }) : stack('glass_bottle'), p.useOff); return; }
    if (n === 'potion') { Potions.apply(p, s.tag && s.tag.potion, 1); if (!p.creative) swapHeld(p, stack('glass_bottle'), p.useOff); return; }
    // an ominous bottle: Bad Omen for 100 minutes, its level from the bottle; the bottle is used up
    if (n === 'ominous_bottle') { p.addEffect('bad_omen', 120000, (s.tag && s.tag.amp) || 0); Sound.play('ominous_bottle_dispose', p); if (!p.creative) { s.count--; if (s.count <= 0) swapHeld(p, null, p.useOff); p.inv.changed(); } return; }
  }
  // releasing right click: bows shoot, crossbows finish charging, tridents are thrown
  function release(p) {
    const s = p.using; if (!s) return;
    const it = ITEMS[s.id], n = it.name;
    const t = p.useTicks;
    p.using = null;
    if (n === 'bow') {
      let f = t / 20; f = (f * f + f * 2) / 3; if (f > 1) f = 1;
      if (f < 0.1) return;
      Projectiles.bow(p, s, f);
    } else if (n === 'crossbow') {
      if (t >= Math.max(5, 25 - 5 * enchLevel(s, 'quick_charge'))) { const ammo = Projectiles.takeAmmo(p, true); if (ammo) { s.tag = Object.assign({}, s.tag, { charged: ammo }); p.inv.changed(); } }
    } else if (n === 'trident') {
      if (t >= 10) { const rip = enchLevel(s, 'riptide'); if (rip) { if (p.inWater || Weather.rainingAt(p.x, p.y, p.z)) { const lv = p.lookVec(), k = 3 * (1 + rip) / 4; p.vx += lv[0] * k; p.vy += lv[1] * k; p.vz += lv[2] * k; p.riptide = 20; damageItem(s, 1, p, () => swapHeld(p, null, p.useOff)); Sound.play('trident_riptide', p); } } else Projectiles.trident(p, s, p.useOff); }
    }
  }
  function chorusTeleport(p) {
    for (let i = 0; i < 16; i++) {
      const x = p.x + (Math.random() - 0.5) * 16, z = p.z + (Math.random() - 0.5) * 16; let y = Math.floor(p.y + (Math.random() - 0.5) * 16);
      y = Math.max(MINY, Math.min(MAXY - 2, y));
      while (y > MINY && !SOLID[World.getBlock(Math.floor(x), y - 1, Math.floor(z))]) y--;
      if (Phys.boxFree(x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3) && SOLID[World.getBlock(Math.floor(x), y - 1, Math.floor(z))]) { p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.fallDistance = 0; Sound.play('teleport', p); return; }
    }
  }
  return { onBlock, inAir, tickUse, release, drop, boneMeal, consumeFrom, exchange };
})();

/* Cauldrons hold water (3 levels), lava or powder snow; buckets and bottles fill and empty them, they wash
   dye off leather armour and shulker boxes, and rain slowly fills them. */
const Cauldron = (() => {
  function use(p, x, y, z, st, s) {
    const lvl = st & 3, kind = (st >> 2) & 3, n = s ? ITEMS[s.id].name : '', id = BID.cauldron;
    const set = (l, k) => World.setBlock(x, y, z, id, (l & 3) | ((k || 0) << 2));
    if (n === 'water_bucket') { set(3, 0); ItemUse.exchange(p, false, stack('bucket')); Sound.play('bucket_empty', p); return true; }
    if (n === 'lava_bucket') { set(0, 1); World.setBlock(x, y, z, id, 1 << 2); ItemUse.exchange(p, false, stack('bucket')); Sound.play('bucket_empty_lava', p); return true; }
    if (n === 'powder_snow_bucket') { set(3, 2); ItemUse.exchange(p, false, stack('bucket')); return true; }
    if (n === 'bucket') {
      if (kind === 1) { set(0, 0); ItemUse.exchange(p, false, stack('lava_bucket')); Sound.play('bucket_fill_lava', p); return true; }
      if (lvl === 3) { set(0, 0); ItemUse.exchange(p, false, stack(kind === 2 ? 'powder_snow_bucket' : 'water_bucket')); Sound.play('bucket_fill', p); return true; }
      return false;
    }
    if (n === 'glass_bottle' && kind === 0 && lvl > 0) { set(lvl - 1, 0); ItemUse.exchange(p, false, stack('potion', 1, { tag: { potion: 'water' } })); Sound.play('bottle_fill', p); return true; }
    if (n === 'potion' && s.tag && s.tag.potion === 'water' && kind === 0 && lvl < 3) { set(lvl + 1, 0); ItemUse.exchange(p, false, stack('glass_bottle')); Sound.play('bottle_empty', p); return true; }
    if (kind === 0 && lvl > 0 && s && s.tag && s.tag.color && ITEMS[s.id].armor && ITEMS[s.id].armor.mat === 'leather') { delete s.tag.color; set(lvl - 1, 0); p.inv.changed(); return true; }
    if (kind === 0 && lvl > 0 && n.endsWith('_shulker_box') && n !== 'shulker_box') { const ns = Object.assign({}, s, { id: IID.shulker_box }); p.inv.held = ns; set(lvl - 1, 0); return true; }
    return false;
  }
  return { use };
})();
