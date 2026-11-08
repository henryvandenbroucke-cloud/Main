// Timeline of "The Robbers Who Never Broke a Lock" (the Brink's job, Boston 1950), timed to the voice's words.json (every event hangs off a word).
// Brick-tax staging: toy-bright 3D sets, living faces (blinks, talking mouths, brow pops + a hop on every reaction),
// vector letters / coins / the Penny Black, something moving on every beat.
import { Outfit, FrontOpts, INK, Expr, townsfolk, P2, bodyFront, Pen } from "./toon";
import { V3 } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import { stampMark, puff, ringWaves, qmark, emark, hand, card, calendar, thought, moth, sparkle, padlock, lawBook, jailBars, brassKey, keyRing, lockCyl, screwdriver, moneyBag, bill, cuffs, suitcase, tick, bellIcon, gunIcon, ecg } from "./props2d";
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
const t1950 = A("1950"), tEleven = A("11"), tSecure = A("secure"), tBoston = A("boston"), tDidnt = A("didn't"), tSingle = A("single"), tLock0 = A("lock", tSingle);
const tBecause = A("because"), tMonths = A("months"), tSneak = A("sneak"), tUnscrew = A("unscrew"), tLock1 = A("lock", tUnscrew), tTake = A("take"), tLocksmith = A("locksmith");
const tCut = A("cut"), tKey = A("key", tCut), tMorning = A("morning"), tBack = A("back", tMorning), tNobody = A("nobody"), tNoticed = A("noticed");
const tDoorA = A("door", tNoticed), tDoorB = A("door", tDoorA + 0.1), tKeyA = A("key", tDoorB), tKeyB = A("key", tKeyA + 0.1);
const tThen = A("then", tKeyB), tJanuary = A("january"), tSeven = A("seven"), tMasks = A("masks"), tWalked = A("walked"), tClick1 = A("click", tWalked), tClick2 = A("click", tClick1 + 0.05), tClick3 = A("click", tClick2 + 0.05);
const t20 = A("20"), tWalked2 = A("walked", t20), tNearly = A("nearly"), tMillion = A("million");
const tNo1 = A("no", tMillion), tShots = A("shots"), tBroken = A("broken"), tLocks = A("locks", tBroken), tPolice = A("police"), tNothing = A("nothing");
const tGang = A("gang"), tRule = A("rule"), tSpends = A("spends"), tSix = A("six"), tYears = A("years", tSix), tLaw = A("law"), tNever = A("never", tLaw), tCharged = A("charged");
const tYear1 = A("year", tCharged), tThree = A("three", tYear1), tFive = A("five", tThree), tAlmost = A("almost"), tFree = A("free");
const tThen2 = A("then", tFree), tSpecs = A("specs"), tArrested = A("arrested"), tAnd5 = A("and", tArrested), tShare = A("share"), tVanished = A("vanished");
const tFurious = A("furious"), tSo1 = A("so", tFurious), tHired = A("hired"), tHit = A("hit"), tShutUp = A("shut", tHit), tShot = A("shot"), tSurvived = A("survived");
const tSo2 = A("so", tSurvived), tFBI = A("fbi"), tVisit = A("visit"), tSpecs2 = A("specs", tVisit), tTalked = A("talked");
const tThe9 = A("the", tTalked), tArrested2 = A("arrested", tTalked), tFiveD = A("five", tArrested2), tClock = A("clock"), tOut = A("out", tClock);
const tThey1 = A("they", tOut), tEvery = A("every", tThey1), tDoorEnd = A("door", tEvery), tThey2 = A("they", tDoorEnd), tCouldnt = A("couldn't"), tMouth = A("mouth"), tShut2 = A("shut", tMouth);

// ---------------- cast (white heads; Segment Zero-style signature items) ----------------
const WHITE = "#f8f6f1";
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, skin: WHITE, ...o } as Outfit);
const MASKS = ["#f2c9a0", "#e8b48a", "#f4d4a8", "#eabf96"];
const GANG = (i: number) => O({ jacket: ["#26304a", "#2b2f3d", "#2f3a4f"][i % 3], pants: "#2b2b35", hat: "chauffeur", cap: "#1f2333", mask: MASKS[i % 4], buttons: "#c9ccd2" });
const PINO = O({ jacket: "#4a3a3a", pants: "#2b2b35", hat: "fedora", cap: "#3a3530", moustache: "#2a201a", build: "stout" });
const McGIN = O({ jacket: "#3a4a5a", pants: "#2b2b35", hat: "hair", hair: "#c9ccd2", buttons: "#c9a23a" });
const GANG3 = O({ jacket: "#5a4a3a", pants: "#3a3530", hat: "cap", cap: "#3a3f52" });
const SPECS = O({ jacket: "#6b5a45", pants: "#3a3530", hat: "hair", hair: "#3a2a20", glasses: true });
const SMITH = O({ jacket: "#7a6a52", pants: "#3a3530", hat: "hair", hair: "#e9e6e0", moustache: "#e9e6e0", build: "stout", buttons: "#c9a23a" });
const GUARD = O({ jacket: "#3f4a6b", pants: "#2b2b35", hat: "chauffeur", cap: "#2b3a5a", buttons: "#e8c45a", moustache: "#5a3b2a" });
const DETECTIVE = O({ jacket: "#b8a07a", pants: "#5a4a3a", hat: "fedora", cap: "#5a4a3a", moustache: "#3a2a20" });
const FBI1 = O({ jacket: "#3a3f48", pants: "#2b2b35", hat: "fedora", cap: "#4a4a52", buttons: "#c9ccd2" });
const FBI2 = O({ jacket: "#46484f", pants: "#2b2b35", hat: "fedora", cap: "#3a3f48", buttons: "#c9ccd2", build: "stout" });
const HITMAN = O({ jacket: "#1d1b22", pants: "#1d1b22", hat: "fedora", cap: "#1d1b22" });
const COP = O({ jacket: "#26304a", pants: "#26304a", hat: "chauffeur", cap: "#1f2a44", buttons: "#e8c45a" });

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

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const EXT_POOLS: V3[] = [[3.6, 3.85, 2.9], [-12, 3.85, 2.9], [0.4, 2.0, 5.6], [-7, 5.5, 5.9], [0, 5.5, 5.9], [7, 5.5, 5.9]];
const CORR_POOLS: V3[] = [[58.2, 3.3, 2.6], [61.8, 3.3, 2.6]];
const LOCK_EXT: V3 = [-0.018, 1.16, 5.88];        // the brass lock cylinder on the Brink's entrance door
const LOCK_MID: V3 = [59.62, 1.16, 4.08];         // the middle corridor door's lock
const DOORS_X = [56.4, 60, 63.6];

