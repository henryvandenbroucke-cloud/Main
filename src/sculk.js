'use strict';
/* The deep dark, the way Java Edition 1.21 works it:
   - Game events: things that happen in the world (steps, landing, blocks placed or broken, doors, chests, eating,
     damage, deaths, explosions...). Each vibration has a frequency from 1 to 15.
   - Vibrations travel one block per tick to the listeners in range: sculk sensors (8 blocks), calibrated
     sensors (16, filtered to one frequency by the redstone signal on their amethyst side), shriekers (only the
     clicking of a sensor set off by a player) and wardens (16). Sneaking hides steps, landings and the like,
     wool and carpets muffle what happens on them, and wool between the event and the listener blocks it.
   - A sensor that hears something is active for 30 ticks (calibrated: 10), then cools down for 10. It gives
     out more power the closer the vibration was, comparators read its frequency, and amethyst next to it
     resonates.
   - A naturally generated shrieker that shrieks warns the player (levels 1 to 3, with the warden's distant
     sounds). The fourth time a warden digs its way out nearby. Each shriek brings darkness.
   - A catalyst takes the experience of anything that dies within 8 blocks and spreads sculk with it: blocks
     turn to sculk, veins creep around the edges, and now and then a sensor or shrieker grows.
   - The warden is blind. It hears vibrations and smells nearby players. Its anger toward each one builds and
     fades, and at 80 it roars and hunts. It strikes hard, sends a sonic boom through walls at targets it can't
     reach, and digs back into the ground after a minute of quiet. */

