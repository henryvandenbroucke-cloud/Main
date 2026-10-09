'use strict';
/* Chat (T to open, / for commands) and the game's commands. */
const Chat = (() => {
  const lines = []; // { text, color, t }
  let open = false, input = null, history = [], hIdx = -1;
  function add(text, color) { for (const l of String(text).split('\n')) lines.push({ text: l, color: color || '#ffffff', t: performance.now() }); if (lines.length > 100) lines.shift(); }
  function system(t) { add(t, '#ffffff'); }
  function err(t) { add(t, '#ff5555'); }
  function draw(g, S, H, text) {
    const now = performance.now(), maxW = 320 * S;
    let y = H - 48 * S;
    const shown = open ? lines.slice(-20) : lines.filter(l => now - l.t < 10000).slice(-10);
    for (let i = shown.length - 1; i >= 0; i--) {
      const l = shown[i], age = now - l.t;
      const a = open ? 1 : Math.max(0, Math.min(1, (10000 - age) / 1000));
      if (a <= 0) continue;
      g.globalAlpha = a * 0.5; g.fillStyle = '#000'; g.fillRect(2 * S, y - S, maxW, 9 * S); g.globalAlpha = a;
      text(l.text, 4 * S, y, l.color);
      y -= 9 * S;
    }
    g.globalAlpha = 1;
  }
  function openChat(prefix) {
    if (open) return;
    open = true; Input.releaseLock(); UI.screen = { chat: true };
    input = document.createElement('input'); input.id = 'chatInput'; input.value = prefix || ''; input.autocomplete = 'off'; input.spellcheck = false;
    document.body.appendChild(input);
    setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
    input.onkeydown = e => {
      e.stopPropagation();
      if (e.code === 'Escape') close();
      else if (e.code === 'Enter') { const v = input.value.trim(); if (v) { history.push(v); send(v); } close(); }
      else if (e.code === 'ArrowUp') { if (history.length) { hIdx = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1); input.value = history[hIdx]; } e.preventDefault(); }
      else if (e.code === 'ArrowDown') { if (hIdx >= 0) { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; } e.preventDefault(); }
      else if (e.code === 'Tab') { e.preventDefault(); complete(); }
    };
  }
  function close() { if (!open) return; open = false; hIdx = -1; if (input) input.remove(); input = null; UI.screen = null; Input.requestLock(); }
  function complete() {
    const v = input.value;
    if (v.startsWith('/') && !v.includes(' ')) { const m = Object.keys(Commands.list).filter(c => c.startsWith(v.slice(1))); if (m.length === 1) input.value = '/' + m[0] + ' '; else if (m.length) add(m.join(', '), '#aaaaaa'); }
    else { const parts = v.split(' '), last = parts[parts.length - 1]; const cands = (parts[0] === '/give' || parts[0] === '/clear') ? ITEMS.map(i => i.name) : parts[0] === '/summon' ? MOB_LIST : parts[0] === '/effect' ? (typeof Potions !== 'undefined' ? Potions.effectNames() : []) : parts[0] === '/enchant' ? Object.keys(MCDATA.enchantments) : parts[0] === '/setblock' || parts[0] === '/fill' ? BLOCKS.map(b => b.name) : [];
      const m = cands.filter(c => c.startsWith(last.replace('minecraft:', ''))); if (m.length === 1) { parts[parts.length - 1] = m[0]; input.value = parts.join(' ') + ' '; } else if (m.length && m.length < 40) add(m.slice(0, 40).join(', '), '#aaaaaa'); }
  }
  function send(v) {
    if (v.startsWith('/')) { Commands.run(v.slice(1)); return; }
    add('<Player> ' + v);
  }
  return { add, system, err, draw, open: openChat, close, get isOpen() { return open; } };
})();

