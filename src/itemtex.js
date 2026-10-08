'use strict';
/* Item sprites: 16x16 pixel art painted in code (tools and armour from templates in each material's colours,
   food, materials, gear, dyes, spawn eggs...). */
const ItemTex = (() => {
  const P = {}, cache = {};
  const { H, mul, mixc } = Tex;
  function def(name, fn) { P[name] = fn; }
  function pixels(name) {
    if (cache[name]) return cache[name];
    const c = Tex.ctx('item:' + name, 0); c.clear();
    (P[name] || fallback(name))(c);
    return (cache[name] = c.data);
  }
  const has = n => !!P[n];
  // draw a template: rows of 16 characters, each mapped to a colour (or skipped)
  function tpl(c, rows, map) { for (let y = 0; y < rows.length; y++) for (let x = 0; x < 16; x++) { const ch = rows[y][x]; if (!ch || ch === '.') continue; const col = map[ch]; if (col !== undefined && col !== null) c.px(x, y, typeof col === 'number' ? H(col) : col); } }
  const MAT = {
    wooden: { '#': 0x2f2210, a: 0x5a4425, b: 0x8f7140, c: 0xb8955f }, stone: { '#': 0x2b2b2b, a: 0x585858, b: 0x7a7a7a, c: 0x9c9c9c },
    iron: { '#': 0x383838, a: 0xa8a8a8, b: 0xd8d8d8, c: 0xffffff }, golden: { '#': 0x5c3a00, a: 0xc89a10, b: 0xeac838, c: 0xfff68a },
    diamond: { '#': 0x0b3934, a: 0x27b2a5, b: 0x4aedd9, c: 0xa1fbe8 }, netherite: { '#': 0x1b1719, a: 0x3d3537, b: 0x4d4446, c: 0x726367 },
    leather: { '#': 0x3a2410, a: 0x6b4423, b: 0x8b5a2b, c: 0xa86d3d }, chainmail: { '#': 0x2a2a2a, a: 0x6a6a6a, b: 0x9a9a9a, c: 0xd0d0d0 },
    turtle: { '#': 0x1f3a1a, a: 0x3a6b2e, b: 0x4f8a3a, c: 0x7ab35a },
  };
  const STICK = { s: 0x4a3518, S: 0x8a6a3a };
  const T = {
    sword: ['.............###', '............#cc#', '...........#cbc#', '..........#cba#.', '.........#cba#..', '........#cba#...', '.......#cba#....', '..##..#cba#.....', '..#a##cba#......', '...#aaba#.......', '....#ba#........', '...sS#a##.......', '..sS#..##.......', '.sS.............', '#s..............', '##..............'],
    pickaxe: ['................', '...#####........', '..#cccbb##......', '...##abbbb##....', '.......##abb#...', '........sSab#...', '.......sS..#ab#.', '......sS....#a#.', '.....sS.....#b#.', '....sS......#a#.', '...sS........#..', '..sS............', '.sS.............', 'sS..............', 's...............', '................'],
    axe: ['................', '......###.......', '.....#cbb##.....', '....#cbbaaS#....', '....#cbaaSs#....', '.....#baSs#.....', '......#Ss##.....', '.....sS.........', '....sS..........', '...sS...........', '..sS............', '.sS.............', 'sS..............', 's...............', '................', '................'],
    shovel: ['............###.', '...........#cbb#', '..........#cbba#', '..........#cbaa#', '...........#aa#.', '..........sS##..', '.........sS.....', '........sS......', '.......sS.......', '......sS........', '.....sS.........', '....sS..........', '...sS...........', '..sS............', '.sS.............', 's...............'],
    hoe: ['................', '......#####.....', '.....#ccbbb#....', '......###Sab#...', '........sS.#a#..', '.......sS...##..', '......sS........', '.....sS.........', '....sS..........', '...sS...........', '..sS............', '.sS.............', 'sS..............', 's...............', '................', '................'],
    helmet: ['................', '................', '................', '....########....', '...#ccbbbbaa#...', '...#cbbbbbba#...', '...#cb####ba#...', '...#b#....#a#...', '...#a#....#a#...', '...###....###...', '................', '................', '................', '................', '................', '................'],
    chestplate: ['................', '..###......###..', '..#cb######ba#..', '..#cbbbbbbbba#..', '..##cbbbbbbb##..', '....#cbbbbba#...', '....#cbbbbba#...', '....#cbbbbba#...', '....#cbbbbba#...', '....#bbbbbaa#...', '....#########...', '................', '................', '................', '................', '................'],
    leggings: ['................', '................', '....#########...', '....#cbbbbbba#..', '....#cbbbbbba#..', '....#cbb##bba#..', '....#cb#..#ba#..', '....#cb#..#ba#..', '....#cb#..#ba#..', '....#cb#..#ba#..', '....#bb#..#aa#..', '....####..####..', '................', '................', '................', '................'],
    boots: ['................', '................', '................', '................', '................', '................', '...###....###...', '...#c#....#b#...', '...#c#....#b#...', '..##b#....#a##..', '..#cba#..#cba#..', '..#####..#####..', '................', '................', '................', '................'],
  };
  for (const m of ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite']) for (const k of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) def(m + '_' + k, c => tpl(c, T[k], Object.assign({}, MAT[m], STICK)));
  for (const m of ['leather', 'chainmail', 'iron', 'golden', 'diamond', 'netherite']) ['helmet', 'chestplate', 'leggings', 'boots'].forEach(k => def(m + '_' + k, c => { tpl(c, T[k], MAT[m]); if (m === 'chainmail') c.each((x, y) => { if ((x + y) % 3 === 0 && c.get(x, y)[3] && c.get(x, y)[0] > 0x60) c.alpha(x, y, 0); }); }));
  def('turtle_helmet', c => tpl(c, T.helmet, MAT.turtle));
  // ---------------------------------------------------------------- shapes used by many items
  const blob = (c, cx, cy, r, pal, k) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) { const lit = ((cx - x) + (cy - y)) / (r * 2); c.px(x, y, mixc(H(pal[1]), H(lit > 0.15 ? pal[2] : lit < -0.25 ? pal[0] : pal[1]), 0.8)); } } outline(c, pal[3] !== undefined ? pal[3] : mul(H(pal[0]), 0.6)); };
  function outline(c, col) {
    const col3 = typeof col === 'number' ? H(col) : col, add = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (c.get(x, y)[3]) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && c.get(nx, ny)[3] && !c.get(nx, ny).out) { add.push([x, y]); break; } } }
    for (const [x, y] of add) c.px(x, y, col3);
  }
  const rect = (c, x0, y0, x1, y1, col) => c.rect(x0, y0, x1, y1, H(col));
  // ---------------------------------------------------------------- materials
  def('stick', c => { for (let i = 0; i < 11; i++) { c.px(3 + i, 13 - i, H(0x6b5128)); c.px(4 + i, 13 - i, H(0x8a6a3a)); } c.px(3, 14, H(0x4a3518)); });
  def('coal', c => blob(c, 7.5, 8, 5.2, [0x1b1b1b, 0x2b2b2b, 0x4a4a4a, 0x0e0e0e]));
  def('charcoal', c => blob(c, 7.5, 8, 5.2, [0x2b2116, 0x3d2f20, 0x5a4a38, 0x15100a]));
  const gem = (c, pal) => { tpl(c, ['................', '................', '....#######.....', '...#ccbbbaa#....', '..#cbbbbbbaa#...', '..#bbbbbbbaa#...', '...#bbbbbaa#....', '....#bbbbaa#....', '.....#bbaa#.....', '......#ba#......', '.......##.......', '................', '................', '................', '................', '................'], { '#': pal[3], a: pal[0], b: pal[1], c: pal[2] }); };
  def('diamond', c => gem(c, [0x1fa59a, 0x4aedd9, 0xd8fffb, 0x0b3934]));
  def('emerald', c => { tpl(c, ['................', '......####......', '.....#ccbb#.....', '....#cbbbbb#....', '....#cbbbba#....', '....#cbbbba#....', '....#cbbbba#....', '....#cbbbba#....', '....#bbbbaa#....', '.....#bbaa#.....', '......####......', '................', '................', '................', '................', '................'], { '#': 0x00461a, a: 0x00a63c, b: 0x17dd62, c: 0x9ef5bd }); });
  def('lapis_lazuli', c => { blob(c, 6, 9, 4.5, [0x1d47a6, 0x2c5fc9, 0x5a8af0, 0x0f2457]); c.px(10, 4, H(0x2c5fc9)); c.px(11, 5, H(0x1d47a6)); });
  def('quartz', c => { tpl(c, ['................', '................', '.......##.......', '......#cc#......', '.....#cbbb#.....', '....#cbbbba#....', '...#cbbbbbba#...', '...#bbbbbbaa#...', '....#bbbbaa#....', '.....#bbaa#.....', '......####......', '................', '................', '................', '................', '................'], { '#': 0x8c7a6a, a: 0xd2c9bc, b: 0xece5db, c: 0xffffff }); });
  def('amethyst_shard', c => { tpl(c, ['................', '..........##....', '.........#cb#...', '........#cba#...', '...##..#cba#....', '..#cb##cba#.....', '..#cbbbba#......', '...#cbba#.......', '...#cba#........', '..#cba#.........', '..#ba#..........', '..###...........', '................', '................', '................', '................'], { '#': 0x4a2a7a, a: 0x7650b3, b: 0xa47fe0, c: 0xe2cdfa }); });
  const raw = (c, pal) => { blob(c, 7.5, 8.5, 5, pal); c.px(5, 6, H(pal[2])); c.px(9, 10, H(pal[0])); };
  def('raw_iron', c => raw(c, [0xa47a5c, 0xd8af93, 0xf0d2bd, 0x5a3f2c])); def('raw_copper', c => raw(c, [0x9a4f35, 0xe07a5b, 0xf7b39a, 0x5a2a1a])); def('raw_gold', c => raw(c, [0xc89a10, 0xfcee4b, 0xfffbc0, 0x6b4a00]));
  const ingot = (c, pal) => tpl(c, ['................', '................', '................', '................', '......######....', '.....#ccccbb#...', '....#cbbbbbba#..', '...#cbbbbbbaa#..', '..#bbbbbbbaa#...', '..#aaaaaaaa#....', '..##########....', '................', '................', '................', '................', '................'], { '#': pal[3], a: pal[0], b: pal[1], c: pal[2] });
  def('iron_ingot', c => ingot(c, [0xa8a8a8, 0xd8d8d8, 0xffffff, 0x4a4a4a])); def('copper_ingot', c => ingot(c, [0xa45a3d, 0xd5795a, 0xf0a888, 0x5a2a1a]));
  def('gold_ingot', c => ingot(c, [0xc89a10, 0xeac838, 0xfff68a, 0x6b4a00])); def('netherite_ingot', c => ingot(c, [0x2f2a2b, 0x4d4446, 0x726367, 0x0e0b0c]));
  def('brick', c => ingot(c, [0x7f3a2c, 0xa45343, 0xc8735f, 0x3a1810])); def('nether_brick', c => ingot(c, [0x2c1418, 0x441f25, 0x6a3540, 0x12060a]));
  def('netherite_scrap', c => blob(c, 7.5, 8.5, 5, [0x3d3537, 0x5a4a44, 0x8a7068, 0x1b1719]));
  const nugget = (c, pal) => { tpl(c, ['................', '................', '................', '................', '................', '......###.......', '.....#cbb#......', '....#cbbba#.....', '....#bbbaa#.....', '.....#aaa#......', '......###.......', '................', '................', '................', '................', '................'], { '#': pal[3], a: pal[0], b: pal[1], c: pal[2] }); };
  def('iron_nugget', c => nugget(c, [0xa8a8a8, 0xd8d8d8, 0xffffff, 0x4a4a4a])); def('gold_nugget', c => nugget(c, [0xc89a10, 0xeac838, 0xfff68a, 0x6b4a00]));
  const dust = (c, cols, k) => { for (let i = 0; i < 26; i++) { const x = 3 + Math.floor(c.n(i, 1, k) * 10), y = 4 + Math.floor(c.n(i, 2, k) * 9); c.px(x, y, H(cols[i % cols.length])); } };
  def('redstone', c => dust(c, [0xff0000, 0xb50000, 0xff6a6a, 0x6a0000], 1)); def('glowstone_dust', c => dust(c, [0xf7d43a, 0xd8a83a, 0xfff1b5, 0x9a6a1a], 2));
  def('sugar', c => dust(c, [0xffffff, 0xe0e0e8, 0xc8c8d0], 3)); def('gunpowder', c => dust(c, [0x5a5a5a, 0x3a3a3a, 0x7a7a7a, 0x2a2a2a], 4));
  def('blaze_powder', c => dust(c, [0xffb02e, 0xf7d43a, 0xd86a14, 0xfff07a], 5)); def('bone_meal', c => dust(c, [0xf0eee0, 0xd8d4c4, 0xbab4a2], 6));
  def('string', c => { for (let i = 0; i < 12; i++) c.px(2 + i, 3 + Math.round(Math.sin(i * 0.7) * 2 + i * 0.6), H(0xf0f0f0)); });
  def('feather', c => { for (let i = 0; i < 12; i++) { c.px(3 + i, 13 - i, H(0xd8d8d8)); if (i > 2) { c.px(3 + i - 1, 13 - i - 1, H(0xffffff)); c.px(3 + i + 1, 13 - i + 1, H(0xe8e8e8)); } } c.px(2, 14, H(0x8a8a8a)); });
  def('flint', c => blob(c, 7, 8, 5, [0x2a2a2a, 0x464646, 0x6a6a6a, 0x101010]));
  def('leather', c => { blob(c, 7.5, 8, 5.5, [0x6b3a1f, 0x8b4a24, 0xa86d3d, 0x3a1a0a]); c.alpha(4, 4, 0); c.alpha(11, 12, 0); });
  def('rabbit_hide', c => blob(c, 7.5, 8, 5, [0x8a6a4a, 0xa88a6a, 0xc8aa8a, 0x4a3420]));
  def('rabbit_foot', c => { blob(c, 8, 9, 4, [0xa88a6a, 0xc8aa8a, 0xe8d8c8, 0x5a4430]); rect(c, 7, 2, 9, 5, 0xc8aa8a); });
  def('bone', c => { for (let i = 0; i < 10; i++) { c.px(3 + i, 12 - i, H(0xe8e4d4)); c.px(4 + i, 12 - i, H(0xc8c4b4)); } for (const [x, y] of [[2, 12], [3, 13], [2, 13], [12, 2], [13, 3], [13, 2]]) c.px(x, y, H(0xf4f0e0)); });
  def('ink_sac', c => blob(c, 7.5, 9, 5, [0x1a1a24, 0x2a2a3a, 0x4a4a5a, 0x08080a]));
  def('glow_ink_sac', c => { blob(c, 7.5, 9, 5, [0x1a5a5a, 0x2a8a8a, 0x6af0d8, 0x0a2a2a]); });
  def('slime_ball', c => blob(c, 7.5, 8, 5, [0x4a9a3a, 0x6fcf5a, 0xb0f0a0, 0x2a5a1a]));
  def('magma_cream', c => { blob(c, 7.5, 8, 5, [0x8a3a10, 0xe07a1e, 0xffc84a, 0x3a1a05]); c.px(7, 8, H(0xffe08a)); });
  def('ender_pearl', c => { blob(c, 7.5, 8, 5, [0x0c3a30, 0x1a6b5a, 0x4ac0a0, 0x051a15]); c.px(6, 6, H(0xa0ffe0)); });
  def('ender_eye', c => { blob(c, 7.5, 8, 5, [0x1a5a3a, 0x3a9a6a, 0x8af0c0, 0x0a2a1a]); rect(c, 6, 6, 9, 9, 0xd8e86a); rect(c, 7, 7, 8, 8, 0x0a1a10); });
  def('blaze_rod', c => { for (let i = 0; i < 12; i++) { c.px(3 + i, 13 - i, H(0xffb02e)); c.px(4 + i, 13 - i, H(0xf7d43a)); } c.px(2, 14, H(0xd86a14)); c.px(14, 1, H(0xfff07a)); });
  def('breeze_rod', c => { for (let i = 0; i < 12; i++) { c.px(3 + i, 13 - i, H(0x8ab0f0)); c.px(4 + i, 13 - i, H(0xc8dcff)); } });
  def('ghast_tear', c => { tpl(c, ['................', '................', '.......#........', '......#c#.......', '.....#cbb#......', '.....#cbb#......', '....#cbbba#.....', '....#cbbba#.....', '....#bbbaa#.....', '.....#baa#......', '......###.......', '................', '................', '................', '................', '................'], { '#': 0x6a8a9a, a: 0xb8d8e0, b: 0xd8f0f8, c: 0xffffff }); });
  def('nether_star', c => { tpl(c, ['................', '.......##.......', '.......cc.......', '......#cc#......', '.##..#cbbc#..##.', '.#cc#cbbbbc#cc#.', '..#ccbbbbbbcc#..', '...#cbbbbbbc#...', '....#cbbbbc#....', '...#cbbbbbbc#...', '..#ccbb##bbcc#..', '.#cc#c#..#c#cc#.', '.##..#....#..##.', '................', '................', '................'], { '#': 0xa8c8c8, b: 0xffffe0, c: 0xffffff }); });
  def('prismarine_shard', c => { tpl(c, ['................', '..........##....', '.........#cb#...', '........#cba#...', '.......#cba#....', '......#cba#.....', '.....#cba#......', '....#cba#.......', '...#cba#........', '...#ba#.........', '...###..........', '................', '................', '................', '................', '................'], { '#': 0x2a5a4a, a: 0x5aa08a, b: 0x7cc0b0, c: 0xb0f0e0 }); });
  def('prismarine_crystals', c => dust(c, [0xe8fff8, 0xa8e8d8, 0x7cc0b0, 0xffffff], 7));
  def('nautilus_shell', c => { for (let a = 0; a < 6.5; a += 0.1) { const r = 1 + a * 0.85, x = 8 + Math.cos(a) * r, y = 8 + Math.sin(a) * r; c.px(x, y, H(a % 1 < 0.5 ? 0xe8d8c8 : 0xc87a5a)); } });
  def('heart_of_the_sea', c => { blob(c, 7.5, 8, 5, [0x1a4a8a, 0x2a7ad8, 0x8ad0ff, 0x0a1a3a]); rect(c, 7, 7, 8, 8, 0xe0f8ff); });
  def('turtle_scute', c => { blob(c, 7.5, 8, 5, [0x2a6a2a, 0x4a9a3a, 0x8ad06a, 0x0a2a0a]); });
  def('armadillo_scute', c => blob(c, 7.5, 8, 5, [0x8a5a4a, 0xb07a6a, 0xd8a090, 0x4a2a1a]));
  def('phantom_membrane', c => { blob(c, 7.5, 8, 5.5, [0x8a8a7a, 0xc0bca8, 0xe8e4d4, 0x4a4a3a]); c.each((x, y) => { if (c.get(x, y)[3] && c.n(x, y, 8) > 0.85) c.alpha(x, y, 0); }); });
  def('shulker_shell', c => { tpl(c, ['................', '................', '....########....', '...#cbbbbbba#...', '..#cbbbbbbbba#..', '..#bbbbbbbbaa#..', '..#bbaaaaaaaa#..', '..############..', '................', '................', '................', '................', '................', '................', '................', '................'], { '#': 0x4a2a4a, a: 0x7a557a, b: 0x956a95, c: 0xc8a0c8 }); });
  def('echo_shard', c => { tpl(c, ['................', '.........##.....', '........#cb#....', '.......#cba#....', '......#cba#.....', '.....#cbba#.....', '....#cbba#......', '...#cba#........', '...#ba#.........', '...###..........', '................', '................', '................', '................', '................', '................'], { '#': 0x0a1a2a, a: 0x1a4a5a, b: 0x2a8a9a, c: 0x6af0f0 }); });
  def('snowball', c => blob(c, 7.5, 8, 5, [0xc8d8e0, 0xe8f4f8, 0xffffff, 0x8a9aa8]));
  def('brush', c => { for (let i = 0; i < 9; i++) c.px(3 + i, 12 - i, H(0x8a6a3a)); rect(c, 10, 2, 13, 5, 0xc8a07a); c.px(13, 2, H(0xe8d8a8)); });
  def('clay_ball', c => blob(c, 7.5, 8.5, 4.5, [0x8f95a3, 0xa1a7b4, 0xc8ccd8, 0x4a4e58]));
  def('paper', c => { rect(c, 3, 2, 12, 13, 0xf0f0e8); rect(c, 3, 2, 12, 2, 0xffffff); for (let y = 5; y < 12; y += 2) rect(c, 5, y, 10, y, 0xc8c8c0); });
  const book = (c, cover) => { rect(c, 3, 2, 12, 13, cover); rect(c, 4, 3, 11, 12, mul(H(cover), 1.15).reduce((a, v, i) => a | (Math.min(255, v | 0) << (16 - i * 8)), 0)); rect(c, 3, 2, 4, 13, 0xe8e8e0); rect(c, 3, 13, 12, 13, 0xf0f0e8); };
  def('book', c => book(c, 0x6b3a1f)); def('writable_book', c => { book(c, 0x6b3a1f); c.line(9, 12, 13, 3, H(0xf0f0f0)); c.px(13, 2, H(0x2a2a2a)); });
  def('written_book', c => { book(c, 0x6b3a1f); rect(c, 6, 5, 9, 7, 0xd8b44a); }); def('enchanted_book', c => { book(c, 0x8a2a2a); rect(c, 6, 5, 9, 7, 0xd8b44a); });
  def('wheat', c => { for (const bx of [4, 7, 10]) { for (let y = 6; y < 15; y++) c.px(bx + (y > 11 ? 0 : 0), y, H(0x9a8a3a)); for (let y = 1; y < 7; y++) { c.px(bx, y, H(0xd8b55c)); c.px(bx + (y % 2 ? 1 : -1), y, H(0xb59a42)); } } rect(c, 3, 11, 12, 11, 0xc8a44a); });
  const seeds = (c, col) => { for (const [x, y] of [[5, 6], [9, 5], [7, 9], [10, 10], [4, 11], [8, 12]]) { c.px(x, y, H(col)); c.px(x + 1, y, mul(H(col), 0.8)); c.px(x, y + 1, mul(H(col), 0.7)); } };
  def('wheat_seeds', c => seeds(c, 0x6aa52c)); def('pumpkin_seeds', c => seeds(c, 0xe8d8a0)); def('melon_seeds', c => seeds(c, 0x2a1a0a)); def('beetroot_seeds', c => seeds(c, 0xb8a87a)); def('torchflower_seeds', c => seeds(c, 0x6a8a3a));
  def('cocoa_beans', c => { blob(c, 6, 8, 3.2, [0x5a2f14, 0x7a4220, 0x9a5a2a, 0x2a1408]); blob(c, 10, 9, 3, [0x5a2f14, 0x7a4220, 0x9a5a2a, 0x2a1408]); });
  def('egg', c => { tpl(c, ['................', '................', '................', '.......##.......', '......#cc#......', '.....#cbbb#.....', '....#cbbbbb#....', '....#cbbbbb#....', '....#bbbbba#....', '....#bbbbaa#....', '.....#bbaa#.....', '......####......', '................', '................', '................', '................'], { '#': 0x8a7a5a, a: 0xd8c8a0, b: 0xf0e4c8, c: 0xffffff }); });
  def('honeycomb', c => { blob(c, 7.5, 8, 5.5, [0xc7841a, 0xe5a225, 0xf7c84a, 0x6a400a]); c.each((x, y) => { if (c.get(x, y)[3] && (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) c.px(x, y, H(0xb06a10)); }); });
  def('popped_chorus_fruit', c => blob(c, 7.5, 8, 5, [0x8a6a9a, 0xb894c6, 0xe0c8f0, 0x4a2a5a]));
  def('fermented_spider_eye', c => { blob(c, 7.5, 8.5, 4.5, [0x7a2a3a, 0xb04a5a, 0xe08a9a, 0x3a0a1a]); rect(c, 6, 3, 9, 4, 0xc8a07a); });
  def('glistering_melon_slice', c => { P.melon_slice(c); c.each((x, y) => { if (c.get(x, y)[3] && c.n(x, y, 9) > 0.8) c.px(x, y, H(0xf7d43a)); }); });
  def('fire_charge', c => { blob(c, 7.5, 8, 5, [0x3a1a0a, 0x6a2a10, 0xe86a14, 0x1a0a05]); for (const [x, y] of [[6, 6], [9, 9], [7, 10], [10, 6]]) c.px(x, y, H(0xffb02e)); });
  def('netherite_upgrade_smithing_template', c => { rect(c, 2, 1, 13, 14, 0x3a3436); rect(c, 3, 2, 12, 13, 0x4d4446); rect(c, 6, 5, 9, 10, 0x726367); });
  def('disc_fragment_5', c => { rect(c, 4, 4, 11, 11, 0x2a2a2a); rect(c, 6, 6, 9, 9, 0x4a6a8a); });
  def('goat_horn', c => { for (let i = 0; i < 10; i++) { c.px(3 + i, 12 - Math.floor(i * 0.8), H(0xc8b89a)); c.px(3 + i, 13 - Math.floor(i * 0.8), H(0xa8987a)); } });
  def('heavy_core', c => { rect(c, 4, 4, 11, 11, 0x4a4a52); rect(c, 6, 6, 9, 9, 0x6a6a72); });
  def('wind_charge', c => blob(c, 7.5, 8, 4.5, [0x8ab0f0, 0xb8d0ff, 0xe8f0ff, 0x3a5a9a]));
  def('mace', c => { tpl(c, T.shovel, { '#': 0x2a2a2a, a: 0x6a6a6a, b: 0x8a8a8a, c: 0xc0c0c0, s: 0x4a3518, S: 0xc8a050 }); });
  // ---------------------------------------------------------------- food
  def('apple', c => { blob(c, 7.5, 9, 5, [0xa8160e, 0xd8241b, 0xff6a5a, 0x4a0a05]); rect(c, 7, 2, 7, 4, 0x5a3a1a); c.px(8, 3, H(0x4f8a25)); c.px(9, 2, H(0x6aa52c)); });
  def('golden_apple', c => { blob(c, 7.5, 9, 5, [0xc89a10, 0xeac838, 0xfff68a, 0x6b4a00]); rect(c, 7, 2, 7, 4, 0x5a3a1a); c.px(8, 3, H(0x4f8a25)); });
  def('enchanted_golden_apple', c => P.golden_apple(c));
  def('melon_slice', c => { tpl(c, ['................', '................', '................', '..#.........#...', '..#c.......#b#..', '..#cbb...bbcb#..', '..#cbbbbbbbbb#..', '...#cbbbbbbb#...', '....#ggggggg#...', '.....#######....', '................', '................', '................', '................', '................', '................'], { '#': 0x3a5a10, b: 0xe8443a, c: 0xff8a7a, g: 0x6a9e24 }); for (const [x, y] of [[6, 6], [9, 6], [7, 7], [10, 7]]) c.px(x, y, H(0x1a0a05)); });
  def('sweet_berries', c => { for (const [x, y] of [[6, 7], [9, 6], [7, 10], [10, 9], [5, 11]]) blobAt(c, x, y, 1.6, [0x8a0a14, 0xc21c2a, 0xff6a7a]); c.line(7, 3, 9, 6, H(0x3a5a1a)); });
  def('glow_berries', c => { for (const [x, y] of [[6, 8], [9, 7], [7, 11], [10, 10]]) blobAt(c, x, y, 1.6, [0xd8801a, 0xffb02e, 0xfff07a]); c.line(7, 2, 8, 6, H(0x3a5a1a)); });
  function blobAt(c, cx, cy, r, pal) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) c.px(x, y, H(d < r * 0.4 && x <= cx && y <= cy ? pal[2] : d > r * 0.75 ? pal[0] : pal[1])); } }
  def('chorus_fruit', c => { blob(c, 7.5, 8.5, 5, [0x5b3a6b, 0x8e66a1, 0xc8a0d8, 0x2a1a3a]); });
  def('carrot', c => { for (let i = 0; i < 9; i++) { c.px(4 + i, 12 - i, H(0xf08a1e)); c.px(5 + i, 12 - i, H(0xd8701a)); if (i < 6) c.px(4 + i, 13 - i, H(0xffa84a)); } c.px(13, 2, H(0x4f9a2a)); c.px(14, 1, H(0x6aa52c)); c.px(12, 1, H(0x4f9a2a)); c.px(14, 3, H(0x6aa52c)); });
  def('golden_carrot', c => { P.carrot(c); c.each((x, y) => { const p = c.get(x, y); if (p[3] && p[0] > 0xc0 && p[2] < 0x60) c.px(x, y, mixc(H(0xf7d43a), p, 0.3)); }); });
  def('potato', c => blob(c, 7.5, 8.5, 4.5, [0x9a7a3a, 0xc49a4a, 0xe0c070, 0x4a3410]));
  def('baked_potato', c => blob(c, 7.5, 8.5, 4.5, [0x8a5a2a, 0xc88a3a, 0xf0c060, 0x3a2410]));
  def('poisonous_potato', c => blob(c, 7.5, 8.5, 4.5, [0x7a8a3a, 0xa8b04a, 0xd0d870, 0x3a4410]));
  def('beetroot', c => { blob(c, 7.5, 9.5, 4.2, [0x6a1020, 0xa52a3a, 0xd85a6a, 0x2a0510]); rect(c, 7, 2, 8, 5, 0x4f8a25); });
  def('dried_kelp', c => { for (let i = 0; i < 10; i++) { c.px(4 + i, 12 - i, H(0x3a452b)); c.px(5 + i, 12 - i, H(0x2a321e)); c.px(4 + i, 13 - i, H(0x4a5535)); } });
  const meat = (c, pal) => { tpl(c, ['................', '................', '....######......', '...#cbbbbb##....', '..#cbbbbbbbb#...', '..#cbbbbbbbbb#..', '..#bbbbbbbbbb#..', '...#bbbbbbbba#..', '....#bbbbbaa#...', '.....#aaaaa#....', '......#####.....', '................', '................', '................', '................', '................'], { '#': pal[3], a: pal[0], b: pal[1], c: pal[2] }); };
  def('beef', c => { meat(c, [0x9a1a1a, 0xc8302a, 0xe86a5a, 0x4a0a0a]); c.px(6, 5, H(0xf0e0d0)); c.px(9, 6, H(0xf0e0d0)); });
  def('cooked_beef', c => meat(c, [0x5a2a14, 0x7a4220, 0xa86a3a, 0x2a1408]));
  def('porkchop', c => { meat(c, [0xd86a7a, 0xf0a0aa, 0xffd0d8, 0x7a2a3a]); rect(c, 4, 4, 10, 4, 0xfff0f0); });
  def('cooked_porkchop', c => { meat(c, [0x8a4a2a, 0xc87a4a, 0xf0b07a, 0x3a1a0a]); rect(c, 4, 4, 10, 4, 0xf0d0a0); });
  def('mutton', c => meat(c, [0xa01a2a, 0xd0303a, 0xf07a7a, 0x4a0a10])); def('cooked_mutton', c => meat(c, [0x6a3018, 0x8a4a2a, 0xb07a4a, 0x2a1408]));
  const drumstick = (c, pal) => { tpl(c, ['................', '................', '.......####.....', '......#cbbb#....', '.....#cbbbbb#...', '.....#cbbbbbb#..', '.....#bbbbbbb#..', '......#bbbbba#..', '.....##bbbaa#...', '....#wW#####....', '...#wW#.........', '..#wW#..........', '.#ww#...........', '.####...........', '................', '................'], { '#': pal[3], a: pal[0], b: pal[1], c: pal[2], w: 0xe8e4d4, W: 0xffffff }); };
  def('chicken', c => drumstick(c, [0xd8a090, 0xf0c8b8, 0xffe8e0, 0x7a4a3a])); def('cooked_chicken', c => drumstick(c, [0x8a5a2a, 0xc8883a, 0xf0b860, 0x3a2410]));
  def('rabbit', c => drumstick(c, [0xd08a7a, 0xf0b0a0, 0xffd8d0, 0x7a3a2a])); def('cooked_rabbit', c => drumstick(c, [0x7a4a2a, 0xa86a3a, 0xd89a5a, 0x3a1a0a]));
  const fish = (c, pal, belly) => { tpl(c, ['................', '................', '................', '................', '.....######.....', '...##cbbbbb##.#.', '..#cbbbbbbbbb#b#', '.#c.bbbbbbbbbbb#', '.#cbbbbbbbbbb#b#', '..#ddddddddd#.#.', '...##ddddd##....', '.....######.....', '................', '................', '................', '................'], { '#': pal[3], b: pal[1], c: pal[2], d: belly }); c.px(3, 7, H(0x111111)); };
  def('cod', c => fish(c, [0, 0xb8a07a, 0xd8c8a0, 0x5a4a30], 0xe8dcc0)); def('cooked_cod', c => fish(c, [0, 0xc8a87a, 0xe8d0a0, 0x6a4a2a], 0xf0e0c0));
  def('salmon', c => fish(c, [0, 0xa83a2a, 0xd86a4a, 0x4a1a0a], 0xe89a7a)); def('cooked_salmon', c => fish(c, [0, 0xb86a3a, 0xe0905a, 0x5a2a0a], 0xf0b88a));
  def('tropical_fish', c => { fish(c, [0, 0xf07a1e, 0xffa84a, 0x5a2a0a], 0xffffff); for (let y = 5; y < 11; y++) c.px(8, y, H(0xffffff)); });
  def('pufferfish', c => { blob(c, 7.5, 8, 5, [0xb8a020, 0xe8d040, 0xfff090, 0x5a4a10]); for (const [x, y] of [[2, 8], [13, 8], [7, 2], [8, 14], [4, 4], [11, 4], [4, 12], [11, 12]]) c.px(x, y, H(0xf0f0f0)); c.px(5, 7, H(0x111111)); });
  def('bread', c => { tpl(c, ['................', '................', '................', '................', '.....#######....', '...##cccbbbb##..', '..#cbbbbbbbbba#.', '.#cbbbbbbbbbbaa#', '.#bbbbbbbbbbaaa#', '..##aaaaaaaaa##.', '....#########...', '................', '................', '................', '................', '................'], { '#': 0x5a3a14, a: 0x9a6a2a, b: 0xc89a4a, c: 0xe8c070 }); for (const x of [5, 8, 11]) c.px(x, 6, H(0x8a5a1a)); });
  def('cookie', c => { blob(c, 7.5, 8, 5, [0xa86a2a, 0xd89a4a, 0xf0c070, 0x5a3410]); for (const [x, y] of [[6, 6], [9, 7], [6, 10], [10, 10]]) c.px(x, y, H(0x3a1a0a)); });
  def('pumpkin_pie', c => { blob(c, 7.5, 8.5, 5.5, [0xa8601a, 0xe0901e, 0xf8c060, 0x5a3008]); c.each((x, y) => { const d = Math.hypot(x - 7.5, y - 8.5); if (d < 4 && d > 0) c.px(x, y, H(0xd86a14)); }); });
  def('rotten_flesh', c => { meat(c, [0x5a6a2a, 0x8a7a3a, 0xa89a5a, 0x2a3010]); c.px(6, 6, H(0x6a2a1a)); c.px(10, 8, H(0x6a2a1a)); });
  def('spider_eye', c => { blob(c, 7.5, 8.5, 4.5, [0x7a1a2a, 0xb03040, 0xe86a7a, 0x2a0510]); c.px(7, 8, H(0x111111)); });
  const bowl = (c, soup) => { tpl(c, ['................', '................', '................', '................', '................', '................', '..############..', '.#ssssssssssss#.', '.#wwwwwwwwwwww#.', '..#wwwwwwwwww#..', '...#wwwwwwww#...', '....########....', '................', '................', '................', '................'], { '#': 0x3a2410, s: soup || 0x6b5128, w: 0x8a6a3a }); };
  def('bowl', c => bowl(c, null)); def('mushroom_stew', c => bowl(c, 0xc8a07a)); def('beetroot_soup', c => bowl(c, 0xa52a3a)); def('rabbit_stew', c => bowl(c, 0xa86a3a)); def('suspicious_stew', c => bowl(c, 0xc8a07a));
  // bottles and buckets
  function bottle(c, liquid, splash, linger) {
    tpl(c, ['................', '......####......', '......#cc#......', '.......##.......', '......#gg#......', '.....#gLLg#.....', '....#gLLLLg#....', '...#gLLLLLLg#...', '...#gLLLLLLg#...', '...#gLLLLLLg#...', '...#gLLLLLLg#...', '....#gLLLLg#....', '.....######.....', '................', '................', '................'], { '#': 0x5a6a7a, c: 0x8a6a3a, g: 0xd0e8f0, L: liquid || 0xd0e8f0 });
    if (!liquid) c.each((x, y) => { const p = c.get(x, y); if (p[3] && p[2] > 0xe0 && p[0] > 0xc0) c.alpha(x, y, 140); });
    if (splash) { rect(c, 6, 2, 9, 3, 0x5a6a7a); }
    if (linger) { c.px(4, 6, H(0xffffff)); }
  }
  def('glass_bottle', c => bottle(c, null)); def('potion', c => bottle(c, 0x385dc6)); def('splash_potion', c => bottle(c, 0x385dc6, true)); def('lingering_potion', c => bottle(c, 0x385dc6, true, true));
  def('experience_bottle', c => bottle(c, 0x8af04a)); def('honey_bottle', c => bottle(c, 0xf7a51e)); def('dragon_breath', c => bottle(c, 0xc86ad8));
  function bucket(c, content) {
    tpl(c, ['................', '................', '...##########...', '..#cbbbbbbbba#..', '..#ammmmmmmma#..', '..#cbbbbbbbba#..', '...#cbbbbbba#...', '...#cbbbbbba#...', '....#cbbbba#....', '....#cbbbba#....', '.....######.....', '................', '................', '................', '................', '................'], { '#': 0x3a3a3a, a: 0x8a8a8a, b: 0xb8b8b8, c: 0xe0e0e0, m: content || 0x2a2a2a });
    c.line(2, 3, 7, 0, H(0x8a8a8a)); c.line(13, 3, 8, 0, H(0x8a8a8a));
  }
  def('bucket', c => bucket(c)); def('water_bucket', c => bucket(c, 0x3f76e4)); def('lava_bucket', c => bucket(c, 0xf28f1d)); def('milk_bucket', c => bucket(c, 0xf8f8f8)); def('powder_snow_bucket', c => bucket(c, 0xf0f8f8));
  for (const [f, col] of [['cod', 0xb8a07a], ['salmon', 0xa83a2a], ['tropical_fish', 0xf07a1e], ['pufferfish', 0xe8d040], ['axolotl', 0xf0a0c0], ['tadpole', 0x5a4a3a]]) def(f + '_bucket', c => { bucket(c, 0x3f76e4); rect(c, 5, 4, 10, 5, col); });
  // gear
  def('shears', c => { tpl(c, ['................', '..........##....', '.........#cb#...', '........#cb#....', '...##..#cb#.....', '..#cb##cb#......', '...#cbcb#.......', '....#cb#........', '...#rr#c#.......', '..#rr#.#cb#.....', '.#rr#...#cb#....', '.#r#.....###....', '.##.............', '................', '................', '................'], { '#': 0x3a3a3a, b: 0xb8b8b8, c: 0xe8e8e8, r: 0x8a5a2a }); });
  def('flint_and_steel', c => { rect(c, 3, 8, 6, 12, 0x3a3a3a); rect(c, 4, 9, 5, 11, 0x5a5a5a); c.line(8, 12, 12, 4, H(0xb8b8b8)); c.line(9, 12, 13, 4, H(0x8a8a8a)); c.line(12, 4, 9, 3, H(0xb8b8b8)); });
  def('compass', c => { blob(c, 7.5, 7.5, 6, [0x5a5a5a, 0x8a8a8a, 0xb8b8b8, 0x2a2a2a]); blob(c, 7.5, 7.5, 4, [0xc8c0b0, 0xe8e0d0, 0xffffff]); c.line(7, 4, 8, 11, H(0xc81a1a)); c.px(7, 7, H(0x2a2a2a)); });
  def('recovery_compass', c => { P.compass(c); c.line(7, 4, 8, 11, H(0x2ab8c8)); });
  def('clock', c => { blob(c, 7.5, 7.5, 6, [0xa88010, 0xd8b030, 0xfff070, 0x5a4000]); blob(c, 7.5, 7.5, 4, [0x3a5a9a, 0x6a8ad8, 0xa0c0ff]); c.line(8, 8, 8, 4, H(0xffffff)); });
  def('spyglass', c => { for (let i = 0; i < 11; i++) { c.px(3 + i, 12 - i, H(0xc87a4a)); c.px(4 + i, 12 - i, H(0xa85a2a)); c.px(3 + i, 11 - i, H(0xe8a070)); } rect(c, 12, 2, 13, 3, 0xd8f0ff); });
  def('lead', c => { for (let a = 0; a < 6.2; a += 0.15) c.px(7.5 + Math.cos(a) * 4, 7.5 + Math.sin(a) * 4, H(0x8a6a4a)); c.line(10, 10, 14, 14, H(0x8a6a4a)); });
  def('name_tag', c => { rect(c, 3, 5, 13, 11, 0xe8e0c8); rect(c, 4, 6, 12, 10, 0xf8f0d8); c.px(4, 8, H(0x3a3a3a)); c.line(2, 4, 3, 5, H(0x8a8a8a)); });
  def('saddle', c => { tpl(c, ['................', '................', '................', '....########....', '...#cbbbbbbb#...', '..#cbbbbbbbbb#..', '..#bbbbbbbbba#..', '...#aaaaaaaa#...', '....#m#..#m#....', '....#m#..#m#....', '....###..###....', '................', '................', '................', '................', '................'], { '#': 0x3a1a0a, a: 0x6a3a1a, b: 0x8a4a24, c: 0xa86d3d, m: 0x8a8a8a }); });
  def('carrot_on_a_stick', c => { P.fishing_rod(c); rect(c, 12, 10, 13, 13, 0xf08a1e); });
  def('warped_fungus_on_a_stick', c => { P.fishing_rod(c); rect(c, 11, 10, 14, 12, 0x22a593); });
  def('fishing_rod', c => { for (let i = 0; i < 12; i++) c.px(2 + i, 13 - i, H(i < 3 ? 0x5a4a3a : 0x8a6a3a)); c.line(14, 1, 14, 13, H(0xe8e8e8)); });
  def('bow', c => { tpl(c, ['................', '.........######.', '.......##ssss#..', '.....##ssS#.t...', '....#sS##..t....', '...#sS#...t.....', '...#S#...t......', '..#sS#..t.......', '..#S#..t........', '..#S#.t.........', '..#S#t..........', '..#St...........', '..##............', '................', '................', '................'], { '#': 0x3a2410, s: 0x6b4423, S: 0x8a6a3a, t: 0xe8e8e8 }); });
  def('crossbow', c => { for (let i = 0; i < 11; i++) { c.px(2 + i, 13 - i, H(0x6b4423)); c.px(3 + i, 13 - i, H(0x8a6a3a)); } c.line(3, 3, 12, 12, H(0x3a3a3a)); c.line(4, 3, 12, 11, H(0x5a5a5a)); });
  def('arrow', c => { for (let i = 0; i < 10; i++) c.px(3 + i, 12 - i, H(0x8a6a3a)); rect(c, 11, 2, 13, 2, 0xb8b8b8); rect(c, 13, 2, 13, 4, 0xb8b8b8); c.px(12, 3, H(0xe8e8e8)); for (const [x, y] of [[2, 12], [3, 13], [2, 14], [1, 13], [3, 11], [4, 12]]) c.px(x, y, H(0xf0f0f0)); });
  def('spectral_arrow', c => { P.arrow(c); rect(c, 11, 2, 13, 4, 0xf7d43a); });
  def('tipped_arrow', c => { P.arrow(c); rect(c, 11, 2, 13, 4, 0xc83a3a); });
  def('trident', c => { for (let i = 0; i < 12; i++) c.px(2 + i, 13 - i, H(0x3a8a7a)); c.line(10, 1, 14, 1, H(0x7ad8c8)); c.line(14, 1, 14, 5, H(0x7ad8c8)); c.line(9, 2, 13, 6, H(0x5ab8a8)); });
  def('shield', c => { tpl(c, ['................', '...##########...', '...#wwwwwwww#...', '...#wpppppppw#..', '...#wpppppppw#..', '...#wpppppppw#..', '...#wpppppppw#..', '...#wpppppppw#..', '...#wpppppppw#..', '...#wpppppppw#..', '....#wpppppw#...', '.....#wpppw#....', '......#www#.....', '.......###......', '................', '................'], { '#': 0x3a3a3a, w: 0x8a8a8a, p: 0x8a6a3a }); });
  def('totem_of_undying', c => { tpl(c, ['................', '......####......', '.....#cbbb#.....', '.....#b#b#b.....', '.....#bbbbb#....', '..####cbbb####..', '..#cbbbbbbbbb#..', '...##bbbbbbb##..', '.....#bbbbb#....', '.....#bbbbb#....', '.....#bgggb#....', '.....#bbbbb#....', '......#b#b#.....', '......##.##.....', '................', '................'], { '#': 0x6b4a00, b: 0xeac838, c: 0xfff68a, g: 0x2fd669 }); });
  def('elytra', c => { tpl(c, ['................', '..####....####..', '.#cbbb#..#bbbc#.', '.#cbbbb##bbbbc#.', '.#cbbbbbbbbbbc#.', '..#cbbb##bbbc#..', '..#cbb#..#bbc#..', '..#cbb#..#bbc#..', '...#bb#..#bb#...', '...#bb#..#bb#...', '....#b#..#b#....', '....###..###....', '................', '................', '................', '................'], { '#': 0x3a3a4a, b: 0x8a8a9a, c: 0xb8b8c8 }); });
  for (const [h, pal] of [['leather', MAT.leather], ['iron', MAT.iron], ['golden', MAT.golden], ['diamond', MAT.diamond]]) def(h + '_horse_armor', c => tpl(c, ['................', '................', '...#######......', '..#cbbbbbb#.....', '..#cbbbbbbb##...', '...#bbbbbbbbb#..', '....#bbbbbbbbb#.', '.....#abbbbbbb#.', '.....#a#.#a#.#..', '.....#a#.#a#....', '.....###.###....', '................', '................', '................', '................', '................'], pal));
  def('end_crystal', c => { blob(c, 7.5, 7.5, 5, [0xa070c8, 0xd8b0ff, 0xffffff, 0x4a2a6a]); c.each((x, y) => { if ((x + y) % 4 === 0 && c.get(x, y)[3]) c.px(x, y, H(0xe8c0ff)); }); });
  def('firework_rocket', c => { rect(c, 6, 3, 9, 11, 0xc83a2a); rect(c, 6, 3, 9, 4, 0xe8e8e8); c.line(7, 12, 5, 15, H(0x8a6a3a)); c.line(8, 12, 10, 15, H(0x8a6a3a)); });
  def('firework_star', c => { blob(c, 7.5, 8, 4.5, [0x4a4a4a, 0x6a6a6a, 0x9a9a9a, 0x1a1a1a]); });
  def('map', c => { rect(c, 2, 2, 13, 13, 0xd8cca0); rect(c, 3, 3, 12, 12, 0xe8dcb0); for (let i = 0; i < 6; i++) c.px(4 + i * 1.5, 6 + Math.sin(i) * 2, H(0x8a7a5a)); });
  def('filled_map', c => { P.map(c); rect(c, 5, 5, 8, 8, 0x6aa52c); rect(c, 9, 7, 11, 10, 0x3f76e4); });
  def('painting', c => { rect(c, 1, 2, 14, 13, 0x8a6a3a); rect(c, 2, 3, 13, 12, 0x6aa0d8); rect(c, 2, 9, 13, 12, 0x4f8a25); c.px(10, 5, H(0xf7d43a)); });
  def('item_frame', c => { rect(c, 2, 2, 13, 13, 0x8a6a3a); rect(c, 4, 4, 11, 11, 0x8a5a3a); rect(c, 5, 5, 10, 10, 0x6b4423); });
  def('glow_item_frame', c => { P.item_frame(c); rect(c, 5, 5, 10, 10, 0x2a8a8a); });
  def('armor_stand', c => { rect(c, 7, 1, 8, 14, 0x8a6a3a); rect(c, 4, 4, 11, 5, 0x8a6a3a); rect(c, 5, 9, 10, 10, 0x8a6a3a); rect(c, 3, 14, 12, 15, 0x7a7a7a); });
  def('minecart', c => { tpl(c, ['................', '................', '................', '................', '..############..', '..#bbbbbbbbbb#..', '..#a########b#..', '..#a#......#b#..', '..#aaaaaaaaab#..', '..############..', '...#o#....#o#...', '...###....###...', '................', '................', '................', '................'], { '#': 0x2a2a2a, a: 0x7a7a7a, b: 0xa8a8a8, o: 0x3a3a3a }); });
  for (const [m, col] of [['chest', 0xa2834f], ['hopper', 0x4a4a4a], ['tnt', 0xc8321f], ['furnace', 0x7a7a7a]]) def(m + '_minecart', c => { P.minecart(c); rect(c, 4, 4, 11, 7, col); });
  for (const w of WOODS.concat(['bamboo'])) {
    const pal = Tex.WOOD[w].planks;
    const boat = c => tpl(c, ['................', '................', '................', '................', '................', '................', '..#..........#..', '.#c#........#c#.', '.#cbbbbbbbbbbc#.', '.#bbbbbbbbbbbb#.', '..#bbbbbbbbbb#..', '...##########...', '................', '................', '................', '................'], { '#': mul(H(pal[0]), 0.6), b: pal[2], c: pal[4] });
    def(w === 'bamboo' ? 'bamboo_raft' : w + '_boat', boat);
    def(w === 'bamboo' ? 'bamboo_chest_raft' : w + '_chest_boat', c => { boat(c); rect(c, 6, 5, 9, 8, 0xa2834f); c.px(7, 6, H(0xc0c0c0)); });
  }
  // dyes
  const DYE = Tex.CLR;
  for (const k in DYE) def(k + '_dye', c => { tpl(c, ['................', '................', '................', '.....######.....', '....#cbbbbb#....', '...#cbbbbbba#...', '...#bbbbbbbb#...', '...#bbbbbbaa#...', '....#bbbbaa#....', '.....######.....', '................', '................', '................', '................', '................', '................'], { '#': mul(H(DYE[k]), 0.45), b: DYE[k], c: mul(H(DYE[k]), 1.25).map(v => Math.min(255, v)), a: mul(H(DYE[k]), 0.8) }); });
  // music discs
  const DISC = { '13': 0xe8c03a, cat: 0x5ab83a, blocks: 0xd84a2a, chirp: 0xc83a2a, far: 0x7ad84a, mall: 0x6a4ac8, mellohi: 0xc84ab8, stal: 0x2a2a2a, strad: 0xe8e8e8, ward: 0x3a8a6a, '11': 0x4a4a4a, wait: 0x3a8ad8, pigstep: 0xd87a3a, otherside: 0x3ab8c8 };
  for (const d in DISC) def('music_disc_' + d, c => { blob(c, 7.5, 7.5, 6.5, [0x1a1a1a, 0x2a2a2a, 0x3a3a3a, 0x0a0a0a]); blob(c, 7.5, 7.5, 2.5, [DISC[d], DISC[d], DISC[d]]); c.px(7, 7, H(0x0a0a0a)); });
  // spawn eggs: the egg with the mob's two colours
  const EGG = { pig: [0xf0a5a2, 0xdb635f], cow: [0x443626, 0xa1a1a1], sheep: [0xe7e7e7, 0xffb5b5], chicken: [0xa1a1a1, 0xff0000], mooshroom: [0xa00f10, 0xb7b7b7], horse: [0xc09e7d, 0xeee500], donkey: [0x534539, 0x867566], mule: [0x1b0200, 0x51331d],
    rabbit: [0x995f40, 0x734831], wolf: [0xd7d3d3, 0xceaf96], cat: [0xefc88e, 0x957256], ocelot: [0xefde7d, 0x564434], fox: [0xd5b69f, 0xcc6920], parrot: [0x0da70b, 0xff0000], bat: [0x4c3e30, 0x0f0f0f], squid: [0x223b4d, 0x708899], glow_squid: [0x095656, 0x85f1bc],
    cod: [0xc1a76a, 0xe5c48b], salmon: [0xa00f10, 0x0e8474], tropical_fish: [0xef6915, 0xfff9ef], pufferfish: [0xf6b201, 0x37c3f2], dolphin: [0x223b4d, 0xf9f9f9], turtle: [0xe7e7e7, 0x00afaf], polar_bear: [0xf2f2f2, 0x959590], panda: [0xe7e7e7, 0x1b1b22],
    bee: [0xedc343, 0x43241b], goat: [0xa5947c, 0x55493e], llama: [0xc09e7d, 0x995f40], frog: [0xd07444, 0xffc77c], axolotl: [0xfbc1e3, 0xa62d74], camel: [0xfcc369, 0xcb9337], armadillo: [0xad716d, 0x824848], strider: [0x9c3436, 0x4d494d],
    villager: [0x563c33, 0xbd8b72], wandering_trader: [0x456296, 0xeaa430], iron_golem: [0xdbcdc1, 0x74a332], snow_golem: [0xd9f2f2, 0x81a4a4], zombie: [0x00afaf, 0x799c65], husk: [0x797061, 0xe6cc94], drowned: [0x8ff1d7, 0x799c65], zombie_villager: [0x563c33, 0x799c65],
    skeleton: [0xc1c1c1, 0x494949], stray: [0x617677, 0xdde4e4], wither_skeleton: [0x141414, 0x474d4d], creeper: [0x0da70b, 0x000000], spider: [0x342d27, 0xa80e0e], cave_spider: [0x0c424e, 0xa80e0e], enderman: [0x161616, 0x000000], endermite: [0x161616, 0x6e6e6e],
    silverfish: [0x6e6e6e, 0x303030], slime: [0x51a03e, 0x7ebf6e], magma_cube: [0x340000, 0xfcfc00], witch: [0x340000, 0x51a03e], phantom: [0x43518a, 0x88ff00], blaze: [0xf6b201, 0xfff87e], ghast: [0xf9f9f9, 0xbcbcbc], zombified_piglin: [0xea9393, 0x4c7129],
    piglin: [0x995f40, 0xf9f3a4], piglin_brute: [0x592a10, 0xf9f3a4], hoglin: [0xc66e55, 0x5f6464], zoglin: [0xc66e55, 0xe6e6e6], pillager: [0x532f36, 0x959b9b], vindicator: [0x959b9b, 0x275e61], evoker: [0x959b9b, 0x1e1c1a], vex: [0x7a90a4, 0xe8edf1],
    ravager: [0x757470, 0x5b5049], guardian: [0x5a8272, 0xf17d30], elder_guardian: [0xceccba, 0x747693], shulker: [0x946794, 0x4d3852], skeleton_horse: [0x68684f, 0xe5e5d8], zombie_horse: [0x315234, 0x97c284] };
  for (const m in EGG) def(m + '_spawn_egg', c => { tpl(c, ['................', '................', '.......###......', '......#bbb#.....', '.....#bbbsb#....', '.....#bsbbb#....', '....#bbbbbbb#...', '....#bbsbbsb#...', '....#bbbbbbb#...', '....#bsbbbbb#...', '....#bbbbsbb#...', '.....#bbbbb#....', '......#####.....', '................', '................', '................'], { '#': mul(H(EGG[m][0]), 0.55), b: EGG[m][0], s: EGG[m][1] }); });
  // block items drawn flat in the game: use a sprite made from the block texture
  const flat = n => c => { const d = Tex.pixels(n); c.data.set(d); };
  // doors: the top and bottom halves squeezed into one icon
  for (const w of WOODS.concat(STEMS, ['bamboo', 'iron'])) def(w + '_door', c => { const top = Tex.pixels(w + '_door_top'), bot = Tex.pixels(w + '_door_bottom'); for (let y = 0; y < 16; y++) for (let x = 4; x < 12; x++) { const src = y < 8 ? top : bot, sy = (y % 8) * 2, sx = (x - 4) * 2, o = (sy * 16 + sx) * 4; c.px(x, y, [src[o], src[o + 1], src[o + 2]], src[o + 3]); } });
  for (const w of WOODS.concat(STEMS, ['bamboo'])) def(w + '_sign', c => { const pl = Tex.pixels(w + '_planks'); for (let y = 2; y < 10; y++) for (let x = 1; x < 15; x++) { const o = (y * 16 + x) * 4; c.px(x, y, [pl[o], pl[o + 1], pl[o + 2]]); } rect(c, 7, 10, 8, 15, 0x6b5128); for (let y = 4; y < 9; y += 2) rect(c, 3, y, 12, y, 0x3a2a14); });
  def('cake', c => { tpl(c, ['................', '................', '................', '................', '................', '...##########...', '..#wwrwwwwrww#..', '..#wwwwwrwwww#..', '..#pppppppppp#..', '..#bbbbbbbbbb#..', '..#bbbbbbbbbb#..', '..############..', '................', '................', '................', '................'], { '#': 0x6a4a2a, w: 0xf4f0ea, r: 0xd8241b, p: 0xe8a4a4, b: 0xc88a4a }); });
  def('cauldron', c => { tpl(c, ['................', '................', '..############..', '..#aaaaaaaaaa#..', '..#a########a#..', '..#a#......#a#..', '..#a#......#a#..', '..#a########a#..', '..#aaaaaaaaaa#..', '..#aaaaaaaaaa#..', '...#aaaaaaaa#...', '..##a#....#a##..', '..####....####..', '................', '................', '................'], { '#': 0x1a1a1a, a: 0x3a3a3a }); });
  def('brewing_stand', c => { rect(c, 7, 2, 8, 12, 0x8a7a5a); rect(c, 6, 1, 9, 2, 0xd4b55a); rect(c, 2, 10, 5, 14, 0xd8e8f0); rect(c, 10, 10, 13, 14, 0xd8e8f0); rect(c, 3, 13, 12, 14, 0x6a6a6a); });
  def('hopper', c => { tpl(c, ['................', '..############..', '..#aaaaaaaaaa#..', '..#a########a#..', '..#aaaaaaaaaa#..', '...#aaaaaaaa#...', '....#aaaaaa#....', '.....#aaaa#.....', '......#aa#......', '......#aa#......', '.......##.......', '................', '................', '................', '................', '................'], { '#': 0x1a1a1a, a: 0x4a4a4a }); });
  def('flower_pot', c => { rect(c, 5, 8, 10, 13, 0x7b3c2a); rect(c, 4, 7, 11, 8, 0x8b4c3a); rect(c, 6, 8, 9, 8, 0x3a2a1a); });
  def('repeater', c => { rect(c, 1, 9, 14, 12, 0xa0a0a0); rect(c, 4, 4, 5, 9, 0xff2a1a); rect(c, 10, 6, 11, 9, 0x6a1a1a); rect(c, 4, 3, 5, 4, 0xff6a5a); });
  def('comparator', c => { rect(c, 1, 9, 14, 12, 0xa0a0a0); rect(c, 3, 5, 4, 9, 0x6a1a1a); rect(c, 11, 5, 12, 9, 0x6a1a1a); rect(c, 7, 6, 8, 9, 0xff2a1a); });
  def('campfire', c => { rect(c, 2, 11, 13, 13, 0x6b5128); rect(c, 3, 8, 12, 10, 0x5a4428); for (let x = 4; x < 12; x++) c.px(x, 5 + (x % 3), H(0xf7a52e)); rect(c, 6, 3, 9, 6, 0xffd45a); });
  def('soul_campfire', c => { P.campfire(c); for (let x = 4; x < 12; x++) c.px(x, 5 + (x % 3), H(0x3fc8e8)); rect(c, 6, 3, 9, 6, 0x8ff0ff); });
  def('bell', c => { blob(c, 7.5, 8, 4.5, [0xc89a10, 0xeac838, 0xfff68a, 0x6b4a00]); rect(c, 3, 11, 12, 12, 0xeac838); rect(c, 7, 2, 8, 3, 0x6a6a6a); });
  def('lantern', c => { const d = Tex.pixels('lantern'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const sx = Math.floor(x / 16 * 6), sy = Math.floor(y / 16 * 9); const o = ((sy) * 16 + sx) * 4; if (x > 3 && x < 12 && y > 2) c.px(x, y, [d[o], d[o + 1], d[o + 2]], d[o + 3]); } });
  def('soul_lantern', c => P.lantern(c));
  for (const n of ['torch', 'soul_torch', 'redstone_torch', 'ladder', 'vine', 'lily_pad', 'rail', 'powered_rail', 'detector_rail', 'activator_rail', 'lever', 'iron_bars', 'chain', 'cobweb', 'sugar_cane', 'kelp', 'seagrass', 'glow_lichen', 'tripwire_hook', 'end_rod', 'lightning_rod', 'pointed_dripstone_down_tip', 'twisting_vines', 'weeping_vines', 'hanging_roots', 'spore_blossom', 'nether_sprouts', 'bamboo_stalk', 'dead_bush', 'big_dripleaf_top', 'small_dripleaf_top']) if (!P[n]) def(n, flat(n));
  def('nether_wart', flat('nether_wart_stage2'));
  def('bamboo', c => { const d = Tex.pixels('bamboo_stalk'); for (let y = 0; y < 16; y++) for (let x = 0; x < 3; x++) { const o = (y * 16 + x) * 4; c.px(x + 6, y, [d[o], d[o + 1], d[o + 2]]); } c.px(9, 3, H(0x4a7a1e)); c.px(10, 2, H(0x4a7a1e)); });
  for (const c of COLORS) { def(c + '_stained_glass_pane', flat(c + '_stained_glass')); def(c + '_bed', cc => { const w = Tex.pixels(c + '_wool'); for (let y = 5; y < 11; y++) for (let x = 1; x < 15; x++) { const o = (y * 16 + x) * 4; cc.px(x, y, [w[o], w[o + 1], w[o + 2]]); } cc.rect(1, 5, 4, 7, H(0xf2f2f2)); cc.rect(1, 11, 14, 12, H(0xa2834f)); cc.rect(1, 13, 2, 14, H(0x6b5128)); cc.rect(13, 13, 14, 14, H(0x6b5128)); }); }
  def('glass_pane', flat('glass'));
  function fallback(name) { return c => { const t = ['cross', 'tall', 'crop'].includes((BLOCKS[BID[name]] || {}).model) ? name : null; if (t && Tex.has(t)) c.data.set(Tex.pixels(t)); else { const k = 7; blob(c, 7.5, 8, 5, [0x8a2a8a, 0xc84ac8, 0xf0a0f0, 0x3a0a3a]); void k; } }; }
  return { def, pixels, has, P, tpl, blob, outline, rect, book, bottle };
})();
