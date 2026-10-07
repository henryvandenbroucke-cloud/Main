'use strict';
/* Sound: real recordings (src/sounds.js, credits in SOUND_CREDITS.md) played the way the classic game does it:
   each sound has a few takes picked at random, a little pitch variation, fading with distance and panned
   left/right toward where it happened. Ambience (birds, water, fire, lava, caves, wind, crickets) follows
   your surroundings, and the music is a calm generative piece played on a real grand piano. */
const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, ambBus, rev, noiseBuf, underF;
  let windSrc = null, windGain = null, windFilter = null;
  const AC = window.AudioContext || window.webkitAudioContext;
  const BUF = {}; // id -> [AudioBuffer]
  const loops = {}; // ambient beds: id -> { src, gain }
  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(master);
    sfxBus = ctx.createGain(); musicBus = ctx.createGain(); ambBus = ctx.createGain();
    // under water everything sounds muffled
    underF = ctx.createBiquadFilter(); underF.type = 'lowpass'; underF.frequency.value = 20000; underF.Q.value = 0.5;
    sfxBus.connect(underF); ambBus.connect(underF); underF.connect(comp); musicBus.connect(comp);
    // a soft room reverb (used by music, caves and big sounds)
    rev = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir;
    const revOut = ctx.createGain(); revOut.gain.value = 0.28; rev.connect(revOut); revOut.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < nd.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; nd[i] = b * 6; } // brown-ish noise for wind
    // wind: noise through a slowly moving low-pass, with gusts
    windSrc = ctx.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(ambBus); windSrc.start();
    volumes();
    load();
  }
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }, { passive: true });
  function volumes() {
    if (!ctx) return;
    master.gain.value = Settings.vMaster;
    sfxBus.gain.value = Settings.vSfx;
    ambBus.gain.value = Settings.vSfx * 0.8;
    musicBus.gain.value = Settings.vMusic * 0.7;
  }
  // decode every recording once; MP3 adds a few silent samples at the start, so trim them
  function load() {
    if (typeof SOUND_FILES === 'undefined') return;
    for (const id in SOUND_FILES) SOUND_FILES[id].forEach((b64, i) => {
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      ctx.decodeAudioData(u8.buffer, buf => { (BUF[id] || (BUF[id] = []))[i] = trimLead(buf); if (id.startsWith('amb_')) startLoop(id); }, () => {});
    });
  }
  function trimLead(buf) {
    const d = buf.getChannelData(0); let s = 0; const lim = Math.min(d.length, buf.sampleRate * 0.12);
    while (s < lim && Math.abs(d[s]) < 0.0015) s++;
    let e = d.length; while (e > s + 1 && Math.abs(d[e - 1]) < 0.0004) e--;
    if (s === 0 && e === d.length) return buf;
    const out = ctx.createBuffer(1, e - s, buf.sampleRate); out.copyToChannel(d.subarray(s, e), 0); return out;
  }
  const now = () => ctx.currentTime;
  const lastPick = {};
  // play a recording: o = { vol, rate, vary, at:[x,y,z] or {x,y,z}, range, bus, delay, wet }
  function play(id, o) {
    o = o || {};
    if (!ctx || ctx.state !== 'running') return null;
    const list = BUF[id]; if (!list || !list.length) return null;
    let vol = o.vol === undefined ? 1 : o.vol, pan = 0;
    if (o.at) {
      const x = o.at.x !== undefined ? o.at.x : o.at[0], y = o.at.y !== undefined ? o.at.y : o.at[1], z = o.at.z !== undefined ? o.at.z : o.at[2];
      const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z, d = Math.hypot(dx, dy, dz), range = o.range || 16;
      vol *= Math.max(0, 1 - d / range); if (vol < 0.01) return null;
      if (d > 0.5) pan = Math.max(-1, Math.min(1, (dx * Math.cos(Player.yaw) - dz * Math.sin(Player.yaw)) / d)) * 0.75;
    }
    // pick a take, avoiding the one we just played
    let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === lastPick[id]) i = (i + 1) % list.length; lastPick[id] = i;
    const buf = list[i]; if (!buf) return null;
    const t = now() + (o.delay || 0), src = ctx.createBufferSource(); src.buffer = buf;
    const vary = o.vary === undefined ? 0.08 : o.vary;
    src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * vary);
    const g = ctx.createGain(); g.gain.value = vol;
    let node = src; src.connect(g); node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(o.bus || sfxBus); if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; node.connect(w); w.connect(rev); }
    src.start(t);
    return src;
  }
  function startLoop(id) {
    if (loops[id] || !BUF[id] || !BUF[id][0]) return;
    const src = ctx.createBufferSource(); src.buffer = BUF[id][0]; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(ambBus);
    src.start(now(), Math.random() * src.buffer.duration * 0.9);
    loops[id] = { src, g };
  }
  function loopVol(id, v, tc) { const l = loops[id]; if (l) l.g.gain.setTargetAtTime(v, now(), tc || 0.6); }

  // small synth helpers (only for the few sounds that have no recording: crickets, a frog, bees)
  function tone(o) {
    if (!ctx) return;
    const t = now() + (o.delay || 0), osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t); if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + o.dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || o.freq * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.05); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let src = osc; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 1; osc.connect(f); src = f; }
    let out = g; src.connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(o.out || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  // a field cricket: a 4.5 kHz tone pulsed three or four times
  function cricket(vol, pan, f) {
    const n = 3 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) tone({ freq: f, dur: 0.022, attack: 0.004, gain: vol, delay: i * 0.042, out: ambBus, pan });
  }

  // ---- blocks: which group of sounds a block makes (like the classic game's sound groups)
  function material(id) {
    const d = BLK[id]; if (!d) return 'stone';
    const k = String(d.key || '');
    if (id === B.WATER) return 'water';
    if (id === B.LAVA) return 'lava';
    if ([B.GLASS, B.CRYSTAL, B.CRYSTAL_ROSE, B.CRYSTAL_CLUSTER, B.STARSTONE, B.PORTAL].includes(id)) return 'glass';
    if (k.startsWith('WOOL') || [B.BANNER, B.WEB, B.NET].includes(id)) return 'cloth';
    if (id === B.TORCH || id === B.LADDER) return 'wood';
    if (d.cutLike || d.render === 'cross' || [B.VINES, B.LILYPAD, B.CACTUS].includes(id)) return 'plant';
    if ([B.GRASS, B.SWAMPGRASS, B.HAY, B.THATCH].includes(id)) return 'grass';
    if (id === B.MUD) return 'mud';
    if ([B.DIRT, B.FARMLAND, B.PATH, B.ASH].includes(id)) return 'dirt';
    if (id === B.GRAVEL) return 'gravel';
    if (id === B.SAND) return 'sand';
    if (id === B.SNOW) return 'snow';
    if ([B.IRON_BLOCK, B.GOLD_BLOCK, B.ANCIENT_GOLD, B.STEEL_BLOCK, B.RAIL, B.CAULDRON, B.SPAWNER].includes(id)) return 'metal';
    if (d.tool === 'axe' || k.includes('PLANK') || k.includes('OAK') || [B.CHEST, B.BARREL, B.CRATE, B.TABLE, B.BOOKSHELF, B.FENCE].includes(id)) return 'wood';
    return 'stone';
  }
  const MAT = { // step / dig / break / place recordings and how loud each is
    grass: { step: 'step_grass', dig: 'dig_dirt', brk: 'step_grass', place: 'place_soft' },
    plant: { step: 'step_grass', dig: 'dig_leaf', brk: 'step_grass', place: 'step_grass' },
    dirt: { step: 'step_dirt', dig: 'dig_dirt', brk: 'step_dirt', place: 'place_soft' },
    mud: { step: 'step_mud', dig: 'dig_dirt', brk: 'step_mud', place: 'place_soft' },
    gravel: { step: 'step_gravel', dig: 'dig_gravel', brk: 'brk_gravel', place: 'place_soft' },
    sand: { step: 'step_sand', dig: 'dig_dirt', brk: 'step_sand', place: 'place_soft' },
    snow: { step: 'step_snow', dig: 'step_snow', brk: 'step_snow', place: 'step_snow' },
    stone: { step: 'step_stone', dig: 'dig_stone', brk: 'step_stone', place: 'place_hard' },
    wood: { step: 'step_wood', dig: 'dig_wood', brk: 'step_wood', place: 'place_hard' },
    glass: { step: 'step_glass', dig: 'dig_stone', brk: 'brk_glass', place: 'place_hard' },
    metal: { step: 'step_metal', dig: 'dig_metal', brk: 'brk_metal', place: 'place_metal' },
    cloth: { step: 'step_cloth', dig: 'step_cloth', brk: 'step_cloth', place: 'step_cloth' },
    water: { step: 'step_water', dig: 'step_water', brk: 'place_water', place: 'place_water' },
    lava: { step: 'step_water', dig: 'step_water', brk: 'place_lava', place: 'place_lava' },
  };
  const mat = id => MAT[material(id)] || MAT.stone;

  // ---- creatures: idle call, hurt and death, per creature (rate changes the voice's pitch)
  const S = (say, hurt, death, rate) => ({ say, hurt, death: death || hurt, rate: rate || 1 });
  const MOB = {
    cow: S('cow_say', 'cow_hurt', null), pig: S('pig_say', 'pig_hurt'), boar: S('pig_say', 'pig_hurt', null, 0.72),
    sheep: S('sheep_say', 'sheep_hurt'), goat: S('sheep_say', 'sheep_hurt', null, 1.22), deer: S('sheep_say', 'sheep_hurt', null, 1.45),
    chicken: S('chicken_say', 'chicken_hurt'), rabbit: S('rabbit_say', 'rabbit_hurt'), horse: S('horse_say', 'horse_hurt', 'horse_death'),
    camel: S('donkey_say', 'donkey_hurt', null, 0.78), fox: S('wolf_bark', 'wolf_hurt', 'wolf_death', 1.55), wolf: S('wolf_bark', 'wolf_hurt', 'wolf_death'),
    cat: S('cat_say', 'cat_hurt'), bear: S('bear_say', 'bear_hurt', 'bear_death'), frog: S(null, 'flop', null, 1.4), turtle: S(null, 'flop', null, 0.8),
    bee: S(null, 'bat_hurt', null, 0.7), bat: S('bat_say', 'bat_hurt'), squid: S(null, 'flop'), fish: S(null, 'flop', null, 1.3),
    villager: S('villager_say', 'villager_hurt'), raider: S('villager_say', 'villager_hurt', null, 0.82), guardian: S('golem_say', 'golem_hurt', 'golem_death'),
    zombie: S('zombie_say', 'zombie_hurt', 'zombie_death'), knight: S('zombie_say', 'zombie_hurt', 'zombie_death', 0.8),
    skeleton: S('skeleton_say', 'skeleton_hurt', 'skeleton_death'), spider: S('spider_say', 'spider_hurt', 'spider_death'),
    cave_spider: S('spider_say', 'spider_hurt', 'spider_death', 1.25), crawler: S('spider_say', 'spider_hurt', 'spider_death', 0.85),
    boomshroom: S(null, 'slime_hurt', null, 0.6), stalker: S('stalker_say', 'stalker_hurt', 'stalker_death'),
    witch: S('witch_say', 'witch_hurt', 'witch_death'), imp: S('witch_say', 'witch_hurt', 'witch_death', 1.5),
    slime: S('slime_say', 'slime_hurt', 'slime_death'), magma_slime: S('magma_say', 'slime_hurt', 'slime_death', 0.75),
    mite: S('mite_say', 'mite_say', null, 1.15), wraith: S('ghost_say', 'ghost_hurt', 'ghost_death'), shade: S('ghost_say', 'ghost_hurt', 'ghost_death', 1.3),
    glider: S('glider_say', 'bat_hurt', 'bat_hurt', 0.62), golem: S('golem_say', 'golem_hurt', 'golem_death', 1.1), wisp: S(null, 'brk_glass', 'brk_glass', 1.6),
    elemental: S('fire_say', 'fire_hurt', 'fire_death'), sentinel: S('golem_say', 'golem_hurt', 'golem_death', 1.4),
    warden: S('bear_growl', 'bear_hurt', 'bear_death', 0.55), colossus: S('golem_say', 'golem_hurt', 'golem_death', 0.5),
  };
  const mobAt = m => ({ x: m.x, y: m.y + (m.h || 1) * (m.scale || 1) * 0.7, z: m.z });
  function mob(m, kind, vol) {
    if (!m) return;
    const d = MOB[m.type]; const pitch = (d ? d.rate : 1) * (m.baby ? 1.45 : 1) * (m.size && m.size < 2 ? 1.3 : 1);
    if (kind === 'say' && m.type === 'frog') return croak(m);
    if (kind === 'say' && m.type === 'bee') return buzz(m);
    const id = d && d[kind]; if (!id) return;
    const big = m.def && (m.def.boss || m.def.heavy);
    play(id, { at: mobAt(m), vol: (vol || 1) * (kind === 'say' ? 0.8 : 1), rate: pitch * (kind === 'death' ? 0.85 : 1), range: big ? 40 : 16, vary: 0.1, wet: big ? 0.3 : 0 });
  }
  function croak(m) { const a = mobAt(m), d = Math.hypot(a.x - camera.position.x, a.z - camera.position.z), v = Math.max(0, 1 - d / 16); if (v < 0.05) return; for (let i = 0; i < 3; i++) tone({ freq: 95 + Math.random() * 15, dur: 0.05, gain: 0.09 * v, type: 'sawtooth', lp: 600, delay: i * 0.07 }); }
  function buzz(m) { const a = mobAt(m), d = Math.hypot(a.x - camera.position.x, a.z - camera.position.z), v = Math.max(0, 1 - d / 10); if (v < 0.05) return; tone({ freq: 200 + Math.random() * 30, slide: 215, dur: 1.1, gain: 0.03 * v, type: 'sawtooth', lp: 1400, vib: 9, vibAmt: 10, attack: 0.25 }); }
  // old voice names (used by a few scripted moments) -> a creature
  const VOICE_MOB = { moo: 'cow', oink: 'pig', baa: 'sheep', bleat: 'goat', cluck: 'chicken', neigh: 'horse', grumble: 'camel', bark: 'wolf', yip: 'fox', growl: 'bear', meow: 'cat', squeak: 'bat', hmm: 'villager', groan: 'zombie', rattle: 'skeleton', hiss: 'spider', warble: 'stalker', cackle: 'witch', squish: 'slime', wail: 'wraith', screech: 'glider', thud: 'golem', shriek: 'stalker' };

  // ---- ambience + music, ticked from the main loop
  let birdT = 3, cricketT = 2, caveT = 40, dripT = 5, musicT = 25;
  const crickets = [0, 1, 2].map(() => ({ f: 4300 + Math.random() * 500, pan: Math.random() * 1.6 - 0.8 }));
  function update(dt, info) {
    if (!ctx || ctx.state !== 'running') return;
    const day = info.day, playing = info.playing, under = !!info.under;
    underF.frequency.setTargetAtTime(under ? 700 : 20000, now(), 0.08);
    // wind: stronger up high, in the highlands and in the dunes, with slow gusts
    const gust = 0.6 + 0.4 * Math.sin(now() * 0.21) * Math.sin(now() * 0.077 + 1);
    const wv = playing ? (0.035 + Math.min(0.1, Math.max(0, info.height - 34) * 0.004) + (info.biome === 4 || info.biome === 3 ? 0.04 : 0)) * gust * (info.cave ? 0.15 : 1) : 0.015;
    windGain.gain.setTargetAtTime(under ? 0 : wv, now(), 0.8);
    windFilter.frequency.setTargetAtTime(280 + gust * 380, now(), 1.2);
    // ambient beds
    const open = playing && !under && !info.cave;
    const birdy = open && day > 0.5 && (info.biome === 0 || info.biome === 1 || info.biome === 2) ? Math.min(1, (day - 0.5) * 4) : 0;
    loopVol('amb_birds', birdy * 0.32, 2);
    loopVol('amb_fire', playing ? (info.fireNear || 0) * 0.55 : 0, 0.4);
    loopVol('amb_lava', playing ? (info.lavaNear || 0) * 0.6 : 0, 0.5);
    loopVol('amb_water', playing ? (info.waterNear || 0) * 0.35 : 0, 0.8);
    if (playing) {
      birdT -= dt; cricketT -= dt; caveT -= dt; dripT -= dt;
      if (birdT <= 0) { birdT = 3 + Math.random() * 8; if (birdy > 0.3) play('bird', { vol: 0.12 + Math.random() * 0.14, vary: 0.12, bus: ambBus, at: { x: camera.position.x + (Math.random() - 0.5) * 24, y: camera.position.y + 6, z: camera.position.z + (Math.random() - 0.5) * 24 }, range: 40 }); }
      if (cricketT <= 0) { cricketT = 0.35 + Math.random() * 0.7; if (open && day < 0.4 && info.biome !== 5) { const c = crickets[Math.floor(Math.random() * crickets.length)]; cricket(0.006 + Math.random() * 0.006, c.pan, c.f); } }
      if (caveT <= 0) { caveT = 50 + Math.random() * 120; if (info.cave) play('cave', { vol: 0.35, vary: 0.05, bus: ambBus, wet: 0.6 }); }
      if (dripT <= 0) { dripT = 2 + Math.random() * 6; if (info.cave) play('drip', { vol: 0.2, bus: ambBus, wet: 0.5, at: { x: camera.position.x + (Math.random() - 0.5) * 12, y: camera.position.y + 2, z: camera.position.z + (Math.random() - 0.5) * 12 }, range: 14 }); }
    }
    // music: a calm piece now and then, with long quiet gaps (like the classic game)
    musicT -= dt;
    if (musicT <= 0 && Settings.vMusic > 0) { musicT = composePiece(day > 0.42 && info.biome !== 5 && !info.cave) + 60 + Math.random() * 110; }
  }

  // ---- music on a real grand piano: sampled every minor third, the notes in between are pitched
  const ROOTS = [['A2', 45], ['C3', 48], ['Ds3', 51], ['Fs3', 54], ['A3', 57], ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69], ['C5', 72], ['Ds5', 75], ['Fs5', 78], ['A5', 81]];
  function piano(midi, t, vel, len) {
    let best = ROOTS[0]; for (const r of ROOTS) if (Math.abs(r[1] - midi) < Math.abs(best[1] - midi)) best = r;
    const list = BUF['piano_' + best[0]]; if (!list || !list[0]) return;
    const src = ctx.createBufferSource(); src.buffer = list[0]; src.playbackRate.value = Math.pow(2, (midi - best[1]) / 12);
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.setValueAtTime(vel, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.9);
    src.connect(g); g.connect(musicBus); const w = ctx.createGain(); w.gain.value = 0.55; g.connect(w); w.connect(rev);
    src.start(t); src.stop(t + len + 1);
  }
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
  const PROG_DAY = [[0, 4, 5, 3], [0, 3, 0, 4], [5, 3, 0, 4], [0, 2, 3, 3], [3, 4, 2, 5]], PROG_NIGHT = [[0, 5, 2, 6], [0, 3, 0, 4], [0, 6, 5, 6], [5, 3, 0, 0]];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // returns the piece's length in seconds
  function composePiece(bright) {
    if (!BUF.piano_C4) return 10;
    const scale = bright ? MAJOR : MINOR, key = (bright ? pick([60, 65, 67, 62]) : pick([57, 62, 64])) - 12;
    const prog = pick(bright ? PROG_DAY : PROG_NIGHT), beat = 0.8 + Math.random() * 0.25, bars = prog.length * 2;
    const deg = (d, oct) => key + oct * 12 + scale[((d % 7) + 7) % 7] + Math.floor(d / 7) * 12;
    // one melodic idea (rhythm and contour) reused on every bar, so it sounds composed rather than random
    const rhythm = pick([[0, 1.5, 2, 3], [0, 1, 2.5], [0.5, 1.5, 2, 3], [0, 2, 3, 3.5], [1, 2, 2.5]]);
    const contour = rhythm.map(() => pick([0, 2, 4, 2, 4, 7]));
    const arp = Math.random() < 0.35;
    let t = now() + 0.5;
    for (let b = 0; b < bars; b++) {
      const c = prog[b % prog.length], last = b === bars - 1;
      piano(deg(c, 0), t, 0.42, beat * 3.6);
      if (Math.random() < 0.5) piano(deg(c + 4, 0), t + beat * 2, 0.22, beat * 1.8);
      if (last) { piano(deg(0, 1), t + beat * 0.02, 0.3, beat * 4); piano(deg(2, 1), t + beat * 0.5, 0.26, beat * 4); piano(deg(4, 1), t + beat, 0.24, beat * 4); break; }
      if (arp) for (let k = 0; k < 4; k++) piano(deg(c + [0, 2, 4, 7][k], 1), t + k * beat * 0.5 + beat * 2, 0.2, beat * 2);
      else rhythm.forEach((r, k) => { if (Math.random() < 0.12) return; piano(deg(c + contour[k] + (b >= prog.length && k === rhythm.length - 1 ? 1 : 0), 1), t + r * beat + (Math.random() - 0.5) * 0.03, 0.26 + Math.random() * 0.08, beat * (k === rhythm.length - 1 ? 2.2 : 1.4)); });
      t += beat * 4;
    }
    return bars * beat * 4 + 4;
  }
  function resetMusic(delay) { musicT = delay === undefined ? 20 : delay; }

  return {
    volumes, update, play, mob, material, resetMusic,
    get ready() { return !!(ctx && BUF.step_stone); },
    stats() { let files = 0; for (const k in BUF) files += BUF[k].filter(Boolean).length; return { ids: Object.keys(BUF).length, files, loops: Object.keys(loops) }; },
    brk(id) { const m = mat(id); play(m.brk, { vol: 0.75, rate: 0.85 }); if (material(id) === 'stone' || material(id) === 'wood') play('brk_node', { vol: 0.3, rate: 0.9 }); },
    dig(id) { play(mat(id).dig, { vol: 0.42, rate: 0.95 }); },
    place(id) { play(mat(id).place, { vol: 0.62, rate: 0.85 }); },
    step(id) { const m = material(id); play(MAT[m] ? MAT[m].step : 'step_stone', { vol: m === 'water' ? 0.22 : 0.3, vary: 0.06 }); },
    pop() { play('pickup', { vol: 0.35, rate: 1.6, vary: 0.35 }); },
    swing() { play('throw', { vol: 0.18, rate: 0.85, vary: 0.12 }); },
    // the player strikes a creature: a punch (or a critical crack) plus the creature's hurt voice
    hitMob(m, crit, src) { if (src !== 'dot') play(crit ? 'crit' : 'punch', { vol: crit ? 0.55 : 0.6, at: mobAt(m), rate: m.def && (m.def.boss || m.def.heavy) ? 0.7 : 1 }); mob(m, 'hurt'); },
    hit(heavy) { play('punch', { vol: 0.6, rate: heavy ? 0.7 : 1 }); },
    voice(kind, dist, vol) { // scripted calls without a creature at hand: play near you
      const type = VOICE_MOB[kind]; if (!type) return;
      const d = MOB[type]; if (!d || !d.say) return;
      const v = Math.max(0, 1 - (dist || 0) / 22) * (vol === undefined ? 1 : vol); if (v < 0.03) return;
      play(d.say, { vol: v * (kind === 'shriek' ? 1.3 : 0.8), rate: d.rate * (kind === 'shriek' ? 0.7 : 1) });
    },
    roar(v) { v = v || 1; play('bear_growl', { vol: 0.9 * v, rate: 0.5, vary: 0.04, wet: 0.4 }); play('golem_say', { vol: 0.5 * v, rate: 0.55, wet: 0.3 }); },
    growl() { play('bear_growl', { vol: 0.75, rate: 0.62, vary: 0.05, wet: 0.2 }); },
    slam(v) { v = v === undefined ? 1 : v; play('explode', { vol: 0.55 * v, rate: 0.6, vary: 0.06, wet: 0.25 }); play('place_hard', { vol: 0.8 * v, rate: 0.5 }); },
    whoosh() { play('throw', { vol: 0.6, rate: 0.45, vary: 0.08 }); },
    boom(dist) { play('explode', { vol: Math.max(0.15, 1 - (dist || 0) / 48), wet: 0.3 }); },
    hiss(dist) { play('fuse', { vol: Math.max(0, 1 - (dist || 0) / 16) * 0.8, vary: 0.02 }); },
    puff(m) { play('poof', m ? { vol: 0.5, at: mobAt(m) } : { vol: 0.5 }); },
    teleport(dist) { play('tele', { vol: Math.max(0.1, 1 - (dist || 0) / 30) * 0.7 }); },
    portal() { play('portal', { vol: 0.6, vary: 0.02, wet: 0.3 }); },
    crumble() { play('explode', { vol: 0.7, rate: 0.5, wet: 0.5 }); for (let i = 0; i < 8; i++) play('brk_gravel', { vol: 0.6, rate: 0.6, delay: 0.2 + i * 0.16 }); },
    drink() { play('drink', { vol: 0.6 }); play('drink', { vol: 0.5, delay: 0.42 }); },
    enchant() { play('enchant', { vol: 0.7, vary: 0.03, wet: 0.3 }); },
    heart() { play('wolf_happy', { vol: 0.7 }); },
    shear() { play('shears', { vol: 0.7 }); },
    hurt(cause) { play(cause === 'fall' ? 'fall' : 'hurt', { vol: 0.75, vary: 0.05 }); },
    bow(at) { play('bow', at ? { vol: 0.6, at } : { vol: 0.6 }); },
    arrowHit(at) { play('arrow_hit', { vol: 0.5, at }); },
    zap() { play('thunder', { vol: 0.45, rate: 1.4, vary: 0.05 }); play('crit', { vol: 0.4, rate: 1.3 }); },
    chest(kind) { play(kind === 'barrel' ? 'barrel_open' : 'chest_open', { vol: 0.55 }); },
    chestClose() { play('chest_close', { vol: 0.5 }); },
    armor() { play('armor', { vol: 0.55 }); },
    ui() { play('click', { vol: 0.3, vary: 0.02 }); },
    eat() { for (let i = 0; i < 3; i++) play('bite', { vol: 0.55, delay: i * 0.22 }); },
    feed(m) { play('eat_animal', { vol: 0.6, at: mobAt(m) }); },
    trade(ok, m) { play(ok ? 'villager_yes' : 'villager_trade', { vol: 0.8, at: m ? mobAt(m) : undefined }); },
    splash() { play('splash', { vol: 0.55 }); },
    quest() { play('award', { vol: 0.6, vary: 0 }); },
    discover() { play('bell', { vol: 0.45, vary: 0, wet: 0.4 }); },
    death() { play('hurt', { vol: 0.8, rate: 0.85, vary: 0 }); },
  };
})();
