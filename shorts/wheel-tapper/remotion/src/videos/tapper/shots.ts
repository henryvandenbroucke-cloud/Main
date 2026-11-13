// Timeline of "The Man Who Hit Trains With a Hammer" (51.4 s, 1541 f at 30 fps), timed to voice3/words.json.
// One continuous station: hook on the hammer hitting the wheel -> close-up (the wrong sound, padlock) -> steam wipe to
// the station -> steam wipe back to the tapper (ting ting ting, passengers laugh, a kid copies, THUNK, chalk X, the
// carriage pulled out) -> "Wait" -> a crash zoom into the wheel hub irises into a clean explainer (bell ring, crack,
// the ring dies, wine glass ting / thud, shatter, derail) -> iris back out onto the same wheel (listening, the hot axle
// box) -> golden hour: the tapper fades, a trackside robot taps the rolling wheels and inherits his cap.
import { Outfit, FrontOpts, SKINS, INK, Expr, KID, townsfolk, Pen, P2, fxPuff } from "./toon";
import { V3, plateOf, WZ, W_R, HERO_X } from "./story";
import { Key2, View, PlateCam, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import {
  sparkle, qmark, emark, speedLines, stampMark, padlock, ringWaves, dullPuff, tapHammer, steamWipe, chimneySteam, wheel2, bell2,
  wineGlass, detector, chalkX,
} from "./props2d";

export const FPS = 30;
export const TOTAL = 1541;
export const FLASH_AT = -99;
const F = (t: number) => Math.round(t * FPS) - 2;
const SU = 0.00216;

// ---------------- geometry on the strip plate ----------------
const pcS = new PlateCam(plateOf("strip"));
const TZ = -2.2; // the tapper's line on the gravel walkway
const W10 = 10.45, W12 = HERO_X, W4 = 4.55;
/** where the tapper stands (world x on TZ) so the wheel at xw sits just to his screen-right */
const standX = (xw: number) => {
  const wp = pcS.px([xw, W_R, WZ])[0], target = wp - W_R * pcS.ppm([xw, W_R, WZ]) - 0.75 * pcS.ppm([9.5, 0, TZ]);
  return 9.5 + (pcS.W / 2 - target) / pcS.ppm([9.5, 0, TZ]);
};
const SH = standX(W10);
/** frame centre between the tapper (k = 0) and the wheel (k = 1), dv = vertical offset in plate heights */
const frameAt = (k: number, dv: number): P2 => {
  const a = pcS.px([SH, 0, TZ])[0], b = pcS.px([W10, W_R, WZ])[0];
  return [(a + (b - a) * k) / pcS.W, 0.56 + dv];
};
/** the point on the tyre the hammer strikes (screen-left side of the wheel, a little low) */
const hitPt = (xw: number): V3 => [xw + 0.46, 0.36, WZ - 0.04];
const hub = (xw: number): V3 => [xw, W_R, WZ - 0.12];
const boxPt = (xw: number): V3 => [xw, 0.74, WZ - 0.24];

// ---------------- cast ----------------
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, ...o } as Outfit);
const TAPPER = O({ jacket: "#1f2a44", pants: "#1f2a44", boots: "#2a2420", hat: "cap", cap: "#1f2a44", buttons: "#e8c45a", moustache: "#3a2a20", build: "stout", skin: SKINS[0] });
const TAPPER_BARE = { ...TAPPER, hat: "hair", hair: "#3a2a20" } as Outfit;
const LADY = O({ jacket: "#7b5ac9", pants: "#3b3f52", hat: "bonnet", dress: "#7b5ac9", skin: SKINS[1] });
const GENT = O({ jacket: "#2c3140", pants: "#2b2b35", hat: "tophat", buttons: "#e8c45a", moustache: "#5a3b2a", skin: SKINS[2] });
const BOY = { ...KID, jacket: "#3f6fb5", cap: "#e2453c" } as Outfit;
const PORTER = O({ jacket: "#5a3b2a", pants: "#3a3530", boots: "#2a2420", hat: "cap", cap: "#2e2a26", skin: SKINS[3] });
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));

export type Actor = {
  o: Outfit; okey: string; P: V3; opts: FrontOpts; seed: number; hop?: number; scale?: number;
  side?: import("./toon").SideOpts; mirror?: boolean; lean?: number; noShadow?: boolean;
  /** world polygon the actor is clipped to (passengers inside a window) */
  clip?: V3[]; alpha?: number;
};
export type Shot = {
  id: number; a: number; b: number; plate: string; keys: Key2[]; kicks?: [number, number][];
  xfade?: number; whip?: boolean;
  cast?: (f: number) => Actor[];
  under?: (g: CanvasRenderingContext2D, v: View, f: number) => void;
  over?: (g: CanvasRenderingContext2D, v: View, f: number) => void;
};

// ---------------- life ----------------
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const LID = [0.5, 1, 1, 0.5];
export const lidAt = (f: number, i: number, sw: number[] = []) => {
  const fi = Math.round(f);
  for (const s of sw) { const k = fi - s + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= fi && n < 400; n++) { const k = fi - s; if (k >= 0 && k < 4) return LID[k]; s += Math.round(15 + 54 * hh(i * 31 + n, 13)); }
  return 0;
};
const bob = (f: number, k = 1) => Math.sin(f * 0.21) * 0.6 * k;
const stand = (o: Outfit, okey: string, P: V3, seed: number, f: number, ex: [number, Expr][], hands: [number, Hands][] = [[0, {}]],
  extra: Partial<FrontOpts> = {}, act: Partial<Actor> = {}): Actor => {
  const h = poseAt(f, hands);
  return { o, okey, P, seed, ...act, opts: { mode: "stand", expr: exprAt(f, ex), blink: lidAt(f, seed, swaps(ex)), tilt: bob(f + seed * 7), hands: h, ...extra } };
};

