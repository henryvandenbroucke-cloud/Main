'use strict';
/* Pistons and sticky pistons, following the game: a piston is powered from any side but its front, or
   "quasi-connected" through the block above it. It pushes up to 12 blocks (slime and honey blocks pull the
   blocks stuck to them along, but not each other); obsidian, bedrock, extended pistons and blocks with
   contents (chests, furnaces...) stop it, plants, torches, dust and other small things break, glazed terracotta
   can only be pushed. Moving takes 2 ticks: the blocks slide (drawn as moving models), entities in the way
   are shoved along (slime blocks fling them) and the blocks land on the third tick. A sticky piston pulls the
   block in front back with it, and drops it when it gets a pulse shorter than its move. */
const Pistons = (() => {
  const B = BID;
  const NORMAL = 0, DESTROY = 1, BLOCK = 2, PUSH_ONLY = 3;
  const REACTION = new Uint8Array(BLOCKS.length), HAS_BE = new Uint8Array(BLOCKS.length);
  const BE_NAMES = /^(chest|trapped_chest|barrel|furnace|blast_furnace|smoker|dispenser|dropper|hopper|brewing_stand|jukebox|campfire|soul_campfire|beacon|lectern|spawner|enchanting_table|end_gateway|ender_chest|bell|conduit|beehive|bee_nest|daylight_detector|sculk_sensor|calibrated_sculk_sensor|sculk_shrieker|sculk_catalyst|chiseled_bookshelf|crafter|trial_spawner|vault|command_block|chain_command_block|repeating_command_block|structure_block|jigsaw|end_portal)$/;
  const BLOCKED = /^(obsidian|crying_obsidian|respawn_anchor|reinforced_deepslate|bedrock|barrier|end_portal_frame|end_portal|end_gateway|nether_portal|piston_head|moving_piston|grindstone|light|structure_void)$/;
  const BREAKS = /(^|_)(pumpkin|melon|jack_o_lantern|cactus|cake|bed|door|turtle_egg|sniffer_egg|dragon_egg|decorated_pot|budding_amethyst|amethyst_cluster|amethyst_bud|pointed_dripstone|scaffolding|shulker_box|skull|head|lantern|chorus_plant|chorus_flower|bamboo|big_dripleaf|big_dripleaf_stem|flower_pot|cobweb|candle|banner|suspicious_sand|suspicious_gravel|cocoa|frogspawn|sculk_vein)$/;
  for (const d of BLOCKS) {
    const n = d.name, i = d.id;
    if (BE_NAMES.test(n)) HAS_BE[i] = 1;
    if (BLOCKED.test(n)) REACTION[i] = BLOCK;
    else if (n.endsWith('glazed_terracotta')) REACTION[i] = PUSH_ONLY;
    else if (d.model === 'rail' || n === 'heavy_core') REACTION[i] = NORMAL;
    else if (!d.solid || d.fluid || d.replaceable || BREAKS.test(n) || d.model === 'cross' || d.model === 'crop' || d.model === 'sign' || d.model === 'wall_sign' || d.model === 'hanging_sign' || d.model === 'wall_hanging_sign' || d.model === 'banner' || d.model === 'candle' || d.model === 'candle_cake') REACTION[i] = DESTROY;
  }
  const isAir = id => id === 0 || id === B.cave_air || id === B.void_air;
  const sticky = id => id === B.slime_block || id === B.honey_block;
  const sticks = (a, b) => !((a === B.honey_block && b === B.slime_block) || (a === B.slime_block && b === B.honey_block)) && (sticky(a) || sticky(b));
  const hardness = id => { const md = MCDATA.blocks[BLOCKS[id].name]; return md ? md[1] : 1; };
  function pushable(x, y, z, id, st, move, allowDestroy, facing) {
    if (y < MINY || y > MAXY) return false;
    if (isAir(id)) return true;
    if (REACTION[id] === BLOCK) return false;
    if ((move === 0 && y === MINY) || (move === 1 && y === MAXY)) return false;
    if (id === B.piston || id === B.sticky_piston) return !(st & 8);
    if (hardness(id) < 0) return false;
    if (REACTION[id] === DESTROY) return allowDestroy;
    if (REACTION[id] === PUSH_ONLY) return move === facing;
    return !HAS_BE[id];
  }
  // ---------------------------------------------------------------- which blocks move (the game's PistonStructureResolver)
  function resolve(px, py, pz, facing, extending) {
    const push = extending ? facing : OPP[facing];
    const sx = extending ? px + DX[facing] : px + DX[facing] * 2, sy = extending ? py + DY[facing] : py + DY[facing] * 2, sz = extending ? pz + DZ[facing] : pz + DZ[facing] * 2;
    const toPush = [], toDestroy = [];
    const at = p => World.getBlock(p[0], p[1], p[2]), stAt = p => World.getState(p[0], p[1], p[2]);
    const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const idxOf = p => toPush.findIndex(q => eq(q, p));
    const rel = (p, f, n) => [p[0] + DX[f] * n, p[1] + DY[f] * n, p[2] + DZ[f] * n];
    const piston = [px, py, pz];
    function line(origin, dir) {
      let id = at(origin);
      if (isAir(id)) return true;
      if (!pushable(origin[0], origin[1], origin[2], id, stAt(origin), push, false, dir)) return true;
      if (eq(origin, piston) || idxOf(origin) >= 0) return true;
      let i = 1;
      if (i + toPush.length > 12) return false;
      // blocks stuck behind the first one come along
      while (sticky(id)) {
        const p = rel(origin, OPP[push], i), prev = id;
        id = at(p);
        if (isAir(id) || !sticks(prev, id) || !pushable(p[0], p[1], p[2], id, stAt(p), push, false, OPP[push]) || eq(p, piston)) break;
        if (++i + toPush.length > 12) return false;
      }
      let l = 0;
      for (let j = i - 1; j >= 0; j--) { toPush.push(rel(origin, OPP[push], j)); l++; }
      for (let k = 1; ; k++) {
        const p = rel(origin, push, k), at2 = idxOf(p);
        if (at2 > -1) {
          // ran into blocks already moving: reorder so they move in the right order
          const a = toPush.slice(0, at2), b = toPush.slice(toPush.length - l), c = toPush.slice(at2, toPush.length - l);
          toPush.length = 0; toPush.push(...a, ...b, ...c);
          for (let m = 0; m <= at2 + l; m++) { const q = toPush[m]; if (sticky(at(q)) && !branch(q)) return false; }
          return true;
        }
        id = at(p);
        if (isAir(id)) return true;
        if (!pushable(p[0], p[1], p[2], id, stAt(p), push, true, push) || eq(p, piston)) return false;
        if (REACTION[id] === DESTROY) { toDestroy.push(p); return true; }
        if (toPush.length >= 12) return false;
        toPush.push(p); l++;
      }
    }
    function branch(p) {
      const id = at(p);
      for (let f = 0; f < 6; f++) {
        if ((f >> 1) === (push >> 1)) continue;
        const q = rel(p, f, 1);
        if (sticks(at(q), id) && !line(q, f)) return false;
      }
      return true;
    }
    const sid = World.getBlock(sx, sy, sz);
    if (!pushable(sx, sy, sz, sid, World.getState(sx, sy, sz), push, false, facing)) {
      if (extending && REACTION[sid] === DESTROY) { toDestroy.push([sx, sy, sz]); return { toPush, toDestroy, push }; }
      return null;
    }
    if (!line([sx, sy, sz], push)) return null;
    for (let i = 0; i < toPush.length; i++) if (sticky(at(toPush[i])) && !branch(toPush[i])) return null;
    return { toPush, toDestroy, push };
  }
  // ---------------------------------------------------------------- power
  function signal(x, y, z, facing) {
    for (let f = 0; f < 6; f++) if (f !== facing && Redstone.from(x, y, z, f) > 0) return true;
    // quasi-connectivity: power to the block above counts too
    for (let f = 1; f < 6; f++) if (Redstone.from(x, y + 1, z, f) > 0) return true;
    return false;
  }
  const events = new Map(); // block events, run once per tick after scheduled ticks
  const moving = new Map(); // key -> moving block
  const mkey = (x, y, z) => x + ',' + y + ',' + z;
  function check(x, y, z, id, st) {
    if (moving.has(mkey(x, y, z))) return;
    const f = st & 7, on = signal(x, y, z, f), ext = !!(st & 8);
    if (on && !ext) { if (resolve(x, y, z, f, true)) events.set(mkey(x, y, z), { x, y, z, type: 0, f }); }
    else if (!on && ext) {
      const hx = x + DX[f] * 2, hy = y + DY[f] * 2, hz = z + DZ[f] * 2;
      const m = moving.get(mkey(x + DX[f], y + DY[f], z + DZ[f])) || moving.get(mkey(hx, hy, hz));
      // retracting before the push finished: a sticky piston lets go of its block
      const drop = m && m.extending && m.dir === f && (m.progress < 0.5 || m.born === Game.gameTime);
      events.set(mkey(x, y, z), { x, y, z, type: drop ? 2 : 1, f });
    }
  }
  function runEvents() {
    let guard = 0;
    while (events.size && guard++ < 64) {
      const list = [...events.values()]; events.clear();
      for (const ev of list) trigger(ev);
      Redstone.flush();
    }
  }
  function trigger(ev) {
    const { x, y, z, f } = ev, id = World.getBlock(x, y, z);
    if (id !== B.piston && id !== B.sticky_piston) return;
    const st = World.getState(x, y, z), on = signal(x, y, z, f);
    if ((st & 7) !== f) return;
    if (ev.type === 0) {
      if (!on || (st & 8)) return;
      if (!move(x, y, z, f, true, id === B.sticky_piston)) return;
      World.setBlock(x, y, z, id, st | 8);
      Sound.play('piston_extend', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    } else {
      if (on || !(st & 8)) return;
      const hx = x + DX[f], hy = y + DY[f], hz = z + DZ[f];
      const mh = moving.get(mkey(hx, hy, hz)); if (mh) finish(mh);
      // the head slides back into the base, which stays (drawn extended) until it lands
      addMoving({ x, y, z, id, st: st & ~8, dir: OPP[f], extending: false, source: true, keep: true, visId: B.piston_head, visSt: f | (id === B.sticky_piston ? 8 : 0) | 16, fromX: hx, fromY: hy, fromZ: hz });
      if (id === B.sticky_piston) {
        const tx = x + DX[f] * 2, ty = y + DY[f] * 2, tz = z + DZ[f] * 2, t = World.getBlock(tx, ty, tz), ts = World.getState(tx, ty, tz);
        let done = false;
        const mt = moving.get(mkey(tx, ty, tz));
        if (mt && mt.dir === f && mt.extending) { finish(mt); done = true; }
        if (!done) {
          if (ev.type !== 1 || isAir(t) || !pushable(tx, ty, tz, t, ts, OPP[f], false, f) || (REACTION[t] !== NORMAL && t !== B.piston && t !== B.sticky_piston)) removeHead(hx, hy, hz);
          else move(x, y, z, f, false, true);
        }
      } else removeHead(hx, hy, hz);
      Sound.play('piston_contract', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    }
  }
  function removeHead(x, y, z) { if (World.getBlock(x, y, z) === B.piston_head) { World.setBlock(x, y, z, 0, 0); Blocks.updateAround(x, y, z); Redstone.update(x, y, z); } }
  // ---------------------------------------------------------------- moving the blocks
  function move(px, py, pz, facing, extending, isSticky) {
    const hx = px + DX[facing], hy = py + DY[facing], hz = pz + DZ[facing];
    if (!extending && World.getBlock(hx, hy, hz) === B.piston_head) World.setBlock(hx, hy, hz, 0, 0);
    const r = resolve(px, py, pz, facing, extending);
    if (!r) return false;
    const dir = r.push;
    const states = r.toPush.map(p => [World.getBlock(p[0], p[1], p[2]), World.getState(p[0], p[1], p[2])]);
    const vacated = new Map();
    for (const p of r.toPush) vacated.set(mkey(p[0], p[1], p[2]), p);
    const touched = [];
    // things in the way break (and drop) first
    for (let k = r.toDestroy.length - 1; k >= 0; k--) {
      const [x, y, z] = r.toDestroy[k], id = World.getBlock(x, y, z), st = World.getState(x, y, z);
      if (!BLOCKS[id].fluid) Drops.dropBlock(id, st, null, x, y, z);
      Blocks.remove(x, y, z, null, true);
      if (BLOCKS[World.getBlock(x, y, z)].fluid) World.setBlock(x, y, z, 0, 0);
      touched.push([x, y, z]);
    }
    // each block becomes a moving block one step along
    for (let k = r.toPush.length - 1; k >= 0; k--) {
      const [x, y, z] = r.toPush[k], [id, st] = states[k];
      const tx = x + DX[dir], ty = y + DY[dir], tz = z + DZ[dir];
      vacated.delete(mkey(tx, ty, tz));
      World.setBlock(tx, ty, tz, B.moving_piston, 0);
      addMoving({ x: tx, y: ty, z: tz, id, st, dir, extending, source: false, fromX: x, fromY: y, fromZ: z });
      touched.push([x, y, z]);
    }
    if (extending) {
      vacated.delete(mkey(hx, hy, hz));
      World.setBlock(hx, hy, hz, B.moving_piston, 0);
      addMoving({ x: hx, y: hy, z: hz, id: B.piston_head, st: facing | (isSticky ? 8 : 0), dir: facing, extending: true, source: true, fromX: px, fromY: py, fromZ: pz });
    }
    for (const p of vacated.values()) World.setBlock(p[0], p[1], p[2], 0, 0);
    for (const p of touched.concat([...vacated.values()], [[hx, hy, hz]])) { Blocks.updateAround(p[0], p[1], p[2]); Redstone.update(p[0], p[1], p[2]); }
    return true;
  }
  // ---------------------------------------------------------------- moving blocks
  class MovingBlock extends Entity {
    constructor(m) { super('moving_block', m.fromX + 0.5, m.fromY, m.fromZ + 0.5); this.blockId = m.visId !== undefined ? m.visId : m.id; this.blockState = m.visSt !== undefined ? m.visSt : m.st; this.noPick = true; this.ghost = true; this.noGravity = true; this.w = this.h = 1; }
    tick() {}
    save() { return null; }
  }
  function addMoving(m) {
    m.progress = 0; m.born = Game.gameTime;
    m.vis = Entities.add(new MovingBlock(m));
    moving.set(mkey(m.x, m.y, m.z), m);
  }
  function finish(m) {
    moving.delete(mkey(m.x, m.y, m.z));
    if (m.vis) m.vis.removed = true;
    if (m.keep) { if (World.getBlock(m.x, m.y, m.z) === m.id) { World.setBlock(m.x, m.y, m.z, m.id, m.st); Blocks.updateAround(m.x, m.y, m.z); Redstone.update(m.x, m.y, m.z); } return; }
    if (World.getBlock(m.x, m.y, m.z) !== B.moving_piston) return;
    let id = m.id, st = m.st;
    // a piston head that lost its piston is not left floating
    if (id === B.piston_head) { const bx = m.x - DX[m.st & 7], by = m.y - DY[m.st & 7], bz = m.z - DZ[m.st & 7], b = World.getBlock(bx, by, bz); if ((b !== B.piston && b !== B.sticky_piston) || !(World.getState(bx, by, bz) & 8)) { id = 0; st = 0; } }
    World.setBlock(m.x, m.y, m.z, id, st);
    if (BLOCKS[id].gravity) Ticks.schedule(m.x, m.y, m.z, 2);
    Blocks.updateAround(m.x, m.y, m.z);
    Blocks.neighborChanged(m.x, m.y, m.z, m.x, m.y, m.z);
    Redstone.update(m.x, m.y, m.z);
  }
  // shove entities out of the way of a block that moved from progress a to b; honey carries what stands on it
  function pushEntities(m, a, b) {
    const dir = m.dir, ox = m.x - DX[dir], oy = m.y - DY[dir], oz = m.z - DZ[dir];
    const box = [ox + DX[dir] * b, oy + DY[dir] * b, oz + DZ[dir] * b, ox + 1 + DX[dir] * b, oy + 1 + DY[dir] * b, oz + 1 + DZ[dir] * b];
    const prevTop = oy + DY[dir] * a + 1, step = b - a;
    const isSlime = m.id === B.slime_block && m.extending, isHoney = m.id === B.honey_block;
    for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) {
      if (!e || e.removed || e.ghost || e.noClip || (e.isPlayer && e.spectator)) continue;
      const bb = e.bb();
      if (!e.intersects(box)) {
        if (isHoney && dir > 1 && Math.abs(bb[1] - prevTop) < 0.05 && bb[3] > ox + DX[dir] * a && bb[0] < ox + 1 + DX[dir] * a && bb[5] > oz + DZ[dir] * a && bb[2] < oz + 1 + DZ[dir] * a) Phys.move(e, DX[dir] * step, 0, DZ[dir] * step);
        continue;
      }
      // how far the entity has to go to clear the block
      let d;
      switch (dir) { case 0: d = bb[4] - box[1]; break; case 1: d = box[4] - bb[1]; break; case 2: d = bb[5] - box[2]; break; case 3: d = box[5] - bb[2]; break; case 4: d = bb[3] - box[0]; break; default: d = box[3] - bb[0]; }
      d = Math.min(Math.max(0, d) + 0.01, 0.51);
      Phys.move(e, DX[dir] * d, DY[dir] * d, DZ[dir] * d);
      if (isSlime) { if (DX[dir]) e.vx = DX[dir]; if (DY[dir]) e.vy = DY[dir]; if (DZ[dir]) e.vz = DZ[dir]; e.fallDistance = 0; }
    }
  }
  function tick() {
    runEvents();
    if (!moving.size) return;
    for (const m of [...moving.values()]) {
      if (m.progress >= 1) { finish(m); continue; }
      const a = m.progress, b = Math.min(1, a + 0.5);
      m.progress = b;
      if (!m.source || m.extending) pushEntities(m, a, b);
      const v = m.vis;
      if (v) { v.px = v.x; v.py = v.y; v.pz = v.z; v.x = m.fromX + 0.5 + DX[m.dir] * b; v.y = m.fromY + DY[m.dir] * b; v.z = m.fromZ + 0.5 + DZ[m.dir] * b; }
    }
    Redstone.flush();
  }
  // everything lands at once (saving, leaving the dimension)
  function finishAll() { runEvents(); for (const m of [...moving.values()]) finish(m); }
  return { check, tick, finishAll, resolve, pushable, isMoving: (x, y, z) => moving.has(mkey(x, y, z)), REACTION, HAS_BE };
})();
