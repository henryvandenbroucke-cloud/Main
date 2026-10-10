'use strict';
/* Menus: the title screen, the world list, world creation, options, the pause menu, the death screen,
   loading screens and sign editing. Keyboard handling while playing lives here too. */
const UI = (() => {
  const root = document.getElementById('menus');
  let page = null, game = false, screen = null;
  const SPLASHES = ['Also try terraria!', 'Pixels!', 'Now in your browser!', '100% blocks!', 'Punch a tree!', 'Watch out for creepers!', 'Diamonds at Y -59!', 'Made in JavaScript!', 'Survive the night!', 'Hello, world!', 'Ender Dragon awaits!', 'Redstone inside!', 'The cake is real!', 'Sheep come in 16 colours!', 'Don\'t dig straight down!', 'Not a shader pack!', 'Plain and simple!', 'As seen on your screen!', 'Infinite worlds!', 'Bring a torch!'];
  const btn = (label, act, o) => `<div class="mbtn${o && o.off ? ' off' : ''}${o && o.small ? ' small' : ''}" data-act="${act}"${o && o.w ? ` style="width:calc(var(--s)*${o.w})"` : ''}>${label}</div>`;
  function show(name, data) {
    if (name === 'title' && !Game.running) Panorama.start();
    page = name; root.classList.remove('hidden');
    root.className = 'menuroot' + (name === 'title' ? ' panorama' + (Panorama.active ? ' live' : '') : game ? ' ingame' : ' dirt');
    root.innerHTML = PAGES[name](data || {});
    for (const b of root.querySelectorAll('[data-act]')) b.addEventListener('click', e => { if (b.classList.contains('off')) return; Sound.ui(); act(b.dataset.act, b, e); });
    if (PAGES[name].after) PAGES[name].after(data || {});
  }
  function hide() { root.classList.add('hidden'); root.innerHTML = ''; page = null; }
  // ---------------------------------------------------------------- pages
  const PAGES = {
    title: () => `<div class="titlelogo"><canvas id="logo"></canvas><div class="splash">${SPLASHES[Math.floor(Math.random() * SPLASHES.length)]}</div><div class="edition">WEB EDITION</div></div>
      <div class="mcol">${btn('Singleplayer', 'single')}${btn('Multiplayer', 'none', { off: true })}${btn('Minecraft Realms', 'none', { off: true })}
      <div class="mrow">${btn('Options...', 'options', { w: 98 })}${btn('Quit Game', 'quit', { w: 98 })}</div></div>
      <div class="tleft">Minecraft Web Edition 1.21</div><div class="tright">Fan-made, not an official Minecraft product.</div>`,
    single: () => `<div class="mtitle">Select World</div><div class="worldlist" id="worldList"><div class="wempty">Loading...</div></div>
      <div class="mbottom"><div class="mrow">${btn('Play Selected World', 'play', { w: 150 })}${btn('Create New World', 'create', { w: 150 })}</div>
      <div class="mrow">${btn('Rename', 'rename', { w: 72 })}${btn('Delete', 'delete', { w: 72 })}${btn('Re-Create', 'recreate', { w: 72 })}${btn('Cancel', 'back', { w: 72 })}</div></div>`,
    create: d => {
      const tab = d.tab || 'game', tb = (id, label) => `<div class="mtab${tab === id ? ' on' : ''}" data-act="ctab:${id}">${label}</div>`;
      let h = `<div class="mtabs">${tb('game', 'Game')}${tb('world', 'World')}${tb('more', 'More')}</div><div class="mcol create">`;
      if (tab === 'game') h += `<div class="mlabel">World Name</div><input class="minput" id="cName" value="${escapeHTML(d.name || 'New World')}" maxlength="32">
        ${btn('Game Mode: ' + modeName(d.mode || 'survival'), 'cmode')}<div class="mhint" id="cModeHint">${modeHint(d.mode || 'survival')}</div>
        ${btn('Difficulty: ' + cap(d.difficulty || 'normal'), 'cdiff', { off: d.mode === 'hardcore' })}${btn('Allow Cheats: ' + (d.cheats ? 'ON' : 'OFF'), 'ccheats', { off: d.mode === 'hardcore' })}
        <div class="mhint">Commands like /gamemode, /experience</div>`;
      if (tab === 'world') h += `${btn('World Type: ' + (d.type === 'flat' ? 'Superflat' : d.type === 'large' ? 'Large Biomes' : d.type === 'amplified' ? 'Amplified' : 'Default'), 'ctype')}
        <div class="mlabel">Seed for the World Generator</div><input class="minput" id="cSeed" value="${escapeHTML(d.seed || '')}" placeholder="Leave blank for a random seed">
        ${btn('Generate Structures: ' + (d.structures === false ? 'OFF' : 'ON'), 'cstruct')}<div class="mhint">Villages, dungeons etc.</div>
        ${btn('Structures: ' + (d.density === 'normal' ? 'Normal' : 'More Common'), 'cdensity')}<div class="mhint">${d.density === 'normal' ? 'The same spacing as the game' : 'About four times as many as the game'}</div>
        ${btn('Bonus Chest: ' + (d.bonus ? 'ON' : 'OFF'), 'cbonus')}`;
      if (tab === 'more') h += `${btn('Game Rules', 'none', { off: true })}${btn('Data Packs', 'none', { off: true })}${btn('Experiments', 'none', { off: true })}`;
      return h + `</div><div class="mbottom"><div class="mrow">${btn('Create New World', 'docreate', { w: 150 })}${btn('Cancel', 'single', { w: 150 })}</div></div>`;
    },
    options: d => `<div class="mtitle">Options</div><div class="mcol wide">
      <div class="mrow">${slider('fov', 'FOV', 30, 110, 1, v => v === 70 ? 'Normal' : v === 110 ? 'Quake Pro' : v)}${btn('Difficulty: ' + cap(game ? Game.difficulty : 'normal'), 'odiff', { w: 150, off: !game || Game.hardcore })}</div>
      <div class="mrow">${btn('Video Settings...', 'video', { w: 150 })}${btn('Controls...', 'controls', { w: 150 })}</div>
      <div class="mrow">${btn('Music & Sounds...', 'sounds', { w: 150 })}${btn('Accessibility Settings...', 'access', { w: 150 })}</div>
      <div class="mrow">${btn('Language...', 'none', { w: 150, off: true })}${btn('Resource Packs...', 'none', { w: 150, off: true })}</div></div>
      <div class="mbottom">${btn('Done', 'optback')}</div>`,
    video: () => `<div class="mtitle">Video Settings</div><div class="mcol wide grid2">
      ${btn('Graphics: ' + (Settings.fastLeaves ? 'Fast' : 'Fancy'), 'tleaves', { w: 150 })}${slider('renderDist', 'Render Distance', 2, 16, 1, v => v + ' chunks')}
      ${btn('Smooth Lighting: ' + (Settings.smooth ? 'ON' : 'OFF'), 'tsmooth', { w: 150 })}${slider('maxFps', 'Max Framerate', 0, 260, 10, v => v === 0 ? 'Unlimited' : v + ' fps')}
      ${btn('View Bobbing: ' + (Settings.bobbing ? 'ON' : 'OFF'), 'tbob', { w: 150 })}${btn('GUI Scale: ' + (Settings.guiScale || 'Auto'), 'tgui', { w: 150 })}
      ${slider('gamma', 'Brightness', 0, 1, 0.01, v => v === 0 ? 'Moody' : v === 1 ? 'Bright' : Math.round(v * 100) + '%')}${btn('Clouds: ' + cap(Settings.clouds), 'tclouds', { w: 150 })}
      ${btn('Particles: ' + cap(Settings.particles), 'tpart', { w: 150 })}${btn('Fullscreen: ' + (document.fullscreenElement ? 'ON' : 'OFF'), 'tfull', { w: 150 })}
      ${btn('Show FPS: ' + (Settings.showFps ? 'ON' : 'OFF'), 'tfps', { w: 150 })}${btn('Biome Blend: 5x5', 'none', { w: 150, off: true })}
      ${btn('Shaders: ' + (Settings.shaders ? 'ON' : 'OFF'), 'tshaders', { w: 150 })}<div class="mhint" style="align-self:center">Waving water with reflections. Slower on weak computers.</div></div>
      <div class="mbottom">${btn('Done', 'options')}</div>`,
    sounds: () => `<div class="mtitle">Music & Sound Options</div><div class="mcol wide grid2">
      ${slider('vMaster', 'Master Volume', 0, 1, 0.01, pct)}${slider('vMusic', 'Music', 0, 1, 0.01, pct)}${slider('vSfx', 'Blocks, Mobs & Players', 0, 1, 0.01, pct)}${slider('vAmbient', 'Ambient/Environment', 0, 1, 0.01, pct)}
      ${btn('Subtitles: ' + (Settings.subtitles ? 'ON' : 'OFF'), 'tsubs', { w: 150 })}</div><div class="mbottom">${btn('Done', 'options')}</div>`,
    access: () => `<div class="mtitle">Accessibility Settings</div><div class="mcol wide grid2">
      ${btn('Auto-Jump: ' + (Settings.autoJump ? 'ON' : 'OFF'), 'tajump', { w: 150 })}${btn('Sprint: ' + (Settings.toggleSprint ? 'Toggle' : 'Hold'), 'tsprint', { w: 150 })}
      ${btn('Sneak: ' + (Settings.toggleCrouch ? 'Toggle' : 'Hold'), 'tsneak', { w: 150 })}${btn('Subtitles: ' + (Settings.subtitles ? 'ON' : 'OFF'), 'tsubs', { w: 150 })}</div>
      <div class="mbottom">${btn('Done', 'options')}</div>`,
    controls: () => {
      const names = { forward: 'Walk Forwards', back: 'Walk Backwards', left: 'Strafe Left', right: 'Strafe Right', jump: 'Jump', sneak: 'Sneak', sprint: 'Sprint', inventory: 'Open/Close Inventory', drop: 'Drop Selected Item', chat: 'Open Chat', command: 'Open Command', swap: 'Swap Item With Offhand', perspective: 'Toggle Perspective', debug: 'Debug Screen', hideHud: 'Hide HUD', playerList: 'List Players', advancements: 'Advancements', screenshot: 'Take Screenshot' };
      let h = '<div class="mtitle">Controls</div><div class="mcol wide">';
      h += `<div class="mrow">${slider('sensitivity', 'Mouse Sensitivity', 0, 1, 0.01, v => v === 0 ? '*yawn*' : v === 1 ? 'HYPERSPEED!!!' : Math.round(v * 200) + '%')}${btn('Invert Mouse: ' + (Settings.invertY ? 'ON' : 'OFF'), 'tinvert', { w: 150 })}</div>`;
      h += '<div class="keylist">';
      for (const k in names) h += `<div class="keyrow"><span>${names[k]}</span>${btn(keyName(Input.BIND[k]), 'bind:' + k, { w: 75 })}</div>`;
      h += '</div></div><div class="mbottom">' + btn('Done', 'options') + '</div>';
      return h;
    },
    pause: () => `<div class="mtitle">Game Menu</div><div class="mcol">${btn('Back to Game', 'resume')}
      <div class="mrow">${btn('Advancements', 'advancements', { w: 98 })}${btn('Statistics', 'stats', { w: 98 })}</div>
      <div class="mrow">${btn('Give Feedback', 'none', { w: 98, off: true })}${btn('Report Bugs', 'none', { w: 98, off: true })}</div>
      <div class="mrow">${btn('Options...', 'options', { w: 98 })}${btn('Open to LAN', 'none', { w: 98, off: true })}</div>
      ${btn('Save and Quit to Title', 'savequit')}</div>`,
    death: () => `<div class="deathbg"></div><div class="mtitle death">${Game.hardcore ? 'Game Over!' : 'You Died!'}</div><div class="deathcause">${escapeHTML(Game.player.deathCause)}</div>
      <div class="deathscore">Score: <span>${Game.player.score}</span></div><div class="mcol">${Game.hardcore ? btn('Spectate World', 'spectate') : btn('Respawn', 'respawn')}${btn('Title Screen', 'deathtitle')}</div>`,
    loading: d => `<div class="mtitle">${d.text || 'Loading terrain...'}</div><div class="loadbar"><i id="loadBar"></i></div><div class="mhint">${d.sub || ''}</div>`,
    confirm: d => `<div class="mtitle">${d.title}</div><div class="mhint big">${d.text}</div><div class="mbottom"><div class="mrow">${btn(d.yes || 'Yes', 'cyes', { w: 150 })}${btn(d.no || 'Cancel', 'cno', { w: 150 })}</div></div>`,
    stats: () => { let h = '<div class="mtitle">Statistics</div><div class="statlist">'; const st = Stats.all(); for (const [k, v] of Object.entries(st.general || {})) h += `<div class="statrow"><span>${k}</span><span>${v}</span></div>`; h += '</div><div class="mbottom">' + btn('Done', 'pause') + '</div>'; return h; },
    advancements: () => Advancements.page(),
    sign: d => { const be = World.getBE(d.x, d.y, d.z) || { lines: [] }, t = d.side === 'back' ? (be.back || { lines: [] }) : be; return `<div class="mtitle">Edit Sign Message</div><div class="signedit">${[0, 1, 2, 3].map(i => `<input class="signline" maxlength="15" data-i="${i}" value="${escapeHTML((t.lines || [])[i] || '')}">`).join('')}</div><div class="mbottom">${btn('Done', 'signdone')}</div>`; },
  };
  PAGES.title.after = () => drawLogo();
  PAGES.single.after = () => listWorlds();
  PAGES.sign.after = d => { const ins = root.querySelectorAll('.signline'); ins[0].focus(); ins.forEach((el, i) => el.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter' || e.code === 'ArrowDown') { (ins[i + 1] || ins[0]).focus(); e.preventDefault(); } if (e.code === 'ArrowUp') { (ins[i - 1] || ins[3]).focus(); e.preventDefault(); } if (e.code === 'Escape') act('signdone'); })); signTarget = d; };
  let leaveBtn = null, signTarget = null, createData = {}, selected = null, confirmFn = null, optionsFrom = 'title', binding = null;
  const pct = v => v === 0 ? 'OFF' : Math.round(v * 100) + '%';
  const cap = s => String(s)[0].toUpperCase() + String(s).slice(1);
  const modeName = m => ({ survival: 'Survival', hardcore: 'Hardcore', creative: 'Creative', spectator: 'Spectator', adventure: 'Adventure' }[m]);
  const modeHint = m => ({ survival: 'Search for resources, craft, gain levels, health and hunger', hardcore: 'Same as Survival Mode, locked at hardest difficulty, and one life only', creative: 'Unlimited resources, free flying and destroy blocks instantly' }[m] || '');
  function keyName(code) { if (!code) return 'None'; return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Left Shift').replace('ControlLeft', 'Left Control').replace('Space', 'Space'); }
  function slider(key, label, min, max, step, fmt) {
    const v = Settings[key], f = (v - min) / (max - min);
    return `<div class="mslider" data-key="${key}" data-min="${min}" data-max="${max}" data-step="${step}" style="width:calc(var(--s)*150)"><i style="left:calc(${f * 100}% - calc(var(--s)*${f * 8}))"></i><span>${label}: ${fmt(v)}</span></div>`;
  }
  function bindSliders() {
    for (const el of root.querySelectorAll('.mslider')) {
      const key = el.dataset.key, min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step;
      const setFrom = e => { const r = el.getBoundingClientRect(); let f = (e.clientX - r.left - 4 * GUI.S) / (r.width - 8 * GUI.S); f = Math.max(0, Math.min(1, f)); let v = min + f * (max - min); v = Math.round(v / step) * step; v = +v.toFixed(3); if (Settings[key] !== v) { Settings[key] = v; Settings.save(); applySettings(); show(page); } };
      el.addEventListener('mousedown', e => { setFrom(e); const mv = ev => setFrom(ev); const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); });
    }
  }
  const origShow = show;
  show = function (name, data) { origShow(name, data); bindSliders(); };
  function applySettings() { GUI.updateScale(); Sound.volumes && Sound.volumes(); if (Game.running) { for (const c of World.chunks.values()) c.dirty.fill(1); } }
  // ---------------------------------------------------------------- actions
  async function act(a, el) {
    switch (a) {
      case 'single': show('single'); break;
      case 'options': if (page === 'title' || page === 'pause') optionsFrom = page; show('options'); break;
      case 'optback': show(optionsFrom === 'pause' ? 'pause' : 'title'); break;
      case 'quit': show('confirm', { title: 'Quit Game?', text: 'You can close this browser tab to quit.', yes: 'OK', no: 'Back' }); confirmFn = () => show('title'); break;
      case 'back': show('title'); break;
      case 'video': case 'controls': case 'sounds': case 'access': show(a); break;
      case 'create': createData = { name: 'New World', mode: 'survival', difficulty: 'normal', cheats: false, seed: '', structures: true, density: 'more', type: 'default' }; show('create', createData); break;
      case 'cmode': readCreate(); createData.mode = { survival: 'hardcore', hardcore: 'creative', creative: 'survival' }[createData.mode]; if (createData.mode === 'creative') createData.cheats = true; if (createData.mode === 'hardcore') createData.cheats = false; show('create', createData); break;
      case 'cdiff': readCreate(); if (createData.mode === 'hardcore') break; createData.difficulty = { peaceful: 'easy', easy: 'normal', normal: 'hard', hard: 'peaceful' }[createData.difficulty]; show('create', createData); break;
      case 'ccheats': readCreate(); if (createData.mode === 'hardcore') break; createData.cheats = !createData.cheats; show('create', createData); break;
      case 'cstruct': readCreate(); createData.structures = !createData.structures; show('create', createData); break;
      case 'cdensity': readCreate(); createData.density = createData.density === 'normal' ? 'more' : 'normal'; show('create', createData); break;
      case 'cbonus': readCreate(); createData.bonus = !createData.bonus; show('create', createData); break;
      case 'ctype': readCreate(); createData.type = { default: 'flat', flat: 'large', large: 'amplified', amplified: 'default' }[createData.type] || 'default'; show('create', createData); break;
      case 'docreate': readCreate(); await createWorld(createData); break;
      case 'play': if (selected) await playWorld(selected); break;
      case 'delete': if (selected) { const s = selected; show('confirm', { title: 'Are you sure you want to delete this world?', text: `'${escapeHTML(s.name)}' will be lost forever! (A long time!)`, yes: 'Delete' }); confirmFn = async () => { await Save.deleteWorld(s.id); selected = null; show('single'); }; } break;
      case 'rename': if (selected) { const n = prompt('World name', selected.name); if (n) { selected.name = n; await Save.putMeta(selected); show('single'); } } break;
      case 'recreate': if (selected) { createData = { name: selected.name + ' (copy)', mode: selected.hardcore ? 'hardcore' : selected.gamemode, difficulty: selected.difficulty, cheats: selected.cheats, seed: String(selected.seed), structures: selected.structures !== false, density: selected.density === 0.5 ? 'more' : 'normal', type: selected.type || 'default' }; show('create', createData); } break;
      case 'cyes': if (confirmFn) { const f = confirmFn; confirmFn = null; await f(); } break;
      case 'cno': show(page === 'confirm' && optionsFrom === 'pause' && game ? 'pause' : 'single'); break;
      case 'resume': resume(); break;
      case 'savequit': await Save.saveGame(); Game.stop(); game = false; Screens.close(true); show('title'); Sound.music && Sound.music('menu'); break;
      case 'respawn': Game.player.respawn(); hide(); Input.requestLock(); break;
      case 'spectate': Game.player.respawn(); Game.player.setGamemode('spectator'); hide(); Input.requestLock(); break;
      case 'deathtitle': if (Game.hardcore) { await Save.deleteWorld(Game.worldId); } else { Game.player.respawn(); await Save.saveGame(); } Game.stop(); game = false; show('title'); break;
      case 'odiff': if (!game || Game.hardcore) break; Game.difficulty = { peaceful: 'easy', easy: 'normal', normal: 'hard', hard: 'peaceful' }[Game.difficulty]; show('options'); break;
      case 'advancements': show('advancements'); break;
      case 'stats': show('stats'); break;
      case 'pause': show('pause'); break;
      case 'signdone': { if (signTarget) { const be = World.getBE(signTarget.x, signTarget.y, signTarget.z) || { type: 'sign' }; const lines = [...root.querySelectorAll('.signline')].map(i => i.value); if (signTarget.side === 'back') be.back = Object.assign(be.back || {}, { lines }); else be.lines = lines; be.type = 'sign'; World.setBE(signTarget.x, signTarget.y, signTarget.z, be); World.markDirty(signTarget.x, signTarget.y, signTarget.z); Signs && Signs.refresh && Signs.refresh(signTarget.x, signTarget.y, signTarget.z); } signTarget = null; hide(); screen = null; Input.requestLock(); break; }
      default:
        if (a.startsWith('ctab:')) { readCreate(); createData.tab = a.slice(5); show('create', createData); break; }
        if (a.startsWith('bind:')) { binding = a.slice(5); el.textContent = '> ' + keyName(Input.BIND[binding]) + ' <'; break; }
        if (a[0] === 't') toggle(a);
    }
  }
  function toggle(a) {
    const T = { tshaders: () => { Settings.shaders = !Settings.shaders; if (typeof applyShaders === 'function') applyShaders(); }, tleaves: () => { Settings.fastLeaves = !Settings.fastLeaves; }, tsmooth: () => { Settings.smooth = !Settings.smooth; }, tbob: () => { Settings.bobbing = !Settings.bobbing; },
      tgui: () => { Settings.guiScale = (Settings.guiScale + 1) % 5; }, tclouds: () => { Settings.clouds = { fancy: 'fast', fast: 'off', off: 'fancy' }[Settings.clouds]; }, tpart: () => { Settings.particles = { all: 'decreased', decreased: 'minimal', minimal: 'all' }[Settings.particles]; },
      tfull: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }, tfps: () => { Settings.showFps = !Settings.showFps; }, tsubs: () => { Settings.subtitles = !Settings.subtitles; },
      tajump: () => { Settings.autoJump = !Settings.autoJump; }, tsprint: () => { Settings.toggleSprint = !Settings.toggleSprint; }, tsneak: () => { Settings.toggleCrouch = !Settings.toggleCrouch; }, tinvert: () => { Settings.invertY = !Settings.invertY; } };
    if (T[a]) { T[a](); Settings.save(); applySettings(); setTimeout(() => show(page), a === 'tfull' ? 150 : 0); }
  }
  function readCreate() { const n = document.getElementById('cName'), s = document.getElementById('cSeed'); if (n) createData.name = n.value; if (s) createData.seed = s.value; }
  async function listWorlds() {
    const el = document.getElementById('worldList');
    const worlds = await Save.listWorlds();
    if (!worlds.length) { el.innerHTML = '<div class="wempty">No worlds yet. Create one!</div>'; return; }
    worlds.sort((a, b) => b.lastPlayed - a.lastPlayed);
    el.innerHTML = worlds.map((w, i) => `<div class="wentry" data-i="${i}"><div class="wicon icon" style="${Icons.style(IID.grass_block, 32 * GUI.S)}"></div><div><div class="wname">${escapeHTML(w.name)}</div><div class="wsub">${escapeHTML(w.folder || w.name)} (${new Date(w.lastPlayed).toLocaleString()})</div><div class="wsub">${w.hardcore ? '<span style="color:#ff5555">Hardcore Mode!</span>' : modeName(w.gamemode) + ' Mode'}${w.cheats ? ', Cheats' : ''}, ${cap(w.difficulty)}</div></div></div>`).join('');
    for (const e of el.querySelectorAll('.wentry')) {
      e.onclick = () => { for (const o of el.querySelectorAll('.wentry')) o.classList.remove('sel'); e.classList.add('sel'); selected = worlds[+e.dataset.i]; };
      e.ondblclick = () => playWorld(worlds[+e.dataset.i]);
    }
    selected = worlds[0]; el.querySelector('.wentry').classList.add('sel');
  }
  async function createWorld(d) {
    const seed = d.seed.trim() ? seedFromText(d.seed) : (Math.random() * 4294967296 | 0) - 2147483648;
    const meta = { id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), name: d.name || 'New World', seed, gamemode: d.mode === 'hardcore' ? 'survival' : d.mode, hardcore: d.mode === 'hardcore', difficulty: d.mode === 'hardcore' ? 'hard' : d.difficulty, cheats: d.cheats, structures: d.structures !== false, density: d.density === 'normal' ? 1 : 0.5, bonus: !!d.bonus, type: d.type || 'default', created: Date.now(), lastPlayed: Date.now() };
    await Save.putMeta(meta);
    startWorld(meta, null);
  }
  async function playWorld(meta) { show('loading', { text: 'Loading world...' }); const state = await Save.loadWorld(meta.id); startWorld(meta, state); }
  function startWorld(meta, state) {
    show('loading', { text: 'Generating world', sub: 'Building terrain' });
    meta.lastPlayed = Date.now(); Save.putMeta(meta);
    Save.begin(meta, state);
    Game.start({ id: meta.id, name: meta.name, seed: meta.seed, gamemode: state ? state.player.gamemode : meta.gamemode, hardcore: meta.hardcore, difficulty: state ? state.difficulty : meta.difficulty, cheats: meta.cheats,
      dayTime: state ? state.dayTime : 0, gameTime: state ? state.gameTime : 0, rules: state ? state.rules : null, spawn: state ? state.spawn : null, player: state ? state.player : null, dim: state ? state.player.dim : 'overworld', worldType: meta.type, structures: meta.structures, density: meta.density || 1, bonus: meta.bonus && !state });
    Sound.music && Sound.music('game');
  }
  // the loading screen stays until the chunks around the player are drawn
  function frame() {
    if (page === 'loading' && Game.running) {
      const p = Game.player, pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
      let have = 0, total = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { total++; const c = World.getChunk(pcx + dx, pcz + dz); if (c && c.lit && !c.dirty.some(x => x)) have++; }
      const bar = document.getElementById('loadBar'); if (bar) bar.style.width = (100 * have / total) + '%';
      if (have >= total && Game.spawnReady && !Portals.arriving) { hide(); Input.requestLock(); Advancements.welcome && Advancements.welcome(); }
    }
    if (page === 'title') { const sp = root.querySelector('.splash'); if (sp) sp.style.transform = `rotate(-20deg) scale(${1.8 - Math.abs(Math.sin(performance.now() / 1000 * Math.PI * 2 / 1.5)) * 0.1})`; }
    const p = Game.player;
    // the Leave Bed button while sleeping
    if (!leaveBtn) { leaveBtn = document.createElement('div'); leaveBtn.className = 'mbtn leavebed hidden'; leaveBtn.textContent = 'Leave Bed'; leaveBtn.onclick = () => { if (Game.player) Beds.wake(Game.player); Input.requestLock(); }; document.body.appendChild(leaveBtn); }
    const sleeping = game && p && p.sleeping && !page;
    leaveBtn.classList.toggle('hidden', !sleeping);
    if (sleeping && Input.locked && !Input.testLock) Input.releaseLock();
    if (game && p && !screen && !page) { const w = Input.consumeWheel(); if (w) { p.inv.selected = (p.inv.selected + w + 9) % 9; } }
    if (Screens.current) Screens.tick();
  }
  function resume() { hide(); Game.paused = false; Input.requestLock(); }
  // ---------------------------------------------------------------- keys while playing
  function onKey(e) {
    if (binding) { Input.BIND[binding] = e.code; Input.saveBinds(); binding = null; show('controls'); e.preventDefault(); return; }
    if (!game) { if (e.code === 'Escape' && page && page !== 'title') { if (page === 'create') show('single'); else if (['video', 'controls', 'sounds', 'access'].includes(page)) show('options'); else if (page === 'options') act('optback'); else show('title'); } return; }
    const p = Game.player; if (!p) return;
    if (Chat.isOpen) return;
    if (page === 'sign') return;
    if (e.code === 'Escape') {
      if (Screens.current) { Screens.close(); return; }
      if (page === 'death') return;
      if (page === 'pause') { resume(); return; }
      if (page) { if (['options', 'video', 'controls', 'sounds', 'access', 'advancements', 'stats'].includes(page)) show(page === 'options' ? 'pause' : page === 'advancements' || page === 'stats' ? 'pause' : 'options'); else resume(); return; }
      Game.paused = true; Input.releaseLock(); show('pause'); return;
    }
    if (Screens.current) {
      // typing in a screen's text box (the anvil's name field)
      const ae = document.activeElement; if (ae && ae.tagName === 'INPUT' && Screens.root.contains(ae)) return;
      if (Slots.key(e)) { e.preventDefault(); return; }
      if (e.code === Input.BIND.inventory) Screens.close();
      return;
    }
    if (page) return;
    if (p.dead) return;
    if (e.code === Input.BIND.inventory) { openInventory(); return; }
    if (/^Digit[1-9]$/.test(e.code)) { if (HUD.debug && Input.keys.has('F3')) return; p.inv.selected = +e.code.slice(5) - 1; return; }
    if (e.code === Input.BIND.drop) { const s = p.inv.held; if (s) { const n = e.ctrlKey ? s.count : 1; ItemUse.drop(p, Object.assign({}, s, { count: n })); s.count -= n; if (s.count <= 0) p.inv.held = null; p.inv.changed(); p.swingArm(); } return; }
    if (e.code === Input.BIND.swap) { const a = p.inv.held, b = p.inv.offhand; p.inv.held = b; p.inv.set(40, a); return; }
    if (e.code === Input.BIND.chat) { e.preventDefault(); Chat.open(''); return; }
    if (e.code === Input.BIND.command) { e.preventDefault(); Chat.open('/'); return; }
    if (e.code === Input.BIND.perspective) { p.view = (p.view + 1) % 3; return; }
    if (e.code === Input.BIND.hideHud) { Settings.hud = !Settings.hud; return; }
    if (e.code === Input.BIND.debug) { HUD.toggleDebug(); return; }
    if (e.code === Input.BIND.advancements) { Game.paused = true; Input.releaseLock(); show('advancements'); return; }
    if (e.code === Input.BIND.screenshot) { const a = document.createElement('a'); a.download = 'screenshot.png'; renderer.domElement.toBlob(b => { a.href = URL.createObjectURL(b); a.click(); }); Chat.system('Saved screenshot'); return; }
  }
  function openInventory() { const p = Game.player; if (p.vehicle && p.vehicle.openInventory && p.sneaking === false && p.vehicle.openInventory(p)) return; Screens.open(p.creative ? new Creative.CreativeScreen() : new InventoryScreen()); }
  function onUnlock() { if (game && !screen && !page && !Chat.isOpen && Game.running && !Game.player.dead) { Game.paused = true; show('pause'); } }
  function drawLogo() {
    const c = document.getElementById('logo'); if (!c) return;
    // block letters: each lit pixel is a small stone cube
    const F = { M: ['10001', '11011', '10101', '10001', '10001'], I: ['111', '010', '010', '010', '111'], N: ['10001', '11001', '10101', '10011', '10001'], E: ['1111', '1000', '1110', '1000', '1111'], C: ['0111', '1000', '1000', '1000', '0111'], R: ['1110', '1001', '1110', '1010', '1001'], A: ['0110', '1001', '1111', '1001', '1001'], F: ['1111', '1000', '1110', '1000', '1000'], T: ['11111', '00100', '00100', '00100', '00100'] };
    const word = 'MINECRAFT', k = 9, depth = 3;
    let w = 0; for (const ch of word) w += (F[ch][0].length + 1) * k; w += depth * 2;
    c.width = w; c.height = 5 * k + depth * 2 + 2;
    const g2 = c.getContext('2d');
    const stoneTex = Tex.pixels('stone');
    let x0 = 0;
    for (const ch of word) {
      const rows = F[ch];
      for (let r = 0; r < 5; r++) for (let q = 0; q < rows[r].length; q++) {
        if (rows[r][q] !== '1') continue;
        const bx = x0 + q * k, by = r * k;
        // dark side extrusion
        g2.fillStyle = '#3a3a3a'; g2.fillRect(bx + depth, by + depth, k, k);
        for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) { const o = (((yy * 16 / k) | 0) * 16 + ((xx * 16 / k) | 0)) * 4; const f = 1.05 - yy / k * 0.25; g2.fillStyle = `rgb(${stoneTex[o] * f | 0},${stoneTex[o + 1] * f | 0},${stoneTex[o + 2] * f | 0})`; g2.fillRect(bx + xx, by + yy, 1, 1); }
      }
      x0 += (rows[0].length + 1) * k;
    }
  }
  function showDeath() { Input.releaseLock(); show('death'); }
  function open(kind, data) { if (kind === 'sign') { Input.releaseLock(); screen = { sign: true }; show('sign', data); } }
  return {
    show, hide, frame, onKey, onUnlock, showDeath, open, resume, openInventory, act,
    inGame: () => game, screenOpen: () => !!screen || !!page || Chat.isOpen,
    enterGame() { game = true; screen = null; },
    get screen() { return screen; }, set screen(v) { screen = v; },
    get page() { return page; }, captureKey: () => false, advancedTooltips: false,
    resize() { if (Screens.current) Screens.rebuild(); if (page && page !== 'loading') show(page); },
  };
})();
