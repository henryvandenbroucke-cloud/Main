// 2D props and effects for the brick-tax short, in the template's ink style (plum ink #241726, flat fills with a
// light lip and a shadow side). Bricks on tables are true 3D boxes projected through the plate camera (View), so
// they sit on the painted 3D table in perspective; props in hands are drawn in the character's design space.
import { Pen, INK, P2, mix } from "./toon";
import { View, clamp01, easeOut } from "./view";
import { V3 } from "./story";

export const BRICK = "#c45a38", BRICK_TOP = "#d9785a", BRICK_SIDE = "#9c4128", MORTAR = "#ead7b8";
export const GOLD = "#f2c14e", GOLD_D = "#c8902a";

const shadeHex = (hex: string, k: number) => mix(hex, k < 1 ? "#1a0e14" : "#ffffff", Math.abs(1 - k));

/** a projected box (world min corner + size), faces: top lighter, sides by facing; returns the projected corners */
export const box3 = (g: CanvasRenderingContext2D, v: View, P: V3, S: V3, col: string, ink = 3.2, opts: { speck?: number; seed?: number } = {}) => {
  const [x, y, z] = P, [a, b, c] = S;
  const C: V3[] = [[x, y, z], [x + a, y, z], [x + a, y, z + c], [x, y, z + c], [x, y + b, z], [x + a, y + b, z], [x + a, y + b, z + c], [x, y + b, z + c]];
  const Q = C.map((q) => v.w(q));
  // faces with outward normals; visible when the camera is on the outside
  const cp = v.pc.p.pos;
  const faces: [number[], V3, number][] = [
    [[4, 5, 6, 7], [0, 1, 0], 1.18], [[3, 2, 6, 7], [0, 0, 1], 1.0], [[1, 0, 4, 5], [0, 0, -1], 0.86],
    [[0, 3, 7, 4], [-1, 0, 0], 0.78], [[2, 1, 5, 6], [1, 0, 0], 0.9], [[0, 1, 2, 3], [0, -1, 0], 0.6],
  ];
  const ctr: V3 = [x + a / 2, y + b / 2, z + c / 2];
  const half: V3 = [a / 2, b / 2, c / 2];
  for (const [idx, n, k] of faces) {
    const fc: V3 = [ctr[0] + n[0] * half[0], ctr[1] + n[1] * half[1], ctr[2] + n[2] * half[2]];
    const to: V3 = [cp[0] - fc[0], cp[1] - fc[1], cp[2] - fc[2]];
    if (to[0] * n[0] + to[1] * n[1] + to[2] * n[2] <= 0) continue;
    g.beginPath(); idx.forEach((i, j) => (j ? g.lineTo(...Q[i]) : g.moveTo(...Q[i]))); g.closePath();
    g.fillStyle = shadeHex(col, k); g.fill();
    if (opts.speck) { // painted grit
      g.save(); g.clip();
      let s = opts.seed ?? 3;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const xs = idx.map((i) => Q[i][0]), ys = idx.map((i) => Q[i][1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let i = 0; i < opts.speck; i++) {
        g.fillStyle = rnd() > 0.5 ? "rgba(255,230,200,0.18)" : "rgba(60,20,10,0.18)";
        g.beginPath(); g.ellipse(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1 + rnd() * 3.5, 1 + rnd() * 2.5, 0, 0, 7); g.fill();
      }
      g.restore();
    }
    g.lineJoin = "round"; g.strokeStyle = INK; g.lineWidth = ink; g.stroke();
  }
  return Q;
};

/** text laid on the top face of a projected box (corners 4..7 of box3), e.g. the EXCISE stamp mark */
export const topText = (g: CanvasRenderingContext2D, Q: P2[], text: string, col: string, k = 1) => {
  const [p4, p5, , p7] = [Q[4], Q[5], Q[6], Q[7]];
  const ux: P2 = [p5[0] - p4[0], p5[1] - p4[1]], uy: P2 = [p7[0] - p4[0], p7[1] - p4[1]];
  g.save();
  g.setTransform(ux[0] / 200, ux[1] / 200, uy[0] / 100, uy[1] / 100, p4[0], p4[1]); // face = 200 x 100 units
  g.globalAlpha = k;
  g.font = "900 46px 'Montserrat', 'Arial Black', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.strokeStyle = "rgba(70,20,10,0.55)"; g.lineWidth = 6; g.strokeText(text, 100, 52);
  g.fillStyle = col; g.fillText(text, 100, 52);
  g.restore();
};

/** a brick held in the hands, drawn in design units: front face w x h with a top face of depth d (oblique) */
export const brick2 = (p: Pen, cx: number, cy: number, w: number, h: number, d = 0.35 * h, rot = 0) => {
  const g = p.g;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  const ol = Math.max(5, h * 0.07);
  const top: P2[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 + d * 0.6, -h / 2 - d], [-w / 2 + d * 0.6, -h / 2 - d]];
  const side: P2[] = [[w / 2, -h / 2], [w / 2 + d * 0.6, -h / 2 - d], [w / 2 + d * 0.6, h / 2 - d], [w / 2, h / 2]];
  p.poly(top, BRICK_TOP, ol); p.poly(side, BRICK_SIDE, ol);
  p.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], BRICK, ol);
  // frog / texture: a few grit dots and a lighter lip
  g.fillStyle = "rgba(255,225,190,0.25)"; g.fillRect(-w / 2 + ol, -h / 2 + ol * 0.6, w - 2 * ol, h * 0.1);
  g.fillStyle = "rgba(70,20,10,0.22)";
  for (let i = 0; i < 9; i++) { const u = ((i * 37) % 17) / 17, t = ((i * 53) % 13) / 13; g.beginPath(); g.ellipse(-w / 2 + w * (0.1 + 0.8 * u), -h / 2 + h * (0.25 + 0.6 * t), h * 0.03, h * 0.025, 0, 0, 7); g.fill(); }
  g.restore();
};