// 1 — HOOK. "In 1950, eleven men robbed..."  Frame 1: extreme close on the brass lock; a key slides in, turns (click),
//     the camera snaps back and the door swings open on a warm, dark hallway.
const C1 = F(tEleven) - 3;
add({
  a: 0, b: C1, plate: "ext_door",
  keys: [{ f: 0, at: LOCK_EXT, z: 4.2, creep: 0 }, { f: 11, dur: 16, at: [0.35, 1.45, 5.6], z: 1.25, creep: 0.003 }],
  kicks: [[9, 0.6]],
  under: (g, v, f) => nightGrade(g, v, EXT_POOLS, f),
  over: (g, v, f) => {
    const m = v.ppm(LOCK_EXT), L = v.w(LOCK_EXT);
    doorSwing(g, v, -0.15, 0.95, 2.3, 5.88, clamp01((f - 14) / 12), "#2f5a44");
    if (f < 26) { const slide = easeOut(clamp01(f / 6)), turn = clamp01((f - 7) / 3); brassKey(g, L[0] + (1 - slide) * m * 0.4 + m * 0.03, L[1], m * 0.17, Math.PI, "#d6a63c", 0); if (turn > 0) ringWaves(g, L[0], L[1], m * 0.03, f - 9, 0.8, 2); }
    bigNum(g, 540, 430, "1950", f - F(t1950) - 2);
  },
});

// 2 — "...robbed the most secure building in Boston."  (the street at night: eleven masked men pop into a row on the
//     pavement; the camera glides along them to the BRINK'S sign)
const C2 = F(tDidnt) - 4;
add({
  a: C1, b: C2, plate: "ext_w", xfade: 4,
  keys: [{ f: C1, at: [1.35, 1.25, 4.4], z: 2.1, creep: 0.003 }, { f: F(tBoston) - 4, dur: 14, at: [1.1, 1.9, 5.0], z: 1.6, creep: 0.002 }],
  kicks: [[F(tBoston) + 2, 0.3]],
  under: (g, v, f) => nightGrade(g, v, EXT_POOLS, f),
  cast: (f) => Array.from({ length: 11 }, (_, i) => { const t0 = F(tEleven) + i * 2, row = i < 6 ? 0 : 1, x = row ? 2.9 - (i - 6) * 0.62 : 3.2 - i * 0.62; return f >= t0 ? stand(GANG(i), "g" + i, [x, 0, row ? 4.75 : 4.15], 300 + i, f, [[t0, "neutral"], [t0 + 6, i % 3 ? "smile" : "grin"]], [[0, {}]], { facing: (i % 2 ? -1 : 1) as -1 | 1 }, { hop: f - t0 < 7 ? 0.12 * Math.sin((Math.PI * (f - t0)) / 7) : 0 }) : null; }).filter(Boolean) as Actor[],
  over: (g, v, f) => { const sg = v.w([0.9, 4.2, 5.9]); label(g, sg[0], sg[1] - 20, "BOSTON, 1950", f - F(tBoston)); if (f >= F(tSecure)) { const k = easeOutBack(clamp01((f - F(tSecure)) / 8), 2); g.save(); g.translate(540, 330); g.scale(k, k); padlock(g, 0, 0, 150, 1); g.restore(); } },
});

// 3 — "And they didn't break a single lock."  (close on the corridor door's lock: a big green tick draws on)
const C3 = F(tBecause) - 3;
add({
  a: C2, b: C3, plate: "corr_cu", xfade: 4,
  keys: [{ f: C2, at: [59.75, 1.2, 4.1], z: 1.6, creep: 0.004 }, { f: F(tSingle) - 3, dur: 10, at: LOCK_MID, z: 2.4, creep: 0.004 }],
  kicks: [[F(tLock0) + 1, 0.4]],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.85),
  over: (g, v, f) => { const L = v.w(LOCK_MID), m = v.ppm(LOCK_MID); tick(g, L[0] - m * 0.25, L[1] - m * 0.25, m * 0.22, clamp01((f - F(tLock0) + 2) / 8), true); sparkle(g, L[0] + m * 0.02, L[1] - m * 0.02, m * 0.05, f - F(tLock0)); },
});

// 4 — "Because for months, they'd sneak in at night..."  (the corridor in moonlight: a masked man tiptoes to the middle door)
const C4 = F(tUnscrew) - 4;
add({
  a: C3, b: C4, plate: "corr_w", xfade: 6,
  keys: [{ f: C3, follow: (f) => { const w = walkAt2(f, [[C3, 65.5, 3.2], [C4, 60.6, 3.2]]); return [w.x, 1.4, 3.3]; }, at: [0, 0, 0], z: 1.7, creep: 0.001 }],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.95),
  cast: (f) => [walker(GANG(0), "sneak", 300, f, [[C3, 65.5, 3.2], [C4, 60.6, 3.2]], "smile")],
  over: (g, v, f) => { label(g, 540, 330, "AT NIGHT", f - F(tSneak)); },
});

