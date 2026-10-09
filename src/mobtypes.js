'use strict';
/* The mobs themselves, with their behaviour from the game: what they eat and breed with, what they attack,
   when they burn, how creepers swell, spiders climb and leap, endermen teleport and carry blocks, slimes
   hop and split, chickens lay eggs, sheep eat grass and regrow wool, and so on. Then natural spawning. */
const MobTypes = {};
const reg = (name, cls) => { MobTypes[name] = cls; };
const SEEDS = ['wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds', 'torchflower_seeds', 'pitcher_pod'];
const DYE_RGB = { white: [0.98, 1, 1], orange: [0.98, 0.5, 0.11], magenta: [0.78, 0.31, 0.74], light_blue: [0.23, 0.7, 0.85], yellow: [1, 0.85, 0.24], lime: [0.5, 0.78, 0.12], pink: [0.95, 0.55, 0.67], gray: [0.28, 0.31, 0.32], light_gray: [0.62, 0.62, 0.59], cyan: [0.09, 0.61, 0.61], purple: [0.54, 0.2, 0.72], blue: [0.24, 0.27, 0.67], brown: [0.51, 0.33, 0.2], green: [0.37, 0.49, 0.09], red: [0.69, 0.18, 0.15], black: [0.11, 0.11, 0.13] };

// ---------------------------------------------------------------- farm animals
class Pig extends Animal {
  constructor(t, x, y, z) { super(t || 'pig', x, y, z); }
  get food() { return ['carrot', 'potato', 'beetroot']; }
  saveExtra(d) { d.saddle = !!this.saddled; } loadExtra(d) { this.saddled = !!d.saddle; }
  onInteract(p, s) {
    if (s && ITEMS[s.id].name === 'saddle' && !this.saddled && !this.baby) { this.saddled = true; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } Sound.play('saddle', this); return true; }
    if (this.saddled && !p.vehicle && !this.baby) { Vehicles.mount && Vehicles.mount(p, this); return true; }
    return false;
  }
  extraDrops() { if (this.saddled) Drops.spawnItem(this.x, this.y + 0.5, this.z, stack('saddle')); }
  onLightning() { const z = Mobs.spawnEntity('zombified_piglin', this.x, this.y, this.z); if (z) { z.yaw = this.yaw; } this.removed = true; }
}
reg('pig', Pig);
class Cow extends Animal {
  constructor(t, x, y, z) { super(t || 'cow', x, y, z); }
  get food() { return ['wheat']; }
  onInteract(p, s) {
    if (s && ITEMS[s.id].name === 'bucket' && !this.baby) { ItemUse.exchange ? ItemUse.exchange(p, s, stack('milk_bucket')) : null; Sound.play('cow_milk', this); return true; }
    return false;
  }
}
reg('cow', Cow);
class Mooshroom extends Cow {
  constructor(t, x, y, z) { super('mooshroom', x, y, z); this.variant = 'red'; }
  onInteract(p, s) {
    const n = s ? ITEMS[s.id].name : '';
    if (n === 'bowl' && !this.baby) { ItemUse.exchange && ItemUse.exchange(p, s, stack('mushroom_stew')); Sound.play('mooshroom_milk', this); return true; }
    if (n === 'shears' && !this.baby) {
      this.removed = true; Particles.explosion && Particles.explosion(this.x, this.y + this.h / 2, this.z);
      const c = Mobs.spawnEntity('cow', this.x, this.y, this.z); if (c) { c.yaw = c.bodyYaw = this.yaw; c.health = this.health; }
      for (let i = 0; i < 5; i++) Drops.spawnItem(this.x, this.y + this.h, this.z, stack(this.variant === 'brown' ? 'brown_mushroom' : 'red_mushroom'));
      p.inv.damageHeld(1, p); Sound.play('shear', this); return true;
    }
    return super.onInteract(p, s);
  }
}
reg('mooshroom', Mooshroom);
class Sheep extends Animal {
  constructor(t, x, y, z) {
    super('sheep', x, y, z); this.sheared = false; this.eating = 0;
    // the game's natural colours: white 81.836%, black, grey and light grey 5% each, brown 3%, pink 0.164%
    const r = Math.random() * 100; this.color = r < 5 ? 'black' : r < 10 ? 'gray' : r < 15 ? 'light_gray' : r < 18 ? 'brown' : r < 18.164 ? 'pink' : 'white';
  }
  get food() { return ['wheat']; }
  registerGoals() { super.registerGoals(); this.goals.add(5, new G.EatGrass(this)); }
  layers() { return [{ model: 'sheep_fur', when: e => !e.sheared, color: e => e.customName === 'jeb_' ? jebColor(e) : DYE_RGB[e.color] }]; }
  ate() { if (this.sheared) this.sheared = false; if (this.baby) this.ageTicks = Math.min(0, this.ageTicks + 60 * 20); }
  animState(s, a) {
    // the head dips down to the grass while eating
    if (this.eating > 0) { const t = this.eating - a; s.eatDrop = t >= 4 && t <= 36 ? 1 : t < 4 ? t / 4 : -(t - 40) / 4; s.eatAngle = t > 4 && t <= 36 ? 0.62831855 + 0.21991149 * Math.sin((t - 4) / 32 * 28.7) : s.pitch; }
  }
  posePart(inst, s) { if (s.eatDrop !== undefined && inst.parts.head) { inst.parts.head.y += s.eatDrop * 9; inst.parts.head.rx = s.eatAngle; } }
  onInteract(p, s) {
    const n = s ? ITEMS[s.id].name : '';
    if (n === 'shears' && !this.sheared && !this.baby) { this.shear(); p.inv.damageHeld(1, p); return true; }
    if (n.endsWith('_dye') && !this.sheared) { const c = n.replace('_dye', ''); if (c !== this.color) { this.color = c; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; } }
    return false;
  }
  shear() { this.sheared = true; Sound.play('shear', this); const n = 1 + rnd(3); for (let i = 0; i < n; i++) { const it = Drops.spawnItem(this.x, this.y + 1, this.z, stack(this.color + '_wool')); if (it) { it.vy += Math.random() * 0.05; it.vx += (Math.random() - Math.random()) * 0.1; it.vz += (Math.random() - Math.random()) * 0.1; } } }
  lootTable() { return this.sheared ? 'entities/sheep' : 'entities/sheep/' + this.color; }
  extraDrops(ctx) { if (!this.sheared) return; }
  inherit(a, b) { const mixColor = { 'red+yellow': 'orange', 'white+red': 'pink', 'blue+green': 'cyan', 'blue+red': 'purple', 'blue+white': 'light_blue', 'gray+white': 'light_gray', 'black+white': 'gray', 'green+white': 'lime', 'pink+purple': 'magenta', 'blue+white': 'light_blue' }; const k = [a.color, b.color].sort().join('+'); this.color = mixColor[k] || (Math.random() < 0.5 ? a.color : b.color); }
  saveExtra(d) { d.color = this.color; d.sheared = this.sheared; } loadExtra(d) { this.color = d.color || 'white'; this.sheared = !!d.sheared; }
}
function jebColor(e) { const k = Math.floor(e.age / 25) % 16, f = (e.age % 25) / 25; const cs = Object.values(DYE_RGB); const a = cs[k], b = cs[(k + 1) % 16]; return [a[0] * (1 - f) + b[0] * f, a[1] * (1 - f) + b[1] * f, a[2] * (1 - f) + b[2] * f]; }
reg('sheep', Sheep);
class Chicken extends Animal {
  constructor(t, x, y, z) { super('chicken', x, y, z); this.eggTime = 6000 + rnd(6000); this.flap = 0; this.oFlap = 0; this.flapSpeed = 0; this.maxFall = 255; }
  get food() { return SEEDS; }
  get noFallDamage() { return true; }
  aiStep() {
    // flapping wings slow the fall
    this.oFlap = this.flap; this.flapSpeed += (this.onGround ? -1 : 4) * 0.3; this.flapSpeed = Math.max(0, Math.min(1, this.flapSpeed));
    if (!this.onGround && this.vy < 0) this.vy *= 0.6;
    this.flap += this.flapSpeed * 2;
    if (!this.baby && !this.jockey && --this.eggTime <= 0) { Sound.play('chicken_egg', this); Drops.spawnItem(this.x, this.y, this.z, stack('egg')); this.eggTime = 6000 + rnd(6000); }
  }
  hurt(n, s, a) { if (s === 'fall') return false; return super.hurt(n, s, a); }
  animState(s, a) { const f = this.oFlap + (this.flap - this.oFlap) * a; s.flap = (Math.sin(f) + 1) * this.flapSpeed; }
}
reg('chicken', Chicken);