/* ---------------------------------------------------------------- game events and vibrations */
const GameEvents = (() => {
  const B = BID;
  const FREQ = { step: 1, swim: 1, flap: 1, projectile_land: 2, hit_ground: 2, splash: 2, item_interact_finish: 3, projectile_shoot: 3, instrument_play: 3, entity_action: 4, elytra_glide: 4, unequip: 4, entity_dismount: 5, equip: 5, entity_interact: 6, shear: 6, entity_mount: 6, entity_damage: 7, drink: 8, eat: 8, container_close: 9, block_close: 9, block_deactivate: 9, block_detach: 9, container_open: 10, block_open: 10, block_activate: 10, block_attach: 10, prime_fuse: 10, note_block_play: 10, block_change: 11, block_destroy: 12, fluid_pickup: 12, block_place: 13, fluid_place: 13, entity_place: 14, lightning_strike: 14, teleport: 14, entity_die: 15, explode: 15 };
  for (let i = 1; i <= 15; i++) FREQ['resonate_' + i] = i;
  // what sneaking hides (#ignore_vibrations_sneaking)
  const SNEAK = new Set(['hit_ground', 'projectile_shoot', 'step', 'swim', 'item_interact_start', 'item_interact_finish']);
  // wool and carpets muffle what happens on them (#dampens_vibrations); wool blocks them (#occludes_vibration_signals)
  const DAMP = new Uint8Array(BLOCKS.length), OCCL = new Uint8Array(BLOCKS.length);
  for (const d of BLOCKS) { if (/_wool$/.test(d.name)) DAMP[d.id] = OCCL[d.id] = 1; if (/_carpet$/.test(d.name) && d.name !== 'moss_carpet' && d.name !== 'pale_moss_carpet') DAMP[d.id] = 1; }
  const dampItem = s => s && /_wool$|_carpet$/.test(ITEMS[s.id].name) && ITEMS[s.id].name !== 'moss_carpet';
  const KIND = new Map([[B.sculk_sensor, 'sensor'], [B.calibrated_sculk_sensor, 'calibrated'], [B.sculk_shrieker, 'shrieker'], [B.sculk_catalyst, 'catalyst']]);
  const RADIUS = { sensor: 8, calibrated: 16, shrieker: 8, catalyst: 8, warden: 16 };
  const key = (x, y, z) => x + ',' + y + ',' + z, ck = (cx, cz) => cx + ',' + cz;
  // listening blocks, by chunk; wardens; listeners with a vibration waiting or on its way
  const all = new Map(), byChunk = new Map(), wardens = new Set(), pending = new Set();
  function add(x, y, z, kind) {
    const k = key(x, y, z); let L = all.get(k);
    if (L) { L.kind = kind; return L; }
    L = { x, y, z, kind, cand: null, cur: null, travel: 0 };
    all.set(k, L);
    const c = ck(x >> 4, z >> 4); let m = byChunk.get(c); if (!m) byChunk.set(c, m = new Map()); m.set(k, L);
    return L;
  }
  function remove(x, y, z) { const k = key(x, y, z), L = all.get(k); if (!L) return; all.delete(k); pending.delete(L); const m = byChunk.get(ck(x >> 4, z >> 4)); if (m) { m.delete(k); if (!m.size) byChunk.delete(ck(x >> 4, z >> 4)); } }
  World.listeners.chunkLoaded.push(c => { for (const be of c.be.values()) { const kind = KIND.get(World.getBlock(be.x, be.y, be.z)); if (kind) add(be.x, be.y, be.z, kind); } });
  World.listeners.chunkUnloaded.push(c => { const m = byChunk.get(ck(c.cx, c.cz)); if (m) for (const L of [...m.values()]) remove(L.x, L.y, L.z); });
  World.listeners.blockChanged.push((x, y, z, old, id) => {
    if (old === id) return;
    if (KIND.has(old)) remove(x, y, z);
    const kind = KIND.get(id);
    if (kind) { add(x, y, z, kind); if (!World.getBE(x, y, z)) World.setBE(x, y, z, Blocks.newBE(BLOCKS[id].name)); }
  });
  function clear() { all.clear(); byChunk.clear(); wardens.clear(); pending.clear(); }
  // the player behind an event: the player, a player's arrow or other projectile, or what a player rides
  function playerOf(e) {
    if (!e) return null;
    if (e.isPlayer) return e.spectator ? null : e;
    if (e.owner && e.owner.isPlayer) return e.owner;
    if (e.passengers && e.passengers[0] && e.passengers[0].isPlayer) return e.passengers[0];
    return null;
  }
  // VibrationSystem.User.isValidVibration
  function valid(ev, src, affected) {
    if (src) {
      if (src.spectator) return false;
      if (src.isPlayer && src.sneaking && SNEAK.has(ev)) return false;
      if (src.dampensVibrations || (src.type === 'item' && dampItem(src.stack))) return false;
    }
    return !(affected && DAMP[affected]);
  }
  // wool in the way between the event and the listener
  function occluded(x0, y0, z0, x1, y1, z1) {
    const ax = Math.floor(x0) + 0.5, ay = Math.floor(y0) + 0.5, az = Math.floor(z0) + 0.5, bx = Math.floor(x1) + 0.5, by = Math.floor(y1) + 0.5, bz = Math.floor(z1) + 0.5;
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz); if (len < 1e-6) return false;
    const n = Math.ceil(len * 4);
    let last = '';
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.floor(ax + dx * t), y = Math.floor(ay + dy * t), z = Math.floor(az + dz * t), k = x + ',' + y + ',' + z;
      if (k === last) continue; last = k;
      if (OCCL[World.getBlock(x, y, z)]) return true;
    }
    return false;
  }
  // a calibrated sensor listens only for the frequency given by the redstone on its amethyst side
  function calibratedFilter(L) {
    const st = World.getState(L.x, L.y, L.z), back = OPP[(st >> 2) & 7];
    return Redstone.from(L.x, L.y, L.z, back);
  }
  function canReceive(L, ev, x, y, z, src) {
    const st = World.getState(L.x, L.y, L.z);
    if (L.kind === 'shrieker') return !(st & 1) && !!playerOf(src);
    if (Math.floor(x) === L.x && Math.floor(y) === L.y && Math.floor(z) === L.z && (ev === 'block_destroy' || ev === 'block_place')) return false;
    if (!FREQ[ev] || (st & 3) !== 0) return false;
    if (L.kind === 'calibrated') { const f = calibratedFilter(L); if (f !== 0 && f !== FREQ[ev]) return false; }
    return true;
  }
  // VibrationSelector: of the vibrations reaching a listener in one tick the nearest wins (then the higher frequency)
  function offer(L, ev, x, y, z, src, dist) {
    const now = Game.gameTime, c = L.cand;
    if (c) { if (c.tick !== now) return; if (dist > c.dist || (dist === c.dist && (FREQ[ev] || 0) <= (FREQ[c.ev] || 0))) return; }
    L.cand = { ev, x, y, z, src, dist, tick: now };
    pending.add(L);
  }
  function listenerPos(L) { return L.warden ? [L.warden.x, L.warden.eyeY, L.warden.z] : [L.x + 0.5, L.y + 0.5, L.z + 0.5]; }
  function hear(L, ev, x, y, z, src, affected) {
    const [lx, ly, lz] = listenerPos(L), r = RADIUS[L.kind];
    const d2 = (x - lx) ** 2 + (y - ly) ** 2 + (z - lz) ** 2; if (d2 > r * r) return;
    if (L.kind === 'catalyst') { if (ev === 'entity_die') Sculk.catalystHears(L, src); return; }
    if (L.kind === 'shrieker') { if (ev !== 'sculk_sensor_tendrils_clicking') return; }
    else if (L.kind === 'warden') { if (!FREQ[ev] && ev !== 'shriek' && ev !== 'sculk_sensor_tendrils_clicking') return; }
    else if (!FREQ[ev]) return;
    if (L.cur) return;
    // Sneak 100: a sensor or warden in range didn't hear a sneaking player
    if (src && src.isPlayer && src.sneaking && SNEAK.has(ev) && L.kind !== 'shrieker') Advancements.fire('avoid_vibration');
    if (!valid(ev, src, affected)) return;
    if (L.kind === 'warden' ? !L.warden.canHear() : !canReceive(L, ev, x, y, z, src)) return;
    if (occluded(x, y, z, lx, ly, lz)) return;
    offer(L, ev, x, y, z, src, Math.sqrt(d2));
  }
  // something happened at (x, y, z), caused by src (an entity, or null), to the block affected (or 0)
  function emit(ev, x, y, z, src, affected) {
    if (!all.size && !wardens.size) return;
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const m = byChunk.get(ck(cx + dx, cz + dz)); if (!m) continue;
      for (const L of m.values()) hear(L, ev, x, y, z, src, affected);
    }
    for (const w of wardens) { if (w.removed || w.dead) { wardens.delete(w); continue; } hear(w.listener, ev, x, y, z, src, affected); }
  }
  // the vibration particle flies to the listener and lands when the vibration does
  function particle(L, v, ticks) {
    const [lx, ly, lz] = listenerPos(L), sx = v.x, sy = v.y, sz = v.z, life = Math.max(1, ticks);
    const p = Particles.generic(sx, sy, sz, 0, 0, 0, { sprite: 'vibration', life: life + 1, grav: 0, drag: 1, phys: false, size: 0.13, bright: true });
    p.r = 0.42; p.g = 0.9; p.b = 0.86;
    p.update = s => { const [tx, ty, tz] = L.warden && !L.warden.removed ? listenerPos(L) : [lx, ly, lz]; const f = Math.min(1, s.age / life); s.x = sx + (tx - sx) * f; s.y = sy + (ty - sy) * f + Math.sin(f * Math.PI) * 0.4; s.z = sz + (tz - sz) * f; };
  }
  function tick() {
    if (!pending.size) return;
    const now = Game.gameTime;
    for (const L of pending) {
      if (L.warden ? (L.warden.removed || L.warden.dead) : !all.has(key(L.x, L.y, L.z))) { pending.delete(L); continue; }
      if (!L.cur && L.cand && L.cand.tick < now) { L.cur = L.cand; L.cand = null; L.travel = Math.floor(L.cur.dist); particle(L, L.cur, L.travel); }
      if (L.cur && --L.travel <= 0) { const v = L.cur; L.cur = null; receive(L, v); }
      if (!L.cur && !L.cand) pending.delete(L);
    }
  }
  function receive(L, v) {
    if (L.kind === 'warden') { L.warden.onVibration(v.ev, v.x, v.y, v.z, v.src); return; }
    if (L.kind === 'shrieker') { Sculk.tryShriek(L.x, L.y, L.z, playerOf(v.src)); return; }
    sensorActivate(L, v);
  }
  // ---------------------------------------------------------------- sculk sensors
  function sensorActivate(L, v) {
    const { x, y, z } = L, id = World.getBlock(x, y, z), st = World.getState(x, y, z);
    if (!KIND.has(id) || (st & 3) !== 0) return;
    let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE(BLOCKS[id].name); World.setBE(x, y, z, be); }
    const f = FREQ[v.ev] || 0, r = RADIUS[L.kind];
    const dist = Math.hypot(Math.floor(v.x) - x, Math.floor(v.y) - y, Math.floor(v.z) - z);
    be.freq = f; be.power = Math.max(1, 15 - Math.floor(15 / r * dist));
    World.setBlock(x, y, z, id, (st & ~3) | 1, 4);
    Ticks.schedule(x, y, z, L.kind === 'calibrated' ? 10 : 30, id);
    Redstone.update(x, y, z); Redstone.update(x, y - 1, z); Redstone.analogChanged(x, y, z);
    // amethyst blocks next to it pass the frequency on
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      if (World.getBlock(nx, ny, nz) !== B.amethyst_block) continue;
      emit('resonate_' + f, nx + 0.5, ny + 0.5, nz + 0.5, v.src, B.amethyst_block);
      Sound.play('amethyst_block_resonate', null, { x: nx, y: ny, z: nz, pitch: Math.pow(2, (f - 8) / 12) });
    }
    emit('sculk_sensor_tendrils_clicking', x + 0.5, y + 0.5, z + 0.5, v.src);
    if (!(st & 128)) Sound.play('sculk_clicking', null, { x, y, z });
  }
  // the scheduled tick: active -> cooldown (10 ticks) -> inactive
  function sensorTick(x, y, z, id, st) {
    const ph = st & 3;
    if (ph === 1) {
      World.setBlock(x, y, z, id, (st & ~3) | 2, 4);
      const be = World.getBE(x, y, z); if (be) be.power = 0;
      Ticks.schedule(x, y, z, 10, id);
      Redstone.update(x, y, z); Redstone.update(x, y - 1, z); Redstone.analogChanged(x, y, z);
    } else if (ph === 2) {
      World.setBlock(x, y, z, id, st & ~3, 4);
      if (!(st & 128)) Sound.play('sculk_clicking_stop', null, { x, y, z });
    }
  }
  // what a comparator reads: the frequency while active
  function sensorAnalog(x, y, z) { if ((World.getState(x, y, z) & 3) !== 1) return 0; const be = World.getBE(x, y, z); return be && be.freq || 0; }
  // standing on a sensor sets it off (even sneaking); a player on a shrieker makes it shriek
  function stepOn(e, x, y, z, id) {
    if (e.type === 'warden' || e.spectator) return;
    if (id === B.sculk_shrieker) { const p = playerOf(e); if (p) Sculk.tryShriek(x, y, z, p); return; }
    const L = all.get(key(x, y, z)); if (!L || L.cur || (World.getState(x, y, z) & 3) !== 0) return;
    if (!canReceive(L, 'step', x + 0.5, y + 0.5, z + 0.5, e)) return;
    const dist = Math.hypot(e.x - x - 0.5, e.y - y - 0.5, e.z - z - 0.5);
    L.cand = null; offer(L, 'step', e.x, e.y, e.z, e, dist);
  }
  function addWarden(w) { w.listener = { warden: w, kind: 'warden', cand: null, cur: null, travel: 0 }; wardens.add(w); }
  return { FREQ, emit, tick, clear, sensorTick, sensorAnalog, stepOn, addWarden, playerOf, KIND, listeners: all, DAMP, actor: null };
})();

