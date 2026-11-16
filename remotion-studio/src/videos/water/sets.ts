// The seven sets of the water short. Each is its own group built around the origin (only the set of the current
// shot is visible), made the way the skill builds its town: merged static batches, every lit material two-tone,
// unlit faces only for screens, window views and lamps. Floor = y 0, cameras look toward -z.
import * as THREE from "three";
import { V, lam, boxGeo, quad, Batch } from "../pointing/geo";
import { twoTone } from "../pointing/shade";
import { planksHD, grassHD, rep } from "../pointing/paint";
import { platformTex, concreteTex, towerTex } from "../pointing/textures";
import * as T from "./tex";

const col = (key: string, c: string) => lam("w_" + key, () => ({ color: c }));
const tex = (key: string, map: () => THREE.Texture) => lam("w_" + key, () => ({ map: map() }));
const steel = (c: string) => twoTone(new THREE.MeshPhongMaterial({ color: c, specular: "#9a9a9a", shininess: 50 }), 0.15);
const unlit = (map: THREE.Texture | null, color: THREE.ColorRepresentation = "#ffffff") => new THREE.MeshBasicMaterial({ map, color, fog: false });

class Kit {
  b = new Batch();
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material, tile = 0, bottom = false) { this.b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile, bottom), m); }
  /** upright cylinder / cone frustum: r0 at the bottom, r1 at the top */
  cyl(x: number, y0: number, y1: number, z: number, r0: number, r1: number, m: THREE.Material, seg = 24) {
    this.b.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), m, new THREE.Matrix4().makeTranslation(x, (y0 + y1) / 2, z));
  }
  ball(x: number, y: number, z: number, r: number, m: THREE.Material, sy = 1, detail = 2) {
    this.b.add(new THREE.IcosahedronGeometry(r, detail), m, new THREE.Matrix4().makeScale(1, sy, 1).setPosition(x, y, z));
  }
  floor(x0: number, x1: number, z0: number, z1: number, y: number, m: THREE.Material, u = 1, v = 1) { this.b.add(quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), u, v), m); }
  /** wall facing +z */
  wallZ(x0: number, x1: number, y0: number, y1: number, z: number, m: THREE.Material, u = 1, v = 1) { this.b.add(quad(V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z), u, v), m); }
  /** wall facing +x */
  wallX(z0: number, z1: number, y0: number, y1: number, x: number, m: THREE.Material, u = 1, v = 1) { this.b.add(quad(V(x, y0, z1), V(x, y0, z0), V(x, y1, z0), V(x, y1, z1), u, v), m); }
  /** wall facing -x */
  wallXn(z0: number, z1: number, y0: number, y1: number, x: number, m: THREE.Material, u = 1, v = 1) { this.b.add(quad(V(x, y0, z0), V(x, y0, z1), V(x, y1, z1), V(x, y1, z0), u, v), m); }
  tree(x: number, z: number, h: number, m: THREE.Material, y = 0) { this.box(x - 0.16, y, z - 0.16, x + 0.16, y + h * 0.5, z + 0.16, col("bark", "#8a5a3c")); this.ball(x, y + h * 0.72, z, h * 0.42, m, 1.12); }
  build(g: THREE.Group, cast = true) { this.b.build(g, cast); }
}
const plane = (w: number, h: number, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; return me;
};
const disc = (r: number, m: THREE.Material, x: number, y: number, z: number) => {
  const me = new THREE.Mesh(new THREE.CircleGeometry(r, 48), m); me.rotation.x = -Math.PI / 2; me.position.set(x, y, z); me.receiveShadow = true; return me;
};
const GRASS = () => lam("w_grass", () => ({ map: grassHD(), color: "#8fa07c" }));
const WOOD = () => col("wood", "#b07a4c"), WOOD2 = () => col("wood2", "#8a5a3c"), WHITE = () => col("white", "#f4f1ea"), DARK = () => col("dark", "#2a2c3a");
const LEAF = () => col("leaf", "#6aa860"), LEAF2 = () => col("leaf2", "#548a5c"), POT = () => col("pot", "#c9653f");

