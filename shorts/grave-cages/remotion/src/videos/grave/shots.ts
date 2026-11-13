// Timeline of "Why People Locked Their Dead in Cages" (74.9 s, 2248 f at 30 fps), timed to voice2/words.json.
// Formula: paradox hook (+ vampire gag) -> setting -> mystery (clothes left, body gone) -> "You see," the anatomy
// schools -> escalation (snatchers, watchers, towers, the cage) -> "Wait..." (six weeks, then rented out) -> Burke &
// Hare -> the law -> payoff (the cages today + the vampire callback). Reactions land 2 frames before their word.
import { Outfit, FrontOpts, SideOpts, SKIN, SKINS, INK, Expr, KID, townsfolk, Pen, P2, fxBurst, fxPuff } from "./toon";
import { V3, HERO, TABLE, TOWER } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, valAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import {
  coin, coinArc, sparkle, qmark, speedLines, stampMark, scroll, paperBits, lanternGlow, lantern2, shovel2, bundle, padlock, calendar,
  newspaper, coffinItems, toLet, phone2, vampCollar, sparks, emark, GOLD,
} from "./props2d";

export const FPS = 30;
export const TOTAL = 2248;
const W = (t: number) => Math.round(t * FPS) - 2;

// ---------------- cast ----------------
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, ...o } as Outfit);
const VAMP = O({ jacket: "#1d1724", pants: "#1d1724", hat: "hair", hair: "#120d18", skin: "#ecebf6", buttons: "#b0202c" });
const WIDOW = O({ jacket: "#2a2630", pants: "#2a2630", hat: "bonnet", dress: "#2a2630", skin: SKINS[0] });
const SON = O({ jacket: "#3f4a6b", pants: "#3b3f52", boots: "#4a3426", hat: "cap", cap: "#3a3f52", skin: SKINS[1] });
const GRANDPA = O({ jacket: "#5a4a3a", boots: "#4a3426", hat: "hair", hair: "#e9e6e0", moustache: "#d9d6d0", build: "stout", skin: SKINS[0] });
const MINISTER = O({ jacket: "#1f1d24", pants: "#1f1d24", hat: "tophat", buttons: "#f1ece0", skin: SKINS[2], build: "stout" });
const SN1 = O({ jacket: "#4a4f3a", pants: "#3a3530", boots: "#2a2420", hat: "cap", cap: "#2e2a26", moustache: "#3a2a20", skin: SKINS[3] });
const SN2 = O({ jacket: "#5a3b2a", pants: "#2e2a26", boots: "#2a2420", hat: "cap", cap: "#3a3f52", skin: SKINS[1] });
const DOCTOR = O({ jacket: "#2c3140", pants: "#2b2b35", hat: "tophat", buttons: "#e8c45a", moustache: "#5a3b2a", build: "stout", skin: SKINS[0] });
const GUARD = O({ jacket: "#3f6fb5", pants: "#2b2b35", hat: "shako", buttons: "#e8c45a", moustache: "#4a3426", skin: SKINS[1], build: "stout" });
const BURKE = O({ jacket: "#3f3a4a", pants: "#2b2b35", hat: "tophat", skin: SKINS[1] });
const HARE = O({ jacket: "#6b4a2e", pants: "#3a3530", boots: "#2a2420", hat: "cap", cap: "#5a2f2f", skin: SKINS[2], build: "stout", moustache: "#3a2a20" });
const SMITH = O({ jacket: "#7a4a2e", pants: "#3b3f52", boots: "#2a2420", hat: "hair", hair: "#3a2a20", moustache: "#3a2a20", build: "stout", skin: SKINS[3] });
const TOURIST = O({ jacket: "#e2453c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#2a2a2a", skin: SKINS[3] });
const STUDENT = (v: number) => O({ jacket: ["#5d7a3a", "#3f6fb5", "#8c3b4a", "#b5653f", "#2f5f6a", "#7b5ac9"][v % 6], pants: "#3b3f52", boots: "#4a3426",
  hat: v % 3 === 0 ? "cap" : "hair", cap: ["#3a3f52", "#5a2f2f", "#2f4f3a"][v % 3], hair: ["#5a3b2a", "#2a201a", "#c98a3a", "#3a2a20"][v % 4], skin: SKINS[v % 4] });
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));

