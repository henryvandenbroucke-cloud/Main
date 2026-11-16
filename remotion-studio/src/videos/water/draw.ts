// Drawings for the water short, made with the skill's Pen (toon.ts): the robot, the cow, hand props and effect
// sprites. Same construction rules as the skill's cast: squircle / bean shapes, single-stroke limbs, plum ink with
// a thick-thin ring away from the light, soft painted crescents, no blush, no catchlights, no text anywhere.
import { Pen, INK, mul, mix, shade, blobPts, thickAngle } from "../pointing/toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp2 = (a: P2, b: P2, t: number): P2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const rot = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const curve = (a: P2, k: P2, b: P2, n = 12): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = 1 - t; out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]); }
  return out;
};
/** squircle (superellipse) contour, clockwise on screen */
const sq = (cx: number, cy: number, a: number, b: number, n = 4.5, seed = 1, r = 0): P2[] =>
  blobPts(cx, cy, { a, b, nTop: n, nBot: n, egg: 0, asym: 0, rot: r, noise: 0.004, seed });
const box = (x0: number, y0: number, x1: number, y1: number): P2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const LIGHT = rad(-55);
const SH: [number, number, number] = [0.66, 0.68, 0.78];
const WATER = "#3aa0e8", WATER_HI = "#8fd0ff", STEEL = "#c9d0da", RED = "#e2453c";

