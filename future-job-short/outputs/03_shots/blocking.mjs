// Blocking preview for the step 3 shot plan: projects the cast (body capsule, head, job icon) and a few set outlines
// through every camera key of story.ts and writes blocking.json for blocking_sheet.py. Grey boxes, not the look.
// Run: node --experimental-strip-types future-job-short/outputs/03_shots/blocking.mjs && python3 future-job-short/outputs/03_shots/blocking_sheet.py
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./story.ts";

const here = dirname(fileURLToPath(import.meta.url));
const words = JSON.parse(readFileSync(join(here, "../02_voice/words.json"), "utf8"));
const TW = 270, TH = 480; // thumbnail = 1080x1920 / 4
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const camBasis = (c) => {
  const fw = norm(sub(c.look, c.pos)), rt0 = norm(cross(fw, [0, 1, 0])), up0 = cross(rt0, fw);
  const cr = Math.cos(c.roll), sr = Math.sin(c.roll);
  return { fw, rt: rt0.map((v, i) => v * cr + up0[i] * sr), up: up0.map((v, i) => v * cr - rt0[i] * sr), t: Math.tan((c.fov * Math.PI) / 360) };
};
const proj = (c, B, p) => {
  const v = sub(p, c.pos), z = dot(v, B.fw);
  return { x: TW / 2 + (dot(v, B.rt) / (z * B.t)) * (TH / 2), y: TH / 2 - (dot(v, B.up) / (z * B.t)) * (TH / 2), z };
};
const pxR = (B, r, z) => (r / (z * B.t)) * (TH / 2);
const A = S.at, C = S.CROWN, M = S.MARK, iy = S.iconY;

