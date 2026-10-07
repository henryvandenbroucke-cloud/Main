'use strict';
/* Villages, landmarks, camps and dungeons. */
const Sites = [];             // {name, sub, cat, x, y, z, r, found}
const Chests = new Map();     // key -> {table, items|null}
const Lore = new Map();       // key -> {title, text, art}
const Emitters = [];          // {x,y,z,type}  smoke / embers / sparkle
const SpawnPoints = [];       // {x,y,z,type,n,r,alive:[]}
const BossRooms = [];         // {type,x,y,z,r,done}
const Windmills = [];         // {x,y,z,axis}
const Portals = [];           // {x,y,z,to:[x,y,z]}
const K = (x, y, z) => x + ',' + y + ',' + z;
const PROT = new Uint8Array(W * D); // columns owned by a structure; later terraforming leaves them alone
function protect(cx, cz, r) { for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && z >= 0 && x < W && z < D && Math.hypot(x - cx, z - cz) <= r) PROT[x + z * W] = 1; }

function mk(ox, oy, oz, r) {
  const tr = (lx, lz) => r === 0 ? [lx, lz] : r === 1 ? [-lz, lx] : r === 2 ? [-lx, -lz] : [lz, -lx];
  const f = (lx, ly, lz, id, face) => { const [wx, wz] = tr(lx, lz); setB(ox + wx, oy + ly, oz + wz, id, ((face || 0) & 4) | (((face || 0) + r) & 3)); return [ox + wx, oy + ly, oz + wz]; };
  f.at = (lx, ly, lz) => { const [wx, wz] = tr(lx, lz); return [ox + wx, oy + ly, oz + wz]; };
  f.get = (lx, ly, lz) => { const p = f.at(lx, ly, lz); return getB(p[0], p[1], p[2]); };
  f.r = r;
  return f;
}
function fill(P, x0, y0, z0, x1, y1, z1, id, face) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) P(x, y, z, id, face);
}
function shell(P, x0, y0, z0, x1, y1, z1, wall) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const e = x === x0 || x === x1 || z === z0 || z === z1 || y === y0 || y === y1;
    P(x, y, z, e ? wall : B.AIR);
  }
}
function addChest(P, lx, ly, lz, table, face) { const p = P(lx, ly, lz, B.CHEST, face || 0); Chests.set(K(p[0], p[1], p[2]), { table, items: null }); return p; }
function addLore(P, lx, ly, lz, title, text, art, id) { const p = P(lx, ly, lz, id || B.TABLET); Lore.set(K(p[0], p[1], p[2]), { title, text, art }); return p; }
function addSite(name, sub, cat, x, y, z, r) { const s = { name, sub, cat, x, y, z, r, found: false }; Sites.push(s); return s; }
function addSpawn(x, y, z, type, n, r) { SpawnPoints.push({ x, y, z, type, n, r: r || 6, alive: [], cool: 0 }); }

// smooth terraform: flat disc of radius r at gy with a sloped skirt that blends into the terrain
function terraform(cx, cz, r, gy, top, under, skirt) {
  skirt = skirt === undefined ? 7 : skirt;
  const R = r + skirt;
  for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
    if (x < 1 || z < 1 || x >= W - 1 || z >= D - 1) continue;
    const d = Math.hypot(x - cx, z - cz);
    if (d > R) continue;
    if (PROT[x + z * W]) continue;
    const t = d <= r ? 0 : (d - r) / skirt;
    const orig = hmap[x + z * W];
    const target = Math.round(lerp(gy, orig, t * t * (3 - 2 * t)));
    for (let y = H - 1; y > target; y--) { const id = getB(x, y, z); if (d <= r || (id !== B.WATER && id !== B.LAVA) || y > SEA) setB(x, y, z, B.AIR); }
    setB(x, target, z, top);
    for (let y = target - 1; y > 0; y--) {
      const id = getB(x, y, z);
      if (SOLID[id] && !BLK[id].cutLike && id !== B.LOG && id !== B.DARKLOG && y < target - 3) break;
      setB(x, y, z, y > target - 4 ? under : B.STONE);
    }
    if (d > r && target < SEA && bmap[x + z * W] !== 5) for (let y = target + 1; y <= SEA; y++) setB(x, y, z, B.WATER);
    hmap[x + z * W] = target;
  }
}
function findSpot(rad, o) {
  o = o || {};
  let maxVar = o.maxVar || 5, minDist = o.minDist === undefined ? 50 : o.minDist;
  for (let t = 0; t < 1500; t++) {
    if (t % 400 === 399) { maxVar += 3; minDist = Math.max(20, minDist - 8); }
    let x, z;
    if (o.near) { x = Math.round(o.near[0] + (rng() - 0.5) * 2 * o.spread); z = Math.round(o.near[1] + (rng() - 0.5) * 2 * o.spread); }
    else { x = Math.round(rad + 8 + rng() * (W - 2 * rad - 16)); z = Math.round(rad + 8 + rng() * (D - 2 * rad - 16)); }
    if (x < rad + 6 || z < rad + 6 || x > W - rad - 7 || z > D - rad - 7) continue;
    if (o.biome !== undefined && bmap[x + z * W] !== o.biome) continue;
    let mn = 99, mx = 0, wet = 0, okB = true;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const sx = x + Math.round(a * rad / 2), sz = z + Math.round(b * rad / 2), h = hmap[sx + sz * W];
      if (h < SEA) wet++;
      if (o.biome !== undefined && bmap[sx + sz * W] !== o.biome) okB = false;
      mn = Math.min(mn, h); mx = Math.max(mx, h);
    }
    if (o.strict && !okB) continue;
    if (!o.wet && wet > (o.allowWet || 2)) continue;
    if (o.wet && wet < o.wet) continue;
    if (mx - mn > maxVar) continue;
    if (Sites.some(s => Math.hypot(s.x - x, s.z - z) < Math.max(minDist, (s.r || 0) + rad + 10))) continue;
    const gy = o.gy !== undefined ? o.gy : Math.max(SEA + 1, Math.round(o.useMax ? mx : (hmap[x + z * W] + mn + mx) / 3));
    return { x, z, gy };
  }
  return null;
}
function pathLine(x0, z0, x1, z1, w) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= n; i++) {
    const cx = Math.round(x0 + (x1 - x0) * i / n), cz = Math.round(z0 + (z1 - z0) * i / n);
    for (let a = -(w >> 1); a <= (w - 1) >> 1; a++) for (let b = -(w >> 1); b <= (w - 1) >> 1; b++) {
      const x = cx + a, z = cz + b; if (!inWorld(x, 1, z)) continue;
      const y = surfaceY(x, z), id = getB(x, y, z);
      if (id === B.GRASS || id === B.DIRT || id === B.SAND || id === B.SWAMPGRASS || id === B.ASH || id === B.SNOW || (id === B.STONE && y > SEA)) {
        setB(x, y, z, hash3(x, y, z) < 0.15 ? B.GRAVEL : B.PATH);
        const up = getB(x, y + 1, z); if (BLK[up].render === 'cross') setB(x, y + 1, z, B.AIR);
      } else if (id === B.WATER && w >= 2) { setB(x, y + 1 > SEA ? y : y, z, B.WATER); setB(x, SEA + 1, z, B.PLANKS); }
    }
  }
}

// ---------------------------------------------------------------- building parts
const STYLES = {
  meadow: { wall: B.PLASTER, frame: B.LOG, floor: B.PLANKS, roof: B.THATCH, trim: B.PLANKS_DARK, roofType: 'gable', found: B.COBBLE, base: B.COBBLE, posts: B.LOG, band: B.PLANKS_DARK, boxes: true },
  barn: { wall: B.WOOL_RED, frame: B.WOOL_WHITE, floor: B.PLANKS, roof: B.PLANKS_DARK, trim: B.WOOL_WHITE, roofType: 'gable', found: B.COBBLE },
  stilt: { wall: B.PLANKS, frame: B.DARKLOG, floor: B.PLANKS, roof: B.PLANKS_DARK, trim: B.DARKLOG, roofType: 'gable', found: B.DARKLOG, base: B.PLANKS_DARK, posts: B.DARKLOG },
  desert: { wall: B.SANDSTONE, frame: B.SANDBRICK, floor: B.SANDBRICK, roof: B.SANDBRICK, trim: B.TERRACOTTA, roofType: 'flat', found: B.SANDBRICK, base: B.SANDBRICK, band: B.TERRACOTTA },
  mining: { wall: B.STONEBRICK, frame: B.DARKLOG, floor: B.PLANKS_DARK, roof: B.ROOF_BLUE, trim: B.POLISHED, roofType: 'gable', found: B.STONEBRICK, base: B.COBBLE, posts: B.DARKLOG, variants: [B.MOSSYBRICK, B.CRACKEDBRICK], boxes: true },
  library: { wall: B.STONEBRICK, frame: B.LOG, floor: B.PLANKS, roof: B.ROOF_RED, trim: B.POLISHED, roofType: 'gable', found: B.COBBLE, base: B.MOSSYCOBBLE, variants: [B.MOSSYBRICK, B.CRACKEDBRICK], band: B.POLISHED, boxes: true },
};

// roof material -> [stairs, slab] used for sloped roofs, porches and ridges
const ROOF_SHAPES = { [B.THATCH]: [B.THATCH_STAIRS, B.THATCH_SLAB], [B.PLANKS_DARK]: [B.GNARLED_STAIRS, B.GNARLED_SLAB], [B.PLANKS]: [B.OAK_STAIRS, B.OAK_SLAB], [B.ROOF_RED]: [B.ROOF_RED_STAIRS, B.ROOF_RED_SLAB],
  [B.ROOF_BLUE]: [B.ROOF_BLUE_STAIRS, B.ROOF_BLUE_SLAB], [B.SANDBRICK]: [B.SANDSTONE_STAIRS, B.SANDSTONE_SLAB], [B.COBBLE]: [B.COBBLE_STAIRS, B.COBBLE_SLAB], [B.STONEBRICK]: [B.STONEBRICK_STAIRS, B.STONEBRICK_SLAB] };