// ---------------- the robot ----------------
export type RobotEye = "open" | "blink" | "happy" | "sus" | "evil" | "wide";
export type RobotOpts = {
  sip?: number; level?: number; eye?: RobotEye; look?: number; lookY?: number; mouth?: "flat" | "smile" | "o" | "grin";
  tilt?: number; antenna?: number; bottle?: boolean; light?: number; wave?: number; legs?: boolean;
};
/** box-headed robot on the 600 x 1000 design card, soles at y = 975. sip 0 = bottle at its side, 1 = straw in its mouth. */
export const robot = (p: Pen, o: RobotOpts) => {
  const { sip = 0, level = 0.8, eye = "open", look = 0, lookY = 0, mouth = "flat", tilt = 0, antenna = 0, bottle = true, light = LIGHT, wave, legs = true } = o;
  const thick = thickAngle(light), cx = 300, sole = 975, hipY = 822, limb = "#465066";
  p.rot = null;
  if (legs) for (const sd of [-1, 1]) {
    p.stroke([[cx + sd * 44, hipY], [cx + sd * 47, sole - 12]], 15, limb);
    p.stroke([[cx + sd * 36, sole - 8], [cx + sd * 82, sole - 8]], 24, INK); p.stroke([[cx + sd * 38, sole - 9], [cx + sd * 80, sole - 9]], 14, "#8a93a6");
  }
  p.rot = tilt ? [rad(tilt), cx, hipY] : null;
  const bw = 108, bh = 128, by = 700, hy = 438;
  // left arm (screen left): hangs, or waves
  const SL: P2 = [cx - bw + 8, 640];
  const HL: P2 = wave === undefined ? [cx - bw - 34, 800] : [cx - bw - 70 - 14 * wave, 520 - 10 * wave];
  p.stroke(curve(SL, wave === undefined ? [cx - bw - 44, 715] : [cx - bw - 62, 610], HL), 14, limb);
  p.dot(HL[0], HL[1], 15, INK); p.dot(HL[0], HL[1], 10, STEEL);
  p.stroke([[cx, 560], [cx, 592]], 34, INK); p.stroke([[cx, 556], [cx, 596]], 22, limb); // neck
  // body
  const tp = sq(cx, by, bw, bh, 4.2, 3);
  p.gradFill(tp, "#dde6f0", mul("#dde6f0", SH), light);
  p.clip(tp, () => {
    p.poly(sq(cx, by - 28, 62, 40, 5, 9), "#22314c", 6);
    p.stroke([[cx - 40, by - 28], [cx - 20, by - 28], [cx - 8, by - 46], [cx + 6, by - 10], [cx + 18, by - 28], [cx + 40, by - 28]], 6, "#7df0ff");
    for (const [i, c] of [[-1, RED], [0, "#f2bd2a"], [1, "#3f9c62"]] as const) { p.dot(cx + i * 34, by + 52, 13, INK); p.dot(cx + i * 34, by + 52, 9, c); }
  });
  p.inkRing(tp, 12, thick);
  // antenna + ears
  const at: P2 = [cx + 26 * antenna, hy - 178];
  p.stroke([[cx, hy - 110], at], 9); p.dot(at[0], at[1], 20, INK); p.dot(at[0], at[1], 14, RED);
  for (const sd of [-1, 1]) p.poly(sq(cx + sd * 158, hy + 4, 20, 38, 4, 11), "#8a93a6", 9);
  // head + face screen
  const hp = sq(cx, hy, 152, 116, 4.2, 5);
  p.gradFill(hp, "#eef3f8", mul("#eef3f8", [0.72, 0.74, 0.84]), light);
  p.inkRing(hp, 12, thick);
  p.poly(sq(cx, hy + 6, 120, 82, 5, 7), "#1f2d47", 7);
  const ec = eye === "evil" ? "#ff5a4a" : "#7df0ff", ey = hy - 8 + 8 * lookY;
  for (const sd of [-1, 1]) {
    const ex = cx + sd * 50 + 12 * look;
    if (eye === "blink") p.stroke([[ex - 22, ey], [ex + 22, ey]], 9, ec);
    else if (eye === "happy") p.arc(ex, ey + 12, 22, 20, 200, 340, 10, ec);
    else if (eye === "sus") { p.ell(ex, ey - 2, 23, 20, ec, 0, 0, 180); p.stroke([[ex - 25, ey - 2], [ex + 25, ey - 2]], 8, ec); }
    else if (eye === "evil") p.poly([[ex - 26, ey - 14 * sd - 6], [ex + 26, ey + 14 * sd - 6], [ex + 22, ey + 16], [ex - 22, ey + 16]], ec, 0);
    else p.ell(ex, ey, eye === "wide" ? 26 : 22, eye === "wide" ? 32 : 27, ec, 0);
  }
  const my = hy + 52;
  if (mouth === "smile") p.arc(cx + 8 * look, my - 14, 30, 16, 20, 160, 8, ec);
  else if (mouth === "grin") p.arc(cx + 8 * look, my - 20, 46, 24, 15, 165, 9, ec);
  else if (mouth === "o") p.ell(cx + 14, my, 11, 12, null, 0), p.arc(cx + 14, my, 10, 11, 0, 360, 7, ec);
  else p.stroke([[cx - 26 + 8 * look, my], [cx + 26 + 8 * look, my]], 8, ec);
  // right arm, bottle and straw (over the head so the straw reaches the mouth)
  const SR: P2 = [cx + bw - 8, 640];
  const H = lerp2([cx + bw + 36, 790], [cx + 150, 610], sip), E = lerp2([cx + bw + 58, 716], [cx + bw + 66, 706], sip);
  if (bottle) {
    const a = rad(lerp(0, -16, sip)), bx = H[0], bcy = H[1] - 30, hw = 40, hh = 92;
    const R = (pts: P2[]) => rot(pts, a, H[0], H[1]);
    const top: P2 = R([[bx, bcy - hh - 18]])[0];
    const tip: P2 = lerp2([top[0] + 26, top[1] - 86], [cx + 16, my], cl(sip * 1.25));
    const knee: P2 = lerp2([top[0] + 4, top[1] - 66], [top[0] - 8, top[1] - 70], cl(sip * 1.25));
    p.line([R([[bx, bcy + hh - 26]])[0], top, knee], RED, 9);        // straw inside + up
    const shape = R(sq(bx, bcy, hw, hh, 5, 13));
    p.poly(shape, "#dff0fb", 0);
    p.clip(shape, () => p.poly(R(box(bx - hw - 4, bcy + hh - 2 * hh * cl(level), bx + hw + 4, bcy + hh + 4)), WATER, 0));
    p.clip(shape, () => p.poly(R(box(bx - hw + 8, bcy - hh + 14, bx - hw + 20, bcy + hh - 14)), "rgba(255,255,255,0.55)", 0));
    p.poly(shape, null, 9);
    p.poly(R(box(bx - 24, bcy - hh - 22, bx + 24, bcy - hh - 2)), "#2f6fd0", 8);
    p.line([knee, tip], RED, 9);
  }
  p.stroke(curve(SR, E, H), 14, limb);
  p.dot(H[0], H[1], 15, INK); p.dot(H[0], H[1], 10, STEEL);
  p.rot = null;
};