// 5 — "...unscrew a lock from a door, and take it..."  (close: the screwdriver spins, the brass cylinder slides out and
//     is lifted up into the moonlight)
const C5 = F(tLocksmith) - 4;
add({
  a: C4, b: C5, plate: "corr_cu", xfade: 4,
  keys: [{ f: C4, at: LOCK_MID, z: 2.6, creep: 0.004 }, { f: F(tTake) - 4, dur: 12, at: [59.75, 1.35, 4.0], z: 1.8, creep: 0.004 }],
  kicks: [[F(tLock1) + 1, 0.35]],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.85),
  over: (g, v, f) => {
    const L = v.w(LOCK_MID), m = v.ppm(LOCK_MID), out = easeOut(clamp01((f - F(tLock1) + 2) / 8)), lift = easeOutBack(clamp01((f - F(tTake) + 2) / 10), 1.4);
    if (f < F(tLock1) + 2) screwdriver(g, L[0] + m * 0.02, L[1] - m * 0.06, m * 0.42, -0.25, f * 0.9);
    lockCyl(g, L[0] + out * m * 0.18, L[1] - lift * m * 0.35, m * 0.1, out * 0.2 - lift * 0.6, lift);
    if (out > 0.9 && lift < 0.2) puffs(g, L[0], L[1], m * 0.06, f - F(tLock1) - 4, 4, true);
    beam(g, 760, 0.6);
  },
});

// 6 — "...to a locksmith. He'd cut a key."  (the locksmith's bench: loupe in his eye, the cylinder under the lamp; the
//     key blank screams on the wheel, sparks; the new key held up, glinting)
const C6 = F(A("and", tKey)) - 3;
add({
  a: C5, b: C6, plate: "smith", xfade: 6,
  keys: [{ f: C5, at: [120.3, 1.35, 2.5], z: 1.15, creep: 0.003 }, { f: F(tCut) - 4, dur: 10, at: [120.2, 1.35, 2.7], z: 1.45, creep: 0.004 }],
  kicks: [[F(tKey) + 1, 0.4]],
  under: (g, v, f) => nightGrade(g, v, [[118.5, 1.38, 2.95]], f, 0.6),
  cast: (f) => [stand(SMITH, "smith", [120.62, 0, 2.35], 41, f, [[0, "neutral"], [F(tCut), "grit"], [F(tKey), "grin"]], [[0, { r: [-0.45, -0.25] }], [F(tCut) - 3, { r: [-0.6, -0.15], l: [-0.2, -0.2] }], [F(tKey), { r: [-0.35, -1.0] }]], { facing: -1 }, { noShadow: true })],
  over: (g, v, f) => {
    const m = v.ppm([120.2, 1.42, 2.95]), wh = v.w([120.2, 1.42, 2.95]), hp = v.w([120.45, 1.05, 2.2]);
    if (f < F(tCut) - 2) lockCyl(g, hp[0], hp[1], m * 0.09, -0.3, 0.5);
    else if (f < F(tKey)) { brassKey(g, wh[0] + m * 0.05, wh[1] + m * 0.03, m * 0.13, 0.15, "#c9ccd2"); sparks2(g, wh[0] - m * 0.02, wh[1] + m * 0.02, m * 0.4, f, 1); }
    else { const k = easeOutBack(clamp01((f - F(tKey)) / 8), 1.6), hk = v.w([120.45, 1.6 + 0.15 * k, 2.2]); brassKey(g, hk[0], hk[1], m * 0.16 * (0.7 + 0.3 * k), -Math.PI / 2 + 0.2, "#d6a63c", k); sparkle(g, hk[0] + 20, hk[1] - 30, m * 0.06, f - F(tKey) - 2); }
    const eye = v.w([120.62, 1.5, 2.35]); g.save(); g.fillStyle = "#2b2025"; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.ellipse(eye[0] - m * 0.035, eye[1] - m * 0.005, m * 0.03, m * 0.035, 0, 0, 7); g.fill(); g.stroke(); g.restore();
  },
});

// 7 — "And by morning, the lock was back in the door."  (dawn: warm light sweeps the corridor door; the cylinder slides home)
const C7 = F(tNobody) - 3;
add({
  a: C6, b: C7, plate: "corr_cu", xfade: 6,
  keys: [{ f: C6, at: [59.8, 1.3, 4.1], z: 1.7, creep: 0.003 }, { f: F(tBack) - 4, dur: 10, at: LOCK_MID, z: 2.5, creep: 0.004 }],
  kicks: [[F(tBack) + 2, 0.35]],
  under: (g, v, f) => { const dawn = clamp01((f - F(tMorning) + 4) / 14); nightGrade(g, v, CORR_POOLS, f, 0.85 * (1 - dawn)); },
  over: (g, v, f) => {
    const L = v.w(LOCK_MID), m = v.ppm(LOCK_MID), into = easeOut(clamp01((f - F(tBack) + 3) / 7));
    lockCyl(g, L[0] + (1 - into) * m * 0.25, L[1] - (1 - into) * m * 0.12, m * 0.1, (1 - into) * 0.3, 0);
    if (into >= 1) { ringWaves(g, L[0], L[1], m * 0.03, f - F(tBack) - 4, 0.8, 2); sparkle(g, L[0] + 10, L[1] - 12, m * 0.05, f - F(tBack) - 5); }
    beam(g, 820, clamp01((f - F(tMorning) + 4) / 14) * 0.9);
  },
});

// 8 — "Nobody ever noticed."  (morning corridor: a guard strolls past the doors, coffee in hand, whistling)
const C8 = F(tDoorA) - 4;
add({
  a: C7, b: C8, plate: "corr_w", xfade: 6,
  keys: [{ f: C7, follow: (f) => { const w = walkAt2(f, [[C7, 57.2, 3.0], [C8 + 8, 62.4, 3.0]]); return [w.x, 1.35, 3.1]; }, at: [0, 0, 0], z: 1.9, creep: 0.001 }],
  under: (g) => warmGrade(g),
  cast: (f) => [walker(GUARD, "guard", 51, f, [[C7, 57.2, 3.0], [C8 + 8, 62.4, 3.0]], "whistle")],
  over: (g, v, f) => { const w = walkAt2(f, [[C7, 57.2, 3.0], [C8 + 8, 62.4, 3.0]]), hd = v.w([w.x, 1.7, 3.0]); for (let i = 0; i < 2; i++) { const a = ((f * 0.05 + i * 0.5) % 1); g.save(); g.globalAlpha = Math.sin(Math.PI * a); g.font = "900 54px 'Montserrat'"; g.fillStyle = INK; g.textAlign = "center"; g.fillText("♪", hd[0] - 70 - a * 30, hd[1] - 50 - a * 80); g.restore(); } },
});