export const coin = (g: CanvasRenderingContext2D, x: number, y: number, r: number, spin = 0) => {
  const sx = Math.max(0.15, Math.abs(Math.cos(spin)));
  g.beginPath(); g.ellipse(x, y, r * sx, r, 0, 0, 7); g.fillStyle = GOLD; g.fill();
  g.lineWidth = Math.max(2, r * 0.16); g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.ellipse(x, y, r * sx * 0.62, r * 0.62, 0, 0, 7); g.strokeStyle = GOLD_D; g.lineWidth = Math.max(1.5, r * 0.1); g.stroke();
  g.beginPath(); g.ellipse(x - r * sx * 0.3, y - r * 0.35, r * sx * 0.16, r * 0.1, -0.6, 0, 7); g.fillStyle = "rgba(255,255,240,0.85)"; g.fill();
};
/** a stack of coins seen from slightly above */
export const coinStack = (g: CanvasRenderingContext2D, x: number, y: number, r: number, n: number) => {
  const h = r * 0.32;
  for (let i = 0; i < n; i++) {
    const yy = y - i * h, xx = x + Math.sin(i * 1.7) * r * 0.06;
    g.beginPath(); g.ellipse(xx, yy, r, r * 0.42, 0, 0, Math.PI); g.lineTo(xx - r, yy - h); g.ellipse(xx, yy - h, r, r * 0.42, 0, Math.PI, 0, true);
    g.closePath(); g.fillStyle = GOLD_D; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(2, r * 0.1); g.stroke();
    g.beginPath(); g.ellipse(xx, yy - h, r, r * 0.42, 0, 0, 7); g.fillStyle = GOLD; g.fill(); g.stroke();
  }
};

/** flying coins along an arc from a to b, n coins staggered over u in [0, 1] */
export const coinArc = (g: CanvasRenderingContext2D, a: P2, b: P2, u: number, n: number, r: number, h: number) => {
  for (let i = 0; i < n; i++) {
    const t = clamp01(u * 1.6 - i * 0.12);
    if (t <= 0 || t >= 1) continue;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - h * 4 * t * (1 - t);
    coin(g, x, y, r, t * 9 + i);
  }
};