// house centered on (cx,gy,cz); local -z is the front (door)
function house(cx, gy, cz, r, hw, hd, wh, st, kind, loot) {
  const P = mk(cx, gy, cz, r);
  fill(P, -hw - 2, 1, -hd - 2, hw + 2, wh + hw + 6, hd + 2, B.AIR);
  fill(P, -hw, -3, -hd, hw, -1, hd, st.found);
  fill(P, -hw, 0, -hd, hw, 0, hd, st.floor);
  for (let ly = 1; ly <= wh; ly++) for (let lz = -hd; lz <= hd; lz++) for (let lx = -hw; lx <= hw; lx++) {
    const edgeX = Math.abs(lx) === hw, edgeZ = Math.abs(lz) === hd;
    if (!edgeX && !edgeZ) continue;
    const corner = edgeX && edgeZ;
    let id = corner ? st.frame : st.wall;
    const along = edgeZ ? lx : lz, half = edgeZ ? hw : hd;
    if (!corner && st.base && ly === 1) id = (st.base === B.COBBLE && hash3(cx + lx, ly, cz + lz) < 0.25) ? B.MOSSYCOBBLE : st.base;
    else if (!corner && st.posts && Math.abs(along) % 3 === 0 && Math.abs(along) < half) id = st.posts;
    else if (!corner && st.variants && hash3(cx + lx * 3, ly, cz + lz * 7) < 0.14) id = st.variants[Math.floor(hash3(lx, ly * 5, lz) * st.variants.length)];
    if (!corner && st.band && ly === wh && st.roofType === 'flat') id = st.band;
    if (!corner && ly === wh && st.roofType !== 'flat') id = st.band || st.frame;
    const win = !corner && ly === 2 && ((edgeZ && Math.abs(lx) % 3 === 1 && Math.abs(lx) < hw) || (edgeX && Math.abs(lz) % 3 === 1 && Math.abs(lz) < hd));
    if (win) id = B.GLASS;
    P(lx, ly, lz, id);
    if (win && st.boxes && !(edgeZ && lz < 0 && Math.abs(lx) <= 1)) { // flower box under the window, outside
      const ox = edgeX ? Math.sign(lx) : 0, oz = edgeZ ? Math.sign(lz) : 0;
      P(lx + ox, 1, lz + oz, B.PLANKS_DARK); P(lx + ox, 2, lz + oz, [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE][Math.floor(hash3(cx + lx, 2, cz + lz) * 3)]);
    }
  }
  P(0, 1, -hd, B.AIR); P(0, 2, -hd, B.AIR);
  P(-1, 3, -hd - 1, B.LAMP);
  if (st.boxes) for (const sx of [-1, 1]) if (getB(...P.at(sx * (hw + 1), 1, -hd - 1)) === B.AIR) P(sx * (hw + 1), 1, -hd - 1, B.LEAVES); // hedges by the front corners
  P(0, 0, -hd - 1, B.PATH); P(0, -1, -hd - 1, B.DIRT);
  // roof
  if (st.roofType === 'flat') {
    fill(P, -hw, wh + 1, -hd, hw, wh + 1, hd, st.roof);
    for (let lx = -hw; lx <= hw; lx++) for (const e of [-hd, hd]) P(lx, wh + 2, e, (lx + e) % 2 ? st.trim : st.roof);
    for (let lz = -hd; lz <= hd; lz++) for (const e of [-hw, hw]) P(e, wh + 2, lz, (lz + e) % 2 ? st.trim : st.roof);
  } else {
    // gable roof of stairs rising to a ridge, overhanging the walls by one block all round
    const sh = ROOF_SHAPES[st.roof], gable = st.wall === B.WOOL_RED ? B.WOOL_RED : st.trim;
    for (let k = 0; ; k++) {
      const ez = hd + 1 - k; if (ez < 0) break;
      const y = wh + 1 + k;
      for (let lx = -hw - 1; lx <= hw + 1; lx++) {
        if (ez === 0) { P(lx, y, 0, sh ? sh[1] : st.roof); if (sh) P(lx, y - 1, 0, Math.abs(lx) <= hw ? st.roof : sh[1], 4); continue; }
        if (sh) { P(lx, y, ez, sh[0], 0); P(lx, y, -ez, sh[0], 2); } else { P(lx, y, ez, st.roof); P(lx, y, -ez, st.roof); }
        if (Math.abs(lx) === hw) for (let lz = -ez + 1; lz <= ez - 1; lz++) P(lx, y, lz, gable);
      }
    }
    // a little window high in each gable, and a small porch roof over the door
    if (hd >= 3) for (const e of [-hw, hw]) P(e, wh + 2, 0, B.GLASS);
    if (sh) { for (let lx = -1; lx <= 1; lx++) P(lx, 4, -hd - 1, sh[1]); P(-2, 3, -hd - 1, sh[0], 5); P(2, 3, -hd - 1, sh[0], 7); }
  }
  P(0, wh, 0, B.LAMP);
  // interior
  const back = hd - 1;
  if (kind !== 'empty') {
    if (kind !== 'barn' && kind !== 'shop') { // fireplace + chimney
      fill(P, -1, 1, hd, 1, 3, hd, B.REDBRICK); P(0, 1, hd, B.FIRE); P(0, 1, hd + 1, B.REDBRICK); P(0, 2, hd + 1, B.REDBRICK);
      const top = wh + hd + 3;
      for (let y = 2; y <= top; y++) P(0, y, hd + 1, B.REDBRICK);
      fill(P, -1, 3, hd + 1, 1, 3, hd + 1, B.REDBRICK);
      const c = P.at(0, top + 1, hd + 1); Emitters.push({ x: c[0] + 0.5, y: c[1], z: c[2] + 0.5, type: 'smoke' });
      P(-1, 1, hd - 1, B.AIR);
    }
    if (kind === 'home' || kind === 'stilt' || kind === 'desert' || kind === 'mining') {
      P(-hw + 1, 1, back, B.WOOL_RED); P(-hw + 1, 1, back - 1, B.WOOL_WHITE); // bed
      if (hw >= 3) { P(-hw + 2, 1, back, B.WOOL_RED); P(-hw + 2, 1, back - 1, B.WOOL_WHITE); }
      addChest(P, hw - 1, 1, back, loot || 'house', 0);
      P(hw - 1, 1, -hd + 1, B.BARREL); P(-hw + 1, 1, -hd + 1, B.FENCE); P(-hw + 1, 2, -hd + 1, B.POT);
      for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 0; lz++) if (Math.abs(lx) < hw - 1) P(lx, 0, lz, kind === 'desert' ? B.WOOL_BLUE : B.WOOL_RED);
      if (hw >= 3) P(hw - 1, 1, 0, B.BOOKSHELF);
      if (hw >= 3 && kind !== 'desert') { P(-1, 1, 0, B.FENCE); P(-1, 2, 0, B.OAK_SLAB); P(-1, 1, -1, B.OAK_STAIRS, 0); } // a little table and a chair
    }
    if (kind === 'library') {
      for (let lz = -hd + 1; lz <= hd - 1; lz++) for (let ly = 1; ly <= 3; ly++) { P(-hw + 1, ly, lz, B.BOOKSHELF); P(hw - 1, ly, lz, B.BOOKSHELF); }
      P(-hw + 1, 1, -hd + 1, B.AIR); P(hw - 1, 1, -hd + 1, B.AIR); P(-hw + 1, 2, -hd + 1, B.AIR); P(hw - 1, 2, -hd + 1, B.AIR);
      fill(P, -1, 0, -1, 1, 0, 2, B.WOOL_RED);
      P(0, 1, 1, B.TABLE); addChest(P, 1, 1, 2, 'library', 0); P(-1, 1, 2, B.LAMP);
    }
    if (kind === 'barn') {
      fill(P, -hw + 1, 1, 1, -hw + 2, 2, hd - 1, B.HAY); fill(P, hw - 2, 1, hd - 2, hw - 1, 1, hd - 1, B.HAY);
      P(hw - 1, 1, -hd + 1, B.BARREL); P(hw - 1, 2, -hd + 1, B.BARREL); P(hw - 2, 1, -hd + 1, B.CRATE);
      fill(P, -hw + 1, 4, 0, hw - 1, 4, hd - 1, B.PLANKS); // loft
      for (let ly = 1; ly <= 4; ly++) P(hw - 1, ly, -1, B.LADDER, 2);
      P(hw - 1, 4, -1, B.AIR);
      fill(P, -hw + 1, 5, 1, -hw + 3, 5, hd - 1, B.HAY);
      addChest(P, 0, 5, hd - 1, 'farm', 0);
      P(0, 1, -hd, B.AIR); P(0, 2, -hd, B.AIR); P(0, 3, -hd, B.AIR); P(1, 1, -hd, B.AIR); P(1, 2, -hd, B.AIR); P(1, 3, -hd, B.AIR); P(-1, 1, -hd, B.AIR); P(-1, 2, -hd, B.AIR); P(-1, 3, -hd, B.AIR);
    }
  }
  return P;
}
function lampPost(x, gy, z, crystal) { for (let i = 1; i <= 3; i++) setB(x, gy + i, z, B.FENCE); setB(x, gy + 4, z, crystal ? B.CRYSTAL : B.LAMP); }
function stall(x, gy, z, r, a, b, loot) {
  const P = mk(x, gy, z, r);
  for (const sx of [-2, 2]) for (const sz of [-1, 1]) fill(P, sx, 1, sz, sx, 3, sz, B.FENCE);
  for (let lz = -2; lz <= 2; lz++) for (let lx = -2; lx <= 2; lx++) P(lx, 4, lz, (lx + 2) % 2 ? a : b);
  for (let lx = -1; lx <= 1; lx++) P(lx, 1, -1, B.PLANKS);
  P(-1, 2, -1, B.POT); P(1, 2, -1, B.BARREL);
  P(-2, 1, 1, B.CRATE); P(2, 1, 1, B.BARREL);
  addChest(P, 0, 1, 1, loot || 'market', 0);
}
function fountain(cx, gy, cz) {
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    const m = Math.max(Math.abs(dx), Math.abs(dz));
    if (m === 3) { setB(cx + dx, gy, cz + dz, B.POLISHED); setB(cx + dx, gy + 1, cz + dz, B.STONEBRICK); }
    else { setB(cx + dx, gy, cz + dz, B.WATER); setB(cx + dx, gy - 1, cz + dz, B.POLISHED); }
  }
  for (let y = 0; y <= 3; y++) setB(cx, gy + y, cz, B.STONEPOST);
  setB(cx, gy + 4, cz, B.WATER); setB(cx, gy + 5, cz, B.LAMP);
  Emitters.push({ x: cx + 0.5, y: gy + 4.6, z: cz + 0.5, type: 'splash' });
}
function waystone(x, gy, z) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setB(x + dx, gy, z + dz, B.POLISHED);
  setB(x, gy + 1, z, B.WAYSTONE); setB(x, gy + 2, z, B.WAYSTONE);
  Emitters.push({ x: x + 0.5, y: gy + 2.5, z: z + 0.5, type: 'rune' });
}
function windmill(cx, gy, cz, r) {
  const P = mk(cx, gy, cz, r);
  fill(P, -3, -3, -3, 3, 0, 3, B.COBBLE);
  for (let ly = 1; ly <= 12; ly++) {
    const rad = ly < 5 ? 3 : ly < 9 ? 2.6 : 2.2;
    for (let lz = -3; lz <= 3; lz++) for (let lx = -3; lx <= 3; lx++) {
      const d = Math.max(Math.abs(lx), Math.abs(lz)) + (Math.abs(lx) === Math.abs(lz) ? 0.6 : 0);
      if (d <= rad && d > rad - 1.1) P(lx, ly, lz, ly % 4 === 0 ? B.LOG : B.PLASTER);
      else if (d <= rad) P(lx, ly, lz, B.AIR);
    }
  }
  for (let k = 0; k < 4; k++) for (let lz = -3 + k; lz <= 3 - k; lz++) for (let lx = -3 + k; lx <= 3 - k; lx++) {
    const m = 3 - k; if (Math.max(Math.abs(lx), Math.abs(lz)) !== m) continue;
    if (m === 0 || (Math.abs(lx) === m && Math.abs(lz) === m)) { P(lx, 13 + k, lz, m === 0 ? B.THATCH_SLAB : B.THATCH); continue; }
    P(lx, 13 + k, lz, B.THATCH_STAIRS, Math.abs(lx) === m ? (lx > 0 ? 3 : 1) : (lz > 0 ? 0 : 2)); // a pyramid of stairs rising to the cap
  }
  P(0, 1, -3, B.AIR); P(0, 2, -3, B.AIR); P(0, 1, -2, B.AIR); P(0, 2, -2, B.AIR);
  for (let ly = 1; ly <= 9; ly++) P(0, ly, 2, B.LADDER, 2);
  P(0, 9, -3, B.LOG); P(0, 9, -4, B.LOG);
  const hub = P.at(0, 9, -5);
  Windmills.push({ x: hub[0] + 0.5, y: hub[1] + 0.5, z: hub[2] + 0.5, r });
  P(0, 1, 0, B.HAY); P(1, 1, 1, B.BARREL);
  addChest(P, -1, 1, 1, 'farm', 0);
}

