// The set for the hook shot: a commuter platform at the edge of a city, a train easing in, a far platform, city
// blocks and a distant snow cone. Built the way the skill's world.ts builds the bridge town: merged static batches,
// every world material two-tone (shade.ts), sky written as tone-map-inverted targets, fog = horizon colour, sun
// camera-relative and frozen for the shot, cards and effects on the NOINK layer.
// Layout: platform top y = 0, platform edge x = 0, tracks along z (near track centre x = 1.75), camera looks toward -z.
import * as THREE from "three";
import { V, lam, boxGeo, quad, Batch } from "./geo";
import { cloudHD, rep } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, SU } from "./cards";
import { Pen, bodyFront, fxBurst, fxContact, fxShadow, KID, PARENT, INK, SKIN, SKINS, Outfit, Expr, mix } from "./toon";
import { camAt, driverPose, trainNose, DRIVER, KID_AT, EYES, BEATS, V3, clamp01 } from "./story";
import { platformTex, tactileTex, ballastTex, concreteTex, trainSideTex, trainFrontTex, towerTex, wallTex, vendingTex, clockTex, mountainTex } from "./textures";

const L = LIGHTS.day, K = LOOK.day;
const SUN_AZ = 112, SUN_EL = 46; // sun on screen right and a little behind the lens: train nose lit, its side in shade

// ---------------- cast ----------------
const DRIVER_FIT: Outfit = { jacket: "#2d4486", pants: "#263052", boots: INK, hat: "peaked", cap: "#243a78", buttons: "#e8c45a",
  gloves: "#ffffff", tie: "#c0353a", skin: SKIN };
const KID_FIT: Outfit = { ...KID, cap: "#f6cf3a", jacket: "#2fa3a0", pants: "#2f3e6e", skin: SKINS[1] };
const FAR_FOLK: Outfit[] = [
  { ...PARENT, jacket: "#7b5ac9", hair: "#2a201a", skin: SKINS[0] },
  { ...PARENT, jacket: "#3f9c62", hair: "#5a3b2a", skin: SKINS[3] },
  { ...PARENT, jacket: "#f08a2c", hair: "#2a201a", skin: SKINS[2] },
];
const FAR_AT: V3[] = [[8.6, 0, -3.5], [9.4, 0, -10.5], [8.9, 0, -17]];

// ---------------- day ground shadows under cards (cast.ts blob(), day branch) ----------------
const CONTACT: V3 = [0.2, 0.21, 0.33], TAIL: V3 = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: V3, k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");

type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number };

