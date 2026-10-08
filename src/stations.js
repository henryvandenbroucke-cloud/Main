'use strict';
/* Work stations, following the game's rules: the enchanting table (bookshelf power, three offers from the
   player's enchantment seed), the anvil (repairing, combining, renaming, prior work penalty, "Too Expensive!"),
   the grindstone, the stonecutter, the smithing table (netherite upgrades and armour trims), the brewing stand
   and the beacon (pyramid levels, powers, beam). */
const Stations = (() => {
  const mk = (arr, i) => ({ get: () => arr[i], set: v => { arr[i] = v && v.count > 0 ? v : null; } });
  const clone = s => (s ? JSON.parse(JSON.stringify(s)) : null);
  const nameOf = s => (s ? ITEMS[s.id].name : '');
  const isBook = s => nameOf(s) === 'enchanted_book';
  // the enchantments on a stack (stored ones for enchanted books)
  const enchMap = s => (s && s.tag ? (isBook(s) ? s.tag.stored : s.tag.ench) : null) || {};
  function setEnch(s, map) {
    s.tag = Object.assign({}, s.tag);
    const key = isBook(s) ? 'stored' : 'ench';
    if (Object.keys(map).length) s.tag[key] = map; else delete s.tag[key];
    if (!Object.keys(s.tag).length) delete s.tag;
  }
  const repairCostOf = s => (s && s.tag && s.tag.repairCost) || 0;
  const isCurse = n => (MCDATA.enchantTags.curse || []).includes(n);
  // a small seeded random source (the game seeds these from the player's enchantment seed)
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const giveBack = (p, s) => { if (!s) return; const left = p.inv.add(s, 0, 36); if (left) ItemUse.drop(p, left); };
  function part(cls, x, y, css) { return elAt(cls, x, y, css || ''); }
  function costText(el, text, color) { el.textContent = text; el.style.color = color; el.style.display = text ? '' : 'none'; }
  return { mk, clone, nameOf, isBook, enchMap, setEnch, repairCostOf, isCurse, rng, giveBack, part, costText };
})();

