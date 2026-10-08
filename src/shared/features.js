'use strict';
/* Trees, huge mushrooms and other features. Shared: the world generator places them while making chunks and
   the game uses the same code when a sapling grows. Each takes a writer w with get(x,y,z), set(x,y,z,id,state)
   and a Rand. Shapes follow the vanilla trees (heights and canopy layouts of the 1.21 tree features). */
SHARED.push(function featuresModule(G) {
  const { BID } = G;
  const AIRLIKE = new Uint8Array(G.NBLOCKS);
  for (const d of G.BLOCKS) if (d.replaceable || d.model === 'none' || d.name.endsWith('_leaves') || d.name.endsWith('_sapling') || d.name === 'mangrove_propagule' || d.model === 'cross' || d.name === 'vine') AIRLIKE[d.id] = 1;
  AIRLIKE[BID.water] = 0; AIRLIKE[BID.lava] = 0;
  const canReplace = (w, x, y, z) => { const b = w.get(x, y, z); return b === 0 || AIRLIKE[b]; };
  const leaf = (w, x, y, z, id) => { const b = w.get(x, y, z); if (b === 0 || (AIRLIKE[b] && b !== id && !G.BLOCKS[b].name.endsWith('_leaves'))) w.set(x, y, z, id, 0); };
  const log = (w, x, y, z, id, axis) => { if (canReplace(w, x, y, z) || w.get(x, y, z) === BID.water) w.set(x, y, z, id, axis || 0); };
  const dirtBelow = (w, x, y, z) => { const b = w.get(x, y, z); if (b === BID.grass_block || b === BID.farmland || b === BID.mycelium || b === BID.podzol) w.set(x, y, z, BID.dirt, 0); };

  // oak and birch: 4-6 (birch 5-7) blocks, two wide layers and two narrow layers of leaves with random corners
  function oak(w, r, x, y, z, o) {
    o = o || {};
    const L = o.log || BID.oak_log, Lv = o.leaves || BID.oak_leaves;
    const h = (o.base || 4) + r.int(o.extra !== undefined ? o.extra : 3);
    dirtBelow(w, x, y - 1, z);
    for (let dy = h - 3; dy <= h; dy++) {
      const top = dy - h, rad = 1 - Math.floor(top / 2);
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (top === 0 || r.int(2) === 0)) continue;
        leaf(w, x + dx, y + dy, z + dz, Lv);
      }
    }
    for (let i = 0; i < h; i++) log(w, x, y + i, z, L);
    if (o.vines) vinesAround(w, r, x, y + h - 3, z, 3, 3);
    if (o.bees && r.chance(0.05)) { const f = [[0, -1], [0, 1], [-1, 0], [1, 0]][r.int(4)]; if (w.get(x + f[0], y + 2, z + f[1]) === 0) w.set(x + f[0], y + 2, z + f[1], BID.bee_nest || 0, 0); }
    return h;
  }
  // fancy (large) oak: a taller trunk with branches ending in leaf balls
  function fancyOak(w, r, x, y, z) {
    const h = 6 + r.int(8);
    dirtBelow(w, x, y - 1, z);
    const ball = (bx, by, bz) => {
      for (let dy = 0; dy < 5; dy++) { const rad = dy === 0 || dy === 4 ? 2 : 3; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (dx * dx + dz * dz <= rad * rad - (dy === 0 || dy === 4 ? 1 : 0) + 0.5) leaf(w, bx + dx, by + dy, bz + dz, BID.oak_leaves); }
    };
    const branches = 2 + r.int(3);
    for (let i = 0; i < branches; i++) {
      const by = y + Math.floor(h * 0.5) + r.int(Math.ceil(h * 0.5) - 1), a = r.next() * Math.PI * 2, len = 2 + r.int(3);
      const ex = Math.round(x + Math.cos(a) * len), ez = Math.round(z + Math.sin(a) * len), ey = by + 1 + r.int(2);
      ball(ex, ey, ez);
      const n = Math.max(Math.abs(ex - x), Math.abs(ez - z), Math.abs(ey - by));
      for (let k = 0; k <= n; k++) { const px = Math.round(x + (ex - x) * k / n), py = Math.round(by + (ey - by) * k / n), pz = Math.round(z + (ez - z) * k / n); log(w, px, py, pz, BID.oak_log, Math.abs(ex - x) > Math.abs(ez - z) ? 1 : (ex === x && ez === z ? 0 : 2)); }
    }
    ball(x, y + h - 2, z);
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.oak_log);
  }
  // spruce: conical layers that alternate between wide and narrow, with a single leaf on top
  function spruce(w, r, x, y, z, o) {
    o = o || {};
    const h = 6 + r.int(4), bare = 1 + r.int(2), top = h - bare, maxR = 2 + r.int(2);
    dirtBelow(w, x, y - 1, z);
    let rad = r.int(2), start = 1, next = 0;
    for (let i = 0; i <= top; i++) {
      const ly = y + h - i;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (!(Math.abs(dx) === rad && Math.abs(dz) === rad && rad > 0)) leaf(w, x + dx, ly, z + dz, BID.spruce_leaves);
      if (rad >= start) { rad = next; next = 1; start = Math.min(start + 1, maxR); } else rad++;
    }
    leaf(w, x, y + h + 1, z, BID.spruce_leaves);
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.spruce_log);
    if (o.snow) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let yy = y + h + 1; yy > y; yy--) { if (w.get(x + dx, yy, z + dz) === BID.spruce_leaves) { if (w.get(x + dx, yy + 1, z + dz) === 0) w.set(x + dx, yy + 1, z + dz, BID.snow, 0); break; } }
  }
  // pine: a tall bare trunk with a short narrow crown
  function pine(w, r, x, y, z) {
    const h = 7 + r.int(5), crown = 3 + r.int(2);
    dirtBelow(w, x, y - 1, z);
    for (let i = 0; i <= crown; i++) {
      const ly = y + h - i, rad = i === 0 ? 0 : i === crown ? 1 : (i % 2 ? 1 : 2) - (i === 1 ? 1 : 0);
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (!(Math.abs(dx) === rad && Math.abs(dz) === rad && rad > 1)) leaf(w, x + dx, ly, z + dz, BID.spruce_leaves);
    }
    leaf(w, x, y + h + 1, z, BID.spruce_leaves);
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.spruce_log);
  }
  // giant spruce / pine of the old growth taigas: a 2x2 trunk 13-30 tall
  function megaSpruce(w, r, x, y, z, pineTop) {
    const h = 13 + r.int(15);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { dirtBelow(w, x + dx, y - 1, z + dz); if (w.get(x + dx, y - 1, z + dz) === BID.dirt) w.set(x + dx, y - 1, z + dz, BID.podzol, 0); }
    const crown = pineTop ? 3 + r.int(4) : Math.floor(h * 0.6);
    for (let i = 0; i <= crown; i++) {
      const ly = y + h - i;
      const rad = pineTop ? (i < 2 ? 1 : 2) : Math.floor(i / 3) + 1 - (i % 3 === 0 ? 0 : 0);
      for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
        const ddx = dx <= 0 ? -dx : dx - 1, ddz = dz <= 0 ? -dz : dz - 1;
        if (ddx * ddx + ddz * ddz > rad * rad + 1) continue;
        leaf(w, x + dx, ly, z + dz, BID.spruce_leaves);
      }
    }
    for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) log(w, x + dx, y + i, z + dz, BID.spruce_log);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) leaf(w, x + dx, y + h, z + dz, BID.spruce_leaves);
  }
  // jungle tree: 4-10 tall with vines and cocoa; the giant version is 2x2 and 10-30 tall with side branches
  function jungle(w, r, x, y, z) {
    const h = 4 + r.int(7);
    oak(w, r, x, y, z, { log: BID.jungle_log, leaves: BID.jungle_leaves, base: h, extra: 1, vines: true });
    for (let i = 1; i < h - 2; i++) if (r.chance(0.18)) { const f = r.int(4); const d = [[0, -1, 3], [0, 1, 2], [-1, 0, 5], [1, 0, 4]][f]; if (w.get(x + d[0], y + i, z + d[1]) === 0) w.set(x + d[0], y + i, z + d[1], BID.cocoa, d[2] | (r.int(3) << 3)); }
  }
  function megaJungle(w, r, x, y, z) {
    const h = 10 + r.int(20);
    const canopy = (cx, cy, cz, rad) => { for (let dy = -1; dy <= 0; dy++) { const rr = rad - dy * -1 - (dy === 0 ? 1 : 0); for (let dx = -rr; dx <= rr + 1; dx++) for (let dz = -rr; dz <= rr + 1; dz++) if (dx * dx + dz * dz <= rr * rr + 2) leaf(w, cx + dx, cy + dy + 1, cz + dz, BID.jungle_leaves); } };
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dirtBelow(w, x + dx, y - 1, z + dz);
    canopy(x, y + h, z, 3);
    for (let by = y + h - 2 - r.int(4); by > y + h / 2; by -= 2 + r.int(4)) {
      const a = r.next() * Math.PI * 2, ex = x + Math.round(Math.cos(a) * 4), ez = z + Math.round(Math.sin(a) * 4);
      for (let k = 0; k < 5; k++) log(w, Math.round(x + (ex - x) * k / 4), by + (k > 2 ? 1 : 0), Math.round(z + (ez - z) * k / 4), BID.jungle_log, Math.abs(ex - x) > Math.abs(ez - z) ? 1 : 2);
      canopy(ex, by + 1, ez, 2);
    }
    for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) log(w, x + dx, y + i, z + dz, BID.jungle_log);
    for (let i = 0; i < h; i++) for (const [dx, dz, f] of [[-1, 0, 8], [2, 0, 4], [0, -1, 2], [0, 2, 1], [-1, 1, 8], [2, 1, 4], [1, -1, 2], [1, 2, 1]]) if (r.chance(0.3) && w.get(x + dx, y + i, z + dz) === 0) w.set(x + dx, y + i, z + dz, BID.vine, f);
  }
  function jungleBush(w, r, x, y, z) {
    log(w, x, y, z, BID.jungle_log);
    for (let dy = 0; dy <= 2; dy++) { const rad = 2 - dy; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) !== rad || Math.abs(dz) !== rad || r.int(2)) leaf(w, x + dx, y + dy, z + dz, BID.oak_leaves); }
  }
  // acacia: the trunk leans one way and splits, with flat leaf platforms
  function acacia(w, r, x, y, z) {
    const h = 5 + r.int(3) + r.int(3), dir = r.int(4), D = [[0, -1], [0, 1], [-1, 0], [1, 0]][dir];
    dirtBelow(w, x, y - 1, z);
    const bendAt = h - r.int(4) - 1, bendLen = 3 - r.int(3);
    let px = x, pz = z, top = y;
    for (let i = 0; i < h; i++) { if (i >= bendAt && i - bendAt < bendLen) { px += D[0]; pz += D[1]; } log(w, px, y + i, pz, BID.acacia_log); top = y + i; }
    const flat = (cx, cy, cz) => {
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (!(Math.abs(dx) === 3 && Math.abs(dz) === 3)) leaf(w, cx + dx, cy, cz + dz, BID.acacia_leaves);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) leaf(w, cx + dx, cy + 1, cz + dz, BID.acacia_leaves);
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) leaf(w, cx + dx, cy + 1, cz + dz, BID.acacia_leaves);
    };
    flat(px, top + 1, pz);
    if (r.chance(0.6)) {
      const d2 = [[0, -1], [0, 1], [-1, 0], [1, 0]][(dir + 2) % 4]; let qx = x, qz = z;
      const start = bendAt - 1 - r.int(2), len = 1 + r.int(3);
      for (let i = 0; i < len; i++) { qx += d2[0]; qz += d2[1]; log(w, qx, y + start + i + 1, qz, BID.acacia_log); }
      if (len) flat(qx, y + start + len + 1, qz);
    }
  }
  // dark oak: a 2x2 trunk 6-8 tall with a wide, flat-ish canopy
  function darkOak(w, r, x, y, z) {
    const h = 6 + r.int(3);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dirtBelow(w, x + dx, y - 1, z + dz);
    const ty = y + h;
    for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 3; dz++) {
      leaf(w, x + dx, ty, z + dz, BID.dark_oak_leaves);
      if (dx > -2 && dx < 3 && dz > -2 && dz < 3) leaf(w, x + dx, ty + 1, z + dz, BID.dark_oak_leaves);
      if ((dx === -2 || dx === 3) !== (dz === -2 || dz === 3)) leaf(w, x + dx, ty - 1, z + dz, BID.dark_oak_leaves);
    }
    for (let dx = -3; dx <= 4; dx++) for (let dz = -3; dz <= 4; dz++) if ((dx === -3 || dx === 4 || dz === -3 || dz === 4) && !((dx === -3 || dx === 4) && (dz === -3 || dz === 4)) && r.chance(0.6)) leaf(w, x + dx, ty, z + dz, BID.dark_oak_leaves);
    for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) log(w, x + dx, y + i, z + dz, BID.dark_oak_log);
    for (let k = 0; k < 2; k++) if (r.chance(0.5)) { const bx = x + (r.int(2) ? -1 : 2), bz = z + r.int(2); log(w, bx, ty - 2, bz, BID.dark_oak_log, 1); }
  }
  // swamp oak: an oak with a wider canopy and hanging vines
  function swampOak(w, r, x, y, z) {
    const h = 5 + r.int(4);
    for (let dy = h - 3; dy <= h; dy++) { const rad = dy - h >= -1 ? 2 : 3; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (!(Math.abs(dx) === rad && Math.abs(dz) === rad && r.int(2))) leaf(w, x + dx, y + dy, z + dz, BID.oak_leaves); }
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.oak_log);
    vinesAround(w, r, x, y + h - 3, z, 4, 4);
  }
  // mangrove: a trunk raised on arching roots in mud, with hanging propagules
  function mangrove(w, r, x, y, z) {
    const rise = 2 + r.int(2), h = rise + 4 + r.int(4);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) if (r.chance(0.8)) {
      const rx = x + dx * 2, rz = z + dz * 2; for (let i = -2; i <= rise; i++) { const t = (i + 2) / (rise + 2); log(w, Math.round(x + (rx - x) * (1 - t)), y + i, Math.round(z + (rz - z) * (1 - t)), BID.mangrove_roots || BID.mangrove_log); }
    }
    for (let i = rise; i < h; i++) log(w, x, y + i, z, BID.mangrove_log);
    for (let dy = h - 3; dy <= h + 1; dy++) { const rad = dy >= h ? 2 : 3; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (dx * dx + dz * dz <= rad * rad + 1 && r.chance(0.92)) leaf(w, x + dx, y + dy, z + dz, BID.mangrove_leaves); }
    vinesAround(w, r, x, y + h - 3, z, 4, 3);
  }
  // cherry: a short trunk splitting into two or three curved branches with pink canopies
  function cherry(w, r, x, y, z) {
    const h = 4 + r.int(3);
    dirtBelow(w, x, y - 1, z);
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.cherry_log);
    const tops = [[x, y + h, z]];
    const nb = 1 + r.int(2);
    for (let b = 0; b < nb; b++) {
      const a = r.next() * Math.PI * 2, len = 3 + r.int(2); let px = x, pz = z, py = y + h - 2 - r.int(2);
      for (let k = 1; k <= len; k++) { px = Math.round(x + Math.cos(a) * k); pz = Math.round(z + Math.sin(a) * k); py += k > 1 ? 1 : 0; log(w, px, py, pz, BID.cherry_log, Math.abs(Math.cos(a)) > 0.7 ? 1 : 2); }
      tops.push([px, py + 1, pz]);
    }
    for (const [tx, ty, tz] of tops) for (let dy = -2; dy <= 2; dy++) { const rad = dy === 2 ? 2 : dy === -2 ? 3 : 4; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (dx * dx + dz * dz <= rad * rad - (dy === 0 ? 1 : 2) && r.chance(0.95)) leaf(w, tx + dx, ty + dy, tz + dz, BID.cherry_leaves); }
  }
  // azalea tree (above lush caves): a short bent trunk with azalea leaves
  function azaleaTree(w, r, x, y, z) {
    const h = 4 + r.int(2);
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.oak_log);
    for (let dy = h - 2; dy <= h + 1; dy++) { const rad = dy === h + 1 ? 1 : 2; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (r.chance(0.85)) leaf(w, x + dx, y + dy, z + dz, r.chance(0.3) ? BID.flowering_azalea_leaves : BID.azalea_leaves); }
    if (w.get(x, y - 1, z) === BID.grass_block || w.get(x, y - 1, z) === BID.dirt) w.set(x, y - 1, z, BID.rooted_dirt, 0);
  }
  // huge mushrooms: a red one has a dome cap, a brown one a flat wide cap
  function hugeMushroom(w, r, x, y, z, red) {
    const h = 4 + r.int(3) + (r.chance(1 / 12) ? h2(r) : 0);
    for (let i = 0; i < h; i++) log(w, x, y + i, z, BID.mushroom_stem);
    if (red) {
      for (let dy = h - 3; dy <= h; dy++) {
        const rad = dy < h ? 2 : 1;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          const edge = Math.abs(dx) === rad || Math.abs(dz) === rad;
          if (dy < h && !edge) continue;
          if (dy < h && Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
          leaf(w, x + dx, y + dy, z + dz, BID.red_mushroom_block);
        }
      }
    } else {
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (!(Math.abs(dx) === 3 && Math.abs(dz) === 3)) leaf(w, x + dx, y + h, z + dz, BID.brown_mushroom_block);
    }
  }
  const h2 = r => r.int(5);
  function vinesAround(w, r, x, y, z, rad, maxLen) {
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (!r.chance(0.25)) continue;
      // hang from the side of a leaf block that faces open air
      for (const [ox, oz, face] of [[-1, 0, 8], [1, 0, 4], [0, -1, 2], [0, 1, 1]]) {
        const lx = x + dx, lz = z + dz;
        if (!G.BLOCKS[w.get(lx, y + 1, lz)].name.endsWith('_leaves') && !G.BLOCKS[w.get(lx, y, lz)].name.endsWith('_leaves')) continue;
        const vx = lx + ox, vz = lz + oz;
        let vy = y + 1;
        if (w.get(vx, vy, vz) !== 0) continue;
        const len = 1 + r.int(maxLen + 1);
        for (let i = 0; i < len && w.get(vx, vy - i, vz) === 0; i++) w.set(vx, vy - i, vz, BID.vine, face);
        break;
      }
    }
  }
  // the tree a sapling (or bone meal) grows into
  function growSapling(w, r, x, y, z, name, big) {
    switch (name) {
      case 'oak_sapling': if (r.chance(0.1)) fancyOak(w, r, x, y, z); else oak(w, r, x, y, z); return true;
      case 'birch_sapling': oak(w, r, x, y, z, { log: BID.birch_log, leaves: BID.birch_leaves, base: 5 }); return true;
      case 'spruce_sapling': if (big) megaSpruce(w, r, x, y, z, false); else spruce(w, r, x, y, z); return true;
      case 'jungle_sapling': if (big) megaJungle(w, r, x, y, z); else jungle(w, r, x, y, z); return true;
      case 'acacia_sapling': acacia(w, r, x, y, z); return true;
      case 'dark_oak_sapling': if (!big) return false; darkOak(w, r, x, y, z); return true;
      case 'cherry_sapling': cherry(w, r, x, y, z); return true;
      case 'mangrove_propagule': mangrove(w, r, x, y, z); return true;
      case 'azalea': case 'flowering_azalea': azaleaTree(w, r, x, y, z); return true;
      case 'red_mushroom': hugeMushroom(w, r, x, y, z, true); return true;
      case 'brown_mushroom': hugeMushroom(w, r, x, y, z, false); return true;
    }
    return false;
  }
  G.Features = { oak, fancyOak, spruce, pine, megaSpruce, jungle, megaJungle, jungleBush, acacia, darkOak, swampOak, mangrove, cherry, azaleaTree, hugeMushroom, vinesAround, growSapling };
});