// ---------------- the hammer swing ----------------
/** swing angle offset from the strike angle (0 = touching the target, negative = raised) and the arm lift 0..1 */
const swingAt = (f: number, hits: number[], wind = 9) => {
  let off = -0.3, lift = 0;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i], w = Math.max(4, Math.min(wind, i ? h - hits[i - 1] - 1 : wind)), next = hits[i + 1] ?? 1e9;
    const wn = Math.max(4, Math.min(wind, next - h - 1));
    if (f >= h - w && f <= h) {
      const r0 = h - w, r1 = h - 0.42 * w;
      if (f < r1) { const e = easeOut((f - r0) / (r1 - r0)); off = -0.3 - 1.55 * e; lift = e; }
      else { const u = (f - r1) / (h - r1), e = u * u * u; off = -1.85 * (1 - e); lift = 1 - e; }
      return { off, lift, age: -1 };
    }
    if (f > h && f < h + 6 && f < next - wn) {
      const u = (f - h) / 6; off = -0.3 * easeOut(u) - 0.1 * Math.sin(Math.PI * u); return { off, lift: 0.05, age: f - h };
    }
  }
  return { off, lift, age: -1 };
};
const R_REST: P2 = [0.48, 0.28], R_UP: P2 = [0.32, -0.32];
const rHand = (lift: number): P2 => [R_REST[0] + (R_UP[0] - R_REST[0]) * lift, R_REST[1] + (R_UP[1] - R_REST[1]) * lift];
/** hand positions stashed by `held` while the actor is drawn (design units), keyed by actor */
const HAND = new Map<string, { l: P2; r: P2 }>();
const stash = (key: string) => (_p: Pen, l: P2, r: P2) => { HAND.set(key, { l, r }); };
/** design-unit point of an actor -> output px */
const handOut = (v: View, a: { P: V3; scale?: number }, d: P2): P2 => {
  const ft = v.w(a.P), k = v.ppm(a.P) * SU * (a.scale ?? 1), x = (d[0] - 300) * k, y = (d[1] - 975) * k, c = Math.cos(v.cam.roll), s = Math.sin(v.cam.roll);
  return [ft[0] + x * c - y * s, ft[1] + x * s + y * c];
};
/** draw the tapper's long hammer swinging from his hand onto the target point */
const drawSwing = (g: CanvasRenderingContext2D, _v: View | null, hand: P2, target: P2, off: number, sc: number) => {
  const a0 = Math.atan2(target[1] - hand[1], target[0] - hand[0]), L = Math.hypot(target[0] - hand[0], target[1] - hand[1]);
  const a = a0 + off;
  tapHammer(g, hand, [hand[0] + Math.cos(a) * L, hand[1] + Math.sin(a) * L], sc);
};
/** a bright arc of light sweeping round the tyre after a good hit (the satisfying glint) */
const tyreGlint = (g: CanvasRenderingContext2D, c: P2, r: number, age: number) => {
  if (age < 0 || age > 14) return;
  const u = age / 14, a = Math.PI * (0.9 + 2.2 * easeOut(u));
  g.save(); g.globalAlpha = Math.sin(Math.PI * u); g.lineCap = "round"; g.strokeStyle = "#fffbe8"; g.lineWidth = Math.max(3, r * 0.07);
  g.beginPath(); g.arc(c[0], c[1], r * 0.96, a - 0.7, a); g.stroke(); g.restore();
};
/** the full "good hit" effect on a wheel: rings from the hub, sparkle at the contact, glint round the tyre */
const goodHit = (g: CanvasRenderingContext2D, c: P2, r: number, contact: P2, age: number, col = "255,244,200") => {
  ringWaves(g, c[0], c[1], r, age, 1, 3, col);
  tyreGlint(g, c, r, age);
  sparkle(g, contact[0], contact[1], r * 0.32, age / 10);
};
/** a dull hit: grey puff, a short jagged red ring that collapses */
const badHit = (g: CanvasRenderingContext2D, c: P2, r: number, contact: P2, age: number) => {
  dullPuff(g, contact[0], contact[1], r * 0.9, age);
  if (age < 0 || age > 10) return;
  const u = age / 10;
  g.save(); g.globalAlpha = 1 - u; g.strokeStyle = "#ff5a4a"; g.lineWidth = Math.max(3, r * 0.06); g.lineJoin = "round"; g.beginPath();
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, rr = r * (1.05 + 0.15 * u) * (1 + (i % 2 ? 0.07 : -0.07)); g.lineTo(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr); }
  g.stroke(); g.restore();
};
/** "listening" arcs travelling from a wheel toward an ear */
const earWaves = (g: CanvasRenderingContext2D, from: P2, to: P2, age: number, s: number) => {
  if (age < 0 || age > 18) return;
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  g.save(); g.lineCap = "round"; g.strokeStyle = "#fff6c8";
  for (let i = 0; i < 3; i++) {
    const u = clamp01((age - i * 3) / 12); if (u <= 0 || u >= 1) continue;
    const p: P2 = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
    g.globalAlpha = Math.sin(Math.PI * u); g.lineWidth = Math.max(3, s * 0.05);
    g.beginPath(); g.arc(p[0], p[1], s * 0.3, a - 0.8, a + 0.8); g.stroke();
  }
  g.restore();
};
/** heat shimmer rising from a point (output px) */
const shimmer = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k: number) => {
  if (k <= 0) return;
  g.save(); g.lineCap = "round";
  const gr = g.createRadialGradient(x, y, 0, x, y, s * 0.9); gr.addColorStop(0, `rgba(255,120,40,${0.55 * k})`); gr.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.9, 0, 7); g.fill();
  for (let i = -1; i <= 1; i++) {
    g.strokeStyle = `rgba(255,170,90,${0.8 * k})`; g.lineWidth = Math.max(3, s * 0.07); g.beginPath();
    for (let j = 0; j <= 12; j++) { const u = j / 12, yy = y - s * 0.3 - u * s * 1.4, xx = x + i * s * 0.35 + Math.sin(u * 9 - f * 0.45 + i) * s * 0.12; j ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
    g.stroke();
  }
  g.restore();
};
const puffAt = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, n = 14) => {
  if (age < 0 || age >= n) return;
  g.save(); g.translate(x - size / 2, y - size * 0.6); g.scale(size / 300, size / 300); fxPuff(new Pen(g), age / n); g.restore();
};

