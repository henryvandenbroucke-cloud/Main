// Timeline of "Why Tea Was Locked in a Box", timed to the voice's words.json (every event hangs off a word).
// Reference-style staging: giant deadpan foreground faces over soft backgrounds, a moonlit-blue night, toy-bright
// interiors; satisfying micro-motion on every beat (string draw-ons, flipping calendars, cut-out letters popping in,
// slamming bars, stamps, nodding jurors).
import { Outfit, FrontOpts, INK, Expr, townsfolk, P2 } from "./toon";
import { V3 } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import { stampMark, puff, ringWaves } from "./props2d";
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
const t1700 = A(["1700s", "1700s,"]), tWoman = A("woman"), tLocked = A("locked"), tBox = A("box"), tOnly = A("only"), tKey = A("key", tOnly);
const tBecause = A("because"), tServants = A("servants"), tThere = A("there", tServants), tHalf = A("half"), tVanish = A("vanish"), tMorning = A("morning");
const tIts = A("it's"), t1770 = A(["1770s", "1770s."]), tObsessed = A("obsessed"), tGov = A("government"), tTaxes = A("taxes"), t119 = A(["119%", "119"]);
const tRich = A("rich"), tGuard = A("guard"), tJewel = A("jewelry"), tSmug = A("smugglers"), tNight = A("night"), tBoats = A("boats"), tBeaches = A("beaches");
const t1784 = A(["1784", "1784,"]), tTwo = A(["two", "2"], t1784), tCups = A("cups"), tIllegal = A("illegal");
const tCheap = A("cheap"), tNotEven = A("even", tCheap), tCrooks = A("crooks"), tAsh = A("ash"), tDyed = A("dyed"), tSold = A("sold"), tSmouch = A("smouch");
const tSome = A("some", tSmouch), tUsed = A("used"), tSold2 = A("sold", tUsed), tAgain = A("again", tSold2);
const tWait = A("wait"), tEnd = A("end", tWait), t1784b = A(["1784", "1784,"], tEnd), tPrime = A("prime"), tSlashes = A("slashes"), tFrom = A("from", tSlashes), t12 = A(["12", "twelve"], tFrom), tHalf2 = A("half", t12);
const tOvernight = A("overnight"), tStops = A("stops"), tReal = A("real"), tCheap2 = A("cheap", tReal), tAfford = A("afford"), tCup = A("cup", tAfford);
const tLocks = A("locks"), tToday = A("today"), tGuarding = A("guarding"), tPennies = A("pennies");

// ---------------- cast (white heads, reference style) ----------------
const WHITE = "#f8f6f1";
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, skin: WHITE, ...o } as Outfit);
const LADY = O({ jacket: "#5a8fc2", pants: "#5a8fc2", hat: "bonnet", dress: "#5a8fc2", buttons: "#f1ece0" });
const MAID1 = O({ jacket: "#3b3f52", pants: "#3b3f52", hat: "bonnet", dress: "#3b3f52" });
const MAID2 = O({ jacket: "#5a4a3a", pants: "#5a4a3a", hat: "bonnet", dress: "#5a4a3a" });
const BUTLER = O({ jacket: "#1f1d24", pants: "#1f1d24", hat: "hair", hair: "#3a2a20", buttons: "#c9a23a", moustache: "#3a2a20" });
const GUEST1 = O({ jacket: "#7b5ac9", pants: "#3b3f52", hat: "tophat", buttons: "#e8c45a" });
const GUEST2 = O({ jacket: "#c25a7a", pants: "#c25a7a", hat: "bonnet", dress: "#c25a7a" });
const GUEST3 = O({ jacket: "#2f6a43", pants: "#3b3f52", hat: "hair", hair: "#e9e6e0", moustache: "#e9e6e0", build: "stout" });
const TAXMAN = O({ jacket: "#3a3f52", pants: "#2b2b35", hat: "tophat", buttons: "#c9ccd2", build: "stout" });
const SMUG1 = O({ jacket: "#4a4f3a", pants: "#3a3530", boots: "#2a2420", hat: "cap", cap: "#2e2a26", moustache: "#3a2a20" });
const SMUG2 = O({ jacket: "#5a3b2a", pants: "#2e2a26", boots: "#2a2420", hat: "cap", cap: "#8c2f39" });
const SMUG3 = O({ jacket: "#3b4a6b", pants: "#2e2a26", boots: "#2a2420", hat: "hair", hair: "#2a201a", build: "stout" });
const CROOK1 = O({ jacket: "#6b5a3a", pants: "#3a3530", hat: "cap", cap: "#4a3f35", moustache: "#2a201a" });
const CROOK2 = O({ jacket: "#8a6a45", pants: "#3a3530", hat: "hair", hair: "#c98a3a", build: "stout" });
const PITT = O({ jacket: "#1f2a44", pants: "#1f1d24", hat: "hair", hair: "#f4f1ea", buttons: "#e8c45a" });

