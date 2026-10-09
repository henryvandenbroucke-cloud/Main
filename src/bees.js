'use strict';
/* Bees and their nests and hives, the way Java Edition 1.21 has them:
   - A nest or hive holds up to three bees. A bee stays inside at least 30 seconds (2 minutes after bringing
     nectar), and none come out at night or in the rain, or while something blocks the entrance.
   - Out by day, a bee looks for a flower within 5 blocks and hovers at it about 20 seconds to collect nectar.
     It then heads home, growing a few crops it flies over on the way. Delivering nectar raises the honey level
     (0 to 5; rarely by 2).
   - At level 5, shears give 3 honeycomb and a glass bottle a honey bottle. Without a lit campfire within
     5 blocks under the hive, or when the hive is broken without silk touch, the bees come out angry.
   - An angry bee chases for 20 to 40 seconds and stings once (poison on normal and hard). It then loses its
     stinger and dies within a minute. Hitting one angers every bee nearby. */
const Bees = (() => {
  const B = BID;
  const FLOWERS = new Set((MCDATA.itemTags.flowers || []).map(n => BID[n]).filter(i => i !== undefined));
  const GROWABLE = new Set(['wheat', 'carrots', 'potatoes', 'beetroots', 'melon_stem', 'pumpkin_stem', 'sweet_berry_bush', 'cave_vines', 'cave_vines_plant', 'torchflower_crop', 'pitcher_crop'].map(n => BID[n]).filter(i => i !== undefined));
  const isHive = id => id === B.bee_nest || id === B.beehive;
  const honey = st => (st >> 3) & 7;
  const now = () => Game.gameTime;
  const dayish = () => { const t = ((Game.dayTime % 24000) + 24000) % 24000; return t < 12542 || t > 23460; };
  const raining = (x, y, z) => Weather.rainingAt ? Weather.rainingAt(x, y, z) : false;
  function newBE() { return { type: 'hive', bees: [] }; }
  function hiveBE(x, y, z) { let be = World.getBE(x, y, z); if (!be || be.type !== 'hive') { be = newBE(); World.setBE(x, y, z, be); } return be; }
  // a lit campfire up to 5 blocks below calms the bees (the smoke has to reach the hive)
  function smoked(x, y, z) {
    for (let i = 1; i <= 5; i++) {
      const id = World.getBlock(x, y - i, z), st = World.getState(x, y - i, z), n = BLOCKS[id].name;
      if ((n === 'campfire' || n === 'soul_campfire') && (st & 8) === 0) return true;
      if (SOLID[id] && BLOCKS[id].model === 'cube') return false;
    }
    return false;
  }
  // ---------------------------------------------------------------- the hive: bees inside, coming and going
  function tick(be) {
    const { x, y, z } = be; if (!isHive(World.getBlock(x, y, z))) return;
    if (be.bees.length) {
      for (const b of be.bees) b.ticks++;
      for (let i = be.bees.length - 1; i >= 0; i--) { const b = be.bees[i]; if (b.ticks > b.min && release(be, b, false)) be.bees.splice(i, 1); }
      if (Math.random() < 0.005) Sound.play('beehive_work', null, { x, y, z });
    }
    // dripping honey when full
    if (honey(World.getState(x, y, z)) >= 5 && Math.random() < 0.02 && Game.player && Math.abs(Game.player.x - x) < 24 && Math.abs(Game.player.z - z) < 24) {
      const q = Particles.generic(x + 0.2 + Math.random() * 0.6, y - 0.05, z + 0.2 + Math.random() * 0.6, 0, 0, 0, { life: 40, grav: 0.06, drag: 0.98, size: 0.05 });
      q.r = 0.95; q.g = 0.7; q.b = 0.15;
    }
  }
  // a bee leaves through the front (not at night or in the rain unless in an emergency)
  function release(be, b, emergency, angryAt) {
    const { x, y, z } = be, st = World.getState(x, y, z), f = st & 7 || 3;
    if (!emergency && (!dayish() || raining(x + 0.5, y + 1, z + 0.5))) return false;
    const fx = x + DX[f], fz = z + DZ[f];
    if (SOLID[World.getBlock(fx, y, fz)] && !emergency) return false;
    const m = Mobs.create('bee', x + 0.5 + DX[f] * 0.75, y + 0.15, z + 0.5 + DZ[f] * 0.75); if (!m) return false;
    m.yaw = m.bodyYaw = Math.atan2(-DX[f], -DZ[f]);
    if (b.health) m.health = b.health; if (b.baby) { m.setBaby(); m.ageTicks = b.age || -24000; } if (b.name) m.customName = b.name;
    m.hive = [x, y, z]; m.stayOut = 400;
    if (b.nectar && !emergency) {
      const h = honey(World.getState(x, y, z));
      if (h < 5) { let add = Math.random() < 0.01 ? 2 : 1; if (h + add > 5) add--; World.setBlock(x, y, z, World.getBlock(x, y, z), (st & 7) | ((h + add) << 3)); }
    }
    Entities.add(m);
    if (angryAt) m.anger(angryAt);
    Sound.play('beehive_exit', null, { x, y, z });
    return true;
  }
  function enter(bee) {
    const [x, y, z] = bee.hive; if (!isHive(World.getBlock(x, y, z))) { bee.hive = null; return false; }
    const be = hiveBE(x, y, z); if (be.bees.length >= 3) return false;
    be.bees.push({ nectar: bee.hasNectar, ticks: 0, min: bee.hasNectar ? 2400 : 600, health: bee.health, baby: bee.baby, age: bee.ageTicks, name: bee.customName || null });
    bee.removed = true;
    Sound.play('beehive_enter', null, { x, y, z });
    return true;
  }
  // every bee in the hive comes out angry, and the bees around turn on a player too
  function anger(x, y, z, p) {
    const be = World.getBE(x, y, z);
    if (be && be.bees) { for (const b of be.bees.splice(0)) release(be, b, true, p && !p.creative ? p : null); }
    if (!p || p.creative) return;
    for (const e of Entities.list) if (e.type === 'bee' && !e.dead && !e.target && Math.abs(e.x - x - 0.5) <= 8.5 && Math.abs(e.y - y - 0.5) <= 6.5 && Math.abs(e.z - z - 0.5) <= 8.5) e.anger(p);
  }
  // using a full hive: shears give honeycomb, a bottle gives honey (smoke keeps the bees calm)
  function use(p, x, y, z, st, held) {
    const n = held ? ITEMS[held.id].name : '';
    if (honey(st) < 5 || (n !== 'shears' && n !== 'glass_bottle')) return false;
    if (n === 'shears') { Drops.spawnItem(x + 0.5, y + 1, z + 0.5, stack('honeycomb', 3)); p.inv.damageHeld(1, p); Sound.play('beehive_shear', null, { x, y, z }); Sound.play('shear', null, { x, y, z }); }
    else { if (!p.creative) { held.count--; if (!held.count) p.inv.held = null; } const left = p.inv.add(stack('honey_bottle')); if (left) ItemUse.drop(p, left); p.inv.changed(); Sound.play('bottle_fill', null, { x, y, z }); }
    World.setBlock(x, y, z, World.getBlock(x, y, z), st & 7);
    if (!smoked(x, y, z)) anger(x, y, z, p);
    return true;
  }
  // broken: without silk touch the bees pour out angry; with it the hive keeps them (and its honey)
  function broken(p, x, y, z, id, st, silk) {
    const be = World.getBE(x, y, z);
    if (p && p.isPlayer) Advancements.fire('bee_nest_destroyed', { block: BLOCKS[id].name, item: p.inv.held, bees: be && be.bees ? be.bees.length : 0 });
    if (silk || (p && p.creative)) return be && be.bees && be.bees.length ? { bees: be.bees.slice(), honey: honey(st) } : (honey(st) ? { honey: honey(st) } : null);
    anger(x, y, z, p);
    return null;
  }
  function placed(x, y, z, s) {
    if (!s || !s.tag) return;
    if (s.tag.bees) hiveBE(x, y, z).bees = s.tag.bees.map(b => Object.assign({}, b, { ticks: 0 }));
    if (s.tag.honey) World.setBlock(x, y, z, World.getBlock(x, y, z), (World.getState(x, y, z) & 7) | (s.tag.honey << 3), 4);
  }
  const nearestHive = (x, y, z, r) => {
    let best = null, bd = r * r;
    for (const c of World.chunks.values()) {
      if (Math.abs(c.cx * 16 + 8 - x) > r + 16 || Math.abs(c.cz * 16 + 8 - z) > r + 16) continue;
      for (const be of c.be.values()) if (be.type === 'hive' && be.bees.length < 3 && isHive(World.getBlock(be.x, be.y, be.z))) { const d = (be.x - x) ** 2 + (be.y - y) ** 2 + (be.z - z) ** 2; if (d < bd) { bd = d; best = [be.x, be.y, be.z]; } }
    }
    return best;
  };
  function nearestFlower(x, y, z, r) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z); let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const id = World.getBlock(bx + dx, by + dy, bz + dz); if (!FLOWERS.has(id)) continue;
      const st = World.getState(bx + dx, by + dy, bz + dz);
      if (BLOCKS[id].model === 'tall' && !(st & 8) && BLOCKS[id].name === 'sunflower') continue;
      if (st & 128) continue;
      const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = [bx + dx, by + dy, bz + dz]; }
    }
    return best;
  }
  return { FLOWERS, GROWABLE, newBE, tick, enter, release, anger, use, broken, placed, smoked, nearestHive, nearestFlower, dayish, raining };
})();