// ---------------- the cow (side view, facing screen right) on a 1000 x 700 card, hooves at y = 680 ----------------
export const cow = (p: Pen, o: { head?: number; chew?: number; tail?: number; blink?: boolean; light?: number }) => {
  const { head = 0, chew = 0, tail = 0, blink = false, light = LIGHT } = o; // head 0 = up, 1 = down at the grass / water
  const thick = thickAngle(light), hide = "#f6f1e7", spot = "#3b3038";
  p.rot = null;
  for (const [x, back] of [[250, 1], [330, 0], [600, 1], [680, 0]] as const) {
    p.stroke([[x, 500], [x + (back ? -6 : 6), 664]], back ? 24 : 26, back ? mix(spot, INK, 0.5) : INK);
    if (!back) p.stroke([[x, 500], [x + 6, 650]], 15, hide);
    p.stroke([[x - 8, 668], [x + 26, 668]], 22, INK);
  }
  p.stroke(curve([170, 380], [110 - 30 * tail, 470], [130 + 40 * tail, 590]), 10); p.dot(130 + 40 * tail, 596, 18, spot);
  p.poly(sq(470, 560, 46, 30, 3, 21), "#f2a3b0", 8); // udder
  const bp = blobPts(440, 410, { a: 290, b: 150, nTop: 2.6, nBot: 3.0, egg: 0.05, asym: 0.02, rot: rad(-2), noise: 0.006, seed: 4 });
  p.gradFill(bp, hide, mul(hide, SH), light);
  p.clip(bp, () => {
    for (const [x, y, a, b, r] of [[300, 330, 110, 70, 0.3], [520, 470, 90, 60, -0.4], [640, 320, 70, 50, 0.6], [180, 470, 60, 44, 0.2]] as const)
      p.poly(blobPts(x, y, { a, b, nTop: 2, nBot: 2.2, egg: 0.1, asym: 0.1, rot: r, noise: 0.04, seed: x }), spot, 0);
  });
  p.inkRing(bp, 13, thick);
  // head swings down about the shoulder
  p.rot = [rad(lerp(-6, 62, head)), 690, 350];
  p.stroke([[690, 340], [800, 290]], 86, INK); p.stroke([[690, 340], [800, 290]], 62, hide); // neck
  const hx = 850, hyy = 250;
  p.poly([[hx - 40, hyy - 78], [hx - 78, hyy - 118], [hx - 20, hyy - 96]], "#e9dcc0", 8); // horn
  p.poly(blobPts(hx - 74, hyy - 44, { a: 44, b: 22, nTop: 2, nBot: 2, egg: 0, asym: 0, rot: rad(-28), noise: 0, seed: 2 }), spot, 9); // ear
  const hd = blobPts(hx, hyy, { a: 92, b: 76, nTop: 2.2, nBot: 2.5, egg: 0.06, asym: 0.05, rot: rad(8), noise: 0.006, seed: 8 });
  p.gradFill(hd, hide, mul(hide, [0.9, 0.86, 0.86]), light);
  p.clip(hd, () => p.poly(blobPts(hx - 50, hyy - 40, { a: 62, b: 50, nTop: 2, nBot: 2, egg: 0, asym: 0, rot: 0.4, noise: 0.03, seed: 5 }), spot, 0));
  p.inkRing(hd, 12, thick);
  const sn = blobPts(hx + 66, hyy + 34 + 5 * chew, { a: 52, b: 40, nTop: 2.4, nBot: 2.6, egg: 0, asym: 0, rot: rad(10), noise: 0.004, seed: 6 });
  p.poly(sn, "#f2a3b0", 10);
  p.dot(hx + 84, hyy + 22 + 5 * chew, 6); p.dot(hx + 58, hyy + 20 + 5 * chew, 6);
  p.stroke([[hx + 36, hyy + 52 + 9 * chew], [hx + 92, hyy + 56 + 9 * chew]], 6);
  if (blink) p.stroke([[hx - 4, hyy - 18], [hx + 26, hyy - 18]], 8);
  else { p.ell(hx + 12, hyy - 18, 13, 12, INK, 0, 0, 180); p.stroke([[hx - 6, hyy - 18], [hx + 30, hyy - 18]], 8); }
  p.rot = null;
};

