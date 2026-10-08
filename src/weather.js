'use strict';
/* Weather like the game: clear spells of 12000-180000 ticks, rain for 12000-24000, and thunder on its own
   timer (3600-15600 ticks when on), showing only while it rains. Rain and snow fall in columns around the
   camera down to the highest block, with splashes; cold biomes get snow, deserts and badlands get none.
   Rain darkens the sky, puts out fires and burning mobs, fills cauldrons; thunderstorms strike lightning
   (setting fires, charging creepers, turning pigs, villagers and mooshrooms). */
const Weather = (() => {
  let rainTime = 0, thunderTime = 0, raining = false, thundering = false, rain = 0, prain = 0, thunder = 0, pthunder = 0, clearTime = 0;
  const rnd2 = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function reset() { raining = false; thundering = false; rain = prain = thunder = pthunder = 0; rainTime = rnd2(12000, 180000); thunderTime = rnd2(12000, 180000); clearTime = 0; }
  reset();
  function tick() {
    if (World.dim !== 'overworld') { Sky.rain = 0; Sky.thunder = 0; return; }
    if (Game.rules.doWeatherCycle) {
      if (clearTime > 0) { clearTime--; raining = thundering = false; }
      else {
        if (--thunderTime <= 0) { thundering = !thundering; thunderTime = thundering ? rnd2(3600, 15600) : rnd2(12000, 180000); }
        if (--rainTime <= 0) { raining = !raining; rainTime = raining ? rnd2(12000, 24000) : rnd2(12000, 180000); }
      }
    }
    prain = rain; pthunder = thunder;
    rain += (raining ? 0.01 : -0.01); rain = Math.max(0, Math.min(1, rain));
    thunder += (thundering && raining ? 0.01 : -0.01); thunder = Math.max(0, Math.min(1, thunder));
    Sky.rain = rain; Sky.thunder = thunder * rain;
    // lightning: the game tries every loaded chunk with a 1 in 100000 chance per tick
    if (thunder > 0.9 && rain > 0.2) { const n = World.chunks.size; if (Math.random() < n / 100000) strikeRandom(); }
    // weather acts on the world: fires go out, snow piles up, water freezes, cauldrons fill
    if (rain > 0.2) worldEffects();
  }
  function precipAt(x, z) { const b = BIOMES[World.biomeAt(Math.floor(x), Math.floor(z))]; return b ? b.precip : 'r'; }
  // the biome's temperature at a height (it drops 0.05 per 30 blocks above y 80): below 0.15 it snows
  function coldAt(x, y, z) { const b = BIOMES[World.biomeAt(Math.floor(x), Math.floor(z))]; if (!b) return false; const t = b.temp - Math.max(0, y - 80) * 0.05 / 30; return t < 0.15; }
  function rainingAt(x, y, z) {
    if (World.dim !== 'overworld' || rain < 0.2) return false;
    const bx = Math.floor(x), bz = Math.floor(z);
    if (World.heightAt(bx, bz) >= Math.floor(y)) return false;
    if (precipAt(x, z) === 'n' || coldAt(x, y, z)) return false;
    return true;
  }
  function strikeRandom() {
    const p = Game.player; if (!p) return;
    const ks = [...World.chunks.values()]; const c = ks[Math.floor(Math.random() * ks.length)]; if (!c) return;
    const x = c.cx * 16 + rnd(16), z = c.cz * 16 + rnd(16); const y = World.heightAt(x, z) + 1;
    if (!rainingAt(x + 0.5, y, z + 0.5) && precipAt(x, z) !== 's') return;
    // lightning rods within 128 blocks attract the strike
    lightning(x + 0.5, y, z + 0.5);
  }
  function lightning(x, y, z, o) {
    o = o || {};
    const bolt = new LightningBolt(x, y, z, o.visualOnly);
    Entities.add(bolt);
    const p = Game.player, d = p ? Math.hypot(p.x - x, p.z - z) : 999;
    Sound.thunder(x, y, z, d < 50);
    if (o.visualOnly) return bolt;
    BlockExtras.lightning(Math.floor(x), Math.floor(y - 0.5), Math.floor(z));
    // fire where it lands (normal and hard)
    if (Game.rules.doFireTick && Game.difficulty !== 'peaceful' && Game.difficulty !== 'easy') {
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      if (World.getBlock(bx, by, bz) === 0 && Place.canSurvive(BID.fire, 0, bx, by, bz)) World.setBlock(bx, by, bz, BID.fire, 0);
      for (let i = 0; i < 4; i++) { const fx = bx + rnd(3) - 1, fy = by + rnd(3) - 1, fz = bz + rnd(3) - 1; if (World.getBlock(fx, fy, fz) === 0 && Place.canSurvive(BID.fire, 0, fx, fy, fz)) World.setBlock(fx, fy, fz, BID.fire, 0); }
    }
    // entities nearby: 5 damage and set alight; some mobs change
    for (const e of Entities.list.concat(p ? [p] : [])) {
      if (!e || e.removed || e === bolt || Math.abs(e.x - x) > 3 || Math.abs(e.z - z) > 3 || e.y < y - 3 || e.y > y + 6) continue;
      if (e.onLightning) { e.onLightning(); continue; }
      if (e.hurt) { e.hurt(5, 'lightning', bolt); e.fireTicks = Math.max(e.fireTicks || 0, 160); }
    }
    return bolt;
  }
  // rain and snow do things to the world near the player (a few random columns per tick)
  function worldEffects() {
    const p = Game.player; if (!p) return;
    for (let k = 0; k < 3; k++) {
      const x = Math.floor(p.x) + rnd(64) - 32, z = Math.floor(p.z) + rnd(64) - 32;
      if (!World.loaded(x, z)) continue;
      const y = World.heightAt(x, z);
      const id = World.getBlock(x, y, z), above = World.getBlock(x, y + 1, z);
      const cold = coldAt(x, y + 1, z), pr = precipAt(x, z);
      if (pr === 'n') continue;
      if (above === BID.fire) World.setBlock(x, y + 1, z, 0, 0);
      if (cold) {
        // snow layers build up to one layer (the game's default snowAccumulationHeight)
        if (above === 0 && SOLID[id] && OPAQUE[id] && World.blockLight(x, y + 1, z) < 10) World.setBlock(x, y + 1, z, BID.snow, 0);
        if (BLOCKS[id].name === 'water' && (World.getState(x, y, z) & 7) === 0 && World.blockLight(x, y + 1, z) < 10) World.setBlock(x, y, z, BID.ice, 0);
      }
      if (BLOCKS[id].name === 'cauldron' && rnd(20) === 0) World.setBlock(x, y, z, cold ? (BID.powder_snow_cauldron || id) : (BID.water_cauldron || id), 1);
    }
  }
  function set(kind, dur) {
    dur = dur || rnd2(6000, 18000);
    if (kind === 'clear') { raining = thundering = false; clearTime = dur; rainTime = dur; thunderTime = dur; }
    if (kind === 'rain') { raining = true; thundering = false; rainTime = dur; clearTime = 0; }
    if (kind === 'thunder') { raining = thundering = true; rainTime = thunderTime = dur; clearTime = 0; }
  }
  function save() { return { rainTime, thunderTime, raining, thundering, rain, thunder, clearTime }; }
  function load(d) { if (!d) { reset(); return; } ({ rainTime, thunderTime, raining, thundering, rain, thunder, clearTime } = Object.assign({ rainTime: 12000, thunderTime: 12000, clearTime: 0 }, d)); prain = rain; pthunder = thunder; }
  return {
    tick, rainingAt, lightning, set, save, load, coldAt, precipAt, reset,
    get rain() { return rain; }, get thunder() { return thunder; }, thundering: () => thundering && raining, isRaining: () => raining,
    level: a => prain + (rain - prain) * (a || 0), thunderLevel: a => pthunder + (thunder - pthunder) * (a || 0),
    get pending() { return null; }, set pending(d) { load(d); },
  };
})();