// ---------------- 1. your bedroom ----------------
export function buildRoom() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-4, 4, -3, 6, 0, tex("rmFloor", () => planksHD()), 2.4, 2.7);
  const paper = tex("rmPaper", () => T.wallpaperTex("#a9cbe0", "#9cc0d8"));
  k.wallZ(-4, 4, 0, 3.7, -3, paper, 5, 2.3); k.wallX(-3, 6, 0, 3.7, -4, paper, 5.6, 2.3);
  k.box(-4, 0, -3, 4, 0.14, -2.94, WHITE()); k.box(-4, 0, -3, -3.94, 0.14, 6, WHITE());
  // window + curtains
  for (const [x0, y0, x1, y1] of [[0.82, 1.07, 2.78, 1.15], [0.82, 2.75, 2.78, 2.83], [0.82, 1.07, 0.9, 2.83], [2.7, 1.07, 2.78, 2.83], [1.77, 1.15, 1.83, 2.75], [0.9, 1.92, 2.7, 1.98]]) k.box(x0, y0, -3, x1, y1, -2.9, WHITE());
  const cur = tex("rmCurtain", () => rep(T.curtainTex("#f0a04a", "#d9792c"), 0.5, 1));
  k.box(0.45, 0.95, -2.97, 0.92, 2.95, -2.84, cur); k.box(2.68, 0.95, -2.97, 3.15, 2.95, -2.84, cur); k.box(0.35, 2.95, -2.96, 3.25, 3.02, -2.86, WOOD2());
  const glassDay = plane(1.8, 1.6, unlit(T.windowTex(false)), 1.8, 1.95, -2.985), glassNight = plane(1.8, 1.6, unlit(T.windowTex(true), new THREE.Color(1.5, 1.5, 1.7)), 1.8, 1.95, -2.985);
  g.add(glassDay, glassNight);
  // bed
  k.box(-3.85, 0, -2.9, -1.75, 0.32, 0.3, WOOD()); k.box(-3.85, 0, -2.99, -1.75, 1.25, -2.86, WOOD());
  k.box(-3.8, 0.32, -2.85, -1.8, 0.55, 0.25, WHITE()); k.box(-3.45, 0.55, -2.78, -2.15, 0.76, -2.2, col("pillow", "#fbf8f0"));
  k.box(-3.84, 0.5, -2.18, -1.76, 0.76, 0.29, tex("rmBlanket", () => T.blanketTex()));
  // nightstand + lamp + glass of water
  k.box(-1.6, 0, -2.92, -0.95, 0.62, -2.3, WOOD2()); k.cyl(-1.28, 0.62, 0.66, -2.6, 0.12, 0.12, DARK()); k.cyl(-1.28, 0.66, 0.95, -2.6, 0.02, 0.02, DARK());
  k.cyl(-1.28, 0.95, 1.2, -2.6, 0.2, 0.11, col("shade", "#f6d98a"));
  // desk, laptop, chair
  k.box(1.9, 0.72, -2.92, 3.75, 0.79, -2.0, WOOD());
  for (const [x, z] of [[1.96, -2.86], [3.63, -2.86], [1.96, -2.1], [3.63, -2.1]]) k.box(x, 0, z, x + 0.07, 0.72, z + 0.07, WOOD2());
  k.box(2.45, 0.79, -2.6, 3.15, 0.82, -2.15, DARK()); k.box(2.45, 0.82, -2.66, 3.15, 1.27, -2.62, DARK());
  g.add(plane(0.62, 0.38, unlit(null, new THREE.Color(0.75, 0.9, 1.1)), 2.8, 1.045, -2.615));
  k.box(2.35, 0.44, -1.85, 2.95, 0.5, -1.3, col("chair", "#d9453c")); k.box(2.35, 0.5, -1.36, 2.95, 1.12, -1.3, col("chair", "#d9453c"));
  for (const [x, z] of [[2.38, -1.82], [2.87, -1.82], [2.38, -1.36], [2.87, -1.36]]) k.box(x, 0, z, x + 0.05, 0.44, z + 0.05, DARK());
  // poster, shelf with books, plant
  k.wallZ(-3.35, -2.05, 1.72, 2.72, -2.985, tex("rmPoster", () => T.posterTex()));
  k.box(-3.98, 2.0, 1.0, -3.62, 2.06, 3.0, WOOD2());
  ["#e2453c", "#3f73b8", "#f2bd2a", "#3f9c62", "#7b5ac9", "#f08a2c", "#2fa3a0"].forEach((c, i) => k.box(-3.95, 2.06, 1.1 + i * 0.2, -3.68, 2.06 + 0.38 + 0.08 * (i % 3), 1.26 + i * 0.2, col("book" + i, c)));
  k.cyl(3.4, 0, 0.5, 0.9, 0.2, 0.27, POT()); k.ball(3.4, 1.0, 0.9, 0.55, LEAF(), 1.2);
  k.build(g);
  const rug = disc(1.55, tex("rmRug", () => T.rugTex()), 0.3, 0.006, 1.3); g.add(rug);
  return { g, glassDay, glassNight };
}

