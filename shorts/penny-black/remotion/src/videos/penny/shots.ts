// Timeline of "Why Stamps Exist", timed to the voice's words.json (every event hangs off a word).
// Brick-tax staging: toy-bright 3D sets, living faces (blinks, talking mouths, brow pops + a hop on every reaction),
// vector letters / coins / the Penny Black, something moving on every beat.
import { Outfit, FrontOpts, INK, Expr, townsfolk, P2, bodyFront, Pen } from "./toon";
import { V3 } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import { stampMark, puff, ringWaves, qmark, emark, card, hand, letter, sheet, pennyBlack, coin2, mailCoach, horse, secretMark, calendar, thought, moth, sparkle } from "./props2d";
import { walkAt as walkAt2 } from "./anim";
import WORDS from "./words.json";

export const FPS = 30;
export const FLASH_AT = -99;
type Wd = { w: string; s: number; e: number };
const WS = WORDS as Wd[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const A = (ws: string | string[], after = 0): number => {
  const L = (Array.isArray(ws) ? ws : [ws]).map(norm);
  const w = WS.find((x) => L.includes(norm(x.w)) && x.s >= after - 1e-6);
  if (!w) throw new Error("word " + L.join("/") + " after " + after);
  return w.s;
};
const F = (t: number) => Math.round(t * FPS) - 2;
export const TOTAL = Math.ceil((WS[WS.length - 1].e + 0.6) * FPS);

export type Actor = {
  o: Outfit; okey: string; P: V3; opts: FrontOpts; seed: number; hop?: number; scale?: number;
  side?: import("./toon").SideOpts; mirror?: boolean; lean?: number; noShadow?: boolean; clip?: V3[]; alpha?: number;
  draw?: (g: CanvasRenderingContext2D, v: View) => void;
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
  const h = poseAt(f, hands), sw = swaps(ex).filter((s) => s <= f), age = sw.length ? f - sw[sw.length - 1] : 99;
  const brow = age < 12 ? -5 * (1 - age / 12) ** 2 : 0, hop = age < 9 ? 0.05 * Math.sin((Math.PI * age) / 9) : 0;
  return { o, okey, P, seed, hop, ...act, opts: { mode: "stand", expr: exprAt(f, ex), blink: lidAt(f, seed, swaps(ex)), tilt: bob(f + seed * 7), hands: h, brow, ...extra } };
};
/** side-view walker along x (+x is screen-left on the road plate) */
const walker = (o: Outfit, okey: string, seed: number, f: number, path: [number, number, number][], expr: Expr, act: Partial<Actor> = {}, talk = 0): Actor => {
  const w = walkAt(f, path);
  return { o, okey, P: [w.x, 0, w.z], seed, opts: {}, mirror: w.dir[0] > 0, ...act,
    side: { mode: w.moving ? "march" : "stand", phase: w.moving ? w.phase : 0, expr, blink: lidAt(f, seed), stomp: 0.3, stride: w.moving ? 0.8 : 0.01, talk } };
};
/** the hand of a side-view walker (output px), with the arm swing */
const sideHand = (v: View, a: Actor, f: number): P2 => {
  const ft = v.w(a.P), m = v.ppm(a.P), dir = a.mirror ? -1 : 1, ph = a.side?.phase ?? 0;
  return [ft[0] + dir * (0.2 + 0.05 * Math.sin(ph * Math.PI * 2)) * m, ft[1] - (0.98 + 0.02 * Math.cos(ph * Math.PI * 4)) * m];
};
/** a vehicle moving along +x: position with an eased start (frames) */
const drive = (f: number, f0: number, x0: number, speed: number, ease = 20) => {
  const t = Math.max(0, f - f0), e = t < ease ? (t * t) / (2 * ease) : t - ease / 2;
  return x0 + (speed / FPS) * e;
};
const label = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number) => {
  if (age < 0) return;
  const k = easeOutBack(clamp01(age / 7), 2.2), a = 1;
  g.save(); g.font = "900 54px 'Montserrat'"; const ww = g.measureText(text).width + 48; x = Math.max(ww / 2 + 30, Math.min(1080 - ww / 2 - 30, x)); g.translate(x, y); g.scale(k, k); g.globalAlpha = a;
  g.font = "900 54px 'Montserrat'"; const w = g.measureText(text).width + 48;
  g.beginPath(); g.roundRect(-w / 2, -40, w, 80, 40); g.fillStyle = "#fff6e0"; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 3);
  g.restore();
};
const bigNum = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number, col = "#ffd24a") => {
  if (age < 0 || age > 60) return;
  const k = easeOutBack(clamp01(age / 7), 2.4) * (1 - smooth((age - 50) / 10));
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.08);
  g.font = "900 220px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = 34; g.strokeStyle = INK; g.strokeText(text, 0, 0); g.fillStyle = col; g.fillText(text, 0, 0);
  g.restore();
};
const confetti = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number) => {
  if (age < 0 || age > 50) return;
  for (let i = 0; i < 28; i++) {
    const a = hh(i, 1) * Math.PI * 2, sp = 0.6 + hh(i, 2), t = age / 50;
    const px = x + Math.cos(a) * sp * s * easeOut(t) * 1.4, py = y - Math.abs(Math.sin(a)) * sp * s * easeOut(t) * 1.2 + t * t * s * 1.6;
    g.save(); g.translate(px, py); g.rotate(age * 0.3 + i); g.globalAlpha = 1 - clamp01((t - 0.7) / 0.3);
    g.fillStyle = ["#d42f2f", "#f2c14e", "#3f6fb5", "#ffffff", "#5aa83c"][i % 5]; g.fillRect(-8, -5, 16, 10); g.restore();
  }
};
const warmGrade = (g: CanvasRenderingContext2D) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = "#ffdcb5"; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen";
  const gl = g.createRadialGradient(1000, 150, 40, 1000, 150, 1200); gl.addColorStop(0, "rgba(255,190,110,0.5)"); gl.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = gl; g.fillRect(0, 0, 1080, 1920); g.restore();
};
const stampW = (g: CanvasRenderingContext2D, text: string, f: number, f0: number, f1: number, x = 540, y = 430, w = 520, rot = -0.1) => {
  if (f < f0 || f >= f1 + 8) return;
  g.save(); g.globalAlpha = 1 - smooth((f - f1) / 8); stampMark(g, x, y, w, text, f - f0, rot); g.restore();
};
/** whole-frame darkening + soft blur look for 2D inserts drawn over a plate */
const dim = (g: CanvasRenderingContext2D, a: number) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(16,12,28,${a})`; g.fillRect(0, 0, 1080, 1920); g.restore(); };
/** a world-space quad (for clipping actors behind furniture) */
const above = (x0: number, x1: number, y: number, z: number): V3[] => [[x0, y, z], [x1, y, z], [x1, 6, z], [x0, 6, z]];
/** anger steam from a head (output px) */
const fume = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k: number) => { if (k <= 0) return; for (let i = 0; i < 4; i++) { const age = (f * 1.2 + i * 7) % 26; puff(g, x + (i % 2 ? 1 : -1) * s * 0.45, y, s * 0.35 * k, age, 26, "#f4f4f6", [(i % 2 ? 1 : -1) * 0.4, -1]); } };

/** mouth openness while a character speaks inside any of the frame ranges: syllable bursts, closed between them */
const talkAt = (f: number, ranges: [number, number][], seed = 1) => {
  for (const [a, b] of ranges) if (f >= a && f < b) {
    const env = Math.min(1, (f - a) / 2, (b - f) / 2), syl = Math.abs(Math.sin(f * 0.95 + seed)) * (0.55 + 0.45 * Math.abs(Math.sin(f * 0.37 + seed * 2)));
    return clamp01(env * syl * 1.1);
  }
  return 0;
};
/** comic speech bubble (output px) popping in at age 0 */
const bubble = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number, tail: P2, size = 64) => {
  if (age < 0 || age > 50) return;
  const k = easeOutBack(clamp01(age / 7), 2.2) * (1 - smooth((age - 42) / 8));
  g.save(); g.font = `900 ${size}px 'Montserrat'`; const w = g.measureText(text).width + size * 1.1, hb = size * 1.6;
  g.translate(x, y); g.scale(k, k);
  g.beginPath(); g.roundRect(-w / 2, -hb / 2, w, hb, hb / 2); g.moveTo(tail[0] - x - 18, -0); g.lineTo(tail[0] - x, tail[1] - y); g.lineTo(tail[0] - x + 26, 0);
  g.fillStyle = "#fffaf0"; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.roundRect(-w / 2 + 4, -hb / 2 + 4, w - 8, hb - 8, hb / 2); g.fillStyle = "#fffaf0"; g.fill();
  g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 4);
  g.restore();
};
// ---------------- the 3D sprite atlas ----------------
let ATL: HTMLImageElement | null = null;
export const setAtlas = (im: HTMLImageElement) => { ATL = im; };
const CELLPX = 512;
/** draw atlas cell (row, col) centred at (x, y), `size` = drawn cell width in px; vel = screen velocity for a motion smear */
const spr = (g: CanvasRenderingContext2D, row: number, col: number, x: number, y: number, size: number, rot = 0, alpha = 1, vel: P2 = [0, 0]) => {
  if (!ATL || alpha <= 0.01 || size < 1) return;
  const sp = Math.hypot(vel[0], vel[1]), n = sp > size * 0.08 ? 4 : 1;
  for (let i = n - 1; i >= 0; i--) {
    const u = n > 1 ? i / (n - 1) : 0;
    g.save(); g.globalAlpha = alpha * (n > 1 ? (i === 0 ? 1 : 0.28) : 1);
    g.translate(x - vel[0] * u * 0.9, y - vel[1] * u * 0.9); g.rotate(rot);
    g.drawImage(ATL, col * CELLPX, row * CELLPX, CELLPX, CELLPX, -size / 2, -size / 2, size, size);
    g.restore();
  }
};
const LEAF = (i: number) => [Math.floor((i % 16) / 8), i % 8] as const;
/** tea leaves bursting out of a point: gravity, spin, smear; ash = green leaves (row 2) */
const leafBurst = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, n = 14, seed = 1, ash = false, up = 1) => {
  if (age < 0 || age > 40) return;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (hh(i, seed) - 0.5) * 2.4, sp = s * (0.06 + hh(i, seed + 1) * 0.08) * up, t = age;
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp + s * 0.012 * t;
    const px = x + Math.cos(a) * sp * t, py = y + Math.sin(a) * sp * t + 0.006 * s * t * t;
    const [r, c] = ash ? [2, i % 8] as const : LEAF(i + seed * 3);
    spr(g, r, c, px, py, s * (0.16 + hh(i, seed + 2) * 0.08), t * 0.2 * (hh(i, seed + 3) - 0.5) * 2 + i, 1 - clamp01((t - 28) / 12), [vx, vy]);
  }
};
/** a pouring stream of leaves from a to b (continuous while on) */
const leafStream = (g: CanvasRenderingContext2D, a: P2, b: P2, s: number, f: number, k: number, seed = 2, ash = false) => {
  if (k <= 0) return;
  for (let i = 0; i < 16; i++) {
    const u = ((f * 0.07 + i / 16 + hh(i, seed) * 0.05) % 1), x = a[0] + (b[0] - a[0]) * u + Math.sin(i * 3 + f * 0.2) * s * 0.03, y = a[1] + (b[1] - a[1]) * u * u;
    const [r, c] = ash ? [2, i % 8] as const : LEAF(i + seed);
    spr(g, r, c, x, y, s * 0.14, f * 0.15 + i, k, [0, s * 0.05]);
  }
};
/** steam curling up from a point */
const steam = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k = 1, seed = 0) => {
  if (k <= 0) return;
  for (let i = 0; i < 4; i++) {
    const u = ((f * 0.012 + i / 4 + seed * 0.13) % 1), px = x + Math.sin(u * 7 + i + seed) * s * 0.18, py = y - u * s * 1.6;
    spr(g, 3, (i + seed) % 6, px, py, s * (0.35 + u * 0.6), u * 1.5, k * 0.75 * Math.sin(Math.PI * u));
  }
};
/** a soft puff (dust/steam) burst from row 3 */
const puffs = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, n = 5, grey = false, seed = 4) => {
  if (age < 0 || age > 24) return;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + hh(i, seed), u = age / 24, d = s * (0.2 + 0.5 * easeOut(u)); spr(g, 3, grey ? 6 + (i % 2) : i % 6, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - u * s * 0.3, s * (0.4 + 0.4 * u), a, 1 - u); }
};
/** water spray from a point (row 4) */
const spray = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, seed = 5) => {
  if (age < 0 || age > 22) return;
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (hh(i, seed) - 0.5) * 2.0, sp = s * (0.03 + hh(i, seed + 1) * 0.04); spr(g, 4, i % 2 ? 4 + (i % 4) : i % 4, x + Math.cos(a) * sp * age, y + Math.sin(a) * sp * age + 0.004 * s * age * age, s * 0.18, 0, 1 - clamp01((age - 14) / 8), [Math.cos(a) * sp, Math.sin(a) * sp]); }
};
const caddy = (g: CanvasRenderingContext2D, x: number, y: number, size: number, lid: number, rot = 0) => spr(g, 5, Math.round(clamp01(lid) * 7), x, y, size, rot);
const keyS = (g: CanvasRenderingContext2D, x: number, y: number, size: number, turn: number, rot = 0) => spr(g, 6, ((Math.round(turn * 8) % 8) + 8) % 8, x, y, size, rot);
const PROP = { sack: 0, cup: 1, spoon: 2, coin: 3, boat: 4, barrel: 5, quill: 6, scissors: 7 };
const prop = (g: CanvasRenderingContext2D, k: keyof typeof PROP, x: number, y: number, size: number, rot = 0, alpha = 1, vel: P2 = [0, 0]) => spr(g, 7, PROP[k], x, y, size, rot, alpha, vel);
/** a glint sweeping across a point (bright soft lens flare, not a cartoon star) */
const glint = (g: CanvasRenderingContext2D, x: number, y: number, r: number, age: number) => {
  if (age < 0 || age > 14) return; const k = Math.sin(Math.PI * age / 14);
  g.save(); g.globalCompositeOperation = "screen";
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,250,225,${0.95 * k})`); gr.addColorStop(0.3, `rgba(255,230,160,${0.4 * k})`); gr.addColorStop(1, "rgba(255,220,140,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = `rgba(255,250,230,${0.45 * k})`; g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(x - r * 0.45 * k, y); g.lineTo(x + r * 0.45 * k, y); g.stroke();
  g.restore();
};
/** paper notice (tax) held / pinned: flat paper is fine as paper */
const notice = (g: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, sub: string, k = 1, rot = 0) => {
  if (k <= 0) return; const h = w * 0.62;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fillStyle = "#f3ead2"; g.fill(); g.lineWidth = Math.max(3, w * 0.012); g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#3a2a20"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${w * 0.09}px Georgia, serif`; g.fillText(sub, 0, -h * 0.25);
  g.font = `900 ${w * 0.24}px Georgia, serif`; g.fillStyle = "#8c2f39"; g.fillText(text, 0, h * 0.12);
  g.restore();
};

