'use strict';
/* The player: movement input, flying, sprinting and sneaking, the camera (first person, behind, in front),
   health, hunger (exhaustion and saturation with the game's costs), air, experience, armour and death. */
class Player extends Living {
  constructor(x, y, z) {
    super('player', x, y, z);
    this.isPlayer = true; this.w = 0.6; this.h = 1.8; this.speed = 0.1; this.flySpeed = 0.05;
    this.inv = new PlayerInventory();
    this.gamemode = 'survival'; this.flying = false; this.mayFly = false;
    this.food = 20; this.saturation = 5; this.exhaustion = 0; this.foodTick = 0;
    this.xpLevel = 0; this.xpProgress = 0; this.xpTotal = 0; this.score = 0;
    this.eyeH = 1.62; this.peyeH = 1.62; this.bob = 0; this.pbob = 0; this.view = 0;
    this.spawn = null; this.sleeping = null; this.sleepTimer = 0;
    this.lastTapW = 0; this.lastTapSpace = 0; this.sprintTap = false; this.useTicks = 0; this.using = null;
    this.attackCooldown = 0; this.enderChest = new Inventory(27); this.portalTicks = 0; this.inPortal = null;
    this.fovMod = 1; this.pfovMod = 1; this.hurtDir = 0; this.deathCause = '';
  }
  get eyeY() { return this.y + this.eyeH; }
  heldItem() { return this.inv.held; }
  animState(s) { s.holdRight = !!this.inv.held; s.holdLeft = !!this.inv.offhand; const u = this.using && ITEMS[this.using.id].name; if (u === 'bow') s.bow = true; if (u === 'shield') s.blocking = true; if (u === 'spyglass') s.spyglass = true; if (u === 'brush') s.brushing = true; if (this.using && ITEMS[this.using.id].food) s.eating = true; }
  get creative() { return this.gamemode === 'creative'; }
  get spectator() { return this.gamemode === 'spectator'; }
  get noFallDamage() { return this.creative || this.spectator || this.flying; }
  setGamemode(m) {
    this.gamemode = m;
    this.mayFly = m === 'creative' || m === 'spectator';
    if (!this.mayFly) this.flying = false;
    if (m === 'spectator') { this.flying = true; this.noClip = true; } else this.noClip = false;
    HUD.refresh();
  }
  // ---------------------------------------------------------------- input
  readInput() {
    const ui = UI.screenOpen() || !Input.locked;
    const k = a => !ui && Input.isDown(a);
    this.forward = (k('forward') ? 1 : 0) - (k('back') ? 1 : 0);
    this.strafe = (k('left') ? 1 : 0) - (k('right') ? 1 : 0);
    const now = this.age;
    if (!ui && Input.wasPressed('forward')) { if (now - this.lastTapW < 7) this.sprintTap = true; this.lastTapW = now; }
    if (!k('forward')) this.sprintTap = false;
    this.sneaking = k('sneak') && !this.flying;
    this.sneakEdge = this.sneaking && !this.spectator;
    this.jumping = k('jump');
    if (!ui && Input.wasPressed('jump') && this.mayFly) { if (now - this.lastTapSpace < 7) { this.flying = !this.flying || this.spectator; this.lastTapSpace = -100; } else this.lastTapSpace = now; }
    // jumping again in mid-air with a working elytra on starts gliding
    if (!ui && Input.wasPressed('jump') && !this.onGround && !this.gliding && !this.flying && !this.inWater && !this.vehicle && !this.effect('levitation') && !this.onClimbable() && this.canGlide()) { this.gliding = true; this.glideTicks = 0; }
    if (this.sleeping || this.dead) { this.forward = this.strafe = 0; this.jumping = false; }
    // crouching (and crawling) walk at 30%
    if (this.sneaking || this.pose === 'crouch' || (this.pose === 'swim' && !this.inWater)) { this.forward *= 0.3; this.strafe *= 0.3; }
    if (this.using) { this.forward *= 0.2; this.strafe *= 0.2; }
    // sprint: Ctrl or double-tap forward; not when hungry, sneaking, using an item, or walking into a wall
    const canSprint = (this.food > 6 || this.mayFly) && !this.sneaking && !this.using && !this.effect('blindness') && (!this.inWater || this.eyesInWater || this.swimming);
    if (canSprint && this.forward > 0.8 && (k('sprint') || this.sprintTap)) this.sprinting = true;
    if (this.sprinting && (this.swimming ? !this.inWater : (this.forward <= 0.8 || !canSprint || (this.hitH && !this.flying) || (this.inWater && !this.eyesInWater && !this.flying)))) this.sprinting = false;
    if (this.flying) {
      this.vy += ((k('jump') ? 1 : 0) - (k('sneak') ? 1 : 0)) * this.flySpeed * 3;
      this.jumping = false;
      if (this.onGround && !this.spectator) this.flying = false;
    }
  }
  tick() {
    this.readInput();
    this.tickBase();
    if (this.spectator) { this.inWater = this.inLava = false; this.fireTicks = 0; }
    this.tickLiving();
    if (this.dead) { if (this.deathTime === 20) UI.showDeath(); return; }
    this.updateGlide(); this.updateSwimming(); this.updatePose();
    this.peyeH = this.eyeH;
    this.eyeH += ({ stand: 1.62, crouch: 1.27, swim: 0.4, glide: 0.4, sleep: 0.2 }[this.pose] - this.eyeH) * 0.5;
    // view bobbing follows the walking speed
    this.pbob = this.bob;
    const hs = Math.min(0.1, Math.hypot(this.x - this.px, this.z - this.pz));
    this.bob += ((this.onGround && !this.dead ? hs : 0) - this.bob) * 0.4;
    // field of view: faster movement widens it
    this.pfovMod = this.fovMod;
    let f = 1; if (this.flying) f *= 1.1; f *= (this.speedAttr / 0.1 + 1) / 2; if (this.using && ITEMS[this.using.id].name === 'bow') { const t = Math.min(1, this.useTicks / 20); f *= 1 - t * t * 0.15; }
    if (this.using && ITEMS[this.using.id].name === 'spyglass') f = 0.1;
    this.fovMod += (f - this.fovMod) * 0.5;
    this.tickSurvival();
    if (this.attackCooldown < 1000) this.attackCooldown++;
    if (this.xpCooldown > 0) this.xpCooldown--;
    if (!this.spectator) this.pickUp();
    Hand && Hand.tick(this);
    Beds.tick(this); Beds.phantoms(this); if (!this.spectator) Stats.tick(this);
    if (this.sleeping && Input.wasPressed('sneak')) Beds.wake(this);
    // walking: exhaustion and step sounds
    const moved = Math.hypot(this.x - this.px, this.z - this.pz);
    // (a step is a game event even when sneaking quietly: sculk sensors just don't notice it then)
    if (this.onGround && moved > 0.001 && !this.flying) { this.stepAcc = (this.stepAcc || 0) + moved; if (this.stepAcc > 1.6) { this.stepAcc = 0; if (!this.sneaking) Sound.step(this); GameEvents.emit('step', this.x, this.y, this.z, this, World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z))); } }
    else if (this.inWater && moved > 0.001 && !this.flying) { this.stepAcc = (this.stepAcc || 0) + moved; if (this.stepAcc > 1.6) { this.stepAcc = 0; GameEvents.emit('swim', this.x, this.y, this.z, this); } }
    // standing on a sculk sensor or shrieker sets it off
    if (this.onGround && !this.spectator) { const bx = Math.floor(this.x), by = Math.floor(this.y - 0.2), bz = Math.floor(this.z), b = World.getBlock(bx, by, bz); if (GameEvents.KIND.has(b) && b !== BID.sculk_catalyst) GameEvents.stepOn(this, bx, by, bz, b); }
    if (this.sprinting && this.onGround) this.exhaust(0.1 * moved);
    if (this.inWater && moved > 0) this.exhaust(0.01 * moved);
  }
  // ---------------------------------------------------------------- poses: standing, crouching, swimming (and crawling), gliding
  canGlide() { const c = this.inv.armor(1); return !!c && ITEMS[c.id].name === 'elytra' && (c.dmg || 0) < ITEMS[c.id].dur - 1; }
  // the elytra wears by one a second; every half second the glide is a game event
  updateGlide() {
    if (!this.gliding) { this.glideTicks = 0; return; }
    if (this.onGround || this.vehicle || this.flying || this.inWater || this.effect('levitation') || !this.canGlide() || this.dead) { this.gliding = false; this.glideTicks = 0; return; }
    const t = ++this.glideTicks;
    if (t % 10 === 0) {
      if ((t / 10) % 2 === 0 && !this.creative) { const c = this.inv.armor(1); damageItem(c, 1, this, () => {}); if ((c.dmg || 0) > ITEMS[c.id].dur - 1) c.dmg = ITEMS[c.id].dur - 1; this.inv.changed(); }
      GameEvents.emit('elytra_glide', this.x, this.y, this.z, this);
    }
  }
  // sprinting under water starts swimming; it lasts while sprinting in water
  updateSwimming() {
    const fx = Math.floor(this.x), fy = Math.floor(this.y), fz = Math.floor(this.z), d = BLOCKS[World.getBlock(fx, fy, fz)];
    const feetWater = d.fluid === 'water' || d.fluidLog || (d.waterlog && (World.getState(fx, fy, fz) & 128));
    if (this.flying || this.spectator) this.swimming = false;
    else if (this.swimming) this.swimming = this.sprinting && this.inWater && !this.vehicle;
    else this.swimming = this.sprinting && this.eyesInWater && !this.vehicle && !!feetWater;
    this.pswimAmount = this.swimAmount || 0;
    this.swimAmount = this.swimming || (this.pose === 'swim' && !this.inWater) ? Math.min(1, this.pswimAmount + 0.09) : Math.max(0, this.pswimAmount - 0.09);
  }
  // the pose wanted, or whatever fits: crouching under a 1.5 block gap, crawling under a 1 block one
  updatePose() {
    const H = { stand: 1.8, crouch: 1.5, swim: 0.6, glide: 0.6, sleep: 0.2 };
    const fits = h => Phys.boxFree(this.x - 0.3, this.y, this.z - 0.3, this.x + 0.3, this.y + h, this.z + 0.3);
    if (this.sleeping) { this.pose = 'sleep'; return; }
    if (!fits(0.6)) return;
    let pose = this.gliding ? 'glide' : this.sleeping ? 'sleep' : this.swimming ? 'swim' : this.sneaking && !this.flying ? 'crouch' : 'stand';
    if (!(this.spectator || this.vehicle || this.sleeping || fits(H[pose]))) pose = fits(1.5) ? 'crouch' : 'swim';
    this.pose = pose; this.h = H[pose];
  }
  // how the body lies: tipped toward the flight path while gliding, flat while swimming or crawling
  tilt(a) {
    const pd = (this.ppitch + (this.pitch - this.ppitch) * a) * 180 / Math.PI;
    if (this.gliding) {
      const t = this.glideTicks + a, k = Math.min(1, t * t / 100);
      let roll = 0; const vx = this.vx, vz = this.vz, lv = this.lookVec(), dv = vx * vx + vz * vz, dl = lv[0] * lv[0] + lv[2] * lv[2];
      if (dv > 0 && dl > 0) { const l = Math.max(-1, Math.min(1, (vx * lv[0] + vz * lv[2]) / Math.sqrt(dv * dl))), m = vx * lv[2] - vz * lv[0]; roll = Math.sign(m) * Math.acos(l); }
      return [k * (-90 - pd) * Math.PI / 180, roll, 0, 0];
    }
    const s = this.pswimAmount + ((this.swimAmount || 0) - (this.pswimAmount || 0)) * a;
    if (s > 0) { const j = this.inWater ? -90 - pd : -90; return [s * j * Math.PI / 180, 0, this.swimming || this.pose === 'swim' ? 0.3 * s : 0, 0]; }
    return null;
  }
  // items within reach of the player's box (grown by 1 sideways and 0.5 up and down) are picked up
  pickUp() {
    for (const e of Entities.list) {
      if (e.type !== 'item' || e.removed || e.pickupDelay > 0) continue;
      if (Math.abs(e.x - this.x) > 1 + this.w / 2 + e.w / 2 || e.y + e.h < this.y - 0.5 || e.y > this.y + this.h + 0.5 || Math.abs(e.z - this.z) > 1 + this.w / 2 + e.w / 2) continue;
      const before = e.stack.count, left = this.inv.addItem(e.stack);
      const got = before - (left ? left.count : 0);
      if (got <= 0) continue;
      Stats.add('picked_up', ITEMS[e.stack.id].name, got);
      if (e.thrower && !e.thrower.isPlayer) Advancements.fire('thrown_item_picked_up_by_player', { entity: e.thrower, item: e.stack });
      Sound.play('pop', this, { pitch: ((Math.random() - Math.random()) * 0.7 + 1) * 2 });
      if (EntityRender && EntityRender.pickup) EntityRender.pickup(e, this);
      if (left) e.stack.count = left.count; else e.removed = true;
      HUD.refresh();
    }
  }
  onJump() { this.exhaust(this.sprinting ? 0.2 : 0.05); Stats.add('custom', 'jump'); }
  onLand(dist, block) { if (dist > 3) Sound.play('fall', this, { big: dist > 6, block }); }
  // ---------------------------------------------------------------- survival
  exhaust(x) { if (this.creative || this.spectator || Game.difficulty === 'peaceful') return; this.exhaustion = Math.min(40, this.exhaustion + x); }
  eat(n, sat) { this.food = Math.min(20, this.food + n); this.saturation = Math.min(this.food, this.saturation + n * sat * 2); }
  tickSurvival() {
    if (this.creative || this.spectator) { this.air = 300; return; }
    // hunger: exhaustion drains saturation first, then the food bar
    if (this.exhaustion > 4) { this.exhaustion -= 4; if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1); else if (Game.difficulty !== 'peaceful') this.food = Math.max(0, this.food - 1); }
    const regen = Game.rules.naturalRegeneration;
    if (Game.difficulty === 'peaceful') { if (this.age % 20 === 0) this.heal(1); if (this.age % 10 === 0 && this.food < 20) this.food++; }
    if (regen && this.saturation > 0 && this.food >= 20 && this.health < this.maxHealth) {
      // full food bar and saturation: fast healing (every half second)
      if (++this.foodTick >= 10) { const k = Math.min(this.saturation, 6); this.heal(k / 6); this.exhaust(k); this.foodTick = 0; }
    } else if (regen && this.food >= 18 && this.health < this.maxHealth) {
      if (++this.foodTick >= 80) { this.heal(1); this.exhaust(6); this.foodTick = 0; }
    } else if (this.food <= 0) {
      if (++this.foodTick >= 80) { const lim = Game.difficulty === 'hard' ? 0 : Game.difficulty === 'normal' ? 1 : 10; if (this.health > lim) this.hurt(1, 'starve'); this.foodTick = 0; }
    } else this.foodTick = 0;
    // air under water
    if (this.eyesInWater && !this.effect('water_breathing') && !this.effect('conduit_power')) {
      const resp = this.armorEnch('respiration');
      if (resp === 0 || Math.random() < 1 / (resp + 1)) this.air--;
      if (this.air <= -20) { this.air = 0; this.hurt(2, 'drown'); }
    } else if (this.air < 300) this.air = Math.min(300, this.air + 4);
    // suffocation inside blocks
    const ex = Math.floor(this.x), ey = Math.floor(this.eyeY), ez = Math.floor(this.z), eb = World.getBlock(ex, ey, ez);
    if (OPAQUE[eb] && SOLID[eb] && !this.noClip && this.age % 10 === 0) this.hurt(1, 'inWall');
    // standing on magma, in cactus, berry bushes, fire
    const under = World.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
    if (under === BID.magma_block && !this.sneaking && !this.fireImmune && !this.armorEnch('frost_walker')) this.hurt(1, 'hotFloor');
    if (Phys.touching(this, id => id === BID.cactus, 0.01)) this.hurt(1, 'cactus');
    if (Phys.touching(this, id => id === BID.sweet_berry_bush) && (Math.abs(this.x - this.px) > 0.003 || Math.abs(this.z - this.pz) > 0.003)) this.hurt(1, 'sweetBerryBush');
    if (Phys.touching(this, id => id === BID.fire || id === BID.soul_fire || (id === BID.campfire) || id === BID.soul_campfire)) { if (!this.effect('fire_resistance')) this.hurt(1, 'inFire'); this.fireTicks = Math.max(this.fireTicks, 160); }
    if (Phys.touching(this, id => id === BID.wither_rose)) this.addEffect('wither', 40, 0);
  }
  get fireImmune() { return !!this.effect('fire_resistance') || this.creative || this.spectator; }
  armorEnch(e) { let m = 0; for (let i = 0; i < 4; i++) m = Math.max(m, enchLevel(this.inv.armor(i), e)); return m; }
  armorEnchSum(e) { let m = 0; for (let i = 0; i < 4; i++) m += enchLevel(this.inv.armor(i), e); return m; }
  updateArmor() {
    let p = 0, t = 0, kb = 0;
    for (let i = 0; i < 4; i++) { const s = this.inv.armor(i); if (s && ITEMS[s.id].armor) { const a = ITEMS[s.id].armor; p += a.pts; t += a.tough; kb += a.kb; } }
    this.armorPts = p; this.toughness = t; this.kbResist = kb; this.depthStrider = this.armorEnch('depth_strider');
  }
  // damage: armour, toughness and Protection reduce it (the 1.9+ formulas)
  hurt(amount, source, attacker) {
    if (this.dead || amount <= 0) return false;
    if (this.creative && source !== 'outOfWorld' && source !== 'kill') return false;
    if (this.spectator && source !== 'kill') return false;
    if (Game.difficulty === 'peaceful' && attacker && attacker.hostile) return false;
    if ((source === 'inFire' || source === 'onFire' || source === 'lava' || source === 'hotFloor' || source === 'fireball') && this.effect('fire_resistance')) return false;
    // difficulty scales what mobs (and their arrows and fireballs) do, explosions and sonic booms (once, here)
    const dealer = attacker && !attacker.living && attacker.owner ? attacker.owner : attacker;
    if (source === 'explosion' || source === 'sonic_boom' || (dealer && dealer.living && !dealer.isPlayer)) amount = Game.scaleDamage(amount);
    if (this.sleeping) Beds.wake(this);
    // falling anvils, blocks and stalactites: a helmet takes a quarter off (and wears for it)
    if ((source === 'anvil' || source === 'fallingBlock' || source === 'fallingStalactite') && this.inv.armor(0)) { damageItem(this.inv.armor(0), Math.max(1, Math.floor(amount / 4)), this, () => { this.inv.set(36, null); Sound.play('break_item', this); }); this.inv.changed(); amount *= 0.75; }
    // shield blocks attacks from the front
    if (this.using && ITEMS[this.using.id].name === 'shield' && this.useTicks >= 5 && attacker && ['mob', 'arrow', 'explosion', 'fireball'].includes(sourceKind(source))) {
      const ax = attacker.x - this.x, az = attacker.z - this.z, lv = this.lookVec();
      if (ax * lv[0] + az * lv[2] > 0) { Advancements.fire('entity_hurt_player', Object.assign(Advancements.damageCtx(this, amount, source, attacker), { blocked: true, taken: 0 })); Sound.play('shield_block', this); damageItem(this.using, Math.floor(amount) + 1, this, () => { this.inv.held = null; this.using = null; }); if (attacker.type === 'vindicator' || attacker.type === 'warden' || (attacker.heldAxe)) { this.shieldCooldown = 100; this.using = null; } return false; }
    }
    if (this.invul > 10) { if (amount <= this.lastDamage) return false; const d = amount - this.lastDamage; this.lastDamage = amount; amount = d; }
    else { this.lastDamage = amount; this.invul = 20; this.hurtTime = 10; }
    const bypassArmor = ['fall', 'drown', 'starve', 'magic', 'wither', 'outOfWorld', 'inWall', 'kill', 'flyIntoWall', 'freeze', 'sonic_boom'].includes(source);
    if (!bypassArmor) {
      const a = this.armorPts, t = this.toughness;
      // (breach on the attacker's mace makes armour 15% less effective a level)
      amount = amount * (1 - Math.min(20, Math.max(a / 5, a - 4 * amount / (t + 8))) / 25 * (1 - 0.15 * ((attacker && attacker.breach) || 0)));
      // armour wears out
      for (let i = 0; i < 4; i++) { const s = this.inv.armor(i); if (s && ITEMS[s.id].dur) damageItem(s, Math.max(1, Math.floor(this.lastDamage / 4)), this, () => { this.inv.set(36 + i, null); Sound.play('break_item', this); this.updateArmor(); }); }
    }
    const res = this.effect('resistance'); if (res && source !== 'outOfWorld') amount *= Math.max(0, 1 - 0.2 * (res.amp + 1));
    if (!['outOfWorld', 'starve', 'kill', 'sonic_boom'].includes(source)) {
      let epf = this.armorEnchSum('protection');
      if (['inFire', 'onFire', 'lava', 'hotFloor', 'fireball'].includes(source)) epf += 2 * this.armorEnchSum('fire_protection');
      if (source === 'explosion') epf += 2 * this.armorEnchSum('blast_protection');
      if (source === 'arrow' || source === 'projectile' || source === 'trident') epf += 2 * this.armorEnchSum('projectile_protection');
      if (source === 'fall' || source === 'stalagmite') epf += 3 * this.armorEnchSum('feather_falling');
      amount *= 1 - Math.min(20, epf) / 25;
    }
    // absorption hearts take damage first
    if (this.absorption > 0) { const k = Math.min(this.absorption, amount); this.absorption -= k; amount -= k; }
    this.exhaust(0.1);
    this.health -= amount; Stats.add('custom', 'damage_taken', amount);
    GameEvents.emit('entity_damage', this.x, this.y, this.z, attacker ? attacker.owner || attacker : null);
    this.lastHurtBy = attacker || null; this.lastHurtTime = this.age;
    if (attacker) { this.hurtDir = Math.atan2(attacker.z - this.z, attacker.x - this.x) * 180 / Math.PI - this.yaw * 180 / Math.PI; }
    Sound.play('player_hurt', this, { source });
    // thorns on armour
    if (attacker && attacker.hurt && !bypassArmor) { const th = this.armorEnch('thorns'); if (th && Math.random() < 0.15 * th) attacker.hurt(1 + Math.floor(Math.random() * 4), 'thorns', this); }
    if (this.health <= 0) {
      // a totem of undying in either hand saves you
      const hands = [this.inv.selected, 40];
      for (const h of hands) { const s = this.inv.get(h); if (s && ITEMS[s.id].name === 'totem_of_undying') { Advancements.fire('used_totem', { item: s }); this.inv.set(h, null); this.health = 1; this.effects.clear(); this.addEffect('regeneration', 900, 1); this.addEffect('absorption', 100, 1); this.addEffect('fire_resistance', 800, 0); Particles.totem(this); Sound.play('totem', this); HUD.totem(); return true; } }
      this.die(source, attacker);
    }
    return true;
  }
  knockback(strength, dx, dz) {
    strength *= 1 - this.kbResist; if (strength <= 0) return;
    const l = Math.hypot(dx, dz) || 1;
    this.vx = this.vx / 2 - dx / l * strength; this.vz = this.vz / 2 - dz / l * strength;
    if (this.onGround) this.vy = Math.min(0.4, this.vy / 2 + strength);
  }
  die(source, attacker) {
    if (this.dead) return;
    this.dead = true; this.health = 0; this.deathTime = 0; this.flying = false;
    Stats.add('custom', 'deaths'); if (Stats.raw.custom) Stats.raw.custom.time_since_death = 0; if (this.sleeping) Beds.wake(this);
    this.deathCause = DeathMessages.text(this, source, attacker);
    Advancements.fire('entity_killed_player', { entity: attacker ? attacker.owner || attacker : null });
    GameEvents.emit('entity_die', this.x, this.y, this.z, this);
    Chat.system(this.deathCause);
    if (!Game.rules.keepInventory) {
      for (let i = 0; i < this.inv.size; i++) { const s = this.inv.get(i); if (s && !enchLevel(s, 'vanishing_curse')) Drops.spawnItem(this.x, this.y + 1, this.z, s, true); }
      this.inv.clear();
      const xp = this.xpConsumed ? 0 : Math.min(100, this.xpLevel * 7);
      if (xp > 0) Drops.spawnXp(this.x, this.y + 0.5, this.z, xp);
      this.xpLevel = 0; this.xpProgress = 0; this.xpTotal = 0;
    }
    this.updateArmor();
  }
  respawn() {
    const sp = Beds.respawnPoint(this);
    if (World.dim !== sp.dim) Portals.changeDim(sp.dim, sp.x, sp.y, sp.z, true);
    this.x = this.px = sp.x; this.y = this.py = sp.y; this.z = this.pz = sp.z;
    this.vx = this.vy = this.vz = 0; this.dead = false; this.deathTime = 0; this.health = this.maxHealth = 20; this.food = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = 300; this.fireTicks = 0; this.fallDistance = 0; this.effects.clear(); this.absorption = 0; this.hurtTime = 0; this.xpConsumed = false;
  }
  // ---------------------------------------------------------------- experience (the game's level curve)
  static xpForLevel(l) { return l >= 30 ? 112 + (l - 30) * 9 : l >= 15 ? 37 + (l - 15) * 5 : 7 + l * 2; }
  addXp(n) {
    this.score += n;
    this.xpProgress += n / Player.xpForLevel(this.xpLevel);
    this.xpTotal = Math.max(0, this.xpTotal + n);
    while (this.xpProgress >= 1) { this.xpProgress = (this.xpProgress - 1) * Player.xpForLevel(this.xpLevel); this.xpLevel++; this.xpProgress /= Player.xpForLevel(this.xpLevel); if (this.xpLevel % 5 === 0) Sound.play('levelup', this); }
  }
  addLevels(n) { this.xpLevel = Math.max(0, this.xpLevel + n); if (this.xpProgress >= 1) this.xpProgress = 0; }
  // ---------------------------------------------------------------- camera
  updateCamera(a) {
    const x = this.px + (this.x - this.px) * a, y = this.py + (this.y - this.py) * a, z = this.pz + (this.z - this.pz) * a;
    const eh = this.peyeH + (this.eyeH - this.peyeH) * a;
    let cx = x, cy = y + eh, cz = z;
    let yaw = this.yaw, pitch = this.pitch, roll = 0;
    if (this.sleeping) { cy = this.sleeping.y + 0.7; pitch = -0.5; }
    // bobbing and hurt tilt
    const bob = this.pbob + (this.bob - this.pbob) * a, wd = this.pwalkDist + (this.walkDist - this.pwalkDist) * a;
    let bx = 0, by = 0, bp = 0;
    if (Settings.bobbing && this.view === 0 && !this.flying) {
      const g = wd * Math.PI;
      bx = Math.sin(g) * bob * 0.5; by = -Math.abs(Math.cos(g) * bob); roll += Math.sin(g) * bob * 3 * Math.PI / 180; bp = Math.abs(Math.cos(g - 0.2) * bob) * 5 * Math.PI / 180;
    }
    if (this.hurtTime > 0 && !this.dead) { const h = (this.hurtTime - a) / 10; roll += -Math.sin(h * h * h * h * Math.PI) * 14 * Math.PI / 180 * Math.cos(this.hurtDir * Math.PI / 180); }
    if (this.dead) roll = Math.min(this.deathTime + a, 20) / 20 * 40 * Math.PI / 180;
    // nausea wobble
    const nau = this.effect('nausea'); if (nau) { roll += Math.sin(this.age * 0.15) * 0.15; }
    camera.rotation.set(-(pitch + bp), yaw, -roll);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    cx += right[0] * bx; cz += right[2] * bx; cy += by;
    if (this.view !== 0) {
      // third person: back off along the view direction until a block is in the way
      const dir = this.lookVec(), sign = this.view === 1 ? -1 : 1;
      let dist = 4;
      const hit = Phys.raycast(cx, cy, cz, dir[0] * sign, dir[1] * sign, dir[2] * sign, 4.1, id => OPAQUE[id]);
      if (hit) dist = Math.max(0.3, hit.t - 0.3);
      cx += dir[0] * sign * dist; cy += dir[1] * sign * dist; cz += dir[2] * sign * dist;
      if (this.view === 2) camera.rotation.set(pitch, yaw + Math.PI, 0);
    }
    camera.position.set(cx, cy, cz);
    const fm = this.pfovMod + (this.fovMod - this.pfovMod) * a;
    camera.fov = Settings.fov * fm * (this.eyesInWater ? 0.857 : 1);
  }
}
function sourceKind(s) { if (s === 'arrow' || s === 'projectile' || s === 'trident') return 'arrow'; if (s === 'explosion') return 'explosion'; if (s === 'fireball') return 'fireball'; if (s === 'mob' || s === 'player') return 'mob'; return s; }
