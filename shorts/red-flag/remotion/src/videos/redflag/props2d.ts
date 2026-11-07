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

// ======================= shared effect props (output px) =======================
/** satisfying ring waves: n crisp rings expanding from (x, y), born at age 0, fading as they grow; k = strength */
export const ringWaves = (g: CanvasRenderingContext2D, x: number, y: number, r0: number, age: number, k = 1, n = 3, col = "255,248,220") => {
  if (age < 0 || age > 30) return;
  g.save(); g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = age - i * 4; if (a < 0) continue;
    const u = Math.min(1, a / 22), r = r0 * (0.35 + 2.4 * easeOut(u) * k), al = (1 - u) ** 1.4;
    g.globalAlpha = al; g.lineWidth = Math.max(2, r0 * 0.12 * (1 - u * 0.7));
    g.strokeStyle = `rgba(${col},1)`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
};
/** dull puff (the THUNK): small grey dust that dies quickly */
export const dullPuff = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number) => {
  if (age < 0 || age > 14) return;
  const u = age / 14;
  g.save(); g.globalAlpha = (1 - u) * 0.85;
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, d = s * (0.1 + 0.35 * easeOut(u)); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, s * (0.16 + 0.08 * (i % 2)) * (1 - 0.4 * u), 0, 7); g.fillStyle = "#9a9590"; g.fill(); }
  g.restore();
};

