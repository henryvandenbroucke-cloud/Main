'use strict';
/* Synthesized sound: effects, ambience and gentle generative music (Web Audio, no sound files). */
const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, ambBus, rev, noiseBuf;
  let windSrc = null, windGain = null, windFilter = null;
  const AC = window.AudioContext || window.webkitAudioContext;
  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); musicBus = ctx.createGain(); ambBus = ctx.createGain();
    // simple generated reverb
    rev = ctx.createConvolver();
    const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ir;
    const revOut = ctx.createGain(); revOut.gain.value = 0.32; rev.connect(revOut); revOut.connect(master);
    for (const b of [sfxBus, musicBus, ambBus]) b.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // wind: looping noise through a slowly moving low-pass
    windSrc = ctx.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.7;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(ambBus); windSrc.start();
    volumes();
  }
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }, { passive: true });
  function volumes() {
    if (!ctx) return;
    master.gain.value = Settings.vMaster;
    sfxBus.gain.value = Settings.vSfx;
    ambBus.gain.value = Settings.vSfx * 0.7;
    musicBus.gain.value = Settings.vMusic * 0.55;
  }
  const now = () => ctx.currentTime;
  function noise(o) {
    if (!ctx) return;
    const t = now() + (o.delay || 0), src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.out || sfxBus); if (o.wet) g.connect(rev);
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
  }
  function tone(o) {
    if (!ctx) return;
    const t = now() + (o.delay || 0), osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t); if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + o.dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || o.freq * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.05); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let src = osc; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 1; osc.connect(f); src = f; }
    src.connect(g); g.connect(o.out || sfxBus); if (o.wet) g.connect(rev);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  function material(id) {
    const d = BLK[id]; if (!d) return 'stone';
    if ([B.GLASS, B.CRYSTAL, B.CRYSTAL_ROSE, B.CRYSTAL_CLUSTER, B.STARSTONE].includes(id)) return 'glass';
    if (d.cutLike || d.render === 'cross') return 'leaf';
    if ([B.SAND, B.GRAVEL, B.SNOW, B.ASH].includes(id)) return 'sand';
    if ([B.GRASS, B.DIRT, B.MUD, B.SWAMPGRASS, B.FARMLAND, B.PATH, B.HAY, B.THATCH].includes(id)) return 'dirt';
    if (d.tool === 'axe' || [B.PLANKS, B.PLANKS_DARK, B.LADDER, B.FENCE, B.CHEST, B.BARREL, B.CRATE, B.TABLE, B.BOOKSHELF].includes(id)) return 'wood';
    if (String(d.key).startsWith('WOOL') || id === B.BANNER) return 'cloth';
    if ([B.IRON_BLOCK, B.GOLD_BLOCK, B.RAIL, B.CAULDRON].includes(id)) return 'metal';
    return 'stone';
  }
  const MAT = {
    stone: { freq: 1500, q: 1.2, rate: 1 }, wood: { freq: 700, q: 2.5, rate: 0.8 }, dirt: { freq: 420, q: 0.8, rate: 0.6, filter: 'lowpass' },
    sand: { freq: 2600, q: 0.6, rate: 1.2, filter: 'highpass' }, leaf: { freq: 3000, q: 0.5, rate: 1.4, filter: 'highpass' },
    glass: { freq: 4200, q: 4, rate: 1.5 }, cloth: { freq: 600, q: 0.5, rate: 0.5, filter: 'lowpass' }, metal: { freq: 2200, q: 8, rate: 1 },
  };
  function matNoise(id, gain, dur) { const m = MAT[material(id)]; noise({ freq: m.freq * (0.9 + Math.random() * 0.2), q: m.q, rate: m.rate, filter: m.filter, gain, dur }); }

  // creature voices: tiny synth recipes, quieter with distance
  const VOICES = {
    moo: v => { tone({ freq: 150, slide: 112, dur: 1.0, gain: 0.09 * v, type: 'sawtooth', lp: 520, attack: 0.12, vib: 5, wet: true }); tone({ freq: 300, slide: 224, dur: 0.9, gain: 0.03 * v, type: 'sawtooth', lp: 700, attack: 0.15 }); },
    oink: v => { for (let i = 0; i < 2; i++) { noise({ freq: 900, q: 4, gain: 0.08 * v, dur: 0.1, delay: i * 0.16 }); tone({ freq: 230, slide: 170, dur: 0.1, gain: 0.05 * v, type: 'square', lp: 900, delay: i * 0.16 }); } },
    baa: v => { tone({ freq: 430, slide: 400, dur: 0.75, gain: 0.07 * v, type: 'sawtooth', lp: 1500, attack: 0.04, vib: 14, vibAmt: 30, wet: true }); },
    bleat: v => { tone({ freq: 520, slide: 470, dur: 0.5, gain: 0.06 * v, type: 'sawtooth', lp: 1700, vib: 16, vibAmt: 40 }); },
    cluck: v => { for (let i = 0; i < 3; i++) { noise({ freq: 1500, q: 6, gain: 0.08 * v, dur: 0.04, delay: i * 0.09 }); tone({ freq: 700, slide: 500, dur: 0.05, gain: 0.03 * v, type: 'square', lp: 2000, delay: i * 0.09 }); } },
    neigh: v => { tone({ freq: 600, slide: 950, dur: 0.3, gain: 0.05 * v, type: 'sawtooth', lp: 2200 }); tone({ freq: 900, slide: 420, dur: 0.8, gain: 0.05 * v, type: 'sawtooth', lp: 2000, vib: 18, vibAmt: 60, delay: 0.25, wet: true }); },
    grumble: v => { tone({ freq: 110, slide: 90, dur: 0.8, gain: 0.08 * v, type: 'sawtooth', lp: 400, vib: 9, vibAmt: 8 }); },
    bark: v => { for (let i = 0; i < 2; i++) { noise({ freq: 800, q: 2, gain: 0.1 * v, dur: 0.09, delay: i * 0.22 }); tone({ freq: 340, slide: 220, dur: 0.1, gain: 0.07 * v, type: 'sawtooth', lp: 1200, delay: i * 0.22 }); } },
    yip: v => { tone({ freq: 900, slide: 1400, dur: 0.1, gain: 0.05 * v, type: 'triangle' }); tone({ freq: 1000, slide: 1500, dur: 0.1, gain: 0.04 * v, type: 'triangle', delay: 0.14 }); },
    growl: v => { tone({ freq: 70, slide: 60, dur: 1.0, gain: 0.12 * v, type: 'sawtooth', lp: 380, vib: 22, vibAmt: 6 }); noise({ freq: 300, q: 1, filter: 'lowpass', gain: 0.06 * v, dur: 0.9, attack: 0.1 }); },
    meow: v => { tone({ freq: 620, slide: 900, dur: 0.18, gain: 0.05 * v, type: 'triangle', lp: 2500 }); tone({ freq: 900, slide: 560, dur: 0.35, gain: 0.05 * v, type: 'triangle', lp: 2500, delay: 0.16 }); },
    croak: v => { for (let i = 0; i < 4; i++) tone({ freq: 130, dur: 0.04, gain: 0.07 * v, type: 'square', lp: 700, delay: i * 0.045 }); },
    buzz: v => { tone({ freq: 210, slide: 230, dur: 0.9, gain: 0.025 * v, type: 'sawtooth', lp: 1100, vib: 7, vibAmt: 12, attack: 0.2 }); },
    squeak: v => { tone({ freq: 3200, slide: 4200, dur: 0.05, gain: 0.025 * v }); tone({ freq: 3600, slide: 4400, dur: 0.05, gain: 0.02 * v, delay: 0.08 }); },
    hmm: v => { tone({ freq: 210, slide: 175, dur: 0.28, gain: 0.07 * v, type: 'sawtooth', lp: 700, attack: 0.03 }); tone({ freq: 190, slide: 240, dur: 0.22, gain: 0.06 * v, type: 'sawtooth', lp: 700, delay: 0.26 }); },
    groan: v => { tone({ freq: 115, slide: 85, dur: 1.2, gain: 0.08 * v, type: 'sawtooth', lp: 450, vib: 4, vibAmt: 6, attack: 0.15, wet: true }); },
    rattle: v => { for (let i = 0; i < 6; i++) noise({ freq: 2400 + Math.random() * 800, q: 5, gain: 0.06 * v, dur: 0.025, delay: i * 0.05 }); },
    hiss: v => { noise({ freq: 4000, q: 0.6, filter: 'highpass', gain: 0.06 * v, dur: 0.6, attack: 0.08 }); },
    warble: v => { tone({ freq: 240, slide: 520, dur: 0.6, gain: 0.04 * v, vib: 11, vibAmt: 60, wet: true }); },
    shriek: v => { tone({ freq: 900, slide: 1500, dur: 0.7, gain: 0.08 * v, type: 'sawtooth', lp: 3000, vib: 30, vibAmt: 120, wet: true }); noise({ freq: 3000, q: 1, gain: 0.05 * v, dur: 0.6 }); },
    cackle: v => { for (let i = 0; i < 6; i++) tone({ freq: 650 + i * 40, slide: 520, dur: 0.06, gain: 0.05 * v, type: 'triangle', delay: i * 0.08 }); },
    squish: v => { noise({ freq: 400, sweep: 1000, q: 1.5, filter: 'lowpass', gain: 0.08 * v, dur: 0.15 }); },
    wail: v => { tone({ freq: 520, slide: 300, dur: 1.4, gain: 0.04 * v, vib: 5, vibAmt: 20, attack: 0.3, wet: true }); },
    screech: v => { tone({ freq: 1800, slide: 1200, dur: 0.4, gain: 0.04 * v, type: 'sawtooth', lp: 3000, wet: true }); },
    thud: v => { noise({ freq: 300, q: 1, filter: 'lowpass', gain: 0.08 * v, dur: 0.15 }); },
  };
  // ---- ambience + music, ticked from the main loop
  let birdT = 3, cricketT = 2, fireT = 1, waterT = 2, musicT = 4, phraseLeft = 0;
  const DAY_SCALE = [0, 2, 4, 7, 9, 12, 14, 16], NIGHT_SCALE = [0, 3, 5, 7, 10, 12, 15];
  function pianoNote(midi, gain, dur) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    tone({ freq: f, type: 'sine', gain: gain, dur: dur, attack: 0.008, out: musicBus, wet: true });
    tone({ freq: f * 2, type: 'triangle', gain: gain * 0.18, dur: dur * 0.5, attack: 0.004, out: musicBus, wet: true });
    tone({ freq: f * 3.01, type: 'sine', gain: gain * 0.06, dur: dur * 0.3, out: musicBus });
  }
  function update(dt, info) {
    if (!ctx || ctx.state !== 'running') return;
    const day = info.day, playing = info.playing;
    // wind gets stronger up high and in the highlands
    const wv = playing ? 0.05 + Math.min(0.12, Math.max(0, info.height - 30) * 0.004) + (info.biome === 4 ? 0.05 : 0) : 0.02;
    windGain.gain.setTargetAtTime(wv * (info.under ? 0.2 : 1), now(), 0.8);
    windFilter.frequency.setTargetAtTime(300 + Math.sin(now() * 0.13) * 160 + (info.under ? -200 : 0), now(), 1.5);
    if (!playing) return;
    birdT -= dt; cricketT -= dt; fireT -= dt; waterT -= dt; musicT -= dt;
    if (birdT <= 0) {
      birdT = 2 + Math.random() * 6;
      if (day > 0.55 && (info.biome === 0 || info.biome === 1 || info.biome === 2) && !info.under) {
        const base = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone({ freq: base * (1 + Math.random() * 0.2), slide: base * (1.3 + Math.random() * 0.4), dur: 0.08 + Math.random() * 0.06, gain: 0.025, delay: i * 0.13, out: ambBus, wet: true });
      }
    }
    if (cricketT <= 0) {
      cricketT = 0.6 + Math.random() * 1.6;
      if (day < 0.45 && info.biome !== 5 && !info.under) for (let i = 0; i < 3; i++) tone({ freq: 4300 + Math.random() * 300, dur: 0.03, gain: 0.012, delay: i * 0.06, out: ambBus });
    }
    if (fireT <= 0) { fireT = 0.08 + Math.random() * 0.3; if (info.fireNear) noise({ freq: 1800 + Math.random() * 2500, q: 3, gain: 0.03 * info.fireNear, dur: 0.03 + Math.random() * 0.04, out: ambBus }); }
    if (waterT <= 0) { waterT = 0.8 + Math.random() * 1.5; if (info.waterNear) noise({ freq: 500, sweep: 900, q: 0.8, filter: 'lowpass', gain: 0.05, dur: 0.6, attack: 0.2, out: ambBus }); }
    // music: short soft phrases with long gentle rests
    if (musicT <= 0 && Settings.vMusic > 0) {
      const scale = day > 0.45 ? DAY_SCALE : NIGHT_SCALE, root = day > 0.45 ? 60 : 57;
      if (phraseLeft <= 0) { phraseLeft = 4 + Math.floor(Math.random() * 5); musicT = 6 + Math.random() * 8; pianoNote(root - 12 + scale[Math.floor(Math.random() * 3)], 0.06, 4.5); return; }
      phraseLeft--;
      const note = root + scale[Math.floor(Math.random() * scale.length)];
      pianoNote(note, 0.07, 2.8);
      if (Math.random() < 0.3) pianoNote(note - 12 + (Math.random() < 0.5 ? 7 : 4), 0.035, 3.2);
      musicT = 0.6 + Math.random() * 0.9;
    }
  }
  return {
    volumes, update,
    brk(id) { matNoise(id, 0.35, 0.22); matNoise(id, 0.18, 0.12); if (material(id) === 'glass') tone({ freq: 2400, slide: 1800, dur: 0.25, gain: 0.05 }); },
    dig(id) { matNoise(id, 0.12, 0.07); },
    place(id) { matNoise(id, 0.25, 0.1); tone({ freq: 140, slide: 90, dur: 0.08, gain: 0.08 }); },
    step(id) { matNoise(id, material(id) === 'stone' ? 0.06 : 0.08, 0.06); },
    pop() { tone({ freq: 700 + Math.random() * 200, slide: 1400, dur: 0.07, gain: 0.06 }); },
    swing() { noise({ freq: 600, sweep: 2400, q: 0.7, gain: 0.05, dur: 0.15, attack: 0.03 }); },
    hit(heavy) { tone({ freq: heavy ? 110 : 160, slide: heavy ? 50 : 70, dur: 0.14, gain: 0.2 }); noise({ freq: heavy ? 500 : 900, q: 1, gain: 0.14, dur: heavy ? 0.14 : 0.08 }); },
    voice(kind, dist, vol) { const f = VOICES[kind]; if (!f || !ctx) return; const v = Math.max(0, 1 - (dist || 0) / 22) * (vol === undefined ? 1 : vol); if (v > 0.02) f(v); },
    roar(v) { v = v || 1; tone({ freq: 68, slide: 46, dur: 1.8, gain: 0.25 * v, type: 'sawtooth', lp: 480, vib: 18, vibAmt: 8, attack: 0.15, wet: true }); tone({ freq: 104, slide: 70, dur: 1.6, gain: 0.12 * v, type: 'sawtooth', lp: 700, attack: 0.2 }); noise({ freq: 350, q: 0.7, filter: 'lowpass', gain: 0.18 * v, dur: 1.6, attack: 0.2, wet: true }); },
    growl() { VOICES.growl(1.3); },
    slam(v) { v = v === undefined ? 1 : v; tone({ freq: 62, slide: 28, dur: 0.6, gain: 0.4 * v }); noise({ freq: 260, q: 0.8, filter: 'lowpass', gain: 0.3 * v, dur: 0.5, wet: true }); },
    whoosh() { noise({ freq: 400, sweep: 1800, q: 0.9, gain: 0.22, dur: 0.35, attack: 0.08 }); },
    boom(dist) { const v = Math.max(0.2, 1 - (dist || 0) / 40); noise({ freq: 700, sweep: 90, q: 0.6, filter: 'lowpass', gain: 0.5 * v, dur: 1.4, wet: true }); tone({ freq: 55, slide: 24, dur: 0.9, gain: 0.4 * v }); },
    hiss(dist) { VOICES.hiss(Math.max(0, 1 - (dist || 0) / 16) * 1.6); },
    puff() { noise({ freq: 1200, q: 0.6, filter: 'lowpass', gain: 0.06, dur: 0.2 }); },
    teleport(dist) { const v = Math.max(0.1, 1 - (dist || 0) / 30); tone({ freq: 220, slide: 1300, dur: 0.3, gain: 0.06 * v, wet: true }); noise({ freq: 2500, q: 2, gain: 0.04 * v, dur: 0.25 }); },
    crumble() { for (let i = 0; i < 14; i++) noise({ freq: 250 + Math.random() * 600, q: 1.2, gain: 0.2, dur: 0.3, delay: i * 0.1 }); tone({ freq: 50, slide: 30, dur: 1.6, gain: 0.3, wet: true }); },
    drink() { for (let i = 0; i < 4; i++) noise({ freq: 700 + i * 60, q: 3, gain: 0.07, dur: 0.07, delay: i * 0.13 }); tone({ freq: 520, slide: 880, dur: 0.4, gain: 0.04, delay: 0.55, wet: true }); },
    enchant() { [0, 4, 7, 11, 14].forEach((n, i) => tone({ freq: 659 * Math.pow(2, n / 12), dur: 1.4, gain: 0.04, delay: i * 0.07, wet: true, vib: 6, vibAmt: 8 })); noise({ freq: 5000, q: 1, filter: 'highpass', gain: 0.04, dur: 1.2, attack: 0.3, wet: true }); },
    heart() { tone({ freq: 880, dur: 0.15, gain: 0.05 }); tone({ freq: 1320, dur: 0.3, gain: 0.05, delay: 0.12, wet: true }); },
    shear() { noise({ freq: 4500, q: 1, filter: 'highpass', gain: 0.08, dur: 0.06 }); noise({ freq: 4500, q: 1, filter: 'highpass', gain: 0.08, dur: 0.06, delay: 0.12 }); },
    hurt() { tone({ freq: 220, slide: 110, dur: 0.18, gain: 0.16, type: 'triangle' }); noise({ freq: 500, q: 0.8, gain: 0.1, dur: 0.12 }); },
    bow() { tone({ freq: 180, slide: 90, dur: 0.18, gain: 0.12, type: 'triangle' }); noise({ freq: 2500, sweep: 800, q: 1, gain: 0.06, dur: 0.18 }); },
    zap() { for (let i = 0; i < 6; i++) noise({ freq: 1500 + Math.random() * 4000, q: 2, gain: 0.08, dur: 0.05, delay: i * 0.03 }); tone({ freq: 90, slide: 40, dur: 0.4, gain: 0.12, type: 'sawtooth' }); },
    chest() { tone({ freq: 160, slide: 260, dur: 0.25, gain: 0.05, type: 'sawtooth' }); noise({ freq: 700, q: 2, gain: 0.08, dur: 0.15, delay: 0.15 }); },
    ui() { tone({ freq: 880, dur: 0.05, gain: 0.03 }); },
    eat() { for (let i = 0; i < 3; i++) noise({ freq: 1800, q: 1.5, gain: 0.08, dur: 0.06, delay: i * 0.12 }); },
    splash() { noise({ freq: 600, sweep: 2000, q: 0.6, filter: 'lowpass', gain: 0.2, dur: 0.5, attack: 0.02 }); },
    quest() { [0, 4, 7, 12].forEach((n, i) => { const f = 523.25 * Math.pow(2, n / 12); tone({ freq: f, dur: 1.2, gain: 0.07, delay: i * 0.11, wet: true }); tone({ freq: f * 2, dur: 0.6, gain: 0.02, delay: i * 0.11, wet: true }); }); },
    discover() { [0, 7, 12, 16].forEach((n, i) => tone({ freq: 261.6 * Math.pow(2, n / 12), dur: 2.6, gain: 0.05, attack: 0.4, delay: i * 0.18, wet: true, out: musicBus })); },
    death() { [12, 8, 5, 0].forEach((n, i) => tone({ freq: 220 * Math.pow(2, n / 12), dur: 0.9, gain: 0.06, delay: i * 0.22, wet: true })); },
  };
})();
