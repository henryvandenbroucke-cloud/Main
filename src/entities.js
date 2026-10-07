'use strict';
/* Creatures (original designs), bosses, projectiles, item drops, windmills. */
const Mobs = [];
const Projectiles = [];
const Drops = [];
let ActiveBoss = null;

// ---------------------------------------------------------------- skins
const SKIN_CACHE = {};
function skin(key, base, o) {
  if (SKIN_CACHE[key]) return SKIN_CACHE[key];
  o = o || {};
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'), img = g.createImageData(16, 16);
  const col = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const b = col(base), acc = o.accent !== undefined ? col(o.accent) : null;
  let s = key.length * 977 + 13;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const put = (x, y, cc, a) => { const i = (x + y * 16) * 4; img.data[i] = cc[0]; img.data[i + 1] = cc[1]; img.data[i + 2] = cc[2]; img.data[i + 3] = a === undefined ? 255 : a; };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const f = (1 + (r() - 0.5) * (o.noise === undefined ? 0.12 : o.noise)) * (o.flat ? 1 : 1.06 - y / 15 * 0.14);
    let cc = [b[0] * f, b[1] * f, b[2] * f];
    if (acc && o.spots && ((Math.floor(x / 2) * 7 + Math.floor(y / 2) * 13 + key.length) % 23) / 23 < o.spots) cc = acc;
    if (acc && o.dapples && y < 9 && (x * 5 + y * 11) % 17 === 0) { cc = acc; }
    if (acc && o.stripes && (y % 5 === 0)) cc = acc;
    if (acc && o.cracks && r() < 0.06) cc = acc;
    if (acc && o.belly && y > 11) cc = acc;
    if (acc && o.plates && (x % 8 === 0 || y % 8 === 0)) cc = acc;
    put(x, y, cc.map(v => Math.max(0, Math.min(255, v))));
  }
  if (o.edge !== false) for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [i, 15], [0, i], [15, i]]) { const k = (x + y * 16) * 4; img.data[k] *= 0.8; img.data[k + 1] *= 0.8; img.data[k + 2] *= 0.8; }
  if (o.dapples) for (let y = 1; y < 9; y++) for (let x = 1; x < 15; x++) if ((x * 5 + y * 11) % 17 === 0) { put(x + 1, y, col(o.accent)); put(x, y + 1, col(o.accent)); }
  if (o.eyes) for (const [x, y, w, h, e] of o.eyes) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, col(e));
  if (o.mouth) for (const [x, y, w, h, e] of o.mouth) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, col(e));
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  SKIN_CACHE[key] = t;
  return t;
}
function M(tex, emissive, extra) { const m = emissive ? new THREE.MeshBasicMaterial(Object.assign({ map: tex }, extra || {})) : new THREE.MeshLambertMaterial(Object.assign({ map: tex }, extra || {})); m.userData.emissive = !!emissive; return m; }
// creature lighting: sky + sun, driven from the same values as the world shader
const mobHemi = new THREE.HemisphereLight(0xbcd0ff, 0x4a3a2a, 0.6); scene.add(mobHemi);
const mobSun = new THREE.DirectionalLight(0xfff0dd, 0.8); mobSun.position.set(0, 1, 0); scene.add(mobSun);
function updateMobLights() {
  mobSun.position.copy(U.uSunDir.value); mobSun.color.copy(U.uSunCol.value); mobSun.intensity = 0.95;
  mobHemi.color.copy(U.uAmbCol.value).multiplyScalar(1.7); mobHemi.groundColor.copy(U.uAmbCol.value).multiplyScalar(0.55); mobHemi.intensity = 1;
}
const BOXES = {};
function boxGeo(w, h, d) { const k = w + ',' + h + ',' + d; return BOXES[k] || (BOXES[k] = new THREE.BoxGeometry(w, h, d)); }
function box(parent, w, h, d, x, y, z, mat) { const m = new THREE.Mesh(boxGeo(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function limb(parent, w, h, d, x, y, z, mat, down) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); box(g, w, h, d, 0, down === false ? h / 2 : -h / 2, 0, mat); return g; }
function faceMats(side, front) { return [side, side, side, side, front, side]; }

// ---------------------------------------------------------------- creature definitions
// flags: passive (never starts a fight), neutral (fights back), dayNeutral (only hostile in the dark), undead (burns in sunlight),
// fly / swim / hop / climb movement, ranged projectile, explode, voice for the ambient sound, chip = hit particle colour
const MOBDEF = {
  cow: { hp: 10, speed: 1.4, flee: 3.6, passive: true, h: 1.4, hw: 0.45, drops: [[I.beef, 1, 3, 1], [I.leather, 0, 2, 0.8]], name: 'Cow', voice: 'moo', variants: 3, food: I.wheat, breed: true },
  pig: { hp: 10, speed: 1.6, flee: 4, passive: true, h: 0.9, hw: 0.42, drops: [[I.pork, 1, 3, 1]], name: 'Pig', voice: 'oink', food: I.globerry, breed: true },
  sheep: { hp: 8, speed: 1.5, flee: 3.8, passive: true, h: 1.3, hw: 0.42, drops: [[I.mutton, 1, 2, 1], [B.WOOL_WHITE, 1, 1, 1]], name: 'Sheep', voice: 'baa', variants: 8, food: I.wheat, breed: true },
  chicken: { hp: 4, speed: 1.6, flee: 3.6, passive: true, h: 0.7, hw: 0.22, drops: [[I.chicken, 1, 1, 1], [I.feather, 0, 2, 1]], name: 'Chicken', voice: 'cluck', food: I.wheat, breed: true, slowFall: true },
  rabbit: { hp: 3, speed: 2.6, flee: 5, passive: true, h: 0.5, hw: 0.2, hop: true, drops: [[I.rabbit, 0, 1, 1], [I.leather, 0, 1, 0.3]], name: 'Rabbit', voice: 'squeak', variants: 5, food: I.globerry, breed: true },
  horse: { hp: 22, speed: 2.4, flee: 6, passive: true, h: 1.8, hw: 0.55, drops: [[I.leather, 0, 2, 1]], name: 'Horse', voice: 'neigh', variants: 6, food: I.wheat, breed: true },
  camel: { hp: 26, speed: 1.5, flee: 3, passive: true, h: 2.3, hw: 0.6, drops: [[I.leather, 0, 2, 1]], name: 'Camel', voice: 'grumble', food: I.wheat, breed: true },
  goat: { hp: 10, speed: 1.9, flee: 4.5, passive: true, h: 1.3, hw: 0.4, drops: [[I.mutton, 0, 1, 0.7]], name: 'Mountain Goat', voice: 'bleat', food: I.wheat, breed: true },
  fox: { hp: 10, speed: 2.8, flee: 6, passive: true, h: 0.7, hw: 0.3, drops: [[I.globerry, 0, 1, 0.5]], name: 'Fox', voice: 'yip', variants: 4 },
  wolf: { hp: 16, dmg: 4, speed: 2.2, chase: 4.6, passive: true, neutral: true, pack: true, det: 16, h: 0.9, hw: 0.35, drops: [[I.bone, 0, 1, 0.3]], name: 'Wolf', voice: 'bark', tame: I.bone },
  cat: { hp: 10, speed: 2.2, flee: 4.5, passive: true, h: 0.55, hw: 0.24, drops: [], name: 'Cat', voice: 'meow', variants: 5, food: I.fish, breed: true },
  bear: { hp: 30, dmg: 6, speed: 1.8, chase: 3.8, passive: true, neutral: true, det: 14, h: 1.4, hw: 0.55, drops: [[I.leather, 1, 2, 1], [I.fish, 0, 1, 0.4]], name: 'Brown Bear', voice: 'growl' },
  frog: { hp: 6, speed: 1.6, flee: 3, passive: true, h: 0.3, hw: 0.2, hop: true, drops: [], name: 'Frog', voice: 'croak', variants: 3 },
  turtle: { hp: 30, speed: 0.6, flee: 0.9, passive: true, h: 0.45, hw: 0.45, drops: [], name: 'Sea Turtle', swimOk: true },
  bee: { hp: 8, dmg: 2, speed: 2.5, chase: 4, passive: true, neutral: true, pack: true, fly: true, det: 12, h: 0.5, hw: 0.2, drops: [[I.honey, 0, 1, 0.6]], name: 'Bumblebee', voice: 'buzz' },
  bat: { hp: 4, speed: 3, flee: 3, passive: true, fly: true, h: 0.5, hw: 0.2, drops: [], name: 'Bat', voice: 'squeak' },
  squid: { hp: 10, speed: 1.6, flee: 3, passive: true, swim: true, h: 1.1, hw: 0.4, drops: [[I.ink, 1, 2, 1]], name: 'Squid' },
  fish: { hp: 3, speed: 2.2, flee: 4, passive: true, swim: true, h: 0.4, hw: 0.2, drops: [[I.fish, 1, 1, 1]], name: 'Fish', variants: 3 },
  villager: { hp: 20, speed: 1.2, flee: 3, passive: true, h: 1.95, hw: 0.3, drops: [], name: 'Villager', voice: 'hmm', variants: 24, village: true },
  guardian: { hp: 90, dmg: 10, speed: 1.4, chase: 2.4, passive: true, neutral: true, det: 16, h: 2.7, hw: 0.7, kb: 14, heavy: true, drops: [[I.iron, 2, 4, 1], [B.FLOWER_RED, 0, 1, 0.5]], name: 'Hearth Guardian', village: true, chip: 0xbab6ae },
  zombie: { hp: 20, dmg: 3, speed: 2.1, det: 28, h: 1.95, hw: 0.3, undead: true, drops: [[I.flesh, 0, 2, 1], [I.iron, 0, 1, 0.05]], name: 'Zombie', voice: 'groan' },
  skeleton: { hp: 18, dmg: 3, speed: 2.4, det: 24, h: 1.95, hw: 0.3, undead: true, ranged: 'arrow', drops: [[I.bone, 0, 2, 1], [I.arrow, 0, 2, 1]], name: 'Skeleton', voice: 'rattle', chip: 0xd8d4c4 },
  spider: { hp: 16, dmg: 3, speed: 3.1, det: 18, h: 0.9, hw: 0.65, climb: true, dayNeutral: true, drops: [[I.silk, 0, 2, 1]], name: 'Spider', voice: 'hiss' },
  cave_spider: { hp: 12, dmg: 2, speed: 3.5, det: 16, h: 0.55, hw: 0.4, climb: true, poison: true, scale: 0.6, drops: [[I.silk, 0, 1, 1]], name: 'Cave Spider', voice: 'hiss' },
  boomshroom: { hp: 20, dmg: 0, speed: 2.0, det: 16, h: 1.65, hw: 0.4, explode: true, drops: [[I.spore, 0, 2, 1]], name: 'Boomshroom', chip: 0xc8302a },
  stalker: { hp: 40, dmg: 7, speed: 1.2, chase: 4.2, passive: true, neutral: true, stare: true, det: 32, h: 2.95, hw: 0.3, drops: [[I.pearl, 0, 1, 0.6]], name: 'Hollow Stalker', voice: 'warble' },
  witch: { hp: 26, dmg: 4, speed: 2.0, det: 18, h: 2.05, hw: 0.3, ranged: 'potion', drops: [[I.potion, 0, 1, 0.2], [I.globerry, 0, 2, 0.5], [I.stick, 0, 2, 0.5]], name: 'Hedge Witch', voice: 'cackle' },
  slime: { hp: 16, dmg: 3, speed: 1.8, det: 16, h: 1.5, hw: 0.75, hop: true, split: true, drops: [[I.slimeball, 0, 2, 1]], name: 'Mire Slime', voice: 'squish', chip: 0x6ac85a },
  magma_slime: { hp: 16, dmg: 4, speed: 1.8, det: 16, h: 1.5, hw: 0.75, hop: true, split: true, burn: true, drops: [[I.ember, 0, 1, 0.6]], name: 'Magma Slime', voice: 'squish', chip: 0xff7a2a },
  mite: { hp: 8, dmg: 1, speed: 2.6, det: 14, h: 0.3, hw: 0.3, drops: [], name: 'Stone Mite', chip: 0x8a8a8e },
  raider: { hp: 24, dmg: 4, speed: 2.5, det: 24, h: 1.95, hw: 0.3, ranged: 'arrow', drops: [[I.arrow, 0, 3, 1], [I.gold, 0, 2, 0.5], [I.bread, 0, 1, 0.3]], name: 'Raider', voice: 'hmm' },
  wraith: { hp: 20, dmg: 6, speed: 2, det: 40, fly: true, ranged: 'fire', h: 2.6, hw: 0.8, drops: [[I.ember, 0, 2, 1]], name: 'Ash Wraith', voice: 'wail', chip: 0xe8e4e0 },
  glider: { hp: 20, dmg: 4, speed: 5, det: 60, fly: true, swoop: true, h: 0.5, hw: 0.5, drops: [[I.leather, 0, 1, 0.5]], name: 'Dusk Glider', voice: 'screech' },
  // originals
  deer: { hp: 10, speed: 2.4, flee: 6.5, passive: true, h: 1.6, hw: 0.35, drops: [[I.venison, 1, 2, 1], [I.leather, 0, 1, 0.6]], name: 'Antlered Deer', voice: 'bleat', food: I.globerry, breed: true },
  boar: { hp: 14, dmg: 3, speed: 2.2, chase: 4, flee: 5, passive: true, neutral: true, det: 12, h: 1.0, hw: 0.4, drops: [[I.pork, 1, 2, 1], [I.leather, 1, 2, 0.8]], name: 'Bristleback Boar', voice: 'oink' },
  shade: { hp: 18, dmg: 4, speed: 3.2, det: 22, h: 2.3, hw: 0.3, drops: [[I.gold, 1, 2, 0.6], [I.arrow, 1, 4, 0.4], [I.journal, 1, 1, 0.08]], name: 'Shade', voice: 'wail', chip: 0x2a2236 },
  crawler: { hp: 14, dmg: 3, speed: 3.8, det: 18, h: 0.8, hw: 0.55, poison: true, drops: [[I.silk, 1, 2, 0.9]], name: 'Dune Crawler', voice: 'hiss' },
  golem: { hp: 42, dmg: 7, speed: 1.9, det: 14, h: 2.6, hw: 0.8, kb: 10, heavy: true, drops: [[I.shard, 2, 4, 1], [I.iron, 1, 2, 0.6]], name: 'Crystal Golem', chip: 0x56d2f0 },
  wisp: { hp: 14, dmg: 4, speed: 3.5, det: 24, h: 1.2, hw: 0.4, fly: true, ranged: 'bolt', drops: [[I.shard, 1, 2, 0.9]], name: 'Shard Wisp', chip: 0x9af0ff },
  elemental: { hp: 30, dmg: 6, speed: 3.0, det: 20, h: 2.2, hw: 0.4, burn: true, drops: [[I.ember, 1, 2, 0.9], [I.iron, 1, 1, 0.3]], name: 'Fire Elemental', chip: 0xff7a1a },
  imp: { hp: 12, dmg: 3, speed: 4.4, det: 20, h: 1.2, hw: 0.3, burn: true, drops: [[I.ember, 0, 1, 0.6], [I.gold, 1, 2, 0.5]], name: 'Magma Imp', voice: 'cackle' },
  knight: { hp: 28, dmg: 6, speed: 2.7, det: 16, h: 2.1, hw: 0.4, drops: [[I.iron, 1, 2, 0.7], [I.gold, 1, 3, 0.7]], name: 'Drowned Knight', voice: 'groan', chip: 0x8a9a88 },
  sentinel: { hp: 20, dmg: 4, speed: 2.2, det: 20, h: 1.6, hw: 0.45, fly: true, ranged: 'dart', drops: [[I.shard, 1, 2, 0.8], [I.gold, 1, 2, 0.5]], name: 'Rune Sentinel', chip: 0x8af0d0 },
  warden: { hp: 360, dmg: 11, speed: 2.3, det: 40, h: 4.6, hw: 1.1, boss: true, kb: 12, drops: [], name: 'The Mirewarden', chip: 0x6ef0d0 },
  colossus: { hp: 650, dmg: 12, speed: 1.6, det: 50, h: 8.0, hw: 2.0, boss: true, kb: 14, drops: [], name: 'The Sleeping Colossus', chip: 0x9a9eaa },
};

// spawn eggs for the creative inventory (one per creature, bosses excluded)
const EGG_COLORS = { cow: ['#f1eee6', '#1f1c1b'], pig: ['#eca7a1', '#d8877f'], sheep: ['#eeebe4', '#d2c2b2'], chicken: ['#f4f1ea', '#d83a30'], rabbit: ['#9a7a58', '#eeeeea'], horse: ['#8a4a22', '#2a1810'], camel: ['#c89a5a', '#8a6438'], goat: ['#e6e2d6', '#8a8070'], fox: ['#d66a28', '#f2ece2'], wolf: ['#9b968f', '#d2cdc4'], cat: ['#8a7a62', '#e8c040'], bear: ['#5a3a24', '#9a7a5a'], frog: ['#6a8a3a', '#e8e0b0'], turtle: ['#3e5a2a', '#d8d0a0'], bee: ['#f0c030', '#2a2018'], bat: ['#4a3a2c', '#2c221c'], squid: ['#2c3e6a', '#4a5e8a'], fish: ['#9a8a6a', '#f0a030'], villager: ['#8a6a3a', '#c8946e'], guardian: ['#bab6ae', '#5a8a3a'], zombie: ['#6f8f5a', '#3c6a84'], skeleton: ['#d8d4c4', '#2e2a26'], spider: ['#2e2622', '#ff3a28'], cave_spider: ['#1e3a3e', '#ff3a28'], boomshroom: ['#c8302a', '#f2ece0'], stalker: ['#2a2628', '#d8b0ff'], witch: ['#3e2e4e', '#9aaa82'], slime: ['#6ac85a', '#4a9a3a'], magma_slime: ['#3a1a14', '#ff7a2a'], mite: ['#8a8a8e', '#6a6a6e'], raider: ['#5a4636', '#4a4a52'], wraith: ['#eeeae6', '#ff9a3a'], glider: ['#4a5a7a', '#8affb0'], deer: ['#a9763f', '#ff8fd0'], boar: ['#5a4030', '#f0e8d8'], shade: ['#15131c', '#ffb030'], crawler: ['#b89a62', '#ffb040'], golem: ['#7a7c84', '#56d2f0'], wisp: ['#9af0ff', '#ffffff'], elemental: ['#2a2228', '#ff7a1a'], imp: ['#a8281a', '#ffe46a'], knight: ['#4a5a4a', '#5affd0'], sentinel: ['#6a6a74', '#8af0d0'] };
for (const t in MOBDEF) if (!MOBDEF[t].boss) regItem('egg_' + t, { name: MOBDEF[t].name + ' Spawn Egg', kind: 'egg', mob: t, paint: 'egg', c: EGG_COLORS[t] || ['#8a8a8a', '#4a4a4a'], desc: 'Right-click to spawn a ' + MOBDEF[t].name.toLowerCase() + '.' });
function spawnMob(type, x, y, z, extra) {
  const def = MOBDEF[type];
  const m = Object.assign({ type, def, x, y, z, vx: 0, vy: 0, vz: 0, hw: def.hw, h: def.h, hp: def.hp, maxHp: def.hp, yaw: Math.random() * 6.28, phase: Math.random() * 6, atk: 0, flash: 0, wt: 0, wx: 0, wz: 0, onGround: false, anger: 0, cd: 1 + Math.random() * 2, t: Math.random() * 10, walk: 0, voiceT: 4 + Math.random() * 14, variant: 0, scale: 1 }, extra || {});
  if (m.variant === undefined || (def.variants && !(extra && extra.variant !== undefined))) m.variant = def.variants ? Math.floor(Math.random() * def.variants) : 0;
  if (def.split) { m.size = m.size || 3; const S = [0, 0.5, 0.9, 1.5][m.size]; m.hw = S / 2; m.h = S; m.hp = m.maxHp = [0, 2, 6, 16][m.size]; m.dmgMul = m.size / 2; }
  if (type === 'skeleton' && m.variant === 3) { m.hp = m.maxHp = 26; m.ranged = null; } else m.ranged = def.ranged;
  const key = type + ':' + m.variant + (m.size ? ':' + m.size : '');
  m.g = buildCreature(key, m, CREATURES[type]);
  m.scale = (def.scale || 1) * (m.variant === 3 && type === 'skeleton' ? 1.05 : 1) * (m.baby ? 0.5 : 1);
  m.g.scale.setScalar(m.scale);
  if (def.scale) { m.hw = def.hw; m.h = def.h; }
  if (m.baby) { m.hw *= 0.5; m.h *= 0.5; m.hp = m.maxHp = Math.ceil(def.hp / 2); }
  m.g.position.set(x, y, z); m.g.rotation.y = m.yaw;
  m.g.traverse(o => o.layers.enable(1));
  scene.add(m.g); Mobs.push(m);
  return m;
}
function removeMob(m) { scene.remove(m.g); for (const mt of m.mats || []) mt.dispose(); const i = Mobs.indexOf(m); if (i >= 0) Mobs.splice(i, 1); if (m.spawn) { const k = m.spawn.alive.indexOf(m); if (k >= 0) m.spawn.alive.splice(k, 1); } }

// ---------------------------------------------------------------- drops
function dropItem(id, n, x, y, z) {
  const mesh = itemMesh(id); mesh.scale.setScalar(id < 256 ? 0.28 : 0.42);
  mesh.position.set(x, y, z); scene.add(mesh);
  Drops.push({ id, n, x, y, z, vx: (Math.random() - 0.5) * 3, vy: 4, vz: (Math.random() - 0.5) * 3, mesh, t: 0, hw: 0.12, h: 0.25 });
}
function roomFor(id) { const max = itemDef(id).stack; let n = 0; for (let i = 0; i < 36; i++) { const s = Inv.slots[i]; if (!s) n += max; else if (s.id === id && !s.ench) n += max - s.n; } return n; }
function updateDrops(dt, p) {
  for (let i = Drops.length - 1; i >= 0; i--) {
    const d = Drops[i]; d.t += dt;
    const dx = p.x - d.x, dy = (p.y + 0.8) - d.y, dz = p.z - d.z, dist = Math.hypot(dx, dy, dz);
    // only pull items in when there is room for them; otherwise they simply stay on the ground
    d.fitT = (d.fitT || 0) - dt; if (d.fitT <= 0) { d.fitT = 0.4; d.fits = roomFor(d.id) > 0; }
    if (!d.fits && d.t > 0.5 && dist < 1.4) toastOnce('invfull', 'Your inventory is full.');
    if (d.t > 0.5 && dist < 2.6 && d.fits) { d.vx += dx / dist * 40 * dt; d.vy += dy / dist * 40 * dt; d.vz += dz / dist * 40 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vx *= 0.9; d.vy *= 0.9; d.vz *= 0.9; }
    else { d.vy -= 18 * dt; d.vx *= 0.96; d.vz *= 0.96; moveBody(d, dt); }
    if (d.t > 0.5 && dist < 0.8 && d.fits) { const left = giveItem(d.id, d.n); if (left <= 0) { scene.remove(d.mesh); Drops.splice(i, 1); continue; } d.n = left; }
    if (d.t > 300) { scene.remove(d.mesh); Drops.splice(i, 1); continue; }
    d.mesh.position.set(d.x, d.y + 0.25 + Math.sin(d.t * 3) * 0.06, d.z); d.mesh.rotation.y = d.t * 1.5;
    const L = lightAt(d.x, d.y + 0.3, d.z), lv = Math.max(L[0] / 15 * U.uDay.value, L[1] / 15) * 0.85 + 0.15;
    d.mesh.material.color.setScalar(lv);
  }
}

// ---------------------------------------------------------------- projectiles
const PROJ_GEO = { arrow: null };
function projMesh(type) {
  if (type === 'arrow') { const m = itemMesh(I.arrow); m.scale.setScalar(0.6); return m; }
  if (type === 'pearl') { const m = itemMesh(I.pearl); m.scale.setScalar(0.45); return m; }
  if (type === 'potion') { const m = itemMesh(I.potion); m.scale.setScalar(0.5); return m; }
  const col = type === 'bolt' ? 0x9af0ff : type === 'dart' ? 0x8af0d0 : type === 'orb' ? 0x6ef0ff : type === 'wave' ? 0xc8f8ff : 0xff8a2a;
  const s = type === 'orb' ? 0.6 : type === 'wave' ? 1.6 : type === 'fire' ? 0.5 : 0.25;
  const m = new THREE.Mesh(boxGeo(s, type === 'wave' ? 0.5 : s, s), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
  return m;
}
const PROJ_FX = { bolt: [0.6, 0.95, 1], dart: [0.55, 0.95, 0.82], orb: [0.45, 0.95, 1], wave: [0.8, 0.97, 1], fire: [1, 0.55, 0.15], potion: [0.7, 0.35, 1], pearl: [0.75, 0.55, 1] };
function splash(p, P) { // witch potion
  burst(p.x, p.y, p.z, 30, { life: 0.9, size: 0.12, r: 0.65, g: 0.3, b: 0.95, glow: true, spread: 5, up: 3 });
  Sound.splash();
  if (Math.hypot(P.x - p.x, P.y + 1 - p.y, P.z - p.z) < 2.8) { hurtPlayer(p.dmg, null, 0, 0, { mob: p.src, how: 'potion' }); Player.poison = Math.max(Player.poison || 0, 4); Player.poisonSrc = { mob: p.src, how: 'potion' }; }
}
function shoot(type, x, y, z, vx, vy, vz, dmg, owner, o) {
  const mesh = projMesh(type); mesh.position.set(x, y, z); scene.add(mesh);
  Projectiles.push(Object.assign({ type, x, y, z, vx, vy, vz, dmg, owner, mesh, life: type === 'wave' ? 1.2 : 6, grav: type === 'arrow' ? 18 : type === 'potion' ? 14 : type === 'pearl' ? 16 : 0, hit: new Set() }, o || {}));
}
function updateProjectiles(dt, P) {
  for (let i = Projectiles.length - 1; i >= 0; i--) {
    const p = Projectiles[i];
    p.life -= dt;
    p.vy -= p.grav * dt;
    if (p.home && p.owner === 'mob') { const dx = P.x - p.x, dy = P.y + 1 - p.y, dz = P.z - p.z, d = Math.hypot(dx, dy, dz) || 1, sp = Math.hypot(p.vx, p.vy, p.vz); p.vx += (dx / d * sp - p.vx) * dt * p.home; p.vy += (dy / d * sp - p.vy) * dt * p.home; p.vz += (dz / d * sp - p.vz) * dt * p.home; }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    let dead = p.life <= 0;
    if (!dead && p.type !== 'wave' && solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
      dead = true;
      if (p.type === 'arrow' && p.owner === 'player' && !p.infinite && Math.random() < 0.6) dropItem(I.arrow, 1, p.x, p.y, p.z);
      if (p.type === 'potion') splash(p, P);
      if (p.type === 'pearl') pearlLand(p, P);
    }
    p.x = nx; p.y = ny; p.z = nz;
    if (!dead && p.owner === 'player') {
      for (const m of Mobs) {
        if (p.hit.has(m)) continue;
        const r = p.type === 'wave' ? 1.6 : 0.3;
        if (m.dead) continue;
        if (Math.abs(p.x - m.x) < m.hw + r && Math.abs(p.z - m.z) < m.hw + r && p.y > m.y - 0.2 && p.y < m.y + m.h * m.scale + 0.2) {
          const sp = Math.hypot(p.vx, p.vy, p.vz);
          if (p.type === 'pearl') { pearlLand(p, P); dead = true; break; }
          damageMob(m, p.type === 'arrow' ? p.dmg * Math.min(1.4, sp / 30) : p.dmg, p.vx / sp, p.vz / sp, p.crit, p.type);
          if (p.type === 'arrow') { Game.lastHit = m; Game.lastHitT = performance.now(); if (p.flame) m.onFire = 5; }
          p.hit.add(m);
          if (p.type !== 'wave') { dead = true; break; }
        }
      }
    } else if (!dead && p.owner === 'mob') {
      if (Math.abs(p.x - P.x) < 0.5 && Math.abs(p.z - P.z) < 0.5 && p.y > P.y && p.y < P.y + 1.9) { if (p.type === 'potion') splash(p, P); else hurtPlayer(p.dmg, p.type === 'fire' ? 'burn' : null, p.vx * 0.3, p.vz * 0.3, { mob: p.src, how: p.type }); dead = true; }
    }
    const fx = PROJ_FX[p.type];
    if (fx) emit(p.x, p.y, p.z, { life: 0.3, size: p.type === 'wave' ? 0.3 : p.type === 'fire' ? 0.22 : 0.12, r: fx[0], g: fx[1], b: fx[2], glow: true, vy: 0.2 });
    if (dead) { scene.remove(p.mesh); Projectiles.splice(i, 1); if (fx) burst(p.x, p.y, p.z, 8, { life: 0.4, size: 0.1, r: fx[0], g: fx[1], b: fx[2], glow: true, spread: 4 }); continue; }
    p.mesh.position.set(p.x, p.y, p.z);
    if (p.type === 'arrow') { p.mesh.rotation.y = Math.atan2(p.vx, p.vz) - Math.PI / 2; p.mesh.rotation.z = Math.atan2(p.vy, Math.hypot(p.vx, p.vz)) - Math.PI / 4; }
    else { p.mesh.rotation.x += dt * 5; p.mesh.rotation.y += dt * 7; if (p.type === 'wave') p.mesh.rotation.set(0, Math.atan2(p.vx, p.vz), 0); }
  }
}

function pearlLand(p, P) {
  if (p.landed) return; p.landed = true;
  burst(P.x, P.y + 1, P.z, 20, { life: 0.8, size: 0.09, r: 0.75, g: 0.55, b: 1, glow: true, spread: 2, up: 2 });
  let x = p.x - p.vx * 0.02, y = p.y, z = p.z - p.vz * 0.02;
  while (y < H - 2 && collides(x, y, z, P.hw, P.h)) y += 0.5;
  P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0;
  hurtPlayer(2, null, 0, 0, 'pearl'); Sound.teleport(0);
  burst(P.x, P.y + 1, P.z, 24, { life: 0.8, size: 0.09, r: 0.75, g: 0.55, b: 1, glow: true, spread: 2, up: 2 });
}
// ---------------------------------------------------------------- lightning (visual)
const bolts = [];
function lightning(a, b) {
  const pts = []; const n = 8;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector3(lerp(a[0], b[0], t) + (i && i < n ? (Math.random() - 0.5) * 0.8 : 0), lerp(a[1], b[1], t) + (i && i < n ? (Math.random() - 0.5) * 0.8 : 0), lerp(a[2], b[2], t) + (i && i < n ? (Math.random() - 0.5) * 0.8 : 0))); }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true }));
  scene.add(line); bolts.push({ line, life: 0.25 });
  for (const p of pts) emit(p.x, p.y, p.z, { life: 0.3, size: 0.12, r: 0.75, g: 0.9, b: 1, glow: true });
}
function updateBolts(dt) { for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.life -= dt; b.line.material.opacity = b.life * 4; if (b.life <= 0) { scene.remove(b.line); b.line.geometry.dispose(); bolts.splice(i, 1); } } }

