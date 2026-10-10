'use strict';
/* The Wither (Java Edition 1.21 WitherBoss), summoned with four soul sand or soul soil in a T and three wither
   skeleton skulls on top:
   - it builds up for 220 ticks, invulnerable, from a third of its 300 health (healing 10 every 10 ticks), then
     blows up (power 7) and goes after every living thing that isn't undead
   - the middle head fires at its target every 40 ticks within 20 blocks; the side heads pick their own
     targets within 20 blocks and fire every 2 to 3 seconds (on normal and hard they also fire wildly when
     idle); one skull in a thousand is a blue, dangerous one
   - skulls do 8 damage (healing the wither 5 if they kill) and give Wither II for 10 s on normal or 40 s on
     hard, then explode (power 1; blue skulls break even blast-resistant blocks)
   - it flies over its target, heals 1 every second, and 20 ticks after being hurt breaks the blocks round it;
     at half health it gets its armour: arrows bounce off and it no longer rises above its target
   - dies dropping a nether star and 50 experience; a purple boss bar shows its health */
const Withers = (() => {
  const IMMUNE = () => new Set([BID.bedrock, BID.end_portal_frame, BID.end_portal, BID.end_gateway, BID.barrier, BID.reinforced_deepslate, BID.command_block, BID.structure_block, BID.jigsaw, BID.light].filter(x => x !== undefined));
  let immune = null;
  const isImmune = id => (immune || (immune = IMMUNE())).has(id);
  const canTarget = e => !!e && !e.dead && !e.removed && (e.living || e.isPlayer) && !e.undead && e.type !== 'armor_stand' && !(e.isPlayer && (e.creative || e.spectator));

  // ---------------------------------------------------------------- the skull
  class WitherSkull extends Projectile {
    constructor(owner, x, y, z, dangerous) { super('wither_skull', owner, x, y, z); this.noGravity = true; this.dangerous = !!dangerous; this.drag = dangerous ? 0.73 : 0.95; this.w = this.h = 0.3125; this.item = IID.wither_skeleton_skull; this.accel = [0, 0, 0]; this.life2 = 0; }
    tick() { this.vx += this.accel[0]; this.vy += this.accel[1]; this.vz += this.accel[2]; super.tick(); if (Math.random() < 0.5) Particles.smoke({ x: this.x, y: this.y + this.h / 2, z: this.z, w: 0, h: 0 }, 1); if (++this.life2 > 400) this.removed = true; }
    onEntity(e) {
      if (e === this.owner) return false;
      const o = this.owner && !this.owner.dead ? this.owner : null;
      const hit = o ? e.hurt(8, 'witherSkull', o) : e.hurt(5, 'magic');
      if (hit) {
        if (o && e.dead) o.heal && o.heal(5);
        const secs = Game.difficulty === 'normal' ? 10 : Game.difficulty === 'hard' ? 40 : 0;
        if (secs && e.addEffect) e.addEffect('wither', secs * 20, 1);
      }
      this.explode();
    }
    onBlock() { this.explode(); }
    explode() { this.removed = true; Explosions.explode(this.x, this.y, this.z, 1, false, this, Game.rules.mobGriefing); }
    // a blue skull's explosion treats everything but the wither-proof blocks as weak as glass
    resistCap(id) { return this.dangerous && !isImmune(id) ? 0.8 : null; }
    get living() { return false; }
  }

  // ---------------------------------------------------------------- the boss
  class Wither extends Monster {
    constructor(t, x, y, z) {
      super('wither', x, y, z);
      this.w = 0.9; this.h = 3.5; this.noGravity = true; this.fireImmune = true; this.persistent = true; this.armorPts = 4;
      this.chargeT = 0; this.alt = [null, null, null]; this.nextHead = [0, 0]; this.idleHead = [0, 0]; this.shootT = 0; this.breakT = 0;
      this.headYaw2 = [0, 0, 0]; this.headPitch2 = [0, 0, 0];
    }
    registerGoals() {}
    get undead() { return true; }
    get noFallDamage() { return true; }
    get powered() { return this.health <= this.maxHealth / 2; }
    // just summoned: invulnerable and charging up from a third of its health
    makeInvulnerable() { this.chargeT = 220; this.health = this.maxHealth / 3; }
    addEffect(n, d, a) { if (n === 'wither') return false; return super.addEffect(n, d, a); }
    heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }
    headPos(i) {
      if (i <= 0) return [this.x, this.y + 3, this.z];
      const f = this.bodyYaw + Math.PI * (i - 1) + Math.PI / 2; // the side heads sit 1.3 out to either side
      return [this.x + Math.cos(f) * 1.3, this.y + 2.2, this.z + Math.sin(f) * 1.3];
    }
    shoot(i, x, y, z, dangerous) {
      const [hx, hy, hz] = this.headPos(i), dx = x - hx, dy = y - hy, dz = z - hz, l = Math.hypot(dx, dy, dz) || 1;
      const s = new WitherSkull(this, hx, hy, hz, dangerous);
      s.accel = [dx / l * 0.1, dy / l * 0.1, dz / l * 0.1]; s.vx = s.accel[0]; s.vy = s.accel[1]; s.vz = s.accel[2];
      Entities.add(s);
      Sound.play('wither_shoot', this);
    }
    shootAt(i, e) { this.shoot(i, e.x, e.y + e.h * 0.5, e.z, i === 0 ? false : Game.difficulty !== 'easy' && Game.difficulty !== 'peaceful' && Math.random() < 0.001); }
    findTarget() {
      let best = null, bd = 40 * 40;
      for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) { if (!canTarget(e) || e === this) continue; const d = e.dist2(this.x, this.y, this.z); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    aiStep() {
      if (Game.difficulty === 'peaceful') { this.removed = true; return; }
      // charging up
      if (this.chargeT > 0) {
        const i = this.chargeT - 1;
        if (i <= 0) { Explosions.explode(this.x, this.y + 1.75, this.z, 7, false, this, Game.rules.mobGriefing); Sound.play('wither_spawn', this); }
        this.chargeT = i; if (this.age % 10 === 0) this.heal(10);
        this.vx *= 0.5; this.vz *= 0.5; this.vy = 0;
        return;
      }
      if (this.target && !canTarget(this.target)) this.target = null;
      if (!this.target || this.age % 20 === 0) { const t = this.findTarget(); if (t && (!this.target || t.dist2(this.x, this.y, this.z) < this.target.dist2(this.x, this.y, this.z) - 16)) this.target = t; }
      this.alt[0] = this.target;
      // flight: rise over the target (until powered), close in horizontally when more than 3 away
      let vy = this.vy * 0.6; const t = this.target;
      if (t) {
        if (this.y < t.y || (!this.powered && this.y < t.y + 5)) { vy = Math.max(0, vy); vy += 0.3 - vy * 0.6; }
        const dx = t.x - this.x, dz = t.z - this.z, d2 = dx * dx + dz * dz;
        if (d2 > 9) { const l = Math.sqrt(d2); this.vx += dx / l * 0.3 - this.vx * 0.6; this.vz += dz / l * 0.3 - this.vz * 0.6; }
      }
      this.vy = vy;
      if (this.vx * this.vx + this.vz * this.vz > 0.05) this.yaw = this.bodyYaw = Math.atan2(-this.vx, -this.vz);
      // the middle head: every 40 ticks at its target within 20 blocks it can see
      if (t) { this.lookAt(t.x, t.eyeY || t.y + t.h * 0.85, t.z); if (--this.shootT <= 0 && t.dist2(this.x, this.y, this.z) <= 400 && this.canSee(t)) { this.shootAt(0, t); this.shootT = 40; } }
      // the side heads
      for (let i = 1; i < 3; i++) {
        if (this.age < this.nextHead[i - 1]) continue;
        this.nextHead[i - 1] = this.age + 10 + rnd(10);
        if (Game.difficulty === 'normal' || Game.difficulty === 'hard') {
          if (this.idleHead[i - 1]++ > 15) { this.shoot(i, this.x - 10 + Math.random() * 20, this.y - 5 + Math.random() * 10, this.z - 10 + Math.random() * 20, true); this.idleHead[i - 1] = 0; }
        }
        const a = this.alt[i];
        if (a) {
          if (canTarget(a) && a.dist2(this.x, this.y, this.z) <= 900 && this.canSee(a)) { this.shootAt(i, a); this.nextHead[i - 1] = this.age + 40 + rnd(20); this.idleHead[i - 1] = 0; }
          else this.alt[i] = null;
        } else {
          const list = Entities.list.concat(Game.player ? [Game.player] : []).filter(e => e !== this && canTarget(e) && Math.abs(e.x - this.x) <= 20.5 && Math.abs(e.y - this.y) <= 12 && Math.abs(e.z - this.z) <= 20.5);
          if (list.length) this.alt[i] = list[rnd(list.length)];
        }
      }
      // breaking out after being hurt
      if (this.breakT > 0 && --this.breakT === 0 && Game.rules.mobGriefing) {
        const r = Math.floor(this.w / 2 + 1), h = Math.floor(this.h); let broke = false;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = 0; dy <= h; dy++) {
          const bx = Math.floor(this.x) + dx, by = Math.floor(this.y) + dy, bz = Math.floor(this.z) + dz, id = World.getBlock(bx, by, bz);
          if (!id || BLOCKS[id].fluid || isImmune(id)) continue;
          Particles.blockBreak(bx, by, bz, id, World.getState(bx, by, bz)); Drops.dropBlock(id, World.getState(bx, by, bz), null, bx, by, bz); Blocks.remove(bx, by, bz, null, true); broke = true;
        }
        if (broke) Sound.play('wither_break_block', this);
      }
      if (this.age % 20 === 0) this.heal(1);
      // where the heads look (for drawing)
      for (let i = 0; i < 3; i++) { const e = this.alt[i]; if (!e) continue; const [hx, hy, hz] = this.headPos(i); this.headYaw2[i] = Math.atan2(-(e.x - hx), -(e.z - hz)) - this.bodyYaw; this.headPitch2[i] = -Math.atan2((e.y + e.h * 0.85) - hy, Math.hypot(e.x - hx, e.z - hz)); }
    }
    travel() { Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.91; this.vy *= 0.98; this.vz *= 0.91; }
    hurt(amount, source, attacker) {
      if (this.chargeT > 0 && source !== 'outOfWorld' && source !== 'kill') return false;
      if (source === 'drown' || source === 'wither' || source === 'inWall') return false;
      if (this.powered && (source === 'arrow' || (attacker && attacker instanceof Arrow))) return false;
      const ok = super.hurt(amount, source, attacker);
      if (ok && this.breakT <= 0) this.breakT = 20;
      if (ok && attacker && attacker !== this && canTarget(attacker.owner || attacker)) this.target = attacker.owner || attacker;
      return ok;
    }
    dropLoot() { const it = Drops.spawnItem(this.x, this.y + 1, this.z, stack('nether_star')); if (it) it.noDespawn = true; }
    xpValue() { return 50; }
    posePart(inst, s) {
      const L = inst.parts; if (!L) return;
      const map = [L.center_head, L.left_head, L.right_head];
      for (let i = 1; i < 3; i++) if (map[i] && this.alt[i]) { map[i].ry = this.headYaw2[i]; map[i].rx = this.headPitch2[i]; }
    }
    layers() { return [{ model: 'wither_armor', transparent: true, glow: true, when: e => e.powered, color: e => { const k = 0.55 + 0.25 * Math.sin(e.age * 0.15); return [k * 0.6, k * 0.8, k]; } }]; }
    animState(s) { s.charging = this.chargeT; }
    saveExtra(d) { d.chargeT = this.chargeT; } loadExtra(d) { this.chargeT = d.chargeT || 0; }
  }
  MobTypes.wither = Wither;

  // ---------------------------------------------------------------- summoning and the boss bar
  function summonWither(x, y, z) {
    const w = Mobs.create('wither', x, y, z); if (!w) return null;
    w.makeInvulnerable(); w.yaw = w.bodyYaw = 0;
    Entities.add(w);
    Advancements.fire('summoned_entity', { entity: w });
    return w;
  }
  function tick() {
    const p = Game.player; if (!p) return;
    const seen = new Set();
    for (const e of Entities.list) {
      if (e.type !== 'wither' || e.removed) continue;
      if (e.dist2(p.x, p.y, p.z) > 64 * 64 || e.dim && e.dim !== World.dim) continue;
      const k = 'wither' + e.id; seen.add(k);
      HUD.setBoss(k, 'Wither', e.chargeT > 0 ? 1 - e.chargeT / 220 : Math.max(0, e.health / e.maxHealth), 'purple');
    }
    for (const k of shownBars) if (!seen.has(k)) HUD.setBoss(k, null, null);
    shownBars = seen;
  }
  let shownBars = new Set();

  // the energy swirl round a powered wither or a charged creeper: the model a little bigger, striped
  const ED = EntityModels.DEFS, inflate = parts => parts.map(q => Object.assign({}, q, { b: q.b.map(b => { const c = b.slice(); c[8] = (c[8] || 0) + 0.5; return c; }), c: inflate(q.c || []) }));
  const swirl = s => { s.c.getContext('2d').clearRect(0, 0, s.c.width, s.c.height); for (let y = 0; y < s.c.height; y++) for (let x = 0; x < s.c.width; x++) if ((x + y * 2) % 11 < 3) s.px(x, y, 0x7ac8ff, 0.55); };
  if (ED.wither) EntityModels.def('wither_armor', ED.wither.tw, ED.wither.th, inflate(ED.wither.parts), { anim: ED.wither.anim, scale: ED.wither.scale, skin: swirl });
  if (ED.creeper) EntityModels.def('creeper_armor', ED.creeper.tw, ED.creeper.th, inflate(ED.creeper.parts), { anim: ED.creeper.anim, scale: ED.creeper.scale, skin: swirl });
  if (MobTypes.creeper) { const C = MobTypes.creeper.prototype, prev = C.layers; C.layers = function () { const l = prev ? prev.call(this) || [] : []; return l.concat([{ model: 'creeper_armor', transparent: true, glow: true, when: e => e.charged, color: () => [0.6, 0.8, 1] }]); }; }

  return { summonWither, tick, WitherSkull, isImmune };
})();
const Bosses = { summonWither: (x, y, z) => Withers.summonWither(x, y, z) };