export type Actor = {
  o: Outfit; okey: string; P: V3; opts: FrontOpts; seed: number; hop?: number; scale?: number;
  side?: SideOpts; mirror?: boolean; lean?: number; noShadow?: boolean;
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
/** a standing actor with eased poses and expressions (blink on every expression swap) */
const stand = (o: Outfit, okey: string, P: V3, seed: number, f: number, ex: [number, Expr][], hands: [number, Hands][] = [[0, {}]],
  extra: Partial<FrontOpts> = {}, act: Partial<Actor> = {}): Actor => {
  const h = poseAt(f, hands);
  return { o, okey, P, seed, ...act, opts: { mode: "stand", expr: exprAt(f, ex), blink: lidAt(f, seed, swaps(ex)), tilt: bob(f + seed * 7), hands: h, ...extra } };
};
/** a walker on a path; front view when walking toward / away from the lens, side view when crossing */
const walker = (o: Outfit, okey: string, seed: number, f: number, path: [number, number, number][], v0: { side?: boolean; mirror?: boolean },
  expr: Expr, extra: Partial<FrontOpts> = {}, act: Partial<Actor> = {}): Actor => {
  const w = walkAt(f, path);
  const P: V3 = [w.x, 0, w.z];
  if (v0.side) return { o, okey, P, seed, opts: {}, side: { mode: "march", phase: w.moving ? w.phase : 0, expr, blink: lidAt(f, seed), stomp: 0.45, stride: w.moving ? 0.8 : 0.01 }, mirror: v0.mirror, ...act };
  return { o, okey, P, seed, opts: { mode: w.moving ? "stroll" : "stand", phase: w.phase, expr, blink: lidAt(f, seed), tilt: w.moving ? 0 : bob(f), ...extra }, ...act };
};

// ---------------- effects helpers (output px) ----------------
const burstAt = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, n = 9, col = "#fff3b0") => {
  if (age < 0 || age >= n) return;
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 500, size / 500); fxBurst(new Pen(g), age / n, col); g.restore();
};
const puffAt = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, n = 14) => {
  if (age < 0 || age >= n) return;
  g.save(); g.translate(x - size / 2, y - size * 0.6); g.scale(size / 300, size / 300); fxPuff(new Pen(g), age / n); g.restore();
};
/** screen point at a body-relative offset (metres right on screen, metres up) from an actor's feet */
const at = (v: View, P: V3, dx: number, up: number, sc = 1): [number, number] => {
  const p = v.w(P), m = v.ppm(P) * sc; return [p[0] + dx * m, p[1] - up * m];
};
/** low drifting ground mist (night shots) */
const mist = (g: CanvasRenderingContext2D, v: View, f: number, pts: V3[], k = 1) => {
  g.save(); g.globalCompositeOperation = "screen";
  pts.forEach((P, i) => {
    const q: V3 = [P[0] + Math.sin(f * 0.012 + i) * 0.6, P[1], P[2]], c = v.w(q), r = v.ppm(q) * (2.2 + (i % 3) * 0.6);
    const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
    gr.addColorStop(0, `rgba(150,170,235,${0.16 * k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.save(); g.translate(c[0], c[1]); g.scale(1, 0.32); g.translate(-c[0], -c[1]);
    g.fillStyle = gr; g.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); g.restore();
  });
  g.restore();
};
const MIST: V3[] = [[0.5, 0.1, 1.5], [3.5, 0.1, 0.0], [1.5, 0.1, -2.5], [4.5, 0.1, 2.8], [-1.5, 0.1, -0.5]];
/** a cartoon heart (likes) */
const heart = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number) => {
  if (age < 0 || age > 26) return;
  const k = easeOutBack(Math.min(1, age / 6), 2), yy = y - age * s * 0.06;
  g.save(); g.translate(x, yy); g.scale(k * s / 40, k * s / 40); g.globalAlpha = age > 18 ? 1 - (age - 18) / 8 : 1;
  g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-30, -8, -14, -30, 0, -14); g.bezierCurveTo(14, -30, 30, -8, 0, 12);
  g.fillStyle = "#ff4d6d"; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.restore();
};

// ---------------- held props ----------------
const holdLantern = (p: Pen, _l: P2, r: P2) => lantern2(p, r[0], r[1], 1.1);
const holdShovel = (a: number) => (p: Pen, l: P2, r: P2) => shovel2(p, (l[0] + r[0]) / 2, (l[1] + r[1]) / 2, a, 1.15);
const HOOD_NECK = (HH: number) => [300, 975 - (1 + 1.1 + 1.4) * HH + HH] as P2;

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const HX = HERO.x, CAGE_FRONT: V3 = [HX - 0.6, 0.78, HERO.z1 + 0.14];
const NIGHT_LANTERN: V3 = [1.25, 0.17, 2.32];
const nightKerbLantern = (g: CanvasRenderingContext2D, v: View, f: number) => {
  const c = v.w(NIGHT_LANTERN), s = v.ppm(NIGHT_LANTERN);
  lanternGlow(g, c[0], c[1] - s * 0.2, s * 1.6, f);
  const p = new Pen(g); g.save(); g.translate(c[0], c[1] - s * 0.4); g.scale(s / 260, s / 260); lantern2(p, 0, -20, 1.3); g.restore();
};

// 1 — "In the 1800s, people in Scotland locked their dead relatives in iron cages."
add({
  a: 0, b: 138, plate: "grave_n_cage",
  keys: [
    { f: 0, at: CAGE_FRONT, z: 1.55, creep: 0.0018 },
    { f: 38, dur: 34, at: [HX, 0.95, 0.9], z: 1.08, creep: 0.0016 },
    { f: W(3.56), dur: 12, at: [HX, 0.95, 0.9], z: 1.26, roll: 0.035, creep: 0.0018, punch: 0.006 },
  ],
  kicks: [[W(3.84), 1.0]],
  over: (g, v, f) => { mist(g, v, f, MIST); nightKerbLantern(g, v, f); },
});
// 2 — "And no, it wasn't to stop vampires getting out."  (a vampire pops up behind the headstone, deflates)
{
  const UP = W(6.22), DOWN = W(7.0);
  add({
    a: 138, b: 222, plate: "grave_n_cage",
    keys: [
      { f: 138, at: [HX, 1.1, 0.4], z: 1.22, creep: 0.0018 },
      { f: UP - 4, dur: 12, at: [HX, 1.35, -0.2], z: 1.45, roll: -0.04, creep: 0.0015, punch: 0.005 },
    ],
    kicks: [[UP + 2, 0.5]],
    cast: (f) => {
      const y = -1.6 + 1.6 * easeOutBack((f - UP) / 8, 1.6) - 1.6 * smooth((f - DOWN) / 8);
      const ex: [number, Expr][] = [[0, "grin"], [W(6.68), "nervous"]];
      return [stand(VAMP, "vamp", [HX, y, HERO.z0 - 0.75], 70, f, ex, [[0, { l: [0.05, -0.15], r: [-0.05, -0.15] }]],
        { held: (p, l, r, HH) => { vampCollar(p, 300, HOOD_NECK(HH)[1], HH); p.dot(l[0], l[1], 10); p.dot(r[0], r[1], 10); } }, { noShadow: true })];
    },
    over: (g, v, f) => { mist(g, v, f, MIST); nightKerbLantern(g, v, f); },
  });
}
export const FLASH_AT = 222;
// 3 — "It's Edinburgh, 1820s."
add({
  a: 222, b: W(9.28), plate: "close_d",
  keys: [{ f: 222, at: [-60, 3.0, -3], z: 1.04, creep: 0.0026 }],
  cast: (f) => [
    walker(FOLK[0], "f0", 21, f, [[222, -61.4, -6], [300, -61.0, -1.5]], {}, "smile"),
    walker(FOLK[1], "f1", 22, f, [[222, -58.8, -10], [300, -59.0, -6.5]], {}, "smile_closed"),
    walker(FOLK[2], "f2", 23, f, [[222, -62.3, 3.0], [300, -57.6, 3.0]], { side: true }, "smile"),
    walker(FOLK[4], "f4", 24, f, [[222, -58.0, 0.5], [300, -58.6, 4.0]], {}, "grin"),
  ],
});
// 4 — "A man is buried on Monday."
add({
  a: W(9.28), b: 322, plate: "grave_d", whip: true,
  keys: [{ f: W(9.28), at: [2.6, 1.0, 1.6], z: 1.05, creep: 0.0022 }],
  cast: (f) => [
    stand(MINISTER, "min", [2.6, 0, -1.0], 31, f, [[0, "stern"]], [[0, { l: [0.35, 0.3], r: [-0.1, 0.35] }]], {
      held: (p, l) => p.poly([[l[0] - 36, l[1] - 50], [l[0] + 44, l[1] - 56], [l[0] + 46, l[1] + 30], [l[0] - 32, l[1] + 36]], "#1a1a22", 6) }),
    stand(SON, "son", [2.2, 0, 2.9], 32, f, [[0, "nervous"]], [[0, { l: [0.12, 0.6], r: [-0.12, 0.6] }]]),
    stand(WIDOW, "wid", [3.15, 0, 2.4], 33, f, [[0, "pained"]], [[0, { r: [-0.15, 0.1] }]], { headTilt: 6 }),
  ],
  over: (g, _v, f) => calendar(g, 190, 250, 170, "MON", null, 1, pop(f, W(10.12), 6)),
});
// 5 — "By Wednesday, his grave is empty. But his clothes, still in the coffin. Nobody took his watch, nobody took his
//      shoes, somebody took HIM."
{
  const EMPTY = W(11.96), CLOTHES = W(12.64), WATCH = W(14.56), SHOES = W(15.6), HIM = W(16.88);
  const C: V3[] = [[1.74, -1.44, 0.0], [2.26, -1.44, 0.0], [2.26, -1.44, 1.98], [1.74, -1.44, 1.98]];
  add({
    a: 322, b: W(17.38), plate: "pit_d", xfade: 10,
    keys: [
      { f: 322, at: [HX, -1.2, 0.9], z: 1.0, creep: 0.0018 },
      { f: CLOTHES - 6, dur: 20, at: [HX, -1.44, 1.0], z: 1.15, creep: 0.0018 },
      { f: HIM - 3, dur: 10, at: [HX, -1.44, 0.6], z: 1.38, roll: 0.04, creep: 0.0015, punch: 0.006 },
    ],
    kicks: [[HIM, 1.0]],
    cast: (f) => [stand(WIDOW, "wid", [3.05, 0, 0.1], 33, f, [[0, "nervous"], [EMPTY, "shock"], [CLOTHES + 8, "nervous"], [HIM, "shock"]],
      [[0, { r: [-0.15, 0.1] }], [EMPTY, { l: [0.25, -0.35], r: [-0.25, -0.35] }], [CLOTHES + 8, { r: [-0.1, 0.1] }], [HIM, { l: [0.3, -0.45], r: [-0.3, -0.45] }]])],
    over: (g, v, f) => {
      const Q = C.map((q) => v.w(q));
      coffinItems(g, Q as P2[], { suit: 1, watch: 1, shoes: 1, ghost: clamp01((f - HIM) / 5) });
      const ring = (P: V3, f0: number) => {
        const age = f - f0; if (age < 0 || age > 28) return;
        const c = v.w(P), r = v.ppm(P) * (0.12 + 0.04 * easeOut(age / 8));
        g.save(); g.globalAlpha = age > 20 ? 1 - (age - 20) / 8 : 1; g.lineWidth = 7; g.strokeStyle = "#ffe066";
        g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.stroke(); g.restore();
        sparkle(g, c[0] + r, c[1] - r, r * 0.4, age / 14);
      };
      ring([2.08, -1.44, 0.95], WATCH); ring([2.0, -1.44, 1.85], SHOES);
      const h = v.w([HX, -1.44, 0.35]), s = v.ppm([HX, -1.4, 0.4]);
      qmark(g, h[0], h[1] - s * 0.25, s * 0.35, f - HIM - 3, -0.15);
      burstAt(g, h[0], h[1], s * 0.8, f - HIM, 9);
      // the calendar flips Monday -> Wednesday as the shot opens
      const u = clamp01((f - 326) / 8), k = 1 - clamp01((f - 372) / 8);
      calendar(g, 190, 250, 170, u < 1 ? "MON" : "WED", u < 1 ? null : null, 1, k);
      if (u > 0 && u < 1) calendar(g, 190, 250, 170, "WED", "MON", u, k);
    },
  });
}
// 6 — "You see, doctors needed bodies to learn surgery. And the law only gave them executed criminals, nowhere near enough."
{
  const CRIM = W(21.12), NOWHERE = W(22.36);
  const seats: V3[] = [];
  for (let t = 0; t < 3; t++) for (let i = 0; i < 4 + t; i++) {
    const r = 2.9 + t * 0.85 + 0.45, a = Math.PI * (1.12 + (0.76 * (i + 0.5)) / (4 + t));
    seats.push([TABLE[0] + r * Math.cos(a), 0.45 * (t + 1), TABLE[2] + r * Math.sin(a)]);
  }
  const studs = (f: number, cheer: number) => seats.map((P, i) => {
    const lean = f >= NOWHERE ? Math.sin(Math.min(1, (f - NOWHERE) / 8) * Math.PI * 0.5) * 6 : 0;
    return stand(STUDENT(i), "s" + i, P, 100 + i, f, [[0, i % 3 ? "neutral" : "smile"], [CRIM, i % 2 ? "grin" : "smile"], [NOWHERE, i % 2 ? "shock" : "nervous"], [cheer, "laugh"]],
      [[0, {}], [NOWHERE, { l: [0.3, -0.5], r: [-0.3, -0.5] }], [cheer, { l: [0.15, -1.0], r: [-0.15, -1.0] }]], { tilt: lean * (i % 2 ? 1 : -1) },
      { hop: f >= cheer ? Math.max(0, Math.sin(f * 0.55 + i)) * 0.1 : f >= NOWHERE ? Math.max(0, Math.sin((f - NOWHERE) * 0.6 + i)) * 0.05 : 0 });
  });
  add({
    a: W(17.38), b: 700, plate: "anat", whip: true,
    keys: [
      { f: W(17.38), at: [60, 1.6, -1.5], z: 1.06, creep: 0.0018 },
      { f: CRIM - 6, dur: 16, at: [60.3, 1.25, -0.6], z: 1.22, creep: 0.0018 },
      { f: NOWHERE - 3, dur: 12, at: [60, 1.55, -1.6], z: 1.12, roll: -0.035, creep: 0.002, punch: 0.004 },
    ],
    kicks: [[NOWHERE, 0.5]],
    cast: (f) => [
      ...studs(f, 99999),
      stand(DOCTOR, "doc", [61.15, 0, 0.15], 41, f, [[0, "smile"], [CRIM, "grin"], [NOWHERE, "nervous"]],
        [[0, { r: [0.55, -0.45] }], [CRIM, { r: [-0.45, 0.05] }], [NOWHERE, { l: [-0.55, 0.0], r: [0.55, 0.0] }]], { look: -1 }),
    ],
    over: (g, v, f) => {
      const u = easeOut((f - CRIM) / 10);
      if (u > 0) {
        const c = v.w([60 + 1.4 * (1 - u), 0.98, TABLE[2]]), L = v.ppm([60, 1, TABLE[2]]) * 1.75;
        bundle(g, c[0], c[1], L, 0.02);
        const b = v.w([60, 1.45, TABLE[2]]), s = v.ppm([60, 1.4, TABLE[2]]);
        if (f >= CRIM + 6) { // "1 body" badge
          const k = pop(f, CRIM + 6, 6);
          g.save(); g.translate(b[0], b[1]); g.scale(k, k);
          g.beginPath(); g.arc(0, 0, s * 0.16, 0, 7); g.fillStyle = "#fff6dc"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
          g.font = `900 ${s * 0.2}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = INK; g.fillText("1", 0, s * 0.01);
          g.restore();
        }
      }
      if (f >= NOWHERE) seats.forEach((P, i) => { if (i % 2) { const c = v.w([P[0], P[1] + 1.95, P[2]]); emark(g, c[0], c[1], v.ppm(P) * 0.3, f - NOWHERE - i, 0.1 * (i % 3 - 1)); } });
    },
  });
  // 18 uses the same theatre (the law): defined later with the same seats
  (globalThis as unknown as { __studs: typeof studs }).__studs = studs;
}
// 7 — "So at night, the resurrection men crept in."
add({
  a: 700, b: W(25.8), plate: "kirk_wide_n", xfade: 10,
  keys: [{ f: 696, at: [6.6, 1.3, 6.5], z: 1.22, creep: 0.0024 }],
  cast: (f) => [
    walker(SN2, "sn2", 52, f, [[700, 8.9, 9.6], [772, 5.6, 4.6]], {}, "smile", { lift: 120, hands: { r: [0.25, 0.5] }, held: holdLantern }),
    walker(SN1, "sn1", 51, f, [[700, 9.9, 10.4], [772, 6.6, 5.4]], {}, "grin", { lift: 120, hands: { l: [0.2, 0.25], r: [-0.2, 0.25] }, held: holdShovel(-0.4) }),
  ],
  over: (g, v, f) => {
    const w = walkAt(f, [[700, 8.9, 9.6], [772, 5.6, 4.6]]), P: V3 = [w.x, 0, w.z], c = at(v, P, 0.42, 0.6);
    lanternGlow(g, c[0], c[1], v.ppm(P) * 2.2, f);
  },
});
// 8 — "They dug at the head end, hooked the body with a rope, and dragged it out."
{
  const HOOK = W(26.94), DRAG = W(28.18);
  const P1: V3 = [0.95, 0, 0.15], P2_: V3 = [3.05, 0, 1.1];
  add({
    a: W(25.8), b: W(28.9), plate: "grave_n_head",
    keys: [
      { f: W(25.8), at: [HX, 0.7, 0.4], z: 1.12, creep: 0.0024 },
      { f: DRAG - 4, dur: 14, at: [HX + 0.4, 0.6, 0.7], z: 1.25, creep: 0.002, punch: 0.004 },
    ],
    kicks: [[DRAG + 6, 0.5]],
    cast: (f) => {
      const dig = f < HOOK ? Math.sin(f * 0.45) : 0;
      return [
        stand(SN1, "sn1", P1, 51, f, [[0, "stern"], [HOOK, "grin"]], [[0, { l: [0.3, 0.2 + 0.15 * dig], r: [-0.1, 0.25 + 0.15 * dig] }], [HOOK, { l: [0.3, 0.35], r: [-0.1, 0.4] }]],
          { held: holdShovel(0.5 + 0.25 * dig), tilt: 6 + 4 * dig }),
        stand(SN2, "sn2", P2_, 52, f, [[0, "smile"], [DRAG, "grin"]], [[0, { l: [-0.4, 0.1], r: [0.25, 0.5] }], [DRAG, { l: [0.35, -0.1], r: [0.25, 0.5] }]],
          { held: (p, l, r) => { lantern2(p, r[0], r[1], 1.1); p.dot(l[0], l[1], 10); }, tilt: f >= DRAG ? 8 : 0 }),
      ];
    },
    over: (g, v, f) => {
      mist(g, v, f, MIST, 0.8);
      const lc = at(v, P2_, 0.42, 0.62); lanternGlow(g, lc[0], lc[1], v.ppm(P2_) * 2.0, f);
      // dirt clods flying from the hole to the heap while digging
      if (f < HOOK) for (let i = 0; i < 3; i++) {
        const u = ((f * 0.06 + i / 3) % 1), a = v.w([HX - 0.1, 0.1, 0.3]), b = v.w([HX + 1.1, 0.3, 0.3]), s = v.ppm([HX, 0, 0.3]);
        const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - s * 0.45 * 4 * u * (1 - u);
        g.beginPath(); g.ellipse(x, y, s * 0.05, s * 0.04, u * 3, 0, 7); g.fillStyle = "#5a3e2a"; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      }
      // the rope from the snatcher's hand into the hole; the shrouded body slides out
      const hand = at(v, P2_, -0.42, 1.0), hole = v.w([HX, -0.6, 0.3]);
      if (f >= HOOK - 6) {
        const u = easeOut((f - DRAG) / 14);
        const out = v.w([HX + 0.9 * u, -0.7 + 0.8 * u, 0.3 + 0.7 * u]);
        g.save(); g.strokeStyle = "#c9a86a"; g.lineWidth = 5; g.beginPath(); g.moveTo(hand[0], hand[1]);
        g.quadraticCurveTo((hand[0] + out[0]) / 2, Math.max(hand[1], out[1]) + 20 * (1 - u), f >= DRAG ? out[0] : hole[0], f >= DRAG ? out[1] : hole[1]); g.stroke(); g.restore();
        if (f >= DRAG) bundle(g, out[0], out[1], v.ppm([HX, 0, 0.6]) * 1.6, -0.35 + 0.35 * u);
      }
    },
  });
}
// 9 — "And they always left the clothes behind. Because stealing clothes was theft, but a body didn't legally belong to anyone."
{
  const TOSS = W(30.24), LAW = W(31.14), THEFT = W(32.18), BODY = W(33.22);
  const P1: V3 = [0.95, 0, 0.15], P2_: V3 = [3.05, 0, 1.1];
  add({
    a: W(28.9), b: W(34.98), plate: "grave_n_head",
    keys: [
      { f: W(28.9), at: [HX - 0.4, 1.0, 0.3], z: 1.2, creep: 0.002 },
      { f: LAW - 6, dur: 18, at: [HX, 1.2, 0.5], z: 1.05, creep: 0.0018 },
    ],
    kicks: [[THEFT, 0.8], [BODY, 0.5]],
    cast: (f) => [
      stand(SN1, "sn1", P1, 51, f, [[0, "smile"], [TOSS + 6, "grin"], [BODY, "laugh"]],
        [[0, { l: [0.25, -0.5], r: [-0.25, -0.5] }], [TOSS, { l: [0.55, 0.1], r: [0.15, 0.1] }], [BODY, { l: [-0.45, -0.1], r: [0.45, -0.1] }]],
        { held: (p, l, r) => { if (f < TOSS) { p.poly([[l[0] - 10, l[1] - 30], [r[0] + 10, r[1] - 30], [r[0] + 30, r[1] + 70], [l[0] - 30, l[1] + 70]], "#2c3140", 6); } p.dot(l[0], l[1], 10); p.dot(r[0], r[1], 10); } }),
      stand(SN2, "sn2", P2_, 52, f, [[0, "smile"], [BODY, "grin"]], [[0, { r: [0.25, 0.5] }], [BODY, { l: [-0.5, -0.05], r: [0.5, -0.05] }]],
        { held: (p, _l, r) => { if (f < BODY) lantern2(p, r[0], r[1], 1.1); else p.dot(r[0], r[1], 10); } }),
    ],
    over: (g, v, f) => {
      mist(g, v, f, MIST, 0.8);
      if (f < BODY) { const lc = at(v, P2_, 0.42, 0.62); lanternGlow(g, lc[0], lc[1], v.ppm(P2_) * 2.0, f); }
      // the suit and shoes arc back into the hole
      const u = clamp01((f - TOSS) / 10);
      if (u > 0 && u < 1) {
        const a = at(v, P1, 0.2, 1.3), b = v.w([HX, -0.5, 0.3]), s = v.ppm(P1);
        const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - s * 0.5 * 4 * u * (1 - u);
        g.save(); g.translate(x, y); g.rotate(u * 4);
        g.fillStyle = "#2c3140"; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.roundRect(-s * 0.18, -s * 0.12, s * 0.36, s * 0.24, 6); g.fill(); g.stroke();
        g.restore();
      }
      // the law, explained on a scroll card
      const k = pop(f, LAW, 7);
      if (k > 0) {
        g.save(); g.translate(540, 560); g.scale(k, k);
        scroll(g, 0, 0, 520, "THE LAW", ["Stealing clothes:", "", "Stealing a body:"], 1);
        g.restore();
        stampMark(g, 560, 560 - 30, 250, "THEFT", f - THEFT, -0.12);
        if (f >= BODY) qmark(g, 545, 560 + 150, 110, f - BODY, 0.1);
      }
    },
  });
}
// 10 — "So families fought back. They sat by the grave all night with lanterns."
{
  const NIGHT = W(37.16);
  add({
    a: W(34.98), b: W(38.5), plate: "grave_n", whip: true,
    keys: [
      { f: W(34.98), at: [2.6, 0.8, 1.2], z: 1.06, creep: 0.0022 },
      { f: NIGHT - 6, dur: 24, at: [3.1, 0.75, 1.6], z: 1.2, creep: 0.0016 },
    ],
    cast: (f) => {
      const nod = f >= NIGHT ? smooth((f - NIGHT) / 14) : 0;
      return [
        stand(WIDOW, "wid", [2.95, 0, 2.6], 33, f, [[0, "stern"], [NIGHT, "neutral"]], [[0, { l: [0.12, 0.62], r: [0.3, 0.45] }]], { mode: "sit", held: (p, _l, r) => lantern2(p, r[0], r[1], 1.0) }),
        stand(SON, "son", [3.3, 0, 1.2], 32, f, [[0, "stern"], [NIGHT, "relief"]], [[0, { l: [0.12, 0.62], r: [-0.12, 0.62] }]], { mode: "sit", headTilt: 14 * nod, tilt: -4 * nod }),
        stand(GRANDPA, "gpa", [1.3, 0, -0.6], 34, f, [[0, "stern"], [NIGHT + 10, "neutral"]], [[0, { l: [0.25, 0.4], r: [-0.25, 0.4] }]], { mode: "sit" }),
      ];
    },
    over: (g, v, f) => {
      mist(g, v, f, MIST, 0.9);
      for (const [P, dx, up] of [[[2.95, 0, 2.6] as V3, 0.36, 0.32]] as [V3, number, number][]) { const c = at(v, P, dx, up); lanternGlow(g, c[0], c[1], v.ppm(P) * 2.2, f); }
      nightKerbLantern(g, v, f);
      // sleepy "z"s over the son
      if (f >= NIGHT) for (let i = 0; i < 3; i++) {
        const age = (f - NIGHT - i * 9) % 30; if (age < 0) continue;
        const c = at(v, [3.3, 0, 1.2], 0.25 + age * 0.008, 1.55 + age * 0.012), s = v.ppm([3.3, 0, 1.2]) * 0.2;
        g.save(); g.globalAlpha = 1 - age / 30; g.font = `900 ${s}px 'Montserrat'`; g.lineWidth = s * 0.16; g.strokeStyle = INK; g.strokeText("z", c[0], c[1]); g.fillStyle = "#fff"; g.fillText("z", c[0], c[1]); g.restore();
      }
    },
  });
}
// 11 — "They built watchtowers."
add({
  a: W(38.5), b: W(39.72), plate: "tower_n",
  keys: [{ f: W(38.5), at: [TOWER[0] - 0.2, 1.4, TOWER[2] + 2.5], z: 1.3, creep: 0.0035 }],
  cast: (f) => [stand(GUARD, "grd", [TOWER[0] - 0.2, 0, TOWER[2] + 2.5], 61, f, [[0, "stern"]], [[0, { r: [0.25, 0.5] }]], { held: holdLantern })],
  over: (g, v, f) => { const P: V3 = [TOWER[0] - 0.2, 0, TOWER[2] + 2.5], c = at(v, P, 0.42, 0.6); lanternGlow(g, c[0], c[1], v.ppm(P) * 2.2, f); },
});
// 12 — "And then, someone invented the..."  (a snatcher creeps up on the sleeping family)
add({
  a: W(39.72), b: W(41.38), plate: "grave_n",
  keys: [{ f: W(39.72), at: [2.8, 0.9, 0.4], z: 1.05, creep: 0.003 }],
  cast: (f) => [
    stand(SON, "son", [3.3, 0, 1.2], 32, f, [[0, "relief"]], [[0, { l: [0.12, 0.62], r: [-0.12, 0.62] }]], { mode: "sit", headTilt: 14, tilt: -4 }),
    walker(SN1, "sn1", 51, f, [[W(39.72), 3.4, -3.2], [W(41.38), 2.9, -1.0]], {}, "grin", { lift: 120 }),
  ],
  over: (g, v, f) => { mist(g, v, f, MIST, 0.9); nightKerbLantern(g, v, f); },
});
// 13 — "...mortsafe. A giant iron cage, padlocked right over the coffin."  (CLANG)
{
  const SAFE = W(41.38), LOCK = W(43.76);
  add({
    a: W(41.38), b: W(45.06), plate: "grave_n_cage",
    keys: [
      { f: SAFE, at: [HX, 1.0, 0.9], z: 1.06, creep: 0.0022 },
      { f: LOCK - 6, dur: 14, at: CAGE_FRONT, z: 1.45, creep: 0.0018, punch: 0.005 },
    ],
    kicks: [[SAFE, 1.5], [LOCK + 4, 0.5]],
    cast: (f) => [
      stand(SON, "son", [3.3, 0, 1.2], 32, f, [[0, "shock"], [SAFE + 20, "grin"]], [[0, { l: [0.25, -0.4], r: [-0.25, -0.4] }], [SAFE + 20, { l: [0.15, -1.0], r: [-0.15, -1.0] }]], { mode: "stand" }),
      walker(SN1, "sn1", 51, f, [[SAFE, 2.9, -1.0], [SAFE + 6, 2.9, -1.0], [SAFE + 40, 5.8, -4.5]], { side: true }, "shock", {}, { hop: f < SAFE + 8 ? 0.18 * Math.sin(clamp01((f - SAFE) / 8) * Math.PI) : 0 }),
    ],
    over: (g, v, f) => {
      mist(g, v, f, MIST, 0.9); nightKerbLantern(g, v, f);
      for (const P of [[HX - 0.65, 0.05, HERO.z0 - 0.2], [HX + 0.65, 0.05, HERO.z0 - 0.2], [HX - 0.65, 0.05, HERO.z1 + 0.2], [HX + 0.65, 0.05, HERO.z1 + 0.2]] as V3[]) {
        const c = v.w(P); puffAt(g, c[0], c[1], v.ppm(P) * 0.9, f - SAFE, 16);
      }
      const t = v.w([HX, 1.4, 1.0]); speedLines(g, t[0], t[1], v.ppm([HX, 1, 1]) * 0.8, v.ppm([HX, 1, 1]) * 2.2, (f - SAFE) / 10);
      const pl = v.w(CAGE_FRONT), s = v.ppm(CAGE_FRONT);
      padlock(g, pl[0], pl[1], s * 0.16, f < LOCK ? 0 : easeOutBack((f - LOCK) / 4, 2));
      if (f >= LOCK) for (let i = 0; i < 3; i++) sparkle(g, pl[0] + (i - 1) * s * 0.12, pl[1] - s * 0.14, s * 0.05, (f - LOCK - i * 2) / 12);
    },
  });
}
// 14 — "Wait, how long do you keep your grandma in a cage? About six weeks. Just long enough to be useless to a surgeon."
{
  const WAIT = W(45.06), SIX = W(47.32), SURG = W(49.16);
  add({
    a: WAIT, b: W(50.0), plate: "grave_n_cage",
    keys: [
      { f: WAIT, at: [HX - 0.6, 1.1, 1.6], z: 1.3, roll: 0.07, creep: 0.002, punch: 0.006 },
      { f: SIX - 6, dur: 16, at: [HX, 1.0, 1.0], z: 1.12, roll: 0, creep: 0.0018 },
    ],
    kicks: [[WAIT, 0.7]],
    cast: (f) => [
      stand(SON, "son", [3.3, 0, 1.2], 32, f, [[0, "nervous"], [SIX, "smile"], [SURG + 8, "grin"]], [[0, { r: [0.05, -1.0] }], [SIX, { l: [0.35, 0.3] }]], { look: 1 }),
      walker(DOCTOR, "doc", 41, f, [[SURG - 14, 4.2, -1.6], [SURG, 2.6, -0.5], [SURG + 10, 2.6, -0.5], [W(50.0), 4.4, -2.2]], {}, f < SURG + 2 ? "smile" : "pained",
        f >= SURG + 2 && f < SURG + 12 ? { hands: { r: [-0.2, -0.75] } } : {}),
    ],
    over: (g, v, f) => {
      mist(g, v, f, MIST, 0.9); nightKerbLantern(g, v, f);
      const h = at(v, [3.3, 0, 1.2], 0, 2.0), s = v.ppm([3.3, 0, 1.2]);
      qmark(g, h[0] - s * 0.25, h[1], s * 0.34, f - WAIT - 2, -0.2); qmark(g, h[0] + s * 0.25, h[1] - s * 0.12, s * 0.26, f - WAIT - 6, 0.25);
      // calendar: week 1 -> week 6
      const n = Math.max(0, Math.min(5, Math.floor((f - SIX) / 4))), u = clamp01(((f - SIX) % 4) / 4);
      const k = pop(f, SIX - 6, 6) * (1 - clamp01((f - SURG - 6) / 8));
      if (k > 0) {
        const lab = (i: number) => `WEEK ${i + 1}`;
        if (f < SIX) calendar(g, 230, 300, 210, lab(0), null, 1, k);
        else if (n < 5 && u > 0) calendar(g, 230, 300, 210, lab(n + 1), lab(n), u, k);
        else calendar(g, 230, 300, 210, lab(n), null, 1, k);
      }
    },
  });
}
// 15 — "[laughs] Then the church dug the cage back up and rented it to the next family."
{
  const RENT = W(52.74);
  add({
    a: W(50.0), b: W(54.08), plate: "grave_d_cage", whip: true,
    keys: [
      { f: W(50.0), at: [3.3, 1.05, 1.9], z: 1.04, creep: 0.0022 },
      { f: RENT - 6, dur: 14, at: [3.4, 1.05, 2.2], z: 1.14, creep: 0.002, punch: 0.004 },
    ],
    cast: (f) => [
      stand(MINISTER, "min", [3.2, 0, 0.9], 31, f, [[0, "smile"], [RENT, "grin"]], [[0, { r: [0.25, 0.35] }], [RENT, { l: [-0.45, 0.1], r: [0.25, 0.35] }]], { held: (p, l, r) => { toLet(p, r[0], r[1] + 60); p.dot(l[0], l[1], 10); } }),
      stand(FOLK[0], "f0", [3.6, 0, 2.6], 81, f, [[0, "smile"]], [[0, { l: [0.45, 0.0] }]]),
      stand(FOLK[1], "f1", [4.1, 0, 3.2], 82, f, [[0, "smile_closed"]]),
      stand(KID, "kid", [3.3, 0, 3.5], 83, f, [[0, "grin"]], [[0, {}]], {}, { scale: 0.72 }),
    ],
    over: (g, v, f) => {
      const a = at(v, [3.6, 0, 2.6], -0.45, 1.0), b = at(v, [3.2, 0, 0.9], 0.35, 1.0), s = v.ppm([3.4, 0, 1.8]);
      coinArc(g, a, b, (f - RENT) / 14, 4, s * 0.06, s * 0.35);
      if (f >= RENT + 10) for (let i = 0; i < 3; i++) sparkle(g, b[0] + (i - 1) * s * 0.12, b[1] - s * 0.2, s * 0.05, (f - RENT - 10 - i * 2) / 12);
    },
  });
}
// 16 — "Then two men in Edinburgh, Burke and Hare, skipped the digging completely. They murdered 16 people and sold the bodies."
{
  const SKIP = W(56.48), MURDER = W(57.76);
  add({
    a: W(54.08), b: W(60.56), plate: "close_n", whip: true,
    keys: [
      { f: W(54.08), at: [-60, 1.9, -5], z: 1.06, creep: 0.002 },
      { f: W(55.7) - 6, dur: 24, at: [-60, 1.3, 0.8], z: 1.24, creep: 0.0018 },
    ],
    kicks: [[MURDER, 1.2]],
    cast: (f) => [
      walker(BURKE, "burke", 91, f, [[W(54.08), -60.8, -9], [W(56.0), -60.6, 0.6]], {}, f < SKIP ? "smile" : "grin", f >= SKIP ? { look: 1 } : {}),
      walker(HARE, "hare", 92, f, [[W(54.08), -59.1, -8], [W(56.0), -59.4, 1.4]], {}, f < SKIP ? "stern" : "grin",
        f < SKIP ? { hands: { l: [0.2, 0.25], r: [-0.2, 0.25] }, held: holdShovel(-0.35) } : { look: -1 }),
    ],
    over: (g, v, f) => {
      const P: V3 = [-59.4, 0, 1.4];
      if (f >= SKIP && f < SKIP + 22) { // the shovel is thrown away
        const u = (f - SKIP) / 22, c = at(v, P, 0.3 + 2.4 * u, 1.0 + 1.4 * Math.sin(u * Math.PI)), s = v.ppm(P);
        g.save(); g.translate(c[0], c[1]); g.rotate(u * 9); g.scale(s / 420, s / 420); shovel2(new Pen(g), 0, -100, 0, 1); g.restore();
      }
      for (const z of [3, -9]) { const c = v.w([-57.8, 3.2, z]); lanternGlow(g, c[0], c[1], v.ppm([-57.8, 3, z]) * 2.6, f, 0.8); }
      newspaper(g, 540, 600, 620, f - MURDER, ["MURDER!", "BURKE & HARE", "16 VICTIMS"]);
    },
  });
}
// 17 — "The whole country panicked,"
add({
  a: W(60.56), b: W(61.9), plate: "close_d",
  keys: [{ f: W(60.56), at: [-60, 1.5, 1.0], z: 1.08, roll: 0.05, creep: 0.004 }],
  kicks: [[W(61.22), 0.6]],
  cast: (f) => [0, 1, 2, 3, 4].map((i) => {
    const P: V3 = [-61.5 + i * 0.75, 0, 1.6 - (i % 2) * 1.4];
    return stand(FOLK[i], "f" + i, P, 120 + i, f, [[0, "shock"]], [[0, { l: [0.25, -0.75 + 0.1 * Math.sin(f + i)], r: [-0.25, -0.75 + 0.1 * Math.cos(f + i)] }]], {}, { hop: Math.max(0, Math.sin(f * 0.7 + i * 1.7)) * 0.14 });
  }),
  over: (g, v, f) => [0, 2, 4].forEach((i) => { const P: V3 = [-61.5 + i * 0.75, 0, 1.6 - (i % 2) * 1.4], c = at(v, P, 0, 2.05); emark(g, c[0], c[1], v.ppm(P) * 0.32, f - W(60.82) - i * 2, 0.1 * (i - 2)); }),
});
// 18 — "And in 1832, a new law finally gave doctors a legal supply."
{
  const Y = W(62.18), SUPPLY = W(65.08);
  add({
    a: W(61.9), b: W(66.36), plate: "anat", whip: true,
    keys: [
      { f: W(61.9), at: [60.8, 1.35, 0.0], z: 1.2, creep: 0.0018 },
      { f: SUPPLY - 6, dur: 16, at: [60, 1.6, -1.5], z: 1.08, creep: 0.002, punch: 0.004 },
    ],
    kicks: [[Y + 1, 0.8], [SUPPLY, 0.5]],
    cast: (f) => {
      const studs = (globalThis as unknown as { __studs: (f: number, cheer: number) => Actor[] }).__studs;
      return [
        ...studs(f, SUPPLY),
        stand(DOCTOR, "doc", [61.15, 0, 0.15], 41, f, [[0, "smile"], [SUPPLY, "laugh"]], [[0, { l: [0.25, 0.35], r: [-0.25, 0.35] }], [SUPPLY, { l: [0.15, -1.0], r: [-0.15, -1.0] }]],
          { held: (p, l, r) => { if (f < SUPPLY) { const g = p.g; g.save(); g.translate((l[0] + r[0]) / 2, (l[1] + r[1]) / 2 - 40); scroll(g, 0, 0, 190, "ANATOMY", ["ACT"], 1); g.restore(); } p.dot(l[0], l[1], 10); p.dot(r[0], r[1], 10); } }),
      ];
    },
    over: (g, v, f) => {
      const c = at(v, [61.15, 0, 0.15], 0, 1.35), s = v.ppm([61.15, 0, 0.15]);
      stampMark(g, c[0], c[1] - s * 0.05, s * 0.55, "1832", f - Y, -0.14);
      if (f >= SUPPLY) { const t = v.w([60, 1.0, TABLE[2]]); for (let i = 0; i < 5; i++) sparkle(g, t[0] + (i - 2) * s * 0.35, t[1] - s * (0.6 + (i % 2) * 0.2), s * 0.08, (f - SUPPLY - i * 3) / 16); }
    },
  });
}
// 19 — "The cages weren't needed anymore. Most were melted down for iron."
{
  const MELT = W(67.98);
  const HITS = [MELT, MELT + 12, MELT + 24];
  const hammerK = (f: number) => { let k = 1; for (const h of HITS) { const n = f - h; if (n >= -9 && n < -5) k = Math.min(k, 1 - smooth((n + 9) / 4)); else if (n >= -5 && n < 0) k = 0; } return k; };
  add({
    a: W(66.36), b: W(68.96), plate: "grave_d_cage",
    keys: [{ f: W(66.36), at: [HX + 0.5, 0.9, 1.0], z: 1.12, creep: 0.0028 }],
    kicks: HITS.map((h) => [h, 0.6] as [number, number]),
    cast: (f) => [stand(SMITH, "smith", [3.25, 0, 1.0], 141, f, [[0, "stern"], [MELT, "grin"]], [[0, {}]], { prop: ["hammer", Math.round(hammerK(f) * 30) / 30], facing: -1 })],
    over: (g, v, f) => {
      const heat = clamp01((f - MELT + 10) / 30), c = v.w([HX, 0.7, 1.0]), s = v.ppm([HX, 0.7, 1.0]);
      if (heat > 0) {
        g.save(); g.globalCompositeOperation = "screen";
        const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], s * 1.4);
        gr.addColorStop(0, `rgba(255,140,40,${0.75 * heat})`); gr.addColorStop(0.5, `rgba(255,90,20,${0.35 * heat})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(c[0] - s * 1.5, c[1] - s * 1.5, s * 3, s * 3); g.restore();
      }
      for (const h of HITS) { const p = at(v, [3.25, 0, 1.0], -0.55, 1.0); sparks(g, p[0], p[1], s * 1.6, f - h); }
    },
  });
}
// 20 — "But a few are still standing in Scottish graveyards today, where the internet swears they were built to stop vampires."
{
  const TODAY = W(71.3), NET = W(72.16), VAMP_UP = W(74.06);
  const TP: V3 = [0.7, 0, 1.2];
  add({
    a: W(68.96), b: TOTAL, plate: "cage_end_g", xfade: 10,
    keys: [
      { f: W(68.96) - 6, at: [HX, 1.25, 0.6], z: 1.04, creep: 0.0016 },
      { f: TODAY - 8, dur: 18, at: [1.3, 1.25, 1.6], z: 1.12, creep: 0.0016 },
      { f: VAMP_UP - 4, dur: 12, at: [2.0, 1.2, 0.6], z: 1.12, roll: 0.04, creep: 0.0012, punch: 0.004 },
    ],
    kicks: [[VAMP_UP + 2, 0.5]],
    cast: (f) => {
      const y = -1.6 + 1.6 * easeOutBack((f - VAMP_UP) / 8, 1.6);
      return [
        stand(TOURIST, "tour", TP, 151, f, [[0, "smile"], [TODAY, "grin"], [VAMP_UP, "shock"]], [[0, {}], [TODAY - 10, { r: [0.15, -0.75] }]],
          { held: (p, _l, r) => { if (f >= TODAY - 10) phone2(p, r[0], r[1]); else p.dot(r[0], r[1], 10); }, look: 1 }),
        stand(VAMP, "vamp", [3.2, y, -0.2], 70, f, [[0, "grin"]], [[0, { l: [0.05, -0.15], r: [-0.4, -0.75] }]],
          { held: (p, l, r, HH) => { vampCollar(p, 300, HOOD_NECK(HH)[1], HH); p.dot(l[0], l[1], 10); p.dot(r[0], r[1], 10); }, blink: f >= VAMP_UP + 14 && f < VAMP_UP + 22 ? 1 : 0 }, { noShadow: true }),
      ];
    },
    over: (g, v, f) => {
      const ph = at(v, TP, 0.32, 1.65), s = v.ppm(TP);
      if (f >= TODAY && f < TODAY + 4) { g.save(); g.globalCompositeOperation = "screen"; g.fillStyle = `rgba(255,255,255,${0.7 - (f - TODAY) * 0.17})`; g.fillRect(0, 0, 1080, 1920); g.restore(); }
      for (let i = 0; i < 5; i++) heart(g, ph[0] + (i - 2) * s * 0.12, ph[1] - s * 0.15, s * 0.16, f - NET - i * 4);
    },
  });
}

export const PLATE_IDS = Array.from(new Set(SHOTS.map((s) => s.plate)));
