'use strict';
/* Particles, drawn as camera-facing points like the game's billboards: block and item debris (pieces of the
   real block or item texture), smoke, flames, critical hit stars, hearts, villager sparkles, explosions,
   water splashes and bubbles, portal sparkles, potion swirls, firework sparks. Each has the game's lifetime,
   gravity and drag (0.98 per tick), bounces off blocks, and is lit by the light where it is. Torches, fire,
   lava, campfires and portals give off their particles near the player (the game's animate tick). */
const Particles = (() => {
  const MAX = 6000;
  // ---------------------------------------------------------------- sprite sheet (8x8 cells on a 128x128 canvas)
  const sheet = document.createElement('canvas'); sheet.width = sheet.height = 128;
  const g = sheet.getContext('2d');
  const SP = {}; let nx = 0, ny = 0;
  function cell(name, w, h, draw) { w = w || 8; h = h || 8; if (nx + w > 128) { nx = 0; ny += 8; } if (w > 8 && nx % 16) { nx += 8; if (nx + w > 128) { nx = 0; ny += 8; } } SP[name] = [nx, ny, w, h]; g.save(); g.translate(nx, ny); draw(g, w, h); g.restore(); nx += w; if (h > 8 && nx >= 128) { ny += h - 8; } }
  const px = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  const disc = (c, cx, cy, r, col) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) px(c, x, y, col); };
  // generic smoke puffs, biggest first (the game's "generic_7" .. "generic_0")
  for (let i = 0; i < 8; i++) cell('generic_' + i, 8, 8, c => { const r = 3.6 - i * 0.42; disc(c, 4, 4, r, '#ffffff'); if (r > 1.5) { px(c, 3, 3, '#e8e8e8'); px(c, 5, 5, '#d8d8d8'); } });
  for (let i = 0; i < 8; i++) cell('spark_' + i, 8, 8, c => { const r = 3 - i * 0.35; c.fillStyle = '#fff'; c.fillRect(4 - 0.5, 4 - r, 1, r * 2); c.fillRect(4 - r, 4 - 0.5, r * 2, 1); if (r > 1.5) { px(c, 3, 3, '#fff'); px(c, 4, 3, '#fff'); px(c, 3, 4, '#fff'); px(c, 4, 4, '#fff'); } });
  for (let i = 0; i < 8; i++) cell('effect_' + i, 8, 8, c => { const a = i / 8 * Math.PI * 2; for (let k = 0; k < 6; k++) { const t = a + k * 0.9; px(c, Math.round(4 + Math.cos(t) * (3 - k * 0.4)), Math.round(4 + Math.sin(t) * (3 - k * 0.4)), '#fff'); } px(c, 4, 4, '#fff'); });
  // the enchanting table's glyphs (letters of the standard galactic alphabet)
  const SGA = [['#.#', '###', '#.#'], ['##.', '#.#', '##.'], ['###', '#..', '###'], ['#..', '###', '..#'], ['.#.', '#.#', '.#.'], ['###', '.#.', '.#.'], ['#.#', '.#.', '#.#'], ['##.', '.##', '..#']];
  SGA.forEach((g, i) => cell('sga_' + i, 8, 8, c => g.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, 2 + x, 2 + y, '#ffffff'); }))));
  cell('flame', 8, 8, c => { const rows = ['...##...', '..####..', '..#yy#..', '.#yyyy#.', '.#yoyy#.', '.#yooy#.', '..#oo#..', '...##...']; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') px(c, x, y, ch === '#' ? '#ff8a1e' : ch === 'y' ? '#ffd84a' : '#fff6c8'); })); });
  cell('soul_flame', 8, 8, c => { const rows = ['...##...', '..####..', '..#yy#..', '.#yyyy#.', '.#yoyy#.', '.#yooy#.', '..#oo#..', '...##...']; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') px(c, x, y, ch === '#' ? '#1aa0c8' : ch === 'y' ? '#5ae0f0' : '#d8ffff'); })); });
  cell('lava', 8, 8, c => { disc(c, 4, 4, 2.6, '#ff8a00'); px(c, 3, 3, '#ffd84a'); px(c, 4, 3, '#ffd84a'); });
  cell('crit', 8, 8, c => { const rows = ['...#....', '...#....', '#..#..#.', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..']; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, x, y, '#fff'); })); });
  cell('heart', 8, 8, c => { const rows = ['.##.##..', '#xx#xx#.', '#xxxxx#.', '#xxxxx#.', '.#xxx#..', '..#x#...', '...#....', '........']; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, x, y, '#5a0000'); else if (ch === 'x') px(c, x, y, y < 2 ? '#ff7070' : '#e81010'); })); });
  cell('damage', 8, 8, c => { const rows = ['.##.##..', '#xx#xx#.', '#xxxxx#.', '#xxxxx#.', '.#xxx#..', '..#x#...', '...#....', '........']; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, x, y, '#1a0000'); else if (ch === 'x') px(c, x, y, '#6a0a0a'); })); });
  cell('angry', 8, 8, c => { disc(c, 4, 3.5, 3, '#3a3a3a'); px(c, 2, 6, '#ffd800'); px(c, 3, 7, '#ffd800'); px(c, 5, 6, '#ffd800'); });
  cell('happy', 8, 8, c => { px(c, 3, 1, '#4ae04a'); px(c, 3, 5, '#4ae04a'); px(c, 1, 3, '#4ae04a'); px(c, 5, 3, '#4ae04a'); px(c, 3, 2, '#9aff9a'); px(c, 3, 4, '#9aff9a'); px(c, 2, 3, '#9aff9a'); px(c, 4, 3, '#9aff9a'); px(c, 3, 3, '#ffffff'); });
  cell('note', 8, 8, c => { c.fillStyle = '#fff'; c.fillRect(5, 0, 1, 6); c.fillRect(5, 0, 2, 1); c.fillRect(6, 1, 1, 1); c.fillRect(2, 4, 3, 3); });
  cell('bubble', 8, 8, c => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4); if (d < 3.2 && d > 2.2) px(c, x, y, '#cfe8ff'); } px(c, 3, 2, '#ffffff'); });
  for (let i = 0; i < 4; i++) cell('splash_' + i, 8, 8, c => { px(c, 3, 3 + i % 2, '#ffffff'); px(c, 4, 3, '#ffffff'); if (i > 1) px(c, 3, 2, '#ffffff'); });
  cell('drip', 8, 8, c => { c.fillStyle = '#fff'; c.fillRect(3, 2, 2, 3); c.fillRect(4, 1, 1, 1); });
  for (let i = 0; i < 8; i++) cell('portal_' + i, 8, 8, c => { const r = 2.6 - i * 0.25; disc(c, 4, 4, r, '#ffffff'); });
  cell('snowflake', 8, 8, c => { c.fillStyle = '#fff'; c.fillRect(3, 1, 1, 5); c.fillRect(1, 3, 5, 1); px(c, 2, 2, '#fff'); px(c, 4, 4, '#fff'); px(c, 4, 2, '#fff'); px(c, 2, 4, '#fff'); });
  cell('glint', 8, 8, c => { px(c, 3, 3, '#fff'); px(c, 4, 3, '#fff'); px(c, 3, 4, '#fff'); px(c, 4, 4, '#fff'); });
  cell('leaf', 8, 8, c => { c.fillStyle = '#fff'; c.fillRect(2, 3, 4, 2); c.fillRect(3, 2, 2, 4); });
  cell('drop', 8, 8, c => { c.fillStyle = '#fff'; c.fillRect(3, 3, 2, 2); });
  // the sweep arc and explosion puffs are 16x16
  for (let i = 0; i < 8; i++) cell('sweep_' + i, 16, 16, c => { for (let k = 0; k < 40; k++) { const t = Math.PI * (0.15 + k / 40 * 0.7), r = 6.5 - i * 0.2; const x = 8 + Math.cos(t) * r, y = 12 - Math.sin(t) * r; px(c, Math.floor(x), Math.floor(y), i < 6 ? '#ffffff' : '#c8c8c8'); if (k % 2) px(c, Math.floor(x), Math.floor(y) + 1, '#d8d8d8'); } });
  for (let i = 0; i < 16; i++) cell('explosion_' + i, 16, 16, c => { const r = 3 + i * 0.35, n = Math.max(0, 1 - i / 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); const h = Math.sin(x * 3.1 + y * 1.7 + i) * 1.2; if (d < r + h && d > (i > 8 ? (i - 8) * 0.8 : 0)) { const v = Math.floor(255 * (0.55 + 0.45 * n) - d * 6); px(c, x, y, `rgb(${v},${v},${v})`); } } });
  for (let i = 0; i < 12; i++) cell('big_smoke_' + i, 16, 16, c => { const r = 4 + i * 0.2; disc(c, 8, 8, r, '#ffffff'); disc(c, 6, 7, r * 0.5, '#e8e8e8'); });
  const tex = new THREE.CanvasTexture(sheet); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.flipY = false;

  // ---------------------------------------------------------------- the point systems
  const VERT = `
in float aSize; in vec4 aRect; in vec4 aColor; in vec3 aLight;
uniform float uScale;
out vec4 vRect; out vec4 vColor; out vec3 vLight; out float vDist;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.05, -mv.z);
  vRect = aRect; vColor = aColor; vLight = aLight;
}`;
  const FRAG = (arr) => `
precision highp float; ${arr ? 'precision highp sampler2DArray; uniform sampler2DArray uTex;' : 'uniform sampler2D uSheet;'}
uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd;
${LIGHT_GLSL}
in vec4 vRect; in vec4 vColor; in vec3 vLight; in float vDist;
out vec4 fragColor;
void main(){
  vec2 uv = vec2(mix(vRect.x, vRect.z, gl_PointCoord.x), mix(vRect.y, vRect.w, gl_PointCoord.y));
  vec4 t = ${arr ? 'texture(uTex, vec3(uv, vLight.z))' : 'texture(uSheet, uv)'};
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vColor.rgb;
  ${arr ? 'c *= lightmap(vLight.x, vLight.y);' : 'if (vLight.z < 0.5) c *= lightmap(vLight.x, vLight.y);'}
  float fog = clamp((vDist - uFogStart) / max(uFogEnd - uFogStart, 0.001), 0.0, 1.0);
  fragColor = vec4(mix(c, uFogColor, fog), t.a * vColor.a);
}`;
  function system(arr, blend) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), rect = new Float32Array(MAX * 4), col = new Float32Array(MAX * 4), light = new Float32Array(MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRect', new THREE.BufferAttribute(rect, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLight', new THREE.BufferAttribute(light, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const u = { uScale: { value: 400 }, uSheet: { value: arr === 'icons' ? null : tex } };
    for (const k in U) u[k] = U[k];
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG(arr === true), glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: blend || THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
    return { geo, pos, size, rect, col, light, mat, pts, list: [] };
  }
  const SYS = { sheet: system(false), block: system(true), icons: system('icons') };
  // ---------------------------------------------------------------- particles
  class P {
    constructor(x, y, z, vx, vy, vz) { this.x = x; this.y = y; this.z = z; this.px = x; this.py = y; this.pz = z; this.vx = vx || 0; this.vy = vy || 0; this.vz = vz || 0; this.age = 0; this.life = 20; this.grav = 0; this.drag = 0.98; this.size = 0.1; this.r = 1; this.g = 1; this.b = 1; this.a = 1; this.phys = true; this.bright = false; this.sprite = 'generic_0'; this.onGround = false; }
  }
  const settingCount = n => Settings.particles === 'minimal' ? Math.ceil(n * 0.25) : Settings.particles === 'decreased' ? Math.ceil(n * 0.5) : n;
  function add(sys, p) { const S = SYS[sys]; if (S.list.length >= MAX) S.list.shift(); S.list.push(p); return p; }
  const rand = () => Math.random();
  // ---------------------------------------------------------------- the tick
  function tick() {
    for (const k in SYS) {
      const L = SYS[k].list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.px = p.x; p.py = p.y; p.pz = p.z;
        if (++p.age >= p.life) { L.splice(i, 1); continue; }
        if (p.update) p.update(p);
        p.vy -= 0.04 * p.grav;
        move(p);
        p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
        if (p.onGround) { p.vx *= 0.7; p.vz *= 0.7; }
      }
    }
    if (Game.player && World.dim) animateTick(Game.player);
  }
  function solidAt(x, y, z) { const id = World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return SOLID[id] && BLOCKS[id].model !== 'cross'; }
  function move(p) {
    if (!p.phys) { p.x += p.vx; p.y += p.vy; p.z += p.vz; return; }
    p.onGround = false;
    if (p.vy !== 0) { const ny = p.y + p.vy; if (solidAt(p.x, ny, p.z)) { if (p.vy < 0) p.onGround = true; p.vy = 0; } else p.y = ny; }
    if (p.vx !== 0) { const nx = p.x + p.vx; if (solidAt(nx, p.y, p.z)) p.vx = 0; else p.x = nx; }
    if (p.vz !== 0) { const nz = p.z + p.vz; if (solidAt(p.x, p.y, nz)) p.vz = 0; else p.z = nz; }
  }
  // ---------------------------------------------------------------- drawing
  function render(a) {
    const scale = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const k in SYS) {
      const S = SYS[k], L = S.list;
      S.mat.uniforms.uScale.value = scale;
      if (k === 'block') S.mat.uniforms.uTex.value = U.uTex.value;
      if (k === 'icons' && !S.mat.uniforms.uSheet.value && Icons.canvas) S.mat.uniforms.uSheet.value = ItemMesh.atlas();
      let n = 0;
      for (const p of L) {
        const i = n++;
        S.pos[i * 3] = p.px + (p.x - p.px) * a; S.pos[i * 3 + 1] = p.py + (p.y - p.py) * a; S.pos[i * 3 + 2] = p.pz + (p.z - p.pz) * a;
        S.size[i] = (p.sizeFn ? p.sizeFn(p, a) : p.size) * 2;
        if (k === 'sheet') { const sp = SP[p.spriteFn ? p.spriteFn(p) : p.sprite] || SP.generic_0; S.rect[i * 4] = sp[0] / 128; S.rect[i * 4 + 1] = sp[1] / 128; S.rect[i * 4 + 2] = (sp[0] + sp[2]) / 128; S.rect[i * 4 + 3] = (sp[1] + sp[3]) / 128; }
        else { S.rect[i * 4] = p.u0; S.rect[i * 4 + 1] = p.v0; S.rect[i * 4 + 2] = p.u1; S.rect[i * 4 + 3] = p.v1; }
        S.col[i * 4] = p.r; S.col[i * 4 + 1] = p.g; S.col[i * 4 + 2] = p.b; S.col[i * 4 + 3] = p.alphaFn ? p.alphaFn(p, a) : p.a;
        if (p.bright) { S.light[i * 3] = 1; S.light[i * 3 + 1] = 1; S.light[i * 3 + 2] = k === 'block' ? p.layer : 1; }
        else { const l = World.getLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); S.light[i * 3] = (l >> 4) / 15; S.light[i * 3 + 1] = (l & 15) / 15; S.light[i * 3 + 2] = k === 'block' ? p.layer : 0; }
      }
      S.geo.setDrawRange(0, n);
      if (n) for (const at of ['position', 'aSize', 'aRect', 'aColor', 'aLight']) S.geo.getAttribute(at).needsUpdate = true;
    }
  }
  // ---------------------------------------------------------------- spawners
  function generic(x, y, z, vx, vy, vz, o) { const p = new P(x, y, z, vx, vy, vz); Object.assign(p, o); return add('sheet', p); }
  // smoke that grows dimmer and rises (the game's "smoke" particle: 8 frames over its life)
  function smokeAt(x, y, z, vx, vy, vz, big) {
    const p = new P(x, y, z, vx * 0.1 + (rand() * 2 - 1) * 0.0, vy * 0.1 + 0.0, vz * 0.1);
    const c = rand() * 0.3; p.r = p.g = p.b = c; p.size = 0.1 * (rand() * 0.5 + 0.5) * (big ? 2.5 : 1) * 0.75; p.life = Math.floor(8 / (rand() * 0.8 + 0.2) * (big ? 2.5 : 1)); p.grav = -0.1; p.drag = 0.96; p.phys = true;
    p.spriteFn = q => 'generic_' + Math.min(7, Math.floor((q.age / q.life) * 8));
    p.sizeFn = (q, a) => q.size * Math.min(1, (q.age + a) / q.life * 32);
    return add('sheet', p);
  }
  function flameAt(x, y, z, vx, vy, vz, soul) {
    const p = new P(x, y, z, vx, vy, vz); p.sprite = soul ? 'soul_flame' : 'flame'; p.bright = true; p.size = 0.1 * (rand() * 0.2 + 0.5) * 0.75; p.life = Math.floor(8 / (rand() * 0.8 + 0.2)) + 4; p.drag = 0.96; p.phys = false;
    p.sizeFn = (q, a) => { const f = (q.age + a) / q.life; return q.size * (1 - f * f * 0.5); };
    return add('sheet', p);
  }
  // block debris: pieces of the block's own texture (a random quarter of it)
  function blockBits(x, y, z, vx, vy, vz, id, st, face) {
    const d = BLOCKS[id]; if (!d || d.model === 'none' || id === 0) return;
    const texName = d.tex.particle || d.tex.side || d.tex.up || d.tex.front;
    if (!texName) return;
    const t = Tex.get(texName); if (!t) return;
    const p = new P(x, y, z, vx, vy, vz); p.layer = t.layer + 0.1; p.grav = 1; p.size = 0.1 * (rand() * 0.5 + 0.5) / 2 * 2; p.life = Math.floor(4 / (rand() * 0.9 + 0.1)); p.drag = 0.98;
    const uo = Math.floor(rand() * 4) / 4, vo = Math.floor(rand() * 4) / 4;
    p.u0 = uo; p.v0 = vo; p.u1 = uo + 0.25; p.v1 = vo + 0.25;
    let tint = null;
    if (d.tint === 'grass' && (texName.includes('top') || d.name !== 'grass_block')) tint = BIOMES[World.biomeAt(Math.floor(x), Math.floor(z))].grass;
    else if (d.tint === 'foliage') tint = BIOMES[World.biomeAt(Math.floor(x), Math.floor(z))].foliage;
    else if (typeof d.tint === 'number') tint = d.tint;
    const k = 0.6;
    p.r = k * (tint ? (tint >> 16 & 255) / 255 : 1); p.g = k * (tint ? (tint >> 8 & 255) / 255 : 1); p.b = k * (tint ? (tint & 255) / 255 : 1);
    if (d.name === 'grass_block' && !tint) { p.r = p.g = p.b = k; }
    return add('block', p);
  }
  function blockBreak(x, y, z, id, st) {
    const n = Settings.particles === 'minimal' ? 2 : Settings.particles === 'decreased' ? 3 : 4;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const fx = (i + 0.5) / n, fy = (j + 0.5) / n, fz = (k + 0.5) / n;
      blockBits(x + fx, y + fy, z + fz, fx - 0.5, fy - 0.5, fz - 0.5, id, st);
    }
  }
  function blockHit(x, y, z, id, face) {
    const e = 0.1; let px2 = x + rand() * (1 - e * 2) + e, py = y + rand() * (1 - e * 2) + e, pz = z + rand() * (1 - e * 2) + e;
    if (face === 0) py = y - e; if (face === 1) py = y + 1 + e; if (face === 2) pz = z - e; if (face === 3) pz = z + 1 + e; if (face === 4) px2 = x - e; if (face === 5) px2 = x + 1 + e;
    const p = blockBits(px2, py, pz, 0, 0, 0, id, World.getState(x, y, z), face);
    if (p) { p.vx = (rand() * 2 - 1) * 0.4 * 0.2; p.vy = (rand() * 2 - 1) * 0.4 * 0.2; p.vz = (rand() * 2 - 1) * 0.4 * 0.2; p.size *= 0.6; }
  }
  // an item's sprite broken into bits (eating, snowballs, eggs, breaking tools)
  function itemBreak(x, y, z, itemId, n, sp) {
    const i = Icons.index[itemId]; if (i < 0) return;
    const C = Icons.CELL, COLS = 42, N = C * COLS, cu = (i % COLS) * C / N, cv = Math.floor(i / COLS) * C / N, D = C / N;
    for (let k = 0; k < settingCount(n || 8); k++) {
      const p = new P(x, y, z, (rand() - 0.5) * 0.15 * (sp || 1), rand() * 0.15 + 0.05, (rand() - 0.5) * 0.15 * (sp || 1));
      p.grav = 1; p.size = 0.05 + rand() * 0.03; p.life = Math.floor(4 / (rand() * 0.9 + 0.1));
      const uo = (Math.floor(rand() * 3) + 0.5) / 4, vo = (Math.floor(rand() * 3) + 0.5) / 4;
      p.u0 = cu + uo * D; p.v0 = cv + vo * D; p.u1 = p.u0 + D / 4; p.v1 = p.v0 + D / 4;
      add('icons', p);
    }
  }
  const at = e => [e.x, e.y + e.h * 0.5, e.z];
  function crit(e, n) {
    for (let k = 0; k < settingCount(n || 16); k++) { const vx = rand() * 2 - 1, vy = rand() * 2 - 1, vz = rand() * 2 - 1; if (vx * vx + vy * vy + vz * vz > 1) continue; const p = generic(e.x + vx * e.w / 4, e.y + e.h / 2 + vy * e.h / 4, e.z + vz * e.w / 4, vx * 0.7, vy * 0.7 + 0.1, vz * 0.7, { sprite: 'crit', size: 0.1 * 0.75, life: 7 + rnd(4), drag: 0.7, grav: 0.5 }); p.r = p.g = p.b = rand() * 0.3 + 0.6; }
  }
  function magicCrit(e, n) { for (let k = 0; k < settingCount(n || 16); k++) { const vx = rand() * 2 - 1, vy = rand() * 2 - 1, vz = rand() * 2 - 1; const p = generic(e.x + vx * e.w / 4, e.y + e.h / 2 + vy * e.h / 4, e.z + vz * e.w / 4, vx * 0.7, vy * 0.7 + 0.1, vz * 0.7, { sprite: 'crit', size: 0.075, life: 7 + rnd(4), drag: 0.7, grav: 0.5 }); p.r = 0.4 * (rand() * 0.3 + 0.6); p.g = 0.6 * (rand() * 0.3 + 0.6); p.b = rand() * 0.3 + 0.6 + 0.1; } }
  function sweep(p) {
    const yaw = p.yaw, x = p.x - Math.sin(yaw) * 1.0, z = p.z - Math.cos(yaw) * 1.0, y = p.y + p.h * 0.5;
    const q = generic(x, y, z, 0, 0, 0, { sprite: 'sweep_0', size: 1.0 * 0.5, life: 4, phys: false, drag: 1 });
    q.spriteFn = s => 'sweep_' + Math.min(7, Math.floor(s.age / s.life * 8)); const c = rand() * 0.4 + 0.6; q.r = q.g = q.b = c;
  }
  function smoke(e, n) { const [x, y, z] = e.h !== undefined ? [e.x, e.y + (e.h || 0) * 0.5, e.z] : [e.x, e.y, e.z]; for (let k = 0; k < (n || 7); k++) smokeAt(x + (rand() - 0.5) * (e.w || 0.5), y + (rand() - 0.5) * (e.h || 0.5), z + (rand() - 0.5) * (e.w || 0.5), (rand() - 0.5) * 0.4, 0.2, (rand() - 0.5) * 0.4); }
  // mobs vanish in a puff of white clouds when they die
  function poof(e) {
    for (let k = 0; k < settingCount(20); k++) {
      const p = generic(e.x + (rand() * 2 - 1) * e.w, e.y + rand() * e.h, e.z + (rand() * 2 - 1) * e.w, (rand() * 2 - 1) * 0.02 * 0 + (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, { size: 0.15 * (rand() * 0.5 + 0.5), life: Math.floor(8 / (rand() * 0.8 + 0.2)), grav: 0, drag: 0.9 });
      p.spriteFn = s => 'generic_' + Math.min(7, Math.floor(s.age / s.life * 8)); const c = 1 - rand() * 0.3; p.r = p.g = p.b = c;
    }
  }
  function heart(e, n) { for (let k = 0; k < (n || 1); k++) generic(e.x + (rand() * 2 - 1) * e.w, e.y + 0.5 + rand() * e.h, e.z + (rand() * 2 - 1) * e.w, (rand() - 0.5) * 0.02, rand() * 0.02 + 0.05, (rand() - 0.5) * 0.02, { sprite: 'heart', size: 0.1 * 0.75 * 2, life: 16, grav: 0, drag: 0.86, phys: false }); }
  function damage(e, amount) { for (let k = 0; k < Math.min(10, Math.floor(amount / 2)); k++) generic(e.x + (rand() - 0.5) * e.w, e.y + e.h * 0.5, e.z + (rand() - 0.5) * e.w, (rand() - 0.5) * 0.2, rand() * 0.2, (rand() - 0.5) * 0.2, { sprite: 'damage', size: 0.15, life: 20, grav: 0.4, drag: 0.6 }); }
  function happy(e, n) { for (let k = 0; k < (n || 7); k++) { const p = generic(e.x + (rand() * 2 - 1) * (e.w || 0.5), e.y + 0.5 + rand() * (e.h || 0.5), e.z + (rand() * 2 - 1) * (e.w || 0.5), (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.04, { sprite: 'happy', size: 0.1, life: 20 + rnd(10), grav: 0, drag: 0.7, phys: false }); p.bright = false; } }
  function boneMeal(x, y, z, n) { for (let k = 0; k < (n || 15); k++) happy({ x: x + 0.5 + (rand() - 0.5), y: y + rand() * 0.6 - 0.5, z: z + 0.5 + (rand() - 0.5), w: 0.3, h: 0.3 }, 1); }
  function angry(e) { for (let k = 0; k < 5; k++) generic(e.x + (rand() * 2 - 1) * e.w, e.y + 0.5 + rand() * e.h, e.z + (rand() * 2 - 1) * e.w, 0, 0.02, 0, { sprite: 'angry', size: 0.15, life: 16, grav: 0, phys: false }); }
  function totem(e) {
    for (let k = 0; k < settingCount(80); k++) { const p = generic(e.x, e.y + e.h * 0.5, e.z, (rand() - 0.5) * 1.2, (rand()) * 1.2, (rand() - 0.5) * 1.2, { size: 0.1, life: 60 + rnd(12), grav: 1.25, drag: 0.6 }); p.spriteFn = s => 'spark_' + Math.min(7, Math.floor(s.age / s.life * 8)); if (rand() < 0.25) { p.r = 0.9; p.g = 0.9; p.b = 0.3; } else { p.r = 0.4 + rand() * 0.3; p.g = 0.75 + rand() * 0.2; p.b = 0.3; } p.bright = true; }
  }
  function portal(x, y, z, h, n) {
    for (let k = 0; k < settingCount(n || 32); k++) { const p = generic(x + (rand() - 0.5), y + rand() * (h || 1), z + (rand() - 0.5), (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4 - 0.1, (rand() - 0.5) * 0.4, { size: 0.1 * (rand() * 0.2 + 0.5), life: 40 + rnd(10), phys: false, drag: 1 }); const f = rand() * 0.6 + 0.4; p.r = f * 0.9; p.g = f * 0.3; p.b = f; p.spriteFn = s => 'portal_' + Math.min(7, Math.floor(s.age / s.life * 8)); p.bright = true; }
  }
  function bubble(x, y, z) { generic(x, y, z, (rand() - 0.5) * 0.02, 0.002 + rand() * 0.02, (rand() - 0.5) * 0.02, { sprite: 'bubble', size: 0.05 + rand() * 0.05, life: Math.floor(8 / (rand() * 0.8 + 0.2)), grav: -0.05, drag: 0.85, update: p => { if (!BLOCKS[World.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].fluid) p.age = p.life; } }); }
  function splash(x, y, z, n) { for (let k = 0; k < (n || 1); k++) { const p = generic(x, y, z, (rand() - 0.5) * 0.3, rand() * 0.2 + 0.1, (rand() - 0.5) * 0.3, { sprite: 'splash_' + rnd(4), size: 0.05, life: Math.floor(8 / (rand() * 0.8 + 0.2)), grav: 0.6, drag: 0.98 }); p.r = 0.6; p.g = 0.7; p.b = 1; } }
  function explosion(x, y, z, big) {
    const n = big ? 8 : 1;
    for (let k = 0; k < n; k++) {
      const ex = x + (big ? (rand() - rand()) * 4 : 0), ey = y + (big ? (rand() - rand()) * 4 : 0), ez = z + (big ? (rand() - rand()) * 4 : 0);
      const delay = big ? k : 0;
      const p = generic(ex, ey, ez, 0, 0, 0, { size: 2.0 * (1 - rand() * 0.5) * 0.5, life: 6 + rnd(4), phys: false, drag: 1, grav: 0, bright: true });
      p.age = -delay; p.spriteFn = s => 'explosion_' + Math.max(0, Math.min(15, Math.floor(Math.max(0, s.age) / s.life * 16))); const c = rand() * 0.6 + 0.4; p.r = p.g = p.b = c;
      p.alphaFn = s => s.age < 0 ? 0 : 1;
    }
    for (let k = 0; k < settingCount(big ? 40 : 10); k++) poof({ x: x + (rand() - 0.5) * 3, y: y + (rand() - 0.5) * 3, z: z + (rand() - 0.5) * 3, w: 0.5, h: 0.5 });
  }
  function furnace(x, y, z, facing, kind) {
    const f = facing, ox = x + 0.5, oy = y + rand() * 6 / 16, oz = z + 0.5, j = rand() * 0.6 - 0.3;
    const dx = DX[f] * 0.52, dz = DZ[f] * 0.52, sx = DX[f] ? 0 : j, sz = DZ[f] ? 0 : j;
    smokeAt(ox + dx + sx, oy, oz + dz + sz, 0, 0, 0);
    if (kind === 'f' || kind === 'b') flameAt(ox + dx + sx, oy, oz + dz + sz, 0, 0, 0);
  }
  function campfireSmoke(x, y, z, signal) {
    const p = generic(x + 0.5 + rand() / 3 * (rand() < 0.5 ? 1 : -1), y + rand() + rand(), z + 0.5 + rand() / 3 * (rand() < 0.5 ? 1 : -1), 0, 0.07, 0, { size: 0.75, life: signal ? 280 + rnd(50) : 80 + rnd(50), grav: 3e-6, drag: 1, phys: false });
    p.r = p.g = p.b = 0.9; p.a = 0.95; p.spriteFn = s => 'big_smoke_' + Math.min(11, Math.floor(s.age / s.life * 12)); p.update = s => { s.vx += rand() / 5000 * (rand() < 0.5 ? 1 : -1); s.vz += rand() / 5000 * (rand() < 0.5 ? 1 : -1); s.vy -= 3e-6; }; p.alphaFn = s => s.age > s.life - 60 ? Math.max(0, (s.life - s.age) / 60) * 0.95 : 0.95;
  }
  function eat(p, s) { const lv = p.lookVec(); itemBreak(p.x + lv[0] * 0.5, p.eyeY - 0.1 + lv[1] * 0.5, p.z + lv[2] * 0.5, s.id, 5, 0.5); }
  function slime(e) { const n = e.size * 8; for (let k = 0; k < Math.min(32, n); k++) { const a = rand() * Math.PI * 2, r = rand() * 0.5 + 0.5; itemBreak(e.x + Math.sin(a) * e.size * 0.5 * r, e.y, e.z + Math.cos(a) * e.size * 0.5 * r, e.type === 'magma_cube' ? IID.magma_cream : IID.slime_ball, 1, 0.3); } }
  function potionSplash(x, y, z, potion) {
    const c = typeof Potions !== 'undefined' && Potions.colorOf ? Potions.colorOf(potion) : potion === 'experience' ? 0x30c030 : 0x385dc6;
    for (let k = 0; k < 8; k++) itemBreak(x, y, z, IID.splash_potion, 1);
    for (let k = 0; k < settingCount(100); k++) { const s = rand() * 4, a = rand() * Math.PI * 2; const p = generic(x + Math.cos(a) * s * 0.1, y + 0.01 * s, z + Math.sin(a) * s * 0.1, Math.cos(a) * s * 0.05, 0.01 + rand() * 0.05, Math.sin(a) * s * 0.05, { size: 0.1, life: Math.floor(8 / (rand() * 0.8 + 0.2)), drag: 0.96, grav: 0 }); const f = 0.75 + rand() * 0.25; p.r = ((c >> 16) & 255) / 255 * f; p.g = ((c >> 8) & 255) / 255 * f; p.b = (c & 255) / 255 * f; p.spriteFn = q => 'effect_' + (7 - Math.min(7, Math.floor(q.age / q.life * 8))); p.bright = potion === 'experience'; }
  }
  // swirls around entities with potion effects
  function effects(e, color, ambient) { if (rand() > (ambient ? 0.1 : 0.5)) return; const p = generic(e.x + (rand() - 0.5) * e.w, e.y + rand() * e.h, e.z + (rand() - 0.5) * e.w, 0, 0, 0, { size: 0.1, life: Math.floor(8 / (rand() * 0.8 + 0.2)), drag: 0.96, grav: -0.002, phys: false }); p.r = ((color >> 16) & 255) / 255; p.g = ((color >> 8) & 255) / 255; p.b = (color & 255) / 255; p.a = ambient ? 0.15 : 1; p.spriteFn = q => 'effect_' + (7 - Math.min(7, Math.floor(q.age / q.life * 8))); }
  function note(x, y, z, pitch) { const p = generic(x + 0.5, y + 1.2, z + 0.5, 0, 0.01, 0, { sprite: 'note', size: 0.15, life: 6, grav: 0, drag: 0.66, phys: false }); const f = pitch / 24; p.r = Math.max(0, Math.sin((f + 0) * Math.PI * 2) * 0.65 + 0.35); p.g = Math.max(0, Math.sin((f + 1 / 3) * Math.PI * 2) * 0.65 + 0.35); p.b = Math.max(0, Math.sin((f + 2 / 3) * Math.PI * 2) * 0.65 + 0.35); }
  function fireworkTrail(x, y, z) { const p = generic(x, y - 0.3, z, (rand() - 0.5) * 0.05, -0.05, (rand() - 0.5) * 0.05, { size: 0.1, life: 4 + rnd(6), drag: 0.91, grav: 0, phys: false, bright: true }); p.spriteFn = s => 'spark_' + Math.min(7, Math.floor(s.age / s.life * 8)); }
  function firework(x, y, z, stars) {
    for (const st of stars) {
      const cols = (st.colors && st.colors.length ? st.colors : [0xffffff]);
      const n = st.shape === 'large_ball' ? 4 : 2, sp = st.shape === 'large_ball' ? 1 : 0.5;
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
        const dx = j + (rand() - rand()) * 0.5, dy = i + (rand() - rand()) * 0.5, dz = k + (rand() - rand()) * 0.5, l = Math.hypot(dx, dy, dz) / sp + rand() * 0.05;
        if (l === 0) continue;
        const c = cols[rnd(cols.length)];
        const p = generic(x, y, z, dx / l * 0.5, dy / l * 0.5, dz / l * 0.5, { size: 0.1 * 0.75, life: 48 + rnd(12), drag: 0.91, grav: 0.1, bright: true, phys: false });
        p.r = ((c >> 16) & 255) / 255; p.g = ((c >> 8) & 255) / 255; p.b = (c & 255) / 255; p.spriteFn = s => 'spark_' + Math.min(7, Math.floor(s.age / s.life * 8)); if (st.twinkle) p.alphaFn = s => (s.age > s.life / 3 && (s.age + rnd(3)) % 4 < 2) ? 0 : 1;
      }
    }
  }
  function dust(x, y, z, color, size) { const p = generic(x, y, z, 0, 0, 0, { size: 0.1 * (size || 1) * 0.75, life: Math.floor(8 / (rand() * 0.8 + 0.2)), drag: 0.96, grav: 0, phys: false }); p.r = ((color >> 16) & 255) / 255 * (rand() * 0.4 + 0.6); p.g = ((color >> 8) & 255) / 255 * (rand() * 0.4 + 0.6); p.b = (color & 255) / 255 * (rand() * 0.4 + 0.6); p.spriteFn = s => 'generic_' + Math.min(7, Math.floor(s.age / s.life * 8)); }
  function drip(x, y, z, lava) { const p = generic(x, y, z, 0, 0, 0, { sprite: 'drip', size: 0.08, life: 40 + rnd(20), grav: 0.06, drag: 0.98, bright: lava }); if (lava) { p.r = 1; p.g = 0.4; p.b = 0.1; } else { p.r = 0.2; p.g = 0.3; p.b = 1; } p.update = s => { if (s.onGround) { s.age = s.life; if (!lava) splash(s.x, s.y + 0.05, s.z, 1); } }; }
  function lavaPop(x, y, z) { const p = generic(x, y, z, (rand() - 0.5) * 0.08, rand() * 0.4 + 0.05, (rand() - 0.5) * 0.08, { sprite: 'lava', size: 0.1 * (rand() * 2 + 0.2) * 0.75, life: Math.floor(16 / (rand() * 0.8 + 0.2)), grav: 0.75, drag: 0.999, bright: true }); p.update = s => { if (rand() < s.age / s.life) smokeAt(s.x, s.y, s.z, s.vx, s.vy, s.vz); }; }
  function snow(x, y, z) { generic(x, y, z, (rand() - 0.5) * 0.02, -0.05, (rand() - 0.5) * 0.02, { sprite: 'snowflake', size: 0.06, life: 40 + rnd(40), grav: 0.05, drag: 0.98 }); }
  function cherry(x, y, z) { const p = generic(x, y, z, 0, 0, 0, { sprite: 'leaf', size: 0.08, life: 300, grav: 0.03, drag: 1 }); p.r = 1; p.g = 0.72; p.b = 0.85; p.update = s => { s.vx = Math.sin(s.age * 0.1) * 0.02; s.vz = Math.cos(s.age * 0.07) * 0.02; s.vy = Math.max(s.vy, -0.03); if (s.onGround) s.age = Math.max(s.age, s.life - 20); }; }
  // ---------------------------------------------------------------- ambient particles near the player
  function animateTick(pl) {
    if (Settings.particles === 'minimal') return;
    const bx = Math.floor(pl.x), by = Math.floor(pl.y), bz = Math.floor(pl.z);
    for (let k = 0; k < 667; k++) {
      for (const r of [16, 32]) {
        const x = bx + rnd(r) - rnd(r), y = by + rnd(r) - rnd(r), z = bz + rnd(r) - rnd(r);
        const id = World.getBlock(x, y, z); if (id === 0) continue;
        const n = BLOCKS[id].name;
        switch (BLOCKS[id].model) {
          case 'torch': case 'wall_torch': {
            let ox = x + 0.5, oy = y + 0.7, oz = z + 0.5;
            if (BLOCKS[id].model === 'wall_torch') { const f = World.getState(x, y, z) & 7; ox -= DX[f] * 0.27; oz -= DZ[f] * 0.27; oy += 0.22; }
            smokeAt(ox, oy, oz, 0, 0, 0);
            if (n.includes('redstone')) { if (!(World.getState(x, y, z) & 8)) dust(ox, oy, oz, 0xff0000); }
            else flameAt(ox, oy, oz, 0, 0, 0, n.includes('soul'));
            break;
          }
          case 'candle': case 'candle_cake': {
            const st = World.getState(x, y, z); if (!(st & 4)) break;
            // wick tops of the candle model (1-4 candles), or the one candle on a cake
            const L = BLOCKS[id].model === 'candle' ? [[[8, 8]], [[6, 8], [10, 7]], [[8, 10], [6, 7], [10, 7]], [[6, 6], [10, 6], [6, 10], [10, 10]]][st & 3] : [[8, 8]];
            const H = BLOCKS[id].model === 'candle' ? [[7], [7, 6], [7, 6, 4], [7, 6, 5, 4]][st & 3] : [15];
            L.forEach(([cx, cz], i) => { const ox = x + cx / 16, oy = y + H[i] / 16 + 0.03, oz = z + cz / 16; if (rnd(3) === 0) smokeAt(ox, oy, oz, 0, 0, 0); const f = flameAt(ox, oy, oz, 0, 0, 0, false); if (f) f.size *= 0.5; });
            if (rnd(30) === 0) Sound.play('candle_ambient', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
            break;
          }
          case 'ench': {
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 1; dy++) {
              if ((Math.abs(dx) !== 2 && Math.abs(dz) !== 2) || rnd(16) !== 0) continue;
              if (World.getBlock(x + dx, y + dy, z + dz) !== BID.bookshelf || !BLOCKS[World.getBlock(x + Math.trunc(dx / 2), y + dy, z + Math.trunc(dz / 2))].replaceable) continue;
              enchantGlyph(x + 0.5, y + 2, z + 0.5, dx + rand() - 0.5, dy - rand() - 1, dz + rand() - 0.5);
            }
            break;
          }
          case 'fire': if (rnd(24) === 0) Sound.play('fire_ambient', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); for (let i = 0; i < 3; i++) smokeAt(x + rand(), y + rand() * 0.5 + 0.5, z + rand(), 0, 0, 0, true); break;
          case 'campfire': if ((World.getState(x, y, z) & 8) === 0) { if (rnd(10) === 0) Sound.play('campfire_crackle', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); if (rnd(5) === 0) lavaPop(x + 0.5, y + 0.5, z + 0.5); } break;
          case 'portal': if (rnd(100) === 0) Sound.play('portal_ambient', null, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); for (let i = 0; i < 4; i++) { const p = generic(x + rand(), y + rand(), z + rand(), (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5, { size: 0.1 * (rand() * 0.2 + 0.5), life: 40 + rnd(10), phys: false, drag: 1, bright: true }); const f = rand() * 0.6 + 0.4; p.r = f * 0.9; p.g = f * 0.3; p.b = f; p.spriteFn = s => 'portal_' + Math.min(7, Math.floor(s.age / s.life * 8)); } break;
        }
        if (n === 'lava' && World.getBlock(x, y + 1, z) === 0 && rnd(100) === 0) { lavaPop(x + rand(), y + 1, z + rand()); Sound.play('lava_pop', null, { x: x + 0.5, y: y + 1, z: z + 0.5 }); }
        if ((n === 'water' || BLOCKS[World.getBlock(x, y, z)].fluid) && rnd(10) === 0 && World.getBlock(x, y - 1, z) === 0 && false) drip(x + rand(), y - 0.05, z + rand(), n === 'lava');
        if (SOLID[id] && World.getBlock(x, y - 1, z) === 0 && rnd(10) === 0) { const above = World.getBlock(x, y + 1, z); if (BLOCKS[above].fluid && rnd(5) === 0) drip(x + rand(), y - 0.05, z + rand(), BLOCKS[above].fluid === 'lava'); }
        if (n === 'cherry_leaves' && rnd(10) === 0 && World.getBlock(x, y - 1, z) === 0) cherry(x + rand(), y - 0.05, z + rand());
        if (n === 'end_rod' && rnd(5) === 0) { const p = generic(x + 0.5 + (rand() - 0.5) * 0.4, y + 0.5 + (rand() - 0.5) * 0.4, z + 0.5 + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.01, -0.01, (rand() - 0.5) * 0.01, { size: 0.08, life: 60 + rnd(12), grav: 0.0075, drag: 0.91, bright: true }); p.spriteFn = s => 'spark_' + Math.min(7, Math.floor(s.age / s.life * 8)); }
        if ((n === 'redstone_ore' || n === 'deepslate_redstone_ore') && World.getState(x, y, z) & 1) for (let i = 0; i < 2; i++) dust(x + rand(), y + rand(), z + rand(), 0xff0000);
        if (n === 'mycelium' && rnd(10) === 0) { const p = generic(x + rand(), y + 1.1, z + rand(), 0, 0, 0, { sprite: 'drop', size: 0.05, life: 40, grav: 0, phys: false }); p.r = 0.7; p.g = 0.6; p.b = 0.7; }
        if (n === 'spore_blossom' && rnd(3) === 0) { const p = generic(x + rand(), y - 0.1, z + rand(), 0, -0.01, 0, { sprite: 'drop', size: 0.04, life: 80, grav: 0.01, drag: 1 }); p.r = 0.32; p.g = 0.5; p.b = 0.22; }
        if (n.endsWith('_leaves') && rnd(200) === 0 && World.getBlock(x, y - 1, z) === 0 && Weather.rainingAt(x, y + 1, z)) drip(x + rand(), y - 0.05, z + rand(), false);
      }
    }
  }
  // a glyph that flies from a bookshelf into the enchanting table (the game's EnchantmentTableParticle)
  function enchantGlyph(x, y, z, dx, dy, dz) {
    const p = generic(x + dx, y + dy, z + dz, 0, 0, 0, { sprite: 'sga_' + rnd(8), size: 0.1 * (rand() * 0.5 + 0.2), life: Math.floor(rand() * 10) + 30, grav: 0, phys: false, drag: 1, bright: true });
    const f = rand() * 0.6 + 0.4; p.r = 0.9 * f * 0.9; p.g = 0.9 * f * 0.9; p.b = 0.9 * f;
    p.update = q => { const t = 1 - q.age / q.life, u = (1 - t) ** 4; q.x = x + dx * t; q.y = y + dy * t - u * 1.2; q.z = z + dz * t; };
  }
  function clear() { for (const k in SYS) SYS[k].list.length = 0; }
  const api = { enchantGlyph, tick, render, blockBreak, blockHit, itemBreak, crit, magicCrit, sweep, smoke, poof, heart, happy, boneMeal, angry, totem, portal, bubble, splash, explosion, furnace, campfireSmoke, eat, slime, potionSplash, effects, note, firework, fireworkTrail, dust, drip, lavaPop, snow, damage, flameAt, smokeAt, clear, gust: (x, y, z) => explosion(x, y, z, false), sheet };
  return new Proxy(api, { get: (t, k) => (k in t ? t[k] : () => {}) });
})();
