'use strict';
/* Fishing and leads, after the game's FishingHook and Leashable.
   A cast bobber flies, settles in water and bobs; after 5-30 seconds (5 less per level of Lure, faster in rain,
   slower under a roof) a fish swims in, shown by the trail of bubbles, and bites for 1-2 seconds: reel in then
   for a catch from the game's fishing loot table (fish, junk, and treasure only in open water, shifted by Luck
   of the Sea) and 1-6 experience. A bobber can also hook an entity and pull it in.
   Leads tie a mob to the player: past 6 blocks it is pulled along, past 10 the lead snaps. Using a lead on a
   fence ties every mob you lead within 7 blocks to a knot on it. */
class FishingHook extends Entity {
  constructor(owner, rod) {
    super('fishing_bobber', owner.x, owner.eyeY, owner.z);
    this.owner = owner; this.w = this.h = 0.25; this.noPick = true; this.stepHeight = 0;
    this.state = 'flying'; this.hooked = null; this.nibble = 0; this.timeUntilLured = 0; this.timeUntilHooked = 0; this.fishAngle = 0; this.outOfWater = 0; this.openWater = true; this.biting = false;
    this.lure = enchLevel(rod, 'lure') * 100; this.luck = enchLevel(rod, 'luck_of_the_sea');
    // the game's cast: from 0.3 to the side of the eyes, along the look, with a little randomness
    const yaw = owner.yaw, pitch = owner.pitch;
    const f2 = Math.cos(yaw), f3 = Math.sin(yaw), f4 = Math.cos(pitch), f5 = -Math.sin(pitch);
    this.x = this.px = owner.x + f3 * 0.3; this.z = this.pz = owner.z + f2 * 0.3;
    let vx = -f3, vy = Math.max(-5, Math.min(5, f5 / f4)), vz = -f2;
    const l = Math.hypot(vx, vy, vz), tri = () => 0.5 + 0.0103365 * (Math.random() - Math.random());
    this.vx = vx * (0.6 / l + tri()); this.vy = vy * (0.6 / l + tri()); this.vz = vz * (0.6 / l + tri());
  }
  shouldStop() {
    const p = this.owner;
    const rod = s => s && ITEMS[s.id].name === 'fishing_rod';
    if (!p || p.removed || p.dead || !(rod(p.inv.held) || rod(p.inv.offhand)) || this.dist2(p.x, p.y, p.z) > 1024) { this.removed = true; return true; }
    return false;
  }
  waterHeight() { const x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z), id = World.getBlock(x, y, z), d = BLOCKS[id]; if (d.fluid !== 'water' && !d.fluidLog && !(d.waterlog && (World.getState(x, y, z) & 128))) return 0; if (!d.fluid) return 1; return BLOCKS[World.getBlock(x, y + 1, z)].fluid === 'water' ? 1 : (8 - (World.getState(x, y, z) & 7)) / 9; }
  tick() {
    this.px = this.x; this.py = this.y; this.pz = this.z; this.age++;
    if (this.shouldStop()) return;
    const f = this.waterHeight(), inWater = f > 0, bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
    if (this.state === 'flying') {
      if (this.hooked) { this.vx = this.vy = this.vz = 0; this.state = 'hooked'; return; }
      if (inWater) { this.vx *= 0.3; this.vy *= 0.2; this.vz *= 0.3; this.state = 'bobbing'; return; }
      // flying into an entity hooks it
      for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) {
        if (!e || e === this || e === this.owner || e.removed || e.dead || e.ghost || e.noPick || (e.isPlayer && e.spectator) || e.type === 'xp_orb') continue;
        const b = e.bb(); if (this.x + 0.125 > b[0] && this.x - 0.125 < b[3] && this.y + 0.25 > b[1] && this.y < b[4] && this.z + 0.125 > b[2] && this.z - 0.125 < b[5]) { this.hooked = e; break; }
      }
    } else {
      if (this.state === 'hooked') {
        const e = this.hooked;
        if (e && !e.removed && !e.dead) { this.x = e.x; this.y = e.y + e.h * 0.8; this.z = e.z; } else { this.hooked = null; this.state = 'flying'; }
        return;
      }
      if (this.state === 'bobbing') {
        let d0 = this.y + this.vy - by - f;
        if (Math.abs(d0) < 0.01) d0 += Math.sign(d0) * 0.1;
        this.vx *= 0.9; this.vy = this.vy - d0 * Math.random() * 0.2; this.vz *= 0.9;
        if (this.nibble <= 0 && this.timeUntilHooked <= 0) this.openWater = true; else this.openWater = this.openWater && this.outOfWater < 10 && this.isOpenWater(bx, by, bz);
        if (inWater) { this.outOfWater = Math.max(0, this.outOfWater - 1); if (this.biting) this.vy += -0.1 * Math.random() * Math.random(); this.catching(bx, by, bz); }
        else this.outOfWater = Math.min(10, this.outOfWater + 1);
      }
    }
    if (!inWater) this.vy -= 0.03;
    Phys.move(this, this.vx, this.vy, this.vz);
    if (this.state === 'flying' && (this.onGround || this.hitH)) { this.vx = this.vy = this.vz = 0; }
    this.vx *= 0.92; this.vy *= 0.92; this.vz *= 0.92;
  }
  // the game's open-water check: the 5x5 around the bobber, 4 layers, all water or air (no blocks)
  isOpenWater(x, y, z) {
    let kind = null;
    for (let dy = -1; dy <= 2; dy++) {
      let layer = 'none';
      for (let dx = -2; dx <= 2 && layer !== 'invalid'; dx++) for (let dz = -2; dz <= 2; dz++) {
        const id = World.getBlock(x + dx, y + dy, z + dz), d = BLOCKS[id];
        const t = id === 0 || id === BID.lily_pad ? 'above' : d.fluid === 'water' && (World.getState(x + dx, y + dy, z + dz) & 7) === 0 ? 'inside' : 'invalid';
        if (layer === 'none') layer = t; else if (layer !== t) { layer = 'invalid'; break; }
      }
      if (layer === 'invalid') return false;
      if (kind === 'above' && layer === 'inside') return false;
      kind = layer;
    }
    return true;
  }
  catching(x, y, z) {
    let i = 1;
    if (Math.random() < 0.25 && Weather.rainingAt(x, y + 1, z)) i++;
    if (Math.random() < 0.5 && World.skyLight(x, y + 1, z) < 15) i--;
    if (this.nibble > 0) { if (--this.nibble <= 0) { this.timeUntilLured = 0; this.timeUntilHooked = 0; this.biting = false; } }
    else if (this.timeUntilHooked > 0) {
      this.timeUntilHooked -= i;
      if (this.timeUntilHooked > 0) {
        // the fish swims in: a line of bubbles heading for the bobber
        this.fishAngle += 9.188 * (Math.random() - Math.random());
        const a = this.fishAngle * Math.PI / 180, s1 = Math.sin(a), c1 = Math.cos(a);
        const d0 = this.x + s1 * this.timeUntilHooked * 0.1, d1 = Math.floor(this.y) + 1, d2 = this.z + c1 * this.timeUntilHooked * 0.1;
        if (BLOCKS[World.getBlock(Math.floor(d0), Math.floor(d1 - 1), Math.floor(d2))].fluid === 'water') {
          if (Math.random() < 0.15) Particles.bubble(d0, d1 - 0.1, d2);
          Particles.generic(d0, d1, d2, c1 * 0.04, 0.01, -s1 * 0.04, { sprite: 'splash_' + rnd(4), size: 0.05, life: 10, grav: 0, phys: false });
        }
      } else {
        Sound.play('bobber_splash', this);
        for (let k = 0; k < 6; k++) { Particles.bubble(this.x + (Math.random() - 0.5) * 0.25, this.y + 0.5, this.z + (Math.random() - 0.5) * 0.25); Particles.splash(this.x, this.y + 0.5, this.z, 1); }
        this.nibble = 20 + rnd(21); this.biting = true;
      }
    } else if (this.timeUntilLured > 0) {
      this.timeUntilLured -= i;
      let f5 = 0.15;
      if (this.timeUntilLured < 20) f5 += (20 - this.timeUntilLured) * 0.05; else if (this.timeUntilLured < 40) f5 += (40 - this.timeUntilLured) * 0.02; else if (this.timeUntilLured < 60) f5 += (60 - this.timeUntilLured) * 0.01;
      if (Math.random() < f5) {
        const a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 35;
        const d4 = this.x + Math.sin(a) * r * 0.1, d5 = Math.floor(this.y) + 1, d6 = this.z + Math.cos(a) * r * 0.1;
        if (BLOCKS[World.getBlock(Math.floor(d4), Math.floor(d5 - 1), Math.floor(d6))].fluid === 'water') Particles.splash(d4, d5, d6, 2 + rnd(2));
      }
      if (this.timeUntilLured <= 0) { this.fishAngle = Math.random() * 360; this.timeUntilHooked = 20 + rnd(61); }
    } else this.timeUntilLured = Math.max(1, 100 + rnd(501) - this.lure);
  }
  // reeling in; returns the damage to the rod
  retrieve() {
    const p = this.owner;
    if (this.shouldStop()) return 0;
    let dmg = 0;
    if (this.hooked) {
      const e = this.hooked; e.vx += (p.x - this.x) * 0.1; e.vy += (p.y - this.y) * 0.1; e.vz += (p.z - this.z) * 0.1;
      dmg = e.type === 'item' ? 3 : 5;
    } else if (this.nibble > 0) {
      const luck = this.luck + (p.effect('luck') ? p.effect('luck').amp + 1 : 0) - (p.effect('unluck') ? p.effect('unluck').amp + 1 : 0);
      const loot = LootTables.roll('gameplay/fishing', { luck, openWater: this.openWater, entity: this, biome: BIOMES[World.biomeAt3(this.x, this.y, this.z)].name });
      for (const s of loot) {
        const e = Drops.spawnItem(this.x, this.y, this.z, s);
        if (e) { const d0 = p.x - this.x, d1 = p.y - this.y, d2 = p.z - this.z; e.vx = d0 * 0.1; e.vy = d1 * 0.1 + Math.sqrt(Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2)) * 0.08; e.vz = d2 * 0.1; }
        Drops.spawnXp(p.x, p.y + 0.5, p.z + 0.5, 1 + rnd(6));
        if (['cod', 'salmon', 'tropical_fish', 'pufferfish'].includes(ITEMS[s.id].name)) Stats.add('custom', 'fish_caught');
        Advancements.fire('fishing_rod_hooked', { item: s, rod: p.inv.held, entity: this });
      }
      dmg = 1;
    }
    if (this.onGround) dmg = 2;
    this.removed = true;
    return dmg;
  }
  save() { return null; }
}