// 9 — "Door after door. Key after key."  (sliding along the corridor: each door's lock glints; a key ring in front gains a key per beat)
const C9 = F(tThen) - 3;
add({
  a: C8, b: C9, plate: "corr_w", xfade: 4,
  keys: [{ f: C8, at: [62.4, 1.3, 4.0], z: 1.45, creep: 0.002 }, { f: F(tDoorB) - 2, dur: 18, at: [57.6, 1.3, 4.0], z: 1.45, creep: 0.002 }],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.6),
  over: (g, v, f) => {
    DOORS_X.forEach((x, i) => { const L = v.w([x - 0.38, 1.16, 4.08]); sparkle(g, L[0], L[1], 30, f - [F(tDoorA), F(tDoorB), F(tKeyA)][2 - i] - 1); });
    const beats = [F(tDoorA), F(tDoorB), F(tKeyA), F(tKeyB)], n = 1 + beats.filter((b) => f >= b).length;
    const last = Math.max(...beats.filter((b) => f >= b), C8), jig = Math.max(0, 1 - (f - last) / 10) * Math.sin((f - last) * 1.2);
    keyRing(g, 540, 1000, 230, n, jig, 1);
  },
});

// 10 — "Then, one January evening, seven men in rubber Halloween masks just walked in."  (the street at night: seven
//      masked men march along the pavement to the door; the camera rides in close on the masks)
const C10 = F(tClick1) - 3;
const MARCH = (i: number): [number, number, number][] => [[C9, 9.5 + i * 0.9, 4.4], [F(tWalked) + 6, 1.4 + i * 0.9, 4.4]];
add({
  a: C9, b: C10, plate: "ext_w", xfade: 6,
  keys: [{ f: C9, at: [5.5, 1.6, 4.4], z: 1.25, creep: 0.002 }, { f: F(tMasks) - 8, dur: 14, follow: (f) => { const w = walkAt2(f, MARCH(2)); return [w.x, 1.5, 4.4]; }, at: [0, 0, 0], z: 2.0, creep: 0.002 }],
  under: (g, v, f) => nightGrade(g, v, EXT_POOLS, f),
  cast: (f) => Array.from({ length: 7 }, (_, i) => walker(GANG(i), "m" + i, 400 + i, f, MARCH(i), "grin")),
  over: (g, v, f) => { label(g, 540, 330, "JANUARY 17, 1950", f - F(tJanuary)); if (f >= F(tSeven)) counter(g, 540, 470, "x7", easeOutBack(clamp01((f - F(tSeven)) / 7), 2) * (1 - smooth((f - F(tMasks)) / 6)), "#ffd24a", 120); },
});

// 11 — "Click. Click. Click."  (the corridor: the three doors unlock one per click and swing open in rhythm)
const C11 = F(t20) - 3;
add({
  a: C10, b: C11, plate: "corr_w", xfade: 2,
  keys: [{ f: C10, at: [60, 1.35, 4.0], z: 1.3, creep: 0.006 }],
  kicks: [[F(tClick1), 0.4], [F(tClick2), 0.4], [F(tClick3), 0.5]],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.8),
  over: (g, v, f) => { [F(tClick1), F(tClick2), F(tClick3)].forEach((t0, i) => { const x = DOORS_X[2 - i]; doorSwing(g, v, x - 0.5, x + 0.5, 2.2, 4.12, clamp01((f - t0) / 6), "#3f6a54"); const L = v.w([x - 0.38, 1.16, 4.08]); ringWaves(g, L[0], L[1], 18, f - t0, 0.9, 2); }); },
});

// 12 — "Twenty minutes later, they walked out with nearly three million dollars."  (the vault room: masked men stuff
//      bags, the wall clock spins 7:10 -> 7:30, bills flutter, the counter rolls)
const C12 = F(tNo1) - 3;
add({
  a: C11, b: C12, plate: "vault", xfade: 4,
  keys: [{ f: C11, at: [181, 1.5, 1.8], z: 1.35, creep: 0.003 }, { f: F(tNearly) - 4, dur: 12, at: [180.6, 1.4, 1.6], z: 1.6, creep: 0.004 }],
  kicks: [[F(tMillion) + 2, 0.5]],
  under: (g, v, f) => nightGrade(g, v, [[180, 4.4, 1.8]], f, 0.45),
  cast: (f) => [0, 1, 2].map((i) => stand(GANG(i + 2), "v" + i, [178.8 + i * 1.3, 0, 0.6 + (i % 2) * 0.3], 500 + i, f, [[0, "grin"], [F(tMillion), "laugh"]], [[0, { l: [0.35, -0.2], r: [-0.35, -0.2] }], [F(tWalked2) + i * 3, { l: [0.3, -0.5], r: [-0.3, -0.5] }]], { facing: (i - 1) as -1 | 0 | 1 }, { noShadow: true })),
  over: (g, v, f) => {
    const ck = v.w([182.2, 4.0, 5.58]), m = v.ppm([182.2, 4.0, 5.58]); clockFace(g, ck[0], ck[1], m * 0.55, 10 + 20 * clamp01((f - C11) / (F(tWalked2) - C11)));
    [0, 1, 2].forEach((i) => { const p = v.w([178.8 + i * 1.3, 0.75, 0.3]), mm = v.ppm([178.8, 0.75, 0.3]); moneyBag(g, p[0], p[1], mm * 0.42, clamp01((f - C11 - i * 5) / 40), Math.sin(f * 0.2 + i) * 0.05); });
    for (let i = 0; i < 10; i++) { const u = ((f - C11) * 0.02 + i * 0.1) % 1; bill(g, 120 + ((i * 113) % 840), -60 + u * 1500, 90, u * 4 + i, (u * 5 + i * 0.3) % 1); }
    if (f >= F(tNearly) - 2) { const n = Math.round(2775000 * easeOut(clamp01((f - F(tNearly) + 2) / (F(tMillion) - F(tNearly) + 8)))); counter(g, 540, 380, "$" + n.toLocaleString("en-US"), easeOutBack(clamp01((f - F(tNearly) + 2) / 6), 1.8), "#9fe08a", 110); }
  },
});

