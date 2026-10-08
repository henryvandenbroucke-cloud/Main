'use strict';
/* Rendering in the plain vanilla style: no shadows, bloom or post-processing. Blocks use the game's lightmap
   (sky light dimmed by the time of day, warm block light, the brightness slider), per-face shading, smooth
   lighting and distance fog. The sky has the vanilla colours, a square sun and moon with phases, stars, a
   sunrise glow and blocky clouds. */
const canvasEl = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(1);
renderer.outputEncoding = THREE.LinearEncoding;
renderer.sortObjects = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
camera.rotation.order = 'YXZ';
scene.add(camera);
const skyScene = new THREE.Scene(), skyCam = new THREE.PerspectiveCamera(70, 1, 0.5, 400); skyCam.rotation.order = 'YXZ';

const LIGHT_GLSL = `
uniform float uSkyLight; uniform vec3 uSkyTint; uniform float uGamma; uniform float uAmbient; uniform float uNV; uniform float uFlicker; uniform float uDark; uniform float uForceBright;
float lmBr(float f){ return mix(f / (4.0 - 3.0 * f), 1.0, uAmbient); }
vec3 lightmap(float sky, float blk){
  float s = lmBr(sky) * uSkyLight;
  float b = lmBr(blk) * uFlicker;
  vec3 bl = vec3(b, b * ((b * 0.6 + 0.4) * 0.6 + 0.4), b * (b * b * 0.6 + 0.4));
  vec3 lm = bl + uSkyTint * s;
  lm = mix(lm, vec3(0.75), 0.04);
  // the End's lightmap is forced bright (DimensionSpecialEffects.forceBrightLightmap)
  if (uForceBright > 0.0) lm = mix(lm, vec3(0.99, 1.12, 1.0), 0.25);
  lm = clamp(lm, 0.0, 1.0);
  if (uNV > 0.0) { float m = max(lm.r, max(lm.g, lm.b)); lm = mix(lm, lm / max(m, 0.001), uNV); }
  vec3 g = 1.0 - pow(1.0 - lm, vec3(4.0));
  lm = mix(lm, g, uGamma);
  lm = mix(lm, vec3(0.75), 0.04);
  return clamp(lm, 0.0, 1.0) * (1.0 - uDark);
}`;
const U = {
  uTex: { value: null }, uTime: { value: 0 }, uSkyLight: { value: 1 }, uSkyTint: { value: new THREE.Color(1, 1, 1) }, uGamma: { value: 0.5 }, uAmbient: { value: 0 }, uNV: { value: 0 },
  uFlicker: { value: 1 }, uDark: { value: 0 }, uForceBright: { value: 0 }, uFogColor: { value: new THREE.Color(0xc0d8ff) }, uFogStart: { value: 100 }, uFogEnd: { value: 128 },
};
const VOX_VERT = `
in vec4 aUV; in vec4 aLight; in vec4 aColor;
uniform float uTime;
out vec3 vUV; out vec2 vL; out float vShade; out vec3 vColor; out float vDist;
void main(){
  float layer = aUV.z;
  if (aUV.w > 0.5) layer += mod(floor(uTime * 10.0), aUV.w);
  vUV = vec3(aUV.xy, layer); vL = aLight.xy; vShade = aLight.z; vColor = aColor.rgb;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const VOX_FRAG = `
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uTex; uniform float uMode; uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd;
${LIGHT_GLSL}
in vec3 vUV; in vec2 vL; in float vShade; in vec3 vColor; in float vDist;
out vec4 fragColor;
void main(){
  vec4 t = texture(uTex, vUV);
  vec3 c;
  if (uMode < 0.5) c = mix(t.rgb * vColor, t.rgb, t.a);
  else { if (uMode < 1.5 && t.a < 0.5) discard; if (uMode > 1.5 && t.a < 0.01) discard; c = t.rgb * vColor; }
  c *= lightmap(vL.x, vL.y) * vShade;
  float fog = clamp((vDist - uFogStart) / max(uFogEnd - uFogStart, 0.001), 0.0, 1.0);
  c = mix(c, uFogColor, fog);
  fragColor = vec4(c, uMode > 1.5 ? t.a : 1.0);
}`;
function voxMat(mode) {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uMode: { value: mode } }), vertexShader: VOX_VERT, fragmentShader: VOX_FRAG, glslVersion: THREE.GLSL3,
    transparent: mode === 2, depthWrite: mode !== 2, side: THREE.FrontSide,
  });
  for (const k in U) m.uniforms[k] = U[k];
  return m;
}
const MATS = [voxMat(0), voxMat(1), voxMat(2)];

// entities: a box model lit by one light value (sky, block) and the same lightmap and fog
const ENT_VERT = `
uniform float uTime;
out vec2 vUv; out float vShade; out float vDist;
void main(){
  vUv = uv;
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vShade = n.y > 0.5 ? 1.0 : n.y < -0.5 ? 0.5 : (abs(n.z) > abs(n.x) ? 0.8 : 0.6);
  vShade = mix(vShade, 1.0, 0.25);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const ENT_FRAG = `
precision highp float;
uniform sampler2D map; uniform vec2 uEnv; uniform vec3 uTint; uniform float uFlash; uniform float uOpacity; uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd; uniform float uGlow;
${LIGHT_GLSL}
in vec2 vUv; in float vShade; in float vDist;
out vec4 fragColor;
void main(){
  vec4 t = texture(map, vUv);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * uTint;
  vec3 lm = mix(lightmap(uEnv.x, uEnv.y), vec3(1.0), uGlow);
  c *= lm * mix(vShade, 1.0, uGlow);
  c = mix(c, vec3(1.0, 0.1, 0.1), uFlash * 0.55);
  float fog = clamp((vDist - uFogStart) / max(uFogEnd - uFogStart, 0.001), 0.0, 1.0);
  c = mix(c, uFogColor, fog);
  fragColor = vec4(c, t.a * uOpacity);
}`;
function entityMat(tex, o) {
  o = o || {};
  const u = { map: { value: tex }, uEnv: { value: new THREE.Vector2(1, 0) }, uTint: { value: new THREE.Color(1, 1, 1) }, uFlash: { value: 0 }, uOpacity: { value: o.opacity === undefined ? 1 : o.opacity }, uGlow: { value: o.glow || 0 } };
  for (const k in U) u[k] = U[k];
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: ENT_VERT, fragmentShader: ENT_FRAG, glslVersion: THREE.GLSL3, transparent: !!o.transparent, depthWrite: !o.transparent, side: o.side || THREE.FrontSide, alphaTest: 0 });
}

