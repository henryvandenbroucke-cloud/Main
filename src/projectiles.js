'use strict';
/* Projectiles with the game's physics: arrows (gravity 0.05, drag 0.99, damage = speed x 2 rounded up, critical
   arrows from a full draw, Power, Punch, Flame, Infinity, sticking in blocks and being picked up), snowballs,
   eggs (1 in 8 hatch a chick), ender pearls (teleport, 5 damage, 5% endermite), splash and lingering
   potions, bottles o' enchanting, tridents (Loyalty, Riptide handled by the item), fireworks, eyes of ender
   and fireballs. Then explosions (the game's ray algorithm) and primed TNT. */
class Projectile extends Entity {
  constructor(type, owner, x, y, z) { super(type, x, y, z); this.owner = owner || null; this.w = this.h = 0.25; this.gravity = 0.03; this.drag = 0.99; this.noPick = true; this.inGround = false; this.life = 0; }
  get eyeY() { return this.y + this.h / 2; }
  tick() {
    this.tickBase();
    if (this.inGround) { this.groundTick && this.groundTick(); return; }
    // move, checking blocks and entities along the way
    const nx = this.x + this.vx, ny = this.y + this.vy, nz = this.z + this.vz;
    const len = Math.hypot(this.vx, this.vy, this.vz) || 1e-6;
    const hit = Phys.raycast(this.x, this.y, this.z, this.vx / len, this.vy / len, this.vz / len, len, id => SOLID[id] || (this.hitsFluid && BLOCKS[id].fluid));
    let ent = null, et = hit ? hit.t : len;
    for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) {
      if (e === this || e.removed || e.dead || !e.hurt || e === this.owner && this.life < 5 || e.isPlayer && e.spectator || e instanceof Projectile || e.type === 'item' || e.type === 'xp_orb') continue;
      if (this.pierced && this.pierced.has(e)) continue;
      if (e === this.lastDeflectedBy) continue;
      const hw = e.w / 2 + 0.3;
      const r = Phys.rayBox(this.x, this.y, this.z, this.vx / len, this.vy / len, this.vz / len, e.x - hw, e.y - 0.3, e.z - hw, e.x + hw, e.y + e.h + 0.3, e.z + hw);
      if (r && r.t < et) { et = r.t; ent = e; }
    }
    if (ent) {
      this.x += this.vx * (et / len); this.y += this.vy * (et / len); this.z += this.vz * (et / len);
      // the game's ProjectileDeflection.REVERSE (breezes): turned back at half speed, its owner unchanged
      if (ent.deflects && ent.deflects(this)) { this.vx *= -0.5; this.vy *= -0.5; this.vz *= -0.5; this.lastDeflectedBy = ent; if (ent.onDeflect) ent.onDeflect(this); return; }
      if (this.onEntity(ent) !== false) return;
    }
    else if (hit) { this.x = this.x + this.vx * (hit.t / len) - this.vx / len * 0.05; this.y = this.y + this.vy * (hit.t / len) - this.vy / len * 0.05; this.z = this.z + this.vz * (hit.t / len) - this.vz / len * 0.05; this.onBlock(hit); if (this.removed || this.inGround) return; }
    else { this.x = nx; this.y = ny; this.z = nz; }
    // the projectile points the way it flies
    const h = Math.hypot(this.vx, this.vz); this.yaw = Math.atan2(-this.vx, -this.vz); this.pitch = -Math.atan2(this.vy, h);
    const f = this.inWater ? (this.waterDrag || 0.8) : this.drag;
    this.vx *= f; this.vy *= f; this.vz *= f;
    if (!this.noGravity) this.vy -= this.gravity;
    if (this.inWater) Particles.bubble && Particles.bubble(this.x, this.y, this.z);
    if (++this.life > 1200 || this.y < MINY - 64) this.removed = true;
    this.trail && this.trail();
  }
  onEntity(e) { this.removed = true; }
  onBlock(hit) { this.removed = true; }
  save() { return null; }
}
class Arrow extends Projectile {
  constructor(owner, x, y, z, o) {
    super('arrow', owner, x, y, z); o = o || {};
    this.w = this.h = 0.5; this.gravity = 0.05; this.waterDrag = 0.6; this.dmg = 2; this.crit = false; this.knock = 0; this.pickup = o.pickup !== undefined ? o.pickup : 1; this.potion = o.potion || null; this.potionDur = o.dur || 0; this.spectral = !!o.spectral; this.groundTime = 0; this.shake = 0; this.pierce = o.pierce || 0; this.pierced = null;
  }
  onEntity(e) {
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    let d = Math.ceil(Math.max(0, sp * this.dmg));
    if (this.crit) d = Math.min(d + Math.floor(Math.random() * (d / 2 + 2)), 2147483647);
    if (this.pierce > 0) { this.pierced = this.pierced || new Set(); if (this.pierced.size >= this.pierce + 1) { this.removed = true; return; } this.pierced.add(e); }
    if (e.type === 'enderman') { e.teleportRandom && e.teleportRandom(); return false; }
    const fire = this.fireTicks > 0 && e.type !== 'enderman';
    const ok = Advancements.withDamage({ direct: this }, () => e.hurt(this.owner && this.owner.isPlayer ? d : (e.isPlayer ? d : d), 'arrow', this.owner || this));
    if (ok) {
      if (fire) e.fireTicks = Math.max(e.fireTicks || 0, 100);
      if (this.knock > 0 && e.knockback) { const h = Math.hypot(this.vx, this.vz) || 1; e.knockback(0, 0, 0); e.vx += this.vx / h * this.knock * 0.6; e.vy += 0.1; e.vz += this.vz / h * this.knock * 0.6; }
      else if (e.knockback) e.knockback(0.4, -this.vx, -this.vz);
      if (this.potion && e.addEffect) { if (typeof Potions !== 'undefined') Potions.applyArrow(e, this.potion); else e.addEffect(this.potion, this.potionDur || 100, 0); }
      if (this.spectral && e.addEffect) e.addEffect('glowing', 200, 0);
      if (e.living && !e.isPlayer && e.arrowsIn !== undefined) e.arrowsIn++;
      if (this.owner && this.owner.isPlayer && e !== this.owner) Sound.play('arrow_hit_player', this.owner);
      Sound.play('arrow_hit', this);
      if (this.pierce > 0 && this.pierced.size <= this.pierce) return false;
      this.removed = true;
    } else { // bounced off
      this.vx *= -0.1; this.vy *= -0.1; this.vz *= -0.1; this.yaw += Math.PI; this.life = Math.max(this.life, 0);
      if (Math.hypot(this.vx, this.vy, this.vz) < 1e-7) this.removed = true;
    }
  }
  onBlock(hit) {
    this.inGround = true; this.shake = 7; this.vx = this.vy = this.vz = 0; this.groundTime = 0;
    this.stuck = [hit.x, hit.y, hit.z, hit.id];
    Sound.play('arrow_hit', this);
    if (hit.id === BID.target) Redstone.target && Redstone.target(hit, this);
    if (this.fireTicks > 0 && hit.id === BID.tnt) Explosions.primeTnt(hit.x, hit.y, hit.z, this.owner);
    // projectiles break decorated pots and chorus flowers
    if (hit.id === BID.decorated_pot) Pots.hitByProjectile(hit.x, hit.y, hit.z);
    else if (hit.id === BID.chorus_flower) { Drops.dropBlock(hit.id, hit.state, null, hit.x, hit.y, hit.z); Particles.blockBreak(hit.x, hit.y, hit.z, hit.id, hit.state); Blocks.remove(hit.x, hit.y, hit.z, null, true); }
  }
  groundTick() {
    if (this.shake > 0) this.shake--;
    // the block it was in is gone: fall again
    if (this.stuck && World.getBlock(this.stuck[0], this.stuck[1], this.stuck[2]) !== this.stuck[3]) { this.inGround = false; this.vx = (Math.random() - 0.5) * 0.04; this.vy = 0; this.vz = (Math.random() - 0.5) * 0.04; this.life = 0; return; }
    if (++this.groundTime >= 1200) this.removed = true;
    const p = Game.player;
    if (p && !p.dead && !p.spectator && this.pickup > 0 && Math.abs(p.x - this.x) < 1.3 && Math.abs(p.y + 0.9 - this.y) < 1.5 && Math.abs(p.z - this.z) < 1.3 && this.life > 7) {
      if (this.pickup === 2 && !p.creative) return;
      if (this.pickup === 1 && !p.creative) { const s = this.potion ? stack('tipped_arrow', 1, { tag: { potion: this.potion } }) : stack(this.spectral ? 'spectral_arrow' : 'arrow'); if (p.inv.addItem(s)) return; }
      EntityRender.pickup && EntityRender.pickup({ stack: stack(this.spectral ? 'spectral_arrow' : 'arrow'), age: 0, bobOffset: 0, x: this.x, y: this.y, z: this.z }, p);
      Sound.play('pop', p); this.removed = true;
    }
  }
  trail() { if (this.crit) Particles.crit && Particles.crit({ x: this.x, y: this.y, z: this.z, h: 0, w: 0 }, 1); }
  save() { return this.owner && this.owner.isPlayer && this.inGround ? { type: 'arrow', x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, pickup: this.pickup, stuck: this.stuck, potion: this.potion, spectral: this.spectral } : null; }
}
// snowballs, eggs, pearls, potions, experience bottles and wind charges: drawn as their item
class ThrownItem extends Projectile {
  constructor(kind, owner, x, y, z, data) { super(kind, owner, x, y, z); this.kind = kind; this.data = data || {}; this.gravity = kind === 'splash_potion' || kind === 'lingering_potion' ? 0.05 : kind === 'experience_bottle' ? 0.07 : kind === 'wind_charge' ? 0 : 0.03; this.item = IID[kind]; if (kind === 'wind_charge') this.noGravity = true; }
  onEntity(e) {
    if (this.kind === 'snowball') { e.hurt(e.type === 'blaze' ? 3 : 0, 'projectile', this.owner || this); if (e.knockback) e.knockback(0.4, -this.vx, -this.vz); }
    else if (this.kind === 'egg') { e.hurt(0, 'projectile', this.owner || this); if (e.knockback) e.knockback(0.4, -this.vx, -this.vz); }
    else if (this.kind === 'wind_charge') { Advancements.withDamage({ direct: this }, () => e.hurt(1, 'projectile', this.owner || this)); }
    this.impact();
  }
  onBlock(hit) { if (this.kind === 'wind_charge' && Redstone.windCharge) Redstone.windCharge(hit); this.impact(hit); }
  impact(hit) {
    const k = this.kind, x = this.x, y = this.y, z = this.z;
    this.removed = true;
    if (k === 'snowball') Particles.itemBreak && Particles.itemBreak(x, y, z, IID.snowball, 8);
    else if (k === 'egg') {
      Particles.itemBreak && Particles.itemBreak(x, y, z, IID.egg, 8);
      if (Math.random() < 1 / 8) { const n = Math.random() < 1 / 32 ? 4 : 1; for (let i = 0; i < n; i++) { const c = Mobs.spawnEntity('chicken', x, y, z); if (c) c.setBaby(); } }
    } else if (k === 'ender_pearl') {
      Particles.portal && Particles.portal(x, y, z, 1);
      const o = this.owner;
      if (o && !o.dead && o.dim === World.dim) {
        if (Math.random() < 0.05 && World.dim !== 'end') Mobs.spawnEntity('endermite', o.x, o.y, o.z);
        if (o.vehicle) Vehicles.dismount && Vehicles.dismount(o);
        o.x = o.px = x; o.y = o.py = y; o.z = o.pz = z; o.fallDistance = 0; o.vx = o.vy = o.vz = 0;
        o.hurt(5, 'fall'); Sound.play('enderman_teleport', o);
      }
    } else if (k === 'splash_potion' || k === 'lingering_potion') {
      Particles.potionSplash && Particles.potionSplash(x, y, z, this.data.potion);
      Sound.play('splash_potion', this);
      if (k === 'lingering_potion') { if (typeof Effects !== 'undefined' && Effects.cloud) Effects.cloud(x, y, z, this.data.potion, this.owner); return; }
      for (const e of Entities.list.concat([Game.player])) {
        if (!e || !e.addEffect || e.dead) continue;
        const d2 = e.dist2(x, y, z); if (d2 >= 16) continue;
        const f = 1 - Math.sqrt(d2) / 4;
        if (typeof Potions !== 'undefined') Potions.apply(e, this.data.potion, f, this.owner);
        else if (this.data.potion === 'harming') e.hurt(6 * f, 'magic', this.owner);
        else if (this.data.potion) e.addEffect(this.data.potion, Math.floor(this.data.dur || 900 * f * 0.75), 0);
      }
      if (this.data.potion === 'water') for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const bx = Math.floor(x) + dx, by = Math.floor(y), bz = Math.floor(z) + dz; if (World.getBlock(bx, by, bz) === BID.fire) World.setBlock(bx, by, bz, 0, 0); }
    } else if (k === 'experience_bottle') {
      Particles.potionSplash && Particles.potionSplash(x, y, z, 'experience');
      Sound.play('splash_potion', this);
      Drops.spawnXp(x, y, z, 3 + rnd(5) + rnd(5));
    } else if (k === 'wind_charge') {
      // a breeze's charge bursts wider (radius 3) with plain knockback; a thrown one is radius 1.2, knockback 1.22
      if (this.data.breeze) Explosions.wind && Explosions.wind(x, y, z, this.owner, 3, 1);
      else Explosions.wind && Explosions.wind(x, y, z, this.owner);
    }
  }
}
class Trident extends Arrow {
  constructor(owner, x, y, z, s) { super(owner, x, y, z, { pickup: owner && owner.isPlayer && !owner.creative ? 1 : 2 }); this.type = 'trident'; this.dmg = 8; this.stackItem = s; this.loyalty = enchLevel(s, 'loyalty'); this.dealt = false; this.returning = false; }
  onEntity(e) {
    if (this.dealt) return false;
    let d = 8; const imp = enchLevel(this.stackItem, 'impaling'); if (imp && (e.inWater || Weather.rainingAt(e.x, e.y, e.z) || ['squid', 'glow_squid', 'cod', 'salmon', 'tropical_fish', 'pufferfish', 'dolphin', 'guardian', 'elder_guardian', 'turtle', 'axolotl'].includes(e.type))) d += 2.5 * imp;
    if (Advancements.withDamage({ direct: this }, () => e.hurt(d, 'trident', this.owner || this))) Sound.play('trident_hit', this);
    this.dealt = true; this.vx *= -0.01; this.vy *= -0.1; this.vz *= -0.01;
    if (enchLevel(this.stackItem, 'channeling') && Weather.thundering && Weather.thundering() && World.skyLight(Math.floor(e.x), Math.floor(e.y) + 1, Math.floor(e.z)) >= 15) { Weather.lightning(e.x, e.y, e.z); if (this.owner && this.owner.isPlayer) Advancements.fire('channeled_lightning', { victims: [e] }); }
    if (this.loyalty) this.returning = true;
  }
  tick() {
    if (this.returning || (this.loyalty && this.inGround && this.life > 4)) {
      const o = this.owner; if (!o || o.dead) { this.returning = false; super.tick(); return; }
      this.inGround = false; this.noClip = true; this.px = this.x; this.py = this.y; this.pz = this.z; this.age++;
      const dx = o.x - this.x, dy = o.eyeY - this.y, dz = o.z - this.z, l = Math.hypot(dx, dy, dz) || 1, k = 0.05 * this.loyalty;
      this.vx = this.vx * 0.95 + dx / l * k * 4; this.vy = this.vy * 0.95 + dy / l * k * 4; this.vz = this.vz * 0.95 + dz / l * k * 4;
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      if (l < 1.5) { this.removed = true; if (o.isPlayer && !o.creative) { const left = o.inv.addItem(this.stackItem); if (left) Drops.spawnItem(o.x, o.y, o.z, left); } Sound.play('trident_return', o); }
      return;
    }
    super.tick();
  }
  groundTick() {
    const p = Game.player;
    if (p && !p.dead && this.pickup && Math.abs(p.x - this.x) < 1.3 && Math.abs(p.y + 0.9 - this.y) < 1.5 && Math.abs(p.z - this.z) < 1.3 && this.life > 7) { if (this.pickup === 1) { if (p.inv.addItem(this.stackItem)) return; } Sound.play('pop', p); this.removed = true; }
  }
  save() { return null; }
}
class EyeOfEnder extends Entity {
  constructor(x, y, z, tx, tz) { super('eye_of_ender', x, y, z); this.tx = tx; this.tz = tz; this.w = this.h = 0.25; this.life = 0; this.survive = Math.random() < 0.8; this.noPick = true; this.item = IID.ender_eye; }
  tick() {
    this.px = this.x; this.py = this.y; this.pz = this.z; this.age++;
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    const sp = Math.min(d, 12) ; const ty = d < 1 ? this.y - 1 : this.y + 8;
    const hx = d > 12 ? this.x + dx / d * 12 : this.tx, hz = d > 12 ? this.z + dz / d * 12 : this.tz;
    void sp;
    let vh = Math.hypot(this.vx, this.vz); const ang = Math.atan2(hz - this.z, hx - this.x);
    vh += (Math.hypot(hx - this.x, hz - this.z) > 0 ? 0.0025 : 0); vh = Math.min(vh, 0.2);
    this.vx = Math.cos(ang) * vh; this.vz = Math.sin(ang) * vh; this.vy += ((ty > this.y ? 1 : -1) * 0.1 - this.vy) * 0.015;
    if (this.vx === 0 && this.vz === 0) { this.vx = Math.cos(ang) * 0.01; this.vz = Math.sin(ang) * 0.01; }
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    Particles.portal && Particles.portal(this.x, this.y - 0.3, this.z, 0.3, 1);
    if (++this.life > 80) { this.removed = true; Sound.play('ender_eye_death', this); if (this.survive) Drops.spawnItem(this.x, this.y, this.z, stack('ender_eye')); else Particles.itemBreak && Particles.itemBreak(this.x, this.y, this.z, IID.ender_eye, 8); }
  }
}
class Firework extends Entity {
  constructor(x, y, z, tag, attached) { super('firework_rocket', x, y, z); this.tag = tag || {}; this.attached = attached; this.w = this.h = 0.25; this.life = 0; this.lifetime = 10 * ((this.tag.flight || 1) + 1) + rnd(6) + rnd(7); this.vx = (Math.random() - 0.5) * 0.002 * 23; this.vz = (Math.random() - 0.5) * 0.002 * 23; this.vy = 0.05; this.noPick = true; this.item = IID.firework_rocket; Sound.play('firework_launch', this); }
  tick() {
    this.tickBase();
    const a = this.attached;
    if (a) { // elytra boost
      if (a.gliding) { const lv = a.lookVec(); a.vx += lv[0] * 0.1 + (lv[0] * 1.5 - a.vx) * 0.5; a.vy += lv[1] * 0.1 + (lv[1] * 1.5 - a.vy) * 0.5; a.vz += lv[2] * 0.1 + (lv[2] * 1.5 - a.vz) * 0.5; }
      this.x = a.x; this.y = a.y; this.z = a.z;
    } else { this.vx *= 1.15; this.vz *= 1.15; this.vy += 0.04; Phys.move(this, this.vx, this.vy, this.vz); if (this.hitH || this.hitV) this.life = this.lifetime; }
    Particles.fireworkTrail && Particles.fireworkTrail(this.x, this.y, this.z);
    if (++this.life >= this.lifetime) this.explode();
  }
  explode() {
    this.removed = true;
    const stars = this.tag.explosions || [];
    if (stars.length) {
      Sound.play('firework_blast', this, { large: stars.some(s => s.shape === 'large_ball') });
      Particles.firework && Particles.firework(this.x, this.y, this.z, stars);
      const dmg = 5 + 2 * stars.length;
      for (const e of Entities.list.concat([Game.player])) if (e && e.hurt && !e.dead && e.dist2(this.x, this.y, this.z) <= 25) e.hurt(dmg * Math.max(0, 1 - Math.sqrt(e.dist2(this.x, this.y, this.z)) / 5), 'firework', this);
    }
  }
}