/** cartoon 4-point sparkle */
export const sparkle = (g: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, col = "#fff6c8") => {
  const s = r * Math.sin(Math.PI * clamp01(t));
  if (s <= 0.5) return;
  g.save(); g.translate(x, y); g.rotate(t * 0.8);
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? s * 0.28 : s; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = Math.max(2, s * 0.09); g.strokeStyle = INK; g.stroke();
  g.restore();
};

/** bouncing question mark (popped in with overshoot at t0), size in px */
export const qmark = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, rot = 0) => {
  if (age < 0) return;
  const k = age < 6 ? easeOut(age / 6) * (1 + 0.25 * Math.sin((age / 6) * Math.PI)) : 1 + 0.04 * Math.sin(age * 0.35);
  g.save(); g.translate(x, y - Math.sin(age * 0.2) * size * 0.05); g.rotate(rot); g.scale(k, k);
  g.font = `900 ${size}px 'Montserrat', 'Arial Black', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = size * 0.16; g.strokeStyle = INK; g.strokeText("?", 0, 0);
  g.fillStyle = "#ffffff"; g.fillText("?", 0, 0);
  g.restore();
};

/** steam puffs out of a hot head */
export const steam = (g: CanvasRenderingContext2D, x: number, y: number, size: number, t: number) => {
  for (let i = 0; i < 4; i++) {
    const u = (t * 0.045 + i * 0.25) % 1, side = i % 2 ? 1 : -1;
    const px = x + side * size * (0.35 + 0.5 * u), py = y - size * 1.2 * u, r = size * (0.18 + 0.3 * u);
    g.globalAlpha = 0.85 * (1 - u);
    g.beginPath(); g.ellipse(px, py, r, r * 0.8, 0, 0, 7); g.fillStyle = "#ffffff"; g.fill();
    g.lineWidth = Math.max(2, size * 0.04); g.strokeStyle = "rgba(36,23,38,0.6)"; g.stroke();
  }
  g.globalAlpha = 1;
};

/** a moth fluttering out of an empty pocket */
export const moth = (g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) => {
  const flap = Math.abs(Math.sin(t * 1.6));
  g.save(); g.translate(x, y);
  for (const side of [-1, 1]) {
    g.beginPath(); g.ellipse(side * s * 0.45, -s * 0.1, s * 0.5, s * (0.2 + 0.3 * flap), side * 0.5, 0, 7);
    g.fillStyle = "#cbbfae"; g.fill(); g.lineWidth = Math.max(2, s * 0.1); g.strokeStyle = INK; g.stroke();
  }
  g.beginPath(); g.ellipse(0, 0, s * 0.14, s * 0.4, 0, 0, 7); g.fillStyle = "#8a7a68"; g.fill(); g.stroke();
  g.restore();
};

/** rain cloud over a sad head */
export const rainCloud = (g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) => {
  g.save(); g.translate(x, y + Math.sin(t * 0.15) * s * 0.03);
  g.strokeStyle = "#7fb2e6"; g.lineWidth = Math.max(2, s * 0.035); g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const u = ((t * 0.09 + i * 0.37) % 1), xx = -s * 0.45 + (i / 6) * s * 0.9;
    g.beginPath(); g.moveTo(xx, s * 0.2 + u * s * 0.9); g.lineTo(xx - s * 0.03, s * 0.2 + u * s * 0.9 + s * 0.12); g.stroke();
  }
  const blobs: [number, number, number][] = [[-0.35, 0.05, 0.26], [-0.05, -0.12, 0.34], [0.3, 0.0, 0.27], [0.0, 0.1, 0.3]];
  g.beginPath(); for (const [bx, by, r] of blobs) { g.moveTo(bx * s + r * s, by * s); g.ellipse(bx * s, by * s, r * s, r * s * 0.8, 0, 0, 7); }
  g.fillStyle = "#8f97ab"; g.fill();
  g.lineWidth = Math.max(3, s * 0.05); g.strokeStyle = INK; g.stroke();
  g.beginPath(); for (const [bx, by, r] of blobs) { g.moveTo(bx * s + r * s, by * s); g.ellipse(bx * s, by * s, r * s, r * s * 0.8, 0, 0, 7); }
  g.fillStyle = "#8f97ab"; g.fill();
  g.restore();
};

/** speed lines radiating from a point (punch moments) */
export const speedLines = (g: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, t: number, n = 14) => {
  const k = Math.sin(Math.PI * clamp01(t));
  if (k <= 0.01) return;
  g.save(); g.strokeStyle = `rgba(255,255,255,${0.85 * k})`; g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.37, w = 3 + (i % 3) * 2;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * (r0 + (r1 - r0) * k), y + Math.sin(a) * (r0 + (r1 - r0) * k)); g.stroke();
  }
  g.restore();
};

/** dimension arrow between two output points with a label at the middle; t = draw-on progress */
export const dimArrow = (g: CanvasRenderingContext2D, a: P2, b: P2, label: string, t: number, size = 54, off: P2 = [0, 0]) => {
  if (t <= 0) return;
  const u = easeOut(t), m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const A: P2 = [m[0] + (a[0] - m[0]) * u, m[1] + (a[1] - m[1]) * u], B: P2 = [m[0] + (b[0] - m[0]) * u, m[1] + (b[1] - m[1]) * u];
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  g.save(); g.lineCap = "round"; g.lineJoin = "round";
  for (const [w, c] of [[14, INK], [7, "#fff6dc"]] as const) {
    g.strokeStyle = c; g.lineWidth = w;
    g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke();
    for (const [P, d] of [[A, ang], [B, ang + Math.PI]] as const) {
      g.beginPath(); g.moveTo(P[0] + Math.cos(d + 0.5) * 26, P[1] + Math.sin(d + 0.5) * 26); g.lineTo(P[0], P[1]); g.lineTo(P[0] + Math.cos(d - 0.5) * 26, P[1] + Math.sin(d - 0.5) * 26); g.stroke();
    }
  }
  const k = clamp01((t - 0.35) / 0.4);
  if (k > 0) {
    g.translate(m[0] + off[0], m[1] + off[1]); g.scale(0.6 + 0.4 * easeOut(k), 0.6 + 0.4 * easeOut(k)); g.globalAlpha = k;
    g.font = `900 ${size}px 'Montserrat', 'Arial Black', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = size * 0.22; g.strokeStyle = INK; g.strokeText(label, 0, 0);
    g.fillStyle = "#ffe066"; g.fillText(label, 0, 0);
  }
  g.restore();
};

