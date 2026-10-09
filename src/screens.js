'use strict';
/* Container screens and the game's mouse rules for slots: left click picks up / places / swaps, right click
   picks up half or places one, shift-click moves a stack across, dragging spreads a stack over slots,
   double-click collects matching items, number keys swap with the hotbar, Q drops, clicking outside drops. */
const Slots = (() => {
  let cursor = null;               // the stack held by the mouse
  let hover = null;                 // the slot under the mouse
  let drag = null;                  // { button, slots: Set } while dragging a stack
  let lastClick = { t: 0, slot: null };
  let mouseX = 0, mouseY = 0;
  const cursorEl = document.createElement('div'); cursorEl.id = 'cursorItem'; document.body.appendChild(cursorEl);
  const tip = document.createElement('div'); tip.id = 'tooltip'; tip.className = 'hidden'; document.body.appendChild(tip);
  addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; place(); if (drag && hover && drag.slots && canDragInto(hover)) { drag.slots.add(hover); Screens.render(); } });
  function place() {
    cursorEl.style.left = (mouseX - 8 * GUI.S) + 'px'; cursorEl.style.top = (mouseY - 8 * GUI.S) + 'px';
    if (!tip.classList.contains('hidden')) { let x = mouseX + 12 * GUI.S / 2 + 6, y = mouseY - 12 * GUI.S / 2 - 10; const r = tip.getBoundingClientRect(); if (x + r.width > innerWidth - 4) x = mouseX - r.width - 12; if (y < 4) y = 4; if (y + r.height > innerHeight) y = innerHeight - r.height - 4; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  }
  const get = s => s.get ? s.get() : s.inv.get(s.i);
  const set = (s, v) => { if (s.set) s.set(v); else s.inv.set(s.i, v); };
  const accepts = (s, st) => !s.output && (!s.filter || s.filter(st));
  const maxFor = (s, st) => Math.min(maxStack(st), s.max || 64);
  function canDragInto(s) { if (!cursor || !accepts(s, cursor)) return false; const t = get(s); return !t || sameItem(t, cursor); }
  function setCursor(s) { cursor = s && s.count > 0 ? s : null; renderCursor(); }
  function renderCursor() {
    if (!cursor) { cursorEl.innerHTML = ''; return; }
    let shown = cursor.count;
    if (drag && drag.slots && drag.slots.size > 1) { const n = drag.slots.size; shown = drag.button === 0 ? cursor.count - Math.floor(cursor.count / n) * n : cursor.count - n; }
    cursorEl.innerHTML = iconHTML(Object.assign({}, cursor, { count: Math.max(0, shown) }));
  }
  // ---------------------------------------------------------------- clicks
  function mouseDown(s, button, e) {
    const scr = Screens.current; if (!scr) return;
    const shift = e.shiftKey, now = performance.now();
    if (scr.creativeClick && scr.creativeClick(s, button, e)) { Screens.render(); return; }
    // double-click: gather the same item into the cursor
    if (button === 0 && !shift && cursor && lastClick.slot === s && now - lastClick.t < 300) { collect(scr, cursor); lastClick.t = 0; Screens.render(); return; }
    lastClick = { t: now, slot: s };
    if (shift && button !== 1) { scr.quickMove(s); Screens.render(); return; }
    if (button === 1) { // middle click: copy in creative
      if (Game.player.creative && get(s) && !cursor) setCursor(Object.assign({}, get(s), { count: maxStack(get(s)) }));
      Screens.render(); return;
    }
    if (cursor && !s.output && accepts(s, cursor) && (!get(s) || sameItem(get(s), cursor))) { drag = { button, slots: new Set([s]), start: s }; Screens.render(); return; }
    click(s, button); Screens.render();
  }
  function mouseUp(button) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.slots.size <= 1) { click(d.start, d.button); Screens.render(); return; }
    const list = [...d.slots].filter(s => canDragInto(s));
    if (!cursor) { Screens.render(); return; }
    let left = cursor.count;
    const each = d.button === 0 ? Math.floor(cursor.count / list.length) : 1;
    for (const s of list) {
      if (left <= 0) break;
      const t = get(s), cur = t ? t.count : 0, room = maxFor(s, cursor) - cur, n = Math.min(each, room, left);
      if (n <= 0) continue;
      set(s, Object.assign({}, cursor, { count: cur + n })); left -= n;
    }
    setCursor(left > 0 ? Object.assign({}, cursor, { count: left }) : null);
    Screens.render();
  }
  function click(s, button) {
    const t = get(s);
    if (s.output) { takeOutput(s, false); return; }
    if (button === 0) {
      if (!cursor) { if (t) { if (s.onTake) s.onTake(t); setCursor(t); set(s, null); } }
      else if (!t) { if (accepts(s, cursor)) { const n = Math.min(cursor.count, maxFor(s, cursor)); set(s, Object.assign({}, cursor, { count: n })); setCursor(cursor.count - n > 0 ? Object.assign({}, cursor, { count: cursor.count - n }) : null); } }
      else if (sameItem(t, cursor)) { if (accepts(s, cursor)) { const n = Math.min(cursor.count, maxFor(s, t) - t.count); if (n > 0) { t.count += n; set(s, t); setCursor(cursor.count - n > 0 ? Object.assign({}, cursor, { count: cursor.count - n }) : null); } } }
      else if (accepts(s, cursor) && cursor.count <= maxFor(s, cursor)) { if (s.onTake) s.onTake(t); set(s, cursor); setCursor(t); }
    } else if (button === 2) {
      if (!cursor) { if (t) { const half = Math.ceil(t.count / 2); setCursor(Object.assign({}, t, { count: half })); set(s, t.count - half > 0 ? Object.assign({}, t, { count: t.count - half }) : null); if (s.onTake) s.onTake(t); } }
      else if (!t) { if (accepts(s, cursor)) { set(s, Object.assign({}, cursor, { count: 1 })); setCursor(cursor.count > 1 ? Object.assign({}, cursor, { count: cursor.count - 1 }) : null); } }
      else if (sameItem(t, cursor)) { if (accepts(s, cursor) && t.count < maxFor(s, t)) { t.count++; set(s, t); setCursor(cursor.count > 1 ? Object.assign({}, cursor, { count: cursor.count - 1 }) : null); } }
      else if (accepts(s, cursor) && cursor.count <= maxFor(s, cursor)) { set(s, cursor); setCursor(t); }
    }
    if (s.onChange) s.onChange();
  }
  // taking a crafting / smelting result
  function takeOutput(s, all) {
    const scr = Screens.current;
    let n = 0;
    do {
      const r = get(s); if (!r) break;
      if (all) {
        const left = Game.player.inv.add(r, 0, 36);
        if (left && left.count === r.count) break;
        if (left) { break; }
      } else {
        if (cursor && (!sameItem(cursor, r) || cursor.count + r.count > maxStack(r))) break;
        setCursor(cursor ? Object.assign({}, cursor, { count: cursor.count + r.count }) : Object.assign({}, r));
      }
      if (s.onTake) s.onTake(r); else set(s, null);
      n++;
    } while (all && n < 64);
    if (scr && scr.update) scr.update();
  }
  // gather items matching the cursor from every slot (fullest stacks last)
  function collect(scr, c) {
    const max = maxStack(c);
    for (const pass of [0, 1]) for (const s of scr.slots) {
      if (cursor.count >= max || s.output) continue;
      const t = get(s); if (!t || !sameItem(t, c)) continue;
      if (pass === 0 && t.count >= maxStack(t)) continue;
      const n = Math.min(t.count, max - cursor.count); cursor.count += n; t.count -= n; set(s, t.count ? t : null);
    }
    renderCursor();
  }
  // move a stack into a list of slots (merge first, then empty slots); returns what is left
  function moveInto(st, list, reverse) {
    if (!st) return null;
    st = Object.assign({}, st);
    const order = reverse ? list.slice().reverse() : list;
    for (const s of order) { if (!st.count) break; const t = get(s); if (t && sameItem(t, st) && accepts(s, st)) { const n = Math.min(st.count, maxFor(s, t) - t.count); if (n > 0) { t.count += n; st.count -= n; set(s, t); } } }
    for (const s of order) { if (!st.count) break; if (!get(s) && accepts(s, st)) { const n = Math.min(st.count, maxFor(s, st)); set(s, Object.assign({}, st, { count: n })); st.count -= n; } }
    return st.count ? st : null;
  }
  // keyboard while a screen is open: number keys swap with the hotbar, Q drops, F swaps with the off hand
  function key(e) {
    if (!hover || !Screens.current) return false;
    const p = Game.player, s = hover;
    if (/^Digit[1-9]$/.test(e.code)) {
      const k = +e.code.slice(5) - 1; const hs = { inv: p.inv, i: k };
      if (s.output) { const r = get(s); if (r && !p.inv.get(k)) { p.inv.set(k, r); if (s.onTake) s.onTake(r); else set(s, null); } }
      else { const a = get(s), b = p.inv.get(k); if (b && !accepts(s, b)) return true; set(s, b); set(hs, a); }
      Screens.render(); return true;
    }
    if (e.code === Input.BIND.swap) { const a = get(s), b = p.inv.get(40); if (s.output) return true; set(s, b); p.inv.set(40, a); Screens.render(); return true; }
    if (e.code === Input.BIND.drop) {
      const t = get(s); if (!t) return true;
      if (s.output) { const r = t; if (s.onTake) s.onTake(r); else set(s, null); ItemUse.drop(p, r); Screens.render(); return true; }
      const n = e.ctrlKey ? t.count : 1; ItemUse.drop(p, Object.assign({}, t, { count: n }));
      set(s, t.count - n > 0 ? Object.assign({}, t, { count: t.count - n }) : null); Screens.render(); return true;
    }
    return false;
  }
  function setHover(s) { hover = s; if (s && get(s) && !cursor) showTip(get(s)); else hideTip(); if (drag && s && canDragInto(s)) { drag.slots.add(s); Screens.render(); } }
  function showTip(st) { tip.innerHTML = tooltipHTML(st); tip.classList.remove('hidden'); place(); }
  function showTipHTML(h) { tip.innerHTML = h; tip.classList.remove('hidden'); place(); }
  function hideTip() { tip.classList.add('hidden'); }
  // closing a screen: whatever is on the cursor goes back to the inventory (or is dropped)
  function closeCursor() { if (cursor) { const left = Game.player.inv.add(cursor, 0, 36); if (left) ItemUse.drop(Game.player, left); setCursor(null); } drag = null; hideTip(); }
  function dropCursor(button) { if (!cursor) return; const p = Game.player; if (button === 2) { ItemUse.drop(p, Object.assign({}, cursor, { count: 1 })); setCursor(cursor.count > 1 ? Object.assign({}, cursor, { count: cursor.count - 1 }) : null); } else { ItemUse.drop(p, cursor); setCursor(null); } }
  return { mouseDown, mouseUp, click, moveInto, key, setHover, closeCursor, dropCursor, get, set, accepts, renderCursor, takeOutput, showTip, showTipHTML, hideTip,
    get cursor() { return cursor; }, set cursor(v) { setCursor(v); }, get hover() { return hover; }, get drag() { return drag; } };
})();