// who is on stage: [mark, crown, icon? (d), colour, yOffset(feet), from, to, label]
const P = (m, crown, icon, col, lbl, from = 0, to = 1e9, y0 = 0) => ({ m, crown, icon, col, lbl, from, to, y0 });
const CAST = {
  1: [P(M.kevin, C.adult, S.ICON.d, "#5aa05a", "K"), P(M.heroOTS, C.adult, 0, "#f08a2c", "H"), ...M.students.map((m) => P(m, C.adult, S.ICON.d, "#9a9aa6", "s"))],
  2: [P(M.heroDine, C.seatedAdult, 0, "#f08a2c", "H"), P(M.dad, C.seatedAdult, S.ICON.d, "#5a6ac0", "D", 223), P(M.dad, C.seatedAdult, 0, "#5a6ac0", "D", 0, 223),
      P(M.mom, C.seatedAdult, S.ICON.d, "#c05a8a", "M", 237), P(M.mom, C.seatedAdult, 0, "#c05a8a", "M", 0, 237),
      P(M.sister, C.seatedKid, 0, "#e0c040", "S", 0, 253), P(M.sister, C.seatedKid, S.ICON.dKid, "#e0c040", "S", 253, 315),
      P(M.sister, C.kid + 0.12, S.ICON.dKid, "#e0c040", "S", 315, 1e9, 0.45)],
  3: [...M.kidsBack.map((m) => P(m, C.kid, S.ICON.dKid, "#9a9aa6", "y", 480, 1e9, 0)), ...M.kidsBack.map((m) => P(m, C.kid, 0, "#9a9aa6", "y", 0, 480)),
      ...M.kidsMid.map((m) => P(m, C.kid, S.ICON.dKid, "#9a9aa6", "y", 480)), ...M.kidsMid.map((m) => P(m, C.kid, 0, "#9a9aa6", "y", 0, 480)),
      ...M.kidsFront.map((m) => P(m, 0.75, S.ICON.dKid, "#c8c8d0", "a", 503)), ...M.kidsFront.map((m) => P(m, 0.75, 0, "#c8c8d0", "a", 0, 503))],
  4: [P(M.kevin4, C.adult, S.ICON.d, "#5aa05a", "K", 0, 718), P(M.hero4, C.adult, 0, "#f08a2c", "H", 0, 718),
      P(M.hero5, C.adult, 0, "#f08a2c", "H", 718, 733), P(M.bully5a, C.bully, S.ICON.d, "#a04040", "B", 718, 733),
      P(M.bully5b, C.bully, S.ICON.d, "#a04040", "B", 733)],
  5: [P(M.heroChair, 0.5, 0, "#f08a2c", "H"), P(M.bullyDent, C.bully, 0, "#a04040", "B")],
  6: [P(M.stranger, C.seatedAdult, S.ICON.d, "#7a9a6a", "X")],
  7: [P(M.manager, C.manager + 0.12, S.ICON.d, "#c09040", "Mg"), P(M.heroBurger, C.adult, 0, "#f08a2c", "H"), P(M.coworker, C.adult, S.ICON.d, "#9a9aa6", "c", 1092)],
  8: [P(M.heroBath, C.adult, 0, "#f08a2c", "H", 0, 1294), P(M.heroMirror, C.adult, 0, "#f08a2c", "H", 1294), P(M.reflection, C.adult, S.ICON.d, "#f0a860", "R", 1294)],
  10: [],
  11: [P(M.reflection, C.adult, S.ICON.d, "#f0a860", "R")],
  12: [P(M.kevin, C.adult, S.ICON.d, "#5aa05a", "K", 0, 1947), P(M.kevin, C.floorSit, S.ICON.d, "#5aa05a", "K", 1947), P(M.heroOTS, C.adult, 0, "#f08a2c", "H", 0, 1915)],
};
const rect = (a, b, c, d) => [[a, b], [b, c], [c, d], [d, a]];
const box = (s, x0, x1, y0, y1, z0, z1) => [
  ...rect(A(s, x0, y1, z0), A(s, x1, y1, z0), A(s, x1, y1, z1), A(s, x0, y1, z1)),
  ...rect(A(s, x0, y0, z1), A(s, x1, y0, z1), A(s, x1, y1, z1), A(s, x0, y1, z1)),
];
const SETLINES = {
  hall: [[A("hall", -1.35, 0, -14), A("hall", -1.35, 0, 8)], [A("hall", -1.35, 1.85, -14), A("hall", -1.35, 1.85, 8)],
    ...[-12, -9, -6, -3, 0, 3, 6].map((z) => [A("hall", -1.35, 0, z), A("hall", -1.35, 1.85, z)]),
    ...[-10, -6, -2, 2].flatMap((z) => rect(A("hall", 1.8, 1, z), A("hall", 1.8, 1, z + 2), A("hall", 1.8, 2.7, z + 2), A("hall", 1.8, 2.7, z))),
    [A("hall", -1.8, 3.2, -14), A("hall", -1.8, 3.2, 8)], [A("hall", 1.8, 3.2, -14), A("hall", 1.8, 3.2, 8)], [A("hall", 1.8, 0, -14), A("hall", 1.8, 0, 8)]],
  dine: [...box("dine", -1.2, 0.8, 0, 0.76, -0.45, 0.45), ...rect(A("dine", -3.2, 0.95, -1), A("dine", -3.2, 0.95, 1), A("dine", -3.2, 2.15, 1), A("dine", -3.2, 2.15, -1)),
    [A("dine", -3.2, 0, -3.2), A("dine", -3.2, 0, 3.2)], [A("dine", -3.2, 0, -3.2), A("dine", 4.6, 0, -3.2)], [A("dine", -0.2, 1.95, 0), A("dine", -0.2, 2.7, 0)], ...box("dine", 1.2, 1.7, 0, 0.95, -0.85, -0.35)],
  photo: [...rect(A("photo", -3, 0, -2.3), A("photo", 3, 0, -2.3), A("photo", 3, 3.5, -2.3), A("photo", -3, 3.5, -2.3)), ...box("photo", -1.6, 1.6, 0, 0.5, -1.0, -0.4), ...box("photo", -1.6, 1.6, 0, 1.0, -1.6, -1.0)],
  dent: [...rect(A("dent", -2, 0, -1.5), A("dent", 2, 0, -1.5), A("dent", 2, 3, -1.5), A("dent", -2, 3, -1.5)), ...box("dent", -0.6, 0.8, 0.3, 0.6, -0.3, 0.3)],
  street: [[A("street", -12, 0, 0), A("street", 12, 0, 0)], [A("street", -12, 0, 3.6), A("street", 12, 0, 3.6)], [A("street", -12, 4, 3.6), A("street", 12, 4, 3.6)],
    ...box("street", -1.4, 0.6, 2.4, 2.5, 2.2, 3.0), [A("street", -1.4, 0, 3.0), A("street", -1.4, 2.4, 3.0)], [A("street", 0.6, 0, 3.0), A("street", 0.6, 2.4, 3.0)],
    [A("street", 1.4, 0, 0.45), A("street", 1.4, 2.5, 0.45)], [A("street", -1.37, 0, 0.93), A("street", -1.37, 3.6, 0.93)]],
  burger: [...box("burger", -2.2, 1.6, 0, 1.05, -0.35, 0.35), [A("burger", -3.2, 0, -3), A("burger", 3.6, 0, -3)], [A("burger", -3.2, 3, -3), A("burger", 3.6, 3, -3)],
    ...[-2.5, -2.0].flatMap((x) => [1.0, 1.42, 1.84, 2.26].flatMap((y) => rect(A("burger", x - 0.16, y - 0.19, -2.95), A("burger", x + 0.16, y - 0.19, -2.95), A("burger", x + 0.16, y + 0.19, -2.95), A("burger", x - 0.16, y + 0.19, -2.95)))),
    ...rect(A("burger", -1, 1.2, -2.98), A("burger", 0, 1.2, -2.98), A("burger", 0, 2.2, -2.98), A("burger", -1, 2.2, -2.98)), ...box("burger", 0.9, 1.3, 0, 1.0, -2.9, -2.4),
    ...rect(A("burger", -3.2, 0.6, 4.6), A("burger", 3.6, 0.6, 4.6), A("burger", 3.6, 2.8, 4.6), A("burger", -3.2, 2.8, 4.6)), ],
  bath: [...rect(A("bath", -0.42, 1.08, -1.2), A("bath", 0.42, 1.08, -1.2), A("bath", 0.42, 2.32, -1.2), A("bath", -0.42, 2.32, -1.2)), ...box("bath", -0.5, 0.5, 0, 0.88, -1.2, -0.7),
    ...rect(A("bath", -1.6, 0, -1.2), A("bath", 1.6, 0, -1.2), A("bath", 1.6, 2.6, -1.2), A("bath", -1.6, 2.6, -1.2)), ...rect(A("bath", -1.6, 1, -0.5), A("bath", -1.6, 1, 0.5), A("bath", -1.6, 2, 0.5), A("bath", -1.6, 2, -0.5))],
  map: [[S.MAP_S, S.MAP_F], [S.MAP_F, S.MAP_T1], [S.MAP_F, A("map", 3.2, 0.15, 1)], [A("map", 3.2, 0.15, 1), S.MAP_T2],
    ...[-8, -4, 4, 8].map((x) => [A("map", x, 0, -12), A("map", x, 0, 10)]), ...[-9, -3, 4, 8].map((z) => [A("map", -12, 0, z), A("map", 12, 0, z)])],
  road: [[A("road", -6, 0, -1.2), A("road", 30, 0, -1.2)], [A("road", -6, 0, 1.2), A("road", 30, 0, 1.2)], ...[0, 4, 8, 12, 16].map((x) => [A("road", x, 0, 2.2), A("road", x, 1.6, 2.2)])],
};
// in the mirror shots, draw the mirror world too (the reflection is a card in it)