// ---------------------------------------------------------------- villages
function villageWheatmere(s) {
  const { x: cx, z: cz, gy } = s;
  terraform(cx, cz, 30, gy, B.GRASS, B.DIRT, 9);
  addSite('Wheatmere', 'Farming village', 'village', cx, gy, cz, 30);
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) if (Math.hypot(dx, dz) < 6.8) setB(cx + dx, gy, cz + dz, (dx + dz) % 3 ? B.COBBLE : B.GRAVEL);
  fountain(cx, gy, cz);
  waystone(cx + 5, gy, cz - 5);
  s.spawn = [cx + 5.5, gy + 1, cz - 3.5];
  lampPost(cx - 6, gy, cz - 6); lampPost(cx + 6, gy, cz + 6); lampPost(cx - 6, gy, cz + 6); lampPost(cx + 6, gy, cz - 6);
  for (let k = -1; k <= 1; k++) { setB(cx - 5, gy + 1, cz + k, B.OAK_STAIRS, 3); setB(cx + k, gy + 1, cz + 5, B.OAK_STAIRS, 2); } // benches facing the fountain
  stall(cx - 9, gy, cz - 1, 1, B.WOOL_BLUE, B.WOOL_WHITE); stall(cx + 9, gy, cz + 1, 3, B.WOOL_RED, B.WOOL_WHITE); stall(cx + 1, gy, cz + 9, 2, B.WOOL_YELLOW, B.WOOL_RED);
  const homes = [[-14, -12, 3, 3], [0, -16, 3, 3], [14, -12, 3, 2], [-17, 4, 2, 3], [-12, 16, 3, 3], [16, 14, 2, 3]];
  for (const [ox, oz, hw, hd] of homes) {
    const r = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 3 : 1) : (oz > 0 ? 0 : 2);
    house(cx + ox, gy, cz + oz, r, hw, hd, 4, STYLES.meadow, 'home', 'house');
    pathLine(cx + ox, cz + oz, cx, cz, 2);
  }
  house(cx + 17, gy, cz - 1, 3, 3, 4, 5, STYLES.library, 'library', 'library');
  pathLine(cx + 17, cz - 1, cx, cz, 2);
  house(cx - 2, gy, cz + 22, 0, 4, 5, 6, STYLES.barn, 'barn', 'farm');
  windmill(cx - 24, gy, cz - 4, 1);
  pathLine(cx - 24, cz - 4, cx, cz, 2);
  // fields with irrigation
  for (const [fx, fz] of [[20, 20], [-24, 14]]) {
    for (let dz = -3; dz <= 3; dz++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + fx + dx, z = cz + fz + dz;
      if (Math.abs(dx) === 4 || Math.abs(dz) === 3) { setB(x, gy + 1, z, B.FENCE); continue; }
      if (dz === 0) { setB(x, gy, z, B.WATER); continue; }
      setB(x, gy, z, B.FARMLAND); setB(x, gy + 1, z, B.WHEAT);
    }
    setB(cx + fx, gy + 1, cz + fz - 3, B.AIR);
  }
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4, x = Math.round(cx + Math.cos(a) * 27), z = Math.round(cz + Math.sin(a) * 27); if (getB(x, gy + 1, z) === 0) { setB(x, gy + 1, z, B.HAY); if (i % 2) setB(x, gy + 2, z, B.HAY); } }
  return s;
}
function villageStiltwick(s) {
  const { x: cx, z: cz } = s, deck = SEA + 2;
  addSite('Stiltwick', 'Fishing village', 'village', cx, deck, cz, 28);
  // flood the area into a shallow lagoon
  for (let z = cz - 28; z <= cz + 28; z++) for (let x = cx - 28; x <= cx + 28; x++) {
    const d = Math.hypot(x - cx, z - cz); if (d > 28) continue;
    const h = Math.min(hmap[x + z * W], SEA - 1 - (d < 22 ? 1 : 0));
    for (let y = H - 1; y > h; y--) setB(x, y, z, y <= SEA ? B.WATER : B.AIR);
    setB(x, h, z, B.MUD); hmap[x + z * W] = h;
    if (hash3(x, 5, z) < 0.08 && d > 4) setB(x, SEA + 1, z, B.LILYPAD);
  }
  const post = (x, z) => { for (let y = deck - 1; y > 0 && !SOLID[getB(x, y, z)]; y--) setB(x, y, z, B.DARKLOG); for (let y = deck - 1; y > 0 && getB(x, y, z) === B.DARKLOG; y--); };
  const boardwalk = (x0, z0, x1, z1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n);
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      for (let w = -1; w <= 1; w++) { const bx = along ? x : x + w, bz = along ? z + w : z; setB(bx, deck, bz, B.PLANKS); for (let y = deck + 1; y < deck + 4; y++) if (getB(bx, y, bz) === B.LILYPAD || getB(bx, y, bz) === B.WATER) setB(bx, y, bz, B.AIR); }
      if (i % 4 === 0) { const ax = along ? x : x - 2, az = along ? z - 2 : z, bx2 = along ? x : x + 2, bz2 = along ? z + 2 : z; post(along ? x : x - 1, along ? z - 1 : z); post(along ? x : x + 1, along ? z + 1 : z); setB(ax, deck + 1, az, B.FENCE); setB(bx2, deck + 1, bz2, B.FENCE); if (i % 8 === 0) { setB(ax, deck + 2, az, B.FENCE); setB(ax, deck + 3, az, B.LAMP); } }
    }
  };
  // central platform
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { setB(cx + dx, deck, cz + dz, (dx + dz) % 4 ? B.PLANKS : B.PLANKS_DARK); if ((Math.abs(dx) === 5 || Math.abs(dz) === 5) && (dx + dz) % 2 === 0) post(cx + dx, cz + dz); }
  waystone(cx, deck, cz); s.spawn = [cx + 2.5, deck + 1, cz + 2.5];
  for (const [dx, dz] of [[-5, -5], [5, 5], [-5, 5], [5, -5]]) { for (let y = 1; y <= 3; y++) setB(cx + dx, deck + y, cz + dz, B.FENCE); setB(cx + dx, deck + 4, cz + dz, B.LAMP); }
  const homes = [[-14, -10], [12, -13], [-15, 9], [14, 10], [0, 17], [0, -18]];
  homes.forEach(([ox, oz], i) => {
    boardwalk(cx, cz, cx + ox, cz);
    boardwalk(cx + ox, cz, cx + ox, cz + oz);
    const hx = cx + ox, hz = cz + oz;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { setB(hx + dx, deck, hz + dz, B.PLANKS); if (Math.abs(dx) === 4 && Math.abs(dz) === 4) post(hx + dx, hz + dz); }
    const r = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 3 : 1) : (oz > 0 ? 0 : 2);
    if (i === 4) { // boat workshop: open shed with a dry-docked boat
      const P = mk(hx, deck, hz, r);
      for (const [a, b] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) fill(P, a, 1, b, a, 5, b, B.DARKLOG);
      fill(P, -4, 6, -4, 4, 6, 4, B.PLANKS_DARK); fill(P, -3, 7, -3, 3, 7, 3, B.PLANKS_DARK);
      for (let lz = -3; lz <= 2; lz++) { P(-1, 1, lz, B.PLANKS_DARK); P(1, 1, lz, B.PLANKS_DARK); P(0, 1, lz, B.PLANKS); if (Math.abs(lz) < 2) { P(-2, 2, lz, B.PLANKS_DARK); P(2, 2, lz, B.PLANKS_DARK); } }
      P(0, 1, 3, B.PLANKS_DARK); P(0, 2, -3, B.PLANKS_DARK); fill(P, 0, 2, 0, 0, 4, 0, B.LOG); fill(P, 0, 3, 1, 0, 4, 1, B.WOOL_WHITE);
      for (let ly = 1; ly <= 3; ly++) { P(-4, ly, 0, B.NET); P(4, ly, -1, B.NET); }
      P(3, 1, 3, B.CRATE); P(3, 2, 3, B.CRATE); P(-3, 1, 3, B.BARREL); addChest(P, 3, 1, -3, 'fish', 1); P(-3, 1, -3, B.TABLE);
    } else {
      house(hx, deck, hz, r, 3, 3, 4, STYLES.stilt, 'stilt', 'fish');
      const P = mk(hx, deck, hz, r);
      P(-4, 1, -4, B.FENCE); P(-4, 2, -4, B.NET); P(4, 1, -4, B.FENCE); P(4, 2, -4, B.NET); P(3, 1, -4, B.BARREL);
    }
  });
  // drying racks with nets
  for (const [dx, dz] of [[-8, 0], [8, 0]]) { for (let y = 1; y <= 3; y++) { setB(cx + dx, deck + y, cz + dz - 2, B.FENCE); setB(cx + dx, deck + y, cz + dz + 2, B.FENCE); } for (let k = -1; k <= 1; k++) { setB(cx + dx, deck + 3, cz + dz + k, B.FENCE); setB(cx + dx, deck + 2, cz + dz + k, B.NET); } }
  return s;
}
function villageSahra(s) {
  const { x: cx, z: cz, gy } = s;
  terraform(cx, cz, 30, gy, B.SAND, B.SANDSTONE, 9);
  addSite('Sahra Oasis', 'Oasis town', 'village', cx, gy, cz, 30);
  // oasis pond with palms
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const d = Math.hypot(dx, dz); if (d < 5) { setB(cx + dx, gy, cz + dz, B.WATER); setB(cx + dx, gy - 1, cz + dz, B.WATER); setB(cx + dx, gy - 2, cz + dz, B.SAND); } else if (d < 6.5) setB(cx + dx, gy, cz + dz, B.SANDBRICK); }
  for (let i = 0; i < 6; i++) if (hash3(i, cx, cz) < 0.9) setB(cx + Math.round(Math.cos(i) * 3), gy + 1, cz + Math.round(Math.sin(i) * 3), B.LILYPAD);
  for (const [dx, dz] of [[-7, -4], [7, 3], [-3, 7], [4, -7]]) { const th = 6 + (dx & 1); for (let y = 1; y <= th; y++) setB(cx + dx + (y > 4 ? Math.sign(dx) : 0), gy + y, cz + dz, B.LOG); const tx = cx + dx + Math.sign(dx), ty = gy + th + 1; for (let k = -3; k <= 3; k++) { setB(tx + k, ty - (Math.abs(k) > 2 ? 1 : 0), cz + dz, B.LEAVES); setB(tx, ty - (Math.abs(k) > 2 ? 1 : 0), cz + dz + k, B.LEAVES); } setB(tx, ty + 1, cz + dz, B.LEAVES); }
  waystone(cx + 8, gy, cz - 8); s.spawn = [cx + 8.5, gy + 1, cz - 6.5];
  const bld = [[-16, -12, 3, 3, 4], [0, -18, 4, 3, 4], [16, -12, 3, 3, 4], [-18, 6, 3, 4, 4], [18, 6, 4, 3, 7], [-8, 18, 3, 3, 4], [10, 18, 3, 3, 4]];
  bld.forEach(([ox, oz, hw, hd, wh], i) => {
    const r = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 3 : 1) : (oz > 0 ? 0 : 2);
    const P = house(cx + ox, gy, cz + oz, r, hw, hd, wh, STYLES.desert, i === 4 ? 'library' : 'desert', 'desert');
    // awning over the door
    for (let lx = -2; lx <= 2; lx++) { P(lx, 4, -hd - 1, lx % 2 ? B.WOOL_RED : B.WOOL_WHITE); P(lx, 4, -hd - 2, lx % 2 ? B.WOOL_RED : B.WOOL_WHITE); }
    P(-2, 1, -hd - 2, B.FENCE); P(2, 1, -hd - 2, B.FENCE); P(-2, 2, -hd - 2, B.FENCE); P(2, 2, -hd - 2, B.FENCE); P(-2, 3, -hd - 2, B.FENCE); P(2, 3, -hd - 2, B.FENCE);
    // rooftop terrace with ladder and shade canopy
    for (let ly = 1; ly <= wh + 1; ly++) P(hw + 1, ly, 0, B.LADDER, 3);
    P(hw, wh + 2, 0, B.AIR);
    for (const [a, b] of [[-hw + 1, -hd + 1], [-hw + 1, -1], [-1, -hd + 1], [-1, -1]]) fill(P, a, wh + 2, b, a, wh + 3, b, B.FENCE);
    fill(P, -hw + 1, wh + 4, -hd + 1, -1, wh + 4, -1, i % 2 ? B.WOOL_BLUE : B.WOOL_RED);
    P(1, wh + 2, 1, B.POT); P(-1 + (hw > 3 ? 2 : 0), wh + 2, hd - 1, B.BARREL);
    pathLine(cx + ox, cz + oz, cx, cz, 2);
  });
  // artifact hall (pots on display tables)
  const A = mk(cx + 18, gy, cz + 6, 3);
  for (let lz = -1; lz <= 1; lz++) for (const lx of [-2, 2]) { A(lx, 1, lz, B.SANDBRICK); A(lx, 2, lz, B.POT); }
  A(0, 1, 2, B.TABLE); A(0, 2, 2, B.CRYSTAL_CLUSTER);
  fill(A, -1, 0, -3, 1, 0, 2, B.WOOL_RED);
  stall(cx - 8, gy, cz - 6, 1, B.WOOL_BLUE, B.WOOL_WHITE, 'market'); stall(cx + 2, gy, cz + 9, 0, B.WOOL_RED, B.WOOL_YELLOW, 'desert');
  return s;
}
function villageShardholm(s) {
  const { x: cx, z: cz, gy } = s;
  // terraced: two tiers following the slope
  terraform(cx, cz, 26, gy, B.STONE, B.STONE, 10);
  addSite('Shardholm', 'Mining village', 'village', cx, gy, cz, 28);
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) setB(cx + dx, gy, cz + dz, (dx * dz) % 3 ? B.STONEBRICK : B.POLISHED);
  waystone(cx, gy, cz); s.spawn = [cx + 2.5, gy + 1, cz + 2.5];
  for (const [dx, dz] of [[-5, -5], [5, 5], [-5, 5], [5, -5]]) lampPost(cx + dx, gy, cz + dz, true);
  const homes = [[-14, -12], [12, -14], [-16, 8], [15, 9], [-2, 17]];
  homes.forEach(([ox, oz], i) => {
    const r = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 3 : 1) : (oz > 0 ? 0 : 2);
    house(cx + ox, gy, cz + oz, r, 3, 3, 4, STYLES.mining, i === 4 ? 'library' : 'mining', 'mine');
    pathLine(cx + ox, cz + oz, cx, cz, 2);
  });
  // exposed ore face + mine cart rails
  const P = mk(cx, gy, cz - 22, 0);
  for (let lx = -9; lx <= 9; lx++) for (let ly = 1; ly <= 7 - Math.abs(lx) / 2; ly++) for (let lz = -2; lz <= 1; lz++) {
    const r = hash3(lx, ly, lz + cz);
    P(lx, ly, lz, r < 0.15 ? B.IRON_ORE : r < 0.24 ? B.CRYSTAL : r < 0.3 ? B.COAL_ORE : B.STONE);
  }
  fill(P, -1, 1, -2, 1, 3, 1, B.AIR); fill(P, -1, 1, -6, 1, 3, -3, B.AIR);
  for (const lx of [-2, 2]) fill(P, lx, 1, 1, lx, 3, 1, B.DARKLOG); fill(P, -2, 4, 1, 2, 4, 1, B.PLANKS_DARK);
  for (let lz = -6; lz <= 18; lz++) { const p = P.at(0, 0, lz); const y = surfaceY(p[0], p[2]); if (getB(p[0], y + 1, p[2]) === 0) setB(p[0], y + 1, p[2], B.RAIL); }
  P(0, 1, -6, B.CRYSTAL); addChest(P, 1, 1, -5, 'mine', 3); P(-1, 1, -5, B.CRATE); P(-1, 2, -5, B.LAMP);
  stall(cx + 9, gy, cz, 3, B.WOOL_BLUE, B.WOOL_PURPLE, 'mine');
  // smithy
  const S = mk(cx - 9, gy, cz + 1, 1);
  fill(S, -2, 1, -2, 2, 1, 2, B.AIR); S(-2, 1, 2, B.FURNACE, 0); S(-1, 1, 2, B.FURNACE, 0); S(1, 1, 2, B.IRON_BLOCK); S(2, 1, 2, B.BARREL);
  for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) fill(S, a, 1, b, a, 4, b, B.DARKLOG);
  fill(S, -3, 5, -3, 3, 5, 3, B.ROOF_BLUE);
  return s;
}

