'use strict';
/* Rails, minecarts, boats and riding, following the game's code.
   Rails: placed rails join up with their neighbours (curves and slopes) the way the game's RailState does it;
   powered rails pass power up to 8 rails along, detector rails turn on under a minecart and activator rails
   eject riders, prime TNT minecarts and stop hopper minecarts.
   Minecarts run along the track with the game's moveAlongTrack (speed up to 8 blocks a second, slopes,
   powered rail boost and braking); chest, hopper, TNT and furnace minecarts. Boats float, paddle and slide
   on ice like the game's Boat (and break into planks when they fall more than 3 blocks onto land); bamboo
   rafts and chest boats too. Players ride minecarts, boats, horses, donkeys, mules, camels, pigs (with a
   carrot on a stick) and striders (with a warped fungus on a stick); sneak to get off. */
const Rails = (() => {
  const B = BID;
  const NS = 0, EW = 1, AE = 2, AW = 3, AN = 4, AS = 5, SE = 6, SW = 7, NW = 8, NE = 9;
  const isRailId = id => BLOCKS[id].model === 'rail';
  const isRail = (x, y, z) => isRailId(World.getBlock(x, y, z));
  // the two blocks each shape joins (one is a step up for slopes)
  const CONN = [[[0, 0, -1], [0, 0, 1]], [[-1, 0, 0], [1, 0, 0]], [[-1, 0, 0], [1, 1, 0]], [[-1, 1, 0], [1, 0, 0]], [[0, 1, -1], [0, 0, 1]], [[0, 0, -1], [0, 1, 1]], [[1, 0, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, -1]], [[1, 0, 0], [0, 0, -1]]];
  // where a minecart enters and leaves each shape (the game's EXITS)
  const EXITS = [[[0, 0, -1], [0, 0, 1]], [[-1, 0, 0], [1, 0, 0]], [[-1, -1, 0], [1, 0, 0]], [[-1, 0, 0], [1, -1, 0]], [[0, 0, -1], [0, -1, 1]], [[0, -1, -1], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, 1], [-1, 0, 0]], [[0, 0, -1], [-1, 0, 0]], [[0, 0, -1], [1, 0, 0]]];
  const ascending = s => s >= 2 && s <= 5;
  // ---------------------------------------------------------------- the game's RailState
  class RS {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; this.id = World.getBlock(x, y, z); this.st = World.getState(x, y, z); this.straight = this.id !== B.rail; this.setConns(this.st & 15); }
    setConns(shape) { this.conns = (CONN[shape] || CONN[0]).map(c => [this.x + c[0], this.y + c[1], this.z + c[2]]); }
    removeSoft() { for (let i = 0; i < this.conns.length; i++) { const r = getRail(...this.conns[i]); if (r && r.connectsTo(this)) this.conns[i] = [r.x, r.y, r.z]; else this.conns.splice(i--, 1); } }
    hasConn(x, z) { return this.conns.some(c => c[0] === x && c[2] === z); }
    connectsTo(o) { return this.hasConn(o.x, o.z); }
    count() { let n = 0; for (let f = 2; f < 6; f++) if (hasRail(this.x + DX[f], this.y, this.z + DZ[f])) n++; return n; }
    canConnectTo(o) { return this.connectsTo(o) || this.conns.length !== 2; }
    setShape(shape) { this.st = (this.st & ~15) | shape; World.setBlock(this.x, this.y, this.z, this.id, this.st); }
    connectTo(o) {
      this.conns.push([o.x, o.y, o.z]);
      const { x, y, z } = this, n = this.hasConn(x, z - 1), s = this.hasConn(x, z + 1), w = this.hasConn(x - 1, z), e = this.hasConn(x + 1, z);
      let shape = null;
      if (n || s) shape = NS;
      if (w || e) shape = EW;
      if (!this.straight) { if (s && e && !n && !w) shape = SE; if (s && w && !n && !e) shape = SW; if (n && w && !s && !e) shape = NW; if (n && e && !s && !w) shape = NE; }
      if (shape === NS) { if (isRail(x, y + 1, z - 1)) shape = AN; if (isRail(x, y + 1, z + 1)) shape = AS; }
      if (shape === EW) { if (isRail(x + 1, y + 1, z)) shape = AE; if (isRail(x - 1, y + 1, z)) shape = AW; }
      if (shape === null) shape = NS;
      this.setShape(shape);
    }
    hasNeighborRail(x, y, z) { const r = getRail(x, y, z); if (!r) return false; r.removeSoft(); return r.canConnectTo(this); }
    place(powered, always, def) {
      const { x, y, z } = this;
      const n = this.hasNeighborRail(x, y, z - 1), s = this.hasNeighborRail(x, y, z + 1), w = this.hasNeighborRail(x - 1, y, z), e = this.hasNeighborRail(x + 1, y, z);
      let shape = null;
      const ns = n || s, ew = w || e;
      if (ns && !ew) shape = NS;
      if (ew && !ns) shape = EW;
      const se = s && e, sw = s && w, ne = n && e, nw = n && w;
      if (!this.straight) { if (se && !n && !w) shape = SE; if (sw && !n && !e) shape = SW; if (nw && !s && !e) shape = NW; if (ne && !s && !w) shape = NE; }
      if (shape === null) {
        if (ns && ew) shape = def; else if (ns) shape = NS; else if (ew) shape = EW;
        if (!this.straight) {
          if (powered) { if (se) shape = SE; if (sw) shape = SW; if (ne) shape = NE; if (nw) shape = NW; }
          else { if (nw) shape = NW; if (ne) shape = NE; if (sw) shape = SW; if (se) shape = SE; }
        }
      }
      if (shape === NS) { if (isRail(x, y + 1, z - 1)) shape = AN; if (isRail(x, y + 1, z + 1)) shape = AS; }
      if (shape === EW) { if (isRail(x + 1, y + 1, z)) shape = AE; if (isRail(x - 1, y + 1, z)) shape = AW; }
      if (shape === null) shape = def;
      this.setConns(shape);
      if (always || (this.st & 15) !== shape) {
        this.setShape(shape);
        for (const c of this.conns.slice()) { const r = getRail(...c); if (r) { r.removeSoft(); if (r.canConnectTo(this)) r.connectTo(this); } }
      }
      return this;
    }
  }
  function getRail(x, y, z) { for (const dy of [0, 1, -1]) if (isRail(x, y + dy, z)) return new RS(x, y + dy, z); return null; }
  const hasRail = (x, y, z) => isRail(x, y, z) || isRail(x, y + 1, z) || isRail(x, y - 1, z);
  // ---------------------------------------------------------------- placing
  function shapeFor(x, y, z, L) { return L === 4 || L === 5 ? EW : NS; }
  function placed(x, y, z) {
    if (!isRail(x, y, z)) return;
    const r = new RS(x, y, z);
    r.place(Redstone.powered(x, y, z), true, r.st & 15);
    if (World.getBlock(x, y, z) !== B.rail) powerCheck(x, y, z, r.id, World.getState(x, y, z));
  }
  // ---------------------------------------------------------------- power
  // the game's PoweredRailBlock.findPoweredRailSignal: up to 8 rails along the track
  function findSignal(x, y, z, st, forward, depth) {
    if (depth >= 8) return false;
    let i = x, j = y, k = z, flat = true, shape = st & 15;
    switch (shape) {
      case NS: if (forward) k++; else k--; break;
      case EW: if (forward) i--; else i++; break;
      case AE: if (forward) i--; else { i++; j++; flat = false; } shape = EW; break;
      case AW: if (forward) { i--; j++; flat = false; } else i++; shape = EW; break;
      case AN: if (forward) k++; else { k--; j++; flat = false; } shape = NS; break;
      case AS: if (forward) { k++; j++; flat = false; } else k--; shape = NS; break;
    }
    const id = World.getBlock(x, y, z);
    return samePowered(id, i, j, k, forward, depth, shape) || (flat && samePowered(id, i, j - 1, k, forward, depth, shape));
  }
  function samePowered(id, x, y, z, forward, depth, shape) {
    if (World.getBlock(x, y, z) !== id) return false;
    const st = World.getState(x, y, z), s = st & 15;
    if (shape === EW && (s === NS || s === AN || s === AS)) return false;
    if (shape === NS && (s === EW || s === AE || s === AW)) return false;
    if (!(st & 16)) return false;
    return Redstone.powered(x, y, z) || findSignal(x, y, z, st, forward, depth + 1);
  }
  function powerCheck(x, y, z, id, st) {
    if (id === B.rail) {
      // a junction of three rails switches its curve when the redstone next to it changes
      const r = new RS(x, y, z);
      if (r.count() === 3) r.place(Redstone.powered(x, y, z), false, st & 15);
      return;
    }
    if (id !== B.powered_rail && id !== B.activator_rail) return;
    const was = !!(st & 16);
    const now = Redstone.powered(x, y, z) || findSignal(x, y, z, st, true, 0) || findSignal(x, y, z, st, false, 0);
    if (now !== was) { World.setBlock(x, y, z, id, (st & ~16) | (now ? 16 : 0)); Redstone.region(x, y, z); if (ascending(st & 15)) Redstone.region(x, y + 1, z); }
  }
  // ---------------------------------------------------------------- detector rails
  const cartBox = (x, y, z) => [x + 0.2, y, z + 0.2, x + 0.8, y + 0.8, z + 0.8];
  function cartsOn(x, y, z) { const b = cartBox(x, y, z); return Entities.list.filter(e => e instanceof Minecart && !e.removed && e.intersects(b)); }
  function detectorCheck(x, y, z) {
    const st = World.getState(x, y, z), was = !!(st & 16), now = cartsOn(x, y, z).length > 0;
    if (now !== was) { World.setBlock(x, y, z, B.detector_rail, (st & ~16) | (now ? 16 : 0)); Redstone.update(x, y, z); Redstone.update(x, y - 1, z); }
    if (now) Ticks.schedule(x, y, z, 20);
    Redstone.analogChanged(x, y, z);
  }
  function detectorTick(x, y, z, id, st) { if (st & 16) detectorCheck(x, y, z); }
  function detectorTouch(x, y, z) { if (!(World.getState(x, y, z) & 16)) detectorCheck(x, y, z); }
  // a comparator next to a detector rail reads the minecart's contents
  function detectorSignal(x, y, z) { const c = cartsOn(x, y, z).find(e => e.items); if (!c) return -1; let f = 0, any = false; for (const s of c.items) if (s) { f += s.count / maxStack(s); any = true; } f /= c.items.length; return any ? Math.floor(f * 14) + 1 : 0; }
  return { NS, EW, CONN, EXITS, ascending, isRail, isRailId, shapeFor, placed, powerCheck, detectorTick, detectorTouch, detectorSignal, getRail };
})();

