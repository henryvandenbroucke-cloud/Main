'use strict';
/* HUD, menus, inventory, wayfinder, lore modal, cinematics. */
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- small pixel icons for hearts / food
function pixelIcon(rows, pal) {
  const c = document.createElement('canvas'); c.width = c.height = 9;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c.toDataURL();
}
const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....', '.........'];
const ICONS = {
  heart: pixelIcon(HEART, { k: '#1a0a0a', r: '#e02a2a', w: '#ffb0b0' }),
  half: pixelIcon(HEART.map(r => r.slice(0, 5).replace(/r|w/g, m => m) + r.slice(5).replace(/[rw]/g, 'e')), { k: '#1a0a0a', r: '#e02a2a', w: '#ffb0b0', e: '#3a1414' }),
  empty: pixelIcon(HEART, { k: '#1a0a0a', r: '#3a1414', w: '#3a1414' }),
  gold: pixelIcon(HEART, { k: '#1a1a0a', r: '#6ef0ff', w: '#e8ffff' }),
  food: pixelIcon(['.....kk..', '....kmmk.', '...kmmmk.', '..kmmmmk.', '.kmmmmk..', 'kbkmmk...', 'bwbkk....', 'kbk......', '.........'], { k: '#1a0e06', m: '#c8783a', b: '#e8e0d0', w: '#ffffff' }),
  foodhalf: pixelIcon(['.....kk..', '....kmmk.', '...kmmmk.', '..keeeek.', '.keeeek..', 'kbkeek...', 'bwbkk....', 'kbk......', '.........'], { k: '#1a0e06', m: '#c8783a', b: '#e8e0d0', w: '#ffffff', e: '#3a2a1a' }),
  foodempty: pixelIcon(['.....kk..', '....keek.', '...keeek.', '..keeeek.', '.keeeek..', 'kekeek...', 'eeekk....', 'kek......', '.........'], { k: '#1a0e06', e: '#3a2a1a' }),
};

// armour slot outlines (16x16), drawn faint in empty slots like the classic inventory
function silhouette(rows) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#373737'; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x, y, 1, 1); })); return c.toDataURL(); }
const ARMOR_PH = [
  ['................', '................', '................', '....########....', '...#########....', '..##########....', '..###....###....', '..##......##....', '..##......##....', '................'].map(r => r + ''),
  ['................', '..###....###....', '.####....####...', '.############...', '.############...', '..##########....', '...########.....', '...########.....', '...########.....', '...########.....', '...########.....', '...########.....', '................'],
  ['................', '................', '...#########....', '...#########....', '...###...###....', '...###...###....', '...###...###....', '...###...###....', '...###...###....', '...###...###....', '...###...###....', '................'],
  ['................', '................', '................', '................', '................', '...###....###...', '...###....###...', '...###....###...', '..####....####..', '.#####....#####.', '.#####....#####.', '................'],
].map(r => '<img src="' + silhouette(r) + '">');
const RELIC_PH = '<img src="' + silhouette(['................', '................', '.......##.......', '......####......', '.....##..##.....', '....##....##....', '....##....##....', '.....##..##.....', '......####......', '.......##.......', '.......##.......', '......####......', '.....######.....', '................']) + '">';
// dark dirt behind the loading screen, from the world's own dirt texture
(function dirtBackground() { try { const [sx, sy] = [(Atlas.tiles.dirt % 16) * 16, Math.floor(Atlas.tiles.dirt / 16) * 16], c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.drawImage(Atlas.canvas, sx, sy, 16, 16, 0, 0, 16, 16); g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, 0, 16, 16); document.documentElement.style.setProperty('--dirt-bg', 'url(' + c.toDataURL() + ')'); } catch (e) { } })();