// ---------------------------------------------------------------- undead
const ZOMBIE_TARGETS = e => e.isPlayer || e.type === 'villager' || e.type === 'wandering_trader' || e.type === 'iron_golem' || (e.type === 'turtle' && e.baby);
class Zombie extends Monster {
  constructor(t, x, y, z) { super(t || 'zombie', x, y, z); this.attackKnockback = 0; this.opensDoors = false; }
  get undead() { return true; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(0, new G.Float(this)); g.add(2, new G.MeleeAttack(this, 1, false)); g.add(7, new G.RandomStroll(this, 1)); g.add(8, new G.LookAtPlayer(this, 8)); g.add(8, new G.RandomLookAround(this));
    t.add(1, new G.HurtByTarget(this, true)); t.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 35)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'villager' || e.type === 'wandering_trader', 35, false)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'iron_golem', 35));
  }
  aiStep() { super.aiStep(); if (this.burns !== false) this.burnsInDay(); if (this.type === 'zombie' && this.eyesInWater) { if (++this.underwater > 600) this.convert('drowned'); } else this.underwater = 0; }
  onAttack(t) { if (this.type === 'husk' && t.addEffect) t.addEffect('hunger', 140 * (Game.difficulty === 'hard' ? 2 : 1), 0); }
  convert(to) { const z = Mobs.spawnEntity(to, this.x, this.y, this.z); if (z) { z.yaw = z.bodyYaw = this.yaw; z.equip = this.equip; if (this.baby) z.setBaby(); z.persistent = this.persistent; } this.removed = true; }
  onDeath(src, a) { if (a && a.type === 'zombie' || false) return; }
  // villagers killed by zombies become zombie villagers (always on hard, half on normal)
  onKill(v) { if (v.type === 'villager' && (Game.difficulty === 'hard' || (Game.difficulty === 'normal' && Math.random() < 0.5))) { const z = Mobs.spawnEntity('zombie_villager', v.x, v.y, v.z); if (z) z.profession = v.profession; v.removed = true; } }
  get speedAttr() { return super.speedAttr * (this.baby ? 1.5 : 1); }
}
reg('zombie', Zombie);
class Husk extends Zombie { constructor(t, x, y, z) { super('husk', x, y, z); this.burns = false; } aiStep() { Monster.prototype.aiStep.call(this); } }
reg('husk', Husk);
class Drowned extends Zombie {
  constructor(t, x, y, z) { super('drowned', x, y, z); this.swims = true; this.waterMalus = 0; }
  get undead() { return true; }
  aiStep() { Monster.prototype.aiStep.call(this); this.burnsInDay(); if (this.inWater) { this.vy *= 0.9; if (this.target && this.target.y > this.y + 0.5) this.vy += 0.02; else if (this.target && this.target.y < this.y - 0.5) this.vy -= 0.01; else if (!this.target) this.vy += 0.005; } }
}
reg('drowned', Drowned);
class ZombieVillager extends Zombie {
  constructor(t, x, y, z) { super('zombie_villager', x, y, z); this.curing = 0; }
  onInteract(p, s) { if (s && ITEMS[s.id].name === 'golden_apple' && this.effect('weakness') && !this.curing) { this.curing = 3600 + rnd(2400); if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } this.persistent = true; Sound.play('zombie_villager_cure', this); return true; } return false; }
  aiStep() { super.aiStep(); if (this.curing > 0 && --this.curing === 0) { const v = Mobs.spawnEntity('villager', this.x, this.y, this.z); if (v) { v.addEffect('nausea', 200, 0); v.profession = this.profession || null; } this.removed = true; } }
}
reg('zombie_villager', ZombieVillager);
class AbstractSkeleton extends Monster {
  constructor(t, x, y, z) { super(t, x, y, z); this.bowTicks = 0; this.usingBow = false; }
  get undead() { return true; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(2, new G.FleeSun(this, 1)); g.add(3, new G.AvoidEntity(this, e => e.type === 'wolf', 6, 1, 1.2));
    this.bowGoal = g.add(4, new G.RangedBow(this, 1, Game.difficulty === 'hard' ? 20 : 40, 15)); this.meleeGoal = g.add(4, new G.MeleeAttack(this, 1.2, false));
    g.add(5, new G.RandomStroll(this, 1)); g.add(6, new G.LookAtPlayer(this, 8)); g.add(6, new G.RandomLookAround(this));
    t.add(1, new G.HurtByTarget(this)); t.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'iron_golem', 16));
  }
  holdingBow() { return this.equip.main && ITEMS[this.equip.main.id].name === 'bow'; }
  startUsingBow() { this.usingBow = true; this.bowTicks = 0; }
  stopUsing() { this.usingBow = false; this.bowTicks = 0; }
  aiStep() { super.aiStep(); if (this.usingBow) this.bowTicks++; if (this.burns !== false) this.burnsInDay(); }
  shootAt(t, power) {
    const dx = t.x - this.x, dz = t.z - this.z, dy = t.y + t.h / 3 - (this.eyeY - 0.1), d = Math.hypot(dx, dz);
    const arrow = Projectiles.spawnArrow(this, this.x, this.eyeY - 0.1, this.z, { kind: this.arrowKind ? this.arrowKind() : null });
    if (!arrow) return;
    arrow.dmg = 2 + Math.random() * 0.25 + (Game.difficulty === 'easy' ? -1 : Game.difficulty === 'hard' ? 1 : 0) * 0.11 * 0 ;
    Projectiles.shoot(arrow, dx, dy + d * 0.2, dz, 1.6, 14 - (Game.difficulty === 'hard' ? 2 : Game.difficulty === 'normal' ? 1 : 0) * 4);
    Sound.play('skeleton_shoot', this);
  }
  animState(s) { s.holdingBow = this.holdingBow(); s.aggressive = this.aggressive; }
}
class Skeleton extends AbstractSkeleton { constructor(t, x, y, z) { super(t || 'skeleton', x, y, z); this.equip.main = stack('bow'); } }
reg('skeleton', Skeleton);
class Stray extends Skeleton { constructor(t, x, y, z) { super('stray', x, y, z); } arrowKind() { return { potion: 'slowness', dur: 600 }; } }
reg('stray', Stray);
class Bogged extends Skeleton { constructor(t, x, y, z) { super('bogged', x, y, z); this.attackInterval = 50; } arrowKind() { return { potion: 'poison', dur: 100 }; } }
reg('bogged', Bogged);
class WitherSkeleton extends AbstractSkeleton {
  constructor(t, x, y, z) { super('wither_skeleton', x, y, z); this.equip.main = stack('stone_sword'); this.burns = false; this.fireImmuneFlag = true; }
  get fireImmune() { return true; }
  onAttack(t) { t.addEffect && t.addEffect('wither', 200, 0); }
}
reg('wither_skeleton', WitherSkeleton);