// ---------------- 2. the robot's office ----------------
export function buildOffice() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-5, 5, -2.6, 6, 0, tex("ofFloor", () => T.tileTex("#e6e1d6", "#d6d0c4", "of")), 5, 4.3);
  const wall = col("ofWall", "#3fa7a3");
  k.wallZ(-5, 5, 0, 7, -2.6, wall); k.wallX(-2.6, 6, 0, 7, -5, wall); k.wallXn(-2.6, 6, 0, 7, 5, wall);
  k.box(-5, 0, -2.6, 5, 0.16, -2.53, WHITE());
  // window into the server hall
  k.wallZ(-3.3, 3.3, 1.15, 3.15, -2.585, tex("ofRacks", () => rep(T.rackTex(), 2.9, 1)));
  for (const [x0, y0, x1, y1] of [[-3.42, 1.03, 3.42, 1.15], [-3.42, 3.15, 3.42, 3.27], [-3.42, 1.03, -3.3, 3.27], [3.3, 1.03, 3.42, 3.27], [-0.06, 1.15, 0.06, 3.15]]) k.box(x0, y0, -2.6, x1, y1, -2.5, WHITE());
  // desk
  k.box(-1.55, 0, 0.2, 1.55, 0.76, 1.0, col("ofDesk", "#e9dcc6")); k.box(-1.7, 0.76, 0.08, 1.7, 0.85, 1.12, WOOD());
  // water cooler, plant, filing cabinet
  k.box(2.5, 0, -2.3, 3.2, 1.1, -1.6, WHITE()); k.cyl(2.85, 1.1, 1.85, -1.95, 0.3, 0.3, col("jug", "#7cc4f5")); k.cyl(2.85, 1.85, 1.95, -1.95, 0.3, 0.12, col("jug", "#7cc4f5"));
  k.box(2.7, 0.55, -1.61, 3.0, 0.75, -1.58, col("tap", "#3f73b8"));
  k.cyl(-3.6, 0, 0.55, -1.8, 0.22, 0.3, POT()); k.ball(-3.6, 1.15, -1.8, 0.62, LEAF2(), 1.25);
  k.box(-2.9, 0, -2.4, -2.1, 1.25, -1.8, col("cab", "#f2bd2a")); for (const y of [0.42, 0.84]) k.box(-2.9, y, -1.81, -2.1, y + 0.03, -1.79, DARK());
  k.build(g);
  return { g };
}

