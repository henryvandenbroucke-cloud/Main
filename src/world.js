'use strict';
/* World data, terrain generation and lighting. */
const W = 256, D = 256, H = 64, SEA = 22, CS = 16;
const NCX = W / CS, NCZ = D / CS;
const VOL = W * D * H;
const wb = new Uint8Array(VOL);      // block ids
const wm = new Uint8Array(VOL);      // meta (facing 0..3)
const wsky = new Uint8Array(VOL);    // sky light 0..15
const wbl = new Uint8Array(VOL);     // block light 0..15
const hmap = new Int16Array(W * D);  // terrain height
const bmap = new Uint8Array(W * D);  // biome
// The world is an endless plane stored in a 256x256 ring buffer: absolute block (x, z) lives at (x & 255, z & 255).
// Each 16x16 chunk slot remembers which absolute chunk currently occupies it.
const IDX = (x, y, z) => (x & 255) + (z & 255) * W + y * W * D;
const COL = (x, z) => (x & 255) + (z & 255) * W;
const SLOT_EMPTY = -2147483647;
const slotCX = new Int32Array(NCX * NCZ).fill(SLOT_EMPTY), slotCZ = new Int32Array(NCX * NCZ).fill(SLOT_EMPTY);
const slotOf = (cx, cz) => (cx & 15) + (cz & 15) * 16;
function chunkResident(cx, cz) { const s = (cx & 15) + (cz & 15) * 16; return slotCX[s] === cx && slotCZ[s] === cz; }
function resident(x, z) { const cx = x >> 4, cz = z >> 4, s = (cx & 15) + (cz & 15) * 16; return slotCX[s] === cx && slotCZ[s] === cz; }
let CLIP = null; // [x0,x1,z0,z1] while generating one chunk: writes outside it are dropped
const inWorld = (x, y, z) => y >= 0 && y < H && resident(x, z);
function getB(x, y, z) { if (y < 0) return B.BEDROCK; if (y >= H || !resident(x, z)) return 0; return wb[(x & 255) + (z & 255) * W + y * W * D]; }
function setB(x, y, z, id, meta) {
  if (CLIP && (x < CLIP[0] || x > CLIP[1] || z < CLIP[2] || z > CLIP[3])) return;
  if (inWorld(x, y, z)) { const i = IDX(x, y, z); wb[i] = id; wm[i] = meta || 0; }
}
function getMeta(x, y, z) { return inWorld(x, y, z) ? wm[IDX(x, y, z)] : 0; }

const BIOMES = [
  { name: 'Meadowbrook Vale', lore: 'Wheat, windmills and the smell of fresh bread.', fog: 0xbfd8ee, fogNear: 60, fogFar: 150, mob: ['deer', 'boar'], night: ['shade'] },
  { name: 'Ancient Forest', lore: 'The oaks here were old before the sky split.', fog: 0x9cc7a4, fogNear: 40, fogFar: 120, mob: ['deer'], night: ['shade', 'shade'] },
  { name: 'Mystic Marsh', lore: 'Do not follow the lights over the water.', fog: 0x7f9a82, fogNear: 22, fogFar: 90, mob: ['shade'], night: ['shade', 'shade'] },
  { name: 'Sunscorch Dunes', lore: 'The sand remembers every traveller it swallowed.', fog: 0xe8d4a8, fogNear: 45, fogFar: 135, mob: ['crawler'], night: ['crawler', 'crawler', 'shade'] },
  { name: 'Crystal Highlands', lore: 'Where the burning shards fell, the mountains learned to glow.', fog: 0xb4cce8, fogNear: 55, fogFar: 160, mob: ['golem', 'wisp'], night: ['golem', 'wisp'] },
  { name: 'Ashlands', lore: 'The Ashen Legion still holds the wall. No one remembers against what.', fog: 0x5a4440, fogNear: 25, fogFar: 95, mob: ['elemental', 'imp'], night: ['elemental', 'imp'] },
];

