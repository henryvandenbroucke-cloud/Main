'use strict';
/* Interface art drawn in code in the vanilla style (grey bevelled windows, sunken slots, stone buttons,
   hearts, hunger, armour, air bubbles, the hotbar and the experience bar) and the GUI scale. */
const GUI = (() => {
  const sheet = document.createElement('canvas'); sheet.width = 256; sheet.height = 256;
  const g = sheet.getContext('2d');
  const R = {}; // name -> [x, y, w, h]
  let cx = 0, cy = 0, rowH = 0;
  function alloc(name, w, h) { if (cx + w > 256) { cx = 0; cy += rowH + 1; rowH = 0; } R[name] = [cx, cy, w, h]; cx += w + 1; rowH = Math.max(rowH, h); return R[name]; }
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const fill = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function art(name, rows, map) { const [x0, y0] = alloc(name, rows[0].length, rows.length); for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (map[ch]) px(x0 + x, y0 + y, map[ch]); } }
  // hearts
  const HEART = ['.##...##.', '#xx#.#xx#', '#xxx#xxx#', '#xxxxxxx#', '.#xxxxx#.', '..#xxx#..', '...#x#...', '....#....', '.........'];
  const heartFill = (name, light, mid, dark, half) => art(name, HEART.map((r, y) => r.split('').map((ch, x) => { if (ch !== 'x') return ch === '#' ? '.' : '.'; if (half && x > 4) return '.'; if ((y === 1 && (x === 1 || x === 6)) || (y === 2 && x === 1)) return 'L'; if (y >= 4) return 'D'; return 'M'; }).join('')), { L: light, M: mid, D: dark });
  art('heart_bg', HEART, { '#': '#000000', x: '#3a0a0a' });
  art('heart_bg_flash', HEART, { '#': '#ffffff', x: '#3a0a0a' });
  heartFill('heart_full', '#ffaaaa', '#ff1313', '#bb0000'); heartFill('heart_half', '#ffaaaa', '#ff1313', '#bb0000', true);
  heartFill('heart_poison', '#e6f08a', '#94941a', '#5a5a10'); heartFill('heart_poison_half', '#e6f08a', '#94941a', '#5a5a10', true);
  heartFill('heart_wither', '#6a6a6a', '#2a2a2a', '#111111'); heartFill('heart_wither_half', '#6a6a6a', '#2a2a2a', '#111111', true);
  heartFill('heart_absorb', '#fff4a0', '#e8c420', '#b08a10'); heartFill('heart_absorb_half', '#fff4a0', '#e8c420', '#b08a10', true);
  heartFill('heart_frozen', '#c8f0ff', '#6ac0f0', '#2a80c0'); heartFill('heart_frozen_half', '#c8f0ff', '#6ac0f0', '#2a80c0', true);
  // hunger drumsticks
  const FOOD = ['......##.', '.....#bb#', '..####b#.', '.#mmm##..', '#mmmmm#..', '#mmmmm#..', '#mmmm#...', '.####....', '.........'];
  art('food_bg', FOOD.map(r => r.replace(/[bm]/g, 'x')), { '#': '#000000', x: '#3a2a1a' });
  const foodFill = (name, m, mh, half) => art(name, FOOD.map((r, y) => r.split('').map((ch, x) => { if (half && x < 4 && ch !== '.') return '.'; return ch === '#' ? '.' : ch; }).join('')), { m, b: '#e8e4d4', h: mh });
  foodFill('food_full', '#c8761e', '#f0a050'); foodFill('food_half', '#c8761e', '#f0a050', true);
  foodFill('food_hunger', '#6a8a2a', '#9ab84a'); foodFill('food_hunger_half', '#6a8a2a', '#9ab84a', true);
  // armour
  const ARM = ['##.....##', '#x#####x#', '#xxxxxxx#', '.#xxxxx#.', '.#xxxxx#.', '.#xxxxx#.', '.#xxxxx#.', '..#####..', '.........'];
  art('armor_empty', ARM, { '#': '#000000', x: '#3a3a3a' });
  art('armor_full', ARM, { '#': '#000000', x: '#d8d8d8' });
  art('armor_half', ARM.map(r => r.split('').map((ch, x) => ch === 'x' && x > 4 ? 'y' : ch).join('')), { '#': '#000000', x: '#d8d8d8', y: '#3a3a3a' });
  // air bubbles
  const BUB = ['..###....', '.#ccb#...', '#cbbbb#..', '#bbbbb#..', '#bbbbb#..', '.#bbb#...', '..###....', '.........', '.........'];
  art('bubble', BUB, { '#': '#2a5ab8', b: '#4a8af0', c: '#ffffff' });
  art('bubble_pop', ['.#...#...', '..#.#....', '.........', '..#.#....', '.#...#...', '.........', '.........', '.........', '.........'], { '#': '#4a8af0' });
  // slot, window, button textures
  { const [x, y] = alloc('slot', 18, 18); fill(x, y, 18, 18, '#8b8b8b'); fill(x, y, 17, 1, '#373737'); fill(x, y, 1, 17, '#373737'); fill(x + 1, y + 17, 17, 1, '#ffffff'); fill(x + 17, y + 1, 1, 17, '#ffffff'); px(x + 17, y, '#8b8b8b'); px(x, y + 17, '#8b8b8b'); }
  { const [x, y] = alloc('slot_big', 26, 26); fill(x, y, 26, 26, '#8b8b8b'); fill(x, y, 25, 1, '#373737'); fill(x, y, 1, 25, '#373737'); fill(x + 1, y + 25, 25, 1, '#ffffff'); fill(x + 25, y + 1, 1, 25, '#ffffff'); }
  { const [x, y] = alloc('window', 16, 16); fill(x, y, 16, 16, '#c6c6c6'); fill(x + 1, y, 14, 1, '#000'); fill(x + 1, y + 15, 14, 1, '#000'); fill(x, y + 1, 1, 14, '#000'); fill(x + 15, y + 1, 1, 14, '#000');
    fill(x + 1, y + 1, 13, 2, '#fff'); fill(x + 1, y + 1, 2, 13, '#fff'); fill(x + 2, y + 13, 13, 2, '#555'); fill(x + 13, y + 2, 2, 13, '#555'); px(x + 3, y + 3, '#fff'); px(x + 12, y + 12, '#555'); }
  for (const [name, base, hi, lo] of [['button', '#6f6f6f', '#aaaaaa', '#4a4a4a'], ['button_hover', '#7e88bf', '#bcc4f0', '#4a5490'], ['button_off', '#2c2c2c', '#3c3c3c', '#1c1c1c']]) {
    const [x, y] = alloc(name, 64, 20);
    for (let yy = 0; yy < 20; yy++) for (let xx = 0; xx < 64; xx++) { const n = (Math.sin(xx * 12.9898 + yy * 78.233) * 43758.5453) % 1; const v = Math.abs(n); fill(x + xx, y + yy, 1, 1, base); if (v > 0.8 && name !== 'button_off') { g.globalAlpha = 0.18; fill(x + xx, y + yy, 1, 1, v > 0.9 ? '#000' : '#fff'); g.globalAlpha = 1; } }
    fill(x, y, 64, 1, '#000'); fill(x, y + 19, 64, 1, '#000'); fill(x, y, 1, 20, '#000'); fill(x + 63, y, 1, 20, '#000');
    fill(x + 1, y + 1, 62, 1, hi); fill(x + 1, y + 1, 1, 17, hi); fill(x + 1, y + 17, 62, 2, lo); fill(x + 62, y + 1, 1, 17, lo);
    if (name === 'button_hover') { fill(x, y, 64, 1, '#fff'); fill(x, y + 19, 64, 1, '#fff'); fill(x, y, 1, 20, '#fff'); fill(x + 63, y, 1, 20, '#fff'); }
  }
  // hotbar
  { const [x, y] = alloc('hotbar', 182, 22); g.globalAlpha = 0.75; fill(x, y, 182, 22, '#000'); g.globalAlpha = 1; fill(x, y, 182, 1, '#3a3a3a'); fill(x, y + 21, 182, 1, '#3a3a3a'); fill(x, y, 1, 22, '#3a3a3a'); fill(x + 181, y, 1, 22, '#3a3a3a');
    for (let i = 0; i < 9; i++) { const sx = x + 1 + i * 20; g.globalAlpha = 0.55; fill(sx + 1, y + 1, 18, 20, '#8b8b8b'); g.globalAlpha = 1; fill(sx, y + 1, 1, 20, '#5a5a5a'); fill(sx + 19, y + 1, 1, 20, '#aaaaaa'); fill(sx + 1, y + 1, 18, 1, '#5a5a5a'); fill(sx + 1, y + 20, 18, 1, '#aaaaaa'); } }
  { const [x, y] = alloc('hotbar_sel', 24, 24); fill(x, y, 24, 24, '#000'); fill(x + 1, y + 1, 22, 22, '#fff'); fill(x + 2, y + 2, 20, 20, '#7a7a7a'); g.clearRect(x + 3, y + 3, 18, 18); fill(x + 2, y + 2, 20, 1, '#fff'); fill(x + 2, y + 2, 1, 20, '#fff'); px(x, y, 'rgba(0,0,0,0)'); g.clearRect(x, y, 1, 1); g.clearRect(x + 23, y, 1, 1); g.clearRect(x, y + 23, 1, 1); g.clearRect(x + 23, y + 23, 1, 1); }
  { const [x, y] = alloc('offhand', 22, 24); g.globalAlpha = 0.75; fill(x, y, 22, 24, '#000'); g.globalAlpha = 0.55; fill(x + 2, y + 2, 18, 20, '#8b8b8b'); g.globalAlpha = 1; }
  // experience bar
  { const [x, y] = alloc('xp_bg', 182, 5); fill(x, y, 182, 5, '#000'); fill(x + 1, y + 1, 180, 3, '#2a2a2a'); for (let i = 1; i < 18; i++) fill(x + i * 10 + i * 0.1, y + 1, 1, 3, '#000'); }
  { const [x, y] = alloc('xp_fg', 182, 5); fill(x + 1, y + 1, 180, 3, '#80ff20'); fill(x + 1, y + 1, 180, 1, '#c0ff80'); fill(x + 1, y + 3, 180, 1, '#4aa010'); for (let i = 1; i < 18; i++) fill(x + i * 10 + i * 0.1, y + 1, 1, 3, '#2a5a10'); }
  { const [x, y] = alloc('boss_bg', 182, 5); fill(x, y, 182, 5, '#2a0a2a'); fill(x + 1, y + 1, 180, 3, '#4a1a4a'); }
  { const [x, y] = alloc('boss_fg', 182, 5); fill(x, y, 182, 5, '#e830e8'); fill(x, y, 182, 1, '#ff9aff'); fill(x, y + 4, 182, 1, '#a01aa0'); }
  // furnace flame and arrow, brewing bubbles, crafting arrow
  art('flame_off', ['......#.......', '.....##.......', '....###.......', '....####......', '...#####...#..', '...######.##..', '..##########..', '..##########..', '.############.', '.############.', '.############.', '..##########..', '...########...', '....######....'], { '#': '#6b6b6b' });
  art('flame_on', ['......#.......', '.....##.......', '....#y#.......', '....#yy#......', '...#yyy#...#..', '...#yyyy#.##..', '..##yyooy###..', '..#yoooooyy#..', '.#yoorrooyy##.', '.#yorrrroyy#..', '.#oorrrrrooy#.', '..#orrrrroo#..', '...#orrrro#...', '....######....'], { '#': '#c84a10', y: '#ffd84a', o: '#f7a52e', r: '#e8441a' });
  art('arrow_off', ['..............#........', '..............##.......', '##############.##.....', '#.............#..#....', '#..............#..#...', '#...............#..#..', '#................#..#.', '#.................#.#.', '#................#..#.', '#...............#..#..', '#..............#..#...', '#.............#..#....', '##############.##.....', '..............##.......', '..............#........', '.......................'].map(r => r.slice(0, 22)), { '#': '#8b8b8b' });
  art('arrow_on', ['..............#........', '..............##.......', '##############w##.....', '#wwwwwwwwwwwwwwww#....', '#wwwwwwwwwwwwwwwww#...', '#wwwwwwwwwwwwwwwwww#..', '#wwwwwwwwwwwwwwwwwww#.', '#wwwwwwwwwwwwwwwwwwww#', '#wwwwwwwwwwwwwwwwwww#.', '#wwwwwwwwwwwwwwwwww#..', '#wwwwwwwwwwwwwwwww#...', '#wwwwwwwwwwwwwwww#....', '##############w##.....', '..............##.......', '..............#........', '.......................'].map(r => r.slice(0, 22)), { '#': '#ffffff', w: '#ffffff' });
  { const [x, y] = alloc('craft_arrow', 22, 15); g.fillStyle = '#8b8b8b'; g.fillRect(x + 1, y + 5, 14, 5); g.beginPath(); g.moveTo(x + 14, y + 1); g.lineTo(x + 21, y + 7.5); g.lineTo(x + 14, y + 14); g.closePath(); g.fill(); }
  art('brew_bubbles', ['..#..#...#.', '.#.#....#.#', '..#..##...#', '.....##....', '..#....#...', '.#.#..#.#..', '..#....#...', '.....#.....', '....#.#....', '.....#.....'], { '#': '#ffffff' });
  { const [x, y] = alloc('brew_arrow', 9, 28); g.fillStyle = '#ffffff'; g.fillRect(x + 2, y, 5, 22); g.beginPath(); g.moveTo(x, y + 21); g.lineTo(x + 9, y + 21); g.lineTo(x + 4.5, y + 28); g.fill(); }
  { const [x, y] = alloc('blaze_fuel', 18, 4); fill(x, y, 18, 4, '#f7a52e'); fill(x, y, 18, 1, '#ffd84a'); }
  // armour slot outlines (empty helmet, chestplate, leggings, boots, shield)
  const outlineArt = (name, rows) => art(name, rows, { '#': 'rgba(0,0,0,0.28)' });
  outlineArt('empty_helmet', ['................', '................', '................', '....########....', '...#........#...', '...#........#...', '...#..####..#...', '...#.#....#.#...', '...#.#....#.#...', '...###....###...', '................', '................', '................', '................', '................', '................']);
  outlineArt('empty_chest', ['................', '..###......###..', '..#..######..#..', '..#..........#..', '..##........##..', '....#......#....', '....#......#....', '....#......#....', '....#......#....', '....#......#....', '....########....', '................', '................', '................', '................', '................']);
  outlineArt('empty_legs', ['................', '................', '....#########...', '....#.......#...', '....#.......#...', '....#...#...#...', '....#..#.#..#...', '....#..#.#..#...', '....#..#.#..#...', '....#..#.#..#...', '....#..#.#..#...', '....####.####...', '................', '................', '................', '................']);
  outlineArt('empty_boots', ['................', '................', '................', '................', '................', '................', '...###....###...', '...#.#....#.#...', '...#.#....#.#...', '..##.#....#.##..', '..#...#..#...#..', '..#####..#####..', '................', '................', '................', '................']);
  outlineArt('empty_shield', ['................', '...##########...', '...#........#...', '...#........#...', '...#........#...', '...#........#...', '...#........#...', '...#........#...', '...#........#...', '...#........#...', '....#......#....', '.....#....#.....', '......####......', '................', '................', '................']);
  outlineArt('empty_lapis', ['................', '................', '.....######.....', '....#......#....', '...#........#...', '...#........#...', '...#........#...', '....#......#....', '.....#....#.....', '......####......', '................', '................', '................', '................', '................', '................']);
  outlineArt('empty_bottle', ['................', '......####......', '......#..#......', '......#..#......', '.....#....#.....', '....#......#....', '...#........#...', '...#........#...', '...#........#...', '...#........#...', '....#......#....', '.....######.....', '................', '................', '................', '................']);
  outlineArt('empty_blaze', ['................', '..........##....', '.........#..#...', '........#..#....', '.......#..#.....', '......#..#......', '.....#..#.......', '....#..#........', '...#..#.........', '..#..#..........', '..###...........', '................', '................', '................', '................', '................']);
  outlineArt('empty_template', ['................', '...##########...', '...#........#...', '...#.######.#...', '...#.#....#.#...', '...#.#....#.#...', '...#.######.#...', '...#........#...', '...#.######.#...', '...#........#...', '...##########...', '................', '................', '................', '................', '................']);
  // scroll bar handle (creative)
  { const [x, y] = alloc('scroll', 12, 15); fill(x, y, 12, 15, '#c6c6c6'); fill(x, y, 11, 1, '#fff'); fill(x, y, 1, 14, '#fff'); fill(x + 1, y + 14, 11, 1, '#555'); fill(x + 11, y + 1, 1, 14, '#555'); }
  { const [x, y] = alloc('tab', 28, 32); fill(x, y, 28, 32, '#c6c6c6'); fill(x, y, 28, 1, '#000'); fill(x, y, 1, 32, '#000'); fill(x + 27, y, 1, 32, '#000'); fill(x + 1, y + 1, 26, 2, '#fff'); fill(x + 1, y + 1, 2, 30, '#fff'); fill(x + 25, y + 2, 2, 30, '#555'); }
  { const [x, y] = alloc('tab_off', 28, 30); fill(x, y, 28, 30, '#8b8b8b'); fill(x, y, 28, 1, '#000'); fill(x, y, 1, 30, '#000'); fill(x + 27, y, 1, 30, '#000'); fill(x + 1, y + 1, 26, 1, '#bbb'); fill(x + 1, y + 1, 1, 28, '#bbb'); fill(x + 1, y + 29, 26, 1, '#000'); }
  // enchanting offer button
  for (const [name, base] of [['ench_slot', '#c6a6a6'], ['ench_slot_hover', '#d8b0b0'], ['ench_slot_off', '#8b7b7b']]) { const [x, y] = alloc(name, 108, 19); fill(x, y, 108, 19, base); fill(x, y, 108, 1, '#e8d0d0'); fill(x, y, 1, 19, '#e8d0d0'); fill(x, y + 18, 108, 1, '#5a4a4a'); fill(x + 107, y, 1, 19, '#5a4a4a'); }
  const url = sheet.toDataURL();
  // GUI scale: the biggest whole number that keeps a 320x240 GUI on the screen (or the chosen one)
  let S = 2;
  function updateScale() {
    const auto = Math.max(1, Math.min(Math.floor(innerWidth / 320), Math.floor(innerHeight / 240)));
    S = Settings.guiScale ? Math.min(Settings.guiScale, auto) : Math.min(auto, 4);
    document.documentElement.style.setProperty('--s', S + 'px');
    document.documentElement.style.setProperty('--sn', S);
  }
  // CSS for a sprite of the sheet at the current scale
  function css(name, scale) { const r = R[name]; if (!r) return ''; const k = scale || S; return `background-image:url(${url});background-position:${-r[0] * k}px ${-r[1] * k}px;background-size:${256 * k}px ${256 * k}px;width:${r[2] * k}px;height:${r[3] * k}px;`; }
  function draw(ctx2, name, x, y, k, w, h) { const r = R[name]; if (!r) return; ctx2.drawImage(sheet, r[0], r[1], w || r[2], h || r[3], x, y, (w || r[2]) * k, (h || r[3]) * k); }
  // a 9-slice window background drawn on a canvas of w x h GUI pixels
  function windowBg(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x2 = c.getContext('2d');
    x2.fillStyle = '#c6c6c6'; x2.fillRect(0, 0, w, h);
    x2.fillStyle = '#000'; x2.fillRect(2, 0, w - 4, 1); x2.fillRect(2, h - 1, w - 4, 1); x2.fillRect(0, 2, 1, h - 4); x2.fillRect(w - 1, 2, 1, h - 4);
    x2.fillRect(1, 1, 1, 1); x2.fillRect(w - 2, 1, 1, 1); x2.fillRect(1, h - 2, 1, 1); x2.fillRect(w - 2, h - 2, 1, 1);
    x2.fillStyle = '#fff'; x2.fillRect(2, 1, w - 4, 2); x2.fillRect(1, 2, 2, h - 4); x2.fillRect(3, 3, 1, 1);
    x2.fillStyle = '#555'; x2.fillRect(2, h - 3, w - 4, 2); x2.fillRect(w - 3, 2, 2, h - 4); x2.fillRect(w - 4, h - 4, 1, 1);
    x2.clearRect(0, 0, 2, 1); x2.clearRect(0, 0, 1, 2); x2.clearRect(w - 2, 0, 2, 1); x2.clearRect(w - 1, 0, 1, 2); x2.clearRect(0, h - 1, 2, 1); x2.clearRect(0, h - 2, 1, 2); x2.clearRect(w - 2, h - 1, 2, 1); x2.clearRect(w - 1, h - 2, 1, 2);
    return c.toDataURL();
  }
  addEventListener('resize', updateScale);
  return { R, css, draw, sheet, windowBg, updateScale, get S() { return S; } };
})();