// ---------------- 2D explainer pieces (output px) ----------------
/** the mini side-view train: loco + 3 carriages on a rail. pull: car 1 hoisted out (0..1); derail: 0..1 */
const miniTrain = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, o: { pull?: number; derail?: number; spin?: number; mark?: number } = {}) => {
  const cw = 2.3 * s, ch = 0.95 * s, gap = 0.18 * s, pull = o.pull ?? 0, der = o.derail ?? 0, sp = o.spin ?? 0;
  g.save(); g.lineJoin = "round";
  // rail
  g.strokeStyle = "#cfd3da"; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(x - 3 * s, y); g.lineTo(x + 5 * cw, y); g.stroke();
  const close = smooth((pull - 0.55) / 0.45) * (cw + gap);
  const unit = (i: number, draw: () => void) => {
    const di = clamp01(der * 1.7 - i * 0.22);
    let dx = 0, dy = 0, rot = 0, al = 1;
    if (i === 2 && pull > 0) { dy = -easeOut(clamp01(pull / 0.55)) * 2.6 * s; rot = 0.12 * Math.sin(pull * 9) * (1 - pull); al = 1 - clamp01((pull - 0.5) / 0.3); }
    if (i > 2) dx = -close;
    if (di > 0) { rot = (i % 2 ? -1 : 1) * 0.9 * easeOut(di); dy = di * di * 1.2 * s; dx += (i % 2 ? 0.4 : -0.3) * s * di; }
    if (al <= 0) return;
    g.save(); g.globalAlpha = al; g.translate(x + i * (cw + gap) + dx, y + dy); g.rotate(rot); draw(); g.restore();
    if (di > 0.2 && di < 0.95) puffAt(g, x + i * (cw + gap) + dx, y, s * 1.2, (di - 0.2) * 18, 14);
  };
  const wheelsAt = (xs: number[], r: number) => xs.forEach((wx) => wheel2(g, wx, -r, r, sp, { spokes: 6 }));
  // loco
  unit(0, () => {
    g.fillStyle = "#2f6a43"; g.strokeStyle = INK; g.lineWidth = s * 0.07;
    g.beginPath(); g.roundRect(-0.1 * s, -1.25 * s, 1.6 * s, 0.75 * s, 0.35 * s); g.fill(); g.stroke();
    g.beginPath(); g.rect(1.4 * s, -1.6 * s, 0.8 * s, 1.1 * s); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(0.15 * s, -1.65 * s, 0.25 * s, 0.4 * s);
    g.fillStyle = "#c9a23a"; g.beginPath(); g.arc(0.8 * s, -1.25 * s, 0.18 * s, Math.PI, 0); g.fill();
    wheelsAt([0.35 * s, 1.0 * s, 1.75 * s], 0.28 * s);
  });
  for (let i = 1; i <= 3; i++) unit(i + 0, () => {
    const X0 = 0.4 * s;
    g.fillStyle = "#7a2630"; g.strokeStyle = INK; g.lineWidth = s * 0.07;
    g.beginPath(); g.roundRect(X0, -0.45 * s - ch, cw - 0.2 * s, ch, 0.12 * s); g.fill(); g.stroke();
    g.fillStyle = "#efe2c2"; g.fillRect(X0 + 0.04 * s, -0.45 * s - ch + 0.04 * s, cw - 0.28 * s, ch * 0.45);
    g.fillStyle = "#5d72b0"; for (let k = 0; k < 4; k++) g.fillRect(X0 + 0.16 * s + k * 0.5 * s, -0.45 * s - ch + 0.1 * s, 0.32 * s, ch * 0.3);
    wheelsAt([X0 + 0.35 * s, X0 + cw - 0.55 * s], 0.24 * s);
    if (i === 2 && (o.mark ?? 0) > 0) chalkX(g, X0 + cw / 2 - 0.1 * s, -0.45 * s - ch / 2, ch * 0.7, o.mark ?? 0);
    if (i === 2 && pull > 0.02 && pull < 0.6) { g.strokeStyle = INK; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(X0 + cw / 2 - 0.1 * s, -0.45 * s - ch); g.lineTo(X0 + cw / 2 - 0.1 * s, -6 * s); g.stroke(); }
  });
  g.restore();
};
/** waveform panel: the latest sound drawn left to right (ring = long decaying sine, dead = a blip then flat) */
const SOUNDS: { f: number; kind: "ring" | "dead"; col: string }[] = [];
const wavePanel = (g: CanvasRenderingContext2D, f: number, k: number) => {
  if (k <= 0) return;
  const x0 = 120, x1 = 960, yc = 1690, hh2 = 120;
  g.save(); g.globalAlpha = k;
  g.beginPath(); g.roundRect(x0 - 20, yc - hh2, x1 - x0 + 40, hh2 * 2, 28); g.fillStyle = "rgba(8,14,26,0.72)"; g.fill();
  g.lineWidth = 4; g.strokeStyle = "rgba(160,190,230,0.35)"; g.stroke();
  g.strokeStyle = "rgba(160,190,230,0.18)"; g.lineWidth = 2;
  for (let x = x0 + 60; x < x1; x += 60) { g.beginPath(); g.moveTo(x, yc - hh2 + 12); g.lineTo(x, yc + hh2 - 12); g.stroke(); }
  g.beginPath(); g.moveTo(x0, yc); g.lineTo(x1, yc); g.stroke();
  const cur = SOUNDS.filter((s) => s.f <= f).pop();
  if (cur) {
    const n = Math.min(x1 - x0, (f - cur.f) * 34);
    g.lineJoin = "round"; g.lineCap = "round";
    for (const [w, a] of [[12, 0.25], [5, 1]] as const) {
      g.strokeStyle = cur.col; g.globalAlpha = k * a; g.lineWidth = w; g.beginPath();
      for (let i = 0; i <= n; i += 3) {
        const t = i, amp = cur.kind === "ring" ? Math.exp(-t / 520) : t < 26 ? Math.sin((t / 26) * Math.PI) : 0;
        const yy = yc - Math.sin(t * 0.21) * (hh2 - 22) * amp;
        i ? g.lineTo(x0 + i, yy) : g.moveTo(x0 + i, yy);
      }
      g.stroke();
    }
  }
  g.restore();
};
/** wheel shattering into wedges (u 0..1 from the break) */
const shatter = (g: CanvasRenderingContext2D, x: number, y: number, r: number, u: number, ang: number) => {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = ang + (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n, am = (a0 + a1) / 2;
    const d = easeOut(u) * r * (1.4 + hh(i, 3) * 1.2), fall = u * u * r * 1.6;
    g.save(); g.translate(x + Math.cos(am) * d, y + Math.sin(am) * d + fall); g.rotate(u * (hh(i, 5) - 0.5) * 6); g.globalAlpha = 1 - clamp01((u - 0.6) / 0.4);
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0 - am, a1 - am); g.closePath();
    g.fillStyle = "#3a3540"; g.fill();
    g.beginPath(); g.arc(0, 0, r, a0 - am, a1 - am); g.arc(0, 0, r * 0.84, a1 - am, a0 - am, true); g.closePath(); g.fillStyle = "#c9ccd2"; g.fill();
    g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0 - am, a1 - am); g.closePath(); g.stroke();
    g.restore();
  }
};

/** late-afternoon regrade of the day strip (2D): warm multiply, low sun glow from the top left, cool shadow at the base */
const warmGrade = (g: CanvasRenderingContext2D) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = "#ffd9ae"; g.fillRect(0, 0, 1080, 1920);
  const sh = g.createLinearGradient(0, 1100, 0, 1920); sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(150,120,170,0.55)");
  g.fillStyle = sh; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen";
  const gl = g.createRadialGradient(80, 120, 40, 80, 120, 1100); gl.addColorStop(0, "rgba(255,200,120,0.55)"); gl.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = gl; g.fillRect(0, 0, 1080, 1920);
  g.restore();
};

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });

/** the tapper as a standing (front, turned toward the wheels) actor with the hammer arm driven by the swing */
const tapper = (f: number, P: V3, ex: [number, Expr][], hits: number[], extra: Partial<FrontOpts> = {}, left: [number, Hands][] = [[0, {}]], act: Partial<Actor> = {}): Actor => {
  const sw = swingAt(f, hits), l = poseAt(f, left).l;
  return { o: TAPPER, okey: "tap", P, seed: 7, ...act,
    opts: { mode: "stand", facing: 1, expr: exprAt(f, ex), blink: lidAt(f, 7, swaps(ex)), tilt: bob(f) - sw.lift * 3, hands: { l, r: rHand(sw.lift) }, held: stash("tap"), ...extra } };
};
/** a side-view walker (no hand stash: the hammer is carried at the hand) */
const walkerS = (o: Outfit, okey: string, seed: number, f: number, path: [number, number, number][], expr: Expr, scale = 1): Actor & { moving: boolean } => {
  const w = walkAt(f, path);
  const mirror = w.dir[0] > 0; // +x is screen-left on the strip
  return { o, okey, P: [w.x, 0, w.z], seed, scale, opts: {}, mirror, moving: w.moving,
    side: { mode: "march", phase: w.moving ? w.phase : 0, expr, blink: lidAt(f, seed), stomp: 0.35, stride: w.moving ? 0.8 : 0.01 } };
};
/** draw the tapper's hammer for this frame: swinging at `target` when standing, carried when walking */
const hammerFor = (g: CanvasRenderingContext2D, v: View, a: Actor | undefined, f: number, hits: number[], target: V3, walking = false) => {
  if (!a) return;
  const s = 0.55 * v.ppm(a.P) * (a.scale ?? 1);
  if (walking || a.side) {
    const dir = a.mirror ? -1 : 1, ft = v.w(a.P), m = v.ppm(a.P);
    const hand: P2 = [ft[0] + dir * 0.12 * m, ft[1] - 0.78 * m];
    tapHammer(g, hand, [hand[0] + dir * 0.55 * m, hand[1] + 0.42 * m], s);
    return;
  }
  const h = HAND.get(a.okey); if (!h) return;
  const hand = handOut(v, a, h.r), sw = swingAt(f, hits);
  drawSwing(g, v, hand, v.w(target), sw.off, s);
};
const cupEar: Hands = { l: [-0.42, -0.62] };