// ---------------------------------------------------------------- combat
function damageMob(m, dmg, kx, kz, crit, src) {
  if (m.dead) return;
  if (m.shield) { burst(m.x, m.y + m.h * 0.6, m.z, 10, { life: 0.4, size: 0.15, r: 0.5, g: 0.9, b: 1, glow: true, spread: 6 }); damageNumber(m.x, m.y + m.h + 0.3, m.z, 0, false); toastOnce('shield', 'The Colossus is shielded - destroy the energy pylons!'); return; }
  if (m.def.stare && src === 'arrow') { m.anger = 40; stalkerBlink(m, true); return; } // it slips away from projectiles
  if (m.vuln) { dmg *= 1.5; crit = true; }
  // Minecraft-style hurt immunity: after a hit a creature is protected for half a second;
  // a stronger hit inside that window only deals the difference
  if (src === 'dot') { /* burning ignores hurt immunity */ }
  else if (m.invT > 0) { if (dmg <= m.lastDmg) return; const full = dmg; dmg -= m.lastDmg; m.lastDmg = full; }
  else { m.invT = 0.5; m.lastDmg = dmg; }
  m.hp -= dmg; m.flash = 0.22; m.hurtT = 0.32; m.anger = 30;
  Sound.hit(m.def.heavy || m.def.boss);
  damageNumber(m.x, m.y + m.h * m.scale + 0.3, m.z, dmg, crit);
  const kb = m.def.boss ? 0 : (m.def.heavy ? 0.4 : 1);
  m.vx += (kx || 0) * 7 * kb; m.vz += (kz || 0) * 7 * kb; if (!m.def.boss && !m.def.fly) m.vy = Math.max(m.vy, 4.5 * kb);
  const c = new THREE.Color(m.def.chip || 0xb03a2a);
  burst(m.x, m.y + m.h * m.scale * 0.6, m.z, crit ? 12 : 7, { life: 0.45, size: 0.07, r: c.r, g: c.g, b: c.b, grav: 12, spread: 3.5, up: 3 });
  burst(m.x, m.y + m.h * m.scale * 0.6, m.z, 4, { life: 0.18, size: 0.12, r: 1, g: 0.95, b: 0.8, glow: true, spread: 5, up: 2 });
  if (m.def.pack || m.type === 'villager') for (const o of Mobs) if (o !== m && !o.dead && Math.hypot(o.x - m.x, o.z - m.z) < 16 && (o.type === m.type || (m.type === 'villager' && o.type === 'guardian'))) { if (!o.tamed) o.anger = 30; }
  if (m.tamed) m.anger = 0;
  if (m.def.boss) { m.poise = (m.poise === undefined ? 70 : m.poise) - dmg; if (m.poise <= 0 && !['air', 'roar', 'stagger'].includes(m.st) && !m.shield) { bossState(m, 'stagger', 1.7); m.poise = 70; toast(m.def.name + ' staggers - strike now!', 1600); shake(0.4); } }
  if (m.hp <= 0) killMob(m);
}
function killMob(m, silent) {
  if (m.dead) return;
  m.dead = true; m.dying = m.dyingMax = m.def.boss ? 4.4 : 0.9; m.fallSide = Math.random() < 0.5 ? -1 : 1;
  if (!silent) {
    Quests.event('kill', m); Stats.kills++;
    if (!m.baby) for (const [it, lo, hi, p] of m.def.drops) {
      if (m.type === 'sheep' && it === B.WOOL_WHITE && m.sheared) continue;
      if (Math.random() <= p || (m.looting && Math.random() < m.looting * 0.1)) { const n = lo + Math.floor(Math.random() * (hi - lo + 1 + (m.looting || 0))); if (n > 0) dropItem(it, n, m.x, m.y + 0.5, m.z); }
    }
    if (m.def.split && m.size > 1) for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { const c = spawnMob(m.type, m.x + (Math.random() - 0.5) * m.hw, m.y + 0.2, m.z + (Math.random() - 0.5) * m.hw, { size: m.size - 1, anger: 20 }); c.vy = 5; c.vx = (Math.random() - 0.5) * 4; c.vz = (Math.random() - 0.5) * 4; }
  }
  if (m.def.boss) { onBossDefeated(m); Game.slowmo = 1.8; Sound.roar(0.7); }
  else Sound.voice(m.def.voice || 'thud', Math.hypot(m.x - Player.x, m.z - Player.z), 0.8);
}
function stalkerBlink(m, away) {
  const P = Player;
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * 6.28, r = away ? 8 + Math.random() * 8 : 3 + Math.random() * 3;
    const x = Math.floor((away ? m.x : P.x) + Math.cos(a) * r), z = Math.floor((away ? m.z : P.z) + Math.sin(a) * r);
    if (!resident(x, z)) continue;
    const y = groundY(x, z) + 1;
    if (Math.abs(y - P.y) > 8 || getB(x, y - 1, z) === B.WATER || collides(x + 0.5, y, z + 0.5, m.hw, m.h)) continue;
    burst(m.x, m.y + 1.4, m.z, 24, { life: 0.8, size: 0.09, r: 0.75, g: 0.55, b: 1, glow: true, spread: 2, up: 2.5 });
    m.x = x + 0.5; m.y = y; m.z = z + 0.5; m.vx = m.vz = m.vy = 0;
    burst(m.x, m.y + 1.4, m.z, 24, { life: 0.8, size: 0.09, r: 0.75, g: 0.55, b: 1, glow: true, spread: 2, up: 2.5 });
    Sound.teleport(Math.hypot(m.x - P.x, m.z - P.z));
    return true;
  }
  return false;
}
function explodeAt(x, y, z, power, src) {
  shake(Math.min(1.2, power / 8));
  Sound.boom(Math.hypot(x - Player.x, z - Player.z));
  burst(x, y + 0.8, z, 40, { life: 1.3, size: 0.3, r: 0.85, g: 0.82, b: 0.75, spread: power * 0.9, up: power * 0.5, drag: 1.5 });
  burst(x, y + 0.8, z, 30, { life: 0.5, size: 0.2, r: 1, g: 0.75, b: 0.3, glow: true, spread: power * 1.4, up: power * 0.8 });
  burst(x, y + 0.8, z, 30, { life: 1.6, size: 0.1, r: 0.6, g: 0.9, b: 0.5, glow: true, spread: power, up: power * 0.4, drag: 1 });
  const P = Player, d = Math.hypot(P.x - x, P.y + 0.9 - y, P.z - z), R = power * 0.75;
  if (d < R) { const f = 1 - d / R; hurtPlayer(power * 2.2 * f, null, (P.x - x) / (d || 1) * 3 * f, (P.z - z) / (d || 1) * 3 * f, { mob: src, how: 'boom' }); P.vy = Math.max(P.vy, 7 * f); }
  for (const o of Mobs) if (o !== src && !o.dead) { const dd = Math.hypot(o.x - x, o.z - z); if (dd < R) damageMob(o, power * 2 * (1 - dd / R), (o.x - x) / (dd || 1), (o.z - z) / (dd || 1), false); }
}
// right-click on a creature: trade, shear, feed, tame
const VILLAGER_TRADES = [
  { give: I.gold, n: 1, get: I.bread, m: 3, line: 'Fresh from the oven this morning!' },
  { give: I.gold, n: 1, get: I.fish, m: 3, line: 'Caught them at dawn, still smells of the lake.' },
  { give: I.gold, n: 2, get: I.iron, m: 1, line: 'Good iron. Mind the edges.' },
  { give: I.gold, n: 3, get: I.potion, m: 1, line: 'Brewed it myself. Drink it slowly.' },
];
const VILLAGER_LINES = ['Lovely day for it.', 'Have you seen the windmill turn? Never gets old.', 'Watch the roads after dark.', 'The bread here is the best in the realm.', 'Mind the boomshrooms. Nasty tempers.', 'They say the Mirewarden still guards the Drowned Halls.', 'Hm. Hmm!', 'Bring me gold coins and we can trade.'];
function interactMob(m) {
  if (m.dead) return false;
  const s = heldItem(), id = s ? s.id : 0, def = m.def;
  const dist = Math.hypot(m.x - Player.x, m.z - Player.z);
  if (m.type === 'villager') {
    const tr = VILLAGER_TRADES[m.variant % 4];
    m.face = Math.atan2(Player.x - m.x, Player.z - m.z); m.talkT = 2.5; m.wx = m.wz = 0; m.wt = 3;
    Sound.voice('hmm', dist, 1);
    if (id === tr.give && countItem(tr.give) >= tr.n) {
      takeItem(tr.give, tr.n); const left = giveItem(tr.get, tr.m); if (left) dropItem(tr.get, left, Player.x, Player.y + 1, Player.z);
      toast('Traded ' + tr.n + '× ' + itemDef(tr.give).name + ' for ' + tr.m + '× ' + itemDef(tr.get).name + ' - "' + tr.line + '"', 3200);
      burst(m.x, m.y + 2.1, m.z, 8, { life: 0.8, size: 0.09, r: 0.4, g: 1, b: 0.5, glow: true, spread: 1.5, up: 2 });
      Quests.event('trade'); Sound.pop();
    } else toast('Villager: "' + (Math.random() < 0.4 ? 'I trade ' + tr.m + '× ' + itemDef(tr.get).name + ' for ' + tr.n + '× ' + itemDef(tr.give).name + '.' : VILLAGER_LINES[Math.floor(Math.random() * VILLAGER_LINES.length)]) + '"', 3000);
    return true;
  }
  if (m.type === 'sheep' && id === I.shears && !m.sheared && !m.baby) {
    m.sheared = true; m.regrow = 90; if (m.P.wool) m.P.wool.visible = false;
    dropItem(B.WOOL_WHITE, 1 + Math.floor(Math.random() * 3), m.x, m.y + 1, m.z); Sound.shear(); Quests.event('shear');
    burst(m.x, m.y + 1, m.z, 14, { life: 0.8, size: 0.1, r: 0.95, g: 0.94, b: 0.9, spread: 2, up: 2, grav: 4 });
    return true;
  }
  if (def.tame && id === def.tame && !m.tamed) {
    takeItem(id, 1); lastHudKey = '';
    if (Math.random() < 0.4) { m.tamed = true; m.anger = 0; if (m.P.collar) m.P.collar.visible = true; hearts(m, 10); Sound.heart(); toast('The wolf is now your loyal companion!', 2600); Quests.event('tame'); }
    else burst(m.x, m.y + 1, m.z, 8, { life: 0.8, size: 0.1, r: 0.5, g: 0.5, b: 0.5, spread: 1.5, up: 1.5 });
    return true;
  }
  if (m.tamed && s && itemDef(id).kind === 'food' && m.hp < m.maxHp) { takeItem(id, 1); m.hp = m.maxHp; hearts(m, 6); Sound.eat(); return true; }
  if (def.breed && id === def.food && !m.love && !(m.breedCd > 0)) {
    takeItem(id, 1); lastHudKey = '';
    if (m.baby) { m.grow = (m.grow || 0) + 60; hearts(m, 3); }
    else { m.love = 20; hearts(m, 6); }
    Sound.eat(); return true;
  }
  return false;
}
function hearts(m, n) { for (let i = 0; i < n; i++) emit(m.x + (Math.random() - 0.5) * m.hw * 2, m.y + m.h * m.scale + Math.random() * 0.4, m.z + (Math.random() - 0.5) * m.hw * 2, { vy: 0.8, life: 1.2, size: 0.12, r: 1, g: 0.35, b: 0.45, glow: true }); }

