// A steam-era railway station as one static three.js scene, lit per plate with the template's two-tone rig:
// track (rails, sleepers, ballast) with a gravel walkway on the -z side, a train of a green tank-engine-style
// locomotive and three maroon/cream carriages on spoked wheels with axle boxes, a raised platform on +z under an iron
// canopy on columns with a clock, the station building, and houses + trees around.
import * as THREE from "three";
import { Batch, V, lam, boxGeo, quad, house, prop, Kit, Style } from "./build";
import { ctex, rep, stoneHD, cobbleHD, grassHD, roofHD, planksHD, beamHD, cloudHD, facadeHD, brickTile, rng, jit, water } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { PlateDef } from "./story";

type LightName = "day" | "golden" | "night";
const groundW = (x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) => {
  const g = new THREE.BufferGeometry();
  const P = [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]];
  g.setAttribute("position", new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x, y, z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x / tile, -z / tile]), 2));
  return g;
};
const ballastTex = () => ctex("ballast", 512, 512, (g, r) => {
  g.fillStyle = "#8f877c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = jit(r, ["#7d756b", "#a39a8d", "#6c655d", "#b3aa9c"][i % 4], 0.15); g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 6, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
});
const gravelTex = () => ctex("walkGravel", 512, 512, (g, r) => {
  g.fillStyle = "#b9ad98"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = jit(r, ["#a89c88", "#c9bea8", "#968b78"][i % 3], 0.15); g.beginPath(); g.ellipse(r() * 512, r() * 512, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill(); }
});
/** spoked carriage / loco wheel face: dark centre, spokes, bright steel tyre */
const roadTex = () => ctex("dirtRoad", 1024, 1024, (g, r) => {
  g.fillStyle = "#c7ab7d"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 3000; i++) { g.fillStyle = jit(r, ["#b89b6d", "#d4ba8e", "#a88d63", "#cdb489"][i % 4], 0.12); g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
  for (const v of [0.33, 0.67]) { for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(110,82,50,${0.05 + r() * 0.06})`; g.fillRect(r() * 1024, v * 1024 + (r() - 0.5) * 60, 30 + r() * 80, 3 + r() * 6); } }
});
/** muted storybook meadow (the kit grass reads lime after the grade) */
const meadowTex = (key: string, base: string) => ctex(key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 40; i++) { const x = r() * 1024, y = r() * 1024, rad = 80 + r() * 220; const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() > 0.5 ? "170,190,110" : "110,140,70"; gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
  g.lineWidth = 2; g.lineCap = "round";
  for (let i = 0; i < 1600; i++) { const x = r() * 1024, y = r() * 1024, h = 7 + r() * 9; g.strokeStyle = r() < 0.4 ? "rgba(190,205,130,0.35)" : "rgba(90,115,55,0.4)"; g.beginPath(); g.moveTo(x - 3, y - h); g.lineTo(x, y); g.lineTo(x + 3, y - h * 0.8); g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = ["#f7f3e8", "#f4d24a", "#f3a9bb"][i % 3]; g.beginPath(); g.arc(r() * 1024, r() * 1024, 3.5, 0, 7); g.fill(); }
});
/** crimson damask gallery wall (or any two-tone damask) */
const damaskTex = (base = "#8a3a40", dark = "#7f343a") => ctex("damask" + base, 512, 512, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512); g.fillStyle = dark;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 128 + (y % 2) * 64 + 32, cy = y * 128 + 64; g.beginPath(); g.ellipse(cx, cy, 22, 40, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx, cy - 46, 8, 10, 0, 0, 7); g.fill(); }
});
/** procedural "old master" canvases: landscapes, portraits, still lifes */
const canvasTex = (k: number) => ctex("canvas" + k, 512, 512, (g, r) => {
  const pal = [["#3d5a73", "#c9a86a", "#5c7a3a"], ["#2a2a30", "#e8d2b0", "#6b2a2a"], ["#6a8aa8", "#e9d8a6", "#4a6a3a"], ["#1f2a24", "#d9c39a", "#8c2f39"], ["#a8b8c8", "#f2e2b8", "#5a7a4a"], ["#3a2a20", "#c98a3a", "#e8d2b0"]][k % 6];
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]); g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
  if (k % 2) { g.fillStyle = pal[2]; g.beginPath(); g.ellipse(256, 520, 200, 260, 0, 0, 7); g.fill(); g.fillStyle = "#e8d2b0"; g.beginPath(); g.ellipse(256, 200, 70, 90, 0, 0, 7); g.fill(); g.fillStyle = "#3a2a20"; g.beginPath(); g.ellipse(256, 140, 76, 48, 0, Math.PI, 0); g.fill(); }
  else { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? pal[2] : "#3f5a30"; g.beginPath(); g.ellipse(r() * 512, 380 + i * 30, 220, 90, 0, 0, 7); g.fill(); } g.fillStyle = "#2f4a28"; for (let i = 0; i < 3; i++) { const x = 60 + r() * 400; g.beginPath(); g.ellipse(x, 300, 40, 70, 0, 0, 7); g.fill(); g.fillRect(x - 5, 330, 10, 60); } }
  g.fillStyle = "rgba(60,40,20,0.18)"; g.fillRect(0, 0, 512, 512);
});
const crestTex = () => ctex("crest", 256, 256, (g) => {
  g.fillStyle = "#d6a63c"; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = "#8c2f39"; g.beginPath(); g.moveTo(128, 40); g.lineTo(200, 80); g.lineTo(190, 170); g.lineTo(128, 220); g.lineTo(66, 170); g.lineTo(56, 80); g.closePath(); g.fill();
  g.strokeStyle = "#f2e2b8"; g.lineWidth = 10; g.beginPath(); g.moveTo(128, 70); g.lineTo(128, 190); g.moveTo(80, 120); g.lineTo(176, 120); g.stroke();
});
const wallpaperTex = () => ctex("wallpaper60s", 512, 512, (g) => {
  g.fillStyle = "#e9d8a6"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(160,120,60,0.18)"; g.fillRect(x, 0, 18, 512); }
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 128 + 64 + (y % 2) * 32, cy = y * 128 + 64; g.fillStyle = "#c98a3a"; for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 9, 6, a, 0, 7); g.fill(); } g.fillStyle = "#8c5a2a"; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill(); }
});
const windowTex = () => ctex("homeWindow", 256, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#9fc4e8"); gr.addColorStop(1, "#d9ecf5"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#b8c8a8"; g.fillRect(0, 170, 256, 86); g.fillStyle = "#f1ece0"; g.fillRect(122, 0, 12, 256); g.fillRect(0, 122, 256, 12); g.lineWidth = 16; g.strokeStyle = "#f1ece0"; g.strokeRect(0, 0, 256, 256);
  g.fillStyle = "rgba(200,60,60,0.85)"; g.fillRect(0, 0, 40, 256); g.fillRect(216, 0, 40, 256);
});
const rugTex = () => ctex("rug", 512, 512, (g) => {
  g.fillStyle = "#6a3a40"; g.fillRect(0, 0, 512, 512); g.strokeStyle = "#c9a96a"; g.lineWidth = 14; g.strokeRect(30, 30, 452, 452); g.strokeStyle = "#3f5a5a"; g.lineWidth = 8; g.strokeRect(60, 60, 392, 392);
  g.fillStyle = "#b8956a"; g.beginPath(); g.moveTo(256, 140); g.lineTo(372, 256); g.lineTo(256, 372); g.lineTo(140, 256); g.closePath(); g.fill();
});
const panelTex = () => ctex("georgianPanel", 512, 512, (g) => {
  g.fillStyle = "#b5ccb0"; g.fillRect(0, 0, 512, 512);
  for (const [x, y, w, h] of [[40, 40, 432, 250], [40, 330, 432, 140]]) { g.fillStyle = "#c3d8bd"; g.fillRect(x, y, w, h); g.strokeStyle = "#f4efe2"; g.lineWidth = 10; g.strokeRect(x, y, w, h); g.strokeStyle = "rgba(60,80,60,0.35)"; g.lineWidth = 3; g.strokeRect(x + 8, y + 8, w - 16, h - 16); }
});
const sashTex = () => ctex("sash", 256, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#a9cdea"); gr.addColorStop(1, "#e3f0f6"); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "#9fbf8a"; g.fillRect(0, 380, 256, 132); g.fillStyle = "#7fa36a"; g.beginPath(); g.ellipse(60, 380, 90, 50, 0, 0, 7); g.fill();
  g.strokeStyle = "#f4efe2"; g.lineWidth = 10; for (let x = 0; x <= 256; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); } for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.lineWidth = 18; g.strokeRect(0, 0, 256, 512);
});
const doorTex = () => ctex("door6", 256, 512, (g) => {
  g.fillStyle = "#f1ece0"; g.fillRect(0, 0, 256, 512); g.strokeStyle = "rgba(60,50,40,0.35)"; g.lineWidth = 6;
  for (const [x, y, w, h] of [[30, 30, 85, 120], [141, 30, 85, 120], [30, 180, 85, 150], [141, 180, 85, 150], [30, 360, 85, 120], [141, 360, 85, 120]]) g.strokeRect(x, y, w, h);
  g.fillStyle = "#c9a23a"; g.beginPath(); g.arc(220, 270, 10, 0, 7); g.fill();
});
const sandTex = () => ctex("sand", 512, 512, (g, r) => { g.fillStyle = "#d9c7a0"; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 2500; i++) { g.fillStyle = jit(r, ["#cdb98f", "#e3d3b0", "#c2ad82"][i % 3], 0.1); g.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3); } });
const seaTex = () => ctex("seaNight", 512, 512, (g, r) => { g.fillStyle = "#3a6a9a"; g.fillRect(0, 0, 512, 512); g.strokeStyle = "rgba(220,235,255,0.35)"; g.lineWidth = 3; for (let i = 0; i < 70; i++) { const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 15, y - 6, x + 30, y); g.stroke(); } });
/** plaster over brick with patches where the brick shows */
const plasterBrickTex = (base = "#d8c8a8") => ctex("plasterBrick" + base, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let p = 0; p < 4; p++) { const cx = r() * 512, cy = r() * 512, w = 80 + r() * 120, h = 50 + r() * 80;
    for (let y = cy - h / 2; y < cy + h / 2; y += 18) for (let x = cx - w / 2 + ((y / 18) % 2) * 18; x < cx + w / 2; x += 36) { g.fillStyle = jit(r, "#b8643f", 0.12); g.fillRect(x, y, 33, 15); } }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,70,50,${0.04 + r() * 0.05})`; g.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 6); }
});
/** a printed sheet of cards (3 x 3 grid of card faces) */
const cardSheetTex = (k: number) => ctex("cardSheet" + k, 256, 256, (g) => {
  g.fillStyle = "#f6f1e3"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const cx = 14 + x * 80, cy = 10 + y * 80; g.strokeStyle = "#2b2228"; g.lineWidth = 2; g.strokeRect(cx, cy, 68, 74); g.fillStyle = (x + y + k) % 2 ? "#c0353a" : "#241726"; g.font = "bold 30px Georgia"; g.textAlign = "center"; g.fillText((x + y + k) % 2 ? "\u2665" : "\u2663", cx + 34, cy + 48); }
});
const nightWinTex = () => ctex("nightWin", 256, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#1f2a5a"); gr.addColorStop(1, "#3a4a8a"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(180, 70, 26, 0, 7); g.fill(); g.strokeStyle = "#3a2a20"; g.lineWidth = 14; g.strokeRect(0, 0, 256, 256); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
});
const wheelTex = (key: string, spokes: number, centre: string) => ctex("wheel" + key, 512, 512, (g) => {
  const c = 256;
  g.clearRect(0, 0, 512, 512);
  g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(c, c, 254, 0, 7); g.fill();                 // tyre (steel)
  g.fillStyle = "#9ea3ab"; g.beginPath(); g.arc(c, c, 236, 0, 7); g.fill();
  g.fillStyle = centre; g.beginPath(); g.arc(c, c, 214, 0, 7); g.fill();                    // rim
  g.fillStyle = "#1f1d24"; g.beginPath(); g.arc(c, c, 196, 0, 7); g.fill();                 // gaps between spokes
  g.fillStyle = centre;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    g.save(); g.translate(c, c); g.rotate(a); g.beginPath(); g.moveTo(-15, 0); g.lineTo(-9, 200); g.lineTo(9, 200); g.lineTo(15, 0); g.fill(); g.restore();
  }
  g.beginPath(); g.arc(c, c, 62, 0, 7); g.fill();                                              // hub
  g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(c, c, 26, 0, 7); g.fill();
  g.strokeStyle = "#141218"; g.lineWidth = 7; for (const r of [254, 214, 196, 62]) { g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
});
/** carriage side livery: maroon lower panels, cream upper with windows, doors, lining */
const liveryTex = () => ctex("livery", 2048, 512, (g, r) => {
  const W = 2048, H = 512;
  g.fillStyle = "#efe2c2"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#7a2630"; g.fillRect(0, H * 0.52, W, H * 0.48);
  g.fillStyle = "#c9a23a"; g.fillRect(0, H * 0.5, W, 8); g.fillRect(0, H * 0.94, W, 6);
  g.fillStyle = "#7a2630"; g.fillRect(0, 0, W, 22);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.5) * W) / n, ww = W / n * 0.62, y0 = H * 0.13, hh = H * 0.32;
    const gr = g.createLinearGradient(0, y0, 0, y0 + hh); gr.addColorStop(0, "#9fb4e0"); gr.addColorStop(1, "#4d5f9c");
    g.fillStyle = "#5a2a22"; g.fillRect(cx - ww / 2 - 8, y0 - 8, ww + 16, hh + 16);
    g.fillStyle = gr; g.fillRect(cx - ww / 2, y0, ww, hh);
    g.fillStyle = "rgba(255,255,255,0.45)"; g.save(); g.beginPath(); g.rect(cx - ww / 2, y0, ww, hh); g.clip();
    g.translate(cx - ww * 0.15, y0 + hh / 2); g.rotate(0.6); g.fillRect(-8, -hh, 16, hh * 2); g.restore();
    if (i % 2 === 0) { g.strokeStyle = "rgba(40,20,20,0.6)"; g.lineWidth = 4; g.strokeRect(cx - ww / 2 - 30, H * 0.08, ww + 60, H * 0.84); }
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(80,40,30,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * W, H * (0.55 + r() * 0.4), 40 + r() * 80, 10 + r() * 20, 0, 0, 7); g.fill(); }
});
const clockTex = () => ctex("stationClock", 256, 256, (g) => {
  g.fillStyle = "#f6f1e3"; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill();
  g.strokeStyle = "#1c1a20"; g.lineWidth = 10; g.stroke();
  g.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); g.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); g.stroke(); }
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(186, 150); g.stroke();
});
/** a wall of pigeonholes: dark cubbies, most stuffed with letters (cream, pink, blue edges) */
const pigeonTex = () => ctex("pigeonholes", 1024, 512, (g, r) => {
  g.fillStyle = "#6b4a2e"; g.fillRect(0, 0, 1024, 512);
  const nx = 16, ny = 8, cw = 1024 / nx, ch = 512 / ny;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const x0 = x * cw + 5, y0 = y * ch + 5, w = cw - 10, h = ch - 10;
    g.fillStyle = "#2b2025"; g.fillRect(x0, y0, w, h);
    const n = Math.floor(r() * 5);
    for (let i = 0; i < n; i++) { g.fillStyle = ["#f6efe0", "#efe2c4", "#f3d6d6", "#dbe6f2", "#f1e6c8"][Math.floor(r() * 5)]; const lh = h * (0.45 + r() * 0.45); g.save(); g.translate(x0 + 6 + i * (w - 12) / Math.max(1, n), y0 + h); g.rotate((r() - 0.5) * 0.25); g.fillRect(0, -lh, (w - 12) / Math.max(1, n) - 2, lh); g.fillStyle = "rgba(140,40,40,0.8)"; if (r() < 0.4) { g.beginPath(); g.arc(6, -lh * 0.5, 3, 0, 7); g.fill(); } g.restore(); }
    g.fillStyle = "rgba(255,240,210,0.18)"; g.fillRect(x0, y0, w, 3);
  }
  g.fillStyle = "#e8c45a"; for (let x = 0; x < nx; x++) g.fillRect(x * cw + cw / 2 - 8, 4, 16, 3);
});
/** book spines on shelves */
const bookTex = () => ctex("books", 512, 512, (g, r) => {
  g.fillStyle = "#4a3220"; g.fillRect(0, 0, 512, 512);
  for (let s2 = 0; s2 < 5; s2++) { const y1 = 100 + s2 * 102; let x = 6;
    while (x < 506) { const w = 12 + r() * 16, h = 60 + r() * 30; g.fillStyle = ["#7a2630", "#2f5a3a", "#3f4a6b", "#8c6a45", "#5a3b2a", "#2b3a4a", "#a8724a"][Math.floor(r() * 7)]; g.fillRect(x, y1 - h, w - 2, h); g.fillStyle = "rgba(230,200,120,0.7)"; g.fillRect(x + 2, y1 - h + 8, w - 6, 3); g.fillRect(x + 2, y1 - 14, w - 6, 3); x += w; }
    g.fillStyle = "#6b4a2e"; g.fillRect(0, y1, 512, 8); }
});
/** parchment globe: sea and cartoon continents */
const globeTex = () => ctex("globe", 512, 256, (g, r) => {
  g.fillStyle = "#c9dbc6"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 9; i++) { g.fillStyle = ["#d9b77a", "#c9a46a", "#b8955a"][i % 3]; g.beginPath(); g.ellipse(r() * 512, 50 + r() * 160, 30 + r() * 50, 20 + r() * 40, r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(90,70,50,0.35)"; g.lineWidth = 2; for (let y = 32; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); } for (let x = 0; x < 512; x += 43) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
});
/** corrugated roll-up garage door */
const garageTex = () => ctex("garage", 256, 256, (g) => { g.fillStyle = "#4a5a5a"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 16) { g.fillStyle = "#3a4848"; g.fillRect(0, y, 256, 4); g.fillStyle = "#5a6a6a"; g.fillRect(0, y + 4, 256, 3); } });
/** BRINK'S painted sign */
const signTex = () => ctex("brinksSign", 512, 96, (g) => { g.fillStyle = "#1f2a44"; g.fillRect(0, 0, 512, 96); g.strokeStyle = "#e8c45a"; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84); g.fillStyle = "#f4ecd6"; g.font = "900 52px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("BRINK'S INC.", 256, 50); });
/** an upper-floor window, lit (warm, with a blind) or dark */
const winTex = (lit: boolean) => ctex("win" + lit, 128, 192, (g) => { g.fillStyle = lit ? "#ffd98a" : "#26304a"; g.fillRect(0, 0, 128, 192); if (lit) { g.fillStyle = "rgba(160,110,50,0.35)"; g.fillRect(0, 0, 128, 70); } g.strokeStyle = "#e9e1cf"; g.lineWidth = 10; g.strokeRect(0, 0, 128, 192); g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 192); g.moveTo(0, 96); g.lineTo(128, 96); g.stroke(); });
/** two-tone institutional wall: green dado, cream upper, a dark rail */
const dadoTex = () => ctex("dado", 256, 256, (g) => { g.fillStyle = "#e9dfc6"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#4f7a62"; g.fillRect(0, 150, 256, 106); g.fillStyle = "#2f4a3a"; g.fillRect(0, 144, 256, 8); });
/** checkerboard linoleum */
const checkerTex = (a = "#d9d2c0", b2 = "#3a4a5a") => ctex("checker" + a, 256, 256, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? a : b2; g.fillRect(x * 32, y * 32, 32, 32); } });
/** pegboard hung with key blanks */
const pegTex = () => ctex("pegKeys", 512, 192, (g, r) => { g.fillStyle = "#b8956a"; g.fillRect(0, 0, 512, 192); g.fillStyle = "#8a6a45"; for (let y = 8; y < 192; y += 16) for (let x = 8; x < 512; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
  for (let i = 0; i < 26; i++) { const x = 20 + (i % 13) * 37, y = 30 + Math.floor(i / 13) * 80; g.fillStyle = ["#d6a63c", "#c9ccd2", "#c08a3a"][i % 3]; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.fillRect(x - 3, y, 6, 36); g.fillRect(x, y + 22, 7, 4); g.fillRect(x, y + 30, 5, 4); g.fillStyle = "#8a6a45"; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } });
/** venetian blinds over a night window */
const blindsTex = () => ctex("blinds", 128, 128, (g) => { g.fillStyle = "#3a5aa8"; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 10) { g.fillStyle = "#e9e1cf"; g.fillRect(0, y, 128, 6); } g.strokeStyle = "#cfc6b0"; g.lineWidth = 8; g.strokeRect(0, 0, 128, 128); });
/** a painted 1950s office door: raised panels with bevel light, a frosted glass light with gilt lettering, kick plate */
const officeDoorTex = (col: string, label: string) => ctex("odoor" + col + label, 256, 560, (g) => {
  const c = new THREE.Color(col), hex = (k: number) => "#" + c.clone().multiplyScalar(k).getHexString();
  g.fillStyle = col; g.fillRect(0, 0, 256, 560);
  const panel = (x: number, y: number, w: number, h: number) => { g.fillStyle = hex(0.9); g.fillRect(x, y, w, h); g.fillStyle = hex(1.15); g.fillRect(x, y, w, 6); g.fillRect(x, y, 6, h); g.fillStyle = hex(0.7); g.fillRect(x, y + h - 6, w, 6); g.fillRect(x + w - 6, y, 6, h); };
  if (label) { g.fillStyle = hex(0.7); g.fillRect(34, 34, 188, 200); const gr = g.createLinearGradient(0, 40, 0, 228); gr.addColorStop(0, "#dfe6e2"); gr.addColorStop(1, "#b9c6c2"); g.fillStyle = gr; g.fillRect(42, 42, 172, 184);
    g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(60, 42); g.lineTo(100, 42); g.lineTo(60, 120); g.closePath(); g.fill();
    g.fillStyle = "#c9a23a"; g.strokeStyle = "#5a4010"; g.lineWidth = 1.5; g.textAlign = "center"; g.textBaseline = "middle"; const words = label.split(" "); g.font = `900 ${words.length > 1 ? 26 : 32}px Georgia, serif`; words.forEach((wd, i) => { g.fillText(wd, 128, 135 + (i - (words.length - 1) / 2) * 32); g.strokeText(wd, 128, 135 + (i - (words.length - 1) / 2) * 32); }); }
  else panel(34, 34, 188, 200);
  panel(34, 270, 188, 220);
  g.fillStyle = "#c9a23a"; g.fillRect(14, 512, 228, 40); g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(14, 512, 228, 6);
  g.strokeStyle = hex(0.55); g.lineWidth = 6; g.strokeRect(3, 3, 250, 554);
});
const SKY_V = "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_F = `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
  void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
    vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
    c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`;

export class World {
  root = new THREE.Group();
  private sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  private hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private clouds: THREE.Mesh[] = [];
  private cloudMaps: Record<LightName, THREE.Texture[]>;
  private disc: THREE.Sprite;

  constructor() {
    const R = this.root, kit: Kit = {};
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() },
        c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    const discTex = ctex("sunDisc", 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 44, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.disc.layers.set(NOINK); this.disc.frustumCulled = false; R.add(this.disc);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.sun, this.sun.target, this.hemi);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    const b = new Batch();
    const M = (key: string, col: string) => lam(key, () => ({ color: col }));
    const T = (key: string, tex: () => THREE.Texture) => lam(key, () => ({ map: tex() }));
    const gold = twoTone(new THREE.MeshPhongMaterial({ color: "#d6a63c", specular: "#fff1c0", shininess: 70 }), 0.15);
    const brass = twoTone(new THREE.MeshPhongMaterial({ color: "#c9a23a", specular: "#fff1c0", shininess: 80 }), 0.15);
    const wood = T("darkWood", () => planksHD());
    const oakD = M("pressOakD", "#4a3220");
    const iron = M("iron", "#26232c");
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material, tile = 0) => b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile), m);
    /** a gilt-framed painting on a wall facing -z at (x, y) (centre), w x h; key picks the canvas */
    const painting = (x: number, y: number, z: number, w: number, h: number, key: number) => {
      const f = 0.12;
      box(x - w / 2 - f, y - h / 2 - f, z - 0.08, x + w / 2 + f, y + h / 2 + f, z, gold);
      b.add(quad(V(x + w / 2, y - h / 2, z - 0.081), V(x - w / 2, y - h / 2, z - 0.081), V(x - w / 2, y + h / 2, z - 0.081), V(x + w / 2, y + h / 2, z - 0.081)), lam("canvas" + key, () => ({ map: canvasTex(key) })));
    };
    b.add(groundW(-700, 800, -500, 600, 8, -0.05), M("outside", "#6f8a50"));
    const room = (cx: number, w: number, d0: number, d1: number, h: number, wallM: THREE.Material, floorM: THREE.Material, tile = 4) => {
      b.add(groundW(cx - w, cx + w, d0, d1, 2.2, 0.0), floorM);
      b.add(quad(V(cx + w, 0, d1), V(cx - w, 0, d1), V(cx - w, h, d1), V(cx + w, h, d1), tile, h / 3), wallM);
      for (const sx of [-1, 1]) b.add(quad(V(cx + sx * w, 0, sx > 0 ? d0 : d1), V(cx + sx * w, 0, sx > 0 ? d1 : d0), V(cx + sx * w, h, sx > 0 ? d1 : d0), V(cx + sx * w, h, sx > 0 ? d0 : d1), tile * 0.8, h / 3), wallM);
    };
    const glow = (key: string, col: string, k = 1.2) => lam(key, () => ({ color: "#fff1c0", emissive: col, emissiveIntensity: k }));
    const candle = (x: number, y: number, z: number) => { b.add(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 10).translate(x, y + 0.11, z), M("wax", "#f4ead2")); b.add(new THREE.SphereGeometry(0.035, 10, 8).scale(1, 1.6, 1).translate(x, y + 0.27, z), glow("flame", "#ffb347", 1.6)); b.add(new THREE.CylinderGeometry(0.08, 0.06, 0.03, 12).translate(x, y + 0.015, z), brass); };

    const prop2 = (name: string, x: number, y: number, z: number, h: number, yaw = 0) => prop(b, kit, name, x, y, z, h, yaw);
    const r = rng(7);

    // ---------- shared door: frame, panelled leaf (optionally swung open), brass knob + lock cylinder ----------
    const door = (x: number, z: number, col: string, open = 0, w = 1.0, h = 2.15, face = -1, label = "") => {
      const fr = M("doorFrame", "#e9e1cf");
      box(x - w / 2 - 0.12, 0, z - 0.06, x - w / 2, h + 0.12, z + 0.06, fr); box(x + w / 2, 0, z - 0.06, x + w / 2 + 0.12, h + 0.12, z + 0.06, fr); box(x - w / 2 - 0.12, h, z - 0.06, x + w / 2 + 0.12, h + 0.14, z + 0.06, fr);
      box(x - w / 2, 0, z + 0.02, x + w / 2, h, z + 0.08, M("doorDark", "#1d1a22"));
      const m = new THREE.Matrix4().makeTranslation(x + w / 2, 0, z).multiply(new THREE.Matrix4().makeRotationY(-open * 1.4 * face)).multiply(new THREE.Matrix4().makeTranslation(-w / 2, 0, 0));
      b.add(new THREE.BoxGeometry(w, h, 0.06).translate(0, h / 2, 0), lam("door" + col + label, () => ({ map: officeDoorTex(col, label) })), m);
      b.add(new THREE.BoxGeometry(0.11, 0.3, 0.012).translate(-w * 0.38, 1.07, -0.036), brass, m);                                 // escutcheon plate
      b.add(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 18).rotateX(Math.PI / 2).translate(-w * 0.38, 1.16, -0.05), brass, m);    // the lock cylinder
      b.add(new THREE.SphereGeometry(0.048, 14, 10).translate(-w * 0.38, 0.99, -0.08), brass, m);                                  // knob
      b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8).rotateX(Math.PI / 2).translate(-w * 0.38, 0.99, -0.05), brass, m);
    };
    const shade3 = (hex: string, k: number) => "#" + new THREE.Color(hex).multiplyScalar(k).getHexString();

    const bulb = (x: number, y: number, z: number, col = "#ffd98a", k = 1.2) => { b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4).translate(x, y + 0.35, z), M("wire", "#1d1a22")); b.add(new THREE.ConeGeometry(0.28, 0.2, 18, 1, true).translate(x, y + 0.08, z), lam("shadeM", () => ({ color: "#2f4a3a", side: THREE.DoubleSide }))); b.add(new THREE.SphereGeometry(0.07, 12, 8).translate(x, y - 0.02, z), glow("bulb" + col, col, k)); };

    // ===== A. the Brink's building (origin), night: a brick depot on a North End street, a garage door, the entrance
    //          door with its brass lock, a BRINK'S sign, lit upper windows, a street lamp, neighbouring buildings
    const brickM = T("brinksBrick", () => rep(brickTile(0.085, 0.25), 1, 1));
    b.add(groundW(-120, 120, -40, 2.6, 4, 0.01), T("asphalt", () => cobbleHD()));
    b.add(groundW(-120, 120, 2.6, 6, 1.6, 0.04), T("sidewalk", () => stoneHD("walkHD", ["#a8a49c", "#9c988f", "#b3afa6", "#928e86"], "#77736c")));
    box(-120, 0, 2.5, 120, 0.16, 2.62, M("curb", "#8f8b84"));
    box(-9, 0, 6, 9, 10.5, 14, brickM, 2);
    b.add(quad(V(-9, 0, 5.99), V(9, 0, 5.99), V(9, 10.5, 5.99), V(-9, 10.5, 5.99), 18 / 2.2, 10.5 / 2.2), brickM);
    box(-9.1, 10.3, 5.9, 9.1, 10.8, 14.1, M("cornice", "#c9bfae"));
    box(-6.2, 0, 5.9, -1.6, 3.6, 6.0, lam("garage", () => ({ map: garageTex() }))); box(-6.4, 3.6, 5.85, -1.4, 3.8, 6.05, M("lintel", "#c9bfae"));
    door(0.4, 5.94, "#2f5a44", 0, 1.1, 2.3, -1, "BRINK'S INC.");
    box(-0.4, 2.55, 5.85, 1.2, 2.6, 6.0, M("lintel", "#c9bfae")); box(-0.2, 0, 5.4, 1.0, 0.18, 5.95, M("step", "#b8b2a6"));
    b.add(quad(V(3.2, 3.1, 5.93), V(-1.4, 3.1, 5.93), V(-1.4, 3.9, 5.93), V(3.2, 3.9, 5.93)), lam("brinksSign", () => ({ map: signTex() })));
    for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 5; i++) { const x = -7 + i * 3.5, y = 4.6 + fl * 3; const lit = (i + fl) % 2 === 0; b.add(quad(V(x + 0.7, y, 5.95), V(x - 0.7, y, 5.95), V(x - 0.7, y + 1.8, 5.95), V(x + 0.7, y + 1.8, 5.95)), lit ? lam("winLit", () => ({ map: winTex(true), emissive: "#ffcf7a", emissiveIntensity: 0.9 })) : lam("winDark", () => ({ map: winTex(false) }))); box(x - 0.8, y - 0.12, 5.88, x + 0.8, y, 6.02, M("sill", "#c9bfae")); }
    for (const [x0, x1, h, col] of [[-20, -9.2, 8, "#8a5a44"], [9.2, 22, 12, "#9a6a4a"], [-34, -20.2, 11, "#7a4a3a"], [22.2, 36, 9, "#8f5f48"]] as [number, number, number, string][]) {
      const m2 = lam("nb" + col, () => ({ map: facadeHD("nb" + col, x1 - x0, h, { wall: col, shutter: "#2b2f3d", brick: true }) }));
      box(x0, 0, 6.5, x1, h, 16, M("nbSide" + col, col)); b.add(quad(V(x0, 0, 6.49), V(x1, 0, 6.49), V(x1, h, 6.49), V(x0, h, 6.49)), m2);
    }
    for (const x of [3.6, -12, 14]) { b.add(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 10).translate(x, 1.8, 2.9), iron); box(x - 0.22, 3.6, 2.68, x + 0.22, 4.1, 3.12, glow("streetLamp2", "#ffd98a", 1.2)); b.add(new THREE.ConeGeometry(0.34, 0.28, 4).rotateY(Math.PI / 4).translate(x, 4.24, 2.9), iron); }
    box(-4.5, 0, 3.6, -3.7, 0.9, 4.2, M("bin", "#3a4a3a")); box(5.8, 0, 4.6, 6.6, 1.2, 5.6, M("crate", "#8c6a45"));
    b.add(groundW(-120, 120, 14, 80, 6, 0.0), M("backlot", "#3a3a44"));

    // ===== B. the corridor of locked doors (x = 60): two-tone plaster, checker floor, three doors, bare bulbs, a
    //          moonlit window
    const CX2 = 60;
    room(CX2, 7, -6, 4.2, 4.6, T("corrWall", () => dadoTex()), T("corrFloor", () => checkerTex()), 3);
    ([[CX2 - 3.6, "OFFICE"], [CX2, "VAULT"], [CX2 + 3.6, "COUNTING ROOM"]] as [number, string][]).forEach(([x, l]) => door(x, 4.14, "#3f6a54", 0, 1.0, 2.2, -1, l));
    for (const x of [CX2 - 1.8, CX2 + 1.8]) bulb(x, 3.4, 2.6);
    b.add(quad(V(CX2 + 6.98, 1.3, 1.2), V(CX2 + 6.98, 1.3, -0.8), V(CX2 + 6.98, 3.4, -0.8), V(CX2 + 6.98, 3.4, 1.2)), lam("moonWin", () => ({ map: nightWinTex(), emissive: "#3a5aa8", emissiveIntensity: 0.6, side: THREE.DoubleSide })));
    box(CX2 - 6.9, 0, 1.0, CX2 - 6.2, 1.5, 2.2, M("cabinet", "#5a6a5a")); box(CX2 + 5.6, 0, 3.2, CX2 + 6.8, 0.9, 4.0, M("bench2", "#6b4a2e"));

    // ===== C. the locksmith's bench (x = 120): pegboard of keys, a key-cutting machine, a vice, a green desk lamp
    const LX = 120;
    room(LX, 5, -5, 3.6, 4.2, T("smithWall", () => plasterBrickTex("#cfc2a6")), T("smithFloor", () => planksHD()), 3);
    b.add(quad(V(LX + 3, 1.0, 3.58), V(LX - 3, 1.0, 3.58), V(LX - 3, 3.0, 3.58), V(LX + 3, 3.0, 3.58)), lam("pegKeys", () => ({ map: pegTex() })));
    box(LX - 3.2, 0, 2.5, LX + 3.2, 0.9, 3.5, wood); box(LX - 3.25, 0.9, 2.45, LX + 3.25, 0.96, 3.55, M("benchTop", "#7a5a3a"));
    box(LX - 0.45, 0.96, 2.7, LX + 0.45, 1.25, 3.2, M("cutterBase", "#4a6a7a")); b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24).rotateZ(Math.PI / 2).translate(LX + 0.2, 1.42, 2.95), M("cutWheel", "#c9ccd2"));
    box(LX - 0.35, 1.25, 2.85, LX - 0.05, 1.38, 3.05, M("vice", "#3a3540")); box(LX + 0.05, 1.25, 2.85, LX + 0.35, 1.32, 3.05, M("vice", "#3a3540"));
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6).translate(LX - 1.6, 1.21, 3.1), brass); b.add(new THREE.ConeGeometry(0.22, 0.22, 16, 1, true).rotateX(0.5).translate(LX - 1.5, 1.45, 3.0), lam("lampGreen", () => ({ color: "#2f6a43", side: THREE.DoubleSide }))); b.add(new THREE.SphereGeometry(0.06, 10, 8).translate(LX - 1.47, 1.38, 2.95), glow("lampBulb", "#ffd98a", 1.4));
    for (let i = 0; i < 6; i++) box(LX + 1.2 + (i % 3) * 0.5, 0.96, 2.65 + Math.floor(i / 3) * 0.35, LX + 1.6 + (i % 3) * 0.5, 1.02, 2.9 + Math.floor(i / 3) * 0.35, M("tray", "#8a8f98"));

    // ===== D. the vault room (x = 180): the round vault door standing open, shelves of cash inside, a cage of bars,
    //          counting tables with money bags, a wall clock
    const VX = 180;
    room(VX, 8, -7, 5.6, 5.5, T("vaultWall", () => panelTex()), T("vaultFloor", () => checkerTex()), 4);
    b.add(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 40).rotateX(Math.PI / 2).translate(VX - 3.2, 1.9, 5.3), M("vaultRing", "#8a8f98"));
    b.add(new THREE.CylinderGeometry(1.35, 1.35, 0.45, 40).rotateX(Math.PI / 2).translate(VX - 3.2, 1.9, 5.32), M("vaultHole", "#2b2a30"));
    b.add(new THREE.CylinderGeometry(1.5, 1.5, 0.35, 40).rotateX(Math.PI / 2).rotateY(1.2).translate(VX - 5.0, 1.9, 4.4), M("vaultDoor", "#a8adb5"));
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) box(VX - 4.2 + k * 0.7, 0.9 + i * 0.5, 5.45, VX - 3.7 + k * 0.7, 1.1 + i * 0.5, 5.6, M("cashStack", "#7fae6a"));
    for (let x = VX - 1.0; x <= VX + 7.6; x += 0.22) b.add(new THREE.CylinderGeometry(0.02, 0.02, 3.0, 6).translate(x, 1.5, 3.2), iron);
    box(VX - 1.0, 2.98, 3.15, VX + 7.6, 3.04, 3.25, iron); box(VX - 1.0, 1.0, 3.15, VX + 7.6, 1.05, 3.25, iron);
    for (const z of [1.2, 2.4]) { box(VX - 2.5, 0, z - 0.4, VX + 2.5, 0.85, z + 0.4, wood); box(VX - 2.55, 0.85, z - 0.45, VX + 2.55, 0.9, z + 0.45, M("countTop", "#3f5a3a"));
      for (let i = 0; i < 9; i++) box(VX - 2.2 + i * 0.5, 0.9, z - 0.2 + r() * 0.1, VX - 1.9 + i * 0.5, 0.9 + 0.05 + r() * 0.12, z + 0.1, M("cashStack", "#7fae6a")); }
    for (const [x, z] of [[VX + 3.6, 1.0], [VX + 4.4, 1.5], [VX + 3.9, 2.3]]) { b.add(new THREE.SphereGeometry(0.42, 14, 10).scale(1, 1.2, 0.9).translate(x, 0.5, z), M("canvasBag", "#c9b48a")); b.add(new THREE.CylinderGeometry(0.1, 0.15, 0.22, 10).translate(x, 1.05, z), M("canvasBag", "#c9b48a")); }
    b.add(new THREE.CircleGeometry(0.55, 36).rotateY(Math.PI).translate(VX + 2.2, 4.0, 5.58), lam("vClock", () => ({ map: clockTex() })));
    bulb(VX, 4.4, 1.8, "#ffe6a8", 1.0);

    // ===== E. the hideout (x = 240): wallpaper, a round table with a lamp, chairs, a sofa, a lump of money under a sheet,
    //          a window with blinds
    const HX = 240;
    room(HX, 6, -5, 4.4, 4.6, T("hideWall", () => damaskTex("#8a6a4a", "#7f6244")), T("hideFloor", () => planksHD()), 3);
    b.add(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 32).translate(HX, 0.78, 2.2), wood); b.add(new THREE.CylinderGeometry(0.1, 0.2, 0.75, 12).translate(HX, 0.38, 2.2), wood);
    bulb(HX, 2.6, 2.2, "#ffd98a", 1.2);
    for (const [x, z] of [[HX - 1.2, 2.2], [HX + 1.2, 2.2]]) { box(x - 0.25, 0, z - 0.25, x + 0.25, 0.48, z + 0.25, wood); box(x - 0.25, 0.48, z + (x < HX ? -0.25 : 0.2), x + 0.25, 1.1, z + (x < HX ? -0.2 : 0.25), wood); }
    box(HX + 2.8, 0, 3.4, HX + 5.2, 0.5, 4.3, M("sofa", "#7a3a3a")); box(HX + 2.8, 0.5, 4.0, HX + 5.2, 1.1, 4.3, M("sofa", "#7a3a3a"));
    b.add(new THREE.SphereGeometry(0.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.9, 0.9).translate(HX - 3.6, 0, 3.4), M("sheet", "#e9e6dc"));
    b.add(quad(V(HX + 1.4, 1.3, 4.38), V(HX - 0.4, 1.3, 4.38), V(HX - 0.4, 3.0, 4.38), V(HX + 1.4, 3.0, 4.38)), lam("blinds", () => ({ map: blindsTex(), emissive: "#3a5aa8", emissiveIntensity: 0.35 })));

    // ===== F. the hospital room (x = 300): white bed, pillow, an IV stand, a curtain rail, window blinds
    const SX2 = 300;
    room(SX2, 5, -5, 4.0, 4.2, T("hospWall", () => plasterBrickTex("#dfe6e6")), T("hospFloor", () => checkerTex("#cfd8d6", "#b8c4c2")), 3);
    box(SX2 - 1.0, 0, 1.6, SX2 + 1.0, 0.6, 3.8, M("bedFrame", "#c9ccd2")); box(SX2 - 0.95, 0.6, 1.65, SX2 + 0.95, 0.8, 3.75, M("mattress", "#f4f6f6"));
    box(SX2 - 1.05, 0, 3.75, SX2 + 1.05, 1.3, 3.85, M("bedHead", "#c9ccd2")); b.add(new THREE.SphereGeometry(0.4, 16, 10).scale(1.3, 0.4, 0.7).translate(SX2, 0.92, 3.4), M("pillow", "#ffffff"));
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6).translate(SX2 + 1.4, 0.95, 3.0), M("ivPole", "#c9ccd2")); box(SX2 + 1.3, 1.7, 2.95, SX2 + 1.5, 1.95, 3.05, M("ivBag", "#e8f0f6"));
    b.add(quad(V(SX2 - 1.6, 1.3, 3.98), V(SX2 - 3.4, 1.3, 3.98), V(SX2 - 3.4, 3.0, 3.98), V(SX2 - 1.6, 3.0, 3.98)), lam("hospBlinds", () => ({ map: blindsTex(), emissive: "#cfe4f5", emissiveIntensity: 0.3 })));
    b.add(new THREE.CylinderGeometry(0.015, 0.015, 4, 6).rotateZ(Math.PI / 2).translate(SX2 + 1.8, 3.4, 2.0), M("rail", "#c9ccd2"));
    b.build(R);
  }

  update(p: PlateDef, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const L = LIGHTS[p.light], K = LOOK[p.light];
    cam.position.set(...p.pos); cam.up.set(0, 1, 0); cam.lookAt(...p.look);
    cam.fov = p.fov; cam.near = 0.1; cam.far = 1500; cam.aspect = (p.w ?? 1620) / 2880; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const fx = p.look[0] - p.pos[0], fz = p.look[2] - p.pos[2], n = Math.hypot(fx, fz) || 1;
    const ax = fx / n, az0 = fz / n;
    const az = THREE.MathUtils.degToRad(p.az ?? L.az), el = THREE.MathUtils.degToRad(p.el ?? L.el);
    const hx = ax * Math.cos(az) - az0 * Math.sin(az), hz = az0 * Math.cos(az) + ax * Math.sin(az);
    const sunDir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    const focus = new THREE.Vector3(...(p.focus ?? p.look));
    const dist = cam.position.distanceTo(focus);
    const Rr = THREE.MathUtils.clamp(dist * 1.6 + 10, 14, 70);
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.sun.shadow.needsUpdate = true;
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    this.disc.visible = p.light === "golden";
    this.disc.position.copy(cam.position).addScaledVector(sunDir, 900);
    this.disc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
    const yaw0 = Math.atan2(fx, fz);
    this.clouds.forEach((m, i) => {
      const a = yaw0 + (i / this.clouds.length - 0.5) * 2.4 + 0.13 * Math.sin(i * 7.1), d = 520 + (i % 3) * 70;
      const w = 120 + (i % 4) * 34;
      m.position.set(cam.position.x + Math.sin(a) * d, 70 + (i % 5) * 26, cam.position.z + Math.cos(a) * d);
      m.scale.set(w, w / 2, 1); m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[p.light][i % 4];
    });
    return focus;
  }
}
