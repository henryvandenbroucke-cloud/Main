'use strict';
/* Procedural 16x16 block textures, painted in code in the vanilla style (no game files are used).
   Every texture becomes one layer of a texture array (animated ones take several layers).
   Grass and foliage textures are painted grey and tinted per biome; in solid textures the alpha channel marks
   which pixels take the tint (alpha 0 = tinted), the way the game overlays grass on the side of a grass block. */
const Tex = (() => {
  const layers = [], index = {}, painters = {};
  const H = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const cl01 = v => v < 0 ? 0 : v > 0.9999 ? 0.9999 : v;
  const pick = (pal, t) => H(pal[Math.floor(cl01(t) * pal.length)]);
  function hashName(name) { let h = 7; for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

  function ctx(name, frame) {
    const data = new Uint8Array(1024), seed = hashName(name) % 100003;
    let rs = (hashName(name) + (frame || 0) * 7919) % 2147483646 + 1;
    const c = {
      data, frame: frame || 0, mask: false,
      R() { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; },
      // per-pixel noise and tileable value noise, 0..1, stable for the texture
      n(x, y, k) { let v = Math.imul((x & 15) + 1, 374761393) ^ Math.imul((y & 15) + 7, 668265263) ^ Math.imul(seed + (k || 0) * 131, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; },
      v(x, y, cx, cy, k) {
        cy = cy || cx; const Lx = 16 / cx, Ly = 16 / cy, gx = x / cx, gy = y / cy, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
        const hh = (a, b) => c.n(((a % Lx) + Lx) % Lx * 5 + 3, ((b % Ly) + Ly) % Ly * 7 + 1, 50 + (k || 0));
        const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
        return (hh(ix, iy) * (1 - u) + hh(ix + 1, iy) * u) * (1 - w) + (hh(ix, iy + 1) * (1 - u) + hh(ix + 1, iy + 1) * u) * w;
      },
      px(x, y, col, a) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x > 15 || y > 15) return; const o = (y * 16 + x) * 4; data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = a === undefined ? 255 : a; },
      get(x, y) { const o = ((y & 15) * 16 + (x & 15)) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; },
      alpha(x, y, a) { data[((y & 15) * 16 + (x & 15)) * 4 + 3] = a; },
      clear() { data.fill(0); },
      each(f) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) f(x, y); },
      fill(col) { c.each((x, y) => c.px(x, y, col)); },
      rect(x0, y0, x1, y1, col, a) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.px(x, y, col, a); },
      line(x0, y0, x1, y1, col) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) c.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col); },
      copy(name2, fr) { const src = paint(name2, fr || 0); data.set(src); },
      tintMask() { c.mask = true; },
    };
    return c;
  }
  const cache = {};
  function paint(name, frame) {
    const k = name + '#' + (frame || 0);
    if (cache[k]) return cache[k];
    const p = painters[name] || fallback(name);
    const c = ctx(name, frame);
    p.fn(c, frame || 0);
    cache[k] = c.data; cache[k].mask = c.mask;
    return c.data;
  }
  function def(name, fn, frames) { painters[name] = { fn, frames: frames || 1 }; }
  // ---------------------------------------------------------------- shared painters
  const STONE = [0x6a6a6a, 0x737373, 0x7b7b7b, 0x828282, 0x8a8a8a, 0x979797];
  function stone(c, pal, k, streak) {
    pal = pal || STONE;
    c.each((x, y) => {
      const blot = c.v(x, y, streak ? 8 : 4, 2, k), g = c.n(x, y, k);
      let i = blot < 0.32 ? 1 : blot < 0.46 ? 2 : 3;
      if (g > 0.88) i = Math.min(pal.length - 1, i + 1 + (g > 0.97 ? 1 : 0)); else if (g < 0.08) i = Math.max(0, i - 1);
      c.px(x, y, H(pal[i]));
    });
  }
  const DIRT = [0x593d29, 0x6c4c33, 0x79553a, 0x866043, 0x936a48, 0xb9855c];
  function dirt(c, k, pal) {
    pal = pal || DIRT;
    c.each((x, y) => {
      const t = c.n(x, y, k) * 0.65 + c.v(x, y, 2, 2, k) * 0.35;
      c.px(x, y, H(t < 0.14 ? pal[0] : t < 0.3 ? pal[1] : t < 0.55 ? pal[3] : t < 0.75 ? pal[2] : t < 0.93 ? pal[4] : pal[5]));
    });
  }
  function speckle(c, base, spread, k, cell) {
    const b = H(base);
    c.each((x, y) => { const t = (c.n(x, y, k) - 0.5) * spread + (c.v(x, y, cell || 4, cell || 4, k) - 0.5) * spread * 0.6; c.px(x, y, mul(b, 1 + t)); });
  }
  // tileable Voronoi stones (cobblestone and friends)
  const cells = (c, n, k) => { const p = []; for (let i = 0; i < n; i++) p.push([c.n(i, 3, k) * 16, c.n(i, 9, k) * 16, c.n(i, 13, k)]); return p; };
  function voro(pts, x, y) {
    let d1 = 99, d2 = 99, best = null;
    for (const p of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
      const dx = x + 0.5 - p[0] - ox, dy = y + 0.5 - p[1] - oy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; best = [p, dx, dy]; } else if (d < d2) d2 = d;
    }
    return { d1, d2, edge: d2 - d1, p: best[0], dx: best[1], dy: best[2] };
  }
  function cobble(c, k, pal, mortar, n) {
    const pts = cells(c, n || 10, k);
    c.each((x, y) => {
      const v = voro(pts, x, y);
      if (v.edge < 1.0) { c.px(x, y, H(v.edge < 0.5 ? mortar[0] : mortar[1])); return; }
      const lit = (-v.dx - v.dy) / (v.d1 + 1.5);
      let t = 0.45 + lit * 0.35 + (v.p[2] - 0.5) * 0.3 + (c.n(x, y, k) - 0.5) * 0.15;
      if (v.edge < 1.7 && (v.dx > 0 || v.dy > 0)) t -= 0.2;
      c.px(x, y, pick(pal, t));
    });
  }
  // bricks: rows of height rh and bricks of width bw (odd rows offset), light top-left and dark bottom-right
  function bricks(c, o) {
    c.each((x, y) => {
      const row = Math.floor(y / o.rh), off = (row % 2) * (o.off !== undefined ? o.off : o.bw / 2), bx = (x + off) % o.bw, by = y % o.rh;
      const brick = Math.floor((x + off) / o.bw) + row * 7;
      if (by === o.rh - 1 || bx === o.bw - 1) { c.px(x, y, pick(o.mortar, c.n(x, y, 3))); return; }
      let t = 0.45 + (c.n(brick, row, 4) - 0.5) * (o.vary === undefined ? 0.35 : o.vary) + (c.n(x, y, 5) - 0.5) * 0.25;
      if (by === 0 || bx === 0) t += 0.25; if (by === o.rh - 2 || bx === o.bw - 2) t -= 0.2;
      let col = pick(o.pal, t);
      if (o.moss && c.v(x, y, 4, 3, 6) * 0.7 + c.n(x, y, 7) * 0.3 > o.moss) col = pick([0x3f5e25, 0x4c6b2c, 0x597a33, 0x67893b], c.n(x, y, 8));
      if (o.crack && crackAt(c, x, y)) col = H(o.mortar[0]);
      c.px(x, y, col);
    });
  }
  function crackAt(c, x, y) { const a = Math.abs((x * 0.9 + y * 0.6 + c.v(x, y, 4, 4, 9) * 5) % 9 - 4.5) < 0.5; return a && c.n(x, y, 11) > 0.35; }
  function planks(c, pal, seam) {
    c.each((x, y) => {
      const row = y >> 2, by = y & 3, jx = [3, 11, 7, 14][row];
      let t = 0.5 + (c.v(x, row * 4, 8, 1, row) - 0.5) * 0.45 + (c.n(x, y, 2) - 0.5) * 0.2;
      if (c.n(x >> 1, y, 3) < 0.13) t -= 0.25;
      if (by === 0) t += 0.1;
      let col = pick(pal, t);
      if (by === 3) col = H(seam);
      if (x === jx && by < 3) col = mul(H(seam), 1.1);
      c.px(x, y, col);
    });
  }
  function bark(c, pal, k) {
    c.each((x, y) => {
      const stripe = c.v(x, y, 1, 8, k) * 0.6 + c.n(x, y >> 2, k) * 0.4;
      let t = stripe; if (c.n(x, y, k + 1) > 0.9) t -= 0.3; if (x % 4 === 0 && c.n(x, y >> 1, k + 2) > 0.5) t -= 0.25;
      c.px(x, y, pick(pal, t));
    });
  }
  function logTop(c, ring, barkPal, k) {
    c.each((x, y) => {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      if (edge) { c.px(x, y, pick(barkPal, c.n(x, y, k))); return; }
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) + c.n(x, y, k) * 0.6;
      const r = Math.floor(d) % 2;
      c.px(x, y, mul(H(ring[r]), 0.92 + c.n(x, y, k + 1) * 0.16));
    });
  }
  function leaves(c, k, holes, base) {
    c.each((x, y) => {
      const t = c.n(x, y, k), b = c.v(x, y, 4, 4, k);
      if (t < (holes || 0.22) && b < 0.6) { c.px(x, y, [0, 0, 0], 0); return; }
      const v = base ? null : 0.45 + b * 0.35 + (t - 0.5) * 0.25;
      if (base) c.px(x, y, mul(H(base), 0.75 + b * 0.35 + (t - 0.5) * 0.2)); else c.px(x, y, [v * 255, v * 255, v * 255]);
    });
  }
  // ore spots (in clumps of 2-4 pixels) on a base texture
  function ore(c, base, pal, k, n) {
    c.copy(base);
    const spots = n || 5;
    for (let s = 0; s < spots; s++) {
      const cx = 2 + Math.floor(c.n(s, 1, k) * 12), cy = 2 + Math.floor(c.n(s, 2, k) * 12), sz = 2 + Math.floor(c.n(s, 3, k) * 3);
      for (let i = 0; i < sz; i++) {
        const x = cx + Math.floor(c.n(s, i + 5, k) * 3) - 1, y = cy + Math.floor(c.n(s, i + 9, k) * 3) - 1;
        c.px(x, y, H(pal[1])); c.px(x + 1, y, H(pal[0])); if (i % 2) c.px(x, y + 1, H(pal[2] || pal[1]));
      }
    }
  }
  // flat colour block with a light rim and dark lower-right rim (iron, gold, diamond... blocks)
  function metal(c, col, k, style) {
    const b = H(col);
    c.each((x, y) => {
      let f = 1 + (c.n(x, y, k) - 0.5) * 0.08;
      if (style === 'rim') { if (x === 0 || y === 0) f = 1.25; else if (x === 15 || y === 15) f = 0.7; else if ((x === 1 || y === 1)) f = 1.08; }
      if (style === 'bars') { if (y % 8 === 0) f = 1.22; else if (y % 8 === 7) f = 0.72; if (x % 16 === 0) f *= 1.1; }
      c.px(x, y, mul(b, f));
    });
  }
  function wool(c, col, k) {
    const b = H(col);
    c.each((x, y) => { const w = ((x + y * 2) % 4 === 0 ? 0.93 : 1) * ((x * 2 + y) % 6 === 0 ? 1.05 : 1); c.px(x, y, mul(b, w * (0.94 + c.n(x, y, k) * 0.12))); });
  }
  function grain(c, col, amt, k) { const b = H(col); c.each((x, y) => c.px(x, y, mul(b, 1 + (c.n(x, y, k) - 0.5) * amt))); }
  function crossPlant(c, draw) { c.clear(); draw(c); }
  // a flower: stem and leaves at the bottom, a head of petals
  function flower(c, petal, centre, o) {
    o = o || {};
    c.clear();
    const stem = H(0x3f7a26), leaf = H(0x5c9c2e);
    const top = o.top || 4;
    for (let y = top + 3; y < 16; y++) c.px(7 + (y > 12 && o.bend ? 1 : 0), y, stem);
    c.px(6, 11, leaf); c.px(5, 10, leaf); c.px(8, 12, leaf); c.px(9, 11, leaf); c.px(10, 10, leaf);
    const P = H(petal), C = H(centre || petal);
    if (o.shape === 'tulip') { c.rect(6, top, 8, top + 3, P); c.px(5, top, P); c.px(9, top, P); c.px(7, top - 1, mul(P, 1.15)); c.px(7, top + 1, mul(P, 0.8)); }
    else if (o.shape === 'cluster') { for (const [dx, dy] of [[0, 0], [2, 1], [-2, 1], [1, -1], [-1, 2], [1, 3], [-2, -1]]) { c.px(7 + dx, top + 2 + dy, P); c.px(8 + dx, top + 2 + dy, mul(P, 0.85)); } }
    else if (o.shape === 'bell') { for (const [x, y] of [[5, top + 2], [9, top + 3], [7, top]]) { c.px(x, y, P); c.px(x, y + 1, mul(P, 0.85)); c.px(x + 1, y + 1, P); } }
    else if (o.shape === 'ball') { for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) c.px(7 + x, top + 2 + y, (x + y) % 2 ? P : mul(P, 0.85)); }
    else { for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) c.px(7 + dx, top + 2 + dy, (dx + dy) % 2 ? P : mul(P, 0.88)); c.px(7, top + 2, C); }
  }
  function sapling(c, leafCol, trunkCol, k, shape) {
    c.clear();
    const L = H(leafCol), T = H(trunkCol);
    for (let y = 9; y < 16; y++) c.px(7 + (y < 12 ? 0 : 0), y, T);
    c.px(8, 12, T);
    for (let i = 0; i < 26; i++) { const x = 3 + Math.floor(c.n(i, 1, k) * 10), y = 1 + Math.floor(c.n(i, 2, k) * (shape === 'tall' ? 11 : 9)); const dx = x - 7.5, dy = y - 5; if (dx * dx / 25 + dy * dy / 20 < 1) c.px(x, y, mul(L, 0.8 + c.n(i, 3, k) * 0.4)); }
  }
  function cropStage(c, stage, max, col, ripe) {
    c.clear();
    const h = 3 + Math.floor((stage + 1) / (max + 1) * 12);
    const G = H(col);
    for (const x of [2, 5, 8, 11, 13]) { const hh = h - Math.floor(c.n(x, 1, 3) * 3); for (let y = 15; y > 15 - hh; y--) c.px(x + ((y + x) % 3 === 0 ? 1 : 0), y, mul(G, 0.8 + c.n(x, y, 4) * 0.3)); if (ripe && stage === max) { c.px(x, 15 - hh, H(ripe)); c.px(x + 1, 16 - hh, H(ripe)); } }
  }
  function glassPane(c, col, a) {
    const b = H(col);
    c.each((x, y) => {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      if (edge) { c.px(x, y, mul(b, 0.9), 255); return; }
      const streak = (x === y + 2 || x === y + 3 || x + 5 === y) && x > 2 && x < 13;
      c.px(x, y, streak ? mul(b, 1.1) : b, streak ? Math.min(255, a + 60) : a);
    });
  }
  const CLR = { white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f, pink: 0xf38baa, gray: 0x474f52, light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa, brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21 };
  const WOOL = { white: 0xe9ecec, orange: 0xf07613, magenta: 0xbd44b3, light_blue: 0x3aafd9, yellow: 0xf8c627, lime: 0x70b919, pink: 0xed8dac, gray: 0x3e4447, light_gray: 0x8e8e86, cyan: 0x158991, purple: 0x792aac, blue: 0x35399d, brown: 0x724728, green: 0x546d1b, red: 0xa12722, black: 0x141519 };
  const TERRA = { white: 0xd1b2a1, orange: 0xa15325, magenta: 0x95576c, light_blue: 0x706c8a, yellow: 0xba8523, lime: 0x677534, pink: 0xa04d4e, gray: 0x392a23, light_gray: 0x876a61, cyan: 0x575b5b, purple: 0x764656, blue: 0x4a3b5b, brown: 0x4d3323, green: 0x4c532a, red: 0x8e3c2e, black: 0x251610 };
  const CONCRETE = { white: 0xcfd5d6, orange: 0xe06100, magenta: 0xa9309f, light_blue: 0x2389c6, yellow: 0xf0af15, lime: 0x5ea818, pink: 0xd5658e, gray: 0x36393d, light_gray: 0x7d7d73, cyan: 0x157788, purple: 0x64209c, blue: 0x2c2e8f, brown: 0x603b1f, green: 0x495b24, red: 0x8e2020, black: 0x080a0f };
  const WOOD = {
    oak: { planks: [0x7c6035, 0x8f7140, 0xa2834f, 0xb08f58, 0xbc9862], seam: 0x6b5128, bark: [0x4b3820, 0x5a4428, 0x6b5233, 0x7a603c], ring: [0xb4925c, 0x9c7a49], leaf: null, sap: 0x4f8a25 },
    spruce: { planks: [0x553d22, 0x5f4527, 0x6f512f, 0x7a5a35, 0x84623a], seam: 0x45311a, bark: [0x2b1d0f, 0x34240f, 0x3e2b16, 0x4a341c], ring: [0x6e512f, 0x5a4125], leaf: 0x619961, sap: 0x31502f },
    birch: { planks: [0xa59366, 0xb4a274, 0xc4b17f, 0xcfbe8a, 0xd8c795], seam: 0x9a875a, bark: [0xd8d7d2, 0xe4e2db, 0xcfcdc5, 0xc2bfb7], ring: [0xd4c38d, 0xc0ad78], leaf: 0x80a755, sap: 0x6a8d3a },
    jungle: { planks: [0x83573a, 0x92623f, 0xa07351, 0xae7c58, 0xb98863], seam: 0x6e472f, bark: [0x3f2f12, 0x4c3a17, 0x58451c, 0x655224], ring: [0xa57a52, 0x8c6442], leaf: null, sap: 0x3e7b1a },
    acacia: { planks: [0x8e4a29, 0x9c512c, 0xad5d32, 0xb96638, 0xc56f3e], seam: 0x7a3e21, bark: [0x4f4b44, 0x5c574f, 0x6a645a, 0x787166], ring: [0xb1653a, 0x95512c], leaf: null, sap: 0x61831f },
    dark_oak: { planks: [0x301e10, 0x382313, 0x42291a, 0x4c301e, 0x553621], seam: 0x26170b, bark: [0x2b2012, 0x342716, 0x3d2e1b, 0x46351f], ring: [0x4a321f, 0x3a2717], leaf: null, sap: 0x2b5a14 },
    mangrove: { planks: [0x632d2a, 0x6e322e, 0x773934, 0x81403a, 0x8b4640], seam: 0x552522, bark: [0x45382a, 0x524233, 0x5a4a2e, 0x665538], ring: [0x7a3d36, 0x66302b], leaf: null, sap: 0x5d8a2f },
    cherry: { planks: [0xc79a92, 0xd6a69d, 0xe2b1a9, 0xe9bcb3, 0xeec6bd], seam: 0xb48780, bark: [0x2e1820, 0x3a2129, 0x452832, 0x50303a], ring: [0xdfa9a0, 0xc79088], leaf: 0xe8a4c4, sap: 0xd682a7 },
    crimson: { planks: [0x5a2a3f, 0x632f45, 0x6a344b, 0x753a53, 0x7e405a], seam: 0x4b2033, bark: [0x4a1622, 0x5c1d2a, 0x6b2433, 0x942a3f], ring: [0x7a3d55, 0x5e2b40], leaf: null, sap: 0xa52a2a },
    warped: { planks: [0x235853, 0x285f5a, 0x2b6963, 0x31736c, 0x378079], seam: 0x1c4844, bark: [0x2a2a3c, 0x3a3a4d, 0x4a2f5c, 0x16858a], ring: [0x3b7b73, 0x2a5f59], leaf: null, sap: 0x16a08a },
    bamboo: { planks: [0xa69343, 0xb39e4a, 0xc1ad50, 0xcbb758, 0xd5c161], seam: 0x8c7b34, bark: [0x5d7a1e, 0x6a8a24, 0x76962a, 0x83a332], ring: [0xc5b35a, 0xae9b45], leaf: null, sap: 0x6b8a22 },
  };
  // ---------------------------------------------------------------- terrain
  def('stone', c => stone(c, STONE, 1));
  def('smooth_stone', c => { grain(c, 0x9e9e9e, 0.06, 2); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x8c8c8c)); }); });
  def('smooth_stone_slab_side', c => { grain(c, 0xa6a6a6, 0.06, 3); c.each((x, y) => { if (y === 0 || y === 7 || y === 8 || y === 15) c.px(x, y, H(y === 7 || y === 15 ? 0x7a7a7a : 0xb4b4b4)); }); });
  def('granite', c => c.each((x, y) => { const t = c.n(x, y, 4) * 0.6 + c.v(x, y, 2, 2, 4) * 0.4; c.px(x, y, pick([0x7d5444, 0x8c5f4c, 0x9a6b56, 0xa47661, 0xb5826c, 0x6b4637], t)); }));
  def('polished_granite', c => { c.each((x, y) => { const t = c.v(x, y, 4, 4, 5) * 0.6 + c.n(x, y, 5) * 0.4; c.px(x, y, pick([0x8a5a48, 0x95634f, 0x9f6b56, 0xa8735d], t)); }); bevel(c, 1.12, 0.8); });
  def('diorite', c => c.each((x, y) => { const t = c.n(x, y, 6) * 0.7 + c.v(x, y, 2, 2, 6) * 0.3; c.px(x, y, pick([0x7d7d7f, 0x9b9b9d, 0xb5b5b7, 0xc6c6c8, 0xd6d6d8, 0xe6e6e6], t)); }));
  def('polished_diorite', c => { c.each((x, y) => { const t = c.v(x, y, 4, 4, 7) * 0.6 + c.n(x, y, 7) * 0.4; c.px(x, y, pick([0xb3b3b5, 0xbfbfc1, 0xcacacc, 0xd4d4d6], t)); }); bevel(c, 1.08, 0.82); });
  def('andesite', c => c.each((x, y) => { const t = c.n(x, y, 8) * 0.65 + c.v(x, y, 2, 2, 8) * 0.35; c.px(x, y, pick([0x6c6c6e, 0x7a7a7c, 0x868688, 0x8f8f91, 0x9b9b9d, 0xa9a9ab], t)); }));
  def('polished_andesite', c => { c.each((x, y) => { const t = c.v(x, y, 4, 4, 9) * 0.6 + c.n(x, y, 9) * 0.4; c.px(x, y, pick([0x7c7d7f, 0x858688, 0x8e8f91, 0x97989a], t)); }); bevel(c, 1.1, 0.8); });
  function bevel(c, hi, lo) { c.each((x, y) => { const p = c.get(x, y); if (x === 0 || y === 0) c.px(x, y, mul(p, hi)); else if (x === 15 || y === 15) c.px(x, y, mul(p, lo)); }); }
  const DEEP = [0x3a3a3f, 0x434348, 0x4b4b50, 0x535358, 0x5c5c61, 0x67676c];
  def('deepslate', c => c.each((x, y) => { const t = c.v(x, y, 8, 2, 12) * 0.55 + c.n(x, y, 12) * 0.45; c.px(x, y, pick(DEEP, t)); }));
  def('deepslate_top', c => c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); const t = c.n(x, y, 13) * 0.6 + (Math.floor(d) % 3 === 0 ? 0.1 : 0.4); c.px(x, y, pick(DEEP, t)); }));
  def('cobbled_deepslate', c => cobble(c, 14, [0x2f2f34, 0x3c3c41, 0x48484d, 0x55555a, 0x626267], [0x232327, 0x2c2c30], 12));
  def('polished_deepslate', c => { c.each((x, y) => { const t = c.v(x, y, 4, 4, 15) * 0.5 + c.n(x, y, 15) * 0.5; c.px(x, y, pick([0x47474c, 0x4e4e53, 0x56565b, 0x5d5d62], t)); }); bevel(c, 1.15, 0.75); });
  def('deepslate_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x3f3f44, 0x47474c, 0x505055, 0x58585d, 0x606065], mortar: [0x2b2b2f, 0x323236] }));
  def('cracked_deepslate_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x3f3f44, 0x47474c, 0x505055, 0x58585d, 0x606065], mortar: [0x252528, 0x2b2b2f], crack: true }));
  def('deepslate_tiles', c => bricks(c, { rh: 4, bw: 4, off: 0, pal: [0x37373b, 0x3e3e42, 0x45454a, 0x4c4c51], mortar: [0x252528, 0x2b2b2f] }));
  def('cracked_deepslate_tiles', c => bricks(c, { rh: 4, bw: 4, off: 0, pal: [0x37373b, 0x3e3e42, 0x45454a, 0x4c4c51], mortar: [0x1f1f22, 0x252528], crack: true }));
  def('chiseled_deepslate', c => { c.copy('polished_deepslate'); c.rect(3, 3, 12, 12, H(0x3a3a3f)); c.rect(5, 5, 10, 10, H(0x56565b)); c.rect(7, 7, 8, 8, H(0x3a3a3f)); });
  def('reinforced_deepslate_side', c => { c.copy('deepslate'); c.each((x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13) c.px(x, y, H((x + y) % 3 ? 0x6b6155 : 0x544a3f)); }); });
  def('reinforced_deepslate_top', c => { c.copy('reinforced_deepslate_side'); c.rect(6, 6, 9, 9, H(0x7b9a8a)); });
  def('reinforced_deepslate_bottom', c => c.copy('reinforced_deepslate_side'));
  def('tuff', c => c.each((x, y) => { const t = c.n(x, y, 16) * 0.6 + c.v(x, y, 3, 3, 16) * 0.4; c.px(x, y, pick([0x585a52, 0x63655c, 0x6c6e65, 0x76786e, 0x83857a], t)); }));
  def('calcite', c => c.each((x, y) => { const t = c.n(x, y, 17) * 0.5 + c.v(x, y, 4, 4, 17) * 0.5; c.px(x, y, pick([0xcfd0cc, 0xd9dad6, 0xe0e1dd, 0xe8e9e5, 0xc2c3be], t)); }));
  def('dripstone_block', c => c.each((x, y) => { const t = c.v(x, y, 2, 8, 18) * 0.6 + c.n(x, y, 18) * 0.4; c.px(x, y, pick([0x6b5446, 0x7a6152, 0x86695b, 0x957768, 0xa38576], t)); }));
  def('pointed_dripstone_down_tip', c => { c.clear(); for (let y = 0; y < 16; y++) { const w = Math.max(0, 3 - Math.floor(y / 5)); for (let x = 8 - w; x <= 7 + w; x++) c.px(x, y, pick([0x7a6152, 0x86695b, 0x957768], c.n(x, y, 19))); } });
  def('cobblestone', c => cobble(c, 20, [0x585858, 0x6c6c6c, 0x7c7c7c, 0x8e8e8e, 0xa5a5a5], [0x3f3f3f, 0x4a4a4a]));
  def('mossy_cobblestone', c => { c.copy('cobblestone'); c.each((x, y) => { if (c.v(x, y, 4, 4, 21) * 0.7 + c.n(x, y, 21) * 0.3 > 0.55) c.px(x, y, pick([0x3f5e25, 0x4c6b2c, 0x597a33, 0x67893b], c.n(x, y, 22))); }); });
  def('bedrock', c => c.each((x, y) => { const t = c.n(x, y, 23) * 0.6 + c.v(x, y, 4, 4, 23) * 0.4; c.px(x, y, pick([0x222222, 0x333333, 0x4a4a4a, 0x5f5f5f, 0x7a7a7a, 0x929292], t)); }));
  def('dirt', c => dirt(c, 24));
  def('coarse_dirt', c => { dirt(c, 25); c.each((x, y) => { if (c.n(x, y, 26) > 0.82) c.px(x, y, H(c.n(x, y, 27) > 0.5 ? 0x7b7b7b : 0x5a5a5a)); }); });
  def('rooted_dirt', c => { dirt(c, 28); for (let i = 0; i < 6; i++) { let x = Math.floor(c.n(i, 1, 29) * 16), y = Math.floor(c.n(i, 2, 29) * 16); for (let j = 0; j < 4; j++) { c.px(x, y, H(0xc49a6c)); x += c.n(i, j, 30) > 0.5 ? 1 : 0; y++; } } });
  // grass: the top and the overhang are grey and take the biome colour
  const grassGrey = (c, x, y, k) => { const t = 0.62 + c.v(x, y, 4, 4, k) * 0.18 + (c.n(x, y, k) - 0.5) * 0.22; return [t * 255, t * 255, t * 255]; };
  def('grass_block_top', c => { c.tintMask(); c.each((x, y) => c.px(x, y, grassGrey(c, x, y, 31), 0)); });
  def('grass_block_side', c => {
    c.tintMask(); dirt(c, 24);
    for (let x = 0; x < 16; x++) { let d = 3 + (c.n(x, 0, 32) < 0.45 ? 1 : 0) + (c.n(x, 1, 32) < 0.2 ? 1 : 0); for (let y = 0; y < d; y++) c.px(x, y, grassGrey(c, x, y, 33), 0); }
  });
  def('grass_block_snow', c => { dirt(c, 24); for (let x = 0; x < 16; x++) { let d = 3 + (c.n(x, 0, 34) < 0.45 ? 1 : 0) + (c.n(x, 1, 34) < 0.2 ? 1 : 0); for (let y = 0; y < d; y++) c.px(x, y, mul(H(0xf4fbfb), 0.95 + c.n(x, y, 35) * 0.06)); } });
  def('podzol_top', c => c.each((x, y) => { const t = c.n(x, y, 36) * 0.6 + c.v(x, y, 3, 3, 36) * 0.4; c.px(x, y, pick([0x4a2f13, 0x5a3a18, 0x6a461f, 0x7a5326, 0x8b6034, 0x3b250f], t)); }));
  def('podzol_side', c => { dirt(c, 24); for (let x = 0; x < 16; x++) { const d = 3 + (c.n(x, 0, 37) < 0.4 ? 1 : 0); for (let y = 0; y < d; y++) c.px(x, y, pick([0x4a2f13, 0x5a3a18, 0x6a461f, 0x7a5326], c.n(x, y, 38))); } });
  def('mycelium_top', c => c.each((x, y) => { const t = c.n(x, y, 39) * 0.7 + c.v(x, y, 4, 4, 39) * 0.3; c.px(x, y, pick([0x5c5059, 0x6a5c66, 0x776a73, 0x857883, 0x958894, 0x9f8a9b], t)); }));
  def('mycelium_side', c => { dirt(c, 24); for (let x = 0; x < 16; x++) { const d = 3 + (c.n(x, 0, 40) < 0.45 ? 1 : 0); for (let y = 0; y < d; y++) c.px(x, y, pick([0x6a5c66, 0x776a73, 0x857883], c.n(x, y, 41))); } });
  def('dirt_path_top', c => c.each((x, y) => { const t = c.n(x, y, 42) * 0.6 + c.v(x, y, 3, 3, 42) * 0.4; c.px(x, y, pick([0x7d6136, 0x8a6b3d, 0x947444, 0x9d7c4a, 0xa98652, 0x6b532d], t)); }));
  def('dirt_path_side', c => { dirt(c, 24); for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) c.px(x, y, pick([0x8a6b3d, 0x947444, 0x9d7c4a], c.n(x, y, 43))); });
  def('farmland', c => c.each((x, y) => { const row = (y >> 2) % 2; const t = c.n(x, y, 44) * 0.6 + (row ? 0.15 : 0.4) + ((y & 3) === 0 ? -0.2 : 0); c.px(x, y, pick([0x4e3420, 0x5d3e27, 0x6b482d, 0x7a5335, 0x8a5f3d], t)); }));
  def('farmland_moist', c => { c.copy('farmland'); c.each((x, y) => c.px(x, y, mul(c.get(x, y), 0.62))); });
  def('mud', c => c.each((x, y) => { const t = c.n(x, y, 45) * 0.5 + c.v(x, y, 4, 4, 45) * 0.5; c.px(x, y, pick([0x2f2a2a, 0x37302f, 0x3c3837, 0x45403e, 0x4d4846], t)); }));
  def('packed_mud', c => c.each((x, y) => { const t = c.n(x, y, 46) * 0.6 + c.v(x, y, 4, 4, 46) * 0.4; c.px(x, y, pick([0x7d5d43, 0x8a674b, 0x8e6b4f, 0x9b7657, 0xa47e5d], t)); }));
  def('mud_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x7d6048, 0x89694f, 0x957357, 0x9f7c5f], mortar: [0x5f4632, 0x684d37] }));
  def('clay', c => c.each((x, y) => { const t = c.n(x, y, 47) * 0.5 + c.v(x, y, 4, 4, 47) * 0.5; c.px(x, y, pick([0x8f95a3, 0x9aa0ad, 0xa1a7b4, 0xa8aebb, 0xb1b6c2], t)); }));
  def('gravel', c => { const pts = cells(c, 22, 48); c.each((x, y) => { const v = voro(pts, x, y); let t = 0.25 + v.p[2] * 0.6 + (-v.dx - v.dy) / (v.d1 + 2) * 0.2; if (v.edge < 0.6) t = 0.08; c.px(x, y, pick([0x4f4a48, 0x5e5856, 0x6e6866, 0x7f7a77, 0x8f8a87, 0x9e9896, 0xb3aeab], t)); }); });
  def('suspicious_gravel_0', c => c.copy('gravel'));
  def('suspicious_gravel', c => { c.copy('gravel'); c.rect(6, 6, 9, 9, H(0xa48c5c)); });
  const SAND = [0xc9bd8a, 0xd2c693, 0xdbcfa3, 0xe0d5aa, 0xe6dcb3, 0xd6c99a];
  def('sand', c => c.each((x, y) => { const t = c.n(x, y, 49) * 0.7 + c.v(x, y, 4, 4, 49) * 0.3; c.px(x, y, pick(SAND, t)); }));
  def('suspicious_sand', c => { c.copy('sand'); c.rect(6, 6, 9, 9, H(0xc2a37a)); });
  const RSAND = [0xa04f1c, 0xab561f, 0xb65f24, 0xbe6629, 0xc66d2d, 0xb15b21];
  def('red_sand', c => c.each((x, y) => { const t = c.n(x, y, 50) * 0.7 + c.v(x, y, 4, 4, 50) * 0.3; c.px(x, y, pick(RSAND, t)); }));
  const sandstoneSide = (c, pal, k) => c.each((x, y) => { let t = c.n(x, y, k) * 0.4 + 0.35; if (y < 4) t += 0.25; if (y === 3 || y === 11) t -= 0.35; if (y > 11) t = c.n(x, y, k) * 0.5 + 0.1; c.px(x, y, pick(pal, t)); });
  const SST = [0xb6a676, 0xc5b582, 0xd1c18e, 0xd9ca97, 0xe0d3a1];
  def('sandstone', c => sandstoneSide(c, SST, 51));
  def('sandstone_top', c => c.each((x, y) => c.px(x, y, pick(SST, 0.5 + (c.n(x, y, 52) - 0.5) * 0.4 + (c.v(x, y, 4, 4, 52) - 0.5) * 0.3))));
  def('sandstone_bottom', c => c.each((x, y) => c.px(x, y, pick(SST, c.n(x, y, 53) * 0.6 + 0.15))));
  def('cut_sandstone', c => { c.copy('sandstone_top'); c.each((x, y) => { if (y === 0 || y === 8) c.px(x, y, H(0xe0d3a1)); if (y === 7 || y === 15) c.px(x, y, H(0xb6a676)); }); });
  def('chiseled_sandstone', c => { c.copy('cut_sandstone'); c.rect(4, 4, 11, 11, H(0xc5b582)); c.rect(6, 6, 9, 9, H(0xb6a676)); c.px(7, 5, H(0xb6a676)); c.px(8, 10, H(0xb6a676)); });
  const RSST = [0x8f4419, 0x9c4c1e, 0xa85423, 0xb55c27, 0xbe642c];
  def('red_sandstone', c => sandstoneSide(c, RSST, 54));
  def('red_sandstone_top', c => c.each((x, y) => c.px(x, y, pick(RSST, 0.5 + (c.n(x, y, 55) - 0.5) * 0.4 + (c.v(x, y, 4, 4, 55) - 0.5) * 0.3))));
  def('red_sandstone_bottom', c => c.each((x, y) => c.px(x, y, pick(RSST, c.n(x, y, 56) * 0.6 + 0.15))));
  def('cut_red_sandstone', c => { c.copy('red_sandstone_top'); c.each((x, y) => { if (y === 0 || y === 8) c.px(x, y, H(0xbe642c)); if (y === 7 || y === 15) c.px(x, y, H(0x8f4419)); }); });
  def('chiseled_red_sandstone', c => { c.copy('cut_red_sandstone'); c.rect(4, 4, 11, 11, H(0x9c4c1e)); c.rect(6, 6, 9, 9, H(0x8f4419)); });
  def('obsidian', c => c.each((x, y) => { const t = c.n(x, y, 57) * 0.5 + c.v(x, y, 4, 4, 57) * 0.5; let col = pick([0x0f0d18, 0x14121d, 0x1b1726, 0x221c30, 0x2c2440], t); if (c.n(x, y, 58) > 0.93) col = H(0x4a3a6a); c.px(x, y, col); }));
  def('crying_obsidian', c => { c.copy('obsidian'); c.each((x, y) => { if (c.v(x, y, 4, 4, 59) > 0.68 && c.n(x, y, 59) > 0.3) c.px(x, y, pick([0x6a17c6, 0x8a2fe0, 0xa64ff0], c.n(x, y, 60))); }); });
  def('ice', c => c.each((x, y) => { const streak = Math.abs(((x - y) & 15) - 8) < 1 && c.n(x, y, 61) > 0.3; c.px(x, y, streak ? H(0xc9dbff) : mul(H(0x8fb0f5), 0.95 + c.n(x, y, 62) * 0.1), 160); }));
  def('packed_ice', c => c.each((x, y) => { const streak = Math.abs(((x - y) & 15) - 8) < 1; c.px(x, y, streak ? H(0xb5ccf7) : mul(H(0x8daef0), 0.95 + c.n(x, y, 63) * 0.1)); }));
  def('blue_ice', c => c.each((x, y) => { const streak = Math.abs(((x + y) & 15) - 8) < 1; c.px(x, y, streak ? H(0x9dc0fb) : mul(H(0x74a5f7), 0.93 + c.n(x, y, 64) * 0.12)); }));
  def('snow', c => c.each((x, y) => c.px(x, y, mul(H(0xf2f8f8), 0.96 + c.n(x, y, 65) * 0.06 - (c.n(x, y, 66) > 0.93 ? 0.06 : 0)))));
  def('powder_snow', c => c.each((x, y) => c.px(x, y, mul(H(0xf4fafa), 0.95 + c.n(x, y, 67) * 0.06))));
  def('moss_block', c => c.each((x, y) => { const t = c.n(x, y, 68) * 0.6 + c.v(x, y, 4, 4, 68) * 0.4; c.px(x, y, pick([0x48601f, 0x536b26, 0x5b752b, 0x637e30, 0x6c8a36], t)); }));
  def('magma', c => { c.each((x, y) => { const v = voro(cells(c, 9, 69), x, y); if (v.edge < 1.2) c.px(x, y, pick([0xff9a1e, 0xe8661a, 0xc84a12], c.n(x, y, 70))); else c.px(x, y, pick([0x6f2b10, 0x7d3212, 0x8b3a16, 0x5e2410], c.n(x, y, 71))); }); });
  def('amethyst_block', c => c.each((x, y) => { const v = voro(cells(c, 8, 72), x, y); c.px(x, y, pick([0x5f3c95, 0x7650b3, 0x8d63cd, 0xa47fe0, 0xc4a3f2], v.edge < 0.8 ? 0.1 : 0.3 + v.p[2] * 0.6)); }));
  def('budding_amethyst', c => { c.copy('amethyst_block'); c.rect(6, 6, 9, 9, H(0x3f2a6b)); });
  for (const [n, s] of [['small_amethyst_bud', 4], ['medium_amethyst_bud', 6], ['large_amethyst_bud', 8], ['amethyst_cluster', 11]]) def(n, c => { c.clear(); for (let y = 15; y > 15 - s; y--) { const w = Math.max(0, Math.floor((y - (15 - s)) / 3)); for (let x = 7 - w; x <= 8 + w; x++) c.px(x, y, pick([0x8d63cd, 0xa47fe0, 0xc4a3f2, 0xe2cdfa], c.n(x, y, 73))); } if (s > 6) { c.line(3, 15, 5, 15 - s + 4, H(0xa47fe0)); c.line(12, 15, 10, 15 - s + 4, H(0xa47fe0)); } });
  // ores
  const ORES = { coal: [0x2c2c2c, 0x111111, 0x464646], iron: [0xd8af93, 0xaf8e77, 0xe7c6ad], copper: [0xe07a5b, 0x57a06b, 0xb15a3d], gold: [0xfcee4b, 0xdfb53b, 0xfff7a0], redstone: [0xff0000, 0xa00000, 0xff5a5a], emerald: [0x17dd62, 0x009529, 0x7cf7a8], lapis: [0x1d47a6, 0x345ec3, 0x0f2e7a], diamond: [0x5decf5, 0x2fa0a5, 0xb6fffb] };
  for (const o in ORES) {
    def(o + '_ore', c => ore(c, 'stone', ORES[o], 74 + o.length, o === 'diamond' || o === 'emerald' ? 4 : 5));
    def('deepslate_' + o + '_ore', c => ore(c, 'deepslate', ORES[o], 90 + o.length, o === 'diamond' || o === 'emerald' ? 4 : 5));
  }
  def('nether_gold_ore', c => ore(c, 'netherrack', ORES.gold, 101, 6));
  def('nether_quartz_ore', c => ore(c, 'netherrack', [0xeae5de, 0xc9c2b6, 0xffffff], 102, 6));
  def('ancient_debris_side', c => c.each((x, y) => { const sw = Math.floor((y + Math.floor(c.v(x, y, 4, 4, 103) * 4)) / 4) % 2; c.px(x, y, pick(sw ? [0x5e4234, 0x6b4c3c, 0x7a5848] : [0x473128, 0x523a2f, 0x6a5045], c.n(x, y, 104))); }));
  def('ancient_debris_top', c => c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); c.px(x, y, pick([0x473128, 0x5e4234, 0x6b4c3c, 0x7a5848], (Math.floor(d) % 3) / 3 + c.n(x, y, 105) * 0.2)); }));
  def('raw_iron_block', c => cobble(c, 106, [0x8e6a51, 0xa6806a, 0xbf9a80, 0xd8b399], [0x6b4d39, 0x7a5a45], 7));
  def('raw_copper_block', c => cobble(c, 107, [0x9a4f35, 0xb15f42, 0xc87050, 0xdc8a66], [0x763a26, 0x844331], 7));
  def('raw_gold_block', c => cobble(c, 108, [0xb68a1f, 0xd2a628, 0xe8c23a, 0xf7dc5e], [0x8e6a14, 0x9b761a], 7));
  def('coal_block', c => metal(c, 0x1b1b1b, 109, 'rim'));
  def('iron_block', c => metal(c, 0xd8d8d8, 110, 'bars'));
  def('gold_block', c => metal(c, 0xf6d23c, 111, 'bars'));
  def('copper_block', c => metal(c, 0xc0704e, 112, 'rim'));
  def('exposed_copper', c => metal(c, 0xa27a63, 113, 'rim'));
  def('weathered_copper', c => metal(c, 0x6c9f74, 114, 'rim'));
  def('oxidized_copper', c => metal(c, 0x52a284, 115, 'rim'));
  def('cut_copper', c => bricks(c, { rh: 8, bw: 8, off: 0, pal: [0xa95d40, 0xb8684a, 0xc57454, 0xd2805e], mortar: [0x8a4a32, 0x96523a] }));
  def('emerald_block', c => { metal(c, 0x2fd669, 116, 'rim'); c.each((x, y) => { if ((x + y) % 4 === 0 && x > 1 && y > 1 && x < 14 && y < 14) c.px(x, y, H(0x9ef5bd)); }); });
  def('lapis_block', c => { c.each((x, y) => c.px(x, y, pick([0x1a3e8f, 0x214aa3, 0x2654b8, 0x2c5fc9, 0x3a6fd6], c.n(x, y, 117) * 0.7 + c.v(x, y, 4, 4, 117) * 0.3))); bevel(c, 1.15, 0.75); });
  def('diamond_block', c => { metal(c, 0x63dbd5, 118, 'rim'); c.each((x, y) => { if ((x * 3 + y) % 7 === 0 && x > 1 && y > 1 && x < 14 && y < 14) c.px(x, y, H(0xd8fffb)); }); });
  def('netherite_block', c => { c.each((x, y) => c.px(x, y, pick([0x2f2a2b, 0x3a3435, 0x433d3e, 0x4d4646], c.n(x, y, 119) * 0.5 + c.v(x, y, 4, 4, 119) * 0.5))); bevel(c, 1.3, 0.7); });
  def('redstone_block', c => { c.each((x, y) => c.px(x, y, pick([0x8e0e05, 0xa81308, 0xbe1a0b, 0xd02410, 0xe02f17], c.n(x, y, 120)))); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x700a03)); }); });
  // wood
  for (const w in WOOD) {
    const W = WOOD[w], stem = w === 'crimson' || w === 'warped', bam = w === 'bamboo';
    def(w + '_planks', c => planks(c, W.planks, W.seam));
    if (bam) {
      def('bamboo_planks', c => c.each((x, y) => { const col = x % 4 === 3 ? W.seam : W.planks[Math.floor(cl01(0.5 + (c.n(x, y >> 2, 5) - 0.5) * 0.6) * 5)]; c.px(x, y, H(col)); }));
      def('bamboo_block', c => c.each((x, y) => c.px(x, y, pick(W.bark, (x % 5 === 0 ? 0.1 : 0.5) + c.n(x, y, 6) * 0.4))));
      def('bamboo_block_top', c => { c.fill(H(0x6a8a24)); c.rect(3, 3, 12, 12, H(0xc5b35a)); c.rect(5, 5, 10, 10, H(0x8c7b34)); });
      def('bamboo_door_top', c => door(c, W, true, w)); def('bamboo_door_bottom', c => door(c, W, false, w)); def('bamboo_trapdoor', c => trapdoor(c, W, w));
      continue;
    }
    const lg = stem ? w + '_stem' : w + '_log';
    if (w === 'birch') def(lg, c => { c.each((x, y) => c.px(x, y, pick(W.bark, c.n(x, y, 7) * 0.6 + 0.2))); for (let i = 0; i < 7; i++) { const x = Math.floor(c.n(i, 1, 8) * 13), y = Math.floor(c.n(i, 2, 8) * 16), l = 2 + Math.floor(c.n(i, 3, 8) * 3); for (let k = 0; k < l; k++) c.px(x + k, y, H(k % 2 ? 0x3a3a35 : 0x22221f)); } });
    else if (stem) def(lg, c => { bark(c, W.bark.slice(0, 3), 9); c.each((x, y) => { if (c.v(x, y, 2, 6, 10) > 0.7) c.px(x, y, H(W.bark[3])); }); });
    else def(lg, c => bark(c, W.bark, 11 + w.length));
    def(lg + '_top', c => logTop(c, W.ring, W.bark, 12));
    def('stripped_' + lg, c => c.each((x, y) => { const t = c.v(x, y, 1, 8, 13) * 0.6 + c.n(x, y, 13) * 0.4; c.px(x, y, pick(W.planks, t)); }));
    def('stripped_' + lg + '_top', c => logTop(c, W.ring, W.planks.slice(1, 4), 14));
    if (!stem) {
      if (w === 'cherry') def('cherry_leaves', c => leaves(c, 15, 0.2, 0xe8a4c4));
      else def(w + '_leaves', c => leaves(c, 16 + w.length, 0.22));
      const sap = w === 'mangrove' ? 'mangrove_propagule' : w + '_sapling';
      def(sap, c => { if (w === 'mangrove') { c.clear(); for (let y = 2; y < 15; y++) c.px(7, y, H(0x5d8a2f)); c.rect(6, 0, 8, 3, H(0x6a9a35)); c.px(7, 15, H(0x3e5a20)); } else sapling(c, W.sap, W.bark[1], 17, w === 'spruce' ? 'tall' : null); });
    }
    // doors and trapdoors
    def(w + '_door_top', c => door(c, W, true, w));
    def(w + '_door_bottom', c => door(c, W, false, w));
    def(w + '_trapdoor', c => trapdoor(c, W, w));
  }
  function door(c, W, top, w) {
    const P = W.planks, frame = H(W.seam);
    c.each((x, y) => {
      if (x === 0 || x === 15 || (top ? y === 0 : y === 15)) { c.px(x, y, frame); return; }
      c.px(x, y, pick(P, 0.35 + (c.v(x, y, 1, 4, 18) - 0.5) * 0.4 + c.n(x, y, 18) * 0.25));
    });
    if (top && w !== 'iron') { for (let y = 2; y < 8; y++) for (let x = 2; x < 14; x++) if (x !== 7 && x !== 8 && y !== 4) c.px(x, y, w === 'oak' || w === 'jungle' || w === 'acacia' || w === 'cherry' || w === 'warped' || w === 'crimson' || w === 'mangrove' ? [0, 0, 0] : pick(P, 0.2), w === 'spruce' || w === 'dark_oak' || w === 'birch' || w === 'bamboo' ? 255 : 0); }
    if (!top) { c.rect(2, 2, 13, 2, frame); c.rect(2, 7, 13, 7, frame); c.px(12, 1, H(0x5a5a5a)); }
    else { c.px(12, 13, H(0x5a5a5a)); c.px(12, 14, H(0x3a3a3a)); }
  }
  function trapdoor(c, W, w) {
    const P = W.planks, frame = H(W.seam);
    c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || y === 7) c.px(x, y, frame); else c.px(x, y, pick(P, 0.4 + c.n(x, y, 19) * 0.3)); });
    if (w === 'oak' || w === 'jungle' || w === 'acacia' || w === 'mangrove' || w === 'cherry') for (const [x0, y0] of [[2, 2], [9, 2], [2, 9], [9, 9]]) for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) c.px(x, y, [0, 0, 0], 0);
  }
  def('iron_door_top', c => { const W = { planks: [0xb5b5b5, 0xc4c4c4, 0xd1d1d1, 0xdcdcdc, 0xe6e6e6], seam: 0x8c8c8c }; door(c, W, true, 'iron'); for (let y = 2; y < 8; y++) for (let x = 3; x < 13; x += 3) c.px(x, y, H(0x6a6a6a)); });
  def('iron_door_bottom', c => { const W = { planks: [0xb5b5b5, 0xc4c4c4, 0xd1d1d1, 0xdcdcdc, 0xe6e6e6], seam: 0x8c8c8c }; door(c, W, false, 'iron'); });
  def('iron_trapdoor', c => { trapdoor(c, { planks: [0xb5b5b5, 0xc4c4c4, 0xd1d1d1, 0xdcdcdc, 0xe6e6e6], seam: 0x8c8c8c }, 'iron'); for (let x = 2; x < 14; x += 3) for (let y = 2; y < 14; y++) if (y !== 7) c.px(x, y, H(0x8c8c8c)); });
  def('azalea_leaves', c => leaves(c, 120, 0.18, 0x5c7d2a));
  def('flowering_azalea_leaves', c => { leaves(c, 121, 0.18, 0x5c7d2a); for (let i = 0; i < 10; i++) { const x = Math.floor(c.n(i, 1, 122) * 15), y = Math.floor(c.n(i, 2, 122) * 15); c.px(x, y, H(0xd780c4)); c.px(x + 1, y, H(0xe7a4d8)); } });
  def('azalea_top', c => leaves(c, 123, 0.1, 0x6a8a30)); def('azalea_side', c => { leaves(c, 124, 0.3, 0x6a8a30); for (let y = 12; y < 16; y++) c.each((x) => { if (y > 12) c.px(x, y, [0, 0, 0], 0); }); });
  def('flowering_azalea_top', c => { c.copy('azalea_top'); for (let i = 0; i < 8; i++) c.px(Math.floor(c.n(i, 1, 125) * 15), Math.floor(c.n(i, 2, 125) * 15), H(0xd780c4)); });
  def('flowering_azalea_side', c => { c.copy('azalea_side'); for (let i = 0; i < 6; i++) c.px(Math.floor(c.n(i, 1, 126) * 15), Math.floor(c.n(i, 2, 126) * 11), H(0xd780c4)); });
  def('azalea_plant', c => { c.clear(); c.rect(7, 8, 8, 15, H(0x6b5233)); c.line(4, 8, 7, 12, H(0x6b5233)); c.line(11, 8, 8, 12, H(0x6b5233)); });
  // plants
  def('short_grass', c => { c.tintMask(); c.clear(); for (let x = 1; x < 15; x++) { const h = 4 + Math.floor(c.n(x, 1, 130) * 10); for (let y = 15; y > 15 - h; y--) if (c.n(x, y, 131) > 0.15) { const g = 0.55 + c.n(x, y, 132) * 0.35; c.px(x + (y < 15 - h / 2 && x % 3 === 0 ? (x < 8 ? -1 : 1) : 0), y, [g * 255, g * 255, g * 255]); } } });
  def('fern', c => { c.tintMask(); c.clear(); for (const [bx, dir] of [[7, 0], [4, -1], [11, 1]]) for (let i = 0; i < 12; i++) { const x = bx + Math.round(dir * i * 0.35), y = 15 - i; const g = 0.6 + c.n(i, bx, 133) * 0.3; c.px(x, y, [g * 255, g * 255, g * 255]); if (i % 2 && i > 2) { c.px(x - 1, y, [g * 230, g * 230, g * 230]); c.px(x + 1, y, [g * 230, g * 230, g * 230]); } } });
  def('dead_bush', c => { c.clear(); const B = H(0x6b4b1f); c.line(7, 15, 7, 9, B); c.line(7, 11, 3, 6, B); c.line(7, 10, 12, 5, B); c.line(5, 8, 5, 4, B); c.line(10, 7, 12, 9, B); c.line(3, 6, 2, 4, B); c.line(12, 5, 13, 3, B); });
  for (const n of ['tall_grass', 'large_fern']) {
    def(n + '_bottom', c => { c.tintMask(); c.clear(); for (let x = 1; x < 15; x++) for (let y = 0; y < 16; y++) if (c.n(x, y, 134) > 0.25 && (x % 2 || y > 4)) { const g = 0.55 + c.n(x, y, 135) * 0.35; c.px(x, y, [g * 255, g * 255, g * 255]); } });
    def(n + '_top', c => { c.tintMask(); c.clear(); for (let x = 1; x < 15; x++) { const h = 6 + Math.floor(c.n(x, 1, 136) * 10); for (let y = 15; y > 15 - h; y--) if (c.n(x, y, 137) > 0.25) { const g = 0.55 + c.n(x, y, 138) * 0.35; c.px(x, y, [g * 255, g * 255, g * 255]); } } });
  }
  def('dandelion', c => flower(c, 0xf7d117, 0xf0a20f, { shape: 'ball', top: 5 }));
  def('poppy', c => flower(c, 0xd8241b, 0x2a0e0a, { top: 4 }));
  def('blue_orchid', c => flower(c, 0x2ba4e6, 0x6fd0f5, { shape: 'cluster', top: 3 }));
  def('allium', c => flower(c, 0xb465e6, 0xd593f2, { shape: 'ball', top: 3 }));
  def('azure_bluet', c => flower(c, 0xe8edf2, 0xf7e05a, { shape: 'cluster', top: 5 }));
  def('red_tulip', c => flower(c, 0xd8301f, 0xd8301f, { shape: 'tulip', top: 4 }));
  def('orange_tulip', c => flower(c, 0xf07722, 0xf07722, { shape: 'tulip', top: 4 }));
  def('white_tulip', c => flower(c, 0xf2f2f2, 0xf2f2f2, { shape: 'tulip', top: 4 }));
  def('pink_tulip', c => flower(c, 0xf2a3c7, 0xf2a3c7, { shape: 'tulip', top: 4 }));
  def('oxeye_daisy', c => flower(c, 0xf5f5f5, 0xf7c51e, { top: 4 }));
  def('cornflower', c => flower(c, 0x4b6ce8, 0x2c45b8, { top: 4 }));
  def('lily_of_the_valley', c => flower(c, 0xf5f5f5, 0xf5f5f5, { shape: 'bell', top: 3 }));
  def('wither_rose', c => { flower(c, 0x2a2018, 0x111111, { top: 4 }); c.each((x, y) => { const p = c.get(x, y); if (p[3] && y > 6) c.px(x, y, mul(p, 0.5)); }); });
  def('torchflower', c => flower(c, 0xf28b1c, 0xf7d117, { shape: 'tulip', top: 3 }));
  def('pink_petals', c => { c.clear(); for (let i = 0; i < 14; i++) { const x = Math.floor(c.n(i, 1, 140) * 15), y = Math.floor(c.n(i, 2, 140) * 15); c.px(x, y, H(0xf5a6c7)); c.px(x + 1, y, H(0xe68ab0)); c.px(x, y + 1, H(0xf7b8d2)); } });
  def('pink_petals_stem', c => { c.clear(); c.rect(7, 10, 8, 15, H(0x5c8a2e)); });
  def('sunflower_bottom', c => { c.clear(); for (let y = 0; y < 16; y++) c.px(7, y, H(0x4f8a25)); c.line(7, 9, 3, 6, H(0x5c9c2e)); c.line(7, 12, 12, 9, H(0x5c9c2e)); });
  def('sunflower_top', c => { c.clear(); for (let y = 6; y < 16; y++) c.px(7, y, H(0x4f8a25)); });
  def('sunflower_front', c => { c.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 3.5) c.px(x, y, pick([0x4a2e14, 0x5c3a18, 0x6b451e], c.n(x, y, 141))); else if (d < 7.5 && c.n(x, y, 142) > 0.15) c.px(x, y, pick([0xf2c71d, 0xf7d43a, 0xe3b10f], c.n(x, y, 143))); } });
  def('sunflower_back', c => { c.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 7.5) c.px(x, y, d < 4 ? H(0x4f8a25) : H(0xe3b10f)); } });
  for (const [n, col] of [['lilac', 0xc996c8], ['rose_bush', 0xc8251c], ['peony', 0xe7b6e3]]) {
    def(n + '_bottom', c => { c.clear(); for (let x = 2; x < 14; x++) for (let y = 4; y < 16; y++) if (c.n(x, y, 144) > 0.45) c.px(x, y, pick([0x3f7a26, 0x4f8a2e, 0x5c9c34], c.n(x, y, 145))); for (let y = 0; y < 16; y++) c.px(7, y, H(0x3f7a26)); });
    def(n + '_top', c => { c.clear(); for (let x = 2; x < 14; x++) for (let y = 3; y < 16; y++) { const d = Math.hypot(x - 7.5, y - 8); if (d < 6 && c.n(x, y, 146) > 0.3) c.px(x, y, c.n(x, y, 147) > 0.4 ? mul(H(col), 0.85 + c.n(x, y, 148) * 0.3) : H(0x4f8a2e)); } });
  }
  def('brown_mushroom', c => { c.clear(); c.rect(7, 10, 8, 15, H(0xd8cbb0)); c.rect(4, 7, 11, 9, H(0x9a6f4f)); c.rect(5, 6, 10, 6, H(0xb18363)); });
  def('red_mushroom', c => { c.clear(); c.rect(7, 10, 8, 15, H(0xd8cbb0)); c.rect(4, 6, 11, 9, H(0xd21f1f)); c.rect(5, 5, 10, 5, H(0xe33a3a)); c.px(6, 7, H(0xffffff)); c.px(9, 6, H(0xffffff)); });
  def('brown_mushroom_block', c => c.each((x, y) => c.px(x, y, pick([0x8a6249, 0x956b51, 0x9e7458, 0xa77c60], c.n(x, y, 150)))));
  def('red_mushroom_block', c => { c.each((x, y) => c.px(x, y, pick([0xb1191a, 0xc11d1e, 0xcf2424], c.n(x, y, 151)))); for (const [x, y] of [[3, 3], [10, 4], [5, 10], [12, 11], [8, 7]]) c.rect(x, y, x + 1, y + 1, H(0xe8e2d5)); });
  def('mushroom_stem', c => c.each((x, y) => c.px(x, y, pick([0xc9c2b1, 0xd2cbb9, 0xdbd4c3, 0xcfc8b6], c.v(x, y, 1, 4, 152) * 0.5 + c.n(x, y, 152) * 0.5))));
  def('sugar_cane', c => { c.tintMask(); c.clear(); for (const bx of [3, 8, 12]) for (let y = 0; y < 16; y++) { const g = y % 6 === 0 ? 0.62 : 0.8 + c.n(bx, y, 153) * 0.15; c.px(bx, y, [g * 255, g * 255, g * 255]); c.px(bx + 1, y, [g * 230, g * 230, g * 230]); if (y % 6 === 2) c.px(bx + 2, y, [200, 200, 200]); } });
  def('cactus_side', c => { c.each((x, y) => { if (x === 0 || x === 15) { c.px(x, y, [0, 0, 0], 0); return; } c.px(x, y, pick([0x0f5a1b, 0x14682a, 0x1a7a32, 0x228838], (x % 4 === 1 ? 0.8 : 0.4) + c.n(x, y, 154) * 0.2)); }); for (let y = 2; y < 16; y += 4) { c.px(1, y, H(0xcfd6a8)); c.px(14, y + 2, H(0xcfd6a8)); c.px(5, y + 1, H(0xcfd6a8)); c.px(10, y + 3, H(0xcfd6a8)); } });
  def('cactus_top', c => { c.each((x, y) => c.px(x, y, pick([0x14682a, 0x1a7a32, 0x228838, 0x5c9c45], (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) > 5 ? 0.3 : 0.75) + c.n(x, y, 155) * 0.2))); c.each((x, y) => { if (x === 0 || x === 15 || y === 0 || y === 15) c.px(x, y, [0, 0, 0], 0); }); });
  def('cactus_bottom', c => { c.copy('cactus_top'); });
  def('bamboo_stalk', c => { c.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) c.px(x, y, pick([0x5d7a1e, 0x6a8a24, 0x76962a, 0x83a332], (y % 8 === 0 ? 0.05 : 0.5) + c.n(x, y, 156) * 0.4)); c.rect(13, 0, 15, 2, H(0x76962a)); });
  def('bamboo_small_leaves', c => { c.clear(); for (let i = 0; i < 12; i++) { const x = 4 + Math.floor(c.n(i, 1, 157) * 8), y = Math.floor(c.n(i, 2, 157) * 10); c.line(x, y, x + 2, y + 2, H(0x4a7a1e)); } });
  def('bamboo_large_leaves', c => { c.clear(); for (let i = 0; i < 18; i++) { const x = 1 + Math.floor(c.n(i, 1, 158) * 13), y = Math.floor(c.n(i, 2, 158) * 14); c.line(x, y, x + 3, y + 2, H(0x4a7a1e)); } });
  def('vine', c => { c.tintMask(); c.clear(); for (let i = 0; i < 6; i++) { let x = 1 + Math.floor(c.n(i, 1, 159) * 14); for (let y = 0; y < 16; y++) { if (c.n(i, y, 160) > 0.2) { const g = 0.55 + c.n(x, y, 161) * 0.35; c.px(x, y, [g * 255, g * 255, g * 255]); if (y % 3 === 0) c.px(x + 1, y, [g * 230, g * 230, g * 230]); } x += c.n(i, y, 162) > 0.7 ? 1 : c.n(i, y, 162) < 0.3 ? -1 : 0; x = Math.max(0, Math.min(15, x)); } } });
  def('glow_lichen', c => { c.clear(); for (let i = 0; i < 30; i++) { const x = Math.floor(c.n(i, 1, 163) * 16), y = Math.floor(c.n(i, 2, 163) * 16); c.px(x, y, pick([0x6f8d7c, 0x86a894, 0xa5d4b7], c.n(i, 3, 163))); } });
  def('lily_pad', c => { c.tintMask(); c.clear(); c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 7.5 && !(x > 7 && Math.abs(y - 7.5) < 1.2 && x < 15)) { const g = 0.55 + c.n(x, y, 164) * 0.3 + (d > 6 ? -0.1 : 0); c.px(x, y, [g * 255, g * 255, g * 255]); } }); });
  def('pumpkin_side', c => c.each((x, y) => { const ridge = x % 4 === 0; c.px(x, y, pick([0xb06514, 0xc17318, 0xd3801e, 0xe38f26], (ridge ? 0.1 : 0.55) + c.n(x, y, 165) * 0.3)); }));
  def('pumpkin_top', c => { c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); c.px(x, y, pick([0xb06514, 0xc17318, 0xd3801e, 0xe38f26], (Math.floor(d) % 4 === 0 ? 0.1 : 0.6) + c.n(x, y, 166) * 0.3)); }); c.rect(7, 7, 8, 8, H(0x5c4012)); });
  def('carved_pumpkin', c => { c.copy('pumpkin_side'); const D = H(0x3a2306); c.rect(3, 4, 5, 6, D); c.rect(10, 4, 12, 6, D); c.rect(3, 10, 12, 11, D); c.rect(4, 12, 11, 12, D); c.px(5, 9, D); c.px(10, 9, D); });
  def('jack_o_lantern', c => { c.copy('carved_pumpkin'); const L = H(0xf9d23a); c.rect(3, 4, 5, 6, L); c.rect(10, 4, 12, 6, L); c.rect(3, 10, 12, 11, L); c.rect(4, 12, 11, 12, H(0xf3b72b)); c.px(5, 9, L); c.px(10, 9, L); });
  def('melon_side', c => c.each((x, y) => { const stripe = (x + Math.floor(c.v(x, y, 2, 8, 167) * 3)) % 4 < 2; c.px(x, y, pick(stripe ? [0x5d8f1d, 0x6a9e24] : [0x8bbd2c, 0xa2c938], c.n(x, y, 168))); }));
  def('melon_top', c => c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); c.px(x, y, pick(Math.floor(d) % 3 ? [0x8bbd2c, 0xa2c938] : [0x5d8f1d, 0x6a9e24], c.n(x, y, 169))); }));
  def('stem', c => { c.tintMask(); c.clear(); for (let y = 0; y < 16; y++) { c.px(7, y, [200, 200, 200]); if (y % 4 === 1) { c.px(6, y, [170, 170, 170]); c.px(8, y + 1, [170, 170, 170]); } } });
  def('attached_stem', c => { c.tintMask(); c.clear(); for (let x = 0; x < 12; x++) c.px(x, 8 + (x > 8 ? -1 : 0), [200, 200, 200]); c.px(3, 7, [170, 170, 170]); c.px(7, 9, [170, 170, 170]); });
  for (let i = 0; i < 8; i++) def('wheat_stage' + i, c => cropStage(c, i, 7, i < 7 ? 0x6aa52c : 0xb59a42, i === 7 ? 0xd8b55c : null));
  for (let i = 0; i < 4; i++) {
    def('carrots_stage' + i, c => { cropStage(c, i, 3, 0x4f9a2a); if (i === 3) for (const x of [3, 9, 12]) c.px(x, 15, H(0xf08a1e)); });
    def('potatoes_stage' + i, c => { cropStage(c, i, 3, 0x4f8f2a); if (i === 3) for (const x of [3, 9, 12]) c.px(x, 15, H(0xc49a4a)); });
    def('beetroots_stage' + i, c => { cropStage(c, i, 3, 0x4f8f2a); if (i === 3) for (const x of [4, 10]) { c.px(x, 14, H(0xa52a3a)); c.px(x, 15, H(0x8c1d2d)); } });
    def('sweet_berry_bush_stage' + i, c => { c.clear(); for (let k = 0; k < 20 + i * 12; k++) { const x = 1 + Math.floor(c.n(k, 1, 170) * 14), y = 15 - Math.floor(c.n(k, 2, 170) * (5 + i * 3)); c.px(x, y, pick([0x2f5a2a, 0x3c6b31, 0x4a7a38], c.n(k, 3, 170))); } if (i >= 2) for (let k = 0; k < (i - 1) * 4; k++) c.px(2 + Math.floor(c.n(k, 4, 171) * 12), 15 - Math.floor(c.n(k, 5, 171) * (4 + i * 3)), H(i === 3 ? 0xc21c2a : 0x6a8a3a)); });
  }
  for (let i = 0; i < 3; i++) def('nether_wart_stage' + i, c => { c.clear(); for (let k = 0; k < 6 + i * 6; k++) { const x = 2 + Math.floor(c.n(k, 1, 172) * 12), y = 15 - Math.floor(c.n(k, 2, 172) * (3 + i * 4)); c.px(x, y, pick([0x8a1a1a, 0xa52222, 0x6b1414], c.n(k, 3, 172))); c.px(x, y + 1, H(0x6b1414)); } });
  for (let i = 0; i < 3; i++) def('cocoa_stage' + i, c => { c.clear(); const w = 4 + i * 2, h = 5 + i * 2; for (let y = 4; y < 4 + h; y++) for (let x = 11 - w; x < 11; x++) c.px(x, y, pick(i === 2 ? [0x8f4c1e, 0xa45a26, 0x7a3f17] : [0x7a8a2e, 0x8c9c34, 0x6a7a26], c.n(x, y, 173))); for (let x = 0; x < w; x++) for (let y = 0; y < w; y++) c.px(x, y, pick(i === 2 ? [0x8f4c1e, 0xa45a26] : [0x7a8a2e, 0x8c9c34], c.n(x, y, 174))); c.rect(12, 0, 15, 3, H(0x5a7a2a)); });
  def('kelp', c => { c.clear(); for (let y = 0; y < 16; y++) { const x = 7 + Math.round(Math.sin(y * 0.6) * 2); c.px(x, y, H(0x4f8a2e)); c.px(x + 1, y, H(0x3e7a24)); if (y % 4 === 0) { c.px(x - 1, y, H(0x5c9c34)); c.px(x + 2, y + 1, H(0x5c9c34)); } } });
  def('kelp_plant', c => c.copy('kelp'));
  def('seagrass', c => { c.clear(); for (let x = 2; x < 14; x += 2) { const h = 8 + Math.floor(c.n(x, 1, 175) * 8); for (let y = 15; y > 15 - h; y--) c.px(x + (y % 5 === 0 ? 1 : 0), y, pick([0x2f6b1e, 0x3c7a26, 0x4a8a2e], c.n(x, y, 176))); } });
  def('tall_seagrass_bottom', c => { c.clear(); for (let x = 2; x < 14; x += 2) for (let y = 0; y < 16; y++) c.px(x + (y % 5 === 0 ? 1 : 0), y, pick([0x2f6b1e, 0x3c7a26, 0x4a8a2e], c.n(x, y, 177))); });
  def('tall_seagrass_top', c => { c.clear(); for (let x = 2; x < 14; x += 2) { const h = 6 + Math.floor(c.n(x, 1, 178) * 10); for (let y = 15; y > 15 - h; y--) c.px(x, y, pick([0x2f6b1e, 0x3c7a26, 0x4a8a2e], c.n(x, y, 179))); } });
  def('sea_pickle', c => { c.clear(); c.rect(0, 5, 3, 10, H(0x5b6b2a)); c.rect(4, 1, 7, 4, H(0x6b7b30)); c.rect(8, 1, 11, 4, H(0x8a9a3a)); c.rect(0, 11, 3, 11, H(0xc8e05a)); });
  const CORAL = { tube: 0x3054d0, brain: 0xcf5b9d, bubble: 0xa318a1, fire: 0xc8352d, horn: 0xd8c843 };
  for (const k in CORAL) {
    def(k + '_coral_block', c => c.each((x, y) => c.px(x, y, mul(H(CORAL[k]), 0.8 + c.n(x, y, 180) * 0.25 + (c.v(x, y, 4, 4, 180) - 0.5) * 0.2))));
    def('dead_' + k + '_coral_block', c => c.each((x, y) => c.px(x, y, mul(H(0x847d78), 0.85 + c.n(x, y, 181) * 0.25))));
    def(k + '_coral', c => { c.clear(); for (let i = 0; i < 5; i++) { const bx = 2 + i * 3; c.line(7, 15, bx, 4 + (i % 2) * 3, mul(H(CORAL[k]), 0.9 + c.n(i, 1, 182) * 0.2)); } });
    def(k + '_coral_fan', c => { c.clear(); for (let x = 1; x < 15; x++) for (let y = 4; y < 16; y++) if (Math.hypot(x - 7.5, (y - 15) * 1.3) < 8 && c.n(x, y, 183) > 0.35) c.px(x, y, mul(H(CORAL[k]), 0.85 + c.n(x, y, 184) * 0.3)); });
  }
  def('spore_blossom', c => { c.clear(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, H(i % 2 ? 0xd86aa8 : 0xe885bb)); } c.rect(7, 7, 8, 8, H(0x5c8a2e)); });
  def('hanging_roots', c => { c.clear(); for (let x = 2; x < 14; x += 3) for (let y = 0; y < 8 + (x % 5); y++) c.px(x + (y % 4 === 3 ? 1 : 0), y, H(0xa57a5a)); });
  def('cave_vines', c => { c.clear(); for (let y = 0; y < 16; y++) { c.px(7, y, H(0x4f6b2a)); if (y % 3 === 0) c.px(6, y, H(0x5c7a30)); if (y % 3 === 1) c.px(8, y, H(0x5c7a30)); } });
  def('cave_vines_plant', c => c.copy('cave_vines'));
  def('big_dripleaf_top', c => c.each((x, y) => c.px(x, y, pick([0x55822a, 0x5f9030, 0x6c9e36, 0x7aad3c], c.n(x, y, 185) * 0.5 + (Math.abs(x - 7.5) < 1 ? 0.2 : 0.5)))));
  def('big_dripleaf_stem', c => { c.clear(); c.rect(7, 0, 8, 15, H(0x5f9030)); });
  def('small_dripleaf_top', c => { c.clear(); c.rect(2, 2, 13, 5, H(0x6c9e36)); c.rect(7, 6, 8, 15, H(0x5f9030)); });
  def('small_dripleaf_bottom', c => { c.clear(); c.rect(7, 0, 8, 15, H(0x5f9030)); });
  def('cobweb', c => { c.clear(); const W = H(0xe8e8e8); c.line(0, 0, 15, 15, W); c.line(15, 0, 0, 15, W); c.line(8, 0, 8, 15, W); c.line(0, 8, 15, 8, W); for (const r of [3, 6]) { c.line(8 - r, 8, 8, 8 - r, W); c.line(8, 8 - r, 8 + r, 8, W); c.line(8 + r, 8, 8, 8 + r, W); c.line(8, 8 + r, 8 - r, 8, W); } });
  def('chorus_plant', c => c.each((x, y) => c.px(x, y, pick([0x5b3a6b, 0x6b467d, 0x7d5590, 0x8e66a1], c.n(x, y, 186) * 0.6 + c.v(x, y, 4, 4, 186) * 0.4))));
  def('chorus_flower', c => { c.each((x, y) => c.px(x, y, pick([0xa67fb5, 0xb894c6, 0xcaa8d6], c.n(x, y, 187)))); c.rect(5, 5, 10, 10, H(0xd8bfe2)); });
  def('chorus_flower_dead', c => c.each((x, y) => c.px(x, y, pick([0x6a5470, 0x76607c, 0x826c88], c.n(x, y, 188)))));
  // building blocks
  def('bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x7f3a2c, 0x8f4433, 0x96493a, 0xa45343, 0xb2614f], mortar: [0x9e9389, 0xb4a99e] }));
  const SB = [0x6c6c6c, 0x777777, 0x7f7f7f, 0x888888, 0x929292];
  def('stone_bricks', c => bricks(c, { rh: 8, bw: 16, off: 8, pal: SB, mortar: [0x4f4f4f, 0x5a5a5a] }));
  def('mossy_stone_bricks', c => bricks(c, { rh: 8, bw: 16, off: 8, pal: SB, mortar: [0x4f4f4f, 0x5a5a5a], moss: 0.55 }));
  def('cracked_stone_bricks', c => bricks(c, { rh: 8, bw: 16, off: 8, pal: SB, mortar: [0x3f3f3f, 0x4a4a4a], crack: true }));
  def('chiseled_stone_bricks', c => { grain(c, 0x7f7f7f, 0.15, 189); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x5a5a5a)); }); c.rect(3, 3, 12, 12, H(0x6c6c6c)); c.rect(4, 4, 11, 11, H(0x8f8f8f)); c.rect(6, 6, 9, 9, H(0x6c6c6c)); c.rect(7, 7, 8, 8, H(0x8f8f8f)); });
  def('glass', c => { c.clear(); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0xdcf0f6)); }); for (let i = 0; i < 4; i++) { c.px(3 + i, 2 + i, H(0xeefaff)); c.px(4 + i, 2 + i, H(0xc6e2ea)); } c.px(11, 12, H(0xeefaff)); c.px(12, 11, H(0xeefaff)); c.px(13, 2, H(0xc6e2ea)); });
  def('glass_pane_top', c => { c.clear(); c.rect(7, 0, 8, 15, H(0xdcf0f6)); });
  def('tinted_glass', c => { c.each((x, y) => c.px(x, y, H(0x2c2830), x === 0 || y === 0 || x === 15 || y === 15 ? 255 : 200)); c.px(4, 4, H(0x5a4a66)); c.px(5, 5, H(0x5a4a66)); });
  def('iron_bars', c => { c.clear(); for (const x of [1, 6, 9, 14]) for (let y = 0; y < 16; y++) c.px(x, y, H(y % 8 === 0 ? 0xd0d0d0 : 0x8c8c8c)); c.rect(0, 1, 15, 1, H(0x6c6c6c)); c.rect(0, 14, 15, 14, H(0x6c6c6c)); });
  def('chain', c => { c.clear(); for (let y = 0; y < 16; y++) { const link = Math.floor(y / 4) % 2; if (link) { c.px(1, y, H(0x3a3f4a)); c.px(0, y, H(0x252830)); c.px(2, y, H(0x252830)); } else { c.px(4, y, H(0x3a3f4a)); c.px(3, y, H(0x4f5563)); c.px(5, y, H(0x252830)); } } });
  for (const k of COLORS) {
    def(k + '_wool', c => wool(c, WOOL[k], 190));
    def(k + '_terracotta', c => grain(c, TERRA[k], 0.14, 191));
    def(k + '_concrete', c => grain(c, CONCRETE[k], 0.035, 192));
    def(k + '_concrete_powder', c => c.each((x, y) => c.px(x, y, mul(H(CONCRETE[k]), 1.05 + (c.n(x, y, 193) - 0.5) * 0.35))));
    def(k + '_stained_glass', c => glassPane(c, CLR[k], 140));
    def(k + '_stained_glass_pane_top', c => { c.clear(); c.rect(7, 0, 8, 15, mul(H(CLR[k]), 0.9)); });
    def(k + '_glazed_terracotta', c => glazed(c, TERRA[k], CLR[k], WOOL[k]));
    def(k + '_bed_head', c => { wool(c, WOOL[k], 194); c.rect(1, 1, 14, 6, H(0xf2f2f2)); c.rect(1, 6, 14, 6, H(0xc8c8c8)); });
    def(k + '_bed_foot', c => wool(c, WOOL[k], 195));
    def(k + '_bed_side', c => { c.each((x, y) => c.px(x, y, y < 6 ? mul(H(WOOL[k]), 0.9 + c.n(x, y, 196) * 0.1) : pick(WOOD.oak.planks, 0.5))); c.rect(0, 0, 15, 0, H(0xe8e8e8)); });
    def(k + '_shulker_box_side', c => { c.each((x, y) => c.px(x, y, mul(H(WOOL[k]), y > 9 ? 0.85 : 1.0 - (c.n(x, y, 197) - 0.5) * 0.1))); c.rect(0, 9, 15, 9, mul(H(WOOL[k]), 0.65)); });
    def(k + '_shulker_box_top', c => { c.each((x, y) => c.px(x, y, mul(H(WOOL[k]), 0.95 + c.n(x, y, 198) * 0.1))); c.rect(3, 3, 12, 12, mul(H(WOOL[k]), 0.85)); });
    def(k + '_shulker_box_bottom', c => c.copy(k + '_shulker_box_top'));
  }
  def('shulker_box_side', c => { c.each((x, y) => c.px(x, y, mul(H(0x956a95), y > 9 ? 0.85 : 1 - (c.n(x, y, 199) - 0.5) * 0.1))); c.rect(0, 9, 15, 9, H(0x5e3f5e)); });
  def('shulker_box_top', c => { c.each((x, y) => c.px(x, y, mul(H(0x956a95), 0.95 + c.n(x, y, 200) * 0.1))); c.rect(3, 3, 12, 12, H(0x7a557a)); });
  def('shulker_box_bottom', c => c.copy('shulker_box_top'));
  function glazed(c, base, accent, light) {
    const B = H(base), A = H(accent), L = mul(H(light), 1.1);
    c.each((x, y) => {
      const u = x < 8 ? x : 15 - x, v = y < 8 ? y : 15 - y;
      let col = B;
      if ((u + v) % 6 === 0 || u === v) col = A;
      if (u < 2 && v < 2) col = L; else if (Math.abs(u - v) === 3) col = mul(A, 0.75);
      if ((x < 8) !== (y < 8) && u + v === 5) col = L;
      c.px(x, y, mul(col, 0.95 + c.n(x, y, 201) * 0.1));
    });
  }
  def('terracotta', c => grain(c, 0x985e43, 0.14, 202));
  def('bookshelf', c => {
    c.copy('oak_planks');
    for (const sy of [1, 9]) {
      for (let x = 1; x < 15;) { const w = 1 + Math.floor(c.n(x, sy, 203) * 2), h = 4 + Math.floor(c.n(x, sy, 204) * 3), col = [0x8f2a24, 0x2f5a8f, 0x2f7a3a, 0x8f7a24, 0x6b2f8f, 0x8a5a2f, 0x3a3a3a][Math.floor(c.n(x, sy, 205) * 7)]; for (let i = 0; i < w && x < 15; i++, x++) for (let y = sy + 6 - h; y < sy + 6; y++) c.px(x, y, mul(H(col), i === 0 ? 1.15 : 0.95)); x++; }
      c.rect(0, sy + 6, 15, sy + 6, H(0x6b5128));
    }
  });
  def('chiseled_bookshelf_empty', c => { c.copy('oak_planks'); c.rect(1, 1, 14, 6, H(0x3d2b14)); c.rect(1, 9, 14, 14, H(0x3d2b14)); c.rect(5, 1, 5, 6, H(0x6b5128)); c.rect(10, 1, 10, 6, H(0x6b5128)); c.rect(5, 9, 5, 14, H(0x6b5128)); c.rect(10, 9, 10, 14, H(0x6b5128)); });
  def('chiseled_bookshelf_side', c => c.copy('oak_planks')); def('chiseled_bookshelf_top', c => c.copy('oak_planks'));
  def('quartz_block_side', c => grain(c, 0xebe5de, 0.05, 206)); def('quartz_block_top', c => c.copy('quartz_block_side')); def('quartz_block_bottom', c => c.copy('quartz_block_side'));
  def('chiseled_quartz_block', c => { c.copy('quartz_block_side'); c.rect(2, 2, 13, 13, H(0xd9d2c6)); c.rect(3, 3, 12, 12, H(0xebe5de)); c.rect(5, 5, 10, 10, H(0xd9d2c6)); });
  def('chiseled_quartz_block_top', c => c.copy('chiseled_quartz_block'));
  def('quartz_pillar', c => { c.copy('quartz_block_side'); for (let y = 0; y < 16; y++) { c.px(0, y, H(0xd2cbbf)); c.px(15, y, H(0xd2cbbf)); c.px(4, y, H(0xddd6ca)); c.px(11, y, H(0xddd6ca)); } });
  def('quartz_pillar_top', c => { c.copy('quartz_block_side'); c.rect(1, 1, 14, 14, H(0xddd6ca)); c.rect(3, 3, 12, 12, H(0xebe5de)); });
  def('quartz_bricks', c => bricks(c, { rh: 8, bw: 8, pal: [0xe2dbd2, 0xe8e2d9, 0xede8e0, 0xf2eee7], mortar: [0xc9c1b5, 0xd2cbbf] }));
  def('prismarine', c => c.each((x, y) => c.px(x, y, pick([0x4f8a7c, 0x5a9a8a, 0x63a597, 0x6eb4a4, 0x7cc0b0, 0x4a7d72], c.v(x, y, 4, 4, 207 + c.frame) * 0.6 + c.n(x, y, 208) * 0.4))));
  def('prismarine_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x5b9e8f, 0x63a898, 0x6cb2a2, 0x76bcac], mortar: [0x3e6e63, 0x467a6e] }));
  def('dark_prismarine', c => bricks(c, { rh: 8, bw: 8, off: 0, pal: [0x2f4c40, 0x355648, 0x3b6050, 0x416a58], mortar: [0x1f3329, 0x243b30] }));
  def('sea_lantern', c => { c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); c.px(x, y, d > 6.5 ? H(0xa7c4b8) : mul(H(0xe2ecea), 0.95 + c.n(x, y, 209) * 0.08)); }); c.rect(5, 5, 10, 10, H(0xf4fbf8)); });
  def('hay_block_side', c => c.each((x, y) => { let col = pick([0xa58614, 0xb8961c, 0xc8a525, 0xd9b52f], c.v(x, y, 1, 4, 210) * 0.5 + c.n(x, y, 210) * 0.5); if (y === 3 || y === 12) col = H(0x7a5a10); c.px(x, y, col); }));
  def('hay_block_top', c => c.each((x, y) => c.px(x, y, pick([0xa58614, 0xb8961c, 0xc8a525, 0xd9b52f], c.n(x, y, 211)))));
  def('sponge', c => c.each((x, y) => c.px(x, y, c.n(x, y, 212) > 0.8 ? H(0x9e8e2a) : pick([0xc4b83f, 0xcfc44a, 0xd8cd52], c.n(x, y, 213)))));
  def('wet_sponge', c => c.each((x, y) => c.px(x, y, c.n(x, y, 214) > 0.8 ? H(0x6a6a1f) : pick([0x9c9a3a, 0xa8a642, 0xb1ae49], c.n(x, y, 215)))));
  def('slime_block', c => c.each((x, y) => { const edge = x === 0 || y === 0 || x === 15 || y === 15, inner = x > 3 && x < 12 && y > 3 && y < 12; c.px(x, y, edge ? H(0x5ca84a) : inner ? H(0x7fcf6a) : H(0x8fdf7a), edge || inner ? 230 : 170); }));
  def('honey_block_side', c => c.each((x, y) => c.px(x, y, H(0xf7a51e), x === 0 || y === 0 || x === 15 || y === 15 ? 240 : 190)));
  def('honey_block_top', c => c.copy('honey_block_side')); def('honey_block_bottom', c => c.copy('honey_block_side'));
  def('honeycomb_block', c => c.each((x, y) => { const hx = (x + (Math.floor(y / 4) % 2) * 2) % 4; c.px(x, y, hx === 0 || y % 4 === 0 ? H(0xc7841a) : pick([0xe5a225, 0xf0b030], c.n(x, y, 216))); }));
  def('bone_block_side', c => c.each((x, y) => c.px(x, y, pick([0xd5cfb8, 0xe0dac3, 0xe9e3cd], c.v(x, y, 1, 4, 217) * 0.5 + c.n(x, y, 217) * 0.5))));
  def('bone_block_top', c => { c.copy('bone_block_side'); c.rect(4, 4, 11, 11, H(0xc5bfa6)); c.rect(6, 6, 9, 9, H(0xb5ae95)); });
  def('dried_kelp_side', c => c.each((x, y) => c.px(x, y, pick([0x323b25, 0x3b452b, 0x444f31], c.v(x, y, 1, 4, 218) * 0.6 + c.n(x, y, 218) * 0.4))));
  def('dried_kelp_top', c => { c.copy('dried_kelp_side'); c.rect(3, 3, 12, 12, H(0x2a3220)); }); def('dried_kelp_bottom', c => c.copy('dried_kelp_top'));
  def('bee_nest_side', c => c.each((x, y) => c.px(x, y, pick(y % 4 === 0 ? [0xa0752f, 0x8a6427] : [0xd3a63c, 0xc89a34, 0xe0b448], c.n(x, y, 219)))));
  def('bee_nest_front', c => { c.copy('bee_nest_side'); c.rect(5, 8, 10, 11, H(0x3a2a14)); });
  def('bee_nest_top', c => c.each((x, y) => c.px(x, y, pick([0xb48a3a, 0xc89a44, 0xd8aa50], c.n(x, y, 220)))));
  def('bee_nest_bottom', c => c.copy('bee_nest_top'));
  def('beehive_side', c => { c.copy('oak_planks'); c.rect(0, 0, 15, 2, H(0x9c7c45)); });
  def('beehive_front', c => { c.copy('beehive_side'); c.rect(5, 8, 10, 10, H(0x3a2a14)); });
  def('beehive_end', c => { c.copy('oak_planks'); c.each((x, y) => { if ((x + y) % 4 === 0) c.px(x, y, H(0xd3a63c)); }); });
  def('mangrove_roots_side', c => { c.clear(); for (let i = 0; i < 6; i++) { let x = Math.floor(c.n(i, 1, 221) * 16); for (let y = 0; y < 16; y++) { c.px(x, y, H(0x4a3c26)); c.px(x + 1, y, H(0x5a4a2e)); if (c.n(i, y, 222) > 0.7) x = (x + 1) & 15; } } });
  def('mangrove_roots_top', c => c.copy('mangrove_roots_side'));
  def('muddy_mangrove_roots_side', c => { c.copy('mud'); c.each((x, y) => { if (c.n(x, y, 223) > 0.75) c.px(x, y, H(0x5a4a2e)); }); });
  def('muddy_mangrove_roots_top', c => c.copy('muddy_mangrove_roots_side'));
  // nether and end
  const NR = [0x5a2626, 0x642a2a, 0x6f3535, 0x7b3b3b, 0x8b4848, 0x4e1f1f];
  def('netherrack', c => c.each((x, y) => { const t = c.n(x, y, 224) * 0.6 + c.v(x, y, 3, 3, 224) * 0.4; c.px(x, y, pick(NR, t)); }));
  def('soul_sand', c => { c.each((x, y) => c.px(x, y, pick([0x3f2f24, 0x4a382c, 0x554035, 0x5f4a3d], c.n(x, y, 225) * 0.6 + c.v(x, y, 4, 4, 225) * 0.4))); for (const [x, y] of [[3, 4], [10, 9], [5, 12]]) { c.px(x, y, H(0x231912)); c.px(x + 2, y, H(0x231912)); c.rect(x, y + 2, x + 2, y + 2, H(0x231912)); } });
  def('soul_soil', c => c.each((x, y) => c.px(x, y, pick([0x3a2c22, 0x45352a, 0x4f3d31, 0x594638], c.n(x, y, 226) * 0.6 + c.v(x, y, 4, 4, 226) * 0.4))));
  def('glowstone', c => c.each((x, y) => { const v = voro(cells(c, 9, 227), x, y); c.px(x, y, pick([0x8f6a33, 0xb88b45, 0xdcb15f, 0xf3d684, 0xfff1b5], v.edge < 0.8 ? 0.1 : 0.35 + v.p[2] * 0.6)); }));
  def('basalt_side', c => c.each((x, y) => c.px(x, y, pick([0x3d3d42, 0x46464b, 0x505055, 0x5a5a5f, 0x636368], c.v(x, y, 1, 6, 228) * 0.6 + c.n(x, y, 228) * 0.4))));
  def('basalt_top', c => c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); c.px(x, y, pick([0x3d3d42, 0x505055, 0x5a5a5f, 0x636368], (Math.floor(d) % 3) / 3 + c.n(x, y, 229) * 0.3)); }));
  def('polished_basalt_side', c => { c.copy('basalt_side'); bevel(c, 1.15, 0.8); });
  def('polished_basalt_top', c => { c.copy('basalt_top'); bevel(c, 1.15, 0.8); });
  def('smooth_basalt', c => grain(c, 0x48474c, 0.12, 230));
  const BS = [0x1d1a20, 0x241f27, 0x2c262f, 0x332d37, 0x3c3540];
  def('blackstone', c => c.each((x, y) => c.px(x, y, pick(BS, c.n(x, y, 231) * 0.6 + c.v(x, y, 3, 3, 231) * 0.4))));
  def('blackstone_top', c => c.each((x, y) => c.px(x, y, pick(BS, c.n(x, y, 232) * 0.5 + 0.2))));
  def('polished_blackstone', c => { c.each((x, y) => c.px(x, y, pick([0x2f2a33, 0x35303a, 0x3b3540], c.n(x, y, 233)))); bevel(c, 1.25, 0.7); });
  def('polished_blackstone_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x2f2a33, 0x35303a, 0x3b3540, 0x413a46], mortar: [0x17141a, 0x1d1a20] }));
  def('cracked_polished_blackstone_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x2f2a33, 0x35303a, 0x3b3540, 0x413a46], mortar: [0x121014, 0x17141a], crack: true }));
  def('chiseled_polished_blackstone', c => { c.copy('polished_blackstone'); c.rect(4, 4, 11, 11, H(0x241f27)); c.rect(6, 6, 9, 9, H(0x3b3540)); });
  def('gilded_blackstone', c => { c.copy('blackstone'); c.each((x, y) => { if (c.v(x, y, 4, 4, 234) > 0.62 && c.n(x, y, 234) > 0.3) c.px(x, y, pick([0xd6a52a, 0xf0c43a, 0xb5841c], c.n(x, y, 235))); }); });
  def('nether_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x2c1418, 0x33171c, 0x3b1b20, 0x441f25], mortar: [0x1a0b0e, 0x200e11] }));
  def('cracked_nether_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x2c1418, 0x33171c, 0x3b1b20, 0x441f25], mortar: [0x150809, 0x1a0b0e], crack: true }));
  def('chiseled_nether_bricks', c => { c.copy('nether_bricks'); c.rect(3, 3, 12, 12, H(0x3b1b20)); c.rect(5, 5, 10, 10, H(0x200e11)); });
  def('red_nether_bricks', c => bricks(c, { rh: 4, bw: 8, pal: [0x4a0b0e, 0x560e11, 0x631115, 0x701418], mortar: [0x2e0608, 0x36080a] }));
  def('respawn_anchor_top_off', c => { c.copy('crying_obsidian'); c.rect(4, 4, 11, 11, H(0x14121d)); });
  def('respawn_anchor_top', c => { c.copy('crying_obsidian'); c.rect(4, 4, 11, 11, H(0xffb02e)); c.rect(6, 6, 9, 9, H(0xfff07a)); });
  def('respawn_anchor_bottom', c => c.copy('obsidian'));
  for (let i = 0; i <= 4; i++) def('respawn_anchor_side' + i, c => { c.copy('obsidian'); for (let k = 0; k < 4; k++) c.rect(2 + k * 3, 6, 3 + k * 3, 9, H(k < i ? 0xffb02e : 0x3a3045)); c.rect(0, 0, 15, 2, H(0x6a17c6)); c.rect(0, 13, 15, 15, H(0x2c2440)); });
  def('lodestone_side', c => { c.copy('chiseled_stone_bricks'); c.rect(6, 0, 9, 15, H(0x5a5a5a)); });
  def('lodestone_top', c => { c.copy('chiseled_stone_bricks'); c.rect(5, 5, 10, 10, H(0x3a3a3a)); });
  def('crimson_nylium', c => c.each((x, y) => c.px(x, y, pick([0x7a1515, 0x8f1b1b, 0xa52222, 0xbf2b2b, 0x6b1212], c.n(x, y, 236) * 0.6 + c.v(x, y, 3, 3, 236) * 0.4))));
  def('crimson_nylium_side', c => { c.copy('netherrack'); for (let x = 0; x < 16; x++) { const d = 3 + (c.n(x, 0, 237) < 0.4 ? 1 : 0); for (let y = 0; y < d; y++) c.px(x, y, pick([0x8f1b1b, 0xa52222, 0xbf2b2b], c.n(x, y, 238))); } });
  def('warped_nylium', c => c.each((x, y) => c.px(x, y, pick([0x167a6e, 0x1b8f80, 0x22a593, 0x2bbfa8, 0x12645a], c.n(x, y, 239) * 0.6 + c.v(x, y, 3, 3, 239) * 0.4))));
  def('warped_nylium_side', c => { c.copy('netherrack'); for (let x = 0; x < 16; x++) { const d = 3 + (c.n(x, 0, 240) < 0.4 ? 1 : 0); for (let y = 0; y < d; y++) c.px(x, y, pick([0x1b8f80, 0x22a593, 0x2bbfa8], c.n(x, y, 241))); } });
  def('crimson_fungus', c => { c.clear(); c.rect(7, 9, 8, 15, H(0xd8c27a)); c.rect(3, 5, 12, 8, H(0xa52222)); c.rect(5, 3, 10, 4, H(0xbf2b2b)); c.px(5, 6, H(0xf7a52e)); c.px(10, 7, H(0xf7a52e)); });
  def('warped_fungus', c => { c.clear(); c.rect(7, 9, 8, 15, H(0xd88a3a)); c.rect(3, 5, 12, 8, H(0x22a593)); c.rect(5, 3, 10, 4, H(0x2bbfa8)); c.px(5, 6, H(0xf7a52e)); c.px(10, 7, H(0xf7a52e)); });
  def('crimson_roots', c => { c.clear(); for (const bx of [3, 6, 9, 12]) { const h = 6 + Math.floor(c.n(bx, 1, 242) * 8); for (let y = 15; y > 15 - h; y--) c.px(bx + (y % 4 === 0 ? 1 : 0), y, pick([0x8f1b1b, 0xa52222, 0x7a1515], c.n(bx, y, 243))); } });
  def('warped_roots', c => { c.clear(); for (const bx of [3, 6, 9, 12]) { const h = 6 + Math.floor(c.n(bx, 1, 244) * 8); for (let y = 15; y > 15 - h; y--) c.px(bx + (y % 4 === 0 ? 1 : 0), y, pick([0x1b8f80, 0x22a593, 0x167a6e], c.n(bx, y, 245))); } });
  def('nether_sprouts', c => { c.clear(); for (let x = 1; x < 15; x += 2) { const h = 2 + Math.floor(c.n(x, 1, 246) * 5); for (let y = 15; y > 15 - h; y--) c.px(x, y, H(0x22a593)); } });
  def('weeping_vines', c => { c.clear(); for (let y = 0; y < 14; y++) { c.px(7, y, H(0x8f1b1b)); if (y % 3 === 0) c.px(6, y, H(0xa52222)); if (y % 3 === 1) c.px(8, y, H(0xa52222)); } });
  def('weeping_vines_plant', c => c.copy('weeping_vines'));
  def('twisting_vines', c => { c.clear(); for (let y = 2; y < 16; y++) { c.px(7, y, H(0x1b8f80)); if (y % 3 === 0) c.px(6, y, H(0x22a593)); if (y % 3 === 1) c.px(8, y, H(0x22a593)); } });
  def('twisting_vines_plant', c => c.copy('twisting_vines'));
  def('nether_wart_block', c => c.each((x, y) => c.px(x, y, pick([0x6b0a0a, 0x7d0e0e, 0x8f1212, 0xa31717], c.n(x, y, 247) * 0.6 + c.v(x, y, 3, 3, 247) * 0.4))));
  def('warped_wart_block', c => c.each((x, y) => c.px(x, y, pick([0x0f6b63, 0x137d74, 0x169085, 0x1ba597], c.n(x, y, 248) * 0.6 + c.v(x, y, 3, 3, 248) * 0.4))));
  def('shroomlight', c => c.each((x, y) => { const v = voro(cells(c, 8, 249), x, y); c.px(x, y, pick([0xc8501e, 0xe86a26, 0xf7922e, 0xffb84a, 0xffd57a], v.edge < 0.8 ? 0.1 : 0.35 + v.p[2] * 0.6)); }));
  def('end_stone', c => { c.each((x, y) => c.px(x, y, pick([0xcfd18e, 0xd8da98, 0xdedf9e, 0xe5e6a7, 0xc5c784], c.n(x, y, 250) * 0.5 + c.v(x, y, 4, 4, 250) * 0.5))); for (let i = 0; i < 5; i++) { const x = Math.floor(c.n(i, 1, 251) * 15), y = Math.floor(c.n(i, 2, 251) * 15); c.px(x, y, H(0xb3b56e)); c.px(x + 1, y, H(0xbfc17a)); } });
  def('end_stone_bricks', c => bricks(c, { rh: 8, bw: 8, pal: [0xd6d899, 0xdedfa2, 0xe5e6aa, 0xebecb2], mortar: [0xb3b56e, 0xbfc17a] }));
  def('purpur_block', c => bricks(c, { rh: 8, bw: 8, off: 0, pal: [0x9b6b9b, 0xa575a5, 0xae7eae, 0xb787b7], mortar: [0x7f557f, 0x8a5e8a] }));
  def('purpur_pillar', c => c.each((x, y) => c.px(x, y, pick([0xa173a1, 0xab7dab, 0xb587b5, 0x8f638f], (x % 4 === 0 ? 0.0 : 0.4) + c.n(x, y, 252) * 0.4))));
  def('purpur_pillar_top', c => { c.copy('purpur_block'); c.rect(2, 2, 13, 13, H(0xab7dab)); });
  def('end_rod', c => { c.clear(); c.rect(0, 0, 1, 14, H(0xf4f0f8)); c.rect(2, 0, 5, 1, H(0xd8d0e0)); c.rect(2, 2, 5, 5, H(0xc8c0d0)); c.rect(2, 6, 5, 6, H(0xa098a8)); });
  def('dragon_egg', c => c.each((x, y) => c.px(x, y, pick([0x0c0910, 0x120d18, 0x1a1222, 0x2a1d36], c.n(x, y, 253) * 0.8 + (c.n(x, y, 254) > 0.92 ? 0.3 : 0)))));
  def('end_portal_frame_top', c => { c.copy('end_stone'); c.rect(2, 2, 13, 13, H(0x2f5e4f)); c.rect(4, 4, 11, 11, H(0x13362c)); c.each((x, y) => { if ((x === 2 || x === 13 || y === 2 || y === 13) && (x + y) % 2) c.px(x, y, H(0x6ba891)); }); });
  def('end_portal_frame_side', c => { c.copy('end_stone'); c.rect(0, 0, 15, 2, H(0x2f5e4f)); c.each((x, y) => { if (y === 1 && x % 3 === 0) c.px(x, y, H(0x6ba891)); }); });
  def('end_portal_frame_eye', c => { c.each((x, y) => c.px(x, y, pick([0x163b2f, 0x2a6b55, 0x3f9a7c], c.n(x, y, 255)))); c.rect(5, 5, 10, 10, H(0x0d2a20)); c.rect(7, 7, 8, 8, H(0x5ff0b0)); });
  def('end_portal', (c, f) => c.each((x, y) => { const s = c.n(x + f, y, 256); c.px(x, y, s > 0.94 ? pick([0x7ff2ff, 0x9fffbf, 0xf4c2ff], c.n(x, y + f, 257)) : pick([0x07070d, 0x0b0d18, 0x101528], c.n(x, y, 258))); }), 8);
  // fluids and fire (animated)
  def('water_still', (c, f) => c.each((x, y) => { const w = Math.sin((x + f * 0.5) * 0.7 + Math.sin((y - f) * 0.5) * 1.5) * 0.5 + 0.5, t = 0.62 + w * 0.12 + c.n(x, (y + f) & 15, 260) * 0.08; c.px(x, y, [t * 255, t * 255, t * 255], 175); }), 16);
  def('water_flow', (c, f) => c.each((x, y) => { const yy = (y + f) & 15; const w = Math.sin(x * 0.9 + Math.sin(yy * 0.4) * 2) * 0.5 + 0.5, t = 0.6 + w * 0.14 + c.n(x, yy, 261) * 0.08; c.px(x, y, [t * 255, t * 255, t * 255], 175); }), 16);
  def('lava_still', (c, f) => c.each((x, y) => { const a = Math.sin(x * 0.6 + f * 0.4) + Math.sin(y * 0.5 - f * 0.3) + Math.sin((x + y) * 0.35 + f * 0.2); const t = (a + 3) / 6 * 0.7 + c.n(x, y, 262 + (f >> 2)) * 0.3; c.px(x, y, pick([0xc23a0b, 0xd4530f, 0xe56f15, 0xf28f1d, 0xfcb12d, 0xffd45a], t)); }), 16);
  def('lava_flow', (c, f) => c.each((x, y) => { const yy = (y + f) & 15; const a = Math.sin(x * 0.7) + Math.sin(yy * 0.6) + Math.sin((x - yy) * 0.3); const t = (a + 3) / 6 * 0.7 + c.n(x, yy, 263) * 0.3; c.px(x, y, pick([0xc23a0b, 0xd4530f, 0xe56f15, 0xf28f1d, 0xfcb12d, 0xffd45a], t)); }), 16);
  def('nether_portal', (c, f) => c.each((x, y) => { const a = Math.sin(x * 0.5 + f * 0.8 + Math.sin(y * 0.4 + f * 0.3) * 2), t = (a + 1) / 2 * 0.6 + c.n(x, y + f, 264) * 0.4; c.px(x, y, pick([0x3b0a83, 0x5413b0, 0x6e1ed6, 0x8a35f0, 0xa65af8], t), 200); }), 16);
  def('fire_0', (c, f) => fire(c, f, [0x8c1c00, 0xc8400a, 0xe86a14, 0xf7a52e, 0xffd45a, 0xffefa0]), 16);
  def('soul_fire_0', (c, f) => fire(c, f, [0x0a3a5a, 0x10648f, 0x1a8fc0, 0x3fc8e8, 0x8ff0ff, 0xd8ffff]), 16);
  function fire(c, f, pal) {
    c.clear();
    for (let x = 0; x < 16; x++) {
      const h = 9 + Math.floor((Math.sin(x * 1.3 + f * 0.9) * 0.5 + 0.5) * 6 + c.n(x, f, 265) * 3);
      for (let y = 15; y > 15 - h; y--) {
        const k = (15 - y) / h, t = 1 - k + c.n(x, y + f * 3, 266) * 0.25 - 0.1;
        if (k > 0.85 && c.n(x, y + f, 267) > 0.5) continue;
        c.px(x, y, pick(pal, t));
      }
    }
  }
  def('campfire_fire', (c, f) => fire(c, f, [0x8c1c00, 0xc8400a, 0xe86a14, 0xf7a52e, 0xffd45a, 0xffefa0]), 16);
  def('soul_campfire_fire', (c, f) => fire(c, f, [0x0a3a5a, 0x10648f, 0x1a8fc0, 0x3fc8e8, 0x8ff0ff, 0xd8ffff]), 16);
  def('campfire_log', c => { c.copy('oak_log'); c.rect(0, 0, 15, 0, H(0x3a2a14)); });
  def('campfire_log_lit', c => { c.copy('oak_log'); c.each((x, y) => { if (c.n(x, y, 268) > 0.75) c.px(x, y, H(0xf7a52e)); }); });
  def('soul_campfire_log_lit', c => { c.copy('oak_log'); c.each((x, y) => { if (c.n(x, y, 269) > 0.75) c.px(x, y, H(0x3fc8e8)); }); });
  // workstations
  def('crafting_table_top', c => { c.copy('oak_planks'); c.rect(1, 1, 14, 14, H(0x9f7c48)); for (let i = 1; i < 15; i += 4) { c.rect(i, 1, i, 14, H(0x6b5128)); c.rect(1, i, 14, i, H(0x6b5128)); } c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x6b4e2a)); }); });
  def('crafting_table_side', c => { c.copy('oak_planks'); c.rect(0, 0, 15, 2, H(0x6b4e2a)); c.rect(3, 5, 4, 12, H(0x8c8c8c)); c.rect(2, 4, 5, 6, H(0x5a5a5a)); c.rect(10, 5, 11, 13, H(0x6b5128)); c.rect(9, 4, 12, 5, H(0x8c8c8c)); });
  def('crafting_table_front', c => { c.copy('oak_planks'); c.rect(0, 0, 15, 2, H(0x6b4e2a)); c.rect(2, 6, 13, 6, H(0x6b5128)); c.rect(4, 8, 5, 13, H(0x7a6a5a)); c.rect(9, 8, 12, 9, H(0x5a5a5a)); });
  const furnaceSide = c => { c.copy('cobblestone'); c.each((x, y) => { if (y < 2) c.px(x, y, mul(c.get(x, y), 1.08)); }); };
  def('furnace_side', c => { c.copy('stone'); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x5a5a5a)); }); });
  def('furnace_top', c => { c.copy('stone'); c.rect(1, 1, 14, 14, H(0x8a8a8a)); c.each((x, y) => { if (x > 0 && y > 0 && x < 15 && y < 15) c.px(x, y, mul(c.get(x, y), 0.95 + c.n(x, y, 270) * 0.1)); }); });
  def('furnace_front', c => { c.copy('furnace_side'); c.rect(3, 2, 12, 5, H(0x4a4a4a)); c.rect(4, 8, 11, 13, H(0x2a2a2a)); c.rect(4, 7, 11, 7, H(0x6a6a6a)); });
  def('furnace_front_on', c => { c.copy('furnace_front'); c.rect(5, 9, 10, 13, H(0xe86a14)); c.rect(6, 11, 9, 13, H(0xffd45a)); });
  def('blast_furnace_side', c => { c.copy('smooth_stone'); c.rect(0, 0, 15, 3, H(0x5a5a5a)); c.rect(0, 12, 15, 15, H(0x4a4a4a)); });
  def('blast_furnace_top', c => { c.copy('smooth_stone'); c.rect(4, 4, 11, 11, H(0x3a3a3a)); });
  def('blast_furnace_front', c => { c.copy('blast_furnace_side'); c.rect(4, 6, 11, 11, H(0x2a2a2a)); for (let x = 4; x < 12; x += 2) c.rect(x, 6, x, 11, H(0x8a8a8a)); });
  def('blast_furnace_front_on', c => { c.copy('blast_furnace_front'); for (let x = 5; x < 12; x += 2) c.rect(x, 7, x, 11, H(0xf7a52e)); });
  def('smoker_side', c => { c.copy('oak_log'); c.rect(0, 0, 15, 2, H(0x3a2a14)); c.rect(0, 13, 15, 15, H(0x3a3a3a)); });
  def('smoker_top', c => { c.copy('smooth_stone'); c.rect(3, 3, 12, 12, H(0x3a2a14)); }); def('smoker_bottom', c => c.copy('smooth_stone'));
  def('smoker_front', c => { c.copy('smoker_side'); c.rect(4, 6, 11, 11, H(0x2a2a2a)); c.rect(3, 5, 12, 5, H(0x5a5a5a)); });
  def('smoker_front_on', c => { c.copy('smoker_front'); c.rect(5, 8, 10, 11, H(0xf7a52e)); });
  void furnaceSide;
  // chests are drawn as boxes; these are the faces of the box
  for (const [k, wood, metalc] of [['chest', WOOD.oak, 0xc0c0c0], ['trapped_chest', WOOD.oak, 0xa83a2a], ['ender_chest', null, 0x2f6e5e]]) {
    const pal = wood ? wood.planks : [0x0f1a1a, 0x142424, 0x1a2e2e, 0x203838, 0x264242];
    const frame = wood ? H(0x4a3015) : H(0x0a0f0f);
    const face = (c, lid) => c.each((x, y) => { const edge = x === 0 || x === 15 || (lid ? y === 15 || y === 0 : y === 0 || y === 15); c.px(x, y, edge ? frame : pick(pal, 0.35 + c.n(x, y, 271) * 0.4 + (y % 4 === 0 ? -0.15 : 0))); });
    def(k + '_side', c => face(c, false)); def(k + '_side_lid', c => face(c, true));
    def(k + '_front', c => face(c, false)); def(k + '_front_lid', c => face(c, true));
    def(k + '_top', c => { c.each((x, y) => c.px(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? frame : pick(pal, 0.35 + c.n(x, y, 272) * 0.4))); if (k === 'ender_chest') c.rect(6, 6, 9, 9, H(0x5ff0b0)); });
  }
  def('barrel_side', c => { c.each((x, y) => c.px(x, y, pick(WOOD.spruce.planks, 0.3 + c.v(x, y, 1, 8, 330) * 0.4 + c.n(x, y, 330) * 0.2))); c.rect(0, 2, 15, 3, H(0x3a3a3a)); c.rect(0, 12, 15, 13, H(0x3a3a3a)); for (let x = 0; x < 16; x += 4) c.rect(x, 0, x, 15, H(0x45311a)); });
  def('barrel_top', c => { c.copy('spruce_planks'); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x3a3a3a)); }); c.rect(6, 6, 9, 9, H(0x45311a)); });
  def('barrel_top_open', c => { c.copy('barrel_top'); c.rect(2, 2, 13, 13, H(0x1e140a)); });
  def('barrel_bottom', c => c.copy('barrel_top'));
  def('chest_latch', c => { c.fill(H(0xc0c0c0)); c.rect(0, 2, 15, 3, H(0x5a5a5a)); });
  def('bed_leg', c => c.copy('oak_planks'));
  def('anvil', c => c.each((x, y) => c.px(x, y, pick([0x3f3f3f, 0x484848, 0x515151, 0x5a5a5a], c.n(x, y, 273) * 0.6 + c.v(x, y, 4, 4, 273) * 0.4))));
  for (const [a, cr] of [['anvil_top', 0], ['chipped_anvil_top', 1], ['damaged_anvil_top', 2]]) def(a, c => { c.copy('anvil'); c.rect(3, 0, 12, 15, H(0x5f5f5f)); c.rect(4, 1, 11, 14, H(0x6a6a6a)); for (let i = 0; i < cr * 4; i++) { const x = 4 + Math.floor(c.n(i, 1, 274) * 8), y = Math.floor(c.n(i, 2, 274) * 15); c.px(x, y, H(0x2a2a2a)); c.px(x + 1, y + 1, H(0x2a2a2a)); } });
  def('grindstone_side', c => { c.copy('stone'); c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 7) c.px(x, y, H(0x6a6a6a)); }); });
  def('grindstone_round', c => c.each((x, y) => c.px(x, y, pick([0x7a7a7a, 0x8a8a8a, 0x9a9a9a], c.v(x, y, 1, 4, 275) * 0.5 + c.n(x, y, 275) * 0.5))));
  def('grindstone_pivot', c => c.copy('dark_oak_planks'));
  def('enchanting_table_top', c => { c.copy('obsidian'); c.rect(1, 1, 14, 14, H(0x8f1f1f)); c.rect(2, 2, 13, 13, H(0xb82a2a)); c.rect(4, 4, 11, 11, H(0x8f1f1f)); c.each((x, y) => { if (x > 1 && x < 14 && (y === 1 || y === 14) && x % 2) c.px(x, y, H(0xf7d43a)); }); });
  def('enchanting_table_side', c => { c.copy('obsidian'); c.rect(0, 0, 15, 3, H(0x8f1f1f)); c.rect(0, 1, 15, 1, H(0xb82a2a)); c.each((x, y) => { if (y === 0 && x % 3 === 0) c.px(x, y, H(0x33cccc)); }); });
  def('enchanting_table_bottom', c => c.copy('obsidian'));
  def('brewing_stand', c => { c.clear(); c.rect(7, 2, 8, 15, H(0x8a7a5a)); c.rect(6, 1, 9, 2, H(0xd4b55a)); c.rect(1, 9, 4, 14, H(0xd8e8f0), 160); c.rect(11, 9, 14, 14, H(0xd8e8f0), 160); c.rect(2, 7, 3, 8, H(0xa8c8d8)); c.rect(12, 7, 13, 8, H(0xa8c8d8)); });
  def('brewing_stand_base', c => c.copy('cobblestone'));
  def('cauldron_side', c => { c.each((x, y) => c.px(x, y, pick([0x2f2f2f, 0x383838, 0x414141, 0x4a4a4a], c.n(x, y, 276)))); c.rect(4, 13, 11, 15, [0, 0, 0], 0); c.rect(0, 0, 15, 1, H(0x5a5a5a)); });
  def('cauldron_top', c => { c.each((x, y) => c.px(x, y, pick([0x3f3f3f, 0x4a4a4a, 0x555555], c.n(x, y, 277)))); c.rect(2, 2, 13, 13, [0, 0, 0], 0); });
  def('cauldron_bottom', c => c.copy('cauldron_side')); def('cauldron_inner', c => c.each((x, y) => c.px(x, y, pick([0x262626, 0x2f2f2f, 0x383838], c.n(x, y, 278)))));
  def('composter_side', c => { c.copy('oak_planks'); c.rect(0, 0, 15, 1, H(0x6b5128)); c.rect(0, 14, 15, 15, H(0x6b5128)); for (let x = 0; x < 16; x += 4) c.rect(x, 0, x, 15, H(0x6b5128)); });
  def('composter_top', c => { c.copy('oak_planks'); c.rect(2, 2, 13, 13, [0, 0, 0], 0); });
  def('composter_bottom', c => c.copy('oak_planks'));
  def('composter_compost', c => c.each((x, y) => c.px(x, y, pick([0x4a3a1a, 0x5a4622, 0x6a5428, 0x3e6b1e], c.n(x, y, 279)))));
  def('composter_ready', c => { c.copy('composter_compost'); c.each((x, y) => { if (c.n(x, y, 280) > 0.75) c.px(x, y, H(0xe8e2d5)); }); });
  def('stonecutter_top', c => { c.copy('smooth_stone'); c.rect(1, 7, 14, 8, H(0x3a3a3a)); });
  def('stonecutter_side', c => { c.copy('smooth_stone_slab_side'); c.rect(0, 8, 15, 15, H(0x8a7a5a)); });
  def('stonecutter_bottom', c => c.copy('smooth_stone'));
  def('stonecutter_saw', c => { c.clear(); for (let x = 0; x < 16; x++) for (let y = 9; y < 16; y++) if (Math.hypot(x - 7.5, y - 15) < 7) c.px(x, y, (x + y) % 2 ? H(0xd0d0d0) : H(0x9a9a9a)); });
  def('loom_top', c => { c.copy('oak_planks'); c.rect(2, 4, 13, 11, H(0xe8e8e8)); });
  def('loom_side', c => { c.copy('oak_planks'); c.rect(0, 0, 15, 2, H(0x6b5128)); });
  def('loom_bottom', c => c.copy('oak_planks'));
  def('loom_front', c => { c.copy('oak_planks'); c.rect(2, 2, 13, 9, H(0xe8e8e8)); for (let x = 2; x < 14; x += 2) c.rect(x, 2, x, 9, H(0xc8c8c8)); });
  def('smithing_table_top', c => { c.copy('dark_oak_planks'); c.rect(1, 1, 14, 14, H(0x2f2f2f)); c.rect(3, 3, 12, 12, H(0x3a3a3a)); });
  def('smithing_table_side', c => { c.copy('dark_oak_planks'); c.rect(0, 0, 15, 3, H(0x2f2f2f)); });
  def('smithing_table_front', c => { c.copy('smithing_table_side'); c.rect(4, 6, 11, 9, H(0x6a6a6a)); });
  def('smithing_table_bottom', c => c.copy('dark_oak_planks'));
  def('fletching_table_top', c => { c.copy('birch_planks'); c.rect(2, 2, 13, 13, H(0xc4b17f)); c.line(4, 11, 11, 4, H(0x8a7a5a)); c.rect(10, 3, 12, 5, H(0xe8e8e8)); });
  def('fletching_table_side', c => { c.copy('birch_planks'); c.rect(0, 0, 15, 2, H(0x8a7a5a)); });
  def('fletching_table_front', c => { c.copy('fletching_table_side'); c.rect(4, 5, 11, 12, H(0xa59366)); c.line(5, 11, 10, 6, H(0xe8e8e8)); });
  def('cartography_table_top', c => { c.copy('dark_oak_planks'); c.rect(1, 1, 14, 14, H(0xe0d6b0)); c.line(3, 4, 12, 9, H(0x6b8a3a)); c.rect(9, 10, 12, 12, H(0x3a5a8a)); });
  def('cartography_table_side1', c => { c.copy('dark_oak_planks'); c.rect(0, 0, 15, 2, H(0xe0d6b0)); });
  def('cartography_table_side2', c => { c.copy('cartography_table_side1'); c.rect(3, 5, 12, 12, H(0xe0d6b0)); });
  def('cartography_table_side3', c => { c.copy('cartography_table_side1'); c.rect(4, 6, 6, 13, H(0x4a3a2a)); });
  def('lectern_top', c => { c.copy('oak_planks'); c.rect(1, 1, 14, 14, H(0x9f7c48)); });
  def('lectern_sides', c => c.copy('oak_planks')); def('lectern_front', c => { c.copy('oak_planks'); c.rect(3, 0, 12, 15, H(0x8a6a3a)); }); def('lectern_base', c => c.copy('oak_planks'));
  def('bell_body', c => grain(c, 0xf2c94a, 0.15, 281));
  def('jukebox_side', c => { c.copy('oak_planks'); c.each((x, y) => { if (x === 0 || x === 15 || y === 0 || y === 15) c.px(x, y, H(0x4a3015)); }); });
  def('jukebox_top', c => { c.copy('jukebox_side'); c.rect(3, 6, 12, 9, H(0x2a1a0a)); });
  def('note_block', c => { c.copy('jukebox_side'); c.rect(4, 4, 11, 11, H(0x4a3015)); c.rect(6, 6, 9, 9, H(0x2a1a0a)); });
  def('beacon', c => { c.each((x, y) => c.px(x, y, pick([0x7ff2ff, 0x9ffff0, 0xc8fffa], c.n(x, y, 282)))); c.rect(3, 3, 12, 12, H(0xe8ffff)); });
  def('conduit', c => c.each((x, y) => c.px(x, y, pick([0x6b5a3a, 0x8a7a4a, 0xa59a6a], c.n(x, y, 283)))));
  def('spawner', c => { c.clear(); c.each((x, y) => { if (x % 4 === 0 || y % 4 === 0 || x === 15 || y === 15) c.px(x, y, pick([0x1a2a3a, 0x24384c, 0x2e4a60], c.n(x, y, 284))); }); });
  def('trial_spawner_side_inactive', c => { c.copy('spawner'); c.rect(0, 0, 15, 1, H(0xa06a3a)); c.rect(0, 14, 15, 15, H(0xa06a3a)); });
  def('trial_spawner_top_inactive', c => c.copy('trial_spawner_side_inactive')); def('trial_spawner_bottom', c => c.copy('trial_spawner_side_inactive'));
  def('flower_pot', c => grain(c, 0x7b3c2a, 0.15, 285));
  def('scaffolding_top', c => { c.clear(); c.each((x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13 || x === y || x === 15 - y) c.px(x, y, pick([0xb5973a, 0xc8a845, 0xd6b650], c.n(x, y, 286))); }); });
  def('scaffolding_side', c => { c.clear(); c.each((x, y) => { if (x < 2 || x > 13 || y < 2 || x === y) c.px(x, y, pick([0xb5973a, 0xc8a845, 0xd6b650], c.n(x, y, 287))); }); });
  def('scaffolding_bottom', c => c.copy('scaffolding_top'));
  def('ladder', c => { c.clear(); for (let y = 0; y < 16; y++) { c.px(2, y, H(0x8a6a3a)); c.px(3, y, H(0x6b5128)); c.px(12, y, H(0x8a6a3a)); c.px(13, y, H(0x6b5128)); } for (const y of [1, 5, 9, 13]) c.rect(2, y, 13, y + 1, y % 2 ? H(0xa2834f) : H(0x8a6a3a)); });
  def('torch', c => { c.clear(); c.rect(7, 6, 8, 15, H(0x6b5128)); c.rect(7, 6, 7, 15, H(0x8a6a3a)); c.rect(7, 4, 8, 5, H(0xffd84a)); c.px(7, 3, H(0xfff4a0)); c.px(8, 6, H(0xf7a52e)); c.px(7, 6, H(0xffefa0)); });
  def('soul_torch', c => { c.copy('torch'); c.rect(7, 4, 8, 5, H(0x5ff0ff)); c.px(7, 3, H(0xc8ffff)); c.px(8, 6, H(0x3fc8e8)); c.px(7, 6, H(0xa8f8ff)); });
  def('redstone_torch', c => { c.copy('torch'); c.rect(7, 4, 8, 6, H(0xff2a1a)); c.px(7, 3, H(0xff8a6a)); c.px(6, 5, H(0xff5a3a), 160); c.px(9, 5, H(0xff5a3a), 160); });
  def('redstone_torch_off', c => { c.copy('torch'); c.rect(7, 4, 8, 6, H(0x5a1a1a)); c.px(7, 3, H(0x4a1414)); });
  def('lantern', c => { c.clear(); c.rect(0, 2, 5, 8, H(0x3a3f4a)); c.rect(1, 3, 4, 7, H(0xf7c84a)); c.rect(2, 4, 3, 6, H(0xffefa0)); c.rect(1, 0, 4, 1, H(0x3a3f4a)); c.rect(0, 9, 5, 14, H(0x2a2f38)); c.rect(11, 1, 12, 6, H(0x3a3f4a)); });
  def('soul_lantern', c => { c.copy('lantern'); c.rect(1, 3, 4, 7, H(0x3fc8e8)); c.rect(2, 4, 3, 6, H(0xc8ffff)); });
  def('cake_top', c => { c.fill(H(0xf4f0ea)); for (const [x, y] of [[3, 3], [10, 5], [6, 10], [12, 12], [4, 13]]) { c.px(x, y, H(0xd8241b)); c.px(x + 1, y, H(0xa81a14)); } });
  def('cake_side', c => { c.each((x, y) => c.px(x, y, y < 4 ? H(0xf4f0ea) : y < 6 ? H(0xe8a4a4) : pick([0xc88a4a, 0xb87a3a], c.n(x, y, 288)))); });
  def('cake_bottom', c => c.fill(H(0xb87a3a)));
  def('cake_inner', c => { c.each((x, y) => c.px(x, y, y < 4 ? H(0xf4f0ea) : y < 6 ? H(0xe8a4a4) : pick([0xe8d8a8, 0xd8c898], c.n(x, y, 289)))); });
  for (const s of ['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'creeper_head', 'player_head', 'piglin_head', 'dragon_head']) {
    const base = { skeleton_skull: 0xc8c8c0, wither_skeleton_skull: 0x2a2a2a, zombie_head: 0x4f8a3a, creeper_head: 0x5cb24a, player_head: 0xb88a6a, piglin_head: 0xe8a0a0, dragon_head: 0x1a1a1a }[s];
    def(s, c => { grain(c, base, 0.15, 290); c.rect(3, 6, 5, 8, H(0x111111)); c.rect(10, 6, 12, 8, H(0x111111)); if (s === 'creeper_head') { c.rect(6, 9, 9, 12, H(0x111111)); c.rect(5, 11, 10, 14, H(0x111111)); } });
  }
  // redstone
  def('redstone_dust_dot', c => { c.clear(); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) if (Math.hypot(x - 7.5, y - 7.5) < 3.2) c.px(x, y, [220, 220, 220]); c.px(7, 7, [255, 255, 255]); });
  def('redstone_dust_line0', c => { c.clear(); for (let y = 0; y < 16; y++) for (let x = 6; x < 10; x++) if (c.n(x, y, 291) > 0.1) c.px(x, y, [200 + c.n(x, y, 292) * 55, 200 + c.n(x, y, 292) * 55, 200 + c.n(x, y, 292) * 55]); });
  def('repeater', c => { c.copy('smooth_stone'); c.rect(7, 3, 8, 13, H(0x6a1a1a)); c.rect(6, 12, 9, 12, H(0x6a1a1a)); });
  def('repeater_on', c => { c.copy('smooth_stone'); c.rect(7, 3, 8, 13, H(0xff2a1a)); c.rect(6, 12, 9, 12, H(0xff2a1a)); });
  def('comparator', c => { c.copy('smooth_stone'); c.rect(4, 3, 11, 4, H(0x6a1a1a)); c.rect(7, 4, 8, 12, H(0x6a1a1a)); });
  def('comparator_on', c => { c.copy('smooth_stone'); c.rect(4, 3, 11, 4, H(0xff2a1a)); c.rect(7, 4, 8, 12, H(0xff2a1a)); });
  def('lever', c => { c.clear(); c.rect(7, 6, 8, 15, H(0x8a6a3a)); c.rect(7, 6, 7, 15, H(0xa2834f)); });
  def('redstone_lamp', c => { c.each((x, y) => c.px(x, y, pick([0x4a2a14, 0x5a3418, 0x6b3f1e], c.n(x, y, 293)))); c.rect(2, 2, 13, 13, H(0x6a3a1a)); c.each((x, y) => { if ((x === 4 || x === 11 || y === 4 || y === 11) && x > 2 && x < 13 && y > 2 && y < 13) c.px(x, y, H(0x8a5a2a)); }); });
  def('redstone_lamp_on', c => { c.each((x, y) => c.px(x, y, pick([0x9a6a2a, 0xb07a30, 0xc08a3a], c.n(x, y, 294)))); c.rect(2, 2, 13, 13, H(0xf7d084)); c.each((x, y) => { if ((x === 4 || x === 11 || y === 4 || y === 11) && x > 2 && x < 13 && y > 2 && y < 13) c.px(x, y, H(0xfff4c8)); }); });
  def('piston_top', c => { c.copy('oak_planks'); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x6b5128)); }); c.rect(6, 6, 9, 9, H(0x9a9a9a)); });
  def('piston_top_sticky', c => { c.copy('piston_top'); c.rect(2, 2, 13, 13, H(0x7fcf6a)); c.rect(5, 5, 10, 10, H(0x5ca84a)); });
  def('piston_side', c => { c.copy('cobblestone'); c.rect(0, 0, 15, 3, pick(WOOD.oak.planks, 0.5)); c.rect(0, 3, 15, 3, H(0x6b5128)); });
  def('piston_bottom', c => { c.copy('cobblestone'); c.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) c.px(x, y, H(0x4a4a4a)); }); });
  def('piston_inner', c => { c.copy('cobblestone'); c.rect(6, 6, 9, 9, H(0x9a9a9a)); });
  def('observer_front', c => { c.copy('furnace_top'); c.rect(2, 4, 13, 6, H(0x2a2a2a)); c.rect(5, 9, 10, 12, H(0x2a2a2a)); c.rect(6, 10, 9, 11, H(0x5a5a5a)); });
  def('observer_side', c => { c.copy('furnace_top'); c.rect(7, 2, 8, 13, H(0x3a3a3a)); c.rect(5, 4, 10, 4, H(0x3a3a3a)); });
  def('observer_top', c => { c.copy('furnace_top'); c.rect(2, 7, 13, 8, H(0x3a3a3a)); });
  def('observer_back', c => { c.copy('furnace_top'); c.rect(6, 6, 9, 9, H(0x4a1a1a)); });
  def('observer_back_on', c => { c.copy('furnace_top'); c.rect(6, 6, 9, 9, H(0xff2a1a)); });
  def('hopper_outside', c => c.each((x, y) => c.px(x, y, pick([0x3a3a3a, 0x444444, 0x4e4e4e], c.n(x, y, 295)))));
  def('hopper_top', c => { c.copy('hopper_outside'); c.rect(2, 2, 13, 13, [0, 0, 0], 0); });
  def('hopper_inside', c => c.each((x, y) => c.px(x, y, pick([0x2a2a2a, 0x333333], c.n(x, y, 296)))));
  def('dispenser_front', c => { c.copy('furnace_side'); c.rect(5, 5, 10, 10, H(0x2a2a2a)); c.rect(6, 6, 9, 9, H(0x111111)); });
  def('dispenser_front_vertical', c => { c.copy('furnace_top'); c.rect(5, 5, 10, 10, H(0x2a2a2a)); });
  def('dropper_front', c => { c.copy('furnace_side'); c.rect(5, 6, 10, 9, H(0x2a2a2a)); });
  def('dropper_front_vertical', c => { c.copy('furnace_top'); c.rect(5, 6, 10, 9, H(0x2a2a2a)); });
  def('tnt_side', c => { c.each((x, y) => c.px(x, y, y < 5 || y > 10 ? pick([0xb52a1a, 0xc8321f, 0xd83a26], c.n(x, y, 297)) : H(0xf0eee8))); c.each((x, y) => { if (x % 4 === 0 && (y < 5 || y > 10)) c.px(x, y, H(0x8a1a10)); }); c.rect(2, 6, 3, 9, H(0x1a1a1a)); c.rect(5, 6, 6, 9, H(0x1a1a1a)); c.rect(8, 6, 9, 9, H(0x1a1a1a)); c.rect(11, 6, 13, 9, H(0x1a1a1a)); c.rect(12, 7, 12, 8, H(0xf0eee8)); });
  def('tnt_top', c => { c.each((x, y) => c.px(x, y, pick([0xb52a1a, 0xc8321f, 0xd83a26], c.n(x, y, 298)))); c.rect(6, 6, 9, 9, H(0x3a3a3a)); c.rect(7, 7, 8, 8, H(0xe8e2d5)); });
  def('tnt_bottom', c => c.each((x, y) => c.px(x, y, pick([0xb52a1a, 0xc8321f, 0xd83a26], c.n(x, y, 299)))));
  def('daylight_detector_top', c => { c.each((x, y) => c.px(x, y, (x + y) % 2 ? H(0xdcd4c0) : H(0x8ab0c8))); c.rect(0, 0, 15, 1, H(0x6b5128)); });
  def('daylight_detector_inverted_top', c => { c.each((x, y) => c.px(x, y, (x + y) % 2 ? H(0x4a5a7a) : H(0x2a3a5a))); c.rect(0, 0, 15, 1, H(0x6b5128)); });
  def('daylight_detector_side', c => { c.copy('oak_planks'); });
  def('target_side', c => { c.copy('hay_block_side'); c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (Math.floor(d) % 4 < 2) c.px(x, y, H(0xe8e2d5)); else c.px(x, y, H(0xd8241b)); }); });
  def('target_top', c => c.copy('hay_block_top'));
  def('tripwire_hook', c => { c.clear(); c.rect(7, 2, 8, 12, H(0x8a8a8a)); c.rect(6, 1, 9, 2, H(0x5a5a5a)); });
  def('tripwire', c => { c.clear(); c.rect(0, 7, 15, 7, H(0xc8c8c8)); });
  def('lightning_rod', c => { c.clear(); c.rect(0, 0, 1, 15, H(0xc87a4a)); c.rect(2, 0, 5, 3, H(0xd88a5a)); });
  for (const r of ['rail', 'powered_rail', 'detector_rail', 'activator_rail']) {
    const rc = { rail: 0x8a8a8a, powered_rail: 0xd8b44a, detector_rail: 0x8a8a8a, activator_rail: 0x8a8a8a }[r];
    const railDraw = (c, on) => { c.clear(); for (let y = 0; y < 16; y++) { c.px(2, y, H(rc)); c.px(13, y, H(rc)); c.px(3, y, mul(H(rc), 0.75)); c.px(12, y, mul(H(rc), 0.75)); } for (let y = 1; y < 16; y += 4) c.rect(1, y, 14, y + 1, pick(WOOD.oak.planks, 0.3)); if (r !== 'rail') for (let y = 2; y < 16; y += 4) c.rect(6, y, 9, y, H(on ? 0xff2a1a : (r === 'activator_rail' ? 0x8a2a1a : 0x5a1a1a))); if (r === 'detector_rail') c.rect(6, 6, 9, 9, H(on ? 0xff2a1a : 0x5a5a5a)); };
    def(r, c => railDraw(c, false)); if (r !== 'rail') def(r + '_on', c => railDraw(c, true));
  }
  def('rail_corner', c => { c.clear(); for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI / 2; for (const rr of [2.5, 13.5]) { const x = Math.round(16 - Math.cos(t) * rr), y = Math.round(16 - Math.sin(t) * rr); c.px(x, y, H(0x8a8a8a)); } } for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4 * Math.PI / 2; c.line(Math.round(16 - Math.cos(t) * 1), Math.round(16 - Math.sin(t) * 1), Math.round(16 - Math.cos(t) * 15), Math.round(16 - Math.sin(t) * 15), pick(WOOD.oak.planks, 0.3)); } });
  def('missing', c => c.each((x, y) => c.px(x, y, ((x >> 3) + (y >> 3)) % 2 ? [248, 0, 248] : [0, 0, 0])));
  // breaking cracks: drawn with a multiply blend, so mid grey leaves the block unchanged and dark pixels are cracks
  def('destroy_stage', (c, f) => { c.fill([128, 128, 128]); for (let i = 0; i < (f + 1) * 5; i++) { let x = Math.floor(c.n(i, 1, 300) * 16), y = Math.floor(c.n(i, 2, 300) * 16); for (let k = 0; k < 4 + f; k++) { c.px(x, y, [52, 52, 52]); x = (x + Math.round(c.n(i, k, 301) * 2 - 1) + 16) & 15; y = (y + Math.round(c.n(i, k, 302) * 2 - 1) + 16) & 15; } } }, 10);

  // ---------------------------------------------------------------- unknown names: a reasonable guess from the name
  function fallback(name) {
    for (const k of COLORS) if (name.startsWith(k + '_')) { const col = WOOL[k]; return { fn: c => grain(c, col, 0.12, 303), frames: 1 }; }
    if (name.includes('planks')) return { fn: c => planks(c, WOOD.oak.planks, WOOD.oak.seam), frames: 1 };
    if (!fallback.warned) fallback.warned = {}; if (!fallback.warned[name]) { fallback.warned[name] = 1; if (Tex.debug) console.warn('no texture', name); }
    return painters.missing;
  }

  // ---------------------------------------------------------------- the texture array
  function get(name) {
    let e = index[name];
    if (e) return e;
    const p = painters[name] || fallback(name);
    const frames = p.frames || 1;
    e = { layer: layers.length, frames: frames > 1 ? frames : 0, mask: false };
    for (let f = 0; f < frames; f++) { const d = paint(name, f); layers.push(d); if (d.mask) e.mask = true; }
    index[name] = e;
    if (built) dirty = true;
    return e;
  }
  let built = false, dirty = false, texture = null;
  function build() {
    // register every block texture up front so the array is complete before the first frame
    for (const d of BLOCKS) for (const k of ['up', 'down', 'north', 'south', 'west', 'east']) if (d.tex[k]) get(d.tex[k]);
    for (const n in painters) get(n);
    return upload();
  }
  function upload() {
    const n = layers.length, data = new Uint8Array(n * 1024);
    for (let i = 0; i < n; i++) data.set(layers[i], i * 1024);
    if (!texture) {
      texture = new THREE.DataArrayTexture(data, 16, 16, n);
      texture.format = THREE.RGBAFormat; texture.type = THREE.UnsignedByteType;
      texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestMipmapLinearFilter; texture.generateMipmaps = true;
      texture.anisotropy = 4;
    } else { texture.image = { data, width: 16, height: 16, depth: n }; }
    texture.needsUpdate = true; built = true; dirty = false;
    return texture;
  }
  function refresh() { if (dirty) upload(); }
  // the pixels of a texture (frame 0), for icons and particles
  function pixels(name) { return paint(painters[name] ? name : 'missing', 0); }
  function missing() { const out = []; for (const d of BLOCKS) for (const k of ['up', 'down', 'north', 'south', 'west', 'east']) { const n = d.tex[k]; if (n && !painters[n] && !out.includes(n)) out.push(n); } return out; }
  return { missing, get, build, refresh, pixels, def, paint, ctx, H, mul, mixc, pick, WOOL, CLR, CONCRETE, TERRA, WOOD, has: n => !!painters[n], get texture() { return texture; } };
})();
