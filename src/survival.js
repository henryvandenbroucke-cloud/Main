'use strict';
/* Survival rules from the game: sleeping in beds (only at night or in thunderstorms, not with monsters
   nearby, beds explode outside the Overworld, sleeping skips to morning and clears the rain, the bed sets
   your spawn), phantoms for players who have not slept for three days, fire spreading and burning blocks
   by their flammability, leaves decaying away from logs, sponges, building golems and the Wither, the
   dragon egg, chorus flowers, and statistics. */
const Beds = (() => {
  const isNight = () => { const t = ((Game.dayTime % 24000) + 24000) % 24000; return t >= 12542 && t <= 23459; };
  const foot = (x, y, z, st) => { if (st & 8) { const f = st & 7; return [x - DX[f], y, z - DZ[f]]; } return [x, y, z]; };
  const head = (x, y, z, st) => { if (st & 8) return [x, y, z]; const f = st & 7; return [x + DX[f], y, z + DZ[f]]; };
  function use(p, x, y, z, st) {
    if (World.dim !== 'overworld') { Blocks.remove(x, y, z, null, true); Explosions.explode(x + 0.5, y + 0.5, z + 0.5, 5, true, null); return true; }
    const [hx, hy, hz] = head(x, y, z, st);
    if (Math.hypot(p.x - (hx + 0.5), p.y - hy, p.z - (hz + 0.5)) > 4 && Math.abs(p.y - hy) > 2.5) { HUD.actionBar('You may not rest now; the bed is too far away'); return true; }
    // setting the spawn point happens even during the day
    const spawnChanged = !p.spawn || p.spawn.x !== hx || p.spawn.z !== hz;
    p.spawn = { dim: 'overworld', x: hx, y: hy, z: hz, bed: true };
    if (spawnChanged) Chat.system('Respawn point set');
    if (!isNight() && !Weather.thundering()) { HUD.actionBar('You can sleep only at night or during thunderstorms'); return true; }
    for (const e of Entities.list) if (e.hostile && !e.dead && Math.abs(e.x - (hx + 0.5)) < 8 && Math.abs(e.z - (hz + 0.5)) < 8 && Math.abs(e.y - hy) < 5 && !(e.type === 'zombified_piglin' && !e.target)) { HUD.actionBar('You may not rest now; there are monsters nearby'); return true; }
    if (World.getState(hx, hy, hz) & 16) { HUD.actionBar('This bed is occupied'); return true; }
    // lie down
    p.sleeping = { x: hx + 0.5, y: hy + 0.5625, z: hz + 0.5, f: st & 7 }; p.sleepTimer = 0;
    Advancements.fire('slept_in_bed', { pos: [hx, hy, hz] });
    p.x = p.px = hx + 0.5; p.y = p.py = hy + 0.5625; p.z = p.pz = hz + 0.5; p.vx = p.vy = p.vz = 0;
    World.setState(hx, hy, hz, World.getState(hx, hy, hz) | 16);
    Stats.add('custom', 'sleep_in_bed'); Stats.timeSinceRest = 0;
    return true;
  }
  function tick(p) {
    if (!p.sleeping) return;
    const s = p.sleeping, bx = Math.floor(s.x), by = Math.floor(s.y), bz = Math.floor(s.z);
    if (BLOCKS[World.getBlock(bx, by, bz)].model !== 'bed') { wake(p); return; }
    p.x = s.x; p.z = s.z; p.vx = p.vz = 0;
    if (++p.sleepTimer >= 100 && (isNight() || Weather.thundering())) {
      // everyone (just us) has slept: morning comes and the weather clears
      Game.dayTime = Math.floor(Game.dayTime / 24000) * 24000 + 24000;
      if (Weather.isRaining()) Weather.set('clear', 12000 + rnd(168000));
      wake(p);
    }
  }
  function wake(p) {
    const s = p.sleeping; if (!s) return;
    p.sleeping = null; p.sleepTimer = 0;
    const bx = Math.floor(s.x), by = Math.floor(s.y), bz = Math.floor(s.z);
    if (BLOCKS[World.getBlock(bx, by, bz)].model === 'bed') World.setState(bx, by, bz, World.getState(bx, by, bz) & ~16);
    const sp = standNear(bx, by, bz) || [s.x, by + 1, s.z];
    p.x = p.px = sp[0]; p.y = p.py = sp[1]; p.z = p.pz = sp[2];
  }
  // a safe spot next to a bed (or respawn anchor) to stand on
  function standNear(x, y, z) {
    for (let r = 1; r <= 2; r++) for (let dy = 0; dy <= 1; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const sx = x + dx, sy = y + dy - (dy ? 0 : 0), sz = z + dz;
      for (const yy of [sy, sy - 1]) { if (SOLID[World.getBlock(sx, yy - 1, sz)] && !SOLID[World.getBlock(sx, yy, sz)] && !SOLID[World.getBlock(sx, yy + 1, sz)] && !BLOCKS[World.getBlock(sx, yy, sz)].fluid) return [sx + 0.5, yy, sz + 0.5]; }
    }
    return null;
  }
  function respawnPoint(p) {
    const s = p.spawn;
    if (s && s.bed && s.dim === 'overworld') {
      const prev = World.dim; let ok = false, pos = null;
      if (prev === 'overworld' && World.loaded(s.x, s.z)) { ok = BLOCKS[World.getBlock(s.x, s.y, s.z)].model === 'bed'; if (ok) pos = standNear(s.x, s.y, s.z); }
      else { ok = true; pos = [s.x + 0.5, s.y + 1, s.z + 0.5]; }
      if (ok && pos) return { dim: 'overworld', x: pos[0], y: pos[1], z: pos[2] };
      Chat.system('You have no home bed or charged respawn anchor, or it was obstructed'); p.spawn = null;
    } else if (s && s.anchor) return { dim: 'nether', x: s.x, y: s.y, z: s.z };
    return { dim: 'overworld', x: Game.spawn[0], y: Game.spawn[1], z: Game.spawn[2] };
  }
  // phantoms come for players who have not slept in three in-game days
  let phantomT = 1200;
  function phantoms(p) {
    if (--phantomT > 0) return; phantomT = 1200 + rnd(1200);
    if (World.dim !== 'overworld' || Game.difficulty === 'peaceful' || p.creative || p.spectator || Game.rules.doInsomnia === false) return;
    if (!isNight() && !Weather.thundering()) return;
    if (Stats.timeSinceRest < 72000 || rnd(Stats.timeSinceRest) < 72000) return;
    if (World.skyLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z)) < 15) return;
    const n = 1 + rnd({ easy: 1, normal: 2, hard: 3 }[Game.difficulty] || 2);
    for (let i = 0; i < n; i++) { const m = Mobs.spawnEntity('phantom', p.x + rnd(21) - 10, p.y + 20 + rnd(15), p.z + rnd(21) - 10); if (m) m.target = p; }
  }
  return { use, tick, wake, respawnPoint, standNear, phantoms, isNight };
})();

