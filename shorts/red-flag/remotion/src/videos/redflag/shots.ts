// Timeline of "The Man Who Walked in Front of Cars" (Britain's Red Flag law), timed to the voice's words.json.
// Every event hangs off a spoken word (A("word", after)), so a new take of the voice re-times the film by itself.
// One village road, almost no cuts: the side-on panorama tracks the procession; the high wide shot carries the
// establishing, the "60 yards" measure and the race to Brighton; crossfades and two steam wipes join them.
import { Outfit, FrontOpts, SKINS, INK, Expr, townsfolk, P2 } from "./toon";
import { V3, plateOf, LANE } from "./story";
import { Key2, View, PlateCam, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import {
  sparkle, qmark, emark, speedLines, stampMark, scroll, rainCloud, coinArc, dimArrow, steamWipe, puff, redFlag, roadEngine,
  engineChimney, veteranCar, horse, hayCart, speedDial, leaves, signpost, dust, ringWaves, AX, calendar,
} from "./props2d";
import WORDS from "./words.json";

export const FPS = 30;
export const FLASH_AT = -99;
type Wd = { w: string; s: number; e: number };
const WS = WORDS as Wd[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** start time (s) of the first word matching any of `ws` at or after `after` */
const A = (ws: string | string[], after = 0): number => {
  const L = (Array.isArray(ws) ? ws : [ws]).map(norm);
  const w = WS.find((x) => L.includes(norm(x.w)) && x.s >= after - 1e-6);
  if (!w) throw new Error("word " + L.join("/") + " after " + after);
  return w.s;
};
const F = (t: number) => Math.round(t * FPS) - 2;
export const TOTAL = Math.ceil((WS[WS.length - 1].e + 0.55) * FPS);
const SU = 0.00216;

// ---------------- word anchors (seconds) ----------------
const tPassed = A("passed"), tFined = A("fined", tPassed), tIts = A("it's", tFined), t1865 = A(["1865", "eighteen"], tIts);
const tGiant = A("giant", t1865), tHorses = A("horses", tGiant), tPanic = A("panic", tHorses), tDitches = A("ditches", tPanic);
const tSo = A("so", tDitches), tParl = A("parliament", tSo), tLaw = A("law", tParl), tEvery = A("every", tLaw), tThree = A(["three", "3"], tEvery);
const tDriver = A("driver", tThree), tStoker = A("stoker", tDriver), tMan = A("man", tStoker), tSixty = A(["sixty", "60"], tMan);
const tHolding = A("holding", tSixty), tFlag1 = A("flag", tHolding), tTop = A("top", tFlag1), tFour = A(["four", "4"], tTop);
const tTowns = A("towns", tFour), tTwo = A(["two", "2"], tTowns), tSlower = A("slower", tTwo), tWait = A("wait", tSlower);
const tWorse = A("worse", tWait), tDropped = A("dropped", tWorse), t1878 = A(["1878", "eighteen"], tDropped), tStayed = A("stayed", t1878);
const tFirst = A("first", tStayed), tCars = A("cars", tFirst), t1890 = A(["1890s", "eighteen"], tCars), tCrawl = A("crawl", t1890), tFoot = A("foot", tCrawl);
const tUntil = A("until", tFoot), t1896 = A(["1896", "eighteen"], tUntil), tJumps = A("jumps", t1896), tFourteen = A(["fourteen", "14"], tJumps);
const tFinally = A("finally", tFourteen), tJob = A("job", tFinally), tCeleb = A("celebrate", tJob), tBrighton = A("brighton", tCeleb);
const tLord = A("lord", tBrighton), tTore = A("tore", tLord), tHalf = A("half", tTore), tNov = A("november", tHalf), tOldest = A("oldest", tNov);
const tDrive = A("drive", tOldest), tNever = A("never", tDrive), tBack = A("back", tNever);

// ---------------- geometry ----------------
const pcR = new PlateCam(plateOf("road"));
const ppmRoad = pcR.ppm([0, 0, LANE]);
/** frame centre on the road plate at world x (plate-normalised), dv shifts it vertically */
const roadAt = (x: number, y = 1.2, z = LANE): V3 => [x, y, z];

// ---------------- cast ----------------
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, ...o } as Outfit);
const FLAGMAN = O({ jacket: "#6b4a2e", pants: "#3a3530", boots: "#2a2420", hat: "cap", cap: "#3a3f52", moustache: "#3a2a20", buttons: "#e8c45a", skin: SKINS[1] });
const FLAGMAN_BARE = { ...FLAGMAN, hat: "hair", hair: "#3a2a20" } as Outfit;
const ENGDRIVER = O({ jacket: "#3b4a6b", pants: "#2b2b35", hat: "cap", cap: "#2e2a26", moustache: "#2a201a", skin: SKINS[0] });
const STOKER = O({ jacket: "#5a3b2a", pants: "#3a3530", hat: "hair", hair: "#2a201a", build: "stout", skin: SKINS[3] });
const MOTORIST = O({ jacket: "#8a6a45", pants: "#5a4a3a", hat: "cap", cap: "#8a6a45", moustache: "#5a3b2a", buttons: "#e8c45a", skin: SKINS[0] });
const BOBBY = O({ jacket: "#1f2a44", pants: "#1f2a44", hat: "shako_tall", buttons: "#e8c45a", moustache: "#4a3426", build: "stout", skin: SKINS[0] });
const LORD = O({ jacket: "#1f1d24", pants: "#1f1d24", hat: "tophat", buttons: "#e8c45a", moustache: "#d9d6d0", build: "stout", skin: SKINS[2] });
const GRANNY = O({ jacket: "#5a8fc2", pants: "#3b3f52", hat: "bonnet", dress: "#5a8fc2", skin: SKINS[0] });
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));

