'use strict';
/* Entities: the base class and living entities, with the game's movement physics (20 ticks per second):
   walking accelerates by speed * 0.98 and keeps 0.6 * 0.91 of its speed per tick on normal ground, gravity
   takes 0.08 per tick and air drag keeps 98%, water keeps 80%, lava 50%, ladders cap the speed at 0.15. */
let nextEntityId = 1;
const Entities = { list: [], byId: new Map(), add(e) { this.list.push(e); this.byId.set(e.id, e); if (e.onAdd) e.onAdd(); return e; }, remove(e) { e.removed = true; } };

class Entity {
  constructor(type, x, y, z) {
    this.id = nextEntityId++; this.type = type;
    this.x = x; this.y = y; this.z = z; this.px = x; this.py = y; this.pz = z;
    this.vx = 0; this.vy = 0; this.vz = 0; this.yaw = 0; this.pitch = 0; this.pyaw = 0; this.ppitch = 0;
    this.w = 0.6; this.h = 1.8; this.onGround = false; this.removed = false; this.age = 0;
    this.fallDistance = 0; this.fireTicks = 0; this.inWater = false; this.inLava = false; this.eyesInWater = false; this.noGravity = false;
    this.portalTime = 0; this.portalCooldown = 0; this.dim = World.dim; this.passengers = []; this.vehicle = null;
  }
  get eyeY() { return this.y + this.h * 0.85; }
  tickBase() {
    this.px = this.x; this.py = this.y; this.pz = this.z; this.pyaw = this.yaw; this.ppitch = this.pitch;
    this.age++;
    this.updateFluids();
    if (this.fireTicks > 0) {
      if (this.inWater || (Weather.rainingAt(this.x, this.y, this.z))) this.fireTicks = 0;
      else { if (this.fireTicks % 20 === 0 && this.hurt && !this.fireImmune) this.hurt(1, 'onFire'); this.fireTicks--; }
    }
    if (this.inLava && !this.fireImmune) { this.fireTicks = Math.max(this.fireTicks, 300); if (this.hurt) this.hurt(4, 'lava'); }
    if (this.y < MINY - 64 && this.hurt) this.hurt(4, 'outOfWorld');
    if (this.portalCooldown > 0) this.portalCooldown--;
  }
  updateFluids() {
    const hw = this.w / 2;
    this.inWater = false; this.inLava = false;
    let wTop = -1e9;
    const x0 = Math.floor(this.x - hw + 0.001), x1 = Math.floor(this.x + hw - 0.001), y0 = Math.floor(this.y + 0.001), y1 = Math.floor(this.y + this.h - 0.001), z0 = Math.floor(this.z - hw + 0.001), z1 = Math.floor(this.z + hw - 0.001);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = World.getBlock(x, y, z), d = BLOCKS[id];
      const water = d.fluid === 'water' || d.fluidLog || (d.waterlog && (World.getState(x, y, z) & 128));
      if (!water && d.fluid !== 'lava') continue;
      const st = World.getState(x, y, z);
      const top = y + (d.fluid ? (BLOCKS[World.getBlock(x, y + 1, z)].fluid === d.fluid ? 1 : (8 - (st & 7)) / 9) : 1);
      if (top <= this.y) continue;
      if (water) { this.inWater = true; wTop = Math.max(wTop, top); } else this.inLava = true;
    }
    this.waterTop = wTop;
    const ey = this.eyeY, ex = Math.floor(this.x), ez = Math.floor(this.z), eb = World.getBlock(ex, Math.floor(ey), ez), ed = BLOCKS[eb];
    const ewater = ed.fluid === 'water' || ed.fluidLog || (ed.waterlog && (World.getState(ex, Math.floor(ey), ez) & 128));
    if (ewater) { const st = World.getState(ex, Math.floor(ey), ez); const top = Math.floor(ey) + (ed.fluid && BLOCKS[World.getBlock(ex, Math.floor(ey) + 1, ez)].fluid !== 'water' ? (8 - (st & 7)) / 9 : 1); this.eyesInWater = ey < top; }
    else this.eyesInWater = false;
    this.eyesInLava = ed.fluid === 'lava';
    if (this.inWater) { this.fallDistance = 0; }
  }
  distTo(e) { const dx = this.x - e.x, dy = this.y - e.y, dz = this.z - e.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
  dist2(x, y, z) { const dx = this.x - x, dy = this.y - y, dz = this.z - z; return dx * dx + dy * dy + dz * dz; }
  bb() { const hw = this.w / 2; return [this.x - hw, this.y, this.z - hw, this.x + hw, this.y + this.h, this.z + hw]; }
  intersects(b) { const a = this.bb(); return a[3] > b[0] && a[0] < b[3] && a[4] > b[1] && a[1] < b[4] && a[5] > b[2] && a[2] < b[5]; }
  lookVec() { const cp = Math.cos(this.pitch); return [-Math.sin(this.yaw) * cp, -Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }
}

class Living extends Entity {
  constructor(type, x, y, z) {
    super(type, x, y, z);
    this.maxHealth = 20; this.health = 20; this.absorption = 0;
    this.hurtTime = 0; this.invul = 0; this.deathTime = 0; this.dead = false; this.lastDamage = 0;
    this.speed = 0.1; this.jumpPower = 0.42; this.effects = new Map();
    this.forward = 0; this.strafe = 0; this.jumping = false; this.sneaking = false; this.sprinting = false;
    this.armorPts = 0; this.toughness = 0; this.kbResist = 0; this.attackStrength = 1;
    this.walkDist = 0; this.pwalkDist = 0; this.limbSwing = 0; this.limbAmount = 0; this.plimbAmount = 0; this.jumpCooldown = 0;
    this.bodyYaw = 0; this.pbodyYaw = 0; this.headYaw = 0; this.pheadYaw = 0; this.swing = 0; this.pswing = 0; this.swinging = false; this.swingTime = 0;
    this.air = 300; this.lastHurtBy = null; this.lastHurtTime = 0;
  }
  effect(name) { return this.effects.get(name); }
  addEffect(name, dur, amp, o) {
    const cur = this.effects.get(name);
    if (cur && cur.amp > amp) return;
    if (cur && cur.amp === amp && cur.dur > dur) return;
    this.effects.set(name, Object.assign({ dur, amp: amp || 0, ambient: false, particles: true }, o || {}));
    if (name === 'health_boost') this.maxHealth = 20 + 4 * ((amp || 0) + 1);
    if (name === 'absorption') this.absorption = Math.max(this.absorption, 4 * ((amp || 0) + 1));
    if (name === 'instant_health') { this.heal(4 << (amp || 0)); this.effects.delete(name); }
    if (name === 'instant_damage') { this.hurt(6 << (amp || 0), 'magic'); this.effects.delete(name); }
  }
  removeEffect(name) { this.effects.delete(name); if (name === 'health_boost') { this.maxHealth = 20; this.health = Math.min(this.health, 20); } if (name === 'absorption') this.absorption = 0; }
  tickEffects() {
    for (const [n, e] of this.effects) {
      if (n === 'regeneration' && e.dur % Math.max(1, 50 >> e.amp) === 0) this.heal(1);
      if (n === 'poison' && e.dur % Math.max(1, 25 >> e.amp) === 0 && this.health > 1 && !this.undead) this.hurt(1, 'magic');
      if (n === 'wither' && e.dur % Math.max(1, 40 >> e.amp) === 0) this.hurt(1, 'wither');
      if (n === 'hunger' && this.food !== undefined) this.exhaust(0.005 * (e.amp + 1));
      if (n === 'saturation' && this.food !== undefined) this.eat(e.amp + 1, 0);
      if (--e.dur <= 0 && e.dur > -1000) this.removeEffect(n);
    }
  }
  heal(n) { if (this.dead) return; this.health = Math.min(this.maxHealth, this.health + n); }
  get speedAttr() {
    let s = this.speed;
    const sp = this.effect('speed'), sl = this.effect('slowness');
    if (sp) s *= 1 + 0.2 * (sp.amp + 1);
    if (sl) s *= Math.max(0, 1 - 0.15 * (sl.amp + 1));
    if (this.sprinting) s *= 1.3;
    return s;
  }
  // block friction under the feet (ice is slippery)
  friction() { const id = World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5000001), Math.floor(this.z)); return BLOCKS[id].slip; }
  onClimbable() { const id = World.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)); const d = BLOCKS[id]; if (d.climb) return true; if (d.model === 'trapdoor') { const st = World.getState(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)); if (st & 16) { const b = World.getBlock(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z)); return b === BID.ladder; } } return false; }
  speedFactor() { const id = World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5000001), Math.floor(this.z)); const id2 = World.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)); return Math.min(BLOCKS[id].speed, BLOCKS[id2].speed); }
  jump() {
    let j = this.jumpPower * BLOCKS[World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5000001), Math.floor(this.z))].jump;
    const jb = this.effect('jump_boost'); if (jb) j += 0.1 * (jb.amp + 1);
    this.vy = j;
    if (this.sprinting) { const yaw = this.yaw; this.vx += -Math.sin(yaw) * 0.2; this.vz += -Math.cos(yaw) * 0.2; }
    this.onJump && this.onJump();
  }
  // add movement in the facing direction (strafe, forward), like Entity.moveRelative
  moveRelative(speed, strafe, forward) {
    let l = strafe * strafe + forward * forward;
    if (l < 1e-7) return;
    l = Math.sqrt(l); if (l < 1) l = 1;
    strafe *= speed / l; forward *= speed / l;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // yaw 0 looks toward -z (north)
    // strafe is positive to the left, which is (-cos, sin) when facing (-sin, -cos)
    this.vx += -strafe * c - forward * s;
    this.vz += strafe * s - forward * c;
  }
  travel() {
    const strafe = this.strafe * 0.98, forward = this.forward * 0.98;
    const flying = this.flying;
    if (this.inWater && !flying) {
      const y0 = this.y;
      let f = this.sprinting ? 0.9 : 0.8, sp = 0.02;
      const ds = this.depthStrider || 0; if (ds > 0) { const k = Math.min(3, ds) / 3 * (this.onGround ? 1 : 0.5); f += (0.546 - f) * k; sp += (this.speedAttr - sp) * k; }
      if (this.effect('dolphins_grace')) f = 0.96;
      this.moveRelative(sp, strafe, forward);
      Phys.move(this, this.vx, this.vy, this.vz);
      this.vx *= f; this.vy *= 0.8; this.vz *= f;
      if (!this.swimmingUp) this.vy -= this.noGravity ? 0 : 0.02;
      // swimming into a ledge lifts you out of the water
      const hw = this.w / 2, oy = this.vy + 0.6 - this.y + y0;
      if (this.hitH && Phys.boxFree(this.x - hw + this.vx, this.y + oy, this.z - hw + this.vz, this.x + hw + this.vx, this.y + this.h + oy, this.z + hw + this.vz)) this.vy = 0.3;
    } else if (this.inLava && !flying) {
      this.moveRelative(0.02, strafe, forward);
      Phys.move(this, this.vx, this.vy, this.vz);
      this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5;
      if (!this.noGravity) this.vy -= 0.02;
      if (this.hitH) this.vy = 0.3;
    } else {
      const fr = this.onGround ? this.friction() : 0;
      const slip = this.onGround ? fr * 0.91 : 0.91;
      let sp = this.onGround ? this.speedAttr * (0.21600002 / (fr * fr * fr)) : (flying ? this.flySpeed * (this.sprinting ? 2 : 1) : (this.sprinting ? 0.025999999 : 0.02));
      sp *= this.onGround ? this.speedFactor() : 1;
      this.moveRelative(sp, strafe, forward);
      const climb = !flying && this.onClimbable();
      if (climb) {
        this.fallDistance = 0;
        this.vx = Math.max(-0.15, Math.min(0.15, this.vx)); this.vz = Math.max(-0.15, Math.min(0.15, this.vz));
        this.vy = Math.max(this.vy, -0.15);
        if (this.vy < 0 && this.sneaking && this.isPlayer) this.vy = 0;
      }
      // cobwebs slow everything to a crawl
      if (this.inWeb) { this.vx *= 0.25; this.vy *= 0.05; this.vz *= 0.25; }
      Phys.move(this, this.vx, this.vy, this.vz);
      if (this.inWeb) { this.vx = this.vy = this.vz = 0; this.fallDistance = 0; }
      if ((this.hitH || this.jumping) && climb) this.vy = 0.2;
      const lev = this.effect('levitation');
      if (lev) this.vy += (0.05 * (lev.amp + 1) - this.vy) * 0.2;
      else if (!this.noGravity && !flying) this.vy -= (this.vy <= 0 && this.effect('slow_falling')) ? 0.01 : 0.08;
      if (flying) this.vy *= 0.6; else this.vy *= 0.98;
      this.vx *= slip; this.vz *= slip;
    }
  }
  // fall damage when landing (fall distance - 3, less with jump boost and feather falling)
  updateFall(prevY) {
    const dy = this.y - prevY;
    if (this.onGround) {
      const ex = Math.floor(this.x), ey = Math.floor(this.y), ez = Math.floor(this.z);
      if (World.getBlock(ex, ey, ez) === BID.turtle_egg && this.type !== 'item' && this.type !== 'xp_orb') BlockExtras.trample(this, ex, ey, ez, this.fallDistance > 0);
      if (this.fallDistance > 0) {
        const land = World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
        this.onLand && this.onLand(this.fallDistance, land);
        let dmg = Math.ceil(this.fallDistance - 3 - (this.effect('jump_boost') ? this.effect('jump_boost').amp + 1 : 0));
        if (land === BID.hay_block) dmg = Math.ceil(dmg * 0.2);
        if (land === BID.slime_block && !this.sneaking) dmg = 0;
        if (BLOCKS[land].fluid === 'water' || this.inWater) dmg = 0;
        if (land === BID.powder_snow) dmg = 0;
        if (BLOCKS[land].name.endsWith('_bed')) dmg = Math.ceil(dmg * 0.5);
        if (dmg > 0 && !this.noFallDamage) this.hurt(dmg, 'fall');
        this.fallDistance = 0;
        // slime blocks bounce you back up
        if (land === BID.slime_block && !this.sneaking && this.vyBeforeMove < -0.1) { this.vy = -this.vyBeforeMove; this.onGround = false; }
      }
    } else if (dy < 0) this.fallDistance -= dy;
    if (this.inWater || this.flying || this.onClimbable()) this.fallDistance = 0;
  }
  tickLiving() {
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invul > 0) this.invul--;
    this.tickEffects();
    this.inWeb = Phys.touching(this, id => id === BID.cobweb || id === BID.sweet_berry_bush || id === BID.powder_snow);
    if (this.jumpCooldown > 0) this.jumpCooldown--;
    if (this.jumping) {
      if (this.inWater || this.inLava) { this.vy += 0.04; this.swimmingUp = true; }
      else if (this.onGround && this.jumpCooldown === 0) { this.jump(); this.jumpCooldown = 10; }
    } else { this.jumpCooldown = 0; this.swimmingUp = false; }
    if (Math.abs(this.vx) < 0.003) this.vx = 0; if (Math.abs(this.vy) < 0.003) this.vy = 0; if (Math.abs(this.vz) < 0.003) this.vz = 0;
    const py = this.y;
    this.vyBeforeMove = this.vy;
    if (!this.dead) this.travel(); else { this.vx *= 0.8; this.vz *= 0.8; this.vy -= 0.08; Phys.move(this, this.vx, this.vy, this.vz); this.vy *= 0.98; }
    this.updateFall(py);
    // limb animation
    this.plimbAmount = this.limbAmount; this.pwalkDist = this.walkDist;
    const dx = this.x - this.px, dz = this.z - this.pz;
    let d = Math.sqrt(dx * dx + dz * dz) * 4; if (d > 1) d = 1;
    this.limbAmount += (d - this.limbAmount) * 0.4; this.limbSwing += this.limbAmount;
    this.walkDist += Math.sqrt(dx * dx + dz * dz) * 0.6;
    // swinging the arm
    this.pswing = this.swing;
    if (this.swinging) { this.swingTime++; if (this.swingTime >= 6) { this.swingTime = 0; this.swinging = false; } } else this.swingTime = 0;
    this.swing = this.swingTime / 6;
    // body follows the movement, the head looks where it wants
    this.pbodyYaw = this.bodyYaw; this.pheadYaw = this.headYaw;
    if (d > 0.05) { const target = Math.atan2(-dx, -dz); this.bodyYaw = turnToward(this.bodyYaw, target, 0.3); }
    this.headYaw = this.yaw;
    let diff = angleDiff(this.headYaw, this.bodyYaw); if (Math.abs(diff) > 0.87) this.bodyYaw = this.headYaw - Math.sign(diff) * 0.87;
    if (this.dead) { this.deathTime++; }
  }
  swingArm() { if (!this.swinging || this.swingTime >= 3) { this.swingTime = -1; this.swinging = true; } }
}
function angleDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function turnToward(a, b, max) { const d = angleDiff(b, a); return a + Math.max(-max, Math.min(max, d)); }