// ---------------- 3. the server hall ----------------
export function buildServers() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-3.2, 3.2, -30, 7, 0, tex("svFloor", () => T.tileTex("#3a4466", "#333c5c", "sv")), 5, 29);
  const rack = tex("svRack", () => T.rackTex());
  k.box(-2.7, 0, -30, -1.7, 2.3, 4.5, rack, 2.3); k.box(1.7, 0, -30, 2.7, 2.3, 4.5, rack, 2.3);
  k.box(-2.75, 2.3, -30, -1.65, 2.38, 4.5, DARK()); k.box(1.65, 2.3, -30, 2.75, 2.38, 4.5, DARK());
  k.wallZ(-3.2, 3.2, 0, 4, -30, col("svEnd", "#2a3350"));
  for (let z = 2; z > -30; z -= 4) { k.box(-1.2, 3.25, z - 0.05, 1.2, 3.31, z + 0.05, DARK()); for (const x of [-0.9, 0.9]) k.box(x - 0.03, 2.86, z - 0.03, x + 0.03, 3.25, z + 0.03, DARK()); }
  // a low cabinet the pan sits on
  k.box(0.55, 0, 0.3, 1.45, 0.92, 1.0, col("svCab", "#465078")); k.box(0.5, 0.92, 0.25, 1.5, 0.98, 1.05, DARK());
  k.build(g);
  // two pipes under the cable tray: cold blue that turns hot red (material colour is animated)
  const pipeMat = twoTone(new THREE.MeshPhongMaterial({ color: "#3aa0e8", specular: "#a0a0a0", shininess: 60 }), 0.15);
  for (const x of [-0.9, 0.9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 37, 20), pipeMat); p.rotation.x = Math.PI / 2; p.position.set(x, 2.72, -11.5); p.castShadow = true; p.receiveShadow = true; g.add(p); }
  // strip lights (HDR so they bloom)
  const lights: THREE.Mesh[] = [];
  for (let z = 0; z > -30; z -= 4) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.9, 2.4), fog: false })); l.position.set(0, 3.2, z - 2); g.add(l); lights.push(l); }
  return { g, pipeMat, lights };
}