// ---------------------------------------------------------------- sky, time of day and weather
const Sky = {
  time: 6000, skyDarken: 0, skyFactor: 1, celestial: 0, rain: 0, thunder: 0, moonPhase: 0,
  update(dayTime, partial) {
    const t = ((dayTime % 24000) + 24000) % 24000;
    let f = (t + partial) / 24000 - 0.25; if (f < 0) f += 1; if (f > 1) f -= 1;
    const g = 1 - (Math.cos(f * Math.PI) + 1) / 2; f += (g - f) / 3;
    this.celestial = f;
    const d = 1 - this.rain * 5 / 16, e = 1 - this.thunder * 5 / 16;
    const ff = 0.5 + 2 * Math.max(-0.25, Math.min(0.25, Math.cos(f * Math.PI * 2)));
    this.skyDarken = Math.floor((1 - ff * d * e) * 11);
    let k = 1 - (Math.cos(f * Math.PI * 2) * 2 + 0.2); k = Math.max(0, Math.min(1, k)); k = 1 - k;
    this.skyFactor = (k * d * e) * 0.8 + 0.2;
    this.moonPhase = Math.floor(dayTime / 24000) % 8;
  },
};
const SkyRender = (() => {
  // dome with a gradient from the sky colour above to the fog colour at the horizon
  const domeGeo = new THREE.SphereGeometry(200, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const domeMat = new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } }, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying float vY; void main(){ float t = smoothstep(-0.05, 0.35, vY); gl_FragColor = vec4(mix(hor, top, t), 1.0); }' });
  const dome = new THREE.Mesh(domeGeo, domeMat); skyScene.add(dome);
  // the dark lower half (the "void" below the horizon)
  const lowMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false, fog: false });
  const low = new THREE.Mesh(new THREE.SphereGeometry(199, 16, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), lowMat); skyScene.add(low);
  // sunrise / sunset glow
  const glowMat = new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Vector4() } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying float vA; void main(){ vA = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec4 col; varying float vA; void main(){ gl_FragColor = vec4(col.rgb, col.a * vA); }' });
  const glowGeo = new THREE.CircleGeometry(120, 16); const gp = glowGeo.attributes.position, guv = glowGeo.attributes.uv;
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i); const ctr = x === 0 && y === 0; guv.setY(i, ctr ? 1 : 0); gp.setZ(i, ctr ? 0 : -y * 0.5); }
  const glow = new THREE.Mesh(glowGeo, glowMat); skyScene.add(glow);
  // sun and moon: square textures drawn in code
  function spriteTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
  const sunTex = spriteTex(g => { g.fillStyle = '#fffbe0'; g.fillRect(8, 8, 16, 16); g.fillStyle = '#ffe98a'; g.fillRect(10, 10, 12, 12); g.fillStyle = '#ffffff'; g.fillRect(12, 12, 8, 8); g.fillStyle = 'rgba(255,240,170,0.35)'; g.fillRect(4, 4, 24, 24); });
  const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), sunMat); skyScene.add(sun);
  const moonTexs = [];
  for (let p = 0; p < 8; p++) moonTexs.push(spriteTex(g => {
    g.fillStyle = '#d8dce8'; g.fillRect(10, 10, 12, 12); g.fillStyle = '#b8bccb'; g.fillRect(12, 13, 3, 3); g.fillRect(17, 17, 2, 2); g.fillRect(18, 12, 2, 2);
    // phases: 0 full, 4 new; shade the dark part
    const lit = [12, 9, 6, 3, 0, 3, 6, 9][p], fromLeft = p < 4;
    g.fillStyle = '#10121a'; if (lit < 12) { const w = 12 - lit; g.fillRect(fromLeft ? 10 : 22 - w, 10, w, 12); }
  }));
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTexs[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), moonMat); skyScene.add(moon);
  // stars
  const sp = []; let seed = 10842;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 1500; i++) { const a = rnd() * 2 - 1, b = rnd() * 2 - 1, c = rnd() * 2 - 1, l = Math.hypot(a, b, c); if (l > 1 || l < 0.01) continue; sp.push(a / l * 150, b / l * 150, c / l * 150); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat); skyScene.add(stars);
  const celestial = new THREE.Group(); skyScene.add(celestial);
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  function update(dim, biomeSky, under) {
    const f = Sky.celestial, ang = f * Math.PI * 2;
    const g = Math.max(0, Math.min(1, Math.cos(ang) * 2 + 0.5));
    let skyC, fogC;
    if (dim === 'nether') { skyC = tmp.setHex(0x330808); fogC = tmp2.setHex(0x330808); }
    else if (dim === 'end') { skyC = tmp.setHex(0x0a0614); fogC = tmp2.setHex(0x0a0614); }
    else {
      skyC = tmp.setHex(biomeSky).multiplyScalar(g);
      const r = Sky.rain; if (r > 0) { const gray = (skyC.r * 0.3 + skyC.g * 0.59 + skyC.b * 0.11) * 0.6; skyC.lerp(new THREE.Color(gray, gray, gray), r * 0.75); }
      fogC = tmp2.setRGB(0.7529 * (g * 0.94 + 0.06), 0.847 * (g * 0.94 + 0.06), 1.0 * (g * 0.91 + 0.09));
      // looking toward the sunset tints the fog
      const sc = sunrise(f);
      if (sc) { const dir = new THREE.Vector3(); camera.getWorldDirection(dir); const sx = Math.sin(ang) < 0 ? -1 : 1; const k = Math.max(0, dir.x * -sx) * sc[3]; fogC.lerp(new THREE.Color(sc[0], sc[1], sc[2]), k * 0.6); }
      if (r > 0) { const gray = (fogC.r * 0.3 + fogC.g * 0.59 + fogC.b * 0.11) * 0.6; fogC.lerp(new THREE.Color(gray, gray, gray), r * 0.6); }
    }
    if (under === 'water') fogC.setRGB(0.02, 0.05, 0.2).lerp(new THREE.Color(0.05, 0.12, 0.35), Sky.skyFactor);
    if (under === 'lava') fogC.setRGB(0.6, 0.1, 0);
    domeMat.uniforms.top.value.copy(skyC); domeMat.uniforms.hor.value.copy(fogC);
    U.uFogColor.value.copy(fogC);
    renderer.setClearColor(fogC);
    lowMat.color.setRGB(skyC.r * 0.2 + 0.04, skyC.g * 0.2 + 0.04, skyC.b * 0.6 + 0.1);
    const overworld = dim === 'overworld';
    dome.visible = overworld || dim === 'end';
    // the dark lower half of the sky only shows when you are below the horizon (sea level), like the game
    low.visible = overworld && camera.position.y < 63; sun.visible = moon.visible = stars.visible = glow.visible = overworld;
    if (dim === 'end') { domeMat.uniforms.top.value.setHex(0x0a0614); domeMat.uniforms.hor.value.setHex(0x0a0614); }
    if (!overworld) return;
    // the sun rises in the east (+x) and sets in the west
    const sx = -Math.sin(ang), sy = Math.cos(ang);
    sun.position.set(sx * 100, sy * 100, 0); sun.lookAt(0, 0, 0);
    moon.position.set(-sx * 100, -sy * 100, 0); moon.lookAt(0, 0, 0);
    moonMat.map = moonTexs[Sky.moonPhase]; sunMat.opacity = moonMat.opacity = 1 - Sky.rain;
    let sb = 1 - (Math.cos(ang) * 2 + 0.25); sb = Math.max(0, Math.min(1, sb)); sb = sb * sb * 0.5 * (1 - Sky.rain);
    starMat.opacity = sb; stars.rotation.z = ang; stars.visible = sb > 0.01;
    const sc = sunrise(f);
    if (sc) { glow.visible = true; glowMat.uniforms.col.value.set(sc[0], sc[1], sc[2], sc[3] * (1 - Sky.rain)); glow.position.set(Math.sin(ang) < 0 ? 110 : -110, 0, 0); glow.lookAt(0, 0, 0); glow.rotateZ(0); }
    else glow.visible = false;
  }
  function sunrise(f) {
    const g = Math.cos(f * Math.PI * 2);
    if (g >= -0.4 && g <= 0.4) { const i = g / 0.4 * 0.5 + 0.5; let j = 1 - (1 - Math.sin(i * Math.PI)) * 0.99; j *= j; return [i * 0.3 + 0.7, i * i * 0.7 + 0.2, 0.2, j]; }
    return null;
  }
  return { update };
})();

