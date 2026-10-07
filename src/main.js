'use strict';
/* Game core: player, input, combat, survival, saving, main loop. */
const SAVE_KEY = 'blockhollow_save_v3', SET_KEY = 'blockhollow_settings';
const SAVED_SETTINGS = (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || null; } catch (e) { return null; } })();
const Settings = Object.assign({ sens: 1, fov: 72, view: 1, hunger: true, cine: true, fps: false, shaders: true, shadows: true, preset: 'high', scale: 1, auto: true, particles: 1, bloom: true, vMaster: 0.8, vMusic: 0.6, vSfx: 0.8, target: 0 }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(Settings)); } catch (e) { } }

const Game = { state: 'title', ui: null, sel: 0, follow: null, cine: null, peaceful: false, day: 0, time: 0.32, seedName: '', zone: -1, zoneT: 0, halls: null, mods: new Map(), spawn: [128, 40, 128], save: null };
const Stats = { kills: 0, deaths: 0 };
const Player = { x: 128, y: 40, z: 128, vx: 0, vy: 0, vz: 0, hw: 0.3, h: 1.8, yaw: 0, pitch: 0, hp: 20, food: 20, onGround: false, alive: true, inv: 0, burn: 0, foodT: 0, regenT: 0, starveT: 0, fallV: 0, sneak: false };
const Inv = { slots: new Array(36).fill(null), armor: [null, null, null, null], relics: [null, null] };

// ---------------------------------------------------------------- inventory helpers
function addTo(arr, id, n, from, to) {
  const max = itemDef(id).stack;
  for (let i = from; i < to && n > 0; i++) { const s = arr[i]; if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; } }
  for (let i = from; i < to && n > 0; i++) if (!arr[i]) { const k = Math.min(n, max); arr[i] = { id, n: k }; n -= k; }
  return n;
}
// move a whole stack, keeping extras such as enchantments on tools
function putStack(arr, s, from, to) {
  if (s.ench) { for (let i = from; i < to; i++) if (!arr[i]) { arr[i] = s; return 0; } return s.n; }
  return addTo(arr, s.id, s.n, from, to);
}
function giveStack(s) { const left = putStack(Inv.slots, s, 0, 36); if (left < s.n) { lastHudKey = ''; Sound.pop(); } if (Game.ui === 'inv') renderInventory(); return left; }
function giveItem(id, n) {
  const left = addTo(Inv.slots, id, n, 0, 36);
  if (left < n) { lastHudKey = ''; pickupToast(id, n - left); Sound.pop(); }
  if (Game.ui === 'inv') renderInventory();
  return left;
}
let pickT = 0, pickAcc = {};
function pickupToast(id, n) { return; // minimal HUD: no pickup pop-ups
}
function pickupToastOld(id, n) { pickAcc[id] = (pickAcc[id] || 0) + n; clearTimeout(pickT); pickT = setTimeout(() => { toast('+ ' + Object.entries(pickAcc).map(([i, k]) => k + ' ' + itemDef(+i).name).join(', '), 2200); pickAcc = {}; }, 120); }
function countItem(id) { let n = 0; for (const s of Inv.slots) if (s && s.id === id) n += s.n; return n; }
function takeItem(id, n) { for (let i = 35; i >= 0 && n > 0; i--) { const s = Inv.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) Inv.slots[i] = null; } } lastHudKey = ''; return n === 0; }
function heldItem() { return Inv.slots[Game.sel]; }
function armorPoints() { return Inv.armor.reduce((a, s) => a + (s ? itemDef(s.id).armor : 0), 0); }
function armorReduction() { return Math.min(0.65, armorPoints() * 0.025); }
function fullSet() { const sets = Inv.armor.map(s => s ? itemDef(s.id).set : null); return sets[0] && sets.every(x => x === sets[0]) ? sets[0] : null; }
function hasRelic(k) { return Inv.relics.some(s => s && itemDef(s.id).relic === k); }
function maxHealth() { return 20 + (hasRelic('heart') ? 10 : 0) + Perk.bonusHp(); }
function clampHealth() { Player.hp = Math.min(Player.hp, maxHealth()); }
function nearTable() { const px = Math.floor(Player.x), py = Math.floor(Player.y), pz = Math.floor(Player.z); for (let y = py - 2; y <= py + 3; y++) for (let z = pz - 4; z <= pz + 4; z++) for (let x = px - 4; x <= px + 4; x++) if (getB(x, y, z) === B.TABLE) return true; return false; }
function canCraft(r, near) { if (r.table && !near) return false; const have = id => (r.exact ? [id] : woodFamily(id)).reduce((t, j) => t + countItem(j) + CraftGrid.reduce((a, s) => a + (s && s.id === j ? s.n : 0), 0), 0); return r.need.every(([id, n]) => have(id) >= n); }
// take one item, accepting either kind of wood
function takeWood(id, exact) { for (const j of exact ? [id] : woodFamily(id)) if (countItem(j) > 0 && takeItem(j, 1)) return j; return 0; }
function craft(r) { for (const [id, n] of r.need) takeItem(id, n); const left = giveItem(r.out[0], r.out[1]); if (left) dropItem(r.out[0], left, Player.x, Player.y + 1, Player.z); }

// ---------------------------------------------------------------- world edits
function blockChanged(x, y, z) {
  computeLight(x - 15, x + 15, z - 15, z + 15);
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  rebuildChunk(cx, cz);
  if ((x & 15) === 0) rebuildChunk(cx - 1, cz); if ((x & 15) === 15) rebuildChunk(cx + 1, cz);
  if ((z & 15) === 0) rebuildChunk(cx, cz - 1); if ((z & 15) === 15) rebuildChunk(cx, cz + 1);
  markDirtyAround(x - 15, x + 15, z - 15, z + 15);
  dirtyChunks.delete(cx + ',' + cz);
}
function setBlockLogged(x, y, z, id, meta) {
  if (!inWorld(x, y, z)) return;
  setB(x, y, z, id, meta || 0);
  Game.mods.set(modKey(x, y, z), [id, meta || 0]);
  blockChanged(x, y, z);
}

// ---------------------------------------------------------------- endless world streaming
// player edits are stored by absolute position so they survive chunks being recycled
const modKey = (x, y, z) => ((x + 32768) * 65536 + (z + 32768)) * 64 + y;
function modDecode(k) { const y = k % 64, r = (k - y) / 64, z = r % 65536 - 32768, x = Math.floor(r / 65536) - 32768; return [x, y, z]; }
let realmB = null, realmM = null, realmH = null, realmBi = null;
const VIEW_CHUNKS = 7;
function snapshotRealm() { realmB = wb.slice(); realmM = wm.slice(); realmH = hmap.slice(); realmBi = bmap.slice(); }
function loadChunk(cx, cz) {
  disposeSlot(slotOf(cx, cz));
  const x0 = cx * CS, z0 = cz * CS;
  if (cx >= 0 && cx < NCX && cz >= 0 && cz < NCZ && realmB) { // part of the hand-built realm: restore it exactly
    claimSlot(cx, cz);
    for (let y = 0; y < H; y++) for (let z = z0; z < z0 + CS; z++) { const off = x0 + z * W + y * W * D; wb.set(realmB.subarray(off, off + CS), off); wm.set(realmM.subarray(off, off + CS), off); }
    for (let z = z0; z < z0 + CS; z++) { const off = x0 + z * W; hmap.set(realmH.subarray(off, off + CS), off); bmap.set(realmBi.subarray(off, off + CS), off); }
  } else genChunk(cx, cz);
  const mods = modsByChunk().get(cx + ',' + cz); if (mods) for (const [x, y, z, v] of mods) { const i = IDX(x, y, z); wb[i] = v[0]; wm[i] = v[1]; }
  computeLight(x0 - 2, x0 + CS + 1, z0 - 2, z0 + CS + 1);
  rebuildChunk(cx, cz);
  markDirty(cx - 1, cz); markDirty(cx + 1, cz); markDirty(cx, cz - 1); markDirty(cx, cz + 1);
}
// ---- time-sliced streaming: new chunks are generated, lit and meshed in separate steps, a few
// milliseconds per frame, so moving into new land never freezes the game
const Stream = { job: null, want: null, wantT: 0, pcx: 1e9, pcz: 1e9 };
function streamWant() {
  const pcx = Math.floor(Player.x / CS), pcz = Math.floor(Player.z / CS), want = [];
  for (let dz = -VIEW_CHUNKS; dz <= VIEW_CHUNKS; dz++) for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
    const d2 = dx * dx + dz * dz; if (d2 > (VIEW_CHUNKS + 0.5) ** 2) continue;
    if (!chunkResident(pcx + dx, pcz + dz)) want.push([d2, pcx + dx, pcz + dz]);
  }
  want.sort((a, b) => b[0] - a[0]); // nearest last, so pop() takes it
  Stream.want = want; Stream.pcx = pcx; Stream.pcz = pcz; Stream.wantT = performance.now();
  return want;
}
function streamStep() { // one unit of work; returns false when nothing is left
  let j = Stream.job;
  if (!j) {
    const want = Stream.want;
    while (want && want.length) { const w = want.pop(); if (!chunkResident(w[1], w[2])) { j = Stream.job = { cx: w[1], cz: w[2], phase: 0 }; break; } }
    if (!j) return false;
  }
  const x0 = j.cx * CS, z0 = j.cz * CS;
  if (j.phase === 0) { // terrain (or the saved hand-built realm) plus your own edits
    if (!j.part) disposeSlot(slotOf(j.cx, j.cz));
    if (j.cx >= 0 && j.cx < NCX && j.cz >= 0 && j.cz < NCZ && realmB) {
      claimSlot(j.cx, j.cz);
      for (let y = 0; y < H; y++) for (let z = z0; z < z0 + CS; z++) { const off = x0 + z * W + y * W * D; wb.set(realmB.subarray(off, off + CS), off); wm.set(realmM.subarray(off, off + CS), off); }
      for (let z = z0; z < z0 + CS; z++) { const off = x0 + z * W; hmap.set(realmH.subarray(off, off + CS), off); bmap.set(realmBi.subarray(off, off + CS), off); }
      j.phase = 0.9;
    } else { genChunkPart(j.cx, j.cz, j.part || 0); j.part = (j.part || 0) + 1; if (j.part >= 3) j.phase = 0.9; }
  } else if (j.phase === 0.9) {
    const mods = modsByChunk().get(j.cx + ',' + j.cz); if (mods) for (const [x, y, z, v] of mods) { const i = IDX(x, y, z); wb[i] = v[0]; wm[i] = v[1]; }
    j.phase = 1;
  } else if (j.phase === 1) { computeLight(x0 - 2, x0 + CS + 1, z0 - 2, z0 + CS + 1); j.phase = 2; }
  else { rebuildChunk(j.cx, j.cz); for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (chunkResident(j.cx + dx, j.cz + dz)) markDirty(j.cx + dx, j.cz + dz); Stream.job = null; }
  return true;
}
// your edits, grouped by chunk (rebuilt only when the edit list changes)
let _modIdx = null, _modN = -1, _modRef = null;
function modsByChunk() {
  if (_modIdx && _modN === Game.mods.size && _modRef === Game.mods) return _modIdx;
  _modIdx = new Map(); _modN = Game.mods.size; _modRef = Game.mods;
  for (const [k, v] of Game.mods) { const [x, y, z] = modDecode(k), key = Math.floor(x / CS) + ',' + Math.floor(z / CS); let a = _modIdx.get(key); if (!a) _modIdx.set(key, a = []); a.push([x, y, z, v]); }
  return _modIdx;
}
function streamTick(ms) {
  const t0 = performance.now(), pcx = Math.floor(Player.x / CS), pcz = Math.floor(Player.z / CS);
  if (!Stream.want || pcx !== Stream.pcx || pcz !== Stream.pcz || t0 - Stream.wantT > 500) streamWant();
  let did = 0;
  while (performance.now() - t0 < ms || did === 0) { if (!streamStep()) break; did++; if (did > 40) break; }
  // seams of neighbouring chunks, in whatever time is left (at least one per frame)
  let n = 0; for (const [k, c] of dirtyChunks) { if (n && performance.now() - t0 > ms) break; dirtyChunks.delete(k); rebuildChunk(c[0], c[1]); n++; }
  Game.pendingChunks = (Stream.want ? Stream.want.length : 0) + (Stream.job ? 1 : 0);
}
function streamWorld(budget) {
  const pcx = Math.floor(Player.x / CS), pcz = Math.floor(Player.z / CS), want = [];
  for (let dz = -VIEW_CHUNKS; dz <= VIEW_CHUNKS; dz++) for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
    const d2 = dx * dx + dz * dz; if (d2 > (VIEW_CHUNKS + 0.5) ** 2) continue;
    if (!chunkResident(pcx + dx, pcz + dz)) want.push([d2, pcx + dx, pcz + dz]);
  }
  if (!want.length) return 0;
  want.sort((a, b) => a[0] - b[0]);
  const n = Math.min(budget, want.length);
  for (let i = 0; i < n; i++) loadChunk(want[i][1], want[i][2]);
  return want.length - n;
}