// ---------------------------------------------------------------- enchanting table
class EnchantScreen extends Screens.Screen {
  constructor(x, y, z) {
    super('Enchant', 176, 166);
    const S = Stations;
    this.pos = { x, y, z }; this.items = [null, null];
    this.itemSlot = Object.assign(this.slot(null, 0, 15, 47, { max: 1, onChange: () => this.update(), filter: s => true }), S.mk(this.items, 0));
    this.lapisSlot = Object.assign(this.slot(null, 1, 35, 47, { filter: s => S.nameOf(s) === 'lapis_lazuli', emptyIcon: 'empty_lapis', onChange: () => this.update() }), S.mk(this.items, 1));
    this.playerSlots(8, 84); this.invLabel = [8, 72];
    this.label('Enchant', 12, 5);
    this.parts.push({ kind: 'el', node: part2('enchfield', 59, 13, 110, 59) });
    this.book = elAt('enchbook', 13, 13, ''); this.parts.push({ kind: 'el', node: this.book });
    this.opts = [];
    for (let i = 0; i < 3; i++) {
      const el = elAt('enchopt', 60, 14 + i * 19, ''); el.style.pointerEvents = 'auto';
      el.innerHTML = '<div class="enchlvl"></div><div class="enchglyph"></div><div class="enchcost"></div>';
      el.addEventListener('mousedown', e => { e.stopPropagation(); this.choose(i); });
      el.addEventListener('mouseenter', () => { this.hoverOpt = i; this.showTip(i); });
      el.addEventListener('mouseleave', () => { this.hoverOpt = -1; Slots.hideTip(); });
      this.opts.push(el); this.parts.push({ kind: 'el', node: el });
    }
    this.shelves = EnchantScreen.shelves(x, y, z);
    this.costs = [0, 0, 0]; this.clues = [null, null, null]; this.hoverOpt = -1;
  }
  // bookshelves two blocks away (with air or another replaceable block between) power the table, at most 15
  static shelves(x, y, z) {
    let n = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
      for (let dy = 0; dy <= 1; dy++) {
        if (World.getBlock(x + dx, y + dy, z + dz) !== BID.bookshelf) continue;
        const mid = World.getBlock(x + Math.trunc(dx / 2), y + dy, z + Math.trunc(dz / 2));
        if (BLOCKS[mid].replaceable) n++;
      }
    }
    return Math.min(15, n);
  }
  static isEnchantable(s) { if (!s || s.count !== 1) return false; const it = ITEMS[s.id]; if (it.name === 'book') return true; if (it.name === 'enchanted_book' || (s.tag && s.tag.ench && Object.keys(s.tag.ench).length)) return false; return Enchant.enchantability(it) > 0 && !!it.enchCat && it.enchCat.length > 0; }
  // the game's level costs for the three slots
  static costFor(r, slot, shelves) {
    const b = Math.min(15, shelves), i = Math.floor(r() * 8) + 1 + (b >> 1) + Math.floor(r() * (b + 1));
    if (slot === 0) return Math.max(Math.floor(i / 3), 1);
    return slot === 1 ? Math.floor(i * 2 / 3) + 1 : Math.max(i, b * 2);
  }
  list(slot, cost) {
    const p = Game.player, s = this.items[0], r = Stations.rng((p.enchSeed | 0) + slot);
    const l = Enchant.select(ITEMS[s.id], cost, MCDATA.enchantTags.in_enchanting_table, r);
    if (ITEMS[s.id].name === 'book' && l.length > 1) l.splice(Math.floor(r() * l.length), 1);
    return { l, r };
  }
  update() {
    const p = Game.player, s = this.items[0];
    if (p.enchSeed === undefined) p.enchSeed = (Math.random() * 2147483647) | 0;
    this.costs = [0, 0, 0]; this.clues = [null, null, null];
    if (EnchantScreen.isEnchantable(s)) {
      const r = Stations.rng(p.enchSeed);
      for (let j = 0; j < 3; j++) { this.costs[j] = EnchantScreen.costFor(r, j, this.shelves); if (this.costs[j] < j + 1) this.costs[j] = 0; }
      for (let j = 0; j < 3; j++) if (this.costs[j] > 0) { const { l, r: r2 } = this.list(j, this.costs[j]); if (l.length) this.clues[j] = l[Math.floor(r2() * l.length)]; }
    }
    this.glyphs = [0, 1, 2].map(j => EnchantScreen.glyphText((p.enchSeed | 0) * 3 + j));
  }
  static glyphText(seed) {
    const SGA = 'ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ⚍⍊∴/||⨅'.match(/./gu), r = Stations.rng(seed), n = 3 + Math.floor(r() * 2), words = [];
    for (let i = 0; i < n; i++) { let w = ''; const k = 2 + Math.floor(r() * 4); for (let c = 0; c < k; c++) w += SGA[Math.floor(r() * SGA.length)]; words.push(w); }
    return words.join(' ');
  }
  affordable(j) {
    const p = Game.player, lap = this.items[1];
    if (p.creative) return this.costs[j] > 0;
    return this.costs[j] > 0 && (lap ? lap.count : 0) >= j + 1 && p.xpLevel >= this.costs[j];
  }
  choose(j) {
    const p = Game.player, s = this.items[0];
    if (!s || !this.costs[j] || !this.affordable(j)) return;
    const { l } = this.list(j, this.costs[j]);
    if (!l.length) return;
    this.items[0] = Enchant.apply(Stations.clone(s), l);
    if (!p.creative) { const lap = this.items[1]; lap.count -= j + 1; if (lap.count <= 0) this.items[1] = null; p.addLevels(-(j + 1)); }
    p.enchSeed = (Math.random() * 2147483647) | 0;
    Stats.add('custom', 'enchant_item'); Advancements.onEnchant && Advancements.onEnchant();
    Sound.play('enchant', null, Object.assign({}, this.pos));
    this.update(); Screens.render();
  }
  showTip(j) {
    const p = Game.player, c = this.clues[j]; if (!this.costs[j]) { Slots.hideTip(); return; }
    let h = c ? `<div style="color:#fff"><i>${escapeHTML(enchName(c.name, c.lvl))} . . . ?</i></div>` : '';
    if (!p.creative) {
      if (p.xpLevel < this.costs[j]) h += `<div style="color:#ff5555">Level Requirement: ${this.costs[j]}</div>`;
      else {
        const lap = this.items[1] ? this.items[1].count : 0, n = j + 1;
        h += `<div style="color:${lap >= n ? '#aaaaaa' : '#ff5555'}">${n} Lapis Lazuli</div><div style="color:#aaaaaa">${n} Enchantment Level${n > 1 ? 's' : ''}</div>`;
      }
    }
    Slots.showTipHTML(h);
  }
  renderExtra() {
    const p = Game.player;
    for (let j = 0; j < 3; j++) {
      const el = this.opts[j], cost = this.costs[j], ok = this.affordable(j);
      el.className = 'gpart enchopt' + (!cost ? ' off' : ok ? (this.hoverOpt === j ? ' hover' : '') : ' no');
      el.querySelector('.enchlvl').className = 'enchlvl l' + (j + 1) + (cost && ok ? '' : ' dim');
      el.querySelector('.enchglyph').textContent = cost ? this.glyphs[j] : '';
      const ct = el.querySelector('.enchcost'); ct.textContent = cost ? cost : ''; ct.style.color = ok ? '#80ff20' : '#407f10';
      if (p.creative && cost) ct.style.color = '#80ff20';
    }
    this.book.classList.toggle('open', !!this.items[0]);
  }
  onClose() { Stations.giveBack(Game.player, this.items[0]); Stations.giveBack(Game.player, this.items[1]); Slots.hideTip(); }
  quickTargets(st) { return Stations.nameOf(st) === 'lapis_lazuli' ? [this.lapisSlot] : [this.itemSlot]; }
}
function part2(cls, x, y, w, h) { const d = elAt(cls, x, y, `width:calc(var(--s)*${w});height:calc(var(--s)*${h});`); return d; }

