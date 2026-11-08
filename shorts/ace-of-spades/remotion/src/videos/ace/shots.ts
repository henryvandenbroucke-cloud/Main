// Timeline of "Why the Ace of Spades Is So Fancy", timed to the voice's words.json (every event hangs off a word).
// Reference-style staging: giant deadpan foreground faces over soft backgrounds, a moonlit-blue night, toy-bright
// interiors; satisfying micro-motion on every beat (string draw-ons, flipping calendars, cut-out letters popping in,
// slamming bars, stamps, nodding jurors).
import { Outfit, FrontOpts, INK, Expr, townsfolk, P2 } from "./toon";
import { V3 } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import { stampMark, puff, ringWaves, qmark, emark, card, fan, deck, hand, spadePath } from "./props2d";
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
  const h = poseAt(f, hands);
  return { o, okey, P, seed, ...act, opts: { mode: "stand", expr: exprAt(f, ex), blink: lidAt(f, seed, swaps(ex)), tilt: bob(f + seed * 7), hands: h, ...extra } };
};
/** side-view walker along x (+x is screen-left on the road plate) */
const walker = (o: Outfit, okey: string, seed: number, f: number, path: [number, number, number][], expr: Expr, act: Partial<Actor> = {}): Actor => {
  const w = walkAt(f, path);
  return { o, okey, P: [w.x, 0, w.z], seed, opts: {}, mirror: w.dir[0] > 0, ...act,
    side: { mode: w.moving ? "march" : "stand", phase: w.moving ? w.phase : 0, expr, blink: lidAt(f, seed), stomp: 0.3, stride: w.moving ? 0.8 : 0.01 } };
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

// ---------------- word anchors (seconds) ----------------
const tHanged = A("hanged"), tPrinting = A("printing"), tAce1 = A("ace", tPrinting), tSpades1 = A(["spades", "spades,"], tAce1), tReason = A("reason"), tDeck1 = A("deck"), tFancy = A("fancy");
const tIts = A("it's", tFancy), tLondon = A("london"), tEveryone = A("everyone's"), tCards = A("cards", tEveryone), tGov = A("government"), tCut = A("cut"), tEvery = A("every", tCut), tPack = A("pack", tEvery), tTaxed = A("taxed", tPack);
const tProve = A("prove"), tTaxed2 = A("taxed", tProve), tEasy = A("easy"), tPrints = A("prints"), tItself = A("itself"), tAce2 = A("ace", tItself), tSpades2 = A(["spades", "spades."], tAce2);
const tMakers = A("makers"), tPrint = A("print", tMakers), t51 = A(["51", "fifty-one"]), tBuy = A("buy"), tOffice = A("office", tBuy), tCovered = A("covered"), tSwirls = A("swirls"), tCopy = A("copy");
const tMeans = A("means", tCopy), tFakes = A("fakes"), tSkips = A("skips");
const tMeet = A("meet"), tRichard = A("richard", tMeet), tMaker = A("maker", tRichard), tStarts = A("starts"), tOwn = A("own", tStarts), tCheaper = A("cheaper"), tBigger = A("bigger"), tProfits = A("profits");
const tUntil = A("until"), tCustomer = A("customer"), tBuys = A("buys"), tTurns = A("turns"), tWork = A("work"), tOffice2 = A("office", tWork);
const tWait = A("wait"), tHang = A("hang"), tCard3 = A("card?", tHang), tYup = A(["yup", "yep"]), tFaking = A("faking"), tForgery = A("forgery"), tDeath = A("death");
const tNovember = A("november"), tRichard2 = A("richard", tNovember), tHanged2 = A("hanged", tRichard2);
const tCardTax = A("card", tHanged2), t1960 = A(["1960", "1960,"]), tKept = A("kept"), tFancy2 = A("fancy", tKept), tAnyway = A("anyway");
const tEveryTime = A("every", tAnyway), tShuffle = A("shuffle"), tDeck2 = A("deck", tShuffle), tHolding = A("holding"), tReceipt = A("receipt");

// ---------------- cast (white heads) ----------------
const WHITE = "#f8f6f1";
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, skin: WHITE, ...o } as Outfit);
const RICHARD = O({ jacket: "#6b4a2e", pants: "#3a3530", boots: "#2a2420", hat: "cap", cap: "#3a3f52", moustache: "#3a2a20", buttons: "#c9a23a" });
const TAXMAN = O({ jacket: "#2c3140", pants: "#2b2b35", hat: "tophat", buttons: "#c9ccd2", build: "stout", moustache: "#5a3b2a" });
const CLERK1 = O({ jacket: "#3f4a6b", pants: "#2b2b35", hat: "hair", hair: "#e9e6e0", buttons: "#c9a23a" });
const CLERK2 = O({ jacket: "#4a5a3a", pants: "#2b2b35", hat: "hair", hair: "#3a2a20" });
const HOCKLEY = O({ jacket: "#5d6068", pants: "#3b3f52", hat: "tophat", buttons: "#e8c45a", moustache: "#c9ccd2" });
const JUDGE = O({ jacket: "#8c2f39", pants: "#8c2f39", hat: "hair", hair: "#f4f1ea", buttons: "#e8c45a", build: "stout" });
const PLAYERS = [0, 1, 2, 3].map((v) => ({ ...townsfolk(v + 1), skin: WHITE } as Outfit));
const FOLKS = [0, 1, 2, 3, 4, 5].map((v) => ({ ...townsfolk(v), skin: WHITE } as Outfit));

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

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const BED: V3 = [0, 1.07, 3.35];
/** where Richard holds a card up in the shop close-ups: beside his head, never over his face */
const held = (v: { w: (p: V3) => number[]; ppm: (p: V3) => number }) => { const c = v.w([0, 1.5, 4.0]), m = v.ppm([0, 1.5, 4.0]); return [c[0] + m * 0.33, c[1] + m * 0.1]; };
const SHOP_POOLS: V3[] = [[3.9, 1.3, 2.0], [-2.6, 1.4, 4.6], [0, 1.3, 3.35]];
const printerAt = (f: number, P: V3, ex: [number, Expr][], hands: [number, Hands][], extra: Partial<FrontOpts> = {}, act: Partial<Actor> = {}) => stand(RICHARD, "rich", P, 11, f, ex, hands, { facing: 0, ...extra }, act);