// ---------------------------------------------------------------- the lightning bolt
class LightningBolt extends Entity {
  constructor(x, y, z, visual) { super('lightning_bolt', x, y, z); this.life = 2; this.flashes = 1 + rnd(3); this.seed = Math.floor(Math.random() * 1e9); this.noPick = true; this.visual = visual; }
  tick() { this.age++; if (--this.life < 0) { if (this.flashes === 0) this.removed = true; else if (this.life < -rnd(10)) { this.flashes--; this.life = 1; this.seed = Math.floor(Math.random() * 1e9); } } }
  get glowing() { return this.life >= 0; }
  save() { return null; }
}

// ---------------------------------------------------------------- drawing rain, snow and lightning
const WeatherRender = (() => {
  // rain and snow textures (64 wide strips, painted in code)
  function stripTex(kind) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    const r = new Rand(kind === 'rain' ? 7 : 11);
    if (kind === 'rain') { for (let i = 0; i < 90; i++) { const x = r.int(64), y = r.int(256), l = 6 + r.int(14); g.fillStyle = `rgba(${150 + r.int(40)},${170 + r.int(40)},255,${0.45 + r.next() * 0.35})`; g.fillRect(x, y, 1, l); if (y + l > 256) g.fillRect(x, 0, 1, y + l - 256); } }
    else { for (let i = 0; i < 70; i++) { const x = r.int(62), y = r.int(254); g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(x, y, 2, 2); if (r.next() < 0.5) g.fillRect(x + 1, y + 2, 1, 1); } }
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const mats = {};
  for (const k of ['rain', 'snow']) {
    mats[k] = new THREE.ShaderMaterial({
      uniforms: Object.assign({ map: { value: stripTex(k) }, uLight: { value: 1 } }, { uFogColor: U.uFogColor, uFogStart: U.uFogStart, uFogEnd: U.uFogEnd }),
      vertexShader: 'in vec3 aShade; out vec2 vUv; out float vA; out float vL; out float vDist; void main(){ vUv = uv; vA = aShade.x; vL = aShade.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'precision highp float; uniform sampler2D map; uniform float uLight; uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd; in vec2 vUv; in float vA; in float vL; in float vDist; out vec4 o; void main(){ vec4 t = texture(map, vUv); if (t.a < 0.05) discard; float f = clamp((vDist - uFogStart)/max(uFogEnd-uFogStart,0.001),0.0,1.0); o = vec4(mix(t.rgb * vL, uFogColor, f), t.a * vA); }',
      glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
  }
  const MAXQ = 21 * 21 * 2;
  function makeMesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXQ * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MAXQ * 4 * 2), 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShade', new THREE.BufferAttribute(new Float32Array(MAXQ * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint32Array(MAXQ * 6); for (let i = 0; i < MAXQ; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); } g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5; scene.add(m); return m;
  }
  const meshes = { rain: makeMesh(mats.rain), snow: makeMesh(mats.snow) };
  // per-column random offsets, like the game's rainSizeX/Z tables
  const R = new Float32Array(32 * 32); for (let i = 0; i < R.length; i++) R[i] = Math.random();
  let splashT = 0;
  function update(a, p) {
    const lvl = Weather.level(a);
    for (const k in meshes) meshes[k].visible = false;
    if (lvl <= 0 || World.dim !== 'overworld') return;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
    const rad = Settings.fastLeaves ? 5 : 10;
    const t = (Game.gameTime + a);
    const counts = { rain: 0, snow: 0 };
    const sky = Math.max(0.2, Sky.skyFactor);
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
      const x = bx + dx, z = bz + dz;
      if (!World.loaded(x, z)) continue;
      const pr = Weather.precipAt(x, z); if (pr === 'n') continue;
      const top = World.heightAt(x, z) + 1;
      let y0 = Math.max(by - rad, top), y1 = Math.max(by + rad, top);
      if (y0 >= y1) continue;
      const cold = Weather.coldAt(x, top, z);
      const k = cold ? 'snow' : 'rain', m = meshes[k], n = counts[k]++;
      if (n >= MAXQ) continue;
      const pos = m.geometry.attributes.position.array, uv = m.geometry.attributes.uv.array, sh = m.geometry.attributes.aShade.array;
      // the quad faces the camera along its column's direction
      const ddx = x + 0.5 - cx, ddz = z + 0.5 - cz, l = Math.hypot(ddx, ddz) || 1, rx = -ddz / l * 0.5, rz = ddx / l * 0.5;
      const ri = R[((x & 31) * 32 + (z & 31))];
      const dist = Math.hypot(ddx, ddz), fade = (1 - dist * dist / (rad * rad)) * 0.5 + 0.5;
      const alpha = (cold ? 1 : 0.9) * lvl * fade;
      let v0, v1, u0 = 0, u1 = 1;
      if (cold) { const sp = ((t * 0.08 + ri * 4) % 32) / 32; v0 = y0 * 0.25 - sp * 8; v1 = y1 * 0.25 - sp * 8; const sx = Math.sin(t * 0.01 + ri * 6) * 0.2; u0 += sx; u1 += sx; }
      else { const sp = ((t * 3 + ri * 32 + (x * 31 + z * 17)) % 32) / 32; v0 = y0 * 0.25 + sp * 8; v1 = y1 * 0.25 + sp * 8; }
      const L = World.getLight(x, Math.max(top, by), z), ll = Math.max(((L >> 4) / 15) * sky, (L & 15) / 15) * 0.85 + 0.15;
      const P4 = [[x + 0.5 - rx, y0, z + 0.5 - rz], [x + 0.5 + rx, y0, z + 0.5 + rz], [x + 0.5 + rx, y1, z + 0.5 + rz], [x + 0.5 - rx, y1, z + 0.5 - rz]];
      const U4 = [[u0 + ri, -v0 / 4], [u1 + ri, -v0 / 4], [u1 + ri, -v1 / 4], [u0 + ri, -v1 / 4]];
      for (let q = 0; q < 4; q++) { pos.set(P4[q], (n * 4 + q) * 3); uv.set(U4[q], (n * 4 + q) * 2); sh.set([alpha, ll, 0], (n * 4 + q) * 3); }
    }
    for (const k in meshes) { const m = meshes[k]; const n = Math.min(counts[k], MAXQ); m.visible = n > 0; m.geometry.setDrawRange(0, n * 6); if (n) { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.uv.needsUpdate = true; m.geometry.attributes.aShade.needsUpdate = true; } }
    // splashes on the ground around the player
    if (++splashT % 2 === 0 && Settings.particles !== 'minimal') for (let i = 0; i < Math.floor(lvl * lvl * 20); i++) {
      const x = bx + rnd(21) - 10, z = bz + rnd(21) - 10; if (!World.loaded(x, z)) continue;
      const y = World.heightAt(x, z); if (y < by - 10 || y > by + 10 || Weather.coldAt(x, y + 1, z) || Weather.precipAt(x, z) === 'n') continue;
      const id = World.getBlock(x, y, z); const h = BLOCKS[id].fluid ? 0.9 : 1;
      if (BLOCKS[id].fluid === 'lava') Particles.smokeAt(x + Math.random(), y + 1, z + Math.random(), 0, 0, 0);
      else Particles.splash(x + Math.random(), y + h, z + Math.random(), 1);
    }
  }
  // lightning: jagged white branches from the sky, lighting everything up for a moment
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xd8d8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const bolts = new Map();
  function boltGeo(b) {
    const r = new Rand(b.seed), segs = [];
    let x = 0, z = 0;
    const pts = []; for (let i = 7; i >= 0; i--) { pts.push([x, i * 16, z]); x += (r.next() - 0.5) * 8; z += (r.next() - 0.5) * 8; }
    pts.reverse();
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1], 0.35]);
    for (let br = 0; br < 3; br++) { let [bx, by, bz] = pts[3 + r.int(4)]; for (let i = 0; i < 4; i++) { const nx = bx + (r.next() - 0.5) * 6, nz = bz + (r.next() - 0.5) * 6, ny = by - 8; segs.push([[bx, by, bz], [nx, ny, nz], 0.2]); bx = nx; by = ny; bz = nz; } }
    const pos = [], idx = [];
    for (const [a, c, w] of segs) for (const [ox, oz] of [[w, 0], [0, w]]) { const s = pos.length / 3; pos.push(a[0] - ox, a[1], a[2] - oz, a[0] + ox, a[1], a[2] + oz, c[0] + ox, c[1], c[2] + oz, c[0] - ox, c[1], c[2] - oz); idx.push(s, s + 1, s + 2, s, s + 2, s + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  }
  let flash = 0;
  function updateBolts() {
    flash = Math.max(0, flash - 0.08);
    const seen = new Set();
    for (const e of Entities.list) {
      if (e.type !== 'lightning_bolt' || e.removed) continue;
      seen.add(e);
      let v = bolts.get(e);
      if (!v || v.seed !== e.seed) { if (v) { scene.remove(v.mesh); v.mesh.geometry.dispose(); } const mesh = new THREE.Mesh(boltGeo(e), boltMat); mesh.position.set(e.x, e.y, e.z); mesh.frustumCulled = false; scene.add(mesh); v = { mesh, seed: e.seed }; bolts.set(e, v); }
      v.mesh.visible = e.glowing; if (e.glowing) flash = 1;
    }
    for (const [e, v] of bolts) if (!seen.has(e)) { scene.remove(v.mesh); v.mesh.geometry.dispose(); bolts.delete(e); }
    return flash;
  }
  return { update, updateBolts, get flash() { return flash; } };
})();