// ---------------------------------------------------------------- creepers
class Creeper extends Monster {
  constructor(t, x, y, z) { super('creeper', x, y, z); this.swell = 0; this.oSwell = 0; this.swellDir = -1; this.fuse = 30; this.radius = 3; this.charged = false; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(1, new G.Float(this)); g.add(2, new CreeperSwell(this)); g.add(3, new G.AvoidEntity(this, e => e.type === 'cat' || e.type === 'ocelot', 6, 1, 1.2));
    g.add(4, new G.MeleeAttack(this, 1, false)); g.add(5, new G.RandomStroll(this, 0.8)); g.add(6, new G.LookAtPlayer(this, 8)); g.add(6, new G.RandomLookAround(this));
    t.add(1, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16)); t.add(2, new G.HurtByTarget(this));
  }
  doHurtTarget() { return true; }
  aiStep() {
    super.aiStep();
    this.oSwell = this.swell;
    if (this.ignited) this.swellDir = 1;
    if (this.swellDir > 0 && this.swell === 0) Sound.play('creeper_primed', this);
    this.swell += this.swellDir; if (this.swell < 0) this.swell = 0;
    if (this.swell >= this.fuse) { this.swell = this.fuse; this.explode(); }
  }
  explode() {
    this.dead = true; this.removed = true;
    Explosions.explode(this.x, this.y, this.z, this.radius * (this.charged ? 2 : 1), false, this, Game.rules.mobGriefing);
    // lingering clouds of any effects the creeper had
  }
  onInteract(p, s) { if (s && (ITEMS[s.id].name === 'flint_and_steel' || ITEMS[s.id].name === 'fire_charge')) { this.ignited = true; Sound.play('flint', this); if (ITEMS[s.id].name === 'flint_and_steel') p.inv.damageHeld(1, p); else if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; } return false; }
  onLightning() { this.charged = true; }
  // a white flash that speeds up, and the creeper swells before it blows
  animState(s, a) { const f = (this.oSwell + (this.swell - this.oSwell) * a) / (this.fuse - 2); s.swell = f; }
  posePart(inst, s) { if (s.swell > 0) { let f = Math.max(0, Math.min(1, s.swell)); const g = 1 + Math.sin(f * 100) * f * 0.01; f = f * f * f * f; const xz = (1 + f * 0.4) * g, y = (1 + f * 0.1) / g; inst.root.scale.set(xz, y, xz); } }
  get tint() { const f = this.swell / (this.fuse - 2); return (Math.floor(f * 10) % 2 === 1 && f > 0) ? [3, 3, 3] : [1, 1, 1]; }
  lootTable() { return 'entities/creeper'; }
  extraDrops(ctx) { const k = this.killer; if (k && ['skeleton', 'stray', 'bogged'].includes(k.type || (k.owner && k.owner.type))) { const discs = ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait'].map(n => 'music_disc_' + n).filter(n => IID[n] !== undefined); Drops.spawnItem(this.x, this.y + 0.5, this.z, stack(discs[rnd(discs.length)])); } }
  saveExtra(d) { d.charged = this.charged; } loadExtra(d) { this.charged = !!d.charged; }
}
class CreeperSwell extends Goal {
  constructor(m) { super(m, 'M'); }
  canUse() { const m = this.m, t = m.target; return m.swellDir > 0 || (t && m.distTo(t) < 3); }
  start() { this.m.nav.stop(); }
  tick() { const m = this.m, t = m.target; if (!t || m.distTo(t) > 7 || !m.canSee(t)) m.swellDir = -1; else m.swellDir = 1; if (m.ignited) m.swellDir = 1; }
  canContinue() { return this.canUse(); }
}
reg('creeper', Creeper);

// ---------------------------------------------------------------- spiders
class Spider extends Monster {
  constructor(t, x, y, z) { super(t || 'spider', x, y, z); this.maxFall = 5; }
  get arthropod() { return true; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(1, new G.Float(this)); g.add(3, new LeapAtTarget(this, 0.4)); g.add(4, new SpiderAttack(this)); g.add(5, new G.RandomStroll(this, 0.8)); g.add(6, new G.LookAtPlayer(this, 8)); g.add(6, new G.RandomLookAround(this));
    t.add(1, new G.HurtByTarget(this)); t.add(2, new SpiderTarget(this));
  }
  // climbing: pressing against a wall lifts the spider up it
  onClimbable() { return this.hitH || super.onClimbable(); }
  aiStep() { super.aiStep(); if (this.hitH && this.forward > 0) this.vy = Math.max(this.vy, 0.2); }
  onAttack(t) { if (this.type === 'cave_spider' && t.addEffect && Game.difficulty !== 'easy') t.addEffect('poison', (Game.difficulty === 'hard' ? 15 : 7) * 20, 0); }
  hurt(n, s, a) { if (s === 'inWeb') return false; return super.hurt(n, s, a); }
}
class SpiderAttack extends G.MeleeAttack {
  constructor(m) { super(m, 1, true); }
  canContinue() { const l = this.m.brightness(); if (l >= 0.5 && Math.random() < 0.01) { this.m.target = null; return false; } return super.canContinue(); }
}
class SpiderTarget extends G.NearestAttackableTarget { constructor(m) { super(m, TARGET_PLAYER, 16); } canUse() { return this.m.brightness() < 0.5 && super.canUse(); } }
class LeapAtTarget extends Goal {
  constructor(m, yd) { super(m, 'JM'); this.yd = yd; }
  canUse() { const m = this.m, t = m.target; if (!t || !m.onGround) return false; const d = m.distTo(t); return d >= 2 && d <= 4 && rnd(5) === 0; }
  canContinue() { return !this.m.onGround; }
  start() { const m = this.m, t = m.target; const dx = t.x - m.x, dz = t.z - m.z, l = Math.hypot(dx, dz) || 1; m.vx += dx / l * 0.4 * 0.8 + m.vx * 0.2; m.vz += dz / l * 0.4 * 0.8 + m.vz * 0.2; m.vy = this.yd; }
}
Mob.prototype.brightness = function () { const l = World.getLight(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z)); const sky = Math.max(0, (l >> 4) - Sky.skyDarken), bl = l & 15; const v = Math.max(sky, bl) / 15; return v / (4 - 3 * v); };
reg('spider', Spider);
class CaveSpider extends Spider { constructor(t, x, y, z) { super('cave_spider', x, y, z); } }
reg('cave_spider', CaveSpider);