// ---------------------------------------------------------------- camps & sights
function camp(s, name, sub, top, under) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, Math.floor(rng() * 4));
  terraform(cx, cz, 7, gy, top, under, 5);
  addSite(name, sub, 'camp', cx, gy, cz, 12);
  // A-frame tent
  for (let lz = -2; lz <= 2; lz++) { for (let k = 0; k <= 2; k++) { P(-3 + k, 1 + k, lz, B.WOOL_WHITE); P(3 - k, 1 + k, lz, B.WOOL_WHITE); } P(0, 4, lz, B.LOG); }
  P(-3, 1, -3, B.FENCE); P(3, 1, -3, B.FENCE); P(0, 1, 2, B.WOOL_GREEN); P(-1, 1, 2, B.WOOL_GREEN);
  addChest(P, 1, 1, 2, 'camp', 0);
  // campfire on a cobble ring, log seats
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) P(dx, 0, -7 + dz, B.COBBLE);
  P(0, 1, -7, B.FIRE); Emitters.push(Object.assign({ type: 'smoke' }, (([x, y, z]) => ({ x: x + 0.5, y: y + 1, z: z + 0.5 }))(P.at(0, 1, -7))));
  P(-3, 1, -7, B.LOG, 1); P(3, 1, -7, B.LOG, 1); P(0, 1, -10, B.LOG);
  P(5, 1, -2, B.CRATE); P(5, 2, -2, B.CRATE); P(5, 1, -3, B.BARREL); P(-5, 1, -1, B.LOG); P(-5, 1, 0, B.LOG); P(-5, 2, -1, B.LOG);
  P(4, 1, 2, B.FENCE); P(4, 2, 2, B.FENCE); P(4, 3, 2, B.LAMP);
}
// ---------------------------------------------------------------- voxel sculpting
// A tiny sculptor for statues: shapes are listed in order and later ones paint over earlier ones (material 0
// carves). Every block centre inside the bounds is tested against every shape.
const Sculpt = {
  ell: (c, r, m, when) => ({ m, when, t: (x, y, z) => ((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2 <= 1 }),
  cap: (a, b, r, m, when) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]; return { m, when, t: (x, y, z) => { let t = ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / L2; t = Math.max(0, Math.min(1, t)); const px = a[0] + d[0] * t - x, py = a[1] + d[1] * t - y, pz = a[2] + d[2] * t - z; return px * px + py * py + pz * pz <= r * r; } }; },
  box: (x0, x1, y0, y1, z0, z1, m, when) => ({ m, when, vox: true, t: (x, y, z) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1 }),
  fn: (test, m) => ({ m, t: test }),
  run(P, prims, X0, X1, Y0, Y1, Z0, Z1, ox, oy, oz) {
    for (let y = Y0; y <= Y1; y++) for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
      const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5; let id = -1;
      for (const pr of prims) {
        const hit = pr.vox ? pr.t(x, y, z) : pr.t(cx, cy, cz);
        if (!hit || (pr.when && !pr.when(cx, cy, cz))) continue;
        id = typeof pr.m === 'function' ? pr.m(cx, cy, cz, x, y, z) : pr.m;
      }
      if (id >= 0) P(x + ox, y + oy, z + oz, id);
    }
  },
};
function sovereign(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 20, gy, B.GRASS, B.DIRT, 8);
  addSite('The Knelt Sovereign', 'Landmark', 'sight', cx, gy, cz, 24);
  // ---- the plinth: three stepped tiers with stairs up the front, a paved forecourt and gold trim
  const tier = (ly, hx, z0, z1, id, edge) => { for (let lz = z0; lz <= z1; lz++) for (let lx = -hx; lx <= hx - 1; lx++) { const e = lx === -hx || lx === hx - 1 || lz === z0 || lz === z1; if ((lx === -hx || lx === hx - 1) && (lz === z0 || lz === z1)) continue; P(lx, ly, lz, e && edge ? edge : id); } };
  tier(0, 14, -16, 16, B.STONEBRICK, B.POLISHED);
  for (let lz = -15; lz <= 15; lz++) for (let lx = -13; lx <= 12; lx++) if ((lx + lz) % 7 === 0 && Math.abs(lx) > 10) P(lx, 0, lz, B.MOSSYBRICK);
  tier(1, 11, -13, 14, B.STONEBRICK, B.POLISHED);
  tier(2, 9, -11, 12, B.POLISHED, B.STONEBRICK);
  for (const [gx, gz] of [[-9, -11], [8, -11], [-9, 12], [8, 12], [-9, 0], [8, 0]]) P(gx, 2, gz, B.GOLD_BLOCK);
  for (let lx = -3; lx <= 2; lx++) { P(lx, 1, -14, B.STONEBRICK_STAIRS, 2); P(lx, 2, -12, B.POLISHED_STAIRS, 2); P(lx, 2, -11, B.POLISHED); }
  // braziers at the corners of the top tier
  for (const [bx, bz] of [[-9, -10], [8, -10], [-9, 11], [8, 11]]) { P(bx, 3, bz, B.POLISHED); P(bx, 4, bz, B.GOLD_BLOCK); P(bx, 5, bz, B.FIRE); Emitters.push(Object.assign({ type: 'smoke' }, (([x, y, z]) => ({ x: x + 0.5, y: y + 1, z: z + 0.5 }))(P.at(bx, 5, bz)))); }
  // ---- the king: kneeling on his left knee, head bowed, both hands on the pommel of a greatsword planted
  // point-down before him; plate armour, a red cape with a gold hem pooling behind, an ermine mantle, a long
  // white beard and a jewelled crown. He faces -z (toward the stairs); his right hand side is +x.
  const S = Sculpt, hs = (x, y, z) => hash3(Math.floor(x), Math.floor(y), Math.floor(z));
  const ARM = B.STEEL_BLOCK, CLOTH = B.WOOL_RED, HEM = B.WOOL_YELLOW, FUR = (x, y, z) => hs(x * 3, y * 5, z * 7) < 0.13 ? B.WOOL_BLACK : B.WOOL_WHITE;
  const SKIN = (x, y, z) => hs(x, y, z) < 0.15 ? B.STONE : B.POLISHED;
  // the cape: hangs from the shoulders and flares back to the ground, with folds and a gold hem
  const capeW = y => 6.2 + (1 - y / 20) * 2.6, capeZ = (x, y) => { const t = 1 - y / 20; return 4.4 + t * t * 7.2 + Math.sin(x * 1.15) * 0.55 * t; };
  const inCape = (x, y, z) => y >= 0.5 && y <= 20.6 && Math.abs(x) <= capeW(y) && z <= capeZ(x, y) && z >= capeZ(x, y) - 1.35;
  const inTrain = (x, y, z) => y < 1.6 && z > 5 && (x / 9.2) ** 2 + ((z - 8.6) / 4.6) ** 2 <= 1 + Math.sin(x * 1.3) * 0.08;
  const capeMat = (x, y, z) => { const edge = Math.abs(x) > capeW(y) - 1.05 || y < 1.6 && (x / 9.2) ** 2 + ((z - 8.6) / 4.6) ** 2 > 0.8; return edge ? HEM : CLOTH; };
  const prims = [
    S.fn((x, y, z) => inCape(x, y, z) || inTrain(x, y, z), capeMat),
    // legs: right knee raised with the foot planted forward, left knee on the ground with the shin lying back
    S.box(3, 5, 0, 1, -8, -4, ARM), S.box(3, 5, 2, 2, -7, -4, ARM),
    S.cap([4.2, 1.5, -5.4], [4.2, 8, -5.4], 1.9, ARM), S.ell([4.2, 8.6, -5.8], [2.1, 1.6, 2], ARM),
    S.cap([4.2, 8.5, -5.2], [3.2, 9.6, 1.5], 2.3, ARM),
    S.cap([-4.2, 1.6, -2.6], [-4.2, 1.4, 5.4], 1.6, ARM), S.box(-6, -3, 0, 2, 5, 7, ARM),
    S.ell([-4.2, 1.9, -3.1], [2.1, 1.9, 2], ARM), S.cap([-4.2, 2.3, -2.8], [-3.2, 9.6, 1.5], 2.3, ARM),
    S.ell([4.2, 8.7, -6.9], [1.2, 0.9, 0.7], B.GOLD_BLOCK), S.ell([-4.2, 2, -4.4], [1.2, 0.9, 0.7], B.GOLD_BLOCK),
    // hips, red tunic and the tabard that hangs between the knees
    S.ell([0, 10, 1.6], [6, 3, 3.9], CLOTH), S.box(-2, 1, 4, 10, -3, -2, (x, y, z, vx) => vx === -2 || vx === 1 ? HEM : CLOTH),
    // breastplate, gold belt and a cross on the chest
    S.ell([0, 15.8, 1.4], [5.6, 5.8, 3.7], ARM), S.ell([0, 11.5, 1.4], [5.75, 0.95, 3.95], B.GOLD_BLOCK),
    S.box(-1, 0, 13, 18, -3, -3, B.GOLD_BLOCK), S.box(-3, 2, 16, 16, -3, -3, B.GOLD_BLOCK),
    // ermine mantle over the shoulders, then the pauldrons with gold rims
    S.ell([0, 20.3, 1.3], [6.5, 1.7, 4.3], FUR),
    S.ell([6.2, 19.2, 1.2], [2.8, 2.2, 3], ARM), S.ell([-6.2, 19.2, 1.2], [2.8, 2.2, 3], ARM),
    S.ell([6.2, 18.2, 1.2], [3.1, 0.7, 3.3], B.GOLD_BLOCK), S.ell([-6.2, 18.2, 1.2], [3.1, 0.7, 3.3], B.GOLD_BLOCK),
    // arms reaching down to the sword, hands clasped over the grip
    S.cap([6.3, 18, 0.6], [5.6, 14.2, -3.2], 1.7, ARM), S.cap([-6.3, 18, 0.6], [-5.6, 14.2, -3.2], 1.7, ARM),
    S.ell([5.7, 14.2, -3.2], [1.9, 1.9, 1.9], ARM), S.ell([-5.7, 14.2, -3.2], [1.9, 1.9, 1.9], ARM),
    S.cap([5.6, 14.2, -3.2], [1.8, 15.4, -6.6], 1.5, ARM), S.cap([-5.6, 14.2, -3.2], [-1.8, 15.4, -6.6], 1.5, ARM),
    S.ell([0, 15.6, -7], [3.2, 1.9, 1.9], ARM),
    // the greatsword: a long blade, a gold crossguard with upturned ends, the grip, and a jewelled pommel
    S.box(-1, 0, 0, 12, -8, -8, (x, y, z, vx) => vx === -1 ? B.IRON_BLOCK : B.POLISHED), S.box(-2, 1, 0, 1, -8, -8, B.IRON_BLOCK),
    S.box(-5, 4, 13, 13, -8, -8, B.GOLD_BLOCK), S.box(-5, -5, 14, 14, -8, -8, B.GOLD_BLOCK), S.box(4, 4, 14, 14, -8, -8, B.GOLD_BLOCK),
    S.box(-1, 0, 17, 18, -8, -7, B.GOLD_BLOCK), S.box(-1, 0, 18, 18, -9, -9, B.CRYSTAL_ROSE),
    // neck, head (bowed a little), white hair and a long beard
    S.cap([0, 20.4, 0.9], [0, 22.2, 0.2], 1.8, SKIN),
    S.ell([0, 24.6, -0.6], [3.05, 3.9, 3.15], SKIN),
    S.ell([0, 25.2, 0.25], [3.3, 3.85, 3.35], B.WOOL_WHITE, (x, y, z) => z > -1.4 || y > 27.4),
    S.box(-2, -2, 24, 24, -4, -4, B.BASALT), S.box(1, 1, 24, 24, -4, -4, B.BASALT), // eyes in the shade of the brow
    S.box(-3, 2, 25, 25, -5, -5, SKIN), S.box(-1, 0, 23, 24, -5, -5, SKIN),     // brow and nose
    S.box(-3, 2, 22, 22, -4, -4, B.WOOL_WHITE), S.box(-2, 1, 22, 22, -5, -5, B.WOOL_WHITE), // moustache
    S.ell([0, 20.2, -3], [2.4, 2.1, 1.75], B.WOOL_WHITE), S.cap([0, 20.6, -3.1], [0, 17.2, -3.7], 1.75, B.WOOL_WHITE),
    S.cap([0, 18, -3.7], [0, 16.2, -4.1], 1.1, B.WOOL_WHITE),
    // the crown: a gold band set with gems, eight points, a velvet cap and a gold orb on top
    S.fn((x, y, z) => { const dx = x / 3.45, dz = (z + 0.45) / 3.45, r = Math.sqrt(dx * dx + dz * dz); return y >= 27.4 && y <= 29.6 && r <= 1 && r >= 0.7; }, (x, y, z) => {
      const a = Math.atan2(z + 0.45, x), front = Math.abs(a + Math.PI / 2) < 0.4;
      if (y > 28 && y < 29 && front) return B.CRYSTAL_ROSE; if (y > 28 && y < 29 && (Math.abs(a) < 0.35 || Math.abs(Math.abs(a) - Math.PI) < 0.35)) return B.CRYSTAL; return B.GOLD_BLOCK; }),
    S.ell([0, 29.3, -0.45], [2.6, 1.8, 2.6], CLOTH),
    S.fn((x, y, z) => { if (y < 29.6 || y > 32) return false; const a = Math.atan2(z + 0.45, x), k = Math.round(a / (Math.PI / 4)), ka = k * Math.PI / 4; const px = Math.cos(ka) * 3.05, pz = Math.sin(ka) * 3.05 - 0.45; return Math.abs(x - px) < 0.75 && Math.abs(z - pz) < 0.75 && y < 29.6 + (k % 2 ? 1.4 : 2.4); }, (x, y, z) => y > 31 ? B.CRYSTAL : B.GOLD_BLOCK),
    S.box(-1, 0, 31, 32, -1, 0, B.GOLD_BLOCK),
  ];
  Sculpt.run(P, prims, -11, 10, 0, 33, -9, 14, 0, 3, -1);
  // ---- around the plinth: banners on posts, hedges along the sides and flowers in the grass
  for (const [a, b] of [[-13, -15], [12, -15], [-13, 15], [12, 15]]) { fill(P, a, 1, b, a, 7, b, B.STONEPOST); P(a, 8, b, B.LAMP); P(a + (a > 0 ? -1 : 1), 5, b, B.BANNER, a > 0 ? 3 : 1); P(a + (a > 0 ? -1 : 1), 6, b, B.BANNER, a > 0 ? 3 : 1); }
  for (let lz = -12; lz <= 15; lz++) for (const lx of [-16, 15]) if (lz % 6 !== 0) { P(lx, 1, lz, B.LEAVES_DARK); if (lz % 3 === 1) P(lx, 2, lz, B.LEAVES_DARK); }
  for (let i = 0; i < 70; i++) { const a = rng() * 6.283, d = 17 + rng() * 4, x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d); if (getB(...P.at(x, 0, z)) === B.GRASS && !getB(...P.at(x, 1, z))) P(x, 1, z, [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE, B.TALLGRASS][Math.floor(rng() * 4)]); }
  addLore(P, 0, 3, -10, 'The Knelt Sovereign', 'He did not flee when the sky broke. The last king walked out to meet the Colossus alone, knelt, and laid his sword in the earth. The Colossus lay down beside him and slept. Neither has risen since.', 'king');
  addChest(P, 0, 2, 13, 'royal', 2);
}
function shatteredOath(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 10, gy, B.STONE, B.STONE, 7);
  addSite('The Shattered Oath', 'Landmark', 'sight', cx, gy, cz, 18);
  fill(P, -4, 0, -4, 4, 2, 4, B.MOSSYBRICK); fill(P, -3, 3, -3, 3, 3, 3, B.CRACKEDBRICK);
  fill(P, -4, 3, -4, -3, 3, -3, B.AIR); fill(P, 2, 3, 2, 4, 4, 4, B.AIR);
  fill(P, -1, 4, 0, 1, 24, 0, B.CRYSTAL); fill(P, 0, 25, 0, 0, 27, 0, B.CRYSTAL); // blade
  fill(P, -1, 4, -1, 1, 18, -1, B.ENERGY); fill(P, -1, 4, 1, 1, 18, 1, B.ENERGY);
  fill(P, -5, 25, 0, 5, 26, 0, B.ANCIENT_GOLD); fill(P, 0, 27, 0, 0, 31, 0, B.DARKLOG); P(0, 32, 0, B.CRYSTAL_ROSE);
  for (let i = 0; i < 24; i++) { const a = rng() * 6.28, d = 5 + rng() * 6, x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d); const y = surfaceY(cx + x, cz + z) - gy; P(x, y + 1, z, rng() < 0.5 ? B.CRYSTAL_CLUSTER : B.CRYSTAL); if (rng() < 0.4) P(x, y + 2, z, B.CRYSTAL); }
  const tip = P.at(0, 30, 0); Emitters.push({ x: tip[0] + 0.5, y: tip[1], z: tip[2] + 0.5, type: 'sparkle' }, { x: cx + 0.5, y: gy + 10, z: cz + 0.5, type: 'sparkle' });
  addLore(P, 0, 3, -5, 'The Shattered Oath', 'Forged from the first shard that fell, to end the sky-fall. It struck the Colossus once and split in two. The other half was never found.', 'blade');
}
function beaconLookout(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 7, gy, B.GRASS, B.DIRT, 6);
  addSite('Beacon Lookout', 'Landmark', 'sight', cx, gy, cz, 14);
  for (let ly = 0; ly <= 18; ly++) for (let lz = -3; lz <= 3; lz++) for (let lx = -3; lx <= 3; lx++) {
    const e = Math.abs(lx) === 3 || Math.abs(lz) === 3, c = Math.abs(lx) === 3 && Math.abs(lz) === 3;
    P(lx, ly, lz, ly === 0 ? B.STONEBRICK : e ? (c ? B.POLISHED : ((ly % 6 === 3 && (lx === 0 || lz === 0)) ? B.GLASS : (hash3(lx, ly, lz) < 0.15 ? B.MOSSYBRICK : B.STONEBRICK))) : B.AIR);
  }
  P(0, 1, -3, B.AIR); P(0, 2, -3, B.AIR);
  for (const fy of [6, 12]) { fill(P, -2, fy, -2, 2, fy, 2, B.PLANKS); P(2, fy, 2, B.AIR); }
  for (let ly = 1; ly <= 19; ly++) P(2, ly, 2, B.LADDER, 2);
  fill(P, -4, 19, -4, 4, 19, 4, B.PLANKS); P(2, 19, 2, B.AIR);
  for (let i = -4; i <= 4; i++) for (const e of [-4, 4]) { P(i, 20, e, B.FENCE); P(e, 20, i, B.FENCE); }
  for (const [a, b] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { P(a, 21, b, B.FENCE); P(a, 22, b, B.LAMP); }
  P(0, 20, 0, B.FIRE); Emitters.push((([x, y, z]) => ({ x: x + 0.5, y: y + 1, z: z + 0.5, type: 'smoke' }))(P.at(0, 20, 0)));
  P(-3, 20, -3, B.CRATE); P(-3, 21, -3, B.CRATE); P(3, 20, -3, B.BARREL); P(-3, 20, 3, B.BARREL); addChest(P, 3, 20, 0, 'camp', 3);
  P(-2, 7, -2, B.TABLE); P(-2, 1, 2, B.BARREL); P(-1, 13, -2, B.WOOL_RED); P(-2, 13, -2, B.WOOL_RED);
  addLore(P, -2, 20, 0, 'Watch Log', 'Fires lit at dusk on every lookout from the dunes to the marsh. If the Bastion\'s fire ever goes dark, ring the bells and run.', 'tower', B.TABLET);
}
function wreckedWagon(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, Math.floor(rng() * 4));
  terraform(cx, cz, 6, gy, B.SAND, B.SANDSTONE, 5);
  addSite('Wrecked Wagon', 'Landmark', 'sight', cx, gy, cz, 11);
  fill(P, -1, 1, -3, 1, 1, 3, B.PLANKS_DARK); fill(P, -1, 2, -3, -1, 3, 3, B.PLANKS_DARK); P(-1, 3, 0, B.AIR); P(-1, 3, -2, B.AIR); P(1, 2, 3, B.PLANKS_DARK); P(1, 2, -3, B.PLANKS_DARK);
  for (const z of [-2, 2]) { P(-2, 1, z, B.LOG, 1); P(-2, 2, z, B.LOG, 1); P(2, 1, z + (z > 0 ? 1 : 0), B.LOG, 1); }
  fill(P, -1, 2, 1, 0, 3, 2, B.WOOL_WHITE); P(0, 2, -1, B.BARREL); P(3, 1, -1, B.BARREL); P(4, 1, 1, B.CRATE); P(-4, 1, 3, B.POT);
  addChest(P, 0, 2, 0, 'desert', 1);
  for (let i = 0; i < 4; i++) P(-5 + i, 1, -5, B.DEADBUSH);
  addLore(P, 3, 1, -4, 'Scratched into a Wheel', 'Three nights out from Sahra. The crawlers came up out of the sand when the moon rose. Left the cargo. Took the mules. Forgive me, Ma.', 'wagon', B.TABLET);
}
function graveyard(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 11, gy, B.GRASS, B.DIRT, 6);
  addSite('Hollowmere Graveyard', 'Landmark', 'sight', cx, gy, cz, 16);
  for (let i = -9; i <= 9; i++) for (const e of [-8, 8]) { P(i, 1, e, i % 3 ? B.FENCE : B.STONEPOST); P(e + (e > 0 ? 1 : -1), 1, i, i % 3 ? B.FENCE : B.STONEPOST); }
  fill(P, -1, 1, -8, 1, 1, -8, B.AIR);
  for (let k = 0; k < 15; k++) { const x = -6 + (k % 5) * 3, z = -4 + Math.floor(k / 5) * 4; P(x, 1, z, B.COBBLE); P(x, 2, z, hash3(x, 1, z) < 0.3 ? B.MOSSYCOBBLE : B.COBBLE); P(x, 0, z + 1, B.DIRT); if (hash3(x, 2, z) < 0.4) P(x, 1, z + 1, B.FLOWER_BLUE); }
  for (let y = 1; y <= 6; y++) P(-7, y, 6, B.DARKLOG); P(-6, 6, 6, B.DARKLOG); P(-5, 7, 6, B.DARKLOG); P(-8, 5, 6, B.DARKLOG);
  const C = mk(cx, gy, cz + 11, 0);
  shell(C, -3, 0, -2, 3, 5, 3, B.MOSSYBRICK); C(0, 1, -2, B.AIR); C(0, 2, -2, B.AIR); C(0, 6, 0, B.STONEPOST); C(0, 7, 0, B.STONEPOST);
  addChest(C, 0, 1, 2, 'ruins', 0); C(-2, 1, 2, B.WEB); C(2, 4, 2, B.WEB); C(0, 4, 0, B.LAMP);
  addLore(P, 0, 1, -6, 'Hollowmere Graveyard', 'Row on row, the guardians who held the pass. None were buried with names - only with their orders. At night, some of them still keep watch.', 'grave', B.TABLET);
  addSpawn(cx, gy + 1, cz, 'shade', 3, 8);
}
function deepveinMine(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, Math.floor(rng() * 4));
  terraform(cx, cz, 6, gy, B.STONE, B.STONE, 5);
  addSite('Deepvein Mine', 'Landmark', 'sight', cx, gy, cz, 12);
  const depth = Math.min(16, gy - 6);
  for (let i = 0; i <= depth; i++) {
    fill(P, -1, -i + 1, i + 1, 1, -i + 3, i + 1, B.AIR);
    P(0, -i, i + 1, B.PLANKS_DARK);
    if (i % 4 === 0) { fill(P, -2, -i, i + 1, -2, -i + 3, i + 1, B.DARKLOG); fill(P, 2, -i, i + 1, 2, -i + 3, i + 1, B.DARKLOG); fill(P, -2, -i + 4, i + 1, 2, -i + 4, i + 1, B.PLANKS_DARK); P(1, -i + 3, i + 1, B.LAMP); }
  }
  for (const sx of [-2, 2]) fill(P, sx, 1, 0, sx, 4, 0, B.DARKLOG); fill(P, -3, 5, 0, 3, 5, 0, B.PLANKS_DARK); P(-3, 1, -1, B.CRATE); P(3, 1, -1, B.BARREL); P(3, 2, -1, B.LAMP);
  const by = -depth, bz = depth + 2;
  for (let lz = bz; lz <= bz + 14; lz++) for (let lx = -7; lx <= 7; lx++) for (let ly = by; ly <= by + 5; ly++) {
    const e = Math.abs(lx) === 7 || lz === bz + 14 || ly === by + 5;
    const r = hash3(lx, ly, lz + cx);
    P(lx, ly, lz, ly === by ? B.STONE : e ? (r < 0.18 ? B.IRON_ORE : r < 0.26 ? B.COAL_ORE : r < 0.31 ? B.CRYSTAL : r < 0.33 ? B.GOLD_ORE : r < 0.37 ? B.LAPIS_ORE : B.STONE) : B.AIR);
  }
  for (let lz = bz; lz <= bz + 13; lz++) P(0, by + 1, lz, B.RAIL);
  for (let lz = bz + 2; lz <= bz + 12; lz += 5) { fill(P, -6, by + 1, lz, -6, by + 4, lz, B.DARKLOG); fill(P, 6, by + 1, lz, 6, by + 4, lz, B.DARKLOG); fill(P, -6, by + 5, lz, 6, by + 5, lz, B.PLANKS_DARK); P(-5, by + 4, lz, B.LAMP); }
  P(-5, by + 1, bz + 12, B.CRATE); P(-5, by + 2, bz + 12, B.CRATE); P(5, by + 1, bz + 12, B.BARREL); P(4, by + 1, bz + 13, B.CRYSTAL_CLUSTER); P(-2, by + 4, bz + 7, B.WEB);
  addChest(P, 3, by + 1, bz + 13, 'mine', 0);
  addLore(P, -1, 1, -1, 'Deepvein Mine', 'Seventeen shifts went down. The lanterns still burn, but nobody has counted the miners since the crystals started singing.', 'mine', B.TABLET);
}
function ostmereRuins(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 14, gy, B.GRASS, B.DIRT, 7);
  addSite('Ruins of Ostmere', 'Ancient place', 'ancient', cx, gy, cz, 20);
  for (let lz = -12; lz <= 12; lz++) for (let lx = -12; lx <= 12; lx++) if (hash3(lx, 3, lz) < 0.7 && Math.hypot(lx, lz) < 12.5) P(lx, 0, lz, hash3(lx, 4, lz) < 0.4 ? B.MOSSYBRICK : B.STONEBRICK);
  // colonnade with broken arches
  for (let i = -8; i <= 8; i += 4) for (const e of [-8, 8]) {
    const h = 4 + Math.floor(hash3(i, e, 1) * 5);
    fill(P, i, 1, e, i, h, e, B.STONEPOST);
    if (h >= 6 && i < 8) for (let k = 0; k <= 4; k++) if (hash3(i + k, e, 2) < 0.75) P(i + k, 7 + (k === 0 || k === 4 ? 0 : 1), e, hash3(k, i, e) < 0.3 ? B.MOSSYBRICK : B.STONEBRICK);
  }
  // central sanctum: arch gate and mural walls
  for (let lx = -4; lx <= 4; lx++) for (let ly = 1; ly <= 6; ly++) for (const lz of [-4, 4]) if (!(Math.abs(lx) <= 1 && ly <= 4 && lz === -4) && hash3(lx, ly, lz) < 0.85 - ly * 0.05) P(lx, ly, lz, hash3(lx, ly, lz + 9) < 0.3 ? B.MOSSYBRICK : B.STONEBRICK);
  for (let lz = -4; lz <= 4; lz++) for (let ly = 1; ly <= 5; ly++) for (const lx of [-4, 4]) if (hash3(lx, ly, lz) < 0.8 - ly * 0.06) P(lx, ly, lz, B.MOSSYBRICK);
  for (let lx = -1; lx <= 1; lx++) P(lx, 5, -4, B.STONEBRICK);
  P(0, 1, 2, B.POLISHED); P(0, 2, 2, B.RUNEPILLAR);
  addLore(P, 0, 3, 4, 'The Mural of Ostmere', 'The people of Ostmere lived in the shadow of the Colossus and called it their Guardian. In the ninth year of the last king, the sky split and rained burning glass. The Guardian woke in anger.', 'mural', B.TABLET);
  addLore(P, -4, 2, 0, 'Second Panel', 'The king went out alone. Where he knelt, the Guardian lay down. The shards it bled still glow in the highlands.', 'mural2', B.TABLET);
  addChest(P, 2, 1, 2, 'ruins', 0);
  for (let k = 0; k < 20; k++) { const x = Math.floor(rng() * 22 - 11), z = Math.floor(rng() * 22 - 11); const y = surfaceY(cx + x, cz + z) - gy; if (getB(cx + x, gy + y + 1, cz + z) === 0) P(x, y + 1, z, [B.FLOWER_RED, B.FLOWER_BLUE, B.TALLGRASS, B.VINES][k % 4] === B.VINES ? B.TALLGRASS : [B.FLOWER_RED, B.FLOWER_BLUE, B.TALLGRASS][k % 3]); }
  for (let k = 0; k < 10; k++) { const x = Math.floor(rng() * 16 - 8), z = Math.floor(rng() * 16 - 8); P(x, 1, z, B.MOSSYCOBBLE); }
  addChest(P, -9, 1, 10, 'ruins', 2);
}
function ashenBastion(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 22, gy, B.ASH, B.BASALT, 6);
  addSite('The Ashen Bastion', 'Ancient place', 'ancient', cx, gy, cz, 26);
  // lava moat ring
  for (let lz = -21; lz <= 21; lz++) for (let lx = -21; lx <= 21; lx++) {
    const m = Math.max(Math.abs(lx), Math.abs(lz));
    if (m >= 16 && m <= 18) { P(lx, 0, lz, B.AIR); P(lx, -1, lz, B.LAVA); P(lx, -2, lz, B.LAVA); P(lx, -3, lz, B.BASALT); }
    else if (m > 18 && hash3(lx, 9, lz) < 0.05) P(lx, 1, lz, B.FIRE);
  }
  for (let lx = -2; lx <= 2; lx++) for (let lz = 15; lz <= 19; lz++) { P(lx, 0, lz, B.DARKBRICK); P(lx, -1, lz, B.DARKBRICK); P(lx, -2, lz, B.DARKBRICK); if (Math.abs(lx) === 2) { P(lx, 1, lz, B.FENCE); } }
  fill(P, -14, 0, -14, 14, 0, 14, B.DARKBRICK);
  for (let ly = 1; ly <= 9; ly++) for (let i = -14; i <= 14; i++) for (const e of [-14, 14]) {
    const id = hash3(i, ly, e) < 0.1 ? B.DARKBRICK_CRACKED : B.DARKBRICK;
    if (!(e === 14 && Math.abs(i) <= 1 && ly <= 4)) P(i, ly, e, id);
    P(e, ly, i, id);
  }
  for (let i = -14; i <= 14; i += 2) for (const e of [-14, 14]) { P(i, 10, e, B.DARKBRICK); P(e, 10, i, B.DARKBRICK); }
  for (let i = -13; i <= 13; i++) for (const e of [-13, 13]) { P(i, 8, e, B.BASALT); P(e, 8, i, B.BASALT); }
  // corner towers
  for (const [a, b] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
    for (let ly = 1; ly <= 16; ly++) for (let lz = -3; lz <= 3; lz++) for (let lx = -3; lx <= 3; lx++) { const e = Math.abs(lx) === 3 || Math.abs(lz) === 3; P(a + lx, ly, b + lz, e ? (ly % 5 === 0 ? B.BASALT : B.DARKBRICK) : (ly === 8 ? B.BASALT : B.AIR)); }
    for (let lx = -3; lx <= 3; lx += 2) for (const e of [-3, 3]) { P(a + lx, 17, b + e, B.DARKBRICK); P(a + e, 17, b + lx, B.DARKBRICK); }
    fill(P, a - 1, 16, b - 1, a + 1, 16, b + 1, B.LAVA); P(a, 17, b, B.FIRE);
    for (let ly = 1; ly <= 16; ly++) P(a + (a > 0 ? -2 : 2), ly, b, B.LADDER, a > 0 ? 3 : 1);
    P(a + (a > 0 ? -2 : 2), 8, b, B.LADDER, a > 0 ? 3 : 1);
    P(a + (a > 0 ? -3 : 3), 9, b, B.AIR); P(a + (a > 0 ? -3 : 3), 10, b, B.AIR);
  }
  // keep
  shell(P, -6, 0, -6, 6, 11, 6, B.DARKBRICK); fill(P, -5, 0, -5, 5, 0, 5, B.BASALT);
  P(0, 1, 6, B.AIR); P(0, 2, 6, B.AIR); P(1, 1, 6, B.AIR); P(1, 2, 6, B.AIR); P(-1, 1, 6, B.AIR); P(-1, 2, 6, B.AIR);
  for (const [a, b] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) fill(P, a, 1, b, a, 10, b, B.BASALT);
  P(0, 10, 0, B.LAMP); P(-5, 3, 0, B.LAMP); P(5, 3, 0, B.LAMP);
  addChest(P, 0, 1, -5, 'armory', 2); addChest(P, -5, 1, -5, 'fort', 1); addChest(P, 5, 1, -5, 'fort', 3);
  P(-3, 1, -5, B.IRON_BLOCK); P(3, 1, -5, B.IRON_BLOCK);
  for (const [a, b] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { P(a, 1, b, B.SPAWNER); Emitters.push({ x: cx + a + 0.5, y: gy + 1.5, z: cz + b + 0.5, type: 'ember' }); }
  addLore(P, 0, 1, 12, 'The Ashen Bastion', 'Built where the sky-glass burned deepest. The garrison asked the capital for water. The mountain answered with lava. They hold the wall still, though they no longer remember the enemy.', 'bastion');
  addSpawn(cx, gy + 1, cz, 'elemental', 4, 10); addSpawn(cx, gy + 1, cz + 10, 'imp', 3, 6);
}