const Fishing = (() => {
  // using the rod: cast, or reel in the bobber that is out
  function use(p, s) {
    if (p.fishing && !p.fishing.removed) {
      const dmg = p.fishing.retrieve(); p.fishing = null;
      if (dmg > 0 && !p.creative) { s.dmg = (s.dmg || 0) + dmg; if (s.dmg >= ITEMS[s.id].dur) { Sound.play('break_item', p); p.inv.held = null; } p.inv.changed(); }
      Sound.play('bobber_retrieve', p);
      return;
    }
    p.fishing = Entities.add(new FishingHook(p, s));
    Sound.play('bobber_throw', p);
    Stats.add('used', 'fishing_rod');
  }
  return { use };
})();

/* ---------------------------------------------------------------- leads */
class LeashKnot extends Entity {
  constructor(x, y, z) { super('leash_knot', x + 0.5, y + 0.375, z + 0.5); this.bx = x; this.by = y; this.bz = z; this.w = 0.375; this.h = 0.5; this.noGravity = true; }
  tick() { this.px = this.x; this.py = this.y; this.pz = this.z; this.age++; if (this.age % 100 === 0 && BLOCKS[World.getBlock(this.bx, this.by, this.bz)].model !== 'fence') { this.removed = true; Leads.knotGone(this); } }
  interact(p, s) {
    // taking the mobs back off the fence (or tying more on)
    if (s && ITEMS[s.id].name === 'lead') return false;
    const mobs = Leads.leashedTo(this);
    if (mobs.length) { for (const m of mobs) Leads.attachTo(m, p); this.removed = true; Sound.play('leash_untie', this); return true; }
    this.removed = true; return true;
  }
  hurt(n, src, attacker) { if (this.removed) return false; this.removed = true; Leads.knotGone(this, !(attacker && attacker.isPlayer && attacker.creative)); return true; }
  save() { return { type: 'leash_knot', x: this.bx, y: this.by, z: this.bz }; }
}
const Leads = (() => {
  const LEASHABLE = new Set(['allay', 'armadillo', 'axolotl', 'bee', 'camel', 'cat', 'chicken', 'cow', 'dolphin', 'donkey', 'fox', 'frog', 'glow_squid', 'goat', 'hoglin', 'horse', 'iron_golem', 'llama', 'mooshroom', 'mule', 'ocelot', 'panda', 'parrot', 'pig', 'polar_bear', 'rabbit', 'sheep', 'skeleton_horse', 'sniffer', 'snow_golem', 'squid', 'strider', 'trader_llama', 'wolf', 'zombie_horse', 'turtle']);
  const can = m => LEASHABLE.has(m.type) && !m.dead && !m.baby || (LEASHABLE.has(m.type) && m.baby && m.type !== 'turtle');
  function attachTo(m, holder) { m.leashed = holder; m.persistent = true; Sound.play('leash_attach', m); }
  function attach(m, p) {
    if (!can(m) || m.leashed) return false;
    attachTo(m, p);
    if (!p.creative) { const s = p.inv.held; s.count--; if (!s.count) p.inv.held = null; p.inv.changed(); }
    return true;
  }
  const leashedTo = h => Entities.list.filter(e => e.leashed === h && !e.removed);
  function drop(m) { m.leashed = null; if (Game.rules.doEntityDrops) Drops.spawnItem(m.x, m.y + 0.5, m.z, stack('lead')); }
  // a lead used on a fence: every mob the player leads within 7 blocks is tied to a knot there
  function tieToFence(p, x, y, z) {
    const mobs = Entities.list.filter(e => e.leashed === p && !e.removed && e.dist2(x + 0.5, y + 0.5, z + 0.5) < 49);
    if (!mobs.length) return false;
    let knot = Entities.list.find(e => e instanceof LeashKnot && !e.removed && e.bx === x && e.by === y && e.bz === z);
    if (!knot) { knot = Entities.add(new LeashKnot(x, y, z)); Sound.play('leash_place', knot); }
    for (const m of mobs) m.leashed = knot;
    return true;
  }
  function knotGone(k, dropLeads) { for (const m of leashedTo(k)) { if (dropLeads !== false) drop(m); else m.leashed = null; } }
  // the game's leash rules: pulled along past 6 blocks, snapped past 10
  function tick() {
    for (const m of Entities.list) {
      const h = m.leashed; if (!h) continue;
      if (m.removed || m.dead) { if (!m.removed) drop(m); m.leashed = null; continue; }
      if (h.removed || h.dead || (h.isPlayer && h.dim !== undefined && World.dim !== h.dim)) { drop(m); continue; }
      const f = m.distTo(h);
      if (f > 10) { drop(m); Sound.play('leash_break', m); continue; }
      if (f > 6) {
        const dx = (h.x - m.x) / f, dy = (h.y - m.y) / f, dz = (h.z - m.z) / f;
        m.vx += Math.sign(dx) * dx * dx * 0.4; m.vy += Math.sign(dy) * dy * dy * 0.4; m.vz += Math.sign(dz) * dz * dz * 0.4;
        m.fallDistance = 0;
      }
      if (f > 2 && m.nav && m.age % 10 === 0) m.nav.moveTo(h.x, h.y, h.z, 1);
    }
  }
  // the rope: a sagging line from the mob to its holder (the game draws 24 segments)
  let lines = null;
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x6b4f2a });
  const L = (e, k, a) => e['p' + k] + (e[k] - e['p' + k]) * a;
  function draw(a) {
    if (typeof scene === 'undefined') return;
    a = a || 0;
    // leads saved with a world come back once their holder is around
    for (const e of Entities.list) if (e.leashPending) { const lp = e.leashPending; if (lp === 'player') { if (Game.player) { e.leashed = Game.player; e.leashPending = null; } } else { const k = Entities.list.find(o => o instanceof LeashKnot && o.bx === lp[0] && o.by === lp[1] && o.bz === lp[2]); if (k) { e.leashed = k; e.leashPending = null; } else if (e.age > 40) e.leashPending = null; } }
    const pairs = Entities.list.filter(e => e.leashed && !e.removed);
    if (!pairs.length && !lines) return;
    if (!lines) { lines = new THREE.LineSegments(new THREE.BufferGeometry(), ropeMat); lines.frustumCulled = false; scene.add(lines); }
    const pos = [];
    for (const m of pairs) {
      const h = m.leashed;
      const ax = L(m, 'x', a), ay = L(m, 'y', a) + m.h * 0.7, az = L(m, 'z', a);
      const bx = L(h, 'x', a), by = L(h, 'y', a) + (h.isPlayer ? h.h * 0.6 : h instanceof LeashKnot ? 0.1 : h.h * 0.7), bz = L(h, 'z', a);
      let lx = ax, ly = ay, lz = az;
      for (let i = 1; i <= 24; i++) {
        const t = i / 24, sag = Math.sin(t * Math.PI) * Math.min(1, Math.hypot(bx - ax, bz - az) * 0.08);
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * (t * t + t) / 2 - sag * 0.3, z = az + (bz - az) * t;
        pos.push(lx, ly, lz, x, y, z); lx = x; ly = y; lz = z;
      }
    }
    lines.geometry.dispose(); lines.geometry = new THREE.BufferGeometry(); lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lines.visible = pos.length > 0;
  }
  function restore(d) { if (d.type === 'leash_knot') { Entities.add(new LeashKnot(d.x, d.y, d.z)); return true; } return false; }
  function clear() { if (lines) { scene.remove(lines); lines.geometry.dispose(); lines = null; } }
  return { attach, attachTo, tieToFence, leashedTo, knotGone, tick, draw, restore, clear, can };
})();

