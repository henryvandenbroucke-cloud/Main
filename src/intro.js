'use strict';
/* Opening animation: a small hand-built floating island (cottage, trees, pond, lanterns, fireflies)
   that is ready the instant the page opens. The camera circles it at sunset while the real world is
   generated in the background; then it fades into the live tour of the world. */
const Intro = (() => {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  let built = false, t = 0, flies = null, clouds = [];
  // ---- a tiny voxel grid
  const SX = 30, SY = 26, SZ = 30, grid = new Uint8Array(SX * SY * SZ);
  const T = { grass: 1, dirt: 2, stone: 3, planks: 4, log: 5, leaves: 6, thatch: 7, cobble: 8, path: 9, lamp: 10, water: 11, glass: 12 };
  const TEX = { 1: ['grass_top', 'grass_side', 'dirt'], 2: ['dirt'], 3: ['stone'], 4: ['planks'], 5: ['log_top', 'log_side', 'log_top'], 6: ['leaves'], 7: ['thatch'], 8: ['cobble'], 9: ['path', 'dirt', 'dirt'], 10: ['lamp'], 11: ['water'], 12: ['glass'] };
  const I3 = (x, y, z) => x + z * SX + y * SX * SZ;
  const get = (x, y, z) => x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ ? 0 : grid[I3(x, y, z)];
  const set = (x, y, z, v) => { if (x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ) grid[I3(x, y, z)] = v; };
  const plants = []; // [x, y, z, texName]
  function shape() {
    let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cx = 15, cz = 15, top = 14;
    for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) {
      const d = Math.hypot(x - cx, z - cz) + Math.sin(x * 0.7) * 0.8 + Math.cos(z * 0.6) * 0.8;
      if (d > 12) continue;
      const h = top + (d < 7 && x > 16 && z < 13 ? 1 : 0);
      const depth = Math.floor((12 - d) * 1.1 + r() * 2);
      for (let y = Math.max(0, h - depth); y <= h; y++) set(x, y, z, y === h ? T.grass : y > h - 3 ? T.dirt : T.stone);
    }
    // pond
    for (let x = 6; x <= 11; x++) for (let z = 15; z <= 20; z++) if (Math.hypot(x - 8.5, z - 17.5) < 2.7) { set(x, top, z, T.water); set(x, top - 1, z, T.dirt); }
    // path from the door to the edge
    for (let z = 14; z < 27; z++) { set(16, top, z, T.path); if (z % 3) set(15, top, z, T.path); }
    // cottage
    const hx = 13, hz = 7, hw = 7, hd = 6, base = top + 1;
    for (let x = hx; x < hx + hw; x++) for (let z = hz; z < hz + hd; z++) {
      set(x, base - 1, z, T.cobble);
      for (let y = base; y < base + 4; y++) {
        const edge = x === hx || x === hx + hw - 1 || z === hz || z === hz + hd - 1, corner = (x === hx || x === hx + hw - 1) && (z === hz || z === hz + hd - 1);
        if (!edge) continue;
        let v = corner ? T.log : T.planks;
        if (!corner && y === base + 1 && (x === hx + 2 || x === hx + 4 || z === hz + 2 || z === hz + 3)) v = T.glass;
        if (z === hz + hd - 1 && x === hx + 3 && y < base + 2) v = 0; // door
        set(x, y, z, v);
      }
    }
    for (let k = 0; k < 4; k++) for (let x = hx - 1 + k; x <= hx + hw - k; x++) for (let z = hz - 1 + k; z <= hz + hd - k; z++) set(x, base + 4 + k, z, T.thatch);
    for (let y = base; y < base + 8; y++) set(hx + 5, y, hz + 1, y < base + 4 ? T.cobble : T.cobble); // chimney
    // trees
    for (const [x, z, h] of [[7, 8, 5], [22, 20, 6], [6, 22, 4], [23, 9, 5]]) {
      for (let y = top + 1; y < top + 1 + h; y++) set(x, y, z, T.log);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) { const yy = top + h + dy; if (Math.hypot(dx, dz, dy * 1.2) < 2.6 && !get(x + dx, yy, z + dz)) set(x + dx, yy, z + dz, T.leaves); }
    }
    // lantern posts along the path
    for (const [x, z] of [[18, 17], [14, 21], [18, 25]]) { set(x, top + 1, z, T.log); set(x, top + 2, z, T.log); set(x, top + 3, z, T.lamp); }
    // flowers and tall grass
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * SX), z = Math.floor(r() * SZ); if (get(x, top, z) === T.grass && !get(x, top + 1, z)) plants.push([x, top + 1, z, ['tallgrass', 'tallgrass', 'flower_red', 'flower_yellow', 'flower_blue'][Math.floor(r() * 5)]]); }
  }
  function build() {
    shape();
    const tex = new THREE.CanvasTexture(Atlas.canvas); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    const buckets = { solid: [], water: [], glow: [], plant: [] };
    const push = (b, verts, uvRect, shade) => { b.push([verts, uvRect, shade]); };
    const FACES = [ // dir, corners (unit cube), shade
      [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], 1.0, 0],
      [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 0.55, 2],
      [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], 0.8, 1],
      [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], 0.8, 1],
      [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], 0.9, 1],
      [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], 0.7, 1],
    ];
    const uvOf = name => { const [sx, sy] = tileXY(name); return [sx / 256, sy / 256]; };
    for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const v = get(x, y, z); if (!v) continue;
      for (const [d, cs, shade, ti] of FACES) {
        const n = get(x + d[0], y + d[1], z + d[2]);
        if (n && n !== T.leaves && n !== T.water && n !== T.glass) continue;
        if (n === v && (v === T.water || v === T.glass || v === T.leaves)) continue;
        if (v === T.water && d[1] !== 1) continue;
        const names = TEX[v], name = names[Math.min(ti, names.length - 1)];
        const verts = cs.map(c => [x + c[0], y + c[1] - (v === T.water && d[1] === 1 ? 0.12 : 0), z + c[2]]);
        // fake ambient occlusion: darker where the face is tucked under something
        const occ = get(x + d[0], y + d[1] + 1, z + d[2]) ? 0.8 : 1;
        push(v === T.water ? buckets.water : v === T.lamp ? buckets.glow : buckets.solid, verts, uvOf(name), shade * occ);
      }
    }
    for (const [x, y, z, name] of plants) for (const [a, b] of [[[0.15, 0.15], [0.85, 0.85]], [[0.85, 0.15], [0.15, 0.85]]]) {
      const v = [[x + a[0], y, z + a[1]], [x + b[0], y, z + b[1]], [x + b[0], y + 1, z + b[1]], [x + a[0], y + 1, z + a[1]]];
      push(buckets.plant, v, uvOf(name), 0.95);
    }
    const mk = (list, mat) => {
      const P = [], UV = [], C = [], IX = [];
      for (const [verts, [u, v], s] of list) {
        const o = P.length / 3, e = 0.5 / 256, w = 16 / 256;
        for (const p of verts) P.push(p[0] - 15, p[1] - 14, p[2] - 15);
        UV.push(u + e, 1 - (v + w - e), u + w - e, 1 - (v + w - e), u + w - e, 1 - (v + e), u + e, 1 - (v + e));
        for (let k = 0; k < 4; k++) C.push(s, s, s);
        IX.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setIndex(IX); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); scene.add(m); return m;
    };
    mk(buckets.solid, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 }));
    mk(buckets.plant, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    mk(buckets.glow, new THREE.MeshBasicMaterial({ map: tex, color: 0xffe0a0 }));
    mk(buckets.water, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.75, color: 0x88b8ff }));
    // sunset sky, warm light, cool shade
    const sky = document.createElement('canvas'); sky.width = 2; sky.height = 256; const sg = sky.getContext('2d');
    const gr = sg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a3a6a'); gr.addColorStop(0.45, '#c87a6a'); gr.addColorStop(0.62, '#f4b070'); gr.addColorStop(1, '#3a2a3a');
    sg.fillStyle = gr; sg.fillRect(0, 0, 2, 256);
    scene.background = new THREE.CanvasTexture(sky);
    scene.fog = new THREE.Fog(0xd88a6a, 45, 120);
    scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x6a4a34, 1.0));
    const sun = new THREE.DirectionalLight(0xffc88a, 1.25); sun.position.set(-1, 0.7, 0.5); scene.add(sun);
    // lantern glow and fireflies
    const fg = new THREE.BufferGeometry(), fp = [];
    for (let i = 0; i < 60; i++) fp.push((Math.random() - 0.5) * 26, 1 + Math.random() * 8, (Math.random() - 0.5) * 26);
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffe890, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
    flies.base = fp.slice(); scene.add(flies);
    // a few soft blocky clouds
    const cm = new THREE.MeshLambertMaterial({ color: 0xffe0d0, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 8, 1.2, 4 + Math.random() * 5), cm); c.position.set((Math.random() - 0.5) * 120, 14 + Math.random() * 8, (Math.random() - 0.5) * 120); scene.add(c); clouds.push(c); }
    // a chimney wisp
    built = true;
  }
  function render(dt, w, h) {
    if (!built) build();
    t += dt;
    const a = t * 0.12 + 2.2, R = 34;
    cam.position.set(Math.sin(a) * R, 11 + Math.sin(t * 0.3) * 2, Math.cos(a) * R);
    cam.lookAt(0, 1 + Math.sin(t * 0.25) * 0.5, 0);
    cam.aspect = w / h; cam.setViewOffset(w, h, -w * 0.16, 0, w, h); cam.updateProjectionMatrix();
    const p = flies.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, flies.base[i * 3] + Math.sin(t * 0.7 + i) * 0.6, flies.base[i * 3 + 1] + Math.sin(t * 1.1 + i * 2) * 0.4, flies.base[i * 3 + 2] + Math.cos(t * 0.6 + i) * 0.6);
    p.needsUpdate = true; flies.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
    for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 70) c.position.x = -70; }
    renderer.setRenderTarget(null);
    renderer.render(scene, cam);
  }
  return { render };
})();