const Projectiles = (() => {
  // the game's shoot: a direction with a little random spread, times the speed
  function shoot(e, dx, dy, dz, speed, inaccuracy) {
    const l = Math.hypot(dx, dy, dz) || 1;
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
    dx = dx / l + g() * 0.0075 * inaccuracy; dy = dy / l + g() * 0.0075 * inaccuracy; dz = dz / l + g() * 0.0075 * inaccuracy;
    e.vx = dx * speed; e.vy = dy * speed; e.vz = dz * speed;
    const h = Math.hypot(e.vx, e.vz); e.yaw = e.pyaw = Math.atan2(-e.vx, -e.vz); e.pitch = e.ppitch = -Math.atan2(e.vy, h);
  }
  function fromLook(p, e, speed, inaccuracy) {
    const lv = p.lookVec(); shoot(e, lv[0], lv[1], lv[2], speed, inaccuracy);
    // the shooter's own motion carries over
    e.vx += p.vx; e.vz += p.vz; if (!p.onGround) e.vy += p.vy;
  }
  function spawnArrow(owner, x, y, z, o) { return Entities.add(new Arrow(owner, x, y, z, o && o.kind ? o.kind : o)); }
  function spawn(kind, owner, x, y, z, data) { return Entities.add(new ThrownItem(kind, owner, x, y, z, data)); }
  // the arrow to shoot: off hand first, then the hotbar and inventory
  function findAmmo(p, crossbow) {
    const ok = n => n === 'arrow' || n === 'spectral_arrow' || n === 'tipped_arrow' || (crossbow && n === 'firework_rocket');
    if (p.inv.offhand && ok(ITEMS[p.inv.offhand.id].name)) return 40;
    if (p.inv.held && ok(ITEMS[p.inv.held.id].name)) return p.inv.selected;
    for (let i = 0; i < 36; i++) { const s = p.inv.get(i); if (s && ok(ITEMS[s.id].name)) return i; }
    return -1;
  }
  function takeAmmo(p, crossbow) {
    const i = findAmmo(p, crossbow);
    if (i < 0) return p.creative ? stack('arrow') : null;
    const s = p.inv.get(i), out = Object.assign({}, s, { count: 1 });
    const inf = !crossbow && p.inv.held && enchLevel(p.inv.held, 'infinity') && ITEMS[s.id].name === 'arrow';
    if (!p.creative && !inf) { s.count--; if (!s.count) p.inv.set(i, null); p.inv.changed(); }
    out.free = p.creative || inf;
    return out;
  }
  function arrowFrom(owner, ammo) {
    const n = ITEMS[ammo.id].name;
    const a = new Arrow(owner, owner.x, owner.eyeY - 0.1, owner.z, { spectral: n === 'spectral_arrow', potion: n === 'tipped_arrow' && ammo.tag ? ammo.tag.potion : null, pickup: ammo.free ? 2 : 1 });
    return a;
  }
  // a bow shot: speed 3 x power, critical at full draw, Power adds 0.5 + 0.5 per level
  function bow(p, s, f) {
    const ammo = takeAmmo(p, false); if (!ammo) return;
    const a = arrowFrom(p, ammo);
    fromLook(p, a, f * 3, 1);
    if (f >= 1) a.crit = true;
    const pw = enchLevel(s, 'power'); if (pw) a.dmg += pw * 0.5 + 0.5;
    a.knock = enchLevel(s, 'punch');
    if (enchLevel(s, 'flame')) a.fireTicks = 100;
    Entities.add(a);
    p.inv.damageHeld(1, p);
    Sound.play('bow_shoot', p, { pitch: 1 / (Math.random() * 0.4 + 1.2) + f * 0.5 });
    Stats.add('used', 'bow');
  }
  function crossbow(p, s) {
    const ammo = s.tag && s.tag.charged; if (!ammo) return;
    const multi = enchLevel(s, 'multishot'), angles = multi ? [0, -10, 10] : [0];
    for (const ang of angles) {
      if (ITEMS[ammo.id].name === 'firework_rocket') { const fw = new Firework(p.x, p.eyeY - 0.15, p.z, ammo.tag, null); fromLook(p, fw, 1.6, 1); Entities.add(fw); continue; }
      const a = arrowFrom(p, Object.assign({}, ammo, { free: ang !== 0 || ammo.free })); a.pierce = enchLevel(s, 'piercing'); a.dmg = 2;
      const yaw = p.yaw + ang * Math.PI / 180, cp = Math.cos(p.pitch);
      shoot(a, -Math.sin(yaw) * cp, -Math.sin(p.pitch), -Math.cos(yaw) * cp, 3.15, 1);
      a.crit = true; a.fromCrossbow = true; Entities.add(a);
    }
    if (p.isPlayer) Advancements.fire('shot_crossbow', { item: s });
    p.inv.damageHeld(multi ? 3 : 1, p);
    Sound.play('crossbow_shoot', p);
  }
  function trident(p, s, off) {
    const t = new Trident(p, p.x, p.eyeY - 0.1, p.z, Object.assign({}, s));
    fromLook(p, t, 2.5, 1);
    Entities.add(t);
    damageItem(s, 1, p, () => {});
    if (!p.creative) { if (off) p.inv.set(40, null); else p.inv.held = null; p.inv.changed(); }
    Sound.play('trident_throw', p);
  }
  function throwItem(p, s) {
    const n = ITEMS[s.id].name;
    const e = new ThrownItem(n, p, p.x, p.eyeY - 0.1, p.z, { potion: s.tag && s.tag.potion });
    if (n === 'experience_bottle') { const lv = p.lookVec(); shoot(e, lv[0], lv[1], lv[2], 0.7, 1); e.vy += 0; /* thrown 20 degrees up */ const pt = p.pitch - 20 * Math.PI / 180, cp = Math.cos(pt); shoot(e, -Math.sin(p.yaw) * cp, -Math.sin(pt), -Math.cos(p.yaw) * cp, 0.7, 1); }
    else if (n === 'splash_potion' || n === 'lingering_potion') { const pt = p.pitch - 20 * Math.PI / 180, cp = Math.cos(pt); shoot(e, -Math.sin(p.yaw) * cp, -Math.sin(pt), -Math.cos(p.yaw) * cp, 0.5, 1); }
    else fromLook(p, e, n === 'wind_charge' ? 1.5 : 1.5, 1);
    Entities.add(e);
    Sound.play(n === 'ender_pearl' ? 'ender_pearl_throw' : n === 'wind_charge' ? 'wind_charge_throw' : 'throw', p);
  }
  function eyeOfEnder(p, t) { const e = new EyeOfEnder(p.x, p.eyeY - 0.2, p.z, t[0], t[1]); Entities.add(e); Sound.play('ender_eye_launch', p); }
  function firework(x, y, z, tag, attached) { Entities.add(new Firework(x, y, z, tag, attached)); }
  function restore(d) {
    if (d.type !== 'arrow') return false;
    const a = new Arrow(null, d.x, d.y, d.z, { pickup: d.pickup, potion: d.potion, spectral: d.spectral }); a.yaw = a.pyaw = d.yaw; a.pitch = a.ppitch = d.pitch; a.inGround = true; a.stuck = d.stuck; a.life = 100;
    Entities.add(a); return true;
  }
  return { shoot, spawnArrow, spawn, takeAmmo, bow, crossbow, trident, throwItem, eyeOfEnder, firework, restore, Arrow, ThrownItem, Firework };
})();

