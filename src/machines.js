'use strict';
/* Redstone machines that move items: hoppers (one item every 8 ticks, out of the container above or items
   lying on top, into the container they point at, locked while powered), droppers (one item into the
   container in front, or onto the ground), dispensers (shoot arrows and other projectiles, place and pick up
   fluids, light fires, prime TNT, use bone meal, shears, saddles and armour on what is in front, place
   boats, minecarts, shulker boxes and golem heads; anything else drops), the crafter (crafts what its grid
   holds when powered, slots can be switched off), tripwire hooks and string, and lightning rods. Containers
   expose the game's per-face slot rules (a hopper above a furnace fills its input, one at the side its fuel,
   one below takes its output). */
const Containers = (() => {
  const B = BID;
  const PLAIN = /^(chest|trapped_chest|barrel|dispenser|dropper|hopper)$|shulker_box$/;
  const nameOf = s => s ? ITEMS[s.id].name : '';
  function newBE(n) {
    if (n === 'crafter') return { type: 'crafter', items: new Array(9).fill(null), disabled: new Array(9).fill(false), craftTicks: 0 };
    return Blocks.newBE(n);
  }
  // a view of the block's inventory with the game's rules for hoppers and droppers; face is the side of the
  // container being used (1: from above, 0: from below, 2-5: from the sides)
  function at(x, y, z) {
    const id = World.getBlock(x, y, z); if (!id) return null;
    const n = BLOCKS[id].name, st = World.getState(x, y, z);
    let kind;
    if (PLAIN.test(n)) kind = 'plain';
    else if (n === 'furnace' || n === 'blast_furnace' || n === 'smoker') kind = 'furnace';
    else if (n === 'brewing_stand') kind = 'brewing';
    else if (n === 'crafter') kind = 'crafter';
    else if (n === 'decorated_pot') kind = 'pot';
    else if (n === 'chiseled_bookshelf') kind = 'bookshelf';
    else if (n === 'composter') return composter(x, y, z, id, st);
    else if (n === 'jukebox') return jukebox(x, y, z, id, st);
    else return null;
    let be = World.getBE(x, y, z);
    if (!be || !be.items) { be = newBE(n); if (!be) return null; World.setBE(x, y, z, be); }
    if (be.loot) LootTables.unpackContainer(be, null);
    let get = i => be.items[i], set = (i, s) => { be.items[i] = s && s.count > 0 ? s : null; }, size = be.items.length;
    const positions = [[x, y, z]];
    // a double chest is one 54-slot inventory
    if ((n === 'chest' || n === 'trapped_chest') && ((st >> 3) & 3)) {
      const t = (st >> 3) & 3, side = { 2: [5, 4], 3: [4, 5], 4: [2, 3], 5: [3, 2] }[st & 7][t === 1 ? 0 : 1], ox = x + DX[side], oz = z + DZ[side];
      if (World.getBlock(ox, y, oz) === id) {
        let o = World.getBE(ox, y, oz); if (!o) { o = newBE(n); World.setBE(ox, y, oz, o); }
        if (o.loot) LootTables.unpackContainer(o, null);
        const [a, b] = t === 1 ? [be, o] : [o, be];
        get = i => i < 27 ? a.items[i] : b.items[i - 27];
        set = (i, s) => { s = s && s.count > 0 ? s : null; if (i < 27) a.items[i] = s; else b.items[i - 27] = s; };
        size = 54; positions.push([ox, y, oz]);
      }
    }
    const all = [...Array(size).keys()];
    function slots(face) {
      if (kind === 'furnace') return face === 1 ? [0] : face === 0 ? [2, 1] : [1];
      if (kind === 'brewing') return face === 1 ? [3] : face === 0 ? [0, 1, 2, 3] : [0, 1, 2, 4];
      return all;
    }
    function canPlace(i, s) {
      const nm = nameOf(s);
      if (kind === 'plain') return !(n.endsWith('shulker_box') && (nm.endsWith('shulker_box')));
      if (kind === 'furnace') { if (i === 2) return false; if (i === 1) return ITEMS[s.id].fuel > 0 || (nm === 'bucket' && nameOf(get(1)) !== 'bucket'); return true; }
      if (kind === 'brewing') { if (i === 3) return Potions.isIngredient(s); if (i === 4) return nm === 'blaze_powder'; return Brewing.isBottle(s) && !get(i); }
      if (kind === 'crafter') {
        if (be.disabled && be.disabled[i]) return false;
        const cur = get(i); if (!cur) return true;
        if (cur.count >= maxStack(cur)) return false;
        // a hopper fills the crafter's grid evenly: never onto a stack while a later slot is emptier
        for (let k = i + 1; k < 9; k++) { if (be.disabled && be.disabled[k]) continue; const o = get(k); if (!o || (o.count < cur.count && sameItem(o, cur))) return false; }
        return true;
      }
      if (kind === 'pot') { const cur = get(0); return !cur || (sameItem(cur, s) && cur.count < maxStack(cur)); }
      if (kind === 'bookshelf') return Shelves.BOOKS.has(nm) && !get(i);
      return true;
    }
    function canTake(i, s, face) {
      if (kind === 'furnace' && face === 0 && i === 1) { const nm = nameOf(s); return nm === 'water_bucket' || nm === 'bucket'; }
      if (kind === 'brewing' && i === 3) return nameOf(s) === 'glass_bottle';
      return true;
    }
    const max = (i, s) => (kind === 'brewing' && i < 3) || kind === 'bookshelf' ? 1 : maxStack(s);
    function changed() {
      if (kind === 'bookshelf') Shelves.sync(x, y, z, be);
      if (kind === 'pot') be.wobble = Game.gameTime;
      for (const p of positions) { const c = World.chunkAt(p[0], p[2]); if (c) c.modified = true; Redstone.analogChanged(p[0], p[1], p[2]); }
    }
    return { n, kind, be, x, y, z, size, get, set, slots, canPlace, canTake, max, changed, isHopper: n === 'hopper' };
  }
  // the composter takes compostable items from above and gives bone meal from below
  function composter(x, y, z, id, st) {
    const lvl = st & 15;
    return {
      n: 'composter', kind: 'composter', x, y, z, size: 1,
      get: () => lvl === 8 ? stack('bone_meal') : null,
      set: (i, s) => { if (!s && lvl === 8) { World.setBlock(x, y, z, id, 0); Sound.play('composter_empty', null, { x, y, z }); } },
      slots: face => face === 1 ? (lvl < 7 ? [0] : []) : face === 0 ? [0] : [],
      canPlace: (i, s) => lvl < 7 && Compost.chance(nameOf(s)) > 0,
      canTake: () => lvl === 8,
      max: () => 1,
      // an item put in: the chance roll, like a player using it
      insertOne(s, face) {
        const ch = Compost.chance(nameOf(s)); if (!ch || lvl >= 7 || face !== 1) return false;
        if (Math.random() < ch) { World.setBlock(x, y, z, id, lvl + 1); if (lvl + 1 === 7) Ticks.schedule(x, y, z, 20); Sound.play('composter_fill_success', null, { x, y, z }); } else Sound.play('composter_fill', null, { x, y, z });
        Redstone.analogChanged(x, y, z);
        return true;
      },
      changed() { Redstone.analogChanged(x, y, z); },
    };
  }
  // a jukebox takes a music disc from a hopper or dropper and starts playing it
  function jukebox(x, y, z, id, st) {
    const be = World.getBE(x, y, z) || { type: 'jukebox', disc: null };
    return {
      n: 'jukebox', kind: 'jukebox', x, y, z, size: 1,
      get: () => be.disc, set: (i, s) => { be.disc = s; World.setBE(x, y, z, be); },
      slots: () => [0], canPlace: (i, s) => !be.disc && nameOf(s).startsWith('music_disc_'), canTake: () => false, max: () => 1,
      insertOne(s) {
        if (be.disc || !nameOf(s).startsWith('music_disc_')) return false;
        be.disc = Object.assign({}, s, { count: 1 }); World.setBE(x, y, z, be); World.setBlock(x, y, z, id, 1);
        Sound.playDisc(nameOf(s), x, y, z); Redstone.update(x, y, z); Redstone.analogChanged(x, y, z);
        return true;
      },
      changed() { Redstone.analogChanged(x, y, z); },
    };
  }
  // put one item (a copy of s with count 1) into the container through a face; true when it went in
  function insertOne(c, s, face) {
    if (c.insertOne) return c.insertOne(Object.assign({}, s, { count: 1 }), face);
    for (const i of c.slots(face)) {
      const cur = c.get(i);
      if (!c.canPlace(i, s, face)) continue;
      if (!cur) { c.set(i, Object.assign({}, s, { count: 1 })); return true; }
      if (sameItem(cur, s) && cur.count < c.max(i, cur)) { cur.count++; c.set(i, cur); return true; }
    }
    return false;
  }
  // put as much of a stack as fits; returns what is left
  function insert(c, s, face) {
    let left = Object.assign({}, s);
    while (left.count > 0 && insertOne(c, left, face)) left.count--;
    return left.count > 0 ? left : null;
  }
  function isFull(c) { for (const i of c.slots(1)) { const s = c.get(i); if (!s || s.count < c.max(i, s)) return false; } return true; }
  function isEmpty(c) { for (let i = 0; i < c.size; i++) if (c.get(i)) return false; return true; }
  return { at, insertOne, insert, isFull, isEmpty, newBE };
})();