// 13 — "No alarm. No shots. No broken locks. The police had nothing."  (next morning at the door: three icons pop and
//      get their verdicts; a detective with a magnifier finds only a chauffeur's cap; he shrugs)
const C13 = F(A("and", tNothing)) - 3;
add({
  a: C12, b: C13, plate: "ext_day", xfade: 6,
  keys: [{ f: C12, at: [0.35, 1.7, 5.0], z: 1.25, creep: 0.002 }, { f: F(tPolice) - 4, dur: 12, at: [0.6, 1.25, 4.6], z: 1.55, creep: 0.003 }],
  cast: (f) => [stand(DETECTIVE, "det", [0.9, 0, 4.7], 61, f, [[0, "stern"], [F(tNothing), "dazed"]], [[0, { r: [-0.3, -0.5] }], [F(tNothing), { l: [-0.6, -0.6], r: [0.6, -0.6] }]], { facing: -1, headTilt: f > F(tNothing) ? -8 : 0 }, { noShadow: true })],
  over: (g, v, f) => {
    const icons: [number, (x: number, y: number) => void, boolean][] = [[F(tNo1), (x, y) => bellIcon(g, x, y, 130), false], [F(tShots), (x, y) => gunIcon(g, x, y, 150), false], [F(tBroken), (x, y) => lockCyl(g, x, y, 90, 0), true]];
    icons.forEach(([t0, draw, ok], i) => { if (f < t0 - 2 || f > F(tPolice) + 2) return; const k = easeOutBack(clamp01((f - t0 + 2) / 7), 2) * (1 - smooth((f - F(tPolice) + 4) / 6)); const x = 220 + i * 320, y = 420; g.save(); g.translate(x, y); g.scale(k, k); draw(0, 0); g.restore(); tick(g, x + 10, y + 10, 120, clamp01((f - t0 - 4) / 7) * k, ok); });
    if (f >= F(tPolice)) { const cp = v.w([0.2, 0.05, 4.6]), m = v.ppm([0.2, 0, 4.6]); g.save(); g.translate(cp[0], cp[1]); g.fillStyle = "#1f2333"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(0, -m * 0.04, m * 0.16, m * 0.06, 0, Math.PI, 0); g.fill(); g.stroke(); g.beginPath(); g.ellipse(m * 0.08, 0, m * 0.12, m * 0.03, 0, 0, 7); g.fillStyle = "#16171b"; g.fill(); g.stroke(); g.restore();
      const mg = v.w([0.55, 0.5, 4.5]); g.save(); g.lineWidth = 10; g.strokeStyle = INK; g.beginPath(); g.arc(mg[0], mg[1], 60, 0, 7); g.fillStyle = "rgba(200,230,255,0.3)"; g.fill(); g.stroke(); g.beginPath(); g.moveTo(mg[0] + 42, mg[1] + 42); g.lineTo(mg[0] + 100, mg[1] + 100); g.lineWidth = 16; g.stroke(); g.restore(); }
    const hd = v.w([0.9, 1.75, 4.7]); qmark(g, hd[0] - 80, hd[1] - 60, 80, f - F(tNothing) - 2, -0.15);
  },
});

