// Painted textures for the station set (Canvas2D, cached through the skill's ctex). Seams are painted in as dark
// tints, glass is a flat dark with one painted glare, nothing carries text (project rule: no labels).
import { ctex, jit } from "./paint";

const SEAM = "rgba(46,36,48,0.55)";
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y); g.closePath();
};
const glass = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, frame = 9) => {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, "#5b86b8"); gr.addColorStop(0.45, "#2f4a72"); gr.addColorStop(1, "#1d2a44");
  rr(g, x, y, w, h, r); g.fillStyle = gr; g.fill();
  g.save(); rr(g, x, y, w, h, r); g.clip();
  g.fillStyle = "rgba(255,255,255,0.2)";
  g.beginPath(); g.moveTo(x + w * 0.12, y + h); g.lineTo(x + w * 0.42, y); g.lineTo(x + w * 0.56, y); g.lineTo(x + w * 0.26, y + h); g.closePath(); g.fill();
  g.restore();
  rr(g, x, y, w, h, r); g.lineWidth = frame; g.strokeStyle = "#1c1a24"; g.stroke();
};

/** platform paving: 4 x 4 slabs per image (image = 2.4 m) */
export const platformTex = () => ctex("stPlatform", 1024, 1024, (g, r) => {
  const n = 4, s = 1024 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = jit(r, "#d2c6b4", 0.045, 3, 0.1); g.fillRect(i * s, j * s, s, s);
    for (let k = 0; k < 22; k++) {
      g.fillStyle = `rgba(96,84,80,${(0.05 + 0.08 * r()).toFixed(3)})`;
      g.beginPath(); g.ellipse(i * s + r() * s, j * s + r() * s, 2 + 5 * r(), 1.5 + 3 * r(), r() * 3, 0, 6.3); g.fill();
    }
  }
  g.strokeStyle = "#8f8375"; g.lineWidth = 7;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(1024, i * s); g.stroke(); }
});

/** yellow tactile strip: raised dots, one image = 0.4 m */
export const tactileTex = () => ctex("stTactile", 256, 256, (g) => {
  g.fillStyle = "#f2bd2a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    g.beginPath(); g.arc(32 + i * 64, 32 + j * 64, 17, 0, 6.3); g.fillStyle = "#d59b17"; g.fill();
    g.beginPath(); g.arc(29 + i * 64, 28 + j * 64, 12, 0, 6.3); g.fillStyle = "#ffd75a"; g.fill();
  }
  g.strokeStyle = "#a9770f"; g.lineWidth = 6; g.strokeRect(0, 0, 256, 256);
});

export const ballastTex = () => ctex("stBallast", 1024, 1024, (g, r) => {
  g.fillStyle = "#77665c"; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 1500; k++) {
    g.fillStyle = jit(r, ["#93806f", "#6a5a52", "#a39182", "#80705f"][k % 4], 0.12, 4, 0.2);
    g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 9 + 13 * r(), 7 + 9 * r(), r() * 3, 0, 6.3); g.fill();
  }
});

