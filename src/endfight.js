'use strict';
/* The End: the dragon fight as the game runs it.
   - End crystals sit on the ten obsidian spikes and heal the dragon (1 health every half second, within 32
     blocks); hitting one makes it explode (power 6)
   - The Ender Dragon (200 health) circles the spikes, strafes the player with fireballs, lands on the exit
     portal to breathe and roar, takes off again, charges; its head takes full damage, the rest a quarter + 1;
     arrows bounce off while it perches; it breaks through blocks except obsidian, end stone, iron bars...
   - When it dies (200 ticks, 12000 experience the first time, 500 after) the exit portal opens, the egg
     appears the first time, and an End gateway to the outer islands appears
   Also the area effect cloud used by dragon's breath and lingering potions. */

// ---------------------------------------------------------------- area effect clouds (lingering potions, dragon's breath)
class AreaEffectCloud extends Entity {
  constructor(x, y, z, o) {
    super('area_effect_cloud', x, y, z);
    this.radius = o.radius || 3; this.duration = o.duration || 600; this.waitTime = o.wait === undefined ? 10 : o.wait;
    this.radiusPerTick = o.perTick !== undefined ? o.perTick : -this.radius / this.duration; this.radiusOnUse = o.onUse !== undefined ? o.onUse : -0.5;
    this.effects = o.effects || []; this.color = o.color || 0xffffff; this.breath = !!o.breath; this.owner = o.owner || null;
    this.victims = new Map(); this.noPick = true; this.w = this.radius * 2; this.h = 0.5; this.reapply = 20;
  }
  get living() { return false; }
  tick() {
    this.age++;
    if (this.age >= this.waitTime + this.duration) { this.removed = true; return; }
    const waiting = this.age < this.waitTime;
    if (!waiting) { this.radius += this.radiusPerTick; if (this.radius < 0.5) { this.removed = true; return; } }
    // particles over the area
    const n = Math.ceil(Math.PI * this.radius * this.radius * (waiting ? 0.05 : 0.25));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.radius;
      if (this.breath) Particles.dragonBreath && Particles.dragonBreath(this.x + Math.cos(a) * r, this.y, this.z + Math.sin(a) * r);
      else Particles.effects && Particles.effects({ x: this.x + Math.cos(a) * r, y: this.y, z: this.z + Math.sin(a) * r, w: 0, h: 0 }, this.color, false);
    }
    if (waiting || this.age % 5) return;
    for (const [e, t] of this.victims) if (this.age >= t) this.victims.delete(e);
    const list = [Game.player].concat(Entities.list);
    for (const e of list) {
      if (!e || e.removed || e.dead || !e.effects || this.victims.has(e) || e === this.owner) continue;
      const dx = e.x - this.x, dz = e.z - this.z;
      if (dx * dx + dz * dz > this.radius * this.radius || e.y > this.y + 1 || e.y + e.h < this.y - 0.5) continue;
      this.victims.set(e, this.age + this.reapply);
      for (const [n, dur, amp] of this.effects) {
        // instant effects work at half strength from a cloud
        if (n === 'instant_damage' || n === 'instant_health') { const heal = (n === 'instant_health') !== !!e.undead; if (heal) e.heal(Math.floor((4 << amp) * 0.5 + 0.5)); else e.hurt(Math.floor((6 << amp) * 0.5 + 0.5), 'magic', this.owner || this); }
        else e.addEffect(n, Math.max(1, Math.floor(dur / 4)), amp);
      }
      if (this.radiusOnUse) { this.radius += this.radiusOnUse; if (this.radius < 0.5) { this.removed = true; return; } }
    }
  }
}
const Effects = {
  // a lingering potion's cloud: radius 3 shrinking to nothing over 30 seconds; effects last a quarter as long
  cloud(x, y, z, potion, owner) {
    const fx = Potions.effectsOf(potion);
    Entities.add(new AreaEffectCloud(x, y, z, { radius: 3, duration: 600, effects: fx, color: Potions.color(fx[0] ? fx[0][0] : 'water'), owner }));
  },
};

