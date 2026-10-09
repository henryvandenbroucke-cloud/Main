'use strict';
/* Things hung on walls and stood on the floor: paintings (the placed one is a random pick among the largest
   variants that fit the wall, like the game; the pictures are painted in code), item frames and glow item
   frames (hold an item, turn it in 8 steps, a comparator behind reads the turn), armor stands (wear armour
   put on them, break with two quick hits) and the armour layers drawn on players, mobs and stands.
   Hanging things check every 100 ticks that the wall behind them is still there, like the game. */
const PaintingArt = (() => {
  const cache = new Map();
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  // a small picture for each variant, w x h blocks at 16 pixels per block
  function canvas(name, w, h) {
    const k = name + w + 'x' + h; if (cache.has(k)) return cache.get(k);
    const W = w * 16, H = h * 16, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), r = new Rand(hash(name));
    const pal = [['#2b4a6b', '#6aa0c8', '#d8c070', '#5a7a30', '#3a2a1a'], ['#5a2a1a', '#c86a3a', '#e8c890', '#2a1a10', '#8a5a3a'], ['#1a2a3a', '#3a5a7a', '#a0b8c8', '#d0d8e0', '#506070'],
      ['#3a1a3a', '#8a3a6a', '#e09ab0', '#f0e0c0', '#5a2a4a'], ['#1a3a1a', '#4a7a3a', '#9ac85a', '#e0e8a0', '#2a2a1a'], ['#4a3a20', '#a08040', '#e0d090', '#605030', '#2a2010']][r.int(6)];
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const style = r.int(4);
    // background: sky gradient bands or a flat field with noise
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let col;
      if (style === 0) col = y < H * 0.55 ? (y < H * 0.25 ? pal[0] : pal[1]) : (y < H * 0.75 ? pal[3] : pal[4]);
      else if (style === 1) col = pal[(Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 0 : 4];
      else if (style === 2) col = pal[Math.min(4, Math.floor((x + y) / (W + H) * 5))];
      else col = pal[0];
      px(x, y, col);
      if (r.next() < 0.12) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 1, 1); }
    }
    // shapes: a sun or moon, figures, blocks of colour
    const n = 2 + r.int(4);
    for (let i = 0; i < n; i++) {
      const kind = r.int(3), cx = r.int(W), cy = r.int(H), s = 2 + r.int(Math.max(2, Math.min(W, H) / 3));
      g.fillStyle = pal[1 + r.int(4)];
      if (kind === 0) { for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) if (x * x + y * y <= s * s) g.fillRect(cx + x, cy + y, 1, 1); }
      else if (kind === 1) { g.fillRect(cx - 1, cy - s, 3, s * 2); g.fillRect(cx - 2, cy - s - 3, 5, 4); g.fillRect(cx - s / 2, cy - s / 2, s, 2); }
      else g.fillRect(cx - s, cy - s / 2, s * 2, s);
    }
    // the frame painted into the picture's edge
    g.fillStyle = '#4a3420'; g.fillRect(0, 0, W, 1); g.fillRect(0, H - 1, W, 1); g.fillRect(0, 0, 1, H); g.fillRect(W - 1, 0, 1, H);
    g.fillStyle = '#7a5a34'; g.fillRect(1, 1, W - 2, 1); g.fillRect(1, H - 2, W - 2, 1); g.fillRect(1, 1, 1, H - 2); g.fillRect(W - 2, 1, 1, H - 2);
    cache.set(k, c);
    return c;
  }
  let backCanvas = null;
  function back() {
    if (backCanvas) return backCanvas;
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 0.85 + ((x * 7 + y * 13) % 5) * 0.03 - (y % 4 === 3 ? 0.18 : 0); g.fillStyle = `rgb(${Math.round(160 * v)},${Math.round(122 * v)},${Math.round(76 * v)})`; g.fillRect(x, y, 1, 1); }
    return (backCanvas = c);
  }
  return { canvas, back };
})();

