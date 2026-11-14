// Runs the short: for frame f it finds the shot, shows that shot's set, applies its light preset (camera-relative
// sun frozen per shot, two-tone uniforms, sky, fog) exactly as the skill's world.ts does, then places the lit
// character cards, ground shadows and effect sprites the shot asks for.
import * as THREE from "three";
import { cloudHD, ctex } from "../pointing/paint";
import { TONE, CHAR, untone } from "../pointing/shade";
import { CARD_K } from "../pointing/cardshade";
import { NOINK } from "../pointing/ink";
import { Pool, Actor, Fx, SU } from "../pointing/cards";
import { Pen, fxContact, fxShadow } from "../pointing/toon";
import { fxStars } from "./draw";
import { buildSets, Sets } from "./sets";
import { PRE } from "./look";
import { SHOTS, shotAt, setLightAngle, resetSets, Place, FxP, V3 } from "./shots";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const CONTACT: V3 = [0.2, 0.21, 0.33], TAIL: V3 = [0.42, 0.44, 0.62];
const c01 = (x: number) => Math.max(0, Math.min(1, x));
const toSrgb = (v: number) => { const c = c01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: V3, k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const COW_GEO = (() => { const g = new THREE.PlaneGeometry(1000 * SU, 700 * SU); g.translate(0, (680 - 350) * SU, 0); return g; })();
const tier = (d: number): [number, number, number] => (d < 3.4 ? [1800, 3000, 3.0] : d < 7 ? [1080, 1800, 1.8] : d < 18 ? [480, 800, 0.8] : [240, 400, 0.4]);

export class WaterWorld {
  root = new THREE.Group();
  sets: Sets;
  private pool = new Pool();
  private actors: Actor[] = []; private cows: Actor[] = []; private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 25, 300);
  private clouds: THREE.Mesh[] = []; private stars: THREE.Mesh;
  private sunCache = new Map<number, THREE.Vector3>();

  constructor() {
    const R = this.root;
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
    this.hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.55);
    this.sun = new THREE.DirectionalLight("#fff3e0", 2.8);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    const cm = [0, 1, 2, 3].map((k) => cloudHD(k, PRE.day.K.cloud));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cm[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    const st = ctex("wStars", 1024, 512, (g) => fxStars(new Pen(g))); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(3, 1.5);
    this.stars = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide, color: new THREE.Color(1.6, 1.6, 1.5) }));
    this.stars.renderOrder = -0.9; this.stars.frustumCulled = false; this.stars.layers.set(NOINK); R.add(this.stars);
    this.sets = buildSets();
    for (const s of Object.values(this.sets)) { s.g.visible = false; R.add(s.g); }
  }

  private actor(list: Actor[], i: number, geo?: THREE.BufferGeometry) { while (list.length <= i) list.push(new Actor(this.root, geo)); return list[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  private shotSun(i: number) {
    let v = this.sunCache.get(i);
    if (v) return v;
    const s = SHOTS[i], P = PRE[s.light];
    resetSets(this.sets);
    const c = s.run(Math.floor((s.b - s.a) / 2), this.sets).cam;
    const x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1, fx = x / n, fz = z / n;
    const az = THREE.MathUtils.degToRad(s.az ?? P.az), el = THREE.MathUtils.degToRad(s.el ?? P.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = V(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(i, v);
    return v;
  }

  /** poses everything for frame f; returns the lens settings and the white-flash amount */
  update(f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const i = shotAt(f), s = SHOTS[i], P = PRE[s.light], L = P.L, K = P.K;
    const sunDir = this.shotSun(i);
    for (const [name, st] of Object.entries(this.sets)) st.g.visible = name === s.set;
    // ---- light rig: preset first, so the shot may then bend it (heat, dimming) ----
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    CARD_K.uGain.value = P.gain;
    setLightAngle(THREE.MathUtils.degToRad((s.az ?? P.az) >= 0 ? -55 : -125));
    resetSets(this.sets);
    const o = s.run(f - s.a, this.sets);
    // ---- camera ----
    const c = o.cam;
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(THREE.MathUtils.degToRad(c.roll ?? 0));
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...(o.focus ?? c.look)), dist = cam.position.distanceTo(focus);
    const Rr = s.shadowR ?? THREE.MathUtils.clamp(dist * 1.3 + 8, 12, 95), mid = V(...(s.shadowAt ?? o.focus ?? c.look));
    this.sun.position.copy(mid).addScaledVector(sunDir, 220); this.sun.target.position.copy(mid);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    // ---- sky, fog, clouds, stars ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, k) => untone(h, su["c" + k].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position); this.stars.position.copy(cam.position); this.stars.visible = P.stars;
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) { m.visible = P.clouds; m.lookAt(cam.position.x, m.position.y, cam.position.z); }
    // ---- ground shadows under standing cards (cast.ts blob(), day branch) ----
    const fxp: FxP[] = [...o.fx];
    const hl = Math.hypot(sunDir.x, sunDir.z) || 1, ox = -sunDir.x / hl, oz = -sunDir.z / hl, rot = Math.atan2(-ox, -oz);
    const blob = (x: number, y: number, z: number, sc2: number, k: number) => {
      const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(Math.asin(sunDir.y)))) * sc2, h = len + 0.55 * sc2, cc = 0.3 * h;
      const tc = hexOf(TAIL, k), kc = hexOf(CONTACT, k);
      fxp.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), at: [x + ox * cc, y + 0.018, z + oz * cc], w: 0.72 * sc2, h, flat: true, rot });
      fxp.push({ key: `blob|contact|${kc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, kc), at: [x + ox * 0.03 * sc2, y + 0.022, z + oz * 0.03 * sc2], w: 0.52 * sc2, h: 0.4 * sc2, flat: true, rot });
    };
    // ---- cast ----
    let ai = 0, ci = 0;
    const used: Actor[] = [];
    for (const p of o.places as Place[]) {
      const cowGeo = p.geo === "cow", a = cowGeo ? this.actor(this.cows, ci++, COW_GEO) : this.actor(this.actors, ai++);
      const sc2 = p.scale ?? 1, d = cam.position.distanceTo(V(p.at[0], p.at[1] + 1.2 * sc2, p.at[2])) / sc2;
      const [w, h, k] = tier(d / (c.fov < 30 ? 0.7 : 1));
      a.r = cowGeo ? this.pool.req(p.key, Math.round(1000 * k * 0.6), Math.round(700 * k * 0.6), k * 0.6, p.draw) : this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true; a.mesh.position.set(...p.at);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.at[0], cam.position.z - p.at[2]), THREE.MathUtils.degToRad(p.roll ?? 0));
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2); a.mesh.castShadow = false;
      if (p.shadow !== 0) blob(p.at[0], p.shadowY ?? p.at[1], p.at[2], sc2 * (p.shadow ?? 1) * (cowGeo ? 2.2 : 1), s.light === "night" || s.light === "stage" ? 0.7 : 1);
      used.push(a);
    }
    for (let k = ai; k < this.actors.length; k++) this.actors[k].mesh.visible = false;
    for (let k = ci; k < this.cows.length; k++) this.cows[k].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of fxp) {
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft); e2.mesh.visible = true; e2.mesh.position.set(...p.at);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (p.yaw !== undefined) e2.mesh.rotation.set(0, p.yaw, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); if (p.rot) e2.mesh.rotateZ(p.rot); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let k = fi; k < this.fxs.length; k++) this.fxs[k].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return { focus, cInf: o.cInf, flash: o.flash ?? 0 };
  }
}