// ---------------------------------------------------------------- clouds (fancy: 12x4x12 blocks per cloud cell, at Y 192)
const Clouds = (() => {
  const CELL = 12, N = 40, H = 4, Y = 192.33;
  let mesh = null, lastX = 1e9, lastZ = 1e9, offset = 0, seed = 1, map = null;
  const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uFogColor: U.uFogColor, uFar: { value: 200 } }, transparent: true, depthWrite: true,
    vertexShader: 'attribute float aShade; varying float vS; varying float vD; void main(){ vS = aShade; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = length(mv.xz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform vec3 uFogColor; uniform float uFar; varying float vS; varying float vD; void main(){ vec3 c = uCol * vS; float f = smoothstep(uFar * 0.55, uFar, vD); gl_FragColor = vec4(mix(c, uFogColor, f), 0.8 * (1.0 - f)); }' });
  function cloudAt(i, j) {
    // a fixed 256x256 cloud map like the game's, from noise
    if (!map) { map = new Uint8Array(256 * 256); const p = new Perlin(seed), q = new Perlin(seed + 7); for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) { const v = p.noise2(x / 9, z / 9) * 0.7 + q.noise2(x / 3.5, z / 3.5) * 0.3; map[x + z * 256] = v > 0.12 ? 1 : 0; } }
    return map[(i & 255) + (j & 255) * 256];
  }
  function build(ci, cj) {
    const pos = [], shade = [];
    const quad = (a, b, c, d, s) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let k = 0; k < 6; k++) shade.push(s); };
    for (let dj = -N / 2; dj < N / 2; dj++) for (let di = -N / 2; di < N / 2; di++) {
      const i = ci + di, j = cj + dj; if (!cloudAt(i, j)) continue;
      const x0 = i * CELL, z0 = j * CELL, x1 = x0 + CELL, z1 = z0 + CELL, y0 = 0, y1 = H;
      quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 1.0);
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0.7);
      if (!cloudAt(i, j - 1)) quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.8);
      if (!cloudAt(i, j + 1)) quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.8);
      if (!cloudAt(i - 1, j)) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.9);
      if (!cloudAt(i + 1, j)) quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.9);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aShade', new THREE.Float32BufferAttribute(shade, 1));
    if (mesh) { mesh.geometry.dispose(); mesh.geometry = g; } else { mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh); }
  }
  function update(dt, camPos, dim) {
    const on = Settings.clouds !== 'off' && dim === 'overworld';
    if (!on) { if (mesh) mesh.visible = false; return; }
    offset += dt * 0.6; // drift toward +x
    const ci = Math.floor((camPos.x - offset) / CELL), cj = Math.floor(camPos.z / CELL);
    if (ci !== lastX || cj !== lastZ || !mesh) { build(ci, cj); lastX = ci; lastZ = cj; }
    mesh.visible = true; mesh.position.set(offset, Y, 0);
    const g = Math.max(0, Math.min(1, Math.cos(Sky.celestial * Math.PI * 2) * 2 + 0.5));
    mat.uniforms.uCol.value.setRGB(g * 0.9 + 0.1, g * 0.9 + 0.1, g * 0.85 + 0.15).multiplyScalar(1 - Sky.rain * 0.45);
    mat.uniforms.uFar.value = Math.max(160, Settings.renderDist * 16 * 1.6);
  }
  function setSeed(s) { seed = s; map = null; lastX = 1e9; }
  return { update, setSeed };
})();