// ---------------------------------------------------------------- endermen
const HOLDABLE = new Set(['grass_block', 'dirt', 'coarse_dirt', 'podzol', 'sand', 'red_sand', 'gravel', 'clay', 'pumpkin', 'carved_pumpkin', 'melon', 'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'brown_mushroom', 'red_mushroom', 'tnt', 'cactus', 'mycelium', 'netherrack', 'crimson_nylium', 'warped_nylium', 'moss_block', 'mud', 'muddy_mangrove_roots', 'rooted_dirt', 'crimson_fungus', 'warped_fungus', 'crimson_roots', 'warped_roots']);
class Enderman extends Monster {
  constructor(t, x, y, z) { super('enderman', x, y, z); this.carried = null; this.stareTime = 0; this.creepy = false; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(0, new G.Float(this)); g.add(2, new G.MeleeAttack(this, 1, false)); g.add(7, new G.RandomStroll(this, 1)); g.add(8, new G.LookAtPlayer(this, 8)); g.add(8, new G.RandomLookAround(this));
    t.add(1, new StareTarget(this)); t.add(2, new G.HurtByTarget(this)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'endermite', 16));
  }
  aiStep() {
    super.aiStep();
    if (this.inWater || Weather.rainingAt(this.x, this.eyeY, this.z)) { this.hurt(1, 'drown'); this.teleportRandom(); }
    if (this.target && this.target.isPlayer && this.distTo(this.target) > 16 && this.age % 30 === 0 && Math.random() < 0.3) this.teleportToward(this.target);
    this.creepy = !!(this.target && this.target.isPlayer);
    // picking up and putting down blocks
    if (Game.rules.mobGriefing && !this.target) {
      if (!this.carried && rnd(20) === 0) { const x = Math.floor(this.x) + rnd(5) - 2, y = Math.floor(this.y) + rnd(3), z = Math.floor(this.z) + rnd(5) - 2; const id = World.getBlock(x, y, z); if (HOLDABLE.has(BLOCKS[id].name) && World.getBlock(x, y + 1, z) === 0) { this.carried = { id, st: World.getState(x, y, z) }; Blocks.remove(x, y, z, null, true); } }
      else if (this.carried && rnd(2000) === 0) { const x = Math.floor(this.x) + rnd(3) - 1, y = Math.floor(this.y) + rnd(3) - 1, z = Math.floor(this.z) + rnd(3) - 1; if (World.getBlock(x, y, z) === 0 && SOLID[World.getBlock(x, y - 1, z)] && OPAQUE[World.getBlock(x, y - 1, z)]) { World.setBlock(x, y, z, this.carried.id, this.carried.st); Blocks.onPlaced(x, y, z, this.carried.id, this.carried.st, null); this.carried = null; } }
    }
  }
  onHurt(n, s) { if (s === 'arrow' || s === 'projectile' || s === 'drown') this.teleportRandom(); else if (Math.random() < 0.25 && !this.dead) this.teleportRandom(); }
  invulnerableTo(s) { return s === 'arrow' || s === 'projectile'; }
  teleportRandom() { for (let k = 0; k < 16; k++) if (this.teleportTo(this.x + (Math.random() - 0.5) * 64, this.y + rnd(64) - 32, this.z + (Math.random() - 0.5) * 64)) return true; return false; }
  teleportToward(e) { const dx = this.x - e.x, dy = this.y + this.h / 2 - e.eyeY, dz = this.z - e.z, l = Math.hypot(dx, dy, dz) || 1; return this.teleportTo(this.x + (Math.random() - 0.5) * 8 - dx / l * 16, this.y + rnd(16) - 8 - dy / l * 16, this.z + (Math.random() - 0.5) * 8 - dz / l * 16); }
  teleportTo(x, y, z) {
    x = Math.floor(x); z = Math.floor(z); y = Math.floor(y);
    if (!World.loaded(x, z)) return false;
    while (y > MINY && !SOLID[World.getBlock(x, y - 1, z)]) y--;
    if (y <= MINY || BLOCKS[World.getBlock(x, y - 1, z)].fluid) return false;
    for (let k = 0; k < 3; k++) if (SOLID[World.getBlock(x, y + k, z)] || BLOCKS[World.getBlock(x, y + k, z)].fluid) return false;
    Particles.portal && Particles.portal(this.x, this.y, this.z, this.h);
    Sound.play('enderman_teleport', this);
    this.x = this.px = x + 0.5; this.y = this.py = y; this.z = this.pz = z + 0.5; this.nav.stop();
    Sound.play('enderman_teleport', this);
    return true;
  }
  extraDrops() { if (this.carried) { const it = ITEM_OF_BLOCK[this.carried.id]; if (it >= 0) Drops.spawnItem(this.x, this.y + 1, this.z, stack(it, 1)); } }
  animState(s) { s.carrying = !!this.carried; s.creepy = this.creepy; }
  heldBlock() { return this.carried; }
  saveExtra(d) { d.carried = this.carried ? { b: BLOCKS[this.carried.id].name, st: this.carried.st } : null; } loadExtra(d) { if (d.carried && BID[d.carried.b] !== undefined) this.carried = { id: BID[d.carried.b], st: d.carried.st }; }
}
// looking an enderman in the eyes (without a carved pumpkin on) makes it hostile
class StareTarget extends Goal {
  constructor(m) { super(m, 'T'); }
  canUse() {
    const m = this.m, p = Game.player; if (!p || p.dead || p.creative || p.spectator || m.distTo(p) > 64) return false;
    const helm = p.inv.armor(0); if (helm && ITEMS[helm.id].name === 'carved_pumpkin') return false;
    const lv = p.lookVec(), dx = m.x - p.x, dy = m.eyeY - p.eyeY, dz = m.z - p.z, d = Math.hypot(dx, dy, dz);
    const dot = (lv[0] * dx + lv[1] * dy + lv[2] * dz) / d;
    if (dot <= 1 - 0.025 / d || !m.canSee(p)) return false;
    return true;
  }
  start() { this.m.target = Game.player; this.m.stareStart = this.m.age; Sound.play('enderman_stare', this.m); }
  canContinue() { const t = this.m.target; return t && !t.dead && !t.creative && !t.spectator && this.m.distTo(t) < 64; }
  stop() { this.m.target = null; }
}
reg('enderman', Enderman);

// ---------------------------------------------------------------- slimes and magma cubes
class Slime extends Monster {
  constructor(t, x, y, z, size) { super(t || 'slime', x, y, z); this.setSize(size || [1, 2, 4][rnd(3)]); this.jumpDelay = rnd(20) + 10; this.squish = 0; this.oSquish = 0; this.targetSquish = 0; }
  setSize(n) { this.size = n; const base = this.type === 'magma_cube' ? 0.52 : 0.52; this.w = this.h = base * n; this.maxHealth = this.health = n * n; this.speed = 0.2 + 0.1 * n; this.attackDamage = this.type === 'magma_cube' ? n * 2 : n === 1 ? 0 : n; this.scale = n; }
  get fireImmune() { return this.type === 'magma_cube'; }
  registerGoals() { this.targets.add(1, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16, true, 1)); this.targets.add(2, new G.NearestAttackableTarget(this, e => e.type === 'iron_golem', 16)); }
  aiStep() {
    super.aiStep();
    this.oSquish = this.squish; this.squish += (this.targetSquish - this.squish) * 0.5; this.targetSquish *= 0.6;
    const t = this.target;
    if (t) { this.lookAt(t.x, t.eyeY, t.z, 10, 10); this.yaw = turnToward(this.yaw, Math.atan2(-(t.x - this.x), -(t.z - this.z)), Math.PI / 18); }
    else if (rnd(60) === 0) this.wanderYaw = Math.random() * Math.PI * 2;
    if (!t && this.wanderYaw !== undefined) this.yaw = turnToward(this.yaw, this.wanderYaw, Math.PI / 18);
    if (this.onGround) {
      if (this.wasAir) { this.targetSquish = -0.5; Particles.slime && Particles.slime(this); Sound.play(this.type === 'magma_cube' ? 'magma_cube_squish' : 'slime_squish', this); }
      this.wasAir = false;
      if (--this.jumpDelay <= 0) {
        this.jumpDelay = rnd(20) + 10; if (t) this.jumpDelay /= 3;
        this.vy = this.type === 'magma_cube' ? 0.42 + 0.1 * this.size : 0.42; this.targetSquish = 1;
        const sp = this.speed * (t ? 1.5 : 1); this.vx = -Math.sin(this.yaw) * sp; this.vz = -Math.cos(this.yaw) * sp;
        Sound.play(this.type === 'magma_cube' ? 'magma_cube_jump' : 'slime_jump', this);
      } else { this.vx *= 0.5; this.vz *= 0.5; }
    } else this.wasAir = true;
    // touching the player hurts (big slimes only)
    const p = Game.player;
    if (p && !p.dead && this.attackDamage > 0 && this.age % 10 === 0 && Math.abs(p.x - this.x) < (this.w + p.w) / 2 + 0.2 && Math.abs(p.z - this.z) < (this.w + p.w) / 2 + 0.2 && p.y < this.y + this.h && p.y + p.h > this.y && this.canSee(p)) this.doHurtTarget(p);
  }
  travel() { const f = this.forward; this.forward = 0; super.travel(); this.forward = f; }
  onDeath() { if (this.size > 1) { const n = 2 + rnd(3); for (let i = 0; i < n; i++) { const s = Mobs.create(this.type, this.x + (Math.random() - 0.5) * this.size / 2, this.y + 0.5, this.z + (Math.random() - 0.5) * this.size / 2); s.setSize(this.size / 2); s.yaw = Math.random() * Math.PI * 2; Entities.add(s); } } }
  lootTable() { return 'entities/' + this.type; }
  animState(s, a) { const q = this.oSquish + (this.squish - this.oSquish) * a; s.squish = q; }
  posePart(inst, s) { const q = s.squish / (this.size * 0.5 + 1), k = 1 / (q + 1); inst.root.scale.set(k * this.size, (1 / k) * this.size, k * this.size); if (this.type === 'magma_cube') for (let i = 1; i < 8; i++) { const c = inst.parts['cube' + i]; if (c) c.y -= -s.squish * i * 1.7 * 0; } }
  saveExtra(d) { d.size = this.size; } loadExtra(d) { if (d.size) { this.setSize(d.size); this.health = Math.min(this.health, d.health || this.health); } }
}
reg('slime', Slime);
class MagmaCube extends Slime { constructor(t, x, y, z, size) { super('magma_cube', x, y, z, size); } get glow() { return false; } }
reg('magma_cube', MagmaCube);

