'use strict';
/* Redstone, worked out the way the game does it. Every block can send power (0-15) out of each of its faces
   ("weak" power, which only reaches the block next to it) and some also send "strong" power into the block
   they touch, which a solid block then passes on to the components around it (but not to dust). Dust takes the
   strongest power around it and loses one per block; it powers the block under it and the blocks it points
   into. Components react to their neighbours changing: torches turn off after 2 ticks when the block they hang
   on is powered (and burn out when toggled more than 8 times in 60 ticks), repeaters wait 2-8 ticks, extend
   short pulses to their delay and can be locked from the side, comparators keep, compare or subtract signals
   and read containers and other blocks, observers send a 2 tick pulse when the block they watch changes, lamps
   turn off 4 ticks after losing power, and pistons, doors, trapdoors, gates, note blocks, TNT, hoppers,
   dispensers, droppers, copper bulbs, bells and crafters follow their inputs.
   Dust networks are updated as a whole (every wire's power from its sources, then spread with a bucket queue),
   so long lines change in one step without the game's slow recursive updates; the results are the same. */
const Redstone = (() => {
  const B = BID, N = BLOCKS.length;
  // ---------------------------------------------------------------- what each block is
  const S = { WIRE: 1, TORCH: 2, WALL_TORCH: 3, REPEATER: 4, COMPARATOR: 5, LEVER: 6, BUTTON: 7, PLATE: 8, BLOCK: 9, OBSERVER: 10, DAYLIGHT: 11, TARGET: 12, TRAPPED: 13, HOOK: 14, DETECTOR: 15, ROD: 16, SENSOR: 17, JUKEBOX: 18, LECTERN: 19 };
  const R = { LAMP: 1, PISTON: 2, DOOR: 3, TRAPDOOR: 4, GATE: 5, TNT: 6, NOTE: 7, DISPENSER: 8, HOPPER: 9, RAIL: 10, BULB: 11, CRAFTER: 12, BELL: 13, TORCH: 14, REPEATER: 15, COMPARATOR: 16 };
  const SRC = new Uint8Array(N), REACT = new Uint8Array(N), COND = new Uint8Array(N), ANALOG = new Uint8Array(N);
  for (const d of BLOCKS) {
    const n = d.name, i = d.id;
    if (n === 'redstone_wire') SRC[i] = S.WIRE;
    else if (n === 'redstone_torch') { SRC[i] = S.TORCH; REACT[i] = R.TORCH; }
    else if (n === 'redstone_wall_torch') { SRC[i] = S.WALL_TORCH; REACT[i] = R.TORCH; }
    else if (d.model === 'repeater') { SRC[i] = S.REPEATER; REACT[i] = R.REPEATER; }
    else if (d.model === 'comparator') { SRC[i] = S.COMPARATOR; REACT[i] = R.COMPARATOR; }
    else if (d.model === 'lever') SRC[i] = S.LEVER;
    else if (d.model === 'button') SRC[i] = S.BUTTON;
    else if (d.model === 'plate') SRC[i] = S.PLATE;
    else if (n === 'redstone_block') SRC[i] = S.BLOCK;
    else if (n === 'observer') SRC[i] = S.OBSERVER;
    else if (d.model === 'daylight') SRC[i] = S.DAYLIGHT;
    else if (n === 'target') SRC[i] = S.TARGET;
    else if (n === 'trapped_chest') SRC[i] = S.TRAPPED;
    else if (n === 'tripwire_hook') SRC[i] = S.HOOK;
    else if (n === 'detector_rail') SRC[i] = S.DETECTOR;
    else if (n === 'lightning_rod') SRC[i] = S.ROD;
    else if (d.model === 'sensor') SRC[i] = S.SENSOR;
    else if (n === 'jukebox') SRC[i] = S.JUKEBOX;
    else if (n === 'lectern') SRC[i] = S.LECTERN;
    if (n === 'redstone_lamp') REACT[i] = R.LAMP;
    else if (n === 'piston' || n === 'sticky_piston') REACT[i] = R.PISTON;
    else if (d.model === 'door') REACT[i] = R.DOOR;
    else if (d.model === 'trapdoor') REACT[i] = R.TRAPDOOR;
    else if (d.model === 'gate') REACT[i] = R.GATE;
    else if (n === 'tnt') REACT[i] = R.TNT;
    else if (n === 'note_block') REACT[i] = R.NOTE;
    else if (n === 'dispenser' || n === 'dropper') REACT[i] = R.DISPENSER;
    else if (n === 'hopper') REACT[i] = R.HOPPER;
    else if (n === 'powered_rail' || n === 'activator_rail' || n === 'rail') REACT[i] = R.RAIL;
    else if (n.endsWith('copper_bulb')) REACT[i] = R.BULB;
    else if (n === 'crafter') REACT[i] = R.CRAFTER;
    else if (n === 'bell') REACT[i] = R.BELL;
    // conductors: full solid blocks (redstone blocks and observers are not); double slabs are checked by state
    if (d.opaque && d.solid && n !== 'redstone_block' && n !== 'observer') COND[i] = 1;
    else if (d.model === 'slab') COND[i] = 2;
    // blocks a comparator can read
    if (/chest$|^barrel$|shulker_box$|^dispenser$|^dropper$|^hopper$|^furnace$|^blast_furnace$|^smoker$|^brewing_stand$|^jukebox$|^cake$|candle_cake$|^cauldron$|^composter$|^end_portal_frame$|^respawn_anchor$|^beehive$|^bee_nest$|copper_bulb$|^crafter$|^chiseled_bookshelf$|^decorated_pot$|^lectern$|^detector_rail$|sculk_sensor$/.test(n) && n !== 'ender_chest') ANALOG[i] = 1;
  }
  const SIDES = { 2: [4, 5], 3: [4, 5], 4: [2, 3], 5: [2, 3] };
  const getB = (x, y, z) => World.getBlock(x, y, z), getS = (x, y, z) => World.getState(x, y, z);
  const key = (x, y, z) => ((x & 0xffff) * 65536 + (z & 0xffff)) * 256 + (y + 64);
  const condId = (id, st) => COND[id] === 1 || (COND[id] === 2 && ((st >> 3) & 3) === 2);
  const condAt = (x, y, z) => { const id = getB(x, y, z); return COND[id] !== 0 && condId(id, getS(x, y, z)); };
  // the block a lever or button is fixed to: 0 floor (below), 2 ceiling (above), 1 wall (behind)
  const attachedDir = st => { const f = (st >> 3) & 3; return f === 0 ? 0 : f === 2 ? 1 : OPP[st & 7]; };
  const isDiode = id => SRC[id] === S.REPEATER || SRC[id] === S.COMPARATOR;
  // ---------------------------------------------------------------- dust shape
  // which sides dust is connected to, exactly as its model draws it (connects() is what the model asks)
  function connects(id, st, f) {
    const k = SRC[id];
    if (!k) return false;
    if (k === S.REPEATER) return (st & 7) === f || (st & 7) === OPP[f];
    if (k === S.OBSERVER) return (st & 7) === f;
    return true;
  }
  // sides dust powers: the connected ones; a line with one connection runs on through the other side, and dust
  // with none is a cross (all four sides) unless it was clicked into a dot
  function rawSides(x, y, z) {
    let m = 0;
    const upBlocked = OPAQUE[getB(x, y + 1, z)];
    for (let f = 2; f < 6; f++) {
      const nx = x + DX[f], nz = z + DZ[f], id = getB(nx, y, nz);
      if (connects(id, getS(nx, y, nz), f) || (!OPAQUE[id] && getB(nx, y - 1, nz) === B.redstone_wire) || (!upBlocked && OPAQUE[id] && getB(nx, y + 1, nz) === B.redstone_wire)) m |= 1 << f;
    }
    return m;
  }
  function wireSides(x, y, z, st) {
    let m = rawSides(x, y, z);
    if (!m) return st & 16 ? 0 : 0b111100;
    for (let f = 2; f < 6; f++) if (m === 1 << f) return m | (1 << OPP[f]);
    return m;
  }
  // ---------------------------------------------------------------- signals
  let wireOn = true; // off while dust works out its own power: dust is never powered by dust through a block
  // power that the block at (x,y,z) sends out of face f (into the block at pos + f); strong: the power that goes
  // into a solid block strongly enough for that block to pass it on
  function emit(x, y, z, id, st, f, strong) {
    switch (SRC[id]) {
      case S.WIRE: { if (!wireOn) return 0; const p = st & 15; if (!p || f === 1) return 0; if (f === 0) return p; return (wireSides(x, y, z, st) >> f) & 1 ? p : 0; }
      case S.TORCH: if (st & 8) return 0; return strong ? (f === 1 ? 15 : 0) : (f === 0 ? 0 : 15);
      case S.WALL_TORCH: if (st & 8) return 0; return strong ? (f === 1 ? 15 : 0) : (f === OPP[st & 7] ? 0 : 15);
      case S.REPEATER: return (st & 32) && f === (st & 7) ? 15 : 0;
      case S.COMPARATOR: return f === (st & 7) ? compOut(x, y, z) : 0;
      case S.LEVER: case S.BUTTON: if (!(st & 32)) return 0; return !strong || f === attachedDir(st) ? 15 : 0;
      case S.PLATE: return !strong || f === 0 ? st & 15 : 0;
      case S.BLOCK: return strong ? 0 : 15;
      case S.OBSERVER: return (st & 8) && f === OPP[st & 7] ? 15 : 0;
      case S.DAYLIGHT: case S.TARGET: return strong ? 0 : st & 15;
      case S.TRAPPED: { const p = typeof ChestAnim !== 'undefined' && ChestAnim.isOpen(x, y, z) ? 1 : 0; return !strong || f === 0 ? p : 0; }
      case S.HOOK: if (!(st & 16)) return 0; return !strong || f === OPP[st & 7] ? 15 : 0;
      case S.DETECTOR: if (!(st & 16)) return 0; return !strong || f === 0 ? 15 : 0;
      case S.ROD: if (!(st & 8)) return 0; return !strong || f === OPP[st & 7] ? 15 : 0;
      // sculk sensors: weak power all round, strong into the block below; a calibrated one never powers its amethyst side
      case S.SENSOR: { if ((st & 3) !== 1) return 0; if (id === B.calibrated_sculk_sensor && f === OPP[(st >> 2) & 7]) return 0; const be = World.getBE(x, y, z), p = be && be.power || 0; return !strong || f === 0 ? p : 0; }
      case S.JUKEBOX: return !strong && (st & 1) ? 15 : 0;
      case S.LECTERN: if (!(st & 16)) return 0; return !strong || f === 0 ? 15 : 0;
    }
    return 0;
  }
  // the strong power going into the block at (x,y,z)
  function strongInto(x, y, z) {
    let m = 0;
    for (let f = 0; f < 6; f++) {
      const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f], id = getB(nx, ny, nz);
      if (!SRC[id]) continue;
      const p = emit(nx, ny, nz, id, getS(nx, ny, nz), OPP[f], true);
      if (p > m) { m = p; if (m >= 15) return 15; }
    }
    return m;
  }
  // power reaching (x,y,z) from its neighbour on side f (the game's getSignal)
  function from(x, y, z, f) {
    const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f], id = getB(nx, ny, nz);
    let p = 0;
    if (SRC[id]) p = emit(nx, ny, nz, id, getS(nx, ny, nz), OPP[f], false);
    if (p < 15 && COND[id] && condId(id, getS(nx, ny, nz))) p = Math.max(p, strongInto(nx, ny, nz));
    return p;
  }
  function received(x, y, z) { let m = 0; for (let f = 0; f < 6; f++) { const p = from(x, y, z, f); if (p > m) { m = p; if (m >= 15) break; } } return m; }
  function powered(x, y, z) { for (let f = 0; f < 6; f++) if (from(x, y, z, f) > 0) return true; return false; }
  // ---------------------------------------------------------------- the update queue
  // positions to look at; blocks react in the order they were queued, dust networks are worked out together
  const Q = [];
  let busy = false;
  const OFS = []; // the block, its neighbours and theirs (what the game's neighbour updates reach)
  { const seen = new Set(); for (let a = 0; a < 6; a++) for (let b = -1; b < 6; b++) { const dx = DX[a] + (b >= 0 ? DX[b] : 0), dy = DY[a] + (b >= 0 ? DY[b] : 0), dz = DZ[a] + (b >= 0 ? DZ[b] : 0); const k = dx + ',' + dy + ',' + dz; if (seen.has(k)) continue; seen.add(k); OFS.push(dx, dy, dz); } }
  function region(x, y, z) { for (let i = 0; i < OFS.length; i += 3) Q.push(x + OFS[i], y + OFS[i + 1], z + OFS[i + 2]); }
  function around(x, y, z) { Q.push(x, y, z); for (let f = 0; f < 6; f++) Q.push(x + DX[f], y + DY[f], z + DZ[f]); }
  // a diode's output changed: the block in front and the blocks around that one
  function front(x, y, z, f) { const fx = x + DX[f], fy = y + DY[f], fz = z + DZ[f]; Q.push(fx, fy, fz); for (let g = 0; g < 6; g++) if (g !== OPP[f]) Q.push(fx + DX[g], fy + DY[g], fz + DZ[g]); }
  function flush() {
    if (busy) return;
    busy = true;
    try {
      let guard = 0;
      while (Q.length && guard++ < 4096) {
        const items = Q.splice(0, Q.length), seeds = [], done = new Set();
        for (let i = 0; i < items.length; i += 3) {
          const x = items[i], y = items[i + 1], z = items[i + 2];
          if (y < MINY || y > MAXY) continue;
          const k = key(x, y, z); if (done.has(k)) continue; done.add(k);
          const id = getB(x, y, z);
          if (id === B.redstone_wire) seeds.push(x, y, z);
          else if (REACT[id]) react(x, y, z, id, getS(x, y, z));
        }
        if (seeds.length) updateWires(seeds);
      }
      if (Q.length) Q.length = 0;
    } finally { busy = false; }
  }
  // ---------------------------------------------------------------- dust networks
  function updateWires(seeds) {
    const idx = new Map(), X = [], Y = [], Z = [];
    const add = (x, y, z) => { const k = key(x, y, z); if (idx.has(k) || X.length >= 8192 || getB(x, y, z) !== B.redstone_wire) return; idx.set(k, X.length); X.push(x); Y.push(y); Z.push(z); };
    for (let i = 0; i < seeds.length; i += 3) add(seeds[i], seeds[i + 1], seeds[i + 2]);
    // everything connected (level, one up, one down)
    for (let i = 0; i < X.length; i++) for (let f = 2; f < 6; f++) { const nx = X[i] + DX[f], nz = Z[i] + DZ[f]; add(nx, Y[i], nz); add(nx, Y[i] + 1, nz); add(nx, Y[i] - 1, nz); }
    const n = X.length, P = new Uint8Array(n), out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = [];
    // who feeds whom: dust takes power from dust beside it, from dust one up when the block beside is solid
    // and nothing solid sits on top, and from dust one down when the block beside is not solid
    for (let j = 0; j < n; j++) {
      const x = X[j], y = Y[j], z = Z[j], upCond = condAt(x, y + 1, z);
      for (let f = 2; f < 6; f++) {
        const nx = x + DX[f], nz = z + DZ[f];
        let i = idx.get(key(nx, y, nz)); if (i !== undefined) out[i].push(j);
        const c = condAt(nx, y, nz);
        if (c && !upCond) { i = idx.get(key(nx, y + 1, nz)); if (i !== undefined) out[i].push(j); }
        else if (!c) { i = idx.get(key(nx, y - 1, nz)); if (i !== undefined) out[i].push(j); }
      }
    }
    wireOn = false;
    const buckets = [];
    for (let p = 0; p < 16; p++) buckets.push([]);
    for (let i = 0; i < n; i++) { const p = received(X[i], Y[i], Z[i]); P[i] = p; if (p > 1) buckets[p].push(i); }
    wireOn = true;
    for (let p = 15; p >= 2; p--) for (const i of buckets[p]) { if (P[i] !== p) continue; for (const j of out[i]) if (P[j] < p - 1) { P[j] = p - 1; if (p - 1 > 1) buckets[p - 1].push(j); } }
    const changed = [];
    for (let i = 0; i < n; i++) { const st = getS(X[i], Y[i], Z[i]); if ((st & 15) !== P[i]) { World.setBlock(X[i], Y[i], Z[i], B.redstone_wire, (st & ~15) | P[i]); changed.push(i); } }
    // the blocks around changed dust (other dust there is in this network and already right)
    for (const i of changed) for (let k = 0; k < OFS.length; k += 3) { const x = X[i] + OFS[k], y = Y[i] + OFS[k + 1], z = Z[i] + OFS[k + 2]; if (getB(x, y, z) !== B.redstone_wire) Q.push(x, y, z); }
  }
  // ---------------------------------------------------------------- reacting to power
  function react(x, y, z, id, st) {
    switch (REACT[id]) {
      case R.TORCH: if (!(st & 8) === torchPowered(x, y, z, id, st) && !Ticks.has(x, y, z)) Ticks.schedule(x, y, z, 2); return;
      case R.REPEATER: return repeaterCheck(x, y, z, id, st);
      case R.COMPARATOR: return comparatorCheck(x, y, z, id, st);
      case R.LAMP: { const lit = !!(st & 1), p = powered(x, y, z); if (lit !== p) { if (lit) { if (!Ticks.has(x, y, z)) Ticks.schedule(x, y, z, 4); } else World.setBlock(x, y, z, id, st | 1); } return; }
      case R.PISTON: Pistons.check(x, y, z, id, st); return;
      case R.DOOR: {
        const oy = st & 8 ? y - 1 : y + 1;
        if (getB(x, oy, z) !== id) return;
        const p = powered(x, y, z) || powered(x, oy, z);
        if (p === !!(st & 64)) return;
        const iron = BLOCKS[id].name === 'iron_door';
        if (p !== !!(st & 16)) Sound.play(p ? (iron ? 'iron_door_open' : 'door_open') : (iron ? 'iron_door_close' : 'door_close'), null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
        const set = (yy) => World.setBlock(x, yy, z, id, (getS(x, yy, z) & ~(16 | 64)) | (p ? 16 | 64 : 0));
        set(y); set(oy);
        return;
      }
      case R.TRAPDOOR: {
        const p = powered(x, y, z);
        if (p === !!(st & 64)) return;
        let s2 = (st & ~64) | (p ? 64 : 0);
        if (p !== !!(st & 16)) { s2 = (s2 & ~16) | (p ? 16 : 0); const iron = BLOCKS[id].name === 'iron_trapdoor'; Sound.play((iron ? 'iron_trapdoor_' : 'trapdoor_') + (p ? 'open' : 'close'), null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); }
        World.setBlock(x, y, z, id, s2);
        return;
      }
      case R.GATE: {
        const p = powered(x, y, z);
        if (p === !!(st & 32)) return;
        if (p !== !!(st & 16)) Sound.play(p ? 'gate_open' : 'gate_close', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
        World.setBlock(x, y, z, id, (st & ~48) | (p ? 48 : 0));
        return;
      }
      case R.TNT: if (powered(x, y, z)) { World.setBlock(x, y, z, 0, 0); Explosions.primeTnt(x, y, z, null); region(x, y, z); } return;
      case R.NOTE: { const p = powered(x, y, z); if (p !== !!(st & 32)) { if (p) playNote(x, y, z); World.setBlock(x, y, z, id, st ^ 32); } return; }
      case R.DISPENSER: {
        const p = powered(x, y, z) || powered(x, y + 1, z), trig = !!(st & 8);
        if (p && !trig) { Ticks.schedule(x, y, z, 4); World.setBlock(x, y, z, id, st | 8, 4); }
        else if (!p && trig) World.setBlock(x, y, z, id, st & ~8, 4);
        return;
      }
      case R.HOPPER: { const off = powered(x, y, z); if (off !== !!(st & 8)) World.setBlock(x, y, z, id, st ^ 8, 4); return; }
      case R.RAIL: if (typeof Rails !== 'undefined' && Rails.powerCheck) Rails.powerCheck(x, y, z, id, st); return;
      case R.BULB: {
        const p = powered(x, y, z);
        if (p === !!(st & 2)) return;
        let s2 = st ^ 2;
        if (p) { s2 ^= 1; Sound.play(s2 & 1 ? 'copper_bulb_on' : 'copper_bulb_off', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); }
        World.setBlock(x, y, z, id, s2);
        if ((s2 & 1) !== (st & 1)) analogChanged(x, y, z);
        return;
      }
      case R.CRAFTER: { const p = powered(x, y, z), trig = !!(st & 64); if (p && !trig) { Ticks.schedule(x, y, z, 4); World.setBlock(x, y, z, id, st | 64, 4); } else if (!p && trig) World.setBlock(x, y, z, id, st & ~64, 4); return; }
      case R.BELL: { const p = powered(x, y, z); if (p !== !!(st & 32)) { if (p) Sound.play('bell', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); World.setBlock(x, y, z, id, st ^ 32); } return; }
    }
  }
  // ---------------------------------------------------------------- torches
  const toggles = []; // [key, time] of recent torch changes, for burning out
  function torchPowered(x, y, z, id, st) { return from(x, y, z, SRC[id] === S.TORCH ? 0 : OPP[st & 7]) > 0; }
  function tooOften(x, y, z, log) {
    const k = key(x, y, z), now = Game.gameTime;
    if (log) toggles.push([k, now]);
    let n = 0;
    for (const t of toggles) if (t[0] === k && ++n >= 8) return true;
    return false;
  }
  function torchTick(x, y, z, id, st) {
    const now = Game.gameTime;
    while (toggles.length && now - toggles[0][1] > 60) toggles.shift();
    const p = torchPowered(x, y, z, id, st);
    if (!(st & 8)) {
      if (p) {
        World.setBlock(x, y, z, id, st | 8); region(x, y, z);
        if (tooOften(x, y, z, true)) {
          Sound.play('torch_burnout', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
          for (let i = 0; i < 5; i++) Particles.smokeAt(x + 0.3 + Math.random() * 0.4, y + 0.6 + Math.random() * 0.3, z + 0.3 + Math.random() * 0.4, 0, 0, 0);
          Ticks.schedule(x, y, z, 160);
        }
      }
    } else if (!p && !tooOften(x, y, z, false)) { World.setBlock(x, y, z, id, st & ~8); region(x, y, z); }
  }
  // ---------------------------------------------------------------- repeaters
  const delayOf = st => (((st >> 3) & 3) + 1) * 2;
  function diodeInput(x, y, z, st) {
    const back = OPP[st & 7];
    let p = from(x, y, z, back);
    if (p < 15) { const bx = x + DX[back], bz = z + DZ[back]; if (getB(bx, y, bz) === B.redstone_wire) p = Math.max(p, getS(bx, y, bz) & 15); }
    return p;
  }
  function repLocked(x, y, z, st) {
    for (const f of SIDES[st & 7] || []) { const nx = x + DX[f], nz = z + DZ[f], id = getB(nx, y, nz); if (isDiode(id) && emit(nx, y, nz, id, getS(nx, y, nz), OPP[f], false) > 0) return true; }
    return false;
  }
  // a diode whose output goes into the side or back of another diode gets its ticks first
  function prioritize(x, y, z, st) { const f = st & 7, fx = x + DX[f], fz = z + DZ[f], id = getB(fx, y, fz); return isDiode(id) && (getS(fx, y, fz) & 7) !== f; }
  function repeaterCheck(x, y, z, id, st) {
    const locked = repLocked(x, y, z, st);
    if (locked !== !!(st & 64)) { st = locked ? st | 64 : st & ~64; World.setBlock(x, y, z, id, st); }
    if (locked) return;
    const on = !!(st & 32), want = diodeInput(x, y, z, st) > 0;
    if (on !== want && !Ticks.has(x, y, z)) Ticks.schedule(x, y, z, delayOf(st), id, prioritize(x, y, z, st) ? -3 : on ? -2 : -1);
  }
  function repeaterTick(x, y, z, id, st) {
    if (st & 64) return;
    const on = !!(st & 32), want = diodeInput(x, y, z, st) > 0;
    if (on && !want) { World.setBlock(x, y, z, id, st & ~32); front(x, y, z, st & 7); }
    else if (!on) { World.setBlock(x, y, z, id, st | 32); front(x, y, z, st & 7); if (!want) Ticks.schedule(x, y, z, delayOf(st), id, -2); }
  }
  // ---------------------------------------------------------------- comparators
  function compOut(x, y, z) { const be = World.getBE(x, y, z); return be && be.type === 'comparator' ? be.out | 0 : 0; }
  function setCompOut(x, y, z, v) { let be = World.getBE(x, y, z); if (!be || be.type !== 'comparator') { be = { type: 'comparator', out: 0 }; World.setBE(x, y, z, be); } be.out = v; }
  function compBack(x, y, z, st) {
    const back = OPP[st & 7], bx = x + DX[back], bz = z + DZ[back], bid = getB(bx, y, bz);
    let p = diodeInput(x, y, z, st);
    if (ANALOG[bid]) return analog(bx, y, bz, bid);
    if (p < 15 && condAt(bx, y, bz)) {
      const cx = bx + DX[back], cz = bz + DZ[back], cid = getB(cx, y, cz);
      let a = ANALOG[cid] ? analog(cx, y, cz, cid) : -1;
      if (typeof Decor !== 'undefined' && Decor.frameSignal) a = Math.max(a, Decor.frameSignal(cx, y, cz, back));
      if (a >= 0) p = a;
    }
    return p;
  }
  function compSide(x, y, z, st) {
    let m = 0;
    for (const f of SIDES[st & 7] || []) {
      const nx = x + DX[f], nz = z + DZ[f], id = getB(nx, y, nz), s2 = getS(nx, y, nz);
      const p = id === B.redstone_block ? 15 : id === B.redstone_wire ? s2 & 15 : SRC[id] ? from(x, y, z, f) : 0;
      if (p > m) m = p;
    }
    return m;
  }
  function compCalc(x, y, z, st) { const a = compBack(x, y, z, st); if (!a) return 0; const b = compSide(x, y, z, st); if (b > a) return 0; return st & 8 ? a - b : a; }
  function compShould(x, y, z, st) { const a = compBack(x, y, z, st); if (!a) return false; const b = compSide(x, y, z, st); return a > b || (a === b && !(st & 8)); }
  function comparatorCheck(x, y, z, id, st) {
    if (Ticks.has(x, y, z)) return;
    if (compCalc(x, y, z, st) !== compOut(x, y, z) || !!(st & 16) !== compShould(x, y, z, st)) Ticks.schedule(x, y, z, 2, id, prioritize(x, y, z, st) ? -1 : 0);
  }
  function comparatorTick(x, y, z, id, st) {
    const o = compCalc(x, y, z, st), cur = compOut(x, y, z);
    setCompOut(x, y, z, o);
    if (o !== cur || !(st & 8)) {
      const should = compShould(x, y, z, st), on = !!(st & 16);
      if (on && !should) World.setBlock(x, y, z, id, st & ~16); else if (!on && should) World.setBlock(x, y, z, id, st | 16);
      front(x, y, z, st & 7);
    }
  }
  // comparators look at what they read every tick (containers change without block updates)
  function comparatorPoll(be) {
    const { x, y, z } = be, id = getB(x, y, z);
    if (id !== B.comparator) { World.setBE(x, y, z, null); return; }
    if (Ticks.has(x, y, z)) return;
    const st = getS(x, y, z), back = OPP[st & 7], bx = x + DX[back], bz = z + DZ[back];
    if (!ANALOG[getB(bx, y, bz)] && !(condAt(bx, y, bz) && (ANALOG[getB(bx + DX[back], y, bz + DZ[back])] || typeof Decor !== 'undefined' && Decor.frameSignal))) return;
    if (compCalc(x, y, z, st) !== compOut(x, y, z)) { comparatorCheck(x, y, z, id, st); flush(); }
  }
  // what a comparator reads from a block: containers by how full they are, and many blocks by their state
  function fullness(items) {
    if (!items) return 0;
    let f = 0, any = false;
    for (const s of items) if (s && s.count > 0) { f += s.count / maxStack(s); any = true; }
    f /= items.length;
    return any ? Math.floor(f * 14) + 1 : 0;
  }
  function analog(x, y, z, id) {
    const n = BLOCKS[id].name, st = getS(x, y, z);
    switch (n) {
      case 'cake': return (7 - (st & 7)) * 2;
      case 'sculk_sensor': case 'calibrated_sculk_sensor': return GameEvents.sensorAnalog(x, y, z);
      case 'cauldron': return ((st >> 2) & 3) === 1 ? 3 : st & 3;
      case 'composter': return st & 15;
      case 'end_portal_frame': return st & 8 ? 15 : 0;
      case 'respawn_anchor': return [0, 3, 7, 11, 15][Math.min(4, st & 7)];
      case 'beehive': case 'bee_nest': return (st >> 3) & 7;
      case 'jukebox': { const be = World.getBE(x, y, z); return be && be.disc ? discSignal(ITEMS[be.disc.id].name) : 0; }
      case 'chiseled_bookshelf': { const be = World.getBE(x, y, z); return be && be.last !== undefined ? be.last + 1 : 0; }
      case 'detector_rail': return Math.max(0, Rails.detectorSignal(x, y, z));
      case 'lectern': { const be = World.getBE(x, y, z); if (!be || !be.book) return 0; const pages = Math.max(1, be.pages || 1); return pages > 1 ? Math.floor((be.page || 0) / (pages - 1) * 14) + 1 : 15; }
    }
    if (n.endsWith('candle_cake')) return 14;
    if (n.endsWith('copper_bulb')) return st & 1 ? 15 : 0;
    const be = World.getBE(x, y, z);
    if (!be || !be.items) return 0;
    // a double chest reads both halves
    if (n === 'chest' || n === 'trapped_chest') {
      const t = (st >> 3) & 3;
      if (t) {
        const side = { 2: [5, 4], 3: [4, 5], 4: [2, 3], 5: [3, 2] }[st & 7][t === 1 ? 0 : 1], ox = x + DX[side], oz = z + DZ[side];
        const o = getB(ox, y, oz) === id && World.getBE(ox, y, oz);
        if (o && o.items) return fullness(be.items.concat(o.items));
      }
    }
    if (n === 'crafter') { let k = 0; for (let i = 0; i < 9; i++) if (be.items[i] || (be.disabled && be.disabled[i])) k++; return k; }
    return fullness(be.items);
  }
  const DISC_SIGNAL = { '13': 1, cat: 2, blocks: 3, chirp: 4, far: 5, mall: 6, mellohi: 7, stal: 8, strad: 9, ward: 10, '11': 11, wait: 12, pigstep: 13, otherside: 14, '5': 15, relic: 14, creator: 12, creator_music_box: 11, precipice: 13 };
  const discSignal = n => DISC_SIGNAL[n.replace('music_disc_', '')] || 1;
  // a container changed: comparators next to it (or behind a solid block next to it) look again
  function analogChanged(x, y, z) {
    for (let f = 2; f < 6; f++) {
      const nx = x + DX[f], nz = z + DZ[f];
      Q.push(nx, y, nz);
      if (condAt(nx, y, nz)) Q.push(nx + DX[f], y, nz + DZ[f]);
    }
    flush();
  }
  // ---------------------------------------------------------------- observers
  function observerTrigger(x, y, z, st) { if (!(st & 8) && !Ticks.has(x, y, z)) Ticks.schedule(x, y, z, 2); }
  function observerTick(x, y, z, id, st) {
    if (st & 8) World.setBlock(x, y, z, id, st & ~8);
    else { World.setBlock(x, y, z, id, st | 8); Ticks.schedule(x, y, z, 2); }
    front(x, y, z, OPP[st & 7]);
  }
  World.listeners.blockChanged.push((x, y, z) => {
    for (let f = 0; f < 6; f++) {
      const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
      if (getB(nx, ny, nz) !== B.observer) continue;
      const st = getS(nx, ny, nz);
      if ((st & 7) === OPP[f]) observerTrigger(nx, ny, nz, st);
    }
  });
  // ---------------------------------------------------------------- note blocks
  const HEADS = { zombie_head: 'zombie', skeleton_skull: 'skeleton', creeper_head: 'creeper', dragon_head: 'ender_dragon', wither_skeleton_skull: 'wither_skeleton', piglin_head: 'piglin', player_head: 'custom_head' };
  const STONEY = new Set(['stone', 'deepslate', 'tuff', 'nether_ore', 'ancient_debris', 'netherrack', 'nylium', 'basalt', 'nether_bricks', 'lodestone', 'coral', 'calcite', 'dripstone']);
  function instrument(x, y, z) {
    const above = BLOCKS[getB(x, y + 1, z)].name;
    for (const h in HEADS) if (above === h || above === h.replace(/_(head|skull)$/, '_wall_$1')) return HEADS[h];
    const d = BLOCKS[getB(x, y - 1, z)], n = d.name;
    const special = { gold_block: 'bell', clay: 'flute', packed_ice: 'chime', bone_block: 'xylophone', iron_block: 'iron_xylophone', soul_sand: 'cow_bell', pumpkin: 'didgeridoo', emerald_block: 'bit', hay_block: 'banjo', glowstone: 'pling' }[n];
    if (special) return special;
    if (n.endsWith('_wool')) return 'guitar';
    if (/^(sand|red_sand|gravel|suspicious_sand|suspicious_gravel)$|_concrete_powder$/.test(n)) return 'snare';
    if (n.includes('glass') || n === 'sea_lantern' || n === 'beacon') return 'hat';
    if (/^(wood|cherry_wood|stem|nether_wood|bamboo_wood)$/.test(d.sound) || /mushroom_block$|^mushroom_stem$/.test(n)) return 'bass';
    if (d.solid && (STONEY.has(d.sound) || /^(coal_block|raw_iron_block|raw_copper_block|raw_gold_block|obsidian|crying_obsidian|bedrock|furnace|blast_furnace|smoker|dispenser|dropper|observer|respawn_anchor|magma_block)$/.test(n))) return 'basedrum';
    return 'harp';
  }
  function playNote(x, y, z) {
    if (getB(x, y, z) !== B.note_block) return;
    const ins = instrument(x, y, z);
    const head = ['zombie', 'skeleton', 'creeper', 'ender_dragon', 'wither_skeleton', 'piglin', 'custom_head'].includes(ins);
    if (!head && getB(x, y + 1, z) !== 0) return;
    const pitch = getS(x, y, z) & 31;
    if (head) { if (ins !== 'custom_head') Sound.play(ins + '_ambient', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5, mob: true }); }
    else { Sound.note(ins, pitch, x, y, z); Particles.note(x, y, z, pitch); }
    if (typeof GameEvents !== 'undefined') GameEvents.emit('note_block_play', x + 0.5, y + 0.5, z + 0.5);
  }
  // ---------------------------------------------------------------- pressure plates, tripwire and other things entities touch
  function plateSignal(x, y, z, id) {
    const n = BLOCKS[id].name, box = [x + 1 / 16, y, z + 1 / 16, x + 15 / 16, y + 0.25, z + 15 / 16];
    let count = 0;
    for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) {
      if (!e || e.removed || e.dead || e.ghost || (e.isPlayer && e.spectator)) continue;
      if (!e.intersects(box)) continue;
      if (n === 'stone_pressure_plate' || n === 'polished_blackstone_pressure_plate') { if (e.living || e.isPlayer) return 15; continue; }
      if (n.endsWith('weighted_pressure_plate')) { count++; continue; }
      return 15;
    }
    if (n === 'light_weighted_pressure_plate') return Math.min(15, count);
    if (n === 'heavy_weighted_pressure_plate') return count ? Math.ceil(Math.min(150, count) / 150 * 15) : 0;
    return 0;
  }
  function setPlate(x, y, z, id, st, p) {
    const was = st & 15;
    if (was === p) return;
    World.setBlock(x, y, z, id, (st & ~15) | p);
    region(x, y, z); flush();
    const metal = BLOCKS[id].name.includes('weighted');
    if (p > 0 && !was) Sound.play('click', null, { x: x + 0.5, y: y + 0.1, z: z + 0.5, on: true, pitch: metal ? 0.9 : 0.6 });
    else if (!p && was) Sound.play('click_off', null, { x: x + 0.5, y: y + 0.1, z: z + 0.5 });
  }
  function plateTick(x, y, z, id, st) {
    const p = plateSignal(x, y, z, id);
    setPlate(x, y, z, id, st, p);
    if (p > 0) Ticks.schedule(x, y, z, BLOCKS[id].name.includes('weighted') ? 10 : 20);
  }
  function entityTouches() {
    const list = Entities.list.concat(Game.player ? [Game.player] : []);
    for (const e of list) {
      if (!e || e.removed || e.dead || e.ghost || (e.isPlayer && e.spectator) || e.vehicle) continue;
      const hw = e.w / 2, y0 = Math.floor(e.y + 0.001);
      const x0 = Math.floor(e.x - hw), x1 = Math.floor(e.x + hw), z0 = Math.floor(e.z - hw), z1 = Math.floor(e.z + hw);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const id = getB(x, y0, z); if (!id) continue;
        const d = BLOCKS[id];
        if (d.model === 'plate') { const st = getS(x, y0, z); if ((st & 15) === 0) { const p = plateSignal(x, y0, z, id); if (p > 0) { setPlate(x, y0, z, id, st, p); Ticks.schedule(x, y0, z, d.name.includes('weighted') ? 10 : 20); } } }
        else if (id === B.tripwire && typeof Tripwire !== 'undefined') Tripwire.touch(x, y0, z, e);
      }
    }
  }
  // ---------------------------------------------------------------- target blocks, wind charges, daylight detectors
  function target(hit, proj) {
    const { x, y, z } = hit;
    if (getB(x, y, z) !== B.target || Ticks.has(x, y, z)) return;
    const fx = Math.abs(hit.px - Math.floor(hit.px) - 0.5), fy = Math.abs(hit.py - Math.floor(hit.py) - 0.5), fz = Math.abs(hit.pz - Math.floor(hit.pz) - 0.5);
    const d = hit.face < 2 ? Math.max(fx, fz) : hit.face < 4 ? Math.max(fx, fy) : Math.max(fy, fz);
    const p = Math.max(1, Math.ceil(15 * Math.max(0, Math.min(1, (0.5 - d) / 0.5))));
    World.setBlock(x, y, z, B.target, p);
    region(x, y, z); flush();
    Ticks.schedule(x, y, z, proj instanceof Arrow ? 20 : 8);
  }
  // a wind burst flips doors, trapdoors, gates and levers, presses buttons, rings bells and puts out candles
  // (not iron ones, and not ones held in place by redstone power)
  function windCharge(hit) {
    const cx = hit.px, cy = hit.py, cz = hit.pz;
    for (let x = Math.floor(cx - 1.2); x <= Math.floor(cx + 1.2); x++) for (let y = Math.floor(cy - 1.2); y <= Math.floor(cy + 1.2); y++) for (let z = Math.floor(cz - 1.2); z <= Math.floor(cz + 1.2); z++) {
      const id = getB(x, y, z); if (!id) continue;
      const d = BLOCKS[id], st = getS(x, y, z), n = d.name;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2 > 2.4 * 2.4) continue;
      if (n.startsWith('iron_')) continue;
      if (d.model === 'door' && !(st & 8)) { if (powered(x, y, z) || powered(x, y + 1, z)) continue; World.setBlock(x, y, z, id, st ^ 16); World.setBlock(x, y + 1, z, id, getS(x, y + 1, z) ^ 16); Sound.play(st & 16 ? 'door_close' : 'door_open', null, { x, y, z }); }
      else if (d.model === 'trapdoor') { if (powered(x, y, z)) continue; World.setBlock(x, y, z, id, st ^ 16); Sound.play(st & 16 ? 'trapdoor_close' : 'trapdoor_open', null, { x, y, z }); }
      else if (d.model === 'gate') { if (powered(x, y, z)) continue; World.setBlock(x, y, z, id, st ^ 16); Sound.play(st & 16 ? 'gate_close' : 'gate_open', null, { x, y, z }); }
      else if (d.model === 'lever') { World.setBlock(x, y, z, id, st ^ 32); Sound.play('click', null, { x, y, z, on: !(st & 32) }); region(x, y, z); }
      else if (d.model === 'button') { if (st & 32) continue; World.setBlock(x, y, z, id, st | 32); Ticks.schedule(x, y, z, n.includes('stone') ? 20 : 30); Sound.play('click', null, { x, y, z, on: true }); region(x, y, z); }
      else if (n === 'bell') Sound.play('bell', null, { x, y, z });
      else if ((d.model === 'candle' || d.model === 'candle_cake') && (st & 4)) { World.setBlock(x, y, z, id, st & ~4); Sound.play('extinguish', null, { x, y, z }); }
      else if (n === 'decorated_pot') Pots.hitByProjectile(x, y, z);
      else if (n === 'chorus_flower') { Drops.dropBlock(id, st, null, x, y, z); Blocks.remove(x, y, z, null, true); }
    }
    flush();
  }
  function daylightTick(be) {
    if (Game.gameTime % 20 !== 0 || World.dim !== 'overworld') return;
    const { x, y, z } = be, id = getB(x, y, z);
    if (id !== B.daylight_detector) { World.setBE(x, y, z, null); return; }
    const st = getS(x, y, z);
    let i = World.skyLight(x, y, z) - Sky.skyDarken, f = Sky.celestial * Math.PI * 2;
    if (st & 16) i = 15 - i;
    else if (i > 0) { const f1 = f < Math.PI ? 0 : Math.PI * 2; f += (f1 - f) * 0.2; i = Math.round(i * Math.cos(f)); }
    i = Math.max(0, Math.min(15, i));
    if ((st & 15) !== i) { World.setBlock(x, y, z, id, (st & ~15) | i); region(x, y, z); flush(); }
  }
  // ---------------------------------------------------------------- scheduled ticks
  function isComponent(id) { const k = SRC[id]; return REACT[id] === R.TORCH || REACT[id] === R.REPEATER || REACT[id] === R.COMPARATOR || REACT[id] === R.LAMP || REACT[id] === R.DISPENSER || REACT[id] === R.CRAFTER || k === S.OBSERVER || k === S.TARGET || k === S.ROD || k === S.HOOK || id === B.tripwire || k === S.DETECTOR || k === S.SENSOR || k === S.LECTERN; }
  function scheduled(x, y, z, id, st) {
    switch (REACT[id]) {
      case R.TORCH: torchTick(x, y, z, id, st); break;
      case R.REPEATER: repeaterTick(x, y, z, id, st); break;
      case R.COMPARATOR: comparatorTick(x, y, z, id, st); break;
      case R.LAMP: if ((st & 1) && !powered(x, y, z)) World.setBlock(x, y, z, id, st & ~1); break;
      case R.DISPENSER: if (typeof Dispense !== 'undefined') Dispense.fire(x, y, z, id, st); break;
      case R.CRAFTER: if (typeof Crafter !== 'undefined') Crafter.craft(x, y, z, id, st); break;
      default:
        switch (SRC[id]) {
          case S.OBSERVER: observerTick(x, y, z, id, st); break;
          case S.TARGET: if (st & 15) { World.setBlock(x, y, z, id, 0); region(x, y, z); } break;
          case S.ROD: if (st & 8) { World.setBlock(x, y, z, id, st & ~8); region(x, y, z); } break;
          case S.LECTERN: if (st & 16) { World.setBlock(x, y, z, id, st & ~16, 4); region(x, y, z); } break;
          case S.HOOK: if (typeof Tripwire !== 'undefined') Tripwire.hookTick(x, y, z, id, st); break;
          case S.DETECTOR: if (typeof Rails !== 'undefined' && Rails.detectorTick) Rails.detectorTick(x, y, z, id, st); break;
          case S.SENSOR: if (typeof GameEvents !== 'undefined') GameEvents.sensorTick(x, y, z, id, st); break;
          default: if (id === B.tripwire && typeof Tripwire !== 'undefined') Tripwire.wireTick(x, y, z, id, st);
        }
    }
    flush();
  }
  // ---------------------------------------------------------------- hooks used by the rest of the game
  function update(x, y, z) { region(x, y, z); flush(); }
  function neighbor(x, y, z) { Q.push(x, y, z); flush(); }
  function onPlaced(x, y, z, id) {
    if (id === B.comparator && !World.getBE(x, y, z)) World.setBE(x, y, z, { type: 'comparator', out: 0 });
    if (id === B.daylight_detector && !World.getBE(x, y, z)) World.setBE(x, y, z, { type: 'daylight' });
    if (BLOCKS[id].model === 'rail') Rails.placed(x, y, z);
  }
  // right-clicking dust that has no connections switches it between a cross and a dot
  function useWire(x, y, z, st) {
    if (rawSides(x, y, z) !== 0) return false;
    World.setBlock(x, y, z, B.redstone_wire, st ^ 16); update(x, y, z);
    return true;
  }
  function tick() {
    if (typeof Pistons !== 'undefined') Pistons.tick();
    entityTouches();
    flush();
  }
  return {
    S, R, SRC, REACT, COND, ANALOG, connects, wireSides, emit, from, received, powered, strongInto, condAt,
    update, updateAttached() {}, neighbor, onPlaced, isComponent, scheduled, plateTick, playNote, instrument, target, windCharge,
    useWire, tick, flush, region, front, analogChanged, comparatorPoll, daylightTick, analog, compOut, queue: (x, y, z) => Q.push(x, y, z),
  };
})();