// ---------------------------------------------------------------- the world's meshes
const Render = {
  meshQueue: [], built: 0,
  makeSection(c, sy, bufs) {
    const objs = [];
    for (let L = 0; L < 3; L++) {
      const b = bufs[L]; if (!b.n) { objs.push(null); continue; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.p.slice(0, b.n * 3), 3));
      g.setAttribute('aUV', new THREE.BufferAttribute(b.uv.slice(0, b.n * 4), 4));
      g.setAttribute('aLight', new THREE.BufferAttribute(b.li.slice(0, b.n * 4), 4, true));
      g.setAttribute('aColor', new THREE.BufferAttribute(b.co.slice(0, b.n * 4), 4, true));
      g.setIndex(new THREE.BufferAttribute(b.n > 65535 ? b.ix.slice(0, b.ni) : new Uint16Array(b.ix.subarray(0, b.ni)), 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, 8, 8), 14);
      const m = new THREE.Mesh(g, MATS[L]);
      m.position.set(c.cx * 16, sy * 16 - 64, c.cz * 16);
      m.matrixAutoUpdate = false; m.updateMatrix();
      if (L === 2) m.renderOrder = 2;
      scene.add(m); objs.push(m);
    }
    return objs;
  },
  disposeSection(objs) { for (const m of objs) if (m) { scene.remove(m); m.geometry.dispose(); } },
  // rebuild dirty sections, nearest first, within a time budget
  updateMeshes(px, pz, budgetMs) {
    const t0 = performance.now();
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16), py = Math.floor((camera.position.y + 64) / 16);
    const R = Settings.renderDist;
    const list = [];
    for (const c of World.chunks.values()) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (Math.max(Math.abs(dx), Math.abs(dz)) > R) continue;
      let any = false; for (let s = 0; s < 16; s++) if (c.dirty[s]) { any = true; break; }
      if (!any) continue;
      // a chunk is drawn only once all its neighbours exist (faces and light at the edges depend on them)
      let ready = true;
      for (let oz = -1; oz <= 1 && ready; oz++) for (let ox = -1; ox <= 1; ox++) { const n = World.getChunk(c.cx + ox, c.cz + oz); if (!n || !n.lit) { ready = false; break; } }
      if (!ready) continue;
      list.push([dx * dx + dz * dz, c]);
    }
    list.sort((a, b) => a[0] - b[0]);
    let n = 0;
    for (const [, c] of list) {
      const order = [];
      for (let s = 0; s < 16; s++) if (c.dirty[s]) order.push(s);
      order.sort((a, b) => Math.abs(a - py) - Math.abs(b - py));
      for (const s of order) {
        c.dirty[s] = 0;
        const bufs = Mesher.mesh(c, s);
        if (c.meshes[s]) Render.disposeSection(c.meshes[s]);
        c.meshes[s] = bufs ? this.makeSection(c, s, bufs) : null;
        n++;
        if (performance.now() - t0 > budgetMs) return n;
      }
    }
    return n;
  },
};