// 14 — "And the gang made one rule. Nobody spends a cent for six years. Because after six years... the law says you can
//      never be charged."  (the hideout: the boss leans in, finger up; 6 YEARS stamps on; a law book slams; a padlock
//      drops on the money under the sheet)
const C14 = F(tYear1) - 3;
add({
  a: C13, b: C14, plate: "hide", xfade: 6,
  keys: [{ f: C13, at: [240, 1.4, 2.4], z: 1.25, creep: 0.002 }, { f: F(tRule) - 4, dur: 10, at: [240.1, 1.6, 2.4], z: 1.75, creep: 0.003 }, { f: F(tLaw) - 6, dur: 14, at: [238.6, 1.1, 2.9], z: 1.5, creep: 0.003 }],
  kicks: [[F(tSix) + 2, 0.5], [F(tLaw) + 2, 0.5], [F(tCharged) + 2, 0.4]],
  under: (g, v, f) => nightGrade(g, v, [[240, 2.6, 2.2]], f, 0.55),
  cast: (f) => [
    stand(PINO, "pino", [240.1, 0, 2.9], 71, f, [[0, "smile"], [F(tRule) - 2, "stern"], [F(tCharged), "grin"]], [[0, {}], [F(tRule) - 2, { r: [0.15, -1.05] }], [F(tSix) + 6, { l: [0.3, -0.4], r: [-0.3, -0.4] }]], { facing: 0, talk: talkAt(f, [[F(tRule) - 2, F(tYears) + 4]], 4) }, { clip: above(238, 242, 0.81, 2.0), noShadow: true }),
    stand(McGIN, "mcg", [241.3, 0, 2.3], 72, f, [[0, "neutral"], [F(tSix), "shock"], [F(tCharged), "grin"]], [[0, {}]], { facing: -1 }, { noShadow: true }),
    stand(GANG3, "g3", [238.9, 0, 2.3], 73, f, [[0, "smile"], [F(tSix), "nervous"], [F(tCharged), "laugh"]], [[0, {}]], { facing: 1 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    if (f >= F(tSix)) stampW(g, "6 YEARS", f, F(tSix), F(tLaw) - 4, 540, 420, 620, -0.12);
    if (f >= F(tLaw) - 2) lawBook(g, 540, 460, 360, easeOutBack(clamp01((f - F(tLaw) + 2) / 8), 1.6) * (1 - smooth((f - F(tCharged) + 2) / 5)), "THE LAW", "6-YEAR LIMIT");
    const lump = v.w([236.4, 0.9, 3.4]), m = v.ppm([236.4, 0.9, 3.4]);
    if (f >= F(tCharged) - 2) { const k = easeOutBack(clamp01((f - F(tCharged) + 2) / 8), 1.8); g.save(); g.translate(lump[0], lump[1] - (1 - k) * 300); padlock(g, 0, 0, m * 0.35, 1); g.restore(); }
  },
});

// 15 — "Year one. Year three. Year five. Almost free."  (the hideout wall calendar flips 1951 -> 1953 -> 1955; the gang's
//      grins get wider; a clock ticks)
const C15 = F(tThen2) - 3;
add({
  a: C14, b: C15, plate: "hide", xfade: 4,
  keys: [{ f: C14, at: [240.2, 1.45, 2.6], z: 1.55, creep: 0.004 }],
  kicks: [[F(tFree), 0.3]],
  under: (g, v, f) => nightGrade(g, v, [[240, 2.6, 2.2]], f, 0.5),
  cast: (f) => [
    stand(PINO, "pino", [240.1, 0, 2.9], 71, f, [[0, "smile"], [F(tThree), "grin"], [F(tFive), "relief_open"], [F(tFree), "laugh"]], [[0, { l: [0.3, -0.4], r: [-0.3, -0.4] }]], { facing: 0 }, { clip: above(238, 242, 0.81, 2.0), noShadow: true }),
    stand(McGIN, "mcg", [241.3, 0, 2.3], 72, f, [[0, "smile"], [F(tFive), "grin"], [F(tFree), "laugh"]], [[0, {}]], { facing: -1 }, { noShadow: true }),
    stand(GANG3, "g3", [238.9, 0, 2.3], 73, f, [[0, "smile_closed"], [F(tThree), "grin"], [F(tFree), "laugh"]], [[0, {}]], { facing: 1 }, { noShadow: true }),
  ],
  over: (g, v, f) => {
    const steps: [number, string][] = [[F(tYear1), "1951"], [F(tThree), "1953"], [F(tFive), "1955"]]; let cur = "1950", prev: string | null = null, u = 1;
    for (const [t0, l] of steps) if (f >= t0 - 2) { prev = cur; cur = l; u = clamp01((f - t0 + 2) / 5); }
    calendar(g, 540, 300, 230, cur, prev, u, 1);
    if (f >= F(tAlmost)) counter(g, 540, 640, "ALMOST FREE", easeOutBack(clamp01((f - F(tAlmost)) / 7), 1.8), "#9fe08a", 96);
  },
});

// 16 — "Then one of them, a man called Specs, got arrested for something else."  (a street by day: Specs, glasses, gets
//      the cuffs from a cop)
const C16 = F(tAnd5) - 3;
add({
  a: C15, b: C16, plate: "ext_day", xfade: 6,
  keys: [{ f: C15, at: [0.0, 1.5, 4.6], z: 1.5, creep: 0.003 }, { f: F(tArrested) - 4, dur: 10, at: [0.1, 1.3, 4.5], z: 1.8, creep: 0.004 }],
  kicks: [[F(tArrested) + 4, 0.5]],
  cast: (f) => [
    stand(SPECS, "specs", [-0.2, 0, 4.6], 81, f, [[0, "smile"], [F(tArrested), "shock"], [F(tArrested) + 12, "nervous"]], [[0, {}], [F(tArrested), { l: [0.25, -0.2], r: [-0.25, -0.2] }]], { facing: 1 }, { noShadow: true }),
    ...(f >= F(tSpecs) + 4 ? [stand(COP, "cop", [0.75, 0, 4.4], 82, f, [[0, "stern"]], [[0, { r: [-0.5, -0.3] }]], { facing: -1 }, { alpha: clamp01((f - F(tSpecs) - 4) / 5), noShadow: true })] : []),
  ],
  over: (g, v, f) => { const hd = v.w([-0.2, 1.75, 4.6]); label(g, hd[0], hd[1] - 70, "SPECS O'KEEFE", f - F(tSpecs)); if (f >= F(tArrested) + 2) { const hp = v.w([-0.2, 0.98, 4.4]), m = v.ppm([-0.2, 1, 4.4]); cuffs(g, hp[0], hp[1], m * 0.16, 1 - clamp01((f - F(tArrested) - 2) / 5)); } },
});

// 17 — "And his share of the money... vanished."  (the hideout corner: his suitcase pops open - empty - a moth flutters out)
const C17 = F(tFurious) - 4;
add({
  a: C16, b: C17, plate: "hide", xfade: 6,
  keys: [{ f: C16, at: [239.4, 0.9, 2.6], z: 1.4, creep: 0.004 }],
  kicks: [[F(tVanished) + 2, 0.4]],
  under: (g, v, f) => nightGrade(g, v, [[240, 2.6, 2.2]], f, 0.55),
  over: (g, v, f) => {
    const p: P2 = [470, 1040], m = 560, open = easeOutBack(clamp01((f - F(tVanished) + 3) / 8), 1.4);
    suitcase(g, p[0], p[1], m, open * 0.75); label(g, p[0], p[1] - 330, "SPECS' SHARE", f - F(tShare));
    if (open > 0.3) counter(g, p[0], p[1] - 40, "$0", clamp01((f - F(tVanished) - 3) / 6), "#e04040", 110);
    const age = f - F(tVanished) - 2; if (age > 0) moth(g, p[0] + Math.sin(age * 0.3) * 50 + age * 4, p[1] - 120 - age * 12, 60, age);
  },
});

// 18 — "He got furious."  (behind bars: Specs grits his teeth, steam from his ears)
const C18 = F(tSo1) - 3;
add({
  a: C17, b: C18, plate: "corr_cu", xfade: 4,
  keys: [{ f: C17, at: [60.0, 1.55, 3.6], z: 2.0, creep: 0.006, punch: 0.01, pn: 10 }],
  kicks: [[F(tFurious) + 1, 0.8]],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.75),
  cast: (f) => [stand(SPECS, "specs", [60.0, 0, 3.6], 81, f, [[0, "angry"], [F(tFurious), "grit"]], [[0, { l: [0.4, -0.3], r: [-0.4, -0.3] }]], { facing: 0, headTilt: Math.sin(f * 1.3) * 2 }, { noShadow: true })],
  over: (g, v, f) => { const hd = v.w([60, 1.7, 3.6]); fume(g, hd[0], hd[1] - 60, 120, f, clamp01((f - F(tFurious)) / 6)); jailBars(g, 1); },
});

// 19 — "So the gang hired a hitman to shut him up."  (a dark street: a hitman in a black fedora steps out of the shadow;
//      the boss slides him an envelope)
const C19 = F(tShot) - 3;
add({
  a: C18, b: C19, plate: "ext_w", xfade: 6,
  keys: [{ f: C18, at: [-4.5, 1.45, 4.3], z: 2.6, creep: 0.004 }],
  under: (g, v, f) => nightGrade(g, v, EXT_POOLS, f, 1.15),
  cast: (f) => [
    stand(HITMAN, "hit", [-4.0, 0, 4.4], 91, f, [[0, "stern"], [F(tShutUp), "grin"]], [[0, {}], [F(tHired) + 4, { l: [0.4, -0.3] }]], { facing: -1 }, { alpha: clamp01((f - F(tHit) + 6) / 8), noShadow: true }),
    stand(PINO, "pino", [-5.1, 0, 4.2], 71, f, [[0, "stern"]], [[0, { r: [0.45, -0.35] }]], { facing: 1 }, { noShadow: true }),
  ],
  over: (g, v, f) => { const ep = v.w([-4.55, 1.05, 4.3]), m = v.ppm([-4.5, 1, 4.3]); if (f >= F(tHired)) { g.save(); g.translate(ep[0], ep[1]); g.rotate(0.1); g.fillStyle = "#e9dcc0"; g.strokeStyle = INK; g.lineWidth = 4; g.fillRect(-m * 0.12, -m * 0.07, m * 0.24, m * 0.14); g.strokeRect(-m * 0.12, -m * 0.07, m * 0.24, m * 0.14); g.fillStyle = "#3f7a4a"; g.font = `900 ${m * 0.08}px Georgia`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 0, 0); g.restore(); } },
});

