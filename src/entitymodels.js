'use strict';
/* Entity models in the game's format: parts with a pivot and a rotation (in sixteenths of a block, y pointing
   down, the way the game's model code describes them), each holding boxes whose faces take the standard
   box layout of the skin texture. Skins are painted in code. Animations follow the game's formulas
   (limb swing cos(swing * 0.6662) * 1.4 * amount, head looking, arm swing, zombie arms...). */
const Skin = (() => {
  const H = c => '#' + c.toString(16).padStart(6, '0');
  const hn = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const scale = (c, k) => { const r = Math.min(255, Math.max(0, Math.round((c >> 16 & 255) * k))), g = Math.min(255, Math.max(0, Math.round((c >> 8 & 255) * k))), b = Math.min(255, Math.max(0, Math.round((c & 255) * k))); return (r << 16) | (g << 8) | b; };
  const mix = (a, b, t) => { const f = (s) => Math.round((a >> s & 255) * (1 - t) + (b >> s & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
  class S {
    constructor(w, h) { this.w = w; this.h = h; this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d'); this.seed = 1; }
    px(x, y, col, a) { if (col === null || col === undefined) return; this.g.globalAlpha = a === undefined ? 1 : a; this.g.fillStyle = typeof col === 'number' ? H(col) : col; this.g.fillRect(x, y, 1, 1); this.g.globalAlpha = 1; }
    // a rectangle of a colour with a little per-pixel brightness noise (n), the way the game's skins look
    fill(x, y, w, h, col, n, seed) { n = n === undefined ? 0.07 : n; const s = seed || this.seed++; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, n ? scale(col, 1 + (hn(x + i, y + j, s) - 0.5) * 2 * n) : col); }
    // pick per pixel between colours by noise (spots, patches)
    speckle(x, y, w, h, cols, seed) { const s = seed || this.seed++; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, cols[Math.floor(hn(x + i, y + j, s) * cols.length)]); }
    // the six faces of a box with texture offset (u, v) and size (w, h, d)
    faces(u, v, w, h, d) { return { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + d + w + d, v + d, w, h] }; }
    box(u, v, w, h, d, col, n, o) {
      o = o || {}; const F = this.faces(u, v, w, h, d);
      for (const k in F) { const f = F[k]; const c = o[k] !== undefined ? o[k] : k === 'top' ? scale(col, 1.06) : k === 'bottom' ? scale(col, 0.85) : col; if (c !== null) this.fill(f[0], f[1], f[2], f[3], c, n); }
      return F;
    }
    // a pattern of characters onto a face: map char -> colour
    pat(x, y, rows, map) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (map[ch] !== undefined && map[ch] !== null) this.px(x + i, y + j, map[ch]); } }
    clear(x, y, w, h) { this.g.clearRect(x, y, w, h); }
  }
  return { S, H, scale, mix, hn };
})();