// 1 — HOOK. "This man's whole job was hitting trains with a hammer."
{
  const HITS = [3, F(1.72), F(2.04), F(2.86)];
  add({
    a: 0, b: 100, plate: "strip",
    keys: [
      { f: 0, at: frameAt(0.42, 0.0), z: 1.14, creep: 0.0024 },
      { f: HITS[3] - 3, dur: 10, at: frameAt(0.62, 0.04), z: 1.4, roll: 0.03, creep: 0.002, punch: 0.006 },
    ],
    kicks: HITS.map((h, i) => [h, i === 3 ? 0.7 : 0.3] as [number, number]),
    cast: (f) => [tapper(f, [SH, 0, TZ], [[0, "grin"], [HITS[3] + 2, "laugh"]], HITS)],
    over: (g, v, f) => {
      const a = tapper(f, [SH, 0, TZ], [[0, "grin"]], HITS);
      hammerFor(g, v, a, f, HITS, hitPt(W10));
      const c = v.w(hub(W10)), r = W_R * v.ppm(hub(W10)), ct = v.w(hitPt(W10));
      for (const h of HITS) goodHit(g, c, r, ct, f - h);
    },
  });
}
// 2 — "And if one wheel made the wrong sound, that train wasn't going anywhere."  (close-up: ting, then the dull one;
//      a padlock clamps on the hub)
{
  const GOOD = F(3.94), BAD = F(4.56), LOCK = F(5.92);
  add({
    a: 100, b: 212, plate: "wheel_cu", xfade: 10,
    keys: [
      { f: 100, at: hub(W12), z: 1.08, creep: 0.0022 },
      { f: BAD - 2, dur: 8, at: hub(W12), z: 1.22, roll: -0.035, creep: 0.0015, punch: 0.006, pn: 18 },
      { f: LOCK - 6, dur: 14, at: [W12, 0.55, WZ], z: 1.12, roll: 0, creep: 0.002 },
    ],
    kicks: [[GOOD, 0.35], [BAD, 1.0], [LOCK + 6, 0.8]],
    over: (g, v, f) => {
      const c = v.w(hub(W12)), r = W_R * v.ppm(hub(W12)), ct = v.w(hitPt(W12));
      const hand: P2 = [ct[0] - 520, ct[1] - 980], sw = swingAt(f, [GOOD, BAD], 12);
      goodHit(g, c, r, ct, f - GOOD);
      badHit(g, c, r, ct, f - BAD);
      drawSwing(g, v, hand, ct, sw.off, 0.55 * v.ppm(hitPt(W12)));
      if (f >= BAD && f < BAD + 4) { g.save(); g.globalCompositeOperation = "saturation"; g.fillStyle = `rgba(128,128,128,${0.8 - (f - BAD) * 0.2})`; g.fillRect(0, 0, 1080, 1920); g.restore(); }
      const k = pop(f, LOCK, 7, 2.2);
      if (k > 0) {
        const drop = (1 - clamp01((f - LOCK) / 6)) * -700;
        padlock(g, c[0], c[1] + drop + r * 0.1, r * 0.95 * Math.max(0.3, k), clamp01((f - LOCK - 6) / 5));
        sparkle(g, c[0] + r * 0.5, c[1] - r * 0.2, r * 0.3, (f - LOCK - 6) / 10);
      }
      qmark(g, c[0] - r * 0.75, c[1] - r * 0.95, r * 0.45, f - BAD - 4, -0.15);
    },
  });
}
// 3 — "It's the 1900s. Busy station, steam everywhere."  (steam wipe in and out)
const CHIMNEY: V3 = [-11.7, 4.05, 0];
const WIPE1 = 212, WIPE2 = 318;
{
  const YR = F(7.62), BUSY = F(8.64), STEAM = F(9.7);
  add({
    a: WIPE1, b: WIPE2, plate: "st_wide",
    keys: [
      { f: WIPE1, at: [0.5, 0.5], z: 1.02, creep: 0.0028 },
      { f: STEAM - 4, dur: 12, at: [-9, 2.6, 0], z: 1.16, creep: 0.002, punch: 0.005, pn: 16 },
    ],
    cast: (f) => [
      walkerS(PORTER, "p1", 41, f, [[WIPE1, -14, -3.0], [WIPE2, -8, -3.0]], "smile"),
      walkerS(FOLK[0], "f0", 42, f, [[WIPE1, -4, -2.6], [WIPE2, -10, -2.6]], "smile_closed"),
      walkerS(FOLK[1], "f1", 43, f, [[WIPE1, -9, -3.6], [WIPE2, -3.5, -3.6]], "grin"),
      walkerS(TAPPER, "tapw", 44, f, [[WIPE1, -16, -2.3], [WIPE2, -11, -2.3]], "neutral"),
      walkerS(FOLK[2], "f2", 45, f, [[WIPE1, -13.5, 4.2], [WIPE2, -16.5, 4.2]], "smile"),
      walkerS(FOLK[3], "f3", 46, f, [[WIPE1, -17, 3.4], [WIPE2, -14, 3.4]], "smile_closed"),
    ].map((a) => (a.P[2] > 0 ? { ...a, P: [a.P[0], 0.955, a.P[2]] as V3 } : a)),
    over: (g, v, f) => {
      const c = v.w(CHIMNEY), m = v.ppm(CHIMNEY);
      chimneySteam(g, c[0], c[1], m * (0.9 + 0.5 * smooth((f - STEAM + 6) / 10)), f, 7);
      for (const x of [-12.3, -10.4, -8.4]) { const p = v.w([x, 0.35, -1.0]); chimneySteam(g, p[0] - m * 0.4, p[1], m * 0.6 * smooth((f - STEAM + 4) / 8), f + x * 9, 4); }
      stampMark(g, 540, 380, 520, "1900s", f - YR, -0.1);
      speedLines(g, 540, 960, 520, 900, (f - BUSY) / 14, 16);
    },
  });
}
// 4 — "And there he is. Ting, ting, ting. Passengers think he's lost his mind. Kids copy him. Then one wheel goes..."
const IRIS_IN = F(22.78), INS_A = IRIS_IN + 12, INS_B = F(36.55);
const D1 = F(11.74), D2 = F(11.92), D3 = F(12.38), PASS = F(13.5), MIND = F(14.5), KIDS = F(15.6), K1 = F(15.74), K2 = F(16.1);
const THEN = F(16.52), THUNK = F(17.54), XMARK = F(18.3), CARD = F(18.75), PULL = F(19.16), WAIT = F(20.58), HOW = F(21.04), BROKEN = F(22.2);
const CU_A = F(16.95), CU_B = F(20.45);
const win = (x: number): V3[] => [[x - 0.43, 2.66, -1.42], [x + 0.43, 2.66, -1.42], [x + 0.43, 3.42, -1.42], [x - 0.43, 3.42, -1.42]];
const passenger = (o: Outfit, key: string, x: number, wx: number, seed: number, f: number, ex: [number, Expr][], hands: [number, Hands][], f0: number, y = 1.62, extra: Partial<FrontOpts> = {}): Actor => {
  const up = easeOutBack(clamp01((f - f0) / 8), 1.6);
  return stand(o, key, [x, y, -1.12], seed, f, ex, hands, { facing: -1, ...extra }, { clip: win(wx), noShadow: true, hop: -0.8 * (1 - up) });
};
const KID_X = 9.6, KID_Y = 2.02;
{
  const HITS = [D1, D2, D3];
  add({
    a: WIPE2, b: CU_A, plate: "strip",
    keys: [
      { f: WIPE2, at: frameAt(0.42, 0.0), z: 1.12, creep: 0.0018 },
      { f: D1 - 6, dur: 10, at: frameAt(0.5, 0.02), z: 1.2, creep: 0.0012 },
      { f: PASS - 4, dur: 24, at: frameAt(0.5, -0.05), z: 1.1, creep: 0.0012 },
      { f: KIDS - 12, dur: 16, at: frameAt(1.25, -0.08), z: 1.12, creep: 0.0012 },
      { f: THEN, dur: 14, at: hub(W10), z: 1.45, creep: 0.004 },
      { f: CU_A - 10, dur: 12, at: hub(W10), z: 2.6, creep: 0.004 },
    ],
    kicks: [[D1, 0.25], [D2, 0.25], [D3, 0.3], [K1, 0.12], [K2, 0.12]],
    cast: (f) => {
      const ex: [number, Expr][] = [[0, "smile_closed"], [D1, "grin"], [PASS + 6, "smile_closed"], [THEN, "neutral"]];
      const out: Actor[] = [tapper(f, [SH, 0, TZ], ex, HITS, {}, [[0, {}], [F(10.9), { l: [-0.05, -1.08] }], [F(11.4), {}]])];
      out.push(passenger(LADY, "lady", 11.14, 10.94, 51, f, [[0, "laugh"], [MIND, "grin"]],
        [[0, { r: [-0.1, -0.45] }], [MIND, { r: [0.3, -0.95] }]], PASS));
      out.push(passenger(GENT, "gent", 10.72, 10.94, 52, f, [[0, "laugh"], [MIND + 10, "grin"]],
        [[0, { l: [-0.2, 0.2], r: [0.25, -0.2] }]], PASS + 5));
      if (f >= KIDS - 8) {
        const sw = swingAt(f, [K1, K2], 6);
        out.push(passenger(BOY, "kid", KID_X, 9.56, 61, f, [[0, "grin"]], [[0, { r: rHand(sw.lift) }]], KIDS - 8, KID_Y, { facing: 1, held: stash("kid") }));
      }
      return out;
    },
    over: (g, v, f) => {
      const a = { o: TAPPER, okey: "tap", P: [SH, 0, TZ] as V3, seed: 7, opts: {} } as Actor;
      hammerFor(g, v, a, f, HITS, hitPt(W10));
      const c = v.w(hub(W10)), r = W_R * v.ppm(hub(W10));
      for (const h of HITS) goodHit(g, c, r, v.w(hitPt(W10)), f - h);
      // the kid in the window taps the sill with a toy hammer
      const kidA = { P: [KID_X, KID_Y, -1.12] as V3 };
      if (f >= KIDS - 8 && HAND.has("kid")) {
        const h = HAND.get("kid")!, hand = handOut(v, kidA, h.r), tgt = v.w([KID_X - 0.36, 2.68, -1.45]), sw = swingAt(f, [K1, K2], 6), m = v.ppm(kidA.P);
        drawSwing(g, v, hand, tgt, sw.off, 0.28 * m);
        for (const k of [K1, K2]) { ringWaves(g, tgt[0], tgt[1], 0.18 * m, f - k, 0.6, 2, "255,170,210"); sparkle(g, tgt[0], tgt[1] - 8, 0.1 * m, (f - k) / 9); }
      }
      // "lost his mind": a spiral beside the lady's head
      const lady = v.w([11.14, 3.2, -1.2]), ls = v.ppm([11.14, 3.2, -1.2]);
      if (f >= MIND && f < CU_A) { g.save(); g.strokeStyle = "#fff6c8"; g.lineWidth = Math.max(3, ls * 0.035); g.globalAlpha = clamp01((f - MIND) / 5) * (1 - clamp01((f - KIDS) / 8)); g.beginPath();
        for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 5 + f * 0.25, rr = ls * 0.011 * i; g.lineTo(lady[0] + ls * 0.42 + Math.cos(t) * rr, lady[1] - ls * 0.3 + Math.sin(t) * rr); }
        g.stroke(); g.restore(); }
    },
  });
}
// 4b — "...THUNK. And that carriage is pulled right off the train."  (match zoom into the wheel close-up)
add({
  a: CU_A, b: CU_B, plate: "wheel_cu", xfade: 8,
  keys: [
    { f: CU_A, at: hub(W12), z: 1.0, creep: 0.0016 },
    { f: THUNK - 2, dur: 8, at: hub(W12), z: 1.2, roll: 0.04, creep: 0.0012, punch: 0.007, pn: 16 },
    { f: CARD - 4, dur: 14, at: [W12, 0.45, WZ], z: 1.06, roll: 0, creep: 0.0015 },
  ],
  kicks: [[THUNK, 1.4], [PULL + 8, 0.5]],
  over: (g, v, f) => {
    const c = v.w(hub(W12)), r = W_R * v.ppm(hub(W12)), ct = v.w(hitPt(W12));
    const sw = swingAt(f, [THUNK], 16);
    drawSwing(g, v, [ct[0] - 520, ct[1] - 980], ct, f < XMARK - 6 ? sw.off : -0.3 - 1.5 * smooth((f - XMARK + 6) / 8), 0.55 * v.ppm(hitPt(W12)));
    badHit(g, c, r, ct, f - THUNK);
    if (f >= THUNK && f < THUNK + 5) { g.save(); g.globalCompositeOperation = "saturation"; g.fillStyle = `rgba(128,128,128,${0.9 - (f - THUNK) * 0.18})`; g.fillRect(0, 0, 1080, 1920); g.restore(); }
    speedLines(g, ct[0], ct[1], r * 0.5, r * 1.6, (f - THUNK) / 9, 14);
    chalkX(g, c[0], c[1] - r * 0.05, r * 0.85, clamp01((f - XMARK) / 10));
    if (f >= CARD) {
      const u = easeOutBack(clamp01((f - CARD) / 9), 1.4) - smooth((f - CU_B + 10) / 10) * 1.3;
      g.save(); g.translate(0, (1 - u) * 1500);
      g.beginPath(); g.roundRect(60, 300, 960, 500, 44); g.fillStyle = "rgba(250,247,240,0.97)"; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
      g.save(); g.beginPath(); g.roundRect(60, 300, 960, 500, 44); g.clip();
      miniTrain(g, 118, 700, 80, f, { pull: clamp01((f - PULL) / 26), mark: 1 });
      g.restore(); g.restore();
    }
  },
});
// 4c — "Wait, how does a hammer find a broken wheel? You see,"  (crash zoom into the hub irises into the explainer)
add({
  a: CU_B, b: INS_A, plate: "strip", xfade: 8,
  keys: [
    { f: CU_B, at: [SH + 0.1, 1.45, TZ], z: 1.4, roll: -0.06, creep: 0.0018, punch: 0.005, pn: 14 },
    { f: BROKEN - 6, dur: 18, at: hub(W10), z: 1.5, roll: 0.0, creep: 0.002 },
    { f: IRIS_IN - 6, dur: 14, at: hub(W10), z: 5.0, creep: 0.004 },
  ],
  kicks: [[WAIT, 0.5]],
  cast: (f) => [tapper(f, [SH, 0, TZ], [[0, "nervous"], [BROKEN, "dazed"]], [], { facing: 0, look: -1 }, [[0, {}], [HOW, { l: [-0.15, -0.95] }]])],
  over: (g, v, f) => {
    const a = { o: TAPPER, okey: "tap", P: [SH, 0, TZ] as V3, seed: 7, opts: {} } as Actor;
    hammerFor(g, v, a, f, [], hitPt(W10));
    const head = v.w([SH, 1.95, TZ]), hs = v.ppm([SH, 1.9, TZ]);
    qmark(g, head[0] + hs * 0.35, head[1] - hs * 0.15, hs * 0.38, f - HOW, 0.15);
    qmark(g, head[0] - hs * 0.32, head[1] - hs * 0.05, hs * 0.3, f - BROKEN, -0.2);
    if (f >= IRIS_IN) {
      const c = v.w(hub(W10)), r = W_R * v.ppm(hub(W10));
      const u = clamp01((f - IRIS_IN) / 12), rr = r * 0.3 + (1500 - r * 0.3) * u * u;
      g.save(); g.beginPath(); g.arc(c[0], c[1], rr, 0, 7); g.clip(); g.setTransform(1, 0, 0, 1, 0, 0); drawInsert(g, f); g.restore();
      g.save(); g.lineWidth = 10; g.strokeStyle = "#fff6c8"; g.globalAlpha = 1 - u; g.beginPath(); g.arc(c[0], c[1], rr, 0, 7); g.stroke(); g.restore();
    }
  },
});

