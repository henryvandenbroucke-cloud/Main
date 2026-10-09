'use strict';
/* Banners: the flag is drawn from its base colour and up to 6 pattern layers (the loom's limit), each pattern a
   shape on the game's 20 x 40 flag, in the dye colours the game uses for banners. Standing and wall banners use
   the game's sizes (the 20 x 40 model at 2/3) and sway in the wind with the game's formula. The loom adds a
   layer from a banner, a dye and optionally a pattern item; the list of patterns that need no item is the
   game's own (tags/banner_pattern/no_item_required), in its order. */
const Banners = (() => {
  const COLOR = { white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f, pink: 0xf38baa, gray: 0x474f52, light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa, brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21 };
  const NAMES = { base: 'Fully Field', border: 'Bordure', bricks: 'Field Masoned', circle: 'Roundel', creeper: 'Creeper Charge', cross: 'Saltire', curly_border: 'Bordure Indented', diagonal_left: 'Per Bend Sinister', diagonal_right: 'Per Bend', diagonal_up_left: 'Per Bend Inverted', diagonal_up_right: 'Per Bend Sinister Inverted', flow: 'Flow', flower: 'Flower Charge', globe: 'Globe', gradient_up: 'Base Gradient', gradient: 'Gradient', guster: 'Guster', half_horizontal_bottom: 'Per Fess Inverted', half_horizontal: 'Per Fess', half_vertical_right: 'Per Pale Inverted', half_vertical: 'Per Pale', mojang: 'Thing', piglin: 'Snout', rhombus: 'Lozenge', skull: 'Skull Charge', small_stripes: 'Paly', square_bottom_left: 'Base Dexter Canton', square_bottom_right: 'Base Sinister Canton', square_top_left: 'Chief Dexter Canton', square_top_right: 'Chief Sinister Canton', straight_cross: 'Cross', stripe_bottom: 'Base', stripe_center: 'Pale', stripe_downleft: 'Bend Sinister', stripe_downright: 'Bend', stripe_left: 'Pale Dexter', stripe_middle: 'Fess', stripe_right: 'Pale Sinister', stripe_top: 'Chief', triangle_bottom: 'Chevron', triangle_top: 'Inverted Chevron', triangles_bottom: 'Base Indented', triangles_top: 'Chief Indented' };
  const NO_ITEM = ['square_bottom_left', 'square_bottom_right', 'square_top_left', 'square_top_right', 'stripe_bottom', 'stripe_top', 'stripe_left', 'stripe_right', 'stripe_center', 'stripe_middle', 'stripe_downright', 'stripe_downleft', 'small_stripes', 'cross', 'straight_cross', 'triangle_bottom', 'triangle_top', 'triangles_bottom', 'triangles_top', 'diagonal_left', 'diagonal_up_right', 'diagonal_up_left', 'diagonal_right', 'circle', 'rhombus', 'half_vertical', 'half_horizontal', 'half_vertical_right', 'half_horizontal_bottom', 'border', 'curly_border', 'gradient', 'gradient_up', 'bricks'];
  const ITEM_PATTERN = { flower_banner_pattern: 'flower', creeper_banner_pattern: 'creeper', skull_banner_pattern: 'skull', mojang_banner_pattern: 'mojang', globe_banner_pattern: 'globe', piglin_banner_pattern: 'piglin', flow_banner_pattern: 'flow', guster_banner_pattern: 'guster' };
  // the raid captain's banner
  const OMINOUS = [['rhombus', 'cyan'], ['stripe_bottom', 'light_gray'], ['stripe_center', 'gray'], ['border', 'light_gray'], ['stripe_middle', 'black'], ['half_horizontal', 'light_gray'], ['circle', 'light_gray'], ['border', 'black']];
  // ---------------------------------------------------------------- the shapes, on the 20 x 40 flag (alpha 0..1)
  const icon = rows => (x, y) => { const ix = x - 5, iy = y - 12; return iy >= 0 && iy < rows.length && ix >= 0 && ix < rows[iy].length && rows[iy][ix] === '#' ? 1 : 0; };
  const SHAPE = {
    base: () => 1,
    square_bottom_left: (x, y) => x < 10 && y >= 27, square_bottom_right: (x, y) => x >= 10 && y >= 27,
    square_top_left: (x, y) => x < 10 && y < 13, square_top_right: (x, y) => x >= 10 && y < 13,
    stripe_bottom: (x, y) => y >= 27, stripe_top: (x, y) => y < 13, stripe_left: (x, y) => x < 7, stripe_right: (x, y) => x >= 13,
    stripe_center: (x, y) => x >= 7 && x < 13, stripe_middle: (x, y) => y >= 17 && y < 23,
    stripe_downright: (x, y) => Math.abs(x - y / 2) < 3.2, stripe_downleft: (x, y) => Math.abs((19 - x) - y / 2) < 3.2,
    small_stripes: (x, y) => x % 5 >= 1 && x % 5 <= 2 && y < 37,
    cross: (x, y) => Math.abs(x - y / 2) < 2.5 || Math.abs((19 - x) - y / 2) < 2.5,
    straight_cross: (x, y) => (x >= 8 && x < 12) || (y >= 18 && y < 22),
    triangle_bottom: (x, y) => y >= 30 && Math.abs(x - 9.5) <= (y - 30),
    triangle_top: (x, y) => y < 10 && Math.abs(x - 9.5) <= (9 - y),
    triangles_bottom: (x, y) => y >= 35 && (x % 5 >= (39 - y) / 2 - 0.5 && x % 5 <= 4 - ((39 - y) / 2 - 0.5)),
    triangles_top: (x, y) => y < 5 && (x % 5 >= y / 2 - 0.5 && x % 5 <= 4 - (y / 2 - 0.5)),
    diagonal_left: (x, y) => x / 20 + y / 40 < 1, diagonal_right: (x, y) => x / 20 > y / 40,
    diagonal_up_left: (x, y) => x / 20 < y / 40, diagonal_up_right: (x, y) => x / 20 + y / 40 >= 1,
    circle: (x, y) => (x - 9.5) ** 2 + (y - 19.5) ** 2 < 25,
    rhombus: (x, y) => Math.abs(x - 9.5) / 6.5 + Math.abs(y - 19.5) / 12 < 1,
    half_vertical: (x, y) => x < 10, half_horizontal: (x, y) => y < 20, half_vertical_right: (x, y) => x >= 10, half_horizontal_bottom: (x, y) => y >= 20,
    border: (x, y) => x < 1 || x >= 19 || y < 1 || y >= 39,
    curly_border: (x, y) => x < 1 || x >= 19 || y < 1 || y >= 39 || ((x < 2 || x >= 18) && y % 3 === 0) || ((y < 2 || y >= 38) && x % 3 === 0),
    gradient: (x, y) => Math.max(0, 1 - y / 40) * Math.max(0, 1 - y / 40) * 1.2, gradient_up: (x, y) => Math.max(0, y / 40) * Math.max(0, y / 40) * 1.2,
    bricks: (x, y) => (y % 4 === 3) || ((Math.floor(y / 4) % 2 ? (x + 3) : x) % 6 === 5),
    creeper: icon(['##....##', '##....##', '...##...', '..####..', '..#..#..', '........', '........', '........']),
    skull: icon(['.######.', '#.##.###', '#..#..##', '########', '.#.#.#..', '..###...', '.#...#..', '#.....#.']),
    flower: icon(['...##...', '.######.', '.##..##.', '##.##.##', '##.##.##', '.##..##.', '.######.', '...##...']),
    mojang: icon(['########', '#......#', '#.####.#', '#.#..#.#', '#.#..#.#', '#.####.#', '#......#', '########']),
    globe: icon(['..####..', '.#.##..#', '#..##...', '####.#.#', '#.#.##.#', '#....###', '.#..##.#', '..####..']),
    piglin: icon(['........', '.######.', '#......#', '#.#..#.#', '#.#..#.#', '#......#', '.######.', '........']),
    flow: icon(['..####..', '.#....#.', '#..##..#', '#.#..#.#', '#.#.##.#', '#..#...#', '.#....#.', '..####..']),
    guster: icon(['.######.', '#......#', '#.####.#', '#.#..#.#', '#.#..#.#', '#.####.#', '#......#', '.######.']),
  };
  // ---------------------------------------------------------------- drawing a flag
  const cache = new Map();
  const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  function flagCanvas(base, layers) {
    const k = base + '|' + (layers || []).map(l => l[0] + ':' + l[1]).join(','); if (cache.has(k)) return cache.get(k);
    const c = document.createElement('canvas'); c.width = 20; c.height = 40; const g = c.getContext('2d'), img = g.createImageData(20, 40);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 20; x++) {
      let [r, gg, b] = rgb(COLOR[base] || COLOR.white);
      // cloth shading: a little noise and darker edges
      const n = 0.92 + ((x * 37 + y * 101) % 7) * 0.013 - (x === 0 || x === 19 ? 0.05 : 0);
      for (const [p, col] of layers || []) { const f = SHAPE[p] ? Math.min(1, +SHAPE[p](x, y)) : 0; if (f > 0) { const [cr, cg, cb] = rgb(COLOR[col] || 0); r = r * (1 - f) + cr * f; gg = gg * (1 - f) + cg * f; b = b * (1 - f) + cb * f; } }
      const i = (y * 20 + x) * 4; img.data[i] = r * n; img.data[i + 1] = gg * n; img.data[i + 2] = b * n; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    cache.set(k, c);
    return c;
  }
  const baseOf = n => n.replace(/_wall_banner$|_banner$/, '');
  const layersOf = s => (s && s.tag && s.tag.patterns) || [];
  // an inventory icon for a banner with patterns
  const iconCache = new Map();
  function iconURL(s) {
    const base = baseOf(ITEMS[s.id].name), L = layersOf(s), k = base + JSON.stringify(L);
    if (iconCache.has(k)) return iconCache.get(k);
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#6b4a2a'; g.fillRect(14, 1, 3, 30); g.fillStyle = '#8a6438'; g.fillRect(6, 1, 20, 2);
    g.drawImage(flagCanvas(base, L), 0, 0, 20, 40, 8, 3, 16, 27);
    const url = c.toDataURL(); iconCache.set(k, url);
    return url;
  }
  function tooltip(s) { return layersOf(s).map(([p, col]) => `<div style="color:#aaaaaa">${col.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} ${NAMES[p] || p}</div>`).join(''); }
  // ---------------------------------------------------------------- banners in the world
  const visuals = new Map();
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const isBanner = id => BLOCKS[id].model === 'banner' || BLOCKS[id].model === 'wall_banner';
  function remove(k) { const v = visuals.get(k); if (!v) return; scene.remove(v.group); v.mesh.geometry.dispose(); for (const m of new Set(v.mesh.material)) { m.uniforms.map.value.dispose(); m.dispose(); } visuals.delete(k); }
  function refresh(x, y, z) {
    const k = key(x, y, z); remove(k);
    const id = World.getBlock(x, y, z); if (!isBanner(id)) return;
    const st = World.getState(x, y, z), wall = BLOCKS[id].model === 'wall_banner', be = World.getBE(x, y, z);
    const tex = new THREE.CanvasTexture(flagCanvas(baseOf(BLOCKS[id].name), be && be.patterns || [])); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    const front = entityMat(tex, {}), side = entityMat(tex, {});
    const W = 20 / 24, H = 40 / 24, D = 1 / 24;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [side, side, side, side, front, front]);
    mesh.position.y = -H / 2; mesh.frustumCulled = false;
    const sway = new THREE.Group(); sway.add(mesh);
    const group = new THREE.Group(); group.add(sway);
    let F;
    if (wall) { const f = st & 7; F = [DX[f], DZ[f]]; group.position.set(x + 0.5 - F[0] * 0.375, y + 0.854, z + 0.5 - F[1] * 0.375); }
    else { const th = (st & 15) * Math.PI / 8; F = [Math.sin(th), -Math.cos(th)]; group.position.set(x + 0.5 + F[0] * 1 / 16, y + 1.8333, z + 0.5 + F[1] * 1 / 16); }
    group.rotation.y = Math.atan2(F[0], F[1]);
    scene.add(group);
    const phase = Math.floor(x * 7 + y * 9 + z * 13);
    visuals.set(k, { group, sway, mesh, phase, mats: [front, side], x, y, z, light: -1 });
  }
  // the flags sway: the game's (-0.0125 + 0.01 cos(2 pi t)) * pi, t going round every 100 ticks
  function frame(a) {
    if (!visuals.size) return;
    const t = Game.gameTime + (a || 0);
    let n = 0;
    for (const v of visuals.values()) {
      const f = (((v.phase + t) % 100) + 100) % 100 / 100;
      v.sway.rotation.x = (-0.0125 + 0.01 * Math.cos(Math.PI * 2 * f)) * Math.PI;
      if ((v.light < 0 || (++n + Game.gameTime) % 40 === 0)) { const [sl, bl] = EntityRender.lightAt(v.x + 0.5, v.y + 0.5, v.z + 0.5); for (const m of v.mats) m.uniforms.uEnv.value.set(sl, bl); v.light = 1; }
    }
  }
  function clear() { for (const k of [...visuals.keys()]) remove(k); }
  World.listeners.chunkLoaded.push(c => { for (const be of c.be.values()) if (be.type === 'banner') refresh(be.x, be.y, be.z); });
  World.listeners.chunkUnloaded.push(c => { for (const k of [...visuals.keys()]) { const [x, , z] = k.split(',').map(Number); if (x >> 4 === c.cx && z >> 4 === c.cz) remove(k); } });
  World.listeners.blockChanged.push((x, y, z, old, id) => { const k = key(x, y, z); if (visuals.has(k) && old !== id) remove(k); if (isBanner(id) && old !== id) { if (!World.getBE(x, y, z)) World.setBE(x, y, z, { type: 'banner', patterns: [] }); refresh(x, y, z); } });
  // a placed banner keeps the item's patterns; a broken one gives them back
  function placed(x, y, z, s) { const be = { type: 'banner', patterns: layersOf(s).slice() }; if (s && s.tag && s.tag.name) be.name = s.tag.name; World.setBE(x, y, z, be); refresh(x, y, z); }
  function dropTag(x, y, z) { const be = World.getBE(x, y, z); if (!be || be.type !== 'banner') return null; const t = {}; if (be.patterns && be.patterns.length) t.patterns = be.patterns.slice(); if (be.name) t.name = be.name; return Object.keys(t).length ? t : null; }
  function ominous() { return stack('white_banner', 1, { tag: { patterns: OMINOUS.map(l => l.slice()), name: 'Ominous Banner', ominous: true } }); }
  return { COLOR, NAMES, NO_ITEM, ITEM_PATTERN, SHAPE, flagCanvas, iconURL, tooltip, layersOf, baseOf, refresh, frame, clear, placed, dropTag, ominous, isBanner };
})();