export class Station {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 25, 300);
  private clouds: THREE.Mesh[] = [];
  private train = new THREE.Group();
  private mountain: THREE.Mesh;
  private sunDir = new THREE.Vector3();

  constructor() {
    const R = this.root;
    // ---- sky, clouds, lights (world.ts) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight(L.sky, L.ground, L.hemiI);
    this.sun = new THREE.DirectionalLight(L.sunCol, L.sunI);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    const cm = [0, 1, 2, 3].map((k) => cloudHD(k, K.cloud));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cm[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    this.mountain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mountainTex(), transparent: true, depthWrite: false, fog: false }));
    this.mountain.renderOrder = -0.8; this.mountain.layers.set(NOINK); this.mountain.frustumCulled = false;
    R.add(this.mountain);

    // ---- materials ----
    const M = {
      platform: lam("stPlatform", () => ({ map: platformTex() })),
      tactile: lam("stTactile", () => ({ map: tactileTex() })),
      line: lam("stLine", () => ({ color: "#f6f2e6" })),
      concrete: lam("stConcrete", () => ({ map: concreteTex() })),
      ballast: lam("stBallast", () => ({ map: ballastTex() })),
      sleeper: lam("stSleeper", () => ({ color: "#5b4a40" })),
      ground: lam("stGround", () => ({ color: "#8fa66a" })),
      asphalt: lam("stAsphalt", () => ({ color: "#8d8791" })),
      wall: lam("stWall", () => ({ map: wallTex() })),
      roof: lam("stRoof", () => ({ color: "#4f7f8c" })),
      post: lam("stPost", () => ({ color: "#e9e3d2" })),
      bench: lam("stBench", () => ({ color: "#3f73b8" })),
      leaf: lam("stLeaf", () => ({ color: "#6a9f62" })),
      leaf2: lam("stLeaf2", () => ({ color: "#548a5c" })),
      bark: lam("stBark", () => ({ color: "#8a5a3c" })),
      roofcap: lam("stRoofcap", () => ({ color: "#b9b2a8" })),
      vendR: lam("stVendR", () => ({ map: vendingTex("#d8362f") })),
      vendB: lam("stVendB", () => ({ map: vendingTex("#3f73b8") })),
      vendSide: lam("stVendSide", () => ({ color: "#c9c4bb" })),
      // steel: a coloured dark with one soft metal highlight (world.ts M.iron / M.steel)
      rail: twoTone(new THREE.MeshPhongMaterial({ color: "#8a8f9c", specular: "#c8c8c8", shininess: 60 }), 0.15),
      iron: twoTone(new THREE.MeshPhongMaterial({ color: "#4a5262", specular: "#8a8a8a", shininess: 50 }), 0.15),
    };
    const b = new Batch();
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material, tile = 0, bottom = false) =>
      b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile, bottom), m);
    const TB = -1.1; // track bed level

    // ---- ground ----
    b.add(quad(V(-400, TB - 0.02, 400), V(400, TB - 0.02, 400), V(400, TB - 0.02, -600), V(-400, TB - 0.02, -600), 1, 1), M.ground);
    b.add(quad(V(-0.2, TB, 60), V(7.2, TB, 60), V(7.2, TB, -260), V(-0.2, TB, -260), 3, 130), M.ballast);
    // ---- platforms: near (x -9..0) and far (x 7..12.5) ----
    for (const [x0, x1, e] of [[-9, 0, 0], [7, 12.5, 7]] as const) {
      box(x0, TB, -120, x1, 0, 40, M.concrete, 3);
      b.add(quad(V(x0, 0.004, 40), V(x1, 0.004, 40), V(x1, 0.004, -120), V(x0, 0.004, -120), (x1 - x0) / 2.4, 160 / 2.4), M.platform);
      const s = e === 0 ? -1 : 1; // strips sit inside the edge
      const strip = (a: number, c: number, m: THREE.Material, u: number, v: number) => {
        const xa = e + s * a, xb = e + s * c, lo = Math.min(xa, xb), hi = Math.max(xa, xb);
        b.add(quad(V(lo, 0.009, 40), V(hi, 0.009, 40), V(hi, 0.009, -120), V(lo, 0.009, -120), u, v), m);
      };
      strip(0.08, 0.2, M.line, 1, 1);
      strip(0.55, 0.95, M.tactile, 1, 400);
    }
    // ---- two tracks ----
    for (const cx of [1.75, 5.25]) {
      for (const s of [-1, 1]) box(cx + s * 0.535 - 0.04, TB + 0.06, -260, cx + s * 0.535 + 0.04, TB + 0.2, 60, M.rail);
      for (let z = -110; z < 40; z += 0.65) box(cx - 1.1, TB, z, cx + 1.1, TB + 0.08, z + 0.24, M.sleeper);
    }
    // ---- catenary: masts on the far platform, cross arms over both tracks, contact wires; one signal head ----
    for (let z = 18.7; z > -200; z -= 25) {
      box(7.3, 0, z - 0.1, 7.5, 7.0, z + 0.1, M.iron);
      box(0.9, 6.3, z - 0.06, 7.5, 6.44, z + 0.06, M.iron);
      for (const cx of [1.75, 5.25]) box(cx - 0.035, 5.6, z - 0.035, cx + 0.035, 6.3, z + 0.035, M.iron);
    }
    for (const cx of [1.75, 5.25]) box(cx - 0.02, 5.56, -220, cx + 0.02, 5.6, 40, M.iron);
    box(4.95, 4.55, -6.42, 5.55, 5.75, -6.24, M.iron); box(5.2, 5.75, -6.36, 5.3, 6.3, -6.3, M.iron);
    // ---- far platform: back wall, canopy, benches, vending machines, clock ----
    box(12.3, 0, -120, 12.5, 2.7, 40, M.wall, 4);
    box(7.6, 3.25, -90, 12.9, 3.45, 18, M.roof); box(7.5, 3.1, -90, 7.7, 3.25, 18, M.post);
    for (let z = 14; z > -90; z -= 8) box(10.5, 0, z - 0.11, 10.72, 3.25, z + 0.11, M.post);
    for (const z of [3, -13, -29]) { box(11.2, 0.38, z - 1.1, 11.75, 0.5, z + 1.1, M.bench); box(11.68, 0.5, z - 1.1, 11.78, 0.95, z + 1.1, M.bench); for (const dz of [-0.9, 0.9]) box(11.3, 0, z + dz - 0.04, 11.38, 0.38, z + dz + 0.04, M.iron); }
    const vend = (x: number, z: number, m: THREE.Material) => {
      box(x, 0, z - 0.55, x + 0.75, 1.85, z + 0.55, M.vendSide);
      b.add(quad(V(x - 0.005, 0.04, z - 0.5), V(x - 0.005, 0.04, z + 0.5), V(x - 0.005, 1.8, z + 0.5), V(x - 0.005, 1.8, z - 0.5), 1, 1), m);
    };
    vend(11.5, -6, M.vendR); vend(11.5, -7.3, M.vendB); vend(11.5, -21, M.vendR);
    // ---- near platform: a canopy that starts behind the kid, with posts (mostly a shape at the frame edge) ----
    box(-8.6, 3.25, -90, -0.7, 3.45, -9, M.roof);
    for (let z = -10; z > -90; z -= 8) box(-2.6, 0, z - 0.11, -2.38, 3.25, z + 0.11, M.post);
    // ---- city blocks behind the far platform + a green belt of round trees ----
    const towers: [number, number, number, number, number, number][] = [ // x, z, w, d, h, palette
      // low shop row right behind the far platform
      [20, -12, 8, 8, 5, 2], [20, -22, 8, 7, 6.5, 0], [20, -31, 8, 8, 4.6, 1], [20, -41, 8, 8, 6.8, 2], [20, -51, 8, 9, 5.4, 0], [20, -62, 8, 9, 7, 1],
      // far towers, leaving a clear corridor for the snow cone a little right of the lens axis
      [26, -86, 14, 14, 30, 1], [42, -100, 14, 16, 24, 0], [64, -74, 16, 18, 34, 2], [58, -42, 16, 16, 27, 1], [30, -128, 18, 16, 36, 0],
      [-22, -40, 16, 16, 18, 1], [-30, -74, 18, 18, 30, 0], [-20, -110, 16, 16, 22, 2],
    ];
    const pal = [
      lam("stTw0", () => ({ map: towerTex("0", "#e3d6bd", "#5f7fae", "#ffe9a8") })),
      lam("stTw1", () => ({ map: towerTex("1", "#b9c6d6", "#4f6d99", "#ffe9a8") })),
      lam("stTw2", () => ({ map: towerTex("2", "#d7a98c", "#6a86ad", "#fff0c0") })),
    ];
    for (const [x, z, w, d, h, p] of towers) {
      b.add(boxGeo(V(x - w / 2, TB, z - d / 2), V(x + w / 2, h, z + d / 2), 0), rep4(pal[p], w, d, h));
      box(x - w / 2 - 0.3, h, z - d / 2 - 0.3, x + w / 2 + 0.3, h + 0.7, z + d / 2 + 0.3, M.roofcap);
      box(x - 2, h + 0.7, z - 1.5, x + 1, h + 2.6, z + 1.5, M.roofcap);
    }
    const tree = (x: number, z: number, h: number, m: THREE.Material) => {
      box(x - 0.18, TB, z - 0.18, x + 0.18, h * 0.5, z + 0.18, M.bark);
      const g = new THREE.IcosahedronGeometry(h * 0.42, 2);
      b.add(g, m, new THREE.Matrix4().makeScale(1, 1.12, 1).setPosition(x, h * 0.72, z));
    };
    for (let i = 0; i < 9; i++) tree(14.2 + (i % 2) * 0.9, 9 - i * 13, 3.6 + (i % 3) * 0.5, i % 2 ? M.leaf : M.leaf2);
    for (let i = 0; i < 8; i++) tree(-11 - (i % 2) * 2, -14 - i * 12, 5.5 + (i % 3), i % 2 ? M.leaf2 : M.leaf);
    box(13.2, TB, -160, 18.5, TB + 0.25, 40, M.asphalt);
    b.build(R);

    // ---- unlit signs and lamps (a side sun turns lit sign faces grey-blue: SKILL.md readability traps) ----
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ map: clockTex() }));
    clock.position.set(9.0, 2.62, -1.2); clock.rotation.y = -0.5; R.add(clock);
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 40), M.iron);
    cb.rotation.set(Math.PI / 2, -0.5, 0, "YXZ"); cb.position.set(9.04, 2.62, -1.27); cb.castShadow = true; R.add(cb);
    const hang = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), M.iron); hang.position.set(9.04, 3.12, -1.27); R.add(hang);
    const lamp = (x: number, y: number, z: number, r: number, col: THREE.Color, parent: THREE.Object3D = R) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: col, fog: false }));
      m.position.set(x, y, z); parent.add(m); return m;
    };
    lamp(5.25, 5.43, -6.23, 0.13, new THREE.Color(0.25, 3.4, 1.3));   // signal: green, HDR so it blooms
    lamp(5.25, 4.9, -6.23, 0.13, new THREE.Color(0.16, 0.05, 0.05));

    // ---- the train (3 cars), nose at local z = 0, moved along z every frame ----
    const tb = new Batch(), X0 = 0.28, X1 = 3.22, Y0 = -0.1, Y1 = 2.75;
    const side = lam("stTrainSide", () => ({ map: trainSideTex() })), front = lam("stTrainFront", () => ({ map: trainFrontTex() }));
    const under = lam("stUnder", () => ({ color: "#3a3a46" })), troof = lam("stTrainRoof", () => ({ color: "#c9c4bb" }));
    for (let c = 0; c < 3; c++) {
      const z1 = -c * 20.5, z0 = z1 - 20;
      tb.add(quad(V(X0, Y0, z0), V(X0, Y0, z1), V(X0, Y1, z1), V(X0, Y1, z0), 1, 1), side);
      tb.add(quad(V(X1, Y0, z1), V(X1, Y0, z0), V(X1, Y1, z0), V(X1, Y1, z1), 1, 1), side);
      tb.add(quad(V(X0, Y0, z1), V(X1, Y0, z1), V(X1, Y1, z1), V(X0, Y1, z1), 1, 1), c ? under : front);
      tb.add(quad(V(X1, Y0, z0), V(X0, Y0, z0), V(X0, Y1, z0), V(X1, Y1, z0), 1, 1), under);
      tb.add(boxGeo(V(X0 + 0.16, Y1, z0 + 0.1), V(X1 - 0.16, Y1 + 0.2, z1 - 0.1)), troof);
      tb.add(boxGeo(V(X0 + 0.5, Y1 + 0.2, z0 + 3), V(X1 - 0.5, Y1 + 0.48, z0 + 7.5)), troof);
      tb.add(boxGeo(V(X0 + 0.5, Y1 + 0.2, z1 - 8), V(X1 - 0.5, Y1 + 0.48, z1 - 4)), troof);
      tb.add(boxGeo(V(X0 + 0.2, TB + 0.25, z0 + 0.3), V(X1 - 0.2, Y0, z1 - 0.3), 0, true), under);
    }
    // pantograph on the first car: two bars up to the contact wire
    tb.add(boxGeo(V(1.2, Y1 + 0.2, -11.2), V(2.3, Y1 + 0.3, -9.8)), M.iron);
    const bar = (a: THREE.Vector3, c: THREE.Vector3) => {
      const g = new THREE.BoxGeometry(0.06, a.distanceTo(c), 0.06);
      g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1)));
      tb.add(g, M.iron);
    };
    bar(V(1.75, Y1 + 0.3, -9.9), V(1.75, 4.0, -11.3)); bar(V(1.75, 4.0, -11.3), V(1.75, 4.84, -10.2));
    tb.add(boxGeo(V(1.1, 4.8, -10.26), V(2.4, 4.86, -10.14)), M.iron);
    tb.build(this.train);
    for (const x of [X0 + 2.94 * (66 / 512), X0 + 2.94 * (446 / 512)]) lamp(x, Y1 - 2.85 * (363 / 512), 0.012, 0.15, new THREE.Color(4.2, 3.6, 2.2), this.train);
    R.add(this.train);
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** poses everything for frame f (pure function of f); returns the lens focus point */
  update(f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / 30;
    // ---- camera ----
    const c = camAt(f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(THREE.MathUtils.degToRad(c.roll));
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // ---- light rig: camera-relative sun frozen for the shot (frame 45 forward axis), two-tone uniforms, shadow fit ----
    const c0 = camAt(45), fx0 = c0.look[0] - c0.pos[0], fz0 = c0.look[2] - c0.pos[2], n0 = Math.hypot(fx0, fz0);
    const fxn = fx0 / n0, fzn = fz0 / n0, az = THREE.MathUtils.degToRad(SUN_AZ), el = THREE.MathUtils.degToRad(SUN_EL);
    const hx = fxn * Math.cos(az) - fzn * Math.sin(az), hz = fzn * Math.cos(az) + fxn * Math.sin(az);
    const sunDir = this.sunDir.set(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 16, 12, 95); // wider than the bridge fit: the train and far platform sit 12-25 m behind
    const mid = focus.clone().add(V(3, 0, -9));
    this.sun.position.copy(mid).addScaledVector(sunDir, 220); this.sun.target.position.copy(mid);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, clouds, mountain ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);
    // the cone sits on the horizon ahead of the lens, a little left of the pointing arm
    const ma = Math.atan2(fxn, -fzn) + THREE.MathUtils.degToRad(3.2);
    this.mountain.position.set(c0.pos[0] + Math.sin(ma) * 900, 205, c0.pos[2] - Math.cos(ma) * 900);
    this.mountain.scale.set(800, 400, 1); this.mountain.lookAt(cam.position.x, this.mountain.position.y, cam.position.z);
    // ---- train ----
    this.train.position.set(0, 0, trainNose(f));
    // ---- cast ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const places: { key: string; draw: (p: Pen) => void; at: V3; size: [number, number, number]; scale?: number }[] = [];
    const fxp: FxPlace[] = [];
    const blob = (x: number, y: number, z: number, s = 1, k = 1) => {
      const hl = Math.hypot(sunDir.x, sunDir.z) || 1, ox = -sunDir.x / hl, oz = -sunDir.z / hl, rot = Math.atan2(-ox, -oz);
      const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(Math.asin(sunDir.y)))) * s, h = len + 0.55 * s, cc = 0.3 * h;
      const tc = hexOf(TAIL, k), kc = hexOf(CONTACT, k);
      fxp.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * cc, y: y + 0.018, z: z + oz * cc, w: 0.72 * s, h, flat: true, rot });
      fxp.push({ key: `blob|contact|${kc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, kc), x: x + ox * 0.03 * s, y: y + 0.022, z: z + oz * 0.03 * s, w: 0.52 * s, h: 0.4 * s, flat: true, rot });
    };
    // painted crescent + thick outline side follow the sun: sun on screen right -> light from the upper right
    const light = THREE.MathUtils.degToRad(-55);
    const d = driverPose(f);
    const expr: Expr = d.call ? "call" : "stern";
    const q = (v: number, n = 40) => Math.round(v * n) / n;
    places.push({
      key: `driver|${q(d.angle, 4)}|${q(d.reach)}|${expr}|${q(d.tilt, 8)}|${q(d.headTilt, 8)}|${d.blink}`, at: DRIVER, size: [1800, 3000, 3.0],
      draw: (p) => bodyFront(p, DRIVER_FIT, { mode: "stand", expr, point: [d.angle, d.reach], tilt: d.tilt, headTilt: d.headTilt, blink: d.blink, look: 1, facing: 1, light, seed: 3 }),
    });
    blob(DRIVER[0], 0, DRIVER[2]);
    // the kid behind the yellow line stares up at him; a head tilt on every snap
    const kt = 3 * Math.max(0, 1 - Math.max(0, d.since - 3) / 8) * (d.beat % 2 ? 1 : -1);
    const kexpr: Expr = f > 30 ? "shock" : "neutral";
    places.push({
      key: `kid|${kexpr}|${q(kt, 8)}|${f >= 58 && f < 62 ? 1 : 0}`, at: KID_AT, size: [1080, 1800, 1.8],
      draw: (p) => bodyFront(p, KID_FIT, { mode: "stand", expr: kexpr, headTilt: -6 + kt, look: -1, facing: -1, blink: f >= 58 && f < 62, light, seed: 5 }),
    });
    blob(KID_AT[0], 0, KID_AT[2], 0.8);
    FAR_AT.forEach((at, i) => {
      places.push({ key: `far${i}`, at, size: [480, 800, 0.8], draw: (p) => bodyFront(p, FAR_FOLK[i], { mode: "stand", expr: i === 1 ? "smile" : "neutral", facing: -1, look: -1, light, seed: 11 + i }) });
    });
    // gold burst at the fingertip on every snap (flat 2D sprite in the 3D scene)
    if (d.since >= 0 && d.since < 7 && BEATS[d.beat][0] > -10) {
      const a = THREE.MathUtils.degToRad(d.angle), hx2 = (383 + 222 * Math.cos(a) - 300) * SU, hy2 = (975 - (447 - 222 * Math.sin(a))) * SU, tb = d.since / 7;
      fxp.push({ key: `burst|${d.since}`, cw: 500, ch: 500, draw: (p) => { p.g.translate(250, 250); p.g.scale(1.35, 1.35); p.g.translate(-250, -250); fxBurst(p, tb, "#ffe27a", 9, 26, 178); },
        x: DRIVER[0] + right.x * hx2 + (cam.position.x - DRIVER[0]) * 0.03, y: hy2, z: DRIVER[2] + right.z * hx2 + (cam.position.z - DRIVER[2]) * 0.03, w: 0.7, h: 0.7 });
    }
    let ai = 0;
    const used: Actor[] = [];
    for (const p of places) {
      const a = this.actor(ai++), s = p.scale ?? 1;
      a.r = this.pool.req(p.key, p.size[0], p.size[1], p.size[2], p.draw);
      a.mesh.visible = true; a.mesh.position.set(...p.at);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.at[0], cam.position.z - p.at[2]), 0);
      a.mesh.scale.set(s, s, s); a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of fxp) {
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(false); e2.mesh.visible = true; e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else e2.mesh.quaternion.copy(cam.quaternion);
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    void t; void mix;
    return V(...EYES);
  }
}

/** facade material with its own repeat for a block of w x d x h metres (one image = 18 x 24 m) */
const rep4cache = new Map<string, THREE.Material>();
function rep4(base: THREE.MeshLambertMaterial, w: number, d: number, h: number) {
  const key = `${base.uuid}|${w}|${h}`;
  let m = rep4cache.get(key);
  if (!m) {
    const map = rep(base.map!, Math.max(1, Math.round(((w + d) / 2 / 18) * 2) / 2), h / 24);
    m = twoTone(new THREE.MeshLambertMaterial({ map }));
    rep4cache.set(key, m);
  }
  return m;
}
