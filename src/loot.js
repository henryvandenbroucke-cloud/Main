'use strict';
/* Loot tables, run from the game's own data (MCDATA.loot): structure chests, mob drops, fishing, piglin
   bartering, cat gifts, archaeology. Also the enchanting selection the game uses for "enchant with levels"
   (shared with the enchanting table). */
const Enchant = (() => {
  // enchantability of an item (how good its random enchantments are)
  function enchantability(it) {
    if (it.ench) return it.ench;
    if (it.armor && it.armor.ench) return it.armor.ench;
    const n = it.name;
    if (n === 'book' || n === 'enchanted_book' || n === 'bow' || n === 'crossbow' || n === 'trident' || n === 'fishing_rod') return 1;
    if (n === 'turtle_helmet') return 9;
    if (n === 'mace') return 15;
    return it.enchCat && it.enchCat.length ? 1 : 0;
  }
  const cost = (c, lvl) => c.a * lvl + c.b;
  // which items an enchantment goes on (1.21 data): "supported" items take it on an anvil or from loot, the
  // enchanting table only offers it for its "primary" items (Sharpness: swords at the table, axes too on an anvil)
  const tagSets = {};
  const inTag = (tag, n) => { if (!tag) return false; let set = tagSets[tag]; if (!set) set = tagSets[tag] = new Set(MCDATA.itemTags[tag] || []); return set.has(n); };
  const nameOf = e => typeof e === 'string' ? e : e && e.key;
  for (const k in MCDATA.enchantments) MCDATA.enchantments[k].key = k;
  function applies(e, it, primary) {
    if (it.name === 'book' || it.name === 'enchanted_book') return true;
    const d = MCDATA.enchantDefs[nameOf(e)]; if (!d) return false;
    return inTag(primary && d[2] ? d[2] : d[1], it.name);
  }
  const anvilCost = name => (MCDATA.enchantDefs[name] || [1])[0];
  // the enchantments (with levels) available at a given power
  function available(power, it, list) {
    const out = [];
    for (const name of list) {
      const e = MCDATA.enchantments[name]; if (!e || !applies(name, it, true)) continue;
      for (let l = e.max; l >= 1; l--) if (power >= cost({ a: e.minA, b: e.minB }, l) && power <= cost({ a: e.maxA, b: e.maxB }, l)) { out.push({ name, lvl: l, w: e.w }); break; }
    }
    return out;
  }
  function weighted(list, r) { let t = 0; for (const x of list) t += x.w; let k = r() * t; for (const x of list) { k -= x.w; if (k < 0) return x; } return list[list.length - 1]; }
  const excl = n => (MCDATA.enchantDefs[n] || [0, 0, 0, []])[3];
  const compatible = (a, b) => a !== b && !excl(a).includes(b) && !excl(b).includes(a);
  // the game's selection: power is raised by the item's enchantability, then enchantments are drawn by weight
  function select(it, level, list, r) {
    r = r || Math.random;
    const e = enchantability(it); if (e <= 0) return [];
    const ri = n => Math.floor(r() * n);
    level += 1 + ri(Math.floor(e / 4) + 1) + ri(Math.floor(e / 4) + 1);
    const f = (r() + r() - 1) * 0.15;
    level = Math.max(1, Math.round(level + level * f));
    let cand = available(level, it, list);
    const out = [];
    if (!cand.length) return out;
    out.push(weighted(cand, r));
    while (ri(50) <= level) {
      const last = out[out.length - 1];
      cand = cand.filter(c => compatible(c.name, last.name));
      if (!cand.length) break;
      out.push(weighted(cand, r));
      level = Math.floor(level / 2);
    }
    return out;
  }
  // enchantment groups the loot tables and the enchanting table refer to
  function group(opt) {
    const T = MCDATA.enchantTags;
    if (!opt) return T.on_random_loot;
    if (Array.isArray(opt)) return opt;
    if (opt[0] === '#') return T[opt.slice(1)] || [];
    return [opt];
  }
  // put enchantments on a stack (a book becomes an enchanted book with stored enchantments)
  function apply(s, list) {
    if (!list.length) return s;
    if (ITEMS[s.id].name === 'book') { s = Object.assign({}, s, { id: IID.enchanted_book }); s.tag = Object.assign({}, s.tag, { stored: {} }); for (const x of list) s.tag.stored[x.name] = x.lvl; return s; }
    s.tag = Object.assign({}, s.tag); s.tag.ench = Object.assign({}, s.tag.ench); for (const x of list) s.tag.ench[x.name] = x.lvl;
    return s;
  }
  return { select, apply, group, available, enchantability, applies, compatible, anvilCost, cost: (name, lvl, max) => { const e = MCDATA.enchantments[name]; return max ? cost({ a: e.maxA, b: e.maxB }, lvl) : cost({ a: e.minA, b: e.minB }, lvl); } };
})();