const Fire = (() => {
  const B = BID;
  const flam = id => BLOCKS[id].flam; // [ignite encouragement, burn chance]
  function flammableAround(x, y, z) { for (let f = 0; f < 6; f++) if (flam(World.getBlock(x + DX[f], y + DY[f], z + DZ[f]))) return true; return false; }
  function igniteOdds(x, y, z) { if (World.getBlock(x, y, z) !== 0) return 0; let o = 0; for (let f = 0; f < 6; f++) { const fl = flam(World.getBlock(x + DX[f], y + DY[f], z + DZ[f])); if (fl) o = Math.max(o, fl[0]); } return o; }
  const infiniburn = id => id === B.netherrack || id === B.magma_block || (World.dim === 'end' && id === B.bedrock);
  const rainNear = (x, y, z) => Weather.rainingAt(x + 0.5, y + 1, z + 0.5) || Weather.rainingAt(x - 0.5, y + 1, z + 0.5) || Weather.rainingAt(x + 1.5, y + 1, z + 0.5) || Weather.rainingAt(x + 0.5, y + 1, z - 0.5) || Weather.rainingAt(x + 0.5, y + 1, z + 1.5);
  // the fire block's scheduled tick (every 30-39 ticks)
  function tick(x, y, z, id, st) {
    if (!Game.rules.doFireTick) return;
    if (id === B.soul_fire) { if (World.getBlock(x, y - 1, z) !== B.soul_sand && World.getBlock(x, y - 1, z) !== B.soul_soil) World.setBlock(x, y, z, 0, 0); return; }
    if (!Place.canSurvive(id, st, x, y, z)) { World.setBlock(x, y, z, 0, 0); return; }
    const below = World.getBlock(x, y - 1, z), inf = infiniburn(below);
    const age = st & 15;
    if (!inf && rainNear(x, y, z) && Math.random() < 0.2 + age * 0.03) { World.setBlock(x, y, z, 0, 0); return; }
    const na = Math.min(15, age + Math.floor(rnd(3) / 2));
    if (na !== age) World.setState(x, y, z, (st & ~15) | na);
    if (!inf) {
      if (!flammableAround(x, y, z)) { if (!SOLID[below] || age > 3) World.setBlock(x, y, z, 0, 0); else Ticks.schedule(x, y, z, 30 + rnd(10)); return; }
      if (age === 15 && rnd(4) === 0 && !flam(below)) { World.setBlock(x, y, z, 0, 0); return; }
    }
    const b = BIOMES[World.biomeAt(x, z)], humid = b && b.down > 0.85, k = humid ? -50 : 0;
    burnOut(x + 1, y, z, 300 + k, age); burnOut(x - 1, y, z, 300 + k, age); burnOut(x, y - 1, z, 250 + k, age); burnOut(x, y + 1, z, 250 + k, age); burnOut(x, y, z - 1, 300 + k, age); burnOut(x, y, z + 1, 300 + k, age);
    const diff = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[Game.difficulty] || 2;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 4; dy++) {
      if (!dx && !dy && !dz) continue;
      let n = 100; if (dy > 1) n += (dy - 1) * 100;
      const ox = x + dx, oy = y + dy, oz = z + dz, o = igniteOdds(ox, oy, oz);
      if (o <= 0) continue;
      let p = Math.floor((o + 40 + diff * 7) / (age + 30)); if (humid) p = Math.floor(p / 2);
      if (p > 0 && rnd(n) <= p && !rainNear(ox, oy, oz)) { World.setBlock(ox, oy, oz, B.fire, Math.min(15, age + Math.floor(rnd(5) / 4))); Ticks.schedule(ox, oy, oz, 30 + rnd(10)); }
    }
    if (World.getBlock(x, y, z) === id) Ticks.schedule(x, y, z, 30 + rnd(10));
  }
  // a neighbouring block may catch fire or burn away
  function burnOut(x, y, z, chance, age) {
    const id = World.getBlock(x, y, z), fl = flam(id); if (!fl) return;
    if (rnd(chance) < fl[1]) {
      if (id === B.tnt) { Explosions.primeTnt(x, y, z, null); return; }
      if (rnd(age + 10) < 5 && !Weather.rainingAt(x + 0.5, y + 1, z + 0.5)) { World.setBlock(x, y, z, B.fire, Math.min(15, age + Math.floor(rnd(5) / 4))); Ticks.schedule(x, y, z, 30 + rnd(10)); }
      else { Blocks.remove(x, y, z, null, true); }
    }
  }
  // fire placed by anything: schedule its tick
  World.listeners.blockChanged.push((x, y, z, old, id) => { if (id === B.fire && old !== B.fire) Ticks.schedule(x, y, z, 30 + rnd(10)); });
  return { tick, flammableAround, igniteOdds };
})();