// ---------------------------------------------------------------- world creation / loading
function hashSeed(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
function setLoading(p, step) { $('lprog').style.width = Math.round(p * 100) + '%'; $('lstep').textContent = step; }
const nextFrame = () => new Promise(r => setTimeout(r, 16));
async function createWorld(seedName, save, mode, showcase) {
  // a newer build (for example pressing Play while the title tour is still loading) cancels this one
  const tok = Game.buildTok = (Game.buildTok || 0) + 1;
  const stale = () => tok !== Game.buildTok;
  Game.mode = save ? (save.mode || 'survival') : (mode || 'survival'); Game.peaceful = false;
  if (!showcase) { Game.state = 'loading'; showOnly('loading'); stopTour(); }
  setLoading(0, 'Clearing the old world');
  await nextFrame(); if (stale()) return false;
  // reset everything
  for (const m of Mobs.slice()) removeMob(m);
  for (const d of Drops) scene.remove(d.mesh); Drops.length = 0;
  for (const p of Projectiles) scene.remove(p.mesh); Projectiles.length = 0;
  for (const w of windmillMeshes) scene.remove(w.g); windmillMeshes.length = 0;
  for (let k = 0; k < chunkMeshes.length; k++) if (chunkMeshes[k]) { for (const m of chunkMeshes[k]) if (m) { scene.remove(m); m.geometry.dispose(); } chunkMeshes[k] = null; }
  wb.fill(0); wm.fill(0); wsky.fill(0); wbl.fill(0);
  Run.on = false; Run.armed = false; Run.txt = 'x'; renderRun();
  Sites.length = 0; Chests.clear(); Lore.clear(); Emitters.length = 0; SpawnPoints.length = 0; BossRooms.length = 0; Windmills.length = 0; Portals.length = 0;
  ActiveBoss = null; Game.mods = new Map(); Game.follow = null; Game.zone = -1; realmB = null; Game.seenBiomes = new Set();
  for (let k = 0; k < chunkMeshes.length; k++) disposeSlot(k); dirtyChunks.clear(); Stream.job = null; Stream.want = null; _modIdx = null;
  Game.seedName = seedName; SEED = hashSeed(seedName); rng = makeRng(SEED);
  setLoading(0.05, 'Raising mountains and carving rivers'); await nextFrame(); if (stale()) return false;
  genTerrain();
  setLoading(0.2, 'Growing ancient forests'); await nextFrame(); if (stale()) return false;
  genPlants();
  setLoading(0.3, 'Building villages, ruins and dungeons'); await nextFrame(); if (stale()) return false;
  const S = buildStructures();
  placeTreasures();
  snapshotRealm();
  Game.halls = S.halls || null;
  const spawnSite = S.wheatmere || Sites[0];
  Game.spawn = spawnSite && spawnSite.spawn ? spawnSite.spawn.slice() : [128.5, surfaceY(128, 128) + 1, 128.5];
  if (Game.mode === 'parkour' && Course.cps.length) Game.spawn = Course.cps[0].slice();
  // fresh player
  Object.assign(Player, { x: Game.spawn[0], y: Game.spawn[1], z: Game.spawn[2], vx: 0, vy: 0, vz: 0, yaw: Math.PI, pitch: 0, hp: 20, food: 20, alive: true, burn: 0 });
  Inv.slots.fill(null); Inv.armor.fill(null); Inv.relics.fill(null);
  Game.time = 0.3; Game.day = 0; Game.sel = 0; Stats.kills = 0; Stats.deaths = 0;
  if (save) applySave(save);
  else {
    if (Game.mode === 'creative') { giveItem(I.compass, 1); for (const id of [B.PLANKS, B.STONEBRICK, B.GLASS, B.LAMP, B.TORCH, B.PLASTER, B.THATCH, B.CHEST]) giveItem(id, 64); }
    else if (Game.mode !== 'parkour') { giveItem(I.compass, 1); giveItem(I.bread, 3); }
    if (Game.mode === 'parkour') { Player.yaw = parkourYaw(); const sp = Sites.find(x => x.name === 'The Skyward Spiral'); if (sp) sp.found = true; }
    Quests.reset(); Effects.clear();
    if (Sites[0]) Sites[0].found = true;
  }
  pickAcc = {};
  setLoading(0.42, 'Letting the light in'); await nextFrame(); if (stale()) return false;
  computeLight();
  const total = NCX * NCZ;
  // mesh closest chunks first
  const order = []; for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) order.push([cx, cz]);
  const pcx = Player.x / CS, pcz = Player.z / CS; order.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcz) - Math.hypot(b[0] - pcx, b[1] - pcz));
  if (showcase) { // title tour: mesh only the first stop now, the rest streams in while the tour plays
    Tour.queue = order.slice();
    meshTourArea(Player.x, Player.z, 3);
    buildWindmills();
    return true;
  }
  for (let i = 0; i < total; i++) {
    rebuildChunk(order[i][0], order[i][1]);
    if (i % 6 === 5) { setLoading(0.45 + 0.55 * i / total, 'Meshing the world (' + i + '/' + total + ')'); await nextFrame(); if (stale()) return false; }
  }
  buildWindmills();
  if (showcase) return true;
  if (streamWorld(0) > 0) { setLoading(0.98, 'Exploring the wilds around you'); await nextFrame(); if (stale()) return false; streamWorld(999); }
  if (save && BossRooms.find(r => r.type === 'colossus' && r.done) && Game.halls) Portals.push({ x: Game.halls.portal[0], y: Game.halls.portal[1] + 1, z: Game.halls.portal[2], to: Game.halls.exit });
  Game.state = 'ready';
  lastHudKey = '';
  showOnly('clickToBegin'); $('hud').classList.remove('hidden');
  Game.save = saveGame;
  saveGame();
}
function showOnly(id) {
  for (const s of ['title', 'loading', 'clickToBegin', 'pause', 'settings', 'controls', 'death']) $(s).classList.toggle('hidden', s !== id);
}

// ---------------------------------------------------------------- saving
function saveGame() {
  if (Game.state !== 'play' && Game.state !== 'ready') return;
  const mods = []; for (const [k, v] of Game.mods) mods.push(k, v[0], v[1]);
  const chests = []; for (const [k, c] of Chests) if (c.items || c.made) chests.push([k, c.table, c.items, !!c.made]);
  const data = {
    seed: Game.seedName, mode: Game.mode, quest: Quests.index, questProg: Quests.prog, perks: Quests.perks, questStart: Quests.startDay, effects: Effects.active, enchSeed: Player.enchSeed, mods, chests, time: Game.time, day: Game.day, stats: Stats,
    player: { x: Player.x, y: Player.y, z: Player.z, yaw: Player.yaw, pitch: Player.pitch, hp: Player.hp, food: Player.food },
    spawn: Game.spawn, inv: { slots: Inv.slots, armor: Inv.armor, relics: Inv.relics, loose: CraftGrid.filter(Boolean).concat(cursor ? [cursor] : []) }, sel: Game.sel, found: Sites.filter(s => s.found).map(s => s.name), follow: Game.follow ? Game.follow.name : null,
    bosses: BossRooms.map(r => r.done),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
}
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function applySave(s) {
  for (let i = 0; i < s.mods.length; i += 3) { const k = s.mods[i], [x, y, z] = modDecode(k); Game.mods.set(k, [s.mods[i + 1], s.mods[i + 2]]); if (inWorld(x, y, z)) { const j = IDX(x, y, z); wb[j] = s.mods[i + 1]; wm[j] = s.mods[i + 2]; } }
  for (const [k, table, items, made] of s.chests) Chests.set(k, { table, items, made });
  Quests.load(s); Effects.load(s.effects); Player.enchSeed = s.enchSeed || 1;
  Object.assign(Player, s.player); Game.spawn = s.spawn; Game.time = s.time; Game.day = s.day; Object.assign(Stats, s.stats || {});
  Inv.slots = s.inv.slots; Inv.armor = s.inv.armor; Inv.relics = s.inv.relics; Game.sel = s.sel || 0;
  CraftGrid.fill(null); cursor = null;
  for (const it of s.inv.loose || []) addTo(Inv.slots, it.id, it.n, 0, 36);
  for (const s2 of Sites) s2.found = s.found.includes(s2.name);
  Game.follow = Sites.find(x => x.name === s.follow) || null;
  (s.bosses || []).forEach((d, i) => { if (BossRooms[i]) BossRooms[i].done = d; });
}

// ---------------------------------------------------------------- pointer lock & menus
function lockPointer() {
  if (Game.state !== 'play') return;
  try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => showOnly('clickToBegin')); } catch (e) { }
  setTimeout(() => { if (Game.state === 'play' && !Game.ui && document.pointerLockElement !== canvasEl) { $('clickToBegin').classList.remove('hidden'); } }, 400);
}
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvasEl;
  if (locked) { $('clickToBegin').classList.add('hidden'); $('pause').classList.add('hidden'); return; }
  Input.mouseL = Input.mouseR = false;
  if (Game.state === 'play' && !Game.ui && Player.alive) openPause();
});
$('clickToBegin').addEventListener('click', () => { if (Game.state === 'ready') { Game.state = 'play'; Quests.render(true); } $('clickToBegin').classList.add('hidden'); lockPointer(); });
function openPause() { $('viewBtn').textContent = 'Camera: ' + ['First person', 'Third person (behind)', 'Third person (front)'][Game.view || 0]; Game.ui = 'pause'; $('pause').classList.remove('hidden'); $('creativeTools').classList.toggle('hidden', Game.mode !== 'creative'); $('mobToggle').textContent = 'Hostile mobs: ' + (Game.peaceful ? 'off' : 'on'); }
document.querySelectorAll('[data-time]').forEach(b => b.addEventListener('click', () => { Game.time = +b.dataset.time; Sound.ui(); }));
$('mobToggle').addEventListener('click', () => { Game.peaceful = !Game.peaceful; if (Game.peaceful) for (const mm of Mobs.slice()) if (!mm.def.passive && !mm.def.boss) removeMob(mm); $('mobToggle').textContent = 'Hostile mobs: ' + (Game.peaceful ? 'off' : 'on'); Sound.ui(); });
$('crSearch').addEventListener('input', e => { creativeSearch = e.target.value; renderCreative(); });
document.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => Sound.ui()));
function closePause() { $('pause').classList.add('hidden'); Game.ui = null; lockPointer(); }
let settingsReturn = 'title';
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  if (a === 'resume') closePause();
  if (a === 'settings') { settingsReturn = Game.state === 'title' ? 'title' : 'pause'; openSettings(); }
  if (a === 'controls') { settingsReturn = Game.state === 'title' ? 'title' : 'pause'; $('controls').classList.remove('hidden'); }
  if (a === 'closeSettings') { $('settings').classList.add('hidden'); saveSettings(); applySettings(); }
  if (a === 'closeControls') $('controls').classList.add('hidden');
  if (a === 'savequit') quitToTitle();
  if (a === 'view') { Game.view = ((Game.view || 0) + 1) % 3; $('viewBtn').textContent = 'Camera: ' + ['First person', 'Third person (behind)', 'Third person (front)'][Game.view]; }
  if (a === 'continue') { const s = loadSave(); if (s) { showTitleMenu('titleMenu'); createWorld(s.seed, s); } }
  if (a === 'play') { refreshTitle(); showTitleMenu('playMenu'); }
  if (a === 'backTitle') showTitleMenu('titleMenu');
  if (a === 'new') { showTitleMenu('newMenu'); $('overwriteWarn').classList.toggle('hidden', !loadSave()); $('seedInput').focus(); }
  if (a === 'back') showTitleMenu('playMenu');
  if (a === 'create') { const name = $('seedInput').value.trim() || 'Blockhollow'; try { localStorage.removeItem(SAVE_KEY); } catch (e) { } showTitleMenu('titleMenu'); createWorld(name, null, newMode); }
  if (a === 'quit') { toastTitle('Thanks for playing! You can close this tab.'); }
}));
let newMode = 'survival';
document.querySelectorAll('.mode').forEach(el => el.addEventListener('click', () => { newMode = el.dataset.mode; document.querySelectorAll('.mode').forEach(o => o.classList.toggle('on', o === el)); Sound.ui(); }));
function showTitleMenu(id) { for (const k of ['titleMenu', 'playMenu', 'newMenu']) $(k).classList.toggle('hidden', k !== id); }
function toastTitle(m) { const b = document.querySelector('[data-act=quit]'); const old = b.textContent; b.textContent = m; setTimeout(() => { b.textContent = old; }, 2500); }
function quitToTitle() {
  saveGame(); Game.state = 'title'; Game.ui = null; endCinematic();
  document.exitPointerLock && document.exitPointerLock();
  $('hud').classList.add('hidden'); showOnly('title'); refreshTitle();
  beginTour();
}
function refreshTitle() {
  const s = loadSave();
  $('saveCard').classList.toggle('hidden', !s);
  if (s) { $('saveName').textContent = s.seed; $('saveInfo').textContent = (s.mode === 'creative' ? 'Creative' : s.mode === 'parkour' ? 'Parkour' : 'Survival') + ' · day ' + (Math.floor(s.day || 0) + 1) + ((s.mode || 'survival') === 'survival' && s.quest !== undefined ? ' · quest ' + Math.min(s.quest + 1, QUESTS.length) + '/' + QUESTS.length : ''); }
}
function openSettings() {
  $('setSens').value = Settings.sens; $('setFov').value = Settings.fov; $('setView').value = Settings.view;
  $('setHunger').checked = Settings.hunger; $('setShaders').checked = Settings.shaders; $('setShadows').checked = Settings.shadows; $('setPreset').value = Settings.preset; $('setScale').value = Settings.scale; $('setAuto').checked = Settings.auto; $('setTarget').value = Settings.target || 0; $('setParticles').value = Settings.particles; $('setBloom').checked = Settings.bloom; $('setVMaster').value = Settings.vMaster; $('setVMusic').value = Settings.vMusic; $('setVSfx').value = Settings.vSfx; refreshSystemInfo(); $('setCine').checked = Settings.cine; $('setFps').checked = Settings.fps;
  $('settings').classList.remove('hidden');
}
for (const [id, k, num] of [['setSens', 'sens', 1], ['setFov', 'fov', 1], ['setView', 'view', 1], ['setHunger', 'hunger', 0], ['setCine', 'cine', 0], ['setFps', 'fps', 0], ['setShaders', 'shaders', 0], ['setShadows', 'shadows', 0], ['setScale', 'scale', 1], ['setAuto', 'auto', 0], ['setParticles', 'particles', 1], ['setBloom', 'bloom', 0], ['setVMaster', 'vMaster', 1], ['setVMusic', 'vMusic', 1], ['setVSfx', 'vSfx', 1]]) {
  $(id).addEventListener('input', e => { Settings[k] = num ? +e.target.value : e.target.checked; applySettings(); });
}
$('setTarget').addEventListener('change', e => { Settings.target = +e.target.value; saveSettings(); });
$('setPreset').addEventListener('change', e => { applyPreset(e.target.value); openSettings(); saveSettings(); });
function refreshSystemInfo() {
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const info = renderer.info.render, pr = renderer.getPixelRatio();
  $('sysInfo').innerHTML = 'GPU: <b>' + String(gpu).replace(/</g, '') + '</b><br>WebGL ' + (renderer.capabilities.isWebGL2 ? '2' : '1') + ' · HDR targets: <b>' + (PostFX.hdr ? 'yes' : 'no') + '</b> · CPU threads: <b>' + (navigator.hardwareConcurrency || '?') + '</b><br>Resolution: <b>' + Math.round(window.innerWidth * pr) + '×' + Math.round(window.innerHeight * pr) + '</b> (' + Math.round(pr * 100) + '% pixel ratio' + (dynScale < 1 ? ', auto-lowered' : '') + ')<br>FPS: <b>' + (Game.fps ? Math.round(Game.fps) : '–') + '</b> · screen: <b>' + Refresh.hz + ' Hz</b> · target: <b>' + targetFps() + '</b> · draw calls: <b>' + info.calls + '</b> · triangles: <b>' + Math.round(info.triangles / 1000) + 'k</b> · chunks drawn: <b>' + (Game.visibleChunks || 0) + '/' + (NCX * NCZ) + '</b> · shadow map: <b>' + (Settings.shadows ? PostFX.shadowRes : 'off') + '</b>';
}
setInterval(() => { if (!$('settings').classList.contains('hidden')) refreshSystemInfo(); }, 1000);
// clouds and water reflections follow the quality preset and the automatic performance level
function qualityFor() {
  const pre = Settings.preset;
  const clouds = !Settings.shaders || pre === 'low' ? 0 : pre === 'medium' ? 6 : pre === 'ultra' ? 14 : 10;
  return { clouds: perfLevel >= 2 ? Math.min(clouds, 5) : perfLevel === 1 ? Math.min(clouds, 8) : clouds, reflections: Settings.shaders && (pre === 'high' || pre === 'ultra') && perfLevel < 2 };
}
function applySettings() { Sound.volumes(); applyRenderScale(); camera.fov = Settings.fov; camera.updateProjectionMatrix(); $('fps').style.display = Settings.fps ? '' : 'none'; lastHudKey = ''; }
$('respawnBtn').onclick = () => respawn();
$('deathQuit').onclick = () => { respawn(true); quitToTitle(); };

