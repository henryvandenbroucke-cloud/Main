'use strict';
/* Potions (timed status effects) and enchanting (lapis lazuli at an enchanting table). */

// ---------------------------------------------------------------- status effects
const EFFECTS = {
  haste: { name: 'Haste', color: '#e8c838', icon: '⛏' },
  swift: { name: 'Swiftness', color: '#7ad8f0', icon: '»' },
  strength: { name: 'Strength', color: '#e04a3a', icon: '⚔' },
  night: { name: 'Night Vision', color: '#8a9aff', icon: '◉' },
  leap: { name: 'Leaping', color: '#6ae05a', icon: '⇡' },
  fireres: { name: 'Fire Resistance', color: '#ff8a2a', icon: '♨' },
  regen: { name: 'Regeneration', color: '#e85aa8', icon: '♥' },
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const Effects = {
  active: {}, renderT: 0, regenT: 0,
  add(k, dur, lvl) { const e = this.active[k]; this.active[k] = { t: Math.max(dur, e ? e.t : 0), lvl: Math.max(lvl, e ? e.lvl : 0) }; this.render(); },
  lvl(k) { const e = this.active[k]; return e && e.t > 0 ? e.lvl : 0; },
  clear() { this.active = {}; this.render(); },
  load(a) { this.active = a || {}; this.render(); },
  tick(dt) {
    let changed = false;
    for (const k in this.active) { const e = this.active[k]; e.t -= dt; if (e.t <= 0) { delete this.active[k]; changed = true; } }
    if (this.lvl('regen') && Player.hp < maxHealth()) { this.regenT -= dt; if (this.regenT <= 0) { this.regenT = 1.25; Player.hp = Math.min(maxHealth(), Player.hp + 1); lastHudKey = ''; } }
    if (this.lvl('fireres')) Player.burn = 0;
    // a faint swirl of the potion colour around you
    const keys = Object.keys(this.active);
    if (keys.length && Math.random() < dt * 6) { const c = new THREE.Color(EFFECTS[keys[Math.floor(Math.random() * keys.length)]].color), a = Math.random() * 6.28; emit(Player.x + Math.cos(a) * 0.7, Player.y + 0.1 + Math.random() * 0.9, Player.z + Math.sin(a) * 0.7, { vy: 0.5, life: 0.9, size: 0.06, r: c.r, g: c.g, b: c.b, glow: true }); }
    this.renderT -= dt; if (changed || this.renderT <= 0) { this.renderT = 1; this.render(); }
  },
  render() {
    const el = $('effects'); if (!el) return;
    el.innerHTML = Object.entries(this.active).map(([k, e]) => { const d = EFFECTS[k], m = Math.floor(e.t / 60), s = Math.floor(e.t % 60); return '<div class="eff" style="border-color:' + d.color + '"><b style="color:' + d.color + '">' + d.icon + '</b>' + d.name + (e.lvl > 1 ? ' ' + ROMAN[e.lvl] : '') + '<i>' + m + ':' + String(s).padStart(2, '0') + '</i></div>'; }).join('');
  },
};
function drinkPotion(s, d) {
  Effects.add(d.effect, d.dur, d.lvl);
  Sound.drink(); Quests.event('drink');
  const c = new THREE.Color(d.c[0]);
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; emit(Player.x + Math.cos(a) * 0.8, Player.y + 0.2, Player.z + Math.sin(a) * 0.8, { vy: 0.8 + Math.random(), vx: Math.cos(a) * 0.4, vz: Math.sin(a) * 0.4, life: 1, size: 0.07, r: c.r, g: c.g, b: c.b, glow: true }); }
  toast(d.name, 1800);
  if (Game.mode !== 'creative') { s.n--; if (!s.n) Inv.slots[Game.sel] = null; }
  lastHudKey = '';
}