const Leaves = (() => {
  const isLog = id => { const n = BLOCKS[id].name; return n.endsWith('_log') || n.endsWith('_wood') || n.endsWith('_stem') && n !== 'mushroom_stem' && !n.includes('melon') && !n.includes('pumpkin') || n.endsWith('_hyphae') || n === 'mangrove_roots'; };
  // leaves more than 6 blocks (walking through leaves) from a log decay
  function check(x, y, z, id) {
    const seen = new Set([x + ',' + y + ',' + z]); let q = [[x, y, z, 0]];
    while (q.length) {
      const nq = [];
      for (const [cx, cy, cz, d] of q) for (let f = 0; f < 6; f++) {
        const nx = cx + DX[f], ny = cy + DY[f], nz = cz + DZ[f], k = nx + ',' + ny + ',' + nz;
        if (seen.has(k)) continue; seen.add(k);
        const b = World.getBlock(nx, ny, nz);
        if (isLog(b)) return;
        if (d < 5 && BLOCKS[b].name.endsWith('_leaves')) nq.push([nx, ny, nz, d + 1]);
      }
      q = nq;
    }
    decay(x, y, z, id);
  }
  function decay(x, y, z, id) { const st = World.getState(x, y, z); Drops.dropBlock(id, st, null, x, y, z); Blocks.remove(x, y, z, null, true); Particles.blockBreak(x, y, z, id, st); }
  return { check, isLog };
})();