/* Hoppers: the game's HopperBlockEntity. */
const Hoppers = (() => {
  const B = BID;
  function tick(be) {
    const { x, y, z } = be;
    if (World.getBlock(x, y, z) !== B.hopper) return;
    be.ticked = Game.gameTime;
    if (be.cooldown > 0 && --be.cooldown > 0) return;
    const st = World.getState(x, y, z);
    if (st & 8) return; // locked by redstone
    const self = Containers.at(x, y, z); if (!self) return;
    let moved = false;
    if (!Containers.isEmpty(self)) moved = eject(self, st & 7);
    if (!full(self)) moved = suck(self) || moved;
    if (moved) { be.cooldown = 8; self.changed(); }
  }
  const full = c => { for (let i = 0; i < c.size; i++) { const s = c.get(i); if (!s || s.count < maxStack(s)) return false; } return true; };
  // push one item into the container the hopper points at
  function eject(self, f) {
    const tx = self.x + DX[f], ty = self.y + DY[f], tz = self.z + DZ[f];
    const t = Containers.at(tx, ty, tz);
    if (!t) return Vehicles.hopperInto ? Vehicles.hopperInto(self, tx, ty, tz) : false;
    const face = OPP[f];
    const wasEmpty = t.isHopper && Containers.isEmpty(t);
    for (let i = 0; i < self.size; i++) {
      const s = self.get(i); if (!s) continue;
      if (Containers.insertOne(t, s, face)) {
        s.count--; self.set(i, s.count > 0 ? s : null);
        // a hopper that just got its first item waits before passing it on
        if (wasEmpty && t.be && !(t.be.cooldown > 0)) t.be.cooldown = (self.be.ticked >= (t.be.ticked || 0)) ? 7 : 8;
        t.changed();
        return true;
      }
    }
    return false;
  }
  // pull one item from the container above, or pick up items lying on top
  function suck(self) {
    const { x, y, z } = self;
    const src = Containers.at(x, y + 1, z);
    if (src) {
      if (src.kind === 'composter' || src.kind === 'jukebox') { if (src.kind === 'composter' && src.get(0)) { if (Containers.insertOne(self, src.get(0), 1)) { src.set(0, null); return true; } } return false; }
      for (const i of src.slots(0)) {
        const s = src.get(i); if (!s || !src.canTake(i, s, 0)) continue;
        if (Containers.insertOne(self, s, 1)) { s.count--; src.set(i, s.count > 0 ? s : null); src.changed(); return true; }
      }
      return false;
    }
    if (Vehicles.hopperFrom(self, x, y + 1, z)) return true;
    if (OPAQUE[World.getBlock(x, y + 1, z)]) return false;
    const box = [x, y + 11 / 16, z, x + 1, y + 2, z + 1];
    for (const e of Entities.list) {
      if (e.type !== 'item' || e.removed || !e.intersects(box)) continue;
      const left = Containers.insert(self, e.stack, 1);
      if (left && left.count === e.stack.count) continue;
      if (left) e.stack = left; else e.removed = true;
      return true;
    }
    return false;
  }
  return { tick };
})();

