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

// ======================= "The GTA 6 Leak That Came From a Hotel TV" =======================
// ---------------- word anchors ----------------
const tLeak = A("leak"), tDidnt = A("didn't"), tComputer = A("computer"), tIt = A("it", tComputer), tHotel = A("hotel"), tTV = A("tv", tHotel), tIn = A("in", tTV);
const t2022 = A("2022"), tBritish = A("british"), tBail = A("bail"), tHacking = A("hacking"), tPolice = A("police"), tLaptop = A("laptop"), tPut = A("put"), tHotel2 = A("hotel", tPut), tSafety = A("safety");
const tSo = A("so", tSafety), tTV2 = A("tv", tSo), tStreaming = A("streaming"), tBrand = A("brand"), tPhone = A("phone"), tFrom = A("from", tPhone), tBroke = A("broke"), tPrivate = A("private"), tChat = A("chat");
const tFound = A("found"), tNobody = A("nobody"), tSeen = A("seen"), t90 = A("90"), tSecret = A("secret"), tClips = A("clips"), tGTA = A("gta"), tHe = A("he", tGTA), tPosted = A("posted"), tOnline = A("online");
const tThen = A("then", tOnline), tMessaged = A("messaged"), tStaff = A("staff"), tPay = A("pay"), tCode = A("code"), tNext = A("next", tCode), tPolice2 = A("police", tNext), tFar = A("far"), tStill = A("still"), tHotel3 = A("hotel", tStill);
const tJudge = A("judge"), tOrdered = A("ordered"), tSecure = A("secure"), tEnd = A("end"), tBecause = A("because"), tStraight = A("straight"), tYear = A("year"), tTrailer = A("trailer"), t90m = A("90", tTrailer);
const tViews = A("views"), t24 = A("24"), tWorld = A("world"), tRecord = A("record"), tAnd = A("and", tRecord), tMonth = A("month"), tMillions = A("millions"), tPlay = A("play"), tBut = A("but", tPlay);
const tFirst = A("first", tBut), tLeak2 = A("leak", tFirst), tHotel4 = A("hotel", tLeak2), tTV4 = A("tv", tHotel4);

