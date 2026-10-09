'use strict';
/* Trial chambers' trial spawners and vaults (Java Edition 1.21).
   A trial spawner wakes when a player comes within 14 blocks in plain sight. It then sends its wave: mobs one by
   one, a few at a time, more for each extra player. When they are all dead it opens and ejects a reward for
   each player (a trial key or consumables), then rests for 30 minutes. A player carrying Bad Omen (turned into
   Trial Omen) or Trial Omen makes it ominous: a harder wave, armed mobs, items dropped from above the players,
   and better rewards, including ominous trial keys.
   A vault lights up for a player within 4 blocks who hasn't opened it yet. A trial key (an ominous trial key
   for an ominous vault) opens it once per player, and it ejects the reward one item a second. Every state,
   timing and loot table is the game's. */
const Trials = (() => {
  const B = BID, get = World.getBlock.bind(World), state = World.getState.bind(World);
  // ---------------------------------------------------------------- the trial chamber spawner configurations
  const DEF = { range: 4, total: 6, sim: 2, totalPP: 2, simPP: 1, tbs: 40, loot: [['spawners/trial_chamber/consumables', 1], ['spawners/trial_chamber/key', 1]] };
  const OM = [['spawners/ominous/trial_chamber/key', 3], ['spawners/ominous/trial_chamber/consumables', 7]];
  const c = (o) => Object.assign({}, DEF, o);
  const melee = 'equipment/trial_chamber_melee', ranged = 'equipment/trial_chamber_ranged';
  const CONFIGS = {
    breeze: { mob: 'breeze', n: c({ sim: 1, simPP: 0.5, tbs: 20, total: 2, totalPP: 1 }), o: c({ simPP: 0.5, tbs: 20, total: 4, totalPP: 1, loot: OM }) },
    melee_husk: { mob: 'husk', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 3, simPP: 0.5, tbs: 20, loot: OM, equip: melee }) },
    melee_spider: { mob: 'spider', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 4, simPP: 0.5, tbs: 20, total: 12, loot: OM }) },
    melee_zombie: { mob: 'zombie', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 3, simPP: 0.5, tbs: 20, loot: OM, equip: melee }) },
    ranged_poison_skeleton: { mob: 'bogged', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 3, simPP: 0.5, tbs: 20, loot: OM, equip: ranged }) },
    ranged_skeleton: { mob: 'skeleton', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 3, simPP: 0.5, tbs: 20, loot: OM, equip: ranged }) },
    ranged_stray: { mob: 'stray', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 3, simPP: 0.5, tbs: 20, loot: OM, equip: ranged }) },
    slow_ranged_poison_skeleton: { mob: 'bogged', n: c({ sim: 4, simPP: 2, tbs: 160 }), o: c({ sim: 4, simPP: 2, tbs: 160, loot: OM, equip: ranged }) },
    slow_ranged_skeleton: { mob: 'skeleton', n: c({ sim: 4, simPP: 2, tbs: 160 }), o: c({ sim: 4, simPP: 2, tbs: 160, loot: OM, equip: ranged }) },
    slow_ranged_stray: { mob: 'stray', n: c({ sim: 4, simPP: 2, tbs: 160 }), o: c({ sim: 4, simPP: 2, tbs: 160, loot: OM, equip: ranged }) },
    small_melee_baby_zombie: { mob: 'zombie', baby: true, n: c({ simPP: 0.5, tbs: 20 }), o: c({ simPP: 0.5, tbs: 20, loot: OM, equip: melee }) },
    small_melee_cave_spider: { mob: 'cave_spider', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 4, simPP: 0.5, tbs: 20, total: 12, loot: OM }) },
    small_melee_silverfish: { mob: 'silverfish', n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 4, simPP: 0.5, tbs: 20, total: 12, loot: OM }) },
    small_melee_slime: { mob: 'slime', slime: [2, 3], n: c({ sim: 3, simPP: 0.5, tbs: 20 }), o: c({ sim: 4, simPP: 0.5, tbs: 20, total: 12, loot: OM }) },
  };
  const COOLDOWN = 36000, RANGE = 14, ITEM_SPAWNER_EVERY = 160;
  // trial spawner states (low three bits; 8 = ominous)
  const S = { INACTIVE: 0, WAITING: 1, ACTIVE: 2, WAITING_REWARD: 3, EJECTING: 4, COOLDOWN: 5 };
  const now = () => Game.gameTime;
  const center = be => [be.x + 0.5, be.y + 0.5, be.z + 0.5];
  const clearLine = (ax, ay, az, bx, by, bz) => { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 1e-6) return true; return !Phys.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, id => SOLID[id] && BLOCKS[id].model !== 'cross' && id !== B.trial_spawner); };
  function newBE(kind) { return { type: 'trial_spawner', kind: kind || 'melee_zombie', mobs: [], spawned: 0, nextAt: 0, cooldownEnd: 0, players: 0, ejectAt: 0, ejectLoot: null, nextItemAt: 0 }; }
  // a spawner given a mob with a spawn egg uses the default settings for it
  const kindOf = be => be.customMob ? { mob: be.customMob, n: DEF, o: c({ loot: OM }) } : CONFIGS[be.kind] || CONFIGS.melee_zombie;
  const cfgOf = (be, om) => { const k = kindOf(be); return om ? k.o : k.n; };
  const setState = (be, st) => World.setBlock(be.x, be.y, be.z, B.trial_spawner, st, 4);
  // players in range and in sight (survival or adventure, alive)
  function playersNear(be) {
    const p = Game.player, [cx, cy, cz] = center(be);
    if (!p || p.dead || p.creative || p.spectator) return [];
    if ((p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2 > RANGE * RANGE) return [];
    return clearLine(cx, cy, cz, p.x, p.eyeY, p.z) ? [p] : [];
  }
  // every second: look for players; one with Bad Omen or Trial Omen makes the spawner ominous
  function detect(be, st) {
    if ((now() + be.x + be.z) % 20 !== 0) return st;
    const list = playersNear(be);
    if (!(st & 8)) for (const p of list) {
      const bo = p.effect('bad_omen');
      if (bo) { p.removeEffect('bad_omen'); p.addEffect('trial_omen', 18000 * (bo.amp + 1), 0); }
      if (p.effect('trial_omen')) { st = becomeOminous(be, st); break; }
    }
    if (list.length) { if (!be.players) Sound.play('trial_spawner_detect_player', null, { x: be.x, y: be.y, z: be.z }); be.players = Math.max(be.players, list.length); }
    return st;
  }
  function becomeOminous(be, st) {
    for (const m of liveMobs(be)) { burst(m.x, m.y, m.z, false); m.removed = true; }
    be.mobs = []; be.spawned = 0; be.nextAt = now() + cfgOf(be, true).tbs; be.nextItemAt = now() + ITEM_SPAWNER_EVERY;
    Sound.play('trial_spawner_ominous_activate', null, { x: be.x, y: be.y, z: be.z });
    for (let i = 0; i < 20; i++) Particles.flameAt(be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), 0, 0.05, 0, true);
    return st | 8;
  }
  const liveMobs = be => { const ids = new Set(be.mobs); return Entities.list.filter(e => ids.has(e.trialId) && !e.dead && !e.removed); };
  // a mob of the spawner's kind within 4 blocks, somewhere it fits and the spawner can see
  function spawnMob(be, om) {
    const K = kindOf(be), cfg = cfgOf(be, om);
    if (Game.difficulty === 'peaceful') return null;
    const sx = be.x + (Math.random() - Math.random()) * cfg.range + 0.5, sy = be.y + Math.floor(Math.random() * 3) - 1, sz = be.z + (Math.random() - Math.random()) * cfg.range + 0.5;
    const m = Mobs.create(K.mob, sx, sy, sz); if (!m) return null;
    if (K.slime && m.setSize) m.setSize(K.slime[Math.floor(Math.random() * K.slime.length)]);
    if (!Phys.boxFree(sx - m.w / 2, sy, sz - m.w / 2, sx + m.w / 2, sy + m.h, sz + m.w / 2)) return null;
    if (!clearLine(be.x + 0.5, be.y + 0.5, be.z + 0.5, sx, sy, sz)) return null;
    m.yaw = m.bodyYaw = Math.random() * Math.PI * 2;
    if (K.baby) m.setBaby(); else if (m.baby && m.growUp) m.growUp();
    Mobs.equip(m);
    if (cfg.equip) for (const s of LootTables.roll(cfg.equip, { entity: m })) equipSlot(m, s);
    m.persistent = true; m.trialId = (be.idSeq = (be.idSeq || 0) + 1) + ':' + be.x + ',' + be.y + ',' + be.z;
    Entities.add(m);
    burst(be.x + 0.5, be.y + 0.5, be.z + 0.5, om); burst(m.x, m.y, m.z, om);
    Sound.play('trial_spawner_spawn_mob', null, { x: be.x, y: be.y, z: be.z });
    GameEvents.emit('entity_place', m.x, m.y, m.z, m);
    return m;
  }
  // the equipment loot tables give armour and a weapon: each goes on in its slot (and never drops)
  function equipSlot(m, s) {
    const it = ITEMS[s.id];
    const slot = it.armor ? ['head', 'chest', 'legs', 'feet'][it.armor.slot] : 'main';
    m.equip[slot] = s; m.dropChance = Object.assign({ head: 0.085, chest: 0.085, legs: 0.085, feet: 0.085, main: 0.085, off: 0.085 }, m.dropChance || {}, { [slot]: 0 });
    if (it.armor) { let pts = 0; for (const k of ['head', 'chest', 'legs', 'feet']) { const e = m.equip[k]; if (e && ITEMS[e.id].armor) pts += ITEMS[e.id].armor.pts; } m.armorPts = pts; }
  }
  function burst(x, y, z, om) { for (let i = 0; i < 12; i++) Particles.flameAt(x + (Math.random() - 0.5), y + Math.random(), z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.05, 0.03, (Math.random() - 0.5) * 0.05, om); Particles.smoke && Particles.smoke({ x, y: y + 0.5, z, w: 0.6, h: 0.6 }, 6); }
  // ominous: every 8 seconds an item spawner appears above a player and drops something on them
  function ominousItems(be) {
    if (now() < be.nextItemAt) return;
    const p = playersNear(be)[0]; if (!p) return;
    const items = LootTables.roll('spawners/trial_chamber/items_to_drop_when_ominous', {});
    const s = items[Math.floor(Math.random() * items.length)]; if (!s) return;
    // up to 5 blocks over the player's head, under any ceiling, a little to one side
    let h = 0; while (h < 5 && !SOLID[get(Math.floor(p.x), Math.floor(p.eyeY + h + 1), Math.floor(p.z))]) h++;
    if (h < 2) return;
    const e = new OminousItemSpawner(p.x + (Math.random() - 0.5) * 2, p.eyeY + h - 0.5, p.z + (Math.random() - 0.5) * 2, s);
    Entities.add(e);
    Sound.play('trial_spawner_spawn_item_begin', null, { x: e.x, y: e.y, z: e.z });
    be.nextItemAt = now() + ITEM_SPAWNER_EVERY;
  }
  // the reward: one roll of a randomly chosen table, thrown up out of the top
  function eject(be, table) {
    for (const s of LootTables.roll(table, {})) {
      const e = Drops.spawnItem(be.x + 0.5, be.y + 1.2, be.z + 0.5, s);
      if (e) { e.vx = (Math.random() - 0.5) * 0.1; e.vy = 0.3 + Math.random() * 0.1; e.vz = (Math.random() - 0.5) * 0.1; }
    }
    Sound.play('trial_spawner_eject_item', null, { x: be.x, y: be.y, z: be.z });
    for (let i = 0; i < 8; i++) Particles.smokeAt(be.x + 0.5 + (Math.random() - 0.5) * 0.4, be.y + 1, be.z + 0.5 + (Math.random() - 0.5) * 0.4, 0, 0.05, 0);
  }
  const pick = list => { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [v, w] of list) { r -= w; if (r < 0) return v; } return list[0][0]; };
  // ---------------------------------------------------------------- the trial spawner's tick (TrialSpawnerState.tickAndGetNext)
  function tick(be) {
    if (get(be.x, be.y, be.z) !== B.trial_spawner) return;
    let st = state(be.x, be.y, be.z);
    const s0 = st & 7, om = () => !!(st & 8), cfg = () => cfgOf(be, om());
    let s = s0;
    be.ospin = be.spin || 0;
    be.spin = ((be.spin || 0) + (s === S.ACTIVE ? 10 : s === S.WAITING ? 2 : 0)) % 360;
    ambient(be, s, om());
    switch (s) {
      case S.INACTIVE: s = S.WAITING; break;
      case S.WAITING:
        st = detect(be, st);
        if (be.players > 0) s = S.ACTIVE;
        break;
      case S.ACTIVE: {
        st = detect(be, st);
        if (om()) ominousItems(be);
        const add = Math.max(0, be.players - 1), C = cfg();
        const total = Math.floor(C.total + C.totalPP * add), sim = Math.floor(C.sim + C.simPP * add);
        const alive = liveMobs(be); be.mobs = alive.map(m => m.trialId);
        if (be.spawned >= total) {
          if (!alive.length) { be.cooldownEnd = now() + COOLDOWN; be.spawned = 0; be.nextAt = 0; be.ejectAt = now() + 40; s = S.WAITING_REWARD; }
        } else if (now() >= be.nextAt && alive.length < sim) {
          const m = spawnMob(be, om());
          if (m) { be.mobs.push(m.trialId); be.spawned++; be.nextAt = now() + C.tbs; }
        }
        break;
      }
      case S.WAITING_REWARD:
        if (now() >= be.ejectAt) { Sound.play('trial_spawner_open_shutter', null, { x: be.x, y: be.y, z: be.z }); s = S.EJECTING; be.ejectAt = now(); }
        break;
      case S.EJECTING:
        if (now() < be.ejectAt) break;
        if (be.players <= 0) { Sound.play('trial_spawner_close_shutter', null, { x: be.x, y: be.y, z: be.z }); be.ejectLoot = null; s = S.COOLDOWN; break; }
        if (!be.ejectLoot) be.ejectLoot = pick(cfg().loot);
        eject(be, be.ejectLoot); be.players--; be.ejectAt = now() + 30;
        break;
      case S.COOLDOWN:
        if (now() >= be.cooldownEnd) { st &= ~8; be.players = 0; be.spawned = 0; be.mobs = []; be.nextAt = 0; s = S.WAITING; }
        break;
    }
    if (s !== s0 || (st & 8) !== (state(be.x, be.y, be.z) & 8)) setState(be, (st & 8) | s);
  }
  // flames while waiting, flames and smoke while active, smoke while cooling down (blue for ominous)
  function ambient(be, s, om) {
    const p = Game.player; if (!p || (p.x - be.x) ** 2 + (p.z - be.z) ** 2 > 1024) return;
    if (s === S.WAITING && Math.random() < 0.3) Particles.flameAt(be.x + 0.3 + Math.random() * 0.4, be.y + 0.3 + Math.random() * 0.4, be.z + 0.3 + Math.random() * 0.4, 0, 0, 0, om);
    else if (s === S.ACTIVE) { Particles.flameAt(be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), 0, 0, 0, om); if (Math.random() < 0.5) Particles.smokeAt(be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), 0, 0, 0); }
    else if (s === S.COOLDOWN && Math.random() < 0.1) Particles.smokeAt(be.x + 0.2 + Math.random() * 0.6, be.y + 1, be.z + 0.2 + Math.random() * 0.6, 0, 0.02, 0);
    if ((s === S.WAITING || s === S.ACTIVE) && Math.random() < 0.0125) Sound.play(om ? 'trial_spawner_ambient_ominous' : 'trial_spawner_ambient', null, { x: be.x, y: be.y, z: be.z });
  }

  // ---------------------------------------------------------------- vaults (state: facing in bits 0-2, 8/16: inactive, active, unlocking, ejecting; 32 ominous)
  const V = { INACTIVE: 0, ACTIVE: 1, UNLOCKING: 2, EJECTING: 3 };
  const vstate = st => (st >> 3) & 3;
  function newVault() { return { type: 'vault', rewarded: false, items: [], total: 0, resume: 0, display: null, nextDisplay: 0 }; }
  const lootOf = st => st & 32 ? 'chests/trial_chambers/reward_ominous' : 'chests/trial_chambers/reward';
  function vaultNear(be, r) { const p = Game.player; if (!p || p.dead || p.spectator || be.rewarded) return false; return (p.x - be.x - 0.5) ** 2 + (p.y - be.y - 0.5) ** 2 + (p.z - be.z - 0.5) ** 2 <= r * r; }
  function vaultTick(be) {
    if (get(be.x, be.y, be.z) !== B.vault) return;
    const st = state(be.x, be.y, be.z), vs = vstate(st);
    // while lit, the vault shows a random item from its loot, a new one each second
    if ((vs === V.ACTIVE) && now() >= (be.nextDisplay || 0)) { const r = LootTables.roll(lootOf(st), {}); be.display = r[Math.floor(Math.random() * r.length)] || null; be.nextDisplay = now() + 20; }
    if (vs === V.INACTIVE) be.display = null;
    if (now() < (be.resume || 0)) return;
    let n = vs;
    switch (vs) {
      case V.INACTIVE: n = vaultNear(be, 4) ? V.ACTIVE : V.INACTIVE; be.resume = now() + 20; break;
      case V.ACTIVE: n = vaultNear(be, 4.5) ? V.ACTIVE : V.INACTIVE; be.resume = now() + 20; break;
      case V.UNLOCKING: be.resume = now() + 20; n = V.EJECTING; break;
      case V.EJECTING:
        if (!be.items.length) { n = vaultNear(be, 4.5) ? V.ACTIVE : V.INACTIVE; be.resume = now() + 20; Sound.play('vault_close_shutter', null, { x: be.x, y: be.y, z: be.z }); break; }
        { const s = be.items.shift(), f = 1 - be.items.length / Math.max(1, be.total);
          const e = Drops.spawnItem(be.x + 0.5, be.y + 1.2, be.z + 0.5, s); if (e) { e.vx = (Math.random() - 0.5) * 0.06; e.vy = 0.25; e.vz = (Math.random() - 0.5) * 0.06; }
          Sound.play('vault_eject_item', null, { x: be.x, y: be.y, z: be.z, pitch: 0.8 + 0.4 * f });
          be.display = be.items[0] || null; be.resume = now() + 20; }
        break;
    }
    if (n !== vs) {
      World.setBlock(be.x, be.y, be.z, B.vault, (st & ~24) | (n << 3), 4);
      if (vs === V.INACTIVE && n === V.ACTIVE) Sound.play('vault_activate', null, { x: be.x, y: be.y, z: be.z });
      if (vs === V.ACTIVE && n === V.INACTIVE) Sound.play('vault_deactivate', null, { x: be.x, y: be.y, z: be.z });
    }
  }
  // putting a key in
  function vaultUse(p, x, y, z, held) {
    let be = World.getBE(x, y, z); if (!be) { be = newVault(); World.setBE(x, y, z, be); }
    const st = state(x, y, z);
    if (!held) return false;
    if (vstate(st) !== V.ACTIVE) return true;
    const key = st & 32 ? 'ominous_trial_key' : 'trial_key';
    if (ITEMS[held.id].name !== key) { Sound.play('vault_insert_item_fail', null, { x, y, z }); return true; }
    if (be.rewarded) { Sound.play('vault_reject_rewarded_player', null, { x, y, z }); return true; }
    const items = LootTables.roll(lootOf(st), { entity: p });
    if (!items.length) return true;
    if (!p.creative) { held.count--; if (!held.count) p.inv.held = null; p.inv.changed(); }
    be.items = items; be.total = items.length; be.display = items[0]; be.rewarded = true; be.resume = now() + 14;
    World.setBlock(x, y, z, B.vault, (st & ~24) | (V.UNLOCKING << 3), 4);
    Sound.play('vault_insert_item', null, { x, y, z }); Sound.play('vault_open_shutter', null, { x, y, z });
    return true;
  }

  // ---------------------------------------------------------------- what spins inside: the spawner's mob, the vault's item
  const shown = new Map();
  function frame(a) {
    const p = Game.player; if (!p || !EntityRender) return;
    const seen = new Set();
    for (const ch of World.chunks.values()) {
      if (!ch.be.size || Math.abs(ch.cx * 16 + 8 - p.x) > 40 || Math.abs(ch.cz * 16 + 8 - p.z) > 40) continue;
      for (const be of ch.be.values()) {
        if (be.type !== 'trial_spawner' && be.type !== 'vault') continue;
        if ((be.x - p.x) ** 2 + (be.y - p.y) ** 2 + (be.z - p.z) ** 2 > 1024) continue;
        const k = be.x + ',' + be.y + ',' + be.z, st = state(be.x, be.y, be.z);
        if (be.type === 'trial_spawner') {
          const s = st & 7; if (s !== S.WAITING && s !== S.ACTIVE) continue;
          const K = kindOf(be);
          let v = shown.get(k); if (v && v.what !== K.mob) { v.dispose(); shown.delete(k); v = null; }
          if (!v) {
            const fake = Mobs.create(K.mob, be.x + 0.5, be.y, be.z + 0.5); if (!fake || !EntityModels.DEFS[fake.model || fake.type]) continue;
            if (K.baby) fake.setBaby(); if (K.slime && fake.setSize) fake.setSize(K.slime[0]);
            const vis = new EntityRender.MobVisual(fake, fake.model || fake.type);
            v = { what: K.mob, vis, fake, dispose: () => vis.dispose() }; shown.set(k, v);
          }
          seen.add(k);
          const f = v.fake, spin = (be.ospin || 0) + ((((be.spin || 0) - (be.ospin || 0)) % 360 + 360) % 360) * a;
          f.x = f.px = be.x + 0.5; f.y = f.py = be.y; f.z = f.pz = be.z + 0.5; f.bodyYaw = f.pbodyYaw = f.yaw = f.pyaw = 0;
          v.vis.update(a, { ls: 0, la: 0, t: Game.gameTime + a, headYaw: 0, pitch: 0, swing: 0, e: f });
          const o = v.vis.obj, sc = 0.53125 / Math.max(1, f.w, f.h);
          o.position.set(be.x + 0.5, be.y + 0.2, be.z + 0.5); o.rotation.set(-30 * Math.PI / 180, spin * Math.PI / 180, 0, 'YXZ'); o.scale.setScalar(sc);
        } else {
          if (!be.display || vstate(st) === V.INACTIVE) continue;
          let v = shown.get(k); const id = be.display.id;
          if (v && v.what !== id) { v.dispose(); shown.delete(k); v = null; }
          if (!v) { const m = ItemMesh.mesh(id); if (!m) continue; m.matrixAutoUpdate = true; const g = new THREE.Group(); g.add(m); scene.add(g); v = { what: id, g, dispose: () => { scene.remove(g); m.material.dispose && m.material.dispose(); } }; shown.set(k, v); }
          seen.add(k);
          const t = Game.gameTime + a;
          v.g.position.set(be.x + 0.5, be.y + 0.4 + Math.sin(t / 10) * 0.05, be.z + 0.5); v.g.rotation.set(0, t * 0.05, 0); v.g.scale.setScalar(0.5);
          const [sl, bl] = EntityRender.lightAt(be.x + 0.5, be.y + 1, be.z + 0.5); const mm = v.g.children[0].material; if (mm && mm.uniforms && mm.uniforms.uEnv) mm.uniforms.uEnv.value.set(sl, Math.max(bl, 0.8));
        }
      }
    }
    for (const [k, v] of shown) if (!seen.has(k)) { v.dispose(); shown.delete(k); }
  }
  function clear() { for (const v of shown.values()) v.dispose(); shown.clear(); }
  return { CONFIGS, S, V, newBE, newVault, tick, vaultTick, vaultUse, frame, clear };
})();

