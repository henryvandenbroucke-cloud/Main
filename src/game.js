'use strict';
/* The running world: the 20-ticks-per-second loop, chunk streaming around the player, time of day, game rules
   and difficulty. */
const Game = {
  player: null, running: false, paused: false, dayTime: 0, gameTime: 0, seed: 0, name: '', worldId: null, spawn: [0.5, 80, 0.5],
  difficulty: 'normal', hardcore: false, cheats: true,
  rules: { doDaylightCycle: true, doMobSpawning: true, keepInventory: false, mobGriefing: true, doFireTick: true, naturalRegeneration: true, randomTickSpeed: 3, doWeatherCycle: true, doTileDrops: true, doMobLoot: true, waterSourceConversion: true, showCoordinates: true, playersSleepingPercentage: 100 },
  // hostile mob damage by difficulty: easy = half + 1, hard = 1.5x
  scaleDamage(d) { if (this.difficulty === 'easy') return Math.min(d / 2 + 1, d); if (this.difficulty === 'hard') return d * 1.5; if (this.difficulty === 'peaceful') return 0; return d; },
  start(opts) {
    this.seed = opts.seed; this.name = opts.name; this.worldId = opts.id;
    this.difficulty = opts.difficulty || 'normal'; this.hardcore = !!opts.hardcore; this.cheats = opts.cheats !== false;
    this.dayTime = opts.dayTime || 0; this.gameTime = opts.gameTime || 0;
    if (opts.rules) Object.assign(this.rules, opts.rules);
    World.dim = opts.dim || 'overworld';
    World.init(this.seed);
    Clouds.setSeed(this.seed);
    // the spawn point: a dry land column near 0,0
    if (opts.spawn) this.spawn = opts.spawn;
    else { const g = new Overworld(this.seed); this.spawn = g.spawnPoint(); }
    const p = new Player(this.spawn[0], this.spawn[1], this.spawn[2]);
    this.player = p;
    p.setGamemode(opts.gamemode || 'survival');
    if (opts.player) Save.loadPlayer(p, opts.player);
    p.updateArmor();
    Entities.list.length = 0; Entities.byId.clear();
    this.running = true; this.paused = false;
    this.spawnReady = !!opts.player;
    UI.enterGame();
  },
  stop() { this.running = false; for (const d in World.dims) { for (const c of World.dims[d].values()) for (const m of c.meshes) if (m) Render.disposeSection(m); World.dims[d].clear(); } Entities.list.length = 0; },
  // load chunks in a spiral around the player, and drop the far ones
  stream() {
    const p = this.player; const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16), R = Settings.renderDist + 1;
    let wanted = 0;
    for (let r = 0; r <= R; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (!World.getChunk(pcx + dx, pcz + dz)) { World.request(pcx + dx, pcz + dz, dx * dx + dz * dz); wanted++; }
    }
    // forget queued requests that are now out of range
    for (const [k, v] of World.pending) if (v !== true && !v.sent && (Math.abs(v.cx - pcx) > R || Math.abs(v.cz - pcz) > R)) { World.pending.delete(k); }
    World.genQueue = World.genQueue.filter(k => World.pending.has(k));
    for (const c of World.chunks.values()) if (Math.abs(c.cx - pcx) > R + 2 || Math.abs(c.cz - pcz) > R + 2) { if (c.modified) Save.storeChunk(c); World.unload(c); }
    World.pump();
    return wanted;
  },
  tick() {
    const p = this.player;
    this.gameTime++;
    if (this.rules.doDaylightCycle) this.dayTime++;
    // until the ground under the spawn exists, hold the player still
    if (!this.spawnReady) {
      const c = World.chunkAt(Math.floor(p.x), Math.floor(p.z));
      if (c && c.lit) { let y = MAXY; while (y > MINY && !SOLID[World.getBlock(Math.floor(p.x), y, Math.floor(p.z))]) y--; p.y = p.py = y + 1; this.spawn[1] = y + 1; this.spawnReady = true; }
      else return;
    }
    Sky.update(this.dayTime, 0);
    p.tick();
    Interact.tick(p);
    for (const e of Entities.list) if (!e.removed) { e.tick(); }
    for (let i = Entities.list.length - 1; i >= 0; i--) if (Entities.list[i].removed) { const e = Entities.list[i]; Entities.byId.delete(e.id); if (e.onRemove) e.onRemove(); Entities.list.splice(i, 1); }
    Ticks.tick();
    Mobs.tick();
    Weather.tick();
    Portals.tick(p);
    Sound.tick(p);
    HUD.tick();
  },
};

