'use strict';
/* Status effect icons (18x18, drawn in code in the style of the game's mob effect icons): used by the HUD,
   the inventory's effect list and the beacon. */
const EffectIcons = (() => {
  const SIZE = 18, COLS = 8;
  const canvas = document.createElement('canvas'); canvas.width = SIZE * COLS; canvas.height = SIZE * 6;
  const g = canvas.getContext('2d');
  const at = {};
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const shade = (c, f) => { const r = Math.min(255, ((c >> 16) & 255) * f) | 0, gg = Math.min(255, ((c >> 8) & 255) * f) | 0, b = Math.min(255, (c & 255) * f) | 0; return (r << 16) | (gg << 8) | b; };
  // glyphs: 16 rows of 16; 'a' main colour, 'b' light, 'c' dark, 'o' outline, 'w' white, 'k' black, 'r' red, 'y' yellow, 'g' green
  const GL = {
    boot: ['................', '.......oooo.....', '......oaaab.....', '......oaaab.....', '......oaaab.....', '......oaaab.....', '......oaaab.....', '.....oaaaab.....', '....oaaaaaabbbo.', '...oaaaaaaaaaao.', '...oaaaaaaaaaao.', '...occcccccccco.', '....oooooooooo..', '................', '.ww.............', 'ww..............'],
    snail: ['................', '................', '......oooo......', '.....obbaao.....', '....obaacaao....', '....oacaacao....', '....oaacaaao....', '.....oaaaao.....', '..o...oooo...o..', '..oo.oaaaaoooo..', '...occccccccco..', '....oooooooooo..', '................', '................', '................', '................'],
    pick: ['................', '...oooooooo.....', '..obbbbbbbbo....', '..oaaooooaaao...', '...oo.ocoo.oao..', '......oco...oao.', '.....oco.....oo.', '....oco.........', '...oco..........', '..oco...........', '.oco............', '.oo.............', '................', '................', '................', '................'],
    sword: ['................', '............ooo.', '...........obbo.', '..........obao..', '.........obao...', '........obao....', '.......obao.....', '..oo..obao......', '..oaooobao......', '...oaocao.......', '....ocao........', '...ococo........', '..ococ.o........', '..oco...........', '..oo............', '................'],
    heart: ['................', '................', '...ooo...ooo....', '..obbao.obaao...', '.obwbaaoaaaaao..', '.obbaaaaaaaaao..', '.oaaaaaaaaaaao..', '.oaaaaaaaaaaco..', '..oaaaaaaaaco...', '...oaaaaaaco....', '....oaaaaco.....', '.....oaaco......', '......oco.......', '.......o........', '................', '................'],
    arrowup: ['................', '.......oo.......', '......obbo......', '.....obaabo.....', '....obaaaabo....', '...obaaaaaabo...', '...ooooaaoooo...', '......oaao......', '......oaao......', '......oaao......', '......oaao......', '......occo......', '......oooo......', '................', '................', '................'],
    swirl: ['................', '.....oooooo.....', '....oaaaaaao....', '...oao....oao...', '..oao.oooo.oao..', '..oa.oaaaao.ao..', '..oa.oa..oa.ao..', '..oa.oa.oao.ao..', '..oa..oaao..ao..', '..oao......oao..', '...oaoooooooa...', '....oaaaaaaao...', '.....ooooooo....', '................', '................', '................'],
    chest: ['................', '..ooo......ooo..', '.obbaoooooobaao.', '.obaaaaaaaaaaao.', '.oaaaaaaaaaaaao.', '..ooaaaaaaaaoo..', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oaaaaaaaao...', '...occcccccco...', '...oooooooooo...', '................', '................', '................', '................'],
    flame: ['................', '.......o........', '......oyo.......', '......oyyo......', '.....oyyyo...o..', '....oyyrryo.oyo.', '....oyrrrryoyyo.', '...oyrrrrrryyo..', '...oyrraarrryo..', '..oyrraaaarryo..', '..oyrraaaarryo..', '..oyrrraarrryo..', '...oyrrrrrryo...', '....oooooooo....', '................', '................'],
    bubble: ['................', '.....oooo.......', '....owbbao......', '...owbaaaao.....', '...obaaaaao.....', '...oaaaaaco.....', '...oaaaacco.....', '....occcco..ooo.', '.....oooo..owao.', '...........oaco.', '....ooo.....oo..', '...owao.........', '...oaco.........', '....oo..........', '................', '................'],
    figure: ['................', '......oooo......', '.....oaaaao.....', '.....oaaaao.....', '......oaao......', '....oooaaooo....', '...oaaaaaaaao...', '...oaoaaaaoao...', '...oaoaaaaoao...', '...oooaaaaooo...', '.....oaaaao.....', '.....oaooao.....', '.....oaooao.....', '.....oooooo.....', '................', '................'],
    eye: ['................', '................', '................', '.....oooooo.....', '...oowwwwwwoo...', '..owwwwaawwwwo..', '.owwwwakkawwwwo.', '.owwwwakkawwwwo.', '..owwwwaawwwwo..', '...oowwwwwwoo...', '.....oooooo.....', '................', '................', '................', '................', '................'],
    eyeshut: ['................', '................', '................', '................', '................', '..oo........oo..', '...oo......oo...', '....oooooooo....', '...o.o.o.o.o.o..', '................', '................', '................', '................', '................', '................', '................'],
    meat: ['................', '..........oo....', '.........owwo...', '........owwwo...', '.....oooowwo....', '....obbaaoo.....', '...obaaaaao.....', '..obaaaaaaco....', '..oaaaaaaaco....', '..oaaaaaacco....', '..oaaaaacco.....', '...occccco......', '....ooooo.......', '................', '................', '................'],
    drop: ['................', '.......oo.......', '......obao......', '......obao......', '.....obaaao.....', '.....obaaao.....', '....obaaaaao....', '....oaaaaaao....', '...obaaaaaaao...', '...oaaaaaaaco...', '...oaaaaaaaco...', '....oaaaaaco....', '.....occccco....', '......ooooo.....', '................', '................'],
    skull: ['................', '....oooooooo....', '...oaaaaaaaao...', '..oaaaaaaaaaao..', '..oaaaaaaaaaao..', '..oakkaaaakkao..', '..oakkaaaakkao..', '..oaaaaaaaaaao..', '...oaaakkaaao...', '....oaaaaaao....', '....oacacaco....', '....oooooooo....', '................', '................', '................', '................'],
    clover: ['................', '.....oo..oo.....', '....obao.obao...', '....oaaooaaao...', '.....oaaaaao....', '..ooooaaaaoooo..', '.obaaaaaaaaaao..', '.oaaaaaaaaaaco..', '..oooaaaaaooo...', '.....oaaaao.....', '....oaaoaao.....', '....ooo.oo......', '.......oo.......', '........oo......', '.........o......', '................'],
    feather: ['................', '...........oo...', '..........obo...', '.........obao...', '........obaao...', '.......obaaao...', '......obaaao....', '.....obaaao.....', '....obaaao......', '...obaaao.......', '...oaaao........', '..ocooo.........', '.oco............', '.oo.............', '................', '................'],
    fish: ['................', '................', '................', '......oooo......', '....oobbbaoo..o.', '...obwkbaaaaooao', '..obbbbaaaaaaaao', '..oaaaaaaaaaaco.', '...occcaaaccooco', '....ooccccoo..o.', '......oooo......', '................', '................', '................', '................', '................'],
    emerald: ['................', '................', '......oooo......', '.....obbaao.....', '....obbaaaao....', '....obaaaaao....', '....oaaaaaao....', '....oaaaaaao....', '....oaaaaaco....', '.....oaaaco.....', '......oooo......', '................', '................', '................', '................', '................'],
    flag: ['................', '..oooooooooooo..', '..oaaaaaaaaaao..', '..oaawwwwwwaao..', '..oaawkwwkwaao..', '..oaawwwwwwaao..', '..oaaawkkwaaao..', '..oaaaaaaaaaao..', '..oaaaaaaaaaao..', '...oaaaaaaaao...', '....oaaaaaao....', '.....oaaaao.....', '......oooo......', '................', '................', '................'],
    swordbroken: ['................', '................', '................', '...........ooo..', '..........obbo..', '.........obao...', '................', '.......obao.....', '..oo..obao......', '..oaooobao......', '...oaocao.......', '....ocao........', '...ococo........', '..ococ.o........', '..oo............', '................'],
    spiral: ['................', '................', '.....oooooo.....', '...ooaaaaaaoo...', '..oaao....oaao..', '..oao.oooo.oao..', '.oao.oaaaao.oao.', '.oao.oa..ao.oao.', '.oao.oao.ao.oao.', '..oao.ooao.oao..', '..oaao...oaao...', '...ooaaaaaoo....', '.....ooooo......', '................', '................', '................'],
    web: ['................', '.o.....o.....o..', '..o....o....o...', '...o...o...o....', '....ooooooo.....', '....o..o..o.....', '.ooooooooooooo..', '....o..o..o.....', '....ooooooo.....', '...o...o...o....', '..o....o....o...', '.o.....o.....o..', '................', '................', '................', '................'],
    slime: ['................', '................', '....oooooooo....', '...obbaaaaaao...', '..obaaaaaaaaao..', '..oaakkaaakkao..', '..oaakkaaakkao..', '..oaaaaaaaaaao..', '..oaaaakkaaaao..', '..oaaaaaaaaaco..', '...occcccccco...', '....oooooooo....', '................', '................', '................', '................'],
    bug: ['................', '................', '................', '..o..........o..', '...o.oooooo.o...', '....oaaaaaao....', '..ooaakaakaaoo..', '....oaaaaaao....', '..ooaaaaaaaaoo..', '....oaaaaaao....', '...o.oooooo.o...', '..o..........o..', '................', '................', '................', '................'],
    key: ['................', '................', '.......oooo.....', '......obaaao....', '......oa..ao....', '......oa..ao....', '......oaaaao....', '.......oaao.....', '.......oao......', '.......oaoo.....', '.......oaao.....', '.......oao......', '.......oaoo.....', '.......oaao.....', '........oo......', '................'],
    wind: ['................', '................', '...ooooooooo....', '..oaaaaaaaaao...', '...ooooooaaao...', '.........oao....', '.oooooooooo.....', 'oaaaaaaaaaao....', '.oooooooooaao...', '..........oao...', '...ooooooaao....', '..oaaaaaaao.....', '...ooooooo......', '................', '................', '................'],
  };
  // effect -> [glyph, colour]
  const E = {
    speed: ['boot', 0x7cafc6], slowness: ['snail', 0x5a6c81], haste: ['pick', 0xd9c043], mining_fatigue: ['pick', 0x4a4217], strength: ['sword', 0xc0362f],
    instant_health: ['heart', 0xf82423], instant_damage: ['heart', 0x430a09], jump_boost: ['arrowup', 0x22ff4c], nausea: ['swirl', 0x551d4a], regeneration: ['heart', 0xcd5cab],
    resistance: ['chest', 0x9146f0], fire_resistance: ['flame', 0xe49a3a], water_breathing: ['bubble', 0x2e5299], invisibility: ['figure', 0xf6f6f6], blindness: ['eyeshut', 0x1f1f23],
    night_vision: ['eye', 0x1f1fa1], hunger: ['meat', 0x587653], weakness: ['swordbroken', 0x484d48], poison: ['drop', 0x87a363], wither: ['skull', 0x736156],
    health_boost: ['heart', 0xf87d23], absorption: ['heart', 0x2552a5], saturation: ['meat', 0xf82423], glowing: ['figure', 0x94a061], levitation: ['arrowup', 0xceffff],
    luck: ['clover', 0x59c106], unluck: ['clover', 0xc0a44d], slow_falling: ['feather', 0xf3cfb9], conduit_power: ['eye', 0x1dc2d1], dolphins_grace: ['fish', 0x88a3be],
    bad_omen: ['flag', 0x0b6138], hero_of_the_village: ['emerald', 0x44ff44], darkness: ['spiral', 0x292721], trial_omen: ['key', 0x16a6a6], raid_omen: ['flag', 0xde4058],
    wind_charged: ['wind', 0xbdc9ff], weaving: ['web', 0x78695a], oozing: ['slime', 0x99ffa3], infested: ['bug', 0x8c9b8c],
  };
  let i = 0;
  for (const name in E) {
    const [glyph, col] = E[name], rows = GL[glyph], x0 = (i % COLS) * SIZE + 1, y0 = Math.floor(i / COLS) * SIZE + 1;
    const pal = { a: hex(col), b: hex(shade(col, 1.35)), c: hex(shade(col, 0.6)), o: hex(shade(col, 0.28)), w: '#ffffff', k: '#111111', r: '#e8401a', y: '#ffd040', g: '#40c040' };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = rows[y][x]; if (ch !== '.' && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x0 + x, y0 + y, 1, 1); } }
    at[name] = [x0 - 1, y0 - 1]; i++;
  }
  const url = canvas.toDataURL();
  function css(name, k) { const p = at[name]; if (!p) return ''; return `background-image:url(${url});background-position:${-p[0] * k}px ${-p[1] * k}px;background-size:${canvas.width * k}px ${canvas.height * k}px;width:${SIZE * k}px;height:${SIZE * k}px;image-rendering:pixelated;`; }
  function draw(ctx, name, x, y, k) { const p = at[name]; if (!p) return false; ctx.imageSmoothingEnabled = false; ctx.drawImage(canvas, p[0], p[1], SIZE, SIZE, x, y, SIZE * k, SIZE * k); return true; }
  return { css, draw, canvas, has: n => !!at[n] };
})();
