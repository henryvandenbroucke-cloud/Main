'use strict';
/* Block entities that work over time: furnaces (200 ticks per item; blast furnaces and smokers 100 and half
   the fuel), brewing stands, hoppers, campfires, beacons, monster spawners and jukeboxes. */
const BlockEntities = (() => {
  function tick() {
    for (const c of World.chunks.values()) {
      if (!c.be.size) continue;
      for (const be of c.be.values()) {
        switch (be.type) {
          case 'furnace': furnace(be); break;
          case 'brewing': if (typeof Brewing !== 'undefined') Brewing.tick(be); break;
          case 'hopper': if (typeof Hoppers !== 'undefined') Hoppers.tick(be); break;
          case 'campfire': campfire(be); break;
          case 'beacon': if (typeof Beacons !== 'undefined') Beacons.tick(be); break;
          case 'spawner': if (typeof Spawners !== 'undefined') Spawners.tick(be); break;
          case 'comparator': Redstone.comparatorPoll(be); break;
          case 'daylight': Redstone.daylightTick(be); break;
        }
      }
    }
  }
  function furnace(be) {
    const id = World.getBlock(be.x, be.y, be.z), name = BLOCKS[id].name;
    if (name !== 'furnace' && name !== 'blast_furnace' && name !== 'smoker') return;
    const kind = name === 'furnace' ? 'f' : name === 'blast_furnace' ? 'b' : 's', fast = kind !== 'f';
    const it = be.items;
    const was = be.burn > 0;
    if (be.burn > 0) be.burn--;
    const r = Smelting.find(it[0], kind);
    const outId = r ? IID[r.out] : -1;
    const can = r && (!it[2] || (it[2].id === outId && it[2].count < maxStack(it[2])));
    if (be.burn === 0 && can && it[1] && ITEMS[it[1].id].fuel) {
      const f = ITEMS[it[1].id].fuel;
      be.burn = be.burnMax = fast ? Math.floor(f / 2) : f;
      if (ITEMS[it[1].id].name === 'lava_bucket') it[1] = stack('bucket'); else { it[1].count--; if (!it[1].count) it[1] = null; }
    }
    be.cookMax = fast ? 100 : 200;
    if (be.burn > 0 && can) {
      if (++be.cook >= be.cookMax) {
        be.cook = 0;
        if (it[2]) it[2].count++; else it[2] = stack(outId, 1);
        it[0].count--; if (!it[0].count) it[0] = null;
        be.xp = (be.xp || 0) + r.xp;
        // a wet sponge drying in a furnace fills an empty bucket in the fuel slot
      }
    } else if (be.cook > 0) be.cook = be.burn > 0 ? 0 : Math.max(0, be.cook - 2);
    const now = be.burn > 0;
    if (now !== was) { const st = World.getState(be.x, be.y, be.z); World.setBlock(be.x, be.y, be.z, id, now ? st | 8 : st & ~8, 4); }
    if (now && Math.random() < 0.1) Particles.furnace && Particles.furnace(be.x, be.y, be.z, World.getState(be.x, be.y, be.z) & 7, kind);
  }
  // campfires cook up to four items, 30 seconds each
  function campfire(be) {
    const st = World.getState(be.x, be.y, be.z);
    if (st & 8) return; // unlit
    for (let i = 0; i < 4; i++) {
      const s = be.items[i]; if (!s) continue;
      if (++be.times[i] >= 600) { const r = Smelting.find(s, 'c'); be.items[i] = null; be.times[i] = 0; if (r) Drops.spawnItem(be.x + 0.5, be.y + 0.6, be.z + 0.5, stack(r.out, 1)); }
    }
    if (Math.random() < 0.05) Particles.campfireSmoke && Particles.campfireSmoke(be.x, be.y, be.z);
  }
  return { tick };
})();

