'use strict';
/* Advancements (Java Edition 1.21): the game's 122 advancements in five tabs (Minecraft, Nether, The End, Adventure,
   Husbandry) from its own data (data/advancements.js), with their criteria checked against what happens in the
   game. Each criterion is a trigger and the game's predicate conditions (entities, items, locations, blocks);
   an advancement is made when every requirement group has one criterion done. Making one shows a toast
   (Advancement Made! / Goal Reached! / Challenge Complete!), tells the chat, and pays out its experience.
   The screen (L) is the game's: tabs over a tiled background, the tree you drag around, frames gold once
   made, and tooltips with the description and progress. Visible are the made ones and up to two steps past
   them (hidden ones only once made). */
const Advancements = (() => {
  const LIST = typeof ADVANCEMENTS !== 'undefined' ? ADVANCEMENTS : [];
  const BY = new Map(LIST.map(a => [a.id, a]));
  const KIDS = new Map(); for (const a of LIST) if (a.parent) { if (!KIDS.has(a.parent)) KIDS.set(a.parent, []); KIDS.get(a.parent).push(a); }
  const TABS = LIST.filter(a => !a.parent);
  const reqOf = a => a.req || Object.keys(a.crit).map(k => [k]);
  { const top = (typeof MAXY !== 'undefined' ? MAXY : 191) - 2, fix = o => { if (!o || typeof o !== 'object') return; for (const k in o) { if (k === 'min' && o[k] === 319) o[k] = top; else if (k === 'min' && o[k] === 379) o[k] = top + 59; else fix(o[k]); } };
    for (const id of ['adventure/fall_from_world_height', 'adventure/trade_at_world_height']) { const a = LIST.find(q => q.id === id); if (a) fix(a.crit); } }
  // which advancements listen for each trigger
  const BY_TRIGGER = new Map();
  for (const a of LIST) for (const [k, [t]] of Object.entries(a.crit)) { if (!BY_TRIGGER.has(t)) BY_TRIGGER.set(t, []); BY_TRIGGER.get(t).push([a, k]); }

  let prog = {};               // id -> { c: { criterion: gameTime }, done: gameTime }
  const isDone = id => !!(prog[id] && prog[id].done);
  const critDone = (id, k) => !!(prog[id] && prog[id].c[k] !== undefined);

  // ---------------------------------------------------------------- predicates (the game's shapes, prefixes removed)
  const strip = s => typeof s === 'string' ? s.replace(/^minecraft:/, '') : s;
  const ENTITY_TAGS = {
    arrows: ['arrow', 'spectral_arrow'],
    raiders: ['evoker', 'illusioner', 'pillager', 'ravager', 'vindicator', 'witch'],
    boat: ['oak_boat', 'spruce_boat', 'birch_boat', 'jungle_boat', 'acacia_boat', 'dark_oak_boat', 'mangrove_boat', 'cherry_boat', 'bamboo_raft', 'oak_chest_boat', 'spruce_chest_boat', 'birch_chest_boat', 'jungle_chest_boat', 'acacia_chest_boat', 'dark_oak_chest_boat', 'mangrove_chest_boat', 'cherry_chest_boat', 'bamboo_chest_raft', 'boat'],
  };
  const tagList = (kind, t) => kind === 'item' ? (MCDATA.itemTags || {})[t] : kind === 'block' ? (MCDATA.blockTags || {})[t] : ENTITY_TAGS[t];
  function idIn(spec, name, kind) {
    if (spec === undefined || spec === null) return true;
    if (Array.isArray(spec)) return spec.some(s => idIn(s, name, kind));
    spec = strip(spec);
    if (spec[0] === '#') { const l = tagList(kind, spec.slice(1)); return !!l && l.includes(name); }
    return spec === name;
  }
  function range(r, v) { if (r === undefined || r === null) return true; if (typeof r === 'number') return v === r; if (v === undefined || v === null) return false; return (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max); }
  const typeOf = e => e ? (e.isPlayer ? 'player' : e.kind === 'wind_charge' ? (e.owner && e.owner.type === 'breeze' ? 'breeze_wind_charge' : 'wind_charge') : e.type === 'boat' ? (e.wood ? e.wood + (e.chest ? '_chest_boat' : '_boat') : 'oak_boat') : e.type) : null;
  function itemMatch(p, s) {
    if (!p) return true; if (!s) return false;
    const name = ITEMS[s.id].name;
    if (p.items !== undefined && !idIn(p.items, name, 'item')) return false;
    if (p.count !== undefined && !range(p.count, s.count)) return false;
    const pr = p.predicates || p.components;
    if (pr) {
      if (pr.enchantments) for (const e of pr.enchantments) { const ids = [].concat(e.enchantments || []).map(strip); const lv = ids.length ? Math.max(...ids.map(id => enchLevel(s, id))) : Math.max(0, ...Object.values(enchOf(s) || {})); if (!range(e.levels || { min: 1 }, lv)) return false; }
      if (pr.jukebox_playable !== undefined && !name.startsWith('music_disc')) return false;
      if (pr.potion_contents !== undefined && !(s.tag && s.tag.potion && idIn(pr.potion_contents, s.tag.potion, 'potion'))) return false;
      if (pr.damage && !range(pr.damage.durability, ITEMS[s.id].dur - (s.dmg || 0))) return false;
    }
    return true;
  }
  const DIM = { overworld: 'overworld', the_nether: 'nether', the_end: 'end' };
  function locationMatch(p, x, y, z) {
    if (!p) return true;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    if (p.dimension && DIM[strip(p.dimension)] !== World.dim) return false;
    if (p.biomes !== undefined && !idIn(p.biomes, BIOMES[World.biomeAt3(bx, by, bz)].name, 'biome')) return false;
    if (p.structures !== undefined) { const here = Structures.at(bx, by, bz); if (!here.some(n => idIn(p.structures, n, 'structure'))) return false; }
    if (p.position) { if (!range(p.position.x, x) || !range(p.position.y, y) || !range(p.position.z, z)) return false; }
    if (p.block) {
      const id = World.getBlock(bx, by, bz);
      if (p.block.blocks !== undefined && !idIn(p.block.blocks, BLOCKS[id].name, 'block')) return false;
      if (p.block.state && !stateMatch(id, World.getState(bx, by, bz), p.block.state, bx, by, bz)) return false;
    }
    if (p.fluid && p.fluid.fluids !== undefined) { const f = BLOCKS[World.getBlock(bx, by, bz)].fluid; if (!f || !idIn(p.fluid.fluids, f, 'fluid')) return false; }
    if (p.light && !range(p.light.light, World.lightLevel(bx, by, bz))) return false;
    if (p.can_see_sky !== undefined && ((World.getLight(bx, by, bz) >> 4) === 15) !== p.can_see_sky) return false;
    return true;
  }
  // the handful of block state properties the advancements ask about
  function stateMatch(id, st, want, x, y, z) {
    const d = BLOCKS[id];
    for (const [k, v] of Object.entries(want)) {
      const val = String(v);
      if (k === 'lit') { if (String(d.name.includes('copper_bulb') ? !!(st & 1) : d.name.includes('candle') ? !!(st & 4) : !!(st & 1)) !== val) return false; }
      else if (k === 'ominous') { if (String(!!(st & (d.name === 'vault' ? 32 : 8))) !== val) return false; }
      else if (k === 'facing') { const f = { north: 2, south: 3, west: 4, east: 5 }[val]; if ((st & 7) !== f) return false; }
      else if (k === 'age' || k === 'level') { if (String(st & 7) !== val) return false; }
      else if (k === 'charges') { if (String(Math.min(4, st & 7)) !== val) return false; }
    }
    return true;
  }
  function distanceMatch(p, o, e) {
    if (!p) return true; if (!o || !e) return false;
    const dx = e.x - o.x, dy = e.y - o.y, dz = e.z - o.z;
    return range(p.x, Math.abs(dx)) && range(p.y, Math.abs(dy)) && range(p.z, Math.abs(dz)) && range(p.horizontal, Math.hypot(dx, dz)) && range(p.absolute, Math.hypot(dx, dy, dz));
  }
  function equipOf(e, slot) {
    if (e.isPlayer) return slot === 'mainhand' ? e.inv.held : slot === 'offhand' ? e.inv.offhand : e.inv.armor({ head: 0, chest: 1, legs: 2, feet: 3 }[slot]);
    return e.equip ? e.equip[{ mainhand: 'main', offhand: 'off' }[slot] || slot] : null;
  }
  // what the player is looking at (spyglass advancements)
  function lookingAt(p) {
    const lv = p.lookVec(); let best = null, bd = 64;
    for (const e of Entities.list) { if (e === p || e.removed || e.dead || !e.living && !e.hurt) continue; const hw = (e.w || 0.6) / 2 + 0.2; const r = Phys.rayBox(p.x, p.eyeY, p.z, lv[0], lv[1], lv[2], e.x - hw, e.y, e.z - hw, e.x + hw, e.y + (e.h || 1), e.z + hw); if (r && r.t < bd) { bd = r.t; best = e; } }
    return best;
  }
  function entityMatch(p, e, origin) {
    if (!p) return true; if (!e) return false;
    if (p.type !== undefined && !idIn(p.type, typeOf(e), 'entity')) return false;
    if (p.flags) { if (p.flags.is_baby !== undefined && !!e.baby !== p.flags.is_baby) return false; if (p.flags.is_on_fire !== undefined && (e.fireTicks > 0) !== p.flags.is_on_fire) return false; if (p.flags.is_sneaking !== undefined && !!e.sneaking !== p.flags.is_sneaking) return false; }
    const ts = p.type_specific;
    if (ts) {
      if (ts.variant !== undefined && strip(ts.variant) !== e.variant) return false;
      if (ts.looking_at && !entityMatch(ts.looking_at, lookingAt(e), e)) return false;
      if (ts.blocks_set_on_fire !== undefined && !range(ts.blocks_set_on_fire, e.firesSet || 0)) return false;
    }
    if (p.location && !locationMatch(p.location, e.x, e.y, e.z)) return false;
    if (p.stepping_on && !locationMatch(p.stepping_on, e.x, e.y - 0.5, e.z)) return false;
    if (p.distance && !distanceMatch(p.distance, origin, e)) return false;
    if (p.vehicle && !entityMatch(p.vehicle, e.vehicle, origin)) return false;
    if (p.passenger && !(e.passengers || []).some(q => entityMatch(p.passenger, q, origin))) return false;
    if (p.equipment) for (const [slot, ip] of Object.entries(p.equipment)) if (!itemMatch(ip, equipOf(e, slot))) return false;
    if (p.effects) for (const k of Object.keys(p.effects)) if (!(e.effect && e.effect(strip(k)))) return false;
    return true;
  }
  // a list of loot conditions about one entity, a position or a tool
  function conds(list, ctx) { return [].concat(list || []).every(c => cond(c, ctx)); }
  function cond(c, ctx) {
    switch (strip(c.condition)) {
      case 'entity_properties': return entityMatch(c.predicate, ctx.entity, ctx.origin || Game.player);
      case 'location_check': { if (!ctx.pos) return false; const [x, y, z] = ctx.pos; return locationMatch(c.predicate, x + (c.offsetX || 0) + 0.5, y + (c.offsetY || 0) + 0.5, z + (c.offsetZ || 0) + 0.5); }
      case 'match_tool': return itemMatch(c.predicate, ctx.tool);
      case 'block_state_property': { if (!ctx.pos) return false; const [x, y, z] = ctx.pos, id = World.getBlock(x, y, z); return BLOCKS[id].name === strip(c.block) && (!c.properties || stateMatch(id, World.getState(x, y, z), c.properties, x, y, z)); }
      case 'inverted': return !cond(c.term, ctx);
      case 'all_of': return c.terms.every(t => cond(t, ctx));
      case 'any_of': return c.terms.some(t => cond(t, ctx));
      case 'random_chance': return Math.random() < c.chance;
    }
    return true;
  }
  // a damage (source) predicate: the thing that did it and its tags
  function damageMatch(p, x) {
    if (!p) return true;
    if (p.dealt !== undefined && !range(p.dealt, x.dealt)) return false;
    if (p.taken !== undefined && !range(p.taken, x.taken)) return false;
    if (p.blocked !== undefined && !!x.blocked !== p.blocked) return false;
    if (p.type && !sourceMatch(p.type, x)) return false;
    return true;
  }
  function sourceMatch(p, x) {
    if (p.direct_entity && !entityMatch(p.direct_entity, x.direct, Game.player)) return false;
    if (p.source_entity && !entityMatch(p.source_entity, x.attacker, Game.player)) return false;
    if (p.tags) for (const t of p.tags) if ((x.tags || []).includes(strip(t.id)) !== t.expected) return false;
    return true;
  }
  // ---------------------------------------------------------------- matching one criterion against an event
  function match(trigger, c, x) {
    const p = Game.player;
    if (c.player && !conds(c.player, { entity: p, origin: p })) return false;
    switch (trigger) {
      case 'inventory_changed': return (c.items || []).every(ip => p.inv.slots.some(s => s && itemMatch(ip, s)));
      case 'killed_by_arrow': {
        if (c.fired_from_weapon && !itemMatch(c.fired_from_weapon, x.weapon)) return false;
        const v = x.victims || [];
        if (c.unique_entity_types !== undefined && !range(c.unique_entity_types, new Set(v.map(typeOf)).size)) return false;
        if (c.victims) { const used = new Set(); for (const vc of c.victims) { const i = v.findIndex((e, j) => !used.has(j) && conds(vc, { entity: e })); if (i < 0) return false; used.add(i); } }
        return true;
      }
      case 'channeled_lightning': { const v = x.victims || []; return (c.victims || []).every(vc => v.some(e => conds(vc, { entity: e }))); }
      case 'lightning_strike': return conds(c.lightning, { entity: x.lightning }) && (!c.bystander || (x.bystanders || []).some(e => conds(c.bystander, { entity: e })));
      case 'effects_changed': if (c.effects && !Object.keys(c.effects).every(k => p.effect(strip(k)))) return false; return !c.source || conds(c.source, { entity: x.source });
      case 'bred_animals': return conds(c.child, { entity: x.child }) && conds(c.parent, { entity: x.parent }) && conds(c.partner, { entity: x.partner });
      case 'cured_zombie_villager': return conds(c.zombie, { entity: x.zombie }) && conds(c.villager, { entity: x.villager });
      case 'villager_trade': return conds(c.villager, { entity: x.villager }) && itemMatch(c.item, x.item);
      case 'fall_from_height': return (!c.start_position || (x.start && locationMatch(c.start_position, ...x.start))) && distanceMatch(c.distance, x.startPos, p);
      case 'fall_after_explosion': return conds(c.cause, { entity: x.cause }) && distanceMatch(c.distance, x.startPos, p);
      case 'levitation': return distanceMatch(c.distance, x.startPos, p) && range(c.duration, x.duration);
      case 'nether_travel': case 'ride_entity_in_lava': return distanceMatch(c.distance, x.startPos, p);
      case 'recipe_crafted': case 'crafter_recipe_crafted':
        if (c.recipe_id && strip(c.recipe_id) !== x.recipe) return false;
        if (c.ingredients) { const ing = (x.ingredients || []).slice(); for (const ip of c.ingredients) { const i = ing.findIndex(s => itemMatch(ip, s)); if (i < 0) return false; ing.splice(i, 1); } }
        return true;
    }
    if (c.entity && !conds(c.entity, { entity: x.entity })) return false;
    if (c.item && !itemMatch(c.item, x.item)) return false;
    if (c.location && !conds(c.location, { pos: x.pos, tool: x.item, entity: p })) return false;
    if (c.block !== undefined && strip(c.block) !== x.block) return false;
    if (c.killing_blow && !sourceMatch(c.killing_blow, x)) return false;
    if (c.damage && !damageMatch(c.damage, x)) return false;
    if (c.loot_table !== undefined && strip(c.loot_table) !== x.loot) return false;
    if (c.to !== undefined && DIM[strip(c.to)] !== x.to) return false;
    if (c.from !== undefined && DIM[strip(c.from)] !== x.from) return false;
    if (c.level !== undefined && !range(c.level, x.level)) return false;
    if (c.signal_strength !== undefined && !range(c.signal_strength, x.signal)) return false;
    if (c.projectile && !conds(c.projectile, { entity: x.projectile })) return false;
    if (c.num_bees_inside !== undefined && !range(c.num_bees_inside, x.bees)) return false;
    if (c.potion !== undefined && strip(c.potion) !== x.potion) return false;
    if (c.levels !== undefined && !range(c.levels, x.levels)) return false;
    if (c.durability !== undefined && !range(c.durability, x.durability)) return false;
    if (c.delta !== undefined && !range(c.delta, x.delta)) return false;
    if (c.rod && !itemMatch(c.rod, x.rod)) return false;
    return true;
  }

  // ---------------------------------------------------------------- firing triggers
  function fire(trigger, x) {
    const p = Game.player; if (!p || !Game.running || p.dead && trigger !== 'entity_killed_player') return;
    const list = BY_TRIGGER.get(trigger); if (!list) return;
    x = x || {};
    for (const [a, k] of list) {
      if (isDone(a.id) || critDone(a.id, k)) continue;
      let ok = false; try { ok = match(trigger, a.crit[k][1] || {}, x); } catch (e) { ok = false; }
      if (ok) grant(a.id, k);
    }
  }
  function grant(id, k, silent) {
    const a = BY.get(id); if (!a || isDone(id)) return;
    const pr = prog[id] || (prog[id] = { c: {} });
    if (pr.c[k] !== undefined) return;
    pr.c[k] = Game.gameTime || 0;
    if (reqOf(a).every(g => g.some(n => pr.c[n] !== undefined))) complete(a, silent);
  }
  function complete(a, silent) {
    prog[a.id].done = Game.gameTime || 0;
    if (silent || !a.title) return;
    const p = Game.player;
    if (a.xp && p) p.addXp(a.xp);
    if (a.toast !== false) { toasts.push({ a, t: performance.now() }); Sound.play(a.frame === 'challenge' ? 'ui_toast_challenge_complete' : 'ui_toast_in'); }
    if (a.chat !== false && Game.rules.announceAdvancements !== false) {
      const verb = a.frame === 'challenge' ? ' has completed the challenge ' : a.frame === 'goal' ? ' has reached the goal ' : ' has made the advancement ';
      Chat.add([['Player' + verb, '#ffffff'], ['[' + a.title + ']', a.frame === 'challenge' ? '#aa00aa' : '#55ff55']]);
    }
  }
  function revoke(id) { delete prog[id]; }
  // who did a hit: projectiles and the mace say so around their hurt() calls
  let dmg = null;
  function withDamage(d, f) { const prev = dmg; dmg = d; try { return f(); } finally { dmg = prev; } }
  const PROJ = new Set(['arrow', 'trident', 'projectile', 'fireball', 'witherSkull']);
  function damageCtx(entity, amount, source, attacker) {
    const d = dmg || {}, player = attacker && (attacker.isPlayer ? attacker : attacker.owner && attacker.owner.isPlayer ? attacker.owner : null);
    const tags = (d.tags || []).slice(); if (PROJ.has(source) || (d.direct && d.direct !== player)) tags.push('is_projectile');
    return { entity, dealt: amount, taken: amount, attacker: player || attacker, direct: d.direct || attacker, tags, weapon: d.weapon };
  }
  // checked now and then: where the player is, what they carry, what effects they have
  let invDirty = true;
  let fall = null, lev = null, lava = null, wasGround = true;
  function tick(p) {
    if (!p || p.dead) return;
    // falling (Caves & Cliffs) and being blown up into the air (Who Needs Rockets?): judged on landing
    if (!p.onGround && wasGround && !p.flying) fall = { x: p.x, y: p.y, z: p.z };
    if (p.onGround && !wasGround) {
      if (fall) fire('fall_from_height', { start: [fall.x, fall.y, fall.z], startPos: fall });
      if (p.launchedBy) { fire('fall_after_explosion', { cause: p.launchedBy.cause, startPos: p.launchedBy }); p.launchedBy = null; }
      fall = null;
    }
    if (p.flying || p.inWater || (p.onClimbable && p.onClimbable())) fall = null;
    wasGround = p.onGround;
    // levitating (Great View From Up Here)
    if (p.effect && p.effect('levitation')) { if (!lev) lev = { x: p.x, y: p.y, z: p.z, t: Game.gameTime }; if (Game.gameTime % 10 === 0) fire('levitation', { startPos: lev, duration: Game.gameTime - lev.t }); } else lev = null;
    // riding a strider over lava (Feels Like Home)
    if (p.vehicle && p.vehicle.type === 'strider' && p.vehicle.inLava) { if (!lava) lava = { x: p.x, y: p.y, z: p.z }; if (Game.gameTime % 10 === 0) fire('ride_entity_in_lava', { startPos: lava }); } else lava = null;
    // sliding down the side of a honey block (Sticky Situation)
    if (!p.onGround && p.vy < -0.08 && Game.gameTime % 5 === 0) { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const bx = Math.floor(p.x + dx * (p.w / 2 + 0.05)), bz = Math.floor(p.z + dz * (p.w / 2 + 0.05)); if (World.getBlock(bx, Math.floor(p.y + 0.3), bz) === BID.honey_block) { fire('slide_down_block', { block: 'honey_block' }); break; } } }
    if (invDirty) { invDirty = false; fire('inventory_changed'); }
    if (Game.gameTime % 20 === 0) fire('location');
    if (Game.gameTime % 20 === 10) fire('effects_changed');
  }
  function inventoryChanged() { invDirty = true; }

  // ---------------------------------------------------------------- toasts (top right, 5 seconds)
  const toasts = [];
  function drawToasts(g, S, W, text) {
    const now = performance.now();
    for (let i = toasts.length - 1; i >= 0; i--) if (now - toasts[i].t > 5600) toasts.splice(i, 1);
    toasts.slice(0, 5).forEach((t, i) => {
      const age = now - t.t, slide = age < 300 ? age / 300 : age > 5300 ? 1 - (age - 5300) / 300 : 1;
      const w = 160 * S, h = 32 * S, x = W - w * slide, y = i * h;
      g.fillStyle = '#212121'; g.fillRect(x, y, w, h); g.fillStyle = '#555555'; g.fillRect(x + S, y + S, w - 2 * S, h - 2 * S); g.fillStyle = '#212121'; g.fillRect(x + 2 * S, y + 2 * S, w - 4 * S, h - 4 * S);
      const a = t.a, IDX = IID[a.icon]; if (IDX !== undefined) Icons.draw(g, IDX, x + 8 * S, y + 8 * S, 16 * S);
      const head = a.frame === 'challenge' ? 'Challenge Complete!' : a.frame === 'goal' ? 'Goal Reached!' : 'Advancement Made!';
      text(head, x + 30 * S, y + 7 * S, a.frame === 'challenge' ? '#ff88ff' : '#ffff00');
      text(a.title, x + 30 * S, y + 18 * S, '#ffffff');
    });
  }

  // ---------------------------------------------------------------- the screen
  const visibleDepth = 2;
  function visible(a) {
    if (isDone(a.id)) return true;
    if (a.hidden) return (KIDS.get(a.id) || []).some(visible);
    let q = a, d = 0;
    while (q.parent && d < visibleDepth) { q = BY.get(q.parent); d++; if (isDone(q.id)) return true; }
    return false;
  }
  // a tidy tree: children to the right, each subtree gets its own rows, parents centred on their children
  function layout(root) {
    const pos = new Map(); let row = 0;
    const place = (a, depth) => {
      const kids = (KIDS.get(a.id) || []).filter(visible);
      if (!kids.length) { pos.set(a.id, [depth, row++]); return; }
      const ys = kids.map(k => { place(k, depth + 1); return pos.get(k.id)[1]; });
      pos.set(a.id, [depth, (ys[0] + ys[ys.length - 1]) / 2]);
    };
    place(root, 0);
    return pos;
  }
  const BG = { stone: 'stone', netherrack: 'netherrack', end_stone: 'end_stone', adventure: 'coarse_dirt', husbandry: 'hay_block_side' };
  let tab = 0, panX = 0, panY = 0, dragFrom = null, hoverId = null, cv = null;
  const MARGIN = 120;
  function page() {
    setTimeout(mount, 0);
    return `<div class="mtitle">Advancements</div><div id="advWrap" style="position:relative;margin:0 auto;"><canvas id="advCanvas"></canvas></div><div class="mbottom"><div class="mbtn" data-act="pause">Done</div></div>`;
  }
  function tabs() { return TABS.filter(t => visible(t)); }
  function mount() {
    cv = document.getElementById('advCanvas'); if (!cv) return;
    // room either side of the window for tooltips that run past it
    const S = GUI.S; cv.width = (252 + 2 * MARGIN) * S; cv.height = 140 * S + 28 * S; cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    const T = tabs(); if (tab >= T.length) tab = 0; centre();
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / S - MARGIN, (e.clientY - r.top) / S]; };
    cv.onmousedown = e => {
      const [mx, my] = at(e);
      if (my < 28) { const i = Math.floor(mx / 28); if (i >= 0 && i < tabs().length) { tab = i; centre(); draw(); Sound.play('click'); } return; }
      dragFrom = [mx, my, panX, panY];
    };
    cv.onmousemove = e => { const [mx, my] = at(e); if (dragFrom && e.buttons) { panX = dragFrom[2] + mx - dragFrom[0]; panY = dragFrom[3] + my - dragFrom[1]; clampPan(); } hoverId = pick(mx, my); draw(); };
    cv.onmouseup = () => { dragFrom = null; };
    cv.onmouseleave = () => { dragFrom = null; hoverId = null; draw(); };
    draw();
  }
  let curPos = null;
  function centre() { const T = tabs(); if (!T.length) return; curPos = layout(T[tab]); const xs = [...curPos.values()].map(p => p[0] * 28), ys = [...curPos.values()].map(p => p[1] * 27); const w = Math.max(...xs) - Math.min(...xs) + 26, h = Math.max(...ys) - Math.min(...ys) + 26; panX = 117 - w / 2 - Math.min(...xs) + 4; panY = 56 - h / 2 - Math.min(...ys) + 4; clampPan(); }
  function clampPan() {
    if (!curPos) return; const xs = [...curPos.values()].map(p => p[0] * 28), ys = [...curPos.values()].map(p => p[1] * 27);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 26, minY = Math.min(...ys), maxY = Math.max(...ys) + 26;
    panX = maxX - minX <= 234 ? panX : Math.min(-minX + 8, Math.max(234 - maxX - 8, panX));
    panY = maxY - minY <= 113 ? panY : Math.min(-minY + 8, Math.max(113 - maxY - 8, panY));
  }
  function nodeXY(id) { const p = curPos.get(id); return [9 + panX + p[0] * 28, 46 + panY + p[1] * 27]; }
  function pick(mx, my) {
    if (!curPos || mx < 9 || mx > 243 || my < 46 || my > 159) return null;
    for (const id of curPos.keys()) { const [x, y] = nodeXY(id); if (mx >= x && mx < x + 26 && my >= y && my < y + 26) return id; }
    return null;
  }
  function frame(g, S, x, y, kind, done) {
    const c1 = done ? '#f6c143' : '#c6c6c6', c2 = done ? '#9c6a12' : '#555555', c3 = done ? '#ffe9a0' : '#ffffff';
    g.fillStyle = '#000';
    if (kind === 'challenge') {
      g.beginPath(); const cx = x + 13 * S, cy = y + 13 * S;
      for (let i = 0; i < 16; i++) { const r = (i % 2 ? 11 : 14) * S, a = i / 16 * Math.PI * 2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.fillStyle = c2; g.save(); g.translate(cx, cy); g.scale(0.88, 0.88); g.translate(-cx, -cy); g.fill(); g.restore();
      g.fillStyle = c1; g.beginPath(); g.arc(cx, cy, 10 * S, 0, Math.PI * 2); g.fill();
      return;
    }
    const r = kind === 'goal' ? 8 * S : 2 * S, rr = (xx, yy, w, h, rad) => { g.beginPath(); g.moveTo(xx + rad, yy); g.arcTo(xx + w, yy, xx + w, yy + h, rad); g.arcTo(xx + w, yy + h, xx, yy + h, rad); g.arcTo(xx, yy + h, xx, yy, rad); g.arcTo(xx, yy, xx + w, yy, rad); g.closePath(); };
    rr(x, y, 26 * S, 26 * S, r); g.fill();
    g.fillStyle = c2; rr(x + S, y + S, 24 * S, 24 * S, Math.max(S, r - S)); g.fill();
    g.fillStyle = c1; rr(x + S, y + S, 23 * S, 23 * S, Math.max(S, r - S)); g.fill();
    g.fillStyle = c3; g.fillRect(x + 3 * S, y + 2 * S, 20 * S, S);
  }
  function bgPattern(g, name) {
    const px = Tex.pixels(name), c = document.createElement('canvas'); c.width = c.height = 16;
    const im = c.getContext('2d').createImageData(16, 16); for (let i = 0; i < 1024; i++) im.data[i] = i % 4 === 3 ? 255 : px[i] * 0.55; c.getContext('2d').putImageData(im, 0, 0);
    return c;
  }
  const bgCache = {};
  function draw() {
    if (!cv) return;
    const g = cv.getContext('2d'), S = GUI.S, T = tabs(); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cv.width, cv.height);
    g.save(); g.translate(MARGIN * S, 0);
    const font = n => `${n * S}px Minecraft, 'Pixelify Sans', monospace`;
    const txt = (t, x, y, col, o) => { g.font = font(8); g.textBaseline = 'top'; if (o && o.right) x -= g.measureText(t).width; g.fillStyle = '#3f3f3f'; if (!(o && o.flat)) g.fillText(t, x + S, y + S); g.fillStyle = col || '#fff'; g.fillText(t, x, y); };
    // tabs
    T.forEach((t, i) => {
      const x = i * 28 * S, sel = i === tab;
      g.fillStyle = sel ? '#c6c6c6' : '#8b8b8b'; g.fillRect(x, (sel ? 0 : 4) * S, 26 * S, 32 * S); g.fillStyle = '#000'; g.fillRect(x, (sel ? 0 : 4) * S, 26 * S, S);
      Icons.draw(g, IID[t.icon], x + 5 * S, (sel ? 6 : 9) * S, 16 * S);
    });
    // the window
    const wy = 28 * S;
    g.fillStyle = '#c6c6c6'; g.fillRect(0, wy, 252 * S, 140 * S); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineWidth = S; g.strokeRect(S / 2, wy + S / 2, 251 * S, 139 * S);
    if (!T.length) { g.fillStyle = '#000'; g.fillRect(9 * S, wy + 18 * S, 234 * S, 113 * S); txt("There doesn't seem to be anything here! :(", 126 * S - 95 * S, wy + 70 * S, '#ffffff'); txt('Advancements', 8 * S, wy + 6 * S, '#404040', { flat: true }); g.restore(); return; }
    const root = T[tab]; if (!curPos) centre();
    txt(root.title, 8 * S, wy + 6 * S, '#404040', { flat: true });
    // the background, tiled, then the tree clipped to the inside
    g.save(); g.beginPath(); g.rect(9 * S, wy + 18 * S, 234 * S, 113 * S); g.clip();
    const bg = bgCache[root.bg] || (bgCache[root.bg] = bgPattern(g, BG[root.bg] || 'stone'));
    for (let ty = -1; ty < 9; ty++) for (let tx = -1; tx < 17; tx++) g.drawImage(bg, (9 + tx * 16 + ((panX % 16) + 16) % 16 - 16) * S, (46 + ty * 16 + ((panY % 16) + 16) % 16 - 16) * S, 16 * S, 16 * S);
    // connecting lines (white with a black edge, elbowed like the game's)
    const line = (a, b, w, col) => { g.strokeStyle = col; g.lineWidth = w; const [ax, ay] = nodeXY(a), [bx, by] = nodeXY(b); const x1 = (ax + 26) * S, y1 = (ay + 13) * S, x2 = (bx) * S, y2 = (by + 13) * S, mx = (x1 + x2) / 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(mx, y1); g.lineTo(mx, y2); g.lineTo(x2, y2); g.stroke(); };
    for (const id of curPos.keys()) { const a = BY.get(id); if (a.parent && curPos.has(a.parent)) line(a.parent, id, 3 * S, '#000'); }
    for (const id of curPos.keys()) { const a = BY.get(id); if (a.parent && curPos.has(a.parent)) line(a.parent, id, S, '#fff'); }
    for (const id of curPos.keys()) { const a = BY.get(id), [x, y] = nodeXY(id); frame(g, S, x * S, y * S, a.frame, isDone(id)); Icons.draw(g, IID[a.icon], (x + 5) * S, (y + 5) * S, 16 * S); }
    g.restore();
    // the tooltip
    if (hoverId) {
      const a = BY.get(hoverId), [x, y] = nodeXY(hoverId), done = isDone(hoverId), pr = prog[hoverId];
      const groups = reqOf(a), n = groups.filter(gr => gr.some(k => pr && pr.c[k] !== undefined)).length, total = groups.length;
      g.font = font(8);
      const title = a.title, progT = !done && total > 1 ? `${n}/${total}` : '';
      const words = (a.desc || '').split(' '), lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 150 * S && cur) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur);
      const tw = Math.max(g.measureText(title).width + (progT ? g.measureText(progT).width + 12 * S : 0), ...lines.map(l => g.measureText(l).width)) + 34 * S;
      // the bar starts at the node (flipped to end at it near the right edge), the title right of the frame
      const flip = x * S + tw > (252 + MARGIN - 2) * S; let bx = flip ? (x + 26) * S - tw : x * S; const by = y * S, tx = flip ? bx + 4 * S : bx + 30 * S;
      g.fillStyle = 'rgba(16,0,16,0.94)'; g.fillRect(bx, by + 26 * S, tw, (lines.length * 9 + 8) * S);
      g.fillStyle = done ? '#c48d24' : '#0b4c7b'; g.fillRect(bx, by + 2 * S, tw, 22 * S); g.strokeStyle = '#000'; g.lineWidth = S; g.strokeRect(bx, by + 2 * S, tw, 22 * S);
      frame(g, S, x * S, y * S, a.frame, done); Icons.draw(g, IID[a.icon], (x + 5) * S, (y + 5) * S, 16 * S);
      txt(title, tx, by + 9 * S, '#ffffff'); if (progT) txt(progT, flip ? (x - 4) * S : bx + tw - 4 * S, by + 9 * S, '#ffffff', { right: true });
      const dc = a.frame === 'challenge' ? '#aa00aa' : '#55ff55';
      lines.forEach((l, i) => txt(l, bx + 4 * S, by + (30 + i * 9) * S, dc));
    }
    g.restore();
  }

  // ---------------------------------------------------------------- saving
  function save() { return prog; }
  function load(d) { prog = d && typeof d === 'object' ? d : {}; invDirty = true; }
  function reset() { prog = {}; toasts.length = 0; invDirty = true; tab = 0; curPos = null; }
  function grantAll(silent) { for (const a of LIST) for (const k of Object.keys(a.crit)) grant(a.id, k, silent); }
  function count() { return { done: LIST.filter(a => isDone(a.id)).length, total: LIST.length }; }
  return { withDamage, damageCtx, get dmg() { return dmg; }, fire, grant, revoke, tick, inventoryChanged, drawToasts, page, save, load, reset, grantAll, isDone, count, LIST, BY, match, itemMatch, entityMatch, locationMatch,
    // older call sites
    check: () => {}, trigger: () => {}, onEat: () => {}, onCraft: () => {}, onSmelt: () => {}, onEnchant: () => {}, welcome: () => {} };
})();
