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
    const grassM = lam("meadow", () => ({ map: meadowTex("meadow", "#93ac62") }));
    const roadM = lam("dirtRoad", () => ({ map: roadTex() }));
    const vergeM = lam("verge", () => ({ map: meadowTex("verge", "#88a35a") }));
    const wallM = lam("dryStone", () => ({ map: stoneHD("dryStone", ["#bdb3a1", "#a99f8c", "#c9c0ae", "#9d937f"], "#7d7464") }));
    const capM = lam("wallCap", () => ({ color: "#9c927f" }));
    const postM = lam("fencePost", () => ({ map: beamHD() }));
    const hillM = lam("hill", () => ({ color: "#8fae6a" }));
    // ---- ground: grass, the dirt road along x, verges ----
    b.add(groundW(-400, 400, -400, 400, 8, -0.02), grassM);
    b.add(groundW(-120, 120, -2.7, 2.7, 6, 0.02), roadM);
    b.add(groundW(-120, 120, 2.7, 4.0, 3, 0.03), vergeM);
    // far side: dry-stone wall with a cap, gate gaps
    for (let x = -60; x < 60; x += 12) {
      b.add(boxGeo(V(x, 0, 4.1), V(x + 10.4, 0.72, 4.55), 2), wallM);
      b.add(boxGeo(V(x - 0.05, 0.72, 4.05), V(x + 10.45, 0.8, 4.6)), capM);
      for (const gx of [x + 10.4, x + 12]) b.add(boxGeo(V(gx - 0.12, 0, 4.15), V(gx + 0.12, 1.15, 4.5)), postM);
    }
    // hedges + trees behind the wall, cottages facing the road, hills far away
    for (let i = 0; i < 26; i++) prop(b, kit, "hedge", -62 + i * 4.8, 0, 5.4 + (i % 2) * 0.3, 1.3 + (i % 3) * 0.2, 0);
    for (let i = 0; i < 16; i++) prop(b, kit, i % 3 ? "tree_oak" : "tree_fat", -58 + i * 7.6 + (i % 2) * 2, 0, 9.5 + (i % 3) * 2.5, 6 + (i % 4) * 1.2, i);
    for (let i = 0; i < 10; i++) house(b, -52 + i * 11.5 + (i % 2) * 1.5, 15 + (i % 3) * 1.5, Math.PI, 8 + (i % 3), 6.5, 4.6 + (i % 2) * 1.2, 940 + i);
    for (let i = 0; i < 7; i++) b.add(new THREE.SphereGeometry(1, 32, 16).scale(70 + i * 9, 18 + (i % 3) * 7, 40).translate(-180 + i * 62, -6, 150 + (i % 2) * 40), hillM);
    // near side (behind the lens): a few trees and a cottage for the wide shot
    for (let i = 0; i < 10; i++) prop(b, kit, "tree_oak", -70 + i * 13, 0, -26 - (i % 2) * 6, 7 + (i % 3), i + 40);
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
