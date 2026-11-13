// Timeline of "The Man Who Made Bricks Too Big" (67.0 s, 2010 f at 30 fps), timed to the cut voice (words.json).
// Script formula (STYLE_BIBLE): paradox hook -> setting -> escalation -> mystery "Wait..." -> "You see," -> payoff.
// Every visual reaction lands 0-3 frames before its word (LEAD). Light: day for the story, a night-blue insert for the
// "You see" explanation, golden for the end of the trick and the ending.
import { Outfit, FrontOpts, SKIN, SKINS, INK, Expr, KID, PARENT, townsfolk, Pen, fxBurst, fxPuff } from "./toon";
import { V3, PW, PH } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth, P2 } from "./view";
import {
  box3, topText, brick2, coin, coinStack, coinArc, sparkle, qmark, steam, moth, rainCloud, speedLines, dimArrow,
  stampMark, scroll, paperBits, mould3, stamp3, BRICK, GOLD,
} from "./props2d";

export const FPS = 30;
export const TOTAL = 2010;
const W = (t: number) => Math.round(t * FPS) - 2; // a reaction 2 frames before the word onset
const HEAD = 1.42, TOP = 1.68; // head centre / crown height of an adult card (m)

// ---------------- cast ----------------
export const TAX: Outfit = { jacket: "#2c3140", pants: "#2b2b35", boots: INK, hat: "tophat", buttons: "#e8c45a", moustache: "#3a2a20", build: "stout", skin: SKINS[1] };
export const WILKES: Outfit = { jacket: "#b8763c", pants: "#4a3b30", boots: "#4a3426", hat: "cap", cap: "#6b4a2e", buttons: "#efe2c4", skin: SKIN };
export const LORD: Outfit = { jacket: "#b8333c", pants: "#f1ece0", boots: INK, hat: "hair", hair: "#eeeae2", buttons: "#e8c45a", build: "stout", skin: SKINS[2] };
const MAKER = (v: number): Outfit => ({
  jacket: ["#5d7a3a", "#3f6fb5", "#8c3b4a", "#b5653f", "#2f5f6a"][v % 5], pants: "#3b3f52", boots: "#4a3426",
  hat: "cap", cap: ["#3a3f52", "#7a5a3a", "#5a2f2f", "#2f4f3a", "#6b4a2e"][v % 5], skin: SKINS[(v + 1) % 4], moustache: v % 2 ? "#3a2a20" : undefined,
});
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));

export type Actor = { o: Outfit; okey: string; P: V3; opts: FrontOpts; seed: number; hop?: number; scale?: number };
export type Shot = {
  id: number; a: number; b: number; plate: string; keys: Key2[]; kicks?: [number, number][];
  night?: boolean;
  /** crossfade length (frames) from the previous shot, centred on a */
  xfade?: number;
  /** cast at frame f */
  cast?: (f: number) => Actor[];
  /** drawn after the plate, before the cast (things behind people) */
  under?: (g: CanvasRenderingContext2D, v: View, f: number) => void;
  /** drawn over the cast (props in front, effects) */
  over?: (g: CanvasRenderingContext2D, v: View, f: number) => void;
};

// ---------------- life: blinks + expression changes ----------------
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const LID = [0.5, 1, 1, 0.5];
/** eyelid 0..1: blinks every 0.5-2.3 s for 4 frames, plus a blink across every expression swap */
export const lidAt = (f: number, i: number, swaps: number[] = []) => {
  for (const s of swaps) { const k = f - s + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) { const k = f - s; if (k >= 0 && k < 4) return LID[k]; s += Math.round(15 + 54 * hh(i * 31 + n, 13)); }
  return 0;
};
/** piecewise expression track: [[fromFrame, expr], ...] */
const track = <T,>(f: number, tr: [number, T][]) => { let v = tr[0][1]; for (const [k, e] of tr) if (f >= k) v = e; return v; };
const swapsOf = (tr: [number, unknown][]) => tr.slice(1).map(([k]) => k);
const A = (o: Outfit, okey: string, P: V3, seed: number, opts: FrontOpts, extra: Partial<Actor> = {}): Actor => ({ o, okey, P, seed, opts, ...extra });
const bob = (f: number, k = 1) => Math.sin(f * 0.21) * 0.6 * k; // idle sway in degrees

// ---------------- held props (design units) ----------------
const heldBrick = (w: number, h: number) => (p: Pen, l: P2, r: P2) => brick2(p, (l[0] + r[0]) / 2, Math.min(l[1], r[1]) - h * 0.42, w, h);
const ledger = (open = true) => (p: Pen, l: P2) => {
  const [x, y] = l;
  p.poly([[x - 40, y - 62], [x + 50, y - 70], [x + 54, y + 40], [x - 36, y + 48]], "#6b2f2f", 6);
  if (open) p.poly([[x - 30, y - 52], [x + 42, y - 58], [x + 45, y + 30], [x - 26, y + 36]], "#f4ead2", 4);
  for (let i = 0; i < 4; i++) p.stroke([[x - 20, y - 36 + i * 16], [x + 30, y - 40 + i * 16]], 3, "rgba(90,60,50,0.6)");
};
const quill = (p: Pen, _l: P2, r: P2) => { p.stroke([[r[0] - 8, r[1] + 10], [r[0] + 24, r[1] - 70]], 5, "#efe9dc"); p.dot(r[0], r[1], 9); };
const ruler = (down: number) => (p: Pen, _l: P2, r: P2) => {
  const g = p.g; g.save(); g.translate(r[0], r[1]); g.rotate(-0.15 + down * 1.5);
  g.scale(1.6, 1.6);
  p.poly([[-10, 10], [14, 10], [14, -230], [-10, -230]], "#e8c77a", 5);
  for (let i = 0; i < 9; i++) p.stroke([[-10, -14 - i * 24], [-1 + (i % 2) * -4, -14 - i * 24]], 3);
  g.restore(); p.dot(r[0], r[1], 10);
};
const scrollHeld = (title: string, tear = 0, cob = 0) => (p: Pen, l: P2, r: P2) => {
  const cx = (l[0] + r[0]) / 2, cy = (l[1] + r[1]) / 2 + 10, g = p.g;
  g.save();
  g.translate(cx, cy);
  scroll(g, 0, 0, 170, title, ["per 1,000", "bricks"], 1, tear);
  if (cob > 0) { // cobweb in the corner: decades pass
    g.globalAlpha = cob; g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(85, -105); g.lineTo(85 - Math.cos(i * 0.39) * 70, -105 + Math.sin(i * 0.39) * 70); g.stroke(); }
    for (let k = 1; k < 4; k++) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 0.39; g.lineTo(85 - Math.cos(a) * 20 * k, -105 + Math.sin(a) * 20 * k); } g.stroke(); }
  }
  g.restore();
  p.dot(l[0], l[1], 10); p.dot(r[0], r[1], 10);
};
const pocketsOut = (p: Pen, l: P2, r: P2) => {
  for (const [x, y] of [l, r]) p.poly([[x - 34, y - 4], [x + 34, y - 4], [x + 24, y + 70], [x, y + 82], [x - 24, y + 70]], "#f3efe6", 6);
  p.dot(l[0], l[1], 10); p.dot(r[0], r[1], 10);
};