// ---------------------------------------------------------------- item display helpers
const RARITY = ['#ffffff', '#ffff55', '#55ffff', '#ff55ff'];
function iconHTML(s, opts) {
  if (!s) return '';
  const it = ITEMS[s.id], S = GUI.S, size = 16 * S;
  const custom = s.tag && s.tag.patterns && typeof Banners !== 'undefined' && it.name.endsWith('_banner') ? `background-image:url(${Banners.iconURL(s)});background-size:100% 100%;background-position:0 0;-webkit-mask:none;mask:none;` : '';
  let h = `<div class="icon${enchOf(s) || it.name === 'enchanted_golden_apple' || it.name === 'enchanted_book' || it.name === 'nether_star' || it.name === 'experience_bottle' || it.name === 'end_crystal' ? ' glint' : ''}" style="${custom || Icons.style(s.id, size)}width:${size}px;height:${size}px"></div>`;
  if (it.dur && s.dmg > 0) { const f = 1 - s.dmg / it.dur, w = Math.round(13 * f); const col = `hsl(${Math.round(f * 120)},100%,50%)`; h += `<div class="dura"><i style="width:${w * S}px;background:${col}"></i></div>`; }
  if (s.count > 1 || (s.count !== 1 && s.count !== undefined)) h += `<div class="count${s.count <= 0 ? ' red' : ''}">${s.count}</div>`;
  return h;
}
function romanNum(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n); }
function enchName(e, l) { const d = MCDATA.enchantments[e]; const name = d ? d.name : e; return name + (d && d.max === 1 ? '' : ' ' + romanNum(l)); }
function tooltipHTML(s) {
  const it = ITEMS[s.id];
  let color = RARITY[enchOf(s) && it.rarity < 2 ? Math.max(it.rarity, 2) : it.rarity] || '#fff';
  const name = s.tag && s.tag.name ? '<i>' + escapeHTML(s.tag.name) + '</i>' : escapeHTML(itemName(s));
  let h = `<div style="color:${color}">${name}</div>`;
  const ench = enchOf(s);
  if (ench) for (const e in ench) h += `<div style="color:${MCDATA.enchantments[e] && MCDATA.enchantments[e].curse ? '#ff5555' : '#aaaaaa'}">${enchName(e, ench[e])}</div>`;
  if (s.tag && s.tag.stored) for (const e in s.tag.stored) h += `<div style="color:#aaaaaa">${enchName(e, s.tag.stored[e])}</div>`;
  if (s.tag && s.tag.potion && typeof Potions !== 'undefined') h += Potions.tooltip(s);
  if (s.tag && s.tag.trim && typeof SmithingScreen !== 'undefined') h += SmithingScreen.trimTooltip(s);
  if (s.tag && s.tag.patterns && typeof Banners !== 'undefined') h += Banners.tooltip(s);
  if (it.name === 'firework_rocket' && s.tag && s.tag.flight) h += `<div style="color:#aaa">Flight Duration: ${s.tag.flight}</div>`;
  if (it.name.endsWith('shulker_box') && s.tag && s.tag.items) { const list = s.tag.items.filter(x => x).slice(0, 5); for (const x of list) h += `<div style="color:#fff">${escapeHTML(itemName(x))} x${x.count}</div>`; }
  if (it.armor && it.armor.pts) h += `<br><div style="color:#aaa">When on ${['Head', 'Body', 'Legs', 'Feet'][it.armor.slot]}:</div><div style="color:#5555ff">+${it.armor.pts} Armor</div>` + (it.armor.tough ? `<div style="color:#5555ff">+${it.armor.tough} Armor Toughness</div>` : '') + (it.armor.kb ? `<div style="color:#5555ff">+${Math.round(it.armor.kb * 10)} Knockback Resistance</div>` : '');
  if (it.tool || it.name === 'trident' || it.name === 'mace') { const dmg = it.dmg + (enchLevel(s, 'sharpness') ? 0.5 * enchLevel(s, 'sharpness') + 0.5 : 0); h += `<br><div style="color:#aaa">When in Main Hand:</div><div style="color:#00aa00">&nbsp;${+dmg.toFixed(1)} Attack Damage</div><div style="color:#00aa00">&nbsp;${it.aspd.toFixed(1)} Attack Speed</div>`; }
  if (it.dur && s.dmg > 0 && UI.advancedTooltips) h += `<div style="color:#fff">Durability: ${it.dur - s.dmg} / ${it.dur}</div>`;
  if (UI.advancedTooltips) h += `<div style="color:#555">minecraft:${it.name}</div>`;
  return h;
}
function escapeHTML(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------------------------------------------------------------- screens
const Screens = (() => {
  let current = null;
  const root = document.createElement('div'); root.id = 'screenRoot'; root.className = 'hidden'; document.body.appendChild(root);
  root.addEventListener('mousedown', e => {
    if (!current) return;
    if (e.target === root || e.target.classList.contains('dim')) { Slots.dropCursor(e.button); render(); }
  });
  addEventListener('mouseup', e => { if (current) Slots.mouseUp(e.button); });
  root.addEventListener('contextmenu', e => e.preventDefault());
  // a container window: w x h GUI pixels, with slots added by the subclass
  class Screen {
    constructor(title, w, h) {
      this.title = title; this.w = w; this.h = h; this.slots = []; this.parts = [];
      this.el = document.createElement('div'); this.el.className = 'gscreen';
    }
    slot(inv, i, x, y, o) { const s = Object.assign({ inv, i, x, y }, o || {}); this.slots.push(s); return s; }
    // the player's 27 + 9 slots with the usual layout
    playerSlots(x, y) {
      const inv = Game.player.inv; this.mainSlots = []; this.hotSlots = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) this.mainSlots.push(this.slot(inv, 9 + r * 9 + c, x + c * 18, y + r * 18));
      for (let c = 0; c < 9; c++) this.hotSlots.push(this.slot(inv, c, x + c * 18, y + 58));
      this.invLabel = [x, y - 11];
    }
    label(text, x, y, o) { this.parts.push({ kind: 'label', text, x, y, o: o || {} }); }
    build() {
      const S = GUI.S; const el = this.el;
      el.innerHTML = '';
      el.style.width = this.w * S + 'px'; el.style.height = this.h * S + 'px';
      if (!this.noBg) el.style.backgroundImage = `url(${GUI.windowBg(this.w, this.h)})`;
      el.style.backgroundSize = '100% 100%';
      for (const p of this.parts) {
        if (p.kind === 'label') { const d = document.createElement('div'); d.className = 'glabel'; d.textContent = p.text; d.style.left = p.x * S + 'px'; d.style.top = p.y * S + 'px'; if (p.o.center) { d.style.left = '0'; d.style.width = this.w * S + 'px'; d.style.textAlign = 'center'; } if (p.o.color) d.style.color = p.o.color; if (p.o.id) d.id = p.o.id; el.appendChild(d); }
        if (p.kind === 'el') { el.appendChild(p.node); }
      }
      if (this.invLabel) this.label2('Inventory', this.invLabel[0], this.invLabel[1]);
      for (const s of this.slots) {
        const d = document.createElement('div'); d.className = 'gslot' + (s.big ? ' big' : '') + (s.hidden ? ' hidden' : '');
        d.style.left = (s.x - 1) * S + 'px'; d.style.top = (s.y - 1) * S + 'px';
        if (s.bg) d.style.setProperty('--bgicon', `url()`);
        d.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); Slots.mouseDown(s, e.button, e); });
        d.addEventListener('mouseenter', () => Slots.setHover(s)); d.addEventListener('mouseleave', () => { if (Slots.hover === s) Slots.setHover(null); });
        d.addEventListener('dblclick', e => e.preventDefault());
        s.el = d; el.appendChild(d);
      }
      if (this.extra) this.extra(el, S);
    }
    label2(text, x, y) { const d = document.createElement('div'); d.className = 'glabel'; d.textContent = text; d.style.left = x * GUI.S + 'px'; d.style.top = y * GUI.S + 'px'; this.el.appendChild(d); }
    render() {
      const drag = Slots.drag;
      for (const s of this.slots) {
        if (!s.el) continue;
        const st = Slots.get(s);
        let html = st ? iconHTML(st) : (s.emptyIcon ? `<div class="emptyicon" style="${GUI.css(s.emptyIcon)}"></div>` : '');
        if (drag && drag.slots && drag.slots.has(s) && drag.slots.size > 1) html += '<div class="dragmark"></div>';
        if (s._html !== html) { s.el.innerHTML = html; s._html = html; }
      }
      if (this.renderExtra) this.renderExtra();
    }
    // shift-click: the default moves between the container and the player's inventory
    quickMove(s) {
      const st = Slots.get(s); if (!st) return;
      if (s.output) { Slots.takeOutput(s, true); return; }
      const inPlayer = this.mainSlots && (this.mainSlots.includes(s) || this.hotSlots.includes(s));
      let left;
      if (inPlayer) {
        const targets = this.quickTargets ? this.quickTargets(st, s) : this.slots.filter(o => !o.output && !this.mainSlots.includes(o) && !this.hotSlots.includes(o) && !o.noQuick);
        left = targets.length ? Slots.moveInto(st, targets) : st;
        if (left && left.count === st.count) left = Slots.moveInto(st, this.hotSlots.includes(s) ? this.mainSlots : this.hotSlots);
      } else left = Slots.moveInto(st, this.mainSlots.concat(this.hotSlots), true); // into the hotbar first, from its last slot, like the game
      Slots.set(s, left);
      if (s.onChange) s.onChange();
      if (this.update) this.update();
    }
    onClose() {}
  }
  function open(scr) {
    if (current) close(true);
    current = scr;
    scr.build(); root.innerHTML = '<div class="dim"></div>'; root.appendChild(scr.el); root.classList.remove('hidden');
    if (scr.update) scr.update();
    render();
    Input.releaseLock();
    UI.screen = scr;
  }
  function close(silent) {
    if (!current) return;
    const scr = current;
    Slots.closeCursor();
    scr.onClose();
    current = null; root.classList.add('hidden'); root.innerHTML = '';
    UI.screen = null;
    if (!silent) Input.requestLock();
  }
  function render() { if (current) { current.render(); Slots.renderCursor(); } HUD.refresh(); }
  function tick() { if (current && current.tick) { current.tick(); render(); } }
  function rebuild() { if (current) { current.build(); root.innerHTML = '<div class="dim"></div>'; root.appendChild(current.el); render(); } }
  return { Screen, open, close, render, tick, rebuild, get current() { return current; }, root };
})();