// ---------------------------------------------------------------- anvil
class AnvilScreen extends Screens.Screen {
  constructor(x, y, z) {
    super('Repair & Name', 176, 166);
    const S = Stations;
    this.pos = { x, y, z }; this.items = [null, null]; this.result = null; this.cost = 0; this.repairUse = 0; this.name = '';
    this.in0 = Object.assign(this.slot(null, 0, 27, 47, { onChange: () => this.inputChanged(0) }), S.mk(this.items, 0));
    this.in1 = Object.assign(this.slot(null, 1, 76, 47, { onChange: () => this.update() }), S.mk(this.items, 1));
    this.out = this.slot(null, 2, 134, 47, { output: true, get: () => this.result, set: () => {}, onTake: r => this.take(r) });
    this.playerSlots(8, 84);
    this.label('Repair & Name', 60, 6);
    this.parts.push({ kind: 'el', node: part2('anvilfield', 59, 20, 110, 16) });
    this.input = document.createElement('input'); this.input.className = 'anvilname'; this.input.maxLength = 50; this.input.spellcheck = false;
    this.input.style.cssText = 'left:calc(var(--s)*62);top:calc(var(--s)*24);width:calc(var(--s)*103);height:calc(var(--s)*12);';
    this.input.addEventListener('input', () => { this.name = this.input.value; this.update(); Screens.render(); });
    this.input.addEventListener('mousedown', e => e.stopPropagation());
    this.parts.push({ kind: 'el', node: this.input });
    this.parts.push({ kind: 'el', node: elAt('anvilplus', 54, 47, '') });
    this.parts.push({ kind: 'el', node: elAt('craftarrow', 99, 45, GUI.css('craft_arrow')) });
    this.err = elAt('anvilerr', 99, 45, ''); this.parts.push({ kind: 'el', node: this.err });
    this.costEl = elAt('anvilcost', 0, 67, ''); this.parts.push({ kind: 'el', node: this.costEl });
  }
  inputChanged() {
    const s = this.items[0];
    if (s) { if (this.input && document.activeElement !== this.input || !this.name) { this.name = s.tag && s.tag.name ? s.tag.name : itemName(s); this.input.value = this.name; } }
    else { this.name = ''; if (this.input) this.input.value = ''; }
    this.input.disabled = !s;
    this.update();
  }
  // the game's AnvilMenu.createResult
  update() {
    const p = Game.player, a = this.items[0], b = this.items[1];
    this.result = null; this.cost = 0; this.repairUse = 0;
    if (!a) return;
    const it = ITEMS[a.id], out = Stations.clone(a);
    const ench = Object.assign({}, Stations.enchMap(a));
    let base = Stations.repairCostOf(a) + Stations.repairCostOf(b), cost = 0, rename = 0;
    if (b) {
      const bookIn = Stations.isBook(b) && Object.keys(Stations.enchMap(b)).length > 0;
      if (it.dur && it.repair && it.repair.includes(ITEMS[b.id].name)) {
        // repairing with the material: each unit restores a quarter of the durability
        let d = Math.min(out.dmg, Math.floor(it.dur / 4));
        if (d <= 0) return;
        let used = 0;
        for (; d > 0 && used < b.count; used++) { out.dmg -= d; cost++; d = Math.min(out.dmg, Math.floor(it.dur / 4)); }
        this.repairUse = used;
      } else {
        if (!bookIn && (b.id !== a.id || !it.dur)) return;
        if (it.dur && !bookIn) {
          const left = it.dur - a.dmg, right = it.dur - b.dmg, sum = left + right + Math.floor(it.dur * 12 / 100);
          const nd = Math.max(0, it.dur - sum);
          if (nd < out.dmg) { out.dmg = nd; cost += 2; }
        }
        let any = false, blocked = false;
        const other = Stations.enchMap(b);
        for (const e in other) {
          const lvl = other[e], cur = ench[e] || 0;
          let to = cur === lvl ? lvl + 1 : Math.max(lvl, cur);
          let ok = Enchant.applies(e, it, false) || p.creative || it.name === 'enchanted_book';
          for (const e2 in ench) if (e2 !== e && !Enchant.compatible(e, e2)) { ok = false; cost++; }
          if (!ok) { blocked = true; continue; }
          any = true;
          const max = (MCDATA.enchantments[e] || { max: 1 }).max; if (to > max) to = max;
          ench[e] = to;
          let k = Enchant.anvilCost(e); if (bookIn) k = Math.max(1, Math.floor(k / 2));
          cost += k * to;
          if (a.count > 1) cost = 40;
        }
        if (blocked && !any) return;
      }
    }
    // renaming (an empty name removes a custom name)
    const custom = a.tag && a.tag.name;
    if (!this.name || !this.name.trim()) { if (custom) { rename = 1; cost += rename; out.tag = Object.assign({}, out.tag); delete out.tag.name; } }
    else if (this.name !== (custom || itemName(a))) { rename = 1; cost += rename; out.tag = Object.assign({}, out.tag, { name: this.name }); }
    let total = base + cost;
    if (cost <= 0) return;
    if (rename === cost && rename > 0 && total >= 40) total = 39;
    this.cost = total;
    if (total >= 40 && !p.creative) { this.tooExpensive = true; return; }
    this.tooExpensive = false;
    let rc = Stations.repairCostOf(out); if (b && rc < Stations.repairCostOf(b)) rc = Stations.repairCostOf(b);
    if (rename !== cost || rename === 0) rc = rc * 2 + 1;
    out.tag = Object.assign({}, out.tag, { repairCost: rc });
    Stations.setEnch(out, ench);
    if (out.tag && !Object.keys(out.tag).length) delete out.tag;
    this.result = out;
  }
  canTake() { const p = Game.player; return this.result && (p.creative || p.xpLevel >= this.cost) && this.cost > 0; }
  take(r) {
    const p = Game.player;
    if (!this.canTake()) { Slots.cursor = null; Slots.cursor = null; this.update(); return; }
    if (!p.creative) p.addLevels(-this.cost);
    this.items[0] = null;
    if (this.repairUse > 0) { const b = this.items[1]; b.count -= this.repairUse; if (b.count <= 0) this.items[1] = null; } else this.items[1] = null;
    this.result = null; this.cost = 0;
    // the anvil can wear out: 12% chance a use damages it a stage
    const { x, y, z } = this.pos, id = World.getBlock(x, y, z), n = BLOCKS[id].name;
    if (!p.creative && Math.random() < 0.12) {
      const next = { anvil: 'chipped_anvil', chipped_anvil: 'damaged_anvil' }[n];
      if (next) { World.setBlock(x, y, z, BID[next], World.getState(x, y, z)); Sound.play('anvil_use', null, { x, y, z }); }
      else { World.setBlock(x, y, z, 0, 0); Sound.play('anvil_destroy', null, { x, y, z }); Screens.close(); return; }
    } else Sound.play('anvil_use', null, { x, y, z });
    this.inputChanged();
  }
  renderExtra() {
    const p = Game.player, a = this.items[0];
    this.err.style.display = a && this.items[1] && !this.result && !this.tooExpensive ? '' : 'none';
    if (!a || this.cost <= 0) Stations.costText(this.costEl, '', '');
    else if (this.tooExpensive) Stations.costText(this.costEl, 'Too Expensive!', '#ff6060');
    else Stations.costText(this.costEl, 'Enchantment Cost: ' + this.cost, p.creative || p.xpLevel >= this.cost ? '#80ff20' : '#ff6060');
  }
  onClose() { Stations.giveBack(Game.player, this.items[0]); Stations.giveBack(Game.player, this.items[1]); }
  quickTargets(st) { return [this.in0, this.in1]; }
}

