// Step 3 checker for story.ts (draft shot plan of the future-job short).
// Run from the repo:  node --experimental-strip-types future-job-short/outputs/03_shots/check_story.mjs
// Checks, against outputs/02_voice/words.json (onset frame = round(s * 30)):
//  1. SHOTS cover 0..TOTAL without gaps; every shot / cut / cue lands 0-3 f before its word; glides are 18-40 f and
//     centred 0-4 f before their word; FLASH_AT and the kicks land where they should.
//  2. Camera motion frame by frame (720p px of a 3x3 grid on the look plane): no static hold of 4+ frames, glide peaks.
//  3. Framing: the named subjects of every camera key projected into the 9:16 frame (u, v from the top-left).
//  4. DOF share of screen time, FOREGROUND props (screen position, distance vs focus distance).
//  5. storyboard.md: the rows cover every frame 0..TOTAL.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./story.ts";

const here = dirname(fileURLToPath(import.meta.url));
const words = JSON.parse(readFileSync(join(here, "../02_voice/words.json"), "utf8"));
const on = (i) => Math.round(words[i].s * S.FPS);
const W = (i) => `${i}:"${words[i].w}"@${on(i)}`;
let errors = 0, warns = 0;
const err = (m) => { errors++; console.log("  ERROR " + m); };
const warn = (m) => { warns++; console.log("  warn  " + m); };
const lead = (f, w) => on(w) - f;

console.log(`story.ts: ${S.SHOTS.length} shots, TOTAL ${S.TOTAL} (${(S.TOTAL / 30).toFixed(2)} s); words.json: ${words.length} words, last ends ${words.at(-1).e} s = frame ${Math.round(words.at(-1).e * 30)}`);

// ---- 1. timing ----
console.log("\n1. timing against words.json");
let prev = 0;
for (const s of S.SHOTS) {
  if (s.a !== prev) err(`shot ${s.id} starts at ${s.a}, previous ends at ${prev}`);
  prev = s.b;
  const l = lead(s.a, s.w);
  if (l < 0 || l > 3) err(`shot ${s.id} a=${s.a}: ${l} f before ${W(s.w)} (want 0-3)`);
}
if (prev !== S.TOTAL) err(`last shot ends at ${prev}, TOTAL ${S.TOTAL}`);
if (S.SHOTS.some((s, i) => s.id !== i + 1)) err("shot ids are not 1..n in order");
const flashLead = lead(S.FLASH_AT, S.SHOTS[1].w);
if (flashLead < 0 || flashLead > 3) err(`FLASH_AT ${S.FLASH_AT}: ${flashLead} f before ${W(S.SHOTS[1].w)}`);
const cutFrames = new Set();
for (const s of S.SHOTS) {
  const keys = S.CAMS[s.id];
  if (!keys) { err(`shot ${s.id} has no CAMS`); continue; }
  const x = S.XFADE[s.id] ?? 0;
  if (keys[0].f > s.a - x / 2) err(`shot ${s.id}: first key ${keys[0].f} starts after the crossfade begins (${s.a - x / 2})`);
  keys.forEach((k, i) => {
    if (i === 0) return;
    if (k.f < s.a || k.f >= s.b) err(`shot ${s.id} key ${k.f} outside the shot ${s.a}-${s.b}`);
    if (k.cut) {
      cutFrames.add(k.f);
      if (k.w !== undefined) { const l = lead(k.f, k.w); if (l < 0 || l > 3) err(`cut ${k.f}: ${l} f before ${W(k.w)}`); }
    } else {
      const d = k.dur ?? 24;
      if (d < 18 || d > 40) err(`glide ${k.f}: dur ${d} (want 18-40)`);
      if (k.w !== undefined) { const c = k.f + d / 2, l = on(k.w) - c; if (l < 0 || l > 4) err(`glide ${k.f}+${d}: centre ${c} is ${l} f before ${W(k.w)} (want 0-4)`); }
      const nx = S.XFADE[s.id + 1] ?? 0;
      if (k.f + d > s.b + nx / 2) warn(`glide ${k.f}+${d} runs past the end of shot ${s.id} (${s.b} + crossfade ${nx / 2})`);
    }
    if (k.w === undefined) warn(`shot ${s.id} key ${k.f} has no word tag`);
  });
}
let cueBad = 0;
for (const c of S.CUES) { const l = lead(c.f, c.w); if (l < 0 || l > 3) { cueBad++; err(`cue ${c.f} ${c.who}: ${l} f before ${W(c.w)} (${c.act})`); } }
console.log(`  ${S.CUES.length} cues checked, ${cueBad} off; ${[...cutFrames].length} cuts inside shots; ${Object.keys(S.XFADE).length} crossfades; flash ${S.FLASH_AT} (${flashLead} f before "Imagine")`);
const src = readFileSync(join(here, "story.ts"), "utf8");
const kicks = [...src.match(/const KICKS[^=]*= \[(.*?)\];/)[1].matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => [+m[1], +m[2]]);
for (const [t0, g] of kicks) {
  const f0 = Math.round(t0 * 30), hit = S.kickAt(f0 / 30), before = S.kickAt((f0 - 1) / 30);
  if (!hit || before) err(`kick ${t0}: kickAt starts at the wrong frame (f${f0}: ${hit.toFixed(2)}, f${f0 - 1}: ${before.toFixed(2)})`);
}
console.log(`  kicks at frames ${kicks.map(([t]) => Math.round(t * 30)).join(", ")}`);
// every cut, crossfade and kick frame vs the nearest word onset, for the sound step
const onsets = words.map((_, i) => on(i));