// ---------------------------------------------------------------- villagers, golems and witches
class Villager extends Mob {
  constructor(t, x, y, z) { super(t || 'villager', x, y, z); this.ageTicks = 0; this.opensDoors = true; this.profession = null; this.level = 1; this.trades = null; this.persistent = true; }
  registerGoals() {
    const g = this.goals;
    g.add(0, new G.Float(this)); g.add(1, new G.AvoidEntity(this, e => ['zombie', 'husk', 'drowned', 'zombie_villager', 'pillager', 'vindicator', 'evoker', 'vex', 'ravager', 'zoglin', 'illusioner'].includes(e.type), 8, 0.6, 0.6));
    g.add(1, new G.Panic(this, 0.6)); g.add(3, new G.RandomStroll(this, 0.6)); g.add(4, new G.LookAtPlayer(this, 8, 0.05)); g.add(5, new G.LookAtPlayer(this, 8, 0.03, 'villager')); g.add(6, new G.RandomLookAround(this));
  }
  onInteract(p, s) { if (this.baby) { this.shake = 40; Sound.play('villager_no', this); return true; } if (typeof Trading !== 'undefined') { Trading.open(p, this); return true; } this.shake = 40; Sound.play('villager_no', this); return true; }
  aiStep() {
    if (this.shake > 0) this.shake--;
    if (this.tradingWith) { const p = this.tradingWith; this.nav.stop && this.nav.stop(); this.lookAt(p.x, p.eyeY, p.z); if (this.distTo(p) > 8 || p.dead) this.tradingWith = null; }
    Trading.jobTick(this);
  }
  animState(s) { s.unhappy = this.shake > 0; }
  onLightning() { const w = Mobs.spawnEntity('witch', this.x, this.y, this.z); if (w) w.persistent = true; this.removed = true; }
  saveExtra(d) { d.profession = this.profession; d.level = this.level; d.trades = this.trades; d.xp = this.xp || 0; d.job = this.job; d.vtype = this.vtype; d.restocks = this.restocks; d.lastRestock = this.lastRestock; }
  loadExtra(d) { this.profession = d.profession; this.level = d.level || 1; this.trades = d.trades; this.xp = d.xp || 0; this.job = d.job || null; this.vtype = d.vtype; this.restocks = d.restocks || 0; this.lastRestock = d.lastRestock; if (this.profession && this.type === 'villager') this.model = 'villager_' + this.profession; }
}
reg('villager', Villager);
class WanderingTrader extends Villager { constructor(t, x, y, z) { super('wandering_trader', x, y, z); this.persistent = false; this.despawnTime = 48000; } aiStep() { super.aiStep(); if (--this.despawnTime <= 0) this.removed = true; } }
reg('wandering_trader', WanderingTrader);
class IronGolem extends Mob {
  constructor(t, x, y, z) { super('iron_golem', x, y, z); this.attackT = 0; this.kbResist = 1; this.playerMade = false; this.persistent = true; this.maxFall = 255; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(1, new G.MeleeAttack(this, 1, true)); g.add(6, new G.RandomStroll(this, 0.6, 240)); g.add(7, new G.LookAtPlayer(this, 6)); g.add(8, new G.RandomLookAround(this));
    t.add(2, new G.HurtByTarget(this)); t.add(3, new G.NearestAttackableTarget(this, e => e.hostile && e.type !== 'creeper' && !e.dead, 16, false, 1));
  }
  get noFallDamage() { return true; }
  doHurtTarget(t) {
    this.attackT = 10; Sound.play('iron_golem_attack', this);
    const base = 15, dmg = base / 2 + rnd(base);
    const ok = t.hurt(dmg, 'mob', this);
    if (ok) { t.vy += 0.4; t.knockback && t.knockback(0.5, this.x - t.x, this.z - t.z); }
    return ok;
  }
  aiStep() { if (this.attackT > 0) this.attackT--; }
  animState(s, a) { s.attackTime = this.attackT > 0 ? this.attackT - a : 0; }
  onInteract(p, s) { if (s && ITEMS[s.id].name === 'iron_ingot' && this.health < this.maxHealth) { this.heal(25); if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } Sound.play('iron_golem_repair', this); return true; } return false; }
}
reg('iron_golem', IronGolem);
class SnowGolem extends Mob {
  constructor(t, x, y, z) { super('snow_golem', x, y, z); this.pumpkin = true; this.persistent = true; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(1, new SnowballAttack(this)); g.add(2, new G.RandomStroll(this, 1, 120)); g.add(3, new G.LookAtPlayer(this, 6)); g.add(4, new G.RandomLookAround(this));
    t.add(1, new G.NearestAttackableTarget(this, e => e.hostile && e.type !== 'creeper' && !e.dead, 10, true, 1));
  }
  aiStep() {
    const b = BIOMES[World.biomeAt(Math.floor(this.x), Math.floor(this.z))];
    if (b && b.temp > 1) this.hurt(1, 'onFire');
    if (this.inWater || Weather.rainingAt(this.x, this.y + 1, this.z)) this.hurt(1, 'drown');
    // a trail of snow in cold places
    if (Game.rules.mobGriefing && b && b.temp < 0.8) { const x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z); if (World.getBlock(x, y, z) === 0 && Place.canSurvive(BID.snow, 0, x, y, z)) World.setBlock(x, y, z, BID.snow, 0); }
  }
  onInteract(p, s) { if (s && ITEMS[s.id].name === 'shears' && this.pumpkin) { this.pumpkin = false; Sound.play('shear', this); Drops.spawnItem(this.x, this.y + 1.7, this.z, stack('carved_pumpkin')); p.inv.damageHeld(1, p); return true; } return false; }
}
class SnowballAttack extends Goal {
  constructor(m) { super(m, 'ML'); this.cool = 0; }
  canUse() { return !!this.m.target && !this.m.target.dead; }
  tick() { const m = this.m, t = m.target; m.lookAt(t.x, t.eyeY, t.z, 30, 30); const d = m.distTo(t); if (d > 10 || !m.canSee(t)) m.nav.moveTo(t.x, t.y, t.z, 1); else m.nav.stop(); if (--this.cool <= 0 && d < 10 && m.canSee(t)) { this.cool = 20; const dx = t.x - m.x, dz = t.z - m.z, dy = t.eyeY - 1.1 - m.y - 1.2, h = Math.hypot(dx, dz) * 0.2; const sb = Projectiles.spawn('snowball', m, m.x, m.y + 1.2, m.z); if (sb) Projectiles.shoot(sb, dx, dy + h, dz, 1.6, 12); Sound.play('snow_golem_shoot', m); } }
}
reg('snow_golem', SnowGolem);
class Witch extends Monster {
  constructor(t, x, y, z) { super('witch', x, y, z); this.drinking = 0; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(1, new G.Float(this)); g.add(2, new PotionAttack(this)); g.add(3, new G.RandomStroll(this, 1)); g.add(3, new G.LookAtPlayer(this, 8)); g.add(3, new G.RandomLookAround(this));
    t.add(1, new G.HurtByTarget(this)); t.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16));
  }
  aiStep() {
    super.aiStep();
    // drinking: water breathing under water, fire resistance when burning, healing when hurt, swiftness when chasing
    if (this.drinking > 0) { if (--this.drinking === 0 && this.drink) { this.addEffect(this.drink, this.drink === 'instant_health' ? 1 : 3600, 0); this.drink = null; this.equip.main = null; } return; }
    let d = null;
    if (Math.random() < 0.15 && this.eyesInWater && !this.effect('water_breathing')) d = 'water_breathing';
    else if (Math.random() < 0.15 && this.fireTicks > 0 && !this.effect('fire_resistance')) d = 'fire_resistance';
    else if (Math.random() < 0.05 && this.health < this.maxHealth) d = 'instant_health';
    else if (Math.random() < 0.5 && this.target && !this.effect('speed') && this.distTo(this.target) > 11) d = 'speed';
    if (d) { this.drink = d; this.drinking = 32; this.equip.main = stack('potion', 1, { tag: { potion: d } }); Sound.play('witch_drink', this); }
  }
  hurt(n, s, a) { if (s === 'magic' && a === this) n *= 0.15; return super.hurt(n, s, a); }
}
class PotionAttack extends Goal {
  constructor(m) { super(m, 'ML'); this.cool = 0; }
  canUse() { return !!this.m.target && !this.m.target.dead; }
  tick() {
    const m = this.m, t = m.target; m.lookAt(t.x, t.eyeY, t.z, 30, 30); const d = m.distTo(t);
    if (d > 10 || !m.canSee(t)) m.nav.moveTo(t.x, t.y, t.z, 1); else m.nav.stop();
    if (--this.cool <= 0 && d < 10 && m.canSee(t) && !m.drinking) {
      this.cool = 60;
      let pot = 'harming';
      if (d >= 8 && !t.effect('slowness')) pot = 'slowness'; else if (t.health >= 8 && !t.effect('poison')) pot = 'poison'; else if (d <= 3 && !t.effect('weakness') && Math.random() < 0.25) pot = 'weakness';
      const dx = t.x + t.vx - m.x, dz = t.z + t.vz - m.z, dy = t.eyeY - 1.1 - m.y, h = Math.hypot(dx, dz);
      const pr = Projectiles.spawn('splash_potion', m, m.x, m.eyeY - 0.1, m.z, { potion: pot }); if (pr) Projectiles.shoot(pr, dx, dy + h * 0.2, dz, 0.75, 8);
      Sound.play('witch_throw', m);
    }
  }
}
reg('witch', Witch);