export type Actor = {
  o: Outfit; okey: string; P: V3; opts: FrontOpts; seed: number; hop?: number; scale?: number;
  side?: import("./toon").SideOpts; mirror?: boolean; lean?: number; noShadow?: boolean; clip?: V3[]; alpha?: number;
  /** a custom drawing (vehicles) sorted by depth with the people */
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
const SEC = (s: number) => Math.round(s * FPS);

// ---------------- drawing helpers ----------------
/** draw a road vehicle with its rear axle at world x (moving +x = screen-left on the road plate) */
const engineAt = (g: CanvasRenderingContext2D, v: View, x: number, f: number, z = LANE, puffs = true) => {
  const o = v.w([x, 0, z]), m = v.ppm([x, 0, z]);
  if (AX.ex) { const ex = v.w([x + 1, 0, z]), ey = v.w([x, 1, z]); AX.ex = [ex[0] - o[0], ex[1] - o[1]]; AX.ey = [ey[0] - o[0], ey[1] - o[1]]; }
  roadEngine(g, o, m * 0.8, -1, x / 0.8, f);
  if (puffs) {
    const c = engineChimney(o, m * 0.8, -1, x / 0.8);
    for (let i = 0; i < 6; i++) { const age = (f + i * 7) % 42; puff(g, c[0] + age * m * 0.014, c[1], m * 0.3, age, 42, "#eef0f5"); }
  }
};
const carAt = (g: CanvasRenderingContext2D, v: View, x: number, f: number, col: string, z = LANE, honk = 0, smoke = true) => {
  const o = v.w([x, 0, z]), m = v.ppm([x, 0, z]);
  if (AX.ex) { const ex = v.w([x + 1, 0, z]), ey = v.w([x, 1, z]); AX.ex = [ex[0] - o[0], ex[1] - o[1]]; AX.ey = [ey[0] - o[0], ey[1] - o[1]]; }
  veteranCar(g, o, m, -1, x, f, col, honk);
  if (smoke && !AX.ex) for (let i = 0; i < 3; i++) { const age = (f + i * 9) % 26; puff(g, o[0] + 0.45 * m + age * m * 0.02, o[1] - 0.5 * m, m * 0.14, age, 26, "#d9d6dc", [0.3, -0.6]); }
};
const NOBODY = { o: {} as Outfit, okey: "veh", opts: {}, seed: 0 };
const engineItem = (x: number, f: number, z = LANE): Actor => ({ ...NOBODY, P: [x + 1.2, 0, z], draw: (g, v) => engineAt(g, v, x, f, z) });
const carItem = (x: number, f: number, col: string, z = LANE, honk = 0): Actor => ({ ...NOBODY, P: [x + 0.6, 0, z], draw: (g, v) => carAt(g, v, x, f, col, z, honk) });
/** a stamp that shows from f0 and clears at f1 */
const stampW = (g: CanvasRenderingContext2D, text: string, f: number, f0: number, f1: number, x = 540, y = 430, w = 520) => {
  if (f < f0 || f >= f1 + 8) return;
  g.save(); g.globalAlpha = 1 - smooth((f - f1) / 8); stampMark(g, x, y, w, text, f - f0, -0.1); g.restore();
};
const withAxes = (on: boolean, fn: () => void) => { if (on) { AX.ex = [1, 0]; AX.ey = [0, -1]; } fn(); AX.ex = null; AX.ey = null; };
const label = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number) => {
  if (age < 0) return;
  const k = easeOutBack(clamp01(age / 7), 2.2), a = 1;
  g.save(); g.translate(x, y); g.scale(k, k); g.globalAlpha = a;
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
/** springy dial value: eases to each target with an overshoot wobble */
const dialAt = (f: number, keys: [number, number][]) => {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [k, to] = keys[i]; if (f < k) break;
    const from = v, t = (f - k) / 30, w = 1 - Math.exp(-t * 5) * Math.cos(t * 16);
    v = from + (to - from) * w;
  }
  return v;
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
/** warm late-afternoon regrade (November ending) */
const warmGrade = (g: CanvasRenderingContext2D) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = "#ffdcb5"; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen";
  const gl = g.createRadialGradient(1000, 150, 40, 1000, 150, 1200); gl.addColorStop(0, "rgba(255,190,110,0.5)"); gl.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = gl; g.fillRect(0, 0, 1080, 1920); g.restore();
};

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });

// 1 — HOOK. "This man's whole job was walking in front of cars, waving a red flag. And if the car passed him, the
//      driver got fined."  The flag man leads a crawling car; the car creeps past him; a bobby pops up: FINED.
const W1 = F(tIts);
const motorist = (x: number, f: number, ex: [number, Expr][], hands: [number, Hands][], key = "mot", o = MOTORIST, z = LANE) =>
  stand(o, key, [x + 0.12, 0.42, z + 0.12], 12, f, ex, hands, { mode: "sit", facing: -1 }, { noShadow: true });