// ---------------- 4. outside: the town, the data center, the power plant ----------------
export function buildOutside() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-500, 500, -500, 300, -0.02, GRASS(), 160, 130);
  k.floor(-200, 200, 13, 21, 0.01, col("exRoad", "#7d7986")); k.floor(-26, 26, -8, 13, 0.012, tex("exPave", () => platformTex()), 21, 8.7);
  for (let x = -190; x < 190; x += 9) k.floor(x, x + 4, 16.8, 17.2, 0.02, col("exDash", "#f4f1ea"));
  // the data center: dynamic facade material (it turns red when it overheats), roof plant, three cooling towers
  const facade = twoTone(new THREE.MeshLambertMaterial({ map: T.dcTex() }));
  const dc = new THREE.Mesh(boxGeo(V(-22, 0, -34), V(22, 13, -8), 0), facade); dc.castShadow = true; dc.receiveShadow = true; g.add(dc);
  k.box(-22.4, 13, -34.4, 22.4, 13.6, -7.6, col("exRoofcap", "#aab4c2"));
  for (const x of [-17, -6, 5, 16]) k.box(x - 2.2, 13.6, -30, x + 2.2, 15.2, -26, col("exUnit", "#c9d0da"));
  const tower = col("exTower", "#e6e1d6");
  const towerAt = (x: number, z: number, r: number, h: number, y: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(r * (0.62 + 0.38 * ((t - 0.68) / 0.68) ** 2), t * h)); }
    k.b.add(new THREE.LatheGeometry(pts, 28), tower, new THREE.Matrix4().makeTranslation(x, y, z));
  };
  const TOWERS: [number, number, number][] = [[-11, 18.6, -18], [0, 18.6, -18], [11, 18.6, -18]]; // puff origins (x, y, z)
  for (const [x, , z] of TOWERS) towerAt(x, z, 3.6, 5.0, 13.6);
  // fence and gate posts
  for (let x = -26; x <= 26; x += 4) k.box(x - 0.08, 0, 12.4, x + 0.08, 1.6, 12.56, DARK());
  k.box(-26, 1.45, 12.44, 26, 1.55, 12.52, DARK()); k.box(-26, 0.8, 12.44, 26, 0.88, 12.52, DARK());
  // the town on the left with its water tower
  const walls = ["#f1e3c6", "#e8b08a", "#f0d27a", "#d9e3ee", "#f1e3c6", "#e3a48c"], roofs = ["#c0553d", "#7d5a8a", "#b5653f", "#5d7a8a"];
  const houses: [number, number, number, number, number][] = [[-70, -6, 9, 8, 6], [-58, -12, 8, 8, 7], [-47, -4, 9, 7, 5.5], [-64, 6, 8, 7, 5.5], [-52, 6, 9, 8, 6.5], [-78, 4, 8, 8, 6], [-44, -18, 8, 8, 6.5], [-74, -18, 9, 8, 7]];
  houses.forEach(([x, z, w, d, h], i) => {
    k.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, tex("exHouse" + (i % 6), () => T.houseTex(walls[i % 6], "" + (i % 6))));
    const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.55, 4); roof.rotateY(Math.PI / 4);
    k.b.add(roof, col("exRoof" + (i % 4), roofs[i % 4]), new THREE.Matrix4().makeTranslation(x, h + h * 0.275, z));
  });
  const WT: [number, number, number] = [-35, 0, 2]; // water tower base
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) k.box(WT[0] + dx - 0.22, 0, WT[2] + dz - 0.22, WT[0] + dx + 0.22, 9.2, WT[2] + dz + 0.22, steel("#5d6a7c"));
  k.box(WT[0] - 2.5, 4.4, WT[2] - 2.5, WT[0] + 2.5, 4.7, WT[2] + 2.5, steel("#5d6a7c"));
  const tank = new THREE.Group(); tank.position.set(WT[0], 9.2, WT[2]);
  const tk = new Kit(); tk.cyl(0, 0, 5, 0, 3.4, 3.4, col("exTank", "#7cc4f5")); tk.cyl(0, 5, 6.6, 0, 3.7, 0.3, col("exTankRoof", "#d9453c"));
  tk.cyl(0, 1.6, 2.2, 0, 3.46, 3.46, WHITE()); tk.build(tank); g.add(tank);
  for (let i = 0; i < 12; i++) k.tree(-84 + (i * 37) % 52, -26 + ((i * 53) % 44), 4.2 + (i % 3) * 0.6, i % 2 ? LEAF() : LEAF2());
  // the power plant on the right: block, striped chimney, one big cooling tower, pylons and a wire to the data center
  k.box(30, 0, -30, 46, 11, -12, tex("exPlant", () => rep(towerTex("0", "#cfc6b8", "#4f6d99", "#ffe9a8"), 1, 0.5)));
  k.box(29.6, 11, -30.4, 46.4, 11.7, -11.6, col("exRoofcap", "#aab4c2"));
  for (let i = 0; i < 8; i++) k.cyl(34, 11.7 + i * 3.4, 11.7 + (i + 1) * 3.4, -24, 1.5 - i * 0.05, 1.45 - i * 0.05, col("exStack" + (i % 2), i % 2 ? "#f4f1ea" : "#d9453c"), 18);
  towerAt(56, -20, 9, 20, 0);
  const PLANT_PUFF: [number, number, number] = [56, 20.5, -20];
  const pyl = steel("#5d6a7c");
  for (const x of [26]) { k.box(x - 0.2, 0, -14.2, x + 0.2, 12, -13.8, pyl); k.box(x - 2.2, 10.6, -14.1, x + 2.2, 10.9, -13.9, pyl); k.box(x - 1.5, 8.8, -14.1, x + 1.5, 9.05, -13.9, pyl); }
  for (const [x0, x1] of [[22, 26], [26, 30]]) for (const dz of [-0.1, 0.1]) k.box(x0, 10.55, -14 + dz - 0.03, x1, 10.62, -14 + dz + 0.03, DARK());
  // hills on the horizon
  for (const [x, z, r] of [[-120, -190, 90], [20, -230, 120], [150, -200, 100], [-30, -260, 140]]) k.ball(x, -r * 0.62, z, r, col("exHill", "#8fb58a"), 1, 3);
  k.build(g);
  // night-only: lit window band and entrance lamps (HDR, bloom)
  const night = new THREE.Group();
  for (let i = 0; i < 15; i++) { if (i > 4 && i < 10) continue; night.add(plane(2.0, 0.9, unlit(null, new THREE.Color(2.4, 2.0, 1.1)), -22 + (60 + i * 132 + 48) * (44 / 2048), 13 - (50 / 640) * 13, -7.96)); }
  houses.forEach(([x, z, w, d, h], i) => { if (i % 2 === 0) night.add(plane(1.4, 1.2, unlit(null, new THREE.Color(2.2, 1.7, 0.8)), x - w * 0.24, h * 0.67, z + d / 2 + 0.03)); });
  g.add(night);
  // the giant drinking straw from the data center roof to the town's water tank (S8 only)
  const curve = new THREE.CatmullRomCurve3([V(-10, 3.75, -7.5), V(-12, 9.5, -3.5), V(-19, 17, -1), V(-27, 20.5, 0.5), V(-33, 19.2, 1.6), V(-35, 15.6, 2), V(-35, 12, 2)]);
  const straw = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.55, 14), twoTone(new THREE.MeshLambertMaterial({ map: rep(T.strawTex(), 18, 1) })));
  straw.castShadow = true; g.add(straw);
  return { g, facade, tank, night, straw, strawCurve: curve, TOWERS, PLANT_PUFF, WT };
}