// ---------------------------------------------------------------- dragon fireballs
class DragonFireball extends Entity {
  constructor(owner, x, y, z, ax, ay, az) { super('dragon_fireball', x, y, z); this.owner = owner; this.accel = [ax, ay, az]; this.vx = ax; this.vy = ay; this.vz = az; this.w = this.h = 1; this.noPick = false; this.life2 = 0; }
  get living() { return false; }
  tick() {
    this.px = this.x; this.py = this.y; this.pz = this.z; this.age++;
    this.vx += this.accel[0]; this.vy += this.accel[1]; this.vz += this.accel[2];
    this.vx *= 0.95; this.vy *= 0.95; this.vz *= 0.95;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      this.x += this.vx / steps; this.y += this.vy / steps; this.z += this.vz / steps;
      const id = World.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
      if (SOLID[id]) { this.burst(); return; }
      const p = Game.player;
      if (p && !p.dead && p.intersects([this.x - 0.5, this.y - 0.5, this.z - 0.5, this.x + 0.5, this.y + 0.5, this.z + 0.5])) { this.burst(); return; }
    }
    if (Particles.dragonBreath) Particles.dragonBreath(this.x, this.y, this.z);
    if (++this.life2 > 300 || this.y < MINY) this.removed = true;
  }
  // a cloud of dragon's breath (instant damage II) that grows from radius 3 to 7 over 30 seconds
  burst() {
    this.removed = true;
    Entities.add(new AreaEffectCloud(this.x, Math.floor(this.y) + 1 > this.y ? this.y : this.y, this.z, { radius: 3, duration: 600, perTick: (7 - 3) / 600, onUse: 0, effects: [['instant_damage', 1, 1]], breath: true, owner: this.owner }));
    Sound.play('dragon_fireball_explode', null, { x: this.x, y: this.y, z: this.z });
  }
  hurt(n, s, a) { if (a && a.isPlayer) { const lv = a.lookVec(); this.accel = [lv[0] * 0.1, lv[1] * 0.1, lv[2] * 0.1]; this.vx = lv[0]; this.vy = lv[1]; this.vz = lv[2]; return true; } return false; }
}

// ---------------------------------------------------------------- end crystals
class EndCrystal extends Entity {
  constructor(x, y, z, showBottom) { super('end_crystal', x, y, z); this.w = 2; this.h = 2; this.showBottom = showBottom !== false; this.time = Math.floor(Math.random() * 100000); this.beam = null; }
  get living() { return false; }
  tick() {
    this.px = this.x; this.py = this.y; this.pz = this.z; this.age++; this.time++;
    // in the End they keep a fire burning under them
    if (World.dim === 'end') { const x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z); if (World.loaded(x, z) && World.getBlock(x, y, z) === 0 && SOLID[World.getBlock(x, y - 1, z)]) World.setBlock(x, y, z, BID.fire, 0); }
  }
  hurt(amount, source, attacker) {
    if (this.removed) return false;
    if (attacker && attacker.type === 'ender_dragon') return false;
    this.removed = true;
    // hit by an explosion it just breaks; otherwise it explodes
    if (source !== 'explosion') Explosions.explode(this.x, this.y, this.z, 6, false, this, true);
    EndFight.crystalDestroyed(this, source, attacker);
    return true;
  }
  save() { return { type: 'end_crystal', x: this.x, y: this.y, z: this.z, showBottom: this.showBottom, beam: this.beam }; }
}