// 1 — HOOK. Frame 1 is tight on the fresh Ace of Spades on the press; the camera zooms out fast (whoosh) to reveal
//      Richard lifting it off by candlelight: "In 1805, a man was hanged..."
const C1 = F(tHanged) - 5;
{
  add({
    a: 0, b: C1, plate: "shop_cu",
    keys: [{ f: 0, at: BED, z: 2.9, creep: 0 }, { f: 1, dur: 24, at: [0, 1.45, 3.6], z: 1.12, creep: 0.0025 }],
    kicks: [[1, 0.5]],
    under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f),
    cast: (f) => [printerAt(f, [0, 0, 4.25], [[0, "grin"]], [[0, { l: [0.35, 0.15], r: [-0.35, 0.15] }], [10, { l: [0.3, -0.35], r: [-0.3, -0.35] }]], {}, { clip: above(-3, 3, 1.0, 2.6), noShadow: true })],
    over: (g, v, f) => {
      const bed = v.w(BED), m = v.ppm(BED), lift = clamp01((f - 4) / 18);
      const hand0 = held(v);
      const x = bed[0] + (hand0[0] - bed[0]) * easeOut(lift), y = bed[1] + (hand0[1] - bed[1]) * easeOut(lift);
      puffs(g, bed[0], bed[1], m * 0.34, f - 1, 6, true);
      g.save(); g.translate(x, y); g.scale(1, 0.42 + 0.58 * easeOut(lift)); card(g, 0, 0, m * 0.26, 0.08 * lift, { face: "ace", shadow: lift > 0.5, glow: 0.4 * lift }); g.restore();
      const cdl = v.w([3.9, 1.27, 2.0]); flame(g, cdl[0], cdl[1], v.ppm([3.9, 1.27, 2.0]) * 0.05, f);
    },
  });
}
// 2 — "...hanged"  (the judge's gavel slams in the dark)
const C2 = F(tPrinting) - 4;
add({
  a: C1, b: C2, plate: "court_n",
  keys: [{ f: C1, at: [180, 2.55, 5.6], z: 1.18, roll: 0.05, creep: 0.006 }],
  kicks: [[F(tHanged) + 2, 1.4]],
  cast: (f) => [stand(JUDGE, "judge", [180, 1.0, 5.6], 51, f, [[0, "stern"]], [[0, { r: [0.45, -0.55] }]], { facing: 0 }, { clip: above(177, 183, 1.95, 4.85), noShadow: true })],
  over: (g, v, f) => {
    darkGrade(g, 0.8, [540, 700]);
    const hd = v.w([179.55, 2.25, 5.0]), m = v.ppm([180, 2.2, 5.0]), H = F(tHanged);
    const a = f < H - 5 ? 0 : f < H ? (f - H + 5) / 5 : 1 - clamp01((f - H) / 8) * 0.3;
    g.save(); g.translate(hd[0], hd[1]); g.rotate(-1.0 + a * 1.1); g.fillStyle = "#8c5a2a"; g.fillRect(-m * 0.03, -m * 0.6, m * 0.06, m * 0.6); g.lineWidth = 4; g.strokeStyle = INK; g.strokeRect(-m * 0.03, -m * 0.6, m * 0.06, m * 0.6); g.beginPath(); g.roundRect(-m * 0.18, -m * 0.72, m * 0.36, m * 0.15, m * 0.04); g.fillStyle = "#6b3f1f"; g.fill(); g.stroke(); g.restore();
    if (f >= H) { const b = v.w([179.3, 1.95, 5.0]); puffs(g, b[0], b[1], m * 0.25, f - H, 6, true); ringWaves(g, b[0], b[1], m * 0.15, f - H, 1, 3, "255,236,200"); }
  },
});
// 3 — "...for printing the Ace of Spades."  (back in the shop: Richard gulps; the ace's swirls blaze as the camera pushes in)
const C3 = F(tReason) - 6;
add({
  a: C2, b: C3, plate: "shop_cu",
  keys: [{ f: C2, at: [0, 1.5, 3.9], z: 1.25, creep: 0.003 }, { f: F(tAce1) - 4, dur: 14, at: [-0.17, 1.62, 4.0], z: 1.5, creep: 0.003 }],
  kicks: [[F(tSpades1), 0.4]],
  under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f),
  cast: (f) => [printerAt(f, [0, 0, 4.25], [[0, "nervous"]], [[0, { l: [0.3, -0.35], r: [-0.3, -0.35] }]], { headTilt: Math.sin(f * 0.3) * 3 }, { clip: above(-3, 3, 1.0, 2.6), noShadow: true })],
  over: (g, v, f) => {
    const c = held(v), m = v.ppm([0, 1.5, 4.0]), shake = f < F(tAce1) ? Math.sin(f * 1.7) * 2 : 0;
    card(g, c[0] + shake, c[1], m * 0.26, 0.08, { face: "ace", flourish: clamp01((f - F(tAce1) + 4) / 14) * 0.5 + 0.5, glow: clamp01((f - F(tAce1)) / 8) });
    const cdl = v.w([3.9, 1.27, 2.0]); flame(g, cdl[0], cdl[1], v.ppm([3.9, 1.27, 2.0]) * 0.05, f);
  },
});
// 4 — "And it's the reason the ace in your deck still looks so fancy."  (today: a hand fans a deck, the ace slides up and glows)
const C4 = F(tIts) - 4;
add({
  a: C3, b: C4, plate: "today", xfade: 6,
  keys: [{ f: C3, at: [240, 0.82, 2.5], z: 1.1, creep: 0.003 }],
  kicks: [[F(tFancy), 0.3]],
  under: (g) => warmGrade(g),
  over: (g, v, f) => {
    const c = v.w([240, 0.81, 2.5]), m = v.ppm([240, 0.8, 2.5]);
    const spread = easeOutBack(clamp01((f - F(tDeck1) + 6) / 12), 1.3);
    fan(g, c[0], c[1] + m * 0.12, m * 0.22, 9, spread, 0, false);
    const up = easeOutBack(clamp01((f - F(tFancy) + 6) / 10), 1.6);
    card(g, c[0], c[1] - m * 0.05 - up * m * 0.25, m * 0.24, 0, { face: "ace", glow: up });
    hand(g, c[0] + m * 0.08, c[1] + m * 0.22, m * 0.09, -1.4, 0.4);
  },
});
// 5 — "It's the 1700s, London. Everyone's playing cards, and the government wants a cut. So every single pack gets taxed."
const C5 = F(tProve) - 6;
{
  const seats: V3[] = [[121.2, 0, 2.2], [118.8, 0, 2.2], [121.0, 0, 3.6], [119.0, 0, 3.6]];
  const DEAL = F(tEveryone) - 4, GOV = F(tGov), EVERY = F(tEvery);
  add({
    a: C4, b: C5, plate: "tav_g", xfade: 6,
    keys: [{ f: C4, at: [120, 1.2, 2.6], z: 1.12, creep: 0.002 }, { f: GOV - 6, dur: 16, at: [121.2, 1.35, 2.2], z: 1.2, creep: 0.002 }, { f: EVERY - 6, dur: 12, at: [120, 0.95, 2.6], z: 1.35, creep: 0.002 }],
    kicks: [[EVERY + 4, 0.4], [EVERY + 12, 0.4], [EVERY + 20, 0.5]],
    under: (g) => warmGrade(g),
    cast: (f) => [
      ...seats.map((P, i) => stand(PLAYERS[i], "p" + i, P, 21 + i, f, [[0, i % 2 ? "grin" : "smile"], [GOV + 4, "nervous"]], [[0, { l: [0.35, -0.1], r: [-0.35, -0.1] }], [DEAL + i * 4, { r: [-0.1, -0.5] }], [DEAL + 10 + i * 4, { l: [0.35, -0.1], r: [-0.35, -0.1] }]], { mode: "sit", facing: P[0] > 120 ? -1 : 1 }, { noShadow: true })),
      ...(f >= GOV - 10 ? [walker(TAXMAN, "tax", 31, f, [[GOV - 10, 123.6, 1.4], [GOV + 8, 122.1, 1.6]], "stern")] : []),
    ],
    over: (g, v, f) => {
      const ctr = v.w([120, 0.82, 2.6]), m = v.ppm([120, 0.8, 2.6]);
      // the dealer flicks a card to each seat, again and again
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const t0 = DEAL + r * 16 + i * 4, u = (f - t0) / 10; const to = v.w([seats[i][0] * 0.55 + 120 * 0.45, 0.82, seats[i][2] * 0.55 + 2.6 * 0.45]); cardFly(g, ctr, to, u, m * 0.1, 3 + i, { face: "back" }, 0.25); if (u >= 1) cardFlat(g, to[0], to[1], m * 0.1, 0.5, i * 0.4, { face: "back" }); }
      deck(g, ctr[0], ctr[1], m * 0.1, 8);
      for (const P of seats) { const p = v.w([P[0] * 0.42 + 120 * 0.58, 0.86, P[2] * 0.42 + 2.6 * 0.58]); prop(g, "cup", p[0], p[1], m * 0.11); }
      // the taxman stamps each pack on the table: thunk, thunk, thunk
      for (let i = 0; i < 3; i++) { const t0 = EVERY + i * 8, p = v.w([120.6 - i * 0.6, 0.83, 2.2]); const drop = clamp01((f - t0 + 6) / 6); deck(g, p[0], p[1] - (1 - drop) * m * 0.2, m * 0.09, 5); if (f >= t0) { seal(g, p[0], p[1] - m * 0.05, m * 0.06, f - t0, -0.3 + i * 0.2); puffs(g, p[0], p[1], m * 0.06, f - t0, 4, true); } }
      const cd = v.w([120.6, 0.81, 3.0]); flame(g, cd[0], cd[1] - m * 0.25, m * 0.03, f);
    },
  });
}
// 6 — "But how do you prove a pack was taxed?"  (close on a pack in the taxman's hand, turned over and over; a puzzled tilt)
const C6 = F(tEasy) - 4;
add({
  a: C5, b: C6, plate: "tav_cu", xfade: 6,
  keys: [{ f: C5, at: [120, 0.95, 2.4], z: 1.15, roll: -0.04, creep: 0.004 }],
  kicks: [[F(tTaxed2), 0.3]],
  under: (g) => warmGrade(g),
  cast: (f) => [stand(TAXMAN, "tax", [120.15, 0, 3.2], 31, f, [[0, "nervous"], [F(tTaxed2), "dazed"]], [[0, { r: [0.1, -0.6] }], [F(tTaxed2), { l: [-0.3, -1.05], r: [0.1, -0.6] }]], { facing: 0, headTilt: 8 }, { clip: above(118, 122, 0.82, 1.7), noShadow: true })],
  over: (g, v, f) => {
    const p = v.w([120.05, 1.25, 2.9]), m = v.ppm([120, 1.2, 2.9]);
    const flip = (f * 0.06) % 1;
    card(g, p[0], p[1], m * 0.16, Math.sin(f * 0.1) * 0.1, { face: flip < 0.5 ? "back" : "num", flip, suit: 2 });
    qmark(g, p[0] + m * 0.3, p[1] - m * 0.35, m * 0.18, f - F(tProve), 0.15);
    qmark(g, p[0] - m * 0.3, p[1] - m * 0.3, m * 0.14, f - F(tTaxed2), -0.2);
  },
});
// 7 — "Easy. The government prints one card itself... the Ace of Spades."  (the Stamp Office press slams; an ace rises)
const C7 = F(tMakers) - 4;
add({
  a: C6, b: C7, plate: "tax_d", xfade: 6,
  keys: [{ f: C6, at: [60, 1.6, 2.7], z: 1.12, creep: 0.002 }, { f: F(tPrints) - 6, dur: 12, at: [65.6, 1.5, 4.0], z: 1.3, creep: 0.003 }],
  kicks: [[F(tPrints) + 4, 0.8]],
  cast: (f) => [
    stand(CLERK1, "cl1", [58.6, 0, 3.6], 41, f, [[0, "smile_closed"], [F(tSpades2), "grin"]], [[0, { l: [0.3, 0.3], r: [-0.3, 0.3] }]], { facing: 0 }, { clip: above(55, 65, 1.12, 2.4), noShadow: true }),
    stand(CLERK2, "cl2", [61.4, 0, 3.6], 42, f, [[0, "neutral"]], [[0, { r: [0.4, -0.4] }]], { facing: 0 }, { clip: above(55, 65, 1.12, 2.4), noShadow: true }),
    stand(CLERK1, "cl3", [64.8, 0, 3.0], 43, f, [[0, "stern"], [F(tPrints) + 4, "grin"]], [[0, { l: [0.5, -0.9], r: [0.3, -0.9] }], [F(tPrints), { l: [0.5, -0.2], r: [0.3, -0.2] }], [F(tPrints) + 12, { l: [0.5, -0.9], r: [0.3, -0.9] }]], { facing: 1 }),
  ],
  over: (g, v, f) => {
    const pr = v.w([65.8, 2.0, 4.0]), m = v.ppm([65.8, 2.0, 4.0]), P = F(tPrints);
    const down = f < P - 6 ? 0 : f < P ? (f - P + 6) / 6 : 1 - clamp01((f - P - 4) / 10);
    g.save(); g.fillStyle = "#3a3540"; g.strokeStyle = INK; g.lineWidth = 5; g.fillRect(pr[0] - m * 0.25, pr[1] - m * 0.6 + down * m * 0.45, m * 0.5, m * 0.18); g.strokeRect(pr[0] - m * 0.25, pr[1] - m * 0.6 + down * m * 0.45, m * 0.5, m * 0.18); g.restore();
    if (f >= P + 4) puffs(g, pr[0], pr[1] + m * 0.0, m * 0.25, f - P - 4, 6, true);
    // the fresh duty ace rises to centre screen, swirls drawing on
    if (f >= P + 6) { const u = easeOutBack(clamp01((f - P - 6) / 14), 1.3), x = pr[0] + (540 - pr[0]) * u, y = pr[1] + (760 - pr[1]) * u; card(g, x, y, 120 + 330 * u, 0.06 * (1 - u), { face: "ace", flourish: clamp01((f - F(tAce2) + 10) / 18), glow: 0.6 * u }); }
  },
});
// 8 — "Card makers print the other fifty-one..."  (Richard's shop, wide: 51 cards shoot out of the press into a stack)
const C8 = F(tBuy) - 4;
add({
  a: C7, b: C8, plate: "shop_n", xfade: 8,
  keys: [{ f: C7, at: [0.3, 1.4, 3.4], z: 1.15, creep: 0.002 }],
  under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f, 0.75),
  cast: (f) => [printerAt(f, [-0.95, 0, 2.6], [[0, "grin"]], [[0, { r: [0.55, -0.6] }], [F(tPrint) + 2, { r: [0.55, -0.1] }], [F(tPrint) + 8, { r: [0.55, -0.6] }]], { facing: -1 })],
  over: (g, v, f) => {
    const out = v.w([0.2, 1.08, 2.7]), st = v.w([2.9, 0.9, 2.0]), m = v.ppm([1.5, 1, 2.4]);
    const n = Math.floor(clamp01((f - F(tPrint) + 4) / (F(t51) - F(tPrint) + 10)) * 51);
    for (let i = Math.max(0, n - 4); i < n; i++) { const t0 = F(tPrint) - 4 + (i / 51) * (F(t51) - F(tPrint) + 10); cardFly(g, out, [st[0], st[1] - i * m * 0.004], (f - t0) / 7, m * 0.1, 2.5, { face: "num", suit: i }, 0.4); }
    for (let i = 0; i < Math.max(0, n - 4); i += 3) cardFlat(g, st[0], st[1] - i * m * 0.004, m * 0.1, 0.5, Math.sin(i) * 0.08, { face: "num", suit: i });
    if (n > 0) { g.save(); g.font = "900 120px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 22; g.strokeStyle = INK; g.strokeText(String(n), 540, 420); g.fillStyle = "#ffd24a"; g.fillText(String(n), 540, 420); g.restore(); }
    const cdl = v.w([3.9, 1.27, 2.0]); flame(g, cdl[0], cdl[1], v.ppm([3.9, 1.27, 2.0]) * 0.05, f);
  },
});
// 9 — "...then buy the ace from the tax office, covered in swirls nobody can copy."  (coins across the counter; the ace, huge)
const C9 = F(tMeans) - 6;
add({
  a: C8, b: C9, plate: "tax_d", xfade: 6,
  keys: [{ f: C8, at: [60.6, 1.5, 2.7], z: 1.2, creep: 0.002 }, { f: F(tSwirls) - 6, dur: 10, at: [60.6, 1.6, 2.7], z: 1.5, creep: 0.004 }],
  kicks: [[F(tOffice), 0.3]],
  cast: (f) => [
    stand(RICHARD, "rich", [61.2, 0, 1.9], 11, f, [[0, "smile_closed"], [F(tCovered), "dazed"]], [[0, { r: [-0.5, -0.5] }]], { facing: -1 }),
    stand(CLERK1, "cl1", [60.0, 0, 3.6], 41, f, [[0, "stern"]], [[0, { l: [0.6, -0.4] }]], { facing: 1 }, { clip: above(55, 65, 1.12, 2.4), noShadow: true }),
  ],
  over: (g, v, f) => {
    const a = v.w([61.0, 1.2, 2.2]), b = v.w([60.3, 1.15, 2.9]), m = v.ppm([60.5, 1.1, 2.6]);
    for (let i = 0; i < 4; i++) { const u = clamp01((f - C8 - 4 - i * 4) / 10); if (u > 0 && u < 1) prop(g, "coin", a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(Math.PI * u) * m * 0.3, m * 0.12, f * 0.3); }
    const S0 = F(tCovered) - 4;
    if (f >= F(tBuy)) { const u = easeOutBack(clamp01((f - S0) / 12), 1.3), x = b[0] + (540 - b[0]) * u, y = b[1] + (820 - b[1]) * u; card(g, x, y, m * 0.14 + (560 - m * 0.14) * u, 0.05 * (1 - u), { face: "ace", flourish: f < S0 ? 1 : clamp01((f - F(tSwirls) + 6) / 16), glow: 0.5 * u }); }
  },
});
// 10 — "...which means... whoever fakes the ace, skips the tax."  (by candlelight he copies it with a quill; a sly wink)
const C10 = F(tMeet) - 4;
add({
  a: C9, b: C10, plate: "shop_cu", xfade: 8,
  keys: [{ f: C9, at: [0, 1.25, 3.5], z: 1.3, roll: -0.05, creep: 0.004 }],
  kicks: [[F(tSkips), 0.4]],
  under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f, 1.1),
  cast: (f) => [printerAt(f, [0, 0, 4.25], [[0, "stern"], [F(tFakes), "grin"], [F(tSkips) + 4, "smile_closed"]], [[0, { r: [0.25, 0.05] }]], { headTilt: -6 }, { clip: above(-3, 3, 1.0, 2.6), noShadow: true })],
  over: (g, v, f) => {
    const bed = v.w(BED), m = v.ppm(BED);
    cardFlat(g, bed[0] - m * 0.12, bed[1], m * 0.22, 0.5, -0.08, { face: "ace" });
    const k = clamp01((f - F(tFakes) + 6) / 26);
    cardFlat(g, bed[0] + m * 0.14, bed[1], m * 0.22, 0.5, 0.06, { face: "ace", fake: true, flourish: k });
    const tip: P2 = [bed[0] + m * 0.14 + Math.cos(f * 0.5) * m * 0.05, bed[1] - m * 0.02 + Math.sin(f * 0.7) * m * 0.02];
    prop(g, "quill", tip[0] + m * 0.08, tip[1] - m * 0.12, m * 0.3, -0.6);
    flame(g, bed[0] - m * 0.45, bed[1] - m * 0.35, m * 0.04, f);
  },
});
// 11 — "Meet Richard Harding, a London card maker. He starts printing his own aces. Cheaper cards, bigger profits."
const C11 = F(tUntil) - 6;
add({
  a: C10, b: C11, plate: "shop_n", xfade: 6,
  keys: [{ f: C10, at: [-0.4, 1.5, 2.8], z: 1.25, creep: 0.002 }, { f: F(tStarts) - 6, dur: 16, at: [0.4, 1.4, 3.0], z: 1.12, creep: 0.002 }, { f: F(tCheaper) - 6, dur: 14, at: [2.4, 1.2, 2.2], z: 1.3, creep: 0.002 }],
  kicks: [[F(tOwn), 0.4], [F(tBigger), 0.3]],
  under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f, 0.75),
  cast: (f) => [
    printerAt(f, [-0.95, 0, 2.6], [[0, "grin"], [F(tCheaper), "laugh"]], [[0, { r: [0.1, -1.05] }], [F(tMaker) + 4, { r: [0.55, -0.6] }], [F(tCheaper), { l: [0.4, -0.7], r: [-0.4, -0.7] }]], { facing: F(tStarts) > f ? 0 : -1 }),
    ...(f >= F(tCheaper) - 10 ? [walker(FOLKS[2], "c1", 61, f, [[F(tCheaper) - 10, 4.5, 0.6], [F(tCheaper) + 8, 3.3, 1.2]], "grin"), walker(FOLKS[4], "c2", 62, f, [[F(tCheaper) - 4, 5.2, 0.2], [F(tCheaper) + 14, 4.0, 0.8]], "smile")] : []),
  ],
  over: (g, v, f) => {
    const hd = v.w([-0.95, 2.05, 2.6]); label(g, hd[0] + 40, hd[1] - 90, "RICHARD HARDING", f - F(tRichard));
    // the press runs: fake aces fly up to the drying line, one per thunk
    const out = v.w([0.2, 1.08, 2.7]), m = v.ppm([0.5, 1.2, 2.5]);
    for (let i = 0; i < 6; i++) { const t0 = F(tOwn) - 6 + i * 6, to = v.w([-1.8 + i * 0.7, 2.95, 2.2]); cardFly(g, out, to, (f - t0) / 9, m * 0.12, 2, { face: "ace", fake: true }, 0.3); if (f >= t0 + 9) card(g, to[0], to[1], m * 0.12, Math.sin(f * 0.1 + i) * 0.05, { face: "ace", fake: true }); }
    const n = Math.min(14, Math.max(0, Math.floor((f - F(tCheaper) + 4) / 2)));
    const st = v.w([3.4, 0.9, 2.2]); coinStack(g, st[0], st[1], m * 0.3, n, f);
    const cdl = v.w([3.9, 1.27, 2.0]); flame(g, cdl[0], cdl[1], v.ppm([3.9, 1.27, 2.0]) * 0.05, f);
  },
});
// 12 — "...until one customer buys a pack... and turns out to work for the tax office."  (the magnifier, the badge, the jaw drop)
const C12 = F(tWait) - 4;
add({
  a: C11, b: C12, plate: "shop_n", xfade: 6,
  keys: [{ f: C11, at: [1.0, 1.5, 2.2], z: 1.3, creep: 0.002 }, { f: F(tTurns) - 4, dur: 10, at: [1.6, 1.6, 2.0], z: 1.45, creep: 0.003, punch: 0.006, pn: 12 }],
  kicks: [[F(tWork) + 2, 0.8]],
  under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f, 0.75),
  cast: (f) => [
    printerAt(f, [0.3, 0, 2.3], [[0, "grin"], [F(tWork), "shock"]], [[0, { r: [0.4, -0.4] }], [F(tWork), { l: [0.3, -0.6], r: [-0.3, -0.6] }]], { facing: -1 }),
    stand(HOCKLEY, "hock", [1.9, 0, 1.9], 71, f, [[0, "smile"], [F(tBuys) + 6, "stern"], [F(tWork), "grin"]], [[0, { l: [0.3, -0.3] }], [F(tBuys) + 6, { l: [0.25, -0.55], r: [-0.35, -0.55] }], [F(tTurns), { r: [-0.6, -0.1] }]], { facing: 1 }),
  ],
  over: (g, v, f) => {
    const hp = v.w([1.5, 1.32, 1.8]), m = v.ppm([1.8, 1.4, 1.9]);
    if (f >= F(tBuys) - 2) {
      const cw = m * 0.2; card(g, hp[0], hp[1], cw, 0.04, { face: "ace", fake: true });
      // the magnifier slides over the card's banner; inside the lens the misprint is shown enlarged (clipped to the glass)
      const u = easeOut(clamp01((f - F(tBuys) - 6) / 10));
      if (u > 0) {
        const lx = hp[0] + cw * (0.9 - 0.9 * u) + Math.sin(f * 0.15) * cw * 0.04, ly = hp[1] + cw * 0.44 - (1 - u) * cw * 0.6, r = cw * 0.36;
        g.save(); g.globalAlpha = u;
        g.beginPath(); g.moveTo(lx + r * 0.7, ly + r * 0.7); g.lineTo(lx + r * 1.9, ly + r * 1.9); g.lineWidth = r * 0.32; g.strokeStyle = "#5a3a22"; g.lineCap = "round"; g.stroke(); g.lineWidth = r * 0.12; g.strokeStyle = INK; g.stroke();
        g.save(); g.beginPath(); g.arc(lx, ly, r, 0, 7); g.clip();
        const Z = 2.0; g.translate(lx, ly); g.scale(Z, Z); g.translate(-lx, -ly); card(g, hp[0], hp[1], cw, 0.04, { face: "ace", fake: true, shadow: false });
        g.restore();
        g.beginPath(); g.arc(lx, ly, r, 0, 7); g.fillStyle = "rgba(200,230,255,0.16)"; g.fill(); g.lineWidth = r * 0.16; g.strokeStyle = "#c9a14a"; g.stroke(); g.lineWidth = r * 0.06; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.arc(lx, ly, r * 0.72, -2.5, -1.7); g.lineWidth = r * 0.08; g.strokeStyle = "rgba(255,255,255,0.7)"; g.stroke();
        g.restore();
      }
    }
    const bp = v.w([2.05, 1.12, 1.75]); badge(g, bp[0], bp[1], m * 0.27, easeOutBack(clamp01((f - F(tTurns) - 2) / 8), 2.2));
    const rh = v.w([0.3, 2.1, 2.3]); emark(g, rh[0] - 30, rh[1] - 40, m * 0.25, f - F(tWork) - 2, -0.15);
    const cdl = v.w([3.9, 1.27, 2.0]); flame(g, cdl[0], cdl[1], v.ppm([3.9, 1.27, 2.0]) * 0.05, f);
  },
});
// 13 — "Wait... they'd really hang him over a playing card?"  (dutch close-up: Richard sweating, the card trembling, the flame shrinking)
const C13 = F(tYup) - 3;
add({
  a: C12, b: C13, plate: "shop_cu", xfade: 6,
  keys: [{ f: C12, at: [-0.17, 1.58, 4.0], z: 1.38, roll: 0.07, creep: 0.006 }],
  kicks: [[F(tHang), 0.4]],
  under: (g, v, f) => candleGrade(g, v, SHOP_POOLS, f, 1.25),
  cast: (f) => [printerAt(f, [0, 0, 4.25], [[0, "nervous"]], [[0, { l: [0.3, -0.35], r: [-0.3, -0.35] }]], { headTilt: Math.sin(f * 0.5) * 2 }, { clip: above(-3, 3, 1.0, 2.6), noShadow: true })],
  over: (g, v, f) => {
    const c = held(v), m = v.ppm([0, 1.5, 4.0]);
    card(g, c[0] + Math.sin(f * 2.1) * 3, c[1] + Math.sin(f * 1.7) * 2, m * 0.24, 0.08, { face: "ace", fake: true });
    const hd = v.w([0.15, 2.0, 4.25]); for (let i = 0; i < 2; i++) { const a = ((f - C12) * 0.04 + i * 0.5) % 1; spr(g, 4, i, hd[0] + (i ? 30 : -40), hd[1] + a * 120, m * 0.04, 0, 1 - a); }
    const cdl = v.w([-0.45, 1.3, 3.6]); flame(g, cdl[0], cdl[1], m * 0.04 * (1 - clamp01((f - C12) / 70) * 0.6), f);
    qmark(g, c[0] - m * 0.66, c[1] - m * 0.5, m * 0.16, f - F(tCard3), 0.15);
  },
});
// 14 — "Yup. Faking a tax stamp was forgery, and forgery meant death."  (the Old Bailey: the witness, the fake ace, the black cap)
const C14 = F(tNovember) - 4;
add({
  a: C13, b: C14, plate: "court", xfade: 6,
  keys: [{ f: C13, at: [180, 1.75, 3], z: 1.18, creep: 0.002 }, { f: F(tForgery) - 4, dur: 14, at: [178.4, 1.6, 1.4], z: 1.3, creep: 0.002 }, { f: F(tDeath) - 8, dur: 10, at: [180, 2.6, 5.4], z: 1.45, creep: 0.004, punch: 0.005, pn: 12 }],
  kicks: [[F(tDeath) + 2, 1.0]],
  cast: (f) => [
    stand(JUDGE, "judge", [180, 1.0, 5.6], 51, f, [[0, "stern"]], [[0, { l: [0.3, 0.2], r: [-0.3, 0.2] }], [F(tDeath) - 6, { l: [0.25, -1.1], r: [-0.25, -1.1] }]], { facing: 0 }, { clip: above(177, 183, 1.95, 4.85), noShadow: true }),
    stand(RICHARD, "rich", [177.6, 0, 1.4], 11, f, [[0, "nervous"], [F(tDeath), "shock"]], [[0, {}]], { facing: 1 }, { clip: above(176.5, 178.7, 1.15, 0.3), noShadow: true }),
    stand(HOCKLEY, "hock", [182.4, 0, 1.5], 71, f, [[0, "stern"]], [[0, { r: [-0.5, -0.8] }]], { facing: -1 }),
  ],
  over: (g, v, f) => {
    const hp = v.w([182.1, 2.3, 1.4]), m = v.ppm([182, 2.2, 1.5]); card(g, hp[0], hp[1], m * 0.14, 0.1, { face: "ace", fake: true });
    // the black cap lowered onto the judge's wig on "death"
    const jh = v.w([180, 2.92, 5.6]), jm = v.ppm([180, 2.9, 5.6]), k = easeOutBack(clamp01((f - F(tDeath) + 8) / 8), 1.4);
    if (k > 0) { g.save(); g.translate(jh[0], jh[1] - (1 - k) * jm * 0.6); g.fillStyle = "#16141c"; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(-jm * 0.22, 0); g.lineTo(jm * 0.22, 0); g.lineTo(jm * 0.28, -jm * 0.06); g.lineTo(-jm * 0.28, -jm * 0.06); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    if (f >= F(tDeath)) { g.save(); g.globalAlpha = clamp01((f - F(tDeath)) / 10) * 0.45; g.fillStyle = "#0a0614"; g.fillRect(0, 0, 1080, 1920); g.restore(); }
  },
});
// 15 — "In November 1805, Richard Harding was hanged."  (darkness; one candle; the fake ace falls slowly through a beam of light; the candle goes out)
const C15 = F(tCardTax) - 4;
add({
  a: C14, b: C15, plate: "court_n", xfade: 10,
  keys: [{ f: C14, at: [180, 2.2, 5.4], z: 1.2, creep: 0.002 }],
  over: (g, v, f) => {
    const out = clamp01((f - F(tHanged2)) / 4);
    darkGrade(g, 1, [540, 900]);
    g.save(); g.globalCompositeOperation = "screen"; const bm = g.createLinearGradient(540, 0, 540, 1920); bm.addColorStop(0, `rgba(255,236,190,${0.32 * (1 - out)})`); bm.addColorStop(1, "rgba(255,236,190,0)"); g.fillStyle = bm; g.beginPath(); g.moveTo(470, 0); g.lineTo(610, 0); g.lineTo(820, 1920); g.lineTo(260, 1920); g.closePath(); g.fill(); g.restore();
    const u = clamp01((f - C14) / (F(tHanged2) - C14 + 6)), y = 240 + u * 1250, sw = Math.sin(u * 9) * 130;
    g.save(); g.globalAlpha = 1 - out * 0.9; card(g, 540 + sw, y, 230, Math.sin(u * 9) * 0.6, { face: "ace", fake: true, flip: (u * 2.2) % 1 }); g.restore();
    flame(g, 860, 1500, 22 * (1 - out), f, 1 - out);
    g.save(); g.fillStyle = `rgba(0,0,0,${out * 0.9})`; g.fillRect(0, 0, 1080, 1920); g.restore();
  },
});
// 16 — "The card tax lasted until 1960, but card makers kept the fancy ace anyway. So every time you shuffle a deck...
//       you're holding a two-hundred-year-old tax receipt."  (the years roll; today's table; a riffle shuffle; the seal)
add({
  a: C15, b: TOTAL, plate: "today", xfade: 10,
  keys: [{ f: C15, at: [240, 0.9, 2.5], z: 1.05, creep: 0.002 }, { f: F(tShuffle) - 6, dur: 14, at: [240, 0.84, 2.5], z: 1.25, creep: 0.002 }, { f: F(tHolding) - 4, dur: 12, at: [240, 0.9, 2.45], z: 1.55, creep: 0.004, punch: 0.004, pn: 14 }],
  kicks: [[F(tReceipt) + 4, 0.5]],
  under: (g) => warmGrade(g),
  over: (g, v, f) => {
    const c = v.w([240, 0.81, 2.5]), m = v.ppm([240, 0.8, 2.5]);
    // the years roll 1805 -> 1960
    if (f < F(tKept)) { const u = clamp01((f - C15) / (F(t1960) - C15 + 6)), yr = Math.round(1805 + (1960 - 1805) * easeOut(u)); g.save(); g.font = "900 190px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 30; g.strokeStyle = INK; g.strokeText(String(yr), 540, 520); g.fillStyle = u >= 1 ? "#ffd24a" : "#f8f6f1"; g.fillText(String(yr), 540, 520); g.restore(); }
    // the deck box opens and the fancy ace slides out on top
    if (f < F(tShuffle) - 4) { const k = easeOutBack(clamp01((f - F(tKept) + 4) / 12), 1.4); deck(g, c[0], c[1], m * 0.2, 10); if (k > 0) card(g, c[0], c[1] - m * 0.05 - k * m * 0.2, m * 0.21, 0, { face: "ace", glow: k * 0.7 }); }
    else if (f < F(tHolding) - 2) { riffle(g, c[0], c[1], m * 0.2, clamp01((f - F(tShuffle) + 4) / (F(tHolding) - F(tShuffle) + 2))); hand(g, c[0] - m * 0.42, c[1] + m * 0.05, m * 0.08, 0.2, 0.3); hand(g, c[0] + m * 0.42, c[1] + m * 0.05, m * 0.08, Math.PI - 0.2, 0.3); }
    else { const k = easeOutBack(clamp01((f - F(tHolding) + 2) / 10), 1.5); card(g, c[0], c[1] - m * 0.1 - k * m * 0.1, m * 0.26, -0.04, { face: "ace", glow: 0.6 }); seal(g, c[0] + m * 0.06, c[1] - m * 0.12 - k * m * 0.1, m * 0.06, f - F(tReceipt) + 2, -0.25); hand(g, c[0] + m * 0.1, c[1] + m * 0.16 - k * m * 0.1, m * 0.09, -1.5, 0.6); }
  },
});

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