/* ---------------------------------------------------------------- minecarts */
class Minecart extends Entity {
  constructor(kind, x, y, z) {
    super(kind, x, y, z);
    this.kind = kind; this.w = 0.98; this.h = 0.7; this.stepHeight = 0;
    this.damage = 0; this.shake = 0; this.shakeDir = 1; this.flipped = false; this.onRails = false;
    this.seatY = 0.1875; this.model = 'minecart'; this.bodyYaw = this.pbodyYaw = 0;
    this.railPitch = 0; this.prailPitch = 0;
    if (kind === 'chest_minecart') this.items = new Array(27).fill(null);
    if (kind === 'hopper_minecart') { this.items = new Array(5).fill(null); this.hopperOn = true; this.cool = 0; }
    if (kind === 'furnace_minecart') { this.fuel = 0; this.pushX = 0; this.pushZ = 0; }
    if (kind === 'tnt_minecart') this.fuse = -1;
    this.display = { chest_minecart: ['chest', 8], hopper_minecart: ['hopper', 1], tnt_minecart: ['tnt', 6], furnace_minecart: ['furnace', 6] }[kind] || null;
  }
  get maxSpeed() { return (this.inWater ? (this.kind === 'furnace_minecart' ? 3 : 4) : (this.kind === 'furnace_minecart' ? 4 : 8)) / 20; }
  get isVehicle() { return this.passengers.length > 0; }
  // the point on the track for a position, like the game's getPos
  railPos(x, y, z) {
    const i = Math.floor(x); let j = Math.floor(y); const k = Math.floor(z);
    if (Rails.isRail(i, j - 1, k)) j--;
    if (!Rails.isRail(i, j, k)) return null;
    const ex = Rails.EXITS[World.getState(i, j, k) & 15] || Rails.EXITS[0], a = ex[0], b = ex[1];
    const d0 = i + 0.5 + a[0] * 0.5, d1 = j + 0.0625 + a[1] * 0.5, d2 = k + 0.5 + a[2] * 0.5;
    const d3 = i + 0.5 + b[0] * 0.5, d4 = j + 0.0625 + b[1] * 0.5, d5 = k + 0.5 + b[2] * 0.5;
    const d6 = d3 - d0, d7 = (d4 - d1) * 2, d8 = d5 - d2;
    let t;
    if (d6 === 0) t = z - k; else if (d8 === 0) t = x - i; else t = ((x - d0) * d6 + (z - d2) * d8) * 2;
    x = d0 + d6 * t; y = d1 + d7 * t; z = d2 + d8 * t;
    if (d7 < 0) y += 1; else if (d7 > 0) y += 0.5;
    return [x, y, z];
  }
  tick() {
    this.tickBase();
    if (this.shake > 0) this.shake--;
    if (this.damage > 0) this.damage--;
    if (this.y < MINY - 64) { this.removed = true; return; }
    this.vy -= 0.04;
    const i = Math.floor(this.x); let j = Math.floor(this.y); const k = Math.floor(this.z);
    if (Rails.isRail(i, j - 1, k)) j--;
    const id = World.getBlock(i, j, k);
    this.onRails = Rails.isRailId(id);
    this.prailPitch = this.railPitch;
    if (this.onRails) {
      this.moveAlongTrack(i, j, k, id, World.getState(i, j, k));
      if (id === BID.activator_rail) this.activate(!!(World.getState(i, j, k) & 16));
      if (id === BID.detector_rail) Rails.detectorTouch(i, j, k);
    } else this.offTrack();
    // facing: the way it moves (turned round when it reverses)
    const dx = this.px - this.x, dz = this.pz - this.z;
    this.pbodyYaw = this.bodyYaw;
    if (dx * dx + dz * dz > 0.001) { let yaw = Math.atan2(dz, -dx) + Math.PI; if (this.flipped) yaw += Math.PI; this.bodyYaw = yaw; }
    { const d = ((this.bodyYaw - this.pbodyYaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; if (Math.abs(d) >= Math.PI * 170 / 180) { this.bodyYaw += Math.PI; this.flipped = !this.flipped; } }
    this.yaw = this.bodyYaw;
    this.collide();
    if (this.inLava) { this.fireTicks = 300; this.hurtCart(1); }
    this.kindTick();
  }
  moveAlongTrack(bx, by, bz, id, st) {
    this.fallDistance = 0;
    let x = this.x, y = this.y, z = this.z;
    const before = this.railPos(x, y, z);
    y = by;
    let boost = false, brake = false;
    if (id === BID.powered_rail) { boost = !!(st & 16); brake = !boost; }
    let slope = 0.0078125; if (this.inWater) slope *= 0.2;
    const shape = st & 15;
    switch (shape) { case 2: this.vx -= slope; y++; break; case 3: this.vx += slope; y++; break; case 4: this.vz += slope; y++; break; case 5: this.vz -= slope; y++; break; }
    const [a, b] = Rails.EXITS[shape] || Rails.EXITS[0];
    let d4 = b[0] - a[0], d5 = b[2] - a[2];
    const d6 = Math.hypot(d4, d5);
    if (this.vx * d4 + this.vz * d5 < 0) { d4 = -d4; d5 = -d5; }
    const sp = Math.min(2, Math.hypot(this.vx, this.vz));
    this.vx = sp * d4 / d6; this.vz = sp * d5 / d6;
    // a rider walking pushes a slow cart
    const r = this.passengers[0];
    if (r && r.isPlayer) {
      const f = r.forward || 0, s = r.strafe || 0;
      if ((f || s) && this.vx * this.vx + this.vz * this.vz < 0.01) { const yaw = r.yaw, ix = -Math.sin(yaw) * f - Math.cos(yaw) * s, iz = -Math.cos(yaw) * f + Math.sin(yaw) * s; this.vx += ix * 0.01; this.vz += iz * 0.01; brake = false; }
    }
    if (brake) { const h = Math.hypot(this.vx, this.vz); if (h < 0.03) { this.vx = this.vy = this.vz = 0; } else { this.vx *= 0.5; this.vz *= 0.5; this.vy = 0; } }
    const d23 = bx + 0.5 + a[0] * 0.5, d10 = bz + 0.5 + a[2] * 0.5, d12 = bx + 0.5 + b[0] * 0.5, d13 = bz + 0.5 + b[2] * 0.5;
    d4 = d12 - d23; d5 = d13 - d10;
    let t;
    if (d4 === 0) t = z - bz; else if (d5 === 0) t = x - bx; else t = ((x - d23) * d4 + (z - d10) * d5) * 2;
    x = d23 + d4 * t; z = d10 + d5 * t;
    this.x = x; this.y = y; this.z = z;
    const k = this.isVehicle ? 0.75 : 1, max = this.maxSpeed;
    Phys.move(this, Math.max(-max, Math.min(max, k * this.vx)), 0, Math.max(-max, Math.min(max, k * this.vz)));
    if (a[1] !== 0 && Math.floor(this.x) - bx === a[0] && Math.floor(this.z) - bz === a[2]) this.y += a[1];
    else if (b[1] !== 0 && Math.floor(this.x) - bx === b[0] && Math.floor(this.z) - bz === b[2]) this.y += b[1];
    this.slowdown();
    const after = this.railPos(this.x, this.y, this.z);
    if (after && before) {
      const dy = (before[1] - after[1]) * 0.05, h = Math.hypot(this.vx, this.vz);
      if (h > 0) { this.vx *= (h + dy) / h; this.vz *= (h + dy) / h; }
      this.y = after[1];
    }
    const nx = Math.floor(this.x), nz = Math.floor(this.z);
    if (nx !== bx || nz !== bz) { const h = Math.hypot(this.vx, this.vz); this.vx = h * (nx - bx); this.vz = h * (nz - bz); }
    if (boost) {
      const h = Math.hypot(this.vx, this.vz);
      if (h > 0.01) { this.vx += this.vx / h * 0.06; this.vz += this.vz / h * 0.06; }
      else if (shape === Rails.EW) { if (Redstone.condAt(bx - 1, by, bz)) this.vx = 0.02; else if (Redstone.condAt(bx + 1, by, bz)) this.vx = -0.02; }
      else if (shape === Rails.NS) { if (Redstone.condAt(bx, by, bz - 1)) this.vz = 0.02; else if (Redstone.condAt(bx, by, bz + 1)) this.vz = -0.02; }
    }
    this.vy = 0;
    this.railPitch = Rails.ascending(shape) ? Math.PI / 4 * (shape === 2 || shape === 5 ? 1 : -1) : 0;
    this.railShape = shape;
  }
  slowdown() {
    if (this.kind === 'furnace_minecart') {
      const d = Math.hypot(this.pushX, this.pushZ);
      if (d > 1e-4 * 0.03) { this.pushX /= d; this.pushZ /= d; this.vx = this.vx * 0.8 + this.pushX * 0.05; this.vz = this.vz * 0.8 + this.pushZ * 0.05; }
      else { this.vx *= 0.98; this.vz *= 0.98; }
    }
    const f = this.isVehicle ? 0.997 : 0.96;
    this.vx *= f; this.vz *= f;
    if (this.inWater) { this.vx *= 0.95; this.vz *= 0.95; }
  }
  offTrack() {
    const max = this.maxSpeed;
    this.vx = Math.max(-max, Math.min(max, this.vx)); this.vz = Math.max(-max, Math.min(max, this.vz));
    if (this.onGround) { this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5; }
    Phys.move(this, this.vx, this.vy, this.vz);
    if (!this.onGround) { this.vx *= 0.95; this.vy *= 0.95; this.vz *= 0.95; }
    this.railPitch = 0;
  }
  // minecarts bump each other and pick up mobs that walk into an empty cart
  collide() {
    const b = this.bb(); b[0] -= 0.2; b[2] -= 0.2; b[3] += 0.2; b[5] += 0.2;
    const fast = this.vx * this.vx + this.vz * this.vz > 0.01;
    for (const e of Entities.list.concat(Game.player ? [Game.player] : [])) {
      if (!e || e === this || e.removed || e.dead || e.ghost || e.vehicle || this.passengers.includes(e) || !e.intersects(b)) continue;
      if (this.kind === 'minecart' && fast && e.living && !e.isPlayer && e.type !== 'iron_golem' && !this.isVehicle && e.w < 1.5) { Vehicles.mount(e, this); continue; }
      if (e instanceof Minecart || e.living || e.isPlayer) {
        const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.01) continue;
        const k = Math.min(1, 1 / d) * 0.05;
        if (e instanceof Minecart) { const avx = (this.vx + e.vx) / 2, avz = (this.vz + e.vz) / 2; this.vx = avx - dx / d * 0.05; this.vz = avz - dz / d * 0.05; e.vx = avx + dx / d * 0.05; e.vz = avz + dz / d * 0.05; }
        else if (!e.isPlayer || !e.spectator) { e.vx += dx / d * k; e.vz += dz / d * k; this.vx -= dx / d * k * 0.5; this.vz -= dz / d * k * 0.5; }
      }
    }
  }
  activate(powered) {
    if (this.kind === 'minecart' && powered && this.passengers.length) { for (const r of this.passengers.slice()) Vehicles.dismount(r); this.shake = 10; this.shakeDir = -this.shakeDir; this.damage = 50; }
    if (this.kind === 'tnt_minecart' && powered && this.fuse < 0) this.prime();
    if (this.kind === 'hopper_minecart') this.hopperOn = !powered;
  }
  prime() { this.fuse = 80; Sound.play('tnt_primed', this); }
  explode(speed2) { this.removed = true; Explosions.explode(this.x, this.y, this.z, 4 + Math.random() * 1.5 * Math.min(5, Math.sqrt(speed2 || 0)), false, this, true); }
  kindTick() {
    if (this.kind === 'furnace_minecart') {
      if (this.fuel > 0) this.fuel--;
      if (this.fuel <= 0) { this.pushX = this.pushZ = 0; }
      else if (this.onRails && Math.hypot(this.vx, this.vz) > 0.001) { const h = Math.hypot(this.vx, this.vz), d = Math.hypot(this.pushX, this.pushZ); if (d > 0.01) { this.pushX = this.vx / h * d; this.pushZ = this.vz / h * d; } }
      if (this.fuel > 0 && Math.random() < 0.25) Particles.smokeAt(this.x, this.y + 0.8, this.z, 0, 0.05, 0, true);
    }
    if (this.kind === 'tnt_minecart' && this.fuse >= 0) { if (--this.fuse <= 0) this.explode(this.vx * this.vx + this.vz * this.vz); else Particles.smokeAt(this.x, this.y + 0.5, this.z, 0, 0, 0); }
    if (this.kind === 'hopper_minecart' && this.hopperOn && --this.cool <= 0) {
      // pull from the container above or pick up items around
      const x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z);
      let moved = false;
      const src = Containers.at(x, y + 1, z);
      if (src && src.slots) { for (const i of src.slots(0)) { const s = src.get(i); if (!s || !src.canTake(i, s, 0)) continue; if (Vehicles.insertOne(this.items, s)) { s.count--; src.set(i, s.count > 0 ? s : null); src.changed(); moved = true; break; } } }
      if (!moved) { const b = this.bb(); b[1] -= 0.25; b[4] += 0.25; b[0] -= 0.25; b[2] -= 0.25; b[3] += 0.25; b[5] += 0.25; for (const e of Entities.list) { if (e.type !== 'item' || e.removed || !e.intersects(b)) continue; let any = false; while (e.stack.count > 0 && Vehicles.insertOne(this.items, e.stack)) { e.stack.count--; any = true; } if (e.stack.count <= 0) e.removed = true; if (any) { moved = true; break; } } }
      if (moved) this.cool = 4;
    }
  }
  hurtCart(n, attacker) {
    this.shakeDir = -this.shakeDir; this.shake = 10; this.damage += n * 10;
    const creative = attacker && attacker.isPlayer && attacker.creative;
    if (creative || this.damage > 40) { for (const r of this.passengers.slice()) Vehicles.dismount(r); this.destroy(!creative); }
  }
  hurt(n, src, attacker) {
    if (this.removed) return false;
    if (this.kind === 'tnt_minecart' && (src === 'onFire' || src === 'lava' || src === 'inFire' || src === 'explosion' || (attacker && attacker.fireTicks > 0 && attacker instanceof Projectile))) { this.explode(this.vx * this.vx + this.vz * this.vz); return true; }
    if (src === 'onFire' || src === 'inFire') return false;
    this.hurtCart(n, attacker);
    return true;
  }
  destroy(drop) {
    this.removed = true;
    if (!drop || !Game.rules.doEntityDrops) return;
    Drops.spawnItem(this.x, this.y + 0.3, this.z, stack(this.kind));
    if (this.items) for (const s of this.items) if (s) Drops.spawnItem(this.x, this.y + 0.3, this.z, s, true);
  }
  interact(p, s) {
    if (p.sneaking && !this.items && this.kind !== 'furnace_minecart') return false;
    if (this.kind === 'minecart') { if (!this.isVehicle && !p.vehicle) { Vehicles.mount(p, this); return true; } return false; }
    if (this.kind === 'furnace_minecart') {
      const n = s ? ITEMS[s.id].name : '';
      if ((n === 'coal' || n === 'charcoal') && this.fuel + 3600 <= 32000) { if (!p.creative) { s.count--; if (!s.count) p.inv.held = null; } this.fuel += 3600; }
      if (this.fuel > 0) { this.pushX = this.x - p.x; this.pushZ = this.z - p.z; }
      return true;
    }
    if (this.items) { Screens.open(new ChestScreen(this.items, this.kind === 'hopper_minecart' ? 1 : 3, ITEMS[IID[this.kind]].display, this.kind === 'hopper_minecart' ? { cols: 5, hopper: true } : {})); return true; }
    return false;
  }
  // drawn tilted on slopes, shaken when hit, with its block inside
  posePart(inst, s, a) {
    const r = inst.root;
    r.rotation.z = this.prailPitch + (this.railPitch - this.prailPitch) * a;
    const t = this.shake - a, dmg = Math.max(0, this.damage - a);
    r.rotation.x = t > 0 ? Math.sin(t) * t * dmg / 10 * this.shakeDir * Math.PI / 180 : 0;
    inst.body.position.y = 0.375;
    if (this.display && !inst.displayBlock) {
      const m = ItemMesh.blockMesh(BID[this.display[0]], this.display[0] === 'furnace' ? 2 | (this.fuel > 0 ? 8 : 0) : this.display[0] === 'hopper' ? 0 : 2);
      if (m) { const g = new THREE.Group(); m.scale.setScalar(0.75); m.position.set(-0.375, (this.display[1] - 8) / 16 * 0.75 + 0.375 + 0.0625, -0.375); g.add(m); r.add(g); inst.displayBlock = m; }
    }
    if (inst.displayBlock && inst.displayBlock.material && inst.displayBlock.material.uniforms) { const [sl, bl] = EntityRender.lightAt(this.x, this.y + 0.5, this.z); inst.displayBlock.material.uniforms.uEnv.value.set(sl, bl); }
  }
  save() { return { type: this.kind, vehicle: 'minecart', x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, vz: this.vz, items: this.items || null, fuel: this.fuel || 0, pushX: this.pushX || 0, pushZ: this.pushZ || 0, fuse: this.fuse === undefined ? -1 : this.fuse, name: this.customName || null }; }
}