/** red rubber-stamp mark (e.g. "DOUBLE TAX") slammed on at age 0 */
export const stampMark = (g: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, age: number, rot = -0.18) => {
  if (age < 0) return;
  const k = age < 4 ? 1.8 - 0.8 * easeOut(age / 4) : 1;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k); g.globalAlpha = Math.min(1, 0.4 + age / 4);
  const h = w * 0.32;
  g.lineWidth = h * 0.12; g.strokeStyle = "#d42f2f"; g.lineJoin = "round";
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.font = `900 ${h * 0.62}px 'Montserrat', 'Arial Black', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#d42f2f"; g.fillText(text, 0, h * 0.04, w * 0.9);
  g.restore();
};

/** parchment scroll with a few ruled lines and a title (the law), drawn in output px centred at (x, y) */
export const scroll = (g: CanvasRenderingContext2D, x: number, y: number, w: number, title: string, lines: string[], t = 1, tear = 0) => {
  const h = w * 1.25 * clamp01(t);
  if (h < 4) return;
  g.save(); g.translate(x, y);
  const halves = tear > 0 ? [-1, 1] : [0];
  for (const side of halves) {
    g.save();
    if (side) { g.translate(side * tear * w * 0.5, tear * tear * w * 0.6); g.rotate(side * tear * 0.5); g.beginPath(); g.rect(side < 0 ? -w : 0, -h, w, 2 * h); g.clip(); }
    g.fillStyle = "#f3e2b8"; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fill(); g.stroke();
    for (const s of [-1, 1]) { // rolls
      g.beginPath(); g.ellipse(0, s * h / 2, w / 2 + 14, 22, 0, 0, 7); g.fillStyle = "#e3c98f"; g.fill(); g.stroke();
    }
    g.fillStyle = "#5a3424"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 ${w * 0.12}px 'Montserrat', 'Georgia', serif`; g.fillText(title, 0, -h / 2 + w * 0.2, w * 0.86);
    g.font = `700 ${w * 0.075}px 'Montserrat', 'Georgia', serif`;
    lines.forEach((l, i) => g.fillText(l, 0, -h / 2 + w * (0.42 + i * 0.14), w * 0.84));
    g.strokeStyle = "rgba(90,52,36,0.35)"; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const yy = -h / 2 + w * (0.42 + (lines.length + i) * 0.14); if (yy < h / 2 - 30) { g.beginPath(); g.moveTo(-w * 0.36, yy); g.lineTo(w * 0.36, yy); g.stroke(); } }
    g.restore();
  }
  g.restore();
};