// ---------------- plate images (the hotel TV and the clip tiles show our own Leonida art) ----------------
let PIMG: Map<string, HTMLImageElement> = new Map();
export const setPlateImgs = (m: Map<string, HTMLImageElement>) => { PIMG = m; };
/** a plate image cropped to the box (cover), with an optional extra zoom about (cx, cy) */
const plateIn = (g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, zoom = 1, cx = 0.5, cy = 0.5) => {
  const im = PIMG.get(id); if (!im) { g.fillStyle = "#c0408a"; g.fillRect(x, y, w, h); return; }
  const s = Math.max(w / im.width, h / im.height) * zoom, sw = w / s, sh = h / s;
  g.drawImage(im, Math.max(0, Math.min(im.width - sw, im.width * cx - sw / 2)), Math.max(0, Math.min(im.height - sh, im.height * cy - sh / 2)), sw, sh, x, y, w, h);
};
/** the GTA-6 title in our own type: heavy italic, sunset gradient, thick ink outline, a hard drop shadow */
const gtaTitle = (g: CanvasRenderingContext2D, x: number, y: number, size: number, k: number, text = "GTA 6", rot = -0.06) => {
  if (k <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.font = `italic 900 ${size}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = size * 0.2; g.strokeStyle = "#140a24"; g.strokeText(text, size * 0.06, size * 0.08); g.strokeText(text, 0, 0);
  const gr = g.createLinearGradient(0, -size * 0.45, 0, size * 0.45); gr.addColorStop(0, "#ffe27a"); gr.addColorStop(0.45, "#ff8a5a"); gr.addColorStop(1, "#ff3aa0");
  g.fillStyle = gr; g.fillText(text, 0, 0);
  g.globalCompositeOperation = "screen"; g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(-size * 2, -size * 0.42, size * 4, size * 0.08); g.globalCompositeOperation = "source-over";
  g.restore();
};
/** a neon chapter pill (output px) */
const pill = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number, col = "#ff3aa0") => {
  if (age < 0) return; const k = easeOutBack(clamp01(age / 7), 2.2);
  g.save(); g.font = "italic 900 50px 'Montserrat'"; const w = g.measureText(text).width + 60; x = Math.max(w / 2 + 30, Math.min(1080 - w / 2 - 30, x)); g.translate(x, y); g.scale(k, k);
  g.beginPath(); g.roundRect(-w / 2, -38, w, 76, 14); g.fillStyle = "#140a24"; g.fill(); g.lineWidth = 6; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 22; g.stroke(); g.shadowBlur = 0;
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 3); g.restore();
};
/** a 5-point star path */
const starPath = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); };

// ---------------- cast ----------------
const TEEN = O({ jacket: "#2a2d3a", pants: "#3a3f52", hat: "hood", cap: "#2f3242", buttons: "#2a2d3a", boots: "#e9e6e0" });
const COP = (i: number) => O({ jacket: "#d6e04a", pants: "#1d1a22", hat: "chauffeur", cap: "#1d1a22", buttons: "#c9ccd2", moustache: i ? "#3a2a20" : undefined, build: i ? "stout" : "adult" });
const JUDGE = O({ jacket: "#8c1f2a", pants: "#2b2b35", hat: "hair", hair: "#e9e6e0", buttons: "#e8c45a" });
const STAFF = (i: number) => O({ jacket: ["#3a8aa8", "#c0408a", "#4a5a3a", "#e8a03a", "#5a4f86", "#2a2d3a", "#c95a5a", "#3aa87a"][i % 8], pants: "#2b2b35",
  hat: (["hair", "cap", "bun", "hair", "hair", "bun", "cap", "hair"] as const)[i % 8], hair: ["#2a2420", "#5a3b2a", "#141218", "#8a5a2a", "#c9a46a", "#3a2a20", "#2a2420", "#141218"][i % 8], cap: ["#1d1a22", "#c0353a"][i % 2], buttons: "#e9e6e0" });

// ---------------- grades ----------------
const TVP: V3 = [0, 1.27, -2.47];
const hotelGrade = (g: CanvasRenderingContext2D, v: View, f: number, k = 0.85, pools: V3[] = [TVP]) => nightGrade(g, v, pools, f, k, "120,170,255");
const tvQuad = (v: View) => [v.w([-0.66, 1.64, -2.47]), v.w([0.66, 1.64, -2.47]), v.w([0.66, 0.9, -2.47]), v.w([-0.66, 0.9, -2.47])] as P2[];
/** the hotel TV's picture: Leonida at sunset (our art), with scanlines; on = 0..1 (power-on/off squash) */
const tvPicture = (g: CanvasRenderingContext2D, v: View, f: number, on = 1, title = 0) => {
  const q = tvQuad(v), x0 = Math.min(...q.map((p) => p[0])), x1 = Math.max(...q.map((p) => p[0])), y0 = Math.min(...q.map((p) => p[1])), y1 = Math.max(...q.map((p) => p[1]));
  g.save(); g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
  g.fillStyle = "#05060c"; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (on > 0) {
    const cy = (y0 + y1) / 2, hh = (y1 - y0) * Math.max(0.012, on);
    g.save(); g.beginPath(); g.rect(x0, cy - hh / 2, x1 - x0, hh); g.clip();
    plateIn(g, "leo_w", x0, y0, x1 - x0, y1 - y0, 1.05 + 0.02 * Math.sin(f * 0.03), 0.5, 0.42);
    gtaTitle(g, (x0 + x1) / 2, y0 + (y1 - y0) * 0.36, (x1 - x0) * 0.2, title);
    g.globalAlpha = 0.18; g.fillStyle = "#000"; for (let y = y0; y < y1; y += 6) g.fillRect(x0, y, x1 - x0, 2); g.globalAlpha = 1;
    if (on < 1) { g.fillStyle = `rgba(255,255,255,${1 - on})`; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
    g.restore();
  }
  const gl = g.createLinearGradient(x0, y0, x1, y1); gl.addColorStop(0, "rgba(255,255,255,0.12)"); gl.addColorStop(0.4, "rgba(255,255,255,0)"); g.fillStyle = gl; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
  return { x0, x1, y0, y1 };
};
/** the over-the-shoulder hood silhouette (foreground, output px) */
const hoodBack = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = "#0c0d14"; g.strokeStyle = "rgba(120,170,255,0.55)"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(-420, 420); g.bezierCurveTo(-400, 120, -300, 40, -170, 10); g.bezierCurveTo(-170, -230, 170, -230, 170, 10); g.bezierCurveTo(300, 40, 400, 120, 420, 420); g.closePath(); g.fill(); g.stroke(); g.restore();
};

// ---------------- 2D props ----------------
const laptop2d = (g: CanvasRenderingContext2D, x: number, y: number, w: number, open: number, glowK = 1) => {
  g.save(); g.translate(x, y); g.lineJoin = "round";
  g.beginPath(); g.moveTo(-w / 2 + 10, 0); g.lineTo(w / 2 - 10, 0); g.lineTo(w / 2 + 30, w * 0.2); g.lineTo(-w / 2 - 30, w * 0.2); g.closePath(); g.fillStyle = "#3a3f4a"; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#23262f"; for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { const t = (r + 0.5) / 4, xx = -w / 2 + 20 - t * 30 + (c / 10) * (w - 40 + t * 60); g.fillRect(xx, w * 0.03 + r * w * 0.045, (w - 40) / 12, w * 0.03); }
  const h = w * 0.62 * Math.max(0.04, Math.cos((1 - open) * Math.PI / 2));
  g.beginPath(); g.roundRect(-w / 2 + 10, -h, w - 20, h, 8); g.fillStyle = "#2a2f3a"; g.fill(); g.stroke();
  if (open > 0.15) { g.save(); g.beginPath(); g.rect(-w / 2 + 26, -h + 14, w - 52, h - 28); g.clip(); plateIn(g, "leo_w", -w / 2 + 26, -h + 14, w - 52, h - 28, 1.4, 0.5, 0.4); g.fillStyle = `rgba(0,0,0,${1 - glowK})`; g.fillRect(-w / 2, -h, w, h); g.restore(); }
  g.restore();
};
const evidenceBag = (g: CanvasRenderingContext2D, x: number, y: number, w: number, seal: number) => {
  const h = w * 1.25; g.save(); g.translate(x, y);
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 18); g.fillStyle = "rgba(220,235,255,0.28)"; g.fill(); g.lineWidth = 7; g.strokeStyle = "rgba(20,24,40,0.9)"; g.stroke();
  g.fillStyle = "#c0353a"; g.fillRect(-w / 2 + 8, h / 2 - 120, w - 16, 74); g.fillStyle = "#fff"; g.font = "900 50px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EVIDENCE", 0, h / 2 - 82);
  g.strokeStyle = "#1d1a22"; g.lineWidth = 12; g.beginPath(); g.moveTo(-w / 2 + 14, -h / 2 + 34); g.lineTo(-w / 2 + 14 + (w - 28) * seal, -h / 2 + 34); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(-w / 2 + 22, -h / 2 + 60, 18, h - 220); g.restore();
};
const streamStick = (g: CanvasRenderingContext2D, x: number, y: number, s: number, led: number) => {
  g.save(); g.translate(x, y); g.beginPath(); g.roundRect(-s * 0.5, -s * 0.16, s, s * 0.32, s * 0.08); g.fillStyle = "#1d1a22"; g.fill(); g.lineWidth = 5; g.strokeStyle = "#5a5f6a"; g.stroke();
  g.fillStyle = "#c9ccd2"; g.fillRect(s * 0.5, -s * 0.09, s * 0.22, s * 0.18); g.fillStyle = `rgba(90,200,255,${0.4 + 0.6 * led})`; g.shadowColor = "#5ac8ff"; g.shadowBlur = 20 * led; g.beginPath(); g.arc(-s * 0.32, 0, s * 0.05, 0, 7); g.fill(); g.restore();
};
const phone2d = (g: CanvasRenderingContext2D, x: number, y: number, h: number, rot = 0, screen: "chat" | "glow" | "off" = "glow", f = 0) => {
  const w = h * 0.5; g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, w * 0.16); g.fillStyle = "#1a1a22"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, w * 0.12);
  if (screen === "off") { g.fillStyle = "#0a0b10"; g.fill(); }
  else { const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, "#3a2a7a"); gr.addColorStop(1, "#c0408a"); g.fillStyle = gr; g.fill();
    if (screen === "chat") for (let i = 0; i < 5; i++) { const yy = -h / 2 + 30 + i * h * 0.17 - ((f * 1.5) % (h * 0.17)); g.fillStyle = i % 2 ? "rgba(255,255,255,0.85)" : "rgba(95,240,255,0.85)"; g.beginPath(); g.roundRect(i % 2 ? -w / 2 + 16 : -w * 0.05, yy, w * 0.5, h * 0.09, 8); g.fill(); } }
  g.restore();
};
const phoneBox = (g: CanvasRenderingContext2D, x: number, y: number, w: number, lid: number) => {
  g.save(); g.translate(x, y); g.lineJoin = "round"; g.lineWidth = 6; g.strokeStyle = INK;
  g.beginPath(); g.rect(-w / 2, -w * 0.25, w, w * 0.5); g.fillStyle = "#f2f0ec"; g.fill(); g.stroke();
  g.save(); g.translate(0, -w * 0.25 - lid * w * 0.9); g.rotate(-0.4 * lid); g.beginPath(); g.rect(-w / 2 - 6, -w * 0.14, w + 12, w * 0.14); g.fillStyle = "#e9e6e0"; g.fill(); g.stroke(); g.restore();
  g.restore();
};
/** a chat window (generic, our design): a channel list, message bubbles, a padlock in the title bar */
const chatWin = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, unlock: number, folder: number) => {
  g.save(); g.translate(x - w / 2, y - h / 2);
  g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fillStyle = "#16182a"; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#24273d"; g.beginPath(); g.roundRect(0, 0, w, 96, [26, 26, 0, 0]); g.fill();
  g.fillStyle = "#ffffff"; g.font = "900 44px 'Montserrat'"; g.textBaseline = "middle"; g.fillText("STUDIO CHAT", 120, 50);
  const lx = 62, ly = 50; g.strokeStyle = unlock > 0.5 ? "#5ff09a" : "#ffd24a"; g.lineWidth = 8; g.beginPath(); g.arc(lx, ly - 12 - unlock * 14, 16, Math.PI, 0); g.stroke(); g.fillStyle = unlock > 0.5 ? "#5ff09a" : "#ffd24a"; g.fillRect(lx - 22, ly - 8, 44, 32);
  g.fillStyle = "#1d2034"; g.fillRect(0, 96, w * 0.3, h - 96);
  ["# general", "# art", "# builds", "# vi-dev", "# qa"].forEach((c, i) => { g.fillStyle = i === 3 ? "#ff3aa0" : "#8a90b0"; g.font = "800 30px 'Montserrat'"; g.fillText(c, 22, 150 + i * 56); });
  g.save(); g.beginPath(); g.rect(w * 0.3, 96, w * 0.7, h - 96); g.clip();
  for (let i = 0; i < 9; i++) { const yy = 130 + i * 92 - ((f * 2) % 92); g.fillStyle = ["#3aa8c8", "#c0408a", "#e8a03a"][i % 3]; g.beginPath(); g.arc(w * 0.3 + 46, yy + 24, 22, 0, 7); g.fill(); g.fillStyle = "#2c3050"; g.beginPath(); g.roundRect(w * 0.3 + 84, yy, w * 0.7 * (0.45 + 0.3 * ((i * 7) % 5) / 5), 50, 14); g.fill(); }
  g.restore();
  if (folder > 0) { const k = easeOutBack(clamp01(folder), 1.8); g.save(); g.translate(w * 0.62, h * 0.58); g.scale(k, k);
    g.shadowColor = "#ffd24a"; g.shadowBlur = 40; g.fillStyle = "#e8b03a"; g.beginPath(); g.moveTo(-170, -110); g.lineTo(-60, -110); g.lineTo(-30, -80); g.lineTo(170, -80); g.lineTo(170, 120); g.lineTo(-170, 120); g.closePath(); g.fill(); g.shadowBlur = 0; g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    g.fillStyle = "#140a24"; g.font = "italic 900 54px 'Montserrat'"; g.textAlign = "center"; g.fillText("GTA 6", 0, 6); g.font = "900 26px 'Montserrat'"; g.fillText("TEST BUILD", 0, 66); g.restore(); }
  g.restore();
};
/** one leaked clip tile: a crop of our art with a play button and a timestamp */
const clipTile = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number, k: number) => {
  if (k <= 0) return; const ids = ["leo_w", "leo_bb", "studio_mon", "corr_w", "leo_w", "hotel_tv"];
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(k, k); g.translate(-w / 2, -h / 2);
  g.save(); g.beginPath(); g.roundRect(0, 0, w, h, 10); g.clip(); plateIn(g, ids[i % 6], 0, 0, w, h, 1.6 + (i % 4) * 0.4, 0.3 + ((i * 37) % 40) / 100, 0.35 + ((i * 53) % 30) / 100);
  g.fillStyle = "rgba(20,10,40,0.25)"; g.fillRect(0, 0, w, h); g.restore();
  g.lineWidth = 5; g.strokeStyle = "#140a24"; g.beginPath(); g.roundRect(0, 0, w, h, 10); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.moveTo(w / 2 - 14, h / 2 - 18); g.lineTo(w / 2 + 18, h / 2); g.lineTo(w / 2 - 14, h / 2 + 18); g.closePath(); g.fill();
  g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(w - 64, h - 30, 56, 22); g.fillStyle = "#fff"; g.font = "800 16px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("0:" + String(10 + (i * 7) % 49), w - 36, h - 19);
  g.restore();
};
const gamepad = (g: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, col: string) => {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s / 100, s / 100); g.lineJoin = "round";
  g.beginPath(); g.moveTo(-70, -26); g.lineTo(70, -26); g.bezierCurveTo(105, -26, 118, 40, 92, 52); g.bezierCurveTo(70, 62, 52, 22, 30, 22); g.lineTo(-30, 22); g.bezierCurveTo(-52, 22, -70, 62, -92, 52); g.bezierCurveTo(-118, 40, -105, -26, -70, -26); g.closePath();
  g.fillStyle = col; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.fillRect(-62, -6, 30, 9); g.fillRect(-51, -17, 9, 30); for (const [bx, by] of [[46, -12], [62, 2], [46, 14], [30, 2]]) { g.beginPath(); g.arc(bx, by, 7, 0, 7); g.fill(); }
  g.restore();
};
const medal = (g: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, f: number) => {
  if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k); g.rotate(Math.sin(f * 0.08) * 0.05);
  g.fillStyle = "#c0353a"; g.beginPath(); g.moveTo(-r * 0.55, -r * 1.9); g.lineTo(-r * 0.1, -r * 0.6); g.lineTo(r * 0.1, -r * 0.6); g.lineTo(r * 0.55, -r * 1.9); g.closePath(); g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); gr.addColorStop(0, "#fff3b0"); gr.addColorStop(1, "#d6a020"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.lineWidth = 8; g.stroke();
  starPath(g, 0, 0, r * 0.55); g.fillStyle = "#fff6c8"; g.fill(); g.lineWidth = 5; g.stroke(); g.restore();
};

// ======================= SHOTS =======================
// 1 — HOOK. "The biggest leak in gaming history..."  Frame 1: tight on the hotel TV, our Leonida sunset on it and the big GTA 6
//      title; LEAKED stamps across; the camera starts pulling back.
const C1 = F(tDidnt) - 3;
add({
  a: 0, b: C1, plate: "hotel_tv",
  keys: [{ f: 0, at: TVP, z: 3.4, creep: 0 }, { f: 4, dur: C1 - 4, at: TVP, z: 2.3, creep: 0 }],
  kicks: [[F(tLeak) + 1, 0.5]],
  under: (g, v, f) => hotelGrade(g, v, f, 0.7),
  over: (g, v, f) => {
    tvPicture(g, v, f, 1, 0);
    gtaTitle(g, 540, 610, 230, f < 1 ? 0.9 : easeOutBack(clamp01(f / 6), 1.6) * (1 + 0.02 * Math.sin(f * 0.3)));
    if (f >= F(tLeak) - 1) stampW(g, "LEAKED", f, F(tLeak) - 1, C1 + 6, 540, 860, 540, -0.1);
    hoodBack(g, 860, 1820, 0.9);
  },
});
// 2 — "...didn't come from a computer."  A glowing laptop slams shut.
const C2 = F(tIt) - 3;
add({
  a: C1, b: C2, plate: "hotel_w", xfade: 4,
  keys: [{ f: C1, at: [0, 1.0, 1.4], z: 1.3, creep: 0.002 }],
  under: (g, v, f) => hotelGrade(g, v, f, 0.95, [[0, 1.0, 1.4]]),
  over: (g, v, f) => {
    dim(g, 0.35);
    const shut = clamp01((f - F(tComputer) + 2) / 5), open = 1 - shut * shut;
    laptop2d(g, 540, 1040, 640, open, 1 - shut);
    if (shut > 0.95) for (let i = 0; i < 3; i++) puff(g, 540 + (i - 1) * 220, 1045, 90, f - F(tComputer) - 3 - i, 22, "#d8dcef", [(i - 1) * 0.8, -0.6]);
  },
});
// 3 — "It came from a hotel TV."  Back from the TV: the dark room, the TV glowing on the dresser.
const C3 = F(tIn) - 3;
add({
  a: C2, b: C3, plate: "hotel_tv", xfade: 4,
  keys: [{ f: C2, at: [0.15, 1.2, -2.4], z: 1.0, creep: 0 }, { f: C2 + 2, dur: C3 - C2, at: TVP, z: 1.3, creep: 0 }],
  under: (g, v, f) => hotelGrade(g, v, f, 0.85),
  over: (g, v, f) => { tvPicture(g, v, f, 1, 1); hoodBack(g, 820, 1840, 0.75); if (f >= F(tHotel) - 2) pill(g, 540, 330, "A HOTEL TV", f - F(tHotel) + 2, "#5ff0ff"); },
});
// 4 — "In 2022, a British teenager was out on bail for hacking."  The corridor: the hooded teen, hands in pockets; 2022; ON BAIL.
const C4 = F(tPolice) - 3;
add({
  a: C3, b: C4, plate: "corr_w", xfade: 6,
  keys: [{ f: C3, at: [60, 1.15, 4.0], z: 1.6, creep: 0.002 }],
  under: (g, v, f) => nightGrade(g, v, [[60, 2.4, 1], [60, 2.4, 6]], f, 0.4, "255,220,170"),
  cast: (f) => [stand(TEEN, "teen", [60, 0, 4.0], 5, f, [[0, "neutral"], [F(tBail), "nervous"]], [[0, { l: [0.18, -0.15], r: [-0.18, -0.15] }]], { facing: 0 }, { noShadow: true })],
  over: (g, v, f) => {
    bigNum(g, 540, 360, "2022", f - F(t2022));
    if (f >= F(tBritish) - 2 && f < F(tBail) - 2) pill(g, 540, 1500, "BRITISH TEENAGER", f - F(tBritish) + 2, "#5ff0ff");
    if (f >= F(tBail) - 2) pill(g, 540, 1500, "OUT ON BAIL", f - F(tBail) + 2, "#ffd24a");
  },
});
// 5 — "Police had taken his laptop..."  The laptop drops into an evidence bag; the seal zips shut.
const C5 = F(tPut) - 3;
add({
  a: C4, b: C5, plate: "corr_w", xfade: 4,
  keys: [{ f: C4, at: [60, 1.4, 6], z: 1.3, creep: 0.002 }],
  under: (g, v, f) => { nightGrade(g, v, [[60, 2.4, 6]], f, 0.4, "255,220,170"); dim(g, 0.4); },
  over: (g, v, f) => {
    const drop = easeOut(clamp01((f - F(tLaptop) + 6) / 9));
    g.save(); g.beginPath(); g.rect(0, 0, 1080, 1180); g.clip(); laptop2d(g, 540, 380 + drop * 640, 380, 0.0, 0); g.restore();
    evidenceBag(g, 540, 940, 480, clamp01((f - F(tLaptop) - 6) / 8));
  },
});
// 6 — "...and put him in a hotel room for his own safety."  Two officers walk him to room 214; the key card beeps; the door opens.
const C6 = F(tSo) - 3;
add({
  a: C5, b: C6, plate: "corr_door", xfade: 6,
  keys: [{ f: C5, at: [60, 1.3, 12.2], z: 1.1, creep: 0.003 }],
  under: (g, v, f) => { nightGrade(g, v, [[60, 2.4, 11], [60, 2.3, 13.8]], f, 0.45, "255,220,170"); doorSwing(g, v, 59.45, 60.55, 2.15, 13.97, clamp01((f - F(tHotel2) - 4) / 14), "#6a4a3a", "120,170,255"); },
  over: (g, v, f) => { if (f >= F(tSafety) - 2) pill(g, 540, 330, "FOR HIS OWN SAFETY", f - F(tSafety) + 2, "#5ff0ff"); },
  cast: (f) => [
    stand(COP(0), "cop0", [59.5, 0, 12.0], 31, f, [[0, "neutral"]], [[0, {}], [F(tHotel2), { r: [-0.45, -0.75] }]], { facing: 1 }, { noShadow: true }),
    stand(TEEN, "teen", [60.02, 0, 12.55], 5, f, [[0, "nervous"]], [[0, { l: [0.18, -0.15], r: [-0.18, -0.15] }]], { facing: 0 }, { noShadow: true }),
    stand(COP(1), "cop1", [60.55, 0, 11.95], 32, f, [[0, "neutral"], [F(tSafety), "smile"]], [[0, {}]], { facing: -1 }, { noShadow: true }),
  ],
});
// 7 — "So he used what was there. The TV. A streaming stick. And a brand-new phone."  Three pop-ins in the dark room.
const C7 = F(tFrom) - 3;
add({
  a: C6, b: C7, plate: "hotel_tv", xfade: 4,
  keys: [{ f: C6, at: [0.1, 1.15, -2.4], z: 1.15, creep: 0.003 }],
  under: (g, v, f) => hotelGrade(g, v, f, f < F(tTV2) ? 0.95 : 0.85),
  over: (g, v, f) => {
    const on = clamp01((f - F(tTV2) + 1) / 6), r = tvPicture(g, v, f, on, on);
    const sx = r.x1 + 10, sy = r.y1 - 30, ins = easeOut(clamp01((f - F(tStreaming) + 3) / 8));
    if (f >= F(tStreaming) - 3) streamStick(g, sx + (1 - ins) * 180, sy, 120, ins >= 1 ? 0.5 + 0.5 * Math.sin(f * 0.4) : 0);
    if (f >= F(tBrand) - 4) { const lid = easeOut(clamp01((f - F(tBrand) + 4) / 8)), rise = easeOutBack(clamp01((f - F(tBrand) - 2) / 9), 1.5); phoneBox(g, 230, 1640, 240, lid); if (rise > 0) { phone2d(g, 230, 1640 - rise * 250, 240, -0.08, "glow", f); sparkle(g, 320, 1380, 46, f - F(tPhone)); } }
    const tag = f >= F(tBrand) - 2 ? ["BRAND-NEW PHONE", F(tBrand) - 2] : f >= F(tStreaming) - 2 ? ["STREAMING STICK", F(tStreaming) - 2] : f >= F(tTV2) - 2 ? ["THE TV", F(tTV2) - 2] : null;
    if (tag) pill(g, 540, 330, tag[0] as string, f - (tag[1] as number), "#5ff0ff");
    hoodBack(g, 840, 1880, 0.7);
  },
});
// 8 — "From that tiny room, he broke into Rockstar's..."  The teen on the bed, lit blue by the TV, thumbs flying on the phone.
const C8 = F(tPrivate) - 3;
add({
  a: C7, b: C8, plate: "hotel_w", xfade: 4,
  keys: [{ f: C7, at: [0, 0.95, 1.3], z: 1.3, creep: 0.004 }, { f: F(tBroke) - 4, dur: 10, at: [0, 1.05, 1.3], z: 1.75, creep: 0.004, punch: 0.01, pn: 8 }],
  under: (g, v, f) => hotelGrade(g, v, f, 0.95, [[0, 1.0, 1.2]]),
  cast: (f) => [stand(TEEN, "teen", [0, 0, 1.25], 5, f, [[0, "neutral"], [F(tBroke), "grit"]], [[0, { l: [0.12, -0.45], r: [-0.12, -0.45] }]], { facing: 0, mode: "sit" }, { noShadow: true })],
  over: (g, v, f) => {
    const hp = v.w([0, 0.6, 1.1]), m = v.ppm([0, 0.6, 1.1]);
    phone2d(g, hp[0], hp[1], m * 0.2, 0, "chat", f);
    for (let i = 0; i < 3; i++) { const age = (f * 1.3 + i * 5) % 14; g.save(); g.globalAlpha = 1 - age / 14; g.fillStyle = "#5ff0ff"; g.font = `900 ${m * 0.06}px 'Montserrat'`; g.fillText(["01", "10", "</>"][i], hp[0] + (i - 1) * m * 0.18, hp[1] - m * 0.15 - age * 6); g.restore(); }
    if (f >= F(tBroke) - 2) pill(g, 540, 330, "HACKING IN", f - F(tBroke) + 2, "#ff3aa0");
  },
});
// 9 — "...private chat... and found something nobody outside the studio had ever seen."  The studio chat unlocks; a folder glows.
const C9 = F(t90) - 3;
add({
  a: C8, b: C9, plate: "hotel_tv", xfade: 4,
  keys: [{ f: C8, at: TVP, z: 1.6, creep: 0.002 }],
  under: (g, v, f) => { hotelGrade(g, v, f, 0.9); dim(g, 0.55); },
  over: (g, v, f) => {
    const k = easeOutBack(clamp01((f - C8) / 8), 1.5);
    g.save(); g.translate(540, 900); g.scale(k, k); g.translate(-540, -900);
    chatWin(g, 540, 900, 900, 760, f, clamp01((f - F(tChat)) / 6), clamp01((f - F(tFound) + 2) / 8));
    g.restore();
    if (f >= F(tNobody) - 2) pill(g, 540, 330, "NEVER SEEN BEFORE", f - F(tNobody) + 2, "#ffd24a");
  },
});
// 10 — "Ninety secret clips. Of GTA 6."  A wall of clip tiles flips in; the counter runs to 90; the GTA 6 title slams on.
const C10 = F(tHe) - 3;
add({
  a: C9, b: C10, plate: "hotel_tv", xfade: 4,
  keys: [{ f: C9, at: TVP, z: 1.6, creep: 0.002 }],
  under: (g, v, f) => { dim(g, 0.85); },
  over: (g, v, f) => {
    const cols = 4, rows = 5, w = 230, h = 150, gx = 540 - (cols * w + (cols - 1) * 16) / 2;
    for (let i = 0; i < cols * rows; i++) { const c = i % cols, r = Math.floor(i / cols), t0 = C9 + ((r * cols + c) * 0.9) | 0; clipTile(g, gx + c * (w + 16), 300 + r * (h + 16), w, h, i, easeOutBack(clamp01((f - t0) / 6), 1.8)); }
    const n = Math.min(90, Math.round(90 * clamp01((f - C9) / (F(tClips) - C9 + 6))));
    pill(g, 540, 220, n + " SECRET CLIPS", 99, "#ff3aa0");
    if (f >= F(tGTA) - 2) { g.save(); g.fillStyle = `rgba(20,10,40,${0.45 * clamp01((f - F(tGTA) + 2) / 4)})`; g.fillRect(0, 0, 1080, 1920); g.restore(); flash(g, f - F(tGTA) + 1, 0.3); gtaTitle(g, 540, 820, 250, easeOutBack(clamp01((f - F(tGTA) + 2) / 6), 2.2)); }
  },
});
// 11 — "He posted all of them online."  The tiles stream up into a phone; a share counter explodes.
const C11 = F(tThen) - 3;
add({
  a: C10, b: C11, plate: "hotel_tv", xfade: 4,
  keys: [{ f: C10, at: TVP, z: 1.6, creep: 0.002 }],
  under: (g) => { dim(g, 0.8); },
  over: (g, v, f) => {
    phone2d(g, 540, 820, 720, 0, "glow", f);
    for (let i = 0; i < 14; i++) { const u = clamp01((f - C10 - i * 1.2) / 10); if (u <= 0 || u >= 1) continue; const sx = 120 + (i * 137) % 840, sy = 1500; clipTile(g, sx + (540 - sx) * easeOut(u) - 60, sy + (760 - sy) * easeOut(u), 120, 80, i, 1 - u * 0.6); }
    const n = Math.round(1000000 * easeOut(clamp01((f - F(tOnline) + 4) / 14)) ** 2);
    if (f >= F(tPosted)) pill(g, 540, 330, "POSTED ONLINE", f - F(tPosted), "#ff3aa0");
    if (f >= F(tOnline) - 4) counter(g, 540, 820, n.toLocaleString("en-US"), easeOutBack(clamp01((f - F(tOnline) + 4) / 6), 1.8), "#ffffff", 96);
  },
});
// 12a — "Then he messaged Rockstar's staff..."  The studio floor: staff at their desks freeze as every screen on the wall goes red.
const C12a = F(tPay) - 3;
const STAFF_P: V3[] = [[121.25, 0, 2.15], [118.25, 0, 2.15], [119.75, 0, 3.95], [122.75, 0, 3.95], [116.75, 0, 3.95], [124.15, 0, 2.15], [115.35, 0, 2.15]];
const redWall = (g: CanvasRenderingContext2D, v: View, f: number, k: number, msg: string[]) => {
  if (k <= 0) return;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x0 = 120 - 2.75 + c * 1.4, y0 = 1.3 + r * 0.72, A0 = v.w([x0 + 1.3, y0 + 0.64, 5.89]), B0 = v.w([x0, y0, 5.89]);
    const x = Math.min(A0[0], B0[0]), y = Math.min(A0[1], B0[1]), w = Math.abs(B0[0] - A0[0]), h = Math.abs(B0[1] - A0[1]);
    const on = clamp01(k * 3 - (r * 4 + c) * 0.12); if (on <= 0) continue;
    g.save(); g.globalAlpha = on; g.fillStyle = (Math.floor(f / 4) % 2) ? "#b01a2a" : "#d0202f"; g.fillRect(x, y, w, h); g.restore();
  }
  const c = v.w([120, 2.38, 5.89]), sz = Math.min(130, v.ppm([120, 2.38, 5.89]) * 0.5), kk = easeOutBack(clamp01(k * 2), 1.6);
  g.save(); g.translate(c[0], c[1]); g.scale(kk, kk); g.font = `900 ${sz}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = sz * 0.2; g.strokeStyle = "#140a24";
  msg.forEach((m, i) => { const yy = (i - (msg.length - 1) / 2) * sz * 1.1; g.strokeText(m, 0, yy); g.fillStyle = "#ffffff"; g.fillText(m, 0, yy); }); g.restore();
};
add({
  a: C11, b: C12a, plate: "studio_w", xfade: 6,
  keys: [{ f: C11, at: [120, 1.55, 3.0], z: 1.0, creep: 0.003 }],
  under: (g, v, f) => nightGrade(g, v, [[120, 2.3, 5.8]], f, 0.35, "150,200,255"),
  cast: (f) => [
    ...STAFF_P.map((P, i) => stand(STAFF(i), "s" + i, P, 90 + i, f, [[0, "smile"], [F(tMessaged) + 2 + (i % 3) * 2, "shock"]], [[0, { l: [0.3, -0.45], r: [-0.3, -0.45] }]], { facing: (P[0] > 120 ? -1 : 1) as -1 | 1, mode: "sit" }, { noShadow: true, clip: above(113, 127, 0.77, P[2] - 0.45) })),
    ...([[120.95, 0, 0.95], [119.05, 0, 0.95], [120.0, 0, 0.75]] as V3[]).map((P, i) => stand(STAFF(i + 3), "st" + i, P, 120 + i, f, [[0, "smile"], [F(tMessaged) + 1 + i * 2, "shock"]], [[0, { l: [0.3, -0.4], r: [-0.3, -0.4] }], [F(tMessaged) + 1 + i * 2, { l: [0.5, -1.05], r: [-0.5, -1.05] }]], { facing: (i === 0 ? -1 : i === 1 ? 1 : 0) as -1 | 0 | 1 }, { noShadow: true })),
  ],
  over: (g, v, f) => { redWall(g, v, f, clamp01((f - F(tMessaged)) / 10), ["HACKED"]); if (f >= F(tStaff) - 2) pill(g, 540, 330, "TO THE STUDIO'S STAFF", f - F(tStaff) + 2, "#ff3aa0"); },
});
// 12b — "...pay up... or the game's code is next."  Close on the screen wall: the threat on every screen.
const C12 = F(tPolice2) - 3;
add({
  a: C12a, b: C12, plate: "studio_mon", xfade: 4,
  keys: [{ f: C12a, at: [120, 2.35, 5.9], z: 1.1, creep: 0.006 }],
  kicks: [[F(tCode), 0.5]],
  under: (g, v, f) => nightGrade(g, v, [[120, 2.3, 5.8]], f, 0.3, "255,90,110"),
  over: (g, v, f) => { redWall(g, v, f, 1, f < F(tCode) - 2 ? ["PAY UP..."] : ["OR THE CODE", "IS NEXT!"]); },
});
// 13 — "Police didn't have to look very far. He was still in the hotel."  Two officers knock on 214; the door opens; BUSTED.
const C13 = F(tJudge) - 4;
add({
  a: C12, b: C13, plate: "corr_door", xfade: 6,
  keys: [{ f: C12, at: [60, 1.3, 12.2], z: 1.1, creep: 0.003 }],
  under: (g, v, f) => { nightGrade(g, v, [[60, 2.4, 11], [60, 2.3, 13.8]], f, 0.45, "255,220,170"); doorSwing(g, v, 59.45, 60.55, 2.15, 13.97, clamp01((f - F(tStill)) / 10), "#6a4a3a", "120,170,255"); },
  cast: (f) => [
    stand(COP(0), "cop0", [59.45, 0, 12.4], 31, f, [[0, "neutral"], [F(tStill), "smile"]], [[0, {}], [F(tFar) - 6, { r: [-0.45, -1.0] }], [F(tFar) + 6, {}]], { facing: 1 }, { noShadow: true }),
    stand(COP(1), "cop1", [60.6, 0, 12.25], 32, f, [[0, "neutral"], [F(tStill), "grin"]], [[0, {}]], { facing: -1 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    if (f >= F(tHotel3)) { const age = f - F(tHotel3); g.save(); g.fillStyle = `rgba(${Math.floor(f / 3) % 2 ? "200,20,40" : "30,60,220"},${0.22 * clamp01(age / 3)})`; g.fillRect(0, 0, 1080, 1920); g.restore();
      g.save(); g.translate(540, 760); const k = easeOutBack(clamp01(age / 6), 2.4); g.scale(k, k); g.rotate(-0.05); g.font = "italic 900 210px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 40; g.strokeStyle = "#140a24"; g.strokeText("BUSTED", 0, 0); g.fillStyle = "#e8323e"; g.fillText("BUSTED", 0, 0); g.restore(); }
  },
});
// 14 — "A judge ordered him held in a secure hospital, with no end date... because he said he'd go straight back to hacking."
const C14 = F(tYear) - 4;
add({
  a: C13, b: C14, plate: "court", xfade: 6,
  keys: [{ f: C13, at: [180, 1.8, 4.2], z: 1.2, creep: 0.0012 }],
  cast: (f) => [stand(JUDGE, "judge", [180, 0, 4.0], 61, f, [[0, "neutral"], [F(tOrdered), "stern"]], [[0, {}]], { facing: 0, talk: talkAt(f, [[F(tOrdered), F(tSecure) + 4]], 3) }, { clip: above(176, 184, 1.18, 3.34), noShadow: true })],
  over: (g, v, f) => {
    const gp = v.w([180.55, 1.2, 3.4]), m = v.ppm([180.55, 1.2, 3.4]), H = F(tOrdered) + 4;
    gavel(g, gp[0], gp[1], m * 0.45, f < H - 4 ? 0 : f < H ? (f - H + 4) / 4 : 1);
    if (f >= F(tSecure) - 2 && f < F(tEnd) - 4) pill(g, 540, 1500, "SECURE HOSPITAL", f - F(tSecure) + 2, "#5ff0ff");
    if (f >= F(tEnd) - 4) { const pg = Math.floor(Math.max(0, f - F(tEnd) + 4) / 2.5); calendar(g, 860, 1010, 170, "DAY " + (1 + pg * 37), "DAY " + Math.max(1, 1 + (pg - 1) * 37), ((f - F(tEnd)) % 2.5) / 2.5, easeOutBack(clamp01((f - F(tEnd) + 4) / 6), 1.8)); pill(g, 540, 1500, "NO END DATE", f - F(tEnd) + 4, "#ffd24a"); }
    if (f >= F(tStraight) - 2) pill(g, 540, 1610, "\"STRAIGHT BACK TO HACKING\"", f - F(tStraight) + 2, "#ff3aa0");
  },
});
// 15 — "A year later, the real trailer came out. Ninety million views in twenty-four hours. A world record."  The hotel billboard.
const C15 = F(tAnd) - 3;
const bbQuad = (v: View) => [v.w([253.55, 20.7, 11.3]), v.w([253.55, 20.7, 19.7]), v.w([253.55, 15.3, 19.7]), v.w([253.55, 15.3, 11.3])] as P2[];
add({
  a: C14, b: C15, plate: "leo_bb", xfade: 6,
  keys: [{ f: C14, at: [253.6, 12.6, 15.5], z: 1.0, creep: 0.003 }],
  kicks: [[F(tRecord) + 2, 0.5]],
  over: (g, v, f) => {
    const q = bbQuad(v), on = clamp01((f - F(tTrailer) + 2) / 6), x0 = Math.min(...q.map((p) => p[0])), x1 = Math.max(...q.map((p) => p[0])), y0 = Math.min(...q.map((p) => p[1])), y1 = Math.max(...q.map((p) => p[1]));
    g.save(); g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip(); g.fillStyle = "#05060c"; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (on > 0) { g.globalAlpha = on; plateIn(g, "leo_w", x0, y0, x1 - x0, y1 - y0, 1.2, 0.5, 0.4); gtaTitle(g, (x0 + x1) / 2, (y0 + y1) / 2 - (y1 - y0) * 0.12, (x1 - x0) * 0.2, 1); g.fillStyle = "#fff"; g.font = `900 ${(x1 - x0) * 0.07}px 'Montserrat'`; g.textAlign = "center"; g.fillText("TRAILER 1", (x0 + x1) / 2, y1 - (y1 - y0) * 0.14); }
    g.restore();
    if (f >= F(t90m) - 4) { const n = Math.round(90000000 * easeOut(clamp01((f - F(t90m) + 4) / 16))); counter(g, 540, 1140, n.toLocaleString("en-US"), easeOutBack(clamp01((f - F(t90m) + 4) / 6), 1.8), "#ffffff", 108); }
    if (f >= F(tViews) - 2) pill(g, 540, 1500, f >= F(t24) - 2 ? "VIEWS IN 24 HOURS" : "VIEWS", f - F(tViews) + 2, "#5ff0ff");
    if (f >= F(tWorld) - 2) { medal(g, 540, 1720, 105, easeOutBack(clamp01((f - F(tWorld) + 2) / 8), 1.8), f); confetti(g, 540, 1650, 1, f - F(tRecord)); }
  },
});
// 16 — "And this month, millions of people will finally play it."  Leonida at sunset: the title, the date, gamepads everywhere.
const C16 = F(tBut) - 3;
add({
  a: C15, b: C16, plate: "leo_w", xfade: 6,
  keys: [{ f: C15, at: [245, 2.6, 30], z: 1.0, creep: 0.004 }],
  over: (g, v, f) => {
    gtaTitle(g, 540, 560, 240, easeOutBack(clamp01((f - C15 - 2) / 7), 1.8));
    if (f >= F(tMonth) - 2) pill(g, 540, 760, "NOVEMBER 19", f - F(tMonth) + 2, "#5ff0ff");
    for (let i = 0; i < 20; i++) { const row = Math.floor(i / 5), col = i % 5, t0 = F(tMillions) - 4 + ((col * 3 + row * 2) % 20) * 0.8; if (f < t0) continue; const x = 120 + col * 210 + (row % 2) * 40, y = [960, 1110, 1490, 1650][row], k = easeOutBack(clamp01((f - t0) / 6), 2); gamepad(g, x, y + Math.sin(f * 0.15 + i) * 8, 105 * k, (i % 5 - 2) * 0.12, ["#ff3aa0", "#5ff0ff", "#ffd24a", "#ffffff"][i % 4]); }
  },
});
// 17 — "But the first leak... came from a hotel TV."  The hotel TV, one last time; it clicks off and the room goes dark.
add({
  a: C16, b: TOTAL, plate: "hotel_tv", xfade: 6,
  keys: [{ f: C16, at: TVP, z: 1.9, creep: 0 }, { f: C16 + 2, dur: TOTAL - C16, at: TVP, z: 1.25, creep: 0 }],
  under: (g, v, f) => hotelGrade(g, v, f, f < F(tTV4) + 3 ? 0.85 : 1),
  over: (g, v, f) => {
    const off = clamp01((f - F(tTV4) - 1) / 5); tvPicture(g, v, f, off < 1 ? 1 - off * 0.995 : 0, 1);
    if (off >= 1) { g.save(); g.fillStyle = `rgba(0,0,0,${0.55 * clamp01((f - F(tTV4) - 6) / 8)})`; g.fillRect(0, 0, 1080, 1920); g.restore(); }
    hoodBack(g, 840, 1880, 0.7);
  },
});

// ---------------- the HUD (every frame after the hook): our GTA-6 tag, top left; a wanted meter, top right ----------------
const starsAt = (f: number) => f < F(tBail) ? 0 : f < F(tBroke) ? 1 : f < F(t90) ? 2 : f < F(tPosted) ? 3 : f < F(tPay) ? 4 : f < F(tHotel3) + 45 ? 5 : 0;
const starFillAt = (f: number, i: number) => { const t = [F(tBail), F(tBroke), F(t90), F(tPosted), F(tPay)][i]; return clamp01((f - t) / 5); };
export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (g: CanvasRenderingContext2D, f: number) => {
  if (f < C1 - 2 || f >= TOTAL) return;
  const a = clamp01((f - C1 + 2) / 6);
  g.save(); g.globalAlpha = a;
  // the tag
  g.save(); g.translate(40, 70); g.beginPath(); g.roundRect(0, 0, 250, 74, 14); g.fillStyle = "rgba(20,10,36,0.82)"; g.fill(); g.lineWidth = 4; g.strokeStyle = "#ff3aa0"; g.stroke(); g.restore();
  gtaTitle(g, 128, 108, 46, 1, "GTA 6", 0); g.font = "900 30px 'Montserrat'"; g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("LEAK", 208, 109);
  // the wanted meter (empty outlines, filling one by one; flashing red/blue at five)
  const n = starsAt(f), five = n === 5, blink = five && Math.floor(f / 4) % 2 === 0;
  for (let i = 0; i < 5; i++) {
    const x = 1040 - (4 - i) * 70 - 30, y = 108, fill = n > i ? starFillAt(f, i) : 0, pop = fill > 0 && fill < 1 ? 1 + 0.5 * Math.sin(fill * Math.PI) : 1;
    g.save(); g.translate(x, y); g.scale(pop, pop); starPath(g, 0, 0, 28); g.lineWidth = 7; g.strokeStyle = "#140a24"; g.stroke();
    g.fillStyle = fill > 0 ? (five ? (blink ? "#ff3a4a" : "#4a7aff") : "#ffffff") : "rgba(255,255,255,0.12)"; g.globalAlpha = a * (fill > 0 ? Math.max(0.35, fill) : 1); g.fill(); g.restore();
  }
  g.restore();
};