// ---- 2. camera motion ----
console.log("\n2. camera motion (720p px per frame, 3x3 grid on the look plane)");
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const basis = (c) => {
  const fw = norm(sub(c.look, c.pos)); let rt = norm(cross(fw, [0, 1, 0])); let up = cross(rt, fw);
  const cr = Math.cos(c.roll), sr = Math.sin(c.roll); // roll the image (sign as world.ts may differ; small)
  const rt2 = rt.map((v, i) => v * cr + up[i] * sr), up2 = up.map((v, i) => up[i] * cr - rt[i] * sr);
  return { fw, rt: rt2, up: up2 };
};
const ASPECT = 1080 / 1920;
const project = (c, p) => {
  const { fw, rt, up } = basis(c), v = sub(p, c.pos), z = dot(v, fw);
  const t = Math.tan((c.fov * Math.PI) / 360);
  return { u: 0.5 + dot(v, rt) / (z * t * ASPECT) / 2, v: 0.5 - dot(v, up) / (z * t) / 2, z };
};
const grid = (c) => {
  const { fw, rt, up } = basis(c), d = Math.hypot(...sub(c.look, c.pos)), t = Math.tan((c.fov * Math.PI) / 360);
  const pts = [];
  for (const a of [-0.8, 0, 0.8]) for (const b of [-0.8, 0, 0.8]) pts.push(c.pos.map((p, i) => p + fw[i] * d + rt[i] * a * d * t * ASPECT + up[i] * b * d * t));
  return pts;
};
const speed = (c0, c1) => {
  const g = grid(c0); let s = 0;
  for (const p of g) { const a = project(c0, p), b = project(c1, p); s += Math.hypot((b.u - a.u) * 720, (b.v - a.v) * 1280); }
  return s / g.length;
};
const sp = [];
for (let f = 0; f < S.TOTAL - 1; f++) {
  const s0 = S.shotAt(f), s1 = S.shotAt(f + 1);
  if (s0.id !== s1.id || cutFrames.has(f + 1)) { sp.push(null); continue; }
  sp.push(speed(S.camAt(s0.id, f), S.camAt(s0.id, f + 1)));
}
let run = 0, holds = [];
sp.forEach((v, f) => { if (v !== null && v < 0.3) run++; else { if (run >= 4) holds.push([f - run, f - 1]); run = 0; } });
if (holds.length) holds.forEach(([a, b]) => err(`static hold frames ${a}-${b} (${b - a + 1} f under 0.3 px/f)`));
const valid = sp.filter((v) => v !== null);
const pct = (q) => [...valid].sort((a, b) => a - b)[Math.floor(q * (valid.length - 1))];
console.log(`  frames: ${valid.length}; under 0.3 px/f: ${valid.filter((v) => v < 0.3).length}; median ${pct(0.5).toFixed(2)}, p90 ${pct(0.9).toFixed(1)}, max ${Math.max(...valid).toFixed(1)} px/f (reference: median 3.6, p90 16.9, move peaks p75 25, p90 36)`);
for (const s of S.SHOTS) for (const k of S.CAMS[s.id]) if (!k.cut && k.dur) {
  let pk = 0, pf = 0;
  for (let f = k.f; f < k.f + k.dur; f++) if (sp[f] != null && sp[f] > pk) { pk = sp[f]; pf = f; }
  const msg = `glide ${k.f}+${k.dur} (shot ${s.id}): peak ${pk.toFixed(1)} px/f at ${pf}`;
  if (pk > 36) warn(msg + " (over the reference p90 of 36)"); else console.log("  " + msg);
}

