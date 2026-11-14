// Painted textures for the water short's sets (Canvas2D through the skill's ctex cache). No text anywhere.
import { ctex, jit } from "../pointing/paint";
import { Pen } from "../pointing/toon";
import { fxSpoon, drop, fxHeart } from "./draw";

const INKL = "rgba(40,30,44,0.7)";
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y); g.closePath();
};

/** server racks: 3 cabinets across a 1024 x 1024 image (= 2.3 m), rows of drive bays with LEDs */
export const rackTex = (hot = false) => ctex("wRack" + (hot ? "H" : ""), 1024, 1024, (g, r) => {
  g.fillStyle = "#2a3350"; g.fillRect(0, 0, 1024, 1024);
  for (let c = 0; c < 3; c++) {
    const x0 = c * 341.3 + 14;
    rr(g, x0, 18, 314, 988, 14); g.fillStyle = "#1c2238"; g.fill(); g.lineWidth = 10; g.strokeStyle = "#11131f"; g.stroke();
    for (let j = 0; j < 14; j++) {
      const y = 44 + j * 68;
      rr(g, x0 + 20, y, 274, 52, 8); g.fillStyle = jit(r, "#39456b", 0.08, 3, 0.1); g.fill();
      g.fillStyle = "#151a2c"; for (let k = 0; k < 9; k++) g.fillRect(x0 + 34 + k * 20, y + 12, 9, 28);
      for (let k = 0; k < 3; k++) {
        const on = r() < 0.8;
        g.fillStyle = !on ? "#232a44" : hot ? (r() < 0.75 ? "#ff5a3a" : "#ffb23a") : r() < 0.7 ? "#5dffb0" : r() < 0.5 ? "#7df0ff" : "#ffd75a";
        g.beginPath(); g.arc(x0 + 232 + k * 22, y + 26, 7, 0, 6.3); g.fill();
      }
    }
  }
});

/** data center facade, 1024 x 512 = 44 x 13 m: ribbed panels, a dark window band, loading doors, a teal stripe */
export const dcTex = () => ctex("wDC", 2048, 640, (g, r) => {
  g.fillStyle = "#dfe6ee"; g.fillRect(0, 0, 2048, 640);
  for (let i = 0; i < 32; i++) { g.fillStyle = jit(r, "#dfe6ee", 0.03, 2, 0.1); g.fillRect(i * 64, 0, 64, 640); }
  g.strokeStyle = "rgba(60,70,95,0.4)"; g.lineWidth = 5;
  for (let i = 0; i <= 32; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 640); g.stroke(); }
  g.fillStyle = "#2fa3a0"; g.fillRect(0, 96, 2048, 34);
  g.fillStyle = "#22344f";
  for (let i = 0; i < 15; i++) { if (i > 4 && i < 10) continue; rr(g, 60 + i * 132, 28, 96, 44, 8); g.fill(); }
  for (const x of [180, 420, 1500, 1740]) { rr(g, x, 430, 160, 210, 8); g.fillStyle = "#9aa7b8"; g.fill(); g.lineWidth = 8; g.strokeStyle = INKL; g.stroke();
    g.strokeStyle = "rgba(40,30,44,0.35)"; g.lineWidth = 4; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x, 430 + k * 35); g.lineTo(x + 160, 430 + k * 35); g.stroke(); } g.fillStyle = "#22344f"; }
  g.fillStyle = "#b9c4d2"; g.fillRect(0, 610, 2048, 30);
});

export const wallpaperTex = (base: string, stripe: string) => ctex("wPaper" + base, 512, 512, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.fillStyle = stripe; for (let i = 0; i < 8; i++) g.fillRect(i * 64 + 20, 0, 24, 512);
});

/** window view (unlit): day sky with a cloud, or night sky with a moon and stars */
export const windowTex = (night: boolean) => ctex("wWin" + night, 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512);
  if (night) { gr.addColorStop(0, "#0f1740"); gr.addColorStop(1, "#33438a"); } else { gr.addColorStop(0, "#4f8fdc"); gr.addColorStop(1, "#bcd6f0"); }
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  if (night) {
    g.fillStyle = "#fdf6d8"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((Math.sin(i * 91.7) * 0.5 + 0.5) * 512, (Math.sin(i * 37.3) * 0.5 + 0.5) * 380, 2 + (i % 3), 0, 6.3); g.fill(); }
    g.beginPath(); g.arc(360, 150, 70, 0, 6.3); g.fill(); g.fillStyle = "#18225a"; g.beginPath(); g.arc(392, 128, 62, 0, 6.3); g.fill();
    g.fillStyle = "#141b45"; g.fillRect(0, 400, 512, 112); for (let i = 0; i < 7; i++) g.fillRect(i * 80, 340 + 30 * Math.sin(i * 2.3), 60, 172);
  } else {
    g.fillStyle = "#ffffff"; for (const [x, y, rad] of [[150, 190, 60], [220, 170, 76], [300, 195, 56]]) { g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill(); }
    g.fillStyle = "#7fb069"; g.beginPath(); g.ellipse(256, 560, 420, 150, 0, 0, 6.3); g.fill();
  }
});