/* ---------------------------------------------------------------- shriekers, catalysts and spreading sculk */
const Sculk = (() => {
  const B = BID;
  // a vein's faces in its state: north 1, south 2, west 4, east 8, up 16, down 32 (128: waterlogged)
  const FB = [32, 16, 1, 2, 4, 8];
  const REPL = new Uint8Array(BLOCKS.length);
  for (const n of ['stone', 'granite', 'diorite', 'andesite', 'tuff', 'deepslate', 'dirt', 'grass_block', 'podzol', 'coarse_dirt', 'mycelium', 'rooted_dirt', 'moss_block', 'mud', 'muddy_mangrove_roots', 'crimson_nylium', 'warped_nylium', 'netherrack', 'basalt', 'blackstone', 'sand', 'red_sand', 'gravel', 'soul_sand', 'soul_soil', 'calcite', 'smooth_basalt', 'clay', 'dripstone_block', 'end_stone', 'red_sandstone', 'sandstone', 'terracotta'])
    if (BID[n] !== undefined) REPL[BID[n]] = 1;
  for (const d of BLOCKS) if (/_terracotta$/.test(d.name) && !/glazed/.test(d.name)) REPL[d.id] = 1;
  const REPL_WG = REPL.slice();
  for (const n of ['deepslate_bricks', 'deepslate_tiles', 'cobbled_deepslate', 'cracked_deepslate_bricks', 'cracked_deepslate_tiles', 'polished_deepslate']) if (BID[n] !== undefined) REPL_WG[BID[n]] = 1;
  const sturdy = id => id !== 0 && (OPAQUE[id] || (SOLID[id] === 1 && (BLOCKS[id].model === 'cube' || BLOCKS[id].model === 'glazed')));
  const isWater = (id, st) => id === B.water && (st & 7) === 0;
  const get = World.getBlock.bind(World), state = World.getState.bind(World);

  // ---------------------------------------------------------------- shriekers (state: 1 shrieking, 2 can summon)
  function warnTracker(p) { return p.wardenWarn || (p.wardenWarn = { level: 0, cooldown: 0, since: 0 }); }
  // the player's warning level goes down by one after ten minutes without a warning
  function tickPlayer(p) {
    const w = p.wardenWarn; if (!w) return;
    if (w.since >= 12000) { if (w.level > 0) w.level--; w.since = 0; } else w.since++;
    if (w.cooldown > 0) w.cooldown--;
  }
  const canRespond = st => (st & 2) && Game.difficulty !== 'peaceful' && Game.rules.doWardenSpawning !== false;
  function tryWarn(x, y, z, p) {
    // not while a warden is about (within 24 blocks on each axis)
    for (const e of Entities.list) if (e.type === 'warden' && !e.dead && !e.removed && Math.abs(e.x - x) <= 24 && Math.abs(e.y - y) <= 24 && Math.abs(e.z - z) <= 24) return -1;
    const w = warnTracker(p);
    if (w.cooldown > 0) return -1;
    w.level = Math.min(4, w.level + 1); w.cooldown = 200; w.since = 0;
    return w.level;
  }
  function tryShriek(x, y, z, p) {
    if (!p || get(x, y, z) !== B.sculk_shrieker) return;
    const st = state(x, y, z); if (st & 1) return;
    const be = World.getBE(x, y, z) || (World.setBE(x, y, z, Blocks.newBE('sculk_shrieker')), World.getBE(x, y, z));
    be.warning = 0;
    if (canRespond(st)) { const lv = tryWarn(x, y, z, p); if (lv < 0) return; be.warning = lv; }
    World.setBlock(x, y, z, B.sculk_shrieker, st | 1, 4);
    Ticks.schedule(x, y, z, 90, B.sculk_shrieker);
    Sound.play('sculk_shrieker_shriek', null, { x, y, z });
    // rings rising from its mouth, one every 5 ticks
    for (let i = 0; i < 10; i++) {
      const q = Particles.generic(x + 0.5, y + 0.5 + 0.05, z + 0.5, 0, 0.1, 0, { life: 30, grav: 0, drag: 1, phys: false, size: 0.42, bright: false });
      q.r = 0.55; q.g = 0.8; q.b = 0.78; q.a = 0; q.spriteFn = s => 'shriek_' + Math.min(3, Math.floor(s.age / 8));
      q.life = 30 + i * 5; q.update = s => { if (s.age < i * 5) { s.y = s.py = y + 0.55; s.vy = 0; s.a = 0; return; } s.vy = 0.1; s.a = Math.max(0, 0.9 - (s.age - i * 5) / 30); };
    }
    GameEvents.emit('shriek', x + 0.5, y + 0.5, z + 0.5, p);
  }
  function shriekerTick(x, y, z, st) {
    if (!(st & 1)) return;
    World.setBlock(x, y, z, B.sculk_shrieker, st & ~1, 4);
    const be = World.getBE(x, y, z), lv = be ? be.warning || 0 : 0;
    if (!canRespond(st) || lv <= 0) return;
    if (!(lv >= 4 && summonWarden(x, y, z))) {
      // the warden answers from somewhere out in the dark
      const SND = [null, 'warden_nearby_close', 'warden_nearby_closer', 'warden_nearby_closest', 'warden_listening_angry'];
      Sound.play(SND[Math.min(4, lv)], null, { x: x + (Math.random() * 2 - 1) * 10, y: y + (Math.random() * 2 - 1) * 10, z: z + (Math.random() * 2 - 1) * 10 });
    }
    darknessAround(x + 0.5, y + 0.5, z + 0.5, 40);
  }
  // SpawnUtil.trySpawnMob: 20 tries within 5 blocks across and 6 up or down, standing on something solid
  function summonWarden(x, y, z) {
    for (let i = 0; i < 20; i++) {
      const sx = x + Math.floor(Math.random() * 11) - 5, sz = z + Math.floor(Math.random() * 11) - 5;
      for (let sy = y + 6; sy >= y - 6; sy--) {
        if (!sturdy(get(sx, sy - 1, sz))) continue;
        let free = true; for (let k = 0; k < 3; k++) { const id = get(sx, sy + k, sz); if (SOLID[id] || (BLOCKS[id].fluid && BLOCKS[id].fluid !== 'water')) { free = false; break; } }
        if (!free) continue;
        const w = Mobs.create('warden', sx + 0.5, sy, sz + 0.5); if (!w) return false;
        w.yaw = w.bodyYaw = Math.random() * Math.PI * 2;
        Entities.add(w); w.emerge();
        return true;
      }
    }
    return false;
  }
  // darkness for 13 seconds for players within range who don't already have most of it
  function darknessAround(x, y, z, r) {
    const p = Game.player; if (!p || p.dead || p.spectator || p.creative) return;
    if ((p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 > r * r) return;
    const e = p.effect('darkness'); if (e && e.dur >= 200) return;
    p.addEffect('darkness', 260, 0, { ambient: false, particles: false });
  }

  // ---------------------------------------------------------------- catalysts
  function catalystHears(L, e) {
    if (!e || !(e.living || e.isPlayer) || e.xpConsumed) return;
    if (get(L.x, L.y, L.z) !== B.sculk_catalyst) return;
    const be = World.getBE(L.x, L.y, L.z) || (World.setBE(L.x, L.y, L.z, Blocks.newBE('sculk_catalyst')), World.getBE(L.x, L.y, L.z));
    // the experience it would have dropped becomes charge where it died
    let xp = 0;
    if (e.isPlayer) { if (!Game.rules.keepInventory) xp = Math.min(100, (e.xpLevel || 0) * 7); }
    else if (Game.rules.doMobLoot) xp = e.xpValue ? e.xpValue() : 0;
    e.xpConsumed = true;
    if (xp > 0) addCursors(be, Math.floor(e.x), Math.floor(e.y + 0.5), Math.floor(e.z), xp);
    // bloom
    const st = state(L.x, L.y, L.z);
    World.setBlock(L.x, L.y, L.z, B.sculk_catalyst, st | 1, 4); Ticks.schedule(L.x, L.y, L.z, 8, B.sculk_catalyst);
    for (let i = 0; i < 2; i++) soul(L.x + 0.5 + (Math.random() - 0.5) * 0.4, L.y + 1.15, L.z + 0.5 + (Math.random() - 0.5) * 0.4);
    Sound.play('sculk_catalyst_bloom', null, { x: L.x, y: L.y, z: L.z, pitch: 0.6 + Math.random() * 0.4 });
  }
  function soul(x, y, z) {
    const q = Particles.generic(x, y, z, 0, 0.02, 0, { life: 40 + Math.floor(Math.random() * 20), grav: 0, drag: 0.96, phys: false, size: 0.12, bright: true });
    q.r = 0.45; q.g = 0.85; q.b = 0.82; q.spriteFn = s => 'sculk_soul_' + Math.min(3, Math.floor(s.age / s.life * 4)); q.alphaFn = s => Math.max(0, 1 - s.age / s.life);
  }
  function addCursors(be, x, y, z, charge) {
    be.cursors = be.cursors || [];
    while (charge > 0) { const n = Math.min(charge, 1000); if (be.cursors.length < 32) be.cursors.push({ x, y, z, charge: n, decay: 1, delay: 0, faces: null }); charge -= n; }
  }
  // ---------------------------------------------------------------- spreading (the game's SculkSpreader and MultifaceSpreader)
  const P = { cost: 10, noGrowth: 4, decayRate: 10, extraDecay: 5 }, P_WG = { cost: 50, noGrowth: 1, decayRate: 5, extraDecay: 10, wg: true };
  const veinFaces = st => { const f = []; for (let d = 0; d < 6; d++) if (st & FB[d]) f.push(d); return f; };
  const PERP = [[2, 3, 4, 5], [2, 3, 4, 5], [0, 1, 4, 5], [0, 1, 4, 5], [0, 1, 2, 3], [0, 1, 2, 3]];
  // put a vein face at t, clinging to the block on its side 'face' (never to sculk or a catalyst)
  function placeVein(tx, ty, tz, face, sx, sy, sz, wg) {
    const ax = tx + DX[face], ay = ty + DY[face], az = tz + DZ[face], a = get(ax, ay, az);
    if (a === B.sculk || a === B.sculk_catalyst || !sturdy(a)) return false;
    if (Math.abs(tx - sx) + Math.abs(ty - sy) + Math.abs(tz - sz) === 2 && sturdy(get(sx - DX[face], sy - DY[face], sz - DZ[face]))) return false;
    const id = get(tx, ty, tz), st = state(tx, ty, tz);
    if (id === B.sculk_vein) { if (st & FB[face]) return false; World.setBlock(tx, ty, tz, id, st | FB[face]); return true; }
    if (id !== 0 && !isWater(id, st) && !(BLOCKS[id].replaceable && !BLOCKS[id].fluid && !/fire$/.test(BLOCKS[id].name))) return false;
    World.setBlock(tx, ty, tz, B.sculk_vein, FB[face] | (isWater(id, st) ? 128 : 0));
    void wg; return true;
  }
  // spread veins from one face of the block at (x, y, z) toward the four sides: same block, along the surface, around an edge
  function spreadFrom(x, y, z, f, d2, wg) {
    if (placeVein(x, y, z, d2, x, y, z, wg)) return true;
    if (placeVein(x + DX[d2], y + DY[d2], z + DZ[d2], f, x, y, z, wg)) return true;
    return placeVein(x + DX[d2] + DX[f], y + DY[d2] + DY[f], z + DZ[d2] + DZ[f], OPP[d2], x, y, z, wg);
  }
  function spreadAll(x, y, z, wg) {
    const id = get(x, y, z), faces = id === B.sculk_vein ? veinFaces(state(x, y, z)) : [0, 1, 2, 3, 4, 5];
    let n = 0;
    for (const f of faces) for (const d2 of PERP[f]) if (spreadFrom(x, y, z, f, d2, wg)) n++;
    return n;
  }
  // veins in the same space only (where something died in the open)
  function spreadSameSpace(x, y, z) {
    const id = get(x, y, z), st = state(x, y, z);
    if (id !== 0 && !isWater(id, st) && id !== B.sculk_vein) return false;
    let n = 0;
    for (let d = 0; d < 6; d++) if (placeVein(x, y, z, d, x, y, z)) n++;
    return n > 0;
  }
  // a vein turns the block it clings to into sculk
  function veinToSculk(x, y, z, p) {
    const st = state(x, y, z), faces = veinFaces(st).sort(() => Math.random() - 0.5), R = p.wg ? REPL_WG : REPL;
    for (const d of faces) {
      const bx = x + DX[d], by = y + DY[d], bz = z + DZ[d];
      if (!R[get(bx, by, bz)]) continue;
      World.setBlock(bx, by, bz, B.sculk, 0);
      Sound.play('sculk_block_spread', null, { x: bx, y: by, z: bz });
      spreadAll(bx, by, bz, p.wg);
      for (let d3 = 0; d3 < 6; d3++) { if (d3 === OPP[d]) continue; const nx = bx + DX[d3], ny = by + DY[d3], nz = bz + DZ[d3]; if (get(nx, ny, nz) === B.sculk_vein) discharge(nx, ny, nz); }
      return true;
    }
    return false;
  }
  // a vein lets go of faces on sculk (and disappears if none are left)
  function discharge(x, y, z) {
    if (get(x, y, z) !== B.sculk_vein) return;
    let st = state(x, y, z);
    for (let d = 0; d < 6; d++) if ((st & FB[d]) && get(x + DX[d], y + DY[d], z + DZ[d]) === B.sculk) st &= ~FB[d];
    if (!(st & 63)) World.setBlock(x, y, z, st & 128 ? B.water : 0, 0);
    else if (st !== state(x, y, z)) World.setBlock(x, y, z, B.sculk_vein, st);
  }
  // sculk with charge on it may grow a sensor (or, one time in eleven, a shrieker) on top
  function canGrow(x, y, z) {
    const ab = get(x, y + 1, z), as = state(x, y + 1, z);
    if (ab !== 0 && !isWater(ab, as)) return false;
    let n = 0;
    for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) { const id = get(x + dx, y + dy, z + dz); if (id === B.sculk_sensor || id === B.sculk_shrieker) if (++n > 2) return false; }
    return true;
  }
  function sculkCharge(c, root, p) {
    const i = c.charge;
    if (!i || Math.floor(Math.random() * p.decayRate) !== 0) return i;
    const near = (c.x - root.x) ** 2 + (c.y - root.y) ** 2 + (c.z - root.z) ** 2 < p.noGrowth * p.noGrowth;
    if (!near && canGrow(c.x, c.y, c.z)) {
      if (Math.floor(Math.random() * p.cost) < i) {
        const wet = isWater(get(c.x, c.y + 1, c.z), state(c.x, c.y + 1, c.z)) ? 128 : 0;
        const shr = Math.floor(Math.random() * 11) === 0;
        World.setBlock(c.x, c.y + 1, c.z, shr ? B.sculk_shrieker : B.sculk_sensor, (shr && p.wg ? 2 : 0) | wet);
        World.setBE(c.x, c.y + 1, c.z, Blocks.newBE(shr ? 'sculk_shrieker' : 'sculk_sensor'));
        Sound.play('sculk_block_spread', null, { x: c.x, y: c.y + 1, z: c.z });
      }
      return Math.max(0, i - p.cost);
    }
    if (Math.floor(Math.random() * p.extraDecay) !== 0) return i;
    if (near) return i - 1;
    const f = (Math.sqrt((c.x - root.x) ** 2 + (c.y - root.y) ** 2 + (c.z - root.z) ** 2) - p.noGrowth) ** 2, j = (24 - p.noGrowth) ** 2;
    return i - Math.max(1, Math.floor(i * Math.min(1, f / j) * 0.5));
  }
  // the 18 neighbours that aren't corners, shuffled
  const NB = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz); if (m > 0 && m < 3) NB.push([dx, dy, dz]); }
  const unobstructed = (x, y, z, d) => !sturdy(get(x + DX[d], y + DY[d], z + DZ[d]));
  function movementOk(x, y, z, o) {
    if (Math.abs(o[0]) + Math.abs(o[1]) + Math.abs(o[2]) === 1) return true;
    const fx = o[0] < 0 ? 4 : 5, fy = o[1] < 0 ? 0 : 1, fz = o[2] < 0 ? 2 : 3;
    if (o[0] === 0) return unobstructed(x, y, z, fy) || unobstructed(x, y, z, fz);
    if (o[1] === 0) return unobstructed(x, y, z, fx) || unobstructed(x, y, z, fz);
    return unobstructed(x, y, z, fx) || unobstructed(x, y, z, fy);
  }
  function hasSubstrate(x, y, z, p) { if (get(x, y, z) !== B.sculk_vein) return false; const st = state(x, y, z), R = p.wg ? REPL_WG : REPL; for (let d = 0; d < 6; d++) if ((st & FB[d]) && R[get(x + DX[d], y + DY[d], z + DZ[d])]) return true; return false; }
  function nextPos(x, y, z, p) {
    let best = null;
    for (const o of NB.slice().sort(() => Math.random() - 0.5)) {
      const nx = x + o[0], ny = y + o[1], nz = z + o[2], id = get(nx, ny, nz);
      if ((id === B.sculk || id === B.sculk_vein) && movementOk(x, y, z, o)) { best = [nx, ny, nz]; if (hasSubstrate(nx, ny, nz, p)) break; }
    }
    return best;
  }
  function updateCursor(c, root, p) {
    if (c.delay > 0) { c.delay--; return; }
    let id = get(c.x, c.y, c.z);
    let kind = id === B.sculk ? 'sculk' : id === B.sculk_vein ? 'vein' : 'default';
    // veins first
    let spread = false;
    if (kind === 'default') spread = c.faces === null ? spreadSameSpace(c.x, c.y, c.z) : c.faces.length ? regrow(c.x, c.y, c.z, c.faces) : false;
    else spread = spreadAll(c.x, c.y, c.z, p.wg) > 0;
    if (spread) { Sound.play('sculk_block_spread', null, { x: c.x, y: c.y, z: c.z }); if (kind === 'default') { id = get(c.x, c.y, c.z); } }
    // then the charge
    if (kind === 'vein') c.charge = veinToSculk(c.x, c.y, c.z, p) ? c.charge - 1 : Math.floor(Math.random() * p.decayRate) === 0 ? Math.floor(c.charge * 0.5) : c.charge;
    else if (kind === 'sculk') c.charge = sculkCharge(c, root, p);
    else c.charge = c.decay > 0 ? c.charge : 0;
    if (c.charge <= 0) { if (kind === 'vein') discharge(c.x, c.y, c.z); return; }
    const np = nextPos(c.x, c.y, c.z, p);
    if (np) {
      if (kind === 'vein') discharge(c.x, c.y, c.z);
      c.x = np[0]; c.y = np[1]; c.z = np[2];
      if (p.wg && (c.x - root.x) ** 2 + (c.z - root.z) ** 2 >= 225) { c.charge = 0; return; }
      id = get(c.x, c.y, c.z);
    }
    if (id === B.sculk_vein) c.faces = veinFaces(state(c.x, c.y, c.z)); else if (id === B.sculk) c.faces = [];
    c.decay = kind === 'default' ? Math.max(c.decay - 1, 0) : 1;
    c.delay = 1;
  }
  function regrow(x, y, z, faces) {
    const id = get(x, y, z), st = state(x, y, z);
    if (id !== 0 && !isWater(id, st)) return false;
    let n = 0; for (const d of faces) if (placeVein(x, y, z, d, x, y, z)) n++;
    return n > 0;
  }
  // all of a catalyst's charges move every other tick; charges that meet merge
  function updateCursors(be, root, p) {
    if (!be.cursors || !be.cursors.length) return;
    const out = [], at = new Map();
    for (const c of be.cursors) {
      if (Math.abs(c.x - root.x) > 1024 || Math.abs(c.z - root.z) > 1024) continue;
      updateCursor(c, root, p);
      if (c.charge <= 0) { pop(c.x, c.y, c.z); continue; }
      const k = c.x + ',' + c.y + ',' + c.z, o = at.get(k);
      if (!o) { at.set(k, c); out.push(c); }
      else if (!p.wg && o.charge + c.charge <= 1000) { o.charge += c.charge; o.decay = Math.max(o.decay, c.decay); }
      else { out.push(c); if (c.charge < o.charge) at.set(k, c); }
    }
    be.cursors = out;
    for (const c of at.values()) if (Math.random() < 0.5) chargeFleck(c.x, c.y, c.z, c.charge);
  }
  function chargeFleck(x, y, z, charge) {
    const n = Math.min(3, Math.floor(Math.log1p(charge) / 2.3) + 1);
    for (let i = 0; i < n; i++) { const q = Particles.generic(x + Math.random(), y + 1.02, z + Math.random(), 0, 0, 0, { life: 20 + Math.floor(Math.random() * 10), grav: 0, drag: 1, phys: false, size: 0.09, bright: true }); q.r = 0.2; q.g = 0.55; q.b = 0.6; q.spriteFn = s => 'sculk_charge_' + Math.min(3, Math.floor(s.age / s.life * 4)); }
  }
  function pop(x, y, z) { for (let i = 0; i < 3; i++) { const q = Particles.generic(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 1.05, z + 0.5 + (Math.random() - 0.5) * 0.6, 0, 0.01, 0, { life: 12, grav: 0, drag: 1, phys: false, size: 0.08, bright: true }); q.r = 0.3; q.g = 0.7; q.b = 0.75; q.sprite = 'sculk_charge_1'; } }
  // the catalyst block entity's tick
  function catalystTick(be) { if (get(be.x, be.y, be.z) !== B.sculk_catalyst) return; updateCursors(be, be, P); }
  // a sculk patch as world generation grows it (the game's SculkPatchFeature: charges of 32 spread from one
  // open spot over 64 updates, maybe a catalyst underneath, and for ancient cities a few shriekers that can summon)
  function worldgenPatch(x, y, z, o) {
    o = Object.assign({ charges: 10, amount: 32, attempts: 64, catalyst: 0.5, shriekers: 0 }, o || {});
    const id = get(x, y, z); if (id !== 0 && !isWater(id, state(x, y, z))) return false;
    let support = false; for (let d = 0; d < 6; d++) if (sturdy(get(x + DX[d], y + DY[d], z + DZ[d]))) support = true;
    if (!support) return false;
    const be = { cursors: [] }, root = { x, y, z };
    for (let k = 0; k < o.charges; k++) addCursors(be, x, y, z, o.amount);
    for (let i = 0; i < o.attempts && be.cursors.length; i++) updateCursors(be, root, P_WG);
    if (Math.random() <= o.catalyst && sturdy(get(x, y - 1, z))) { World.setBlock(x, y - 1, z, B.sculk_catalyst, 0); World.setBE(x, y - 1, z, Blocks.newBE('sculk_catalyst')); }
    for (let i = 0; i < o.shriekers; i++) {
      const sx = x + Math.floor(Math.random() * 5) - 2, sz = z + Math.floor(Math.random() * 5) - 2;
      if (get(sx, y, sz) === 0 && sturdy(get(sx, y - 1, sz))) { World.setBlock(sx, y, sz, B.sculk_shrieker, 2); World.setBE(sx, y, sz, Blocks.newBE('sculk_shrieker')); }
    }
    return true;
  }
  // scheduled ticks: the catalyst stops blooming after 8 ticks; the shrieker stops shrieking after 90
  function scheduledTick(x, y, z, id, st) {
    if (id === B.sculk_catalyst) { if (st & 1) World.setBlock(x, y, z, id, st & ~1, 4); return true; }
    if (id === B.sculk_shrieker) { shriekerTick(x, y, z, st); return true; }
    return false;
  }
  return { tryShriek, scheduledTick, catalystHears, catalystTick, darknessAround, tickPlayer, worldgenPatch, addCursors, spreadAll, FB, REPL, sturdy, warnTracker };
})();

