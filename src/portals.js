'use strict';
/* Nether and End portals and moving between dimensions, following the game:
   - a nether portal frame is obsidian around an empty space 2-21 wide and 3-21 high; fire inside lights it
   - standing in a portal for 4 seconds (instantly in creative) moves you to the other dimension, at an eighth
     (or eight times) the distance from 0,0; the nearest portal within 128 blocks (16 in the Nether) is used,
     or a new one is built nearby
   - the End portal takes you to the obsidian platform at 100, 49, 0; the exit portal takes you home
   Portals are remembered per dimension (like the game's points of interest) so finding one needs no loading. */
const Portals = (() => {
  const B = BID;
  let known = { overworld: [], nether: [], end: [] };
  let arrival = null;
  const obs = (x, y, z) => World.getBlock(x, y, z) === B.obsidian;
  const empty = (x, y, z) => { const id = World.getBlock(x, y, z); return id === 0 || id === B.fire || id === B.soul_fire || id === B.nether_portal || id === B.cave_air; };
  // ---------------------------------------------------------------- frames
  // the frame around (x,y,z) on an axis (0: the portal runs along x, 1: along z), or null
  function frameAt(x, y, z, axis) {
    const dx = axis === 0 ? 1 : 0, dz = axis === 0 ? 0 : 1;
    if (!empty(x, y, z)) return null;
    let by = y; for (let k = 0; k < 21 && empty(x, by - 1, z); k++) by--;
    if (!obs(x, by - 1, z)) return null;
    let bx = x, bz = z; for (let k = 0; k < 21 && empty(bx - dx, by, bz - dz); k++) { bx -= dx; bz -= dz; }
    if (!obs(bx - dx, by, bz - dz)) return null;
    let w = 0;
    while (w < 22 && empty(bx + dx * w, by, bz + dz * w)) { if (!obs(bx + dx * w, by - 1, bz + dz * w)) return null; w++; }
    if (w < 2 || w > 21 || !obs(bx + dx * w, by, bz + dz * w)) return null;
    let h = 0;
    for (; h < 22; h++) {
      let row = true; for (let i = 0; i < w; i++) if (!empty(bx + dx * i, by + h, bz + dz * i)) { row = false; break; }
      if (!row) break;
      if (!obs(bx - dx, by + h, bz - dz) || !obs(bx + dx * w, by + h, bz + dz * w)) return null;
    }
    if (h < 3 || h > 21) return null;
    for (let i = 0; i < w; i++) if (!obs(bx + dx * i, by + h, bz + dz * i)) return null;
    return { x: bx, y: by, z: bz, w, h, axis };
  }
  function fill(f) {
    const dx = f.axis === 0 ? 1 : 0, dz = 1 - dx;
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) World.setBlock(f.x + dx * i, f.y + j, f.z + dz * i, B.nether_portal, f.axis, 1);
    for (let j = -1; j <= f.h; j++) for (let i = -1; i <= f.w; i++) World.markDirty(f.x + dx * i, f.y + j, f.z + dz * i);
    remember(World.dim, f);
  }
  function remember(dim, f) { const L = known[dim]; if (!L.some(o => o.x === f.x && o.y === f.y && o.z === f.z)) L.push({ x: f.x, y: f.y, z: f.z, w: f.w, h: f.h, axis: f.axis }); }
  function forget(dim, x, y, z) { known[dim] = known[dim].filter(o => !(x >= o.x - 1 && x <= o.x + (o.axis === 0 ? o.w : 0) + 1 && z >= o.z - 1 && z <= o.z + (o.axis === 1 ? o.w : 0) + 1 && y >= o.y - 1 && y <= o.y + o.h)); }
  // fire placed inside a frame lights it
  function tryLight(x, y, z) {
    if (World.dim === 'end') return false;
    for (const axis of [0, 1]) {
      const f = frameAt(x, y, z, axis);
      if (f) { fill(f); Sound.play('portal_trigger', null, { x, y, z }); return true; }
    }
    return false;
  }
  // a portal block whose frame is no longer whole breaks (with every portal block joined to it)
  function checkFrame(x, y, z) {
    if (World.getBlock(x, y, z) !== B.nether_portal) return;
    const axis = World.getState(x, y, z) & 1;
    if (frameAt(x, y, z, axis)) return;
    const stack = [[x, y, z]], seen = new Set();
    while (stack.length) {
      const [a, b, c] = stack.pop(), k = a + ',' + b + ',' + c;
      if (seen.has(k) || World.getBlock(a, b, c) !== B.nether_portal) continue;
      seen.add(k); World.setBlock(a, b, c, 0, 0, 1);
      for (let f = 0; f < 6; f++) stack.push([a + DX[f], b + DY[f], c + DZ[f]]);
    }
    forget(World.dim, x, y, z);
  }
  function onBreak(x, y, z) { for (let f = 0; f < 6; f++) checkFrame(x + DX[f], y + DY[f], z + DZ[f]); }
  // ---------------------------------------------------------------- the End portal: 12 frames with eyes around a 3x3 hole
  function checkEndPortal(x, y, z) {
    // the frame block is on one side of the 3x3; try each centre it could belong to
    for (let cx = x - 4; cx <= x + 4; cx++) for (let cz = z - 4; cz <= z + 4; cz++) {
      let ok = true, n = 0;
      for (let dx = -2; dx <= 2 && ok; dx++) for (let dz = -2; dz <= 2; dz++) {
        const ring = Math.abs(dx) === 2 || Math.abs(dz) === 2, corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        if (!ring || corner) continue;
        const id = World.getBlock(cx + dx, y, cz + dz), st = World.getState(cx + dx, y, cz + dz);
        // each frame must have an eye and face the middle
        const inward = dx === -2 ? 5 : dx === 2 ? 4 : dz === -2 ? 3 : 2;
        if (id !== B.end_portal_frame || !(st & 8) || (st & 7) !== inward) { ok = false; break; }
        n++;
      }
      if (!ok || n !== 12) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) World.setBlock(cx + dx, y, cz + dz, B.end_portal, 0);
      Sound.play('end_portal_spawn', null, { x: cx + 0.5, y, z: cz + 0.5, global: true });
      return true;
    }
    return false;
  }
  function onEndFrameBreak() {}
  // ---------------------------------------------------------------- travelling
  const touching = (p, id) => {
    const x0 = Math.floor(p.x - p.w / 2), x1 = Math.floor(p.x + p.w / 2), y0 = Math.floor(p.y), y1 = Math.floor(p.y + p.h), z0 = Math.floor(p.z - p.w / 2), z1 = Math.floor(p.z + p.w / 2);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (World.getBlock(x, y, z) === id) return { x, y, z };
    return null;
  };
  function tick(p) {
    if (!p || p.dead) return;
    if (arrival) { tickArrival(p); return; }
    const inNether = touching(p, B.nether_portal);
    if (inNether && !p.portalLock && !p.vehicle) {
      if (p.portalTime === 0 && !p.creative) Sound.play('portal_trigger', p, { ui: true });
      p.portalTime++;
      if (p.portalTime >= (p.creative ? 1 : 80)) { p.portalTime = 0; travelNether(p, World.getState(inNether.x, inNether.y, inNether.z) & 1); return; }
    } else {
      if (!inNether) p.portalLock = false;
      if (p.portalTime > 0) p.portalTime = Math.max(0, p.portalTime - 4);
    }
    // the End portal works at once (the block is 12 pixels high)
    const ep = touching(p, B.end_portal);
    if (ep && p.y < ep.y + 0.75 && !p.portalLock) { travelEnd(p); return; }
    if (!ep && !inNether) p.portalLock = false;
    const gw = touching(p, B.end_gateway);
    if (gw && !p.portalLock && typeof EndFight !== 'undefined') EndFight.gateway(p, gw);
  }
  function travelNether(p, axis) {
    if (World.dim === 'end') return;
    const to = World.dim === 'nether' ? 'overworld' : 'nether', k = to === 'nether' ? 1 / 8 : 8;
    const lim = 29999984;
    const tx = Math.max(-lim, Math.min(lim, p.x * k)), tz = Math.max(-lim, Math.min(lim, p.z * k));
    Sound.play('portal_travel', p, { ui: true });
    changeDim(to, tx, p.y, tz, { kind: 'nether', axis });
    Stats.add('custom', 'portal_travel');
    Advancements.trigger && Advancements.trigger('enter_' + to);
  }
  function travelEnd(p) {
    if (World.dim === 'end') {
      // home again (the first time, the game shows the End Poem)
      const sp = Beds.respawnPoint(p);
      p.seenCredits = true;
      changeDim('overworld', sp.x, sp.y, sp.z, { kind: 'exact' });
      return;
    }
    changeDim('end', 100.5, 49, 0.5, { kind: 'end' });
    Advancements.trigger && Advancements.trigger('enter_end');
  }
  // leave the current dimension and wait in the new one until the ground there is loaded
  function changeDim(dim, x, y, z, opts) {
    const p = Game.player;
    opts = typeof opts === 'object' && opts ? opts : { kind: 'exact' };
    if (typeof Pistons !== 'undefined') Pistons.finishAll();
    if (p.vehicle) Vehicles.dismount(p);
    for (const c of [...World.chunks.values()]) { Save.storeChunk(c, true); World.unload(c); }
    World.pending.clear(); World.genQueue.length = 0; World.arrived.length = 0;
    for (const e of Entities.list) if (!e.isPlayer) e.removed = true;
    Particles.clear(); BeaconBeams.clear();
    World.setDim(dim); p.dim = dim;
    p.x = p.px = x; p.y = p.py = y; p.z = p.pz = z; p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
    arrival = { dim, x, y, z, kind: opts.kind || 'exact', axis: opts.axis || 0, t: 0 };
    if (!UI.page || UI.page === 'loading') UI.show('loading', { text: 'Loading terrain...' });
  }
  function loadedAround(x, z, r) {
    for (let cx = (Math.floor(x) - r) >> 4; cx <= (Math.floor(x) + r) >> 4; cx++) for (let cz = (Math.floor(z) - r) >> 4; cz <= (Math.floor(z) + r) >> 4; cz++) { const c = World.getChunk(cx, cz); if (!c || !c.lit) return false; }
    return true;
  }
  function tickArrival(p) {
    const a = arrival; a.t++;
    p.vx = p.vy = p.vz = 0; p.fallDistance = 0; p.px = p.x; p.py = p.y; p.pz = p.z;
    if (!a.target) {
      if (a.kind === 'nether') {
        // the closest remembered portal in range (a square, like the game's search)
        const r = a.dim === 'nether' ? 16 : 128;
        let best = null, bd = 1e18;
        for (const o of known[a.dim]) { if (Math.abs(o.x - a.x) > r || Math.abs(o.z - a.z) > r) continue; const d = (o.x - a.x) ** 2 + (o.y - a.y) ** 2 + (o.z - a.z) ** 2; if (d < bd) { bd = d; best = o; } }
        a.target = best ? { portal: best, x: best.x, z: best.z } : { create: true, x: Math.floor(a.x), z: Math.floor(a.z) };
      } else if (a.kind === 'end') a.target = { x: 100, z: 0 };
      else a.target = { x: Math.floor(a.x), z: Math.floor(a.z) };
      p.x = p.px = a.target.x + 0.5; p.z = p.pz = a.target.z + 0.5;
    }
    const t = a.target;
    if (!loadedAround(t.x, t.z, t.create ? 16 : 2)) return;
    if (a.kind === 'nether') {
      let f = t.portal;
      if (f && World.getBlock(f.x, f.y, f.z) !== B.nether_portal) { known[a.dim] = known[a.dim].filter(o => o !== f); f = null; }
      if (!f) f = build(t.x, Math.floor(a.y), t.z, a.axis);
      const dx = f.axis === 0 ? 1 : 0, dz = 1 - dx;
      p.x = p.px = f.x + dx * (f.w / 2) + dz * 0.5; p.z = p.pz = f.z + dz * (f.w / 2) + dx * 0.5; p.y = p.py = f.y;
      p.portalLock = true;
    } else if (a.kind === 'end') {
      // the obsidian platform the game makes on arrival (and clears the space above it)
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        World.setBlock(100 + dx, 48, dz, B.obsidian, 0);
        for (let dy = 1; dy <= 3; dy++) World.setBlock(100 + dx, 48 + dy, dz, 0, 0);
      }
      p.x = p.px = 100.5; p.y = p.py = 49; p.z = p.pz = 0.5; p.yaw = p.pyaw = Math.PI / 2; p.pitch = 0;
      p.portalLock = true;
      if (typeof EndFight !== 'undefined') EndFight.onEnter();
    } else {
      // an exact place (a respawn point or a command); make sure it is not inside a block
      let y = Math.floor(a.y);
      while (y < MAXY && (SOLID[World.getBlock(t.x, y, t.z)] || SOLID[World.getBlock(t.x, y + 1, t.z)])) y++;
      p.x = p.px = a.x; p.y = p.py = Math.max(a.y, y); p.z = p.pz = a.z;
    }
    arrival = null;
  }
  // a new portal near (x,y,z): first a spot with solid ground and room, else a forced one on an obsidian ledge
  function build(x, y, z, axis) {
    const dim = World.dim, top = dim === 'nether' ? 127 : MAXY, bottom = dim === 'nether' ? 1 : MINY + 1;
    const dx = axis === 0 ? 1 : 0, dz = 1 - dx;
    const fits = (bx, by, bz) => {
      for (let i = -1; i <= 2; i++) for (let s = -1; s <= 1; s++) {
        const ax = bx + dx * i + dz * s, az = bz + dz * i + dx * s;
        const g = World.getBlock(ax, by - 1, az); if (!SOLID[g] || FLUID[g]) return false;
        for (let j = 0; j < 4; j++) { const b = World.getBlock(ax, by + j, az); if (!BLOCKS[b].replaceable || FLUID[b]) return false; }
      }
      return true;
    };
    let spot = null, bd = 1e18;
    for (let r = 0; r <= 16; r++) for (let ox = -r; ox <= r; ox++) for (let oz = -r; oz <= r; oz++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
      for (let yy = top; yy >= bottom; yy--) {
        if (!fits(x + ox, yy, z + oz)) continue;
        const d = ox * ox + oz * oz + (yy - y) ** 2;
        if (d < bd) { bd = d; spot = [x + ox, yy, z + oz]; }
      }
    }
    if (!spot) {
      // forced: a ledge of obsidian 3 deep in front and behind, air above
      const fy = Math.max(70, Math.min(top - 9, y)); // the game clamps a forced portal to Y 70 .. top - 9
      spot = [x, fy, z];
      for (let i = -1; i <= 2; i++) for (let s = -1; s <= 1; s++) {
        const ax = x + dx * i + dz * s, az = z + dz * i + dx * s;
        World.setBlock(ax, fy - 1, az, B.obsidian, 0);
        for (let j = 0; j < 4; j++) World.setBlock(ax, fy + j, az, 0, 0);
      }
    }
    const [bx, by, bz] = spot;
    // the frame: 4 wide and 5 high, with a 2 x 3 portal inside
    for (let i = -1; i <= 2; i++) for (let j = -1; j <= 3; j++) {
      const ax = bx + dx * i, az = bz + dz * i, edge = i === -1 || i === 2 || j === -1 || j === 3;
      World.setBlock(ax, by + j, az, edge ? B.obsidian : 0, 0);
    }
    const f = { x: bx, y: by, z: bz, w: 2, h: 3, axis };
    fill(f);
    return f;
  }
  function save() { return { known }; }
  function load(d) { known = { overworld: [], nether: [], end: [] }; if (d && d.known) for (const k in known) known[k] = d.known[k] || []; arrival = null; }
  return { tryLight, checkFrame, onBreak, checkEndPortal, onEndFrameBreak, tick, changeDim, save, load, frameAt, build, get arriving() { return !!arrival; }, get known() { return known; } };
})();