// ---------------- table (drawn over the cast in the yard plates: Wilkes stands behind it) ----------------
const tableOver = (g: CanvasRenderingContext2D, v: View) => {
  for (const x of [59.0, 60.98]) for (const z of [1.94]) box3(g, v, [x - 0.03, 0, z - 0.05], [0.07, 0.82, 0.07], "#8a5a3a", 3);
  const Q = box3(g, v, [58.9, 0.82, 1.0], [2.2, 0.08, 1.0], "#c08a55", 3.4, { speck: 40, seed: 7 });
  g.save(); g.strokeStyle = "rgba(90,50,30,0.55)"; g.lineWidth = 2.5; // plank seams on the top
  for (let i = 1; i < 4; i++) { const u = i / 4, a = lerp(Q[7], Q[4], u), b = lerp(Q[6], Q[5], u); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  g.restore();
};
const lerp = (a: P2, b: P2, u: number): P2 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const burstAt = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, n = 9, col = "#fff3b0") => {
  if (age < 0 || age >= n) return;
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 500, size / 500);
  fxBurst(new Pen(g), age / n, col); g.restore();
};
const puffAt = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, n = 14) => {
  if (age < 0 || age >= n) return;
  g.save(); g.translate(x - size / 2, y - size * 0.6); g.scale(size / 300, size / 300);
  fxPuff(new Pen(g), age / n); g.restore();
};

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });

