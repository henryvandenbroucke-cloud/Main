'use strict';
/* Chunks, the generator workers, block access and lighting (sky light and block light, 0-15, flood filled
   across chunk borders and updated incrementally when blocks change). Y runs from -64 to 191. */
const MINY = -64, MAXY = 191, WH = 256;
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const LIDX = (x, y, z) => ((y + 64) << 8) | (z << 4) | x;

class Chunk {
  constructor(dim, cx, cz, d) {
    this.dim = dim; this.cx = cx; this.cz = cz;
    this.blocks = d.blocks; this.states = d.states; this.biomes = d.biomes;
    this.light = new Uint8Array(65536); // high nibble sky, low nibble block
    this.height = new Int16Array(256);  // highest block that blocks or dims sky light (rain and snow stop there)
    this.be = new Map();                 // block entities by local index
    this.meshes = new Array(16).fill(null);
    this.dirty = new Uint8Array(16).fill(1);
    this.lit = false; this.modified = false; this.inhabited = 0;
    this.pendingEntities = d.ents || [];
    for (const b of d.be || []) this.be.set(LIDX(b.x & 15, b.y, b.z & 15), b);
    this.recalcHeight();
  }
  recalcHeight() { for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) this.colHeight(x, z); }
  colHeight(x, z) {
    let y = MAXY; while (y > MINY && OPACITY[this.blocks[LIDX(x, y, z)]] === 0 && !SOLID[this.blocks[LIDX(x, y, z)]]) y--;
    this.height[x + z * 16] = y;
  }
}