// ---------------- 5. the stage ----------------
export function buildStage() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-7, 7, -3.2, 7, 0, tex("stgFloor", () => planksHD()), 4, 3);
  k.wallZ(-7, 7, 0, 7, -3.2, tex("stgCurtain", () => rep(T.curtainTex("#b5343a", "#7d1f2c"), 2.4, 1)));
  k.box(-7, 0, -3.2, -5.4, 7, -2.6, tex("stgCurtain2", () => rep(T.curtainTex("#c53d42", "#8a2330"), 0.5, 1))); k.box(5.4, 0, -3.2, 7, 7, -2.6, tex("stgCurtain2", () => rep(T.curtainTex("#c53d42", "#8a2330"), 0.5, 1)));
  k.box(-2.75, 1.45, -3.15, 2.75, 4.65, -3.02, DARK());
  k.box(-7, -0.5, 3.4, 7, 0, 3.6, WOOD2());
  k.build(g);
  const spoon = plane(5.2, 2.95, unlit(T.screenTex("spoon"), new THREE.Color(1.15, 1.15, 1.15)), 0, 3.05, -3.0), heart = plane(5.2, 2.95, unlit(T.screenTex("heart"), new THREE.Color(1.15, 1.15, 1.15)), 0, 3.05, -3.0);
  g.add(spoon, heart);
  // a server rack that pays out coins (S18 only)
  const rack = new THREE.Group(), rk = new Kit();
  rk.box(-0.55, 0, -0.5, 0.55, 2.1, 0.5, tex("stgRack", () => rep(T.rackTex(), 0.33, 1))); rk.box(-0.6, 2.1, -0.55, 0.6, 2.18, 0.55, DARK()); rk.build(rack);
  rack.position.set(2.3, 0, -0.4); g.add(rack);
  return { g, spoon, heart, rack };
}