// ---------------- hand props for bodyFront({ hold }) : (p, hand x, hand y, u) ----------------
type Hold = (p: Pen, hx: number, hy: number, u: number) => void;
export const glassProp = (level: number): Hold => (p, hx, hy, u) => {
  const g: P2[] = [[hx - 15 * u, hy - 30 * u], [hx + 15 * u, hy - 30 * u], [hx + 11 * u, hy + 10 * u], [hx - 11 * u, hy + 10 * u]];
  p.poly(g, "#e6f3fb", 0);
  p.clip(g, () => p.poly(box(hx - 20 * u, hy + 10 * u - 40 * u * cl(level), hx + 20 * u, hy + 12 * u), WATER, 0));
  p.poly(g, null, 2.6 * u);
};
export const phoneProp = (lit: boolean): Hold => (p, hx, hy, u) => {
  p.poly(sq(hx, hy - 12 * u, 13 * u, 22 * u, 5, 31, rad(-8)), "#22263a", 2.6 * u);
  p.poly(sq(hx, hy - 12 * u, 9.5 * u, 17.5 * u, 5, 32, rad(-8)), lit ? "#d9f1ff" : "#3a4666", 0);
};
export const burgerProp = (): Hold => (p, hx, hy, u) => {
  const cx = hx + 2 * u, cy = hy - 18 * u;
  p.poly(sq(cx, cy + 12 * u, 24 * u, 8 * u, 3, 41), "#d9973f", 2.8 * u);
  p.poly(sq(cx, cy + 3 * u, 26 * u, 6.5 * u, 3, 42), "#6b3a22", 2.6 * u);
  p.stroke([[cx - 27 * u, cy - 3 * u], [cx - 14 * u, cy + 1 * u], [cx, cy - 4 * u], [cx + 14 * u, cy + 1 * u], [cx + 27 * u, cy - 3 * u]], 5 * u, "#62ae4c");
  p.ell(cx, cy - 4 * u, 25 * u, 17 * u, "#e0a35a", 2.8 * u, 180, 360);
  for (const [dx, dy] of [[-10, -12], [2, -15], [12, -10]]) p.dot(cx + dx * u, cy + dy * u, 1.3 * u, "#fbe9c2");
};
export const spoonProp = (drop: boolean): Hold => (p, hx, hy, u) => {
  p.band([[hx, hy + 6 * u], [hx + 2 * u, hy - 30 * u]], STEEL, 3.4 * u, 1.5 * u, "round");
  p.ell(hx + 3 * u, hy - 40 * u, 9 * u, 12 * u, STEEL, 2.4 * u);
  if (drop) p.ell(hx + 3 * u, hy - 40 * u, 3.2 * u, 4.2 * u, WATER, 1.2 * u);
};
export const panProp = (egg: number): Hold => (p, hx, hy, u) => {
  p.band([[hx, hy], [hx + 26 * u, hy + 2 * u]], "#3a3d47", 4 * u, 1.5 * u, "round");
  p.ell(hx + 52 * u, hy + 3 * u, 28 * u, 9 * u, "#3a3d47", 2.6 * u);
  if (egg > 0) { p.ell(hx + 52 * u, hy + 1 * u, 18 * u * egg, 5.5 * u * egg, "#fbf8f0", 1.6 * u); p.ell(hx + 54 * u, hy, 6 * u * egg, 3 * u * egg, "#f2bd2a", 1.2 * u); }
};
export const chalkProp: Hold = (p, hx, hy, u) => p.band([[hx, hy + 2 * u], [hx + 4 * u, hy - 12 * u]], "#fbf8f0", 3 * u, 1.3 * u, "round");