// ---------------------------------------------------------------- HUD
const hud = { hearts: $('hearts'), food: $('food'), hotbar: $('hotbar'), charge: $('charge'), toast: $('toast'), held: $('heldname') };
let lastHudKey = '';
function drawHUD(P) {
  const maxHp = maxHealth(), hp = Math.max(0, Math.ceil(P.hp)), food = Math.ceil(P.food);
  const key = hp + '|' + maxHp + '|' + food + '|' + Game.sel + '|' + invKey() + '|' + Settings.hunger;
  if (key === lastHudKey) return;
  lastHudKey = key;
  let h = '';
  for (let i = 0; i < maxHp / 2; i++) { const v = hp - i * 2, gold = i >= 10; h += '<img src="' + (v >= 2 ? (gold ? ICONS.gold : ICONS.heart) : v === 1 ? ICONS.half : ICONS.empty) + '">'; }
  hud.hearts.innerHTML = h;
  let f = '';
  if (Settings.hunger) for (let i = 9; i >= 0; i--) { const v = food - i * 2; f += '<img src="' + (v >= 2 ? ICONS.food : v === 1 ? ICONS.foodhalf : ICONS.foodempty) + '">'; }
  hud.food.innerHTML = f;
  let hb = '';
  for (let i = 0; i < 9; i++) hb += '<div class="slot' + (i === Game.sel ? ' sel' : '') + '">' + slotHTML(Inv.slots[i]) + '</div>';
  hud.hotbar.innerHTML = hb;
}
function invKey() { return Inv.slots.slice(0, 9).map(s => s ? s.id + ':' + s.n : '-').join(','); }
function slotHTML(s) { if (!s) return ''; return '<img src="' + iconURL(s.id) + '">' + (s.ench ? '<i class="glint"></i>' : '') + (s.n > 1 ? '<b>' + s.n + '</b>' : ''); }
let toastT = 0;
function toast(msg, ms) { hud.toast.textContent = msg; hud.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => hud.toast.classList.remove('show'), ms || 3000); }
const toastSeen = {};
function toastOnce(k, msg) { const now = performance.now(); if (toastSeen[k] && now - toastSeen[k] < 6000) return; toastSeen[k] = now; toast(msg, 3500); }
let heldT = 0;
function showHeldName() { return; } // minimal HUD
function showHeldNameOld() {
  const s = Inv.slots[Game.sel]; hud.held.textContent = s ? itemDef(s.id).name : '';
  hud.held.style.color = s ? RARITY[itemDef(s.id).rarity] : '#fff';
  hud.held.classList.add('show'); clearTimeout(heldT); heldT = setTimeout(() => hud.held.classList.remove('show'), 1500);
}
let zoneT = 0;
function zoneBanner(name, lore) { const z = $('zone'); z.querySelector('.zn').textContent = name; z.querySelector('.zl').textContent = lore; z.classList.add('show'); clearTimeout(zoneT); zoneT = setTimeout(() => z.classList.remove('show'), 4200); }
let banT = 0;
function bossBanner(t, s) { const b = $('banner'); b.classList.remove('questb', 'discb'); b.querySelector('.bt').textContent = t; b.querySelector('.bs').textContent = s || ''; b.classList.add('show'); clearTimeout(banT); banT = setTimeout(() => b.classList.remove('show'), 3800); }
function drawBossBar() {
  const bb = $('bossbar');
  if (!ActiveBoss) { bb.classList.add('hidden'); return; }
  bb.classList.remove('hidden'); bb.classList.toggle('shielded', !!ActiveBoss.shield);
  bb.querySelector('.bn').textContent = ActiveBoss.def.name + (ActiveBoss.shield ? '  (shielded)' : '');
  bb.querySelector('i').style.width = Math.max(0, ActiveBoss.hp / ActiveBoss.maxHp * 100) + '%';
}
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function dirName(dx, dz) { const a = Math.atan2(dx, -dz); return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
const ARR = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
function drawTracker(P) {
  const t = $('tracker'), s = Game.follow;
  if (!s) { t.classList.add('hidden'); return; }
  t.classList.remove('hidden');
  const dx = s.x - P.x, dz = s.z - P.z, d = Math.round(Math.hypot(dx, dz));
  const rel = Math.atan2(-dx, -dz) - P.yaw;
  const k = ((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8;
  t.textContent = ARR[k] + '  ' + s.name + ' — ' + d + ' blocks';
}

// ---------------------------------------------------------------- inventory screen
let cursor = null; // {id,n}
const CraftGrid = new Array(9).fill(null);
let craftSize = 2;
let containerKey = null;
// containers: chests hold loot (27 slots), barrels are bigger storage (36) with sorting tools, crates are small (18)
function containerKind(key) { const [x, y, z] = key.split(',').map(Number), id = getB(x, y, z); return id === B.BARREL ? 'barrel' : id === B.CRATE ? 'crate' : 'chest'; }
const CONTAINER_SIZE = { chest: 27, barrel: 36, crate: 18 };
function openInventory(chestKey) {
  Game.ui = 'inv'; containerKey = chestKey || null;
  craftSize = nearTable() ? 3 : 2;
  $('inv').classList.remove('hidden');
  $('containerWrap').classList.toggle('hidden', !chestKey);
  $('inv').classList.toggle('boxmode', !!chestKey);
  $('inv').dataset.kind = chestKey ? containerKind(chestKey) : '';
  if (chestKey) {
    const c = Chests.get(chestKey), kind = containerKind(chestKey), size = CONTAINER_SIZE[kind];
    if (c.items.length < size) { for (let i = c.items.length; i < size; i++) c.items.push(null); }
    $('containerTitle').innerHTML = '<img src="' + iconURL(B[kind.toUpperCase()]) + '"> ' + (kind === 'barrel' ? 'Barrel' : kind === 'crate' ? 'Supply Crate' : CHEST_NAMES[c.table] || 'Chest') + '<span>' + (kind === 'barrel' ? 'Storage barrel · 36 slots' : kind === 'crate' ? 'Small crate · 18 slots' : c.made ? 'Your chest · 27 slots' : 'Loot chest · 27 slots') + '</span>';
    $('containerBtns').innerHTML = (kind === 'barrel' ? '<div class="btn sm" data-c="sort">Sort</div><div class="btn sm" data-c="store">Store matching</div>' : '') + '<div class="btn sm" data-c="all">Take all</div>' + (kind !== 'chest' ? '<div class="btn sm" data-c="put">Store all</div>' : '');
    $('containerBtns').querySelectorAll('[data-c]').forEach(b => b.onclick = () => containerAction(b.dataset.c));
  }
  document.exitPointerLock && document.exitPointerLock();
  renderInventory();
}
function closeInventory() {
  if (cursor) { const left = giveStack(cursor); if (left) dropItem(cursor.id, left, Player.x, Player.y + 1.4, Player.z); cursor = null; }
  returnCraftGrid();
  $('cursorItem').innerHTML = '';
  $('inv').classList.add('hidden'); $('tooltip').classList.add('hidden');
  Game.ui = null; containerKey = null;
  lockPointer();
}
function slotEl(arr, i, kind, ph) {
  const d = document.createElement('div'); d.className = 'slot';
  d.innerHTML = arr[i] ? slotHTML(arr[i]) : (ph ? '<span class="ph">' + ph + '</span>' : '');
  d.onmousedown = e => { e.preventDefault(); if (!startDrag(arr, i, kind, e, d)) clickSlot(arr, i, kind, e); };
  d.onmouseenter = e => { dragEnter(arr, i, kind, d); showTip(arr[i], e); }; d.onmousemove = e => moveTip(e); d.onmouseleave = () => $('tooltip').classList.add('hidden');
  d.oncontextmenu = e => e.preventDefault();
  return d;
}
function renderInventory() {
  if (Game.ui === 'ench') return renderEnchant();
  const fillSlots = (el, arr, from, to, kind, phs) => { el.innerHTML = ''; for (let i = from; i < to; i++) el.appendChild(slotEl(arr, i, kind, phs && phs[i - from])); };
  fillSlots($('mainSlots'), Inv.slots, 9, 36, 'main');
  fillSlots($('hotSlots'), Inv.slots, 0, 9, 'main');
  fillSlots($('armorSlots'), Inv.armor, 0, 4, 'armor', ARMOR_PH);
  fillSlots($('relicSlots'), Inv.relics, 0, 2, 'relic', [RELIC_PH, RELIC_PH]);
  if (containerKey) { const c = Chests.get(containerKey); fillSlots($('containerSlots'), c.items, 0, c.items.length, 'chest'); }
  // crafting grid
  const cg = $('craftGrid'); cg.innerHTML = ''; cg.style.width = (craftSize * 40) + 'px';
  for (let i = 0; i < craftSize * craftSize; i++) cg.appendChild(slotEl(CraftGrid, i, 'craft'));
  $('craftSizeNote').textContent = '';
  const match = matchRecipe(CraftGrid, craftSize), out = $('craftOut');
  out.innerHTML = '';
  const os = document.createElement('div'); os.className = 'slot' + (match ? ' ready' : '');
  if (match) os.innerHTML = slotHTML({ id: match.out[0], n: match.out[1] });
  os.onmousedown = e => { e.preventDefault(); takeCraftOutput(e.shiftKey); };
  os.onmouseenter = e => match && showTip({ id: match.out[0], n: match.out[1] }, e); os.onmousemove = moveTip; os.onmouseleave = () => $('tooltip').classList.add('hidden');
  out.appendChild(os);
  const a = armorPoints(), red = Math.round(armorReduction() * 100);
  const set = fullSet();
  $('stats').innerHTML = 'Health <b>' + Math.ceil(Player.hp) + '/' + maxHealth() + '</b><br>Armor <b>' + a + '</b> (−' + red + '% dmg)<br>Melee <b>' + (hasRelic('melee') ? '+25%' : '+0%') + '</b>' + (set === 'prism' ? ' <b>+15%</b>' : '') + '<br>' + (set ? '<span style="color:#c77dff">' + SET_BONUS[set] + '</span><br>' : '') + 'Gold <b>' + countItem(I.gold) + '</b><br>Days survived <b>' + Math.floor(Game.day) + '</b>';
  const near = nearTable();
  $('tableNote').textContent = near ? '' : '· table recipes need a Crafting Table';
  const box = $('recipes'); box.innerHTML = '';
  const sorted = RECIPES.map(r => ({ r, ok: canCraft(r, near) })).sort((a, b) => (b.ok - a.ok));
  for (const { r, ok } of sorted) {
    const d = document.createElement('div'); d.className = 'recipe ' + (ok ? 'can' : 'cant');
    const def = itemDef(r.out[0]);
    let pat = '';
    if (r.pat) { pat = '<span class="pat" style="grid-template-columns:repeat(' + r.w + ',12px)">'; for (const row of r.pat) for (const ch of row) pat += (ch === ' ' || ch === '.') ? '<i></i>' : '<img src="' + iconURL(r.key[ch]) + '">'; pat += '</span>'; }
    else pat = '<span class="need">' + r.need.map(([id, n]) => '<img src="' + iconURL(id) + '"><span>' + n + '</span>').join('') + '</span>';
    d.innerHTML = '<img src="' + iconURL(r.out[0]) + '"><span style="color:' + RARITY[def.rarity] + '">' + def.name + (r.out[1] > 1 ? ' ×' + r.out[1] : '') + (r.exact ? ' <span class="from">from ' + itemDef(r.need[0][0]).name + '</span>' : '') + (r.table ? ' <span title="needs crafting table" style="opacity:.6">⚒</span>' : '') + '</span>' + pat;
    d.onmousedown = e => { e.preventDefault(); if (canCraft(r, near)) { fillGridFor(r); renderInventory(); } };
    d.onmouseenter = e => showTip({ id: r.out[0], n: r.out[1] }, e); d.onmousemove = moveTip; d.onmouseleave = () => $('tooltip').classList.add('hidden');
    box.appendChild(d);
  }
  const ci = $('cursorItem'); ci.innerHTML = cursor ? slotHTML(cursor) : '';
}
document.addEventListener('mousemove', e => { const ci = $('cursorItem'); ci.style.left = (e.clientX - 16) + 'px'; ci.style.top = (e.clientY - 16) + 'px'; });
function containerAction(a) {
  const it = Chests.get(containerKey).items;
  if (a === 'all') for (let i = 0; i < it.length; i++) { if (!it[i]) continue; const left = giveStack(it[i]); it[i] = left ? (left === it[i].n ? it[i] : { id: it[i].id, n: left }) : null; }
  if (a === 'put' || a === 'store') {
    const have = new Set(it.filter(Boolean).map(s => s.id));
    for (let i = 9; i < 36; i++) { const s = Inv.slots[i]; if (!s || (a === 'store' && !have.has(s.id))) continue; const left = putStack(it, s, 0, it.length); Inv.slots[i] = left ? (left === s.n ? s : { id: s.id, n: left }) : null; }
  }
  if (a === 'sort') {
    const all = it.filter(Boolean); it.fill(null); const plain = all.filter(s => !s.ench), special = all.filter(s => s.ench);
    plain.sort((x, y) => x.id - y.id); const merged = []; for (const s of plain) { const left = addTo(merged, s.id, s.n, 0, it.length); if (left) merged.push({ id: s.id, n: left }); }
    merged.concat(special).forEach((s, i) => { if (i < it.length) it[i] = s; });
  }
  Sound.ui(); lastHudKey = ''; renderInventory();
}
function returnCraftGrid() {
  for (let i = 0; i < 9; i++) { const s = CraftGrid[i]; if (s) { const left = giveStack(s); if (left) dropItem(s.id, left, Player.x, Player.y + 1.4, Player.z); CraftGrid[i] = null; } }
}
function fillGridFor(r) {
  returnCraftGrid();
  if (r.table && craftSize < 3) return;
  if (r.pat) { for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const ch = r.pat[y][x]; if (ch === ' ' || ch === '.') continue; const got = takeWood(r.key[ch], r.exact); if (got) CraftGrid[x + y * craftSize] = { id: got, n: 1 }; } }
  else r.list.forEach((id, i) => { const got = takeWood(id, r.exact); if (got) CraftGrid[i] = { id: got, n: 1 }; });
  lastHudKey = '';
}
function craftOnce() {
  const r = matchRecipe(CraftGrid, craftSize); if (!r) return null;
  for (let i = 0; i < craftSize * craftSize; i++) { const s = CraftGrid[i]; if (s) { s.n--; if (!s.n) CraftGrid[i] = null; } }
  Stats.crafted = (Stats.crafted || 0) + 1;
  Quests.event('craft', r.out[0]); Sound.place(B.PLANKS);
  return { id: r.out[0], n: r.out[1] };
}
function takeCraftOutput(all) {
  const r = matchRecipe(CraftGrid, craftSize); if (!r) return;
  if (all) { let guard = 64; while (guard-- > 0 && matchRecipe(CraftGrid, craftSize) === r) { const o = craftOnce(); const left = giveItem(o.id, o.n); if (left) { dropItem(o.id, left, Player.x, Player.y + 1.4, Player.z); break; } } }
  else {
    const max = itemDef(r.out[0]).stack;
    if (cursor && (cursor.id !== r.out[0] || cursor.n + r.out[1] > max)) return;
    const o = craftOnce(); if (cursor) cursor.n += o.n; else cursor = o;
  }
  burst(Player.x - Math.sin(Player.yaw) * 1.5, Player.y + 1.0, Player.z - Math.cos(Player.yaw) * 1.5, 6, { life: 0.4, size: 0.05, r: 1, g: 0.9, b: 0.5, glow: true, spread: 1, up: 1 });
  renderInventory(); lastHudKey = '';
}
function accepts(kind, i, id) {
  if (kind === 'armor') { const d = itemDef(id); return d.kind === 'armor' && d.slot === i; }
  if (kind === 'relic') return itemDef(id).kind === 'relic';
  if (kind === 'ench') return i === 1 ? id === I.lapis : enchTags(id).length > 0;
  return true;
}
// ---- drag to distribute (like the real game): with a stack on the cursor, hold the left button and
// sweep over slots to split it evenly; hold the right button to drop one item in each slot you pass
let drag = null;
const canTake = (arr, i, kind, id) => accepts(kind, i, id) && (!arr[i] || (arr[i].id === id && !arr[i].ench && arr[i].n < itemDef(id).stack));
function startDrag(arr, i, kind, e, el) {
  if (!cursor || e.shiftKey || kind === 'armor' || kind === 'relic') return false;
  if (e.button === 2) { drag = { right: true }; return false; } // the first slot is handled by the normal click
  if (e.button !== 0 || !canTake(arr, i, kind, cursor.id)) return false;
  drag = { right: false, slots: [{ arr, i, kind, el }], id: cursor.id };
  el.classList.add('dragsel');
  return true;
}
function dragEnter(arr, i, kind, el) {
  if (!drag || !cursor) return;
  if (drag.right) { if (canTake(arr, i, kind, cursor.id)) { if (arr[i]) arr[i].n++; else arr[i] = { id: cursor.id, n: 1 }; cursor.n--; if (!cursor.n) { cursor = null; drag = null; } lastHudKey = ''; renderAny(); } return; }
  if (cursor.id !== drag.id || drag.slots.some(sl => sl.arr === arr && sl.i === i) || drag.slots.length >= cursor.n || !canTake(arr, i, kind, cursor.id)) return;
  drag.slots.push({ arr, i, kind, el }); el.classList.add('dragsel');
}
function renderAny() { if (Game.ui === 'creative') renderCreative(); else renderInventory(); }
document.addEventListener('mouseup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.right || !cursor) return;
  if (d.slots.length === 1) { const sl = d.slots[0]; clickSlot(sl.arr, sl.i, sl.kind, { button: 0, shiftKey: false }); return; }
  const each = Math.floor(cursor.n / d.slots.length), max = itemDef(cursor.id).stack;
  for (const sl of d.slots) { const cur = sl.arr[sl.i]; const room = max - (cur ? cur.n : 0), k = Math.min(each, room); if (k <= 0) continue; if (cur) cur.n += k; else sl.arr[sl.i] = { id: cursor.id, n: k }; cursor.n -= k; }
  if (cursor.n <= 0) cursor = null;
  lastHudKey = ''; renderAny();
});
function clickSlot(arr, i, kind, e) {
  const s = arr[i];
  if (e.shiftKey && s) { // quick move
    arr[i] = null;
    let left = s.n;
    if (kind === 'chest' || kind === 'craft') left = giveStack(s);
    else if (containerKey) { const it = Chests.get(containerKey).items; left = putStack(it, s, 0, it.length); }
    else if (Game.ui === 'ench' && kind === 'main') { const j = s.id === I.lapis ? 1 : enchTags(s.id).length ? 0 : -1; if (j < 0) left = s.n; else if (!EnchSlots[j]) { EnchSlots[j] = s; left = 0; } else if (j === 1) left = addTo(EnchSlots, s.id, s.n, 1, 2); else left = s.n; }
    else if (kind === 'ench') left = giveStack(s);
    else if (kind === 'main') { const d = itemDef(s.id); if (d.kind === 'armor' && !Inv.armor[d.slot]) { Inv.armor[d.slot] = s; left = 0; } else if (d.kind === 'relic' && Inv.relics.indexOf(null) >= 0) { Inv.relics[Inv.relics.indexOf(null)] = s; left = 0; } else left = i < 9 ? addTo(Inv.slots, s.id, s.n, 9, 36) : addTo(Inv.slots, s.id, s.n, 0, 9); }
    else left = giveItem(s.id, s.n);
    if (left) arr[i] = left === s.n ? s : { id: s.id, n: left };
    renderInventory(); lastHudKey = ''; return;
  }
  const right = e.button === 2;
  if (!cursor) {
    if (!s) return;
    if (right && s.n > 1) { const h = Math.ceil(s.n / 2); cursor = { id: s.id, n: h }; s.n -= h; }
    else { cursor = s; arr[i] = null; }
  } else {
    if (!accepts(kind, i, cursor.id)) return;
    const max = itemDef(cursor.id).stack;
    if (!s) { if (right) { arr[i] = { id: cursor.id, n: 1 }; cursor.n--; if (!cursor.n) cursor = null; } else { arr[i] = cursor; cursor = null; } }
    else if (s.id === cursor.id && s.n < max) { const mv = right ? 1 : Math.min(cursor.n, max - s.n); s.n += mv; cursor.n -= mv; if (!cursor.n) cursor = null; }
    else { arr[i] = cursor; cursor = s; }
  }
  if (kind === 'armor' || kind === 'relic') clampHealth();
  renderInventory(); lastHudKey = '';
}
function showTip(s, e) {
  const t = $('tooltip');
  if (!s) { t.classList.add('hidden'); return; }
  const d = itemDef(s.id);
  let h = '<div class="tn" style="color:' + RARITY[d.rarity] + '">' + d.name + '</div>';
  if (d.kind === 'weapon' || d.kind === 'tool') h += '<div>' + d.dmg + ' damage · ' + (d.aps || 1).toFixed(1) + ' attacks/s · ' + (d.reach || 4) + ' reach</div>';
  if (d.kind === 'bow') h += '<div>' + d.dmg + ' damage at full draw</div>';
  if (d.kind === 'staff') h += '<div>' + d.dmg + ' damage · ' + d.cd + 's cooldown</div>';
  if (d.kind === 'armor') h += '<div>+' + d.armor + ' armor</div>' + (SET_BONUS[d.set] ? '<div style="color:#c77dff">' + SET_BONUS[d.set] + ' (full set)</div>' : '');
  if (d.kind === 'food') h += '<div>' + (d.food ? 'Restores ' + d.food / 2 + ' hunger' : '') + (d.heal ? (d.food ? ', ' : 'Restores ') + d.heal / 2 + ' hearts' : '') + '</div>';
  if (s.ench) h += '<div class="tench">' + enchText(s.ench) + '</div>';
  if (d.kind === 'potion') h += '<div style="color:' + EFFECTS[d.effect].color + '">' + EFFECTS[d.effect].name + (d.lvl > 1 ? ' ' + ROMAN[d.lvl] : '') + ' · ' + Math.floor(d.dur / 60) + ':' + String(d.dur % 60).padStart(2, '0') + '</div>';
  if (d.desc) h += '<div class="td">' + d.desc + '</div>';
  h += '<div style="opacity:.5;font-size:10px;text-transform:capitalize">' + d.rarity + ' ' + (d.kind === 'block' ? 'block' : d.kind) + '</div>';
  t.innerHTML = h; t.style.borderColor = RARITY[d.rarity]; t.classList.remove('hidden'); moveTip(e);
}
function moveTip(e) { const t = $('tooltip'); t.style.left = Math.min(window.innerWidth - 270, e.clientX + 16) + 'px'; t.style.top = (e.clientY + 12) + 'px'; }

// ---------------------------------------------------------------- wayfinder
const WF_TABS = [['all', 'All'], ['village', 'Villages'], ['camp', 'Camps'], ['sight', 'Sights'], ['ancient', 'Ancient places']];
let wfTab = 'all';
function openWayfinder() { Game.ui = 'wf'; $('wayfinder').classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock(); renderWayfinder(); }
function closeWayfinder() { $('wayfinder').classList.add('hidden'); Game.ui = null; lockPointer(); }
$('wfBack').onclick = () => closeWayfinder();
function renderWayfinder() {
  $('wfTabs').innerHTML = WF_TABS.map(([k, n]) => '<div class="tab' + (k === wfTab ? ' on' : '') + '" data-k="' + k + '">' + n + '</div>').join('');
  $('wfTabs').querySelectorAll('.tab').forEach(t => t.onclick = () => { wfTab = t.dataset.k; renderWayfinder(); });
  const list = Sites.filter(s => wfTab === 'all' || s.cat === wfTab).map(s => ({ s, d: Math.hypot(s.x - Player.x, s.z - Player.z) })).sort((a, b) => a.d - b.d);
  $('wfList').innerHTML = '';
  for (const { s, d } of list) {
    const row = document.createElement('div'); row.className = 'wf';
    const st = Game.follow === s ? '<span class="st fo">FOLLOWING</span>' : s.found ? '<span class="st vi">VISITED</span>' : '<span class="st un">UNEXPLORED</span>';
    const tc = s.treasureKey && Chests.get(s.treasureKey), claimed = tc && tc.items;
    row.innerHTML = '<div><div class="nm">' + s.name + '</div><div class="sb">' + s.sub + '</div>' + (s.treasureText ? '<div class="tr' + (claimed ? ' got' : '') + '">★ ' + (claimed ? 'Treasure claimed' : 'Treasure: ' + s.treasureText) + '</div>' : '') + '</div>' + st + '<div class="ds">' + Math.round(d) + ' blocks ' + dirName(s.x - Player.x, s.z - Player.z) + '</div><div class="fb">' + (Game.follow === s ? 'Stop' : 'Follow') + '</div>';
    row.querySelector('.fb').onclick = () => { Game.follow = Game.follow === s ? null : s; if (Game.follow) Quests.event('follow'); Sound.ui(); renderWayfinder(); };
    $('wfList').appendChild(row);
  }
}

// ---------------------------------------------------------------- lore modal with procedural pixel illustrations
function openLore(l) {
  Game.ui = 'lore';
  $('loreTitle').textContent = l.title; $('loreText').textContent = l.text;
  paintArt($('loreArt'), l.art || 'mural');
  $('lore').classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock();
}
function closeLore() { $('lore').classList.add('hidden'); Game.ui = null; lockPointer(); }
$('loreClose').onclick = closeLore;
function paintArt(cv, kind) {
  const g = cv.getContext('2d'), Wd = cv.width, Hd = cv.height;
  let s = 0; for (const ch of kind) s = s * 31 + ch.charCodeAt(0);
  const r = () => { s = (s * 16807 + 7) % 2147483647; return s / 2147483647; };
  const pal = {
    king: ['#2a1a3a', '#e8885a', '#4a3a4a'], blade: ['#0a1a2a', '#3a8ab8', '#1a2a3a'], tower: ['#1a2a1a', '#8ab070', '#2a3a2a'], wagon: ['#3a2a1a', '#e8b860', '#5a4024'],
    grave: ['#10141e', '#5a6a8a', '#1a1e28'], mine: ['#100c0a', '#5a4a3a', '#1a1410'], mural: ['#2a2014', '#c8a060', '#3a2c1c'], mural2: ['#1a1428', '#6ef0ff', '#2a2038'],
    bastion: ['#1a0a08', '#e85a1a', '#2a1410'], witch: ['#0e1a14', '#6ac04a', '#1a2a1e'], halls: ['#08141e', '#3a8aa0', '#0e1e2a'], seal: ['#140a1e', '#8a5ae8', '#1e1430'],
  }[kind] || ['#1a1a2a', '#8a8aa0', '#2a2a3a'];
  const grd = g.createLinearGradient(0, 0, 0, Hd); grd.addColorStop(0, pal[0]); grd.addColorStop(0.75, pal[1]); grd.addColorStop(1, pal[0]);
  g.fillStyle = grd; g.fillRect(0, 0, Wd, Hd);
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,' + (r() * 0.6) + ')'; g.fillRect(Math.floor(r() * Wd), Math.floor(r() * Hd * 0.5), 1, 1); }
  // distant hills
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = layer === 2 ? pal[2] : 'rgba(0,0,0,' + (0.25 + layer * 0.2) + ')';
    let y = Hd * (0.55 + layer * 0.12);
    for (let x = 0; x < Wd; x += 4) { y += (r() - 0.5) * 6; g.fillRect(x, Math.floor(y), 4, Hd); }
  }
  g.fillStyle = '#0c0a0e';
  const cx = Wd / 2, base = Hd * 0.86;
  const rect = (x, y, w, h, c) => { g.fillStyle = c || '#0c0a0e'; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  if (kind === 'king' || kind === 'mural' || kind === 'mural2') {
    // colossus silhouette kneeling and a small king
    rect(cx + 10, base - 52, 34, 34); rect(cx + 16, base - 66, 20, 16); rect(cx + 4, base - 30, 18, 30); rect(cx + 34, base - 18, 18, 18); rect(cx + 44, base - 50, 10, 30);
    rect(cx + 22, base - 62, 3, 3, kind === 'mural2' ? '#6ef0ff' : '#ffb060'); rect(cx + 29, base - 62, 3, 3, kind === 'mural2' ? '#6ef0ff' : '#ffb060');
    rect(cx - 30, base - 14, 6, 14); rect(cx - 31, base - 18, 8, 5); rect(cx - 26, base - 22, 2, 22, '#c8c8d0'); rect(cx - 29, base - 16, 8, 2, '#c8a030');
    if (kind !== 'king') for (let i = 0; i < 14; i++) { const x = r() * Wd, y = r() * Hd * 0.5; rect(x, y, 2, 4, '#ffd080'); rect(x + 1, y - 3, 1, 3, 'rgba(255,200,120,.5)'); }
  } else if (kind === 'blade') {
    rect(cx - 3, base - 70, 6, 60, '#9af0ff'); rect(cx - 12, base - 74, 24, 4, '#e8c060'); rect(cx - 2, base - 84, 4, 10, '#5a3a20'); rect(cx - 20, base - 8, 40, 8);
    for (let i = 0; i < 18; i++) rect(cx - 30 + r() * 60, base - 10 - r() * 50, 1, 1, '#ffffff');
  } else if (kind === 'tower') {
    rect(cx - 12, base - 74, 24, 74); rect(cx - 16, base - 78, 32, 6); for (let i = 0; i < 4; i++) rect(cx - 16 + i * 9, base - 84, 5, 6);
    rect(cx - 3, base - 60, 6, 8, '#ffd060'); rect(cx - 3, base - 34, 6, 8, '#ffd060');
    for (let i = 0; i < 3; i++) { const x = cx + 26 + i * 12; rect(x, base - 26, 4, 26); rect(x - 1, base - 30, 6, 6); rect(x + 1, base - 28, 1, 1, '#ffa020'); rect(x + 3, base - 28, 1, 1, '#ffa020'); }
  } else if (kind === 'wagon') {
    rect(cx - 30, base - 18, 44, 10); rect(cx - 30, base - 30, 4, 12); rect(cx + 10, base - 26, 4, 8); rect(cx - 26, base - 32, 34, 12, '#d8d0b8');
    for (const x of [cx - 24, cx + 6]) { g.beginPath(); g.arc(x, base - 6, 6, 0, 6.28); g.fillStyle = '#0c0a0e'; g.fill(); }
    for (let i = 0; i < 5; i++) { const x = cx + 30 + i * 8; rect(x, base - 6, 10, 3); rect(x + 1, base - 7, 1, 1, '#ff3020'); }
  } else if (kind === 'grave') {
    for (let i = 0; i < 7; i++) { const x = 20 + i * 24 + r() * 6; rect(x, base - 14, 8, 14); rect(x - 2, base - 10, 12, 3); }
    rect(cx + 30, base - 40, 4, 40); rect(cx + 34, base - 40, 10, 3); rect(cx + 20, base - 30, 10, 3);
    rect(cx - 6, base - 34, 4, 22, '#1a1622'); rect(cx - 5, base - 32, 1, 1, '#ffa020'); rect(cx - 3, base - 32, 1, 1, '#ffa020');
  } else if (kind === 'mine') {
    rect(0, 0, Wd, Hd * 0.3); rect(cx - 30, base - 44, 6, 44); rect(cx + 24, base - 44, 6, 44); rect(cx - 34, base - 48, 68, 6);
    rect(cx - 24, base - 42, 48, 42, '#050404'); for (let i = 0; i < 12; i++) rect(cx - 20 + r() * 40, base - 40 + r() * 36, 2, 2, '#6ef0ff');
    rect(cx - 2, base - 30, 3, 4, '#ffd060');
  } else if (kind === 'bastion') {
    rect(cx - 60, base - 40, 120, 40); for (let i = 0; i < 12; i++) rect(cx - 60 + i * 10, base - 46, 6, 6);
    rect(cx - 70, base - 60, 20, 60); rect(cx + 50, base - 60, 20, 60); rect(cx - 70, base - 64, 20, 4, '#ff6a1a'); rect(cx + 50, base - 64, 20, 4, '#ff6a1a');
    rect(0, base - 2, Wd, 6, '#ff5a14'); for (let i = 0; i < 20; i++) rect(r() * Wd, r() * base, 1, 2, '#ffb040');
  } else if (kind === 'witch') {
    rect(cx - 22, base - 34, 44, 22); for (let k = 0; k < 10; k++) rect(cx - 26 + k * 2, base - 44 + k, 52 - k * 4, 2);
    rect(cx - 20, base - 12, 3, 14); rect(cx + 17, base - 12, 3, 14); rect(cx - 4, base - 26, 8, 6, '#6ac04a'); rect(0, base + 2, Wd, 8, '#1a2a24');
    for (let i = 0; i < 9; i++) rect(r() * Wd, base - 10 - r() * 40, 2, 2, '#9aff9a');
  } else if (kind === 'halls' || kind === 'seal') {
    rect(0, Hd * 0.35, Wd, Hd, 'rgba(10,40,70,.6)');
    for (const sx of [-50, 50]) { rect(cx + sx - 10, base - 56, 20, 56); rect(cx + sx - 6, base - 66, 12, 10); rect(cx + sx - 3, base - 62, 2, 2, '#6ef0ff'); rect(cx + sx + 1, base - 62, 2, 2, '#6ef0ff'); }
    rect(cx - 16, base - 30, 32, 30); rect(cx - 8, base - 22, 16, 22, kind === 'seal' ? '#8a5ae8' : '#3a8aa0');
    for (let i = 0; i < 16; i++) rect(r() * Wd, r() * Hd, 1, 2, 'rgba(200,240,255,.6)');
  }
  // dither vignette
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const d = Math.hypot((x - Wd / 2) / Wd, (y - Hd / 2) / Hd); if (d > 0.42 && (x + y) % 2 === 0) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 1, 1); } }
}