// ---------------- 6. the lab ----------------
export function buildLab() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-300, 300, -300, 300, -0.03, col("lbGround", "#b9c9b0"));
  k.floor(-5, 5.5, -2.7, 6, 0, tex("lbFloor", () => T.tileTex("#f1ede3", "#dfe7ea", "lb")), 5.2, 4.3);
  const wall = col("lbWall", "#cfe6dc");
  k.wallZ(-5, 5.5, 0, 3.5, -2.7, wall); k.wallX(-2.7, 6, 0, 3.5, -5, wall);
  k.box(-5, 0, -2.7, 5.5, 0.15, -2.63, WHITE()); k.box(-5, 3.5, -2.9, 5.5, 3.62, -2.6, WHITE());
  k.box(-3.05, 0.95, -2.7, 1.25, 2.85, -2.6, WOOD2()); k.wallZ(-2.9, 1.1, 1.1, 2.7, -2.595, tex("lbBoard", () => T.boardTex())); k.box(-3.0, 0.98, -2.6, 1.2, 1.05, -2.45, WOOD());
  // bench with cupboards, flasks and a rack of tubes
  k.box(-0.3, 0, -0.45, 3.9, 0.86, 0.55, col("lbCup", "#3fa7a3")); k.box(-0.4, 0.86, -0.55, 4.0, 0.94, 0.65, WHITE());
  for (const x of [0.6, 1.5, 2.4, 3.3]) k.box(x - 0.02, 0.1, 0.55, x + 0.02, 0.8, 0.57, DARK());
  k.cyl(2.9, 0.94, 1.22, -0.1, 0.2, 0.05, col("lbFlaskA", "#7b5ac9")); k.cyl(2.9, 1.22, 1.4, -0.1, 0.05, 0.05, col("lbGlass", "#dff0fb"));
  k.cyl(3.45, 0.94, 1.16, 0.05, 0.16, 0.04, col("lbFlaskB", "#3f9c62")); k.cyl(3.45, 1.16, 1.3, 0.05, 0.04, 0.04, col("lbGlass", "#dff0fb"));
  k.box(-0.15, 0.94, -0.25, 0.45, 0.99, -0.05, WOOD()); ["#e2453c", "#f2bd2a", "#3f73b8", "#3f9c62"].forEach((c, i) => k.cyl(-0.06 + i * 0.14, 0.99, 1.24, -0.15, 0.04, 0.04, col("lbTube" + i, c), 12));
  // cupboard and a stool
  k.box(-4.9, 0, -2.6, -3.5, 2.3, -2.0, WHITE()); k.box(-4.22, 0.1, -2.0, -4.18, 2.2, -1.98, DARK()); k.cyl(4.7, 0, 0.62, 1.0, 0.05, 0.05, DARK(), 10); k.cyl(4.7, 0.62, 0.7, 1.0, 0.24, 0.24, col("lbStool", "#d9453c"));
  k.build(g);
  // the bottle on the bench: its water is a separate mesh so the level can drop
  const bottle = new THREE.Group(); bottle.position.set(1.5, 0.94, 0.05);
  const bk = new Kit(); bk.cyl(0, 0.62, 0.74, 0, 0.19, 0.07, col("lbBottle", "#dff0fb")); bk.cyl(0, 0.74, 0.82, 0, 0.075, 0.075, col("lbCap", "#2f6fd0"), 16); bk.build(bottle);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.62, 28, 1, true), twoTone(new THREE.MeshLambertMaterial({ color: "#dff0fb", side: THREE.BackSide })));
  shell.position.y = 0.31; bottle.add(shell);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.6, 28).translate(0, 0.3, 0), twoTone(new THREE.MeshLambertMaterial({ color: "#3aa0e8" })));
  water.position.y = 0.012; water.castShadow = true; bottle.add(water);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), twoTone(new THREE.MeshLambertMaterial({ color: "#c9d6e2" }))); rim.position.y = 0.015; bottle.add(rim);
  g.add(bottle);
  return { g, bottle, water };
}