const DRIVE_H: Hands = { l: [0.35, 0.1], r: [0.45, 0.05] };
{
  const PASS = F(tPassed), FINE = F(tFined);
  const manPath: [number, number, number][] = [[0, -3.0, LANE - 0.15], [PASS + 10, 1.0, LANE - 0.15], [PASS + 14, 1.05, LANE - 0.15]];
  const carX = (f: number) => (f < PASS ? -5.6 + (1.3 / FPS) * f : -5.6 + (1.3 / FPS) * PASS + (2.4 / FPS) * smooth((f - PASS) / 26) * (f - PASS) * 1.3);
  const carStop = (f: number) => Math.min(carX(f), carX(FINE + 2));
  add({
    a: 0, b: W1, plate: "road",
    keys: [{ f: 0, at: [0.5, 0.5], z: 1.1, creep: 0.0012, follow: (f) => roadAt((walkAt(f, manPath).x + carStop(f) + 1.0) / 2, 1.25) },
      { f: FINE - 4, dur: 12, at: [0.5, 0.5], z: 1.28, roll: 0.03, creep: 0.0015, punch: 0.006, follow: (f) => roadAt(carStop(f) + 1.4, 1.2) }],
    kicks: [[FINE, 0.8]],
    cast: (f) => {
      const x = carStop(f);
      const out: Actor[] = [walker(FLAGMAN, "flag", 11, f, manPath, f < PASS + 8 ? "smile_closed" : "shock"),
        carItem(x, f, "#8c2f39", LANE, f > PASS - 8 && f < PASS ? 1 : 0),
        motorist(x, f, [[0, "grin"], [FINE, "shock"]], [[0, DRIVE_H], [FINE, { l: [0.25, -0.5], r: [-0.25, -0.5] }]])];
      if (f >= FINE - 6) out.push(stand(BOBBY, "bob", [x + 3.0, 0, LANE - 1.2], 13, f, [[0, "stern"]], [[0, { r: [0.4, -0.6] }]], { facing: 1 },
        { hop: -1.9 * (1 - easeOutBack(clamp01((f - FINE + 6) / 8), 1.6)), noShadow: f < FINE }));
      return out;
    },
    over: (g, v, f) => {
      const man = walker(FLAGMAN, "flag", 11, f, manPath, "smile");
      redFlag(g, sideHand(v, man, f), v.ppm(man.P), -1, f);
      const c = v.w([carStop(f) + 0.2, 1.75, LANE]), m = v.ppm([0, 0, LANE]);
      emark(g, c[0], c[1] - m * 0.3, m * 0.35, f - FINE - 2, 0.1);
      stampMark(g, 540, 520, 560, "FINED!", f - FINE - 3, -0.12);
      if (f >= FINE + 4) coinArc(g, v.w([carStop(f) + 0.3, 1.4, LANE]), v.w([carStop(FINE) + 3.0, 1.3, LANE - 1.2]), clamp01((f - FINE - 4) / 14), 5, m * 0.06, m * 0.6);
    },
  });
}
// 2 — "It's 1865, England."  (steam wipe; high wide over the village; steam rising beyond the hedges)
const W2 = F(tGiant) - 4;
add({
  a: W1, b: W2, plate: "road_wide",
  keys: [{ f: W1, at: [0.5, 0.36], z: 1.2, creep: 0.0026 }],
  over: (g, v, f) => {
    stampW(g, "1865", f, F(t1865), W2 + 20);
    const P: V3 = [8 + (f - W1) * 0.02, 3.4, 1.5], c = v.w(P), m = v.ppm(P);
    for (let i = 0; i < 7; i++) { const age = (f + i * 6) % 42; puff(g, c[0] - age * m * 0.02, c[1], m * 0.7, age, 42, "#f4f4f6"); }
  },
});
// 3 — "Giant steam engines are rumbling down country roads. Horses panic. Carts end up in ditches. So Parliament passes a
//      law. Every road engine needs three men: a driver, a stoker... and a man walking sixty yards ahead, holding a red
//      flag."  (one side-on shot: the engine rolls in, the horse rears, the cart tips; the law; the crew pops on board;
//      the camera glides from the engine to the flag man while the 60-yard line draws itself between them)
const W3 = F(tTop) - 6;
{
  const HORSE = F(tHorses), PANIC = F(tPanic), DITCH = F(tDitches), PARL = F(tParl), LAW = F(tLaw), EVERY = F(tEvery), THREE = F(tThree), DRV = F(tDriver), STK = F(tStoker), MAN = F(tMan), SIX = F(tSixty), HOLD = F(tFlag1);
  const STOP = DITCH + 4;
  const ex = (f: number) => drive(Math.min(f, STOP), W2 - 50, -7.0, 1.2);
  const horseX = (f: number) => 3.4 - Math.min(f - W2, PANIC - 6 - W2) * (1.4 / FPS);
  const manX = () => ex(STOP) + 5.0;
  const HZ = LANE - 1.0;
  add({
    a: W2, b: W3, plate: "road", xfade: 12,
    keys: [
      { f: W2, at: [0.5, 0.5], z: 1.02, creep: 0.001, follow: (f) => roadAt(ex(f) + 1.4, 1.5) },
      { f: HORSE - 14, dur: 18, at: [0.5, 0.5], z: 1.02, creep: 0.0012, follow: (f) => roadAt((ex(f) + 1.6 + horseX(f) + 1.0) / 2, 1.5) },
      { f: PARL - 6, dur: 20, at: [0.5, 0.5], z: 1.05, creep: 0.0012, follow: (f) => roadAt(ex(f) + 1.2, 1.6) },
      { f: DRV - 8, dur: 16, at: [0.5, 0.5], z: 1.3, creep: 0.0015, follow: (f) => roadAt(ex(f) + 0.1, 1.7) },
      { f: MAN - 4, dur: Math.max(16, SIX + 14 - MAN), at: [0.5, 0.5], z: 1.18, creep: 0.0012, follow: () => roadAt(manX() - 0.4, 1.4) },
    ],
    kicks: [[PANIC, 0.6], [DITCH + 2, 1.0], [LAW, 0.7], [DRV, 0.3], [STK, 0.3], [HOLD, 0.3]],
    over: (g, v, f) => overS3(g, v, f),
    cast: (f) => {
      const out = castCrew(f);
      if (f < PARL + 10) out.push({ ...NOBODY, P: [horseX(f), 0, HZ], draw: (g, v) => drawHorse(g, v, f) });
      return out;
    },
  });
  function drawHorse(g: CanvasRenderingContext2D, v: View, f: number) {
      const hx = horseX(f), rear = f < PANIC - 4 ? 0 : easeOutBack(clamp01((f - PANIC + 4) / 8), 1.4) * (1 - smooth((f - DITCH - 20) / 14));
      const tip = clamp01((f - DITCH + 2) / 9);
      const ho = v.w([hx, 0, HZ]), hm = v.ppm([hx, 0, HZ]), co = v.w([hx + 2.2, 0, HZ - tip * 1.2]);
      g.save(); g.globalAlpha = 1 - clamp01((f - PARL) / 10);
      hayCart(g, [co[0], co[1] + tip * tip * hm * 0.35], hm, 1, -hx, tip);
      horse(g, ho, hm, 1, (W2 - f) * 0.045, rear, f);
      g.restore();
      if (f >= DITCH) for (let i = 0; i < 6; i++) puff(g, co[0] + (i - 2.5) * hm * 0.35, co[1] - hm * 0.3, hm * 0.5, f - DITCH - i, 24, "#e8d28a", [(i - 2.5) * 0.3, -0.8]);
  }
  function castCrew(f: number): Actor[] {
      const x = ex(f), out: Actor[] = [engineItem(x, f)];
      const up = (f0: number) => -0.9 * (1 - easeOutBack(clamp01((f - f0) / 8), 1.8));
      if (f >= DRV - 6 || f < PARL) out.push(stand(ENGDRIVER, "drv", [x - 0.28, 0.5, LANE + 0.14], 21, f, [[0, "neutral"], [PANIC, "shock"], [DRV, "grin"]],
        [[0, { l: [0.3, 0.2], r: [0.45, -0.1] }], [DRV, { r: [0.35, -0.95] }], [DRV + 14, { l: [0.3, 0.2], r: [0.45, -0.1] }]], { facing: -1 }, { hop: f >= PARL ? up(DRV - 6) : 0, noShadow: true }));
      if (f >= STK - 6) out.push(stand(STOKER, "stk", [x + 0.12, 0.5, LANE + 0.2], 22, f, [[0, "grin"]],
        [[0, { l: [0.4, 0.4], r: [0.6, 0.3] }], [STK + 4, { l: [0.2, 0.0], r: [0.4, -0.1] }], [STK + 10, { l: [0.4, 0.4], r: [0.6, 0.3] }]], { facing: -1 }, { hop: up(STK - 6), noShadow: true }));
      if (f >= MAN - 20) out.push(walker(FLAGMAN, "flag", 11, f, [[MAN - 20, manX() - 0.6, LANE - 0.15], [W3 + 30, manX() + 1.2, LANE - 0.15]], "smile_closed"));
      return out;
  }
  function overS3(g: CanvasRenderingContext2D, v: View, f: number) {
      const hx = horseX(f), hp = v.w([hx + 0.9, 2.3, HZ]), m = v.ppm([0, 0, LANE]);
      emark(g, hp[0], hp[1] - m * 0.2, m * 0.4, f - PANIC - 1, 0.15);
      if (f >= PARL - 4 && f < EVERY + 12) {
        const u = clamp01((f - PARL + 4) / 10), out = smooth((f - EVERY) / 10);
        g.save(); g.translate(0, -out * 1400); g.rotate(-out * 0.2);
        scroll(g, 540, 560, 760, "LOCOMOTIVE ACT", ["3 men per engine", "Max 4 mph (2 in towns)", "Man walks 60 yards ahead", "...with a RED FLAG"], u);
        stampMark(g, 690, 880, 420, "LAW", f - LAW - 1, -0.2);
        g.restore();
      }
      bigNum(g, 540, 430, "3", f - THREE);
      const d = v.w([ex(f) - 0.28, 2.6, LANE]), s2 = v.w([ex(f) + 0.12, 2.6, LANE]);
      label(g, d[0] - 120, d[1] - 60, "DRIVER", f - DRV - 2);
      label(g, s2[0] + 120, s2[1] - 150, "STOKER", f - STK - 2);
      if (f > STK + 4 && f < STK + 30) for (let i = 0; i < 6; i++) { const sp = v.w([ex(f) - 0.3, 1.0 + i * 0.12, LANE]); sparkle(g, sp[0] + (hh(i, 3) - 0.5) * 60, sp[1], 16, (f - STK - 4 - i * 2) / 10, "#ffb04a"); }
      // the 60-yard line grows from the engine's nose to the flag man as the camera glides
      if (f >= MAN - 4) {
        const a = v.w([ex(f) + 2.75, 2.75, LANE - 0.2]), fm = walker(FLAGMAN, "flag", 11, f, [[MAN - 20, manX() - 0.6, LANE - 0.15], [W3 + 30, manX() + 1.2, LANE - 0.15]], "smile");
        const b = v.w([fm.P[0], 2.75, LANE - 0.2]);
        dimArrow(g, a, b, "60 YARDS", (f - SIX + 4) / 14, 64, [0, -10]);
        const hm = v.ppm(fm.P), hand = sideHand(v, fm, f);
        if (f >= HOLD - 4) redFlag(g, hand, hm, -1, f, { lift: 0.3 + 0.7 * easeOutBack(clamp01((f - HOLD + 4) / 10), 1.6) });
        ringWaves(g, hand[0], hand[1] - hm * 1.1, hm * 0.5, f - HOLD, 0.8, 2, "255,120,110");
        sparkle(g, hand[0] - hm * 0.3, hand[1] - hm * 1.35, hm * 0.35, (f - HOLD) / 12);
      }
  }
}
// 4 — "Top speed? Four miles an hour. In towns? Two. Slower than a brisk walk. Wait... it gets worse. The flag was
//      dropped in 1878, but the walking man stayed."  (side-on procession; the dial; granny overtakes; the flag blows away)
const W4 = F(tFirst) - 8;
{
  const TOP = F(tTop), FOUR = F(tFour), TWO = F(tTwo), SLOW = F(tSlower), WAIT = F(tWait), DROP = F(tDropped), Y1878 = F(t1878), STAY = F(tStayed);
  const engX = (f: number) => drive(f, W3 - 30, -7.0, 0.5, 1);
  const manX = (f: number) => engX(f) + 4.6;
  const grannyPath: [number, number, number][] = [[SLOW - 20, -7.5, LANE - 1.0], [SLOW + 40, -1.6, LANE - 1.0]];
  const manPath: [number, number, number][] = [[W3 - 30, manX(W3 - 30), LANE - 0.15], [W4 + 10, manX(W4 + 10), LANE - 0.15]];
  add({
    a: W3, b: W4, plate: "road", xfade: 10,
    keys: [
      { f: W3, at: [0.5, 0.5], z: 1.05, creep: 0.001, follow: (f) => roadAt(engX(f) + 2.0, 1.6) },
      { f: SLOW - 12, dur: 20, at: [0.5, 0.5], z: 1.08, creep: 0.001, follow: (f) => roadAt(engX(f) + 0.6, 1.5) },
      { f: WAIT - 14, dur: 26, at: [0.5, 0.5], z: 1.4, roll: -0.06, creep: 0.0015, punch: 0.005, pn: 12, follow: (f) => roadAt(manX(f), 1.45) },
      { f: DROP - 8, dur: 12, at: [0.5, 0.5], z: 1.3, roll: 0, creep: 0.0012, follow: (f) => roadAt(manX(f), 1.7) },
    ],
    kicks: [[FOUR, 0.4], [TWO, 0.4], [WAIT, 0.6], [Y1878, 0.5]],
    cast: (f) => {
      const x = engX(f), out: Actor[] = [engineItem(x, f)];
      out.push(stand(ENGDRIVER, "drv", [x - 0.28, 0.5, LANE + 0.14], 21, f, [[0, "neutral"], [SLOW + 10, "pained"]], [[0, { l: [0.3, 0.2], r: [0.45, -0.1] }]], { facing: -1 }, { noShadow: true }));
      out.push(stand(STOKER, "stk", [x + 0.12, 0.5, LANE + 0.2], 22, f, [[0, "neutral"], [SLOW + 14, "dazed"]], [[0, { l: [0.4, 0.4], r: [0.6, 0.3] }]], { facing: -1 }, { noShadow: true }));
      out.push(walker(FLAGMAN, "flag", 11, f, manPath, f < WAIT ? "smile_closed" : f < DROP ? "nervous" : f < STAY ? "shock" : "relief"));
      if (f >= SLOW - 20) out.push(walker(GRANNY, "gran", 31, f, grannyPath, "smile"));
      return out;
    },
    over: (g, v, f) => {
      const mph = dialAt(f, [[0, 0], [FOUR - 2, 4], [TWO - 2, 2]]);
      const dk = (f >= TOP - 2 ? easeOutBack(clamp01((f - TOP + 2) / 8), 1.8) : 0) * (1 - smooth((f - SLOW - 10) / 8));
      speedDial(g, 540, 560, 300, mph, dk);
      const fm = walker(FLAGMAN, "flag", 11, f, manPath, "smile"), hm = v.ppm(fm.P), hand = sideHand(v, fm, f);
      if (f < DROP) redFlag(g, hand, hm, -1, f);
      else {
        const u = (f - DROP) / 30;
        if (u < 1.5) { g.save(); g.translate(u * 700, -u * 900 - Math.sin(u * 9) * 40); g.rotate(u * 2.5); redFlag(g, hand, hm, -1, f, { lift: 1 }); g.restore(); }
        g.strokeStyle = INK; g.lineWidth = Math.max(3, hm * 0.05); g.lineCap = "round"; g.beginPath(); g.moveTo(hand[0], hand[1] + hm * 0.2); g.lineTo(hand[0] - hm * 0.08, hand[1] - hm * 1.25); g.stroke();
      }
      const head = v.w([manX(f), 1.95, LANE - 0.15]);
      qmark(g, head[0] + hm * 0.35, head[1] - hm * 0.2, hm * 0.4, f - WAIT - 2, 0.15);
      emark(g, head[0] - hm * 0.3, head[1] - hm * 0.25, hm * 0.38, f - DROP - 4, -0.15);
      stampW(g, "1878", f, Y1878, W4);
      if (f >= SLOW + 4) { const gp = v.w([walkAt(f, grannyPath).x, 1.7, LANE - 1.0]); sparkle(g, gp[0] - 40, gp[1] - 40, 30, (f - SLOW - 14) / 12); speedLines(g, gp[0] + 80, gp[1] + 120, 40, 120, (f - SLOW) / 30, 6); }
      if (f >= STAY) label(g, head[0], head[1] - hm * 0.9, "STILL WALKING", f - STAY - 2);
    },
  });
}
// 5 — "So when the first cars showed up in the 1890s, they still had to crawl behind a guy on foot! Until 1896. The limit
//      jumps to fourteen miles an hour, and the walking man is finally out of a job."  (whip in; honk; dial; ZOOM)
const W5 = F(tCeleb) - 8;
{
  const CARS = F(tCars), Y90 = F(t1890), CRAWL = F(tCrawl), FOOT = F(tFoot), Y96 = F(t1896), JUMP = F(tJumps), FOURTEEN = F(tFourteen), FIN = F(tFinally), JOB = F(tJob);
  const GO = FOURTEEN + 6;
  const manX = (f: number) => -2.6 + (Math.min(f, GO) - W4) * (0.8 / FPS);
  const carX = (f: number) => (f < GO ? manX(f) - 2.5 : manX(GO) - 2.5 + 0.5 * ((f - GO) / FPS) ** 2 * 26);
  const sitX = () => manX(GO) - 0.4;
  add({
    a: W4, b: W5, plate: "road", whip: true,
    keys: [
      { f: W4, at: [0.5, 0.5], z: 1.02, creep: 0.0012, follow: (f) => roadAt((manX(f) + carX(Math.min(f, GO)) + 1.0) / 2, 1.3) },
      { f: GO + 6, dur: 20, at: [0.5, 0.5], z: 1.25, creep: 0.0018, follow: () => roadAt(sitX(), 1.1) },
      { f: JOB - 3, dur: 8, at: [0.5, 0.5], z: 1.45, roll: 0.03, creep: 0.0015, punch: 0.005, pn: 14, follow: () => roadAt(sitX(), 1.0) },
    ],
    kicks: [[CARS, 0.3], [Y96, 0.5], [FOURTEEN, 0.8], [GO + 2, 1.2]],
    under: (g, v, f) => { const x = carX(f); if (f >= GO) { const o = v.w([x, 0, LANE]), m = v.ppm([x, 0, LANE]); dust(g, o[0] + 0.6 * m, o[1], m, f, clamp01((f - GO) / 6), -1); } },
    cast: (f) => {
      const out: Actor[] = [], x = carX(f);
      if (x < 9) {
        out.push(carItem(x, f, "#8c2f39", LANE, f >= FOOT - 4 && f < FOOT + 4 ? 1 : 0));
        out.push(motorist(x, f, [[0, "pained"], [CRAWL, "stern"], [FOURTEEN, "laugh"]],
          [[0, DRIVE_H], [FOOT - 4, { r: [0.75, -0.25] }], [FOOT + 6, DRIVE_H], [FOURTEEN, { l: [0.25, -0.6], r: [-0.25, -0.6] }], [GO, DRIVE_H]]));
      }
      if (f < GO + 4) out.push(walker(FLAGMAN, "flag", 11, f, [[W4, manX(W4), LANE - 0.15], [GO, manX(GO), LANE - 0.15]], f < FOOT ? "smile_closed" : "whistle"));
      else if (f < FIN - 4) {
        const spin = (f - GO) / 18;
        out.push({ ...stand(FLAGMAN_BARE, "flag", [manX(GO), 0, LANE - 0.15], 11, f, [[0, "dazed"]], [[0, { l: [-0.3, -0.6], r: [0.3, -0.6] }]], { facing: Math.floor(spin * 4) % 2 ? 1 : -1 }), lean: Math.sin(spin * 9) * 0.12 * (1 - clamp01(spin)) });
      } else out.push(stand(FLAGMAN_BARE, "flag", [sitX(), 0.0, LANE - 1.0], 11, f, [[0, "pained"]], [[0, { l: [0.2, 0.4], r: [0.3, 0.35] }]], { mode: "sit", facing: 0 }));
      return out;
    },
    over: (g, v, f) => {
      const m = v.ppm([0, 0, LANE]);
      const cp = v.w([carX(f) + 0.8, 1.2, LANE]);
      if (f < GO) sparkle(g, cp[0], cp[1] - m * 0.3, m * 0.4, (f - CARS) / 12);
      stampW(g, "1890s", f, Y90, Y96 - 10);
      if (f >= FOOT - 4 && f < FOOT + 12) { const hn = v.w([carX(f) + 1.45, 1.35, LANE]); ringWaves(g, hn[0], hn[1], m * 0.2, f - FOOT + 4, 0.8, 3, "255,236,160"); label(g, hn[0] - 120, hn[1] - 150, "HONK!", f - FOOT + 2); }
      stampW(g, "1896", f, Y96, JUMP - 2);
      const mph = dialAt(f, [[0, 4], [FOURTEEN - 2, 14]]);
      const dk = f < JUMP - 4 ? 0 : easeOutBack(clamp01((f - JUMP + 4) / 8), 1.8) * (1 - smooth((f - GO - 14) / 8));
      speedDial(g, 540, 600, 300, mph, dk);
      if (f >= FOURTEEN) { ringWaves(g, 540, 540, 200, f - FOURTEEN, 1, 3, "255,220,120"); sparkle(g, 700, 420, 70, (f - FOURTEEN) / 12); }
      if (f >= GO) { speedLines(g, cp[0], cp[1], m * 0.6, m * 2.2, (f - GO) / 14, 18); const cap = v.w([manX(GO), 2.0, LANE - 0.15]), u = (f - GO) / 24;
        if (u < 1) { g.save(); g.translate(cap[0] - u * 500, cap[1] - Math.sin(u * Math.PI) * 300); g.rotate(u * 8); g.beginPath(); g.ellipse(0, 0, m * 0.2, m * 0.08, 0, 0, 7); g.fillStyle = "#3a3f52"; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.restore(); } }
      if (f >= FIN - 4) { const sp = v.w([sitX(), 2.0, LANE - 1.0]); rainCloud(g, sp[0], sp[1] - m * 0.2, m * 0.6, (f - JOB + 6) / 40); }
    },
  });
}
// 6 — "To celebrate, drivers raced from London to Brighton,"  (side-on: veteran cars whoosh past the BRIGHTON sign)
const W6 = F(tLord) - 8;
const COLS = ["#8c2f39", "#2f6a43", "#3f6fb5", "#c9a23a", "#5a3b2a", "#7b5ac9"];
{
  const raceX = (f: number, i: number) => -9.5 + (f - W5 - i * 9) * (7.5 / FPS);
  add({
    a: W5, b: W6, plate: "road", xfade: 10,
    keys: [{ f: W5, at: roadAt(0.6, 1.3), z: 1.12, creep: 0.0018 }],
    kicks: [0, 1, 2, 3, 4].map((i) => [W5 + i * 9 + 36, 0.2] as [number, number]),
    under: (g, v, f) => { for (let i = 0; i < 5; i++) { const x = raceX(f, i); if (x > -9 && x < 9) { const o = v.w([x, 0, LANE + 0.1]), m = v.ppm([x, 0, LANE]); dust(g, o[0] + 0.6 * m, o[1], m, f + i * 5, 1, -1); } } },
    cast: (f) => {
      const out: Actor[] = [];
      for (let i = 0; i < 5; i++) { const x = raceX(f, i); if (x > -9 && x < 9) { out.push(carItem(x, f, COLS[i], LANE + 0.1)); out.push(motorist(x, f, [[0, i % 2 ? "laugh" : "grin"]], [[0, { l: [0.35, 0.1], r: [0.2, -0.9] }]], "rc" + i, i % 2 ? MOTORIST : LORD, LANE + 0.1)); } }
      return out;
    },
    over: (g, v, f) => {
      for (let i = 0; i < 5; i++) { const x = raceX(f, i); if (x > -9 && x < 9) { const c = v.w([x + 0.8, 1.0, LANE]); speedLines(g, c[0] + 200, c[1], 30, 160, 0.5, 8); } }
      const sp = v.w([1.2, 0, -3.4]); signpost(g, sp[0], sp[1], v.ppm([0, 0, -3.4]) * 1.9, "BRIGHTON", easeOutBack(clamp01((f - F(tBrighton) + 6) / 8), 1.8));
    },
  });
}
// 7 — "and a lord tore a red flag in half."  (side-on: the lord tears it; confetti; the crowd cheers)
const W7 = F(tNov) - 14;
{
  const TORE = F(tTore), HALF = F(tHalf);
  const crowd = (f: number) => [0, 1, 2, 3, 4, 5].map((i) => stand(FOLK[i], "c" + i, [-2.6 + i * 1.05, 0, 3.3 + (i % 2) * 0.4], 40 + i, f,
    [[0, "smile"], [TORE + 2, i % 2 ? "laugh" : "grin"]], [[0, {}], [TORE + 2 + i, { l: [0.25, -1.0], r: [-0.25, -1.0] }]], {}, { hop: f > TORE + 2 ? Math.abs(Math.sin((f - TORE - i * 3) * 0.3)) * 0.18 : 0 }));
  add({
    a: W6, b: W7, plate: "road", xfade: 10,
    keys: [{ f: W6, at: [0, 1.6, LANE], z: 1.2, creep: 0.0015 },
      { f: TORE - 3, dur: 8, at: [0, 1.7, LANE], z: 1.42, roll: -0.03, creep: 0.0015, punch: 0.006, pn: 14 }],
    kicks: [[TORE + 2, 0.9]],
    cast: (f) => [...crowd(f), stand(LORD, "lord", [0, 0, LANE], 51, f, [[0, "grin"], [TORE + 1, "laugh"]],
      [[0, { l: [-0.1, -0.55], r: [0.1, -0.55] }], [TORE, { l: [-0.6, -0.75], r: [0.6, -0.75] }]], { facing: 0 })],
    over: (g, v, f) => {
      const m = v.ppm([0, 0, LANE]), c = v.w([0, 1.55, LANE]);
      const tear = f < TORE ? 0 : easeOut(clamp01((f - TORE) / 14));
      redFlag(g, [c[0] + m * 0.3, c[1] + m * 0.55], m * 1.2, 1, f, { tear, lift: 0.9 });
      confetti(g, c[0], c[1] - m * 0.4, m * 1.3, f - TORE - 2);
      sparkle(g, c[0] - m * 0.5, c[1] - m * 0.8, m * 0.4, (f - TORE) / 12);
      sparkle(g, c[0] + m * 0.6, c[1] - m * 0.6, m * 0.3, (f - TORE - 4) / 12);
      ringWaves(g, c[0], c[1], m * 0.6, f - HALF, 1, 3, "255,236,160");
    },
  });
}
// 8 — "And every November, the oldest cars in the world still make that same drive. The flag man never got his job
//      back."  (November light, falling leaves, the parade; the old flag man steps out in front of one anyway)
{
  const NOV = F(tNov), OLD = F(tOldest), NEVER = F(tNever), BACK = F(tBack);
  const carXi = (f: number, i: number) => drive(f, W7 - 30 + i * 30, -9.5, 2.0, 1);
  const crowd = (f: number) => [0, 1, 2, 3, 4, 5, 0, 2].map((k, i) => stand(FOLK[k], "n" + i, [-5.6 + i * 1.45, 0, 3.3 + (i % 2) * 0.35], 60 + i, f,
    [[0, i % 3 ? "smile" : "grin"]], [[0, i % 2 ? { r: [0.3, -1.0] } : {}]], {}, { hop: Math.abs(Math.sin((f + i * 11) * 0.12)) * 0.06 }));
  const oldPath: [number, number, number][] = [[NEVER - 10, -4.6, LANE - 1.3], [NEVER + 40, -3.0, LANE - 1.3]];
  add({
    a: W7, b: TOTAL, plate: "road_w", xfade: 14,
    keys: [{ f: W7, at: roadAt(-0.8, 1.6), z: 1.08, creep: 0.0012 },
      { f: NEVER - 10, dur: 24, at: [0.5, 0.5], z: 1.2, creep: 0.0015, follow: (f) => roadAt(walkAt(f, oldPath).x - 0.3, 1.5) },
      { f: BACK - 2, dur: 8, at: [0.5, 0.5], z: 1.36, roll: 0.03, creep: 0.002, punch: 0.006, pn: 14, follow: (f) => roadAt(walkAt(f, oldPath).x - 0.1, 1.55) }],
    kicks: [[BACK, 0.5]],
    under: (g) => warmGrade(g),
    cast: (f) => {
      const out: Actor[] = [...crowd(f)];
      for (let i = 0; i < 4; i++) { const x = carXi(f, i); if (x > -9.4 && x < 9) { out.push(carItem(x, f, COLS[(i + 2) % 6], LANE + 0.2)); out.push(motorist(x, f, [[0, "grin"]], [[0, { l: [0.35, 0.1], r: [0.2, -0.9] }]], "pm" + i, i % 2 ? MOTORIST : LORD, LANE + 0.2)); } }
      out.push(walker(FLAGMAN, "old", 81, f, oldPath, f < BACK ? "smile_closed" : "grin"));
      return out;
    },
    over: (g, v, f) => {
      leaves(g, f, 26, clamp01((f - W7) / 20));
      calendar(g, 190, 260, 170, "NOV", null, 1, pop(f, NOV, 7) * (1 - smooth((f - OLD - 40) / 10)));
      const fm = walker(FLAGMAN, "old", 81, f, oldPath, "smile");
      redFlag(g, sideHand(v, fm, f), v.ppm(fm.P), -1, f);
      const hd = v.w([fm.P[0], 2.0, fm.P[2]]), m = v.ppm(fm.P);
      if (f >= BACK) { sparkle(g, hd[0] + m * 0.35, hd[1] - m * 0.2, m * 0.3, (f - BACK) / 12); sparkle(g, hd[0] - m * 0.3, hd[1], m * 0.22, (f - BACK - 4) / 12); }
    },
  });
}

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
/** full-frame overlays after the shots: the steam wipe into 1865 */
export const overlay = (g: CanvasRenderingContext2D, f: number) => {
  for (const W of [W1]) {
    if (f >= W - 7 && f < W) steamWipe(g, smooth((f - (W - 7)) / 7), f, -1);
    else if (f >= W && f < W + 10) steamWipe(g, 1 - smooth((f - W) / 10), f, 1);
  }
};
void ppmRoad; void SEC;