/* ---------------------------------------------------------------- boats */
class Boat extends Entity {
  constructor(item, x, y, z, yaw) {
    super(item.includes('chest') ? 'chest_boat' : 'boat', x, y, z);
    this.item = item; this.wood = item.replace(/_chest_(boat|raft)$|_(boat|raft)$/, ''); this.raft = item.endsWith('_raft'); this.chest = item.includes('chest');
    this.w = 1.375; this.h = 0.5625; this.stepHeight = 0;
    this.yaw = this.pyaw = this.bodyYaw = this.pbodyYaw = yaw || 0;
    this.damage = 0; this.shake = 0; this.shakeDir = 1; this.deltaRot = 0; this.status = 'land'; this.oldStatus = 'land'; this.waterLevel = 0; this.landFriction = 0.6;
    this.outOfControl = 0; this.paddle = [0, 0]; this.paddling = [false, false];
    this.model = (this.raft ? 'raft' : 'boat') + (this.chest ? '_chest_' : '_') + this.wood;
    if (this.chest) this.items = new Array(27).fill(null);
    this.seatY = this.raft ? 0.5 : 0.1875;
  }
  get maxPassengers() { return this.chest ? 1 : 2; }
  waterHeight(x, y, z) {
    const id = World.getBlock(x, y, z), d = BLOCKS[id];
    const water = d.fluid === 'water' || d.fluidLog || (d.waterlog && (World.getState(x, y, z) & 128));
    if (!water) return -1;
    if (!d.fluid) return 1;
    const above = BLOCKS[World.getBlock(x, y + 1, z)];
    if (above.fluid === 'water' || above.fluidLog) return 1;
    const lvl = World.getState(x, y, z) & 7;
    return (8 - lvl) / 9;
  }
  // the game's Boat.getStatus
  getStatus() {
    const b = this.bb();
    // under water
    const top = b[4] + 0.001;
    let under = false;
    for (let x = Math.floor(b[0]); x < Math.ceil(b[3]); x++) for (let y = Math.floor(b[4]); y < Math.ceil(top); y++) for (let z = Math.floor(b[2]); z < Math.ceil(b[5]); z++) {
      const h = this.waterHeight(x, y, z); if (h < 0) continue;
      if (top < y + h) { if (BLOCKS[World.getBlock(x, y, z)].fluid && (World.getState(x, y, z) & 7) !== 0) return 'flowing'; under = true; }
    }
    if (under) return 'under';
    // in water
    let inWater = false; this.waterLevel = -1e9;
    for (let x = Math.floor(b[0]); x < Math.ceil(b[3]); x++) for (let y = Math.floor(b[1]); y < Math.ceil(b[1] + 0.001); y++) for (let z = Math.floor(b[2]); z < Math.ceil(b[5]); z++) {
      const h = this.waterHeight(x, y, z); if (h < 0) continue;
      const f = y + h; this.waterLevel = Math.max(f, this.waterLevel); if (b[1] < f) inWater = true;
    }
    if (inWater) return 'water';
    const g = this.groundFriction();
    if (g > 0) { this.landFriction = g; return 'land'; }
    return 'air';
  }
  groundFriction() {
    const b = this.bb(), y = Math.floor(b[1] - 0.001);
    let f = 0, n = 0;
    for (let x = Math.floor(b[0]); x < Math.ceil(b[3]); x++) for (let z = Math.floor(b[2]); z < Math.ceil(b[5]); z++) {
      const id = World.getBlock(x, y, z);
      if (!SOLID[id] || id === BID.lily_pad) continue;
      f += BLOCKS[id].slip; n++;
    }
    return n ? f / n : 0;
  }
  tick() {
    this.tickBase();
    this.pbodyYaw = this.bodyYaw;
    this.oldStatus = this.status; this.status = this.getStatus();
    if (this.status === 'under' || this.status === 'flowing') this.outOfControl++; else this.outOfControl = 0;
    if (this.outOfControl >= 60) for (const r of this.passengers.slice()) Vehicles.dismount(r);
    if (this.shake > 0) this.shake--;
    if (this.damage > 0) this.damage--;
    const driver = this.passengers[0];
    if (!(driver && driver.isPlayer)) this.paddling = [false, false];
    this.float();
    if (driver && driver.isPlayer) this.control(driver);
    const y0 = this.y;
    Phys.move(this, this.vx, this.vy, this.vz);
    // the game's checkFallDamage: a landing breaks the boat only when it was already "on land" at the start of
    // the tick, which in practice happens only from a few exact heights
    if (this.onGround) { if (this.fallDistance > 3 && this.status === 'land') { this.breakApart(); return; } this.fallDistance = 0; }
    else if (this.y < y0 && BLOCKS[World.getBlock(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z))].fluid !== 'water') this.fallDistance += y0 - this.y;
    for (let i = 0; i < 2; i++) if (this.paddling[i]) this.paddle[i] += Math.PI / 8; else this.paddle[i] = 0;
    this.bodyYaw = this.yaw - Math.PI / 2;
    // lily pads break against boats; mobs bumping into a free seat get in
    const b = this.bb();
    for (let x = Math.floor(b[0]); x <= Math.floor(b[3]); x++) for (let z = Math.floor(b[2]); z <= Math.floor(b[5]); z++) for (let y = Math.floor(b[1]); y <= Math.floor(b[4]); y++) if (World.getBlock(x, y, z) === BID.lily_pad) { Drops.dropBlock(BID.lily_pad, 0, null, x, y, z); World.setBlock(x, y, z, 0, 0); }
    b[0] -= 0.2; b[2] -= 0.2; b[3] += 0.2; b[5] += 0.2; b[1] += 0.01; b[4] -= 0.01;
    for (const e of Entities.list) {
      if (e === this || e.removed || e.dead || e.vehicle || !e.living || e.isPlayer || !e.intersects(b)) continue;
      if (this.passengers.length < this.maxPassengers && !(driver && driver.isPlayer) && e.w <= 1.4 && !['squid', 'glow_squid', 'dolphin', 'cod', 'salmon', 'tropical_fish', 'pufferfish', 'axolotl', 'tadpole'].includes(e.type)) Vehicles.mount(e, this);
      else { const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz) || 1; e.vx += dx / d * 0.05; e.vz += dz / d * 0.05; }
    }
  }
  float() {
    let g = -0.04, lift = 0, fr = 0.05;
    if (this.oldStatus === 'air' && this.status !== 'air' && this.status !== 'land') {
      this.y = this.waterLevelAbove() - this.h + 0.101; this.vy = 0; this.status = 'water';
      return;
    }
    if (this.status === 'water') { lift = (this.waterLevel - this.y) / this.h; fr = 0.9; }
    else if (this.status === 'flowing') { g = -7e-4; fr = 0.9; }
    else if (this.status === 'under') { lift = 0.01; fr = 0.45; }
    else if (this.status === 'air') fr = 0.9;
    else if (this.status === 'land') { fr = this.landFriction; if (this.passengers[0] && this.passengers[0].isPlayer) this.landFriction /= 2; }
    this.vx *= fr; this.vy += g; this.vz *= fr;
    this.deltaRot *= fr;
    if (lift > 0) this.vy = (this.vy + lift * 0.06153846016296973) * 0.75;
  }
  waterLevelAbove() {
    const b = this.bb(); let lvl = Math.floor(b[4]);
    for (let y = lvl; y < lvl + 3; y++) {
      let best = 0, found = false;
      for (let x = Math.floor(b[0]); x < Math.ceil(b[3]); x++) for (let z = Math.floor(b[2]); z < Math.ceil(b[5]); z++) { const h = this.waterHeight(x, y, z); if (h >= 0) { found = true; best = Math.max(best, h); } }
      if (!found || best < 1) return y + best;
    }
    return lvl + 1;
  }
  control(p) {
    const left = p.strafe > 0, right = p.strafe < 0, up = p.forward > 0, down = p.forward < 0;
    let f = 0;
    if (left) this.deltaRot += Math.PI / 180;
    if (right) this.deltaRot -= Math.PI / 180;
    if (right !== left && !up && !down) f += 0.005;
    this.yaw += this.deltaRot;
    if (up) f += 0.04;
    if (down) f -= 0.005;
    this.vx += -Math.sin(this.yaw) * f; this.vz += -Math.cos(this.yaw) * f;
    this.paddling = [(right && !left) || up, (left && !right) || up];
  }
  breakApart() {
    this.removed = true;
    for (const r of this.passengers.slice()) Vehicles.dismount(r);
    if (!Game.rules.doEntityDrops) return;
    const planks = this.raft ? 'bamboo_planks' : this.wood + '_planks';
    for (let i = 0; i < 3; i++) if (IID[planks] !== undefined) Drops.spawnItem(this.x, this.y + 0.3, this.z, stack(planks));
    for (let i = 0; i < 2; i++) Drops.spawnItem(this.x, this.y + 0.3, this.z, stack('stick'));
    if (this.items) for (const s of this.items) if (s) Drops.spawnItem(this.x, this.y + 0.3, this.z, s, true);
  }
  hurt(n, src, attacker) {
    if (this.removed || src === 'onFire' || src === 'inFire') return false;
    this.shakeDir = -this.shakeDir; this.shake = 10; this.damage += n * 10;
    const creative = attacker && attacker.isPlayer && attacker.creative;
    if (creative || this.damage > 40) {
      this.removed = true;
      for (const r of this.passengers.slice()) Vehicles.dismount(r);
      if (!creative && Game.rules.doEntityDrops) { Drops.spawnItem(this.x, this.y + 0.3, this.z, stack(this.item)); if (this.items) for (const s of this.items) if (s) Drops.spawnItem(this.x, this.y + 0.3, this.z, s, true); }
    }
    return true;
  }
  interact(p, s) {
    if (this.chest && p.sneaking) { Screens.open(new ChestScreen(this.items, 3, ITEMS[IID[this.item]].display)); return true; }
    if (p.vehicle || this.passengers.length >= this.maxPassengers || this.outOfControl >= 60) return false;
    Vehicles.mount(p, this); return true;
  }
  // the seat: one rider in the middle, or two (front and back)
  seatFor(e) {
    let f = 0;
    if (this.passengers.length > 1) { f = this.passengers.indexOf(e) === 0 ? 0.2 : -0.6; if (e.living && !e.isPlayer && e.type !== 'villager') f += 0.2; }
    if (this.chest) f = 0.15;
    return [this.x - Math.sin(this.yaw) * f, this.y + this.seatY, this.z - Math.cos(this.yaw) * f];
  }
  posePart(inst, s, a) {
    const r = inst.root;
    const t = this.shake - a, dmg = Math.max(0, this.damage - a);
    r.rotation.x = t > 0 ? Math.sin(t) * t * dmg / 10 * this.shakeDir * Math.PI / 180 : 0;
    inst.body.position.y = 0.375;
    const wp = inst.parts.water_patch;
    if (wp && wp.mesh && !wp.masked) { wp.mesh.material = Boat.maskMat || (Boat.maskMat = new THREE.MeshBasicMaterial({ colorWrite: false })); wp.mesh.renderOrder = 1; wp.masked = true; }
    for (const [i, name] of [[0, 'left_paddle'], [1, 'right_paddle']]) {
      const p = inst.parts[name]; if (!p) continue;
      const f = this.paddling[i] ? this.paddle[i] + Math.PI / 8 * a : 0;
      const lerpC = (lo, hi, k) => lo + (hi - lo) * Math.max(0, Math.min(1, k));
      p.rx = lerpC(-Math.PI / 3, -0.2617994, (Math.sin(-f) + 1) / 2);
      p.ry = lerpC(-Math.PI / 4, Math.PI / 4, (Math.sin(-f + 1) + 1) / 2);
      if (i === 1) p.ry = Math.PI - p.ry;
    }
  }
  save() { return { type: this.type, vehicle: 'boat', item: this.item, x: this.x, y: this.y, z: this.z, yaw: this.yaw, items: this.items || null, name: this.customName || null }; }
}