// ---------------------------------------------------------------- crafting grids
class CraftGrid {
  constructor(w) { this.w = w; this.inv = new Inventory(w * w); this.out = new Inventory(1); this.recipe = null; }
  update() { const r = Recipes.match(this.inv.slots, this.w); this.recipe = r; this.out.slots[0] = r ? r.result : null; }
  // taking the result uses one of each ingredient (buckets and bottles are left behind)
  consume() {
    for (let i = 0; i < this.inv.size; i++) {
      const s = this.inv.get(i); if (!s) continue;
      if (this.recipe && this.recipe.recipe && this.recipe.recipe.keep === i) continue;
      const n = ITEMS[s.id].name;
      const leftover = { milk_bucket: 'bucket', water_bucket: 'bucket', lava_bucket: 'bucket', honey_bottle: 'glass_bottle', dragon_breath: 'glass_bottle' }[n];
      s.count--;
      if (s.count <= 0) this.inv.slots[i] = leftover ? stack(leftover) : null;
      else if (leftover) { const left = Game.player.inv.add(stack(leftover)); if (left) ItemUse.drop(Game.player, left); }
    }
    this.update();
  }
  returnAll() { for (let i = 0; i < this.inv.size; i++) { const s = this.inv.get(i); if (s) { const left = Game.player.inv.add(s, 0, 36); if (left) ItemUse.drop(Game.player, left); this.inv.slots[i] = null; } } this.update(); }
}
function craftOutputSlot(scr, grid, x, y) {
  return scr.slot(grid.out, 0, x, y, { output: true, big: true, onTake: r => { grid.consume(); Stats.add('crafted', ITEMS[r.id].name); Advancements.onCraft(ITEMS[r.id].name); Sound.play('craft'); } });
}