// ---------------- effect sprites ----------------
const heart = (p: Pen, cx: number, cy: number, s: number, col = RED, ol = 9) => {
  const pts: P2[] = [];
  for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2; pts.push([cx + s * 16 * Math.sin(t) ** 3, cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
  p.poly(pts, col, ol);
};
export type BubbleKind = "heart" | "dots" | "hotdog" | "sandwich" | "drop" | "none";
/** speech bubble on a 400 x 360 canvas, tail at the bottom (tailX -1 = left, 1 = right) */
export const bubble = (p: Pen, kind: BubbleKind, tailX = -1, fill = "#ffffff") => {
  const b = sq(200, 160, 176, 132, 3.2, 3);
  p.poly([[200 + tailX * 60, 270], [200 + tailX * 130, 348], [200 + tailX * 10, 280]], fill, 12);
  p.poly(b, fill, 12);
  p.poly([[200 + tailX * 56, 262], [200 + tailX * 118, 332], [200 + tailX * 14, 272]], fill, 0);
  if (kind === "heart") heart(p, 200, 162, 5.2);
  else if (kind === "dots") for (const i of [-1, 0, 1]) p.dot(200 + i * 66, 162, 22, INK);
  else if (kind === "drop") drop(p, 200, 165, 1.1);
  else if (kind === "hotdog") {
    p.poly(sq(200, 176, 120, 44, 3, 5, rad(-8)), "#e0a35a", 9);
    p.line([[100, 172], [300, 144]], "#c8553d", 34);
    p.stroke([[116, 164], [150, 150], [184, 160], [218, 144], [252, 152], [284, 140]], 9, "#f2bd2a");
  } else if (kind === "sandwich") {
    p.poly([[86, 232], [314, 232], [200, 80]], "#f3dfb8", 10);
    p.stroke([[110, 196], [150, 184], [200, 198], [250, 184], [290, 196]], 12, "#62ae4c");
    p.stroke([[124, 172], [276, 172]], 12, "#e2453c");
    p.poly([[86, 232], [314, 232], [200, 80]], null, 10);
  }
};
export const drop = (p: Pen, cx: number, cy: number, s = 1, col = WATER) => {
  const pts: P2[] = [];
  for (let i = 0; i <= 48; i++) { const t = (i / 48) * Math.PI * 2, r = 56 * s; pts.push([cx + r * 1.25 * Math.sin(t) * Math.sin(t / 2), cy - r * 1.3 * Math.cos(t)]); }
  p.poly(pts, col, 10 * s);
  p.arc(cx - 6 * s, cy + 14 * s, 30 * s, 34 * s, 110, 170, 9 * s, WATER_HI);
};
/** single drop on a 160 x 220 canvas */
export const fxDrop = (p: Pen, col = WATER) => drop(p, 80, 120, 1, col);
export const fxHeart = (p: Pen) => heart(p, 100, 104, 4.6);
/** soft steam / cloud blob on a 256 x 256 canvas (drawn with soft alpha, used on a see-through card) */
export const fxSteam = (p: Pen, seed = 0, col = "255,255,255") => {
  const g = p.g;
  for (const [x, y, r] of [[128, 150, 86], [84, 128, 60], [176, 120, 64], [128, 92, 58]] as const) {
    const gr = g.createRadialGradient(x + seed * 3, y, 0, x + seed * 3, y, r);
    gr.addColorStop(0, `rgba(${col},0.95)`); gr.addColorStop(0.6, `rgba(${col},0.7)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
};
/** soft round glow on a 256 x 256 canvas */
export const fxGlow = (p: Pen, col = "190,230,255", k = 0.9) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, `rgba(${col},${k})`); gr.addColorStop(0.4, `rgba(${col},${k * 0.45})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};
export const fxCoin = (p: Pen, squash = 1) => {
  p.ell(100, 100, 84 * Math.max(0.12, Math.abs(squash)), 84, "#f2bd2a", 10);
  if (Math.abs(squash) > 0.3) { p.ell(100, 100, 58 * Math.abs(squash), 58, "#ffd75a", 6); heart(p, 100, 104, 2.0 * Math.abs(squash), "#d59b17", 0); }
};
export const fxEgg = (p: Pen, k = 1) => {
  p.poly(blobPts(150, 115, { a: 130 * k, b: 86 * k, nTop: 2, nBot: 2.2, egg: 0.1, asym: 0.08, rot: 0.1, noise: 0.05, seed: 7 }), "#fbf8f0", 9);
  p.ell(158, 108, 44 * k, 34 * k, "#f2bd2a", 7); p.arc(150, 104, 26 * k, 20 * k, 200, 260, 7, "#ffe27a");
};
/** teaspoon lying flat on a 420 x 140 canvas, bowl on the right; optional drop in the bowl */
export const fxSpoon = (p: Pen, withDrop = false) => {
  p.band([[30, 74], [280, 70]], STEEL, 20, 8, "round");
  p.ell(330, 70, 70, 48, STEEL, 10); p.ell(326, 66, 46, 28, "#e3e8ee", 0);
  if (withDrop) p.ell(330, 68, 17, 13, WATER, 5);
};
/** ten stacked teaspoons on a 420 x 1000 canvas (tiles vertically) */
export const fxSpoonStack = (p: Pen) => {
  for (let i = 9; i >= 0; i--) {
    const y = 50 + i * 100, flip = i % 2 ? 1 : -1, x0 = flip > 0 ? 40 : 380, x1 = flip > 0 ? 280 : 140, bx = flip > 0 ? 326 : 94;
    p.band([[x0, y + 4], [x1, y]], STEEL, 20, 8, "round");
    p.ell(bx, y, 68, 40, STEEL, 10); p.ell(bx - 4 * flip, y - 4, 44, 22, "#e3e8ee", 0);
  }
};
/** the building's face on an 800 x 460 canvas */
export const fxFace = (p: Pen, mood: "calm" | "hot" | "drink" | "wow", t = 0) => {
  const eyeY = 170;
  for (const sd of [-1, 1]) {
    const x = 400 + sd * 150;
    if (mood === "hot") { p.stroke([[x + 50 * sd, eyeY - 40], [x - 50 * sd, eyeY], [x + 50 * sd, eyeY + 40]], 26); }
    else if (mood === "drink") p.arc(x, eyeY + 30, 62, 50, 200, 340, 26);
    else {
      p.ell(x, eyeY, 78, mood === "wow" ? 92 : 78, "#ffffff", 16);
      p.dot(x + 22 * Math.sin(t), eyeY + (mood === "wow" ? 0 : 18), 30);
      if (mood === "calm") { p.ell(x, eyeY, 80, 80, "#e9dcc6", 0, 180, 360); p.stroke([[x - 84, eyeY], [x + 84, eyeY]], 18); }
    }
    if (mood !== "drink") p.band(mood === "hot" ? [[x - 70 * sd, eyeY - 96], [x + 60 * sd, eyeY - 118]] : [[x - 70, eyeY - 122], [x + 70, eyeY - 126]], INK, 22, 0, "round");
  }
  if (mood === "hot") { p.ell(400, 350, 110, 70, "#5a1e28", 16, 0, 180); p.ell(410, 392, 58, 30, "#e86e78", 0); }
  else if (mood === "drink" || mood === "wow") p.ell(400, 360, 46, 50, "#5a1e28", 16);
  else p.stroke([[330, 350], [470, 344]], 22);
};
/** three rising heat squiggles on a 300 x 300 canvas */
export const fxHeat = (p: Pen, t: number, col = "#ff6a3c") => {
  for (const i of [0, 1, 2]) {
    const x = 70 + i * 80, pts: P2[] = [];
    for (let k = 0; k <= 12; k++) pts.push([x + 20 * Math.sin(k * 1.1 + t * 6 + i * 2), 280 - k * 21]);
    p.stroke(pts, 16, INK); p.stroke(pts, 9, col);
  }
};
/** a heap of small speech bubbles on a 1200 x 800 canvas; grow 0..1 = how much of the heap is there */
export const fxPile = (p: Pen, grow: number) => {
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const n = 2 + r * 2, y = 120 + r * 76, show = r >= rows - Math.ceil(rows * cl(grow));
    if (!show) continue;
    for (let i = 0; i < n; i++) {
      const x = 600 + (i - (n - 1) / 2) * 62 + (r % 2 ? 14 : -10), jig = Math.sin(i * 12.9 + r * 4.1) * 10;
      p.poly(sq(x, y + jig, 34, 26, 3, i + r), "#ffffff", 7);
      for (const d of [-1, 0, 1]) p.dot(x + d * 13, y + jig, 4.2, INK);
    }
  }
};
/** chunky impact lines on a 500 x 500 canvas: eight fat rays that fly outward and shorten; t in 0..1 */
export const fxPop = (p: Pen, t: number, col = "#ffe27a") => {
  const k = 1 - (1 - cl(t)) ** 2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.2, r0 = 70 + 110 * k, r1 = r0 + 72 * (1 - 0.75 * k);
    p.line([[250 + r0 * Math.cos(a), 250 + r0 * Math.sin(a)], [250 + r1 * Math.cos(a), 250 + r1 * Math.sin(a)]], col, 22 * (1 - 0.5 * k));
  }
};
/** star burst / sparkle on a 200 x 200 canvas */
export const fxSpark = (p: Pen, col = "#ffe27a") => {
  const pts: P2[] = [];
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 26 : 90; pts.push([100 + r * Math.cos(a), 100 + r * Math.sin(a)]); }
  p.poly(pts, col, 9);
};
/** night sky stars on a 1024 x 512 canvas */
export const fxStars = (p: Pen) => {
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * 1024, y = (Math.sin(i * 37.3 + 2) * 0.5 + 0.5) * 512, r = 1.5 + 2.5 * (Math.sin(i * 7.7) * 0.5 + 0.5);
    p.dot(x, y, r, "#fdf6d8");
  }
};
/** dark audience heads along the bottom of a 1200 x 300 canvas */
export const fxCrowd = (p: Pen, col = "#1a1626") => {
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 135 + 20 * Math.sin(i * 3.1), y = 210 + 30 * Math.sin(i * 1.7);
    p.poly(blobPts(x, y, { a: 62, b: 58, nTop: 1.8, nBot: 2.3, egg: -0.1, asym: 0, rot: 0, noise: 0.01, seed: i + 1 }), col, 0);
    p.poly(sq(x, y + 120, 84, 70, 3, i + 20), col, 0);
  }
};
export { shade };
