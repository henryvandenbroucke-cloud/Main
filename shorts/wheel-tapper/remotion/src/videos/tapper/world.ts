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
import { PlateDef, WZ, CAR_X0, CAR_LEN, CARS, W_R } from "./story";

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
    const grassM = lam("grassHD", () => ({ map: grassHD(), color: "#9fa88a" }));
    const ballastM = lam("ballast", () => ({ map: ballastTex() }));
    const gravelM = lam("walkGravel", () => ({ map: gravelTex() }));
    const stoneM = lam("platStone", () => ({ map: stoneHD("platStone", ["#c9c1b2", "#bdb5a6", "#d3cbbc", "#b3ab9c"], "#8f877a") }));
    const flagsM = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const woodM = lam("beamHD", () => ({ map: beamHD() }));
    const sleeperM = lam("sleeper", () => ({ color: "#5b4636" }));
    const railM = twoTone(new THREE.MeshPhongMaterial({ color: "#8d8f96", specular: "#d0d0d8", shininess: 70 }), 0.15);
    const ironM = twoTone(new THREE.MeshPhongMaterial({ color: "#2f3a33", specular: "#7a8a80", shininess: 40 }), 0.15);
    const blackM = twoTone(new THREE.MeshPhongMaterial({ color: "#3e3c46", specular: "#8a8a96", shininess: 40 }), 0.15);
    const brassM = twoTone(new THREE.MeshPhongMaterial({ color: "#d6a63c", specular: "#fff1c0", shininess: 80 }), 0.15);
    const greenM = twoTone(new THREE.MeshPhongMaterial({ color: "#2f6a43", specular: "#9bd0a8", shininess: 50 }), 0.15);
    const redM = lam("bufferBeam", () => ({ color: "#b8322c" }));
    const maroonM = lam("carEnd", () => ({ color: "#7a2630" }));
    const roofM = lam("carRoof", () => ({ color: "#8d8a86" }));
    const liveryM = lam("livery", () => ({ map: liveryTex() }));
    const steelM = twoTone(new THREE.MeshPhongMaterial({ color: "#b9bcc4", specular: "#ffffff", shininess: 90 }), 0.15);

    // ---- ground: grass, ballast bed, walkway (-z), platform (+z) ----
    b.add(groundW(-400, 400, -400, 400, 8, -0.02), grassM);
    b.add(boxGeo(V(-80, -0.02, -1.55), V(80, 0.14, 1.55), 2), ballastM);
    b.add(groundW(-80, 80, -4.2, -1.55, 3, 0.05), gravelM);
    for (let x = -80; x < 80; x += 0.62) b.add(boxGeo(V(x, 0.14, -1.25), V(x + 0.24, 0.24, 1.25)), sleeperM);
    for (const z of [-0.72, 0.72]) {
      b.add(boxGeo(V(-80, 0.24, z - 0.035), V(80, 0.38, z + 0.035)), railM);
      b.add(boxGeo(V(-80, 0.24, z - 0.07), V(80, 0.27, z + 0.07)), railM);
    }
    // platform: stone face toward the track, flagstone top, white edge line
    b.add(boxGeo(V(-60, 0, 1.65), V(60, 0.95, 7.5), 2), stoneM);
    b.add(groundW(-60, 60, 1.65, 7.5, 2.2, 0.955), flagsM);
    b.add(boxGeo(V(-60, 0.955, 1.62), V(60, 0.99, 1.95)), lam("edgeLine", () => ({ color: "#efe9d8" })));
    // canopy: iron columns + brackets + sloping roof + valance boards
    for (let x = -40; x <= 40; x += 6) {
      b.add(new THREE.CylinderGeometry(0.1, 0.13, 4.0, 12).translate(x, 0.95 + 2.0, 5.4), ironM);
      b.add(boxGeo(V(x - 0.06, 4.6, 2.6), V(x + 0.06, 4.9, 5.5)), ironM);
    }
    b.add(quad(V(-42, 4.85, 2.4), V(42, 4.85, 2.4), V(42, 5.6, 7.6), V(-42, 5.6, 7.6), 20, 2), lam("canopyRoof", () => ({ map: roofHD("#8f97a8", true), side: THREE.DoubleSide })));
    const valTex = ctex("valance", 512, 128, (g) => { g.fillStyle = "#e8dcbf"; g.beginPath(); g.moveTo(0, 0); g.lineTo(512, 0); for (let x = 512; x >= 0; x -= 32) { g.lineTo(x, 100); g.lineTo(x - 16, 128); } g.lineTo(0, 100); g.fill(); });
    b.add(quad(V(-42, 4.1, 2.38), V(42, 4.1, 2.38), V(42, 4.86, 2.38), V(-42, 4.86, 2.38), 40, 1), lam("valance", () => ({ map: valTex, alphaTest: 0.5, side: THREE.DoubleSide })));
    // clock hanging under the canopy
    b.add(boxGeo(V(9.95, 3.75, 3.9), V(10.05, 4.85, 4.0)), ironM);
    const clk = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 32).rotateX(Math.PI / 2).translate(10, 3.4, 3.95);
    b.add(clk, ironM);
    for (const s of [-1, 1]) { const face = new THREE.CircleGeometry(0.38, 32); if (s < 0) face.rotateY(Math.PI); face.translate(10, 3.4, 3.95 + s * 0.075); b.add(face, lam("clockFace", () => ({ map: clockTex() }))); }
    // benches + lamp posts on the platform
    for (const x of [-6, 14, 26]) { b.add(boxGeo(V(x - 0.9, 1.4, 4.4), V(x + 0.9, 1.5, 4.8)), woodM); b.add(boxGeo(V(x - 0.9, 1.5, 4.75), V(x + 0.9, 2.0, 4.85)), woodM); for (const d of [-0.75, 0.75]) b.add(boxGeo(V(x + d - 0.05, 0.95, 4.45), V(x + d + 0.05, 1.4, 4.75)), ironM); }
    // station building behind the platform + houses
    const BR: Style = { wall: "#c8643f", shutter: "#2f6a43", roof: "#8f97a8", brick: true };
    house(b, 4, 11.7, Math.PI, 26, 8, 6.8, 900, 0.95, BR);
    for (let i = 0; i < 6; i++) house(b, -40 + i * 9 + (i > 3 ? 40 : 0), 13, Math.PI, 8.4, 7, 8 + (i % 3) * 1.4, 910 + i);
    // across the line: fence, trees, distant houses
    for (let i = 0; i < 22; i++) prop(b, kit, i % 3 ? "tree_oak" : "tree_fat", -50 + i * 5.2 + (i % 2) * 1.5, 0, -40 - (i % 3) * 3, 6 + (i % 4), i + 5);
    for (let i = 0; i < 8; i++) house(b, -40 + i * 11, -50, 0, 9, 7, 8.4 + (i % 2) * 1.4, 930 + i);

    // ---- the train ----
    const wheel = (x: number, z: number, r: number, key: string, spokes: number, centre: string) => {
      const out = z < 0 ? -1 : 1;
      b.add(new THREE.CylinderGeometry(r, r, 0.13, 32, 1, true).rotateX(Math.PI / 2).translate(x, r + 0.3, z), steelM);
      const face = new THREE.CircleGeometry(r, 32); if (out < 0) face.rotateY(Math.PI); face.translate(x, r + 0.3, z + out * 0.066);
      b.add(face, lam("wheelFace" + key, () => ({ map: wheelTex(key, spokes, centre), transparent: false })));
      const back = new THREE.CircleGeometry(r, 32); if (out > 0) back.rotateY(Math.PI); back.translate(x, r + 0.3, z - out * 0.066);
      b.add(back, blackM);
    };
    // carriages: two bogies each (2 axles), axle boxes on the outside, underframe, body, curved roof, buffers
    for (let c = 0; c < CARS; c++) {
      const x0 = CAR_X0 + c * (CAR_LEN + 0.8), x1 = x0 + CAR_LEN;
      for (const bx of [x0 + 1.6, x1 - 1.6]) {
        b.add(boxGeo(V(bx - 1.4, 0.66, -0.5), V(bx + 1.4, 0.84, 0.5)), blackM); // bogie frame (inside the wheels)
        for (const d of [-0.95, 0.95]) for (const z of [-0.72, 0.72]) {
          wheel(bx + d, z, W_R - 0.3 + 0.3, "car", 10, "#3a3540");
          const zo = z < 0 ? -1 : 1;
          b.add(boxGeo(V(bx + d - 0.13, 0.62, z + zo * 0.08), V(bx + d + 0.13, 0.86, z + zo * 0.26)), blackM);   // axle box
          b.add(boxGeo(V(bx + d - 0.15, 0.86, z + zo * 0.07), V(bx + d + 0.15, 0.91, z + zo * 0.27)), steelM); // its lid
        }
              }
      b.add(boxGeo(V(x0, 1.05, -1.3), V(x1, 1.3, 1.3)), blackM); // underframe
      b.add(quad(V(x1, 1.3, -1.42), V(x0, 1.3, -1.42), V(x0, 3.75, -1.42), V(x1, 3.75, -1.42)), liveryM);
      b.add(quad(V(x0, 1.3, 1.42), V(x1, 1.3, 1.42), V(x1, 3.75, 1.42), V(x0, 3.75, 1.42)), liveryM);
      for (const [xa, nx] of [[x0, -1], [x1, 1]] as const) {
        b.add(boxGeo(V(nx < 0 ? xa : xa - 0.02, 1.3, -1.42), V(nx < 0 ? xa + 0.02 : xa, 3.75, 1.42)), maroonM);
        for (const z of [-0.8, 0.8]) { b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 10).rotateZ(Math.PI / 2).translate(xa + nx * 0.2, 1.15, z), steelM); b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16).rotateZ(Math.PI / 2).translate(xa + nx * 0.42, 1.15, z), blackM); }
      }
      const roof = new THREE.CylinderGeometry(1.6, 1.6, CAR_LEN, 24, 1, true, -0.95, 1.9).rotateZ(Math.PI / 2).rotateX(0).translate((x0 + x1) / 2, 2.55, 0);
      b.add(roof, roofM);
    }
    // locomotive (front at -x): frames, buffer beam, smokebox + boiler + dome + chimney, cab, side tanks, wheels
    const lx0 = -12.6, lx1 = CAR_X0 - 0.8;
    b.add(boxGeo(V(lx0, 0.85, -1.05), V(lx1, 1.25, 1.05)), blackM);
    b.add(boxGeo(V(lx0 - 0.25, 0.75, -1.35), V(lx0, 1.35, 1.35)), redM);
    for (const z of [-0.85, 0.85]) { b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 10).rotateZ(Math.PI / 2).translate(lx0 - 0.45, 1.05, z), steelM); b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16).rotateZ(Math.PI / 2).translate(lx0 - 0.7, 1.05, z), blackM); }
    b.add(new THREE.CylinderGeometry(0.95, 0.95, 1.4, 28).rotateZ(Math.PI / 2).translate(lx0 + 0.9, 2.15, 0), blackM);       // smokebox
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 4.6, 28).rotateZ(Math.PI / 2).translate(lx0 + 3.9, 2.15, 0), greenM);     // boiler
    for (const x of [lx0 + 2.0, lx0 + 4.0, lx0 + 6.0]) b.add(new THREE.CylinderGeometry(0.87, 0.87, 0.08, 28).rotateZ(Math.PI / 2).translate(x, 2.15, 0), brassM);
    b.add(new THREE.CylinderGeometry(0.28, 0.34, 1.0, 20).translate(lx0 + 0.9, 3.4, 0), blackM);                            // chimney
    b.add(new THREE.CylinderGeometry(0.4, 0.33, 0.14, 20).translate(lx0 + 0.9, 3.95, 0), blackM);
    b.add(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(lx0 + 3.6, 2.9, 0), brassM);     // dome
    for (const zo of [-1, 1]) b.add(boxGeo(V(lx0 + 2.0, 1.25, zo * 1.0 - (zo > 0 ? 0 : 0.42)), V(lx0 + 6.4, 2.65, zo * 1.0 + (zo > 0 ? 0.42 : 0))), greenM); // side tanks
    b.add(boxGeo(V(lx0 + 6.4, 1.25, -1.4), V(lx1, 3.6, 1.4)), greenM);                                                      // cab
    for (const zo of [-1, 1]) b.add(boxGeo(V(lx0 + 6.9, 2.5, zo * 1.41 - 0.01), V(lx0 + 7.7, 3.2, zo * 1.41 + 0.01)), lam("cabWin", () => ({ color: "#20222c" })));
    b.add(boxGeo(V(lx0 + 6.3, 3.6, -1.55), V(lx1 + 0.1, 3.75, 1.55)), blackM);
    for (const x of [lx0 + 2.6, lx0 + 4.4, lx0 + 6.2]) for (const z of [-0.72, 0.72]) wheel(x, z, 0.78, "loco", 14, "#2f6a43");
    for (const z of [-0.72, 0.72]) wheel(lx0 + 0.9, z, 0.45, "pony", 8, "#2f6a43");
    for (const zo of [-1, 1]) b.add(boxGeo(V(lx0 + 2.6, 1.02, zo * 0.98 - 0.04), V(lx0 + 6.2, 1.12, zo * 0.98 + 0.04)), steelM); // coupling rods

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