// the survival inventory: armour, 2x2 crafting, off hand
class InventoryScreen extends Screens.Screen {
  constructor() {
    super('Inventory', 176, 166);
    const p = Game.player, inv = p.inv;
    this.grid = new CraftGrid(2);
    const icons = ['empty_helmet', 'empty_chest', 'empty_legs', 'empty_boots'];
    this.armorSlots = [];
    for (let i = 0; i < 4; i++) this.armorSlots.push(this.slot(inv, 36 + i, 8, 8 + i * 18, { max: 1, emptyIcon: icons[i], filter: s => { const it = ITEMS[s.id]; return it.armor && it.armor.slot === i; }, onChange: () => p.updateArmor(), noQuick: true }));
    this.offSlot = this.slot(inv, 40, 77, 62, { emptyIcon: 'empty_shield', noQuick: true });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) this.slot(this.grid.inv, r * 2 + c, 98 + c * 18, 18 + r * 18, { onChange: () => this.update(), noQuick: true, grid: true });
    this.outSlot = craftOutputSlot(this, this.grid, 154, 28);
    this.playerSlots(8, 84); this.invLabel = null; // the survival inventory has no "Inventory" title
    this.label('Crafting', 97, 6);
    this.parts.push({ kind: 'el', node: elAt('craftarrow', 135, 29, GUI.css('craft_arrow')) });
    this.parts.push({ kind: 'el', node: Object.assign(elAt('playerbox', 26, 8, ''), { id: 'playerBox' }) });
    this.parts.push({ kind: 'el', node: recipeBookButton(this, 104, 61) });
  }
  update() { this.grid.update(); }
  quickTargets(st, s) {
    const it = ITEMS[st.id];
    if (it.armor && !Slots.get(this.armorSlots[it.armor.slot])) return [this.armorSlots[it.armor.slot]];
    if (it.name === 'shield' && !Slots.get(this.offSlot)) return [this.offSlot];
    return [];
  }
  onClose() { this.grid.returnAll(); Game.player.updateArmor(); }
  renderExtra() { PlayerPreview.draw(document.getElementById('playerBox')); }
}
function elAt(cls, x, y, css) { const d = document.createElement('div'); d.className = 'gpart ' + cls; d.style.cssText = `left:calc(var(--s)*${x});top:calc(var(--s)*${y});` + (css || ''); return d; }

