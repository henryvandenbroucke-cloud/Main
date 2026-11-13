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

    // ===== A. a Lake District cottage (origin), day: whitewashed stone cottage with slate roof and a porch, a dry-stone
    //          wall with a gate, a flagstone path, roses round the door, a dirt road in front, sheep in the meadow, the
    //          lake behind with an island, and the fells beyond (fog turns them blue)
    b.add(groundW(-420, 420, -60, 520, 7, 0.0), T("lakeMeadow", () => rep(meadowTex("lakeMeadowT", "#86a85c"), 1, 1)));
    b.add(groundW(-200, 200, -4.6, -1.4, 4, 0.012), T("laneRoad", () => roadTex()));
    b.add(groundW(-0.65, 0.65, 0.4, 4.0, 1.3, 0.016), T("flagPath", () => stoneHD("flagHD", ["#bdb7a8", "#aaa596", "#c9c3b4", "#a39d8e"], "#7d786c")));
    house(b, 0, 7, Math.PI, 8, 6, 5.6, 0, 0, { wall: "#ece6d6", shutter: "#2f5f6a", roof: "#8f97a8" });
    const slate = lam("porchSlate", () => ({ color: "#6f7686" })), dryM = T("dryStone", () => stoneHD("dryHD", ["#a9a596", "#9a9688", "#b8b4a5", "#8f8b7e"], "#6f6b60"));
    box(-1.0, 2.5, 3.35, 1.0, 2.6, 4.0, slate); for (const x of [-0.85, 0.85]) box(x - 0.05, 0, 3.35, x + 0.05, 2.5, 3.45, M("porchPost", "#ece6d6"));
    // roses round the door: leafy mounds + pink blooms
    for (const sx of [-1, 1]) { prop2("plant_bushDetailed", sx * 1.5, 0, 3.75, 1.15); for (let i = 0; i < 9; i++) b.add(new THREE.SphereGeometry(0.07, 8, 6).translate(sx * (1.25 + r() * 0.45), 0.5 + r() * 1.0, 3.35 + r() * 0.2), M("rose" + (i % 2), i % 2 ? "#e4708f" : "#f3a3b8")); }
    // dry-stone wall + gate posts, a little gate swung open
    for (const [x0, x1] of [[-14, -0.9], [0.9, 14]]) box(x0, 0, 0.35, x1, 0.95, 0.85, dryM, 1.5);
    for (const x of [-0.95, 0.95]) box(x - 0.18, 0, 0.32, x + 0.18, 1.25, 0.88, dryM, 1.5);
    box(0.78, 0.15, 0.6, 0.82, 1.0, 1.7, M("gateWood", "#7a5a3a"));
    for (let i = 0; i < 4; i++) box(0.72, 0.25 + i * 0.22, 0.65, 0.84, 0.31 + i * 0.22, 1.65, M("gateWood", "#7a5a3a"));
    // cottage garden + trees
    for (const [n, x, z, h] of [["tree_oak", -6.5, 9, 7.5], ["tree_fat", 7.5, 10, 6.5], ["tree_detailed", -11, 4, 6], ["tree-high-round", 12, 5, 8], ["tree_oak", -18, 16, 9], ["tree_default", 20, 15, 8]] as const) prop2(n, x, 0, z, h, x);
    for (const x of [-4, -2.6, 2.6, 4, 5.5, -5.5]) prop2("plant_bush", x, 0, 1.3 + Math.abs(x) * 0.05, 0.9);
    for (let i = 0; i < 40; i++) { const x = (r() < 0.5 ? -1 : 1) * (1.1 + r() * 4.5); b.add(new THREE.SphereGeometry(0.035, 6, 5).translate(x, 0.12 + r() * 0.15, 1.2 + r() * 2.2), M("flw" + (i % 3), ["#f4d24a", "#f7f3e8", "#c77ad8"][i % 3])); }
    // sheep in the meadow beyond the wall (screen-right / left fields)
    const fleece = M("fleece", "#f1ede4"), sheepFace = M("sheepFace", "#3a3530");
    for (const [x, z, yaw] of [[-9, 14, 0.4], [-12.5, 18, -0.6], [-7.5, 20, 1.2], [10, 18, -0.3], [14, 22, 0.9]] as const) {
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
      b.add(new THREE.SphereGeometry(0.5, 14, 10).scale(1.25, 0.8, 0.85).translate(0, 0.62, 0), fleece, m);
      b.add(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.15, 1.3).translate(0.62, 0.75, 0), sheepFace, m);
      for (const [lx, lz] of [[0.35, 0.22], [0.35, -0.22], [-0.35, 0.22], [-0.35, -0.22]]) b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6).translate(lx, 0.15, lz), sheepFace, m);
    }
    // the lake: a big sheet of water from z = 26 with a pebble shore, an island, and the fells
    b.add(groundW(-420, 420, 26, 330, 30, 0.03), lam("lakeWater", () => ({ map: rep(water(), 1, 1), color: "#a9c4dc" })));
    b.add(groundW(-420, 420, 24.5, 26.2, 2, 0.022), T("shore", () => stoneHD("shoreHD", ["#cfc6b0", "#bdb39c", "#d9d0bb", "#b1a78f"], "#9a917c")));
    b.add(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(16, 4, 10).translate(48, 0, 90), M("isle", "#6f9a4f"));
    for (let i = 0; i < 7; i++) prop2(i % 2 ? "tree_cone" : "tree_oak", 40 + r() * 16, 2.5, 86 + r() * 8, 7 + r() * 3, i);
    const fells = [M("fellA", "#5f7f45"), M("fellB", "#7a7448"), M("fellC", "#557a42"), M("fellD", "#86714f")];
    ([[-120, 175, 120, 62, 60], [40, 200, 150, 88, 70], [190, 185, 120, 70, 60], [-300, 210, 170, 95, 80], [330, 220, 170, 90, 80], [-40, 260, 220, 125, 90], [240, 280, 200, 115, 90], [-220, 290, 200, 120, 90]] as const)
      .forEach(([x, z, sx, sy, sz], i) => b.add(new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), fells[i % 4], new THREE.Matrix4().compose(V(x, -3, z), new THREE.Quaternion(), V(sx, sy, sz))));
    for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 520, z = 16 + r() * 9; if (Math.abs(x) > 24) prop2(r() < 0.5 ? "tree_oak" : "tree_default", x, 0, z, 6 + r() * 4, r() * 6); }
    for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 600, z = 120 + r() * 40; prop2(r() < 0.6 ? "tree_cone" : "tree_oak", x, 0, z, 12 + r() * 6, r() * 6); }

    // ===== B. a Georgian London street (x = -300): brick terrace with front doors on a stone pavement, iron railings,
    //          lamp posts, a cobbled road
    const SX = -300;
    b.add(groundW(SX - 80, SX + 80, -9, 1.6, 3, 0.012), T("streetCobble", () => cobbleHD()));
    b.add(groundW(SX - 80, SX + 80, 1.6, 5.2, 1.6, 0.03), T("pavement", () => stoneHD("paveHD", ["#c9c3b8", "#bdb6aa", "#d3cdc2", "#b3ad9f"], "#8f897d")));
    box(SX - 80, 0, 1.45, SX + 80, 0.16, 1.62, M("kerb", "#a49d90"));
    const TERR = [{ wall: "#b5543c", shutter: "#2b3a4a", roof: "#8f97a8", brick: true }, { wall: "#a8563f", shutter: "#5a2a2a", roof: "#8f97a8", brick: true }, { wall: "#c06a48", shutter: "#2f5a3a", roof: "#8f97a8", brick: true }];
    for (let k = -7; k <= 7; k++) house(b, SX + k * 5.6, 9.2, Math.PI, 5.6, 8, 8.6 + (k % 2 ? 0.4 : 0), k + 20, 0, TERR[(k + 21) % 3]);
    const iron = M("iron", "#26232c");
    for (let k = -7; k <= 7; k++) { const cx = SX + k * 5.6; for (const [x0, x1] of [[cx - 2.75, cx - 2.35], [cx - 0.45, cx + 2.75]]) { box(x0, 0.95, 4.42, x1, 1.0, 4.48, iron); for (let x = x0; x <= x1 + 1e-3; x += 0.16) box(x - 0.012, 0.03, 4.43, x + 0.012, 1.08, 4.47, iron); } }
    for (let k = -6; k <= 6; k += 2) { const x = SX + k * 5.6 + 2.8; b.add(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 10).translate(x, 1.6, 2.0), iron); box(x - 0.2, 3.2, 1.8, x + 0.2, 3.65, 2.2, glow("streetLamp", "#ffd98a", 0.5)); b.add(new THREE.ConeGeometry(0.3, 0.25, 4).rotateY(Math.PI / 4).translate(x, 3.78, 2.0), iron); }

    // ===== C. the Post Office sorting hall (x = 400): tall cream room, a wall of pigeonholes stuffed with letters, a clock
    //          and crest above, two long sorting tables heaped with letters, mail sacks, hanging lamps, a counter
    const PX = 400;
    room(PX, 9, -9, 7, 10, T("poWall", () => panelTex()), T("poFloor", () => planksHD()), 5);
    box(PX - 6.4, 0, 6.3, PX + 6.4, 6.0, 6.95, wood, 2);
    b.add(quad(V(PX + 6.1, 0.8, 6.28), V(PX - 6.1, 0.8, 6.28), V(PX - 6.1, 5.8, 6.28), V(PX + 6.1, 5.8, 6.28)), lam("pigeon", () => ({ map: pigeonTex() })));
    b.add(new THREE.CircleGeometry(0.75, 36).rotateY(Math.PI).translate(PX, 7.2, 6.94), lam("poClock", () => ({ map: clockTex() })));
    b.add(new THREE.CircleGeometry(0.85, 36).rotateY(Math.PI).translate(PX - 3.6, 7.3, 6.94), lam("crest3", () => ({ map: crestTex() })));
    b.add(new THREE.CircleGeometry(0.85, 36).rotateY(Math.PI).translate(PX + 3.6, 7.3, 6.94), lam("crest3", () => ({ map: crestTex() })));
    for (const x of [PX - 8.96, PX + 8.96]) for (const z of [-3, 2.5]) { const sx = x < PX ? 1 : -1; b.add(quad(V(x, 2.2, z - 1.1), V(x, 2.2, z + 1.1), V(x, 6.6, z + 1.1), V(x, 6.6, z - 1.1)).rotateY(0), lam("poWin", () => ({ map: sashTex(), emissive: "#cfe4f5", emissiveIntensity: 0.35, side: THREE.DoubleSide }))); void sx; }
    for (const z of [2.2, 4.3]) { box(PX - 4.5, 0, z - 0.5, PX + 4.5, 0.9, z + 0.5, wood); box(PX - 4.55, 0.9, z - 0.55, PX + 4.55, 0.96, z + 0.55, M("sortTop", "#7a5a3a"));
      for (let i = 0; i < 12; i++) { const x = PX - 4.0 + i * 0.72 + r() * 0.1, zc = z - 0.15 + r() * 0.3, n = 4 + Math.floor(r() * 9);
        for (let k = 0; k < n; k++) { const ox = (r() - 0.5) * 0.05, oz = (r() - 0.5) * 0.05, y0 = 0.96 + k * 0.022, m = new THREE.Matrix4().makeRotationY((r() - 0.5) * 0.5).setPosition(x + ox, y0 + 0.009, zc + oz);
          b.add(new THREE.BoxGeometry(0.34, 0.016, 0.22), M("letters" + ((i + k) % 4), ["#f3ead2", "#efe2c4", "#f6efe0", "#f3dada"][(i + k) % 4]), m);
          if (k === n - 1 && r() < 0.6) b.add(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 10).translate(0, 0.012, 0), M("waxDot", "#b3262e"), m); } } }
    const sackM = M("sack", "#b89c6a"), tieM = M("sackTie", "#6b4a2e");
    for (const [x, z, s2] of [[PX + 5.6, 1.0, 1], [PX + 6.4, 2.0, 0.9], [PX + 5.2, 2.6, 1.1], [PX - 5.8, 1.6, 1], [PX - 6.6, 2.8, 0.95], [PX + 6.8, 3.8, 1]] as const) {
      b.add(new THREE.SphereGeometry(0.45 * s2, 14, 10).scale(1, 1.25, 0.9).translate(x, 0.5 * s2, z), sackM);
      b.add(new THREE.CylinderGeometry(0.1 * s2, 0.16 * s2, 0.25 * s2, 10).translate(x, 1.08 * s2, z), sackM);
      b.add(new THREE.TorusGeometry(0.12 * s2, 0.03, 6, 14).rotateX(Math.PI / 2).translate(x, 1.02 * s2, z), tieM);
    }
    for (const [x, z] of [[PX - 3, 2.2], [PX + 3, 2.2], [PX - 3, 4.3], [PX + 3, 4.3]]) { b.add(new THREE.CylinderGeometry(0.01, 0.01, 3.5, 4).translate(x, 6.25, z), iron); b.add(new THREE.CylinderGeometry(0.22, 0.32, 0.35, 14).translate(x, 4.4, z), glow("poLamp", "#ffcf7a", 0.9)); }
    box(PX - 8.5, 0, -0.6, PX - 4.8, 1.1, 0.1, wood); box(PX - 8.55, 1.1, -0.65, PX - 4.75, 1.17, 0.15, M("counterTop2", "#5a3b2a"));
    for (let x = PX - 8.4; x <= PX - 4.9; x += 0.14) box(x - 0.012, 1.17, -0.6, x + 0.012, 2.1, -0.56, brass);
    box(PX - 8.5, 2.06, -0.62, PX - 4.8, 2.12, -0.54, brass);

    // ===== D. Rowland Hill's study (x = 460): green damask, bookshelves either side of a sash window, a desk with
    //          papers, an inkwell and an oil lamp, a globe, a framed map
    const HX = 460;
    room(HX, 5, -5, 4.2, 5.5, T("studyWall", () => damaskTex("#5a7a5a", "#526f52")), T("studyFloor", () => planksHD()), 3);
    b.add(groundW(HX - 2.2, HX + 2.2, 0.8, 3.8, 4.4, 0.01), lam("studyRug", () => ({ map: rugTex() })));
    for (const x0 of [HX - 4.6, HX + 1.2]) { box(x0, 0, 3.7, x0 + 3.4, 3.4, 4.15, wood); b.add(quad(V(x0 + 3.3, 0.1, 3.69), V(x0 + 0.1, 0.1, 3.69), V(x0 + 0.1, 3.3, 3.69), V(x0 + 3.3, 3.3, 3.69)), lam("books", () => ({ map: bookTex() }))); }
    b.add(quad(V(HX + 0.85, 1.2, 4.18), V(HX - 0.85, 1.2, 4.18), V(HX - 0.85, 3.6, 4.18), V(HX + 0.85, 3.6, 4.18)), lam("studySash", () => ({ map: sashTex(), emissive: "#cfe4f5", emissiveIntensity: 0.4 })));
    box(HX - 1.3, 0, 1.9, HX + 1.3, 0.76, 2.7, wood); box(HX - 1.35, 0.76, 1.85, HX + 1.35, 0.82, 2.75, M("deskTop", "#3f5a3a"));
    for (let i = 0; i < 5; i++) b.add(quad(V(HX - 0.9 + i * 0.36 + 0.14, 0.83, 2.05 + (i % 2) * 0.1), V(HX - 0.9 + i * 0.36 - 0.14, 0.83, 2.05 + (i % 2) * 0.1), V(HX - 0.9 + i * 0.36 - 0.14, 0.83, 2.45 + (i % 2) * 0.1), V(HX - 0.9 + i * 0.36 + 0.14, 0.83, 2.45 + (i % 2) * 0.1)), M("deskPaper", "#f6efe0"));
    b.add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12).translate(HX + 0.75, 0.87, 2.2), M("inkwell", "#1f2a44"));
    b.add(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 12).translate(HX - 1.0, 1.0, 2.5), brass); b.add(new THREE.SphereGeometry(0.16, 14, 10).scale(1, 1.3, 1).translate(HX - 1.0, 1.32, 2.5), glow("deskLamp", "#ffcf7a", 1.0));
    b.add(new THREE.CylinderGeometry(0.05, 0.25, 0.9, 10).translate(HX + 2.1, 0.45, 1.9), wood); b.add(new THREE.SphereGeometry(0.42, 28, 18).translate(HX + 2.1, 1.3, 1.9), lam("globe", () => ({ map: globeTex() })));
    b.add(new THREE.TorusGeometry(0.47, 0.025, 6, 32).rotateY(0.4).translate(HX + 2.1, 1.3, 1.9), brass);
    box(HX - 0.42, 0, 3.05, HX + 0.42, 1.25, 3.18, M("chairBack", "#7a2630")); b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.13, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(HX, 1.25, 3.115), M("chairBack", "#7a2630"));
    painting(HX - 2.9, 4.4, 4.1, 1.4, 0.9, 2);

    // ===== E. today (x = 520): a dark wooden table, a modern lamp pool, a mug
    const MX = 520;
    room(MX, 6, -6, 5, 6, T("modernWall", () => plasterBrickTex("#c9d3dc")), T("modernFloor", () => planksHD()), 4);
    box(MX - 1.8, 0, 1.5, MX + 1.8, 0.74, 3.5, oakD); box(MX - 1.85, 0.74, 1.45, MX + 1.85, 0.8, 3.55, T("modernTopW", () => planksHD()), 1.5);
    b.add(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 18).translate(MX + 1.1, 0.9, 2.9), M("mug2", "#3f6fb5"));
    b.add(new THREE.CylinderGeometry(0.35, 0.5, 0.35, 24, 1, true).translate(MX - 1.0, 2.6, 2.6), lam("shade2", () => ({ color: "#f2d39a", side: THREE.DoubleSide, emissive: "#ffcf7a", emissiveIntensity: 0.6 })));
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