/** concrete wall / platform face, soft vertical streaks */
export const concreteTex = () => ctex("stConcrete", 512, 512, (g, r) => {
  g.fillStyle = "#b4aaa0"; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(70,62,70,${(0.03 + 0.05 * r()).toFixed(3)})`; g.fillRect(r() * 512, 0, 4 + 22 * r(), 512); }
  g.fillStyle = "rgba(60,50,60,0.25)"; g.fillRect(0, 0, 512, 16);
});

/** one 20 m car side, 2048 x 304 (body 2.85 m tall): cream body, orange belt, doors, windows, dark skirt */
export const trainSideTex = () => ctex("stTrainSide", 2048, 304, (g) => {
  g.fillStyle = "#f4eddc"; g.fillRect(0, 0, 2048, 304);
  g.fillStyle = "#dcd3bf"; g.fillRect(0, 0, 2048, 26);                      // roof shoulder
  g.fillStyle = "#ec7a2f"; g.fillRect(0, 196, 2048, 46);                    // belt
  g.fillStyle = "#2d6b56"; g.fillRect(0, 246, 2048, 9);
  g.fillStyle = "#33333f"; g.fillRect(0, 280, 2048, 24);                    // skirt
  const doors = [150, 660, 1170, 1680];
  for (const x of doors) {
    g.fillStyle = "#fbf6ea"; g.fillRect(x, 38, 190, 240);
    glass(g, x + 16, 58, 70, 110, 8, 6); glass(g, x + 104, 58, 70, 110, 8, 6);
    g.strokeStyle = SEAM; g.lineWidth = 6; g.strokeRect(x, 38, 190, 240);
    g.beginPath(); g.moveTo(x + 95, 38); g.lineTo(x + 95, 278); g.stroke();
    g.fillStyle = "#ec7a2f"; g.fillRect(x + 3, 196, 184, 46);
  }
  const bays = [[20, 110], [360, 280], [870, 280], [1380, 280], [1890, 140]];
  for (const [x, w] of bays) glass(g, x, 62, w, 104, 12, 8);
  g.strokeStyle = SEAM; g.lineWidth = 3;
  for (const y of [30, 190, 262]) { g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke(); }
});

/** cab end, 512 x 512 for 2.94 x 2.85 m: wide windscreen, blank amber display, lamp housings, orange belt */
export const trainFrontTex = () => ctex("stTrainFront", 512, 512, (g) => {
  g.fillStyle = "#f4eddc"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#dcd3bf"; g.fillRect(0, 0, 512, 46);
  g.fillStyle = "#ec7a2f"; g.fillRect(0, 300, 512, 120);
  g.fillStyle = "#2d6b56"; g.fillRect(0, 424, 512, 12);
  g.fillStyle = "#33333f"; g.fillRect(0, 462, 512, 50);
  glass(g, 36, 78, 440, 196, 26, 12);
  g.strokeStyle = "#1c1a24"; g.lineWidth = 9; g.beginPath(); g.moveTo(256, 78); g.lineTo(256, 274); g.stroke();
  rr(g, 166, 16, 180, 44, 8); g.fillStyle = "#1c1a24"; g.fill();           // display, no text
  g.fillStyle = "#f5a637"; for (let i = 0; i < 5; i++) g.fillRect(180 + i * 32, 28, 22, 20);
  for (const x of [92, 420]) {                                              // lamp housings (the lit discs are 3D)
    rr(g, x - 52, 332, 104, 62, 18); g.fillStyle = "#2a2a36"; g.fill();
    g.beginPath(); g.arc(x + (x < 256 ? 26 : -26), 363, 13, 0, 6.3); g.fillStyle = "#d8362f"; g.fill();
  }
  g.strokeStyle = SEAM; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, 296); g.lineTo(512, 296); g.stroke();
  g.beginPath(); g.moveTo(256, 300); g.lineTo(256, 462); g.stroke();
});

/** city block facade: 6 x 8 windows per image (image = 18 x 24 m) */
export const towerTex = (key: string, wall: string, win: string, lit: string) => ctex("stTower" + key, 512, 512, (g, r) => {
  g.fillStyle = wall; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) {
    g.fillStyle = r() < 0.14 ? lit : jit(r, win, 0.1, 3, 0.1);
    g.fillRect(14 + i * 85.3, 12 + j * 64, 58, 38);
    g.strokeStyle = "rgba(40,32,48,0.6)"; g.lineWidth = 4; g.strokeRect(14 + i * 85.3, 12 + j * 64, 58, 38);
  }
  g.fillStyle = "rgba(40,32,48,0.18)"; for (let j = 0; j < 8; j++) g.fillRect(0, 56 + j * 64, 512, 5);
});

/** far platform back wall: cream panels with a blue band, repeat = 4 m */
export const wallTex = () => ctex("stWall", 512, 512, (g) => {
  g.fillStyle = "#efe5d0"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#3f73b8"; g.fillRect(0, 150, 512, 54);
  g.fillStyle = "#c9bda6"; g.fillRect(0, 440, 512, 72);
  g.strokeStyle = SEAM; g.lineWidth = 6;
  for (const x of [0, 256, 512]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
});

/** vending machine front, no text: glass with rows of cans, a lit strip, coin panel */
export const vendingTex = (body: string) => ctex("stVend" + body, 256, 512, (g) => {
  g.fillStyle = body; g.fillRect(0, 0, 256, 512);
  rr(g, 22, 26, 212, 292, 10); g.fillStyle = "#f3f6fb"; g.fill();
  const cans = ["#e2453c", "#3f73b8", "#f2bd2a", "#3f9c62", "#f08a2c", "#7b5ac9"];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { g.fillStyle = cans[(i + j * 2) % 6]; rr(g, 34 + i * 33, 40 + j * 70, 22, 46, 6); g.fill(); }
  rr(g, 22, 26, 212, 292, 10); g.lineWidth = 8; g.strokeStyle = "#1c1a24"; g.stroke();
  g.fillStyle = "#1c1a24"; rr(g, 150, 340, 78, 60, 8); g.fill(); rr(g, 34, 430, 188, 50, 8); g.fill();
});

/** station clock face without digits: 12 ticks, hands at about 8:59 */
export const clockTex = () => ctex("stClock", 256, 256, (g) => {
  g.fillStyle = "#1c1a24"; g.beginPath(); g.arc(128, 128, 126, 0, 6.3); g.fill();
  g.fillStyle = "#fbf8f0"; g.beginPath(); g.arc(128, 128, 108, 0, 6.3); g.fill();
  g.strokeStyle = "#1c1a24"; g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.lineWidth = i % 3 ? 5 : 10; g.beginPath(); g.moveTo(128 + 86 * Math.sin(a), 128 - 86 * Math.cos(a)); g.lineTo(128 + 100 * Math.sin(a), 128 - 100 * Math.cos(a)); g.stroke(); }
  const hand = (a: number, l: number, w: number, c: string) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + l * Math.sin(a), 128 - l * Math.cos(a)); g.stroke(); };
  hand((8.98 / 12) * 2 * Math.PI, 52, 12, "#1c1a24"); hand((59 / 60) * 2 * Math.PI, 82, 8, "#1c1a24");
  g.fillStyle = "#d8362f"; g.beginPath(); g.arc(128, 128, 9, 0, 6.3); g.fill();
});

/** distant snow-capped cone on a clear card (unlit, hazed toward the horizon colour) */
export const mountainTex = () => ctex("stMountain2", 1024, 512, (g) => {
  g.clearRect(0, 0, 1024, 512);
  const shape = () => {
    g.beginPath(); g.moveTo(0, 512);
    g.bezierCurveTo(250, 500, 390, 300, 456, 96); g.bezierCurveTo(470, 70, 500, 62, 512, 66); g.bezierCurveTo(540, 60, 556, 74, 570, 98);
    g.bezierCurveTo(640, 300, 780, 500, 1024, 512); g.closePath();
  };
  const gr = g.createLinearGradient(0, 60, 0, 512);
  gr.addColorStop(0, "#4f6fbd"); gr.addColorStop(0.5, "#6f8fd2"); gr.addColorStop(1, "#a9c2e8");
  shape(); g.fillStyle = gr; g.fill();
  g.save(); shape(); g.clip();
  g.fillStyle = "#f6f8fd";
  g.beginPath(); g.moveTo(380, 0); g.lineTo(650, 0); g.lineTo(640, 250); g.lineTo(606, 196); g.lineTo(580, 262); g.lineTo(548, 190); g.lineTo(520, 276);
  g.lineTo(490, 200); g.lineTo(462, 258); g.lineTo(436, 204); g.lineTo(404, 250); g.closePath(); g.fill();
  g.fillStyle = "rgba(111,143,207,0.28)";
  g.beginPath(); g.moveTo(512, 60); g.lineTo(1024, 512); g.lineTo(512, 512); g.closePath(); g.fill();
  g.restore();
});
