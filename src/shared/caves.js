'use strict';
/* Underground biomes and features (Java Edition 1.21 rules, generated per chunk in the worker):
   - cave biomes, from the same climate as the surface: the deep dark under low, worn-down high ground, 140 or
     more blocks below the surface; lush caves where it is very humid and dripstone caves far inland, both
     25 to 115 blocks down
   - lush caves: moss floors with grass, azalea bushes and moss carpets; mossy ceilings with cave vines (some
     with glow berries) and spore blossoms; clay pools with big and small dripleaf; azalea trees above them
     with rooted dirt and hanging roots
   - dripstone caves: dripstone block patches, stalactites and stalagmites, and the odd great column
   - the deep dark: sculk over the floors, sculk veins creeping up walls, sensors, shriekers that can summon
     the warden, and catalysts
   - everywhere: glow lichen on cave walls, amethyst geodes (one chunk in 24, smooth basalt, calcite and
     amethyst with budding amethyst growing buds) and fossils (one chunk in 64, bone blocks with coal ore near
     the surface or diamond ore deep down) */
SHARED.push(function cavesModule(G) {
  const { Rand, hashInt, BID: B, BIOME, BLOCKS } = G;
  const MINY = -64;
  // which cave biome (if any) is at height y in a column with this climate
  function biomeAt(col, y) {
    if (col.E < -0.375 && col.C > -0.11 && y <= col.h - 140) return 'deep_dark';
    const d = col.h - y; if (d < 25 || d > 115) return null;
    if (col.Hm > 0.7 && col.C > -0.19) return 'lush_caves';
    if (col.C > 0.8) return 'dripstone_caves';
    return null;
  }
  // per-column cave biome ranges for the page (tints, spawning, F3): [deep dark top y, upper cave biome id or -1, surface height]
  const NONE = -32768;
  function encode(cols) {
    const o = new Int16Array(768);
    for (let i = 0; i < 256; i++) {
      const c = cols[i];
      o[i] = c.E < -0.375 && c.C > -0.11 ? c.h - 140 : NONE;
      o[256 + i] = c.Hm > 0.7 && c.C > -0.19 ? BIOME.lush_caves : c.C > 0.8 ? BIOME.dripstone_caves : -1;
      o[512 + i] = c.h;
    }
    return o;
  }
  // the cave biome id at height y in column i of an encoded chunk (or -1)
  function at(o, i, y) {
    if (y <= o[i]) return BIOME.deep_dark;
    const u = o[256 + i]; if (u < 0) return -1;
    const d = o[512 + i] - y; return d >= 25 && d <= 115 ? u : -1;
  }
  const STONY = new Set([B.stone, B.deepslate, B.tuff, B.granite, B.diorite, B.andesite, B.dirt, B.gravel, B.calcite, B.smooth_basalt]);
  const FB = [32, 16, 1, 2, 4, 8];
  const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];
  const air = id => id === 0 || id === B.cave_air;
  const solid = id => !air(id) && id !== B.water && id !== B.lava && BLOCKS[id] && BLOCKS[id].opaque;
  // multiface (glow lichen, sculk vein) faces for whatever solid blocks surround (x, y, z)
  function faces(w, x, y, z, ok) { let m = 0; for (let d = 0; d < 6; d++) { const id = w.get(x + DX[d], y + DY[d], z + DZ[d]); if (solid(id) && (!ok || ok(id))) m |= FB[d]; } return m; }
  // ---------------------------------------------------------------- decorating a chunk's caves
  function decorate(gen, w, cx, cz, cols, out) {
    const r = new Rand(hashInt(gen.seed, cx, cz, 404)), x0 = cx * 16, z0 = cz * 16;
    const noise = (x, y, z, s) => gen.cave.n3(x / s, y / s, z / s);
    let lushHere = 0;
    // clay patches go down before the moss and plants (the game's feature order)
    for (let t = 0; t < 10; t++) {
      const lx = r.int(16), lz = r.int(16), col = cols[lx + lz * 16];
      if (!(col.Hm > 0.7 && col.C > -0.19)) continue;
      const x = x0 + lx, z = z0 + lz, lo = Math.max(MINY + 6, col.h - 115), hi = Math.min(col.h - 25, 60), floors = [];
      for (let y = lo; y <= hi; y++) if (air(w.get(x, y, z)) && STONY.has(w.get(x, y - 1, z))) floors.push(y);
      if (floors.length) { const y = floors[r.int(floors.length)]; if (biomeAt(col, y) === 'lush_caves') clayPatch(w, r, x, y, z, r.chance(0.5)); }
    }
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const col = cols[lx + lz * 16], x = x0 + lx, z = z0 + lz;
      const deep = col.E < -0.375 && col.C > -0.11 && col.h - 140 > MINY + 6;
      const upper = col.Hm > 0.7 && col.C > -0.19 ? 'lush_caves' : col.C > 0.8 ? 'dripstone_caves' : null;
      const yTop = Math.min(col.h - 12, 60);
      for (let y = MINY + 6; y <= yTop; y++) {
        const id = w.get(x, y, z); if (!air(id)) continue;
        const bio = deep && y <= col.h - 140 ? 'deep_dark' : upper && col.h - y >= 25 && col.h - y <= 115 ? upper : null;
        const below = w.get(x, y - 1, z), above = w.get(x, y + 1, z);
        if (bio === 'deep_dark') deepDark(w, r, x, y, z, below, above, noise, out);
        else if (bio === 'lush_caves') { lush(w, r, x, y, z, below, above, noise); lushHere++; }
        else if (bio === 'dripstone_caves') dripstone(w, r, x, y, z, below, above, noise);
        else if (r.next() < 0.012 && col.h - y > 10) { const m = faces(w, x, y, z); if (m) w.set(x, y, z, B.glow_lichen, m); }
      }
    }
    // an azalea tree on the surface over lush caves, its roots reaching down
    if (lushHere > 200 && r.chance(0.6)) azaleaOverCave(gen, w, r, x0 + 4 + r.int(8), z0 + 4 + r.int(8), cols);
    // geodes and fossils of this chunk and its neighbours (clipped to this chunk)
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const rr = new Rand(hashInt(gen.seed, cx + dx, cz + dz, 505));
      if (rr.next() < 1 / 24) geode(w, rr, (cx + dx) * 16 + rr.int(16), -58 + rr.int(89), (cz + dz) * 16 + rr.int(16));
      if (rr.next() < 1 / 64) { const deepF = rr.next() < 0.5; fossil(w, rr, (cx + dx) * 16 + rr.int(16), deepF ? -60 + rr.int(52) : 20 + rr.int(30), (cz + dz) * 16 + rr.int(16), deepF); }
    }
  }
  // ---------------------------------------------------------------- the deep dark
  function deepDark(w, r, x, y, z, below, above, noise, out) {
    const patch = noise(x, y, z, 7) > -0.25;
    if (STONY.has(below) && patch) {
      w.set(x, y - 1, z, B.sculk, 0);
      const k = r.next();
      if (k < 0.012) { w.set(x, y, z, B.sculk_sensor, 0); out.be.push({ x, y, z, type: 'sensor', power: 0, freq: 0 }); return; }
      if (k < 0.016) { w.set(x, y, z, B.sculk_shrieker, 2); out.be.push({ x, y, z, type: 'shrieker', warning: 0 }); return; }
      if (k < 0.0175) { w.set(x, y - 1, z, B.sculk_catalyst, 0); out.be.push({ x, y: y - 1, z, type: 'catalyst', cursors: [] }); return; }
    }
    if (STONY.has(above) && noise(x, y, z, 9) > 0.15) w.set(x, y + 1, z, B.sculk, 0);
    // veins creep over the stone around the sculk
    if (r.next() < 0.3) {
      const m = faces(w, x, y, z, id => id !== B.sculk && id !== B.sculk_catalyst);
      if (m) { let near = false; for (let d = 0; d < 6 && !near; d++) { const n = w.get(x + DX[d], y + DY[d], z + DZ[d]); if (n === B.sculk) near = true; } if (near) w.set(x, y, z, B.sculk_vein, m); }
    }
  }
  // ---------------------------------------------------------------- lush caves
  function lush(w, r, x, y, z, below, above, noise) {
    if (STONY.has(below) || below === B.moss_block) {
      if (noise(x, y, z, 5) > -0.35 && below !== B.moss_block) w.set(x, y - 1, z, B.moss_block, 0);
      if (w.get(x, y - 1, z) === B.moss_block) {
        const k = r.next();
        if (k < 0.25) w.set(x, y, z, B.moss_carpet, 0);
        else if (k < 0.37) w.set(x, y, z, B.short_grass, 0);
        else if (k < 0.42 && air(w.get(x, y + 1, z))) { w.set(x, y, z, B.tall_grass, 0); w.set(x, y + 1, z, B.tall_grass, 8); }
        else if (k < 0.45) w.set(x, y, z, B.azalea, 0);
        else if (k < 0.47) w.set(x, y, z, B.flowering_azalea, 0);
      }
      return;
    }
    if (STONY.has(above)) {
      if (noise(x, y + 7, z, 6) > 0.0) w.set(x, y + 1, z, B.moss_block, 0);
      const k = r.next();
      if (k < 0.012) { w.set(x, y, z, B.spore_blossom, 0); return; }
      if (k < 0.11) {
        // cave vines: body down to a tip; one segment in nine carries glow berries
        const len = 1 + r.int(6); let n = 0;
        while (n < len && air(w.get(x, y - n, z))) n++;
        for (let i = 0; i < n; i++) w.set(x, y - i, z, i === n - 1 ? B.cave_vines : B.cave_vines_plant, r.chance(0.11) ? 8 : 0);
        return;
      }
    }
    if (r.next() < 0.03) { const m = faces(w, x, y, z); if (m) w.set(x, y, z, B.glow_lichen, m); }
  }
  // clay patches (the game's lush_caves_clay: half are pools): a square of 2-4 radius per side, corners cut and edges ragged,
  // clay three or four deep; the ground in the middle, walled in on all four sides, becomes water with dripleaf in it
  const SOIL = id => STONY.has(id) || id === B.moss_block || id === B.clay;
  function clayPatch(w, r, x, y, z, pool) {
    const rx = 2 + r.int(3) + 1, rz = 2 + r.int(3) + 1, ground = [];
    for (let i = -rx; i <= rx; i++) for (let j = -rz; j <= rz; j++) {
      const ex = i === -rx || i === rx, ez = j === -rz || j === rz;
      if (ex && ez) continue; if ((ex || ez) && r.next() > 0.7) continue;
      const bx = x + i, bz = z + j; if (!w.inside(bx, bz)) continue;
      // find the floor within five blocks of the centre's height
      let fy = null; for (let k = 2; k >= -3; k--) { const yy = y + k; if (air(w.get(bx, yy, bz)) && SOIL(w.get(bx, yy - 1, bz))) { fy = yy - 1; break; } }
      if (fy === null) continue;
      const depth = 3 + (r.chance(0.8) ? 1 : 0);
      for (let d = 0; d < depth; d++) { if (!SOIL(w.get(bx, fy - d, bz))) break; w.set(bx, fy - d, bz, B.clay, 0); }
      ground.push([bx, fy, bz]);
    }
    const wet = [];
    if (pool) for (const [bx, fy, bz] of ground) {
      let ok = solid(w.get(bx, fy - 1, bz));
      for (let d = 2; d < 6 && ok; d++) { const n = w.get(bx + DX[d], fy, bz + DZ[d]); if (!solid(n) && n !== B.water) ok = false; }
      if (ok) wet.push([bx, fy, bz]);
    }
    for (const [bx, fy, bz] of wet) w.set(bx, fy, bz, B.water, 0);
    // dripleaf: one cell in ten in pools (from the water), one in twenty on dry clay
    const cells = pool ? wet : ground, chance = pool ? 0.1 : 0.05;
    for (const [bx, fy, bz] of cells) {
      if (!r.chance(chance) || !air(w.get(bx, fy + 1, bz))) continue;
      if (r.chance(0.5)) {
        const h = 1 + r.int(4), f = 2 + r.int(4);
        const base = pool ? fy : fy + 1;
        for (let k = 0; k < h; k++) { if (k > 0 && !air(w.get(bx, base + k, bz))) break; const top = k === h - 1 || !air(w.get(bx, base + k + 1, bz)); w.set(bx, base + k, bz, top ? B.big_dripleaf : B.big_dripleaf_stem, f | (pool && k === 0 ? 128 : 0)); if (top) break; }
      } else {
        const base = pool ? fy : fy + 1;
        if (air(w.get(bx, base + 1, bz))) { w.set(bx, base, bz, B.small_dripleaf, pool ? 128 : 0); w.set(bx, base + 1, bz, B.small_dripleaf, 8); }
      }
    }
  }
  function azaleaOverCave(gen, w, r, x, z, cols) {
    if (!w.inside(x, z)) return;
    const col = cols[(x & 15) + (z & 15) * 16]; let y = col.h; while (y > MINY && air(w.get(x, y, z))) y--;
    const top = w.get(x, y, z); if (top !== B.grass_block && top !== B.dirt) return;
    if (!G.Features || !G.Features.azaleaTree) return;
    G.Features.azaleaTree(w, r, x, y + 1, z);
    // rooted dirt down to the cave and hanging roots under it
    let d = 1;
    for (; d < 40; d++) { const b = w.get(x, y - d, z); if (air(b)) break; if (STONY.has(b) || b === B.dirt || b === B.grass_block) w.set(x, y - d, z, B.rooted_dirt, 0); }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const hy = y - d + 1; if (r.chance(0.5) && air(w.get(x + dx, hy - 1, z + dz)) && w.get(x + dx, hy, z + dz) !== 0) w.set(x + dx, hy - 1, z + dz, B.hanging_roots, 0); }
  }
  // ---------------------------------------------------------------- dripstone caves
  function dripstone(w, r, x, y, z, below, above, noise) {
    if (STONY.has(below) && noise(x, y, z, 6) > -0.2) w.set(x, y - 1, z, B.dripstone_block, 0);
    if (STONY.has(above) && noise(x, y + 11, z, 6) > -0.2) w.set(x, y + 1, z, B.dripstone_block, 0);
    const k = r.next();
    if (w.get(x, y - 1, z) === B.dripstone_block && k < 0.08) { const n = 1 + r.int(3); for (let i = 0; i < n && air(w.get(x, y + i, z)); i++) w.set(x, y + i, z, B.pointed_dripstone, 0); return; }
    if (w.get(x, y + 1, z) === B.dripstone_block && k < 0.2) { const n = 1 + r.int(4); for (let i = 0; i < n && air(w.get(x, y - i, z)); i++) w.set(x, y - i, z, B.pointed_dripstone, 8); return; }
    // the odd great column from floor to ceiling
    if (k > 0.9994 && STONY.has(below)) { let top = y; while (top < y + 30 && air(w.get(x, top + 1, z))) top++; if (top < y + 30) for (let yy = y; yy <= top; yy++) { const rad = 1 + (Math.abs(yy - (y + top) / 2) > (top - y) * 0.3 ? 1 : 0); for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (dx * dx + dz * dz <= rad * rad + 1 && air(w.get(x + dx, yy, z + dz))) w.set(x + dx, yy, z + dz, B.dripstone_block, 0); } }
  }
  // ---------------------------------------------------------------- amethyst geodes
  function geode(w, r, x, y, z) {
    const s = 1 + r.next() * 0.35;
    const L = [1.7 * s, 2.2 * s, 3.2 * s, 4.2 * s], R = Math.ceil(L[3] + 2);
    // a few centres make the shape lumpy
    const pts = []; for (let i = 0; i < 3 + r.int(2); i++) pts.push([x + r.int(3) - 1, y + r.int(3) - 1, z + r.int(3) - 1]);
    // not in the open: every centre must be inside solid ground
    for (const p of pts) if (!solid(w.get(p[0], p[1], p[2])) && w.inside(p[0], p[2])) return;
    const dist = (bx, by, bz) => { let v = 0; for (const p of pts) v += 1 / Math.sqrt((bx - p[0]) ** 2 + (by - p[1]) ** 2 + (bz - p[2]) ** 2 + 1e-3); return pts.length / v; };
    const crack = r.chance(0.95), ca = r.next() * Math.PI * 2, cdx = Math.cos(ca), cdz = Math.sin(ca);
    const budding = [];
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const bx = x + dx, by = y + dy, bz = z + dz; if (!w.inside(bx, bz) || by <= MINY + 1) continue;
      const cur = w.get(bx, by, bz); if (cur === B.bedrock) continue;
      const d = dist(bx, by, bz) + (((bx * 7 + by * 13 + bz * 31) & 7) - 3.5) * 0.05;
      if (d > L[3]) continue;
      // the crack: a slot through the shell on one side
      if (crack && d > L[0] && Math.abs(dy) <= 1.5 && dx * cdx + dz * cdz > 0 && Math.abs(dx * cdz - dz * cdx) < 1.1) { w.set(bx, by, bz, 0, 0); continue; }
      if (d <= L[0]) w.set(bx, by, bz, 0, 0);
      else if (d <= L[1]) { const b = r.chance(0.083); w.set(bx, by, bz, b ? B.budding_amethyst : B.amethyst_block, 0); if (b) budding.push([bx, by, bz]); }
      else if (d <= L[2]) w.set(bx, by, bz, B.calcite, 0);
      else w.set(bx, by, bz, B.smooth_basalt, 0);
    }
    const BUDS = [B.small_amethyst_bud, B.medium_amethyst_bud, B.large_amethyst_bud, B.amethyst_cluster];
    for (const [bx, by, bz] of budding) {
      if (!r.chance(0.35)) continue;
      const d = r.int(6), nx = bx + DX[d], ny = by + DY[d], nz = bz + DZ[d];
      if (air(w.get(nx, ny, nz))) w.set(nx, ny, nz, BUDS[r.int(4)], d);
    }
  }
  // ---------------------------------------------------------------- fossils
  function fossil(w, r, x, y, z, deep) {
    const ore = deep ? B.deepslate_diamond_ore || B.diamond_ore : B.coal_ore;
    const set = (bx, by, bz, st) => { if (!w.inside(bx, bz)) return; const cur = w.get(bx, by, bz); if (!solid(cur) || cur === B.bedrock) return; if (!r.chance(0.9)) return; w.set(bx, by, bz, r.chance(0.1) ? ore : B.bone_block, st || 0); };
    const ax = r.chance(0.5); // spine along x or z
    const len = 6 + r.int(6), kind = r.int(3);
    for (let i = 0; i < len; i++) {
      const sx = ax ? x + i : x, sz = ax ? z : z + i;
      set(sx, y, sz, ax ? 1 : 2);
      // ribs arch over the spine every other block
      if (kind !== 1 && i % 2 === 0 && i > 0 && i < len - 2) for (let k = -3; k <= 3; k++) { if (k === 0) continue; const h = 3 - Math.abs(Math.abs(k) - 2); set(ax ? sx : sx + k, y + Math.max(0, h), ax ? sz + k : sz, 0); if (Math.abs(k) === 3) set(ax ? sx : sx + k, y + h - 1, ax ? sz + k : sz, 0); }
    }
    // a skull at the head end
    if (kind !== 2) for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) for (let dz = 0; dz < 3; dz++) if ((dx + dy + dz) % 2 === 0 || dy === 0) set((ax ? x + len : x - 1) + dx, y + dy, (ax ? z - 1 : z + len) + dz, 0);
  }
  G.Caves = { biomeAt, decorate, encode, at };
});
