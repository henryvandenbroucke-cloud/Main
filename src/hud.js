'use strict';
/* The in-game HUD, drawn on a 2D canvas in GUI pixels: crosshair, hotbar and off hand, hearts (with poison,
   wither, absorption and hardcore hearts, blinking when hurt and shaking when low), hunger, armour, air,
   the experience bar and level, item names, the action bar, titles, the boss bar, status effects, chat
   and the F3 debug screen. */
const HUD = (() => {
  const cv = document.createElement('canvas'); cv.id = 'hudCanvas'; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  // a frosty border, thick at the edges and clear in the middle (the powder snow outline)
  let frostCanvas = null;
  function frostOverlay() {
    if (frostCanvas) return frostCanvas;
    const w = 192, h = 108, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h);
    let seed = 1234567; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.min(x, w - 1 - x, y * 1.2, (h - 1 - y) * 1.2) / (h * 0.42), e = Math.max(0, 1 - d), n = r();
      const a = e * e * 1.15 + (n - 0.5) * 0.5 * e;
      if (a < 0.12) continue;
      const k = (y * w + x) * 4, f = n * 0.6 + e * 0.4;
      img.data[k] = 165 + 85 * f; img.data[k + 1] = 205 + 45 * f; img.data[k + 2] = 240 + 15 * f; img.data[k + 3] = Math.min(235, a * 255);
    }
    g.putImageData(img, 0, 0);
    return (frostCanvas = c);
  }
  let W = 0, H = 0, S = 2;
  let heldName = '', heldTime = 0, lastHeld = null, action = '', actionTime = 0, title = null, titleTime = 0, sub = '';
  let lastHealth = 20, healthFlash = 0, regenWave = -1, debug = false, totemTime = 0, bossbars = new Map();
  // the pixel font is drawn on an 11-unit em, so 11 px per GUI pixel keeps it crisp; capitals are 7 GUI pixels tall
  const font = n => `${Math.round(11 * S * (n || 1))}px 'Pixelify Sans', monospace`;
  function resize() { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; S = GUI.S; g.imageSmoothingEnabled = false; }
  addEventListener('resize', resize); resize();
  // text in the game's style: white with a dark shadow one GUI pixel down-right
  function text(t, x, y, col, o) {
    o = o || {}; g.font = font(o.scale); g.textBaseline = 'alphabetic'; y += 7 * S * (o.scale || 1);
    if (o.center) x -= g.measureText(t).width / 2;
    if (o.right) x -= g.measureText(t).width;
    if (o.outline) { g.fillStyle = '#000'; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(t, x + dx * S, y + dy * S); }
    else if (o.shadow !== false) { g.fillStyle = shadowOf(col || '#ffffff'); g.fillText(t, x + S, y + S); }
    g.fillStyle = col || '#ffffff'; g.fillText(t, x, y);
    return g.measureText(t).width;
  }
  function shadowOf(c) { if (c[0] !== '#' || c.length < 7) return '#3f3f3f'; const v = parseInt(c.slice(1), 16); const r = (v >> 16 & 255) >> 2, gg = (v >> 8 & 255) >> 2, b = (v & 255) >> 2; return `rgb(${r},${gg},${b})`; }
  function sprite(name, x, y) { GUI.draw(g, name, x, y, S); }
  // the player list (Tab): the game's PlayerTabOverlay, a dark box at the top with each player's face, name and
  // connection bars (a world played alone has just the one player)
  function playerList(p) {
    const name = 'Player', nw = Math.ceil(g.measureText(name).width / S) || 36, w = 9 + nw + 2 + 13, x = Math.floor((W - (w + 2) * S) / 2), y = 10 * S;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - S, y - S, (w + 2) * S, 11 * S);
    g.fillStyle = 'rgba(255,255,255,0.125)'; g.fillRect(x, y, w * S, 8 * S + S);
    const skin = EntityModels.texture('player').canvas;
    if (skin) { g.imageSmoothingEnabled = false; g.drawImage(skin, 8, 8, 8, 8, x, y, 8 * S, 8 * S); g.drawImage(skin, 40, 8, 8, 8, x, y, 8 * S, 8 * S); }
    text(name, x + 9 * S, y, p.spectator ? '#aaaaaa' : '#ffffff');
    // five green bars: no lag in a world played alone
    for (let i = 0; i < 5; i++) { const bh = (i + 1) * 1.5; g.fillStyle = '#000'; g.fillRect(x + (w - 11 + i * 2) * S, y + (8 - bh) * S, 2 * S, bh * S); g.fillStyle = '#55ff55'; g.fillRect(x + (w - 11 + i * 2) * S, y + (8 - bh) * S, S, (bh - 0.5) * S); }
  }
  function item(s, x, y) {
    if (!s) return;
    Icons.drawStack(g, s, x, y, 16 * S);
    const it = ITEMS[s.id];
    if (enchOf(s) || it.name === 'enchanted_golden_apple') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.18 + 0.12 * Math.sin(performance.now() / 300); g.fillStyle = '#8040ff'; g.fillRect(x, y, 16 * S, 16 * S); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (it.dur && s.dmg > 0) { const f = 1 - s.dmg / it.dur; g.fillStyle = '#000'; g.fillRect(x + 2 * S, y + 13 * S, 13 * S, 2 * S); g.fillStyle = `hsl(${Math.round(f * 120)},100%,50%)`; g.fillRect(x + 2 * S, y + 13 * S, Math.round(13 * f) * S, S); }
    if (s.count > 1) text(String(s.count), x + 17 * S, y + 9 * S, '#ffffff', { right: true });
  }
  function frame(a) {
    const p = Game.player;
    if (S !== GUI.S) resize();
    g.clearRect(0, 0, W, H);
    if (!p || !Game.running) return;
    const hud = Settings.hud;
    overlays(p, a);
    // falling asleep: the screen fades to dark
    if (p.sleeping) { const f = Math.min(1, (p.sleepTimer + a) / 100); g.fillStyle = `rgba(16,16,16,${(f * 0.82).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    if (!hud) return;
    const cx = Math.floor(W / 2), bottom = H;
    const spectator = p.spectator;
    // crosshair
    if (!UI.screenOpen() && p.view === 0 && !debug) { g.globalCompositeOperation = 'difference'; g.fillStyle = '#ffffff'; g.fillRect(cx - S * 4.5, H / 2 - S * 0.5, 10 * S, S); g.fillRect(cx - S * 0.5, H / 2 - 4.5 * S, S, 10 * S); g.globalCompositeOperation = 'source-over';
      // attack strength indicator under the crosshair
      const held = p.inv.held, aspd = held ? ITEMS[held.id].aspd : 4, cd = Math.min(1, (p.attackCooldown + a) / (20 / aspd));
      if (cd < 1) { g.fillStyle = '#3f3f3f'; g.fillRect(cx - 8 * S, H / 2 + 9 * S, 16 * S, 2 * S); g.fillStyle = '#ffffff'; g.fillRect(cx - 8 * S, H / 2 + 9 * S, Math.floor(16 * cd) * S, 2 * S); }
    }
    if (!spectator) {
      // hotbar
      const hx = cx - 91 * S, hy = bottom - 22 * S;
      sprite('hotbar', hx, hy);
      sprite('hotbar_sel', hx - S + p.inv.selected * 20 * S, hy - S);
      for (let i = 0; i < 9; i++) item(p.inv.get(i), hx + (3 + i * 20) * S, hy + 3 * S);
      if (p.inv.offhand) { sprite('offhand', hx - 29 * S, hy - S); item(p.inv.offhand, hx - 26 * S, hy + 3 * S); }
      // cooldown overlay (ender pearls, chorus fruit)
      if (p.useCooldown) for (let i = 0; i < 9; i++) { const s = p.inv.get(i); if (!s) continue; const t = p.useCooldown[ITEMS[s.id].name]; if (t && t > Game.gameTime) { g.fillStyle = 'rgba(255,255,255,0.5)'; const f = Math.min(1, (t - Game.gameTime) / 20); g.fillRect(hx + (3 + i * 20) * S, hy + 3 * S + 16 * S * (1 - f), 16 * S, 16 * S * f); } }
      if (!p.creative) survivalBars(p, cx, bottom, a);
      // the name of the held item after switching
      if (heldTime > 0) { const al = Math.min(1, heldTime / 10); g.globalAlpha = al; text(heldName, cx, bottom - (p.creative ? 38 : 59) * S, heldColor, { center: true }); g.globalAlpha = 1; }
    }
    if (actionTime > 0) { g.globalAlpha = Math.min(1, actionTime / 10); text(action, cx, bottom - 68 * S, '#ffffff', { center: true }); g.globalAlpha = 1; }
    if (titleTime > 0 && title) { g.globalAlpha = Math.min(1, titleTime / 10); text(title, cx, H / 2 - 30 * S, titleColor, { center: true, scale: 4 }); if (sub) text(sub, cx, H / 2 + 8 * S, '#ffffff', { center: true, scale: 2 }); g.globalAlpha = 1; }
    bossBars(cx);
    effects(p);
    if (Input.isDown('playerList') && !UI.screenOpen()) playerList(p);
    Chat.draw(g, S, H, text);
    Advancements.drawToasts(g, S, W, text);
    if (debug) debugScreen(p);
    if (Settings.showFps && !debug) text(Loop.fps + ' fps', 2 * S, 2 * S, '#ffffff');
  }
  let heldColor = '#ffffff', titleColor = '#ffffff';
  function survivalBars(p, cx, bottom, a) {
    // experience
    const xy = bottom - 29 * S;
    // riding a saddled horse or camel: the jump bar takes the experience bar's place (the camel's dash cooldown greys it)
    const v = p.vehicle;
    if (v && v.saddled && v.passengers[0] === p && ['horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'camel'].includes(v.type) && (v.tame || v.type === 'camel' || v.type === 'skeleton_horse')) {
      sprite('jump_bg', cx - 91 * S, xy);
      if (v.dashCool > 0) GUI.draw(g, 'jump_cool', cx - 91 * S, xy, S, 182, 5);
      else { const jp = Math.floor((p.jumpRidingScale || 0) * 183); if (jp > 0) GUI.draw(g, 'jump_fg', cx - 91 * S, xy, S, Math.min(182, jp), 5); }
    } else {
      sprite('xp_bg', cx - 91 * S, xy);
      const prog = Math.floor(p.xpProgress * 182);
      if (prog > 0) GUI.draw(g, 'xp_fg', cx - 91 * S, xy, S, prog, 5);
    }
    if (p.xpLevel > 0) text(String(p.xpLevel), cx, xy - 6 * S, '#80ff20', { center: true, outline: true });
    // hearts
    const maxH = Math.ceil(p.maxHealth / 2), absH = Math.ceil(p.absorption / 2), rows = Math.ceil((maxH + absH) / 10), rowGap = Math.max(10 - (rows - 2), 3);
    const hx = cx - 91 * S, hy = bottom - 39 * S;
    const blink = p.invul > 10 && Math.floor(p.invul / 3) % 2 === 1;
    if (p.health < lastHealth && p.invul > 0) healthFlash = p.invul;
    lastHealth = p.health;
    const poison = p.effect('poison'), wither = p.effect('wither');
    const kind = wither ? 'wither' : poison ? 'poison' : p.freeze >= 140 ? 'frozen' : 'full';
    const low = p.health <= 4;
    if (p.effect('regeneration') && p.age % 20 === 0) regenWave = 0;
    for (let i = maxH + absH - 1; i >= 0; i--) {
      const row = Math.floor(i / 10), col = i % 10;
      let x = hx + col * 8 * S, y = hy - row * rowGap * S;
      if (low) y += (Math.floor(Math.random() * 2)) * S;
      if (regenWave >= 0 && i === regenWave) y -= 2 * S;
      sprite(blink ? 'heart_bg_flash' : 'heart_bg', x, y);
      if (Game.hardcore) { g.fillStyle = 'rgba(0,0,0,0)'; }
      if (i < maxH) {
        const v = p.health - i * 2;
        if (v >= 2) sprite('heart_' + kind, x, y); else if (v >= 1) sprite('heart_' + (kind === 'full' ? 'half' : kind + '_half'), x, y);
        if (Game.hardcore && v >= 1) { g.fillStyle = '#ffffff'; g.fillRect(x + 2 * S, y + 2 * S, S, S); }
      } else {
        const v = p.absorption - (i - maxH) * 2;
        if (v >= 2) sprite('heart_absorb', x, y); else if (v >= 1) sprite('heart_absorb_half', x, y);
      }
    }
    if (regenWave >= 0) { regenWave++; if (regenWave > maxH + 5) regenWave = -1; }
    // armour above the hearts
    if (p.armorPts > 0) { const ay = hy - (rows - 1) * rowGap * S - 10 * S; for (let i = 0; i < 10; i++) { const v = p.armorPts - i * 2; sprite(v >= 2 ? 'armor_full' : v === 1 ? 'armor_half' : 'armor_empty', hx + i * 8 * S, ay); } }
    // hunger on the right (or the mount's health)
    const fx = cx + 91 * S - 9 * S, fy = bottom - 39 * S;
    if (p.vehicle && p.vehicle.living && p.vehicle.health) {
      const vh = Math.ceil(p.vehicle.maxHealth / 2);
      for (let i = 0; i < Math.min(vh, 30); i++) { const row = Math.floor(i / 10), x = fx - (i % 10) * 8 * S, y = fy - row * 10 * S; sprite('heart_bg', x, y); const v = p.vehicle.health - i * 2; if (v >= 2) sprite('heart_full', x, y); else if (v >= 1) sprite('heart_half', x, y); }
    } else {
      const hunger = p.effect('hunger');
      for (let i = 0; i < 10; i++) {
        let x = fx - i * 8 * S, y = fy;
        if (p.saturation <= 0 && p.age % (p.food * 3 + 1) === 0) y += (Math.floor(Math.random() * 3) - 1) * S;
        sprite('food_bg', x, y);
        const v = p.food - i * 2;
        if (v >= 2) sprite(hunger ? 'food_hunger' : 'food_full', x, y); else if (v === 1) sprite(hunger ? 'food_hunger_half' : 'food_half', x, y);
      }
    }
    // air bubbles above the hunger bar
    if (p.eyesInWater || p.air < 300) {
      const n = Math.ceil((p.air - 2) * 10 / 300), pop = Math.ceil(p.air * 10 / 300) - n;
      for (let i = 0; i < 10; i++) { const x = fx - i * 8 * S, y = fy - 10 * S; if (i < n) sprite('bubble', x, y); else if (i < n + pop) sprite('bubble_pop', x, y); }
    }
  }
  let portalCanvas = null;
  function overlays(p, a) {
    // vignette darkens the edges a little (more in the dark)
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.18 + (1 - Math.min(1, World.lightLevel(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z)) / 15)) * 0.2})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const helm = p.inv.armor(0);
    if (helm && ITEMS[helm.id].name === 'carved_pumpkin' && p.view === 0) { g.fillStyle = 'rgba(30,15,0,0.85)'; g.fillRect(0, 0, W, H); g.clearRect(W * 0.3, H * 0.35, W * 0.12, H * 0.12); g.clearRect(W * 0.58, H * 0.35, W * 0.12, H * 0.12); g.fillStyle = 'rgba(220,120,20,0.25)'; g.fillRect(W * 0.3, H * 0.35, W * 0.12, H * 0.12); g.fillRect(W * 0.58, H * 0.35, W * 0.12, H * 0.12); }
    // the swirling portal over the view while waiting in a nether portal (the game's renderPortalOverlay)
    if (p.portalTime > 0 && !p.creative) {
      let f = Math.min(1, p.portalTime / 80); if (f < 1) f = f * f * f * 0.8 + 0.2;
      const t = Tex.get('nether_portal'), fr = t.frames ? Math.floor(performance.now() / 100) % t.frames : 0;
      if (!portalCanvas) { portalCanvas = document.createElement('canvas'); portalCanvas.width = portalCanvas.height = 16; }
      const pc = portalCanvas.getContext('2d'), img = pc.createImageData(16, 16); img.data.set(Tex.paint('nether_portal', fr)); pc.putImageData(img, 0, 0);
      g.save(); g.globalAlpha = f; g.imageSmoothingEnabled = false; g.drawImage(portalCanvas, 0, 0, W, H); g.restore();
    }
    if (p.fireTicks > 0 && p.view === 0 && !p.fireImmune) { const t = performance.now() / 80; for (let i = 0; i < 12; i++) { const x = W * (i / 12), h = H * (0.25 + 0.08 * Math.sin(t + i * 1.7)); const gr = g.createLinearGradient(0, H, 0, H - h); gr.addColorStop(0, 'rgba(255,140,20,0.85)'); gr.addColorStop(1, 'rgba(255,220,80,0)'); g.fillStyle = gr; g.fillRect(x, H - h, W / 12 + 2, h); } }
    if (p.eyesInWater) { g.fillStyle = 'rgba(20,40,110,0.18)'; g.fillRect(0, 0, W, H); }
    // freezing: frost creeps in from the edges of the screen
    if (p.freeze > 0 && p.view === 0) { g.save(); g.globalAlpha = Math.min(1, p.freeze / 140); g.imageSmoothingEnabled = false; g.drawImage(frostOverlay(), 0, 0, W, H); g.restore(); }
    if (p.using && ITEMS[p.using.id].name === 'spyglass') { g.fillStyle = '#000'; const r = Math.min(W, H) * 0.45; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); g.fill(); }
    if (p.hurtTime > 0 && p.dead) { g.fillStyle = 'rgba(160,0,0,0.25)'; g.fillRect(0, 0, W, H); }
    if (totemTime > 0) { totemTime--; Icons.draw(g, IID.totem_of_undying, W / 2 - 40 * S * (1 + (40 - totemTime) / 40), H / 2 - 40 * S, 80 * S * (1 + (40 - totemTime) / 40)); }
  }
  function bossBars(cx) {
    let y = 12 * S;
    for (const [, b] of bossbars) {
      text(b.name, cx, y - 9 * S, '#ffffff', { center: true });
      sprite('boss_bg', cx - 91 * S, y);
      GUI.draw(g, b.color ? 'boss_fg_' + b.color : 'boss_fg', cx - 91 * S, y, S, Math.max(0, Math.round(182 * b.progress)), 5);
      y += 19 * S;
    }
  }
  function effects(p) {
    let i = 0, j = 0;
    for (const [n, e] of p.effects) {
      if (e.hidden) continue;
      const good = !['slowness', 'mining_fatigue', 'instant_damage', 'nausea', 'blindness', 'hunger', 'weakness', 'poison', 'wither', 'levitation', 'bad_omen', 'darkness', 'unluck'].includes(n);
      const x = W - (good ? (++i) : (++j)) * 25 * S, y = good ? S : 27 * S;
      // the game's effect frame: grey, or blue for beacon (ambient) effects; the icon fades out in the last 10 seconds
      g.fillStyle = e.ambient ? '#5f84b4' : '#8b8b8b'; g.fillRect(x + S, y + S, 22 * S, 22 * S);
      g.fillStyle = e.ambient ? '#a6c3e8' : '#c6c6c6'; g.fillRect(x + S, y, 22 * S, S); g.fillRect(x, y + S, S, 22 * S);
      g.fillStyle = e.ambient ? '#2c4a74' : '#555555'; g.fillRect(x + S, y + 23 * S, 22 * S, S); g.fillRect(x + 23 * S, y + S, S, 22 * S);
      const a = e.dur > 200 || e.infinite ? 1 : (() => { const t = e.dur / 200, f = Math.max(0, Math.min(1, t)); return f + (1 - f) * (0.5 + Math.cos(e.dur * Math.PI / 5) * 0.25); })();
      g.globalAlpha = Math.max(0, Math.min(1, a));
      if (!EffectIcons.draw(g, n, x + 3 * S, y + 3 * S, S)) { g.fillStyle = '#' + ((typeof Potions !== 'undefined' && Potions.color(n)) || 0xffffff).toString(16).padStart(6, '0'); g.fillRect(x + 6 * S, y + 6 * S, 12 * S, 12 * S); }
      g.globalAlpha = 1;
    }
  }
  function debugScreen(p) {
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const f = ['North (Towards negative Z)', 'East (Towards positive X)', 'South (Towards positive Z)', 'West (Towards negative X)'][Math.floor((((-p.yaw * 180 / Math.PI) % 360 + 360) % 360 + 45) / 90) % 4];
    const c = World.chunkAt(bx, bz), l = World.getLight(bx, by, bz);
    const left = [
      'Minecraft Web Edition (1.21-style)', `${Loop.fps} fps`, `C: ${World.chunks.size} loaded, ${World.pending.size} pending`, `E: ${Entities.list.length}`, '',
      `XYZ: ${p.x.toFixed(3)} / ${p.y.toFixed(5)} / ${p.z.toFixed(3)}`, `Block: ${bx} ${by} ${bz}`, `Chunk: ${bx & 15} ${by & 15} ${bz & 15} in ${bx >> 4} ${by >> 4} ${bz >> 4}`,
      `Facing: ${f} (${(((-p.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180).toFixed(1)} / ${(p.pitch * 180 / Math.PI).toFixed(1)})`,
      `Client Light: ${Math.max((l >> 4) - Sky.skyDarken, l & 15)} (${l >> 4} sky, ${l & 15} block)`,
      `Biome: minecraft:${BIOMES[World.biomeAt3(bx, by, bz)].name}`, `Dimension: minecraft:${World.dim === 'overworld' ? 'overworld' : World.dim === 'nether' ? 'the_nether' : 'the_end'}`,
      `Local Difficulty: ${Game.difficulty}  Day ${Math.floor(Game.dayTime / 24000)}`, `Time: ${Game.dayTime % 24000}`,
    ];
    const t = Interact.target, right = [`Seed: ${Game.seed}`, `Render distance: ${Settings.renderDist}`];
    if (t) { right.push('', `Targeted Block: ${t.x}, ${t.y}, ${t.z}`, `minecraft:${BLOCKS[t.id].name}`, `state: ${t.state}`); }
    if (Interact.entTarget) right.push('', 'Targeted Entity', 'minecraft:' + Interact.entTarget.type);
    g.font = font(); let y = 2 * S;
    for (const s of left) { if (s) { const w = g.measureText(s).width; g.fillStyle = 'rgba(80,80,80,0.55)'; g.fillRect(S, y - S, w + 2 * S, 9 * S); text(s, 2 * S, y, '#e0e0e0', { shadow: false }); } y += 9 * S; }
    y = 2 * S;
    for (const s of right) { if (s) { const w = g.measureText(s).width; g.fillStyle = 'rgba(80,80,80,0.55)'; g.fillRect(W - w - 3 * S, y - S, w + 2 * S, 9 * S); text(s, W - 2 * S, y, '#e0e0e0', { shadow: false, right: true }); } y += 9 * S; }
  }
  function tick() {
    const p = Game.player; if (!p) return;
    const h = p.inv.held;
    const key = h ? h.id + ':' + (h.tag ? JSON.stringify(h.tag) : '') : null;
    if (key !== lastHeld) { lastHeld = key; if (h) { heldName = itemName(h); heldColor = RARITY[ITEMS[h.id].rarity + (enchOf(h) && ITEMS[h.id].rarity < 2 ? 2 - ITEMS[h.id].rarity : 0)] || '#fff'; heldTime = 40; } else heldTime = 0; }
    if (heldTime > 0) heldTime--;
    if (actionTime > 0) actionTime--;
    if (titleTime > 0) titleTime--;
  }
  return {
    frame, tick, refresh() {}, totem() { totemTime = 40; },
    actionBar(t) { action = t; actionTime = 60; },
    title(t, s, col) { title = t; sub = s || ''; titleColor = col || '#ffffff'; titleTime = 70; },
    toggleDebug() { debug = !debug; }, get debug() { return debug; },
    setBoss(id, name, progress, color) { if (progress === null) bossbars.delete(id); else bossbars.set(id, { name, progress, color }); },
    text, get ctx() { return g; },
  };
})();
