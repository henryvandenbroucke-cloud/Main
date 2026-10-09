'use strict';
/* Scheduled block ticks (fluids, redstone, falling blocks) and random ticks (crops, grass, leaves, ice...):
   every tick each 16x16x16 section near the player gets "randomTickSpeed" (3) random block ticks. */
const Ticks = (() => {
  const sched = new Map(); // key -> { x, y, z, at, id }
  let now = 0;
  const key = (x, y, z) => World.dim + ':' + x + ',' + y + ',' + z;
  // pri: the game's tick priorities (-3 extremely high .. 0 normal); ticks due in the same game tick run in
  // priority order, then in the order they were scheduled. Water flowing out of a waterlogged block is kept
  // apart from the block's own ticks (a waterlogged lightning rod still gets its redstone ticks).
  let seq = 0;
  function schedule(x, y, z, delay, id, pri) {
    const water = id === BID.water && World.getBlock(x, y, z) !== BID.water;
    const k = key(x, y, z) + (water ? 'w' : ''), at = now + Math.max(1, delay | 0);
    const cur = sched.get(k);
    if (cur && cur.at <= at) return;
    sched.set(k, { x, y, z, at, dim: World.dim, id: id === undefined ? World.getBlock(x, y, z) : id, pri: pri || 0, seq: seq++, water });
  }
  function has(x, y, z) { return sched.has(key(x, y, z)); }
  function tick() {
    now++;
    // scheduled ticks that are due (at most a few thousand per tick)
    let n = 0;
    const due = [];
    for (const [k, t] of sched) { if (t.at <= now && t.dim === World.dim) { due.push(t); sched.delete(k); if (++n > 4000) break; } }
    due.sort((a, b) => a.at - b.at || a.pri - b.pri || a.seq - b.seq);
    for (const t of due) { if (!World.loaded(t.x, t.z)) continue; const id = World.getBlock(t.x, t.y, t.z); Blocks.scheduledTick(t.x, t.y, t.z, id, World.getState(t.x, t.y, t.z), t.water); }
    // random ticks around the player
    const speed = Game.rules.randomTickSpeed; if (!speed) return;
    const p = Game.player; if (!p) return;
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16), R = Math.min(8, Settings.renderDist);
    for (const c of World.chunks.values()) {
      if (Math.abs(c.cx - pcx) > R || Math.abs(c.cz - pcz) > R) continue;
      c.inhabited++;
      for (let s = 0; s < 16; s++) {
        if (!c.meshes[s] && !c.dirty[s]) continue; // empty sections
        for (let k = 0; k < speed; k++) {
          const r = Math.random() * 4096 | 0, lx = r & 15, lz = (r >> 4) & 15, ly = r >> 8;
          const i = ((s * 16 + ly) << 8) | (lz << 4) | lx, id = c.blocks[i];
          if (id && BLOCKS[id].ticks) Blocks.randomTick(c.cx * 16 + lx, s * 16 + ly - 64, c.cz * 16 + lz, id, c.states[i]);
        }
      }
    }
  }
  function save() { const out = []; for (const t of sched.values()) out.push([t.dim, t.x, t.y, t.z, t.at - now, t.pri, t.water ? 1 : 0]); return out; }
  function load(arr) { sched.clear(); for (const [dim, x, y, z, d, pri, w] of arr || []) sched.set(dim + ':' + x + ',' + y + ',' + z + (w ? 'w' : ''), { x, y, z, at: now + Math.max(1, d), dim, pri: pri || 0, seq: seq++, water: !!w }); }
  return { schedule, has, tick, save, load, get now() { return now; } };
})();

/* Water and lava. Sources are level 0; flowing fluid has level 1-7 (the distance from a source) and a
   "falling" flag. Water spreads 7 blocks every 5 ticks; lava 3 blocks every 30 ticks (7 every 10 in the
   Nether). Two water sources next to each other on solid ground make a new source. Lava meeting water makes
   obsidian (source), cobblestone (flowing) or stone (lava flowing down into water). */