const LootTables = (() => {
  const T = () => MCDATA.loot;
  const strip = n => String(n).replace('minecraft:', '');
  // number providers: constants, uniform, binomial
  function num(v, r, ctx) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    if (v.type === 'uniform') return num(v.min, r) + r() * (num(v.max, r) - num(v.min, r));
    if (v.type === 'binomial') { let n = 0; const t = num(v.n, r), p = num(v.p, r); for (let i = 0; i < t; i++) if (r() < p) n++; return n; }
    if (v.type === 'constant') return v.value;
    if (v.type === 'enchantment_level') return 0;
    return 0;
  }
  const intNum = (v, r) => (typeof v === 'number' ? v : Math.floor(num(v, r) + (v && v.type === 'uniform' ? 0.5 : 0)));
  function uniformInt(v, r) { if (typeof v === 'number') return Math.floor(v); if (v.type === 'uniform') { const a = Math.round(num(v.min, r)), b = Math.round(num(v.max, r)); return a + Math.floor(r() * (b - a + 1)); } return Math.round(num(v, r)); }
  // ---------------------------------------------------------------- conditions
  function test(conds, ctx) {
    if (!conds) return true;
    for (const c of conds) if (!cond(c, ctx)) return false;
    return true;
  }
  function cond(c, ctx) {
    const r = ctx.r;
    switch (c.condition) {
      case 'random_chance': return r() < num(c.chance, r);
      case 'random_chance_with_enchanted_bonus': { const lvl = ctx.looting || 0; const ch = lvl > 0 ? (c.enchanted_chance.base !== undefined ? c.enchanted_chance.base + c.enchanted_chance.per_level_above_first * (lvl - 1) : num(c.enchanted_chance, r)) : c.unenchanted_chance; return r() < ch; }
      case 'killed_by_player': return !!ctx.byPlayer;
      case 'inverted': return !cond(c.term, ctx);
      case 'any_of': return c.terms.some(t => cond(t, ctx));
      case 'all_of': return c.terms.every(t => cond(t, ctx));
      case 'survives_explosion': return !ctx.explosion || r() < 1 / ctx.explosion;
      case 'location_check': { if (c.predicate && c.predicate.biomes) { const b = ctx.biome; return !!b && c.predicate.biomes.map(strip).includes(b); } return true; }
      case 'damage_source_properties': {
        const p = c.predicate || {};
        if (p.tags) return p.tags.every(t => (strip(t.id) === 'is_lightning' ? !!ctx.lightning : strip(t.id) === 'is_explosion' ? !!ctx.explosion : false) === t.expected);
        if (p.source_entity) { const k = ctx.killer; if (!k || k.type !== strip(p.source_entity.type)) return false; if (p.source_entity.type_specific && p.source_entity.type_specific.variant) return k.variant === strip(p.source_entity.type_specific.variant); return true; }
        return false;
      }
      case 'entity_properties': {
        const p = c.predicate || {}, e = c.entity === 'this' ? ctx.entity : ctx.killer;
        if (p.flags && p.flags.is_on_fire !== undefined) return !!(e && e.fireTicks > 0) === p.flags.is_on_fire;
        if (p.type) { if (!e) return false; const t = strip(p.type); if (t === '#skeletons') return ['skeleton', 'stray', 'wither_skeleton', 'bogged', 'skeleton_horse'].includes(e.type); return e.type === t; }
        if (p.type_specific) {
          const ts = p.type_specific;
          if (strip(ts.type) === 'fishing_hook') return !!ctx.openWater === ts.in_open_water;
          if (strip(ts.type) === 'raider') return !!(e && e.captain) === ts.is_captain;
          if (strip(ts.type) === 'slime') { const sz = e ? e.size || 1 : 1; return typeof ts.size === 'number' ? sz === ts.size : sz >= (ts.size.min || 0) && sz <= (ts.size.max || 99); }
          return false;
        }
        if (p.equipment) return !!ctx.smelts; // a weapon with Fire Aspect (the "smelts loot" enchantments)
        return true;
      }
      case 'match_tool': return false;
      case 'table_bonus': { const lvl = ctx.fortune || 0; return r() < c.chances[Math.min(lvl, c.chances.length - 1)]; }
      default: return true;
    }
  }
  // ---------------------------------------------------------------- functions on a generated stack
  function fn(f, s, ctx) {
    const r = ctx.r, it = ITEMS[s.id];
    if (!test(f.conditions, ctx)) return s;
    switch (f.function) {
      case 'set_count': { const n = uniformInt(f.count, r); s.count = Math.max(0, f.add ? s.count + n : n); break; }
      case 'enchanted_count_increase': case 'looting_enchant': { const lvl = ctx.looting || 0; if (lvl > 0) { s.count += Math.round(num(f.count, r) * lvl); if (f.limit) s.count = Math.min(s.count, f.limit); } break; }
      case 'set_damage': if (it.dur) { const d = num(f.damage, r); s.dmg = Math.floor((1 - Math.max(0, Math.min(1, d))) * it.dur); } break;
      case 'enchant_randomly': {
        const list = Enchant.group(Array.isArray(f.options) ? f.options.map(strip) : f.options ? strip(f.options) : null).filter(n => Enchant.applies(n, it, false) && MCDATA.enchantments[n]);
        if (!list.length) break;
        const name = list[Math.floor(r() * list.length)], max = MCDATA.enchantments[name].max;
        s = Enchant.apply(s, [{ name, lvl: 1 + Math.floor(r() * max) }]);
        break;
      }
      case 'enchant_with_levels': { const lvl = uniformInt(f.levels, r); s = Enchant.apply(s, Enchant.select(it, lvl, Enchant.group(f.options ? strip(f.options) : null), r)); break; }
      case 'set_enchantments': { const list = []; for (const k in f.enchantments) list.push({ name: strip(k), lvl: num(f.enchantments[k], r) }); s = Enchant.apply(s, list); break; }
      case 'set_potion': s.tag = Object.assign({}, s.tag, { potion: strip(f.id) }); break;
      case 'set_stew_effect': { const e = f.effects[Math.floor(r() * f.effects.length)]; s.tag = Object.assign({}, s.tag, { stew: { effect: strip(e.type), dur: Math.round(num(e.duration, r) * 20) } }); break; }
      case 'set_instrument': { const horns = ['ponder', 'sing', 'seek', 'feel']; s.tag = Object.assign({}, s.tag, { horn: horns[Math.floor(r() * horns.length)] }); break; }
      case 'exploration_map': s.tag = Object.assign({}, s.tag, { explore: strip(f.destination || 'buried_treasure'), decoration: strip(f.decoration || 'red_x'), zoom: f.zoom || 2 }); break;
      case 'set_name': if (f.name && f.name.translate === 'filled_map.buried_treasure') s.tag = Object.assign({}, s.tag, { name: 'Buried Treasure Map' }); break;
      case 'furnace_smelt': { if (!ctx.entity || !(ctx.entity.fireTicks > 0) && !ctx.smelts) break; const sm = Smelting.find(s, 'f'); if (sm && IID[sm.out] !== undefined) s = Object.assign({}, s, { id: IID[sm.out] }); break; }
      case 'set_ominous_bottle_amplifier': s.tag = Object.assign({}, s.tag, { amp: uniformInt(f.amplifier, r) }); break;
      case 'set_components': if (f.components && f.components['minecraft:trim']) s.tag = Object.assign({}, s.tag, { trim: { material: strip(f.components['minecraft:trim'].material), pattern: strip(f.components['minecraft:trim'].pattern) } }); break;
    }
    return s;
  }
  // ---------------------------------------------------------------- tables, pools and entries
  function expand(e, ctx, out) {
    if (!test(e.conditions, ctx)) return false;
    switch (e.type) {
      case undefined: case 'item': {
        const id = IID[strip(e.name)]; if (id === undefined) return true;
        let s = { id, count: 1, dmg: 0 };
        for (const f of e.functions || []) s = fn(f, s, ctx);
        if (s.count > 0) out.push(s);
        return true;
      }
      case 'tag': { const m = Recipes.tagMembers ? Recipes.tagMembers('#' + strip(e.name)) : null; if (m && m.length) { const n = m[Math.floor(ctx.r() * m.length)]; if (IID[n] !== undefined) out.push({ id: IID[n], count: 1, dmg: 0 }); } return true; }
      case 'loot_table': roll(strip(e.value), ctx, out); return true;
      case 'empty': return true;
      case 'alternatives': for (const c of e.children) if (expand(c, ctx, out)) return true; return false;
      case 'group': for (const c of e.children) expand(c, ctx, out); return true;
      case 'sequence': for (const c of e.children) if (!expand(c, ctx, out)) return false; return true;
    }
    return true;
  }
  function pool(p, ctx, out) {
    if (!test(p.conditions, ctx)) return;
    const r = ctx.r;
    let n = uniformInt(p.rolls === undefined ? 1 : p.rolls, r);
    if (p.bonus_rolls) n += Math.floor(num(p.bonus_rolls, r) * (ctx.luck || 0));
    const entries = (p.entries || []).filter(e => test(e.conditions, ctx));
    for (let k = 0; k < n; k++) {
      // weights, adjusted by quality and luck
      let total = 0; const ws = entries.map(e => { const w = Math.max(0, Math.floor((e.weight || 1) + (e.quality || 0) * (ctx.luck || 0))); total += w; return w; });
      if (total <= 0) break;
      let x = r() * total, pick = entries[0];
      for (let i = 0; i < entries.length; i++) { x -= ws[i]; if (x < 0) { pick = entries[i]; break; } }
      const before = out.length;
      expand(Object.assign({}, pick, { conditions: null }), ctx, out);
      for (let i = before; i < out.length; i++) for (const f of p.functions || []) out[i] = fn(f, out[i], ctx);
    }
  }
  // roll a table: returns a list of stacks
  function roll(name, ctx, out) {
    out = out || [];
    ctx = Object.assign({ r: Math.random }, ctx || {});
    const t = T()[strip(name)]; if (!t) return out;
    const start = out.length;
    for (const p of t.pools || []) pool(p, ctx, out);
    for (let i = start; i < out.length; i++) for (const f of t.functions || []) out[i] = fn(f, out[i], ctx);
    // stacks bigger than the item allows are split
    const res = [];
    for (const s of out.splice(start)) { let c = s.count; const max = ITEMS[s.id].stack; while (c > 0) { const k = Math.min(c, max); res.push(Object.assign({}, s, { count: k })); c -= k; } }
    out.push(...res);
    return out;
  }
  // fill a container the way the game does: stacks are split up and scattered over random empty slots
  function fill(items, name, seed, ctx) {
    const rnd = seed !== undefined ? new Rand(seed) : null, r = rnd ? () => rnd.next() : Math.random;
    const list = roll(name, Object.assign({ r }, ctx || {}));
    const slots = []; for (let i = 0; i < items.length; i++) if (!items[i]) slots.push(i);
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    // split stacks into more, smaller stacks while there are free slots
    const singles = [], multi = [];
    for (const s of list) (s.count > 1 ? multi : singles).push(s);
    while (singles.length + multi.length < slots.length && multi.length) {
      const s = multi.splice(Math.floor(r() * multi.length), 1)[0];
      const k = 1 + Math.floor(r() * Math.floor(s.count / 2));
      const a = Object.assign({}, s, { count: s.count - k }), b = Object.assign({}, s, { count: k });
      (a.count > 1 && r() < 0.5 ? multi : singles).push(a);
      (b.count > 1 && r() < 0.5 ? multi : singles).push(b);
    }
    const all = singles.concat(multi);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    for (const s of all) { if (!slots.length) break; items[slots.pop()] = s; }
    return items;
  }
  // a container with a loot table set by world generation fills the first time it is opened (or broken)
  function unpackContainer(be, p) {
    if (!be || !be.loot) return;
    if (!be.items) be.items = new Array(27).fill(null);
    fill(be.items, be.loot.startsWith('chests/') || be.loot.includes('/') ? be.loot : 'chests/' + be.loot, be.seed, { luck: p && p.effect ? (p.effect('luck') ? p.effect('luck').amp + 1 : 0) - (p.effect('unluck') ? p.effect('unluck').amp + 1 : 0) : 0 });
    const table = be.loot.replace(/^minecraft:/, '');
    be.loot = null; be.seed = undefined;
    if (p && p.isPlayer) Advancements.fire('player_generates_container_loot', { loot: table.includes('/') ? table : 'chests/' + table });
  }
  return { roll, fill, unpackContainer, has: n => !!T()[strip(n)], num };
})();