/* ---------------------------------------------------------------- the warden */
class Warden extends Monster {
  constructor(t, x, y, z) {
    super('warden', x, y, z);
    this.kbResist = 1; this.fireImmune = true; this.attackKnockback = 1.5; this.persistent = true; this.dampensVibrations = true;
    this.angerAt = new Map(); this.pose = null; this.poseT = 0; this.poseLen = 0; this.renderYOffset = 0;
    this.digCooldown = 1200; this.vibCooldown = 0; this.sniffCooldown = 0; this.boomCooldown = 0; this.recentProjectile = 0; this.meleeCool = 0; this.repath = 0;
    this.disturbance = null; this.roarTarget = null; this.tendrilT = 0; this.attackT = 0; this.heartT = 0;
  }
  registerGoals() {}
  get noFallDamage() { return false; }
  layers() { return [{ model: 'warden_glow', transparent: true, glow: true, color: e => { const k = e.heartGlow(); return [k, k, k]; } }, { model: 'warden_tendrils', transparent: true, glow: true, when: e => e.tendrilT > 0 }]; }
  heartGlow() { const b = this.heartBeatDelay(), ph = (this.age % b) / b; return 0.55 + 0.45 * Math.max(0, Math.cos(ph * Math.PI * 2)); }
  heartBeatDelay() { return 40 - Math.floor(Math.min(1, Math.max(0, this.angerOf(this.target || this.topEntity()) / 80)) * 30); }
  // ---------------------------------------------------------------- anger
  canTarget(e) { return !!e && !e.dead && !e.removed && (e.living || e.isPlayer) && e !== this && e.type !== 'warden' && e.type !== 'armor_stand' && !(e.isPlayer && (e.creative || e.spectator)); }
  angerOf(e) { return e ? this.angerAt.get(e) || 0 : 0; }
  topEntity() { let best = null, ba = 0; for (const [e, a] of this.angerAt) { if (!this.canTarget(e)) continue; if (a > ba || (a === ba && e.isPlayer)) { best = e; ba = a; } } return best; }
  increaseAnger(e, n, listening) {
    if (!this.canTarget(e)) return;
    this.digCooldown = 1200;
    const wasNotPlayer = !(this.target && this.target.isPlayer);
    const a = Math.min(150, this.angerOf(e) + n); this.angerAt.set(e, a);
    if (e.isPlayer && wasNotPlayer && a >= 80) this.target = null;
    if (listening && this.pose !== 'roar') Sound.play(this.angerOf(this.topEntity()) >= 80 ? 'warden_listening_angry' : 'warden_listening', this);
  }
  setAttackTarget(e) { this.roarTarget = null; this.target = e; this.boomCooldown = 200; }
  // ---------------------------------------------------------------- hearing
  canHear() { return !this.dead && this.vibCooldown <= 0 && this.pose !== 'emerge' && this.pose !== 'dig'; }
  onVibration(ev, x, y, z, src) {
    if (this.dead) return;
    this.vibCooldown = 40; this.tendrilT = 10;
    Sound.play('warden_tendril_clicks', this);
    let pos = [Math.floor(x), Math.floor(y), Math.floor(z)];
    const owner = src && !src.living && !src.isPlayer && src.owner ? src.owner : null;
    if (owner) {
      if (this.distTo(owner) < 30) {
        if (this.recentProjectile > 0) { if (this.canTarget(owner)) pos = [Math.floor(owner.x), Math.floor(owner.y), Math.floor(owner.z)]; this.increaseAnger(owner, 35, true); }
        else this.increaseAnger(owner, 10, true);
      }
      this.recentProjectile = 100;
    } else if (src) this.increaseAnger(src, 35, true);
    const top = this.topEntity();
    if (this.angerOf(this.target || top) < 80 && (owner || !top || top === src)) this.disturbance = pos;
  }
  nearestAttackable(r) { return this.nearest(e => this.canTarget(e) && (e.isPlayer || e.living), r); }
  // ---------------------------------------------------------------- poses
  startPose(p, n) { this.pose = p; this.poseT = 0; this.poseLen = n; this.nav.stop(); }
  emerge() { this.startPose('emerge', 134); Sound.play('warden_emerge', this); Sound.play('warden_agitated', this); this.digCooldown = 1200; }
  // true while the pose keeps it busy
  tickPose() {
    const t = ++this.poseT, n = this.poseLen, p = this.pose;
    this.nav.stop();
    if (p === 'emerge' || p === 'dig') {
      const f = p === 'emerge' ? t / n : 1 - t / n;
      this.renderYOffset = -this.h * (1 - Math.min(1, f * 1.15));
      if (t % 2 === 0) Particles.blockBreak(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z), World.getBlock(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z)) || BID.sculk, 0);
      if (t >= n) { if (p === 'dig') { this.removed = true; return true; } this.pose = null; this.renderYOffset = 0; }
      return true;
    }
    if (p === 'roar') {
      const r = this.roarTarget; if (r) this.lookAt(r.x, r.eyeY, r.z, 30, 30);
      if (t === 25) Sound.play('warden_roar', this, { volume: 3 });
      if (t >= n) { this.pose = null; if (r && this.canTarget(r)) this.setAttackTarget(r); this.roarTarget = null; }
      return true;
    }
    if (p === 'sniff') {
      // a fight (or anger) cuts a sniff short
      if (this.target || this.angerOf(this.topEntity()) >= 80) { this.pose = null; return false; }
      if (t >= n) {
        this.pose = null;
        const e = this.nearestAttackable(24);
        if (e && Math.hypot(e.x - this.x, e.z - this.z) < 6 && Math.abs(e.y - this.y) < 20) this.increaseAnger(e, 35, true);
        if (e && !this.disturbance) this.disturbance = [Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)];
      }
      return true;
    }
    if (p === 'boom') {
      const tg = this.target; if (tg) this.lookAt(tg.x, tg.eyeY, tg.z, 30, 30);
      if (t === 34 && tg && this.canTarget(tg) && Math.hypot(tg.x - this.x, tg.z - this.z) < 15 && Math.abs(tg.y - this.y) < 20) this.sonicBoom(tg);
      if (t >= n) { this.pose = null; this.boomCooldown = 40; }
      return true;
    }
    this.pose = null; return false;
  }
  // straight through anything: 10 damage (scaled for difficulty, through armour) and a big push
  sonicBoom(tg) {
    const sx = this.x, sy = this.y + 1.6, sz = this.z, dx = tg.x - sx, dy = tg.eyeY - sy, dz = tg.z - sz, len = Math.hypot(dx, dy, dz) || 1, ux = dx / len, uy = dy / len, uz = dz / len;
    for (let i = 1; i < Math.floor(len) + 7; i++) {
      const q = Particles.generic(sx + ux * i, sy + uy * i, sz + uz * i, 0, 0, 0, { life: 16, grav: 0, drag: 1, phys: false, size: 0.75, bright: true });
      q.r = 0.55; q.g = 0.92; q.b = 0.95; q.spriteFn = s => 'sonic_boom_' + Math.min(15, s.age);
    }
    Sound.play('warden_sonic_boom', this, { volume: 3 });
    if (tg.hurt(10, 'sonic_boom', this)) {
      const kb = 1 - (tg.kbResist || 0);
      tg.vx += ux * 2.5 * kb; tg.vy += uy * 0.5 * kb; tg.vz += uz * 2.5 * kb;
    }
  }
  // ---------------------------------------------------------------- the brain
  aiStep() {
    // it starts listening once it is out in the world
    if (!this.listener) GameEvents.addWarden(this);
    if (this.vibCooldown > 0) this.vibCooldown--;
    if (this.boomCooldown > 0) this.boomCooldown--;
    if (this.sniffCooldown > 0) this.sniffCooldown--;
    if (this.recentProjectile > 0) this.recentProjectile--;
    if (this.tendrilT > 0) this.tendrilT--;
    if (this.attackT > 0) this.attackT--;
    if (this.meleeCool > 0) this.meleeCool--;
    // anger fades by one a second
    if (this.age % 20 === 0) for (const [e, a] of this.angerAt) { if (a > 1 && this.canTarget(e)) this.angerAt.set(e, a - 1); else this.angerAt.delete(e); }
    if (this.age % 120 === 0) Sculk.darknessAround(this.x, this.y, this.z, 20);
    // its heart beats faster the angrier it is; its voice changes with its mood
    if (this.age % this.heartBeatDelay() === 0 && Game.player && this.distTo(Game.player) < 24) Sound.play('warden_heartbeat', this);
    if (this.pose !== 'emerge' && this.pose !== 'dig' && Math.random() < 1 / 80) { const a = this.angerOf(this.target || this.topEntity()); Sound.play(a >= 80 ? 'warden_angry' : a >= 40 ? 'warden_agitated' : 'warden_ambient', this); }
    if (this.pose && this.tickPose()) return;
    let t = this.target;
    if (t && (!this.canTarget(t) || this.angerOf(t) < 80)) { this.target = t = null; this.nav.stop(); }
    if (t) { this.fight(t); return; }
    // angry at someone: roar, then hunt them
    const top = this.topEntity();
    if (top && this.angerOf(top) >= 80) { this.roarTarget = top; this.startPose('roar', 84); this.increaseAnger(top, 100, false); return; }
    // a minute of calm and it digs back down
    if (--this.digCooldown <= 0 && !this.customName && this.onGround) { this.startPose('dig', 100); Sound.play('warden_dig', this); return; }
    // something heard: go and see
    if (this.disturbance) {
      const [dx, dy, dz] = this.disturbance;
      if ((this.x - dx - 0.5) ** 2 + (this.z - dz - 0.5) ** 2 < 4 || (this.nav.done() && this.age % 20 === 0 && this.investigated > 3)) { this.disturbance = null; this.investigated = 0; }
      else if (this.nav.done() || this.age % 20 === 0) { this.nav.moveTo(dx + 0.5, dy, dz + 0.5, 0.7); this.investigated = (this.investigated || 0) + (this.nav.done() ? 1 : 0); }
      return;
    }
    // something alive nearby: stop and sniff the air
    if (this.sniffCooldown <= 0 && this.nearestAttackable(24)) { this.sniffCooldown = 100 + Math.floor(Math.random() * 101); this.startPose('sniff', 84); Sound.play('warden_sniff', this); return; }
    if (this.nav.done() && Math.random() < 1 / 120) { const r = randomPos(this, 10, 7); if (r) this.nav.moveTo(r[0], r[1], r[2], 0.5); }
  }
  fight(t) {
    this.lookAt(t.x, t.eyeY, t.z, 30, 30);
    const dh = Math.hypot(t.x - this.x, t.z - this.z), dv = Math.abs(t.y - this.y);
    if (this.boomCooldown <= 0 && dh < 15 && dv < 20) { this.startPose('boom', 60); this.boomCooldown = 60; Sound.play('warden_sonic_charge', this, { volume: 3 }); return; }
    if (--this.repath <= 0) { this.repath = 4 + Math.floor(Math.random() * 7); this.nav.moveTo(t.x, t.y, t.z, 1.2, { reach: 1 }); }
    if (this.inMeleeReach(t) && this.meleeCool <= 0 && this.canSee(t)) { this.meleeCool = 18; this.swingArm(); this.doHurtTarget(t); }
  }
  doHurtTarget(t) {
    this.attackT = 10; Sound.play('warden_attack_impact', this);
    this.boomCooldown = Math.max(this.boomCooldown, 40);
    return super.doHurtTarget(t);
  }
  hurt(amount, source, attacker) {
    if (this.pose === 'emerge' || this.pose === 'dig') return false;
    const ok = super.hurt(amount, source, attacker);
    if (ok && !this.dead && attacker) {
      const e = !attacker.living && !attacker.isPlayer && attacker.owner ? attacker.owner : attacker;
      this.increaseAnger(e, 100, false);
      if (!this.target && this.canTarget(e) && (e === attacker || this.distTo(e) < 5)) this.setAttackTarget(e);
    }
    return ok;
  }
  // ---------------------------------------------------------------- how it moves on screen
  animState(s) { s.wardenPose = this.pose; s.poseF = this.poseLen ? this.poseT / this.poseLen : 0; }
  posePart(inst, s, a) {
    const L = inst.parts; if (!L.head) return;
    const p = this.pose, f = this.poseLen ? Math.min(1, (this.poseT + a) / this.poseLen) : 0;
    if (p === 'emerge' || p === 'dig') { const k = Math.sin(f * Math.PI * 6) * 0.5; if (L.right_arm) { L.right_arm.rx = -2.2 + k; L.left_arm.rx = -2.2 - k; } L.head.rx = -0.4; }
    else if (p === 'roar') { const k = Math.sin(Math.min(1, f * 1.5) * Math.PI); L.head.rx = -0.9 * k; if (L.body) L.body.rx = -0.25 * k; if (L.right_arm) { L.right_arm.rz = 0.9 * k; L.left_arm.rz = -0.9 * k; L.right_arm.rx = -0.4 * k; L.left_arm.rx = -0.4 * k; } }
    else if (p === 'sniff') { L.head.rx = 0.35; L.head.ry = Math.sin((this.poseT + a) * 0.25) * 0.6; if (L.body) L.body.rx = 0.15; }
    else if (p === 'boom') { const k = f < 0.57 ? f / 0.57 : Math.max(0, 1 - (f - 0.57) * 4); if (L.right_ribcage) { L.right_ribcage.ry = 1.1 * k; L.left_ribcage.ry = -1.1 * k; } if (L.right_arm) { L.right_arm.rx = 0.6 * k; L.left_arm.rx = 0.6 * k; L.right_arm.rz = 0.5 * k; L.left_arm.rz = -0.5 * k; } L.head.rx = -0.3 * k; if (L.body) L.body.rx = -0.2 * k; }
    if (this.attackT > 0 && L.right_arm) { const k = Math.sin((this.attackT - a) / 10 * Math.PI); L.right_arm.rx = -2 * k; L.left_arm.rx = -2 * k; }
    if (this.tendrilT > 0 && L.right_tendril) { const k = Math.sin((this.tendrilT - a) / 10 * Math.PI * 3) * 0.6; L.right_tendril.ry = k; L.left_tendril.ry = -k; }
  }
}
MobTypes.warden = Warden;