const CCW = { 2: 4, 3: 5, 4: 3, 5: 2 }; // the direction to the left of one facing out of a wall
class HangingEntity extends Entity {
  constructor(type, bx, by, bz, face) { super(type, bx + 0.5, by, bz + 0.5); this.bx = bx; this.by = by; this.bz = bz; this.face = face; this.check = 0; this.noGravity = true; this.w = 0.5; this.h = 0.5; }
  // the thin box against the wall: centre c, size along x, y, z
  box() { const [cx, cy, cz] = this.centre(), [sx, sy, sz] = this.size(); return [cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2]; }
  bb() { return this.box(); }
  pickBox() { return this.box(); }
  // the blocks behind it must be solid, the space it takes free, and nothing else hanging there
  survives() {
    const b = this.box(), f = this.face, eps = 0.01;
    const sb = [b[0] - DX[f] * 0.5 + eps, b[1] - DY[f] * 0.5 + eps, b[2] - DZ[f] * 0.5 + eps, b[3] - DX[f] * 0.5 - eps, b[4] - DY[f] * 0.5 - eps, b[5] - DZ[f] * 0.5 - eps];
    for (let x = Math.floor(sb[0]); x <= Math.floor(sb[3]); x++) for (let y = Math.floor(sb[1]); y <= Math.floor(sb[4]); y++) for (let z = Math.floor(sb[2]); z <= Math.floor(sb[5]); z++) {
      const id = World.getBlock(x, y, z); if (!SOLID[id] && BLOCKS[id].model !== 'repeater' && BLOCKS[id].model !== 'comparator') return false;
    }
    if (!Phys.boxFree(b[0] + eps, b[1] + eps, b[2] + eps, b[3] - eps, b[4] - eps, b[5] - eps)) return false;
    for (const e of Entities.list) if (e !== this && !e.removed && e instanceof HangingEntity && e.type !== 'leash_knot' && e.intersects([b[0] + eps, b[1] + eps, b[2] + eps, b[3] - eps, b[4] - eps, b[5] - eps])) return false;
    return true;
  }
  tick() {
    this.px = this.x; this.py = this.y; this.pz = this.z; this.age++;
    if (++this.check >= 100) { this.check = 0; if (!this.survives()) { this.removed = true; this.dropSelf(); } }
  }
  dropSelf() { if (Game.rules.doEntityDrops) Drops.spawnItem(this.x, this.y, this.z, stack(this.type === 'glow_item_frame' ? 'glow_item_frame' : this.type)); }
}
class Painting extends HangingEntity {
  constructor(bx, by, bz, face, variant) { super('painting', bx, by, bz, face); this.setVariant(variant || 'kebab'); }
  setVariant(v) { this.variant = v; const d = MCDATA.paintings[v] || [1, 1]; this.pw = d[0]; this.ph = d[1]; const c = this.centre(); this.x = c[0]; this.y = c[1] - this.ph / 2; this.z = c[2]; }
  centre() {
    const f = this.face, off = n => n % 2 === 0 ? 0.5 : 0, l = CCW[f];
    return [this.bx + 0.5 - DX[f] * 0.46875 + DX[l] * off(this.pw), this.by + 0.5 + off(this.ph), this.bz + 0.5 - DZ[f] * 0.46875 + DZ[l] * off(this.pw)];
  }
  size() { return this.face === 4 || this.face === 5 ? [0.0625, this.ph, this.pw] : [this.pw, this.ph, 0.0625]; }
  hurt(n, src, attacker) {
    if (this.removed) return false;
    this.removed = true; Sound.play('painting_break', this);
    if (!(attacker && attacker.isPlayer && attacker.creative)) this.dropSelf();
    return true;
  }
  save() { return { type: 'painting', bx: this.bx, by: this.by, bz: this.bz, face: this.face, variant: this.variant, x: this.x, y: this.y, z: this.z }; }
}
class ItemFrame extends HangingEntity {
  constructor(bx, by, bz, face, glow) { super(glow ? 'glow_item_frame' : 'item_frame', bx, by, bz, face); this.glow = !!glow; this.item = null; this.rot = 0; const c = this.centre(); this.x = c[0]; this.y = c[1] - 0.375; this.z = c[2]; }
  centre() { const f = this.face; return [this.bx + 0.5 - DX[f] * 0.46875, this.by + 0.5 - DY[f] * 0.46875, this.bz + 0.5 - DZ[f] * 0.46875]; }
  size() { const f = this.face; return f < 2 ? [0.75, 0.0625, 0.75] : f < 4 ? [0.75, 0.75, 0.0625] : [0.0625, 0.75, 0.75]; }
  get isMap() { return this.item && ITEMS[this.item.id].name === 'filled_map'; }
  get isMapFrame() { return this.isMap; }
  interact(p, s) {
    if (!this.item) {
      if (!s) return false;
      this.item = Object.assign({}, s, { count: 1 }); this.rot = 0;
      if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; p.inv.changed(); }
      Sound.play('item_frame_add', this);
    } else { this.rot = (this.rot + 1) % 8; Sound.play('item_frame_rotate', this); }
    this.signal();
    return true;
  }
  hurt(n, src, attacker) {
    if (this.removed) return false;
    if (src === 'explosion' || src === 'onFire' || src === 'inFire') { this.removed = true; this.dropAll(); return true; }
    if (this.item) {
      if (!(attacker && attacker.isPlayer && attacker.creative) && Game.rules.doEntityDrops) Drops.spawnItem(this.x, this.y + 0.2, this.z, this.item);
      this.item = null; this.rot = 0; Sound.play('item_frame_remove', this); this.signal();
      return true;
    }
    this.removed = true; Sound.play('item_frame_break', this);
    if (!(attacker && attacker.isPlayer && attacker.creative)) this.dropSelf();
    this.signal();
    return true;
  }
  dropAll() { if (this.item && Game.rules.doEntityDrops) Drops.spawnItem(this.x, this.y, this.z, this.item); this.dropSelf(); this.signal(); }
  tick() { super.tick(); if (this.removed && this.item) { if (Game.rules.doEntityDrops) Drops.spawnItem(this.x, this.y, this.z, this.item); this.item = null; } }
  // a comparator reads the turn (1-8) through the block the frame hangs on
  signal() { const f = this.face; Redstone.analogChanged(this.bx - DX[f], this.by - DY[f], this.bz - DZ[f]); for (let g = 2; g < 6; g++) Redstone.queue(this.bx - DX[f] + DX[g], this.by - DY[f], this.bz - DZ[f] + DZ[g]); Redstone.flush(); }
  save() { return { type: this.type, bx: this.bx, by: this.by, bz: this.bz, face: this.face, item: this.item, rot: this.rot, x: this.x, y: this.y, z: this.z }; }
}
class ArmorStand extends Entity {
  constructor(x, y, z, yaw) {
    super('armor_stand', x, y, z); this.w = 0.5; this.h = 1.975; this.yaw = this.pyaw = this.bodyYaw = this.pbodyYaw = this.headYaw = this.pheadYaw = yaw || 0;
    this.equip = { head: null, chest: null, legs: null, feet: null, main: null, off: null }; this.lastHit = -100; this.stepHeight = 0;
  }
  heldItem() { return this.equip.main; }
  tick() {
    this.tickBase();
    this.pbodyYaw = this.bodyYaw; this.pheadYaw = this.headYaw;
    this.vy -= 0.08; Phys.move(this, this.vx, this.vy, this.vz);
    this.vx *= 0.6; this.vy *= 0.98; this.vz *= 0.6;
    if (this.inLava || this.fireTicks > 0) { if (this.age % 20 === 0) this.burn = (this.burn || 0) + 1; if (this.burn > 4) this.breakApart(true); }
  }
  // which slot a click at height dy lands on (the game's getClickedSlot)
  slotAt(dy) {
    if (dy >= 0.1 && dy < 0.55 && this.equip.feet) return 'feet';
    if (dy >= 0.9 && dy < 1.6 && this.equip.chest) return 'chest';
    if (dy >= 0.4 && dy < 1.2 && this.equip.legs) return 'legs';
    if (dy >= 1.6 && this.equip.head) return 'head';
    return 'main';
  }
  interact(p, s) {
    if (p.spectator) return false;
    const KEYS = ['head', 'chest', 'legs', 'feet'];
    let slot;
    if (s) { const it = ITEMS[s.id]; slot = it.armor ? KEYS[it.armor.slot] : (it.name === 'carved_pumpkin' || /_(head|skull)$/.test(it.name)) ? 'head' : it.name === 'elytra' ? 'chest' : 'main'; if (slot === 'main') return false; }
    else {
      const eye = [p.x, p.eyeY, p.z], lv = p.lookVec(), t = Math.max(0, ((this.x - eye[0]) * lv[0] + (this.z - eye[2]) * lv[2]) / Math.max(1e-6, lv[0] * lv[0] + lv[2] * lv[2]));
      slot = this.slotAt(eye[1] + lv[1] * t - this.y);
      if (slot === 'main' && !this.equip.main) return false;
    }
    const cur = this.equip[slot];
    if (s) { this.equip[slot] = Object.assign({}, s, { count: 1 }); if (!p.creative) { s.count--; p.inv.held = s.count > 0 ? s : cur; if (s.count > 0 && cur) { const left = p.inv.add(cur); if (left) ItemUse.drop(p, left); } } }
    else { this.equip[slot] = null; if (cur) p.inv.held = cur; }
    p.inv.changed(); Sound.play('equip', this);
    return true;
  }
  hurt(n, src, attacker) {
    if (this.removed) return false;
    if (src === 'explosion') { this.breakApart(true); return true; }
    if (src === 'onFire' || src === 'inFire' || src === 'lava') return false;
    if (attacker && attacker.isPlayer && attacker.creative) { this.removed = true; Sound.play('armor_stand_break', this); return true; }
    if (attacker instanceof Projectile || (attacker && !attacker.isPlayer)) { this.breakApart(true); return true; }
    // two hits within 5 ticks break it; one hit just shakes it
    if (Game.gameTime - this.lastHit > 5) { this.lastHit = Game.gameTime; Sound.play('armor_stand_hit', this); return true; }
    this.breakApart(true);
    return true;
  }
  breakApart(drop) {
    this.removed = true; Sound.play('armor_stand_break', this);
    Particles.blockBreak(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z), BID.oak_planks, 0);
    if (!drop || !Game.rules.doEntityDrops) return;
    Drops.spawnItem(this.x, this.y + 0.5, this.z, stack('armor_stand'));
    for (const k in this.equip) if (this.equip[k]) Drops.spawnItem(this.x, this.y + 0.5, this.z, this.equip[k]);
  }
  // shaken after a hit
  posePart(inst, s, a) { const t = Game.gameTime - this.lastHit + a; inst.root.rotation.y = t < 5 ? Math.sin(t / 1.5 * Math.PI) * 3 * Math.PI / 180 : 0; }
  save() { return { type: 'armor_stand', x: this.x, y: this.y, z: this.z, yaw: this.yaw, equip: this.equip }; }
}