const DeathMessages = {
  text(p, src, by) {
    const n = 'Player', k = by ? (by.customName || (by.type === 'player' ? 'Player' : (MCDATA.entities[by.type] ? MCDATA.entities[by.type][0] : by.type))) : '';
    switch (src) {
      case 'fall': return p.fallDistance > 5 || true ? `${n} fell from a high place` : `${n} hit the ground too hard`;
      case 'lava': return `${n} tried to swim in lava`;
      case 'inFire': return `${n} went up in flames`;
      case 'onFire': return `${n} burned to death`;
      case 'drown': return `${n} drowned`;
      case 'starve': return `${n} starved to death`;
      case 'inWall': return `${n} suffocated in a wall`;
      case 'cactus': return `${n} was pricked to death`;
      case 'outOfWorld': return `${n} fell out of the world`;
      case 'magic': return `${n} was killed by magic`;
      case 'wither': return `${n} withered away`;
      case 'explosion': return by ? `${n} was blown up by ${k}` : `${n} blew up`;
      case 'hotFloor': return `${n} discovered the floor was lava`;
      case 'sweetBerryBush': return `${n} was poked to death by a sweet berry bush`;
      case 'anvil': return `${n} was squashed by a falling anvil`;
      case 'fallingBlock': return `${n} was squashed by a falling block`;
      case 'fallingStalactite': return `${n} was skewered by a falling stalactite`;
      case 'stalagmite': return `${n} was impaled on a stalagmite`;
      case 'sting': return by ? `${n} was stung to death by ${k}` : `${n} was stung to death`;
      case 'sonic_boom': return by ? `${n} was obliterated by a sonically-charged shriek whilst trying to escape ${k}` : `${n} was obliterated by a sonically-charged shriek`;
      case 'lightning': return `${n} was struck by lightning`;
      case 'freeze': return `${n} froze to death`;
      case 'arrow': return `${n} was shot by ${k || 'an arrow'}`;
      case 'fireball': return `${n} was fireballed by ${k}`;
      case 'thorns': return `${n} was killed trying to hurt ${k}`;
      case 'flyIntoWall': return `${n} experienced kinetic energy`;
      case 'dragonBreath': return `${n} was roasted in dragon's breath`;
      case 'kill': return `${n} was killed`;
      case 'mob': case 'player': return `${n} was slain by ${k}`;
    }
    return by ? `${n} was slain by ${k}` : `${n} died`;
  },
};

