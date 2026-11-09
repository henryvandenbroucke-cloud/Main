// Timeline of "The Robbers Who Never Broke a Lock" (the Brink's job, Boston 1950), timed to the voice's words.json (every event hangs off a word).
// Brick-tax staging: toy-bright 3D sets, living faces (blinks, talking mouths, brow pops + a hop on every reaction),
// vector letters / coins / the Penny Black, something moving on every beat.
import { Outfit, FrontOpts, INK, Expr, townsfolk, P2, bodyFront, Pen } from "./toon";
import { V3 } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import { stampMark, puff, ringWaves, qmark, emark, hand, card, calendar, thought, moth, sparkle, padlock, lawBook, gavel, screwdriver, moneyBag, bill, coin2, pcard, rwheel, tallyBook, magnifier } from "./props2d";
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


// ---------------- grades + helpers ----------------
/** night over a day-lit plate: deep blue multiply, warm pools at the lamps / windows, vignette */
const nightGrade = (g: CanvasRenderingContext2D, v: View, pools: V3[], f: number, k = 1, warm = "255,190,110") => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = `rgba(62,76,140,${0.7 * k})`; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen";
  for (const [i, P] of pools.entries()) { const c = v.w(P), r = v.ppm(P) * 2.4 * (1 + 0.03 * Math.sin(f * 0.4 + i * 2)); const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); gr.addColorStop(0, `rgba(${warm},${0.55 * k})`); gr.addColorStop(0.5, `rgba(${warm},${0.16 * k})`); gr.addColorStop(1, `rgba(${warm},0)`); g.fillStyle = gr; g.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); }
  g.globalCompositeOperation = "source-over"; const vg = g.createRadialGradient(540, 900, 420, 540, 960, 1250); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(8,10,30,${0.6 * k})`); g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
  g.restore();
};
/** soft god-ray beam from the top (output px) */
const beam = (g: CanvasRenderingContext2D, x: number, k: number, col = "255,236,190") => { if (k <= 0) return; g.save(); g.globalCompositeOperation = "screen"; const gr = g.createLinearGradient(x, 0, x, 1920); gr.addColorStop(0, `rgba(${col},${0.3 * k})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 90, 0); g.lineTo(x + 90, 0); g.lineTo(x + 380, 1920); g.lineTo(x - 260, 1920); g.closePath(); g.fill(); g.restore(); };
/** a door (world rect x0..x1, y0..y1 at depth z) swinging open on its +x hinge: dark gap + warm light + the turning leaf */
const doorSwing = (g: CanvasRenderingContext2D, v: View, x0: number, x1: number, h: number, z: number, u: number, col: string, light = "255,200,120") => {
  if (u <= 0) return;
  const A0 = v.w([x0, 0, z]), A1 = v.w([x1, 0, z]), B0 = v.w([x0, h, z]), B1 = v.w([x1, h, z]);
  g.save(); g.beginPath(); g.moveTo(A0[0], A0[1]); g.lineTo(A1[0], A1[1]); g.lineTo(B1[0], B1[1]); g.lineTo(B0[0], B0[1]); g.closePath(); g.fillStyle = "#1a1620"; g.fill();
  const gr = g.createLinearGradient(0, B0[1], 0, A0[1]); gr.addColorStop(0, `rgba(${light},${0.25 * u})`); gr.addColorStop(1, `rgba(${light},${0.6 * u})`); g.fillStyle = gr; g.fill();
  const e = easeOut(u), cw = Math.cos(e * 1.25), hx = A1[0], wpx = (A0[0] - A1[0]) * cw, lift = (B1[1] - A1[1]) * 0.06 * Math.sin(e * 1.25);
  g.beginPath(); g.moveTo(hx, A1[1]); g.lineTo(hx + wpx, A1[1] + lift); g.lineTo(hx + wpx, B1[1] - lift); g.lineTo(hx, B1[1]); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.restore();
};
/** a wall clock face (output px) with hands at minutes past 7 */
const clockFace = (g: CanvasRenderingContext2D, x: number, y: number, r: number, mins: number) => {
  g.save(); g.translate(x, y); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = "#f6f1e3"; g.fill(); g.lineWidth = r * 0.1; g.strokeStyle = INK; g.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); g.lineWidth = r * 0.06; g.stroke(); }
  const ha = ((7 + mins / 60) / 12) * Math.PI * 2 - Math.PI / 2, ma = (mins / 60) * Math.PI * 2 - Math.PI / 2;
  g.lineCap = "round"; g.lineWidth = r * 0.1; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ha) * r * 0.5, Math.sin(ha) * r * 0.5); g.stroke();
  g.lineWidth = r * 0.06; g.strokeStyle = "#c0353a"; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ma) * r * 0.78, Math.sin(ma) * r * 0.78); g.stroke();
  g.restore();
};
/** a big rolling counter (output px) */
const counter = (g: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, col = "#9fe08a", size = 130) => {
  if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k); g.font = `900 ${size}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = size * 0.17; g.strokeStyle = INK; g.strokeText(text, 0, 0); g.fillStyle = col; g.fillText(text, 0, 0); g.restore();
};
/** sparks from a grinding wheel (output px) */
const sparks2 = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k: number) => {
  if (k <= 0) return; g.save(); g.globalCompositeOperation = "screen";
  for (let i = 0; i < 14; i++) { const u = ((f * 0.11 + i / 14) % 1), a = -0.3 + hh(i, 7) * 1.2, d = s * (0.2 + u * 1.2); g.strokeStyle = `rgba(255,${200 + Math.floor(50 * hh(i, 3))},120,${(1 - u) * k})`; g.lineWidth = Math.max(2, s * 0.03); g.beginPath(); g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d + u * u * s * 0.4); g.lineTo(x + Math.cos(a) * (d + s * 0.12), y + Math.sin(a) * (d + s * 0.12) + u * u * s * 0.45); g.stroke(); }
  g.restore();
};
const flash = (g: CanvasRenderingContext2D, age: number, k = 1) => { if (age < 0 || age > 6) return; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,250,235,${k * (1 - age / 6)})`; g.fillRect(0, 0, 1080, 1920); g.restore(); };