// ---------------------------------------------------------------- noise / rng
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let SEED = 1, rng = makeRng(1);
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(SEED, 1442695041);
  h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash3(x0, s, z0), b = hash3(x0 + 1, s, z0), c = hash3(x0, s, z0 + 1), d = hash3(x0 + 1, s, z0 + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s, o) {
  o = o || 4; let a = 0.5, f = 1, r = 0, n = 0;
  for (let i = 0; i < o; i++) { r += a * vnoise(x * f, z * f, s + i * 31); n += a; a *= 0.5; f *= 2; }
  return r / n;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- terrain
const ANCH = [[128, 128, 0], [90, 160, 0], [165, 105, 0], [50, 55, 1], [40, 125, 1], [88, 92, 1], [55, 205, 2], [118, 220, 2], [210, 50, 3], [222, 128, 3], [125, 32, 4], [172, 22, 4], [205, 210, 5], [168, 235, 5]];

// Beyond the hand-placed realm (0..255), extra biome anchors sit on a jittered 80-block grid.
const CELL = 80;
function outerAnchor(i, j) {
  const cx = i * CELL + CELL / 2, cz = j * CELL + CELL / 2;
  if (cx > -40 && cx < 296 && cz > -40 && cz < 296) return null;
  return [cx + (hash3(i, 901, j) - 0.5) * 50, cz + (hash3(i, 902, j) - 0.5) * 50, Math.floor(hash3(i, 903, j) * 6)];
}
const _dts = new Float32Array(6);
function columnGen(x, z) { // -> [height, biome]
  const dts = _dts; dts.fill(1e9);
  for (let i = 0; i < ANCH.length; i++) {
    const a = ANCH[i];
    const pert = (fbm(x / 34 + i * 13.7, z / 34, 40 + i) - 0.5) * 60;
    const d = Math.hypot(x - a[0], z - a[1]) + pert;
    if (d < dts[a[2]]) dts[a[2]] = d;
  }
  const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const a = outerAnchor(ci + di, cj + dj); if (!a) continue;
    const pert = (fbm(x / 34 + (ci + di) * 7.1, z / 34 + (cj + dj) * 3.3, 60) - 0.5) * 60;
    const d = Math.hypot(x - a[0], z - a[1]) + pert;
    if (d < dts[a[2]]) dts[a[2]] = d;
  }
  let bi = 0, dmin = dts[0];
  for (let t = 1; t < 6; t++) if (dts[t] < dmin) { dmin = dts[t]; bi = t; }
  const e = fbm(x / 70, z / 70, 3), dt = fbm(x / 24, z / 24, 11), ridge = 1 - Math.abs(fbm(x / 45, z / 45, 19) * 2 - 1);
  const hs = [
    24 + (e - 0.5) * 10,
    27 + (e - 0.5) * 18 + (fbm(x / 20, z / 20, 7) - 0.5) * 5,
    21.6 + (fbm(x / 16, z / 16, 23) - 0.5) * 5,
    25 + (dt - 0.5) * 12,
    34 + ridge * 22 + (e - 0.5) * 10,
    25 + (fbm(x / 30, z / 30, 13) - 0.5) * 10,
  ];
  const pool = fbm(x / 14, z / 14, 17);
  if (pool > 0.6) hs[5] -= (pool - 0.6) * 70;
  const lake = fbm(x / 36, z / 36, 5);
  if (lake > 0.63) hs[0] -= (lake - 0.63) * 80;
  let sw = 0, sh = 0;
  for (let t = 0; t < 6; t++) { const w = Math.exp(-(dts[t] - dmin) / 10); sw += w; sh += w * hs[t]; }
  let h = sh / sw;
  const rv = Math.abs(fbm(x / 95, z / 95, 61) - 0.5);
  if ((bi === 0 || bi === 1) && rv < 0.024) h = lerp(SEA - 2.5, h, clamp(rv / 0.024, 0, 1) ** 2);
  return [Math.round(clamp(h, 4, H - 6)), bi];
}
function topFor(h, b) {
  let top;
  switch (b) {
    case 0: top = h <= SEA + 1 ? B.SAND : B.GRASS; break;
    case 1: top = h <= SEA ? B.GRAVEL : B.GRASS; break;
    case 2: top = h < SEA ? B.MUD : B.SWAMPGRASS; break;
    case 3: top = B.SAND; break;
    case 4: top = h >= 50 ? B.SNOW : h >= 40 ? B.STONE : B.GRASS; break;
    default: top = B.ASH;
  }
  if (h < SEA && b !== 2 && b !== 5) top = B.SAND;
  return top;
}
function fillColumn(x, z, h, b) {
  let sub;
  switch (b) {
    case 0: sub = h <= SEA + 1 ? B.SAND : B.DIRT; break;
    case 1: sub = B.DIRT; break;
    case 2: sub = B.MUD; break;
    case 3: sub = B.SANDSTONE; break;
    case 4: sub = h >= 40 ? B.STONE : B.DIRT; break;
    default: sub = B.BASALT;
  }
  if (h < SEA && b !== 2 && b !== 5) sub = B.SAND;
  const top = topFor(h, b), base = (x & 255) + (z & 255) * W, WD = W * D;
  for (let y = 0; y < H; y++) {
    let id = 0;
    if (y === 0) id = B.BEDROCK;
    else if (y === h) id = top;
    else if (y < h && y >= h - 3) id = sub;
    else if (y < h) {
      id = b === 5 ? B.BASALT : B.STONE;
      const r = hash3(x, y, z);
      if (r < 0.012 && y < 44) id = B.COAL_ORE;
      else if (r < 0.020 && y < 34) id = B.IRON_ORE;
      else if (r < 0.023 && y < 18) id = B.GOLD_ORE;
      else if (r < 0.0258 && y < 24) id = B.LAPIS_ORE;
      else if (b === 4 && r > 0.994) id = B.CRYSTAL;
    } else if (b === 5 ? y <= 21 : y <= SEA) id = b === 5 ? B.LAVA : B.WATER;
    wb[base + y * WD] = id; wm[base + y * WD] = 0;
  }
  hmap[base] = h; bmap[base] = b;
}
function claimSlot(cx, cz) { const s = slotOf(cx, cz); slotCX[s] = cx; slotCZ[s] = cz; return s; }
function genTerrain() { // the starting realm: absolute chunks 0..15 x 0..15
  slotCX.fill(SLOT_EMPTY); slotCZ.fill(SLOT_EMPTY);
  for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) claimSlot(cx, cz);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { const [h, b] = columnGen(x, z); fillColumn(x, z, h, b); }
}

