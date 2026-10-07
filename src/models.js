'use strict';
/* Creature models. Every box gets a per-pixel painted skin at a constant 16 texels per block (fur, patches,
   stripes, eyes...). A creature's skins are packed into one atlas and its boxes are merged per joint, so a
   detailed, jointed animal costs only one draw call per moving part. All designs are original. */
const MODEL_CACHE = {};
const _h3 = (x, y, z, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function mnoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1; r += _h3(xi + dx, yi + dy, zi + dz, s) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
  return r;
}
const _rgb = h => typeof h === 'number' ? [(h >> 16) & 255, (h >> 8) & 255, h & 255] : h;
function _hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// skin spec: { c, n noise, hair streaks, lump curls, grad side-darkening, top/bot face light, patch:{c,s,t}, patch2,
//              stripe:{c,axis,p,w,wob}, speck:{c,p}, zones:[[c,(x,y,z,ctx)=>bool]], foot:{c,px}, rim:{c,px} }
function SK(c, o) { return Object.assign({ c, n: 0.07 }, o || {}); }
function paintSkin(sp, c) {
  let col = _rgb(sp.c);
  if (sp.patch && mnoise(c.x / sp.patch.s + 11, c.y / sp.patch.s, c.z / sp.patch.s, c.seed + 7) > sp.patch.t) col = _rgb(sp.patch.c);
  if (sp.patch2 && mnoise(c.x / sp.patch2.s, c.y / sp.patch2.s + 5, c.z / sp.patch2.s, c.seed + 19) > sp.patch2.t) col = _rgb(sp.patch2.c);
  if (sp.stripe) { const st = sp.stripe, wob = st.wob ? (mnoise(c.x * 4, c.y * 4, c.z * 4, c.seed) - 0.5) * st.wob : 0; const val = c[st.axis] / st.p + wob; if (val - Math.floor(val) < st.w) col = _rgb(st.c); }
  if (sp.speck && _h3(c.u * 3 + 1, c.v * 7, c.f * 13 + c.bi, c.seed) < sp.speck.p) col = _rgb(sp.speck.c);
  if (sp.zones) for (const [zc, test] of sp.zones) if (test(c.x, c.y, c.z, c)) { col = _rgb(zc); break; }
  if (sp.foot && (c.f === 3 || (c.f !== 2 && c.v >= c.H - sp.foot.px))) col = _rgb(sp.foot.c);
  if (sp.rim && c.f !== 2 && c.f !== 3 && c.v < sp.rim.px) col = _rgb(sp.rim.c);
  let b = 1 + (_h3(c.u, c.v, c.f + c.bi * 8, c.seed) - 0.5) * 2 * sp.n;
  if (sp.hair) b *= 1 + (_h3(c.u + c.bi * 31, Math.floor(c.v / 3), c.f, c.seed + 3) - 0.5) * sp.hair;
  if (sp.lump) b *= 1 + (mnoise(c.x * 9, c.y * 9, c.z * 9, c.seed + 1) - 0.5) * sp.lump;
  if (c.f === 2) b *= sp.top === undefined ? 1.05 : sp.top;
  else if (c.f === 3) b *= sp.bot === undefined ? 0.78 : sp.bot;
  else if (sp.grad) b *= 1 - sp.grad * (c.v + 0.5) / c.H;
  return [col[0] * b, col[1] * b, col[2] * b];
}
const FACE_KEY = { S: [0, 1], F: [4], K: [5], T: [2], B: [3] };

// ---------------------------------------------------------------- builder
function buildCreature(key, m, fn) {
  const root = new THREE.Group();
  const st = { groups: [root], boxes: [], density: 16, lidG: new Map(), lids: [] };
  const api = {
    root,
    g(parent, x, y, z, rx, ry, rz) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); g.rotation.set(rx || 0, ry || 0, rz || 0); (parent || root).add(g); st.groups.push(g); return g; },
    box(parent, w, h, d, x, y, z, sk, o) {
      parent = parent || root; o = o || {};
      st.boxes.push({ p: parent, w, h, d, x, y, z, sk, o });
      if (o.eyes) for (const e of o.eyes) {
        if (e.glow) { // glowing eyes: small emissive cubes standing proud of the face
          const pxw = w / Math.max(1, Math.round(w * st.density)), pxh = h / Math.max(1, Math.round(h * st.density));
          const ew = e.w * pxw, eh = e.h * pxh;
          for (const s of e.side ? [1, -1] : (e.m === false ? [1] : [1, -1])) {
            if (e.side) { const pxd = d / Math.max(1, Math.round(d * st.density)); st.boxes.push({ p: parent, w: 0.02, h: eh, d: e.w * pxd, x: x + s * (w / 2 + 0.008), y: y + h / 2 - (e.v + e.h / 2) * pxh, z: z + d / 2 - (e.u + e.w / 2) * pxd, sk: SK(e.c, { n: 0.05 }), o: { glow: true } }); }
            else { const cx = -w / 2 + (e.u + e.w / 2) * pxw; st.boxes.push({ p: parent, w: ew, h: eh, d: 0.02, x: x + (s === 1 ? cx : -cx), y: y + h / 2 - (e.v + e.h / 2) * pxh, z: z + d / 2 + 0.008, sk: SK(e.c, { n: 0.05 }), o: { glow: true } }); }
          }
          continue;
        }
        if (o.lids === false) continue;
        let lg = st.lidG.get(parent); if (!lg) { lg = api.g(parent); lg.visible = false; st.lidG.set(parent, lg); st.lids.push(lg); }
        const lidSk = e.lid ? SK(e.lid, { n: 0.04 }) : Object.assign({}, sk, { patch: null, patch2: null, speck: null, stripe: null, zones: sk.zones });
        if (e.side) {
          const pxd = d / Math.max(1, Math.round(d * st.density)), pxh = h / Math.max(1, Math.round(h * st.density));
          for (const s of [1, -1]) st.boxes.push({ p: lg, w: 0.02, h: e.h * pxh + 0.01, d: e.w * pxd + 0.01, x: x + s * (w / 2 + 0.01), y: y + h / 2 - (e.v + e.h / 2) * pxh, z: z + d / 2 - (e.u + e.w / 2) * pxd, sk: lidSk, o: {} });
        } else {
          const pxw = w / Math.max(1, Math.round(w * st.density)), pxh = h / Math.max(1, Math.round(h * st.density));
          const cx = -w / 2 + (e.u + e.w / 2) * pxw;
          for (const s of e.m === false ? [1] : [1, -1]) st.boxes.push({ p: lg, w: e.w * pxw + 0.01, h: e.h * pxh + 0.01, d: 0.02, x: x + s * cx, y: y + h / 2 - (e.v + e.h / 2) * pxh, z: z + d / 2 + 0.01, sk: lidSk, o: {} });
        }
      }
    },
    limb(parent, w, h, d, x, y, z, sk, o) { const g = api.g(parent, x, y, z); api.box(g, w, h, d, 0, -h / 2, 0, sk, o); return g; },
    density(v) { st.density = v; },
  };
  fn(api, m);
  m.lids = st.lids;
  root.updateMatrixWorld(true);
  let cache = MODEL_CACHE[key];
  if (!cache) cache = MODEL_CACHE[key] = bakeCreature(st, key);
  const mats = [
    cache.used[0] ? new THREE.MeshLambertMaterial({ map: cache.tex }) : null,
    cache.used[1] ? new THREE.MeshBasicMaterial({ map: cache.tex }) : null,
    cache.used[2] ? new THREE.MeshLambertMaterial({ map: cache.tex, transparent: true, opacity: 0.62, depthWrite: false }) : null,
  ];
  if (mats[1]) mats[1].userData.emissive = true;
  for (let i = 0; i < st.groups.length; i++) {
    const geos = cache.geos[i]; if (!geos) continue;
    for (let k = 0; k < 3; k++) if (geos[k]) { const mesh = new THREE.Mesh(geos[k], mats[k]); if (k === 2) mesh.renderOrder = 2; st.groups[i].add(mesh); }
  }
  m.mats = mats.filter(Boolean);
  return root;
}
function bakeCreature(st, key) {
  const seed = _hashStr(key) & 0xffff;
  const faces = [];
  st.boxes.forEach((b, bi) => {
    const D = b.o.density || st.density;
    const pw = v => Math.max(1, Math.min(64, Math.round(v * D)));
    const dims = [[b.d, b.h], [b.d, b.h], [b.w, b.d], [b.w, b.d], [b.w, b.h], [b.w, b.h]];
    b.faces = dims.map(([a, c], f) => { const fc = { b, bi, f, W: pw(a), H: pw(c) }; faces.push(fc); return fc; });
  });
  let area = 0; for (const f of faces) area += (f.W + 1) * (f.H + 1);
  let AW = 64; while (AW * AW < area * 1.5 && AW < 2048) AW *= 2;
  const order = faces.slice().sort((a, b) => b.H - a.H);
  let x = 0, y = 0, rowH = 0;
  for (const f of order) { if (x + f.W > AW) { x = 0; y += rowH + 1; rowH = 0; } f.ax = x; f.ay = y; x += f.W + 1; rowH = Math.max(rowH, f.H); }
  let AH = 16; while (AH < y + rowH + 1) AH *= 2;
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const g2 = cv.getContext('2d'), img = g2.createImageData(AW, AH), data = img.data;
  const v3 = new THREE.Vector3();
  for (const fc of faces) {
    const b = fc.b, sp = b.sk, W = fc.W, H = fc.H, f = fc.f;
    const ovs = [];
    for (const e of b.o.eyes || []) {
      if (e.glow) continue;
      const fk = e.side ? 'S' : 'F';
      ovs.push([fk, e.u, e.v, e.w, e.h, e.c, e.m !== false]);
      if (e.p) ovs.push([fk, e.side ? e.u : e.u + e.w - 1, e.v + (e.ph ? e.h - e.ph : 0), 1, e.ph || e.h, e.p, e.m !== false]);
      if (e.g) ovs.push([fk, e.side ? e.u + e.w - 1 : e.u, e.v, 1, 1, e.g, e.m !== false]);
    }
    if (b.o.ov) for (const o of b.o.ov) ovs.push(o);
    const ctx = { f, W, H, u: 0, v: 0, x: 0, y: 0, z: 0, seed, bi: fc.bi };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const tu = (i + 0.5) / W, tv = (j + 0.5) / H;
      let lx, ly, lz;
      switch (f) {
        case 0: lx = b.w / 2; lz = b.d / 2 - tu * b.d; ly = b.h / 2 - tv * b.h; break;
        case 1: lx = -b.w / 2; lz = -b.d / 2 + tu * b.d; ly = b.h / 2 - tv * b.h; break;
        case 2: ly = b.h / 2; lx = -b.w / 2 + tu * b.w; lz = -b.d / 2 + tv * b.d; break;
        case 3: ly = -b.h / 2; lx = -b.w / 2 + tu * b.w; lz = b.d / 2 - tv * b.d; break;
        case 4: lz = b.d / 2; lx = -b.w / 2 + tu * b.w; ly = b.h / 2 - tv * b.h; break;
        default: lz = -b.d / 2; lx = b.w / 2 - tu * b.w; ly = b.h / 2 - tv * b.h;
      }
      v3.set(lx + b.x, ly + b.y, lz + b.z).applyMatrix4(b.p.matrixWorld);
      ctx.u = i; ctx.v = j; ctx.x = v3.x; ctx.y = v3.y; ctx.z = v3.z;
      let col = paintSkin(sp, ctx);
      // overlays: [faceKey, u, v, w, h, color, mirror]; side overlays measure u from the front edge
      for (const o of ovs) {
        const fs = FACE_KEY[o[0]]; if (!fs.includes(f)) continue;
        let uu = i; if (f === 1) uu = W - 1 - i;
        const u0 = o[1] === 'c' ? Math.floor((W - o[3]) / 2) : o[1];
        const hitA = uu >= u0 && uu < u0 + o[3] && j >= o[2] && j < o[2] + o[4];
        const hitB = o[6] && f === 4 && i >= W - u0 - o[3] && i < W - u0 && j >= o[2] && j < o[2] + o[4];
        if (hitA || hitB) col = typeof o[5] === 'function' ? o[5](i, j, W, H) : _rgb(o[5]);
      }
      const k = ((fc.ay + j) * AW + fc.ax + i) * 4;
      data[k] = Math.max(0, Math.min(255, col[0])); data[k + 1] = Math.max(0, Math.min(255, col[1])); data[k + 2] = Math.max(0, Math.min(255, col[2])); data[k + 3] = 255;
    }
  }
  g2.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  // geometry, merged per joint and per material kind
  const gIndex = new Map(st.groups.map((g, i) => [g, i]));
  const buckets = new Map();
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
  const used = [false, false, false];
  for (const b of st.boxes) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = geo.attributes.uv;
    for (const fc of b.faces) for (let k = 0; k < 4; k++) {
      const vi = fc.f * 4 + k, u0 = uv.getX(vi), v0 = uv.getY(vi);
      uv.setXY(vi, (fc.ax + 0.02 + u0 * (fc.W - 0.04)) / AW, 1 - (fc.ay + 0.02 + (1 - v0) * (fc.H - 0.04)) / AH);
    }
    e3.set(b.o.rx || 0, b.o.ry || 0, b.o.rz || 0); q.setFromEuler(e3); pos.set(b.x, b.y, b.z);
    mtx.compose(pos, q, one); geo.applyMatrix4(mtx);
    const kind = b.o.glow ? 1 : b.o.glass ? 2 : 0; used[kind] = true;
    const gi = gIndex.get(b.p), bk = gi * 3 + kind;
    if (!buckets.has(bk)) buckets.set(bk, []);
    buckets.get(bk).push(geo);
  }
  const geos = [];
  for (const [bk, list] of buckets) {
    const gi = Math.floor(bk / 3), kind = bk % 3;
    let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), IX = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let ov = 0, oi = 0;
    for (const g of list) {
      P.set(g.attributes.position.array, ov * 3); N.set(g.attributes.normal.array, ov * 3); UV.set(g.attributes.uv.array, ov * 2);
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) IX[oi + i] = ix[i] + ov;
      ov += g.attributes.position.count; oi += ix.length; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    out.setIndex(new THREE.BufferAttribute(IX, 1)); out.computeBoundingSphere();
    (geos[gi] || (geos[gi] = []))[kind] = out;
  }
  return { tex, geos, used };
}