export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const WHITE = "#f8f6f1";
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, skin: WHITE, ...o } as Outfit);
/** chips sliding in from a point to a stack and the stack growing (output px) */
const chipStack = (g: CanvasRenderingContext2D, x: number, y: number, s: number, n: number, col = "#c0353a") => { for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(x + Math.sin(i * 1.7) * s * 0.03, y - i * s * 0.12, s * 0.5, s * 0.2, 0, 0, 7); g.fillStyle = i % 2 ? col : "#f4ecd6"; g.fill(); g.lineWidth = Math.max(2, s * 0.05); g.strokeStyle = INK; g.stroke(); } };

// ---------------- word anchors ----------------
const t2012 = A(["2012", "2012,"]), tGambler = A("gambler"), tSeven = A("seven"), tMillion = A("million"), tLondon = A("london"), tJust = A("just"), tTurn = A("turn"), tAround = A(["around", "around."]);
const tHis = A("his"), tPartner = A("partner"), tSuper = A(["superstitious", "superstitious."]), tEvery = A("every", tSuper), tSeven2 = A(["seven", "seven,"], tEvery), tEight = A(["eight", "eight,"], tSeven2), tNine = A("nine", tEight), tTurned = A("turned", tNine), tDown = A(["down", "down."], tTurned);
const tFor = A("for", tDown), tLuck = A(["luck", "luck,"], tFor), tAgreed = A(["agreed", "agreed."]), tHigh = A("high"), tWant = A(["want", "want."]), tAnd1 = A("and", tWant), tSame = A("same"), tAgain = A("again", tSame);
const tHeres = A("here's"), tFlaw = A(["flaw", "flaw."]), tPattern = A("pattern"), tEven = A(["even", "even."]), tOneEdge = A("one", tEven), tDiff = A("differently"), tSo = A("so", tDiff), tTurned2 = A("turned", tSo), tLooked = A("looked"), tEveryOther = A("every", tLooked);
const tThey = A("they", tEveryOther), tSpot = A("spot"), tS2 = A(["seven", "seven,"], tSpot), tE2 = A(["eight", "eight,"], tS2), tN2 = A("nine", tE2), tFlipped = A(["flipped", "flipped,"]), t77 = A("7.7"), tTwo = A("two", t77), tDays = A(["days", "days."]);
const tBut = A("but", tDays), tPaid = A(["paid", "paid."]), tCourt = A(["court", "court."]), tAnd2017 = A("and", tCourt), t2017 = A(["2017", "2017,"]), tSupreme = A("supreme"), tCheating = A(["cheating", "cheating."]);
const tThen = A("then", tCheating), tAmerica = A("america"), tOrdered = A("ordered"), t10 = A(["$10", "10"], tOrdered), tMillion3 = A(["million", "million."], tOrdered), tTurns = A("turns"), tLuck3 = A(["luck", "luck,"], tTurns), tLegal = A("legal"), tDefense = A(["defense", "defense.", "defence."]);