const Sponge = (() => {
  // soak up water within 6 blocks (walking distance), at most 65 blocks
  function absorb(x, y, z) {
    let n = 0; const q = [[x, y, z, 0]], seen = new Set([x + ',' + y + ',' + z]);
    while (q.length && n < 65) {
      const [cx, cy, cz, d] = q.shift();
      for (let f = 0; f < 6; f++) {
        const nx = cx + DX[f], ny = cy + DY[f], nz = cz + DZ[f], k = nx + ',' + ny + ',' + nz; if (seen.has(k)) continue; seen.add(k);
        const id = World.getBlock(nx, ny, nz), b = BLOCKS[id], st = World.getState(nx, ny, nz);
        let took = false;
        if (b.fluid === 'water') { World.setBlock(nx, ny, nz, 0, 0); took = true; }
        else if (b.waterlog && (st & 128)) { World.setBlock(nx, ny, nz, id, st & ~128); took = true; }
        else if (b.fluidLog || id === BID.kelp || id === BID.kelp_plant || id === BID.seagrass || id === BID.tall_seagrass) { Drops.dropBlock(id, st, null, nx, ny, nz); World.setBlock(nx, ny, nz, 0, 0); took = true; }
        if (took) { n++; if (d < 6) q.push([nx, ny, nz, d + 1]); }
      }
    }
    if (n > 0) { World.setBlock(x, y, z, BID.wet_sponge, 0); Sound.play('sponge_absorb', null, { x, y, z }); }
  }
  return { absorb };
})();

