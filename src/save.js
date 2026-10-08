'use strict';
/* Worlds are kept in the browser (IndexedDB): the world list, every changed chunk (a block palette plus
   run-length encoding), block entities, entities, and the player and world state. Item and block ids are
   stored by name so saves survive changes to the registries. The game autosaves every 6000 ticks (five
   minutes) like the original, and also when the tab is hidden or closed. */
const Save = (() => {
  let db = null, opening = null, meta = null, lastSave = 0, saving = false;
  const dirty = new Set();             // chunk record keys waiting to be written
  const mem = { worlds: new Map(), chunks: new Map(), state: new Map() }; // used when storage is blocked
  function open() {
    if (db || opening) return opening || Promise.resolve(db);
    opening = new Promise(res => {
      let r;
      try { r = indexedDB.open('minecraft_web', 1); } catch (e) { res(null); return; }
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('worlds', { keyPath: 'id' }); d.createObjectStore('chunks'); d.createObjectStore('state'); };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    });
    return opening;
  }
  const store = (name, mode) => db.transaction(name, mode || 'readonly').objectStore(name);
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  const chunkKey = (id, dim, k) => id + '|' + dim + '|' + k;

  // ---------------------------------------------------------------- item stacks by name
  function pack(v) {
    if (v === null || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return v;
    if (Array.isArray(v)) return v.map(pack);
    if (v instanceof Inventory) return { $inv: v.slots.map(pack) };
    if (typeof v.id === 'number' && typeof v.count === 'number' && ITEMS[v.id]) { const o = {}; for (const k in v) o[k] = k === 'id' ? ITEMS[v.id].name : pack(v[k]); o.$s = 1; return o; }
    const o = {}; for (const k in v) if (typeof v[k] !== 'function') o[k] = pack(v[k]); return o;
  }
  function unpack(v) {
    if (v === null || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return v;
    if (Array.isArray(v)) return v.map(unpack);
    if (v.$inv) { const inv = new Inventory(v.$inv.length); inv.slots = v.$inv.map(unpack); return inv; }
    if (v.$s) { const id = IID[v.id]; if (id === undefined) return null; const o = {}; for (const k in v) if (k !== '$s') o[k] = k === 'id' ? id : unpack(v[k]); return o; }
    const o = {}; for (const k in v) o[k] = unpack(v[k]); return o;
  }

  // ---------------------------------------------------------------- chunks
  function encodeChunk(c, ents) {
    const pal = [], idx = new Map(), runs = [];
    const b = c.blocks, s = c.states;
    let prev = -1, n = 0;
    for (let i = 0; i < 65536; i++) {
      const k = b[i] * 256 + s[i];
      if (k === prev && n < 65535) { n++; continue; }
      if (n) runs.push(n, idx.get(prev));
      prev = k; n = 1;
      if (!idx.has(k)) { idx.set(k, pal.length); pal.push(k); }
    }
    runs.push(n, idx.get(prev));
    return {
      v: 1, cx: c.cx, cz: c.cz,
      pal: pal.map(k => BLOCKS[Math.floor(k / 256)].name + ':' + (k & 255)),
      runs: Uint16Array.from(runs), biomes: c.biomes.slice(),
      be: [...c.be.values()].map(pack), ents: ents || c.pendingEntities || [],
      ticks: Ticks.inChunk ? Ticks.inChunk(c) : [],
    };
  }
  function decodeChunk(r) {
    const blocks = new Uint16Array(65536), states = new Uint8Array(65536);
    const pal = r.pal.map(p => { const i = p.lastIndexOf(':'); const id = BID[p.slice(0, i)]; return id === undefined ? [0, 0] : [id, +p.slice(i + 1)]; });
    let o = 0;
    for (let i = 0; i < r.runs.length; i += 2) { const [id, st] = pal[r.runs[i + 1]], n = r.runs[i]; blocks.fill(id, o, o + n); states.fill(st, o, o + n); o += n; }
    return { cx: r.cx, cz: r.cz, blocks, states, biomes: r.biomes, be: r.be.map(unpack), ents: r.ents || [], ticks: r.ticks || [] };
  }
  // entities standing in a chunk that should be kept with it (items, mobs, vehicles...)
  function entitiesIn(c) {
    const out = [];
    for (const e of Entities.list) {
      if (e.removed || e.isPlayer || !e.save || e.dim !== c.dim) continue;
      if (Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz) { const d = e.save(); if (d) out.push(pack(d)); }
    }
    return out;
  }
  // a chunk is stored if it was changed or holds entities; unchanged empty chunks are just generated again
  function storeChunk(c, unloading) {
    if (!meta || !World.savedChunks) { // not saving (title panorama, tests): entities there just go away
      if (unloading) for (const e of Entities.list) if (!e.isPlayer && e.dim === c.dim && Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz) e.removed = true;
      return;
    }
    const ents = entitiesIn(c);
    if (!c.modified && !ents.length && !c.fromSave) return;
    const rec = encodeChunk(c, ents);
    const k = ckey(c.cx, c.cz);
    World.savedChunks[c.dim].set(k, rec);
    dirty.add(c.dim + '|' + k);
    c.modified = false; c.fromSave = true;
    if (unloading) for (const e of Entities.list) if (!e.isPlayer && e.save && e.dim === c.dim && Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz) { e.removed = true; e.unloaded = true; }
  }
  // put saved entities back when their chunk loads
  World.listeners.chunkLoaded.push(c => {
    if (!c.pendingEntities || !c.pendingEntities.length) return;
    const list = c.pendingEntities; c.pendingEntities = [];
    if (typeof Entities.restore === 'function') for (const d of list) { try { Entities.restore(unpack(d), c.dim); } catch (e) { console.warn('entity restore', e); } }
  });

  // ---------------------------------------------------------------- the player and the world
  function playerData(p) {
    return pack({
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, vx: p.vx, vy: p.vy, vz: p.vz, dim: World.dim,
      health: p.health, maxHealth: p.maxHealth, absorption: p.absorption, food: p.food, saturation: p.saturation, exhaustion: p.exhaustion,
      xpLevel: p.xpLevel, xpProgress: p.xpProgress, xpTotal: p.xpTotal, score: p.score, gamemode: p.gamemode, flying: p.flying,
      inv: p.inv.slots, selected: p.inv.selected, ender: p.enderChest.slots, effects: [...p.effects], spawn: p.spawn,
      fire: p.fireTicks, air: p.air, fall: p.fallDistance, dead: p.dead, onGround: p.onGround, frozen: p.frozenTicks || 0,
      recipes: p.knownRecipes ? [...p.knownRecipes] : null, seenCredits: !!p.seenCredits, stats: typeof Stats.save === 'function' ? Stats.save() : null,
      adv: typeof Advancements.save === 'function' ? Advancements.save() : null,
    });
  }
  function loadPlayer(p, raw) {
    const d = unpack(raw);
    p.x = p.px = d.x; p.y = p.py = d.y; p.z = p.pz = d.z; p.yaw = p.pyaw = d.yaw || 0; p.pitch = p.ppitch = d.pitch || 0;
    p.vx = d.vx || 0; p.vy = d.vy || 0; p.vz = d.vz || 0; p.onGround = !!d.onGround;
    p.maxHealth = d.maxHealth || 20; p.health = d.health > 0 ? d.health : 20; p.absorption = d.absorption || 0;
    p.food = d.food ?? 20; p.saturation = d.saturation ?? 5; p.exhaustion = d.exhaustion || 0;
    p.xpLevel = d.xpLevel || 0; p.xpProgress = d.xpProgress || 0; p.xpTotal = d.xpTotal || 0; p.score = d.score || 0;
    p.setGamemode(d.gamemode || 'survival'); p.flying = !!d.flying && p.mayFly;
    p.inv.load(d.inv); p.inv.selected = d.selected || 0; p.enderChest.load(d.ender);
    p.effects = new Map(d.effects || []); p.spawn = d.spawn || null;
    p.fireTicks = d.fire || 0; p.air = d.air ?? 300; p.fallDistance = d.fall || 0; p.frozenTicks = d.frozen || 0;
    if (d.recipes) p.knownRecipes = new Set(d.recipes);
    p.seenCredits = !!d.seenCredits;
    if (d.stats && typeof Stats.load === 'function') Stats.load(d.stats);
    if (d.adv && typeof Advancements.load === 'function') Advancements.load(d.adv);
    if (d.dead) { p.health = 0; p.dead = true; p.deathTime = 19; }
  }
  function worldState() {
    return {
      player: playerData(Game.player), dayTime: Game.dayTime, gameTime: Game.gameTime, rules: Object.assign({}, Game.rules), spawn: Game.spawn,
      difficulty: Game.difficulty, weather: typeof Weather.save === 'function' ? Weather.save() : null,
      dragon: typeof Dragon !== 'undefined' && Dragon.save ? Dragon.save() : null, extra: Game.extra || null,
    };
  }

  // ---------------------------------------------------------------- database operations
  async function listWorlds() {
    await open();
    if (!db) return [...mem.worlds.values()];
    try { return await req(store('worlds').getAll()); } catch (e) { return []; }
  }
  async function putMeta(m) {
    await open();
    const c = JSON.parse(JSON.stringify(m));
    if (!db) { mem.worlds.set(m.id, c); return; }
    try { await req(store('worlds', 'readwrite').put(c)); } catch (e) { console.warn('save meta', e); }
  }
  async function deleteWorld(id) {
    await open();
    if (!db) { mem.worlds.delete(id); mem.state.delete(id); for (const k of [...mem.chunks.keys()]) if (k.startsWith(id + '|')) mem.chunks.delete(k); return; }
    const t = db.transaction(['worlds', 'chunks', 'state'], 'readwrite');
    t.objectStore('worlds').delete(id); t.objectStore('state').delete(id);
    t.objectStore('chunks').delete(IDBKeyRange.bound(id + '|', id + '|￿'));
    try { await done(t); } catch (e) { console.warn('delete world', e); }
  }
  // read a world's state and every stored chunk
  async function loadWorld(id) {
    await open();
    const chunks = { overworld: new Map(), nether: new Map(), end: new Map() };
    let state = null;
    if (!db) {
      state = mem.state.get(id) || null;
      for (const [k, v] of mem.chunks) if (k.startsWith(id + '|')) { const [, dim, ck] = k.split('|'); chunks[dim].set(+ck, v); }
    } else {
      state = await req(store('state').get(id)) || null;
      await new Promise(res => {
        const r = store('chunks').openCursor(IDBKeyRange.bound(id + '|', id + '|￿'));
        r.onsuccess = () => { const cur = r.result; if (!cur) { res(); return; } const [, dim, ck] = String(cur.key).split('|'); if (chunks[dim]) chunks[dim].set(+ck, cur.value); cur.continue(); };
        r.onerror = () => res();
      });
    }
    if (!state) return null;
    state.chunks = chunks;
    return state;
  }
  // start keeping a world: chunks saved before come back from memory as the player walks around
  function begin(m, state) {
    meta = m; dirty.clear(); lastSave = 0;
    World.savedChunks = state && state.chunks ? state.chunks : { overworld: new Map(), nether: new Map(), end: new Map() };
    if (state && state.weather && typeof Weather.load === 'function') Weather.pending = state.weather;
    if (state && state.dragon && typeof Dragon !== 'undefined' && Dragon.load) Dragon.pending = state.dragon;
    Game.extra = state && state.extra ? state.extra : null;
  }
  async function saveGame() {
    if (!meta || !Game.running || saving) return;
    saving = true;
    try {
      for (const d in World.dims) for (const c of World.dims[d].values()) storeChunk(c, false);
      const st = worldState();
      meta.lastPlayed = Date.now(); meta.gamemode = Game.player.gamemode; meta.difficulty = Game.difficulty;
      await open();
      if (!db) {
        for (const k of dirty) { const [dim, ck] = k.split('|'); mem.chunks.set(chunkKey(meta.id, dim, ck), World.savedChunks[dim].get(+ck)); }
        mem.state.set(meta.id, st); mem.worlds.set(meta.id, Object.assign({}, meta)); dirty.clear();
      } else {
        const t = db.transaction(['worlds', 'chunks', 'state'], 'readwrite');
        const cs = t.objectStore('chunks');
        for (const k of dirty) { const [dim, ck] = k.split('|'); const rec = World.savedChunks[dim].get(+ck); if (rec) cs.put(rec, chunkKey(meta.id, dim, ck)); }
        t.objectStore('state').put(st, meta.id);
        t.objectStore('worlds').put(JSON.parse(JSON.stringify(meta)));
        dirty.clear();
        await done(t);
      }
    } catch (e) { console.warn('save failed', e); Chat.err && Chat.err('Saving the world failed: ' + (e && e.message)); }
    saving = false;
  }
  // the autosave, called every tick
  function tick() {
    if (!meta || !Game.running) return;
    if (++lastSave >= 6000) { lastSave = 0; saveGame(); }
  }
  addEventListener('visibilitychange', () => { if (document.hidden && Game.running) saveGame(); });
  addEventListener('pagehide', () => { if (Game.running) saveGame(); });
  return { listWorlds, putMeta, deleteWorld, loadWorld, begin, saveGame, tick, storeChunk, decodeChunk, encodeChunk, loadPlayer, playerData, pack, unpack, get meta() { return meta; } };
})();
