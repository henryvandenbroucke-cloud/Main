'use strict';
/* The game's behaviour for these mobs (Java Edition 1.21):
   - buckets: a water bucket scoops up cod, salmon, tropical fish, pufferfish, axolotls and tadpoles; the bucket
     keeps the mob (health, name, variant, age) and lets it out as it was
   - tropical fish: 2 shapes x 6 patterns x 16 x 16 colours; 90% of schools are one of the 22 named kinds, the
     rest a random fish each; the bucket's tooltip names the kind
   - pufferfish: puff up when something scary is within 2 blocks (half puffed, then fully after 40 ticks), go
     down 60 / 100 ticks after it leaves; touching one stings for 1 + puff damage and 3 seconds of poison a level
   - axolotls: lucy, wild, gold and cyan (and the 1 in 1200 blue a baby can be); hunt fish and squid in water
     (then rest from hunting 2 minutes) and always fight drowned and guardians; play dead when hurt in water
     (a third of the time, if the hit is big or they are below half health): 10 seconds still, with
     Regeneration; a player who kills what an axolotl fought gets Regeneration (5 seconds more each time, at
     most 2 minutes) and loses Mining Fatigue; dry out after 5 minutes out of water; bred with a bucket of
     tropical fish (the empty water bucket comes back)
   - allays: hold one item given to them, gather matching dropped items within 32 blocks, bring them to the
     player who gave the item, or for 30 seconds to a note block they heard within 16 blocks; three seconds
     between deliveries; dance by a playing jukebox, and an amethyst shard given to a dancing allay makes a
     second one (5 minute cooldown); heal 1 every half second; can't be hurt by their player
   - jukeboxes play each disc for its length, with note particles every second, and name it on screen
   - breezes: breathe in for 15 ticks, then shoot a wind charge at a target 2 to 16 blocks off (then rest 14
     ticks); leap to a spot 4 to 8 blocks behind the target; slide to keep 4 to 8 blocks away; turn every
     projectile but wind charges back at half speed
   - camels: sit down (2 seconds) and stand up (2.6 seconds) now and then; carry two riders; dash with the jump
     bar (2.75 second cooldown); panic when hurt; cactus heals 2 and breeds
   - sniffers: sniff, walk to a diggable block in front (dirt, grass, podzol, coarse or rooted dirt, moss, mud,
     muddy mangrove roots) they have not dug before, dig for 8 seconds and turn up torchflower seeds or a pitcher
     pod, then rest 8 minutes; breeding lays a sniffer egg
   - armadillos: roll up when an undead mob, their attacker, or a sprinting or riding player comes within 7
     blocks; rolled up they take (damage - 1) / 2, and unroll 4 seconds after the danger goes; drop a scute every
     5 to 10 minutes, or when brushed */