const Golems = (() => {
  const B = BID;
  // carved pumpkin on top of a T of iron blocks, two snow blocks, or wither skulls on soul sand
  function check(x, y, z, p) {
    const top = World.getBlock(x, y, z);
    if (top === B.carved_pumpkin || top === B.jack_o_lantern) {
      if (World.getBlock(x, y - 1, z) === B.snow_block && World.getBlock(x, y - 2, z) === B.snow_block) { for (const yy of [y, y - 1, y - 2]) { Particles.blockBreak(x, yy, z, World.getBlock(x, yy, z), 0); World.setBlock(x, yy, z, 0, 0); } Mobs.spawn('snow_golem', x + 0.5, y - 2, z + 0.5, { force: true }); return; }
      if (World.getBlock(x, y - 1, z) === B.iron_block && World.getBlock(x, y - 2, z) === B.iron_block) {
        for (const [ax, az] of [[1, 0], [0, 1]]) {
          if (World.getBlock(x + ax, y - 1, z + az) === B.iron_block && World.getBlock(x - ax, y - 1, z - az) === B.iron_block && World.getBlock(x + ax, y - 2, z + az) !== B.iron_block && World.getBlock(x - ax, y - 2, z - az) !== B.iron_block) {
            for (const [bx, by, bz] of [[x, y, z], [x, y - 1, z], [x, y - 2, z], [x + ax, y - 1, z + az], [x - ax, y - 1, z - az]]) { Particles.blockBreak(bx, by, bz, World.getBlock(bx, by, bz), 0); World.setBlock(bx, by, bz, 0, 0); }
            const g = Mobs.spawn('iron_golem', x + 0.5, y - 2, z + 0.5, { force: true }); if (g) { g.playerMade = true; Advancements.fire('summoned_entity', { entity: g }); }
            return;
          }
        }
      }
    }
    if (top === B.wither_skeleton_skull || top === B.wither_skeleton_wall_skull) {
      // three skulls in a row on top of a T of soul sand / soul soil
      const soul = id => id === B.soul_sand || id === B.soul_soil, skull = id => id === B.wither_skeleton_skull || id === B.wither_skeleton_wall_skull;
      for (const [ax, az] of [[1, 0], [0, 1]]) for (let o = -2; o <= 0; o++) {
        const cx = x + ax * (o + 1), cz = z + az * (o + 1);
        if (!skull(World.getBlock(cx - ax, y, cz - az)) || !skull(World.getBlock(cx, y, cz)) || !skull(World.getBlock(cx + ax, y, cz + az))) continue;
        if (!soul(World.getBlock(cx - ax, y - 1, cz - az)) || !soul(World.getBlock(cx, y - 1, cz)) || !soul(World.getBlock(cx + ax, y - 1, cz + az)) || !soul(World.getBlock(cx, y - 2, cz))) continue;
        for (const [bx, by, bz] of [[cx - ax, y, cz - az], [cx, y, cz], [cx + ax, y, cz + az], [cx - ax, y - 1, cz - az], [cx, y - 1, cz], [cx + ax, y - 1, cz + az], [cx, y - 2, cz]]) { Particles.blockBreak(bx, by, bz, World.getBlock(bx, by, bz), 0); World.setBlock(bx, by, bz, 0, 0); }
        if (Game.difficulty === 'peaceful') return;
        if (typeof Bosses !== 'undefined') Bosses.summonWither(cx + 0.5, y - 2, cz + 0.5); else Mobs.spawn('wither', cx + 0.5, y - 2, cz + 0.5, { force: true });
        return;
      }
    }
  }
  return { check };
})();

const DragonEgg = {
  // clicking the egg makes it teleport up to 15 blocks away
  teleport(x, y, z) {
    for (let k = 0; k < 1000; k++) {
      const nx = x + rnd(16) - rnd(16), ny = y + rnd(8) - rnd(8), nz = z + rnd(16) - rnd(16);
      if (World.getBlock(nx, ny, nz) !== 0 || ny <= MINY) continue;
      World.setBlock(x, y, z, 0, 0); World.setBlock(nx, ny, nz, BID.dragon_egg, 0);
      for (let i = 0; i < 128; i++) { const t = Math.random(); Particles.portal(x + (nx - x) * t + 0.5, y + (ny - y) * t, z + (nz - z) * t + 0.5, 1, 1); }
      return true;
    }
    return false;
  },
};

const Chorus = (() => {
  // chorus flowers grow up to 4 high, branch sideways, and die (age 5) when they cannot grow
  function grow(x, y, z, st) {
    const age = st & 7; if (age >= 5 || World.getBlock(x, y + 1, z) !== 0 || y + 1 > MAXY) return;
    let below = 0; for (let yy = y - 1; World.getBlock(x, yy, z) === BID.chorus_plant && below < 5; yy--) below++;
    const onStone = World.getBlock(x, y - below - 1, z) === BID.end_stone;
    let up = false;
    if (World.getBlock(x, y - 1, z) === BID.end_stone || below === 0 && false) up = true;
    else if (World.getBlock(x, y - 1, z) === BID.chorus_plant) up = below < 2 || below <= rnd(onStone ? 5 : 4);
    if (up && World.getBlock(x, y + 2, z) === 0) { World.setBlock(x, y, z, BID.chorus_plant, 0); World.setBlock(x, y + 1, z, BID.chorus_flower, age); return; }
    if (age < 4) {
      let n = rnd(4); if (onStone) n++; let grew = false;
      for (let i = 0; i < n; i++) { const f = 2 + rnd(4), nx = x + DX[f], nz = z + DZ[f]; if (World.getBlock(nx, y, nz) === 0 && World.getBlock(nx, y - 1, nz) === 0) { World.setBlock(nx, y, nz, BID.chorus_flower, age + 1); grew = true; } }
      if (grew) World.setBlock(x, y, z, BID.chorus_plant, 0); else World.setBlock(x, y, z, BID.chorus_flower, 5);
    } else World.setBlock(x, y, z, BID.chorus_flower, 5);
  }
  return { grow };
})();