// ---------------- the explainer insert (output px, full screen) ----------------
const I_SOLID = F(23.48), I_RING = F(24.54), I_BELL = F(25.22), I_CRACK = F(26.08), I_HIDE = F(26.6), I_DIE = F(28.06);
const I_GLASS = F(29.22), I_TING = F(30.45), I_GCRACK = F(31.1), I_THUD = F(32.2), I_BACK = F(32.84), I_SPEED = F(33.76);
const I_SHATTER = F(34.66), I_TRAIN = F(35.05), I_DERAIL = F(35.4);
SOUNDS.push({ f: I_RING, kind: "ring", col: "#7dfcb0" }, { f: I_BELL, kind: "ring", col: "#ffd76a" }, { f: I_DIE, kind: "dead", col: "#ff5a4a" },
  { f: I_TING, kind: "ring", col: "#9fd4ff" }, { f: I_THUD, kind: "dead", col: "#ff5a4a" });
const IC: P2 = [540, 760], IR = 280;
export const drawInsert = (g: CanvasRenderingContext2D, f: number) => {
  // background: deep navy blueprint with a soft centre glow and a fine grid
  const bg = g.createRadialGradient(540, 760, 80, 540, 900, 1300);
  bg.addColorStop(0, "#2a4a72"); bg.addColorStop(0.55, "#16294a"); bg.addColorStop(1, "#0b1528");
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
  g.save(); g.strokeStyle = "rgba(150,190,240,0.09)"; g.lineWidth = 2;
  for (let x = 0; x <= 1080; x += 72) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1920); g.stroke(); }
  for (let y = 0; y <= 1920; y += 72) { g.beginPath(); g.moveTo(0, y); g.lineTo(1080, y); g.stroke(); }
  g.restore();
  const t = f - INS_A;
  // slow drift so the frame never sits dead still
  g.save(); const dz = 1 + 0.0009 * t; g.translate(540, 900); g.scale(dz, dz); g.translate(-540, -900);
  // ----- wheel phase (bell / crack / dead) -----
  const wheelK = (f < I_GLASS - 4 ? 1 : 1 - smooth((f - (I_GLASS - 4)) / 8)) + (f >= I_BACK - 2 ? smooth((f - (I_BACK - 2)) / 8) : 0);
  const spin = f < I_SPEED - 12 ? 0.004 * t : 0.004 * t + 0.0026 * (f - (I_SPEED - 12)) ** 2;
  const crackA = f < I_HIDE ? 1 : f < I_BACK ? 1 - 0.85 * smooth((f - I_HIDE) / 14) : 1;
  if (f < I_SHATTER && wheelK > 0.01) {
    const bellOff = f >= I_BELL - 4 && f < I_CRACK - 4 ? smooth((f - (I_BELL - 4)) / 8) * (1 - smooth((f - (I_CRACK - 10)) / 6)) : 0;
    const cx = IC[0] - bellOff * 170, sc = wheelK * (1 - 0.25 * bellOff);
    if (f >= I_SPEED - 12) { // rail + ground streaks for the full-speed section
      const k = smooth((f - (I_SPEED - 12)) / 10);
      g.save(); g.globalAlpha = k; g.strokeStyle = "#cfd3da"; g.lineWidth = 14; g.beginPath(); g.moveTo(0, IC[1] + IR + 7); g.lineTo(1080, IC[1] + IR + 7); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineCap = "round";
      for (let i = 0; i < 9; i++) { const y = IC[1] - IR + i * 75, L = 120 + (i % 3) * 90, x = ((-(f * 70) + i * 260) % 1400 + 1400) % 1400 - 160; g.lineWidth = 6 + (i % 2) * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke(); }
      g.restore();
    }
    const glow = f >= I_SPEED ? 0.5 + 0.5 * Math.sin(f * 0.9) : 0;
    wheel2(g, cx, IC[1], IR * sc, spin, { crack: f >= I_CRACK ? clamp01((f - I_CRACK) / 8) : 0, crackAlpha: Math.min(1, crackA + glow * 0.4), spokes: 10, blur: f > I_SPEED + 4 ? 1 : 0 });
    if (f >= I_SPEED - 4 && f < I_SHATTER) speedLines(g, cx, IC[1], IR * 1.15, IR * 1.6, 0.5, 18);
    // the bell twin
    if (bellOff > 0.01) {
      const sw = Math.sin((f - I_BELL) * 0.5) * 0.25 * Math.exp(-Math.max(0, f - I_BELL) / 14);
      g.save(); g.translate(IC[0] + 240, IC[1] - 170); g.rotate(sw); g.translate(0, 170); bell2(g, 0, 0, 300, easeOutBack(bellOff, 1.6)); g.restore();
      ringWaves(g, IC[0] + 240, IC[1], 150, f - I_BELL, 1, 3, "255,215,110");
    }
    // hammer taps (from off-screen left)
    const ct: P2 = [cx - IR * sc * 0.98, IC[1] + IR * sc * 0.18], hand: P2 = [-120, IC[1] - 420];
    const sw = swingAt(f, [I_RING, I_BELL, I_DIE], 10);
    if (f < I_DIE + 16) drawSwing(g, null, hand, ct, sw.off, 170);
    goodHit(g, [cx, IC[1]], IR * sc, ct, f - I_RING, "180,255,210");
    goodHit(g, [cx, IC[1]], IR * sc, ct, f - I_BELL);
    badHit(g, [cx, IC[1]], IR * sc, ct, f - I_DIE);
    if (f >= I_SOLID && f < I_RING) tyreGlint(g, [cx, IC[1]], IR * sc, (f - I_SOLID) * 0.6);
    // "even one you can't see": a dashed magnifier circle hunting for it
    if (f >= I_HIDE + 6 && f < I_DIE) {
      const u = clamp01((f - I_HIDE - 6) / 10) * (1 - clamp01((f - I_DIE + 6) / 6)), a = -0.7 + Math.sin((f - I_HIDE) * 0.15) * 0.35;
      const mx = cx + Math.cos(a) * IR * 0.85, my = IC[1] + Math.sin(a) * IR * 0.85;
      g.save(); g.globalAlpha = u; g.lineWidth = 12; g.strokeStyle = INK; g.beginPath(); g.arc(mx, my, 90, 0, 7); g.stroke();
      g.lineWidth = 7; g.strokeStyle = "#fff6c8"; g.stroke(); g.lineWidth = 20; g.strokeStyle = INK; g.beginPath(); g.moveTo(mx + 64, my + 64); g.lineTo(mx + 150, my + 150); g.stroke(); g.restore();
    }
  }
  // ----- wine glass phase -----
  if (f >= I_GLASS - 2 && f < I_BACK + 4) {
    const k = easeOutBack(clamp01((f - (I_GLASS - 2)) / 9), 1.6) * (1 - smooth((f - (I_BACK - 4)) / 8));
    const shake = f >= I_TING && f < I_TING + 16 ? Math.sin((f - I_TING) * 2.2) * 6 * (1 - (f - I_TING) / 16) : 0;
    const flick1 = f >= I_TING - 6 && f < I_TING + 6 ? 1 - Math.abs(f - I_TING) / 6 : 0, flick2 = f >= I_THUD - 6 && f < I_THUD + 6 ? 1 - Math.abs(f - I_THUD) / 6 : 0;
    g.save(); g.translate(IC[0] + shake, IC[1] + 60); g.scale(k, k);
    wineGlass(g, 0, 0, 520, f >= I_GCRACK ? clamp01((f - I_GCRACK) / 8) : 0, Math.max(flick1, flick2));
    g.restore();
    const rim: P2 = [IC[0] + 166, IC[1] + 60 - 286];
    ringWaves(g, IC[0], IC[1] - 80, 170, f - I_TING, 1, 3, "190,225,255");
    sparkle(g, rim[0], rim[1], 60, (f - I_TING) / 10);
    dullPuff(g, rim[0], rim[1], 160, f - I_THUD);
  }
  // ----- shatter -----
  if (f >= I_SHATTER) {
    const u = clamp01((f - I_SHATTER) / 22);
    shatter(g, IC[0], IC[1], IR, u, 0.004 * t);
    if (f < I_SHATTER + 4) { g.fillStyle = `rgba(255,240,210,${0.85 - (f - I_SHATTER) * 0.2})`; g.fillRect(-200, -200, 1480, 2320); }
    speedLines(g, IC[0], IC[1], IR * 0.6, IR * 2.2, (f - I_SHATTER) / 10, 22);
  }
  // ----- derail -----
  if (f >= I_TRAIN - 8) {
    const x = 1180 - easeOut(clamp01((f - (I_TRAIN - 8)) / 16)) * 1060 - (f - I_TRAIN) * 2;
    miniTrain(g, x, 1180, 92, f, { derail: clamp01((f - I_DERAIL) / 20), spin: 0.3 * (f - I_TRAIN) });
  }
  g.restore();
  wavePanel(g, f, clamp01((f - I_RING + 4) / 6) * (1 - clamp01((f - I_SPEED + 14) / 8)));
};