/* The loom: banner, dye and an optional pattern item; pick a pattern, take the result. */
class LoomScreen extends Screens.Screen {
  constructor() {
    super('Loom', 176, 166);
    this.inv = [null, null, null]; this.sel = -1; this.scroll = 0;
    const mk = (i, filter, x, y, icon) => this.slot(null, i, x, y, { get: () => this.inv[i], set: v => { this.inv[i] = v && v.count > 0 ? v : null; this.update(); }, filter, emptyIcon: icon, onChange: () => this.update() });
    this.bannerSlot = mk(0, s => /_banner$/.test(ITEMS[s.id].name), 13, 26);
    this.dyeSlot = mk(1, s => /_dye$/.test(ITEMS[s.id].name), 33, 26);
    this.patSlot = mk(2, s => !!Banners.ITEM_PATTERN[ITEMS[s.id].name], 23, 45);
    this.outSlot = this.slot(null, 0, 143, 58, { output: true, get: () => this.result(), set: () => {}, onTake: () => this.take() });
    this.playerSlots(8, 84);
    this.label('Loom', 8, 4);
    this.grid = elAt('loomgrid', 60, 13, ''); this.parts.push({ kind: 'el', node: this.grid });
    this.preview = elAt('loompreview', 141, 8, ''); this.parts.push({ kind: 'el', node: this.preview });
  }
  patterns() {
    const p = this.inv[2] && Banners.ITEM_PATTERN[ITEMS[this.inv[2].id].name];
    if (!this.inv[0] || !this.inv[1]) return [];
    return p ? [p] : Banners.NO_ITEM;
  }
  update() {
    const list = this.patterns();
    if (this.sel >= list.length) this.sel = list.length === 1 ? 0 : -1;
    if (list.length === 1 && this.inv[2]) this.sel = 0;
    this.drawGrid(list);
  }
  result() {
    const [b, d] = this.inv, list = this.patterns();
    if (!b || !d || this.sel < 0 || !list[this.sel]) return null;
    const L = Banners.layersOf(b); if (L.length >= 6) return null;
    const tag = Object.assign({}, b.tag || {}, { patterns: L.concat([[list[this.sel], ITEMS[d.id].name.replace('_dye', '')]]) });
    return stack(b.id, 1, { tag });
  }
  take() {
    for (const i of [0, 1]) { const s = this.inv[i]; s.count--; this.inv[i] = s.count > 0 ? s : null; }
    Sound.play('loom_take'); this.update(); Screens.render();
  }
  drawGrid(list) {
    const S = GUI.S, g = this.grid; g.innerHTML = '';
    g.style.width = 4 * 14 * S + 'px'; g.style.height = 4 * 14 * S + 'px';
    const [b, d] = this.inv, base = b ? Banners.baseOf(ITEMS[b.id].name) : 'white', col = d ? ITEMS[d.id].name.replace('_dye', '') : 'black';
    list.slice(this.scroll * 4, this.scroll * 4 + 16).forEach((p, i) => {
      const j = i + this.scroll * 4, cell = document.createElement('div'); cell.className = 'loomcell' + (j === this.sel ? ' sel' : '');
      cell.style.cssText = `left:${(i % 4) * 14 * S}px;top:${Math.floor(i / 4) * 14 * S}px;width:${14 * S}px;height:${14 * S}px`;
      const c = Banners.flagCanvas(base === 'white' && col === 'white' ? 'light_gray' : base, [[p, col]]);
      const img = document.createElement('img'); img.src = c.toDataURL(); img.style.cssText = `width:${5 * S}px;height:${10 * S}px;margin:${2 * S}px ${4.5 * S}px;image-rendering:pixelated`;
      cell.appendChild(img); cell.title = Banners.NAMES[p];
      cell.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); this.sel = j; Sound.play('ui'); this.update(); Screens.render(); });
      g.appendChild(cell);
    });
    if (list.length > 16) g.onwheel = e => { this.scroll = Math.max(0, Math.min(Math.ceil(list.length / 4) - 4, this.scroll + Math.sign(e.deltaY))); this.drawGrid(list); };
    // the result preview
    const r = this.result(); this.preview.innerHTML = '';
    if (r) { const img = document.createElement('img'); img.src = Banners.flagCanvas(Banners.baseOf(ITEMS[r.id].name), Banners.layersOf(r)).toDataURL(); img.style.cssText = `width:${20 * S * 0.8}px;height:${40 * S * 0.8}px;image-rendering:pixelated`; this.preview.appendChild(img); }
  }
  quickTargets(st) { const n = ITEMS[st.id].name; if (/_banner$/.test(n)) return [this.bannerSlot]; if (/_dye$/.test(n)) return [this.dyeSlot]; if (Banners.ITEM_PATTERN[n]) return [this.patSlot]; return []; }
  onClose() { for (const s of this.inv) if (s) { const left = Game.player.inv.add(s, 0, 36); if (left) ItemUse.drop(Game.player, left); } this.inv = [null, null, null]; }
}