const World = {
  dim: 'overworld', seed: 0, dims: { overworld: new Map(), nether: new Map(), end: new Map() }, chunks: null,
  workers: [], pending: new Map(), genQueue: [], loadedCount: 0, time: 0, day: 0,
  savedChunks: null, // dim -> Map(key -> saved chunk record), filled by the save system
  listeners: { chunkLoaded: [], chunkUnloaded: [], blockChanged: [] },
  init(seed) {
    this.seed = seed;
    for (const d in this.dims) this.dims[d] = new Map();
    this.chunks = this.dims[this.dim];
    if (!this.workers.length) {
      const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));
      const src = 'self.SHARED=[];\n' + SHARED.map(f => 'SHARED.push(' + f.toString() + ');').join('\n') + '\nfor (const f of SHARED) f(self);\n(' + workerMain.toString() + ')();';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      for (let i = 0; i < n; i++) { const w = new Worker(url); w.busy = 0; w.onmessage = e => this.onWorker(e.data, w); this.workers.push(w); }
    }
    for (const w of this.workers) { w.busy = 0; w.postMessage({ type: 'init', seed }); }
    this.pending.clear(); this.genQueue.length = 0;
  },
  setDim(dim) { this.dim = dim; this.chunks = this.dims[dim]; },
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); },
  chunkAt(x, z) { return this.chunks.get(ckey(x >> 4, z >> 4)); },
  // ---------------------------------------------------------------- generation
  request(cx, cz, prio) {
    const k = ckey(cx, cz);
    if (this.chunks.has(k) || this.pending.has(k)) return;
    const saved = this.savedChunks && this.savedChunks[this.dim] && this.savedChunks[this.dim].get(k);
    if (saved) { this.pending.set(k, true); this.adopt(this.dim, cx, cz, Save.decodeChunk(saved), true); return; }
    this.pending.set(k, { cx, cz, dim: this.dim, prio });
    this.genQueue.push(k);
  },
  pump() {
    // keep every worker busy with the nearest wanted chunks
    if (!this.genQueue.length) return;
    this.genQueue.sort((a, b) => { const pa = this.pending.get(a), pb = this.pending.get(b); return (pa ? pa.prio : 1e9) - (pb ? pb.prio : 1e9); });
    for (const w of this.workers) {
      while (w.busy < 2 && this.genQueue.length) {
        const k = this.genQueue.shift(), p = this.pending.get(k);
        if (!p || p === true || p.dim !== this.dim) continue;
        p.sent = true; w.busy++;
        w.postMessage({ type: 'gen', dim: p.dim, cx: p.cx, cz: p.cz });
      }
    }
  },
  onWorker(m, w) {
    if (m.type !== 'chunk') return;
    w.busy = Math.max(0, w.busy - 1);
    const k = ckey(m.cx, m.cz);
    const p = this.pending.get(k);
    if (!p || p === true || m.dim !== this.dim) { if (m.dim !== this.dim) this.pending.delete(k); return; }
    this.adopt(m.dim, m.cx, m.cz, m, false);
  },
  adopt(dim, cx, cz, d, fromSave) {
    const k = ckey(cx, cz);
    this.pending.delete(k);
    if (dim !== this.dim) return;
    const c = new Chunk(dim, cx, cz, d);
    if (fromSave) { c.modified = true; if (d.beList) for (const b of d.beList) c.be.set(LIDX(b.x & 15, b.y, b.z & 15), b); c.pendingEntities = d.ents || []; c.fromSave = true; }
    this.chunks.set(k, c);
    Light.initChunk(c);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = this.getChunk(cx + dx, cz + dz); if (n) n.dirty.fill(1); }
    if (d.ticks) for (const [x, y, z] of d.ticks) Ticks.schedule(x, y, z, 5 + (Math.random() * 20 | 0));
    for (const f of this.listeners.chunkLoaded) f(c);
  },
  unload(c) {
    for (const f of this.listeners.chunkUnloaded) f(c);
    for (const m of c.meshes) if (m) Render.disposeSection(m);
    this.chunks.delete(ckey(c.cx, c.cz));
  },
  // ---------------------------------------------------------------- block access
  getBlock(x, y, z) {
    if (y < MINY || y > MAXY) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return 0;
    return c.blocks[((y + 64) << 8) | ((z & 15) << 4) | (x & 15)];
  },
  getState(x, y, z) {
    if (y < MINY || y > MAXY) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return 0;
    return c.states[((y + 64) << 8) | ((z & 15) << 4) | (x & 15)];
  },
  loaded(x, z) { return this.chunks.has(ckey(x >> 4, z >> 4)); },
  getLight(x, y, z) { // -> sky << 4 | block
    if (y > MAXY) return 0xf0; if (y < MINY) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return 0xf0;
    return c.light[((y + 64) << 8) | ((z & 15) << 4) | (x & 15)];
  },
  skyLight(x, y, z) { return this.getLight(x, y, z) >> 4; },
  blockLight(x, y, z) { return this.getLight(x, y, z) & 15; },
  // combined light the way mobs see it: sky light dimmed by the time of day
  lightLevel(x, y, z) { const l = this.getLight(x, y, z); return Math.max((l >> 4) - Sky.skyDarken, l & 15); },
  heightAt(x, z) { const c = this.chunkAt(x, z); return c ? c.height[(x & 15) + (z & 15) * 16] : MINY; },
  biomeAt(x, z) { const c = this.chunkAt(x, z); return c ? c.biomes[(x & 15) + (z & 15) * 16] : 0; },
  getBE(x, y, z) { const c = this.chunkAt(x, z); return c ? c.be.get(LIDX(x & 15, y, z & 15)) : undefined; },
  setBE(x, y, z, be) { const c = this.chunkAt(x, z); if (!c) return; const i = LIDX(x & 15, y, z & 15); if (be) { be.x = x; be.y = y; be.z = z; c.be.set(i, be); } else c.be.delete(i); c.modified = true; },
  // change a block: lighting, meshes, neighbours and block entities follow
  setBlock(x, y, z, id, state, flags) {
    if (y < MINY || y > MAXY) return false;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return false;
    const i = ((y + 64) << 8) | ((z & 15) << 4) | (x & 15);
    const old = c.blocks[i], oldState = c.states[i];
    state = state || 0;
    if (old === id && oldState === state) return false;
    c.blocks[i] = id; c.states[i] = state; c.modified = true;
    if (old !== id && c.be.has(i) && !(flags & 4)) c.be.delete(i);
    const lx = x & 15, lz = z & 15;
    if (OPACITY[old] !== OPACITY[id] || SOLID[old] !== SOLID[id] || LIGHT[old] !== LIGHT[id] || (LIGHT[id] && BLOCKS[id].lightFn)) {
      const h = c.height[lx + lz * 16];
      if (y >= h) c.colHeight(lx, lz);
      Light.update(x, y, z, old, id);
    }
    this.markDirty(x, y, z);
    if (!(flags & 1)) for (const f of this.listeners.blockChanged) f(x, y, z, old, id, oldState, state);
    return true;
  },
  setState(x, y, z, state) { return this.setBlock(x, y, z, this.getBlock(x, y, z), state); },
  markDirty(x, y, z) {
    const cx = x >> 4, cz = z >> 4, s = (y + 64) >> 4, lx = x & 15, lz = z & 15, ly = (y + 64) & 15;
    const mark = (ccx, ccz, ss) => { if (ss < 0 || ss > 15) return; const c = this.getChunk(ccx, ccz); if (c) c.dirty[ss] = 1; };
    mark(cx, cz, s);
    // neighbours share faces, light and ambient occlusion with this block
    const xs = lx === 0 ? [-1, 0] : lx === 15 ? [0, 1] : [0], zs = lz === 0 ? [-1, 0] : lz === 15 ? [0, 1] : [0], ss = ly === 0 ? [-1, 0] : ly === 15 ? [0, 1] : [0];
    for (const dx of xs) for (const dz of zs) for (const dsy of ss) mark(cx + dx, cz + dz, s + dsy);
  },
};