// ---------------------------------------------------------------- statistics
const Stats = (() => {
  let S = {}; // category -> { key: n }
  const G = () => (S.custom = S.custom || {});
  function add(cat, key, n) { if (!S[cat]) S[cat] = {}; S[cat][key] = (S[cat][key] || 0) + (n === undefined ? 1 : n); }
  const t = n => { const s = Math.floor(n / 20), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };
  const km = n => (n / 100 >= 1000 ? (n / 100000).toFixed(2) + ' km' : (n / 100).toFixed(2) + ' m');
  function all() {
    const c = G();
    const general = {
      'Games Quit': c.leave_game || 0, 'Time Played': t(c.play_time || 0), 'Time Since Last Death': t(c.time_since_death || 0), 'Time Since Last Rest': t(Stats.timeSinceRest || 0),
      'Distance Walked': km(c.walk_one_cm || 0), 'Distance Sprinted': km(c.sprint_one_cm || 0), 'Distance Crouched': km(c.crouch_one_cm || 0), 'Distance Swum': km(c.swim_one_cm || 0), 'Distance Fallen': km(c.fall_one_cm || 0), 'Distance Climbed': km(c.climb_one_cm || 0), 'Distance Flown': km(c.fly_one_cm || 0),
      'Jumps': c.jump || 0, 'Damage Dealt': ((c.damage_dealt || 0) / 2).toFixed(1) + ' ♥', 'Damage Taken': ((c.damage_taken || 0) / 2).toFixed(1) + ' ♥', 'Deaths': c.deaths || 0,
      'Mob Kills': Object.values(S.killed || {}).reduce((a, b) => a + b, 0), 'Animals Bred': Object.values(S.bred || {}).reduce((a, b) => a + b, 0), 'Times Slept in a Bed': c.sleep_in_bed || 0,
      'Items Crafted': Object.values(S.crafted || {}).reduce((a, b) => a + b, 0), 'Blocks Mined': Object.values(S.mined || {}).reduce((a, b) => a + b, 0), 'Blocks Placed': Object.values(S.placed || {}).reduce((a, b) => a + b, 0),
    };
    return { general, S };
  }
  // movement and time, every tick
  function tick(p) {
    const c = G(); c.play_time = (c.play_time || 0) + 1; c.time_since_death = (c.time_since_death || 0) + 1; Stats.timeSinceRest = (Stats.timeSinceRest || 0) + (p.sleeping ? 0 : 1);
    const dx = p.x - p.px, dy = p.y - p.py, dz = p.z - p.pz, h = Math.hypot(dx, dz) * 100;
    if (p.vehicle) return;
    if (p.flying) c.fly_one_cm = (c.fly_one_cm || 0) + Math.hypot(h, dy * 100);
    else if (p.inWater) c.swim_one_cm = (c.swim_one_cm || 0) + Math.hypot(h, dy * 100);
    else if (p.onClimbable() && dy > 0) c.climb_one_cm = (c.climb_one_cm || 0) + dy * 100;
    else if (p.onGround) { if (p.sprinting) c.sprint_one_cm = (c.sprint_one_cm || 0) + h; else if (p.sneaking) c.crouch_one_cm = (c.crouch_one_cm || 0) + h; else c.walk_one_cm = (c.walk_one_cm || 0) + h; }
    else if (dy < 0) c.fall_one_cm = (c.fall_one_cm || 0) - dy * 100;
  }
  return { add, all, tick, save: () => Object.assign({}, S, { _rest: Stats.timeSinceRest }), load: d => { S = Object.assign({}, d); Stats.timeSinceRest = d._rest || 0; delete S._rest; }, reset: () => { S = {}; Stats.timeSinceRest = 0; }, timeSinceRest: 0, get raw() { return S; } };
})();