// ---------------------------------------------------------------- enchantments
const ENCHANTS = {
  efficiency: { name: 'Efficiency', max: 5, for: ['tool'], desc: 'mines faster' },
  fortune: { name: 'Fortune', max: 3, for: ['pick'], desc: 'more drops from ores' },
  sharpness: { name: 'Sharpness', max: 5, for: ['weapon', 'axe'], desc: 'more melee damage' },
  fire: { name: 'Fire Aspect', max: 2, for: ['weapon'], desc: 'sets targets on fire' },
  knockback: { name: 'Knockback', max: 2, for: ['weapon'], desc: 'knocks enemies further' },
  looting: { name: 'Looting', max: 3, for: ['weapon'], desc: 'creatures drop more' },
  power: { name: 'Power', max: 5, for: ['bow'], desc: 'arrows hit harder' },
  flame: { name: 'Flame', max: 1, for: ['bow'], desc: 'burning arrows' },
  infinity: { name: 'Infinity', max: 1, for: ['bow'], desc: 'arrows are not used up' },
  protection: { name: 'Protection', max: 4, for: ['armor'], desc: 'less damage taken' },
  feather: { name: 'Feather Falling', max: 4, for: ['boots'], desc: 'less fall damage' },
};
function enchTags(id) {
  if (id < 256) return [];
  const d = ITEMS[id];
  if (d.kind === 'tool') return ['tool', d.toolType];
  if (d.kind === 'weapon') return ['weapon'];
  if (d.kind === 'bow') return ['bow'];
  if (d.kind === 'armor') return d.slot === 3 ? ['armor', 'boots'] : ['armor'];
  return [];
}
const canEnchant = s => !!s && !s.ench && enchTags(s.id).length > 0;
function enchOf(s, k) { return s && s.ench ? s.ench[k] || 0 : 0; }
function heldEnch(k) { return enchOf(heldItem(), k); }
function armorEnch(k) { return Inv.armor.reduce((a, s) => a + enchOf(s, k), 0); }
function enchText(e) { return Object.entries(e).map(([k, l]) => ENCHANTS[k].name + (ENCHANTS[k].max > 1 ? ' ' + ROMAN[l] : '')).join(', '); }
function enchOffers(s, shelves) {
  const tags = enchTags(s.id), pool = Object.keys(ENCHANTS).filter(k => ENCHANTS[k].for.some(t => tags.includes(t)));
  let seed = (Player.enchSeed || 7) * 7919 + s.id * 31;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const power = 0.45 + Math.min(15, shelves) / 15 * 0.55;
  return [1, 2, 3].map(cost => {
    const e = {}, k = pool[Math.floor(rnd() * pool.length)], E = ENCHANTS[k];
    e[k] = Math.max(1, Math.min(E.max, Math.round(E.max * cost / 3 * power + (rnd() - 0.5))));
    if (cost === 3 && pool.length > 1 && rnd() < 0.35 + power * 0.3) { const k2 = pool.filter(x => x !== k)[Math.floor(rnd() * (pool.length - 1))]; e[k2] = Math.max(1, Math.round(ENCHANTS[k2].max * power * 0.6)); }
    return { cost, ench: e };
  });
}
// ---------------------------------------------------------------- enchanting table screen
const EnchSlots = [null, null]; // item, lapis
let enchAt = null;
function bookshelvesAround(x, y, z) { let n = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue; for (let dy = 0; dy <= 1; dy++) if (getB(x + dx, y + dy, z + dz) === B.BOOKSHELF) n++; } return n; }
function openEnchant(h) {
  Game.ui = 'ench'; enchAt = [h.x, h.y, h.z];
  $('enchant').classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock();
  renderEnchant();
}
function closeEnchant() {
  for (let i = 0; i < 2; i++) if (EnchSlots[i]) { const left = giveStack(EnchSlots[i]); if (left) dropItem(EnchSlots[i].id, left, Player.x, Player.y + 1.4, Player.z, EnchSlots[i].ench); EnchSlots[i] = null; }
  if (cursor) { const left = giveStack(cursor); if (left) dropItem(cursor.id, left, Player.x, Player.y + 1.4, Player.z, cursor.ench); cursor = null; }
  $('cursorItem').innerHTML = ''; $('tooltip').classList.add('hidden');
  $('enchant').classList.add('hidden'); Game.ui = null; lockPointer();
}
function renderEnchant() {
  const fill = (el, arr, from, to, kind, phs) => { el.innerHTML = ''; for (let i = from; i < to; i++) el.appendChild(slotEl(arr, i, kind, phs && phs[i - from])); };
  fill($('enchSlots'), EnchSlots, 0, 2, 'ench', ['Tool', 'Lapis']);
  fill($('enchMain'), Inv.slots, 9, 36, 'main'); fill($('enchHot'), Inv.slots, 0, 9, 'main');
  const shelves = enchAt ? bookshelvesAround(enchAt[0], enchAt[1], enchAt[2]) : 0;
  $('enchShelves').textContent = 'Bookshelves nearby: ' + shelves + ' / 15' + (shelves < 15 ? ' · place bookshelves 2 blocks around the table for stronger enchantments' : ' · maximum power');
  const s = EnchSlots[0], lap = EnchSlots[1] ? EnchSlots[1].n : 0, box = $('enchOffers'); box.innerHTML = '';
  if (!s) box.innerHTML = '<div class="enote">Put a tool, weapon, bow or piece of armor in the left slot and lapis lazuli in the right slot.</div>';
  else if (s.ench) box.innerHTML = '<div class="enote">This item is already enchanted.</div>';
  else if (!canEnchant(s)) box.innerHTML = '<div class="enote">This item cannot be enchanted.</div>';
  else for (const o of enchOffers(s, shelves)) {
    const ok = lap >= o.cost || Game.mode === 'creative';
    const d = document.createElement('div'); d.className = 'offer' + (ok ? '' : ' off');
    d.innerHTML = '<span class="cost">' + '◆'.repeat(o.cost) + '</span><span class="en">' + enchText(o.ench) + '</span><span class="ed">' + Object.keys(o.ench).map(k => ENCHANTS[k].desc).join(' · ') + '</span>';
    d.onclick = () => { if (!ok) { Sound.ui(); return; } applyEnchant(o); };
    box.appendChild(d);
  }
  $('cursorItem').innerHTML = cursor ? slotHTML(cursor) : '';
}
function applyEnchant(o) {
  const s = EnchSlots[0];
  if (Game.mode !== 'creative') { EnchSlots[1].n -= o.cost; if (!EnchSlots[1].n) EnchSlots[1] = null; }
  s.ench = Object.assign({}, o.ench);
  Player.enchSeed = Math.floor(Math.random() * 1e6) + 1;
  Sound.enchant(); Quests.event('enchant');
  for (let i = 0; i < 40; i++) emit(enchAt[0] + 0.5 + (Math.random() - 0.5) * 3, enchAt[1] + 1 + Math.random() * 2, enchAt[2] + 0.5 + (Math.random() - 0.5) * 3, { vx: (Math.random() - 0.5), vy: -0.6, life: 1.2, size: 0.08, r: 0.7, g: 0.5, b: 1, glow: true });
  notify('Enchanted', enchText(s.ench), iconURL(s.id));
  renderEnchant(); lastHudKey = '';
}
