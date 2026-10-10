'use strict';
/* Drawing entities: mobs (box models with the game's animations, a red flash when hurt, tipping over when
   they die), dropped items (spinning and bobbing 3D items: small blocks or sprites with thickness), experience
   orbs, falling blocks, the player in third person and in the inventory, and the first-person hand with the
   held item placed by the game's item transforms (swing, equip and use animations). */

// blocks drawn as moving objects: the block shader with one light value for the whole object
const VOXE_VERT = `
in vec4 aUV; in vec4 aLight; in vec4 aColor;
uniform float uTime;
out vec3 vUV; out float vShade; out vec3 vColor; out float vDist;
void main(){
  float layer = aUV.z;
  if (aUV.w > 0.5) layer += mod(floor(uTime * 10.0), aUV.w);
  vUV = vec3(aUV.xy, layer); vShade = aLight.z; vColor = aColor.rgb;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const VOXE_FRAG = `
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uTex; uniform vec2 uEnv; uniform float uFlash; uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd;
${LIGHT_GLSL}
in vec3 vUV; in float vShade; in vec3 vColor; in float vDist;
out vec4 fragColor;
void main(){
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vColor;
  c *= lightmap(uEnv.x, uEnv.y) * vShade;
  c = mix(c, vec3(1.0), uFlash);
  float fog = clamp((vDist - uFogStart) / max(uFogEnd - uFogStart, 0.001), 0.0, 1.0);
  fragColor = vec4(mix(c, uFogColor, fog), 1.0);
}`;
function voxEntMat() {
  const u = { uEnv: { value: new THREE.Vector2(1, 0) }, uFlash: { value: 0 } };
  for (const k in U) u[k] = U[k];
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VOXE_VERT, fragmentShader: VOXE_FRAG, glslVersion: THREE.GLSL3, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- items as 3D objects
const ItemMesh = (() => {
  const cache = new Map();
  let atlasTex = null;
  function atlas() { if (!atlasTex) { atlasTex = new THREE.CanvasTexture(Icons.canvas); atlasTex.magFilter = atlasTex.minFilter = THREE.NearestFilter; atlasTex.generateMipmaps = false; atlasTex.flipY = false; } return atlasTex; }
  // a block from the block mesher (0..1 cube)
  function blockGeo(id, st, conn) {
    const bufs = Mesher.meshSingle(id, st, conn);
    const geos = [];
    for (let L = 0; L < 3; L++) {
      const b = bufs[L]; if (!b.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.p.slice(0, b.n * 3), 3));
      g.setAttribute('aUV', new THREE.BufferAttribute(b.uv.slice(0, b.n * 4), 4));
      g.setAttribute('aLight', new THREE.BufferAttribute(b.li.slice(0, b.n * 4), 4, true));
      g.setAttribute('aColor', new THREE.BufferAttribute(b.co.slice(0, b.n * 4), 4, true));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(b.ix.subarray(0, b.ni)), 1));
      geos.push(g);
    }
    if (!geos.length) return null;
    if (geos.length === 1) return geos[0];
    // merge the layers into one geometry
    const out = new THREE.BufferGeometry(), names = ['position', 'aUV', 'aLight', 'aColor'];
    for (const n of names) { const parts = geos.map(g => g.getAttribute(n)); const sz = parts[0].itemSize, total = parts.reduce((a, p) => a + p.count, 0); const arr = new parts[0].array.constructor(total * sz); let o = 0; for (const p of parts) { arr.set(p.array, o); o += p.array.length; } out.setAttribute(n, new THREE.BufferAttribute(arr, sz, n === 'aLight' || n === 'aColor')); }
    const idx = []; let base = 0; for (const g of geos) { for (const i of g.index.array) idx.push(i + base); base += g.getAttribute('position').count; }
    out.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    return out;
  }
  // a sprite with one pixel of thickness: front and back, plus an edge face wherever a pixel meets transparency
  function spriteGeo(itemId) {
    const it = ITEMS[itemId], px = Icons.spriteFor(it);
    const i = Icons.index[itemId], C = Icons.CELL, COLS = 42, SIZE = C * COLS;
    const cu = (i % COLS) * C, cv = Math.floor(i / COLS) * C;
    return spriteGeoPx(px, cu / SIZE, cv / SIZE, C / SIZE);
  }
  // the game's extruded item model: a front and back, plus an edge around every opaque pixel
  function spriteGeoPx(px, U0, V0, D) {
    const pos = [], uv = [], nor = [], idx = [];
    const z0 = 7.5 / 16, z1 = 8.5 / 16;
    const quad = (p, u, n) => { const s = pos.length / 3; for (let k = 0; k < 4; k++) { pos.push(...p[k]); uv.push(...u[k]); nor.push(...n); } idx.push(s, s + 1, s + 2, s, s + 2, s + 3); };
    // front (+z) and back (-z)
    quad([[0, 0, z1], [1, 0, z1], [1, 1, z1], [0, 1, z1]], [[U0, V0 + D], [U0 + D, V0 + D], [U0 + D, V0], [U0, V0]], [0, 0, 1]);
    quad([[1, 0, z0], [0, 0, z0], [0, 1, z0], [1, 1, z0]], [[U0 + D, V0 + D], [U0, V0 + D], [U0, V0], [U0 + D, V0]], [0, 0, -1]);
    const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && px && px[(y * 16 + x) * 4 + 3] > 10;
    const pu = (x, y) => [U0 + (x + 0.5) / 16 * D, V0 + (y + 0.5) / 16 * D];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!solid(x, y)) continue;
      const X0 = x / 16, X1 = (x + 1) / 16, Y1 = 1 - y / 16, Y0 = 1 - (y + 1) / 16, t = pu(x, y), T = [t, t, t, t];
      if (!solid(x - 1, y)) quad([[X0, Y0, z0], [X0, Y0, z1], [X0, Y1, z1], [X0, Y1, z0]], T, [-1, 0, 0]);
      if (!solid(x + 1, y)) quad([[X1, Y0, z1], [X1, Y0, z0], [X1, Y1, z0], [X1, Y1, z1]], T, [1, 0, 0]);
      if (!solid(x, y - 1)) quad([[X0, Y1, z1], [X1, Y1, z1], [X1, Y1, z0], [X0, Y1, z0]], T, [0, 1, 0]);
      if (!solid(x, y + 1)) quad([[X0, Y0, z0], [X1, Y0, z0], [X1, Y0, z1], [X0, Y0, z1]], T, [0, -1, 0]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }
  // { geo, block: true when drawn as a 3D block }
  function get(itemId) {
    let r = cache.get(itemId); if (r) return r;
    const it = ITEMS[itemId];
    const flat = !!Icons.spriteFor(it);
    if (!flat && it.block >= 0) { const d = BLOCKS[it.block]; r = { geo: blockGeo(it.block, d.model === 'stairs' ? 3 : d.model === 'chest' ? 3 : 0), block: true }; if (!r.geo) r = { geo: spriteGeo(itemId), block: false }; }
    else r = { geo: spriteGeo(itemId), block: false };
    r.handheld = !!(it.tool || ['stick', 'bone', 'blaze_rod', 'breeze_rod', 'fishing_rod', 'carrot_on_a_stick', 'warped_fungus_on_a_stick', 'trident', 'mace', 'bamboo'].includes(it.name));
    cache.set(itemId, r);
    return r;
  }
  // a held stack's own look: a shield carrying a banner gets a sprite of its own
  const custom = new Map();
  const key = s => !s ? -1 : (s.tag && s.tag.banner && ITEMS[s.id].name === 'shield' ? s.id + '|' + JSON.stringify(s.tag.banner) : ITEMS[s.id].name.endsWith('_banner') ? s.id + '|' + JSON.stringify((s.tag && s.tag.patterns) || []) : s.id);
  function meshFor(s) {
    if (s && s.tag && s.tag.banner && ITEMS[s.id].name === 'shield' && typeof Banners !== 'undefined') {
      const k = key(s); let c = custom.get(k);
      if (!c) {
        const px = Banners.shieldPixels(s), cv = document.createElement('canvas'); cv.width = cv.height = 16;
        cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), 16, 16), 0, 0);
        const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.flipY = false; tex.generateMipmaps = false;
        c = { geo: spriteGeoPx(px, 0, 0, 1), tex }; custom.set(k, c);
      }
      const m = new THREE.Mesh(c.geo, entityMat(c.tex, { side: THREE.DoubleSide })); m.frustumCulled = false; m.userData.block = false; m.userData.handheld = false;
      return m;
    }
    // a banner in the hand is the whole banner: the pole and crossbar of its block, and its flag
    if (s && ITEMS[s.id].name.endsWith('_banner') && typeof Banners !== 'undefined') {
      const m = mesh(s.id);
      const tex = new THREE.CanvasTexture(Banners.flagCanvas(ITEMS[s.id].name.replace('_banner', ''), (s.tag && s.tag.patterns) || [])); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      const W = 20 / 24, H = 40 / 24, D = 1 / 24, mat = entityMat(tex, {});
      const flag = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat); flag.frustumCulled = false;
      flag.position.set(0.5 - 1 / 16 - D / 2, 1.8333 - H / 2, 0.5); flag.rotation.y = Math.PI / 2;
      m.add(flag);
      return m;
    }
    return mesh(s.id);
  }
  function mesh(itemId, glint) {
    const r = get(itemId);
    const mat = r.block ? voxEntMat() : entityMat(atlas(), { side: THREE.DoubleSide });
    const m = new THREE.Mesh(r.geo, mat); m.frustumCulled = false; m.userData.block = r.block; m.userData.handheld = r.handheld;
    return m;
  }
  function blockMesh(id, st, conn) { const key = 'b' + id + ':' + st + (conn ? ':' + conn : ''); let g = cache.get(key); if (!g) { g = blockGeo(id, st, conn); cache.set(key, g); } if (!g) return null; const m = new THREE.Mesh(g, voxEntMat()); m.frustumCulled = false; return m; }
  return { get, mesh, meshFor, key, blockMesh, atlas };
})();

// the game's display transforms for item models: [rotation degrees], [translation sixteenths], scale
const ItemTransforms = {
  generated: { ground: [[0, 0, 0], [0, 2, 0], 0.5], fp: [[0, -90, 25], [1.13, 3.2, 1.13], 0.68], tp: [[0, 0, 0], [0, 3, 1], 0.55], fixed: [[0, 180, 0], [0, 0, 0], 1] },
  handheld: { ground: [[0, 0, 0], [0, 2, 0], 0.5], fp: [[0, -90, 25], [1.13, 3.2, 1.13], 0.68], tp: [[0, -90, 55], [0, 4, 0.5], 0.85], fixed: [[0, 180, 0], [0, 0, 0], 1] },
  block: { ground: [[0, 0, 0], [0, 3, 0], 0.25], fp: [[0, 45, 0], [0, 0, 0], 0.4], tp: [[75, 45, 0], [0, 2.5, 0], 0.375], fixed: [[0, 0, 0], [0, 0, 0], 0.5] },
};
const DEG = Math.PI / 180;
// apply a display transform then centre the 0..1 model, onto matrix m (left hand mirrors x)
function applyItemTransform(m, kind, ctx, left) {
  const t = ItemTransforms[kind][ctx]; const [r, tr, s] = t;
  const tmp = new THREE.Matrix4();
  m.multiply(tmp.makeTranslation((left ? -tr[0] : tr[0]) / 16, tr[1] / 16, tr[2] / 16));
  m.multiply(tmp.makeRotationFromEuler(new THREE.Euler(r[0] * DEG, (left ? -r[1] : r[1]) * DEG, (left ? -r[2] : r[2]) * DEG, 'XYZ')));
  m.multiply(tmp.makeScale(s, s, s));
  m.multiply(tmp.makeTranslation(-0.5, -0.5, -0.5));
  return m;
}
const MStack = {
  t(m, x, y, z) { return m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)); },
  rx(m, d) { return m.multiply(new THREE.Matrix4().makeRotationX(d * DEG)); },
  ry(m, d) { return m.multiply(new THREE.Matrix4().makeRotationY(d * DEG)); },
  rz(m, d) { return m.multiply(new THREE.Matrix4().makeRotationZ(d * DEG)); },
  s(m, k) { return m.multiply(new THREE.Matrix4().makeScale(k, k, k)); },
};

EntityRender = (() => {
  const vis = new Map();      // entity -> visual
  const factories = {};       // type -> (entity) => visual
  const tmpV = new THREE.Vector3();
  function lightAt(x, y, z) { const l = World.getLight(Math.floor(x), Math.floor(y), Math.floor(z)); return [(l >> 4) / 15, (l & 15) / 15]; }
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => a + angleDiff(b, a) * t;
  // ---------------------------------------------------------------- visuals
  class MobVisual {
    constructor(e, name) {
      this.e = e; this.name = name;
      const d = EntityModels.DEFS[name];
      this.mat = entityMat(EntityModels.texture(name), { side: THREE.DoubleSide });
      const anyT = d.parts.some(function t(p) { return p.t || p.c.some(t); });
      this.matT = anyT ? entityMat(EntityModels.texture(name), { transparent: true, side: THREE.DoubleSide }) : null;
      this.inst = EntityModels.create(name, this.mat, this.matT);
      this.obj = new THREE.Group(); this.obj.add(this.inst.root);
      this.layers = [];
      if (e.layers) for (const L of e.layers()) this.addLayer(L);
      this.held = null; this.heldKey = -1; this.heldOff = null; this.offKey = -1;
      scene.add(this.obj);
    }
    // a second model drawn over the first (sheep wool, saddles, armour...)
    addLayer(L) {
      const mat = entityMat(EntityModels.texture(L.model), { side: THREE.DoubleSide, transparent: !!L.transparent });
      const inst = EntityModels.create(L.model, mat, mat);
      this.obj.add(inst.root); this.layers.push({ L, inst, mat });
    }
    update(a, s) {
      const e = this.e, d = this.inst.def;
      const x = lerp(e.px, e.x, a), y = lerp(e.py, e.y, a), z = lerp(e.pz, e.z, a);
      this.obj.position.set(x, y + (e.renderYOffset || 0), z);
      const by = lerpAng(e.pbodyYaw !== undefined ? e.pbodyYaw : e.pyaw, e.bodyYaw !== undefined ? e.bodyYaw : e.yaw, a);
      // converting (or frozen solid): the game's shiver of the body
      const shake = e.isShaking && e.isShaking() ? Math.cos(Math.floor(e.age || 0) * 3.25) * Math.PI * 0.4 * Math.PI / 180 : 0;
      this.obj.rotation.set(0, by + shake, 0);
      let k = (d.scale || 1) * (e.scale || 1) * (e.baby ? 0.5 : 1);
      this.inst.root.scale.setScalar(k);
      // dying: tip over onto the side over a second
      if (e.dead && e.deathTime > 0) { let f = Math.sqrt(Math.max(0, (e.deathTime + a - 1) / 20 * 1.6)); if (f > 1) f = 1; this.inst.root.rotation.z = f * Math.PI / 2; } else this.inst.root.rotation.z = 0;
      // gliding, swimming and crawling lay the body down
      const tl = e.tilt ? e.tilt(a) : null;
      this.inst.root.rotation.x = tl ? tl[0] : 0; this.inst.root.rotation.y = tl ? tl[1] : 0; this.inst.root.position.set(0, tl ? tl[2] : 0, tl ? tl[3] : 0);
      // named Dinnerbone or Grumm: upside down
      if (e.customName === 'Dinnerbone' || e.customName === 'Grumm') { this.inst.root.rotation.z += Math.PI; this.inst.root.position.y += (e.h || 1) + 0.1; }
      const [sl, bl] = lightAt(x, y + e.h * 0.85, z);
      const flash = (e.hurtTime > 0 || (e.dead && e.deathTime > 0)) ? 1 : 0;
      // a tint (a creeper's flashing, a wet wolf) goes back to white when it ends
      const tn = e.tint;
      for (const m of [this.mat, this.matT].concat(this.layers.map(l => l.mat))) if (m) { m.uniforms.uEnv.value.set(e.glow ? 1 : sl, e.glow ? 1 : bl); m.uniforms.uFlash.value = flash; if (m === this.mat && (tn || this.tinted)) m.uniforms.uTint.value.setRGB(tn ? tn[0] : 1, tn ? tn[1] : 1, tn ? tn[2] : 1); }
      this.tinted = !!tn;
      // glowing layers (the warden's spots and heart) ignore the light
      for (const l of this.layers) if (l.L.glow) l.mat.uniforms.uEnv.value.set(1, 1);
      this.anim(this.inst, s);
      if (e.baby && d.babyHead) { const h = this.inst.parts.head; if (h) { h.sx = h.sy = h.sz = 1.5; h.y -= d.babyHead / 1.5 * 0; } }
      if (e.posePart) e.posePart(this.inst, s, a);
      this.inst.apply();
      for (const l of this.layers) {
        l.inst.root.scale.setScalar(k * (l.L.scale || 1)); l.inst.root.rotation.copy(this.inst.root.rotation); l.inst.root.position.copy(this.inst.root.position);
        const show = !l.L.when || l.L.when(e); l.inst.root.visible = show;
        if (show) { if (l.L.color) { const c = l.L.color(e); l.mat.uniforms.uTint.value.setRGB(c[0], c[1], c[2]); } this.anim(l.inst, s); if (e.posePart) e.posePart(l.inst, s, a); if (e.baby && d.babyHead && l.inst.parts.head) { const h = l.inst.parts.head; h.sx = h.sy = h.sz = 1.5; } l.inst.apply(); }
      }
      this.updateHeld(a, s, sl, bl);
      this.updateArmor(a, s, k, sl, bl);
    }
    // worn armour: the game's armour layers (helmet, chestplate and boots on one model blown up by 1, leggings
    // on one blown up by 0.5), following the wearer's limbs
    updateArmor(a, s, k, sl, bl) {
      const e = this.e, P = this.inst.parts;
      if (!P.head || !P.body || !P.right_leg || !P.right_arm) return;
      const items = e.isPlayer ? [0, 1, 2, 3].map(i => e.inv.armor(i)) : e.equip ? [e.equip.head, e.equip.chest, e.equip.legs, e.equip.feet] : null;
      if (!items) return;
      const key = items.map(x => x ? x.id + ':' + ((x.tag && x.tag.color) || '') : '').join('|');
      if (key !== this.armorKey) {
        for (const l of this.armor || []) { this.obj.remove(l.inst.root); l.mat.dispose(); }
        this.armor = []; this.armorKey = key;
        const SHOW = [['head', 'hat'], ['body', 'right_arm', 'left_arm'], ['body', 'right_leg', 'left_leg'], ['right_leg', 'left_leg']];
        items.forEach((x, i) => {
          // an elytra on the back: two wings
          if (x && ITEMS[x.id].name === 'elytra') { const mat = entityMat(EntityModels.texture('elytra'), { side: THREE.DoubleSide, transparent: true }); const inst = EntityModels.create('elytra', mat, mat); this.obj.add(inst.root); this.armor.push({ inst, mat, elytra: true }); return; }
          const ar = x && ITEMS[x.id].armor; if (!ar) return;
          const name = (i === 2 ? 'armor2_' : 'armor1_') + ar.mat; if (!EntityModels.DEFS[name]) return;
          const mat = entityMat(EntityModels.texture(name), { side: THREE.DoubleSide, transparent: true });
          const inst = EntityModels.create(name, mat, mat);
          this.obj.add(inst.root);
          const col = ar.mat === 'leather' ? ((x.tag && x.tag.color) || 0xa06540) : null;
          this.armor.push({ inst, mat, show: new Set(SHOW[i]), col });
        });
      }
      for (const l of this.armor) {
        if (l.elytra) { l.inst.root.scale.setScalar(k); l.inst.root.rotation.copy(this.inst.root.rotation); l.inst.root.position.copy(this.inst.root.position); l.inst.reset(); EntityModels.A.elytra(l.inst, s); l.inst.apply(); l.mat.uniforms.uEnv.value.set(sl, bl); l.mat.uniforms.uFlash.value = this.mat.uniforms.uFlash.value; continue; }
        l.inst.root.scale.setScalar(k); l.inst.root.rotation.copy(this.inst.root.rotation); l.inst.root.position.copy(this.inst.root.position);
        this.anim(l.inst, s); if (e.posePart) e.posePart(l.inst, s, a);
        for (const p of l.inst.list) p.show = l.show.has(p.name);
        if (e.type === 'armor_stand' && l.inst.parts.head) l.inst.parts.head.y += 1;
        l.inst.apply();
        l.mat.uniforms.uEnv.value.set(sl, bl); l.mat.uniforms.uFlash.value = this.mat.uniforms.uFlash.value;
        if (l.col !== null) l.mat.uniforms.uTint.value.setRGB(((l.col >> 16) & 255) / 255, ((l.col >> 8) & 255) / 255, (l.col & 255) / 255);
      }
    }
    anim(inst, s) { inst.reset(); const fn = EntityModels.A[this.e.anim || inst.def.anim]; if (fn) fn(inst, s); }
    // a tool, weapon or block in the mob's right hand
    updateHeld(a, s, sl, bl) {
      const e = this.e, h = e.heldItem ? e.heldItem() : null;
      // the off hand: a player's slot 40, a mob's off-hand equipment
      const o = e.isPlayer || (e.inv && e.inv.offhand !== undefined) ? (e.inv ? e.inv.offhand : null) : e.equip ? e.equip.off : null;
      this.heldKey = this.hand('held', 'heldKey', 'right_arm', h, false, sl, bl);
      this.offKey = this.hand('heldOff', 'offKey', 'left_arm', o, true, sl, bl);
    }
    // one hand's item, held the game's third person way (ItemInHandLayer): in the arm's frame (the model space
    // is flipped in x and y) rotate down, then out to the hand at the end of the arm; the left hand mirrors it
    hand(slot, keySlot, armName, st, left, sl, bl) {
      const k = ItemMesh.key(st);
      if (k !== this[keySlot]) {
        if (this[slot]) { this[slot].parent && this[slot].parent.remove(this[slot]); this[slot].material.dispose(); this[slot] = null; }
        const arm = this.inst.parts[armName];
        if (st && arm) { this[slot] = ItemMesh.meshFor(st); this[slot].matrixAutoUpdate = false; arm.g.add(this[slot]); }
      }
      const it = this[slot];
      if (it) {
        const r = ItemMesh.get(st.id), kind = r.block ? 'block' : r.handheld ? 'handheld' : 'generated';
        const m = new THREE.Matrix4().makeScale(-1, -1, 1);
        MStack.rx(m, -90); MStack.ry(m, 180);
        MStack.t(m, (left ? -1 : 1) / 16, 0.125, -0.625);
        applyItemTransform(m, kind, 'tp', left);
        it.matrix.copy(m);
        it.material.uniforms.uEnv.value.set(sl, bl);
        for (const ch of it.children) if (ch.material && ch.material.uniforms && ch.material.uniforms.uEnv) ch.material.uniforms.uEnv.value.set(sl, bl);
      }
      return k;
    }
    dispose() { scene.remove(this.obj); this.mat.dispose(); if (this.matT) this.matT.dispose(); for (const l of this.layers) l.mat.dispose(); for (const l of this.armor || []) l.mat.dispose(); if (this.held) this.held.material.dispose(); }
  }
  class ItemVisual {
    constructor(e) {
      this.e = e; this.obj = new THREE.Group(); this.id = -1; this.copies = 0; scene.add(this.obj);
    }
    build() {
      const s = this.e.stack; this.id = s.id;
      while (this.obj.children.length) { const c = this.obj.children.pop(); c.material.dispose(); }
      const n = s.count > 48 ? 5 : s.count > 32 ? 4 : s.count > 16 ? 3 : s.count > 1 ? 2 : 1;
      this.copies = n;
      for (let i = 0; i < n; i++) { const m = ItemMesh.mesh(s.id); m.matrixAutoUpdate = false; this.obj.add(m); }
    }
    update(a) {
      const e = this.e, s = e.stack;
      const n = s.count > 48 ? 5 : s.count > 32 ? 4 : s.count > 16 ? 3 : s.count > 1 ? 2 : 1;
      if (s.id !== this.id || n !== this.copies) this.build();
      const t = e.age + a;
      const bob = Math.sin(t / 10 + e.bobOffset) * 0.1 + 0.1;
      this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a) + bob, lerp(e.pz, e.z, a));
      this.obj.rotation.set(0, t / 20 + e.bobOffset, 0);
      const r = ItemMesh.get(this.id), kind = r.block ? 'block' : r.handheld ? 'handheld' : 'generated';
      const [sl, bl] = lightAt(e.x, e.y + 0.2, e.z);
      // several copies, scattered a little (blocks) or stacked (flat items), like the game
      const rnd = new Rand(this.id * 31 + 7);
      this.obj.children.forEach((m, i) => {
        const M = new THREE.Matrix4();
        if (i > 0) { if (r.block) MStack.t(M, (rnd.next() * 2 - 1) * 0.15, (rnd.next() * 2 - 1) * 0.15, (rnd.next() * 2 - 1) * 0.15); else MStack.t(M, (rnd.next() * 2 - 1) * 0.15 * 0.5, (rnd.next() * 2 - 1) * 0.15 * 0.5, -0.09375 * i); }
        applyItemTransform(M, kind, 'ground', false);
        m.matrix.copy(M); m.material.uniforms.uEnv.value.set(sl, bl);
      });
    }
    dispose() { scene.remove(this.obj); for (const c of this.obj.children) c.material.dispose(); }
  }
  // experience orbs: a small glowing sprite whose colour pulses between green and yellow
  const orbTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d');
    for (let k = 0; k < 4; k++) { const r = 2 + k; const ox = k * 16 + 8, oy = 8; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d > r + 0.3) continue; g.fillStyle = d > r - 1 ? '#3a6a00' : d < r * 0.4 ? '#ffffa0' : '#c8f000'; g.fillRect(ox + x, oy + y, 1, 1); } }
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
  })();
  class OrbVisual {
    constructor(e) {
      this.e = e; const k = e.value >= 37 ? 3 : e.value >= 7 ? 2 : e.value >= 3 ? 1 : 0;
      const tex = orbTex.clone(); tex.needsUpdate = true; tex.repeat.set(0.25, 1); tex.offset.set(k * 0.25, 0);
      this.mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      this.obj = new THREE.Sprite(this.mat); this.obj.scale.setScalar(0.3 + k * 0.05); scene.add(this.obj);
    }
    update(a) {
      const e = this.e; this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a) + 0.15, lerp(e.pz, e.z, a));
      const t = (e.age + a) / 2, r = (Math.sin(t) + 1) * 0.5;
      this.mat.color.setRGB(r * 0.6 + 0.4, 1, 0.1);
    }
    dispose() { scene.remove(this.obj); this.mat.dispose(); }
  }
  class BlockVisual { // falling blocks, primed TNT and blocks carried by endermen
    constructor(e) { this.e = e; this.obj = ItemMesh.blockMesh(e.blockId, e.blockState || 0) || new THREE.Group(); scene.add(this.obj); }
    update(a) {
      const e = this.e; this.obj.position.set(lerp(e.px, e.x, a) - 0.5, lerp(e.py, e.y, a), lerp(e.pz, e.z, a) - 0.5);
      if (this.obj.material) { const [sl, bl] = lightAt(e.x, e.y + 0.5, e.z); this.obj.material.uniforms.uEnv.value.set(sl, bl); this.obj.material.uniforms.uFlash.value = e.flash ? e.flash(a) : 0; }
      if (e.renderScale) { const k = e.renderScale(a); this.obj.scale.setScalar(k); this.obj.position.x += (1 - k) / 2; this.obj.position.z += (1 - k) / 2; }
    }
    dispose() { scene.remove(this.obj); if (this.obj.material) this.obj.material.dispose(); }
  }
  class BoxVisual { // anything without a model yet: a plain box of its size
    constructor(e) { this.e = e; this.mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }); this.obj = new THREE.Mesh(new THREE.BoxGeometry(e.w, e.h, e.w), this.mat); scene.add(this.obj); }
    update(a) { const e = this.e; this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a) + e.h / 2, lerp(e.pz, e.z, a)); }
    dispose() { scene.remove(this.obj); this.obj.geometry.dispose(); this.mat.dispose(); }
  }
  class ArrowVisual {
    constructor(e) { this.e = e; this.mat = entityMat(EntityModels.texture('arrow'), { side: THREE.DoubleSide }); this.inst = EntityModels.create('arrow', this.mat); this.inst.body.position.y = 0; this.inst.apply(); this.obj = this.inst.root; scene.add(this.obj); }
    update(a) {
      const e = this.e; this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a), lerp(e.pz, e.z, a));
      const sh = e.shake > 0 ? -Math.sin((e.shake - a) * 3) * (e.shake - a) * 0.05 : 0;
      this.obj.rotation.set(-lerp(e.ppitch, e.pitch, a) + sh, lerpAng(e.pyaw, e.yaw, a), 0, 'YXZ');
      const [sl, bl] = lightAt(e.x, e.y, e.z); this.mat.uniforms.uEnv.value.set(sl, bl);
    }
    dispose() { scene.remove(this.obj); this.mat.dispose(); }
  }
  // thrown things are drawn as their item, always facing the camera
  class SpriteVisual {
    constructor(e, itemId) {
      this.e = e; const i = Icons.index[itemId], C = Icons.CELL, COLS = 42, N = C * COLS;
      const t = ItemMesh.atlas().clone(); t.needsUpdate = true; t.flipY = false; t.repeat.set(C / N, C / N); t.offset.set((i % COLS) * C / N, Math.floor(i / COLS) * C / N);
      this.mat = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.1 }); this.obj = new THREE.Sprite(this.mat); this.obj.scale.setScalar(e.type === 'firework_rocket' ? 0.4 : 0.5); scene.add(this.obj);
    }
    update(a) { const e = this.e; this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a) + 0.125, lerp(e.pz, e.z, a)); const [sl, bl] = lightAt(e.x, e.y, e.z); const v = Math.max(sl * U.uSkyLight.value, bl) * 0.8 + 0.2; this.mat.color.setRGB(v, v, v); }
    dispose() { scene.remove(this.obj); this.mat.map.dispose(); this.mat.dispose(); }
  }
  class TridentVisual {
    constructor(e) { this.e = e; this.obj = new THREE.Group(); this.m = ItemMesh.mesh(IID.trident); this.m.matrixAutoUpdate = false; const M = new THREE.Matrix4(); MStack.ry(M, 0); MStack.rz(M, 45); MStack.t(M, -0.5, -0.5, 0); this.m.matrix.copy(new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI * 3 / 4)).multiply(new THREE.Matrix4().makeScale(1.5, 1.5, 1.5)).multiply(new THREE.Matrix4().makeTranslation(-0.5, -0.5, -0.5))); this.obj.add(this.m); scene.add(this.obj); }
    update(a) { const e = this.e; this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a), lerp(e.pz, e.z, a)); this.obj.rotation.set(-lerp(e.ppitch, e.pitch, a), lerpAng(e.pyaw, e.yaw, a), 0, 'YXZ'); const [sl, bl] = lightAt(e.x, e.y, e.z); this.m.material.uniforms.uEnv.value.set(sl, bl); }
    dispose() { scene.remove(this.obj); this.m.material.dispose(); }
  }
  // end crystals: a pink core inside two turning glass frames, over a bedrock base (EndCrystalRenderer)
  const crystalTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); return { glass: (() => { g.clearRect(0, 0, 16, 16); g.strokeStyle = 'rgba(220,200,255,0.9)'; g.lineWidth = 2; g.strokeRect(1, 1, 14, 14); g.fillStyle = 'rgba(200,170,255,0.18)'; g.fillRect(2, 2, 12, 12); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; })() }; })();
  class CrystalVisual {
    constructor(e) {
      this.e = e; this.obj = new THREE.Group(); scene.add(this.obj);
      this.glassMat = new THREE.MeshBasicMaterial({ map: crystalTex.glass, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      this.coreMat = new THREE.MeshBasicMaterial({ color: 0xe07cff });
      this.outer = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.875, 0.875), this.glassMat);
      this.inner = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.76, 0.76), this.glassMat);
      this.core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.coreMat);
      this.outer.add(this.inner); this.inner.add(this.core); this.obj.add(this.outer);
      if (e.showBottom) { this.baseMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a }); this.base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.25, 0.75), this.baseMat); this.base.position.y = 0.125; this.obj.add(this.base); }
    }
    update(a) {
      const e = this.e, t = e.time + a;
      this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a), lerp(e.pz, e.z, a));
      const bob = Math.sin(t * 0.2) / 2 + 0.5, y = (bob * bob + bob) * 0.4 - 1.4 + 2.2;
      this.outer.position.y = y * 0.5 + 0.2; this.outer.rotation.set(0.6, t * 3 * Math.PI / 180 * 3, 0.6);
      this.inner.rotation.set(0.6 * Math.sin(t * 0.05), t * 0.06, 0.6); this.core.rotation.set(t * 0.04, t * 0.07, 0);
    }
    dispose() { scene.remove(this.obj); this.glassMat.dispose(); this.coreMat.dispose(); if (this.baseMat) this.baseMat.dispose(); for (const m of [this.outer, this.inner, this.core, this.base]) if (m) m.geometry.dispose(); }
  }
  // dragon fireballs: a purple glowing ball
  class GlowVisual {
    constructor(e, color, size) { this.e = e; this.mat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }); this.obj = new THREE.Sprite(this.mat); this.obj.scale.setScalar(size); scene.add(this.obj); }
    update(a) { const e = this.e; this.obj.position.set(lerp(e.px, e.x, a), lerp(e.py, e.y, a), lerp(e.pz, e.z, a)); }
    dispose() { scene.remove(this.obj); this.mat.dispose(); }
  }
  const NONE = { update() {}, dispose() {} };
  factories.end_crystal = e => new CrystalVisual(e);
  factories.dragon_fireball = e => new GlowVisual(e, 0xb040ff, 1.2);
  factories.area_effect_cloud = () => NONE;
  factories.arrow = e => new ArrowVisual(e);
  factories.lightning_bolt = () => ({ update() {}, dispose() {} });
  factories.trident = e => new TridentVisual(e);
  factories.shulker_bullet = e => new SpriteVisual(e, IID.shulker_shell); factories.llama_spit = e => new SpriteVisual(e, IID.snowball);
  for (const k of ['snowball', 'egg', 'ender_pearl', 'splash_potion', 'lingering_potion', 'experience_bottle', 'wind_charge', 'eye_of_ender', 'firework_rocket', 'fireball', 'small_fireball', 'dragon_fireball']) factories[k] = e => new SpriteVisual(e, e.item !== undefined ? e.item : IID[k] !== undefined ? IID[k] : IID.fire_charge);
  function make(e) {
    if (factories[e.type]) return factories[e.type](e);
    if (e.type === 'item') return new ItemVisual(e);
    if (e.type === 'xp_orb') return new OrbVisual(e);
    if (e.blockId !== undefined) return new BlockVisual(e);
    const model = e.model || e.type;
    if (EntityModels.DEFS[model]) return new MobVisual(e, model);
    return new BoxVisual(e);
  }
  // the animation state the models read
  function animState(e, a) {
    const s = {
      ls: (e.limbSwing || 0) - (e.limbAmount || 0) * (1 - a), la: Math.min(1, lerp(e.plimbAmount || 0, e.limbAmount || 0, a)),
      t: (e.age || 0) + a, headYaw: -angleDiff(lerpAng(e.pheadYaw !== undefined ? e.pheadYaw : e.pyaw, e.headYaw !== undefined ? e.headYaw : e.yaw, a), lerpAng(e.pbodyYaw !== undefined ? e.pbodyYaw : e.pyaw, e.bodyYaw !== undefined ? e.bodyYaw : e.yaw, a)),
      pitch: lerp(e.ppitch || 0, e.pitch || 0, a), swing: e.swinging ? Math.max(0, (e.swingTime + a) / 6) : 0, crouch: e.pose ? e.pose === 'crouch' : !!e.sneaking && !e.flying, gliding: !!e.gliding && (e.glideTicks || 0) > 4, swim: e.swimAmount ? lerp(e.pswimAmount || 0, e.swimAmount, a) : 0, swimVisual: e.pose === 'swim', riding: !!e.vehicle,
      aggressive: !!e.aggressive, e,
    };
    if (e.dead) s.la = 0;
    if (e.animState) e.animState(s, a);
    return s;
  }
  // what the camera can see this frame
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4(), sphere = new THREE.Sphere();
  function update(a) {
    const p = Game.player, R = (Settings.renderDist * 16) ** 2;
    const seen = new Set();
    camera.updateMatrixWorld(); projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projView);
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (const e of Entities.list) {
      if (e.removed || e.invisible) continue;
      const d2 = (e.x - cx) ** 2 + (e.y - cy) ** 2 + (e.z - cz) ** 2;
      if (d2 > R) continue;
      let v = vis.get(e);
      // a villager that takes a profession changes its clothes (a different model texture)
      if (v && e.model && v.name && v.name !== e.model) { v.dispose(); v = null; }
      if (!v) { v = make(e); vis.set(e, v); }
      seen.add(e);
      // the game's render distance for entities: 64 blocks times the size of the box (at least 24), and only
      // what is in view is posed and drawn
      const w = e.w || 0.5, h = e.h || 0.5, far = Math.max(24, (w + h + w) / 3 * 64);
      sphere.center.set(e.x, e.y + h / 2, e.z); sphere.radius = Math.max(w, h) + 1.5;
      const show = d2 <= far * far && frustum.intersectsSphere(sphere);
      if (v.obj) v.obj.visible = show;
      if (!show) continue;
      v.update(a, animState(e, a));
    }
    // the player, when the camera is behind or in front
    if (p && p.view !== 0 && !p.spectator) {
      let v = vis.get(p); if (!v) { v = new MobVisual(p, 'player'); vis.set(p, v); }
      seen.add(p); v.update(a, animState(p, a));
    }
    for (const [e, v] of vis) if (!seen.has(e)) { v.dispose(); vis.delete(e); }
    for (let i = pickups.length - 1; i >= 0; i--) { const k = pickups[i]; if (!k.step(a)) { k.dispose(); pickups.splice(i, 1); } }
  }
  // an item flying into the player when picked up (three ticks)
  const pickups = [];
  function pickup(e, p) {
    const v = new ItemVisual({ stack: Object.assign({}, e.stack), age: e.age, bobOffset: e.bobOffset, x: e.x, y: e.y, z: e.z, px: e.x, py: e.y, pz: e.z });
    const start = performance.now(), sx = e.x, sy = e.y, sz = e.z;
    v.step = () => { const t = (performance.now() - start) / 150; if (t >= 1) return false; const f = t * t; v.e.x = v.e.px = sx + (p.x - sx) * f; v.e.y = v.e.py = sy + (p.y + 0.5 - sy) * f; v.e.z = v.e.pz = sz + (p.z - sz) * f; v.update(0); return true; };
    pickups.push(v);
  }
  function clear() { for (const [, v] of vis) v.dispose(); vis.clear(); for (const k of pickups) k.dispose(); pickups.length = 0; }
  // the little player in the inventory screen, drawn by a second renderer
  let pr = null, pScene = null, pCam = null, pVis = null;
  function drawPlayerPreview(el) {
    const p = Game.player; if (!p) return;
    if (!pr) {
      const c = document.createElement('canvas');
      pr = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: false }); pr.setPixelRatio(1);
      pScene = new THREE.Scene(); pCam = new THREE.PerspectiveCamera(30, 49 / 70, 0.1, 20);
      pVis = new MobVisual({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, h: 1.8, yaw: 0, pyaw: 0, bodyYaw: 0, pbodyYaw: 0, age: 0 }, 'player');
      scene.remove(pVis.obj); pScene.add(pVis.obj);
    }
    if (pr.domElement.parentNode !== el) { el.innerHTML = ''; el.appendChild(pr.domElement); }
    const w = el.clientWidth || 98, h = el.clientHeight || 140;
    pr.setSize(w, h, false);
    // the player looks toward the mouse, like the game's renderEntityInInventoryFollowsMouse: from the middle of
    // the box, atan(distance / 40 GUI pixels) turns the body 20 degrees, the head 40 and tilts it 20
    previewEl = el;
    const S = (typeof GUI !== 'undefined' && GUI.S) || 2;
    const r = el.getBoundingClientRect(), mx = ((window._mouseX || 0) - (r.left + r.width / 2)) / S, my = ((window._mouseY || 0) - (r.top + r.height / 2)) / S;
    const ha = Math.atan(mx / 40), va = Math.atan(-my / 40), D = Math.PI / 180;
    const fake = pVis.e; fake.bodyYaw = fake.pbodyYaw = ha * 20 * D; fake.headYaw = fake.pheadYaw = ha * 40 * D; fake.pitch = fake.ppitch = -va * 20 * D;
    fake.age = p.age; fake.sneaking = p.sneaking; fake.inv = p.inv; fake.heldItem = () => p.inv.held;
    pVis.obj.rotation.y = 0;
    pVis.update(1, Object.assign(animState(fake, 1), { la: 0 }));
    pVis.obj.rotation.y = Math.PI + fake.bodyYaw;
    for (const m of [pVis.mat]) m.uniforms.uEnv.value.set(1, 1);
    const sky = U.uSkyLight.value, fs = U.uFogStart.value, fe = U.uFogEnd.value; U.uSkyLight.value = 1; U.uFogStart.value = 1000; U.uFogEnd.value = 2000;
    pCam.position.set(0, 0.95, 4.2); pCam.lookAt(0, 0.9, 0);
    pr.render(pScene, pCam);
    U.uSkyLight.value = sky; U.uFogStart.value = fs; U.uFogEnd.value = fe;
  }
  // the preview follows the mouse while the inventory is open (redrawn at most once a frame)
  let previewEl = null, previewQueued = false;
  addEventListener('mousemove', e => {
    window._mouseX = e.clientX; window._mouseY = e.clientY;
    if (previewEl && previewEl.isConnected && !previewQueued) { previewQueued = true; requestAnimationFrame(() => { previewQueued = false; if (previewEl && previewEl.isConnected) drawPlayerPreview(previewEl); }); }
  });
  return { update, register(type, f) { factories[type] = f; }, pickup, clear, drawPlayerPreview, MobVisual, ItemVisual, BlockVisual, lightAt, vis };
})();

// ---------------------------------------------------------------- the first-person hand
Hand = (() => {
  const hScene = new THREE.Scene(), hCam = new THREE.PerspectiveCamera(70, 1, 0.05, 10);
  let item = null, itemId = -1, itemKey = -1, arm = null, armMat = null, equip = 0, pequip = 0, shown = null, ry = 0, rx = 0;
  function armMesh() {
    if (arm) return arm;
    armMat = entityMat(EntityModels.texture('player'), { side: THREE.DoubleSide });
    const geo = EntityModels.boxGeometry([[40, 16, -3, -2, -2, 4, 12, 4], [40, 32, -3, -2, -2, 4, 12, 4, 0.25]], 64, 64);
    arm = new THREE.Mesh(geo, armMat); arm.matrixAutoUpdate = false; arm.frustumCulled = false; hScene.add(arm);
    return arm;
  }
  // called every tick: the equip animation (the game's ItemInHandRenderer.tick): the hand sinks when the held
  // item changes and rises again with the new one; it also dips after an attack while the cooldown recovers
  function tick(p) {
    pequip = equip;
    const main = p.inv.held;
    if (shown && main && shown.id === main.id) shown = main; // same item, only count or damage changed
    const reequip = (shown ? shown.id : -1) !== (main ? main.id : -1);
    const f = Math.min(1, (p.attackCooldown + 0.5) / (20 / (main ? ITEMS[main.id].aspd : 4)));
    equip += Math.max(-0.4, Math.min(0.4, (reequip ? 0 : f * f * f) - equip));
    if (equip < 0.1) { shown = main; if (ItemMesh.key(shown) !== itemKey) setItem(shown); }
  }
  function setItem(st) {
    if (item) { hScene.remove(item); item.material.dispose(); item = null; }
    itemId = st ? st.id : -1; itemKey = ItemMesh.key(st);
    if (st) { item = ItemMesh.meshFor(st); item.matrixAutoUpdate = false; hScene.add(item); }
  }
  // a filled map held up (the game's renderTwoHandedMap / renderOneHandedMap): the paper and its map on a plane
  let mapTex = null, mapSeen = -1;
  const mapMeshes = [null, null];
  function mapMesh(k) {
    if (!mapTex) { mapTex = new THREE.CanvasTexture(Maps.handCanvas); mapTex.magFilter = mapTex.minFilter = THREE.NearestFilter; mapTex.generateMipmaps = false; }
    if (!mapMeshes[k]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), entityMat(mapTex, { side: THREE.DoubleSide })); m.matrixAutoUpdate = false; m.frustumCulled = false; hScene.add(m); mapMeshes[k] = m; }
    return mapMeshes[k];
  }
  const mapTilt = pitchDeg => { const f = Math.max(0, Math.min(1, 1 - pitchDeg / 45 + 0.1)); return -Math.cos(f * Math.PI) * 0.5 + 0.5; };
  // the game's renderMap: turned to face you, 0.38 across per hand-scale unit, the paper 142 map pixels square
  function renderMap(m) { MStack.ry(m, 180); MStack.rz(m, 180); m.multiply(new THREE.Matrix4().makeScale(0.38, 0.38, 0.38)); MStack.t(m, -0.5, -0.5, 0); m.multiply(new THREE.Matrix4().makeScale(1 / 128, 1 / 128, 1 / 128)); MStack.t(m, 64, 64, 0); m.multiply(new THREE.Matrix4().makeScale(142, -142, 1)); return m; }
  function heldMaps(p, bob, sway, swing, eq, sl, bl) {
    const isMap = s => s && ITEMS[s.id].name === 'filled_map';
    const main = isMap(p.inv.held), off = isMap(p.inv.offhand);
    if (main || off) { if (Maps.handDrawn !== mapSeen) { mapSeen = Maps.handDrawn; if (mapTex) mapTex.needsUpdate = true; } }
    for (let k = 0; k < 2; k++) if (mapMeshes[k]) mapMeshes[k].visible = false;
    if (main && !p.inv.offhand) {
      // both hands: the map rises and tilts toward you as you look down
      const m = new THREE.Matrix4().copy(bob).multiply(sway), f = Math.sqrt(swing), g = -0.2 * Math.sin(swing * Math.PI), h = -0.4 * Math.sin(f * Math.PI);
      MStack.t(m, 0, -g / 2, h);
      const i = mapTilt(p.pitch * 180 / Math.PI);
      MStack.t(m, 0, 0.04 - eq * 1.2 - i * 0.5, -0.72); MStack.rx(m, i * -85);
      MStack.rx(m, Math.sin(f * Math.PI) * 20); m.multiply(new THREE.Matrix4().makeScale(2, 2, 2));
      const mm = mapMesh(0); mm.visible = true; mm.matrix.copy(renderMap(m)); mm.material.uniforms.uEnv.value.set(sl, bl);
      return 'both';
    }
    const one = (side, k, sw, e) => {
      const m = new THREE.Matrix4().copy(bob).multiply(sway), f = side;
      MStack.t(m, f * 0.125, -0.125, 0);
      MStack.t(m, f * 0.51, -0.08 - e * 1.2, -0.75);
      const g = Math.sqrt(sw), hh = Math.sin(g * Math.PI), i = -0.5 * hh, j = 0.4 * Math.sin(g * Math.PI * 2), kk = -0.3 * Math.sin(sw * Math.PI);
      MStack.t(m, f * i, j - 0.3 * hh, kk); MStack.rx(m, hh * -45); MStack.ry(m, f * hh * -30);
      const mm = mapMesh(k); mm.visible = true; mm.matrix.copy(renderMap(m)); mm.material.uniforms.uEnv.value.set(sl, bl);
    };
    if (main) one(1, 0, swing, eq);
    if (off) one(-1, 1, 0, 0);
    return main ? 'main' : off ? 'off' : null;
  }
  // the off-hand item, on the left (the game's renderArmWithItem for the left arm, mirrored)
  let oItem = null, oKey = -1;
  function offHand(p, bob, sway, sl, bl) {
    const st = p.inv.offhand, k = ItemMesh.key(st);
    if (k !== oKey) { if (oItem) { hScene.remove(oItem); oItem.material.dispose(); oItem = null; } oKey = k; if (st) { oItem = ItemMesh.meshFor(st); oItem.matrixAutoUpdate = false; hScene.add(oItem); } }
    if (!oItem) return;
    oItem.visible = !p.spectator;
    const r = ItemMesh.get(st.id), kind = r.block ? 'block' : r.handheld ? 'handheld' : 'generated';
    const m = new THREE.Matrix4().copy(bob).multiply(sway);
    MStack.t(m, -0.56, -0.52, -0.72);
    applyItemTransform(m, kind, 'fp', true);
    oItem.matrix.copy(m);
    oItem.material.uniforms.uEnv.value.set(sl, bl);
    for (const ch of oItem.children) if (ch.material && ch.material.uniforms && ch.material.uniforms.uEnv) ch.material.uniforms.uEnv.value.set(sl, bl);
  }
  function update(a, p) {
    if (!p) return;
    hCam.aspect = camera.aspect; hCam.fov = camera.fov; hCam.updateProjectionMatrix();
    hCam.position.set(0, 0, 0); hCam.rotation.set(0, 0, 0);
    // the hand lags behind the view a little when turning (the game's arm sway)
    ry += (p.yaw - ry) * 0.5; rx += (p.pitch - rx) * 0.5;
    const sway = new THREE.Matrix4();
    MStack.rx(sway, -(p.pitch - rx) * 0.1 / DEG * 0.1); MStack.ry(sway, (p.yaw - ry) * 0.1 / DEG * 0.1);
    const swing = p.swinging ? Math.max(0, (p.swingTime + a) / 6) : 0;
    const eq = 1 - (pequip + (equip - pequip) * a);
    const [sl, bl] = EntityRender.lightAt(p.x, p.eyeY, p.z);
    // view bobbing moves the hand too
    const bob = new THREE.Matrix4();
    if (Settings.bobbing && !p.flying) { const wd = p.pwalkDist + (p.walkDist - p.pwalkDist) * a, b = p.pbob + (p.bob - p.pbob) * a, g = wd * Math.PI; MStack.t(bob, Math.sin(g) * b * 0.5, -Math.abs(Math.cos(g) * b), 0); MStack.rz(bob, Math.sin(g) * b * 3); MStack.rx(bob, Math.abs(Math.cos(g - 0.2) * b) * 5); }
    offHand(p, bob, sway, sl, bl);
    const swingNow = p.swinging ? Math.max(0, (p.swingTime + a) / 6) : 0, eqNow = 1 - (pequip + (equip - pequip) * a);
    const maps = heldMaps(p, bob, sway, swingNow, eqNow, sl, bl);
    if (maps === 'off' || maps === 'main' && oItem && p.inv.offhand && ITEMS[p.inv.offhand.id].name === 'filled_map') { if (oItem) oItem.visible = false; }
    if (maps === 'both' || maps === 'main') { if (item) item.visible = false; if (arm) arm.visible = false; return; }
    if (item) {
      if (arm) arm.visible = false;
      item.visible = true;
      const r = ItemMesh.get(itemId), kind = r.block ? 'block' : r.handheld ? 'handheld' : 'generated';
      const m = new THREE.Matrix4().copy(bob).multiply(sway);
      const using = p.using && p.using.id === itemId;
      const ut = p.useTicks + a;
      if (using && (ITEMS[itemId].food || ['potion', 'milk_bucket', 'honey_bottle', 'ominous_bottle'].includes(ITEMS[itemId].name))) {
        // eating and drinking: the item comes to the mouth and shakes
        const left = 32 - ut, f = left / 32, k = Math.pow(1 - f, 27);
        MStack.t(m, 0, left / 32 > 0.2 ? Math.abs(Math.cos(ut / 4 * Math.PI) * 0.1) : 0, 0);
        MStack.t(m, k * 0.6, k * -0.5, 0); MStack.ry(m, k * 90); MStack.rx(m, k * 10); MStack.rz(m, k * 30);
        MStack.t(m, 0.56, -0.52, -0.72);
      } else if (using && ITEMS[itemId].name === 'bow') {
        MStack.t(m, 0.56, -0.52, -0.72);
        MStack.t(m, -0.2785682, 0.18344387, 0.15731531); MStack.rx(m, -13.935); MStack.ry(m, 35.3); MStack.rz(m, -9.785);
        const f = Math.min(1, (ut / 20) * (ut / 20 + 2) / 3);
        if (f > 0.1) { const g = Math.sin((ut - 0.1) * 1.3) * (f - 0.1); MStack.t(m, 0, g * 0.004, 0); }
        MStack.t(m, 0, 0, f * 0.04); m.multiply(new THREE.Matrix4().makeScale(1, 1, 1 + f * 0.2)); MStack.ry(m, -45);
      } else if (using && ITEMS[itemId].name === 'brush') {
        // the game's brush sweep: a full back-and-forth every 10 ticks
        MStack.t(m, 0.56, -0.52, -0.72);
        const f1 = ((p.useMax - p.useTicks) % 10 + 10) % 10 - a + 1, f7 = -15 + 75 * Math.cos((1 - f1 / 10) * 2 * Math.PI);
        MStack.t(m, -0.25, 0.22, 0.35); MStack.rx(m, -80); MStack.ry(m, 90); MStack.rx(m, f7);
      } else if (using && (ITEMS[itemId].name === 'shield')) {
        MStack.t(m, 0.56, -0.52, -0.72);
      } else {
        const sq = Math.sqrt(swing);
        MStack.t(m, -0.4 * Math.sin(sq * Math.PI), 0.2 * Math.sin(sq * Math.PI * 2), -0.2 * Math.sin(swing * Math.PI));
        MStack.t(m, 0.56, -0.52 + eq * -0.6, -0.72);
        const f = Math.sin(swing * swing * Math.PI); MStack.ry(m, 45 + f * -20);
        const g = Math.sin(sq * Math.PI); MStack.rz(m, g * -20); MStack.rx(m, g * -80); MStack.ry(m, -45);
      }
      applyItemTransform(m, kind, 'fp', false);
      item.matrix.copy(m);
      item.material.uniforms.uEnv.value.set(sl, bl);
      for (const ch of item.children) if (ch.material && ch.material.uniforms && ch.material.uniforms.uEnv) ch.material.uniforms.uEnv.value.set(sl, bl);
    } else {
      const am = armMesh(); am.visible = true;
      const m = new THREE.Matrix4().copy(bob).multiply(sway);
      const g = Math.sqrt(swing), h = -0.3 * Math.sin(g * Math.PI), j = 0.4 * Math.sin(g * Math.PI * 2), k = -0.4 * Math.sin(swing * Math.PI);
      MStack.t(m, h + 0.64000005, j - 0.6 + eq * -0.6, k - 0.71999997);
      MStack.ry(m, 45);
      const l = Math.sin(swing * swing * Math.PI), mm = Math.sin(g * Math.PI);
      MStack.ry(m, mm * 70); MStack.rz(m, l * -20);
      MStack.t(m, -1, 3.6, 3.5); MStack.rz(m, 120); MStack.rx(m, 200); MStack.ry(m, -135);
      MStack.t(m, 5.6, 0, 0);
      // the arm part at its pivot (-5, 2, 0) in the model's own (unflipped) space
      MStack.t(m, -5 / 16, 2 / 16, 0); m.multiply(new THREE.Matrix4().makeScale(-1, -1, 1));
      am.matrix.copy(m);
      armMat.uniforms.uEnv.value.set(sl, bl);
    }
  }
  function render() {
    const p = Game.player;
    if (!p || p.view !== 0 || p.spectator || !Settings.hud || p.dead || p.sleeping) return;
    renderer.clearDepth();
    renderer.render(hScene, hCam);
  }
  return { update, render, tick };
})();