// an ominous item spawner: hangs over a player for 3 to 6 seconds, then lets its item go (projectiles are fired
// straight down, anything else falls)
class OminousItemSpawner extends Entity {
  constructor(x, y, z, s) { super('ominous_item_spawner', x, y, z); this.stack = s; this.w = this.h = 0.25; this.noGravity = true; this.noPick = true; this.wait = 60 + Math.floor(Math.random() * 61); this.bobOffset = Math.random() * Math.PI * 2; }
  tick() {
    this.tickBase(); this.age++;
    if (Math.random() < 0.5) Particles.flameAt(this.x + (Math.random() - 0.5) * 0.4, this.y + (Math.random() - 0.5) * 0.4, this.z + (Math.random() - 0.5) * 0.4, 0, 0, 0, true);
    if (this.age < this.wait) return;
    const s = this.stack, n = ITEMS[s.id].name;
    if (n === 'arrow' || n === 'tipped_arrow' || n === 'spectral_arrow') { const a = Entities.add(new Arrow(null, this.x, this.y, this.z, { potion: s.tag && s.tag.potion })); a.vx = 0; a.vy = -1.1; a.vz = 0; a.pickup = 0; }
    else if (n === 'fire_charge') Projectiles.fireball(null, this.x, this.y, this.z, 0, -0.1, 0, false);
    else if (['splash_potion', 'lingering_potion', 'wind_charge', 'snowball', 'egg'].includes(n)) { const e = Projectiles.spawn(n, null, this.x, this.y, this.z, s.tag); if (e) { e.vx = 0; e.vy = -0.6; e.vz = 0; } }
    else { const e = Drops.spawnItem(this.x, this.y, this.z, s); if (e) { e.vx = e.vz = 0; } }
    Sound.play('trial_spawner_spawn_item', null, { x: this.x, y: this.y, z: this.z });
    for (let i = 0; i < 8; i++) Particles.flameAt(this.x + (Math.random() - 0.5) * 0.6, this.y + (Math.random() - 0.5) * 0.6, this.z + (Math.random() - 0.5) * 0.6, 0, -0.02, 0, true);
    this.removed = true;
  }
  save() { return null; }
}
EntityRender.register('ominous_item_spawner', e => new EntityRender.ItemVisual(e));