// ---------------------------------------------------------------- explosions
const Explosions = (() => {
  const resist = id => { const md = MCDATA.blocks[BLOCKS[id].name]; return md ? md[2] : 0; };
  // how much of an entity the explosion can see (rays to a grid over its box)
  function exposure(x, y, z, e) {
    const hw = e.w / 2, sx = 1 / (e.w * 2 + 1), sy = 1 / (e.h * 2 + 1);
    let hit = 0, n = 0;
    const ox = (1 - Math.floor(1 / sx) * sx) / 2, oz = (1 - Math.floor(1 / sx) * sx) / 2;
    for (let a = 0; a <= 1; a += sx) for (let b = 0; b <= 1; b += sy) for (let c = 0; c <= 1; c += sx) {
      const px = e.x - hw + a * e.w + ox, py = e.y + b * e.h, pz = e.z - hw + c * e.w + oz;
      const dx = px - x, dy = py - y, dz = pz - z, l = Math.hypot(dx, dy, dz);
      if (l < 1e-6 || !Phys.raycast(x, y, z, dx / l, dy / l, dz / l, l, id => SOLID[id] && OPAQUE[id])) hit++;
      n++;
    }
    return n ? hit / n : 0;
  }
  function explode(x, y, z, power, fire, source, breakBlocks) {
    if (breakBlocks === undefined) breakBlocks = true;
    const inFluid = BLOCKS[World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))].fluid;
    const set = new Map();
    if (breakBlocks && !inFluid) {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
        if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15) continue;
        let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
        let h = power * (0.7 + Math.random() * 0.6), px = x, py = y, pz = z;
        while (h > 0) {
          const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
          if (by < MINY || by > MAXY) break;
          const id = World.getBlock(bx, by, bz);
          const fl = BLOCKS[id].fluid ? 100 : 0;
          // some explosions (a blue wither skull's) treat blocks as weaker than they are
          const rc = id && source && source.resistCap ? source.resistCap(id) : null, rs = rc !== null && rc !== undefined ? Math.min(rc, resist(id)) : resist(id);
          if (id !== 0) h -= ((BLOCKS[id].fluid ? fl : rs) + 0.3) * 0.3;
          if (h > 0 && id !== 0 && !BLOCKS[id].fluid && resist(id) < 3600000 && !(source && source.resistCap && Withers.isImmune(id) && source.dangerous)) set.set(bx + ',' + by + ',' + bz, [bx, by, bz, id]);
          px += dx * 0.3; py += dy * 0.3; pz += dz * 0.3; h -= 0.22500001;
        }
      }
    }
    // entities: damage and knockback by distance and exposure
    const r2 = power * 2;
    for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) {
      if (!e || e.removed || e === source && source && source.type === 'creeper') continue;
      const d = Math.sqrt(e.dist2(x, y, z)) / r2; if (d > 1) continue;
      let dx = e.x - x, dy = (e.living || e.isPlayer ? e.eyeY : e.y) - y, dz = e.z - z; const l = Math.hypot(dx, dy, dz); if (l === 0) continue; dx /= l; dy /= l; dz /= l;
      const ex = exposure(x, y, z, e), imp = (1 - d) * ex;
      const dmg = Math.floor((imp * imp + imp) / 2 * 7 * r2 + 1);
      if (e.hurt) e.hurt(dmg, 'explosion', source);
      let kb = imp;
      if (e.isPlayer) { const bp = e.armorEnch ? e.armorEnch('blast_protection') : 0; if (bp) kb *= 1 - 0.15 * bp; if (e.creative && e.flying) kb = 0; }
      if (e.living || e.isPlayer || e.type === 'item' || e.type === 'tnt' || e instanceof Projectile || e.blockId !== undefined) { e.vx += dx * kb; e.vy += dy * kb; e.vz += dz * kb; }
      if (e.type === 'item' && e.hurt) e.hurt(dmg, 'explosion');
    }
    // blocks break (each drops with a chance of 1 in the power)
    const list = [...set.values()];
    for (const [bx, by, bz, id] of list) {
      if (World.getBlock(bx, by, bz) !== id) continue;
      const n = BLOCKS[id].name;
      if (n === 'tnt') { World.setBlock(bx, by, bz, 0, 0); primeTnt(bx, by, bz, source, 10 + rnd(20)); continue; }
      const be = World.getBE(bx, by, bz);
      if (be && be.loot) LootTables.unpackContainer(be, null);
      if (be && be.items && !n.endsWith('shulker_box')) for (const s of be.items) if (s) Drops.spawnItem(bx + 0.5, by + 0.5, bz + 0.5, s, true);
      if (Math.random() < 1 / power && Game.rules.doTileDrops) Drops.dropBlock(id, World.getState(bx, by, bz), null, bx, by, bz);
      Blocks.remove(bx, by, bz, null, true);
    }
    if (fire) for (const [bx, by, bz] of list) if (rnd(3) === 0 && World.getBlock(bx, by, bz) === 0 && OPAQUE[World.getBlock(bx, by - 1, bz)]) World.setBlock(bx, by, bz, BID.fire, 0);
    Particles.explosion && Particles.explosion(x, y, z, power >= 2 && breakBlocks);
    Sound.play('explode', null, { x, y, z });
  }
  // primed TNT: falls, flashes, and explodes after 80 ticks with power 4
  class PrimedTnt extends Entity {
    constructor(x, y, z, fuse, igniter) { super('tnt', x, y, z); this.fuse = fuse; this.igniter = igniter; this.w = this.h = 0.98; this.blockId = BID.tnt; const a = Math.random() * Math.PI * 2; this.vx = -Math.sin(a) * 0.02; this.vy = 0.2; this.vz = -Math.cos(a) * 0.02; this.noPick = true; }
    tick() {
      this.tickBase();
      this.vy -= 0.04; Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
      if (this.onGround) { this.vx *= 0.7; this.vz *= 0.7; this.vy *= -0.5; }
      if (--this.fuse <= 0) { this.removed = true; explode(this.x, this.y + 0.0625, this.z, 4, false, this, !this.inWater); }
      else Particles.smoke && Particles.smoke({ x: this.x, y: this.y + 0.5, z: this.z, w: 0, h: 0 }, 1);
    }
    flash(a) { const f = this.fuse - a + 1; return Math.floor(f / 5) % 2 === 0 ? 0.8 : 0; }
    renderScale(a) { const f = this.fuse - a + 1; if (f < 10) { let k = 1 - f / 10; k = Math.max(0, Math.min(1, k)); k *= k; k *= k; return 1 + k * 0.3; } return 1; }
    get eyeY() { return this.y + 0.5; }
    hurt() { return false; }
    save() { return null; }
  }
  function primeTnt(x, y, z, igniter, fuse) {
    if (World.getBlock(x, y, z) === BID.tnt) World.setBlock(x, y, z, 0, 0);
    const t = new PrimedTnt(x + 0.5, y, z + 0.5, fuse || 80, igniter);
    Entities.add(t); Sound.play('tnt_primed', t);
    return t;
  }
  function spawnTnt(x, y, z, fuse) { return Entities.add(new PrimedTnt(x, y, z, fuse || 80)); }
  // wind charges: a burst that pushes entities and toggles doors, no block damage
  // a wind charge's burst (radius 1.2, knockback 1.22) and the mace's wind burst: the game's explosion
  // knockback without the damage, toward each entity's eyes, scaled by how close and how exposed it is
  function wind(x, y, z, owner, r, mult) {
    r = r || 1.2; mult = mult || 1.22;
    Particles.gust && Particles.gust(x, y, z);
    Sound.play('wind_burst', null, { x, y, z });
    const q = r * 2;
    for (const e of Entities.list.concat([Game.player])) {
      if (!e || e.removed || e.spectator || (e.isPlayer && e.creative && e.flying)) continue;
      const w = Math.sqrt(e.dist2(x, y, z)) / q; if (w > 1) continue;
      let dx = e.x - x, dy = (e.eyeY !== undefined && (e.living || e.isPlayer) ? e.eyeY : e.y) - y, dz = e.z - z; const l = Math.hypot(dx, dy, dz); if (l === 0) continue;
      const k = (1 - w) * exposure(x, y, z, e) * mult;
      e.vx += dx / l * k; e.vy += dy / l * k; e.vz += dz / l * k;
      // launched by wind: falling only counts from here
      if (e.isPlayer || e.living) e.fallDistance = 0;
      if (e.isPlayer) e.launchedBy = { x: e.x, y: e.y, z: e.z, cause: owner && owner.kind === 'wind_charge' ? owner : { type: 'wind_charge' }, t: Game.gameTime };
    }
  }
  return { explode, primeTnt, spawnTnt, wind, PrimedTnt, exposure };
})();