// ---------------- grades ----------------
/** candlelit night over the plate: deep plum multiply, warm pools around the candles, vignette */
const candleGrade = (g: CanvasRenderingContext2D, v: View, pools: V3[], f: number, k = 1) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = `rgba(78,62,104,${0.72 * k})`; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen";
  for (const [i, P] of pools.entries()) { const c = v.w(P), r = v.ppm(P) * 2.6 * (1 + 0.04 * Math.sin(f * 0.5 + i * 2)); const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); gr.addColorStop(0, `rgba(255,190,110,${0.55 * k})`); gr.addColorStop(0.5, `rgba(255,150,70,${0.18 * k})`); gr.addColorStop(1, "rgba(255,140,60,0)"); g.fillStyle = gr; g.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); }
  g.globalCompositeOperation = "source-over"; const vg = g.createRadialGradient(540, 900, 450, 540, 960, 1250); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(12,6,20,${0.6 * k})`); g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
  g.restore();
};
const darkGrade = (g: CanvasRenderingContext2D, k: number, spot: P2 = [540, 1100]) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = `rgba(40,36,70,${0.85 * k})`; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "source-over"; const vg = g.createRadialGradient(spot[0], spot[1], 120, spot[0], spot[1], 1000); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(5,3,12,${0.8 * k})`); g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
  g.restore();
};
/** soft candle flame (no lines) */
const flame = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k = 1) => {
  if (k <= 0) return; const fl = 1 + 0.12 * Math.sin(f * 0.9) + 0.06 * Math.sin(f * 2.3);
  g.save(); g.globalCompositeOperation = "screen"; const gr = g.createRadialGradient(x, y, 0, x, y, s * 3); gr.addColorStop(0, `rgba(255,210,120,${0.6 * k})`); gr.addColorStop(1, "rgba(255,160,60,0)"); g.fillStyle = gr; g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6); g.restore();
  g.save(); g.globalAlpha = k; g.translate(x, y); g.scale(1, fl); g.beginPath(); g.moveTo(0, -s * 1.2); g.quadraticCurveTo(s * 0.55, -s * 0.2, 0, s * 0.35); g.quadraticCurveTo(-s * 0.55, -s * 0.2, 0, -s * 1.2); g.fillStyle = "#ffd36a"; g.fill(); g.beginPath(); g.ellipse(0, 0, s * 0.18, s * 0.32, 0, 0, 7); g.fillStyle = "#fff6d8"; g.fill(); g.restore();
};
/** a card lying on a surface seen at an angle: squash vertically by the view's tilt */
const cardFlat = (g: CanvasRenderingContext2D, x: number, y: number, w: number, tilt: number, rot: number, o: Parameters<typeof card>[5] = {}) => { g.save(); g.translate(x, y); g.scale(1, tilt); card(g, 0, 0, w, rot, { ...o, shadow: false }); g.restore(); };
/** a card flying along an arc from a to b (u 0..1), spinning, with a soft motion smear */
const cardFly = (g: CanvasRenderingContext2D, a: P2, b: P2, u: number, w: number, spin: number, o: Parameters<typeof card>[5] = {}, arc = 0.3) => {
  if (u <= 0 || u >= 1) return; const e = easeOut(u);
  for (let k = 2; k >= 0; k--) { const uu = Math.max(0, e - k * 0.035); const x = a[0] + (b[0] - a[0]) * uu, y = a[1] + (b[1] - a[1]) * uu - Math.sin(Math.PI * uu) * arc * Math.hypot(b[0] - a[0], b[1] - a[1]); g.save(); g.globalAlpha = k ? 0.22 : 1; card(g, x, y, w, spin * (1 - uu), { ...o, shadow: k === 0 }); g.restore(); }
};
/** riffle shuffle at u 0..1: two halves drop alternately into the middle, then bridge */
const riffle = (g: CanvasRenderingContext2D, x: number, y: number, w: number, u: number) => {
  const N = 18, bridge = clamp01((u - 0.72) / 0.28);
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, t0 = (i / N) * 0.62, t = clamp01((u - t0) / 0.12);
    const sx = x + side * w * 0.62, sy = y - (N - i) * w * 0.012, ex = x, ey = y - i * w * 0.013;
    const px = sx + (ex - sx) * easeOut(t), py = sy + (ey - sy) * easeOut(t) - Math.sin(Math.PI * t) * w * 0.12 - Math.sin(Math.PI * bridge) * w * 0.25 * (1 - Math.abs(i - N / 2) / (N / 2));
    const rot = side * 0.35 * (1 - t) + (bridge > 0 ? Math.sin(Math.PI * bridge) * (i - N / 2) * 0.012 : 0);
    g.save(); g.translate(px, py); g.scale(1, 0.55); card(g, 0, 0, w, rot, { face: i === N - 1 && u > 0.98 ? "ace" : "back", shadow: i === 0 }); g.restore();
  }
};
/** a red STAMP OFFICE seal stamped on (age frames) */
const seal = (g: CanvasRenderingContext2D, x: number, y: number, r: number, age: number, rot = -0.2) => {
  if (age < 0) return; const k = age < 4 ? 1.7 - 0.7 * easeOut(age / 4) : 1;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k); g.globalAlpha = Math.min(0.85, 0.3 + age / 5);
  g.strokeStyle = "#c0353a"; g.lineWidth = r * 0.08; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.78, 0, 7); g.lineWidth = r * 0.04; g.stroke();
  g.fillStyle = "#c0353a"; g.font = `900 ${r * 0.26}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("STAMP", 0, -r * 0.2); g.fillText("OFFICE", 0, r * 0.18);
  g.font = `700 ${r * 0.16}px Georgia, serif`; g.fillText("DUTY PAID", 0, r * 0.5);
  g.restore();
};
/** a coin stack growing (n coins) with a little bounce on the newest */
const coinStack = (g: CanvasRenderingContext2D, x: number, y: number, s: number, n: number, f: number) => { for (let i = 0; i < n; i++) prop(g, "coin", x + Math.sin(i * 1.7) * s * 0.03, y - i * s * 0.09 - (i === n - 1 ? Math.abs(Math.sin(f * 0.6)) * s * 0.04 : 0), s * 0.55, 1.4 + i * 0.2); };
/** the badge flashed from under a coat */
const badge = (g: CanvasRenderingContext2D, x: number, y: number, s: number, k: number) => {
  if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k);
  g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.42 : s * 0.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
  const gr = g.createLinearGradient(-s * 0.5, -s * 0.5, s * 0.5, s * 0.5); gr.addColorStop(0, "#fff1b0"); gr.addColorStop(0.5, "#d6a63c"); gr.addColorStop(1, "#8c6420"); g.fillStyle = gr; g.fill(); g.lineWidth = s * 0.04; g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#5a3b10"; g.font = `900 ${s * 0.12}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("STAMP", 0, -s * 0.07); g.fillText("OFFICE", 0, s * 0.08);
  g.restore();
};

