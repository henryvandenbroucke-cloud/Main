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
const tBroke = A("broke"), tBank = A("bank"), tMonte = A("monte"), tAnd0 = A("and", tMonte), tMonth = A("month"), tSingle = A("single"), tCoin = A("coin");
const tInstead = A("instead"), tHired = A("hired"), tSix = A("six"), tClerks = A("clerks"), tEach = A("each"), tRoulette = A("roulette"), tWrote = A("wrote"), tEvery = A("every", tWrote), tAll = A("all", tEvery), tEvery2 = A("every", tAll);
const tBecause = A("because"), tJoseph = A("joseph"), tJagger = A("jagger", tJoseph), tMill = A("mill"), tYorkshire = A("yorkshire"), tKnew = A("knew"), tMachines = A("machines");
const tNothing = A("nothing"), tSpins = A("spins"), tNot = A("not", tSpins), tMill2 = A("mill", tNot), tNot2 = A("not", tMill2), tRoulette2 = A("roulette", tNot2);
const tHe = A("he", tRoulette2), tRight = A("right"), tFive = A("five"), tRandom = A("random"), tBut = A("but", tRandom), tSixth = A("sixth"), tNine = A("nine", tSixth), tOften = A("often");
const tSo = A("so", tOften), tBetting = A("betting"), tWheel3 = A("wheel", tBetting), tNine2 = A("nine", tWheel3), tDay = A("day", tNine2), tWinning = A("winning");
const tStory = A("story"), tWalked = A("walked"), tTwo = A("two", tWalked), tMillion = A("million", tTwo), tFrancs = A("francs"), tCasino = A("casino", tFrancs), tPanicked = A("panicked");
const tSo2 = A("so", tPanicked), tNight = A("night", tSo2), tSecretly = A("secretly"), tSwapped = A("swapped"), tTables = A("tables", tSwapped);
const tNext = A("next", tTables), tJagger2 = A("jagger", tNext), tLosing = A("losing"), tUntil = A("until"), tNoticed = A("noticed");
const tHis = A("his", tNoticed), tLucky = A("lucky"), tTiny = A("tiny"), tScratch = A("scratch"), tHe2 = A("he", tScratch), tFound = A("found"), tAnother = A("another"), tWinning2 = A("winning", tAnother);
const tIn = A("in", tWinning2), tRebuilt = A("rebuilt"), tEveryW = A("every", tRebuilt), tLopsided = A("lopsided"), tAgain = A("again", tLopsided);
const tAnd2 = A("and", tAgain), tQuit = A("quit"), tAhead = A("ahead"), tHome = A("home"), tYorkshire2 = A("yorkshire", tHome), tBought = A("bought"), tHouses = A("houses");
const tHe3 = A("he", tHouses), tLuck = A("luck", tHe3), tHe4 = A("he", tLuck), tNotebook = A("notebook");

// ---------------- cast ----------------
const JAGGER = O({ jacket: "#6b4a2e", pants: "#3a3530", hat: "tophat", moustache: "#5a3b2a", buttons: "#e8c45a" });
const CLERK = (i: number) => O({ jacket: ["#3a3f52", "#4a3f35", "#2f4a3f", "#3f3550", "#504a3a", "#35455a"][i], pants: "#2b2b35", hat: "fedora", moustache: i % 3 === 1 ? "#5a3b2a" : undefined, buttons: "#c9ccd2" });
const DIRECTOR = O({ jacket: "#22202a", pants: "#22202a", hat: "tophat", moustache: "#e9e6e0", build: "stout", buttons: "#e8c45a" });
const PORTER = (i: number) => O({ jacket: i ? "#7a2a2a" : "#2a4a7a", pants: "#2b2b35", hat: "cap", cap: i ? "#7a2a2a" : "#2a4a7a", buttons: "#e8c45a" });
const WORKMAN = O({ jacket: "#5a4a3a", pants: "#3a3530", hat: "cap", cap: "#3a3530" });