// 1 — "In 1784, England put a tax on every single brick."  (town, the tax man holds up ONE brick)
{
  const ex: [number, Expr][] = [[0, "stern"], [W(2.18), "smile"], [W(3.2), "grin"]];
  add({
    a: 0, b: 126, plate: "town_ms",
    keys: [
      { f: 0, at: [4.2, 1.12, -3.4], z: 1.04, creep: 0.0022 },
      { f: W(2.72), dur: 22, at: [4.35, 1.62, -3.4], z: 1.36, roll: 0.05, creep: 0.0022, punch: 0.006 },
    ],
    kicks: [[W(3.68), 0.9]],
    cast: (f) => [
      A(TAX, "tax", [4.2, 0, -3.4], 1, {
        mode: "stand", expr: track(f, ex), blink: lidAt(f, 1, swapsOf(ex)), tilt: bob(f), headTilt: -3,
        hands: { l: [0.38, 0.32], r: [0.12, -0.95 - 0.05 * smooth((f - 70) / 12)] },
        held: (p, l, r, HH) => { ledger()(p, l); brick2(p, r[0], r[1] - 26, 92, 34); },
      }),
    ],
    over: (g, v, f) => {
      const c = v.w([4.38, 1.95, -3.4]), s = v.ppm([4.3, 1.8, -3.4]);
      for (let i = 0; i < 4; i++) sparkle(g, c[0] + Math.cos(i * 1.7) * s * 0.28, c[1] + Math.sin(i * 2.3) * s * 0.2, s * 0.08, (f - W(3.68) - i * 3) / 14);
      burstAt(g, c[0], c[1], s * 0.9, f - W(3.68));
    },
  });
}
// 2 — "So one guy just made his bricks twice as big."  (yard, Wilkes lifts a brick that boings to double)
{
  const ex: [number, Expr][] = [[126, "smile"], [W(6.1), "grin"], [W(6.9), "laugh"]];
  add({
    a: 126, b: 226, plate: "yard_ms",
    keys: [
      { f: 126, at: [60.3, 1.15, 0.45], z: 1.05, creep: 0.0024 },
      { f: W(6.1) - 6, dur: 14, at: [60.3, 1.55, 0.45], z: 1.3, roll: -0.05, creep: 0.002, punch: 0.007 },
    ],
    kicks: [[W(6.1) + 2, 1.2]],
    cast: (f) => {
      const g2 = easeOutBack((f - W(6.1)) / 9, 2.4), w = 120 + 130 * g2, h = 44 + 56 * g2;
      return [A(WILKES, "wil", [60.3, 0, 0.45], 2, {
        mode: "stand", expr: track(f, ex), blink: lidAt(f, 2, swapsOf(ex)), tilt: bob(f),
        hands: { l: [0.2, -1.0], r: [-0.2, -1.0] }, held: heldBrick(w, h),
      })];
    },
    over: (g, v, f) => {
      tableOver(g, v);
      const c = v.w([60.3, 2.0, 0.45]), s = v.ppm([60.3, 1.8, 0.45]);
      speedLines(g, c[0], c[1], s * 0.5, s * 1.6, (f - W(6.1)) / 14);
      burstAt(g, c[0], c[1], s * 1.3, f - W(6.1) - 1, 10);
    },
  });
}
export const FLASH_AT = 226;
// 3 — "Britain had just lost America, and it was broke."  (the Treasury, wide)
add({
  a: 226, b: W(9.46), plate: "tres_wide",
  keys: [
    { f: 226, at: [0.5, 0.42], z: 1.0, creep: 0.0015 },
    { f: 240, dur: 36, at: [-59.6, 2.2, -1.2], z: 1.45, creep: 0.002 },
  ],
  cast: (f) => [A(LORD, "lord", [-59.6, 0, -1.2], 3, { mode: "stand", expr: "nervous", blink: lidAt(f, 3), tilt: bob(f) })],
});
// 4 — "...broke. So somebody in London had a genius idea. Count the bricks."
{
  const ex: [number, Expr][] = [[0, "shock"], [W(10.62), "neutral"], [W(12.1), "grin"], [W(13.26), "laugh"]];
  add({
    a: W(9.46), b: 425, plate: "tres_ms",
    keys: [
      { f: W(9.46), at: [-59.6, 1.05, -1.2], z: 1.05, creep: 0.0022 },
      { f: W(12.1) - 6, dur: 16, at: [-59.6, 1.4, -1.2], z: 1.25, creep: 0.002, punch: 0.006 },
      { f: W(13.26) - 4, dur: 12, at: [-59.45, 1.25, -1.2], z: 1.4, roll: 0.06, creep: 0.002, punch: 0.007 },
    ],
    kicks: [[W(9.84), 1.0], [W(13.26), 0.8]],
    cast: (f) => {
      const pockets = f < W(10.62), idea = f >= W(12.1) && f < W(13.26), point = f >= W(13.26);
      const opts: FrontOpts = { mode: "stand", expr: track(f, ex), blink: lidAt(f, 3, swapsOf(ex)), tilt: bob(f) };
      if (pockets) Object.assign(opts, { hands: { l: [-0.32, 0.78], r: [0.32, 0.78] }, held: pocketsOut });
      else if (idea) Object.assign(opts, { hands: { r: [0.05, -1.05] }, held: (p: Pen, _l: P2, r: P2) => { p.stroke([[r[0], r[1]], [r[0], r[1] - 46]], 16); p.dot(r[0], r[1], 13); } });
      else if (point) Object.assign(opts, { hands: { r: [0.85, -0.2] }, look: 1 });
      return [A(LORD, "lord", [-59.6, 0, -1.2], 3, opts)];
    },
    over: (g, v, f) => {
      const hip = v.w([-59.35, 0.9, -1.2]), s = v.ppm([-59.6, 1, -1.2]);
      const u = f - W(9.84);
      if (u >= 0 && u < 60) moth(g, hip[0] + u * s * 0.012 + Math.sin(u * 0.5) * s * 0.06, hip[1] - u * s * 0.02, s * 0.2, u);
      const head = v.w([-59.6, TOP + 0.1, -1.2]);
      burstAt(g, head[0] + s * 0.05, head[1] - s * 0.15, s * 0.9, f - W(12.1), 12, "#fff6a8");
      for (let i = 0; i < 3; i++) sparkle(g, head[0] + (i - 1) * s * 0.3, head[1] - s * (0.25 + 0.1 * (i % 2)), s * 0.08, (f - W(12.1) - i * 3) / 16);
    },
  });
}
// 5 — "Every thousand bricks you bake, pay up."  (the tax man at a brick hack, coins fly)
{
  add({
    a: 425, b: 490, plate: "yard_stack",
    keys: [
      { f: 425, at: [64.1, 1.05, -1.0], z: 1.06, creep: 0.0024 },
      { f: W(15.76) - 6, dur: 14, at: [64.3, 1.15, -0.9], z: 1.22, creep: 0.002, punch: 0.006 },
    ],
    kicks: [[W(15.96), 0.7]],
    cast: (f) => [
      A(MAKER(0), "m0", [63.3, 0, -1.3], 11, { mode: "stand", expr: f < W(15.76) ? "nervous" : "pained", blink: lidAt(f, 11), tilt: bob(f, 0.6),
        hands: { r: [0.55, 0.15] }, look: 1 }),
      A(TAX, "tax", [64.95, 0, -0.6], 1, { mode: "stand", expr: f < W(15.76) ? "stern" : "grin", blink: lidAt(f, 1, [W(15.76)]), tilt: bob(f), look: -1,
        hands: { l: [0.35, 0.3], r: [-0.15, 0.1] }, held: (p, l, r) => { ledger()(p, l); quill(p, l, r); } }),
    ],
    over: (g, v, f) => {
      const a = v.w([63.62, 1.08, -1.3]), b = v.w([64.8, 1.15, -0.6]), s = v.ppm([64, 1, -1]);
      coinArc(g, a, b, (f - W(15.76)) / 18, 6, s * 0.06, s * 0.45);
      for (let i = 0; i < 3; i++) sparkle(g, b[0] + (i - 1) * s * 0.15, b[1] - s * 0.2, s * 0.06, (f - W(15.96) - i * 2) / 12);
    },
  });
}
// 6 — "They even stamped the word excise on them, so nobody cheats."  (insert: the stamp on the table)
{
  const hits = [W(16.84), W(18.72)];
  const lift = (f: number, h: number) => { const n = f - h; return n < -8 ? 0.34 : n < 0 ? 0.34 * (1 - easeOut((n + 8) / 8)) : n < 3 ? 0 : 0.34 * smooth((n - 3) / 10); };
  add({
    a: 490, b: 586, plate: "yard_table",
    keys: [
      { f: 490, at: [59.86, 0.97, 1.38], z: 1.5, creep: 0.0018 },
      { f: 532, dur: 22, at: [60.08, 0.97, 1.38], z: 1.45, creep: 0.0018 },
    ],
    kicks: hits.map((h) => [h, 1.1] as [number, number]),
    over: (g, v, f) => {
      const bA: V3 = [59.7, 0.9, 1.32], bB: V3 = [60.06 + 0.5 * (1 - easeOut((f - 520) / 16)), 0.9, 1.3];
      const QA = box3(g, v, bA, [0.32, 0.1, 0.16], BRICK, 3.2, { speck: 30, seed: 3 });
      if (f >= hits[0]) topText(g, QA, "EXCISE", "#6a1e12", Math.min(1, (f - hits[0] + 1) / 2));
      if (f >= 520) {
        const QB = box3(g, v, bB, [0.32, 0.1, 0.16], BRICK, 3.2, { speck: 30, seed: 5 });
        if (f >= hits[1]) topText(g, QB, "EXCISE", "#6a1e12", Math.min(1, (f - hits[1] + 1) / 2));
      }
      const target: V3 = f < (hits[0] + hits[1]) / 2 ? [bA[0] + 0.16, 1.0, bA[2] + 0.08] : [bB[0] + 0.16, 1.0, bB[2] + 0.08];
      const L = f < (hits[0] + hits[1]) / 2 ? lift(f, hits[0]) : lift(f, hits[1]);
      stamp3(g, v, target, L);
      for (const h of hits) {
        const c = v.w([f < (hits[0] + hits[1]) / 2 ? bA[0] + 0.16 : bB[0] + 0.16, 1.0, 1.4]), s = v.ppm([60, 1, 1.4]);
        puffAt(g, c[0], c[1], s * 0.5, f - h);
        burstAt(g, c[0], c[1] - s * 0.05, s * 0.55, f - h, 8);
      }
    },
  });
}
// 7 — "Meet Joseph Wilkes. He makes bricks..."  (the yard, wide; Wilkes waves)
add({
  a: 586, b: W(20.38), plate: "yard_wide",
  keys: [{ f: 586, at: [60, 2.6, -1], z: 1.0, creep: 0.004 }],
  cast: (f) => [
    A(MAKER(1), "m1", [55.8, 0, -2.4], 12, { mode: "stand", expr: "smile", blink: lidAt(f, 12), tilt: bob(f), hands: { r: [0.25, 0.55] } }),
    A(WILKES, "wil", [60.25, 0, 0.45], 2, { mode: "stand", expr: "smile", blink: lidAt(f, 2), tilt: bob(f), wave: Math.sin(f * 0.55) }),
  ],
  over: (g, v) => tableOver(g, v),
});
add({
  a: W(20.38), b: 664, plate: "yard_group",
  keys: [{ f: W(20.38), at: [60.3, 1.2, 0.8], z: 1.1, creep: 0.0024 }],
  cast: (f) => [
    A(MAKER(3), "m3", [61.6 - (f - 609) * 0.008, 0, -1.6], 13, { mode: "stroll", phase: (f * 0.02) % 1, expr: "smile_closed", blink: lidAt(f, 13) }),
    A(WILKES, "wil", [60.25, 0, 0.45], 2, { mode: "stand", expr: f < W(20.38) ? "smile" : "grin", blink: lidAt(f, 2, [W(20.38)]), tilt: bob(f),
      wave: f < 640 ? Math.sin(f * 0.55) : undefined }),
  ],
  over: (g, v) => tableOver(g, v),
});
// 8 — "...in a little town called Measham."  (crossfade to the town)
add({
  a: 664, b: W(23.18), plate: "town_wide", xfade: 10,
  keys: [{ f: 656, at: [0.52, 0.5], z: 1.05, creep: 0.0028 }],
  cast: (f) => [
    A(FOLK[0], "f0", [-3 + f * 0.01, 0, 0.6], 21, { mode: "stroll", phase: (f * 0.02) % 1, expr: "smile", blink: lidAt(f, 21) }),
    A(FOLK[1], "f1", [6 - f * 0.008, 0, -1.6], 22, { mode: "stroll", phase: (f * 0.021 + 0.3) % 1, expr: "smile_closed", blink: lidAt(f, 22) }),
    A(KID, "kid", [3.5, 0, 1.8], 23, { mode: "stand", expr: "grin", blink: lidAt(f, 23), wave: Math.sin(f * 0.4) }, { scale: 0.72 }),
  ],
});
// 9 — "He looks at the tax man, he looks at his brick mould, and he doubles it."
{
  const ex: [number, Expr][] = [[0, "stern"], [W(24.4), "smile"], [W(25.88), "grin"]];
  add({
    a: W(23.18), b: 794, plate: "yard_ms",
    keys: [
      { f: W(23.18), at: [59.7, 1.05, 0.1], z: 1.05, creep: 0.002 },
      { f: W(24.4) - 6, dur: 18, at: [60.15, 1.05, 0.8], z: 1.22, creep: 0.002 },
      { f: W(25.88) - 5, dur: 10, at: [60.05, 0.98, 1.2], z: 1.42, roll: -0.045, creep: 0.002, punch: 0.007 },
    ],
    kicks: [[W(25.88) + 2, 1.2]],
    cast: (f) => [
      A(TAX, "tax", [58.35, 0, -1.9], 1, { mode: "stand", expr: "stern", blink: lidAt(f, 1), tilt: bob(f), look: 1, hands: { l: [0.35, 0.3] }, held: ledger(false) }),
      A(WILKES, "wil", [60.3, 0, 0.45], 2, { mode: "stand", expr: track(f, ex), blink: lidAt(f, 2, swapsOf(ex)), tilt: bob(f),
        look: f < W(24.4) ? -1 : 0, headTilt: f >= W(24.4) && f < W(25.88) ? 7 : 0, hands: { l: [0.3, 0.55], r: [-0.3, 0.55] } }),
    ],
    over: (g, v, f) => {
      tableOver(g, v);
      const k = easeOutBack((f - W(25.88)) / 9, 2.6);
      mould3(g, v, [59.86, 0.9, 1.28], 0.36, 0.2, 0.1 + 0.1 * k);
      const c = v.w([60.04, 1.08, 1.38]), s = v.ppm([60, 1, 1.38]);
      burstAt(g, c[0], c[1], s * 0.9, f - W(25.88), 10);
      speedLines(g, c[0], c[1], s * 0.3, s * 1.0, (f - W(25.88)) / 12);
    },
  });
}
// 10 — "His bricks come out FAT."  (insert: the mould lifts, a fat brick plops)
add({
  a: 794, b: W(28.28), plate: "yard_table",
  keys: [
    { f: 794, at: [60.05, 0.97, 1.36], z: 1.1, creep: 0.0022 },
    { f: W(27.74) - 4, dur: 10, at: [60.0, 0.97, 1.36], z: 1.26, creep: 0.002, punch: 0.006 },
  ],
  kicks: [[W(27.74), 1.0]],
  over: (g, v, f) => {
    box3(g, v, [60.25, 0.9, 1.3], [0.34, 0.1, 0.18], BRICK, 3.2, { speck: 30, seed: 9 });
    const n = f - W(27.74), sq = n < 0 ? 1 : n < 3 ? 0.78 : n < 7 ? 1.12 : n < 11 ? 0.96 : 1;
    const up = f < 812 ? 0 : easeOut((f - 812) / 10);
    const gobH = 0.2 * (f < 812 ? 1 : sq);
    box3(g, v, [59.72 - 0.015 * (sq - 1), 0.9, 1.28], [0.36 + 0.03 * (1 - sq), gobH, 0.2], BRICK, 3.2, { speck: 46, seed: 4 });
    if (up < 1) mould3(g, v, [59.72 - 0.4 * up, 0.9 + 0.55 * up, 1.28], 0.36, 0.2, 0.2);
    const c = v.w([59.9, 1.0, 1.4]), s = v.ppm([60, 1, 1.4]);
    puffAt(g, c[0] - s * 0.3, c[1] + s * 0.08, s * 0.45, n); puffAt(g, c[0] + s * 0.3, c[1] + s * 0.08, s * 0.45, n);
    for (let i = 0; i < 4; i++) sparkle(g, c[0] + (i - 1.5) * s * 0.16, c[1] - s * 0.25, s * 0.05, (n - i * 2) / 12);
  },
});
// 11 — "Same wall, half the bricks, half the tax."
add({
  a: W(28.28), b: 935, plate: "walls",
  keys: [
    { f: W(28.28), at: [120, 1.55, -2], z: 1.0, creep: 0.0014 },
    { f: W(30.22) - 4, dur: 12, at: [120.5, 1.2, -1.2], z: 1.16, creep: 0.002, punch: 0.005 },
  ],
  kicks: [[W(29.56), 0.5], [W(30.22), 0.7]],
  cast: (f) => [
    A(TAX, "tax", [118.0, 0, 0.7], 1, { mode: "stand", expr: f < W(30.22) ? "stern" : "shock", blink: lidAt(f, 1, [W(30.22)]), tilt: bob(f), look: 1, hands: { l: [0.35, 0.3] }, held: ledger() }),
    A(WILKES, "wil", [122.0, 0, 0.7], 2, { mode: "stand", expr: f < W(29.56) ? "smile" : "grin", blink: lidAt(f, 2, [W(29.56)]), tilt: bob(f), look: -1,
      hands: { r: [0.3, -0.7] } }),
  ],
  over: (g, v, f) => {
    const s = v.ppm([120, 1, -2]);
    const badge = (P: V3, txt: string, age: number) => {
      if (age < 0) return;
      const c = v.w(P), k = easeOutBack(age / 7, 2.2), r = s * 0.22;
      g.save(); g.translate(c[0], c[1]); g.scale(k, k);
      g.beginPath(); g.ellipse(0, 0, r * 1.35, r, 0, 0, 7); g.fillStyle = "#fff6dc"; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      g.font = `900 ${r * 1.05}px 'Montserrat', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = INK; g.fillText(txt, 0, r * 0.06);
      g.restore();
    };
    badge([118.88, 3.25, -2], "72", f - W(29.56));
    badge([121.12, 3.25, -2], "36", f - W(29.56) - 3);
    const age = f - W(30.22);
    if (age >= 0) {
      const cl = v.w([118.88, 0.05, -1.0]), cr = v.w([121.12, 0.05, -1.0]);
      coinStack(g, cl[0], cl[1], s * 0.1, Math.min(10, Math.floor(age * 1.2) + 1));
      coinStack(g, cr[0], cr[1], s * 0.1, Math.min(5, Math.floor(age * 1.2) + 1));
      for (let i = 0; i < 3; i++) sparkle(g, cr[0] + (i - 1) * s * 0.2, cr[1] - s * 0.55, s * 0.06, (age - 5 - i * 3) / 12);
    }
  },
});
// 12 — "People still call them Wilkes' gobs."  (the street laughs)
{
  const L = W(33.0);
  add({
    a: 935, b: 1010, plate: "town_gob",
    keys: [
      { f: 935, at: [4.6, 1.1, -2.6], z: 1.04, creep: 0.0022 },
      { f: L - 4, dur: 12, at: [4.3, 1.2, -2.8], z: 1.18, roll: 0.04, creep: 0.002, punch: 0.006 },
    ],
    kicks: [[L, 0.6]],
    cast: (f) => {
      const on = f >= L - 4, hop = (i: number) => (on ? Math.max(0, Math.sin(f * 0.6 + i)) * 0.12 : 0);
      return [
        A(FOLK[2], "f2", [2.7, 0, -1.6], 41, { mode: "stand", expr: on ? "laugh" : "grin", blink: lidAt(f, 41), tilt: bob(f), hands: { r: [0.7, -0.35] } }, { hop: hop(1) }),
        A(WILKES, "wil", [3.9, 0, -3.6], 2, { mode: "stand", expr: on ? "smile_closed" : "smile", blink: lidAt(f, 2, [L - 4]), tilt: bob(f),
          hands: { l: [0.1, 0.5], r: [-0.32, 0.12] }, held: (p, _l, r) => brick2(p, r[0] - 20, r[1] - 40, 170, 80) }),
        A(FOLK[4], "f4", [6.0, 0, -1.4], 42, { mode: "stand", expr: on ? "laugh" : "smile", blink: lidAt(f, 42), tilt: bob(f), hands: { l: [-0.75, -0.3] } }, { hop: hop(2) }),
        A(FOLK[1], "f1", [6.6, 0, -3.0], 43, { mode: "stand", expr: on ? "laugh" : "smile_closed", blink: lidAt(f, 43), tilt: bob(f) }, { hop: hop(3) }),
      ];
    },
  });
}
// 13 — "The tax man counts the wall. Counts it again. Wait... why is this house so cheap?"
{
  const WAIT = W(36.08);
  const ex: [number, Expr][] = [[0, "neutral"], [W(35.22), "nervous"], [WAIT, "shock"], [W(36.82), "nervous"]];
  add({
    a: 1010, b: W(37.74), plate: "town_ms",
    keys: [
      { f: 1010, at: [3.9, 1.5, -4.4], z: 1.04, creep: 0.0018 },
      { f: W(35.22) - 6, dur: 16, at: [3.7, 1.75, -5.0], z: 1.12, roll: -0.03, creep: 0.0018 },
      { f: WAIT, cut: true, at: [4.1, 1.22, -3.6], z: 1.36, roll: 0.075, creep: 0.002, punch: 0.006 },
    ],
    kicks: [[WAIT, 0.9]],
    cast: (f) => {
      const counting = f < WAIT, sweep = Math.sin(f * 0.25);
      return [A(TAX, "tax", [4.2, 0, -3.5], 1, {
        mode: "stand", expr: track(f, ex), blink: lidAt(f, 1, swapsOf(ex)), tilt: bob(f), facing: counting ? -1 : 0, look: counting ? -1 : 0,
        hands: counting ? { l: [0.35, 0.3], r: [-0.55 + 0.12 * sweep, -0.75] } : { l: [0.35, 0.3], r: [0.2, -0.3] }, held: ledger(),
      })];
    },
    over: (g, v, f) => {
      // tally numbers pop on the gob bricks as he counts (twice)
      const s = v.ppm([3, 2.5, -5.6]);
      for (const [start, end] of [[1012, W(35.22) - 2], [W(35.22), WAIT]] as [number, number][]) {
        if (f < start || f >= end + 6) continue;
        const n = Math.min(6, Math.floor((f - start) / 6) + 1);
        for (let i = 0; i < n; i++) {
          const P: V3 = [2.6 + i * 0.5, 1.9 + (i % 2) * 0.42 + Math.floor(i / 3) * 0.55, -5.58];
          const c = v.w(P), age = f - start - i * 6, k = easeOutBack(Math.min(1, age / 5), 2), fade = f >= end ? 1 - (f - end) / 6 : 1;
          g.save(); g.globalAlpha = Math.max(0, fade); g.translate(c[0], c[1]); g.scale(k, k);
          g.font = `900 ${s * 0.32}px 'Montserrat', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
          g.lineWidth = s * 0.07; g.strokeStyle = INK; g.strokeText(String(i + 1), 0, 0); g.fillStyle = "#ffe066"; g.fillText(String(i + 1), 0, 0);
          g.restore();
        }
      }
      const head = v.w([4.2, TOP + 0.12, -3.5]), sh = v.ppm([4.2, HEAD, -3.5]);
      qmark(g, head[0] - sh * 0.35, head[1] - sh * 0.2, sh * 0.42, f - WAIT - 2, -0.2);
      qmark(g, head[0] + sh * 0.38, head[1] - sh * 0.32, sh * 0.32, f - WAIT - 6, 0.25);
      speedLines(g, head[0], head[1], sh * 0.4, sh * 1.2, (f - WAIT) / 10);
    },
  });
}
// 14 — "You see, the law said 'per brick'. It never said how BIG a brick had to be!"  (night-blue insert)
{
  const LAW = W(38.3), NEVER = W(39.94), BIG = W(40.8);
  add({
    a: W(37.74), b: W(42.28), plate: "yard_table", night: true, xfade: 10,
    keys: [
      { f: W(37.74), at: [60.0, 0.97, 1.42], z: 1.08, creep: 0.0018 },
      { f: BIG - 4, dur: 10, at: [60.08, 0.98, 1.4], z: 1.2, creep: 0.002, punch: 0.006 },
    ],
    kicks: [[BIG + 1, 0.9]],
    over: (g, v, f) => {
      // candle
      const cb: V3 = [59.6, 0.9, 1.78];
      box3(g, v, [cb[0] - 0.03, 0.9, cb[2] - 0.03], [0.06, 0.22, 0.06], "#f4ecd8", 2.6);
      const fl = v.w([cb[0], 1.16, cb[2]]), s = v.ppm([cb[0], 1.1, cb[2]]), fk = 1 + 0.08 * Math.sin(f * 1.3) + 0.05 * Math.sin(f * 2.9);
      g.beginPath(); g.ellipse(fl[0], fl[1], s * 0.028 * fk, s * 0.06 * fk, 0, 0, 7); g.fillStyle = "#ffd36b"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      // the law: a scroll unrolls on "the law said", slides away on "It never said"
      const out = easeOut((f - NEVER + 4) / 12), c = v.w([60.05, 0.95, 1.45]), sv = v.ppm([60, 1, 1.45]);
      if (out < 1) scroll(g, c[0] + out * sv * 1.6, c[1] - sv * 0.12, sv * 0.62, "BRICK DUTY", ["Tax: per 1,000", "bricks"], easeOut((f - LAW) / 10));
      if (f >= NEVER) {
        const ins = easeOut((f - NEVER) / 10);
        box3(g, v, [59.62 - (1 - ins) * 0.6, 0.9, 1.3], [0.3, 0.1, 0.15], BRICK, 3.2, { speck: 24, seed: 2 });
        const gk = f < BIG ? 1 : 1 + 0.55 * easeOutBack((f - BIG) / 9, 2.4);
        box3(g, v, [60.05 + (1 - ins) * 0.6, 0.9, 1.28], [0.34 * Math.sqrt(gk), 0.2 * gk, 0.2], BRICK, 3.4, { speck: 40, seed: 6 });
        const q = v.w([60.0, 1.32, 1.35]);
        qmark(g, q[0], q[1] - (gk - 1) * sv * 0.15, sv * 0.22, f - BIG - 4, 0.15);
        burstAt(g, v.w([60.5, 1.3, 1.3])[0], v.w([60.5, 1.3, 1.3])[1], sv * 0.35, f - BIG, 8);
      }
    },
  });
}
// 15 — "Soon other brickmakers start baking chunky bricks too,"
add({
  a: W(42.28), b: W(45.16), plate: "yard_group", xfade: 8,
  keys: [
    { f: W(42.28), at: [60.4, 1.2, 2.0], z: 1.02, creep: 0.0022 },
    { f: W(44.0) - 4, dur: 14, at: [60.4, 1.15, 2.2], z: 1.12, creep: 0.002, punch: 0.005 },
  ],
  kicks: [[W(44.0), 0.5]],
  cast: (f) => {
    const spots: V3[] = [[58.95, 0, 2.5], [59.8, 0, 3.4], [61.05, 0, 3.2], [61.9, 0, 2.3]];
    const lift = clamp01((f - W(42.78)) / 10);
    return [
      A(WILKES, "wil", [60.25, 0, 0.45], 2, { mode: "stand", expr: "nervous", blink: lidAt(f, 2), tilt: bob(f), look: 1 }),
      ...spots.map((P, i) => A(MAKER(i), "m" + i, P, 50 + i, {
        mode: "stand", expr: (["laugh", "grin", "laugh", "grin"] as Expr[])[i], blink: lidAt(f, 50 + i), tilt: bob(f + i * 9),
        hands: { l: [0.2, -0.4 - 0.6 * lift], r: [-0.2, -0.4 - 0.6 * lift] }, held: heldBrick(220, 96),
      }, { hop: Math.max(0, Math.sin(f * 0.5 + i * 1.3)) * 0.1 * lift })),
    ];
  },
  over: (g, v) => tableOver(g, v),
});
// 16 — "...and London is FURIOUS,"
{
  const FUR = W(46.1);
  add({
    a: W(45.16), b: W(46.98), plate: "tres_ms",
    keys: [
      { f: W(45.16), at: [-59.6, 1.15, -1.2], z: 1.15, creep: 0.0024 },
      { f: FUR, cut: true, at: [-59.6, 1.3, -1.2], z: 1.42, roll: -0.06, creep: 0.002, punch: 0.008, pn: 20 },
    ],
    kicks: [[FUR, 1.3], [FUR + 9, 0.6]],
    cast: (f) => {
      const j = f >= FUR ? Math.sin(f * 2.2) * 0.06 : 0;
      return [A(LORD, "lord", [-59.6, 0, -1.2], 3, { mode: "stand", expr: f < FUR ? "stern" : "pained", blink: lidAt(f, 3, [FUR]), tilt: bob(f) + j * 20,
        hands: { l: [0.05 + j, -0.6], r: [-0.05 - j, -0.6] }, held: (p, l, r) => { p.dot(l[0], l[1], 17); p.dot(r[0], r[1], 17); } })];
    },
    over: (g, v, f) => {
      const head = v.w([-59.6, HEAD, -1.2]), s = v.ppm([-59.6, HEAD, -1.2]);
      if (f >= FUR - 2) {
        // face flushes red
        g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = Math.min(0.55, (f - FUR + 2) / 8);
        const gr = g.createRadialGradient(head[0], head[1] + s * 0.05, 0, head[0], head[1] + s * 0.05, s * 0.32);
        gr.addColorStop(0, "#ff4a3a"); gr.addColorStop(0.75, "#ff7a6a"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(head[0] - s * 0.4, head[1] - s * 0.4, s * 0.8, s * 0.8); g.restore();
        steam(g, head[0], head[1] - s * 0.22, s * 0.32, f - FUR);
      }
    },
  });
}
// 17 — "so the government strikes back."  (the ruler)
{
  const SLAM = W(48.22);
  add({
    a: W(46.98), b: W(48.92), plate: "tres_ms",
    keys: [
      { f: W(46.98), at: [-59.55, 1.3, -1.2], z: 1.1, roll: 0.03, creep: 0.0025 },
      { f: SLAM - 3, dur: 8, at: [-59.5, 1.15, -1.2], z: 1.3, roll: -0.04, creep: 0.002, punch: 0.007 },
    ],
    kicks: [[SLAM, 1.3]],
    cast: (f) => {
      const d = f < SLAM - 3 ? 0 : easeOut((f - SLAM + 3) / 3);
      return [A(LORD, "lord", [-59.6, 0, -1.2], 3, { mode: "stand", expr: "stern", blink: lidAt(f, 3), tilt: bob(f),
        hands: { l: [-0.1, 0.45], r: [0.2, -1.0 + 1.1 * d] }, held: ruler(d) })];
    },
    over: (g, v, f) => {
      const c = v.w([-59.1, 1.0, -1.0]), s = v.ppm([-59.6, 1, -1.2]);
      burstAt(g, c[0], c[1], s * 0.9, f - SLAM, 10, "#ffe9a0");
      puffAt(g, c[0], c[1] + s * 0.1, s * 0.6, f - SLAM);
    },
  });
}
// 18 — "10 inches long, five wide, three high. Anything bigger? DOUBLE tax."
{
  const TEN = W(48.92), FIVE = W(49.76), THREE = W(50.72), BIGGER = W(51.36), DOUBLE = W(52.32);
  add({
    a: W(48.92), b: W(53.62), plate: "yard_table",
    keys: [
      { f: W(48.92), at: [59.85, 0.97, 1.38], z: 1.22, creep: 0.0014 },
      { f: BIGGER - 6, dur: 16, at: [60.1, 0.98, 1.36], z: 1.08, creep: 0.0016 },
      { f: DOUBLE - 3, dur: 8, at: [60.28, 1.0, 1.36], z: 1.28, roll: 0.04, creep: 0.002, punch: 0.006 },
    ],
    kicks: [[DOUBLE + 1, 1.3]],
    over: (g, v, f) => {
      const B: V3 = [59.62, 0.9, 1.32], S: V3 = [0.36, 0.11, 0.18]; // "10 x 5 x 3": length, depth, height (cartoon scale)
      const Q = box3(g, v, B, S, BRICK, 3.2, { speck: 30, seed: 8 });
      const lab = Math.max(0.6, 1 - (f - BIGGER) / 20);
      g.save(); g.globalAlpha = f < BIGGER ? 1 : lab;
      const dn = (a: P2, dx: number, dy: number): P2 => [a[0] + dx, a[1] + dy];
      dimArrow(g, dn(Q[3], 0, 34), dn(Q[2], 0, 34), "10 in", (f - TEN) / 10, 56, [0, 50]);
      dimArrow(g, dn(Q[6], 26, -8), dn(Q[5], 26, -8), "5 in", (f - FIVE) / 10, 56, [86, 0]);
      dimArrow(g, dn(Q[3], -30, 0), dn(Q[7], -30, 0), "3 in", (f - THREE) / 10, 56, [-84, 0]);
      g.restore();
      if (f >= BIGGER) {
        const ins = easeOut((f - BIGGER) / 9);
        const QG = box3(g, v, [60.12 + (1 - ins) * 0.7, 0.9, 1.28], [0.4, 0.24, 0.22], BRICK, 3.4, { speck: 46, seed: 4 });
        const mid: P2 = [(QG[3][0] + QG[6][0]) / 2, (QG[3][1] + QG[6][1]) / 2];
        stampMark(g, mid[0], mid[1], v.ppm([60.3, 1, 1.5]) * 0.42, "DOUBLE TAX", f - DOUBLE);
        burstAt(g, mid[0], mid[1], v.ppm([60.3, 1, 1.5]) * 0.6, f - DOUBLE, 9, "#ffd0c0");
      }
    },
  });
}
// 19 — "Wilkes' trick is dead."  (golden: Wilkes deflates, a rain cloud)
add({
  a: W(53.62), b: W(55.12), plate: "yard_ms_g", xfade: 8,
  keys: [{ f: W(53.62), at: [60.3, 1.15, 0.45], z: 1.12, roll: -0.03, creep: 0.0028 }],
  kicks: [[W(54.76), 0.5]],
  cast: (f) => [A(WILKES, "wil", [60.3, 0, 0.45], 2, { mode: "stand", expr: f < W(54.76) ? "nervous" : "pained", blink: lidAt(f, 2, [W(54.76)]),
    tilt: -2, headTilt: 9, hands: { l: [0.22, 0.85], r: [-0.22, 0.85] }, held: (p, l, r) => brick2(p, (l[0] + r[0]) / 2, l[1] + 10, 180, 80) })],
  over: (g, v, f) => {
    tableOver(g, v);
    const head = v.w([60.3, TOP + 0.38, 0.45]), s = v.ppm([60.3, HEAD, 0.45]);
    rainCloud(g, head[0], head[1] - s * 0.15, s * 0.55, f);
  },
});
// 20 — "The tax hangs around for decades, until 1850, when they finally give up and scrap it."
{
  const DEC = W(56.4), Y1850 = W(57.32), SCRAP = W(59.6);
  add({
    a: W(55.12), b: W(60.18), plate: "tres_ms",
    keys: [
      { f: W(55.12), at: [-59.6, 1.15, -1.2], z: 1.1, creep: 0.0016 },
      { f: Y1850 - 6, dur: 16, at: [-59.6, 1.3, -1.2], z: 1.2, creep: 0.0016 },
      { f: SCRAP - 4, dur: 10, at: [-59.6, 1.15, -1.2], z: 1.36, roll: 0.05, creep: 0.002, punch: 0.006 },
    ],
    kicks: [[SCRAP + 1, 1.0]],
    cast: (f) => {
      const tear = clamp01((f - SCRAP) / 10), cob = clamp01((f - DEC) / 14);
      const ex: Expr = f < DEC ? "neutral" : f < SCRAP - 8 ? "whistle" : f < SCRAP ? "stern" : "grin";
      const spread = 0.22 + 0.5 * easeOut(tear);
      return [A(LORD, "lord", [-59.6, 0, -1.2], 3, { mode: "stand", expr: ex, blink: lidAt(f, 3, [DEC, SCRAP - 8, SCRAP]), tilt: bob(f),
        hands: { l: [spread, 0.42], r: [-spread, 0.42] }, held: scrollHeld("BRICK DUTY", tear, cob * (1 - tear)) })];
    },
    over: (g, v, f) => {
      const s = v.ppm([-59.6, 1.5, -1.2]), top = v.w([-59.6, TOP + 0.45, -1.2]);
      stampMark(g, top[0], top[1] - s * 0.1, s * 0.75, "1850", f - Y1850, 0.08);
      const c = v.w([-59.6, 1.0, -1.0]);
      paperBits(g, c[0], c[1], s * 1.2, f - SCRAP - 2);
      burstAt(g, c[0], c[1], s * 0.8, f - SCRAP, 10);
    },
  });
}
// 21 — "But Wilkes' giant bricks? More than 200 years later, they're still standing in Measham. Still the size of a tax dodge."
{
  const DODGE = W(66.12);
  add({
    a: W(60.18), b: TOTAL, plate: "town_end_g", xfade: 10,
    keys: [
      { f: W(60.18), at: [3.0, 2.6, -5.6], z: 1.04, creep: 0.0016 },
      { f: W(62.66) - 10, dur: 30, at: [4.6, 1.3, -3.2], z: 1.18, creep: 0.0018 },
      { f: DODGE - 5, dur: 16, at: [3.0, 2.2, -5.6], z: 1.45, creep: 0.0012, punch: 0.004 },
    ],
    cast: (f) => [
      A(PARENT, "par", [5.6, 0, -3.0], 61, { mode: "stand", expr: "smile", blink: lidAt(f, 61), tilt: bob(f), look: -1 }),
      A(KID, "kid", [4.6, 0, -3.3], 62, { mode: "stand", expr: f < W(63.74) ? "smile" : "grin", blink: lidAt(f, 62, [W(63.74)]), tilt: bob(f), look: -1,
        hands: f >= W(63.24) ? { r: [-0.75, -0.55] } : undefined, facing: -1 }, { scale: 0.72 }),
    ],
    over: (g, v, f) => {
      for (let i = 0; i < 6; i++) {
        const P: V3 = [1.0 + i * 0.6, 1.2 + (i % 3) * 0.7, -5.58], c = v.w(P), s = v.ppm(P);
        sparkle(g, c[0], c[1], s * 0.22, (f - DODGE - 2 - i * 3) / 18, "#fff1c4");
        sparkle(g, c[0] + s * 0.3, c[1] + s * 0.25, s * 0.16, (f - W(60.62) - i * 4) / 18, "#fff1c4");
      }
    },
  });
}

/** crossfades at place / time changes (frames, centred on the shot start) */
export const XFADE: Record<number, number> = Object.fromEntries(SHOTS.filter((s) => s.xfade).map((s) => [s.id, s.xfade!]));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { s: Shot; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ s: SHOTS[s.id - 2], alpha: 1 }, { s, alpha: smooth((f - (s.a - x / 2) + 1) / (x + 1)) }];
  }
  return [{ s: shotAt(f), alpha: 1 }];
};
export const PLATE_IDS = Array.from(new Set(SHOTS.map((s) => s.plate)));
export { PW, PH };