class CraftingScreen extends Screens.Screen {
  constructor() {
    super('Crafting', 176, 166);
    this.grid = new CraftGrid(3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) this.slot(this.grid.inv, r * 3 + c, 30 + c * 18, 17 + r * 18, { onChange: () => this.update(), grid: true });
    this.outSlot = craftOutputSlot(this, this.grid, 124, 35);
    this.playerSlots(8, 84);
    this.label('Crafting', 29, 6);
    this.parts.push({ kind: 'el', node: elAt('craftarrow', 90, 35, GUI.css('craft_arrow')) });
    this.parts.push({ kind: 'el', node: recipeBookButton(this, 6, 35) });
  }
  update() { this.grid.update(); }
  quickTargets(st, s) { return this.slots.filter(o => o.grid); }
  onClose() { this.grid.returnAll(); }
}

// furnace, blast furnace and smoker
class FurnaceScreen extends Screens.Screen {
  constructor(be, kind, title) {
    super(title, 176, 166);
    this.be = be; this.kind = kind;
    const it = be.items, mk = i => ({ get: () => it[i], set: v => { it[i] = v && v.count > 0 ? v : null; } });
    this.inSlot = Object.assign(this.slot(null, 0, 56, 17), mk(0));
    this.fuelSlot = Object.assign(this.slot(null, 1, 56, 53, { filter: s => ITEMS[s.id].fuel > 0 || ITEMS[s.id].name === 'bucket' }), mk(1));
    this.outSlot = Object.assign(this.slot(null, 2, 116, 35, { output: true, big: true, onTake: r => { it[2] = null; const xp = Math.floor(be.xp); be.xp -= xp; if (Math.random() < be.xp) { be.xp = 0; Drops.spawnXp(Game.player.x, Game.player.y, Game.player.z, xp + 1); } else if (xp) Drops.spawnXp(Game.player.x, Game.player.y, Game.player.z, xp); Advancements.onSmelt(ITEMS[r.id].name); } }), mk(2));
    this.playerSlots(8, 84);
    this.label(title, 0, 6, { center: true });
    this.flame = elAt('flame', 56, 36, GUI.css('flame_off')); this.flameOn = elAt('flame', 56, 36, GUI.css('flame_on'));
    this.arrow = elAt('arrow', 79, 34, GUI.css('arrow_off')); this.arrowOn = elAt('arrow', 79, 34, GUI.css('arrow_on'));
    for (const n of [this.flame, this.flameOn, this.arrow, this.arrowOn]) this.parts.push({ kind: 'el', node: n });
  }
  quickTargets(st) { if (Smelting.find(st, this.kind)) return [this.inSlot]; if (ITEMS[st.id].fuel) return [this.fuelSlot]; return []; }
  renderExtra() {
    const be = this.be, S = GUI.S;
    const f = be.burnMax ? be.burn / be.burnMax : 0, fh = Math.ceil(14 * f);
    this.flameOn.style.clipPath = `inset(${(14 - fh) * S}px 0 0 0)`;
    this.flameOn.style.display = be.burn > 0 ? '' : 'none';
    const a = be.cookMax ? be.cook / be.cookMax : 0;
    this.arrowOn.style.clipPath = `inset(0 ${(22 - Math.ceil(22 * a)) * S}px 0 0)`;
  }
  tick() {}
}