// textures: the spawner's and the vault's lit, open and ominous faces
(() => {
  const { def, H } = Tex;
  // lit: the bars next to the openings glow (the openings stay open, so what's inside shows)
  const glow = (c, col) => { const edge = []; c.each((x, y) => { const p = c.get(x, y); if (p[3] === 0) return; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && c.get(nx, ny)[3] === 0) { edge.push([x, y]); break; } } }); const k = H(col); for (const [x, y] of edge) { const p = c.get(x, y); c.px(x, y, [Math.round(p[0] * 0.3 + k[0] * 0.7), Math.round(p[1] * 0.3 + k[1] * 0.7), Math.round(p[2] * 0.3 + k[2] * 0.7)]); } };
  // ominous: copper and orange turn teal and blue
  const ominous = (c, base) => { c.copy(base); c.each((x, y) => { const p = c.get(x, y); if (p[3] === 0) return; const r = p[0], g = p[1], b = p[2]; if (r > g + 20 && r > b + 20) c.px(x, y, [Math.round(b * 0.6 + 20), Math.round(g * 0.9 + 30), Math.min(255, Math.round(r * 0.95 + 20))]); }); };
  def('trial_spawner_side_active', c => { c.copy('trial_spawner_side_inactive'); glow(c, 0xe08a2a); });
  def('trial_spawner_top_active', c => { c.copy('trial_spawner_top_inactive'); glow(c, 0xe08a2a); });
  def('trial_spawner_top_ejecting_reward', c => { c.copy('trial_spawner_top_inactive'); c.rect(4, 4, 11, 11, H(0x1a1410)); c.rect(5, 5, 10, 10, H(0xf0a040)); c.rect(6, 6, 9, 9, H(0xffe08a)); });
  for (const n of ['trial_spawner_side_inactive', 'trial_spawner_side_active', 'trial_spawner_top_inactive', 'trial_spawner_top_active', 'trial_spawner_top_ejecting_reward', 'trial_spawner_bottom']) def(n + '_ominous', c => { ominous(c, n); if (n.includes('active') && !n.includes('inactive')) glow(c, 0x6ad8e8); });
  def('vault_side_on', c => { c.copy('vault_side_off'); glow(c, 0xf0a030); });
  def('vault_front_ejecting', c => { c.copy('vault_front_on'); c.rect(5, 5, 10, 10, H(0xffe08a)); c.rect(6, 6, 9, 9, H(0xffffff)); });
  def('vault_top_ejecting', c => { c.copy('vault_top'); c.rect(5, 5, 10, 10, H(0xf0b040)); });
  for (const n of ['vault_front_off', 'vault_front_on', 'vault_front_ejecting', 'vault_side_off', 'vault_side_on', 'vault_top', 'vault_top_ejecting', 'vault_bottom']) def(n + '_ominous', c => ominous(c, n));
})();