// ---------------------------------------------------------------- block outline and breaking cracks
const Outline = (() => {
  const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthTest: true });
  const group = new THREE.Group(); scene.add(group);
  let key = '';
  function show(hit) {
    if (!hit || !Settings.hud) { group.visible = false; key = ''; return; }
    const shapes = Models.shape(hit.id, hit.state, hit.x, hit.y, hit.z, false) || [[0, 0, 0, 1, 1, 1]];
    const k = hit.x + ',' + hit.y + ',' + hit.z + ':' + hit.id + ':' + hit.state;
    if (k !== key) {
      key = k;
      while (group.children.length) { const c = group.children.pop(); c.geometry.dispose(); }
      for (const s of shapes) {
        const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(s[3] - s[0] + 0.004, s[4] - s[1] + 0.004, s[5] - s[2] + 0.004));
        const l = new THREE.LineSegments(g, mat); l.position.set((s[0] + s[3]) / 2, (s[1] + s[4]) / 2, (s[2] + s[5]) / 2); group.add(l);
      }
    }
    group.position.set(hit.x, hit.y, hit.z); group.visible = true;
  }
  return { show };
})();
const Cracks = (() => {
  const tex = [];
  for (let i = 0; i < 10; i++) { const d = Tex.paint('destroy_stage', i); const t = new THREE.DataTexture(d, 16, 16, THREE.RGBAFormat); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.flipY = false; t.needsUpdate = true; tex.push(t); }
  const mat = new THREE.MeshBasicMaterial({ map: tex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.85 });
  mat.blending = THREE.CustomBlending; mat.blendSrc = THREE.DstColorFactor; mat.blendDst = THREE.SrcColorFactor;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), mat); mesh.visible = false; scene.add(mesh);
  function show(x, y, z, stage, shape) {
    if (stage < 0) { mesh.visible = false; return; }
    const s = shape && shape[0] || [0, 0, 0, 1, 1, 1];
    mesh.scale.set(s[3] - s[0] + 0.002, s[4] - s[1] + 0.002, s[5] - s[2] + 0.002);
    mesh.position.set(x + (s[0] + s[3]) / 2, y + (s[1] + s[4]) / 2, z + (s[2] + s[5]) / 2);
    mat.map = tex[Math.min(9, stage)]; mesh.visible = true;
  }
  return { show };
})();