const Creatures = (() => {
  const { DEFS, def, P, A } = EntityModels;
  const PI = Math.PI;
  const nameOf = s => s ? ITEMS[s.id].name : '';
  const take = (p, s) => { if (!p.creative) { s.count--; if (s.count <= 0) p.inv.held = null; p.inv.changed && p.inv.changed(); } };
  const reg = (n, c) => { MobTypes[n] = c; };
  const dist3 = (a, x, y, z) => Math.hypot(a.x - x, a.y - y, a.z - z);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * v); };
  const furBox = (s, u, v, w, h, d, col, n) => s.box(u, v, w, h, d, col, n === undefined ? 0.09 : n);
  // the same parts with every box blown up a little (pattern and overlay layers)
  const inflate = (parts, k) => parts.map(q => Object.assign({}, q, { b: q.b.map(b => { const n = b.slice(); while (n.length < 8) n.push(0); n[8] = (n[8] || 0) + k; return n; }), c: inflate(q.c || [], k) }));

  // ---------------------------------------------------------------- sounds
  const { tone, noise, T, rp, voice } = Sound.synth, N = Sound.N, MOB = Sound.MOB;
  N.bucket_fill_fish = d => { N.bucket_fill(d); noise(d, T() + 0.12, 0.06, 'lowpass', 1200, 2, 0.35); };
  N.bucket_empty_fish = d => { N.bucket_empty(d); noise(d, T() + 0.15, 0.06, 'lowpass', 1200, 2, 0.35); };
  N.bucket_fill_axolotl = N.bucket_fill_tadpole = N.bucket_fill_fish; N.bucket_empty_axolotl = N.bucket_empty_tadpole = N.bucket_empty_fish;
  N.puffer_fish_blow_up = d => noise(d, T(), 0.35, 'bandpass', 500, 1.5, 0.4, 0.05, (fl, t) => fl.frequency.exponentialRampToValueAtTime(1600, t + 0.3));
  N.puffer_fish_blow_out = d => noise(d, T(), 0.4, 'bandpass', 1500, 1.5, 0.35, 0.02, (fl, t) => fl.frequency.exponentialRampToValueAtTime(350, t + 0.4));
  N.puffer_fish_sting = d => { noise(d, T(), 0.08, 'highpass', 3000, 1, 0.4); tone(d, T(), 'square', 900, 0.1, 0.08, { to: 500, lp: 3000 }); };
  MOB.axolotl = { say: d => voice(d, rp(900, 1300), 0.12, { type: 'triangle', to: rp(1200, 1600), lp: 3000, v: 0.1 }), hurt: d => voice(d, 1400, 0.15, { type: 'triangle', to: 900, v: 0.18 }), death: d => voice(d, 1200, 0.45, { type: 'triangle', to: 450, v: 0.18 }) };
  N.axolotl_attack = d => noise(d, T(), 0.1, 'bandpass', 1500, 2, 0.4);
  MOB.allay = { say: d => { const f = rp(700, 1000); tone(d, T(), 'sine', f, 0.5, 0.1, { to: f * 1.5, vib: [8, 20], attack: 0.05 }); tone(d, T() + 0.05, 'sine', f * 2, 0.35, 0.035); }, hurt: d => tone(d, T(), 'sine', 1200, 0.2, 0.14, { to: 800 }), death: d => tone(d, T(), 'sine', 1100, 0.7, 0.14, { to: 300, vib: [10, 30] }) };
  N.allay_item_given = d => [880, 1108, 1318].forEach((f, i) => tone(d, T() + i * 0.08, 'sine', f, 0.22, 0.11));
  N.allay_item_taken = d => [1318, 988, 880].forEach((f, i) => tone(d, T() + i * 0.08, 'sine', f, 0.22, 0.11));
  N.allay_throw = d => { noise(d, T(), 0.15, 'bandpass', 2000, 2, 0.18); tone(d, T(), 'sine', 1000, 0.15, 0.07, { to: 1500 }); };
  N.amethyst_block_chime = d => [1567, 2093, 2637].forEach((f, i) => tone(d, T() + i * 0.05, 'sine', f, 1.2, 0.07));
  MOB.breeze = { say: d => noise(d, T(), 0.8, 'bandpass', rp(500, 900), 3, 0.14, 0.2, (fl, t) => fl.frequency.linearRampToValueAtTime(rp(1200, 1800), t + 0.8)),
    hurt: d => { noise(d, T(), 0.25, 'bandpass', 1500, 2, 0.35); tone(d, T(), 'sawtooth', 300, 0.2, 0.08, { to: 200, lp: 1200 }); },
    death: d => noise(d, T(), 1, 'bandpass', 1200, 2, 0.35, 0.02, (fl, t) => fl.frequency.exponentialRampToValueAtTime(200, t + 1)) };
  N.breeze_inhale = d => noise(d, T(), 0.7, 'bandpass', 300, 2, 0.3, 0.5, (fl, t) => fl.frequency.exponentialRampToValueAtTime(1500, t + 0.7));
  N.breeze_charge = d => noise(d, T(), 0.5, 'bandpass', 400, 3, 0.25, 0.3, (fl, t) => fl.frequency.exponentialRampToValueAtTime(1100, t + 0.5));
  N.breeze_shoot = d => noise(d, T(), 0.3, 'bandpass', 1200, 1.5, 0.45, 0.01, (fl, t) => fl.frequency.exponentialRampToValueAtTime(400, t + 0.3));
  N.breeze_jump = d => noise(d, T(), 0.4, 'bandpass', 500, 1.5, 0.4, 0.01, (fl, t) => fl.frequency.exponentialRampToValueAtTime(1800, t + 0.4));
  N.breeze_land = d => noise(d, T(), 0.3, 'lowpass', 700, 1, 0.4);
  N.breeze_slide = d => noise(d, T(), 0.4, 'bandpass', 900, 2, 0.14, 0.1);
  N.breeze_deflect = d => { noise(d, T(), 0.2, 'highpass', 2500, 1, 0.3); tone(d, T(), 'triangle', 1500, 0.15, 0.08, { to: 2200 }); };
  MOB.camel = { say: d => voice(d, rp(90, 120), 0.7, { lp: 600, bp: 300, q: 3, vib: [6, 10], v: 0.3, attack: 0.08 }), hurt: d => voice(d, 160, 0.35, { lp: 800, bp: 400, q: 3, to: 110 }), death: d => voice(d, 130, 1, { lp: 700, bp: 350, q: 3, to: 60 }) };
  N.camel_dash = d => { noise(d, T(), 0.25, 'lowpass', 800, 1, 0.4); voice(d, 140, 0.3, { lp: 700, bp: 350, q: 3, to: 220 }); };
  N.camel_dash_ready = d => voice(d, 180, 0.2, { lp: 900, bp: 400, q: 3 });
  N.camel_sit = d => noise(d, T(), 0.5, 'lowpass', 500, 1, 0.3, 0.1);
  N.camel_stand = d => noise(d, T(), 0.6, 'lowpass', 600, 1, 0.3, 0.2);
  N.camel_eat = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.12, 0.06, 'bandpass', 1400, 2, 0.25); };
  MOB.armadillo = { say: d => tone(d, T(), 'triangle', rp(700, 900), 0.12, 0.08, { to: rp(500, 700) }), hurt: d => tone(d, T(), 'triangle', 1000, 0.15, 0.14, { to: 600 }), death: d => tone(d, T(), 'triangle', 900, 0.5, 0.14, { to: 300 }) };
  N.armadillo_roll = d => noise(d, T(), 0.3, 'bandpass', 900, 2, 0.3);
  N.armadillo_unroll_start = d => noise(d, T(), 0.2, 'bandpass', 1100, 2, 0.25);
  N.armadillo_unroll_finish = d => noise(d, T(), 0.25, 'bandpass', 1300, 2, 0.25);
  N.armadillo_peek = d => tone(d, T(), 'triangle', 1200, 0.08, 0.07);
  N.armadillo_scute_drop = d => { noise(d, T(), 0.1, 'bandpass', 2500, 3, 0.25); tone(d, T(), 'sine', 1800, 0.1, 0.05); };
  N.armadillo_brush = d => { N.brush(d); N.armadillo_scute_drop(d); };
  N.armadillo_eat = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.1, 0.05, 'bandpass', 1800, 2, 0.2); };
  MOB.sniffer = { say: d => voice(d, rp(70, 90), 0.8, { lp: 500, bp: 200, q: 3, vib: [4, 8], v: 0.3, attack: 0.1 }), hurt: d => voice(d, 120, 0.4, { lp: 700, bp: 300, q: 3, to: 80 }), death: d => voice(d, 100, 1.2, { lp: 600, bp: 250, q: 3, to: 40 }) };
  N.sniffer_sniffing = d => { for (let i = 0; i < 4; i++) noise(d, T() + i * 0.18, 0.12, 'bandpass', 900, 3, 0.25, 0.03); };
  N.sniffer_scenting = d => noise(d, T(), 0.8, 'bandpass', 700, 3, 0.25, 0.3);
  N.sniffer_searching = d => { for (let i = 0; i < 2; i++) noise(d, T() + i * 0.25, 0.15, 'bandpass', 800, 3, 0.2, 0.03); };
  N.sniffer_digging = d => { for (let i = 0; i < 6; i++) noise(d, T() + i * 0.15, 0.1, 'lowpass', 600, 1, 0.3); };
  N.sniffer_digging_stop = d => noise(d, T(), 0.4, 'lowpass', 500, 1, 0.3, 0.05);
  N.sniffer_drop_seed = N.pop;
  N.sniffer_happy = d => voice(d, 110, 0.6, { lp: 700, bp: 300, q: 3, to: 160, v: 0.3 });
  N.sniffer_eat = d => { for (let i = 0; i < 3; i++) noise(d, T() + i * 0.14, 0.07, 'lowpass', 900, 1, 0.3); };
  N.sniffer_egg_plop = d => { noise(d, T(), 0.12, 'lowpass', 600, 1, 0.5); tone(d, T(), 'sine', 180, 0.15, 0.2, { to: 90 }); };

  // ---------------------------------------------------------------- buckets (the game's Bucketable)
  function bucketUp(m, p, s) {
    if (!s || nameOf(s) !== 'water_bucket' || m.dead || m.removed) return false;
    const d = { health: m.health }; if (m.customName) d.name = m.customName; if (m.bucketData) m.bucketData(d);
    Sound.play(m.type === 'axolotl' ? 'bucket_fill_axolotl' : m.type === 'tadpole' ? 'bucket_fill_tadpole' : 'bucket_fill_fish', m);
    ItemUse.exchange(p, false, stack(m.type + '_bucket', 1, { tag: { mob: d } }));
    p.swingArm && p.swingArm();
    m.removed = true;
    return true;
  }
  // fish out of a bucket stay; others go when far from players
  class Fish extends WaterMob {
    onInteract(p, s) { return bucketUp(this, p, s); }
    saveExtra(d) { d.fromBucket = !!this.fromBucket; }
    loadExtra(d) { this.fromBucket = !!d.fromBucket; }
  }
  for (const n of ['cod', 'salmon']) reg(n, class extends Fish { constructor(t, x, y, z) { super(n, x, y, z); } });

  // ---------------------------------------------------------------- tropical fish
  const PATTERNS = ['kob', 'sunstreak', 'snooper', 'dasher', 'brinely', 'spotty', 'flopper', 'stripey', 'glitter', 'blockfish', 'betty', 'clayfish'];
  const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  // the game's DyeColor texture colours (what fish and collars are tinted with)
  const DYE_RGB = { white: 0xF9FFFE, orange: 0xF9801D, magenta: 0xC74EBD, light_blue: 0x3AB3DA, yellow: 0xFED83D, lime: 0x80C71F, pink: 0xF38BAA, gray: 0x474F52, light_gray: 0x9D9D97, cyan: 0x169C9C, purple: 0x8932B8, blue: 0x3C44AA, brown: 0x835432, green: 0x5E7C16, red: 0xB02E26, black: 0x1D1D21 };
  const rgb = c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  // TropicalFish.COMMON_VARIANTS, in the order of their names
  const COMMON = [['stripey', 'orange', 'gray'], ['flopper', 'gray', 'gray'], ['flopper', 'gray', 'blue'], ['clayfish', 'white', 'gray'], ['sunstreak', 'blue', 'gray'], ['kob', 'orange', 'white'], ['spotty', 'pink', 'light_blue'], ['blockfish', 'purple', 'yellow'], ['clayfish', 'white', 'red'], ['spotty', 'white', 'yellow'], ['glitter', 'white', 'gray'], ['clayfish', 'white', 'orange'], ['dasher', 'cyan', 'pink'], ['brinely', 'lime', 'light_blue'], ['betty', 'red', 'white'], ['snooper', 'gray', 'red'], ['blockfish', 'red', 'white'], ['flopper', 'white', 'yellow'], ['kob', 'red', 'white'], ['sunstreak', 'gray', 'white'], ['dasher', 'cyan', 'yellow'], ['flopper', 'yellow', 'yellow']];
  const COMMON_NAMES = ['Anemone', 'Black Tang', 'Blue Tang', 'Butterflyfish', 'Cichlid', 'Clownfish', 'Cotton Candy Betta', 'Dottyback', 'Emperor Red Snapper', 'Goatfish', 'Moorish Idol', 'Ornate Butterflyfish', 'Parrotfish', 'Queen Angelfish', 'Red Cichlid', 'Red Lipped Blenny', 'Red Snapper', 'Threadfin', 'Tomato Clownfish', 'Triggerfish', 'Yellowtail Parrotfish', 'Yellow Tang'];
  const title = n => n.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  // the model A parts are the small fish already defined; model B is the tall one
  const TF_A = DEFS.tropical_fish.parts;
  const TF_B = [
    P('body', [0, 19, 0], 0, [[0, 20, -1, -3, -3, 2, 6, 6]]), P('tail', [0, 19, 3], 0, [[21, 16, 0, -3, 0, 0, 6, 5]]),
    P('right_fin', [-1, 20, 0], [0, PI / 4, 0], [[2, 16, -2, 0, 0, 2, 2, 0]]), P('left_fin', [1, 20, 0], [0, -PI / 4, 0], [[2, 12, 0, 0, 0, 2, 2, 0]]),
    P('top_fin', [0, 16, -3], 0, [[20, 11, 0, -4, 0, 0, 4, 6]]), P('bottom_fin', [0, 22, -3], 0, [[20, 21, 0, 0, 0, 0, 4, 6]]),
  ];
  // the faces each shape paints on: body sides run head (i = 0) to tail; fins and tail are flat
  const SHAPE = {
    a: { side: [[8, 6, true], [0, 6, false]], len: 6, tall: 3, top: [6, 0, 2, 6], tail: [[22, 0, 6, 3], [28, 0, 4, 3]], fin: [[10, 1, 6, 3], [16, 1, 6, 3]], low: null, pecs: [[2, 16, 4, 2], [2, 12, 4, 2]], front: [6, 6, 2, 3] },
    b: { side: [[8, 26, true], [0, 26, false]], len: 6, tall: 6, top: [6, 20, 2, 6], tail: [[21, 21, 5, 6], [26, 21, 5, 6]], fin: [[20, 17, 6, 4], [26, 17, 6, 4]], low: [[20, 27, 6, 4], [26, 27, 6, 4]], pecs: [[2, 16, 4, 2], [2, 12, 4, 2]], front: [6, 26, 2, 6] },
  };
  // paint a cell (i along the body from the head, j down) on both sides of the body
  const both = (s, S, i, j, col) => { for (const [x, y, headLow] of S.side) s.px(x + (headLow ? i : S.len - 1 - i), y + j, col); };
  const rect = (s, r, col, n) => s.fill(r[0], r[1], r[2], r[3], col, n === undefined ? 0.04 : n);
  function tfBase(shape) {
    const S = SHAPE[shape];
    return s => {
      const w = 0xf2f2f2;
      if (shape === 'a') furBox(s, 0, 0, 2, 3, 6, w, 0.04); else furBox(s, 0, 20, 2, 6, 6, w, 0.04);
      for (const r of S.tail.concat(S.fin, S.low || [], S.pecs)) rect(s, r, 0xe4e4e4, 0.05);
      // eyes near the head on each side
      both(s, S, 0, shape === 'a' ? 1 : 2, 0x101010);
    };
  }
  // the twelve patterns, painted white so the layer takes the pattern colour
  const W = 0xffffff;
  const PAINT = {
    kob: (s, S) => { for (let j = 0; j < S.tall; j++) { both(s, S, 2, j, W); both(s, S, 3, j, W); } rect(s, [S.tail[0][0], S.tail[0][1], 2, S.tail[0][3]], W); rect(s, [S.tail[1][0] + S.tail[1][2] - 2, S.tail[1][1], 2, S.tail[1][3]], W); },
    sunstreak: (s, S) => { for (let i = 0; i < S.len; i++) both(s, S, i, 0, W); for (let i = 1; i < S.len; i++) both(s, S, i, Math.min(S.tall - 1, i >> 1), W); rect(s, S.top, W); for (const r of S.fin) rect(s, r, W); },
    snooper: (s, S) => { for (let i = 0; i < S.len; i++) for (let j = 0; j < S.tall; j++) if (j === 0 || i >= 4) both(s, S, i, j, W); for (const r of S.tail.concat(S.fin)) rect(s, r, W); },
    dasher: (s, S) => { for (let i = 1; i < S.len; i++) both(s, S, i, 1, W); for (const r of S.tail) rect(s, [r[0], r[1] + 1, r[2], 1], W); for (const r of S.fin) rect(s, r, W); },
    brinely: (s, S) => { for (let i = 0; i < S.len; i++) both(s, S, i, S.tall - 1, W); for (let j = 0; j < S.tall; j++) { both(s, S, 4, j, W); both(s, S, 5, j, W); } for (const r of S.pecs.concat(S.tail)) rect(s, r, W); },
    spotty: (s, S) => { for (const [i, j] of [[1, 0], [3, 1], [5, 0], [2, 2], [4, 2]]) both(s, S, i, j, W); for (const r of S.tail) { s.px(r[0] + 1, r[1] + 1, W); s.px(r[0] + 3, r[1], W); } rect(s, S.top, W); },
    flopper: (s, S) => { for (let i = 0; i < S.len; i++) { both(s, S, i, 0, W); both(s, S, i, 1, W); both(s, S, i, S.tall - 1, W); } for (const r of S.fin.concat(S.low, S.pecs)) rect(s, r, W); rect(s, S.top, W); },
    stripey: (s, S) => { for (const i of [1, 3, 5]) for (let j = 0; j < S.tall; j++) both(s, S, i, j, W); for (const r of S.tail) rect(s, [r[0], r[1], 1, r[3]], W); },
    glitter: (s, S) => { for (let i = 0; i < S.len; i++) for (let j = 0; j < S.tall; j++) if ((i * 7 + j * 5) % 3 === 0) both(s, S, i, j, W); for (const r of S.fin.concat(S.low, S.tail)) rect(s, r, W); },
    blockfish: (s, S) => { for (let i = 3; i < S.len; i++) for (let j = 0; j < S.tall; j++) both(s, S, i, j, W); for (const r of S.tail.concat(S.low)) rect(s, r, W); rect(s, [S.top[0], S.top[1] + 3, S.top[2], 3], W); },
    betty: (s, S) => { for (const i of [0, 2, 4]) for (let j = 0; j < S.tall; j++) both(s, S, i, j, W); for (const r of S.fin) rect(s, [r[0], r[1], r[2], 2], W); },
    clayfish: (s, S) => { for (let i = 0; i < 3; i++) for (let j = 1; j < S.tall - 1; j++) both(s, S, i, j, W); rect(s, S.front, W); for (const r of S.fin) rect(s, r, W); for (const r of S.tail) rect(s, [r[0] + 1, r[1] + 1, 2, r[3] - 2], W); },
  };
  def('tropical_fish_a', 32, 32, TF_A, { anim: 'fish', skin: tfBase('a') });
  def('tropical_fish_b', 32, 32, TF_B, { anim: 'fish', skin: tfBase('b') });
  PATTERNS.forEach((pt, k) => { const sh = k < 6 ? 'a' : 'b'; def('tf_' + pt, 32, 32, inflate(sh === 'a' ? TF_A : TF_B, 0.008), { anim: 'fish', skin: s => PAINT[pt](s, SHAPE[sh]) }); });
  function fishName(v) {
    const k = COMMON.findIndex(c => c[0] === v[0] && c[1] === v[1] && c[2] === v[2]);
    if (k >= 0) return [COMMON_NAMES[k]];
    return [title(v[0]), title(v[1]) + (v[1] !== v[2] ? ', ' + title(v[2]) : '')];
  }
  class TropicalFish extends Fish {
    constructor(t, x, y, z) { super('tropical_fish', x, y, z); this.variant = COMMON[rnd(COMMON.length)].slice(); }
    // TropicalFish.finalizeSpawn: a school shares one of the 22 kinds; one in ten fish is random (and swims alone)
    finalizeSpawn(g) {
      if (g.tropical) { this.variant = g.tropical.slice(); return; }
      if (Math.random() < 0.9) { this.variant = COMMON[rnd(COMMON.length)].slice(); g.tropical = this.variant; }
      else this.variant = [PATTERNS[rnd(12)], DYES[rnd(16)], DYES[rnd(16)]];
    }
    get model() { return PATTERNS.indexOf(this.variant[0]) < 6 ? 'tropical_fish_a' : 'tropical_fish_b'; } set model(v) {}
    get tint() { return rgb(DYE_RGB[this.variant[1]] || 0xffffff); }
    layers() { return [{ model: 'tf_' + this.variant[0], color: e => rgb(DYE_RGB[e.variant[2]] || 0xffffff) }]; }
    bucketData(d) { d.variant = this.variant.slice(); }
    loadBucket(d) { if (d.variant) this.variant = d.variant.slice(); }
    saveExtra(d) { super.saveExtra(d); d.variant = this.variant; }
    loadExtra(d) { super.loadExtra(d); if (d.variant) this.variant = d.variant; }
  }
  reg('tropical_fish', TropicalFish);

  // ---------------------------------------------------------------- pufferfish
  def('pufferfish_small', 32, 32, [
    P('body', [0, 23, 0], 0, [[0, 27, -1.5, -2, -1.5, 3, 2, 3]]),
    P('right_eye', [0, 20, 0], 0, [[24, 6, -1.5, 0, -1.5, 1, 1, 1]]), P('left_eye', [0, 20, 0], 0, [[28, 6, 0.5, 0, -1.5, 1, 1, 1]]),
    P('tail_fin', [0, 22, 1.5], 0, [[-3, 0, -1.5, 0, 0, 3, 0, 3]]),
    P('right_fin', [-1.5, 22, -1.5], 0, [[25, 0, -1, 0, 0, 1, 0, 2]]), P('left_fin', [1.5, 22, -1.5], 0, [[25, 0, 0, 0, 0, 1, 0, 2]]),
  ], { anim: 'fish', skin: s => { const c = 0xe8c040; furBox(s, 0, 27, 3, 2, 3, c, 0.06); furBox(s, 24, 6, 1, 1, 1, 0x101010, 0); furBox(s, 28, 6, 1, 1, 1, 0x101010, 0); s.fill(0, 0, 6, 3, 0x5a8a9a, 0.04); s.fill(25, 0, 4, 2, 0x5a8a9a, 0.04); } });
  const spike = (n, at, r, box) => P(n, at, r, [box]);
  def('pufferfish_big', 32, 32, [
    P('body', [0, 22, 0], 0, [[0, 0, -4, -8, -4, 8, 8, 8]]),
    P('right_blue_fin', [-4, 15, -2], 0, [[24, 0, -2, 0, -1, 2, 1, 2]]), P('left_blue_fin', [4, 15, -2], 0, [[24, 3, 0, 0, -1, 2, 1, 2]]),
    spike('top_front_fin', [0, 14, -4], [PI / 4, 0, 0], [15, 17, -4, -1, 0, 8, 1, 0]), spike('top_middle_fin', [0, 14, 0], 0, [14, 16, -4, -1, 0, 8, 1, 1]), spike('top_back_fin', [0, 14, 4], [-PI / 4, 0, 0], [23, 18, -4, -1, 0, 8, 1, 0]),
    spike('right_front_fin', [-4, 22, -4], [0, -PI / 4, 0], [5, 17, -1, -8, 0, 1, 8, 0]), spike('left_front_fin', [4, 22, -4], [0, PI / 4, 0], [1, 17, 0, -8, 0, 1, 8, 0]),
    spike('bottom_front_fin', [0, 22, -4], [-PI / 4, 0, 0], [15, 20, -4, 0, 0, 8, 1, 0]), spike('bottom_middle_fin', [0, 22, 0], 0, [15, 20, -4, 0, 0, 8, 1, 0]), spike('bottom_back_fin', [0, 22, 4], [PI / 4, 0, 0], [15, 20, -4, 0, 0, 8, 1, 0]),
    spike('right_back_fin', [-4, 22, 4], [0, PI / 4, 0], [9, 17, -1, -8, 0, 1, 8, 0]), spike('left_back_fin', [4, 22, 4], [0, -PI / 4, 0], [9, 17, 0, -8, 0, 1, 8, 0]),
  ], { anim: 'fish', skin: s => { const c = 0xe8c040; const B = furBox(s, 0, 0, 8, 8, 8, c, 0.06); s.speckle(B.top[0], B.top[1], 8, 8, [c, c, 0x8a7a2a]); s.fill(B.front[0] + 1, B.front[1] + 2, 2, 2, 0x101010, 0); s.fill(B.front[0] + 5, B.front[1] + 2, 2, 2, 0x101010, 0); s.fill(B.front[0] + 2, B.front[1] + 5, 4, 1, 0x7a5a1a, 0); s.fill(24, 0, 6, 6, 0x5a8a9a, 0.04); s.fill(0, 16, 32, 6, 0xf0f0e8, 0.04); } });
  // pufferfish don't fear their own kind, other fish, squid, turtles, guardians or tadpoles
  const NOT_SCARY = new Set(['turtle', 'guardian', 'elder_guardian', 'cod', 'pufferfish', 'salmon', 'squid', 'glow_squid', 'tropical_fish', 'tadpole']);
  const box = e => [e.x - e.w / 2, e.y, e.z - e.w / 2, e.x + e.w / 2, e.y + e.h, e.z + e.w / 2];
  const near = (a, b, k) => { const A1 = box(a), B1 = box(b); return A1[0] - k < B1[3] && A1[3] + k > B1[0] && A1[1] - k < B1[4] && A1[4] + k > B1[1] && A1[2] - k < B1[5] && A1[5] + k > B1[2]; };
  class Pufferfish extends Fish {
    constructor(t, x, y, z) { super('pufferfish', x, y, z); this.puff = 0; this.inflateT = 0; this.deflateT = 0; this.setPuff(0); }
    get model() { return ['pufferfish_small', 'pufferfish', 'pufferfish_big'][this.puff]; } set model(v) {}
    setPuff(n) { this.puff = n; const k = [0.5, 0.7, 1][n]; this.w = 0.7 * k; this.h = 0.7 * k; }
    scary(e) { return e !== this && !e.dead && !e.removed && (e.isPlayer ? !e.creative && !e.spectator : e.living && !NOT_SCARY.has(e.type)); }
    aiStep() {
      super.aiStep();
      // PufferfishPuffGoal: something scary within 2 blocks
      const p = Game.player;
      const scared = (p && this.scary(p) && near(this, p, 2)) || Entities.list.some(e => e.living && this.scary(e) && near(this, e, 2));
      if (scared) { if (!this.inflateT) { this.inflateT = 1; this.deflateT = 0; } } else this.inflateT = 0;
      if (this.inflateT > 0) {
        if (this.puff === 0) { this.setPuff(1); Sound.play('puffer_fish_blow_up', this); }
        else if (this.inflateT > 40 && this.puff === 1) { this.setPuff(2); Sound.play('puffer_fish_blow_up', this); }
        this.inflateT++;
      } else if (this.puff !== 0) {
        if (this.deflateT > 60 && this.puff === 2) { this.setPuff(1); Sound.play('puffer_fish_blow_out', this); }
        else if (this.deflateT > 100 && this.puff === 1) { this.setPuff(0); Sound.play('puffer_fish_blow_out', this); }
        this.deflateT++;
      }
      // stinging what touches it: 1 + puff damage, 3 seconds of poison for each level of puff
      if (this.puff > 0) {
        const sting = e => { if (e.hurt(1 + this.puff, 'mob', this)) { e.addEffect && e.addEffect('poison', 60 * this.puff, 0); Sound.play('puffer_fish_sting', this); } };
        for (const e of Entities.list) if (e.living && e instanceof Mob && this.scary(e) && near(this, e, 0.3)) sting(e);
        if (p && this.scary(p) && near(this, p, 0)) sting(p);
      }
    }
    saveExtra(d) { super.saveExtra(d); d.puff = this.puff; }
    loadExtra(d) { super.loadExtra(d); this.setPuff(d.puff || 0); }
  }
  reg('pufferfish', Pufferfish);

  // ---------------------------------------------------------------- tadpoles go into buckets too, and grow faster on slime balls
  if (MobTypes.tadpole) {
    const Tad = MobTypes.tadpole;
    reg('tadpole', class extends Tad {
      constructor(t, x, y, z) { super(t, x, y, z); this.despawnable = true; }
      onInteract(p, s) {
        if (bucketUp(this, p, s)) return true;
        if (nameOf(s) === 'slime_ball') { this.growT -= Math.floor(this.growT / 20 * 0.1) * 20; take(p, s); Particles.happy(this); return true; }
        return false;
      }
      bucketData(d) { d.age = this.growT; }
      loadBucket(d) { if (d.age) this.growT = d.age; }
      saveExtra(d) { d.growT = this.growT; d.fromBucket = !!this.fromBucket; }
      loadExtra(d) { if (d.growT) this.growT = d.growT; this.fromBucket = !!d.fromBucket; }
    });
  }

  // ---------------------------------------------------------------- axolotls
  const AX = { lucy: [0xf7b3cc, 0xe0508c, 0x2a0a1a], wild: [0x6e5446, 0x8a4a62, 0xd8b030], gold: [0xf6c84a, 0xe89a2a, 0x3a2a10], cyan: [0xe2f2f6, 0x5ac8e0, 0x28485a], blue: [0x4a5ac8, 0x9a5ac8, 0xe8d040] };
  const AX_COMMON = ['lucy', 'wild', 'gold', 'cyan'];
  for (const v in AX) {
    const [c, g, eye] = AX[v];
    def('axolotl_' + v, 64, 64, DEFS.axolotl.parts, { anim: 'axolotl_v', skin: s => {
      furBox(s, 0, 11, 8, 4, 10, c, 0.06); s.fill(2, 17, 18, 5, g, 0.05);
      const H = furBox(s, 0, 1, 8, 5, 5, c, 0.05); s.px(H.front[0] + 1, H.front[1] + 1, eye); s.px(H.front[0] + 6, H.front[1] + 1, eye);
      if (v === 'wild') s.speckle(0, 11, 36, 14, [c, c, c, 0x4a362a]);
      s.fill(3, 37, 8, 3, g, 0); s.fill(0, 40, 14, 7, g, 0.05); s.fill(2, 13, 6, 5, c, 0.05); s.fill(2, 19, 24, 5, c, 0.05);
    } });
  }
  // lying still on its side while it plays dead
  A.axolotl_v = (m, s) => {
    A.axolotl(m, s); const L = m.parts;
    m.body.rotation.z = s.playDead ? PI / 2 : 0;
    if (s.playDead) { L.body.rx = 0; L.tail.ry = 0; for (const n of ['right_hind_leg', 'left_hind_leg', 'right_front_leg', 'left_front_leg']) L[n].rx = 1.4; }
  };
  const AX_HUNT = new Set(['tropical_fish', 'pufferfish', 'salmon', 'cod', 'squid', 'glow_squid', 'tadpole']);
  const AX_HOSTILE = new Set(['drowned', 'guardian', 'elder_guardian']);
  const water = (x, y, z) => BLOCKS[World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))].fluid === 'water';
  // on land an axolotl heads for water within 8 blocks
  class FindWater extends Goal {
    constructor(m) { super(m, 'M'); }
    canUse() {
      const m = this.m; if (m.inWater || m.age % 20 !== 0) return false;
      for (let k = 0; k < 20; k++) { const x = Math.floor(m.x) + rnd(17) - 8, y = Math.floor(m.y) + rnd(5) - 2, z = Math.floor(m.z) + rnd(17) - 8; if (water(x, y, z)) { this.t = [x, y, z]; return true; } }
      return false;
    }
    start() { this.m.nav.moveTo(this.t[0], this.t[1], this.t[2], 1); }
    canContinue() { return !this.m.inWater && !this.m.nav.done(); }
    stop() { this.m.nav.stop(); }
  }
  class Axolotl extends Animal {
    constructor(t, x, y, z) { super('axolotl', x, y, z); this.swims = true; this.waterMalus = 0; this.air = 6000; this.variant = AX_COMMON[rnd(4)]; this.playDead = 0; this.huntCool = 0; this.atkCool = 0; this.wander = null; this.despawnable = true; }
    get food() { return ['tropical_fish_bucket']; }
    get model() { return 'axolotl_' + this.variant; } set model(v) {}
    get untargetable() { return this.playDead > 0; }
    registerGoals() {
      const g = this.goals;
      g.add(1, new FindWater(this)); g.add(2, new G.Breed(this, 1)); g.add(3, new G.Tempt(this, 1.1, ['tropical_fish_bucket']));
      g.add(4, new G.FollowParent(this, 1.1)); g.add(6, new G.RandomStroll(this, 1, 120)); g.add(7, new G.LookAtPlayer(this, 6));
    }
    // a spawn group shares two colours
    finalizeSpawn(g) { if (!g.axolotl) g.axolotl = [AX_COMMON[rnd(4)], AX_COMMON[rnd(4)]]; this.variant = g.axolotl[rnd(2)]; }
    inherit(a, b) { this.variant = Math.random() < 1 / 1200 ? 'blue' : Math.random() < 0.5 ? a.variant : b.variant; this.persistent = true; }
    // breeding takes the fish out of the bucket and leaves the water in it
    useFood(p, s) { if (!p.creative) { p.inv.held = stack('water_bucket'); p.inv.changed && p.inv.changed(); } }
    onInteract(p, s) { return bucketUp(this, p, s); }
    bucketData(d) { d.variant = this.variant; d.age = this.ageTicks; d.baby = this.baby; d.huntCool = this.huntCool; }
    loadBucket(d) { if (d.variant) this.variant = d.variant; if (d.baby) { this.setBaby(); this.ageTicks = d.age || -24000; } else this.ageTicks = d.age || 0; this.huntCool = d.huntCool || 0; }
    hurt(n, src, a) {
      // play dead: a third of the time, when the hit is big (a roll of 0-2 under it) or it is below half health,
      // in water, and the hit came from something
      const h = this.health;
      if (!this.dead && this.playDead <= 0 && Math.random() < 1 / 3 && (rnd(3) < n || h / this.maxHealth < 0.5) && n < h && this.inWater && a) {
        this.playDead = 200; this.addEffect('regeneration', 200, 0); this.target = null; this.nav.stop();
      }
      return super.hurt(n, src, a);
    }
    // the player killed what this axolotl was fighting: Regeneration, 5 seconds more each time up to 2 minutes
    support(p) {
      const r = p.effect('regeneration');
      if (!r || r.dur < 2400) p.addEffect('regeneration', Math.min(2400, 100 + (r ? r.dur : 0)), 0);
      p.effects.delete('mining_fatigue');
    }
    aiStep() {
      // out of water (rain counts) it dries: 6000 ticks, then 2 damage a second
      if (!this.inWater && !Weather.rainingAt(this.x, this.y + 0.5, this.z)) { if (--this.air <= -20) { this.air = 0; this.hurt(2, 'dryOut'); } } else this.air = 6000;
      if (this.huntCool > 0) this.huntCool--;
      if (this.atkCool > 0) this.atkCool--;
      const lt = this.lastTarget;
      if (lt && lt.dead) {
        this.lastTarget = null;
        const k = lt.killer && (lt.killer.isPlayer ? lt.killer : lt.killer.owner && lt.killer.owner.isPlayer ? lt.killer.owner : null);
        if (k && !k.dead && this.distTo(k) <= 20) this.support(k);
      }
      if (this.playDead > 0) { this.playDead--; this.nav.stop(); this.forward = this.strafe = 0; this.target = null; this.swimGoal = null; return; }
      // the sensor: within 8 blocks and in water, always drowned and guardians, prey when not resting from a hunt
      if (!this.target && this.age % 10 === 0 && !this.inLove) {
        const t = this.nearest(e => e.living && !e.dead && !e.untargetable && e.inWater && (AX_HOSTILE.has(e.type) || (!this.huntCool && AX_HUNT.has(e.type))) && this.canSee(e), 8);
        if (t) this.target = t;
      }
      const t = this.target;
      if (t && (t.dead || t.removed || !t.inWater || t.untargetable || this.distTo(t) > 16)) { if (t.dead) this.lastTarget = t; this.target = null; }
      if (this.target) {
        this.lastTarget = t; this.nav.stop();
        this.lookAt(t.x, t.eyeY, t.z, 30, 30);
        this.swimGoal = [t.x, t.y + t.h / 2, t.z];
        if (this.inMeleeReach(t) && this.atkCool <= 0) {
          this.atkCool = 20; this.swingArm && this.swingArm(); Sound.play('axolotl_attack', this);
          if (this.doHurtTarget(t) && t.dead && AX_HUNT.has(t.type)) this.huntCool = 2400;
        }
      } else this.swimGoal = null;
    }
    // swimming: straight toward what it chases, along its path, or to a random spot in the water
    travel() {
      if (!this.inWater || this.vehicle) return super.travel();
      let g = this.swimGoal, sp = 0.12;
      if (this.playDead > 0) g = null;
      else if (!g && this.nav.path && this.nav.path.i < this.nav.path.nodes.length) { const nd = this.nav.path.nodes[this.nav.path.i]; g = [nd.x + 0.5, nd.y + 0.2, nd.z + 0.5]; sp = 0.1; }
      else if (!g) {
        if (!this.wander || rnd(100) === 0 || dist3(this, ...this.wander) < 1) { this.wander = null; for (let k = 0; k < 10; k++) { const x = Math.floor(this.x) + rnd(21) - 10, y = Math.floor(this.y) + rnd(9) - 4, z = Math.floor(this.z) + rnd(21) - 10; if (water(x, y, z) && water(x, y + 1, z)) { this.wander = [x + 0.5, y + 0.3, z + 0.5]; break; } } }
        g = this.wander; sp = 0.05;
      }
      if (g) {
        const dx = g[0] - this.x, dy = g[1] - this.y, dz = g[2] - this.z, d = Math.hypot(dx, dy, dz);
        if (d > 0.2) { const k = sp * (this.baby ? 0.8 : 1); this.vx += (dx / d * k - this.vx) * 0.15; this.vy += (dy / d * k - this.vy) * 0.15; this.vz += (dz / d * k - this.vz) * 0.15; }
        if (Math.hypot(this.vx, this.vz) > 0.005) { this.yaw = turnToward(this.yaw, Math.atan2(-this.vx, -this.vz), 0.25); this.pitch = -Math.atan2(this.vy, Math.hypot(this.vx, this.vz)) * 0.5; }
      } else this.vy -= 0.002;
      Phys.move(this, this.vx, this.vy, this.vz);
      this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9;
    }
    animState(s) { s.inWater = this.inWater; s.playDead = this.playDead > 0; }
    saveExtra(d) { d.variant = this.variant; d.air = this.air; d.huntCool = this.huntCool; d.fromBucket = !!this.fromBucket; }
    loadExtra(d) { if (d.variant) this.variant = d.variant; if (d.air !== undefined) this.air = d.air; this.huntCool = d.huntCool || 0; this.fromBucket = !!d.fromBucket; }
  }
  reg('axolotl', Axolotl);

  // ---------------------------------------------------------------- jukeboxes: how long each disc plays (jukebox_song data)
  const SONGS = { '13': [178, 'C418 - 13'], cat: [185, 'C418 - cat'], blocks: [345, 'C418 - blocks'], chirp: [185, 'C418 - chirp'], far: [174, 'C418 - far'], mall: [197, 'C418 - mall'], mellohi: [96, 'C418 - mellohi'], stal: [150, 'C418 - stal'], strad: [188, 'C418 - strad'], ward: [251, 'C418 - ward'], '11': [71, 'C418 - 11'], wait: [238, 'C418 - wait'], pigstep: [149, 'Lena Raine - Pigstep'], otherside: [195, 'Lena Raine - otherside'], '5': [178, 'Samuel Åberg - 5'], relic: [218, 'Aaron Cherof - Relic'], creator: [176, 'Lena Raine - Creator'], creator_music_box: [73, 'Lena Raine - Creator (Music Box)'], precipice: [299, 'Aaron Cherof - Precipice'] };
  const song = n => SONGS[String(n).replace('music_disc_', '')];
  const playing = new Map();
  const jkey = (x, y, z) => x + ',' + y + ',' + z;
  const playDisc0 = Sound.playDisc, stopDisc0 = Sound.stopDisc;
  Sound.playDisc = function (name, x, y, z) { playDisc0.call(this, name, x, y, z); const s = song(name); playing.set(jkey(x, y, z), { x, y, z, start: Game.gameTime, end: Game.gameTime + (s ? s[0] : 180) * 20 }); };
  Sound.stopDisc = function (x, y, z) { stopDisc0.call(this, x, y, z); playing.delete(jkey(x, y, z)); };
  function jukeboxTick() {
    for (const [k, j] of playing) {
      if (World.getBlock(j.x, j.y, j.z) !== BID.jukebox || Game.gameTime >= j.end) { playing.delete(k); continue; }
      if ((Game.gameTime - j.start) % 20 === 0) Particles.note(j.x, j.y, j.z, rnd(4) * 6);
    }
  }
  // a playing jukebox within r blocks
  function jukeboxNear(x, y, z, r) { for (const j of playing.values()) if (Math.hypot(j.x + 0.5 - x, j.y + 0.5 - y, j.z + 0.5 - z) <= r) return j; return null; }
  const Jukebox = { title: n => { const s = song(n); return s ? s[1] : ''; }, near: jukeboxNear, playing };

  // ---------------------------------------------------------------- allays
  const occludes = (x0, y0, z0, x1, y1, z1) => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, n = Math.ceil(Math.hypot(dx, dy, dz) * 4);
    for (let i = 1; i < n; i++) { const t = i / n, id = World.getBlock(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t), Math.floor(z0 + dz * t)); if (/_wool$/.test(BLOCKS[id].name)) return true; }
    return false;
  };
  // the game's allayConsidersItemEqual: the same item, and potions with the same contents
  const sameForAllay = (a, b) => a && b && a.id === b.id && (!a.tag || !b.tag || !a.tag.potion || !b.tag.potion || a.tag.potion === b.tag.potion);
  const FlyerBase = Object.getPrototypeOf(MobTypes.allay);
  class Allay extends FlyerBase {
    constructor(t, x, y, z) { super('allay', x, y, z); this.persistent = true; this.flySpeed = 0.1; this.items = null; this.liked = null; this.note = null; this.noteT = 0; this.pickCool = 0; this.dupCool = 0; this.dancing = false; this.goal = null; this.follow = false; }
    get noFallDamage() { return true; }
    // the player who gave the item can't hurt it
    hurt(n, src, a) { const by = a && (a.isPlayer ? a : a.owner && a.owner.isPlayer ? a.owner : null); if (by && by === this.liked) return false; return super.hurt(n, src, a); }
    onInteract(p, s) {
      const held = this.equip.main;
      if (this.dancing && nameOf(s) === 'amethyst_shard' && this.dupCool <= 0) {
        const twin = Mobs.spawnEntity('allay', this.x, this.y, this.z, { persistent: true });
        if (twin) twin.dupCool = 6000;
        this.dupCool = 6000; Particles.heart(this, 3); Sound.play('amethyst_block_chime', this); take(p, s);
        return true;
      }
      if (!held && s) { this.equip.main = Object.assign({}, s, { count: 1 }); take(p, s); this.liked = p; Sound.play('allay_item_given', this); return true; }
      if (held && !s) {
        this.equip.main = null; Sound.play('allay_item_taken', this);
        if (this.items) { Drops.spawnItem(this.x, this.y + 0.3, this.z, this.items); this.items = null; }
        this.liked = null; const left = p.inv.addItem(held); if (left) ItemUse.drop(p, left);
        return true;
      }
      return false;
    }
    // a note block played within 16 blocks (not through wool): deliver there for the next 30 seconds
    hearNote(x, y, z) {
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      if (Math.hypot(x - this.x, y - this.eyeY, z - this.z) > 16 || occludes(x, y, z, this.x, this.eyeY, this.z)) return;
      if (!this.note || (this.note[0] === bx && this.note[1] === by && this.note[2] === bz)) { this.note = [bx, by, bz]; this.noteT = 600; }
    }
    // where items go: the note block it heard, else its player
    deposit() {
      if (this.note) { const [x, y, z] = this.note; if (World.getBlock(x, y, z) === BID.note_block) return { x: x + 0.5, y: y + 0.5, z: z + 0.5, block: this.note }; this.note = null; }
      const p = this.liked; if (p && p === Game.player && !p.dead) return { x: p.x, y: p.y + 0.5, z: p.z, player: p };
      return null;
    }
    wants(s) { const held = this.equip.main; return held && sameForAllay(held, s) && (!this.items || (sameItem(this.items, s) && this.items.count < maxStack(this.items))); }
    steer(x, y, z, sp) {
      const dx = x - this.x, dy = y - this.y, dz = z - this.z, d = Math.hypot(dx, dy, dz); if (d < 0.25) return d;
      const k = this.flySpeed * sp;
      this.vx += (dx / d * k - this.vx) * 0.12; this.vy += (dy / d * k - this.vy) * 0.12; this.vz += (dz / d * k - this.vz) * 0.12;
      this.yaw = turnToward(this.yaw, Math.atan2(-dx, -dz), 0.3); this.lookYaw = this.yaw; this.forward = 0.3;
      return d;
    }
    throwItems(dep) {
      const s = this.items; this.items = null;
      const e = Drops.spawnItem(this.x, this.eyeY - 0.3, this.z, s);
      if (e) { const dx = dep.x - this.x, dy = dep.y + 1 - this.eyeY, dz = dep.z - this.z, l = Math.hypot(dx, dy, dz) || 1; e.vx = dx / l * 0.2; e.vy = dy / l * 0.2 + 0.1; e.vz = dz / l * 0.2; e.pickupDelay = 10; e.thrower = this; }
      this.pickCool = 60; Sound.play('allay_throw', this);
      if (dep.block && this.liked && this.liked.isPlayer) Advancements.fire('allay_drop_item_on_block', { pos: dep.block.slice(), item: s });
    }
    aiStep() {
      if (this.age % 10 === 0) this.heal(1);
      if (this.dupCool > 0) this.dupCool--;
      if (this.pickCool > 0) this.pickCool--;
      if (this.noteT > 0 && --this.noteT === 0) this.note = null;
      if (this.age % 20 === 0) this.dancing = !!jukeboxNear(this.x, this.y, this.z, 10);
      const dep = this.deposit();
      // GoAndGiveItemsToTarget: carry what it has to its target, throw from 3 blocks away
      if (this.items && dep) { if (this.steer(dep.x, dep.y + 1, dep.z, 2.25) < 3) this.throwItems(dep); return; }
      // GoToWantedItem: a matching item it can see within 32 blocks
      if (this.equip.main && this.pickCool <= 0) {
        if (!this.goal || this.goal.removed || this.age % 20 === 0) {
          this.goal = null; let bd = 32 * 32;
          for (const e of Entities.list) if (e.type === 'item' && !e.removed && e.stack && Math.abs(e.y - this.y) <= 16 && this.wants(e.stack)) { const d = e.dist2(this.x, this.y, this.z); if (d < bd && this.canSee(e)) { bd = d; this.goal = e; } }
        }
        const it = this.goal;
        if (it && !it.removed) {
          this.steer(it.x, it.y + 0.2, it.z, 1.75);
          if (it.pickupDelay <= 0 && Math.abs(it.x - this.x) < 1 + this.w && Math.abs(it.z - this.z) < 1 + this.w && Math.abs(it.y - this.y) < 1.6) {
            const s = it.stack, room = this.items ? maxStack(this.items) - this.items.count : maxStack(s), n = Math.min(room, s.count);
            if (n > 0) { if (this.items) this.items.count += n; else this.items = Object.assign({}, s, { count: n }); s.count -= n; if (s.count <= 0) it.removed = true; Sound.play('pop', this); }
            this.goal = null;
          }
          return;
        }
      }
      // StayCloseToTarget: more than 16 blocks from its target, fly back to within 4
      if (dep) { const d = Math.hypot(dep.x - this.x, dep.y - this.y, dep.z - this.z); if (d > 16) this.follow = true; if (this.follow) { if (this.steer(dep.x, dep.y + 1, dep.z, 2.25) < 4) this.follow = false; return; } }
      // drifting about
      if (!this.dest || rnd(80) === 0 || dist3(this, ...this.dest) < 0.6) {
        const x = this.x + rnd(17) - 8, y = this.y + rnd(7) - 3, z = this.z + rnd(17) - 8;
        if (!SOLID[World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))]) this.dest = [x, y, z];
      }
      if (this.dest) this.steer(this.dest[0], this.dest[1], this.dest[2], 1);
    }
    animState(s) { s.holding = !!this.equip.main; s.dancing = this.dancing; }
    dropLoot() { if (this.equip.main) Drops.spawnItem(this.x, this.y + 0.3, this.z, this.equip.main); if (this.items) Drops.spawnItem(this.x, this.y + 0.3, this.z, this.items); this.equip.main = null; this.items = null; }
    saveExtra(d) { d.items = this.items; d.liked = !!this.liked; d.note = this.note; d.noteT = this.noteT; d.dupCool = this.dupCool; }
    loadExtra(d) { this.items = d.items || null; if (d.liked) this.likedPending = true; this.note = d.note || null; this.noteT = d.noteT || 0; this.dupCool = d.dupCool || 0; }
    tick() { if (this.likedPending && Game.player) { this.liked = Game.player; this.likedPending = false; } super.tick(); }
  }
  reg('allay', Allay);
  // arms out holding its item; a spin and a sway while dancing
  const allayAnim = A.allay;
  A.allay = (m, s) => {
    allayAnim(m, s); const L = m.parts;
    if (s.holding) { L.right_arm.rx = L.left_arm.rx = -1.0471976; L.right_arm.ry = -0.2; L.left_arm.ry = 0.2; L.body.rx = 0; }
    if (s.dancing) { const k = s.t * 8 * PI / 180; L.head.rz = Math.sin(k) * 0.3; L.right_arm.rz = -0.6 + Math.sin(k * 2) * 0.3; L.left_arm.rz = 0.6 - Math.sin(k * 2) * 0.3; m.body.rotation.y = (s.t % 40) < 20 ? 0 : ((s.t % 40) - 20) / 20 * PI * 2; }
    else m.body.rotation.y = 0;
  };
  // allays hear note blocks
  const emit0 = GameEvents.emit;
  GameEvents.emit = function (ev, x, y, z, src, aff) {
    emit0.apply(this, arguments);
    if (ev === 'note_block_play') for (const e of Entities.list) if (e.type === 'allay' && !e.dead && e.hearNote) e.hearNote(x, y, z);
  };

  // ---------------------------------------------------------------- breezes
  const DANGER = new Set(['lava', 'fire', 'soul_fire', 'magma_block', 'campfire', 'soul_campfire', 'powder_snow', 'cactus', 'sweet_berry_bush', 'wither_rose']);
  class Breeze extends Monster {
    constructor(t, x, y, z) { super('breeze', x, y, z); this.xpSpec = '10'; this.state = 'idle'; this.stateT = 0; this.shootCool = 0; this.jumpCool = 0; this.jumpTo = null; this.slideT = 0; }
    registerGoals() {
      this.goals.add(7, new G.RandomStroll(this, 0.6)); this.goals.add(8, new G.LookAtPlayer(this, 8)); this.goals.add(9, new G.RandomLookAround(this));
      this.targets.add(1, new G.HurtByTarget(this)); this.targets.add(2, new G.NearestAttackableTarget(this, e => e.isPlayer, 24, true, 1));
    }
    get noFallDamage() { return true; }
    invulnerableTo(src, a) { return !!(a && a.type === 'breeze'); }
    // every projectile but a wind charge is turned back
    deflects(pr) { return pr.kind !== 'wind_charge'; }
    onDeflect() { Sound.play('breeze_deflect', this); }
    fire(t) {
      const w = Projectiles.spawn('wind_charge', this, this.x, this.y + this.h - 0.4, this.z, { breeze: true });
      const diff = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[Game.difficulty] || 2;
      if (w) Projectiles.shoot(w, t.x - this.x, t.y + t.h * (t.vehicle ? 0.8 : 0.3) - w.y, t.z - this.z, 0.7, Math.abs(5 - diff * 4));
      Sound.play('breeze_shoot', this);
    }
    // LongJump: a spot 4 to 8 blocks behind the target (where it looks), standing room, nothing harmful under it, in sight
    jumpSpot(t) {
      const ty = t.headYaw !== undefined ? t.headYaw : t.yaw || 0;
      for (let k = 0; k < 6; k++) {
        const a = ty + gauss() * PI / 4, r = 4 + Math.random() * 4;
        const x = Math.floor(t.x + Math.sin(a) * r), z = Math.floor(t.z + Math.cos(a) * r);
        for (let y = Math.floor(t.y) + 4; y >= Math.floor(t.y) - 8; y--) {
          const below = World.getBlock(x, y - 1, z);
          if (!SOLID[below] || SOLID[World.getBlock(x, y, z)] || SOLID[World.getBlock(x, y + 1, z)] || BLOCKS[World.getBlock(x, y, z)].fluid) continue;
          if (DANGER.has(BLOCKS[below].name)) break;
          const vis = h => !Phys.raycast(this.x, this.eyeY, this.z, ...(() => { const dx = x + 0.5 - this.x, dy = y + h - this.eyeY, dz = z + 0.5 - this.z, l = Math.hypot(dx, dy, dz) || 1; return [dx / l, dy / l, dz / l, l]; })(), id => OPAQUE[id]);
          if (vis(0.5) || vis(4.5)) return [x + 0.5, y, z + 0.5];
          break;
        }
      }
      return null;
    }
    // the launch velocity for a jump there: the first of the game's angles a speed up to 1.4 reaches it with
    launch() {
      const [tx, ty, tz] = this.jumpTo, hd = Math.hypot(tx - this.x, tz - this.z), dirx = (tx - this.x) / (hd || 1), dirz = (tz - this.z) / (hd || 1), dyT = ty - this.y;
      const reach = (v, ang) => { let h = 0, y = 0, vh = v * Math.cos(ang), vy = v * Math.sin(ang); for (let i = 0; i < 80; i++) { h += vh; y += vy; vy = (vy - 0.08) * 0.98; vh *= 0.91; if (vy < 0 && y <= dyT) return h; } return h; };
      let best = null;
      for (const deg of [40, 55, 60, 75, 80]) {
        const ang = deg * PI / 180; let lo = 0.1, hi = 1.4;
        if (reach(hi, ang) < hd) continue;
        for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (reach(mid, ang) < hd) lo = mid; else hi = mid; }
        best = [hi, ang]; break;
      }
      if (!best) best = [1.4, 45 * PI / 180];
      const [v, ang] = best;
      this.vx = dirx * v * Math.cos(ang); this.vz = dirz * v * Math.cos(ang); this.vy = v * Math.sin(ang);
      this.state = 'jump'; this.stateT = 0; this.onGround = false; Sound.play('breeze_jump', this);
    }
    aiStep() {
      super.aiStep();
      if (this.shootCool > 0) this.shootCool--; if (this.jumpCool > 0) this.jumpCool--;
      const t = this.target;
      if (this.state === 'jump') { this.nav.stop(); if (++this.stateT > 3 && (this.onGround || this.inWater || this.stateT > 100)) { this.state = 'idle'; this.jumpCool = this.age - this.lastHurtTime < 40 ? 2 : 10; Sound.play('breeze_land', this); } return; }
      if (this.state === 'charge') { this.nav.stop(); this.forward = 0; if (--this.stateT <= 0) this.launch(); return; }
      if (this.state === 'inhale') { this.nav.stop(); if (t) this.lookAt(t.x, t.eyeY, t.z, 30, 30); if (--this.stateT <= 0) { if (t && !t.dead) this.fire(t); this.state = 'recover'; this.stateT = 4; } return; }
      if (this.state === 'recover') { if (--this.stateT <= 0) { this.state = 'idle'; this.shootCool = 10; } return; }
      if (!t || t.dead) return;
      this.lookAt(t.x, t.eyeY, t.z, 30, 30);
      const d = this.distTo(t);
      // Shoot: 2 to 16 blocks away, in sight
      if (this.shootCool <= 0 && d > 2 && d <= 16 && this.canSee(t)) { this.state = 'inhale'; this.stateT = 15; this.nav.stop(); Sound.play('breeze_inhale', this); return; }
      // LongJump: from the ground, more than 4 blocks away
      if (this.jumpCool <= 0 && (this.onGround || this.inWater) && d > 4 && d <= 24) { const j = this.jumpSpot(t); if (j) { this.jumpTo = j; this.state = 'charge'; this.stateT = 10; this.nav.stop(); Sound.play('breeze_charge', this); return; } this.jumpCool = 20; }
      // Slide: keep between 4 and 8 blocks of the target
      if (--this.slideT <= 0 && this.onGround) {
        this.slideT = 20 + rnd(20);
        const p = d < 4 ? randomPos(this, 6, 2, null, [t.x, t.y, t.z]) : d > 8 ? randomPos(this, 6, 2, [t.x, t.y, t.z]) : null;
        if (p) { this.nav.moveTo(p[0], p[1], p[2], 0.6); Sound.play('breeze_slide', this); }
      }
    }
    animState(s) { s.breezeState = this.state; }
  }
  reg('breeze', Breeze);
  const breezeAnim = A.breeze;
  A.breeze = (m, s) => {
    breezeAnim(m, s); const L = m.parts;
    if (s.breezeState === 'inhale' || s.breezeState === 'charge') { L.rods.ry = s.t * 0.9; L.head.y -= 1; }
    if (s.breezeState === 'jump') { L.rods.ry = s.t * 1.2; L.wind_body.sx = L.wind_body.sz = 0.7; }
  };

  // ---------------------------------------------------------------- camels
  class Camel extends Animal {
    constructor(t, x, y, z) { super('camel', x, y, z); this.pose = 'stand'; this.poseT = 400; this.dashCool = 0; this.dashing = false; this.stepHeight = 1.5; this.jumpStrength = 0.42; this.h0 = this.h; }
    get food() { return ['cactus']; }
    registerGoals() {
      const g = this.goals;
      g.add(0, new G.Float(this)); g.add(1, new G.Panic(this, 4)); g.add(2, new G.Breed(this, 1)); g.add(3, new G.Tempt(this, 2.5, ['cactus']));
      g.add(4, new G.FollowParent(this, 2.5)); g.add(5, new G.RandomStroll(this, 2)); g.add(6, new G.LookAtPlayer(this, 6)); g.add(7, new G.RandomLookAround(this));
    }
    get sitting() { return this.pose === 'sit'; }
    // sitting down takes 40 ticks, standing up 52; it won't move while sitting or getting up
    inTransition() { return this.poseT < (this.sitting ? 40 : 52); }
    refuseToMove() { return this.sitting || this.inTransition(); }
    sitDown() { if (this.sitting) return; this.pose = 'sit'; this.poseT = 0; this.h = (this.h0 || 2.375) - 1.43; Sound.play('camel_sit', this); this.nav.stop(); }
    standUp() { if (!this.sitting) return; this.pose = 'stand'; this.poseT = 0; this.h = this.h0 || 2.375; Sound.play('camel_stand', this); }
    // the rider pushed to move: a sitting camel gets up first
    riderMoves(input) { if (input && this.sitting && !this.inTransition()) this.standUp(); return this.refuseToMove(); }
    dash(k) {
      if (!this.onGround || this.dashCool > 0 || this.refuseToMove()) return;
      const sp = 22.2222 * k * (this.speed || 0.09);
      this.vx += -Math.sin(this.yaw) * sp; this.vz += -Math.cos(this.yaw) * sp; this.vy = 1.4285 * k * this.jumpStrength;
      this.dashCool = 55; this.dashing = true; this.dashAt = this.age; Sound.play('camel_dash', this);
    }
    // two riders: the driver half a block forward, a passenger 0.7 back (animals sit 0.2 further forward)
    seatFor(e) {
      const i = Math.max(0, this.passengers.indexOf(e)); let f = 0.5;
      if (this.passengers.length > 1 && i > 0) f = -0.7;
      if (e instanceof Animal) f += 0.2;
      const k = this.baby ? 0.45 : 1, sk = this.sitting ? Math.min(1, this.poseT / 40) : 1 - Math.min(1, this.poseT / 52);
      return [this.x - Math.sin(this.yaw) * f * k, this.y + (1.875 - 1.43 * sk) * k, this.z - Math.cos(this.yaw) * f * k];
    }
    hurt(n, src, a) { if (this.sitting) { this.pose = 'stand'; this.poseT = 52; this.h = this.h0 || 2.375; } return super.hurt(n, src, a); }
    onInteract(p, s) {
      const n = nameOf(s);
      if (n === 'saddle' && !this.saddled && !this.baby) { this.saddled = true; take(p, s); Sound.play('saddle', this); return true; }
      if (n === 'cactus' && this.health < this.maxHealth) { this.heal(2); take(p, s); Sound.play('camel_eat', this); return true; }
      if (!this.baby && this.passengers.length < 2 && !p.vehicle) { Vehicles.mount(p, this); return true; }
      return false;
    }
    aiStep() {
      this.poseT++;
      if (this.dashCool > 0 && --this.dashCool === 0 && this.passengers.length) Sound.play('camel_dash_ready', this);
      if (this.dashing && this.onGround && this.age - this.dashAt > 5) this.dashing = false;
      // RandomSitting: after 20 seconds in a pose, now and then sit down or get up
      if (!this.passengers.length && this.onGround && !this.inWater && !this.leashed && this.poseT >= 400 && !(this.lastHurtBy && this.age - this.lastHurtTime < 100) && rnd(600) === 0) { if (this.sitting) this.standUp(); else this.sitDown(); }
      if (this.refuseToMove()) { this.nav.stop(); this.forward = this.strafe = 0; }
    }
    animState(s) { s.sitK = this.sitting ? Math.min(1, this.poseT / 40) : 1 - Math.min(1, this.poseT / 52); s.dashing = this.dashing; }
    saveExtra(d) { d.saddled = !!this.saddled; d.pose = this.pose; d.dashCool = this.dashCool; }
    loadExtra(d) { this.saddled = !!d.saddled; if (d.pose === 'sit') { this.pose = 'sit'; this.poseT = 400; this.h = (this.h0 || 2.375) - 1.43; } this.dashCool = d.dashCool || 0; }
  }
  reg('camel', Camel);
  A.camel = (m, s) => {
    A.quadruped(m, s); const L = m.parts, k = s.sitK || 0;
    if (k > 0) { L.body.y += 22 * k; for (const n of ['right_hind_leg', 'left_hind_leg', 'right_front_leg', 'left_front_leg']) { L[n].rx = -PI / 2 * k; L[n].y += 20 * k; L[n].z += (n.includes('front') ? -6 : 6) * k; } }
    if (s.dashing) { L.right_front_leg.rx = L.left_front_leg.rx = -0.9; L.right_hind_leg.rx = L.left_hind_leg.rx = 0.9; }
  };

  // ---------------------------------------------------------------- sniffers
  const DIGGABLE = new Set(['dirt', 'grass_block', 'podzol', 'coarse_dirt', 'rooted_dirt', 'moss_block', 'mud', 'muddy_mangrove_roots']);
  class Sniffer extends Animal {
    constructor(t, x, y, z) { super('sniffer', x, y, z); this.state = 'idle'; this.stateT = 0; this.sniffCool = 0; this.explored = []; this.digAt = null; }
    get food() { return ['torchflower_seeds']; }
    // the block in front of its nose (2.25 blocks ahead) and the block under it
    head() { return [Math.floor(this.x - Math.sin(this.yaw) * 2.25), Math.floor(this.y + 0.2), Math.floor(this.z - Math.cos(this.yaw) * 2.25)]; }
    canDigAt(x, y, z) {
      if (!DIGGABLE.has(BLOCKS[World.getBlock(x, y - 1, z)].name) || World.getBlock(x, y, z) !== 0) return false;
      return !this.explored.some(p => p[0] === x && p[1] === y - 1 && p[2] === z);
    }
    canDig() { return !this.baby && !this.inWater && this.onGround && !this.vehicle && !this.passengers.length && !(this.lastHurtBy && this.age - this.lastHurtTime < 100); }
    tempted() { const p = Game.player; if (!p || this.distTo(p) > 10) return false; const h = p.inv.held, o = p.inv.offhand; return nameOf(h) === 'torchflower_seeds' || nameOf(o) === 'torchflower_seeds'; }
    setState(s, t) { this.state = s; this.stateT = t || 0; }
    pickSpot() {
      for (let k = 0; k < 20; k++) {
        const a = this.yaw + (Math.random() - 0.5) * PI, r = 2.5 + Math.random() * 4;
        const x = Math.floor(this.x - Math.sin(a) * r), z = Math.floor(this.z - Math.cos(a) * r);
        for (let y = Math.floor(this.y) + 2; y >= Math.floor(this.y) - 3; y--) if (this.canDigAt(x, y, z)) return [x, y, z];
      }
      return null;
    }
    aiStep() {
      if (this.sniffCool > 0) this.sniffCool--;
      // hurt, tempted, ridden or swimming: it stops (walking over bumps doesn't count)
      const busy = this.state !== 'idle';
      if (busy && (this.baby || this.inWater || this.vehicle || this.passengers.length || (this.lastHurtBy && this.age - this.lastHurtTime < 100) || this.tempted())) { this.setState('idle'); this.digAt = null; }
      switch (this.state) {
        case 'idle':
          if (this.sniffCool <= 0 && this.canDig() && !this.tempted() && !this.inLove && rnd(200) === 0) { this.setState('sniffing', 40 + rnd(61)); Sound.play('sniffer_sniffing', this); }
          else if (rnd(1200) === 0 && this.onGround) { this.setState('scenting', 40 + rnd(61)); Sound.play('sniffer_scenting', this); }
          break;
        case 'scenting': this.nav.stop(); if (--this.stateT <= 0) this.setState('idle'); break;
        case 'sniffing':
          this.nav.stop();
          if (--this.stateT <= 0) { this.digAt = this.pickSpot(); if (this.digAt) { this.setState('searching', 1200); Sound.play('sniffer_searching', this); } else this.setState('idle'); }
          break;
        case 'searching': {
          const [x, y, z] = this.digAt, h = this.head();
          // close and facing it: its nose is over the spot
          const fx = x + 0.5 - this.x, fz = z + 0.5 - this.z, fd = Math.hypot(fx, fz), facing = Math.abs(angleDiff(this.yaw, Math.atan2(-fx, -fz))) < 0.35;
          if ((h[0] === x && h[2] === z && Math.abs(h[1] - y) <= 1) || (fd < 3.2 && facing && this.onGround)) { this.nav.stop(); this.lookAt(x + 0.5, y, z + 0.5); this.setState('digging', 160 + rnd(21)); break; }
          // walk so the nose ends up over the spot
          if (this.age % 20 === 0 || this.nav.done()) { const a = Math.atan2(x + 0.5 - this.x, z + 0.5 - this.z); this.nav.moveTo(x + 0.5 - Math.sin(a) * 2, y, z + 0.5 - Math.cos(a) * 2, 1.25); this.lookAt(x + 0.5, y, z + 0.5); }
          const dx = x + 0.5 - this.x, dz = z + 0.5 - this.z; if (Math.hypot(dx, dz) < 3) this.yaw = turnToward(this.yaw, Math.atan2(-dx, -dz), 0.2);
          if (--this.stateT <= 0) this.setState('idle');
          break;
        }
        case 'digging': {
          this.nav.stop(); this.forward = 0;
          const [x, y, z] = this.digAt;
          if (this.stateT % 4 === 0) Particles.blockBits && Particles.blockBits(x + 0.5, y + 0.1, z + 0.5, (Math.random() - 0.5) * 0.2, 0.2, (Math.random() - 0.5) * 0.2, World.getBlock(x, y - 1, z), 0);
          if (this.stateT % 30 === 0) Sound.play('sniffer_digging', this);
          if (--this.stateT <= 0) {
            if (this.canDigAt(x, y, z)) {
              for (const s of LootTables.roll('gameplay/sniffer_digging', { entity: this })) Drops.spawnItem(x + 0.5, y + 0.2, z + 0.5, s);
              Sound.play('sniffer_drop_seed', this);
              this.explored.push([x, y - 1, z]); if (this.explored.length > 20) this.explored.shift();
            }
            Sound.play('sniffer_digging_stop', this); this.setState('rising', 40);
          }
          break;
        }
        case 'rising': this.nav.stop(); if (--this.stateT <= 0) { this.setState('happy', 40); Sound.play('sniffer_happy', this); this.sniffCool = 9600; } break;
        case 'happy': if (--this.stateT <= 0) this.setState('idle'); break;
      }
    }
    // breeding lays an egg instead of a baby
    breedWith(q) {
      this.inLove = 0; q.inLove = 0; this.ageTicks = 6000; q.ageTicks = 6000;
      Drops.spawnItem(this.x, this.y, this.z, stack('sniffer_egg')); Sound.play('sniffer_egg_plop', this);
      Drops.spawnXp(this.x, this.y + 0.5, this.z, 1 + rnd(7)); Stats.add('bred', this.type);
      Advancements.fire('bred_animals', { child: null, parent: this, partner: q });
    }
    animState(s) { s.snifferState = this.state; s.stateT = this.stateT; }
    saveExtra(d) { d.explored = this.explored; d.sniffCool = this.sniffCool; }
    loadExtra(d) { this.explored = d.explored || []; this.sniffCool = d.sniffCool || 0; }
  }
  reg('sniffer', Sniffer);
  const snifferAnim = A.sniffer;
  A.sniffer = A.snifflet = (m, s) => {
    snifferAnim(m, s); const L = m.parts, st = s.snifferState, t = s.t;
    if (st === 'digging') { L.head.rx = 0.7 + Math.sin(t * 0.5) * 0.1; L.body.rx = 0.12; }
    else if (st === 'sniffing' || st === 'searching') { L.head.rx = 0.25 + Math.sin(t * 0.8) * 0.06; L.nose && (L.nose.ry = Math.sin(t * 1.2) * 0.15); }
    else if (st === 'scenting') L.head.rx = -0.4 + Math.sin(t * 0.6) * 0.05;
    else if (st === 'rising') L.head.rx = 0.35;
    else if (st === 'happy') L.head.rz = Math.sin(t * 0.4) * 0.15;
  };

  // ---------------------------------------------------------------- armadillos
  class ArmadilloPanic extends G.Panic { canUse() { const m = this.m; return !m.scared && ((m.fireTicks > 0 && !m.fireImmune) || (m.envHurt && m.age - m.envHurt < 100)); } }
  class Armadillo extends Animal {
    constructor(t, x, y, z) { super('armadillo', x, y, z); this.state = 'idle'; this.stateT = 0; this.danger = 0; this.scuteT = 6000 + rnd(6000); this.peek = 0; }
    get food() { return ['spider_eye']; }
    registerGoals() {
      const g = this.goals;
      g.add(0, new G.Float(this)); g.add(1, new ArmadilloPanic(this, 2)); g.add(2, new G.Breed(this, 1)); g.add(3, new G.Tempt(this, 1.25, ['spider_eye']));
      g.add(4, new G.FollowParent(this, 1.25)); g.add(5, new G.RandomStroll(this, 1)); g.add(6, new G.LookAtPlayer(this, 6)); g.add(7, new G.RandomLookAround(this));
    }
    get scared() { return this.state !== 'idle'; }
    isFood(s) { return !this.scared && super.isFood(s); }
    // the game's isScaredBy: within 7 x 2 x 7 blocks, an undead mob, whoever hurt it, or a sprinting or riding player
    threat(e) {
      if (e === this || e.dead || e.removed || !near(this, e, 7) || Math.abs(e.y - this.y) > 2 + e.h) return false;
      if (e.undead) return true;
      if (this.lastHurtBy === e && this.age - this.lastHurtTime < 600) return true;
      return !!(e.isPlayer && !e.spectator && (e.sprinting || e.vehicle));
    }
    canStayRolledUp() { return !this.inWater && !this.inLava && !this.leashed && !this.vehicle && !this.passengers.length && !(this.envHurt && this.age - this.envHurt < 100); }
    rollUp() { if (this.scared && this.state !== 'unrolling') return; this.state = 'rolling'; this.stateT = 0; this.nav.stop(); this.inLove = 0; Sound.play('armadillo_roll', this); }
    hurt(n, src, a) {
      if (this.scared) n = Math.max(0, (n - 1) / 2);
      const ok = super.hurt(n, src, a);
      if (ok && !this.dead) { if (a) { this.danger = 80; if (this.canStayRolledUp()) this.rollUp(); } else { this.envHurt = this.age; if (this.scared) this.state = 'idle'; } }
      return ok;
    }
    aiStep() {
      if (!this.baby && --this.scuteT <= 0) { Drops.spawnItem(this.x, this.y + 0.2, this.z, stack('armadillo_scute')); Sound.play('armadillo_scute_drop', this); this.scuteT = 6000 + rnd(6000); }
      if (this.age % 5 === 0) { const p = Game.player; if ((p && this.threat(p)) || Entities.list.some(e => e.living && this.threat(e))) this.danger = 80; }
      if (this.danger > 0) this.danger--;
      this.stateT++;
      switch (this.state) {
        case 'idle': if (this.danger > 0 && this.canStayRolledUp()) this.rollUp(); break;
        case 'rolling': if (this.stateT >= 10) { this.state = 'scared'; this.stateT = 0; } break;
        case 'scared':
          if (!this.canStayRolledUp()) { this.state = 'idle'; break; }
          if (this.danger <= 0) { this.state = 'unrolling'; this.stateT = 0; Sound.play('armadillo_unroll_start', this); }
          else if (this.peek > 0) this.peek--;
          else if (rnd(100) === 0) { this.peek = 20; Sound.play('armadillo_peek', this); }
          break;
        case 'unrolling':
          if (this.danger > 0 && this.canStayRolledUp()) { this.state = 'scared'; this.stateT = 0; Sound.play('armadillo_roll', this); }
          else if (this.stateT >= 30) { this.state = 'idle'; Sound.play('armadillo_unroll_finish', this); }
          break;
      }
      if (this.scared) { this.nav.stop(); this.forward = this.strafe = 0; }
    }
    onInteract(p, s) {
      if (nameOf(s) === 'brush' && !this.baby) { Drops.spawnItem(this.x, this.y + 0.5, this.z, stack('armadillo_scute')); Sound.play('armadillo_brush', this); p.inv.damageHeld(16, p); p.swingArm && p.swingArm(); return true; }
      return false;
    }
    animState(s) { s.rolled = this.state === 'rolling' || this.state === 'scared' || (this.state === 'unrolling' && this.stateT < 20); s.peek = this.peek > 0; }
    saveExtra(d) { d.scuteT = this.scuteT; d.state = this.state === 'idle' ? 'idle' : 'scared'; }
    loadExtra(d) { if (d.scuteT) this.scuteT = d.scuteT; if (d.state === 'scared') { this.state = 'scared'; this.danger = 80; } }
  }
  reg('armadillo', Armadillo);

  // ---------------------------------------------------------------- tooltips: a tropical fish bucket names its fish, a disc its song
  function tooltip(s) {
    const n = nameOf(s);
    if (n === 'tropical_fish_bucket' && s.tag && s.tag.mob && s.tag.mob.variant) return fishName(s.tag.mob.variant).map(l => `<div style="color:#aaaaaa"><i>${escapeHTML(l)}</i></div>`).join('');
    if (n.startsWith('music_disc_') && song(n)) return `<div style="color:#aaaaaa">${escapeHTML(song(n)[1])}</div>`;
    return '';
  }
  function tick() { jukeboxTick(); }
  function clear() { playing.clear(); }
  return { tick, clear, tooltip, Jukebox, fishName, COMMON, PATTERNS, DYES, bucketUp };
})();