const Commands = (() => {
  const p = () => Game.player;
  const coord = (s, base) => { if (s === undefined) return base; if (s.startsWith('~')) return base + (s.length > 1 ? +s.slice(1) : 0); return +s; };
  const strip = s => (s || '').replace(/^minecraft:/, '');
  const ok = t => Chat.add(t, '#aaaaaa');
  const list = {
    help: () => ok('Commands: ' + Object.keys(list).sort().map(c => '/' + c).join(' ')),
    gamemode: a => { const m = { s: 'survival', c: 'creative', a: 'adventure', sp: 'spectator', 0: 'survival', 1: 'creative', 2: 'adventure', 3: 'spectator' }[a[0]] || a[0]; if (!['survival', 'creative', 'adventure', 'spectator'].includes(m)) return Chat.err('Unknown game mode: ' + a[0]); p().setGamemode(m); ok('Set own game mode to ' + m[0].toUpperCase() + m.slice(1) + ' Mode'); },
    time: a => { const v = { day: 1000, noon: 6000, night: 13000, midnight: 18000, sunrise: 23000, sunset: 12000 }[a[1]]; if (a[0] === 'set') { const t = v !== undefined ? v : +a[1]; Game.dayTime = Game.dayTime - (Game.dayTime % 24000) + t; ok('Set the time to ' + t); } else if (a[0] === 'add') { Game.dayTime += +a[1]; ok('Added ' + a[1]); } else if (a[0] === 'query') ok('The time is ' + (a[1] === 'day' ? Math.floor(Game.dayTime / 24000) : Game.dayTime % 24000)); },
    weather: a => { Weather.set(a[0], a[1] ? +a[1] * 20 : 6000 + Math.random() * 12000); ok('Changing to ' + a[0]); },
    give: a => { let who = a[0], name = strip(a[1]), n = +(a[2] || 1); if (!a[1] || (who !== '@s' && who !== '@p' && who !== 'Player' && who !== '@a')) { name = strip(a[0]); n = +(a[1] || 1); } if (IID[name] === undefined) return Chat.err('Unknown item: ' + name); let left = n; while (left > 0) { const k = Math.min(left, ITEMS[IID[name]].stack); left -= k; const l = p().inv.addItem(stack(name, k)); if (l) ItemUse.drop(p(), l); } ok(`Gave ${n} [${ITEMS[IID[name]].display}] to Player`); },
    tp: a => { const q = p(); if (a.length >= 3) { q.x = coord(a[a.length - 3], q.x); q.y = coord(a[a.length - 2], q.y); q.z = coord(a[a.length - 1], q.z); q.vx = q.vy = q.vz = 0; q.fallDistance = 0; ok(`Teleported Player to ${q.x.toFixed(1)}, ${q.y.toFixed(1)}, ${q.z.toFixed(1)}`); } },
    teleport: a => list.tp(a),
    kill: a => { if (!a[0] || a[0] === '@s' || a[0] === '@p') { p().hurt(Infinity, 'kill'); p().health = 0; p().die('kill'); } else if (a[0] === '@e') { for (const e of Entities.list) if (e.type !== 'player') e.removed = true; ok('Killed all entities'); } else { const t = strip(a[0].replace('@e[type=', '').replace(']', '')); let k = 0; for (const e of Entities.list) if (e.type === t) { e.removed = true; k++; } ok('Killed ' + k + ' entities'); } },
    summon: a => { const t = strip(a[0]), q = p(); const x = coord(a[1], q.x), y = coord(a[2], q.y), z = coord(a[3], q.z); if (t === 'lightning_bolt') { Weather.lightning(x, y, z); return; } if (t === 'tnt') { Explosions.spawnTnt(x, y, z, 80); return; } const m = Mobs.spawn(t, x, y, z, { force: true }); if (m) ok('Summoned new ' + t); else Chat.err('Unable to summon ' + t); },
    effect: a => { if (a[0] === 'clear') { p().effects.clear(); p().maxHealth = 20; ok('Removed every effect'); return; } const n = strip(a[0] === 'give' ? a[2] : a[0]), sec = +(a[0] === 'give' ? a[3] || 30 : a[1] || 30), amp = +(a[0] === 'give' ? a[4] || 0 : a[2] || 0); p().addEffect(n, sec * 20, amp); ok('Applied effect ' + n); },
    enchant: a => { const e = strip(a[0] === '@s' || a[0] === '@p' ? a[1] : a[0]), l = +(a[0] === '@s' || a[0] === '@p' ? a[2] || 1 : a[1] || 1); const h = p().inv.held; if (!h) return Chat.err('No item in hand'); if (!MCDATA.enchantments[e]) return Chat.err('Unknown enchantment: ' + e); h.tag = Object.assign({}, h.tag); h.tag.ench = Object.assign({}, h.tag.ench, { [e]: l }); p().inv.changed(); ok('Applied enchantment ' + e); },
    xp: a => { const n = parseInt(a[1] || a[0]); const lv = /l$/i.test(a[1] || a[0]) || a[2] === 'levels'; if (a[0] === 'add' || !isNaN(parseInt(a[0]))) { if (lv) p().addLevels(n); else p().addXp(n); ok('Gave ' + n + (lv ? ' levels' : ' experience')); } },
    experience: a => list.xp(a),
    difficulty: a => { if (!a[0]) return ok('The difficulty is ' + Game.difficulty); if (Game.hardcore) return Chat.err('The difficulty is locked in Hardcore'); Game.difficulty = a[0]; ok('The difficulty has been set to ' + a[0]); },
    gamerule: a => { if (!(a[0] in Game.rules)) return Chat.err('Unknown game rule: ' + a[0]); if (a[1] === undefined) return ok(a[0] + ' = ' + Game.rules[a[0]]); Game.rules[a[0]] = a[1] === 'true' ? true : a[1] === 'false' ? false : +a[1]; ok('Game rule ' + a[0] + ' is now set to: ' + a[1]); },
    seed: () => ok('Seed: [' + Game.seed + ']'),
    spawnpoint: () => { const q = p(); q.spawn = { dim: World.dim, x: q.x, y: q.y, z: q.z }; ok('Set spawn point'); },
    setworldspawn: () => { const q = p(); Game.spawn = [q.x, q.y, q.z]; ok('Set the world spawn point'); },
    setblock: a => { const q = p(); const x = Math.floor(coord(a[0], q.x)), y = Math.floor(coord(a[1], q.y)), z = Math.floor(coord(a[2], q.z)); const b = BID[strip(a[3])]; if (b === undefined) return Chat.err('Unknown block'); World.setBlock(x, y, z, b, 0); Blocks.onPlaced(x, y, z, b, 0, null); ok('Changed the block'); },
    fill: a => { const q = p(); const c = [0, 1, 2, 3, 4, 5].map(i => Math.floor(coord(a[i], [q.x, q.y, q.z][i % 3]))); const b = BID[strip(a[6])]; if (b === undefined) return Chat.err('Unknown block'); let n = 0; for (let x = Math.min(c[0], c[3]); x <= Math.max(c[0], c[3]); x++) for (let y = Math.min(c[1], c[4]); y <= Math.max(c[1], c[4]); y++) for (let z = Math.min(c[2], c[5]); z <= Math.max(c[2], c[5]); z++) { if (n > 32768) break; World.setBlock(x, y, z, b, 0); n++; } ok('Successfully filled ' + n + ' blocks'); },
    clear: a => { const name = a[1] ? strip(a[1]) : null; for (let i = 0; i < 41; i++) { const s = p().inv.get(i); if (s && (!name || ITEMS[s.id].name === name)) p().inv.set(i, null); } p().updateArmor(); ok('Removed items from Player'); },
    locate: a => { const what = strip(a[1] || a[0]); const r = Structures.locate ? Structures.locate(what, p().x, p().z) : null; if (r) ok(`The nearest ${what} is at [${r[0]}, ~, ${r[1]}] (${Math.round(Math.hypot(r[0] - p().x, r[1] - p().z))} blocks away)`); else Chat.err('Could not find a structure of type "' + what + '" nearby'); },
    heal: () => { p().health = p().maxHealth; p().food = 20; p().saturation = 20; ok('Healed'); },
    say: a => Chat.add('[Player] ' + a.join(' ')),
    me: a => Chat.add('* Player ' + a.join(' ')),
    title: a => { HUD.title(a.slice(2).join(' ').replace(/^"|"$/g, '')); },
    playsound: a => Sound.play(strip(a[0]), p()),
    particle: () => {},
    tick: a => { if (a[0] === 'rate') Game.tickRate = +a[1]; },
    worldborder: () => ok('The world border is 60,000,000 blocks wide'),
    defaultgamemode: a => { Game.defaultMode = a[0]; ok('The default game mode is now ' + a[0]); },
    list: () => ok('There are 1 of a max of 1 players online: Player'),
  };
  function run(cmd) {
    const parts = cmd.trim().split(/\s+/), name = parts[0].toLowerCase();
    if (!list[name]) return Chat.err('Unknown or incomplete command, see /help');
    if (!Game.cheats && !['help', 'seed', 'me', 'say', 'list'].includes(name)) return Chat.err('Cheats are not allowed in this world');
    try { list[name](parts.slice(1)); } catch (e) { Chat.err('An error occurred: ' + e.message); console.error(e); }
  }
  return { run, list };
})();