// ---------------------------------------------------------------- input
const Input = { keys: {}, mouseL: false, mouseR: false };
document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Escape' && Game.ui === 'creative') { e.target.blur(); closeCreative(); } return; }
  Input.keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (Game.state !== 'play') return;
  if (Game.cine && (e.code === 'Space' || e.code === 'Escape')) { endCinematic(); return; }
  if (e.code === 'KeyR' && Game.mode === 'parkour' && !Game.ui && Game.state === 'play') { restartParkour(); return; }
  if (e.code === 'KeyE') { if (Game.ui === 'ench') closeEnchant(); else if (Game.ui === 'inv') closeInventory(); else if (Game.ui === 'creative') closeCreative(); else if (!Game.ui) { if (Game.mode === 'creative') openCreative(); else openInventory(); } return; }
  if (!e.repeat && !Game.ui) {
    const t = e.timeStamp || performance.now();
    if (e.code === 'KeyW') { if (t - (Input.lastW || 0) < 280) Player.wTap = true; Input.lastW = t; }
    if (e.code === 'Space' && Game.mode === 'creative') { if (t - (Input.lastSpace || 0) < 300) { Player.flying = !Player.flying; Player.vy = 0; toast(Player.flying ? 'Flying — Space to rise, Shift to descend, double-tap Space to land' : 'Flying off', 1800); Input.lastSpace = 0; } else Input.lastSpace = t; }
    if (e.code === 'KeyJ' || e.key === 'j' || e.key === 'J') { Quests.hidden = !Quests.hidden; Quests.render(); }
  }
  if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') { if (Game.ui === 'wf') closeWayfinder(); else if (!Game.ui) openWayfinder(); return; }
  if (e.code === 'Escape') { if (Game.ui === 'ench') closeEnchant(); else if (Game.ui === 'creative') closeCreative(); else if (Game.ui === 'inv') closeInventory(); else if (Game.ui === 'wf') closeWayfinder(); else if (Game.ui === 'lore') closeLore(); else if (Game.ui === 'pause') closePause(); return; }
  if (Game.ui) return;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 9) { Game.sel = n; showHeldName(); lastHudKey = ''; } }
  if (e.code === 'KeyQ') { const s = heldItem(); if (s) { const d = lookDir(); dropItem(s.id, 1, Player.x + d[0], Player.y + 1.4, Player.z + d[2]); Drops[Drops.length - 1].vx = d[0] * 6; Drops[Drops.length - 1].vz = d[2] * 6; Drops[Drops.length - 1].t = -0.5; s.n--; if (!s.n) Inv.slots[Game.sel] = null; lastHudKey = ''; } }
  if (e.code === 'F3') Settings.fps = !Settings.fps, applySettings();
  if ((e.code === 'F5' || e.code === 'KeyV' || e.key === 'v' || e.key === 'V') && !e.repeat) { e.preventDefault(); Game.view = ((Game.view || 0) + 1) % 3; toast(['First person', 'Third person · behind', 'Third person · front'][Game.view], 1200); }
});
document.addEventListener('keyup', e => { Input.keys[e.code] = false; if (e.code === 'KeyW') Player.wTap = false; });
document.addEventListener('mousemove', e => {
  if (Game.state !== 'play' || Game.ui || document.pointerLockElement !== canvasEl || Game.cine) return;
  const s = 0.0022 * Settings.sens;
  Player.yaw -= e.movementX * s; Player.pitch = clamp(Player.pitch - e.movementY * s, -1.55, 1.55);
});
canvasEl.addEventListener('mousedown', e => {
  if (Game.state === 'ready') return;
  if (Game.cine) { endCinematic(); return; }
  if (Game.state !== 'play' || Game.ui) return;
  if (document.pointerLockElement !== canvasEl) { lockPointer(); return; }
  if (e.button === 0) { Input.mouseL = true; attack(); }
  if (e.button === 2) { Input.mouseR = true; useStart(); }
  if (e.button === 1) { e.preventDefault(); pickBlock(); }
});
function pickBlock() { // middle click: put the targeted block in your hand
  const h = targetBlock(6); if (!h) return;
  let id = h.id; if (id === B.GRASS) id = B.GRASS; if (BLK[id].render === 'liquid') return;
  const at = Inv.slots.slice(0, 9).findIndex(s => s && s.id === id);
  if (at >= 0) Game.sel = at;
  else if (Game.mode === 'creative') Inv.slots[Game.sel] = { id, n: 64 };
  else { const j = Inv.slots.findIndex((s, i) => i >= 9 && s && s.id === id); if (j >= 0) { const tmp = Inv.slots[Game.sel]; Inv.slots[Game.sel] = Inv.slots[j]; Inv.slots[j] = tmp; } }
  lastHudKey = ''; showHeldName(); Sound.ui();
}
// leaving with Ctrl+W or closing the tab by accident: save first and ask
window.addEventListener('beforeunload', e => { if (Game.state === 'play') { saveGame(); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('mouseup', e => { if (e.button === 0) { Input.mouseL = false; Game.mine = null; } if (e.button === 2) { Input.mouseR = false; useEnd(); } });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => { if (Game.state !== 'play' || Game.ui) return; Game.sel = (Game.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9; showHeldName(); lastHudKey = ''; }, { passive: true });

// ---------------------------------------------------------------- targeting
function lookDir() { const cp = Math.cos(Player.pitch); return [-Math.sin(Player.yaw) * cp, Math.sin(Player.pitch), -Math.cos(Player.yaw) * cp]; }
function eye() { return [Player.x, Player.y + (Player.sneak ? 1.35 : 1.62), Player.z]; }
const TARGETABLE = id => id !== 0 && id !== B.WATER && id !== B.LAVA;
function targetBlock(reach) { const o = eye(), d = lookDir(); return raycastBlocks(o[0], o[1], o[2], d[0], d[1], d[2], reach || 5, TARGETABLE); }
function targetMob(reach) {
  const o = eye(), d = lookDir(); let best = null, bt = reach;
  const bh = targetBlock(reach); if (bh) bt = Math.min(bt, bh.t);
  for (const m of Mobs) {
    if (m.dead) continue;
    const lo = [m.x - m.hw - 0.1, m.y, m.z - m.hw - 0.1], hi = [m.x + m.hw + 0.1, m.y + m.h * (m.scale || 1), m.z + m.hw + 0.1];
    let t0 = 0, t1 = bt, ok = true;
    for (let a = 0; a < 3 && ok; a++) {
      if (Math.abs(d[a]) < 1e-8) { if (o[a] < lo[a] || o[a] > hi[a]) ok = false; continue; }
      let a0 = (lo[a] - o[a]) / d[a], a1 = (hi[a] - o[a]) / d[a]; if (a0 > a1) [a0, a1] = [a1, a0];
      t0 = Math.max(t0, a0); t1 = Math.min(t1, a1); if (t0 > t1) ok = false;
    }
    if (ok && t0 < bt) { bt = t0; best = m; }
  }
  return best;
}

// ---------------------------------------------------------------- combat
let lastSwing = 0, swingT = 1;
function startSwing(force) { if (force || swingT >= 0.75) swingT = 0; }
function weaponStats() {
  const s = heldItem(), d = s ? itemDef(s.id) : null;
  if (d && (d.kind === 'weapon' || d.kind === 'tool')) return d;
  return { dmg: 1, aps: 4, reach: 3.5 };
}
function chargeLevel() { const w = weaponStats(); return clamp((performance.now() - lastSwing) / 1000 * (w.aps || 1.5), 0, 1); }
function attack() {
  const w = weaponStats(), m = targetMob(w.reach || 3.6), charge = chargeLevel();
  startSwing(true);
  if (!m) { Sound.swing(); startMining(); return; }
  lastSwing = performance.now();
  const d = lookDir();
  let dmg = w.dmg * (0.2 + 0.8 * charge * charge);
  let crit = false;
  if (!Player.onGround && Player.vy < 0 && charge > 0.9) { dmg *= 1.5; crit = true; }
  if (w.backstab) {
    const behind = Math.cos(m.g.rotation.y) * (Player.z - m.z) + Math.sin(m.g.rotation.y) * (Player.x - m.x) < 0;
    if (behind) { dmg *= 2; crit = true; } else if (Math.random() < 0.5) { dmg *= 1.5; crit = true; }
  }
  if (hasRelic('melee')) dmg *= 1.25;
  dmg *= Perk.meleeMul();
  dmg += heldEnch('sharpness') * (0.2 + 0.8 * charge * charge); // Sharpness: +1 per level at full charge
  dmg *= 1 + 0.4 * Effects.lvl('strength');
  if (fullSet() === 'prism') dmg *= 1.15;
  const kb = (0.35 + 0.65 * charge * charge) * (1 + 0.8 * heldEnch('knockback')); // weak, spammed hits barely push
  m.looting = heldEnch('looting') + (hasRelic('luck') ? 1 : 0);
  const hp0 = m.hp;
  damageMob(m, dmg, d[0] * kb, d[2] * kb, crit);
  if (m.hp === hp0 && !m.shield) { Sound.swing(); return; } // still protected from the last hit
  Game.hitStop = m.def.boss ? 0.07 * charge : crit ? 0.085 : 0.05 * charge * charge; if (crit || m.def.boss) shake(crit ? 0.18 : 0.1);
  if (!m.tamed) { Game.lastHit = m; Game.lastHitT = performance.now(); }
  if (heldEnch('fire')) m.onFire = Math.max(m.onFire || 0, 4 * heldEnch('fire'));
  if (crit) burst(m.x, m.y + m.h * 0.7, m.z, 10, { life: 0.5, size: 0.08, r: 1, g: 0.9, b: 0.4, glow: true, spread: 4 });
  if (w.smash && charge > 0.95) { shake(0.5); for (const o of Mobs) if (o !== m && !o.dead && !o.tamed && Math.hypot(o.x - m.x, o.z - m.z) < 4.5) damageMob(o, w.dmg * 0.5, (o.x - m.x), (o.z - m.z), false); burst(m.x, m.y + 0.2, m.z, 30, { life: 0.6, size: 0.15, r: 0.6, g: 0.9, b: 1, glow: true, spread: 9, up: 2 }); }
  if (w.wave && charge > 0.95) shoot('wave', Player.x + d[0], Player.y + 1, Player.z + d[2], d[0] * 16, 0, d[2] * 16, w.dmg * 0.8, 'player');
  wearTool();
}
function wearTool() { }

// ---------------------------------------------------------------- mining
// crack textures: one branching crack network that starts as a small split in the middle
// and spreads with every stage until it covers the whole face
const crackTex = [], CRACK_STAGES = 10;
{
  let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const order = new Int16Array(256).fill(-1), pts = []; let n = 0;
  const put = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x > 15 || y > 15) return false; const i = x + y * 16; if (order[i] < 0) { order[i] = n++; pts.push([x, y]); } return true; };
  put(8, 8); put(7, 8);
  // main cracks run from the centre to every side, growing a step at a time in turn
  const heads = []; for (let k = 0; k < 8; k++) heads.push({ x: 8, y: 8, a: k / 8 * Math.PI * 2 + (r() - 0.5) * 0.5 });
  for (let step = 0; step < 11; step++) for (const h of heads) { h.a += (r() - 0.5) * 0.6; h.x += Math.cos(h.a) * 0.9; h.y += Math.sin(h.a) * 0.9; put(h.x, h.y); }
  // then side cracks branch off everywhere until the face is covered
  for (let b = 0; b < 46; b++) {
    const from = pts[Math.floor((0.25 + 0.75 * r()) * pts.length)]; let x = from[0], y = from[1];
    let a = Math.atan2(y - 7.5, x - 7.5) + (r() < 0.5 ? 1 : -1) * (0.8 + r() * 0.8);
    const len = 2 + r() * 4;
    for (let i = 0; i < len; i++) { a += (r() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a); if (!put(x, y)) break; }
  }
  for (let s = 0; s < CRACK_STAGES; s++) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    const k = (s + 1) / CRACK_STAGES, show = Math.ceil(n * Math.pow(k, 1.6));
    if (s >= CRACK_STAGES - 3) { g.fillStyle = 'rgba(0,0,0,' + (0.06 * (s - CRACK_STAGES + 4)) + ')'; g.fillRect(0, 0, 16, 16); }
    for (let i = 0; i < 256; i++) if (order[i] >= 0 && order[i] < show) {
      const x = i % 16, y = (i / 16) | 0, fresh = order[i] > show * 0.8;
      g.fillStyle = fresh ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.82)'; g.fillRect(x, y, 1, 1);
      if (!fresh && s > 2) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 1, y, 1, 1); }
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; crackTex.push(t);
  }
}
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
crackMesh.visible = false; scene.add(crackMesh);
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
scene.add(outline);
function breakTime(id) {
  const d = BLK[id];
  let hard = d.hardness;
  if (id === B.ENERGY && ActiveBoss && ActiveBoss.type === 'colossus') hard = 2.5;
  if (Game.mode === 'creative') return 0;
  if (hard < 0) return Infinity;
  if (hard === 0) return 0.05;
  const s = heldItem(), it = s ? itemDef(s.id) : null;
  let t = hard * 1.5;
  if (it && it.kind === 'tool' && d.tool === it.toolType) t /= it.mult;
  else if (d.tool === 'pick' && hard >= 1.5) t *= 2.2;
  const eff = it && it.kind === 'tool' && d.tool === it.toolType ? enchOf(s, 'efficiency') : 0;
  t /= 1 + 0.35 * eff * eff;           // Efficiency I-V
  t /= 1 + 1.5 * Effects.lvl('haste');  // Haste potion
  return Math.max(0.05, t / Perk.miningMul() / (hasRelic('mine') ? 1.25 : 1));
}
function startMining() { const h = targetBlock(5); Game.mine = h ? { x: h.x, y: h.y, z: h.z, t: 0, need: breakTime(h.id) } : null; if (h && Game.mine.need === Infinity) toastOnce('unbreak', 'This block cannot be broken.'); }
function updateMining(dt) {
  if (Game.mode === 'parkour') { Game.mine = null; crackMesh.visible = false; return; }
  if (!Input.mouseL || Game.ui) { Game.mine = null; crackMesh.visible = false; return; }
  const h = targetBlock(5);
  if (!h) { Game.mine = null; crackMesh.visible = false; return; }
  if (!Game.mine || Game.mine.x !== h.x || Game.mine.y !== h.y || Game.mine.z !== h.z) { if (chargeLevel() > 0.3 || !Game.mine) Game.mine = { x: h.x, y: h.y, z: h.z, t: 0, need: breakTime(h.id) }; }
  const m = Game.mine;
  if (m.need === Infinity) { crackMesh.visible = false; return; }
  if (m.need === 0) { // creative: instant break, then a short delay while the button is held
    Game.creativeT = (Game.creativeT || 0) - dt;
    if (Game.creativeT <= 0) { Game.creativeT = 0.18; startSwing(true); breakBlock(h); Game.mine = null; }
    crackMesh.visible = false; return;
  }
  m.t += dt;
  Game.digT = (Game.digT || 0) - dt; if (Game.digT <= 0) { Game.digT = 0.24; Sound.dig(h.id); }
  startSwing(false);
  const prog = m.t / m.need;
  if (Math.random() < dt * (5 + 14 * prog)) blockBurst(h.x, h.y, h.z, h.id, prog > 0.6 ? 3 : 2);
  crackMesh.visible = true; crackMesh.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
  crackMesh.material.map = crackTex[Math.min(CRACK_STAGES - 1, Math.floor(prog * CRACK_STAGES))];
  if (m.t >= m.need) { breakBlock(h); Game.mine = null; crackMesh.visible = false; }
}
function breakBlock(h) {
  const id = h.id, d = BLK[id], k = K(h.x, h.y, h.z);
  if (Chests.has(k)) { const c = Chests.get(k); if (c && c.items) for (const s of c.items) if (s) dropItem(s.id, s.n, h.x + 0.5, h.y + 0.5, h.z + 0.5); Chests.delete(k); }
  if (id === B.ENERGY) { // a colossus pylon: the whole column shatters
    for (let y = h.y - 8; y <= h.y + 8; y++) if (getB(h.x, y, h.z) === B.ENERGY || (getB(h.x, y, h.z) === B.CRYSTAL && getB(h.x, y - 1, h.z) === B.ENERGY)) { setBlockLogged(h.x, y, h.z, B.AIR); blockBurst(h.x, y, h.z, B.ENERGY, 10); }
    shake(0.4); toast('A pylon shatters!', 1500); return;
  }
  blockBurst(h.x, h.y, h.z, id, 16);
  setBlockLogged(h.x, h.y, h.z, B.AIR);
  Sound.brk(id);
  Quests.event('break', id);
  if (Game.mode === 'creative') { const up = getB(h.x, h.y + 1, h.z); if (['cross', 'flat'].includes(BLK[up].render) && up !== B.TORCH) setBlockLogged(h.x, h.y + 1, h.z, B.AIR); return; }
  // plants on top fall too
  const up = getB(h.x, h.y + 1, h.z);
  if (['cross', 'flat'].includes(BLK[up].render) && up !== B.TORCH) setBlockLogged(h.x, h.y + 1, h.z, B.AIR);
  let drop = d.drop;
  if (id === B.LEAVES || id === B.LEAVES_BLOSSOM) { if (Math.random() < 0.06) drop = I.globerry; else if (Math.random() < 0.1) drop = I.stick; }
  if (id === B.TALLGRASS && Math.random() < 0.08) drop = I.wheat;
  let cnt = id === B.CRYSTAL_CLUSTER || id === B.BERRYBUSH ? 1 + Math.floor(Math.random() * 2) : id === B.LAPIS_ORE ? 3 + Math.floor(Math.random() * 4) : 1;
  if ([B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.LAPIS_ORE, B.CRYSTAL, B.CRYSTAL_CLUSTER].includes(id)) cnt += Math.floor(Math.random() * (heldEnch('fortune') + 1));
  if (drop) dropItem(drop, cnt, h.x + 0.5, h.y + 0.5, h.z + 0.5);
  if (id === B.CRACKEDBRICK && Math.random() < 1) toastOnce('cracked', 'The wall crumbles... something is hidden behind it.');
}