// ---- 3. framing ----
console.log("\n3. framing of every key (u 0..1 left->right, v 0..1 top->bottom; * = outside 0.03..0.97)");
const M = S.MARK, C = S.CROWN, iy = S.iconY, ID = S.ICON.d;
const up = (p, y) => [p[0], p[1] + y, p[2]];
const eyes = (p, cr = C.adult) => up(p, cr - 0.24);
const head = (p, cr = C.adult) => up(p, cr);
const icT = (p, cr = C.adult, d = ID) => up(p, iy(cr, d) + d / 2);
const icB = (p, cr = C.adult, d = ID) => up(p, iy(cr, d) - d / 2);
const atS = S.at;
const SUBJ = {
  "1:0": { "kevin eyes": eyes(M.kevin), "kevin icon top": icT(M.kevin), "kevin waist": up(M.kevin, 0.9), "hero eyes (fg)": eyes(M.heroOTS), "hero crown (fg)": head(M.heroOTS), "student 1 icon": icT(M.students[0]), "student 2 icon": icT(M.students[1]), "student 3 icon": icT(M.students[2]) },
  "1:1": { "kevin eyes": eyes(M.kevin), "kevin icon top": icT(M.kevin), "kevin icon bottom": icB(M.kevin) },
  "1:2": { "hero eyes": eyes(M.heroOTS), "hero crown": head(M.heroOTS), "hero hands (juice)": up(M.heroOTS, 1.0), "kevin eyes (off)": eyes(M.kevin), "space over hero": icT(M.heroOTS) },
  "2:0": { "hero eyes": eyes(M.heroDine, C.seatedAdult), "hero crown": head(M.heroDine, C.seatedAdult), "table top": up(M.heroDine, 0.76) },
  "2:1": { "dad icon top": icT(M.dad, C.seatedAdult), "mom icon top": icT(M.mom, C.seatedAdult), "sister icon top": icT(M.sister, C.seatedKid, S.ICON.dKid), "hero crown": head(M.heroDine, C.seatedAdult), "wrench": M.wrench, "dad eyes": eyes(M.dad, C.seatedAdult) },
  "2:2": { "hero eyes": eyes(M.heroDine, C.seatedAdult), "fork (mouth-0.15)": up(M.heroDine, C.seatedAdult - 0.45) },
  "2:3": { "sister eyes (on chair)": up(M.sister, 0.45 + C.kid - 0.23), "helmet top": up(M.sister, 0.45 + C.kid + 0.12), "sister icon bottom": up(M.sister, 0.45 + iy(C.kid + 0.12, S.ICON.dKid) - 0.18), "rocket overhead": up(M.sister, 0.45 + C.kid + 0.35) },
  "2:4": { "helmet top": up(M.sister, 0.45 + C.kid + 0.12), "sister icon top": up(M.sister, 0.45 + iy(C.kid + 0.12, S.ICON.dKid) + 0.18), "sister eyes": up(M.sister, 0.45 + C.kid - 0.23) },
  "3:0": { "back-left icon top": icT(M.kidsBack[0], C.kid, S.ICON.dKid), "back-right icon top": icT(M.kidsBack[3], C.kid, S.ICON.dKid), "mid-left kid": eyes(M.kidsMid[0], C.kid), "front-left feet": M.kidsFront[0], "front-right feet": M.kidsFront[2] },
  "3:1": { "back-left icon top": icT(M.kidsBack[0], C.kid, S.ICON.dKid), "back-right icon top": icT(M.kidsBack[3], C.kid, S.ICON.dKid), "front icon (seated)": up(M.kidsFront[0], 0.75 + 0.14 + 0.36), "front-left feet": M.kidsFront[0] },
  "4:0": { "kevin icon top": icT(M.kevin4), "kevin eyes": eyes(M.kevin4), "hero eyes": eyes(M.hero4), "hero feet": M.hero4, "kevin feet": M.kevin4 },
  "4:1": { "kevin icon top": icT(M.kevin4), "kevin eyes": eyes(M.kevin4), "locker handle": atS("hall", -1.35, 1.05, 1.15) },
  "4:2": { "kevin icon top": icT(M.kevin4), "kevin eyes": eyes(M.kevin4), "glue stick (chin)": up(M.kevin4, 1.25) },
  "4:3": { "hero eyes": eyes(M.hero5), "bully eyes": eyes(M.bully5a, C.bully), "slam point": atS("hall", -1.35, 1.6, -2.15), "bully icon top": icT(M.bully5a, C.bully) },
  "4:4": { "bully eyes": eyes(M.bully5b, C.bully), "bully icon top": icT(M.bully5b, C.bully), "bully chest patch": up(M.bully5b, 1.35) },
  "4:5": { "bully eyes": eyes(M.bully5b, C.bully), "bully icon top": icT(M.bully5b, C.bully), "icon centre": up(M.bully5b, iy(C.bully)) },
  "5:0": { "hero face (reclined)": atS("dent", 0.4, 1.0, 0), "bully eyes": up(M.bullyDent, 1.68), "bully crown": up(M.bullyDent, C.bully - 0.12), "drill tip": atS("dent", 0.5, 1.15, -0.1) },
  "6:0": { "hero eyes": (f) => [S.SETS.street[0] + S.heroStreetX(f), 1.44, 1.75], "hero feet": (f) => [S.SETS.street[0] + S.heroStreetX(f), 0, 1.75], "stranger icon top": icT(M.stranger, C.seatedAdult) },
  "6:1": { "hero eyes": eyes(M.heroStop), "hero crown": head(M.heroStop), "stranger icon top": icT(M.stranger, C.seatedAdult), "stranger eyes": eyes(M.stranger, C.seatedAdult), "hero knees": up(M.heroStop, 0.5) },
  "6:2": { "icon top": icT(M.stranger, C.seatedAdult), "icon bottom": icB(M.stranger, C.seatedAdult), "stranger crown": head(M.stranger, C.seatedAdult) },
  "7:0": { "manager icon top": icT(M.manager, C.manager + 0.12), "manager eyes": eyes(M.manager, C.manager), "hero crown": head(M.heroBurger), "hero feet": M.heroBurger },
  "7:1": { "manager icon top": icT(M.manager, C.manager + 0.12), "manager eyes": eyes(M.manager, C.manager), "hero eyes": eyes(M.heroBurger), "counter front": atS("burger", 0, 1.05, 0.35) },
  "7:2": { "hero eyes": eyes(M.heroBurger), "hero crown": head(M.heroBurger), "hat in hands": up(M.heroBurger, 1.1), "manager eyes (off)": eyes(M.manager, C.manager) },
  "7:3": { "manager eyes": eyes(M.manager, C.manager), "manager icon top": icT(M.manager, C.manager + 0.12), "coworker eyes": eyes(M.coworker), "coworker icon top": icT(M.coworker) },
  "7:4": { "photo top-left": atS("burger", -2.5, 2.45, -2.95), "photo bottom-right": atS("burger", -2.0, 0.82, -2.95) },
  "7:5": { "oldest photo (top-left)": atS("burger", -2.5, 2.26, -2.95), "its top edge": atS("burger", -2.5, 2.45, -2.95) },
  "8:0": { "hero eyes": eyes(M.heroBath), "hero icon space (none)": icT(M.heroBath), "mirror near edge": atS("bath", 0.42, 1.7, -1.2), "sink top": atS("bath", 0, 0.88, -0.9) },
  "8:1": { "hero eyes": eyes(M.heroBath), "hero crown": head(M.heroBath), "hand on head": up(M.heroBath, 1.75) },
  "8:2": { "reflection eyes": eyes(M.reflection), "reflection chin": up(M.reflection, 1.25), "real hero crown (fg)": head(M.heroMirror), "real hero eyes": eyes(M.heroMirror), "mirror left edge": atS("bath", -0.42, 1.6, -1.2), "mirror right edge": atS("bath", 0.42, 1.6, -1.2), "space over real head": icT(M.heroMirror), "reflection icon bottom": icB(M.reflection) },
  "8:3": { "reflection icon top": icT(M.reflection), "reflection eyes": eyes(M.reflection), "held item (chest)": up(M.reflection, 1.15), "mirror top": atS("bath", 0, 2.32, -1.2), "real hero crown": head(M.heroMirror) },
  "8:4": { "icon top": icT(M.reflection), "icon bottom": icB(M.reflection), "reflection crown": head(M.reflection) },
  "9:0": { "marker start": S.MAP_S, "fork": S.MAP_F, "pin T1 (top)": [S.MAP_T1[0], 1.6, S.MAP_T1[2]], "pin T2 (top)": [S.MAP_T2[0], 1.6, S.MAP_T2[2]] },
  "9:1": { "fork": S.MAP_F, "pin T2 (top)": [S.MAP_T2[0], 1.6, S.MAP_T2[2]], "pin T1 (top)": [S.MAP_T1[0], 1.6, S.MAP_T1[2]], "marker": (f) => S.mapMarker(f), "marker @1610": S.mapMarker(1610) },
  "9:2": { "fork": S.MAP_F, "pin T2": S.MAP_T2, "grid edge left (-6,-4)": S.at("map", -6, 0, -4), "grid edge right (8,-4)": S.at("map", 8, 0, -4) },
  "10:0": { "man eyes": (f) => [S.SETS.road[0] + S.roadX(f), 1.44, 0], "man icon top": (f) => [S.SETS.road[0] + S.roadX(f), iy(C.adult) + 0.21, 0], "man feet": (f) => [S.SETS.road[0] + S.roadX(f), 0, 0], "trail #1 @1660": (f) => [S.SETS.road[0] + S.roadX(1639), iy(C.adult), 0] },
  "10:1": { "man eyes @1720": [S.SETS.road[0] + S.roadX(1720), 1.44, 0], "man icon top": [S.SETS.road[0] + S.roadX(1720), iy(C.adult) + 0.21, 0], "trail #1": [S.SETS.road[0] + S.roadX(1639), iy(C.adult), 0], "trail #6": [S.SETS.road[0] + S.roadX(1664), iy(C.adult), 0], "trail #12": [S.SETS.road[0] + S.roadX(1711), iy(C.adult), 0] },
  "11:0": { "reflection eyes": eyes(M.reflection), "reflection icon top": icT(M.reflection), "reflection shoulders": up(M.reflection, 1.15), "mirror left edge": atS("bath", -0.42, 1.6, -1.2) },
  "11:1": { "reflection eyes": eyes(M.reflection), "reflection mouth": up(M.reflection, 1.32), "icon bottom": icB(M.reflection) },
  "12:0": { "kevin eyes": eyes(M.kevin), "kevin icon top": icT(M.kevin), "kevin waist": up(M.kevin, 0.9), "hero eyes (fg)": eyes(M.heroOTS), "hero crown (fg)": head(M.heroOTS) },
  "12:1": { "kevin eyes": eyes(M.kevin), "kevin icon top": icT(M.kevin), "bin": up(M.bin, 0.7) },
  "12:2": { "kevin eyes (floor)": eyes(M.kevin, C.floorSit), "kevin icon top (floor)": icT(M.kevin, C.floorSit), "feet on backpack": S.at("hall", -0.2, 0.3, 0.7) },
  "12:3": { "icon top": icT(M.kevin, C.floorSit), "icon bottom": icB(M.kevin, C.floorSit), "kevin eyes": eyes(M.kevin, C.floorSit) },
};
for (const s of S.SHOTS) S.CAMS[s.id].forEach((k, i) => {
  const nextF = S.CAMS[s.id][i + 1]?.f ?? s.b;
  const settle = Math.min(i === 0 ? Math.max(k.f, s.a) + 2 : k.cut ? k.f + 2 : k.f + (k.dur ?? 24), nextF - 1);
  const c = S.camAt(s.id, Math.min(settle, s.b - 1));
  const subj = SUBJ[`${s.id}:${i}`] ?? {};
  const parts = Object.entries(subj).map(([n, p0]) => {
    const p = typeof p0 === "function" ? p0(Math.min(settle, s.b - 1)) : p0, q = project(c, p), bad = q.z <= 0 || q.u < 0.03 || q.u > 0.97 || q.v < 0.03 || q.v > 0.97;
    return `${bad ? "*" : ""}${n} ${q.z <= 0 ? "behind" : `${q.u.toFixed(2)},${q.v.toFixed(2)}`}`;
  });
  const d = Math.hypot(...sub(c.look, c.pos));
  console.log(`  ${s.id}:${i} f${k.f}${k.cut ? " cut" : k.dur ? ` glide${k.dur}` : ""} @${settle}  cam [${c.pos.map((v, j) => (v - S.SETS[s.set][j]).toFixed(2))}] d ${d.toFixed(2)} fov ${c.fov}  | ${parts.join(" | ")}`);
});