// ---------------------------------------------------------------- dungeons
function ruinedWatchtower(s) {
  const { x: cx, z: cz, gy } = s, P = mk(cx, gy, cz, 0);
  terraform(cx, cz, 9, gy, B.GRASS, B.DIRT, 6);
  addSite('Ruined Watchtower', 'Ancient place', 'ancient', cx, gy, cz, 14);
  const top = 28;
  for (let ly = -1; ly <= top; ly++) for (let lz = -5; lz <= 5; lz++) for (let lx = -5; lx <= 5; lx++) {
    const d = Math.max(Math.abs(lx), Math.abs(lz)) + (Math.abs(lx) === Math.abs(lz) && Math.abs(lx) > 3 ? 1 : 0);
    if (d > 5) continue;
    const ruin = ly > top - 6 && hash3(lx, ly, lz) < (ly - (top - 6)) / 8;
    if (d === 5) P(lx, ly, lz, ruin ? B.AIR : (ly % 7 === 4 && (lx === 0 || lz === 0)) ? B.GLASS : hash3(lx, ly, lz) < 0.25 ? B.MOSSYBRICK : hash3(lx, ly + 1, lz) < 0.08 ? B.CRACKEDBRICK : B.STONEBRICK);
    else P(lx, ly, lz, ly <= 0 ? B.STONEBRICK : B.AIR);
  }
  P(0, 1, -5, B.AIR); P(0, 2, -5, B.AIR); P(0, 3, -5, B.AIR); P(1, 1, -5, B.AIR); P(1, 2, -5, B.AIR);
  const floors = [7, 14, 21];
  floors.forEach((fy, i) => {
    fill(P, -4, fy, -4, 4, fy, 4, B.PLANKS_DARK);
    const lx = i % 2 ? -3 : 3;
    fill(P, lx, fy, 3, lx, fy, 3, B.AIR);
    for (let ly = fy - 6; ly <= fy; ly++) P(lx, ly, 3, B.LADDER, 2);
    P(i % 2 ? 3 : -3, fy + 1, -3, B.LAMP); P(0, fy + 1, 0, B.RUNEPILLAR); P(0, fy + 2, 0, B.RUNEPILLAR);
    P(-3, fy + 1, -3, B.CRATE); P(i % 2 ? -3 : 3, fy + 1, 3, B.WEB);
  });
  for (let ly = 22; ly <= top - 1; ly++) P(-3, ly, 3, B.LADDER, 2);
  fill(P, -4, top - 3, -4, 4, top - 3, 4, B.STONEBRICK); P(-3, top - 3, 3, B.AIR);
  P(0, top - 2, 0, B.ALTAR); addChest(P, 0, top - 1, 0, 'tower', 0);
  for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { P(a, top - 2, b, B.STONEPOST); P(a, top - 1, b, B.LAMP); }
  // vines on the outside
  for (let k = 0; k < 40; k++) { const side = k % 4, off = Math.floor(rng() * 9) - 4, len = 4 + Math.floor(rng() * 12), y0 = 4 + Math.floor(rng() * 18); for (let i = 0; i < len; i++) { const ly = y0 - i; if (ly < 1) break; const [lx, lz, f] = side === 0 ? [off, -6, 2] : side === 1 ? [6, off, 3] : side === 2 ? [off, 6, 0] : [-6, off, 1]; if (P.get(lx, ly, lz) === 0 && P.get(lx + (f === 3 ? -1 : f === 1 ? 1 : 0), ly, lz + (f === 2 ? 1 : f === 0 ? -1 : 0)) !== 0) P(lx, ly, lz, B.VINES, f); } }
  addLore(P, 2, 1, 4, "The Watchkeeper's Last Entry", 'Day 41. The shades come up the ladders now. I have barred the lower floors and moved the bow to the roof altar. If you are reading this, climb. Do not stop on the second floor.', 'tower', B.TABLET);
  addChest(P, -3, 1, 3, 'supply', 0);
  addSpawn(cx, gy + 8, cz, 'shade', 2, 3); addSpawn(cx, gy + 15, cz, 'shade', 2, 3); addSpawn(cx, gy + 22, cz, 'shade', 2, 3);
}
function bogHagHut(s) {
  const { x: cx, z: cz } = s, deck = SEA + 3, P = mk(cx, deck, cz, Math.floor(rng() * 4));
  addSite("Bog Hag's Hut", 'Ancient place', 'ancient', cx, deck, cz, 12);
  for (let lz = -4; lz <= 4; lz++) for (let lx = -4; lx <= 4; lx++) { P(lx, 0, lz, B.PLANKS_DARK); if (Math.abs(lx) === 4 && Math.abs(lz) === 4) { for (let ly = -1; ly > -10; ly--) { const p = P.at(lx, ly, lz); if (SOLID[getB(p[0], p[1], p[2])]) break; P(lx, ly, lz, B.DARKLOG); } } }
  for (let ly = 1; ly <= 4; ly++) for (let lz = -3; lz <= 3; lz++) for (let lx = -3; lx <= 3; lx++) { const e = Math.abs(lx) === 3 || Math.abs(lz) === 3; P(lx, ly, lz, e ? (Math.abs(lx) === 3 && Math.abs(lz) === 3 ? B.DARKLOG : (ly === 2 && (lx === 0 || lz === 0) ? B.GLASS : B.PLANKS_DARK)) : B.AIR); }
  P(0, 1, -3, B.AIR); P(0, 2, -3, B.AIR);
  for (let k = 0; k < 4; k++) for (let lz = -4 + k; lz <= 4 - k; lz++) for (let lx = -4 + k; lx <= 4 - k; lx++) if (Math.max(Math.abs(lx), Math.abs(lz)) === 4 - k) P(lx, 5 + k, lz, hash3(lx, k, lz) < 0.3 ? B.MOSSYCOBBLE : B.THATCH);
  P(0, 9, 0, B.DARKLOG); P(0, 10, 0, B.DARKLOG); P(1, 10, 0, B.DARKLOG);
  P(0, 1, 0, B.CAULDRON); P(0, 0, 0, B.FIRE);
  const c = P.at(0, 2, 0); Emitters.push({ x: c[0] + 0.5, y: c[1] + 0.2, z: c[2] + 0.5, type: 'bubble' });
  P(-2, 1, 2, B.BOOKSHELF); P(-2, 2, 2, B.MUSHROOM); P(2, 1, 2, B.BARREL); P(2, 1, -2, B.GLOWSHROOM); P(-2, 1, -2, B.POT);
  addChest(P, 0, 1, 2, 'witch', 0);
  addLore(P, -2, 1, 0, 'Scrawled on a Bog Plank', 'Pretty knife, pretty knife, sharp as a lie. Strike from behind and the big ones die. Keep it from the Warden. It knows the blade.', 'witch', B.TABLET);
  P(0, 4, 0, B.LAMP);
  for (let ly = -1; ly >= -6; ly--) { const p = P.at(0, ly, -5); if (SOLID[getB(p[0], p[1], p[2])]) break; P(0, ly, -5, B.LADDER, 0); }
  P(0, 0, -5, B.LADDER, 0);
}
function drownedHalls(s) {
  const { x: cx, z: cz } = s;
  const floor = 15, ceil = 21, R = 26;
  // carve a deep lake
  for (let z = cz - R - 4; z <= cz + R + 4; z++) for (let x = cx - R - 4; x <= cx + R + 4; x++) {
    const d = Math.hypot(x - cx, z - cz); if (d > R + 4) continue;
    const bed = d < R ? floor - 2 : Math.round(lerp(floor - 2, hmap[x + z * W], (d - R) / 4));
    for (let y = H - 1; y > bed; y--) setB(x, y, z, y <= SEA ? B.WATER : B.AIR);
    setB(x, bed, z, B.MUD); for (let y = bed - 1; y > bed - 3; y--) setB(x, y, z, B.STONE);
    hmap[x + z * W] = bed;
  }
  addSite('The Drowned Halls', 'Ancient place', 'ancient', cx, SEA, cz, 30);
  const P = mk(cx, floor, cz, 0);
  // outer citadel: 41x41 stone shell from the lake bed up to above the surface
  const M = 18;
  for (let ly = -2; ly <= ceil - floor + 3; ly++) for (let lz = -M; lz <= M; lz++) for (let lx = -M; lx <= M; lx++) {
    const e = Math.abs(lx) === M || Math.abs(lz) === M;
    const y = floor + ly;
    if (ly <= 0) P(lx, ly, lz, ly === 0 ? B.STONEBRICK : B.STONE);
    else if (e || y === ceil + 1 || y === ceil + 2) P(lx, ly, lz, hash3(lx, ly, lz) < 0.3 ? B.MOSSYBRICK : hash3(lx, ly + 3, lz) < 0.06 ? B.CRACKEDBRICK : B.STONEBRICK);
    else if (y > ceil + 2) P(lx, ly, lz, (e && (lx + lz) % 2) ? B.STONEBRICK : B.AIR);
    else P(lx, ly, lz, B.AIR);
  }
  // entrance tower on the roof (island), above the entry hall
  const TZ = -11, top = ceil - floor;
  for (let ly = top + 3; ly <= top + 10; ly++) for (let lz = TZ - 3; lz <= TZ + 3; lz++) for (let lx = -3; lx <= 3; lx++) { const e = Math.abs(lx) === 3 || Math.abs(lz - TZ) === 3; P(lx, ly, lz, e ? (ly % 3 === 0 ? B.MOSSYBRICK : B.STONEBRICK) : B.AIR); }
  P(0, top + 4, TZ - 3, B.AIR); P(0, top + 5, TZ - 3, B.AIR);
  fill(P, -4, top + 11, TZ - 4, 4, top + 11, TZ + 4, B.MOSSYBRICK);
  fill(P, -1, top + 1, TZ + 1, 1, top + 2, TZ + 3, B.AIR);
  for (let ly = 1; ly <= top + 10; ly++) P(0, ly, TZ + 2, B.LADDER, 2);
  P(2, top + 4, TZ, B.LAMP); P(-2, top + 4, TZ, B.LAMP);
  // giant guardian statues flanking the tower, half submerged
  for (const sx of [-12, 12]) {
    fill(P, sx - 2, ceil - floor + 3, -2, sx + 2, ceil - floor + 12, 2, B.MOSSYBRICK);
    fill(P, sx - 1, ceil - floor + 13, -1, sx + 1, ceil - floor + 15, 1, B.MOSSYBRICK);
    P(sx, ceil - floor + 14, -2, B.CRYSTAL);
    fill(P, sx + (sx > 0 ? -3 : 3), ceil - floor + 5, -1, sx + (sx > 0 ? -3 : 3), ceil - floor + 10, -1, B.MOSSYBRICK);
  }
  // inner layout: entry hall (z -16..-6), side corridors, warden arena (z -2..16), vault
  const wall = (x0, z0, x1, z1) => fill(P, x0, 1, z0, x1, ceil - floor, z1, B.STONEBRICK);
  wall(-17, -5, 17, -5); P(0, 1, -5, B.AIR); P(0, 2, -5, B.AIR); P(1, 1, -5, B.AIR); P(1, 2, -5, B.AIR); P(-1, 1, -5, B.AIR); P(-1, 2, -5, B.AIR);
  wall(-6, -17, -6, -5); wall(6, -17, 6, -5); P(-6, 1, -10, B.AIR); P(-6, 2, -10, B.AIR); P(6, 1, -10, B.AIR); P(6, 2, -10, B.AIR);
  // entry hall: pillars, spike traps, waystone
  for (const lz of [-14, -9]) for (const lx of [-3, 3]) fill(P, lx, 1, lz, lx, ceil - floor, lz, B.STONEPOST);
  for (let lz = -13; lz <= -7; lz += 2) for (let lx = -1; lx <= 1; lx++) if ((lx + lz) % 2 && !(lx === 0 && Math.abs(lz - TZ - 2) <= 1)) P(lx, 1, lz, B.SPIKES);
  P(4, 1, -16, B.WAYSTONE); P(4, 2, -16, B.WAYSTONE);
  P(-4, 1, -16, B.LAMP); P(4, ceil - floor, -10, B.LAMP); P(-4, ceil - floor, -10, B.LAMP);
  addLore(P, -4, 1, -6, 'Plaque of the Drowned Halls', 'Here the Order of the Deep kept the Seal. When the lake rose they did not leave their posts. They still guard it, in their way.', 'halls', B.TABLET);
  // west wing: drowned knights + coffer; east wing: hidden vault behind cracked bricks
  addChest(P, -15, 1, -15, 'coffer', 1); P(-15, 1, -7, B.BARREL); P(-10, ceil - floor, -10, B.LAMP);
  for (let lz = -15; lz <= -7; lz += 4) fill(P, -11, 1, lz, -11, ceil - floor, lz, B.STONEPOST);
  P(10, ceil - floor, -10, B.LAMP); P(15, 1, -15, B.CRATE); P(15, 2, -15, B.CRATE);
  fill(P, 17, 1, -13, 17, 3, -11, B.CRACKEDBRICK);
  for (let lz = -14; lz <= -10; lz++) for (let lx = 18; lx <= 22; lx++) for (let ly = 0; ly <= 4; ly++) P(lx, ly, lz, (lx === 22 || lz === -14 || lz === -10 || ly === 0 || ly === 4) ? B.STONEBRICK : B.AIR);
  fill(P, 17, 1, -13, 17, 3, -11, B.CRACKEDBRICK);
  addChest(P, 21, 1, -12, 'vault', 3); P(20, 3, -12, B.LAMP); P(21, 1, -13, B.GOLD_BLOCK); P(21, 1, -11, B.GOLD_BLOCK);
  addSpawn(cx - 12, floor + 1, cz - 11, 'knight', 3, 4); addSpawn(cx + 12, floor + 1, cz - 11, 'sentinel', 2, 4);
  // warden arena
  for (const [lx, lz] of [[-10, 2], [10, 2], [-10, 12], [10, 12]]) { fill(P, lx, 1, lz, lx + 1, ceil - floor, lz + 1, B.MOSSYBRICK); P(lx, 4, lz - 1, B.LAMP); }
  for (let lx = -16; lx <= 16; lx++) { P(lx, 0, 7, B.WATER); P(lx, -1, 7, B.STONEBRICK); }
  for (let lz = -3; lz <= 16; lz++) { P(-16, 0, lz, B.WATER); P(16, 0, lz, B.WATER); }
  BossRooms.push({ type: 'warden', x: cx, y: floor + 1, z: cz + 7, r: 13, done: false, name: 'The Mirewarden', sub: 'Keeper of the Deepseal Key' });
  // the Seal and the stair down
  fill(P, -2, 1, 15, 2, 4, 17, B.ANCIENT_GOLD); fill(P, -1, 1, 15, 1, 3, 17, B.AIR);
  P(0, 1, 14, B.ALTAR); P(0, 2, 14, B.ALTAR); P(-1, 1, 14, B.ALTAR); P(1, 1, 14, B.ALTAR); P(-1, 2, 14, B.ALTAR); P(1, 2, 14, B.ALTAR);
  s.seal = [P.at(-1, 1, 14), P.at(0, 1, 14), P.at(1, 1, 14), P.at(-1, 2, 14), P.at(0, 2, 14), P.at(1, 2, 14)];
  addLore(P, 3, 1, 14, 'The Seal of the Deep', 'Beneath this seal the Guardian sleeps. Only the key the Warden carries will open it. Whoever passes: the Heart remembers every blow.', 'seal', B.TABLET);
  // spiral stair from the seal chamber down into the colossus arena
  const aFloor = 3, aTop = floor - 3;
  let ly = 0, k = 0;
  const ring = [[0, 16], [1, 16], [1, 17], [0, 17], [-1, 17], [-1, 16]];
  while (floor + ly > aFloor + 1) { const [lx, lz] = ring[k % ring.length]; fill(P, lx, ly - 3, lz, lx, ly + 2, lz, B.AIR); P(lx, ly - 1, lz, B.POLISHED); ly--; k++; }
  fill(P, -1, ly - 3, 16, 1, ly + 3, 17, B.AIR);
  fill(P, -1, ly - 3, 18, 1, aFloor - floor + 3, 22, B.AIR); P(0, ly + 1, 18, B.LAMP);
  // colossus arena: a huge glowing cavern
  const az = cz + 36, AR = 18;
  const A = mk(cx, aFloor, az, 0);
  for (let lz = -AR; lz <= AR; lz++) for (let lx = -AR; lx <= AR; lx++) {
    const d = Math.hypot(lx, lz); if (d > AR + 1.5) continue;
    for (let ly2 = 0; ly2 <= aTop - aFloor + 4; ly2++) {
      const roof = (aTop - aFloor + 3) - Math.max(0, (d - AR + 6)) * 0.8;
      if (d > AR || ly2 === 0 || ly2 > roof) { if (ly2 === 0) A(lx, ly2, lz, (Math.floor(lx / 3) + Math.floor(lz / 3)) % 2 ? B.POLISHED : B.STONEBRICK); else if (d > AR) A(lx, ly2, lz, hash3(lx, ly2, lz) < 0.1 ? B.CRYSTAL : B.STONE); else A(lx, ly2, lz, hash3(lx, ly2, lz) < 0.06 ? B.CRYSTAL : B.STONE); }
      else A(lx, ly2, lz, B.AIR);
    }
  }
  // corridor from the stair to the arena
  for (let z = cz + 18; z <= az - AR + 1; z++) for (let lx = -1; lx <= 1; lx++) { setB(cx + lx, aFloor, z, B.POLISHED); for (let y = aFloor + 1; y <= aFloor + 3; y++) setB(cx + lx, y, z, B.AIR); setB(cx + lx, aFloor + 4, z, B.STONEBRICK); if (z % 5 === 0) setB(cx - 1, aFloor + 3, z, B.LAMP); }
  const pylons = [];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, lx = Math.round(Math.cos(a) * 12), lz = Math.round(Math.sin(a) * 12); fill(A, lx, 1, lz, lx, 6, lz, B.ENERGY); A(lx, 7, lz, B.CRYSTAL); pylons.push(A.at(lx, 1, lz)); }
  for (let i = 0; i < 16; i++) { const a = rng() * 6.28, d = 6 + rng() * 11, lx = Math.round(Math.cos(a) * d), lz = Math.round(Math.sin(a) * d); if (A.get(lx, 1, lz) === 0) A(lx, 1, lz, B.CRYSTAL_CLUSTER); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, lx = Math.round(Math.cos(a) * 17), lz = Math.round(Math.sin(a) * 17); A(lx, 1, lz, B.STONEPOST); A(lx, 2, lz, B.STONEPOST); A(lx, 3, lz, B.LAMP); }
  BossRooms.push({ type: 'colossus', x: cx, y: aFloor + 1, z: az, r: 16, done: false, name: 'The Sleeping Colossus', sub: 'Heart of the Buried World', pylons });
  s.portal = [cx, aFloor + 1, az - 6];
  s.exit = [cx + 0.5, SEA + 8, cz - 22];
  // a small dock to reach the entrance
  for (let lz = -R - 3; lz <= -18; lz++) for (let lx = -1; lx <= 1; lx++) { setB(cx + lx, SEA + 1, cz + lz, B.PLANKS_DARK); if (lz % 4 === 0 && lx !== 0) { setB(cx + lx, SEA + 2, cz + lz, B.FENCE); if (lz % 8 === 0) setB(cx + lx, SEA + 3, cz + lz, B.LAMP); } }
  for (let lx = -1; lx <= 1; lx++) P(lx, ceil - floor + 3, -M, B.AIR);
}