// ---------------- word anchors (seconds) ----------------
const tRefused = A("refused"), tLetter0 = A(["letter", "letter."], tRefused), tExactly = A("exactly"), tRead = A("read", tExactly);
const tBack = A("back"), tSend = A("send"), tYou = A("you", A("letter", tSend)), tReceive = A("receive"), tSometimes = A("sometimes"), tShilling = A(["shilling", "shilling."], tSometimes);
const tSome = A("some", tShilling), tWhole = A("whole"), tWages = A(["wages", "wages."]);
const tSo = A("so", tWages), tPoet = A("poet"), tColeridge = A("coleridge"), tWalking = A("walking"), tCottage = A("cottage"), tPostman = A("postman", tCottage), tHands = A("hands", tPostman);
const tShe = A("she", tHands), tLooks = A("looks"), tTurns = A("turns"), tHands2 = A("hands", tTurns), tBack2 = A(["back", "back."], tHands2);
const tColeridge2 = A("coleridge", tBack2), tSorry = A("sorry"), tPays = A("pays"), tShilling2 = A("shilling", tPays);
const tBut = A("but", tShilling2), tLeaves = A(["leaves", "leaves,"]), tOpens = A("opens"), tBlank = A(["blank", "blank."]);
const tHer = A("her", tBlank), tBrother = A("brother", tHer), tEmpty = A("empty"), tEvery = A("every", tEmpty), tThree = A("three"), tMonths = A(["months", "months."]);
const tIf = A("if", tMonths), tArrives = A(["arrives", "arrives,"]), tFine = A(["fine", "fine."]), tMessage = A("message"), tFree = A(["free", "free."]);
const tAnd2 = A("and", tFree), tPeople = A("people", tAnd2), tSecret = A("secret"), tMarks = A("marks"), tRead2 = A("read", tMarks), tDoor = A(["door", "door,"], tRead2), tSaid = A(["said", "said,"]), tNo = A("no", tSaid);
const tSo2 = A("so", tNo), tDragging = A("dragging"), tCountry = A("country"), tGetting = A("getting"), tNothing = A("nothing");
const tUntil = A("until", tNothing), tTeacher = A(["teacher", "schoolteacher"]), tHill = A("hill"), tIdea = A(["idea", "idea."]);
const tWhat = A("what", tIdea), tSender = A("sender"), tInstead = A(["instead", "instead?"]), tOne = A("one", tInstead), tPenny = A(["penny", "penny,"], tOne), tAnywhere = A("anywhere"), tBritain = A(["britain", "britain."], tAnywhere);
const tProve = A("prove"), tStick = A("stick"), tTiny = A("tiny"), tQueen = A("queen"), tCorner = A(["corner", "corner."]);
const tIn1840 = A("in", tCorner), t1840 = A(["1840", "1840,"]), tPennyB = A("penny", t1840), tBorn = A(["born", "born,"]), tFirst = A("first", tBorn), tStamp = A(["stamp", "stamp."], tFirst);
const tAnd3 = A("and", tStamp), tYear = A(["year", "year,"]), tNumber = A("number"), tDoubled = A(["doubled", "doubled."]);
const tSo3 = A("so", tDoubled), tStamp2 = A("stamp", tSo3), tLicked = A("licked"), tBasically = A("basically"), tKept = A("kept"), tNo2 = A("no", tKept), tPostmanEnd = A(["postman", "postman."], tNo2);

// ---------------- cast (white heads) ----------------
const WHITE = "#f8f6f1";
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, skin: WHITE, ...o } as Outfit);
const SISTER = O({ jacket: "#5a7a9a", hat: "bonnet", dress: "#c25a7a", boots: "#4a3426" });
const POSTMAN = O({ jacket: "#c0353a", pants: "#2b3a5a", hat: "tophat", buttons: "#e8c45a", moustache: "#5a3b2a", build: "stout" });
const COLERIDGE = O({ jacket: "#2f4a3a", pants: "#3a3530", hat: "hair", hair: "#2a2420", buttons: "#c9a23a" });
const BROTHER = O({ jacket: "#5d7a3a", pants: "#3b3f52", hat: "cap", cap: "#3a3f52", boots: "#4a3426" });
const WORKER = O({ jacket: "#8c6a45", pants: "#3a3530", hat: "cap", cap: "#5a3b2a", moustache: "#3a2a20" });
const GENT = O({ jacket: "#3f6fb5", pants: "#2b2b35", hat: "tophat", buttons: "#e8c45a" });
const HILL = O({ jacket: "#2c3140", pants: "#2b2b35", hat: "hair", hair: "#5a3b2a", buttons: "#c9ccd2" });
const CLERK = O({ jacket: "#3f4a6b", pants: "#2b2b35", hat: "hair", hair: "#e9e6e0", buttons: "#c9a23a", build: "stout", moustache: "#c9ccd2" });
const LADY2 = O({ jacket: "#7b5ac9", hat: "bonnet", dress: "#d9a441", boots: "#4a3426" });
const MAN3 = O({ jacket: "#b5653f", pants: "#3b3f52", hat: "tophat", moustache: "#2a201a" });
const CROWD = [0, 1, 2, 3, 4, 5].map((v) => ({ ...townsfolk(v), skin: WHITE } as Outfit));

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
// the cottage doorstep: she stands in the doorway, the postman on the step (+x is screen-left)
const SIS_P: V3 = [-0.08, 0, 3.72], POST_P: V3 = [0.62, 0, 2.8], COL_P: V3 = [1.25, 0, 0.15];
const HER_HAND: V3 = [0.12, 1.05, 3.45], HIS_HAND: V3 = [0.4, 1.1, 3.0];
const DOOR_X = (k: number) => -300 + k * 5.6 - 1.4; // London terrace doors (facadeHD puts the door in the right-hand bay)