// Monte Carlo staging (camera looks +z, +x is screen-left): Jagger stands at the front of the middle table, facing us
const JAG_P: V3 = [180.1, 0, 1.45];
const WHEEL: V3 = [179.25, 0.965, 2.4];
const MC_POOLS: V3[] = [[178, 4.8, 2.4], [182, 4.8, 2.4]];
const mcGrade = (g: CanvasRenderingContext2D, v: View, f: number, k = 0.3) => nightGrade(g, v, MC_POOLS, f, k, "255,210,140");
type Ex = [number, Expr][];
const jag = (f: number, ex: Ex = [[0, "smile"]], hands: [number, Hands][] = [[0, {}]], P: V3 = JAG_P, extra: Partial<FrontOpts> = {}) =>
  stand(JAGGER, "jag", P, 7, f, ex, hands, { facing: 0, ...extra }, { noShadow: true });
/** the roulette wheel in the close plate, as a live 2D wheel laid exactly over the 3D one */
const wheelAt = (v: View, P: V3 = WHEEL, R = 0.4) => {
  const c = v.w(P), l = v.w([P[0] + R, P[1], P[2]]), r = v.w([P[0] - R, P[1], P[2]]), n = v.w([P[0], P[1], P[2] - R]), fa = v.w([P[0], P[1], P[2] + R]);
  const rad = Math.hypot(l[0] - r[0], l[1] - r[1]) / 2, tilt = Math.max(0.25, Math.abs(n[1] - fa[1]) / 2 / rad);
  return { x: c[0], y: c[1], r: rad, tilt };
};
const spinWheel = (g: CanvasRenderingContext2D, v: View, f: number, f0: number, opts: { wobble?: number; ballStop?: number; scratch?: number } = {}) => {
  const W = wheelAt(v), t = Math.max(0, f - f0), rotor = t * 0.12, wob = opts.wobble ?? 0;
  const bs = opts.ballStop ?? 1e9, bt = Math.min(t, bs - f0), ball = -bt * 0.3 + (t > bs - f0 ? rotor - (bs - f0) * 0.12 : 0), ballR = t > bs - f0 ? 0.8 : 0.96 - 0.12 * clamp01((bt - (bs - f0 - 18)) / 18);
  g.save(); g.translate(W.x + Math.sin(f * 0.55) * wob * W.r * 0.03, W.y); g.rotate(Math.sin(f * 0.55) * wob * 0.05);
  rwheel(g, 0, 0, W.r * 0.95, W.tilt, rotor, ball, ballR);
  if ((opts.scratch ?? 0) > 0) { const a = rotor + 0.6; g.save(); g.scale(1, W.tilt); g.globalAlpha = opts.scratch!; g.strokeStyle = "#fff6c8"; g.lineWidth = 5; g.shadowColor = "#ffd24a"; g.shadowBlur = 18; g.beginPath(); for (let i = 0; i < 5; i++) { const rr = W.r * (0.98 + (i % 2 ? 0.04 : -0.02)), aa = a + i * 0.035; i ? g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : g.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } g.stroke(); g.restore(); }
  g.restore();
  return W;
};
/** a cog (output px) */
const cog = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, col = "#c9ccd2") => {
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r; g.lineTo(Math.cos(a - 0.06) * rr, Math.sin(a - 0.06) * rr); g.lineTo(Math.cos(a + 0.06) * rr, Math.sin(a + 0.06) * rr); }
  g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = Math.max(3, r * 0.07); g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.28, 0, 7); g.fillStyle = shadeC(col); g.fill(); g.stroke(); g.restore();
};
const shadeC = (c: string) => c === "#c9ccd2" ? "#8a8f99" : "#7a5a2a";
/** a mill flywheel with a lopsided hub: the rim draws an off-centre path against a dashed perfect circle */
const flywheel = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, wob: number, ghost: number) => {
  if (ghost > 0) { g.save(); g.globalAlpha = ghost; g.setLineDash([18, 14]); g.strokeStyle = "#ffd24a"; g.lineWidth = 7; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore(); }
  const ox = Math.cos(rot) * wob * r * 0.07, oy = Math.sin(rot) * wob * r * 0.07;
  g.save(); g.translate(x + ox, y + oy); g.rotate(rot);
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.arc(0, 0, r * 0.84, 0, 7, true); g.fillStyle = "#3a3540"; g.fill("evenodd"); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.lineWidth = r * 0.07; g.strokeStyle = INK; g.stroke(); g.lineWidth = r * 0.045; g.strokeStyle = "#5a5560"; g.stroke(); }
  g.beginPath(); g.arc(r * 0.06 * wob, 0, r * 0.14, 0, 7); g.fillStyle = "#c9a24a"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.restore();
};
/** a chip dropped onto a spot (output px), falling in from above */
const dropChip = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, col = "#c0353a") => {
  if (age < 0) return; const u = easeOutBack(clamp01(age / 6), 1.6), yy = y - (1 - clamp01(age / 5)) * 160;
  g.save(); g.translate(x, yy); g.scale(u, u); chipStack(g, 0, 0, s, 2, col); g.restore();
};