// ---------------------------------------------------------------- grindstone
class GrindstoneScreen extends Screens.Screen {
  constructor(x, y, z) {
    super('Repair & Disenchant', 176, 166);
    const S = Stations;
    this.pos = { x, y, z }; this.items = [null, null]; this.result = null;
    const ok = s => !!ITEMS[s.id].dur || Object.keys(S.enchMap(s)).length > 0;
    this.in0 = Object.assign(this.slot(null, 0, 49, 19, { filter: ok, onChange: () => this.update() }), S.mk(this.items, 0));
    this.in1 = Object.assign(this.slot(null, 1, 49, 40, { filter: ok, onChange: () => this.update() }), S.mk(this.items, 1));
    this.out = this.slot(null, 2, 129, 34, { output: true, get: () => this.result, set: () => {}, onTake: () => this.take() });
    this.playerSlots(8, 84);
    this.label('Repair & Disenchant', 8, 6);
    this.parts.push({ kind: 'el', node: elAt('grindpic', 75, 18, '') });
    this.err = elAt('anvilerr', 92, 31, ''); this.parts.push({ kind: 'el', node: this.err });
  }
  static keepCurses(s) {
    const map = Stations.enchMap(s), keep = {};
    for (const e in map) if (Stations.isCurse(e)) keep[e] = map[e];
    Stations.setEnch(s, keep);
    if (Stations.isBook(s) && !Object.keys(keep).length) { s.id = IID.book; if (s.tag) { delete s.tag.stored; if (!Object.keys(s.tag).length) delete s.tag; } }
    let rc = 0; for (let i = 0; i < Object.keys(keep).length; i++) rc = rc * 2 + 1;
    if (rc) s.tag = Object.assign({}, s.tag, { repairCost: rc }); else if (s.tag) { delete s.tag.repairCost; if (!Object.keys(s.tag).length) delete s.tag; }
    return s;
  }
  update() {
    const [a, b] = this.items; this.result = null;
    if (!a && !b) return;
    if ((a && a.count > 1) || (b && b.count > 1)) return;
    if (a && b) {
      if (a.id !== b.id) return;
      const it = ITEMS[a.id];
      let out;
      if (it.dur) {
        const sum = (it.dur - a.dmg) + (it.dur - b.dmg) + Math.floor(it.dur * 5 / 100);
        out = Stations.clone(a); out.dmg = Math.max(0, it.dur - sum);
      } else { if (maxStack(a) < 2 || !sameItem(a, b)) return; out = Stations.clone(a); out.count = 2; }
      const merged = Object.assign({}, Stations.enchMap(out));
      const other = Stations.enchMap(b); for (const e in other) if (!Stations.isCurse(e) || !merged[e]) merged[e] = Math.max(merged[e] || 0, other[e]);
      Stations.setEnch(out, merged);
      this.result = GrindstoneScreen.keepCurses(out);
      return;
    }
    const one = a || b;
    if (!Object.keys(Stations.enchMap(one)).length) return;
    this.result = GrindstoneScreen.keepCurses(Stations.clone(one));
  }
  // experience from the enchantments taken off: half of the total minimum costs, plus a random part
  xp() {
    let i = 0;
    for (const s of this.items) { const m = Stations.enchMap(s); for (const e in m) if (!Stations.isCurse(e)) i += Enchant.cost(e, m[e]); }
    if (i <= 0) return 0;
    const l = Math.ceil(i / 2);
    return l + Math.floor(Math.random() * l);
  }
  take() {
    const { x, y, z } = this.pos, xp = this.xp();
    if (xp > 0) Drops.spawnXp(x + 0.5, y + 0.5, z + 0.5, xp);
    this.items[0] = null; this.items[1] = null; this.result = null;
    Sound.play('grindstone_use', null, { x, y, z });
  }
  renderExtra() { this.err.style.display = (this.items[0] || this.items[1]) && !this.result ? '' : 'none'; }
  onClose() { Stations.giveBack(Game.player, this.items[0]); Stations.giveBack(Game.player, this.items[1]); }
  quickTargets() { return [this.in0, this.in1]; }
}