// 1 — HOOK. "Over 200 years ago, a woman refused her brother's letter... and that's exactly how she read it."
//     Frame 1 is tight on the letter being pushed back into the postman's hand; the camera snaps out to reveal his
//     baffled face and her innocent smile.
const C1 = F(tBack) - 3;
add({
  a: 0, b: C1, plate: "door_cu",
  keys: [{ f: 0, at: [0.3, 1.08, 3.2], z: 3.3, creep: 0 }, { f: 1, dur: 22, at: [0.28, 1.45, 3.3], z: 1.25, creep: 0.0024 }],
  kicks: [[1, 0.6], [F(tRefused), 0.35]],
  cast: (f) => [
    stand(SISTER, "sis", SIS_P, 91, f, [[0, "smile"], [F(tRead), "smile_closed"]], [[0, { l: [-0.45, -0.3] }], [12, { l: [-0.2, 0.2], r: [-0.2, 0.2] }], [F(tRead) - 2, { r: [0.05, -1.05] }]], { facing: -1, headTilt: f > F(tRead) ? 6 : 0 }, { noShadow: true }),
    stand(POSTMAN, "post", POST_P, 81, f, [[0, "neutral"], [F(tRefused), "shock"], [F(tExactly), "dazed"]], [[0, { r: [0.45, -0.2] }], [F(tExactly), { r: [0.35, -0.4] }]], { facing: 1, headTilt: f > F(tExactly) ? -8 : 0 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    const m = v.ppm([0.3, 1.4, 3.2]), u = easeOut(clamp01(f / 9));
    const p = v.w(lerp3(HER_HAND, HIS_HAND, u));
    letter(g, p[0], p[1] + Math.sin(f * 0.2) * 3, m * 0.3, -0.12 + 0.1 * u + (f > F(tExactly) ? Math.sin(f * 0.4) * 0.08 : 0), { side: "front", address: 1 });
    const ph = v.w([0.62, 1.95, 2.8]); qmark(g, ph[0] + m * 0.12, ph[1] - m * 0.15, m * 0.2, f - F(tExactly), 0.15);
    const sh = v.w([-0.08, 1.6, 3.72]); sparkle(g, sh[0] - m * 0.22, sh[1] - m * 0.18, m * 0.08, f - F(tRead));
    if (f >= F(tRead)) sparkle(g, sh[0] - m * 0.3, sh[1] + m * 0.02, m * 0.05, f - F(tRead) - 4);
  },
});

// 2 — "Back then, you didn't pay to send a letter. You paid to receive one."  (London: a gent hands his letter over
//     for nothing - FREE; the camera slides along the terrace to the door where the postman holds out his palm - PAY)
const C2 = F(tSometimes) - 4;
{
  const DA = DOOR_X(1), DB = DOOR_X(0);
  add({
    a: C1, b: C2, plate: "street_w", xfade: 6,
    keys: [{ f: C1, at: [DA - 0.3, 1.45, 4.0], z: 1.9, creep: 0.002 }, { f: F(tYou) - 4, dur: 16, at: [DB + 0.35, 1.45, 4.2], z: 1.9, creep: 0.003 }],
    kicks: [[F(tReceive) + 2, 0.4]],
    cast: (f) => [
      stand(GENT, "gent", [DA + 0.2, 0, 4.2], 61, f, [[0, "smile"], [F(tSend), "grin"]], [[0, { l: [-0.4, -0.3] }], [F(tSend) + 6, {}]], { facing: -1 }),
      walker(POSTMAN, "post", 81, f, [[C1, DA - 0.75, 3.6], [F(tYou) - 6, DA - 0.75, 3.6], [F(tReceive) - 4, DB + 0.75, 3.6]], f < F(tReceive) ? "smile" : "grin"),
      ...(f >= F(tYou) ? [stand(WORKER, "wrk", [DB, 0, 4.95], 71, f, [[F(tYou), "neutral"], [F(tReceive) + 2, "nervous"]], [[0, {}]], { facing: 1 }, { alpha: clamp01((f - F(tYou)) / 5), noShadow: true })] : []),
    ],
    over: (g, v, f) => {
      const m = v.ppm([DA, 1.5, 4.0]);
      if (f < F(tSend) + 6) { const u = easeOut(clamp01((f - F(tSend) + 4) / 8)), p = v.w(lerp3([DA + 0.05, 1.05, 4.0], [DA - 0.55, 1.05, 3.6], u)); letter(g, p[0], p[1], m * 0.24, -0.1 + u * 0.2, { side: "back" }); }
      const ga = v.w([DA + 0.2, 2.45, 4.2]); label(g, ga[0], ga[1], "SEND: FREE", f - F(tSend));
      const gb = v.w([DB, 2.45, 4.95]); if (f > F(tReceive)) { g.save(); g.globalAlpha = 1; label(g, gb[0], gb[1], "RECEIVE: PAY!", f - F(tReceive)); g.restore(); }
      if (f >= F(tReceive)) { const hp = v.w([DB + 0.45, 1.08, 3.9]); coin2(g, hp[0], hp[1] - Math.abs(Math.sin((f - F(tReceive)) * 0.25)) * m * 0.05, m * 0.07, "penny", f * 0.2); }
    },
  });
}

// 3 — "Sometimes more than a shilling. For some people, a whole day's wages."  (on the doorstep: the shilling spins up
//     huge; then a whole day's coins trickle out of the worker's hands into the postman's bag)
const C3 = F(tSo) - 4;
{
  const D = DOOR_X(0);
  add({
    a: C2, b: C3, plate: "street_cu", xfade: 6,
    keys: [{ f: C2, at: [D + 0.3, 1.7, 4.4], z: 1.22, creep: 0.0025 }, { f: F(tWhole) - 6, dur: 14, at: [D + 0.15, 1.55, 4.6], z: 1.4, creep: 0.004 }],
    kicks: [[F(tShilling) + 2, 0.5], [F(tWages) + 2, 0.4]],
    cast: (f) => [
      stand(WORKER, "wrk", [D, 0, 4.95], 71, f, [[0, "nervous"], [F(tWhole), "pained"]], [[0, { l: [0.25, -0.3], r: [-0.25, -0.3] }]], { facing: 1 }, { noShadow: true }),
      stand(POSTMAN, "post", [D + 0.75, 0, 3.95], 81, f, [[0, "stern"], [F(tWhole) + 6, "grin"]], [[0, { r: [0.4, -0.25] }]], { facing: 1 }),
    ],
    over: (g, v, f) => {
      const m = v.ppm([D, 1.5, 4.6]);
      // the shilling: spins up from his palm to the frame centre, then drops back
      const S = F(tShilling) - 3, up = easeOutBack(clamp01((f - S) / 9), 1.5) * (1 - smooth((f - F(tSome)) / 8));
      if (f >= S && up > 0.01) { const base = v.w([D + 0.1, 1.05, 4.6]); coin2(g, base[0] + (540 - base[0]) * up, base[1] + (520 - base[1]) * up, m * 0.06 + 150 * up, "shilling", f * 0.18); if (up > 0.6) label(g, 540, 300, "1 SHILLING", f - S - 6); }
      // a day's wages: a little stack in his hands empties coin by coin into the postman's satchel
      const n0 = 8, gone = Math.floor(clamp01((f - F(tWhole) + 2) / 22) * n0), hp = v.w([D + 0.02, 1.0, 4.7]), bag = v.w([D + 0.78, 0.92, 3.9]);
      for (let i = 0; i < n0 - gone; i++) coin2(g, hp[0] + Math.sin(i) * 3, hp[1] - i * m * 0.018, m * 0.05, "penny", 1.35);
      for (let i = 0; i < n0; i++) { const t0 = F(tWhole) - 2 + (i * 22) / n0, u = (f - t0) / 10; if (u > 0 && u < 1) { const x = hp[0] + (bag[0] - hp[0]) * u, y = hp[1] + (bag[1] - hp[1]) * u - Math.sin(Math.PI * u) * m * 0.25; coin2(g, x, y, m * 0.05, "penny", u * 9 + i); } }
      if (f > F(tWages)) { const hd = v.w([D, 1.7, 4.95]); for (let i = 0; i < 2; i++) { const a = ((f - F(tWages)) * 0.05 + i * 0.5) % 1; spr(g, 4, i, hd[0] + (i ? 50 : -60), hd[1] + a * 90, m * 0.05, 0, 1 - a); } }
    },
  });
}

// 4 — "So one day, the poet Samuel Coleridge is walking past a cottage, when a postman hands a woman a letter."
//     (the Lake District: Coleridge strolls along the lane; the camera follows him to the cottage gate, then pushes in
//     on the doorstep where the postman knocks and she opens the door)
const C4 = F(tShe) - 4;
add({
  a: C3, b: C4, plate: "lake_w", xfade: 8,
  keys: [{ f: C3, follow: (f) => { const w = walkAt2(f, [[C3, -6.5, -3.0], [F(tCottage) + 4, -1.6, -3.0]]); return [w.x + 0.4, 1.7, -3.0]; }, at: [0, 0, 0], z: 1.55, creep: 0.001 },
    { f: F(tPostman) - 8, dur: 20, at: [0.25, 1.7, 3.2], z: 2.4, creep: 0.003 }],
  cast: (f) => [
    walker(COLERIDGE, "col", 51, f, [[C3, -6.5, -3.0], [F(tCottage) + 4, -1.6, -3.0]], f > F(tCottage) ? "smile" : "whistle"),
    stand(POSTMAN, "post", POST_P, 81, f, [[0, "smile"], [F(tHands), "grin"]], [[0, { r: [0.1, -1.0] }], [F(tPostman) + 2, { r: [0.1, -0.7] }], [F(tPostman) + 6, { r: [0.1, -1.0] }], [F(tPostman) + 10, { r: [0.1, -0.7] }], [F(tHands) - 4, { r: [0.45, -0.2] }]], { facing: 1 }, { noShadow: true }),
    ...(f >= F(tPostman) + 6 ? [stand(SISTER, "sis", SIS_P, 91, f, [[F(tPostman) + 6, "smile"]], [[0, {}], [F(tHands) + 2, { l: [-0.45, -0.3] }]], { facing: -1 }, { alpha: clamp01((f - F(tPostman) - 6) / 6), noShadow: true })] : []),
  ],
  over: (g, v, f) => {
    const w = walkAt2(f, [[C3, -6.5, -3.0], [F(tCottage) + 4, -1.6, -3.0]]), hd = v.w([w.x, 2.15, -3.0]);
    label(g, hd[0], hd[1] - 30, "SAMUEL TAYLOR COLERIDGE", f - F(tColeridge));
    const m = v.ppm([0.3, 1.4, 3.2]);
    if (f >= F(tHands) - 6) { const u = easeOut(clamp01((f - F(tHands) + 4) / 9)), p = v.w(lerp3(HIS_HAND, HER_HAND, u)); letter(g, p[0], p[1], m * 0.3, -0.05, { side: "front" }); }
    if (f >= F(tPostman) && f < F(tPostman) + 16) { const d = v.w([0.0, 1.6, 3.95]); ringWaves(g, d[0], d[1], m * 0.15, (f - F(tPostman)) % 8, 0.7, 2); }
  },
});

// 5 — "She looks at it. Turns it over. And hands it right back. Coleridge feels sorry for her, so he pays the shilling
//     himself."  (the doorstep: she studies the letter, flips it, pushes it back; Coleridge watches from the lane,
//     sighs, and flicks a shilling into the postman's palm)
const C5 = F(tBut) - 4;
add({
  a: C4, b: C5, plate: "door_cu", xfade: 6,
  keys: [{ f: C4, at: [0.12, 1.3, 3.45], z: 1.6, creep: 0.003 }, { f: F(tHands2) - 4, dur: 14, at: [0.5, 1.45, 2.6], z: 1.15, creep: 0.002 },
    { f: F(tPays) - 6, dur: 14, at: [0.85, 1.4, 1.8], z: 1.2, creep: 0.003 }],
  kicks: [[F(tBack2), 0.4]],
  cast: (f) => [
    stand(SISTER, "sis", SIS_P, 91, f, [[0, "neutral"], [F(tTurns), "stern"], [F(tHands2), "smile"]], [[0, { l: [0.25, -0.35], r: [-0.25, -0.35] }], [F(tHands2), { l: [-0.45, -0.3] }], [F(tBack2) + 6, {}]], { facing: -1 }, { noShadow: true }),
    stand(POSTMAN, "post", POST_P, 81, f, [[0, "smile"], [F(tBack2), "shock"], [F(tPays) + 8, "grin"]], [[0, { r: [0.2, 0.1] }], [F(tHands2), { r: [0.45, -0.2] }], [F(tPays), { r: [-0.1, -0.35] }]], { facing: 1 }, { noShadow: true }),
    stand(COLERIDGE, "col", COL_P, 51, f, [[0, "smile"], [F(tBack2), "shock"], [F(tSorry), "nervous"], [F(tPays), "smile_closed"]], [[0, {}], [F(tPays) - 4, { r: [0.5, -0.45] }], [F(tShilling2) + 8, {}]], { facing: -1 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    const m = v.ppm([0.3, 1.4, 3.2]);
    // the letter: studied, turned over, handed back
    const back = easeOut(clamp01((f - F(tHands2)) / 8)), p = v.w(lerp3(HER_HAND, HIS_HAND, back)), flip = clamp01((f - F(tTurns)) / 10);
    const look = f < F(tTurns) ? Math.sin(f * 0.15) * 0.06 : 0;
    letter(g, p[0], p[1] - (1 - back) * m * 0.05, m * 0.3, look - 0.05, { side: "front", flip, address: 1 });
    // the shilling: flicked from Coleridge's hand in an arc to the postman's palm
    const S = F(tPays) - 2, u = clamp01((f - S) / 12);
    if (u > 0 && u < 1) { const a = v.w([1.05, 1.1, 0.5]), b = v.w([0.45, 1.1, 2.9]), x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - Math.sin(Math.PI * u) * m * 0.45; coin2(g, x, y, m * 0.06, "shilling", u * 14); }
    if (f >= S + 12) { const b = v.w([0.45, 1.1, 2.9]); coin2(g, b[0], b[1], m * 0.06, "shilling", 0.2); sparkle(g, b[0] + 20, b[1] - 30, m * 0.06, f - S - 12); }
    const ch = v.w([1.25, 1.8, 0.15]); emark(g, ch[0] - m * 0.1, ch[1] - m * 0.25, m * 0.2, f - F(tBack2) - 1, -0.1);
  },
});

// 6 — "But the second the postman leaves, she opens it... and it's blank."  (the postman marches off down the path;
//     she breaks the seal, unfolds it... the blank sheet fills the frame; Coleridge's jaw drops)
const C6 = F(tHer) - 4;
add({
  a: C5, b: C6, plate: "door_cu", xfade: 4,
  keys: [{ f: C5, at: [0.45, 1.4, 2.6], z: 1.12, creep: 0.002 }, { f: F(tOpens) - 4, dur: 14, at: [0.0, 1.3, 3.5], z: 1.5, creep: 0.004, punch: 0.008, pn: 14 }],
  kicks: [[F(tBlank) + 1, 0.9]],
  cast: (f) => [
    stand(SISTER, "sis", SIS_P, 91, f, [[0, "smile"], [F(tOpens), "smile_closed"], [F(tBlank), "grin"]], [[0, {}], [F(tOpens) - 4, { l: [0.3, -0.45], r: [-0.3, -0.45] }]], { facing: 0 }, { noShadow: true }),
    walker(POSTMAN, "post", 81, f, [[C5, 0.62, 2.8], [F(tLeaves) - 4, 0.62, 2.8], [F(tLeaves) + 20, 3.2, 1.0]], "whistle"),
    stand(COLERIDGE, "col", COL_P, 51, f, [[0, "smile"], [F(tBlank), "shock"]], [[0, {}], [F(tBlank), { l: [0.2, -0.9], r: [-0.2, -0.9] }]], { facing: -1 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    const m = v.ppm([0, 1.4, 3.5]), hp = v.w([-0.08, 1.02, 3.45]);
    const O0 = F(tOpens) - 2, open = clamp01((f - O0) / 14);
    if (f < O0) letter(g, hp[0], hp[1], m * 0.3, 0, { side: "back" });
    else if (f < F(tBlank) - 2) { sheet(g, hp[0], hp[1] - m * 0.1 * open, m * 0.32, open, 0.02, true); if (f < O0 + 6) puffs(g, hp[0], hp[1], m * 0.15, f - O0, 4, false, 7); }
    else { const k = easeOutBack(clamp01((f - F(tBlank) + 2) / 10), 1.4), x = hp[0] + (540 - hp[0]) * k, y = hp[1] + (470 - hp[1]) * k; sheet(g, x, y, m * 0.32 + (420 - m * 0.32) * k, 1, 0.02 - k * 0.04, true, k); }
    const ch = v.w([1.25, 1.85, 0.15]); qmark(g, ch[0] - m * 0.05, ch[1] - m * 0.15, m * 0.2, f - F(tBlank) - 2, -0.15);
  },
});

// 7 — "Her brother sends her an empty sheet every three months."  (London: the brother folds a blank sheet, seals it,
//     waves it off; a calendar flips JAN -> APR -> JUL -> OCT)
const C7 = F(tIf) - 4;
{
  const D = DOOR_X(0);
  add({
    a: C6, b: C7, plate: "street_cu", xfade: 8,
    keys: [{ f: C6, at: [D + 0.2, 1.45, 4.6], z: 1.4, creep: 0.003 }],
    kicks: [[F(tEmpty) + 6, 0.35]],
    cast: (f) => [stand(BROTHER, "bro", [D, 0, 4.95], 41, f, [[0, "grin"], [F(tEvery), "smile_closed"]], [[0, { l: [0.3, -0.35], r: [-0.3, -0.35] }], [F(tThree), { r: [0.15, -1.05] }]], { facing: 0 }, { noShadow: true })],
    over: (g, v, f) => {
      const m = v.ppm([D, 1.5, 4.9]), hp = v.w([D, 1.0, 4.75]), hd = v.w([D, 1.75, 4.95]);
      label(g, hd[0], hd[1] - 40, "HER BROTHER", f - F(tBrother));
      const fold = 1 - clamp01((f - F(tEmpty)) / 8);
      if (fold > 0) sheet(g, hp[0], hp[1], m * 0.28, fold, 0.03, true);
      else { letter(g, hp[0], hp[1], m * 0.3, 0.03, { side: "back" }); if (f < F(tEmpty) + 14) { const s = v.w([D, 1.02, 4.75]); ringWaves(g, s[0], s[1], m * 0.05, f - F(tEmpty) - 8, 0.8, 2, "255,200,200"); } }
      const months = ["JAN", "APR", "JUL", "OCT"], T0 = F(tEvery), step = 7, i = Math.min(3, Math.max(0, Math.floor((f - T0) / step))), u = clamp01(((f - T0) % step) / 5);
      calendar(g, hd[0] - 330, hd[1] + 40, 190, months[i], i > 0 && f - T0 < 4 * step ? months[i - 1] : null, f < T0 ? 1 : u, easeOutBack(clamp01((f - T0 + 6) / 8), 1.8));
    },
  });
}

// 8 — "If it arrives, he's fine. Message received. For free."  (golden light at the cottage: she hugs the blank sheet,
//     a thought bubble shows her brother waving; RECEIVED stamps onto the sheet; a coin with a red cross: free)
const C8 = F(tAnd2) - 4;
add({
  a: C7, b: C8, plate: "door_g", xfade: 6,
  keys: [{ f: C7, at: [-0.08, 1.45, 3.7], z: 1.45, creep: 0.003 }],
  kicks: [[F(tMessage) + 3, 0.5]],
  cast: (f) => [stand(SISTER, "sis", SIS_P, 91, f, [[0, "relief"], [F(tFine), "smile_closed"], [F(tFree), "laugh"]], [[0, { l: [0.3, -0.45], r: [-0.3, -0.45] }]], { facing: 0, headTilt: Math.sin(f * 0.12) * 5 }, { noShadow: true })],
  over: (g, v, f) => {
    const m = v.ppm([-0.08, 1.5, 3.7]), hp = v.w([-0.08, 1.0, 3.5]), hd = v.w([-0.08, 1.6, 3.72]);
    sheet(g, hp[0], hp[1], m * 0.3, 1, -0.04, true, 0.4);
    const k = easeOutBack(clamp01((f - F(tArrives) + 4) / 9), 1.6) * (1 - smooth((f - F(tMessage) + 2) / 6));
    thought(g, hd[0] + 230, hd[1] - 260, 330, 250, hd[0] + 60, hd[1] - 60, k, () => {
      g.save(); g.translate(hd[0] + 230, hd[1] - 240); g.scale(0.42, 0.42); g.translate(-300, -430); bodyFrontMini(g, f); g.restore();
    });
    if (f >= F(tMessage)) { g.save(); stampMark(g, hp[0], hp[1] - m * 0.05, m * 0.32, "RECEIVED", f - F(tMessage), -0.15); g.restore(); }
    if (f >= F(tFree) - 2) { const kk = easeOutBack(clamp01((f - F(tFree) + 2) / 8), 2), x = hp[0] + 250, y = hp[1] - 120; g.save(); g.translate(x, y); g.scale(kk, kk); coin2(g, 0, 0, 70, "penny", 0.3); g.strokeStyle = "#d42f2f"; g.lineWidth = 18; g.lineCap = "round"; g.beginPath(); g.moveTo(-80, -80); g.lineTo(80, 80); g.moveTo(80, -80); g.lineTo(-80, 80); g.stroke(); g.restore(); label(g, x, y + 130, "£0", f - F(tFree) - 2); }
  },
});
/** the brother waving, drawn tiny inside the thought bubble (design units) */
const bodyFrontMini = (g: CanvasRenderingContext2D, f: number) => {
  bodyFront(new Pen(g), BROTHER, { mode: "stand", expr: "grin", facing: 0, seed: 41, blink: lidAt(f, 41), hands: { r: [0.35, -1.05 + Math.sin(f * 0.5) * 0.18] } });
};

// 9 — "And she wasn't the only one. People drew secret marks on the outside, read them at the door, and said 'no thanks.'"
//     (the London terrace: the postman goes door to door; at each door a letter pops up, its secret mark draws on, the
//     resident reads it, smirks, shakes their head... the last one says it: NO THANKS)
const C9 = F(tSo2) - 4;
{
  const DA = DOOR_X(1), DB = DOOR_X(0), DC = DOOR_X(-1);
  const PATH: [number, number, number][] = [[C8, DA + 2.4, 3.6], [F(tPeople) - 2, DA + 0.8, 3.6], [F(tMarks) + 4, DA + 0.8, 3.6], [F(tRead2) - 2, DB + 0.8, 3.6], [F(tDoor) + 4, DB + 0.8, 3.6], [F(tSaid) - 2, DC + 0.8, 3.6], [C9, DC + 0.8, 3.6]];
  const DOORS: [number, Outfit, number, number, number][] = [[DA, LADY2, 33, F(tPeople) - 4, F(tMarks) + 8], [DB, WORKER, 71, F(tRead2) - 6, F(tDoor) + 8], [DC, MAN3, 72, F(tSaid) - 8, C9 + 10]];
  add({
    a: C8, b: C9, plate: "street_w", xfade: 6,
    keys: [{ f: C8, follow: (f) => { const w = walkAt2(f, PATH); return [w.x - 0.4, 1.5, 4.2]; }, at: [0, 0, 0], z: 1.95, creep: 0.001 }],
    kicks: [[F(tMarks) + 9, 0.35], [F(tDoor) + 9, 0.35], [F(tNo) + 2, 0.6]],
    cast: (f) => [
      walker(POSTMAN, "post", 81, f, PATH, f < F(tRead2) ? "smile" : f < F(tNo) ? "nervous" : "dazed"),
      ...DOORS.filter(([, , , a0, a1]) => f >= a0 && f < a1).map(([x, o, seed, a0, a1], i) => stand(o, "res" + seed, [x, 0, 4.95], seed, f,
        [[a0, "neutral"], [a0 + 10, "smile"]], [[0, {}]], { facing: 1, headTilt: f > a0 + 14 ? Math.sin((f - a0) * 0.7) * 9 : 0, talk: seed === 72 ? talkAt(f, [[F(tNo) - 2, F(tNo) + 18]], 3) : 0 },
        { alpha: Math.min(clamp01((f - a0) / 5), clamp01((a1 - f) / 5)), noShadow: true })),
    ],
    over: (g, v, f) => {
      DOORS.forEach(([x, , seed, a0, a1], i) => {
        if (f < a0 + 4 || f >= a1 - 2) return;
        const m = v.ppm([x, 1.6, 4.6]), p = v.w([x + 0.5, 2.25, 4.6]), k = easeOutBack(clamp01((f - a0 - 4) / 7), 1.8) * (1 - smooth((f - a1 + 8) / 6));
        g.save(); g.translate(p[0], p[1]); g.scale(k, k); letter(g, 0, 0, m * 0.62, -0.06 + i * 0.05, { side: "front", marks: clamp01((f - a0 - 8) / 8), markKind: i, address: 0.7 }); g.restore();
        if (f > a1 - 7) { const d = v.w([x, 0.75, 4.95]); puffs(g, d[0], d[1], m * 0.3, f - (a1 - 7), 5, true, seed); }
      });
      const c = v.w([DC, 1.8, 4.95]); bubble(g, c[0] - 150, c[1] - 200, "NO THANKS!", f - F(tNo), [c[0] - 40, c[1] - 40], 70);
      // the refused letters pile up in the postman's arms
      const w = walkAt2(f, PATH), hp = v.w([w.x - 0.25, 1.0, 3.6]), n = (f > F(tMarks) + 8 ? 1 : 0) + (f > F(tDoor) + 8 ? 1 : 0) + (f > F(tNo) + 6 ? 1 : 0), m2 = v.ppm([w.x, 1.4, 3.6]);
      for (let i = 0; i < n; i++) letter(g, hp[0] + Math.sin(i * 2) * 4, hp[1] - i * m2 * 0.06, m2 * 0.22, Math.sin(i * 1.7) * 0.15, { side: "back", shadow: false });
    },
  });
}

// 10 — "So the Post Office was dragging letters across the entire country..."  (the Royal Mail coach thunders along
//      the lake road behind two galloping horses, sacks bouncing, letters fluttering off the roof)
const C10 = F(tGetting) - 4;
{
  const X0 = 14, SPD = 7.5; // world x decreases = screen right
  const cx = (f: number) => X0 - (SPD / FPS) * Math.max(0, f - C9);
  add({
    a: C9, b: C10, plate: "lake_w", xfade: 6,
    keys: [{ f: C9, follow: (f) => [cx(f) - 1.4, 1.5, -3.0], at: [0, 0, 0], z: 1.0, creep: 0.001 }],
    cast: (f) => [{ o: POSTMAN, okey: "coach", P: [cx(f), 0, -3.0], seed: 1, opts: {}, noShadow: true, draw: (g, v) => {
      const x = cx(f), m = v.ppm([x, 0, -3.0]), dist = X0 - x;
      for (const [dz, ph] of [[-0.35, 0.0], [0.35, 0.5]] as [number, number][]) { const o = v.w([x - 3.0, 0, -3.0 + dz]); horse(g, o, m, 1, dist * 0.55 + ph, 0, f); }
      const o = v.w([x, 0, -3.0]); mailCoach(g, o, m, 1, dist, f);
      for (let i = 0; i < 3; i++) { const age = (f * 1.1 + i * 9) % 26; puff(g, o[0] - m * (1.1 + i * 0.4), o[1] - m * 0.1, m * 0.45, age, 26, "#e9dcc0", [-0.6, -0.4]); }
      for (let i = 0; i < 4; i++) { const u = ((f - C9) * 0.035 + i * 0.25) % 1, lx = o[0] - m * (0.2 + u * 3.2), ly = o[1] - m * (2.6 + Math.sin(u * 6 + i) * 0.4 + u * 0.8); letter(g, lx, ly, m * 0.32, u * 8 + i, { side: i % 2 ? "front" : "back", shadow: false, flip: (u * 3) % 1 }); }
    } }],
    over: (g, v, f) => { const x = cx(f), hd = v.w([x + 0.6, 2.9, -3.0]); bubble(g, Math.max(260, Math.min(820, hd[0] + 60)), 330, "TOOT TOOT!", f - F(tDragging) - 2, [hd[0], hd[1] - 20], 56); },
  });
}

// 11 — "...and getting paid nothing."  (the Post Office counter: the clerk opens the cash box - empty - a moth flutters out)
const C11 = F(tUntil) - 4;
add({
  a: C10, b: C11, plate: "po_w", xfade: 4,
  keys: [{ f: C10, at: [395.6, 1.35, -0.2], z: 2.3, creep: 0.004 }],
  cast: (f) => [stand(CLERK, "clerk", [395.6, 0, 0.75], 31, f, [[0, "neutral"], [C10 + 8, "dazed"]], [[0, { l: [0.35, -0.2], r: [-0.35, -0.2] }]], { facing: 0 }, { clip: above(390, 401, 1.17, -0.6), noShadow: true })],
  over: (g, v, f) => {
    const m = v.ppm([395.6, 1.2, -0.3]) * 1.7, p = v.w([395.6, 1.22, -0.3]), lid = easeOutBack(clamp01((f - C10 - 2) / 6), 1.6);
    g.save(); g.translate(p[0], p[1]); g.fillStyle = "#6b4a2e"; g.strokeStyle = INK; g.lineWidth = 5;
    g.fillRect(-m * 0.2, -m * 0.12, m * 0.4, m * 0.12); g.strokeRect(-m * 0.2, -m * 0.12, m * 0.4, m * 0.12);
    g.fillStyle = "#2b2025"; g.fillRect(-m * 0.18, -m * 0.12, m * 0.36, m * 0.03);
    g.save(); g.translate(0, -m * 0.12); g.scale(1, Math.cos(lid * 1.9)); g.fillStyle = "#7a5a3a"; g.fillRect(-m * 0.2, -m * 0.12, m * 0.4, m * 0.12); g.strokeRect(-m * 0.2, -m * 0.12, m * 0.4, m * 0.12); g.restore(); g.restore();
    const age = f - C10 - 6; if (age > 0) moth(g, p[0] + Math.sin(age * 0.3) * 50 + age * 4, p[1] - m * 0.08 - age * 10, m * 0.1, age);
    label(g, 540, 560, "£0", f - C10 - 6);
  },
});

// 12 — "Until a schoolteacher named Rowland Hill had an idea."  (his study: he ponders, chin in hand... the lamp flares,
//      he springs up grinning)
const C12 = F(tWhat) - 4;
const HILL_P: V3 = [460, 0, 3.0];
add({
  a: C11, b: C12, plate: "study", xfade: 8,
  keys: [{ f: C11, at: [460, 1.75, 2.8], z: 1.25, creep: 0.003 }, { f: F(tIdea) - 4, dur: 8, at: [460, 1.85, 2.8], z: 1.45, creep: 0.003, punch: 0.01, pn: 10 }],
  kicks: [[F(tIdea), 0.7]],
  cast: (f) => [stand(HILL, "hill", HILL_P, 21, f, [[0, "neutral"], [F(tIdea) - 1, "grin"]], [[0, { r: [-0.15, -0.75] }], [F(tIdea) - 1, { l: [-0.2, -1.1], r: [0.2, -1.1] }]], { facing: 0, headTilt: f < F(tIdea) ? -6 + Math.sin(f * 0.1) * 3 : 0 }, { clip: above(455, 465, 0.82, 1.85), noShadow: true })],
  over: (g, v, f) => {
    const m = v.ppm([460, 1.5, 3.0]), hd = v.w([460, 1.75, 3.0]);
    label(g, hd[0], hd[1] - 50, "ROWLAND HILL", f - F(tHill));
    if (f < F(tIdea) - 2) for (let i = 0; i < 3; i++) { const a = ((f * 0.03 + i / 3) % 1); g.save(); g.globalAlpha = Math.sin(Math.PI * a) * 0.8; g.fillStyle = "#fbf8f1"; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(hd[0] + m * (0.25 + a * 0.2), hd[1] - m * (0.25 + a * 0.35), 8 + a * 14, 0, 7); g.fill(); g.stroke(); g.restore(); }
    if (f >= F(tIdea) - 1) { const lp = v.w([459.0, 1.32, 2.5]); g.save(); g.globalCompositeOperation = "screen"; const k = Math.max(0, 1 - (f - F(tIdea)) / 30), gr = g.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], 600); gr.addColorStop(0, `rgba(255,220,140,${0.8 * k})`); gr.addColorStop(1, "rgba(255,200,100,0)"); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920); g.restore(); }
    emark(g, hd[0] + m * 0.3, hd[1] - m * 0.3, m * 0.24, f - F(tIdea), 0.15);
    sparkle(g, hd[0] - m * 0.3, hd[1] - m * 0.25, m * 0.09, f - F(tIdea) - 2);
  },
});

// 13 — "What if the sender paid instead? One penny, anywhere in Britain. And to prove it, you stick a tiny picture of the
//      Queen in the corner."  (Hill explains, mouth going: a coin slides onto a letter - PAID BY SENDER; a big penny
//      spins up; letters zip off through the window; he licks the Penny Black and slaps it on the corner)
const C13 = F(tIn1840) - 4;
add({
  a: C12, b: C13, plate: "study", xfade: 4,
  keys: [{ f: C12, at: [460, 1.55, 2.5], z: 1.3, creep: 0.003 }, { f: F(tAnywhere) - 4, dur: 12, at: [460, 2.0, 3.6], z: 1.25, creep: 0.002 }, { f: F(tProve) - 4, dur: 12, at: [460, 1.25, 2.3], z: 1.55, creep: 0.004 }],
  kicks: [[F(tCorner) + 1, 0.8], [F(tPenny) + 1, 0.35]],
  cast: (f) => [stand(HILL, "hill", HILL_P, 21, f, [[0, "grin"], [F(tStick) - 2, "lick"], [F(tQueen), "grin"], [F(tCorner) + 1, "laugh"]],
    [[0, { r: [0.3, -0.6] }], [F(tSender), { l: [0.3, -0.3], r: [-0.3, -0.3] }], [F(tAnywhere), { l: [-0.5, -0.9] }], [F(tProve), { l: [0.3, -0.25], r: [-0.3, -0.25] }]],
    { facing: 0, talk: talkAt(f, [[C12, F(tPenny) + 6], [F(tAnywhere), F(tBritain) + 8]], 5) }, { clip: above(455, 465, 0.82, 1.85), noShadow: true })],
  over: (g, v, f) => {
    const m = v.ppm([460, 1.0, 2.3]), lp = v.w([460.05, 0.86, 2.3]);
    // the letter on the desk
    letter(g, lp[0], lp[1], m * 0.36, 0.04, { side: "front", stampK: f >= F(tCorner) ? easeOutBack(clamp01((f - F(tCorner)) / 5), 2.4) : 0 });
    // the sender's coin slides onto the letter: PAID BY SENDER
    if (f >= F(tSender) - 2 && f < F(tOne)) { const u = easeOut(clamp01((f - F(tSender) + 2) / 8)), x = lp[0] - 260 + 200 * u; coin2(g, x, lp[1] - 10, m * 0.05, "penny", 0.3); label(g, lp[0], lp[1] - 190, "SENDER PAYS", f - F(tInstead)); }
    // one penny: spins up huge
    const P = F(tPenny) - 3, up = easeOutBack(clamp01((f - P) / 9), 1.5) * (1 - smooth((f - F(tAnywhere)) / 8));
    if (f >= P && up > 0.01) { coin2(g, 540 + (lp[0] - 540) * (1 - up), 380 + (lp[1] - 380) * (1 - up), 40 + 130 * up, "penny", f * 0.2); if (up > 0.6) label(g, 540, 600, "ONE PENNY", f - P - 5); }
    // anywhere in Britain: letters zip off through the window
    for (let i = 0; i < 6; i++) { const u = (f - F(tAnywhere) - i * 4) / 14; if (u > 0 && u < 1) { const a = v.w([460 + (i - 2.5) * 0.25, 1.0, 2.4]), b = v.w([460 + (i - 2.5) * 0.18, 2.6, 4.18]); letter(g, a[0] + (b[0] - a[0]) * easeOut(u), a[1] + (b[1] - a[1]) * easeOut(u) - Math.sin(Math.PI * u) * 120, m * 0.22 * (1 - 0.7 * u), u * 4 + i, { side: i % 2 ? "front" : "back", shadow: false }); } }
    if (f >= F(tAnywhere) && f < F(tProve) - 3) label(g, 540, 430, "ANYWHERE", f - F(tAnywhere) - 2);
    // the Penny Black: appears, gets licked, flies to the corner
    const S0 = F(tProve) - 2;
    if (f >= S0 && f < F(tCorner) + 1) {
      const k = easeOutBack(clamp01((f - S0) / 8), 1.8), hd = v.w([460, 1.38, 3.0]), corner: P2 = [lp[0] + m * 0.13, lp[1] - m * 0.07];
      const lick = easeOut(clamp01((f - F(tStick) + 2) / 6)), fly = easeOut(clamp01((f - F(tQueen)) / Math.max(1, F(tCorner) - F(tQueen) + 1)));
      const ax = 540 + (hd[0] + 20 - 540) * lick, ay = 420 + (hd[1] + 30 - 420) * lick;
      const x = ax + (corner[0] - ax) * fly, y = ay + (corner[1] - ay) * fly - Math.sin(Math.PI * fly) * 120, w = (220 - 70 * lick) * (1 - fly) + m * 0.055 * fly;
      pennyBlack(g, x, y, w * k, -0.05 + fly * 0.09, (1 - fly) * 0.6);
    }
    
    if (f >= F(tCorner) + 1) { ringWaves(g, lp[0] + m * 0.13, lp[1] - m * 0.07, m * 0.05, f - F(tCorner) - 1, 0.9, 3); sparkle(g, lp[0] + m * 0.13, lp[1] - m * 0.12, m * 0.06, f - F(tCorner) - 2); }
  },
});

// 14 — "In 1840, the Penny Black was born. The world's first stamp."  (the sorting hall: 1840 slams in; the Penny Black
//      rises huge and glowing over a cheering crowd; confetti)
const C14 = F(tAnd3) - 4;
add({
  a: C13, b: C14, plate: "po_w", xfade: 6,
  keys: [{ f: C13, at: [400, 2.4, 3.0], z: 1.15, creep: 0.0025 }],
  kicks: [[F(t1840) + 1, 0.8], [F(tFirst), 0.4]],
  cast: (f) => [0, 1, 2, 3, 4].map((i) => stand(CROWD[i], "crowd" + i, [397.4 + i * 1.3, 0, 1.0 + (i % 2) * 0.6], 101 + i, f, [[0, "smile"], [F(tBorn) + i, "grin"], [F(tFirst) + i * 2, "laugh"]], [[0, {}], [F(tBorn) + i, { l: [-0.3, -1.1], r: [0.3, -1.1] }]], { facing: (i < 2 ? 1 : i > 2 ? -1 : 0) as -1 | 0 | 1 }, { hop: f > F(tBorn) ? Math.abs(Math.sin((f + i * 5) * 0.35)) * 0.15 : 0 })),
  over: (g, v, f) => {
    bigNum(g, 540, 360, "1840", f - F(t1840));
    const k = easeOutBack(clamp01((f - F(tPennyB) + 4) / 12), 1.5);
    if (k > 0) { pennyBlack(g, 540, 820 + (1 - k) * 400, 380 * k, Math.sin(f * 0.05) * 0.04, 0.8); }
    if (f >= F(tFirst)) label(g, 540, 330, "WORLD'S FIRST STAMP", f - F(tFirst));
    confetti(g, 540, 820, 600, f - F(tFirst));
    sparkle(g, 330, 650, 40, (f - F(tBorn)) % 24); sparkle(g, 760, 980, 34, (f - F(tBorn) - 9) % 24);
  },
});

// 15 — "And that year, the number of letters sent in Britain more than doubled."  (the sorting table: letters rain
//      down and pile up; a counter rolls 76 MILLION -> 168 MILLION; x2 stamps on)
const C15 = F(tSo3) - 4;
add({
  a: C14, b: C15, plate: "po_cu", xfade: 6,
  keys: [{ f: C14, at: [400, 1.05, 2.3], z: 1.15, creep: 0.003 }, { f: F(tDoubled) - 4, dur: 10, at: [400, 1.1, 2.3], z: 1.35, creep: 0.004 }],
  kicks: [[F(tDoubled) + 2, 0.7]],
  over: (g, v, f) => {
    const m = v.ppm([400, 1.0, 2.3]);
    for (let i = 0; i < 26; i++) { const t0 = C14 + (i * 3) % 60 + Math.floor(i / 20) * 7, u = (f - t0) / 16; if (u < 0) continue; const tx = 160 + ((i * 197) % 760), ty = 1250 + ((i * 53) % 260);
      if (u < 1) letter(g, tx + Math.sin(u * 5 + i) * 40, -100 + (ty + 100) * u * u, 120, u * 6 + i, { side: i % 2 ? "front" : "back", shadow: false }); else letter(g, tx, ty - Math.floor(i / 9) * 18, 120, (i % 5 - 2) * 0.12, { side: i % 2 ? "front" : "back" }); }
    const n = 76 + Math.round((168 - 76) * easeOut(clamp01((f - F(tNumber)) / (F(tDoubled) - F(tNumber) + 4))));
    if (f >= F(tYear) - 4) { g.save(); const k = easeOutBack(clamp01((f - F(tYear) + 4) / 7), 1.8); g.translate(540, 420); g.scale(k, k); g.font = "900 150px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 26; g.strokeStyle = INK; g.strokeText(String(n), 0, 0); g.fillStyle = n >= 168 ? "#ffd24a" : "#f8f6f1"; g.fillText(String(n), 0, 0);
      g.font = "900 64px 'Montserrat'"; g.lineWidth = 14; g.strokeText("MILLION LETTERS", 0, 120); g.fillStyle = "#f8f6f1"; g.fillText("MILLION LETTERS", 0, 120); g.restore(); }
    if (f >= F(tDoubled)) stampW(g, "x2", f, F(tDoubled), C15 + 20, 820, 640, 300, -0.15);
    void m;
  },
});

// 16 — "So every stamp you've ever licked..."  (today: a hand presses a stamp onto an envelope on the desk)
const C16 = F(tBasically) - 4;
add({
  a: C15, b: C16, plate: "today", xfade: 8,
  keys: [{ f: C15, at: [520, 0.82, 2.5], z: 1.2, creep: 0.004 }],
  kicks: [[F(tLicked) + 2, 0.5]],
  under: (g) => warmGrade(g),
  over: (g, v, f) => {
    const c = v.w([520, 0.81, 2.5]), m = v.ppm([520, 0.8, 2.5]);
    g.save(); g.translate(c[0], c[1]); g.scale(1, 0.75); letter(g, 0, 0, m * 0.6, -0.03, { side: "front", stampK: f >= F(tLicked) ? 1 : 0 }); g.restore();
    const u = easeOut(clamp01((f - F(tStamp2) + 2) / (F(tLicked) - F(tStamp2) + 2))), sx = c[0] + 330 - (330 - m * 0.22) * u, sy = c[1] - 420 + (420 - m * 0.14) * u;
    if (f < F(tLicked)) { pennyBlack(g, sx, sy, 150 - (150 - m * 0.09) * u, 0.2 * (1 - u)); hand(g, sx + 40, sy + 60, 80, -1.2, 0.8); }
    else { hand(g, c[0] + m * 0.25, c[1] - m * 0.06 - Math.max(0, 8 - (f - F(tLicked))) * 6, 80, -1.2, 0.2); ringWaves(g, c[0] + m * 0.22, c[1] - m * 0.1, m * 0.06, f - F(tLicked), 0.8, 3); }
  },
});

// 17 — "...is basically there because people kept saying no to the postman."  (golden light, the cottage door one last
//      time: she smiles and hands the letter straight back; the postman's shoulders sag; NO THANKS!)
add({
  a: C16, b: TOTAL, plate: "door_g", xfade: 6,
  keys: [{ f: C16, at: [0.3, 1.45, 3.2], z: 1.15, creep: 0.0025 }, { f: F(tNo2) - 4, dur: 12, at: [0.3, 1.45, 3.2], z: 1.3, creep: 0.003 }],
  kicks: [[F(tNo2) + 2, 0.5]],
  cast: (f) => [
    stand(SISTER, "sis", SIS_P, 91, f, [[0, "smile"], [F(tNo2) - 2, "smile_closed"]], [[0, { l: [-0.45, -0.3] }], [F(tKept), {}]], { facing: -1, talk: talkAt(f, [[F(tNo2) - 2, F(tNo2) + 14]], 2) }, { noShadow: true }),
    stand(POSTMAN, "post", POST_P, 81, f, [[0, "neutral"], [F(tNo2) + 2, "dazed"]], [[0, { r: [0.45, -0.2] }], [F(tNo2) + 4, {}]], { facing: 1, headTilt: f > F(tNo2) + 2 ? -10 : 0 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    const m = v.ppm([0.3, 1.4, 3.2]), u = easeOut(clamp01((f - C16 - 2) / 9)), p = v.w(lerp3(HER_HAND, HIS_HAND, u)), drop = clamp01((f - F(tNo2) - 4) / 10);
    letter(g, p[0], p[1] + drop * drop * m * 1.2, m * 0.3, -0.1 + drop * 1.2, { side: "front" });
    const sh = v.w([-0.08, 1.65, 3.72]); bubble(g, sh[0] - 120, sh[1] - 220, "NO THANKS!", f - F(tNo2), [sh[0] - 20, sh[1] - 60], 70);
    const ph = v.w([0.62, 1.95, 2.8]); qmark(g, ph[0] + m * 0.2, ph[1] - m * 0.05, m * 0.2, f - F(tNo2) - 4, 0.15);
  },
});

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