// ======================= red-flag props (drawn in metres: origin = ground point in output px, m = px per metre) =======================
/** run fn in a local frame: x forward (dir = +1 faces screen-right, -1 screen-left), y up, units = metres */
/** optional perspective axes for the next drawings (wide shot): screen vectors of 1 m forward and 1 m up */
export const AX: { ex: P2 | null; ey: P2 | null } = { ex: null, ey: null };
export const local = (g: CanvasRenderingContext2D, o: P2, m: number, dir: number, fn: () => void, rot = 0) => {
  g.save(); g.translate(o[0], o[1]);
  if (AX.ex && AX.ey) g.transform(AX.ex[0], AX.ex[1], AX.ey[0], AX.ey[1], 0, 0); else g.scale(m * dir, -m);
  if (rot) g.rotate(rot); g.lineJoin = "round"; g.lineCap = "round"; fn(); g.restore();
};
const inkW = 0.035;
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, ink = inkW) => {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (ink) { g.lineWidth = ink; g.strokeStyle = INK; g.stroke(); }
};
const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ink = inkW) => {
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (ink) { g.lineWidth = ink; g.strokeStyle = INK; g.stroke(); }
};
/** a spoked wheel in local metres; strakes = traction-engine tread bars on the tyre */
export const spokeWheel = (g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, o: { spokes?: number; hub?: string; tyre?: string; strakes?: boolean; thin?: boolean; blur?: number } = {}) => {
  const n = o.spokes ?? 10;
  g.save(); g.translate(x, y);
  disc(g, 0, 0, r, o.tyre ?? "#2b2830");
  disc(g, 0, 0, r * (o.thin ? 0.92 : 0.84), o.thin ? "rgba(0,0,0,0)" : "#3a3540", o.thin ? 0 : inkW * 0.7);
  g.rotate(-ang);
  if (o.strakes) { g.strokeStyle = "#5d5866"; g.lineWidth = r * 0.06; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); g.lineTo(Math.cos(a + 0.12) * r * 0.99, Math.sin(a + 0.12) * r * 0.99); g.stroke(); } }
  const blur = o.blur ?? 0;
  if (blur > 0.5) { g.globalAlpha = 0.45; disc(g, 0, 0, r * 0.8, o.hub ?? "#b8322c", 0); g.globalAlpha = 1; }
  else { g.strokeStyle = o.hub ?? "#b8322c"; g.lineWidth = o.thin ? r * 0.035 : r * 0.09; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84); g.stroke(); } }
  disc(g, 0, 0, r * 0.2, o.hub ?? "#b8322c"); disc(g, 0, 0, r * 0.08, "#e8c45a", inkW * 0.6);
  g.restore();
};
/** steam road engine (traction engine). dist = metres travelled (drives wheel spin + bounce) */
export const roadEngine = (g: CanvasRenderingContext2D, o: P2, m: number, dir: number, dist: number, f: number) => {
  local(g, o, m, dir, () => {
    const bob = Math.abs(Math.sin(dist * 2.2)) * 0.03;
    // rear (big) and front wheels
    spokeWheel(g, 2.9, 0.55, 0.55, dist / 0.55, { spokes: 8, strakes: true });
    g.save(); g.translate(0, bob);
    // canopy posts + roof
    for (const x of [-0.55, 3.0]) rr(g, x - 0.04, 1.2, 0.08, 2.05, 0.02, "#2b2830");
    rr(g, -0.8, 3.2, 4.1, 0.12, 0.05, "#2f6a43");
    // boiler + smokebox + bands
    rr(g, 0.1, 1.05, 2.95, 0.85, 0.42, "#2f6a43");
    for (const x of [0.8, 1.6, 2.4]) { g.fillStyle = "#e8c45a"; g.fillRect(x, 1.07, 0.07, 0.81); }
    rr(g, 2.75, 1.0, 0.42, 0.95, 0.2, "#2b2830");
    // chimney with a flared cap
    rr(g, 2.83, 1.85, 0.2, 1.2, 0.03, "#2b2830");
    g.beginPath(); g.moveTo(2.76, 3.0); g.lineTo(3.1, 3.0); g.lineTo(3.05, 3.12); g.lineTo(2.81, 3.12); g.closePath(); g.fillStyle = "#e8c45a"; g.fill(); g.lineWidth = inkW; g.strokeStyle = INK; g.stroke();
    // firebox / footplate at the back
    rr(g, -0.7, 0.7, 0.95, 1.25, 0.08, "#24452f");
    rr(g, -0.85, 0.62, 1.2, 0.12, 0.03, "#5a3b2a");
    // flywheel (spinning) + crank
    spokeWheel(g, 0.75, 2.15, 0.42, dist * 3.1, { spokes: 6, hub: "#c9ccd2", tyre: "#3a3540" });
    g.restore();
    spokeWheel(g, 0, 0.85, 0.85, dist / 0.85, { spokes: 12, strakes: true });
  });
};
/** the chimney top of the road engine in output px (for steam puffs) */
export const engineChimney = (o: P2, m: number, dir: number, dist: number): P2 => [o[0] + dir * 2.93 * m, o[1] - (3.15 + Math.abs(Math.sin(dist * 2.2)) * 0.03) * m];
/** an 1890s motor car (Benz Velo-like): bench seat, wire wheels, tiller, brass lamp, bulb horn */
export const veteranCar = (g: CanvasRenderingContext2D, o: P2, m: number, dir: number, dist: number, f: number, col = "#8c2f39", honk = 0) => {
  local(g, o, m, dir, () => {
    const bob = Math.abs(Math.sin(dist * 4.5)) * 0.025;
    spokeWheel(g, 0, 0.62, 0.62, dist / 0.62, { spokes: 16, thin: true, hub: "#c9ccd2", tyre: "#2b2830" });
    spokeWheel(g, 1.65, 0.45, 0.45, dist / 0.45, { spokes: 14, thin: true, hub: "#c9ccd2", tyre: "#2b2830" });
    g.save(); g.translate(0, bob);
    // chassis rail + springs
    rr(g, -0.35, 0.58, 2.1, 0.07, 0.03, "#2b2830");
    // body tub
    g.beginPath(); g.moveTo(-0.4, 0.66); g.lineTo(1.25, 0.66); g.quadraticCurveTo(1.55, 0.7, 1.6, 1.05); g.lineTo(1.25, 1.02); g.lineTo(-0.35, 1.02); g.closePath();
    g.fillStyle = col; g.fill(); g.lineWidth = inkW; g.strokeStyle = INK; g.stroke();
    g.strokeStyle = "#e8c45a"; g.lineWidth = 0.025; g.beginPath(); g.moveTo(-0.3, 0.84); g.lineTo(1.25, 0.84); g.stroke();
    // bench seat + back
    rr(g, -0.32, 1.0, 0.75, 0.12, 0.04, "#2b2830");
    rr(g, -0.36, 1.0, 0.12, 0.55, 0.05, "#2b2830");
    // tiller + handle
    g.strokeStyle = INK; g.lineWidth = 0.05; g.beginPath(); g.moveTo(1.0, 1.02); g.lineTo(0.8, 1.42); g.lineTo(0.62, 1.42); g.stroke();
    // brass lamp + bulb horn
    disc(g, 1.5, 1.18, 0.09, "#e8c45a"); disc(g, 1.55, 1.18, 0.04, "#fff6c8", 0);
    g.strokeStyle = "#e8c45a"; g.lineWidth = 0.035; g.beginPath(); g.moveTo(0.95, 1.2); g.quadraticCurveTo(1.2, 1.32, 1.36, 1.3); g.stroke();
    g.beginPath(); g.moveTo(1.34, 1.27); g.lineTo(1.56, 1.17); g.lineTo(1.56, 1.47); g.lineTo(1.34, 1.33); g.closePath(); g.fillStyle = "#e8c45a"; g.fill(); g.lineWidth = inkW * 0.7; g.strokeStyle = INK; g.stroke();
    g.save(); g.translate(0.9, 1.22); g.scale(1 + 0.25 * honk, 1 - 0.35 * honk); g.beginPath(); g.ellipse(0, 0, 0.1, 0.075, 0, 0, 7); g.fillStyle = "#2b2830"; g.fill(); g.restore();
    g.restore();
  });
};
/** exhaust / steam puff that grows and fades (age in frames) */
export const puff = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, life = 26, col = "#f4f4f6", drift: P2 = [0, -1]) => {
  if (age < 0 || age > life) return;
  const u = age / life, r = s * (0.35 + 0.9 * easeOut(u));
  g.save(); g.globalAlpha = 0.9 * (1 - u) ** 1.3;
  g.beginPath(); g.arc(x + drift[0] * s * 1.6 * u, y + drift[1] * s * 2.2 * u, r, 0, 7); g.fillStyle = col; g.fill();
  g.lineWidth = Math.max(2, s * 0.05); g.strokeStyle = "rgba(36,23,38,0.3)"; g.stroke(); g.restore();
};
/** a red flag on a pole from hand (output px): cloth trails opposite to `dir` and waves with a travelling wave */
export const redFlag = (g: CanvasRenderingContext2D, hand: P2, m: number, dir: number, f: number, o: { lift?: number; tear?: number; wave?: number; col?: string } = {}) => {
  const top: P2 = [hand[0] + dir * 0.08 * m, hand[1] - 1.25 * m * (o.lift ?? 1)];
  g.save(); g.lineCap = "round";
  g.strokeStyle = INK; g.lineWidth = Math.max(3, 0.05 * m); g.beginPath(); g.moveTo(hand[0] - dir * 0.03 * m, hand[1] + 0.2 * m); g.lineTo(top[0], top[1]); g.stroke();
  g.strokeStyle = "#a8724a"; g.lineWidth = Math.max(2, 0.03 * m); g.stroke();
  const W = 0.62 * m, H = 0.42 * m, wv = o.wave ?? 1, n = 14;
  const pt = (u: number, v: number): P2 => { // u along the cloth (0 = pole), v down (0..1)
    const ph = f * 0.42 - u * 5.2, amp = (0.04 + 0.1 * u) * m * wv;
    return [top[0] - dir * u * W + Math.cos(ph) * amp * 0.25 * -dir, top[1] + v * H + Math.sin(ph) * amp + u * u * 0.06 * m];
  };
  const halves = o.tear ?? 0;
  for (const [u0, u1, dx, dy, rot] of (halves > 0 ? [[0, 0.5, -1, -1, -1], [0.5, 1, 1, 1, 1]] : [[0, 1, 0, 0, 0]]) as [number, number, number, number, number][]) {
    g.save();
    if (halves > 0) { const c = pt((u0 + u1) / 2, 0.5); g.translate(c[0] + dx * halves * 0.6 * m, c[1] - halves * 0.4 * m + dy * halves * halves * 0.2 * m); g.rotate(rot * halves * 0.9); g.translate(-c[0], -c[1]); }
    g.beginPath();
    for (let i = 0; i <= n; i++) { const p = pt(u0 + (u1 - u0) * (i / n), 0); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    for (let i = n; i >= 0; i--) { const p = pt(u0 + (u1 - u0) * (i / n), 1); g.lineTo(p[0], p[1]); }
    g.closePath(); g.fillStyle = o.col ?? "#d42f2f"; g.fill(); g.lineWidth = Math.max(2.5, 0.03 * m); g.strokeStyle = INK; g.stroke();
    // shading in the folds
    g.save(); g.clip(); for (let i = 0; i < n; i++) { const u = u0 + (u1 - u0) * (i / n), ph = f * 0.42 - u * 5.2; if (Math.sin(ph) > 0.3) { const a = pt(u, 0), b = pt(u, 1); g.strokeStyle = "rgba(90,10,20,0.25)"; g.lineWidth = W / n * 1.4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } } g.restore();
    g.restore();
  }
  g.restore();
};
/** cartoon horse in side view (local metres, facing +x). gait 0..1 phase, rear 0..1 (rears up on the hind legs) */
export const horse = (g: CanvasRenderingContext2D, o: P2, m: number, dir: number, gait: number, rear: number, f: number) => {
  local(g, o, m, dir, () => {
    const body = "#9a6440", dark = "#5a3826";
    g.save(); g.translate(-0.5, 0.95); g.rotate(rear * 0.75); g.translate(0.5, -0.95);
    const legs: [number, number][] = [[-0.55, 0], [-0.35, Math.PI], [0.55, Math.PI * 0.5], [0.75, Math.PI * 1.5]];
    legs.forEach(([x, ph], i) => {
      const a = Math.sin(gait * Math.PI * 2 + ph) * 0.35 + (i >= 2 ? rear * 1.0 : 0), knee = i >= 2 ? rear * 1.3 : 0;
      const k: P2 = [x + Math.sin(a) * 0.42, 0.98 - Math.cos(a) * 0.42], h: P2 = [k[0] + Math.sin(a - knee) * 0.48, k[1] - Math.cos(a - knee) * 0.48];
      g.strokeStyle = INK; g.lineWidth = 0.17; g.beginPath(); g.moveTo(x, 1.05); g.lineTo(k[0], k[1]); g.lineTo(h[0], h[1]); g.stroke();
      g.strokeStyle = i % 2 ? dark : body; g.lineWidth = 0.11; g.stroke();
      disc(g, h[0], h[1] + 0.02, 0.07, "#2b2830", inkW * 0.6);
    });
    // tail
    g.strokeStyle = dark; g.lineWidth = 0.12; g.beginPath(); g.moveTo(-0.85, 1.4); g.quadraticCurveTo(-1.15, 1.3 + Math.sin(f * 0.3) * 0.08, -1.1, 0.85); g.stroke();
    // body + neck + head
    g.beginPath(); g.ellipse(0.05, 1.25, 0.95, 0.38, 0, 0, 7); g.fillStyle = body; g.fill(); g.lineWidth = inkW; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(0.6, 1.3); g.lineTo(0.95, 2.0); g.lineTo(1.25, 1.95); g.lineTo(0.95, 1.2); g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(1.12, 2.0); g.rotate(-0.5 - rear * 0.4);
    g.beginPath(); g.ellipse(0.22, 0, 0.36, 0.17, 0, 0, 7); g.fillStyle = body; g.fill(); g.stroke();
    disc(g, 0.08, 0.06, 0.05, "#fff", inkW * 0.5); disc(g, 0.09 + rear * 0.01, 0.06, 0.025, INK, 0);
    g.beginPath(); g.moveTo(-0.05, 0.12); g.lineTo(0.0, 0.3); g.lineTo(0.08, 0.13); g.fillStyle = body; g.fill(); g.stroke();
    if (rear > 0.3) { g.beginPath(); g.arc(0.5, -0.05, 0.05, 0, 7); g.fillStyle = INK; g.fill(); }
    g.restore();
    g.strokeStyle = dark; g.lineWidth = 0.1; g.beginPath(); g.moveTo(0.72, 1.55); g.quadraticCurveTo(0.82, 1.95, 1.0, 2.12); g.stroke();
    g.restore();
  });
};
/** a two-wheel hay cart (local metres, shafts toward +x); tip 0..1 rolls it over into the ditch */
export const hayCart = (g: CanvasRenderingContext2D, o: P2, m: number, dir: number, dist: number, tip: number) => {
  local(g, o, m, dir, () => {
    g.save(); g.translate(0.6, 0); g.rotate(-tip * 1.2); g.translate(-0.6, tip * -0.4);
    rr(g, -1.0, 0.75, 1.9, 0.35, 0.05, "#a8724a");
    g.beginPath(); g.ellipse(-0.05, 1.25, 0.95, 0.38, 0, Math.PI, 0, true); g.fillStyle = "#e8c45a"; g.fill(); g.lineWidth = inkW; g.strokeStyle = INK; g.stroke();
    g.strokeStyle = "#5a3b2a"; g.lineWidth = 0.06; g.beginPath(); g.moveTo(0.85, 0.95); g.lineTo(1.7, 1.0); g.stroke();
    spokeWheel(g, -0.1, 0.55, 0.55, dist / 0.55, { spokes: 8, hub: "#a8724a", tyre: "#5a3b2a" });
    g.restore();
  });
};
/** semicircular speed dial (output px): needle at `mph` (0..20), label */
export const speedDial = (g: CanvasRenderingContext2D, x: number, y: number, r: number, mph: number, k: number, label = "MPH") => {
  if (k <= 0) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.closePath(); g.fillStyle = "#f6f1e3"; g.fill(); g.lineWidth = r * 0.06; g.strokeStyle = INK; g.stroke();
  for (let i = 0; i <= 20; i++) { const a = Math.PI + (i / 20) * Math.PI, L = i % 5 ? 0.1 : 0.2; g.lineWidth = r * (i % 5 ? 0.015 : 0.03); g.beginPath(); g.moveTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); g.lineTo(Math.cos(a) * r * (0.92 - L), Math.sin(a) * r * (0.92 - L)); g.stroke(); }
  g.fillStyle = INK; g.font = `900 ${r * 0.16}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle";
  for (const v of [0, 5, 10, 15, 20]) { const a = Math.PI + (v / 20) * Math.PI; g.fillText(String(v), Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); }
  // red zone above 4
  g.beginPath(); g.arc(0, 0, r * 0.97, Math.PI + (4 / 20) * Math.PI, 2 * Math.PI); g.strokeStyle = "rgba(212,47,47,0.35)"; g.lineWidth = r * 0.08; g.stroke();
  const a = Math.PI + Math.max(0, Math.min(20, mph)) / 20 * Math.PI;
  g.strokeStyle = "#d42f2f"; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.08, 0, 7); g.fillStyle = INK; g.fill();
  g.font = `900 ${r * 0.2}px 'Montserrat'`; g.fillStyle = INK; g.fillText(label, 0, -r * 0.28);
  g.restore();
};
/** falling autumn leaves across the frame (output px) */
export const leaves = (g: CanvasRenderingContext2D, f: number, n = 26, k = 1) => {
  if (k <= 0) return;
  g.save(); g.globalAlpha = k;
  for (let i = 0; i < n; i++) {
    const h1 = Math.sin(i * 91.7) * 0.5 + 0.5, h2 = Math.sin(i * 37.3) * 0.5 + 0.5;
    const y = ((f * (2.2 + h1 * 2) + h2 * 2000) % 2100) - 90, x = (h1 * 1200 + Math.sin(f * 0.04 + i) * 70 + f * 0.6) % 1180 - 50;
    g.save(); g.translate(x, y); g.rotate(f * 0.05 * (h2 - 0.5) * 2 + i); g.scale(1, Math.cos(f * 0.08 + i));
    g.beginPath(); g.ellipse(0, 0, 16 + h2 * 8, 8 + h1 * 4, 0, 0, 7); g.fillStyle = ["#e0782f", "#d9a441", "#c2452f", "#e89a3a"][i % 4]; g.fill();
    g.lineWidth = 2; g.strokeStyle = "rgba(36,23,38,0.6)"; g.stroke(); g.restore();
  }
  g.restore();
};
/** a finger-post signpost (output px base, height h px) */
export const signpost = (g: CanvasRenderingContext2D, x: number, y: number, h: number, text: string, k = 1) => {
  if (k <= 0) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = "#f1ece0"; g.strokeStyle = INK; g.lineWidth = h * 0.02;
  g.beginPath(); g.rect(-h * 0.03, -h, h * 0.06, h); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-h * 0.05, -h * 0.92); g.lineTo(h * 0.6, -h * 0.92); g.lineTo(h * 0.7, -h * 0.83); g.lineTo(h * 0.6, -h * 0.74); g.lineTo(-h * 0.05, -h * 0.74); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK; g.font = `900 ${h * 0.1}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, h * 0.3, -h * 0.83, h * 0.6);
  g.restore();
};
/** dust cloud kicked up behind a fast car (output px) */
export const dust = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k: number, dir: number) => {
  if (k <= 0) return;
  for (let i = 0; i < 8; i++) { const age = (f * 1.0 + i * 4) % 30; puff(g, x - dir * (age * s * 0.06), y - s * 0.1, s * (0.5 + 0.1 * (i % 3)) * k, age, 30, "#e1cfa8", [0, -0.3]); }
};
/** billowing steam cloud (soft white puffs), coverage k 0..1 across the frame from side dir (-1 from left) */
export const steamWipe = (g: CanvasRenderingContext2D, k: number, f: number, dir = -1) => {
  if (k <= 0) return;
  g.save();
  for (let i = 0; i < 26; i++) {
    const row = i % 7, col = Math.floor(i / 7);
    const bx = dir < 0 ? -300 + k * 1500 - col * 330 : 1380 - k * 1500 + col * 330;
    const x = bx + Math.sin(i * 3.1) * 120, y = 120 + row * 290 + Math.sin(f * 0.05 + i) * 30;
    const r = 260 + (i % 4) * 60;
    const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    gr.addColorStop(0, `rgba(250,250,252,${0.97 * Math.min(1, k * 1.6)})`); gr.addColorStop(0.7, `rgba(236,238,244,${0.85 * Math.min(1, k * 1.6)})`); gr.addColorStop(1, "rgba(236,238,244,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  if (k > 0.55) { g.fillStyle = `rgba(246,247,250,${Math.min(1, (k - 0.55) / 0.3)})`; g.fillRect(0, 0, 1080, 1920); }
  g.restore();
};