/* ---------------------------------------------------------------- riding */
const Vehicles = (() => {
  // where a rider's feet go: the vehicle's seat height minus how far up the rider sits (players 0.6)
  const MOUNT_Y = { horse: 1.44375, zombie_horse: 1.44375, skeleton_horse: 1.31875, donkey: 1.175, mule: 1.2, pig: 0.86875, strider: 1.1875, camel: 1.875, llama: 1.21, trader_llama: 1.21, spider: 0.765, cave_spider: 0.5, chicken: 0.7, ravager: 2.1, hoglin: 1.49, zombified_piglin: 1.95 };
  function riderDrop(e) { return e.isPlayer ? 0.6 : e.living ? Math.min(0.6, e.h * 0.35) : 0; }
  function seat(v, e) {
    if (v.seatFor) { const s = v.seatFor(e); return [s[0], s[1] - riderDrop(e), s[2]]; }
    if (v.seatY !== undefined) return [v.x, v.y + v.seatY - riderDrop(e), v.z];
    const h = MOUNT_Y[v.type] !== undefined ? MOUNT_Y[v.type] * (v.baby ? 0.5 : 1) : v.h * 0.75;
    let y = v.y + h - riderDrop(e);
    if (v.type === 'camel' && v.sitting) y -= 1.0;
    return [v.x, y, v.z];
  }
  function mount(e, v) {
    if (!e || !v || e === v || e.dead || v.dead) return false;
    if (e.vehicle) dismount(e);
    e.vehicle = v; v.passengers.push(e);
    e.vx = e.vy = e.vz = 0; e.fallDistance = 0;
    if (e.isPlayer) { e.flying = false; e.sprinting = false; e.mountedAt = Game.gameTime; HUD.actionBar && HUD.actionBar('Press Shift to Dismount'); }
    if (e.nav) e.nav.stop && e.nav.stop();
    const s = seat(v, e); e.x = e.px = s[0]; e.y = e.py = s[1]; e.z = e.pz = s[2];
    return true;
  }
  // getting off: a free spot beside the vehicle, else on top of it
  function dismount(e) {
    const v = e.vehicle; if (!v) return;
    e.vehicle = null;
    const i = v.passengers.indexOf(e); if (i >= 0) v.passengers.splice(i, 1);
    const hw = e.w / 2, side = (v.w || 1) / 2 + hw + 0.05;
    const yaw = v.yaw || 0, offs = [[Math.cos(yaw), -Math.sin(yaw)], [-Math.cos(yaw), Math.sin(yaw)], [-Math.sin(yaw), -Math.cos(yaw)], [Math.sin(yaw), Math.cos(yaw)]];
    for (const [ox, oz] of offs) for (const dy of [0, 1, -1]) {
      const x = v.x + ox * side, z = v.z + oz * side, y = Math.floor(v.y) + dy + (SOLID[World.getBlock(Math.floor(x), Math.floor(v.y) + dy, Math.floor(z))] ? 1 : 0);
      if (Phys.boxFree(x - hw, y, z - hw, x + hw, y + e.h, z + hw) && SOLID[World.getBlock(Math.floor(x), y - 1, Math.floor(z))]) { e.x = e.px = x; e.y = e.py = y; e.z = e.pz = z; return; }
    }
    e.y = e.py = v.y + (v.h || 1);
  }
  // after everything moved: riders follow their seats
  function afterTick() {
    const all = Entities.list.concat(Game.player ? [Game.player] : []);
    for (const e of all) {
      const v = e.vehicle; if (!v) continue;
      if (v.removed || v.dead || e.dead || e.removed || v.dim !== undefined && e.dim !== undefined && v.dim !== e.dim && !e.isPlayer) { dismount(e); continue; }
      const s = seat(v, e); e.x = s[0]; e.y = s[1]; e.z = s[2]; e.vx = e.vy = e.vz = 0; e.onGround = true; e.fallDistance = 0;
      if (v instanceof Boat && v.deltaRot) { e.yaw += v.deltaRot; if (!e.isPlayer) e.bodyYaw = e.yaw; }
      // a player gets off with sneak
      if (e.isPlayer && e.sneaking && Game.gameTime - (e.mountedAt || 0) > 2) dismount(e);
    }
  }
  // ---------------------------------------------------------------- steering mobs
  const STEER = { pig: 'carrot_on_a_stick', strider: 'warped_fungus_on_a_stick' };
  // called by a mob that a player rides; true when the player is in control
  function control(m, p) {
    const t = m.type, held = p.inv.held, hn = held ? ITEMS[held.id].name : '';
    if (STEER[t]) {
      if (!m.saddled || (hn !== STEER[t] && (!p.inv.offhand || ITEMS[p.inv.offhand.id].name !== STEER[t]))) return false;
      m.yaw = p.yaw; m.lookYaw = p.yaw;
      let boost = 1;
      if (m.boostTime > 0) { m.boostTime--; boost = 1 + 1.15 * Math.sin((m.boostTotal - m.boostTime) / m.boostTotal * Math.PI); }
      m.speedMod = (t === 'pig' ? 0.225 : m.inLava ? 0.55 : 0.35) * boost; m.lookTarget = null;
      m.forward = 1; m.strafe = 0;
      if (m.hitH && m.onGround) m.jumping = true;
      return true;
    }
    if (['horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'camel'].includes(t)) {
      // an untamed horse bucks its rider off now and then until it trusts them
      if (!m.tame && t !== 'camel' && t !== 'skeleton_horse') {
        if (rnd(25) === 0) {
          if (rnd(100) < (m.temper || 0)) { m.tame = true; m.owner = 'player'; Particles.heart(m, 7); }
          else { m.temper = Math.min(100, (m.temper || 0) + 5); dismount(p); Sound.play(t + '_hurt', m); Particles.smoke(m); return true; }
        }
        m.forward = 0; return true;
      }
      if (!m.saddled) return false;
      m.yaw = p.yaw; m.lookYaw = p.yaw; m.lookTarget = null;
      let f = p.forward > 0 ? 1 : p.forward < 0 ? -0.25 : 0;
      m.forward = f; m.strafe = (p.strafe > 0 ? 1 : p.strafe < 0 ? -1 : 0) * 0.5; m.speedMod = 1;
      if (t === 'camel' && m.sitting) { m.forward = m.strafe = 0; if (f) m.sitting = false; }
      // jumping: hold space to charge (horses) or dash (camels)
      if (p.jumping) m.jumpCharge = Math.min(100, (m.jumpCharge || 0) + 10);
      else if (m.jumpCharge > 0) {
        const k = m.jumpCharge >= 90 ? 1 : 0.4 + 0.4 * m.jumpCharge / 90; m.jumpCharge = 0;
        if (m.onGround && t !== 'camel') { m.vy = (m.jumpStrength || 0.5) * k; if (f > 0) { m.vx += -Math.sin(m.yaw) * 0.4 * k; m.vz += -Math.cos(m.yaw) * 0.4 * k; } }
        if (t === 'camel' && m.onGround && (m.dashCool || 0) <= 0) { const sp = 22.2222 * k * (m.speed || 0.09) * 1; m.vx += -Math.sin(m.yaw) * sp; m.vz += -Math.cos(m.yaw) * sp; m.vy += 1.4285 * k * 0.42; m.dashCool = 55; }
      }
      if (m.dashCool > 0) m.dashCool--;
      m.jumping = false;
      return true;
    }
    return false;
  }
  // using a carrot / warped fungus on a stick while riding gives a speed boost
  function useStick(p, s) {
    const m = p.vehicle, n = ITEMS[s.id].name;
    if (!m || STEER[m.type] !== n || !m.saddled || m.boostTime > 0) return false;
    m.boostTotal = m.boostTime = 140 + rnd(841);
    if (!p.creative) { s.dmg = (s.dmg || 0) + 7; if (s.dmg >= ITEMS[s.id].dur) { p.inv.held = stack('fishing_rod'); } }
    return true;
  }
  // ---------------------------------------------------------------- spawning and saving
  function spawnMinecart(kind, x, y, z) { const m = new Minecart(kind, x, y, z); Entities.add(m); return m; }
  function spawnBoat(item, x, y, z, yaw) {
    const b = new Boat(item, x, y, z, yaw);
    // a boat placed on water sits on the surface
    const bx = Math.floor(x), bz = Math.floor(z); let by = Math.floor(y);
    if (BLOCKS[World.getBlock(bx, by, bz)].fluid === 'water') { while (BLOCKS[World.getBlock(bx, by + 1, bz)].fluid === 'water') by++; b.y = b.py = by + 0.9 - b.h + 0.101; }
    if (!Phys.boxFree(b.x - b.w / 2, b.y, b.z - b.w / 2, b.x + b.w / 2, b.y + b.h, b.z + b.w / 2)) return null;
    Entities.add(b); return b;
  }
  function restore(d) {
    if (d.vehicle === 'minecart') { const m = new Minecart(d.type, d.x, d.y, d.z); m.vx = d.vx || 0; m.vy = d.vy || 0; m.vz = d.vz || 0; if (d.items) m.items = d.items; m.fuel = d.fuel || 0; m.pushX = d.pushX || 0; m.pushZ = d.pushZ || 0; m.fuse = d.fuse === undefined ? -1 : d.fuse; m.customName = d.name; Entities.add(m); return true; }
    if (d.vehicle === 'boat') { const b = new Boat(d.item, d.x, d.y, d.z, d.yaw); if (d.items) b.items = d.items; b.customName = d.name; Entities.add(b); return true; }
    return false;
  }
  // ---------------------------------------------------------------- hoppers and minecart / boat inventories
  function insertOne(items, s) {
    for (let i = 0; i < items.length; i++) { const c = items[i]; if (c && sameItem(c, s) && c.count < maxStack(c)) { c.count++; return true; } }
    for (let i = 0; i < items.length; i++) if (!items[i]) { items[i] = Object.assign({}, s, { count: 1 }); return true; }
    return false;
  }
  function containerEntityAt(x, y, z) {
    const box = [x, y, z, x + 1, y + 1, z + 1];
    return Entities.list.find(e => !e.removed && e.items && (e instanceof Minecart || e instanceof Boat) && e.intersects(box));
  }
  // a hopper pointing into a block with a chest or hopper minecart in it
  function hopperInto(self, x, y, z) {
    const e = containerEntityAt(x, y, z); if (!e) return false;
    for (let i = 0; i < self.size; i++) { const s = self.get(i); if (!s) continue; if (insertOne(e.items, s)) { s.count--; self.set(i, s.count > 0 ? s : null); return true; } }
    return false;
  }
  // a hopper below takes items out of a minecart above it
  function hopperFrom(self, x, y, z) {
    const e = containerEntityAt(x, y, z); if (!e) return false;
    for (let i = 0; i < e.items.length; i++) { const s = e.items[i]; if (!s) continue; if (Containers.insertOne(self, s, 1)) { s.count--; if (s.count <= 0) e.items[i] = null; return true; } }
    return false;
  }
  return { mount, dismount, afterTick, control, useStick, spawnMinecart, spawnBoat, restore, insertOne, hopperInto, hopperFrom, containerEntityAt, seat, Minecart, Boat };
})();

/* ---------------------------------------------------------------- models and skins (the game's MinecartModel, BoatModel, RaftModel) */
(() => {
  const { def, P, SK } = EntityModels, PI = Math.PI, S = Skin;
  const side = [0, 0, -8, -9, -1, 16, 8, 2];
  def('minecart', 64, 32, [
    P('bottom', [0, 4, 0], [PI / 2, 0, 0], [[0, 10, -10, -8, -1, 20, 16, 2]]),
    P('front', [-9, 4, 0], [0, PI * 3 / 2, 0], [side]), P('back', [9, 4, 0], [0, PI / 2, 0], [side]),
    P('left', [0, 4, -7], [0, PI, 0], [side]), P('right', [0, 4, 7], 0, [side]),
  ], { skin: s => {
    s.box(0, 0, 16, 8, 2, 0x8a8f94, 0.06); s.box(0, 10, 20, 16, 2, 0x6e7378, 0.06);
    // rivets and dark rims
    for (const [u, v, w, h] of [[2, 2, 16, 8], [20, 2, 16, 8]]) { s.fill(u, v, w, 1, 0x4a4e52, 0.03); s.fill(u, v + h - 1, w, 1, 0x4a4e52, 0.03); s.fill(u, v, 1, h, 0x4a4e52, 0.03); s.fill(u + w - 1, v, 1, h, 0x4a4e52, 0.03); }
    s.fill(2, 12, 20, 16, 0x5c6065, 0.08); s.fill(4, 14, 16, 12, 0x6e7378, 0.08);
  } });
  const boatParts = chest => [
    P('bottom', [0, 3, 1], [PI / 2, 0, 0], [[0, 0, -14, -9, -3, 28, 16, 3]]),
    P('back', [-15, 4, 4], [0, PI * 3 / 2, 0], [[0, 19, -13, -7, -1, 18, 6, 2]]),
    P('front', [15, 4, 0], [0, PI / 2, 0], [[0, 27, -8, -7, -1, 16, 6, 2]]),
    P('right', [0, 4, -9], [0, PI, 0], [[0, 35, -14, -7, -1, 28, 6, 2]]),
    P('left', [0, 4, 9], 0, [[0, 43, -14, -7, -1, 28, 6, 2]]),
    P('left_paddle', [3, -5, 9], [0, 0, PI / 16], [[62, 0, -1, 0, -5, 2, 2, 18], [62, 0, -1.001, -3, 8, 1, 6, 7]]),
    P('right_paddle', [3, -5, -9], [0, PI, PI / 16], [[62, 20, -1, 0, -5, 2, 2, 18], [62, 20, 0.001, -3, 8, 1, 6, 7]]),
    // drawn into the depth buffer only, so the water does not show inside the hull
    P('water_patch', [0, -3, 1], [PI / 2, 0, 0], [[0, 0, -14, -9, -3, 28, 16, 3]]),
  ].concat(chest ? chestParts(-5, -9, -6) : []);
  const chestParts = (by, ly, lky) => [P('chest_bottom', [-2, by, -6], [0, -PI / 2, 0], [[0, 76, 0, 0, 0, 12, 8, 12]]), P('chest_lid', [-2, ly, -6], [0, -PI / 2, 0], [[0, 59, 0, 0, 0, 12, 4, 12]]), P('chest_lock', [-1, lky, -1], [0, -PI / 2, 0], [[0, 59, 0, 0, 0, 2, 4, 1]])];
  const raftParts = chest => [
    P('bottom', [0, -2.1, 1], [1.5708, 0, 0], [[0, 0, -14, -11, -4, 28, 20, 4], [0, 0, -14, -9, -8, 28, 16, 4]]),
    P('left_paddle', [3, -4, 9], [0, 0, 0.19634955], [[0, 24, -1, 0, -5, 2, 2, 18], [0, 24, -1.001, -3, 8, 1, 6, 7]]),
    P('right_paddle', [3, -4, -9], [0, PI, 0.19634955], [[40, 24, -1, 0, -5, 2, 2, 18], [40, 24, 0.001, -3, 8, 1, 6, 7]]),
  ].concat(chest ? [P('chest_bottom', [-2, -10.1, -6], [0, -PI / 2, 0], [[0, 76, 0, 0, 0, 12, 8, 12]]), P('chest_lid', [-2, -14.1, -6], [0, -PI / 2, 0], [[0, 59, 0, 0, 0, 12, 4, 12]]), P('chest_lock', [-1, -11.1, -1], [0, -PI / 2, 0], [[0, 59, 0, 0, 0, 2, 4, 1]])] : []);
  const WOOD = { oak: 0xa8834f, spruce: 0x6e4f2c, birch: 0xcdb97c, jungle: 0xa8774f, acacia: 0xad5d32, dark_oak: 0x45301a, mangrove: 0x763631, cherry: 0xe0b0a8, bamboo: 0xc9b35a };
  const planks = (s, x, y, w, h, col) => { s.fill(x, y, w, h, col, 0.07); for (let j = 3; j < h; j += 4) s.fill(x, y + j, w, 1, S.scale(col, 0.72), 0.04); };
  const chestSkin = s => { s.box(0, 76, 12, 8, 12, 0x9a6b2f, 0.07); s.box(0, 59, 12, 4, 12, 0x9a6b2f, 0.07); s.fill(0, 59, 2, 5, 0xc0c0c0, 0.05); s.fill(0, 75, 48, 1, 0x4a3214, 0.02); };
  const boatSkin = (col, chest) => s => {
    const dark = S.scale(col, 0.75);
    s.box(0, 0, 28, 16, 3, col, 0.06); planks(s, 3, 3, 28, 16, col); planks(s, 34, 3, 28, 16, dark);
    for (const [u, v, w] of [[0, 19, 18], [0, 27, 16], [0, 35, 28], [0, 43, 28]]) { s.box(u, v, w, 6, 2, col, 0.06); s.fill(u + 2, v + 2, w, 1, S.scale(col, 1.15), 0.03); s.fill(u + 2, v + 7, w, 1, dark, 0.03); }
    for (const v of [0, 20]) { s.box(62, v, 2, 2, 18, S.scale(col, 1.05), 0.05); s.fill(62 + 18, v + 18 + 2, 1, 6, dark, 0.03); s.fill(62, v + 20, 16, 6, S.scale(col, 0.9), 0.05); }
    if (chest) chestSkin(s);
  };
  const raftSkin = (col, chest) => s => {
    const dark = S.scale(col, 0.78);
    s.box(0, 0, 28, 20, 4, col, 0.05);
    for (let x = 4; x < 32; x += 3) s.fill(x, 4, 1, 20, dark, 0.03);
    for (const u of [0, 40]) { s.box(u, 24, 2, 2, 18, S.scale(col, 1.05), 0.05); s.fill(u + 18, 46, 1, 6, dark, 0.03); }
    if (chest) chestSkin(s);
  };
  for (const w in WOOD) {
    if (w === 'bamboo') { def('raft_bamboo', 128, 64, raftParts(false), { skin: raftSkin(WOOD[w], false) }); def('raft_chest_bamboo', 128, 128, raftParts(true), { skin: raftSkin(WOOD[w], true) }); continue; }
    def('boat_' + w, 128, 64, boatParts(false), { skin: boatSkin(WOOD[w], false) });
    def('boat_chest_' + w, 128, 128, boatParts(true), { skin: boatSkin(WOOD[w], true) });
  }
  void SK;
})();