// ---------------------------------------------------------------- wolves and cats
class Tameable extends Animal {
  constructor(t, x, y, z) { super(t, x, y, z); this.tame = false; this.owner = null; this.sitting = false; }
  ownerEntity() { return this.tame ? Game.player : null; }
  saveExtra(d) { d.tame = this.tame; d.sitting = this.sitting; d.collar = this.collar; } loadExtra(d) { this.tame = !!d.tame; this.sitting = !!d.sitting; this.collar = d.collar || 'red'; if (this.tame) { this.persistent = true; this.onTamed && this.onTamed(); } }
}
class FollowOwner extends Goal {
  constructor(m, speed, start, stop) { super(m, 'M'); this.speed = speed; this.startD = start; this.stopD = stop; }
  canUse() { const m = this.m, o = m.ownerEntity(); if (!o || o.dead || o.spectator || m.sitting || m.leashed) return false; return m.distTo(o) > this.startD; }
  canContinue() { const m = this.m, o = m.ownerEntity(); return o && !m.sitting && m.distTo(o) > this.stopD; }
  stop() { this.m.nav.stop(); }
  tick() {
    const m = this.m, o = m.ownerEntity(); m.lookAt(o.x, o.eyeY, o.z, 10, 40);
    if (m.distTo(o) >= 12) { // teleport next to the owner
      for (let k = 0; k < 10; k++) { const x = Math.floor(o.x) + rnd(7) - 3, z = Math.floor(o.z) + rnd(7) - 3, y = Math.floor(o.y) + rnd(3) - 1; if (Math.abs(x - o.x) < 2 && Math.abs(z - o.z) < 2) continue; if (Path.stand(x, y, z, Math.ceil(m.h), {}) === 0) { m.x = m.px = x + 0.5; m.y = m.py = y; m.z = m.pz = z + 0.5; m.nav.stop(); return; } }
    }
    if (m.age % 10 === 0) m.nav.moveTo(o.x, o.y, o.z, this.speed);
  }
}
class SitGoal extends Goal { constructor(m) { super(m, 'MJ'); } canUse() { return this.m.tame && this.m.sitting && !this.m.inWater; } start() { this.m.nav.stop(); } }
class Wolf extends Tameable {
  constructor(t, x, y, z) { super('wolf', x, y, z); this.angerTime = 0; this.collar = 'red'; this.attackDamage = 4; }
  get food() { return this.tame ? ['beef', 'cooked_beef', 'porkchop', 'cooked_porkchop', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rabbit', 'cooked_rabbit', 'rotten_flesh'] : []; }
  registerGoals() {
    const g = this.goals, t = this.targets;
    g.add(1, new G.Float(this)); g.add(2, new SitGoal(this)); g.add(3, new G.AvoidEntity(this, e => e.type === 'llama', 24, 1.5, 1.5)); g.add(4, new LeapAtTarget(this, 0.4)); g.add(5, new G.MeleeAttack(this, 1, true));
    g.add(6, new FollowOwner(this, 1, 10, 2)); g.add(7, new G.Breed(this, 1)); g.add(8, new G.RandomStroll(this, 1)); g.add(10, new G.LookAtPlayer(this, 8)); g.add(10, new G.RandomLookAround(this));
    t.add(1, new OwnerHurtTarget(this)); t.add(3, new G.HurtByTarget(this, true));
    t.add(5, new G.NearestAttackableTarget(this, e => !this.tame && (e.type === 'sheep' || e.type === 'rabbit' || e.type === 'fox' || (e.type === 'turtle' && e.baby)), 16, true, 10));
    t.add(6, new G.NearestAttackableTarget(this, e => ['skeleton', 'stray', 'wither_skeleton', 'bogged'].includes(e.type), 16, true, 10));
  }
  get angry() { return !!this.target && !this.target.dead; }
  onInteract(p, s) {
    const n = s ? ITEMS[s.id].name : '';
    if (!this.tame && n === 'bone' && !this.angry) { if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } if (rnd(3) === 0) { this.tame = true; this.persistent = true; this.sitting = true; this.nav.stop(); this.target = null; this.maxHealth = 40; this.health = 40; Particles.heart && Particles.heart(this, 7); } else Particles.smoke && Particles.smoke(this); return true; }
    if (this.tame) {
      if (this.isFood(s) && this.health < this.maxHealth) { this.heal(ITEMS[s.id].food ? ITEMS[s.id].food[0] : 2); this.useFood(p, s); return true; }
      if (n.endsWith('_dye')) { this.collar = n.replace('_dye', ''); if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; }
      if (!this.isFood(s) || this.health >= this.maxHealth) { if (this.isFood(s) && !this.inLove && !this.baby) return false; this.sitting = !this.sitting; this.jumping = false; this.nav.stop(); this.target = null; return true; }
    }
    return false;
  }
  animState(s) { s.sitting = this.sitting; s.angry = this.angry; s.tail = this.tame ? (0.55 - (this.maxHealth - this.health) * 0.02) * Math.PI : this.angry ? 1.5393804 : Math.PI / 5; }
  get tint() { return null; }
}
class OwnerHurtTarget extends Goal {
  constructor(m) { super(m, 'T'); this.last = -1; }
  canUse() { const m = this.m, o = m.ownerEntity(); if (!o || m.sitting) return false; const a = o.lastHurtBy; if (a && a !== m && !a.dead && o.lastHurtTime !== this.last && !(a.tame && a.owner === o)) { this.t = a; this.lastT = o.lastHurtTime; return true; } const v = o.lastAttacked; if (v && !v.dead && v !== m && o.lastAttackTime !== this.lastA && !(v.tame)) { this.t = v; this.lastA2 = o.lastAttackTime; return true; } return false; }
  start() { this.m.target = this.t; this.last = this.lastT; if (this.lastA2 !== undefined) this.lastA = this.lastA2; }
  canContinue() { const t = this.m.target; return t && !t.dead && this.m.distTo(t) < 32; }
  stop() { this.m.target = null; }
}
reg('wolf', Wolf);
class Cat extends Tameable {
  constructor(t, x, y, z) { super(t || 'cat', x, y, z); this.persistent = t === 'cat'; }
  get food() { return ['cod', 'salmon']; }
  registerGoals() {
    const g = this.goals;
    g.add(1, new G.Float(this)); g.add(1, new G.Panic(this, 1.5)); g.add(2, new SitGoal(this)); g.add(4, new G.Tempt(this, 0.6, ['cod', 'salmon'])); g.add(6, new FollowOwner(this, 1, 10, 5));
    g.add(9, new G.Breed(this, 0.8)); g.add(10, new G.RandomStroll(this, 0.8)); g.add(11, new G.LookAtPlayer(this, 10));
    this.targets.add(1, new G.NearestAttackableTarget(this, e => (e.type === 'rabbit' || (e.type === 'turtle' && e.baby)) && !this.tame, 16, true, 10));
    g.add(8, new G.MeleeAttack(this, 1, true));
  }
  onInteract(p, s) {
    const n = s ? ITEMS[s.id].name : '';
    if (!this.tame && (n === 'cod' || n === 'salmon') && this.type === 'cat') { this.useFood(p, s); if (rnd(3) === 0) { this.tame = true; this.persistent = true; this.sitting = true; Particles.heart && Particles.heart(this, 7); } else Particles.smoke && Particles.smoke(this); return true; }
    if (this.tame && !this.isFood(s)) { this.sitting = !this.sitting; this.nav.stop(); return true; }
    return false;
  }
  animState(s) { s.sitting = this.sitting; }
}
reg('cat', Cat);
class Ocelot extends Cat { constructor(t, x, y, z) { super('ocelot', x, y, z); this.trusting = false; } onInteract(p, s) { const n = s ? ITEMS[s.id].name : ''; if (!this.trusting && (n === 'cod' || n === 'salmon')) { this.useFood(p, s); if (rnd(3) === 0) { this.trusting = true; this.persistent = true; Particles.heart && Particles.heart(this, 7); } else Particles.smoke && Particles.smoke(this); return true; } return false; } }
reg('ocelot', Ocelot);

// ---------------------------------------------------------------- bats and water mobs
class Bat extends Mob {
  constructor(t, x, y, z) { super('bat', x, y, z); this.resting = false; this.targetPos = null; this.noGravity = true; }
  get noFallDamage() { return true; }
  aiStep() {
    const x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z);
    if (this.resting) { this.vx = this.vy = this.vz = 0; if (!OPAQUE[World.getBlock(x, y + 1, z)] || rnd(200) === 0 || (Game.player && this.distTo(Game.player) < 4 && !Game.player.sneaking)) this.resting = false; return; }
    if (!this.targetPos || rnd(30) === 0 || Math.hypot(this.targetPos[0] - this.x, this.targetPos[2] - this.z) < 2) this.targetPos = [this.x + rnd(7) - rnd(7), this.y + rnd(6) - 2, this.z + rnd(7) - rnd(7)];
    const dx = this.targetPos[0] + 0.5 - this.x, dy = this.targetPos[1] + 0.1 - this.y, dz = this.targetPos[2] + 0.5 - this.z;
    this.vx += (Math.sign(dx) * 0.5 - this.vx) * 0.1; this.vy += (Math.sign(dy) * 0.7 - this.vy) * 0.1; this.vz += (Math.sign(dz) * 0.5 - this.vz) * 0.1;
    this.yaw = Math.atan2(-this.vx, -this.vz); this.lookYaw = this.yaw; this.forward = 0.5;
    if (rnd(100) === 0 && OPAQUE[World.getBlock(x, y + 1, z)]) this.resting = true;
  }
  travel() { Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.9; this.vy *= 0.6; this.vz *= 0.9; }
  animState(s) { s.resting = this.resting; }
}
reg('bat', Bat);
class WaterMob extends Mob {
  constructor(t, x, y, z) { super(t, x, y, z); this.swims = true; this.dir = null; this.air = 300; }
  aiStep() {
    if (!this.inWater) { // flopping on land
      if (this.onGround && rnd(10) === 0) { this.vy = 0.4; this.vx += (Math.random() - 0.5) * 0.1; this.vz += (Math.random() - 0.5) * 0.1; this.yaw = Math.random() * Math.PI * 2; Sound.play('fish_flop', this); }
      if (--this.air < -20) { this.air = 0; this.hurt(2, 'drown'); }
      return;
    }
    this.air = 300;
    if (this.lastHurtBy && this.age - this.lastHurtTime < 40) this.dir = [this.x - this.lastHurtBy.x, 0, this.z - this.lastHurtBy.z].map(v => v * 0.2);
    if (!this.dir || rnd(this.type === 'squid' || this.type === 'glow_squid' ? 50 : 40) === 0) { const a = Math.random() * Math.PI * 2; this.dir = [Math.cos(a) * 0.2, (Math.random() - 0.5) * 0.1, Math.sin(a) * 0.2]; }
    this.vx += (this.dir[0] * this.speed * 5 - this.vx) * 0.1; this.vy += (this.dir[1] - this.vy) * 0.1; this.vz += (this.dir[2] * this.speed * 5 - this.vz) * 0.1;
    if (this.waterTop !== undefined && this.y + this.h > this.waterTop - 0.1) this.vy = Math.min(this.vy, -0.01);
    if (Math.hypot(this.vx, this.vz) > 0.01) { this.yaw = turnToward(this.yaw, Math.atan2(-this.vx, -this.vz), 0.2); this.lookYaw = this.yaw; }
  }
  travel() { if (this.inWater) { Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9; } else super.travel(); }
}
for (const n of ['squid', 'glow_squid', 'cod', 'salmon', 'tropical_fish', 'pufferfish']) reg(n, class extends WaterMob { constructor(t, x, y, z) { super(n, x, y, z); } });