// ---------------------------------------------------------------- use / place
let bowDraw = 0, drawing = false, staffCd = 0, useRepeat = 0;
function useStart() {
  const s = heldItem(), d = s ? itemDef(s.id) : null;
  const h = targetBlock(5);
  const tm = targetMob(4);
  if (tm && (!h || Math.hypot(tm.x - Player.x, tm.z - Player.z) < h.t + 0.5) && interactMob(tm)) { startSwing(true); return; }
  if (h && interact(h)) return;
  if (d && d.kind === 'egg') { const sx = h ? h.px + 0.5 : Player.x + lookDir()[0] * 3, sz = h ? h.pz + 0.5 : Player.z + lookDir()[2] * 3, sy = h ? h.py : Player.y; const m = spawnMob(d.mob, sx, sy, sz); m.yaw = Player.yaw + Math.PI; burst(sx, sy + 0.5, sz, 14, { life: 0.6, size: 0.1, r: 1, g: 1, b: 1, spread: 2, up: 2 }); Sound.pop(); if (Game.mode !== 'creative') { s.n--; if (!s.n) Inv.slots[Game.sel] = null; lastHudKey = ''; } return; }
  if (d && d.kind === 'pearl') { const e = eye(), dir = lookDir(); shoot('pearl', e[0] + dir[0] * 0.5, e[1], e[2] + dir[2] * 0.5, dir[0] * 20, dir[1] * 20 + 2, dir[2] * 20, 0, 'player'); Sound.bow(); startSwing(true); if (Game.mode !== 'creative') { s.n--; if (!s.n) Inv.slots[Game.sel] = null; lastHudKey = ''; } return; }
  if (d && d.kind === 'bow') { if (countItem(I.arrow) > 0) { drawing = true; bowDraw = 0; } else toastOnce('noarrow', 'You need arrows.'); return; }
  if (d && d.kind === 'staff') { castStaff(d); return; }
  if (d && d.kind === 'compass') { openWayfinder(); return; }
  if (d && d.kind === 'food') { eat(s, d); return; }
  if (d && d.kind === 'potion') { drinkPotion(s, d); return; }
  if (s && s.id < 256) placeBlock(h, s);
  useRepeat = 0.3;
}
function useEnd() {
  if (drawing) {
    drawing = false;
    const s = heldItem(), d = s ? itemDef(s.id) : null;
    if (d && d.kind === 'bow' && bowDraw > 0.15 && (enchOf(s, 'infinity') ? countItem(I.arrow) > 0 : takeItem(I.arrow, 1))) {
      const p = Math.min(1, bowDraw), dir = lookDir(), e = eye(), sp = 14 + 26 * p * d.power, pw = enchOf(s, 'power');
      Sound.bow();
      shoot('arrow', e[0] + dir[0] * 0.5, e[1] - 0.1, e[2] + dir[2] * 0.5, dir[0] * sp, dir[1] * sp, dir[2] * sp, d.dmg * p * (pw ? 1 + 0.25 * (pw + 1) : 1), 'player', { crit: p >= 1, flame: enchOf(s, 'flame') > 0, infinite: enchOf(s, 'infinity') > 0 });
      startSwing(true);
    }
    bowDraw = 0;
  }
}
function castStaff(d) {
  if (staffCd > 0) return;
  staffCd = d.cd; Sound.zap();
  const o = eye(), dir = lookDir();
  let first = null, bestScore = 0;
  for (const m of Mobs) {
    if (m.dead || m.def.passive && !m.anger) continue;
    const dx = m.x - o[0], dy = m.y + m.h / 2 - o[1], dz = m.z - o[2], dist = Math.hypot(dx, dy, dz);
    if (dist > 22) continue;
    const dot = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / dist;
    if (dot > 0.85 && dot / (1 + dist * 0.02) > bestScore) { bestScore = dot / (1 + dist * 0.02); first = m; }
  }
  const start = [o[0] + dir[0] * 0.8, o[1] - 0.2 + dir[1] * 0.8, o[2] + dir[2] * 0.8];
  startSwing(true);
  if (!first) { lightning(start, [o[0] + dir[0] * 14, o[1] + dir[1] * 14, o[2] + dir[2] * 14]); return; }
  const hit = [first]; let cur = first;
  for (let k = 0; k < 2; k++) { let nx = null, nd = 7; for (const m of Mobs) if (!hit.includes(m) && !m.dead && !(m.def.passive && !m.anger)) { const dd = Math.hypot(m.x - cur.x, m.z - cur.z); if (dd < nd) { nd = dd; nx = m; } } if (!nx) break; hit.push(nx); cur = nx; }
  let prev = start;
  for (const m of hit) { const p = [m.x, m.y + m.h * 0.6, m.z]; lightning(prev, p); prev = p; }
  hit.forEach((m, i) => damageMob(m, d.dmg * (i ? 0.7 : 1) * (hasRelic('melee') ? 1 : 1), 0, 0, false));
  shake(0.15);
}
function eat(s, d) {
  const needFood = Settings.hunger && Player.food < 20, needHp = Player.hp < maxHealth();
  if (!needFood && !(d.heal && needHp)) { toastOnce('full', "You're not hungry."); return; }
  Player.food = Math.min(20, Player.food + d.food); Player.hp = Math.min(maxHealth(), Player.hp + d.heal);
  Sound.eat(); Quests.event('eat');
  s.n--; if (!s.n) Inv.slots[Game.sel] = null;
  const e = eye(), dir = lookDir();
  burst(e[0] + dir[0] * 0.5, e[1] - 0.2, e[2] + dir[2] * 0.5, 8, { life: 0.5, size: 0.06, r: 0.8, g: 0.6, b: 0.3, grav: 10, spread: 2, up: 1 });
  lastHudKey = ''; startSwing(true);
}
function placeBlock(h, s) {
  if (!h) return;
  const x = h.px, y = h.py, z = h.pz, cur = getB(x, y, z);
  if (cur !== 0 && cur !== B.WATER && BLK[cur].render !== 'cross') return;
  const d = BLK[s.id];
  if (d.solid) {
    if (x + 1 > Player.x - Player.hw && x < Player.x + Player.hw && z + 1 > Player.z - Player.hw && z < Player.z + Player.hw && y + 1 > Player.y && y < Player.y + Player.h) return;
    for (const m of Mobs) if (x + 1 > m.x - m.hw && x < m.x + m.hw && z + 1 > m.z - m.hw && z < m.z + m.hw && y + 1 > m.y && y < m.y + m.h) return;
  }
  if (d.render === 'cross' && !SOLID[getB(x, y - 1, z)]) return;
  // facing: toward the player
  const dx = Player.x - (x + 0.5), dz = Player.z - (z + 0.5);
  let meta = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
  if (d.render === 'ladder') { // attach to the wall that was clicked; ladders can't go on floors or ceilings
    const WALL = { 1: 3, 0: 1, 5: 0, 4: 2 }; // ray step direction -> wall side (meta: 0 +z, 1 -x, 2 -z, 3 +x)
    if (!(h.face in WALL)) return;
    meta = WALL[h.face];
  }
  if (SHAPE[s.id]) { meta = SHAPE[s.id] === 2 ? (meta + 2) & 3 : 0; if (h.face === 3 || (h.face !== 2 && h.hy !== undefined && h.hy - y > 0.5)) meta |= 4; } // stairs rise away from you; against a ceiling they go upside down
  setBlockLogged(x, y, z, s.id, meta);
  if (s.id === B.CHEST || s.id === B.BARREL || s.id === B.CRATE) Chests.set(K(x, y, z), { table: 'house', items: new Array(s.id === B.BARREL ? 36 : s.id === B.CRATE ? 18 : 27).fill(null), made: true });
  Sound.place(s.id); Quests.event('place', s.id);
  if (Game.mode !== 'creative') { s.n--; if (!s.n) Inv.slots[Game.sel] = null; }
  lastHudKey = ''; startSwing(true);
}
function interact(h) {
  const k = K(h.x, h.y, h.z);
  switch (h.id) {
    case B.CHEST: {
      const c = Chests.get(k) || (Chests.set(k, { table: 'house', items: null }), Chests.get(k));
      Sound.chest();
      if (!c.items) { Quests.event('loot'); c.items = new Array(27).fill(null); const loot = rollLoot(c.table); let i = 0; for (const it of loot) { const slot = Math.floor(Math.random() * 27); let j = slot; while (c.items[j]) j = (j + 1) % 27; c.items[j] = { id: it.id, n: it.n }; i++; } if (c.treasure) claimTreasure(c, h); }
      openInventory(k); return true;
    }
    case B.TABLET: case B.RUNEPILLAR: { const l = Lore.get(k); if (l) { openLore(l); Quests.event('lore'); if (!l.read) { l.read = true; } return true; } return h.id === B.TABLET; }
    case B.WAYSTONE: {
      Game.spawn = [h.x + 1.5, h.y + (getB(h.x, h.y - 1, h.z) === B.WAYSTONE ? 0 : 1), h.z + 0.5];
      if (getB(h.x, h.y - 1, h.z) === B.WAYSTONE) Game.spawn[1] = h.y;
      const sy = surfaceY(h.x + 1, h.z); Game.spawn = [h.x + 1.5, sy + 1, h.z + 0.5];
      toast('Attuned — you will return here if you fall.', 3000); Quests.event('attune'); Sound.discover();
      burst(h.x + 0.5, h.y + 1, h.z + 0.5, 30, { life: 1, size: 0.1, r: 0.4, g: 0.95, b: 1, glow: true, spread: 3, up: 4 });
      saveGame(); return true;
    }
    case B.ALTAR: {
      if (!Game.halls || !Game.halls.seal) return true;
      if (takeItem(I.key, 1)) {
        for (const p of Game.halls.seal) { setBlockLogged(p[0], p[1], p[2], B.AIR); burst(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5, 12, { life: 0.8, size: 0.12, r: 0.6, g: 0.4, b: 1, glow: true, spread: 3 }); }
        bossBanner('The Seal is Broken', 'Something vast stirs in the deep'); shake(0.6); Quests.event('seal');
      } else toast('The Seal of the Deep is locked. The Mirewarden carries the key.', 3500);
      return true;
    }
    case B.TABLE: openInventory(); return true;
    case B.ENCHANT_TABLE: openEnchant(h); return true;
    case B.BARREL: case B.CRATE: {
      const c = Chests.get(k) || (Chests.set(k, { table: h.id === B.BARREL ? 'barrel' : 'crate', items: null }), Chests.get(k));
      Sound.chest();
      if (!c.items) { const n = h.id === B.BARREL ? 36 : 18; c.items = new Array(n).fill(null); for (const it of rollLoot(c.table).slice(0, n)) { let j = Math.floor(Math.random() * n); while (c.items[j]) j = (j + 1) % n; c.items[j] = { id: it.id, n: it.n }; } }
      openInventory(k); return true;
    }
    case B.FURNACE: toastOnce('furn', 'The forge is warm. Craft at a nearby crafting table.'); return false;
  }
  return false;
}