// ---------------------------------------------------------------- trees and plants
function tree(x, y, z, kind) {
  if (kind === 'oak') {
    const th = 4 + Math.floor(hash3(x, 1, z) * 3);
    for (let i = 1; i <= th; i++) setB(x, y + i, z, B.LOG);
    blob(x, y + th, z, 2.6, B.LEAVES);
  } else if (kind === 'blossom') {
    const th = 4 + Math.floor(hash3(x, 2, z) * 2);
    for (let i = 1; i <= th; i++) setB(x, y + i, z, B.LOG);
    blob(x, y + th, z, 2.4, B.LEAVES_BLOSSOM);
  } else if (kind === 'giant') {
    const th = 11 + Math.floor(hash3(x, 3, z) * 5);
    for (let i = -1; i <= th; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setB(x + dx, y + i, z + dz, B.LOG);
    for (const [dx, dz] of [[-1, 0], [2, 1], [0, -1], [1, 2]]) { setB(x + dx, y + 1, z + dz, B.LOG); if (hash3(x + dx, 4, z) < 0.5) setB(x + dx, y + 2, z + dz, B.LOG); }
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + hash3(x, k, z); const bx = Math.round(x + 0.5 + Math.cos(a) * 4), bz = Math.round(z + 0.5 + Math.sin(a) * 4), by = y + th - 3 + k % 2; line(x, y + th - 5, z, bx, by, bz, B.LOG); blob(bx, by + 1, bz, 2.8, B.LEAVES); }
    blob(x, y + th + 1, z, 4.6, B.LEAVES);
  } else if (kind === 'gnarled') {
    const th = 5 + Math.floor(hash3(x, 5, z) * 4);
    let cx = x, cz = z;
    for (let i = 1; i <= th; i++) { setB(cx, y + i, cz, B.DARKLOG); if (i > 2 && hash3(cx, i, cz) < 0.3) { cx += Math.round(hash3(cx, i, 9) * 2 - 1); setB(cx, y + i, cz, B.DARKLOG); } }
    blob(cx, y + th, cz, 3.2, B.LEAVES_DARK);
    for (let k = 0; k < 10; k++) { const vx = cx + Math.round((hash3(k, x, z) - 0.5) * 6), vz = cz + Math.round((hash3(z, k, x) - 0.5) * 6); let vy = y + th - 1; while (getB(vx, vy, vz) === B.LEAVES_DARK) vy--; const len = 2 + Math.floor(hash3(vx, k, vz) * 4); for (let i = 0; i < len && getB(vx, vy - i, vz) === 0; i++) setB(vx, vy - i, vz, B.VINES); }
  } else if (kind === 'pine') {
    const th = 7 + Math.floor(hash3(x, 6, z) * 4);
    for (let i = 1; i <= th; i++) setB(x, y + i, z, B.DARKLOG);
    for (let i = 3; i <= th + 1; i++) { const r = Math.max(0, Math.floor((th + 1 - i) / 2.2)); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (Math.abs(dx) + Math.abs(dz) <= r + (i % 2) && getB(x + dx, y + i, z + dz) === 0) setB(x + dx, y + i, z + dz, B.LEAVES_DARK); }
    setB(x, y + th + 2, z, B.LEAVES_DARK);
  } else if (kind === 'dead') {
    const th = 3 + Math.floor(hash3(x, 7, z) * 4);
    for (let i = 1; i <= th; i++) setB(x, y + i, z, B.DARKLOG);
    setB(x + 1, y + th - 1, z, B.DARKLOG); setB(x - 1, y + th - 2, z, B.DARKLOG);
  }
}
function blob(cx, cy, cz, r, id) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy * 1.6 + dz * dz) + hash3(cx + dx, cy + dy, cz + dz) * 0.8;
    if (d <= r && getB(cx + dx, cy + dy, cz + dz) === 0) setB(cx + dx, cy + dy, cz + dz, id);
  }
}
function line(x0, y0, z0, x1, y1, z1, id) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= n; i++) setB(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), Math.round(z0 + (z1 - z0) * i / n), id);
}
function plantColumn(x, z, h, b) {
  const top = topFor(h, b), r = hash3(x, 77, z), r2 = hash3(x, 78, z);
  const liquidAbove = b === 5 ? h < 21 : h < SEA;
  if (liquidAbove) { if (b === 2 && h === SEA - 1 && r < 0.07) setB(x, h + 2, z, B.LILYPAD); return; }
  if (b === 0 && top === B.GRASS) {
    if (r < 0.004) tree(x, h, z, r2 < 0.25 ? 'blossom' : 'oak');
    else if (r < 0.007) setB(x, h + 1, z, B.BERRYBUSH);
    else if (r < 0.05) setB(x, h + 1, z, [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE][Math.floor(r2 * 3)]);
    else if (r < 0.2) setB(x, h + 1, z, B.TALLGRASS);
  } else if (b === 1 && top === B.GRASS) {
    if (r < 0.0025 && (x & 1) === 0 && (z & 1) === 0) tree(x, h, z, 'giant');
    else if (r < 0.03) tree(x, h, z, 'oak');
    else if (r < 0.04) setB(x, h + 1, z, B.MUSHROOM);
    else if (r < 0.06) setB(x, h + 1, z, r2 < 0.5 ? B.FLOWER_BLUE : B.BERRYBUSH);
    else if (r < 0.3) setB(x, h + 1, z, B.TALLGRASS);
  } else if (b === 2 && top === B.SWAMPGRASS) {
    if (r < 0.014) tree(x, h, z, 'gnarled');
    else if (r < 0.03) setB(x, h + 1, z, B.GLOWSHROOM);
    else if (r < 0.04) setB(x, h + 1, z, B.MUSHROOM);
    else if (r < 0.25) setB(x, h + 1, z, B.TALLGRASS);
  } else if (b === 3 && top === B.SAND) {
    if (r < 0.004) { const ch = 1 + Math.floor(r2 * 3); for (let i = 1; i <= ch; i++) setB(x, h + i, z, B.CACTUS); }
    else if (r < 0.014) setB(x, h + 1, z, B.DEADBUSH);
  } else if (b === 4) {
    if (top === B.GRASS && r < 0.008) tree(x, h, z, 'pine');
    else if (r < 0.012) setB(x, h + 1, z, B.CRYSTAL_CLUSTER);
    else if (r > 0.997) { const ch = 2 + Math.floor(r2 * 4); for (let i = 1; i <= ch; i++) setB(x, h + i, z, B.CRYSTAL); setB(x + 1, h + 1, z, B.CRYSTAL); setB(x, h + 1, z + 1, B.CRYSTAL_ROSE); }
    else if (top === B.GRASS && r < 0.1) setB(x, h + 1, z, B.TALLGRASS);
  } else if (b === 5 && top === B.ASH) {
    if (r < 0.012) tree(x, h, z, 'dead');
    else if (r < 0.016) setB(x, h + 1, z, B.FIRE);
    else if (r < 0.04) setB(x, h + 1, z, B.DEADTREE);
    else if (r > 0.998) { for (let i = 0; i < 3; i++) setB(x, h - i, z, B.STARSTONE); }
  }
}
function genPlants() {
  for (let z = 3; z < D - 3; z++) for (let x = 3; x < W - 3; x++) { const c = COL(x, z); plantColumn(x, z, hmap[c], bmap[c]); }
}
// generate one wilderness chunk (outside the realm) into its ring slot
function genChunk(cx, cz) { genChunkPart(cx, cz, 0); genChunkPart(cx, cz, 1); genChunkPart(cx, cz, 2); }
// generation in three slices (two halves of terrain, then plants) so streaming can spread it over frames
function genChunkPart(cx, cz, part) {
  const x0 = cx * CS, z0 = cz * CS;
  if (part < 2) { if (part === 0) claimSlot(cx, cz); for (let z = z0 + part * 8; z < z0 + part * 8 + 8; z++) for (let x = x0; x < x0 + CS; x++) { const [h, b] = columnGen(x, z); fillColumn(x, z, h, b); } return; }
  // plants: run the columns around the chunk too so trees that straddle the border are complete; writes are clipped
  CLIP = [x0, x0 + CS - 1, z0, z0 + CS - 1];
  for (let z = z0 - 5; z < z0 + CS + 5; z++) for (let x = x0 - 5; x < x0 + CS + 5; x++) {
    const inside = x >= x0 && x < x0 + CS && z >= z0 && z < z0 + CS;
    if (!inside && hash3(x, 77, z) > 0.03) continue; // only trees reach across borders (check before the costly column maths)
    const [h, b] = inside ? [hmap[COL(x, z)], bmap[COL(x, z)]] : columnGen(x, z);
    plantColumn(x, z, h, b);
  }
  CLIP = null;
}