// ---------------------------------------------------------------- AI
function mobLight(m) { const L = lightAt(m.x, m.y + m.h * 0.6, m.z); const v = Math.max(L[0] / 15 * U.uDay.value, L[1] / 15) * 0.85 + 0.15; return m.def.boss ? Math.max(0.7, v) : v; }
function mobTint(c, m) {
  const L = lightAt(m.x, m.y + m.h * 0.6, m.z), sky = L[0] / 15, blk = L[1] / 15;
  const out = Math.max(0.18, Math.pow(sky, 1.5)), torch = Math.pow(blk, 2.2) * 1.4;
  c.setRGB(out + torch * U.uTorch.value.r, out + torch * U.uTorch.value.g, out + torch * U.uTorch.value.b);
  if (m.def.boss) { c.r = Math.max(c.r, 0.75); c.g = Math.max(c.g, 0.75); c.b = Math.max(c.b, 0.75); }
}
// ---------------------------------------------------------------- pathfinding (weighted A* on the voxel grid)
let pathBudget = 0;
function passable(x, y, z) { const id = getB(x, y, z); return !SOLID[id] && !HURT[id] && id !== B.LAVA; }
function standable(x, y, z, hgt) {
  if (y < 1 || y >= H - 2) return false;
  for (let k = 0; k < hgt; k++) if (!passable(x, y + k, z)) return false;
  const below = getB(x, y - 1, z);
  return (SOLID[below] && !HURT[below]) || below === B.WATER || getB(x, y, z) === B.WATER;
}
const _heap = [];
function findPath(m, gx, gy, gz, maxNodes) {
  const hgt = Math.max(2, Math.ceil(m.h)), sx = Math.floor(m.x), sy = Math.floor(m.y + 0.05), sz = Math.floor(m.z);
  if (!standable(sx, sy, sz, hgt)) return null;
  const key = (x, y, z) => (x + 4096) + (z + 4096) * 8192 + y * 67108864;
  const open = _heap; open.length = 0;
  const came = new Map(), g = new Map();
  const hh = (x, y, z) => Math.hypot(x - gx, z - gz) + Math.abs(y - gy) * 0.8;
  const push = n => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p].f <= open[i].f) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < open.length && open[l].f < open[s].f) s = l; if (r < open.length && open[r].f < open[s].f) s = r; if (s === i) break; [open[s], open[i]] = [open[i], open[s]]; i = s; } } return top; };
  const k0 = key(sx, sy, sz); g.set(k0, 0); push({ x: sx, y: sy, z: sz, f: hh(sx, sy, sz) * 1.5 });
  let best = { x: sx, y: sy, z: sz }, bestH = hh(sx, sy, sz), n = 0;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (open.length && n++ < maxNodes) {
    const c = pop(), ck = key(c.x, c.y, c.z), cg = g.get(ck);
    const ch = hh(c.x, c.y, c.z);
    if (ch < bestH) { bestH = ch; best = c; }
    if (Math.abs(c.x - gx) <= 1 && Math.abs(c.z - gz) <= 1 && Math.abs(c.y - gy) <= 1) { best = c; break; }
    for (const [dx, dz] of DIRS) {
      const nx = c.x + dx, nz = c.z + dz;
      if (dx && dz && (!passable(c.x + dx, c.y, c.z) || !passable(c.x, c.y, c.z + dz) || !passable(c.x + dx, c.y + 1, c.z) || !passable(c.x, c.y + 1, c.z + dz))) continue;
      let ny = null, cost = dx && dz ? 1.414 : 1;
      if (standable(nx, c.y, nz, hgt)) ny = c.y;
      else if (!dx || !dz) {
        if (standable(nx, c.y + 1, nz, hgt) && passable(c.x, c.y + hgt, c.z)) { ny = c.y + 1; cost += 0.6; }
        else for (let d = 1; d <= 3; d++) { if (!passable(nx, c.y - d + 1, nz)) break; if (standable(nx, c.y - d, nz, hgt)) { ny = c.y - d; cost += 0.3 * d; break; } }
      }
      if (ny === null) continue;
      if (getB(nx, ny, nz) === B.WATER) cost += 2;
      const nk = key(nx, ny, nz), ng = cg + cost;
      if (g.has(nk) && g.get(nk) <= ng) continue;
      g.set(nk, ng); came.set(nk, ck);
      push({ x: nx, y: ny, z: nz, f: ng + hh(nx, ny, nz) * 1.5 });
    }
  }
  const path = []; let k = key(best.x, best.y, best.z);
  while (k !== undefined && k !== k0) { const y = Math.floor(k / 67108864), r = k - y * 67108864, z = Math.floor(r / 8192) - 4096, x = r % 8192 - 4096; path.push({ x: x + 0.5, y, z: z + 0.5 }); k = came.get(k); }
  path.reverse();
  return path;
}
function followPath(m, P, dt) {
  // returns a unit direction toward the next waypoint (or null to fall back to a straight line)
  m.repath = (m.repath || 0) - dt;
  const gx = Math.floor(P.x), gy = Math.floor(P.y + 0.05), gz = Math.floor(P.z);
  const goalMoved = !m.goal || Math.abs(m.goal[0] - gx) + Math.abs(m.goal[2] - gz) > 2 || Math.abs(m.goal[1] - gy) > 1;
  if ((m.repath <= 0 || (goalMoved && m.repath < 0.4) || !m.path) && pathBudget > 0 && m.onGround) {
    pathBudget--; m.repath = 0.6 + Math.random() * 0.5;
    m.path = findPath(m, gx, gy, gz, 900); m.pathI = 0; m.goal = [gx, gy, gz];
  }
  const p = m.path;
  if (!p || m.pathI >= p.length) return null;
  let wp = p[m.pathI];
  while (m.pathI < p.length - 1 && Math.hypot(wp.x - m.x, wp.z - m.z) < 0.35) wp = p[++m.pathI];
  const dx = wp.x - m.x, dz = wp.z - m.z, d = Math.hypot(dx, dz) || 1;
  if (wp.y > m.y + 0.4 && m.onGround && d < 1.4) m.vy = m.def.heavy ? 9 : 8.6;
  if (m.pathI === p.length - 1 && d < 0.3) return null;
  return [dx / d, dz / d];
}