/* the bobber with its line back to the rod, and the knot on a fence */
(() => {
  const lerp = (p, c, a) => p + (c - p) * a;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  class BobberVisual {
    constructor(e) {
      this.e = e; this.obj = new THREE.Group(); scene.add(this.obj);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.0625, 0.125), new THREE.MeshBasicMaterial({ color: 0xd02020 })); top.position.y = 0.09;
      const bot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.0625, 0.125), new THREE.MeshBasicMaterial({ color: 0xeeeeee })); bot.position.y = 0.03;
      this.obj.add(top, bot); this.mats = [top.material, bot.material];
      this.line = new THREE.Line(new THREE.BufferGeometry(), lineMat); this.line.frustumCulled = false; scene.add(this.line);
    }
    update(a) {
      const e = this.e, p = e.owner, x = lerp(e.px, e.x, a), y = lerp(e.py, e.y, a), z = lerp(e.pz, e.z, a);
      this.obj.position.set(x, y, z);
      if (!p) return;
      // the rod's tip: in front of and to the right of the eyes in first person, above the hand otherwise
      const yaw = p.pyaw + angleDiff(p.yaw, p.pyaw) * a, pitch = p.pitch, px = lerp(p.px, p.x, a), pz = lerp(p.pz, p.z, a), ey = lerp(p.py, p.y, a) + (p.eyeH || 1.62);
      const fx = -Math.sin(yaw) * Math.cos(pitch), fy = -Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch), rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const first = p === Game.player && p.view === 0;
      const tx = px + fx * (first ? 0.9 : 0.6) - rx * (first ? 0.35 : 0.4), ty = ey + fy * (first ? 0.9 : 0.6) + (first ? -0.15 : 0.05), tz = pz + fz * (first ? 0.9 : 0.6) - rz * (first ? 0.35 : 0.4);
      const pos = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16; pos.push(tx + (x - tx) * t, ty + (y + 0.06 - ty) * (t * t + t) * 0.5, tz + (z - tz) * t); }
      this.line.geometry.dispose(); this.line.geometry = new THREE.BufferGeometry(); this.line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    }
    dispose() { scene.remove(this.obj); scene.remove(this.line); this.line.geometry.dispose(); for (const m of this.mats) m.dispose(); }
  }
  class KnotVisual {
    constructor(e) { this.e = e; this.mat = new THREE.MeshBasicMaterial({ color: 0x7a5a32 }); this.obj = new THREE.Mesh(new THREE.BoxGeometry(6 / 16, 8 / 16, 6 / 16), this.mat); scene.add(this.obj); }
    update() { const e = this.e; this.obj.position.set(e.bx + 0.5, e.by + 0.5 + 1 / 16, e.bz + 0.5); const [sl, bl] = EntityRender.lightAt(e.bx + 0.5, e.by + 0.5, e.bz + 0.5); const v = Math.max(sl * U.uSkyLight.value, bl) * 0.8 + 0.2; this.mat.color.setRGB(0.48 * v, 0.35 * v, 0.2 * v); }
    dispose() { scene.remove(this.obj); this.obj.geometry.dispose(); this.mat.dispose(); }
  }
  EntityRender.register('fishing_bobber', e => new BobberVisual(e));
  EntityRender.register('leash_knot', e => new KnotVisual(e));
})();
