'use strict';
/* The game's real sounds, read from the player's own copy of Minecraft: Java Edition. Nothing from the game ships
   with this project: in Options → Music & Sounds the player points it at their .minecraft folder (or its assets
   folder, or a resource pack), and from then on every sound with a match plays the real file instead of the
   built-in synthesized one. Sound events, their variants, volumes and pitches come from the game's sounds.json;
   the files come from the launcher's asset index (assets/indexes/<n>.json → assets/objects/<xx>/<hash>) or from a
   resource pack's assets/minecraft/sounds folder. Short sounds are decoded once and kept (up to ~200 MB); music
   and records stream. Where the browser allows it, the folder is remembered for next time. */
const SoundPack = (() => {
  let ac = null, cats = null;
  let events = null;        // event name → [{ name, volume, pitch, weight, stream, type }]
  let has = null;           // sound path (as in sounds.json, without namespace) → true when the file exists
  let getFile = null;       // sound path → Promise<Blob>
  let label = '', count = 0, pending = null, loading = false;
  const buffers = new Map(); let bytes = 0; const MAX_BYTES = 200e6;
  const decoding = new Map();
  // ---------------------------------------------------------------- reading a folder
  const stripNs = n => n.replace(/^minecraft:/, '');
  function parseSounds(json) {
    const ev = {};
    for (const [k, v] of Object.entries(json)) {
      const list = (v.sounds || []).map(s => typeof s === 'string' ? { name: stripNs(s) } : Object.assign({}, s, { name: stripNs(s.name) }));
      ev[k] = list;
    }
    return ev;
  }
  // entries: [{ path: 'assets/indexes/17.json', file }] (from a folder picked with <input webkitdirectory>)
  async function fromEntries(entries, name) {
    const byPath = new Map(entries.map(e => [e.path.replace(/\\/g, '/'), e.file]));
    const paths = [...byPath.keys()];
    // the launcher's asset store
    const idx = paths.filter(p => /(^|\/)indexes\/[^/]+\.json$/.test(p)).sort((a, b) => byPath.get(b).lastModified - byPath.get(a).lastModified || b.localeCompare(a, undefined, { numeric: true }));
    for (const ip of idx) {
      let index; try { index = JSON.parse(await byPath.get(ip).text()); } catch (e) { continue; }
      const objs = index.objects || {}, sj = objs['minecraft/sounds.json']; if (!sj) continue;
      const root = ip.slice(0, ip.lastIndexOf('indexes/'));
      const fileOf = h => byPath.get(root + 'objects/' + h.slice(0, 2) + '/' + h);
      const sjFile = fileOf(sj.hash); if (!sjFile) continue;
      const map = new Map();
      for (const [p, o] of Object.entries(objs)) { const m = /^minecraft\/sounds\/(.+)\.ogg$/.exec(p); if (m && fileOf(o.hash)) map.set(m[1], o.hash); }
      return setup(parseSounds(JSON.parse(await sjFile.text())), map, s => Promise.resolve(fileOf(map.get(s))), name || 'Minecraft assets');
    }
    // a resource pack (or an unpacked game jar): assets/minecraft/sounds.json and sounds/**.ogg
    const sjp = paths.find(p => /(^|\/)assets\/minecraft\/sounds\.json$/.test(p));
    if (sjp) {
      const base = sjp.slice(0, -'sounds.json'.length) + 'sounds/', map = new Map();
      for (const p of paths) if (p.startsWith(base) && p.endsWith('.ogg')) map.set(p.slice(base.length, -4), base + p.slice(base.length));
      return setup(parseSounds(JSON.parse(await byPath.get(sjp).text())), map, s => Promise.resolve(byPath.get(map.get(s))), name || 'Resource pack');
    }
    throw new Error('No Minecraft sounds found there. Pick your .minecraft folder (or the assets folder inside it).');
  }
  // the same from a folder handle (File System Access API), reading files only when they are needed
  async function fromHandle(dir) {
    const sub = async (d, n) => { try { return await d.getDirectoryHandle(n); } catch (e) { return null; } };
    const file = async (d, path) => { const parts = path.split('/'); for (const p of parts.slice(0, -1)) { d = await sub(d, p); if (!d) return null; } try { return await (await d.getFileHandle(parts[parts.length - 1])).getFile(); } catch (e) { return null; } };
    // .minecraft, .minecraft/assets, or a resource pack
    let assets = (await sub(dir, 'indexes')) ? dir : await sub(dir, 'assets');
    if (assets && await sub(assets, 'indexes')) {
      const ixDir = await sub(assets, 'indexes'), objDir = await sub(assets, 'objects');
      const list = []; for await (const [n, h] of ixDir.entries()) if (h.kind === 'file' && n.endsWith('.json')) list.push(await h.getFile());
      list.sort((a, b) => b.lastModified - a.lastModified);
      for (const f of list) {
        let index; try { index = JSON.parse(await f.text()); } catch (e) { continue; }
        const objs = index.objects || {}, sj = objs['minecraft/sounds.json']; if (!sj || !objDir) continue;
        const sjFile = await file(objDir, sj.hash.slice(0, 2) + '/' + sj.hash); if (!sjFile) continue;
        const map = new Map(); for (const [p, o] of Object.entries(objs)) { const m = /^minecraft\/sounds\/(.+)\.ogg$/.exec(p); if (m) map.set(m[1], o.hash); }
        return setup(parseSounds(JSON.parse(await sjFile.text())), map, s => file(objDir, map.get(s).slice(0, 2) + '/' + map.get(s)), dir.name);
      }
    }
    const mc = (await sub(dir, 'minecraft')) || (assets && await sub(assets, 'minecraft'));
    const sjFile = mc && await file(mc, 'sounds.json');
    if (sjFile) {
      const map = new Map(), sounds = await sub(mc, 'sounds');
      const walk = async (d, pre) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, pre + n + '/'); else if (n.endsWith('.ogg')) map.set(pre + n.slice(0, -4), pre + n); } };
      if (sounds) await walk(sounds, '');
      return setup(parseSounds(JSON.parse(await sjFile.text())), map, s => file(sounds, map.get(s)), dir.name);
    }
    throw new Error('No Minecraft sounds found there. Pick your .minecraft folder (or the assets folder inside it).');
  }
  function setup(ev, map, get, name) {
    clear(true);
    events = ev; getFile = get; has = map; label = name;
    count = Object.keys(ev).filter(k => playable(k)).length;
    if (!count) { events = null; throw new Error('That folder has no sound files the game can use.'); }
    Sound.setPack(api);
    warm();
    return { label, count };
  }
  function clear(keepStore) {
    stopMusic(); for (const k of [...discs.keys()]) stopDisc(k);
    events = null; has = null; getFile = null; label = ''; count = 0; buffers.clear(); bytes = 0; decoding.clear();
    if (Sound.pack === api) Sound.setPack(null);
    if (!keepStore) forget();
  }
  // ---------------------------------------------------------------- remembering the folder (Chrome and Edge)
  const DB = 'mcweb-soundpack';
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function remember(h) { try { const db = await idb(); db.transaction('h', 'readwrite').objectStore('h').put(h, 'dir'); } catch (e) { /* private window */ } }
  async function forget() { pending = null; try { const db = await idb(); db.transaction('h', 'readwrite').objectStore('h').delete('dir'); } catch (e) { /* nothing stored */ } }
  async function stored() { try { const db = await idb(); return await new Promise(res => { const r = db.transaction('h').objectStore('h').get('dir'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } }
  // on start: load the remembered folder if the browser still lets us read it, else offer to reconnect
  async function restore() {
    const h = await stored(); if (!h || !h.queryPermission) return;
    try { if (await h.queryPermission({ mode: 'read' }) === 'granted') { loading = true; await fromHandle(h); } else pending = h; } catch (e) { pending = h; } finally { loading = false; }
  }
  // ask for a folder (in a click handler); resolves to { label, count } or throws
  async function pick(upload) {
    if (window.showDirectoryPicker && !upload) {
      let h; try { h = await window.showDirectoryPicker({ id: 'minecraft-sounds', mode: 'read' }); } catch (e) { if (e && e.name === 'AbortError') return null; h = null; }
      if (h) { loading = true; try { const r = await fromHandle(h); remember(h); return r; } finally { loading = false; } }
    }
    // other browsers: a folder upload field (it has to be picked again next time)
    return new Promise((res, rej) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true; inp.style.display = 'none'; document.body.appendChild(inp);
      inp.onchange = async () => { const files = [...inp.files]; inp.remove(); if (!files.length) return res(null); loading = true; try { res(await fromEntries(files.map(f => ({ path: f.webkitRelativePath || f.name, file: f })), files[0].webkitRelativePath.split('/')[0])); } catch (e) { rej(e); } finally { loading = false; } };
      inp.click();
    });
  }
  async function reconnect() {
    const h = pending; if (!h) return null;
    if (await h.requestPermission({ mode: 'read' }) !== 'granted') return null;
    pending = null; loading = true; try { return await fromHandle(h); } finally { loading = false; }
  }
  // ---------------------------------------------------------------- playing
  function attach(ctx, c) { ac = ctx; cats = c; buffers.clear(); bytes = 0; decoding.clear(); }
  function detach() { stopMusic(); for (const k of [...discs.keys()]) stopDisc(k); ac = null; cats = null; buffers.clear(); bytes = 0; decoding.clear(); }
  function playable(ev, depth = 0) { const list = events && events[ev]; if (!list || !list.length || depth > 4) return false; return list.some(s => s.type === 'event' ? playable(s.name, depth + 1) : has.has(s.name)); }
  // a weighted random variant, following references to other events (with their volume and pitch)
  function choose(ev, depth = 0) {
    const list = (events[ev] || []).filter(s => s.type === 'event' ? playable(s.name, depth + 1) : has.has(s.name));
    if (!list.length || depth > 4) return null;
    let w = 0; for (const s of list) w += s.weight || 1;
    let r = Math.random() * w, s = list[0]; for (const o of list) { r -= o.weight || 1; if (r <= 0) { s = o; break; } }
    if (s.type === 'event') { const t = choose(s.name, depth + 1); return t && Object.assign({}, t, { volume: (t.volume ?? 1) * (s.volume ?? 1), pitch: (t.pitch ?? 1) * (s.pitch ?? 1) }); }
    return s;
  }
  async function buffer(name) {
    if (buffers.has(name)) { const b = buffers.get(name); buffers.delete(name); buffers.set(name, b); return b; }
    if (decoding.has(name)) return decoding.get(name);
    const ctx = ac;
    const job = (async () => {
      const f = await getFile(name); if (!f || !ctx) return null;
      const b = await ctx.decodeAudioData(await f.arrayBuffer());
      if (ctx !== ac) return null;
      buffers.set(name, b); bytes += b.length * b.numberOfChannels * 4;
      for (const [k, v] of buffers) { if (bytes <= MAX_BYTES) break; bytes -= v.length * v.numberOfChannels * 4; buffers.delete(k); }
      return b;
    })().catch(() => null).finally(() => decoding.delete(name));
    decoding.set(name, job); return job;
  }
  // play a sound event: false when there is nothing to play for it (the built-in sound is used instead)
  function playEvent(ev, x, y, z, cat, vol, pitch, range) {
    if (!ac || !events || !events[ev]) return false;
    const s = choose(ev); if (!s) return false;
    if (s.stream) return stream(s, cat || 'music', vol, x, y, z);
    const v = (vol ?? 1) * (s.volume ?? 1), pt = Math.max(0.5, Math.min(2, (pitch ?? 1) * (s.pitch ?? 1)));
    // the game's attenuation: linear out to 16 blocks (or further for sounds louder than 1)
    const g = Sound.out(cat || 'sfx', x, y, z, Math.min(1, v), (range || 16) * Math.max(1, v));
    const ctx = ac;
    buffer(s.name).then(b => { if (!b || ctx !== ac) return; const src = ac.createBufferSource(); src.buffer = b; src.playbackRate.value = pt; src.connect(g); src.start(); });
    return true;
  }
  // ---------------------------------------------------------------- what each of the game's sounds is called in the real game
  const NAMES = {
    click: ['ui.button.click', 0.25], ui: ['ui.button.click', 0.25], pop: ['entity.item.pickup', 0.2], orb: ['entity.experience_orb.pickup', 0.1], levelup: ['entity.player.levelup', 0.75],
    player_hurt: 'entity.player.hurt', attack_strong: 'entity.player.attack.strong', attack_weak: 'entity.player.attack.weak', attack_crit: 'entity.player.attack.crit', attack_sweep: 'entity.player.attack.sweep',
    attack_nodamage: 'entity.player.attack.nodamage', attack_knockback: 'entity.player.attack.knockback', break_item: ['entity.item.break', 0.8], equip: 'item.armor.equip_generic', eat: ['entity.generic.eat', 0.5],
    burp: ['entity.player.burp', 0.5], drink: ['entity.generic.drink', 0.5], fizz: ['block.fire.extinguish', 0.5], extinguish: ['block.fire.extinguish', 0.5], explode: ['entity.generic.explode', 4],
    tnt_primed: 'entity.tnt.primed', creeper_primed: 'entity.creeper.primed', flint: 'item.flintandsteel.use', bow_shoot: 'entity.arrow.shoot', crossbow_shoot: 'item.crossbow.shoot', crossbow_loaded: 'item.crossbow.loading_end',
    skeleton_shoot: 'entity.skeleton.shoot', snow_golem_shoot: 'entity.snow_golem.shoot', arrow_hit: 'entity.arrow.hit', arrow_hit_player: 'entity.arrow.hit_player', throw: ['entity.snowball.throw', 0.5],
    ender_pearl_throw: ['entity.ender_pearl.throw', 0.5], witch_throw: 'entity.witch.throw', wind_charge_throw: 'entity.wind_charge.throw', trident_throw: 'item.trident.throw', splash_potion: 'entity.splash_potion.break',
    chest_open: ['block.chest.open', 0.5], chest_close: ['block.chest.close', 0.5], barrel_open: ['block.barrel.open', 0.5], barrel_close: ['block.barrel.close', 0.5],
    door_open: 'block.wooden_door.open', door_close: 'block.wooden_door.close', iron_door_open: 'block.iron_door.open', iron_door_close: 'block.iron_door.close',
    trapdoor_open: 'block.wooden_trapdoor.open', trapdoor_close: 'block.wooden_trapdoor.close', iron_trapdoor_open: 'block.iron_trapdoor.open', iron_trapdoor_close: 'block.iron_trapdoor.close',
    gate_open: 'block.fence_gate.open', gate_close: 'block.fence_gate.close', lever: ['block.lever.click', 0.3], button: ['block.stone_button.click_on', 0.3], click_off: ['block.stone_button.click_off', 0.3],
    piston_extend: ['block.piston.extend', 0.5], piston_contract: ['block.piston.contract', 0.5], dispense: 'block.dispenser.dispense', dispense_fail: 'block.dispenser.fail',
    copper_bulb_on: 'block.copper_bulb.turn_on', copper_bulb_off: 'block.copper_bulb.turn_off', torch_burnout: ['block.redstone_torch.burnout', 0.5],
    honeycomb_wax: 'item.honeycomb.wax_on', waxed_sign_fail: 'block.sign.waxed_interact_fail', dye_use: 'item.dye.use', book_put: 'item.book.put', book_page_turn: 'item.book.page_turn',
    chiseled_bookshelf_insert_enchanted: 'block.chiseled_bookshelf.insert.enchanted', chiseled_bookshelf_pickup_enchanted: 'block.chiseled_bookshelf.pickup.enchanted',
    ui_toast_in: 'ui.toast.in', ui_toast_challenge_complete: 'ui.toast.challenge_complete', brush: 'item.brush.brushing.generic', brush_generic: 'item.brush.brushing.generic', brush_sand: 'item.brush.brushing.sand',
    brush_gravel: 'item.brush.brushing.gravel', brush_sand_completed: 'item.brush.brushing.sand.complete', brush_gravel_completed: 'item.brush.brushing.gravel.complete',
    glow_ink_use: 'item.glow_ink_sac.use', ink_use: 'item.ink_sac.use', bobber_throw: 'entity.fishing_bobber.throw', bobber_splash: 'entity.fishing_bobber.splash', bobber_retrieve: 'entity.fishing_bobber.retrieve',
    leash_attach: 'entity.leash_knot.place', leash_place: 'entity.leash_knot.place', leash_untie: 'entity.leash_knot.break', leash_break: 'entity.leash_knot.break', loom_take: 'ui.loom.take_result', cartography_take: 'ui.cartography_table.take_result',
    bucket_fill: 'item.bucket.fill', bucket_empty: 'item.bucket.empty', bottle_fill: 'item.bottle.fill', bottle_empty: 'item.bottle.empty', bucket_fill_lava: 'item.bucket.fill_lava', bucket_empty_lava: 'item.bucket.empty_lava',
    splash: 'entity.player.splash', swim: ['entity.player.swim', 0.35], hoe_till: 'item.hoe.till', shovel_flatten: 'item.shovel.flatten', axe_strip: 'item.axe.strip', bone_meal: 'item.bone_meal.use',
    shear: 'entity.sheep.shear', saddle: ['entity.horse.saddle', 0.5], berry_pick: 'block.sweet_berry_bush.pick_berries', pumpkin_carve: 'block.pumpkin.carve', composter_fill: 'block.composter.fill', composter_fill_success: 'block.composter.fill_success',
    totem: 'item.totem.use', portal_ambient: ['block.portal.ambient', 0.5], teleport: 'entity.enderman.teleport', enderman_teleport: 'entity.enderman.teleport', enderman_stare: 'entity.enderman.stare',
    fire_ambient: 'block.fire.ambient', campfire_crackle: 'block.campfire.crackle', lava_pop: ['block.lava.pop', 0.2], lava_ambient: ['block.lava.ambient', 0.2], firework_launch: ['entity.firework_rocket.launch', 3],
    firework_blast: ['entity.firework_rocket.blast', 20], shield_block: 'item.shield.block', spyglass: 'item.spyglass.use', goat_horn: ['item.goat_horn.sound.0', 16], bell: ['block.bell.use', 2],
    anvil_land: ['block.anvil.land', 0.3], anvil_use: ['block.anvil.use', 0.3], anvil_destroy: 'block.anvil.destroy', trident_hit: 'item.trident.hit', trident_return: 'item.trident.return', trident_riptide: 'item.trident.riptide_1',
    ender_eye_launch: 'entity.ender_eye.launch', ender_eye_death: 'entity.ender_eye.death', eye_place: 'block.end_portal_frame.fill', anchor_charge: 'block.respawn_anchor.charge', anchor_set: 'block.respawn_anchor.set_spawn',
    wind_burst: 'entity.wind_charge.wind_burst', chicken_egg: 'entity.chicken.egg', cow_milk: 'entity.cow.milk', mooshroom_milk: 'entity.mooshroom.milk', iron_golem_repair: 'entity.iron_golem.repair',
    villager_no: 'entity.villager.no', zombie_villager_cure: 'entity.zombie_villager.cure', witch_drink: 'entity.witch.drink', fish_flop: 'entity.cod.flop', raid_horn: ['event.raid.horn', 64],
    sculk_clicking: 'block.sculk_sensor.clicking', sculk_clicking_stop: 'block.sculk_sensor.clicking_stop', sculk_catalyst_bloom: 'block.sculk_catalyst.bloom', sculk_block_spread: 'block.sculk.spread',
    portal_trigger: ['block.portal.trigger', 0.25], portal_travel: ['block.portal.travel', 0.25], end_portal_spawn: 'block.end_portal.spawn', thunder: ['entity.lightning_bolt.thunder', 10000],
    magma_cube_squish: 'entity.magma_cube.squish', slime_squish: 'entity.slime.squish', slime_jump: 'entity.slime.jump', wolf_shake: ['entity.wolf.shake', 0.4], polar_bear_warning: 'entity.polar_bear.warning',
    husk_converted_to_zombie: 'entity.husk.converted_to_zombie', zombie_converted_to_drowned: 'entity.zombie.converted_to_drowned', skeleton_converted_to_stray: 'entity.skeleton.converted_to_stray',
    note: 'block.note_block.harp', shulker_box_open: 'block.shulker_box.open', shulker_box_close: 'block.shulker_box.close', ender_chest_open: 'block.ender_chest.open', ender_chest_close: 'block.ender_chest.close',
    enchant: 'block.enchantment_table.use', brewing: 'block.brewing_stand.brew', grindstone: 'block.grindstone.use', smithing: 'block.smithing_table.use', stonecutter: 'ui.stonecutter.take_result',
  };
  const MOB_ALIAS = { mooshroom: 'cow', cave_spider: 'spider', trader_llama: 'llama', glow_squid: 'glow_squid', zombified_piglin: 'zombified_piglin', tropical_fish: 'tropical_fish' };
  const MOB_VOL = { ghast: 5, ender_dragon: 5, wither: 2, warden: 4, bat: 0.1, ravager: 1, iron_golem: 1, elder_guardian: 1, creeper: 1 };
  const auto = new Map();
  // the event for one of the game's sound names: the table, mob calls, then a search of the real event names
  function lookup(name) {
    if (auto.has(name)) return auto.get(name);
    let r = null;
    const t = NAMES[name];
    if (t) r = Array.isArray(t) ? { ev: t[0], vol: t[1] } : { ev: t };
    if (!r) { const m = /^(.+)_(hurt|death|ambient|say)$/.exec(name); if (m) { const k = m[2] === 'say' ? 'ambient' : m[2]; for (const ty of [m[1], MOB_ALIAS[m[1]]]) if (ty && events['entity.' + ty + '.' + k]) { r = { ev: 'entity.' + ty + '.' + k, vol: MOB_VOL[ty] || 1, mob: true }; break; } } }
    if (!r) {
      // block.trial_spawner.detect_player from trial_spawner_detect_player, and so on
      const us = []; for (let i = 0; i < name.length; i++) if (name[i] === '_') us.push(i);
      outer: for (const i of us) { const a = name.slice(0, i), b = name.slice(i + 1); for (const pre of ['block.', 'entity.', 'item.', 'ui.', 'ambient.', 'event.']) { for (const ev of [pre + a + '.' + b, pre + a + '.' + b.replace(/_/g, '.')]) if (events[ev]) { r = { ev }; break outer; } } }
    }
    if (r && !playable(r.ev)) r = null;
    auto.set(name, r); return r;
  }
  const rnd = () => Math.random();
  function play(name, x, y, z, o, e) {
    if (!events) return false;
    const r = lookup(name); if (!r) return false;
    o = o || {};
    let vol = o.volume ?? r.vol ?? 1, pitch = o.pitch ?? 1;
    if (r.mob) { pitch = (rnd() - rnd()) * 0.2 + (e && e.baby ? 1.5 : 1); if (e && e.type === 'slime' || e && e.type === 'magma_cube') vol = 0.4 * (e.size || 1); }
    if (name === 'fall' && o.big) return playEvent('entity.generic.big_fall', x, y, z, 'sfx', 1, 1);
    if (name === 'fall') return playEvent('entity.generic.small_fall', x, y, z, 'sfx', 1, 1);
    if (name === 'firework_blast' && o.large) return playEvent('entity.firework_rocket.large_blast', x, y, z, 'sfx', 20, 0.95 + rnd() * 0.1);
    if (name === 'explode') pitch = (1 + (rnd() - rnd()) * 0.2) * 0.7;
    if (name === 'chest_open' || name === 'chest_close' || name === 'door_open' || name === 'door_close') pitch = rnd() * 0.1 + 0.9;
    const cat = name === 'click' || name === 'ui' || name.startsWith('ui_') ? 'ui' : name === 'thunder' ? 'ambient' : 'sfx';
    return playEvent(r.ev, x, y, z, cat, vol, pitch, name === 'thunder' ? 1e6 : 16);
  }
  // block sounds: the block's own sound type (block.<name>.<kind> where the game has one, else its group)
  const GROUP = { coral: 'coral_block', slime: 'slime_block', honey: 'honey_block', amethyst: 'amethyst_block', wart: 'wart_block', bone: 'bone_block' };
  const KIND = { break: [1, 0.8], place: [1, 0.8], hit: [0.25, 0.5], step: [0.15, 1], fall: [0.5, 0.75] };
  const groupCache = new Map();
  function blockEvent(id, kind) {
    const key = id + ':' + kind; if (groupCache.has(key)) return groupCache.get(key);
    const d = BLOCKS[id]; let ev = null;
    if (d) {
      const n = d.name, g = d.sound || (/_leaves$/.test(n) ? 'grass' : d.model === 'cross' ? 'grass' : n.includes('glass') ? 'glass' : /_wool$|_carpet$/.test(n) ? 'wool' : n === 'grass_block' || n === 'mycelium' ? 'grass' : /dirt|farmland|podzol|clay/.test(n) ? 'gravel' : 'stone');
      const cands = ['block.' + n + '.' + kind, 'block.' + n.replace(/^(waxed_)?(exposed_|weathered_|oxidized_)?/, '').replace(/_block$/, '') + '.' + kind];
      if (g === 'wood' && n.startsWith('cherry_')) cands.push('block.cherry_wood.' + kind);
      if (g === 'metal' && n.includes('copper')) cands.push('block.copper.' + kind);
      cands.push('block.' + (GROUP[g] || g) + '.' + kind, 'block.stone.' + kind);
      ev = cands.find(c => events[c] && playable(c)) || null;
    }
    groupCache.set(key, ev); return ev;
  }
  function block(id, kind, x, y, z) { if (!events) return false; const ev = blockEvent(id, kind); if (!ev) return false; const [v, p] = KIND[kind] || [1, 1]; return playEvent(ev, x, y, z, 'sfx', v, p); }
  // note blocks: the game's own pitch, 2^((note-12)/12), heard 48 blocks away
  function note(instr, n, x, y, z) { return playEvent('block.note_block.' + instr, x, y, z, 'records', 3, Math.pow(2, (n - 12) / 12)); }
  // ---------------------------------------------------------------- music and records: streamed from the file
  let music0 = null;
  const discs = new Map();
  function stream(s, cat, vol, x, y, z, key) {
    const ctx = ac, el = new Audio(); el.preload = 'auto';
    const g = ac.createGain(); g.gain.value = Math.min(1, (vol ?? 1) * (s.volume ?? 1)); g.connect(cats[cat]);
    let pan = null; if (x !== undefined && ac.createStereoPanner) { pan = ac.createStereoPanner(); g.disconnect(); g.connect(pan); pan.connect(cats[cat]); }
    const st = { el, g, pan, x, y, z, vol: g.gain.value, url: null, cat };
    getFile(s.name).then(f => { if (!f || ctx !== ac) return; st.url = URL.createObjectURL(f); el.src = st.url; const src = ac.createMediaElementSource(el); src.connect(g); st.src = src; el.play().catch(() => {}); });
    el.onended = () => endStream(st, key);
    if (cat === 'music') { music0 = st; } else discs.set(key, st);
    return true;
  }
  function endStream(st, key) {
    try { st.el.pause(); st.el.removeAttribute('src'); st.el.load(); st.g.disconnect(); st.pan && st.pan.disconnect(); st.src && st.src.disconnect(); } catch (e) { /* the graph is gone */ }
    if (st.url) URL.revokeObjectURL(st.url);
    if (music0 === st) music0 = null;
    if (key && discs.get(key) === st) discs.delete(key);
  }
  function stopMusic() { if (music0) endStream(music0); }
  function musicBusy() { return !!music0; }
  // which music: the menu, the End (the dragon while it lives), the nether biome, under water, creative, the overworld biome
  function music(mode) {
    if (!events || !ac) return false;
    const p = Game.player;
    let evs = ['music.game'];
    if (mode === 'menu') evs = ['music.menu'];
    else if (World.dim === 'end') evs = [Entities.list.some(e => e.type === 'ender_dragon' && !e.dead) ? 'music.dragon' : 'music.end'];
    else if (World.dim === 'nether' && p) { const b = BIOMES[World.biomeAt(Math.floor(p.x), Math.floor(p.z))]; evs = ['music.nether.' + (b ? b.name : 'nether_wastes'), 'music.nether.nether_wastes']; }
    else if (p && p.eyesInWater) evs = ['music.under_water', 'music.game'];
    else if (p && p.creative) evs = ['music.creative', 'music.game'];
    else if (p) { const b = BIOMES[World.biomeAt3 ? World.biomeAt3(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) : World.biomeAt(Math.floor(p.x), Math.floor(p.z))]; if (b) evs = ['music.overworld.' + b.name, 'music.game']; }
    for (const ev of evs) if (playable(ev)) return playEvent(ev, undefined, undefined, undefined, 'music', 1, 1);
    return false;
  }
  function disc(name, x, y, z, key) {
    if (!events || !ac) return false;
    const ev = 'music_disc.' + String(name).replace('music_disc_', ''); if (!playable(ev)) return false;
    stopDisc(key);
    const s = choose(ev); if (!s) return false;
    return stream(s, 'records', 4, x, y, z, key);
  }
  function stopDisc(key) { const st = discs.get(key); if (st) endStream(st, key); }
  // records fade with distance (64 blocks) and pan as you move
  function tick() {
    if (!ac) return;
    const cam = camera.position, p = Game.player, yaw = p ? p.yaw : 0;
    for (const st of discs.values()) {
      const dx = st.x - cam.x, dy = st.y - cam.y, dz = st.z - cam.z, d = Math.hypot(dx, dy, dz), att = Math.max(0, 1 - d / 64);
      st.g.gain.value = att * Math.min(1, st.vol);
      if (st.pan) { const pn = d > 0.5 ? Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d)) * 0.8 : 0; st.pan.pan.value = Number.isFinite(pn) ? pn : 0; }
    }
    if (music0 && Sound.musicMode === 'game' && UI.page === 'title') stopMusic();
  }
  // decode the sounds heard most often right away, so the first footsteps aren't late
  function warm() {
    const list = ['block.grass.step', 'block.stone.step', 'block.wood.step', 'block.gravel.step', 'block.sand.step', 'block.grass.break', 'block.stone.break', 'block.wood.break', 'block.stone.hit', 'block.grass.hit', 'block.wood.hit', 'ui.button.click', 'entity.item.pickup', 'entity.player.hurt', 'entity.player.attack.strong', 'entity.player.attack.weak', 'entity.experience_orb.pickup', 'block.grass.place', 'block.stone.place', 'block.wood.place'];
    let i = 0; const next = () => { if (!events || i >= list.length) return; const s = events[list[i++]] && choose(list[i - 1]); (s && ac ? buffer(s.name) : Promise.resolve()).finally(() => setTimeout(next, 30)); };
    next();
  }
  function volumes() { for (const st of discs.values()) st.vol = Math.min(1, st.vol); }
  function status() { return { loaded: !!events, label, count, pending: !!pending, loading, canRemember: !!window.showDirectoryPicker }; }
  const api = { attach, detach, volumes, play, block, note, disc, stopDisc, music, musicBusy, stopMusic, tick, playEvent, has: ev => !!events && playable(ev), status, pick, reconnect, restore, clear, fromEntries, get events() { return events; } };
  return api;
})();