function nearestHostile(m, r, near) {
  let best = null, bd = r;
  for (const o of Mobs) { if (o === m || o.dead || o.def.passive || o.def.boss) continue; const d = Math.hypot(o.x - (near || m).x, o.z - (near || m).z); if (d < bd && Math.abs(o.y - m.y) < 6) { bd = d; best = o; } }
  return best;
}
function updateMobs(dt, P) {
  pathBudget = 3;
  updateMobLights();
  const day = U.uDay.value;
  for (let i = Mobs.length - 1; i >= 0; i--) {
    const m = Mobs[i], def = m.def;
    if (m.dying !== undefined) { updateDying(m, dt); continue; }
    m.t += dt; if (m.invT > 0) m.invT -= dt;
    if (m.onFire > 0 && !def.burn) { m.onFire -= dt; if (Math.random() < dt * 25) emit(m.x + (Math.random() - 0.5) * m.hw * 2, m.y + Math.random() * m.h * m.scale, m.z + (Math.random() - 0.5) * m.hw * 2, { vy: 1.6, life: 0.5, size: 0.1, r: 1, g: 0.55, b: 0.15, glow: true }); m.fireT = (m.fireT || 0) - dt; if (m.fireT <= 0) { m.fireT = 1; damageMob(m, 1, 0, 0, false, 'dot'); if (m.dead) continue; } }
    const dx = P.x - m.x, dz = P.z - m.z, dy = P.y - m.y, dist = Math.hypot(dx, dz);
    if (!def.boss && !m.spawn && !m.tamed && dist > (m.home ? 130 : 90)) { removeMob(m); continue; }
    if (m.spawn && dist > 110) { removeMob(m); continue; }
    if (m.y < -5) { removeMob(m); continue; }
    if (m.baby) { m.grow = (m.grow || 0) + dt; if (m.grow > 300) { m.baby = false; m.hw = def.hw; m.h = def.h; m.scale = def.scale || 1; m.g.scale.setScalar(m.scale); m.hp = m.maxHp = def.hp; } else { const s = (def.scale || 1) * (0.5 + 0.2 * m.grow / 300); m.g.scale.setScalar(s); m.scale = s; } }
    if (m.regrow > 0) { m.regrow -= dt; if (m.regrow <= 0) { m.sheared = false; if (m.P.wool) m.P.wool.visible = true; } }
    if (m.breedCd > 0) m.breedCd -= dt;
    if (m.talkT > 0) m.talkT -= dt;
    let tx = 0, tz = 0, speed = 0, chase = false, target = null;
    const inWater = getB(Math.floor(m.x), Math.floor(m.y + 0.4), Math.floor(m.z)) === B.WATER;
    const dark = def.dayNeutral ? lightAt(m.x, m.y + 0.5, m.z)[0] * day < 9 : true;
    let hostile = (!def.passive && dark) || ((def.neutral || def.dayNeutral) && m.anger > 0);
    if (m.tamed) hostile = false;
    if (Game.peaceful || Game.mode !== 'survival' || !P.alive) hostile = false;
    // the stalker turns hostile when you stare at its face
    if (def.stare && !m.anger && dist < 30 && P.alive && Game.mode !== 'creative') {
      const e = eye(), d = lookDir(), hx = m.x - e[0], hy = m.y + 2.7 - e[1], hz = m.z - e[2], hl = Math.hypot(hx, hy, hz);
      if ((hx * d[0] + hy * d[1] + hz * d[2]) / hl > 0.985) { m.stare = (m.stare || 0) + dt; m.shakeT = 0.1; if (m.stare > 0.8) { m.anger = 45; Sound.voice('shriek', dist, 1); shake(0.25); } } else m.stare = 0;
    }
    if (def.boss) { bossAI(m, dt, P, dx, dz, dist); }
    else {
      // choose what to do
      if (m.tamed) {
        target = m.target && !m.target.dead && Math.hypot(m.target.x - m.x, m.target.z - m.z) < 18 ? m.target : (Game.lastHit && !Game.lastHit.dead && performance.now() - Game.lastHitT < 6000 && Game.lastHit !== m ? Game.lastHit : nearestHostile(m, 10, P));
        m.target = target;
        if (dist > 22) { stalkerBlink(m, false); }
        else if (!target && dist > 4) { speed = def.speed * 1.6; const dir = followPath(m, P, dt); if (dir) { tx = dir[0]; tz = dir[1]; } else { tx = dx / dist; tz = dz / dist; } }
      } else if (m.type === 'guardian' && !m.anger) target = nearestHostile(m, 16);
      if (target) {
        const ddx = target.x - m.x, ddz = target.z - m.z, dd = Math.hypot(ddx, ddz) || 1;
        chase = true; speed = def.chase || def.speed * 1.5; tx = ddx / dd; tz = ddz / dd;
        if (dd > 2) { const dir = followPath(m, target, dt); if (dir) { tx = dir[0]; tz = dir[1]; } }
        m.atk -= dt;
        if (dd < m.hw + target.hw + 0.9 && m.atk <= 0) { m.atk = def.heavy ? 1.4 : 0.9; m.swing = 0.3; damageMob(target, def.dmg, ddx / dd, ddz / dd, false); if (m.type === 'guardian') target.vy = 9; }
      } else if (def.passive && !((def.neutral || def.dayNeutral) && m.anger > 0) && !m.tamed) {
        if (m.anger > 0) { tx = -dx / (dist || 1); tz = -dz / (dist || 1); speed = def.flee || def.speed; m.anger -= dt; }
        else if (m.love > 0) {
          m.love -= dt; if (Math.random() < dt * 3) hearts(m, 1);
          const mate = Mobs.find(o => o !== m && o.type === m.type && o.love > 0 && !o.dead && !o.baby && Math.hypot(o.x - m.x, o.z - m.z) < 10);
          if (mate) { const mx = mate.x - m.x, mz = mate.z - m.z, md = Math.hypot(mx, mz) || 1; tx = mx / md; tz = mz / md; speed = def.speed; if (md < m.hw + mate.hw + 0.4) { m.love = mate.love = 0; m.breedCd = mate.breedCd = 60; const b = spawnMob(m.type, (m.x + mate.x) / 2, m.y + 0.3, (m.z + mate.z) / 2, { baby: true, variant: Math.random() < 0.5 ? m.variant : mate.variant, home: m.home }); hearts(b, 10); Sound.heart(); Quests.event('breed'); } }
        } else if (m.talkT > 0) { speed = 0; }
        else {
          m.wt -= dt;
          if (m.wt <= 0) {
            m.wt = 3 + Math.random() * 5; const go = Math.random() < (m.grazing ? 0.25 : 0.6);
            if (go) pickWander(m, 8); else m.wtx = undefined;
            if (m.home) { const hd = Math.hypot(m.home.x - m.x, m.home.z - m.z); if (hd > m.home.r * 0.75) { m.wtx = m.home.x + (Math.random() - 0.5) * 6; m.wtz = m.home.z + (Math.random() - 0.5) * 6; } }
            if (m.A.graze) m.grazing = !go && Math.random() < 0.6;
          }
          steerWander(m); tx = m.wx; tz = m.wz; speed = def.speed * 0.5;
          if (dist < 7 && m.A.look && !def.fly && !def.swim && Math.random() < dt * 0.4) { m.wtx = undefined; m.wx = m.wz = 0; m.wt = 2; } // stop and look at you
        }
      } else if (hostile && dist < (def.det || 16) * (m.anger > 0 ? 1.6 : 1) && Math.abs(dy) < 12) {
        chase = true; tx = dx / (dist || 1); tz = dz / (dist || 1); speed = def.chase || def.speed;
        if (def.stare) { m.tp = (m.tp || 2) - dt; if (m.tp <= 0 && (dist > 7 || Math.random() < 0.3)) { m.tp = 2.5 + Math.random() * 3; stalkerBlink(m, false); } }
        if (!def.fly && !m.ranged && !def.swim && (dist > 2.2 || Math.abs(dy) > 0.8)) { const dir = followPath(m, P, dt); if (dir) { tx = dir[0]; tz = dir[1]; } }
        if (m.ranged) {
          const want = m.ranged === 'bolt' ? 8 : m.ranged === 'fire' ? 14 : m.ranged === 'potion' ? 7 : 11;
          if (dist < want - 2) { tx = -tx; tz = -tz; } else if (dist < want + 2) { speed *= 0.4; const s = tx; tx = -tz * (m.strafe || 1); tz = s * (m.strafe || 1); if (Math.random() < dt * 0.3) m.strafe = -(m.strafe || 1); }
          else if (!def.fly) { const dir = followPath(m, P, dt); if (dir) { tx = dir[0]; tz = dir[1]; } }
          m.cd -= dt; m.aim = m.cd < 0.7 && dist < 30;
          if (m.cd <= 0 && dist < 30) {
            m.cd = { bolt: 1.8, fire: 3.2, potion: 2.6, dart: 2.4, arrow: 2.2 }[m.ranged] || 2;
            const sy = m.y + m.h * m.scale * 0.75, ty = P.y + 1.2, d3 = Math.hypot(dx, ty - sy, dz) || 1;
            const sp = m.ranged === 'arrow' ? 22 : m.ranged === 'potion' ? 11 : m.ranged === 'fire' ? 11 : 14;
            const grav = m.ranged === 'arrow' ? 18 : m.ranged === 'potion' ? 14 : 0, tt = d3 / sp;
            shoot(m.ranged, m.x + tx * 0.3, sy, m.z + tz * 0.3, dx / d3 * sp, (ty - sy) / d3 * sp + grav * tt * 0.5, dz / d3 * sp, def.dmg, 'mob', { src: m });
            if (m.ranged === 'arrow') Sound.bow(); else if (m.ranged === 'potion') Sound.voice('cackle', dist, 0.7); else if (m.ranged === 'fire') Sound.voice('wail', dist, 0.6);
            m.shotT = 0.3;
          }
          if (def.ranged === 'potion' && !m.drank && m.hp < m.maxHp * 0.4) { m.drank = true; m.hp = Math.min(m.maxHp, m.hp + 12); burst(m.x, m.y + 2, m.z, 16, { life: 0.8, size: 0.1, r: 1, g: 0.4, b: 0.6, glow: true, spread: 1.5, up: 2 }); }
        }
        if (def.explode) {
          if (dist < 2.8 && Math.abs(dy) < 2) { if (!m.fuse) Sound.hiss(dist); m.fuse = (m.fuse || 0) + dt; speed *= 0.3; }
          else if (m.fuse > 0 && dist > 5) m.fuse = Math.max(0, m.fuse - dt * 1.5);
          if (m.fuse > 1.5) { killMob(m, true); explodeAt(m.x, m.y + 0.5, m.z, 6, m); m.dying = 0; continue; }
        }
        if (def.swoop) {
          m.cd -= dt;
          if (m.cd > 0) { const a = m.t * 0.6; tx = (P.x + Math.cos(a) * 10 - m.x); tz = (P.z + Math.sin(a) * 10 - m.z); const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; m.wantY = P.y + 11; }
          else { m.wantY = P.y + 0.8; speed *= 1.6; if (dist < 1.6 || m.cd < -2.5) { m.cd = 5 + Math.random() * 4; } }
        }
      } else if (m.fuse > 0) m.fuse = Math.max(0, m.fuse - dt * 1.5);
      else {
        m.wt -= dt; if (m.wt <= 0) { m.wt = 3 + Math.random() * 5; if (Math.random() < 0.5) pickWander(m, 10); else m.wtx = undefined; }
        steerWander(m); tx = m.wx; tz = m.wz; speed = def.speed * 0.35;
      }
      // ---- non-swimmers in water head for the nearest shore
      if (inWater && !def.swim && !def.swimOk && !def.fly && !chase && !target) {
        m.shoreT = (m.shoreT || 0) - dt;
        if (m.shoreT <= 0) { m.shoreT = 1; m.shore = findShore(m); }
        if (m.shore) { const sx = m.shore[0] - m.x, sz = m.shore[1] - m.z, sd = Math.hypot(sx, sz) || 1; tx = sx / sd; tz = sz / sd; speed = def.speed * 0.8; }
      }
      // ---- movement
      if (def.hop) {
        m.hopT = (m.hopT || 0) - dt;
        if (m.onGround) { m.vx *= Math.max(0, 1 - dt * 12); m.vz *= Math.max(0, 1 - dt * 12); if (m.landed === false) { m.squash = 1; m.landed = true; } }
        if (m.onGround && (tx || tz) && speed > 0 && m.hopT <= 0) { m.vy = m.A.hop || 5; m.vx = tx * speed * 1.4; m.vz = tz * speed * 1.4; m.hopT = (chase ? 0.25 : 0.6) + Math.random() * 0.6; m.landed = false; if (def.split) Sound.voice('squish', dist, 0.4); }
      } else if (def.swim) {
        if (inWater) {
          m.wt -= dt; if (m.wt <= 0 || m.hitX || m.hitZ) { m.wt = 1.5 + Math.random() * 3; const a = Math.random() * 6.28; m.wx = Math.cos(a); m.wz = Math.sin(a); m.wy = (Math.random() - 0.5) * 0.8; }
          if (m.anger > 0) { m.wx = -dx / (dist || 1); m.wz = -dz / (dist || 1); }
          let wy = m.wy || 0; if (getB(Math.floor(m.x), Math.floor(m.y + m.h + 0.3), Math.floor(m.z)) !== B.WATER) wy = Math.min(wy, -0.5);
          const sp2 = (m.anger > 0 ? def.flee : def.speed) * (m.type === 'squid' ? 0.5 + Math.max(0, Math.sin(m.t * 2.5)) : 1);
          m.vx += (m.wx * sp2 - m.vx) * Math.min(1, dt * 3); m.vz += (m.wz * sp2 - m.vz) * Math.min(1, dt * 3); m.vy += (wy * sp2 - m.vy) * Math.min(1, dt * 3);
        } else { m.vy -= 28 * dt; m.vx *= 0.9; m.vz *= 0.9; if (m.onGround && Math.random() < dt * 3) { m.vy = 4; m.vx = (Math.random() - 0.5) * 3; m.vz = (Math.random() - 0.5) * 3; } m.dryT = (m.dryT || 0) + dt; if (m.dryT > 1) { m.dryT = 0; m.hp -= 1; m.flash = 0.2; if (m.hp <= 0) killMob(m); } }
      } else {
        const k = Math.min(1, dt * (m.onGround || def.fly ? 8 : 2));
        m.vx += (tx * speed - m.vx) * k; m.vz += (tz * speed - m.vz) * k;
      }
      if (def.fly) {
        const ground = groundY(Math.floor(m.x), Math.floor(m.z));
        let want = chase ? Math.max(ground + 2.5, P.y + 2.5) : ground + 3 + Math.sin(m.t) * 0.5;
        if (m.type === 'bat') want = ground + 2 + Math.sin(m.t * 1.7) * 1.5 + Math.sin(m.t * 3.1);
        if (m.type === 'bee') want = ground + 1.6 + Math.sin(m.t * 2) * 0.4;
        if (m.type === 'wraith') want = Math.max(ground + 6, P.y + 5);
        if (m.wantY !== undefined && def.swoop) want = Math.max(ground + 1, m.wantY);
        m.vy += ((want - m.y) * 2 - m.vy) * Math.min(1, dt * 3);
        if (m.type === 'bat' && Math.random() < dt * 2) { m.wx = Math.random() - 0.5; m.wz = Math.random() - 0.5; }
      } else if (!def.swim) {
        if (inWater && !def.swimOk) { m.vy -= 8 * dt; m.vy = Math.max(m.vy, -2) + 15 * dt; }
        else m.vy -= (def.slowFall && m.vy < 0 ? 10 : 28) * dt;
        if (def.slowFall && m.vy < -2.5) m.vy = -2.5;
      }
      m.vy = Math.max(m.vy, -40);
      const wasGround = m.onGround;
      moveBody(m, dt);
      if (!wasGround && m.onGround && def.split) m.squash = 1;
      m.jumpCd = (m.jumpCd || 0) - dt;
      if ((m.hitX || m.hitZ) && speed > 0.3 && !def.fly && !def.swim) {
        if (def.climb && chase) m.vy = 3.6;
        else if ((m.onGround || inWater) && !def.hop && m.jumpCd <= 0) {
          const l = Math.hypot(tx, tz) || 1, ax = m.x + tx / l * (m.hw + 0.45), az = m.z + tz / l * (m.hw + 0.45);
          const stepY = Math.floor(m.y + 0.05) + 1;
          if (!collides(ax, stepY + 0.01, az, m.hw * 0.9, m.h) && SOLID[getB(Math.floor(ax), stepY - 1, Math.floor(az))]) { m.vy = inWater ? 7.5 : def.heavy ? 9 : 8.4; m.jumpCd = 0.45; }
          else if (!chase) { m.wtx = undefined; m.wx = -m.wx; m.wz = -m.wz; m.wt = 1 + Math.random() * 2; }
        }
      }
      if (!chase && !def.fly && !def.swim && m.onGround && (m.wx || m.wz)) { const ax = Math.floor(m.x + m.wx * 1.2), az = Math.floor(m.z + m.wz * 1.2), ay = Math.floor(m.y); let drop = 0; while (drop < 4 && !SOLID[getB(ax, ay - 1 - drop, az)]) drop++; if (drop >= 3 || HURT[getB(ax, ay, az)] || getB(ax, ay - 1, az) === B.LAVA || (getB(ax, ay - 1, az) === B.WATER && !def.swimOk)) { m.wtx = undefined; m.wx = m.wz = 0; m.vx *= 0.2; m.vz *= 0.2; m.wt = 0.4; } }
      // melee
      m.atk -= dt;
      if (chase && !target && !m.ranged && !def.explode && def.dmg && dist < m.hw + 1.1 && Math.abs(dy) < 2 && m.atk <= 0) {
        m.atk = def.heavy ? 1.6 : 1.0; m.swing = 0.3;
        hurtPlayer(def.dmg * (m.dmgMul || 1), def.burn ? 'burn' : null, dx / (dist || 1) * (def.kb || 5) / 5, dz / (dist || 1) * (def.kb || 5) / 5, { mob: m, how: def.burn ? 'burn' : 'melee' });
        if (def.poison) { Player.poison = 3; Player.poisonSrc = { mob: m, how: 'poison' }; }
        if (def.swoop) m.cd = 5 + Math.random() * 3;
      }
      // hazards and sunlight
      const hz = touching(m.x, m.y, m.z, m.hw, m.h, HURT);
      if (hz && !def.burn) { m.hp -= hz * dt * 2; if (m.hp <= 0) { killMob(m); continue; } }
      if (def.undead && m.variant !== 1 && m.variant !== 3 && !(m.type === 'zombie' && m.variant === 1) && day > 0.6 && !inWater && lightAt(m.x, m.y + m.h, m.z)[0] >= 14) {
        m.burnT = (m.burnT || 0) + dt; if (Math.random() < dt * 20) emit(m.x + (Math.random() - 0.5) * 0.5, m.y + Math.random() * m.h, m.z + (Math.random() - 0.5) * 0.5, { vy: 1.5, life: 0.5, size: 0.1, r: 1, g: 0.6, b: 0.15, glow: true });
        if (m.burnT > 1) { m.burnT = 0; m.hp -= 1; m.flash = 0.15; if (m.hp <= 0) { killMob(m); continue; } }
      }
      if (m.anger > 0 && !(def.passive && !def.neutral && !def.dayNeutral)) m.anger -= dt;
    }
    // ambient voices
    m.voiceT -= dt;
    if (m.voiceT <= 0) { m.voiceT = 7 + Math.random() * 16; if (def.voice && dist < 20 && !(def.voice === 'buzz' && Math.random() < 0.5)) Sound.voice(def.voice, Math.hypot(dist, dy), 1); }
    animateMob(m, dt, chase, P, dist);
  }
}
// pick a reachable spot on dry land and walk to it (instead of wandering in a straight random line)
function pickWander(m, r) {
  for (let tries = 0; tries < 6; tries++) {
    const a = Math.random() * 6.28, d = 3 + Math.random() * r, x = Math.floor(m.x + Math.cos(a) * d), z = Math.floor(m.z + Math.sin(a) * d);
    if (!resident(x, z)) continue;
    const gy = groundY(x, z), top = getB(x, gy, z);
    if (Math.abs(gy + 1 - m.y) > 3 || !SOLID[top] || HURT[top] || getB(x, gy + 1, z) === B.WATER || getB(x, gy + 1, z) === B.LAVA) continue;
    m.wtx = x + 0.5; m.wtz = z + 0.5; return true;
  }
  m.wtx = undefined; return false;
}
function steerWander(m) {
  if (m.wtx === undefined) { m.wx = m.wz = 0; return; }
  const dx = m.wtx - m.x, dz = m.wtz - m.z, d = Math.hypot(dx, dz);
  if (d < 0.6) { m.wtx = undefined; m.wx = m.wz = 0; m.wt = Math.min(m.wt, 1 + Math.random() * 3); return; }
  m.wx = dx / d; m.wz = dz / d;
}
function findShore(m) {
  let best = null, bd = 1e9;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    for (let r = 1; r <= 12; r++) {
      const x = Math.floor(m.x + cx * r), z = Math.floor(m.z + cz * r), gy = groundY(x, z);
      if (getB(x, gy + 1, z) === B.WATER) continue;
      if (gy + 1 > m.y + 2.5 || !SOLID[getB(x, gy, z)]) break;
      if (r < bd) { bd = r; best = [x + 0.5, z + 0.5]; }
      break;
    }
  }
  return best;
}
// ---------------------------------------------------------------- animation
// joints remember their rest pose; animation is expressed as an offset from it
function rot(g, x, y, z) { if (!g) return; if (!g.r0) g.r0 = g.rotation.clone(); g.rotation.set(g.r0.x + x, g.r0.y + y, g.r0.z + z); }
function pose(g, x, y, z, k) { if (!g) return; if (!g.r0) g.r0 = g.rotation.clone(); const r = g.rotation; r.x += (g.r0.x + x - r.x) * k; r.y += (g.r0.y + y - r.y) * k; r.z += (g.r0.z + z - r.z) * k; }
function shift(g, x, y, z, k) { if (!g) return; if (!g.p0) g.p0 = g.position.clone(); const p = g.position; k = k === undefined ? 1 : k; p.x += (g.p0.x + x - p.x) * k; p.y += (g.p0.y + y - p.y) * k; p.z += (g.p0.z + z - p.z) * k; }
const wrapA = a => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
function animateMob(m, dt, chase, P, dist) {
  const A = m.A, R = m.P, def = m.def, t = m.t;
  const sp = Math.hypot(m.vx, m.vz);
  m.walk += (Math.min(1, sp / Math.max(0.8, (def.speed || 2) * 0.7)) - m.walk) * Math.min(1, dt * 6);
  m.phase += dt * sp * (A.cadence || 4) / Math.max(0.35, m.scale);
  const ph = m.phase, w = m.walk, k8 = Math.min(1, dt * 10);
  // facing: walk direction, or the target when attacking / talking
  if (def.boss) { if (m.face !== undefined) m.yaw = m.face; }
  else if (m.talkT > 0 || (m.aim && chase) || (chase && def.ranged && sp < 1)) m.yaw = Math.atan2(P.x - m.x, P.z - m.z);
  else if (sp > 0.25) m.yaw = Math.atan2(m.vx, m.vz);
  const cur = m.g.rotation.y; m.g.rotation.order = 'YXZ';
  m.g.rotation.y = cur + wrapA(m.yaw - cur) * Math.min(1, dt * (def.boss ? 5 : 8));
  // hurt recoil
  if (m.hurtT > 0) m.hurtT -= dt;
  m.g.rotation.x = m.hurtT > 0 ? -Math.sin(m.hurtT / 0.32 * Math.PI) * 0.22 : 0;
  m.g.rotation.z = 0;
  // where the head looks
  let lookY = 0, lookX = 0;
  if (R.head && A.look && dist < 10 && (chase || (def.passive && !m.anger) || m.talkT > 0)) {
    const rel = wrapA(Math.atan2(P.x - m.x, P.z - m.z) - m.g.rotation.y);
    if (Math.abs(rel) < 2.2) { lookY = Math.max(-A.look, Math.min(A.look, rel)); lookX = -Math.max(-0.5, Math.min(0.5, Math.atan2(P.y + 1.5 - (m.y + m.h * 0.8), dist))); }
  }
  const graze = m.grazing && sp < 0.2 && !m.anger;
  m.grazeK = (m.grazeK || 0) + ((graze ? 1 : 0) - (m.grazeK || 0)) * Math.min(1, dt * 3);
  if (m.grazeK > 0.05) { lookY *= 1 - m.grazeK; lookX = lookX * (1 - m.grazeK); }
  m.lookY = (m.lookY || 0) + (lookY - (m.lookY || 0)) * k8 * 0.5; m.lookX = (m.lookX || 0) + (lookX - (m.lookX || 0)) * k8 * 0.5;
  const breath = Math.sin(t * 2.4) * 0.012;
  switch (A.kind) {
    case 'quad': {
      for (const L of R.legs) {
        const off = (L.front ? 0 : Math.PI) + (L.sx > 0 ? Math.PI : 0), s = Math.sin(ph + off), lift = Math.max(0, Math.cos(ph + off));
        rot(L.u, s * A.stride * w, 0, 0); rot(L.l, (L.front ? 1 : -0.7) * lift * A.knee * w + (L.front ? 0 : 0.05), 0, 0);
      }
      shift(R.body, 0, (1 - Math.cos(ph * 2)) * 0.5 * A.bob * w, 0);
      rot(R.body, 0, 0, Math.sin(ph) * 0.03 * w); R.body.scale.y = 1 + breath;
      const g = m.grazeK, chew = g > 0.6 ? Math.sin(t * 9) * 0.06 : 0;
      if (R.neck) { rot(R.neck, g * 0.95 + m.lookX * 0.4, m.lookY * 0.5, 0); rot(R.head, g * 0.35 + chew + m.lookX * 0.6, m.lookY * 0.5, 0); }
      else rot(R.head, g * 0.9 + chew + m.lookX, m.lookY, 0);
      if (R.tail) { const wag = (m.tamed || m.love > 0) ? 9 : (m.type === 'wolf' || m.type === 'fox') && chase ? 6 : 1.4; rot(R.tail, Math.sin(t * 1.3) * 0.05 + w * 0.2, Math.sin(t * wag) * (wag > 2 ? 0.5 : 0.18), 0); }
      earTwitch(m, dt);
      if (R.angry) R.angry.visible = m.anger > 0 && !m.tamed;
      break;
    }
    case 'biped': {
      const heavy = A.heavy ? 0.6 : 1;
      for (const L of R.legs) { const s = Math.sin(ph + (L.sx > 0 ? Math.PI : 0)); rot(L.u, s * A.stride * w, 0, 0); if (L.l) rot(L.l, Math.max(0, -Math.cos(ph + (L.sx > 0 ? Math.PI : 0))) * 0.7 * w, 0, 0); }
      shift(R.body, 0, (1 - Math.cos(ph * 2)) * 0.5 * 0.05 * w * heavy, 0); R.body.scale.y = 1 + breath;
      rot(R.body, w * 0.06 + (A.heavy ? w * 0.08 : 0), 0, Math.sin(ph) * 0.03 * w * (A.heavy ? 2 : 1));
      for (const a of R.arms) {
        const i = a.sx > 0 ? 1 : 0, sw = -Math.sin(ph + (a.sx > 0 ? 0 : Math.PI)) * 0.6 * w * heavy;
        let x = sw, z = a.sx * (0.04 + Math.sin(t * 1.3) * 0.02), y = 0, el = -0.15 * w;
        if (A.arms === 'reach' && chase) { x = -1.45 + Math.sin(t * 3 + a.sx) * 0.08; }
        if (A.arms === 'aim' && (m.aim || m.shotT > 0) && chase) { x = -1.45; y = a.sx > 0 ? -0.3 : 0.4; if (i === 0 && m.shotT > 0) x = -1.3; }
        if (m.swing > 0 && (i === 1 || A.heavy)) { x = -2.3 + (0.3 - m.swing) * 7.5; el = -0.3; }
        if (m.talkT > 0 && i === 1) x = -0.6 + Math.sin(t * 6) * 0.25;
        pose(a.u, x, y, z, Math.min(1, dt * 15)); if (a.l) pose(a.l, el, 0, 0, k8);
      }
      rot(R.head, m.lookX, m.lookY, 0);
      if (R.jaw) rot(R.jaw, chase ? Math.max(0, Math.sin(t * 12)) * 0.2 : 0, 0, 0);
      if (m.swing > 0) m.swing -= dt;
      if (m.shotT > 0) m.shotT -= dt;
      if (R.wings) for (const wg of R.wings) rot(wg, 0, (wg.position.x > 0 ? -1 : 1) * (0.4 + Math.sin(t * 9) * 0.35), 0);
      if (R.tail && !Array.isArray(R.tail)) rot(R.tail, Math.sin(t * 2) * 0.15, Math.sin(t * 1.4) * 0.3, 0);
      if (R.flames) R.flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 17 + i * 2) * 0.25, 1 + Math.cos(t * 11 + i) * 0.12); });
      if (R.ring) R.ring.rotation.y += dt * 1.6;
      break;
    }
    case 'bird': {
      for (const L of R.legs) rot(L.u, Math.sin(ph + (L.sx > 0 ? Math.PI : 0)) * A.stride * w, 0, 0);
      shift(R.body, 0, Math.abs(Math.sin(ph)) * 0.03 * w, 0);
      shift(R.head, 0, 0, Math.sin(ph * 2) * 0.05 * w); rot(R.head, m.lookX + (sp < 0.1 && Math.sin(t * 0.7) > 0.8 ? 0.7 : 0), m.lookY, 0);
      const flap = !m.onGround || m.anger > 0;
      for (const wg of R.wings) rot(wg, 0, 0, (wg.position.x > 0 ? -1 : 1) * (flap ? 0.5 + Math.sin(t * 28) * 0.6 : 0));
      break;
    }
    case 'hop': {
      const air = !m.onGround;
      rot(R.body, air ? Math.max(-0.4, Math.min(0.4, -m.vy * 0.07)) : 0, 0, 0);
      for (const L of R.legs) rot(L.u, L.hind ? (air ? 0.9 : 0) : (air ? -0.6 : 0), 0, 0);
      if (R.ears) for (const e of R.ears) rot(e, air ? -0.5 : Math.sin(t * 0.8 + e.position.x * 20) * 0.08, 0, 0);
      if (R.head && R.head !== R.body) rot(R.head, m.lookX, m.lookY, 0);
      if (m.type === 'frog') { const sq = m.onGround ? 1 - Math.max(0, Math.sin(t * 3)) * 0.04 : 1.1; R.body.scale.set(1, sq, 1); }
      break;
    }
    case 'spider': {
      for (const L of R.legs) { const grp = (L.i + (L.sx > 0 ? 1 : 0)) % 2, p2 = ph + grp * Math.PI; rot(L.u, 0, Math.sin(p2) * 0.3 * w, L.sx * Math.max(0, Math.cos(p2)) * 0.35 * w + L.sx * Math.sin(t * 2 + L.i) * 0.02); }
      if (R.abd) rot(R.abd, Math.sin(t * 2) * 0.04, Math.sin(ph) * 0.05 * w, 0);
      shift(R.body, 0, Math.abs(Math.sin(ph * 2)) * 0.03 * w, 0);
      if (R.head && R.head !== R.body) rot(R.head, m.lookX * 0.5, m.lookY * 0.5, 0);
      if (A.scorpion) {
        if (m.swing > 0) m.swing -= dt;
        R.tail.forEach((g, i) => rot(g, (m.swing > 0 ? -0.35 : 0) + Math.sin(t * 2 + i * 0.6) * 0.06, Math.sin(t * 1.3 + i * 0.5) * 0.08, 0));
        for (const a of R.arms) { rot(a.u, 0, a.sx * Math.sin(ph) * 0.15 * w, 0); rot(a.pin, 0, a.sx * (chase ? Math.max(0, Math.sin(t * 7)) * 0.5 : 0.1), 0); }
      }
      break;
    }
    case 'shroom': {
      for (const L of R.legs) rot(L.u, Math.sin(ph + (L.front ? 0 : Math.PI) + (L.sx > 0 ? Math.PI : 0)) * 0.5 * w, 0, 0);
      rot(R.body, 0, 0, Math.sin(ph) * 0.1 * w); rot(R.head, m.lookX * 0.4, m.lookY * 0.5, Math.sin(ph + 0.5) * 0.06 * w);
      const f = m.fuse || 0, sw = 1 + f / 1.5 * 0.28 + (f > 0 ? Math.sin(t * 30) * 0.03 * f : 0);
      m.g.scale.set(m.scale * sw, m.scale * (1 + f / 1.5 * 0.12), m.scale * sw);
      if (f > 0 && Math.random() < dt * 30) emit(m.x + (Math.random() - 0.5), m.y + 1.4, m.z + (Math.random() - 0.5), { vy: 0.6, life: 0.8, size: 0.07, r: 0.8, g: 0.9, b: 0.6, glow: true });
      break;
    }
    case 'fly': {
      const flap = Math.sin(t * A.flap) * A.flapAmp;
      for (const wg of R.wings) { const s = wg.position.x > 0 ? -1 : 1; rot(wg, 0, 0, s * flap * (A.glide ? 0.4 : 1)); if (wg.tip) rot(wg.tip, 0, 0, s * flap * 0.6); }
      shift(R.body, 0, Math.sin(t * 2.5) * (A.hover || 0.1), 0);
      rot(R.body, Math.max(-0.5, Math.min(0.5, -m.vy * 0.05)), 0, A.glide ? Math.sin(t * 0.6) * 0.25 : 0);
      if (R.ring) R.ring.rotation.y += dt * 2;
      if (R.tail) rot(R.tail, Math.sin(t * 2) * 0.15, 0, 0);
      if (R.head && R.head !== R.body) rot(R.head, m.lookX * 0.5, m.lookY * 0.5, 0);
      break;
    }
    case 'float': {
      shift(R.body, 0, Math.sin(t * 2) * (A.hover || 0.1), 0);
      rot(R.body, w * 0.15, 0, 0);
      for (const L of R.legs) rot(L.u, Math.sin(t * 2.2 + L.an) * 0.18 + w * 0.5, 0, Math.cos(t * 1.7 + L.an) * 0.14);
      if (R.arms) for (const a of R.arms) { pose(a.u, (A.arms === 'reach' && chase ? -1.3 : -0.1) + Math.sin(t * 2 + a.sx) * 0.1, 0, a.sx * 0.1, k8); if (a.l) pose(a.l, m.swing > 0 ? -0.8 : -0.2, 0, 0, k8); }
      if (m.swing > 0) m.swing -= dt;
      if (R.ring) R.ring.rotation.y += dt * 1.2;
      if (R.head && R.head !== R.body) rot(R.head, m.lookX, m.lookY, 0);
      break;
    }
    case 'swim': {
      if (R.tail) rot(R.tail, 0, Math.sin(t * (m.anger > 0 ? 22 : 12)) * 0.5, 0);
      if (m.type === 'squid') { const pulse = 0.25 + Math.sin(t * 2.5) * 0.25; for (const L of R.legs) rot(L.u, Math.sin(L.an) * pulse, 0, -Math.cos(L.an) * pulse); }
      rot(R.body, Math.max(-0.6, Math.min(0.6, -m.vy * 0.3)), 0, 0);
      break;
    }
    case 'turtle': {
      for (const L of R.legs) rot(L.u, 0, Math.sin(ph * 1.5 + (L.front ? 0 : Math.PI) + (L.sx > 0 ? Math.PI : 0)) * 0.5 * Math.max(0.2, w), 0);
      rot(R.head, m.lookX * 0.5, m.lookY * 0.5, 0);
      break;
    }
    case 'worm': R.segs.forEach((g, i) => rot(g, 0, Math.sin(t * 10 - i * 0.9) * 0.3 * (0.3 + w), 0)); break;
    case 'slime': {
      m.squash = Math.max(0, (m.squash || 0) - dt * 4);
      const st = m.onGround ? 1 - m.squash * 0.35 + Math.sin(t * 3) * 0.02 : 1 + Math.max(-0.15, Math.min(0.2, m.vy * 0.03));
      R.body.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
      break;
    }
    case 'boss': bossAnimate(m, dt, w, ph); break;
  }
  // blinking
  if (m.lids && m.lids.length) { m.blinkT = (m.blinkT === undefined ? Math.random() * 4 : m.blinkT) - dt; if (m.blinkT <= 0) m.blinkT = 2 + Math.random() * 5; const shut = m.blinkT < 0.13 || (m.grazeK > 0.9 && Math.sin(t * 0.4) > 0.6); for (const l of m.lids) l.visible = shut; }
  if (m.shakeT > 0) { m.shakeT -= dt; m.g.position.set(m.x + (Math.random() - 0.5) * 0.08, m.y, m.z + (Math.random() - 0.5) * 0.08); }
  else m.g.position.set(m.x, m.y, m.z);
  tintMob(m, dt);
  mobParticles(m, dt);
}
function earTwitch(m, dt) {
  const R = m.P; if (!R.ears || !R.ears.length) return;
  m.earT = (m.earT === undefined ? Math.random() * 4 : m.earT) - dt;
  if (m.earT <= 0) { m.earT = 1.5 + Math.random() * 5; m.earE = Math.floor(Math.random() * R.ears.length); m.earK = 0.35; }
  if (m.earK > 0) m.earK -= dt;
  R.ears.forEach((e, i) => rot(e, i === m.earE && m.earK > 0 ? Math.sin(m.earK * 40) * 0.3 : 0, 0, 0));
}
function tintMob(m, dt) {
  const fuse = m.fuse > 0 && Math.sin(m.t * (8 + m.fuse * 14)) > 0.2;
  for (const mt of m.mats) {
    if (m.flash > 0 || m.dying !== undefined && !m.def.boss) mt.color.setRGB(1, 0.32, 0.32);
    else if (fuse) mt.color.setRGB(2, 2, 2);
    else if (mt.userData.emissive) mt.color.setScalar(m.dying !== undefined ? 0.6 + Math.random() * 0.6 : 1);
    else mobTint(mt.color, m);
  }
  if (m.flash > 0) m.flash -= dt;
}
function mobParticles(m, dt) {
  const t = m.trail || (m.P && m.P.particles);
  if (!t || Math.random() > dt * 14) return;
  const s = m.scale;
  if (t === 'shadow') emit(m.x + (Math.random() - 0.5) * 0.5, m.y + Math.random() * m.h, m.z + (Math.random() - 0.5) * 0.5, { vy: 0.4, life: 0.9, size: 0.12, r: 0.12, g: 0.06, b: 0.18, a: 0.8, glow: true });
  else if (t === 'ember') emit(m.x + (Math.random() - 0.5) * 0.6, m.y + Math.random() * m.h, m.z + (Math.random() - 0.5) * 0.6, { vy: 1.4, vx: (Math.random() - 0.5), life: 0.8, size: 0.07, r: 1, g: 0.55, b: 0.15, glow: true });
  else if (t === 'void') { if (Math.random() < 0.4) emit(m.x + (Math.random() - 0.5) * 1.2, m.y + Math.random() * m.h * s, m.z + (Math.random() - 0.5) * 1.2, { vy: -0.3, vx: (Math.random() - 0.5) * 0.6, life: 1.2, size: 0.06, r: 0.75, g: 0.55, b: 1, glow: true }); }
  else emit(m.x + (Math.random() - 0.5) * 0.8, m.y + 0.9 + (Math.random() - 0.5) * 0.6, m.z + (Math.random() - 0.5) * 0.8, { vy: -0.3, life: 0.7, size: 0.07, r: 0.6, g: 0.95, b: 1, glow: true });
}
function updateDying(m, dt) {
  m.dying -= dt;
  if (m.def.boss) { bossDeath(m, dt); return; }
  const k = Math.min(1, (m.dyingMax - m.dying) * 4);
  m.g.rotation.order = 'YXZ';
  m.g.rotation.z = m.fallSide * k * Math.PI / 2 * (m.A.kind === 'fly' || m.A.kind === 'swim' || m.A.kind === 'slime' ? 0 : 1);
  if (m.A.kind === 'fly' || m.A.kind === 'swim') { m.g.rotation.x = Math.PI * k; }
  m.vx *= 0.9; m.vz *= 0.9; m.vy -= 28 * dt; moveBody(m, dt);
  m.g.position.set(m.x, m.y + (m.A.kind === 'quad' || m.A.kind === 'biped' ? k * m.hw * 0.5 : 0), m.z);
  if (m.A.kind === 'slime' && m.P.body) m.P.body.scale.set(1 + k * 0.3, 1 - k * 0.6, 1 + k * 0.3);
  tintMob(m, dt);
  if (m.dying <= 0) {
    const s = m.scale * Math.max(0.6, Math.min(2, m.h));
    burst(m.x, m.y + m.h * m.scale * 0.4, m.z, Math.round(10 + 6 * s), { life: 0.9, size: 0.16 * Math.min(1.5, s), r: 0.92, g: 0.92, b: 0.9, spread: 1.8 * s, up: 1.4, drag: 2 });
    Sound.puff();
    removeMob(m);
  }
}
// ---------------------------------------------------------------- bosses
// Both bosses run a small state machine. Every attack has a readable wind-up, a heavy impact and a recovery
// window in which they take extra damage; enough damage in a short time staggers them to their knees.
function bossState(m, st, dur) { m.st = st; m.stT = 0; m.stDur = dur; m.hitDone = false; m.vuln = st === 'recover' || st === 'stagger'; }
const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
function bossAI(m, dt, P, dx, dz, dist) {
  if (!m.st) bossState(m, 'walk', 1);
  m.stT += dt; m.cd -= dt; m.atk -= dt;
  m.poise = Math.min(70, (m.poise === undefined ? 70 : m.poise) + dt * 5);
  const k = m.stT / m.stDur, fwdX = Math.sin(m.g.rotation.y), fwdZ = Math.cos(m.g.rotation.y);
  let sp = 0, face = true;
  const room = m.room;
  if (m.type === 'warden') {
    const enr = m.hp < m.maxHp * 0.45, fast = enr ? 0.75 : 1;
    if (enr && !m.enraged) { m.enraged = true; bossBanner('The Mirewarden is enraged!', 'Its blows come faster'); Sound.roar(1); }
    switch (m.st) {
      case 'walk':
        sp = dist > 3.3 ? m.def.speed * (enr ? 1.35 : 1) : 0;
        for (const th of [0.66, 0.33]) if (!m['sum' + th] && m.hp < m.maxHp * th) { m['sum' + th] = true; bossState(m, 'roar', 1.6); Sound.roar(1); return bossMove(m, dt, P, dx, dz, dist, 0, true); }
        if (dist < 4.4 && m.atk <= 0 && Math.abs(P.y - m.y) < 3) { bossState(m, 'windup', 0.75 * fast); Sound.growl(); }
        else if (m.cd <= 0) { m.cd = enr ? 4.2 : 6.5; if (dist > 8) bossState(m, 'crouch', 0.55 * fast); else if (enr && Math.random() < 0.5) bossState(m, 'sweepUp', 0.6 * fast); else bossState(m, 'stompUp', 0.7 * fast); Sound.growl(); }
        break;
      case 'windup': { // the blade rises; a glowing mark shows where it will land
        const ix = m.x + fwdX * 3.2, iz = m.z + fwdZ * 3.2;
        if (Math.random() < 0.7) { const a = Math.random() * 6.28; emit(ix + Math.cos(a) * 1.8, m.y + 0.1, iz + Math.sin(a) * 1.8, { life: 0.3, size: 0.14, r: 0.4, g: 1, b: 0.9, glow: true }); }
        if (k < 0.6) face = true; else face = false;
        if (k >= 1) { bossState(m, 'chop', 0.2); Sound.whoosh(); }
        break;
      }
      case 'chop':
        face = false;
        if (k >= 1 && !m.hitDone) {
          m.hitDone = true;
          const ix = m.x + fwdX * 3.2, iz = m.z + fwdZ * 3.2;
          shake(0.7); Sound.slam(); Game.hitStop = 0.06;
          burst(ix, m.y + 0.2, iz, 40, { life: 0.8, size: 0.18, r: 0.35, g: 0.42, b: 0.32, grav: 16, spread: 7, up: 7 });
          burst(ix, m.y + 0.3, iz, 24, { life: 0.5, size: 0.14, r: 0.45, g: 1, b: 0.9, glow: true, spread: 9, up: 3 });
          telegraphs.push({ kind: 'ring', x: ix, y: m.y, z: iz, radius: 2.5, dmg: 4, t0: performance.now(), done: false });
          if (Math.hypot(P.x - ix, P.z - iz) < 2.3 && Math.abs(P.y - m.y) < 3) hurtPlayer(m.def.dmg, null, fwdX * 2.5, fwdZ * 2.5, { mob: m });
          bossState(m, 'recover', 1.0 * fast);
        }
        break;
      case 'recover': face = false; if (k >= 1) { m.atk = enr ? 0.4 : 0.8; bossState(m, 'walk', 1); } break;
      case 'stompUp': if (k >= 1) { shockwave(m.x, m.y, m.z, 10, 6, 0x6ef0d0); Sound.slam(); bossState(m, 'stomp', 0.55); } break;
      case 'stomp': if (k >= 1) bossState(m, 'walk', 1); break;
      case 'crouch': if (k >= 1) { const tt = 0.95; m.vx = dx / tt; m.vz = dz / tt; m.vy = 13.5; bossState(m, 'air', 3); Sound.whoosh(); } break;
      case 'air':
        face = false; sp = -1;
        if (m.onGround && m.stT > 0.25) { m.vx = m.vz = 0; shockwave(m.x, m.y, m.z, 7, 6, 0x6ef0d0); shake(1); Sound.slam(); Game.hitStop = 0.07; if (dist < 3.5 && Math.abs(P.y - m.y) < 3) hurtPlayer(m.def.dmg, null, dx / (dist || 1) * 3, dz / (dist || 1) * 3, { mob: m }); bossState(m, 'recover', 0.85 * fast); }
        break;
      case 'sweepUp': if (k >= 1) { bossState(m, 'sweep', 0.35); Sound.whoosh(); } break;
      case 'sweep':
        face = false;
        if (!m.hitDone && k > 0.5) { m.hitDone = true; const front = (dx * fwdX + dz * fwdZ) / (dist || 1); if (dist < 5.2 && front > -0.2 && Math.abs(P.y - m.y) < 3) hurtPlayer(m.def.dmg * 0.8, null, dx / (dist || 1) * 3, dz / (dist || 1) * 3, { mob: m }); burst(m.x + fwdX * 3, m.y + 1.5, m.z + fwdZ * 3, 20, { life: 0.4, size: 0.12, r: 0.45, g: 1, b: 0.9, glow: true, spread: 8, up: 1 }); }
        if (k >= 1) bossState(m, 'recover', 0.55);
        break;
      case 'roar':
        sp = 0;
        if (!m.hitDone && k > 0.3) {
          m.hitDone = true; shake(0.9); bossBanner('The Mirewarden calls the drowned!', '');
          for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; emit(m.x, m.y + 3.8, m.z, { vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, vy: 0.5, life: 0.7, size: 0.25, r: 0.45, g: 1, b: 0.9, glow: true }); }
          for (let n = 0; n < 2; n++) { const kk = spawnMob('knight', room.x + (n ? 6 : -6), room.y, room.z - 4, { anger: 30 }); burst(kk.x, kk.y + 1, kk.z, 20, { life: 0.8, size: 0.12, r: 0.3, g: 0.6, b: 0.5, spread: 2, up: 3 }); }
        }
        if (k >= 1) bossState(m, 'walk', 1);
        break;
      case 'stagger': sp = 0; face = false; if (k >= 1) bossState(m, 'walk', 1); break;
    }
  } else {
    // colossus: shielded while pylons stand, then the heart awakens
    const alive = room.pylons.filter(p => getB(p[0], p[1], p[2]) === B.ENERGY).length;
    if (alive > 0) m.shield = true;
    else if (m.shield) { m.shield = false; m.phase2 = true; bossState(m, 'roar', 1.8); Sound.roar(1.2); bossBanner('The Heart Awakens', 'Strike the glowing core!'); burst(m.x, m.y + 5, m.z, 60, { life: 1.2, size: 0.25, r: 0.5, g: 0.95, b: 1, glow: true, spread: 10, up: 6 }); }
    const fast = m.phase2 ? 0.75 : 1;
    switch (m.st) {
      case 'walk':
        sp = dist > 5 ? m.def.speed * (m.phase2 ? 1.25 : 1) : 0;
        if (dist < 5.8 && m.atk <= 0) { bossState(m, 'punchUp', 0.6 * fast); Sound.growl(); }
        else if (m.cd <= 0) {
          const r = Math.random(); m.cd = m.phase2 ? 3.2 : 5;
          if (r < 0.45) bossState(m, 'slamUp', 0.9 * fast); else if (r < 0.75 || !m.phase2) bossState(m, 'spikesUp', 0.7 * fast); else bossState(m, 'orbs', 1.0);
          Sound.growl();
        }
        break;
      case 'punchUp': if (k >= 1) { bossState(m, 'punch', 0.22); Sound.whoosh(); } break;
      case 'punch':
        face = false;
        if (k >= 1 && !m.hitDone) { m.hitDone = true; shake(0.5); Sound.slam(); const ix = m.x + fwdX * 4.5, iz = m.z + fwdZ * 4.5; burst(ix, m.y + 0.3, iz, 30, { life: 0.7, size: 0.2, r: 0.5, g: 0.52, b: 0.58, grav: 16, spread: 7, up: 6 }); if (Math.hypot(P.x - ix, P.z - iz) < 3 && Math.abs(P.y - m.y) < 3) hurtPlayer(m.def.dmg, null, fwdX * 3, fwdZ * 3, { mob: m }); bossState(m, 'recover', 0.9 * fast); }
        break;
      case 'slamUp': if (k >= 1) { bossState(m, 'slam', 0.25); Sound.whoosh(); } break;
      case 'slam': face = false; if (k >= 1 && !m.hitDone) { m.hitDone = true; shockwave(m.x, m.y, m.z, m.phase2 ? 16 : 15, 8, 0x9af0ff); Sound.slam(); Game.hitStop = 0.07; bossState(m, 'recover', 1.0 * fast); } break;
      case 'spikesUp': if (k >= 1) { spikeField(P, m.phase2 ? 6 : 4); Sound.slam(); shake(0.4); bossState(m, 'stomp', 0.5); } break;
      case 'stomp': if (k >= 1) bossState(m, 'walk', 1); break;
      case 'orbs':
        if (!m.hitDone && k > 0.6) { m.hitDone = true; for (let n = -1; n <= 1; n++) { const a = Math.atan2(dx, dz) + n * 0.4; shoot('orb', m.x, m.y + 5.5, m.z, Math.sin(a) * 9, 1, Math.cos(a) * 9, 7, 'mob', { home: 0.8, life: 5, src: m }); } Sound.zap(); }
        if (k >= 1) bossState(m, 'walk', 1);
        break;
      case 'recover': face = false; if (k >= 1) { m.atk = 1.2; bossState(m, 'walk', 1); } break;
      case 'roar': sp = 0; if (!m.hitDone && k > 0.3) { m.hitDone = true; shake(1); } if (k >= 1) bossState(m, 'walk', 1); break;
      case 'stagger': sp = 0; face = false; if (k >= 1) bossState(m, 'walk', 1); break;
      default: bossState(m, 'walk', 1);
    }
  }
  bossMove(m, dt, P, dx, dz, dist, sp, face);
}
function bossMove(m, dt, P, dx, dz, dist, sp, face) {
  if (face) m.face = Math.atan2(dx, dz);
  if (sp >= 0) { m.vx = dx / (dist || 1) * sp; m.vz = dz / (dist || 1) * sp; }
  const wasAir = !m.onGround;
  moveBody(m, dt);
  m.vy -= 28 * dt;
  if (wasAir && m.onGround && m.st === 'walk') shake(0.1);
  const room = m.room, rd = Math.hypot(m.x - room.x, m.z - room.z);
  if (rd > room.r) { m.x = room.x + (m.x - room.x) / rd * room.r; m.z = room.z + (m.z - room.z) / rd * room.r; }
  // heavy footsteps
  const step = Math.floor(m.phase / Math.PI);
  if (step !== m.lastStep && Math.hypot(m.vx, m.vz) > 0.5 && m.onGround) { m.lastStep = step; Sound.slam(0.25); shake(m.type === 'colossus' ? 0.25 : 0.12); }
}
function bossAnimate(m, dt, w, ph) {
  const R = m.P, t = m.t, k = Math.min(1, m.stT / m.stDur), kk = Math.min(1, dt * 12), st = m.st || 'walk';
  const big = m.type === 'colossus';
  // legs: heavy walk, bracing for attacks, kneeling when staggered
  let crouch = 0;
  if (st === 'crouch' || st === 'stompUp' || st === 'slamUp') crouch = ease(k);
  if (st === 'recover' || st === 'stomp') crouch = 0.6 * (1 - k);
  if (st === 'air') crouch = 0.3;
  if (st === 'stagger') crouch = 1.2;
  for (const L of R.legs) {
    const s = Math.sin(ph + (L.sx > 0 ? Math.PI : 0)) * 0.45 * w;
    const kneel = st === 'stagger' && L.sx < 0 ? 1.4 : 0;
    pose(L.u, s - crouch * 0.55 - kneel * 0.6, 0, L.sx * (st === 'air' ? 0.15 : 0.04), kk);
    pose(L.l, Math.max(0, -Math.cos(ph + (L.sx > 0 ? Math.PI : 0))) * 0.5 * w + crouch * 0.9 + kneel * 1.3, 0, 0, kk);
  }
  shift(R.body, 0, -crouch * (big ? 1.1 : 0.55) + (1 - Math.cos(ph * 2)) * 0.06 * w, 0, kk);
  // torso: lean into blows, rear back to roar
  let cx = Math.sin(t * 1.6) * 0.03, cz = Math.sin(ph) * 0.06 * w, cy = 0;
  if (st === 'windup' || st === 'punchUp' || st === 'slamUp') cx = -0.25 * ease(k);
  if (st === 'chop' || st === 'punch' || st === 'slam') cx = 0.35;
  if (st === 'recover') cx = 0.35 * (1 - k * 0.6);
  if (st === 'roar') cx = -0.35 * Math.sin(k * Math.PI);
  if (st === 'stagger') cx = 0.45;
  if (st === 'sweepUp') { cy = 0.7 * ease(k); }
  if (st === 'sweep') { cy = 0.7 - 1.6 * ease(k); }
  if (st === 'orbs') cx = -0.2 * Math.sin(k * Math.PI);
  pose(R.chest, cx, cy, cz, kk);
  R.chest.scale.y = 1 + Math.sin(t * (st === 'recover' || st === 'stagger' ? 5 : 2)) * (st === 'stagger' ? 0.025 : 0.012);
  // arms
  const [aL, aR] = R.arms;
  let lx = -Math.sin(ph) * 0.35 * w, rx = Math.sin(ph) * 0.35 * w - 0.3, lz = -0.12, rz = 0.12, ry = 0, le = -0.3, re = -0.5;
  switch (st) {
    case 'windup': rx = -2.7 * ease(k); re = -0.6; rz = 0.1; break;
    case 'chop': rx = -2.7 + 3.3 * ease(k); re = -0.1; break;
    case 'recover': rx = big ? -1.2 : 0.5; re = 0; lx = big ? -1.2 : lx; break;
    case 'stompUp': case 'slamUp': lx = rx = -2.6 * ease(k); le = re = -0.3; break;
    case 'stomp': case 'slam': lx = rx = -2.6 + 2.2 * ease(k); break;
    case 'crouch': lx = rx = 0.6 * ease(k); break;
    case 'air': lx = rx = -2.2; le = re = -0.4; break;
    case 'sweepUp': rx = -1.5; rz = 1.0 * ease(k); break;
    case 'sweep': rx = -1.5; rz = 1.0 - 1.6 * ease(k); ry = 0; break;
    case 'roar': lz = -1.1 * Math.sin(k * Math.PI); rz = 1.1 * Math.sin(k * Math.PI); lx = rx = -0.6 * Math.sin(k * Math.PI); break;
    case 'stagger': lx = rx = 0.4; le = re = -0.1; lz = -0.3; rz = 0.3; break;
    case 'punchUp': rx = -1.4; re = -1.6 * ease(k); rz = 0.3; break;
    case 'punch': rx = -1.6; re = -1.6 + 1.6 * ease(k); break;
    case 'spikesUp': lx = -2.4 * ease(k); break;
    case 'orbs': lz = -1.0 * ease(k); rz = 1.0 * ease(k); lx = rx = -0.8; break;
  }
  pose(aL.u, lx, 0, lz, kk); pose(aL.l, le, 0, 0, kk);
  pose(aR.u, rx, ry, rz, kk); pose(aR.l, re, 0, 0, kk);
  // head and jaw
  let hx = Math.sin(t * 0.9) * 0.05, jaw = 0.05 + Math.max(0, Math.sin(t * 1.3)) * 0.05;
  if (st === 'roar') { hx = -0.5 * Math.sin(k * Math.PI); jaw = 0.7 * Math.sin(k * Math.PI); }
  if (st === 'windup' || st === 'slamUp' || st === 'punchUp') { jaw = 0.35; hx = -0.15; }
  if (st === 'chop' || st === 'slam' || st === 'punch') jaw = 0.5;
  if (st === 'stagger') { hx = 0.5; jaw = 0.3; }
  if (st === 'recover') jaw = 0.25 + Math.sin(t * 6) * 0.05;
  const rel = wrapA(Math.atan2(Player.x - m.x, Player.z - m.z) - m.g.rotation.y);
  pose(R.head, hx, Math.max(-0.6, Math.min(0.6, rel)) * (st === 'walk' ? 1 : 0.3), 0, kk);
  pose(R.jaw, jaw, 0, 0, kk);
  // living details: drapes and kelp sway, the core pulses
  if (R.drapes) R.drapes.forEach((d, i) => rot(d, Math.sin(t * 1.8 + i) * 0.12 + w * 0.25, 0, Math.cos(t * 1.4 + i * 1.7) * 0.1));
  if (R.kelp) R.kelp.forEach((d, i) => rot(d, -0.3 + Math.sin(t * 1.5 + i * 0.8) * 0.2 - w * 0.2, 0, Math.cos(t * 1.2 + i) * 0.15));
  const pulse = 1 + Math.sin(t * (m.enraged || m.phase2 ? 9 : 4)) * 0.12 + (st === 'windup' || st === 'slamUp' ? ease(k) * 0.4 : 0);
  if (R.core) R.core.scale.set(pulse, pulse, 1);
  if (R.plate) R.plate.visible = !!m.shield;
  if ((m.enraged || m.phase2) && Math.random() < dt * 20) { const e = new THREE.Vector3(); R.core.getWorldPosition(e); emit(e.x, e.y, e.z, { vy: 1.5, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, life: 0.8, size: 0.12, r: 0.45, g: 1, b: 0.95, glow: true }); }
  if (st === 'stagger' && Math.random() < dt * 10) emit(m.x + (Math.random() - 0.5) * 2, m.y + 4.5 * (big ? 1.7 : 1), m.z + (Math.random() - 0.5) * 2, { vy: 0.5, life: 0.6, size: 0.14, r: 1, g: 0.95, b: 0.5, glow: true });
}
function bossDeath(m, dt) {
  const T = m.dyingMax - m.dying, k = T / m.dyingMax, R = m.P, kk = Math.min(1, dt * 6), big = m.type === 'colossus';
  m.g.rotation.order = 'YXZ';
  // stagger back, drop to the knees, fall forward, crumble
  for (const L of R.legs) { pose(L.u, k > 0.25 ? -1.3 : 0.2, 0, L.sx * 0.1, kk); pose(L.l, k > 0.25 ? 1.9 : 0.2, 0, 0, kk); }
  shift(R.body, 0, k > 0.25 ? -(big ? 2.4 : 1.25) : 0, 0, kk);
  pose(R.chest, k < 0.25 ? -0.35 : 0.6, 0, Math.sin(T * 3) * 0.05, kk);
  for (const a of R.arms) { pose(a.u, k < 0.25 ? -0.6 : 0.3, 0, a.sx * (k < 0.25 ? 0.8 : 0.2), kk); pose(a.l, -0.1, 0, 0, kk); }
  pose(R.head, k < 0.25 ? -0.6 : 0.5, 0, 0, kk); pose(R.jaw, 0.6, 0, 0, kk);
  if (k > 0.55) m.g.rotation.x += (1.25 - m.g.rotation.x) * Math.min(1, dt * 3);
  if (k > 0.78) { const s = Math.max(0.05, 1 - (k - 0.78) / 0.22); m.g.scale.setScalar(s); }
  if (R.core) { const f = Math.random() < 0.5 ? 0.6 : 1.3; R.core.scale.set(f, f, 1); }
  if (Math.random() < dt * 25) { const c = new THREE.Color(m.def.chip); emit(m.x + (Math.random() - 0.5) * 3 * (big ? 2 : 1), m.y + Math.random() * m.h * (1 - k), m.z + (Math.random() - 0.5) * 3 * (big ? 2 : 1), { vy: 2 + Math.random() * 3, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, life: 1, size: 0.18, r: c.r * 0.6, g: c.g * 0.6, b: c.b * 0.6, grav: 12 }); }
  if (Math.random() < dt * 12) emit(m.x + (Math.random() - 0.5) * 2, m.y + Math.random() * m.h * 0.7, m.z + (Math.random() - 0.5) * 2, { vy: 2, life: 1, size: 0.15, r: 0.45, g: 1, b: 0.95, glow: true });
  if (!m.thud && k > 0.6) { m.thud = true; shake(1.2); Sound.slam(1); }
  if (!m.crumbled && k > 0.8) { m.crumbled = true; Sound.crumble(); shake(0.8); burst(m.x, m.y + 1, m.z, 80, { life: 1.6, size: 0.3, r: 0.5, g: 0.55, b: 0.5, grav: 10, spread: big ? 14 : 9, up: 8 }); burst(m.x, m.y + 2, m.z, 60, { life: 1.4, size: 0.2, r: 0.45, g: 1, b: 0.95, glow: true, spread: 10, up: 6 }); }
  m.g.position.set(m.x, m.y, m.z);
  tintMob(m, dt);
  if (m.dying <= 0) removeMob(m);
}
const telegraphs = [];
function shockwave(x, y, z, radius, dmg, color) {
  shake(0.6);
  const c = new THREE.Color(color);
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; emit(x, y + 0.2, z, { vx: Math.cos(a) * radius * 1.4, vz: Math.sin(a) * radius * 1.4, vy: 0.5, life: 0.7, size: 0.3, r: c.r, g: c.g, b: c.b, glow: true }); }
  const t0 = performance.now();
  telegraphs.push({ kind: 'ring', x, y, z, radius, dmg, t0, done: false });
}
function spikeField(P, n) {
  for (let k = 0; k < n; k++) {
    const x = P.x + (k ? (Math.random() - 0.5) * 8 : 0), z = P.z + (k ? (Math.random() - 0.5) * 8 : 0);
    telegraphs.push({ kind: 'spike', x, z, y: P.y, t: 1.1, done: false });
  }
}
function updateTelegraphs(dt, P) {
  for (let i = telegraphs.length - 1; i >= 0; i--) {
    const t = telegraphs[i];
    if (t.kind === 'ring') {
      const el = (performance.now() - t.t0) / 1000, R = el * t.radius * 1.4;
      if (!t.done && P.onGround && Math.abs(Math.hypot(P.x - t.x, P.z - t.z) - R) < 1.0 && Math.abs(P.y - t.y) < 2) { t.done = true; hurtPlayer(t.dmg, null, (P.x - t.x) / R, (P.z - t.z) / R, { mob: ActiveBoss, how: 'shockwave' }); P.vy = 7; }
      if (el > 0.75) telegraphs.splice(i, 1);
    } else {
      t.t -= dt;
      if (Math.random() < 0.6) { const a = Math.random() * 6.28; emit(t.x + Math.cos(a) * 1.2, t.y + 0.1, t.z + Math.sin(a) * 1.2, { life: 0.3, size: 0.12, r: 1, g: 0.3, b: 0.2, glow: true }); }
      if (t.t <= 0) {
        for (let k = 0; k < 20; k++) emit(t.x + (Math.random() - 0.5) * 1.4, t.y, t.z + (Math.random() - 0.5) * 1.4, { vy: 9 + Math.random() * 4, life: 0.5, size: 0.18, r: 0.6, g: 0.95, b: 1, glow: true, grav: 20 });
        if (Math.hypot(P.x - t.x, P.z - t.z) < 1.5 && Math.abs(P.y - t.y) < 2) { hurtPlayer(7, null, 0, 0, { mob: ActiveBoss, how: 'spikes' }); P.vy = 9; }
        telegraphs.splice(i, 1);
      }
    }
  }
}
function startBoss(room) {
  if (ActiveBoss || room.done) return;
  const m = spawnMob(room.type, room.x + 0.5, room.y, room.z + 0.5, { room });
  if (room.type === 'colossus') { m.shield = true; for (const p of room.pylons) Emitters.push({ x: p[0] + 0.5, y: p[1] + 6, z: p[2] + 0.5, type: 'sparkle' }); }
  ActiveBoss = m;
  bossBanner(room.name, room.sub);
  shake(0.8);
}
function onBossDefeated(m) {
  const room = m.room; room.done = true; ActiveBoss = null;
  Quests.event('boss', m.type);
  Game.save && Game.save();
  if (m.type === 'warden') {
    bossBanner('Warden Defeated', 'The Deepseal Key is yours');
    setB(Math.floor(room.x), room.y, Math.floor(room.z), B.CHEST, 2); Chests.set(K(Math.floor(room.x), room.y, Math.floor(room.z)), { table: 'warden', items: null });
    blockChanged(Math.floor(room.x), room.y, Math.floor(room.z));
  } else {
    bossBanner('The Colossus Has Fallen', 'The Heart of the Buried World is yours');
    setB(Math.floor(room.x), room.y, Math.floor(room.z) + 3, B.CHEST, 0); Chests.set(K(Math.floor(room.x), room.y, Math.floor(room.z) + 3), { table: 'hoard', items: null });
    blockChanged(Math.floor(room.x), room.y, Math.floor(room.z) + 3);
    const p = Game.halls && Game.halls.portal;
    if (p) {
      for (let dy = 0; dy < 4; dy++) for (let dx = -1; dx <= 1; dx++) { const edge = dy === 0 || dy === 3 || Math.abs(dx) === 1; setBlockLogged(p[0] + dx, p[1] + dy, p[2], edge ? B.ANCIENT_GOLD : B.PORTAL); }
      setBlockLogged(p[0] - 2, p[1], p[2], B.ANCIENT_GOLD); setBlockLogged(p[0] + 2, p[1], p[2], B.ANCIENT_GOLD);
      Portals.push({ x: p[0], y: p[1] + 1, z: p[2], to: Game.halls.exit });
      toast('A portal opens. Step through to return to the surface.', 5000);
    }
  }
}

