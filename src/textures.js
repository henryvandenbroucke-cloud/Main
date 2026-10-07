'use strict';
/* Procedural 16x16 pixel-art texture atlas. Every texture is painted in code here. */
const TILE = 16, ATLAS_N = 16;
const Atlas = { canvas: null, tiles: {}, count: 0 };

(function buildAtlas() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = TILE * ATLAS_N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cv.width, cv.height);
  let seed = 7;
  const R = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const H = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const vary = (c, a) => mul(c, 1 + (R() - 0.5) * a);

  function tile(name, fn) {
    const i = Atlas.count++;
    const ox = (i % ATLAS_N) * TILE, oy = Math.floor(i / ATLAS_N) * TILE;
    Atlas.tiles[name] = i;
    const buf = [];
    const px = (x, y, c, a) => {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
      const o = ((oy + y) * cv.width + ox + x) * 4;
      img.data[o] = Math.max(0, Math.min(255, c[0])); img.data[o + 1] = Math.max(0, Math.min(255, c[1]));
      img.data[o + 2] = Math.max(0, Math.min(255, c[2])); img.data[o + 3] = a === undefined ? 255 : a;
      buf[x + y * TILE] = c;
    };
    const get = (x, y) => buf[(x & 15) + (y & 15) * TILE] || [0, 0, 0];
    fn(px, get);
  }
  const noiseFill = (px, base, amt) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(base, amt)); };
  const speckle = (px, col, n, amt) => { for (let i = 0; i < n; i++) px(R() * 16, R() * 16, vary(col, amt || 0.15)); };

  // ---------- natural
  const GRASS = H(0x5f9f3c), DIRT = H(0x7b573a), STONE = H(0x8a8a8c);
  tile('grass_top', px => { noiseFill(px, GRASS, 0.22); speckle(px, H(0x4c8a2e), 30); speckle(px, H(0x76b84c), 18); });
  tile('dirt', px => { noiseFill(px, DIRT, 0.2); speckle(px, H(0x5d3f28), 26); speckle(px, H(0x98785a), 8); });
  tile('grass_side', (px, get) => {
    noiseFill(px, DIRT, 0.2); speckle(px, H(0x5d3f28), 22);
    for (let x = 0; x < 16; x++) { const d = 2 + Math.floor(R() * 3) + (R() < 0.2 ? 2 : 0); for (let y = 0; y < d; y++) px(x, y, vary(GRASS, 0.22)); }
  });
  tile('stone', px => {
    noiseFill(px, STONE, 0.12);
    for (let k = 0; k < 5; k++) { let x = R() * 16, y = R() * 16; for (let s = 0; s < 6; s++) { px(x, y, H(0x6c6c70)); x += R() * 2 - 0.5; y += R() * 2 - 1; } }
    speckle(px, H(0xa2a2a6), 12);
  });
  const cells = (px, base, mortar, n, amt) => {
    const pts = []; for (let i = 0; i < n; i++) pts.push([R() * 16, R() * 16, 1 + (R() - 0.5) * amt]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let d1 = 99, d2 = 99, best = 0;
      for (const p of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const d = Math.hypot(x - p[0] - ox, y - p[1] - oy);
        if (d < d1) { d2 = d1; d1 = d; best = p[2]; } else if (d < d2) d2 = d;
      }
      px(x, y, d2 - d1 < 1.1 ? vary(mortar, 0.1) : vary(mul(base, best), 0.1));
    }
  };
  tile('cobble', px => cells(px, H(0x7e7e80), H(0x4a4a4e), 9, 0.35));
  tile('sand', px => { noiseFill(px, H(0xe3d498), 0.1); speckle(px, H(0xc9b878), 20); });
  tile('sandstone', px => { for (let y = 0; y < 16; y++) { const b = y % 5 === 4 ? H(0xbfa66a) : H(0xd9c48a); for (let x = 0; x < 16; x++) px(x, y, vary(b, 0.08)); } });
  tile('sandstone_top', px => { noiseFill(px, H(0xdcc78e), 0.07); });
  tile('terracotta', px => { noiseFill(px, H(0xb8683e), 0.1); });
  tile('log_side', px => { for (let x = 0; x < 16; x++) { const c = x % 4 === 0 ? H(0x4a3420) : H(0x664a2c); for (let y = 0; y < 16; y++) px(x, y, vary(c, 0.18)); } speckle(px, H(0x3a2817), 10); });
  tile('log_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); const c = d > 6.8 ? H(0x5a4027) : (Math.floor(d) % 2 ? H(0xb48c5a) : H(0x9c774a)); px(x, y, vary(c, 0.08)); } });
  tile('leaves', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (R() < 0.16) { px(x, y, [0, 0, 0], 0); continue; } px(x, y, vary(R() < 0.3 ? H(0x2f6e24) : H(0x418a30), 0.25)); } });
  tile('leaves_dark', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (R() < 0.16) { px(x, y, [0, 0, 0], 0); continue; } px(x, y, vary(R() < 0.3 ? H(0x23502a) : H(0x2f6636), 0.25)); } });
  tile('leaves_blossom', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (R() < 0.15) { px(x, y, [0, 0, 0], 0); continue; } px(x, y, vary(R() < 0.25 ? H(0xe7a2c4) : H(0xf3c3da), 0.18)); } });
  tile('ash', px => { noiseFill(px, H(0x48423f), 0.2); speckle(px, H(0x2c2726), 20); speckle(px, H(0xd2551e), 3, 0.3); });
  tile('basalt', px => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(x, y, vary(x % 5 === 0 ? H(0x2a2a30) : H(0x3d3c44), 0.12)); });
  tile('cactus_side', px => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(x, y, vary(x % 4 === 1 ? H(0x2f7a2c) : H(0x3e9a3a), 0.12)); for (let i = 0; i < 10; i++) px(1 + Math.floor(R() * 4) * 4, R() * 16, H(0xe8e0b0)); });
  tile('cactus_top', px => { noiseFill(px, H(0x4aa844), 0.1); for (let i = 0; i < 16; i++) { px(i, 0, H(0x2f7a2c)); px(i, 15, H(0x2f7a2c)); px(0, i, H(0x2f7a2c)); px(15, i, H(0x2f7a2c)); } });
  tile('bedrock', px => cells(px, H(0x4a4a4a), H(0x1e1e1e), 7, 0.6));
  tile('snow', px => { noiseFill(px, H(0xf0f4f8), 0.04); });
  tile('gravel', px => cells(px, H(0x8c847c), H(0x5c5650), 14, 0.4));
  tile('farmland', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(y % 4 === 0 ? H(0x3e2a1a) : H(0x5a3d26), 0.12)); });
  tile('path', px => { noiseFill(px, H(0x9e8456), 0.14); speckle(px, H(0x7c6640), 24); speckle(px, H(0xb59d6c), 10); });
  tile('crystal', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const f = ((x + y) % 8 < 4) ? 1.0 : 0.8; const g = ((x - y + 16) % 6 === 0) ? 1.25 : 1; px(x, y, vary(mul(H(0x56d2f0), f * g), 0.08)); }
    for (let i = 0; i < 6; i++) px(R() * 16, R() * 16, [255, 255, 255]);
  });
  tile('crystal_rose', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const f = ((x + y) % 8 < 4) ? 1.0 : 0.8; px(x, y, vary(mul(H(0xd77cf0), f), 0.08)); }
    for (let i = 0; i < 6; i++) px(R() * 16, R() * 16, [255, 240, 255]);
  });
  const ore = (name, spot, n) => tile(name, px => {
    noiseFill(px, STONE, 0.12);
    for (let k = 0; k < n; k++) { const cx = 2 + R() * 12, cy = 2 + R() * 12; for (let j = 0; j < 4; j++) px(cx + R() * 2.5, cy + R() * 2.5, vary(H(spot), 0.15)); }
  });
  ore('iron_ore', 0xd2a07c, 5); ore('gold_ore', 0xf2d23a, 4); ore('coal_ore', 0x26262a, 6); ore('lapis_ore', 0x2a4ad8, 6);
  // enchanting table: an open book on red cloth over dark obsidian carved with lapis runes
  tile('ench_top', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = vary(H(0x8a1a22), 0.08);
      if (x === 0 || y === 0 || x === 15 || y === 15) c = H(0x2a1a2e);
      if ((x <= 1 || x >= 14) && (y <= 1 || y >= 14)) c = H(0x5ad8e8);
      if (x >= 3 && x <= 12 && y >= 4 && y <= 11) c = vary(x === 7 || x === 8 ? H(0xb8a888) : H(0xeee4c8), 0.04);
      if (x >= 3 && x <= 12 && (y === 4 || y === 11)) c = H(0x6a3a1a);
      if (x >= 4 && x <= 11 && x !== 7 && x !== 8 && y >= 6 && y <= 9 && (x + y) % 2 === 0) c = H(0x5a4a8a);
      px(x, y, c);
    }
  });
  tile('ench_side', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = vary(H(0x1e1428), 0.12);
      if (y < 4) c = vary(H(0x8a1a22), 0.08);
      if (y === 4) c = H(0x5a0e14);
      if (y > 4 && ((x * 3 + y * 5) % 11 === 0 || (x === 4 && y > 7 && y < 13) || (x === 11 && y > 6 && y < 12) || (y === 9 && x > 5 && x < 10))) c = H(0x3a6ae8);
      px(x, y, c);
    }
  });
  tile('ench_bottom', px => noiseFill(px, H(0x1e1428), 0.12));

  // ---------- liquids
  tile('water', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin((x + y * 0.5) * 0.8) * 0.5 + 0.5; px(x, y, mix(H(0x2d5fc8), H(0x5a8ef0), w * 0.6 + R() * 0.15)); } });
  tile('lava', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) * 0.5 + 0.5; px(x, y, mix(H(0xd23a08), H(0xffb02a), w * 0.8 + R() * 0.2)); } });

  // ---------- building
  tile('planks', px => {
    for (let y = 0; y < 16; y++) { const row = Math.floor(y / 4), joint = (row * 7 + 3) % 16; for (let x = 0; x < 16; x++) { let c = H(0xb08550); if (y % 4 === 3 || x === joint) c = H(0x6e4f2c); px(x, y, vary(c, 0.12)); } }
  });
  tile('planks_dark', px => {
    for (let y = 0; y < 16; y++) { const row = Math.floor(y / 4), joint = (row * 5 + 2) % 16; for (let x = 0; x < 16; x++) { let c = H(0x6a4a2c); if (y % 4 === 3 || x === joint) c = H(0x3c2a18); px(x, y, vary(c, 0.12)); } }
  });
  const bricks = (name, base, mortar, moss) => tile(name, px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
      let c = (y % 4 === 3 || (x + off) % 8 === 7) ? mortar : base;
      if (moss && R() < 0.22 && (y < 6 || R() < 0.4)) c = H(0x4f7a34);
      px(x, y, vary(c, 0.1));
    }
  });
  bricks('stonebrick', H(0x8c8c90), H(0x55555a), false);
  bricks('mossybrick', H(0x82867e), H(0x4c524a), true);
  bricks('darkbrick', H(0x3c2f40), H(0x1c1420), false);
  bricks('redbrick', H(0x9c4a38), H(0xc8b8a8), false);
  bricks('sandbrick', H(0xd4bc80), H(0xa48a54), false);
  tile('darkbrick_cracked', (px, get) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0; px(x, y, vary((y % 4 === 3 || (x + off) % 8 === 7) ? H(0x1c1420) : H(0x3c2f40), 0.1)); }
    let x = 3, y = 0; while (y < 16) { px(x, y, H(0xe0461a)); x += Math.round(R() * 2 - 1); y++; }
  });
  tile('thatch', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary((x + y * 2) % 5 === 0 ? H(0x9c7a2a) : H(0xccaa48), 0.16)); });
  tile('roof_red', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(y % 4 === 3 ? H(0x6e2418) : ((x + (Math.floor(y / 4) % 2) * 2) % 4 === 0 ? H(0x8a3020) : H(0xa83c28)), 0.08)); });
  tile('roof_blue', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(y % 4 === 3 ? H(0x1e2e50) : ((x + (Math.floor(y / 4) % 2) * 2) % 4 === 0 ? H(0x2c4272) : H(0x38528a)), 0.08)); });
  tile('plaster', px => { noiseFill(px, H(0xe8dfcc), 0.05); speckle(px, H(0xcfc4ac), 10); });
  tile('timber', px => { noiseFill(px, H(0xe8dfcc), 0.05); for (let i = 0; i < 16; i++) { px(i, 0, H(0x5a3d22)); px(i, 15, H(0x5a3d22)); px(0, i, H(0x5a3d22)); px(15, i, H(0x5a3d22)); px(i, i, H(0x5a3d22)); } });
  tile('glass', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      if (edge) px(x, y, H(0x6a4a2c)); else if ((x === 7 || x === 8) || (y === 7 || y === 8)) px(x, y, H(0x6a4a2c));
      else if (x - y === 3 || x - y === 4) px(x, y, [230, 245, 255], 150); else px(x, y, [190, 220, 240], 60);
    }
  });
  const wool = (name, c) => tile(name, px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary((x + y) % 3 === 0 ? mul(H(c), 0.88) : H(c), 0.08)); });
  wool('wool_red', 0xb83232); wool('wool_white', 0xe8e4dc); wool('wool_blue', 0x34509c); wool('wool_green', 0x4a7a32); wool('wool_yellow', 0xd8b030); wool('wool_purple', 0x7a3ea0);
  tile('hay_side', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = (y === 4 || y === 11) ? H(0x8a2a1a) : (x % 3 === 0 ? H(0xb8962a) : H(0xd6b43a)); px(x, y, vary(c, 0.1)); } });
  tile('hay_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(Math.hypot(x - 7.5, y - 7.5) % 3 < 1 ? H(0xb8962a) : H(0xd6b43a), 0.12)); });
  tile('bookshelf', px => {
    const cols = [0x8a2a2a, 0x2a4a8a, 0x3a7a3a, 0x8a7a2a, 0x6a2a7a, 0x2a6a6a];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (y < 2 || y > 13 || y === 7 || y === 8) { px(x, y, vary(H(0xa07a48), 0.1)); continue; }
      const book = Math.floor(x / 2) + (y > 8 ? 3 : 0); px(x, y, vary(x % 2 === 1 && R() < 0.3 ? H(0x1a1410) : H(cols[book % cols.length]), 0.15));
    }
  });
  tile('chest_front', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || x === 15 || y === 0 || y === 15 || y === 6; px(x, y, vary(edge ? H(0x4a3012) : H(0x9c6a2e), 0.1)); }
    for (let y = 5; y < 9; y++) for (let x = 6; x < 10; x++) px(x, y, (y === 7 && (x === 7 || x === 8)) ? H(0x2a2a2a) : H(0xd8b44a));
  });
  tile('chest_side', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || x === 15 || y === 0 || y === 15 || y === 6; px(x, y, vary(edge ? H(0x4a3012) : H(0x8e5f28), 0.1)); } });
  tile('chest_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || x === 15 || y === 0 || y === 15; px(x, y, vary(edge ? H(0x4a3012) : H(0xa47232), 0.1)); } });
  tile('chest_open', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || x === 15 || y === 0 || y === 15; px(x, y, vary(edge ? H(0x4a3012) : H(0x2a1a0c), 0.1)); } });
  tile('barrel_side', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary((y === 2 || y === 13) ? H(0x4a4a50) : (x % 4 === 0 ? H(0x5e4024) : H(0x7e5630)), 0.1)); });
  tile('barrel_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); px(x, y, vary(d > 6.5 ? H(0x4a4a50) : (d < 2 ? H(0x3a2614) : H(0x7e5630)), 0.1)); } });
  tile('crate', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const e = x < 2 || x > 13 || y < 2 || y > 13 || Math.abs(x - y) < 1.5; px(x, y, vary(e ? H(0x6a4a24) : H(0xb08a50), 0.1)); } });
  tile('furnace_front', px => {
    noiseFill(px, H(0x707074), 0.1);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, y > 11 ? vary(H(0xff8a24), 0.2) : H(0x1a1a1a));
    for (let x = 3; x < 13; x++) px(x, 7, H(0x4a4a4e));
  });
  tile('furnace_side', px => { noiseFill(px, H(0x707074), 0.1); for (let i = 0; i < 16; i++) { px(i, 0, H(0x4a4a4e)); px(i, 15, H(0x4a4a4e)); } });
  tile('lamp', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 2 || x > 13 || y < 2 || y > 13 || x === 7 || x === 8;
      px(x, y, frame ? H(0x2e2a26) : vary(mix(H(0xffd27a), H(0xfff2c8), 1 - Math.hypot(x - 7.5, y - 7.5) / 8), 0.06));
    }
  });
  tile('torch', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0);
    for (let y = 6; y < 16; y++) { px(7, y, H(0x6a4a2a)); px(8, y, H(0x58401e)); }
    for (let y = 3; y < 7; y++) for (let x = 6; x < 10; x++) px(x, y, y < 5 ? H(0xffe46a) : H(0xff9a2a));
    px(7, 2, H(0xffffff)); px(8, 2, H(0xfff2b0));
  });
  tile('tablet', px => {
    noiseFill(px, H(0xb0aca2), 0.06);
    for (let i = 0; i < 16; i++) { px(i, 0, H(0xc9a640)); px(i, 15, H(0xc9a640)); px(0, i, H(0xc9a640)); px(15, i, H(0xc9a640)); }
    for (let r = 3; r < 13; r += 3) for (let x = 3; x < 13; x++) if (R() < 0.7) px(x, r, H(0x4a4640));
  });
  tile('tablet_side', px => { noiseFill(px, H(0x9e9a90), 0.06); });
  tile('waystone', px => {
    noiseFill(px, H(0x36384a), 0.1);
    const rune = [[7, 2], [7, 3], [7, 4], [6, 5], [8, 5], [5, 6], [9, 6], [7, 7], [7, 8], [7, 9], [6, 10], [8, 10], [7, 11], [7, 12], [5, 13], [9, 13]];
    for (const [x, y] of rune) px(x, y, H(0x6ef0ff));
  });
  tile('waystone_top', px => { noiseFill(px, H(0x36384a), 0.1); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, H(0x6ef0ff)); });
  tile('spawner', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const bar = x % 4 === 0 || y % 4 === 0;
      px(x, y, bar ? vary(H(0x2a2c36), 0.1) : vary(H(0x7a1e10), 0.4));
    }
  });
  tile('altar', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary((x + y) % 4 === 0 ? H(0x4a2a6a) : H(0x2a2236), 0.1)); });
  tile('iron_block', px => { noiseFill(px, H(0xc8c8cc), 0.04); for (let i = 0; i < 16; i++) { px(i, 0, H(0x9a9aa0)); px(0, i, H(0x9a9aa0)); px(i, 15, H(0x7a7a80)); px(15, i, H(0x7a7a80)); } });
  tile('gold_block', px => { noiseFill(px, H(0xf0c838), 0.06); for (let i = 0; i < 16; i++) { px(i, 0, H(0xfff08a)); px(0, i, H(0xfff08a)); px(i, 15, H(0xb08a1a)); px(15, i, H(0xb08a1a)); } });
  tile('rail', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); for (let y = 0; y < 16; y++) { px(3, y, H(0x8a8a90)); px(12, y, H(0x8a8a90)); if (y % 4 === 1) for (let x = 1; x < 15; x++) px(x, y, H(0x6a4a2a)); } });
  tile('fence', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); for (let y = 0; y < 16; y++) { px(2, y, H(0x8a6438)); px(3, y, H(0x6e4f2c)); px(12, y, H(0x8a6438)); px(13, y, H(0x6e4f2c)); } for (let x = 0; x < 16; x++) { px(x, 4, H(0x9a7444)); px(x, 5, H(0x6e4f2c)); px(x, 10, H(0x9a7444)); px(x, 11, H(0x6e4f2c)); } });
  tile('net', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) ? H(0xd8cfa8) : [0, 0, 0], ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) ? 255 : 0); });
  tile('web', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const on = x === y || x === 15 - y || x === 7 || y === 7 || Math.abs(Math.hypot(x - 7.5, y - 7.5) - 5) < 0.5; px(x, y, [230, 230, 235], on ? 210 : 0); } });

  // ---------- plants (cross)
  const plant = (name, fn) => tile(name, px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); fn(px); });
  plant('tallgrass', px => { for (let b = 0; b < 7; b++) { let x = 1 + R() * 14; const h = 6 + R() * 9; for (let y = 15; y > 15 - h; y--) { px(x, y, vary(H(0x5c9c38), 0.25)); x += (R() - 0.5) * 0.8; } } });
  plant('wheat', px => { for (let b = 0; b < 6; b++) { const x = 1 + b * 2.6; for (let y = 15; y > 4; y--) px(x, y, y < 8 ? vary(H(0xe2c04a), 0.15) : vary(H(0xb8a03a), 0.15)); px(x + 1, 5, H(0xe8cc5a)); px(x - 1, 6, H(0xe8cc5a)); } });
  plant('flower_red', px => { for (let y = 8; y < 16; y++) px(7, y, H(0x3e7a2a)); px(6, 11, H(0x4e8a34)); for (const [x, y] of [[7, 4], [6, 5], [8, 5], [7, 6], [6, 6], [8, 6], [7, 5]]) px(x, y, x === 7 && y === 5 ? H(0xf0d040) : H(0xd02a2a)); });
  plant('flower_yellow', px => { for (let y = 9; y < 16; y++) px(8, y, H(0x3e7a2a)); for (const [x, y] of [[8, 6], [7, 7], [9, 7], [8, 8], [8, 7]]) px(x, y, H(0xf0d040)); });
  plant('flower_blue', px => { for (let y = 9; y < 16; y++) px(7, y, H(0x3e7a2a)); for (const [x, y] of [[7, 5], [6, 6], [8, 6], [7, 7], [6, 7], [8, 7]]) px(x, y, H(0x5a7ae8)); px(7, 6, H(0xffffff)); });
  plant('deadbush', px => { for (let b = 0; b < 4; b++) { let x = 7.5, y = 15; const dx = (R() - 0.5) * 1.6; for (let s = 0; s < 9; s++) { px(x, y, H(0x8a6a3a)); x += dx; y -= 1; } } });
  plant('mushroom', px => { for (let y = 10; y < 16; y++) { px(7, y, H(0xe8dcc4)); px(8, y, H(0xd8ccb4)); } for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) px(x, y, (x + y) % 3 === 0 ? H(0xffffff) : H(0xc82a2a)); });
  plant('glowshroom', px => { for (let y = 10; y < 16; y++) { px(7, y, H(0x9ae8e8)); } for (let y = 6; y < 10; y++) for (let x = 4; x < 12; x++) px(x, y, (x + y) % 3 === 0 ? H(0xffffff) : H(0x3ad8e8)); });
  plant('fire', px => { for (let x = 2; x < 14; x++) { const h = 6 + R() * 9; for (let y = 15; y > 15 - h; y--) px(x, y, y > 15 - h * 0.4 ? H(0xff6a1a) : y > 15 - h * 0.8 ? H(0xffaa2a) : H(0xffe46a)); } });
  plant('crystal_cluster', px => { for (const [cx, w, h] of [[4, 2, 8], [8, 3, 12], [12, 2, 7]]) for (let y = 15; y > 15 - h; y--) for (let x = cx - w / 2; x < cx + w / 2; x++) px(x, y, vary(y < 15 - h + 2 ? H(0xbff6ff) : H(0x56d2f0), 0.1)); });
  plant('sapling_dead', px => { let x = 7; for (let y = 15; y > 3; y--) { px(x, y, H(0x3a2a1e)); if (y === 9) { px(x + 1, y - 1, H(0x3a2a1e)); px(x + 2, y - 2, H(0x3a2a1e)); } if (y === 6) { px(x - 1, y - 1, H(0x3a2a1e)); px(x - 2, y - 2, H(0x3a2a1e)); } } });


  // ---------- extra
  tile('log_dark_side', px => { for (let x = 0; x < 16; x++) { const c = x % 3 === 0 ? H(0x2a2018) : H(0x3e3024); for (let y = 0; y < 16; y++) px(x, y, vary(c, 0.2)); } speckle(px, H(0x55644a), 10); });
  tile('log_dark_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); px(x, y, vary(d > 6.8 ? H(0x2a2018) : (Math.floor(d) % 2 ? H(0x6a5238) : H(0x584430)), 0.08)); } });
  tile('mossycobble', px => { cells(px, H(0x7e7e80), H(0x4a4a4e), 9, 0.35); speckle(px, H(0x4f7a34), 40, 0.25); });
  tile('crackedbrick', (px) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0; px(x, y, vary((y % 4 === 3 || (x + off) % 8 === 7) ? H(0x55555a) : H(0x8c8c90), 0.1)); }
    let x = 2, y = 0; while (y < 16) { px(x, y, H(0x3a3a3e)); px(x + 1, y, H(0x5a5a5e)); x += Math.round(R() * 2 - 0.6); y++; }
    x = 12; y = 3; while (y < 14) { px(x, y, H(0x3a3a3e)); x += Math.round(R() * 2 - 1.4); y++; }
  });
  tile('polished', px => { noiseFill(px, H(0x9c9ca2), 0.04); for (let i = 0; i < 16; i++) { px(i, 0, H(0xb4b4ba)); px(0, i, H(0xb4b4ba)); px(i, 15, H(0x6a6a70)); px(15, i, H(0x6a6a70)); } });
  tile('ancient_gold', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(((x >> 2) + (y >> 2)) % 2 ? H(0xd8a828) : H(0xb8881a), 0.08)); for (let i = 3; i < 13; i++) { px(i, 7, H(0x6ef0ff)); px(7, i, H(0x6ef0ff)); } });
  tile('table_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const g = x === 5 || x === 10 || y === 5 || y === 10; px(x, y, vary(g ? H(0x5a3d22) : H(0xa07a48), 0.1)); } });
  tile('table_side', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(y < 3 ? H(0x5a3d22) : H(0x9a7444), 0.1)); for (let y = 5; y < 13; y++) { px(3, y, H(0x8a8a90)); px(4, y - 1, H(0x8a8a90)); px(11, y, H(0x6a4a2a)); px(12, y, H(0x6a4a2a)); } });
  tile('ladder', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); for (let y = 0; y < 16; y++) { px(2, y, H(0x7a5a32)); px(3, y, H(0x5e4426)); px(12, y, H(0x7a5a32)); px(13, y, H(0x5e4426)); } for (const y of [1, 5, 9, 13]) for (let x = 2; x < 14; x++) { px(x, y, H(0x8e6a3c)); px(x, y + 1, H(0x5e4426)); } });
  tile('lilypad', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); const cut = x > 7 && Math.abs(y - 7.5) < 1.2; px(x, y, vary(H(0x3e7a2a), 0.2), d < 7.2 && !cut ? 255 : 0); } px(5, 5, H(0xf0b0d0)); px(6, 5, H(0xf0b0d0)); px(5, 6, H(0xf8d0e8)); });
  tile('vines', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); for (let b = 0; b < 5; b++) { let x = 1 + b * 3 + R(); const len = 6 + R() * 10; for (let y = 0; y < len; y++) { px(x, y, vary(H(0x3e7a2a), 0.25)); if (R() < 0.3) px(x + 1, y, vary(H(0x4e8a34), 0.2)); x += (R() - 0.5) * 0.6; } } });
  tile('spikes', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, [0, 0, 0], 0); for (let s = 0; s < 4; s++) { const cx = 2 + s * 4; for (let y = 4; y < 16; y++) { const w = (y - 4) / 12 * 1.6; for (let x = cx - w; x <= cx + w; x++) px(x, y, y < 7 ? H(0xd8d8e0) : H(0x7a7a84)); } } });
  tile('portal', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin(x * 0.7 + y * 0.4) * 0.5 + 0.5; px(x, y, mix(H(0x9af0ff), H(0xffffff), w * 0.7), 200); } });
  tile('energy', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = Math.abs(x - 7.5) < 3 ? H(0xbaf8ff) : H(0x3ac8e8); px(x, y, vary(c, 0.12)); } });
  tile('cauldron', px => { noiseFill(px, H(0x3a3a40), 0.1); for (let x = 2; x < 14; x++) for (let y = 2; y < 6; y++) px(x, y, vary(H(0x6ac04a), 0.2)); });
  tile('pot', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(y === 3 || y === 12 ? H(0x5a2a18) : (y > 5 && y < 9 && (x % 4 === 1) ? H(0xe8d8a0) : H(0xa8582e)), 0.08)); });
  tile('banner_red', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(H(0xa82020), 0.08)); for (let y = 4; y < 12; y++) { px(7, y, H(0xe8c040)); px(8, y, H(0xe8c040)); } for (let x = 5; x < 11; x++) px(x, 6, H(0xe8c040)); });
  tile('runepillar', px => { noiseFill(px, H(0x5a5a64), 0.08); for (const [x, y] of [[4, 3], [5, 4], [6, 5], [7, 6], [8, 5], [9, 4], [10, 3], [7, 7], [7, 8], [7, 9], [5, 11], [6, 11], [8, 11], [9, 11], [7, 12]]) px(x, y, H(0x8af0d0)); });
  tile('berrybush', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 9); px(x, y, vary(H(0x3a7a2c), 0.25), d < 7 && R() > 0.12 ? 255 : 0); } for (let i = 0; i < 7; i++) { const x = 3 + R() * 10, y = 4 + R() * 9; px(x, y, H(0x4a6ae0)); px(x + 1, y, H(0x6a8af0)); } });
  tile('snow_side', px => { noiseFill(px, H(0x8a8a8c), 0.12); for (let x = 0; x < 16; x++) { const d = 2 + Math.floor(R() * 3); for (let y = 0; y < d; y++) px(x, y, vary(H(0xf0f4f8), 0.04)); } });
  tile('mud', px => { noiseFill(px, H(0x4a3a2c), 0.15); speckle(px, H(0x3a2c20), 30); });
  tile('swamp_grass', px => { noiseFill(px, H(0x4a6e34), 0.22); speckle(px, H(0x3a5a28), 30); speckle(px, H(0x5a7e40), 10); });
  tile('swamp_grass_side', px => { noiseFill(px, H(0x4a3a2c), 0.15); for (let x = 0; x < 16; x++) { const d = 2 + Math.floor(R() * 3); for (let y = 0; y < d; y++) px(x, y, vary(H(0x4a6e34), 0.2)); } });
  tile('fallen_star', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(H(0x2a2a3a), 0.2)); for (let i = 0; i < 18; i++) px(R() * 16, R() * 16, H(0x9af0ff)); });


  // ---------- storage & workshop blocks (v2, overrides the earlier tiles of the same name)
  const wood = (x, y, base, dark) => { const g = ((x * 7 + y * 3) % 5 === 0) ? 0.9 : 1; return vary(mul(H(base), g), 0.08); };
  tile('chest_front', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = wood(x, y, 0xa06a32);
      if (y % 4 === 3) c = H(0x7a4e22);
      if (x === 0 || x === 15) c = H(0x3e2810);
      if (y === 0 || y === 15) c = H(0x3e2810);
      if (y === 5) c = H(0x2a1a0a); if (y === 6) c = H(0x5a3a18);
      if ((x <= 1 || x >= 14) && (y <= 1 || y >= 14)) c = H(0x8a8a92);
      px(x, y, c);
    }
    for (let y = 4; y <= 8; y++) for (let x = 6; x <= 9; x++) px(x, y, (x === 6 || x === 9 || y === 4 || y === 8) ? H(0x5a5a62) : H(0xb8b8c2));
    px(7, 6, H(0x1a1a1e)); px(8, 6, H(0x1a1a1e)); px(7, 7, H(0x1a1a1e));
  });
  tile('chest_side', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = wood(x, y, 0x9a6430);
      if (y % 4 === 3) c = H(0x74491f);
      if (x === 0 || x === 15 || y === 0 || y === 15) c = H(0x3e2810);
      if (y === 5) c = H(0x2a1a0a); if (y === 6) c = H(0x5a3a18);
      if ((x <= 1 || x >= 14) && (y <= 1 || y >= 14)) c = H(0x8a8a92);
      px(x, y, c);
    }
  });
  tile('chest_top', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = wood(x, y, 0xaa7238);
      if (x % 4 === 3) c = H(0x7a4e22);
      if (x === 0 || x === 15 || y === 0 || y === 15) c = H(0x3e2810);
      if ((x <= 1 || x >= 14) && (y <= 1 || y >= 14)) c = H(0x8a8a92);
      px(x, y, c);
    }
  });
  tile('barrel_side', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const stave = Math.floor(x / 4), bulge = 1 - Math.abs(y - 7.5) / 22;
      let c = vary(mul(H(stave % 2 ? 0x8a5a2c : 0x7a4e26), bulge), 0.07);
      if (x % 4 === 0) c = H(0x4a2e14);
      if (y === 2 || y === 3 || y === 12 || y === 13) c = (y === 2 || y === 12) ? H(0x9a9aa4) : H(0x5c5c66);
      if ((y === 2 || y === 12) && x % 4 === 2) c = H(0xd8d8e0);
      px(x, y, c);
    }
  });
  tile('barrel_top', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      let c = vary(H(y % 4 === 0 ? 0x6a4420 : 0x96642e), 0.07);
      if (d > 6.2) c = H(0x5c5c66); if (d > 6.2 && d < 6.9) c = H(0x9a9aa4);
      if (d > 7.3) c = H(0x3a2410);
      if (Math.abs(x - 10) < 1.5 && Math.abs(y - 6) < 1.5) c = H(0x2a1808);
      px(x, y, c);
    }
  });
  tile('crate', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = wood(x, y, 0xc09a5e);
      if (y % 5 === 4) c = H(0x9a7642);
      const frame = x < 2 || x > 13 || y < 2 || y > 13, brace = Math.abs(x - y) < 1.2 && !frame;
      if (frame || brace) c = vary(H(0x7a5428), 0.06);
      if ((x === 1 || x === 14) && (y === 1 || y === 14)) c = H(0x4a4a50);
      px(x, y, c);
    }
  });
  tile('table_top', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = wood(x, y, 0xb48650);
      if (x === 0 || x === 15 || y === 0 || y === 15) c = H(0x6a4622);
      if ((x === 5 || x === 10 || y === 5 || y === 10) && x > 1 && x < 14 && y > 1 && y < 14) c = H(0x7a5228);
      px(x, y, c);
    }
    for (let i = 2; i < 6; i++) px(i + 8, 13 - i, H(0x8a8a92)); px(13, 7, H(0x5a3a1a)); px(12, 8, H(0x5a3a1a));
  });
  tile('table_side', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = wood(x, y, 0x9a7040);
      if (y < 3) c = vary(H(0x6a4622), 0.06);
      if (x < 2 || x > 13) c = vary(H(0x5a3a1c), 0.06);
      px(x, y, c);
    }
    for (let y = 5; y < 12; y++) { px(4, y, H(0x5a3a1a)); } for (let x = 3; x < 7; x++) px(x, 5, H(0x8a8a92));
    for (let y = 5; y < 13; y++) px(10 + (y % 2), y, H(0xb8b8c2)); for (let y = 11; y < 14; y++) px(10, y, H(0x5a3a1a));
  });
  // ---------- walls with more character
  tile('plaster', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const patch = ((Math.floor(x / 3) * 5 + Math.floor(y / 3) * 3) % 7) / 7;
      px(x, y, vary(mul(H(0xe6dcc6), 0.94 + patch * 0.08), 0.05));
    }
    let x = 3, y = 1; for (let i = 0; i < 6; i++) { px(x, y, H(0xb8ab92)); x += R() < 0.5 ? 1 : 0; y++; }
    for (let i = 0; i < 6; i++) px(R() * 16, 12 + R() * 4, H(0xcfc0a2));
    px(11, 9, H(0xb39a78)); px(12, 9, H(0xc4ad8c)); px(11, 10, H(0xc4ad8c));
  });
  tile('sandstone', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = vary(H(0xd9c48a), 0.06);
      if (y === 4 || y === 11) c = H(0xb59c62);
      if (y > 4 && y < 11 && (x + (y > 7 ? 4 : 0)) % 8 === 0) c = H(0xc2aa70);
      if (y === 7 && x % 4 === 1) c = H(0xe8d6a0);
      px(x, y, c);
    }
  });
  tile('stonebrick', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 4 : 0, bx = (x + off) % 8;
      let c = vary(mul(H(0x8c8c90), 1 + ((row * 3 + Math.floor((x + off) / 8)) % 3 - 1) * 0.05), 0.07);
      if (y % 4 === 3 || bx === 7) c = H(0x55555a);
      if (y % 4 === 0 && bx !== 7) c = mul(c, 1.08);
      px(x, y, c);
    }
  });
  tile('cobble', px => cells(px, H(0x82827e), H(0x48484c), 10, 0.3));
  tile('planks', px => {
    for (let y = 0; y < 16; y++) { const row = Math.floor(y / 4), joint = (row * 7 + 3) % 16, tone = [1, 0.94, 1.03, 0.97][row]; for (let x = 0; x < 16; x++) { let c = vary(mul(H(0xb08550), tone), 0.08); if ((x * 3 + y * 5) % 11 === 0) c = mul(c, 0.9); if (y % 4 === 3) c = H(0x6e4f2c); if (x === joint) c = H(0x7a5a34); if (x === joint + 1 && y % 4 === 1) c = H(0x4a3018); px(x, y, c); } }
  });


  // ---------- v3: richer natural textures (clustered tones, highlights and shadows; overrides earlier tiles)
  const tn = (x, y, cell, so) => { // tileable smooth value noise in 0..1
    const L = 16 / cell, gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const hh = (a, b) => { a = ((a % L) + L) % L; b = ((b % L) + L) % L; let h = (a * 374761393 + b * 668265263 + so * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (hh(ix, iy) * (1 - u) + hh(ix + 1, iy) * u) * (1 - v) + (hh(ix, iy + 1) * (1 - u) + hh(ix + 1, iy + 1) * u) * v;
  };
  const layered = (x, y, so) => tn(x, y, 8, so) * 0.5 + tn(x, y, 4, so + 1) * 0.3 + tn(x, y, 2, so + 2) * 0.2;
  const pal = (cols, t) => { const i = Math.max(0, Math.min(cols.length - 1, t * cols.length)); const a = Math.floor(Math.min(i, cols.length - 1.001)), f = i - a; return mix(H(cols[a]), H(cols[Math.min(cols.length - 1, a + 1)]), f); };
  const DIRT_P = [0x5a3d27, 0x6e4b31, 0x7d5839, 0x8f6a47];
  const paintDirt = (px, so) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary(pal(DIRT_P, layered(x, y, so)), 0.07); if (R() < 0.05) c = vary(H(0x8a8076), 0.1); if (R() < 0.04) c = H(0x4a3220); px(x, y, c); } };
  const GRASS_P = [0x3f7a2a, 0x4f8f33, 0x5fa23c, 0x72b54a];
  tile('dirt', px => paintDirt(px, 11));
  tile('grass_top', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(pal(GRASS_P, layered(x, y, 21)), 0.08));
    for (let i = 0; i < 22; i++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16); px(x, y, vary(H(0x86c858), 0.08)); px(x, (y + 1) & 15, vary(H(0x6aae44), 0.08)); }
    for (let i = 0; i < 14; i++) px(R() * 16, R() * 16, H(0x356a24));
  });
  tile('grass_side', px => {
    paintDirt(px, 12);
    for (let x = 0; x < 16; x++) {
      const d = 3 + Math.floor(tn(x, 0, 4, 5) * 3) + (R() < 0.18 ? 2 : 0);
      for (let y = 0; y < d; y++) px(x, y, vary(pal(GRASS_P, 0.35 + 0.6 * tn(x, y, 4, 22) - y * 0.05), 0.08));
      px(x, d, H(0x3a5a22));
    }
  });
  const STONE_P = [0x707074, 0x7e7e82, 0x8b8b8f, 0x98989c];
  const paintStone = (px, so) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(pal(STONE_P, layered(x, y, so)), 0.05));
    for (let k = 0; k < 4; k++) { let x = R() * 16, y = R() * 16, a = R() * 6.28; for (let i = 0; i < 4 + R() * 4; i++) { px(x, y, H(0x5e5e62)); px(x + 1, y, H(0x9e9ea2)); x += Math.cos(a); y += Math.sin(a) * 0.6; a += (R() - 0.5); } }
    for (let i = 0; i < 10; i++) px(R() * 16, R() * 16, H(0xa8a8ac));
  };
  tile('stone', px => paintStone(px, 31));
  const oreV3 = (name, c1, c2, c3) => tile(name, px => {
    paintStone(px, 32);
    // nuggets: small rounded clusters with a shadow below-right and a glint top-left
    const spots = [[3, 3], [10, 2], [6, 8], [12, 10], [2, 12]];
    for (const [sx, sy] of spots) {
      if (R() < 0.15) continue;
      const shape = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].filter(() => R() < 0.85);
      for (const [dx, dy] of shape) px(sx + dx + 1, sy + dy + 1, H(c3));
      for (const [dx, dy] of shape) px(sx + dx, sy + dy, vary(H(c1), 0.06));
      px(sx, sy, H(c2));
    }
  });
  oreV3('coal_ore', 0x2a2a2e, 0x4a4a52, 0x1a1a1e); oreV3('iron_ore', 0xd8a882, 0xf0c8a4, 0x8a6a52);
  oreV3('gold_ore', 0xf2d23a, 0xfff2a0, 0xa88a1a); oreV3('lapis_ore', 0x2a4ad8, 0x6a8aff, 0x18286a);
  tile('sand', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const rip = Math.sin((y + tn(x, y, 8, 41) * 4) * 1.4) * 0.5 + 0.5; let c = vary(pal([0xd2c086, 0xdccb92, 0xe6d6a0, 0xeee0ae], layered(x, y, 42) * 0.7 + rip * 0.3), 0.05); if (R() < 0.05) c = H(0xc4b07a); if (R() < 0.03) c = H(0xf6ecc4); px(x, y, c); } });
  tile('gravel', px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(H(0x6e665e), 0.08));
    for (let i = 0; i < 26; i++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16), c = H([0x9a928a, 0x847c74, 0xa8a098, 0x7a6e62, 0x8e8a86][Math.floor(R() * 5)]), r = R() < 0.5 ? 1 : 2;
      for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r + 1; dx++) px((x + dx) & 15, (y + dy) & 15, vary(c, 0.06)); px((x + r + 1) & 15, (y + r) & 15, H(0x4e4842)); px(x, y, mul(c, 1.15)); }
  });
  tile('snow', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, vary(pal([0xdce6f0, 0xe8eef6, 0xf2f6fa, 0xfafcff], layered(x, y, 51)), 0.02)); for (let i = 0; i < 8; i++) px(R() * 16, R() * 16, [255, 255, 255]); });
  tile('snow_side', px => { paintDirt(px, 13); for (let x = 0; x < 16; x++) { const d = 3 + Math.floor(tn(x, 0, 4, 6) * 3); for (let y = 0; y < d; y++) px(x, y, vary(H(0xf0f4fa), 0.03)); px(x, d, H(0xc8d2dc)); } });
  const leafV3 = (name, cols, gap) => tile(name, px => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const t = layered(x, y, 61); if (R() < gap * (1 - t)) { px(x, y, [0, 0, 0], 0); continue; } px(x, y, vary(pal(cols, t), 0.1)); }
    for (let i = 0; i < 16; i++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16); px(x, y, vary(H(cols[cols.length - 1]), 0.05)); px(x + 1, y, mul(H(cols[cols.length - 1]), 1.1)); px(x, y + 1, H(cols[0])); }
  });
  leafV3('leaves', [0x24561c, 0x2f6e24, 0x3f8a2e, 0x5aa83e], 0.32);
  leafV3('leaves_dark', [0x173a1c, 0x214c26, 0x2c6030, 0x3c7a3c], 0.32);
  leafV3('leaves_blossom', [0xc87aa4, 0xe0a0c4, 0xeebcd6, 0xfadcec], 0.28);
  tile('log_side', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ridge = Math.sin((x + tn(x, y, 8, 71) * 3) * 1.6) * 0.5 + 0.5; let c = vary(pal([0x3e2a18, 0x4e3620, 0x664a2c, 0x76583a], ridge * 0.7 + tn(x, y, 4, 72) * 0.3), 0.06); px(x, y, c); } for (let i = 0; i < 5; i++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 14); px(x, y, H(0x2e1e10)); px(x, y + 1, H(0x2e1e10)); } });
  tile('log_top', px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5) + tn(x, y, 4, 73) * 1.2; const c = d > 7.2 ? H(0x4e3620) : (Math.floor(d * 0.9) % 2 ? H(0xb48c5a) : H(0x9a7548)); px(x, y, vary(c, 0.05)); } });
  const woolV3 = (name, base) => tile(name, px => { const b = H(base); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const knit = ((x + (y >> 1)) % 4 < 2 ? 1.06 : 0.92) * (y % 2 ? 0.97 : 1.03); px(x, y, vary(mul(b, knit * (0.94 + tn(x, y, 8, 81) * 0.12)), 0.04)); } });
  woolV3('wool_red', 0xb83232); woolV3('wool_white', 0xe8e4dc); woolV3('wool_blue', 0x34509c); woolV3('wool_green', 0x4a7a32); woolV3('wool_yellow', 0xd8b030); woolV3('wool_purple', 0x7a3ea0);
  const metalV3 = (name, base, hi, lo) => tile(name, px => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary(mul(H(base), 0.96 + tn(x, y, 8, 91) * 0.08), 0.03); if (x === 0 || y === 0 || x === 8 || y === 8) c = H(hi); if (x === 15 || y === 15 || x === 7 || y === 7) c = H(lo); if ((x === 1 || x === 9) && y % 8 !== 7 && y % 8 !== 0) c = mul(c, 1.06); px(x, y, c); } });
  metalV3('iron_block', 0xc4c4c8, 0xe8e8ec, 0x86868c); metalV3('gold_block', 0xeec236, 0xfff2a0, 0xb08a1a);
  tile('cobble', px => cells(px, H(0x808084), H(0x48484c), 10, 0.4));
  ctx.putImageData(img, 0, 0);
  Atlas.canvas = cv;
})();