// ---- 4. lens ----
console.log("\n4. lens");
let dofOn = 0;
for (let f = 0; f < S.TOTAL; f++) if (S.dofAt(f).cInf >= 4) dofOn++;
console.log(`  DOF on (cInf >= 4 px) for ${dofOn} of ${S.TOTAL} frames = ${((100 * dofOn) / S.TOTAL).toFixed(0)} % (reference ~1/3)`);
for (const g of S.FOREGROUND) {
  const f = Math.round((g.a + g.b) / 2), s = S.shotAt(f), c = S.camAt(s.id, f);
  if (g.a < s.a || g.b > s.b) err(`foreground ${g.kit} ${g.a}-${g.b} is not inside shot ${s.id} (${s.a}-${s.b})`);
  const base = project(c, g.pos), top = project(c, [g.pos[0], g.pos[1] + (g.s ?? 1), g.pos[2]]);
  const fd = dot(sub(S.focusAt(s.id, f), c.pos), basis(c).fw);
  console.log(`  fg ${g.kit} ${g.a}-${g.b} (shot ${s.id}): base ${base.u.toFixed(2)},${base.v.toFixed(2)} top ${top.u.toFixed(2)},${top.v.toFixed(2)}; ${base.z.toFixed(2)} m = ${(base.z / fd).toFixed(2)} x focus ${fd.toFixed(2)} m`);
}

// ---- 5. storyboard coverage ----
console.log("\n5. storyboard.md coverage");
try {
  const md = readFileSync(join(here, "storyboard.md"), "utf8");
  const rows = [...md.matchAll(/^\|\s*([0-9]+[a-z]?)\s*\|\s*(\d+)[–-](\d+)\s*\|/gm)].map((m) => ({ id: m[1], a: +m[2], b: +m[3] }));
  let p = 0;
  for (const r of rows) { if (r.a !== p) err(`storyboard row ${r.id} starts at ${r.a}, previous ends at ${p}`); p = r.b; }
  if (p !== S.TOTAL) err(`storyboard ends at ${p}, TOTAL ${S.TOTAL}`);
  console.log(`  ${rows.length} rows, frames 0-${p}`);
} catch (e) { warn("storyboard.md not readable: " + e.message); }

console.log(`\n${errors} errors, ${warns} warnings`);
process.exit(errors ? 1 : 0);