function surfaceY(x, z) {
  for (let y = H - 1; y > 0; y--) { const b = getB(x, y, z); if (SOLID[b] && !BLK[b].cutLike && b !== B.LOG && b !== B.DARKLOG) return y; if (b === B.WATER || b === B.LAVA) return y; }
  return 0;
}
function groundY(x, z) { // highest solid block (for spawning), ignores liquids
  for (let y = H - 1; y > 0; y--) if (SOLID[getB(x, y, z)]) return y;
  return 0;
}

// ---------------------------------------------------------------- lighting
const lightQ = new Int32Array(VOL);
let LB = null; // absolute bounds of the current light job
function propagate(light, qn) {
  let head = 0;
  const WD = W * D, bx0 = LB[0], bx1 = LB[1], bz0 = LB[2], bz1 = LB[3];
  while (head < qn) {
    const i = lightQ[head++];
    const l = light[i];
    if (l <= 1) continue;
    const sx = i & 255, sz = (i >> 8) & 255, y = (i / WD) | 0;
    const x = bx0 + ((sx - bx0) & 255), z = bz0 + ((sz - bz0) & 255); // back to absolute
    for (let k = 0; k < 6; k++) {
      let nx = x, ny = y, nz = z;
      if (k === 0) nx++; else if (k === 1) nx--; else if (k === 2) ny++; else if (k === 3) ny--; else if (k === 4) nz++; else nz--;
      if (ny < 0 || ny >= H || nx < bx0 || nx > bx1 || nz < bz0 || nz > bz1) continue;
      const j = (nx & 255) + (nz & 255) * W + ny * WD;
      const c = LIGHTCOST[wb[j]];
      if (c >= 15) continue;
      const nl = l - c;
      if (nl > light[j]) { light[j] = nl; if (qn < VOL) lightQ[qn++] = j; }
    }
  }
}
function skyColumn(x, z) {
  let l = 15;
  for (let y = H - 1; y >= 0; y--) {
    const i = IDX(x, y, z), id = wb[i];
    if (OPAQUE[id]) l = 0;
    else if (id !== 0 && LIGHTCOST[id] > 1) l = Math.max(0, l - LIGHTCOST[id]);
    wsky[i] = l;
  }
}
// recompute light for the absolute box [x0..x1]x[z0..z1]; light from resident neighbours just outside seeds it
function computeLight(x0, x1, z0, z1) {
  if (x0 === undefined) { x0 = 0; x1 = W - 1; z0 = 0; z1 = D - 1; }
  LB = [x0, x1, z0, z1];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!resident(x, z)) continue;
    skyColumn(x, z);
    for (let y = 0; y < H; y++) { const i = IDX(x, y, z); wbl[i] = LIGHTEMIT[wb[i]]; }
  }
  for (const [light, isSky] of [[wsky, true], [wbl, false]]) {
    let qn = 0;
    for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (!resident(x, z)) continue;
      const edge = x < x0 || x > x1 || z < z0 || z > z1;
      for (let y = 0; y < H; y++) {
        const i = IDX(x, y, z), l = light[i];
        if (l < 2) continue;
        if (isSky && !edge && l === 15) {
          let need = false;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = IDX(x + dx, y, z + dz); if (wsky[j] < 14 && !OPAQUE[wb[j]]) { need = true; break; } }
          if (!need) continue;
        }
        lightQ[qn++] = i;
      }
    }
    LB = [x0 - 1, x1 + 1, z0 - 1, z1 + 1]; // seeds may sit one block outside
    propagate(light, qn);
    LB = [x0, x1, z0, z1];
  }
}