/** confetti-like torn paper bits flying out */
export const paperBits = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number) => {
  if (age < 0 || age > 40) return;
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i - 7) * 0.22, v = s * (0.03 + 0.02 * ((i * 7) % 5));
    const px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 0.0022 * s * age * age;
    g.save(); g.translate(px, py); g.rotate(age * 0.3 + i);
    g.fillStyle = "#f3e2b8"; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.rect(-s * 0.03, -s * 0.02, s * 0.06, s * 0.04); g.fill(); g.stroke();
    g.restore();
  }
};

/** brick mould: an open wooden frame on the table (projected); k scales its height (the doubling) */
export const mould3 = (g: CanvasRenderingContext2D, v: View, at: V3, len: number, dep: number, h: number, ink = 3) => {
  const t = 0.035, W = "#a8724a";
  const [x, y, z] = at;
  box3(g, v, [x, y, z], [len, h, t], W, ink);               // back wall
  box3(g, v, [x, y, z], [t, h, dep], W, ink);               // left
  box3(g, v, [x + len - t, y, z], [t, h, dep], W, ink);     // right
  box3(g, v, [x, y, z + dep - t], [len, h, t], W, ink);     // front
  // handles
  box3(g, v, [x - 0.07, y + h * 0.4, z + dep / 2 - 0.02], [0.07, 0.03, 0.04], "#8a5a34", ink);
  box3(g, v, [x + len, y + h * 0.4, z + dep / 2 - 0.02], [0.07, 0.03, 0.04], "#8a5a34", ink);
};

/** excise stamp: wooden handle + iron block, hovering at height y above the table point */
export const stamp3 = (g: CanvasRenderingContext2D, v: View, at: V3, lift: number, ink = 3) => {
  const [x, y, z] = at;
  box3(g, v, [x - 0.1, y + lift, z - 0.06], [0.2, 0.06, 0.12], "#5d5f6a", ink);
  box3(g, v, [x - 0.025, y + lift + 0.06, z - 0.025], [0.05, 0.2, 0.05], "#a8724a", ink);
  const k = v.w([x, y + lift + 0.29, z]), r = v.ppm([x, y + lift + 0.29, z]) * 0.06;
  g.beginPath(); g.ellipse(k[0], k[1], r, r * 0.85, 0, 0, 7); g.fillStyle = "#8a5a34"; g.fill(); g.lineWidth = ink; g.strokeStyle = INK; g.stroke();
};