// ---------------------------------------------------------------- the frame loop
const Loop = (() => {
  let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 0, lastFrame = 0;
  function look(p) {
    const [dx, dy] = Input.consumeLook();
    if (!p || UI.screenOpen() || p.dead || p.sleeping) return;
    const f = Settings.sensitivity * 0.6 + 0.2, k = f * f * f * 8 * 0.15 * Math.PI / 180;
    const spy = p.using && ITEMS[p.using.id].name === 'spyglass' ? 0.125 : 1;
    p.yaw -= dx * k * spy; p.pitch += dy * k * spy * (Settings.invertY ? -1 : 1);
    p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch));
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (Settings.maxFps && now - lastFrame < 1000 / Settings.maxFps - 1) return;
    lastFrame = now;
    let dt = now - last; last = now; if (dt > 250) dt = 250;
    frames++; fpsT += dt; if (fpsT >= 1000) { fps = frames; frames = 0; fpsT = 0; }
    Loop.fps = fps;
    if (!Game.running) { UI.frame(dt); return; }
    const p = Game.player;
    if (!Game.paused) {
      acc += dt;
      let n = 0;
      while (acc >= 50 && n < 5) { Game.tick(); Input.endFrame(); acc -= 50; n++; }
      if (n >= 5) acc = 0;
    }
    look(p);
    const a = Game.paused ? 1 : acc / 50;
    Game.stream();
    // meshes: spend a few milliseconds per frame, more while the world is first loading
    Render.updateMeshes(p.x, p.z, Game.spawnReady ? 6 : 14);
    Tex.refresh();
    // time, lighting and fog uniforms
    Sky.update(Game.dayTime, a);
    U.uTime.value = now / 1000;
    U.uSkyLight.value = World.dim === 'overworld' ? Sky.skyFactor * 0.95 + 0.05 : World.dim === 'end' ? 0 : 0;
    const sk = Sky.skyFactor; U.uSkyTint.value.setRGB(sk * 0.65 + 0.35, sk * 0.65 + 0.35, 1);
    U.uAmbient.value = World.dim === 'nether' ? 0.1 : World.dim === 'end' ? 0 : 0;
    if (World.dim === 'end') { U.uSkyLight.value = 0; U.uAmbient.value = 0.0; }
    U.uGamma.value = Settings.gamma;
    U.uFlicker.value = 1.0 + (Math.random() - 0.5) * 0.02;
    const nv = p.effect('night_vision'); U.uNV.value = nv ? (nv.dur > 200 ? 1 : 0.7 + Math.sin((nv.dur - a) * Math.PI * 0.2) * 0.3) : 0;
    const dist = Settings.renderDist * 16;
    const under = p.eyesInWater ? 'water' : p.eyesInLava ? 'lava' : null;
    if (under === 'water') { U.uFogStart.value = -8; U.uFogEnd.value = 48 * (p.effect('water_breathing') || p.effect('conduit_power') ? 1.5 : 1); }
    else if (under === 'lava') { U.uFogStart.value = p.effect('fire_resistance') ? 0 : 0.25; U.uFogEnd.value = p.effect('fire_resistance') ? 5 : 1; }
    else if (World.dim === 'nether') { U.uFogStart.value = dist * 0.05; U.uFogEnd.value = Math.min(96, dist * 0.5); }
    else if (p.effect('blindness') || p.effect('darkness')) { U.uFogStart.value = 0; U.uFogEnd.value = 5; }
    else { U.uFogStart.value = dist - Math.max(4, Math.min(64, dist / 10)) * 2.5; U.uFogEnd.value = dist; }
    p.updateCamera(a);
    camera.far = Math.max(256, dist * 1.6);
    camera.updateProjectionMatrix();
    SkyRender.update(World.dim, BIOMES[World.biomeAt(Math.floor(p.x), Math.floor(p.z))].sky, under);
    Clouds.update(dt / 1000, camera.position, World.dim);
    EntityRender && EntityRender.update(a);
    Hand && Hand.update(a, p);
    Particles.tick && Particles.render && Particles.render(a);
    // draw: sky first, then the world
    skyCam.quaternion.copy(camera.quaternion); skyCam.fov = camera.fov; skyCam.aspect = camera.aspect; skyCam.updateProjectionMatrix();
    renderer.autoClear = false; renderer.clear();
    if (World.dim !== 'nether' && !under) renderer.render(skyScene, skyCam);
    renderer.render(scene, camera);
    Hand && Hand.render && Hand.render();
    HUD.frame(a);
    UI.frame(dt);
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    UI.resize && UI.resize(w, h);
  }
  addEventListener('resize', resize);
  return { start() { resize(); requestAnimationFrame(frame); }, fps: 0 };
})();
let EntityRender = null, Hand = null;