// ---------------- cast ----------------
const IVEY = O({ jacket: "#22202a", pants: "#2b2b35", hat: "cap", cap: "#2a2d3a", buttons: "#22202a" });
const SUN = O({ jacket: "#8c1f2a", pants: "#2b2b35", hat: "bun", hair: "#141218", dress: "#b0263a", boots: "#2a2420" });
const CROUP = O({ jacket: "#1f5a3a", pants: "#26232c", hat: "hair", hair: "#5a3b2a", buttons: "#e8c45a", moustache: "#5a3b2a" });
const MANAGER = O({ jacket: "#4a505c", pants: "#2b2b35", hat: "hair", hair: "#d9d6d0", moustache: "#d9d6d0", build: "stout", buttons: "#e8c45a" });
const JUSTICE = (i: number) => O({ jacket: ["#2b2b35", "#3a3f48", "#2f3a4f", "#3a3530", "#2b2b35"][i], pants: "#2b2b35", hat: "hair", hair: ["#e9e6e0", "#8a7a6a", "#c9ccd2", "#3a2a20", "#e9e6e0"][i], moustache: i === 1 || i === 3 ? "#e9e6e0" : undefined, build: i === 2 ? "stout" : "adult" });
const PIT = O({ jacket: "#5a1f6a", pants: "#2b2b35", hat: "hair", hair: "#3a2a20", build: "stout", moustache: "#3a2a20", buttons: "#e8c45a" });

// salon staging (camera looks +z, +x is screen-left): the pair sit behind the far edge of the table, facing us
const IVEY_P: V3 = [0.45, 0, 3.58], SUN_P: V3 = [-0.45, 0, 3.58], MAN_P: V3 = [0, 0, 4.75], CROUP_P: V3 = [-1.25, 0, 4.2];
const TCLIP = above(-1.2, 1.2, 0.9, 3.42);
const SALON_POOLS: V3[] = [[0, 3.9, 2.4]];
const salonGrade = (g: CanvasRenderingContext2D, v: View, f: number, k = 0.45) => nightGrade(g, v, SALON_POOLS, f, k, "255,200,130");
type Ex = [number, Expr][];
const ivey = (f: number, ex: Ex = [[0, "smile"]], hands: [number, Hands][] = [[0, { l: [0.3, -0.35], r: [-0.3, -0.35] }]], talk: [number, number][] = []) =>
  stand(IVEY, "ivey", IVEY_P, 21, f, ex, hands, { facing: -1, talk: talkAt(f, talk, 3) }, { clip: TCLIP, noShadow: true });
const sun = (f: number, ex: Ex = [[0, "smile"]], talk: [number, number][] = [], hands: [number, Hands][] = [[0, { l: [0.3, -0.35], r: [-0.3, -0.35] }]]) =>
  stand(SUN, "sun", SUN_P, 31, f, ex, hands, { facing: 1, talk: talkAt(f, talk, 2) }, { clip: TCLIP, noShadow: true });
const manager = (f: number, ex: Ex = [[0, "smile"]], hands: [number, Hands][] = [[0, {}]], talk: [number, number][] = []) =>
  stand(MANAGER, "man", MAN_P, 41, f, ex, hands, { facing: 0, talk: talkAt(f, talk, 4) }, { clip: TCLIP, noShadow: true });
const croup = (f: number, ex: Ex = [[0, "neutral"]], hands: [number, Hands][] = [[0, {}]]) =>
  stand(CROUP, "croup", CROUP_P, 11, f, ex, hands, { facing: 1 }, { noShadow: true });
/** chip stack on the felt in front of a player (world) */
const chipsAt = (g: CanvasRenderingContext2D, v: View, P: V3, n: number, col: string) => { const p = v.w(P), m = v.ppm(P); chipStack(g, p[0], p[1], m * 0.11, n, col); };
/** a card lying on the felt, drawn in screen space with a gentle table tilt */
const fcard = (g: CanvasRenderingContext2D, x: number, y: number, w: number, rot: number, o: Parameters<typeof pcard>[5] = {}) => {
  g.save(); g.translate(x, y); g.save(); g.scale(1, 0.8); g.globalAlpha = 0.35; g.fillStyle = "#04140c"; g.beginPath(); g.roundRect(-w / 2 + 10, -w * 0.7 + 16, w, w * 1.4, w * 0.08); g.fill(); g.restore();
  g.scale(1, 0.8); pcard(g, 0, 0, w, rot, { ...o, shadow: false }); g.restore();
};
/** a soft blurred felt close-up: the salon_cu plate is the background, we only darken its top a little */
const feltGrade = (g: CanvasRenderingContext2D, v: View, f: number) => { salonGrade(g, v, f, 0.35); };
const CU: V3 = [0.15, 0.95, 2.6];
/** speech bubble above a speaker's head (world head point), tail ending just above the hair */
const say = (g: CanvasRenderingContext2D, v: View, head: V3, text: string, age: number, size = 58) => {
  const h = v.w(head), m = v.ppm(head); g.save(); g.font = `900 ${size}px 'Montserrat'`; const w = g.measureText(text).width + size * 1.1; g.restore();
  const bx = Math.max(w / 2 + 30, Math.min(1080 - w / 2 - 30, h[0])), by = Math.max(260, h[1] - m * 0.42 - 150);
  bubble(g, bx, by, text, age, [h[0] + (bx > h[0] ? 20 : -20), h[1] - m * 0.3], size);
};