// ---------------------------------------------------------------- spawning
// biome tables ('type:variant'); the night list adds to the day list after dark
const BIOME_SPAWNS = [
  { day: ['cow', 'cow', 'sheep', 'sheep', 'pig', 'chicken', 'chicken', 'horse', 'rabbit', 'deer', 'boar', 'bee'], night: ['zombie', 'zombie', 'skeleton', 'skeleton', 'spider', 'boomshroom', 'boomshroom', 'shade', 'stalker', 'raider', 'glider'] },
  { day: ['deer', 'deer', 'wolf', 'fox', 'fox', 'bear', 'rabbit', 'pig', 'boar', 'sheep'], night: ['zombie', 'skeleton', 'spider', 'spider', 'boomshroom', 'shade', 'shade', 'stalker'] },
  { day: ['frog', 'frog', 'frog', 'slime', 'turtle', 'cow'], night: ['witch', 'slime', 'slime', 'skeleton:2', 'zombie', 'shade', 'boomshroom'] },
  { day: ['camel', 'camel', 'rabbit:4', 'crawler'], night: ['zombie:1', 'zombie:1', 'crawler', 'crawler', 'skeleton', 'spider', 'boomshroom'] },
  { day: ['goat', 'goat', 'golem', 'wisp', 'rabbit:2', 'wolf', 'fox:3'], night: ['skeleton:1', 'skeleton:1', 'golem', 'wisp', 'stalker', 'spider', 'glider'] },
  { day: ['elemental', 'imp', 'magma_slime', 'skeleton:3', 'wraith'], night: ['elemental', 'imp', 'magma_slime', 'skeleton:3', 'wraith'] },
];
const CAVE_SPAWNS = ['bat', 'bat', 'cave_spider', 'skeleton', 'zombie', 'mite', 'mite', 'spider'];
const GROUP = { cow: [2, 3], sheep: [2, 4], pig: [2, 3], chicken: [2, 4], horse: [2, 3], goat: [2, 3], wolf: [2, 3], deer: [1, 2], bee: [2, 3], raider: [2, 3], camel: [1, 2], frog: [2, 3], fish: [3, 5], bat: [1, 3], mite: [2, 3], rabbit: [1, 2] };
let spawnTimer = 0, villageTimer = 0, waterTimer = 0;
function parseSpawn(s) { const [type, v] = s.split(':'); return { type, extra: v !== undefined ? { variant: +v } : undefined }; }
function findDark(P) { // a dark cave floor near the player
  for (let tries = 0; tries < 10; tries++) {
    const x = Math.floor(P.x + (Math.random() - 0.5) * 36), z = Math.floor(P.z + (Math.random() - 0.5) * 36);
    if (Math.hypot(x - P.x, z - P.z) < 10 || !resident(x, z)) continue;
    for (let y = Math.floor(P.y) - 8; y < P.y + 8; y++) {
      if (!SOLID[getB(x, y - 1, z)] || getB(x, y, z) !== 0 || getB(x, y + 1, z) !== 0) continue;
      const L = lightAt(x, y, z); if (L[0] < 4 && L[1] < 6) return [x, y, z];
    }
  }
  return null;
}
function updateSpawning(dt, P) {
  if (Game.mode === 'parkour') return; // the course is for jumping, not fighting
  spawnTimer -= dt; villageTimer -= dt; waterTimer -= dt;
  // structure spawn points
  for (const sp of SpawnPoints) {
    const d = Math.hypot(sp.x - P.x, sp.z - P.z);
    sp.cool -= dt;
    if (d < 40 && sp.alive.length < sp.n && sp.cool <= 0) {
      sp.cool = sp.alive.length === 0 && !sp.first ? 0 : 25; sp.first = true;
      for (let k = 0; k < 6 && sp.alive.length < sp.n; k++) {
        const x = sp.x + (Math.random() - 0.5) * sp.r * 2, z = sp.z + (Math.random() - 0.5) * sp.r * 2;
        let y = sp.y; while (y < H - 2 && collides(x, y, z, 0.4, 2.2)) y++;
        if (y - sp.y > 4) continue;
        const m = spawnMob(sp.type, x, y, z, { spawn: sp }); sp.alive.push(m);
      }
    }
  }
  // villages keep their villagers, a cat or two and a guardian
  if (villageTimer <= 0) {
    villageTimer = 2;
    for (const s of Sites) {
      if (s.cat !== 'village' || Math.hypot(s.x - P.x, s.z - P.z) > 70) continue;
      const res = Mobs.filter(m => m.home === s && !m.dead);
      for (const [type, want] of [['villager', 5], ['cat', 2], ['guardian', 1], ['chicken', 3]]) {
        if (res.filter(m => m.type === type).length >= want) continue;
        for (let tries = 0; tries < 8; tries++) {
          const a = Math.random() * 6.28, r = Math.random() * s.r * 0.6, x = Math.floor(s.x + Math.cos(a) * r), z = Math.floor(s.z + Math.sin(a) * r);
          if (!resident(x, z) || Math.hypot(x - P.x, z - P.z) < 8) continue;
          const y = groundY(x, z) + 1, def = MOBDEF[type];
          if (getB(x, y - 1, z) === B.WATER || collides(x + 0.5, y, z + 0.5, def.hw, def.h)) continue;
          spawnMob(type, x + 0.5, y, z + 0.5, { home: s }); break;
        }
        break;
      }
    }
  }
  // fish and squid in nearby water
  if (waterTimer <= 0) {
    waterTimer = 3;
    if (Mobs.filter(m => m.def.swim).length < 8) {
      const a = Math.random() * 6.28, r = 12 + Math.random() * 18, x = Math.floor(P.x + Math.cos(a) * r), z = Math.floor(P.z + Math.sin(a) * r);
      if (resident(x, z)) {
        let y = groundY(x, z) + 1, depth = 0; while (getB(x, y + depth, z) === B.WATER) depth++;
        if (depth >= 2) { const type = Math.random() < 0.3 ? 'squid' : 'fish', [lo, hi] = GROUP[type] || [1, 1], n = lo + Math.floor(Math.random() * (hi - lo + 1)), v = Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) spawnMob(type, x + 0.5 + (Math.random() - 0.5), y + 0.3, z + 0.5 + (Math.random() - 0.5), { variant: v }); }
      }
    }
  }
  if (spawnTimer > 0) return;
  spawnTimer = 1.1;
  const bi = bmap[COL(Math.floor(P.x), Math.floor(P.z))], tab = BIOME_SPAWNS[bi] || BIOME_SPAWNS[0];
  const night = U.uDay.value < 0.45;
  const wild = Mobs.filter(m => !m.spawn && !m.def.boss && !m.home && !m.def.swim && !m.dead);
  const hostiles = wild.filter(m => !m.def.passive).length, passives = wild.length - hostiles;
  // underground: bats, cave spiders, mites and the restless dead
  const underground = lightAt(P.x, P.y + 1.6, P.z)[0] < 5 && P.y < surfaceY(Math.floor(P.x), Math.floor(P.z)) - 4;
  if (underground && Math.random() < 0.6) {
    if (hostiles >= 14) return;
    const spot = findDark(P); if (!spot) return;
    const type = CAVE_SPAWNS[Math.floor(Math.random() * CAVE_SPAWNS.length)], def = MOBDEF[type];
    if (collides(spot[0] + 0.5, spot[1], spot[2] + 0.5, def.hw, def.h)) return;
    const [lo, hi] = GROUP[type] || [1, 1], n = lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let k = 0; k < n; k++) spawnMob(type, spot[0] + 0.5 + k * 0.4, spot[1], spot[2] + 0.5);
    return;
  }
  const list = night ? tab.night.concat(tab.day) : tab.day;
  const { type, extra } = parseSpawn(list[Math.floor(Math.random() * list.length)]);
  const def = MOBDEF[type], hostile = !def.passive;
  if (hostile ? hostiles >= (night ? 18 : 8) : passives >= 14) return;
  if (hostile && !night && bi < 3 && (type === 'shade')) return;
  const a = Math.random() * 6.283, r = 24 + Math.random() * 26;
  const x = Math.floor(P.x + Math.cos(a) * r), z = Math.floor(P.z + Math.sin(a) * r);
  if (!resident(x, z) || bmap[COL(x, z)] !== bi) return;
  const y = groundY(x, z);
  const top = getB(x, y, z);
  if (top === B.WATER || top === B.LAVA || !SOLID[top]) return;
  if (type === 'turtle' && top !== B.SAND) return;
  if (hostile && Sites.some(s => s.cat === 'village' && Math.hypot(s.x - x, s.z - z) < s.r + 4)) return;
  const L = lightAt(x, y + 1, z);
  if (hostile && L[1] > 7) return;
  if (def.fly && type === 'glider' && Math.random() < 0.6) return;
  if (collides(x + 0.5, y + 1, z + 0.5, def.hw, def.h)) return;
  const [lo, hi] = type === 'crawler' && night ? [3, 3] : (GROUP[type] || [1, 1]), n = lo + Math.floor(Math.random() * (hi - lo + 1));
  const variant = extra ? extra.variant : def.variants ? Math.floor(Math.random() * def.variants) : 0;
  for (let k = 0; k < n; k++) {
    const ox = x + 0.5 + (k ? (Math.random() - 0.5) * 3 : 0), oz = z + 0.5 + (k ? (Math.random() - 0.5) * 3 : 0);
    const oy = groundY(Math.floor(ox), Math.floor(oz)) + 1;
    if (Math.abs(oy - y - 1) > 2 || collides(ox, oy, oz, def.hw, def.h)) continue;
    spawnMob(type, ox, oy + (def.fly ? 2 : 0), oz, Object.assign({ variant: GROUP[type] && type !== 'wolf' ? variant : (extra ? extra.variant : undefined) }, k && Math.random() < 0.25 && def.breed ? { baby: true } : {}));
  }
}