// the warden's glowing spots and heart (always lit, pulsing with its heartbeat) and its tendrils (lit while it hears)
(() => {
  const D = EntityModels.DEFS.warden; if (!D) return;
  EntityModels.def('warden_glow', 128, 128, D.parts, { anim: 'warden', skin: s => {
    const g = 0x5ff5e8, h = 0x9ffaf0;
    for (const [x, y, w, hh] of [[13, 14, 3, 2], [24, 13, 2, 3], [15, 24, 2, 2], [22, 27, 3, 2], [12, 29, 2, 2], [26, 21, 2, 2]]) s.fill(x, y, w, hh, g, 0.1);
    s.fill(18, 18, 4, 4, h, 0.05);
    for (const [x, y] of [[92, 14], [95, 20], [93, 27], [96, 33]]) s.fill(x, y, 2, 2, g, 0.1);
    for (const [x, y] of [[48, 60], [50, 70], [8, 66], [10, 76], [82, 56], [84, 84]]) s.fill(x, y, 2, 2, g, 0.1);
  } });
  EntityModels.def('warden_tendrils', 128, 128, D.parts, { anim: 'warden', skin: s => { s.fill(54, 34, 12, 12, 0x6ffff0, 0.1); s.fill(60, 2, 12, 12, 0x6ffff0, 0.1); } });
})();

// a blooming catalyst opens up and glows
(() => {
  const { def, H } = Tex;
  def('sculk_catalyst_top_bloom', c => { c.copy('sculk_catalyst_top'); c.rect(4, 4, 11, 11, H(0x0d2d36)); c.rect(5, 5, 10, 10, H(0x29dfeb)); c.rect(6, 6, 9, 9, H(0x9ffaf0)); for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) c.px(x, y, H(0x29dfeb)); });
  def('sculk_catalyst_side_bloom', c => { c.copy('sculk_catalyst_side'); for (let x = 3; x < 13; x += 4) { c.rect(x, 8, x + 1, 11, H(0x29dfeb)); c.px(x, 8, H(0x9ffaf0)); } });
})();