// chests, barrels, shulker boxes, ender chests, dispensers, droppers and hoppers
class ChestScreen extends Screens.Screen {
  constructor(items, rows, title, o) {
    o = o || {};
    const cols = o.cols || 9, h = o.hopper ? 133 : o.dispenser ? 166 : 114 + rows * 18;
    super(title, 176, h);
    this.items = items;
    const mk = i => ({ get: () => items.get ? items.get(i) : items[i], set: v => { if (items.set) items.set(i, v); else items[i] = v && v.count > 0 ? v : null; } });
    const x0 = o.dispenser ? 62 : o.hopper ? 44 : 8, y0 = 18;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) Object.assign(this.slot(null, 0, x0 + c * 18, y0 + r * 18, { filter: o.filter }), mk(r * cols + c));
    const py = o.hopper ? 51 : o.dispenser ? 84 : 31 + rows * 18;
    this.playerSlots(8, py);
    this.label(title, 8, 6);
    this.onCloseFn = o.onClose;
  }
  onClose() { if (this.onCloseFn) this.onCloseFn(); }
}

// the small recipe book button and panel
function recipeBookButton(scr, x, y) {
  const b = elAt('rbook', x, y, '');
  b.title = 'Recipe Book';
  b.addEventListener('mousedown', e => { e.stopPropagation(); RecipeBook.toggle(scr); });
  return b;
}
const RecipeBook = (() => {
  let open = false, panel = null, filterCraftable = false, page = 0;
  function toggle(scr) { open = !open; if (open) show(scr); else hide(); }
  function hide() { if (panel) panel.remove(); panel = null; }
  function show(scr) {
    hide();
    panel = document.createElement('div'); panel.className = 'rbookpanel';
    panel.style.backgroundImage = `url(${GUI.windowBg(147, 166)})`;
    Screens.root.appendChild(panel);
    render(scr);
  }
  function have(st) { return Game.player.inv.count(st.id); }
  function craftable(r, size) {
    if (r.s && (r.s.length > size || r.s[0].length > size)) return false;
    const need = new Map();
    for (const c of (r.s ? r.s.flat() : r.i)) if (c) need.set(c, (need.get(c) || 0) + 1);
    for (const [c, n] of need) { const opts = Recipes.tagMembers(c) || [c]; const total = opts.reduce((a, o) => a + (IID[o] !== undefined ? Game.player.inv.count(IID[o]) : 0), 0); if (total < n) return false; }
    return true;
  }
  function render(scr) {
    if (!panel) return;
    const size = scr.grid ? scr.grid.w : 3;
    const all = Recipes.list.filter(r => !(r.s && (r.s.length > size || r.s[0].length > size)) && !(r.i && r.i.length > size * size));
    // recipes you know: anything you have at least one ingredient for
    const known = all.filter(r => (r.s ? r.s.flat() : r.i).some(c => c && (Recipes.tagMembers(c) || [c]).some(o => IID[o] !== undefined && Game.player.inv.count(IID[o]) > 0)));
    const seen = new Set(), list = [];
    for (const r of known) { if (seen.has(r.r)) continue; seen.add(r.r); const ok = craftable(r, size); if (filterCraftable && !ok) continue; list.push([r, ok]); }
    list.sort((a, b) => b[1] - a[1]);
    const per = 20, pages = Math.max(1, Math.ceil(list.length / per)); if (page >= pages) page = 0;
    const S = GUI.S;
    let h = `<div class="glabel" style="left:${8 * S}px;top:${6 * S}px">Recipe Book</div><div class="rbfilter${filterCraftable ? ' on' : ''}" style="left:${100 * S}px;top:${4 * S}px">${filterCraftable ? 'Craftable' : 'All'}</div><div class="rbgrid" style="left:${11 * S}px;top:${22 * S}px">`;
    for (const [r, ok] of list.slice(page * per, page * per + per)) h += `<div class="rbitem${ok ? '' : ' no'}" data-r="${Recipes.list.indexOf(r)}">${iconHTML(stack(r.r, r.n))}</div>`;
    h += `</div><div class="glabel" style="left:${55 * S}px;top:${146 * S}px">${page + 1}/${pages}</div><div class="rbprev" style="left:${30 * S}px;top:${144 * S}px">&lt;</div><div class="rbnext" style="left:${95 * S}px;top:${144 * S}px">&gt;</div>`;
    panel.innerHTML = h;
    panel.querySelector('.rbfilter').onmousedown = e => { e.stopPropagation(); filterCraftable = !filterCraftable; render(scr); };
    panel.querySelector('.rbprev').onmousedown = e => { e.stopPropagation(); page = (page - 1 + pages) % pages; render(scr); };
    panel.querySelector('.rbnext').onmousedown = e => { e.stopPropagation(); page = (page + 1) % pages; render(scr); };
    for (const el of panel.querySelectorAll('.rbitem')) {
      const r = Recipes.list[+el.dataset.r];
      el.onmousedown = e => { e.stopPropagation(); fill(scr, r, e.shiftKey); render(scr); Screens.render(); };
      el.onmouseenter = () => Slots.showTip(stack(r.r, r.n)); el.onmouseleave = () => Slots.hideTip();
    }
  }
  // move ingredients from the inventory into the grid to match the recipe (shift: as many as possible)
  function fill(scr, r, max) {
    if (!scr.grid) return;
    const g = scr.grid, w = g.w;
    g.returnAll();
    const cells = new Array(w * w).fill(null);
    if (r.s) for (let y = 0; y < r.s.length; y++) for (let x = 0; x < r.s[y].length; x++) cells[x + y * w] = r.s[y][x];
    else r.i.forEach((c, k) => { cells[k] = c; });
    let times = 1;
    if (max) times = 64;
    for (let t = 0; t < times; t++) {
      let ok = true;
      for (let k = 0; k < cells.length; k++) {
        const want = cells[k]; if (!want) continue;
        const opts = Recipes.tagMembers(want) || [want];
        const cur = g.inv.get(k);
        if (cur && maxStack(cur) <= cur.count) { ok = false; break; }
        const pick = cur ? cur.id : opts.map(o => IID[o]).find(id => id !== undefined && Game.player.inv.count(id) > 0);
        if (pick === undefined || Game.player.inv.count(pick) === 0) { ok = false; break; }
        Game.player.inv.remove(pick, 1);
        g.inv.slots[k] = cur ? Object.assign(cur, { count: cur.count + 1 }) : stack(pick, 1);
      }
      if (!ok) break;
    }
    g.update();
  }
  return { toggle, hide, render: (scr) => { if (open && panel) render(scr); }, get open() { return open; } };
})();

// a small picture of the player in the inventory (drawn by the entity renderer when it exists)
const PlayerPreview = { draw(el) { if (el && typeof EntityRender !== 'undefined' && EntityRender && EntityRender.drawPlayerPreview) EntityRender.drawPlayerPreview(el); } };
