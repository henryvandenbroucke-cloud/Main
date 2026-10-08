'use strict';
/* The title-screen panorama (a slowly turning view of a real world, like the game's menu background) and
   start-up. */
const Panorama = (() => {
  let active = false, yaw = 0, x = 0, y = 80, z = 0, settled = false;
  const SEED = 'Minecraft Web Edition';
  function start() {
    if (active || Game.running) return;
    active = true; settled = false;
    const seed = seedFromText(SEED);
    World.dim = 'overworld'; World.savedChunks = null;
    World.init(seed, { type: 'default' });
    Clouds.setSeed(seed);
    // look for a high open spot that overlooks its surroundings
    const g = new Overworld(seed), NICE = new Set(['plains', 'meadow', 'cherry_grove', 'sunflower_plains', 'snowy_plains', 'savanna', 'savanna_plateau', 'windswept_hills', 'stony_peaks', 'snowy_slopes', 'grove']);
    let best = -1e9;
    for (let gz = -12; gz <= 12; gz++) for (let gx = -12; gx <= 12; gx++) {
      const cx = gx * 24 + 8, cz = gz * 24 + 8, c = g.column(cx, cz, {}), b = BIOMES[c.biome];
      if (c.h < SEA + 4 || c.h > 150 || !NICE.has(b.name)) continue;
      let lower = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; lower += c.h - g.column(cx + Math.cos(a) * 40, cz + Math.sin(a) * 40, {}).h; }
      const score = lower / 8 + Math.min(c.h - SEA, 40) * 0.3 - Math.hypot(cx, cz) * 0.01;
      if (score > best) { best = score; x = cx + 0.5; z = cz + 0.5; y = c.h + 2.6; }
    }
    if (best === -1e9) { const sp = g.spawnPoint(); x = sp[0]; z = sp[2]; y = sp[1] + 1.6; }
  }
  function stop() { if (!active) return; active = false; Game.stop(); }
  function frame(dt, now) {
    const R = Math.min(Settings.renderDist, 6), pcx = Math.floor(x / 16), pcz = Math.floor(z / 16);
    for (let r = 0; r <= R; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r && !World.getChunk(pcx + dx, pcz + dz)) World.request(pcx + dx, pcz + dz, dx * dx + dz * dz);
    World.pump();
    World.processArrived(5);
    // once the centre chunk is in, stand the camera on the ground (above trees and water)
    if (!settled) { const c = World.getChunk(pcx, pcz); if (c && c.lit) { let h = MAXY; while (h > MINY && !SOLID[World.getBlock(Math.floor(x), h, Math.floor(z))] && !FLUID[World.getBlock(Math.floor(x), h, Math.floor(z))]) h--; y = Math.max(y, h + 2.6); settled = true; } }
    Render.updateMeshes(x, z, 5);
    Tex.refresh();
    Sky.update(1000, 0);
    U.uTime.value = now / 1000;
    U.uSkyLight.value = Sky.skyFactor * 0.95 + 0.05;
    const sk = Sky.skyFactor; U.uSkyTint.value.setRGB(sk * 0.65 + 0.35, sk * 0.65 + 0.35, 1);
    U.uAmbient.value = 0; U.uGamma.value = Settings.gamma; U.uFlicker.value = 1; U.uNV.value = 0;
    const dist = R * 16; U.uFogStart.value = dist - Math.max(4, Math.min(64, dist / 10)) * 2.5; U.uFogEnd.value = dist;
    yaw += dt / 1000 * 0.04;
    camera.position.set(x, y, z); camera.rotation.set(0.1, yaw, 0);
    camera.fov = 85; camera.far = 400; camera.updateProjectionMatrix();
    SkyRender.update('overworld', BIOMES[World.biomeAt(Math.floor(x), Math.floor(z))].sky, null);
    Clouds.update(dt / 1000, camera.position, 'overworld');
    skyCam.quaternion.copy(camera.quaternion); skyCam.fov = camera.fov; skyCam.aspect = camera.aspect; skyCam.updateProjectionMatrix();
    if (UI.page !== 'title') return; // covered by an opaque menu: keep loading, skip drawing
    renderer.autoClear = false; renderer.clear();
    renderer.render(skyScene, skyCam);
    renderer.render(scene, camera);
  }
  return { start, stop, frame, get active() { return active; } };
})();

(function boot() {
  GUI.updateScale();
  U.uTex.value = Tex.build();
  Icons.build();
  Creative.build();
  // menu backgrounds: the options dirt (darkened to a quarter, like the game) and sign planks
  const tile = (name, k) => {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'), im = g.createImageData(16, 16), px = Tex.pixels(name);
    for (let i = 0; i < 1024; i += 4) { im.data[i] = px[i] * k; im.data[i + 1] = px[i + 1] * k; im.data[i + 2] = px[i + 2] * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); return c.toDataURL();
  };
  document.documentElement.style.setProperty('--dirt', `url(${tile('dirt', 0.25)})`);
  document.documentElement.style.setProperty('--planks', `url(${tile('oak_planks', 1)})`);
  Loop.start();
  const q = new URLSearchParams(location.search);
  if (q.has('icons')) { const c = Icons.canvas; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99;width:1008px;background:#8b8b8b'; document.body.appendChild(c); }
  // test hook: ?auto starts a throwaway world straight away (seed, mode, x, z, time, fly, yaw, pitch)
  if (q.has('auto')) {
    World.savedChunks = null;
    Game.start({ seed: seedFromText(q.get('seed') || 'test'), name: 'Test', gamemode: q.get('mode') || 'creative', worldType: q.get('type') || 'default', cheats: true });
    if (q.has('x')) { Game.player.x = +q.get('x'); Game.player.z = +q.get('z'); }
    if (q.has('time')) Game.dayTime = +q.get('time');
    const p = Game.player; p.flying = q.has('fly');
    const give = ['grass_block', 'stone', 'oak_planks', 'oak_log', 'glass', 'torch', 'oak_stairs', 'crafting_table', 'furnace'];
    give.forEach((n, i) => p.inv.set(i, stack(n, 64)));
    if (q.has('yaw')) p.yaw = +q.get('yaw'); if (q.has('pitch')) p.pitch = +q.get('pitch');
    HUD.refresh();
  } else UI.show('title');
})();
