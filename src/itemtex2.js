'use strict';
/* Item sprites for the 1.20 and 1.21 additions: armour trim templates, pottery sherds, banner patterns, new
   music discs, trial keys, the ominous bottle, the bundle, wolf armour, candles, hanging signs, copper doors,
   eggs and the remaining spawn eggs. */
(() => {
  const { def, tpl, blob, outline, rect, book, bottle } = ItemTex;
  const { H, mul, mixc } = Tex;

  // ------------------------------------------------------------------ smithing templates: a tablet with the trim's motif
  const TRIM = {
    sentry: [0x6f6f6f, 0x9a9a9a], dune: [0xc8b07a, 0xe8d4a0], coast: [0x5a7a5a, 0x8ab08a], wild: [0x4a6a2a, 0x7aa04a], ward: [0x2a3040, 0x3a8a9a],
    eye: [0xd8d4a0, 0x3a7a5a], vex: [0x8a8a9a, 0xc8d0e0], tide: [0x3a8a7a, 0x7ad0c0], snout: [0x2a2228, 0xd8a83a], rib: [0x6a2a2a, 0xe8e0d0],
    spire: [0x8a5a8a, 0xc890c8], wayfinder: [0x9a5a3a, 0xd89a6a], shaper: [0x9a5a3a, 0xd8b06a], silence: [0x1a2028, 0x2ae0e8], raiser: [0x9a5a3a, 0xc87a4a],
    host: [0x9a5a3a, 0xe8c8a0], flow: [0x6a5a9a, 0xb8a8f0], bolt: [0x9a5038, 0xe08a68],
  };
  const MOTIF = {
    sentry: ['.##.', '#..#', '#..#', '.##.'], dune: ['#..#', '.##.', '.##.', '#..#'], coast: ['####', '#...', '#...', '####'], wild: ['.#.#', '##.#', '.###', '..#.'],
    ward: ['#..#', '####', '#..#', '#..#'], eye: ['.##.', '####', '#..#', '.##.'], vex: ['#..#', '.##.', '#..#', '.##.'], tide: ['#.#.', '.#.#', '#.#.', '.#.#'],
    snout: ['####', '#..#', '####', '.##.'], rib: ['####', '....', '####', '....'], spire: ['.##.', '.##.', '####', '####'], wayfinder: ['#...', '.#..', '..#.', '...#'],
    shaper: ['####', '.##.', '.##.', '####'], silence: ['.##.', '#..#', '.##.', '#..#'], raiser: ['.##.', '####', '.##.', '.##.'], host: ['#..#', '#..#', '####', '#..#'],
    flow: ['.##.', '#...', '.##.', '...#'], bolt: ['..#.', '.##.', '.##.', '.#..'],
  };
  for (const t in TRIM) def(t + '_armor_trim_smithing_template', c => {
    const [base, motif] = TRIM[t];
    tpl(c, ['................', '...#########....', '..#aaaaaaaaa#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#abbbbbbba#...', '..#aaaaaaaaa#...', '...#########....', '................', '................', '................'],
      { '#': mul(H(base), 0.5), a: mul(H(base), 1.25), b: H(base) });
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (MOTIF[t][y][x] === '#') { c.px(5 + x * 1.5, 5 + y * 1.5, H(motif)); c.px(6 + x * 1.5, 5 + y * 1.5, H(motif)); }
  });

  // ------------------------------------------------------------------ pottery sherds: a terracotta shard with its picture
  const SHERD = {
    angler: ['....', '..#.', '.##.', '#..#'], archer: ['#...', '.##.', '.##.', '...#'], arms_up: ['#..#', '.##.', '.##.', '.#.#'], blade: ['...#', '..#.', '.#..', '#...'],
    brewer: ['.##.', '.##.', '####', '.##.'], burn: ['.#..', '.##.', '###.', '####'], danger: ['.##.', '####', '.##.', '#..#'], explorer: ['####', '#.##', '##.#', '####'],
    flow: ['.##.', '#...', '.##.', '...#'], friend: ['.##.', '####', '####', '.##.'], guster: ['.##.', '####', '.#..', '..#.'], heart: ['#.#.', '####', '.##.', '..#.'],
    heartbreak: ['#.#.', '#.##', '.#..', '..#.'], howl: ['#..#', '.##.', '####', '.##.'], miner: ['###.', '..#.', '.#..', '#...'], mourner: ['.##.', '####', '#..#', '#..#'],
    plenty: ['####', '#..#', '#..#', '####'], prize: ['..#.', '.###', '..#.', '....'], scrape: ['####', '.#..', '.#..', '.#..'], sheaf: ['#.#.', '.#.#', '#.#.', '.#.#'],
    shelter: ['.#..', '###.', '#.#.', '#.#.'], skull: ['.##.', '#..#', '.##.', '.##.'], snort: ['####', '#..#', '#.##', '####'],
  };
  for (const n in SHERD) def(n + '_pottery_sherd', c => {
    tpl(c, ['................', '................', '.....#####......', '....#bbbbb##....', '...#bbbbbbbb#...', '..#abbbbbbbbb#..', '..#abbbbbbbbb#..', '..#abbbbbbbbb#..', '..#abbbbbbbb#...', '...#abbbbbb#....', '....#aaaaa#.....', '.....#####......', '................', '................', '................', '................'],
      { '#': 0x4a2418, a: 0x8a4a32, b: 0xa9623f });
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (SHERD[n][y][x] === '#') c.px(5 + x * 1.5, 4.5 + y * 1.5, H(0x5a2a1a));
  });

  // ------------------------------------------------------------------ banner patterns: a sheet of patterned paper
  const BPAT = { flower: ['.#.', '###', '.#.'], creeper: ['#.#', '.#.', '#.#'], skull: ['###', '#.#', '.#.'], mojang: ['##.', '#.#', '.##'], globe: ['.#.', '###', '.#.'], piglin: ['###', '#.#', '###'], flow: ['.##', '#..', '##.'], guster: ['##.', '.##', '..#'] };
  for (const b in BPAT) def(b + '_banner_pattern', c => {
    rect(c, 3, 2, 12, 13, 0xe8dcc0); rect(c, 3, 2, 12, 2, 0xfff6e0); rect(c, 3, 13, 12, 13, 0xb8a888);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (BPAT[b][y][x] === '#') c.rect(5 + x * 2, 5 + y * 2, 6 + x * 2, 6 + y * 2, H(b === 'mojang' || b === 'globe' ? 0x3a5a9a : 0x5a4a3a));
  });

  // ------------------------------------------------------------------ the newer music discs
  const DISC = { '5': 0x3a6a7a, relic: 0x2ab8b8, creator: 0xd8a03a, creator_music_box: 0xb8c8d8, precipice: 0xd8743a };
  for (const d in DISC) def('music_disc_' + d, c => { blob(c, 7.5, 7.5, 6.5, [0x1a1a1a, 0x2a2a2a, 0x3a3a3a, 0x0a0a0a]); blob(c, 7.5, 7.5, 2.5, [DISC[d], DISC[d], DISC[d]]); c.px(7, 7, H(0x0a0a0a)); });

  // ------------------------------------------------------------------ trial chambers
  const key = (c, pal) => tpl(c, ['................', '................', '.........####...', '........#cbbb#..', '........#b##b#..', '........#b##b#..', '.......#bbbbb#..', '......#ba####...', '.....#ba#.......', '....#ba#........', '...#ba#.........', '..#bab#.........', '..#b#b#.........', '...#.#..........', '................', '................'], { '#': pal[0], a: pal[1], b: pal[2], c: pal[3] });
  def('trial_key', c => key(c, [0x5a3a10, 0xb4824a, 0xe0a85a, 0xfff0a0]));
  def('ominous_trial_key', c => key(c, [0x0a2a2a, 0x1a6a6a, 0x2ab0a8, 0xa0fff0]));
  def('ominous_bottle', c => {
    tpl(c, ['................', '......####......', '......#cc#......', '......#..#......', '.....#....#.....', '....#bbbbbb#....', '...#bbbbbbbb#...', '...#bbaabbbb#...', '...#bbaabbbb#...', '...#bbbbbbbb#...', '...#bbbbbbbb#...', '....#bbbbbb#....', '.....######.....', '................', '................', '................'],
      { '#': 0x1a1a24, b: 0x2a5a4a, a: 0xd8e0d0, c: 0x6a4a2a });
  });
  def('bundle', c => tpl(c, ['................', '.......##.......', '......#ss#......', '.......##.......', '.....#aaaa#.....', '....#aaaaaa#....', '...#abbbbbba#...', '...#bbbbbbbb#...', '...#bbbbbbbb#...', '...#bbbbbbbb#...', '...#abbbbbba#...', '....#aaaaaa#....', '.....######.....', '................', '................', '................'],
    { '#': 0x3a1f0f, a: 0x8b4a24, b: 0xa86d3d, s: 0xd8d0b8 }));
  def('wolf_armor', c => tpl(c, ['................', '................', '...##########...', '..#cbbbbbbbbb#..', '..#bbaabbaabb#..', '..#bbbbbbbbbb#..', '...#bbbbbbbb#...', '....#bb##bb#....', '....#b#..#b#....', '....###..###....', '................', '................', '................', '................', '................', '................'],
    { '#': 0x4a2a1a, a: 0x8a5a4a, b: 0xb07a6a, c: 0xd8a090 }));
  def('knowledge_book', c => { book(c, 0x8a2a2a); rect(c, 6, 5, 9, 9, 0x3a9a3a); rect(c, 7, 6, 8, 8, 0x8ae08a); });
  def('debug_stick', c => { for (let i = 0; i < 11; i++) { c.px(3 + i, 13 - i, H(0x6b5128)); c.px(4 + i, 13 - i, H(0x8a6a3a)); } c.px(3, 14, H(0x4a3518)); });
  def('command_block_minecart', c => {
    tpl(c, ['................', '................', '.....######.....', '.....#cccc#.....', '..###cddcc###...', '..#bb#cccc#b#..', '..#a########b#..', '..#a#......#b#..', '..#aaaaaaaaab#..', '..############..', '...#o#....#o#...', '...###....###...', '................', '................', '................', '................'],
      { '#': 0x2a2a2a, a: 0x7a7a7a, b: 0xa8a8a8, o: 0x3a3a3a, c: 0xc89a6c, d: 0x2a2a2a });
  });
  def('pitcher_pod', c => { tpl(c, ['................', '................', '.......##.......', '......#ab#......', '.....#abbb#.....', '.....#abbb#.....', '....#aabbbb#....', '....#abbbbb#....', '....#abbbbb#....', '.....#abbb#.....', '......#ab#......', '.......##.......', '................', '................', '................', '................'], { '#': 0x1a4a3a, a: 0x3a8a6a, b: 0x6ac0a0 }); });
  def('nether_wart', c => tpl(c, ['................', '................', '......##........', '.....#bb#.##....', '.....#bab#bb#...', '....#bbaabbab#..', '...#bbaabbaab#..', '...#baabbaabb#..', '...#bbbbaabb#...', '....#bbbbbb#....', '.....######.....', '.......#........', '.......#........', '................', '................', '................'], { '#': 0x4a0a0a, a: 0x8a1a1a, b: 0xb02a2a }));

  // ------------------------------------------------------------------ blocks shown flat in the inventory
  for (const k of ['candle'].concat(Object.keys(Tex.CLR).map(n => n + '_candle'))) def(k, c => {
    const col = k === 'candle' ? 0xe0cfa0 : Tex.CLR[k.replace('_candle', '')];
    rect(c, 6, 6, 9, 14, col); c.rect(8, 6, 9, 14, mul(H(col), 0.82)); c.rect(6, 6, 9, 6, mul(H(col), 1.12));
    c.px(7, 5, H(0x3a3530)); c.px(7, 4, H(0x2a2520)); outline(c, mul(H(col), 0.5));
  });
  for (const w of WOODS.concat(STEMS, ['bamboo'])) def(w + '_hanging_sign', c => {
    const t = w === 'bamboo' ? 'stripped_bamboo_block' : STEMS.includes(w) ? 'stripped_' + w + '_stem' : 'stripped_' + w + '_log';
    const px = Tex.pixels(t);
    for (let y = 6; y < 14; y++) for (let x = 1; x < 15; x++) { const o = (y * 16 + x) * 4; c.px(x, y, [px[o], px[o + 1], px[o + 2]]); }
    for (let y = 1; y < 6; y++) { c.px(3, y, H(y % 2 ? 0x3a3f4a : 0x252830)); c.px(12, y, H(y % 2 ? 0x3a3f4a : 0x252830)); }
    rect(c, 1, 0, 14, 0, 0x4a4f5a); outline(c, 0x2a2018);
  });
  for (const o of ['', 'exposed_', 'weathered_', 'oxidized_']) for (const w of ['', 'waxed_']) def(w + o + 'copper_door', c => {
    const top = Tex.pixels(o + 'copper_door_top'), bot = Tex.pixels(o + 'copper_door_bottom');
    for (let y = 0; y < 16; y++) for (let x = 4; x < 12; x++) { const src = y < 8 ? top : bot, sy = (y % 8) * 2, sx = (x - 4) * 2, k = (sy * 16 + sx) * 4; c.px(x, y, [src[k], src[k + 1], src[k + 2]], src[k + 3]); }
  });
  def('turtle_egg', c => { blob(c, 7.5, 8.5, 4.5, [0xc8c4a8, 0xe8e4c8, 0xffffff, 0x6a6450]); for (const [x, y] of [[6, 6], [9, 8], [7, 10], [5, 9]]) c.px(x, y, H(0x5a9a5a)); });
  def('sniffer_egg', c => { blob(c, 7.5, 8, 6, [0x8a2a1a, 0xb54a32, 0xd86a4a, 0x4a1a10]); for (let y = 3; y < 14; y += 3) for (let x = 3; x < 13; x++) if (c.get(x, y)[3] && (x + y) % 4 < 2) c.px(x, y, H(0x3a8a6a)); });
  def('frogspawn', c => { const d = Tex.pixels('frogspawn'); c.data.set(d); });
  def('sculk_vein', c => { const d = Tex.pixels('sculk_vein'); c.data.set(d); });
  def('pitcher_plant', c => { const t = Tex.pixels('pitcher_plant_top'), b = Tex.pixels('pitcher_plant_bottom'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const src = y < 8 ? t : b, sy = y < 8 ? y * 2 : (y - 8) * 2, k = (sy * 16 + x) * 4; if (src[k + 3]) c.px(x, y, [src[k], src[k + 1], src[k + 2]]); } });
  def('torchflower', c => { const d = Tex.pixels('torchflower'); c.data.set(d); });
  for (const k of ['tube', 'brain', 'bubble', 'fire', 'horn']) { def('dead_' + k + '_coral', c => c.data.set(Tex.pixels('dead_' + k + '_coral'))); def('dead_' + k + '_coral_fan', c => c.data.set(Tex.pixels('dead_' + k + '_coral_fan'))); }
  def('barrier', c => c.data.set(Tex.pixels('barrier'))); def('light', c => c.data.set(Tex.pixels('light'))); def('structure_void', c => c.data.set(Tex.pixels('structure_void')));

  // ------------------------------------------------------------------ spawn eggs for the mobs added since
  const EGG = { allay: [0x00daff, 0x00adff], bogged: [0x8a9c72, 0x314d1b], breeze: [0xaf94df, 0x9166df], sniffer: [0x871e09, 0x25ab70], tadpole: [0x6d533d, 0x160a00],
    trader_llama: [0xeaa430, 0x456296], warden: [0x0f4649, 0x39d6e0], ender_dragon: [0x1c1c1c, 0xe079fa], wither: [0x141414, 0x4d72a0] };
  for (const m in EGG) def(m + '_spawn_egg', c => {
    tpl(c, ['................', '................', '.......###......', '......#bbb#.....', '.....#bbbsb#....', '.....#bsbbb#....', '....#bbbbbbb#...', '....#bbsbbsb#...', '....#bbbbbbb#...', '....#bsbbbbb#...', '....#bbbbsbb#...', '.....#bbbbb#....', '......#####.....', '................', '................', '................'],
      { '#': mul(H(EGG[m][0]), 0.55), b: H(EGG[m][0]), s: H(EGG[m][1]) });
  });
  void mixc; void bottle;
})();