// 1 — HOOK. "A man broke the bank at Monte Carlo."  Frame 1: tight on the spinning wheel and ball; the camera snaps back.
const C1 = F(tAnd0) - 3;
add({
  a: 0, b: C1, plate: "mc_cu",
  keys: [{ f: 0, at: WHEEL, z: 2.4, creep: 0 }, { f: 5, dur: 14, at: [179.3, 1.0, 2.4], z: 1.15, creep: 0.003 }],
  kicks: [[5, 0.6]],
  under: (g, v, f) => mcGrade(g, v, f),
  over: (g, v, f) => {
    spinWheel(g, v, f + 30, 0, { ballStop: F(tBank) + 30 });
    if (f >= F(tBroke) - 2) label(g, 540, 360, "BROKE THE BANK", f - F(tBroke) + 2);
    if (f >= F(tMonte) - 2) counter(g, 540, 540, "MONTE CARLO", easeOutBack(clamp01((f - F(tMonte) + 2) / 7), 2), "#ffd24a", 104);
  },
});
// 2 — "And for the first month, he didn't bet a single coin."  (Jagger at the table, arms folded; he flips a coin and pockets it)
const C2 = F(tInstead) - 3;
add({
  a: C1, b: C2, plate: "mc_w", xfade: 4,
  keys: [{ f: C1, at: [180.1, 1.35, 1.45], z: 2.3, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => [jag(f, [[0, "smile_closed"], [F(tSingle), "smile"]], [[0, { l: [0.25, -0.45], r: [-0.25, -0.45] }], [F(tSingle) - 6, { r: [-0.45, -0.85] }], [F(tCoin) + 8, { r: [-0.3, -0.2] }]])],
  over: (g, v, f) => {
    calendar(g, 870, 360, 150, f < F(tMonth) + 6 ? "DAY 1" : "DAY " + Math.min(30, 1 + Math.floor((f - F(tMonth) - 6) / 1.2)), null, 0, easeOutBack(clamp01((f - C1 - 2) / 6), 1.8));
    const hp = v.w([179.65, 1.62, 1.45]), u = clamp01((f - F(tSingle) + 2) / 14);
    if (u > 0 && u < 1) coin2(g, hp[0], hp[1] - Math.sin(u * Math.PI) * 260, 34, "shilling", u * 14);
  },
});
// 3 — "Instead, he hired six clerks. Each one sat at a roulette wheel and wrote down every number, all day, every day."
const C3 = F(tBecause) - 3;
const CLK: V3[] = [181.12, 180.67, 180.22, 179.78, 179.33, 178.88].map((x) => [x, 0, 1.55] as V3);
add({
  a: C2, b: C3, plate: "mc_w", xfade: 4,
  keys: [{ f: C2, at: [180, 1.25, 1.55], z: 1.0, creep: 0.0015 }],
  kicks: [[F(tSix) + 1, 0.3]],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => CLK.map((P, i) => { const t0 = F(tSix) - 6 + i * 3; if (f < t0) return null; const a = stand(CLERK(i), "c" + i, P, 81 + i, f, [[0, "neutral"], [F(tWrote), "stern"]], [[0, { r: [-0.3, -0.5], l: [0.25, -0.55] }]], { facing: 0 }, { noShadow: true }); a.hop = 0.12 * Math.max(0, 1 - (f - t0) / 6); return a; }).filter(Boolean) as Actor[],
  over: (g, v, f) => {
    if (f >= F(tSix) - 2) counter(g, 300, 330, "× 6", easeOutBack(clamp01((f - F(tSix) + 2) / 6), 2), "#ffd24a", 130);
    CLK.forEach((P, i) => { if (f < F(tWrote) - 6 + i * 2) return; const hp = v.w([P[0], 0.92, P[2] - 0.1]), m = v.ppm(P); tallyBook(g, hp[0], hp[1], m * 0.22, Math.floor(Math.max(0, f - F(tWrote) - i * 2) / 2.2), -0.15); });
    if (f >= F(tAll) - 2) calendar(g, 800, 330, 140, "DAY " + Math.max(1, Math.floor((f - F(tAll)) / 2) + 1), null, 0, easeOutBack(clamp01((f - F(tAll) + 2) / 6), 1.8));
  },
});
// 4 — "Because Joseph Jagger was a mill engineer from Yorkshire, and he knew something about machines."  (the mill; cogs turn round his head)
const C4 = F(tNothing) - 3;
add({
  a: C3, b: C4, plate: "mill", xfade: 6,
  keys: [{ f: C3, at: [240, 1.4, 1.4], z: 1.9, creep: 0.004 }],
  under: (g) => warmGrade(g),
  cast: (f) => [jag(f, [[0, "smile"], [F(tKnew), "grin"]], [[0, { r: [-0.3, -0.4] }], [F(tKnew), { r: [-0.35, -0.95] }]], [240, 0, 1.4])],
  over: (g, v, f) => {
    if (f >= F(tJoseph) - 2 && f < F(tMachines) - 4) label(g, 540, 330, "JOSEPH JAGGER", f - F(tJoseph) + 2);
    if (f >= F(tMill) - 2 && f < F(tMachines) - 4) label(g, 540, 430, "MILL ENGINEER · YORKSHIRE", f - F(tMill) + 2);
    if (f >= F(tMachines) - 4) { const k = easeOutBack(clamp01((f - F(tMachines) + 4) / 7), 1.6); const cg = (x: number, y: number, r: number, sp: number, col: string) => { g.save(); g.translate(x, y); g.scale(k, k); cog(g, 0, 0, r, f * sp, col); g.restore(); };
      cg(130, 760, 78, 0.08, "#c9ccd2"); cg(210, 640, 48, -0.12, "#e8c45a"); cg(955, 820, 64, -0.1, "#c9ccd2"); cg(900, 700, 40, 0.14, "#e8c45a"); }
  },
});
// 5a — "Nothing spins perfectly. Not a mill wheel..."  (a big mill flywheel: its hub is a hair off-centre, the rim wobbles off the perfect circle)
const C5a = F(tNot2) - 3;
add({
  a: C4, b: C5a, plate: "mill", xfade: 4,
  keys: [{ f: C4, at: [240, 1.4, 3.0], z: 1.3, creep: 0.003 }],
  under: (g) => warmGrade(g),
  over: (g, v, f) => { dim(g, 0.4); flywheel(g, 540, 860, 330, (f - C4) * 0.16, 1, clamp01((f - F(tSpins) - 4) / 6)); if (f >= F(tMill2) - 2) label(g, 540, 380, "MILL WHEEL", f - F(tMill2) + 2); },
});
// 5b — "...and not a roulette wheel."  (the roulette wheel, the same tiny wobble)
const C5b = F(tHe) - 3;
add({
  a: C5a, b: C5b, plate: "mc_cu", xfade: 4,
  keys: [{ f: C5a, at: [179.28, 0.95, 2.4], z: 1.0, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  over: (g, v, f) => { spinWheel(g, v, f, C5a - 30, { wobble: 1 }); if (f >= F(tRoulette2) - 2) label(g, 540, 380, "ROULETTE WHEEL", f - F(tRoulette2) + 2); },
});
// 6 — "He was right. Five wheels were perfectly random, but on the sixth, nine numbers kept coming up way too often."
const C6 = F(tSo) - 3;
add({
  a: C5b, b: C6, plate: "mc_w", xfade: 4,
  keys: [{ f: C5b, at: [180, 1.6, 2.4], z: 1.2, creep: 0.002 }],
  under: (g, v, f) => mcGrade(g, v, f),
  over: (g, v, f) => {
    dim(g, 0.5);
    for (let i = 0; i < 6; i++) {
      const x = 200 + (i % 3) * 340, y = 620 + Math.floor(i / 3) * 420, k = easeOutBack(clamp01((f - C5b - i * 3) / 7), 1.6), hot = i === 5;
      if (k <= 0) continue;
      const n = hot ? Math.floor(Math.max(0, f - F(tSixth)) * 1.6) : Math.floor(Math.max(0, f - C5b - 6) * 0.6);
      const a = hot ? clamp01((f - F(tNine) + 2) / 6) : 0;
      g.save(); g.translate(x, y); g.scale(k * (1 + 0.08 * a), k * (1 + 0.08 * a));
      if (a > 0) { g.save(); g.shadowColor = "#ffd24a"; g.shadowBlur = 40 * a; g.fillStyle = `rgba(255,210,74,${0.5 * a})`; g.fillRect(-140, -175, 280, 350); g.restore(); }
      tallyBook(g, 0, 0, 260, Math.min(hot ? 81 : 27, n), (i - 2.5) * 0.03);
      g.restore();
    }
    if (f >= F(tRandom) - 2 && f < F(tSixth) - 2) label(g, 540, 360, "RANDOM", f - F(tRandom) + 2);
    if (f >= F(tNine) - 2) label(g, 540, 360, "9 NUMBERS", f - F(tNine) + 2);
    if (f >= F(tOften) - 2) label(g, 880, 1290, "TOO OFTEN!", f - F(tOften) + 2);
  },
});
// 7a — "So he started betting only on that wheel, only on those nine numbers."  (close: nine chips drop onto the layout; the ball lands)
const C7a = F(tDay) - 3;
const SPOTS: V3[] = Array.from({ length: 9 }, (_, i) => [179.95 + (i % 3) * 0.32, 0.87, 2.05 + Math.floor(i / 3) * 0.3] as V3);
add({
  a: C6, b: C7a, plate: "mc_cu", xfade: 4,
  keys: [{ f: C6, at: [179.25, 0.72, 2.4], z: 0.95, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  over: (g, v, f) => {
    spinWheel(g, v, f, C6 - 40, { ballStop: C7a - 2 });
    const k = easeOutBack(clamp01((f - F(tBetting) + 2) / 8), 1.4);
    if (k > 0) { g.save(); g.translate(540, 1060); g.scale(k, k); g.beginPath(); g.roundRect(-330, -150, 660, 300, 22); g.fillStyle = "#2f6a43"; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
      [7, 8, 9, 17, 18, 19, 22, 28, 29].forEach((n, i) => { const x = -220 + (i % 3) * 220, y = -95 + Math.floor(i / 3) * 95; g.beginPath(); g.roundRect(x - 95, y - 40, 190, 80, 10); g.fillStyle = [7, 9, 18, 19].includes(n) ? "#c0353a" : "#1d1a22"; g.fill(); g.lineWidth = 4; g.strokeStyle = "#f3ead2"; g.stroke();
        g.fillStyle = "#f3ead2"; g.font = "900 46px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), x - 30, y + 2); dropChip(g, x + 50, y + 12, 50, f - F(tNine2) + 10 - i * 2, i % 2 ? "#e8c45a" : "#f4ecd6"); });
      g.restore(); }
    if (f >= F(tBetting) - 2) label(g, 540, 820, "ONLY THESE 9", f - F(tBetting) + 2);
  },
});
// 7b — "Day after day, he kept winning."  (Jagger grins; the chips pile up; the calendar races)
const C7b = F(tStory) - 3;
const jagChips = (g: CanvasRenderingContext2D, v: View, n: number) => { chipStack(g, ...v.w([179.7, 0.86, 1.95]), v.ppm([179.7, 0.86, 1.95]) * 0.13, n, "#e8c45a"); chipStack(g, ...v.w([180.5, 0.86, 1.95]), v.ppm([180.5, 0.86, 1.95]) * 0.13, Math.max(1, n - 3), "#c0353a"); };
add({
  a: C7a, b: C7b, plate: "mc_w", xfade: 4,
  keys: [{ f: C7a, at: [180.1, 1.3, 1.45], z: 2.2, creep: 0.004 }],
  kicks: [[F(tWinning), 0.3]],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => [jag(f, [[0, "smile"], [F(tWinning) - 4, "grin"]], [[0, { l: [0.3, -0.5], r: [-0.3, -0.5] }]], [180.1, 0, 2.15], {})],
  over: (g, v, f) => {
    calendar(g, 870, 360, 150, "DAY " + (1 + Math.floor(Math.max(0, f - C7a) / 3)), null, 0, easeOutBack(clamp01((f - C7a) / 6), 1.8));
    jagChips(g, v, 2 + Math.floor(Math.max(0, f - C7a) / 3));
  },
});
// 8 — "The story goes, he walked away with over two million francs."  (the pile towers; onlookers gasp)
const C8 = F(tCasino) - 3;
add({
  a: C7b, b: C8, plate: "mc_w", xfade: 4,
  keys: [{ f: C7b, at: [180.1, 1.35, 1.8], z: 1.6, creep: 0.004 }],
  kicks: [[F(tFrancs), 0.4]],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => [
    stand(CLERK(0), "o1", [180.95, 0, 3.2], 91, f, [[0, "smile"], [F(tMillion), "shock"]], [[0, {}]], { facing: -1 }, { noShadow: true, clip: above(178, 182, 0.84, 3.0) }),
    stand(CLERK(3), "o2", [179.15, 0, 3.2], 92, f, [[0, "smile"], [F(tMillion) + 3, "shock"]], [[0, {}]], { facing: 1 }, { noShadow: true, clip: above(178, 182, 0.84, 3.0) }),
    jag(f, [[0, "grin"], [F(tFrancs), "laugh"]], [[0, { l: [0.3, -0.5], r: [-0.3, -0.5] }]], [180.1, 0, 2.15]),
  ],
  over: (g, v, f) => {
    jagChips(g, v, 12 + Math.min(10, Math.floor(Math.max(0, f - C7b) / 3)));
    if (f >= F(tTwo) - 4) { const n = Math.round(2000000 * easeOut(clamp01((f - F(tTwo) + 4) / 16))); counter(g, 540, 330, n.toLocaleString("en-GB"), easeOutBack(clamp01((f - F(tTwo) + 4) / 6), 1.8), "#9fe08a", 120); }
    if (f >= F(tFrancs) - 2) label(g, 540, 460, "FRANCS", f - F(tFrancs) + 2);
    if (f >= F(tStory) - 2 && f < F(tTwo) - 4) label(g, 540, 360, "THE STORY GOES…", f - F(tStory) + 2);
  },
});
// 9 — "The casino panicked."  (the casino director: shock, then steam)
const C9 = F(tSo2) - 3;
add({
  a: C8, b: C9, plate: "mc_w", xfade: 4,
  keys: [{ f: C8, at: [181.0, 1.4, 3.6], z: 2.4, creep: 0.006, punch: 0.01, pn: 6 }],
  kicks: [[F(tPanicked), 0.5]],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => [stand(DIRECTOR, "dir", [181.0, 0, 3.6], 51, f, [[0, "nervous"], [F(tPanicked), "shock"]], [[0, {}], [F(tPanicked), { l: [0.45, -1.0], r: [-0.45, -1.0] }]], { facing: 0 }, { noShadow: true })],
  over: (g, v, f) => { const hd = v.w([181.0, 1.95, 3.6]); emark(g, hd[0] + 150, hd[1] - 40, 90, f - F(tPanicked)); fume(g, hd[0], hd[1] - 30, 120, f, clamp01((f - F(tPanicked) - 6) / 6)); },
});
const porters = (f: number) => [
  walker(PORTER(0), "p0", 61, f, [[F(tSecretly) - 6, 182.4, 1.55], [F(tNext) - 3, 177.6, 1.55]], "grit"),
  walker(PORTER(1), "p1", 62, f, [[F(tSecretly) - 6, 177.6, 1.15], [F(tNext) - 3, 182.4, 1.15]], "grit"),
];
// 10 — "So one night, they secretly swapped the wheels between the tables."  (night; two porters tiptoe past, carrying wheels the opposite ways)
const C10 = F(tNext) - 3;
add({
  a: C9, b: C10, plate: "mc_w", xfade: 6,
  keys: [{ f: C9, at: [180, 1.1, 1.4], z: 1.45, creep: 0.003 }],
  under: (g, v, f) => mcGrade(g, v, f, 0.95),
  cast: (f) => porters(f),
  over: (g, v, f) => {
    if (f >= F(tNight) - 2) label(g, 540, 330, "ONE NIGHT…", f - F(tNight) + 2);
    if (f >= F(tSwapped) - 2) label(g, 540, 430, "SWAPPED!", f - F(tSwapped) + 2);
    for (const a of porters(f)) { const h = sideHand(v, a, f), m = v.ppm(a.P); g.save(); g.translate(h[0], h[1] - m * 0.18); rwheel(g, 0, 0, m * 0.3, 0.35, f * 0.02, 0, 0.84); g.restore(); }
  },
});
// 11 — "The next day, Jagger started losing until he noticed something."  (his pile shrinks; frown; then a sharp look)
const C11 = F(tHis) - 3;
add({
  a: C10, b: C11, plate: "mc_w", xfade: 4,
  keys: [{ f: C10, at: [180.1, 1.35, 2.15], z: 2.2, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => [jag(f, [[0, "smile"], [F(tLosing), "nervous"], [F(tNoticed), "shock"]], [[0, { l: [0.3, -0.5], r: [-0.3, -0.5] }], [F(tNoticed), { r: [-0.4, -0.95] }]], [180.1, 0, 2.15])],
  over: (g, v, f) => {
    jagChips(g, v, Math.max(1, 14 - Math.floor(Math.max(0, f - F(tLosing)) / 2)));
    const hd = v.w([180.1, 1.95, 2.15]); emark(g, hd[0] + 140, hd[1] - 30, 80, f - F(tNoticed));
  },
});
// 12a — "His lucky wheel had a tiny scratch."  (close on a wheel; the magnifier slides in; a hair-thin scratch on the rim glints)
const C12a = F(tFound) - 3;
add({
  a: C11, b: C12a, plate: "mc_cu", xfade: 4,
  keys: [{ f: C11, at: [179.28, 0.95, 2.4], z: 1.05, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  over: (g, v, f) => {
    const W = spinWheel(g, v, Math.min(f, F(tTiny)), F(tTiny) - 191.35, { scratch: clamp01((f - F(tScratch) + 4) / 6) });
    const rot = (Math.min(f, F(tTiny)) - F(tTiny) + 191.35) * 0.12 + 0.6, sx = W.x + Math.cos(rot) * W.r * 0.95, sy = W.y + Math.sin(rot) * W.r * 0.95 * W.tilt;
    const u = easeOut(clamp01((f - F(tLucky)) / 10)); if (u > 0) magnifier(g, sx + (1 - u) * 500 + 40, sy + 50, 110, 0.7);
    if (f >= F(tScratch) - 2) label(g, 540, 360, "A TINY SCRATCH", f - F(tScratch) + 2);
  },
});
// 12b — "He found it at another table and kept on winning."  (wide: he moves to the next table and points at the wheel; chips again)
const C12b = F(tIn) - 3;
add({
  a: C12a, b: C12b, plate: "mc_w", xfade: 4,
  keys: [{ f: C12a, at: [181.2, 1.35, 1.9], z: 1.7, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  cast: (f) => [jag(f, [[0, "grin"], [F(tWinning2), "laugh"]], [[0, { r: [-0.55, -0.7] }]], [181.6, 0, 1.6])],
  over: (g, v, f) => {
    const p = v.w([182.55, 0.97, 2.4]), m = v.ppm([182.55, 0.97, 2.4]);
    sparkle(g, p[0], p[1] - m * 0.15, 50, f - F(tFound) - 2);
    if (f >= F(tAnother) - 2) label(g, 540, 360, "FOUND IT!", f - F(tAnother) + 2);
    const cp = v.w([181.25, 0.86, 1.95]); chipStack(g, cp[0], cp[1], v.ppm([181.25, 0.86, 1.95]) * 0.13, 2 + Math.floor(Math.max(0, f - F(tWinning2) + 6) / 2), "#e8c45a");
  },
});
// 13 — "In the end, the casino rebuilt every wheel so none of them could stay lopsided ever again."  (a screwdriver; the wheel runs true)
const C13 = F(tAnd2) - 3;
add({
  a: C12b, b: C13, plate: "mc_cu", xfade: 4,
  keys: [{ f: C12b, at: [179.28, 0.95, 2.4], z: 1.0, creep: 0.004 }],
  under: (g, v, f) => mcGrade(g, v, f),
  over: (g, v, f) => {
    const fixing = f < F(tLopsided) + 2;
    const W = spinWheel(g, v, fixing ? C12b : f, fixing ? C12b - 10 : F(tLopsided) - 10, { wobble: 0 });
    if (fixing) screwdriver(g, W.x + W.r * 0.55, W.y - W.r * 0.05, W.r * 0.6, -2.5 + Math.sin(f * 0.4) * 0.08, f * 0.6);
    if (f >= F(tRebuilt) - 2) label(g, 540, 360, "REBUILT", f - F(tRebuilt) + 2);
    if (!fixing) { g.save(); g.globalAlpha = clamp01((f - F(tLopsided) - 2) / 6); g.setLineDash([18, 14]); g.strokeStyle = "#ffd24a"; g.lineWidth = 7; g.beginPath(); g.ellipse(W.x, W.y, W.r * 1.08, W.r * 1.08 * W.tilt, 0, 0, 7); g.stroke(); g.restore(); sparkle(g, W.x + W.r * 0.8, W.y - W.r * 0.4, 50, f - F(tAgain)); }
  },
});
// 14 — "And Jagger, he quit while he was ahead, went home to Yorkshire and bought a row of houses."  (golden street; SOLD boards pop on each door)
const C14 = F(tHe3) - 3;
add({
  a: C13, b: C14, plate: "yorks", xfade: 6,
  keys: [{ f: C13, at: [300, 1.4, 3.4], z: 2.0, creep: 0.004 }, { f: F(tBought) - 8, dur: 10, at: [304.6, 2.4, 6.0], z: 1.0, creep: 0.003 }, { f: F(tHouses) - 2, dur: 24, at: [295.4, 2.4, 6.0], z: 1.0, creep: 0.003 }],
  cast: (f) => [jag(f, [[0, "smile_closed"], [F(tHome), "smile"], [F(tHouses), "grin"]], [[0, { l: [0.3, -0.45], r: [-0.3, -0.45] }], [F(tQuit), { r: [-0.25, -1.15] }], [F(tQuit) + 14, { l: [0.3, -0.45], r: [-0.3, -0.45] }]], [300, 0, 3.4])],
  over: (g, v, f) => {
    if (f >= F(tQuit) - 2 && f < F(tHome) - 2) label(g, 540, 330, "QUIT WHILE AHEAD", f - F(tQuit) + 2);
    if (f >= F(tYorkshire2) - 2 && f < F(tBought) - 4) label(g, 540, 330, "HOME TO YORKSHIRE", f - F(tYorkshire2) + 2);
    for (let k = 1; k >= -1; k--) { const age = f - F(tHouses) - (1 - k) * 9 + 2; if (age < 0) continue; const p = v.w([300 + k * 5.2, 2.6, 8.9]), m = v.ppm([300 + k * 5.2, 2.6, 8.9]), s = easeOutBack(clamp01(age / 6), 2);
      g.save(); g.translate(p[0], p[1]); g.scale(s, s); g.rotate(-0.06 + k * 0.02); g.beginPath(); g.roundRect(-m * 0.55, -m * 0.25, m * 1.1, m * 0.5, 8); g.fillStyle = "#c0353a"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.fillStyle = "#fff6e0"; g.font = `900 ${m * 0.32}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SOLD", 0, 3); g.restore(); }
  },
});
// 15 — "He didn't beat the casino with luck. He beat it with a notebook."  (close: a four-leaf clover pops and blows away... then he raises the notebook)
add({
  a: C14, b: TOTAL, plate: "yorks", xfade: 6,
  keys: [{ f: C14, at: [299.7, 1.4, 3.4], z: 2.2, creep: 0.004 }],
  cast: (f) => [jag(f, [[0, "smile"], [F(tNotebook) - 2, "grin"]], [[0, { l: [0.3, -0.45], r: [-0.3, -0.45] }], [F(tHe4), { r: [-0.4, -1.0] }]], [300, 0, 3.4])],
  over: (g, v, f) => {
    { const t0 = F(tLuck) - 4, age = f - t0, k = easeOutBack(clamp01(age / 6), 2), off = Math.max(0, f - F(tNotebook) + 4); if (age >= 0 && off < 10) { g.save(); g.translate(230 - off * 22, 430 - off * 12); g.rotate(off * 0.15 + Math.sin(f * 0.2) * 0.08); g.scale(k, k); g.globalAlpha = 1 - clamp01(off / 10);
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.ellipse(0, -40, 32, 42, 0, 0, 7); g.fillStyle = "#4caf50"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.restore(); } g.restore(); if (age < 30) label(g, 230, 300, "LUCK?", age); } }
    if (f >= F(tHe4)) { const k = easeOutBack(clamp01((f - F(tHe4)) / 7), 1.6); g.save(); g.translate(830, 640); g.scale(k, k); tallyBook(g, 0, 0, 280, 81, 0.08, Math.floor(f / 4) % 9); g.restore(); sparkle(g, 950, 450, 60, f - F(tNotebook)); }
  },
});

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