// ---------------------------------------------------------------- stonecutter
class StonecutterScreen extends Screens.Screen {
  constructor(x, y, z) {
    super('Stonecutter', 176, 166);
    this.pos = { x, y, z }; this.items = [null]; this.recipes = []; this.sel = -1; this.scroll = 0; this.result = null;
    this.inSlot = Object.assign(this.slot(null, 0, 20, 33, { onChange: () => this.inputChanged() }), Stations.mk(this.items, 0));
    this.out = this.slot(null, 1, 143, 33, { output: true, big: true, get: () => this.result, set: () => {}, onTake: r => this.take(r) });
    this.playerSlots(8, 84);
    this.label('Stonecutter', 8, 4);
    this.list = part2('stonelist', 52, 14, 64, 54); this.list.style.pointerEvents = 'auto'; this.parts.push({ kind: 'el', node: this.list });
    this.list.addEventListener('wheel', e => { e.preventDefault(); const rows = Math.ceil(this.recipes.length / 4); this.scroll = Math.max(0, Math.min(rows - 3, this.scroll + Math.sign(e.deltaY))); this.drawList(); });
    this.bar = elAt('stonescroll', 119, 15, GUI.css('scroll')); this.parts.push({ kind: 'el', node: this.bar });
    this.lastId = -1;
  }
  inputChanged() {
    const s = this.items[0];
    if (!s || s.id !== this.lastId) {
      this.sel = -1; this.scroll = 0;
      this.recipes = s ? MCDATA.stonecutting.filter(r => r[0] === ITEMS[s.id].name && IID[r[1]] !== undefined) : [];
      this.lastId = s ? s.id : -1;
    }
    this.update(); this.drawList();
  }
  update() { const s = this.items[0], r = this.recipes[this.sel]; this.result = s && r ? stack(r[1], r[2]) : null; }
  drawList() {
    const S = GUI.S, p0 = this.scroll * 4;
    let h = '';
    for (let i = p0; i < Math.min(this.recipes.length, p0 + 12); i++) {
      const k = i - p0, r = this.recipes[i];
      h += `<div class="stonebtn${i === this.sel ? ' sel' : ''}" data-i="${i}" style="left:${(k % 4) * 16 * S}px;top:${Math.floor(k / 4) * 18 * S}px">${iconHTML(stack(r[1], 1))}</div>`;
    }
    this.list.innerHTML = h;
    for (const el of this.list.querySelectorAll('.stonebtn')) {
      const i = +el.dataset.i;
      el.addEventListener('mousedown', e => { e.stopPropagation(); this.sel = i; Sound.play('click'); this.update(); this.drawList(); Screens.render(); });
      el.addEventListener('mouseenter', () => Slots.showTip(stack(this.recipes[i][1], this.recipes[i][2])));
      el.addEventListener('mouseleave', () => Slots.hideTip());
    }
    const rows = Math.ceil(this.recipes.length / 4), f = rows > 3 ? this.scroll / (rows - 3) : 0;
    this.bar.style.top = `calc(var(--s)*${15 + Math.round(f * 41)})`;
    this.bar.style.filter = rows > 3 ? '' : 'brightness(0.75)';
  }
  take() {
    const s = this.items[0]; if (!s) return;
    s.count--; if (s.count <= 0) this.items[0] = null;
    Sound.play('stonecutter_take', null, this.pos);
    Stats.add('crafted', ITEMS[this.result.id].name);
    if (!this.items[0]) { this.result = null; this.inputChanged(); } else this.update();
  }
  build() { super.build(); this.drawList(); }
  onClose() { Stations.giveBack(Game.player, this.items[0]); Slots.hideTip(); }
  quickTargets() { return [this.inSlot]; }
}

// ---------------------------------------------------------------- smithing table
const TRIM_MATERIAL = { iron_ingot: ['iron', '#ececec'], copper_ingot: ['copper', '#b4684d'], gold_ingot: ['gold', '#deb12d'], lapis_lazuli: ['lapis', '#416e97'], emerald: ['emerald', '#11a036'],
  diamond: ['diamond', '#6eecd2'], netherite_ingot: ['netherite', '#625859'], redstone: ['redstone', '#971607'], quartz: ['quartz', '#e3d4c4'], amethyst_shard: ['amethyst', '#9a5cc6'] };