// ---------------------------------------------------------------- creating, spawning and restoring
const Mobs = (() => {
  function create(type, x, y, z) {
    const C = MobTypes[type];
    if (C) return new C(type, x, y, z);
    if (!MOB_STATS[type]) return null;
    // mobs without their own behaviour yet get the general one for their kind
    const st = MOB_STATS[type];
    const m = st[4] === 'monster' ? new (class extends Monster { registerGoals() { const g = this.goals; g.add(0, new G.Float(this)); g.add(2, new G.MeleeAttack(this, 1, false)); g.add(7, new G.RandomStroll(this, 1)); g.add(8, new G.LookAtPlayer(this, 8)); this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16)); } })(type, x, y, z)
      : st[4] === 'water' ? new WaterMob(type, x, y, z) : new Animal(type, x, y, z);
    return m;
  }
  // equipment for zombies and skeletons, the game's chances (more on harder difficulty)
  function equip(m) {
    if (!(m instanceof Zombie || m instanceof AbstractSkeleton) || m instanceof WitherSkeleton) return;
    const hard = Game.difficulty === 'hard', loc = hard ? 1 : 0.5;
    if (Math.random() < 0.15 * loc) {
      let tier = rnd(2); if (Math.random() < 0.095) tier++; if (Math.random() < 0.095) tier++; if (Math.random() < 0.095) tier++;
      const mat = ['leather', 'golden', 'chainmail', 'iron', 'diamond'][tier];
      const chance = hard ? 0.1 : 0.25;
      for (const [slot, piece] of [['feet', 'boots'], ['legs', 'leggings'], ['chest', 'chestplate'], ['head', 'helmet']]) { if (slot !== 'feet' && Math.random() < chance) break; if (IID[mat + '_' + piece] !== undefined) m.equip[slot] = stack(mat + '_' + piece); }
      let pts = 0; for (const k of ['head', 'chest', 'legs', 'feet']) { const s = m.equip[k]; if (s && ITEMS[s.id].armor) pts += ITEMS[s.id].armor.pts; } m.armorPts = pts;
    }
    if (m instanceof Zombie && !(m instanceof Drowned) && Math.random() < (hard ? 0.05 : 0.01)) m.equip.main = stack(rnd(3) === 0 ? 'iron_sword' : 'iron_shovel');
    if (m instanceof Drowned) { const r = Math.random(); if (r < 0.0625) m.equip.main = stack('trident'); else if (r < 0.1) m.equip.main = stack('fishing_rod'); if (Math.random() < 0.03) m.equip.off = stack('nautilus_shell'); }
  }
  function spawnEntity(type, x, y, z, o) {
    o = o || {};
    const m = create(type, x, y, z); if (!m) return null;
    m.yaw = m.bodyYaw = m.lookYaw = Math.random() * Math.PI * 2;
    if (!o.noEquip) equip(m);
    // babies: 5% of zombies, and a chance for animals from spawn eggs
    if (m instanceof Zombie && !o.adult && Math.random() < 0.05) m.setBaby();
    if (o.baby) m.setBaby();
    if (type === 'sheep' && o.color) m.color = o.color;
    if (o.persistent) m.persistent = true;
    if (o.slimeSize && m.setSize) m.setSize(o.slimeSize);
    Entities.add(m);
    return m;
  }
  // /summon, spawn eggs
  function spawn(type, x, y, z, o) { o = o || {}; const m = spawnEntity(type, x, y, z, Object.assign({ persistent: !!o.force }, o)); if (m && o.force) m.persistent = true; return m; }
  // ---------------------------------------------------------------- natural spawning
  const CAPS = { monster: 70, creature: 10, ambient: 15, water: 5 };
  function counts() { const c = { monster: 0, creature: 0, ambient: 0, water: 0 }; for (const e of Entities.list) if (e instanceof Mob && !e.dead) { const g = e.group === 'misc' ? null : e.group; if (g && c[g] !== undefined) c[g]++; } return c; }
  function pickWeighted(list) { let t = 0; for (const s of list) t += s[1]; let k = Math.random() * t; for (const s of list) { k -= s[1]; if (k < 0) return s; } return list[0]; }
  // may a monster spawn here? (light 0 for block light, darkness from the sky with a random allowance)
  function darkEnough(x, y, z) {
    const l = World.getLight(x, y, z), sky = l >> 4, bl = l & 15;
    if (World.dim === 'nether') return bl <= 11;
    if (World.dim === 'end') return bl === 0;
    if (sky > rnd(32)) return false;
    if (bl > 0) return false;
    return Math.max(0, sky - Sky.skyDarken) <= rnd(8);
  }
  function spawnable(type, x, y, z) {
    const below = World.getBlock(x, y - 1, z), bd = BLOCKS[below];
    const st = MOB_STATS[type], group = st ? st[4] : 'monster';
    if (group === 'water' || type === 'guardian') return BLOCKS[World.getBlock(x, y, z)].fluid === 'water' && BLOCKS[World.getBlock(x, y + 1, z)].fluid === 'water';
    if (group === 'ambient') return World.getBlock(x, y, z) === 0 && y < 63 && World.lightLevel(x, y, z) <= rnd(4);
    if (!SOLID[below] || !bd.opaque && bd.model !== 'slab' && !bd.name.endsWith('_leaves') || below === BID.bedrock || below === BID.barrier || bd.name.endsWith('glass')) return false;
    if (bd.model === 'slab' && !((World.getState(x, y - 1, z) >> 3) & 2) && ((World.getState(x, y - 1, z) >> 3) & 3) === 0) return false;
    const h = Math.ceil(MCDATA.entities[type] ? MCDATA.entities[type][2] : 2);
    for (let k = 0; k < h; k++) { const id = World.getBlock(x, y + k, z); if (SOLID[id] || BLOCKS[id].fluid || id === BID.powder_snow) return false; }
    if (group === 'monster') { if (!darkEnough(x, y, z)) return group === 'monster' && type === 'slime' ? false : false; if (World.dim === 'overworld' && below === BID.mycelium) return false; }
    if (group === 'creature') {
      if (World.lightLevel(x, y, z) < 9 && World.dim === 'overworld') return false;
      const ok = { rabbit: [BID.grass_block, BID.snow_block, BID.sand, BID.snow], goat: [BID.stone, BID.snow, BID.snow_block, BID.packed_ice, BID.grass_block], mooshroom: [BID.mycelium], parrot: [BID.grass_block, BID.jungle_leaves, BID.oak_leaves, BID.jungle_log], polar_bear: [BID.ice, BID.snow_block, BID.packed_ice, BID.snow], turtle: [BID.sand], frog: [BID.grass_block, BID.mud, BID.mangrove_roots, BID.muddy_mangrove_roots], armadillo: [BID.red_sand, BID.coarse_dirt, BID.terracotta, BID.grass_block], camel: [BID.sand], fox: [BID.grass_block, BID.snow, BID.snow_block, BID.podzol, BID.coarse_dirt] }[type];
      if (ok ? !ok.includes(below) : below !== BID.grass_block) return false;
    }
    return true;
  }
  function spawnTick() {
    const p = Game.player; if (!p || !Game.rules.doMobSpawning || p.dead) return;
    const c = counts();
    const cats = [];
    if (Game.difficulty !== 'peaceful' && c.monster < CAPS.monster) cats.push('monster');
    if (Game.gameTime % 400 === 0 && c.creature < CAPS.creature) cats.push('creature');
    if (c.ambient < CAPS.ambient && World.dim === 'overworld') cats.push('ambient');
    if (c.water < CAPS.water && World.dim === 'overworld') cats.push('water');
    if (!cats.length) return;
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16), R = Math.min(8, Settings.renderDist);
    // try a handful of random chunks each tick (the game tries every chunk; this keeps the cost down)
    for (let k = 0; k < 12; k++) {
      const cx = pcx + rnd(2 * R + 1) - R, cz = pcz + rnd(2 * R + 1) - R;
      const ch = World.getChunk(cx, cz); if (!ch || !ch.lit) continue;
      for (const cat of cats) spawnCluster(cat, ch, p);
    }
  }
  function spawnCluster(cat, ch, p) {
    const x0 = ch.cx * 16 + rnd(16), z0 = ch.cz * 16 + rnd(16);
    const top = ch.height[(x0 & 15) + (z0 & 15) * 16] + 1;
    const y0 = MINY + rnd(Math.max(1, top - MINY + 1));
    const bi = World.biomeAt(x0, z0), b = BIOMES[bi];
    let list = cat === 'monster' ? b.hostile : cat === 'creature' ? b.passive : cat === 'water' ? b.waterMobs : [['bat', 10, 8, 8]];
    // structures with their own spawns (the game's structure spawn overrides)
    if (cat === 'monster' || (cat === 'creature' && World.dim === 'overworld')) {
      const here = Structures.at(x0, y0, z0, World.dim === 'nether' ? ['fortress'] : ['ocean_monument', 'swamp_hut', 'pillager_outpost']);
      if (here.includes('fortress') && cat === 'monster') list = [['blaze', 10, 2, 3], ['zombified_piglin', 5, 4, 4], ['wither_skeleton', 8, 5, 5], ['skeleton', 2, 5, 5], ['magma_cube', 3, 4, 4]];
      else if (here.includes('ocean_monument') && cat === 'monster') list = [['guardian', 1, 2, 4]];
      else if (here.includes('swamp_hut')) list = cat === 'monster' ? [['witch', 1, 1, 1]] : [['cat', 1, 1, 1]];
      else if (here.includes('pillager_outpost') && cat === 'monster') list = [['pillager', 1, 1, 1]];
    }
    if (cat === 'monster' && World.dim === 'overworld' && b.name === 'mushroom_fields') return;
    if (cat === 'monster' && World.dim === 'overworld' && y0 < 0 && b.name === 'deep_dark') return;
    if (!list || !list.length) return;
    let x = x0, y = y0, z = z0, type = null, n = 0;
    for (let pack = 0; pack < 3; pack++) {
      const g = pickWeighted(list);
      if (!MobTypes[g[0]] && !EntityModels.DEFS[g[0]]) continue;
      const size = g[2] + rnd(g[3] - g[2] + 1);
      for (let i = 0; i < size; i++) {
        x += rnd(6) - rnd(6); z += rnd(6) - rnd(6);
        if (!World.loaded(x, z)) continue;
        const d2 = (x + 0.5 - p.x) ** 2 + (y - p.y) ** 2 + (z + 0.5 - p.z) ** 2;
        if (d2 < 24 * 24 || d2 > 128 * 128) continue;
        if (!spawnable(g[0], x, y, z)) continue;
        if (g[0] === 'slime' && !slimeOk(x, y, z)) continue;
        const m = spawnEntity(g[0], x + 0.5, y, z + 0.5);
        if (m) n++;
        type = g[0];
        if (n >= (cat === 'monster' ? 4 : 8)) return;
      }
    }
    void type;
  }
  // slimes: swamps at night by the moon phase, or slime chunks deep down
  function slimeOk(x, y, z) {
    const b = BIOMES[World.biomeAt(x, z)].name;
    if ((b === 'swamp' || b === 'mangrove_swamp') && y > 50 && y < 70) return Math.random() < 0.5 && Math.random() < [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75][Sky.moonPhase] && World.lightLevel(x, y, z) <= rnd(8);
    if (y < 40 && slimeChunk(x >> 4, z >> 4)) return rnd(10) === 0;
    return false;
  }
  function slimeChunk(cx, cz) { return hashInt(World.seed ^ 987234911, cx, cz, 4987142) % 10 === 0; }
  // animals put down when a chunk is generated (the game's 10% chance per chunk)
  function chunkAnimals(c) {
    if (c.fromSave || World.dim !== 'overworld' || Math.random() >= 0.1) return;
    const x0 = c.cx * 16 + rnd(16), z0 = c.cz * 16 + rnd(16), b = BIOMES[c.biomes[(x0 & 15) + (z0 & 15) * 16]];
    const list = b.passive; if (!list || !list.length) return;
    const g = pickWeighted(list); if (!MobTypes[g[0]] && !EntityModels.DEFS[g[0]]) return;
    const size = g[2] + rnd(g[3] - g[2] + 1);
    for (let i = 0; i < size; i++) {
      const x = x0 + rnd(5) - 2, z = z0 + rnd(5) - 2;
      if ((x >> 4) !== c.cx || (z >> 4) !== c.cz) continue;
      const y = c.height[(x & 15) + (z & 15) * 16] + 1;
      if (!spawnable(g[0], x, y, z)) continue;
      const m = spawnEntity(g[0], x + 0.5, y, z + 0.5, { noEquip: true }); if (m) m.persistent = true;
    }
  }
  World.listeners.chunkLoaded.push(c => { if (Game.running && Game.structures !== undefined) chunkAnimals(c); });
  function tick() { spawnTick(); }
  return { create, spawn, spawnEntity, tick, spawnable, slimeChunk, equip, CAPS, darkEnough };
})();
// saved entities come back through here
Entities.restore = (d, dim) => {
  if (d.type === 'item') { const e = new ItemEntity(d.x, d.y, d.z, d.stack); e.age = d.age || 0; e.pickupDelay = d.pickupDelay || 0; e.dim = dim; return Entities.add(e); }
  if (d.type === 'xp_orb') { const e = new XpOrb(d.x, d.y, d.z, d.value); e.age = d.age || 0; return Entities.add(e); }
  if (Projectiles.restore && Projectiles.restore(d)) return;
  if (Vehicles.restore && Vehicles.restore(d)) return;
  if (Decor.restore(d)) return;
  if (Leads.restore(d)) return;
  const m = Mobs.create(d.type, d.x, d.y, d.z); if (!m) return;
  m.load(d); m.dim = dim; Entities.add(m);
};
ItemEntity.prototype.save = function () { return { type: 'item', x: this.x, y: this.y, z: this.z, stack: this.stack, age: this.age, pickupDelay: this.pickupDelay }; };
XpOrb.prototype.save = function () { return { type: 'xp_orb', x: this.x, y: this.y, z: this.z, value: this.value, age: this.age }; };