// 1 — HOOK. "In 2012, a gambler..."  Frame 1: tight on a card being spun round by the dealer's hand; the camera snaps back.
const C1 = F(tGambler) - 3;
add({
  a: 0, b: C1, plate: "salon_cu",
  keys: [{ f: 0, at: CU, z: 2.6, creep: 0 }, { f: 6, dur: 14, at: CU, z: 1.15, creep: 0.003 }],
  kicks: [[6, 0.6]],
  under: (g, v, f) => feltGrade(g, v, f),
  over: (g, v, f) => {
    const s = 1 + 1.25 * (1 - easeOut(clamp01((f - 6) / 14))), u = easeOutBack(clamp01(f / 10), 1.2);
    const s2 = 1 + 0.8 * (s - 1); fcard(g, 540, 900, 300 * s2, u * Math.PI, { back: true, mark: 1, glow: 0.25 });
    hand(g, 540 + 150 * s2 * Math.cos(u * Math.PI), 900 + 90 * s2 * Math.sin(u * Math.PI) * 0.6, 110 * s2, 2.4 + u * Math.PI, 0.6);
    bigNum(g, 540, 430, "2012", f - F(t2012) - 2);
  },
});
// 2 — "...a gambler won seven million pounds at a London casino..."  (the pair at the baccarat table; his chips pile up)
const C2 = F(tJust) - 3;
add({
  a: C1, b: C2, plate: "salon_w", xfade: 4,
  keys: [{ f: C1, at: [0.45, 1.3, 3.55], z: 2.5, creep: 0.004 }, { f: F(tLondon) - 6, dur: 14, at: [0, 1.25, 3.5], z: 1.7, creep: 0.003 }],
  kicks: [[F(tMillion) + 2, 0.5]],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [ivey(f, [[0, "smile"], [F(tMillion), "grin"]]), sun(f, [[0, "smile"]])],
  over: (g, v, f) => {
    const n = Math.round(7000000 * easeOut(clamp01((f - F(tSeven) + 2) / (F(tMillion) - F(tSeven) + 10))));
    if (f >= F(tSeven) - 2) counter(g, 540, 330, "£" + n.toLocaleString("en-GB"), easeOutBack(clamp01((f - F(tSeven) + 2) / 6), 1.8), "#9fe08a", 112);
    if (f >= F(tLondon) - 6) { chipsAt(g, v, [0.62, 0.88, 3.32], 3 + Math.min(12, Math.floor(Math.max(0, f - F(tSeven)) / 3)), "#e8c45a");
    chipsAt(g, v, [0.3, 0.88, 3.3], 2 + Math.min(8, Math.floor(Math.max(0, f - F(tSeven) - 6) / 3)), "#c0353a"); }
    if (f >= F(tLondon) - 2) label(g, 540, 470, "LONDON", f - F(tLondon) + 2);
  },
});
// 3 — "...just by asking the dealer to turn some cards around."  (close on the felt: two cards spin round one after the other)
const C3 = F(tHis) - 3;
add({
  a: C2, b: C3, plate: "salon_cu", xfade: 4,
  keys: [{ f: C2, at: CU, z: 1.2, creep: 0.004 }],
  under: (g, v, f) => feltGrade(g, v, f),
  over: (g, v, f) => {
    [-1, 1].forEach((sd, i) => {
      const t0 = F(tTurn) - 4 + i * 7, u = easeOutBack(clamp01((f - t0) / 9), 1.3), x = 540 + sd * 170;
      fcard(g, x, 1000, 250, u * Math.PI, { back: true });
      if (f >= t0 && f < t0 + 10) hand(g, x + 120 * Math.cos(u * Math.PI), 1000 + 60 * Math.sin(u * Math.PI), 95, 2.4 + u * Math.PI, 0.6);
    });
    if (f >= F(tAround) - 2) label(g, 540, 640, "TURN IT AROUND", f - F(tAround) + 2);
  },
});
// 4 — "His partner told the dealer she was superstitious."  (close on her: she leans in and talks; the bubble stays up)
const C4 = F(tEvery) - 3;
add({
  a: C3, b: C4, plate: "salon_w", xfade: 4,
  keys: [{ f: C3, at: [-0.4, 1.38, 3.55], z: 2.2, creep: 0.004 }],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [sun(f, [[0, "smile"], [F(tSuper), "smile_closed"]], [[F(tPartner) + 2, C4]], [[0, { l: [0.3, -0.35], r: [-0.3, -0.35] }], [F(tSuper) - 4, { l: [0.35, -0.75] }]])],
  over: (g, v, f) => say(g, v, [-0.45, 1.45, 3.58], "I'M SUPERSTITIOUS!", f - (F(tPartner) + 6), 52),
});
// 5 — "Every time a seven, an eight or a nine came out, she asked for it to be turned upside down."  (7, 8, 9 flip up; then each spins round)
const C5 = F(tFor) - 3;
add({
  a: C4, b: C5, plate: "salon_cu", xfade: 4,
  keys: [{ f: C4, at: CU, z: 1.2, creep: 0.003 }],
  kicks: [[F(tDown), 0.4]],
  under: (g, v, f) => feltGrade(g, v, f),
  over: (g, v, f) => {
    ([[tSeven2, "7", 0], [tEight, "8", 1], [tNine, "9", 3]] as [number, string, number][]).forEach(([t, rk, su], i) => {
      const t0 = F(t) - 3; if (f < t0 - 3) return;
      const x = 540 + (i - 1) * 300, slide = easeOut(clamp01((f - t0 + 3) / 6)), flip = clamp01((f - t0 - 2) / 6), turn = easeOutBack(clamp01((f - F(tTurned) - i * 5) / 9), 1.3);
      fcard(g, x, 1000 - (1 - slide) * 260, 230, turn * Math.PI, { back: true, flip, rank: rk, suit: su });
      if (turn > 0.9) sparkle(g, x + 95, 880, 46, f - F(tTurned) - i * 5 - 9);
    });
    if (f >= F(tDown) - 2) label(g, 540, 640, "UPSIDE DOWN", f - F(tDown) + 2);
  },
});
// 6 — "For luck. The casino agreed. High rollers get what they want."  (she winks; the manager steps up beaming; chips flood in)
const C6 = F(tAnd1) - 3;
add({
  a: C5, b: C6, plate: "salon_w", xfade: 4,
  keys: [{ f: C5, at: [-0.35, 1.38, 3.55], z: 2.2, creep: 0.003 }, { f: F(tAgreed) - 6, dur: 12, at: [0, 1.4, 3.8], z: 1.6, creep: 0.003 }],
  kicks: [[F(tAgreed), 0.3]],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [manager(f, [[0, "neutral"], [F(tAgreed) - 2, "grin"]], [[0, {}], [F(tAgreed) - 2, { r: [-0.5, -0.75] }]]), ivey(f, [[0, "smile"], [F(tHigh), "grin"]]), sun(f, [[0, "smile_closed"], [F(tLuck) + 4, "grin"]], [[F(tFor) - 2, F(tLuck) + 8]])],
  over: (g, v, f) => {
    if (f >= F(tFor) - 2 && f < F(tAgreed) - 6) say(g, v, [-0.45, 1.45, 3.58], "FOR LUCK!", f - F(tFor) + 2, 60);
    if (f >= F(tAgreed) - 2 && f < F(tHigh) - 2) say(g, v, [0, 1.45, 4.75], "OF COURSE!", f - F(tAgreed) + 2, 54);
    chipsAt(g, v, [0.62, 0.88, 3.32], 6 + Math.min(14, Math.floor(Math.max(0, f - F(tHigh)) / 2)), "#e8c45a");
    chipsAt(g, v, [-0.62, 0.88, 3.32], 4 + Math.min(10, Math.floor(Math.max(0, f - F(tHigh)) / 2)), "#2f5a8a");
    if (f >= F(tHigh) - 2) label(g, 540, 360, "HIGH ROLLERS", f - F(tHigh) + 2);
  },
});
// 7 — "And they asked for one more thing: keep playing with the same cards. Again and again."  (the used cards sweep back into the shoe, round and round)
const C7 = F(tHeres) - 3;
const shoe2d = (g: CanvasRenderingContext2D, x: number, y: number, w: number) => {
  g.save(); g.translate(x, y); g.lineJoin = "round";
  g.beginPath(); g.moveTo(-w / 2, -w * 0.18); g.lineTo(w * 0.3, -w * 0.3); g.lineTo(w / 2, w * 0.05); g.lineTo(w / 2, w * 0.3); g.lineTo(-w / 2, w * 0.3); g.closePath();
  g.fillStyle = "#3a2418"; g.fill(); g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#5a3826"; g.fillRect(-w / 2 + 12, -w * 0.1, w * 0.75, w * 0.08);
  g.fillStyle = "#f3ead2"; g.fillRect(w * 0.3, w * 0.05, w * 0.18, w * 0.22); g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(w * 0.3, w * 0.05, w * 0.18, w * 0.22);
  g.restore();
};
add({
  a: C6, b: C7, plate: "salon_cu", xfade: 4,
  keys: [{ f: C6, at: CU, z: 1.2, creep: 0.003 }],
  under: (g, v, f) => feltGrade(g, v, f),
  over: (g, v, f) => {
    shoe2d(g, 540, 930, 360);
    for (let k = 0; k < 3; k++) {
      const t0 = F(tSame) - 8 + k * 9;
      for (let j = 0; j < 3; j++) {
        const uu = clamp01((f - t0 - j * 3) / 10); if (uu <= 0 || uu >= 1) continue;
        const e = smooth(uu), x = 540 + (j - 1) * 220 * (1 - e) + 60 * e, y = 1190 - 230 * e - Math.sin(Math.PI * uu) * 120;
        fcard(g, x, y, 170 * (1 - 0.35 * e), (1 - e) * (j - 1) * 0.6, { back: true });
      }
    }
    if (f >= F(tSame) - 4) {
      label(g, 540, 560, "SAME CARDS", f - F(tSame) + 4);
      const k = easeOutBack(clamp01((f - F(tAgain)) / 6), 1.6);
      if (k > 0) { g.save(); g.translate(540, 930); g.scale(k, k); g.rotate(f * 0.12); g.strokeStyle = "#ffd24a"; g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.arc(0, 0, 230, 0.4, Math.PI * 1.75); g.stroke();
        const ex = 230 * Math.cos(Math.PI * 1.75), ey = 230 * Math.sin(Math.PI * 1.75); g.translate(ex, ey); g.rotate(Math.PI * 1.75 + Math.PI / 2); g.fillStyle = "#ffd24a"; g.beginPath(); g.moveTo(26, 0); g.lineTo(-14, -22); g.lineTo(-14, 22); g.closePath(); g.fill(); g.restore(); }
    }
  },
});
// 8 — "Here's the trick. The cards had a tiny flaw. The pattern on the back wasn't perfectly even. One edge was printed
//      just a little differently from the other."  (one giant card back; a magnifier sweeps; the thin and the thick borders light up)
const C8 = F(tSo) - 3;
const CB_Y = 790, CB_W = 470, CB_H = CB_W * 1.4;
const bandGlow = (g: CanvasRenderingContext2D, y0: number, y1: number, a: number) => {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.strokeStyle = "#ffd24a"; g.lineWidth = 10; g.shadowColor = "#ffd24a"; g.shadowBlur = 24;
  g.beginPath(); g.roundRect(540 - CB_W / 2 - 4, y0 - 4, CB_W + 8, y1 - y0 + 8, 14); g.stroke(); g.restore();
};
add({
  a: C7, b: C8, plate: "salon_cu", xfade: 6,
  keys: [{ f: C7, at: CU, z: 1.2, creep: 0.002 }],
  kicks: [[F(tFlaw), 0.3]],
  under: (g, v, f) => feltGrade(g, v, f),
  over: (g, v, f) => {
    dim(g, 0.35);
    const k = easeOutBack(clamp01((f - C7) / 10), 1.4);
    g.save(); g.translate(540, CB_Y); g.scale(k, k); g.translate(-540, -CB_Y); pcard(g, 540, CB_Y, CB_W, 0, { back: true, glow: 0.25 }); g.restore();
    const top = CB_Y - CB_H / 2, bot = CB_Y + CB_H / 2;
    const sweep = clamp01((f - F(tPattern) + 4) / 40), park = clamp01((f - F(tOneEdge) + 2) / 8);
    const mx0 = 540 + Math.cos(sweep * Math.PI * 2) * 140, my0 = CB_Y - 200 + sweep * 300, mx = mx0 + (650 - mx0) * park, my = my0 + (bot - 40 - my0) * park;
    if (f >= F(tPattern) - 4) magnifier(g, mx, my, 120, 0.7);
    const aT = clamp01((f - F(tOneEdge)) / 6), aB = clamp01((f - F(tDiff) + 6) / 6);
    bandGlow(g, top, top + CB_H * 0.05, aT); bandGlow(g, bot - CB_H * 0.12, bot, aB);
    if (aT > 0) label(g, 540, top - 70, "THIN", f - F(tOneEdge));
    if (aB > 0) label(g, 540, bot + 70, "THICK", f - F(tDiff) + 6);
  },
});
// 9 — "So once a card was turned around, its back looked different from every other card."  (a row of backs; one spins round and stands out)
const C9 = F(tThey) - 3;
add({
  a: C8, b: C9, plate: "salon_cu", xfade: 4,
  keys: [{ f: C8, at: CU, z: 1.2, creep: 0.002 }],
  under: (g, v, f) => feltGrade(g, v, f),
  over: (g, v, f) => {
    dim(g, 0.35);
    for (let i = 0; i < 4; i++) {
      const x = 180 + i * 240, odd = i === 2, turn = odd ? easeOutBack(clamp01((f - F(tTurned2) + 2) / 9), 1.3) : 0, a = odd ? clamp01((f - F(tLooked)) / 6) : 0, lift = odd ? -30 * a : 0;
      pcard(g, x, 900 + lift, 200, turn * Math.PI, { back: true, glow: a * 0.8 });
      if (odd && a > 0) bandGlow2(g, x, 900 + lift - 140, 200, a);
    }
    if (f >= F(tEveryOther) - 2) label(g, 540, 600, "SPOT THE ODD ONE", f - F(tEveryOther) + 2);
  },
});
function bandGlow2(g: CanvasRenderingContext2D, x: number, yTop: number, w: number, a: number) { g.save(); g.globalAlpha = a; g.strokeStyle = "#ffd24a"; g.lineWidth = 8; g.shadowColor = "#ffd24a"; g.shadowBlur = 20; g.beginPath(); g.roundRect(x - w / 2 - 4, yTop - 4, w + 8, w * 1.4 * 0.12 + 8, 10); g.stroke(); g.restore(); }
// 10 — "They could spot every seven, eight and nine before it was even flipped."  (close on him, eyes narrowed; 7-8-9 tick up;
//       the next card slides out face down with a gold edge... it flips: a nine)
const C10 = F(t77) - 3;
add({
  a: C9, b: C10, plate: "salon_w", xfade: 4,
  keys: [{ f: C9, at: [0.45, 1.25, 3.55], z: 2.3, creep: 0.004 }],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [ivey(f, [[0, "smile"], [F(tSpot), "grin"], [F(tFlipped), "laugh"]])],
  over: (g, v, f) => {
    ([tS2, tE2, tN2] as number[]).forEach((t, i) => counter(g, 330 + i * 210, 330, ["7", "8", "9"][i], easeOutBack(clamp01((f - F(t) + 2) / 6), 2), "#ffd24a", 130));
    const out = easeOut(clamp01((f - F(tN2)) / 10)), flip = clamp01((f - F(tFlipped) + 2) / 7);
    if (out > 0) fcard(g, 540 + (1 - out) * 420, 1120, 230, 0.1 * (1 - out), { back: true, mark: 1, glow: 0.7 * (1 - flip), flip, rank: "9", suit: 3 });
  },
});
// 11 — "7.7 million pounds in two days."  (the counter rolls; DAY 1 tears to DAY 2; chips avalanche; both laugh)
const C11 = F(tBut) - 3;
add({
  a: C10, b: C11, plate: "salon_w", xfade: 4,
  keys: [{ f: C10, at: [0, 1.25, 3.5], z: 1.7, creep: 0.004 }],
  kicks: [[F(tDays), 0.5]],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [ivey(f, [[0, "laugh"]]), sun(f, [[0, "grin"], [F(tTwo), "laugh"]])],
  over: (g, v, f) => {
    const n = Math.round(7700000 * easeOut(clamp01((f - C10) / 18))); counter(g, 540, 330, "£" + n.toLocaleString("en-GB"), easeOutBack(clamp01((f - C10) / 6), 1.8), "#9fe08a", 112);
    if (f >= F(tTwo) - 4) calendar(g, 540, 560, 170, f < F(tDays) ? "DAY 1" : "DAY 2", f < F(tDays) ? null : "DAY 1", clamp01((f - F(tDays)) / 5), easeOutBack(clamp01((f - F(tTwo) + 4) / 6), 1.8));
    chipsAt(g, v, [0.68, 0.88, 3.32], 16, "#e8c45a"); chipsAt(g, v, [0.32, 0.88, 3.3], 12, "#c0353a"); chipsAt(g, v, [-0.62, 0.88, 3.32], 14, "#2f5a8a");
  },
});
// 12 — "But the casino never paid. They went to court."  (the manager rips the cheque in half)
const C12 = F(tAnd2017) - 3;
add({
  a: C11, b: C12, plate: "salon_w", xfade: 4,
  keys: [{ f: C11, at: [0, 1.42, 4.75], z: 2.3, creep: 0.004 }],
  kicks: [[F(tPaid) + 2, 0.4]],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [manager(f, [[0, "stern"], [F(tPaid), "angry"]], [[0, { l: [0.3, -0.6], r: [-0.3, -0.6] }]])],
  over: (g, v, f) => {
    const tear = clamp01((f - F(tPaid) + 2) / 8), cx = 540, cy = 930;
    for (const s of [-1, 1]) {
      g.save(); g.translate(cx + s * tear * 190, cy + tear * tear * 120); g.rotate(s * tear * 0.6);
      g.beginPath(); if (s < 0) { g.moveTo(-200, -80); g.lineTo(0, -80); for (let i = 0; i <= 8; i++) g.lineTo(i % 2 ? -12 : 0, -80 + i * 20); g.lineTo(-200, 80); } else { g.moveTo(0, -80); for (let i = 0; i <= 8; i++) g.lineTo(i % 2 ? -12 : 0, -80 + i * 20); g.lineTo(200, 80); g.lineTo(200, -80); }
      g.closePath(); g.fillStyle = "#f3ead2"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      g.fillStyle = "#3a2a20"; g.font = "900 46px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s < 0 ? "£7,700," : "000", s < 0 ? -95 : 90, 6);
      g.restore();
    }
    if (f >= F(tCourt) - 2) label(g, 540, 360, "SEE YOU IN COURT", f - F(tCourt) + 2);
  },
});
// 13 — "And in 2017, the UK Supreme Court said: that's cheating."  (five justices; the gavel; CHEATING stamps on)
const C13 = F(tThen) - 3;
const JX = [58.9, 59.45, 60, 60.55, 61.1];
add({
  a: C12, b: C13, plate: "uksc", xfade: 6,
  keys: [{ f: C12, at: [60, 1.55, 4.0], z: 1.15, creep: 0.003 }, { f: F(tCheating) - 6, dur: 8, at: [60, 1.5, 4.0], z: 1.6, creep: 0.003, punch: 0.01, pn: 10 }],
  kicks: [[F(tCheating) + 1, 0.9]],
  cast: (f) => JX.map((x, i) => stand(JUSTICE(i), "j" + i, [x, 0, 4.0], 61 + i, f, [[0, "neutral"], [F(tSupreme), "stern"], [F(tCheating) - 2, i === 2 ? "angry" : "stern"]], [[0, {}]], { facing: (i < 2 ? -1 : i > 2 ? 1 : 0) as -1 | 0 | 1 }, { clip: above(57, 63, 1.18, 3.42), noShadow: true })),
  over: (g, v, f) => {
    bigNum(g, 540, 330, "2017", f - F(t2017));
    const H = F(tCheating), bp = v.w([59.7, 1.2, 3.4]), m = v.ppm([59.7, 1.2, 3.4]);
    g.save(); g.fillStyle = "#5a3826"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(bp[0], bp[1], m * 0.12, m * 0.035, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    gavel(g, bp[0] - m * 0.05, bp[1] - m * 0.05, m * 0.45, f < H - 4 ? 0 : f < H ? (f - H + 4) / 4 : 1);
    if (f >= H) stampW(g, "CHEATING", f, H, C13 + 6, 540, 560, 600, -0.12);
  },
});
// 14 — "Then a casino in America found out he'd done the same thing there, and he was ordered to pay back ten million dollars."
const C14 = F(tTurns) - 3;
add({
  a: C13, b: C14, plate: "acity", xfade: 6,
  keys: [{ f: C13, at: [120.05, 1.25, 1.8], z: 1.5, creep: 0.003 }, { f: F(tOrdered) - 4, dur: 12, at: [119.78, 1.3, 1.7], z: 1.9, creep: 0.004 }],
  kicks: [[F(tMillion3) + 2, 0.5]],
  cast: (f) => [
    stand(IVEY, "ivey", [119.72, 0, 1.7], 21, f, [[0, "smile"], [F(tOrdered), "shock"], [F(tMillion3) + 6, "dazed"]], [[0, {}]], { facing: 1 }, { noShadow: true }),
    stand(PIT, "pit", [120.38, 0, 1.95], 71, f, [[0, "stern"], [F(tAmerica) + 6, "angry"]], [[0, {}], [F(tAmerica) + 6, { r: [-0.6, -0.6] }]], { facing: -1 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    label(g, 540, 300, "ATLANTIC CITY, USA", f - F(tAmerica));
    if (f >= F(t10) - 4) { const n = Math.round(10000000 * easeOut(clamp01((f - F(t10) + 4) / 12))); counter(g, 540, 440, "-$" + n.toLocaleString("en-US"), easeOutBack(clamp01((f - F(t10) + 4) / 6), 1.8), "#ff8a8a", 100); }
    if (f >= F(tOrdered)) { const hp = v.w([119.72, 0.95, 1.7]); for (let i = 0; i < 9; i++) { const u = ((f - F(tOrdered)) * 0.035 + i / 9) % 1; bill(g, hp[0] + 60 + u * 560, hp[1] - u * 260 + Math.sin(u * 7 + i) * 30, 90, u * 4 + i, (u * 3 + i * 0.2) % 1); } }
  },
});
// 15 — "Turns out, 'for luck' is not a legal defence."  (back at the table: she shrugs sheepishly; he facepalms... a card spins round on the felt)
add({
  a: C14, b: TOTAL, plate: "salon_w", xfade: 6,
  keys: [{ f: C14, at: [0, 1.25, 3.5], z: 1.7, creep: 0.004 }],
  under: (g, v, f) => salonGrade(g, v, f),
  cast: (f) => [ivey(f, [[0, "dazed"]]), sun(f, [[0, "nervous"], [F(tLegal), "smile_closed"]], [], [[0, { l: [0.55, -0.7], r: [-0.55, -0.7] }]])],
  over: (g, v, f) => {
    if (f >= F(tLuck3) - 4 && f < F(tLegal) + 30) say(g, v, [-0.45, 1.45, 3.58], "FOR LUCK?", f - F(tLuck3) + 4, 60);
    if (f >= F(tDefense) + 6) sparkle(g, 540, 560, 60, f - F(tDefense) - 6);
  },
});

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