// ---------------------------------------------------------------- shared body plans
// quadruped: legs hang from hips/shoulders with a knee joint; body, neck and head are a separate chain
function quadruped(a, m, c) {
  const P = { legs: [], ears: [] };
  const bodyTop = c.bodyY + c.bodyH;
  P.body = a.g(null, 0, c.bodyY + c.bodyH / 2, 0);
  a.box(P.body, c.bodyW, c.bodyH, c.bodyL, 0, 0, 0, c.sk.body, c.bodyO);
  const legTop = c.bodyY + (c.legIn === undefined ? 0.08 : c.legIn), L = legTop, up = L * (c.knee || 0.5), lo = L - up;
  const lx = c.legX === undefined ? c.bodyW / 2 - c.legW / 2 - 0.02 : c.legX;
  for (const [sx, z, front] of [[-1, c.legZF, true], [1, c.legZF, true], [-1, c.legZB, false], [1, c.legZB, false]]) {
    const w = front ? c.legW : (c.legWB || c.legW);
    const u = a.g(null, sx * lx, legTop, z); a.box(u, w, up + 0.02, w, 0, -up / 2, 0, c.sk.legU || Object.assign({}, c.sk.leg, { foot: null }));
    const l = a.g(u, 0, -up, 0); a.box(l, w * 0.92, lo, w * 0.92, 0, -lo / 2, 0, c.sk.leg);
    P.legs.push({ u, l, front, sx });
  }
  let headParent = P.body, hy = c.headY - (c.bodyY + c.bodyH / 2), hz = c.headZ;
  if (c.neck) {
    const n = c.neck;
    P.neck = a.g(P.body, 0, n.y - (c.bodyY + c.bodyH / 2), n.z, n.ang);
    a.box(P.neck, n.w, n.l, n.d, 0, n.l / 2 - 0.04, 0, n.sk || c.sk.body);
    if (n.mane) a.box(P.neck, n.mane[0], n.l + 0.1, n.mane[1], 0, n.l / 2, -n.d / 2 - n.mane[1] / 2 + 0.03, n.mane[2]);
    headParent = P.neck; hy = n.l - 0.06; hz = 0;
  }
  P.head = a.g(headParent, 0, hy, hz, (c.neck ? -c.neck.ang : 0) + (c.headPitch || 0));
  if (c.head) c.head(a, P.head, P);
  if (c.tail) { const t = c.tail; P.tail = a.g(P.body, 0, t.y, -c.bodyL / 2 + (t.z || 0), t.ang || 0); a.box(P.tail, t.w, t.h, t.d, 0, -t.h / 2, 0, t.sk || c.sk.body); if (t.tip) a.box(P.tail, t.w + 0.03, t.tip[0], t.d + 0.03, 0, -t.h + t.tip[0] / 2, 0, t.tip[1]); }
  if (c.extra) c.extra(a, P);
  m.P = P;
  m.A = Object.assign({ kind: 'quad', cadence: 4, stride: 0.55, knee: 0.6, bob: 0.025, graze: false, look: 0.8 }, c.anim || {});
  return P;
}
// biped: hips, torso, shoulders, head, optional elbows and knees
function biped(a, m, c) {
  const P = { legs: [], arms: [] };
  const lh = c.legH, lw = c.legW, hipX = c.hipX === undefined ? c.torso[0] / 4 : c.hipX;
  for (const sx of [-1, 1]) {
    const u = a.g(null, sx * hipX, lh, 0);
    if (c.knees) { const up = lh * 0.5; a.box(u, lw, up + 0.02, lw, 0, -up / 2, 0, c.sk.legU || Object.assign({}, c.sk.leg, { foot: null })); const l = a.g(u, 0, -up, 0); a.box(l, lw * 0.95, lh - up, lw * 0.95, 0, -(lh - up) / 2, 0, c.sk.leg, c.footO); P.legs.push({ u, l, sx }); }
    else { a.box(u, lw, lh, lw, 0, -lh / 2, 0, c.sk.leg, c.legO); P.legs.push({ u, sx }); }
  }
  const [tw, th, td] = c.torso;
  P.body = a.g(null, 0, lh, 0);
  a.box(P.body, tw, th, td, 0, th / 2, 0, c.sk.torso, c.torsoO);
  const [aw, ah] = c.arm, ad = c.armD || aw;
  for (const sx of [-1, 1]) {
    const s = a.g(P.body, sx * (tw / 2 + aw / 2 + (c.armGap || 0)), th - aw / 2, 0);
    if (c.elbows) { const up = ah * 0.5; a.box(s, aw, up + 0.02, ad, 0, -up / 2, 0, c.sk.armU || Object.assign({}, c.sk.arm, { foot: null })); const l = a.g(s, 0, -up, 0); a.box(l, aw * 0.95, ah - up, ad * 0.95, 0, -(ah - up) / 2, 0, c.sk.arm, c.handO); P.arms.push({ u: s, l, sx }); }
    else { a.box(s, aw, ah, ad, 0, -ah / 2 + aw / 2, 0, c.sk.arm, c.armO); P.arms.push({ u: s, sx }); }
  }
  P.head = a.g(P.body, 0, th, c.headZ || 0);
  if (c.head) c.head(a, P.head, P);
  if (c.extra) c.extra(a, P);
  m.P = P;
  m.A = Object.assign({ kind: 'biped', cadence: 4.2, stride: 0.7, arms: 'swing', look: 1 }, c.anim || {});
  return P;
}
// eight jointed legs: femurs rise from the body, tibias reach down to the ground
function spiderLegs(a, P, c) {
  P.legs = [];
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    const z = c.z0 - i * c.dz, spread = (1.5 - i) * c.fan;
    const u = a.g(P.body || null, sx * c.x, c.y, z, 0, -sx * spread, sx * c.lift);
    a.box(u, c.femur, c.w, c.w, sx * c.femur / 2, 0, 0, c.sk);
    const l = a.g(u, sx * c.femur, 0, 0, 0, 0, -sx * c.bend);
    a.box(l, c.tibia, c.w * 0.85, c.w * 0.85, sx * c.tibia / 2, 0, 0, c.sk2 || c.sk);
    P.legs.push({ u, l, sx, i, ry: -sx * spread, rz: sx * c.lift, lz: -sx * c.bend });
  }
}
const EYE = (u, v, w, h, c, o) => Object.assign({ u, v, w, h, c }, o || {});