// ---------------------------------------------------------------- windmills
const windmillMeshes = [];
function buildWindmills() {
  const mat = new THREE.MeshBasicMaterial({ map: (() => { const t = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const [sx, sy] = tileXY('planks'); g.drawImage(Atlas.canvas, sx, sy, 16, 16, 0, 0, 16, 16); return c; })()); t.magFilter = THREE.NearestFilter; return t; })() });
  const sail = new THREE.MeshBasicMaterial({ color: 0xe8e0cc, side: THREE.DoubleSide });
  for (const w of Windmills) {
    const g = new THREE.Group(); g.position.set(w.x, w.y, w.z);
    const rot = new THREE.Group(); g.add(rot);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; rot.add(arm);
      box(arm, 0.35, 7.5, 0.25, 0, 3.9, 0, mat);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 6), sail); s.position.set(0.95, 4.2, 0.05); arm.add(s);
    }
    box(rot, 0.8, 0.8, 0.8, 0, 0, 0, mat);
    g.rotation.y = -w.r * Math.PI / 2;
    g.traverse(o => o.layers.enable(1)); scene.add(g); windmillMeshes.push({ g, rot });
  }
}
function updateWindmills(dt) { for (const w of windmillMeshes) w.rot.rotation.z += dt * 0.6; }
