'use strict';
/* Sound, synthesized live with the Web Audio API (the game's own sound files are not used): block sounds by
   material for breaking, mining, placing and footsteps, mob calls, combat, items, explosions, note block
   instruments, rain and thunder, and quiet generative piano music that plays now and then like the game's.
   Sounds fade with distance (up to 16 blocks, further for loud ones) and pan left or right. */
const Sound = (() => {
  let ac = null, master = null, cats = {}, noiseBuf = null, ready = false;
  const SUBS = [];
  function init() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.connect(ac.destination);
    for (const k of ['music', 'sfx', 'ambient', 'ui', 'records']) { cats[k] = ac.createGain(); cats[k].connect(master); }
    const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    volumes(); ready = true;
  }
  addEventListener('mousedown', () => { init(); if (ac && ac.state === 'suspended') ac.resume(); }, true);
  addEventListener('keydown', () => { init(); if (ac && ac.state === 'suspended') ac.resume(); }, true);
  function volumes() { if (!ac) return; master.gain.value = Settings.vMaster; cats.music.gain.value = Settings.vMusic * 0.6; cats.sfx.gain.value = Settings.vSfx; cats.ambient.gain.value = Settings.vAmbient; cats.ui.gain.value = 1; cats.records.gain.value = Settings.vMusic; }
  const T = () => ac.currentTime;
  // ---------------------------------------------------------------- building blocks
  function out(cat, x, y, z, vol, range) {
    const g = ac.createGain(); g.gain.value = vol;
    if (x === undefined || x === null) { g.connect(cats[cat || 'sfx']); return g; }
    // distance: linear fade to the range; pan from the angle to the listener's view
    const cam = camera.position, dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, d = Math.hypot(dx, dy, dz);
    const r = range || 16, att = Math.max(0, 1 - d / r);
    if (att <= 0) { g.gain.value = 0; }
    g.gain.value = vol * att;
    const p = Game.player, yaw = p ? p.yaw : 0;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw); // the right-hand direction
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
    let node = g;
    if (ac.createStereoPanner) { const sp = ac.createStereoPanner(); sp.pan.value = pan; g.connect(sp); node = sp; }
    node.connect(cats[cat || 'sfx']);
    return g;
  }
  function env(g, t0, a, peak, decay, sus) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t0 + a + decay); }
  function noise(dest, t0, dur, filter, f, q, peak, attack, gainAuto) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = filter; fl.frequency.value = f; fl.Q.value = q || 1;
    const g = ac.createGain(); env(g, t0, attack || 0.003, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.1);
    if (gainAuto) gainAuto(fl, t0);
    return fl;
  }
  function tone(dest, t0, type, f, dur, peak, o) {
    o = o || {};
    const os = ac.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, t0);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.glide || dur));
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(os.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    const g = ac.createGain(); env(g, t0, o.attack || 0.005, peak, dur, o.sus);
    let last = os;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || 1; if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t0 + dur); os.connect(fl); last = fl; }
    if (o.bp) { const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = o.bp; fl.Q.value = o.q || 2; last.connect(fl); last = fl; }
    last.connect(g); g.connect(dest);
    os.start(t0); os.stop(t0 + (o.attack || 0.005) + dur + 0.05);
    return os;
  }
  const rp = (a, b) => a + Math.random() * (b - a);
  // ---------------------------------------------------------------- block materials
  const MAT = {
    stone: { f: 1500, q: 0.9, type: 'bandpass', dur: 0.12, thump: 140 }, deepslate: { f: 1100, q: 0.9, type: 'bandpass', dur: 0.13, thump: 110 }, tuff: { f: 1300, q: 0.9, type: 'bandpass', dur: 0.12, thump: 120 },
    netherrack: { f: 900, q: 1.2, type: 'bandpass', dur: 0.1, thump: 120 }, nether_bricks: { f: 1700, q: 1.5, type: 'bandpass', dur: 0.1, thump: 160 }, basalt: { f: 1300, q: 1.1, type: 'bandpass', dur: 0.12, thump: 130 }, nether_ore: { f: 1200, q: 1, type: 'bandpass', dur: 0.12, thump: 120 }, ancient_debris: { f: 800, q: 1.4, type: 'bandpass', dur: 0.16, thump: 100 }, lodestone: { f: 1500, q: 1, type: 'bandpass', dur: 0.12, thump: 140 }, bone: { f: 2200, q: 2, type: 'bandpass', dur: 0.08, thump: 0 },
    wood: { f: 650, q: 3, type: 'bandpass', dur: 0.09, knock: 260 }, nether_wood: { f: 700, q: 3, type: 'bandpass', dur: 0.09, knock: 280 }, bamboo_wood: { f: 900, q: 3, type: 'bandpass', dur: 0.08, knock: 340 }, ladder: { f: 700, q: 3, type: 'bandpass', dur: 0.08, knock: 300 }, scaffolding: { f: 900, q: 3, type: 'bandpass', dur: 0.07, knock: 400 }, bamboo: { f: 1100, q: 3, type: 'bandpass', dur: 0.06, knock: 420 }, stem: { f: 600, q: 2, type: 'bandpass', dur: 0.1, knock: 220 },
    gravel: { f: 1100, q: 0.6, type: 'highpass', dur: 0.14, grains: 4 }, grass: { f: 2600, q: 0.5, type: 'highpass', dur: 0.1, grains: 2 }, wet_grass: { f: 2000, q: 0.7, type: 'highpass', dur: 0.1, grains: 2 }, vine: { f: 2400, q: 0.5, type: 'highpass', dur: 0.08, grains: 2 }, roots: { f: 1800, q: 0.6, type: 'highpass', dur: 0.09, grains: 2 }, azalea: { f: 2200, q: 0.5, type: 'highpass', dur: 0.09, grains: 2 }, moss: { f: 1200, q: 0.4, type: 'lowpass', dur: 0.1, grains: 1 }, fungus: { f: 1500, q: 0.6, type: 'highpass', dur: 0.08, grains: 1 }, nylium: { f: 1500, q: 0.7, type: 'bandpass', dur: 0.1, grains: 2 }, wart: { f: 1100, q: 0.6, type: 'lowpass', dur: 0.1, grains: 1 }, shroomlight: { f: 1100, q: 0.6, type: 'lowpass', dur: 0.1, grains: 1 }, big_dripleaf: { f: 1600, q: 0.5, type: 'highpass', dur: 0.09, grains: 1 },
    sand: { f: 3200, q: 0.8, type: 'bandpass', dur: 0.15, grains: 3, soft: true }, soul_sand: { f: 1400, q: 0.8, type: 'bandpass', dur: 0.15, grains: 3, soft: true }, soul_soil: { f: 1200, q: 0.7, type: 'bandpass', dur: 0.15, grains: 3, soft: true }, mud: { f: 500, q: 0.7, type: 'lowpass', dur: 0.13, grains: 2, soft: true }, mangrove_roots: { f: 900, q: 1, type: 'bandpass', dur: 0.1, grains: 2 },
    snow: { f: 900, q: 0.5, type: 'lowpass', dur: 0.12, grains: 3, soft: true }, wool: { f: 500, q: 0.5, type: 'lowpass', dur: 0.12, soft: true }, sponge: { f: 700, q: 0.5, type: 'lowpass', dur: 0.1, soft: true }, honey: { f: 400, q: 1, type: 'lowpass', dur: 0.15, soft: true }, slime: { f: 300, q: 2, type: 'lowpass', dur: 0.15, soft: true, squish: true },
    glass: { f: 3500, q: 2, type: 'bandpass', dur: 0.08, ring: [2600, 3900] }, amethyst: { f: 3000, q: 3, type: 'bandpass', dur: 0.1, ring: [1800, 2700, 3600] }, coral: { f: 1600, q: 1, type: 'bandpass', dur: 0.1 },
    metal: { f: 2400, q: 3, type: 'bandpass', dur: 0.1, ring: [1250, 1870] }, lantern: { f: 2400, q: 3, type: 'bandpass', dur: 0.08, ring: [1600, 2300] }, chain: { f: 3000, q: 2, type: 'bandpass', dur: 0.08, ring: [2200, 3300] }, anvil: { f: 2000, q: 3, type: 'bandpass', dur: 0.2, ring: [700, 1050, 1600] },
  };
  function material(id) { const d = BLOCKS[id]; if (!d) return MAT.stone; if (d.sound && MAT[d.sound]) return MAT[d.sound]; const n = d.name; if (n.endsWith('_leaves') || d.model === 'cross') return MAT.grass; if (n.includes('glass')) return MAT.glass; if (n.endsWith('_wool') || n.endsWith('_carpet')) return MAT.wool; if (n.includes('dirt') || n === 'farmland' || n === 'clay' || n === 'podzol' || n === 'mycelium' || n === 'grass_block') return MAT.gravel; return MAT.stone; }
  // one block sound: kind 'break' | 'place' | 'hit' | 'step'
  function blockSound(id, x, y, z, kind) {
    if (!ready) return;
    const m = material(id);
    const vol = { break: 1, place: 1, hit: 0.25, step: 0.15, fall: 0.5 }[kind] || 1;
    const pitch = { break: 0.8, place: 0.8, hit: 0.5, step: 1, fall: 0.75 }[kind] || 1;
    const t0 = T(), dest = out('sfx', x, y, z, vol);
    const dur = m.dur * (kind === 'break' || kind === 'place' ? 1.6 : 1) * (2 - pitch);
    const f = m.f * pitch * rp(0.85, 1.15);
    const grains = (m.grains || 1) + (kind === 'break' ? 1 : 0);
    for (let i = 0; i < grains; i++) noise(dest, t0 + i * dur * 0.35, dur * (i ? 0.6 : 1), m.type, f * rp(0.8, 1.2), m.q, (m.soft ? 0.35 : 0.5) / (i ? 2 : 1));
    if (m.thump) tone(dest, t0, 'sine', m.thump * pitch, 0.06, 0.35, { to: m.thump * 0.5 });
    if (m.knock) { tone(dest, t0, 'triangle', m.knock * pitch * rp(0.9, 1.1), 0.07, 0.35, { to: m.knock * 0.7 }); }
    if (m.ring) for (const r of m.ring) tone(dest, t0, 'sine', r * pitch * rp(0.97, 1.03), kind === 'break' ? 0.35 : 0.15, kind === 'break' && m === MAT.glass ? 0.1 : 0.07);
    if (m === MAT.glass && kind === 'break') for (let i = 0; i < 6; i++) noise(dest, t0 + i * 0.03, 0.06, 'highpass', 4000 + i * 300, 1, 0.2);
    if (m.squish) tone(dest, t0, 'sine', 180, 0.12, 0.3, { to: 90 });
  }
  // ---------------------------------------------------------------- named sounds
  const N = {};
  const at = (e, o) => (o && o.x !== undefined ? [o.x, o.y, o.z] : e ? [e.x, (e.y || 0) + (e.h || 0) / 2, e.z] : [undefined]);
  N.click = (d) => { tone(d, T(), 'square', 1300, 0.02, 0.15, { lp: 4000 }); noise(d, T(), 0.02, 'highpass', 3000, 1, 0.15); };
  N.ui = d => { tone(d, T(), 'square', 1000, 0.025, 0.12, { lp: 3000 }); noise(d, T(), 0.03, 'bandpass', 2500, 1, 0.12); };
  N.pop = (d, o) => { const p = (o && o.pitch) || rp(1.4, 2.6); tone(d, T(), 'sine', 380 * p, 0.06, 0.25, { to: 520 * p }); };
  N.orb = d => { const f = rp(0.55, 1.25) * 1800; tone(d, T(), 'sine', f, 0.35, 0.18); tone(d, T(), 'sine', f * 2, 0.2, 0.05); };
  N.levelup = d => { const t0 = T(); [523, 659, 784, 1047].forEach((f, i) => tone(d, t0 + i * 0.09, 'triangle', f, 0.6, 0.18)); };
  N.player_hurt = d => { const t0 = T(); noise(d, t0, 0.18, 'lowpass', 900, 3, 0.6, 0.005, (fl, t) => fl.frequency.exponentialRampToValueAtTime(250, t + 0.18)); tone(d, t0, 'sawtooth', 210, 0.15, 0.25, { to: 120, lp: 700 }); };
  N.attack_strong = d => { noise(d, T(), 0.12, 'bandpass', 900, 0.8, 0.5); tone(d, T(), 'sine', 120, 0.08, 0.35, { to: 60 }); };
  N.attack_weak = d => { noise(d, T(), 0.08, 'bandpass', 700, 0.8, 0.3); };
  N.attack_crit = d => { noise(d, T(), 0.15, 'bandpass', 1400, 1, 0.55); tone(d, T(), 'square', 300, 0.06, 0.15, { lp: 1200 }); };
  N.attack_sweep = d => { noise(d, T(), 0.25, 'bandpass', 600, 1.5, 0.4, 0.04, (fl, t) => fl.frequency.exponentialRampToValueAtTime(2400, t + 0.2)); };
  N.attack_nodamage = d => { noise(d, T(), 0.06, 'highpass', 1500, 0.7, 0.2); };
  N.attack_knockback = N.attack_strong;
  N.break_item = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.025, 0.06, 'highpass', 2000 + i * 500, 1, 0.3); tone(d, T(), 'square', 800, 0.1, 0.1, { to: 300, lp: 2500 }); };
  N.equip = d => { noise(d, T(), 0.12, 'bandpass', 2500, 2, 0.25); tone(d, T(), 'sine', 900, 0.1, 0.06); };
  N.eat = d => { for (let i = 0; i < 2; i++) noise(d, T() + i * 0.05, 0.06, 'bandpass', rp(1200, 2200), 1, 0.3); };
  N.burp = d => tone(d, T(), 'sawtooth', 110, 0.25, 0.3, { to: 80, lp: 500, vib: [30, 15] });
  N.drink = d => { for (let i = 0; i < 2; i++) tone(d, T() + i * 0.12, 'sine', 300, 0.08, 0.25, { to: 500 }); };
  N.fizz = d => noise(d, T(), 0.5, 'highpass', 3000, 0.5, 0.35, 0.01);
  N.extinguish = N.fizz;
  N.fall = (d, o) => { tone(d, T(), 'sine', o && o.big ? 70 : 110, 0.15, 0.6, { to: 40 }); noise(d, T(), 0.12, 'lowpass', 600, 1, 0.4); };
  N.explode = d => { const t0 = T(); noise(d, t0, 1.6, 'lowpass', 900, 0.8, 1.2, 0.005, (fl, t) => fl.frequency.exponentialRampToValueAtTime(90, t + 1.4)); tone(d, t0, 'sine', 70, 0.8, 1, { to: 30 }); for (let i = 0; i < 6; i++) noise(d, t0 + 0.05 + Math.random() * 0.5, 0.15, 'bandpass', rp(300, 1200), 1, 0.3); };
  N.tnt_primed = d => noise(d, T(), 1.5, 'highpass', 2500, 0.5, 0.35, 0.05);
  N.creeper_primed = N.tnt_primed;
  N.flint = d => { noise(d, T(), 0.08, 'highpass', 4000, 1, 0.5); tone(d, T(), 'square', 2500, 0.04, 0.08); };
  N.bow_shoot = (d, o) => { const p = (o && o.pitch) || 1; tone(d, T(), 'triangle', 330 * p, 0.12, 0.3, { to: 180 * p }); noise(d, T(), 0.15, 'bandpass', 1200, 1, 0.3); };
  N.crossbow_shoot = d => { tone(d, T(), 'square', 260, 0.08, 0.2, { to: 140, lp: 1500 }); noise(d, T(), 0.12, 'bandpass', 1800, 1, 0.4); };
  N.crossbow_loaded = d => { noise(d, T(), 0.05, 'bandpass', 2500, 3, 0.4); tone(d, T() + 0.05, 'square', 900, 0.04, 0.15, { lp: 2000 }); };
  N.skeleton_shoot = N.bow_shoot; N.snow_golem_shoot = d => noise(d, T(), 0.1, 'bandpass', 1500, 1, 0.3);
  N.arrow_hit = d => { tone(d, T(), 'triangle', 500, 0.1, 0.25, { to: 200 }); noise(d, T(), 0.06, 'bandpass', 2000, 1, 0.25); };
  N.arrow_hit_player = d => tone(d, T(), 'sine', 1200, 0.15, 0.2, { to: 1600 });
  N.throw = d => noise(d, T(), 0.18, 'bandpass', 800, 1, 0.3, 0.03, (fl, t) => fl.frequency.exponentialRampToValueAtTime(1800, t + 0.15));
  N.ender_pearl_throw = N.throw; N.witch_throw = N.throw; N.wind_charge_throw = N.throw; N.trident_throw = N.throw;
  N.splash_potion = d => { for (let i = 0; i < 5; i++) noise(d, T() + i * 0.02, 0.08, 'highpass', 3500, 1, 0.3); tone(d, T(), 'sine', 2600, 0.2, 0.08); };
  N.chest_open = d => { tone(d, T(), 'sawtooth', 160, 0.3, 0.15, { to: 230, lp: 900, vib: [18, 10] }); noise(d, T(), 0.1, 'bandpass', 600, 2, 0.2); };
  N.chest_close = d => { tone(d, T(), 'sawtooth', 200, 0.15, 0.15, { to: 120, lp: 800 }); tone(d, T() + 0.12, 'sine', 120, 0.08, 0.35, { to: 60 }); };
  N.barrel_open = N.chest_open; N.barrel_close = N.chest_close;
  N.door_open = d => { tone(d, T(), 'sawtooth', 220, 0.25, 0.12, { to: 300, lp: 1100, vib: [22, 12] }); noise(d, T(), 0.08, 'bandpass', 700, 2, 0.2); };
  N.door_close = d => { tone(d, T(), 'sine', 130, 0.08, 0.35, { to: 70 }); noise(d, T(), 0.06, 'bandpass', 700, 2, 0.3); };
  N.iron_door_open = d => { noise(d, T(), 0.4, 'bandpass', 900, 4, 0.3); tone(d, T(), 'sawtooth', 90, 0.4, 0.1, { lp: 600 }); };
  N.iron_door_close = d => { tone(d, T(), 'sine', 100, 0.1, 0.4, { to: 50 }); noise(d, T(), 0.1, 'bandpass', 1500, 3, 0.3); };
  N.lever = d => { tone(d, T(), 'square', 700, 0.02, 0.15, { lp: 2500 }); };
  N.button = N.lever; N.click_off = d => tone(d, T(), 'square', 550, 0.02, 0.12, { lp: 2000 });
  // trapdoors, fence gates and the redstone machines
  N.trapdoor_open = d => { tone(d, T(), 'sawtooth', 260, 0.15, 0.1, { to: 340, lp: 1200 }); noise(d, T(), 0.06, 'bandpass', 800, 2, 0.2); };
  N.trapdoor_close = d => { tone(d, T(), 'sine', 150, 0.07, 0.3, { to: 80 }); noise(d, T(), 0.05, 'bandpass', 800, 2, 0.25); };
  N.iron_trapdoor_open = N.iron_door_open; N.iron_trapdoor_close = N.iron_door_close;
  N.gate_open = d => { tone(d, T(), 'sawtooth', 240, 0.18, 0.1, { to: 320, lp: 1000, vib: [20, 10] }); noise(d, T(), 0.06, 'bandpass', 650, 2, 0.2); };
  N.gate_close = d => { tone(d, T(), 'sine', 140, 0.07, 0.3, { to: 75 }); noise(d, T(), 0.05, 'bandpass', 650, 2, 0.25); };
  N.piston_extend = d => { noise(d, T(), 0.18, 'bandpass', 500, 1.5, 0.45); tone(d, T(), 'sawtooth', 90, 0.15, 0.15, { to: 160, lp: 700 }); };
  N.piston_contract = d => { noise(d, T(), 0.16, 'bandpass', 420, 1.5, 0.4); tone(d, T(), 'sawtooth', 150, 0.14, 0.13, { to: 80, lp: 700 }); };
  N.dispense = d => { tone(d, T(), 'square', 1000, 0.03, 0.12, { lp: 3000 }); tone(d, T() + 0.04, 'square', 1000, 0.03, 0.1, { lp: 3000 }); };
  N.dispense_fail = d => { tone(d, T(), 'square', 1200, 0.03, 0.12, { lp: 3500 }); tone(d, T() + 0.04, 'square', 1200, 0.03, 0.1, { lp: 3500 }); };
  N.tripwire_click_on = d => tone(d, T(), 'square', 900, 0.02, 0.12, { lp: 3000 }); N.tripwire_click_off = d => tone(d, T(), 'square', 700, 0.02, 0.1, { lp: 3000 });
  N.tripwire_attach = d => tone(d, T(), 'triangle', 600, 0.05, 0.12); N.tripwire_detach = d => tone(d, T(), 'triangle', 400, 0.05, 0.12);
  N.copper_bulb_on = d => { tone(d, T(), 'sine', 1400, 0.12, 0.12); tone(d, T(), 'sine', 2100, 0.08, 0.05); }; N.copper_bulb_off = d => tone(d, T(), 'sine', 900, 0.1, 0.1, { to: 600 });
  N.crafter_craft = d => { noise(d, T(), 0.08, 'bandpass', 1500, 3, 0.25); tone(d, T(), 'square', 500, 0.05, 0.08, { lp: 2000 }); };
  N.crafter_fail = d => tone(d, T(), 'square', 300, 0.06, 0.1, { lp: 1500 });
  N.torch_burnout = d => noise(d, T(), 0.25, 'highpass', 2500, 0.7, 0.3);
  // hanging things, armor stands and signs
  N.painting_place = d => { noise(d, T(), 0.08, 'bandpass', 900, 2, 0.3); tone(d, T(), 'sine', 180, 0.06, 0.2, { to: 120 }); };
  N.painting_break = d => { noise(d, T(), 0.15, 'bandpass', 700, 1.5, 0.4); tone(d, T(), 'sawtooth', 140, 0.1, 0.12, { lp: 800, to: 70 }); };
  N.item_frame_place = N.painting_place; N.item_frame_break = N.painting_break;
  N.item_frame_add = d => { tone(d, T(), 'triangle', 520, 0.06, 0.15); noise(d, T(), 0.04, 'highpass', 2500, 1, 0.1); };
  N.item_frame_rotate = d => tone(d, T(), 'triangle', 760, 0.05, 0.12);
  N.item_frame_remove = d => tone(d, T(), 'triangle', 380, 0.07, 0.15, { to: 260 });
  N.armor_stand_place = d => { tone(d, T(), 'sine', 160, 0.08, 0.3, { to: 90 }); noise(d, T(), 0.06, 'bandpass', 600, 2, 0.2); };
  N.armor_stand_hit = d => { noise(d, T(), 0.06, 'bandpass', 1200, 2, 0.3); tone(d, T(), 'triangle', 300, 0.05, 0.15); };
  N.armor_stand_break = d => { noise(d, T(), 0.2, 'bandpass', 800, 1.2, 0.4); tone(d, T(), 'sawtooth', 120, 0.12, 0.12, { lp: 700, to: 60 }); };
  N.honeycomb_wax = d => { noise(d, T(), 0.12, 'bandpass', 3000, 3, 0.2); tone(d, T(), 'sine', 900, 0.1, 0.08, { to: 1200 }); };
  N.waxed_sign_fail = d => tone(d, T(), 'square', 220, 0.06, 0.08, { lp: 1200 });
  N.dye_use = d => { noise(d, T(), 0.1, 'bandpass', 2000, 2, 0.18); };
  // books, bookshelves and pots
  N.book_put = d => { noise(d, T(), 0.08, 'lowpass', 900, 1, 0.35); tone(d, T(), 'sine', 160, 0.08, 0.15, { to: 90 }); };
  N.book_page_turn = d => { noise(d, T(), 0.16, 'bandpass', 3500, 0.8, 0.14, 0.03); };
  N.chiseled_bookshelf_insert = d => { noise(d, T(), 0.1, 'lowpass', 1100, 1, 0.3); tone(d, T(), 'triangle', 220, 0.07, 0.12, { to: 140 }); };
  N.chiseled_bookshelf_pickup = d => { noise(d, T(), 0.1, 'lowpass', 1400, 1, 0.28); tone(d, T(), 'triangle', 180, 0.07, 0.1, { to: 260 }); };
  N.chiseled_bookshelf_insert_enchanted = d => { N.chiseled_bookshelf_insert(d); tone(d, T() + 0.02, 'sine', 1400, 0.3, 0.05, { to: 1900 }); };
  N.chiseled_bookshelf_pickup_enchanted = d => { N.chiseled_bookshelf_pickup(d); tone(d, T() + 0.02, 'sine', 1900, 0.3, 0.05, { to: 1400 }); };
  N.decorated_pot_insert = (d, o) => { const k = (o && o.pitch) || 1; tone(d, T(), 'sine', 420 * k, 0.18, 0.18, { to: 300 * k }); noise(d, T(), 0.08, 'bandpass', 1800 * k, 2, 0.12); };
  N.decorated_pot_shatter = d => { noise(d, T(), 0.25, 'bandpass', 2400, 1.2, 0.45); for (let k = 0; k < 4; k++) tone(d, T() + k * 0.03, 'triangle', 900 + Math.random() * 900, 0.06, 0.08); };
  N.decorated_pot_insert_fail = d => { tone(d, T(), 'sine', 260, 0.14, 0.14, { to: 220 }); noise(d, T(), 0.06, 'bandpass', 900, 2, 0.1); };
  N.glow_ink_use = d => { tone(d, T(), 'sine', 1200, 0.2, 0.1, { to: 1800 }); noise(d, T(), 0.1, 'bandpass', 2500, 2, 0.12); };
  N.ink_use = d => { noise(d, T(), 0.12, 'lowpass', 900, 1, 0.2); };
  // fishing and leads
  N.bobber_throw = d => { noise(d, T(), 0.2, 'bandpass', 1800, 2, 0.15, 0.01, (fl, t) => fl.frequency.exponentialRampToValueAtTime(600, t + 0.2)); };
  N.bobber_splash = d => { noise(d, T(), 0.3, 'lowpass', 2000, 0.7, 0.4, 0.005, (fl, t) => fl.frequency.exponentialRampToValueAtTime(500, t + 0.3)); };
  N.bobber_retrieve = d => { noise(d, T(), 0.12, 'bandpass', 1400, 2, 0.15); tone(d, T(), 'triangle', 500, 0.08, 0.06, { to: 900 }); };
  N.leash_attach = d => { noise(d, T(), 0.1, 'bandpass', 600, 2, 0.25); };
  N.leash_place = N.leash_attach; N.leash_untie = d => noise(d, T(), 0.08, 'bandpass', 800, 2, 0.2);
  N.leash_break = d => { noise(d, T(), 0.06, 'highpass', 2500, 1, 0.3); tone(d, T(), 'sine', 300, 0.06, 0.15, { to: 120 }); };
  N.loom_take = d => { noise(d, T(), 0.12, 'bandpass', 2400, 3, 0.2); };
  N.cartography_take = d => { noise(d, T(), 0.15, 'bandpass', 3000, 2, 0.2); tone(d, T(), 'triangle', 700, 0.05, 0.05); };
  N.bucket_fill = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.05, 0.1, 'bandpass', 800 + i * 200, 2, 0.3); };
  N.bucket_empty = N.bucket_fill; N.bottle_fill = d => { tone(d, T(), 'sine', 400, 0.3, 0.15, { to: 900 }); noise(d, T(), 0.2, 'bandpass', 1500, 3, 0.15); }; N.bottle_empty = N.bottle_fill;
  N.bucket_fill_lava = d => noise(d, T(), 0.3, 'lowpass', 500, 1, 0.4); N.bucket_empty_lava = N.bucket_fill_lava;
  N.splash = d => { noise(d, T(), 0.4, 'lowpass', 1500, 0.7, 0.6, 0.005, (fl, t) => fl.frequency.exponentialRampToValueAtTime(400, t + 0.4)); };
  N.swim = d => noise(d, T(), 0.25, 'bandpass', rp(600, 1100), 1, 0.15, 0.05);
  N.hoe_till = d => blockSoundTo(d, BID.dirt, 'place'); N.shovel_flatten = d => blockSoundTo(d, BID.grass_block, 'place'); N.axe_strip = d => blockSoundTo(d, BID.oak_log, 'place');
  N.bone_meal = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.04, 0.05, 'highpass', 3000, 1, 0.2); };
  N.craft = d => {};
  N.shear = d => { noise(d, T(), 0.05, 'highpass', 4000, 2, 0.3); noise(d, T() + 0.07, 0.05, 'highpass', 4500, 2, 0.3); };
  N.saddle = N.equip; N.berry_pick = N.pop; N.pumpkin_carve = d => blockSoundTo(d, BID.pumpkin, 'hit');
  N.composter_fill = d => noise(d, T(), 0.1, 'lowpass', 900, 1, 0.3); N.composter_fill_success = d => { N.composter_fill(d); tone(d, T() + 0.05, 'sine', 700, 0.1, 0.1); }; N.composter_empty = N.composter_fill;
  N.totem = d => { const t0 = T(); [660, 880, 990, 1320].forEach((f, i) => tone(d, t0 + i * 0.07, 'triangle', f, 0.8, 0.2, { vib: [6, 8] })); noise(d, t0, 1, 'highpass', 5000, 0.5, 0.15, 0.1); };
  N.portal_ambient = d => tone(d, T(), 'sawtooth', rp(50, 70), 2.5, 0.08, { lp: 300, attack: 0.5, vib: [0.5, 8] });
  N.teleport = d => { tone(d, T(), 'sine', 200, 0.5, 0.25, { to: 1200, glide: 0.4, vib: [12, 40] }); };
  N.enderman_teleport = N.teleport;
  N.enderman_stare = d => { tone(d, T(), 'sawtooth', 80, 1.2, 0.3, { lp: 800, vib: [7, 20] }); noise(d, T(), 1, 'bandpass', 3000, 4, 0.15, 0.2); };
  N.fire_ambient = d => { for (let i = 0; i < 6; i++) noise(d, T() + Math.random() * 0.8, 0.03, 'highpass', 2500, 1, 0.15); noise(d, T(), 1, 'lowpass', 400, 0.5, 0.08, 0.3); };
  N.campfire_crackle = d => { for (let i = 0; i < 3; i++) noise(d, T() + Math.random() * 0.4, 0.025, 'highpass', 3000, 1, 0.15); };
  N.lava_pop = d => tone(d, T(), 'sine', 220, 0.08, 0.3, { to: 500 });
  N.lava_ambient = d => noise(d, T(), 1, 'lowpass', 300, 1, 0.15, 0.3);
  N.firework_launch = d => noise(d, T(), 0.8, 'bandpass', 1500, 1, 0.3, 0.05, (fl, t) => fl.frequency.exponentialRampToValueAtTime(4000, t + 0.7));
  N.firework_blast = (d, o) => { N.explode(d); if (o && o.large) tone(d, T(), 'sine', 50, 1, 0.6, { to: 25 }); setTimeout(() => { if (ac) for (let i = 0; i < 8; i++) noise(d, T() + Math.random() * 0.6, 0.03, 'highpass', 4000, 1, 0.12); }, 400); };
  N.shield_block = d => { tone(d, T(), 'triangle', 280, 0.12, 0.35, { to: 180 }); noise(d, T(), 0.08, 'bandpass', 1200, 2, 0.3); };
  N.spyglass = d => tone(d, T(), 'sine', 1500, 0.15, 0.08, { to: 2200 });
  N.goat_horn = d => { const t0 = T(); tone(d, t0, 'sawtooth', 220, 2.5, 0.35, { lp: 1400, vib: [5, 4], attack: 0.15 }); tone(d, t0, 'sawtooth', 330, 2.5, 0.2, { lp: 1200, attack: 0.2 }); };
  N.bell = d => { [700, 1140, 1680, 2400].forEach((f, i) => tone(d, T(), 'sine', f, 2.5 - i * 0.4, 0.2 / (i + 1))); };
  N.anvil_land = d => { [700, 1050, 1600, 2300].forEach((f, i) => tone(d, T(), 'sine', f, 0.8, 0.2 / (i + 1))); noise(d, T(), 0.1, 'bandpass', 2000, 2, 0.3); };
  N.anvil_use = N.anvil_land; N.anvil_destroy = d => { N.anvil_land(d); N.break_item(d); };
  N.trident_hit = d => tone(d, T(), 'triangle', 600, 0.15, 0.3, { to: 300 }); N.trident_return = d => tone(d, T(), 'sine', 900, 0.3, 0.15, { to: 1600 }); N.trident_riptide = d => noise(d, T(), 0.6, 'bandpass', 800, 1, 0.5, 0.02, (fl, t) => fl.frequency.exponentialRampToValueAtTime(3000, t + 0.5));
  N.ender_eye_launch = N.throw; N.ender_eye_death = N.break_item; N.eye_place = d => { tone(d, T(), 'sine', 900, 0.3, 0.2); tone(d, T(), 'sine', 1350, 0.3, 0.1); };
  N.anchor_charge = d => tone(d, T(), 'sine', 300, 0.5, 0.25, { to: 700 }); N.anchor_set = N.anchor_charge;
  N.wind_burst = d => noise(d, T(), 0.4, 'bandpass', 500, 0.8, 0.6, 0.01, (fl, t) => fl.frequency.exponentialRampToValueAtTime(2000, t + 0.3));
  N.chicken_egg = d => { tone(d, T(), 'sine', 600, 0.05, 0.2); N.pop(d); };
  N.cow_milk = N.bucket_fill; N.mooshroom_milk = N.bucket_fill; N.iron_golem_repair = d => { [500, 700].forEach(f => tone(d, T(), 'sine', f, 0.3, 0.1)); };
  N.villager_no = d => tone(d, T(), 'sawtooth', 240, 0.25, 0.25, { to: 160, lp: 1200, bp: 800, q: 3 });
  N.zombie_villager_cure = d => { tone(d, T(), 'sawtooth', 180, 1, 0.2, { to: 400, lp: 1000 }); };
  N.witch_drink = N.drink; N.fish_flop = d => noise(d, T(), 0.06, 'lowpass', 1200, 2, 0.4);
  // ---------------------------------------------------------------- mob voices
  const voice = (d, f, dur, o) => tone(d, T(), o.type || 'sawtooth', f, dur, o.v || 0.25, o);
  const MOB = {
    pig: { say: d => { voice(d, rp(150, 190), 0.18, { lp: 900, bp: 700, q: 4, vib: [40, 30] }); }, hurt: d => voice(d, 260, 0.2, { lp: 1200, bp: 900, q: 4, to: 180 }), death: d => voice(d, 230, 0.5, { lp: 1000, bp: 700, q: 3, to: 90 }) },
    cow: { say: d => voice(d, rp(95, 115), 0.9, { lp: 700, bp: 400, q: 3, to: 80, attack: 0.08, vib: [5, 4], v: 0.3 }), hurt: d => voice(d, 160, 0.3, { lp: 900, bp: 500, q: 3, to: 100 }), death: d => voice(d, 140, 0.8, { lp: 800, bp: 450, q: 3, to: 60 }) },
    mooshroom: null, sheep: { say: d => voice(d, rp(330, 380), 0.55, { lp: 1600, bp: 900, q: 3, vib: [9, 25], attack: 0.03 }), hurt: d => voice(d, 420, 0.25, { lp: 1800, bp: 1000, q: 3, vib: [12, 30] }), death: d => voice(d, 360, 0.6, { lp: 1500, bp: 800, q: 3, vib: [10, 30], to: 200 }) },
    chicken: { say: d => { for (let i = 0; i < 3; i++) tone(d, T() + i * 0.09, 'square', rp(900, 1300), 0.05, 0.08, { lp: 2500 }); }, hurt: d => tone(d, T(), 'square', 1400, 0.12, 0.12, { to: 900, lp: 3000 }), death: d => tone(d, T(), 'square', 1300, 0.3, 0.12, { to: 500, lp: 3000 }) },
    zombie: { say: d => voice(d, rp(85, 105), 0.9, { lp: 500, bp: 300, q: 2, vib: [4, 8], attack: 0.1, v: 0.35 }), hurt: d => voice(d, 140, 0.3, { lp: 700, bp: 400, q: 2, to: 90 }), death: d => voice(d, 110, 1, { lp: 600, bp: 300, q: 2, to: 50, vib: [5, 10] }) },
    skeleton: { say: d => { for (let i = 0; i < 5; i++) noise(d, T() + i * 0.06 + Math.random() * 0.03, 0.025, 'bandpass', rp(1500, 3500), 4, 0.25); }, hurt: d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.04, 0.03, 'bandpass', rp(1800, 3000), 4, 0.35); }, death: d => { for (let i = 0; i < 10; i++) noise(d, T() + i * 0.05, 0.03, 'bandpass', rp(1200, 3000), 4, 0.3); } },
    creeper: { say: null, hurt: d => noise(d, T(), 0.25, 'bandpass', 2000, 2, 0.35), death: d => noise(d, T(), 0.5, 'bandpass', 1600, 2, 0.35) },
    spider: { say: d => { noise(d, T(), 0.4, 'bandpass', 2500, 3, 0.2, 0.05); for (let i = 0; i < 4; i++) noise(d, T() + i * 0.07, 0.02, 'highpass', 3000, 1, 0.15); }, hurt: d => noise(d, T(), 0.2, 'bandpass', 2800, 3, 0.35), death: d => noise(d, T(), 0.6, 'bandpass', 2000, 2, 0.35, 0.01, (fl, t) => fl.frequency.exponentialRampToValueAtTime(600, t + 0.6)) },
    enderman: { say: d => voice(d, rp(200, 300), 0.6, { type: 'sine', vib: [14, 60], v: 0.2 }), hurt: d => voice(d, 300, 0.4, { type: 'sawtooth', lp: 1500, vib: [20, 80] }), death: d => voice(d, 260, 1.2, { lp: 1200, vib: [16, 100], to: 80 }) },
    slime: { say: null, hurt: d => tone(d, T(), 'sine', 220, 0.15, 0.4, { to: 110 }), death: d => tone(d, T(), 'sine', 180, 0.3, 0.4, { to: 70 }) },
    villager: { say: d => voice(d, rp(160, 210), 0.35, { lp: 1200, bp: 600, q: 3, vib: [6, 15], to: rp(150, 240) }), hurt: d => voice(d, 230, 0.25, { lp: 1300, bp: 700, q: 3 }), death: d => voice(d, 200, 0.6, { lp: 1200, bp: 600, q: 3, to: 100 }) },
    iron_golem: { say: null, hurt: d => { tone(d, T(), 'sine', 160, 0.2, 0.4, { to: 90 }); [800, 1200].forEach(f => tone(d, T(), 'sine', f, 0.3, 0.06)); }, death: d => { tone(d, T(), 'sine', 120, 0.6, 0.4, { to: 50 }); N.anvil_land(d); } },
    wolf: { say: d => { tone(d, T(), 'sawtooth', 500, 0.08, 0.25, { lp: 1800, bp: 900, q: 2, to: 350 }); tone(d, T() + 0.18, 'sawtooth', 500, 0.08, 0.2, { lp: 1800, bp: 900, q: 2, to: 350 }); }, hurt: d => voice(d, 900, 0.2, { lp: 2500, to: 600 }), death: d => voice(d, 800, 0.6, { lp: 2400, to: 300 }) },
    cat: { say: d => voice(d, rp(600, 800), 0.45, { type: 'triangle', to: rp(400, 550), glide: 0.4, vib: [7, 15], lp: 2500, v: 0.2 }), hurt: d => voice(d, 900, 0.25, { type: 'sawtooth', lp: 2500, to: 700 }), death: d => voice(d, 800, 0.7, { type: 'triangle', to: 300 }) },
    witch: { say: d => voice(d, rp(250, 330), 0.3, { lp: 1600, bp: 900, q: 3, vib: [10, 20] }), hurt: d => voice(d, 380, 0.25, { lp: 1800 }), death: d => voice(d, 340, 0.7, { lp: 1600, to: 150 }) },
    bat: { say: d => { for (let i = 0; i < 2; i++) tone(d, T() + i * 0.08, 'sine', rp(3000, 4000), 0.04, 0.05); }, hurt: d => tone(d, T(), 'sine', 3500, 0.1, 0.08, { to: 2500 }), death: d => tone(d, T(), 'sine', 3200, 0.2, 0.08, { to: 1500 }) },
    snow_golem: { say: null, hurt: d => noise(d, T(), 0.15, 'lowpass', 900, 1, 0.3), death: d => noise(d, T(), 0.4, 'lowpass', 900, 1, 0.35) },
    fish: { say: null, hurt: d => N.fish_flop(d), death: d => N.fish_flop(d) },
    squid: { say: d => noise(d, T(), 0.5, 'lowpass', 400, 1, 0.12, 0.1), hurt: d => noise(d, T(), 0.2, 'lowpass', 500, 2, 0.3), death: d => noise(d, T(), 0.5, 'lowpass', 400, 2, 0.3) },
    generic: { say: null, hurt: d => noise(d, T(), 0.15, 'bandpass', 900, 1, 0.3), death: d => noise(d, T(), 0.3, 'bandpass', 700, 1, 0.3) },
  };
  MOB.mooshroom = MOB.cow; MOB.husk = MOB.zombie; MOB.drowned = { say: d => voice(d, rp(80, 100), 0.9, { lp: 400, bp: 250, q: 2, vib: [3, 12], v: 0.35 }), hurt: MOB.zombie.hurt, death: MOB.zombie.death }; MOB.zombie_villager = MOB.zombie;
  MOB.warden = { say: d => { voice(d, rp(45, 60), 1.2, { type: 'sawtooth', lp: 300, bp: 120, q: 2, vib: [3, 6], attack: 0.15, v: 0.45 }); noise(d, T(), 1, 'lowpass', 200, 1, 0.12, 0.2); },
    hurt: d => { voice(d, 90, 0.4, { lp: 500, bp: 200, q: 2, to: 50, v: 0.5 }); noise(d, T(), 0.3, 'lowpass', 400, 1, 0.3); },
    death: d => { voice(d, 70, 2.2, { lp: 400, bp: 150, q: 2, to: 30, vib: [4, 10], v: 0.5 }); noise(d, T(), 2, 'lowpass', 300, 1, 0.25, 0.3); } };
  MOB.stray = MOB.skeleton; MOB.bogged = MOB.skeleton; MOB.wither_skeleton = MOB.skeleton; MOB.cave_spider = MOB.spider; MOB.magma_cube = MOB.slime; MOB.wandering_trader = MOB.villager; MOB.ocelot = MOB.cat;
  MOB.cod = MOB.fish; MOB.salmon = MOB.fish; MOB.tropical_fish = MOB.fish; MOB.pufferfish = MOB.fish; MOB.glow_squid = MOB.squid;
  N.magma_cube_squish = d => tone(d, T(), 'sine', 160, 0.12, 0.3, { to: 80 }); N.slime_squish = d => tone(d, T(), 'sine', 220, 0.12, 0.3, { to: 120 }); N.slime_jump = d => tone(d, T(), 'sine', 180, 0.1, 0.2, { to: 300 }); N.magma_cube_jump = N.slime_jump;
  N.iron_golem_attack = d => { noise(d, T(), 0.15, 'lowpass', 600, 1, 0.5); tone(d, T(), 'sine', 90, 0.2, 0.5, { to: 50 }); };
  function blockSoundTo(d, id, kind) { blockSound(id, undefined, undefined, undefined, kind); }
  // ---------------------------------------------------------------- the public API
  function play(name, e, o) {
    // the sounds of things that sculk sensors and wardens can feel (game events)
    if (EV[name] && typeof GameEvents !== 'undefined' && Game && Game.player) {
      const ev = typeof EV[name] === 'function' ? EV[name](o || {}) : EV[name];
      if (ev) { const [x, y, z] = at(e, o); if (x !== undefined) { const c = o && o.x !== undefined && Number.isInteger(o.x) ? 0.5 : 0; GameEvents.emit(ev, x + c, y + c, z + c, e && e.x !== undefined ? e : GameEvents.actor, o && o.block); } }
    }
    if (!ready || !Game) return;
    o = o || {};
    let [x, y, z] = at(e, o);
    if (e && e.isPlayer && e === Game.player) x = undefined; // the player's own sounds are not positioned
    const mobKey = name.replace(/_(hurt|death|ambient|say|eat)$/, ''), kind = (name.match(/_(hurt|death|ambient|say)$/) || [])[1];
    if (kind && (MOB[mobKey] || o.mob)) {
      const v = MOB[mobKey] || MOB.generic, fn = kind === 'ambient' ? v.say : v[kind] || v.hurt;
      if (!fn) return;
      const d = out('sfx', x, y, z, 1, 16);
      fn(d);
      if (o.subtitle !== false) subtitle(name, x, y, z);
      return;
    }
    const fn = N[name]; if (!fn) return;
    const range = name === 'explode' || name === 'firework_blast' ? 64 : name === 'bell' ? 32 : name === 'goat_horn' ? 256 : name === 'thunder' ? 1e6 : /^warden_(roar|sonic|emerge|dig|nearby|listening|heartbeat|tendril|attack)/.test(name) || name === 'sculk_shrieker_shriek' ? 48 : 16;
    const d = out(name === 'click' || name === 'ui' ? 'ui' : 'sfx', x, y, z, 1, range);
    fn(d, o);
    subtitle(name, x, y, z);
  }
  function step(e) {
    const x = Math.floor(e.x), y = Math.floor(e.y - 0.2), z = Math.floor(e.z);
    let id = World.getBlock(x, y, z); const above = World.getBlock(x, y + 1, z);
    if (BLOCKS[above].name === 'snow' || BLOCKS[above].model === 'carpet') id = above;
    if (id === 0) return;
    if (e.inWater) { play('swim', e); return; }
    blockSound(id, e === Game.player ? undefined : e.x, e.y, e.z, 'step');
  }
  // subtitles (accessibility): a short list in the corner
  function subtitle(name, x, y, z) { if (!Settings.subtitles) return; const t = name.replace(/_/g, ' '); const now = performance.now(); const f = SUBS.find(s => s.t === t); if (f) { f.time = now; f.x = x; f.z = z; } else { SUBS.push({ t, time: now, x, z }); if (SUBS.length > 8) SUBS.shift(); } }
  // bees
  N.bee_loop = d => tone(d, T(), 'sawtooth', rp(190, 230), 0.8, 0.025, { lp: 900, vib: [28, 12], attack: 0.1 });
  N.bee_loop_aggressive = d => tone(d, T(), 'sawtooth', rp(260, 310), 0.8, 0.04, { lp: 1400, vib: [34, 18], attack: 0.05 });
  N.bee_sting = d => { noise(d, T(), 0.06, 'highpass', 4000, 1, 0.35); tone(d, T(), 'square', 900, 0.08, 0.06, { to: 500, lp: 3000 }); };
  N.bee_pollinate = d => { tone(d, T(), 'sawtooth', 240, 0.5, 0.03, { lp: 1000, vib: [20, 25] }); for (let i = 0; i < 3; i++) tone(d, T() + 0.1 * i, 'sine', 1400 + i * 200, 0.08, 0.03); };
  N.beehive_enter = d => { noise(d, T(), 0.15, 'lowpass', 1200, 1, 0.2); tone(d, T(), 'sawtooth', 220, 0.3, 0.03, { lp: 800, to: 150 }); };
  N.beehive_exit = d => { noise(d, T(), 0.15, 'lowpass', 1200, 1, 0.2); tone(d, T(), 'sawtooth', 160, 0.3, 0.03, { lp: 800, to: 230 }); };
  N.beehive_work = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.07, 0.04, 'bandpass', 1800, 4, 0.1); };
  N.beehive_shear = d => { noise(d, T(), 0.2, 'bandpass', 2600, 2, 0.25); };
  // trial spawners and vaults
  N.trial_spawner_detect_player = d => { tone(d, T(), 'square', 330, 0.12, 0.08, { lp: 1500 }); tone(d, T() + 0.1, 'square', 495, 0.15, 0.08, { lp: 1500 }); };
  N.trial_spawner_spawn_mob = d => { noise(d, T(), 0.3, 'bandpass', 1500, 1.5, 0.3, 0.01); tone(d, T(), 'sawtooth', 220, 0.2, 0.08, { to: 440, lp: 1800 }); };
  N.trial_spawner_open_shutter = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.06, 0.05, 'bandpass', 2400, 4, 0.25); tone(d, T(), 'square', 260, 0.25, 0.06, { to: 390, lp: 1500 }); };
  N.trial_spawner_close_shutter = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.06, 0.05, 'bandpass', 1800, 4, 0.25); tone(d, T(), 'square', 390, 0.25, 0.06, { to: 260, lp: 1500 }); };
  N.trial_spawner_eject_item = d => { noise(d, T(), 0.12, 'bandpass', 2000, 2, 0.3); tone(d, T(), 'sine', 600, 0.15, 0.1, { to: 900 }); };
  N.trial_spawner_ominous_activate = d => { tone(d, T(), 'sawtooth', 120, 1.2, 0.18, { to: 60, lp: 900, vib: [5, 10] }); tone(d, T(), 'sine', 900, 1, 0.06, { to: 1500 }); };
  N.trial_spawner_spawn_item_begin = d => tone(d, T(), 'sine', 500, 0.6, 0.08, { to: 800, attack: 0.2 });
  N.trial_spawner_spawn_item = d => { noise(d, T(), 0.15, 'bandpass', 1600, 2, 0.2); tone(d, T(), 'sine', 800, 0.2, 0.08, { to: 400 }); };
  N.trial_spawner_ambient = d => { noise(d, T(), 0.4, 'bandpass', 900, 2, 0.06, 0.1); };
  N.trial_spawner_ambient_ominous = d => { noise(d, T(), 0.5, 'bandpass', 1300, 2, 0.06, 0.1); tone(d, T(), 'sine', 220, 0.5, 0.03, { vib: [6, 8] }); };
  N.vault_activate = d => { tone(d, T(), 'sine', 440, 0.3, 0.08, { to: 660 }); tone(d, T() + 0.1, 'sine', 880, 0.3, 0.05); };
  N.vault_deactivate = d => { tone(d, T(), 'sine', 660, 0.3, 0.08, { to: 440 }); };
  N.vault_insert_item = d => { noise(d, T(), 0.1, 'bandpass', 2600, 3, 0.25); tone(d, T(), 'square', 300, 0.1, 0.06, { lp: 1200 }); };
  N.vault_insert_item_fail = d => tone(d, T(), 'square', 160, 0.15, 0.08, { lp: 900 });
  N.vault_reject_rewarded_player = d => { tone(d, T(), 'square', 200, 0.12, 0.07, { lp: 900 }); tone(d, T() + 0.14, 'square', 150, 0.15, 0.07, { lp: 900 }); };
  N.vault_open_shutter = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.05, 0.04, 'bandpass', 2400, 4, 0.25); };
  N.vault_close_shutter = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.05, 0.04, 'bandpass', 1700, 4, 0.25); };
  N.vault_eject_item = (d, o) => { const k = (o && o.pitch) || 1; noise(d, T(), 0.1, 'bandpass', 2000 * k, 2, 0.25); tone(d, T(), 'sine', 600 * k, 0.15, 0.1, { to: 900 * k }); };
  N.ominous_bottle_dispose = d => { noise(d, T(), 0.3, 'highpass', 2500, 1, 0.25); tone(d, T(), 'sine', 300, 0.6, 0.08, { to: 150, vib: [8, 20] }); };
  // the mace
  N.mace_smash_air = d => { noise(d, T(), 0.3, 'lowpass', 1200, 1, 0.5, 0.005); tone(d, T(), 'sine', 140, 0.25, 0.4, { to: 60 }); };
  N.mace_smash_ground = d => { tone(d, T(), 'sine', 90, 0.4, 0.7, { to: 35 }); noise(d, T(), 0.45, 'lowpass', 900, 1, 0.6, 0.003); };
  N.mace_smash_ground_heavy = d => { tone(d, T(), 'sine', 70, 0.7, 0.9, { to: 25 }); noise(d, T(), 0.7, 'lowpass', 700, 1, 0.8, 0.003); for (let i = 0; i < 5; i++) noise(d, T() + 0.05 + i * 0.05, 0.08, 'bandpass', rp(800, 2000), 3, 0.25); };
  // the deep dark
  N.sculk_clicking = d => { for (let i = 0; i < 7; i++) noise(d, T() + i * 0.045 + Math.random() * 0.02, 0.02, 'bandpass', rp(1800, 3200), 6, 0.3); };
  N.sculk_clicking_stop = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.07, 0.02, 'bandpass', rp(1500, 2500), 6, 0.2); };
  N.sculk_shrieker_shriek = d => { tone(d, T(), 'sawtooth', 700, 2.2, 0.12, { to: 900, lp: 2500, vib: [6, 40], attack: 0.3 }); tone(d, T(), 'sine', 1400, 2, 0.06, { to: 1800, vib: [5, 60], attack: 0.4 }); noise(d, T(), 2.2, 'bandpass', 1200, 3, 0.08, 0.4); };
  N.sculk_catalyst_bloom = (d, o) => { const k = (o && o.pitch) || 1; tone(d, T(), 'sine', 300 * k, 0.8, 0.12, { to: 600 * k, attack: 0.1 }); noise(d, T(), 0.6, 'lowpass', 800, 1, 0.12, 0.15); };
  N.sculk_block_spread = d => { noise(d, T(), 0.18, 'lowpass', 600, 2, 0.25, 0.01); tone(d, T(), 'sine', 140, 0.12, 0.1, { to: 90 }); };
  N.amethyst_block_resonate = (d, o) => { const k = (o && o.pitch) || 1; [1, 2.01, 3.03].forEach((h, i) => tone(d, T(), 'sine', 880 * k * h, 1.4 - i * 0.3, 0.08 / (i + 1), { attack: 0.01 })); };
  N.warden_heartbeat = d => { tone(d, T(), 'sine', 55, 0.12, 0.5, { to: 40 }); tone(d, T() + 0.22, 'sine', 50, 0.14, 0.4, { to: 36 }); };
  N.warden_tendril_clicks = d => { for (let i = 0; i < 9; i++) noise(d, T() + i * 0.035 + Math.random() * 0.01, 0.018, 'bandpass', rp(2500, 4000), 6, 0.3); };
  N.warden_listening = d => { voice(d, 70, 0.9, { lp: 350, bp: 150, q: 2, vib: [2, 4], attack: 0.2, v: 0.35 }); N.warden_tendril_clicks(d); };
  N.warden_listening_angry = d => { voice(d, 80, 1.1, { lp: 600, bp: 200, q: 2, vib: [5, 10], attack: 0.1, v: 0.5 }); N.warden_tendril_clicks(d); };
  N.warden_agitated = d => voice(d, rp(60, 75), 1, { lp: 500, bp: 180, q: 2, vib: [4, 8], attack: 0.1, v: 0.45 });
  N.warden_angry = d => { voice(d, rp(70, 90), 1.2, { lp: 800, bp: 250, q: 2, vib: [7, 14], attack: 0.05, v: 0.55 }); noise(d, T(), 0.8, 'lowpass', 500, 1, 0.2); };
  N.warden_roar = d => { voice(d, 85, 3, { lp: 1200, bp: 300, q: 1.5, vib: [6, 20], attack: 0.3, to: 60, v: 0.7 }); noise(d, T(), 3, 'lowpass', 900, 1, 0.4, 0.4); };
  N.warden_sonic_charge = d => { tone(d, T(), 'sawtooth', 80, 1.6, 0.25, { to: 600, lp: 1500, attack: 0.5 }); noise(d, T(), 1.6, 'bandpass', 600, 2, 0.15, 0.8, (fl, t) => fl.frequency.exponentialRampToValueAtTime(3000, t + 1.6)); };
  N.warden_sonic_boom = d => { tone(d, T(), 'sine', 90, 1.2, 0.8, { to: 30 }); noise(d, T(), 0.9, 'lowpass', 1800, 0.7, 0.7, 0.005, (fl, t) => fl.frequency.exponentialRampToValueAtTime(200, t + 0.9)); tone(d, T(), 'sawtooth', 400, 0.5, 0.2, { to: 80, lp: 2000 }); };
  N.warden_emerge = d => { noise(d, T(), 4, 'lowpass', 400, 1, 0.45, 0.5); voice(d, 55, 4, { lp: 300, bp: 100, q: 2, vib: [3, 8], attack: 1.5, v: 0.4 }); };
  N.warden_dig = d => { noise(d, T(), 3, 'lowpass', 500, 1, 0.45, 0.3); voice(d, 60, 2, { lp: 300, bp: 120, q: 2, to: 35, v: 0.35 }); };
  N.warden_sniff = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.32, 0.22, 'bandpass', 1400, 1.5, 0.25, 0.08); };
  N.warden_attack_impact = d => { tone(d, T(), 'sine', 70, 0.3, 0.8, { to: 35 }); noise(d, T(), 0.25, 'lowpass', 900, 1, 0.6); };
  N.warden_step = d => tone(d, T(), 'sine', 60, 0.2, 0.4, { to: 35 });
  N.warden_nearby_close = d => voice(d, 50, 2.5, { lp: 250, bp: 100, q: 2, vib: [2, 5], attack: 0.8, v: 0.25 });
  N.warden_nearby_closer = d => voice(d, 55, 2.5, { lp: 350, bp: 120, q: 2, vib: [3, 7], attack: 0.6, v: 0.35 });
  N.warden_nearby_closest = d => { voice(d, 60, 2.5, { lp: 500, bp: 150, q: 2, vib: [4, 9], attack: 0.4, v: 0.45 }); noise(d, T(), 2, 'lowpass', 300, 1, 0.2, 0.5); };
  // which sounds are game events (the game raises the event where these happen)
  const EV = {
    door_open: 'block_open', iron_door_open: 'block_open', trapdoor_open: 'block_open', iron_trapdoor_open: 'block_open', gate_open: 'block_open',
    door_close: 'block_close', iron_door_close: 'block_close', trapdoor_close: 'block_close', iron_trapdoor_close: 'block_close', gate_close: 'block_close',
    chest_open: 'container_open', barrel_open: 'container_open', chest_close: 'container_close', barrel_close: 'container_close',
    click: o => o.on === true ? 'block_activate' : o.on === false ? 'block_deactivate' : null, button: 'block_activate', click_off: 'block_deactivate',
    piston_extend: 'block_activate', piston_contract: 'block_deactivate', tripwire_click_on: 'block_activate', tripwire_click_off: 'block_deactivate', tripwire_attach: 'block_attach', tripwire_detach: 'block_detach',
    eat: 'eat', drink: 'drink', witch_drink: 'drink', bucket_fill: 'fluid_pickup', bucket_fill_lava: 'fluid_pickup', bottle_fill: 'fluid_pickup', bucket_empty: 'fluid_place', bucket_empty_lava: 'fluid_place', bottle_empty: 'fluid_place',
    splash: 'splash', bobber_splash: 'splash', hoe_till: 'block_change', shovel_flatten: 'block_change', axe_strip: 'block_change', bone_meal: 'block_change', berry_pick: 'block_change',
    shear: 'shear', pumpkin_carve: 'shear', composter_fill: 'block_change', composter_fill_success: 'block_change', composter_empty: 'block_change',
    explode: 'explode', firework_blast: 'explode', tnt_primed: 'prime_fuse', creeper_primed: 'prime_fuse', flint: 'block_place', teleport: 'teleport', enderman_teleport: 'teleport',
    goat_horn: 'instrument_play', bell: 'block_change', equip: 'equip', saddle: 'equip', eye_place: 'block_change', anchor_charge: 'block_change', extinguish: 'block_change',
    painting_place: 'entity_place', item_frame_place: 'entity_place', armor_stand_place: 'entity_place', leash_place: 'entity_place', chicken_egg: 'entity_place',
    item_frame_add: 'block_change', item_frame_rotate: 'block_change', item_frame_remove: 'block_change', book_put: 'block_change', chiseled_bookshelf_insert: 'block_change', chiseled_bookshelf_pickup: 'block_change',
    chiseled_bookshelf_insert_enchanted: 'block_change', chiseled_bookshelf_pickup_enchanted: 'block_change', decorated_pot_insert: 'block_change', dye_use: 'block_change', glow_ink_use: 'block_change', ink_use: 'block_change', honeycomb_wax: 'block_change',
    bow_shoot: 'projectile_shoot', crossbow_shoot: 'projectile_shoot', skeleton_shoot: 'projectile_shoot', snow_golem_shoot: 'projectile_shoot', throw: 'projectile_shoot', ender_pearl_throw: 'projectile_shoot', witch_throw: 'projectile_shoot',
    wind_charge_throw: 'projectile_shoot', trident_throw: 'projectile_shoot', bobber_throw: 'projectile_shoot', firework_launch: 'projectile_shoot', arrow_hit: 'projectile_land', trident_hit: 'projectile_land',
  };
  // ---------------------------------------------------------------- music: generative piano, every 10 to 20 minutes
  let musicMode = null, nextMusic = 0, musicPlaying = false;
  const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]];
  function pianoNote(dest, t0, midi, dur, vel) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    tone(dest, t0, 'triangle', f, dur, 0.12 * vel, { attack: 0.004, lp: 2400, lpTo: 600 });
    tone(dest, t0, 'sine', f * 2, dur * 0.6, 0.04 * vel, { attack: 0.004 });
    tone(dest, t0, 'sine', f, dur * 1.3, 0.06 * vel, { attack: 0.01 });
  }
  function playPiece() {
    if (!ready || musicPlaying) return;
    musicPlaying = true;
    const dest = ac.createGain(); dest.gain.value = 0.9;
    // a soft echo for space
    const dl = ac.createDelay(1); dl.delayTime.value = 0.38; const fb = ac.createGain(); fb.gain.value = 0.32; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    dest.connect(cats.music); dest.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(cats.music);
    const scale = SCALES[Math.floor(Math.random() * SCALES.length)], root = 48 + Math.floor(Math.random() * 7), tempo = rp(0.55, 0.85);
    let t = T() + 0.5; const bars = 24 + Math.floor(Math.random() * 16);
    const chordAt = b => [0, 3, 4, 5, 2, 4][b % 6];
    for (let b = 0; b < bars; b++) {
      const deg = chordAt(Math.floor(b / 2)), bass = root - 12 + scale[deg % scale.length];
      pianoNote(dest, t, bass, tempo * 4, 0.8);
      if (Math.random() < 0.7) pianoNote(dest, t + tempo * 2, bass + 7, tempo * 3, 0.5);
      for (let k = 0; k < 4; k++) if (Math.random() < 0.55) { const n = root + 12 + scale[(deg + Math.floor(Math.random() * 5)) % scale.length] + (Math.random() < 0.2 ? 12 : 0); pianoNote(dest, t + k * tempo + (Math.random() < 0.3 ? tempo / 2 : 0), n, tempo * 3, rp(0.4, 0.8)); }
      t += tempo * 4;
    }
    setTimeout(() => { musicPlaying = false; }, (t - T() + 4) * 1000);
  }
  function music(mode) { musicMode = mode; nextMusic = mode === 'menu' ? performance.now() + 2000 : performance.now() + rp(60, 180) * 1000; }
  // ---------------------------------------------------------------- music discs (a short generated tune per disc)
  const discs = new Map();
  function playDisc(name, x, y, z) {
    if (!ready) return;
    stopDisc(x, y, z);
    const dest = out('records', x + 0.5, y + 0.5, z + 0.5, 1, 64);
    let seed = 0; for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const r = new Rand(seed), scale = SCALES[r.int(SCALES.length)], root = 52 + r.int(10), tempo = 0.25 + r.next() * 0.2;
    let t = T() + 0.2; const notes = [];
    for (let i = 0; i < 160; i++) { const n = root + scale[r.int(scale.length)] + (r.next() < 0.3 ? 12 : 0); notes.push(n); const os = tone(dest, t, r.next() < 0.5 ? 'square' : 'triangle', 440 * Math.pow(2, (n - 69) / 12), tempo * 0.9, 0.06, { lp: 2500 }); void os; if (i % 4 === 0) tone(dest, t, 'triangle', 440 * Math.pow(2, (root - 12 + scale[r.int(scale.length)] - 69) / 12), tempo * 3.5, 0.08); t += tempo; }
    discs.set(x + ',' + y + ',' + z, dest);
  }
  function stopDisc(x, y, z) { const k = x + ',' + y + ',' + z, d = discs.get(k); if (d) { d.gain.value = 0; d.disconnect(); discs.delete(k); } }
  // ---------------------------------------------------------------- note blocks (the game's instruments, pitch 2^((note-12)/12))
  const INSTR = {
    harp: (d, f) => { tone(d, T(), 'triangle', f, 0.8, 0.3, { lp: 3000, lpTo: 900 }); }, bass: (d, f) => tone(d, T(), 'triangle', f / 4, 0.6, 0.45, { lp: 800 }), basedrum: d => tone(d, T(), 'sine', 120, 0.2, 0.6, { to: 45 }),
    snare: d => noise(d, T(), 0.15, 'highpass', 1500, 0.7, 0.5), hat: d => noise(d, T(), 0.05, 'highpass', 7000, 0.7, 0.4), bell: (d, f) => { tone(d, T(), 'sine', f * 2, 1.5, 0.25); tone(d, T(), 'sine', f * 5.4, 0.8, 0.08); },
    flute: (d, f) => tone(d, T(), 'sine', f, 0.6, 0.3, { attack: 0.04, vib: [5, 4] }), chime: (d, f) => { tone(d, T(), 'sine', f * 2, 2, 0.2); tone(d, T(), 'sine', f * 2 * 2.76, 1, 0.08); }, guitar: (d, f) => tone(d, T(), 'sawtooth', f / 2, 0.6, 0.2, { lp: 1800, lpTo: 400 }),
    xylophone: (d, f) => tone(d, T(), 'sine', f * 2, 0.25, 0.4), iron_xylophone: (d, f) => { tone(d, T(), 'sine', f, 0.6, 0.3); tone(d, T(), 'sine', f * 3, 0.3, 0.1); }, cow_bell: (d, f) => { tone(d, T(), 'square', f, 0.3, 0.12, { lp: 2500 }); tone(d, T(), 'square', f * 1.48, 0.3, 0.08, { lp: 2500 }); },
    didgeridoo: (d, f) => tone(d, T(), 'sawtooth', f / 4, 0.8, 0.3, { lp: 700, vib: [6, 3] }), bit: (d, f) => tone(d, T(), 'square', f, 0.4, 0.15), banjo: (d, f) => tone(d, T(), 'sawtooth', f, 0.35, 0.2, { lp: 2500, lpTo: 600 }), pling: (d, f) => { tone(d, T(), 'sine', f, 0.8, 0.3); tone(d, T(), 'triangle', f * 2, 0.4, 0.1); },
  };
  function note(instr, n, x, y, z) { if (!ready) return; const f = 370 * Math.pow(2, (n - 12) / 12); const d = out('records', x + 0.5, y + 0.5, z + 0.5, 1, 48); (INSTR[instr] || INSTR.harp)(d, f); }
  // ---------------------------------------------------------------- ambience: rain, thunder, caves
  let rainNode = null, caveTimer = 6000 + Math.floor(Math.random() * 6000);
  function tick(p) {
    if (!ready || !p) return;
    const now = performance.now();
    if (musicMode && !musicPlaying && now > nextMusic) { playPiece(); nextMusic = now + (musicMode === 'menu' ? rp(20, 60) : rp(600, 1200)) * 1000; }
    // mob calls now and then (the game's ambient sound timer: 1 in 1000 chance each tick after the interval)
    for (const e of Entities.list) if (e.living && !e.dead && e.age % 80 === 0 && Math.random() < 0.15 && e.dist2(p.x, p.y, p.z) < 256) { const v = MOB[e.type]; if (v && v.say) play(e.type + '_ambient', e); }
    // rain on the surface
    const raining = Weather.rain > 0.2 && World.dim === 'overworld';
    if (raining && !rainNode) { const g = ac.createGain(); g.gain.value = 0; const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; s.connect(f); f.connect(g); g.connect(cats.ambient); s.start(); rainNode = { g, s }; }
    if (rainNode) { const under = World.skyLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z)) < 15; const want = raining ? Weather.rain * (under ? 0.08 : 0.2) : 0; rainNode.g.gain.value += (want - rainNode.g.gain.value) * 0.05; if (!raining && rainNode.g.gain.value < 0.001) { rainNode.s.stop(); rainNode = null; } }
    // cave sounds: deep in the dark the game plays an eerie sound from time to time
    if (--caveTimer <= 0) {
      const l = World.getLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
      if ((l >> 4) === 0 && (l & 15) < 4 && World.dim === 'overworld') { const d = out('ambient', p.x + rp(-8, 8), p.y + rp(-4, 4), p.z + rp(-8, 8), 0.5, 32); tone(d, T(), 'sine', rp(80, 160), 3, 0.25, { attack: 0.8, vib: [0.3, 10], to: rp(60, 120), glide: 3 }); noise(d, T(), 2.5, 'bandpass', rp(300, 700), 6, 0.08, 0.8); caveTimer = 6000 + Math.floor(Math.random() * 12000); }
      else caveTimer = 20;
    }
  }
  function thunder(x, y, z, near) { if (!ready) return; const d = out('ambient', x, y, z, near ? 1 : 0.6, 1e6); const t0 = T() + (near ? 0 : 0.6); noise(d, t0, 3.5, 'lowpass', near ? 900 : 300, 0.7, near ? 1.2 : 0.8, 0.02, (fl, t) => fl.frequency.exponentialRampToValueAtTime(70, t + 3)); tone(d, t0, 'sine', 45, 3, 0.6, { to: 25 }); }
  return {
    play, step, ui: () => play('ui'), volumes, music, playDisc, stopDisc, note, tick, thunder, subtitles: SUBS,
    blockBreak: (id, x, y, z) => blockSound(id, x + 0.5, y + 0.5, z + 0.5, 'break'),
    blockHit: (id, x, y, z) => blockSound(id, x + 0.5, y + 0.5, z + 0.5, 'hit'),
    blockPlace: (id, x, y, z) => blockSound(id, x + 0.5, y + 0.5, z + 0.5, 'place'),
    get ready() { return ready; },
  };
})();