// ---------------------------------------------------------------- damage & survival
function hurtPlayer(dmg, type, kx, kz, cause) {
  if (!Player.alive || Game.state !== 'play' || Game.mode === 'creative' || Game.mode === 'parkour') return;
  if (type === 'burn' && (hasRelic('fire') || fullSet() === 'warden')) type = null;
  if (type === 'burn' && Effects.lvl('fireres')) return;
  if (Player.inv > 0) return;
  const real = dmg * (1 - armorReduction()) * (1 - Math.min(0.6, armorEnch('protection') * 0.04));
  Player.hp -= real; Player.inv = 0.5; Sound.hurt();
  if (cause) Player.lastCause = { c: cause, t: performance.now() };
  if (cause && cause.mob) Player.lastMobHit = { mob: cause.mob, t: performance.now() };
  if (type === 'burn') { Player.burn = 3; Player.burnSrc = cause && cause.mob ? { mob: cause.mob, how: 'burn' } : 'fire'; }
  if ((kx || kz) && fullSet() !== 'warden') { Player.vx += kx * 6; Player.vz += kz * 6; Player.vy = Math.max(Player.vy, 5); }
  $('vignette').style.opacity = 1; setTimeout(() => { $('vignette').style.opacity = 0; }, 180);
  shake(0.25); lastHudKey = '';
  if (Player.hp <= 0) die(cause);
}
const DEATH_MSG = ['The world keeps turning without you.', 'Even legends rest sometimes.', 'The shards remember your name.', 'Get up. The Colossus is still sleeping.'];
// ---- what killed you: the death screen names the creature or the hazard
const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const mobLabel = m => m.def.boss ? m.def.name : an(m.def.name);
function deathText(cause) {
  const last = Player.lastCause, recentMob = Player.lastMobHit && performance.now() - Player.lastMobHit.t < 7000 ? Player.lastMobHit.mob : null;
  if (!cause && last && performance.now() - last.t < 1500) cause = last.c;
  if (cause && typeof cause === 'object' && cause.mob) {
    const who = mobLabel(cause.mob);
    switch (cause.how) {
      case 'arrow': case 'dart': return ['Shot', 'Shot by ' + who];
      case 'bolt': case 'orb': return ['Struck down', 'Blasted by ' + who];
      case 'fire': return ['Burned', 'Fireballed by ' + who];
      case 'burn': return ['Burned', 'Burned to death by ' + who];
      case 'potion': return ['Poisoned', 'Killed by ' + who + "'s potion"];
      case 'poison': return ['Poisoned', 'Poisoned by ' + who];
      case 'boom': return ['Blown Up', 'Blown up by ' + who];
      case 'shockwave': return ['Crushed', 'Knocked down by ' + who + "'s shockwave"];
      case 'spikes': return ['Impaled', 'Impaled by ' + who + "'s crystal spikes"];
      default: return [cause.mob.def.boss ? 'Defeated' : 'Slain', (cause.mob.def.boss ? 'Defeated by ' : 'Slain by ') + who];
    }
  }
  switch (cause) {
    case 'fall': return recentMob ? ['You Fell', 'Knocked off a ledge by ' + mobLabel(recentMob)] : ['You Fell', 'Fell from a high place'];
    case 'void': return ['Lost', 'Fell out of the world'];
    case 'lava': return ['Burned', 'Tried to swim in lava'];
    case 'fire': return ['Burned', 'Burned to death'];
    case 'poison': return ['Poisoned', 'Succumbed to poison'];
    case 'cactus': return ['Pricked', 'Pricked to death by a cactus'];
    case 'spikes': return ['Impaled', 'Walked into a spike trap'];
    case 'pearl': return ['Lost', 'Landed badly after a Hollow Pearl teleport'];
  }
  return ['You Died', 'Your adventure ends here, for now'];
}
function die(cause) {
  if (Run.on) endRun();
  const [title, line] = deathText(cause);
  $('deathTitle').textContent = title; $('deathCause').textContent = line;
  Effects.clear();
  Player.alive = false; Player.hp = 0; Stats.deaths++; Player.lastCause = Player.lastMobHit = null; Player.poisonSrc = Player.burnSrc = null;
  if (ActiveBoss) { removeMob(ActiveBoss); ActiveBoss = null; }
  for (const m of Mobs.slice()) if (m.type === 'knight' && !m.spawn) removeMob(m);
  $('deathMsg').textContent = DEATH_MSG[Math.floor(Math.random() * DEATH_MSG.length)];
  $('death').classList.remove('hidden');
  Game.ui = 'death';
  document.exitPointerLock && document.exitPointerLock();
}
function respawn(silent) {
  $('death').classList.add('hidden');
  Object.assign(Player, { x: Game.spawn[0], y: Game.spawn[1], z: Game.spawn[2], vx: 0, vy: 0, vz: 0, hp: maxHealth(), food: Math.max(Player.food, 14), alive: true, burn: 0, poison: 0, inv: 1.5 });
  Game.ui = null; lastHudKey = '';
  if (!silent) lockPointer();
}
function updateSurvival(dt) {
  const P = Player;
  if (P.inv > 0) P.inv -= dt;
  if (P.burn > 0) { P.burn -= dt; if (Math.random() < dt * 20) emit(P.x + (Math.random() - 0.5) * 0.6, P.y + Math.random() * 1.6, P.z + (Math.random() - 0.5) * 0.6, { vy: 1.5, life: 0.5, size: 0.08, r: 1, g: 0.5, b: 0.1, glow: true }); P.burnTick = (P.burnTick || 0) - dt; if (P.burnTick <= 0) { P.burnTick = 1; const i = P.inv; P.inv = 0; hurtPlayer(1, null, 0, 0, P.burnSrc || 'fire'); P.inv = i; } }
  if (P.poison > 0) { P.poison -= dt; P.poisonT = (P.poisonT || 0) - dt; if (Math.random() < dt * 10) emit(P.x + (Math.random() - 0.5) * 0.6, P.y + Math.random() * 1.6, P.z + (Math.random() - 0.5) * 0.6, { vy: 0.6, life: 0.6, size: 0.07, r: 0.4, g: 0.8, b: 0.2, glow: true }); if (P.poisonT <= 0) { P.poisonT = 1.2; if (P.hp > 2) { const i = P.inv; P.inv = 0; hurtPlayer(1, null, 0, 0, P.poisonSrc || 'poison'); P.inv = i; } } }
  const hz = touching(P.x, P.y, P.z, P.hw, P.h, HURT);
  if (hz) { const lava = touching(P.x, P.y, P.z, P.hw, P.h, IS_LAVA); if (lava) hurtPlayer(4, 'burn', 0, 0, 'lava'); else hurtPlayer(hz, getB(Math.floor(P.x), Math.floor(P.y), Math.floor(P.z)) === B.FIRE ? 'burn' : null, 0, 0, touching(P.x, P.y, P.z, P.hw, P.h, IS_FIRE) ? 'fire' : getB(Math.floor(P.x), Math.floor(P.y - 0.1), Math.floor(P.z)) === B.CACTUS || touching(P.x, P.y, P.z, P.hw + 0.05, P.h, IS_CACTUS) ? 'cactus' : 'spikes'); }
  if (Settings.hunger && Game.mode !== 'parkour') {
    P.foodT += dt * (P.sprinting ? 3 : 1) * Perk.hungerMul() * (hasRelic('hunger') ? 0.6 : 1);
    if (P.foodT > 30) { P.foodT = 0; P.food = Math.max(0, P.food - 1); lastHudKey = ''; }
    if (P.food >= 16 && P.hp < maxHealth()) { P.regenT += dt; if (P.regenT > 3) { P.regenT = 0; P.hp = Math.min(maxHealth(), P.hp + 1); lastHudKey = ''; } }
    if (P.food <= 0) { P.starveT += dt; if (P.starveT > 4) { P.starveT = 0; if (P.hp > 1) { P.hp -= 1; lastHudKey = ''; } } }
  } else if (P.hp < maxHealth()) { P.regenT += dt; if (P.regenT > 2.5) { P.regenT = 0; P.hp = Math.min(maxHealth(), P.hp + 1); lastHudKey = ''; } }
  if (hasRelic('heart') && P.hp < maxHealth()) { P.hp = Math.min(maxHealth(), P.hp + dt * 0.25); }
}
const IS_LAVA = new Uint8Array(256); IS_LAVA[B.LAVA] = 1;
const IS_FIRE = new Uint8Array(256); IS_FIRE[B.FIRE] = 1;
const IS_CACTUS = new Uint8Array(256); IS_CACTUS[B.CACTUS] = 1;
function isMoving() { return Input.keys.KeyW || Input.keys.KeyA || Input.keys.KeyS || Input.keys.KeyD; }

// ---------------------------------------------------------------- parkour run (the Skyward Spiral)
const Run = { on: false, armed: false, t: 0, cp: 0, falls: 0, hudT: 0, txt: '' };
function padUnderPlayer() {
  const P = Player, y = Math.floor(P.y - 0.08), h = P.hw - 0.02;
  for (const [ox, oz] of [[0, 0], [-h, -h], [h, -h], [-h, h], [h, h]]) { const info = Course.pads.get(K(Math.floor(P.x + ox), y, Math.floor(P.z + oz))); if (info) return info; }
  return null;
}
const fmtRun = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
function runBest() { try { return +localStorage.getItem('bh_spiral_' + Game.seedName) || 0; } catch (e) { return 0; } }
function endRun(msg) { if (msg) toast(msg, 2400); Run.on = false; Run.armed = false; renderRun(); }
function renderRun() {
  const el = $('pkHud'); if (!el) return;
  const txt = Run.on ? '<b>⏱ ' + fmtRun(Run.t) + '</b><span>⚑ ' + Run.cp + ' / ' + (Course.cps.length - 1) + '</span><span>↓ ' + Run.falls + '</span>' : '';
  if (txt === Run.txt) return; Run.txt = txt;
  el.innerHTML = txt; el.classList.toggle('hidden', !Run.on);
}
function parkourYaw() { const a = Course.path[0], b = Course.path[1]; return a && b ? Math.atan2(-(b[0] - a[0]), -(b[2] - a[2])) : 0; }
function restartParkour() {
  if (!Course.cps.length) return;
  const c = Course.cps[0], P = Player;
  Object.assign(P, { x: c[0], y: c[1], z: c[2], vx: 0, vy: 0, vz: 0, yaw: parkourYaw(), pitch: 0, flying: false });
  Run.on = false; Run.armed = false; renderRun(); Sound.teleport(); toast('Back at the start. Jump off the green block to begin.', 2000);
}
function catchFall() {
  const P = Player, c = Course.cps[Run.cp];
  P.x = c[0]; P.y = c[1]; P.z = c[2]; P.vx = P.vy = P.vz = 0; P.burn = 0;
  Run.falls++; Sound.teleport();
  burst(P.x, P.y + 0.6, P.z, 20, { life: 0.8, size: 0.08, r: 1, g: 0.85, b: 0.3, glow: true, spread: 2, up: 2 });
  toast(Run.cp ? 'Caught! Back to checkpoint ' + Run.cp + '.' : 'Caught! Back to the start.', 1500);
}
function updateParkour(dt) {
  const P = Player;
  if (!Course.cps.length || !P.alive) { if (Run.on) endRun(); return; }
  const pad = P.onGround ? padUnderPlayer() : null;
  if (!Run.on) {
    if (pad && pad.start && !P.flying) Run.armed = true;
    else if (Run.armed && (!pad || !pad.start)) {
      Run.armed = false;
      if (!P.onGround || pad) { Object.assign(Run, { on: true, t: 0, cp: 0, falls: 0 }); Sound.ui(); toast('Go! Climb the Skyward Spiral.', 1600); }
    }
    renderRun(); return;
  }
  Run.t += dt;
  if (P.flying) return endRun('Run cancelled: no flying on the Spiral.');
  if (Math.hypot(P.x - Course.cx - 0.5, P.z - Course.cz - 0.5) > Course.r + 10) return endRun('You left the Skyward Spiral. Run cancelled.');
  if (pad) {
    if (pad.finish) {
      const t = Run.t, best = runBest(), rec = !best || t < best;
      if (rec) try { localStorage.setItem('bh_spiral_' + Game.seedName, t.toFixed(2)); } catch (e) { /* private mode */ }
      bossBanner('Skyward Spiral complete!', 'Time ' + fmtRun(t) + ' · ' + Run.falls + (Run.falls === 1 ? ' fall' : ' falls') + (rec ? ' · New best time!' : ' · Best ' + fmtRun(best)));
      $('banner').classList.add('questb'); Sound.quest();
      for (let i = 0; i < 4; i++) burst(P.x + (Math.random() - 0.5) * 4, P.y + 1 + Math.random() * 2, P.z + (Math.random() - 0.5) * 4, 30, { life: 1.4, size: 0.1, r: Math.random(), g: 0.6 + Math.random() * 0.4, b: Math.random(), glow: true, spread: 4, up: 5 });
      return endRun();
    }
    if (pad.cp > Run.cp) {
      Run.cp = pad.cp; Sound.discover();
      toast('Checkpoint ' + Run.cp + ' / ' + (Course.cps.length - 1) + ' · ' + fmtRun(Run.t), 1800);
      burst(P.x, P.y + 0.3, P.z, 24, { life: 1, size: 0.09, r: 1, g: 0.8, b: 0.25, glow: true, spread: 2.5, up: 3 });
    }
  } else if (P.onGround && !P.inWater && !touching(P.x, P.y, P.z, P.hw + 0.05, P.h, CLIMB)) {
    if (Run.cp === 0) return endRun(Run.t > 3 ? 'Back on the ground. Step on the green block to try again.' : '');
    catchFall();
  }
  if (!P.onGround && P.y < Course.cps[Run.cp][1] - 6) catchFall();
  Run.hudT -= dt; if (Run.hudT <= 0) { Run.hudT = 0.1; renderRun(); }
}

// ---------------------------------------------------------------- player physics
function updatePlayer(dt) {
  const P = Player, K = Input.keys, creative = Game.mode === 'creative';
  const feet = getB(Math.floor(P.x), Math.floor(P.y + 0.3), Math.floor(P.z));
  const inWater = !P.flying && (feet === B.WATER || getB(Math.floor(P.x), Math.floor(P.y + 1), Math.floor(P.z)) === B.WATER);
  const headWater = getB(Math.floor(P.x), Math.floor(P.y + 1.62), Math.floor(P.z)) === B.WATER;
  const climbing = !P.flying && touching(P.x, P.y, P.z, P.hw + 0.05, P.h, CLIMB) > 0;
  P.sneak = !!K.KeyC && !P.flying;
  let f = 0, s = 0;
  if (!Game.ui && P.alive) { if (K.KeyW) f += 1; if (K.KeyS) f -= 1; if (K.KeyD) s += 1; if (K.KeyA) s -= 1; }
  const len = Math.hypot(f, s) || 1; f /= len; s /= len;
  // sticky sprint (Minecraft style): tap Shift/Ctrl or double-tap W; it lasts while you keep moving forward,
  // so Space works even on systems where Ctrl+Space is a keyboard shortcut
  const canSprint = f > 0 && !P.sneak && (creative || !Settings.hunger || P.food > 6) && !drawing;
  if ((K.ShiftLeft && !P.flying) || K.ShiftRight || K.ControlLeft || K.ControlRight || P.wTap) { if (canSprint) P.sprinting = true; }
  if (!canSprint || (P.wallHit && P.onGround && Math.hypot(P.vx, P.vz) < 1)) P.sprinting = false;
  let speed = P.sneak ? 1.6 : P.sprinting ? 6.4 : 4.3;
  if (P.flying) speed = P.sprinting ? 19 : 10.5;
  if (inWater) speed *= 0.55;
  if (Game.peaceful && !creative && Game.mode !== 'parkour') speed *= 2;
  if (drawing) speed *= 0.45;
  speed *= Perk.speedMul() * (1 + 0.3 * Effects.lvl('swift')) * (hasRelic('swift') ? 1.15 : 1) * (inWater && hasRelic('swim') ? 2 : 1);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const tx = (fx * f + rx * s) * speed, tz = (fz * f + rz * s) * speed;
  const k = Math.min(1, dt * (P.flying ? 6 : P.onGround ? 14 : inWater ? 5 : 3.5));
  P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
  if (P.flying) {
    const up = (K.Space && !Game.ui ? 1 : 0) - (K.ShiftLeft && !Game.ui ? 1 : 0);
    P.vy += (up * 8 - P.vy) * Math.min(1, dt * 8);
  }
  else if (climbing) { P.vy = K.Space || (f > 0 && (P.hitX || P.hitZ)) ? 3.6 : P.sneak ? 0 : Math.max(P.vy - 28 * dt, -2.2); }
  else if (inWater) {
    P.vy -= 9 * dt; P.vy = Math.max(P.vy, -3.2);
    if (K.Space && !Game.ui) {
      P.vy = Math.min(P.vy + 26 * dt, 3.6);
      // swimming into a bank (or a block edge at the surface) lets you climb out, like jumping out of water
      if (P.wallHit && (!headWater || f !== 0)) P.vy = Math.max(P.vy, 7.4);
      else if (!headWater && P.onGround) P.vy = Math.max(P.vy, 6.5);
    }
  }
  else {
    P.vy -= 28 * dt;
    if (K.Space && P.onGround && !Game.ui && P.alive) {
      P.vy = 8.6 + 2.6 * Effects.lvl('leap');
      if (P.sprinting) { P.vx += fx * 1.6; P.vz += fz * 1.6; } // sprint-jump boost
    }
  }
  P.vy = Math.max(P.vy, -45);
  const wasGround = P.onGround, vyBefore = P.vy, wasWater = P.inWater;
  // sneaking keeps you from walking off edges
  if (P.sneak && P.onGround) {
    if (!collides(P.x + P.vx * dt, P.y - 0.1, P.z, P.hw, 0.1)) P.vx = 0;
    if (!collides(P.x, P.y - 0.1, P.z + P.vz * dt, P.hw, 0.1)) P.vz = 0;
  }
  const ox = P.x, oz = P.z;
  moveBody(P, dt);
  P.wallHit = P.hitX || P.hitZ;
  P.inWater = inWater;
  if (P.flying && P.onGround && vyBefore < -0.5) P.flying = false; // land to stop flying
  if (P.onGround && !wasGround && vyBefore < -15 - 4 * Effects.lvl('leap') && !inWater && !climbing && !creative && !hasRelic('fall') && !Run.on) hurtPlayer((-vyBefore - 15 - 4 * Effects.lvl('leap')) * 0.9 * (1 - Math.min(0.8, 0.12 * enchOf(Inv.armor[3], 'feather'))), 0, 0, 'fall');
  if (inWater && !wasWater && vyBefore < -6) { Sound.splash(); burst(P.x, P.y + 0.8, P.z, 18, { life: 0.7, size: 0.08, r: 0.7, g: 0.85, b: 1, grav: 12, spread: 3, up: 4 }); }
  if (P.y < -10) { if (creative) { P.y = surfaceY(Math.floor(P.x), Math.floor(P.z)) + 2; P.vy = 0; } else { P.hp = 0; die('void'); } }
  // walking: quest progress + footsteps
  const moved = Math.hypot(P.x - ox, P.z - oz);
  if (P.onGround && moved > 0.001) {
    P.walkAcc = (P.walkAcc || 0) + moved; P.stepAcc = (P.stepAcc || 0) + moved;
    if (P.walkAcc >= 1) { Quests.event('walk', null, Math.floor(P.walkAcc)); P.walkAcc %= 1; }
    if (P.stepAcc > (P.sprinting ? 2.1 : 1.7)) { P.stepAcc = 0; const id = getB(Math.floor(P.x), Math.floor(P.y - 0.5), Math.floor(P.z)); if (id) Sound.step(id); }
  }
  // underwater visuals
  U.uUnder.value = headWater ? 1 : 0;
  $('underwater').style.opacity = headWater ? 1 : 0;
  if (P.onGround && Math.hypot(P.vx, P.vz) > 5 && Math.random() < dt * 8) { const id = getB(Math.floor(P.x), Math.floor(P.y - 0.5), Math.floor(P.z)); if (id) blockBurst(P.x - 0.5, P.y - 0.9, P.z - 0.5, id, 1); }
}