const frames = [];
for (const s of S.SHOTS) {
  const keys = S.CAMS[s.id];
  keys.forEach((k, i) => {
    const next = keys[i + 1]?.f ?? s.b;
    const settle = Math.min(i === 0 ? Math.max(k.f, s.a) + 4 : k.cut ? k.f + 4 : k.f + (k.dur ?? 24), next - 1, s.b - 1);
    const c = S.camAt(s.id, settle), B = camBasis(c);
    const prims = [];
    for (const [a, b] of SETLINES[s.set] ?? []) {
      const p = proj(c, B, a), q = proj(c, B, b);
      if (p.z > 0.25 && q.z > 0.25) prims.push({ t: "line", a: [p.x, p.y], b: [q.x, q.y], z: Math.min(p.z, q.z) });
    }
    let cast = (CAST[s.id] ?? []).filter((p) => settle >= p.from && settle < p.to).map((p) => ({ ...p, m: [p.m[0], p.m[1] + p.y0, p.m[2]] }));
    if (s.set === "street") cast.push(P([S.SETS.street[0] + S.heroStreetX(settle), 0, 2.0], C.adult, 0, "#f08a2c", "H"));
    if (s.set === "road") {
      const x = S.SETS.road[0] + S.roadX(settle), age = settle < 1680 ? "#7aa0d0" : settle < 1718 ? "#6a80b0" : "#9a9aa6";
      cast.push(P([x, 0, 0], C.adult, settle >= S.ROAD_JOBS[0] ? S.ICON.d : 0, age, "m"));
      S.ROAD_JOBS.slice(0, -1).forEach((fj, j) => { if (settle >= S.ROAD_JOBS[j + 1]) cast.push({ m: [S.SETS.road[0] + S.roadX(fj), 0, 0], crown: C.adult, icon: 0.3, col: null, lbl: "", trail: true }); });
    }
    if (s.set === "map") {
      for (const [p0, lbl] of [[S.mapMarker(settle), "you"], [S.mapPin(settle), "pin"]]) {
        const p = proj(c, B, [p0[0], p0[1] + (lbl === "pin" ? 1.2 : 0.1), p0[2]]);
        if (p.z > 0) prims.push({ t: "disc", c: [p.x, p.y], r: pxR(B, lbl === "pin" ? 0.45 : 0.4, p.z), col: lbl === "pin" ? "#fff2d0" : "#4aa0ff", z: p.z });
      }
    }
    for (const p of cast) {
      if (p.trail) { const q = proj(c, B, [p.m[0], p.m[1] + iy(C.adult), p.m[2]]); if (q.z > 0.25) prims.push({ t: "disc", c: [q.x, q.y], r: pxR(B, 0.15, q.z), col: "#fff2d0", z: q.z }); continue; }
      const feet = proj(c, B, p.m), crown = proj(c, B, [p.m[0], p.m[1] + p.crown, p.m[2]]), headC = proj(c, B, [p.m[0], p.m[1] + p.crown - 0.24, p.m[2]]);
      if (headC.z < 0.25) continue;
      prims.push({ t: "body", a: [feet.x, feet.y], b: [crown.x, crown.y], w: pxR(B, 0.2, headC.z), head: [headC.x, headC.y], hr: pxR(B, 0.25, headC.z), col: p.col, lbl: p.lbl, z: headC.z });
      if (p.icon) {
        const ic = proj(c, B, [p.m[0], p.m[1] + iy(p.crown, p.icon), p.m[2]]);
        prims.push({ t: "disc", c: [ic.x, ic.y], r: pxR(B, p.icon / 2, ic.z), col: "#fff2d0", z: ic.z - 0.01 });
      }
    }
    for (const g of S.FOREGROUND) if (settle >= g.a && settle < g.b) {
      const p = proj(c, B, g.pos), q = proj(c, B, [g.pos[0], g.pos[1] + (g.s ?? 1), g.pos[2]]);
      if (p.z > 0.25) prims.push({ t: "fg", a: [p.x, p.y], b: [q.x, q.y], w: pxR(B, g.kit === "streetLamp" ? 0.08 : 0.25, p.z), z: p.z, lbl: g.kit });
    }
    prims.sort((a, b) => b.z - a.z);
    const wi = words.findIndex((w) => Math.round(w.s * 30) + 1 >= settle);
    const said = words.slice(Math.max(0, wi - 2), wi + 3).map((w) => w.w).join(" ");
    frames.push({ id: `${s.id}${"abcdefgh"[i]}`, f: settle, key: k.f, cut: !!k.cut, glide: k.dur ?? 0, light: s.light, set: s.set, dof: S.dofAt(settle).cInf, said, prims });
  });
}
writeFileSync(join(here, "blocking.json"), JSON.stringify(frames));
console.log(`${frames.length} key frames -> blocking.json`);