const Decor = (() => {
  const B = BID;
  const NOT_PLACEABLE = new Set(['earth', 'wind', 'water', 'fire']);
  // using a painting or item frame on a block face
  function hang(n, x, y, z, face, p) {
    const bx = x + DX[face], by = y + DY[face], bz = z + DZ[face];
    if (n === 'painting') {
      if (face < 2) return false;
      const fits = [];
      for (const v in MCDATA.paintings) { if (NOT_PLACEABLE.has(v)) continue; const e = new Painting(bx, by, bz, face, v); if (e.survives()) fits.push(e); }
      if (!fits.length) return false;
      const best = Math.max(...fits.map(e => e.pw * e.ph));
      const pick = fits.filter(e => e.pw * e.ph === best);
      Entities.add(pick[Math.floor(Math.random() * pick.length)]);
      Sound.play('painting_place', null, { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
      return true;
    }
    const e = new ItemFrame(bx, by, bz, face, n === 'glow_item_frame');
    if (!e.survives()) return false;
    Entities.add(e); Sound.play('item_frame_place', e);
    return true;
  }
  function armorStand(x, y, z, yaw) { Entities.add(new ArmorStand(x, y, z, Math.round(yaw / (Math.PI / 8)) * Math.PI / 8)); Sound.play('armor_stand_place', null, { x, y, z }); }
  // the comparator reading of a frame in block (x,y,z) that faces direction f
  function frameSignal(x, y, z, f) {
    for (const e of Entities.list) if (e instanceof ItemFrame && !e.removed && e.bx === x && e.by === y && e.bz === z && e.face === f) return e.item ? e.rot + 1 : 0;
    return -1;
  }
  function restore(d) {
    if (d.type === 'painting') { Entities.add(new Painting(d.bx, d.by, d.bz, d.face, d.variant)); return true; }
    if (d.type === 'item_frame' || d.type === 'glow_item_frame') { const e = new ItemFrame(d.bx, d.by, d.bz, d.face, d.type === 'glow_item_frame'); e.item = d.item || null; e.rot = d.rot || 0; Entities.add(e); return true; }
    if (d.type === 'armor_stand') { const e = new ArmorStand(d.x, d.y, d.z, d.yaw); Object.assign(e.equip, d.equip || {}); Entities.add(e); return true; }
    return false;
  }
  return { hang, armorStand, frameSignal, restore, Painting, ItemFrame, ArmorStand };
})();

/* ---------------------------------------------------------------- models: the armor stand and armour layers */
(() => {
  const { def, P } = EntityModels, PI = Math.PI, S = Skin;
  def('armor_stand', 64, 64, [
    P('head', [0, 1, 0], 0, [[0, 0, -1, -7, -1, 2, 7, 2]]),
    P('body', [0, 0, 0], 0, [[0, 26, -6, 0, -1.5, 12, 3, 3]]),
    P('right_arm', [-5, 2, 0], [-15 * PI / 180, 0, 10 * PI / 180], []),
    P('left_arm', [5, 2, 0], [-10 * PI / 180, 0, -10 * PI / 180], []),
    P('right_leg', [-1.9, 12, 0], [PI / 180, 0, PI / 180], [[8, 0, -1, 0, -1, 2, 11, 2]]),
    P('left_leg', [1.9, 12, 0], [-PI / 180, 0, -PI / 180], [[40, 16, -1, 0, -1, 2, 11, 2, 0, true]]),
    P('right_body_stick', [0, 0, 0], 0, [[16, 0, -3, 3, -1, 2, 7, 2]]),
    P('left_body_stick', [0, 0, 0], 0, [[48, 16, 1, 3, -1, 2, 7, 2]]),
    P('shoulder_stick', [0, 0, 0], 0, [[0, 48, -4, 10, -1, 8, 2, 2]]),
    P('base_plate', [0, 12, 0], 0, [[0, 32, -6, 11, -6, 12, 1, 12]]),
  ], { skin: s => {
    const wood = 0xa88454;
    for (const [u, v, w, h, d] of [[0, 0, 2, 7, 2], [0, 26, 12, 3, 3], [8, 0, 2, 11, 2], [40, 16, 2, 11, 2], [16, 0, 2, 7, 2], [48, 16, 2, 7, 2], [0, 48, 8, 2, 2], [24, 0, 2, 12, 2], [32, 16, 2, 12, 2]]) s.box(u, v, w, h, d, wood, 0.06);
    s.box(0, 32, 12, 1, 12, 0x9a9a9a, 0.05);
  } });
  // the armour models: a humanoid blown up by 1 (helmet, chestplate, boots) or 0.5 (leggings)
  const armorParts = g => [
    P('head', [0, 0, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8, g]], [P('hat', [0, 0, 0], 0, [[32, 0, -4, -8, -4, 8, 8, 8, g + 0.5]], [], true)]),
    P('body', [0, 0, 0], 0, [[16, 16, -4, 0, -2, 8, 12, 4, g]]),
    P('right_arm', [-5, 2, 0], 0, [[40, 16, -3, -2, -2, 4, 12, 4, g]]),
    P('left_arm', [5, 2, 0], 0, [[40, 16, -1, -2, -2, 4, 12, 4, g, true]]),
    P('right_leg', [-1.9, 12, 0], 0, [[0, 16, -2, 0, -2, 4, 12, 4, g]]),
    P('left_leg', [1.9, 12, 0], 0, [[0, 16, -2, 0, -2, 4, 12, 4, g, true]]),
  ];
  const MAT = { leather: 0xd0d0d0, chainmail: 0x8a8a8a, iron: 0xd8d8d8, golden: 0xf2d43c, diamond: 0x4fd8d0, netherite: 0x4a4046, turtle: 0x47a036 };
  const edge = (s, x, y, w, h, col) => { s.fill(x, y, w, 1, col, 0.02); s.fill(x, y + h - 1, w, 1, col, 0.02); s.fill(x, y, 1, h, col, 0.02); s.fill(x + w - 1, y, 1, h, col, 0.02); };
  // layer 1: helmet (head), chestplate (body and arms), boots (bottom of the legs); layer 2: leggings
  const skin1 = mat => s => {
    const c = MAT[mat], dark = S.scale(c, 0.7), light = S.scale(c, 1.15);
    const F = s.box(0, 0, 8, 8, 8, c, 0.06); for (const k of ['front', 'left', 'right', 'back']) { const f = F[k]; edge(s, f[0], f[1], f[2], f[3], dark); s.g.clearRect(f[0] + 1, f[1] + 4, f[2] - 2, f[3] - 4); }
    if (mat !== 'turtle') { const f = F.front; s.fill(f[0] + 1, f[1] + 1, 6, 1, light, 0.02); s.g.clearRect(f[0] + 2, f[1] + 4, 4, 4); }
    if (mat === 'turtle') return;
    const Bd = s.box(16, 16, 8, 12, 4, c, 0.06); for (const k in Bd) { const f = Bd[k]; edge(s, f[0], f[1], f[2], f[3], dark); }
    s.fill(Bd.front[0] + 3, Bd.front[1] + 1, 2, 10, light, 0.03);
    const A = s.box(40, 16, 4, 12, 4, c, 0.06); for (const k in A) { const f = A[k]; edge(s, f[0], f[1], f[2], Math.min(f[3], 6), dark); if (f[3] >= 12) s.g.clearRect(f[0], f[1] + 6, f[2], f[3] - 6); }
    const L = s.box(0, 16, 4, 12, 4, c, 0.06); for (const k in L) { const f = L[k]; if (f[3] >= 12) { s.g.clearRect(f[0], f[1], f[2], 8); edge(s, f[0], f[1] + 8, f[2], 4, dark); } }
    if (mat === 'chainmail') for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) if ((x + y) % 3 === 0) s.g.clearRect(x, y, 1, 1);
  };
  const skin2 = mat => s => {
    const c = MAT[mat], dark = S.scale(c, 0.7);
    const Bd = s.box(16, 16, 8, 12, 4, c, 0.06); for (const k in Bd) { const f = Bd[k]; if (f[3] >= 12) { s.g.clearRect(f[0], f[1], f[2], 7); edge(s, f[0], f[1] + 7, f[2], 5, dark); } }
    const L = s.box(0, 16, 4, 12, 4, c, 0.06); for (const k in L) { const f = L[k]; if (f[3] >= 12) { s.g.clearRect(f[0], f[1] + 10, f[2], 2); edge(s, f[0], f[1], f[2], 10, dark); } }
    if (mat === 'chainmail') for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) if ((x + y) % 3 === 0) s.g.clearRect(x, y, 1, 1);
  };
  for (const m in MAT) { def('armor1_' + m, 64, 32, armorParts(1), { skin: skin1(m) }); def('armor2_' + m, 64, 32, armorParts(0.5), { skin: skin2(m) }); }
})();