/* Dispensers and droppers. */
const Dispense = (() => {
  const B = BID;
  const nameOf = s => s ? ITEMS[s.id].name : '';
  const tri = (m, d) => m + d * (Math.random() - Math.random());
  function frontPos(x, y, z, f) { return [x + 0.5 + 0.7 * DX[f], y + 0.5 + 0.7 * DY[f], z + 0.5 + 0.7 * DZ[f]]; }
  // the default: throw the item out of the front
  function spit(x, y, z, f, s) {
    const [px, py, pz] = frontPos(x, y, z, f);
    const e = Drops.spawnItem(px, py - (f < 2 ? 0.125 : 0.15625), pz, s);
    if (e) { const d = Math.random() * 0.1 + 0.2, k = 0.0172275 * 6; e.vx = tri(DX[f] * d, k); e.vy = tri(0.2, k); e.vz = tri(DZ[f] * d, k); }
    clickSmoke(x, y, z, f, true);
  }
  function clickSmoke(x, y, z, f, ok) {
    Sound.play(ok ? 'dispense' : 'dispense_fail', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (ok) { const [px, py, pz] = frontPos(x, y, z, f); for (let i = 0; i < 4; i++) Particles.smokeAt(px + (Math.random() - 0.5) * 0.2, py + (Math.random() - 0.5) * 0.2, pz + (Math.random() - 0.5) * 0.2, DX[f] * 0.05, DY[f] * 0.05 + 0.01, DZ[f] * 0.05); }
  }
  function fire(x, y, z, id, st) {
    const be = World.getBE(x, y, z); if (!be || !be.items) return;
    if (be.loot) LootTables.unpackContainer(be, null);
    // a random slot that has something in it
    let pick = -1, n = 1;
    for (let i = 0; i < be.items.length; i++) if (be.items[i] && be.items[i].count > 0 && Math.floor(Math.random() * n++) === 0) pick = i;
    const f = st & 7;
    if (pick < 0) { clickSmoke(x, y, z, f, false); return; }
    const s = be.items[pick];
    const out = BLOCKS[id].name === 'dropper' ? drop(x, y, z, f, s) : dispense(x, y, z, f, s, be);
    be.items[pick] = out && out.count > 0 ? out : null;
    const c = World.chunkAt(x, z); if (c) c.modified = true;
    Redstone.analogChanged(x, y, z);
  }
  // droppers put one item into the container in front, or drop it
  function drop(x, y, z, f, s) {
    const t = Containers.at(x + DX[f], y + DY[f], z + DZ[f]);
    if (t) { if (Containers.insertOne(t, s, OPP[f])) { t.changed(); return Object.assign({}, s, { count: s.count - 1 }); } return s; }
    spit(x, y, z, f, Object.assign({}, s, { count: 1 }));
    return Object.assign({}, s, { count: s.count - 1 });
  }
  const one = s => Object.assign({}, s, { count: s.count - 1 });
  // a filled bucket or bottle goes back into the dispenser (or out of the front when there is no room)
  function exchange(be, x, y, z, f, s, got) {
    if (s.count === 1) return stack(got);
    if (!addTo(be, stack(got))) spit(x, y, z, f, stack(got));
    return one(s);
  }
  function addTo(be, s) {
    for (let i = 0; i < be.items.length; i++) { const c = be.items[i]; if (c && sameItem(c, s) && c.count < maxStack(c)) { c.count++; return true; } }
    for (let i = 0; i < be.items.length; i++) if (!be.items[i]) { be.items[i] = s; return true; }
    return false;
  }
  function shoot(e, f, power, spread) { Projectiles.shoot(e, DX[f], DY[f] + 0.1, DZ[f], power, spread); Entities.add(e); }
  const inFront = (x, y, z) => { const box = [x, y, z, x + 1, y + 1, z + 1]; return Entities.list.concat(Game.player ? [Game.player] : []).filter(e => e && !e.removed && !e.dead && !e.ghost && e.intersects(box)); };
  const ARMOR_KEYS = ['head', 'chest', 'legs', 'feet'];
  function equip(fx, fy, fz, s) {
    const it = ITEMS[s.id], n = it.name;
    const slot = it.armor ? it.armor.slot : (n === 'carved_pumpkin' || /_(head|skull)$/.test(n)) ? 0 : n === 'elytra' ? 1 : -1;
    if (slot < 0) return false;
    for (const e of inFront(fx, fy, fz)) {
      if (e.isPlayer) { if (e.spectator || e.inv.get(36 + slot)) continue; e.inv.set(36 + slot, Object.assign({}, s, { count: 1 })); e.updateArmor && e.updateArmor(); Sound.play('equip', e); return true; }
      if (e.equip && e.living && !e.equip[ARMOR_KEYS[slot]] && (e.type === 'armor_stand' || e.canWearArmor !== false) && !['creeper', 'cow', 'pig', 'sheep', 'chicken', 'wolf', 'cat', 'horse', 'villager'].includes(e.type)) { e.equip[ARMOR_KEYS[slot]] = Object.assign({}, s, { count: 1 }); e.persistent = true; e.dropChance = Object.assign({}, e.dropChance || {}, { [ARMOR_KEYS[slot]]: 2 }); Sound.play('equip', e); return true; }
    }
    return false;
  }
  function dispense(x, y, z, f, s, be) {
    const n = nameOf(s), it = ITEMS[s.id];
    const fx = x + DX[f], fy = y + DY[f], fz = z + DZ[f], fid = World.getBlock(fx, fy, fz), fd = BLOCKS[fid], fst = World.getState(fx, fy, fz);
    const [px, py, pz] = frontPos(x, y, z, f);
    const launched = () => { Sound.play('bow_shoot', null, { x: px, y: py, z: pz }); return one(s); };
    // projectiles
    if (n === 'arrow' || n === 'spectral_arrow' || n === 'tipped_arrow') { const a = new Arrow(null, px, py - 0.25, pz, { spectral: n === 'spectral_arrow', potion: n === 'tipped_arrow' && s.tag ? s.tag.potion : null, pickup: 1 }); shoot(a, f, 1.1, 6); return launched(); }
    if (n === 'snowball' || n === 'egg') { shoot(new ThrownItem(n, null, px, py - 0.125, pz), f, 1.1, 6); return launched(); }
    if (n === 'experience_bottle' || n === 'splash_potion' || n === 'lingering_potion') { shoot(new ThrownItem(n, null, px, py - 0.125, pz, { potion: s.tag && s.tag.potion }), f, 1.375, 3); return launched(); }
    if (n === 'wind_charge') { const w = new ThrownItem('wind_charge', null, px, py - 0.125, pz); Projectiles.shoot(w, DX[f], DY[f], DZ[f], 1, 6.67); Entities.add(w); Sound.play('wind_charge_throw', null, { x: px, y: py, z: pz }); return one(s); }
    if (n === 'fire_charge') { Projectiles.fireball(null, px, py, pz, tri(DX[f], 0.11485), tri(DY[f], 0.11485), tri(DZ[f], 0.11485), false); Sound.play('fire_charge', null, { x: px, y: py, z: pz }); return one(s); }
    if (n === 'firework_rocket') { const fw = new Firework(px, py, pz, s.tag, null); Projectiles.shoot(fw, DX[f], DY[f], DZ[f], 0.5, 1); Entities.add(fw); Sound.play('firework_launch', null, { x: px, y: py, z: pz }); return one(s); }
    // spawn eggs
    if (n.endsWith('_spawn_egg')) { const m = Mobs.spawn(it.mob, fx + 0.5, fy, fz + 0.5, { fromEgg: true, name: s.tag && s.tag.name }); clickSmoke(x, y, z, f, !!m); return m ? one(s) : s; }
    // TNT
    if (n === 'tnt') { const t = Explosions.spawnTnt(fx + 0.5, fy, fz + 0.5, 80); Sound.play('tnt_primed', t); return one(s); }
    // fluids
    if (n === 'water_bucket' || n === 'lava_bucket' || n === 'powder_snow_bucket' || /^(cod|salmon|pufferfish|tropical_fish|axolotl|tadpole)_bucket$/.test(n)) {
      const water = n !== 'lava_bucket' && n !== 'powder_snow_bucket';
      if (water && fd.waterlog && !(fst & 128)) { World.setBlock(fx, fy, fz, fid, fst | 128); Ticks.schedule(fx, fy, fz, 5, B.water); }
      else if (fid === 0 || (fd.replaceable && !SOLID[fid]) || (fd.fluid && fid !== (water ? B.water : B.lava))) {
        if (water && World.dim === 'nether') { Sound.play('fizz', null, { x: fx, y: fy, z: fz }); }
        else { World.setBlock(fx, fy, fz, n === 'lava_bucket' ? B.lava : n === 'powder_snow_bucket' ? B.powder_snow : B.water, 0); Blocks.onPlaced(fx, fy, fz, World.getBlock(fx, fy, fz), 0, null, null); }
        if (/^(cod|salmon|pufferfish|tropical_fish|axolotl|tadpole)_bucket$/.test(n)) Mobs.spawn(n.replace('_bucket', ''), fx + 0.5, fy, fz + 0.5, { force: true });
      } else { spit(x, y, z, f, Object.assign({}, s, { count: 1 })); return one(s); }
      Sound.play(n === 'lava_bucket' ? 'bucket_empty_lava' : 'bucket_empty', null, { x: fx, y: fy, z: fz });
      return stack('bucket');
    }
    if (n === 'bucket') {
      let got = null;
      if (fid === B.water && fst === 0) got = 'water_bucket'; else if (fid === B.lava && fst === 0) got = 'lava_bucket'; else if (fid === B.powder_snow) got = 'powder_snow_bucket';
      if (got) { World.setBlock(fx, fy, fz, 0, 0); Blocks.updateAround(fx, fy, fz); Sound.play(got === 'lava_bucket' ? 'bucket_fill_lava' : 'bucket_fill', null, { x: fx, y: fy, z: fz }); return exchange(be, x, y, z, f, s, got); }
      if (fd.waterlog && (fst & 128)) { World.setBlock(fx, fy, fz, fid, fst & ~128); Sound.play('bucket_fill', null, { x: fx, y: fy, z: fz }); return exchange(be, x, y, z, f, s, 'water_bucket'); }
      spit(x, y, z, f, Object.assign({}, s, { count: 1 })); return one(s);
    }
    if (n === 'glass_bottle') {
      if (fid === B.water || (fd.waterlog && (fst & 128))) { Sound.play('bottle_fill', null, { x: fx, y: fy, z: fz }); return exchangeTag(be, x, y, z, f, s); }
      if ((fd.name === 'beehive' || fd.name === 'bee_nest') && ((fst >> 3) & 7) >= 5) { World.setBlock(fx, fy, fz, fid, fst & ~56); Sound.play('bottle_fill', null, { x: fx, y: fy, z: fz }); return exchange(be, x, y, z, f, s, 'honey_bottle'); }
      clickSmoke(x, y, z, f, false); return s;
    }
    // fire and lighting
    if (n === 'flint_and_steel') {
      let ok = false;
      if (fid === B.tnt) { Explosions.primeTnt(fx, fy, fz, null); ok = true; }
      else if ((fd.name === 'campfire' || fd.name === 'soul_campfire') && (fst & 8) && !(fst & 128)) { World.setBlock(fx, fy, fz, fid, fst & ~8); ok = true; }
      else if ((fd.model === 'candle' || fd.model === 'candle_cake') && !(fst & 4) && !(fst & 128)) { World.setBlock(fx, fy, fz, fid, fst | 4); ok = true; }
      else if (fid === 0 && Place.canSurvive(B.fire, 0, fx, fy, fz)) { World.setBlock(fx, fy, fz, World.getBlock(fx, fy - 1, fz) === B.soul_sand || World.getBlock(fx, fy - 1, fz) === B.soul_soil ? B.soul_fire : B.fire, 0); Blocks.onPlaced(fx, fy, fz, World.getBlock(fx, fy, fz), 0, null, null); ok = true; }
      clickSmoke(x, y, z, f, ok);
      if (!ok) return s;
      Sound.play('flint', null, { x: fx, y: fy, z: fz });
      const out = Object.assign({}, s, { dmg: (s.dmg || 0) + 1 });
      if (out.dmg >= it.dur) { Sound.play('break_item', null, { x, y, z }); return null; }
      return out;
    }
    if (n === 'bone_meal') { const ok = ItemUse.boneMeal(fx, fy, fz, null); clickSmoke(x, y, z, f, ok); return ok ? one(s) : s; }
    if (n === 'glowstone' && fd.name === 'respawn_anchor') { if ((fst & 7) < 4) { World.setBlock(fx, fy, fz, fid, fst + 1); Sound.play('anchor_charge', null, { x: fx, y: fy, z: fz }); Redstone.analogChanged(fx, fy, fz); return one(s); } clickSmoke(x, y, z, f, false); return s; }
    if (n === 'shears') {
      let ok = false;
      for (const e of inFront(fx, fy, fz)) {
        if (e.type === 'sheep' && !e.sheared && !e.baby) { e.shear(); ok = true; break; }
        if (e.type === 'snow_golem' && e.pumpkin !== false) { e.pumpkin = false; Sound.play('shear', e); ok = true; break; }
        if (e.type === 'mooshroom' && !e.baby) { e.removed = true; const c = Mobs.spawnEntity('cow', e.x, e.y, e.z); if (c) { c.yaw = c.bodyYaw = e.yaw; c.health = e.health; } for (let i = 0; i < 5; i++) Drops.spawnItem(e.x, e.y + e.h, e.z, stack(e.variant === 'brown' ? 'brown_mushroom' : 'red_mushroom')); Sound.play('shear', e); ok = true; break; }
      }
      if (!ok && (fd.name === 'beehive' || fd.name === 'bee_nest') && ((fst >> 3) & 7) >= 5) { World.setBlock(fx, fy, fz, fid, fst & ~56); Drops.spawnItem(fx + 0.5, fy + 1, fz + 0.5, stack('honeycomb', 3)); ok = true; }
      clickSmoke(x, y, z, f, ok);
      if (!ok) return s;
      const out = Object.assign({}, s, { dmg: (s.dmg || 0) + 1 });
      return out.dmg >= it.dur ? null : out;
    }
    if (n === 'saddle') {
      for (const e of inFront(fx, fy, fz)) if (['pig', 'strider', 'horse', 'donkey', 'mule', 'camel', 'skeleton_horse', 'zombie_horse'].includes(e.type) && !e.saddled && !e.baby && (e.type === 'pig' || e.type === 'strider' || e.type === 'camel' || e.tame)) { e.saddled = true; Sound.play('saddle', e); clickSmoke(x, y, z, f, true); return one(s); }
      spit(x, y, z, f, Object.assign({}, s, { count: 1 })); return one(s);
    }
    if (n.endsWith('_horse_armor') || n === 'wolf_armor') {
      for (const e of inFront(fx, fy, fz)) if ((n === 'wolf_armor' ? e.type === 'wolf' : e.type === 'horse') && e.tame && !e.bodyArmor) { e.bodyArmor = Object.assign({}, s, { count: 1 }); Sound.play('equip', e); return one(s); }
      spit(x, y, z, f, Object.assign({}, s, { count: 1 })); return one(s);
    }
    if (n === 'chest') {
      for (const e of inFront(fx, fy, fz)) if (['donkey', 'mule', 'llama', 'trader_llama'].includes(e.type) && e.tame && !e.chested) { e.chested = true; Sound.play('equip', e); return one(s); }
    }
    // golem and wither heads are placed when they would finish a golem or a wither, otherwise worn
    if (n === 'carved_pumpkin' || n === 'wither_skeleton_skull') {
      // try the head in place: kept only if it finished a golem or a wither
      if (fid === 0) {
        World.setBlock(fx, fy, fz, B[n], n === 'carved_pumpkin' ? (f < 2 ? 3 : OPP[f]) : 0);
        Golems.check(fx, fy, fz, null);
        if (World.getBlock(fx, fy, fz) !== B[n]) { clickSmoke(x, y, z, f, true); return one(s); }
        World.setBlock(fx, fy, fz, 0, 0);
      }
      if (equip(fx, fy, fz, s)) return one(s);
      clickSmoke(x, y, z, f, false); return s;
    }
    if ((it.armor || n === 'elytra' || /_(head|skull)$/.test(n)) && equip(fx, fy, fz, s)) return one(s);
    // shulker boxes are placed
    if (n.endsWith('shulker_box')) {
      if (fd.replaceable || fid === 0) { World.setBlock(fx, fy, fz, B[n], f); Blocks.onPlaced(fx, fy, fz, B[n], f, null, s); clickSmoke(x, y, z, f, true); return one(s); }
      clickSmoke(x, y, z, f, false); return s;
    }
    // boats on water, minecarts on rails
    if ((n.endsWith('_boat') || n.endsWith('_raft')) && Vehicles.spawnBoat) {
      const water = BLOCKS[fid].fluid === 'water', below = BLOCKS[World.getBlock(fx, fy - 1, fz)].fluid === 'water';
      if (water || (fid === 0 && below)) { Vehicles.spawnBoat(n, fx + 0.5, fy + (water ? 1 : 0) - 0.0, fz + 0.5, Math.atan2(-DX[f], -DZ[f]) + Math.PI); clickSmoke(x, y, z, f, true); return one(s); }
    }
    if (/minecart$/.test(n) && Vehicles.spawnMinecart) {
      const rail = BLOCKS[fid].model === 'rail' ? [fx, fy, fz] : fid === 0 && BLOCKS[World.getBlock(fx, fy - 1, fz)].model === 'rail' ? [fx, fy - 1, fz] : null;
      if (rail) { Vehicles.spawnMinecart(n, rail[0] + 0.5, rail[1] + 0.0625, rail[2] + 0.5); clickSmoke(x, y, z, f, true); return one(s); }
    }
    if (n === 'brush') { for (const e of inFront(fx, fy, fz)) if (e.type === 'armadillo') { Drops.spawnItem(e.x, e.y + 0.5, e.z, stack('armadillo_scute')); Sound.play('brush', e); return Object.assign({}, s, { dmg: (s.dmg || 0) + 16 }); } clickSmoke(x, y, z, f, false); return s; }
    spit(x, y, z, f, Object.assign({}, s, { count: 1 }));
    return one(s);
  }
  // a glass bottle filled with water is a water potion
  function exchangeTag(be, x, y, z, f, s) {
    const water = stack('potion', 1, { tag: { potion: 'water' } });
    if (s.count === 1) return water;
    if (!addTo(be, water)) spit(x, y, z, f, water);
    return one(s);
  }
  return { fire, spit };
})();

/* The crafter: crafts what its grid holds when it gets a redstone pulse (4 ticks later), puts the result in
   the container in front or shoots it out, and keeps one item of each ingredient less. */
const Crafter = (() => {
  const B = BID;
  function be(x, y, z) { let b = World.getBE(x, y, z); if (!b || !b.items) { b = Containers.newBE('crafter'); World.setBE(x, y, z, b); } if (!b.disabled) b.disabled = new Array(9).fill(false); return b; }
  function result(b) { const r = Recipes.match(b.items.map(s => s && s.count > 0 ? s : null), 3); return r && r.result; }
  function craft(x, y, z, id, st) {
    const b = be(x, y, z), f = st & 7;
    const r = result(b);
    if (!r) { Sound.play('crafter_fail', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); return; }
    b.craftTicks = 6; World.setBlock(x, y, z, id, World.getState(x, y, z) | 32, 4);
    const leftovers = [];
    for (let i = 0; i < 9; i++) {
      const s = b.items[i]; if (!s) continue;
      const lo = { milk_bucket: 'bucket', water_bucket: 'bucket', lava_bucket: 'bucket', honey_bottle: 'glass_bottle', dragon_breath: 'glass_bottle', powder_snow_bucket: 'bucket' }[ITEMS[s.id].name];
      if (lo) leftovers.push(stack(lo));
      s.count--; if (s.count <= 0) b.items[i] = null;
    }
    for (const s of [r].concat(leftovers)) out(x, y, z, f, s);
    Sound.play('crafter_craft', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    const c = World.chunkAt(x, z); if (c) c.modified = true;
    Redstone.analogChanged(x, y, z);
    if (Screens.current && Screens.current.crafterAt === x + ',' + y + ',' + z) Screens.render();
  }
  function out(x, y, z, f, s) {
    let left = Object.assign({}, s);
    const t = Containers.at(x + DX[f], y + DY[f], z + DZ[f]);
    if (t) { while (left.count > 0 && Containers.insertOne(t, left, OPP[f])) left.count--; t.changed(); }
    if (left.count > 0) {
      const [px, py, pz] = [x + 0.5 + 0.7 * DX[f], y + 0.5 + 0.7 * DY[f], z + 0.5 + 0.7 * DZ[f]];
      const e = Drops.spawnItem(px, py - (f < 2 ? 0.125 : 0.15625), pz, left);
      if (e) { const d = Math.random() * 0.1 + 0.2, k = 0.0172275 * 6; e.vx = DX[f] * d + k * (Math.random() - Math.random()); e.vy = 0.2 + k * (Math.random() - Math.random()); e.vz = DZ[f] * d + k * (Math.random() - Math.random()); }
    }
  }
  function tick(b) {
    if (b.craftTicks > 0 && --b.craftTicks === 0) { const st = World.getState(b.x, b.y, b.z); if (World.getBlock(b.x, b.y, b.z) === B.crafter) World.setBlock(b.x, b.y, b.z, B.crafter, st & ~32, 4); }
  }
  return { craft, tick, be, result };
})();
class CrafterScreen extends Screens.Screen {
  constructor(x, y, z) {
    super('Crafter', 176, 166);
    const b = Crafter.be(x, y, z); this.b = b; this.crafterAt = x + ',' + y + ',' + z; this.pos = [x, y, z];
    this.gridSlots = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      this.gridSlots.push(this.slot(null, i, 26 + c * 18, 17 + r * 18, { crafter: i, get: () => b.items[i], set: v => { b.items[i] = v && v.count > 0 ? v : null; }, filter: () => !b.disabled[i], onChange: () => this.changed() }));
    }
    // the result is only shown: the crafter makes it when powered
    this.resultSlot = this.slot(null, 0, 134, 35, { big: true, noQuick: true, filter: () => false, get: () => Crafter.result(b) || null, set: () => {} });
    this.playerSlots(8, 84);
    this.label('Crafter', 8, 6);
    this.parts.push({ kind: 'el', node: elAt('craftarrow', 98, 35, GUI.css('craft_arrow')) });
    this.trig = elAt('crafterpower', 81, 72, ''); this.parts.push({ kind: 'el', node: this.trig });
  }
  // clicking an empty grid slot with nothing in hand switches it off; clicking a switched-off slot turns it back on
  creativeClick(s) {
    if (s === this.resultSlot) return true;
    if (s.crafter === undefined) return false;
    const i = s.crafter;
    if (this.b.disabled[i]) { this.b.disabled[i] = false; Sound.play('click'); this.changed(); return true; }
    if (!Slots.cursor && !this.b.items[i]) { this.b.disabled[i] = true; Sound.play('click'); this.changed(); return true; }
    return false;
  }
  quickTargets(st) { return this.gridSlots.filter(s => !this.b.disabled[s.crafter]); }
  changed() { const c = World.chunkAt(this.pos[0], this.pos[2]); if (c) c.modified = true; Redstone.analogChanged(this.pos[0], this.pos[1], this.pos[2]); }
  renderExtra() {
    for (const s of this.gridSlots) if (s.el) s.el.classList.toggle('disabled', !!this.b.disabled[s.crafter]);
    if (this.trig) this.trig.classList.toggle('on', !!(World.getState(...this.pos) & 64));
  }
  tick() {}
}

/* Tripwire: string between two hooks facing each other (up to 40 blocks apart). Anything touching the string
   powers both hooks for as long as it stays, checked every 10 ticks. Strings cut with shears are disarmed. */
const Tripwire = (() => {
  const B = BID;
  // the game's TripWireHookBlock.calculateState
  function calc(x, y, z, hookSt, attaching, notify, searchRange, wireState) {
    const f = hookSt & 7, wasAttached = !!(hookSt & 8), wasPowered = !!(hookSt & 16);
    let attached = !attaching, powered = false, other = 0;
    const wires = [];
    for (let j = 1; j < 42; j++) {
      const bx = x + DX[f] * j, bz = z + DZ[f] * j, id = World.getBlock(bx, y, bz);
      if (id === B.tripwire_hook) { if ((World.getState(bx, y, bz) & 7) === OPP[f]) other = j; break; }
      if (id !== B.tripwire && j !== searchRange) { wires[j] = null; attached = false; continue; }
      let ws = id === B.tripwire ? World.getState(bx, y, bz) : 0;
      if (j === searchRange && wireState !== undefined) ws = wireState;
      const armed = !(ws & 4), on = !!(ws & 1);
      powered = powered || (armed && on);
      wires[j] = id === B.tripwire || j === searchRange ? ws : null;
      if (j === searchRange) { Ticks.schedule(x, y, z, 10); attached = attached && armed; }
    }
    attached = attached && other > 1;
    powered = powered && attached;
    const base = (attached ? 8 : 0) | (powered ? 16 : 0);
    if (other > 0) {
      const ox = x + DX[f] * other, oz = z + DZ[f] * other;
      World.setBlock(ox, y, oz, B.tripwire_hook, base | OPP[f]);
      Redstone.update(ox, y, oz);
      sounds(ox, y, oz, attached, powered, wasAttached, wasPowered);
    }
    sounds(x, y, z, attached, powered, wasAttached, wasPowered);
    if (!attaching) { World.setBlock(x, y, z, B.tripwire_hook, base | f); if (notify) Redstone.update(x, y, z); }
    if (wasAttached !== attached) for (let k = 1; k < other; k++) { const ws = wires[k]; if (ws === null || ws === undefined) continue; const bx = x + DX[f] * k, bz = z + DZ[f] * k; if (World.getBlock(bx, y, bz) === B.tripwire) World.setBlock(bx, y, bz, B.tripwire, (ws & ~2) | (attached ? 2 : 0)); }
  }
  function sounds(x, y, z, attached, powered, wasAttached, wasPowered) {
    const o = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    if (powered && !wasPowered) Sound.play('tripwire_click_on', null, o);
    else if (!powered && wasPowered) Sound.play('tripwire_click_off', null, o);
    else if (attached && !wasAttached) Sound.play('tripwire_attach', null, o);
    else if (!attached && wasAttached) Sound.play('tripwire_detach', null, o);
  }
  // a string changed: tell the hooks at its ends
  function updateSource(x, y, z, st) {
    for (const f of [3, 4]) for (let i = 1; i < 42; i++) {
      const bx = x + DX[f] * i, bz = z + DZ[f] * i, id = World.getBlock(bx, y, bz);
      if (id === B.tripwire_hook) { const hs = World.getState(bx, y, bz); if ((hs & 7) === OPP[f]) calc(bx, y, bz, hs, false, true, i, st); break; }
      if (id !== B.tripwire) break;
    }
  }
  function pressedAt(x, y, z, st) {
    const box = [x, y, z, x + 1, y + (st & 2 ? 2.5 / 16 : 0.5), z + 1];
    for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) if (e && !e.removed && !e.dead && !e.ghost && !(e.isPlayer && e.spectator) && e.intersects(box)) return true;
    return false;
  }
  function check(x, y, z) {
    const st = World.getState(x, y, z), was = !!(st & 1), now = pressedAt(x, y, z, st);
    if (now !== was) { const s2 = (st & ~1) | (now ? 1 : 0); World.setBlock(x, y, z, B.tripwire, s2); updateSource(x, y, z, s2); }
    if (now) Ticks.schedule(x, y, z, 10);
  }
  function touch(x, y, z) { if (!(World.getState(x, y, z) & 1)) check(x, y, z); }
  function wireTick(x, y, z, id, st) { if (st & 1) check(x, y, z); }
  function hookTick(x, y, z, id, st) { calc(x, y, z, st, false, true, -1); }
  function placed(x, y, z, id, st) {
    if (id === B.tripwire_hook) calc(x, y, z, st, false, false, -1);
    else if (id === B.tripwire) updateSource(x, y, z, st);
  }
  // breaking a hook detaches the string; breaking string (unless cut with shears first) can fire the hooks
  function removed(x, y, z, id, st) {
    if (id === B.tripwire_hook && (st & 8)) calc(x, y, z, st, true, false, -1);
    else if (id === B.tripwire) updateSource(x, y, z, st | 1);
  }
  return { touch, wireTick, hookTick, placed, removed, check, calc };
})();