/* Right-clicking blocks: containers and workstations open their screens; other blocks react. */
const BlockUse = (() => {
  const B = BID;
  function openContainer(x, y, z, title, rows) {
    const be = World.getBE(x, y, z) || (World.setBE(x, y, z, Blocks.newBE(BLOCKS[World.getBlock(x, y, z)].name)), World.getBE(x, y, z));
    if (!be) return false;
    LootTables.unpackContainer(be, Game.player);
    Screens.open(new ChestScreen(be.items, rows, title));
    return true;
  }
  function use(p, hit, id, st, d, held) {
    const { x, y, z } = hit, n = d.name;
    const hn = held ? ITEMS[held.id].name : '';
    switch (n) {
      case 'crafting_table': Screens.open(new CraftingScreen()); Stats.add('interact', 'crafting_table'); return true;
      case 'furnace': case 'blast_furnace': case 'smoker': { let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(n); World.setBE(x, y, z, be); } Screens.open(new FurnaceScreen(be, n === 'furnace' ? 'f' : n === 'blast_furnace' ? 'b' : 's', ITEMS[IID[n]].display)); return true; }
      case 'chest': case 'trapped_chest': {
        if (OPAQUE[World.getBlock(x, y + 1, z)]) return true;
        const t = (st >> 3) & 3;
        let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(n); World.setBE(x, y, z, be); }
        LootTables.unpackContainer(be, p);
        if (t) {
          const f = st & 7, side = { 2: [5, 4], 3: [4, 5], 4: [2, 3], 5: [3, 2] }[f][t === 1 ? 0 : 1];
          const ox = x + DX[side], oz = z + DZ[side];
          if (World.getBlock(ox, y, oz) === id) {
            if (OPAQUE[World.getBlock(ox, y + 1, oz)]) return true;
            let be2 = World.getBE(ox, y, oz); if (!be2) { be2 = Blocks.newBE(n); World.setBE(ox, y, oz, be2); } LootTables.unpackContainer(be2, p);
            const [a, b] = t === 1 ? [be, be2] : [be2, be];
            const items = { get: i => i < 27 ? a.items[i] : b.items[i - 27], set: (i, v) => { v = v && v.count > 0 ? v : null; if (i < 27) a.items[i] = v; else b.items[i - 27] = v; World.chunkAt(x, z).modified = true; } };
            Screens.open(new ChestScreen(items, 6, 'Large Chest', { onClose: () => { Sound.play('chest_close', null, { x, y, z }); ChestAnim.close(x, y, z); ChestAnim.close(ox, y, oz); if (n === 'trapped_chest') { Redstone.update(x, y, z); Redstone.update(ox, y, oz); } } }));
            Sound.play('chest_open', null, { x, y, z }); ChestAnim.open(x, y, z); ChestAnim.open(ox, y, oz);
            if (n === 'trapped_chest') { Redstone.update(x, y, z); Redstone.update(ox, y, oz); }
            return true;
          }
        }
        Screens.open(new ChestScreen(be.items, 3, 'Chest', { onClose: () => { Sound.play('chest_close', null, { x, y, z }); ChestAnim.close(x, y, z); if (n === 'trapped_chest') Redstone.update(x, y, z); } }));
        Sound.play('chest_open', null, { x, y, z }); ChestAnim.open(x, y, z);
        if (n === 'trapped_chest') Redstone.update(x, y, z);
        return true;
      }
      case 'barrel': { let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(n); World.setBE(x, y, z, be); } LootTables.unpackContainer(be, p); World.setBlock(x, y, z, id, st | 8, 4); Screens.open(new ChestScreen(be.items, 3, 'Barrel', { onClose: () => World.setBlock(x, y, z, id, World.getState(x, y, z) & ~8, 4) })); Sound.play('barrel_open', null, { x, y, z }); return true; }
      case 'ender_chest': Screens.open(new ChestScreen(p.enderChest, 3, 'Ender Chest')); Sound.play('chest_open', null, { x, y, z }); return true;
      case 'dispenser': case 'dropper': { let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(n); World.setBE(x, y, z, be); } LootTables.unpackContainer(be, p); Screens.open(new ChestScreen(be.items, 3, ITEMS[IID[n]].display, { cols: 3, dispenser: true })); return true; }
      case 'hopper': { let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(n); World.setBE(x, y, z, be); } Screens.open(new ChestScreen(be.items, 1, 'Item Hopper', { cols: 5, hopper: true })); return true; }
      case 'enchanting_table': Screens.open(new EnchantScreen(x, y, z)); return true;
      case 'anvil': case 'chipped_anvil': case 'damaged_anvil': Screens.open(new AnvilScreen(x, y, z)); return true;
      case 'grindstone': Screens.open(new GrindstoneScreen(x, y, z)); return true;
      case 'brewing_stand': if (typeof BrewingScreen !== 'undefined') { let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(n); World.setBE(x, y, z, be); } Screens.open(new BrewingScreen(be)); return true; } return false;
      case 'stonecutter': Screens.open(new StonecutterScreen(x, y, z)); return true;
      case 'smithing_table': Screens.open(new SmithingScreen(x, y, z)); return true;
      case 'loom': if (typeof LoomScreen !== 'undefined') { Screens.open(new LoomScreen()); return true; } return false;
      case 'cartography_table': if (typeof CartographyScreen !== 'undefined') { Screens.open(new CartographyScreen()); return true; } return false;
      case 'beacon': { let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE('beacon'); World.setBE(x, y, z, be); } be.levels = Beacons.beam(x, y, z) ? Beacons.levelsAt(x, y, z) : 0; Screens.open(new BeaconScreen(be)); return true; }
      case 'note_block': { const s2 = (st & ~31) | (((st & 31) + 1) % 25); World.setBlock(x, y, z, id, s2); Redstone.playNote(x, y, z); return true; }
      case 'jukebox': {
        const be = World.getBE(x, y, z) || { type: 'jukebox', disc: null };
        if (be.disc) { Drops.spawnItem(x + 0.5, y + 1.2, z + 0.5, be.disc); be.disc = null; World.setBE(x, y, z, be); World.setBlock(x, y, z, id, 0); Sound.stopDisc(x, y, z); return true; }
        if (hn.startsWith('music_disc_')) { be.disc = Object.assign({}, held, { count: 1 }); World.setBE(x, y, z, be); World.setBlock(x, y, z, id, 1); consume(p); Sound.playDisc(hn, x, y, z); HUD.actionBar('Now Playing: C418 - ' + ITEMS[IID[hn]].display.replace('Music Disc', '').trim()); return true; }
        return false;
      }
      case 'flower_pot': {
        const cur = st & 31;
        if (cur) { const plant = Models.POT_PLANTS[cur]; if (!held) { p.inv.held = stack(plant); } else { const left = p.inv.addItem(stack(plant)); if (left) ItemUse.drop(p, left); } World.setBlock(x, y, z, id, 0); return true; }
        const k = Models.POT_PLANTS.indexOf(hn);
        if (k > 0) { World.setBlock(x, y, z, id, k); consume(p); return true; }
        return false;
      }
      case 'composter': {
        const lvl = st & 15;
        if (lvl >= 8) { Drops.spawnItem(x + 0.5, y + 1.1, z + 0.5, stack('bone_meal')); World.setBlock(x, y, z, id, 0); Sound.play('composter_empty', null, { x, y, z }); return true; }
        const ch = held && Compost.chance(hn);
        if (!ch || lvl >= 7) return false;
        consume(p);
        if (Math.random() < ch) { World.setBlock(x, y, z, id, lvl + 1); if (lvl + 1 === 7) Ticks.schedule(x, y, z, 20); Sound.play('composter_fill_success', null, { x, y, z }); } else Sound.play('composter_fill', null, { x, y, z });
        return true;
      }
      case 'cauldron': return Cauldron.use(p, x, y, z, st, held);
      case 'sweet_berry_bush': { const a = st & 3; if (a < 2) return false; if (hn === 'bone_meal' && a < 3) return false; Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack('sweet_berries', a === 3 ? 2 + (Math.random() * 2 | 0) : 1 + (Math.random() * 2 | 0))); World.setBlock(x, y, z, id, 1); Sound.play('berry_pick', null, { x, y, z }); return true; }
      case 'cave_vines': case 'cave_vines_plant': if (st & 8) { Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack('glow_berries')); World.setBlock(x, y, z, id, st & ~8); return true; } return false;
      case 'campfire': case 'soul_campfire': {
        const be = World.getBE(x, y, z) || Blocks.newBE(n);
        if (held && Smelting.find(held, 'c')) { const k = be.items.findIndex(s => !s); if (k >= 0) { be.items[k] = stack(held.id, 1); be.times[k] = 0; World.setBE(x, y, z, be); consume(p); return true; } }
        return false;
      }
      case 'respawn_anchor': {
        if (hn === 'glowstone' && (st & 7) < 4) { World.setBlock(x, y, z, id, st + 1); consume(p); Sound.play('anchor_charge', null, { x, y, z }); return true; }
        if ((st & 7) > 0) { if (World.dim !== 'nether') { Explosions.explode(x + 0.5, y + 0.5, z + 0.5, 5, true, null); return true; } p.spawn = { dim: 'nether', x: x + 0.5, y: y + 1, z: z + 0.5, anchor: true }; Chat.system('Respawn point set'); Sound.play('anchor_set', null, { x, y, z }); return true; }
        return false;
      }
      case 'lectern': if (typeof Books !== 'undefined') return Books.lectern(p, x, y, z, st, held); return false;
      case 'bell': Sound.play('bell', null, { x, y, z }); return true;
      case 'end_portal_frame': if (hn === 'ender_eye' && !(st & 8)) { World.setBlock(x, y, z, id, st | 8); consume(p); Sound.play('eye_place', null, { x, y, z }); Portals.checkEndPortal(x, y, z); return true; } return false;
      case 'redstone_ore': case 'deepslate_redstone_ore': World.setBlock(x, y, z, id, 1); return false;
      case 'dragon_egg': DragonEgg.teleport(x, y, z); return true;
      case 'pumpkin': if (hn === 'shears') { World.setBlock(x, y, z, B.carved_pumpkin, hit.face > 1 ? hit.face : OPP[Place.lookDir(p)]); Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack('pumpkin_seeds', 4)); p.inv.damageHeld(1, p); Sound.play('pumpkin_carve', null, { x, y, z }); return true; } return false;
      case 'bee_nest': case 'beehive': if ((st >> 3 & 7) >= 5 && (hn === 'shears' || hn === 'glass_bottle')) { if (hn === 'shears') { Drops.spawnItem(x + 0.5, y + 1, z + 0.5, stack('honeycomb', 3)); p.inv.damageHeld(1, p); } else { consume(p); give(p, stack('honey_bottle')); } World.setBlock(x, y, z, id, st & 7); return true; } return false;
      case 'cake': return false;
      case 'chiseled_bookshelf': return false;
      case 'tnt': if (hn === 'flint_and_steel' || hn === 'fire_charge') { Explosions.primeTnt(x, y, z, p); if (hn === 'flint_and_steel') p.inv.damageHeld(1, p); else consume(p); return true; } return false;
      case 'sign': case 'oak_sign': default:
        if (d.model === 'sign' || d.model === 'wall_sign') { if (hn.endsWith('_dye') || hn === 'glow_ink_sac' || hn === 'ink_sac') { const be = World.getBE(x, y, z); if (be) { if (hn === 'glow_ink_sac') be.glow = true; else if (hn === 'ink_sac') be.glow = false; else be.color = hn.replace('_dye', ''); World.setBE(x, y, z, be); consume(p); return true; } } UI.open('sign', { x, y, z }); return true; }
        if (d.name.endsWith('shulker_box')) { const be = World.getBE(x, y, z) || (World.setBE(x, y, z, Blocks.newBE(d.name)), World.getBE(x, y, z)); Screens.open(new ChestScreen(be.items, 3, 'Shulker Box', { filter: s => !ITEMS[s.id].name.endsWith('shulker_box') })); return true; }
    }
    return false;
  }
  function consume(p) { if (p.creative) return; const s = p.inv.held; if (!s) return; s.count--; if (s.count <= 0) p.inv.held = null; p.inv.changed(); }
  function give(p, s) { const left = p.inv.addItem(s); if (left) ItemUse.drop(p, left); }
  return { use, consume, give };
})();