// 20 — "He got shot..."  (a white flash and a hard camera kick)  "...and survived."  (the hospital: Specs bandaged in bed,
//      the heart monitor beeping, a stubborn thumbs-up)
const C20 = F(tSo2) - 3;
add({
  a: C19, b: C20, plate: "hosp", xfade: 2,
  keys: [{ f: C19, at: [300, 1.25, 3.1], z: 1.7, creep: 0.004 }],
  kicks: [[C19 + 1, 1.4], [F(tSurvived) + 2, 0.4]],
  under: (g, v, f) => nightGrade(g, v, [[300, 2.5, 2.4]], f, 0.45, "210,230,255"),
  cast: (f) => [stand(SPECS, "specs", [300, 0.45, 3.15], 81, f, [[0, "dazed"], [F(tSurvived), "grit"], [F(tSurvived) + 10, "smile"]], [[0, {}], [F(tSurvived) + 8, { r: [0.15, -0.95] }]], { facing: 0 }, { clip: above(298, 302, 0.8, 1.66), noShadow: true })],
  over: (g, v, f) => {
    const hd = v.w([300, 1.95, 3.15]), m = v.ppm([300, 1.9, 3.15]);
    g.save(); g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(hd[0] - m * 0.24, hd[1] - m * 0.09, m * 0.48, m * 0.08, m * 0.03); g.fill(); g.stroke(); g.fillStyle = "#e04040"; g.beginPath(); g.arc(hd[0] + m * 0.12, hd[1] - m * 0.05, m * 0.02, 0, 7); g.fill(); g.restore();
    const bl = v.w([300, 0.82, 2.2]), bw = v.ppm([300, 0.82, 2.2]); g.save(); g.fillStyle = "#cfe0ea"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.roundRect(bl[0] - bw * 0.95, bl[1] - bw * 0.42, bw * 1.9, bw * 0.55, bw * 0.08); g.fill(); g.stroke(); g.strokeStyle = "rgba(90,120,140,0.5)"; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(bl[0] - bw * 0.7 + i * bw * 0.45, bl[1] - bw * 0.35); g.quadraticCurveTo(bl[0] - bw * 0.6 + i * bw * 0.45, bl[1] - bw * 0.1, bl[0] - bw * 0.72 + i * bw * 0.45, bl[1] + bw * 0.08); g.stroke(); } g.fillStyle = "#ffffff"; g.fillRect(bl[0] - bw * 0.93, bl[1] - bw * 0.42, bw * 1.86, bw * 0.08); g.restore();
    ecg(g, 860, 420, 300, 170, f, f < F(tSurvived) - 2 ? 0.3 : 1);
    flash(g, f - C19, 1);
  },
});