class SmithingScreen extends Screens.Screen {
  constructor(x, y, z) {
    super('Upgrade Gear', 176, 166);
    const S = Stations;
    this.pos = { x, y, z }; this.items = [null, null, null]; this.result = null;
    const isTemplate = s => /_smithing_template$/.test(S.nameOf(s));
    this.tSlot = Object.assign(this.slot(null, 0, 8, 48, { filter: isTemplate, emptyIcon: 'empty_template', onChange: () => this.update() }), S.mk(this.items, 0));
    this.bSlot = Object.assign(this.slot(null, 1, 26, 48, { onChange: () => this.update() }), S.mk(this.items, 1));
    this.aSlot = Object.assign(this.slot(null, 2, 44, 48, { onChange: () => this.update() }), S.mk(this.items, 2));
    this.out = this.slot(null, 3, 98, 48, { output: true, get: () => this.result, set: () => {}, onTake: () => this.take() });
    this.playerSlots(8, 84);
    this.label('Upgrade Gear', 44, 15);
    this.parts.push({ kind: 'el', node: elAt('craftarrow', 68, 49, GUI.css('craft_arrow')) });
    this.err = elAt('anvilerr', 65, 46, ''); this.parts.push({ kind: 'el', node: this.err });
    this.parts.push({ kind: 'el', node: elAt('smithicon', 7, 15, '') });
  }
  static trimTooltip(s) {
    const t = s.tag && s.tag.trim; if (!t) return '';
    const m = Object.values(TRIM_MATERIAL).find(v => v[0] === t.material) || ['', '#aaa'];
    const cap = w => w.split('_').map(x => x[0].toUpperCase() + x.slice(1)).join(' ');
    return `<div style="color:#aaaaaa">Upgrade:</div><div style="color:${m[1]}">&nbsp;${cap(t.pattern)} Armor Trim</div><div style="color:${m[1]}">&nbsp;${cap(t.material)} Material</div>`;
  }
  update() {
    const [t, b, a] = this.items.map(Stations.nameOf), base = this.items[1];
    this.result = null;
    if (!t || !b || !a) return;
    const up = MCDATA.smithing.find(r => r[0] === t && r[1] === b && r[2] === a);
    if (up && IID[up[3]] !== undefined) { this.result = Object.assign(Stations.clone(base), { id: IID[up[3]], count: 1 }); return; }
    if (MCDATA.trimTemplates.includes(t) && (MCDATA.itemTags.trimmable_armor || []).includes(b) && TRIM_MATERIAL[a]) {
      const pattern = t.replace('_armor_trim_smithing_template', ''), material = TRIM_MATERIAL[a][0];
      const cur = base.tag && base.tag.trim;
      if (cur && cur.pattern === pattern && cur.material === material) return;
      const out = Object.assign(Stations.clone(base), { count: 1 }); out.tag = Object.assign({}, out.tag, { trim: { pattern, material } });
      this.result = out;
    }
  }
  take() {
    for (let i = 0; i < 3; i++) { const s = this.items[i]; if (!s) continue; s.count--; if (s.count <= 0) this.items[i] = null; }
    Sound.play('smithing_table_use', null, this.pos);
    this.update();
  }
  renderExtra() { this.err.style.display = this.items.every(s => s) && !this.result ? '' : 'none'; }
  onClose() { for (const s of this.items) Stations.giveBack(Game.player, s); }
  quickTargets(st) { const n = Stations.nameOf(st); if (/_smithing_template$/.test(n)) return [this.tSlot]; if (TRIM_MATERIAL[n] || n === 'netherite_ingot') return [this.aSlot, this.bSlot]; return [this.bSlot]; }
}

// ---------------------------------------------------------------- brewing stand
const Brewing = (() => {
  const isBottle = s => ['potion', 'splash_potion', 'lingering_potion', 'glass_bottle'].includes(Stations.nameOf(s));
  function brewable(it) {
    const ing = it[3]; if (!ing || !Potions.isIngredient(ing)) return false;
    for (let i = 0; i < 3; i++) if (it[i] && Potions.brew(it[i], ing)) return true;
    return false;
  }
  // BrewingStandBlockEntity.serverTick: blaze powder gives 20 brews, a brew takes 400 ticks
  function tick(be) {
    const it = be.items;
    if (be.fuel <= 0 && it[4] && Stations.nameOf(it[4]) === 'blaze_powder') { be.fuel = 20; it[4].count--; if (it[4].count <= 0) it[4] = null; }
    const can = brewable(it);
    if (be.time > 0) {
      be.time--;
      if (be.time === 0 && can) brew(be);
      else if (!can || !it[3] || it[3].id !== be.ingredient) be.time = 0;
    } else if (can && be.fuel > 0) { be.fuel--; be.time = 400; be.ingredient = it[3].id; }
  }
  function brew(be) {
    const it = be.items, ing = it[3];
    for (let i = 0; i < 3; i++) { if (!it[i]) continue; const r = Potions.brew(it[i], ing); if (r) it[i] = r; }
    ing.count--;
    if (Stations.nameOf(ing) === 'dragon_breath') { const bottle = stack('glass_bottle'); if (ing.count <= 0) it[3] = bottle; else Drops.spawnItem(be.x + 0.5, be.y + 1, be.z + 0.5, bottle); }
    if (ing.count <= 0 && it[3] === ing) it[3] = null;
    Sound.play('brewing_stand_brew', null, { x: be.x, y: be.y, z: be.z });
  }
  return { tick, isBottle, brewable };
})();
class BrewingScreen extends Screens.Screen {
  constructor(be) {
    super('Brewing Stand', 176, 166);
    const S = Stations;
    this.be = be;
    if (be.items.length < 5) while (be.items.length < 5) be.items.push(null);
    const it = be.items;
    this.bottles = [[56, 51], [79, 58], [102, 51]].map(([x, y], i) => Object.assign(this.slot(null, i, x, y, { max: 1, filter: Brewing.isBottle, emptyIcon: 'empty_bottle' }), S.mk(it, i)));
    this.ingSlot = Object.assign(this.slot(null, 3, 79, 17, { filter: s => Potions.isIngredient(s) }), S.mk(it, 3));
    this.fuelSlot = Object.assign(this.slot(null, 4, 17, 17, { filter: s => S.nameOf(s) === 'blaze_powder', emptyIcon: 'empty_blaze' }), S.mk(it, 4));
    this.playerSlots(8, 84);
    this.label('Brewing Stand', 0, 6, { center: true });
    this.parts.push({ kind: 'el', node: elAt('brewpipes', 0, 0, '') });
    this.bub = elAt('brewbub', 65, 14, GUI.css('brew_bubbles')); this.parts.push({ kind: 'el', node: this.bub });
    this.arrow = elAt('brewarrow', 97, 16, GUI.css('brew_arrow')); this.parts.push({ kind: 'el', node: this.arrow });
    this.fuelBar = elAt('brewfuel', 60, 44, GUI.css('blaze_fuel')); this.parts.push({ kind: 'el', node: this.fuelBar });
  }
  tick() {}
  renderExtra() {
    const S = GUI.S, be = this.be;
    const f = Math.max(0, Math.min(18, Math.round(18 * be.fuel / 20)));
    this.fuelBar.style.clipPath = `inset(0 ${(18 - f) * S}px 0 0)`;
    const t = be.time > 0 ? Math.round(28 * (1 - be.time / 400)) : 0;
    this.arrow.style.clipPath = `inset(0 0 ${(28 - t) * S}px 0)`; this.arrow.style.display = be.time > 0 ? '' : 'none';
    const b = be.time > 0 ? [0, 6, 11, 16, 20, 24, 29][Math.floor((400 - be.time) / 2) % 7] : 0;
    this.bub.style.clipPath = `inset(${(10 - Math.min(10, b / 2.9)) * S}px 0 0 0)`; this.bub.style.display = be.time > 0 ? '' : 'none';
  }
  quickTargets(st) {
    if (Stations.nameOf(st) === 'blaze_powder') return [this.fuelSlot, this.ingSlot];
    if (Brewing.isBottle(st)) return this.bottles;
    if (Potions.isIngredient(st)) return [this.ingSlot];
    return [];
  }
}

