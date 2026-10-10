'use strict';
/* Entity movement against block shapes, with the game's step-up of 0.6, and block ray casting. */
const Phys = (() => {
  const boxes = [];
  // all collision boxes touching the region (world coordinates)
  function collect(x0, y0, z0, x1, y1, z1, ent) {
    boxes.length = 0;
    const bx0 = Math.floor(x0), by0 = Math.floor(y0) - 1, bz0 = Math.floor(z0), bx1 = Math.floor(x1), by1 = Math.floor(y1), bz1 = Math.floor(z1);
    for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) {
      if (!World.loaded(x, z)) { boxes.push([x, by0, z, x + 1, by1 + 1, z + 1]); continue; } // unloaded ground holds you up
      for (let y = by0; y <= by1; y++) {
        const id = World.getBlock(x, y, z);
        // powder snow: you sink in, unless you land on it from a height or stand on top in leather boots
        if (id === BID.powder_snow) {
          if (ent && ent.type === 'falling_block') { boxes.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
          if (!ent || !ent.canWalkOnPowderSnow) continue;
          if (ent.fallDistance > 2.5) boxes.push([x, y, z, x + 1, y + 0.9, z + 1]);
          else if (ent.y > y + 1 - 1e-5 && !ent.sneaking && ent.canWalkOnPowderSnow()) boxes.push([x, y, z, x + 1, y + 1, z + 1]);
          continue;
        }
        if (!SOLID[id]) continue;
        const sh = Models.shape(id, World.getState(x, y, z), x, y, z, true);
        if (!sh) continue;
        for (const s of sh) boxes.push([x + s[0], y + s[1], z + s[2], x + s[3], y + s[4], z + s[5]]);
      }
    }
    if (ent && ent.extraBoxes) for (const b of ent.extraBoxes()) boxes.push(b);
    return boxes;
  }
  // clip a movement along one axis against the boxes (the game's "calculateXOffset")
  function clipY(bb, list, dy) { for (const b of list) { if (bb[3] <= b[0] || bb[0] >= b[3] || bb[5] <= b[2] || bb[2] >= b[5]) continue; if (dy > 0 && bb[4] <= b[1]) { const d = b[1] - bb[4]; if (d < dy) dy = d; } else if (dy < 0 && bb[1] >= b[4]) { const d = b[4] - bb[1]; if (d > dy) dy = d; } } return dy; }
  function clipX(bb, list, dx) { for (const b of list) { if (bb[4] <= b[1] || bb[1] >= b[4] || bb[5] <= b[2] || bb[2] >= b[5]) continue; if (dx > 0 && bb[3] <= b[0]) { const d = b[0] - bb[3]; if (d < dx) dx = d; } else if (dx < 0 && bb[0] >= b[3]) { const d = b[3] - bb[0]; if (d > dx) dx = d; } } return dx; }
  function clipZ(bb, list, dz) { for (const b of list) { if (bb[3] <= b[0] || bb[0] >= b[3] || bb[4] <= b[1] || bb[1] >= b[4]) continue; if (dz > 0 && bb[5] <= b[2]) { const d = b[2] - bb[5]; if (d < dz) dz = d; } else if (dz < 0 && bb[2] >= b[5]) { const d = b[5] - bb[2]; if (d > dz) dz = d; } } return dz; }
  const off = (bb, x, y, z) => [bb[0] + x, bb[1] + y, bb[2] + z, bb[3] + x, bb[4] + y, bb[5] + z];
  // move an entity by (dx,dy,dz); sets e.onGround, e.hitH (horizontal collision), e.hitV
  function move(e, dx, dy, dz) {
    if (e.noClip) { e.x += dx; e.y += dy; e.z += dz; e.onGround = false; return; }
    const hw = e.w / 2;
    let bb = [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + e.h, e.z + hw];
    // sneaking on the ground: don't walk off edges
    if (e.sneakEdge && e.onGround) {
      const step = 0.05;
      while (dx !== 0 && !groundUnder(off(bb, dx, -0.6, 0), e)) { if (dx < step && dx >= -step) dx = 0; else if (dx > 0) dx -= step; else dx += step; }
      while (dz !== 0 && !groundUnder(off(bb, 0, -0.6, dz), e)) { if (dz < step && dz >= -step) dz = 0; else if (dz > 0) dz -= step; else dz += step; }
      while (dx !== 0 && dz !== 0 && !groundUnder(off(bb, dx, -0.6, dz), e)) { if (dx < step && dx >= -step) dx = 0; else if (dx > 0) dx -= step; else dx += step; if (dz < step && dz >= -step) dz = 0; else if (dz > 0) dz -= step; else dz += step; }
    }
    const ox = dx, oy = dy, oz = dz;
    const list = collect(Math.min(bb[0], bb[0] + dx) - 1, Math.min(bb[1], bb[1] + dy) - 1, Math.min(bb[2], bb[2] + dz) - 1, Math.max(bb[3], bb[3] + dx) + 1, Math.max(bb[4], bb[4] + dy) + 1, Math.max(bb[5], bb[5] + dz) + 1, e).slice();
    dy = clipY(bb, list, dy); let nb = off(bb, 0, dy, 0);
    dx = clipX(nb, list, dx); nb = off(nb, dx, 0, 0);
    dz = clipZ(nb, list, dz); nb = off(nb, 0, 0, dz);
    // step up (0.6 blocks) when walking into something low
    const stepH = e.stepHeight === undefined ? 0.6 : e.stepHeight;
    if (stepH > 0 && (e.onGround || (oy !== dy && oy < 0)) && (ox !== dx || oz !== dz)) {
      const l2 = collect(Math.min(bb[0], bb[0] + ox) - 1, bb[1] - 1, Math.min(bb[2], bb[2] + oz) - 1, Math.max(bb[3], bb[3] + ox) + 1, bb[4] + stepH + 1, Math.max(bb[5], bb[5] + oz) + 1, e).slice();
      let sy = clipY(bb, l2, stepH), sb = off(bb, 0, sy, 0);
      let sx = clipX(sb, l2, ox); sb = off(sb, sx, 0, 0);
      let sz = clipZ(sb, l2, oz); sb = off(sb, 0, 0, sz);
      const down = clipY(sb, l2, -sy + (oy < 0 ? oy : 0)); sb = off(sb, 0, down, 0);
      if (sx * sx + sz * sz > dx * dx + dz * dz + 1e-7) { dx = sx; dz = sz; dy = sy + down; nb = sb; }
    }
    e.hitH = ox !== dx || oz !== dz; e.hitX = ox !== dx; e.hitZ = oz !== dz;
    e.hitV = oy !== dy;
    e.onGround = oy !== dy && oy < 0;
    e.x = (nb[0] + nb[3]) / 2; e.y = nb[1]; e.z = (nb[2] + nb[5]) / 2;
    if (ox !== dx) e.vx = 0; if (oz !== dz) e.vz = 0;
    if (oy !== dy) e.vy = 0;
  }
  function groundUnder(bb, e) { const l = collect(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], e); for (const b of l) if (bb[3] > b[0] && bb[0] < b[3] && bb[4] > b[1] && bb[1] < b[4] && bb[5] > b[2] && bb[2] < b[5]) return true; return false; }
  // does the box overlap any solid block shape?
  function boxFree(x0, y0, z0, x1, y1, z1) { const l = collect(x0, y0, z0, x1, y1, z1); for (const b of l) if (x1 > b[0] + 1e-4 && x0 < b[3] - 1e-4 && y1 > b[1] + 1e-4 && y0 < b[4] - 1e-4 && z1 > b[2] + 1e-4 && z0 < b[5] - 1e-4) return false; return true; }
  // blocks overlapping a box, for fluids, cobwebs, fire, portals...
  function touching(e, fn, grow) {
    const g = grow || 0, hw = e.w / 2;
    const x0 = Math.floor(e.x - hw - g + 0.001), x1 = Math.floor(e.x + hw + g - 0.001), y0 = Math.floor(e.y - g + 0.001), y1 = Math.floor(e.y + e.h + g - 0.001), z0 = Math.floor(e.z - hw - g + 0.001), z1 = Math.floor(e.z + hw + g - 0.001);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const id = World.getBlock(x, y, z); if (id && fn(id, x, y, z)) return true; }
    return false;
  }
  // ray against block selection shapes; returns the first hit
  function raycast(ox, oy, oz, dx, dy, dz, max, accept) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
    let ty = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
    let tz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
    for (let i = 0; i < 64; i++) {
      const id = World.getBlock(x, y, z);
      if (id && (!accept || accept(id, x, y, z))) {
        const st = World.getState(x, y, z);
        const shapes = Models.shape(id, st, x, y, z, false);
        if (shapes) {
          let best = null;
          for (const s of shapes) { const h = rayBox(ox, oy, oz, dx, dy, dz, x + s[0], y + s[1], z + s[2], x + s[3], y + s[4], z + s[5]); if (h && h.t <= max && (!best || h.t < best.t)) best = h; }
          if (best) return { x, y, z, id, state: st, face: best.face, t: best.t, px: ox + dx * best.t, py: oy + dy * best.t, pz: oz + dz * best.t };
        }
      }
      if (tx < ty && tx < tz) { if (tx > max) break; x += sx; tx += tdx; }
      else if (ty < tz) { if (ty > max) break; y += sy; ty += tdy; }
      else { if (tz > max) break; z += sz; tz += tdz; }
    }
    return null;
  }
  // slab method; face: 0 down .. 5 east (the face that was hit)
  function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = -Infinity, tmax = Infinity, face = -1;
    const ax = [[ox, dx, x0, x1, 4, 5], [oy, dy, y0, y1, 0, 1], [oz, dz, z0, z1, 2, 3]];
    for (const [o, d, a, b, fneg, fpos] of ax) {
      if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
      let t1 = (a - o) / d, t2 = (b - o) / d, f1 = fneg, f2 = fpos;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; f1 = fpos; f2 = fneg; }
      if (t1 > tmin) { tmin = t1; face = f1; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    return { t: Math.max(0, tmin), face };
  }
  return { move, raycast, rayBox, boxFree, touching, collect };
})();