// ---------------------------------------------------------------- creatures
const pick = (m, arr) => arr[m.variant % arr.length];
const NOSE = c => ['F', 'c', 0, 2, 1, c];
const CREATURES = {
  // ======== farm and field
  cow(a, m) {
    const brown = m.variant % 3 === 2;
    const body = brown ? SK(0x5e3b25, { hair: 0.22, grad: 0.12, zones: [[0xece4d8, (x, y, z) => y < 0.8 && Math.abs(x) < 0.3 && z > -0.3]] })
      : SK(0xf1eee6, { n: 0.05, hair: 0.12, grad: 0.1, patch: { c: 0x1f1c1b, s: 0.36, t: 0.56 } });
    const leg = Object.assign({}, body, { foot: { c: 0x2a2420, px: 2 } });
    const snout = SK(brown ? 0xc79a88 : 0xe8b4a8, { n: 0.05 }), horn = SK(0xe2d8c2, { rim: { c: 0x8a8070, px: 0 } });
    quadruped(a, m, {
      bodyY: 0.66, bodyH: 0.74, bodyW: 0.86, bodyL: 1.36, legW: 0.22, legZF: 0.47, legZB: -0.5, sk: { body, leg },
      headY: 1.24, headZ: 0.6,
      head(a, h, P) {
        a.box(h, 0.52, 0.46, 0.42, 0, 0, 0.16, body, { eyes: [EYE(1, 2, 2, 1, 0x241a14, { side: true, g: 0x6a5a50 })] });
        a.box(h, 0.4, 0.24, 0.14, 0, -0.1, 0.43, snout, { ov: [['F', 1, 1, 1, 2, 0x6a3a38, true], ['F', 1, 3, 4, 1, 0xb88478]] });
        for (const sx of [-1, 1]) {
          a.box(h, 0.15, 0.07, 0.07, sx * 0.32, 0.21, 0.13, horn); a.box(h, 0.06, 0.12, 0.06, sx * 0.39, 0.28, 0.13, horn, { rz: sx * 0.3 });
          const e = a.g(h, sx * 0.26, 0.1, 0.06); a.box(e, 0.16, 0.06, 0.1, sx * 0.08, 0, 0, body); P.ears.push(e);
        }
      },
      tail: { y: 0.3, w: 0.07, h: 0.62, d: 0.07, ang: 0.12, tip: [0.14, SK(brown ? 0x2a1a10 : 0x2a2624, { hair: 0.4 })] },
      extra(a, P) { a.box(P.body, 0.3, 0.12, 0.3, 0, -0.42, -0.3, SK(0xe8b0a8)); },
      anim: { cadence: 3.8, stride: 0.45, graze: true },
    });
  },
  pig(a, m) {
    const sk = SK(0xeca7a1, { n: 0.05, grad: 0.1, patch: { c: 0xd98e88, s: 0.28, t: 0.64 }, zones: [[0x8a6a4c, (x, y) => y < 0.42 && mnoise(x * 6, y * 6, 3, 9) > 0.5]] });
    const leg = Object.assign({}, sk, { zones: null, foot: { c: 0x8a5a50, px: 1 } });
    const snout = SK(0xd8877f, { n: 0.04 });
    quadruped(a, m, {
      bodyY: 0.34, bodyH: 0.52, bodyW: 0.62, bodyL: 0.94, legW: 0.17, legIn: 0.05, legZF: 0.3, legZB: -0.32, sk: { body: sk, leg },
      headY: 0.68, headZ: 0.45,
      head(a, h, P) {
        a.box(h, 0.5, 0.44, 0.4, 0, 0, 0.14, sk, { eyes: [EYE(1, 2, 2, 1, 0xf4f0f0, { p: 0x2a1a1a })] });
        a.box(h, 0.26, 0.18, 0.08, 0, -0.06, 0.38, snout, { ov: [['F', 1, 1, 1, 2, 0x7a3a3a, true]] });
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.17, 0.2, 0.2, 0.55); a.box(e, 0.15, 0.04, 0.17, 0, 0, 0.06, sk); P.ears.push(e); }
      },
      tail: { y: 0.12, w: 0.05, h: 0.14, d: 0.05, ang: -0.6 },
      extra(a, P) { a.box(P.tail, 0.05, 0.05, 0.1, 0, -0.14, -0.04, sk); },
      anim: { cadence: 6, stride: 0.55, graze: true },
    });
  },
  sheep(a, m) {
    const woolC = pick(m, [0xeeebe4, 0xeeebe4, 0xeeebe4, 0xeeebe4, 0x8e8a86, 0x5a4636, 0x2c2826, 0xeeb8c8]);
    const wool = SK(woolC, { n: 0.04, lump: 0.36, top: 1.06, bot: 0.85 }), face = SK(0x3d322b, { hair: 0.15 }), skin = SK(0xd2c2b2, { n: 0.05 });
    quadruped(a, m, {
      bodyY: 0.6, bodyH: 0.6, bodyW: 0.62, bodyL: 1.0, legW: 0.15, legX: 0.2, legZF: 0.34, legZB: -0.34, sk: { body: skin, leg: Object.assign({}, face, { foot: { c: 0x1e1814, px: 1 } }), legU: wool },
      headY: 1.08, headZ: 0.56,
      head(a, h, P) {
        a.box(h, 0.36, 0.38, 0.42, 0, 0, 0.12, face, { eyes: [EYE(2, 2, 2, 1, 0xd8c070, { side: true, p: 0x1a1410 })] });
        a.box(h, 0.42, 0.16, 0.3, 0, 0.19, 0.03, wool);
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.2, 0.06, 0.04, 0, 0, sx * 0.4); a.box(e, 0.16, 0.05, 0.09, sx * 0.08, 0, 0, face); P.ears.push(e); }
      },
      tail: { y: 0.2, w: 0.12, h: 0.18, d: 0.08, ang: 0.3, sk: wool },
      extra(a, P) { P.wool = a.g(P.body); a.box(P.wool, 0.86, 0.78, 1.16, 0, 0.05, 0, wool); },
      anim: { cadence: 4.6, stride: 0.45, graze: true },
    });
  },
  chicken(a, m) {
    const white = SK(0xf4f1ea, { n: 0.04, hair: 0.1 }), wing = SK(0xe2ddd2, { n: 0.05, stripe: { c: 0xcfc8ba, axis: 'y', p: 0.06, w: 0.25 } });
    const yel = SK(0xe8b040, { n: 0.05 }), red = SK(0xd83a30, { n: 0.06 }), beak = SK(0xe89a30, { n: 0.04 });
    const P = { legs: [], wings: [] };
    P.body = a.g(null, 0, 0.42, 0);
    a.box(P.body, 0.34, 0.34, 0.46, 0, 0, 0, white);
    a.box(P.body, 0.26, 0.22, 0.1, 0, 0.16, -0.25, white, { rx: -0.5 });
    for (const sx of [-1, 1]) {
      const w = a.g(P.body, sx * 0.185, 0.12, 0.02); a.box(w, 0.05, 0.26, 0.34, 0, -0.11, 0, wing); P.wings.push(w);
      const u = a.g(null, sx * 0.08, 0.27, 0.02); a.box(u, 0.05, 0.27, 0.05, 0, -0.13, 0, yel); a.box(u, 0.14, 0.02, 0.16, 0, -0.26, 0.04, yel); P.legs.push({ u, sx });
    }
    P.head = a.g(P.body, 0, 0.12, 0.2);
    a.box(P.head, 0.22, 0.3, 0.2, 0, 0.12, 0.03, white, { eyes: [EYE(1, 1, 1, 1, 0x161210, { side: true })] });
    a.box(P.head, 0.12, 0.07, 0.1, 0, 0.16, 0.17, beak); a.box(P.head, 0.07, 0.1, 0.04, 0, 0.07, 0.15, red); a.box(P.head, 0.04, 0.08, 0.16, 0, 0.31, 0.04, red);
    m.P = P; m.A = { kind: 'bird', cadence: 11, stride: 0.6, look: 0.9 };
  },
  rabbit(a, m) {
    const c = pick(m, [0x8a6a4e, 0x9a7a58, 0xeeeeea, 0x7e7c78, 0xd8b878]);
    const fur = SK(c, { hair: 0.15, zones: [[0xece8e0, (x, y, z) => y < 0.18 && z > 0]] }), pink = SK(0xe0a0a0);
    const P = { legs: [], ears: [] };
    P.body = a.g(null, 0, 0.25, 0);
    a.box(P.body, 0.3, 0.27, 0.42, 0, 0, 0, fur); a.box(P.body, 0.34, 0.22, 0.24, 0, -0.02, -0.1, fur);
    a.box(P.body, 0.1, 0.1, 0.08, 0, 0.06, -0.25, SK(0xf4f2ee));
    for (const sx of [-1, 1]) {
      const h = a.g(null, sx * 0.13, 0.12, -0.1); a.box(h, 0.1, 0.07, 0.28, 0, -0.08, 0.06, fur); P.legs.push({ u: h, sx, hind: true });
      const f = a.g(null, sx * 0.08, 0.17, 0.14); a.box(f, 0.07, 0.17, 0.07, 0, -0.08, 0, fur); P.legs.push({ u: f, sx });
    }
    P.head = a.g(P.body, 0, 0.12, 0.2);
    a.box(P.head, 0.24, 0.22, 0.24, 0, 0.04, 0.08, fur, { eyes: [EYE(1, 1, 1, 1, 0x1a0e0a, { side: true })], ov: [['F', 'c', 2, 1, 1, 0xd88a90]] });
    for (const sx of [-1, 1]) { const e = a.g(P.head, sx * 0.06, 0.15, 0.04, -0.15, 0, sx * 0.12); a.box(e, 0.06, 0.26, 0.04, 0, 0.13, 0, fur, { ov: [['F', 0, 1, 1, 3, 0xe0a0a8]] }); P.ears.push(e); }
    m.P = P; m.A = { kind: 'hop', hop: 5.2, look: 0.8 };
  },
  horse(a, m) {
    const v = m.variant % 6;
    const coat = [0x8a4a22, 0x5a3420, 0x2a2420, 0xe6e2da, 0x9a9a9e, 0xb88a52][v];
    const body = SK(coat, { hair: 0.14, grad: 0.1, patch: v === 4 ? { c: 0xd6d6da, s: 0.1, t: 0.6 } : null, zones: v === 1 ? [[0x1e1814, (x, y) => y < 0.62]] : null });
    const mane = SK([0x2a1810, 0x1a1210, 0x141010, 0xd8d0c4, 0x4a4a4e, 0xf0e4c8][v], { hair: 0.5, n: 0.1 });
    const leg = Object.assign({}, body, { foot: { c: 0x2a221c, px: 2 }, zones: v === 1 || v === 0 ? [[v === 1 ? 0x1e1814 : 0xeae4da, (x, y) => y < 0.3]] : null });
    const muzzle = SK(v === 3 ? 0xd8c8c0 : 0x3a2c26, { n: 0.06 });
    quadruped(a, m, {
      bodyY: 0.95, bodyH: 0.64, bodyW: 0.6, bodyL: 1.36, legW: 0.18, legIn: 0.06, legZF: 0.5, legZB: -0.5, knee: 0.5, sk: { body, leg },
      neck: { y: 1.46, z: 0.56, ang: 0.62, w: 0.26, l: 0.76, d: 0.42, mane: [0.11, 0.12, mane] },
      headPitch: 0.35,
      head(a, h, P) {
        a.box(h, 0.3, 0.3, 0.58, 0, 0.06, 0.18, body, { eyes: [EYE(2, 1, 2, 1, 0x1a1210, { side: true, g: 0x5a4a40 })] });
        a.box(h, 0.25, 0.24, 0.22, 0, 0.0, 0.52, muzzle, { ov: [['F', 1, 1, 1, 1, 0x0e0a08, true]] });
        a.box(h, 0.1, 0.1, 0.24, 0, 0.24, 0.0, mane);
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.1, 0.2, 0.0, -0.2); a.box(e, 0.07, 0.16, 0.06, 0, 0.08, 0, body); P.ears.push(e); }
      },
      tail: { y: 0.24, w: 0.14, h: 0.78, d: 0.14, ang: 0.35, sk: mane },
      anim: { cadence: 3.0, stride: 0.6, graze: true },
    });
  },
  camel(a, m) {
    const fur = SK(0xc89a5a, { hair: 0.2, grad: 0.12 }), dark = SK(0x8a6438, { hair: 0.3 });
    quadruped(a, m, {
      bodyY: 1.25, bodyH: 0.66, bodyW: 0.66, bodyL: 1.3, legW: 0.19, legIn: 0.05, legZF: 0.46, legZB: -0.46, knee: 0.5, sk: { body: fur, leg: Object.assign({}, fur, { foot: { c: 0x6a4a2a, px: 2 } }) },
      neck: { y: 1.62, z: 0.6, ang: 1.05, w: 0.26, l: 0.72, d: 0.3 },
      headPitch: -0.55,
      head(a, h, P) { a.box(h, 0.3, 0.3, 0.52, 0, 0.12, 0.18, fur, { eyes: [EYE(2, 1, 2, 1, 0x1a1210, { side: true })] }); a.box(h, 0.24, 0.2, 0.14, 0, 0.04, 0.48, dark); for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.13, 0.27, 0.02); a.box(e, 0.06, 0.1, 0.05, 0, 0.05, 0, fur); P.ears.push(e); } },
      tail: { y: 0.2, w: 0.08, h: 0.5, d: 0.08, ang: 0.15, tip: [0.15, dark] },
      extra(a, P) { a.box(P.body, 0.5, 0.42, 0.56, 0, 0.5, 0.0, fur); a.box(P.body, 0.36, 0.14, 0.4, 0, 0.75, 0.0, fur); },
      anim: { cadence: 2.6, stride: 0.6, graze: true },
    });
  },
  goat(a, m) {
    const fur = SK(0xe6e2d6, { hair: 0.25, grad: 0.1 }), horn = SK(0x8a8070, { stripe: { c: 0x6a6052, axis: 'y', p: 0.08, w: 0.3 } }), hoof = { c: 0x3a3430, px: 2 };
    quadruped(a, m, {
      bodyY: 0.62, bodyH: 0.5, bodyW: 0.5, bodyL: 0.84, legW: 0.14, legZF: 0.28, legZB: -0.28, sk: { body: fur, leg: Object.assign({}, fur, { foot: hoof }) },
      headY: 1.08, headZ: 0.42,
      head(a, h, P) {
        a.box(h, 0.3, 0.32, 0.38, 0, 0, 0.1, fur, { eyes: [EYE(1, 2, 2, 1, 0xc8a040, { side: true, p: 0x1a1410 })] });
        a.box(h, 0.08, 0.16, 0.08, 0, -0.22, 0.22, SK(0xd8d2c4, { hair: 0.4 }));
        for (const sx of [-1, 1]) {
          const hg = a.g(h, sx * 0.09, 0.16, 0.04, -0.6); a.box(hg, 0.07, 0.24, 0.07, 0, 0.12, 0, horn); a.box(hg, 0.06, 0.06, 0.16, 0, 0.24, -0.06, horn);
          const e = a.g(h, sx * 0.16, 0.06, 0.06, 0, 0, sx * 0.5); a.box(e, 0.14, 0.05, 0.08, sx * 0.07, 0, 0, fur); P.ears.push(e);
        }
      },
      tail: { y: 0.18, w: 0.08, h: 0.14, d: 0.06, ang: -0.6 },
      anim: { cadence: 4.6, stride: 0.5, graze: true },
    });
  },
  fox(a, m) {
    const snowy = m.variant % 4 === 3, c = snowy ? 0xeeeae2 : 0xd66a28;
    const white = 0xf2ece2;
    const body = SK(c, { hair: 0.2, zones: [[white, (x, y, z) => y < 0.36 && z > 0]] });
    const leg = SK(c, { hair: 0.2, foot: { c: 0x2a1a14, px: 3 } });
    quadruped(a, m, {
      bodyY: 0.3, bodyH: 0.32, bodyW: 0.34, bodyL: 0.68, legW: 0.11, legZF: 0.24, legZB: -0.24, sk: { body, leg },
      headY: 0.55, headZ: 0.36,
      head(a, h, P) {
        const hs = SK(c, { hair: 0.15, zones: [[white, (x, y) => y < 0.5]] });
        a.box(h, 0.34, 0.28, 0.26, 0, 0, 0.06, hs, { eyes: [EYE(1, 1, 1, 1, 0x241408, { g: 0xffd080 })] });
        a.box(h, 0.16, 0.12, 0.18, 0, -0.06, 0.27, hs, { ov: [['F', 'c', 0, 1, 1, 0x1a1210]] });
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.11, 0.13, 0.04); a.box(e, 0.1, 0.14, 0.04, 0, 0.07, 0, SK(c, { rim: { c: 0x2a1a14, px: 1 } })); P.ears.push(e); }
      },
      tail: { y: 0.04, w: 0.2, h: 0.56, d: 0.2, ang: 1.15, sk: SK(c, { hair: 0.4 }), tip: [0.14, SK(white, { hair: 0.3 })] },
      anim: { cadence: 6, stride: 0.55, look: 1 },
    });
  },
  wolf(a, m) {
    const body = SK(0x9b968f, { hair: 0.28, patch: { c: 0x6c6760, s: 0.24, t: 0.62 }, zones: [[0xd2cdc4, (x, y, z) => y < 0.6]] });
    const leg = SK(0xb4afa6, { hair: 0.2, foot: { c: 0x5a5650, px: 1 } });
    const P = quadruped(a, m, {
      bodyY: 0.5, bodyH: 0.42, bodyW: 0.4, bodyL: 0.8, legW: 0.13, legZF: 0.28, legZB: -0.3, knee: 0.55, sk: { body, leg },
      headY: 0.9, headZ: 0.5,
      head(a, h, P) {
        a.box(h, 0.38, 0.34, 0.3, 0, 0, 0.08, body, { eyes: [EYE(1, 2, 1, 1, 0x2a1a0a, { g: 0xe8c060 })] });
        a.box(h, 0.18, 0.15, 0.22, 0, -0.08, 0.3, SK(0xc8c2b8, { hair: 0.15 }), { ov: [['F', 'c', 0, 2, 1, 0x141010]] });
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.11, 0.16, 0.06); a.box(e, 0.1, 0.14, 0.06, 0, 0.07, 0, body); P.ears.push(e); }
        P.angry = a.g(h); P.angry.visible = false;
        for (const sx of [-1, 1]) a.box(P.angry, 0.05, 0.04, 0.02, sx * 0.1, 0.03, 0.235, SK(0xff4030), { glow: true });
      },
      tail: { y: 0.12, w: 0.12, h: 0.5, d: 0.12, ang: 0.85, sk: SK(0x8a857e, { hair: 0.4 }), tip: [0.1, SK(0xe0dbd2)] },
      extra(a, P) { a.box(P.body, 0.5, 0.5, 0.36, 0, 0.04, 0.22, SK(0xb8b2a8, { hair: 0.35 })); P.collar = a.g(P.body); P.collar.visible = false; a.box(P.collar, 0.52, 0.08, 0.38, 0, 0.12, 0.3, SK(0xc83030), { rx: -0.3 }); },
      anim: { cadence: 5, stride: 0.6, look: 1 },
    });
    return P;
  },
  cat(a, m) {
    const v = m.variant % 5;
    const base = [0x8a7a62, 0x222022, 0xd8823a, 0xeeeae4, 0xe2d6c0][v];
    const body = SK(base, { hair: 0.15, stripe: v === 0 || v === 2 ? { c: v === 0 ? 0x4a3e2e : 0xa8542a, axis: 'z', p: 0.09, w: 0.35, wob: 0.6 } : null, zones: v === 4 ? [[0x4a3a2e, (x, y, z) => z > 0.45 || z < -0.3 || y < 0.12]] : null });
    const eye = [0x8ac83a, 0xe8c040, 0x5ab040, 0x5aa8e8, 0x5aa8e8][v];
    quadruped(a, m, {
      bodyY: 0.2, bodyH: 0.22, bodyW: 0.24, bodyL: 0.56, legW: 0.08, legX: 0.08, legZF: 0.2, legZB: -0.2, sk: { body, leg: body },
      headY: 0.44, headZ: 0.32,
      head(a, h, P) {
        a.box(h, 0.31, 0.25, 0.25, 0, 0, 0.06, body, { eyes: [EYE(1, 1, 1, 1, eye, { lid: base })], ov: [['F', 2, 3, 1, 1, 0xd88a8a]] });
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.09, 0.12, 0.04); a.box(e, 0.08, 0.1, 0.04, 0, 0.05, 0, body); P.ears.push(e); }
      },
      tail: { y: 0.06, w: 0.06, h: 0.5, d: 0.06, ang: 2.5 },
      anim: { cadence: 7, stride: 0.5, look: 1 },
    });
  },
  bear(a, m) {
    const fur = SK(0x5a3a24, { hair: 0.3, grad: 0.15 }), snout = SK(0x9a7a5a, { hair: 0.1 });
    quadruped(a, m, {
      bodyY: 0.55, bodyH: 0.72, bodyW: 0.8, bodyL: 1.22, legW: 0.26, legZF: 0.4, legZB: -0.42, knee: 0.5, sk: { body: fur, leg: Object.assign({}, fur, { foot: { c: 0x2a1a10, px: 1 } }) },
      headY: 1.04, headZ: 0.62,
      head(a, h, P) {
        a.box(h, 0.46, 0.42, 0.4, 0, 0, 0.12, fur, { eyes: [EYE(1, 2, 1, 1, 0x100a08)] });
        a.box(h, 0.24, 0.2, 0.2, 0, -0.08, 0.38, snout, { ov: [['F', 'c', 0, 2, 1, 0x141010]] });
        for (const sx of [-1, 1]) { const e = a.g(h, sx * 0.18, 0.22, 0.04); a.box(e, 0.12, 0.1, 0.06, 0, 0.05, 0, fur); P.ears.push(e); }
      },
      tail: { y: 0.24, w: 0.1, h: 0.1, d: 0.08, ang: 0.6 },
      extra(a, P) { a.box(P.body, 0.72, 0.22, 0.44, 0, 0.42, 0.26, fur); },
      anim: { cadence: 3.6, stride: 0.5, look: 0.8 },
    });
  },
  frog(a, m) {
    const c = pick(m, [0x6a8a3a, 0xc8783a, 0xb8c0a0]);
    const sk = SK(c, { n: 0.08, speck: { c: 0x3a4a22, p: 0.08 }, zones: [[0xe8e0b0, (x, y) => y < 0.08]] });
    const P = { legs: [] };
    P.body = a.g(null, 0, 0.12, 0);
    a.box(P.body, 0.34, 0.16, 0.36, 0, 0, 0, sk, { ov: [['F', 0, 1, 6, 1, 0x3a2a1a]] });
    for (const sx of [-1, 1]) {
      a.box(P.body, 0.11, 0.09, 0.11, sx * 0.11, 0.1, 0.11, sk, { eyes: [EYE(0, 0, 1, 1, 0x141008, { g: 0xe8d870, m: false })] });
      const h = a.g(P.body, sx * 0.16, -0.02, -0.12); a.box(h, 0.1, 0.08, 0.26, sx * 0.03, -0.02, 0.0, sk); P.legs.push({ u: h, sx, hind: true });
      const f = a.g(P.body, sx * 0.12, -0.02, 0.13); a.box(f, 0.06, 0.1, 0.06, 0, -0.04, 0, sk); P.legs.push({ u: f, sx });
    }
    P.head = P.body;
    m.P = P; m.A = { kind: 'hop', hop: 6, look: 0 };
  },
  turtle(a, m) {
    const shell = SK(0x3e5a2a, { patch: { c: 0x5a7a3a, s: 0.12, t: 0.6 }, n: 0.08 }), skin = SK(0x7a9a5a, { speck: { c: 0x5a7a3a, p: 0.1 } }), belly = SK(0xd8d0a0);
    const P = { legs: [] };
    P.body = a.g(null, 0, 0.26, 0);
    a.box(P.body, 0.8, 0.24, 0.9, 0, 0.06, 0, shell); a.box(P.body, 0.56, 0.1, 0.62, 0, 0.21, 0, shell); a.box(P.body, 0.7, 0.08, 0.8, 0, -0.1, 0, belly);
    P.head = a.g(P.body, 0, 0.0, 0.45); a.box(P.head, 0.22, 0.18, 0.26, 0, 0, 0.12, skin, { eyes: [EYE(1, 1, 1, 1, 0x141008, { side: true })] });
    for (const [sx, z] of [[-1, 0.3], [1, 0.3], [-1, -0.3], [1, -0.3]]) { const f = a.g(P.body, sx * 0.38, -0.1, z); a.box(f, 0.3, 0.05, 0.18, sx * 0.14, 0, 0, skin); P.legs.push({ u: f, sx, front: z > 0 }); }
    m.P = P; m.A = { kind: 'turtle', cadence: 3, look: 0.5 };
  },
  bee(a, m) {
    const body = SK(0xf0c030, { stripe: { c: 0x2a2018, axis: 'z', p: 0.1, w: 0.45 }, n: 0.06 }), wing = SK(0xdaeaf4, { n: 0.03 }), dark = SK(0x2a2018);
    const P = { wings: [], legs: [] };
    P.body = a.g(null, 0, 0.4, 0);
    a.box(P.body, 0.24, 0.24, 0.32, 0, 0, 0, body, { eyes: [EYE(0, 1, 1, 2, 0x1a1410, {})] });
    a.box(P.body, 0.04, 0.04, 0.08, 0, -0.04, -0.2, dark);
    for (const sx of [-1, 1]) {
      const w = a.g(P.body, sx * 0.06, 0.12, 0.0); a.box(w, 0.22, 0.02, 0.16, sx * 0.11, 0, 0, wing, { glass: true }); P.wings.push(w);
      a.box(P.body, 0.02, 0.12, 0.02, sx * 0.05, 0.16, 0.14, dark, { rx: 0.5 });
    }
    P.head = P.body;
    m.P = P; m.A = { kind: 'fly', flap: 40, flapAmp: 0.5, hover: 0.05 };
  },
  bat(a, m) {
    const fur = SK(0x4a3a2c, { hair: 0.25 }), mem = SK(0x2c221c, { n: 0.08, stripe: { c: 0x3c3028, axis: 'x', p: 0.12, w: 0.2 } });
    const P = { wings: [] };
    P.body = a.g(null, 0, 0.3, 0);
    a.box(P.body, 0.16, 0.2, 0.14, 0, 0, 0, fur);
    P.head = a.g(P.body, 0, 0.1, 0.02); a.box(P.head, 0.16, 0.14, 0.14, 0, 0.07, 0.02, fur, { eyes: [EYE(0, 1, 1, 1, 0x100a08, {})] });
    for (const sx of [-1, 1]) {
      a.box(P.head, 0.05, 0.1, 0.03, sx * 0.05, 0.18, 0, fur);
      const w = a.g(P.body, sx * 0.08, 0.06, 0); a.box(w, 0.22, 0.02, 0.22, sx * 0.11, 0, -0.02, mem);
      const w2 = a.g(w, sx * 0.22, 0, 0); a.box(w2, 0.2, 0.02, 0.18, sx * 0.1, 0, -0.04, mem); P.wings.push(w); w.tip = w2;
    }
    m.P = P; m.A = { kind: 'fly', flap: 16, flapAmp: 0.9, hover: 0.15 };
  },
  squid(a, m) {
    const sk = SK(0x2c3e6a, { speck: { c: 0x4a5e8a, p: 0.12 }, grad: 0.2 }), ten = SK(0x3a4c7a, { stripe: { c: 0x2a3a64, axis: 'y', p: 0.1, w: 0.3 } });
    const P = { legs: [] };
    P.body = a.g(null, 0, 0.6, 0);
    a.box(P.body, 0.5, 0.64, 0.5, 0, 0.1, 0, sk, { eyes: [EYE(2, 6, 2, 2, 0xe8e0d0, { side: true, p: 0x101010 })] });
    for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2, t = a.g(P.body, Math.cos(an) * 0.17, -0.22, Math.sin(an) * 0.17); a.box(t, 0.08, 0.56, 0.08, 0, -0.28, 0, ten); P.legs.push({ u: t, an }); }
    P.head = P.body;
    m.P = P; m.A = { kind: 'swim' };
  },
  fish(a, m) {
    const v = m.variant % 3;
    const sk = [SK(0x9a8a6a, { speck: { c: 0x6a5a40, p: 0.15 }, zones: [[0xe0d8c8, (x, y) => y < 0.12]] }), SK(0xb84a3a, { speck: { c: 0x6a2a20, p: 0.12 } }), SK(0xf0a030, { stripe: { c: 0xf4f0ea, axis: 'z', p: 0.16, w: 0.25 } })][v];
    const P = {};
    P.body = a.g(null, 0, 0.2, 0);
    a.box(P.body, 0.12, 0.2, 0.38, 0, 0, 0, sk, { eyes: [EYE(1, 1, 1, 1, 0x101010, { side: true })] });
    a.box(P.body, 0.02, 0.08, 0.16, 0, 0.13, -0.02, sk);
    P.tail = a.g(P.body, 0, 0, -0.19); a.box(P.tail, 0.02, 0.2, 0.14, 0, 0, -0.07, sk);
    P.head = P.body;
    m.P = P; m.A = { kind: 'swim', fish: true };
  },
};
Object.assign(CREATURES, {
  // ======== village
  villager(a, m) {
    const prof = m.variant % 4;
    const apronC = [0xd8c8a0, 0xe8dcc0, 0x2a2420, 0xe8dcc0][prof];
    const robe = SK([0x8a6a3a, 0x3a5a7a, 0x4a4a4c, 0x6a3a6a][prof], { hair: 0.12, grad: 0.12, stripe: { c: [0x6e5430, 0x2e4a66, 0x3a3a3c, 0x562e56][prof], axis: 'y', p: 0.3, w: 0.08 }, zones: prof === 1 ? null : [[apronC, (x, y, z) => z > 0.12 && Math.abs(x) < 0.17 && y > 0.3 && y < 1.3]] });
    const skin = SK(pick(m, [0xc8946e, 0xa87450, 0xe0b090, 0x7a5236, 0xd8a078]), { n: 0.05 });
    const hairC = pick(m, [0x4a2e1a, 0x2a1e18, 0x8a6a3a, 0xc8c0b0, 0x6a3a1a, 0x1a1414]);
    biped(a, m, {
      legH: 0.72, legW: 0.22, hipX: 0.12, torso: [0.5, 0.74, 0.3], arm: [0.18, 0.68],
      sk: { leg: Object.assign({}, robe, { foot: { c: 0x3a2a1e, px: 2 } }), torso: robe, arm: Object.assign({}, robe, { zones: [[skin.c, (x, y) => y < 1.0]] }) },
      head(a, h, P) {
        const hs = Object.assign({}, skin, { zones: [[hairC, (x, y, z) => y > 1.78 || z < -0.12 && y > 1.56]] });
        a.box(h, 0.46, 0.5, 0.44, 0, 0.25, 0, hs, { eyes: [EYE(1, 4, 2, 1, 0xf4f0ea, { p: [0x3a6a2a, 0x4a3020, 0x3a5a8a][m.variant % 3] })], ov: [['F', 2, 6, 3, 1, 0x8a5a44, true]] });
        a.box(h, 0.1, 0.16, 0.08, 0, 0.18, 0.25, skin);
        if (prof === 0) { a.box(h, 0.72, 0.05, 0.72, 0, 0.52, 0, SK(0xe2c870, { stripe: { c: 0xc8a850, axis: 'x', p: 0.1, w: 0.4 } })); a.box(h, 0.48, 0.16, 0.48, 0, 0.6, 0, SK(0xe2c870, { rim: { c: 0x8a3a2a, px: 2 } })); }
        else if (prof === 1) a.box(h, 0.5, 0.14, 0.48, 0, 0.53, -0.01, SK(0xa83a2a, { stripe: { c: 0x8a2a1e, axis: 'y', p: 0.06, w: 0.4 } }));
        else if (prof === 3) a.box(h, 0.48, 0.03, 0.03, 0, 0.32, 0.23, SK(0x8a7a50));
      },
      anim: { cadence: 4.4, stride: 0.55 },
    });
  },
  guardian(a, m) {
    const iron = SK(0xbab6ae, { n: 0.07, patch: { c: 0x5a8a3a, s: 0.22, t: 0.7 }, speck: { c: 0x8a867e, p: 0.06 } });
    biped(a, m, {
      legH: 0.95, legW: 0.34, hipX: 0.24, torso: [1.1, 0.96, 0.62], arm: [0.32, 1.62], armGap: 0.02, elbows: true,
      sk: { leg: iron, torso: iron, arm: iron },
      head(a, h, P) {
        a.box(h, 0.46, 0.52, 0.46, 0, 0.2, 0.06, iron, { eyes: [EYE(1, 3, 1, 1, 0xe8b040, { glow: true })], ov: [['F', 1, 2, 5, 1, 0x7a766e]] });
        a.box(h, 0.1, 0.22, 0.1, 0, 0.12, 0.33, iron);
      },
      extra(a, P) { a.box(P.body, 1.2, 0.36, 0.7, 0, 0.82, 0, iron); a.box(P.body, 0.06, 0.06, 0.06, 0.3, 0.6, 0.33, SK(0xd83a30), { glow: false }); },
      anim: { cadence: 2.6, stride: 0.45, heavy: true },
    });
  },
  // ======== hostile
  zombie(a, m) {
    const husk = m.variant === 1;
    const skinC = husk ? 0x9c8c64 : 0x6f8f5a;
    const skin = SK(skinC, { n: 0.08, speck: { c: husk ? 0x7a6a48 : 0x4f6f3a, p: 0.12 } });
    const shirt = SK(husk ? 0xbcaa80 : 0x3c6a84, { hair: 0.12, patch: { c: skinC, s: 0.12, t: 0.7 } });
    const pants = SK(husk ? 0x7a6a4a : 0x3e3c6c, { hair: 0.1, foot: { c: 0x2a2620, px: 2 } });
    biped(a, m, {
      legH: 0.74, legW: 0.24, torso: [0.5, 0.74, 0.27], arm: [0.24, 0.74],
      sk: { leg: pants, torso: shirt, arm: Object.assign({}, shirt, { zones: [[skinC, (x, y) => y < 1.12]] }) },
      head(a, h, P) { a.box(h, 0.5, 0.5, 0.5, 0, 0.25, 0, skin, { eyes: [EYE(1, 3, 2, 1, 0x161210, { p: 0x4a1010, lid: skinC })], ov: [['F', 2, 6, 4, 1, 0x2a1a14], ['F', 0, 0, 8, husk ? 2 : 0, 0xbcaa80]] }); },
      anim: { cadence: 3.6, stride: 0.6, arms: 'reach' },
    });
  },
  skeleton(a, m) {
    const v = m.variant || 0; // 0 plain, 1 frost (stray), 2 mossy (bogged), 3 ashen
    const boneC = [0xd8d4c4, 0xc0cad0, 0xb2b88e, 0x2c2c30][v], gap = v === 3 ? 0x0e0e10 : 0x2e2a26;
    const bone = SK(boneC, { n: 0.06, patch: v === 2 ? { c: 0x4a6a2a, s: 0.12, t: 0.66 } : null });
    const ribs = Object.assign({}, bone, { stripe: { c: gap, axis: 'y', p: 0.1, w: 0.42 }, zones: [[boneC, (x) => Math.abs(x) < 0.05]] });
    const big = v === 3 ? 1.15 : 1;
    biped(a, m, {
      legH: 0.76 * big, legW: 0.12, hipX: 0.1, torso: [0.46, 0.72 * big, 0.2], arm: [0.12, 0.74 * big],
      sk: { leg: bone, torso: ribs, arm: bone },
      head(a, h, P) {
        a.box(h, 0.46, 0.4, 0.46, 0, 0.26, 0, bone, { eyes: [EYE(1, 2, 2, 2, v === 3 ? 0x3a1a1a : 0x161412, { lids: false })], lids: false, ov: [['F', 3, 5, 2, 1, gap]] });
        P.jaw = a.g(h, 0, 0.06, 0.02); a.box(P.jaw, 0.4, 0.1, 0.4, 0, -0.02, 0, bone, { ov: [['F', 1, 0, 1, 1, gap, true], ['F', 3, 0, 1, 1, gap, true]] });
        if (v === 2) { a.box(h, 0.16, 0.08, 0.16, 0.12, 0.5, 0.05, SK(0xc83a2a, { speck: { c: 0xf0e8d8, p: 0.2 } })); a.box(h, 0.04, 0.08, 0.04, 0.12, 0.44, 0.05, SK(0xe8dcc8)); }
        if (v === 1) a.box(h, 0.52, 0.2, 0.52, 0, 0.42, -0.02, SK(0x5a6a72, { hair: 0.3 }));
      },
      extra(a, P) {
        const wood = SK(0x7a5432), str = SK(0xe8e8e0);
        if (v === 3) { const sw = a.g(P.arms[1].u, 0, -0.74 * big + 0.06, 0.04, -1.2); a.box(sw, 0.06, 0.9, 0.12, 0, 0.45, 0, SK(0x4a4a4e, { n: 0.1 })); a.box(sw, 0.24, 0.05, 0.1, 0, 0.0, 0, SK(0x2a2a2c)); }
        else { const bw = a.g(P.arms[0].u, 0, -0.66, 0.06); a.box(bw, 0.04, 0.3, 0.04, 0, 0.15, 0.04, wood, { rx: 0.4 }); a.box(bw, 0.04, 0.3, 0.04, 0, -0.15, 0.04, wood, { rx: -0.4 }); a.box(bw, 0.01, 0.56, 0.01, 0, 0, -0.03, str); P.bow = bw; }
        if (v === 1) a.box(P.body, 0.52, 0.5, 0.26, 0, 0.45, 0, SK(0x5a6a72, { hair: 0.35, n: 0.1 }));
      },
      anim: { cadence: 4.2, stride: 0.6, arms: v === 3 ? 'swing' : 'aim' },
    });
  },
  spider(a, m) {
    const cave = m.type === 'cave_spider';
    const c = cave ? 0x1e3a3e : 0x2e2622, hair = SK(c, { hair: 0.4, n: 0.1 });
    const abd = SK(c, { hair: 0.3, patch: { c: cave ? 0x3a6a6a : 0x6a5040, s: 0.16, t: 0.66 }, stripe: { c: cave ? 0x2a5a5a : 0x4a3a30, axis: 'z', p: 0.22, w: 0.18 } });
    const P = {};
    P.body = a.g(null, 0, 0.42, 0);
    a.box(P.body, 0.5, 0.36, 0.42, 0, 0, 0, hair);
    P.abd = a.g(P.body, 0, 0.06, -0.2); a.box(P.abd, 0.74, 0.58, 0.8, 0, 0.08, -0.36, abd);
    P.head = a.g(P.body, 0, 0.0, 0.2);
    const ec = 0xff3a28, e2 = 0xc82418;
    a.box(P.head, 0.42, 0.34, 0.3, 0, 0.02, 0.14, hair, { eyes: [EYE(2, 2, 1, 1, ec, { glow: true }), EYE(1, 1, 1, 1, e2, { glow: true }), EYE(0, 3, 1, 1, e2, { glow: true }), EYE(3, 1, 1, 1, e2, { glow: true, m: false })] });
    for (const sx of [-1, 1]) a.box(P.head, 0.06, 0.14, 0.06, sx * 0.08, -0.17, 0.27, SK(0x1a1412));
    spiderLegs(a, P, { x: 0.2, y: 0.0, z0: 0.18, dz: 0.12, fan: 0.3, lift: 0.75, bend: 1.6, femur: 0.55, tibia: 1.0, w: 0.07, sk: hair });
    m.P = P; m.A = { kind: 'spider', cadence: 7, look: 0.4 };
  },
  boomshroom(a, m) {
    const stalk = SK(0xe8dcc4, { n: 0.06, grad: 0.15, speck: { c: 0xcfc0a4, p: 0.1 } }), cap = SK(0xc8302a, { n: 0.06, patch: { c: 0xf2ece0, s: 0.09, t: 0.72 } });
    const gills = SK(0xd8c8a8, { stripe: { c: 0xb8a888, axis: 'x', p: 0.08, w: 0.4 } });
    const P = { legs: [] };
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const u = a.g(null, sx * 0.16, 0.3, sz * 0.14); a.box(u, 0.18, 0.3, 0.18, 0, -0.15, 0, Object.assign({}, stalk, { foot: { c: 0x8a7a5a, px: 1 } })); P.legs.push({ u, sx, front: sz > 0 }); }
    P.body = a.g(null, 0, 0.3, 0);
    a.box(P.body, 0.48, 0.9, 0.44, 0, 0.45, 0, stalk, { eyes: [EYE(1, 3, 2, 2, 0x1c1410, { lid: 0xd8ccb4 })], ov: [['F', 2, 7, 4, 1, 0x2a1a14], ['F', 1, 8, 1, 1, 0x2a1a14, true]] });
    P.head = a.g(P.body, 0, 0.9, 0);
    a.box(P.head, 0.98, 0.32, 0.98, 0, 0.14, 0, cap); a.box(P.head, 0.62, 0.16, 0.62, 0, 0.38, 0, cap); a.box(P.head, 0.82, 0.06, 0.82, 0, -0.04, 0, gills);
    m.P = P; m.A = { kind: 'shroom', cadence: 6, stride: 0.5, look: 0.6 };
  },
  stalker(a, m) {
    const bark = SK(0x2a2628, { hair: 0.3, speck: { c: 0x4a4248, p: 0.08 } }), mask = SK(0xe8e2d4, { n: 0.05, speck: { c: 0xc8c0b0, p: 0.1 } });
    biped(a, m, {
      legH: 1.45, legW: 0.14, hipX: 0.1, torso: [0.42, 0.72, 0.22], arm: [0.13, 1.42],
      sk: { leg: bark, torso: bark, arm: bark },
      head(a, h, P) {
        a.box(h, 0.44, 0.44, 0.44, 0, 0.22, 0, bark);
        a.box(h, 0.4, 0.4, 0.04, 0, 0.22, 0.23, mask, { ov: [['F', 1, 3, 2, 2, 0x0e0c0e, true], ['F', 3, 6, 1, 1, 0x3a3436, true]], eyes: [EYE(1, 3, 2, 1, 0xd8b0ff, { glow: true })] });
      },
      anim: { cadence: 2.6, stride: 0.55, look: 1.2 },
    });
    m.P.particles = 'void';
  },
  witch(a, m) {
    const robe = SK(0x3e2e4e, { hair: 0.15, zones: [[0x6a5a3a, (x, y, z) => z > 0.1 && Math.abs(x) < 0.18 && y < 1.3]] }), skin = SK(0x9aaa82, { speck: { c: 0x7a8a62, p: 0.1 } }), hat = SK(0x2a2230, { n: 0.08 });
    biped(a, m, {
      legH: 0.72, legW: 0.22, hipX: 0.12, torso: [0.5, 0.74, 0.3], arm: [0.18, 0.7],
      sk: { leg: Object.assign({}, robe, { zones: null, foot: { c: 0x1a141a, px: 2 } }), torso: robe, arm: Object.assign({}, robe, { zones: [[skin.c, (x, y) => y < 0.98]] }) },
      head(a, h, P) {
        a.box(h, 0.48, 0.48, 0.48, 0, 0.24, 0, skin, { eyes: [EYE(1, 3, 2, 1, 0xd8e0a0, { p: 0x3a1a3a })], ov: [['F', 2, 6, 4, 1, 0x4a3a40]] });
        a.box(h, 0.1, 0.2, 0.12, 0, 0.18, 0.28, skin); a.box(h, 0.05, 0.05, 0.05, 0.05, 0.1, 0.35, SK(0x6a8a4a));
        a.box(h, 0.76, 0.05, 0.76, 0, 0.5, 0, hat); a.box(h, 0.46, 0.2, 0.46, 0, 0.62, -0.02, SK(0x2a2230, { rim: { c: 0x6a4a8a, px: 0 }, zones: [[0x6a4a8a, (x, y) => y < 2.07]] }));
        a.box(h, 0.3, 0.2, 0.3, 0, 0.8, -0.08, hat, { rx: -0.2 }); a.box(h, 0.14, 0.22, 0.14, 0, 0.98, -0.18, hat, { rx: -0.5 });
      },
      extra(a, P) { const b = a.g(P.arms[1].u, 0, -0.62, 0.08); a.box(b, 0.12, 0.18, 0.12, 0, 0, 0, SK(0x9a4ae0, { n: 0.05 }), { glass: true }); a.box(b, 0.05, 0.06, 0.05, 0, 0.12, 0, SK(0x7a5430)); },
      anim: { cadence: 4, stride: 0.5 },
    });
  },
  slime(a, m) {
    const magma = m.type === 'magma_slime', size = m.size || 2, S = [0, 0.5, 0.9, 1.5][size];
    const outer = magma ? SK(0x3a1a14, { patch: { c: 0xff7a2a, s: 0.12, t: 0.66 }, n: 0.1 }) : SK(0x6ac85a, { n: 0.05 });
    const inner = magma ? SK(0xff8a2a, { n: 0.1 }) : SK(0x4a9a3a, { n: 0.06 });
    const P = {};
    P.body = a.g(null, 0, 0, 0);
    const cs = S * 0.62, px = Math.max(3, Math.round(cs * 16));
    const ew = Math.max(1, Math.round(px / 5)), ev = Math.round(px * 0.25), eu = Math.max(0, Math.round(px * 0.18));
    a.box(P.body, cs, cs, cs, 0, S * 0.42, 0, inner, { eyes: [EYE(eu, ev, ew, ew, 0x1a2a14, { lids: false })], lids: false, ov: [['F', 'c', Math.round(px * 0.68), Math.max(1, Math.round(px / 4)), 1, 0x1a2a14]], glow: magma });
    a.box(P.body, S, S, S, 0, S / 2, 0, outer, magma ? {} : { glass: true });
    P.head = P.body;
    m.P = P; m.A = { kind: 'slime', hop: 5 + size };
  },
  mite(a, m) {
    const sk = SK(0x8a8a8e, { n: 0.1, stripe: { c: 0x6a6a6e, axis: 'x', p: 0.08, w: 0.25 } });
    const P = { segs: [] };
    let parent = null, z = 0.25;
    const sizes = [[0.18, 0.14], [0.26, 0.18], [0.3, 0.2], [0.24, 0.16], [0.16, 0.12], [0.1, 0.08]];
    sizes.forEach(([w, h], i) => { const g = a.g(parent, 0, parent ? 0 : h / 2, parent ? -0.14 : z); a.box(g, w, h, 0.15, 0, 0, -0.07, sk, i === 0 ? { eyes: [EYE(0, 1, 1, 1, 0x101010)] } : {}); P.segs.push(g); parent = g; });
    P.body = P.segs[0]; P.head = P.segs[0];
    m.P = P; m.A = { kind: 'worm' };
  },
  raider(a, m) {
    const coat = SK(0x5a4636, { hair: 0.15, zones: [[0x3a2e24, (x, y) => y > 1.2 && y < 1.28]] }), hood = SK(0x4a4a52, { hair: 0.2 }), skin = SK(0xa88a6e, { n: 0.05 });
    biped(a, m, {
      legH: 0.74, legW: 0.24, torso: [0.5, 0.74, 0.28], arm: [0.22, 0.72],
      sk: { leg: SK(0x3a3a40, { foot: { c: 0x2a2018, px: 2 } }), torso: coat, arm: Object.assign({}, coat, { zones: [[skin.c, (x, y) => y < 0.98]] }) },
      head(a, h, P) {
        a.box(h, 0.48, 0.48, 0.48, 0, 0.24, 0, skin, { eyes: [EYE(1, 3, 2, 1, 0xe8e0d8, { p: 0x2a2a3a })], ov: [['F', 1, 2, 2, 1, 0x3a2a20, true], ['F', 2, 6, 4, 1, 0x6a4a3a]] });
        a.box(h, 0.54, 0.22, 0.54, 0, 0.5, -0.02, hood); a.box(h, 0.54, 0.4, 0.1, 0, 0.3, -0.24, hood);
      },
      extra(a, P) { const cb = a.g(P.arms[1].u, 0, -0.62, 0.1); a.box(cb, 0.08, 0.08, 0.5, 0, 0, 0.12, SK(0x6a4a2a)); a.box(cb, 0.5, 0.05, 0.06, 0, 0, 0.3, SK(0x4a3a2a)); P.bow = cb; },
      anim: { cadence: 4.2, stride: 0.6, arms: 'aim' },
    });
  },
  wraith(a, m) {
    const veil = SK(0xe8e4e0, { n: 0.06, grad: 0.3, speck: { c: 0xc8c0bc, p: 0.1 } }), body = SK(0xeeeae6, { n: 0.05, patch: { c: 0xc8c2bc, s: 0.3, t: 0.62 } });
    const P = { legs: [] };
    P.body = a.g(null, 0, 1.6, 0);
    a.box(P.body, 1.5, 1.3, 1.4, 0, 0, 0, body, { eyes: [EYE(5, 6, 3, 2, 0xff9a3a, { glow: true })], ov: [['F', 'c', 14, 8, 3, 0x2a2224], ['F', 5, 6, 3, 2, 0x2a2224, true]] });
    for (let i = 0; i < 9; i++) { const x = ((i % 3) - 1) * 0.45, z = (Math.floor(i / 3) - 1) * 0.42, t = a.g(P.body, x, -0.65, z); a.box(t, 0.14, 1.0 + (i * 7 % 5) * 0.15, 0.14, 0, -0.5 - (i * 7 % 5) * 0.075, 0, veil); P.legs.push({ u: t, an: i }); }
    P.head = P.body;
    m.P = P; m.A = { kind: 'float', hover: 0.25 };
  },
  glider(a, m) {
    const sk = SK(0x4a5a7a, { n: 0.08, speck: { c: 0x6a7a9a, p: 0.1 } }), mem = SK(0x3a4a68, { stripe: { c: 0x5a6a8a, axis: 'x', p: 0.15, w: 0.15 } });
    const P = { wings: [] };
    P.body = a.g(null, 0, 0.3, 0);
    a.box(P.body, 0.5, 0.18, 1.0, 0, 0, 0, sk);
    P.head = a.g(P.body, 0, 0.0, 0.5); a.box(P.head, 0.42, 0.18, 0.3, 0, 0, 0.12, sk, { eyes: [EYE(1, 1, 2, 1, 0x8affb0, { glow: true })] });
    for (const sx of [-1, 1]) { const w = a.g(P.body, sx * 0.25, 0.02, 0.05); a.box(w, 0.7, 0.04, 0.6, sx * 0.35, 0, 0, mem); const w2 = a.g(w, sx * 0.7, 0, 0); a.box(w2, 0.6, 0.04, 0.4, sx * 0.3, 0, -0.08, mem); w.tip = w2; P.wings.push(w); }
    P.tail = a.g(P.body, 0, 0, -0.5); a.box(P.tail, 0.26, 0.08, 0.5, 0, 0, -0.25, sk);
    m.P = P; m.A = { kind: 'fly', flap: 3, flapAmp: 0.35, glide: true };
  },
});
CREATURES.cave_spider = CREATURES.spider;
CREATURES.magma_slime = CREATURES.slime;
Object.assign(CREATURES, {
  // ======== Blockhollow originals, rebuilt
  deer(a, m) {
    const fur = SK(0xa9763f, { hair: 0.18, zones: [[0xf3e6cc, (x, y, z) => y > 1.0 && mnoise(x * 9, y * 9, z * 9, 4) > 0.72], [0xead9b8, (x, y) => y < 0.86]] });
    const leg = SK(0x8c6034, { hair: 0.1, foot: { c: 0x2e2218, px: 2 } }), antler = SK(0xe6d8b8, { n: 0.06 }), bloom = SK(0xff8fd0, { n: 0.08, speck: { c: 0xfff0f8, p: 0.25 } });
    quadruped(a, m, {
      bodyY: 0.8, bodyH: 0.46, bodyW: 0.44, bodyL: 0.96, legW: 0.11, legIn: 0.06, legZF: 0.34, legZB: -0.34, knee: 0.5, sk: { body: fur, leg },
      neck: { y: 1.14, z: 0.4, ang: 0.45, w: 0.2, l: 0.5, d: 0.22 },
      head(a, h, P) {
        a.box(h, 0.26, 0.26, 0.3, 0, 0.02, 0.06, fur, { eyes: [EYE(2, 1, 2, 2, 0x1a120c, { side: true, g: 0xd8c8b8 })] });
        a.box(h, 0.17, 0.15, 0.2, 0, -0.04, 0.29, SK(0xd8c4a4), { ov: [['F', 'c', 0, 2, 1, 0x2a1c16]] });
        for (const sx of [-1, 1]) {
          const e = a.g(h, sx * 0.13, 0.12, 0.0, 0, 0, sx * -0.9); a.box(e, 0.06, 0.18, 0.1, 0, 0.09, 0, fur); P.ears.push(e);
          const an = a.g(h, sx * 0.07, 0.15, -0.02, 0, 0, sx * -0.25);
          a.box(an, 0.04, 0.32, 0.04, 0, 0.16, 0, antler); a.box(an, 0.04, 0.2, 0.04, sx * 0.08, 0.26, 0, antler, { rz: sx * -0.7 }); a.box(an, 0.04, 0.18, 0.04, 0, 0.36, 0.06, antler, { rx: 0.5 });
          a.box(an, 0.07, 0.07, 0.07, sx * 0.15, 0.36, 0, bloom, { glow: true }); a.box(an, 0.06, 0.06, 0.06, 0, 0.47, 0.11, bloom, { glow: true });
        }
      },
      tail: { y: 0.16, w: 0.12, h: 0.14, d: 0.06, ang: -0.4, sk: SK(0xf4ece0) },
      anim: { cadence: 3.6, stride: 0.6, graze: true },
    });
  },
  boar(a, m) {
    const fur = SK(0x5a4030, { hair: 0.4, n: 0.1, stripe: { c: 0x46321f, axis: 'z', p: 0.2, w: 0.2, wob: 0.5 } }), mane = SK(0x2a1e16, { hair: 0.6, n: 0.12 });
    const tusk = SK(0xf0e8d8), snout = SK(0x8a6458);
    quadruped(a, m, {
      bodyY: 0.36, bodyH: 0.56, bodyW: 0.58, bodyL: 1.0, legW: 0.16, legIn: 0.05, legZF: 0.32, legZB: -0.32, sk: { body: fur, leg: Object.assign({}, fur, { stripe: null, foot: { c: 0x1e1612, px: 1 } }) },
      headY: 0.66, headZ: 0.52,
      head(a, h, P) {
        a.box(h, 0.46, 0.42, 0.38, 0, 0, 0.1, fur, { eyes: [EYE(1, 2, 1, 1, 0x1a0a08, { side: true })] });
        a.box(h, 0.26, 0.2, 0.14, 0, -0.06, 0.34, snout, { ov: [['F', 1, 1, 1, 2, 0x3a2420, true]] });
        for (const sx of [-1, 1]) { a.box(h, 0.05, 0.14, 0.05, sx * 0.15, -0.0, 0.36, tusk, { rz: sx * 0.3 }); const e = a.g(h, sx * 0.17, 0.2, 0.04, 0.3); a.box(e, 0.12, 0.04, 0.12, 0, 0, 0.04, fur); P.ears.push(e); }
      },
      tail: { y: 0.18, w: 0.04, h: 0.24, d: 0.04, ang: 0.3, tip: [0.08, mane] },
      extra(a, P) { a.box(P.body, 0.66, 0.24, 0.52, 0, 0.26, 0.2, fur); a.box(P.body, 0.14, 0.18, 0.86, 0, 0.36, -0.02, mane); },
      anim: { cadence: 5.4, stride: 0.55, graze: true },
    });
  },
  shade(a, m) {
    const cloak = SK(0x15131c, { n: 0.12, hair: 0.3, speck: { c: 0x2a2236, p: 0.08 } }), inner = SK(0x07060a, { n: 0.05 });
    const P = { legs: [], arms: [] };
    P.body = a.g(null, 0, 0.5, 0);
    a.box(P.body, 0.58, 1.2, 0.42, 0, 0.6, 0, cloak); a.box(P.body, 0.7, 0.3, 0.5, 0, 1.12, 0, cloak);
    for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2, t = a.g(P.body, Math.cos(an) * 0.2, 0.02, Math.sin(an) * 0.14); a.box(t, 0.14, 0.55, 0.12, 0, -0.27, 0, cloak); P.legs.push({ u: t, an: i }); }
    for (const sx of [-1, 1]) { const s = a.g(P.body, sx * 0.38, 1.12, 0); a.box(s, 0.13, 0.7, 0.13, 0, -0.35, 0, cloak); const l = a.g(s, 0, -0.7, 0); a.box(l, 0.12, 0.6, 0.12, 0, -0.3, 0, cloak); for (const k of [-1, 0, 1]) a.box(l, 0.03, 0.18, 0.03, k * 0.04, -0.68, 0.03, SK(0x2a2236)); P.arms.push({ u: s, l, sx }); }
    P.head = a.g(P.body, 0, 1.28, 0.02);
    a.box(P.head, 0.5, 0.52, 0.5, 0, 0.24, 0, cloak); a.box(P.head, 0.36, 0.34, 0.06, 0, 0.18, 0.24, inner, { eyes: [EYE(1, 2, 1, 1, 0xffb030, { glow: true })] });
    a.box(P.head, 0.2, 0.2, 0.2, 0, 0.5, -0.18, cloak, { rx: -0.6 });
    m.P = P; m.A = { kind: 'float', hover: 0.12, arms: 'reach' }; m.trail = 'shadow';
  },
  crawler(a, m) {
    const shell = SK(0xb89a62, { n: 0.08, stripe: { c: 0x8a6a3a, axis: 'z', p: 0.16, w: 0.2 } }), leg = SK(0x7a5a32, { n: 0.08 }), claw = SK(0xa8824a, { n: 0.06 });
    const P = {};
    P.body = a.g(null, 0, 0.32, 0);
    a.box(P.body, 0.56, 0.24, 0.56, 0, 0, 0.05, shell, { eyes: [EYE(1, 1, 1, 1, 0xff3020, { glow: true }), EYE(3, 1, 1, 1, 0xff3020, { glow: true })] });
    a.box(P.body, 0.5, 0.2, 0.36, 0, 0.0, -0.38, shell);
    P.head = a.g(P.body, 0, 0, 0.3);
    P.arms = [];
    for (const sx of [-1, 1]) {
      const s = a.g(P.head, sx * 0.24, -0.02, 0.0, 0, sx * -0.5, 0); a.box(s, 0.1, 0.1, 0.36, 0, 0, 0.18, leg);
      const l = a.g(s, 0, 0, 0.36, 0, sx * 0.9, 0); a.box(l, 0.18, 0.12, 0.26, 0, 0, 0.13, claw); const pin = a.g(l, sx * -0.04, 0, 0.26); a.box(pin, 0.06, 0.08, 0.18, 0, 0, 0.09, claw); P.arms.push({ u: s, l, pin, sx });
    }
    spiderLegs(a, P, { x: 0.24, y: 0.0, z0: 0.15, dz: 0.16, fan: 0.25, lift: 0.5, bend: 1.4, femur: 0.32, tibia: 0.5, w: 0.06, sk: leg });
    P.tail = []; let parent = P.body, z = -0.56;
    for (let i = 0; i < 5; i++) { const g = a.g(parent, 0, parent === P.body ? 0.02 : 0, parent === P.body ? z : 0.22 * -1, i === 0 ? -0.6 : -0.42); a.box(g, 0.2 - i * 0.02, 0.16 - i * 0.015, 0.24, 0, 0, -0.11, shell); P.tail.push(g); parent = g; }
    const st = a.g(parent, 0, 0, -0.22, -0.7); a.box(st, 0.08, 0.08, 0.2, 0, -0.04, -0.06, SK(0xffb040), { glow: true });
    m.P = P; m.A = { kind: 'spider', cadence: 8, look: 0.3, scorpion: true };
  },
  golem(a, m) {
    const stone = SK(0x7a7c84, { n: 0.1, patch: { c: 0x5a5c64, s: 0.2, t: 0.62 }, speck: { c: 0x9a9ca4, p: 0.05 } }), cry = SK(0x56d2f0, { n: 0.08, speck: { c: 0xd8faff, p: 0.2 } });
    biped(a, m, {
      legH: 0.8, legW: 0.46, hipX: 0.34, torso: [1.4, 1.05, 0.9], arm: [0.46, 1.45], elbows: true, armGap: 0.02,
      sk: { leg: stone, torso: stone, arm: stone },
      head(a, h, P) { a.box(h, 0.62, 0.5, 0.56, 0, 0.12, 0.26, stone, { eyes: [EYE(1, 3, 8, 1, 0x6ef0ff, { glow: true, m: false })] }); },
      extra(a, P) {
        for (const [x, y, z, w, hh, r] of [[-0.45, 1.05, -0.3, 0.26, 0.6, 0.3], [0.05, 1.12, -0.35, 0.32, 0.75, -0.1], [0.5, 1.05, -0.3, 0.26, 0.5, -0.4], [-0.25, 0.75, -0.48, 0.2, 0.45, 0.2], [0.3, 0.7, -0.48, 0.22, 0.42, -0.2]])
          a.box(P.body, w, hh, w, x, y, z, cry, { glow: true, rz: r, rx: -0.35 });
        for (const ar of P.arms) a.box(ar.u, 0.22, 0.4, 0.22, 0, 0.18, -0.08, cry, { glow: true, rz: ar.sx * 0.4 });
        for (const ar of P.arms) a.box(ar.l, 0.56, 0.36, 0.56, 0, -0.8, 0, stone);
      },
      anim: { cadence: 2.6, stride: 0.45, heavy: true },
    });
  },
  wisp(a, m) {
    const core = SK(0x9af0ff, { n: 0.08, speck: { c: 0xffffff, p: 0.25 } }), shard = SK(0x56d2f0, { n: 0.06, stripe: { c: 0xc8f8ff, axis: 'y', p: 0.12, w: 0.3 } });
    const P = { wings: [], orbit: [] };
    P.body = a.g(null, 0, 0.9, 0);
    a.box(P.body, 0.4, 0.4, 0.4, 0, 0, 0, core, { glow: true, rx: 0.7, ry: 0.7 });
    for (const sx of [-1, 1]) { const w = a.g(P.body, sx * 0.2, 0.05, 0); a.box(w, 0.8, 0.04, 0.3, sx * 0.45, 0, 0, shard, { glow: true, ry: sx * 0.3 }); a.box(w, 0.45, 0.04, 0.2, sx * 0.8, 0.1, -0.2, shard, { glow: true, ry: sx * 0.6 }); P.wings.push(w); }
    P.ring = a.g(P.body);
    for (let i = 0; i < 3; i++) { const an = i / 3 * Math.PI * 2; a.box(P.ring, 0.1, 0.24, 0.1, Math.cos(an) * 0.55, 0, Math.sin(an) * 0.55, shard, { glow: true, rz: 0.4 }); }
    P.head = P.body;
    m.P = P; m.A = { kind: 'fly', flap: 9, flapAmp: 0.5, hover: 0.15 }; m.trail = 'sparkle';
  },
  elemental(a, m) {
    const armor = SK(0x2a2228, { n: 0.1, patch: { c: 0x3a3036, s: 0.2, t: 0.6 } }), flame = SK(0xff7a1a, { n: 0.12, speck: { c: 0xffe46a, p: 0.35 } }), lava = SK(0xff6a1a, { n: 0.1 });
    biped(a, m, {
      legH: 0.85, legW: 0.28, hipX: 0.18, torso: [0.72, 0.85, 0.44], arm: [0.26, 0.85], elbows: true,
      sk: { leg: armor, torso: armor, arm: armor },
      head(a, h, P) { a.box(h, 0.44, 0.44, 0.44, 0, 0.22, 0, armor, { eyes: [EYE(1, 2, 2, 2, 0xffd040, { glow: true })], ov: [['F', 2, 5, 3, 1, 0xff6a1a]] }); P.flames = [a.g(h, 0, 0.44, 0), a.g(h, 0.08, 0.66, -0.05)]; a.box(P.flames[0], 0.32, 0.36, 0.32, 0, 0.18, 0, flame, { glow: true }); a.box(P.flames[1], 0.18, 0.26, 0.18, 0, 0.13, 0, flame, { glow: true }); },
      extra(a, P) {
        a.box(P.body, 0.36, 0.36, 0.05, 0, 0.45, 0.23, lava, { glow: true });
        for (const sx of [-1, 1]) a.box(P.body, 0.36, 0.3, 0.52, sx * 0.52, 0.8, 0, armor);
        P.ring = a.g(P.body, 0, 0.45, 0); for (let i = 0; i < 4; i++) { const an = i / 4 * Math.PI * 2; a.box(P.ring, 0.16, 0.16, 0.16, Math.cos(an) * 0.75, (i % 2) * 0.2, Math.sin(an) * 0.75, i % 2 ? lava : armor, { glow: i % 2 === 1 }); }
      },
      anim: { cadence: 3.8, stride: 0.55 },
    });
    m.trail = 'ember';
  },
  imp(a, m) {
    const sk = SK(0xa8281a, { n: 0.08, speck: { c: 0x6a1408, p: 0.12 } }), horn = SK(0x2a2020), wing = SK(0x5a140c, { stripe: { c: 0x3a0a06, axis: 'x', p: 0.1, w: 0.25 } });
    biped(a, m, {
      legH: 0.4, legW: 0.14, hipX: 0.09, torso: [0.38, 0.42, 0.26], arm: [0.11, 0.42], knees: false,
      sk: { leg: Object.assign({}, sk, { foot: { c: 0x2a0a06, px: 1 } }), torso: sk, arm: sk },
      head(a, h, P) {
        a.box(h, 0.4, 0.36, 0.36, 0, 0.18, 0, sk, { eyes: [EYE(1, 2, 2, 1, 0xffe46a, { glow: true })], ov: [['F', 1, 4, 4, 1, 0x200404]] });
        for (const sx of [-1, 1]) { a.box(h, 0.07, 0.2, 0.07, sx * 0.13, 0.42, 0, horn, { rz: sx * -0.4 }); a.box(h, 0.05, 0.12, 0.05, sx * 0.2, 0.54, 0, horn, { rz: sx * -0.9 }); }
      },
      extra(a, P) { P.wings = []; for (const sx of [-1, 1]) { const w = a.g(P.body, sx * 0.1, 0.36, -0.13); a.box(w, 0.36, 0.3, 0.02, sx * 0.18, 0.05, 0, wing); P.wings.push(w); } P.tail = a.g(P.body, 0, 0.05, -0.13, 0.9); a.box(P.tail, 0.05, 0.5, 0.05, 0, -0.25, 0, sk); a.box(P.tail, 0.1, 0.1, 0.04, 0, -0.5, 0, horn); },
      anim: { cadence: 7, stride: 0.6 },
    });
    m.trail = 'ember';
  },
  knight(a, m) {
    const arm = SK(0x4a5a4a, { n: 0.08, patch: { c: 0x3e6a2e, s: 0.16, t: 0.64 }, speck: { c: 0x8a9a88, p: 0.06 } }), blade = SK(0x8a9aa0, { n: 0.05 }), kelp = SK(0x2e5a2a, { hair: 0.4 });
    biped(a, m, {
      legH: 0.85, legW: 0.28, hipX: 0.17, torso: [0.66, 0.8, 0.4], arm: [0.24, 0.8], elbows: true,
      sk: { leg: arm, torso: arm, arm },
      head(a, h, P) { a.box(h, 0.48, 0.52, 0.48, 0, 0.26, 0, arm, { ov: [['F', 1, 3, 6, 1, 0x101410], ['F', 'c', 4, 1, 3, 0x101410]], eyes: [EYE(1, 3, 2, 1, 0x5affd0, { glow: true })] }); a.box(h, 0.08, 0.24, 0.36, 0, 0.6, 0, kelp); },
      extra(a, P) {
        const sw = a.g(P.arms[1].l, 0, -0.38, 0.06, -1.3); a.box(sw, 0.08, 1.1, 0.16, 0, 0.55, 0, blade); a.box(sw, 0.32, 0.06, 0.1, 0, 0.0, 0, SK(0x3a3a2a));
        const sh = a.g(P.arms[0].l, -0.06, -0.2, 0.08); a.box(sh, 0.06, 0.6, 0.48, -0.04, 0, 0.06, SK(0x5a6a5a, { rim: { c: 0x8a7a3a, px: 1 }, patch: { c: 0x3e6a2e, s: 0.12, t: 0.6 } }));
        for (const sx of [-1, 1]) { const k = a.g(P.body, sx * 0.3, 0.8, -0.1); a.box(k, 0.06, 0.6, 0.06, 0, -0.3, 0, kelp); }
      },
      anim: { cadence: 3.8, stride: 0.6 },
    });
  },
  sentinel(a, m) {
    const st = SK(0x6a6a74, { n: 0.08, stripe: { c: 0x4a4a54, axis: 'y', p: 0.25, w: 0.12 } }), rune = SK(0x8af0d0, { n: 0.05 });
    const P = { legs: [] };
    P.body = a.g(null, 0, 1.2, 0);
    a.box(P.body, 0.66, 0.66, 0.66, 0, 0, 0, st, { rz: Math.PI / 4, eyes: [EYE(4, 4, 3, 3, 0x8af0d0, { glow: true, m: false })] });
    P.ring = a.g(P.body);
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; a.box(P.ring, 0.42, 0.62, 0.08, Math.cos(an) * 0.65, 0, Math.sin(an) * 0.65, st, { ry: -an + Math.PI / 2 }); a.box(P.ring, 0.06, 0.3, 0.02, Math.cos(an) * 0.7, 0, Math.sin(an) * 0.7, rune, { glow: true, ry: -an + Math.PI / 2 }); }
    P.head = P.body;
    m.P = P; m.A = { kind: 'float', hover: 0.15 };
  },
  // ======== bosses
  warden(a, m) {
    a.density(10);
    const stone = SK(0x4e5e4a, { n: 0.1, patch: { c: 0x3e6a2e, s: 0.35, t: 0.6 }, patch2: { c: 0x2e3a2c, s: 0.2, t: 0.7 }, speck: { c: 0x6a7a66, p: 0.06 } });
    const moss = SK(0x3e6a2e, { hair: 0.5, n: 0.12 }), glow = SK(0x6ef0ff, { n: 0.06, speck: { c: 0xffffff, p: 0.2 } }), coral = SK(0x5ad8c0, { n: 0.08 });
    const barn = SK(0xd8d0c0, { n: 0.08, speck: { c: 0x8a8070, p: 0.3 } }), dark = SK(0x1e2620, { n: 0.08 });
    const P = { legs: [], arms: [], drapes: [], kelp: [] };
    for (const sx of [-1, 1]) {
      const u = a.g(null, sx * 0.62, 1.75, 0); a.box(u, 0.72, 0.95, 0.75, 0, -0.45, 0, stone);
      const l = a.g(u, 0, -0.9, 0.05); a.box(l, 0.62, 0.85, 0.62, 0, -0.42, -0.04, stone); a.box(l, 0.8, 0.22, 0.95, 0, -0.75, 0.1, dark); a.box(l, 0.2, 0.2, 0.2, sx * 0.2, -0.3, 0.3, barn);
      P.legs.push({ u, l, sx });
    }
    P.body = a.g(null, 0, 1.75, 0);
    a.box(P.body, 1.5, 0.6, 1.0, 0, 0.2, 0, stone);
    P.chest = a.g(P.body, 0, 0.45, 0, 0.32);
    a.box(P.chest, 2.1, 1.5, 1.25, 0, 0.8, 0, stone); a.box(P.chest, 1.3, 0.55, 1.3, 0, 0.55, 0.02, moss);
    P.core = a.g(P.chest, 0, 0.85, 0.64); a.box(P.core, 0.46, 0.46, 0.1, 0, 0, 0, glow, { glow: true });
    for (const [x, y, r] of [[-0.5, 1.2, 0.5], [0.45, 0.5, -0.6], [0.6, 1.3, 0.3]]) a.box(P.chest, 0.5, 0.05, 0.04, x, y, 0.64, glow, { glow: true, rz: r });
    for (const [x, y] of [[-0.7, 0.4], [0.8, 1.0], [-0.2, 1.4], [0.3, 0.2]]) a.box(P.chest, 0.22, 0.22, 0.18, x, y, 0.62, barn);
    for (let i = 0; i < 6; i++) { const x = -0.9 + i * 0.36, d = a.g(P.chest, x, 0.1, 0.6 - (i % 2) * 1.2); a.box(d, 0.16, 0.6 + (i % 3) * 0.2, 0.08, 0, -0.3 - (i % 3) * 0.1, 0, moss); P.drapes.push(d); }
    for (let i = 0; i < 4; i++) { const k = a.g(P.chest, -0.6 + i * 0.4, 1.4, -0.62); a.box(k, 0.12, 1.0, 0.08, 0, -0.5, 0, moss); P.kelp.push(k); }
    for (const sx of [-1, 1]) {
      a.box(P.chest, 0.95, 0.6, 1.05, sx * 1.35, 1.45, 0, stone); a.box(P.chest, 0.9, 0.2, 0.9, sx * 1.35, 1.8, 0, moss);
      for (const [dx, dz, hh] of [[0.2, 0.2, 0.5], [-0.15, -0.2, 0.7], [0.3, -0.25, 0.4]]) a.box(P.chest, 0.12, hh, 0.12, sx * (1.35 + dx), 1.8 + hh / 2, dz, coral, { glow: true, rz: sx * -0.25 });
      const s = a.g(P.chest, sx * 1.35, 1.35, 0); a.box(s, 0.6, 1.15, 0.62, 0, -0.55, 0, stone);
      const l = a.g(s, 0, -1.1, 0); a.box(l, 0.66, 1.1, 0.68, 0, -0.55, 0, stone); a.box(l, 0.74, 0.3, 0.76, 0, -0.1, 0, barn);
      a.box(l, 0.7, 0.4, 0.7, 0, -1.25, 0.05, dark);
      P.arms.push({ u: s, l, sx });
    }
    // the Tidebreaker: a barnacled anchor-blade in the right hand
    P.blade = a.g(P.arms[1].l, 0, -1.25, 0.1, -1.2);
    a.box(P.blade, 0.18, 2.6, 0.18, 0, 0.7, 0, SK(0x3a3a34, { stripe: { c: 0x2a2a24, axis: 'y', p: 0.3, w: 0.3 } }));
    a.box(P.blade, 0.16, 1.7, 0.75, 0, 1.55, 0.3, SK(0x6a7a76, { n: 0.08, patch: { c: 0x3e6a2e, s: 0.2, t: 0.66 }, speck: { c: 0xd8d0c0, p: 0.05 } }));
    a.box(P.blade, 0.1, 1.6, 0.08, 0, 1.55, 0.7, glow, { glow: true });
    a.box(P.blade, 1.1, 0.2, 0.2, 0, 0.0, 0, dark); a.box(P.blade, 0.2, 0.36, 0.2, 0.55, 0.15, 0, dark); a.box(P.blade, 0.2, 0.36, 0.2, -0.55, 0.15, 0, dark);
    for (const k of [-1, 0, 1]) a.box(P.arms[0].l, 0.14, 0.42, 0.14, k * 0.22, -1.55, 0.18, dark, { rx: 0.3 });
    // head: a drowned helm with a hinged jaw and a coral crown
    P.head = a.g(P.chest, 0, 1.45, 0.62);
    a.box(P.head, 0.95, 0.85, 0.95, 0, 0.25, 0.1, stone, { eyes: [EYE(1, 3, 2, 1, 0x6ef0ff, { glow: true })], ov: [['F', 1, 2, 3, 1, 0x1e2620, true], ['F', 'c', 5, 1, 2, 0x1e2620]] });
    P.jaw = a.g(P.head, 0, -0.15, 0.0); a.box(P.jaw, 0.82, 0.28, 0.85, 0, -0.12, 0.14, stone, { ov: [['F', 1, 0, 1, 1, 0xe8e0d0, true], ['F', 3, 0, 1, 1, 0xe8e0d0, true]] });
    a.box(P.jaw, 0.6, 0.06, 0.1, 0, 0.0, 0.52, glow, { glow: true });
    for (const [x, hh, r] of [[-0.3, 0.5, 0.3], [0, 0.7, 0], [0.3, 0.45, -0.3], [-0.42, 0.35, 0.6], [0.42, 0.38, -0.6]]) a.box(P.head, 0.1, hh, 0.1, x, 0.68 + hh / 2, 0.0, coral, { glow: true, rz: r });
    m.P = P; m.A = { kind: 'boss' };
  },
  colossus(a, m) {
    a.density(6);
    const st = SK(0x6a6e7a, { n: 0.08, patch: { c: 0x8a8e9a, s: 0.6, t: 0.62 }, stripe: { c: 0x5a5e6a, axis: 'y', p: 0.8, w: 0.06 } }), dark = SK(0x3a3e4a, { n: 0.1, speck: { c: 0x6ef0ff, p: 0.03 } });
    const heart = SK(0x6ef0ff, { n: 0.08, speck: { c: 0xffffff, p: 0.3 } }), cry = SK(0x56d2f0, { n: 0.08, speck: { c: 0xd8faff, p: 0.2 } });
    const P = { legs: [], arms: [] };
    for (const sx of [-1, 1]) {
      const u = a.g(null, sx * 1.15, 3.3, 0); a.box(u, 1.45, 1.75, 1.45, 0, -0.85, 0, dark);
      const l = a.g(u, 0, -1.65, 0.1); a.box(l, 1.3, 1.5, 1.3, 0, -0.75, -0.05, st); a.box(l, 1.6, 0.4, 1.9, 0, -1.45, 0.2, dark);
      P.legs.push({ u, l, sx });
    }
    P.body = a.g(null, 0, 3.3, 0);
    a.box(P.body, 2.8, 1.2, 1.6, 0, 0.3, 0, dark);
    P.chest = a.g(P.body, 0, 0.9, 0, 0.12);
    a.box(P.chest, 3.6, 2.6, 2.0, 0, 1.3, 0, st);
    P.core = a.g(P.chest, 0, 1.2, 1.02); a.box(P.core, 1.0, 1.0, 0.3, 0, 0, 0, heart, { glow: true });
    P.plate = a.g(P.chest, 0, 1.2, 1.18); a.box(P.plate, 1.7, 1.7, 0.3, 0, 0, 0, st, { ov: [['F', 'c', 4, 2, 2, 0x6ef0ff]] });
    for (const sx of [-1, 1]) {
      a.box(P.chest, 1.7, 1.1, 1.9, sx * 2.5, 2.4, 0, dark);
      for (const [dx, dz, hh] of [[0.3, 0.3, 1.0], [-0.3, -0.3, 1.4], [0.5, -0.4, 0.8]]) a.box(P.chest, 0.3, hh, 0.3, sx * (2.5 + dx), 2.95 + hh / 2, dz, cry, { glow: true, rz: sx * -0.3 });
      const s = a.g(P.chest, sx * 2.55, 2.3, 0); a.box(s, 1.1, 2.1, 1.1, 0, -1.0, 0, st);
      const l = a.g(s, 0, -2.0, 0); a.box(l, 1.15, 2.0, 1.15, 0, -1.0, 0, st); a.box(l, 1.5, 1.3, 1.5, 0, -2.3, 0.05, dark);
      P.arms.push({ u: s, l, sx });
    }
    P.head = a.g(P.chest, 0, 2.6, 0.3);
    a.box(P.head, 1.5, 1.3, 1.5, 0, 0.65, 0, st, { eyes: [EYE(1, 3, 2, 2, 0x6ef0ff, { glow: true })] });
    P.jaw = a.g(P.head, 0, 0.1, 0); a.box(P.jaw, 1.3, 0.35, 1.3, 0, -0.1, 0.12, dark);
    a.box(P.head, 1.7, 0.3, 0.3, 0, 1.25, 0.7, heart, { glow: true });
    m.P = P; m.A = { kind: 'boss' };
  },
});