/* ---------------------------------------------------------------- drawing paintings and item frames */
(() => {
  const ROT = { 2: 0, 5: -Math.PI / 2, 3: Math.PI, 4: Math.PI / 2 }; // turn a model facing north (+z out) to face f
  const mats = new Map();
  function tex(c) { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }
  class PaintingVisual {
    constructor(e) {
      this.e = e;
      const k = e.variant;
      if (!mats.has(k)) mats.set(k, [entityMat(tex(PaintingArt.canvas(k, e.pw, e.ph)), {}), entityMat(tex(PaintingArt.back()), {})]);
      const [front, back] = mats.get(k);
      this.mats = [back, back, back, back, front, back];
      this.obj = new THREE.Mesh(new THREE.BoxGeometry(e.pw, e.ph, 1 / 16), this.mats); this.obj.frustumCulled = false;
      const [cx, cy, cz] = e.centre(); this.obj.position.set(cx, cy, cz); this.obj.rotation.y = { 3: 0, 2: Math.PI, 5: Math.PI / 2, 4: -Math.PI / 2 }[e.face];
      scene.add(this.obj);
    }
    update() { const e = this.e, [cx, cy, cz] = e.centre(); const [sl, bl] = EntityRender.lightAt(cx + DX[e.face] * 0.6, cy, cz + DZ[e.face] * 0.6); for (const m of new Set(this.mats)) m.uniforms.uEnv.value.set(sl, bl); }
    dispose() { scene.remove(this.obj); this.obj.geometry.dispose(); }
  }
  let frameCanvas = {};
  function frameTex(glow) {
    if (frameCanvas[glow]) return frameCanvas[glow];
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edgeP = x < 2 || y < 2 || x > 13 || y > 13; const v = 0.9 + ((x * 5 + y * 3) % 4) * 0.04; g.fillStyle = edgeP ? `rgb(${Math.round(196 * v)},${Math.round(164 * v)},${Math.round(110 * v)})` : glow ? `rgb(${Math.round(60 * v)},${Math.round(140 * v)},${Math.round(130 * v)})` : `rgb(${Math.round(150 * v)},${Math.round(96 * v)},${Math.round(60 * v)})`; g.fillRect(x, y, 1, 1); }
    return (frameCanvas[glow] = tex(c));
  }
  class FrameVisual {
    constructor(e) {
      this.e = e; this.obj = new THREE.Group(); scene.add(this.obj);
      this.mat = entityMat(frameTex(e.glow), {});
      this.frame = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 1 / 16), this.mat); this.frame.frustumCulled = false;
      this.obj.add(this.frame);
      this.itemId = -1; this.item = null;
    }
    update(a) {
      const e = this.e, [cx, cy, cz] = e.centre(), f = e.face;
      this.obj.position.set(cx, cy, cz);
      // the frame lies in the wall's plane, facing out along f
      if (f >= 2) this.obj.rotation.set(0, { 3: 0, 2: Math.PI, 5: Math.PI / 2, 4: -Math.PI / 2 }[f], 0); else this.obj.rotation.set(f === 1 ? -Math.PI / 2 : Math.PI / 2, 0, 0);
      const [sl, bl] = EntityRender.lightAt(cx + DX[f] * 0.5, cy + DY[f] * 0.5, cz + DZ[f] * 0.5);
      this.mat.uniforms.uEnv.value.set(e.glow ? 1 : sl, e.glow ? 1 : bl);
      const id = e.item ? e.item.id : -1;
      // a map in a frame is redrawn when the map changes
      const md = e.isMap && e.item.tag && Maps.get(e.item.tag.map); if (md && md.dirty) Maps.canvasFor(md); const ver = md ? md.ver || 0 : -1;
      if (e.isMap && (ver !== this.mapVer || (e.item.tag && e.item.tag.map) !== this.mapId)) { this.itemId = -2; this.mapVer = ver; this.mapId = e.item.tag && e.item.tag.map; }
      if (id !== this.itemId) {
        if (this.item) { this.obj.remove(this.item); this.item.material.dispose(); this.item = null; }
        this.itemId = id;
        if (id >= 0) {
          if (ITEMS[id].name === 'filled_map' && typeof Maps !== 'undefined' && Maps.mesh) { this.item = Maps.mesh(e.item); }
          else { this.item = ItemMesh.mesh(id); this.item.matrixAutoUpdate = false; }
          if (this.item) this.obj.add(this.item);
        }
      }
      // a map fills the frame; anything else is drawn at half size, turned in eighths
      this.frame.visible = !e.isMap;
      if (this.item) {
        if (e.isMap) { this.item.position.set(0, 0, 0.03); this.item.rotation.set(0, 0, -e.rot * Math.PI / 2); }
        else {
          const r = ItemMesh.get(this.itemId), kind = r.block ? 'block' : r.handheld ? 'handheld' : 'generated';
          const m = new THREE.Matrix4().makeTranslation(0, 0, 0.0625);
          m.multiply(new THREE.Matrix4().makeRotationZ(-e.rot * Math.PI / 4));
          m.multiply(new THREE.Matrix4().makeScale(0.5, 0.5, 0.5));
          m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
          applyItemTransform(m, kind, 'fixed', false);
          this.item.matrix.copy(m);
        }
        if (this.item.material.uniforms) this.item.material.uniforms.uEnv.value.set(e.glow ? 1 : sl, e.glow ? 1 : bl);
      }
    }
    dispose() { scene.remove(this.obj); this.frame.geometry.dispose(); this.mat.dispose(); if (this.item && this.item.material) this.item.material.dispose(); }
  }
  EntityRender.register('painting', e => new PaintingVisual(e));
  EntityRender.register('item_frame', e => new FrameVisual(e));
  EntityRender.register('glow_item_frame', e => new FrameVisual(e));
  void ROT;
})();