// ---------------------------------------------------------------- the Ender Dragon
class EnderDragon extends Mob {
  constructor(t, x, y, z) {
    super('ender_dragon', x, y, z);
    this.w = 16; this.h = 8; this.noGravity = true; this.fireImmune = true; this.kbResist = 1; this.persistent = true; this.hostile = true;
    this.maxHealth = this.health = 200; this.phase = 'hold'; this.phaseT = 0; this.yRotA = 0; this.node = 0; this.cw = Math.random() < 0.5;
    this.target = null; this.tp = null; this.flameCount = 0; this.sitDamage = 0; this.fireballCharge = 0; this.crystal = null; this.dying = 0;
    this.noPick = false; this.bodyYaw = this.yaw;
  }
  registerGoals() {}
  get undead() { return false; }
  get sitting() { return ['scan', 'roar', 'flame'].includes(this.phase); }
  setPhase(p) { this.phase = p; this.phaseT = 0; this.tp = null; if (p === 'flame') this.flameCount++; if (p === 'hold') this.flameCount = 0; }
  // where the head is (in front of the body along the facing direction)
  headPos() { const s = Math.sin(this.yaw), c = Math.cos(this.yaw); return [this.x - s * 6.5, this.y + 3.5 + (this.sitting ? -1 : 0), this.z - c * 6.5]; }
  podium() { return EndFight.podium() || { x: 0, y: 64, z: 0 }; }
  nearestPlayer(r) { const p = Game.player; if (!p || p.dead || p.creative || p.spectator || World.dim !== 'end') return null; return p.dist2(this.x, this.y, this.z) <= r * r ? p : null; }
  // the circle of path nodes the game uses: 12 outer (radius 60), 8 middle (40) and 4 inner (20)
  nodePos(i) {
    const pod = this.podium();
    if (i < 12) { const a = 2 * (-Math.PI + 0.15707964 * i); return [Math.floor(60 * Math.cos(a)), pod.y + 10 + (i % 3) * 6 + 14, Math.floor(60 * Math.sin(a))]; }
    return [0, pod.y + 20, 0];
  }
  tick() {
    this.tickBase(); this.noActionTime = 0;
    if (this.hurtTime > 0) this.hurtTime--; if (this.invul > 0) this.invul--;
    if (this.dying > 0 || this.phase === 'dying') { this.tickDeath(); return; }
    this.checkCrystals();
    this.think();
    this.steer();
    this.collide();
    this.bodyYaw = this.yaw; this.headYaw = this.yaw; this.lookYaw = this.yaw;
    this.limbSwing = this.age; this.limbAmount = this.sitting ? 0 : 1;
  }
  checkCrystals() {
    if (this.crystal) {
      if (this.crystal.removed) this.crystal = null;
      else if (this.age % 10 === 0 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 1);
    }
    if (Math.random() < 0.1) {
      let best = null, bd = 1e9;
      for (const e of Entities.list) { if (e.type !== 'end_crystal' || e.removed) continue; if (Math.abs(e.x - this.x) > 32 + 8 || Math.abs(e.y - this.y) > 32 + 4 || Math.abs(e.z - this.z) > 32 + 8) continue; const d = e.dist2(this.x, this.y, this.z); if (d < bd) { bd = d; best = e; } }
      this.crystal = best;
    }
  }
  think() {
    const pod = this.podium(); this.phaseT++;
    switch (this.phase) {
      case 'hold': {
        if (!this.tp) this.tp = this.nodePos(this.node);
        const d2 = this.dist2(this.tp[0], this.tp[1], this.tp[2]);
        if (d2 < 100 || d2 > 22500) {
          // reached a node: land, strafe the player, or carry on round the circle
          const crystals = EndFight.crystalsAlive(), p = this.nearestPlayer(128);
          if (Math.floor(Math.random() * (crystals + 3)) === 0) { this.setPhase('approach'); return; }
          const dd = p ? ((p.x - pod.x) ** 2 + (p.y - pod.y) ** 2 + (p.z - pod.z) ** 2) / 512 : 64;
          if (p && (Math.floor(Math.random() * Math.floor(dd + 2)) === 0 || Math.floor(Math.random() * (crystals + 2)) === 0)) { this.strafe(p); return; }
          if (Math.random() < 0.125) this.cw = !this.cw;
          this.node = (this.node + (this.cw ? 1 : 11)) % 12; this.tp = this.nodePos(this.node);
        }
        break;
      }
      case 'strafe': {
        const p = this.target;
        if (!p || p.dead || World.dim !== 'end' || this.phaseT > 400) { this.setPhase('hold'); return; }
        this.tp = [p.x, p.y + 6, p.z];
        const d2 = this.dist2(p.x, p.y, p.z), hp = this.headPos();
        const to = [p.x - hp[0], p.y + p.h / 2 - hp[1], p.z - hp[2]], l = Math.hypot(...to) || 1;
        const fwd = [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)], facing = (to[0] * fwd[0] + to[2] * fwd[2]) / Math.hypot(to[0], to[2]);
        if (d2 < 64 * 64 && facing > Math.cos(10 * Math.PI / 180) && EndFight.sees(hp, p)) {
          if (++this.fireballCharge >= 5) {
            Entities.add(new DragonFireball(this, hp[0] + fwd[0], hp[1], hp[2] + fwd[2], to[0] / l * 0.1, to[1] / l * 0.1, to[2] / l * 0.1));
            Sound.play('dragon_shoot', this); this.fireballCharge = 0; this.setPhase('hold');
          }
        } else if (this.fireballCharge > 0) this.fireballCharge--;
        if (d2 > 150 * 150) this.setPhase('hold');
        break;
      }
      case 'approach': {
        this.tp = [pod.x, pod.y + 20, pod.z];
        if (this.dist2(this.tp[0], this.tp[1], this.tp[2]) < 100) this.setPhase('landing');
        break;
      }
      case 'landing': {
        this.tp = [pod.x, pod.y + 1, pod.z];
        if (this.dist2(this.tp[0], this.tp[1], this.tp[2]) < 1.5 || this.phaseT > 200) { this.x = pod.x + 0.5; this.y = pod.y + 1; this.z = pod.z + 0.5; this.vx = this.vy = this.vz = 0; this.setPhase('scan'); this.sitDamage = 0; }
        break;
      }
      case 'scan': {
        // look round for a player close by; roar and breathe at one in front, or take off after a while
        const p = this.nearestPlayer(20);
        if (p) {
          const want = Math.atan2(-(p.x - this.x), -(p.z - this.z)), d = angleDiff(want, this.yaw);
          this.yaw += Math.max(-0.08, Math.min(0.08, d));
          if (Math.abs(d) < 0.3 && this.phaseT > 25) { this.setPhase('roar'); Sound.play('dragon_growl', this); return; }
        }
        if (this.phaseT >= 100) {
          const far = this.nearestPlayer(150);
          this.setPhase('takeoff');
          if (far) { this.chargeAt = [far.x, far.y, far.z]; }
        }
        break;
      }
      case 'roar': if (this.phaseT >= 40) this.setPhase('flame'); break;
      case 'flame': {
        if (this.phaseT === 10) {
          // the breath: a cloud on the ground in front of the head
          const hp = this.headPos(), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
          let y = Math.floor(hp[1]); while (y > pod.y - 2 && !SOLID[World.getBlock(Math.floor(hp[0] + fx * 2), y - 1, Math.floor(hp[2] + fz * 2))]) y--;
          Entities.add(new AreaEffectCloud(hp[0] + fx * 2, y, hp[2] + fz * 2, { radius: 5, duration: 200, wait: 0, perTick: 0, onUse: 0, effects: [['instant_damage', 1, 0]], breath: true, owner: this }));
        }
        if (this.phaseT >= 200) this.setPhase(this.flameCount >= 4 ? 'takeoff' : 'scan');
        break;
      }
      case 'takeoff': {
        this.tp = [pod.x + (Math.random() - 0.5) * 2, pod.y + 30, pod.z + (Math.random() - 0.5) * 2];
        if (this.y > pod.y + 20 || this.phaseT > 100) {
          if (this.chargeAt) { this.setPhase('charge'); this.tp = this.chargeAt; this.chargeAt = null; }
          else this.setPhase('hold');
        }
        break;
      }
      case 'charge': {
        if (!this.tp || this.phaseT > 200 || this.dist2(this.tp[0], this.tp[1], this.tp[2]) < 100) this.setPhase('hold');
        break;
      }
    }
  }
  // the game's flight: turn toward the target, push along the facing direction, a little vertical drift
  steer() {
    if (this.sitting) { this.vx = this.vy = this.vz = 0; return; }
    const t = this.tp; if (!t) return;
    const flySpeed = this.phase === 'landing' ? 1.5 : this.phase === 'charge' ? 3 : 0.6, turn = this.phase === 'landing' ? 1.5 : this.phase === 'charge' ? 0.7 : 0.7;
    const dx = t[0] - this.x, dy = t[1] - this.y, dz = t[2] - this.z, d3 = dx * dx + dy * dy + dz * dz, hd = Math.hypot(dx, dz);
    if (hd > 0) this.vy += Math.max(-flySpeed, Math.min(flySpeed, dy / hd)) * 0.01;
    const want = Math.atan2(-dx, -dz), diff = Math.max(-50, Math.min(50, angleDiff(want, this.yaw) * 180 / Math.PI));
    this.yRotA = this.yRotA * 0.8 + diff * turn;
    this.yaw += this.yRotA * 0.1 * Math.PI / 180;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), dl = Math.sqrt(d3) || 1;
    const mv = [fx, this.vy, fz], ml = Math.hypot(...mv) || 1;
    const f7 = Math.max(((mv[0] * dx + mv[1] * dy + mv[2] * dz) / ml / dl + 0.5) / 1.5, 0), f19 = 2 / (d3 + 1);
    const acc = 0.06 * (f7 * f19 + (1 - f19));
    this.vx += fx * acc; this.vz += fz * acc;
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    const vl = Math.hypot(this.vx, this.vy, this.vz) || 1, dot = (this.vx * mv[0] + this.vy * mv[1] + this.vz * mv[2]) / vl / ml, d5 = 0.8 + 0.15 * (dot + 1) / 2;
    this.vx *= d5; this.vy *= 0.91; this.vz *= d5;
  }
  // wings knock things away, the head bites; blocks in the way break (unless dragon immune)
  collide() {
    const hp = this.headPos(), p = Game.player;
    if (p && !p.dead && !p.creative && !p.spectator && World.dim === 'end' && this.hurtTime === 0 && !this.sitting) {
      const inBox = (cx, cy, cz, rx, ry, rz) => p.intersects([cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz]);
      if (inBox(this.x, this.y + 2, this.z, 6, 2, 6)) { const dx = p.x - this.x, dz = p.z - this.z, l = Math.max(0.1, Math.hypot(dx, dz)); p.vx += dx / l * 4 * 0.25; p.vz += dz / l * 4 * 0.25; p.vy += 0.2; p.hurt(5, 'mob', this); }
      if (inBox(hp[0], hp[1], hp[2], 1.5, 1.5, 1.5)) p.hurt(10, 'mob', this);
    }
    if (!Game.rules.mobGriefing || this.sitting || this.phase === 'landing') return;
    const boxes = [[this.x - 2.5, this.y, this.z - 2.5, this.x + 2.5, this.y + 3, this.z + 2.5], [hp[0] - 1, hp[1] - 1, hp[2] - 1, hp[0] + 1, hp[1] + 1, hp[2] + 1]];
    let broke = false;
    for (const b of boxes) for (let x = Math.floor(b[0]); x <= Math.floor(b[3]); x++) for (let y = Math.floor(b[1]); y <= Math.floor(b[4]); y++) for (let z = Math.floor(b[2]); z <= Math.floor(b[5]); z++) {
      const id = World.getBlock(x, y, z); if (!id || EndFight.immune(id)) continue;
      World.setBlock(x, y, z, 0, 0); broke = true;
    }
    if (broke) Particles.explosion && Particles.explosion(this.x, this.y + 2, this.z, true);
  }
  // only players and explosions hurt it; the head takes the full blow, the body a quarter + 1
  hurt(amount, source, attacker) {
    if (this.dying > 0 || this.phase === 'dying' || this.removed) return false;
    const fromPlayer = attacker && (attacker.isPlayer || (attacker.owner && attacker.owner.isPlayer));
    if (!fromPlayer && source !== 'explosion' && source !== 'kill' && source !== 'badRespawn') return false;
    if (this.sitting && attacker && attacker.type === 'arrow') { attacker.fireTicks = 20; return false; }
    if (!this.hitsHead(attacker, source)) amount = amount / 4 + Math.min(amount, 1);
    if (amount < 0.01) return false;
    const before = this.health;
    if (this.invul > 10) { if (amount <= this.lastDamage) return false; const extra = amount - this.lastDamage; this.lastDamage = amount; amount = extra; } else { this.lastDamage = amount; this.invul = 20; this.hurtTime = 10; }
    this.health -= amount; this.lastHurtBy = attacker && (attacker.owner || attacker);
    Sound.play('dragon_hurt', this);
    if (this.health <= 0) { this.health = 1; this.setPhase('dying'); this.dying = 1; Sound.play('dragon_death', this, { global: true }); }
    if (this.sitting) { this.sitDamage += before - this.health; if (this.sitDamage > 0.25 * this.maxHealth) { this.sitDamage = 0; this.setPhase('takeoff'); } }
    return true;
  }
  hitsHead(attacker, source) {
    const hp = this.headPos(), inHead = (x, y, z) => Math.abs(x - hp[0]) < 2 && Math.abs(y - hp[1]) < 2 && Math.abs(z - hp[2]) < 2;
    if (!attacker) return false;
    if (attacker.isPlayer && source !== 'explosion') {
      // the point the player aimed at: along the look ray, the nearest point to the head
      const e = [attacker.x, attacker.eyeY, attacker.z], lv = attacker.lookVec();
      const t = Math.max(0, (hp[0] - e[0]) * lv[0] + (hp[1] - e[1]) * lv[1] + (hp[2] - e[2]) * lv[2]);
      return inHead(e[0] + lv[0] * t, e[1] + lv[1] * t, e[2] + lv[2] * t);
    }
    return inHead(attacker.x, attacker.y + (attacker.h || 0) / 2, attacker.z) || (source === 'explosion' && Math.hypot(attacker.x - hp[0], attacker.y - hp[1], attacker.z - hp[2]) < 4);
  }
  tickDeath() {
    this.dying++;
    const xp = EndFight.previouslyKilled() ? 500 : 12000;
    if (this.dying >= 180 && this.dying <= 200) Particles.explosion && Particles.explosion(this.x + (Math.random() - 0.5) * 8, this.y + 2 + (Math.random() - 0.5) * 4, this.z + (Math.random() - 0.5) * 8, true);
    if (this.dying > 150 && this.dying % 5 === 0 && Game.rules.doMobLoot) Drops.spawnXp(this.x, this.y, this.z, Math.floor(xp * 0.08));
    this.y += 0.1; this.yaw += 20 * Math.PI / 180; this.bodyYaw = this.yaw;
    if (this.dying >= 200) {
      if (Game.rules.doMobLoot) Drops.spawnXp(this.x, this.y, this.z, Math.floor(xp * 0.2));
      this.removed = true; this.dead = true;
      EndFight.dragonKilled(this);
    }
  }
  animState(s) { s.flap = this.sitting ? 0 : 1; s.dying = this.dying; }
  saveExtra(d) { d.phase = this.phase === 'dying' ? 'hold' : this.phase; d.node = this.node; d.health = this.health; }
  loadExtra(d) { this.phase = d.phase || 'hold'; this.node = d.node || 0; if (d.health) this.health = d.health; }
}