// ---------------------------------------------------------------- the Skyward Spiral (parkour course)
// A long spiral of floating blocks that winds around a stone spire up to the top of the sky. Every jump
// in it can be made with a plain jump or a sprint-jump; gold checkpoint platforms catch you when you fall.
const Course = { pads: new Map(), cps: [], cx: 0, cz: 0, r: 0, gy: 0, top: 0, jumps: 0 };
const PK_KINDS = { // dy, target centre distance, allowed range, block shape
  hop: { dy: 1, d: 2.3, lo: 2, hi: 2.9 },
  climb: { dy: 1, d: 3.3, lo: 3, hi: 3.6 },
  flat: { dy: 0, d: 3, lo: 2.6, hi: 3.3 },
  long: { dy: 0, d: 4.6, lo: 4.3, hi: 4.9 },
  drop: { dy: -1, d: 5, lo: 4.6, hi: 5.4 },
  post: { dy: 0, d: 2.4, lo: 2, hi: 2.9, post: true },
  postup: { dy: 1, d: 2.1, lo: 2, hi: 2.3, post: true },
};
const PK_SEQ = ['hop', 'flat', 'climb', 'post', 'hop', 'drop', 'climb', 'long', 'hop', 'postup', 'flat', 'drop'];
const PK_THEMES = [
  [B.WOOL_RED, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_BLUE, B.WOOL_PURPLE, B.WOOL_WHITE],
  [B.LOG, B.PLANKS, B.HAY, B.PLANKS_DARK, B.DARKLOG, B.THATCH],
  [B.STONEBRICK, B.MOSSYBRICK, B.POLISHED, B.BASALT, B.REDBRICK, B.SANDBRICK],
  [B.GLASS, B.CRYSTAL, B.GLASS, B.STARSTONE, B.GLASS, B.CRYSTAL],
  [B.LAMP, B.GOLD_BLOCK, B.IRON_BLOCK, B.ANCIENT_GOLD, B.STARSTONE, B.LAMP],
];
function parkourSpiral(s) {
  const { x: cx, z: cz } = s, gy = s.gy, TOP = H - 5, R0 = 12.5, R1 = 6;
  terraform(cx, cz, 15, gy, B.GRASS, B.DIRT, 7);
  addSite('The Skyward Spiral', 'Parkour', 'sight', cx, gy, cz, 16);
  Object.assign(Course, { pads: new Map(), cps: [], path: [], cx, cz, r: R0 + 2, gy, top: TOP, jumps: 0 });
  const occ = new Map(); // column -> list of heights already used
  const col = (x, z) => x + z * W;
  let padNo = -1; // which pad a block belongs to; the pad you jump from may sit close to the next one
  const mark = (x, y, z) => { const k = col(x, z); (occ.get(k) || occ.set(k, []).get(k)).push([y, padNo]); };
  const put = (x, y, z, id, info) => { setB(x, y, z, id); mark(x, y, z); if (info) Course.pads.set(K(x, y, z), info); };
  // the spire in the middle, with glowing bands
  for (let y = gy + 1; y < TOP; y++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    if (dx * dx + dz * dz > 5) continue;
    const band = (y - gy) % 7 === 0, edge = dx * dx + dz * dz >= 4;
    put(cx + dx, y, cz + dz, band ? (edge && (dx === 0 || dz === 0) ? B.LAMP : B.POLISHED) : hash3(cx + dx, y, cz + dz) < 0.12 ? B.MOSSYBRICK : B.STONEBRICK);
  }
  // summit: a round platform on top of the spire
  const finish = { finish: true };
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const d2 = dx * dx + dz * dz; if (d2 > 17) continue;
    put(cx + dx, TOP, cz + dz, d2 <= 2 ? B.GOLD_BLOCK : d2 >= 13 ? B.ANCIENT_GOLD : B.POLISHED, finish);
  }
  for (const [dx, dz] of [[-3, -2], [3, 2], [-2, 3], [2, -3]]) { setB(cx + dx, TOP + 1, cz + dz, B.STONEPOST); setB(cx + dx, TOP + 2, cz + dz, B.LAMP); }
  setB(cx, TOP + 1, cz, B.CHEST, 0); Chests.set(K(cx, TOP + 1, cz), { table: 'ruins', items: null });
  Emitters.push({ x: cx + 0.5, y: TOP + 2, z: cz + 0.5, type: 'sparkle' });
  // start pad on the ground
  const a0 = 0, sx = Math.round(cx + Math.cos(a0) * R0), sz = Math.round(cz + Math.sin(a0) * R0), sy = gy + 1;
  const start = { start: true, cp: 0 };
  padNo = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(sx + dx, sy, sz + dz, dx || dz ? B.POLISHED : B.WOOL_GREEN, start);
  Course.cps.push([sx + 0.5, sy + 1, sz + 0.5]); Course.path.push([sx, sy, sz, 'start']);
  const lx = sx + 2, lz = sz; setB(lx, gy + 1, lz, B.TABLET);
  Lore.set(K(lx, gy + 1, lz), { title: 'The Skyward Spiral', text: 'Stand on the green block, then jump from block to block all the way up the spire. Some gaps need a sprint-jump (sprint, then jump at the edge). Gold platforms are checkpoints: if you fall you are caught and put back on the last one, without fall damage. A timer runs from the moment you leave the start. A reward waits on the summit.', art: 'tower' });
  setB(sx - 2, gy + 1, sz - 2, B.STONEPOST); setB(sx - 2, gy + 2, sz - 2, B.LAMP); setB(sx - 2, gy + 1, sz + 2, B.STONEPOST); setB(sx - 2, gy + 2, sz + 2, B.LAMP);
  // can a pad go here? keep 3 blocks of head room above and below every block
  const clear = (cells, y) => {
    for (const [x, z] of cells) {
      if (x < 2 || z < 2 || x >= W - 2 || z >= D - 2) return false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ys = occ.get(col(x + dx, z + dz)); if (!ys) continue;
        for (const [yy, pn] of ys) if (pn >= 0 && pn === padNo) continue; else if (dx === 0 && dz === 0 ? Math.abs(yy - y) <= 3 : yy - y >= -1 && yy - y <= 3) return false;
      }
    }
    return true;
  };
  const radiusAt = y => R0 - (R0 - R1) * Math.min(1, Math.max(0, (y - sy) / (TOP - 1 - sy)));
  let px = sx, pz = sz, py = sy, th = a0, n = 0, cpN = 0, kindI = 0;
  while (py < TOP - 1 && n < 200) {
    const isCp = n > 0 && n % 12 === 11;
    let kind = PK_SEQ[kindI % PK_SEQ.length]; kindI++;
    if (isCp && PK_KINDS[kind].post) kind = 'flat';
    let best = null;
    for (const [kk, dr] of [[kind, 0], [kind, -1], [kind, 1], ['flat', 0], ['hop', 0], ['flat', -1.5], ['hop', 1.5], ['flat', 1.5], ['hop', -1.5], ['climb', 0]]) {
      const k = PK_KINDS[kk], ny = py + k.dy, R = radiusAt(ny) + dr;
      for (let st = 0; st < 90; st++) {
        const a = th + (k.d / R) * (0.55 + st * 0.03), x = Math.round(cx + Math.cos(a) * R), z = Math.round(cz + Math.sin(a) * R);
        const ed = Math.hypot(x - px, z - pz); if (ed < k.lo || ed > k.hi) continue;
        if (Math.hypot(x - cx, z - cz) < 4.8) continue;
        const cells = isCp ? [[x - 1, z - 1], [x, z - 1], [x + 1, z - 1], [x - 1, z], [x, z], [x + 1, z], [x - 1, z + 1], [x, z + 1], [x + 1, z + 1]] : [[x, z]];
        if (!clear(cells, ny)) continue;
        const sc = Math.abs(ed - k.d); if (!best || sc < best.sc) best = { x, z, y: ny, a: Math.atan2(z - cz, x - cx), sc, kk, cells };
      }
      if (best) break;
    }
    if (!best) break;
    n++; padNo = n;
    const f = (best.y - sy) / (TOP - 1 - sy), theme = PK_THEMES[Math.min(4, Math.floor(f * 5))];
    let id = theme[n % theme.length];
    if (PK_KINDS[best.kk].post) id = f < 0.4 ? B.FENCE : B.STONEPOST;
    if (isCp) {
      cpN++;
      const info = { cp: cpN };
      for (const [x, z] of best.cells) put(x, best.y, z, x === best.x && z === best.z ? B.GOLD_BLOCK : B.POLISHED, info);
      Course.cps.push([best.x + 0.5, best.y + 1, best.z + 0.5]);
      Emitters.push({ x: best.x + 0.5, y: best.y + 1.2, z: best.z + 0.5, type: 'sparkle' });
    } else put(best.x, best.y, best.z, id, { n });
    Course.path.push([best.x, best.y, best.z, isCp ? 'cp' : best.kk]);
    px = best.x; pz = best.z; py = best.y; th = best.a;
  }
  // the last jump: onto the nearest edge of the summit
  let fx = cx, fz = cz, fd = 1e9;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { if (dx * dx + dz * dz > 17) continue; const d = Math.hypot(cx + dx - px, cz + dz - pz); if (d < fd) { fd = d; fx = cx + dx; fz = cz + dz; } }
  Course.path.push([fx, TOP, fz, 'finish']);
  Course.jumps = n + 1;
  s.spawn = [sx + 0.5, sy + 1, sz + 0.5];
}