// ---------------- 7. the field: balance scale, burger, cow, lake ----------------
export function buildField() {
  const g = new THREE.Group(), k = new Kit();
  k.floor(-400, 400, -400, 200, -0.02, GRASS(), 130, 100);
  for (const [x, z, r] of [[-90, -150, 80], [40, -190, 110], [150, -160, 90]]) k.ball(x, -r * 0.6, z, r, col("fdHill", "#9cc08a"), 1, 3);
  // barn, fence, trees
  k.box(-19, 0, -26, -9, 6, -18, col("fdBarn", "#c5453c")); k.box(-15.2, 0, -18, -12.8, 3.6, -17.9, col("fdDoor", "#f4f1ea"));
  const roof = new THREE.CylinderGeometry(5.6, 5.6, 8.6, 3, 1); roof.rotateX(Math.PI / 2); roof.rotateZ(Math.PI / 2 + Math.PI / 6);
  k.b.add(roof, col("fdRoof", "#5d5266"), new THREE.Matrix4().makeScale(1, 0.55, 1).setPosition(-14, 7.5, -22));
  for (let x = -40; x <= 44; x += 3) k.box(x - 0.08, 0, -13.1, x + 0.08, 1.2, -12.9, WOOD());
  for (const y of [0.45, 0.95]) k.box(-40, y, -13.05, 44, y + 0.12, -12.95, WOOD());
  for (let i = 0; i < 9; i++) k.tree(-34 + i * 9.5 + (i % 2) * 2, -20 - (i % 3) * 5, 5 + (i % 3) * 0.9, i % 2 ? LEAF() : LEAF2());
  // the balance: base, post, pivot
  k.box(-0.9, 0, -0.5, 0.9, 0.3, 0.5, col("fdBase", "#5d5266")); k.box(-0.16, 0.3, -0.16, 0.16, 2.6, 0.16, col("fdPost", "#f2bd2a")); k.cyl(0, 2.5, 2.9, 0, 0.3, 0.3, col("fdBase", "#5d5266"), 16);
  k.build(g);
  const lake = disc(6.5, twoTone(new THREE.MeshLambertMaterial({ map: rep(T.lakeTex(), 2, 2) })), 15, 0.02, -7), shore = disc(7.2, twoTone(new THREE.MeshLambertMaterial({ color: "#d9c89a" })), 15, 0.008, -7);
  g.add(shore, lake);
  // beam and pans (animated)
  const beam = new THREE.Group(); beam.position.set(0, 2.7, 0);
  const bk = new Kit(); bk.box(-2.3, -0.1, -0.12, 2.3, 0.1, 0.12, col("fdBeam", "#f2bd2a")); bk.build(beam); g.add(beam);
  const pan = () => { const p = new THREE.Group(), pk = new Kit(); pk.cyl(0, -1.75, -1.6, 0, 1.25, 1.35, steel("#c9d0da"), 32); for (const [dx, dz] of [[-1.1, 0], [1.1, 0], [0, -1.1], [0, 1.1]]) { const a = V(dx, -1.6, dz), c = V(0, 0, 0), geo = new THREE.BoxGeometry(0.04, a.distanceTo(c), 0.04); geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1))); pk.b.add(geo, DARK()); } pk.build(p); g.add(p); return p; };
  const panL = pan(), panR = pan();
  // the burger (about 1.5 m across)
  const burger = new THREE.Group(), uk = new Kit();
  const dome = (r: number, h: number, y: number, m: THREE.Material, flip = false) => { const pts: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; pts.push(new THREE.Vector2(r * Math.cos(a), (flip ? -1 : 1) * h * Math.sin(a))); } if (flip) pts.reverse(); uk.b.add(new THREE.LatheGeometry(pts, 32), m, new THREE.Matrix4().makeTranslation(0, y, 0)); };
  dome(0.74, 0.2, 0.2, col("fdBun", "#e0a35a"), true); uk.cyl(0, 0.2, 0.3, 0, 0.74, 0.74, col("fdBun", "#e0a35a"), 32);
  uk.cyl(0, 0.3, 0.5, 0, 0.8, 0.8, col("fdPatty", "#6b3a22"), 32);
  const cheese = new THREE.BoxGeometry(1.35, 0.05, 1.35); cheese.rotateY(Math.PI / 4); uk.b.add(cheese, col("fdCheese", "#f6c33a"), new THREE.Matrix4().makeTranslation(0, 0.525, 0));
  uk.cyl(0, 0.55, 0.62, 0, 0.84, 0.86, col("fdLettuce", "#62ae4c"), 14); uk.cyl(0, 0.62, 0.7, 0, 0.7, 0.7, col("fdTomato", "#e2453c"), 32);
  uk.cyl(0, 0.7, 0.74, 0, 0.75, 0.75, col("fdBun", "#e0a35a"), 32); dome(0.75, 0.46, 0.74, col("fdBun", "#e0a35a"));
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.18 + 0.05 * (i % 4); uk.ball(r * Math.cos(a) * 2.2, 0.74 + 0.46 * Math.sqrt(Math.max(0, 1 - (r * 2.2 / 0.75) ** 2)) + 0.005, r * Math.sin(a) * 2.2, 0.045, col("fdSeed", "#fbe9c2"), 0.5, 1); }
  uk.build(burger); g.add(burger);
  return { g, beam, panL, panR, burger, lake, shore };
}

export type Sets = { room: ReturnType<typeof buildRoom>; office: ReturnType<typeof buildOffice>; servers: ReturnType<typeof buildServers>; outside: ReturnType<typeof buildOutside>;
  stage: ReturnType<typeof buildStage>; lab: ReturnType<typeof buildLab>; field: ReturnType<typeof buildField> };
export const buildSets = (): Sets => ({ room: buildRoom(), office: buildOffice(), servers: buildServers(), outside: buildOutside(), stage: buildStage(), lab: buildLab(), field: buildField() });
void concreteTex;
