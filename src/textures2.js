'use strict';
/* Textures for the blocks added in the 1.20 and 1.21 updates (copper and tuff families, candles, sculk,
   froglights, trial chamber blocks...) and the creative-only operator blocks. Painted in code like the rest. */
(() => {
  const { def, H, mul, mixc, pick, CLR } = Tex;
  const { stone, speckle, cobble, bricks, metal, grain, voro, cells } = Tex.fx;
  const frame = (c, col, w) => c.each((x, y) => { if (x < w || y < w || x > 15 - w || y > 15 - w) c.px(x, y, H(col)); });

  // ------------------------------------------------------------------ bamboo
  const BAM = [0x9c8a35, 0xae9b40, 0xc1ad50, 0xcfbb5c, 0xdac868];
  def('bamboo_mosaic', c => c.each((x, y) => {
    // two rows of short vertical slats, each slat 2 pixels wide with a dark gap between
    const row = y >> 3, sx = (x + row * 2) % 4, sy = y & 7;
    let t = 0.5 + (c.n(x >> 2, row, 1) - 0.5) * 0.4 + (c.n(x, y, 2) - 0.5) * 0.2;
    if (sx === 3) t = 0.05; if (sy === 7) t = 0; if (sy === 0) t += 0.15;
    c.px(x, y, sx === 3 || sy === 7 ? H(0x7a6a28) : pick(BAM, t));
  }));
  def('stripped_bamboo_block', c => c.each((x, y) => {
    const node = y === 4 || y === 12;
    let t = 0.55 + (x % 4 === 0 ? -0.3 : 0) + (c.n(x, y, 3) - 0.5) * 0.25;
    if (node) t -= 0.2;
    c.px(x, y, pick(BAM, t));
  }));
  def('stripped_bamboo_block_top', c => {
    c.fill(H(0xc1ad50));
    for (const [cx, cy] of [[3.5, 3.5], [11.5, 3.5], [3.5, 11.5], [11.5, 11.5], [7.5, 7.5]]) c.each((x, y) => { const d = Math.hypot(x - cx, y - cy); if (d < 2.2) c.px(x, y, H(d < 1.2 ? 0x5a4a1a : 0x8c7b34)); });
    frame(c, 0xae9b40, 1);
  });

  // ------------------------------------------------------------------ operator blocks
  def('barrier', c => { c.clear(); c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 5.6 && d < 7.6) c.px(x, y, H(d > 6.6 ? 0xb01010 : 0xe82020)); if (Math.abs(x - y) < 1.2 && d < 6.6) c.px(x, y, H(0xe82020)); }); });
  def('light', c => {
    c.clear();
    c.each((x, y) => { const d = Math.hypot(x - 7.5, (y - 6) * 1.1); if (d < 4.6) c.px(x, y, mixc(H(0xfff6a0), H(0xf0c020), Math.min(1, d / 5))); });
    c.rect(6, 11, 9, 13, H(0x8a8a8a)); c.rect(6, 12, 9, 12, H(0x5a5a5a)); c.rect(7, 14, 8, 14, H(0x3a3a3a));
  });
  def('structure_void', c => { c.clear(); for (let i = 3; i <= 12; i++) { if (i % 2) continue; c.px(i, 3, H(0x8ad8f0)); c.px(i, 12, H(0x8ad8f0)); c.px(3, i, H(0x8ad8f0)); c.px(12, i, H(0x8ad8f0)); } c.px(7, 7, H(0xffffff)); c.px(8, 8, H(0xffffff)); });
  const CMD = { command_block: [0xb0835b, 0xc89a6c, 0xd8ad80, 0x7a5a3a], repeating_command_block: [0x6a4fa3, 0x8064bd, 0x9a7ed4, 0x3f2d6a], chain_command_block: [0x7a9a82, 0x91b29a, 0xa8c8b0, 0x4a6a52] };
  for (const n in CMD) {
    const [a, b, l, d] = CMD[n];
    const base = c => { c.each((x, y) => c.px(x, y, mul(H(b), 0.95 + c.n(x, y, 5) * 0.1))); frame(c, d, 1); c.each((x, y) => { if ((x === 1 || y === 1) && x < 15 && y < 15) c.px(x, y, H(l)); }); };
    // the sides carry the arrow that points to where the block faces (up in the texture)
    def(n + '_side', c => {
      base(c);
      c.rect(3, 3, 12, 12, H(a));
      for (let i = 0; i < 4; i++) { c.rect(7 - i, 4 + i, 8 + i, 4 + i, H(d)); }
      c.rect(6, 8, 9, 11, H(d));
      for (let x = 4; x <= 11; x += 7) c.rect(x, 9, x, 11, H(l));
    });
    def(n + '_front', c => {
      base(c);
      c.rect(3, 3, 12, 12, H(0x1a1a1a)); c.rect(4, 4, 11, 11, H(0x2a2a2a));
      for (let y = 5; y <= 10; y += 2) for (let x = 5; x <= 10; x++) if (c.n(x, y, 7) > 0.45) c.px(x, y, H(n === 'command_block' ? 0xe0a050 : n === 'chain_command_block' ? 0x8af0a0 : 0xb090f0));
    });
    def(n + '_back', c => { base(c); c.rect(4, 4, 11, 11, H(a)); c.rect(5, 5, 10, 10, H(d)); c.rect(6, 6, 9, 9, H(a)); });
  }
  def('structure_block', c => {
    c.each((x, y) => c.px(x, y, mul(H(0x5a4a64), 0.92 + c.n(x, y, 9) * 0.16)));
    frame(c, 0x2f2636, 1); c.rect(3, 3, 12, 12, H(0x3b3045));
    // a small "S" (save mode)
    for (const [x, y] of [[6, 5], [7, 5], [8, 5], [9, 5], [6, 6], [6, 7], [7, 7], [8, 7], [9, 7], [9, 8], [9, 9], [6, 9], [7, 9], [8, 9]]) c.px(x, y + 1, H(0xe8e0f0));
  });
  def('jigsaw_side', c => { c.each((x, y) => c.px(x, y, mul(H(0x4a4552), 0.92 + c.n(x, y, 10) * 0.16))); frame(c, 0x2a2730, 1); for (let i = 0; i < 4; i++) c.rect(7 - i, 3 + i, 8 + i, 3 + i, H(0x8a7ab0)); c.rect(7, 7, 8, 12, H(0x8a7ab0)); });
  def('jigsaw_bottom', c => { c.each((x, y) => c.px(x, y, mul(H(0x4a4552), 0.92 + c.n(x, y, 11) * 0.16))); frame(c, 0x2a2730, 1); });
  def('jigsaw_top', c => {
    c.each((x, y) => c.px(x, y, mul(H(0x4a4552), 0.92 + c.n(x, y, 12) * 0.16))); frame(c, 0x2a2730, 1);
    c.rect(4, 4, 11, 11, H(0xd8a83a)); c.rect(7, 2, 8, 4, H(0xd8a83a)); c.rect(11, 7, 13, 8, H(0xd8a83a)); c.rect(5, 5, 10, 10, H(0xf0c858));
  });

  // ------------------------------------------------------------------ crops and plants of 1.20
  const stalk = (c, h, col) => { for (let y = 15; y > 15 - h; y--) { c.px(7, y, H(col)); if (y < 13) c.px(8, y, mul(H(col), 0.85)); } };
  def('torchflower_crop_stage0', c => { c.clear(); stalk(c, 5, 0x5c8a2e); c.px(6, 11, H(0x7ab03a)); c.px(9, 12, H(0x7ab03a)); c.px(7, 10, H(0xd86a1a)); });
  def('torchflower_crop_stage1', c => { c.clear(); stalk(c, 9, 0x5c8a2e); c.px(5, 10, H(0x7ab03a)); c.px(10, 11, H(0x7ab03a)); c.px(6, 9, H(0x7ab03a)); c.rect(6, 5, 9, 7, H(0xd86a1a)); c.rect(7, 4, 8, 4, H(0xf2a01c)); });
  // pitcher: a bulbous teal pitcher with purple-red leaves; the crop grows from a pod, two blocks tall from stage 3
  for (let s = 0; s <= 4; s++) {
    def('pitcher_crop_bottom_stage_' + s, c => {
      c.clear();
      const h = [3, 6, 10, 15, 15][s];
      stalk(c, h, 0x4a7a5a);
      if (s === 0) { c.rect(6, 12, 9, 15, H(0x6a8a4a)); c.rect(7, 11, 8, 11, H(0x8ab05a)); return; }
      for (let y = 15; y > 15 - h; y -= 3) { c.px(5, y, H(0x5a9a7a)); c.px(10, y - 1, H(0x5a9a7a)); c.px(4, y - 1, H(0x4a8a6a)); c.px(11, y - 2, H(0x4a8a6a)); }
      if (s >= 2) c.rect(5, 15 - h, 10, 17 - h, H(0x3a8a8a));
    });
    if (s >= 3) def('pitcher_crop_top_stage_' + s, c => {
      c.clear();
      const h = s === 3 ? 6 : 12;
      stalk(c, h, 0x4a7a5a);
      if (s === 4) { c.rect(5, 4, 10, 9, H(0x3a8a8a)); c.rect(6, 3, 9, 3, H(0x6ac0b8)); c.rect(4, 2, 5, 4, H(0x8a3a6a)); c.rect(10, 2, 11, 4, H(0x8a3a6a)); c.px(7, 1, H(0xb04a8a)); }
      else c.rect(6, 9, 9, 12, H(0x3a8a8a));
    });
  }
  def('pitcher_plant_bottom', c => {
    c.clear();
    c.each((x, y) => { const d = Math.abs(x - 7.5); if (y > 3 && d < 3.5 + (y > 9 ? (15 - y) * 0.1 : 0)) c.px(x, y, mixc(H(0x2f7a7a), H(0x5ab0a8), (7.5 - d) / 8 + c.n(x, y, 13) * 0.2)); });
    for (const [x, y] of [[2, 12], [3, 13], [13, 12], [12, 13], [1, 11], [14, 11]]) c.px(x, y, H(0x4a8a5a));
  });
  def('pitcher_plant_top', c => {
    c.clear();
    c.each((x, y) => { const d = Math.abs(x - 7.5); if (y > 6 && d < 3.5) c.px(x, y, mixc(H(0x2f7a7a), H(0x5ab0a8), (7.5 - d) / 8 + c.n(x, y, 14) * 0.2)); });
    c.rect(4, 6, 11, 7, H(0x7ad0c0));
    for (const [x, y] of [[3, 3], [4, 4], [3, 5], [12, 3], [11, 4], [12, 5], [6, 1], [7, 2], [9, 1], [8, 2]]) c.px(x, y, H(y < 3 ? 0xc04a8a : 0x9a3a7a));
  });
  def('bamboo_stage0', c => { c.clear(); for (let y = 8; y < 16; y++) { c.px(7, y, H(0x5d7a1e)); c.px(8, y, H(0x6a8a24)); } c.px(6, 8, H(0x76962a)); c.px(9, 9, H(0x83a332)); c.px(5, 7, H(0x76962a)); c.px(10, 8, H(0x83a332)); });
  // frosted ice: four stages, more cracked each time
  for (let s = 0; s < 4; s++) def('frosted_ice_' + s, c => {
    c.each((x, y) => { const streak = Math.abs(((x - y) & 15) - 8) < 1 && c.n(x, y, 61) > 0.3; c.px(x, y, streak ? H(0xd8e6ff) : mul(H(0x9cbcf5), 0.95 + c.n(x, y, 62) * 0.1), 170); });
    for (let i = 0; i < s * 7; i++) { let x = Math.floor(c.n(i, 1, 63) * 16), y = Math.floor(c.n(i, 2, 63) * 16); for (let k = 0; k < 4; k++) { c.px(x, y, H(0xffffff), 230); x += c.n(i, k, 64) > 0.5 ? 1 : -1; y += c.n(i, k, 65) > 0.5 ? 1 : 0; } }
  });

  // ------------------------------------------------------------------ eggs and frogspawn
  for (const [n, k] of [['turtle_egg', 0], ['turtle_egg_slightly_cracked', 1], ['turtle_egg_very_cracked', 2]]) def(n, c => {
    c.each((x, y) => { const t = c.n(x, y, 70); c.px(x, y, mul(H(0xe8e4c8), 0.94 + t * 0.1)); if (c.v(x, y, 4, 4, 71) > 0.62 && t > 0.3) c.px(x, y, H(0x5a9a5a)); });
    for (let i = 0; i < k * 6; i++) { const x = Math.floor(c.n(i, 1, 72) * 16), y = Math.floor(c.n(i, 2, 72) * 16); c.px(x, y, H(0x6a6450)); c.px(x + 1, y + (i & 1), H(0x6a6450)); }
  });
  const SNIFF = [0x9a3a2a, 0xb54a32, 0x5a8a7a, 0x3a6a5a];
  for (const [st, k] of [['not_cracked', 0], ['slightly_cracked', 1], ['very_cracked', 2]]) for (const f of ['top', 'bottom', 'east', 'north', 'south', 'west']) def('sniffer_egg_' + st + '_' + f, c => {
    c.each((x, y) => { const v = c.v(x + (f === 'top' ? 3 : 0), y, 4, 4, 73 + f.length); const t = c.n(x, y, 74); c.px(x, y, mul(H(v > 0.55 ? SNIFF[2 + (t > 0.5 ? 1 : 0)] : SNIFF[t > 0.5 ? 1 : 0]), 0.92 + t * 0.12)); });
    for (let i = 0; i < k * 8; i++) { let x = Math.floor(c.n(i, 1, 75) * 16), y = Math.floor(c.n(i, 2, 75) * 16); for (let j = 0; j < 3; j++) { c.px(x, y, H(0xe8d0a8)); x++; y += j & 1; } }
  });
  def('frogspawn', c => {
    c.clear();
    for (let i = 0; i < 22; i++) {
      const x = 1 + Math.floor(c.n(i, 1, 76) * 14), y = 1 + Math.floor(c.n(i, 2, 76) * 14);
      c.px(x, y, H(0x1a1a1a)); c.px(x + 1, y, H(0xb8c8c0), 140); c.px(x, y + 1, H(0xb8c8c0), 140); c.px(x - 1, y, H(0xd8e0dc), 110); c.px(x, y - 1, H(0xd8e0dc), 110);
    }
  });

  // ------------------------------------------------------------------ dead corals (the living ones are painted with the coral blocks)
  const DEAD = 0x8a827c;
  for (const k of ['tube', 'brain', 'bubble', 'fire', 'horn']) {
    def('dead_' + k + '_coral', c => { c.copy(k + '_coral'); c.each((x, y) => { const p = c.get(x, y); if (p[3]) c.px(x, y, mul(H(DEAD), 0.8 + (p[0] + p[1] + p[2]) / 765 * 0.5)); }); });
    def('dead_' + k + '_coral_fan', c => { c.copy(k + '_coral_fan'); c.each((x, y) => { const p = c.get(x, y); if (p[3]) c.px(x, y, mul(H(DEAD), 0.8 + (p[0] + p[1] + p[2]) / 765 * 0.5)); }); });
  }

  // ------------------------------------------------------------------ candles: body pixels on the left, the wick at the top
  // layout used by the candle model: x 0-1, y 8-13 body sides; y 6-7 the top; x 0, y 4-5 the wick
  const CANDLE = Object.assign({ candle: 0xe8d8a8 }, {});
  for (const k of Object.keys(CLR)) CANDLE[k + '_candle'] = CLR[k];
  for (const n in CANDLE) {
    const col = n === 'candle' ? 0xe0cfa0 : CANDLE[n];
    const paint = (c, lit) => {
      c.clear();
      for (let y = 8; y < 14; y++) for (let x = 0; x < 2; x++) c.px(x, y, mul(H(col), (x ? 0.86 : 1) * (0.95 + c.n(x, y, 77) * 0.08)));
      for (let x = 0; x < 2; x++) for (let y = 6; y < 8; y++) c.px(x, y, mul(H(col), 1.1));
      c.px(0, 5, lit ? H(0xffc040) : H(0x3a3530)); c.px(0, 4, lit ? H(0xfff0a0) : H(0x2a2520));
      // the item-style view on the right half (used for particles)
      for (let y = 6; y < 15; y++) for (let x = 7; x < 9; x++) c.px(x, y, mul(H(col), x === 8 ? 0.86 : 1));
      c.px(7, 5, H(0x3a3530)); c.px(7, 4, lit ? H(0xffc040) : H(0x2a2520));
    };
    def(n, c => paint(c, false));
    def(n + '_lit', c => paint(c, true));
  }

  // ------------------------------------------------------------------ tuff family
  const TUFF = [0x585a52, 0x63655c, 0x6c6e65, 0x76786e, 0x83857a];
  def('polished_tuff', c => { c.each((x, y) => { const t = c.v(x, y, 4, 4, 80) * 0.5 + c.n(x, y, 80) * 0.5; c.px(x, y, pick([0x60625a, 0x686a61, 0x707268, 0x777970], t)); }); frame(c, 0x52544d, 1); c.each((x, y) => { if ((x === 1 || y === 1) && x > 0 && y > 0 && x < 15 && y < 15) c.px(x, y, H(0x80827a)); }); });
  def('tuff_bricks', c => bricks(c, { rh: 4, bw: 8, pal: TUFF, mortar: [0x45473f, 0x4c4e46] }));
  def('chiseled_tuff', c => { c.copy('polished_tuff'); c.rect(2, 4, 13, 11, H(0x5a5c54)); c.rect(3, 5, 12, 10, H(0x72746b)); c.rect(5, 6, 10, 9, H(0x4a4c45)); c.rect(6, 7, 9, 8, H(0x7d7f76)); });
  def('chiseled_tuff_top', c => { c.copy('polished_tuff'); c.rect(4, 4, 11, 11, H(0x5a5c54)); c.rect(5, 5, 10, 10, H(0x72746b)); c.rect(7, 7, 8, 8, H(0x4a4c45)); });
  def('chiseled_tuff_bricks', c => { bricks(c, { rh: 8, bw: 16, off: 0, pal: TUFF, mortar: [0x45473f, 0x4c4e46] }); c.rect(3, 2, 12, 5, H(0x5a5c54)); c.rect(4, 3, 11, 4, H(0x7d7f76)); c.rect(3, 10, 12, 13, H(0x5a5c54)); c.rect(4, 11, 11, 12, H(0x7d7f76)); });
  def('chiseled_tuff_bricks_top', c => { c.copy('polished_tuff'); c.rect(3, 3, 12, 12, H(0x5a5c54)); c.rect(4, 4, 11, 11, H(0x6c6e65)); c.rect(6, 6, 9, 9, H(0x4a4c45)); });

  // ------------------------------------------------------------------ sculk
  const SCULK = [0x05161c, 0x0a2129, 0x0d2d36, 0x103944, 0x14485a];
  const sculkBase = (c, k) => c.each((x, y) => {
    const v = c.v(x, y, 4, 4, k), t = c.n(x, y, k);
    let col = pick(SCULK, v * 0.7 + t * 0.3);
    if (v > 0.66 && t > 0.55) col = H(t > 0.85 ? 0x29dfeb : 0x0f6a72);
    c.px(x, y, col);
  });
  def('sculk', c => sculkBase(c, 81));
  def('sculk_vein', c => { c.clear(); c.each((x, y) => { const v = c.v(x, y, 4, 4, 82), t = c.n(x, y, 82); if (v > 0.5 || t > 0.86) c.px(x, y, v > 0.7 && t > 0.6 ? H(0x29dfeb) : pick(SCULK, t)); }); });
  def('sculk_catalyst_top', c => { sculkBase(c, 83); c.rect(3, 3, 12, 12, H(0xd8d0b8)); c.rect(4, 4, 11, 11, H(0xeae2cc)); c.rect(6, 6, 9, 9, H(0x0d2d36)); c.rect(7, 7, 8, 8, H(0x29dfeb)); });
  def('sculk_catalyst_bottom', c => { c.each((x, y) => c.px(x, y, mul(H(0xd8d0b8), 0.85 + c.n(x, y, 84) * 0.2))); });
  def('sculk_catalyst_side', c => { c.each((x, y) => c.px(x, y, mul(H(0xd8d0b8), 0.85 + c.n(x, y, 85) * 0.2))); c.each((x, y) => { if (y < 6 - (c.n(x, 0, 86) * 3 | 0)) c.px(x, y, pick(SCULK, c.n(x, y, 87))); }); for (let x = 3; x < 13; x += 4) c.rect(x, 8, x + 1, 11, H(0x0d2d36)); });
  def('sculk_shrieker_top', c => { c.each((x, y) => c.px(x, y, mul(H(0xcfc6ac), 0.88 + c.n(x, y, 88) * 0.16))); c.rect(3, 3, 12, 12, H(0x0a2129)); c.rect(5, 5, 10, 10, H(0x05161c)); c.rect(7, 7, 8, 8, H(0x14485a)); });
  def('sculk_shrieker_bottom', c => sculkBase(c, 89));
  def('sculk_shrieker_side', c => { sculkBase(c, 90); c.each((x, y) => { if (y < 8) c.px(x, y, [0, 0, 0], 0); }); c.each((x, y) => { if (y >= 8 && y < 10) c.px(x, y, H(0xcfc6ac)); }); });
  def('sculk_shrieker_inner_top', c => { c.each((x, y) => c.px(x, y, mul(H(0xcfc6ac), 0.88 + c.n(x, y, 91) * 0.16))); c.rect(3, 3, 12, 12, H(0x05161c)); });
  def('sculk_shrieker_can', c => { c.each((x, y) => c.px(x, y, mul(H(0xcfc6ac), 0.86 + c.n(x, y, 96) * 0.18))); c.each((x, y) => { if (c.n(x, y, 97) > 0.8 && y > 3) c.px(x, y, H(0x0d2d36)); }); });
  def('sculk_sensor_top', c => { sculkBase(c, 92); c.rect(4, 4, 11, 11, H(0x0d2d36)); c.rect(6, 6, 9, 9, H(0x29dfeb)); });
  def('sculk_sensor_bottom', c => sculkBase(c, 93));
  def('sculk_sensor_side', c => { sculkBase(c, 94); c.each((x, y) => { if (y < 8) c.px(x, y, [0, 0, 0], 0); }); });
  def('sculk_sensor_tendril_inactive', c => { c.clear(); for (let y = 0; y < 8; y++) { c.px(3, y, H(y < 2 ? 0x29dfeb : 0x0f6a72)); c.px(12, y, H(y < 2 ? 0x29dfeb : 0x0f6a72)); } });
  def('sculk_sensor_tendril_active', c => { c.clear(); for (let y = 0; y < 8; y++) { c.px(3, y, H(y < 3 ? 0xa8fff8 : 0x29dfeb)); c.px(12, y, H(y < 3 ? 0xa8fff8 : 0x29dfeb)); } });
  def('calibrated_sculk_sensor_top', c => { sculkBase(c, 95); c.rect(2, 2, 13, 13, H(0x5a3a8a)); c.rect(4, 4, 11, 11, H(0x0d2d36)); c.rect(6, 6, 9, 9, H(0x29dfeb)); });
  def('calibrated_sculk_sensor_amethyst', c => { c.clear(); for (let y = 2; y < 16; y++) { const w = y < 6 ? 1 : 2; for (let x = 7 - w; x <= 8 + w; x++) c.px(x, y, H((x + y) % 3 ? 0xa47fe0 : 0xc4a3f2)); } });
  def('calibrated_sculk_sensor_input_side', c => { c.copy('sculk_sensor_side'); c.rect(6, 10, 9, 13, H(0x8a1a1a)); c.rect(7, 11, 8, 12, H(0xff3a2a)); });

  // ------------------------------------------------------------------ copper: four stages of oxidation
  const OXP = {
    '': [0x7a3e2a, 0x9a5038, 0xb4624a, 0xc87456, 0xe08a68, 0xf0a888],
    exposed_: [0x6e5446, 0x8a6a5a, 0x9e7b6a, 0xae8a76, 0xc09c8a, 0xd8b8a8],
    weathered_: [0x2f5a48, 0x3e7458, 0x548a62, 0x6c9f74, 0x82b48a, 0xa0d0a8],
    oxidized_: [0x22594a, 0x2f7262, 0x3e8a72, 0x52a284, 0x66b898, 0x8ad8b8],
  };
  for (const o in OXP) {
    const P = OXP[o];
    if (o) def(o + 'cut_copper', c => bricks(c, { rh: 8, bw: 8, off: 0, pal: P.slice(1, 5), mortar: [P[0], mul(H(P[0]), 1.1)].map((v, i) => i ? (v[0] << 16 | v[1] << 8 | v[2]) : v) }));
    def(o + 'chiseled_copper', c => {
      c.each((x, y) => c.px(x, y, pick(P.slice(1, 5), 0.5 + (c.n(x, y, 100) - 0.5) * 0.4)));
      frame(c, P[0], 1);
      c.rect(3, 3, 12, 12, H(P[1])); c.rect(4, 4, 11, 11, H(P[3])); c.rect(5, 5, 10, 10, H(P[2]));
      c.rect(6, 6, 9, 9, H(P[0])); c.rect(7, 7, 8, 8, H(P[4]));
    });
    def(o + 'copper_grate', c => {
      c.clear();
      c.each((x, y) => {
        const edge = x === 0 || y === 0 || x === 15 || y === 15, bar = (x % 4 === 0 || x % 4 === 3) || (y % 4 === 0 || y % 4 === 3);
        if (edge || bar) c.px(x, y, pick(P.slice(1, 5), (edge ? 0.3 : 0.6) + (c.n(x, y, 101) - 0.5) * 0.4));
      });
    });
    // the bulb: a frame with a lamp in the middle, dark when off and glowing when lit; a red dot when powered
    const bulb = (c, lit, powered) => {
      c.each((x, y) => c.px(x, y, pick(P.slice(1, 5), 0.5 + (c.n(x, y, 102) - 0.5) * 0.4)));
      frame(c, P[0], 1);
      c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (d < 4.5) c.px(x, y, lit ? mixc(H(0xfff4c0), H(0xf0a040), d / 5) : mixc(H(0x6a5a4a), H(0x3a2a20), d / 5)); });
      c.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (d >= 4.5 && d < 5.5) c.px(x, y, H(P[0])); });
      if (powered) { c.px(7, 7, H(0xff2a1a)); c.px(8, 8, H(0xff2a1a)); c.px(7, 8, H(0xb01a10)); c.px(8, 7, H(0xb01a10)); }
    };
    def(o + 'copper_bulb', c => bulb(c, false, false)); def(o + 'copper_bulb_lit', c => bulb(c, true, false));
    def(o + 'copper_bulb_powered', c => bulb(c, false, true)); def(o + 'copper_bulb_lit_powered', c => bulb(c, true, true));
    // door: two panes of windows on top, panels below
    def(o + 'copper_door_top', c => {
      c.each((x, y) => c.px(x, y, pick(P.slice(1, 5), 0.5 + (c.n(x, y, 103) - 0.5) * 0.4)));
      frame(c, P[0], 1);
      c.rect(3, 3, 6, 12, [0, 0, 0], 0); c.rect(9, 3, 12, 12, [0, 0, 0], 0);
      c.rect(3, 3, 6, 3, H(P[4])); c.rect(9, 3, 12, 3, H(P[4]));
    });
    def(o + 'copper_door_bottom', c => {
      c.each((x, y) => c.px(x, y, pick(P.slice(1, 5), 0.5 + (c.n(x, y, 104) - 0.5) * 0.4)));
      frame(c, P[0], 1);
      c.rect(3, 2, 12, 6, H(P[1])); c.rect(4, 3, 11, 5, H(P[3])); c.rect(3, 9, 12, 13, H(P[1])); c.rect(4, 10, 11, 12, H(P[3]));
      c.px(12, 0, H(P[5])); c.rect(13, 7, 13, 8, H(P[5]));
    });
    def(o + 'copper_door', c => c.copy(o + 'copper_door_bottom'));
    def('waxed_' + o + 'copper_door', c => c.copy(o + 'copper_door_bottom'));
    def(o + 'copper_trapdoor', c => {
      c.clear();
      c.each((x, y) => { const edge = x < 2 || y < 2 || x > 13 || y > 13, bar = x === 7 || x === 8 || y === 7 || y === 8; if (edge || bar) c.px(x, y, pick(P.slice(1, 5), (edge ? 0.4 : 0.6) + (c.n(x, y, 105) - 0.5) * 0.4)); });
      c.px(4, 4, H(P[5])); c.px(11, 4, H(P[5])); c.px(4, 11, H(P[5])); c.px(11, 11, H(P[5]));
    });
  }

  // ------------------------------------------------------------------ froglights
  const FROG = { ochre: [0xf5e8a0, 0xf0d070, 0xd8a840, 0xfffbd8], verdant: [0xd8f0c0, 0xb8e098, 0x88c070, 0xf4fff0], pearlescent: [0xf0dcec, 0xe0c0e0, 0xc8a0c8, 0xfff4ff] };
  for (const f in FROG) {
    const [a, b, d, l] = FROG[f];
    def(f + '_froglight_side', c => c.each((x, y) => { const s = (y + (x >> 2)) % 4 === 0; const t = c.n(x, y, 110); c.px(x, y, s ? H(d) : t > 0.75 ? H(l) : t > 0.35 ? H(a) : H(b)); }));
    def(f + '_froglight_top', c => c.each((x, y) => { const r = Math.floor(Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))); const t = c.n(x, y, 111); c.px(x, y, r % 3 === 2 ? H(d) : t > 0.7 ? H(l) : H(r % 3 ? a : b)); }));
  }

  // ------------------------------------------------------------------ trial chambers and archaeology
  const POT = [0x8a4a32, 0x9a5638, 0xa9623f, 0xb86e47, 0xc47a52];
  def('decorated_pot_side', c => { c.each((x, y) => c.px(x, y, pick(POT, 0.5 + (c.n(x, y, 112) - 0.5) * 0.5))); c.rect(0, 0, 15, 1, H(0x7a3e2a)); c.rect(0, 14, 15, 15, H(0x7a3e2a)); });
  def('decorated_pot_base', c => { c.each((x, y) => c.px(x, y, pick(POT, 0.5 + (c.n(x, y, 113) - 0.5) * 0.5))); c.rect(5, 5, 10, 10, H(0x6a3424)); });
  // the crafter: a copper-trimmed crafting machine with a grid of slots on the top and a mouth on the front
  const IRONP = [0x5a5a5e, 0x6c6c70, 0x7e7e82, 0x8e8e92, 0xa0a0a4];
  const crafterBase = (c, k) => { c.each((x, y) => c.px(x, y, pick(IRONP, 0.5 + (c.n(x, y, k) - 0.5) * 0.4))); frame(c, 0x3a3a3e, 1); c.rect(0, 0, 15, 0, H(0xb4624a)); c.rect(0, 15, 15, 15, H(0x9a5038)); };
  def('crafter_top', c => { crafterBase(c, 114); c.rect(2, 2, 13, 13, H(0x2a2a2e)); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.rect(3 + i * 4, 3 + j * 4, 4 + i * 4, 4 + j * 4, H(0x4a4a4e)); });
  def('crafter_bottom', c => { crafterBase(c, 115); c.rect(4, 4, 11, 11, H(0x4a4a4e)); });
  def('crafter_north', c => { crafterBase(c, 116); c.rect(4, 5, 11, 10, H(0x1a1a1e)); c.rect(5, 6, 10, 9, H(0x2a2020)); c.rect(3, 12, 12, 13, H(0xb4624a)); });
  def('crafter_east', c => { crafterBase(c, 117); c.rect(3, 4, 12, 11, H(0x4a4a4e)); for (let y = 5; y <= 10; y += 2) c.rect(4, y, 11, y, H(0x6c6c70)); });
  def('crafter_west', c => c.copy('crafter_east')); def('crafter_south', c => c.copy('crafter_east'));
  const VAULT = [0x3a3f4a, 0x484e5a, 0x56606c, 0x646e7a, 0x76808c];
  const vaultBase = (c, k) => { c.each((x, y) => c.px(x, y, pick(VAULT, 0.5 + (c.n(x, y, k) - 0.5) * 0.4))); frame(c, 0x262a32, 1); c.rect(0, 0, 15, 1, H(0xb4624a)); c.rect(0, 14, 15, 15, H(0x9a5038)); };
  def('vault_top', c => { vaultBase(c, 118); c.rect(3, 3, 12, 12, H(0x262a32)); c.rect(5, 5, 10, 10, H(0x56606c)); });
  def('vault_bottom', c => vaultBase(c, 119));
  def('vault_side_off', c => { c.clear(); c.each((x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13 || x === 7 || x === 8) c.px(x, y, pick(VAULT, 0.5 + (c.n(x, y, 120) - 0.5) * 0.4)); }); c.rect(0, 0, 15, 1, H(0xb4624a)); c.rect(0, 14, 15, 15, H(0x9a5038)); });
  def('vault_front_off', c => { vaultBase(c, 121); c.rect(4, 4, 11, 11, H(0x1a1d22)); c.rect(6, 6, 9, 9, H(0x4a3a2a)); c.rect(7, 12, 8, 13, H(0x262a32)); });
  def('vault_front_on', c => { vaultBase(c, 121); c.rect(4, 4, 11, 11, H(0x1a1d22)); c.rect(6, 6, 9, 9, H(0xf0b040)); c.rect(7, 7, 8, 8, H(0xfff0a0)); });
  const CORE = [0x3a3a3e, 0x4a4a50, 0x5a5a62, 0x6a6a74];
  def('heavy_core_top', c => { c.each((x, y) => c.px(x, y, pick(CORE, 0.5 + (c.n(x, y, 122) - 0.5) * 0.5))); c.rect(4, 4, 11, 11, H(0x2a2a2e)); c.rect(6, 6, 9, 9, H(0x6a6a74)); });
  def('heavy_core_bottom', c => c.each((x, y) => c.px(x, y, pick(CORE, 0.4 + (c.n(x, y, 123) - 0.5) * 0.5))));
  def('heavy_core_side', c => { c.each((x, y) => c.px(x, y, pick(CORE, 0.5 + (c.n(x, y, 124) - 0.5) * 0.5))); c.rect(4, 4, 11, 11, H(0x2f2f34)); c.rect(5, 5, 10, 10, H(0x50505a)); });
  def('trial_spawner_top', c => { vaultBase(c, 125); c.rect(2, 2, 13, 13, H(0x1a1d22)); for (let i = 3; i < 13; i += 3) { c.rect(i, 2, i, 13, H(0x484e5a)); c.rect(2, i, 13, i, H(0x484e5a)); } });

  // ------------------------------------------------------------------ the textures blocks fall back to that the list above does not cover
  def('candle_cake', c => c.copy('cake_side'));
  // names that only stand for a block's particles (doors, tall plants, chests...): borrow a texture of the block
  for (const n of Tex.missing()) {
    if (n.endsWith('air')) continue;
    const alt = [n + '_bottom', n + '_side', n + '_front', n === 'moving_piston' ? 'piston_side' : '', n === 'end_gateway' ? 'end_portal' : '', n === 'tall_seagrass' ? 'seagrass' : ''].find(a => a && Tex.has(a));
    if (alt) def(n, c => c.copy(alt));
  }
})();