// 5 — the explainer (full-screen insert; the plate underneath is never seen)
add({ a: INS_A, b: INS_B, plate: "strip", keys: [{ f: INS_A, at: hub(W12), z: 1.2 }],
  kicks: [[I_RING, 0.3], [I_BELL, 0.3], [I_CRACK, 0.6], [I_DIE, 0.8], [I_TING, 0.25], [I_THUD, 0.6], [I_SHATTER, 1.4], [I_DERAIL + 6, 0.9]],
  over: (g, v, f) => { g.save(); g.setTransform(1, 0, 0, 1, v.kick * 4.5, v.kick * 2.2); drawInsert(g, f); g.restore(); } });

// 6 — "So he listened to every single wheel, and touched every axle box, to feel if it was running hot."
{
  const L1 = F(37.12), L2 = F(37.64), L3 = F(38.46), TOUCH = F(39.06), FEEL = F(40.58), HOT = F(41.44);
  const HITS = [L1, L2, L3];
  add({
    a: INS_B, b: F(42.02), plate: "strip",
    keys: [
      { f: INS_B, at: hub(W10), z: 1.6, creep: 0.0012 },
      { f: INS_B + 6, dur: 22, at: frameAt(0.45, 0.0), z: 1.14, creep: 0.0016 },
      { f: TOUCH - 2, dur: 22, at: frameAt(0.55, 0.04), z: 1.26, creep: 0.0018 },
      { f: HOT - 3, dur: 8, at: frameAt(0.42, 0.0), z: 1.34, roll: 0.04, creep: 0.0015, punch: 0.006, pn: 14 },
    ],
    kicks: [[L1, 0.25], [L2, 0.25], [L3, 0.3], [HOT, 0.8]],
    cast: (f) => {
      const ex: [number, Expr][] = [[0, "smile_closed"], [TOUCH, "neutral"], [FEEL + 10, "nervous"], [HOT, "shock"], [HOT + 12, "pained"]];
      const left: [number, Hands][] = [[0, {}], [L1 + 3, cupEar], [TOUCH - 6, {}]];
      const a = tapper(f, [SH, 0, TZ], ex, HITS, {}, left);
      if (f >= TOUCH - 4) {
        const r = poseAt(f, [[0, { r: rHand(0) }], [TOUCH - 4, { r: [1.2, 0.72] }], [HOT, { r: [0.2, -0.75] }], [HOT + 10, { r: [0.35, -0.45] }]]).r;
        const shake = f > HOT && f < HOT + 20 ? Math.sin(f * 2.4) * 0.06 : 0;
        a.opts.hands = { l: [-0.3, 0.75], r: [r[0] + shake, r[1]] };
      }
      return [a];
    },
    over: (g, v, f) => {
      const a = { o: TAPPER, okey: "tap", P: [SH, 0, TZ] as V3, seed: 7, opts: {} } as Actor;
      if (f < TOUCH - 4) hammerFor(g, v, a, f, HITS, hitPt(W10));
      else if (HAND.has("tap")) { // the hammer hangs from the left hand while the right touches the box
        const hand = handOut(v, a, HAND.get("tap")!.l), m = v.ppm(a.P);
        tapHammer(g, hand, [hand[0] - 0.12 * m, hand[1] + 0.62 * m], 0.55 * m);
      }
      const c = v.w(hub(W10)), r = W_R * v.ppm(hub(W10)), head = v.w([SH - 0.1, 1.62, TZ]);
      for (const h of HITS) { goodHit(g, c, r, v.w(hitPt(W10)), f - h); earWaves(g, c, head, f - h - 2, v.ppm(hub(W10))); }
      const b = v.w(boxPt(W10)), bs = v.ppm(boxPt(W10));
      shimmer(g, b[0], b[1], bs * 0.5, f, clamp01((f - FEEL) / 10) * (1 - clamp01((f - HOT - 18) / 10)));
      const hd2 = v.w([SH, 1.95, TZ]), hs = v.ppm([SH, 1.9, TZ]);
      emark(g, hd2[0] + hs * 0.3, hd2[1] - hs * 0.1, hs * 0.4, f - HOT - 1, 0.15);
      if (HAND.has("tap") && f >= HOT) { const hd = handOut(v, a, HAND.get("tap")!.r); puffAt(g, hd[0], hd[1], hs * 0.6, f - HOT - 2, 16); }
      // iris back out of the explainer onto the same wheel
      if (f < INS_B + 12) {
        const u = clamp01((f - INS_B) / 12), rr = 1500 - (1500 - r) * (1 - (1 - u) * (1 - u));
        g.save(); g.beginPath(); g.arc(c[0], c[1], rr, 0, 7); g.clip(); g.setTransform(1, 0, 0, 1, 0, 0); drawInsert(g, f); g.restore();
        g.save(); g.lineWidth = 10; g.strokeStyle = "#fff6c8"; g.globalAlpha = u; g.beginPath(); g.arc(c[0], c[1], rr, 0, 7); g.stroke(); g.restore();
      }
    },
  });
}