// ---------------------------------------------------------------- placement
function buildStructures() {
  const S = {};
  PROT.fill(0); Object.assign(Course, { pads: new Map(), cps: [], path: [], jumps: 0 });
  const must = (name, rad, o, fn) => { const s = findSpot(rad, o) || findSpot(rad, Object.assign({}, o, { near: undefined, biome: undefined, maxVar: (o.maxVar || 5) + 6, minDist: 30, allowWet: (o.allowWet || 2) + 4 })); if (s) { fn(s); S[name] = s; const site = Sites[Sites.length - 1]; if (site) protect(site.x, site.z, Math.max(rad, site.r) + 2); } return s; };
  must('wheatmere', 30, { near: [128, 128], spread: 45, biome: 0, maxVar: 8, minDist: 0, allowWet: 5 }, villageWheatmere);
  must('stiltwick', 28, { biome: 2, maxVar: 6, allowWet: 25, minDist: 60 }, villageStiltwick);
  must('sahra', 30, { biome: 3, maxVar: 7, minDist: 60, strict: true }, villageSahra);
  must('shardholm', 26, { biome: 4, maxVar: 10, minDist: 60 }, villageShardholm);
  must('spiral', 17, { near: S.wheatmere ? [S.wheatmere.x, S.wheatmere.z] : [128, 128], spread: 70, maxVar: 7, minDist: 40, allowWet: 3 }, parkourSpiral);
  must('halls', 32, { biome: 2, maxVar: 8, allowWet: 25, minDist: 55 }, drownedHalls);
  must('tower', 10, { biome: 1, maxVar: 5, minDist: 45 }, ruinedWatchtower);
  must('hag', 6, { biome: 2, maxVar: 4, allowWet: 25, minDist: 35 }, bogHagHut);
  must('bastion', 24, { biome: 5, maxVar: 8, minDist: 50, allowWet: 6 }, ashenBastion);
  must('king', 15, { biome: 0, maxVar: 5, minDist: 45 }, sovereign);
  must('oath', 12, { biome: 4, maxVar: 9, minDist: 40 }, shatteredOath);
  must('lookout', 8, { biome: 0, maxVar: 5, minDist: 40 }, beaconLookout);
  must('wagon', 6, { biome: 3, maxVar: 5, minDist: 35 }, wreckedWagon);
  must('grave', 12, { biome: 1, maxVar: 5, minDist: 35 }, graveyard);
  must('mine', 8, { biome: 4, maxVar: 9, minDist: 35 }, deepveinMine);
  must('ruins', 15, { biome: 1, maxVar: 6, minDist: 40 }, ostmereRuins);
  must('camp1', 8, { biome: 1, maxVar: 5, minDist: 35 }, s => camp(s, "Woodcutter's Camp", 'Camp', B.GRASS, B.DIRT));
  must('camp2', 8, { biome: 0, maxVar: 5, minDist: 35 }, s => camp(s, "Traveller's Rest", 'Camp', B.GRASS, B.DIRT));
  must('camp3', 8, { biome: 3, maxVar: 5, minDist: 35 }, s => camp(s, 'Dune Camp', 'Camp', B.SAND, B.SANDSTONE));
  must('camp4', 8, { biome: 5, maxVar: 6, minDist: 35 }, s => camp(s, 'Ember Camp', 'Camp', B.ASH, B.BASALT));
  must('camp5', 8, { biome: 4, maxVar: 8, minDist: 35 }, s => camp(s, 'Crystal Camp', 'Camp', B.STONE, B.STONE));
  // roads between villages
  const v = ['wheatmere', 'sahra', 'shardholm', 'stiltwick'].map(k => S[k]).filter(Boolean);
  for (let i = 1; i < v.length; i++) pathLine(v[0].x, v[0].z, v[i].x, v[i].z, 3);
  if (S.king && v[0]) pathLine(v[0].x, v[0].z, S.king.x, S.king.z, 2);
  if (S.lookout && v[0]) pathLine(v[0].x, v[0].z, S.lookout.x, S.lookout.z, 2);
  if (S.spiral && v[0]) pathLine(v[0].x, v[0].z, Math.round(Course.cps[0][0]), Math.round(Course.cps[0][2]), 2);
  return S;
}