// 21 — "So when the FBI came to visit... Specs talked."  (two G-men in fedoras lean over the bed; Specs talks; the names
//      pour out in a speech bubble)
const C21 = F(tThe9) - 3;
add({
  a: C20, b: C21, plate: "hosp", xfade: 4,
  keys: [{ f: C20, at: [300, 1.45, 2.9], z: 1.05, creep: 0.003 }, { f: F(tTalked) - 4, dur: 10, at: [300, 1.6, 3.1], z: 1.35, creep: 0.004 }],
  under: (g, v, f) => nightGrade(g, v, [[300, 2.5, 2.4]], f, 0.4, "210,230,255"),
  cast: (f) => [
    stand(SPECS, "specs", [300, 0.45, 3.15], 81, f, [[0, "nervous"], [F(tTalked), "smile"]], [[0, {}]], { facing: 0, talk: talkAt(f, [[F(tTalked) - 1, C21 + 4]], 6) }, { clip: above(298, 302, 0.8, 1.66), noShadow: true }),
    stand(FBI1, "fbi1", [300.72, 0, 4.0], 92, f, [[0, "stern"], [F(tTalked) + 6, "grin"]], [[0, {}]], { facing: -1 }, { alpha: clamp01((f - F(tFBI) + 2) / 6), noShadow: true, clip: above(297, 303, 1.3, 3.8) }),
    stand(FBI2, "fbi2", [299.28, 0, 4.0], 93, f, [[0, "stern"], [F(tTalked) + 8, "grin"]], [[0, {}]], { facing: 1 }, { alpha: clamp01((f - F(tFBI)) / 6), noShadow: true, clip: above(297, 303, 1.3, 3.8) }),
  ],
  over: (g, v, f) => {
    const hd = v.w([300, 1.95, 3.15]), m = v.ppm([300, 1.9, 3.15]); g.save(); g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(hd[0] - m * 0.24, hd[1] - m * 0.09, m * 0.48, m * 0.08, m * 0.03); g.fill(); g.stroke(); g.restore();
    const bl = v.w([300, 0.82, 2.2]), bw = v.ppm([300, 0.82, 2.2]); g.save(); g.fillStyle = "#cfe0ea"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.roundRect(bl[0] - bw * 0.95, bl[1] - bw * 0.42, bw * 1.9, bw * 0.55, bw * 0.08); g.fill(); g.stroke(); g.strokeStyle = "rgba(90,120,140,0.5)"; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(bl[0] - bw * 0.7 + i * bw * 0.45, bl[1] - bw * 0.35); g.quadraticCurveTo(bl[0] - bw * 0.6 + i * bw * 0.45, bl[1] - bw * 0.1, bl[0] - bw * 0.72 + i * bw * 0.45, bl[1] + bw * 0.08); g.stroke(); } g.fillStyle = "#ffffff"; g.fillRect(bl[0] - bw * 0.93, bl[1] - bw * 0.42, bw * 1.86, bw * 0.08); g.restore();
    label(g, 540, 300, "FBI", f - F(tFBI));
    bubble(g, 540, 560, "PINO. McGINNIS. COSTA...", f - F(tTalked) - 2, [hd[0], hd[1] - 30], 52);
  },
});

// 22 — "The gang was arrested five days before the clock ran out."  (by day at the Brink's door: the gang in a row get
//      cuffed one by one; a countdown 5 DAYS LEFT; a mugshot camera flash)
const C22 = F(tThey1) - 3;
add({
  a: C21, b: C22, plate: "ext_day", xfade: 6,
  keys: [{ f: C21, at: [0.4, 1.4, 4.6], z: 1.2, creep: 0.003 }],
  kicks: [[F(tFiveD) + 2, 0.5], [F(tOut), 0.4]],
  cast: (f) => [PINO, McGIN, GANG3].map((o, i) => stand(o, "arr" + i, [-0.9 + i * 0.95, 0, 4.7], 700 + i, f, [[0, "nervous"], [F(tArrested2) + i * 4, "shock"], [F(tOut), "dazed"]], [[0, { l: [0.2, -0.15], r: [-0.2, -0.15] }]], { facing: 0 }, { noShadow: true })),
  over: (g, v, f) => {
    [0, 1, 2].forEach((i) => { const t0 = F(tArrested2) + i * 4; if (f < t0) return; const hp = v.w([-0.9 + i * 0.95, 0.98, 4.5]), m = v.ppm([0, 1, 4.5]); cuffs(g, hp[0], hp[1], m * 0.14, 1 - clamp01((f - t0) / 4)); });
    if (f >= F(tFiveD) - 2) { const k = easeOutBack(clamp01((f - F(tFiveD) + 2) / 7), 1.8); g.save(); g.translate(540, 400); g.scale(k, k); calendar(g, 0, -40, 260, "5 DAYS", null, 1, 1); g.restore(); }
    if (f >= F(tClock)) stampW(g, "CAUGHT", f, F(tClock), C22 + 4, 540, 720, 520, -0.14);
    flash(g, f - F(tFiveD) - 6, 0.6);
  },
});

// 23 — "They had a key for every door in that building..."  (the key ring, every key, fans out over the corridor)
const C23 = F(tThey2) - 3;
add({
  a: C22, b: C23, plate: "corr_w", xfade: 6,
  keys: [{ f: C22, at: [60, 1.4, 4.0], z: 1.3, creep: 0.003 }],
  under: (g, v, f) => nightGrade(g, v, CORR_POOLS, f, 0.6),
  over: (g, v, f) => { const k = easeOutBack(clamp01((f - F(tEvery) + 4) / 10), 1.4); keyRing(g, 540, 940, 250, 9, (f - C22) * 0.4, 0.4 + 0.9 * k); sparkle(g, 700, 780, 40, f - F(tDoorEnd)); },
});

// 24 — "...they just couldn't keep one mouth shut."  (Specs, close, sheepish: his hand claps over his mouth, a wink)
add({
  a: C23, b: TOTAL, plate: "ext_day", xfade: 4,
  keys: [{ f: C23, at: [0.0, 1.6, 4.6], z: 2.1, creep: 0.004 }],
  kicks: [[F(tShut2) + 2, 0.4]],
  cast: (f) => [stand(SPECS, "specs", [0.0, 0, 4.6], 81, f, [[0, "nervous"], [F(tMouth), "smile_closed"]], [[0, {}], [F(tMouth) - 4, { r: [-0.2, -0.95] }]], { facing: 0, headTilt: f > F(tShut2) ? 6 : 0 }, { noShadow: true })],
  over: (g, v, f) => { const hd = v.w([0.0, 1.75, 4.6]); sparkle(g, hd[0] - 90, hd[1] - 70, 40, f - F(tShut2) - 2); },
});

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