// ---------------------------------------------------------------- world events
let discT = 0, zoneCheckT = 0;
function ambientEmitters(dt, P) {
  for (const e of Emitters) {
    const d = Math.hypot(e.x - P.x, e.z - P.z); if (d > 48) continue;
    if (e.type === 'smoke' && Math.random() < dt * 6) emit(e.x + (Math.random() - 0.5) * 0.3, e.y, e.z + (Math.random() - 0.5) * 0.3, { vy: 1.2 + Math.random() * 0.4, vx: 0.3 + Math.random() * 0.2, life: 3, size: 0.25, grow: 2.5, r: 0.55, g: 0.55, b: 0.58, a: 0.55 });
    else if (e.type === 'splash' && Math.random() < dt * 12) emit(e.x, e.y, e.z, { vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random(), vz: (Math.random() - 0.5) * 2, grav: 10, life: 0.8, size: 0.07, r: 0.6, g: 0.8, b: 1, a: 0.8 });
    else if (e.type === 'rune' && Math.random() < dt * 5) emit(e.x + (Math.random() - 0.5), e.y - 1 + Math.random() * 2, e.z + (Math.random() - 0.5), { vy: 0.6, life: 1.5, size: 0.07, r: 0.4, g: 0.95, b: 1, glow: true });
    else if (e.type === 'sparkle' && Math.random() < dt * 10) emit(e.x + (Math.random() - 0.5) * 3, e.y + (Math.random() - 0.5) * 6, e.z + (Math.random() - 0.5) * 3, { vy: -0.4, life: 1.2, size: 0.09, r: 0.7, g: 1, b: 1, glow: true });
    else if (e.type === 'ember' && Math.random() < dt * 8) emit(e.x + (Math.random() - 0.5), e.y, e.z + (Math.random() - 0.5), { vy: 1.5, life: 1.2, size: 0.08, r: 1, g: 0.5, b: 0.1, glow: true });
    else if (e.type === 'bubble' && Math.random() < dt * 6) emit(e.x + (Math.random() - 0.5) * 0.5, e.y, e.z + (Math.random() - 0.5) * 0.5, { vy: 0.8, life: 0.8, size: 0.1, r: 0.5, g: 1, b: 0.4, glow: true });
  }}
function updateWorldEvents(dt) {
  const P = Player;
  discT -= dt;
  if (discT <= 0) {
    discT = 0.4;
    for (const s of Sites) if (!s.found && Math.hypot(s.x - P.x, s.z - P.z) < s.r && Math.abs(P.y - s.y) < 30) { s.found = true; startCinematic(s); Sound.discover(); Quests.event('discover', s); saveGame(); if (Game.follow === s) Game.follow = null; break; }
    const bi = bmap[COL(Math.floor(P.x), Math.floor(P.z))];
    if (bi !== Game.zone) { Game.zoneT += 0.4; if (Game.zoneT > 1.2) { Game.zone = bi; Game.zoneT = 0; if (!Game.cine && !(Game.seenBiomes || (Game.seenBiomes = new Set())).has(bi)) { Game.seenBiomes.add(bi); zoneBanner(BIOMES[bi].name, BIOMES[bi].lore); } } } else Game.zoneT = 0;
  }
  for (const r of BossRooms) if (!r.done && !ActiveBoss && Math.hypot(r.x - P.x, r.z - P.z) < r.r - 3 && Math.abs(P.y - r.y) < 5) startBoss(r);
  if (ActiveBoss && (Math.hypot(ActiveBoss.room.x - P.x, ActiveBoss.room.z - P.z) > ActiveBoss.room.r + 25 || Math.abs(P.y - ActiveBoss.room.y) > 14)) { removeMob(ActiveBoss); ActiveBoss = null; toast('You fled. The guardian returns to its slumber.', 3000); }
  for (const p of Portals) if (Math.abs(P.x - (p.x + 0.5)) < 1.6 && Math.abs(P.z - (p.z + 0.5)) < 0.9 && Math.abs(P.y - p.y) < 2) { P.x = p.to[0]; P.y = surfaceY(Math.floor(p.to[0]), Math.floor(p.to[2])) + 1.2; P.z = p.to[2]; P.vy = 0; bossBanner('Back to the surface', 'The night air is cool'); burst(P.x, P.y + 1, P.z, 40, { life: 1, size: 0.12, r: 0.7, g: 0.95, b: 1, glow: true, spread: 4, up: 4 }); }
  ambientEmitters(dt, P);

  // biome ambience: fireflies, spores, ash, dust
  const bi = Game.zone, night = U.uDay.value < 0.5;
  if (Math.random() < dt * 25) {
    const x = P.x + (Math.random() - 0.5) * 30, z = P.z + (Math.random() - 0.5) * 30, gy = surfaceY(Math.floor(x), Math.floor(z));
    if ((bi === 1 || bi === 2 || bi === 0) && night) emit(x, gy + 1 + Math.random() * 3, z, { vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.6, life: 4, size: 0.06, r: bi === 2 ? 0.5 : 0.9, g: 1, b: bi === 2 ? 0.8 : 0.4, glow: true });
    else if (bi === 1 && !night) emit(x, gy + 1 + Math.random() * 5, z, { vx: 0.2, vy: -0.1, life: 5, size: 0.04, r: 1, g: 1, b: 0.85, a: 0.7 });
    else if (bi === 5) emit(x, gy + 1 + Math.random() * 8, z, { vx: 0.4, vy: Math.random() < 0.3 ? 1 : -0.4, life: 4, size: 0.05, r: Math.random() < 0.3 ? 1 : 0.35, g: Math.random() < 0.3 ? 0.5 : 0.32, b: 0.3, glow: Math.random() < 0.3 });
    else if (bi === 3 && !night) emit(x, gy + 0.5 + Math.random() * 2, z, { vx: 1.5, vy: 0, life: 3, size: 0.04, r: 0.95, g: 0.85, b: 0.6, a: 0.5 });
    else if (bi === 4 && night) emit(x, gy + 1 + Math.random() * 4, z, { vy: 0.3, life: 3, size: 0.05, r: 0.6, g: 1, b: 1, glow: true });
  }
  // lava pops
  if (Math.random() < dt * 4) { const x = Math.floor(P.x + (Math.random() - 0.5) * 30), z = Math.floor(P.z + (Math.random() - 0.5) * 30); const y = surfaceY(x, z); if (getB(x, y, z) === B.LAVA) burst(x + 0.5, y + 1, z + 0.5, 4, { life: 0.8, size: 0.08, r: 1, g: 0.6, b: 0.1, glow: true, grav: 12, spread: 1.5, up: 4 }); }
}

// ---------------------------------------------------------------- sky & atmosphere
const fogCur = { c: new THREE.Color(0xbfd8ee), near: 60, far: 150 };
// sky palette (display colours): clear blue days, orange-and-violet sunsets, deep navy nights
const SKYC = { dayZen: new THREE.Color(0x3a70d2), dayHor: new THREE.Color(0xa6c7ef), duskZen: new THREE.Color(0x40508e), duskHor: new THREE.Color(0xf29a5e),
  nightZen: new THREE.Color(0x03050c), nightHor: new THREE.Color(0x0c1324), cloudDay: new THREE.Color(1.02, 1.02, 1.0), cloudDayS: new THREE.Color(0.7, 0.76, 0.86),
  cloudDusk: new THREE.Color(1.0, 0.66, 0.44), cloudDuskS: new THREE.Color(0.48, 0.4, 0.5), cloudNight: new THREE.Color(0.12, 0.14, 0.2), cloudNightS: new THREE.Color(0.06, 0.07, 0.11) };
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _rayCol = new THREE.Color();
function updateSky(dt) {
  Game.time = (Game.time + dt / 600) % 1; Game.day += dt / 600;
  const sunH = Math.sin((Game.time - 0.25) * Math.PI * 2);
  const day = clamp(sunH * 2.2 + 0.45, 0.2, 1);
  U.uDay.value = day; U.uTime.value += dt;
  const bi = Game.zone >= 0 ? Game.zone : 0, bio = BIOMES[bi];
  const k = Math.min(1, dt * 0.6);
  fogCur.c.lerp(_c1.set(bio.fog), k); fogCur.near += (bio.fogNear * Settings.view - fogCur.near) * k; fogCur.far += (bio.fogFar * Settings.view - fogCur.far) * k;
  const dn = clamp((day - 0.2) / 0.8, 0, 1);
  const sunset = clamp(1 - Math.abs(sunH) * 4.2, 0, 1);
  // the horizon leans toward the biome's air (greener in the marsh, ruddy over the Ashlands)
  const airW = [0.25, 0.3, 0.55, 0.3, 0.25, 0.75][bi];
  const horizon = SKYC.nightHor.clone().lerp(_c1.copy(SKYC.dayHor).lerp(fogCur.c, airW), dn).lerp(SKYC.duskHor, sunset * 0.5);
  const top = SKYC.nightZen.clone().lerp(_c2.copy(SKYC.dayZen).lerp(fogCur.c, airW * airW * 0.8), dn).lerp(SKYC.duskZen, sunset * 0.45);
  skyMat.uniforms.uZenith.value.copy(top); skyMat.uniforms.uHorizon.value.copy(horizon);
  U.uSkyTop.value.copy(top); U.uSkyHor.value.copy(horizon);
  const ang = (Game.time - 0.25) * Math.PI * 2;
  const sunDir = skyMat.uniforms.uSunDir.value.set(0, Math.sin(ang), -Math.cos(ang)).normalize();
  skyMat.uniforms.uMoonDir.value.copy(sunDir).negate();
  skyMat.uniforms.uDusk.value = sunset;
  skyMat.uniforms.uGlow.value.setRGB(1, 0.93 - sunset * 0.4, 0.8 - sunset * 0.55).multiplyScalar(clamp(sunH * 3 + 0.35, 0, 1) * (0.45 + sunset * 0.7));
  skyMat.uniforms.uMoonGlow.value = 1 - dn;
  // morning mist: rises around dawn, lingers in the marsh, burns off by midday
  const dawn = Math.max(0, 1 - Math.abs(Game.time - 0.27) / 0.09), wantMist = Settings.shaders ? Math.max(dawn * 1.2, bi === 2 ? 0.6 : 0, dn < 0.3 ? 0.25 : 0) : 0;
  U.uMist.value += (wantMist - U.uMist.value) * Math.min(1, dt * 0.3);
  if (U.uUnder.value > 0.5) U.uFogColor.value.setRGB(0.06, 0.18, 0.4).multiplyScalar(0.4 + 0.6 * dn);
  else U.uFogColor.value.copy(horizon);
  const farCap = (VIEW_CHUNKS - 0.9) * CS;
  U.uFogFar.value = Math.min(fogCur.far, farCap); U.uFogNear.value = Math.min(fogCur.near, U.uFogFar.value * 0.6);
  sky.position.copy(camera.position); celestial.position.copy(camera.position);
  celestial.rotation.x = ang;
  starMat.opacity = clamp(1 - dn * 1.6, 0, 1);
  setMoonPhase(Game.day);
  // clouds: lit from the sun (or moon), tinted at sunset, fading into the horizon
  updateClouds(camera.position, U.uTime.value);
  cloudMat.uniforms.uLit.value.copy(SKYC.cloudNight).lerp(SKYC.cloudDay, dn).lerp(SKYC.cloudDusk, sunset * 0.75);
  cloudMat.uniforms.uShade.value.copy(SKYC.cloudNightS).lerp(SKYC.cloudDayS, dn).lerp(SKYC.cloudDuskS, sunset * 0.75);
  cloudMat.uniforms.uFogCol.value.copy(horizon);
  cloudMat.uniforms.uSunDir.value.copy(sunH > -0.05 ? sunDir : skyMat.uniforms.uMoonDir.value);
  cloudMat.uniforms.uFar.value = 340 * Math.max(0.8, Settings.view);
  cloudGroup.visible = Settings.shaders || Settings.preset !== 'low';
  U.uCloudOn.value = Settings.shaders ? 1 : 0;
  auroraMat.uniforms.uAlpha.value += (((bi === 4 && dn < 0.3) ? 0.9 : 0) - auroraMat.uniforms.uAlpha.value) * k;
  aurora.position.set(camera.position.x, 0, camera.position.z);
  aurora.visible = auroraMat.uniforms.uAlpha.value > 0.01;
  U.uTorch.value.setRGB(1.0, 0.56 + 0.03 * Math.sin(U.uTime.value * 9), 0.24);
  // light direction + colours: golden hour at the horizon, cool moonlight at night
  const golden = _c1.setRGB(1.35, 0.64, 0.3), noon = _c2.setRGB(1.12, 1.04, 0.92), moon = new THREE.Color(0.12, 0.16, 0.3);
  if (sunH > -0.04) {
    U.uSunDir.value.copy(sunDir);
    U.uSunCol.value.copy(golden).lerp(noon, clamp(sunH / 0.45, 0, 1)).multiplyScalar(clamp((sunH + 0.04) / 0.14, 0, 1));
  } else {
    U.uSunDir.value.copy(sunDir).negate();
    U.uSunCol.value.copy(moon).multiplyScalar(clamp((-sunH - 0.04) / 0.2, 0, 1));
  }
  U.uAmbCol.value.setRGB(0.036, 0.05, 0.092).lerp(new THREE.Color(0.3, 0.38, 0.56), dn * dn).lerp(new THREE.Color(0.5, 0.4, 0.44), sunset * 0.35);
  U.uHazeCol.value.setRGB(1, 0.68, 0.38).multiplyScalar(sunset * 0.9 + dn * 0.12);
  if (Quests.has('nighteye') && Game.mode === 'survival') U.uAmbCol.value.add(new THREE.Color(0.05, 0.06, 0.09).multiplyScalar(1 - dn));
  if (Effects.lvl('night') || hasRelic('night')) U.uAmbCol.value.add(new THREE.Color(0.22, 0.24, 0.3).multiplyScalar(1 - dn * 0.7));
  Game.sunUp = clamp(sunH * 3, 0, 1) * (0.35 + sunset * 0.65);
  _rayCol.setRGB(1, 0.9 - sunset * 0.25, 0.72 - sunset * 0.35); Game.rayCol = _rayCol;
}