// ---------------------------------------------------------------- beacon
const Beacons = (() => {
  const BASE = new Set(['iron_block', 'gold_block', 'diamond_block', 'emerald_block', 'netherite_block'].map(n => BID[n]));
  const TIERS = [['speed', 'haste'], ['resistance', 'jump_boost'], ['strength'], ['regeneration']];
  const active = new Map(); // "x,y,z" -> { x, y, z, levels, segments }
  // the pyramid under it: up to four complete layers of iron, gold, emerald, diamond or netherite blocks
  function levelsAt(x, y, z) {
    let lv = 0;
    for (let i = 1; i <= 4; i++) {
      const yy = y - i; if (yy < MINY) break;
      let ok = true;
      for (let dx = -i; dx <= i && ok; dx++) for (let dz = -i; dz <= i; dz++) if (!BASE.has(World.getBlock(x + dx, yy, z + dz))) { ok = false; break; }
      if (!ok) break;
      lv = i;
    }
    return lv;
  }
  // the beam goes straight up, coloured by stained glass and stopped by solid blocks (bedrock lets it through)
  function beam(x, y, z) {
    const segs = []; let col = [1, 1, 1], start = y + 1, mixed = false;
    for (let yy = y + 1; yy <= MAXY; yy++) {
      const id = World.getBlock(x, yy, z), n = BLOCKS[id].name;
      const glass = n.endsWith('_stained_glass') || n.endsWith('_stained_glass_pane') ? n.replace(/_stained_glass(_pane)?$/, '') : null;
      if (glass && Tex.CLR[glass] !== undefined) {
        const c = Tex.CLR[glass], rgb = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
        const next = mixed ? col.map((v, i) => (v + rgb[i]) / 2) : rgb;
        segs.push({ y0: start, y1: yy, col }); start = yy; col = next; mixed = true;
        continue;
      }
      if (OPACITY[id] >= 15 && id !== BID.bedrock) return null;
    }
    segs.push({ y0: start, y1: MAXY + 1, col });
    return segs;
  }
  function tick(be) {
    if (Ticks.now % 80 !== 0) return;
    const { x, y, z } = be, key = x + ',' + y + ',' + z;
    if (World.getBlock(x, y, z) !== BID.beacon) { active.delete(key); return; }
    const segs = beam(x, y, z);
    be.levels = segs ? levelsAt(x, y, z) : 0;
    if (be.levels > 0 && segs) active.set(key, { x, y, z, levels: be.levels, segs }); else active.delete(key);
    BeaconBeams.dirty = true;
    if (be.levels <= 0 || !be.primary) return;
    // powers: range 10 + 10 per level, 9 + 2 per level seconds, level II when both powers are the same
    const range = be.levels * 10 + 10, dur = (9 + be.levels * 2) * 20;
    const amp = be.levels >= 4 && be.primary === be.secondary ? 1 : 0;
    const p = Game.player;
    if (p && !p.dead && Math.abs(p.x - x - 0.5) <= range + 0.5 && Math.abs(p.z - z - 0.5) <= range + 0.5 && p.y >= y - range && World.dim === (be.dim || World.dim)) {
      p.addEffect(be.primary, dur, amp, { ambient: true });
      if (be.levels >= 4 && be.secondary && be.secondary !== be.primary) p.addEffect(be.secondary, dur, 0, { ambient: true });
    }
  }
  return { tick, TIERS, levelsAt, active, beam };
})();
// the beams, drawn as two crossed bright columns that scroll (no shaders beyond the plain colour)
const BeaconBeams = (() => {
  const group = new THREE.Group(); scene.add(group);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, vertexColors: true });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, vertexColors: true });
  const api = { dirty: false };
  function rebuild() {
    for (const c of group.children.slice()) { group.remove(c); c.geometry.dispose(); }
    for (const b of Beacons.active.values()) for (const s of b.segs) {
      for (const [w, m] of [[0.2, mat], [0.25, glow]]) {
        const g = new THREE.BoxGeometry(w * 2, s.y1 - s.y0, w * 2);
        const n = g.attributes.position.count, cols = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) cols.set(s.col, i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const mesh = new THREE.Mesh(g, m); mesh.position.set(b.x + 0.5, (s.y0 + s.y1) / 2, b.z + 0.5); mesh.renderOrder = 6; mesh.frustumCulled = false;
        if (w === 0.2) mesh.rotation.y = Math.PI / 4;
        group.add(mesh);
      }
    }
  }
  api.update = () => { if (api.dirty) { api.dirty = false; rebuild(); } const t = performance.now() / 1000; for (const c of group.children) if (c.material === mat) c.rotation.y = Math.PI / 4 + t * 0.6; };
  api.clear = () => { Beacons.active.clear(); api.dirty = true; };
  return api;
})();
class BeaconScreen extends Screens.Screen {
  constructor(be) {
    super('Beacon', 230, 219);
    this.be = be; this.items = [null];
    this.prim = be.primary || null; this.sec = be.secondary || null;
    this.pay = Object.assign(this.slot(null, 0, 136, 110, { max: 1, filter: s => (MCDATA.itemTags.beacon_payment_items || []).includes(Stations.nameOf(s)) }), Stations.mk(this.items, 0));
    this.playerSlots(36, 137); this.invLabel = null;
    this.label('Primary Power', 62 - 34, 10); this.label('Secondary Power', 169 - 40, 10);
    this.buttons = [];
    const T = Beacons.TIERS;
    for (let i = 0; i < 3; i++) { const n = T[i].length, k = n * 22 + (n - 1) * 2; T[i].forEach((ef, l) => this.button(76 + l * 24 - k / 2, 22 + i * 25, ef, true, i)); }
    { const n = T[3].length + 1, k = n * 22 + (n - 1) * 2; T[3].forEach((ef, l) => this.button(167 + l * 24 - k / 2, 47, ef, false, 3)); this.button(167 + (n - 1) * 24 - k / 2, 47, null, false, 3, true); }
    for (const [x, y, n] of [[13, 22, 1], [13, 47, 2], [13, 72, 3], [133, 22, 4]]) this.parts.push({ kind: 'el', node: Object.assign(elAt('beaconpyr', x, y, ''), { innerHTML: '◆'.repeat(n) }) });
    const ok = elAt('beaconok', 164, 107, ''), no = elAt('beaconno', 190, 107, '');
    ok.style.pointerEvents = no.style.pointerEvents = 'auto';
    ok.addEventListener('mousedown', e => { e.stopPropagation(); this.confirm(); });
    no.addEventListener('mousedown', e => { e.stopPropagation(); Screens.close(); });
    this.ok = ok; this.parts.push({ kind: 'el', node: ok }, { kind: 'el', node: no });
    const pay = elAt('beaconitems', 20, 109, ''); this.parts.push({ kind: 'el', node: pay }); this.payIcons = pay;
  }
  button(x, y, effect, primary, tier, upgrade) {
    const el = elAt('beaconbtn', x, y, ''); el.style.pointerEvents = 'auto';
    const b = { el, effect, primary, tier, upgrade };
    el.addEventListener('mousedown', e => { e.stopPropagation(); if (!this.enabled(b)) return; if (primary) { this.prim = effect; if (this.sec && this.sec !== 'regeneration') this.sec = null; } else this.sec = upgrade ? this.prim : effect; Sound.play('click'); Screens.render(); });
    el.addEventListener('mouseenter', () => { const ef = upgrade ? this.prim : effect; if (ef) Slots.showTipHTML(`<div style="color:#fff">${escapeHTML(Potions.name(ef))}${upgrade ? ' II' : ''}</div>`); });
    el.addEventListener('mouseleave', () => Slots.hideTip());
    this.buttons.push(b); this.parts.push({ kind: 'el', node: el });
  }
  enabled(b) { const lv = this.be.levels || 0; if (b.primary) return lv > b.tier; if (lv < 4) return false; if (b.upgrade) return !!this.prim; return !!this.prim; }
  confirm() {
    if (!this.items[0] || !this.prim) return;
    this.be.primary = this.prim; this.be.secondary = this.sec; this.items[0] = null;
    Sound.play('beacon_power_select', null, this.be);
    Screens.close();
  }
  renderExtra() {
    for (const b of this.buttons) {
      const ef = b.upgrade ? this.prim : b.effect, on = this.enabled(b), sel = b.primary ? this.prim === b.effect : (b.upgrade ? this.sec && this.sec === this.prim : this.sec === b.effect);
      b.el.className = 'gpart beaconbtn' + (on ? '' : ' off') + (sel ? ' sel' : '');
      const html = ef ? `<i style="${EffectIcons.css(ef, GUI.S)}"></i>` + (b.upgrade ? '<b>II</b>' : '') : '';
      if (b.el._h !== html) { b.el.innerHTML = html; b.el._h = html; }
    }
    this.ok.classList.toggle('off', !(this.items[0] && this.prim));
    if (!this.payIcons._d) { this.payIcons._d = 1; this.payIcons.innerHTML = ['netherite_ingot', 'emerald', 'diamond', 'gold_ingot', 'iron_ingot'].map((n, i) => `<span style="left:calc(var(--s)*${i * 22})">${iconHTML(stack(n))}</span>`).join(''); }
  }
  onClose() { Stations.giveBack(Game.player, this.items[0]); Slots.hideTip(); }
  quickTargets(st) { return [this.pay]; }
}