// ---------------------------------------------------------------- title backdrop
function paintTitle() {
  const cv = $('titleArt'); if (!cv.getContext) return; // the title now uses a photo of Wheatmere
  const g = cv.getContext('2d'), Wd = cv.width, Hd = cv.height;
  let s = 99; const r = () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
  const grd = g.createLinearGradient(0, 0, 0, Hd); grd.addColorStop(0, '#0a0a24'); grd.addColorStop(0.5, '#3a2a5a'); grd.addColorStop(0.8, '#c8604a'); grd.addColorStop(1, '#2a1420');
  g.fillStyle = grd; g.fillRect(0, 0, Wd, Hd);
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,255,255,' + r() * 0.8 + ')'; g.fillRect(Math.floor(r() * Wd), Math.floor(r() * Hd * 0.55), 1, 1); }
  // falling shards
  for (let i = 0; i < 9; i++) { const x = r() * Wd, y = r() * Hd * 0.4; g.fillStyle = '#9af0ff'; g.fillRect(x, y, 2, 2); g.fillStyle = 'rgba(154,240,255,.35)'; for (let k = 1; k < 8; k++) g.fillRect(x - k, y - k * 1.4, 1, 1); }
  // crystal mountains (left), volcano (right)
  const ridge = (y0, amp, col, glow) => { g.fillStyle = col; let y = y0; for (let x = 0; x < Wd; x += 2) { y += (r() - 0.5) * amp; y = Math.max(Hd * 0.35, Math.min(Hd * 0.85, y)); g.fillRect(x, y, 2, Hd); if (glow && r() < 0.05) { g.fillStyle = '#6ef0ff'; g.fillRect(x, y + 3, 2, 3); g.fillStyle = col; } } };
  ridge(Hd * 0.55, 9, '#1e1e3a', true);
  g.fillStyle = '#1a1018'; g.beginPath(); g.moveTo(Wd * 0.7, Hd); g.lineTo(Wd * 0.83, Hd * 0.42); g.lineTo(Wd * 0.88, Hd * 0.42); g.lineTo(Wd, Hd * 0.7); g.lineTo(Wd, Hd); g.fill();
  g.fillStyle = '#ff6a1a'; g.fillRect(Wd * 0.83, Hd * 0.42, Wd * 0.05, 2); for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(255,' + (100 + r() * 100) + ',40,' + r() + ')'; g.fillRect(Wd * 0.84 + (r() - 0.5) * 20, Hd * 0.4 - r() * 30, 1, 1); }
  // the kneeling colossus
  g.fillStyle = '#121020';
  const cx = Wd * 0.5, by = Hd * 0.86;
  const R = (x, y, w, h, c) => { g.fillStyle = c || '#121020'; g.fillRect(Math.round(cx + x), Math.round(by + y), w, h); };
  R(-22, -62, 44, 40); R(-14, -80, 28, 20); R(-30, -22, 22, 22); R(12, -30, 22, 30); R(-36, -60, 12, 34); R(24, -60, 12, 30); R(-4, -88, 8, 8);
  R(-8, -74, 4, 3, '#6ef0ff'); R(4, -74, 4, 3, '#6ef0ff'); R(-5, -50, 10, 8, '#6ef0ff'); R(-3, -48, 6, 4, '#e8ffff');
  // forest silhouette
  g.fillStyle = '#0a0c10';
  for (let x = -4; x < Wd; x += 7) { const h = 14 + r() * 18; g.beginPath(); g.moveTo(x, Hd); g.lineTo(x + 4, Hd - h); g.lineTo(x + 8, Hd); g.fill(); }
  g.fillRect(0, Hd - 6, Wd, 6);
}

