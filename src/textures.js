'use strict';
/* Procedural 16x16 pixel-art texture atlas, painted in code in the classic block-game style: small hand-picked
   palettes, crisp single pixels, light catching the top-left of every brick, plank and stone and shadow on the
   bottom-right. Grass and foliage pixels are flagged in a tint mask so the shader can recolour them per biome
   (the colours painted here are the Meadowbrook ones). */
const TILE = 16, ATLAS_N = 16;
const Atlas = { canvas: null, data: null, tint: null, tiles: {}, count: 0 };
// biome colours (Meadowbrook, Ancient Forest, Mystic Marsh, Sunscorch Dunes, Crystal Highlands, Ashlands)
const BIOME_GRASS = [0x7fb956, 0x6fb54f, 0x6a7a3c, 0xbcb35a, 0x7fb28f, 0x8f8452];
const BIOME_FOLIAGE = [0x67a330, 0x4f9a2a, 0x5f7036, 0xa8a034, 0x5c9c74, 0x8c7a46];

(function buildAtlas() {
  const S = TILE * ATLAS_N;
  const data = new Uint8ClampedArray(S * S * 4), tintM = new Uint8Array(S * S);
  const H = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp01 = v => v < 0 ? 0 : v > 0.9999 ? 0.9999 : v;
  const pick = (pal, t) => H(pal[Math.floor(clamp01(t) * pal.length)]);
  const GRASS = H(BIOME_GRASS[0]), FOL = H(BIOME_FOLIAGE[0]);

  function tile(name, fn) {
    if (Atlas.tiles[name] !== undefined) throw new Error('duplicate tile ' + name);
    const i = Atlas.count++;
    Atlas.tiles[name] = i;
    const ox = (i % ATLAS_N) * TILE, oy = Math.floor(i / ATLAS_N) * TILE;
    let h = 7; for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const ts = (h >>> 0) % 100003;
    let rs = (h >>> 0) % 2147483646 + 1;
    const buf = new Array(256).fill(null);
    const c = {
      R() { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; },
      // per-pixel white noise and tileable value noise (cell in pixels), both 0..1 and stable per tile
      n(x, y, k) { let v = Math.imul((x & 15) + 1, 374761393) ^ Math.imul((y & 15) + 7, 668265263) ^ Math.imul(ts + (k || 0) * 131, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; },
      v(x, y, cx, cy, k) {
        cy = cy || cx; const Lx = 16 / cx, Ly = 16 / cy, gx = x / cx, gy = y / cy, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
        const hh = (a, b) => c.n(((a % Lx) + Lx) % Lx * 5 + 3, ((b % Ly) + Ly) % Ly * 7 + 1, 50 + (k || 0));
        const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
        return (hh(ix, iy) * (1 - u) + hh(ix + 1, iy) * u) * (1 - w) + (hh(ix, iy + 1) * (1 - u) + hh(ix + 1, iy + 1) * u) * w;
      },
      px(x, y, col, a) {
        x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
        const o = ((oy + y) * S + ox + x) * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = a === undefined ? 255 : a;
        buf[x + y * 16] = [col[0], col[1], col[2], a === undefined ? 255 : a];
      },
      get(x, y) { return buf[(x & 15) + (y & 15) * 16] || [0, 0, 0, 0]; },
      tint(x, y, v) { tintM[(oy + y) * S + ox + x] = v === undefined ? 255 : v; },
      clear() { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.px(x, y, [0, 0, 0], 0); },
      each(f) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) f(x, y); },
    };
    fn(c);
  }

  // ------------------------------------------------------------ shared painters
  // classic speckled soil: mostly one tone, small darker clumps, a few lighter grains
  const DIRT_P = [0x593d29, 0x6a4a32, 0x79553a, 0x866043, 0x8f6a4a, 0xa47a54];
  const dirt = (c, k) => c.each((x, y) => {
    const t = c.n(x, y, k) * 0.62 + c.v(x, y, 2, 2, k) * 0.38;
    let col = t < 0.16 ? DIRT_P[0] : t < 0.3 ? DIRT_P[1] : t < 0.58 ? DIRT_P[3] : t < 0.78 ? DIRT_P[2] : t < 0.94 ? DIRT_P[4] : DIRT_P[5];
    c.px(x, y, H(col));
  });
  const STONE_P = [0x5f5f5f, 0x6b6b6b, 0x747474, 0x7d7d7d, 0x868686, 0x949494];
  const stone = (c, k) => c.each((x, y) => {
    const blot = c.v(x, y, 4, 2, k), g = c.n(x, y, k);
    let i = blot < 0.3 ? 1 : blot < 0.42 ? 2 : 3;
    if (g > 0.9) i = blot < 0.35 ? 3 : 4; else if (g < 0.07) i = Math.max(0, i - 1);
    if (g > 0.975) i = 5;
    c.px(x, y, H(STONE_P[i]));
  });
  // overlay with ragged lower edge (grass side, snow side, marsh grass)
  const overhang = (c, depth, colFn, tint) => {
    for (let x = 0; x < 16; x++) {
      let d = depth + (c.n(x, 0, 9) < 0.45 ? 1 : 0) + (c.n(x, 1, 9) < 0.18 ? 1 : 0);
      if (x > 0 && c.n(x, 2, 9) < 0.25) d = Math.max(depth, d - 1);
      for (let y = 0; y < d; y++) { c.px(x, y, colFn(x, y, d)); if (tint) c.tint(x, y); }
    }
  };
  // tileable Voronoi stones (cobble, gravel-like masonry): each stone shaded like a rounded lump
  const cells = (c, n, k) => { const p = []; for (let i = 0; i < n; i++) p.push([c.n(i, 3, k) * 16, c.n(i, 9, k) * 16, c.n(i, 13, k)]); return p; };
  const voro = (pts, x, y) => {
    let d1 = 99, d2 = 99, best = null;
    for (const p of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
      const dx = x + 0.5 - p[0] - ox, dy = y + 0.5 - p[1] - oy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; best = [p, dx, dy]; } else if (d < d2) d2 = d;
    }
    return { d1, d2, edge: d2 - d1, p: best[0], dx: best[1], dy: best[2] };
  };
  const cobble = (c, k, pal, mortar) => {
    const pts = cells(c, 11, k);
    c.each((x, y) => {
      const v = voro(pts, x, y);
      if (v.edge < 0.95) { c.px(x, y, H(v.edge < 0.45 ? mortar[0] : mortar[1])); return; }
      const lit = (-v.dx - v.dy) / (v.d1 + 1.5); // top-left of each stone catches the light
      let t = 0.45 + lit * 0.32 + (v.p[2] - 0.5) * 0.3 + (c.n(x, y, k) - 0.5) * 0.18;
      if (v.edge < 1.6 && (v.dx > 0 || v.dy > 0)) t -= 0.18; // shadowed rim
      c.px(x, y, pick(pal, t));
    });
  };
  // bricks: rows of height rh, bricks of width bw, odd rows offset; bevel light top-left, shadow bottom-right
  const bricks = (c, o) => c.each((x, y) => {
    const row = Math.floor(y / o.rh), off = (row % 2) * (o.off !== undefined ? o.off : o.bw / 2), bx = (x + off) % o.bw, by = y % o.rh;
    const brick = Math.floor((x + off) / o.bw) + row * 7;
    if (by === o.rh - 1 || bx === o.bw - 1) { c.px(x, y, pick(o.mortar, c.n(x, y, 3))); return; }
    let t = 0.4 + (c.n(brick, row, 4) - 0.5) * 0.35 + (c.n(x, y, 5) - 0.5) * 0.28;
    if (by === 0 || bx === 0) t += 0.3; if (by === o.rh - 2 || bx === o.bw - 2) t -= 0.25;
    let col = pick(o.pal, t);
    if (o.moss && c.v(x, y, 4, 3, 6) * 0.7 + c.n(x, y, 7) * 0.3 > o.moss) col = pick(MOSS_P, c.n(x, y, 8));
    c.px(x, y, col);
  });
  const MOSS_P = [0x3f5e25, 0x4c6b2c, 0x597a33, 0x67893b];
  const planks = (c, pal, seam, joint) => c.each((x, y) => {
    const row = y >> 2, by = y & 3, jx = [3, 11, 7, 14][row];
    let t = 0.45 + (c.v(x, row * 4, 8, 1, row) - 0.5) * 0.5 + (c.n(x, y, 2) - 0.5) * 0.22;
    if (c.n(x >> 1, y, 3) < 0.12) t -= 0.25; // grain
    if (by === 0) t += 0.12;
    let col = pick(pal, t);
    if (by === 3) col = H(seam);
    if (x === jx && by < 3) col = H(joint);
    c.px(x, y, col);
  });
  const leaves = (c, pal, holes, tint) => c.each((x, y) => {
    const t = c.n(x, y, 1) * 0.55 + c.v(x, y, 2, 2, 2) * 0.45;
    if (c.n(x, y, 4) < holes * (1.25 - t)) { c.px(x, y, mul(H(pal[1]), 0.8), 0); return; }
    c.px(x, y, pick(pal, t)); if (tint) c.tint(x, y);
  });
  const wool = (c, base) => { const b = H(base); c.each((x, y) => {
    const fibre = 1 + Math.sin(x * 1.3 + Math.sin(y * 0.8 + c.n(0, y >> 2, 1) * 3) * 1.6) * 0.045 + Math.sin(y * 2.1 + x * 0.4) * 0.03;
    c.px(x, y, mul(b, fibre * (1 + (c.n(x, y, 2) - 0.5) * 0.07) * (1 + (c.v(x, y, 4, 4, 1) - 0.5) * 0.06)));
  }); };
  const plant = (name, fn) => tile(name, c => { c.clear(); fn(c); });
  const ore = (name, cols) => tile(name, c => {
    stone(c, 31);
    const blobs = [[2, 2], [10, 1], [6, 7], [12, 9], [1, 11], [8, 13]];
    for (const [bx, by] of blobs) {
      if (c.n(bx, by, 11) < 0.12) continue;
      const shape = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 0]].filter((p, i) => i < 4 || c.n(bx + p[0], by + p[1], 12) < 0.55);
      for (const [dx, dy] of shape) c.px(bx + dx + 1, by + dy + 1, H(cols[2]));
      for (const [dx, dy] of shape) c.px(bx + dx, by + dy, H(cols[c.n(bx + dx, by + dy, 13) < 0.3 ? 3 : 0]));
      c.px(bx, by, H(cols[1]));
    }
  });

  // ------------------------------------------------------------ terrain
  tile('dirt', c => dirt(c, 1));
  tile('grass_top', c => c.each((x, y) => {
    const t = c.n(x, y, 1) * 0.6 + c.v(x, y, 2, 2, 1) * 0.4;
    const f = t < 0.12 ? 0.7 : t < 0.35 ? 0.82 : t < 0.7 ? 0.9 : t < 0.9 ? 0.98 : 1.06;
    c.px(x, y, mul(GRASS, f)); c.tint(x, y);
  }));
  tile('grass_side', c => { dirt(c, 2); overhang(c, 3, (x, y, d) => mul(GRASS, (y === d - 1 ? 0.76 : 0.88) + (c.n(x, y, 5) - 0.5) * 0.16), true); });
  tile('stone', c => stone(c, 1));
  tile('cobble', c => cobble(c, 2, [0x5c5c5c, 0x6c6c6c, 0x7a7a7a, 0x878787, 0x969696, 0xa9a9a9], [0x3e3e3e, 0x4b4b4b]));
  tile('mossycobble', c => { cobble(c, 2, [0x5c5c5c, 0x6c6c6c, 0x7a7a7a, 0x878787, 0x969696, 0xa9a9a9], [0x3e3e3e, 0x4b4b4b]); c.each((x, y) => { if (c.v(x, y, 4, 4, 3) * 0.75 + c.n(x, y, 4) * 0.25 > 0.58) c.px(x, y, pick(MOSS_P, c.n(x, y, 6) * 0.6 + c.v(x, y, 2, 2, 5) * 0.4)); }); });
  tile('sand', c => c.each((x, y) => { const t = c.n(x, y, 1) * 0.75 + c.v(x, y, 4, 2, 1) * 0.25; c.px(x, y, pick([0xc9bd87, 0xd2c793, 0xdbd09e, 0xdbd09e, 0xe2d9ac, 0xe9e2bd], t)); }));
  tile('sandstone', c => c.each((x, y) => {
    let t = 0.5 + (c.n(x, y, 1) - 0.5) * 0.35;
    if (y < 3) t += 0.25; if (y === 3) t = 0.1; if (y > 11) t -= 0.12 + (c.n(x, y, 2) < 0.2 ? 0.2 : 0); if (y === 12) t = 0.15;
    if (y > 4 && y < 11 && c.n(x >> 2, y, 3) < 0.08) t -= 0.2;
    c.px(x, y, pick([0xbfae74, 0xccbc84, 0xd6c892, 0xddd09d, 0xe5dbad], t));
  }));
  tile('sandstone_top', c => c.each((x, y) => c.px(x, y, pick([0xd0c48f, 0xd9cd9b, 0xdfd4a5, 0xe6dcb2], c.n(x, y, 1) * 0.7 + c.v(x, y, 4, 4, 1) * 0.3))));
  tile('sandbrick', c => bricks(c, { rh: 8, bw: 16, off: 8, pal: [0xc6b47c, 0xd2c28c, 0xdbcd9a, 0xe4d8aa, 0xece3bb], mortar: [0xae9b62, 0xb8a66e] }));
  tile('terracotta', c => c.each((x, y) => c.px(x, y, pick([0x8e573e, 0x965e43, 0x9c6448, 0xa36a4d], c.n(x, y, 1) * 0.6 + c.v(x, y, 4, 4, 2) * 0.4))));
  tile('gravel', c => {
    const P = [0x5a5654, 0x6a6664, 0x7b7776, 0x8a8684, 0x9a9592, 0x7d7068, 0x6a5e57, 0xaaa5a2];
    c.each((x, y) => { const k = Math.floor(c.n(x >> 1, y >> 1, 1) * 8); let col = H(P[k]); const g = c.n(x, y, 2); col = mul(col, (x & 1) === 0 && (y & 1) === 0 ? 1.12 : (x & 1) && (y & 1) ? 0.82 : 0.97 + (g - 0.5) * 0.1); c.px(x, y, col); });
  });
  tile('snow', c => c.each((x, y) => c.px(x, y, pick([0xdde9ef, 0xe8f2f5, 0xf1f8fa, 0xf1f8fa, 0xfbfeff], c.n(x, y, 1) * 0.7 + c.v(x, y, 4, 4, 1) * 0.3))));
  tile('snow_side', c => { dirt(c, 3); overhang(c, 3, (x, y, d) => pick([0xdde9ef, 0xe8f2f5, 0xf3f9fb, 0xfbfeff], y === d - 1 ? 0.1 : c.n(x, y, 4))); });
  tile('bedrock', c => c.each((x, y) => c.px(x, y, pick([0x262626, 0x363636, 0x474747, 0x585858, 0x6d6d6d, 0x878787], c.n(x, y, 1) * 0.5 + c.v(x, y, 2, 2, 2) * 0.5))));
  tile('farmland', c => c.each((x, y) => {
    let t = c.n(x, y, 1) * 0.6 + c.v(x, y, 4, 1, 2) * 0.4; if ((y & 3) === 3) t *= 0.35; if ((y & 3) === 0) t = t * 0.7 + 0.3;
    c.px(x, y, pick([0x2e1c10, 0x3c2615, 0x4a301b, 0x563823, 0x643f27], t));
  }));
  tile('path', c => c.each((x, y) => c.px(x, y, pick([0x5e4a30, 0x6c5638, 0x78603e, 0x826a45, 0x8c744d, 0x998256], c.n(x, y, 1) * 0.65 + c.v(x, y, 2, 2, 3) * 0.35))));
  tile('mud', c => c.each((x, y) => c.px(x, y, pick([0x2a2626, 0x332f2e, 0x3c3836, 0x46413e, 0x524c47], c.n(x, y, 1) * 0.6 + c.v(x, y, 3, 3, 2) * 0.4))));
  const MARSH = [0x3f4a22, 0x4a572a, 0x566432, 0x617139, 0x6c7c42];
  tile('swamp_grass', c => c.each((x, y) => c.px(x, y, pick(MARSH, c.n(x, y, 1) * 0.6 + c.v(x, y, 2, 2, 1) * 0.4))));
  tile('swamp_grass_side', c => { c.each((x, y) => c.px(x, y, pick([0x2a2626, 0x332f2e, 0x3c3836, 0x46413e], c.n(x, y, 1)))); overhang(c, 3, (x, y, d) => pick(MARSH, y === d - 1 ? 0.1 : c.n(x, y, 4))); });
  tile('ash', c => c.each((x, y) => { const t = c.n(x, y, 1) * 0.6 + c.v(x, y, 2, 2, 2) * 0.4; c.px(x, y, t > 0.97 ? H(0xd2551e) : pick([0x221d1c, 0x2e2826, 0x3a3330, 0x463e3a, 0x534944], t)); }));
  tile('basalt', c => c.each((x, y) => { let t = c.v(x, y, 2, 8, 1) * 0.6 + c.n(x, y, 2) * 0.4; if (x % 5 === 0) t -= 0.25; c.px(x, y, pick([0x25252a, 0x303036, 0x3b3a41, 0x47464e, 0x55545c], t)); }));
  tile('cactus_side', c => c.each((x, y) => {
    let t = 0.5 + (c.n(x, y, 1) - 0.5) * 0.3; if (x === 0 || x === 15) t = 0.05; if (x % 4 === 2) t += 0.2; if (x % 4 === 0) t -= 0.18;
    let col = pick([0x2b5a17, 0x3a7020, 0x47822a, 0x549436, 0x63a541], t);
    if ((x % 4 === 3) && c.n(x, y, 2) < 0.16) col = H(0xd8d3a4); if ((x % 4 === 3) && c.n(x, y + 1, 2) < 0.16) col = H(0x1d2f10);
    c.px(x, y, col);
  }));
  tile('cactus_top', c => c.each((x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); let t = e === 0 ? 0.05 : e === 1 ? 0.35 : 0.6 + (c.n(x, y, 1) - 0.5) * 0.3; if (e > 2 && (x + y) % 5 === 0) t -= 0.15; c.px(x, y, pick([0x2b5a17, 0x3a7020, 0x47822a, 0x549436, 0x63a541], t)); }));

  // ------------------------------------------------------------ wood
  const OAK_P = [0x8a6a3c, 0x9c7c48, 0xa6854f, 0xb08e56, 0xbb9a60];
  tile('planks', c => planks(c, OAK_P, 0x6b5130, 0x7a5c35));
  tile('planks_dark', c => planks(c, [0x3a2711, 0x452f16, 0x4f371b, 0x5a3f20, 0x664826], 0x281a0b, 0x2f1f0e));
  const bark = (c, pal, crack) => c.each((x, y) => {
    let t = c.v(x, y, 2, 6, 1) * 0.55 + c.n(x, y, 2) * 0.45;
    if (c.v(x, y, 1, 5, 3) < 0.22) t -= 0.35;
    let col = pick(pal, t); if (c.n(x, y >> 2, 4) < 0.07) col = H(crack);
    c.px(x, y, col);
  });
  tile('log_side', c => bark(c, [0x3f2f1a, 0x4c3920, 0x5a4428, 0x6a5131, 0x77603a], 0x30230f));
  tile('log_dark_side', c => bark(c, [0x231910, 0x2c2015, 0x35281a, 0x3f2f1f, 0x4a3825], 0x170f08));
  const rings = (c, pal, barkCol) => c.each((x, y) => {
    const e = Math.min(x, y, 15 - x, 15 - y);
    if (e === 0) { c.px(x, y, mul(H(barkCol), 0.9 + c.n(x, y, 1) * 0.2)); return; }
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) + (c.n(x, y, 2) - 0.5) * 0.6;
    const ring = Math.floor(d) % 2; let t = ring ? 0.25 : 0.7; if (d < 1.6) t = 0.5; t += (c.n(x, y, 3) - 0.5) * 0.18;
    c.px(x, y, pick(pal, t));
  });
  tile('log_top', c => rings(c, [0x8e6d3e, 0x9d7a47, 0xae8b55, 0xbb985f], 0x5a4428));
  tile('log_dark_top', c => rings(c, [0x4e3a22, 0x5a4428, 0x66502f, 0x725a36], 0x2c2015));
  tile('leaves', c => leaves(c, [0x3a6416, 0x46761b, 0x538a22, 0x619c29, 0x6fad31], 0.3, true));
  tile('leaves_dark', c => leaves(c, [0x24400f, 0x2d4f13, 0x365e17, 0x41701c, 0x4c7f22], 0.26, true));
  tile('leaves_blossom', c => leaves(c, [0xc56f9c, 0xd889b2, 0xe7a2c4, 0xf2bdd6, 0xfad6e7], 0.26, false));
  tile('bookshelf', c => {
    planks(c, OAK_P, 0x6b5130, 0x7a5c35);
    const COLS = [[0x8e2a22, 0xa8382d], [0x2c4a86, 0x3b5fa0], [0x3d6e2c, 0x4f8638], [0x8a6a1c, 0xa8852a], [0x5a2a72, 0x6e3a8a], [0x6b4a2e, 0x80603c]];
    for (const [y0, y1] of [[2, 7], [9, 14]]) {
      for (let x = 1; x < 15;) {
        const w = c.n(x, y0, 1) < 0.5 ? 1 : 2, hgt = y1 - y0 - (c.n(x, y0, 2) < 0.3 ? 1 : 0), cc = COLS[Math.floor(c.n(x, y0, 3) * COLS.length)];
        for (let k = 0; k < w && x + k < 15; k++) for (let y = y0; y <= y1; y++) c.px(x + k, y, y > y1 - hgt ? H(k === 0 ? cc[1] : cc[0]) : H(0x2a1d10));
        x += w; if (c.n(x, y0, 4) < 0.2 && x < 14) { for (let y = y0; y <= y1; y++) c.px(x, y, H(0x2a1d10)); x++; }
      }
      for (let x = 0; x < 16; x++) { c.px(x, y0 - 1, H(0x6b5130)); c.px(x, y1 + 1, H(0x9c7c48)); }
      c.px(0, y0, H(0x6b5130)); c.px(15, y0, H(0x6b5130));
      for (let y = y0; y <= y1; y++) { c.px(0, y, H(0x7a5c35)); c.px(15, y, H(0x5a4428)); }
    }
  });
  tile('table_top', c => {
    planks(c, OAK_P, 0x6b5130, 0x7a5c35);
    c.each((x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); if (e === 0) c.px(x, y, H(0x4a3520)); else if (e === 1) c.px(x, y, H(0x6b5130)); });
    for (let i = 2; i < 14; i++) { c.px(i, 5, H(0x5a4428)); c.px(i, 10, H(0x5a4428)); c.px(5, i, H(0x5a4428)); c.px(10, i, H(0x5a4428)); }
    for (const [x, y] of [[3, 3], [7, 3], [12, 3], [3, 7], [7, 8], [12, 7], [3, 12], [7, 12], [12, 12]]) { c.px(x, y, H(0xc4a26a)); c.px(x + 1, y, H(0xb08e56)); }
  });
  tile('table_side', c => {
    planks(c, OAK_P, 0x6b5130, 0x7a5c35);
    for (let x = 0; x < 16; x++) { c.px(x, 0, H(0x4a3520)); c.px(x, 1, H(0x6b5130)); c.px(x, 15, H(0x4a3520)); }
    for (let y = 0; y < 16; y++) { c.px(0, y, H(0x4a3520)); c.px(15, y, H(0x4a3520)); }
    // a saw and a hammer hanging on the side
    for (let y = 4; y < 12; y++) { c.px(3, y, H(0xc8c8c8)); c.px(4, y, y % 2 ? H(0x8a8a8a) : H(0xb4b4b4)); }
    c.px(3, 12, H(0x5a3a1a)); c.px(4, 12, H(0x5a3a1a)); c.px(3, 13, H(0x4a2e12)); c.px(4, 13, H(0x4a2e12));
    for (let y = 5; y < 13; y++) c.px(11, y, H(0x5a3a1a));
    for (let x = 9; x < 14; x++) { c.px(x, 4, H(0x707070)); c.px(x, 5, H(0x9a9a9a)); }
  });

  // ------------------------------------------------------------ masonry
  const SB_P = [0x686868, 0x737373, 0x7c7c7c, 0x868686, 0x949494];
  tile('stonebrick', c => bricks(c, { rh: 8, bw: 16, off: 8, pal: SB_P, mortar: [0x4e4e4e, 0x585858] }));
  tile('mossybrick', c => bricks(c, { rh: 8, bw: 16, off: 8, pal: SB_P, mortar: [0x4e4e4e, 0x585858], moss: 0.56 }));
  tile('crackedbrick', c => {
    bricks(c, { rh: 8, bw: 16, off: 8, pal: SB_P, mortar: [0x4e4e4e, 0x585858] });
    let x = 4, y = 0; while (y < 16) { c.px(x, y, H(0x3c3c3c)); if (c.n(x, y, 2) < 0.4) c.px(x + 1, y, H(0x4a4a4a)); x += c.n(x, y, 3) < 0.33 ? -1 : c.n(x, y, 3) > 0.66 ? 1 : 0; x = Math.max(1, Math.min(14, x)); y++; }
    x = 12; y = 9; while (y < 16) { c.px(x, y, H(0x3c3c3c)); x += c.n(x, y, 4) < 0.5 ? -1 : 0; y++; }
  });
  tile('darkbrick', c => bricks(c, { rh: 4, bw: 8, pal: [0x2a2030, 0x33283a, 0x3c3044, 0x46384e, 0x52425a], mortar: [0x15101a, 0x1c1622] }));
  tile('darkbrick_cracked', c => {
    bricks(c, { rh: 4, bw: 8, pal: [0x2a2030, 0x33283a, 0x3c3044, 0x46384e, 0x52425a], mortar: [0x15101a, 0x1c1622] });
    let x = 3, y = 0; while (y < 16) { c.px(x, y, H(y % 3 ? 0xe0461a : 0xffa040)); x += c.n(x, y, 3) < 0.35 ? -1 : c.n(x, y, 3) > 0.65 ? 1 : 0; x = Math.max(1, Math.min(14, x)); y++; }
  });
  tile('redbrick', c => bricks(c, { rh: 4, bw: 8, pal: [0x7c4434, 0x8c4e3c, 0x985a46, 0xa46450, 0xb07260], mortar: [0x9a918a, 0xaaa198] }));
  tile('polished', c => c.each((x, y) => {
    const e = Math.min(x, y, 15 - x, 15 - y); let t = 0.55 + (c.n(x, y, 1) - 0.5) * 0.12;
    if (e === 0) t = (x === 0 || y === 0) ? 0.85 : 0.1; if (y === 7 && e > 0) t = 0.25; if (y === 8 && e > 0) t = 0.8;
    c.px(x, y, pick([0x7c7c7c, 0x8e8e8e, 0x9c9c9c, 0xa6a6a6, 0xb4b4b4], t));
  }));
  tile('plaster', c => c.each((x, y) => {
    let t = 0.55 + (c.v(x, y, 4, 4, 1) - 0.5) * 0.35 + (c.n(x, y, 2) - 0.5) * 0.2;
    if (c.n(x, y, 3) < 0.03) t = 0.1;
    c.px(x, y, pick([0xc9bea6, 0xd5cbb5, 0xddd4c0, 0xe4dccb, 0xebe5d6], t));
  }));
  tile('timber', c => {
    c.each((x, y) => c.px(x, y, pick([0xd5cbb5, 0xddd4c0, 0xe4dccb, 0xebe5d6], c.n(x, y, 1) * 0.7 + c.v(x, y, 4, 4, 1) * 0.3)));
    const beam = (x, y) => c.px(x, y, pick([0x3e2a16, 0x4a331b, 0x553c21], c.n(x, y, 4)));
    for (let i = 0; i < 16; i++) { beam(i, 0); beam(i, 15); beam(0, i); beam(15, i); beam(i, i); if (i > 0) beam(i - 1, i); }
  });
  tile('thatch', c => c.each((x, y) => {
    let t = c.n(x, (y + x) >> 1, 1) * 0.6 + c.v(x, y, 2, 4, 2) * 0.4; if ((x + y * 3) % 7 === 0) t -= 0.3;
    c.px(x, y, pick([0x7d5f1e, 0x977526, 0xae8a30, 0xc29d3c, 0xd4b04c], t));
  }));
  const shingles = (c, pal, edge) => c.each((x, y) => {
    const row = y >> 2, by = y & 3, off = (row & 1) * 2, sx = (x + off) & 3;
    let t = 0.5 + (c.n((x + off) >> 2, row, 1) - 0.5) * 0.45 + (c.n(x, y, 2) - 0.5) * 0.15;
    if (by === 0) t += 0.15; if (sx === 0) t -= 0.25;
    c.px(x, y, by === 3 ? H(edge) : pick(pal, t));
  });
  tile('roof_red', c => shingles(c, [0x7a2a1c, 0x8a3222, 0x9a3a28, 0xa94430, 0xb6513a], 0x4e170e));
  tile('roof_blue', c => shingles(c, [0x2c3a52, 0x354560, 0x3f506e, 0x4a5c7c, 0x56698a], 0x1a2232));
  tile('glass', c => {
    c.each((x, y) => c.px(x, y, [215, 236, 245], 22));
    const fr = [222, 240, 246];
    for (let i = 0; i < 16; i++) { c.px(i, 0, fr, 235); c.px(0, i, fr, 235); c.px(i, 15, [160, 196, 210], 235); c.px(15, i, [160, 196, 210], 235); }
    for (const [x, y] of [[2, 4], [3, 3], [4, 2], [2, 5], [3, 4], [5, 2], [11, 10], [12, 9], [10, 11]]) c.px(x, y, [250, 254, 255], 200);
  });
  const WOOL = { wool_red: 0xa12722, wool_white: 0xe9ecec, wool_blue: 0x35399d, wool_green: 0x546d1b, wool_yellow: 0xf3c12a, wool_purple: 0x7a2aad, wool_black: 0x1d1d21 };
  for (const k in WOOL) tile(k, c => wool(c, WOOL[k]));
  tile('hay_side', c => c.each((x, y) => {
    let t = c.n(x, y >> 1, 1) * 0.7 + c.v(x, y, 1, 8, 2) * 0.3; if (x % 3 === 0) t -= 0.25;
    let col = pick([0x8a6a1c, 0xa58426, 0xbd9a30, 0xd3b03e, 0xe2c454], t);
    if (y === 2 || y === 3 || y === 12 || y === 13) col = pick([0x5a2e14, 0x6e3a1a, 0x7e4620], (y === 2 || y === 12 ? 0.8 : 0.2) + (c.n(x, y, 3) - 0.5) * 0.3);
    c.px(x, y, col);
  }));
  tile('hay_top', c => c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); let t = c.n(x, y, 1) * 0.7 + 0.3 * (Math.floor(d) % 2); if (Math.min(x, y, 15 - x, 15 - y) === 0) t *= 0.5; c.px(x, y, pick([0x8a6a1c, 0xa58426, 0xbd9a30, 0xd3b03e, 0xe2c454], t)); }));

  // ------------------------------------------------------------ storage & workshop
  const box = (c, pal, frame, corner) => c.each((x, y) => {
    const e = Math.min(x, y, 15 - x, 15 - y);
    let col = pick(pal, 0.5 + (c.v(x, y, 8, 2, 1) - 0.5) * 0.4 + (c.n(x, y, 2) - 0.5) * 0.2);
    if ((y & 3) === 3) col = mul(col, 0.82);
    if (e === 0) col = H(frame);
    if (corner && e <= 1 && (x <= 1 || x >= 14) && (y <= 1 || y >= 14)) col = H(corner);
    c.px(x, y, col);
  });
  const CHEST_P = [0x7c5222, 0x8e5f27, 0x9c6a2e, 0xa87534, 0xb5813c];
  tile('chest_front', c => {
    box(c, CHEST_P, 0x3a2810, 0x8a8a92);
    for (let x = 1; x < 15; x++) { c.px(x, 5, H(0x2a1a0a)); c.px(x, 6, H(0x5a3a18)); }
    for (let y = 3; y <= 8; y++) for (let x = 6; x <= 9; x++) c.px(x, y, (x === 6 || y === 3) ? H(0xd8d8de) : (x === 9 || y === 8) ? H(0x6a6a72) : H(0xb0b0b8));
    c.px(7, 6, H(0x1a1a1e)); c.px(8, 6, H(0x1a1a1e)); c.px(7, 7, H(0x2a2a30));
  });
  tile('chest_side', c => { box(c, CHEST_P, 0x3a2810, 0x8a8a92); for (let x = 1; x < 15; x++) { c.px(x, 5, H(0x2a1a0a)); c.px(x, 6, H(0x5a3a18)); } });
  tile('chest_top', c => box(c, CHEST_P, 0x3a2810, 0x8a8a92));
  tile('barrel_side', c => c.each((x, y) => {
    const stave = x >> 2; let t = 0.5 + (c.n(stave, 0, 1) - 0.5) * 0.4 + (c.n(x, y, 2) - 0.5) * 0.2 + (1 - Math.abs(y - 7.5) / 7.5) * 0.15;
    let col = pick([0x5e3d1c, 0x6c4722, 0x7a5228, 0x875c2e, 0x946834], t);
    if ((x & 3) === 0) col = H(0x3e2810);
    if (y === 2 || y === 13) col = H(0x58585e); if (y === 1 || y === 12) col = H(0x8a8a92);
    c.px(x, y, col);
  }));
  tile('barrel_top', c => c.each((x, y) => {
    const e = Math.min(x, y, 15 - x, 15 - y);
    let col = pick([0x6c4722, 0x7a5228, 0x875c2e, 0x946834], 0.5 + (c.v(x, y, 8, 2, 1) - 0.5) * 0.4 + (c.n(x, y, 2) - 0.5) * 0.2);
    if ((y & 3) === 0) col = mul(col, 0.85);
    if (e === 0) col = H(0x3e2810); else if (e === 1) col = H(0x5e3d1c);
    if (x >= 6 && x <= 9 && y >= 6 && y <= 9) col = (x === 6 || x === 9 || y === 6 || y === 9) ? H(0x4a2e14) : H(0x2a1808);
    c.px(x, y, col);
  }));
  tile('crate', c => {
    box(c, [0xa07c48, 0xae8a52, 0xbb965c, 0xc6a266], 0x5c3e1c, 0x4a4a50);
    c.each((x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); if (e === 1) c.px(x, y, H(0x7a5428)); if (e > 1 && Math.abs(x - y) < 1) c.px(x, y, H(0x7a5428)); if (e > 1 && x - y === 1) c.px(x, y, H(0x5c3e1c)); });
  });
  const furnaceBase = c => c.each((x, y) => {
    const e = Math.min(x, y, 15 - x, 15 - y);
    let t = 0.5 + (c.n(x, y, 1) - 0.5) * 0.4 + (c.v(x, y, 2, 2, 2) - 0.5) * 0.3; if (e === 0) t = (x === 0 || y === 0) ? 0.85 : 0.08;
    c.px(x, y, pick([0x4e4e4e, 0x5c5c5c, 0x6a6a6a, 0x777777, 0x868686], t));
  });
  tile('furnace_side', c => furnaceBase(c));
  tile('furnace_front', c => {
    furnaceBase(c);
    for (let x = 3; x < 13; x++) { c.px(x, 3, H(0x4a4a4a)); c.px(x, 4, H(0x8a8a8a)); }
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) c.px(x, y, y < 10 ? H(0x161616) : y < 12 ? pick([0xc8501a, 0xe8781e, 0xffa02a], c.n(x, y, 3)) : pick([0xffb43a, 0xffd25a, 0xfff08a], c.n(x, y, 4)));
    for (let x = 3; x < 13; x++) c.px(x, 7, H(0x3a3a3a));
  });
  tile('lamp', c => c.each((x, y) => {
    const fr = x < 2 || x > 13 || y < 2 || y > 13, mid = x === 7 || x === 8 || y === 7 || y === 8;
    if (fr) { c.px(x, y, pick([0x1c1a18, 0x2a2622, 0x38322c], (x === 0 || y === 0) ? 0.9 : c.n(x, y, 1) * 0.6)); return; }
    if (mid) { c.px(x, y, H(0x3a342c)); return; }
    const d = Math.hypot(x - 7.5, y - 7.5) / 7;
    c.px(x, y, mix(H(0xfff6d0), H(0xf0a03a), Math.min(1, d * 1.2 + (c.n(x, y, 2) - 0.5) * 0.15)));
  }));
  tile('cauldron', c => { furnaceBase(c); for (let y = 2; y < 6; y++) for (let x = 2; x < 14; x++) c.px(x, y, pick([0x3a8a2a, 0x4aa034, 0x5cb83e], c.n(x, y, 5))); });
  tile('pot', c => c.each((x, y) => {
    let col = pick([0x8a4426, 0x9a4e2c, 0xa85834, 0xb4633c], 0.5 + (c.n(x, y, 1) - 0.5) * 0.3 + (x < 3 ? 0.2 : x > 12 ? -0.2 : 0));
    if (y === 2 || y === 13) col = H(0x5a2a16); if (y > 5 && y < 10 && ((x + (y > 7 ? 2 : 0)) & 3) === 1) col = H(0xe8d8a8);
    c.px(x, y, col);
  }));
  tile('iron_block', c => c.each((x, y) => {
    let t = 0.55 + (c.n(x, y, 1) - 0.5) * 0.08; const bx = x & 7, by = y & 7;
    if (by === 0 || bx === 0) t = 0.9; if (by === 7 || bx === 7) t = 0.2; if (by === 1 && bx > 0 && bx < 7) t = 0.75;
    c.px(x, y, pick([0x9a9a9e, 0xb8b8bc, 0xcdcdd1, 0xdcdce0, 0xececf0], t));
  }));
  tile('steel_block', c => c.each((x, y) => {
    let t = 0.5 + (c.n(x, y, 1) - 0.5) * 0.1 + (c.v(x, y, 8, 8, 2) - 0.5) * 0.1; const bx = x & 7, by = y & 7;
    if (by === 0 || bx === 0) t = 0.88; if (by === 7 || bx === 7) t = 0.12;
    c.px(x, y, pick([0x3e434c, 0x4b515b, 0x59606b, 0x68707c, 0x7a838f, 0x929ba8], t));
  }));
  tile('gold_block', c => c.each((x, y) => {
    let t = 0.55 + (c.n(x, y, 1) - 0.5) * 0.12; const e = Math.min(x, y, 15 - x, 15 - y);
    if (e === 0) t = (x === 0 || y === 0) ? 0.95 : 0.05; else if (e === 1) t = (x === 1 || y === 1) ? 0.8 : 0.2;
    if (e > 2 && x - y > -2 && x - y < 1 && x < 9) t = 0.95;
    c.px(x, y, pick([0xb07e12, 0xd49e1c, 0xf0c22c, 0xf9d94a, 0xfff08a], t));
  }));
  tile('ancient_gold', c => c.each((x, y) => {
    let t = 0.5 + (c.n(x, y, 1) - 0.5) * 0.2; const bx = x & 7, by = y & 7;
    if (bx === 0 || by === 0) t = 0.85; if (bx === 7 || by === 7) t = 0.1;
    let col = pick([0x9a6c10, 0xb8861a, 0xd4a226, 0xe8bc36, 0xf7d65a], t);
    if ((bx === 3 || bx === 4) && by > 1 && by < 6 || (by === 3 || by === 4) && bx > 1 && bx < 6) col = (bx + by) % 2 ? H(0x6ef0ff) : H(0xb8faff);
    c.px(x, y, col);
  }));
  tile('ench_top', c => c.each((x, y) => {
    let col = pick([0x6e1418, 0x82191e, 0x962024], c.n(x, y, 1));
    const e = Math.min(x, y, 15 - x, 15 - y); if (e === 0) col = H(0x1a1024); if (e === 0 && (x <= 1 || x >= 14) && (y <= 1 || y >= 14)) col = H(0x3a86c8);
    if (x >= 3 && x <= 12 && y >= 4 && y <= 11) { col = (x === 7 || x === 8) ? H(0xb8a888) : H(0xeee4c8); if (y === 4 || y === 11) col = H(0x6a3a1a); else if (x !== 7 && x !== 8 && x > 3 && x < 12 && y > 5 && y < 10 && (x + y * 3) % 4 < 2) col = H(0x3e2e6a); }
    c.px(x, y, col);
  }));
  tile('ench_side', c => c.each((x, y) => {
    let col = pick([0x140c1c, 0x1c1226, 0x251830], c.n(x, y, 1) * 0.7 + c.v(x, y, 2, 2, 2) * 0.3);
    if (y < 4) col = pick([0x6e1418, 0x82191e, 0x962024], c.n(x, y, 2)); if (y === 4) col = H(0x4a0c10);
    if (y > 5 && y < 15 && ((x === 3 && y > 7) || (x === 12 && y > 6) || (y === 10 && x > 4 && x < 11) || (x === 7 && y === 7) || (x === 8 && y === 13))) col = H(0x3a6ae8);
    c.px(x, y, col);
  }));
  tile('ench_bottom', c => c.each((x, y) => c.px(x, y, pick([0x140c1c, 0x1c1226, 0x251830], c.n(x, y, 1)))));

  // ------------------------------------------------------------ ores, crystal and glowing things
  ore('coal_ore', [0x2a2a2a, 0x4a4a4a, 0x1a1a1a, 0x363636]);
  ore('iron_ore', [0xd8af93, 0xeccbb6, 0x8a6a52, 0xc49a7e]);
  ore('gold_ore', [0xf6d83a, 0xfff6a0, 0xa8801a, 0xe0b82a]);
  ore('lapis_ore', [0x2a52c8, 0x5a86f0, 0x152a6e, 0x1e40a4]);
  const amethyst = (c, pal) => c.each((x, y) => {
    const d1 = (x + y) & 7, d2 = (x - y + 16) & 7;
    let t = 0.45 + (c.n(x >> 1, y >> 1, 1) - 0.5) * 0.5; if (d1 === 0) t += 0.35; if (d2 === 0) t -= 0.3;
    let col = pick(pal, t); if (c.n(x, y, 3) > 0.96) col = [255, 255, 255];
    c.px(x, y, col);
  });
  tile('crystal', c => amethyst(c, [0x2a8eb4, 0x38a8cc, 0x4cc0e0, 0x72d8f0, 0xaaecff]));
  tile('crystal_rose', c => amethyst(c, [0x7a3ea8, 0x8e4cc0, 0xa862d6, 0xc086ea, 0xdcb2f8]));
  tile('fallen_star', c => c.each((x, y) => { const t = c.n(x, y, 1); c.px(x, y, t > 0.9 ? pick([0x9af0ff, 0xd8fbff], c.n(x, y, 2)) : pick([0x1e1e2c, 0x262636, 0x2e2e40, 0x383850], c.v(x, y, 2, 2, 3) * 0.6 + t * 0.4)); }));
  tile('energy', c => c.each((x, y) => { const d = Math.abs(x - 7.5); c.px(x, y, d < 2 ? mix(H(0xffffff), H(0xbaf8ff), d / 2) : d < 5 ? mix(H(0xbaf8ff), H(0x3ac8e8), (d - 2) / 3 + (c.n(x, y, 1) - 0.5) * 0.2) : H(0x1a7aa8)); }));
  tile('portal', c => c.each((x, y) => { const w = Math.sin(x * 0.7 + y * 0.4 + c.v(x, y, 4, 4, 1) * 4) * 0.5 + 0.5; c.px(x, y, mix(H(0x3a9ad8), H(0xdaffff), w * 0.8), 205); }));
  tile('waystone', c => {
    c.each((x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); c.px(x, y, pick([0x22243a, 0x2c2e46, 0x363852, 0x42445e], e === 0 ? ((x === 0 || y === 0) ? 0.9 : 0.05) : 0.4 + (c.n(x, y, 1) - 0.5) * 0.5)); });
    for (const [x, y] of [[7, 2], [8, 2], [7, 3], [7, 4], [6, 5], [8, 5], [5, 6], [9, 6], [7, 7], [7, 8], [7, 9], [6, 10], [8, 10], [7, 11], [7, 12], [5, 13], [6, 13], [8, 13], [9, 13]]) c.px(x, y, H(0x6ef0ff));
  });
  tile('waystone_top', c => { c.each((x, y) => c.px(x, y, pick([0x22243a, 0x2c2e46, 0x363852, 0x42445e], c.n(x, y, 1)))); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) c.px(x, y, (x === 5 || x === 10 || y === 5 || y === 10) ? H(0x3ac8e8) : H(0x9af6ff)); });
  tile('tablet', c => {
    c.each((x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); let t = 0.5 + (c.n(x, y, 1) - 0.5) * 0.3; if (e === 0) t = (x === 0 || y === 0) ? 0.9 : 0.05; if (e === 1) t = (x === 1 || y === 1) ? 0.1 : 0.85; c.px(x, y, pick([0x6e6a62, 0x8a867c, 0xa09c92, 0xb0aca2, 0xc2beb4], t)); });
    for (const r of [4, 7, 10]) for (let x = 3; x < 13; x++) if (c.n(x, r, 2) < 0.75) { c.px(x, r, H(0x4a463e)); c.px(x, r + 1, H(0xc8c4ba)); }
  });
  tile('tablet_side', c => c.each((x, y) => c.px(x, y, pick([0x8a867c, 0xa09c92, 0xb0aca2], c.n(x, y, 1)))));
  tile('runepillar', c => {
    c.each((x, y) => { const e = Math.min(x, 15 - x); c.px(x, y, pick([0x4a4a54, 0x55555f, 0x60606a, 0x6c6c76], e === 0 ? 0.05 : e === 1 ? 0.9 : 0.4 + (c.n(x, y, 1) - 0.5) * 0.4)); });
    for (const [x, y] of [[4, 3], [5, 4], [6, 5], [7, 6], [8, 5], [9, 4], [10, 3], [7, 7], [7, 8], [7, 9], [5, 11], [6, 11], [8, 11], [9, 11], [7, 12]]) c.px(x, y, H(0x8af0d0));
  });
  tile('altar', c => c.each((x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); let col = pick([0x1c1428, 0x261c34, 0x302440], c.n(x, y, 1)); if (e === 1 || ((x + y) & 3) === 0 && e > 2 && e < 6) col = H(0x6a3aa8); if (e === 0) col = H(0x120c1a); c.px(x, y, col); }));
  tile('spawner', c => { c.clear(); c.each((x, y) => { if (x % 4 === 0 || y % 4 === 0 || x === 15 || y === 15) c.px(x, y, pick([0x18222c, 0x223040, 0x2c3e52], (x === 0 || y === 0) ? 0.9 : c.n(x, y, 1) * 0.7)); }); });
  tile('banner_red', c => c.each((x, y) => {
    let col = pick([0x8e1c1c, 0x9e2222, 0xae2a2a], c.n(x, y, 1) * 0.5 + 0.5 - (x < 2 ? 0.4 : 0));
    if (y === 0) col = H(0x5a3a1a);
    if ((x === 7 || x === 8) && y > 3 && y < 13) col = H(0xe8c040); if (y === 6 && x > 4 && x < 11) col = H(0xe8c040);
    if (y > 13 && (x + y) % 3 === 0) col = H(0xe8c040);
    c.px(x, y, col);
  }));

  // ------------------------------------------------------------ fluids
  tile('water', c => c.each((x, y) => { const w = c.v(x, y, 4, 4, 1) * 0.6 + c.n(x, y, 2) * 0.4; c.px(x, y, pick([0x2a54b0, 0x3060c0, 0x3a6ad0, 0x4878de, 0x5a8ae8], w)); }));
  tile('lava', c => c.each((x, y) => { const w = c.v(x, y, 4, 4, 1) * 0.65 + c.n(x, y, 2) * 0.35; c.px(x, y, pick([0xb8300a, 0xd4440e, 0xe86414, 0xf68a1e, 0xffb43a, 0xffd860], w)); }));

  // ------------------------------------------------------------ thin things (cutouts and plants)
  tile('rail', c => { c.clear(); for (const y of [1, 5, 9, 13]) for (let x = 1; x < 15; x++) { c.px(x, y, H(0x7a5a32)); c.px(x, y + 1, H(0x5a4226)); } for (let y = 0; y < 16; y++) { c.px(3, y, H(0x9a9aa2)); c.px(4, y, H(0x6a6a72)); c.px(11, y, H(0x9a9aa2)); c.px(12, y, H(0x6a6a72)); } });
  tile('ladder', c => { c.clear(); for (let y = 0; y < 16; y++) { c.px(2, y, H(0x8a6a3c)); c.px(3, y, H(0x6b5130)); c.px(12, y, H(0x8a6a3c)); c.px(13, y, H(0x6b5130)); } for (const y of [2, 6, 10, 14]) for (let x = 2; x < 14; x++) { c.px(x, y, H(0xa0804c)); c.px(x, y + 1, H(0x6b5130)); } });
  tile('net', c => { c.clear(); c.each((x, y) => { if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) c.px(x, y, (x + y) % 8 === 0 ? H(0xb8ae88) : H(0xd8cfa8)); }); });
  tile('web', c => { c.clear(); c.each((x, y) => { const r = Math.hypot(x - 7.5, y - 7.5); if (x === y || x === 15 - y || x === 7 || y === 7 || Math.abs(r - 5.5) < 0.45 || Math.abs(r - 2.5) < 0.4) c.px(x, y, [236, 236, 240], 220); }); });
  tile('spikes', c => { c.clear(); for (let s = 0; s < 4; s++) { const cx = 2 + s * 4; for (let y = 3; y < 16; y++) { const w = (y - 3) / 13 * 1.6; for (let x = cx - w; x <= cx + w; x++) c.px(x, y, y < 6 ? H(0xe2e2ea) : x < cx ? H(0x9a9aa4) : H(0x6e6e78)); } } });
  plant('torch', c => {
    for (let y = 6; y < 16; y++) { c.px(7, y, H(0x8a6a3c)); c.px(8, y, H(0x5e4426)); }
    c.px(7, 6, H(0x4a3a24)); c.px(8, 6, H(0x3a2c1a));
    for (const [x, y, col] of [[7, 4, 0xfff6c0], [8, 4, 0xffe08a], [7, 5, 0xffd24a], [8, 5, 0xffa82a], [7, 3, 0xffffff], [8, 3, 0xfff0a0], [6, 5, 0xff8a1a], [9, 4, 0xffb43a]]) c.px(x, y, H(col));
  });
  plant('fire', c => { for (let x = 1; x < 15; x++) { const h = 5 + Math.floor(c.v(x, 0, 3, 1, 1) * 9 + c.n(x, 0, 2) * 3); for (let y = 15; y > 15 - h; y--) { const f = (15 - y) / h; c.px(x, y, f < 0.35 ? H(0xd84a10) : f < 0.7 ? H(0xff9a2a) : H(0xffe46a)); } } });
  plant('tallgrass', c => {
    for (let b = 0; b < 8; b++) {
      let x = 1 + Math.floor(c.n(b, 0, 1) * 14); const h = 6 + Math.floor(c.n(b, 1, 1) * 9);
      for (let y = 15; y > 15 - h; y--) { c.px(x, y, mul(GRASS, 0.7 + (15 - y) / h * 0.35)); c.tint(x, y); if (c.n(b, y, 2) < 0.25) x += c.n(b, y, 3) < 0.5 ? -1 : 1; x = Math.max(0, Math.min(15, x)); }
    }
  });
  plant('wheat', c => { for (let b = 0; b < 6; b++) { const x = 1 + Math.round(b * 2.6); for (let y = 15; y > 3; y--) c.px(x, y, y < 8 ? pick([0xc89a2a, 0xdcb440, 0xecc858], c.n(x, y, 1)) : pick([0x8a8a2a, 0xa09a34, 0xb4a63c], c.n(x, y, 2))); c.px(x + 1, 5, H(0xe8cc5a)); c.px(x - 1, 6, H(0xd4b040)); c.px(x + 1, 7, H(0xc89a2a)); } });
  plant('flower_red', c => { for (let y = 8; y < 16; y++) c.px(7, y, H(0x3e7a2a)); c.px(6, 11, H(0x4e8a34)); c.px(8, 12, H(0x4e8a34)); c.px(5, 10, H(0x3e7a2a)); for (const [x, y, k] of [[6, 4, 1], [7, 4, 1], [8, 4, 2], [5, 5, 1], [6, 5, 1], [7, 5, 0], [8, 5, 2], [9, 5, 2], [5, 6, 1], [6, 6, 2], [7, 6, 2], [8, 6, 2], [9, 6, 3], [6, 7, 3], [7, 7, 3], [8, 7, 3]]) c.px(x, y, H([0x1a1a1a, 0xe23a2a, 0xc42a22, 0x9a1e18][k])); });
  plant('flower_yellow', c => { for (let y = 9; y < 16; y++) c.px(8, y, H(0x3e7a2a)); c.px(7, 12, H(0x4e8a34)); for (const [x, y, k] of [[8, 5, 0], [7, 6, 0], [8, 6, 1], [9, 6, 0], [7, 7, 2], [8, 7, 0], [9, 7, 2], [8, 8, 2]]) c.px(x, y, H([0xffe23a, 0xfff6a0, 0xd8b020][k])); });
  plant('flower_blue', c => { for (let y = 9; y < 16; y++) c.px(7, y, H(0x3e7a2a)); c.px(8, 12, H(0x4e8a34)); for (const [x, y, k] of [[7, 4, 0], [6, 5, 0], [7, 5, 2], [8, 5, 0], [5, 6, 1], [6, 6, 0], [7, 6, 0], [8, 6, 0], [9, 6, 1], [6, 7, 1], [7, 7, 0], [8, 7, 1]]) c.px(x, y, H([0x5a7ae8, 0x3a52c0, 0xd8e0ff][k])); });
  plant('deadbush', c => { for (let b = 0; b < 5; b++) { let x = 7.5, y = 15; const dx = (c.n(b, 0, 1) - 0.5) * 1.6; for (let s = 0; s < 7 + b; s++) { c.px(x, y, H(s % 3 ? 0x8a6a3a : 0x6a4e28)); x += dx; y -= 1; } } });
  plant('mushroom', c => { for (let y = 10; y < 16; y++) { c.px(7, y, H(0xe8dcc4)); c.px(8, y, H(0xc8bca4)); } for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) if (!(y === 6 && (x === 4 || x === 11))) c.px(x, y, (x * 3 + y * 5) % 7 === 0 ? H(0xffffff) : y === 9 ? H(0x9a1e1e) : H(0xd02a2a)); });
  plant('glowshroom', c => { for (let y = 10; y < 16; y++) { c.px(7, y, H(0xb8f0f0)); c.px(8, y, H(0x8ad0d0)); } for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) if (!(y === 6 && (x === 4 || x === 11))) c.px(x, y, (x * 3 + y * 5) % 7 === 0 ? H(0xffffff) : y === 9 ? H(0x1e9ab0) : H(0x3ad8e8)); });
  plant('crystal_cluster', c => { for (const [cx, w, h] of [[4, 2, 8], [8, 3, 12], [12, 2, 7]]) for (let y = 15; y > 15 - h; y--) for (let x = cx - w / 2; x < cx + w / 2; x++) c.px(x, y, y < 15 - h + 2 ? H(0xd8fbff) : x < cx ? H(0x7ae0f8) : H(0x38a8cc)); });
  plant('sapling_dead', c => { let x = 7; for (let y = 15; y > 3; y--) { c.px(x, y, H(0x3a2a1e)); if (y === 9) { c.px(x + 1, y - 1, H(0x3a2a1e)); c.px(x + 2, y - 2, H(0x2a1e14)); } if (y === 6) { c.px(x - 1, y - 1, H(0x3a2a1e)); c.px(x - 2, y - 2, H(0x2a1e14)); } } });
  plant('berrybush', c => { c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 9); if (d < 7 && c.n(x, y, 1) > 0.15) c.px(x, y, pick([0x2c5a1e, 0x386c26, 0x447e2e], c.n(x, y, 2))); }); for (let i = 0; i < 7; i++) { const x = 3 + Math.floor(c.n(i, 0, 3) * 10), y = 4 + Math.floor(c.n(i, 1, 3) * 9); c.px(x, y, H(0x4a6ae0)); c.px(x + 1, y, H(0x8aaaff)); c.px(x, y + 1, H(0x2a3ea0)); } });
  plant('vines', c => { for (let b = 0; b < 6; b++) { let x = 1 + b * 2.6; const len = 6 + Math.floor(c.n(b, 0, 1) * 10); for (let y = 0; y < len; y++) { c.px(x, y, mul(FOL, 0.75 + c.n(b, y, 2) * 0.3)); c.tint(Math.floor(x), y); if (c.n(b, y, 3) < 0.35) { c.px(x + 1, y, mul(FOL, 0.95)); c.tint(Math.min(15, Math.floor(x) + 1), y); } x += (c.n(b, y, 4) - 0.5) * 0.7; } } });
  plant('lilypad', c => c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); const cut = x > 7 && Math.abs(y - 7.5) < 1.2; if (d < 7.2 && !cut) c.px(x, y, pick([0x2e6a1e, 0x3a7a26, 0x46892e, 0x52983a], c.n(x, y, 1) * 0.6 + (1 - d / 7.2) * 0.4)); }));
  Atlas.data = data; Atlas.tint = tintM;
  // a canvas copy for icons and particles
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S); img.data.set(data); ctx.putImageData(img, 0, 0);
  Atlas.canvas = cv;
})();
