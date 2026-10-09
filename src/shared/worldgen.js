'use strict';
/* World generation (runs in the worker). The Overworld follows the 1.18+ "multi-noise" design: five noise
   fields (continentalness, erosion, weirdness -> peaks and valleys, temperature, humidity) shape the land and
   choose the biome from the same tables the game uses. Caves are cheese caverns, spaghetti tunnels and noodle
   caves, with lava below Y -55. Ores use the 1.18 heights. Y runs from -64 to 191; the sea is at 63. */
SHARED.push(function worldgenModule(G) {
  const { Rand, hashInt, Octaves, Perlin, clamp, smooth, BID, BIOME, BIOMES, Features: F } = G;
  const MINY = -64, MAXY = 191, SEA = 63;
  const I = (x, y, z) => ((y + 64) << 8) | (z << 4) | x;
  function pw(pts, v) {
    if (v <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); }
    return pts[pts.length - 1][1];
  }

  // writes into one chunk; anything outside it is dropped (features from neighbouring chunks are replayed and clipped)
  class ChunkWriter {
    constructor(out, cx, cz) { this.o = out; this.b = out.blocks; this.s = out.states; this.x0 = cx * 16; this.z0 = cz * 16; this.cx = cx; this.cz = cz; }
    inside(x, z) { x -= this.x0; z -= this.z0; return x >= 0 && x < 16 && z >= 0 && z < 16; }
    get(x, y, z) { x -= this.x0; z -= this.z0; if (x < 0 || x > 15 || z < 0 || z > 15 || y < MINY || y > MAXY) return 0; return this.b[I(x, y, z)]; }
    getState(x, y, z) { x -= this.x0; z -= this.z0; if (x < 0 || x > 15 || z < 0 || z > 15 || y < MINY || y > MAXY) return 0; return this.s[I(x, y, z)]; }
    set(x, y, z, id, st) {
      const wx = x, wz = z; x -= this.x0; z -= this.z0; if (x < 0 || x > 15 || z < 0 || z > 15 || y < MINY || y > MAXY) return; const i = I(x, y, z); this.b[i] = id; this.s[i] = st || 0;
      // a block entity whose block is replaced goes with it (structures carving through sculk, chests...)
      const be = this.o.be; for (let k = be.length - 1; k >= 0; k--) { const e = be[k]; if (e.x === wx && e.y === y && e.z === wz) be.splice(k, 1); }
    }
    blockEntity(x, y, z, data) { if (this.inside(x, z)) this.o.be.push(Object.assign({ x, y, z }, data)); }
    entity(type, x, y, z, data) { if (this.inside(Math.floor(x), Math.floor(z))) this.o.ents.push(Object.assign({ type, x, y, z }, data || {})); }
  }

  const B = BID, Bm = BIOME;
  const T_MID = [
    ['snowy_plains', 'snowy_plains', 'snowy_plains', 'snowy_taiga', 'taiga'],
    ['plains', 'plains', 'forest', 'taiga', 'old_growth_spruce_taiga'],
    ['flower_forest', 'plains', 'forest', 'birch_forest', 'dark_forest'],
    ['savanna', 'savanna', 'forest', 'jungle', 'jungle'],
    ['desert', 'desert', 'desert', 'desert', 'desert']];
  const T_MID_VAR = [
    ['ice_spikes', null, 'snowy_taiga', null, null],
    [null, null, null, null, 'old_growth_pine_taiga'],
    ['sunflower_plains', null, null, 'old_growth_birch_forest', null],
    [null, null, 'plains', 'sparse_jungle', 'bamboo_jungle'],
    [null, null, null, null, null]];
  const T_PLATEAU = [
    ['snowy_plains', 'snowy_plains', 'snowy_plains', 'snowy_taiga', 'snowy_taiga'],
    ['meadow', 'meadow', 'forest', 'taiga', 'old_growth_spruce_taiga'],
    ['meadow', 'meadow', 'meadow', 'meadow', 'dark_forest'],
    ['savanna_plateau', 'savanna_plateau', 'forest', 'forest', 'jungle'],
    ['badlands', 'badlands', 'badlands', 'wooded_badlands', 'wooded_badlands']];
  const T_PLATEAU_VAR = [
    ['ice_spikes', null, null, null, null],
    ['cherry_grove', null, 'meadow', 'meadow', 'old_growth_pine_taiga'],
    ['cherry_grove', 'cherry_grove', 'forest', 'birch_forest', null],
    [null, null, null, null, null],
    ['eroded_badlands', 'eroded_badlands', null, null, null]];
  const T_SHATTERED = [
    ['windswept_gravelly_hills', 'windswept_gravelly_hills', 'windswept_hills', 'windswept_forest', 'windswept_forest'],
    ['windswept_gravelly_hills', 'windswept_gravelly_hills', 'windswept_hills', 'windswept_forest', 'windswept_forest'],
    ['windswept_hills', 'windswept_hills', 'windswept_hills', 'windswept_forest', 'windswept_forest']];
  const OCEANS = [['frozen_ocean', 'cold_ocean', 'ocean', 'lukewarm_ocean', 'warm_ocean'], ['deep_frozen_ocean', 'deep_cold_ocean', 'deep_ocean', 'deep_lukewarm_ocean', 'warm_ocean']];
  const MOUNTAIN_BIOMES = new Set(['windswept_hills', 'windswept_gravelly_hills', 'windswept_forest', 'windswept_savanna', 'meadow', 'cherry_grove', 'grove', 'snowy_slopes', 'frozen_peaks', 'jagged_peaks', 'stony_peaks']);

  class Overworld {
    constructor(seed, opts) {
      this.seed = seed;
      // world types: default, superflat (bedrock, two dirt, grass) and large biomes (climate noise four times wider)
      this.flat = !!(opts && opts.type === 'flat'); this.bs = opts && opts.type === 'large' ? 4 : 1;
      this.structures = !(opts && opts.structures === false);
      const h = k => hashInt(seed, k, 31, 17);
      this.nC = new Octaves(h(1), 6, 0.5); this.nE = new Octaves(h(2), 5, 0.5); this.nW = new Octaves(h(3), 5, 0.5);
      this.nT = new Octaves(h(4), 4, 0.5); this.nH = new Octaves(h(5), 4, 0.5); this.nD = new Octaves(h(6), 4, 0.5);
      this.nR = new Octaves(h(7), 4, 0.5); this.nS = new Octaves(h(8), 3, 0.5); this.nM = new Octaves(h(9), 3, 0.5);
      this.cheese = new Octaves(h(10), 2, 0.5); this.spA = new Perlin(h(11)); this.spB = new Perlin(h(12)); this.spT = new Perlin(h(13));
      this.noA = new Perlin(h(14)); this.noB = new Perlin(h(15)); this.ent = new Octaves(h(16), 2, 0.5); this.band = new Perlin(h(17));
      this.cave = new Octaves(h(18), 2, 0.5);
      this.col = { h: 0, biome: 0, C: 0, E: 0, PV: 0, Wn: 0, T: 0, Hm: 0, m: 0, river: 0 };
      // terracotta colour bands for the badlands (vanilla style: runs of plain, orange, yellow, brown, red, white and light grey)
      const r = new Rand(h(19)); this.bands = new Uint16Array(64).fill(B.terracotta);
      for (let i = 0; i < 64; i++) { const k = r.next(); if (k < 0.12) this.bands[i] = B.orange_terracotta; else if (k < 0.2) this.bands[i] = B.yellow_terracotta; else if (k < 0.27) this.bands[i] = B.brown_terracotta; else if (k < 0.36) this.bands[i] = B.red_terracotta; else if (k < 0.42) this.bands[i] = B.white_terracotta; else if (k < 0.47) this.bands[i] = B.light_gray_terracotta; }
    }
    // the noise parameters, terrain height and biome of one column
    column(x, z, o) {
      o = o || this.col;
      const bs = this.bs;
      if (this.flat) { o.h = -61; o.biome = BIOME.plains; o.C = 0.3; o.E = 0; o.PV = 0; o.Wn = 0; o.T = 0.2; o.Hm = 0; o.m = 0; o.river = 0; return o; }
      const C = this.nC.n2(x / 1100 / bs, z / 1100 / bs) * 2.9 + 0.15;
      const E = this.nE.n2(x / 700 / bs, z / 700 / bs) * 3.0;
      const Wn = this.nW.n2(x / 400 / bs, z / 400 / bs) * 2.6;
      const PV = -(Math.abs(Math.abs(Wn) - 0.6667) - 0.3333) * 3;
      const T = this.nT.n2(x / 1700 / bs, z / 1700 / bs) * 2.8, Hm = this.nH.n2(x / 1400 / bs, z / 1400 / bs) * 2.8;
      const inland = smooth(-0.15, 0.25, C);
      const m = Math.pow(clamp((0.05 - E) / 0.75, 0, 1), 1.3) * inland;
      const peak = Math.max(0, PV);
      let h = pw([[-1.2, 26], [-0.455, 36], [-0.3, 44], [-0.19, 52], [-0.11, 61], [-0.04, 64], [0.03, 66], [0.3, 72], [0.6, 82], [1.0, 92]], C);
      h += m * (18 + 70 * peak * peak + 26 * peak);
      h += m * peak * (0.5 - Math.abs(this.nR.n2(x / 70, z / 70))) * 26; // jagged ridges on the peaks
      h += (1 - m) * inland * PV * 5;
      // plateaus: raised flat land where erosion is moderate and far from the sea
      const plat = smooth(0.3, 0.55, C) * smooth(-0.5, -0.2, E) * (1 - smooth(0.1, 0.4, E));
      h += plat * 14;
      h += this.nD.n2(x / 44, z / 44) * (2.5 + 6 * m);
      // rivers follow the valleys of the weirdness noise
      let river = 0;
      if (C > -0.19) {
        river = smooth(-0.84, -0.97, PV) * smooth(-0.19, -0.08, C);
        if (river > 0) { const bed = SEA - 3 - 3 * river; h = h + (Math.min(h, bed) - h) * Math.min(1, river * 1.6); }
      }
      // mushroom islands rise from the deepest oceans
      const mush = C < -0.95 ? smooth(0.42, 0.55, this.nM.n2(x / 180, z / 180)) : 0;
      if (mush > 0) h = h + (SEA + 3 + this.nD.n2(x / 30, z / 30) * 4 - h) * mush;
      if (h > 150) h = 150 + (h - 150) * 0.55;
      h = Math.round(clamp(h, -40, 186));
      o.h = h; o.C = C; o.E = E; o.PV = PV; o.Wn = Wn; o.T = T; o.Hm = Hm; o.m = m; o.river = river;
      o.biome = this.pickBiome(o, mush > 0.5);
      return o;
    }
    pickBiome(o, mush) {
      const { C, E, PV, Wn, T, Hm, h, m, river } = o;
      const tl = T < -0.45 ? 0 : T < -0.15 ? 1 : T < 0.2 ? 2 : T < 0.55 ? 3 : 4;
      const hl = Hm < -0.35 ? 0 : Hm < -0.1 ? 1 : Hm < 0.1 ? 2 : Hm < 0.3 ? 3 : 4;
      if (mush) return Bm.mushroom_fields;
      if (h < SEA - 1) {
        if (river > 0.25) return tl === 0 ? Bm.frozen_river : Bm.river;
        if (C < -0.455) return Bm[OCEANS[1][tl]];
        if (C < -0.11) return Bm[OCEANS[0][tl]];
        return tl === 0 ? Bm.frozen_river : Bm.river;
      }
      if (river > 0.4 && h <= SEA + 1) return tl === 0 ? Bm.frozen_river : Bm.river;
      if (h <= SEA + 2 && C < -0.04) {
        if (E < -0.375 || m > 0.3) return Bm.stony_shore;
        return tl === 0 ? Bm.snowy_beach : tl === 4 ? Bm.desert : Bm.beach;
      }
      const middle = () => { const v = Wn > 0 ? T_MID_VAR[tl][hl] : null; return Bm[v || T_MID[tl][hl]]; };
      const plateau = () => { const v = Wn > 0 ? T_PLATEAU_VAR[tl][hl] : null; return Bm[v || T_PLATEAU[tl][hl]]; };
      if (h > 142 && m > 0.35) return tl <= 2 ? (Wn < 0 ? Bm.jagged_peaks : Bm.frozen_peaks) : tl === 3 ? Bm.stony_peaks : Bm.badlands;
      if (h > 112 && m > 0.25) return tl < 3 ? (hl < 2 ? Bm.snowy_slopes : Bm.grove) : plateau();
      if (E > 0.5 && C > -0.1 && C < 0.45 && h < SEA + 6) {
        if (tl === 1 || tl === 2) return Bm.swamp;
        if (tl >= 3) return Bm.mangrove_swamp;
      }
      if (E > 0.38 && E < 0.5 && Wn > 0 && tl < 3) return Bm[T_SHATTERED[tl][hl]];
      if (E > 0.38 && E < 0.5 && Wn > 0 && tl >= 3 && C > 0.1) return tl === 3 ? Bm.windswept_savanna : Bm.badlands;
      if (h > 92) return plateau();
      if (tl === 4 && E < -0.15 && C > 0.05) return Bm[hl >= 3 ? 'wooded_badlands' : (Wn > 0.35 ? 'eroded_badlands' : 'badlands')];
      return middle();
    }
    // interpolated cave fields on a 4x4x4 grid
    caveFields(cx, cz) {
      const NX = 5, NY = 65, N = NX * NX * NY;
      const f = this._cf || (this._cf = { ch: new Float32Array(N), a: new Float32Array(N), b: new Float32Array(N), t: new Float32Array(N), na: new Float32Array(N), nb: new Float32Array(N), en: new Float32Array(N) });
      for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NX; iz++) for (let iy = 0; iy < NY; iy++) {
        const x = cx * 16 + ix * 4, z = cz * 16 + iz * 4, y = MINY + iy * 4, k = (ix * NX + iz) * NY + iy;
        f.ch[k] = this.cheese.n3(x / 85, y / 42, z / 85);
        f.a[k] = this.spA.noise3(x / 58, y / 38, z / 58); f.b[k] = this.spB.noise3(x / 58, y / 38, z / 58);
        f.t[k] = this.spT.noise3(x / 120, y / 120, z / 120);
        if (y < 72) { f.na[k] = this.noA.noise3(x / 26, y / 22, z / 26); f.nb[k] = this.noB.noise3(x / 26, y / 22, z / 26); } else { f.na[k] = 1; f.nb[k] = 1; }
        f.en[k] = this.ent.n3(x / 60, y / 50, z / 60);
      }
      return f;
    }
    generate(cx, cz) {
      if (this.flat) return this.generateFlat(cx, cz);
      const out = { cx, cz, blocks: new Uint16Array(65536), states: new Uint8Array(65536), biomes: new Uint8Array(256), heights: new Int16Array(256), be: [], ents: [], ticks: [] };
      const blocks = out.blocks, x0 = cx * 16, z0 = cz * 16;
      // column parameters with a one-block border (for slopes)
      const HH = new Int16Array(18 * 18), cols = [];
      for (let dz = -1; dz <= 16; dz++) for (let dx = -1; dx <= 16; dx++) {
        const c = this.column(x0 + dx, z0 + dz, {});
        HH[(dx + 1) + (dz + 1) * 18] = c.h;
        if (dx >= 0 && dx < 16 && dz >= 0 && dz < 16) { cols[dx + dz * 16] = c; out.biomes[dx + dz * 16] = c.biome; out.heights[dx + dz * 16] = c.h; }
      }
      if (G.Caves) out.cave = G.Caves.encode(cols);
      const cf = this.caveFields(cx, cz), NY = 65;
      const rnd = new Rand(hashInt(this.seed, cx, cz, 101));
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const c = cols[x + z * 16], h = c.h, wx = x0 + x, wz = z0 + z;
        const bio = BIOMES[c.biome].name;
        // cave field interpolation weights along x and z for this column
        const fx = x / 4, fz = z / 4, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
        const k00 = (ix * 5 + iz) * NY, k10 = ((ix + 1) * 5 + iz) * NY, k01 = (ix * 5 + iz + 1) * NY, k11 = ((ix + 1) * 5 + iz + 1) * NY;
        const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
        const lerpF = (a, k, ty) => { const lo = a[k00 + k] * w00 + a[k10 + k] * w10 + a[k01 + k] * w01 + a[k11 + k] * w11; const hi = a[k00 + k + 1] * w00 + a[k10 + k + 1] * w10 + a[k01 + k + 1] * w01 + a[k11 + k + 1] * w11; return lo + (hi - lo) * ty; };
        const underwater = h < SEA;
        const deepslateTop = 0 + Math.floor(rnd.next() * 8);
        for (let y = MINY; y <= Math.max(h, SEA); y++) {
          const i = I(x, y, z);
          if (y > h) { blocks[i] = B.water; continue; }
          if (y === MINY || (y < MINY + 5 && rnd.next() < (MINY + 5 - y) / 5)) { blocks[i] = B.bedrock; continue; }
          let id = y < deepslateTop ? B.deepslate : B.stone;
          // caves
          const depth = h - y;
          if (y > MINY + 4 && !(underwater && depth < 8)) {
            const fy = (y - MINY) / 4, iy = Math.floor(fy), ty = fy - iy;
            const ch = lerpF(cf.ch, iy, ty);
            let carve = false;
            const nearSurf = depth < 8;
            const en = nearSurf ? lerpF(cf.en, iy, ty) : 0;
            const allowSurface = !nearSurf || en > 0.28;
            // cheese caverns: bigger and more common deep down, kept away from the surface
            const cheeseT = 0.36 + (y > 0 ? 0.08 : 0) + (depth < 20 ? (20 - depth) * 0.015 : 0);
            if (ch > cheeseT && (depth > 12)) carve = true;
            if (!carve && allowSurface) {
              const a = lerpF(cf.a, iy, ty), b = lerpF(cf.b, iy, ty), t = 0.075 + 0.03 * lerpF(cf.t, iy, ty);
              if (a * a + b * b < t * t) carve = true;
              else if (y < 64) { const na = lerpF(cf.na, iy, ty), nb = lerpF(cf.nb, iy, ty); if (na * na + nb * nb < 0.0016) carve = true; }
            }
            if (carve) id = y <= -55 ? B.lava : 0;
          }
          blocks[i] = id;
        }
        // stone layers at the very top of the world stay air
        // surface
        this.surface(out, x, z, c, bio, HH, rnd);
      }
      const w = new ChunkWriter(out, cx, cz);
      // ores and features of this chunk and its neighbours (clipped to this chunk)
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.ores(w, cx + dx, cz + dz);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.decorate(w, cx + dx, cz + dz);
      // cave biomes, glow lichen, geodes and fossils
      if (G.Caves) G.Caves.decorate(this, w, cx, cz, cols, out);
      if (this.structures && G.Structures) G.Structures.place(this, w, cx, cz);
      this.freeze(out, cols);
      return out;
    }
    surface(out, x, z, c, bio, HH, rnd) {
      const blocks = out.blocks, h = c.h, wx = out.cx * 16 + x, wz = out.cz * 16 + z;
      const hx = (x + 1) + (z + 1) * 18;
      const slope = Math.max(Math.abs(HH[hx + 1] - HH[hx - 1]), Math.abs(HH[hx + 18] - HH[hx - 18]));
      // find the real top (caves may have opened it)
      let top = h; while (top > MINY && (blocks[I(x, top, z)] === 0 || blocks[I(x, top, z)] === B.cave_air)) top--;
      if (top < h - 8) return; // a cave mouth: leave the bare stone
      const sn = this.nS.n2(wx / 12, wz / 12), depth = 3 + Math.floor((sn + 1) * 1.5 + rnd.next());
      let topB = B.grass_block, fill = B.dirt, under = false;
      if (top < SEA) under = true;
      switch (bio) {
        case 'desert': topB = B.sand; fill = B.sand; break;
        case 'beach': case 'snowy_beach': topB = B.sand; fill = B.sand; break;
        case 'stony_shore': topB = B.stone; fill = B.stone; break;
        case 'mushroom_fields': topB = B.mycelium; break;
        case 'swamp': topB = B.grass_block; break;
        case 'mangrove_swamp': topB = B.mud; fill = B.mud; break;
        case 'old_growth_pine_taiga': case 'old_growth_spruce_taiga': topB = sn > 0.25 ? B.podzol : sn < -0.35 ? B.coarse_dirt : B.grass_block; break;
        case 'windswept_gravelly_hills': topB = sn > -0.2 ? B.gravel : B.grass_block; fill = sn > -0.2 ? B.gravel : B.dirt; break;
        case 'windswept_savanna': topB = sn > 0.15 ? B.coarse_dirt : sn < -0.4 ? B.stone : B.grass_block; break;
        case 'savanna_plateau': topB = sn > 0.35 ? B.coarse_dirt : B.grass_block; break;
        case 'snowy_slopes': topB = B.snow_block; fill = B.snow_block; break;
        case 'frozen_peaks': topB = sn > 0.1 ? B.packed_ice : B.snow_block; fill = topB; break;
        case 'jagged_peaks': topB = B.snow_block; fill = B.snow_block; break;
        case 'stony_peaks': topB = sn > 0.3 ? B.calcite : B.stone; fill = B.stone; break;
        case 'badlands': case 'eroded_badlands': case 'wooded_badlands': topB = -1; break;
        case 'river': case 'frozen_river': topB = sn > 0.3 ? B.gravel : B.sand; fill = topB; break;
        case 'warm_ocean': case 'lukewarm_ocean': case 'deep_lukewarm_ocean': topB = B.sand; fill = B.sand; break;
        case 'ocean': topB = sn > 0.25 ? B.gravel : B.sand; fill = topB; break;
        case 'deep_ocean': case 'cold_ocean': case 'deep_cold_ocean': case 'frozen_ocean': case 'deep_frozen_ocean': topB = B.gravel; fill = B.gravel; break;
      }
      if (under && topB === B.grass_block) { topB = sn > 0.4 ? B.clay : sn > -0.2 ? B.sand : B.gravel; fill = topB === B.clay ? B.clay : B.dirt; if (bio === 'swamp' || bio === 'mangrove_swamp') { topB = B.mud; fill = B.dirt; } }
      if (bio === 'windswept_hills' && top > 105 && slope > 1) { topB = B.stone; fill = B.stone; }
      if (slope >= 4 && !under && topB !== -1 && bio !== 'beach' && bio !== 'desert' && bio !== 'snowy_beach') { topB = B.stone; fill = B.stone; }
      if (topB === -1) { // badlands: red sand on the low ground, terracotta bands in the hills
        const wooded = bio === 'wooded_badlands' && top > 96;
        for (let d = 0; d < 14 && top - d > MINY + 4; d++) {
          const y = top - d, i = I(x, y, z); if (blocks[i] !== B.stone && blocks[i] !== B.deepslate) continue;
          if (wooded && d === 0) { blocks[i] = sn > 0 ? B.coarse_dirt : B.grass_block; continue; }
          if (d < 2 && top < 75 && slope < 3) { blocks[i] = d === 0 ? B.red_sand : B.red_sandstone; continue; }
          const bi = ((y + Math.round(this.band.noise2(wx / 64, wz / 64) * 2) + 640) % 64 + 64) % 64;
          blocks[i] = this.bands[bi];
        }
        // eroded badlands: terracotta hoodoos rising from the plains
        if (bio === 'eroded_badlands') { const sp = Math.abs(this.nR.n2(wx / 9, wz / 9)); if (sp < 0.12) { const ht = Math.floor((0.12 - sp) * 260); for (let y = top + 1; y <= Math.min(top + ht, MAXY - 1); y++) blocks[I(x, y, z)] = this.bands[((y % 64) + 64) % 64]; } }
        return;
      }
      for (let d = 0; d < depth && top - d > MINY + 4; d++) {
        const y = top - d, i = I(x, y, z);
        if (blocks[i] !== B.stone && blocks[i] !== B.deepslate) break;
        blocks[i] = d === 0 ? topB : fill;
      }
      // sandstone under sand
      if (topB === B.sand || fill === B.sand) for (let d = depth; d < depth + 4 && top - d > MINY + 4; d++) { const i = I(x, top - d, z); if (blocks[i] !== B.stone) break; blocks[i] = B.sandstone; }
    }
    // snow on cold ground and ice on cold water (the temperature drops with height)
    freeze(out, cols) {
      const blocks = out.blocks, states = out.states;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const bi = out.biomes[x + z * 16], b = BIOMES[bi];
        if (b.dim !== 'overworld') continue;
        let y = MAXY; while (y > MINY && blocks[I(x, y, z)] === 0) y--;
        const t = G.tempAt(bi, y + 1);
        if (t >= 0.15) continue;
        const id = blocks[I(x, y, z)];
        if (id === B.water) { if (states[I(x, y, z)] === 0) blocks[I(x, y, z)] = B.ice; continue; }
        if (b.precip === 'n') continue;
        const d = G.BLOCKS[id];
        if ((d.opaque || d.name.endsWith('_leaves')) && id !== B.ice && id !== B.packed_ice && y < MAXY) {
          blocks[I(x, y + 1, z)] = B.snow;
          if (id === B.grass_block || id === B.podzol || id === B.mycelium) states[I(x, y, z)] = 1; // snowy
        }
      }
    }
    // ore veins (vanilla 1.18 counts, sizes and heights)
    ores(w, cx, cz) {
      const r = new Rand(hashInt(this.seed, cx, cz, 202));
      const c = this.column(cx * 16 + 8, cz * 16 + 8, {});
      const mountain = MOUNTAIN_BIOMES.has(BIOMES[c.biome].name), badlands = BIOMES[c.biome].name.includes('badlands');
      const uni = (a, b) => a + r.next() * (b - a), tri = (a, b) => a + (r.next() + r.next()) / 2 * (b - a);
      const vein = (ore, count, size, yf, airSkip) => {
        for (let k = 0; k < count; k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16), y = Math.floor(yf()); this.vein(w, r, x, y, z, size, ore, airSkip || 0); }
      };
      vein('dirt', 7, 33, () => uni(0, 160)); vein('gravel', 14, 33, () => uni(MINY, MAXY));
      vein('granite', 2, 64, () => uni(0, 60)); vein('diorite', 2, 64, () => uni(0, 60)); vein('andesite', 2, 64, () => uni(0, 60));
      vein('granite', 1, 64, () => uni(64, 128)); vein('diorite', 1, 64, () => uni(64, 128)); vein('andesite', 1, 64, () => uni(64, 128));
      vein('tuff', 2, 64, () => uni(MINY, 0));
      vein('coal', 30, 17, () => uni(136, MAXY)); vein('coal', 20, 17, () => tri(0, 192), 0.5);
      vein('iron', mountain ? 40 : 6, 9, () => uni(80, MAXY)); vein('iron', 10, 9, () => tri(-24, 56)); vein('iron', 10, 4, () => uni(MINY, 72));
      vein('copper', 16, 10, () => tri(-16, 112));
      vein('gold', 4, 9, () => tri(-64, 32), 0.5); if (r.chance(0.5)) vein('gold', 1, 9, () => uni(-64, -48), 0.5);
      if (badlands) vein('gold', 50, 9, () => uni(32, MAXY));
      vein('redstone', 4, 8, () => uni(MINY, 15)); vein('redstone', 8, 8, () => tri(-96, -32));
      vein('lapis', 2, 7, () => tri(-32, 32)); vein('lapis', 4, 7, () => uni(MINY, 64), 1);
      vein('diamond', 7, 4, () => tri(-144, 16), 0.5); vein('diamond', 4, 8, () => tri(-144, 16), 1); if (r.chance(1 / 9)) vein('diamond', 1, 12, () => tri(-144, 16), 0.7);
      if (mountain) { vein('emerald', 24, 3, () => uni(-16, MAXY)); vein('infested', 14, 9, () => uni(MINY, 63)); }
      // springs: single fluid sources in cave walls that start flowing when the chunk loads
      for (let k = 0; k < 25; k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16), y = Math.floor(uni(MINY, 192)); this.spring(w, x, y, z, B.water); }
      for (let k = 0; k < 20; k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16), y = Math.floor(uni(MINY + 8, 32)); this.spring(w, x, y, z, B.lava); }
    }
    spring(w, x, y, z, fluid) {
      if (!w.inside(x, z) || y <= MINY + 5) return;
      const id = w.get(x, y, z); if (id !== B.stone && id !== B.deepslate && id !== B.tuff) return;
      if (w.get(x, y + 1, z) !== B.stone && w.get(x, y + 1, z) !== B.deepslate) return;
      if (w.get(x, y - 1, z) !== B.stone && w.get(x, y - 1, z) !== B.deepslate) return;
      let rock = 0, open = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const b = w.get(x + dx, y, z + dz); if (b === B.stone || b === B.deepslate || b === B.tuff) rock++; else if (b === 0 || b === B.cave_air) open++; }
      if (rock === 3 && open === 1) { w.set(x, y, z, fluid, 0); w.o.ticks.push([x, y, z]); }
    }
    vein(w, r, x, y, z, size, ore, airSkip) {
      // vanilla blob: ellipsoids strung along a short random line
      const ang = r.next() * Math.PI, sp = size / 8;
      const x1 = x + Math.sin(ang) * sp, x2 = x - Math.sin(ang) * sp, z1 = z + Math.cos(ang) * sp, z2 = z - Math.cos(ang) * sp;
      const y1 = y + r.int(3) - 2, y2 = y + r.int(3) - 2;
      for (let k = 0; k < size; k++) {
        const t = k / size, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t, pz = z1 + (z2 - z1) * t;
        const rad = ((Math.sin(Math.PI * t) + 1) * r.next() * size / 16 + 1) / 2;
        const ax = Math.floor(px - rad), bx = Math.floor(px + rad), ay = Math.floor(py - rad), by = Math.floor(py + rad), az = Math.floor(pz - rad), bz = Math.floor(pz + rad);
        for (let bx_ = ax; bx_ <= bx; bx_++) { if (!w.inside(bx_, z) && !w.inside(bx_, az) && !w.inside(bx_, bz)) continue; for (let by_ = ay; by_ <= by; by_++) for (let bz_ = az; bz_ <= bz; bz_++) {
          const dx = (bx_ + 0.5 - px) / rad, dy = (by_ + 0.5 - py) / rad, dz = (bz_ + 0.5 - pz) / rad;
          if (dx * dx + dy * dy + dz * dz >= 1 || !w.inside(bx_, bz_)) continue;
          const cur = w.get(bx_, by_, bz_);
          const stoneLike = cur === B.stone || cur === B.granite || cur === B.diorite || cur === B.andesite, deep = cur === B.deepslate || cur === B.tuff;
          if (!stoneLike && !deep) continue;
          if (airSkip && this.exposed(w, bx_, by_, bz_) && r.next() < airSkip) continue;
          let id;
          switch (ore) {
            case 'dirt': case 'gravel': case 'granite': case 'diorite': case 'andesite': if (!stoneLike) continue; id = B[ore]; break;
            case 'tuff': id = B.tuff; break;
            case 'infested': if (cur !== B.stone) continue; id = B.infested_stone; break;
            default: id = deep ? B['deepslate_' + ore + '_ore'] : B[ore + '_ore'];
          }
          w.set(bx_, by_, bz_, id, 0);
        } }
      }
    }
    exposed(w, x, y, z) { for (let k = 0; k < 6; k++) { const b = w.get(x + G.DX[k], y + G.DY[k], z + G.DZ[k]); if (b === 0 || b === B.cave_air || b === B.water) return true; } return false; }
    // trees, plants and small features of chunk (cx, cz); positions may spill into the neighbours
    decorate(w, cx, cz) {
      const r = new Rand(hashInt(this.seed, cx, cz, 303));
      const c = {};
      const at = (x, z) => this.column(x, z, c);
      const surf = (x, z) => { at(x, z); return c.h; };
      const grassy = (bio) => !['desert', 'beach', 'snowy_beach', 'stony_shore', 'badlands', 'eroded_badlands', 'mushroom_fields', 'stony_peaks', 'jagged_peaks', 'frozen_peaks', 'snowy_slopes', 'mangrove_swamp', 'windswept_gravelly_hills'].includes(bio);
      const cb = this.column(cx * 16 + 8, cz * 16 + 8, {}), bio = BIOMES[cb.biome].name;
      const groundOk = (x, y, z) => { const b = w.get(x, y, z); return !w.inside(x, z) || b === B.grass_block || b === B.dirt || b === B.podzol || b === B.coarse_dirt || b === B.mycelium || b === B.mud || b === B.snow_block || b === B.moss_block; };
      // trees
      const T = { forest: 10, flower_forest: 6, birch_forest: 10, old_growth_birch_forest: 10, dark_forest: 18, taiga: 10, old_growth_pine_taiga: 10, old_growth_spruce_taiga: 10,
        snowy_taiga: 10, savanna: 1, savanna_plateau: 2, windswept_forest: 10, windswept_hills: 0.2, windswept_savanna: 2, jungle: 50, sparse_jungle: 3, bamboo_jungle: 12,
        wooded_badlands: 5, meadow: 0.1, cherry_grove: 1.5, grove: 10, snowy_plains: 0.1, swamp: 2, mangrove_swamp: 8, plains: 0.05, sunflower_plains: 0.05, mushroom_fields: 1, ice_spikes: 0 }[bio] || 0;
      let n = Math.floor(T) + (r.next() < T - Math.floor(T) ? 1 : 0);
      // no trees on village streets and lots
      const bare = n && this.structures && G.Structures ? G.Structures.treeless(this, cx, cz) : null;
      for (let k = 0; k < n; k++) {
        const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16);
        if (bare && bare.some(q => x >= q[0] - 3 && x <= q[2] + 3 && z >= q[1] - 3 && z <= q[3] + 3)) continue;
        at(x, z); const y = c.h + 1, b = BIOMES[c.biome].name;
        if (c.h < SEA && b !== 'mangrove_swamp') continue;
        // only checks that give the same answer from every chunk (noise, not blocks), so a tree is never cut in half
        const hs = [surf(x + 1, z), surf(x - 1, z), surf(x, z + 1), surf(x, z - 1)];
        at(x, z);
        if (Math.max(...hs) - Math.min(...hs) >= 4) continue;
        if (b === 'mangrove_swamp' && c.h < SEA - 2) continue;
        this.tree(w, r, x, y, z, b);
      }
      // ground cover
      const nGrass = { plains: 40, sunflower_plains: 40, savanna: 20, savanna_plateau: 20, forest: 2, flower_forest: 2, jungle: 25, sparse_jungle: 25, bamboo_jungle: 25, taiga: 7, old_growth_pine_taiga: 7, old_growth_spruce_taiga: 7, snowy_taiga: 2, swamp: 5, birch_forest: 2, dark_forest: 2, meadow: 60, windswept_hills: 4, windswept_forest: 4, cherry_grove: 30, grove: 2, river: 0, wooded_badlands: 4 }[bio];
      for (let k = 0; k < (nGrass === undefined ? 2 : nGrass); k++) {
        const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16);
        if (!w.inside(x, z)) continue;
        const y = this.topAt(w, x, z); if (y === null) continue;
        if (w.get(x, y, z) !== B.grass_block || w.get(x, y + 1, z) !== 0) continue;
        const taiga = bio.includes('taiga') || bio === 'grove' || bio.includes('jungle');
        if (bio === 'meadow' || (r.chance(0.08) && bio !== 'swamp')) { w.set(x, y + 1, z, taiga && r.chance(0.5) ? B.large_fern : B.tall_grass, 0); w.set(x, y + 2, z, taiga && r.chance(0.5) ? B.large_fern : B.tall_grass, 8); if (w.get(x, y + 1, z) !== w.get(x, y + 2, z)) w.set(x, y + 2, z, w.get(x, y + 1, z), 8); }
        else w.set(x, y + 1, z, taiga && r.chance(0.6) ? B.fern : B.short_grass, 0);
      }
      // flowers
      const nFl = { plains: 4, sunflower_plains: 4, flower_forest: 100, forest: 4, birch_forest: 4, meadow: 30, swamp: 1, cherry_grove: 30, dark_forest: 2, savanna: 2, mushroom_fields: 0, jungle: 4 }[bio];
      for (let k = 0; k < (nFl === undefined ? 1 : nFl); k++) {
        const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16);
        if (!w.inside(x, z)) continue;
        const y = this.topAt(w, x, z); if (y === null || w.get(x, y, z) !== B.grass_block || w.get(x, y + 1, z) !== 0) continue;
        w.set(x, y + 1, z, this.flower(r, bio, x, z), 0);
      }
      if (bio === 'sunflower_plains') for (let k = 0; k < 10; k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue; const y = this.topAt(w, x, z); if (y !== null && w.get(x, y, z) === B.grass_block && w.get(x, y + 1, z) === 0) { w.set(x, y + 1, z, B.sunflower, 0); w.set(x, y + 2, z, B.sunflower, 8); } }
      if (bio === 'flower_forest' || bio === 'forest' || bio === 'plains' || bio === 'meadow') for (let k = 0; k < (bio === 'flower_forest' ? 6 : 1); k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z) || !r.chance(0.3)) continue; const y = this.topAt(w, x, z); const tall = r.pick([B.lilac, B.rose_bush, B.peony]); if (y !== null && w.get(x, y, z) === B.grass_block && w.get(x, y + 1, z) === 0) { w.set(x, y + 1, z, tall, 0); w.set(x, y + 2, z, tall, 8); } }
      // desert and badlands: cactus and dead bushes
      if (bio === 'desert' || bio.includes('badlands')) {
        for (let k = 0; k < (bio === 'desert' ? 6 : 3); k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue; const y = this.topAt(w, x, z); if (y !== null && (w.get(x, y, z) === B.sand || w.get(x, y, z) === B.red_sand || w.get(x, y, z) === B.terracotta || G.BLOCKS[w.get(x, y, z)].name.endsWith('terracotta')) && w.get(x, y + 1, z) === 0) w.set(x, y + 1, z, B.dead_bush, 0); }
        for (let k = 0; k < (bio === 'desert' ? 4 : 2); k++) {
          const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z) || !r.chance(0.5)) continue;
          const y = this.topAt(w, x, z); if (y === null || (w.get(x, y, z) !== B.sand && w.get(x, y, z) !== B.red_sand)) continue;
          let ok = true; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.get(x + dx, y + 1, z + dz) !== 0) ok = false;
          if (!ok) continue; const hh = 1 + r.int(3); for (let i = 1; i <= hh; i++) w.set(x, y + i, z, B.cactus, 0);
        }
      }
      // sugar cane next to water, pumpkins, melons, berries, lily pads, mushrooms
      for (let k = 0; k < 20; k++) {
        const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue;
        const y = this.topAt(w, x, z); if (y === null) continue;
        const g = w.get(x, y, z); if (g !== B.grass_block && g !== B.sand && g !== B.dirt && g !== B.red_sand && g !== B.mud) continue;
        if (w.get(x, y + 1, z) !== 0) continue;
        let water = false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.get(x + dx, y, z + dz) === B.water) water = true;
        if (!water) continue; const hh = 2 + r.int(3); for (let i = 1; i <= hh; i++) w.set(x, y + i, z, B.sugar_cane, 0);
      }
      if (r.chance(bio.includes('jungle') ? 0.15 : 1 / 32)) this.patch(w, r, cx, cz, bio.includes('jungle') ? B.melon : B.pumpkin, 6, [B.grass_block]);
      if (bio.includes('taiga') || bio === 'grove') if (r.chance(0.12)) this.patch(w, r, cx, cz, B.sweet_berry_bush, 8, [B.grass_block, B.podzol], 3);
      if (bio === 'swamp' || bio === 'mangrove_swamp') for (let k = 0; k < 6; k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue; let y = MAXY; while (y > MINY && w.get(x, y, z) === 0) y--; if (w.get(x, y, z) === B.water && w.get(x, y + 1, z) === 0) w.set(x, y + 1, z, B.lily_pad, 0); }
      if (bio === 'mushroom_fields' || bio === 'dark_forest' || bio === 'swamp' || bio.includes('taiga') || r.chance(0.12)) for (let k = 0; k < 3; k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue; const y = this.topAt(w, x, z); if (y !== null && (w.get(x, y, z) === B.grass_block || w.get(x, y, z) === B.mycelium || w.get(x, y, z) === B.podzol) && w.get(x, y + 1, z) === 0 && r.chance(0.25)) w.set(x, y + 1, z, r.chance(0.5) ? B.brown_mushroom : B.red_mushroom, 0); }
      if (bio === 'bamboo_jungle' || (bio === 'jungle' && r.chance(0.3))) for (let k = 0; k < (bio === 'bamboo_jungle' ? 30 : 6); k++) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue; const y = this.topAt(w, x, z); if (y === null || (w.get(x, y, z) !== B.grass_block && w.get(x, y, z) !== B.podzol) || w.get(x, y + 1, z) !== 0) continue; const hh = 5 + r.int(9); for (let i = 1; i <= hh; i++) w.set(x, y + i, z, B.bamboo, i >= hh - 2 ? (i === hh ? 2 : 1) << 1 : 0); if (bio === 'bamboo_jungle') w.set(x, y, z, B.podzol, 0); }
      if (bio === 'old_growth_pine_taiga' || bio === 'old_growth_spruce_taiga') if (r.chance(0.3)) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); const y = surf(x, z) + 1; this.boulder(w, r, x, y, z); }
      if (bio === 'ice_spikes') for (let k = 0; k < 2; k++) if (r.chance(0.35)) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); this.iceSpike(w, r, x, surf(x, z), z); }
      // underwater plants
      if (BIOMES[cb.biome].ocean || bio === 'river') {
        const warm = bio.includes('warm') && !bio.includes('luke');
        for (let k = 0; k < (warm ? 12 : 40); k++) {
          const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue;
          let y = SEA; while (y > MINY && w.get(x, y, z) === B.water) y--;
          if (y >= SEA - 1 || !G.BLOCKS[w.get(x, y, z)].opaque) continue;
          if (r.chance(bio.includes('frozen') || bio === 'river' ? 0.95 : 0.6)) { w.set(x, y + 1, z, B.seagrass, 0); }
          else if (!warm) { const hh = 3 + r.int(Math.max(1, SEA - y - 4)); for (let i = 1; i <= hh && y + i < SEA; i++) w.set(x, y + i, z, i === hh || y + i === SEA - 1 ? B.kelp : B.kelp_plant, 0); }
        }
        if (warm) this.coralReef(w, r, cx, cz);
      }
      // lava lakes deep underground (and rarely at the surface)
      if (r.chance(1 / 9)) { const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16), y = -50 + r.int(90); this.lavaLake(w, r, x, y, z); }
      // dungeon (monster room) - roughly 8 attempts per chunk in vanilla, most fail
      for (let k = 0; k < 2; k++) { const x = cx * 16 + 2 + r.int(12), z = cz * 16 + 2 + r.int(12), y = -58 + r.int(110); this.dungeon(w, r, x, y, z); }
    }
    topAt(w, x, z) { let y = MAXY; while (y > MINY && (w.get(x, y, z) === 0)) y--; return y <= MINY ? null : y; }
    tree(w, r, x, y, z, b) {
      switch (b) {
        case 'forest': case 'flower_forest': { const bc = b === 'flower_forest' ? 0.02 : 0.002; if (r.chance(0.2)) F.oak(w, r, x, y, z, { log: B.birch_log, leaves: B.birch_leaves, base: 5, bees: true, beeChance: bc }); else if (r.chance(0.1)) F.fancyOak(w, r, x, y, z); else F.oak(w, r, x, y, z, { bees: true, beeChance: bc }); break; }
        case 'birch_forest': F.oak(w, r, x, y, z, { log: B.birch_log, leaves: B.birch_leaves, base: 5, bees: true, beeChance: 0.002 }); break;
        case 'old_growth_birch_forest': F.oak(w, r, x, y, z, { log: B.birch_log, leaves: B.birch_leaves, base: 5 + r.int(4), extra: 6 }); break;
        case 'dark_forest': if (r.chance(0.08)) F.hugeMushroom(w, r, x, y, z, r.chance(0.5)); else if (r.chance(0.12)) F.oak(w, r, x, y, z); else if (r.chance(0.05)) F.oak(w, r, x, y, z, { log: B.birch_log, leaves: B.birch_leaves, base: 5 }); else F.darkOak(w, r, x, y, z); break;
        case 'taiga': case 'snowy_taiga': case 'grove': if (r.chance(0.33)) F.pine(w, r, x, y, z); else F.spruce(w, r, x, y, z, { snow: b !== 'taiga' }); break;
        case 'old_growth_pine_taiga': if (r.chance(0.3)) F.megaSpruce(w, r, x, y, z, true); else if (r.chance(0.4)) F.pine(w, r, x, y, z); else F.spruce(w, r, x, y, z); break;
        case 'old_growth_spruce_taiga': if (r.chance(0.3)) F.megaSpruce(w, r, x, y, z, false); else if (r.chance(0.4)) F.pine(w, r, x, y, z); else F.spruce(w, r, x, y, z); break;
        case 'savanna': case 'savanna_plateau': case 'windswept_savanna': if (r.chance(0.8)) F.acacia(w, r, x, y, z); else F.oak(w, r, x, y, z); break;
        case 'windswept_forest': case 'windswept_hills': if (r.chance(0.66)) F.spruce(w, r, x, y, z); else F.oak(w, r, x, y, z); break;
        case 'jungle': case 'bamboo_jungle': if (r.chance(0.1)) F.megaJungle(w, r, x, y, z); else if (r.chance(0.5)) F.jungleBush(w, r, x, y, z); else if (r.chance(0.1)) F.fancyOak(w, r, x, y, z); else F.jungle(w, r, x, y, z); break;
        case 'sparse_jungle': if (r.chance(0.5)) F.jungleBush(w, r, x, y, z); else F.jungle(w, r, x, y, z); break;
        case 'wooded_badlands': F.oak(w, r, x, y, z); break;
        case 'meadow': if (r.chance(0.5)) F.oak(w, r, x, y, z, { log: B.birch_log, leaves: B.birch_leaves, base: 5, bees: true, beeChance: 0.002 }); else F.oak(w, r, x, y, z, { bees: true, beeChance: 1 }); break;
        case 'cherry_grove': F.cherry(w, r, x, y, z); break;
        case 'swamp': F.swampOak(w, r, x, y, z); break;
        case 'mangrove_swamp': F.mangrove(w, r, x, y, z); break;
        case 'mushroom_fields': F.hugeMushroom(w, r, x, y, z, r.chance(0.5)); break;
        case 'snowy_plains': F.spruce(w, r, x, y, z, { snow: true }); break;
        case 'plains': case 'sunflower_plains': F.oak(w, r, x, y, z, { bees: true }); break;
      }
    }
    flower(r, bio, x, z) {
      switch (bio) {
        case 'flower_forest': { const t = (this.nS.n2(x / 48, z / 48) + 1) / 2; const L = [B.dandelion, B.poppy, B.allium, B.azure_bluet, B.red_tulip, B.orange_tulip, B.white_tulip, B.pink_tulip, B.oxeye_daisy, B.cornflower, B.lily_of_the_valley]; return L[Math.min(L.length - 1, Math.floor(t * L.length))]; }
        case 'swamp': return B.blue_orchid;
        case 'meadow': return r.pick([B.dandelion, B.poppy, B.allium, B.azure_bluet, B.oxeye_daisy, B.cornflower, B.short_grass]);
        case 'cherry_grove': return B.pink_petals;
        case 'birch_forest': case 'forest': return r.pick([B.dandelion, B.poppy, B.lily_of_the_valley]);
        case 'plains': case 'sunflower_plains': return r.pick([B.dandelion, B.poppy, B.azure_bluet, B.oxeye_daisy, B.cornflower, B.red_tulip, B.orange_tulip, B.white_tulip, B.pink_tulip]);
        default: return r.chance(0.66) ? B.dandelion : B.poppy;
      }
    }
    patch(w, r, cx, cz, id, tries, on, state) {
      const x0 = cx * 16 + r.int(16), z0 = cz * 16 + r.int(16);
      for (let k = 0; k < tries; k++) {
        const x = x0 + r.int(7) - 3, z = z0 + r.int(7) - 3; if (!w.inside(x, z)) continue;
        const y = this.topAt(w, x, z); if (y === null || !on.includes(w.get(x, y, z)) || w.get(x, y + 1, z) !== 0) continue;
        w.set(x, y + 1, z, id, state || 0);
      }
    }
    boulder(w, r, x, y, z) {
      for (let k = 0; k < 3; k++) {
        const rad = 1 + r.int(2) * 0.5 + 0.5, bx = x + r.int(3) - 1, bz = z + r.int(3) - 1, by = y - r.int(2);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (dx * dx + dy * dy + dz * dz <= rad * rad) w.set(bx + dx, by + dy, bz + dz, B.mossy_cobblestone, 0);
      }
    }
    iceSpike(w, r, x, y, z) {
      const big = r.chance(1 / 60), h = big ? 30 + r.int(20) : 7 + r.int(10), base = big ? 3 : 1 + r.int(2);
      for (let i = -3; i < h; i++) {
        const rad = Math.max(0, base * (1 - Math.max(0, i) / h) + (i < 0 ? 0.5 : 0));
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (dx * dx + dz * dz <= rad * rad + 0.3) w.set(x + dx, y + i, z + dz, B.packed_ice, 0);
      }
    }
    lavaLake(w, r, x, y, z) {
      if (!w.inside(x, z) && !w.inside(x + 8, z + 8) && !w.inside(x - 8, z - 8)) return;
      const blobs = 4 + r.int(4), shape = [];
      for (let k = 0; k < blobs; k++) shape.push([r.next() * 6 - 3, r.next() * 2, r.next() * 6 - 3, 2 + r.next() * 2]);
      const inLake = (dx, dy, dz) => { for (const [bx, by, bz, rr] of shape) { const a = (dx - bx) / rr, b = (dy - by) / (rr * 0.6), c = (dz - bz) / rr; if (a * a + b * b + c * c < 1) return true; } return false; };
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -2; dy <= 3; dy++) {
        if (!inLake(dx, dy, dz)) continue;
        const bx = x + dx, by = y + dy, bz = z + dz; if (!w.inside(bx, bz)) continue;
        const cur = w.get(bx, by, bz);
        if (cur === B.water || cur === B.bedrock) continue;
        w.set(bx, by, bz, dy <= 0 ? B.lava : 0, 0);
      }
    }
    // a 7x5 (or 9x7) cobblestone room with a spawner and up to two chests
    dungeon(w, r, x, y, z) {
      const rx = 2 + r.int(2), rz = 2 + r.int(2);
      const solid = (bx, by, bz) => { const b = w.get(bx, by, bz); return b !== 0 && b !== B.cave_air && b !== B.water && b !== B.lava; };
      if (!w.inside(x, z)) return;
      let openings = 0;
      for (let dx = -rx - 1; dx <= rx + 1; dx++) for (let dz = -rz - 1; dz <= rz + 1; dz++) {
        if (!w.inside(x + dx, z + dz)) return; // keep the whole room inside one chunk so the check is exact
        if (!solid(x + dx, y - 1, z + dz) || !solid(x + dx, y + 4, z + dz)) return;
        if ((Math.abs(dx) === rx + 1 || Math.abs(dz) === rz + 1) && !solid(x + dx, y, z + dz) && !solid(x + dx, y + 1, z + dz)) openings++;
      }
      if (openings < 1 || openings > 5) return;
      for (let dx = -rx - 1; dx <= rx + 1; dx++) for (let dz = -rz - 1; dz <= rz + 1; dz++) for (let dy = -1; dy <= 4; dy++) {
        const bx = x + dx, by = y + dy, bz = z + dz, wall = Math.abs(dx) === rx + 1 || Math.abs(dz) === rz + 1;
        if (dy === -1) { w.set(bx, by, bz, r.chance(0.75) ? B.mossy_cobblestone : B.cobblestone, 0); continue; }
        if (dy === 4) { if (solid(bx, by, bz)) w.set(bx, by, bz, B.cobblestone, 0); continue; }
        if (wall) { if (solid(bx, by, bz) && solid(bx, by - 1, bz)) w.set(bx, by, bz, B.cobblestone, 0); }
        else w.set(bx, by, bz, 0, 0);
      }
      let chests = 0;
      for (let k = 0; k < 6 && chests < 2; k++) {
        const bx = x + r.int(rx * 2 + 1) - rx, bz = z + r.int(rz * 2 + 1) - rz;
        let walls = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(bx + dx, y, bz + dz)) walls++;
        if (walls !== 1 || w.get(bx, y, bz) !== 0) continue;
        w.set(bx, y, bz, B.chest, 2); w.blockEntity(bx, y, bz, { type: 'container', items: new Array(27).fill(null), loot: 'chests/simple_dungeon', seed: r.int(2147483647) }); chests++;
      }
      w.set(x, y, z, B.spawner, 0);
      w.blockEntity(x, y, z, { type: 'spawner', mob: r.pick(['skeleton', 'zombie', 'zombie', 'spider']) });
    }
    coralReef(w, r, cx, cz) {
      const corals = ['tube', 'brain', 'bubble', 'fire', 'horn'];
      for (let k = 0; k < 20; k++) {
        const x = cx * 16 + r.int(16), z = cz * 16 + r.int(16); if (!w.inside(x, z)) continue;
        let y = SEA; while (y > MINY && w.get(x, y, z) === B.water) y--;
        if (y >= SEA - 2) continue;
        const c = r.pick(corals);
        if (r.chance(0.3)) { const hh = 1 + r.int(3); for (let i = 1; i <= hh && y + i < SEA - 1; i++) w.set(x, y + i, z, B[c + '_coral_block'], 0); w.set(x, y + hh + 1, z, B[c + (r.chance(0.5) ? '_coral' : '_coral_fan')], 0); }
        else if (r.chance(0.5)) w.set(x, y + 1, z, B[c + (r.chance(0.5) ? '_coral' : '_coral_fan')], 0);
        else if (r.chance(0.3)) w.set(x, y + 1, z, B.sea_pickle, r.int(4) | 128);
        else w.set(x, y + 1, z, B.seagrass, 0);
      }
    }
    // the classic superflat preset: bedrock, two layers of dirt and grass on top, all plains
    generateFlat(cx, cz) {
      const out = { cx, cz, blocks: new Uint16Array(65536), states: new Uint8Array(65536), biomes: new Uint8Array(256).fill(BIOME.plains), heights: new Int16Array(256).fill(-61), be: [], ents: [], ticks: [] };
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { out.blocks[I(x, -64, z)] = B.bedrock; out.blocks[I(x, -63, z)] = B.dirt; out.blocks[I(x, -62, z)] = B.dirt; out.blocks[I(x, -61, z)] = B.grass_block; }
      if (this.structures && G.Structures) G.Structures.place(this, new ChunkWriter(out, cx, cz), cx, cz, true);
      return out;
    }
    // the highest block a mob can stand on (for spawn points)
    spawnPoint() {
      if (this.flat) return [0.5, -60, 0.5];
      for (let k = 0; k < 400; k++) {
        const r = new Rand(hashInt(this.seed, k, 9, 9)), x = Math.floor((r.next() - 0.5) * 64 * (1 + k / 20)), z = Math.floor((r.next() - 0.5) * 64 * (1 + k / 20));
        const c = this.column(x, z, {}); const b = BIOMES[c.biome];
        if (c.h >= SEA && !b.ocean && b.name !== 'river' && c.h < 120) return [x + 0.5, c.h + 1, z + 0.5];
      }
      return [0.5, 100, 0.5];
    }
  }

  // ---------------------------------------------------------------- the Nether (Y 0..127) and the End (islands in the void)
  class Nether {
    constructor(seed) {
      this.seed = seed; const h = k => hashInt(seed, k, 77, 11);
      this.d = new Octaves(h(1), 4, 0.5); this.d2 = new Octaves(h(2), 3, 0.5); this.bt = new Octaves(h(3), 3, 0.5); this.bh = new Octaves(h(4), 3, 0.5); this.pat = new Octaves(h(5), 3, 0.5);
    }
    biomeAt(x, z) {
      const t = this.bt.n2(x / 220, z / 220) * 1.6, hm = this.bh.n2(x / 220, z / 220) * 1.6;
      if (t > 0.35 && hm < 0) return BIOME.basalt_deltas;
      if (hm > 0.35) return t > 0 ? BIOME.warped_forest : BIOME.crimson_forest;
      if (hm < -0.4) return BIOME.soul_sand_valley;
      if (t < -0.45 && hm > 0) return BIOME.crimson_forest;
      return BIOME.nether_wastes;
    }
    column(x, z, o) { o = o || {}; o.biome = this.biomeAt(x, z); o.h = 64; return o; }
    generate(cx, cz) {
      const out = { cx, cz, blocks: new Uint16Array(65536), states: new Uint8Array(65536), biomes: new Uint8Array(256), heights: new Int16Array(256), be: [], ents: [], ticks: [] };
      const blocks = out.blocks, x0 = cx * 16, z0 = cz * 16, r = new Rand(hashInt(this.seed, cx, cz, 404));
      // density on a 4x8x4 grid: open caverns between a floor and a ceiling, lava sea at Y 31
      const NX = 5, NY = 17, den = new Float32Array(NX * NX * NY);
      for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NX; iz++) for (let iy = 0; iy < NY; iy++) {
        const x = x0 + ix * 4, z = z0 + iz * 4, y = iy * 8;
        let d = this.d.n3(x / 80, y / 60, z / 80) * 1.4 + this.d2.n3(x / 30, y / 20, z / 30) * 0.5;
        d += Math.max(0, (8 - y) / 8) * 2 + Math.max(0, (y - 112) / 10) * 2.2; // closed at the floor and the roof
        d += (Math.abs(y - 60) / 60) * 0.35 - 0.12;
        den[(ix * NX + iz) * NY + iy] = d;
      }
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const biome = this.biomeAt(x0 + x, z0 + z); out.biomes[x + z * 16] = biome; out.heights[x + z * 16] = 127;
        const fx = x / 4, fz = z / 4, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
        for (let y = 0; y < 128; y++) {
          const i = I(x, y, z);
          if (y === 0 || y === 127 || (y < 5 && r.next() < (5 - y) / 5) || (y > 122 && r.next() < (y - 122) / 5)) { blocks[i] = B.bedrock; continue; }
          const fy = y / 8, iy = Math.floor(fy), ty = fy - iy;
          const g = (a, b, c) => den[(a * NX + b) * NY + c];
          const lo = g(ix, iz, iy) * (1 - tx) * (1 - tz) + g(ix + 1, iz, iy) * tx * (1 - tz) + g(ix, iz + 1, iy) * (1 - tx) * tz + g(ix + 1, iz + 1, iy) * tx * tz;
          const hi = g(ix, iz, iy + 1) * (1 - tx) * (1 - tz) + g(ix + 1, iz, iy + 1) * tx * (1 - tz) + g(ix, iz + 1, iy + 1) * (1 - tx) * tz + g(ix + 1, iz + 1, iy + 1) * tx * tz;
          const d = lo + (hi - lo) * ty;
          blocks[i] = d > 0 ? B.netherrack : (y <= 31 ? B.lava : 0);
        }
        this.surface(out, x, z, biome, r);
      }
      const w = new ChunkWriter(out, cx, cz);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.decorate(w, cx + dx, cz + dz);
      if (G.Structures) G.Structures.placeNether(this, w, cx, cz);
      return out;
    }
    surface(out, x, z, biome, r) {
      const blocks = out.blocks, name = BIOMES[biome].name, wx = out.cx * 16 + x, wz = out.cz * 16 + z;
      const p = this.pat.n2(wx / 10, wz / 10);
      for (let y = 126; y > 1; y--) {
        const i = I(x, y, z); if (blocks[i] !== B.netherrack) continue;
        const above = blocks[I(x, y + 1, z)];
        if (above !== 0 && above !== B.lava) continue;
        // a floor: the top layers depend on the biome
        if (name === 'soul_sand_valley') { for (let d = 0; d < 3; d++) if (blocks[I(x, y - d, z)] === B.netherrack) blocks[I(x, y - d, z)] = p > 0 ? B.soul_sand : B.soul_soil; }
        else if (name === 'crimson_forest' && above === 0 && y > 31) blocks[i] = B.crimson_nylium;
        else if (name === 'warped_forest' && above === 0 && y > 31) blocks[i] = B.warped_nylium;
        else if (name === 'basalt_deltas') { blocks[i] = p > 0.1 ? B.basalt : B.blackstone; if (r.chance(0.05) && y > 31) blocks[I(x, y + 1, z)] = B.magma_block; }
        else if (name === 'nether_wastes' && y >= 30 && y <= 35 && p > 0.3) blocks[i] = r.chance(0.5) ? B.soul_sand : B.gravel;
      }
      if (name === 'basalt_deltas') for (let y = 2; y < 126; y++) { const i = I(x, y, z); if (blocks[i] === B.netherrack) blocks[i] = (y + ((wx * 3 + wz * 5) & 3)) % 9 < 5 ? B.basalt : B.blackstone; }
    }
    decorate(w, cx, cz) {
      const r = new Rand(hashInt(this.seed, cx, cz, 505)), x0 = cx * 16, z0 = cz * 16;
      const biome = BIOMES[this.biomeAt(x0 + 8, z0 + 8)].name;
      // ores: quartz, nether gold, ancient debris; glowstone clusters on the roof; magma near the lava sea
      const blob = (id, count, size, y0, y1, onlyIn) => {
        for (let k = 0; k < count; k++) {
          const x = x0 + r.int(16), z = z0 + r.int(16), y = y0 + r.int(y1 - y0 + 1);
          for (let j = 0; j < size; j++) { const bx = x + r.int(3) - 1, by = y + r.int(3) - 1, bz = z + r.int(3) - 1; if (w.inside(bx, bz) && (w.get(bx, by, bz) === (onlyIn || B.netherrack))) w.set(bx, by, bz, id, 0); }
        }
      };
      blob(B.nether_quartz_ore, 16, 10, 10, 117); blob(B.nether_gold_ore, 10, 8, 10, 117); blob(B.magma_block, 4, 20, 26, 36);
      blob(B.gravel, 2, 20, 5, 41); blob(B.blackstone, 2, 20, 5, 31);
      if (r.chance(1)) { const x = x0 + r.int(16), z = z0 + r.int(16), y = 8 + r.int(16); if (w.inside(x, z) && w.get(x, y, z) === B.netherrack) w.set(x, y, z, B.ancient_debris, 0); }
      if (r.chance(0.5)) { const x = x0 + r.int(16), z = z0 + r.int(16), y = 8 + r.int(112); if (w.inside(x, z) && w.get(x, y, z) === B.netherrack) w.set(x, y, z, B.ancient_debris, 0); }
      for (let k = 0; k < 10; k++) { // glowstone hangs from ceilings
        const x = x0 + r.int(16), z = z0 + r.int(16); let y = 120; if (!w.inside(x, z)) continue;
        while (y > 4 && w.get(x, y, z) !== 0) y--; while (y > 4 && w.get(x, y, z) === 0) y--;
        // y is now a floor; look for a ceiling above an air gap instead
        let cy = 4 + r.int(116); while (cy < 126 && w.get(x, cy, z) === 0) cy++;
        if (w.get(x, cy, z) !== B.netherrack || w.get(x, cy - 1, z) !== 0) continue;
        for (let j = 0; j < 60; j++) { const bx = x + r.int(5) - 2, by = cy - 1 - r.int(5), bz = z + r.int(5) - 2; if (!w.inside(bx, bz) || w.get(bx, by, bz) !== 0) continue; let n = 0; for (let f = 0; f < 6; f++) if (w.get(bx + G.DX[f], by + G.DY[f], bz + G.DZ[f]) === B.glowstone || w.get(bx + G.DX[f], by + G.DY[f], bz + G.DZ[f]) === B.netherrack) n++; if (n >= 1) w.set(bx, by, bz, B.glowstone, 0); }
      }
      // fire patches and plants on the floors
      for (let k = 0; k < 64; k++) {
        const x = x0 + r.int(16), z = z0 + r.int(16), y = 32 + r.int(90); if (!w.inside(x, z)) continue;
        const g = w.get(x, y, z); if (w.get(x, y + 1, z) !== 0) continue;
        if (biome === 'crimson_forest' && g === B.crimson_nylium) { const k2 = r.next(); w.set(x, y + 1, z, k2 < 0.06 ? 0 : k2 < 0.6 ? B.crimson_roots : k2 < 0.9 ? B.crimson_fungus : B.warped_fungus, 0); if (k2 < 0.06) this.fungus(w, r, x, y + 1, z, true); }
        else if (biome === 'warped_forest' && g === B.warped_nylium) { const k2 = r.next(); w.set(x, y + 1, z, k2 < 0.06 ? 0 : k2 < 0.5 ? B.warped_roots : k2 < 0.7 ? B.nether_sprouts : k2 < 0.95 ? B.warped_fungus : B.crimson_fungus, 0); if (k2 < 0.06) this.fungus(w, r, x, y + 1, z, false); }
        else if (biome === 'nether_wastes' && g === B.netherrack && r.chance(0.05)) w.set(x, y + 1, z, B.fire, 0);
        else if (biome === 'soul_sand_valley' && (g === B.soul_sand || g === B.soul_soil) && r.chance(0.05)) w.set(x, y + 1, z, g === B.soul_soil ? B.soul_fire : B.soul_fire, 0);
        else if ((biome === 'nether_wastes') && g === B.netherrack && r.chance(0.02)) w.set(x, y + 1, z, r.chance(0.5) ? B.brown_mushroom : B.red_mushroom, 0);
      }
      if (biome === 'soul_sand_valley' && r.chance(0.25)) { // bone block fossils
        const x = x0 + r.int(16), z = z0 + r.int(16); let y = 40 + r.int(40); while (y > 32 && w.get(x, y, z) === 0) y--;
        for (let i = 0; i < 5 + r.int(4); i++) w.set(x, y + i, z, B.bone_block, 0); for (let i = -2; i <= 2; i++) w.set(x + i, y + 4, z, B.bone_block, 1);
      }
      // lava springs in the walls
      for (let k = 0; k < 8; k++) { const x = x0 + r.int(16), z = z0 + r.int(16), y = 4 + r.int(116); if (!w.inside(x, z)) continue; if (w.get(x, y, z) === B.netherrack && w.get(x, y + 1, z) === B.netherrack) { let open = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.get(x + dx, y, z + dz) === 0) open++; if (open === 1) { w.set(x, y, z, B.lava, 0); w.o.ticks.push([x, y, z]); } } }
    }
    // huge crimson and warped fungi
    fungus(w, r, x, y, z, crimson) {
      const h = 4 + r.int(9), stem = crimson ? B.crimson_stem : B.warped_stem, wart = crimson ? B.nether_wart_block : B.warped_wart_block;
      for (let i = 0; i < h; i++) w.set(x, y + i, z, stem, 0);
      for (let dy = h - 3; dy <= h; dy++) { const rad = dy === h ? 1 : 2; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { if (w.get(x + dx, y + dy, z + dz) !== 0) continue; w.set(x + dx, y + dy, z + dz, r.chance(0.08) ? B.shroomlight : wart, 0); } }
      if (crimson) for (let k = 0; k < 6; k++) { const vx = x + r.int(5) - 2, vz = z + r.int(5) - 2; let vy = y + h - 4; if (w.get(vx, vy + 1, vz) === wart) for (let i = 0; i < 1 + r.int(4) && w.get(vx, vy - i, vz) === 0; i++) w.set(vx, vy - i, vz, B.weeping_vines_plant, 0); }
    }
  }

  class End {
    constructor(seed) { this.seed = seed; this.n = new Octaves(hashInt(seed, 1, 99, 3), 4, 0.5); this.isl = new Octaves(hashInt(seed, 2, 99, 3), 3, 0.5); }
    // island height field: the main island of radius ~100 around (0,0) and outer islands beyond 1000 blocks
    density(x, z) {
      const d = Math.sqrt(x * x + z * z);
      let v = 100 - d * 1.0 + this.n.n2(x / 40, z / 40) * 30;
      if (d > 900) { const o = this.isl.n2(x / 120, z / 120) * 160 - 30 + this.n.n2(x / 30, z / 30) * 25; v = Math.max(v, o); }
      return v;
    }
    biomeAt(x, z) { const d = Math.sqrt(x * x + z * z); if (d < 1000) return BIOME.the_end; const v = this.density(x, z); return v > 40 ? BIOME.end_highlands : v > 0 ? BIOME.end_midlands : v > -20 ? BIOME.end_barrens : BIOME.small_end_islands; }
    column(x, z, o) { o = o || {}; o.biome = this.biomeAt(x, z); o.h = 60; return o; }
    generate(cx, cz) {
      const out = { cx, cz, blocks: new Uint16Array(65536), states: new Uint8Array(65536), biomes: new Uint8Array(256), heights: new Int16Array(256), be: [], ents: [], ticks: [] };
      const blocks = out.blocks, x0 = cx * 16, z0 = cz * 16;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const wx = x0 + x, wz = z0 + z, v = this.density(wx, wz);
        out.biomes[x + z * 16] = this.biomeAt(wx, wz);
        if (v <= 0) continue;
        const top = 56 + Math.min(14, Math.floor(v / 8)), bot = top - Math.min(40, Math.floor(Math.sqrt(v) * 4));
        for (let y = bot; y <= top; y++) blocks[I(x, y, z)] = B.end_stone;
        out.heights[x + z * 16] = top;
      }
      const w = new ChunkWriter(out, cx, cz);
      // the ten obsidian spikes around the main island (the game's SpikeFeature)
      for (const sp of this.spikes()) {
        if (sp.x + sp.r < x0 || sp.x - sp.r > x0 + 15 || sp.z + sp.r < z0 || sp.z - sp.r > z0 + 15) continue;
        for (let x = sp.x - sp.r; x <= sp.x + sp.r; x++) for (let z = sp.z - sp.r; z <= sp.z + sp.r; z++) {
          if (!w.inside(x, z)) continue;
          const d2 = (x - sp.x) ** 2 + (z - sp.z) ** 2;
          for (let y = 0; y <= sp.h + 10; y++) { if (d2 <= sp.r * sp.r + 1 && y < sp.h) w.set(x, y, z, B.obsidian, 0); else if (y > 65) w.set(x, y, z, 0, 0); }
        }
        if (sp.guarded) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 3; dy++) {
          if (Math.abs(dx) === 2 || Math.abs(dz) === 2 || dy === 3) w.set(sp.x + dx, sp.h + dy, sp.z + dz, B.iron_bars, 0);
        }
        w.set(sp.x, sp.h, sp.z, B.bedrock, 0); w.set(sp.x, sp.h + 1, sp.z, B.fire, 0);
      }
      if (G.Structures) G.Structures.placeEnd(this, w, cx, cz);
      // chorus plants on the outer islands
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ccx = cx + dx, ccz = cz + dz, r = new Rand(hashInt(this.seed, ccx, ccz, 606));
        if (Math.abs(ccx) < 64 && Math.abs(ccz) < 64) continue;
        for (let k = 0; k < 3; k++) {
          const x = ccx * 16 + r.int(16), z = ccz * 16 + r.int(16), v = this.density(x, z); if (v < 30) continue;
          const y = 56 + Math.min(14, Math.floor(v / 8)) + 1;
          this.chorus(w, r, x, y, z, 0);
        }
      }
      return out;
    }
    // spike i stands at angle i * 36 degrees, 42 blocks out; its size comes from a shuffled index
    spikes() {
      if (this._spikes) return this._spikes;
      const idx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], r = new Rand(hashInt(this.seed, 5, 5, 31));
      for (let i = idx.length - 1; i > 0; i--) { const j = r.int(i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      const out = [];
      for (let i = 0; i < 10; i++) {
        const a = 2 * (-Math.PI + Math.PI / 10 * i), l = idx[i];
        out.push({ x: Math.floor(42 * Math.cos(a)), z: Math.floor(42 * Math.sin(a)), r: 2 + Math.floor(l / 3), h: 76 + l * 3, guarded: l === 1 || l === 2 });
      }
      return (this._spikes = out);
    }
    chorus(w, r, x, y, z, depth) {
      const h = 1 + r.int(depth ? 3 : 4);
      for (let i = 0; i < h; i++) w.set(x, y + i, z, B.chorus_plant, 0);
      if (depth < 4) for (let k = 0; k < (depth ? 1 + r.int(2) : 2 + r.int(2)); k++) {
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][r.int(4)]; const bx = x + d[0], bz = z + d[1], by = y + h - 1 - r.int(2);
        if (w.get(bx, by, bz) !== 0) continue; w.set(bx, by, bz, B.chorus_plant, 0); this.chorus(w, r, bx, by + 1, bz, depth + 1);
      }
      else w.set(x, y + h, z, B.chorus_flower, 5);
    }
  }
  Object.assign(G, { Overworld, Nether, End, ChunkWriter, MINY, MAXY, SEA, CHUNK_INDEX: I });
});