// ---------------------------------------------------------------- signature treasure
// Every structure keeps one treasure chest with loot that belongs to that place: a relic power-up,
// an enchanted tool or weapon, or rare potions. It is found the first time that chest is opened.
const SITE_TREASURE = {
  'Wheatmere': [[I.hearth_charm, 1], [I.pot_regen, 1]],
  'Stiltwick': [[I.tide_charm, 1], [I.fish, 6]],
  'Sahra Oasis': [[I.sun_amulet, 1], [I.pot_fire, 1]],
  'Shardholm': [[I.miner_charm, 1], [I.pot_haste, 1]],
  'The Drowned Halls': [[I.pot_strength, 1], [I.pot_regen, 1]],
  'Ruined Watchtower': [[I.feather_charm, 1], [I.arrow, 16]],
  "Bog Hag's Hut": [[I.pot_leap, 2], [I.pot_night, 1], [I.wood_sword, 1, { looting: 2, knockback: 1 }]],
  'The Ashen Bastion': [[I.stone_sword, 1, { fire: 2, sharpness: 2 }], [I.pot_fire, 1]],
  'The Knelt Sovereign': [[I.pot_strength, 2], [I.gold, 10]],
  'The Shattered Oath': [[I.crystal_sword, 1, { sharpness: 3 }]],
  'Beacon Lookout': [[I.owl_charm, 1]],
  'Wrecked Wagon': [[I.lucky_coin, 1], [I.gold, 8]],
  'Hollowmere Graveyard': [[I.stone_shovel, 1, { efficiency: 3 }], [I.pot_regen, 1]],
  'Deepvein Mine': [[I.stone_pick, 1, { efficiency: 2, fortune: 1 }], [I.lapis, 8]],
  'Ruins of Ostmere': [[I.pot_haste2, 1], [I.lapis, 6], [B.ENCHANT_TABLE, 1]],
  "Woodcutter's Camp": [[I.stone_axe, 1, { efficiency: 2 }]],
  "Traveller's Rest": [[I.pot_swift, 2], [I.ration, 2]],
  'Dune Camp': [[I.pot_fire, 1], [I.gold, 5], [I.ranger_bow, 1, { power: 2 }]],
  'Ember Camp': [[I.pot_fire, 2], [I.ember, 3]],
  'Crystal Camp': [[I.shard, 6], [I.pot_night, 1]],
  'The Skyward Spiral': [[I.feather_charm, 1], [I.pot_leap, 2], [I.pot_swift, 2], [I.gold, 12]],
};
function treasureFor(s) { return SITE_TREASURE[s.name] || [[[I.pot_haste, I.pot_swift, I.pot_strength, I.pot_night][s.name.length % 4], 1], [I.gold, 4]]; }
function placeTreasures() {
  for (const s of Sites) {
    let best = null, bd = 1e9;
    for (const [k, c] of Chests) { if (c.items || c.made || c.treasure) continue; const [x, y, z] = k.split(',').map(Number); if (getB(x, y, z) !== B.CHEST) continue; const d = Math.hypot(x - s.x, z - s.z); if (d < s.r + 6 && d < bd) { bd = d; best = k; } }
    if (!best) { // no chest here yet: put one on open ground near the middle
      for (let r = 2; r < 12 && !best; r++) for (let a = 0; a < 8 && !best; a++) {
        const x = Math.floor(s.x + Math.cos(a * 0.785 + r) * r), z = Math.floor(s.z + Math.sin(a * 0.785 + r) * r), y = groundY(x, z) + 1;
        if (getB(x, y, z) || getB(x, y + 1, z) || !SOLID[getB(x, y - 1, z)] || getB(x, y - 1, z) === B.WATER) continue;
        setB(x, y, z, B.CHEST, a % 4); best = K(x, y, z); Chests.set(best, { table: 'ruins', items: null });
      }
    }
    if (!best) continue;
    Chests.get(best).treasure = s.name; s.treasureKey = best;
    s.treasureText = treasureFor(s).map(([id, n, e]) => (n > 1 ? n + '× ' : '') + itemDef(id).name + (e ? ' (enchanted)' : '')).join(', ');
  }
}
function claimTreasure(c, h) {
  const site = Sites.find(s => s.name === c.treasure); if (!site) return;
  const list = treasureFor(site);
  list.forEach(([id, n, e], i) => { const st = { id, n }; if (e) st.ench = Object.assign({}, e); let j = c.items.indexOf(null); if (j < 0) j = i; c.items[j] = st; });
  notify('Treasure found!', site.name, iconURL(B.CHEST));
  Sound.discover();
  burst(h.x + 0.5, h.y + 1, h.z + 0.5, 40, { life: 1.2, size: 0.1, r: 1, g: 0.85, b: 0.3, glow: true, spread: 3, up: 4 });
}
