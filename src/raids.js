'use strict';
/* Raids and pillager patrols (Java Edition 1.21).
   A player with Bad Omen who walks into a village gets Raid Omen instead. 30 seconds later a raid starts where
   that happened. A raid has 3 waves on easy, 5 on normal and 7 on hard (one more when the omen was level 2 or
   higher), with 15 seconds of the raid bar filling before each. Each wave comes from about 64 blocks out, using
   the game's table of vindicators, evokers, pillagers, witches and ravagers per wave, with bonus raiders by
   difficulty. Ravagers carry riders in the later waves, and the wave's first vindicator (or pillager) is a
   captain carrying the ominous banner. Raiders head for the village and attack villagers, golems and players.
   Defeating every wave gives Hero of the Village for 40 minutes. A village left with no villagers is lost,
   and the raiders celebrate.
   Patrols: from the fifth day, every 10 to 11 minutes by day, one time in five, a patrol of pillagers led by a
   captain appears 24 to 48 blocks from the player (not in villages or mushroom fields) and marches across the
   land. */
const Raids = (() => {
  // raiders per wave (index = wave number), the game's Raid.RaiderType
  const TYPES = [
    ['vindicator', [0, 0, 2, 0, 1, 4, 2, 5]],
    ['evoker', [0, 0, 0, 0, 0, 1, 1, 2]],
    ['pillager', [0, 4, 3, 3, 4, 4, 4, 2]],
    ['witch', [0, 0, 0, 0, 3, 0, 0, 1]],
    ['ravager', [0, 0, 0, 1, 0, 1, 0, 2]],
  ];
  const GROUPS = { easy: 3, normal: 5, hard: 7, peaceful: 3 };
  const raids = [];
  const now = () => Game.gameTime;
  // ---------------------------------------------------------------- villages: a generated village nearby, or villagers living around here
  let villageCache = { k: '', v: null };
  function generatedVillage(x, z) {
    const k = (Math.floor(x) >> 5) + ',' + (Math.floor(z) >> 5);
    if (villageCache.k !== k) { villageCache = { k, v: World.dim === 'overworld' ? Structures.locate('village', x, z) : null }; }
    const v = villageCache.v; return v && (v[0] - x) ** 2 + (v[1] - z) ** 2 < 72 * 72 ? v : null;
  }
  const villagersNear = (x, y, z, r) => Entities.list.filter(e => e.type === 'villager' && !e.dead && !e.removed && (e.x - x) ** 2 + (e.z - z) ** 2 < r * r && Math.abs(e.y - y) < 24).length;
  const isVillage = (x, y, z) => !!generatedVillage(x, z) || villagersNear(x, y, z, 32) > 0;
  // ---------------------------------------------------------------- Bad Omen -> Raid Omen -> a raid
  function tickPlayer(p) {
    if (!p || p.dead || p.spectator) return;
    if (p.raidOmenAt && !p.effect('raid_omen')) { const [x, y, z, lv] = p.raidOmenAt; p.raidOmenAt = null; start(x, y, z, lv); }
    if (now() % 20 !== 0 || Game.difficulty === 'peaceful') return;
    const bo = p.effect('bad_omen');
    if (bo && !raidAt(p.x, p.z) && isVillage(p.x, p.y, p.z)) {
      p.removeEffect('bad_omen'); p.addEffect('raid_omen', 600, bo.amp);
      p.raidOmenAt = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), Math.min(5, bo.amp + 1)];
    }
  }
  const raidAt = (x, z) => raids.find(r => !r.over && (r.cx - x) ** 2 + (r.cz - z) ** 2 < 96 * 96);
  function start(x, y, z, level) {
    if (Game.difficulty === 'peaceful' || raidAt(x, z)) return null;
    const groups = GROUPS[Game.difficulty] || 5;
    const r = { cx: x + 0.5, cy: y, cz: z + 0.5, level, groups, waves: groups + (level > 1 ? 1 : 0), wave: 0, raiders: [], cooldown: 300, over: null, overT: 0, total: 1, ticks: 0, heroes: new Set() };
    raids.push(r);
    return r;
  }
  // somewhere to come from: about 64 blocks out on open ground, then closer if nothing is found
  function spawnPos(r) {
    for (let i = 0; i < 3; i++) {
      const k = i === 0 ? 2 : 2 - i;
      for (let t = 0; t < 20; t++) {
        const a = Math.random() * Math.PI * 2, x = Math.floor(r.cx + Math.cos(a) * 32 * k) + Math.floor(Math.random() * 5), z = Math.floor(r.cz + Math.sin(a) * 32 * k) + Math.floor(Math.random() * 5);
        if (!World.chunkAt(x, z)) continue;
        const y = World.heightAt(x, z) + 1;
        if (y <= MINY || BLOCKS[World.getBlock(x, y - 1, z)].fluid || !Phys.boxFree(x + 0.2, y, z + 0.2, x + 0.8, y + 2, z + 0.8)) continue;
        return [x + 0.5, y, z + 0.5];
      }
    }
    return null;
  }
  // a pillager's crossbow and a vindicator's axe, enchanted more often the stronger the omen
  function buff(m, r) {
    const odds = [0, 0, 0.1, 0.25, 0.5, 0.75][r.level] || 0, lucky = Math.random() <= odds;
    if (m.type === 'pillager' && lucky && r.wave > GROUPS.easy) m.equip.main = stack('crossbow', 1, { tag: { ench: { quick_charge: r.wave > GROUPS.normal ? 2 : 1 } } });
    if (m.type === 'vindicator') m.equip.main = stack('iron_axe', 1, lucky ? { tag: { ench: { sharpness: r.wave > GROUPS.normal ? 2 : 1 } } } : {});
  }
  // a captain wears the ominous banner, and always drops it
  const captain = m => { m.captain = true; m.equip.head = Banners.ominous(); m.dropChance = Object.assign({ head: 0.085, chest: 0.085, legs: 0.085, feet: 0.085, main: 0.085, off: 0.085 }, m.dropChance || {}, { head: 2 }); };
  function join(r, m) { m.raid = r; m.persistent = true; r.raiders.push(m); Entities.add(m); }
  function spawnWave(r) {
    const pos = spawnPos(r); if (!pos) return false;
    r.wave++;
    const bonusWave = r.wave > r.groups, w = bonusWave ? r.groups : r.wave, d = Game.difficulty;
    let leader = false, rav = 0;
    for (const [type, per] of TYPES) {
      let n = per[w] || 0;
      // bonus raiders by difficulty
      let extra = 0;
      if (type === 'witch') extra = d === 'easy' || w <= 2 || w === 4 ? 0 : 1;
      else if (type === 'pillager' || type === 'vindicator') extra = d === 'easy' ? Math.floor(Math.random() * 2) : d === 'normal' ? 1 : 2;
      else if (type === 'ravager') extra = d !== 'easy' && bonusWave ? 1 : 0;
      if (extra > 0) n += Math.floor(Math.random() * (extra + 1));
      for (let i = 0; i < n; i++) {
        const m = Mobs.create(type, pos[0] + (Math.random() - 0.5), pos[1], pos[2] + (Math.random() - 0.5)); if (!m) break;
        m.yaw = m.bodyYaw = Math.random() * Math.PI * 2;
        if (!leader && type !== 'witch' && type !== 'ravager') { captain(m); leader = true; }
        buff(m, r); join(r, m);
        // ravagers carry a pillager (wave 3), then an evoker or vindicators (from wave 5)
        if (type === 'ravager') {
          let rider = null;
          if (w === GROUPS.easy) rider = 'pillager'; else if (w >= GROUPS.normal) rider = rav === 0 ? 'evoker' : 'vindicator';
          rav++;
          if (rider) { const q = Mobs.create(rider, m.x, m.y, m.z); if (q) { buff(q, r); join(r, q); Vehicles.mount(q, m); } }
        }
      }
    }
    r.total = r.raiders.reduce((s, m) => s + (m.maxHealth || 20), 0);
    Sound.play('raid_horn', null, { x: pos[0], y: pos[1], z: pos[2] });
    return true;
  }
  function tickRaid(r) {
    r.ticks++;
    r.raiders = r.raiders.filter(m => !m.dead && !m.removed);
    const p = Game.player, near = p && (p.x - r.cx) ** 2 + (p.z - r.cz) ** 2 < 96 * 96;
    if (near && !p.dead) r.heroes.add(p);
    if (r.over) {
      // after a win the village celebrates; after a loss the raiders do; 30 seconds later the raid is gone
      if (r.over === 'loss' && r.overT % 20 === 0) for (const m of r.raiders) { if (m.onGround && Math.random() < 0.3) m.vy = 0.42; if (Math.random() < 0.2) Sound.play(m.type + '_celebrate', m); }
      if (++r.overT > 600) { raids.splice(raids.indexOf(r), 1); if (p) HUD.setBoss('raid', null, null); }
      else if (near) HUD.setBoss('raid', 'Raid - ' + (r.over === 'win' ? 'Victory' : 'Defeat'), r.over === 'win' ? 1 : 0, 'red');
      return;
    }
    if (r.ticks > 48000) { raids.splice(raids.indexOf(r), 1); HUD.setBoss('raid', null, null); return; }
    // the village is lost when nobody lives there any more
    if (r.wave > 0 && villagersNear(r.cx, r.cy, r.cz, 64) === 0 && (now() % 40 === 0)) { r.over = 'loss'; return; }
    if (!r.raiders.length) {
      if (r.wave >= r.waves) { win(r); return; }
      if (near) HUD.setBoss('raid', 'Raid', 1 - r.cooldown / 300, 'red');
      if (--r.cooldown <= 0) { if (spawnWave(r)) r.cooldown = 300; else r.cooldown = 20; }
      return;
    }
    // raiders go for the village, and the bar shows how much of the wave is left
    for (const m of r.raiders) if (!m.target && !m.vehicle && (m.age % 40 === 0) && ((m.x - r.cx) ** 2 + (m.z - r.cz) ** 2 > 16 * 16 || m.nav.done())) m.nav.moveTo(r.cx + (Math.random() - 0.5) * 16, r.cy, r.cz + (Math.random() - 0.5) * 16, 1);
    const hp = r.raiders.reduce((s, m) => s + Math.max(0, m.health), 0);
    if (near) HUD.setBoss('raid', 'Raid - Raiders Remaining: ' + r.raiders.length, Math.min(1, hp / Math.max(1, r.total)), 'red');
  }
  function win(r) {
    r.over = 'win'; r.overT = 0;
    for (const h of r.heroes) if (!h.dead) { h.addEffect('hero_of_the_village', 48000, r.level - 1); if (h.isPlayer) Advancements.fire('hero_of_the_village'); Stats && Stats.add && Stats.add('custom', 'raid_win'); }
    Sound.play('raid_horn', null, { x: r.cx, y: r.cy, z: r.cz });
  }
  // a bell rung during a raid makes the raiders within 48 blocks glow for 3 seconds
  function bellRung(x, y, z) {
    for (const r of raids) for (const m of r.raiders) if ((m.x - x) ** 2 + (m.y - y) ** 2 + (m.z - z) ** 2 < 48 * 48) m.addEffect('glowing', 60, 0);
  }
  // ---------------------------------------------------------------- pillager patrols
  let nextPatrol = 12000 + Math.floor(Math.random() * 1200);
  function patrols(p) {
    if (--nextPatrol > 0) return;
    nextPatrol += 12000 + Math.floor(Math.random() * 1200);
    const day = Math.floor((Game.dayTime || 0) / 24000), t = ((Game.dayTime % 24000) + 24000) % 24000;
    if (day < 5 || t > 12000 || Math.random() >= 0.2 || !Game.rules.doMobSpawning || Game.difficulty === 'peaceful' || World.dim !== 'overworld') return;
    if (!p || p.dead || p.spectator) return;
    spawnPatrol(p);
  }
  function spawnPatrol(p) {
    const sx = (24 + Math.floor(Math.random() * 24)) * (Math.random() < 0.5 ? -1 : 1), sz = (24 + Math.floor(Math.random() * 24)) * (Math.random() < 0.5 ? -1 : 1);
    const x = Math.floor(p.x) + sx, z = Math.floor(p.z) + sz;
    if (!World.chunkAt(x, z) || isVillage(x, p.y, z)) return false;
    const b = BIOMES[World.biomeAt(x, z)]; if (b && b.name === 'mushroom_fields') return false;
    const base = { easy: 1, normal: 2, hard: 3 }[Game.difficulty] || 2, n = base + Math.floor(Math.random() * 2);
    let leader = null;
    for (let i = 0; i < n; i++) {
      const px = x + Math.floor(Math.random() * 5) - 2, pz = z + Math.floor(Math.random() * 5) - 2, py = World.heightAt(px, pz) + 1;
      if ((World.getLight(px, py, pz) & 15) > 8 || BLOCKS[World.getBlock(px, py - 1, pz)].fluid) continue;
      const m = Mobs.create('pillager', px + 0.5, py, pz + 0.5); if (!m) continue;
      if (!leader) { captain(m); leader = m; m.patrolTarget = [px + (Math.random() - 0.5) * 1000, pz + (Math.random() - 0.5) * 1000]; }
      else m.patrolLeader = leader;
      Entities.add(m);
    }
    return !!leader;
  }
  // patrols march: the captain toward its far point, the others after the captain
  function tickPatrollers() {
    if (now() % 20 !== 0) return;
    for (const m of Entities.list) {
      if (m.type !== 'pillager' || m.dead || m.target || m.raid) continue;
      if (m.patrolTarget) { if (m.nav.done()) { const [tx, tz] = m.patrolTarget, dx = tx - m.x, dz = tz - m.z, l = Math.hypot(dx, dz); if (l < 10) { m.patrolTarget = null; continue; } const s = Math.min(16, l) / l; m.nav.moveTo(m.x + dx * s, m.y, m.z + dz * s, 0.7); } }
      else if (m.patrolLeader && !m.patrolLeader.dead && !m.patrolLeader.removed && m.distTo(m.patrolLeader) > 4 && m.nav.done()) m.nav.moveTo(m.patrolLeader.x + (Math.random() - 0.5) * 4, m.patrolLeader.y, m.patrolLeader.z + (Math.random() - 0.5) * 4, 0.8);
    }
  }
  // the game's VillageSiege: at midnight, one night in ten, twenty zombies gather at a spot about 32 blocks from a
  // player in a village and come in, whatever the light (not in Peaceful, not with mob spawning off)
  let siege = null, siegeNight = -1;
  function sieges(p) {
    if (World.dim !== 'overworld' || Game.difficulty === 'peaceful' || !Game.rules.doMobSpawning || !p || p.dead) { siege = null; return; }
    const day = Math.floor(Game.dayTime / 24000), t = ((Game.dayTime % 24000) + 24000) % 24000;
    if (t >= 18000 && t < 18020 && siegeNight !== day) { siegeNight = day; siege = Math.random() < 0.1 ? { left: 20, at: null, next: 0 } : null; }
    if (!siege || t < 13000 || t > 23000) { if (t > 23000) siege = null; return; }
    if (!siege.at) {
      if (!isVillage(p.x, p.y, p.z)) return;
      for (let k = 0; k < 10 && !siege.at; k++) {
        const a = Math.random() * Math.PI * 2, x = Math.floor(p.x + Math.cos(a) * 32), z = Math.floor(p.z + Math.sin(a) * 32);
        if (!World.chunkAt(x, z) || !isVillage(x, p.y, z)) continue;
        const y = World.heightAt(x, z) + 1; if (Mobs.spawnable('zombie', x, y, z) || !BLOCKS[World.getBlock(x, y - 1, z)].fluid) siege.at = [x, y, z];
      }
      return;
    }
    if (--siege.next > 0 || siege.left <= 0) return;
    siege.next = 2;
    const [x0, , z0] = siege.at, x = x0 + rnd(16) - 8, z = z0 + rnd(16) - 8, y = World.heightAt(x, z) + 1;
    if (!World.chunkAt(x, z) || BLOCKS[World.getBlock(x, y - 1, z)].fluid) return;
    const zb = Mobs.spawnEntity('zombie', x + 0.5, y, z + 0.5); if (zb) { zb.target = p; siege.left--; }
  }
  function tick() {
    const p = Game.player;
    tickPlayer(p);
    for (const r of raids.slice()) tickRaid(r);
    if (World.dim === 'overworld') { patrols(p); tickPatrollers(); sieges(p); }
  }
  function clear() { raids.length = 0; }
  return { tick, start, isVillage, bellRung, spawnPatrol, raids, clear, TYPES, get siege() { return siege; }, startSiege() { siege = { left: 20, at: null, next: 0 }; } };
})();