/* Lightning rods: lightning from storms goes to the nearest rod within 128 blocks that has open sky above it,
   and a struck rod gives a redstone pulse for 8 ticks. */
const LightningRods = (() => {
  const B = BID, rods = new Map();
  const k = (x, y, z) => x + ',' + y + ',' + z;
  World.listeners.chunkLoaded.push(c => {
    const a = c.blocks, id = B.lightning_rod;
    for (let i = a.indexOf(id); i >= 0; i = a.indexOf(id, i + 1)) { const x = c.cx * 16 + (i & 15), z = c.cz * 16 + ((i >> 4) & 15), y = (i >> 8) - 64; rods.set(k(x, y, z), [x, y, z]); }
  });
  World.listeners.chunkUnloaded.push(c => { for (const [key, p] of rods) if (p[0] >> 4 === c.cx && p[2] >> 4 === c.cz) rods.delete(key); });
  World.listeners.blockChanged.push((x, y, z, old, id) => { if (id === B.lightning_rod) rods.set(k(x, y, z), [x, y, z]); else if (old === B.lightning_rod) rods.delete(k(x, y, z)); });
  function skyAbove(x, y, z) { for (let yy = y + 1; yy <= MAXY; yy++) { const b = World.getBlock(x, yy, z); if (b && !BLOCKS[b].replaceable) return false; } return true; }
  // where a storm strike near (x,z) really lands
  function redirect(x, y, z) {
    let best = null, bd = Infinity;
    for (const p of rods.values()) {
      if (World.getBlock(p[0], p[1], p[2]) !== B.lightning_rod) continue;
      const d = (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;
      if (Math.abs(p[0] - x) > 128 || Math.abs(p[2] - z) > 128 || d >= bd || !skyAbove(p[0], p[1], p[2])) continue;
      best = p; bd = d;
    }
    return best ? [best[0] + 0.5, best[1] + 1, best[2] + 0.5] : null;
  }
  function struck(x, y, z) {
    if (World.getBlock(x, y, z) !== B.lightning_rod) return;
    World.setBlock(x, y, z, B.lightning_rod, World.getState(x, y, z) | 8);
    Redstone.update(x, y, z);
    Ticks.schedule(x, y, z, 8);
    for (let i = 0; i < 8; i++) Particles.generic(x + Math.random(), y + Math.random(), z + Math.random(), (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, { size: 0.08, life: 8, grav: 0, phys: false, bright: true, sprite: 'spark_' + rnd(8) });
  }
  return { redirect, struck };
})();
