// A steam-era railway station as one static three.js scene, lit per plate with the template's two-tone rig:
// track (rails, sleepers, ballast) with a gravel walkway on the -z side, a train of a green tank-engine-style
// locomotive and three maroon/cream carriages on spoked wheels with axle boxes, a raised platform on +z under an iron
// canopy on columns with a clock, the station building, and houses + trees around.
import * as THREE from "three";
import { Batch, V, lam, boxGeo, quad, house, prop, Kit, Style } from "./build";
import { ctex, rep, stoneHD, cobbleHD, grassHD, roofHD, planksHD, beamHD, cloudHD, facadeHD, brickTile, rng, jit } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { PlateDef } from "./story";

type LightName = "day" | "golden" | "night";
const groundW = (x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) => {
  const g = new THREE.BufferGeometry();
  const P = [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]];
  g.setAttribute("position", new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x, y, z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x / tile, -z / tile]), 2));
  return g;
};
const ballastTex = () => ctex("ballast", 512, 512, (g, r) => {
  g.fillStyle = "#8f877c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = jit(r, ["#7d756b", "#a39a8d", "#6c655d", "#b3aa9c"][i % 4], 0.15); g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 6, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
});
const gravelTex = () => ctex("walkGravel", 512, 512, (g, r) => {
  g.fillStyle = "#b9ad98"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = jit(r, ["#a89c88", "#c9bea8", "#968b78"][i % 3], 0.15); g.beginPath(); g.ellipse(r() * 512, r() * 512, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill(); }
});
/** spoked carriage / loco wheel face: dark centre, spokes, bright steel tyre */
const roadTex = () => ctex("dirtRoad", 1024, 1024, (g, r) => {
  g.fillStyle = "#c7ab7d"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 3000; i++) { g.fillStyle = jit(r, ["#b89b6d", "#d4ba8e", "#a88d63", "#cdb489"][i % 4], 0.12); g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
  for (const v of [0.33, 0.67]) { for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(110,82,50,${0.05 + r() * 0.06})`; g.fillRect(r() * 1024, v * 1024 + (r() - 0.5) * 60, 30 + r() * 80, 3 + r() * 6); } }
});
/** muted storybook meadow (the kit grass reads lime after the grade) */
const meadowTex = (key: string, base: string) => ctex(key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 40; i++) { const x = r() * 1024, y = r() * 1024, rad = 80 + r() * 220; const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() > 0.5 ? "170,190,110" : "110,140,70"; gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
  g.lineWidth = 2; g.lineCap = "round";
  for (let i = 0; i < 1600; i++) { const x = r() * 1024, y = r() * 1024, h = 7 + r() * 9; g.strokeStyle = r() < 0.4 ? "rgba(190,205,130,0.35)" : "rgba(90,115,55,0.4)"; g.beginPath(); g.moveTo(x - 3, y - h); g.lineTo(x, y); g.lineTo(x + 3, y - h * 0.8); g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = ["#f7f3e8", "#f4d24a", "#f3a9bb"][i % 3]; g.beginPath(); g.arc(r() * 1024, r() * 1024, 3.5, 0, 7); g.fill(); }
});
/** crimson damask gallery wall (or any two-tone damask) */
const damaskTex = (base = "#8a3a40", dark = "#7f343a") => ctex("damask" + base, 512, 512, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512); g.fillStyle = dark;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 128 + (y % 2) * 64 + 32, cy = y * 128 + 64; g.beginPath(); g.ellipse(cx, cy, 22, 40, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx, cy - 46, 8, 10, 0, 0, 7); g.fill(); }
});
/** procedural "old master" canvases: landscapes, portraits, still lifes */
const canvasTex = (k: number) => ctex("canvas" + k, 512, 512, (g, r) => {
  const pal = [["#3d5a73", "#c9a86a", "#5c7a3a"], ["#2a2a30", "#e8d2b0", "#6b2a2a"], ["#6a8aa8", "#e9d8a6", "#4a6a3a"], ["#1f2a24", "#d9c39a", "#8c2f39"], ["#a8b8c8", "#f2e2b8", "#5a7a4a"], ["#3a2a20", "#c98a3a", "#e8d2b0"]][k % 6];
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]); g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
  if (k % 2) { g.fillStyle = pal[2]; g.beginPath(); g.ellipse(256, 520, 200, 260, 0, 0, 7); g.fill(); g.fillStyle = "#e8d2b0"; g.beginPath(); g.ellipse(256, 200, 70, 90, 0, 0, 7); g.fill(); g.fillStyle = "#3a2a20"; g.beginPath(); g.ellipse(256, 140, 76, 48, 0, Math.PI, 0); g.fill(); }
  else { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? pal[2] : "#3f5a30"; g.beginPath(); g.ellipse(r() * 512, 380 + i * 30, 220, 90, 0, 0, 7); g.fill(); } g.fillStyle = "#2f4a28"; for (let i = 0; i < 3; i++) { const x = 60 + r() * 400; g.beginPath(); g.ellipse(x, 300, 40, 70, 0, 0, 7); g.fill(); g.fillRect(x - 5, 330, 10, 60); } }
  g.fillStyle = "rgba(60,40,20,0.18)"; g.fillRect(0, 0, 512, 512);
});
const crestTex = () => ctex("crest", 256, 256, (g) => {
  g.fillStyle = "#d6a63c"; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = "#8c2f39"; g.beginPath(); g.moveTo(128, 40); g.lineTo(200, 80); g.lineTo(190, 170); g.lineTo(128, 220); g.lineTo(66, 170); g.lineTo(56, 80); g.closePath(); g.fill();
  g.strokeStyle = "#f2e2b8"; g.lineWidth = 10; g.beginPath(); g.moveTo(128, 70); g.lineTo(128, 190); g.moveTo(80, 120); g.lineTo(176, 120); g.stroke();
});
const wallpaperTex = () => ctex("wallpaper60s", 512, 512, (g) => {
  g.fillStyle = "#e9d8a6"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(160,120,60,0.18)"; g.fillRect(x, 0, 18, 512); }
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 128 + 64 + (y % 2) * 32, cy = y * 128 + 64; g.fillStyle = "#c98a3a"; for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 9, 6, a, 0, 7); g.fill(); } g.fillStyle = "#8c5a2a"; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill(); }
});
const windowTex = () => ctex("homeWindow", 256, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#9fc4e8"); gr.addColorStop(1, "#d9ecf5"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#b8c8a8"; g.fillRect(0, 170, 256, 86); g.fillStyle = "#f1ece0"; g.fillRect(122, 0, 12, 256); g.fillRect(0, 122, 256, 12); g.lineWidth = 16; g.strokeStyle = "#f1ece0"; g.strokeRect(0, 0, 256, 256);
  g.fillStyle = "rgba(200,60,60,0.85)"; g.fillRect(0, 0, 40, 256); g.fillRect(216, 0, 40, 256);
});
const rugTex = () => ctex("rug", 512, 512, (g) => {
  g.fillStyle = "#8c2f39"; g.fillRect(0, 0, 512, 512); g.strokeStyle = "#e8c45a"; g.lineWidth = 14; g.strokeRect(30, 30, 452, 452); g.strokeStyle = "#2f5f6a"; g.lineWidth = 8; g.strokeRect(60, 60, 392, 392);
  g.fillStyle = "#e8c45a"; g.beginPath(); g.moveTo(256, 140); g.lineTo(372, 256); g.lineTo(256, 372); g.lineTo(140, 256); g.closePath(); g.fill();
});
const wheelTex = (key: string, spokes: number, centre: string) => ctex("wheel" + key, 512, 512, (g) => {
  const c = 256;
  g.clearRect(0, 0, 512, 512);
  g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(c, c, 254, 0, 7); g.fill();                 // tyre (steel)
  g.fillStyle = "#9ea3ab"; g.beginPath(); g.arc(c, c, 236, 0, 7); g.fill();
  g.fillStyle = centre; g.beginPath(); g.arc(c, c, 214, 0, 7); g.fill();                    // rim
  g.fillStyle = "#1f1d24"; g.beginPath(); g.arc(c, c, 196, 0, 7); g.fill();                 // gaps between spokes
  g.fillStyle = centre;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    g.save(); g.translate(c, c); g.rotate(a); g.beginPath(); g.moveTo(-15, 0); g.lineTo(-9, 200); g.lineTo(9, 200); g.lineTo(15, 0); g.fill(); g.restore();
  }
  g.beginPath(); g.arc(c, c, 62, 0, 7); g.fill();                                              // hub
  g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(c, c, 26, 0, 7); g.fill();
  g.strokeStyle = "#141218"; g.lineWidth = 7; for (const r of [254, 214, 196, 62]) { g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
});
/** carriage side livery: maroon lower panels, cream upper with windows, doors, lining */
const liveryTex = () => ctex("livery", 2048, 512, (g, r) => {
  const W = 2048, H = 512;
  g.fillStyle = "#efe2c2"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#7a2630"; g.fillRect(0, H * 0.52, W, H * 0.48);
  g.fillStyle = "#c9a23a"; g.fillRect(0, H * 0.5, W, 8); g.fillRect(0, H * 0.94, W, 6);
  g.fillStyle = "#7a2630"; g.fillRect(0, 0, W, 22);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.5) * W) / n, ww = W / n * 0.62, y0 = H * 0.13, hh = H * 0.32;
    const gr = g.createLinearGradient(0, y0, 0, y0 + hh); gr.addColorStop(0, "#9fb4e0"); gr.addColorStop(1, "#4d5f9c");
    g.fillStyle = "#5a2a22"; g.fillRect(cx - ww / 2 - 8, y0 - 8, ww + 16, hh + 16);
    g.fillStyle = gr; g.fillRect(cx - ww / 2, y0, ww, hh);
    g.fillStyle = "rgba(255,255,255,0.45)"; g.save(); g.beginPath(); g.rect(cx - ww / 2, y0, ww, hh); g.clip();
    g.translate(cx - ww * 0.15, y0 + hh / 2); g.rotate(0.6); g.fillRect(-8, -hh, 16, hh * 2); g.restore();
    if (i % 2 === 0) { g.strokeStyle = "rgba(40,20,20,0.6)"; g.lineWidth = 4; g.strokeRect(cx - ww / 2 - 30, H * 0.08, ww + 60, H * 0.84); }
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(80,40,30,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * W, H * (0.55 + r() * 0.4), 40 + r() * 80, 10 + r() * 20, 0, 0, 7); g.fill(); }
});
const clockTex = () => ctex("stationClock", 256, 256, (g) => {
  g.fillStyle = "#f6f1e3"; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill();
  g.strokeStyle = "#1c1a20"; g.lineWidth = 10; g.stroke();
  g.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); g.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); g.stroke(); }
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(186, 150); g.stroke();
});
const SKY_V = "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_F = `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
  void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
    vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
    c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`;

export class World {
  root = new THREE.Group();
  private sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  private hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private clouds: THREE.Mesh[] = [];
  private cloudMaps: Record<LightName, THREE.Texture[]>;
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
      const gr = g.createRadialGradient(64, 64, 44, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.disc.layers.set(NOINK); this.disc.frustumCulled = false; R.add(this.disc);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.sun, this.sun.target, this.hemi);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    const b = new Batch();
    const M = (key: string, col: string) => lam(key, () => ({ color: col }));
    const T = (key: string, tex: () => THREE.Texture) => lam(key, () => ({ map: tex() }));
    const gold = twoTone(new THREE.MeshPhongMaterial({ color: "#d6a63c", specular: "#fff1c0", shininess: 70 }), 0.15);
    const brass = twoTone(new THREE.MeshPhongMaterial({ color: "#c9a23a", specular: "#fff1c0", shininess: 80 }), 0.15);
    const wood = T("darkWood", () => planksHD());
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material, tile = 0) => b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile), m);
    /** a gilt-framed painting on a wall facing -z at (x, y) (centre), w x h; key picks the canvas */
    const painting = (x: number, y: number, z: number, w: number, h: number, key: number) => {
      const f = 0.12;
      box(x - w / 2 - f, y - h / 2 - f, z - 0.08, x + w / 2 + f, y + h / 2 + f, z, gold);
      b.add(quad(V(x + w / 2, y - h / 2, z - 0.081), V(x - w / 2, y - h / 2, z - 0.081), V(x - w / 2, y + h / 2, z - 0.081), V(x + w / 2, y + h / 2, z - 0.081)), lam("canvas" + key, () => ({ map: canvasTex(key) })));
    };
    b.add(groundW(-400, 400, -400, 400, 8, -0.02), M("outside", "#6f7a62"));

    // ===== A. the gallery room (origin): crimson walls, gilt frames, parquet, benches, brass rope posts =====
    b.add(groundW(-12, 12, -7, 8, 2.5, 0.0), T("parquet", () => planksHD()));
    const wallM = T("galleryWall", () => damaskTex());
    b.add(quad(V(12, 0, 8), V(-12, 0, 8), V(-12, 9, 8), V(12, 9, 8), 14, 5.2), wallM);
    for (const sx of [-1, 1]) b.add(quad(V(sx * 12, 0, sx > 0 ? -7 : 8), V(sx * 12, 0, sx > 0 ? 8 : -7), V(sx * 12, 9, sx > 0 ? 8 : -7), V(sx * 12, 9, sx > 0 ? -7 : 8), 4, 2.2), wallM);
    box(-12, 0, 7.7, 12, 0.9, 8, wood);                 // dado
    box(-12, 0.88, 7.62, 12, 0.98, 8, M("dadoRail", "#5a3b2a"));
    box(-12, 4.6, 7.8, 12, 4.75, 8, M("pictureRail", "#d9c08a"));
    box(-12, 8.2, 7.6, 12, 9, 8, M("cornice", "#efe6d2"));
    for (const sx of [-1, 1]) { box(sx * 12 - (sx > 0 ? 0.3 : 0), 0, -7, sx * 12 + (sx > 0 ? 0 : 0.3), 0.9, 8, wood); }
    painting(-3.1, 2.55, 8, 1.7, 1.3, 1); painting(3.1, 2.7, 8, 1.3, 1.75, 2); painting(-6.2, 2.5, 8, 1.4, 1.7, 3); painting(6.2, 2.5, 8, 1.8, 1.3, 4);
    painting(-2.0, 5.5, 8, 1.4, 1.0, 5); painting(2.2, 5.6, 8, 1.2, 1.5, 6); painting(-5.4, 5.6, 8, 1.6, 1.2, 0); painting(5.6, 5.5, 8, 1.3, 1.0, 3);
    // the Goya's place: an easel-free spot on the wall, centre (drawn in 2D), with a small brass label
    box(-0.32, 1.25, 7.9, 0.32, 1.42, 7.98, brass);
    // benches + rope barrier
    for (const x of [-4, 4]) { box(x - 1.3, 0, 2.4, x + 1.3, 0.42, 3.2, M("benchLeather", "#3b2a2a")); box(x - 1.35, 0.42, 2.35, x + 1.35, 0.5, 3.25, M("benchTop", "#5a3b2a")); }
    for (const x of [-2.4, -0.8, 0.8, 2.4]) { b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 12).translate(x, 0.47, 6.6), brass); b.add(new THREE.SphereGeometry(0.08, 12, 8).translate(x, 0.97, 6.6), brass); b.add(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16).translate(x, 0.025, 6.6), brass); }
    for (const [x0, x1] of [[-2.4, -0.8], [-0.8, 0.8], [0.8, 2.4]]) b.add(new THREE.CylinderGeometry(0.03, 0.03, x1 - x0, 8).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, 0.82, 6.6), M("rope", "#9c2f35"));

    // ===== B. the gallery's back wall outside, at night (x = 60): stone, a little toilet window, drainpipe, bins =====
    const OX = 60;
    b.add(groundW(OX - 20, OX + 20, -12, 0, 2.2, 0.0), lam("cobbleHD", () => ({ map: cobbleHD() })));
    box(OX - 20, 0, 0, OX + 20, 12, 1.2, lam("ashlar", () => ({ map: stoneHD("ashlar", ["#cfc6b4", "#c2b8a5", "#d8d0bf", "#bab09d"], "#9a907e") })), 3);
    box(OX - 20, 0, -0.08, OX + 20, 0.5, 1.2, M("plinth", "#9d9483"));
    box(OX - 20, 7.6, -0.25, OX + 20, 7.9, 1.2, M("stringCourse", "#e2d9c6"));
    // the toilet window: recessed frosted glass in a white frame, sill
    box(OX - 0.55, 2.15, -0.06, OX + 0.55, 3.15, 0.0, M("winFrame", "#f1ece0"));
    b.add(quad(V(OX + 0.45, 2.25, -0.07), V(OX - 0.45, 2.25, -0.07), V(OX - 0.45, 3.05, -0.07), V(OX + 0.45, 3.05, -0.07)), lam("frosted", () => ({ color: "#ffd98a", emissive: "#ffb347", emissiveIntensity: 0.9 })));
    box(OX - 0.08, 2.25, -0.09, OX + 0.08 - 0.12, 3.05, -0.07, M("winBar", "#f1ece0"));
    box(OX - 0.7, 2.05, -0.22, OX + 0.7, 2.15, 0.0, M("sill", "#e2d9c6"));
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 9, 10).translate(OX + 1.3, 4.5, -0.12), M("pipe", "#3b3f52"));
    for (const x of [OX - 1.6, OX - 0.6]) { box(x - 0.4, 0, -1.1, x + 0.4, 1.05, -0.35, M("bin" + x, "#5d6068")); box(x - 0.45, 1.05, -1.15, x + 0.45, 1.12, -0.3, M("binLid", "#4a4d55")); }
    box(OX + 3.0, 0, -0.4, OX + 3.15, 3.6, -0.25, M("lampPost", "#2b2830"));
    box(OX + 2.85, 3.6, -0.55, OX + 3.3, 4.0, -0.1, lam("lampGlass", () => ({ color: "#fff1c0", emissive: "#ffd58a", emissiveIntensity: 1.2 })));

    // ===== C. the courtroom (x = 120): panelled walls, raised judge's bench, the dock (left), the jury box (right) =====
    const CX = 120;
    b.add(groundW(CX - 10, CX + 10, -9, 8, 2.5, 0.0), T("courtFloor", () => planksHD()));
    b.add(quad(V(CX + 10, 0, 7.5), V(CX - 10, 0, 7.5), V(CX - 10, 8, 7.5), V(CX + 10, 8, 7.5), 5, 2), T("courtPlaster", () => damaskTex("#d9c9a6", "#cbb991")));
    for (const sx of [-1, 1]) b.add(quad(V(CX + sx * 10, 0, sx > 0 ? -9 : 7.5), V(CX + sx * 10, 0, sx > 0 ? 7.5 : -9), V(CX + sx * 10, 8, sx > 0 ? 7.5 : -9), V(CX + sx * 10, 8, sx > 0 ? -9 : 7.5), 4, 2), T("courtPlaster", () => damaskTex("#d9c9a6", "#cbb991")));
    box(CX - 10, 0, 7.2, CX + 10, 3.2, 7.5, wood, 2);
    box(CX - 3, 0, 4.8, CX + 3, 0.6, 7.2, wood);                      // dais
    box(CX - 2.6, 0.6, 4.9, CX + 2.6, 1.85, 5.25, wood);              // bench front
    box(CX - 2.7, 1.85, 4.8, CX + 2.7, 1.95, 5.6, M("benchTopC", "#5a3b2a"));
    box(CX - 0.7, 0.6, 6.4, CX + 0.7, 3.6, 6.7, M("throne", "#7a2630"));  // judge's high-backed chair
    b.add(new THREE.CircleGeometry(0.75, 32).rotateY(Math.PI).translate(CX, 4.6, 7.19), lam("crest", () => ({ map: crestTex() })));
    // dock (left, nearer the lens) and jury box (right)
    box(CX - 4.5, 0, 0.2, CX - 2.1, 1.15, 0.35, wood); box(CX - 4.5, 0, 0.2, CX - 4.35, 1.15, 2.6, wood); box(CX - 2.25, 0, 0.2, CX - 2.1, 1.15, 2.6, wood);
    for (const x of [CX - 4.4, CX - 3.3, CX - 2.2]) box(x - 0.03, 1.15, 0.25, x + 0.03, 1.9, 0.31, brass);
    box(CX - 4.5, 1.88, 0.22, CX - 2.1, 1.94, 0.34, brass);
    box(CX + 2.3, 0, 0.6, CX + 5.7, 0.95, 0.75, wood); box(CX + 2.3, 0, 0.6, CX + 2.45, 0.95, 4.2, wood);
    box(CX + 2.5, 0, 2.2, CX + 5.7, 0.35, 4.2, wood);                 // raised back row
    box(CX - 1.2, 0, 1.6, CX + 1.2, 0.8, 2.4, wood);                  // counsel table
    box(CX - 1.3, 0.8, 1.55, CX + 1.3, 0.86, 2.45, M("tableTop", "#5a3b2a"));

    // ===== D. the pensioner's front room (x = 180): wallpaper, window, armchair, 1960s TV, rug, standard lamp =====
    const HX = 180;
    b.add(groundW(HX - 7, HX + 7, -6, 5, 2.0, 0.0), T("homeBoards", () => planksHD()));
    const paperM = T("wallpaper", () => wallpaperTex());
    b.add(quad(V(HX + 7, 0, 5), V(HX - 7, 0, 5), V(HX - 7, 6, 5), V(HX + 7, 6, 5), 5, 2), paperM);
    for (const sx of [-1, 1]) b.add(quad(V(HX + sx * 7, 0, sx > 0 ? -6 : 5), V(HX + sx * 7, 0, sx > 0 ? 5 : -6), V(HX + sx * 7, 6, sx > 0 ? 5 : -6), V(HX + sx * 7, 6, sx > 0 ? -6 : 5), 4, 2), paperM);
    box(HX - 7, 0, 4.85, HX + 7, 0.15, 5, M("skirting", "#efe6d2"));
    b.add(quad(V(HX + 4.6, 1.1, 4.97), V(HX + 2.4, 1.1, 4.97), V(HX + 2.4, 2.8, 4.97), V(HX + 4.6, 2.8, 4.97)), lam("homeWindow", () => ({ map: windowTex() })));
    box(HX + 2.3, 1.0, 4.85, HX + 4.7, 1.1, 5, M("homeSill", "#efe6d2"));
    b.add(groundW(HX - 3.2, HX + 3.2, -0.8, 3.4, 6.4, 0.012), lam("rug", () => ({ map: rugTex() })));
    // armchair (centre-left) facing the TV (right)
    const chair = M("chairFab", "#7a5a3a");
    box(HX - 1.6, 0.0, 1.1, HX - 0.2, 0.5, 2.4, chair); box(HX - 1.75, 0.0, 1.0, HX - 1.45, 1.25, 2.5, chair);
    box(HX - 1.75, 0.0, 0.95, HX - 0.15, 0.8, 1.2, chair); box(HX - 1.75, 0.0, 2.3, HX - 0.15, 0.8, 2.55, chair);
    // the television: wooden cabinet on legs, grey screen
    for (const [x, z] of [[1.15, 2.1], [2.25, 2.1], [1.15, 2.9], [2.25, 2.9]]) box(HX + x - 0.04, 0, z - 0.04, HX + x + 0.04, 0.4, z + 0.04, M("tvLeg", "#3a2a20"));
    box(HX + 1.0, 0.4, 2.0, HX + 2.4, 1.45, 3.0, wood);
    b.add(quad(V(HX + 2.15, 0.55, 1.99), V(HX + 1.25, 0.55, 1.99), V(HX + 1.25, 1.3, 1.99), V(HX + 2.15, 1.3, 1.99)), lam("tvScreen", () => ({ color: "#9aa6b0", emissive: "#5d7a8c", emissiveIntensity: 0.35 })));
    b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 6).rotateZ(0.5).translate(HX + 1.5, 1.7, 2.5), M("antenna", "#2b2830"));
    b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 6).rotateZ(-0.5).translate(HX + 1.9, 1.7, 2.5), M("antenna", "#2b2830"));
    box(HX - 5.6, 0, 3.6, HX - 4.2, 2.3, 4.8, wood);                   // wardrobe
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8).translate(HX - 3.6, 0.85, 3.8), brass);
    b.add(new THREE.CylinderGeometry(0.22, 0.35, 0.4, 16, 1, true).translate(HX - 3.6, 1.85, 3.8), lam("lampShade", () => ({ color: "#f2d39a", side: THREE.DoubleSide })));
    b.build(R);
  }

  update(p: PlateDef, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const L = LIGHTS[p.light], K = LOOK[p.light];
    cam.position.set(...p.pos); cam.up.set(0, 1, 0); cam.lookAt(...p.look);
    cam.fov = p.fov; cam.near = 0.1; cam.far = 1500; cam.aspect = (p.w ?? 1620) / 2880; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
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