export const curtainTex = (a: string, b: string) => ctex("wCurtain" + a, 512, 512, (g) => {
  for (let i = 0; i < 16; i++) { const gr = g.createLinearGradient(i * 32, 0, i * 32 + 32, 0); gr.addColorStop(0, b); gr.addColorStop(0.5, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(i * 32, 0, 32, 512); }
});

export const rugTex = () => ctex("wRug", 512, 512, (g) => {
  for (const [rad, c] of [[256, "#c9553f"], [214, "#f3dfb8"], [190, "#d9634a"], [110, "#f3dfb8"], [86, "#3f73b8"]] as const) { g.fillStyle = c; g.beginPath(); g.arc(256, 256, rad, 0, 6.3); g.fill(); }
});

export const posterTex = () => ctex("wPoster", 512, 400, (g) => {
  g.fillStyle = "#ffd9a0"; g.fillRect(0, 0, 512, 400);
  g.fillStyle = "#f08a2c"; g.beginPath(); g.arc(360, 150, 70, 0, 6.3); g.fill();
  g.fillStyle = "#7b5ac9"; g.beginPath(); g.moveTo(0, 400); g.lineTo(170, 150); g.lineTo(330, 400); g.fill();
  g.fillStyle = "#4a3a8a"; g.beginPath(); g.moveTo(200, 400); g.lineTo(380, 210); g.lineTo(512, 400); g.fill();
  g.lineWidth = 22; g.strokeStyle = "#fbf8f0"; g.strokeRect(0, 0, 512, 400);
});

export const blanketTex = () => ctex("wBlanket", 512, 512, (g) => {
  g.fillStyle = "#3f73b8"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#6f9fdc"; for (let i = 0; i < 4; i++) g.fillRect(0, 40 + i * 128, 512, 40);
  g.fillStyle = "#f2bd2a"; for (let i = 0; i < 4; i++) g.fillRect(0, 92 + i * 128, 512, 10);
});

/** chalkboard: bottles, drops, tally marks, a rising curve (no letters or digits) */
export const boardTex = () => ctex("wBoard", 1024, 512, (g) => {
  g.fillStyle = "#2f5d4b"; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "rgba(255,255,255,0.05)"; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % 1024, (i * 53) % 512, 180, 26);
  g.strokeStyle = "#f6f3e8"; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
  for (let i = 0; i < 4; i++) { const x = 70 + i * 96; rr(g, x, 120, 56, 130, 14); g.stroke(); g.strokeRect(x + 16, 96, 24, 24); g.beginPath(); g.moveTo(x + 6, 190 - i * 14); g.lineTo(x + 50, 190 - i * 14); g.stroke(); }
  for (let i = 0; i < 12; i++) { const x = 70 + i * 32, y = 330; g.beginPath(); if (i % 5 === 4) { g.moveTo(x - 120, y + 60); g.lineTo(x - 6, y); } else { g.moveTo(x, y); g.lineTo(x, y + 60); } g.stroke(); }
  g.beginPath(); g.moveTo(560, 420); g.lineTo(560, 110); g.moveTo(560, 420); g.lineTo(960, 420); g.stroke();
  g.strokeStyle = "#ffd75a"; g.lineWidth = 12; g.beginPath(); g.moveTo(580, 400); g.bezierCurveTo(700, 390, 820, 330, 940, 130); g.stroke();
  g.strokeStyle = "#8fd0ff"; g.lineWidth = 9;
  for (const [x, y] of [[640, 160], [720, 210], [690, 300]]) { g.beginPath(); g.moveTo(x, y - 34); g.bezierCurveTo(x + 34, y + 6, x + 22, y + 34, x, y + 34); g.bezierCurveTo(x - 22, y + 34, x - 34, y + 6, x, y - 34); g.stroke(); }
});

/** the big stage screen (unlit): a giant teaspoon with one drop, or a heart */
export const screenTex = (kind: "spoon" | "heart") => ctex("wScreen" + kind, 1024, 600, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, "#cfe9ff"); gr.addColorStop(1, "#8fc3f2");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 600);
  const p = new Pen(g);
  g.save();
  if (kind === "spoon") { g.translate(162, 210); g.scale(1.7, 1.7); fxSpoon(p, false); g.restore(); g.save(); g.translate(690, 250); g.scale(0.42, 0.42); drop(p, 80, 120, 1); }
  else { g.translate(312, 100); g.scale(2, 2); fxHeart(p); }
  g.restore();
});

export const houseTex = (wall: string, key: string) => ctex("wHouse" + key, 512, 512, (g, r) => {
  g.fillStyle = wall; g.fillRect(0, 0, 512, 512);
  for (const [x, y] of [[70, 110], [300, 110], [70, 320]]) { rr(g, x, y, 130, 120, 8); g.fillStyle = "#5f7fae"; g.fill(); g.lineWidth = 12; g.strokeStyle = "#fbf8f0"; g.stroke(); g.lineWidth = 6; g.beginPath(); g.moveTo(x + 65, y); g.lineTo(x + 65, y + 120); g.stroke(); }
  rr(g, 310, 300, 110, 212, 8); g.fillStyle = jit(r, "#8a5a3c", 0.05); g.fill(); g.lineWidth = 8; g.strokeStyle = INKL; g.stroke();
});

export const strawTex = () => ctex("wStraw", 256, 64, (g) => {
  g.fillStyle = "#fbf8f0"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#e2453c"; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 64, 64); g.lineTo(i * 64 + 32, 64); g.fill(); }
});

export const tileTex = (a: string, b: string, key: string) => ctex("wTile" + key, 512, 512, (g, r) => {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = jit(r, (i + j) % 2 ? a : b, 0.04, 2, 0.08); g.fillRect(i * 128, j * 128, 128, 128); }
  g.strokeStyle = "rgba(30,26,40,0.35)"; g.lineWidth = 5; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
});

export const lakeTex = () => ctex("wLake", 512, 512, (g) => {
  g.fillStyle = "#2f93dc"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#8fd0ff"; g.lineWidth = 8; g.lineCap = "round";
  for (let i = 0; i < 26; i++) { const x = (Math.sin(i * 12.9) * 0.5 + 0.5) * 460 + 20, y = (Math.sin(i * 7.3 + 1) * 0.5 + 0.5) * 480 + 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + (i % 3) * 14, y); g.stroke(); }
});