// ---------------------------------------------------------------- the generator worker
function workerMain() {
  let gens = null;
  self.onmessage = e => {
    const m = e.data;
    if (m.type === 'init') { gens = { overworld: new self.Overworld(m.seed), nether: new self.Nether(m.seed), end: new self.End(m.seed) }; return; }
    if (m.type === 'gen') {
      const o = gens[m.dim].generate(m.cx, m.cz);
      self.postMessage({ type: 'chunk', dim: m.dim, cx: m.cx, cz: m.cz, blocks: o.blocks, states: o.states, biomes: o.biomes, heights: o.heights, be: o.be, ents: o.ents, ticks: o.ticks },
        [o.blocks.buffer, o.states.buffer, o.biomes.buffer, o.heights.buffer]);
    }
  };
}

// ---------------------------------------------------------------- lighting
const Light = (() => {
  const QN = 1 << 20;
  const qx = new Int32Array(QN), qy = new Int16Array(QN), qz = new Int32Array(QN), qv = new Uint8Array(QN);
  const rx = new Int32Array(QN), ry = new Int16Array(QN), rz = new Int32Array(QN), rv = new Uint8Array(QN);
  let qh = 0, qt = 0, rh = 0, rt = 0;
  let cc = null, ccx = 1e9, ccz = 1e9; // last chunk looked up
  function chunk(x, z) { const cx = x >> 4, cz = z >> 4; if (cx === ccx && cz === ccz) return cc; ccx = cx; ccz = cz; cc = World.chunks.get(ckey(cx, cz)) || null; return cc; }
  function reset() { cc = null; ccx = ccz = 1e9; }
  const push = (x, y, z, v) => { qx[qt] = x; qy[qt] = y; qz[qt] = z; qv[qt] = v; qt = (qt + 1) & (QN - 1); };
  const pushR = (x, y, z, v) => { rx[rt] = x; ry[rt] = y; rz[rt] = z; rv[rt] = v; rt = (rt + 1) & (QN - 1); };
  // spread light outward from queued cells; sky: true for sky light (high nibble)
  function spread(sky) {
    const sh = sky ? 4 : 0, mask = sky ? 0xf0 : 0x0f, keep = sky ? 0x0f : 0xf0;
    while (qh !== qt) {
      const x = qx[qh], y = qy[qh], z = qz[qh]; qh = (qh + 1) & (QN - 1);
      const c = chunk(x, z); if (!c) continue;
      const l = (c.light[LIDX(x & 15, y, z & 15)] & mask) >> sh;
      if (l <= 1) continue;
      for (let f = 0; f < 6; f++) {
        const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
        if (ny < MINY || ny > MAXY) continue;
        const n = chunk(nx, nz); if (!n) continue;
        const i = LIDX(nx & 15, ny, nz & 15), op = OPACITY[n.blocks[i]];
        if (op >= 15) continue;
        const nl = sky && f === 0 && l === 15 && op === 0 ? 15 : l - Math.max(1, op);
        if (nl <= 0) continue;
        const cur = (n.light[i] & mask) >> sh;
        if (nl > cur) { n.light[i] = (n.light[i] & keep) | (nl << sh); markSec(n, ny); push(nx, ny, nz, nl); }
      }
    }
  }
  // remove light that came from (x,y,z), then refill from the remaining sources
  function unspread(sky) {
    const sh = sky ? 4 : 0, mask = sky ? 0xf0 : 0x0f, keep = sky ? 0x0f : 0xf0;
    while (rh !== rt) {
      const x = rx[rh], y = ry[rh], z = rz[rh], l = rv[rh]; rh = (rh + 1) & (QN - 1);
      for (let f = 0; f < 6; f++) {
        const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
        if (ny < MINY || ny > MAXY) continue;
        const n = chunk(nx, nz); if (!n) continue;
        const i = LIDX(nx & 15, ny, nz & 15), nl = (n.light[i] & mask) >> sh;
        if (nl === 0) continue;
        if (nl < l || (sky && f === 0 && l === 15 && nl === 15)) {
          n.light[i] &= keep; markSec(n, ny); pushR(nx, ny, nz, nl);
          if (!sky && LIGHT[n.blocks[i]]) { n.light[i] = (n.light[i] & keep) | LIGHT[n.blocks[i]]; push(nx, ny, nz, LIGHT[n.blocks[i]]); }
        } else push(nx, ny, nz, nl);
      }
    }
    spread(sky);
  }
  function markSec(c, y) { c.dirty[(y + 64) >> 4] = 1; }
  // first light for a new chunk; light already in loaded neighbours flows in, and ours flows out to them
  function initChunk(c) {
    reset();
    const B = c.blocks, L = c.light, x0 = c.cx * 16, z0 = c.cz * 16;
    L.fill(0);
    if (World.dim === 'overworld' || World.dim === 'end' || true) {
      const hasSky = World.dim !== 'nether';
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        let l = hasSky ? 15 : 0;
        for (let y = MAXY; y >= MINY && l > 0; y--) {
          const i = LIDX(x, y, z), op = OPACITY[B[i]];
          if (op) l = Math.max(0, l - op);
          L[i] = l << 4;
        }
      }
    }
    qh = qt = 0;
    for (let i = 0; i < 65536; i++) { const e = LIGHT[B[i]]; if (e) { L[i] |= e; push(x0 + (i & 15), (i >> 8) - 64, z0 + ((i >> 4) & 15), e); } }
    // block light from the neighbours' edges
    seedEdges(c, false);
    spread(false);
    // sky light: only cells next to a darker transparent cell need to spread
    qh = qt = 0;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const top = c.height[x + z * 16];
      for (let y = top + 1; y >= MINY && y <= MAXY; y--) {
        const i = LIDX(x, y, z), l = L[i] >> 4;
        if (l < 2) { if (y < top - 1) break; continue; }
        let need = false;
        for (let f = 2; f < 6; f++) {
          const nx = x + DX[f], nz = z + DZ[f];
          if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue;
          const j = LIDX(nx, y, nz); if (OPACITY[B[j]] < 15 && (L[j] >> 4) < l - 1) { need = true; break; }
        }
        if (need) push(x0 + x, y, z0 + z, l);
      }
      // the lit cells below overhangs must also spread sideways into caves under them
      for (let y = top; y >= MINY; y--) { const i = LIDX(x, y, z), l = L[i] >> 4; if (l < 2) break; push(x0 + x, y, z0 + z, l); }
    }
    seedEdges(c, true);
    spread(true);
    c.lit = true;
  }
  function seedEdges(c, sky) {
    const sh = sky ? 4 : 0, mask = sky ? 0xf0 : 0x0f;
    const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dz] of sides) {
      const n = World.getChunk(c.cx + dx, c.cz + dz); if (!n || !n.lit) continue;
      for (let k = 0; k < 16; k++) {
        const lx = dx === -1 ? 15 : dx === 1 ? 0 : k, lz = dz === -1 ? 15 : dz === 1 ? 0 : k;
        const wx = n.cx * 16 + lx, wz = n.cz * 16 + lz;
        for (let y = MINY; y <= MAXY; y++) { const l = (n.light[LIDX(lx, y, lz)] & mask) >> sh; if (l > 1) push(wx, y, wz, l); }
      }
      // our edge spreads into them too
      for (let k = 0; k < 16; k++) {
        const lx = dx === -1 ? 0 : dx === 1 ? 15 : k, lz = dz === -1 ? 0 : dz === 1 ? 15 : k;
        const wx = c.cx * 16 + lx, wz = c.cz * 16 + lz;
        for (let y = MINY; y <= MAXY; y++) { const l = (c.light[LIDX(lx, y, lz)] & mask) >> sh; if (l > 1) push(wx, y, wz, l); }
      }
    }
  }
  // a block changed at (x,y,z) from old to id
  function update(x, y, z, old, id) {
    reset();
    const c = chunk(x, z); if (!c) return;
    const i = LIDX(x & 15, y, z & 15);
    // block light
    const curB = c.light[i] & 15;
    rh = rt = 0; qh = qt = 0;
    if (curB) { c.light[i] &= 0xf0; pushR(x, y, z, curB); }
    if (LIGHT[id]) { c.light[i] = (c.light[i] & 0xf0) | LIGHT[id]; push(x, y, z, LIGHT[id]); }
    if (OPACITY[id] < OPACITY[old] || !curB) for (let f = 0; f < 6; f++) { const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f]; const l = World.getLight(nx, ny, nz) & 15; if (l > 1) push(nx, ny, nz, l); }
    unspread(false);
    // sky light
    if (World.dim === 'nether') return;
    const curS = c.light[i] >> 4;
    rh = rt = 0; qh = qt = 0;
    if (OPACITY[id] > OPACITY[old]) {
      if (curS) { c.light[i] &= 0x0f; pushR(x, y, z, curS); }
      // the new value this cell would get from its neighbours
      unspread(true);
      let best = 0;
      for (let f = 0; f < 6; f++) { const l = World.getLight(x + DX[f], y + DY[f], z + DZ[f]) >> 4; const v = f === 1 && l === 15 && OPACITY[id] === 0 ? 15 : l - Math.max(1, OPACITY[id]); if (v > best) best = v; }
      if (OPACITY[id] < 15 && best > 0) { c.light[i] = (c.light[i] & 0x0f) | (best << 4); push(x, y, z, best); spread(true); }
    } else {
      // more light can pass: pull it in from the neighbours (straight down from open sky stays 15)
      for (let f = 0; f < 6; f++) { const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f]; const l = World.getLight(nx, ny, nz) >> 4; if (l > 1 || (f === 1 && y === MAXY)) push(nx, ny, nz, l); }
      if (y === MAXY) { c.light[i] = (c.light[i] & 0x0f) | 0xf0; push(x, y, z, 15); }
      spread(true);
    }
  }
  return { initChunk, update };
})();