// ---------------------------------------------------------------- the bee
(() => {
  const Flyer = Object.getPrototypeOf(MobTypes.bee);
  class Bee extends Flyer {
    constructor(t, x, y, z) {
      super('bee', x, y, z);
      this.flySpeed = 0.1; this.hive = null; this.flower = null; this.hasNectar = false; this.hasStung = false; this.stingT = 0;
      this.angerT = 0; this.stayOut = 0; this.findFlowerCool = 0; this.findHiveCool = 0; this.pollinateT = 0; this.crops = 0; this.attackCool = 0; this.noNectarT = 0;
    }
    get food() { return [...Bees.FLOWERS].map(i => BLOCKS[i].name).filter(n => IID[n] !== undefined); }
    registerGoals() { this.goals.add(0, new G.Breed(this, 1)); this.goals.add(2, new G.FollowParent(this, 1.25)); }
    layers() { return [{ model: 'bee_nectar', transparent: true, when: e => e.hasNectar }, { model: 'bee_angry', transparent: true, when: e => !!e.target }]; }
    posePart(inst) { if (inst.parts.stinger) inst.parts.stinger.show = !this.hasStung; }
    anger(p) { if (!p || p.creative || p.spectator || p.dead) return; this.target = p; this.angerT = 400 + Math.floor(Math.random() * 400); }
    // bees angry at what hurt them, and every bee around joins in
    onHurt(amount, source, attacker) {
      const a = attacker && (attacker.owner || attacker); if (!a || !(a.isPlayer || a.living) || a.creative) return;
      this.anger(a);
      for (const e of Entities.list) if (e.type === 'bee' && e !== this && !e.dead && !e.target && Math.abs(e.x - this.x) < 48 && Math.abs(e.y - this.y) < 10 && Math.abs(e.z - this.z) < 48) e.anger(a);
    }
    wantsHome() { if (this.stayOut > 0 || this.pollinateT > 0 || this.hasStung || this.target) return false; return !Bees.dayish() || Bees.raining(this.x, this.y, this.z) || this.hasNectar; }
    fly(x, y, z, sp) { this.dest = [x, y, z]; this.flyTo_s = sp || 1; }
    aiStep() {
      if (this.stayOut > 0) this.stayOut--; if (this.findFlowerCool > 0) this.findFlowerCool--; if (this.findHiveCool > 0) this.findHiveCool--; if (this.attackCool > 0) this.attackCool--;
      // a bee that has stung dies within a minute or so
      if (this.hasStung) { this.stingT++; if (this.stingT % 5 === 0 && rnd(Math.max(1, Math.min(1200, 1200 - this.stingT))) === 0) this.hurt(this.health, 'generic'); }
      if (this.hasNectar && Math.random() < 0.05) { const q = Particles.generic(this.x + (Math.random() - 0.5) * 0.3, this.y, this.z + (Math.random() - 0.5) * 0.3, 0, 0, 0, { life: 30, grav: 0.04, drag: 0.98, size: 0.04 }); q.r = 1; q.g = 0.85; q.b = 0.3; }
      if (this.age % 40 === 0 && Math.random() < 0.6 && Game.player && this.distTo(Game.player) < 12) Sound.play(this.target ? 'bee_loop_aggressive' : 'bee_loop', this);
      const t = this.target;
      if (t) {
        if (--this.angerT <= 0 || t.dead || t.removed || (t.isPlayer && (t.creative || t.spectator)) || this.hasStung) { this.target = null; }
        else {
          this.fly(t.x, t.y + t.h * 0.5, t.z, 1.4);
          if (this.distTo(t) < 1.3 && this.attackCool <= 0) { this.attackCool = 20; this.sting(t); }
        }
      } else if (this.hive && this.wantsHome()) {
        const [hx, hy, hz] = this.hive;
        if (!['bee_nest', 'beehive'].includes(BLOCKS[World.getBlock(hx, hy, hz)].name)) this.hive = null;
        else if ((this.x - hx - 0.5) ** 2 + (this.y - hy - 0.5) ** 2 + (this.z - hz - 0.5) ** 2 < 4) { if (!Bees.enter(this)) { this.stayOut = 400; } return; }
        else { const f = World.getState(hx, hy, hz) & 7 || 3; this.fly(hx + 0.5 + DX[f] * 0.8, hy + 0.4, hz + 0.5 + DZ[f] * 0.8, 1); }
      } else if (this.pollinateT > 0 && this.flower) {
        // hovering at the flower: about 20 seconds of pollinating makes nectar
        const [fx, fy, fz] = this.flower;
        if (!Bees.FLOWERS.has(World.getBlock(fx, fy, fz)) || Bees.raining(this.x, this.y, this.z)) { this.pollinateT = 0; this.flower = null; }
        else {
          if (this.age % 20 === 0 || !this.dest) this.fly(fx + 0.5 + (Math.random() - 0.5) * 0.4, fy + 0.6 + Math.random() * 0.2, fz + 0.5 + (Math.random() - 0.5) * 0.4, 0.35);
          if ((this.x - fx - 0.5) ** 2 + (this.z - fz - 0.5) ** 2 < 0.5) this.pollinateT++;
          if (this.pollinateT > 400) { this.hasNectar = true; this.pollinateT = 0; this.crops = 0; this.noNectarT = 0; Sound.play('bee_pollinate', this); }
          else if (this.pollinateT === 1 || this.age % 60 === 0) Sound.play('bee_pollinate', this);
        }
      } else {
        if (!this.hive && this.findHiveCool <= 0) { this.hive = Bees.nearestHive(this.x, this.y, this.z, 20); this.findHiveCool = 200; }
        if (!this.hasNectar && this.findFlowerCool <= 0 && !Bees.raining(this.x, this.y, this.z) && Bees.dayish()) {
          const f = Bees.nearestFlower(this.x, this.y, this.z, 5);
          if (f) { this.flower = f; this.pollinateT = 1; this.fly(f[0] + 0.5, f[1] + 0.7, f[2] + 0.5, 1); }
          else this.findFlowerCool = 20 + Math.floor(Math.random() * 41);
        }
        // wander near home
        if (!this.dest || rnd(60) === 0) {
          const c = this.hive && (this.x - this.hive[0]) ** 2 + (this.z - this.hive[2]) ** 2 > 22 * 22 ? this.hive : null;
          const bx = c ? c[0] : this.x, bz = c ? c[2] : this.z;
          this.fly(bx + rnd(16) - 8, Math.max(MINY + 2, (c ? c[1] : this.y) + rnd(6) - 2), bz + rnd(16) - 8, 0.6);
        }
      }
      // carrying nectar over crops: now and then one grows (up to 10 a trip)
      if (this.hasNectar && this.crops < 10 && rnd(30) === 0) for (let i = 1; i <= 2; i++) {
        const bx = Math.floor(this.x), by = Math.floor(this.y) - i, bz = Math.floor(this.z), id = World.getBlock(bx, by, bz);
        if (!Bees.GROWABLE.has(id)) continue;
        const st = World.getState(bx, by, bz), n = BLOCKS[id].name, max = n === 'beetroots' || n === 'sweet_berry_bush' ? 3 : n === 'torchflower_crop' ? 1 : n === 'pitcher_crop' ? 4 : 7;
        if (n === 'cave_vines' || n === 'cave_vines_plant') { if (!(st & 8)) World.setBlock(bx, by, bz, id, st | 8); }
        else if ((st & 7) < max) World.setBlock(bx, by, bz, id, (st & ~7) | ((st & 7) + 1));
        else continue;
        Particles.boneMeal && Particles.boneMeal(bx, by, bz); this.crops++; break;
      }
      // fly
      if (this.dest) {
        const [x, y, z] = this.dest, dx = x - this.x, dy = y - this.y, dz = z - this.z, d = Math.hypot(dx, dy, dz);
        if (d < 0.3) this.dest = null;
        else { const k = this.flySpeed * (this.flyTo_s || 1); this.vx += (dx / d * k - this.vx) * 0.1; this.vy += (dy / d * k - this.vy) * 0.1; this.vz += (dz / d * k - this.vz) * 0.1; }
      }
      if (Math.hypot(this.vx, this.vz) > 0.01 && !t) this.yaw = turnToward(this.yaw, Math.atan2(-this.vx, -this.vz), 0.3);
      if (t) { this.yaw = turnToward(this.yaw, Math.atan2(-(t.x - this.x), -(t.z - this.z)), 0.3); this.lookAt(t.x, t.eyeY, t.z); }
      this.lookYaw = this.yaw; this.forward = 0.3;
    }
    sting(t) {
      if (!t.hurt(2, 'sting', this)) return;
      this.swingArm && this.swingArm();
      const d = Game.difficulty; if (t.addEffect && (d === 'normal' || d === 'hard')) t.addEffect('poison', d === 'hard' ? 360 : 200, 0);
      this.hasStung = true; this.target = null; this.angerT = 0;
      Sound.play('bee_sting', this);
    }
    saveExtra(d) { d.bee = { hive: this.hive, nectar: this.hasNectar, stung: this.hasStung, stingT: this.stingT, flower: this.flower }; }
    loadExtra(d) { const b = d.bee; if (!b) return; this.hive = b.hive; this.hasNectar = b.nectar; this.hasStung = b.stung; this.stingT = b.stingT || 0; this.flower = b.flower; }
  }
  MobTypes.bee = Bee;
  // the pollen on a bee carrying nectar, and its angry eyes
  const D = EntityModels.DEFS.bee;
  if (D) {
    EntityModels.def('bee_nectar', 64, 64, D.parts, { anim: 'bee', skin: s => { for (const [x, y] of [[11, 12], [14, 15], [9, 17], [16, 20], [12, 22], [20, 13], [24, 18], [27, 21], [10, 25]]) s.fill(x, y, 1, 1, 0xfff4a0, 0); } });
    EntityModels.def('bee_angry', 64, 64, D.parts, { anim: 'bee', skin: s => { s.fill(11, 12, 2, 2, 0xc02020, 0); s.fill(15, 12, 2, 2, 0xc02020, 0); } });
  }
})();
