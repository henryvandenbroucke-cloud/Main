'use strict';
/* Mining, placing, using and attacking.
   Mining speed (per tick): tool speed (1 by hand or with the wrong tool), + Efficiency^2 + 1, x Haste, x Mining
   Fatigue, /5 under water without Aqua Affinity, /5 in the air; divided by hardness and by 30 when the tool can
   harvest the block or 100 when it can't. Attacks use the 1.9+ cooldown, critical hits and sweeping. */
const Interact = (() => {
  let target = null, entTarget = null;
  let mining = null, breakDelay = 0, useDelay = 0;
  function reach(p) { return p.creative ? 5 : 4.5; }
  function update(p) {
    const eye = [p.x, p.eyeY, p.z], dir = p.lookVec();
    const R = reach(p);
    target = p.spectator ? null : Phys.raycast(eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], R, (id) => !BLOCKS[id].fluid);
    // entities in reach (3 blocks in survival)
    entTarget = null;
    const eR = p.creative ? 5 : 3;
    let best = target ? Math.min(target.t, eR) : eR;
    for (const e of Entities.list) {
      if (e === p || e.removed || e.dead || e.type === 'item' || e.type === 'xp_orb' || e.type === 'arrow' || e.noPick || e === p.vehicle) continue;
      if (e.dist2(p.x, p.y, p.z) > 64) continue;
      const hw = e.w / 2 + 0.1, pb = e.pickBox && e.pickBox();
      const h = pb ? Phys.rayBox(eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], pb[0], pb[1], pb[2], pb[3], pb[4], pb[5]) : Phys.rayBox(eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], e.x - hw, e.y, e.z - hw, e.x + hw, e.y + e.h, e.z + hw);
      if (h && h.t < best) { best = h.t; entTarget = e; }
    }
    if (entTarget) target = null;
    Outline.show(UI.screenOpen() ? null : target);
  }
  // ---------------------------------------------------------------- mining
  function breakSpeed(p, id, tool) {
    const md = MCDATA.blocks[BLOCKS[id].name];
    const it = tool ? ITEMS[tool.id] : null;
    let speed = 1;
    // the data leaves the tool kind out for blocks that need a better pickaxe (ores, obsidian, metal blocks...):
    // those are all pickaxe blocks, so the pickaxe's speed counts for them too
    const kind = md ? (md[4] || (md[5] > 0 ? 'pickaxe' : '')) : '', n = BLOCKS[id].name;
    if (it && it.tool) {
      const t = it.tool;
      if (t.kind === 'shears') speed = n === 'cobweb' || n.endsWith('_leaves') ? 15 : n.endsWith('_wool') ? 5 : (n === 'vine' || n === 'glow_lichen') ? 2 : 1;
      else if (t.kind === 'sword') speed = n === 'cobweb' ? 15 : n === 'bamboo' ? 100 : (BLOCKS[id].model === 'cross' || n.endsWith('_leaves') || n === 'pumpkin' || n === 'melon' || n === 'cocoa' || n === 'vine') ? 1.5 : 1;
      else if (kind && t.kind === kind) speed = t.speed;
      else if (t.kind === 'hoe' && n.endsWith('_leaves')) speed = t.speed;
      else if (t.kind === 'axe' && (BLOCKS[id].model === 'cross' || n === 'cocoa' || n === 'vine' || n === 'bee_nest' || n === 'beehive' || n === 'ladder' || n.endsWith('_mushroom_block') || n === 'mushroom_stem' || n === 'pumpkin' || n === 'melon')) speed = t.speed;
      if (speed > 1) { const eff = enchLevel(tool, 'efficiency'); if (eff) speed += eff * eff + 1; }
    }
    const haste = p.effect('haste'), fat = p.effect('mining_fatigue');
    if (haste) speed *= 1 + 0.2 * (haste.amp + 1);
    if (fat) speed *= [0.3, 0.09, 0.0027, 0.00081][Math.min(3, fat.amp)];
    if (p.eyesInWater && !p.armorEnch('aqua_affinity')) speed /= 5;
    if (!p.onGround && !p.flying) speed /= 5;
    return speed;
  }
  function hardness(id) { const md = MCDATA.blocks[BLOCKS[id].name]; return md ? md[1] : 1; }
  function progressPerTick(p, id, tool) {
    const h = hardness(id); if (h < 0) return 0; if (h === 0) return 1;
    return breakSpeed(p, id, tool) / h / (Drops.canHarvest(id, tool) ? 30 : 100);
  }
  // the bottom layer of bedrock in every dimension, and the Nether's ceiling
  const isBorder = y => y === MINY || (World.dim === 'nether' && (y === 0 || y === 127));
  function breakBlock(p, x, y, z) {
    const id = World.getBlock(x, y, z), st = World.getState(x, y, z), d = BLOCKS[id];
    if (p.gamemode === 'adventure' || p.spectator) return false;
    const held = p.inv.held;
    if (p.creative && held && ITEMS[held.id].tool && ITEMS[held.id].tool.kind === 'sword') return false;
    // the world's floor (and the Nether's floor and roof) can't be broken, even in Creative: nobody falls out
    if (id === BID.bedrock && isBorder(y)) return false;
    Particles.blockBreak(x, y, z, id, st);
    Sound.blockBreak(id, x, y, z);
    // containers spill their contents
    const be = World.getBE(x, y, z);
    if (be && be.loot) LootTables.unpackContainer(be, p);
    if (d.name === 'decorated_pot') Pots.unpack(be);
    if (be && be.items && !(d.name.endsWith('shulker_box'))) for (const s of be.items) if (s) Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, s, true);
    if (be && be.type === 'jukebox' && be.disc) { Drops.spawnItem(x + 0.5, y + 1, z + 0.5, be.disc); Sound.stopDisc(x, y, z); }
    if (be && be.type === 'lectern' && be.book) Drops.spawnItem(x + 0.5, y + 1, z + 0.5, be.book);
    // hives: angry bees, unless broken with silk touch (which keeps the bees and honey in the item)
    const hive = (d.name === 'bee_nest' || d.name === 'beehive') ? Bees.broken(p, x, y, z, id, st, !!enchLevel(held, 'silk_touch')) : null;
    Blocks.remove(x, y, z, p);
    GameEvents.emit('block_destroy', x + 0.5, y + 0.5, z + 0.5, p, id);
    if (!p.creative) {
      if (d.name.endsWith('shulker_box') && be) { const s = stack(d.name, 1); if (be.items && be.items.some(i => i)) s.tag = { items: be.items }; Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, s); }
      else if (d.name === 'decorated_pot') Pots.drops(be, Pots.shatters(held), x, y, z);
      else if (hive) Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack(d.name, 1, { tag: hive }));
      else Drops.dropBlock(id, st, held, x, y, z);
      // tools wear by one per block (two for swords; nothing for blocks broken instantly)
      if (held && ITEMS[held.id].dur && hardness(id) > 0) p.inv.damageHeld(ITEMS[held.id].tool && ITEMS[held.id].tool.kind === 'sword' ? 2 : 1, p);
      p.exhaust(0.005);
      Stats.add('mined', d.name);
      if (d.name.includes('_ore')) Advancements.check(p);
    }
    // silverfish hide in infested blocks
    if (d.name.startsWith('infested_') && !enchLevel(held, 'silk_touch')) Mobs.spawn('silverfish', x + 0.5, y, z + 0.5);
    return true;
  }
  function tickMining(p) {
    if (breakDelay > 0) breakDelay--;
    const holding = Input.mouse[0] && Input.locked && !UI.screenOpen() && !p.dead && !p.sleeping;
    if (!holding || !target) { if (mining) { mining = null; Cracks.show(0, 0, 0, -1); } return; }
    const t = target;
    if (mining && (mining.x !== t.x || mining.y !== t.y || mining.z !== t.z || mining.id !== t.id)) { mining = null; Cracks.show(0, 0, 0, -1); }
    if (p.creative) {
      if (breakDelay > 0) return;
      if (breakBlock(p, t.x, t.y, t.z)) breakDelay = 5;
      p.swingArm();
      return;
    }
    if (breakDelay > 0) return;
    if (!mining) { mining = { x: t.x, y: t.y, z: t.z, id: t.id, prog: 0, sound: 0 }; Blocks.onAttack(p, t.x, t.y, t.z); }
    const tool = p.inv.held;
    const pp = progressPerTick(p, t.id, tool);
    if (pp <= 0) { p.swingArm(); return; }
    mining.prog += pp;
    if (mining.sound++ % 4 === 0) Sound.blockHit(t.id, t.x, t.y, t.z);
    if (mining.sound % 3 === 0) Particles.blockHit(t.x, t.y, t.z, t.id, t.face);
    p.swingArm();
    if (mining.prog >= 1) {
      breakBlock(p, t.x, t.y, t.z);
      mining = null; Cracks.show(0, 0, 0, -1);
      if (pp < 1) breakDelay = 5;
      return;
    }
    Cracks.show(t.x, t.y, t.z, Math.floor(mining.prog * 10), Models.shape(t.id, t.state, t.x, t.y, t.z, false));
  }
  // ---------------------------------------------------------------- attacking
  // a smash: the fall stops (and does no damage), everything around the target is thrown back, and wind burst
  // launches the attacker up again
  function maceSmash(p, e, held, fell) {
    p.vy = 0.01; p.fallDistance = 0;
    Sound.play(e.onGround ? (fell > 5 ? 'mace_smash_ground_heavy' : 'mace_smash_ground') : 'mace_smash_air', p);
    const bx = Math.floor(e.x), by = Math.floor(e.y - 0.2), bz = Math.floor(e.z), below = World.getBlock(bx, by, bz);
    if (e.onGround && below) for (let i = 0; i < 3; i++) Particles.blockBreak(bx, by, bz, below, World.getState(bx, by, bz));
    for (const o of Entities.list.concat([p])) {
      if (o === p || o === e || o.removed || o.dead || !(o.living || o.isPlayer) || o.spectator || (o.isPlayer && o.creative && o.flying) || o.type === 'armor_stand') continue;
      if (o.tamed && o.owner === p) continue;
      const dx = o.x - e.x, dy = o.y - e.y, dz = o.z - e.z, l = Math.hypot(dx, dy, dz); if (l > 3.5 || l === 0) continue;
      const k = (3.5 - l) * 0.7 * (fell > 5 ? 2 : 1) * (1 - (o.kbResist || 0));
      if (k > 0) { o.vx += dx / l * k; o.vy += 0.7; o.vz += dz / l * k; }
    }
    const wb = enchLevel(held, 'wind_burst');
    if (wb > 0) Explosions.wind(p.x, p.y, p.z, p, 3.5, [1.2, 1.75, 2.2][Math.min(3, wb) - 1]);
  }
  function attack(p, e) {
    if (p.spectator) { return; }
    const held = p.inv.held, it = held ? ITEMS[held.id] : null;
    const aspd = it ? it.aspd : 4;
    const cd = Math.max(0, Math.min(1, (p.attackCooldown + 0.5) / (20 / aspd)));
    p.attackCooldown = 0;
    p.swingArm();
    if (!e.hurt || e.invulnerableTo && e.invulnerableTo(p)) return;
    let dmg = it ? it.dmg : 1;
    // the mace: falling more than 1.5 blocks makes a smash attack
    const smash = it && it.name === 'mace' && p.fallDistance > 1.5 && !p.gliding, fell = p.fallDistance;
    const str = p.effect('strength'), weak = p.effect('weakness');
    if (str) dmg += 3 * (str.amp + 1); if (weak) dmg -= 4 * (weak.amp + 1);
    let ench = 0;
    const sh = enchLevel(held, 'sharpness'); if (sh) ench += 0.5 * sh + 0.5;
    const sm = enchLevel(held, 'smite'); if (sm && e.undead) ench += 2.5 * sm;
    const ba = enchLevel(held, 'bane_of_arthropods'); if (ba && e.arthropod) { ench += 2.5 * ba; e.addEffect && e.addEffect('slowness', 20 + Math.floor(Math.random() * 10 * ba), 3); }
    dmg *= 0.2 + cd * cd * 0.8; ench *= cd;
    // 4 damage a block for the first 3 blocks fallen, 2 for the next 5, then 1; density adds half a point a block a level
    if (smash) dmg += (fell <= 3 ? 4 * fell : fell <= 8 ? 12 + 2 * (fell - 3) : 22 + fell - 8) + 0.5 * enchLevel(held, 'density') * fell;
    const strong = cd > 0.9;
    let kb = (p.sprinting && strong ? 1 : 0) + enchLevel(held, 'knockback');
    const crit = strong && p.fallDistance > 0 && !p.onGround && !p.onClimbable() && !p.inWater && !p.effect('blindness') && !p.vehicle && !p.sprinting;
    if (crit) dmg *= 1.5;
    const total = dmg + ench;
    p.breach = enchLevel(held, 'breach');
    const hit = Advancements.withDamage({ tags: smash ? ['mace_smash'] : [] }, () => e.hurt(Math.max(0, total), 'player', p));
    p.breach = 0;
    p.lastAttacked = e; p.lastAttackTime = p.age; if (hit) Stats.add('custom', 'damage_dealt', total);
    if (!hit) { Sound.play('attack_nodamage', p); return; }
    if (smash) maceSmash(p, e, held, fell);
    if (crit) { Particles.crit(e); Sound.play('attack_crit', p); }
    else if (strong) Sound.play('attack_strong', p); else Sound.play('attack_weak', p);
    if (ench > 0) Particles.magicCrit(e);
    if (kb > 0 && e.knockback) { e.knockback(kb * 0.5, -Math.sin(p.yaw) * -1, -Math.cos(p.yaw) * -1); p.vx *= 0.6; p.vz *= 0.6; p.sprinting = false; }
    // sweeping attack with a sword
    if (strong && !crit && !p.sprinting && p.onGround && it && it.tool && it.tool.kind === 'sword' && Math.hypot(p.x - p.px, p.z - p.pz) < p.speedAttr * 2.5) {
      const se = enchLevel(held, 'sweeping_edge'), sd = 1 + total * (se ? se / (se + 1) : 0);
      for (const o of Entities.list) if (o !== e && o !== p && o.hurt && !o.removed && !o.dead && o.living && Math.abs(o.x - e.x) < 1.5 && Math.abs(o.y - e.y) < 0.6 && Math.abs(o.z - e.z) < 1.5 && o.dist2(p.x, p.y, p.z) < 9) { o.hurt(sd, 'player', p); o.knockback && o.knockback(0.4, -Math.sin(p.yaw) * -1, -Math.cos(p.yaw) * -1); }
      Particles.sweep(p); Sound.play('attack_sweep', p);
    }
    const fa = enchLevel(held, 'fire_aspect'); if (fa && e.living) e.fireTicks = Math.max(e.fireTicks, fa * 80);
    if (held && it.dur) p.inv.damageHeld(it.tool && (it.tool.kind === 'sword' || it.name === 'trident' || it.name === 'mace') ? 1 : 2, p);
    p.exhaust(0.1);
  }
  // ---------------------------------------------------------------- right click
  // what the player does is the source of the game events it causes (doors, chests, buckets...)
  function use(p) { GameEvents.actor = p; try { return use0(p); } finally { GameEvents.actor = null; } }
  function use0(p) {
    if (p.spectator || p.dead) return;
    const held = p.inv.held;
    // entities first (feeding, riding, trading, shearing...)
    if (entTarget && entTarget.interact) { const was = held ? Object.assign({}, held) : null, who = entTarget; if (entTarget.interact(p, held)) { p.swingArm(); Advancements.fire('player_interacted_with_entity', { entity: who, item: was }); return true; } }
    if (target) {
      const t = target;
      // using the block (unless sneaking with an item in hand)
      if (!(p.sneaking && (held || p.inv.offhand))) { if (Blocks.use(p, t)) { p.swingArm(); return true; } }
      if (held && ItemUse.onBlock(p, held, t)) return true;
      const off = p.inv.offhand;
      if (!held && off && ItemUse.onBlock(p, off, t, true)) return true;
    }
    if (held && ItemUse.inAir(p, held)) return true;
    if (!held && p.inv.offhand && ItemUse.inAir(p, p.inv.offhand, true)) return true;
    return false;
  }
  function tick(p) {
    update(p);
    if (UI.screenOpen() || !Input.locked || p.dead) { p.using && ItemUse.release(p); return; }
    if (useDelay > 0) useDelay--;
    tickMining(p);
    if (Input.clicked[0]) {
      if (entTarget) attack(p, entTarget);
      else if (!target) { p.swingArm(); p.attackCooldown = 0; }
    }
    // holding right click repeats every 4 ticks (like the game's right click delay)
    if (Input.mouse[2]) {
      if (p.using) ItemUse.tickUse(p);
      else if (useDelay === 0 || Input.clicked[2]) { if (use(p)) useDelay = 4; else useDelay = 4; }
    } else if (p.using) ItemUse.release(p);
    if (Input.clicked[1]) pickBlock(p);
  }
  function pickBlock(p) {
    if (!target) return;
    let iid = ITEM_OF_BLOCK[target.id]; if (iid < 0) return;
    const inv = p.inv;
    const slot = inv.find(s => s.id === iid);
    if (slot >= 0 && slot < 9) { inv.selected = slot; HUD.refresh(); return; }
    if (slot >= 9) { const h = inv.get(inv.selected); inv.set(inv.selected, inv.get(slot)); inv.set(slot, h); HUD.refresh(); return; }
    if (p.creative) {
      let dest = inv.selected;
      if (inv.held) { const empty = inv.slots.slice(0, 9).findIndex(s => !s); if (empty >= 0) dest = empty; }
      inv.set(dest, stack(iid, 1)); inv.selected = dest; HUD.refresh();
    }
  }
  return { tick, update, breakSpeed, progressPerTick, hardness, get target() { return target; }, get entTarget() { return entTarget; }, reach, attack, breakBlock };
})();
