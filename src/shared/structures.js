'use strict';
/* Structures: where they go (the game's random spread placement: one try per grid cell of "spacing" chunks,
   kept "separation" chunks from the next) and the builder they are made with. A structure is planned once
   from its start chunk into per-chunk lists of blocks, entities and block entities, and each chunk that is
   generated writes its own part. Shared with the generator worker; the page uses it to locate structures.
   The buildings are drawn in code in the style of the game's (no game files are used). */
SHARED.push(function structuresModule(G) {
  const { BID: B, BLOCKS, Rand, hashInt } = G;
  const MINY = -64, MAXY = 191, SEA = 63;
  const ROTF = { 2: 5, 5: 3, 3: 4, 4: 2 };
  const FACED = new Set(['stairs', 'door', 'bed', 'chest', 'wall_torch', 'ladder', 'trapdoor', 'gate', 'anvil', 'wall_sign', 'lever', 'button', 'repeater', 'comparator', 'glazed', 'cocoa', 'lectern', 'stonecutter', 'campfire', 'wall_fan', 'wall_hanging_sign', 'bell', 'decorated_pot', 'piston']);
  // turn a block state by k quarter turns (facing, axis, sign rotation)
  function rotState(id, st, k) {
    if (!k || !id) return st;
    const d = BLOCKS[id];
    if (d.place === 'axis' || d.model === 'chain') { if (k & 1) { const a = st & 3; st = (st & ~3) | (a === 1 ? 2 : a === 2 ? 1 : a); } return st; }
    if (d.model === 'sign' || d.model === 'banner' || d.model === 'hanging_sign') return (st & ~15) | (((st & 15) + 4 * k) & 15);
    if (FACED.has(d.model) || (d.place && d.place.startsWith('facing'))) { const f = st & 7; if (f >= 2 && f <= 5) { let g = f; for (let i = 0; i < k; i++) g = ROTF[g]; st = (st & ~7) | g; } }
    return st;
  }
  const replaceable = id => id === 0 || BLOCKS[id].replaceable || BLOCKS[id].fluid || BLOCKS[id].model === 'cross' || BLOCKS[id].name.endsWith('_leaves') || BLOCKS[id].model === 'tall';
  // ---------------------------------------------------------------- a structure plan
  // modes: 0 set, 1 only into air/plants/fluid, 2 foundation (set and continue down to the ground), 3 only into solid (carving),
  // 4 only into solid but not cave air, 5 anything but bedrock, 6 only into fluids
  class Plan {
    constructor(x, y, z, k) { this.ox = x; this.oy = y; this.oz = z; this.k = k || 0; this.buckets = new Map(); this.bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; this.boxes = []; this.n = 0; }
    bucket(x, z) { const k = (x >> 4) + ',' + (z >> 4); let b = this.buckets.get(k); if (!b) { b = { blocks: [], ents: [], bes: [], regions: [] }; this.buckets.set(k, b); } return b; }
    // a big world-space box of one block, kept as one entry per chunk (written before the single blocks)
    region(x0, y0, z0, x1, y1, z1, id, st, mode) {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
      y0 = Math.max(y0, MINY); y1 = Math.min(y1, MAXY); if (y0 > y1) return;
      for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) this.bucket(cx * 16, cz * 16).regions.push(Math.max(x0, cx * 16), y0, Math.max(z0, cz * 16), Math.min(x1, cx * 16 + 15), y1, Math.min(z1, cz * 16 + 15), id, st || 0, mode || 0);
      const b = this.bb; b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], y0); b[2] = Math.min(b[2], z0); b[3] = Math.max(b[3], x1); b[4] = Math.max(b[4], y1); b[5] = Math.max(b[5], z1);
    }
    // the same in local coordinates
    lregion(x0, y0, z0, x1, y1, z1, id, st, mode) { const [ax, az] = this.tx(x0, z0), [bx, bz] = this.tx(x1, z1); this.region(ax, this.oy + y0, az, bx, this.oy + y1, bz, id, rotState(id, st || 0, this.k), mode); }
    // local (x right, z forward) to world, turned k times clockwise about the origin
    tx(lx, lz) { let x = lx, z = lz; for (let i = 0; i < this.k; i++) { const t = x; x = -z; z = t; } return [this.ox + x, this.oz + z]; }
    put(x, y, z, id, st, mode) {
      if (y < MINY || y > MAXY) return;
      this.bucket(x, z).blocks.push(x, y, z, id, st || 0, mode || 0); this.n++;
      const b = this.bb; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z;
    }
    set(lx, ly, lz, id, st, mode) { const [x, z] = this.tx(lx, lz); this.put(x, this.oy + ly, z, id, rotState(id, st || 0, this.k), mode); }
    fill(x0, y0, z0, x1, y1, z1, id, st, mode) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, id, st, mode); }
    // the outside of a box (walls, floor and ceiling) with an inside of another block (or air)
    shell(x0, y0, z0, x1, y1, z1, wall, inside, mode) {
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
        if (edge) this.set(x, y, z, typeof wall === 'function' ? wall(x, y, z) : wall, 0, mode); else if (inside !== undefined && inside !== null) this.set(x, y, z, inside, 0, mode);
      }
    }
    // a facing in local terms (2 north = -z, 3 south = +z, 4 west = -x, 5 east = +x)
    ent(lx, ly, lz, data) { const [x, z] = this.tx(lx, lz); const d = Object.assign({}, data, { x: x + 0.5, y: this.oy + ly, z: z + 0.5 }); this.bucket(x, z).ents.push(d); }
    be(lx, ly, lz, data) { const [x, z] = this.tx(lx, lz); this.bucket(x, z).bes.push(Object.assign({ x, y: this.oy + ly, z }, data)); }
    chest(lx, ly, lz, facing, loot, seed) { this.set(lx, ly, lz, B.chest, facing); this.be(lx, ly, lz, { type: 'container', items: new Array(27).fill(null), loot, seed: seed || 0 }); }
    barrel(lx, ly, lz, facing, loot, seed) { this.set(lx, ly, lz, B.barrel, facing); this.be(lx, ly, lz, { type: 'container', items: new Array(27).fill(null), loot, seed: seed || 0 }); }
    // suspicious sand or gravel holding one roll of an archaeology loot table
    sus(lx, ly, lz, id, loot, seed) { this.set(lx, ly, lz, id, 0); this.be(lx, ly, lz, { type: 'brushable', loot: 'archaeology/' + loot, seed: seed || 1, item: null, count: 0, resetAt: 0, coolEnd: 0, dir: -1 }); }
    spawner(lx, ly, lz, mob) { this.set(lx, ly, lz, B.spawner, 0); this.be(lx, ly, lz, { type: 'spawner', mob, delay: 20 }); }
    // a named box of the structure (mob spawning rules use some of them)
    box(x0, y0, z0, x1, y1, z1, tag) { const [ax, az] = this.tx(x0, z0), [bx, bz] = this.tx(x1, z1); this.boxes.push([Math.min(ax, bx), this.oy + Math.min(y0, y1), Math.min(az, bz), Math.max(ax, bx), this.oy + Math.max(y0, y1), Math.max(az, bz), tag]); }
    sub(lx, ly, lz, k) { const [x, z] = this.tx(lx, lz); const p = new Plan(x, this.oy + ly, z, (this.k + k) & 3); p.buckets = this.buckets; p.bb = this.bb; p.boxes = this.boxes; return p; }
  }
  // write one chunk's part of a plan
  function apply(plan, w, cx, cz) {
    const b = plan.buckets.get(cx + ',' + cz); if (!b) return;
    const R = b.regions || [];
    for (let i = 0; i < R.length; i += 9) {
      const id = R[i + 6], st = R[i + 7], mode = R[i + 8];
      for (let y = R[i + 1]; y <= R[i + 4]; y++) for (let z = R[i + 2]; z <= R[i + 5]; z++) for (let x = R[i]; x <= R[i + 3]; x++) {
        if (mode === 0) w.set(x, y, z, id, st);
        else if (mode === 1) { if (replaceable(w.get(x, y, z))) w.set(x, y, z, id, st); }
        else if (mode === 3) { const c = w.get(x, y, z); if (c !== 0 && !BLOCKS[c].fluid) w.set(x, y, z, id, st); }
        else if (mode === 4) { const c = w.get(x, y, z); if (c !== 0 && c !== B.cave_air) w.set(x, y, z, id, st); }
        else if (mode === 5) { const c = w.get(x, y, z); if (c !== B.bedrock) w.set(x, y, z, id, st); } // anything but bedrock
        else if (mode === 6) { const c = w.get(x, y, z); if (c && BLOCKS[c].fluid) w.set(x, y, z, id, st); } // only fluids (sealing aquifers off)
      }
    }
    const L = b.blocks;
    for (let i = 0; i < L.length; i += 6) {
      const x = L[i], y = L[i + 1], z = L[i + 2], id = L[i + 3], st = L[i + 4], mode = L[i + 5];
      if (mode === 0) w.set(x, y, z, id, st);
      else if (mode === 1) { if (replaceable(w.get(x, y, z))) w.set(x, y, z, id, st); }
      else if (mode === 2) { w.set(x, y, z, id, st); for (let yy = y - 1, n = 0; yy > MINY && n < 40 && replaceable(w.get(x, yy, z)); yy--, n++) w.set(x, yy, z, id, st); }
      else if (mode === 3) { const c = w.get(x, y, z); if (c !== 0 && !BLOCKS[c].fluid) w.set(x, y, z, id, st); }
      else if (mode === 4) { const c = w.get(x, y, z); if (c !== 0 && c !== B.cave_air) w.set(x, y, z, id, st); } // keep caves open
      else if (mode === 5) { if (w.get(x, y, z) !== B.bedrock) w.set(x, y, z, id, st); }
    }
    for (const e of b.ents) w.o.ents.push(e);
    for (const e of b.bes) w.blockEntity(e.x, e.y, e.z, e);
  }
  // ---------------------------------------------------------------- placement
  function startOf(seed, gx, gz, s) {
    const r = new Rand(hashInt(seed, gx * 7 + 3, gz * 13 + 5, s.salt)), k = s.spacing - s.sep;
    const ox = s.tri ? Math.floor((r.int(k) + r.int(k)) / 2) : r.int(k), oz = s.tri ? Math.floor((r.int(k) + r.int(k)) / 2) : r.int(k);
    return [gx * s.spacing + ox, gz * s.spacing + oz, r];
  }
  const TYPES = [];
  function reg(s) { TYPES.push(s); return s; }
  const cache = new Map();
  // the cheap first test of a rare structure (the same draw planFor makes first)
  const roll = (s, gen, cx, cz) => new Rand(hashInt(gen.seed, cx, cz, s.salt + 777)).next() < s.freq;
  function planFor(s, gen, cx, cz) {
    const key = s.name + '|' + gen.seed + '|' + cx + ',' + cz + '|' + (gen.flat ? 1 : 0);
    if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
    let plan = null;
    try {
      const r = new Rand(hashInt(gen.seed, cx, cz, s.salt + 777));
      if (!s.freq || r.next() < s.freq) plan = s.build(gen, r, cx * 16 + 8, cz * 16 + 8, cx, cz) || null;
    } catch (e) { plan = null; if (typeof console !== 'undefined') console.warn('structure', s.name, e); }
    if (plan) plan.name = s.name;
    cache.set(key, plan);
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    return plan;
  }
  // every plan of a dimension that might reach chunk (cx, cz)
  function plansNear(dim, gen, cx, cz, only) {
    const out = [];
    for (const s of TYPES) {
      if (s.dim !== dim || (only && s.name !== only)) continue;
      if (s.flatOk === false && gen.flat) continue;
      if (s.custom) { for (const st of s.custom(gen, cx, cz)) { if (s.freq && !roll(s, gen, st[0], st[1])) continue; const p = planFor(s, gen, st[0], st[1]); if (p) out.push(p); } continue; }
      const R = s.reach;
      for (let gx = Math.floor((cx - R) / s.spacing); gx <= Math.floor((cx + R) / s.spacing); gx++) for (let gz = Math.floor((cz - R) / s.spacing); gz <= Math.floor((cz + R) / s.spacing); gz++) {
        const [sx, sz] = startOf(gen.seed, gx, gz, s);
        if (Math.abs(sx - cx) > R || Math.abs(sz - cz) > R) continue;
        const p = planFor(s, gen, sx, sz); if (p) out.push(p);
      }
    }
    return out;
  }
  function place(gen, w, cx, cz) { for (const p of plansNear('overworld', gen, cx, cz)) apply(p, w, cx, cz); }
  function placeNether(gen, w, cx, cz) { for (const p of plansNear('nether', gen, cx, cz)) apply(p, w, cx, cz); }
  function placeEnd(gen, w, cx, cz) { for (const p of plansNear('end', gen, cx, cz)) apply(p, w, cx, cz); }
  // the nearest structure of a kind (for eyes of ender, maps and /locate): searches outward ring by ring
  function locate(name, gen, x, z, maxChunks) {
    const s = TYPES.find(t => t.name === name); if (!s) return null;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    if (s.locate) return s.locate(gen, x, z);
    let best = null, bd = 1e18;
    const rings = Math.ceil((maxChunks || 400) / s.spacing);
    for (let ring = 0; ring <= rings; ring++) {
      for (let gx = Math.floor(cx / s.spacing) - ring; gx <= Math.floor(cx / s.spacing) + ring; gx++) for (let gz = Math.floor(cz / s.spacing) - ring; gz <= Math.floor(cz / s.spacing) + ring; gz++) {
        if (Math.max(Math.abs(gx - Math.floor(cx / s.spacing)), Math.abs(gz - Math.floor(cz / s.spacing))) !== ring) continue;
        const [sx, sz] = startOf(gen.seed, gx, gz, s);
        const d = (sx - cx) ** 2 + (sz - cz) ** 2; if (d >= bd) continue;
        if (s.check && !s.check(gen, sx * 16 + 8, sz * 16 + 8)) continue;
        const p = planFor(s, gen, sx, sz); if (!p) continue;
        bd = d; best = { x: sx * 16 + 8, y: p.oy, z: sz * 16 + 8, plan: p };
      }
      if (best && ring > 1) break;
    }
    return best;
  }
  // the rectangles where trees should not grow (village streets and lots) near a chunk
  function treeless(gen, cx, cz) {
    const out = [];
    for (const p of plansNear('overworld', gen, cx, cz, 'village')) if (p.treeless) for (const q of p.treeless) if (q[2] >= cx * 16 - 4 && q[0] <= cx * 16 + 19 && q[3] >= cz * 16 - 4 && q[1] <= cz * 16 + 19) out.push(q);
    return out;
  }
  // which structure boxes contain a point (the page asks this for special mob spawning)
  function at(dim, gen, x, y, z, names) {
    const out = [];
    const plans = names ? names.flatMap(n => plansNear(dim, gen, x >> 4, z >> 4, n)) : plansNear(dim, gen, x >> 4, z >> 4);
    for (const p of plans) {
      const b = p.bb; if (x < b[0] || x > b[3] || y < b[1] - 1 || y > b[4] + 1 || z < b[2] || z > b[5]) continue;
      // some structures only count inside their pieces (trial chambers), not their whole bounding box
      if (p.pieceOnly && !p.boxes.some(q => x >= q[0] && x <= q[3] && y >= q[1] && y <= q[4] && z >= q[2] && z <= q[5])) continue;
      out.push(p);
    }
    return out;
  }
  // ---------------------------------------------------------------- helpers for the buildings
  const biomeAt = (gen, x, z) => G.BIOMES[gen.column(x, z, {}).biome].name;
  const heightAt = (gen, x, z) => gen.column(x, z, {}).h;
  // the ground height over a footprint: the lowest corner and how uneven it is
  function ground(gen, x0, z0, x1, z1) { let lo = 1e9, hi = -1e9; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) >> 1, (z0 + z1) >> 1]]) { const h = heightAt(gen, x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); } return { lo, hi }; }
  const isOcean = n => /ocean/.test(n), dry = (gen, x, z) => { const c = gen.column(x, z, {}); return c.h >= SEA && !isOcean(G.BIOMES[c.biome].name) && G.BIOMES[c.biome].name !== 'river'; };

  // ---------------------------------------------------------------- desert pyramid (21 x 21, with the TNT room)
  reg({ name: 'desert_pyramid', dim: 'overworld', spacing: 32, sep: 8, salt: 14357617, reach: 2, flatOk: false,
    check: (gen, x, z) => biomeAt(gen, x, z) === 'desert',
    build(gen, r, x, z) {
      if (biomeAt(gen, x, z) !== 'desert') return null;
      const g = ground(gen, x - 10, z - 10, x + 10, z + 10); if (g.lo < SEA) return null;
      const p = new Plan(x - 10, g.lo - 14, z - 10, r.int(4));
      const SS = B.sandstone, CS = B.cut_sandstone, CH = B.chiseled_sandstone, OT = B.orange_terracotta, BT = B.blue_terracotta;
      // foundation and the stepped pyramid
      p.fill(0, -4, 0, 20, 0, 20, SS, 0, 2);
      p.fill(0, 1, 0, 20, 23, 20, 0);
      for (let i = 0; i <= 9; i++) for (let x0 = i; x0 <= 20 - i; x0++) for (let z0 = i; z0 <= 20 - i; z0++) if (x0 === i || x0 === 20 - i || z0 === i || z0 === 20 - i) p.set(x0, 14 + i, z0, SS);
      // hollow body walls (floor at 14 = ground level)
      p.shell(0, 10, 0, 20, 14, 20, SS, 0);
      // towers at the front corners
      for (const tx of [0, 16]) { p.shell(tx, 14, 0, tx + 4, 23, 4, SS, 0); p.fill(tx + 1, 24, 1, tx + 3, 24, 3, CS); p.set(tx + 2, 23, 0, B.orange_terracotta); for (let y = 16; y <= 21; y += 2) p.set(tx + 2, y, 0, CH); p.set(tx + 2, 15, 4, 0); p.set(tx + 2, 16, 4, 0); }
      // the entrance and the hall
      p.fill(8, 15, 0, 12, 19, 4, SS); p.fill(9, 15, 0, 11, 17, 4, 0); p.set(10, 18, 0, CH); p.set(9, 19, 0, OT); p.set(11, 19, 0, OT);
      p.fill(5, 15, 5, 15, 19, 15, 0);
      // the coloured floor: an orange cross with a blue centre over the hidden room
      for (let i = -2; i <= 2; i++) { p.set(10 + i, 14, 10, OT); p.set(10, 14, 10 + i, OT); }
      p.set(10, 14, 10, BT); p.set(9, 14, 9, OT); p.set(11, 14, 9, OT); p.set(9, 14, 11, OT); p.set(11, 14, 11, OT);
      for (const c of [[6, 6], [14, 6], [6, 14], [14, 14]]) p.set(c[0], 14, c[1], OT);
      // the hidden room: four chests, nine TNT under a stone pressure plate
      p.fill(7, 1, 7, 13, 13, 13, SS); p.fill(8, 1, 8, 12, 13, 12, 0); p.fill(9, 13, 9, 11, 13, 11, SS); p.set(10, 13, 10, 0);
      p.fill(8, 0, 8, 12, 0, 12, SS); p.fill(9, 0, 9, 11, 0, 11, B.tnt); p.set(10, 1, 10, B.stone_pressure_plate);
      for (let y = 1; y <= 3; y++) for (const [cx, cz] of [[8, 10], [12, 10], [10, 8], [10, 12]]) p.set(cx, y, cz, CS);
      const cf = [[10, 7, 3], [10, 13, 2], [7, 10, 5], [13, 10, 4]];
      cf.forEach(([cx, cz, f], i) => { p.set(cx, 3, cz, 0); p.fill(cx, 1, cz, cx, 2, cz, 0); p.chest(cx, 1, cz, f, 'chests/desert_pyramid', r.int(1e9) + i); });
      // suspicious sand in the floor of the hall (archaeology)
      for (let i = 0, n = 5 + r.int(3); i < n; i++) p.sus(5 + r.int(11), 14, 5 + r.int(11), B.suspicious_sand, 'desert_pyramid', r.int(1e9) + 1);
      p.box(0, 0, 0, 20, 24, 20, 'desert_pyramid');
      return p;
    } });

  // ---------------------------------------------------------------- jungle temple (with tripwire arrows and its chests)
  reg({ name: 'jungle_temple', dim: 'overworld', spacing: 32, sep: 8, salt: 14357619, reach: 2, flatOk: false,
    check: (gen, x, z) => /jungle/.test(biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      if (!/jungle/.test(biomeAt(gen, x, z))) return null;
      const g = ground(gen, x - 6, z - 7, x + 6, z + 7); if (g.lo < SEA) return null;
      const p = new Plan(x - 6, g.lo - 4, z - 7, r.int(4));
      const stone = () => r.chance(0.4) ? B.mossy_cobblestone : B.cobblestone;
      p.fill(0, 0, 0, 11, 13, 14, 0);
      p.shell(0, 0, 0, 11, 9, 14, () => stone(), 0);
      p.fill(0, 4, 0, 11, 4, 14, stone());
      p.shell(2, 9, 2, 9, 12, 12, () => stone(), 0);
      p.fill(3, 13, 3, 8, 13, 11, stone());
      // entrance and stairs down
      p.fill(4, 5, 0, 7, 7, 0, 0); p.fill(5, 10, 2, 6, 11, 2, 0);
      for (let i = 0; i < 4; i++) p.fill(9, 4 - i, 3 + i, 10, 4 - i, 3 + i, B.cobblestone_stairs, 3);
      p.fill(9, 1, 3, 10, 3, 7, 0);
      // the tripwire corridor with two dispensers of arrows
      p.set(1, 1, 7, B.tripwire_hook, 5); p.set(2, 1, 7, B.tripwire, 0); p.set(3, 1, 7, B.tripwire, 0); p.set(4, 1, 7, B.tripwire_hook, 4);
      p.set(0, 2, 9, B.dispenser, 5); p.be(0, 2, 9, { type: 'container', items: new Array(9).fill(null), loot: 'chests/jungle_temple_dispenser', seed: r.int(1e9) });
      p.set(4, 1, 13, B.dispenser, 2); p.be(4, 1, 13, { type: 'container', items: new Array(9).fill(null), loot: 'chests/jungle_temple_dispenser', seed: r.int(1e9) });
      // the lever room and the two chests
      for (const lx of [3, 5, 7]) p.set(lx, 2, 13, B.lever, (1 << 3) | 2);
      p.chest(9, 1, 12, 4, 'chests/jungle_temple', r.int(1e9));
      p.chest(1, 1, 3, 3, 'chests/jungle_temple', r.int(1e9));
      p.set(2, 1, 12, B.chiseled_stone_bricks); p.set(2, 2, 12, B.chiseled_stone_bricks);
      p.fill(-1, -6, -1, 12, -1, 15, B.cobblestone, 0, 2);
      p.box(0, 0, 0, 11, 13, 14, 'jungle_temple');
      return p;
    } });

  // ---------------------------------------------------------------- swamp hut (witch, black cat, cauldron)
  reg({ name: 'swamp_hut', dim: 'overworld', spacing: 32, sep: 8, salt: 14357620, reach: 1, flatOk: false,
    check: (gen, x, z) => biomeAt(gen, x, z) === 'swamp',
    build(gen, r, x, z) {
      if (biomeAt(gen, x, z) !== 'swamp') return null;
      const p = new Plan(x - 3, Math.max(SEA, heightAt(gen, x, z)) + 2, z - 4, r.int(4));
      const PL = B.spruce_planks, LOG = B.oak_log;
      for (const [lx, lz] of [[1, 2], [5, 2], [1, 7], [5, 7]]) p.fill(lx, -1, lz, lx, 2, lz, LOG, 0, 2);
      p.fill(1, 1, 1, 5, 1, 7, PL); p.fill(1, 2, 2, 5, 4, 7, PL); p.fill(2, 2, 3, 4, 4, 6, 0);
      p.fill(2, 2, 2, 4, 3, 2, 0); p.set(3, 2, 2, 0); p.set(1, 3, 4, B.oak_fence); p.set(5, 3, 4, B.oak_fence); p.set(1, 3, 6, 0); p.set(5, 3, 6, 0);
      p.fill(0, 4, 1, 6, 4, 8, B.spruce_stairs, 0); p.fill(1, 5, 2, 5, 5, 7, B.spruce_planks);
      for (let z0 = 1; z0 <= 8; z0++) { p.set(0, 4, z0, B.spruce_stairs, 5); p.set(6, 4, z0, B.spruce_stairs, 4); }
      p.fill(1, 4, 1, 5, 4, 1, B.spruce_stairs, 3); p.fill(1, 4, 8, 5, 4, 8, B.spruce_stairs, 2);
      p.set(4, 2, 6, B.cauldron, 0); p.set(2, 2, 6, B.crafting_table); p.set(4, 3, 3, B.flower_pot, Models_POT('red_mushroom'));
      p.ent(3, 2, 4, { type: 'witch', persistent: true }); p.ent(3, 2, 5, { type: 'cat', variant: 'all_black', persistent: true });
      p.box(0, -2, 0, 6, 6, 8, 'swamp_hut');
      return p;
    } });
  // flower pot contents are stored as an index into the pot plant list
  function Models_POT(n) { const L = [null, 'poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'oak_sapling', 'spruce_sapling', 'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling', 'cherry_sapling', 'mangrove_propagule', 'red_mushroom', 'brown_mushroom']; return Math.max(0, L.indexOf(n)); }

  // ---------------------------------------------------------------- igloo (and half the time a basement lab)
  reg({ name: 'igloo', dim: 'overworld', spacing: 32, sep: 8, salt: 14357618, reach: 1, flatOk: false,
    check: (gen, x, z) => ['snowy_plains', 'snowy_taiga', 'snowy_slopes'].includes(biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      if (!['snowy_plains', 'snowy_taiga', 'snowy_slopes'].includes(biomeAt(gen, x, z))) return null;
      const h = heightAt(gen, x, z); if (h < SEA) return null;
      const p = new Plan(x, h + 1, z, r.int(4)), SN = B.snow_block;
      // the dome: an ellipsoid shell of snow, 7 x 5 x 7 inside
      for (let lx = -4; lx <= 4; lx++) for (let lz = -4; lz <= 4; lz++) for (let ly = 0; ly <= 4; ly++) {
        const d = (lx * lx) / 16 + (ly * ly) / 16 + (lz * lz) / 16;
        if (d <= 1.05) p.set(lx, ly, lz, d > 0.6 || ly === 4 ? SN : 0);
      }
      p.fill(-3, -1, -3, 3, -1, 3, SN, 0, 2);
      p.fill(-1, 0, -5, 1, 2, -4, SN); p.fill(0, 0, -5, 0, 1, -4, 0); p.set(-1, 1, -3, B.ice); p.set(1, 1, -3, B.ice);
      for (const [lx, lz] of [[-3, 0], [3, 0]]) p.set(lx, 1, lz, B.ice);
      p.fill(-2, 0, -2, 2, 0, 2, B.white_carpet);
      p.set(2, 0, 1, B.red_bed, 3); p.set(2, 0, 2, B.red_bed, 3 | 8);
      p.set(-2, 0, 2, B.furnace, 3); p.set(-2, 0, 1, B.crafting_table); p.set(0, 1, 3, B.redstone_torch, 2);
      if (r.chance(0.5)) {
        // the basement: a ladder shaft under a trapdoor down to a stone brick lab with a zombie villager and a villager in cells
        p.set(0, 0, 0, B.oak_trapdoor, 2); const depth = 3 + r.int(8);
        for (let i = 1; i <= depth * 3; i++) { p.fill(-1, -i, -1, 1, -i, 1, B.stone_bricks); p.set(0, -i, 0, B.ladder, 3); }
        const by = -depth * 3 - 6;
        p.shell(-4, by, -4, 4, by + 5, 6, B.stone_bricks, 0); p.set(0, by + 5, 0, 0);
        p.set(-2, by + 1, -2, B.brewing_stand, 0); p.be(-2, by + 1, -2, { type: 'brewing', items: [{ $s: 1, id: 'splash_potion', count: 1, dmg: 0, tag: { potion: 'weakness' } }, null, null, null, null], fuel: 0, time: 0 });
        p.set(2, by + 1, -2, B.cauldron, 0); p.chest(-3, by + 1, -1, 5, 'chests/igloo_chest', r.int(1e9));
        p.set(-2, by + 2, -3, B.oak_wall_sign, 3);
        for (const cxz of [-2, 2]) { p.fill(cxz - 1, by + 1, 3, cxz + 1, by + 3, 5, B.iron_bars); p.fill(cxz, by + 1, 4, cxz, by + 2, 5, 0); }
        p.ent(-2, by + 1, 4.5, { type: 'zombie_villager', persistent: true }); p.ent(2, by + 1, 4.5, { type: 'villager', persistent: true });
      }
      p.box(-4, -30, -5, 4, 4, 6, 'igloo');
      return p;
    } });

  // ---------------------------------------------------------------- pillager outpost (a dark oak watchtower, pillagers and a captain)
  reg({ name: 'pillager_outpost', dim: 'overworld', spacing: 32, sep: 8, salt: 165745296, reach: 2, freq: 0.2, flatOk: false,
    check: (gen, x, z) => ['plains', 'desert', 'savanna', 'snowy_plains', 'taiga', 'meadow', 'grove', 'snowy_slopes', 'frozen_peaks', 'jagged_peaks', 'cherry_grove'].includes(biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      if (!this.check(gen, x, z)) return null;
      const g = ground(gen, x - 4, z - 4, x + 4, z + 4); if (g.lo < SEA) return null;
      const p = new Plan(x - 4, g.lo + 1, z - 4, r.int(4)), DO = B.dark_oak_planks, LG = B.dark_oak_log, CB = B.cobblestone;
      p.fill(0, -1, 0, 8, -1, 8, CB, 0, 2);
      for (const [lx, lz] of [[0, 0], [8, 0], [0, 8], [8, 8]]) p.fill(lx, 0, lz, lx, 19, lz, LG);
      for (let ly of [0, 5, 10, 15]) { p.fill(1, ly, 0, 7, ly + 4, 0, DO); p.fill(1, ly, 8, 7, ly + 4, 8, DO); p.fill(0, ly, 1, 0, ly + 4, 7, DO); p.fill(8, ly, 1, 8, ly + 4, 7, DO); }
      p.fill(1, 1, 1, 7, 19, 7, 0);
      for (let ly of [5, 10, 15]) p.fill(1, ly, 1, 7, ly, 7, DO);
      p.fill(3, 1, 0, 5, 3, 0, 0); p.fill(1, 6, 1, 1, 9, 1, 0);
      for (let ly of [2, 7, 12, 17]) { p.set(4, ly, 0, B.dark_oak_fence); p.set(4, ly, 8, B.dark_oak_fence); p.set(0, ly, 4, B.dark_oak_fence); p.set(8, ly, 4, B.dark_oak_fence); }
      for (let ly = 1; ly <= 19; ly++) p.set(7, ly, 7, B.ladder, 2);
      for (const ly of [5, 10, 15]) { p.set(7, ly, 7, B.ladder, 2); p.set(6, ly, 6, 0); }
      p.fill(-1, 20, -1, 9, 20, 9, DO); p.fill(-1, 21, -1, 9, 21, -1, B.dark_oak_fence); p.fill(-1, 21, 9, 9, 21, 9, B.dark_oak_fence); p.fill(-1, 21, 0, -1, 21, 8, B.dark_oak_fence); p.fill(9, 21, 0, 9, 21, 8, B.dark_oak_fence);
      p.fill(0, 24, 0, 8, 24, 8, B.dark_oak_slab); for (const [lx, lz] of [[0, 0], [8, 0], [0, 8], [8, 8]]) p.fill(lx, 20, lz, lx, 23, lz, LG);
      p.chest(4, 21, 4, 2, 'chests/pillager_outpost', r.int(1e9));
      p.set(1, 21, 1, B.white_banner || DO);
      // pillagers: one captain at the top, more around
      p.ent(3, 21, 3, { type: 'pillager', captain: true, persistent: true });
      for (let i = 0; i < 3; i++) p.ent(-3 + i * 6, 0, 10, { type: 'pillager', persistent: true });
      // around it: a target, a cage with an iron golem or an allay
      if (r.chance(0.5)) { const cx = 12, cz = 2; p.fill(cx - 1, 0, cz - 1, cx + 1, 3, cz + 1, B.dark_oak_fence); p.fill(cx, 0, cz, cx, 2, cz, 0); p.fill(cx - 1, 3, cz - 1, cx + 1, 3, cz + 1, B.dark_oak_planks); p.ent(cx, 0, cz, { type: r.chance(0.5) ? 'iron_golem' : 'allay', persistent: true }); }
      if (r.chance(0.7)) { p.fill(-6, 0, 3, -6, 1, 3, B.oak_fence); p.set(-6, 2, 3, B.carved_pumpkin, 5); p.set(-7, 0, 6, B.hay_block); p.set(-7, 1, 6, B.target || B.hay_block); }
      p.box(-8, -2, -2, 15, 25, 12, 'pillager_outpost');
      return p;
    } });

  // ---------------------------------------------------------------- ruined portals (overworld and Nether)
  function ruinedPortal(gen, r, x, z, nether) {
    let y;
    if (nether) { y = 32 + r.int(60); } else { const h = heightAt(gen, x, z); y = h < SEA ? h : (r.chance(0.5) ? h - r.int(4) : h + 1); }
    const p = new Plan(x, y, z, r.int(4));
    const w = 4, ht = 5, obs = () => r.chance(0.15) ? B.crying_obsidian : B.obsidian;
    // the netherrack and magma around the base
    for (let lx = -3; lx <= w + 2; lx++) for (let lz = -3; lz <= 3; lz++) { const d = Math.hypot(lx - 1.5, lz); if (d < 3.5 + r.next() && r.chance(0.8)) p.set(lx, -1, lz, r.chance(0.2) ? B.magma_block : B.netherrack, 0, nether ? 0 : 2); }
    // a frame with pieces missing
    for (let i = 0; i < w; i++) for (let j = 0; j < ht; j++) {
      const edge = i === 0 || i === w - 1 || j === 0 || j === ht - 1;
      if (!edge) { p.set(i, j, 0, 0); continue; }
      if (r.chance(0.65)) p.set(i, j, 0, obs());
    }
    for (let k = 0; k < 3; k++) p.set(-1 + r.int(w + 2), -1 + r.int(2), -2 + r.int(5), r.chance(0.5) ? B.gold_block : B.obsidian);
    p.chest(w + 1, 0, 1, 2, 'chests/ruined_portal', r.int(1e9));
    if (!nether) for (let k = 0; k < 6; k++) p.set(-2 + r.int(w + 4), r.int(3), -2 + r.int(5), B.vine, 1, 1);
    p.box(-3, -1, -3, w + 2, ht, 3, 'ruined_portal');
    return p;
  }
  reg({ name: 'ruined_portal', dim: 'overworld', spacing: 40, sep: 15, salt: 34222645, reach: 1, build: (gen, r, x, z) => ruinedPortal(gen, r, x, z, false) });
  reg({ name: 'ruined_portal_nether', dim: 'nether', spacing: 40, sep: 15, salt: 34222646, reach: 1, build: (gen, r, x, z) => ruinedPortal(gen, r, x, z, true) });

  // ---------------------------------------------------------------- shipwrecks and ocean ruins
  reg({ name: 'shipwreck', dim: 'overworld', spacing: 24, sep: 4, salt: 165745295, reach: 2, flatOk: false,
    check: (gen, x, z) => isOcean(biomeAt(gen, x, z)) || /beach/.test(biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      const bn = biomeAt(gen, x, z); if (!isOcean(bn) && !/beach/.test(bn)) return null;
      const h = heightAt(gen, x, z), wood = r.pick(['oak', 'spruce', 'dark_oak', 'jungle', 'birch', 'acacia']), PL = B[wood + '_planks'], LG = B[wood + '_log'], ST = B[wood + '_stairs'], FN = B[wood + '_fence'];
      const tilt = r.int(3), p = new Plan(x, h - 1 + tilt, z, r.int(4));
      const len = 18 + r.int(6), broken = r.chance(0.4) ? 8 + r.int(6) : len;
      for (let i = 0; i < Math.min(len, broken); i++) {
        const half = i < 3 ? 1 : i > len - 4 ? 1 : 2;
        p.fill(-half, 0, i, half, 0, i, PL); // the keel
        p.set(-half - 1, 1, i, ST, 4); p.set(half + 1, 1, i, ST, 5); p.set(-half - 1, 2, i, PL); p.set(half + 1, 2, i, PL);
        if (i % 4 === 0) p.set(0, 1, i, LG, 2);
      }
      if (broken === len) { p.fill(0, 1, 6, 0, 9, 6, LG); p.fill(-2, 7, 6, 2, 7, 6, FN); }
      p.fill(-1, 1, 1, 1, 3, 3, 0); p.chest(0, 1, 2, 3, 'chests/shipwreck_supply', r.int(1e9));
      if (broken > 12) p.chest(0, 1, 11, 3, 'chests/shipwreck_map', r.int(1e9));
      if (broken === len) p.chest(0, 1, len - 3, 2, 'chests/shipwreck_treasure', r.int(1e9));
      p.box(-3, -1, 0, 3, 10, len, 'shipwreck');
      return p;
    } });
  reg({ name: 'ocean_ruin', dim: 'overworld', spacing: 20, sep: 8, salt: 14357621, reach: 1, flatOk: false,
    check: (gen, x, z) => isOcean(biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      const bn = biomeAt(gen, x, z); if (!isOcean(bn)) return null;
      const warm = /warm|lukewarm/.test(bn), big = r.chance(0.3), h = heightAt(gen, x, z);
      const p = new Plan(x, h, z, r.int(4));
      const mat = () => warm ? (r.chance(0.3) ? B.cut_sandstone : B.sandstone) : r.pick([B.stone_bricks, B.mossy_stone_bricks, B.cracked_stone_bricks, B.cobblestone]);
      const n = big ? 3 + r.int(3) : 1;
      for (let k = 0; k < n; k++) {
        const ox = big ? r.int(20) - 10 : 0, oz = big ? r.int(20) - 10 : 0, w = 5 + r.int(4), d = 5 + r.int(4), hh = 2 + r.int(4);
        const yy = heightAt(gen, x + ox, z + oz) - h;
        for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) for (let ly = 0; ly < hh; ly++) {
          const edge = lx === 0 || lz === 0 || lx === w - 1 || lz === d - 1;
          if (ly === 0) p.set(ox + lx, yy + ly, oz + lz, mat()); else if (edge && r.chance(0.75 - ly * 0.12)) p.set(ox + lx, yy + ly, oz + lz, mat());
        }
        if (k === 0 || r.chance(0.5)) p.chest(ox + 1 + r.int(w - 2), yy + 1, oz + 1 + r.int(d - 2), 2, big ? 'chests/underwater_ruin_big' : 'chests/underwater_ruin_small', r.int(1e9));
        if (r.chance(0.4)) p.sus(ox + 1 + r.int(w - 2), yy, oz + 1 + r.int(d - 2), warm ? B.suspicious_sand : B.suspicious_gravel, warm ? 'ocean_ruin_warm' : 'ocean_ruin_cold', r.int(1e9) + 1);
        if (r.chance(0.6)) p.ent(ox + 2, yy + 1, oz + 2, { type: 'drowned', persistent: false });
      }
      p.box(-12, -2, -12, 12, 8, 12, 'ocean_ruin');
      return p;
    } });
  // buried treasure: one chest under the sand of beaches (the game's 1% of beach chunks, at block 9, 9)
  reg({ name: 'buried_treasure', dim: 'overworld', spacing: 1, sep: 0, salt: 0, reach: 0, freq: 0.01, flatOk: false,
    custom: (gen, cx, cz) => [[cx, cz]],
    build(gen, r, x0, z0, cx, cz) {
      const x = cx * 16 + 9, z = cz * 16 + 9, bn = biomeAt(gen, x, z); if (!/beach/.test(bn)) return null;
      const h = heightAt(gen, x, z), p = new Plan(x, h - 2 - r.int(2), z, 0);
      p.chest(0, 0, 0, 2, 'chests/buried_treasure', r.int(1e9));
      return p;
    } });
  // desert wells: one in a thousand desert chunks (a feature in the game)
  reg({ name: 'desert_well', dim: 'overworld', spacing: 1, sep: 0, salt: 1, reach: 0, freq: 0.001, flatOk: false,
    custom: (gen, cx, cz) => [[cx, cz]],
    build(gen, r, x, z) {
      if (biomeAt(gen, x, z) !== 'desert') return null;
      const h = heightAt(gen, x, z); if (h < SEA) return null;
      const p = new Plan(x, h, z, 0), SS = B.sandstone;
      p.fill(-2, -1, -2, 2, 0, 2, SS, 0, 2); p.set(0, 0, 0, B.water); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(a, 0, b, B.water);
      p.fill(-1, 1, -1, 1, 1, 1, 0); p.sus(0, -1, 0, B.suspicious_sand, 'desert_well', r.int(1e9) + 1);
      if (r.chance(0.5)) { const [a, b] = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); p.sus(a, -1, b, B.suspicious_sand, 'desert_well', r.int(1e9) + 1); }
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.fill(a, 1, b, a, 2, b, SS);
      p.fill(-1, 3, -1, 1, 3, 1, B.sandstone_slab); p.set(0, 3, 0, SS);
      for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) p.set(a, 1, b, B.sandstone_slab);
      return p;
    } });

  G.StructureGen = G.Structures = { treeless, place, placeNether, placeEnd, locate, at, plansNear, reg, Plan, apply, rotState, biomeAt, heightAt, ground, dry, isOcean, TYPES, startOf, Models_POT, replaceable };
});