// ---------------- the 3D sprite atlas ----------------
let ATL: HTMLImageElement | null = null;
export const setAtlas = (im: HTMLImageElement) => { ATL = im; };
const CELLPX = 256;
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

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const TABLE: V3 = [0, 0.8, 2.5], CADDY_P: V3 = [0, 0.92, 2.5];
const caddyAt = (g: CanvasRenderingContext2D, v: View, lid: number, sc = 1) => { const c = v.w(CADDY_P), m = v.ppm(CADDY_P); caddy(g, c[0], c[1], 0.66 * m * sc, lid); return { c, m }; };
const tableClip = above(-3, 3, 0.8, 1.72);
/** moonlit night over the plate only (characters keep their own night tint): deep blue multiply, moon glow, vignette */
const nightGrade = (g: CanvasRenderingContext2D) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = "rgba(70,86,170,0.85)"; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen"; const mg = g.createRadialGradient(820, 260, 20, 820, 260, 700); mg.addColorStop(0, "rgba(220,230,255,0.55)"); mg.addColorStop(1, "rgba(120,140,220,0)"); g.fillStyle = mg; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "source-over"; g.fillStyle = "#fff8e0"; g.beginPath(); g.arc(820, 260, 58, 0, 7); g.fill();
  const vg = g.createRadialGradient(540, 960, 500, 540, 960, 1250); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(5,8,30,0.55)"); g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
  g.restore();
};

