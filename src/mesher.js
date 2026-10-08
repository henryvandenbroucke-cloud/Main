'use strict';
/* Builds the mesh of one 16x16x16 section: vanilla face shading (top 1.0, north/south 0.8, east/west 0.6,
   bottom 0.5), smooth lighting with ambient occlusion, biome tints, and three passes (solid, cutout, translucent). */
const Mesher = (() => {
  const S = 18, S2 = S * S;
  const PB = new Uint16Array(S * S * S), PS = new Uint8Array(S * S * S), PL = new Uint8Array(S * S * S);
  const P = (x, y, z) => (x + 1) + (z + 1) * S + (y + 1) * S2;
  const SHADE = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];
  const AOV = [0.4, 0.6, 0.8, 1.0];
  // unit-cube face corners (counter-clockwise seen from outside) and their uv (u right, v down)
  const FC = [
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  ];
  // per face: the two in-plane axes used for smooth lighting at each corner
  const CO = FC.map((corners, f) => {
    const ax = f < 2 ? 1 : f < 4 ? 2 : 0, t1 = ax === 0 ? 1 : 0, t2 = ax === 2 ? 1 : 2;
    return corners.map(v => { const a = [0, 0, 0], b = [0, 0, 0]; a[t1] = v[t1] ? 1 : -1; b[t2] = v[t2] ? 1 : -1; return [a[0], a[1], a[2], b[0], b[1], b[2]]; });
  });
  // auto uv from a position inside the block (0..1), per face
  const UVF = [(x, y, z) => [x, 1 - z], (x, y, z) => [x, z], (x, y, z) => [1 - x, 1 - y], (x, y, z) => [x, 1 - y], (x, y, z) => [z, 1 - y], (x, y, z) => [1 - z, 1 - y]];

  function Buf() { this.cap = 0; this.n = 0; this.ni = 0; this.grow(2048); }
  Buf.prototype.grow = function (cap) {
    const p = new Float32Array(cap * 3), uv = new Float32Array(cap * 4), li = new Uint8Array(cap * 4), co = new Uint8Array(cap * 4), ix = new Uint32Array(cap * 1.5);
    if (this.cap) { p.set(this.p); uv.set(this.uv); li.set(this.li); co.set(this.co); ix.set(this.ix); }
    this.p = p; this.uv = uv; this.li = li; this.co = co; this.ix = ix; this.cap = cap;
  };
  const BUFS = [new Buf(), new Buf(), new Buf()];

  // one quad: 4 positions, 4 uvs, texture layer + frame count, 4 light (sky, block 0..15, shade 0..1), tint rgb
  const qL = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  function quad(b, pos, uvs, layer, frames, light, tr, tg, tb, flip) {
    if (b.n + 4 > b.cap) b.grow(b.cap * 2);
    const s = b.n;
    for (let k = 0; k < 4; k++) {
      const v = s + k, p = pos[k], u = uvs[k], l = light[k];
      b.p[v * 3] = p[0]; b.p[v * 3 + 1] = p[1]; b.p[v * 3 + 2] = p[2];
      b.uv[v * 4] = u[0]; b.uv[v * 4 + 1] = u[1]; b.uv[v * 4 + 2] = layer; b.uv[v * 4 + 3] = frames;
      b.li[v * 4] = l[0] * 17; b.li[v * 4 + 1] = l[1] * 17; b.li[v * 4 + 2] = l[2] * 255; b.li[v * 4 + 3] = 255;
      b.co[v * 4] = tr; b.co[v * 4 + 1] = tg; b.co[v * 4 + 2] = tb; b.co[v * 4 + 3] = 255;
    }
    const I = b.ix; let o = b.ni;
    // turn the diagonal so the ambient occlusion gradient looks right
    if (flip || light[0][2] + light[2][2] < light[1][2] + light[3][2]) { I[o++] = s + 1; I[o++] = s + 2; I[o++] = s + 3; I[o++] = s + 1; I[o++] = s + 3; I[o++] = s; }
    else { I[o++] = s; I[o++] = s + 1; I[o++] = s + 2; I[o++] = s; I[o++] = s + 2; I[o++] = s + 3; }
    b.ni = o; b.n += 4;
  }

  // copy the section and a one-block border into the padded arrays
  function fill(c, sy) {
    const near = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) near[(dx + 1) + (dz + 1) * 3] = World.getChunk(c.cx + dx, c.cz + dz);
    const y0 = sy * 16 - 64;
    let empty = true;
    for (let y = -1; y <= 16; y++) {
      const wy = y0 + y;
      for (let z = -1; z <= 16; z++) {
        const cz = z < 0 ? 0 : z > 15 ? 2 : 1, lz = (z + 16) & 15;
        for (let x = -1; x <= 16; x++) {
          const cx = x < 0 ? 0 : x > 15 ? 2 : 1, lx = (x + 16) & 15;
          const n = near[cx + cz * 3], p = P(x, y, z);
          if (!n || wy < MINY || wy > MAXY) { PB[p] = 0; PS[p] = 0; PL[p] = wy > MAXY ? 0xf0 : 0; if (!n) PB[p] = 1; continue; }
          const i = ((wy + 64) << 8) | (lz << 4) | lx;
          PB[p] = n.blocks[i]; PS[p] = n.states[i]; PL[p] = n.light[i];
          if (empty && x >= 0 && x < 16 && z >= 0 && z < 16 && y >= 0 && y < 16 && n.blocks[i]) empty = false;
        }
      }
    }
    return empty;
  }
  // biome tints for a chunk, blended over 5x5 columns like the game's default biome blend
  function tints(c) {
    if (c.tints) return c.tints;
    const out = new Uint8Array(256 * 9);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const acc = [0, 0, 0, 0, 0, 0, 0, 0, 0]; let n = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const wx = c.cx * 16 + x + dx, wz = c.cz * 16 + z + dz, ch = World.chunkAt(wx, wz);
        const b = BIOMES[ch ? ch.biomes[(wx & 15) + (wz & 15) * 16] : c.biomes[x + z * 16]];
        const cs = [b.grass, b.foliage, b.water];
        for (let k = 0; k < 3; k++) { acc[k * 3] += (cs[k] >> 16) & 255; acc[k * 3 + 1] += (cs[k] >> 8) & 255; acc[k * 3 + 2] += cs[k] & 255; }
        n++;
      }
      for (let k = 0; k < 9; k++) out[(x + z * 16) * 9 + k] = acc[k] / n;
    }
    let complete = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!World.getChunk(c.cx + dx, c.cz + dz)) complete = false;
    if (complete) c.tints = out;
    return out;
  }

  // smooth light for the face f of the block at padded position (x,y,z); writes 4 corners into qL
  function faceLight(x, y, z, f, smooth) {
    const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
    const ci = P(nx, ny, nz);
    let cl = PL[ci];
    if (OPAQUE[PB[ci]]) cl = PL[P(x, y, z)];
    const csk = cl >> 4, cbl = cl & 15, sh = SHADE[f];
    for (let k = 0; k < 4; k++) {
      const o = qL[k];
      if (!smooth) { o[0] = csk; o[1] = cbl; o[2] = sh; continue; }
      const q = CO[f][k];
      const ia = P(nx + q[0], ny + q[1], nz + q[2]), ib = P(nx + q[3], ny + q[4], nz + q[5]), ic = P(nx + q[0] + q[3], ny + q[1] + q[4], nz + q[2] + q[5]);
      const a = OPAQUE[PB[ia]], b = OPAQUE[PB[ib]], c = OPAQUE[PB[ic]] && !(a && b) ? 1 : (a && b ? 1 : 0);
      const ao = a && b ? 0 : 3 - (a + b + OPAQUE[PB[ic]]);
      const la = a ? cl : PL[ia], lb = b ? cl : PL[ib], lc = (a && b) || OPAQUE[PB[ic]] ? cl : PL[ic];
      // the game's blend: dark (zero) samples are replaced by the centre so edges don't get black seams
      let s1 = la >> 4, s2 = lb >> 4, s3 = lc >> 4, b1 = la & 15, b2 = lb & 15, b3 = lc & 15;
      if (!s1) s1 = csk; if (!s2) s2 = csk; if (!s3) s3 = csk; if (!b1) b1 = cbl; if (!b2) b2 = cbl; if (!b3) b3 = cbl;
      o[0] = (csk + s1 + s2 + s3) / 4; o[1] = (cbl + b1 + b2 + b3) / 4; o[2] = AOV[ao] * sh;
      void c;
    }
    return qL;
  }

  const posTmp = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], uvTmp = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const lTmp = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let smoothOn = true;

  function tintOf(d, st, tintArr, lx, lz) {
    const t = d.tint;
    if (!t) return null;
    const o = (lx + lz * 16) * 9;
    if (t === 'grass') return [tintArr[o], tintArr[o + 1], tintArr[o + 2]];
    if (t === 'foliage') return [tintArr[o + 3], tintArr[o + 4], tintArr[o + 5]];
    if (t === 'water') return [tintArr[o + 6], tintArr[o + 7], tintArr[o + 8]];
    if (t === 'redstone') { const p = st & 15; const r = p ? 0.4 + p / 15 * 0.6 : 0.3; return [r * 255, Math.max(0, r * r * 0.7 - 0.5) * 255, Math.max(0, r * r * 0.6 - 0.7) * 255]; }
    if (t === 'stem') { const a = st & 7; return [a * 32, 255 - a * 8, a * 4]; }
    if (typeof t === 'number') return [(t >> 16) & 255, (t >> 8) & 255, t & 255];
    return null;
  }

  // ---------------------------------------------------------------- the section
  function mesh(c, sy) {
    for (const b of BUFS) { b.n = 0; b.ni = 0; }
    if (fill(c, sy)) return null;
    const tintArr = tints(c);
    smoothOn = Settings.smooth;
    const bx = c.cx * 16, by = sy * 16 - 64, bz = c.cz * 16;
    const ctx = (x, y, z) => PB[P(x - bx, y - by, z - bz)];
    ctx.state = (x, y, z) => PS[P(x - bx, y - by, z - bz)];
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const id = PB[P(x, y, z)];
      if (id !== 0) block(x, y, z, id, tintArr, ctx, bx, by, bz);
    }
    return BUFS;
  }
  function block(x, y, z, id, tintArr, ctx, bx, by, bz) {
    const p = P(x, y, z);
    const d = BLOCKS[id], st = PS[p];
    const model = d.model;
    if (model === 'none') return;
    if (model === 'liquid') { liquid(d, st, x, y, z, tintArr); return; }
    // waterlogged blocks also draw their water
    if (st & 128 && d.waterlog) liquid(BLOCKS[BID.water], 0, x, y, z, tintArr, true);
    if (d.fluidLog) liquid(BLOCKS[BID.water], 0, x, y, z, tintArr, true);
    const buf = BUFS[d.layer];
    const tint = tintOf(d, st, tintArr, x, z);
    if (model === 'cube' && !d.place && !d.stateTex && d.name !== 'grass_block' && d.name !== 'farmland' && d.name !== 'redstone_lamp' && d.name !== 'jukebox') { cube(d, id, st, x, y, z, buf, tint); return; }
    const els = Models.get(id, st, ctx, bx + x, by + y, bz + z);
    elements(els, d, id, st, x, y, z, buf, tint, model);
  }
  // one block on its own (for inventory icons and held blocks), lit fully, with default biome colours
  const ICON_TINT = new Uint8Array(256 * 9);
  for (let i = 0; i < 256; i++) ICON_TINT.set([0x91, 0xbd, 0x59, 0x77, 0xab, 0x2f, 0x3f, 0x76, 0xe4], i * 9);
  function meshSingle(id, st) {
    for (const b of BUFS) { b.n = 0; b.ni = 0; }
    PB.fill(0); PS.fill(0); PL.fill(0xf0);
    PB[P(0, 0, 0)] = id; PS[P(0, 0, 0)] = st || 0;
    const prev = smoothOn; smoothOn = false;
    const ctx = (x, y, z) => (x === 0 && y === 0 && z === 0 ? id : 0); ctx.state = () => st || 0;
    block(0, 0, 0, id, ICON_TINT, ctx, 0, 0, 0);
    smoothOn = prev;
    return BUFS;
  }
  // a plain full cube (the fast path)
  function cube(d, id, st, x, y, z, buf, tint) {
    for (let f = 0; f < 6; f++) {
      const n = PB[P(x + DX[f], y + DY[f], z + DZ[f])];
      if (OPAQUE[n] || (d.cullSame && n === id)) continue;
      if (d.layer === 2 && n !== 0 && BLOCKS[n].layer === 2 && BLOCKS[n].model === 'cube' && d.cullSame && BLOCKS[n].cullSame && d.name.endsWith('glass') && BLOCKS[n].name.endsWith('glass')) continue;
      const t = Tex.get(d.tex[FACE_NAMES[f]]);
      const L = faceLight(x, y, z, f, smoothOn && !d.noAO);
      const corners = FC[f];
      for (let k = 0; k < 4; k++) { const v = corners[k]; posTmp[k][0] = x + v[0]; posTmp[k][1] = y + v[1]; posTmp[k][2] = z + v[2]; const uv = UVF[f](v[0], v[1], v[2]); uvTmp[k][0] = uv[0]; uvTmp[k][1] = uv[1]; }
      const tt = tint && (d.tint !== 'grass' || f === 1 || t.mask) ? tint : null;
      quad(buf, posTmp, uvTmp, t.layer, t.frames, L, tt ? tt[0] : 255, tt ? tt[1] : 255, tt ? tt[2] : 255);
    }
  }
  // generic boxes (with optional rotation)
  const rp = [0, 0, 0];
  function rotate(r, px, py, pz, out) {
    const ox = r.origin[0] / 16, oy = r.origin[1] / 16, oz = r.origin[2] / 16, a = r.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    let x = px - ox, y = py - oy, z = pz - oz;
    if (r.axis === 'x') { const ny = y * c - z * s, nz = y * s + z * c; y = ny; z = nz; }
    else if (r.axis === 'y') { const nx = x * c + z * s, nz = -x * s + z * c; x = nx; z = nz; }
    else { const nx = x * c - y * s, ny = x * s + y * c; x = nx; y = ny; }
    out[0] = x + ox; out[1] = y + oy; out[2] = z + oz;
    return out;
  }
  function elements(els, d, id, st, x, y, z, buf, tint, model) {
    for (const e of els) {
      const a = e.a, b = e.b;
      const x0 = a[0] / 16, y0 = a[1] / 16, z0 = a[2] / 16, x1 = b[0] / 16, y1 = b[1] / 16, z1 = b[2] / 16;
      for (let f = 0; f < 6; f++) {
        const tn = e.t[f]; if (!tn) continue;
        // which way the face points once the element is rotated
        let nf = f, rotated = false;
        if (e.r) {
          const nrm = rotate({ origin: [0, 0, 0], axis: e.r.axis, angle: e.r.angle }, DX[f], DY[f], DZ[f], rp);
          rotated = true; nf = -1;
          for (let k = 0; k < 6; k++) if (nrm[0] * DX[k] + nrm[1] * DY[k] + nrm[2] * DZ[k] > 0.99) nf = k;
        }
        // is the face on the block boundary?
        const onEdge = nf >= 0 && !rotated ? (f === 0 ? y0 === 0 : f === 1 ? y1 === 1 : f === 2 ? z0 === 0 : f === 3 ? z1 === 1 : f === 4 ? x0 === 0 : x1 === 1) : false;
        if (onEdge && !e.noCull) { const n = PB[P(x + DX[f], y + DY[f], z + DZ[f])]; if (OPAQUE[n] || (d.cullSame && n === id)) continue; }
        // zero-thickness faces of flat boxes still need both sides (they come in pairs from the model)
        const corners = FC[f];
        const tx = Tex.get(tn);
        const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0;
        let explicit = e.uv && e.uv[f];
        for (let k = 0; k < 4; k++) {
          const v = corners[k];
          const px = x0 + v[0] * ex, py = y0 + v[1] * ey, pz = z0 + v[2] * ez;
          let u, w;
          if (explicit) { const q = explicit, auv = UVF[f](v[0], v[1], v[2]); u = (q[0] + (q[2] - q[0]) * auv[0]) / 16; w = (q[1] + (q[3] - q[1]) * auv[1]) / 16; }
          else { const auv = UVF[f](px, py, pz); u = auv[0]; w = auv[1]; }
          const rr = e.rot && e.rot[f];
          if (rr) { for (let i = 0; i < rr / 90; i++) { const t = u; u = 1 - w; w = t; } }
          uvTmp[k][0] = u; uvTmp[k][1] = w;
          if (e.r) rotate(e.r, px, py, pz, rp); else { rp[0] = px; rp[1] = py; rp[2] = pz; }
          posTmp[k][0] = x + rp[0]; posTmp[k][1] = y + rp[1]; posTmp[k][2] = z + rp[2];
        }
        // light: faces on the edge use the neighbour's (smooth) light, inner faces the cell they look into
        let L;
        const lf = nf >= 0 ? nf : 1;
        if (nf >= 0 && !d.noAO && smoothOn) {
          const full = faceLight(x, y, z, lf, true);
          // bilinear blend of the face's corner light at each vertex
          for (let k = 0; k < 4; k++) {
            const pp = posTmp[k], fx = pp[0] - x, fy = pp[1] - y, fz = pp[2] - z;
            let s, t2;
            if (lf < 2) { s = fx; t2 = fz; } else if (lf < 4) { s = fx; t2 = fy; } else { s = fz; t2 = fy; }
            s = s < 0 ? 0 : s > 1 ? 1 : s; t2 = t2 < 0 ? 0 : t2 > 1 ? 1 : t2;
            // corners of FC[lf] in terms of (s, t2)
            const C = FC[lf];
            let w0 = 0, sum0 = 0, sum1 = 0, sum2 = 0;
            for (let j = 0; j < 4; j++) {
              const cv = C[j], cs = lf < 2 ? cv[0] : lf < 4 ? cv[0] : cv[2], ct = lf < 2 ? cv[2] : cv[1];
              const wgt = (cs ? s : 1 - s) * (ct ? t2 : 1 - t2);
              sum0 += full[j][0] * wgt; sum1 += full[j][1] * wgt; sum2 += full[j][2] * wgt; w0 += wgt;
            }
            lTmp[k][0] = sum0 / w0; lTmp[k][1] = sum1 / w0; lTmp[k][2] = sum2 / w0;
          }
          L = lTmp;
        } else {
          const own = PL[P(x, y, z)], cell = nf >= 0 ? PL[P(x + DX[nf], y + DY[nf], z + DZ[nf])] : own;
          const use = nf >= 0 && !OPAQUE[PB[P(x + DX[nf], y + DY[nf], z + DZ[nf])]] ? Math.max(cell >> 4, own >> 4) << 4 | Math.max(cell & 15, own & 15) : own;
          const sh = e.shade === false || model === 'cross' || model === 'tall' || model === 'crop' ? 1 : (nf >= 0 ? SHADE[nf] : 0.85);
          for (let k = 0; k < 4; k++) { lTmp[k][0] = use >> 4; lTmp[k][1] = use & 15; lTmp[k][2] = sh; }
          L = lTmp;
        }
        if (e.light) for (let k = 0; k < 4; k++) L[k][1] = Math.max(L[k][1], e.light);
        const tt = (e.tint === true || (Array.isArray(e.tint) && e.tint[f])) ? tint : null;
        quad(buf, posTmp, uvTmp, tx.layer, tx.frames, L, tt ? tt[0] : 255, tt ? tt[1] : 255, tt ? tt[2] : 255);
      }
    }
  }

  // ---------------------------------------------------------------- water and lava
  function fluidHeight(id, x, y, z) {
    // height of the fluid surface at a block, 0..1 (source 8/9, flowing (8 - level) / 9, 1 under more fluid)
    const b = PB[P(x, y, z)];
    if (!sameFluid(id, b, PS[P(x, y, z)])) return -1;
    if (sameFluid(id, PB[P(x, y + 1, z)], PS[P(x, y + 1, z)])) return 1;
    const st = PS[P(x, y, z)];
    const lvl = BLOCKS[b].fluid ? st & 7 : 0;
    if (BLOCKS[b].fluid && (st & 8)) return 8 / 9;
    return (8 - lvl) / 9;
  }
  function sameFluid(id, b, st) { if (b === id) return true; if (id === BID.water) { const d = BLOCKS[b]; return !!(d.fluidLog || (d.waterlog && (st & 128))); } return false; }
  function cornerHeight(id, x, y, z, cx, cz) {
    // average of the up to 4 blocks sharing the corner (cx, cz are -1 or 0 offsets)
    let sum = 0, w = 0;
    for (const [dx, dz] of [[cx, cz], [cx + 1, cz], [cx, cz + 1], [cx + 1, cz + 1]]) {
      const h = fluidHeight(id, x + dx, y, z + dz);
      if (h >= 1) return 1;
      if (h >= 0) { const wt = h >= 8 / 9 - 0.001 ? 10 : 1; sum += h * wt; w += wt; }
      else if (!SOLID[PB[P(x + dx, y, z + dz)]]) { w += 1; }
    }
    return w ? sum / w : 0;
  }
  const fp = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  function liquid(d, st, x, y, z, tintArr, logged) {
    const id = d.id, buf = BUFS[d.layer], tint = d.tint === 'water' ? tintOf(d, st, tintArr, x, z) : null;
    const tr = tint ? tint[0] : 255, tg = tint ? tint[1] : 255, tb = tint ? tint[2] : 255;
    const above = PB[P(x, y + 1, z)], aboveSame = sameFluid(id, above, PS[P(x, y + 1, z)]);
    let h00, h10, h01, h11;
    if (aboveSame) h00 = h10 = h01 = h11 = 1;
    else { h00 = cornerHeight(id, x, y, z, -1, -1); h10 = cornerHeight(id, x, y, z, 0, -1); h01 = cornerHeight(id, x, y, z, -1, 0); h11 = cornerHeight(id, x, y, z, 0, 0); }
    const still = Tex.get(d.tex.up), flow = Tex.get(d.tex.side);
    // top
    if (!aboveSame && !OPAQUE[above]) {
      const L = faceLight(x, y, z, 1, false);
      const flat = Math.abs(h00 - h11) < 0.01 && Math.abs(h10 - h01) < 0.01 && Math.abs(h00 - h10) < 0.01;
      const t = flat ? still : flow;
      fp[0][0] = x; fp[0][1] = y + h00; fp[0][2] = z; fp[1][0] = x; fp[1][1] = y + h01; fp[1][2] = z + 1;
      fp[2][0] = x + 1; fp[2][1] = y + h11; fp[2][2] = z + 1; fp[3][0] = x + 1; fp[3][1] = y + h10; fp[3][2] = z;
      // flowing water: the texture runs downhill
      let ang = 0;
      if (!flat) { const gx = (h10 + h11) - (h00 + h01), gz = (h01 + h11) - (h00 + h10); ang = Math.atan2(-gx, gz); }
      const ca = Math.cos(ang), sa = Math.sin(ang), sc = flat ? 1 : 0.5;
      for (let k = 0; k < 4; k++) { const u = fp[k][0] - x - 0.5, v = fp[k][2] - z - 0.5; uvTmp[k][0] = (u * ca - v * sa) * sc + 0.5; uvTmp[k][1] = (u * sa + v * ca) * sc + 0.5; }
      for (let k = 0; k < 4; k++) { lTmp[k][0] = L[k][0]; lTmp[k][1] = Math.max(L[k][1], d.light); lTmp[k][2] = 1; }
      quad(buf, fp, uvTmp, t.layer, t.frames, lTmp, tr, tg, tb);
      // the underside of the surface, seen from below the water
      if (d.layer === 2) {
        const rv = [fp[3], fp[2], fp[1], fp[0]], ruv = [uvTmp[3].slice(), uvTmp[2].slice(), uvTmp[1].slice(), uvTmp[0].slice()];
        quad(buf, rv, ruv, t.layer, t.frames, lTmp, tr, tg, tb);
      }
    }
    // sides
    const hs = [[h00, h10], [h11, h01], [h01, h00], [h10, h11]]; // per side face: heights at its two top corners (in FC order of top corners)
    for (let f = 2; f < 6; f++) {
      const nx = x + DX[f], nz = z + DZ[f], n = PB[P(nx, y, nz)];
      if (OPAQUE[n] || sameFluid(id, n, PS[P(nx, y, nz)])) continue;
      if (logged && SOLID[n] && BLOCKS[n].model === 'cube') continue;
      let ha, hb; // heights at FC[f][3] (top-left) and FC[f][2] (top-right)
      if (f === 2) { ha = h10; hb = h00; } else if (f === 3) { ha = h01; hb = h11; } else if (f === 4) { ha = h00; hb = h01; } else { ha = h11; hb = h10; }
      const C = FC[f];
      for (let k = 0; k < 4; k++) { const v = C[k]; fp[k][0] = x + v[0]; fp[k][2] = z + v[2]; fp[k][1] = y + (v[1] ? (k === 2 ? hb : ha) : 0); }
      uvTmp[0][0] = 0; uvTmp[0][1] = 1; uvTmp[1][0] = 0.5; uvTmp[1][1] = 1; uvTmp[2][0] = 0.5; uvTmp[2][1] = 1 - hb * 0.5; uvTmp[3][0] = 0; uvTmp[3][1] = 1 - ha * 0.5;
      const L = faceLight(x, y, z, f, false);
      for (let k = 0; k < 4; k++) { lTmp[k][0] = L[k][0]; lTmp[k][1] = Math.max(L[k][1], d.light); lTmp[k][2] = SHADE[f]; }
      quad(buf, fp, uvTmp, flow.layer, flow.frames, lTmp, tr, tg, tb);
      if (d.layer === 2) quad(buf, [fp[1], fp[0], fp[3], fp[2]], [uvTmp[1].slice(), uvTmp[0].slice(), uvTmp[3].slice(), uvTmp[2].slice()], flow.layer, flow.frames, lTmp, tr, tg, tb);
    }
    // bottom
    const below = PB[P(x, y - 1, z)];
    if (!OPAQUE[below] && !sameFluid(id, below, PS[P(x, y - 1, z)])) {
      const C = FC[0], L = faceLight(x, y, z, 0, false);
      for (let k = 0; k < 4; k++) { const v = C[k]; fp[k][0] = x + v[0]; fp[k][1] = y; fp[k][2] = z + v[2]; uvTmp[k][0] = v[0]; uvTmp[k][1] = v[2]; lTmp[k][0] = L[k][0]; lTmp[k][1] = Math.max(L[k][1], d.light); lTmp[k][2] = 0.5; }
      quad(buf, fp, uvTmp, still.layer, still.frames, lTmp, tr, tg, tb);
    }
  }
  return { mesh, meshSingle, BUFS, faceLight };
})();
