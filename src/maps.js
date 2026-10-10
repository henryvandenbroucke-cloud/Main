'use strict';
/* Maps, following the game: a new map covers 128 x 128 blocks (times 2^scale) on the game's grid, and while it
   is held it fills in around the player one sixteenth of the columns each tick, each pixel taking the most
   common map colour of its blocks, shaded lighter or darker by the height step from the pixel to its north
   (water by its depth). The 62 map colours are the game's; each block takes the nearest one to its texture,
   with the game's own colour for grass, leaves, water and the like. Maps in dimensions with a ceiling show
   the game's noise. The cartography table zooms out, copies and locks maps; cartographers' explorer maps point
   at the nearest monument, mansion or trial chambers. */
const Maps = (() => {
  const B = BID;
  const PAL = [0, 0x7fb238, 0xf7e9a3, 0xc7c7c7, 0xff0000, 0xa0a0ff, 0xa7a7a7, 0x007c00, 0xffffff, 0xa4a8b8, 0x976d4d, 0x707070, 0x4040ff, 0x8f7748, 0xfffcf5, 0xd87f33, 0xb24cd8, 0x6699d8, 0xe5e533, 0x7fcc19, 0xf27fa5, 0x4c4c4c, 0x999999, 0x4c7f99, 0x7f3fb2, 0x334cb2, 0x664c33, 0x667f33, 0x993333, 0x191919, 0xfaee4d, 0x5cdbd5, 0x4a80ff, 0x00d93a, 0x815631, 0x700200, 0xd1b1a1, 0x9f5224, 0x95576c, 0x706c8a, 0xba8524, 0x677535, 0xa04d4e, 0x392923, 0x876b62, 0x575c5c, 0x7a4958, 0x4c3e5c, 0x4c3223, 0x4c522a, 0x8e3c2e, 0x251610, 0xbd3031, 0x943f61, 0x5c191d, 0x167e86, 0x3a8e8c, 0x562c3e, 0x14b485, 0x646464, 0xd8af93, 0x7fa796];
  const BRIGHT = [180, 220, 255, 135];
  const C = { NONE: 0, GRASS: 1, SAND: 2, WOOL: 3, FIRE: 4, ICE: 5, METAL: 6, PLANT: 7, SNOW: 8, CLAY: 9, DIRT: 10, STONE: 11, WATER: 12, WOOD: 13, QUARTZ: 14, PODZOL: 34, NETHER: 35, DEEPSLATE: 59 };
  // ---------------------------------------------------------------- which map colour each block shows
  let MC = null;
  function colors() {
    if (MC) return MC;
    MC = new Uint8Array(BLOCKS.length);
    const nearest = c => { let best = 1, bd = 1e9; for (let i = 1; i < PAL.length; i++) { if (i === C.WATER) continue; const p = PAL[i]; const d = ((p >> 16) - (c >> 16)) ** 2 + (((p >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((p & 255) - (c & 255)) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    for (const d of BLOCKS) {
      const n = d.name;
      let c = -1;
      if (d.id === 0 || n === 'cave_air' || n === 'void_air' || n === 'barrier' || n === 'light' || n === 'structure_void' || n.endsWith('glass') || n.endsWith('glass_pane') || d.model === 'none' || d.model === 'torch' || d.model === 'wall_torch' || d.model === 'wire' || d.model === 'rail' || d.model === 'button' || d.model === 'lever') c = C.NONE;
      else if (d.fluid === 'water' || n === 'bubble_column' || n === 'kelp' || n === 'kelp_plant' || n === 'seagrass' || n === 'tall_seagrass') c = C.WATER;
      else if (d.fluid === 'lava' || n === 'fire' || n === 'tnt' || n === 'redstone_block') c = C.FIRE;
      else if (n === 'grass_block' || n === 'slime_block') c = C.GRASS;
      else if (n.endsWith('_leaves') || d.model === 'cross' || d.model === 'crop' || n === 'vine' || n === 'lily_pad' || n === 'cactus' || n === 'sugar_cane' || n === 'bamboo' || n.includes('azalea') || n === 'moss_carpet' && false) c = C.PLANT;
      else if (n === 'snow' || n === 'snow_block' || n === 'powder_snow' || n === 'white_wool' || n === 'white_carpet') c = C.SNOW;
      else if (n === 'ice' || n === 'packed_ice' || n === 'blue_ice' || n === 'frosted_ice') c = C.ICE;
      else if (n === 'stone' || n === 'cobblestone' || n === 'andesite' || n === 'gravel' || /_ore$/.test(n) && !n.startsWith('deepslate') && !n.startsWith('nether')) c = C.STONE;
      else if (n === 'dirt' || n === 'coarse_dirt' || n === 'farmland' || n === 'dirt_path' || n === 'rooted_dirt') c = C.DIRT;
      else if (n === 'podzol') c = C.PODZOL;
      else if (n === 'sand' || n === 'sandstone' || n === 'end_stone' || n === 'birch_planks') c = C.SAND;
      else if (n === 'netherrack' || n === 'nether_bricks' || n === 'magma_block') c = C.NETHER;
      else if (n.startsWith('deepslate') || n.startsWith('cobbled_deepslate') || n.startsWith('polished_deepslate')) c = C.DEEPSLATE;
      else if (n === 'clay') c = C.CLAY;
      else if (n === 'iron_block' || n === 'anvil' || n === 'cauldron' || n === 'iron_bars' || n === 'brewing_stand' || n === 'heavy_weighted_pressure_plate') c = C.METAL;
      else if (n === 'quartz_block' || n === 'diorite' || n === 'sea_lantern') c = C.QUARTZ;
      else if (n === 'oak_planks' || n === 'oak_log' || n === 'crafting_table' || n === 'chest' || n === 'bookshelf') c = C.WOOD;
      else if (n === 'gold_block') c = 30; else if (n === 'diamond_block') c = 31; else if (n === 'lapis_block') c = 32; else if (n === 'emerald_block') c = 33;
      if (c < 0) {
        const t = d.tex.up || d.tex.side, px = t && typeof Tex !== 'undefined' ? Tex.pixels(t) : null;
        if (!px) { c = C.STONE; }
        else { let r = 0, g = 0, b = 0, k = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 100) { r += px[i]; g += px[i + 1]; b += px[i + 2]; k++; } c = k ? nearest((Math.round(r / k) << 16) | (Math.round(g / k) << 8) | Math.round(b / k)) : C.NONE; }
      }
      MC[d.id] = c;
    }
    return MC;
  }
  // ---------------------------------------------------------------- map data
  const maps = new Map();
  let nextId = 0;
  function newData(scale, x, z, dim) {
    const size = 128 << scale, gx = Math.floor((x + 64) / size), gz = Math.floor((z + 64) / size);
    const d = { id: nextId++, scale, cx: gx * size + size / 2 - 64, cz: gz * size + size / 2 - 64, dim, colors: new Uint8Array(16384), locked: false, step: 0, deco: [], dirty: true };
    maps.set(d.id, d);
    return d;
  }
  function create(p, scale) { return newData(scale || 0, p.x, p.z, World.dim).id; }
  const get = id => maps.get(id);
  function setPx(d, x, z, v) { const i = x + z * 128; if (d.colors[i] === v) return false; d.colors[i] = v; d.dirty = true; return true; }
  // the game's MapItem.update
  function update(p, d) {
    if (d.locked || d.dim !== World.dim) return;
    const MCx = colors();
    const j = 1 << d.scale, i1 = Math.floor((p.x - d.cx) / j) + 64, j1 = Math.floor((p.z - d.cz) / j) + 64;
    const ceiling = World.dim === 'nether';
    let k1 = 128 / j; if (ceiling) k1 /= 2;
    d.step++;
    let flag = false;
    for (let k2 = i1 - k1 + 1; k2 < i1 + k1; k2++) {
      if ((k2 & 15) !== (d.step & 15) && !flag) continue;
      flag = false;
      let d0 = 0;
      for (let l2 = j1 - k1 - 1; l2 < j1 + k1; l2++) {
        if (k2 < 0 || l2 < -1 || k2 >= 128 || l2 >= 128) continue;
        const i3 = (k2 - i1) ** 2 + (l2 - j1) ** 2, edge = i3 > (k1 - 2) * (k1 - 2);
        const wx = (d.cx / j + k2 - 64) * j, wz = (d.cz / j + l2 - 64) * j;
        if (!World.loaded(wx, wz)) continue;
        const count = new Map();
        let depth = 0, d1 = 0;
        if (ceiling) {
          let l3 = Math.floor(wx) + Math.floor(wz) * 231871; l3 = Math.imul(Math.imul(l3, l3), 31287121) + Math.imul(l3, 11);
          if (((l3 >> 20) & 1) === 0) count.set(C.DIRT, 10); else count.set(C.STONE, 100);
          d1 = 100;
        } else {
          for (let a = 0; a < j; a++) for (let b = 0; b < j; b++) {
            const x = wx + a, z = wz + b;
            let y = Math.min(MAXY, World.heightAt(x, z) + 2), id = 0;
            while (y > MINY) { y--; id = World.getBlock(x, y, z); if (MCx[id] !== C.NONE) break; }
            // under water: count how deep it is
            if (BLOCKS[id].fluid || MCx[id] === C.WATER) { let yy = y - 1; while (yy > MINY) { const w = World.getBlock(x, yy--, z); depth++; if (!BLOCKS[w].fluid && MCx[w] !== C.WATER) break; } id = B.water; }
            d1 += y / (j * j);
            const c = MCx[id]; count.set(c, (count.get(c) || 0) + 1);
          }
        }
        depth = Math.floor(depth / (j * j));
        let col = C.NONE, best = -1; for (const [c, n] of count) if (n > best) { best = n; col = c; }
        let br;
        if (col === C.WATER) { const d2 = depth * 0.1 + ((k2 + l2) & 1) * 0.2; br = d2 < 0.5 ? 2 : d2 > 0.9 ? 0 : 1; }
        else { const d3 = (d1 - d0) * 4 / (j + 4) + (((k2 + l2) & 1) - 0.5) * 0.4; br = d3 > 0.6 ? 2 : d3 < -0.6 ? 0 : 1; }
        d0 = d1;
        if (l2 >= 0 && i3 < k1 * k1 && (!edge || ((k2 + l2) & 1) !== 0)) flag = setPx(d, k2, l2, col * 4 + br) || flag;
      }
    }
  }
  // explorer maps from cartographers: centred on the nearest structure, with its marker and a biome sketch
  function explorer(s, p) {
    const what = s.tag.explorer, loc = typeof Structures !== 'undefined' && Structures.locate ? Structures.locate(what === 'monument' ? 'ocean_monument' : what === 'mansion' ? 'woodland_mansion' : 'trial_chambers', Math.floor(p.x), Math.floor(p.z)) : null;
    const tx = loc ? loc[0] : p.x + 500, tz = loc ? loc[1] : p.z + 500;
    const d = newData(2, tx, tz, 'overworld');
    d.deco.push({ type: what, x: tx, z: tz });
    // the game's biome preview: the land tan, water blue, sampled from the world generator
    const j = 4, g = typeof Structures !== 'undefined' && Structures.gen ? Structures.gen('overworld') : null, o = {};
    for (let k = 0; k < 128; k++) for (let l = 0; l < 128; l++) {
      const x = (d.cx / j + k - 64) * j, z = (d.cz / j + l - 64) * j;
      const b = g ? BIOMES[g.column(x, z, o).biome].name : 'plains';
      d.colors[k + l * 128] = /ocean|river/.test(b) ? C.WATER * 4 + (((k + l) & 1) ? 1 : 2) : 15 * 4 + 1;
    }
    d.locked = true; d.explorerMap = true;
    s.tag = Object.assign({}, s.tag, { map: d.id }); delete s.tag.explorer;
    return d;
  }
  // ---------------------------------------------------------------- drawing
  const canvases = new Map();
  function canvasFor(d) {
    let c = canvases.get(d.id);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = 128; canvases.set(d.id, c); d.dirty = true; }
    if (d.dirty) {
      const g = c.getContext('2d'), img = g.createImageData(128, 128);
      for (let i = 0; i < 16384; i++) {
        const v = d.colors[i], o = i * 4;
        if (v < 4) { img.data[o] = 0; img.data[o + 3] = 0; continue; }
        const base = PAL[v >> 2], k = BRIGHT[v & 3] / 255;
        img.data[o] = (base >> 16) * k; img.data[o + 1] = ((base >> 8) & 255) * k; img.data[o + 2] = (base & 255) * k; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      d.dirty = false; d.ver = (d.ver || 0) + 1;
    }
    return c;
  }
  // a marker: the player's white arrow, frames in green, structures in their colours
  function marker(g, px, py, rot, kind, S) {
    g.save(); g.translate(px * S, py * S); g.rotate(rot);
    const col = { player: '#ffffff', frame: '#3ed43e', monument: '#3a7fae', mansion: '#5a3a2a', trial_chambers: '#c86a1e', target: '#c02020', offmap: '#ffffff' }[kind] || '#fff';
    g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = S * 0.6;
    if (kind === 'offmap') { g.beginPath(); g.arc(0, 0, 2 * S, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else if (kind === 'player' || kind === 'frame') { g.beginPath(); g.moveTo(0, -4 * S); g.lineTo(3 * S, 4 * S); g.lineTo(0, 2 * S); g.lineTo(-3 * S, 4 * S); g.closePath(); g.fill(); g.stroke(); }
    else { g.fillRect(-3 * S, -3 * S, 6 * S, 6 * S); g.strokeRect(-3 * S, -3 * S, 6 * S, 6 * S); g.fillStyle = '#000'; g.fillRect(-1 * S, -1 * S, 2 * S, 2 * S); }
    g.restore();
  }
  // the full view: paper, the map, and its markers, S canvas pixels per map pixel
  function draw(g, d, S, withPlayer) {
    g.drawImage(canvasFor(d), 0, 0, 128 * S, 128 * S);
    const j = 1 << d.scale, toPx = (x, z) => [(x - d.cx) / j + 64, (z - d.cz) / j + 64];
    for (const m of d.deco) { const [x, y] = toPx(m.x, m.z); if (x >= 0 && y >= 0 && x < 128 && y < 128) marker(g, x, y, 0, m.type, S); }
    for (const e of Entities.list) if (e.isMapFrame && e.item && e.item.tag && e.item.tag.map === d.id) { const [x, y] = toPx(e.x, e.z); if (x >= 0 && y >= 0 && x < 128 && y < 128) marker(g, x, y, [0, 0, Math.PI, 0, Math.PI / 2, -Math.PI / 2][e.face] || 0, 'frame', S); }
    const p = Game.player;
    if (withPlayer && p && d.dim === World.dim) {
      let [x, y] = toPx(p.x, p.z);
      if (x >= 0 && y >= 0 && x < 128 && y < 128) marker(g, x, y, -p.yaw + Math.PI, 'player', S);
      else if (Math.abs(x - 64) < 64 + 320 / j && Math.abs(y - 64) < 64 + 320 / j) marker(g, Math.max(0, Math.min(127, x)), Math.max(0, Math.min(127, y)), 0, 'offmap', S);
    }
  }
  // a map in an item frame: a block-sized plane
  function mesh(s) {
    const d = s.tag && maps.get(s.tag.map);
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#d8cfa8'; g.fillRect(0, 0, 256, 256);
    if (d) draw(g, d, 2, false);
    const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), entityMat(tex, { transparent: true }));
    m.frustumCulled = false; m.userData.mapId = d ? d.id : -1;
    return m;
  }
  // ---------------------------------------------------------------- the map in your hands
  const hand = document.createElement('canvas'); hand.id = 'mapHand'; hand.width = hand.height = 288; hand.className = 'hidden'; document.body.appendChild(hand);
  let handFor = -1, handVer = -1, handT = 0, handDrawn = 0;
  function heldMap(p) { for (const s of [p.inv.held, p.inv.offhand]) if (s && ITEMS[s.id].name === 'filled_map') return s; return null; }
  function tick(p) {
    if (!p) return;
    const s = heldMap(p);
    if (s && s.tag && s.tag.explorer) explorer(s, p);
    let d = s && s.tag && maps.get(s.tag.map);
    // an old map without data (or one from before maps were saved) starts again where it is used
    if (s && (!s.tag || s.tag.map === undefined || !d)) { d = newData(0, p.x, p.z, World.dim); s.tag = Object.assign({}, s.tag || {}, { map: d.id }); }
    if (d) update(p, d);
    const show = d && !UI.screenOpen() && p.view === 0 && Game.running;
    hand.classList.add('hidden'); // drawn in the first-person hands instead (see Hand)
    if (show && (handFor !== d.id || handVer !== d.ver || ++handT % 2 === 0)) {
      const g = hand.getContext('2d');
      g.fillStyle = '#d8cfa8'; g.fillRect(0, 0, 288, 288); g.fillStyle = '#b8a878'; g.fillRect(0, 0, 288, 6); g.fillRect(0, 282, 288, 6); g.fillRect(0, 0, 6, 288); g.fillRect(282, 0, 6, 288);
      g.save(); g.translate(16, 16); draw(g, d, 2, true); g.restore();
      handFor = d.id; handVer = d.ver; handDrawn++;
    }
  }
  function tooltip(s) {
    const d = s.tag && maps.get(s.tag.map);
    if (!d) return s.tag && s.tag.explorer ? '<div style="color:#aaa">Unknown Map</div>' : '';
    return `<div style="color:#aaa">Id #${d.id}</div>` + (UI.advancedTooltips ? `<div style="color:#aaa">Scaling at 1:${1 << d.scale}</div><div style="color:#aaa">(Level ${d.scale}/4)</div>` : '') + (d.locked && !d.explorerMap ? '<div style="color:#aaa">Locked</div>' : '');
  }
  // ---------------------------------------------------------------- saving
  const b64 = a => { let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => { const t = atob(s), a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };
  function save() { return { next: nextId, maps: [...maps.values()].map(d => ({ id: d.id, scale: d.scale, cx: d.cx, cz: d.cz, dim: d.dim, locked: d.locked, deco: d.deco, explorer: !!d.explorerMap, colors: b64(d.colors) })) }; }
  function load(o) {
    maps.clear(); canvases.clear(); nextId = 0;
    if (!o) return;
    nextId = o.next || 0;
    for (const m of o.maps || []) maps.set(m.id, { id: m.id, scale: m.scale, cx: m.cx, cz: m.cz, dim: m.dim, locked: !!m.locked, deco: m.deco || [], explorerMap: !!m.explorer, colors: unb64(m.colors), step: 0, dirty: true });
  }
  // ---------------------------------------------------------------- the cartography table's three uses
  function cartography(a, b) {
    if (!a || ITEMS[a.id].name !== 'filled_map' || !b) return null;
    const d = a.tag && maps.get(a.tag.map), n = ITEMS[b.id].name;
    if (!d) return null;
    if (n === 'paper' && d.scale < 4 && !d.locked) return { kind: 'zoom', out: () => { const nd = newData(d.scale + 1, d.cx, d.cz, d.dim); return stack('filled_map', 1, { tag: { map: nd.id } }); }, preview: stack('filled_map', 1, { tag: a.tag }) };
    if (n === 'map') return { kind: 'copy', out: () => stack('filled_map', 2, { tag: Object.assign({}, a.tag) }), preview: stack('filled_map', 2, { tag: a.tag }) };
    if (n === 'glass_pane' && !d.locked) return { kind: 'lock', out: () => { const nd = newData(d.scale, d.cx, d.cz, d.dim); nd.cx = d.cx; nd.cz = d.cz; nd.colors.set(d.colors); nd.deco = d.deco.slice(); nd.locked = true; return stack('filled_map', 1, { tag: { map: nd.id } }); }, preview: stack('filled_map', 1, { tag: a.tag }) };
    return null;
  }
  return { PAL, create, get, update, tick, mesh, draw, canvasFor, tooltip, save, load, cartography, explorer, colors, maps, handCanvas: hand, get handDrawn() { return handDrawn; } };
})();

class CartographyScreen extends Screens.Screen {
  constructor() {
    super('Cartography Table', 176, 166);
    this.inv = [null, null];
    const mk = (i, x, y, filter) => this.slot(null, i, x, y, { get: () => this.inv[i], set: v => { this.inv[i] = v && v.count > 0 ? v : null; this.update(); }, filter, onChange: () => this.update() });
    this.mapSlot = mk(0, 15, 15, s => ITEMS[s.id].name === 'filled_map');
    this.addSlot = mk(1, 15, 52, s => ['paper', 'map', 'glass_pane'].includes(ITEMS[s.id].name));
    this.outSlot = this.slot(null, 0, 145, 39, { output: true, get: () => { const r = Maps.cartography(this.inv[0], this.inv[1]); return r ? r.preview : null; }, set: () => {}, onTake: () => this.take() });
    this.playerSlots(8, 84);
    this.label('Cartography Table', 8, 4);
    this.view = elAt('cartoview', 67, 13, ''); this.parts.push({ kind: 'el', node: this.view });
  }
  take() {
    const r = Maps.cartography(this.inv[0], this.inv[1]); if (!r) return;
    const out = r.out();
    for (const i of [0, 1]) { const s = this.inv[i]; s.count--; this.inv[i] = s.count > 0 ? s : null; }
    Slots.cursor = out;
    Sound.play('cartography_take'); this.update(); Screens.render();
  }
  update() {
    const v = this.view; if (!v) return;
    const S = GUI.S, a = this.inv[0], d = a && a.tag && Maps.get(a.tag.map);
    v.innerHTML = '';
    v.style.width = 66 * S + 'px'; v.style.height = 66 * S + 'px';
    if (!d) return;
    const c = document.createElement('canvas'); c.width = c.height = 132; const g = c.getContext('2d');
    g.fillStyle = '#d8cfa8'; g.fillRect(0, 0, 132, 132); g.save(); g.translate(2, 2); Maps.draw(g, d, 1, true); g.restore();
    const r = Maps.cartography(this.inv[0], this.inv[1]);
    if (r && r.kind === 'lock') { g.fillStyle = 'rgba(80,120,160,0.35)'; g.fillRect(0, 0, 132, 132); }
    if (r && r.kind === 'zoom') { g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(33, 33, 66, 66); }
    c.style.cssText = `width:100%;height:100%;image-rendering:pixelated`;
    v.appendChild(c);
  }
  onClose() { for (const s of this.inv) if (s) { const left = Game.player.inv.add(s, 0, 36); if (left) ItemUse.drop(Game.player, left); } this.inv = [null, null]; }
}