const Fluids = (() => {
  const isW = id => id === BID.water, isL = id => id === BID.lava;
  const delay = id => isW(id) ? 5 : (World.dim === 'nether' ? 10 : 30);
  const drop = id => isW(id) ? 1 : (World.dim === 'nether' ? 1 : 2);
  // can fluid flow into this block (air or something the fluid washes away)?
  function canFlowInto(x, y, z, fid) {
    const id = World.getBlock(x, y, z), d = BLOCKS[id];
    if (id === 0 || d.model === 'none') return true;
    if (d.fluid) return false;
    if (d.waterlog && isW(fid)) return false;
    if (d.replaceable || d.model === 'cross' || d.model === 'crop' || d.model === 'torch' || d.model === 'wall_torch' || d.model === 'wire' || d.model === 'rail' || d.model === 'tall' || d.model === 'lever' || d.model === 'button' || d.model === 'carpet' && false) return id !== BID.sugar_cane && id !== BID.ladder && !d.fluidLog;
    return false;
  }
  function levelAt(x, y, z, fid) { const id = World.getBlock(x, y, z); if (id !== fid) return -1; const st = World.getState(x, y, z); return st & 7; }
  function isSource(x, y, z, fid) { const id = World.getBlock(x, y, z); if (id === fid && (World.getState(x, y, z) & 15) === 0) return true; if (isW(fid)) { const d = BLOCKS[id]; if (d.fluidLog || (d.waterlog && World.getState(x, y, z) & 128)) return true; } return false; }
  function washAway(x, y, z) { const id = World.getBlock(x, y, z); if (id && !BLOCKS[id].fluid) { Drops.dropBlock(id, World.getState(x, y, z), null, x, y, z); if (BLOCKS[id].model === 'tall' || BLOCKS[id].model === 'door') Blocks.remove(x, y, z, null, true); } }
  // lava touching water
  function react(x, y, z) {
    const id = World.getBlock(x, y, z); if (!isL(id)) return false;
    for (let f = 1; f < 6; f++) {
      const n = World.getBlock(x + DX[f], y + DY[f], z + DZ[f]);
      if (isW(n) || BLOCKS[n].fluidLog) {
        const src = (World.getState(x, y, z) & 15) === 0;
        World.setBlock(x, y, z, src ? BID.obsidian : BID.cobblestone, 0);
        Sound.play('fizz', null, { x, y, z }); Particles.smoke(x + 0.5, y + 1, z + 0.5, 6);
        return true;
      }
    }
    // basalt: lava flowing above soul soil next to blue ice
    if (World.getBlock(x, y - 1, z) === BID.soul_soil) for (let f = 2; f < 6; f++) if (World.getBlock(x + DX[f], y, z + DZ[f]) === BID.blue_ice) { World.setBlock(x, y, z, BID.basalt, 0); return true; }
    return false;
  }
  function tick(x, y, z, id, st) {
    if (react(x, y, z)) return;
    const level = st & 7, falling = !!(st & 8);
    const D = drop(id);
    // flowing fluid: recompute its level from the neighbours
    if (level !== 0 || falling) {
      let best = 99, sources = 0;
      for (let f = 2; f < 6; f++) {
        const nx = x + DX[f], nz = z + DZ[f];
        if (isSource(nx, y, nz, id)) { sources++; best = Math.min(best, 0); }
        else { const l = levelAt(nx, y, nz, id); if (l >= 0 && !(World.getState(nx, y, nz) & 8) || l >= 0) best = Math.min(best, (World.getState(nx, y, nz) & 8) ? 0 : l); }
      }
      let nl = best + D, nf = false;
      // infinite water: two sources beside it on top of something solid or another source
      if (isW(id) && sources >= 2 && Game.rules.waterSourceConversion) { const b = World.getBlock(x, y - 1, z); if (SOLID[b] || isSource(x, y - 1, z, id)) nl = 0; }
      const above = World.getBlock(x, y + 1, z);
      if (above === id || (isW(id) && BLOCKS[above].fluidLog) || (isW(id) && BLOCKS[above].waterlog && World.getState(x, y + 1, z) & 128)) { nl = Math.min(nl, 1); nf = true; if (nl === 0) nf = false; }
      if (nl > 7) { World.setBlock(x, y, z, 0, 0); return; }
      const nst = nl === 0 ? 0 : (nl | (nf ? 8 : 0));
      if (nst !== st) { World.setBlock(x, y, z, id, nst); Ticks.schedule(x, y, z, delay(id)); return spreadFrom(x, y, z, id, nl, nf); }
    }
    spreadFrom(x, y, z, id, level, falling);
  }
  function spreadFrom(x, y, z, id, level, falling) {
    // down first
    const by = y - 1;
    if (by >= MINY) {
      const b = World.getBlock(x, by, z);
      if (isL(id) && isW(b)) { World.setBlock(x, by, z, BID.stone, 0); Sound.play('fizz', null, { x, y, z }); return; }
      if (canFlowInto(x, by, z, id) || (b === id && (World.getState(x, by, z) & 7) !== 0 && !(World.getState(x, by, z) & 8))) {
        washAway(x, by, z);
        World.setBlock(x, by, z, id, 8 | 1); Ticks.schedule(x, by, z, delay(id));
        // a source also spreads sideways a little when it can fall (vanilla only spreads if it cannot fall)
        if (level !== 0) return;
        return;
      }
    }
    if (level >= 7 && !falling) return;
    const nl = (falling ? 1 : level + drop(id));
    if (nl > 7) return;
    // horizontal: prefer directions with the shortest path to a drop (within 4 blocks for water, 2 for lava)
    const dirs = [];
    let bestD = 1000;
    for (let f = 2; f < 6; f++) {
      const nx = x + DX[f], nz = z + DZ[f];
      if (!canFlowInto(nx, y, nz, id) && !(World.getBlock(nx, y, nz) === id && (World.getState(nx, y, nz) & 7) > nl)) continue;
      const d = slopeDist(nx, y, nz, id, 1, OPP[f], isW(id) ? 4 : (World.dim === 'nether' ? 4 : 2));
      if (d < bestD) { bestD = d; dirs.length = 0; }
      if (d === bestD) dirs.push(f);
    }
    for (const f of dirs) {
      const nx = x + DX[f], nz = z + DZ[f];
      const cur = World.getBlock(nx, y, nz);
      if (isL(id) && isW(cur)) { World.setBlock(nx, y, nz, BID.stone, 0); continue; }
      if (isW(id) && isL(cur)) { react(nx, y, nz); continue; }
      washAway(nx, y, nz);
      World.setBlock(nx, y, nz, id, nl); Ticks.schedule(nx, y, nz, delay(id));
    }
  }
  function slopeDist(x, y, z, id, depth, from, max) {
    if (canFlowInto(x, y - 1, z, id) || World.getBlock(x, y - 1, z) === id) return depth;
    if (depth >= max) return 1000;
    let best = 1000;
    for (let f = 2; f < 6; f++) {
      if (f === from) continue;
      const nx = x + DX[f], nz = z + DZ[f];
      if (!canFlowInto(nx, y, nz, id)) continue;
      best = Math.min(best, slopeDist(nx, y, nz, id, depth + 1, OPP[f], max));
    }
    return best;
  }
  function onNeighbor(x, y, z, id) { Ticks.schedule(x, y, z, delay(id)); }
  return { tick, onNeighbor, delay, canFlowInto, isSource, react };
})();