// ---------------------------------------------------------------- discovery cinematic
function startCinematic(site) {
  const c = $('cine');
  c.querySelector('.ck').textContent = site.cat === 'village' || site.cat === 'camp' ? 'DISCOVERED' : 'LANDMARK SIGHTED';
  c.querySelector('.cn').textContent = site.name; c.querySelector('.cs').textContent = site.sub;
  const t = c.querySelector('.ctext'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  if (!Settings.cine) { bossBanner(site.name, (site.cat === 'village' || site.cat === 'camp' ? 'Discovered · ' : 'Landmark sighted · ') + site.sub); $('banner').classList.add('discb'); return; }
  c.classList.remove('hidden');
  Game.cine = { site, t: 0, dur: 5.2, a0: Math.atan2(Player.x - site.x, Player.z - site.z) };
}
function endCinematic() { $('cine').classList.add('hidden'); Game.cine = null; }
function updateCinematic(dt) {
  const c = Game.cine; if (!c) return false;
  c.t += dt;
  const s = c.site, R = Math.max(18, s.r * 1.25), a = c.a0 + c.t * 0.22;
  const y = Math.max(s.y, surfaceY(Math.floor(s.x), Math.floor(s.z))) + R * 0.55 + 4;
  camera.position.set(s.x + Math.sin(a) * R, y, s.z + Math.cos(a) * R);
  camera.lookAt(s.x, s.y + 4, s.z);
  if (c.t >= c.dur) endCinematic();
  return true;
}

// ---------------------------------------------------------------- screen shake
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

// ---------------------------------------------------------------- creative inventory
const CREATIVE_TABS = [['building', 'Building'], ['nature', 'Nature'], ['decor', 'Decoration'], ['light', 'Light & Magic'], ['combat', 'Tools & Combat'], ['food', 'Food & Materials'], ['mobs', 'Creatures']];
let creativeTab = 'building', creativeSearch = '';
function creativeCategory(id) {
  if (id >= 256) { const d = ITEMS[id]; if (d.kind === 'egg') return 'mobs'; if (['tool', 'weapon', 'bow', 'staff', 'armor', 'relic'].includes(d.kind) || id === I.arrow) return 'combat'; return 'food'; }
  const b = BLK[id];
  if ([B.LAMP, B.TORCH, B.FIRE, B.CRYSTAL, B.CRYSTAL_ROSE, B.CRYSTAL_CLUSTER, B.GLOWSHROOM, B.WAYSTONE, B.ENERGY, B.PORTAL, B.SPAWNER, B.RUNEPILLAR, B.TABLET, B.ALTAR, B.ANCIENT_GOLD, B.STARSTONE, B.LAVA].includes(id)) return 'light';
  if ([B.CHEST, B.BARREL, B.CRATE, B.BOOKSHELF, B.TABLE, B.ENCHANT_TABLE, B.FURNACE, B.CAULDRON, B.POT, B.BANNER, B.FENCE, B.STONEPOST, B.LADDER, B.RAIL, B.NET, B.WEB, B.HAY, B.SPIKES, B.IRON_BLOCK, B.GOLD_BLOCK].includes(id)) return 'decor';
  if (['cross', 'flat'].includes(b.render) || b.cutLike || [B.GRASS, B.DIRT, B.STONE, B.SAND, B.GRAVEL, B.SNOW, B.BEDROCK, B.LOG, B.DARKLOG, B.ASH, B.MUD, B.SWAMPGRASS, B.CACTUS, B.FARMLAND, B.PATH, B.WATER, B.BASALT, B.IRON_ORE, B.GOLD_ORE, B.COAL_ORE, B.LAPIS_ORE, B.VINES].includes(id)) return 'nature';
  return 'building';
}
const ALL_ITEMS = [];
function allItems() {
  if (!ALL_ITEMS.length) { for (let id = 1; id < BLK.length; id++) ALL_ITEMS.push(id); for (const k in ITEMS) ALL_ITEMS.push(+k); }
  return ALL_ITEMS;
}
function openCreative() {
  Game.ui = 'creative';
  $('creative').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  renderCreative();
}
function closeCreative() {
  cursor = null; $('cursorItem').innerHTML = ''; $('creative').classList.add('hidden'); $('tooltip').classList.add('hidden');
  Game.ui = null; lockPointer();
}
function renderCreative() {
  $('crTabs').innerHTML = CREATIVE_TABS.map(([k, n]) => '<div class="tab' + (k === creativeTab && !creativeSearch ? ' on' : '') + '" data-k="' + k + '">' + n + '</div>').join('');
  $('crTabs').querySelectorAll('.tab').forEach(t => t.onclick = () => { creativeTab = t.dataset.k; creativeSearch = ''; $('crSearch').value = ''; Sound.ui(); renderCreative(); });
  const q = creativeSearch.toLowerCase();
  const list = allItems().filter(id => q ? itemDef(id).name.toLowerCase().includes(q) : creativeCategory(id) === creativeTab);
  const grid = $('crGrid'); grid.innerHTML = '';
  for (const id of list) {
    const d = document.createElement('div'); d.className = 'slot'; d.innerHTML = slotHTML({ id, n: 1 });
    d.onmousedown = e => {
      e.preventDefault();
      const n = e.button === 2 ? 1 : itemDef(id).stack;
      if (e.shiftKey) { let j = Inv.slots.slice(0, 9).findIndex(s => !s); if (j < 0) j = Game.sel; Inv.slots[j] = { id, n }; lastHudKey = ''; }
      else cursor = { id, n };
      Sound.ui(); renderCreative();
    };
    d.onmouseenter = e => showTip({ id, n: 1 }, e); d.onmousemove = moveTip; d.onmouseleave = () => $('tooltip').classList.add('hidden');
    d.oncontextmenu = e => e.preventDefault();
    grid.appendChild(d);
  }
  const hb = $('crHot'); hb.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const el = slotEl(Inv.slots, i, 'main');
    el.onmousedown = e => { e.preventDefault(); const s = Inv.slots[i]; if (cursor) { Inv.slots[i] = cursor; cursor = (s && s.id !== cursor.id) ? s : null; } else if (s) { cursor = s; Inv.slots[i] = null; } lastHudKey = ''; renderCreative(); };
    hb.appendChild(el);
  }
  const trash = $('crTrash'); trash.onmousedown = e => { e.preventDefault(); cursor = null; Sound.ui(); renderCreative(); };
  $('cursorItem').innerHTML = cursor ? slotHTML(cursor) : '';
}
document.addEventListener('DOMContentLoaded', () => {});
