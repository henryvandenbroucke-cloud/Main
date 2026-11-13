// All four sets of the brick-tax short as one static three.js scene, lit per plate with the template's two-tone
// rig (camera-relative sun, sky gradient, fog = horizon). Sets: Measham high street (with Wilkes' cottage of double
// bricks), Wilkes' brickyard (bottle kilns, drying shed, brick hacks, work table), the Treasury in London, and the
// "same wall, half the bricks" pair of walls. Nothing moves: the 2D pass animates the cast over these plates.
import * as THREE from "three";
import { Batch, V, lam, boxGeo, quad, tri, house, prop, Kit, Style } from "./build";
import { ctex, rep, stoneHD, cobbleHD, grassHD, roofHD, planksHD, beamHD, cloudHD, brickTile, facadeHD, rng, jit } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { PlateDef, TOWN, YARD, TRES, WALLS, GOB_HOUSE_X } from "./story";

/** flat ground quad at height y over x0..x1, z0..z1 with texture repeat every `tile` metres */
const ground = (x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) => {
  const g = new THREE.BufferGeometry(), u = (x1 - x0) / tile, v = (z1 - z0) / tile;
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
const dirtTex = () => ctex("dirtHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#b08a62"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) {
    const x = r() * 1024, y = r() * 1024, s = 4 + r() * 22;
    g.fillStyle = r() > 0.5 ? `rgba(120,80,50,${0.08 + r() * 0.1})` : `rgba(230,200,160,${0.08 + r() * 0.1})`;
    g.beginPath(); g.ellipse(x, y, s * 1.4, s, r() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 70; i++) { // brick crumbs
    const x = r() * 1024, y = r() * 1024, s = 5 + r() * 8;
    g.fillStyle = jit(r, "#b8573a", 0.2); g.fillRect(x, y, s * 1.6, s);
  }
});
const clayTex = () => ctex("clayHD", 512, 512, (g, r) => {
  g.fillStyle = "#a86d4a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = r() * 512, y = r() * 512, s = 6 + r() * 26;
    g.fillStyle = r() > 0.5 ? "rgba(90,50,35,0.12)" : "rgba(220,160,120,0.12)";
    g.beginPath(); g.ellipse(x, y, s * 1.6, s * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
});
/** a sky gradient sphere (template look), clouds as camera-facing cards */
const SKY_V = "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_F = `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
  void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
    vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
    c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`;

export class World {
  root = new THREE.Group();
  private sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  private hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private clouds: THREE.Mesh[] = [];
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private disc: THREE.Sprite;

  constructor() {
    const R = this.root, kit: Kit = {};
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() },
        c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    const discTex = ctex("sunDisc", 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.disc.layers.set(NOINK); this.disc.frustumCulled = false; R.add(this.disc);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.sun, this.sun.target, this.hemi);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    const b = new Batch();
    const grassM = lam("grassHD", () => ({ map: grassHD() })), cobM = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const dirtM = lam("dirtHD", () => ({ map: dirtTex() })), stoneM = lam("stoneHD", () => ({ map: stoneHD("stoneHD") }));
    const woodM = lam("beamHD", () => ({ map: beamHD() })), planksM = lam("planksHD", () => ({ map: planksHD() }));
    // ---- ground everywhere ----
    b.add(ground(-400, 400, -400, 400, 8, -0.02), grassM);

    // ================= Measham high street (TOWN) =================
    const [tx] = TOWN;
    b.add(ground(tx - 44, tx + 44, -4.2, 4.2, 4), cobM);
    for (const s of [-1, 1]) b.add(boxGeo(V(tx - 44, 0, s < 0 ? -5.6 : 4.2), V(tx + 44, 0.12, s < 0 ? -4.2 : 5.6), 2), stoneM); // pavements
    const GOB: Style = { wall: "#c8643f", shutter: "#2f6a43", roof: "#8f97a8", brick: true, brickH: 0.21, brickW: 0.32 };
    const BRK: Style = { wall: "#c8643f", shutter: "#3f6fb5", roof: "#c9775a", brick: true };
    const BRK2: Style = { wall: "#c8643f", shutter: "#8c3b4a", roof: "#8e7aa0", brick: true };
    // north row: fronts at z = -5.6, facing +z
    const north: [number, number, number, number, Style | null][] = [
      [-25, 8, 7.2, 1, null], [-16.5, 8.5, 8.4, 0, BRK], [-7.6, 8.6, 6.8, 3, null], [GOB_HOUSE_X, 9.6, 6.6, 0, GOB], [11.8, 9, 8.4, 0, BRK2],
      [20.6, 8, 7.0, 4, null], [29, 8.2, 8.4, 0, BRK],
    ];
    north.forEach(([x, w, h, si, st], i) => house(b, tx + x, -5.6 - 3.6, 0, w, 7.2, h, st ? 100 + i : si, 0, st ?? undefined));
    const south: [number, number, number, number, Style | null][] = [
      [-21, 8.4, 7.4, 2, null], [-12.4, 8.2, 8.4, 0, BRK2], [-3.6, 8.8, 7.0, 5, null], [5.6, 9, 8.4, 0, BRK], [14.8, 8.6, 7.2, 6, null], [23.6, 8.4, 8.4, 0, BRK2],
    ];
    south.forEach(([x, w, h, si, st], i) => house(b, tx + x, 5.6 + 3.6, Math.PI, w, 7.2, h, st ? 200 + i : si, 0, st ?? undefined));
    // street furniture: lamp posts and a horse trough
    const ironM = twoTone(new THREE.MeshPhongMaterial({ color: "#3d414c", specular: "#8a8a8a", shininess: 50 }), 0.15);
    const lampGlass = lam("lampGlass", () => ({ color: "#f7e7b0" }));
    for (const x of [-12, 7.5, 24]) for (const z of [-4.6, 4.6]) {
      if (z < 0 && x === 7.5) continue;
      b.add(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 10).translate(tx + x, 1.6, z), ironM);
      b.add(boxGeo(V(tx + x - 0.2, 3.2, z - 0.2), V(tx + x + 0.2, 3.65, z + 0.2)), lampGlass);
      b.add(new THREE.ConeGeometry(0.3, 0.3, 4).rotateY(Math.PI / 4).translate(tx + x, 3.8, z), ironM);
    }
    // trees behind the rows
    for (let i = 0; i < 16; i++) {
      const x = tx - 40 + i * 5.4 + ((i * 37) % 7) * 0.4;
      prop(b, kit, i % 3 ? "tree_oak" : "tree_fat", x, 0, -24 - (i % 3) * 3, 7 + (i % 4), i);
      prop(b, kit, i % 2 ? "tree_default" : "tree_oak", x + 2, 0, 24 + (i % 3) * 3, 7 + (i % 3), i);
    }
    // far church tower over the roofs (Measham's St Laurence: a stone tower with a short spire)
    const tw = lam("towerHD", () => ({ map: stoneHD("towerHD", ["#cbbba3", "#c1b097", "#d4c5ad", "#b9a78e"], "#9a8a76") }));
    b.add(boxGeo(V(tx + 34, 0, -34), V(tx + 39, 21, -29), 3), tw);
    b.add(new THREE.ConeGeometry(3.4, 8, 4).rotateY(Math.PI / 4).translate(tx + 36.5, 25, -31.5), lam("roofSlate", () => ({ map: roofHD("#8f97a8", true) })));

    // ================= Wilkes' brickyard (YARD) =================
    const [yx] = YARD;
    b.add(ground(yx - 22, yx + 22, -20, 9, 5, 0.005), dirtM);
    const kilnM = lam("kilnBrick", () => ({ map: rep(brickTile(0.085), 3, 3) }));
    const kiln = (x: number, z: number, s: number) => { // bottle kiln: hovel lathe, soot band at the neck
      const prof: THREE.Vector2[] = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, y = u * 11 * s;
        const r = s * (u < 0.55 ? 4.0 - 0.9 * u : 3.5 - 2.3 * Math.sin(((u - 0.55) / 0.45) * Math.PI / 2) ** 1.3);
        prof.push(new THREE.Vector2(r, y));
      }
      const g = new THREE.LatheGeometry(prof, 32);
      b.add(g, kilnM, new THREE.Matrix4().makeTranslation(x, 0, z));
      b.add(new THREE.CylinderGeometry(1.32 * s, 1.32 * s, 0.5 * s, 24).translate(x, 11 * s + 0.25 * s, z), lam("kilnLip", () => ({ color: "#5a3c3c" })));
      // stoke hole arch: a dark box on the front
      b.add(boxGeo(V(x - 0.7 * s, 0, z + 3.75 * s), V(x + 0.7 * s, 1.8 * s, z + 4.05 * s)), lam("stoke", () => ({ color: "#2e1f24" })));
    };
    kiln(yx + 2.5, -12.5, 1.0);
    kiln(yx - 11, -15, 0.85);
    // drying shed: posts + pantile roof, open sides
    const shed = (x0: number, x1: number, z0: number, z1: number, h: number) => {
      for (const x of [x0, (x0 + x1) / 2, x1]) for (const z of [z0, z1]) b.add(boxGeo(V(x - 0.12, 0, z - 0.12), V(x + 0.12, h, z + 0.12), 1), woodM);
      const rm = lam("shedRoof", () => ({ map: roofHD("#c9775a"), side: THREE.DoubleSide }));
      const zm = (z0 + z1) / 2, rise = 1.4;
      b.add(quad(V(x0 - 0.5, h - 0.1, z1 + 0.6), V(x1 + 0.5, h - 0.1, z1 + 0.6), V(x1 + 0.5, h + rise, zm), V(x0 - 0.5, h + rise, zm), (x1 - x0) / 4, 1), rm);
      b.add(quad(V(x1 + 0.5, h - 0.1, z0 - 0.6), V(x0 - 0.5, h - 0.1, z0 - 0.6), V(x0 - 0.5, h + rise, zm), V(x1 + 0.5, h + rise, zm), (x1 - x0) / 4, 1), rm);
      b.add(boxGeo(V(x0 - 0.1, h - 0.3, z0 - 0.1), V(x1 + 0.1, h, z1 + 0.1), 2), woodM);
    };
    shed(yx - 13, yx - 3, -8.5, -4.5, 2.6);
    // brick hacks: stacked bricks (boxes in a lattice), two colours of fired brick
    const hackM = [0, 1, 2].map((k) => lam("hack" + k, () => ({ map: rep(brickTile(0.085), 1, 1), color: ["#ffffff", "#f0d8cf", "#ffe8d8"][k] })));
    const hack = (x: number, z: number, w: number, d: number, h: number, k: number) => b.add(boxGeo(V(x - w / 2, 0, z - d / 2), V(x + w / 2, h, z + d / 2), 1.6), hackM[k % 3]);
    for (let i = 0; i < 6; i++) hack(yx - 11.5 + i * 1.65, -6.5, 1.2, 1.6, 1.2 + (i % 2) * 0.25, i);
    hack(yx + 3.6, -3.4, 1.4, 1.0, 1.5, 0); hack(yx + 5.2, -3.6, 1.2, 1.1, 1.15, 1); hack(yx + 4.4, -5.1, 1.6, 1.0, 1.8, 2);
    hack(yx - 4.6, -1.6, 1.1, 0.9, 0.9, 1);
    // clay heap and a wheelbarrow-ish trough
    const heap = new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); heap.scale(1.3, 0.55, 1);
    b.add(heap, lam("clay", () => ({ map: clayTex() })), new THREE.Matrix4().makeTranslation(yx - 7.5, 0, -1.8));
    // the work table (moulding bench) in front of Wilkes: top 2.2 x 1.0 at 0.9 m
    b.add(boxGeo(V(yx - 1.1, 0.82, 1.0), V(yx + 1.1, 0.9, 2.0), 1), planksM);
    for (const x of [-1.0, 1.0]) for (const z of [1.08, 1.92]) b.add(boxGeo(V(yx + x - 0.05, 0, z - 0.05), V(yx + x + 0.05, 0.82, z + 0.05)), woodM);
    // fence along the back and the sides
    for (let x = yx - 22; x <= yx + 22; x += 2.2) b.add(boxGeo(V(x - 0.06, 0, -19.9), V(x + 0.06, 1.3, -19.7)), woodM);
    b.add(boxGeo(V(yx - 22, 0.9, -19.95), V(yx + 22, 1.05, -19.75)), woodM);
    b.add(boxGeo(V(yx - 22, 0.4, -19.95), V(yx + 22, 0.55, -19.75)), woodM);
    for (let i = 0; i < 12; i++) prop(b, kit, i % 2 ? "tree_oak" : "tree_default", yx - 26 + i * 4.8, 0, -25 - (i % 3) * 3, 7 + (i % 3), i + 40);
    // a cottage of the yard (Wilkes' brick, double courses)
    house(b, yx + 15, -9, -Math.PI / 2, 8, 6.5, 5.6, 300, 0, GOB);

    // ================= The Treasury, London (TRES) =================
    const [rx] = TRES;
    b.add(ground(rx - 40, rx + 40, -9, 30, 4, 0.004), cobM);
    const facStone = lam("tresFac", () => ({ map: facadeHD("tresFac", 34, 13, { wall: "#e2d6c2", shutter: "#3b3f52" }) }));
    const sideStone = lam("tresSide", () => ({ map: stoneHD("tresStone", ["#e6dccd", "#ddd3c3", "#ece4d6", "#d6cbba"], "#aea293") }));
    const z0 = -9;
    b.add(quad(V(rx - 17, 0, z0), V(rx + 17, 0, z0), V(rx + 17, 13, z0), V(rx - 17, 13, z0)), facStone);
    b.add(boxGeo(V(rx - 17.3, 12.6, z0 - 0.1), V(rx + 17.3, 13.4, z0 + 0.45), 3), sideStone); // cornice
    b.add(boxGeo(V(rx - 17.3, 13.4, z0 - 0.1), V(rx + 17.3, 14.4, z0 + 0.15), 3), sideStone); // parapet
    for (const s of [-1, 1]) b.add(boxGeo(V(s < 0 ? rx - 17 : rx + 16.9, 0, z0 - 16), V(s < 0 ? rx - 16.9 : rx + 17, 13, z0), 3), sideStone);
    // portico: podium steps, six columns, entablature, pediment
    for (let k = 0; k < 4; k++) b.add(boxGeo(V(rx - 8 - 0.3 * (3 - k), 0.3 * k, z0), V(rx + 8 + 0.3 * (3 - k), 0.3 * (k + 1), z0 + 4.6 - 0.45 * k), 1.5), sideStone);
    const colM = lam("column", () => ({ color: "#efe6d6" }));
    for (let i = 0; i < 6; i++) {
      const x = rx - 6.5 + i * 2.6;
      b.add(new THREE.CylinderGeometry(0.42, 0.5, 8.4, 20).translate(x, 1.2 + 4.2, z0 + 3.0), colM);
      b.add(boxGeo(V(x - 0.62, 1.2, z0 + 2.38), V(x + 0.62, 1.45, z0 + 3.62)), sideStone);
      b.add(boxGeo(V(x - 0.6, 9.6, z0 + 2.4), V(x + 0.6, 9.85, z0 + 3.6)), sideStone);
    }
    b.add(boxGeo(V(rx - 8, 9.85, z0), V(rx + 8, 11.1, z0 + 3.8), 2), sideStone);
    b.add(tri(V(rx - 8.3, 11.1, z0 + 3.8), V(rx + 8.3, 11.1, z0 + 3.8), V(rx, 13.6, z0 + 3.8)), sideStone);
    b.add(quad(V(rx - 8.6, 11.0, z0 + 4.1), V(rx, 13.8, z0 + 4.1), V(rx, 13.8, z0), V(rx - 8.6, 11.0, z0)), lam("tresRoof", () => ({ map: roofHD("#8f97a8", true), side: THREE.DoubleSide })));
    b.add(quad(V(rx, 13.8, z0 + 4.1), V(rx + 8.6, 11.0, z0 + 4.1), V(rx + 8.6, 11.0, z0), V(rx, 13.8, z0)), lam("tresRoof", () => ({ map: roofHD("#8f97a8", true), side: THREE.DoubleSide })));
    // big door in the portico
    b.add(boxGeo(V(rx - 1.3, 1.2, z0 + 0.02), V(rx + 1.3, 5.2, z0 + 0.12)), lam("tresDoor", () => ({ color: "#2f3f5a" })));
    for (const x of [-12.5, 12.5]) {
      b.add(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 10).translate(rx + x, 1.7, 2.5), ironM);
      b.add(boxGeo(V(rx + x - 0.22, 3.4, 2.28), V(rx + x + 0.22, 3.9, 2.72)), lampGlass);
    }
    // railings in front of the wings
    for (const s of [-1, 1]) for (let x = 8.6; x < 17; x += 0.32) b.add(boxGeo(V(rx + s * x - 0.025, 0, z0 + 1.6), V(rx + s * x + 0.025, 1.2, z0 + 1.65)), ironM);
    for (let i = 0; i < 10; i++) prop(b, kit, "tree_oak", rx - 24 + i * 5.3, 0, z0 - 22 - (i % 2) * 4, 9 + (i % 3), i + 80);
    // a terrace of town houses across the street (seen in the wide)
    for (let i = 0; i < 5; i++) house(b, rx - 30 + i * 9 + (i > 1 ? 24 : 0), 34, Math.PI, 8.6, 7, 9.8, i + 2);

    // ================= same wall, half the bricks (WALLS) =================
    const [wx] = WALLS;
    const brickMs = [0, 1, 2, 3, 4].map((k) => lam("wb" + k, () => ({ color: ["#c0583a", "#b44f35", "#c8643f", "#a94a33", "#cf6e45"][k] })));
    const mortarM = lam("mortar", () => ({ color: "#e6d3b3" }));
    const wall = (cx: number, bh: number, seed: number) => {
      const W = 1.84, H = 2.7, bw = 0.46, gap = 0.028, rr = rng(seed);
      b.add(boxGeo(V(cx - W / 2 + 0.02, 0.18, -2.13), V(cx + W / 2 - 0.02, H + 0.16, -1.87)), mortarM); // mortar core
      const rows = Math.round(H / bh);
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * bw / 2;
        for (let x = -W / 2 - off; x < W / 2 - 1e-3; x += bw) {
          const a = Math.max(-W / 2, x) + gap / 2, e = Math.min(W / 2, x + bw) - gap / 2;
          if (e - a < 0.05) continue;
          const y0 = 0.18 + r * bh + gap / 2, y1 = 0.18 + (r + 1) * bh - gap / 2;
          b.add(boxGeo(V(cx + a, y0, -2.16), V(cx + e, y1, -1.84)), brickMs[Math.floor(rr() * 5)]);
        }
      }
      b.add(boxGeo(V(cx - W / 2 - 0.08, 0, -2.25), V(cx + W / 2 + 0.08, 0.18, -1.75), 1), stoneM); // footing
      b.add(boxGeo(V(cx - W / 2 - 0.06, H + 0.16, -2.22), V(cx + W / 2 + 0.06, H + 0.3, -1.78), 1), stoneM); // coping
    };
    wall(wx - 1.12, 0.15, 3); // normal bricks: 18 courses x 4 = 72
    wall(wx + 1.12, 0.30, 5); // Wilkes' gobs: 9 courses x 4 = 36, half the bricks
    for (let i = 0; i < 8; i++) prop(b, kit, i % 2 ? "plant_bushLarge" : "tree_oak", wx - 9 + i * 2.6, 0, -6 - (i % 2) * 2.5, i % 2 ? 1.5 : 6, i + 120);
    b.add(ground(wx - 6, wx + 6, -3.2, 3, 4, 0.004), dirtM);

    b.build(R);
  }

  /** pose the light rig + sky for one plate; returns the focus point */
  update(p: PlateDef, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const L = LIGHTS[p.light], K = LOOK[p.light];
    cam.position.set(...p.pos); cam.up.set(0, 1, 0); cam.lookAt(...p.look);
    cam.fov = p.fov; cam.near = 0.15; cam.far = 1500; cam.aspect = 9 / 16; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // camera-relative sun (template lights.ts): az from the view axis toward screen right
    const fx = p.look[0] - p.pos[0], fz = p.look[2] - p.pos[2], n = Math.hypot(fx, fz) || 1;
    const ax = fx / n, az0 = fz / n;
    const az = THREE.MathUtils.degToRad(p.az ?? L.az), el = THREE.MathUtils.degToRad(p.el ?? L.el);
    const hx = ax * Math.cos(az) - az0 * Math.sin(az), hz = az0 * Math.cos(az) + ax * Math.sin(az);
    const sunDir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    const focus = new THREE.Vector3(...(p.focus ?? p.look));
    const dist = cam.position.distanceTo(focus);
    const Rr = THREE.MathUtils.clamp(dist * 1.6 + 10, 14, 70);
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.sun.shadow.needsUpdate = true;
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    this.disc.visible = p.light === "golden";
    this.disc.position.copy(cam.position).addScaledVector(sunDir, 900);
    this.disc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
    // clouds in a ring around the camera, facing it
    const yaw0 = Math.atan2(fx, fz);
    this.clouds.forEach((m, i) => {
      const a = yaw0 + (i / this.clouds.length - 0.5) * 2.4 + 0.13 * Math.sin(i * 7.1), d = 520 + (i % 3) * 70;
      const w = 120 + (i % 4) * 34;
      m.position.set(cam.position.x + Math.sin(a) * d, 70 + (i % 5) * 26, cam.position.z + Math.cos(a) * d);
      m.scale.set(w, w / 2, 1); m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[p.light][i % 4];
    });
    return focus;
  }
}
