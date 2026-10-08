'use strict';
/* Inventories: lists of slots holding item stacks, with the game's stacking rules. */
class Inventory {
  constructor(size) { this.slots = new Array(size).fill(null); this.listeners = []; }
  get size() { return this.slots.length; }
  get(i) { return this.slots[i]; }
  set(i, s) { this.slots[i] = s && s.count > 0 ? s : null; this.changed(); }
  changed() { for (const f of this.listeners) f(this); }
  // add as much of the stack as fits (first merging into matching stacks); returns what is left (or null)
  add(s, from, to) {
    if (!s) return null;
    from = from || 0; to = to === undefined ? this.slots.length : to;
    s = Object.assign({}, s);
    const max = maxStack(s);
    for (let i = from; i < to && s.count > 0; i++) { const t = this.slots[i]; if (t && sameItem(t, s) && t.count < max) { const n = Math.min(max - t.count, s.count); t.count += n; s.count -= n; } }
    for (let i = from; i < to && s.count > 0; i++) if (!this.slots[i]) { const n = Math.min(max, s.count); this.slots[i] = Object.assign({}, s, { count: n }); s.count -= n; }
    this.changed();
    return s.count > 0 ? s : null;
  }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; }
  remove(id, n) { for (let i = 0; i < this.slots.length && n > 0; i++) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (!s.count) this.slots[i] = null; } } this.changed(); return n === 0; }
  find(fn) { for (let i = 0; i < this.slots.length; i++) if (this.slots[i] && fn(this.slots[i])) return i; return -1; }
  clear() { this.slots.fill(null); this.changed(); }
  toJSON() { return this.slots; }
  load(arr) { for (let i = 0; i < this.slots.length; i++) this.slots[i] = arr && arr[i] ? arr[i] : null; this.changed(); }
}
// the player's inventory: 0-8 hotbar, 9-35 main, 36-39 armour (head, chest, legs, feet), 40 off hand
class PlayerInventory extends Inventory {
  constructor() { super(41); this.selected = 0; }
  get held() { return this.slots[this.selected]; }
  set held(s) { this.set(this.selected, s); }
  get offhand() { return this.slots[40]; }
  armor(i) { return this.slots[36 + i]; }
  // picking up: hotbar first, then the main inventory
  addItem(s) { return this.add(s, 0, 36); }
  damageHeld(n, owner) { const s = this.held; if (!s) return; damageItem(s, n, owner, () => { this.held = null; Sound.play('break_item', owner); }); this.changed(); }
}
// lose durability (Unbreaking gives a chance to skip); calls broke() when it breaks
function damageItem(s, n, owner, broke) {
  const it = ITEMS[s.id];
  if (!it.dur || (owner && owner.gamemode === 'creative')) return;
  const ub = enchLevel(s, 'unbreaking');
  for (let i = 0; i < n; i++) {
    if (ub > 0) { const keep = it.armor ? Math.random() < 0.6 + 0.4 / (ub + 1) : Math.random() < 1 / (ub + 1); if (!keep) continue; }
    s.dmg++;
  }
  if (s.dmg >= it.dur) broke();
}
