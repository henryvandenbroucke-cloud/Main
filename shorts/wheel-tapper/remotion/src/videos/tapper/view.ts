// Projection of the 3D sets onto a plate (same camera as Plate.tsx) and the 2D camera that moves over the plate.
// Camera grammar from the template (story.ts / motion.md): symmetric smootherstep glides of 18-40 f, every hold
// creeps in (0.15-0.35 %/f, ~0.6 %/f on punch words), 4-5 degree rolls, impact kicks that flip sign every frame and
// decay over 7 f, cuts on big reframes.
import { PlateDef, PW, PH, V3 } from "./story";

export type P2 = [number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const easeOutBack = (u: number, k = 1.7) => { const x = clamp01(u) - 1; return 1 + (k + 1) * x * x * x + k * x * x; };

/** plate projection: world point -> plate pixel + plate px per metre at that depth */
export class PlateCam {
  private r: V3; private u: V3; private f: V3; private fp: number; W: number;
  constructor(public p: PlateDef) {
    this.W = p.w ?? PW;
    const f = sub(p.look, p.pos), fl = Math.hypot(...f);
    this.f = [f[0] / fl, f[1] / fl, f[2] / fl];
    const r: V3 = [-this.f[2], 0, this.f[0]], rl = Math.hypot(...r); // cross(f, up)
    this.r = [r[0] / rl, 0, r[2] / rl];
    this.u = cross(this.r, this.f);
    this.fp = PH / 2 / Math.tan((p.fov * Math.PI) / 360);
  }
  depth(P: V3) { return dot(sub(P, this.p.pos), this.f); }
  px(P: V3): P2 {
    const d = sub(P, this.p.pos), z = Math.max(0.05, dot(d, this.f));
    return [this.W / 2 + (dot(d, this.r) * this.fp) / z, PH / 2 - (dot(d, this.u) * this.fp) / z];
  }
  ppm(P: V3) { return this.fp / Math.max(0.05, this.depth(P)); }
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---------------- 2D camera over a plate ----------------
/** frame centre (plate px), zoom (1 = whole plate width in frame), roll (rad) */
export type Cam2 = { cx: number; cy: number; z: number; roll: number };
export type Key2 = {
  f: number; dur?: number; cut?: boolean;
  /** frame centre: a world point (projected) or plate-normalised [u, v] */
  at: V3 | P2; z: number; roll?: number;
  /** creep (fraction of zoom per frame) after this key; punch = faster creep for `pn` frames */
  creep?: number; punch?: number; pn?: number;
};
const S0 = 1920 / PH; // output px per plate px at zoom 1 (frame height = plate height)

const centreOf = (pc: PlateCam, at: V3 | P2): P2 => (at.length === 3 ? pc.px(at as V3) : [(at as P2)[0] * pc.W, (at as P2)[1] * PH]);
const creepK = (k: Key2, f: number) => {
  const x = Math.max(0, f - k.f), c = k.creep ?? 0.0022;
  let s = c * x;
  const p = k.punch ?? 0, n = k.pn ?? 30;
  if (p > c) for (let i = 0; i < Math.min(x, n); i++) s += (p - c) * Math.max(0, Math.min(1, (i + 0.5) / 6, (n - i - 0.5) / 6));
  return Math.exp(s);
};
const resolve = (pc: PlateCam, k: Key2, f: number): Cam2 => {
  const [cx, cy] = centreOf(pc, k.at);
  return { cx, cy, z: k.z * creepK(k, f), roll: k.roll ?? 0 };
};
/** keep the frame inside the plate (allowing for roll) */
const fit = (c: Cam2, PWp: number): Cam2 => {
  const s = S0 * c.z, ar = Math.abs(c.roll);
  const hw = (540 * Math.cos(ar) + 960 * Math.sin(ar)) / s, hh = (960 * Math.cos(ar) + 540 * Math.sin(ar)) / s;
  const z = Math.max(c.z, (2 * hw * c.z) / PWp, (2 * hh * c.z) / PH); // zoom up if the rolled frame would show the edge
  const s2 = S0 * z, hw2 = (540 * Math.cos(ar) + 960 * Math.sin(ar)) / s2, hh2 = (960 * Math.cos(ar) + 540 * Math.sin(ar)) / s2;
  return { cx: Math.min(PWp - hw2, Math.max(hw2, c.cx)), cy: Math.min(PH - hh2, Math.max(hh2, c.cy)), z, roll: c.roll };
};
export const cam2At = (pc: PlateCam, keys: Key2[], f: number): Cam2 => {
  let cur = resolve(pc, keys[0], f);
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    const nx = resolve(pc, k, f);
    if (k.cut) cur = nx;
    else {
      const u = glide((f - k.f) / (k.dur ?? 24));
      cur = { cx: cur.cx + (nx.cx - cur.cx) * u, cy: cur.cy + (nx.cy - cur.cy) * u, z: cur.z * Math.pow(nx.z / cur.z, u), roll: cur.roll + (nx.roll - cur.roll) * u };
    }
  }
  return fit(cur, pc.W);
};

/** impact kicks: [frame, strength]; image offset flips sign every frame and decays to 0 over 7 f */
export const kickAt = (kicks: [number, number][], f: number) => {
  let a = 0;
  for (const [f0, g] of kicks) {
    const n = f - f0;
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};

/** the full world -> output-pixel mapping for one frame of one shot */
export class View {
  s: number; private c: number; private sn: number;
  constructor(public pc: PlateCam, public cam: Cam2, public kick = 0, public dx = 0) {
    this.s = S0 * cam.z; this.c = Math.cos(cam.roll); this.sn = Math.sin(cam.roll);
  }
  /** plate px -> output px */
  fromPlate([x, y]: P2): P2 {
    const ox = (x - this.cam.cx) * this.s, oy = (y - this.cam.cy) * this.s;
    return [540 + ox * this.c - oy * this.sn + this.kick * 4.5 + this.dx, 960 + ox * this.sn + oy * this.c + this.kick * 2.2];
  }
  w(P: V3): P2 { return this.fromPlate(this.pc.px(P)); }
  ppm(P: V3) { return this.pc.ppm(P) * this.s; }
  /** apply this view to a 2D context so drawing in plate px lands right */
  applyPlate(g: CanvasRenderingContext2D) {
    g.translate(540 + this.kick * 4.5 + this.dx, 960 + this.kick * 2.2);
    g.rotate(this.cam.roll);
    g.scale(this.s, this.s);
    g.translate(-this.cam.cx, -this.cam.cy);
  }
}