// 7 — "Today, the wheel tappers are gone, but trains still get tapped. Machines beside the track hit every wheel as it
//      rolls past. And listen. The hammer man just became a robot."  (golden hour)
{
  const TODAY = F(42.02), GONE = F(43.18), BOT = F(43.78), TAP1 = F(44.76), ROLL0 = F(45.5), ROLL1 = F(48.2), LISTEN = F(48.36);
  const GHOST = F(49.54), BECAME = F(50.34), ROBOT = F(50.8);
  const RHITS = [TAP1, F(46.42), F(46.75), F(47.08), F(47.42), F(47.76), F(48.1)];
  const BOT_P: V3 = [11.3, 0, -1.75];
  const spinAt = (f: number) => { // wheel angle while the train rolls past
    const a = (x: number) => x <= 0 ? 0 : x; const u0 = a(f - ROLL0), u1 = a(f - ROLL1);
    return 0.02 * u0 * u0 / 2 - 0.02 * u1 * u1 / 2 + 0 * u1;
  };
  add({
    a: TODAY, b: TOTAL, plate: "strip_w", xfade: 16,
    keys: [
      { f: TODAY, at: frameAt(0.3, -0.02), z: 1.14, creep: 0.0018 },
      { f: BOT - 4, dur: 22, at: frameAt(0.6, 0.02), z: 1.22, creep: 0.0015 },
      { f: ROLL0 - 4, dur: 26, at: frameAt(0.62, -0.04), z: 1.1, creep: 0.0012 },
      { f: GHOST - 4, dur: 26, at: frameAt(0.02, 0.02), z: 1.12, creep: 0.0018 },
      { f: ROBOT - 2, dur: 8, at: frameAt(0.12, 0.04), z: 1.24, roll: 0.03, creep: 0.002, punch: 0.006, pn: 16 },
    ],
    kicks: [[TAP1, 0.3], [ROBOT, 0.6], ...RHITS.slice(1).map((h) => [h, 0.15] as [number, number])],
    cast: (f) => {
      const out: Actor[] = [];
      if (f < GONE + 14) out.push({ ...stand(TAPPER, "tapg", [SH, 0, TZ], 7, f, [[0, "smile_closed"], [GONE - 6, "smile"]], [[0, {}], [GONE - 8, { r: [0.15, -1.05] }]], { facing: 0 }),
        alpha: 1 - clamp01((f - GONE) / 14) });
      if (f >= GHOST) {
        const k = clamp01((f - GHOST) / 8) * (1 - clamp01((f - ROBOT - 6) / 12));
        const o = f >= BECAME ? TAPPER_BARE : TAPPER;
        out.push({ ...stand(o, "ghost", [SH + 0.55, 0, -1.95], 8, f, [[0, "smile"], [BECAME, "laugh"], [ROBOT, "grin"]],
          [[0, {}], [BECAME - 8, { r: [0.12, -1.1] }], [BECAME + 2, { r: [0.55, -0.6] }], [ROBOT, {}]], { facing: 1 }), alpha: 0.55 * k, noShadow: true });
      }
      return out;
    },
    under: (g) => warmGrade(g),
    over: (g, v, f) => {
      // the tapper dissolving into sparkles
      const tp = v.w([SH, 1.0, TZ]), ts = v.ppm([SH, 1.0, TZ]);
      if (f >= GONE && f < GONE + 26) for (let i = 0; i < 7; i++) sparkle(g, tp[0] + (hh(i, 2) - 0.5) * ts * 0.9, tp[1] - (f - GONE) * ts * 0.03 - hh(i, 4) * ts * 0.9, ts * 0.12, (f - GONE - i * 2) / 14, "#ffe9a8");
      // rolling wheels over the plate's wheels + streaks along the body
      const rolling = f >= ROLL0 && f < ROLL1 + 30;
      if (rolling) {
        const ang = spinAt(f), sp = Math.min(1, (f - ROLL0) / 14) * (1 - clamp01((f - ROLL1) / 26));
        for (const xw of [W12, W10, W4]) { const c = v.w([xw, W_R, WZ - 0.02]), r = W_R * v.ppm([xw, W_R, WZ]); wheel2(g, c[0], c[1], r * 1.0, -ang, { spokes: 10, blur: sp > 0.6 ? 1 : 0 }); }
        g.save(); g.strokeStyle = `rgba(255,236,200,${0.55 * sp})`; g.lineCap = "round";
        for (let i = 0; i < 10; i++) { const P: V3 = [9.5, 1.5 + (i % 5) * 0.45, -1.45], p = v.w(P), L = 160 + (i % 3) * 120, x = ((f * 55 + i * 230) % 1500) - 200; g.lineWidth = 5 + (i % 2) * 4; g.beginPath(); g.moveTo(x, p[1]); g.lineTo(x + L, p[1]); g.stroke(); }
        g.restore();
      }
      // the robot
      const k = pop(f, BOT, 8, 2.0);
      if (k > 0) {
        const base = v.w(BOT_P), s = v.ppm(BOT_P) * 0.95 * k, ct = v.w(hitPt(W10));
        const pivot: P2 = [base[0] + s * 0.3, base[1] - s * 0.7], aHit = Math.atan2(ct[1] - pivot[1], ct[0] - pivot[0]), L = Math.hypot(ct[0] - pivot[0], ct[1] - pivot[1]);
        const sw = swingAt(f, RHITS, 6);
        const cap = f >= BECAME ? easeOutBack(clamp01((f - BECAME - 4) / 8), 2) : 0;
        const dish = f >= LISTEN - 2 && f < LISTEN + 30 ? Math.sin((f - LISTEN) * 0.5) * 0.25 : 0;
        detector(g, base[0], base[1], s, 0, f, { armAng: aHit + sw.off * 0.7, armLen: L - s * 0.06, cap, wink: f >= ROBOT && f < ROBOT + 40 && Math.floor((f - ROBOT) / 3) % 6 !== 5,
          wave: f >= TAP1 ? Math.max(Math.exp(-(f - (RHITS.filter((h) => h <= f).pop() ?? 0)) / 10), f >= LISTEN ? 0.9 : 0) : 0, dish });
        const c = v.w(hub(W10)), r = W_R * v.ppm(hub(W10));
        for (const h of RHITS) goodHit(g, c, r, ct, f - h, "255,226,160");
        if (f >= LISTEN) earWaves(g, c, [base[0] - s * 0.52, base[1] - s * 1.17], (f - LISTEN) % 20, s);
        if (f >= BECAME) { // the cap flying from the ghost onto the robot
          const u = clamp01((f - BECAME + 2) / 8), from = v.w([SH + 0.55, 2.05, -1.95]), to: P2 = [base[0], base[1] - s * 1.1];
          if (u < 1) { g.save(); g.translate(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u - Math.sin(Math.PI * u) * s * 0.6); g.rotate(u * 6.3);
            g.beginPath(); g.ellipse(0, 0, s * 0.24, s * 0.1, 0, 0, 7); g.fillStyle = "#1f2a44"; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.restore(); }
          sparkle(g, to[0] + s * 0.3, to[1] - s * 0.15, s * 0.22, (f - BECAME - 6) / 12);
        }
        if (f >= ROBOT) { sparkle(g, base[0] + s * 0.42, base[1] - s * 1.3, s * 0.2, (f - ROBOT) / 12); sparkle(g, base[0] - s * 0.4, base[1] - s * 0.95, s * 0.14, (f - ROBOT - 4) / 12); }
      }
    },
  });
}

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
/** full-frame overlays after the shots: the two steam wipes */
export const overlay = (g: CanvasRenderingContext2D, f: number) => {
  for (const W of [WIPE1, WIPE2]) {
    if (f >= W - 13 && f < W) steamWipe(g, smooth((f - (W - 13)) / 13), f, -1);
    else if (f >= W && f < W + 16) steamWipe(g, 1 - smooth((f - W) / 16), f, 1);
  }
};