// chest lids open and close (drawn by the entity renderer)
const ChestAnim = { _m: new Map(), open(x, y, z) { this._m.set(x + ',' + y + ',' + z, 1); }, close(x, y, z) { this._m.delete(x + ',' + y + ',' + z); }, isOpen(x, y, z) { return this._m.has(x + ',' + y + ',' + z); } };

// composting chances (vanilla)
const Compost = (() => {
  const C = {};
  const set = (p, list) => { for (const n of list) C[n] = p; };
  set(0.3, ['beetroot_seeds', 'dried_kelp', 'glow_berries', 'short_grass', 'hanging_roots', 'kelp', 'melon_seeds', 'moss_carpet', 'pumpkin_seeds', 'seagrass', 'small_dripleaf', 'sweet_berries', 'wheat_seeds', 'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves', 'mangrove_leaves', 'cherry_leaves', 'azalea_leaves', 'oak_sapling', 'spruce_sapling', 'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling', 'cherry_sapling', 'mangrove_propagule', 'mangrove_roots', 'torchflower_seeds', 'pink_petals']);
  set(0.5, ['dried_kelp_block', 'tall_grass', 'flowering_azalea_leaves', 'cactus', 'sugar_cane', 'vine', 'glow_lichen', 'nether_sprouts', 'twisting_vines', 'weeping_vines', 'melon_slice']);
  set(0.65, ['apple', 'azalea', 'beetroot', 'big_dripleaf', 'carrot', 'cocoa_beans', 'fern', 'large_fern', 'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'sunflower', 'lilac', 'rose_bush', 'peony', 'crimson_fungus', 'warped_fungus', 'lily_pad', 'melon', 'moss_block', 'brown_mushroom', 'red_mushroom', 'mushroom_stem', 'nether_wart', 'potato', 'pumpkin', 'carved_pumpkin', 'crimson_roots', 'warped_roots', 'sea_pickle', 'shroomlight', 'spore_blossom', 'wheat', 'torchflower']);
  set(0.85, ['baked_potato', 'bread', 'cookie', 'flowering_azalea', 'hay_block', 'brown_mushroom_block', 'red_mushroom_block', 'nether_wart_block', 'warped_wart_block']);
  set(1, ['cake', 'pumpkin_pie']);
  return { chance: n => C[n] || 0 };
})();