const EntityModels = (() => {
  const PI = Math.PI;
  // ---------------------------------------------------------------- building geometry
  // box: [u, v, x, y, z, w, h, d, inflate, mirror]
  function boxGeometry(boxes, tw, th) {
    const pos = [], uv = [], nor = [], idx = [];
    for (const b of boxes) {
      const [u, v, x, y, z, w, h, d] = b, g = b[8] || 0, mirror = !!b[9];
      // rendered space (x and y flipped from model space), in blocks
      const X0 = -(x + w + g) / 16, X1 = -(x - g) / 16, Y0 = -(y + h + g) / 16, Y1 = -(y - g) / 16, Z0 = (z - g) / 16, Z1 = (z + d + g) / 16;
      const u0 = u, u1 = u + d, u2 = u + d + w, u3 = u + d + w + w, u4 = u + d + w + d, u5 = u + d + w + d + w, v0 = v, v1 = v + d, v2 = v + d + h;
      const faces = [
        // corners TL, TR, BR, BL seen from outside; uv rect [ua, va, ub, vb]; normal
        [[X1, Y1, Z0], [X0, Y1, Z0], [X0, Y0, Z0], [X1, Y0, Z0], [u1, v1, u2, v2], [0, 0, -1]], // front
        [[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y0, Z1], [X0, Y0, Z1], [u4, v1, u5, v2], [0, 0, 1]], // back
        [[X1, Y1, Z1], [X1, Y1, Z0], [X1, Y0, Z0], [X1, Y0, Z1], mirror ? [u2, v1, u4, v2] : [u0, v1, u1, v2], [1, 0, 0]], // the model's right side
        [[X0, Y1, Z0], [X0, Y1, Z1], [X0, Y0, Z1], [X0, Y0, Z0], mirror ? [u0, v1, u1, v2] : [u2, v1, u4, v2], [-1, 0, 0]], // left side
        [[X1, Y1, Z1], [X0, Y1, Z1], [X0, Y1, Z0], [X1, Y1, Z0], [u1, v0, u2, v1], [0, 1, 0]], // top
        [[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y0, Z1], [X1, Y0, Z1], [u2, v0, u3, v1], [0, -1, 0]], // bottom
      ];
      for (const f of faces) {
        let [ua, va, ub, vb] = f[4];
        if (mirror) [ua, ub] = [ub, ua];
        if (Math.abs(ub - ua) < 1e-6 || Math.abs(vb - va) < 1e-6) continue;
        const s = pos.length / 3;
        const uvs = [[ua, va], [ub, va], [ub, vb], [ua, vb]];
        for (let k = 0; k < 4; k++) { pos.push(...f[k]); uv.push(uvs[k][0] / tw, 1 - uvs[k][1] / th); nor.push(...f[5]); }
        idx.push(s, s + 3, s + 2, s, s + 2, s + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    return geo;
  }
  const geoCache = new Map();
  // an instance of a model: three.js groups for every part, with the base pose remembered
  class Instance {
    constructor(def, mat, matT) {
      this.def = def; this.root = new THREE.Group(); this.parts = {}; this.list = [];
      const body = new THREE.Group(); body.position.y = 1.501; this.root.add(body); this.body = body;
      const add = (pd, parent) => {
        const g = new THREE.Group();
        const part = { name: pd.n, g, bx: pd.p[0], by: pd.p[1], bz: pd.p[2], brx: pd.r[0], bry: pd.r[1], brz: pd.r[2], x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, show: true };
        if (pd.b.length) {
          const key = def.name + ':' + pd.n;
          let geo = geoCache.get(key); if (!geo) { geo = boxGeometry(pd.b, def.tw, def.th); geoCache.set(key, geo); }
          const m = new THREE.Mesh(geo, pd.t && matT ? matT : mat); m.frustumCulled = false; g.add(m); part.mesh = m;
        }
        parent.add(g); this.parts[pd.n] = part; this.list.push(part);
        for (const c of pd.c) add(c, g);
      };
      for (const pd of def.parts) add(pd, body);
      this.reset();
    }
    reset() { for (const p of this.list) { p.x = p.bx; p.y = p.by; p.z = p.bz; p.rx = p.brx; p.ry = p.bry; p.rz = p.brz; p.sx = p.sy = p.sz = 1; p.show = true; } }
    apply() { for (const p of this.list) { p.g.position.set(-p.x / 16, -p.y / 16, p.z / 16); p.g.rotation.set(-p.rx, -p.ry, p.rz, 'ZYX'); p.g.scale.set(p.sx, p.sy, p.sz); p.g.visible = p.show; } }
  }
  // part definition helper: name, pivot, rotation, boxes, children, translucent
  const P = (n, p, r, b, c, t) => ({ n, p, r: r || [0, 0, 0], b: b || [], c: c || [], t: !!t });
  const DEFS = {};
  function def(name, tw, th, parts, o) { DEFS[name] = Object.assign({ name, tw, th, parts, anim: null, skin: null, scale: 1 }, o || {}); }

  // ---------------------------------------------------------------- animations (the game's formulas)
  const A = {};
  const look = (m, s, part) => { const h = m.parts[part || 'head']; if (h) { h.ry = s.headYaw; h.rx = s.pitch; } };
  A.quadruped = (m, s) => {
    look(m, s);
    const ls = s.ls * 0.6662, la = s.la;
    const L = m.parts;
    if (L.right_hind_leg) L.right_hind_leg.rx = Math.cos(ls) * 1.4 * la;
    if (L.left_hind_leg) L.left_hind_leg.rx = Math.cos(ls + PI) * 1.4 * la;
    if (L.right_front_leg) L.right_front_leg.rx = Math.cos(ls + PI) * 1.4 * la;
    if (L.left_front_leg) L.left_front_leg.rx = Math.cos(ls) * 1.4 * la;
  };
  A.humanoid = (m, s) => {
    look(m, s);
    const L = m.parts, ls = s.ls * 0.6662, la = s.la;
    if (L.hat) { L.hat.ry = 0; L.hat.rx = 0; }
    L.right_arm.rx = Math.cos(ls + PI) * 2 * la * 0.5; L.left_arm.rx = Math.cos(ls) * 2 * la * 0.5;
    L.right_arm.rz = 0; L.left_arm.rz = 0;
    L.right_leg.rx = Math.cos(ls) * 1.4 * la; L.left_leg.rx = Math.cos(ls + PI) * 1.4 * la;
    L.right_leg.ry = 0; L.left_leg.ry = 0;
    if (s.riding) { L.right_arm.rx -= PI / 5; L.left_arm.rx -= PI / 5; L.right_leg.rx = -1.4137167; L.right_leg.ry = PI / 10; L.right_leg.rz = 0.07853982; L.left_leg.rx = -1.4137167; L.left_leg.ry = -PI / 10; L.left_leg.rz = -0.07853982; }
    if (s.holdRight) L.right_arm.rx = L.right_arm.rx * 0.5 - PI / 10;
    if (s.holdLeft) L.left_arm.rx = L.left_arm.rx * 0.5 - PI / 10;
    // the attack swing of the right arm
    if (s.swing > 0) {
      const f = s.swing; L.body.ry = Math.sin(Math.sqrt(f) * PI * 2) * 0.2;
      L.right_arm.z = Math.sin(L.body.ry) * 5; L.right_arm.x = -Math.cos(L.body.ry) * 5; L.left_arm.z = -Math.sin(L.body.ry) * 5; L.left_arm.x = Math.cos(L.body.ry) * 5;
      L.right_arm.ry += L.body.ry; L.left_arm.ry += L.body.ry; L.left_arm.rx += L.body.ry;
      let g = 1 - f; g *= g; g *= g; g = 1 - g;
      const h = Math.sin(g * PI), k = Math.sin(f * PI) * -(L.head.rx - 0.7) * 0.75;
      L.right_arm.rx -= h * 1.2 + k; L.right_arm.ry += L.body.ry * 2; L.right_arm.rz += Math.sin(f * PI) * -0.4;
    }
    if (s.crouch) { L.body.rx = 0.5; L.right_arm.rx += 0.4; L.left_arm.rx += 0.4; L.right_leg.z += 4; L.left_leg.z += 4; L.right_leg.y += 0.2; L.left_leg.y += 0.2; L.head.y += 4.2; L.body.y += 3.2; L.left_arm.y += 3.2; L.right_arm.y += 3.2; }
    // arms bob gently
    L.right_arm.rz += Math.cos(s.t * 0.09) * 0.05 + 0.05; L.left_arm.rz -= Math.cos(s.t * 0.09) * 0.05 + 0.05;
    L.right_arm.rx += Math.sin(s.t * 0.067) * 0.05; L.left_arm.rx -= Math.sin(s.t * 0.067) * 0.05;
    if (s.bow) { L.right_arm.ry = -0.1 + L.head.ry; L.left_arm.ry = 0.1 + L.head.ry + 0.4; L.right_arm.rx = -PI / 2 + L.head.rx; L.left_arm.rx = -PI / 2 + L.head.rx; }
    if (s.crossbowCharge) { L.right_arm.ry = -0.8; L.right_arm.rx = -0.97079635; L.left_arm.rx = -0.97079635; L.left_arm.ry = 0.4; }
    if (s.spyglass || s.eating) { const arm = L.right_arm; arm.rx = -PI / 2 * 0.9 + L.head.rx * 0.5; arm.ry = -0.3; }
    if (s.blocking) { L.left_arm.rx = L.left_arm.rx * 0.5 - 0.9424779; L.left_arm.ry = PI / 6; }
  };
  // zombies hold their arms out, higher when they are after someone
  A.zombie = (m, s) => {
    A.humanoid(m, Object.assign({}, s, { swing: 0 }));
    const L = m.parts, f = Math.sin(s.swing * PI), g = Math.sin((1 - (1 - s.swing) * (1 - s.swing)) * PI);
    L.right_arm.rz = 0; L.left_arm.rz = 0; L.right_arm.ry = -(0.1 - f * 0.6); L.left_arm.ry = 0.1 - f * 0.6;
    const h = -PI / (s.aggressive ? 1.5 : 2.25);
    L.right_arm.rx = h + f * 1.2 - g * 0.4; L.left_arm.rx = h + f * 1.2 - g * 0.4;
    L.right_arm.rz += Math.cos(s.t * 0.09) * 0.05 + 0.05; L.left_arm.rz -= Math.cos(s.t * 0.09) * 0.05 + 0.05;
    L.right_arm.rx += Math.sin(s.t * 0.067) * 0.05; L.left_arm.rx -= Math.sin(s.t * 0.067) * 0.05;
  };
  A.skeleton = (m, s) => { A.humanoid(m, s); if (s.aggressive && s.holdingBow) { const L = m.parts; L.right_arm.ry = -0.1 + L.head.ry; L.left_arm.ry = 0.1 + L.head.ry + 0.4; L.right_arm.rx = -PI / 2 + L.head.rx; L.left_arm.rx = -PI / 2 + L.head.rx; } };
  A.creeper = (m, s) => { look(m, s); const L = m.parts, ls = s.ls * 0.6662, la = s.la; L.right_hind_leg.rx = Math.cos(ls) * 1.4 * la; L.left_hind_leg.rx = Math.cos(ls + PI) * 1.4 * la; L.right_front_leg.rx = Math.cos(ls + PI) * 1.4 * la; L.left_front_leg.rx = Math.cos(ls) * 1.4 * la; };
  A.spider = (m, s) => {
    look(m, s);
    const L = m.parts, f = PI / 4, g = PI / 8;
    L.right_hind_leg.rz = -f; L.left_hind_leg.rz = f; L.right_middle_hind_leg.rz = -f * 0.74; L.left_middle_hind_leg.rz = f * 0.74;
    L.right_middle_front_leg.rz = -f * 0.74; L.left_middle_front_leg.rz = f * 0.74; L.right_front_leg.rz = -f; L.left_front_leg.rz = f;
    L.right_hind_leg.ry = f; L.left_hind_leg.ry = -f; L.right_middle_hind_leg.ry = g; L.left_middle_hind_leg.ry = -g;
    L.right_middle_front_leg.ry = -g; L.left_middle_front_leg.ry = g; L.right_front_leg.ry = -f; L.left_front_leg.ry = f;
    const ls = s.ls * 0.6662, la = s.la;
    const i = -(Math.cos(ls * 2) * 0.4) * la, j = -(Math.cos(ls * 2 + PI) * 0.4) * la, k = -(Math.cos(ls * 2 + PI / 2) * 0.4) * la, l = -(Math.cos(ls * 2 + PI * 1.5) * 0.4) * la;
    const mm = Math.abs(Math.sin(ls) * 0.4) * la, n = Math.abs(Math.sin(ls + PI) * 0.4) * la, o = Math.abs(Math.sin(ls + PI / 2) * 0.4) * la, p = Math.abs(Math.sin(ls + PI * 1.5) * 0.4) * la;
    L.right_hind_leg.ry += i; L.left_hind_leg.ry -= i; L.right_middle_hind_leg.ry += j; L.left_middle_hind_leg.ry -= j; L.right_middle_front_leg.ry += k; L.left_middle_front_leg.ry -= k; L.right_front_leg.ry += l; L.left_front_leg.ry -= l;
    L.right_hind_leg.rz += mm; L.left_hind_leg.rz -= mm; L.right_middle_hind_leg.rz += n; L.left_middle_hind_leg.rz -= n; L.right_middle_front_leg.rz += o; L.left_middle_front_leg.rz -= o; L.right_front_leg.rz += p; L.left_front_leg.rz -= p;
  };
  A.chicken = (m, s) => {
    const L = m.parts; for (const n of ['head', 'beak', 'red_thing']) { L[n].rx = s.pitch; L[n].ry = s.headYaw; }
    const ls = s.ls * 0.6662, la = s.la; L.right_leg.rx = Math.cos(ls) * 1.4 * la; L.left_leg.rx = Math.cos(ls + PI) * 1.4 * la;
    const flap = s.flap || 0; L.right_wing.rz = flap; L.left_wing.rz = -flap;
  };
  A.enderman = (m, s) => {
    A.humanoid(m, s);
    const L = m.parts;
    L.right_arm.rx *= 0.5; L.left_arm.rx *= 0.5; L.right_leg.rx *= 0.5; L.left_leg.rx *= 0.5;
    L.right_arm.rx = Math.max(-0.4, Math.min(0.4, L.right_arm.rx)); L.left_arm.rx = Math.max(-0.4, Math.min(0.4, L.left_arm.rx));
    L.right_leg.rx = Math.max(-0.4, Math.min(0.4, L.right_leg.rx)); L.left_leg.rx = Math.max(-0.4, Math.min(0.4, L.left_leg.rx));
    if (s.carrying) { L.right_arm.rx = -0.5; L.left_arm.rx = -0.5; L.right_arm.rz = 0.05; L.left_arm.rz = -0.05; }
    L.right_leg.z = 0; L.left_leg.z = 0; L.head.y = -13;
    if (s.creepy) { L.head.y -= 5; L.hat.y = 5; } else L.hat.y = 0;
  };
  A.villager = (m, s) => { look(m, s); const L = m.parts, ls = s.ls * 0.6662, la = s.la; L.right_leg.rx = Math.cos(ls) * 1.4 * la * 0.5; L.left_leg.rx = Math.cos(ls + PI) * 1.4 * la * 0.5; if (s.unhappy) { L.head.rz = 0.3 * Math.sin(0.45 * s.t); L.head.rx = 0.4; } };
  A.golem = (m, s) => {
    look(m, s);
    const L = m.parts, ls = s.ls, la = s.la, tri = (x, k) => (Math.abs(((x % k) + k) % k - k * 0.5) - k * 0.25) / (k * 0.25);
    L.right_leg.rx = -1.5 * tri(ls, 13) * la; L.left_leg.rx = 1.5 * tri(ls, 13) * la;
    if (s.attackTime > 0) { const f = s.attackTime; L.right_arm.rx = -2 + 1.5 * tri(f, 10); L.left_arm.rx = -2 + 1.5 * tri(f, 10); }
    else if (s.offerFlower) { L.right_arm.rx = -0.8 + 0.025 * tri(s.offerFlower, 70); L.left_arm.rx = 0; }
    else { L.right_arm.rx = (-0.2 + 1.5 * tri(ls, 13)) * la; L.left_arm.rx = (-0.2 - 1.5 * tri(ls, 13)) * la; }
  };
  A.slime = () => {};
  A.wolf = (m, s) => {
    A.quadruped(m, s);
    const L = m.parts; L.tail.rx = s.tail !== undefined ? s.tail : PI / 5; L.tail.ry = Math.cos(s.ls * 0.6662) * 1.4 * s.la * (s.angry ? 0 : 1);
    if (s.sitting) { L.upper_body.rx = PI * 2 / 5; L.upper_body.y = 16; L.body.rx = PI / 4; L.body.y = 18; L.body.z = 0; L.tail.y = 21; L.tail.z = 6; L.right_hind_leg.rx = PI * 1.5; L.right_hind_leg.y = 22.7; L.right_hind_leg.z = 2; L.left_hind_leg.rx = PI * 1.5; L.left_hind_leg.y = 22.7; L.left_hind_leg.z = 2; L.right_front_leg.rx = 5.811947; L.right_front_leg.x = -2.49; L.right_front_leg.y = 17; L.right_front_leg.z = -4; L.left_front_leg.rx = 5.811947; L.left_front_leg.x = 0.51; L.left_front_leg.y = 17; L.left_front_leg.z = -4; }
    L.head.rz = s.headTilt || 0;
  };
  A.cat = (m, s) => {
    look(m, s);
    const L = m.parts, ls = s.ls * 0.6662, la = s.la;
    L.tail1.rx = 0.9 + 0.2 * Math.cos(ls) * la; L.tail2.rx = 1.7 + PI / 4 * Math.cos(ls) * la;
    L.left_hind_leg.rx = Math.cos(ls) * la; L.right_hind_leg.rx = Math.cos(ls + 0.3 + PI) * la; L.left_front_leg.rx = Math.cos(ls + PI + 0.3) * la; L.right_front_leg.rx = Math.cos(ls) * la;
    if (s.sitting) { L.body.rx = PI / 4; L.body.y -= 4; L.body.z += 5; L.head.y -= 3.3; L.head.z += 1; L.tail1.y += 8; L.tail1.z -= 2; L.tail2.y += 2; L.tail2.z -= 0.8; L.tail1.rx = 1.7278761; L.tail2.rx = 2.670354; L.left_front_leg.rx = -0.15707964; L.left_front_leg.y += 2; L.left_front_leg.z -= 2; L.right_front_leg.rx = -0.15707964; L.right_front_leg.y += 2; L.right_front_leg.z -= 2; L.left_hind_leg.rx = -PI / 2; L.left_hind_leg.y += 3; L.left_hind_leg.z += 4; L.right_hind_leg.rx = -PI / 2; L.right_hind_leg.y += 3; L.right_hind_leg.z += 4; }
  };

  // ---------------------------------------------------------------- shared shapes
  const humanoidParts = (o) => {
    o = o || {}; const wide = o.slim ? 3 : 4, tall = o.tall64;
    return [
      P('head', [0, 0, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8]], [P('hat', [0, 0, 0], 0, [[32, 0, -4, -8, -4, 8, 8, 8, 0.5]], [], true)]),
      P('body', [0, 0, 0], 0, [[16, 16, -4, 0, -2, 8, 12, 4]].concat(tall ? [[16, 32, -4, 0, -2, 8, 12, 4, 0.25]] : [])),
      P('right_arm', [-5, 2, 0], 0, [[40, 16, -wide + 1, -2, -2, wide, 12, 4]].concat(tall ? [[40, 32, -wide + 1, -2, -2, wide, 12, 4, 0.25]] : [])),
      P('left_arm', [5, 2, 0], 0, tall ? [[32, 48, -1, -2, -2, wide, 12, 4], [48, 48, -1, -2, -2, wide, 12, 4, 0.25]] : [[40, 16, -1, -2, -2, wide, 12, 4, 0, true]]),
      P('right_leg', [-1.9, 12, 0], 0, [[0, 16, -2, 0, -2, 4, 12, 4]].concat(tall ? [[0, 32, -2, 0, -2, 4, 12, 4, 0.25]] : [])),
      P('left_leg', [1.9, 12, 0], 0, tall ? [[16, 48, -2, 0, -2, 4, 12, 4], [0, 48, -2, 0, -2, 4, 12, 4, 0.25]] : [[0, 16, -2, 0, -2, 4, 12, 4, 0, true]]),
    ];
  };
  const skeletonParts = () => [
    P('head', [0, 0, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8]], [P('hat', [0, 0, 0], 0, [[32, 0, -4, -8, -4, 8, 8, 8, 0.5]], [], true)]),
    P('body', [0, 0, 0], 0, [[16, 16, -4, 0, -2, 8, 12, 4]]),
    P('right_arm', [-5, 2, 0], 0, [[40, 16, -1, -2, -1, 2, 12, 2]]),
    P('left_arm', [5, 2, 0], 0, [[40, 16, -1, -2, -1, 2, 12, 2, 0, true]]),
    P('right_leg', [-2, 12, 0], 0, [[0, 16, -1, 0, -1, 2, 12, 2]]),
    P('left_leg', [2, 12, 0], 0, [[0, 16, -1, 0, -1, 2, 12, 2, 0, true]]),
  ];
  const villagerParts = (o) => [
    P('head', [0, 0, 0], 0, [[0, 0, -4, -10, -4, 8, 10, 8]], [
      P('hat', [0, 0, 0], 0, [[32, 0, -4, -10, -4, 8, 10, 8, 0.51]], o && o.rim ? [P('hat_rim', [0, 0, 0], [-PI / 2, 0, 0], [[30, 47, -8, -8, -6, 16, 16, 1]])] : [], true),
      P('nose', [0, -2, 0], 0, [[24, 0, -1, -1, -6, 2, 4, 2]])]),
    P('body', [0, 0, 0], 0, [[16, 20, -4, 0, -3, 8, 12, 6]], [P('jacket', [0, 0, 0], 0, [[0, 38, -4, 0, -3, 8, 20, 6, 0.5]], [], true)]),
    P('arms', [0, 3, -1], [-0.75, 0, 0], [[44, 22, -8, -2, -2, 4, 8, 4], [44, 22, 4, -2, -2, 4, 8, 4, 0, true], [40, 38, -4, 2, -2, 8, 4, 4]]),
    P('right_leg', [-2, 12, 0], 0, [[0, 22, -2, 0, -2, 4, 12, 4]]),
    P('left_leg', [2, 12, 0], 0, [[0, 22, -2, 0, -2, 4, 12, 4, 0, true]]),
  ];
  const quadLegs = (u, v, w, h, d, px, pz, fz, y, mirrorLeft) => [
    P('right_hind_leg', [-px, y, pz], 0, [[u, v, -w / 2, 0, -d / 2, w, h, d]]),
    P('left_hind_leg', [px, y, pz], 0, [[u, v, -w / 2, 0, -d / 2, w, h, d, 0, !!mirrorLeft]]),
    P('right_front_leg', [-px, y, fz], 0, [[u, v, -w / 2, 0, -d / 2, w, h, d]]),
    P('left_front_leg', [px, y, fz], 0, [[u, v, -w / 2, 0, -d / 2, w, h, d, 0, !!mirrorLeft]]),
  ];

  // ---------------------------------------------------------------- skins
  const { S, scale: sc, mix } = Skin;
  const eyes = (s, x, y, white, pupil, o) => { o = o || {}; const w = o.w || 1; s.fill(x, y, w, 1, white, 0); s.fill(x + (o.gap || 4) + w, y, w, 1, white, 0); if (pupil !== null && pupil !== undefined) { s.px(o.inner ? x + w - 1 + (o.pupilOff || 0) : x, y, pupil); s.px(o.inner ? x + (o.gap || 4) + w : x + (o.gap || 4) + w + w - 1, y, pupil); } };
  // a human-like head: skin, hair on top/back/sides, eyes and a mouth
  function headFace(s, u, v, skin, hair, eye, o) {
    o = o || {};
    const F = s.box(u, v, 8, 8, 8, skin, 0.05);
    if (hair !== null) { s.fill(F.top[0], F.top[1], 8, 8, hair, 0.1); s.fill(F.back[0], F.back[1], 8, 8, hair, 0.1); for (const f of [F.right, F.left]) s.fill(f[0], f[1], 8, o.sideHair || 3, hair, 0.1); s.fill(F.front[0], F.front[1], 8, o.fringe || 2, hair, 0.1); }
    const fx = F.front[0], fy = F.front[1];
    if (eye) { s.px(fx + 1, fy + 4, 0xffffff); s.px(fx + 2, fy + 4, eye); s.px(fx + 5, fy + 4, eye); s.px(fx + 6, fy + 4, 0xffffff); }
    if (o.mouth) s.fill(fx + 3, fy + 6, 2, 1, o.mouth, 0);
    return F;
  }
  const SK = {};
  SK.player = s => {
    // a plain blocky adventurer: brown hair, turquoise shirt, blue trousers, grey shoes
    const skin = 0xc69680, hair = 0x3b2213, shirt = 0x00a8a8, pants = 0x3a3a9c, shoe = 0x5a5a5a;
    const F = headFace(s, 0, 0, skin, hair, 0x4a3ab0, { mouth: 0x8a4a3a, fringe: 1 }); s.px(F.front[0] + 3, F.front[1] + 5, sc(skin, 0.85)); s.px(F.front[0] + 4, F.front[1] + 5, sc(skin, 0.85));
    s.box(16, 16, 8, 12, 4, shirt, 0.06);
    const arm = (u, v) => { const A2 = s.box(u, v, 4, 12, 4, shirt, 0.06); for (const k of ['front', 'back', 'left', 'right']) s.fill(A2[k][0], A2[k][1] + 4, A2[k][2], 8, skin, 0.05); s.fill(A2.bottom[0], A2.bottom[1], 4, 4, skin, 0.05); };
    arm(40, 16); arm(32, 48);
    const leg = (u, v) => { const L = s.box(u, v, 4, 12, 4, pants, 0.06); for (const k of ['front', 'back', 'left', 'right']) s.fill(L[k][0], L[k][1] + 10, L[k][2], 2, shoe, 0.05); s.fill(L.bottom[0], L.bottom[1], 4, 4, shoe, 0.05); };
    leg(0, 16); leg(16, 48);
  };
  SK.zombie = s => {
    const skin = 0x528c3b, shirt = 0x2d8a8a, pants = 0x3c3a8f;
    const F = s.box(0, 0, 8, 8, 8, skin, 0.1); s.fill(F.top[0], F.top[1], 8, 8, 0x3f6e2c, 0.1);
    const fx = F.front[0], fy = F.front[1]; s.fill(fx + 1, fy + 3, 2, 1, 0x1c3010, 0); s.fill(fx + 5, fy + 3, 2, 1, 0x1c3010, 0); s.fill(fx + 2, fy + 6, 4, 1, 0x2a4a1c, 0); s.px(fx + 3, fy + 4, 0x2e5a22); s.px(fx + 4, fy + 4, 0x2e5a22);
    s.box(16, 16, 8, 12, 4, shirt, 0.09);
    const arm = (u, v) => { const A2 = s.box(u, v, 4, 12, 4, skin, 0.1); for (const k of ['front', 'back', 'left', 'right', 'top']) s.fill(A2[k][0], A2[k][1], A2[k][2], k === 'top' ? 4 : 4, shirt, 0.09); };
    arm(40, 16); arm(32, 48);
    s.box(0, 16, 4, 12, 4, pants, 0.09); s.box(16, 48, 4, 12, 4, pants, 0.09);
  };
  SK.husk = s => {
    const skin = 0xb8a47a, shirt = 0x8a7a54, pants = 0x6a5a3a;
    const F = s.box(0, 0, 8, 8, 8, skin, 0.1); s.fill(F.top[0], F.top[1], 8, 8, 0x9a8a5a, 0.1);
    const fx = F.front[0], fy = F.front[1]; s.fill(fx + 1, fy + 3, 2, 1, 0x3a2a1a, 0); s.fill(fx + 5, fy + 3, 2, 1, 0x3a2a1a, 0); s.fill(fx + 2, fy + 6, 4, 1, 0x5a4a2a, 0);
    s.box(16, 16, 8, 12, 4, shirt, 0.1);
    for (const [u, v] of [[40, 16], [32, 48]]) { const A2 = s.box(u, v, 4, 12, 4, skin, 0.1); for (const k of ['front', 'back', 'left', 'right']) s.fill(A2[k][0], A2[k][1], A2[k][2], 4, shirt, 0.1); }
    s.box(0, 16, 4, 12, 4, pants, 0.09); s.box(16, 48, 4, 12, 4, pants, 0.09);
  };
  SK.drowned = s => {
    const skin = 0x4f9a8a, cloth = 0x3a6a5a, pants = 0x5a4a7a;
    const F = s.box(0, 0, 8, 8, 8, skin, 0.1); s.fill(F.top[0], F.top[1], 8, 8, 0x3a7a6a, 0.12);
    const fx = F.front[0], fy = F.front[1]; s.px(fx + 1, fy + 3, 0x8ff0e0); s.px(fx + 2, fy + 3, 0x1a3a3a); s.px(fx + 5, fy + 3, 0x1a3a3a); s.px(fx + 6, fy + 3, 0x8ff0e0); s.fill(fx + 2, fy + 6, 4, 1, 0x1f4a42, 0);
    s.box(16, 16, 8, 12, 4, cloth, 0.12); s.speckle(20, 20, 8, 12, [cloth, 0x2a5a4a, skin, cloth]);
    s.box(40, 16, 4, 12, 4, skin, 0.1); s.box(32, 48, 4, 12, 4, skin, 0.1);
    s.box(0, 16, 4, 12, 4, pants, 0.1); s.box(16, 48, 4, 12, 4, skin, 0.1);
    s.box(32, 0, 8, 8, 8, 0x3a8a5a, 0.15); s.clear(40, 8, 8, 6); s.clear(32, 8, 8, 4); s.clear(48, 8, 8, 4); s.clear(40, 0, 16, 8);
  };
  SK.skeleton = (s, o) => {
    o = o || {}; const bone = o.bone || 0xc6c6c6, dark = o.dark || 0x5a5a5a;
    const F = s.box(0, 0, 8, 8, 8, bone, 0.06);
    const fx = F.front[0], fy = F.front[1];
    s.fill(fx + 1, fy + 3, 2, 2, 0x202020, 0); s.fill(fx + 5, fy + 3, 2, 2, 0x202020, 0); s.px(fx + 3, fy + 5, dark); s.px(fx + 4, fy + 5, dark); s.fill(fx + 1, fy + 6, 6, 1, dark, 0); for (let i = 0; i < 6; i += 2) s.px(fx + 1 + i, fy + 6, bone);
    const B = s.box(16, 16, 8, 12, 4, 0x000000, 0);
    s.clear(16, 16, 32, 16);
    // a rib cage: spine and ribs on transparent
    for (let y = 0; y < 12; y++) { s.px(B.front[0] + 3, B.front[1] + y, bone); s.px(B.front[0] + 4, B.front[1] + y, sc(bone, 0.9)); s.px(B.back[0] + 3, B.back[1] + y, bone); s.px(B.back[0] + 4, B.back[1] + y, sc(bone, 0.9)); }
    for (const y of [1, 3, 5, 7]) s.fill(B.front[0], B.front[1] + y, 8, 1, bone, 0.05);
    s.fill(B.front[0], B.front[1] + 10, 8, 2, bone, 0.05); s.fill(B.top[0], B.top[1], 8, 4, bone, 0.05);
    for (const y of [1, 3, 5, 7]) { s.fill(B.right[0], B.right[1] + y, 4, 1, bone, 0.05); s.fill(B.left[0], B.left[1] + y, 4, 1, bone, 0.05); s.fill(B.back[0], B.back[1] + y, 8, 1, bone, 0.05); }
    s.box(40, 16, 2, 12, 2, bone, 0.06); s.box(0, 16, 2, 12, 2, bone, 0.06);
    if (o.overlay) o.overlay(s);
  };
  SK.stray = s => SK.skeleton(s, { bone: 0xb6c4c4, overlay: S2 => { const C = 0x5a6a6a; S2.box(32, 0, 8, 8, 8, C, 0.1); S2.clear(40, 8, 8, 8); } });
  SK.wither_skeleton = s => SK.skeleton(s, { bone: 0x2a2a2a, dark: 0x111111 });
  SK.bogged = s => SK.skeleton(s, { bone: 0xa4b48a, dark: 0x4a5a3a });
  SK.creeper = s => {
    const g = [0x5fb34a, 0x4c9a3a, 0x6fc95a, 0x7ad46a, 0x3e8a2e, 0x8fdc82];
    const F = s.box(0, 0, 8, 8, 8, 0x5fb34a, 0); s.speckle(0, 0, 32, 16, g);
    const fx = F.front[0], fy = F.front[1];
    s.pat(fx, fy, ['........', '........', '.##..##.', '.##..##.', '...##...', '..####..', '..####..', '..#..#..'], { '#': 0x0a0a0a });
    s.box(16, 16, 8, 12, 4, 0x5fb34a, 0); s.speckle(16, 16, 24, 16, g);
    s.box(0, 16, 4, 6, 4, 0x5fb34a, 0); s.speckle(0, 16, 16, 10, g); s.fill(4, 25, 4, 1, 0x2a5a1e, 0.1); s.fill(0, 25, 4, 1, 0x2a5a1e, 0.1); s.fill(8, 25, 8, 1, 0x2a5a1e, 0.1);
  };
  SK.spider = (s, o) => {
    o = o || {}; const body = o.body || 0x3a332c, dark = o.dark || 0x241f1a, eye = o.eye || 0xd01818;
    s.box(32, 4, 8, 8, 8, body, 0.12);
    const fx = 40, fy = 12; s.fill(fx + 1, fy + 2, 2, 1, eye, 0); s.fill(fx + 5, fy + 2, 2, 1, eye, 0); s.px(fx + 2, fy + 3, eye); s.px(fx + 5, fy + 3, eye); s.px(fx + 3, fy + 1, eye); s.px(fx + 4, fy + 1, eye); s.fill(fx + 3, fy + 6, 2, 2, 0x8a7a6a, 0);
    s.box(0, 0, 6, 6, 6, dark, 0.1);
    const B = s.box(0, 12, 10, 8, 12, body, 0.12); s.speckle(B.top[0], B.top[1], 10, 12, [body, dark, body, sc(body, 1.2)]);
    s.box(18, 0, 16, 2, 2, dark, 0.15);
  };
  SK.cave_spider = s => SK.spider(s, { body: 0x1f4a4f, dark: 0x0f2a2e, eye: 0xc81818 });
  SK.enderman = s => {
    const b = 0x161616;
    s.box(0, 0, 8, 8, 8, b, 0.08); s.fill(9, 12, 2, 1, 0xe079fa, 0); s.fill(13, 12, 2, 1, 0xe079fa, 0); s.px(8, 12, 0xcc00fa); s.px(15, 12, 0xcc00fa);
    s.box(0, 16, 8, 8, 8, b, 0.08); s.clear(0, 16, 32, 8); s.clear(8, 24, 8, 4); s.clear(0, 24, 8, 4); s.clear(16, 24, 8, 4); s.clear(24, 24, 8, 4);
    s.box(32, 16, 8, 12, 4, b, 0.08); s.box(56, 0, 2, 30, 2, b, 0.08);
  };
  SK.pig = s => {
    const p = 0xf1a2a0, d = 0xe28a88;
    const F = s.box(0, 0, 8, 8, 8, p, 0.05); const fx = F.front[0], fy = F.front[1];
    s.px(fx, fy + 3, 0xffffff); s.px(fx + 1, fy + 3, 0x000000); s.px(fx + 6, fy + 3, 0x000000); s.px(fx + 7, fy + 3, 0xffffff);
    const N = s.box(16, 16, 4, 3, 1, 0xe5908d, 0.04); s.px(N.front[0], N.front[1] + 1, 0x9a4f4c); s.px(N.front[0] + 3, N.front[1] + 1, 0x9a4f4c);
    s.box(28, 8, 10, 16, 8, p, 0.06); s.box(0, 16, 4, 6, 4, d, 0.05); s.fill(4, 25, 8, 1, 0x8a5a4a, 0.05); s.fill(0, 25, 4, 1, 0x8a5a4a, 0.05); s.fill(12, 25, 4, 1, 0x8a5a4a, 0.05);
  };
  const cowSkin = (s, base, spot, o) => {
    o = o || {};
    const F = s.box(0, 0, 8, 8, 6, base, 0.08); const fx = F.front[0], fy = F.front[1];
    s.fill(fx + 2, fy, 4, 8, spot, 0.05); s.fill(fx + 1, fy + 5, 6, 3, o.muzzle || 0xb8b0a8, 0.05); s.px(fx + 2, fy + 6, 0x3a2a2a); s.px(fx + 5, fy + 6, 0x3a2a2a);
    s.px(fx, fy + 2, 0x000000); s.px(fx + 1, fy + 2, 0xffffff); s.px(fx + 6, fy + 2, 0xffffff); s.px(fx + 7, fy + 2, 0x000000);
    s.box(22, 0, 1, 3, 1, 0xd8d0c0, 0.05);
    const B = s.box(18, 4, 12, 18, 10, base, 0.08);
    for (const k of ['top', 'right', 'left', 'front', 'back']) { const f = B[k]; for (let i = 0; i < 3; i++) { const w = 3 + (i * 7 + f[0]) % 4, h = 3 + (i * 5 + f[1]) % 4; s.fill(f[0] + ((i * 11 + f[0] * 3) % Math.max(1, f[2] - w)), f[1] + ((i * 13 + f[1]) % Math.max(1, f[3] - h)), w, h, spot, 0.05); } }
    s.box(52, 0, 4, 6, 1, o.udder || 0xe8a8a8, 0.05);
    const L = s.box(0, 16, 4, 12, 4, base, 0.08); for (const k of ['front', 'back', 'left', 'right']) { s.fill(L[k][0], L[k][1] + 4, L[k][2], 6, spot, 0.05); s.fill(L[k][0], L[k][1] + 10, L[k][2], 2, 0x4a4a4a, 0.05); }
  };
  SK.cow = s => cowSkin(s, 0x433626, 0xe9e4dc);
  SK.mooshroom = s => cowSkin(s, 0xa11a1a, 0xc8c0b8, { muzzle: 0xd0c0b8, udder: 0xf0b0b0 });
  SK.sheep = s => {
    const skin = 0xd8c0a8, face = 0xc4ab92;
    const F = s.box(0, 0, 6, 6, 8, skin, 0.05); const fx = F.front[0], fy = F.front[1];
    s.fill(fx, fy, 6, 6, face, 0.05); s.px(fx, fy + 2, 0xffffff); s.px(fx + 1, fy + 2, 0x000000); s.px(fx + 4, fy + 2, 0x000000); s.px(fx + 5, fy + 2, 0xffffff); s.fill(fx + 2, fy + 4, 2, 1, 0xd0a8a0, 0);
    s.box(28, 8, 8, 16, 6, skin, 0.06); s.box(0, 16, 4, 12, 4, skin, 0.06);
  };
  SK.sheep_fur = s => { s.box(0, 0, 6, 6, 6, 0xffffff, 0.06); s.box(28, 8, 8, 16, 6, 0xffffff, 0.07); s.box(0, 16, 4, 6, 4, 0xffffff, 0.06); s.clear(6, 6, 6, 6); };
  SK.chicken = s => {
    const w = 0xf2f2f2;
    const F = s.box(0, 0, 4, 6, 3, w, 0.04); s.px(F.front[0], F.front[1] + 1, 0x000000); s.px(F.front[0] + 3, F.front[1] + 1, 0x000000);
    s.box(14, 0, 4, 2, 2, 0xf4a83a, 0.05); s.box(14, 4, 2, 2, 2, 0xd8302a, 0.05);
    s.box(0, 9, 6, 8, 6, w, 0.05); s.box(26, 0, 3, 5, 3, 0xe8a83a, 0.05); s.clear(26, 0, 12, 3); s.fill(27, 3, 1, 5, 0xe8a83a, 0); s.box(24, 13, 1, 4, 6, 0xe6e6e6, 0.05);
  };
  SK.wolf = (s, o) => {
    o = o || {}; const fur = o.fur || 0xd8d4cc, dark = o.dark || 0xb8b2a8;
    const F = s.box(0, 0, 6, 6, 4, fur, 0.06); const fx = F.front[0], fy = F.front[1]; s.px(fx + 1, fy + 2, o.eye || 0x000000); s.px(fx + 4, fy + 2, o.eye || 0x000000); if (o.angry) { s.px(fx + 1, fy + 1, 0x000000); s.px(fx + 4, fy + 1, 0x000000); }
    s.box(16, 14, 2, 2, 1, dark, 0.05); const N = s.box(0, 10, 3, 3, 4, fur, 0.05); s.fill(N.front[0], N.front[1], 3, 1, 0x1a1a1a, 0);
    s.box(18, 14, 6, 9, 6, fur, 0.07); s.box(21, 0, 8, 6, 7, dark, 0.07); s.box(0, 18, 2, 8, 2, fur, 0.06); s.box(9, 18, 2, 8, 2, dark, 0.06);
  };
  SK.cat = s => {
    const f = 0xd89a4a, d = 0xa86a2a;
    const F = s.box(0, 0, 5, 4, 5, f, 0.08); s.px(F.front[0] + 1, F.front[1] + 1, 0x4ab84a); s.px(F.front[0] + 3, F.front[1] + 1, 0x4ab84a);
    s.box(0, 24, 3, 2, 2, 0xf0e0d0, 0.04); s.box(0, 10, 1, 1, 2, f, 0.05); s.box(6, 10, 1, 1, 2, f, 0.05);
    const B = s.box(20, 0, 4, 16, 6, f, 0.08); for (let i = 0; i < 16; i += 3) s.fill(B.top[0], B.top[1] + i, 4, 1, d, 0.05);
    s.box(0, 15, 1, 8, 1, f, 0.05); s.box(4, 15, 1, 8, 1, d, 0.05); s.box(8, 13, 2, 6, 2, f, 0.05); s.box(40, 0, 2, 10, 2, f, 0.05);
  };
  SK.ocelot = s => { SK.cat(s); s.speckle(20, 0, 20, 22, [0xe8c060, 0xe8c060, 0x6a4a2a, 0xd8b050]); };
  const robeSkin = (s, robe, trim, o) => {
    o = o || {}; const skin = o.skin || 0xb98a6e;
    const F = s.box(0, 0, 8, 10, 8, skin, 0.05); const fx = F.front[0], fy = F.front[1];
    s.fill(fx, fy + 3, 8, 1, o.brow || 0x5a3a2a, 0); s.px(fx + 1, fy + 4, 0xffffff); s.px(fx + 2, fy + 4, o.eye || 0x2a8a2a); s.px(fx + 5, fy + 4, o.eye || 0x2a8a2a); s.px(fx + 6, fy + 4, 0xffffff);
    if (o.hair !== null) { s.fill(F.top[0], F.top[1], 8, 8, o.hair || 0x6a4a2a, 0.08); }
    s.box(24, 0, 2, 4, 2, sc(skin, 0.92), 0.04);
    s.box(16, 20, 8, 12, 6, robe, 0.07); s.box(0, 38, 8, 20, 6, robe, 0.08);
    const J = s.faces(0, 38, 8, 20, 6); s.fill(J.front[0] + 3, J.front[1], 2, 20, trim, 0.05);
    s.box(44, 22, 4, 8, 4, robe, 0.07); s.box(40, 38, 8, 4, 4, robe, 0.07); const A2 = s.faces(44, 22, 4, 8, 4); s.fill(A2.bottom[0], A2.bottom[1], 4, 4, skin, 0.04);
    s.box(0, 22, 4, 12, 4, o.legs || 0x4a3a2a, 0.07);
    if (o.hat) o.hat(s);
  };
  SK.villager = s => robeSkin(s, 0x7a5a3a, 0x5a3e26);
  SK.wandering_trader = s => robeSkin(s, 0x2a4a9a, 0xd8b84a, { legs: 0x1a2a5a });
  SK.witch = s => robeSkin(s, 0x3a2a4a, 0x6a2a8a, { skin: 0x9aa47a, eye: 0x8a2aa0, hat: S2 => { /* the hat lives in its own texture area */ } });
  SK.iron_golem = s => {
    const c = 0xcdc6ba, d = 0xa9a294, vine = 0x4a7a2a;
    const F = s.box(0, 0, 8, 10, 8, c, 0.07); const fx = F.front[0], fy = F.front[1]; s.fill(fx, fy + 3, 8, 1, d, 0); s.px(fx + 2, fy + 4, 0x9a1010); s.px(fx + 5, fy + 4, 0x9a1010); s.box(24, 0, 2, 4, 2, d, 0.06);
    const B = s.box(0, 40, 18, 12, 11, c, 0.08); s.speckle(B.front[0], B.front[1], 18, 12, [c, c, c, d, vine]);
    s.box(0, 70, 9, 5, 6, d, 0.08);
    const RA = s.box(60, 21, 4, 30, 6, c, 0.08); s.speckle(RA.right[0], RA.right[1], 6, 30, [c, c, d, vine, c]);
    s.box(60, 58, 4, 30, 6, c, 0.08); s.box(37, 0, 6, 16, 5, c, 0.08); s.box(60, 0, 6, 16, 5, c, 0.08);
  };
  SK.snow_golem = s => {
    const sn = 0xf4fbfb;
    const F = s.box(0, 0, 8, 8, 8, 0xe08a20, 0.08); const fx = F.front[0], fy = F.front[1];
    s.pat(fx, fy, ['........', '........', '.##..##.', '.##..##.', '........', '.#....#.', '..####..', '........'], { '#': 0x6a3a10 });
    s.box(0, 16, 10, 10, 10, sn, 0.04); s.box(0, 36, 12, 12, 12, sn, 0.04); s.box(32, 0, 1, 10, 1, 0x6a4a2a, 0.05);
  };
  SK.slime = (s, o) => {
    o = o || {}; const c = o.c || 0x7cc65f, d = o.d || 0x5aa040;
    s.box(0, 0, 8, 8, 8, c, 0.06); s.box(0, 16, 6, 6, 6, d, 0.06);
    s.box(32, 0, 2, 2, 2, o.eye || 0x1f3a1a, 0); s.box(32, 4, 2, 2, 2, o.eye || 0x1f3a1a, 0); s.box(32, 8, 1, 1, 1, o.eye || 0x1f3a1a, 0);
  };
  SK.magma_cube = s => {
    for (let k = 0; k < 8; k++) { const F = s.box(0, k, 8, 1, 8, 0x3a0a0a, 0.15); void F; }
    s.speckle(0, 0, 32, 16, [0x3a0a0a, 0x5a1a0a, 0x2a0505, 0xc84a10]); s.speckle(8, 8, 8, 8, [0x3a0a0a, 0xf0a020, 0x5a1a0a, 0xff6a10]);
    s.box(24, 40, 4, 4, 4, 0xffa020, 0.1);
  };

  // ---------------------------------------------------------------- model definitions
  def('player', 64, 64, humanoidParts({ tall64: true }), { anim: 'humanoid', skin: SK.player, scale: 0.9375 });
  def('zombie', 64, 64, humanoidParts({ tall64: true }), { anim: 'zombie', skin: SK.zombie });
  def('husk', 64, 64, humanoidParts({ tall64: true }), { anim: 'zombie', skin: SK.husk, scale: 1.0625 });
  def('drowned', 64, 64, humanoidParts({ tall64: true }), { anim: 'zombie', skin: SK.drowned });
  def('zombie_villager', 64, 64, villagerParts().map(p => p.n === 'arms' ? P('right_arm', [-5, 2, 0], 0, [[44, 22, -3, -2, -2, 4, 12, 4]]) : p).concat([P('left_arm', [5, 2, 0], 0, [[44, 22, -1, -2, -2, 4, 12, 4, 0, true]])]), { anim: 'zombie', skin: s => robeSkin(s, 0x5a6a3a, 0x3a4a2a, { skin: 0x5a8a3a, hair: 0x3a6a2a, eye: 0x1a2a10 }) });
  def('skeleton', 64, 32, skeletonParts(), { anim: 'skeleton', skin: SK.skeleton });
  def('stray', 64, 32, skeletonParts(), { anim: 'skeleton', skin: SK.stray });
  def('bogged', 64, 32, skeletonParts(), { anim: 'skeleton', skin: SK.bogged });
  def('wither_skeleton', 64, 32, skeletonParts(), { anim: 'skeleton', skin: SK.wither_skeleton, scale: 1.2 });
  def('creeper', 64, 32, [
    P('head', [0, 6, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8]]), P('body', [0, 6, 0], 0, [[16, 16, -4, 0, -2, 8, 12, 4]]),
    P('right_hind_leg', [-2, 18, 4], 0, [[0, 16, -2, 0, -2, 4, 6, 4]]), P('left_hind_leg', [2, 18, 4], 0, [[0, 16, -2, 0, -2, 4, 6, 4]]),
    P('right_front_leg', [-2, 18, -4], 0, [[0, 16, -2, 0, -2, 4, 6, 4]]), P('left_front_leg', [2, 18, -4], 0, [[0, 16, -2, 0, -2, 4, 6, 4]]),
  ], { anim: 'creeper', skin: SK.creeper });
  const spiderParts = () => {
    const legs = [];
    for (const [n, z] of [['hind', 2], ['middle_hind', 1], ['middle_front', 0], ['front', -1]]) {
      legs.push(P('right_' + n + '_leg', [-4, 15, z], 0, [[18, 0, -15, -1, -1, 16, 2, 2]]));
      legs.push(P('left_' + n + '_leg', [4, 15, z], 0, [[18, 0, -1, -1, -1, 16, 2, 2]]));
    }
    return [P('head', [0, 15, -3], 0, [[32, 4, -4, -4, -8, 8, 8, 8]]), P('body0', [0, 15, 0], 0, [[0, 0, -3, -3, -3, 6, 6, 6]]), P('body1', [0, 15, 9], 0, [[0, 12, -5, -4, -6, 10, 8, 12]])].concat(legs);
  };
  def('spider', 64, 32, spiderParts(), { anim: 'spider', skin: SK.spider });
  def('cave_spider', 64, 32, spiderParts(), { anim: 'spider', skin: SK.cave_spider, scale: 0.7 });
  def('enderman', 64, 32, [
    P('head', [0, -13, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8]], [P('hat', [0, 0, 0], 0, [[0, 16, -4, -8, -4, 8, 8, 8, -0.5]])]),
    P('body', [0, -14, 0], 0, [[32, 16, -4, 0, -2, 8, 12, 4]]),
    P('right_arm', [-5, -12, 0], 0, [[56, 0, -1, -2, -1, 2, 30, 2]]), P('left_arm', [5, -12, 0], 0, [[56, 0, -1, -2, -1, 2, 30, 2, 0, true]]),
    P('right_leg', [-2, -5, 0], 0, [[56, 0, -1, 0, -1, 2, 29, 2]]), P('left_leg', [2, -5, 0], 0, [[56, 0, -1, 0, -1, 2, 29, 2, 0, true]]),
  ], { anim: 'enderman', skin: SK.enderman });
  def('pig', 64, 32, [
    P('head', [0, 12, -6], 0, [[0, 0, -4, -4, -8, 8, 8, 8], [16, 16, -2, 0, -9, 4, 3, 1]]),
    P('body', [0, 11, 2], [PI / 2, 0, 0], [[28, 8, -5, -10, -7, 10, 16, 8]]),
  ].concat(quadLegs(0, 16, 4, 6, 4, 3, 7, -5, 18)), { anim: 'quadruped', skin: SK.pig, babyHead: 4 });
  const cowParts = () => [
    P('head', [0, 4, -8], 0, [[0, 0, -4, -4, -6, 8, 8, 6], [22, 0, -5, -5, -4, 1, 3, 1], [22, 0, 4, -5, -4, 1, 3, 1]]),
    P('body', [0, 5, 2], [PI / 2, 0, 0], [[18, 4, -6, -10, -7, 12, 18, 10], [52, 0, -2, 2, -8, 4, 6, 1]]),
  ].concat(quadLegs(0, 16, 4, 12, 4, 4, 7, -6, 12, true));
  def('cow', 64, 32, cowParts(), { anim: 'quadruped', skin: SK.cow, babyHead: 4 });
  def('mooshroom', 64, 32, cowParts(), { anim: 'quadruped', skin: SK.mooshroom, babyHead: 4 });
  def('sheep', 64, 32, [
    P('head', [0, 6, -8], 0, [[0, 0, -3, -4, -6, 6, 6, 8]]), P('body', [0, 5, 2], [PI / 2, 0, 0], [[28, 8, -4, -10, -7, 8, 16, 6]]),
  ].concat(quadLegs(0, 16, 4, 12, 4, 3, 7, -5, 12)), { anim: 'quadruped', skin: SK.sheep, babyHead: 8 });
  def('sheep_fur', 64, 32, [
    P('head', [0, 6, -8], 0, [[0, 0, -3, -4, -4, 6, 6, 6, 0.6]]), P('body', [0, 5, 2], [PI / 2, 0, 0], [[28, 8, -4, -10, -7, 8, 16, 6, 1.75]]),
  ].concat(quadLegs(0, 16, 4, 6, 4, 3, 7, -5, 12).map(l => { l.b[0][8] = 0.5; return l; })), { anim: 'quadruped', skin: SK.sheep_fur });
  def('chicken', 64, 32, [
    P('head', [0, 15, -4], 0, [[0, 0, -2, -6, -2, 4, 6, 3]]), P('beak', [0, 15, -4], 0, [[14, 0, -2, -4, -4, 4, 2, 2]]), P('red_thing', [0, 15, -4], 0, [[14, 4, -1, -2, -3, 2, 2, 2]]),
    P('body', [0, 16, 0], [PI / 2, 0, 0], [[0, 9, -3, -4, -3, 6, 8, 6]]),
    P('right_leg', [-2, 19, 1], 0, [[26, 0, -1, 0, -3, 3, 5, 3]]), P('left_leg', [1, 19, 1], 0, [[26, 0, -1, 0, -3, 3, 5, 3]]),
    P('right_wing', [-4, 13, 0], 0, [[24, 13, 0, 0, -3, 1, 4, 6]]), P('left_wing', [4, 13, 0], 0, [[24, 13, -1, 0, -3, 1, 4, 6]]),
  ], { anim: 'chicken', skin: SK.chicken, babyHead: 5 });
  def('wolf', 64, 32, [
    P('head', [-1, 13.5, -7], 0, [], [P('real_head', [0, 0, 0], 0, [[0, 0, -2, -3, -2, 6, 6, 4], [16, 14, -2, -5, 0, 2, 2, 1], [16, 14, 2, -5, 0, 2, 2, 1], [0, 10, -0.5, -0.001, -5, 3, 3, 4]])]),
    P('body', [0, 14, 2], [PI / 2, 0, 0], [[18, 14, -3, -2, -3, 6, 9, 6]]),
    P('upper_body', [-1, 14, -3], [PI / 2, 0, 0], [[21, 0, -3, -3, -3, 8, 6, 7]]),
    P('right_hind_leg', [-2.5, 16, 7], 0, [[0, 18, 0, 0, -1, 2, 8, 2]]), P('left_hind_leg', [0.5, 16, 7], 0, [[0, 18, 0, 0, -1, 2, 8, 2]]),
    P('right_front_leg', [-2.5, 16, -4], 0, [[0, 18, 0, 0, -1, 2, 8, 2]]), P('left_front_leg', [0.5, 16, -4], 0, [[0, 18, 0, 0, -1, 2, 8, 2]]),
    P('tail', [-1, 12, 8], [PI / 5, 0, 0], [[9, 18, 0, 0, -1, 2, 8, 2]]),
  ], { anim: 'wolf', skin: SK.wolf, babyHead: 4 });
  const catParts = () => [
    P('head', [0, 15, -9], 0, [[0, 0, -2.5, -2, -3, 5, 4, 5], [0, 24, -1.5, -0.001, -4, 3, 2, 2], [0, 10, -2, -3, 0, 1, 1, 2], [6, 10, 1, -3, 0, 1, 1, 2]]),
    P('body', [0, 12, -10], [PI / 2, 0, 0], [[20, 0, -2, 3, -8, 4, 16, 6]]),
    P('tail1', [0, 15, 8], [0.9, 0, 0], [[0, 15, -0.5, 0, 0, 1, 8, 1]]), P('tail2', [0, 20, 14], 0, [[4, 15, -0.5, 0, 0, 1, 8, 1]]),
    P('left_hind_leg', [1.1, 18, 5], 0, [[8, 13, -1, 0, 1, 2, 6, 2]]), P('right_hind_leg', [-1.1, 18, 5], 0, [[8, 13, -1, 0, 1, 2, 6, 2]]),
    P('left_front_leg', [1.2, 14.1, -5], 0, [[40, 0, -1, 0, 0, 2, 10, 2]]), P('right_front_leg', [-1.2, 14.1, -5], 0, [[40, 0, -1, 0, 0, 2, 10, 2]]),
  ];
  def('cat', 64, 32, catParts(), { anim: 'cat', skin: SK.cat, scale: 0.8, babyHead: 2 });
  def('ocelot', 64, 32, catParts(), { anim: 'cat', skin: SK.ocelot, babyHead: 2 });
  def('villager', 64, 64, villagerParts({ rim: false }), { anim: 'villager', skin: SK.villager, scale: 0.9375, babyHead: 3 });
  def('wandering_trader', 64, 64, villagerParts({ rim: false }), { anim: 'villager', skin: SK.wandering_trader, scale: 0.9375 });
  // professions: the robe, its trim and the hat each one wears over the villager
  const hatTop = (col, rows, band) => S2 => { const H = S2.faces(32, 0, 8, 10, 8); S2.fill(H.top[0], H.top[1], 8, 8, col, 0.08); for (const f of ['front', 'back', 'left', 'right']) { S2.fill(H[f][0], H[f][1], f === 'left' || f === 'right' ? 8 : 8, rows, col, 0.08); if (band) S2.fill(H[f][0], H[f][1] + rows - 1, 8, 1, band, 0.05); } };
  const rimHat = col => S2 => { S2.fill(30, 47, 16, 16, col, 0.1); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 8) S2.px(30 + x, 47 + y, 0, 0); } };
  const PROF = {
    farmer: [0x8a6a3a, 0x5a3e26, { hat: S2 => { hatTop(0xd8c070, 2)(S2); rimHat(0xd8c070)(S2); } }, true],
    fisherman: [0x5a6e4a, 0x3a4a2a, { hat: S2 => { hatTop(0xc8b070, 3)(S2); rimHat(0xb8a060)(S2); } }, true],
    shepherd: [0x9a7a5a, 0xe8e0d0, { hat: hatTop(0xe8e0d0, 3, 0x7a5a3a) }],
    fletcher: [0x8a7a5a, 0x5a8a3a, { hat: hatTop(0x6a4a2a, 2, 0xd84a3a) }],
    librarian: [0xe8e4d8, 0x8a2a2a, { hat: hatTop(0xa02020, 4, 0x3a1a1a) }],
    cartographer: [0x8a6a3a, 0xd8b44a, { hat: hatTop(0x5a4a3a, 2), eye: 0xd8b44a }],
    cleric: [0x6a2a8a, 0xd8b44a, { hat: hatTop(0x6a2a8a, 3) }],
    armorer: [0x3a3a3a, 0x8a8a8a, { hat: hatTop(0x2a2a2a, 5, 0x6a6a6a) }],
    weaponsmith: [0x3a2a2a, 0x1a1a1a, { hat: hatTop(0x1a1a1a, 2) }],
    toolsmith: [0x4a4a4a, 0x2a2a2a, { hat: hatTop(0x2a2a2a, 2) }],
    butcher: [0xe8e8e0, 0xc03030, { hat: hatTop(0xc03030, 2) }],
    leatherworker: [0x8a4a2a, 0x5a2a1a, { hat: hatTop(0x6a3a1a, 2) }],
    mason: [0x3a3a3a, 0xd8d8d8, { hat: hatTop(0x2a2a2a, 2) }],
    nitwit: [0x3a7a3a, 0x2a5a2a, {}],
  };
  for (const k in PROF) { const [robe, trim, o, rim] = PROF[k]; def('villager_' + k, 64, 64, villagerParts({ rim: !!rim }), { anim: 'villager', skin: s => robeSkin(s, robe, trim, o), scale: 0.9375, babyHead: 3 }); }
  def('witch', 64, 128, villagerParts({ rim: false }).map(p => { if (p.n === 'head') p.c.push(P('witch_hat', [-5, -10.03125, -5], 0, [[0, 64, 0, 0, 0, 10, 2, 10]], [P('hat2', [1.75, -4, 2], [-0.05235988, 0, 0.02617994], [[0, 76, 0, 0, 0, 7, 4, 7]], [P('hat3', [1.75, -4, 2], [-0.10471976, 0, 0.05235988], [[0, 87, 0, 0, 0, 4, 4, 4]], [P('hat4', [1.75, -2, 2], [-0.20943952, 0, 0.10471976], [[0, 95, 0, 0, 0, 1, 2, 1, 0.25]])])])])); return p; }),
    { anim: 'villager', skin: s => { SK.witch(s); s.box(0, 64, 10, 2, 10, 0x2a2a3a, 0.08); s.box(0, 76, 7, 4, 7, 0x2a2a3a, 0.08); s.box(0, 87, 4, 4, 4, 0x2a2a3a, 0.08); s.box(0, 95, 1, 2, 1, 0x2a2a3a, 0.08); const H2 = s.faces(0, 76, 7, 4, 7); s.fill(H2.front[0], H2.front[1] + 3, 7, 1, 0x4a8a2a, 0); }, scale: 0.9375 });
  def('iron_golem', 128, 128, [
    P('head', [0, -7, -2], 0, [[0, 0, -4, -12, -5.5, 8, 10, 8], [24, 0, -1, -5, -7.5, 2, 4, 2]]),
    P('body', [0, -7, 0], 0, [[0, 40, -9, -2, -6, 18, 12, 11], [0, 70, -4.5, 10, -3, 9, 5, 6, 0.5]]),
    P('right_arm', [0, -7, 0], 0, [[60, 21, -13, -2.5, -3, 4, 30, 6]]), P('left_arm', [0, -7, 0], 0, [[60, 58, 9, -2.5, -3, 4, 30, 6]]),
    P('right_leg', [-4, 11, 0], 0, [[37, 0, -3.5, -3, -3, 6, 16, 5]]), P('left_leg', [5, 11, 0], 0, [[60, 0, -3.5, -3, -3, 6, 16, 5, 0, true]]),
  ], { anim: 'golem', skin: SK.iron_golem });
  def('snow_golem', 64, 64, [
    P('head', [0, 4, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8, -0.5]]),
    P('upper_body', [0, 13, 0], 0, [[0, 16, -5, -10, -5, 10, 10, 10, -0.5]]), P('lower_body', [0, 24, 0], 0, [[0, 36, -6, -12, -6, 12, 12, 12, -0.5]]),
    P('right_arm', [-5, 6, 1], [0, 0, 1], [[32, 0, -1, 0, -1, 12, 2, 2, -0.5]]), P('left_arm', [5, 6, -1], [0, PI, -1], [[32, 0, -1, 0, -1, 12, 2, 2, -0.5]]),
  ], { anim: null, skin: s => { SK.snow_golem(s); s.box(32, 0, 12, 2, 2, 0x6a4a2a, 0.06); } });
  def('slime', 64, 32, [
    P('cube', [0, 0, 0], 0, [[0, 16, -3, 17, -3, 6, 6, 6]]),
    P('right_eye', [0, 0, 0], 0, [[32, 0, -3.25, 18, -3.5, 2, 2, 2]]), P('left_eye', [0, 0, 0], 0, [[32, 4, 1.25, 18, -3.5, 2, 2, 2]]), P('mouth', [0, 0, 0], 0, [[32, 8, 0, 21, -3.5, 1, 1, 1]]),
    P('outer', [0, 0, 0], 0, [[0, 0, -4, 16, -4, 8, 8, 8]], [], true),
  ], { anim: 'slime', skin: SK.slime });
  def('magma_cube', 64, 32, [0, 1, 2, 3, 4, 5, 6, 7].map(k => P('cube' + k, [0, 0, 0], 0, [[0, k, -4, 16 + k, -4, 8, 1, 8]])).concat([P('inside_cube', [0, 0, 0], 0, [[24, 40, -2, 18, -2, 4, 4, 4]])]), { anim: 'slime', skin: SK.magma_cube });

  // the arrow: a shaft, a head and fletching (tip toward -z)
  def('arrow', 32, 32, [P('shaft', [0, 0, 0], 0, [[0, 0, -0.5, -0.5, -7, 1, 1, 14]]), P('head', [0, 0, 0], 0, [[0, 16, -1, -1, -9, 2, 2, 2]]), P('fletch', [0, 0, 0], 0, [[0, 22, -1.5, 0, 5, 3, 0, 3], [8, 22, 0, -1.5, 5, 0, 3, 3]])], { skin: s => { s.box(0, 0, 1, 1, 14, 0x6a4a2a, 0.1); s.box(0, 16, 2, 2, 2, 0x9a9a9a, 0.08); s.fill(0, 22, 16, 6, 0xe8e8e8, 0.05); } });
  // ---------------------------------------------------------------- textures
  const texCache = new Map();
  function texture(name) {
    let t = texCache.get(name); if (t) return t;
    const d = DEFS[name]; const s = new Skin.S(d.tw, d.th);
    (d.skin || (() => s.fill(0, 0, d.tw, d.th, 0xff00ff, 0)))(s);
    t = new THREE.CanvasTexture(s.c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.canvas = s.c;
    texCache.set(name, t);
    return t;
  }
  function create(name, mat, matT) { return new Instance(DEFS[name], mat, matT); }
  return { DEFS, A, P, def, create, texture, Instance, boxGeometry, humanoidParts, skeletonParts, villagerParts, quadLegs, SK, robeSkin, cowSkin, headFace };
})();
