'use strict';
/* The rest of the mobs: rabbits hop, bees and parrots fly, foxes hunt chickens, horses can be fed, frogs
   leap, axolotls and dolphins swim, striders walk on lava, ghasts and blazes shoot fireballs, piglins love
   gold, hoglins avoid warped fungus, pillagers shoot crossbows, vindicators swing axes, evokers summon fangs
   and vexes, guardians fire beams, shulkers shoot homing bullets, phantoms swoop at the sleepless. */
(function moreMobs() {
  const reg = (n, c) => { MobTypes[n] = c; };
  const TARGET_PLAYER = e => e.isPlayer;
  // ---------------------------------------------------------------- flying movement shared by bees, parrots, ghasts, blazes, vexes, allays, phantoms
  class Flyer extends Mob {
    constructor(t, x, y, z) { super(t, x, y, z); this.noGravity = true; this.dest = null; this.flySpeed = 0.1; }
    get noFallDamage() { return true; }
    flyTo(x, y, z, sp) { this.dest = [x, y, z]; this.flyTo_s = sp || 1; }
    aiStep() {
      if (this.aiFly) this.aiFly();
      if (!this.dest || rnd(60) === 0 && !this.target) { this.dest = [this.x + rnd(16) - 8, Math.max(MINY + 2, this.y + rnd(8) - 4), this.z + rnd(16) - 8]; this.flyTo_s = 0.6; }
      const [x, y, z] = this.dest, dx = x - this.x, dy = y - this.y, dz = z - this.z, d = Math.hypot(dx, dy, dz);
      if (d < 0.6) { this.dest = null; return; }
      const k = this.flySpeed * (this.flyTo_s || 1);
      this.vx += (dx / d * k - this.vx) * 0.1; this.vy += (dy / d * k - this.vy) * 0.1; this.vz += (dz / d * k - this.vz) * 0.1;
      if (Math.hypot(this.vx, this.vz) > 0.01 && !this.target) this.yaw = turnToward(this.yaw, Math.atan2(-this.vx, -this.vz), 0.3);
      if (this.target) { this.yaw = turnToward(this.yaw, Math.atan2(-(this.target.x - this.x), -(this.target.z - this.z)), 0.3); this.lookAt(this.target.x, this.target.eyeY, this.target.z); }
      this.lookYaw = this.yaw; this.forward = 0.3;
    }
    travel() { if (this.noClipFly) { this.x += this.vx; this.y += this.vy; this.z += this.vz; } else Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.91; this.vy *= 0.91; this.vz *= 0.91; if (this.hitH || this.hitV) this.dest = null; }
  }
  // ---------------------------------------------------------------- animals
  class Rabbit extends Animal {
    constructor(t, x, y, z) { super('rabbit', x, y, z); this.jumpT = 0; this.hop = 0; }
    get food() { return ['carrot', 'golden_carrot', 'dandelion']; }
    registerGoals() { super.registerGoals(); this.goals.add(4, new G.AvoidEntity(this, e => e.isPlayer && !e.sneaking || e.type === 'wolf' || e.type === 'fox', 8, 2.2, 2.2)); }
    aiStep() { if (this.forward > 0 && this.onGround && --this.jumpT <= 0) { this.vy = 0.5 * 0.42 + 0.1 * 0; this.jumpT = 6 + rnd(6); this.hop = 10; Sound.play('rabbit_jump', this); } if (this.hop > 0) this.hop--; if (this.onGround && this.hop <= 0) { this.vx *= 0.5; this.vz *= 0.5; } }
    animState(s) { s.jump = this.hop > 0 ? Math.sin((10 - this.hop) / 10 * Math.PI) : 0; }
    get speedAttr() { return super.speedAttr * (this.onGround ? 0.6 : 1); }
  }
  reg('rabbit', Rabbit);
  class Fox extends Animal {
    constructor(t, x, y, z) { super('fox', x, y, z); this.sleeping = false; this.heldStack = null; }
    get food() { return ['sweet_berries', 'glow_berries']; }
    registerGoals() {
      const g = this.goals, t = this.targets;
      g.add(0, new G.Float(this)); g.add(1, new G.Panic(this, 2.2)); g.add(2, new G.Breed(this, 1)); g.add(3, new G.AvoidEntity(this, e => (e.isPlayer && !e.sneaking) || e.type === 'wolf' || e.type === 'polar_bear', 16, 1.6, 1.4));
      g.add(4, new G.MeleeAttack(this, 1.2, true)); g.add(6, new G.FollowParent(this, 1.25)); g.add(7, new G.RandomStroll(this, 1)); g.add(8, new G.LookAtPlayer(this, 24)); g.add(9, new G.RandomLookAround(this));
      t.add(4, new G.NearestAttackableTarget(this, e => e.type === 'chicken' || e.type === 'rabbit' || (e.type === 'cod' || e.type === 'salmon' || e.type === 'tropical_fish') || (e.type === 'turtle' && e.baby), 10, true, 10));
    }
    aiStep() { const day = World.dim === 'overworld' && Sky.skyDarken < 4; this.sleeping = day && !this.target && this.noActionTime > 200 && Math.random() < 0.999 && World.skyLight(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) < 15 ? true : (day && this.sleeping && !this.lastHurtBy); if (this.sleeping) { this.nav.stop(); this.forward = 0; } }
    heldItem() { return this.heldStack; }
    animState(s) { s.sleeping = this.sleeping; }
  }
  reg('fox', Fox);
  class Horse extends Animal {
    constructor(t, x, y, z) { super(t, x, y, z); this.tame = false; this.temper = 0; this.saddled = false; const k = MOB_STATS[t]; this.maxHealth = this.health = 15 + rnd(8) + rnd(9); this.speed = 0.1125 + Math.random() * 0.1125 + Math.random() * 0.1125 + Math.random() * 0.1125 * 0; this.jumpStrength = 0.4 + Math.random() * 0.2 + Math.random() * 0.2 + Math.random() * 0.2; void k; }
    get food() { return ['golden_apple', 'enchanted_golden_apple', 'golden_carrot']; }
    onInteract(p, s) {
      const n = s ? ITEMS[s.id].name : '';
      if (['wheat', 'sugar', 'apple', 'hay_block', 'golden_carrot', 'golden_apple'].includes(n) && this.health < this.maxHealth) { this.heal({ wheat: 2, sugar: 1, apple: 3, hay_block: 20, golden_carrot: 4, golden_apple: 10 }[n]); this.temper = Math.min(100, this.temper + ({ sugar: 3, wheat: 3, apple: 3, golden_carrot: 5, golden_apple: 10 }[n] || 0)); this.useFood(p, s); Sound.play('horse_eat', this); return true; }
      if (this.tame && n === 'saddle' && !this.saddled && this.type !== 'donkey' && this.type !== 'mule' || (this.tame && n === 'saddle' && !this.saddled)) { this.saddled = true; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } Sound.play('saddle', this); return true; }
      if (!this.baby && !p.vehicle) { Vehicles.mount && Vehicles.mount(p, this); return true; }
      return false;
    }
    saveExtra(d) { d.tame = this.tame; d.saddled = this.saddled; d.temper = this.temper; d.speed = this.speed; d.jumpStrength = this.jumpStrength; d.maxHealth = this.maxHealth; } loadExtra(d) { Object.assign(this, { tame: !!d.tame, saddled: !!d.saddled, temper: d.temper || 0 }); if (d.speed) this.speed = d.speed; if (d.jumpStrength) this.jumpStrength = d.jumpStrength; if (d.maxHealth) this.maxHealth = d.maxHealth; }
    extraDrops() { if (this.saddled) Drops.spawnItem(this.x, this.y + 1, this.z, stack('saddle')); }
    animState(s) { s.eat = this.eatT > 0; }
  }
  for (const n of ['horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse']) reg(n, class extends Horse { constructor(t, x, y, z) { super(n, x, y, z); } });
  class Llama extends Animal {
    constructor(t, x, y, z) { super(t || 'llama', x, y, z); this.maxHealth = this.health = 15 + rnd(8) + rnd(9); }
    get food() { return ['hay_block']; }
    registerGoals() { super.registerGoals(); this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, e => e.type === 'wolf', 16)); this.goals.add(3, new LlamaSpit(this)); }
  }
  class LlamaSpit extends Goal {
    constructor(m) { super(m, 'ML'); this.cool = 0; }
    canUse() { return !!this.m.target && !this.m.target.dead; }
    tick() { const m = this.m, t = m.target; m.lookAt(t.x, t.eyeY, t.z, 30, 30); if (m.distTo(t) > 10) m.nav.moveTo(t.x, t.y, t.z, 1.25); else m.nav.stop(); if (--this.cool <= 0 && m.canSee(t)) { this.cool = 40; const sp = Projectiles.spawn('llama_spit', m, m.x, m.eyeY - 0.1, m.z); if (sp) { sp.onEntity = function (e) { e.hurt(1, 'mob', this.owner); this.removed = true; }; Projectiles.shoot(sp, t.x - m.x, t.eyeY - m.eyeY + Math.hypot(t.x - m.x, t.z - m.z) * 0.2, t.z - m.z, 1.5, 10); } Sound.play('llama_spit', m); } }
  }
  reg('llama', Llama); reg('trader_llama', class extends Llama { constructor(t, x, y, z) { super('trader_llama', x, y, z); } });
  class Goat extends Animal { constructor(t, x, y, z) { super('goat', x, y, z); this.screaming = Math.random() < 0.02; this.maxFall = 10; } get food() { return ['wheat']; } onInteract(p, s) { if (s && ITEMS[s.id].name === 'bucket' && !this.baby) { ItemUse.exchange && ItemUse.exchange(p, s, stack('milk_bucket')); Sound.play('cow_milk', this); return true; } return false; } hurt(n, s, a) { if (s === 'fall') n = Math.max(0, n - 10); return super.hurt(n, s, a); } }
  reg('goat', Goat);
  class Turtle extends Animal { constructor(t, x, y, z) { super('turtle', x, y, z); this.swims = true; this.waterMalus = 0; } get food() { return ['seagrass']; } aiStep() { if (this.inWater) { this.vy *= 0.9; if (this.forward) this.vy += 0.005; } } }
  reg('turtle', Turtle);
  class Panda extends Animal { constructor(t, x, y, z) { super('panda', x, y, z); this.sitting = false; } get food() { return ['bamboo']; } registerGoals() { super.registerGoals(); this.targets.add(1, new G.HurtByTarget(this)); this.goals.add(2, new G.MeleeAttack(this, 1.2, true)); } aiStep() { if (rnd(400) === 0 && !this.target) this.sitting = !this.sitting; if (this.sitting) this.nav.stop(); } animState(s) { s.sitting = this.sitting; } }
  reg('panda', Panda);
  class PolarBear extends Animal {
    constructor(t, x, y, z) { super('polar_bear', x, y, z); }
    get food() { return []; }
    registerGoals() { const g = this.goals, t = this.targets; g.add(0, new G.Float(this)); g.add(1, new G.MeleeAttack(this, 1.25, true)); g.add(4, new G.FollowParent(this, 1.25)); g.add(5, new G.RandomStroll(this, 1)); g.add(6, new G.LookAtPlayer(this, 6)); g.add(7, new G.RandomLookAround(this)); t.add(1, new G.HurtByTarget(this, true)); t.add(2, new G.NearestAttackableTarget(this, e => e.isPlayer && this.nearest(o => o.type === 'polar_bear' && o.baby, 8), 20)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'fox', 10)); }
  }
  reg('polar_bear', PolarBear);
  class Frog extends Animal {
    constructor(t, x, y, z) { super('frog', x, y, z); this.swims = true; this.waterMalus = 0; this.variant = 'temperate'; this.croak = 0; }
    get food() { return ['slime_ball']; }
    registerGoals() { super.registerGoals(); this.targets.add(1, new G.NearestAttackableTarget(this, e => (e.type === 'slime' && e.size === 1) || (e.type === 'magma_cube' && e.size === 1), 10, true, 3)); this.goals.add(2, new G.MeleeAttack(this, 1.5, false)); }
    doHurtTarget(t) { t.removed = true; Sound.play('frog_eat', this); if (t.type === 'magma_cube') Drops.spawnItem(t.x, t.y, t.z, stack(this.variant === 'warm' ? 'pearlescent_froglight' : this.variant === 'cold' ? 'verdant_froglight' : 'ochre_froglight')); else Drops.spawnItem(t.x, t.y, t.z, stack('slime_ball')); return true; }
    aiStep() { if (this.forward > 0 && this.onGround && rnd(30) === 0) { this.vy = 0.5; } if (this.croak > 0) this.croak--; else if (rnd(400) === 0) this.croak = 40; }
    animState(s) { s.croak = this.croak > 0 ? Math.abs(Math.sin(this.croak * 0.3)) * 0.3 : 0; }
    breedWith(q) { this.inLove = 0; q.inLove = 0; this.ageTicks = 6000; q.ageTicks = 6000; Drops.spawnXp(this.x, this.y, this.z, 1 + rnd(7)); }
  }
  reg('frog', Frog);
  class Axolotl extends Mob {
    constructor(t, x, y, z) { super('axolotl', x, y, z); this.swims = true; this.waterMalus = 0; this.ageTicks = 0; this.air = 6000; }
    registerGoals() { const g = this.goals; g.add(1, new G.MeleeAttack(this, 1.2, true)); g.add(5, new G.RandomStroll(this, 1)); this.targets.add(1, new G.NearestAttackableTarget(this, e => ['squid', 'glow_squid', 'cod', 'salmon', 'tropical_fish', 'pufferfish', 'drowned', 'guardian', 'elder_guardian'].includes(e.type), 8, true, 10)); }
    aiStep() { if (!this.inWater && !Weather.rainingAt(this.x, this.y, this.z)) { if (--this.air < 0) { this.air = 0; if (this.age % 20 === 0) this.hurt(2, 'drown'); } } else this.air = 6000; if (this.inWater) this.vy *= 0.9; }
    animState(s) { s.inWater = this.inWater; }
    onInteract(p, s) { if (s && ITEMS[s.id].name === 'water_bucket') { ItemUse.exchange && ItemUse.exchange(p, s, stack('axolotl_bucket')); this.removed = true; return true; } return false; }
  }
  reg('axolotl', Axolotl);
  class DolphinMob extends Mob {
    constructor(t, x, y, z) { super('dolphin', x, y, z); this.swims = true; this.air = 4800; }
    aiStep() {
      if (!this.inWater) { if (this.onGround && rnd(10) === 0) { this.vy = 0.5; this.yaw = Math.random() * Math.PI * 2; } if (--this.air < 0 && this.age % 20 === 0) this.hurt(1, 'drown'); return; }
      if (this.eyesInWater) { if (--this.air < 0 && this.age % 20 === 0) this.hurt(2, 'drown'); } else this.air = 4800;
      if (this.air < 600) this.vy += 0.02; // surface to breathe
      const p = Game.player;
      if (p && p.inWater && this.distTo(p) < 16 && this.distTo(p) > 3) { const dx = p.x - this.x, dy = p.y - this.y, dz = p.z - this.z, d = Math.hypot(dx, dy, dz); this.vx += dx / d * 0.02; this.vy += dy / d * 0.02; this.vz += dz / d * 0.02; if (d < 8) p.addEffect && p.addEffect('dolphins_grace', 100, 0); }
      else if (rnd(40) === 0 || !this.dir) { const a = Math.random() * Math.PI * 2; this.dir = [Math.cos(a) * 0.08, (Math.random() - 0.5) * 0.04, Math.sin(a) * 0.08]; }
      if (this.dir) { this.vx += (this.dir[0] - this.vx) * 0.05; this.vy += (this.dir[1] - this.vy) * 0.05; this.vz += (this.dir[2] - this.vz) * 0.05; }
      if (Math.hypot(this.vx, this.vz) > 0.01) { this.yaw = turnToward(this.yaw, Math.atan2(-this.vx, -this.vz), 0.2); this.lookYaw = this.yaw; }
      this.pitch = -Math.atan2(this.vy, Math.hypot(this.vx, this.vz) + 0.001) * 0.6;
    }
    travel() { if (this.inWater) { Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.95; this.vy *= 0.9; this.vz *= 0.95; } else super.travel(); }
    animState(s) { s.moving = Math.hypot(this.vx, this.vz) > 0.02; }
  }
  reg('dolphin', DolphinMob);
  class Bee extends Flyer {
    constructor(t, x, y, z) { super('bee', x, y, z); this.angry = 0; this.stung = false; this.ageTicks = 0; this.flySpeed = 0.1; }
    get food() { return ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'sunflower', 'lilac', 'rose_bush', 'peony', 'torchflower', 'pink_petals', 'cherry_leaves', 'wither_rose', 'pitcher_plant', 'flowering_azalea', 'flowering_azalea_leaves', 'mangrove_propagule', 'spore_blossom', 'chorus_flower'].filter(n => IID[n] !== undefined); }
    registerGoals() { this.targets.add(1, new G.HurtByTarget(this, true)); }
    aiFly() {
      const t = this.target;
      if (t && !this.stung) { this.flyTo(t.x, t.y + t.h * 0.5, t.z, 1.6); if (this.distTo(t) < 1.2 && this.age % 10 === 0) { if (t.hurt(2, 'sting', this)) { this.stung = true; if (t.addEffect && Game.difficulty !== 'easy') t.addEffect('poison', Game.difficulty === 'hard' ? 360 : 200, 0); this.target = null; this.dieTimer = 600 + rnd(600); } } }
      if (this.stung && --this.dieTimer <= 0) this.hurt(100, 'magic');
      if (!this.dest && rnd(20) === 0) this.dest = [this.x + rnd(10) - 5, this.y + rnd(5) - 2, this.z + rnd(10) - 5];
    }
  }
  reg('bee', Bee);
  class Parrot extends Flyer {
    constructor(t, x, y, z) { super('parrot', x, y, z); this.tame = false; this.flap = 0; this.flySpeed = 0.15; }
    aiFly() { if (this.onGround && rnd(80) !== 0 && !this.dest) { this.noGravity = false; return; } this.noGravity = true; this.flap += 0.3; }
    onInteract(p, s) { const n = s ? ITEMS[s.id].name : ''; if (!this.tame && SEEDS.includes(n)) { this.useFood(p, s); if (rnd(10) === 0) { this.tame = true; this.persistent = true; Particles.heart(this, 7); } else Particles.smoke(this); return true; } if (n === 'cookie') { this.useFood(p, s); this.addEffect('poison', 900, 0); this.hurt(100, 'magic', p); return true; } return false; }
    animState(s) { s.flying = !this.onGround; s.flap = Math.abs(Math.sin(this.flap)) * 0.6; }
  }
  reg('parrot', Parrot);
  class Allay extends Flyer { constructor(t, x, y, z) { super('allay', x, y, z); this.persistent = true; this.flySpeed = 0.1; } aiFly() { const p = Game.player; if (p && this.distTo(p) > 4 && this.liked) this.flyTo(p.x, p.y + 1.5, p.z, 1); } onInteract(p, s) { this.liked = true; return true; } }
  reg('allay', Allay);
  class Camel extends Animal { constructor(t, x, y, z) { super('camel', x, y, z); this.sitting = false; } get food() { return ['cactus']; } aiStep() { if (rnd(2000) === 0) this.sitting = !this.sitting; if (this.sitting) this.nav.stop(); } animState(s) { s.sitting = this.sitting; } onInteract(p, s) { if (s && ITEMS[s.id].name === 'saddle' && !this.saddled) { this.saddled = true; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; } if (this.saddled && !p.vehicle) { Vehicles.mount && Vehicles.mount(p, this); return true; } return false; } }
  reg('camel', Camel);
  class Armadillo extends Animal { constructor(t, x, y, z) { super('armadillo', x, y, z); this.rolled = 0; this.scuteT = 6000 + rnd(6000); } get food() { return ['spider_eye']; } aiStep() { const threat = this.nearest(e => (e.isPlayer && e.sprinting) || (e.hostile && !e.dead), 7); if (threat || this.lastHurtBy && this.age - this.lastHurtTime < 60) this.rolled = 60; if (this.rolled > 0) { this.rolled--; this.nav.stop(); this.forward = 0; } if (--this.scuteT <= 0) { Drops.spawnItem(this.x, this.y, this.z, stack('armadillo_scute')); this.scuteT = 6000 + rnd(6000); } } hurt(n, s, a) { if (this.rolled > 0) n = Math.max(0, (n - 1) / 2); return super.hurt(n, s, a); } animState(s) { s.rolled = this.rolled > 0; } onInteract(p, s) { if (s && ITEMS[s.id].name === 'brush' && !this.baby) { Drops.spawnItem(this.x, this.y + 0.5, this.z, stack('armadillo_scute')); p.inv.damageHeld(16, p); return true; } return false; } }
  reg('armadillo', Armadillo);
  class Sniffer extends Animal { constructor(t, x, y, z) { super('sniffer', x, y, z); this.digT = 0; } get food() { return ['torchflower_seeds']; } aiStep() { if (!this.target && rnd(1200) === 0 && !this.baby) this.digT = 120; if (this.digT > 0) { this.nav.stop(); if (--this.digT === 0) { const b = World.getBlock(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z)); if ([BID.grass_block, BID.dirt, BID.coarse_dirt, BID.podzol, BID.moss_block, BID.mud, BID.rooted_dirt].includes(b)) Drops.spawnItem(this.x, this.y + 0.5, this.z, stack(Math.random() < 0.5 ? 'torchflower_seeds' : 'pitcher_pod')); } } } }
  reg('sniffer', Sniffer);
  class Strider extends Animal {
    constructor(t, x, y, z) { super('strider', x, y, z); this.fireImmuneFlag = true; this.cold = false; }
    get food() { return ['warped_fungus']; }
    get fireImmune() { return true; }
    aiStep() { const below = World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)); this.cold = BLOCKS[below].fluid !== 'lava' && !this.inLava; if (this.inLava) { this.vy = Math.max(this.vy, 0.05); this.onGround = true; } if (this.cold && this.age % 20 === 0 && World.dim === 'nether' && Math.random() < 0.02) this.hurt(1, 'freeze'); }
    get speedAttr() { return super.speedAttr * (this.cold ? 0.66 : 1); }
    onInteract(p, s) { if (s && ITEMS[s.id].name === 'saddle' && !this.saddled) { this.saddled = true; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; } if (this.saddled && !p.vehicle) { Vehicles.mount && Vehicles.mount(p, this); return true; } return false; }
  }
  reg('strider', Strider);

  // ---------------------------------------------------------------- monsters
  class SimpleMelee extends Monster {
    registerGoals() { const g = this.goals, t = this.targets; g.add(0, new G.Float(this)); g.add(2, new G.MeleeAttack(this, 1, false)); g.add(7, new G.RandomStroll(this, 1)); g.add(8, new G.LookAtPlayer(this, 8)); t.add(1, new G.HurtByTarget(this)); t.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16)); }
  }
  class Silverfish extends SimpleMelee {
    constructor(t, x, y, z) { super('silverfish', x, y, z); }
    get arthropod() { return true; }
    onHurt() { // call others hiding in nearby infested blocks
      for (let k = 0; k < 20; k++) { const x = Math.floor(this.x) + rnd(21) - 10, y = Math.floor(this.y) + rnd(11) - 5, z = Math.floor(this.z) + rnd(21) - 10; const n = BLOCKS[World.getBlock(x, y, z)].name; if (n.startsWith('infested_')) { World.setBlock(x, y, z, 0, 0); Mobs.spawnEntity('silverfish', x + 0.5, y, z + 0.5); } }
    }
  }
  reg('silverfish', Silverfish);
  class Endermite extends SimpleMelee { constructor(t, x, y, z) { super('endermite', x, y, z); this.life = 0; } get arthropod() { return true; } aiStep() { super.aiStep(); if (++this.life >= 2400 && !this.persistent) this.removed = true; } }
  reg('endermite', Endermite);
  class Ghast extends Flyer {
    constructor(t, x, y, z) { super('ghast', x, y, z); this.hostile = true; this.charge = 0; this.flySpeed = 0.05; this.xpSpec = '5'; }
    get fireImmune() { return true; }
    registerGoals() { this.targets.add(1, new G.NearestAttackableTarget(this, TARGET_PLAYER, 64, false, 1)); }
    aiFly() {
      const t = this.target;
      if (!this.dest || rnd(80) === 0) this.dest = [this.x + (Math.random() * 2 - 1) * 16, this.y + (Math.random() * 2 - 1) * 16, this.z + (Math.random() * 2 - 1) * 16];
      if (t && this.distTo(t) < 64 && this.canSee(t)) {
        this.yaw = Math.atan2(-(t.x - this.x), -(t.z - this.z));
        if (++this.charge === 10) Sound.play('ghast_warn', this);
        if (this.charge === 20) { const dx = t.x - this.x, dy = t.y + t.h / 2 - (this.y + this.h / 2), dz = t.z - this.z; const f = Projectiles.fireball(this, this.x - Math.sin(this.yaw) * 4, this.y + this.h / 2 + 0.5, this.z - Math.cos(this.yaw) * 4, dx, dy, dz, true); void f; Sound.play('ghast_shoot', this); this.charge = -40; }
      } else if (this.charge > 0) this.charge--;
    }
    animState(s) { s.charging = this.charge > 10; }
    lootTable() { return 'entities/ghast'; }
  }
  reg('ghast', Ghast);
  class Blaze extends Flyer {
    constructor(t, x, y, z) { super('blaze', x, y, z); this.hostile = true; this.attackStep = 0; this.attackT = 0; this.flySpeed = 0.06; this.noGravity = false; this.xpSpec = '10'; }
    get fireImmune() { return true; }
    registerGoals() { this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 48)); }
    aiFly() {
      const t = this.target;
      this.noGravity = !!t || this.inLava;
      if (this.inWater || Weather.rainingAt(this.x, this.y, this.z)) this.hurt(1, 'drown');
      if (Math.random() < 0.03) Particles.smoke(this, 1);
      if (!t) { if (!this.onGround) this.vy *= 0.6; return; }
      this.dest = [t.x, t.y + 2, t.z];
      const d = this.distTo(t);
      if (d < 4 && --this.attackT <= 0) { this.attackT = 20; this.doHurtTarget(t); }
      else if (d < 48 && this.canSee(t) && --this.attackT <= 0) {
        this.attackStep++;
        if (this.attackStep === 1) this.attackT = 60; else if (this.attackStep <= 4) this.attackT = 6; else { this.attackT = 100; this.attackStep = 0; }
        if (this.attackStep > 1) { const dx = t.x - this.x, dy = t.y + t.h / 2 - (this.y + this.h / 2), dz = t.z - this.z, k = Math.sqrt(Math.sqrt(d)) * 0.5; Projectiles.fireball(this, this.x, this.y + this.h / 2 + 0.5, this.z, dx + (Math.random() - 0.5) * 2.3 * k, dy, dz + (Math.random() - 0.5) * 2.3 * k, false); Sound.play('blaze_shoot', this); }
      }
      if (d < 3) this.dest = null;
    }
    get glow() { return true; }
  }
  reg('blaze', Blaze);
  const GOLD_ARMOR = s => s && /^golden_/.test(ITEMS[s.id].name) && ITEMS[s.id].armor;
  class Piglin extends Monster {
    constructor(t, x, y, z) { super(t || 'piglin', x, y, z); this.equip.main = this.type === 'piglin_brute' ? stack('golden_axe') : stack(Math.random() < 0.5 ? 'golden_sword' : 'crossbow'); this.admire = 0; this.admireItem = null; }
    registerGoals() { const g = this.goals, t = this.targets; g.add(0, new G.Float(this)); g.add(2, new G.MeleeAttack(this, 1, false)); g.add(7, new G.RandomStroll(this, 0.8)); g.add(8, new G.LookAtPlayer(this, 8)); t.add(1, new G.HurtByTarget(this, true)); t.add(2, new G.NearestAttackableTarget(this, e => e.isPlayer && (this.type === 'piglin_brute' || ![0, 1, 2, 3].some(i => GOLD_ARMOR(e.inv.armor(i)))), 16)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'wither_skeleton', 16)); }
    aiStep() {
      super.aiStep();
      if (World.dim !== 'nether' && ++this.zombify > 300) { const z = Mobs.spawnEntity('zombified_piglin', this.x, this.y, this.z); if (z) { z.equip.main = this.equip.main; z.addEffect('nausea', 200, 0); } this.removed = true; }
      // admiring gold: bartering
      if (this.admire > 0 && --this.admire === 0) { if (this.admireItem && ITEMS[this.admireItem.id].name === 'gold_ingot') for (const s of LootTables.roll('gameplay/piglin_bartering', { entity: this })) Drops.spawnItem(this.x - Math.sin(this.yaw), this.y + 1, this.z - Math.cos(this.yaw), s); else if (this.admireItem) Drops.spawnItem(this.x, this.y + 1, this.z, this.admireItem); this.admireItem = null; this.equip.off = null; }
      if (!this.admire && this.type === 'piglin') for (const e of Entities.list) if (e.type === 'item' && !e.removed && e.pickupDelay <= 0 && e.dist2(this.x, this.y, this.z) < 3 && ['gold_ingot', 'golden_apple', 'gold_block', 'gold_nugget', 'golden_carrot', 'raw_gold', 'golden_sword', 'golden_helmet', 'bell', 'clock'].includes(ITEMS[e.stack.id].name)) { this.admireItem = Object.assign({}, e.stack, { count: 1 }); e.stack.count--; if (!e.stack.count) e.removed = true; this.equip.off = this.admireItem; this.admire = 120; this.target = null; this.nav.stop(); break; }
      if (this.admire) { this.nav.stop(); this.target = null; }
    }
    onInteract(p, s) { if (s && ITEMS[s.id].name === 'gold_ingot' && this.type === 'piglin' && !this.admire && !this.target) { this.admireItem = Object.assign({}, s, { count: 1 }); this.equip.off = this.admireItem; this.admire = 120; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; } return false; }
    animState(s) { s.holdRight = !!this.equip.main; s.admiring = this.admire > 0; s.aggressive = this.aggressive; }
  }
  reg('piglin', Piglin); reg('piglin_brute', class extends Piglin { constructor(t, x, y, z) { super('piglin_brute', x, y, z); this.persistent = true; } });
  class ZombifiedPiglin extends Monster {
    constructor(t, x, y, z) { super('zombified_piglin', x, y, z); this.equip.main = stack('golden_sword'); this.anger = 0; }
    get undead() { return true; }
    get fireImmune() { return true; }
    registerGoals() { const g = this.goals, t = this.targets; g.add(2, new G.MeleeAttack(this, 1, false)); g.add(7, new G.RandomStroll(this, 1)); g.add(8, new G.LookAtPlayer(this, 8)); t.add(1, new G.HurtByTarget(this, true)); }
    onHurt(n, s, a) { if (a && (a.isPlayer || a.owner)) for (const o of Entities.list) if (o.type === 'zombified_piglin' && !o.dead && o.distTo(this) < 20) { o.target = a.owner || a; o.lastHurtBy = a.owner || a; o.lastHurtTime = o.age; } }
    animState(s) { s.aggressive = !!this.target; s.holdRight = true; }
  }
  reg('zombified_piglin', ZombifiedPiglin);
  class Hoglin extends Animal {
    constructor(t, x, y, z) { super(t || 'hoglin', x, y, z); this.hostile = true; this.attackT = 0; this.kbResist = 0.6; this.attackKnockback = 1; }
    get food() { return this.type === 'hoglin' ? ['crimson_fungus'] : []; }
    registerGoals() { const g = this.goals, t = this.targets; g.add(0, new G.Float(this)); g.add(1, new G.AvoidEntity(this, () => false, 1, 1, 1)); g.add(2, new G.MeleeAttack(this, 1, true)); g.add(3, new G.Breed(this, 1)); g.add(5, new G.RandomStroll(this, 0.6)); g.add(6, new G.LookAtPlayer(this, 8)); t.add(1, new G.HurtByTarget(this, true)); t.add(2, new G.NearestAttackableTarget(this, e => e.isPlayer || (this.type === 'zoglin' && e.living && e.type !== 'zoglin' && e.type !== 'creeper'), 16)); }
    aiStep() {
      if (this.attackT > 0) this.attackT--;
      // warped fungus, portals and respawn anchors scare hoglins
      if (this.type === 'hoglin' && this.age % 20 === 0) { for (let k = 0; k < 20; k++) { const x = Math.floor(this.x) + rnd(15) - 7, y = Math.floor(this.y) + rnd(7) - 3, z = Math.floor(this.z) + rnd(15) - 7; const n = BLOCKS[World.getBlock(x, y, z)].name; if (n === 'warped_fungus' || n === 'nether_portal' || n === 'respawn_anchor') { this.target = null; const t = randomPos(this, 10, 4, null, [x, y, z]); if (t) this.nav.moveTo(t[0], t[1], t[2], 1.2); break; } } }
      if (this.type === 'hoglin' && World.dim !== 'nether' && ++this.zombify > 300) { const z = Mobs.spawnEntity('zoglin', this.x, this.y, this.z); if (z && this.baby) z.setBaby(); this.removed = true; }
    }
    doHurtTarget(t) { this.attackT = 10; const d = this.baby ? 0.5 : 3 + rnd(6); const ok = t.hurt(d, 'mob', this); if (ok && !this.baby) { t.vy += 0.4 * (1 - (t.kbResist || 0)); t.knockback && t.knockback(1, this.x - t.x, this.z - t.z); } return ok; }
    animState(s, a) { s.attack = this.attackT > 0 ? (10 - this.attackT + a) / 10 : 0; }
  }
  reg('hoglin', Hoglin); reg('zoglin', class extends Hoglin { constructor(t, x, y, z) { super('zoglin', x, y, z); } get undead() { return true; } });
  class Illager extends Monster {
    constructor(t, x, y, z) { super(t, x, y, z); }
    registerGoals() { const g = this.goals, t = this.targets; g.add(0, new G.Float(this)); this.attackGoal(g); g.add(8, new G.RandomStroll(this, 0.6)); g.add(9, new G.LookAtPlayer(this, 15)); g.add(10, new G.RandomLookAround(this)); t.add(1, new G.HurtByTarget(this, true)); t.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16)); t.add(3, new G.NearestAttackableTarget(this, e => e.type === 'villager' || e.type === 'wandering_trader' || e.type === 'iron_golem', 16)); }
    attackGoal(g) { g.add(4, new G.MeleeAttack(this, 1, false)); }
    animState(s) { s.aggressive = this.aggressive; }
  }
  class Pillager extends Illager {
    constructor(t, x, y, z) { super('pillager', x, y, z); this.equip.main = stack('crossbow'); this.usingBow = false; this.bowTicks = 0; }
    attackGoal(g) { g.add(3, new G.RangedBow(this, 1, 40, 8)); }
    holdingBow() { return true; }
    startUsingBow() { this.usingBow = true; this.bowTicks = 0; }
    stopUsing() { this.usingBow = false; }
    aiStep() { super.aiStep(); if (this.usingBow) this.bowTicks++; }
    shootAt(t) { const a = Projectiles.spawnArrow(this, this.x, this.eyeY - 0.1, this.z, { pickup: 0 }); if (!a) return; a.dmg = 2; const dx = t.x - this.x, dz = t.z - this.z, dy = t.y + t.h / 3 - a.y; Projectiles.shoot(a, dx, dy + Math.hypot(dx, dz) * 0.2, dz, 1.6, 14 - (Game.difficulty === 'hard' ? 2 : 1) * 4); Sound.play('crossbow_shoot', this); }
    animState(s) { s.aggressive = this.aggressive; s.crossbow = this.aggressive; }
  }
  reg('pillager', Pillager);
  class Vindicator extends Illager { constructor(t, x, y, z) { super('vindicator', x, y, z); this.equip.main = stack('iron_axe'); } animState(s) { s.aggressive = this.aggressive; s.swing = this.swinging ? this.swingTime / 6 : 0; } }
  reg('vindicator', Vindicator);
  class Evoker extends Illager {
    constructor(t, x, y, z) { super('evoker', x, y, z); this.spell = 0; this.cool = 60; }
    attackGoal() {}
    aiStep() {
      super.aiStep();
      const t = this.target; if (this.spell > 0) { this.spell--; this.nav.stop(); if (t) this.lookAt(t.x, t.eyeY, t.z); return; }
      if (!t || t.dead) return;
      if (this.distTo(t) < 6) { const r = randomPos(this, 8, 3, null, [t.x, t.y, t.z]); if (r && this.nav.done()) this.nav.moveTo(r[0], r[1], r[2], 0.8); }
      if (--this.cool > 0 || !this.canSee(t)) return;
      const vexes = Entities.list.filter(e => e.type === 'vex' && e.owner === this && !e.dead).length;
      if (vexes < 8 && rnd(3) === 0) { for (let i = 0; i < 3; i++) { const v = Mobs.spawnEntity('vex', this.x + rnd(5) - 2, this.y + 1, this.z + rnd(5) - 2); if (v) { v.owner = this; v.target = t; } } this.spell = 20; this.cool = 340; Sound.play('evoker_cast', this); }
      else { this.castFangs(t); this.spell = 20; this.cool = 100; }
    }
    castFangs(t) {
      const dist = this.distTo(t), ang = Math.atan2(t.z - this.z, t.x - this.x);
      if (dist < 3) { for (let i = 0; i < 5; i++) { const a = ang + i * Math.PI * 0.4; this.fang(this.x + Math.cos(a) * 1.5, this.z + Math.sin(a) * 1.5, 0); } for (let i = 0; i < 8; i++) { const a = ang + i * Math.PI * 2 / 8 + 1.2566371; this.fang(this.x + Math.cos(a) * 2.5, this.z + Math.sin(a) * 2.5, 3); } }
      else for (let i = 0; i < 16; i++) { const d = 1.25 * (i + 1); this.fang(this.x + Math.cos(ang) * d, this.z + Math.sin(ang) * d, i); }
      Sound.play('evoker_cast', this);
    }
    fang(x, z, delay) { let y = Math.floor(this.y) + 1; for (let k = 0; k < 6 && !SOLID[World.getBlock(Math.floor(x), y - 1, Math.floor(z))]; k++) y--; Entities.add(new EvokerFang(x, y, z, delay, this)); }
    animState(s) { s.spell = this.spell > 0; s.aggressive = !!this.target; }
  }
  class EvokerFang extends Entity {
    constructor(x, y, z, delay, owner) { super('evoker_fangs', x, y, z); this.warm = delay; this.owner = owner; this.life = 22; this.w = 0.5; this.h = 0.8; this.noPick = true; this.blockId = undefined; }
    tick() { this.age++; if (--this.warm < 0) { if (this.warm === -8) for (const e of Entities.list.concat([Game.player])) if (e && e !== this.owner && e.hurt && !e.dead && e.living !== false && Math.abs(e.x - this.x) < 0.8 && Math.abs(e.z - this.z) < 0.8 && Math.abs(e.y - this.y) < 1) e.hurt(6, 'magic', this.owner); if (this.warm === -1) Sound.play('evoker_fangs', this); if (--this.life < 0) this.removed = true; } }
    save() { return null; }
  }
  reg('evoker', Evoker);
  class Vex extends Flyer {
    constructor(t, x, y, z) { super('vex', x, y, z); this.hostile = true; this.noClipFly = true; this.life = 20 * (30 + rnd(90)); this.flySpeed = 0.15; this.attackDamage = 9; this.xpSpec = '0'; }
    registerGoals() { this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16, false)); }
    aiFly() { if (--this.life <= 0) { this.hurt(1, 'magic'); this.life = 20; } const t = this.target; if (t) { this.flyTo(t.x, t.y + t.h / 2, t.z, 1.5); if (this.distTo(t) < 1.2 && this.age % 10 === 0) { this.swingArm(); this.doHurtTarget(t); } } }
    animState(s) { s.aggressive = !!this.target; s.holdRight = true; }
    heldItem() { return stack('iron_sword'); }
  }
  reg('vex', Vex);
  class Ravager extends Monster {
    constructor(t, x, y, z) { super('ravager', x, y, z); this.kbResist = 0.75; this.roar = 0; this.attackKnockback = 1.5; this.stepHeight = 1; }
    registerGoals() { const g = this.goals, t = this.targets; g.add(0, new G.Float(this)); g.add(4, new G.MeleeAttack(this, 1, true)); g.add(5, new G.RandomStroll(this, 0.4)); g.add(6, new G.LookAtPlayer(this, 6)); t.add(2, new G.HurtByTarget(this)); t.add(3, new G.NearestAttackableTarget(this, e => e.isPlayer || e.type === 'villager' || e.type === 'iron_golem', 16)); }
    aiStep() { super.aiStep(); if (this.roar > 0) this.roar--; if (Game.rules.mobGriefing && this.hitH) { for (let dy = 0; dy < 3; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const x = Math.floor(this.x + dx - Math.sin(this.yaw)), y = Math.floor(this.y) + dy, z = Math.floor(this.z + dz - Math.cos(this.yaw)); const n = BLOCKS[World.getBlock(x, y, z)].name; if (n.endsWith('_leaves') || BLOCKS[World.getBlock(x, y, z)].model === 'cross' || n.endsWith('crop')) { Drops.dropBlock(World.getBlock(x, y, z), World.getState(x, y, z), null, x, y, z); Blocks.remove(x, y, z, null, true); } } } }
    animState(s) { s.roar = this.roar / 20; }
  }
  reg('ravager', Ravager);
  // guardians: a beam that charges for 80 ticks then hurts
  class Guardian extends Mob {
    constructor(t, x, y, z) { super(t || 'guardian', x, y, z); this.swims = true; this.hostile = true; this.beam = 0; this.waterMalus = 0; this.xpSpec = '10'; }
    registerGoals() { this.targets.add(1, new G.NearestAttackableTarget(this, e => (e.isPlayer || e.type === 'squid' || e.type === 'glow_squid' || e.type === 'axolotl') && e.inWater !== false, 16, true, 1)); }
    aiStep() {
      const t = this.target;
      if (!this.inWater) { if (this.onGround && rnd(10) === 0) { this.vy = 0.5; this.yaw = Math.random() * Math.PI * 2; } return; }
      if (t && this.canSee(t) && this.distTo(t) < 16) {
        this.lookAt(t.x, t.eyeY, t.z, 90, 90); this.yaw = Math.atan2(-(t.x - this.x), -(t.z - this.z)); this.lookYaw = this.yaw;
        if (++this.beam === 1) Sound.play('guardian_attack', this);
        const max = this.type === 'elder_guardian' ? 60 : 80;
        if (this.beam >= max) { t.hurt(Game.difficulty === 'hard' ? 2 : 1, 'magic', this); t.hurt(this.type === 'elder_guardian' ? 8 : 6, 'mob', this); this.target = null; this.beam = 0; }
      } else { this.beam = 0; if (!this.dir || rnd(60) === 0) { const a = Math.random() * Math.PI * 2; this.dir = [Math.cos(a) * 0.05, (Math.random() - 0.5) * 0.03, Math.sin(a) * 0.05]; } this.vx += (this.dir[0] - this.vx) * 0.1; this.vy += (this.dir[1] - this.vy) * 0.1; this.vz += (this.dir[2] - this.vz) * 0.1; if (Math.hypot(this.vx, this.vz) > 0.01) { this.yaw = turnToward(this.yaw, Math.atan2(-this.vx, -this.vz), 0.2); this.lookYaw = this.yaw; } }
      if (this.type === 'elder_guardian' && this.age % 1200 === 0) { const p = Game.player; if (p && this.distTo(p) < 50 && !p.creative) { p.addEffect('mining_fatigue', 6000, 2); Sound.play('elder_guardian_curse', p); } }
    }
    travel() { if (this.inWater) { Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9; } else super.travel(); }
    onHurt(n, s, a) { if (a && s === 'player' && a.hurt && !a.dead && this.beam === 0) a.hurt(2, 'thorns', this); }
    animState(s) { s.spikes = this.beam > 0 ? 1 : 0; }
  }
  reg('guardian', Guardian); reg('elder_guardian', class extends Guardian { constructor(t, x, y, z) { super('elder_guardian', x, y, z); this.persistent = true; } });
  class Shulker extends Mob {
    constructor(t, x, y, z) { super('shulker', x, y, z); this.hostile = true; this.peek = 0; this.cool = 20; this.kbResist = 1; this.persistent = true; this.xpSpec = '5'; }
    registerGoals() { this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 16)); }
    travel() { this.vx = this.vz = 0; this.vy = 0; }
    aiStep() {
      const t = this.target; const want = t ? 1 : rnd(40) === 0 ? 0.3 : 0; this.peek += (want - this.peek) * 0.1;
      if (t && this.canSee(t) && --this.cool <= 0) { this.cool = 20 + rnd(10) * 2; Projectiles.shulkerBullet && Projectiles.shulkerBullet(this, t); Sound.play('shulker_shoot', this); }
    }
    hurt(n, s, a) { if (this.peek < 0.3 && (s === 'arrow' || s === 'projectile')) return false; if (this.peek < 0.3) n *= 0.2; return super.hurt(n, s, a); }
    get armorPts() { return this.peek < 0.3 ? 20 : 0; } set armorPts(v) {}
    animState(s) { s.peek = this.peek; }
  }
  reg('shulker', Shulker);
  class Phantom extends Flyer {
    constructor(t, x, y, z) { super('phantom', x, y, z); this.hostile = true; this.swoop = 0; this.flySpeed = 0.15; this.size = 0; }
    get undead() { return true; }
    registerGoals() { this.targets.add(1, new G.NearestAttackableTarget(this, TARGET_PLAYER, 64, false, 1)); }
    aiFly() {
      this.burnsInDay();
      const t = this.target;
      if (!t) { const a = this.age * 0.02; this.dest = [this.x + Math.cos(a) * 8, this.y + Math.sin(a * 0.5), this.z + Math.sin(a) * 8]; return; }
      if (this.swoop > 0) { this.swoop--; this.flyTo(t.x, t.y + t.h / 2, t.z, 1.6); if (this.distTo(t) < 1.5) { this.doHurtTarget(t); this.swoop = 0; this.cool = 60; } }
      else { const a = this.age * 0.05; this.dest = [t.x + Math.cos(a) * 12, t.y + 16 + Math.sin(a) * 2, t.z + Math.sin(a) * 12]; if (--this.cool <= 0 && rnd(40) === 0) { this.swoop = 60; Sound.play('phantom_swoop', this); } }
    }
  }
  reg('phantom', Phantom);
  class Warden extends Monster {
    constructor(t, x, y, z) { super('warden', x, y, z); this.kbResist = 1; this.anger = 0; this.persistent = true; this.dig = 0; }
    registerGoals() { const g = this.goals; g.add(2, new G.MeleeAttack(this, 1.2, true)); g.add(7, new G.RandomStroll(this, 0.5)); this.targets.add(1, new G.HurtByTarget(this)); }
    aiStep() {
      // wardens are blind: they notice moving players nearby (vibrations) and anger builds up
      const p = Game.player;
      if (p && !p.creative && !p.spectator && this.distTo(p) < 16 && !p.sneaking && Math.hypot(p.x - p.px, p.z - p.pz) > 0.01) { this.anger += 3; if (this.anger > 80) this.target = p; }
      if (this.anger > 0 && this.age % 20 === 0) this.anger--;
      if (++this.dig > 1200 && !this.target) { this.removed = true; Particles.blockBreak(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z), BID.sculk || 1, 0); }
      if (p && this.age % 40 === 0 && this.distTo(p) < 20) p.addEffect('darkness', 260, 0);
    }
  }
  reg('warden', Warden);
  class Breeze extends Mob {
    constructor(t, x, y, z) { super('breeze', x, y, z); this.hostile = true; this.cool = 40; this.xpSpec = '10'; }
    registerGoals() { const g = this.goals; g.add(7, new G.RandomStroll(this, 0.6)); this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, TARGET_PLAYER, 24)); }
    get noFallDamage() { return true; }
    invulnerableTo(s) { return s === 'arrow' || s === 'projectile' || s === 'trident'; }
    aiStep() { const t = this.target; if (!t) return; this.lookAt(t.x, t.eyeY, t.z, 30, 30); if (this.onGround && rnd(40) === 0) { this.vy = 0.8; const dx = t.x - this.x, dz = t.z - this.z, l = Math.hypot(dx, dz) || 1; this.vx = -dz / l * 0.3; this.vz = dx / l * 0.3; Sound.play('wind_burst', this); } if (--this.cool <= 0 && this.canSee(t)) { this.cool = 40 + rnd(20); const w = Projectiles.spawn('wind_charge', this, this.x, this.eyeY, this.z); if (w) Projectiles.shoot(w, t.x - this.x, t.eyeY - this.eyeY, t.z - this.z, 0.7, 5); Sound.play('wind_charge_throw', this); } }
  }
  reg('breeze', Breeze);
  class Tadpole extends Mob { constructor(t, x, y, z) { super('tadpole', x, y, z); this.swims = true; this.growT = 24000; } aiStep() { WaterMobStep(this); if (--this.growT <= 0) { const f = Mobs.spawnEntity('frog', this.x, this.y, this.z); if (f) { const b = BIOMES[World.biomeAt(Math.floor(this.x), Math.floor(this.z))]; f.variant = b.temp > 1 ? 'warm' : b.temp < 0.3 ? 'cold' : 'temperate'; } this.removed = true; } } travel() { if (this.inWater) { Phys.move(this, this.vx, this.vy, this.vz); this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9; } else super.travel(); } }
  function WaterMobStep(m) { if (!m.inWater) return; if (!m.dir || rnd(40) === 0) { const a = Math.random() * Math.PI * 2; m.dir = [Math.cos(a) * 0.04, (Math.random() - 0.5) * 0.02, Math.sin(a) * 0.04]; } m.vx += (m.dir[0] - m.vx) * 0.1; m.vy += (m.dir[1] - m.vy) * 0.1; m.vz += (m.dir[2] - m.vz) * 0.1; if (Math.hypot(m.vx, m.vz) > 0.005) { m.yaw = turnToward(m.yaw, Math.atan2(-m.vx, -m.vz), 0.2); m.lookYaw = m.yaw; } }
  reg('tadpole', Tadpole);
  // ---------------------------------------------------------------- fireballs and shulker bullets
  class Fireball extends Projectile {
    constructor(owner, x, y, z, big) { super(big ? 'fireball' : 'small_fireball', owner, x, y, z); this.big = big; this.noGravity = true; this.drag = 0.95; this.w = this.h = big ? 1 : 0.3125; this.item = IID.fire_charge; this.accel = [0, 0, 0]; this.life2 = 0; this.noPick = !big; }
    tick() { this.vx += this.accel[0]; this.vy += this.accel[1]; this.vz += this.accel[2]; super.tick(); Particles.smoke({ x: this.x, y: this.y + this.h / 2, z: this.z, w: 0, h: 0 }, 1); if (++this.life2 > 400) this.removed = true; }
    onEntity(e) {
      if (e === this.owner) return false;
      if (this.big) { e.hurt(6, 'fireball', this.owner || this); this.explode(); }
      else { if (!e.fireImmune && e.hurt(5, 'fireball', this.owner || this)) e.fireTicks = Math.max(e.fireTicks || 0, 100); this.removed = true; }
    }
    onBlock(hit) { if (this.big) this.explode(); else { this.removed = true; const x = hit.x + DX[hit.face], y = hit.y + DY[hit.face], z = hit.z + DZ[hit.face]; if (Game.rules.mobGriefing && World.getBlock(x, y, z) === 0) World.setBlock(x, y, z, BID.fire, 0); } }
    explode() { this.removed = true; Explosions.explode(this.x, this.y, this.z, 1, Game.rules.mobGriefing, this, Game.rules.mobGriefing); }
    // a player can bat a ghast's fireball back
    hurt(n, s, a) { if (a && a.isPlayer && this.big) { const lv = a.lookVec(); this.accel = [lv[0] * 0.1, lv[1] * 0.1, lv[2] * 0.1]; this.vx = lv[0]; this.vy = lv[1]; this.vz = lv[2]; this.owner = a; Advancements.check && Advancements.check('return_to_sender'); return true; } return false; }
    get living() { return false; }
  }
  Projectiles.fireball = (owner, x, y, z, dx, dy, dz, big) => { const f = new Fireball(owner, x, y, z, big); const l = Math.hypot(dx, dy, dz) || 1; f.accel = [dx / l * 0.1, dy / l * 0.1, dz / l * 0.1]; f.vx = f.accel[0]; f.vy = f.accel[1]; f.vz = f.accel[2]; return Entities.add(f); };
  class ShulkerBullet extends Projectile {
    constructor(owner, x, y, z, target) { super('shulker_bullet', owner, x, y, z); this.target = target; this.noGravity = true; this.drag = 1; this.w = this.h = 0.3125; this.item = IID.shulker_shell; this.steps = 0; }
    tick() { const t = this.target; if (t && !t.dead) { const dx = t.x - this.x, dy = t.y + t.h / 2 - this.y, dz = t.z - this.z, l = Math.hypot(dx, dy, dz) || 1; this.vx += (dx / l * 0.15 - this.vx) * 0.2; this.vy += (dy / l * 0.15 - this.vy) * 0.2; this.vz += (dz / l * 0.15 - this.vz) * 0.2; } super.tick(); if (++this.steps > 300) this.removed = true; }
    onEntity(e) { if (e === this.owner) return false; if (e.hurt(4, 'mob', this.owner || this) && e.addEffect) e.addEffect('levitation', 200, 0); this.removed = true; }
    hurt() { this.removed = true; Particles.poof({ x: this.x, y: this.y, z: this.z, w: 0.3, h: 0.3 }); return true; }
  }
  Projectiles.shulkerBullet = (owner, t) => Entities.add(new ShulkerBullet(owner, owner.x, owner.y + 0.5, owner.z, t));
})();