// ---------------------------------------------------------------- queries
function solidAt(x, y, z) {
  if (y < 0) return true;
  if (y >= H) return false;
  if (!resident(x, z)) return true; // unloaded ground is treated as solid so nothing falls through
  return SOLID[wb[(x & 255) + (z & 255) * W + y * W * D]] === 1;
}
function collides(px, py, pz, hw, h) {
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw), y0 = Math.floor(py), y1 = Math.floor(py + h - 0.001), z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!solidAt(x, y, z)) continue;
    const id = y >= 0 && y < H && resident(x, z) ? wb[IDX(x, y, z)] : 0, sh = SHAPE[id], boxes = sh ? SHAPE_BOXES[sh][wm[IDX(x, y, z)] & 7] : COLBOX[id];
    if (!boxes) return true;
    // stairs, slabs and low blocks (chests, tables): test the body against each box of the shape
    for (const b of boxes) if (px + hw > x + b[0] + 1e-4 && px - hw < x + b[3] - 1e-4 && py + h > y + b[1] + 1e-4 && py < y + b[4] - 1e-4 && pz + hw > z + b[2] + 1e-4 && pz - hw < z + b[5] - 1e-4) return true;
  }
  return false;
}
// the highest solid surface under a body's footprint between its old and new feet height (null if none)
function landingTop(px, oldY, ny, pz, hw) {
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw), z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
  let best = null;
  for (let y = Math.floor(ny); y <= Math.floor(oldY); y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!solidAt(x, y, z)) continue;
    const id = y >= 0 && y < H && resident(x, z) ? wb[IDX(x, y, z)] : 0, sh = SHAPE[id], boxes = sh ? SHAPE_BOXES[sh][wm[IDX(x, y, z)] & 7] : COLBOX[id];
    if (!boxes) { if (y + 1 <= oldY + 1e-6 && (best === null || y + 1 > best)) best = y + 1; continue; }
    for (const bx of boxes) {
      if (!(px + hw > x + bx[0] && px - hw < x + bx[3] && pz + hw > z + bx[2] && pz - hw < z + bx[5])) continue;
      const t = y + bx[4]; if (t <= oldY + 1e-6 && (best === null || t > best)) best = t;
    }
  }
  return best;
}
// the smallest lift (up to `max`) that frees a body: used to walk up stairs and slabs and to land on them
function freeLift(px, py, pz, hw, h, max) { for (let d = 0.0625; d <= max + 1e-6; d += 0.0625) if (!collides(px, py + d, pz, hw, h)) return d; return -1; }
function touching(px, py, pz, hw, h, table) {
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw), y0 = Math.floor(py), y1 = Math.floor(py + h - 0.001), z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
  let best = 0;
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const v = table[getB(x, y, z)]; if (v > best) best = v; }
  return best;
}
function moveBody(b, dt) {
  b.hitX = b.hitZ = false; b.onGround = false;
  const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz)) * dt / 0.4) || 1;
  const sdt = dt / steps;
  const grounded = !!b.wasGround;
  for (let s = 0; s < steps; s++) {
    // walking into a slab or a stair step lifts you onto it (step height 0.6, like the classic game)
    const nx = b.x + b.vx * sdt;
    if (!collides(nx, b.y, b.z, b.hw, b.h)) b.x = nx;
    else { const up = grounded && b.vy <= 0.01 ? freeLift(nx, b.y, b.z, b.hw, b.h, 0.6) : -1; if (up > 0) { b.x = nx; b.y += up; b.stepUp = (b.stepUp || 0) + up; } else { b.vx = 0; b.hitX = true; } }
    const nz = b.z + b.vz * sdt;
    if (!collides(b.x, b.y, nz, b.hw, b.h)) b.z = nz;
    else { const up = grounded && b.vy <= 0.01 ? freeLift(b.x, b.y, nz, b.hw, b.h, 0.6) : -1; if (up > 0) { b.z = nz; b.y += up; b.stepUp = (b.stepUp || 0) + up; } else { b.vz = 0; b.hitZ = true; } }
    const ny = b.y + b.vy * sdt;
    if (!collides(b.x, ny, b.z, b.hw, b.h)) b.y = ny;
    else {
      // landing: rest exactly on the highest surface under the feet (a block top, a slab or a stair step)
      if (b.vy < 0) { b.onGround = true; const top = landingTop(b.x, b.y, ny, b.z, b.hw); if (top !== null && !collides(b.x, top, b.z, b.hw, b.h)) b.y = top; else { const up = freeLift(b.x, ny, b.z, b.hw, b.h, 1); if (up >= 0) b.y = ny + up; } }
      b.vy = 0;
    }
  }
  b.wasGround = b.onGround;
}
function lightAt(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (!inWorld(x, y, z)) return [15, 0];
  const i = IDX(x, y, z);
  return [wsky[i], wbl[i]];
}
function raycastBlocks(ox, oy, oz, dx, dy, dz, max, accept) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
  let ty = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
  let tz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
  let px = x, py = y, pz = z, t = 0, face = -1;
  for (let i = 0; i < 200; i++) {
    const id = getB(x, y, z);
    if (accept(id)) return { x, y, z, px, py, pz, t, id, face };
    px = x; py = y; pz = z;
    if (tx < ty && tx < tz) { t = tx; x += sx; tx += tdx; face = sx > 0 ? 1 : 0; }
    else if (ty < tz) { t = ty; y += sy; ty += tdy; face = sy > 0 ? 3 : 2; }
    else { t = tz; z += sz; tz += tdz; face = sz > 0 ? 5 : 4; }
    if (t > max) break;
  }
  return null;
}