// ---------------------------------------------------------------- held item view model
// Classic first-person hand: an empty hand shows your arm reaching in from the lower right; anything held is drawn
// on its own, small, in the lower right, without the arm. The swing, the equip dip when you switch items and the
// walking bob follow the original game's arcs.
const handScene = new THREE.Scene(), handCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
const viewModel = new THREE.Group(); handScene.add(viewModel);
const handHemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9); handScene.add(handHemi);
const handSun = new THREE.DirectionalLight(0xffffff, 0.6); handSun.position.set(0.3, 1, 0.5); handScene.add(handSun);
window.addEventListener('resize', () => { handCam.aspect = window.innerWidth / window.innerHeight; handCam.updateProjectionMatrix(); });
// the arm: a sleeve and a hand, pivoting at the shoulder below the bottom-right corner
const armPivot = new THREE.Group(); viewModel.add(armPivot);
const armSkin = new THREE.MeshLambertMaterial({ map: skin('fparm', 0xd9a37c, { noise: 0.06, flat: true }) });
const armSleeve = new THREE.MeshLambertMaterial({ map: skin('fpsleeve', 0x3f5f9a, { accent: 0x2f4a7c, stripes: 1, noise: 0.08 }) });
const armCuff = new THREE.MeshLambertMaterial({ map: skin('fpcuff', 0x2c3f66, { noise: 0.05 }) });
const sleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.5), armSleeve); sleeveMesh.position.z = -0.25; armPivot.add(sleeveMesh);
const cuffMesh = new THREE.Mesh(new THREE.BoxGeometry(0.262, 0.262, 0.05), armCuff); cuffMesh.position.z = -0.5; armPivot.add(cuffMesh);
const foreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), armSkin); foreMesh.position.z = -0.64; armPivot.add(foreMesh);
const hand = new THREE.Group(); armPivot.add(hand); // kept for anything attached to the palm
const armParts = [armSkin, armSleeve, armCuff];
// held items: translation swing -> arm offset -> swing rotations -> display transform
const vmT = new THREE.Group(), vmArm = new THREE.Group(), vmR1 = new THREE.Group(), vmR2 = new THREE.Group(), vmR3 = new THREE.Group(), vmR4 = new THREE.Group(), vmDisp = new THREE.Group();
viewModel.add(vmT); vmT.add(vmArm); vmArm.add(vmR1); vmR1.add(vmR2); vmR2.add(vmR3); vmR3.add(vmR4); vmR4.add(vmDisp);
let viewId = -1, viewMesh = null, equip = 1, lastYaw = 0, lastPitch = 0;
const VM = { swayX: 0, swayY: 0, bobDist: 0, bob: 0 };
// resting poses (view space, metres; rotations in radians)
const HOLD = { item: { pos: [0.5, -0.25, -0.72], rot: [-0.2, 0.35, 1.0], scale: 0.5 }, block: { pos: [0.54, -0.27, -0.7], rot: [0.32, 0.78, 0], scale: 0.33 }, arm: { pos: [0.7, -0.6, -0.36], rot: [1.0, 0.45, -0.2] } };
const D2R = Math.PI / 180;
function updateViewModel(dt) {
  const s = heldItem(), id = s ? s.id : 0;
  if (id !== viewId) {
    if (viewMesh) vmDisp.remove(viewMesh);
    viewMesh = id ? itemMesh(id) : null; viewId = id; equip = 0;
    if (viewMesh) vmDisp.add(viewMesh);
  }
  equip = Math.min(1, equip + dt * 5);
  const eqDrop = (1 - equip) * (1 - equip) * -0.6;
  // swing: quick forward arc that eases back (loops while mining)
  const dur = 0.3;
  swingT = Math.min(1, swingT + dt / dur);
  if (Input.mouseL && Game.mine && swingT >= 1) swingT = 0;
  const p = swingT >= 1 ? 0 : swingT, sq = Math.sqrt(p);
  // walking bob: distance-driven, like the original
  const hs = Player.onGround && !Player.flying ? Math.hypot(Player.vx, Player.vz) : 0;
  VM.bobDist += hs * dt * 0.6; VM.bob += (Math.min(1, hs / 4.3) - VM.bob) * Math.min(1, dt * 8);
  const g = VM.bobDist * Math.PI, bh = VM.bob * 0.06;
  viewModel.position.set(Math.sin(g) * bh * 0.5, -Math.abs(Math.cos(g) * bh), 0);
  viewModel.rotation.set(Math.abs(Math.cos(g - 0.2) * bh) * 5 * D2R * 10, 0, Math.sin(g) * bh * 3 * D2R * 10);
  // the hand lags a touch behind fast mouse turns
  const dyaw = wrapA(Player.yaw - lastYaw), dpit = Player.pitch - lastPitch; lastYaw = Player.yaw; lastPitch = Player.pitch;
  VM.swayX += (Math.max(-0.08, Math.min(0.08, dyaw * 0.9)) - VM.swayX) * Math.min(1, dt * 12); VM.swayY += (Math.max(-0.06, Math.min(0.06, -dpit * 0.9)) - VM.swayY) * Math.min(1, dt * 12);
  // lighting: world light at the player's head, lantern-tinted
  const L = lightAt(Player.x, Player.y + 1.6, Player.z), sky = L[0] / 15, blk = L[1] / 15;
  const out = 0.22 + 0.78 * Math.pow(sky, 1.4), tor = Math.pow(blk, 2.2) * 1.2;
  for (const mt of armParts) mt.color.setRGB(out * 0.62 + tor * U.uTorch.value.r * 0.7, out * 0.62 + tor * U.uTorch.value.g * 0.7, out * 0.62 + tor * U.uTorch.value.b * 0.7);
  const lv = Math.max(out, tor);
  armPivot.visible = !viewMesh;
  vmT.visible = !!viewMesh;
  if (!viewMesh) {
    // empty hand: the arm swings in an arc toward the crosshair
    const f1 = -0.3 * Math.sin(sq * Math.PI), f2 = 0.4 * Math.sin(sq * Math.PI * 2), f3 = -0.4 * Math.sin(p * Math.PI);
    const A = HOLD.arm;
    armPivot.position.set(A.pos[0] + f1 + VM.swayX, A.pos[1] + f2 + eqDrop + VM.swayY, A.pos[2] + f3);
    const s4 = Math.sin(p * p * Math.PI), s5 = Math.sin(sq * Math.PI);
    armPivot.rotation.set(A.rot[0] - s5 * 0.55, A.rot[1] + s5 * 0.75, A.rot[2] - s4 * 0.35);
    return;
  }
  viewMesh.material.color.setScalar(Math.min(1.2, lv * 0.95 + 0.05));
  vmT.position.set(-0.4 * Math.sin(sq * Math.PI) * 0.7 + VM.swayX, 0.2 * Math.sin(sq * Math.PI * 2) * 0.7 + VM.swayY, -0.2 * Math.sin(p * Math.PI));
  const d = itemDef(id), H = id < 256 ? HOLD.block : HOLD.item;
  vmArm.position.set(H.pos[0], H.pos[1] + eqDrop, H.pos[2]);
  // the swing: the held thing chops forward and down toward the crosshair, then eases back
  const f = Math.sin(p * p * Math.PI), f1 = Math.sin(sq * Math.PI);
  vmR1.rotation.set(0, (45 - f * 20) * D2R, 0); vmR2.rotation.set(0, 0, -f1 * 20 * D2R); vmR3.rotation.set(-f1 * 70 * D2R, 0, 0); vmR4.rotation.set(0, -45 * D2R, 0);
  const pd = d.kind === 'bow' && drawing ? Math.min(1, bowDraw) : 0;
  vmDisp.position.set(-pd * 0.16, pd * 0.06, pd * 0.12); vmDisp.rotation.set(H.rot[0], H.rot[1] - pd * 0.5, H.rot[2] - pd * 0.9); vmDisp.scale.setScalar(H.scale);
  viewMesh.scale.setScalar(1); viewMesh.position.set(0, 0, 0); viewMesh.rotation.set(0, 0, 0);
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), fpsAcc = 0, fpsN = 0, autosave = 0;
function frame(now) {
  requestAnimationFrame(frame);
  sampleRefresh(now - last);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Game.hitStop > 0) { Game.hitStop -= dt; dt *= 0.08; }
  else if (Game.slowmo > 0) { Game.slowmo -= dt; dt *= 0.35; }
  autoPerformance(dt);
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (Game.state === 'title' && Tour.on) { updateTour(dt); return; }
  if (Game.state === 'title' && !Tour.on) { Intro.render(dt, canvasEl.clientWidth || 1, canvasEl.clientHeight || 1); return; }
  if (Game.state === 'title' || Game.state === 'loading') { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
  const playing = Game.state === 'play' && Player.alive && !Game.cine && Game.ui !== 'pause';
  if (Game.state === 'play' && Game.ui !== 'pause') {
    if (!Game.cine) updatePlayer(dt);
    updateMining(Game.cine ? 0 : dt);
    if (drawing) bowDraw += dt;
    staffCd -= dt;
    if (Input.mouseR && !drawing && !Game.ui && playing) { useRepeat -= dt; const s = heldItem(); if (useRepeat <= 0 && s && s.id < 256) { useRepeat = 0.22; placeBlock(targetBlock(5), s); } }
    updateSurvival(dt); Effects.tick(dt); updateParkour(dt);
    updateMobs(dt, Player); updateSpawning(dt, Player); updateTelegraphs(dt, Player);
    updateProjectiles(dt, Player); updateDrops(dt, Player); updateBolts(dt);
    updateWorldEvents(dt);
    Game.questT = (Game.questT || 0) - dt; if (Game.questT <= 0) { Game.questT = 0.25; Quests.tick(); }
    autosave += dt; if (autosave > 45) { autosave = 0; saveGame(); }
  }
  updateWindmills(dt);
  if (Game.state === 'play') {
    Game.envT = (Game.envT || 0) - dt;
    if (Game.envT <= 0) { // sample the surroundings for ambience (cheap, a few times per second)
      Game.envT = 0.5; let fire = 0, water = 0; const px = Math.floor(Player.x), py = Math.floor(Player.y), pz = Math.floor(Player.z);
      for (let i = 0; i < 40; i++) { const x = px + Math.floor(Math.random() * 13) - 6, y = py + Math.floor(Math.random() * 7) - 3, z = pz + Math.floor(Math.random() * 13) - 6, id = getB(x, y, z); if (id === B.FIRE || id === B.LAVA) fire++; if (id === B.WATER) water++; }
      Game.env = { fireNear: Math.min(1, fire / 3), waterNear: water > 2 };
    }
    const env = Game.env || {};
    Sound.update(dt, { day: U.uDay.value, playing: Game.ui !== 'pause' && Player.alive, height: Player.y, biome: Game.zone, under: U.uUnder.value > 0.5, fireNear: env.fireNear, waterNear: env.waterNear });
    // Hearthglow power-up: a soft warm light around you at night
    const glow = Quests.has('glow') && Game.mode === 'survival' ? clamp(1 - (U.uDay.value - 0.25) / 0.45, 0, 1) : 0;
    U.uPLight.value.set(Player.x, Player.y + 1.2, Player.z, glow);
    $('modeBadge').classList.toggle('hidden', Game.mode === 'survival');
    // the quest card steps aside while a discovery or a big banner is on screen
    $('quest').classList.toggle('away', !!Game.cine || ($('banner').classList.contains('show') && $('banner').classList.contains('discb')));
    if (Game.mode === 'parkour') $('modeBadge').textContent = 'PARKOUR · R TO RESTART';
    else if (Game.mode === 'creative') $('modeBadge').textContent = Player.flying ? 'CREATIVE · FLYING' : 'CREATIVE';
    $('statusbars').style.visibility = Game.mode !== 'survival' ? 'hidden' : 'visible';
  } else Sound.update(dt, { day: 1, playing: false, height: 30, biome: 0 });
  updateSky(dt);
  updateParticles(dt, U.uDay.value);
  updateDamageNumbers(dt);
  if (Game.state === 'play') streamTick(Math.max(1.5, 1000 / targetFps() * 0.3)); else flushDirty(2);
  // camera
  if (!updateCinematic(dt)) {
    const e = eye();
    // stepping onto a stair or slab eases the view up instead of jumping it
    Player.eyeOff = ((Player.eyeOff || 0) - (Player.stepUp || 0)) * Math.exp(-dt * 16); Player.stepUp = 0; e[1] += Player.eyeOff;
    // view bobbing: a gentle dip with each step and a slight sway
    const bg = VM.bobDist * Math.PI, bh = VM.bob * 0.06;
    camera.position.set(e[0], e[1] - Math.abs(Math.cos(bg) * bh) * 0.9, e[2]);
    camera.rotation.set(Player.pitch + Math.abs(Math.cos(bg - 0.2) * bh) * 0.04, Player.yaw, Math.sin(bg) * bh * 0.07);
    if (Game.view > 0 && Game.state === 'play') { // third person: pull the camera back (or around to the front), stopping at walls
      const d = lookDir(), dir = Game.view === 1 ? -1 : 1;
      if (Game.view === 1 && !solidAt(Math.floor(e[0]), Math.floor(e[1] + 0.6), Math.floor(e[2]))) e[1] += 0.45; // look over the shoulder
      let dist = 4.2;
      for (let t = 0.4; t <= 4.2; t += 0.15) if (solidAt(Math.floor(e[0] + d[0] * t * dir), Math.floor(e[1] + d[1] * t * dir), Math.floor(e[2] + d[2] * t * dir))) { dist = Math.max(0.4, t - 0.35); break; }
      camera.position.set(e[0] + d[0] * dist * dir, e[1] + d[1] * dist * dir, e[2] + d[2] * dist * dir);
      Game.tpClose = dist < 1.1; // too close to a wall: don't draw your own head into the lens
      if (Game.view === 2) camera.lookAt(e[0], e[1], e[2]);
    }
    if (shakeAmt > 0) { camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.3; camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.3; shakeAmt = Math.max(0, shakeAmt - dt * 2); }
    if (drawing) camera.fov = Settings.fov - Math.min(1, bowDraw) * 8; else camera.fov += (Settings.fov + (Player.sprinting && isMoving() ? 6 : 0) - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }
  viewModel.visible = !Game.cine && !Game.view;
  ThirdPerson.update(dt, Player, swingT);
  handCam.aspect = camera.aspect; handCam.updateProjectionMatrix();
  handHemi.color.copy(U.uAmbCol.value).multiplyScalar(1.6).addScalar(0.25); handSun.color.copy(U.uSunCol.value).multiplyScalar(0.7);
  updateViewModel(dt);
  // block outline
  const h = !Game.ui && !Game.cine && Game.state === 'play' ? targetBlock(5) : null;
  outline.visible = !!h; if (h) outline.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
  // name the useful blocks you're looking at, so a chest, a barrel and a table are never confused
  const LOOK = { [B.CHEST]: 'Chest · loot & storage', [B.BARREL]: 'Barrel · big storage', [B.CRATE]: 'Supply Crate', [B.TABLE]: 'Crafting Table', [B.ENCHANT_TABLE]: 'Enchanting Table', [B.WAYSTONE]: 'Waystone · attune', [B.TABLET]: 'Lore Tablet · read', [B.RUNEPILLAR]: 'Rune Obelisk', [B.ALTAR]: 'Seal of the Deep' };
  const ll = $('lookLabel'), lk = h && LOOK[h.id];
  if (lk) { if (ll.dataset.k !== lk) { ll.dataset.k = lk; ll.innerHTML = lk; } ll.classList.remove('hidden'); } else ll.classList.add('hidden');
  // HUD
  if (Game.state === 'play') {
    drawHUD(Player); drawBossBar(); drawTracker(Player);
    const ch = chargeLevel(), c = $('charge');
    c.style.opacity = (ch < 1 || drawing) ? 1 : 0;
    c.querySelector('i').style.width = ((drawing ? Math.min(1, bowDraw) : ch) * 100) + '%';
    if (Game.ui === 'wf' && Math.random() < 0.05) renderWayfinder();
  }
  renderWorld();
  if (Game.ui === 'inv' && !$('inv').classList.contains('boxmode')) CharView.render(dt);
}
const shadowCenter = new THREE.Vector3();
let shadowFrame = 0;
// ---------------------------------------------------------------- quality presets & performance
const PRESETS = {
  low: { shaders: false, shadows: false, bloom: false, scale: 0.7, view: 0.7, particles: 0.35, shadowRes: 1024, shadowEvery: 4 },
  medium: { shaders: true, shadows: true, bloom: true, scale: 0.85, view: 0.9, particles: 0.7, shadowRes: 1024, shadowEvery: 3 },
  high: { shaders: true, shadows: true, bloom: true, scale: 1, view: 1, particles: 1, shadowRes: 2048, shadowEvery: 2 },
  ultra: { shaders: true, shadows: true, bloom: true, scale: 1, view: 1.35, particles: 1, shadowRes: 4096, shadowEvery: 1 },
};
function applyPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  Settings.preset = name;
  for (const k of ['shaders', 'shadows', 'bloom', 'scale', 'view', 'particles']) Settings[k] = p[k];
  applySettings();
}
let dynScale = 1, perfT = 0, perfFrames = 0, perfTime = 0;
// the screen's refresh rate, measured from requestAnimationFrame (a browser can't draw faster than this)
const Refresh = { hz: 60, samples: [] };
function sampleRefresh(dtMs) { if (Refresh.samples.length < 240 && dtMs > 2 && dtMs < 40) { Refresh.samples.push(dtMs); if (Refresh.samples.length % 60 === 0) { const s = Refresh.samples.slice().sort((a, b) => a - b), med = s[s.length >> 1]; Refresh.hz = [60, 75, 90, 100, 120, 144, 165, 240].reduce((b, h) => Math.abs(1000 / h - med) < Math.abs(1000 / b - med) ? h : b, 60); } } }
function targetFps() { return Math.min(Refresh.hz, Settings.target || 1000); }
function basePixelRatio() { return Math.min(window.devicePixelRatio || 1, Settings.preset === 'ultra' ? 2 : 1.5); }
function applyRenderScale() {
  const pr = basePixelRatio() * Settings.scale * dynScale;
  if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) { renderer.setPixelRatio(pr); resize(); }
}
let perfLevel = 0; // 0 = full quality, 1 = shadows refresh less often, 2 = also no bloom
function autoPerformance(dt) {
  perfFrames++; perfTime += dt; perfT += dt;
  if (perfT < 1.0) return;
  const fps = perfFrames / perfTime; perfT = perfFrames = perfTime = 0;
  Game.fps = fps;
  if (!Settings.auto || Game.state !== 'play' || Game.ui) return;
  const goal = targetFps();
  if (fps < goal * 0.9) {
    if (perfLevel < 1) perfLevel++; // cheaper effects first: shadows and reflections refresh less often
    else if (dynScale > 0.55) { dynScale = Math.max(0.55, dynScale - (fps < goal * 0.66 ? 0.15 : 0.07)); applyRenderScale(); }
    else if (perfLevel < 2) perfLevel++;
  } else if (fps > goal * 0.97) {
    if (perfLevel > 0) perfLevel--;
    else if (dynScale < 1) { dynScale = Math.min(1, dynScale + 0.04); applyRenderScale(); }
  }
}
// hide chunks beyond the fog: saves both the main pass and the shadow pass
function cullChunks() {
  const far = U.uFogFar.value + 24, cx = camera.position.x, cz = camera.position.z;
  let vis = 0;
  for (let k = 0; k < chunkMeshes.length; k++) {
    const ms = chunkMeshes[k]; if (!ms) continue;
    const x = slotCX[k] * CS + CS / 2, z = slotCZ[k] * CS + CS / 2;
    const on = Math.hypot(x - cx, z - cz) < far + 12;
    for (const m of ms) if (m) m.visible = on;
    if (on) vis++;
  }
  Game.visibleChunks = vis;
}
// ---------------------------------------------------------------- water reflections
// Planar mirror at sea level: the world (minus the water and anything below it) is rendered from a
// camera mirrored under the surface; the water shader projects into that image and ripples it.
const reflRT = new THREE.WebGLRenderTarget(4, 4);
const reflCam = new THREE.PerspectiveCamera(70, 1, 0.1, 400), _rbuf = new THREE.Vector2(), _hidden = [];
const _rf = new THREE.Vector3(), _ru = new THREE.Vector3(), _bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
let reflFrame = 0;
function renderReflection() {
  U.uReflOn.value = 0;
  if (!qualityFor().reflections || U.uUnder.value > 0.5) return;
  const h = U.uReflH.value, cp = camera.position;
  if (cp.y < h + 0.05) return;
  let any = false;
  for (let k = 0; k < chunkMeshes.length && !any; k++) { const ms = chunkMeshes[k]; if (ms && ms[2] && ms[2].visible && Math.hypot(slotCX[k] * CS + 8 - cp.x, slotCZ[k] * CS + 8 - cp.z) < 110) any = true; }
  if (!any) return;
  U.uReflOn.value = 1;
  const rNow = performance.now(); if (U.uReflTex.value && rNow - (Game.reflT || 0) < (perfLevel > 0 ? 33 : 15)) return; Game.reflT = rNow;
  const db = renderer.getDrawingBufferSize(_rbuf), q = Settings.preset === 'ultra' ? 0.45 : perfLevel > 0 ? 0.25 : 0.32;
  const w = Math.max(64, Math.floor(db.x * q)), hh = Math.max(64, Math.floor(db.y * q));
  if (reflRT.width !== w || reflRT.height !== hh) reflRT.setSize(w, hh);
  camera.updateMatrixWorld();
  reflCam.fov = camera.fov; reflCam.aspect = camera.aspect; reflCam.far = camera.far; reflCam.updateProjectionMatrix();
  _rf.set(0, 0, -1).applyQuaternion(camera.quaternion); _ru.set(0, 1, 0).applyQuaternion(camera.quaternion);
  _rf.y = -_rf.y; _ru.y = -_ru.y;
  reflCam.position.set(cp.x, 2 * h - cp.y, cp.z); reflCam.up.copy(_ru);
  reflCam.lookAt(reflCam.position.x + _rf.x, reflCam.position.y + _rf.y, reflCam.position.z + _rf.z); reflCam.updateMatrixWorld();
  U.uReflMat.value.copy(_bias).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  matWater.visible = false; U.uClipY.value = h - 0.06; U.uReflTex.value = null; U.uReflOn.value = 0; // never sample the image being drawn
  const vis = pPoints.visible; pPoints.visible = false; matCross.visible = false;
  _hidden.length = 0; // far chunks barely show in a reflection: skip them
  for (let k = 0; k < chunkMeshes.length; k++) { const ms = chunkMeshes[k]; if (!ms) continue; if (Math.hypot(slotCX[k] * CS + 8 - cp.x, slotCZ[k] * CS + 8 - cp.z) > 72) for (const m of ms) if (m && m.visible) { m.visible = false; _hidden.push(m); } }
  renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, reflCam); renderer.setRenderTarget(null);
  for (const m of _hidden) m.visible = true;
  pPoints.visible = vis; matCross.visible = true; matWater.visible = true; U.uClipY.value = -1000; U.uReflOn.value = 1;
  U.uReflTex.value = reflRT.texture;
}
function renderWorld() {
  const pre = PRESETS[Settings.preset] || PRESETS.high;
  cullChunks();
  PARTICLE_DENSITY = Settings.particles;
  if (Settings.shadows) PostFX.setShadowRes(pre.shadowRes);
  const shadows = Settings.shaders && Settings.shadows && U.uSunCol.value.r + U.uSunCol.value.g > 0.05;
  U.uShadowOn.value = shadows ? 1 : 0;
  const nowMs = performance.now(), shadowHz = [0, 60, 40, 30, 20][Math.min(4, pre.shadowEvery + perfLevel)];
  if (shadows && (nowMs - (Game.shadowT || 0) >= 1000 / shadowHz - 2 || Game.cine)) {
    Game.shadowT = nowMs;
    if (Game.cine) shadowCenter.set(Game.cine.site.x, Game.cine.site.y, Game.cine.site.z); else shadowCenter.set(Math.floor(Player.x), Math.floor(Player.y), Math.floor(Player.z));
    PostFX.renderShadows(shadowCenter, U.uSunDir.value);
  }
  renderReflection();
  PostFX.render({ hand: Game.state === 'play' && !Game.view ? { scene: handScene, cam: handCam } : null, post: Settings.shaders, bloom: Settings.bloom && perfLevel < 2, sunDir: skyMat.uniforms.uSunDir.value, sunUp: Game.sunUp || 0, rayCol: Game.rayCol, night: clamp(1 - (U.uDay.value - 0.2) / 0.5, 0, 1), under: U.uUnder.value });
}