/* ---------------------------------------------------------------- the elytra's wings (the game's ElytraModel, 2 pixels off the back) */
(() => {
  const { def, P, A } = EntityModels, PI = Math.PI;
  def('elytra', 64, 32, [
    P('left_wing', [5, 0, 2], [0.2617994, 0, -0.2617994], [[22, 0, -10, 0, 0, 10, 20, 2, 1]]),
    P('right_wing', [-5, 0, 2], [0.2617994, 0, 0.2617994], [[22, 0, 0, 0, 0, 10, 20, 2, 1, true]]),
  ], { anim: 'elytra', skin: s => {
    // grey membrane with darker ribs fanning from the shoulder
    s.fill(22, 0, 24, 22, 0x8f8fa3, 0.12);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 18; k++) { const u = 24 + Math.floor(k * (0.25 + i * 0.12)), v = 2 + k; if (u < 34) s.fill(u, v, 1, 1, 0x5d5d70, 0); }
    s.fill(24, 2, 10, 1, 0xb4b4c6, 0); s.fill(36, 2, 10, 1, 0xb4b4c6, 0);
  } });
  // folded on the back, spread while gliding (closing as the dive steepens), tucked when crouching
  A.elytra = (m, s) => {
    const L = m.parts, e = s.e || {};
    let f = 0.2617994, g = -0.2617994, h = 0, i = 0;
    if (e.gliding) {
      let j = 1; const v = Math.hypot(e.vx || 0, e.vy || 0, e.vz || 0);
      if ((e.vy || 0) < 0 && v > 0) j = 1 - Math.pow(-e.vy / v, 1.5);
      f = j * PI / 9 + (1 - j) * PI / 2; g = j * -PI / 2 + (1 - j) * -PI / 2;
    } else if (s.crouch) { f = PI * 2 / 9; g = -PI / 4; h = 3; i = 0.08726646; }
    L.left_wing.y = h; L.left_wing.rx = f; L.left_wing.rz = g; L.left_wing.ry = i;
    L.right_wing.y = h; L.right_wing.rx = f; L.right_wing.rz = -g; L.right_wing.ry = -i;
  };
})();
