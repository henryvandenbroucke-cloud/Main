'use strict';
/* Mobs: the base class with the game's AI structure (prioritised goals that claim movement, looking and
   jumping, plus target selectors), path finding over blocks, look/move/jump control, damage with the
   invulnerability window, knockback, burning in daylight, death with loot tables and experience, and natural
   spawning and despawning with the game's rules (light level 0 for monsters, caps per category, no spawning
   within 24 blocks of the player, instant despawn beyond 128 blocks and random despawn beyond 32). */

// ---------------------------------------------------------------- path finding
const Path = (() => {
  // what a cell is to a walking mob: 0 open, 1 blocked, 2 dangerous, 3 water, 4 open door / passable
  function cell(x, y, z) {
    const id = World.getBlock(x, y, z), d = BLOCKS[id];
    if (id === 0) return 0;
    if (d.fluid === 'lava' || id === BID.fire || id === BID.soul_fire || id === BID.magma_block || id === BID.cactus || id === BID.sweet_berry_bush || id === BID.campfire || id === BID.powder_snow || id === BID.wither_rose) return 2;
    if (d.fluid === 'water' || (d.waterlog && (World.getState(x, y, z) & 128) && !SOLID[id])) return 3;
    if (d.model === 'door') return (World.getState(x, y, z) & 16) ? 4 : (d.name === 'iron_door' ? 1 : 5); // 5: closed wooden door
    if (d.model === 'gate') return (World.getState(x, y, z) & 16) ? 0 : 1;
    if (!SOLID[id]) return id === BID.cobweb ? 2 : 0;
    if (d.model === 'carpet' || d.model === 'layer' && (World.getState(x, y, z) & 7) < 1) return 0;
    if (d.model === 'trapdoor') return (World.getState(x, y, z) & 16) ? 0 : 1;
    return 1;
  }
  const tall = id => { const m = BLOCKS[id].model; return m === 'fence' || m === 'wall' || m === 'gate'; };
  // can a mob of this size stand with its feet in (x, y, z)?
  function stand(x, y, z, hc, o) {
    for (let k = 0; k < hc; k++) { const c = cell(x, y + k, z); if (c === 1 || c === 5 && !o.doors) return -1; if (c === 2) return -2; if (c === 3 && !o.swim && k === 0) return 3; }
    const below = World.getBlock(x, y - 1, z);
    if (tall(below)) return -1;
    const cb = cell(x, y - 1, z);
    if (cb === 1) return 0;
    if (cb === 3) return o.swim || o.water ? 3 : 3;
    if (cell(x, y, z) === 3) return 3;
    return -3; // air below: would fall
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function find(e, tx, ty, tz, o) {
    o = Object.assign({ maxNodes: 300, maxFall: e.maxFall || 3, swim: !!e.swims, doors: !!e.opensDoors, waterMalus: e.waterMalus === undefined ? 8 : e.waterMalus, reach: 1 }, o || {});
    const hc = Math.max(1, Math.ceil(e.h)), sx = Math.floor(e.x), sz = Math.floor(e.z);
    let sy = Math.floor(e.y + 0.5);
    if (stand(sx, sy, sz, hc, o) < 0 && stand(sx, sy - 1, sz, hc, o) >= 0) sy--;
    tx = Math.floor(tx); ty = Math.floor(ty); tz = Math.floor(tz);
    const key = (x, y, z) => ((x & 1023) << 20) | ((y + 64 & 511) << 10) | (z & 1023);
    const h = (x, y, z) => Math.sqrt((x - tx) ** 2 + (y - ty) ** 2 * 1.5 + (z - tz) ** 2);
    const open = [], nodes = new Map();
    const start = { x: sx, y: sy, z: sz, g: 0, f: h(sx, sy, sz), p: null, closed: false };
    nodes.set(key(sx, sy, sz), start); open.push(start);
    let best = start, n = 0;
    while (open.length && n++ < o.maxNodes) {
      // pop the lowest f (a simple binary heap would be faster, but the lists stay short)
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop(); cur.closed = true;
      if (h(cur.x, cur.y, cur.z) < h(best.x, best.y, best.z)) best = cur;
      if (Math.abs(cur.x - tx) + Math.abs(cur.z - tz) <= o.reach - 1 + (o.reach > 1 ? 1 : 0) && Math.abs(cur.y - ty) <= 1 && (o.reach > 1 || (cur.x === tx && cur.z === tz))) { best = cur; break; }
      for (let di = 0; di < 8; di++) {
        const [dx, dz] = DIRS[di], nx = cur.x + dx, nz = cur.z + dz;
        if (di >= 4 && (stand(cur.x + dx, cur.y, cur.z, hc, o) < 0 || stand(cur.x, cur.y, cur.z + dz, hc, o) < 0)) continue;
        let ny = cur.y, kind = stand(nx, ny, nz, hc, o);
        if (kind === -1) { // a step up (jump) needs room above our head
          if (di < 4 && stand(nx, ny + 1, nz, hc, o) >= 0 && cell(cur.x, cur.y + hc, cur.z) !== 1) { ny++; kind = stand(nx, ny, nz, hc, o); } else continue;
        } else if (kind === -3) { // drop down
          let fall = 0; while (fall < o.maxFall + 1 && stand(nx, ny - 1, nz, hc, o) === -3) { ny--; fall++; }
          ny--; kind = stand(nx, ny, nz, hc, o); if (kind < 0 || fall >= o.maxFall + 1) continue;
        }
        if (kind < 0) continue;
        const k = key(nx, ny, nz);
        let cost = (di >= 4 ? 1.414 : 1) + (kind === 3 ? o.waterMalus : 0) + (ny > cur.y ? 0.5 : 0);
        const g = cur.g + cost;
        let nd = nodes.get(k);
        if (nd) { if (nd.closed || g >= nd.g) continue; nd.g = g; nd.f = g + h(nx, ny, nz); nd.p = cur; continue; }
        nd = { x: nx, y: ny, z: nz, g, f: g + h(nx, ny, nz), p: cur, closed: false };
        nodes.set(k, nd); open.push(nd);
      }
    }
    if (best === start) return null;
    const path = []; for (let q = best; q; q = q.p) path.push(q);
    path.reverse();
    return { nodes: path, i: 1, reached: best.x === tx && best.z === tz && Math.abs(best.y - ty) <= 1, tx, ty, tz };
  }
  return { find, cell, stand };
})();

// ---------------------------------------------------------------- navigation and control
class Navigator {
  constructor(m) { this.m = m; this.path = null; this.speed = 1; this.stuck = 0; this.lastPos = null; this.recalc = 0; this.target = null; }
  moveTo(x, y, z, speed, o) {
    this.speed = speed || 1;
    const t = this.target;
    if (this.path && t && Math.abs(t[0] - x) < 1 && Math.abs(t[1] - y) < 1 && Math.abs(t[2] - z) < 1 && this.recalc > 0) return true;
    this.target = [x, y, z]; this.recalc = 10 + Math.floor(Math.random() * 10);
    this.path = Path.find(this.m, x, y, z, o);
    this.stuck = 0;
    return !!this.path;
  }
  moveToEntity(e, speed) { return this.moveTo(e.x, e.y, e.z, speed, { reach: 1 }); }
  stop() { this.path = null; this.target = null; this.m.forward = 0; }
  done() { return !this.path || this.path.i >= this.path.nodes.length; }
  tick() {
    const m = this.m;
    if (this.recalc > 0) this.recalc--;
    if (!this.path) return;
    const p = this.path;
    if (p.i >= p.nodes.length) { this.path = null; m.forward = 0; return; }
    const nd = p.nodes[p.i];
    const cx = nd.x + 0.5, cz = nd.z + 0.5, dx = cx - m.x, dz = cz - m.z, dy = nd.y - m.y;
    const reach = m.w > 0.75 ? m.w / 2 : 0.75 - m.w / 2;
    if (Math.abs(dx) < reach && Math.abs(dz) < reach && Math.abs(dy) < 1) { p.i++; return this.tick2(); }
    m.moveControl(cx, nd.y, cz, this.speed);
    // stuck: no progress for 3 seconds
    if (m.age % 20 === 0) { const lp = this.lastPos; if (lp && Math.hypot(m.x - lp[0], m.z - lp[1]) < 0.3) { if (++this.stuck >= 3) this.stop(); } else this.stuck = 0; this.lastPos = [m.x, m.z]; }
  }
  tick2() { if (this.path && this.path.i < this.path.nodes.length) { const nd = this.path.nodes[this.path.i]; this.m.moveControl(nd.x + 0.5, nd.y, nd.z + 0.5, this.speed); } else { this.path = null; this.m.forward = 0; } }
}

// ---------------------------------------------------------------- goals
class Goal {
  constructor(m, flags) { this.m = m; this.flags = flags || ''; }
  canUse() { return false; } canContinue() { return this.canUse(); } start() {} stop() {} tick() {}
  get interruptible() { return true; }
}
class GoalSelector {
  constructor() { this.list = []; }
  add(prio, goal) { this.list.push({ prio, goal, running: false }); this.list.sort((a, b) => a.prio - b.prio); return goal; }
  remove(goal) { const i = this.list.findIndex(g => g.goal === goal); if (i >= 0) { if (this.list[i].running) goal.stop(); this.list.splice(i, 1); } }
  tick(age) {
    for (const g of this.list) if (g.running && !g.goal.canContinue()) { g.running = false; g.goal.stop(); }
    if (age % 2 === 0) for (const g of this.list) {
      if (g.running) continue;
      // flags held by a running goal of higher or equal priority block this one; lower priority ones are interrupted
      let blocked = false;
      for (const o of this.list) if (o.running && o !== g && [...g.goal.flags].some(f => o.goal.flags.includes(f))) { if (o.prio <= g.prio || !o.goal.interruptible) { blocked = true; break; } }
      if (blocked || !g.goal.canUse()) continue;
      for (const o of this.list) if (o.running && o !== g && [...g.goal.flags].some(f => o.goal.flags.includes(f))) { o.running = false; o.goal.stop(); }
      g.running = true; g.goal.start();
    }
    for (const g of this.list) if (g.running) g.goal.tick();
  }
  stopAll() { for (const g of this.list) if (g.running) { g.running = false; g.goal.stop(); } }
  running(cls) { return this.list.some(g => g.running && g.goal instanceof cls); }
}
const rnd = n => Math.floor(Math.random() * n);
// a random standable spot within h blocks horizontally and v vertically (biased to the given direction)
function randomPos(m, h, v, toward, away) {
  let best = null, bestW = -Infinity;
  for (let k = 0; k < 10; k++) {
    let x = Math.floor(m.x) + rnd(2 * h + 1) - h, z = Math.floor(m.z) + rnd(2 * h + 1) - h, y = Math.floor(m.y) + rnd(2 * v + 1) - v;
    if (toward) { const dx = toward[0] - m.x, dz = toward[2] - m.z, l = Math.hypot(dx, dz) || 1; x = Math.floor(m.x + dx / l * h * Math.random()); z = Math.floor(m.z + dz / l * h * Math.random()); }
    if (away) { const dx = m.x - away[0], dz = m.z - away[2], l = Math.hypot(dx, dz) || 1; x = Math.floor(m.x + dx / l * h * (0.5 + Math.random() * 0.5) + rnd(5) - 2); z = Math.floor(m.z + dz / l * h * (0.5 + Math.random() * 0.5) + rnd(5) - 2); }
    // settle onto the ground
    let tries = 0; while (tries++ < 8 && Path.stand(x, y, z, Math.ceil(m.h), { swim: m.swims }) < 0) { if (Path.cell(x, y, z) === 1) y++; else y--; }
    if (Path.stand(x, y, z, Math.ceil(m.h), { swim: m.swims }) < 0) continue;
    if (!World.loaded(x, z)) continue;
    const w = m.walkWeight ? m.walkWeight(x, y, z) : 0;
    if (w > bestW) { bestW = w; best = [x + 0.5, y, z + 0.5]; }
  }
  return best;
}
const G = {};
G.Float = class extends Goal { constructor(m) { super(m, 'J'); } canUse() { return this.m.inWater && this.m.waterTop - this.m.y > (this.m.h < 0.4 ? 0.1 : 0.4) || this.m.inLava; } tick() { if (Math.random() < 0.8) this.m.jumping = true; } };
G.Panic = class extends Goal {
  constructor(m, speed) { super(m, 'M'); this.speed = speed; }
  canUse() { const m = this.m; return (m.lastHurtBy || m.fireTicks > 0) && m.age - m.lastHurtTime < 100 || (m.fireTicks > 0 && !m.fireImmune); }
  start() { const m = this.m; const t = randomPos(m, 5, 4, null, m.lastHurtBy ? [m.lastHurtBy.x, m.lastHurtBy.y, m.lastHurtBy.z] : null); if (t) m.nav.moveTo(t[0], t[1], t[2], this.speed); }
  canContinue() { return !this.m.nav.done(); }
  stop() { this.m.nav.stop(); }
};
G.RandomStroll = class extends Goal {
  constructor(m, speed, interval) { super(m, 'M'); this.speed = speed || 1; this.interval = interval || 120; }
  canUse() { const m = this.m; if (m.passengers.length || m.leashed) return false; if (m.noActionTime >= 100 && !m.persistent && !m.alwaysWander) return false; if (rnd(this.interval) !== 0) return false; this.t = randomPos(m, 10, 7); return !!this.t; }
  start() { this.m.nav.moveTo(this.t[0], this.t[1], this.t[2], this.speed); }
  canContinue() { return !this.m.nav.done() && !this.m.passengers.length; }
  stop() { this.m.nav.stop(); }
};
G.WaterAvoidingStroll = G.RandomStroll;
G.LookAtPlayer = class extends Goal {
  constructor(m, dist, prob, cls) { super(m, 'L'); this.dist = dist || 8; this.prob = prob || 0.02; this.cls = cls; }
  canUse() { if (Math.random() >= this.prob) return false; const p = this.cls ? this.m.nearest(e => e.type === this.cls, this.dist) : Game.player; if (!p || p.dead || p.spectator || this.m.distTo(p) > this.dist) return false; this.t = p; return true; }
  start() { this.time = 40 + rnd(40); }
  canContinue() { return !this.t.dead && this.m.distTo(this.t) <= this.dist && this.time > 0; }
  tick() { this.time--; this.m.lookAt(this.t.x, this.t.eyeY, this.t.z); }
};
G.RandomLookAround = class extends Goal {
  constructor(m) { super(m, 'ML'); }
  canUse() { return Math.random() < 0.02; }
  start() { const a = Math.random() * Math.PI * 2; this.dx = Math.cos(a); this.dz = Math.sin(a); this.time = 20 + rnd(20); }
  canContinue() { return this.time >= 0; }
  tick() { this.time--; const m = this.m; m.lookAt(m.x + this.dx, m.eyeY, m.z + this.dz); }
};
G.Tempt = class extends Goal {
  constructor(m, speed, items) { super(m, 'ML'); this.speed = speed; this.items = new Set(items); this.cool = 0; }
  canUse() { if (this.cool > 0) { this.cool--; return false; } const p = Game.player; if (!p || p.dead || p.spectator || this.m.distTo(p) > 10) return false; const h = p.inv.held, o = p.inv.offhand; return (h && this.items.has(ITEMS[h.id].name)) || (o && this.items.has(ITEMS[o.id].name)); }
  canContinue() { return this.canUse(); }
  stop() { this.cool = 100; this.m.nav.stop(); }
  tick() { const p = Game.player, m = this.m; m.lookAt(p.x, p.eyeY, p.z); if (m.distTo(p) < 2.5) m.nav.stop(); else if (m.age % 10 === 0 || m.nav.done()) m.nav.moveTo(p.x, p.y, p.z, this.speed); }
};
G.Breed = class extends Goal {
  constructor(m, speed) { super(m, 'ML'); this.speed = speed; }
  canUse() { const m = this.m; if (!m.inLove) return false; this.partner = m.nearest(e => e !== m && e.type === m.type && e.inLove > 0 && !e.baby && !e.dead, 8); return !!this.partner; }
  canContinue() { return this.partner && !this.partner.dead && this.partner.inLove > 0 && this.time < 60; }
  start() { this.time = 0; }
  stop() { this.partner = null; this.time = 0; }
  tick() {
    const m = this.m, q = this.partner; m.lookAt(q.x, q.eyeY, q.z); m.nav.moveTo(q.x, q.y, q.z, this.speed);
    this.time++;
    if (this.time >= 60 && m.distTo(q) < 3 && m.id < q.id) m.breedWith(q);
  }
};
G.FollowParent = class extends Goal {
  constructor(m, speed) { super(m, 'M'); this.speed = speed; }
  canUse() { const m = this.m; if (!m.baby) return false; const p = m.nearest(e => e.type === m.type && !e.baby && !e.dead, 8); if (!p || m.distTo(p) < 3) return false; this.p = p; return true; }
  canContinue() { return this.m.baby && this.p && !this.p.dead && this.m.distTo(this.p) >= 3 && this.m.distTo(this.p) <= 16; }
  tick() { if (this.m.age % 10 === 0) this.m.nav.moveTo(this.p.x, this.p.y, this.p.z, this.speed); }
  stop() { this.m.nav.stop(); }
};
G.MeleeAttack = class extends Goal {
  constructor(m, speed, follow) { super(m, 'ML'); this.speed = speed; this.follow = follow; this.cool = 0; }
  canUse() { const t = this.m.target; return t && !t.dead && !(t.isPlayer && (t.creative || t.spectator)); }
  canContinue() { const t = this.m.target; return t && !t.dead && !(t.isPlayer && (t.creative || t.spectator)) && (this.follow || !this.m.nav.done()) && this.m.distTo(t) < 32; }
  start() { this.m.aggressive = true; this.repath = 0; }
  stop() { this.m.aggressive = false; this.m.nav.stop(); }
  tick() {
    const m = this.m, t = m.target;
    m.lookAt(t.x, t.eyeY, t.z, 30, 30);
    if (--this.repath <= 0) { this.repath = 4 + rnd(7); const d = m.distTo(t); if (d > 32) this.repath += 10; else if (d > 16) this.repath += 5; m.nav.moveTo(t.x, t.y, t.z, this.speed, { reach: 1 }); }
    if (this.cool > 0) this.cool--;
    // reach: the attacker's width doubled plus the target's width
    const reach = Math.pow(m.w * 2, 2) + t.w;
    const dx = t.x - m.x, dz = t.z - m.z, d2 = dx * dx + dz * dz;
    if (d2 <= reach && Math.abs(t.y - m.y) < 2.5 && this.cool <= 0 && m.canSee(t)) { this.cool = m.attackInterval || 20; m.swingArm(); m.doHurtTarget(t); }
  }
};
G.NearestAttackableTarget = class extends Goal {
  constructor(m, pred, range, mustSee, prob) { super(m, 'T'); this.pred = pred; this.range = range || 16; this.mustSee = mustSee !== false; this.prob = prob || 10; }
  canUse() {
    const m = this.m; if (m.target && !m.target.dead) return false;
    if (this.prob > 1 && rnd(this.prob) !== 0) return false;
    const c = m.nearest(e => e !== m && !e.dead && this.pred(e) && (!e.isPlayer || (!e.creative && !e.spectator && Game.difficulty !== 'peaceful')), this.range * (this.pred === TARGET_PLAYER && Game.player.sneaking ? 0.8 : 1));
    if (!c || (this.mustSee && !m.canSee(c))) return false;
    this.c = c; return true;
  }
  start() { this.m.target = this.c; this.unseen = 0; }
  canContinue() { const m = this.m, t = m.target; if (!t || t.dead || t.removed || (t.isPlayer && (t.creative || t.spectator))) return false; if (m.distTo(t) > this.range * 1.5) return false; if (this.mustSee) { if (m.canSee(t)) this.unseen = 0; else if (++this.unseen > 60) return false; } return true; }
  stop() { this.m.target = null; }
};
const TARGET_PLAYER = e => e.isPlayer;
G.HurtByTarget = class extends Goal {
  constructor(m, alert) { super(m, 'T'); this.alert = alert; this.last = 0; }
  canUse() { const m = this.m, a = m.lastHurtBy; return a && !a.dead && m.lastHurtTime !== this.last && !(a.isPlayer && (a.creative || a.spectator)) && a.type !== m.type; }
  start() { const m = this.m; m.target = m.lastHurtBy; this.last = m.lastHurtTime; if (this.alert) for (const o of Entities.list) if (o !== m && o.type === m.type && !o.dead && m.distTo(o) < 10 && !o.target) o.target = m.target; }
  canContinue() { const t = this.m.target; return t && !t.dead && this.m.distTo(t) < 32 && !(t.isPlayer && (t.creative || t.spectator)); }
  stop() { this.m.target = null; }
};
G.AvoidEntity = class extends Goal {
  constructor(m, pred, dist, walk, sprint) { super(m, 'M'); this.pred = pred; this.dist = dist; this.walk = walk; this.sprint = sprint; }
  canUse() { const m = this.m; const e = m.nearest(o => o !== m && !o.dead && this.pred(o) && !(o.isPlayer && (o.creative || o.spectator)), this.dist); if (!e) return false; const t = randomPos(m, 16, 7, null, [e.x, e.y, e.z]); if (!t || Math.hypot(t[0] - e.x, t[2] - e.z) < m.distTo(e)) return false; this.e = e; this.t = t; return true; }
  start() { this.m.nav.moveTo(this.t[0], this.t[1], this.t[2], this.walk); }
  canContinue() { return !this.m.nav.done(); }
  tick() { this.m.nav.speed = this.m.distTo(this.e) < 7 ? this.sprint : this.walk; }
  stop() { this.m.nav.stop(); }
};
G.FleeSun = class extends Goal {
  constructor(m, speed) { super(m, 'M'); this.speed = speed; }
  canUse() { const m = this.m; if (!m.target || m.fireTicks <= 0 || !m.isSunny() || m.inv && m.helmet) return false; for (let k = 0; k < 10; k++) { const x = Math.floor(m.x) + rnd(20) - 10, z = Math.floor(m.z) + rnd(20) - 10; let y = Math.floor(m.y) + rnd(6) - 3; if (Path.stand(x, y, z, 2, {}) >= 0 && World.skyLight(x, y + 1, z) < 15) { this.t = [x + 0.5, y, z + 0.5]; return true; } } return false; }
  start() { this.m.nav.moveTo(this.t[0], this.t[1], this.t[2], this.speed); }
  canContinue() { return !this.m.nav.done(); }
};
G.EatGrass = class extends Goal {
  constructor(m) { super(m, 'MLJ'); this.timer = 0; }
  canUse() { const m = this.m; if (rnd(m.baby ? 50 : 1000) !== 0) return false; const x = Math.floor(m.x), y = Math.floor(m.y), z = Math.floor(m.z); return World.getBlock(x, y, z) === BID.short_grass || World.getBlock(x, y - 1, z) === BID.grass_block; }
  start() { this.timer = 40; this.m.eating = 40; this.m.nav.stop(); }
  canContinue() { return this.timer > 0; }
  stop() { this.timer = 0; this.m.eating = 0; }
  tick() {
    this.timer = Math.max(0, this.timer - 1); this.m.eating = this.timer;
    if (this.timer === 4) {
      const m = this.m, x = Math.floor(m.x), y = Math.floor(m.y), z = Math.floor(m.z);
      if (World.getBlock(x, y, z) === BID.short_grass) { if (Game.rules.mobGriefing) Blocks.remove(x, y, z, null, true); m.ate(); }
      else if (World.getBlock(x, y - 1, z) === BID.grass_block) { if (Game.rules.mobGriefing) { Particles.blockBreak && Particles.blockBreak(x, y - 1, z, BID.grass_block, 0); World.setBlock(x, y - 1, z, BID.dirt, 0); } m.ate(); }
    }
  }
};
G.RangedBow = class extends Goal {
  constructor(m, speed, interval, range) { super(m, 'ML'); this.speed = speed; this.interval = interval; this.range = range; this.cool = -1; this.seen = 0; this.strafeT = -1; }
  canUse() { const t = this.m.target; return t && !t.dead && this.m.holdingBow(); }
  start() { this.m.aggressive = true; }
  stop() { this.m.aggressive = false; this.seen = 0; this.cool = -1; this.m.stopUsing(); this.m.nav.stop(); }
  tick() {
    const m = this.m, t = m.target; if (!t) return;
    const d2 = m.dist2(t.x, t.y, t.z), see = m.canSee(t);
    if (see !== this.seen > 0) this.seen = 0;
    if (see) this.seen++; else this.seen--;
    if (d2 <= this.range * this.range && this.seen >= 20) { m.nav.stop(); this.strafeT++; } else { m.nav.moveTo(t.x, t.y, t.z, this.speed); this.strafeT = -1; }
    if (this.strafeT >= 20) { if (Math.random() < 0.3) this.strafeCW = !this.strafeCW; if (Math.random() < 0.3) this.strafeBack = !this.strafeBack; this.strafeT = 0; }
    if (this.strafeT > -1) { m.strafe = this.strafeCW ? 0.5 : -0.5; m.forward = d2 > this.range * this.range * 0.75 ? 0.5 : d2 < this.range * this.range * 0.25 ? -0.5 : 0; m.yaw = Math.atan2(-(t.x - m.x), -(t.z - m.z)); }
    m.lookAt(t.x, t.eyeY, t.z, 30, 30);
    if (m.usingBow) {
      if (!see && this.seen < -60) m.stopUsing();
      else if (see) { const u = m.bowTicks; if (u >= 20) { m.stopUsing(); m.shootAt(t, Math.min(1, u / 20)); this.cool = this.interval; } }
    } else if (--this.cool <= 0 && this.seen >= -60) m.startUsingBow();
  }
};

// ---------------------------------------------------------------- the mob base class
class Mob extends Living {
  constructor(type, x, y, z) {
    super(type, x, y, z);
    const st = MOB_STATS[type] || [10, 0.25, 0, '0', 'creature'];
    this.maxHealth = this.health = st[0]; this.speed = st[1]; this.attackDamage = st[2]; this.xpSpec = st[3]; this.group = st[4];
    const md = MCDATA.entities[type]; if (md) { this.w = md[1]; this.h = md[2]; }
    this.goals = new GoalSelector(); this.targets = new GoalSelector(); this.nav = new Navigator(this);
    this.target = null; this.persistent = false; this.noActionTime = 0; this.living = true; this.hostile = this.group === 'monster';
    this.lookYaw = 0; this.lookPitch = 0; this.lookTarget = null; this.speedMod = 1; this.equip = { head: null, chest: null, legs: null, feet: null, main: null, off: null };
    this.armorPts = 0; this.lastHurtByPlayer = 0; this.stepHeight = 0.6; this.baby = false; this.inLove = 0; this.ageTicks = 0; this.bodyYaw = this.yaw;
    this.registerGoals();
  }
  registerGoals() {}
  get speedAttr() { return super.speedAttr * this.speedMod; }
  get undead() { return false; }
  // turn toward a point and walk (the game's move control: up to 90 degrees per tick, jump onto higher ground)
  moveControl(tx, ty, tz, speed) {
    const dx = tx - this.x, dz = tz - this.z, dy = ty - this.y;
    const want = Math.atan2(-dx, -dz);
    this.yaw = turnToward(this.yaw, want, Math.PI / 2);
    // like the game's MoveControl: the mob's forward input is its speed, so the push each tick is speed squared
    this.speedMod = speed; this.forward = this.speedAttr; this.strafe = 0;
    if ((dy > this.stepHeight && dx * dx + dz * dz < Math.max(1, this.w)) || (this.hitH && dy > -0.5 && this.onGround)) this.jumping = true;
  }
  // the head turns toward what the mob looks at (10 degrees per tick sideways by default)
  lookAt(x, y, z, yawSpeed, pitchSpeed) { this.lookTarget = [x, y, z, (yawSpeed || 10) * Math.PI / 180, (pitchSpeed || 40) * Math.PI / 180]; }
  tickLook() {
    const t = this.lookTarget;
    if (t) {
      const dx = t[0] - this.x, dy = t[1] - this.eyeY, dz = t[2] - this.z;
      this.lookYaw = turnToward(this.lookYaw, Math.atan2(-dx, -dz), t[3]);
      const want = -Math.atan2(dy, Math.hypot(dx, dz));
      this.pitch += Math.max(-t[4], Math.min(t[4], want - this.pitch));
      this.lookTarget = null;
    } else { this.lookYaw = turnToward(this.lookYaw, this.bodyYaw, 10 * Math.PI / 180); this.pitch *= 0.8; }
  }
  nearest(pred, range) {
    let best = null, bd = range * range;
    const p = Game.player; if (p && pred(p)) { const d = this.dist2(p.x, p.y, p.z); if (d < bd) { bd = d; best = p; } }
    for (const e of Entities.list) { if (e === this || e.removed || !pred(e)) continue; const d = this.dist2(e.x, e.y, e.z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  // line of sight from eye to eye through non-opaque blocks
  canSee(e) {
    const ax = this.x, ay = this.eyeY, az = this.z, bx = e.x, by = e.eyeY, bz = e.z;
    const d = Math.hypot(bx - ax, by - ay, bz - az); if (d > 128) return false;
    const h = Phys.raycast(ax, ay, az, (bx - ax) / d, (by - ay) / d, (bz - az) / d, d, id => OPAQUE[id] || (SOLID[id] && BLOCKS[id].model === 'cube'));
    return !h;
  }
  isSunny() { if (World.dim !== 'overworld') return false; const dt = ((Game.dayTime % 24000) + 24000) % 24000; if (dt >= 12542 && dt <= 23460) return false; if (Weather.rainingAt(this.x, this.y + 1, this.z) || this.inWater) return false; return World.skyLight(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z)) >= 15 && Math.random() * 30 < (World.getLight(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z)) >> 4) - 13 + 15 * 0 + 2; }
  burnsInDay() { if (!this.isSunny() || this.fireImmune || this.baby) return; const helm = this.equip.head; if (helm) { if (ITEMS[helm.id].dur && Math.random() < 0.05) { helm.dmg = (helm.dmg || 0) + 1 + rnd(2); if (helm.dmg >= ITEMS[helm.id].dur) this.equip.head = null; } return; } this.fireTicks = Math.max(this.fireTicks, 160); }
  heldItem() { return this.equip.main; }
  // ---------------------------------------------------------------- the tick
  tick() {
    this.tickBase();
    if (!this.dead) {
      this.noActionTime++;
      if (this.lastHurtByPlayer > 0) this.lastHurtByPlayer--;
      if (this.ageTicks !== undefined) { if (this.baby) { if (++this.ageTicks >= 0) this.growUp(); } else if (this.ageTicks > 0) this.ageTicks--; }
      if (this.inLove > 0) { this.inLove--; if (this.inLove % 10 === 0) Particles.heart && Particles.heart(this); }
      if (this.target && (this.target.dead || this.target.removed)) this.target = null;
      this.forward = 0; this.strafe = 0; this.jumping = false; this.speedMod = 1;
      this.targets.tick(this.age); this.goals.tick(this.age); this.nav.tick();
      this.aiStep && this.aiStep();
      this.tickLook();
    }
    this.tickLiving();
    this.headYaw = this.lookYaw;
    // the body keeps within 75 degrees of the head; standing still, it slowly turns to face where the head looks
    const moving = Math.hypot(this.x - this.px, this.z - this.pz) > 0.01;
    if (!moving) { const d = angleDiff(this.headYaw, this.bodyYaw); if (Math.abs(d) > 1.3) this.bodyYaw = this.headYaw - Math.sign(d) * 1.3; } else this.bodyYaw = turnToward(this.bodyYaw, this.yaw, 0.35);
    if (this.dead && this.deathTime >= 20 && !this.removed) { this.removed = true; Particles.poof && Particles.poof(this); this.dropXp(); }
    this.checkDespawn();
  }
  checkDespawn() {
    if (this.persistent || this.dead || this.customName || this.leashed || this.passengers.length) return;
    const p = Game.player; if (!p) return;
    const d2 = this.dist2(p.x, p.y, p.z);
    const canGo = this.hostile || this.group === 'ambient' || this.group === 'water_ambient' || this.despawnable;
    if (!canGo) return;
    if (d2 > 128 * 128) { this.removed = true; return; }
    if (this.noActionTime > 600 && d2 > 32 * 32 && rnd(800) === 0) this.removed = true;
    else if (d2 < 32 * 32) this.noActionTime = 0;
    if (Game.difficulty === 'peaceful' && this.hostile && !this.peacefulOk) this.removed = true;
  }
  // ---------------------------------------------------------------- damage and death
  hurt(amount, source, attacker) {
    if (this.dead || this.removed || amount <= 0 && source !== 'kill') return false;
    if (this.invulnerableTo && this.invulnerableTo(source, attacker)) return false;
    if (this.fireImmune && ['inFire', 'onFire', 'lava', 'hotFloor', 'fireball'].includes(source)) return false;
    this.noActionTime = 0;
    // inside the invulnerability window only a bigger hit counts, and only by the difference
    if (this.invul > 10) { if (amount <= this.lastDamage) return false; const extra = amount - this.lastDamage; this.lastDamage = amount; amount = extra; }
    else { this.lastDamage = amount; this.invul = 20; this.hurtTime = 10; }
    if (this.armorPts && !['outOfWorld', 'starve', 'magic', 'wither', 'drown', 'fall', 'kill'].includes(source)) amount *= 1 - Math.min(20, Math.max(this.armorPts / 5, this.armorPts - 4 * amount / 8)) / 25;
    const res = this.effect('resistance'); if (res) amount *= Math.max(0, 1 - 0.2 * (res.amp + 1));
    if (attacker) { this.lastHurtBy = attacker.owner || attacker; this.lastHurtTime = this.age; if (attacker.isPlayer || (attacker.owner && attacker.owner.isPlayer)) this.lastHurtByPlayer = 100; }
    this.health -= amount;
    if (this.onHurt) this.onHurt(amount, source, attacker);
    if (this.health <= 0) this.die(source, attacker);
    else Sound.play(this.type + '_hurt', this, { mob: this });
    return true;
  }
  heal(n) { if (!this.dead) this.health = Math.min(this.maxHealth, this.health + n); }
  knockback(strength, dx, dz) {
    strength *= 1 - (this.kbResist || 0); if (strength <= 0) return;
    const l = Math.hypot(dx, dz) || 1;
    this.vx = this.vx / 2 - dx / l * strength; this.vz = this.vz / 2 - dz / l * strength;
    if (this.onGround) this.vy = Math.min(0.4, this.vy / 2 + strength);
  }
  // melee: damage with the held weapon, knockback and fire aspect
  doHurtTarget(t) {
    let dmg = Game.scaleDamage(this.attackDamage);
    const w = this.equip.main; if (w && ITEMS[w.id].dmg > 1) dmg = Game.scaleDamage(this.attackDamage + ITEMS[w.id].dmg - 1);
    if (!t.isPlayer) dmg = this.attackDamage;
    if (dmg <= 0 && !t.isPlayer) return false;
    const ok = t.hurt(dmg, 'mob', this);
    if (ok) {
      const kb = (this.attackKnockback || 0); const yaw = this.yaw;
      if (kb > 0 && t.knockback) t.knockback(kb * 0.5, Math.sin(yaw), Math.cos(yaw));
      if (t.knockback && !kb) t.knockback(0.4, (this.x - t.x), (this.z - t.z));
      if (this.fireTicks > 0 && Game.difficulty !== 'peaceful' && Math.random() < 0.3 * (Game.difficulty === 'hard' ? 1 : 0.5)) t.fireTicks = Math.max(t.fireTicks, 2 * 20 * 4);
      if (this.onAttack) this.onAttack(t);
    }
    return ok;
  }
  die(source, attacker) {
    if (this.dead) return;
    this.dead = true; this.health = 0; this.deathTime = 0; this.goals.stopAll(); this.targets.stopAll(); this.nav.stop();
    Sound.play(this.type + '_death', this, { mob: this });
    this.killer = attacker;
    if (Game.rules.doMobLoot && !this.baby) this.dropLoot(source, attacker);
    if (attacker && attacker.isPlayer) Stats.add('killed', this.type);
    if (this.onDeath) this.onDeath(source, attacker);
    const k = attacker && (attacker.owner || attacker); if (k && k.onKill) k.onKill(this);
  }
  dropLoot(source, attacker) {
    const player = attacker && (attacker.isPlayer ? attacker : attacker.owner && attacker.owner.isPlayer ? attacker.owner : null);
    const held = player ? player.inv.held : null;
    const ctx = { byPlayer: this.lastHurtByPlayer > 0, looting: enchLevel(held, 'looting'), entity: this, killer: attacker, smelts: !!enchLevel(held, 'fire_aspect'), lightning: source === 'lightning', explosion: source === 'explosion' ? 0 : 0 };
    const table = this.lootTable ? this.lootTable() : 'entities/' + this.type;
    for (const s of LootTables.roll(table, ctx)) Drops.spawnItem(this.x, this.y + this.h / 2, this.z, s);
    // equipment drops: 8.5% each (+1% per looting level), only when killed by a player
    for (const k in this.equip) { const s = this.equip[k]; if (!s || this.equipNoDrop) continue; if (ctx.byPlayer && Math.random() < (this.dropChance ? this.dropChance[k] : 0.085) + 0.01 * ctx.looting) { const d = Object.assign({}, s); if (ITEMS[d.id].dur && !this.equipGuaranteed) d.dmg = Math.floor(ITEMS[d.id].dur - 1 - Math.random() * ITEMS[d.id].dur * 0.5 * Math.random()); Drops.spawnItem(this.x, this.y + 1, this.z, d); } }
    if (this.extraDrops) this.extraDrops(ctx);
  }
  xpValue() {
    const s = this.xpSpec;
    if (s === '1-3') return this.lastHurtByPlayer > 0 && !this.baby ? 1 + rnd(3) : 0;
    if (s === 'size') return this.size || 1;
    let n = +s || 0;
    if (this.hostile && n > 0) for (const k in this.equip) if (this.equip[k]) n += 1 + rnd(3);
    return this.lastHurtByPlayer > 0 ? n : 0;
  }
  dropXp() { if (!Game.rules.doMobLoot) return; const n = this.xpValue(); if (n > 0) Drops.spawnXp(this.x, this.y + 0.5, this.z, n); }
  // ---------------------------------------------------------------- breeding
  breedWith(q) {
    this.inLove = 0; q.inLove = 0; this.ageTicks = 6000; q.ageTicks = 6000;
    const baby = Mobs.create(this.type, this.x, this.y, this.z); if (!baby) return;
    baby.setBaby(); if (baby.inherit) baby.inherit(this, q);
    Entities.add(baby);
    Drops.spawnXp(this.x, this.y + 0.5, this.z, 1 + rnd(7));
    Stats.add('bred', this.type);
    Advancements.check && Advancements.check('breed', this.type);
  }
  setBaby() { this.baby = true; this.ageTicks = -24000; this.w0 = this.w0 || this.w; this.h0 = this.h0 || this.h; this.w = this.w0 / 2; this.h = this.h0 / 2; }
  growUp() { this.baby = false; this.ageTicks = 0; if (this.w0) { this.w = this.w0; this.h = this.h0; } }
  isFood(s) { return s && this.food && this.food.includes(ITEMS[s.id].name); }
  // right click on the mob with an item
  interact(p, s) {
    if (this.dead) return false;
    if (s && ITEMS[s.id].name === 'name_tag' && s.tag && s.tag.name) { this.customName = s.tag.name; this.persistent = true; if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } return true; }
    if (s && ITEMS[s.id].name === 'lead' && this.leashable && !this.leashed) { Leads.attach && Leads.attach(this, p); return true; }
    if (this.isFood(s) && this.food) {
      if (this.baby) { this.ageTicks = Math.min(0, this.ageTicks + Math.floor(-this.ageTicks / 10)); this.useFood(p, s); Particles.happy && Particles.happy(this); return true; }
      if (this.ageTicks === 0 && !this.inLove) { this.inLove = 600; this.useFood(p, s); Sound.play(this.type + '_eat', this); return true; }
    }
    if (this.onInteract) return this.onInteract(p, s);
    return false;
  }
  useFood(p, s) { if (!p.creative) { s.count--; if (s.count <= 0) p.inv.held = null; p.inv.changed(); } }
  // ---------------------------------------------------------------- saving
  save() {
    const d = { type: this.type, x: this.x, y: this.y, z: this.z, yaw: this.yaw, health: this.health, baby: this.baby, ageTicks: this.ageTicks, persistent: this.persistent, customName: this.customName || null, fire: this.fireTicks, equip: this.equip, effects: [...this.effects] };
    if (this.saveExtra) this.saveExtra(d);
    return d;
  }
  load(d) {
    this.yaw = this.bodyYaw = this.lookYaw = d.yaw || 0; this.health = d.health || this.maxHealth; if (d.baby) { this.setBaby(); this.ageTicks = d.ageTicks; } else this.ageTicks = d.ageTicks || 0;
    this.persistent = !!d.persistent; this.customName = d.customName; this.fireTicks = d.fire || 0; if (d.equip) Object.assign(this.equip, d.equip); this.effects = new Map(d.effects || []);
    if (this.loadExtra) this.loadExtra(d);
  }
}
// ---------------------------------------------------------------- shared kinds
class Animal extends Mob {
  constructor(type, x, y, z) { super(type, x, y, z); this.ageTicks = 0; }
  registerGoals() {
    const g = this.goals;
    g.add(0, new G.Float(this)); g.add(1, new G.Panic(this, 1.25)); g.add(2, new G.Breed(this, 1)); if (this.food) g.add(3, new G.Tempt(this, 1.2, this.food));
    g.add(4, new G.FollowParent(this, 1.1)); g.add(5, new G.RandomStroll(this, 1)); g.add(6, new G.LookAtPlayer(this, 6)); g.add(7, new G.RandomLookAround(this));
  }
  walkWeight(x, y, z) { return World.getBlock(x, y - 1, z) === BID.grass_block ? 10 : (World.lightLevel(x, y, z) - 7) * 0.1; }
}
class Monster extends Mob {
  constructor(type, x, y, z) { super(type, x, y, z); this.hostile = true; this.xpSpec = MOB_STATS[type] ? MOB_STATS[type][3] : '5'; }
  walkWeight(x, y, z) { return -World.lightLevel(x, y, z); }
  aiStep() { if (this.hostile && this.noActionTime < 600) { /* monsters age faster in light, like the game */ const l = World.lightLevel(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z)); if (l > 11) this.noActionTime += 2; } }
}