// ---------------------------------------------------------------- title screen tour
// The menu world is built quietly in the background; the camera then circles every village,
// landmark and dungeon in turn (like the discovery fly-around), at different times of day, forever.
const Tour = { on: false, list: [], i: 0, fade: 0, queue: [] };
function meshTourArea(x, z, r) { // mesh the queued chunks around a point right away
  const cx = x / CS, cz = z / CS;
  Tour.queue = Tour.queue.filter(c => { if (Math.hypot(c[0] + 0.5 - cx, c[1] + 0.5 - cz) <= r) { rebuildChunk(c[0], c[1]); return false; } return true; });
}
const TOUR_TIMES = [0.31, 0.43, 0.69, 0.74, 0.83, 0.36, 0.55, 0.93];
async function startTitleTour() {
  const s = loadSave();
  Tour.first = true;
  $('title').classList.add('live'); // the opening island shows through straight away
  await new Promise(r => setTimeout(r, 900));
  if (Game.state !== 'title') return; // the player already started a world
  const ok = await createWorld(s ? s.seed : 'Blockhollow', null, 'survival', true);
  if (!ok || Game.state !== 'title') return;
  // fade the island out, then the tour fades in
  for (let k = 1; k <= 10; k++) { $('tourFade').style.opacity = k / 10; await new Promise(r => setTimeout(r, 40)); }
  if (Game.state === 'title') beginTour();
}
function beginTour() {
  for (const m of Mobs.slice()) removeMob(m);
  for (const d of Drops) scene.remove(d.mesh); Drops.length = 0;
  for (const p of Projectiles) scene.remove(p.mesh); Projectiles.length = 0;
  // alternate biomes so consecutive shots look different
  const byBiome = {};
  for (const s of Sites) { const b = bmap[COL(Math.floor(s.x), Math.floor(s.z))]; (byBiome[b] = byBiome[b] || []).push(s); }
  for (const k in byBiome) byBiome[k].sort(() => Math.random() - 0.5);
  Tour.list = []; let more = true;
  while (more) { more = false; for (const k in byBiome) if (byBiome[k].length) { Tour.list.push(byBiome[k].pop()); more = true; } }
  if (!Tour.list.length) return;
  if (Tour.first) { const sp = Tour.list.reduce((b, s) => Math.hypot(s.x - Player.x, s.z - Player.z) < Math.hypot(b.x - Player.x, b.z - Player.z) ? s : b, Tour.list[0]); Tour.list.splice(Tour.list.indexOf(sp), 1); Tour.list.unshift(sp); Tour.first = false; }
  Tour.i = 0; Tour.on = true; Game.cine = null;
  $('title').classList.add('live');
  nextTourShot();
}
function stopTour() { Tour.on = false; Tour.queue = []; Game.cine = null; $('title').classList.remove('live'); $('tourFade').style.opacity = 0; }
function nextTourShot() {
  const s = Tour.list[Tour.i % Tour.list.length];
  Game.time = TOUR_TIMES[Tour.i % TOUR_TIMES.length]; Tour.i++;
  Game.zone = bmap[COL(Math.floor(s.x), Math.floor(s.z))];
  Player.x = s.x; Player.z = s.z; Player.y = s.y;
  if (Tour.queue.length) { meshTourArea(s.x, s.z, 3); const cx = s.x / CS, cz = s.z / CS; Tour.queue.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz)); }
  Game.cine = { site: s, t: 0, dur: 9, a0: Math.random() * Math.PI * 2 };
  const kind = s.cat === 'village' ? 'Village' : s.cat === 'camp' ? 'Camp' : s.cat === 'dungeon' ? 'Dungeon' : 'Landmark';
  $('tourLabel').innerHTML = '<span>' + kind.toUpperCase() + ' · ' + BIOMES[Game.zone].name + '</span><b>' + s.name + '</b><i>' + (s.sub || '') + '</i>';
  $('tourLabel').classList.remove('show'); void $('tourLabel').offsetWidth; $('tourLabel').classList.add('show');
}
function updateTour(dt) {
  const c = Game.cine;
  if (!c) nextTourShot();
  else { const f = c.t < 0.8 ? 1 - c.t / 0.8 : c.dur - c.t < 0.8 ? 1 - (c.dur - c.t) / 0.8 : 0; $('tourFade').style.opacity = f.toFixed(3); }
  for (let k = 0; k < 3 && Tour.queue.length; k++) { const c = Tour.queue.shift(); rebuildChunk(c[0], c[1]); }
  updateCinematic(dt);
  camera.fov = 62; camera.updateProjectionMatrix();
  updateSky(dt * 0.3);
  ambientEmitters(dt, Player);
  updateParticles(dt, U.uDay.value);
  updateWindmills(dt);
  streamTick(4);
  Sound.update(dt, { day: U.uDay.value, playing: true, height: 30, biome: Game.zone, under: false });
  viewModel.visible = false; outline.visible = false;
  renderWorld();
}
// ---------------------------------------------------------------- boot
function detectWeakGpu() {
  if (SAVED_SETTINGS && SAVED_SETTINGS.preset) return; // the player already picked a preset
  try {
    const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    const weak = /intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|software|vivante|videocore|apple gpu|mesa/.test(gpu) && !/arc|rtx|radeon rx|geforce/.test(gpu);
    if (weak || /cros/i.test(navigator.userAgent)) { applyPreset('medium'); Settings.preset = 'medium'; }
  } catch (e) { }
}
function boot() {
  detectWeakGpu();
  resize(); applySettings(); paintTitle(); refreshTitle();
  camera.position.set(128, 60, 128);
  requestAnimationFrame(frame);
  setTimeout(startTitleTour, 30);
  window.__g = { Game, Player, Inv, Sites, Mobs, BossRooms, giveItem, I, B, spawnMob, startBoss, setBlockLogged, createWorld, saveGame,
    tp(x, z, yaw) { Player.x = x + 0.5; Player.z = z + 0.5; Player.y = surfaceY(Math.floor(x), Math.floor(z)) + 1.2; Player.vy = 0; if (yaw !== undefined) Player.yaw = yaw; },
    play() { Game.state = 'play'; $('clickToBegin').classList.add('hidden'); Quests.render(true); },
    setTime(t) { Game.time = t; } };
}
boot();