// 1 — HOOK (close on the tea table): "In the 1700s, this woman locked her tea in a box... and only she had the key."
{
  const LOCK = F(tLocked), ONLY = F(tOnly), KEY = F(tKey);
  add({
    a: 0, b: F(tBecause) - 2, plate: "dr_cu",
    keys: [{ f: 0, at: [0, 0.98, 2.5], z: 1.0, creep: 0.006 },
      { f: LOCK - 4, dur: 10, at: [0, 0.95, 2.5], z: 1.35, creep: 0.002, punch: 0.006, pn: 10 },
      { f: ONLY - 2, dur: 10, at: [0, 1.45, 3.1], z: 1.25, roll: 0.03, creep: 0.002 },
      { f: KEY + 2, dur: 8, at: [0, 1.15, 3.1], z: 1.35, roll: 0, creep: 0.002 }],
    kicks: [[8, 0.6], [LOCK + 10, 0.4], [KEY + 10, 0.3]],
    cast: (f) => [stand(LADY, "lady", [0, 0, 3.25], 11, f, [[0, "stern"], [ONLY, "grin"], [KEY + 8, "smile_closed"]],
      [[0, { l: [0.5, 0.35], r: [-0.5, 0.35] }], [LOCK - 6, { l: [0.25, 0.55], r: [-0.1, 0.55] }], [ONLY, { r: [0.15, -0.55] }], [KEY + 4, { r: [0.0, 0.0] }], [KEY + 12, { l: [0.3, 0.4], r: [-0.3, 0.4] }]],
      { facing: 0 }, { clip: tableClip, noShadow: true })],
    over: (g, v, f) => {
      // the lid slams shut (with a bounce) in the first frames, leaves puff out
      const lid = f < 10 ? 0.55 * (1 - easeOut(f / 7)) + (f >= 7 ? Math.abs(Math.sin((f - 7) * 1.4)) * 0.08 * (1 - (f - 7) / 4) : 0) : 0;
      const { c, m } = caddyAt(g, v, lid);
      leafBurst(g, c[0], c[1] - m * 0.08, m * 0.4, f - 6, 14, 3);
      puffs(g, c[0], c[1] - m * 0.08, m * 0.18, f - 6, 5, true);
      // the key slides into the escutcheon and turns: click + glint
      if (f >= LOCK - 8 && f < ONLY - 2) {
        const u = clamp01((f - LOCK + 8) / 8), turn = clamp01((f - LOCK) / 8);
        keyS(g, c[0] + m * (0.42 - 0.2 * easeOut(u)), c[1] + m * 0.05, m * 0.42, turn * 0.5, -0.1);
        if (f >= LOCK + 8) glint(g, c[0] + m * 0.04, c[1] + m * 0.04, m * 0.25, f - LOCK - 8);
      }
      // she lifts the key up to her face, it spins and catches the light, then drops down her front
      if (f >= ONLY - 2) {
        const hd = v.w([0.2, 1.55, 3.25]), mm = v.ppm([0, 1.5, 3.25]);
        const drop = clamp01((f - KEY - 2) / 10);
        keyS(g, hd[0] - mm * 0.05, hd[1] - mm * 0.05 + drop * drop * mm * 0.45, mm * 0.32 * (1 - drop * 0.4), f * 0.08, 0.4 + drop * 2, );
        glint(g, hd[0] - mm * 0.1, hd[1] - mm * 0.1, mm * 0.18, f - ONLY - 6);
      }
    },
  });
}
// 2 — "Because if the servants got in there..."  (the door: three servants stacked like a totem pole, ducking in turn)
{
  const A0 = F(tBecause) - 2, SERV = F(tServants), THERE = F(tThere);
  const heads: [Outfit, string, number, number][] = [[MAID1, "m1", 1.0, 31], [BUTLER, "b1", 1.45, 32], [MAID2, "m2", 0.55, 33]];
  add({
    a: A0, b: F(tHalf) - 3, plate: "dr_door", xfade: 6,
    keys: [{ f: A0, at: [-5.6, 1.25, 5.6], z: 1.3, creep: 0.004 }],
    kicks: [[THERE + 2, 0.4]],
    cast: (f) => heads.map(([o, k, , seed], i) => {
      const yOff = [-0.45, 0.0, -0.9][i];
      const peek = easeOutBack(clamp01((f - SERV + 8 - i * 3) / 7), 1.8) * (1 - easeOut(clamp01((f - THERE - 2 - i * 3) / 5)));
      return stand(o, k, [-6.4 + peek * (0.62 + [0.06, 0.0, 0.12][i]), yOff, [5.915, 5.93, 5.9][i]], seed, f, [[0, "nervous"], [THERE, "shock"]], [[0, { l: [0.35, -0.6] }]], { facing: -1, headTilt: (i - 1) * 8 },
        { clip: [[-6.05, 0, 5.92], [-5.45, 0, 5.92], [-5.45, 2.45, 5.92], [-6.05, 2.45, 5.92]], lean: -0.2 * peek, noShadow: true });
    }),
    over: (g, v, f) => { const d = v.w([-5.75, 1.2, 5.9]), m = v.ppm([-5.75, 1.2, 5.9]); puffs(g, d[0], d[1], m * 0.35, f - THERE - 6, 4, true); },
  });
}
// 3 — "...half the tea would vanish by morning."  (crash zoom: a sneaky spoon, a stream of leaves, the level drops)
{
  const A0 = F(tHalf) - 3, VAN = F(tVanish), MORN = F(tMorning);
  add({
    a: A0, b: F(tIts) - 2, plate: "dr_cu", xfade: 6,
    keys: [{ f: A0, at: [-0.25, 0.95, 2.5], z: 1.08, creep: 0.004 }, { f: MORN - 2, dur: 10, at: [0, 1.15, 2.9], z: 1.2, creep: 0.002 }],
    kicks: [[MORN + 4, 0.6]],
    cast: (f) => f >= MORN - 4 ? [stand(LADY, "lady", [0, 0, 3.25], 11, f, [[0, "neutral"], [MORN + 2, "shock"]], [[0, { l: [0.4, 0.4], r: [-0.4, 0.4] }], [MORN + 2, { l: [0.3, -0.55], r: [-0.3, -0.55] }]], { facing: 0 }, { clip: tableClip, noShadow: true })] : [],
    over: (g, v, f) => {
      const open = f < MORN ? 1 : 1;
      const { c, m } = caddyAt(g, v, open);
      // spoonfuls going out to the left, each one a little arc of leaves
      const n = Math.floor(clamp01((f - A0) / (MORN - A0)) * 6);
      for (let i = 0; i < 6; i++) {
        const t0 = A0 + i * ((MORN - A0) / 6), u = clamp01((f - t0) / 9);
        if (u <= 0 || u >= 1) continue;
        const sx = c[0] - m * 0.03 - u * m * 0.32, sy = c[1] - m * 0.1 - Math.sin(Math.PI * u) * m * 0.12;
        prop(g, "spoon", sx, sy, m * 0.3, -0.3 + u * 0.4, 1, [-m * 0.035, 0]);
        leafBurst(g, sx, sy, m * 0.28, Math.round((f - t0)) - 4, 5, i + 1, false, 0.6);
      }
      leafStream(g, [c[0] - m * 0.08, c[1] - m * 0.08], [c[0] - m * 0.42, c[1] + m * 0.14], m * 0.35, f, clamp01((f - VAN + 4) / 6) * (1 - clamp01((f - MORN + 2) / 6)));
      void n;
    },
  });
}
// 4 — "It's the 1770s. England is obsessed with tea, but the government taxes it at 119%."  (the drawing room party)
{
  const A0 = F(tIts) - 2, OBS = F(tObsessed), TAX = F(tTaxes), P119 = F(t119);
  const guests: [Outfit, string, V3, number][] = [[GUEST1, "g1", [1.35, 0, 2.5], 41], [GUEST2, "g2", [-1.35, 0, 2.5], 42], [GUEST3, "g3", [2.6, 0, 3.6], 43], [LADY, "lady", [0, 0, 3.3], 11]];
  add({
    a: A0, b: F(tRich) - 3, plate: "dr_wide", xfade: 6,
    keys: [{ f: A0, at: [0, 1.6, 3], z: 1.18, creep: 0.0025 }, { f: TAX - 6, dur: 14, at: [-1.6, 1.4, 2.8], z: 1.3, creep: 0.002 }],
    kicks: [[P119, 0.7]],
    cast: (f) => [
      ...guests.map(([o, k, P, seed], i) => stand(o, k, P, seed, f, [[0, "smile"], [OBS, i % 2 ? "laugh" : "grin"], [P119, "shock"]],
        [[0, { r: [0.35, -0.35] }], [OBS + i * 3, { r: [0.3, -0.75] }], [OBS + 12 + i * 3, { r: [0.35, -0.35] }], [P119, { l: [0.3, -0.5], r: [-0.3, -0.5] }]], { mode: i < 2 ? "sit" : "stand", facing: i === 0 ? -1 : i === 1 ? 1 : 0 }, { noShadow: i < 2 })),
      stand(BUTLER, "b1", [-0.6, 0, 3.9], 32, f, [[0, "neutral"]], [[0, { l: [0.45, -0.1], r: [0.55, -0.15] }]], { facing: 1 }),
      ...(f >= TAX - 8 ? [walker(TAXMAN, "tax", 51, f, [[TAX - 8, -4.2, 1.6], [TAX + 6, -2.4, 1.6]], "stern")] : []),
    ],
    over: (g, v, f) => {
      // cups in hands with steam; the butler pours a stream of tea
      for (const [, , P] of guests.slice(0, 3)) { const p = v.w([P[0] + (P[0] > 0 ? -0.3 : 0.3), P === guests[2][2] ? 1.25 : 0.95, P[2] - 0.2]), m = v.ppm(P); prop(g, "cup", p[0], p[1], m * 0.32); steam(g, p[0], p[1] - m * 0.08, m * 0.5, f, 1, P[0] > 0 ? 1 : 2); }
      const pot = v.w([-0.25, 1.15, 3.6]), cupT = v.w([0, 0.85, 2.5]), m = v.ppm(TABLE);
      prop(g, "cup", cupT[0], cupT[1], m * 0.3); steam(g, cupT[0], cupT[1] - m * 0.06, m * 0.45, f, 1, 3);
      g.save(); g.strokeStyle = "#9a5a2a"; g.lineWidth = m * 0.025; g.lineCap = "round"; g.beginPath(); g.moveTo(pot[0], pot[1]); g.quadraticCurveTo(pot[0] + (cupT[0] - pot[0]) * 0.3, pot[1] - m * 0.05, cupT[0], cupT[1] - m * 0.05); g.stroke(); g.restore();
      spray(g, cupT[0], cupT[1] - m * 0.05, m * 0.5, (f - A0) % 22, 7);
      // the tax: coins arc from the table to the taxman's sack
      if (f >= TAX) { const sk = v.w([-2.2, 1.0, 1.6]), sm = v.ppm([-2.2, 1, 1.6]); prop(g, "sack", sk[0], sk[1], sm * 0.7, Math.sin(f * 0.2) * 0.05);
        for (let i = 0; i < 6; i++) { const u = clamp01((f - TAX - i * 3) / 12); if (u <= 0 || u >= 1) continue; prop(g, "coin", cupT[0] + (sk[0] - cupT[0]) * u, cupT[1] + (sk[1] - cupT[1]) * u - Math.sin(Math.PI * u) * sm * 1.2, sm * 0.22, f * 0.3, 1, [(sk[0] - cupT[0]) / 12, 0]); }
        if (f >= P119) glint(g, sk[0], sk[1] - sm * 0.3, sm * 0.5, f - P119); }
    },
  });
}
// 5 — "So rich families guard it like jewelry, which means..."  (the caddy on velvet, polished; the butler on guard)
{
  const A0 = F(tRich) - 3, GUARD = F(tGuard), JEW = F(tJewel);
  add({
    a: A0, b: F(tSmug) - 4, plate: "dr_cu", xfade: 8,
    keys: [{ f: A0, at: [0, 1.0, 2.5], z: 1.4, creep: 0.004, roll: -0.02 }],
    kicks: [[JEW, 0.3]],
    cast: (f) => [stand(BUTLER, "b1", [0.15, 0, 3.4], 32, f, [[0, "stern"]], [[0, { l: [0.2, 0.2], r: [0.5, -0.9] }]], { facing: 0 }, { clip: tableClip, noShadow: true })],
    over: (g, v, f) => {
      const { c, m } = caddyAt(g, v, 0);
      // a polishing cloth sweep and a glint racing across the brass
      const u = ((f - A0) % 24) / 24; glint(g, c[0] - m * 0.25 + u * m * 0.5, c[1] - m * 0.05, m * 0.3, Math.round(u * 14));
      glint(g, c[0] + m * 0.03, c[1] + m * 0.05, m * 0.35, f - JEW);
      for (let i = 0; i < 3; i++) glint(g, c[0] + (i - 1) * m * 0.3, c[1] - m * 0.25, m * 0.15, (f - GUARD - i * 5) % 30);
    },
  });
}
// 6 — "...smugglers. Every night, boats row bags of tea onto dark beaches. By 1784, two out of every three cups in
//      Britain are illegal."  (moonlit beach: boats rocking in, men wading with sacks into the cave; three cups on a barrel)
{
  const A0 = F(tSmug) - 4, NIGHT = F(tNight), BOATS = F(tBoats), Y84 = F(t1784), TWO = F(tTwo), ILL = F(tIllegal);
  const BX = 80;
  const carriers: [Outfit, string, number, number][] = [[SMUG1, "s1", 0, 61], [SMUG2, "s2", 14, 62], [SMUG3, "s3", 28, 63]];
  add({
    a: A0, b: F(tCheap) - 6, plate: "beach_n", xfade: 10,
    keys: [{ f: A0, at: [BX + 2.5, 1.3, 4], z: 1.1, creep: 0.002 }, { f: BOATS, dur: 40, at: [BX - 2.5, 1.1, 1.5], z: 1.15, creep: 0.002 }, { f: Y84 - 6, dur: 16, at: [BX + 1.2, 0.9, 0.3], z: 1.45, creep: 0.002 }],
    under: (g) => nightGrade(g),
    kicks: [[ILL, 0.4]],
    cast: (f) => carriers.map(([o, k, d, seed]) => {
      const t0 = A0 + d, path: [number, number, number][] = [[t0, BX + 2.5, 3.6], [t0 + 70, BX - 4.8, 1.2], [t0 + 72, BX - 5.6, 1.0]];
      return walker(o, k, seed, f, path, "grin");
    }),
    over: (g, v, f) => {
      // boats: rocking, gliding in, bow spray, oar stroke dip
      for (let i = 0; i < 2; i++) {
        const x = BX + 4.5 - i * 4 - clamp01((f - A0 - i * 20) / 120) * 2.5, z = 5.5 + i * 2.5, P: V3 = [x, 0.05, z], p = v.w(P), m = v.ppm(P);
        const rock = Math.sin(f * 0.12 + i) * 0.06;
        prop(g, "boat", p[0], p[1] - m * 0.2 + Math.sin(f * 0.1 + i) * m * 0.03, m * 2.4, rock);
        if ((f + i * 9) % 26 < 10) spray(g, p[0] - m * 0.9, p[1] - m * 0.1, m * 1.2, (f + i * 9) % 26, 9 + i);
      }
      // foam lines along the shore
      g.save(); g.strokeStyle = "rgba(235,245,255,0.75)"; g.lineCap = "round";
      for (let i = 0; i < 4; i++) { const ph = (f * 0.01 + i / 4) % 1, a = v.w([BX - 12, 0.02, 4.8 + ph * 1.2]), b = v.w([BX + 12, 0.02, 4.8 + ph * 1.2]); g.globalAlpha = Math.sin(Math.PI * ph); g.lineWidth = 5; g.beginPath(); g.moveTo(a[0], a[1]); for (let k = 1; k <= 20; k++) { const x = a[0] + (b[0] - a[0]) * k / 20; g.lineTo(x, a[1] + (b[1] - a[1]) * k / 20 + Math.sin(k + f * 0.1) * 4); } g.stroke(); }
      g.restore();
      // the sacks on the carriers' shoulders
      for (const [o, k, d, seed] of carriers) { const t0 = A0 + d, a = walker(o, k, seed, f, [[t0, BX + 2.5, 3.6], [t0 + 70, BX - 4.8, 1.2], [t0 + 72, BX - 5.6, 1.0]], "grin"), hd = v.w([a.P[0], 1.85, a.P[2]]), m = v.ppm(a.P); prop(g, "sack", hd[0] + (a.mirror ? 0.15 : -0.15) * m, hd[1] - m * 0.05, m * 0.8, 0.3); }
      // lantern glow swinging
      const L = v.w([BX + 3.5, 1.1, -1.5]), lm = v.ppm([BX + 3.5, 1.1, -1.5]);
      g.save(); g.globalCompositeOperation = "screen"; const gr = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], lm * 1.8); gr.addColorStop(0, `rgba(255,190,110,${0.5 + 0.08 * Math.sin(f * 0.4)})`); gr.addColorStop(1, "rgba(255,160,80,0)"); g.fillStyle = gr; g.fillRect(L[0] - lm * 2, L[1] - lm * 2, lm * 4, lm * 4); g.restore();
      // three cups on the barrel: two get a smuggler's sack plopped beside them
      if (f >= TWO - 6) {
        const bp = v.w([BX + 1.2, 0, 0.3]), bm = v.ppm([BX + 1.2, 0, 0.3]);
        prop(g, "barrel", bp[0], bp[1] - bm * 0.45, bm * 1.0);
        for (let i = 0; i < 3; i++) { const k = easeOutBack(clamp01((f - TWO + 6 - i * 3) / 7), 2); const cx = bp[0] + (i - 1) * bm * 0.3, cy = bp[1] - bm * 0.95; if (k > 0) prop(g, "cup", cx, cy, bm * 0.32 * k); if (i < 2) { const s = easeOutBack(clamp01((f - ILL + 4 - i * 4) / 7), 1.6); if (s > 0) { prop(g, "sack", cx, cy - bm * 0.32 + (1 - s) * -bm * 0.6, bm * 0.34 * s); puffs(g, cx, cy, bm * 0.2, f - ILL - i * 4, 4, true); } } }
      }
    },
  });
}
// 7 — "And if you buy cheap tea, it might not even be tea. Crooks dried ash leaves, dyed them, and sold them as tea.
//      They called it smouch. Some even dried out used tea leaves... and sold them again."  (the crooks' shed)
{
  const A0 = F(tCheap) - 6, NE = F(tNotEven), CRK = F(tCrooks), ASH = F(tAsh), DYED = F(tDyed), SOLD = F(tSold), SMO = F(tSmouch), USED = F(tUsed), SOLD2 = F(tSold2);
  const SX = 160;
  add({
    a: A0, b: F(tWait) - 3, plate: "shed_d", xfade: 10,
    keys: [{ f: A0, at: [SX + 0.3, 1.3, 0.5], z: 1.15, creep: 0.002 }, { f: CRK - 6, dur: 14, at: [SX - 2.3, 1.4, 1.3], z: 1.25, creep: 0.002 },
      { f: SOLD - 4, dur: 14, at: [SX + 1.4, 1.2, 1.4], z: 1.3, creep: 0.002 }, { f: USED - 6, dur: 16, at: [SX + 0.3, 1.5, 2.2], z: 1.2, creep: 0.002 }],
    kicks: [[DYED + 2, 0.5], [SMO, 0.4]],
    cast: (f) => [
      stand(CROOK1, "c1", [SX - 2.9, 0, 1.4], 71, f, [[0, "grin"], [SMO, "pained"], [SMO + 18, "grin"]], [[0, { r: [0.4, -0.95] }], [DYED - 6, { l: [0.4, 0.2], r: [0.6, 0.1] }], [SOLD, {}]], { facing: 1 }),
      stand(CROOK2, "c2", [SX + 2.0, 0, 2.1], 72, f, [[0, "smile_closed"], [SOLD, "grin"], [USED, "whistle"], [SOLD2, "laugh"]], [[0, { l: [0.35, 0.2], r: [-0.35, 0.2] }], [USED, { r: [0.5, -0.6] }], [SOLD2, { l: [0.3, -0.7], r: [-0.3, -0.7] }]], { facing: -1 }),
      ...(f < CRK ? [stand(GUEST2, "buyer", [SX + 0.4, 0, -0.5], 73, f, [[0, "smile"], [NE, "nervous"]], [[0, { r: [0.4, 0.0] }]], { facing: 0 })] : []),
    ],
    over: (g, v, f) => {
      const tub = v.w([SX - 2.0, 0.62, 1.2]), tm = v.ppm([SX - 2.0, 0.6, 1.2]);
      // ash leaves raining from the branch the crook shakes, into the dye tub (splash), out dark
      if (f >= ASH - 6 && f < SOLD + 6) { const br = v.w([SX - 2.6, 2.4, 1.3]); leafStream(g, br, [tub[0], tub[1]], tm * 1.4, f, clamp01((f - ASH + 6) / 6) * (1 - clamp01((f - DYED + 2) / 6)), 4, true); }
      spray(g, tub[0], tub[1], tm * 1.4, f - DYED, 11); spray(g, tub[0] + tm * 0.2, tub[1], tm * 1.2, f - DYED - 4, 12);
      if (f >= DYED + 4 && f < SMO + 10) { const bench = v.w([SX + 1.6, 0.95, 1.4]); leafStream(g, [tub[0], tub[1] - tm * 0.1], bench, tm * 1.2, f, clamp01((f - DYED - 4) / 6) * (1 - clamp01((f - SMO) / 8)), 6); }
      // the sack for sale, sniffed: stink puffs
      const sk = v.w([SX + 1.8, 1.05, 1.4]), sm = v.ppm([SX + 1.8, 1, 1.4]);
      if (f >= SOLD - 4) { prop(g, "sack", sk[0], sk[1] - sm * 0.1, sm * 0.7, Math.sin(f * 0.15) * 0.04); }
      if (f >= SMO) for (let i = 0; i < 3; i++) { const u = ((f - SMO) * 0.03 + i / 3) % 1; spr(g, 3, 6 + (i % 2), sk[0] + Math.sin(u * 8 + i) * sm * 0.2, sk[1] - sm * (0.4 + u * 1.2), sm * (0.3 + 0.3 * u), u, 0.6 * Math.sin(Math.PI * u)); }
      // used leaves: soggy pile steams on the rack, then scooped back into the sack
      if (f >= USED - 6) { const rack = v.w([SX + 0.4, 1.0, 3.2]), rm = v.ppm([SX, 1, 3.2]); steam(g, rack[0], rack[1], rm * 1.2, f, clamp01((f - USED + 6) / 8), 2);
        if (f >= SOLD2 - 6) { const u = clamp01((f - SOLD2 + 6) / 12); prop(g, "spoon", rack[0] + (sk[0] - rack[0]) * u, rack[1] + (sk[1] - rack[1]) * u - Math.sin(Math.PI * u) * rm * 0.5, rm * 0.5, -0.4); leafBurst(g, sk[0], sk[1] - sm * 0.3, sm * 1.0, f - SOLD2 - 6, 8, 5, false, 0.5); } }
    },
  });
}
// 8 — "Wait... so how did it all end? In 1784, the Prime Minister slashes the tax. From 119%... to twelve and a half."
{
  const A0 = F(tWait) - 3, WAIT = F(tWait), PRIME = F(tPrime), SLASH = F(tSlashes), FROM = F(tFrom), T12 = F(t12);
  add({
    a: A0, b: F(tOvernight) - 3, plate: "dr_desk", xfade: 6,
    keys: [{ f: A0, at: [5.3, 1.35, 3.0], z: 1.2, roll: -0.05, creep: 0.003 }, { f: SLASH - 4, dur: 8, at: [5.2, 1.2, 3.0], z: 1.4, roll: 0, creep: 0.002, punch: 0.006, pn: 10 }],
    kicks: [[SLASH + 6, 1.0], [T12, 0.5]],
    cast: (f) => [stand(PITT, "pitt", [5.25, 0, 3.75], 81, f, [[0, "stern"], [SLASH, "grin"], [T12 + 6, "smile_closed"]],
      [[0, { l: [0.2, 0.3], r: [-0.2, 0.3] }], [PRIME, { l: [0.5, -0.5], r: [-0.5, -0.5] }], [SLASH + 6, { l: [0.6, 0.0], r: [-0.6, 0.0] }], [T12, { r: [0.3, -0.4] }]], { facing: 0 }, { clip: above(3, 7, 0.82, 3.05), noShadow: true })],
    over: (g, v, f) => {
      const n = v.w([5.25, 1.15, 3.0]), m = v.ppm([5.25, 1.1, 3.0]);
      // the tax notice on the desk: snipped in half by the giant scissors, the halves flutter off; then the new one
      const cut = clamp01((f - SLASH - 4) / 6), fly = clamp01((f - SLASH - 10) / 18);
      if (f < SLASH + 30) for (const s of cut > 0 ? [-1, 1] : [0]) { g.save(); g.translate(n[0] + s * fly * m * 1.2, n[1] + fly * fly * m * 0.8); g.rotate(s * fly * 1.2); g.beginPath(); if (s !== 0) g.rect(s < 0 ? -m * 0.5 : 0, -m * 0.4, m * 0.5, m * 0.8); else g.rect(-m * 0.5, -m * 0.4, m, m * 0.8); g.clip(); notice(g, 0, 0, m * 0.9, "119%", "TAX ON TEA"); g.restore(); }
      if (f >= SLASH - 6 && f < SLASH + 20) { const u = clamp01((f - SLASH + 6) / 10); prop(g, "scissors", n[0] - m * 0.6 + u * m * 0.6, n[1] - m * 0.05, m * 1.1, 0, 1, [m * 0.06, 0]); }
      leafBurst(g, n[0], n[1], m * 1.4, f - SLASH - 8, 12, 7);
      notice(g, n[0], n[1] + m * 0.05, m * 0.9, "12½%", "TAX ON TEA", easeOutBack(clamp01((f - T12) / 9), 1.8), -0.05);
      if (f >= T12 + 4) glint(g, n[0] + m * 0.3, n[1] - m * 0.15, m * 0.3, f - T12 - 4);
      // the old figure flashes on "from"
      if (f >= FROM && f < SLASH + 4) glint(g, n[0], n[1] + m * 0.05, m * 0.4, f - FROM);
      void WAIT;
    },
  });
}
// 9 — "Overnight, smuggling stops paying."  (the beach: sacks dumped, the boat rows away, a smuggler slumps)
{
  const A0 = F(tOvernight) - 3, STOP = F(tStops);
  const BX = 80;
  add({
    a: A0, b: F(tReal) - 3, plate: "beach_n", xfade: 8,
    keys: [{ f: A0, at: [BX + 1, 1.0, 0], z: 1.3, creep: 0.003 }],
    under: (g) => nightGrade(g),
    kicks: [[STOP + 4, 0.4]],
    cast: (f) => [stand(SMUG1, "s1", [BX + 1.6, 0, 0.2], 61, f, [[0, "nervous"], [STOP, "pained"]], [[0, { l: [0.3, -0.3], r: [-0.3, -0.3] }], [STOP, { l: [0.4, 0.5], r: [-0.4, 0.5] }]], { facing: 0 }),
      stand(SMUG2, "s2", [BX - 0.2, 0, 0.8], 62, f, [[0, "dazed"]], [[0, {}]], { mode: "sit", facing: 0 })],
    over: (g, v, f) => {
      const sp = v.w([BX + 1.6, 0.05, 0.0]), m = v.ppm([BX + 1.6, 0, 0]);
      const drop = clamp01((f - STOP) / 8); prop(g, "sack", sp[0] + m * 0.35, sp[1] - m * (1.1 - drop * 0.85), m * 0.7, drop * 0.6); puffs(g, sp[0] + m * 0.35, sp[1], m * 0.4, f - STOP - 8, 5, true);
      const P: V3 = [BX + 2 + (f - A0) * 0.04, 0.05, 6.5], p = v.w(P), bm = v.ppm(P); prop(g, "boat", p[0], p[1] - bm * 0.2, bm * 2.4, Math.sin(f * 0.12) * 0.06);
    },
  });
}
// 10 — "Real tea gets cheap, and everyone can afford a cup. But those little locks are still on old tea boxes today...
//       guarding tea you can now buy for pennies."  (golden drawing room: everyone sips, servants too; the caddy, a penny)
{
  const A0 = F(tReal) - 3, CHEAP = F(tCheap2), AFF = F(tAfford), CUP = F(tCup), LOCKS = F(tLocks), TODAY = F(tToday), GUARD = F(tGuarding), PEN = F(tPennies);
  const all: [Outfit, string, V3, number, boolean][] = [[GUEST1, "g1", [1.35, 0, 2.5], 41, true], [GUEST2, "g2", [-1.35, 0, 2.5], 42, true], [MAID1, "m1", [-2.6, 0, 3.6], 31, false], [BUTLER, "b1", [2.6, 0, 3.6], 32, false], [MAID2, "m2", [-3.6, 0, 2.6], 33, false], [LADY, "lady", [0.9, 0, 3.6], 11, false]];
  add({
    a: A0, b: TOTAL, plate: "dr_wide", xfade: 10,
    under: (g) => warmGrade(g),
    keys: [{ f: A0, at: [0, 1.5, 3], z: 1.1, creep: 0.002 }, { f: LOCKS - 4, dur: 26, at: [0, 0.95, 2.5], z: 2.1, creep: 0.003 }, { f: PEN - 4, dur: 10, at: [0, 0.95, 2.5], z: 2.3, creep: 0.002 }],
    kicks: [[PEN + 4, 0.4]],
    cast: (f) => all.map(([o, k, P, seed, sit], i) => stand(o, k, P, seed, f, [[0, "smile"], [AFF + i * 2, i % 2 ? "laugh" : "grin"]],
      [[0, { r: [0.35, -0.35] }], [CUP + i * 2, { r: [0.25, -0.8] }], [CUP + 14 + i * 2, { r: [0.35, -0.35] }]], { mode: sit ? "sit" : "stand", facing: i === 0 ? -1 : i === 1 ? 1 : 0 }, { noShadow: sit })),
    over: (g, v, f) => {
      for (const [, , P, , sit] of all) { const p = v.w([P[0] + (P[0] > 0 ? -0.3 : 0.3), sit ? 0.95 : 1.25, P[2] - 0.2]), m = v.ppm(P); prop(g, "cup", p[0], p[1], m * 0.32); steam(g, p[0], p[1] - m * 0.08, m * 0.5, f, 1, Math.round(P[0] * 3 + 5)); }
      // coins clink down onto the table as tea gets cheap
      for (let i = 0; i < 5; i++) { const t0 = CHEAP + i * 3, u = clamp01((f - t0) / 10); if (u <= 0) continue; const cp = v.w([-0.4 + i * 0.2, 0.8, 2.3]), m = v.ppm(TABLE); prop(g, "coin", cp[0], cp[1] - (1 - easeOut(u)) * m * 0.8, m * 0.12, f * 0.3 * (1 - u)); }
      const { c, m } = caddyAt(g, v, 0);
      if (f >= LOCKS) glint(g, c[0] + m * 0.03, c[1] + m * 0.05, m * 0.3, (f - LOCKS) % 26);
      if (f >= GUARD) keyS(g, c[0] + m * 0.22, c[1] + m * 0.05, m * 0.35, clamp01((f - GUARD) / 10) * 0.5, -0.1);
      if (f >= PEN - 2) { const u = clamp01((f - PEN + 2) / 8); prop(g, "coin", c[0] - m * 0.55, c[1] + m * 0.18 - (1 - easeOut(u)) * m * 0.9, m * 0.22, (1 - u) * 6); if (u >= 1) ringWaves(g, c[0] - m * 0.55, c[1] + m * 0.18, m * 0.1, f - PEN - 6, 0.6, 2); glint(g, c[0] - m * 0.55, c[1] + m * 0.1, m * 0.2, f - PEN - 6); }
      void TODAY;
    },
  });
}

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