// ======================= grave-cage short props =======================
/** warm lantern light: additive pool around a lantern (output px) with a slow flicker */
export const lanternGlow = (g: CanvasRenderingContext2D, x: number, y: number, r: number, f: number, k = 1) => {
  const fl = 1 + 0.05 * Math.sin(f * 0.9) + 0.03 * Math.sin(f * 2.3);
  g.save(); g.globalCompositeOperation = "screen";
  const gr = g.createRadialGradient(x, y, 0, x, y, r * fl);
  gr.addColorStop(0, `rgba(255,190,100,${0.55 * k})`); gr.addColorStop(0.35, `rgba(255,150,70,${0.22 * k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  g.restore();
};
/** hand lantern in design units, hanging from the hand */
export const lantern2 = (p: Pen, x: number, y: number, s = 1) => {
  p.stroke([[x, y], [x, y + 18 * s]], 4 * s);
  p.poly([[x - 22 * s, y + 18 * s], [x + 22 * s, y + 18 * s], [x + 26 * s, y + 30 * s], [x - 26 * s, y + 30 * s]], "#3a3d48", 5 * s);
  p.poly([[x - 20 * s, y + 30 * s], [x + 20 * s, y + 30 * s], [x + 20 * s, y + 82 * s], [x - 20 * s, y + 82 * s]], "#ffd36b", 5 * s);
  p.ell(x, y + 56 * s, 7 * s, 13 * s, "#fff6c8", 0);
  p.poly([[x - 26 * s, y + 82 * s], [x + 26 * s, y + 82 * s], [x + 22 * s, y + 92 * s], [x - 22 * s, y + 92 * s]], "#3a3d48", 5 * s);
  p.dot(x, y, 9 * s);
};
/** spade in design units: handle from the hand, blade at angle a (radians, 0 = pointing down) */
export const shovel2 = (p: Pen, x: number, y: number, a: number, s = 1) => {
  const g = p.g; g.save(); g.translate(x, y); g.rotate(a);
  p.band([[0, -60 * s], [0, 150 * s]], "#9a6a40", 9 * s, 3 * s, "round");
  p.poly([[-26 * s, 150 * s], [26 * s, 150 * s], [22 * s, 215 * s], [0, 232 * s], [-22 * s, 215 * s]], "#8d949c", 5 * s);
  p.band([[-18 * s, -60 * s], [18 * s, -60 * s]], "#9a6a40", 8 * s, 3 * s, "round");
  g.restore(); p.dot(x, y, 10 * s);
};
/** a white shroud bundle lying along angle a, centred at (x, y), length L px (output space) */
export const bundle = (g: CanvasRenderingContext2D, x: number, y: number, L: number, a = 0) => {
  g.save(); g.translate(x, y); g.rotate(a);
  const h = L * 0.24;
  g.beginPath(); g.ellipse(0, 0, L / 2, h / 2, 0, 0, 7);
  g.fillStyle = "#efe9dc"; g.fill(); g.lineWidth = Math.max(3, L * 0.025); g.strokeStyle = INK; g.stroke();
  g.strokeStyle = "#a08a6a"; g.lineWidth = Math.max(2, L * 0.02);
  for (const u of [-0.3, 0.05, 0.32]) { g.beginPath(); g.moveTo(u * L, -h / 2 + 2); g.lineTo(u * L + h * 0.15, h / 2 - 2); g.stroke(); }
  g.restore();
};
/** padlock (output px): shackle drops shut as k goes 0 -> 1 */
export const padlock = (g: CanvasRenderingContext2D, x: number, y: number, s: number, k: number) => {
  g.save(); g.translate(x, y);
  const up = (1 - k) * s * 0.35;
  g.lineWidth = s * 0.16; g.strokeStyle = INK; g.beginPath(); g.arc(0, -s * 0.35 - up, s * 0.32, Math.PI, 0); g.lineTo(s * 0.32, -s * 0.1 - up * (1 - 0.5)); g.moveTo(-s * 0.32, -s * 0.35 - up); g.lineTo(-s * 0.32, -s * 0.1); g.stroke();
  g.lineWidth = s * 0.09; g.strokeStyle = "#9aa0aa"; g.stroke();
  g.beginPath(); g.roundRect(-s * 0.5, -s * 0.18, s, s * 0.78, s * 0.12); g.fillStyle = "#c9a23a"; g.fill(); g.lineWidth = s * 0.08; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(0, s * 0.12, s * 0.09, 0, 7); g.fillStyle = INK; g.fill(); g.fillRect(-s * 0.03, s * 0.12, s * 0.06, s * 0.2);
  g.restore();
};
/** wall calendar card (screen space) with a page flip: label = current page, prev = page flipping away (u 0..1) */
export const calendar = (g: CanvasRenderingContext2D, x: number, y: number, s: number, label: string, prev: string | null, u: number, k = 1) => {
  if (k <= 0) return;
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.06);
  const w = s, h = s * 1.15;
  const page = (txt: string, sy = 1) => {
    g.save(); g.scale(1, sy);
    g.beginPath(); g.roundRect(-w / 2, 0, w, h * 0.82, s * 0.05); g.fillStyle = "#fbf6e9"; g.fill(); g.lineWidth = s * 0.04; g.strokeStyle = INK; g.stroke();
    g.font = `900 ${s * (txt.length > 4 ? 0.2 : 0.3)}px 'Montserrat', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = INK; g.fillText(txt, 0, h * 0.45, w * 0.86);
    g.restore();
  };
  g.beginPath(); g.roundRect(-w / 2, -h * 0.2, w, h * 0.24, s * 0.05); g.fillStyle = "#c9373a"; g.fill(); g.lineWidth = s * 0.04; g.strokeStyle = INK; g.stroke();
  page(label);
  if (prev && u < 1) page(prev, Math.max(0.02, 1 - u)); // the old page folds up over the top
  for (const rx of [-0.25, 0.25]) { g.beginPath(); g.arc(rx * w, -h * 0.08, s * 0.05, 0, 7); g.fillStyle = "#e9e2d0"; g.fill(); g.stroke(); }
  g.restore();
};
/** newspaper slammed onto the frame (screen space) */
export const newspaper = (g: CanvasRenderingContext2D, x: number, y: number, w: number, age: number, lines: string[]) => {
  if (age < 0) return;
  const k = age < 5 ? 1.6 - 0.6 * easeOut(age / 5) : 1, rot = -0.08 + (age < 5 ? 0.25 * (1 - age / 5) : 0);
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  const h = w * 1.28;
  g.fillStyle = "rgba(20,10,30,0.25)"; g.fillRect(-w / 2 + 14, -h / 2 + 18, w, h);
  g.fillStyle = "#f1ead6"; g.fillRect(-w / 2, -h / 2, w, h); g.lineWidth = 6; g.strokeStyle = INK; g.strokeRect(-w / 2, -h / 2, w, h);
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#1c1820";
  g.font = `900 ${w * 0.075}px 'Georgia', serif`; g.fillText("THE EDINBURGH COURANT", 0, -h / 2 + w * 0.08, w * 0.9);
  g.fillRect(-w * 0.44, -h / 2 + w * 0.13, w * 0.88, 4);
  g.font = `900 ${w * 0.13}px 'Montserrat', sans-serif`;
  lines.forEach((l, i) => g.fillText(l, 0, -h / 2 + w * (0.27 + i * 0.15), w * 0.9));
  g.fillStyle = "rgba(30,24,32,0.35)";
  for (let i = 0; i < 9; i++) { g.fillRect(-w * 0.42, -h / 2 + w * (0.27 + lines.length * 0.15) + i * w * 0.055, i % 3 === 2 ? w * 0.5 : w * 0.84, w * 0.022); }
  g.restore();
};
/** items laid in the open coffin: corners = projected coffin floor [head-left, head-right, foot-right, foot-left] */
export const coffinItems = (g: CanvasRenderingContext2D, C: P2[], show: { suit: number; watch: number; shoes: number; ghost: number }) => {
  const [A, B, , D] = C;
  // affine map of a 100 x 300 design box (x across, y head -> foot) onto the coffin floor
  g.save(); g.setTransform((B[0] - A[0]) / 100, (B[1] - A[1]) / 100, (D[0] - A[0]) / 300, (D[1] - A[1]) / 300, A[0], A[1]);
  const ink = 3.2;
  if (show.ghost > 0) { // dotted outline where the body was
    g.save(); g.globalAlpha = show.ghost; g.setLineDash([9, 7]); g.lineWidth = 4; g.strokeStyle = "#ffffff";
    g.beginPath(); g.ellipse(50, 40, 22, 24, 0, 0, 7); g.stroke();
    g.beginPath(); g.roundRect(22, 64, 56, 110, 18); g.stroke();
    g.beginPath(); g.moveTo(38, 174); g.lineTo(36, 285); g.moveTo(62, 174); g.lineTo(64, 285); g.stroke();
    g.restore();
  }
  if (show.suit > 0) {
    g.globalAlpha = show.suit;
    g.beginPath(); g.moveTo(18, 70); g.lineTo(82, 70); g.lineTo(88, 170); g.lineTo(12, 170); g.closePath(); g.fillStyle = "#2c3140"; g.fill(); g.lineWidth = ink; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(40, 70); g.lineTo(50, 110); g.lineTo(60, 70); g.fillStyle = "#f1ece0"; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(24, 172); g.lineTo(76, 172); g.lineTo(72, 262); g.lineTo(54, 262); g.lineTo(50, 200); g.lineTo(46, 262); g.lineTo(28, 262); g.closePath(); g.fillStyle = "#3b3f52"; g.fill(); g.stroke();
    g.globalAlpha = 1;
  }
  if (show.shoes > 0) {
    g.globalAlpha = show.shoes;
    for (const sx of [32, 68]) { g.beginPath(); g.ellipse(sx, 280, 11, 17, 0, 0, 7); g.fillStyle = "#1e1a20"; g.fill(); g.lineWidth = ink; g.strokeStyle = INK; g.stroke(); }
    g.globalAlpha = 1;
  }
  if (show.watch > 0) {
    g.globalAlpha = show.watch;
    g.strokeStyle = GOLD_D; g.lineWidth = 3; g.beginPath(); g.moveTo(66, 110); g.quadraticCurveTo(76, 126, 64, 140); g.stroke();
    g.beginPath(); g.arc(62, 146, 10, 0, 7); g.fillStyle = GOLD; g.fill(); g.lineWidth = ink; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(62, 146, 6, 0, 7); g.fillStyle = "#fffbe8"; g.fill();
    g.globalAlpha = 1;
  }
  g.restore();
};
/** "TO LET" board on a stick, design units, held at the hand */
export const toLet = (p: Pen, x: number, y: number) => {
  p.band([[x, y + 20], [x, y - 150]], "#9a6a40", 8, 3, "round");
  const g = p.g;
  p.poly([[x - 85, y - 250], [x + 85, y - 250], [x + 85, y - 150], [x - 85, y - 150]], "#f3e2b8", 6);
  g.font = "900 48px 'Montserrat', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#c9373a"; g.fillText("TO LET", x, y - 198);
  p.dot(x, y, 10);
};
/** a modern phone held up (design units) */
export const phone2 = (p: Pen, x: number, y: number) => {
  p.poly([[x - 26, y - 70], [x + 26, y - 70], [x + 26, y + 20], [x - 26, y + 20]], "#26232c", 5);
  p.poly([[x - 19, y - 62], [x + 19, y - 62], [x + 19, y + 10], [x - 19, y + 10]], "#7fb2e6", 0);
  p.dot(x, y, 10);
};
/** vampire's high cape collar (design units around the neck at (cx, cy)) */
export const vampCollar = (p: Pen, cx: number, cy: number, HH: number) => {
  for (const s of [-1, 1]) p.poly([[cx + s * 0.18 * HH, cy + 0.05 * HH], [cx + s * 0.58 * HH, cy - 0.62 * HH], [cx + s * 0.42 * HH, cy + 0.12 * HH]], "#b0202c", 6);
};
/** hot sparks flying from a point (output px) */
export const sparks = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number) => {
  if (age < 0 || age > 18) return;
  g.save(); g.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i - 6) * 0.26 + Math.sin(i * 7.3) * 0.15, v = s * (0.05 + 0.03 * ((i * 5) % 4));
    const t = age, px = x + Math.cos(a) * v * t, py = y + Math.sin(a) * v * t + 0.004 * s * t * t;
    g.strokeStyle = `rgba(255,${180 + (i % 3) * 25},80,${1 - age / 18})`; g.lineWidth = Math.max(2, s * 0.012);
    g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * v * 1.5, py - Math.sin(a) * v * 1.5); g.stroke();
  }
  g.restore();
};
/** exclamation mark (like qmark) */
export const emark = (g: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, rot = 0) => {
  if (age < 0) return;
  const k = age < 6 ? easeOut(age / 6) * (1 + 0.25 * Math.sin((age / 6) * Math.PI)) : 1;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.font = `900 ${size}px 'Montserrat', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = size * 0.16; g.strokeStyle = INK; g.strokeText("!", 0, 0); g.fillStyle = "#ffe066"; g.fillText("!", 0, 0);
  g.restore();
};