// ---------------------------------------------------------------- the fight
const EndFight = (() => {
  const B = BID;
  let st = null, wantInit = false, checkAt = 0;
  const fresh = () => ({ init: false, killed: false, previously: false, podium: null, gateways: shuffle([...Array(20).keys()]), links: {} });
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const IMMUNE = new Set(['barrier', 'bedrock', 'end_portal', 'end_portal_frame', 'end_gateway', 'command_block', 'repeating_command_block', 'chain_command_block', 'structure_block', 'jigsaw', 'moving_piston', 'obsidian', 'crying_obsidian', 'end_stone', 'iron_bars', 'respawn_anchor', 'reinforced_deepslate', 'light', 'fire'].map(n => BID[n]).filter(x => x !== undefined));
  const immune = id => IMMUNE.has(id) || FLUID[id];
  let spikeList = null;
  const spikes = () => spikeList || (spikeList = new End(Game.seed).spikes());
  function loadedAround(x, z, r) { for (let cx = (x - r) >> 4; cx <= (x + r) >> 4; cx++) for (let cz = (z - r) >> 4; cz <= (z + r) >> 4; cz++) { const c = World.getChunk(cx, cz); if (!c || !c.lit) return false; } return true; }
  // the exit portal (the game's EndPodiumFeature): a bedrock bowl with a pillar and four torches
  function buildPodium(active) {
    const p = st.podium;
    for (let x = p.x - 4; x <= p.x + 4; x++) for (let z = p.z - 4; z <= p.z + 4; z++) for (let y = p.y - 1; y <= p.y + 32; y++) {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2, inner = d2 < 2.5 * 2.5;
      if (!inner && d2 >= 3.5 * 3.5) continue;
      if (y < p.y) World.setBlock(x, y, z, inner ? B.bedrock : B.end_stone, 0);
      else if (y > p.y) World.setBlock(x, y, z, 0, 0);
      else if (!inner) World.setBlock(x, y, z, B.bedrock, 0);
      else World.setBlock(x, y, z, active ? B.end_portal : 0, 0);
    }
    for (let i = 0; i < 4; i++) World.setBlock(p.x, p.y + i, p.z, B.bedrock, 0);
    for (const f of [2, 3, 4, 5]) World.setBlock(p.x + DX[f], p.y + 2, p.z + DZ[f], B.wall_torch, f);
  }
  function findPodium() {
    let y = MAXY; while (y > 0 && World.getBlock(0, y, 0) === 0) y--;
    while (World.getBlock(0, y, 0) === B.bedrock && y > 60) y--;
    return { x: 0, y: Math.max(y, 50), z: 0 };
  }
  function onEnter() { if (!st) st = fresh(); wantInit = true; checkAt = 0; }
  function crystalsAlive() { return Entities.list.filter(e => e.type === 'end_crystal' && !e.removed && Math.hypot(e.x, e.z) < 64).length; }
  function dragon() { return Entities.list.find(e => e.type === 'ender_dragon' && !e.removed); }
  function tick() {
    if (World.dim !== 'end' || !st) { HUD.setBoss('dragon', null, null); return; }
    const p = Game.player;
    if (wantInit && loadedAround(0, 0, 48)) {
      wantInit = false;
      if (!st.podium) st.podium = findPodium();
      buildPodium(st.killed);
      if (!st.init) {
        // the crystals on the spikes and the dragon, the first time
        for (const sp of spikes()) Entities.add(new EndCrystal(sp.x + 0.5, sp.h + 1, sp.z + 0.5, true));
        if (!st.killed) spawnDragon();
        st.init = true;
      }
      checkAt = Game.gameTime + 100;
    }
    // a dragon that should be there but is not (lost with an unsaved chunk): bring it back
    if (st.init && !st.killed && checkAt && Game.gameTime > checkAt && loadedAround(0, 0, 48) && !dragon()) { spawnDragon(); checkAt = Game.gameTime + 1200; }
    const d = dragon();
    if (d && p && Math.hypot(p.x, p.z) < 192) HUD.setBoss('dragon', 'Ender Dragon', Math.max(0, d.health / d.maxHealth));
    else HUD.setBoss('dragon', null, null);
    CrystalBeams.update(d);
  }
  function spawnDragon() { const d = new EnderDragon('ender_dragon', 0.5, 128, 0.5); d.dim = 'end'; Entities.add(d); }
  function crystalDestroyed(c, source, attacker) {
    const d = dragon();
    // breaking the crystal that heals the dragon hurts it (10, as an explosion at its head)
    if (d && d.crystal === c) { d.crystal = null; d.hurt(10, 'explosion', { x: d.headPos()[0], y: d.headPos()[1], z: d.headPos()[2], h: 0 }); }
    if (d && d.phase === 'hold' && attacker && (attacker.isPlayer || (attacker.owner && attacker.owner.isPlayer))) d.strafe(attacker.owner || attacker);
  }
  function dragonKilled(d) {
    const first = !st.previously;
    st.killed = true; st.previously = true;
    buildPodium(true);
    if (first) World.setBlock(st.podium.x, st.podium.y + 4, st.podium.z, B.dragon_egg, 0);
    // a new gateway at one of the twenty spots on the ring 96 blocks out
    if (st.gateways.length) {
      const j = st.gateways.pop(), a = 2 * (-Math.PI + Math.PI / 20 * j);
      buildGateway(Math.floor(96 * Math.cos(a)), 75, Math.floor(96 * Math.sin(a)));
    }
    HUD.setBoss('dragon', null, null);
    Advancements.trigger && Advancements.trigger('kill_dragon');
    Stats.add('killed', 'ender_dragon');
  }
  // an End gateway: the gateway block between two bedrock caps (the game's EndGatewayFeature)
  function buildGateway(x, y, z) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -1; dz <= 1; dz++) {
      const fx = dx === 0, fy = dy === 0, fz = dz === 0, f3 = Math.abs(dy) === 2;
      let id = 0;
      if (fx && fy && fz) id = B.end_gateway; else if (fy) id = 0; else if (f3 && fx && fz) id = B.bedrock; else if ((fx || fz) && !f3) id = B.bedrock;
      World.setBlock(x + dx, y + dy, z + dz, id, 0);
    }
    World.setBE(x, y, z, { type: 'gateway' });
  }
  // walking into a gateway: out to the islands 1024 blocks away, or back from them
  function gateway(p, gw) {
    const k = gw.x + ',' + gw.y + ',' + gw.z;
    let to = st.links[k];
    if (!to) {
      const l = Math.hypot(gw.x, gw.z) || 1, f = 1024;
      to = { x: Math.floor(gw.x / l * f), y: 75, z: Math.floor(gw.z / l * f), back: { x: gw.x, y: gw.y, z: gw.z }, fresh: true };
      st.links[k] = to;
    }
    Sound.play('portal_travel', p, { ui: true });
    p.portalLock = true;
    pendingGateway = to;
    Portals.changeDim('end', to.x + 0.5, to.y, to.z + 0.5, { kind: 'exact' });
  }
  let pendingGateway = null;
  // after a gateway trip: on the far side, make the island and the return gateway the first time
  function afterArrival(p) {
    const g = pendingGateway; if (!g) return;
    if (!loadedAround(g.x, g.z, 16)) return;
    pendingGateway = null;
    if (g.fresh) {
      g.fresh = false;
      let top = null;
      for (let r = 0; r <= 16 && !top; r++) for (let dx = -r; dx <= r && !top; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        let y = MAXY; while (y > 0 && World.getBlock(g.x + dx, y, g.z + dz) !== B.end_stone) y--;
        if (y > 0) { top = { x: g.x + dx, y, z: g.z + dz }; break; }
      }
      if (!top) {
        // no land: a small island of end stone (the game's EndIslandFeature)
        top = { x: g.x, y: 75, z: g.z };
        let r = 4 + Math.floor(Math.random() * 3);
        for (let y = 0; r > 0.5; y--, r -= 1 + Math.random() * 0.5) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) if (dx * dx + dz * dz <= (r + 1) * (r + 1)) World.setBlock(g.x + dx, 75 + y, g.z + dz, B.end_stone, 0);
      }
      const ex = { x: top.x, y: top.y + 10, z: top.z };
      buildGateway(ex.x, ex.y, ex.z);
      st.links[ex.x + ',' + ex.y + ',' + ex.z] = { x: g.back.x, y: g.back.y, z: g.back.z, back: ex };
      g.x = top.x; g.y = top.y + 1; g.z = top.z;
      p.x = p.px = top.x + 0.5; p.y = p.py = top.y + 1; p.z = p.pz = top.z + 0.5;
    } else {
      // land beside the gateway we came to, on solid ground
      let y = g.y; for (let i = 0; i < 40 && !(SOLID[World.getBlock(g.x + 2, y - 1, g.z)] && !SOLID[World.getBlock(g.x + 2, y, g.z)]); i++) y--;
      p.x = p.px = g.x + 2.5; p.y = p.py = y; p.z = p.pz = g.z + 0.5;
    }
    p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
  }
  // a block-to-player line of sight check for the dragon's fireballs
  function sees(from, p) {
    const to = [p.x, p.eyeY, p.z], n = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]));
    for (let i = 1; i < n; i++) { const t = i / n; if (OPAQUE[World.getBlock(Math.floor(from[0] + (to[0] - from[0]) * t), Math.floor(from[1] + (to[1] - from[1]) * t), Math.floor(from[2] + (to[2] - from[2]) * t))]) return false; }
    return true;
  }
  function save() { return st; }
  function load(d) { st = d || null; wantInit = false; pendingGateway = null; if (st && World.dim === 'end') wantInit = true; }
  return { tick, onEnter, crystalsAlive, crystalDestroyed, dragonKilled, gateway, afterArrival, sees, immune, save, load, spikes, podium: () => st && st.podium, previouslyKilled: () => !!(st && st.previously), get state() { return st; } };
})();
EnderDragon.prototype.strafe = function (p) { this.setPhase('strafe'); this.target = p; this.fireballCharge = 0; };

// the beams from the crystals to the dragon they heal
const CrystalBeams = (() => {
  const mat = new THREE.LineBasicMaterial({ color: 0xff88ff, transparent: true, opacity: 0.8 });
  let line = null;
  function update(d) {
    const c = d && d.crystal && !d.crystal.removed ? d.crystal : null;
    if (!c) { if (line) line.visible = false; return; }
    if (!line) { line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), mat); line.frustumCulled = false; scene.add(line); }
    line.visible = true;
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, c.x, c.y + 1, c.z); pos.setXYZ(1, d.x, d.y + 3, d.z); pos.needsUpdate = true;
  }
  return { update };
})();

// registration with the mob registry and entity restore
MobTypes.ender_dragon = EnderDragon;
(function () {
  const restore0 = Entities.restore;
  Entities.restore = (d, dim) => {
    if (d.type === 'end_crystal') { const e = new EndCrystal(d.x, d.y, d.z, d.showBottom); e.dim = dim; return Entities.add(e); }
    return restore0(d, dim);
  };
})();
