// The sets of the grave-cage short as one static three.js scene, lit per plate with the template's two-tone rig:
// an Edinburgh kirkyard (church + tower, boundary wall and gate, gravestones, a watchtower, the hero grave with its
// optional mound / snatchers' head-end hole / fully opened pit / iron mortsafe), an anatomy theatre (tiered benches
// around one table) and an Old Town close (tall stone tenements). Night swaps in lit windows and lanterns (HDR glass,
// so the bloom pass makes them glow) and a moon disc.
import * as THREE from "three";
import { Batch, V, lam, boxGeo, quad, tri, house, prop, Kit, Style } from "./build";
import { ctex, rep, stoneHD, cobbleHD, grassHD, roofHD, planksHD, beamHD, cloudHD, facadeHD, rng, jit } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { PlateDef, Show, ANAT, CLOSE, HERO, TOWER, TABLE } from "./story";

type LightName = "day" | "golden" | "night";
/** flat ground quad with WORLD-space uvs (tiles line up across neighbouring quads) */
const groundW = (x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) => {
  const g = new THREE.BufferGeometry();
  const P = [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]];
  g.setAttribute("position", new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x, y, z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x / tile, -z / tile]), 2));
  return g;
};
const dirtTex = () => ctex("graveDirt", 1024, 1024, (g, r) => {
  g.fillStyle = "#7a5638"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1100; i++) {
    const x = r() * 1024, y = r() * 1024, s = 4 + r() * 24;
    g.fillStyle = r() > 0.5 ? `rgba(60,38,24,${0.1 + r() * 0.12})` : `rgba(170,128,90,${0.08 + r() * 0.1})`;
    g.beginPath(); g.ellipse(x, y, s * 1.4, s, r() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = jit(r, "#8d8478", 0.2); g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 4 + r() * 7, 3 + r() * 5, r() * 3, 0, 7); g.fill(); }
});
const gravelTex = () => ctex("gravel", 512, 512, (g, r) => {
  g.fillStyle = "#b9ad98"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = jit(r, ["#a89c88", "#c9bea8", "#968b78"][i % 3], 0.15); g.beginPath(); g.ellipse(r() * 512, r() * 512, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill(); }
});
/** pointed gothic window: glass + leading; lit = warm candle glow, else dark night-blue glass */
const gothicTex = (lit: boolean) => ctex("gothic" + lit, 256, 512, (g) => {
  g.clearRect(0, 0, 256, 512);
  g.beginPath(); g.moveTo(16, 512); g.lineTo(16, 180); g.quadraticCurveTo(16, 30, 128, 8); g.quadraticCurveTo(240, 30, 240, 180); g.lineTo(240, 512); g.closePath();
  const gr = g.createLinearGradient(0, 0, 0, 512);
  if (lit) { gr.addColorStop(0, "#ffd88a"); gr.addColorStop(1, "#ff9a3c"); } else { gr.addColorStop(0, "#5a6cb0"); gr.addColorStop(1, "#2c3770"); }
  g.fillStyle = gr; g.fill();
  g.strokeStyle = "#2a2230"; g.lineWidth = 14; g.stroke();
  g.lineWidth = 7; g.beginPath(); g.moveTo(128, 30); g.lineTo(128, 512); g.moveTo(16, 300); g.lineTo(240, 300); g.moveTo(16, 420); g.lineTo(240, 420); g.stroke();
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
  private groups: Record<Show, THREE.Group> = { mound: new THREE.Group(), cage: new THREE.Group(), headhole: new THREE.Group(), pit: new THREE.Group() };
  /** materials that change between day and night (window glass, lantern glass) */
  private swaps: { mesh: THREE.Mesh; day: THREE.Material; night: THREE.Material }[] = [];

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
    for (const g of Object.values(this.groups)) R.add(g);

    const b = new Batch();
    const grassM = lam("grassHD", () => ({ map: grassHD() }));
    const dirtM = lam("graveDirt", () => ({ map: dirtTex() }));
    const gravelM = lam("gravel", () => ({ map: gravelTex() }));
    const cobM = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const greyStone = lam("kirkStone", () => ({ map: stoneHD("kirkStone", ["#b9b4a8", "#aaa598", "#c4bfb2", "#a09b8e"], "#7e796e") }));
    const headM = [0, 1, 2].map((k) => lam("headstone" + k, () => ({ color: ["#a9a69c", "#9d9a92", "#b6b1a4"][k] })));
    const woodM = lam("beamHD", () => ({ map: beamHD() })), planksM = lam("planksHD", () => ({ map: planksHD() }));
    const slateM = lam("roofSlate", () => ({ map: roofHD("#8f97a8", true), side: THREE.DoubleSide }));
    const ironM = twoTone(new THREE.MeshPhongMaterial({ color: "#3a3d48", specular: "#9a9aa8", shininess: 60 }), 0.15);
    const glassDay = lam("lampGlassDay", () => ({ color: "#f3e7c4" }));
    const glassNight = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.0) });
    const winDay = lam("winDay", () => ({ color: "#34416e" }));
    const winNight = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.55, 0.7) });
    const swap = (geo: THREE.BufferGeometry, day: THREE.Material, night: THREE.Material, parent: THREE.Object3D = R) => {
      const m = new THREE.Mesh(geo, day); m.receiveShadow = true; parent.add(m); this.swaps.push({ mesh: m, day, night }); return m;
    };
    const lantern = (x: number, y: number, z: number, s = 1) => {
      b.add(boxGeo(V(x - 0.16 * s, y, z - 0.16 * s), V(x + 0.16 * s, y + 0.05 * s, z + 0.16 * s)), ironM);
      swap(new THREE.BoxGeometry(0.26 * s, 0.34 * s, 0.26 * s).translate(x, y + 0.05 * s + 0.17 * s, z), glassDay, glassNight);
      b.add(new THREE.ConeGeometry(0.24 * s, 0.22 * s, 4).rotateY(Math.PI / 4).translate(x, y + 0.5 * s, z), ironM);
    };

    // ================= the kirkyard =================
    // ground with an opening where the hero grave is (its lid / pit come from the optional groups)
    const gx0 = HERO.x - HERO.w / 2 - 0.05, gx1 = HERO.x + HERO.w / 2 + 0.05, gz0 = HERO.z0 - 0.05, gz1 = HERO.z1 + 0.05;
    b.add(groundW(-400, gx0, -400, 400, 8, -0.01), grassM); b.add(groundW(gx1, 400, -400, 400, 8, -0.01), grassM);
    b.add(groundW(gx0, gx1, -400, gz0, 8, -0.01), grassM); b.add(groundW(gx0, gx1, gz1, 400, 8, -0.01), grassM);
    b.add(groundW(-5.0, -2.4, -16, 14.5, 3, 0.004), gravelM); // path gate -> church
    // boundary wall + gate + lantern
    const wallH = 1.35;
    const wallSeg = (x0: number, x1: number, z0: number, z1: number) => {
      b.add(boxGeo(V(x0, 0, z0), V(x1, wallH, z1), 1.5), greyStone);
      b.add(boxGeo(V(x0 - 0.06, wallH, z0 - 0.06), V(x1 + 0.06, wallH + 0.12, z1 + 0.06), 1.5), greyStone);
    };
    wallSeg(-20, -5.4, 14, 14.5); wallSeg(-2.0, 20, 14, 14.5); wallSeg(-20.5, -20, -34, 14.5); wallSeg(20, 20.5, -34, 14.5); wallSeg(-20.5, 20.5, -34.5, -34);
    for (const x of [-5.6, -1.8]) { b.add(boxGeo(V(x - 0.3, 0, 13.95), V(x + 0.3, 2.1, 14.55), 1), greyStone); b.add(new THREE.SphereGeometry(0.22, 12, 8).translate(x, 2.32, 14.25), greyStone); }
    for (let x = -5.2; x <= -2.2; x += 0.18) b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6).translate(x, 0.85, 14.25), ironM);
    b.add(boxGeo(V(-5.3, 1.55, 14.22), V(-2.1, 1.6, 14.28)), ironM); b.add(boxGeo(V(-5.3, 0.25, 14.22), V(-2.1, 0.3, 14.28)), ironM);
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8).translate(-6.4, 1.3, 13.4), ironM); lantern(-6.4, 2.6, 13.4);
    // church: nave, gable, pitched slate roof, west tower with spire, lit gothic windows at night
    const ch = { x0: -10, x1: 4, z0: -32, z1: -18, h: 9 };
    b.add(boxGeo(V(ch.x0, 0, ch.z0), V(ch.x1, ch.h, ch.z1), 3), greyStone);
    const cx = (ch.x0 + ch.x1) / 2, rh = 4.2;
    b.add(tri(V(ch.x0, ch.h, ch.z1), V(ch.x1, ch.h, ch.z1), V(cx, ch.h + rh, ch.z1)), greyStone);
    b.add(tri(V(ch.x1, ch.h, ch.z0), V(ch.x0, ch.h, ch.z0), V(cx, ch.h + rh, ch.z0)), greyStone);
    b.add(quad(V(ch.x0 - 0.4, ch.h - 0.2, ch.z1 + 0.4), V(cx, ch.h + rh + 0.1, ch.z1 + 0.4), V(cx, ch.h + rh + 0.1, ch.z0 - 0.4), V(ch.x0 - 0.4, ch.h - 0.2, ch.z0 - 0.4), 2, 5), slateM);
    b.add(quad(V(cx, ch.h + rh + 0.1, ch.z1 + 0.4), V(ch.x1 + 0.4, ch.h - 0.2, ch.z1 + 0.4), V(ch.x1 + 0.4, ch.h - 0.2, ch.z0 - 0.4), V(cx, ch.h + rh + 0.1, ch.z0 - 0.4), 2, 5), slateM);
    const gl = (lit: boolean) => new THREE.MeshBasicMaterial({ map: gothicTex(lit), transparent: true, alphaTest: 0.5, color: lit ? new THREE.Color(1.9, 1.5, 1.1) : new THREE.Color(0.85, 0.85, 0.95) });
    const gDay = gl(false), gNight = gl(true);
    const gwin = (x: number, y: number, z: number, w: number, h: number, ry: number) => {
      const m = swap(new THREE.PlaneGeometry(w, h), gDay, gNight); m.position.set(x, y, z); m.rotation.y = ry;
    };
    gwin(cx, 5.2, ch.z1 + 0.02, 2.2, 4.6, 0);
    for (const z of [-21.5, -25, -28.5]) gwin(ch.x1 + 0.02, 4.2, z, 1.4, 3.6, Math.PI / 2);
    b.add(boxGeo(V(cx - 0.9, 0, ch.z1), V(cx + 0.9, 2.8, ch.z1 + 0.12)), lam("churchDoor", () => ({ color: "#4a2e22" })));
    const tw = { x0: -13.5, x1: -9.5, z0: -21.5, z1: -17.5 };
    b.add(boxGeo(V(tw.x0, 0, tw.z0), V(tw.x1, 17, tw.z1), 3), greyStone);
    b.add(boxGeo(V(tw.x0 - 0.2, 16.6, tw.z0 - 0.2), V(tw.x1 + 0.2, 17.3, tw.z1 + 0.2), 2), greyStone);
    b.add(new THREE.ConeGeometry(2.6, 10, 4).rotateY(Math.PI / 4).translate((tw.x0 + tw.x1) / 2, 17.3 + 5, (tw.z0 + tw.z1) / 2), slateM);
    gwin((tw.x0 + tw.x1) / 2, 12.5, tw.z1 + 0.02, 1.2, 2.6, 0);
    // the watchtower (a small round stone tower with a conical roof, a door and two lit windows)
    const [tx, , tz] = TOWER;
    b.add(new THREE.CylinderGeometry(1.75, 1.85, 6.2, 28).translate(tx, 3.1, tz), greyStone);
    b.add(new THREE.CylinderGeometry(1.95, 1.95, 0.3, 28).translate(tx, 6.35, tz), greyStone);
    b.add(new THREE.ConeGeometry(2.15, 2.6, 28).translate(tx, 7.8, tz), slateM);
    b.add(boxGeo(V(tx - 0.45, 0, tz + 1.62), V(tx + 0.45, 1.9, tz + 1.9)), lam("towerDoor", () => ({ color: "#3e2a20" })));
    for (const [a, y] of [[0.35, 3.9], [-0.9, 3.9]] as const) {
      const wm = swap(new THREE.PlaneGeometry(0.7, 1.0), winDay, winNight);
      wm.position.set(tx + Math.sin(a) * 1.8, y, tz + Math.cos(a) * 1.8); wm.rotation.y = a;
    }
    // gravestones: headstones, crosses, table tombs, obelisks (avoiding the path, the hero grave, the tower, the church)
    const rr = rng(21);
    const free = (x: number, z: number) => !(x > -5.6 && x < -1.8) && !(x > 0.0 && x < 4.4 && z > -1.8 && z < 3.6) && Math.hypot(x - tx, z - tz) > 3.2 && z > -16.5 && z < 12.5 && Math.abs(x) < 19;
    const stone = (x: number, z: number, kind: number, yaw: number, tilt: number) => {
      const m = new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, tilt * 0.5)), V(1, 1, 1));
      const sm = headM[Math.floor(rr() * 3)];
      if (kind === 0) { // round-topped headstone
        const h = 0.75 + rr() * 0.4, w = 0.6 + rr() * 0.25;
        b.add(boxGeo(V(-w / 2, 0, -0.07), V(w / 2, h, 0.07)), sm, m);
        b.add(new THREE.CylinderGeometry(w / 2, w / 2, 0.14, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, h, 0), sm, m);
      } else if (kind === 1) { // cross
        b.add(boxGeo(V(-0.07, 0, -0.07), V(0.07, 1.15, 0.07)), sm, m);
        b.add(boxGeo(V(-0.3, 0.72, -0.07), V(0.3, 0.86, 0.07)), sm, m);
        b.add(boxGeo(V(-0.2, 0, -0.16), V(0.2, 0.12, 0.16)), sm, m);
      } else if (kind === 2) { // table tomb
        b.add(boxGeo(V(-0.55, 0.62, -1.0), V(0.55, 0.74, 1.0)), sm, m);
        for (const lx of [-0.42, 0.42]) for (const lz of [-0.85, 0.85]) b.add(boxGeo(V(lx - 0.08, 0, lz - 0.08), V(lx + 0.08, 0.62, lz + 0.08)), sm, m);
      } else { // obelisk
        b.add(boxGeo(V(-0.32, 0, -0.32), V(0.32, 0.35, 0.32)), sm, m);
        b.add(new THREE.CylinderGeometry(0.15, 0.24, 1.9, 4).rotateY(Math.PI / 4).translate(0, 1.3, 0), sm, m);
        b.add(new THREE.ConeGeometry(0.17, 0.25, 4).rotateY(Math.PI / 4).translate(0, 2.37, 0), sm, m);
      }
    };
    for (let z = -14; z <= 11; z += 2.6) for (let x = -18; x <= 18; x += 1.9) {
      const jx = x + (rr() - 0.5) * 0.7, jz = z + (rr() - 0.5) * 0.6;
      if (!free(jx, jz) || rr() < 0.18) continue;
      const u = rr(), kind = u < 0.58 ? 0 : u < 0.76 ? 1 : u < 0.9 ? 2 : 3;
      stone(jx, jz, kind, (rr() - 0.5) * 0.25, (rr() - 0.5) * 0.12);
    }
    // the hero grave's headstone + kerb
    stone(HERO.x, HERO.z0 - 0.2, 0, 0, -0.02);
    // yews and oaks around the walls; houses beyond (Edinburgh)
    for (let i = 0; i < 9; i++) prop(b, kit, "tree_cone", -18 + i * 4.5, 0, -33 + (i % 2), 5 + (i % 3), i + 3);
    for (let i = 0; i < 6; i++) { prop(b, kit, "tree_oak", -19.2, 0, -12 + i * 4.2, 6 + (i % 2), i + 30); prop(b, kit, "tree_oak", 19.2, 0, -10 + i * 4.2, 6 + (i % 3), i + 40); }
    prop(b, kit, "tree_cone", 6.2, 0, -3.4, 4.2, 77); prop(b, kit, "tree_cone", -1.4, 0, -4.4, 3.6, 78);
    const GREY: Style[] = [{ wall: "#bdb4a4", shutter: "#3b3f52", roof: "#8f97a8" }, { wall: "#a9a294", shutter: "#5a3b2a", roof: "#8f97a8" }, { wall: "#c7bca8", shutter: "#2f5f6a", roof: "#8e7aa0" }];
    for (let i = 0; i < 8; i++) house(b, -30 + i * 8.6, -46, 0, 8, 7, 11 + (i % 3) * 1.6, 400 + i, 0, GREY[i % 3]);

    // ---- optional hero-grave pieces ----
    const gb = { mound: new Batch(), cage: new Batch(), headhole: new Batch(), pit: new Batch() };
    const zm = 0.75; // head part ends here
    const lid = (bb: Batch, z0: number, z1: number) => bb.add(groundW(gx0, gx1, z0, z1, 3, -0.005), dirtM);
    lid(gb.mound, gz0, zm); lid(gb.mound, zm, gz1);
    const moundGeo = (zA: number, zB: number) => new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.55, 0.24, (zB - zA) / 2 + 0.05).translate(HERO.x, 0, (zA + zB) / 2);
    gb.mound.add(moundGeo(HERO.z0, HERO.z1), dirtM);
    // pit walls (inward) + floor, depth d, over z0..z1
    const pit = (bb: Batch, z0: number, z1: number, d: number) => {
      bb.add(quad(V(gx0, -d, z0), V(gx1, -d, z0), V(gx1, 0, z0), V(gx0, 0, z0), 1, d / 1.5), dirtM);
      bb.add(quad(V(gx1, -d, z1), V(gx0, -d, z1), V(gx0, 0, z1), V(gx1, 0, z1), 1, d / 1.5), dirtM);
      bb.add(quad(V(gx0, -d, z1), V(gx0, -d, z0), V(gx0, 0, z0), V(gx0, 0, z1), (z1 - z0) / 1.5, d / 1.5), dirtM);
      bb.add(quad(V(gx1, -d, z0), V(gx1, -d, z1), V(gx1, 0, z1), V(gx1, 0, z0), (z1 - z0) / 1.5, d / 1.5), dirtM);
      bb.add(groundW(gx0, gx1, z0, z1, 3, -d), dirtM);
    };
    const coffinWood = lam("coffinWood", () => ({ color: "#6a4330" })), coffinIn = lam("coffinIn", () => ({ color: "#d8cdb8" }));
    const coffin = (bb: Batch, y: number, z0: number, z1: number, open: boolean) => {
      const x0 = HERO.x - 0.3, x1 = HERO.x + 0.3, t = 0.04;
      bb.add(boxGeo(V(x0, y, z0), V(x1, y + 0.05, z1)), coffinWood);
      bb.add(boxGeo(V(x0 + t, y + 0.05, z0 + t), V(x1 - t, y + 0.06, z1 - t)), coffinIn);
      for (const [a, c] of [[x0, x0 + t], [x1 - t, x1]]) bb.add(boxGeo(V(a, y, z0), V(c, y + 0.34, z1)), coffinWood);
      for (const [a, c] of [[z0, z0 + t], [z1 - t, z1]]) bb.add(boxGeo(V(x0, y, a), V(x1, y + 0.34, c)), coffinWood);
      if (!open) bb.add(boxGeo(V(x0 - 0.02, y + 0.34, z0 - 0.02), V(x1 + 0.02, y + 0.39, z1 + 0.02)), coffinWood);
    };
    // snatchers' hole: only the head end is opened; the foot end stays a mound
    lid(gb.headhole, zm, gz1);
    gb.headhole.add(moundGeo(zm + 0.05, HERO.z1), dirtM);
    pit(gb.headhole, gz0, zm, 1.35);
    coffin(gb.headhole, -1.35, HERO.z0 + 0.05, HERO.z1, true);
    gb.headhole.add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.75, 0.45, 0.6).translate(HERO.x + 1.15, 0, HERO.z0 + 0.3), dirtM);
    // fully opened grave (Wednesday): empty open coffin, lid propped, spoil heap
    pit(gb.pit, gz0, gz1, 1.5);
    coffin(gb.pit, -1.5, HERO.z0 + 0.05, HERO.z1 - 0.05, true);
    gb.pit.add(boxGeo(V(HERO.x - 0.32, -1.5, HERO.z1 - 0.2), V(HERO.x + 0.32, -1.45, HERO.z1 + 0.0)), coffinWood);
    gb.pit.add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.8, 0.5, 1.2).translate(HERO.x + 1.3, 0, (HERO.z0 + HERO.z1) / 2), dirtM);
    // the mortsafe: iron cage of spear-topped bars with a barred top, on a stone kerb
    const cg = { x0: gx0 - 0.08, x1: gx1 + 0.08, z0: gz0 - 0.08, z1: gz1 + 0.08, h: 1.15 };
    for (const [a, c, d, e] of [[cg.x0 - 0.1, cg.x1 + 0.1, cg.z0 - 0.1, cg.z0 + 0.05], [cg.x0 - 0.1, cg.x1 + 0.1, cg.z1 - 0.05, cg.z1 + 0.1],
      [cg.x0 - 0.1, cg.x0 + 0.05, cg.z0, cg.z1], [cg.x1 - 0.05, cg.x1 + 0.1, cg.z0, cg.z1]]) gb.cage.add(boxGeo(V(a, 0, d), V(c, 0.16, e)), greyStone);
    const bar = (x: number, z: number) => {
      gb.cage.add(new THREE.CylinderGeometry(0.022, 0.022, cg.h, 6).translate(x, 0.16 + cg.h / 2, z), ironM);
      gb.cage.add(new THREE.ConeGeometry(0.045, 0.12, 6).translate(x, 0.16 + cg.h + 0.06, z), ironM);
    };
    const nx = 6, nz = 12;
    for (let i = 0; i <= nx; i++) { const x = cg.x0 + ((cg.x1 - cg.x0) * i) / nx; bar(x, cg.z0); bar(x, cg.z1); }
    for (let k = 1; k < nz; k++) { const z = cg.z0 + ((cg.z1 - cg.z0) * k) / nz; bar(cg.x0, z); bar(cg.x1, z); }
    for (const y of [0.32, 0.16 + cg.h - 0.08]) {
      gb.cage.add(boxGeo(V(cg.x0 - 0.03, y - 0.03, cg.z0 - 0.03), V(cg.x1 + 0.03, y + 0.03, cg.z0 + 0.03)), ironM);
      gb.cage.add(boxGeo(V(cg.x0 - 0.03, y - 0.03, cg.z1 - 0.03), V(cg.x1 + 0.03, y + 0.03, cg.z1 + 0.03)), ironM);
      gb.cage.add(boxGeo(V(cg.x0 - 0.03, y - 0.03, cg.z0), V(cg.x0 + 0.03, y + 0.03, cg.z1)), ironM);
      gb.cage.add(boxGeo(V(cg.x1 - 0.03, y - 0.03, cg.z0), V(cg.x1 + 0.03, y + 0.03, cg.z1)), ironM);
    }
    for (let k = 1; k < 8; k++) { const z = cg.z0 + ((cg.z1 - cg.z0) * k) / 8; gb.cage.add(boxGeo(V(cg.x0, 0.16 + cg.h - 0.11, z - 0.02), V(cg.x1, 0.16 + cg.h - 0.07, z + 0.02)), ironM); }
    for (const k of Object.keys(gb) as Show[]) gb[k].build(this.groups[k]);

    // ================= the anatomy theatre =================
    const [ax, , az] = ANAT;
    b.add(groundW(ax - 8, ax + 8, az - 8, az + 8, 2.5, 0.006), planksM);
    const wallM = lam("anatWall", () => ({ map: facadeHD("anatWall", 16, 9, { wall: "#d8ccb4", shutter: "#5a3b2a" }) }));
    const wallS = lam("anatWallS", () => ({ map: facadeHD("anatWallS", 16, 9, { wall: "#d2c5ac", shutter: "#5a3b2a" }) }));
    b.add(quad(V(ax - 8, 0, az - 8), V(ax + 8, 0, az - 8), V(ax + 8, 9, az - 8), V(ax - 8, 9, az - 8)), wallM);
    b.add(quad(V(ax - 8, 0, az + 8), V(ax - 8, 0, az - 8), V(ax - 8, 9, az - 8), V(ax - 8, 9, az + 8)), wallS);
    b.add(quad(V(ax + 8, 0, az - 8), V(ax + 8, 0, az + 8), V(ax + 8, 9, az + 8), V(ax + 8, 9, az - 8)), wallS);
    // four tiers of benches in a horseshoe around the table (opening toward the camera, +z)
    const [tbx, , tbz] = TABLE;
    for (let t = 0; t < 4; t++) {
      const r0 = 2.9 + t * 0.85, r1 = r0 + 0.8, y = 0.45 * (t + 1), n = 14;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI * (1.05 + (0.9 * i) / n), a1 = Math.PI * (1.05 + (0.9 * (i + 1)) / n);
        const p = (r: number, a: number) => V(tbx + r * Math.cos(a), 0, tbz + r * Math.sin(a));
        const A0 = p(r0, a0), A1 = p(r0, a1), B0 = p(r1, a0), B1 = p(r1, a1);
        b.add(quad(V(A1.x, y, A1.z), V(A0.x, y, A0.z), V(B0.x, y, B0.z), V(B1.x, y, B1.z), 1, 0.3), planksM);                    // step top
        b.add(quad(V(A0.x, y - 0.45, A0.z), V(A1.x, y - 0.45, A1.z), V(A1.x, y, A1.z), V(A0.x, y, A0.z), 1, 0.2), woodM);       // riser
        const R0 = p(r0 + 0.06, a0), R1 = p(r0 + 0.06, a1);
        b.add(quad(V(R0.x, y + 0.75, R0.z), V(R1.x, y + 0.75, R1.z), V(R1.x, y + 0.85, R1.z), V(R0.x, y + 0.85, R0.z)), woodM); // rail
        if (i % 2 === 0) b.add(boxGeo(V(R0.x - 0.03, y, R0.z - 0.03), V(R0.x + 0.03, y + 0.8, R0.z + 0.03)), woodM);
      }
      // solid fill under the tier so no gaps show
      const rB = 2.9 + t * 0.85 + 0.8;
      for (let i = 0; i < 14; i++) {
        const a0 = Math.PI * (1.05 + (0.9 * i) / 14), a1 = Math.PI * (1.05 + (0.9 * (i + 1)) / 14);
        const B0 = V(tbx + rB * Math.cos(a0), 0, tbz + rB * Math.sin(a0)), B1 = V(tbx + rB * Math.cos(a1), 0, tbz + rB * Math.sin(a1));
        b.add(quad(V(B1.x, 0, B1.z), V(B0.x, 0, B0.z), V(B0.x, 0.45 * (t + 1), B0.z), V(B1.x, 0.45 * (t + 1), B1.z)), woodM);
      }
    }
    // the dissection table
    b.add(boxGeo(V(tbx - 1.0, 0.82, tbz - 0.42), V(tbx + 1.0, 0.9, tbz + 0.42), 1), planksM);
    for (const x of [-0.9, 0.9]) for (const z of [-0.34, 0.34]) b.add(boxGeo(V(tbx + x - 0.05, 0, tbz + z - 0.05), V(tbx + x + 0.05, 0.82, tbz + z + 0.05)), woodM);

    // ================= Old Town close =================
    const [ox, , oz] = CLOSE;
    b.add(groundW(ox - 2.6, ox + 2.6, oz - 40, oz + 16, 3, 0.006), cobM);
    const TEN: Style[] = [{ wall: "#bdb4a4", shutter: "#3b3f52", roof: "#8f97a8" }, { wall: "#a9a294", shutter: "#5a3b2a", roof: "#8f97a8" },
      { wall: "#c7bca8", shutter: "#2f5f6a", roof: "#8e7aa0" }, { wall: "#b4a998", shutter: "#8c3b4a", roof: "#8f97a8" }];
    const winGlow = (x: number, z: number, yaw: number, w: number, h: number, seed: number) => {
      const r = rng(seed), floors = Math.max(1, Math.floor(h / 2.8)), n = Math.max(1, Math.floor(w / 2.2));
      for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
        if (r() > 0.42 || (fl === 0 && i === Math.floor(n / 2))) continue;
        const u = (i + 0.5) / n - 0.5, yb = fl * 2.8 + 0.9;
        const gm = swap(new THREE.PlaneGeometry(0.85, 1.25), winDay, winNight);
        gm.rotation.y = yaw;
        const off = 0.03;
        // local front = +z rotated by yaw; local x along the facade
        const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
        gm.position.set(x + lx * u * w + fx * (off + 0.0), yb + 0.625, z + lz * u * w + fz * (off + 0.0));
      }
    };
    let zc = oz + 12, k = 0;
    while (zc > oz - 34) {
      const w = [7, 8.5, 9][k % 3], h = [12.4, 14.0, 15.6][k % 3];
      house(b, ox - 2.6 - 3.6, zc - w / 2, Math.PI / 2, w, 7.2, h, 500 + k, 0, TEN[k % 4]);
      winGlow(ox - 2.6, zc - w / 2, Math.PI / 2, w, h, 600 + k);
      const w2 = [8, 9, 7][k % 3], h2 = [14.0, 12.4, 15.6][k % 3];
      house(b, ox + 2.6 + 3.6, zc - w2 / 2 - 0.6, -Math.PI / 2, w2, 7.2, h2, 520 + k, 0, TEN[(k + 2) % 4]);
      winGlow(ox + 2.6, zc - w2 / 2 - 0.6, -Math.PI / 2, w2, h2, 700 + k);
      zc -= Math.max(w, w2) + 0.2; k++;
    }
    house(b, ox, oz - 38.2, 0, 12, 7, 17, 560, 0, TEN[2]); winGlow(ox, oz - 34.6, 0, 12, 17, 800);
    for (const z of [3, -9, -21]) { b.add(new THREE.CylinderGeometry(0.06, 0.08, 3.0, 8).translate(ox + 2.2, 1.5, oz + z), ironM); lantern(ox + 2.2, 3.0, oz + z); }

    b.build(R);
  }

  update(p: PlateDef, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const L = LIGHTS[p.light], K = LOOK[p.light];
    for (const [k, g] of Object.entries(this.groups)) g.visible = (p.show ?? []).includes(k as Show);
    for (const s of this.swaps) s.mesh.material = p.light === "night" ? s.night : s.day;
    cam.position.set(...p.pos); cam.up.set(0, 1, 0); cam.lookAt(...p.look);
    cam.fov = p.fov; cam.near = 0.12; cam.far = 1500; cam.aspect = 9 / 16; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
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
    // golden: the sun disc; night: a cool moon (HDR, so it blooms)
    this.disc.visible = p.light !== "day";
    (this.disc.material as THREE.SpriteMaterial).color.copy(p.light === "night" ? new THREE.Color(3.2, 3.4, 4.2) : new THREE.Color(6.0, 4.4, 2.4));
    this.disc.position.copy(cam.position).addScaledVector(sunDir, 900);
    this.disc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(p.light === "night" ? 2.6 : 1.7)));
    const yaw0 = Math.atan2(fx, fz);
    this.clouds.forEach((m, i) => {
      const a = yaw0 + (i / this.clouds.length - 0.5) * 2.4 + 0.13 * Math.sin(i * 7.1), d = 520 + (i % 3) * 70;
      const w = 120 + (i % 4) * 34;
      m.position.set(cam.position.x + Math.sin(a) * d, 70 + (i % 5) * 26, cam.position.z + Math.cos(a) * d);
      m.scale.set(w, w / 2, 1); m.lookAt(cam.position.x, m.position.y, cam.position.z);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map = this.cloudMaps[p.light][i % 4];
      mat.color.setScalar(p.light === "night" ? 0.75 : 1.1);
    });
    return focus;
  }
}
