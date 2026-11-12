// Timeline of the future-job short, timed to the voice words (outputs/02_voice/words.json, voice.wav 67.0 s).
// DRAFT from step 3 (shot plan). It replaces templates/bridge/story.ts and keeps the exports the renderer and the QA
// scripts read: SHOTS / XFADE / FLASH_AT / layersAt, CAMS -> camAt / keyEnd, KICKS -> kickAt, DOF -> dofAt / focusAt,
// FOREGROUND. The bridge physics is gone; added: the sets and character marks (contract for build.ts / cast.ts), the
// icon geometry, the walk paths, and CUES, the word-locked acting / icon events cast.ts plays.
// Camera grammar (skill motion.md): cuts only on big jumps (> half a frame width or > 40 % zoom) and at place changes
// (6-8 f crossfades, one white 4-frame flash after the hook); everything else is a symmetric smootherstep glide of
// 18-40 f centred ~2 f before its word; every hold creeps in (0.15-0.35 %/f, ~0.6 %/f for 30-40 f on punch words);
// 7-frame flip kicks on impacts; no hand-held float.
// Every visual reaction lands 0-3 frames before its word. `w` = index of that word in words.json. Run
// `node --experimental-strip-types outputs/03_shots/check_story.mjs` after any change: it checks every `w` against
// words.json, the glide lengths, the creeping holds and the framing of every key.
export const FPS = 30;
export const TOTAL = 2010; // = voice.wav (67.0 s); last word "boss." ends at frame 2001
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ---------------- sets and marks (metres, y up; every set has its own origin, far from the others) ----------------
export type SetName = "hall" | "dine" | "photo" | "dent" | "street" | "burger" | "bath" | "map" | "road";
export const SETS: Record<SetName, V3> = {
  hall: [0, 0, 0], //       school hallway: corridor along z, x -1.8..1.8; lockers on the left wall (fronts x = -1.35),
  //                        windows on the right wall (x = 1.8, sill 1.0, top 2.7), ceiling 3.2, double doors at z = +12
  dine: [100, 0, 0], //     dining room x -3.2..4.6, z -3.2..3.2, ceiling 2.7; table 2.0 (x) x 0.9 (z), top 0.76, centre
  //                        (-0.2, 0); pendant lamp over it at y 1.95; window on the x = -3.2 wall behind Dad (dusk)
  photo: [200, 0, 0], //    photo-day corner: mottled blue backdrop at z = -2.3, bleacher steps 0.5 (z -1.0..-0.4) and 1.45 (z -1.8..-1.2)
  dent: [300, 0, 0], //     daydream dentist corner: mint tile wall at z = -1.5, chair along x (head at +x), lamp on an arm
  street: [400, 0, 0], //   street along x: sidewalk z 0..3.2 (y 0), road z < 0 (y -0.15), shopfronts from z = 3.6 (painted
  //                        interiors, no reflecting glass);
  //                        open bus shelter x -1.4..0.6 with a solid painted back panel at z = 3.0 (no glass)
  burger: [500, 0, 0], //   counter along x (x -2.2..1.6, z -0.35..0.35, top 1.05); kitchen on the back wall z = -3.0
  //                        (fryer x 1.1, grill x 0.2, drive-thru window x -1.0..0.0); photo wall x -2.75..-1.75 on it;
  //                        storefront windows on the front wall z = +4.6 (sunset), room x -3.2..3.6
  bath: [600, 0, 0], //     bathroom x -1.6..1.6, z -1.2..1.8, ceiling 2.6; mirror on the back wall z = -1.2,
  //                        x -0.42..0.42, y 1.08..2.32; bulb above it; window on the x = -1.6 wall (night).
  //                        Mirror = opening into a copy of the room mirrored about z = -1.2 (+ mirrored hero card)
  map: [700, 0, 0], //      GPS diorama: navy ground, glowing cream roads 1.2 m wide, toy blocks with lit windows
  road: [800, 0, 0], //     "life road" along +x, 2.4 m wide, night-blue meadow, low hills, roadside lamps
};
export const at = (s: SetName, x: number, y: number, z: number): V3 => [SETS[s][0] + x, SETS[s][1] + y, SETS[s][2] + z];

/** crown heights (m) of the cards as they stand in this film (adult build = 3.5 head heights, 1000 units = 2.16 m) */
export const CROWN = { adult: 1.68, kid: 1.33, bully: 1.98, manager: 1.84, seatedAdult: 1.31, seatedKid: 1.15, floorSit: 0.95 };
/** floating job icon: cream disc + ink ring + soft warm glow, camera-facing, bobs 1.5 s. A picture, never text.
 *  d = 0.42 m (0.8 head width; STORY.md's "40 %" is too small to read a two-figure picture at MS on a phone) */
export const ICON = { d: 0.42, dKid: 0.36, gap: 0.16, bobS: 1.5, bobAmp: 0.025, popF: 6, flipF: 8 };
export const iconY = (crown: number, d = ICON.d) => crown + ICON.gap + d / 2;

/** where everyone stands (world coordinates; facing in the comment). Positions may be cheated between cuts. */
export const MARK = {
  // hallway (hook, beats 4-5, payoff)
  kevin: at("hall", -0.75, 0, 0), //          at his own locker (yellow dot, door open), faces +z (3/4 to the corridor)
  heroOTS: at("hall", -0.97, 0, 0.7), //      hook + payoff: by the next locker, faces Kevin (back 3/4 to the 1a camera)
  students: [at("hall", -0.6, 0, -4.5), at("hall", -0.15, 0, -6.5), at("hall", -0.95, 0, -9.0)] as V3[], // still, chatting
  kevin4: at("hall", -0.9, 0, 1.4), //        tugging a locker that is not his (blue dot), faces -x then turns +x
  hero4: at("hall", -0.4, 0, 1.85), //        leans in to hint, faces -x
  hero5: at("hall", -1.05, 0, -2.4), //       back to the lockers, faces +x
  bully5a: at("hall", -0.45, 0, -2.6), //     the slam (arm to the locker beside the hero's head), faces -x
  bully5b: at("hall", 0.2, 0, -2.75), //      looming, seen from the hero's low eye-line (cheated 0.7 m back; hero card hidden: POV)
  bin: at("hall", -1.15, 0, -0.7), //         trash can beside Kevin's locker (homework lands here, beat 11)
  // dining room (evening)
  heroDine: at("dine", 0.1, 0, 0.72), //      seated, faces -z
  mom: at("dine", -0.45, 0, -0.72), //        seated, faces +z
  sister: at("dine", 0.45, 0, -0.72), //      seated (2b); standing on her chair (seat 0.45) from the cut at 315
  dad: at("dine", -1.45, 0, 0), //            seated at the head of the table, faces +x
  wrench: at("dine", -1.05, 0.77, 0.12), //   real wrench by Dad's plate (the silent gag)
  // photo day: 8 YouTuber kids on gym bleachers (middle row on 0.5 m, back row on 1.45 m so their faces clear the middle
  // row's icons; back heads sit between the middle icons),
  // 3 astronaut kids sitting cross-legged on the floor in front
  kidsMid: [-0.85, -0.35, 0.15, 0.65].map((x) => at("photo", x, 0.5, -0.7)) as V3[],
  kidsBack: [-0.6, -0.1, 0.4, 0.9].map((x) => at("photo", x, 1.45, -1.5)) as V3[],
  kidsFront: [-0.5, 0, 0.5].map((x) => at("photo", x, 0, 0.35)) as V3[],
  // dentist daydream
  heroChair: at("dent", 0.35, 0.55, 0), //    reclined, head at +x, looks up at the bully
  bullyDent: at("dent", 0.75, 0, -0.5), //    leans over the chair with the drill
  // street (late afternoon)
  stranger: at("street", -0.35, 0, 2.55), //  sits on the bench reading, faces -z (the street)
  heroStop: at("street", 0.1, 0, 2.0), //     where the hero stops walking, turned to her
  busSign: at("street", 1.4, 0, 0.45), //     pole with a bus pictogram plate (unlit material)
  // burger place (golden)
  manager: at("burger", 0.3, 0, -0.75), //    behind the counter, faces +z (3/4 toward the hero)
  heroBurger: at("burger", 1.3, 0, 0.6), //   customer side at the right end of the counter, faces the manager (back 3/4 to 7a-7b)
  coworker: at("burger", 1.05, 0, -0.75), //  the swapping co-worker slot (each has an icon of their own: not a paper hat)
  photoWall: at("burger", -2.25, 1.65, -2.95), // 2 columns x 4 rows of employee-of-the-month frames (blank plaques)
  // bathroom (night)
  heroBath: at("bath", 0, 0, -0.6), //        brushing at the sink (8a-8b), faces the mirror (-z)
  heroMirror: at("bath", 0, 0, -0.1), //      stepped back to see over his own head (8c on, 11), 1.1 m from the mirror
  reflection: at("bath", 0, 0, -2.3), //      mirrored heroMirror card in the mirror room, faces +z; ONLY it has an icon
};

// ---------------- moving subjects ----------------
/** frames of travel left before a stop at s, with an 8-frame ease-out into the stop (continuous speed) */
const toStop = (f: number, s: number) => { const n = Math.max(0, s - f); return n >= 8 ? n - 4 : (n * n) / 16; };
/** street: the hero walks toward -x along z = 2.0 at 1.4 m/s (screen left -> right for the street camera) and stops
 *  at x = 0.1 (MARK.heroStop) on "stranger's" (frame 866) */
export const heroStreetX = (f: number) => 0.1 + (1.4 / FPS) * toStop(f, 866);
/** life road: the man power-walks toward +x at 2.4 m/s (3 steps/s, 0.8 m stride) from frame 1612 and eases to a halt
 *  on "fifty-eight" (frame 1718, x = 8.16) */
export const ROAD_V = 2.4;
export const roadX = (f: number) => (ROAD_V / FPS) * (toStop(1612, 1718) - toStop(Math.max(f, 1612), 1718));
/** the 13 jobs of the "about 13 jobs by 58" montage (F1; F2: over 40 % of them before 25, so the first six come fast).
 *  #1 pops, #2-13 flip; each old icon stays hanging over the road where it flipped (a countable trail). */
export const ROAD_JOBS = [1639, 1644, 1649, 1654, 1659, 1664, 1672, 1680, 1688, 1696, 1704, 1711, 1718];
/** GPS diorama: the "you" chevron drives S -> fork F (1508-1560), turns right there on "turn." (1572) and heads for
 *  the new pin spot along the right branch (F -> corner (3.2, 1) -> T2) */
export const MAP_S = at("map", 0, 0.15, 5), MAP_F = at("map", 0, 0.15, 1), MAP_T1 = at("map", 0, 0, -5), MAP_T2 = at("map", 3.2, 0, -4);
export const mapMarker = (f: number): V3 => {
  if (f < 1560) { const k = smooth((f - 1508) / 52); return [MAP_S[0], MAP_S[1], lerp(MAP_S[2], MAP_F[2], k)]; }
  const k = clamp01((f - 1560) / 50) * 8.2; // 3.2 m along +x, then 5 m along -z
  return k < 3.2 ? [MAP_F[0] + k, MAP_F[1], MAP_F[2]] : [MAP_F[0] + 3.2, MAP_F[1], MAP_F[2] - (k - 3.2)];
};
/** the destination pin: sits on T1, hops in an arc to T2 and lands on "turn." (frame 1572) */
export const mapPin = (f: number): V3 => {
  const k = clamp01((f - 1558) / 14);
  return [lerp(MAP_T1[0], MAP_T2[0], smooth(k)), MAP_T1[1] + 2.2 * Math.sin(Math.PI * k), lerp(MAP_T1[2], MAP_T2[2], smooth(k))];
};

// ---------------- shots ----------------
export type Light = "day" | "lamp" | "golden" | "nightblue";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; w: number; sunAz?: number; sunEl?: number };
// a = first frame (0-3 f before word w), b = end (exclusive). Crossfades straddle a (XFADE).
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 123, light: "day", set: "hall", w: 0 }, //               hook (flash-forward to the hallway)
  { id: 2, a: 123, b: 418, light: "lamp", set: "dine", w: 13 }, //           "Imagine you're seventeen" ... sister
  { id: 3, a: 418, b: 556, light: "day", set: "photo", w: 46 }, //           "In one survey" (cutaway)
  { id: 4, a: 556, b: 813, light: "day", set: "hall", w: 61 }, //            "Next day" Kevin, then the bully
  { id: 5, a: 813, b: 841, light: "day", set: "dent", w: 99 }, //            "YOUR dentist" daydream
  { id: 6, a: 841, b: 963, light: "day", set: "street", w: 101, sunAz: 35, sunEl: 20 }, // late afternoon: low sun ahead-right
  { id: 7, a: 963, b: 1213, light: "golden", set: "burger", w: 119 }, //     "At work" (sunset through the windows)
  { id: 8, a: 1213, b: 1479, light: "nightblue", set: "bath", w: 151 }, //   "That night" mirror twist + "You see,"
  { id: 9, a: 1479, b: 1615, light: "nightblue", set: "map", w: 184 }, //    "It's a GPS"
  { id: 10, a: 1615, b: 1741, light: "nightblue", set: "road", w: 199 }, //  "Americans born around 1960..."
  { id: 11, a: 1741, b: 1857, light: "nightblue", set: "bath", w: 210 }, //  "Luckily / Unluckily"
  { id: 12, a: 1857, b: TOTAL, light: "day", set: "hall", w: 222 }, //       payoff, next morning (framed like the hook)
];
/** crossfades (frames) at place/time changes; shot 2 starts under the white flash, shot 5 is a hard cut (daydream) */
export const XFADE: Record<number, number> = { 3: 8, 4: 8, 6: 8, 7: 8, 8: 8, 9: 8, 10: 6, 11: 8, 12: 6 };
export const FLASH_AT = 123; // white 4-frame flash ends the hook (3 f before "Imagine")

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; w?: number; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (peak speed = 1.875 x distance / dur) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** camera on a sphere around the look point: az = degrees from +z toward +x (0 = camera on the +z side looking -z,
 *  90 = on the +x side looking -x), el = degrees above the look point (negative = low angle looking up), d = metres */
export const orbit = (look: V3, az: number, el: number, d: number, rest: Partial<Cam> = {}): Shot => {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  return { pos: [look[0] + d * Math.sin(a) * Math.cos(e), look[1] + d * Math.sin(e), look[2] + d * Math.cos(a) * Math.cos(e)], look, ...rest };
};
type Look = V3 | ((f: number) => V3);
const L = (l: Look, f: number): V3 => (typeof l === "function" ? l(f) : l);
/** a framing: orbit(look, az, el, d) dollying in toward the look point from f0 (rate per frame, punch for n frames) */
const F = (look: Look, az: number, el: number, d: number, fov: number, roll: number, f0: number, rate = 0.0025, punch = 0, n = 35) =>
  (f: number): Shot => orbit(L(look, f), az, el, d * pushK(f, f0, rate, punch, n), { fov, roll });

const H = (x: number, y: number, z: number) => at("hall", x, y, z);
const D = (x: number, y: number, z: number) => at("dine", x, y, z);
const B = (x: number, y: number, z: number) => at("burger", x, y, z);
const W = (x: number, y: number, z: number) => at("bath", x, y, z);
const kevinCrownSlump = CROWN.floorSit; // beat 11: Kevin slides down to sit on the floor against the lockers

// ---- shot 1, hallway, day: the hook ----
// 1a OTS medium on Kevin + his icon (frame 0 already shows it) just left of centre, the corridor and the students'
//    icons behind on the right; the hero's hood and hair tuft soft at the left edge (back 3/4). 1b icon close-up.
//    1c the hero's reaction (3/4 front, Kevin out of frame; no icon over the hero, ever).
const S1a = F(H(-0.68, 1.72, 0), 6, 2, 2.75, 40, 0, 0, 0.0025);
const S1b = F(H(-0.75, 1.86, 0), 24, -5, 1.75, 38, 0, 70, 0.002, 0.006, 30);
const S1c = F(H(-0.97, 1.47, 0.7), 118, 0, 1.8, 40, 0, 100, 0.002, 0.006, 23);
// ---- shot 2, dining room, evening lamp ----
const S2a = F(D(0.1, 1.08, 0.72), 130, 6, 2.3, 40, 0, 123, 0.0025); //        MS hero alone at the table
const S2b = F(D(-0.5, 1.15, -0.1), 90, 15, 4.9, 46, 0, 176, 0.0018); //        WS from the table end: everyone
const S2c = F(D(0.1, 1.12, 0.72), 158, 3, 1.45, 38, 0, 265, 0.003); //         CU hero, fork frozen
const S2d = F(D(0.45, 1.22, -0.72), 25, -4, 2.1, 40, 0.07, 315, 0.0025); //     sister on her chair, low angle, dutch (icon just above frame)
const S2e = F(D(0.45, 1.92, -0.72), 25, -6, 2.3, 40, 0.07, 359, 0.002, 0.006, 45); // tilt up to her icon
// ---- shot 3, photo-day cutaway ----
const S3a = F(at("photo", 0.03, 1.62, -0.6), 0, 4, 5.8, 44, 0, 414, 0.0015);
const S3b = F(at("photo", 0.03, 1.7, -0.6), 0, 4, 4.7, 44, -0.06, 516, 0.002);
// ---- shot 4, hallway, next day: Kevin, then the bully ----
const S4a = F(H(-0.65, 1.45, 1.62), 138, 3, 3.2, 40, 0, 552, 0.002); //        two-shot: hero left, Kevin right
const S4b = F(H(-0.9, 1.72, 1.4), 112, 0, 2.4, 40, 0, 596, 0.0025); //          Kevin MS: "Me?"
const S4c = F(H(-0.9, 1.72, 1.4), 100, -3, 2.0, 38, 0, 649, 0.003); //          Kevin CU: glue stick
const S5a = F(H(-0.85, 1.62, -2.5), 180, 0, 3.0, 40, -0.08, 718, 0.002); //     profile two-shot: the slam, dutch
const S5b = F(H(0.2, 1.85, -2.75), 290, -22, 1.7, 44, 0.07, 733, 0.002, 0.006, 40); // bully from the hero's low eye-line
const S5c = F(H(0.2, 2.22, -2.75), 290, -22, 1.6, 44, 0.05, 777, 0.002, 0.006, 30); //  up to the tooth icon
// ---- shot 5, dentist daydream (cool mint tiles + white lamp; no icons inside daydreams) ----
const S5d = F(at("dent", 0.45, 1.25, -0.15), 20, -10, 2.0, 42, -0.05, 813, 0.003);
// ---- shot 6, street, late afternoon ----
const S6a = F((f) => at("street", heroStreetX(f) - 0.4, 1.25, 2.0), 180, 5, 4.4, 42, 0, 837, 0.0015);
const S6b = F(at("street", -0.12, 1.3, 2.27), 231, 3, 3.2, 40, 0, 852, 0.0025); // side-by-side two-shot from the road
const S6c = F(at("street", -0.35, iconY(CROWN.seatedAdult), 2.55), 205, 0, 1.3, 34, 0, 919, 0.002, 0.006, 42);
// ---- shot 7, burger place, golden ----
const S7a = F(B(0.75, 1.45, -0.1), 20, 8, 4.4, 42, 0, 959, 0.0015); //          WS: manager centre-left, hero foreground right (back 3/4)
const S7b = F(B(0.75, 1.5, -0.1), 20, 4, 3.4, 40, 0, 968, 0.002); //             two-shot across the counter: the hat, the arm sweep
const S7c = F(B(1.3, 1.4, 0.6), 160, 2, 2.0, 40, 0, 1068, 0.003); //             hero CU from the staff side: looks down at the hat
const S7d = F(B(0.67, 1.62, -0.75), 0, 2, 3.0, 40, 0, 1092, 0.002); //           frontal: co-workers come and go
const S7e = F(B(-2.25, 1.65, -2.95), 18, 0, 2.8, 40, 0, 1176, 0.002); //         the photo wall
const S7f = F(B(-2.45, 2.05, -2.95), 18, -3, 1.9, 40, 0, 1178, 0.002, 0.006, 30); // up to the oldest photo
// ---- shot 8, bathroom, night-blue ----
// The mirror is FOGGED (he showered): it shows a soft blur until he wipes it on "YOUR" and "head?", so no clear
// reflection of the hero exists before the twist. Brushing (8a-8b) he stands at the sink; from 8c he has stepped
// back 1.1 m. Cameras behind him sit high (2.2 m) so his real head (no icon above it) is at the bottom of the frame
// and the reflection is above it (a level OTS in 9:16 would put his head over the reflection); cameras for mirror
// close-ups sit between him and the mirror (he is then behind the lens).
const S8a = F(W(0, 1.42, -0.6), 90, 2, 1.9, 40, 0, 1209, 0.0025); //             profile, brushing (mirror out of frame)
const S8b = F(W(0, 1.55, -0.6), 105, -5, 1.45, 40, 0, 1248, 0.003); //           CU from the front-right (mirror grazing)
const S8c = F(W(0, 1.5, -2.3), 3.5, 13, 3.4, 44, 0, 1294, 0.0015); //            high OTS: real head bottom, reflection face
const S8d = F(W(0, 1.85, -2.3), 3.5, 6.5, 3.3, 44, 0, 1300, 0.0015); //          tilt up: the icon (then the flips)
const S9a = F(W(0, 2.02, -2.3), 3, -1, 1.6, 34, 0, 1427, 0.002, 0.006, 30); //   icon insert through the mirror
// ---- shot 9, GPS diorama, night-blue ----
const S9b = F(at("map", 0.4, 0, 0), 0, 55, 16, 40, 0, 1475, 0.002); //           marker S, fork, pin T1 in one frame
const S9c = F(at("map", 1.4, 0, -1.0), -6, 55, 13.5, 40, 0, 1556, 0.002); //     glide right toward the new pin
const S9d = F(at("map", 1.4, 0, -3.0), -4, 66, 34, 42, 0, 1582, 0.0015); //      crane up: "People turn a lot."
// ---- shot 10, life road, night-blue ----
const S10a = F((f) => at("road", roadX(f) + 0.3, 1.5, 0), 0, 3, 4.3, 40, 0, 1612, 0.0012); // truck alongside, man on the left third
const S10b = F(at("road", 6.8, 1.7, 0), 71, 3, 5.0, 42, 0, 1706, 0.002); //     3/4 ahead: the man walks at us, the trail behind him
// ---- shot 11, bathroom, night-blue ----
const S11a = F(W(0, 1.72, -2.3), 3, 2, 1.95, 40, 0, 1737, 0.0025); //             the reflection, camera between him and the mirror
const S11b = F(W(0, 1.68, -2.3), 3, 1, 1.55, 40, 0.07, 1792, 0.002, 0.005, 30);
// ---- shot 12, hallway, next morning (framed like the hook) ----
const S12a = F(H(-0.68, 1.72, 0), 6, 2, 2.75, 40, 0, 1854, 0.0022);
const S12b = F(H(-0.75, 1.6, 0), 10, 2, 2.5, 40, 0, 1915, 0.0025);
const S12c = F(H(-0.75, 1.0, 0.1), 12, 4, 2.6, 40, 0, 1942, 0.0025); //          follows him down to the floor
const S12d = F(H(-0.75, iconY(kevinCrownSlump) - 0.18, 0.1), 10, -4, 1.5, 38, 0, 1969, 0.002, 0.006, 41);

export const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, w: 0, s: S1a }, //                     "You can see everyone's future job," (the icons are there from frame 0)
    { f: 70, cut: true, w: 9, s: S1b }, //         "friend's": cut to the icon close-up (tiny Kevin boss, tiny you + coffee)
    { f: 100, cut: true, w: 12, s: S1c }, //       "boss.": cut to the hero's reaction (+ kick, juice squirt)
  ],
  2: [
    { f: 123, w: 13, s: S2a }, //                  under the flash: "Imagine you're seventeen,"
    { f: 176, cut: true, w: 19, s: S2b }, //       "family dinner": the whole table (pops on "pops", "over", "head")
    { f: 265, cut: true, w: 29, s: S2c }, //       "their job in ten years": hero CU, fork frozen
    { f: 315, cut: true, w: 34, s: S2d }, //       "Your sister announces": low angle on her chair
    { f: 359, dur: 34, w: 43, s: S2e }, //         glide centred on "picture": follows the rocket up from the helmet to her icon
  ],
  3: [
    { f: 414, w: 46, s: S3a }, //                  crossfade in: the class-photo risers
    { f: 516, dur: 24, w: 58, s: S3b }, //         punch-in + roll centred on "three"
  ],
  4: [
    { f: 552, w: 61, s: S4a }, //                  crossfade in: "Next day, you hint to Kevin."
    { f: 596, dur: 24, w: 67, s: S4b }, //         glide centred on "Me?"
    { f: 649, dur: 24, w: 75, s: S4c }, //         glide centred on "This guy"
    { f: 718, cut: true, w: 84, s: S5a }, //       "Then": the locker slam (+ kick)
    { f: 733, cut: true, w: 87, s: S5b }, //       "bully:": the low angle
    { f: 777, dur: 24, w: 98, s: S5c }, //         glide centred on "dentist."
  ],
  5: [{ f: 813, w: 99, s: S5d }], //               "YOUR dentist.": hard cut to the daydream
  6: [
    { f: 837, w: 101, s: S6a }, //                 crossfade in: walking to work (truck)
    { f: 852, dur: 28, w: 107, s: S6b }, //        glide centred on "stranger's": two-shot at the bus stop
    { f: 919, cut: true, w: 112, s: S6c }, //      "It's a job that doesn't exist yet": icon insert
  ],
  7: [
    { f: 959, w: 119, s: S7a }, //                 crossfade in: "At work,"
    { f: 968, dur: 30, w: 122, s: S7b }, //        glide centred on "manager"
    { f: 1068, cut: true, w: 132, s: S7c }, //     "could be yours.": hero CU, looks down at the hat
    { f: 1092, cut: true, w: 135, s: S7d }, //     "The typical restaurant worker...": co-workers swap
    { f: 1176, cut: true, w: 147, s: S7e }, //     "He's been here nineteen.": the photo wall
    { f: 1178, dur: 24, w: 150, s: S7f }, //       glide centred on "nineteen."
  ],
  8: [
    { f: 1209, w: 151, s: S8a }, //                crossfade in: "That night, it hits you."
    { f: 1248, cut: true, w: 156, s: S8b }, //     "Wait...": CU, eyes up, pats his head
    { f: 1294, cut: true, w: 161, s: S8c }, //     "what's over YOUR head?": OTS into the mirror
    { f: 1300, dur: 24, w: 164, s: S8d }, //       glide centred on "head?": the icon is revealed
    { f: 1427, cut: true, w: 176, s: S9a }, //     "You see,": icon insert (crystal ball, cracks)
  ],
  9: [
    { f: 1475, w: 184, s: S9b }, //                crossfade in (match dissolve icon -> pin): "It's a GPS:"
    { f: 1556, dur: 30, w: 194, s: S9c }, //       glide centred on the turn ("turn." 1574, pin lands 1572)
    { f: 1582, dur: 36, w: 198, s: S9d }, //       crane up centred on "lot."; finishes inside the crossfade
  ],
  10: [
    { f: 1612, w: 199, s: S10a }, //               crossfade in: "Americans born around 1960" (truck)
    { f: 1706, cut: true, w: 207, s: S10b }, //    "by age fifty-eight": reverse, the trail of 13 icons behind him
  ],
  11: [
    { f: 1737, w: 210, s: S11a }, //               crossfade in: "Luckily,"
    { f: 1792, dur: 18, w: 217, s: S11b }, //      punch + roll centred on "Unluckily,"
  ],
  12: [
    { f: 1854, w: 222, s: S12a }, //               crossfade in: "So you tell Kevin he's going to be your boss."
    { f: 1915, dur: 24, w: 233, s: S12b }, //      glide centred on "He's so"
    { f: 1942, dur: 28, w: 237, s: S12c }, //      follows him down after "stops", arrives on "trying."
    { f: 1969, cut: true, w: 238, s: S12d }, //    "Now you're HIS boss.": icon close-up, the flip lands on "boss."
  ],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
// t0 = frame / 30 rounded DOWN to 4 decimals, so both kickAt() and bridge_shots.py land on the intended frame.
const KICKS: [number, number][] = [[3.3333, 0.8], [21.3333, 0.4], [23.9333, 1.2], [41.1333, 0.4], [66.3666, 0.6]];
// 100 "boss." juice squirt | 640 "locker." handle comes off | 718 "Then" locker slam | 1234 "hits" bulb flare | 1991 final flip
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const Ln = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * Ln * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Reference: DOF on ~1/3 of screen time (CU, inserts, foreground-framed OTS); establishing, wides, busy beats sharp.
 *  Here: on 37 % of frames. focus = world point (else the camera look point). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const eyesOf = (p: V3, crown = CROWN.adult) => (): V3 => [p[0], p[1] + crown - 0.24, p[2]];
const iconOf = (p: V3, crown = CROWN.adult) => (): V3 => [p[0], p[1] + iconY(crown), p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 10, focus: eyesOf(MARK.kevin) }, //                  1a OTS: hero's hood soft, students' icons soft discs
  { f: 70, cInf: 14, focus: iconOf(MARK.kevin) }, //                 1b icon CU
  { f: 100, cInf: 0 }, //                                            1c reaction MS, 2a, 2b WS: sharp
  { f: 265, cInf: 13, focus: eyesOf(MARK.heroDine, CROWN.seatedAdult) }, // 2c hero CU
  { f: 315, cInf: 0 }, //                                            2d-2e sister, 3 photo, 4a-4b: sharp
  { f: 649, dur: 24, cInf: 13, focus: eyesOf(MARK.kevin4) }, //      4c Kevin CU (ramps with the glide)
  { f: 718, cInf: 0 }, //                                            5a-5c: sharp (the slam, the low angle)
  { f: 813, cInf: 12 }, //                                           dentist daydream, focus = look
  { f: 841, cInf: 0 }, //                                            street walk + two-shot: sharp
  { f: 919, cInf: 16, focus: iconOf(MARK.stranger, CROWN.seatedAdult) }, // 6c the strange icon
  { f: 963, cInf: 0 }, //                                            burger place: sharp (busy, golden)
  { f: 1248, cInf: 13, focus: eyesOf(MARK.heroBath) }, //            8b CU
  { f: 1294, cInf: 12, focus: eyesOf(MARK.reflection) }, //          8c-8d mirror OTS: the real hero's head soft below
  { f: 1427, cInf: 14, focus: iconOf(MARK.reflection) }, //          9a icon insert
  { f: 1479, cInf: 0 }, //                                           map, crane, road: sharp
  { f: 1741, cInf: 12, focus: eyesOf(MARK.reflection) }, //          11 mirror
  { f: 1857, cInf: 10, focus: eyesOf(MARK.kevin) }, //               12a OTS (as 1a)
  { f: 1915, cInf: 0 }, //                                           12b-c Kevin MS
  { f: 1969, cInf: 14, focus: iconOf(MARK.kevin, CROWN.floorSit) }, // 12d icon CU
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a model name build.ts can load (Kenney CC0 kits; the
 *  furniture name must be added to world.ts KENNEY and checked in step 4; streetLamp can be built from boxes in
 *  build.ts). pos = base point,
 *  s = height (m), yaw (rad). They sit at 0.3-0.5 x the focus distance, cover 10-25 % of one frame edge, never a
 *  face or an icon, and must be recognisable when blurred (a cut-off round blob reads as a ball: drop it then). */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // ranges stay inside one shot (world.ts shows an entry only inside its own shot). Eye-level cameras put any low prop
  // near the lens below the frame, so the near framing here is mostly people: the hero's back in the OTS shots (1a,
  // 8c-8d, 12a) and a still student's shoulder + backpack at the right edge of 4c (cast.ts). Kit props:
  { a: 176, b: 265, kit: "chair", pos: D(1.45, 0, -0.6), s: 0.95, yaw: 1.57 }, //        2b WS: empty end chair, bottom-right (sharp)
  { a: 866, b: 919, kit: "streetLamp", pos: at("street", -1.37, 0, 0.93), s: 3.6 }, //    6b two-shot: lamp post at the left edge
];

// ---------------- word-locked acting and icon events (cast.ts plays these) ----------------
// f = the frame the change is first visible (pop start, the edge-on swap frame of a flip, an expression swap, a prop
// appearing). w = the word it belongs to; 0 <= onset(w) - f <= 3 is checked against words.json.
// Pops: scale 0 -> 1.15 -> 1 over 6 f + a 4-frame sparkle. Flips: Y-axis turn over 8 f (6 f, then 4 f as the mirror
// montage speeds up), the picture swaps on the edge-on frame f, small sparkle burst. Expression swaps are instant and
// covered by a blink (cast.ts lidAt swaps).
export type Cue = { f: number; w: number; who: string; act: string };
export const CUES: Cue[] = [
  { f: 12, w: 3, who: "students", act: "their icons ping (scale 1 -> 1.15 -> 1, sparkle): hard hat, paint palette, fire helmet" },
  { f: 34, w: 5, who: "kevin", act: "big bite of the sandwich (crumb puff); cheeks full" },
  { f: 84, w: 10, who: "kevin", act: "gap-tooth grin, mouth full" },
  { f: 100, w: 12, who: "hero", act: "shock (jaw drops); squeezes the juice box: squirt splash; kick 0.8" },
  { f: 223, w: 24, who: "dad", act: "icon pops: open-end wrench; the real wrench by his plate glints (4 f)" },
  { f: 223, w: 24, who: "hero", act: "fork stops halfway to his mouth (held until 315)" },
  { f: 237, w: 26, who: "mom", act: "icon pops: chef's hat" },
  { f: 253, w: 28, who: "sister", act: "icon pops: phone in a glowing ring light, red record dot" },
  { f: 288, w: 32, who: "hero", act: "eyes dart left" },
  { f: 295, w: 33, who: "hero", act: "eyes dart right" },
  { f: 324, w: 36, who: "sister", act: "standing on her chair, rocket to her chest, chin up (proud)" },
  { f: 346, w: 37, who: "sister", act: "announces: open grin" },
  { f: 360, w: 41, who: "sister", act: "thrusts the rocket overhead + star sparkle burst" },
  { f: 395, w: 45, who: "sister", act: "her icon's ring light flares and the record dot blinks (the joke)" },
  { f: 426, w: 48, who: "photo", act: "softbox flash pops (3 f, bloom): class photo taken" },
  { f: 480, w: 54, who: "kidsMid+kidsBack", act: "8 ring-light icons pop, two per frame 480-483" },
  { f: 503, w: 56, who: "kidsFront", act: "3 astronaut-helmet icons pop, one per frame 503-505, smaller sparkle" },
  { f: 528, w: 58, who: "kids", act: "the 8 raise phones for selfies; the 3 look up dreamily" },
  { f: 574, w: 64, who: "hero", act: "leans in, hand cupped at his mouth (hinting)" },
  { f: 584, w: 66, who: "kevin", act: "turns his head to the hero" },
  { f: 608, w: 67, who: "kevin", act: "points at himself, laughing" },
  { f: 629, w: 71, who: "kevin", act: "yanks the locker handle" },
  { f: 640, w: 73, who: "kevin", act: "the handle comes off in his hand (puff); kick 0.4" },
  { f: 655, w: 74, who: "kevin", act: "glue stick appears in his hand" },
  { f: 672, w: 77, who: "kevin", act: "bites the glue stick (crunch puff)" },
  { f: 704, w: 83, who: "kevin", act: "proud gap-tooth grin, glue smear on the lip, thumbs up" },
  { f: 718, w: 84, who: "bully", act: "slams a locker shut beside the hero's head; kick 1.2" },
  { f: 718, w: 84, who: "hero", act: "shock, pinned to the lockers" },
  { f: 748, w: 88, who: "bully", act: "leans in, stern (V brows)" },
  { f: 789, w: 98, who: "bully", act: "icon: the tooth sparkles ('ding'), the drill spins (speed lines)" },
  { f: 813, w: 99, who: "hero", act: "daydream: reclined in the chair, nervous, sweat drop, mouth open" },
  { f: 813, w: 99, who: "bully", act: "daydream: grinning dentist with a whirring cartoon drill" },
  { f: 818, w: 100, who: "bully", act: "the drill whirrs in closer (speed lines)" },
  { f: 866, w: 107, who: "hero", act: "stops walking, turns his head to the stranger" },
  { f: 893, w: 110, who: "hero", act: "tilts his head ~18 deg like a confused dog, squints" },
  { f: 903, w: 111, who: "stranger", act: "the bead's light blinks" },
  { f: 951, w: 118, who: "stranger", act: "the bead's light blinks back, bigger glow pulse" },
  { f: 992, w: 123, who: "manager", act: "beams: huge grin, arms wide, teeth gleam sparkle" },
  { f: 1015, w: 124, who: "manager", act: "holds a paper hat out over the counter" },
  { f: 1032, w: 127, who: "hero", act: "takes the hat (now in his hands)" },
  { f: 1056, w: 130, who: "manager", act: "sweeps his arm across the kitchen" },
  { f: 1077, w: 134, who: "hero", act: "looks down at the paper hat in his hands (worried)" },
  { f: 1095, w: 136, who: "coworker", act: "swap 1 (puff): a teen with braces" },
  { f: 1115, w: 138, who: "coworker", act: "swap 2 (puff): a sleepy goth teen" },
  { f: 1139, w: 143, who: "coworker", act: "swap 3 (puff): a surfer kid" },
  { f: 1152, w: 145, who: "coworker", act: "swap 4 (puff): a grandmother; the manager has not moved" },
  { f: 1190, w: 150, who: "photoWall", act: "the glide arrives on the oldest photo: young manager, full head of hair" },
  { f: 1213, w: 151, who: "mirror", act: "fogged from his shower: soft white haze with drips, only a blurred silhouette (until 1305)" },
  { f: 1234, w: 154, who: "bulb", act: "flares (bloom x2 for 5 f); kick 0.4" },
  { f: 1234, w: 154, who: "hero", act: "freezes mid-brush, eyes wide" },
  { f: 1248, w: 156, who: "hero", act: "eyes roll up toward the top of his own head" },
  { f: 1281, w: 160, who: "hero", act: "pats the top of his head: nothing there" },
  { f: 1305, w: 163, who: "hero", act: "wipes the fogged mirror at face height: his reflection's face appears" },
  { f: 1312, w: 164, who: "hero", act: "second wipe, higher: the icon over the reflection's head appears (the paper hat); reflection: shock" },
  { f: 1329, w: 165, who: "reflection", act: "icon jitters +-8 deg for 8 f ('won't sit still')" },
  { f: 1348, w: 168, who: "reflection", act: "raises the textbook (heart cover): icon flips to a stethoscope (8 f)" },
  { f: 1373, w: 170, who: "reflection", act: "swaps to the guitar: icon flips to a microphone (6 f)" },
  { f: 1390, w: 172, who: "reflection", act: "swaps to the phone: icon flips back to the paper hat (4 f)" },
  { f: 1401, w: 173, who: "reflection", act: "drops it, shrugs: icon flips to the stranger's bead (4 f)" },
  { f: 1414, w: 175, who: "reflection", act: "the bead's light blinks" },
  { f: 1442, w: 179, who: "reflection", act: "icon flips into a crystal ball (purple mist)" },
  { f: 1451, w: 181, who: "reflection", act: "the crystal ball cracks (crack line + puff)" },
  { f: 1510, w: 186, who: "map", act: "the chevron starts to move; the route line lights up toward the pin" },
  { f: 1527, w: 189, who: "map", act: "a glow pulse runs along the route; the pin bounces" },
  { f: 1542, w: 192, who: "map", act: "the route flickers and rewrites itself (wipe)" },
  { f: 1572, w: 194, who: "map", act: "the chevron turns right; the pin lands on its new spot, its picture flips (paper hat -> stethoscope)" },
  { f: 1602, w: 198, who: "map", act: "dozens of pins hop at once across the grid" },
  { f: 1639, w: 202, who: "roadMan", act: "job icon #1 pops (ROAD_JOBS; #2-13 flip, each old icon stays hanging over the road)" },
  { f: 1659, w: 203, who: "roadMan", act: "job #5 flips (montage, see ROAD_JOBS)" },
  { f: 1680, w: 205, who: "roadMan", act: "ages to his 30s (tie, first grey) + job #8" },
  { f: 1718, w: 209, who: "roadMan", act: "grey hair + glasses, stops walking, job #13; glances back at the trail" },
  { f: 1741, w: 210, who: "reflection", act: "relieved grin (relief_open), shoulders drop" },
  { f: 1782, w: 216, who: "reflection", act: "icon flips: bead -> stethoscope" },
  { f: 1801, w: 217, who: "reflection", act: "the grin freezes and slides off: grin -> half -> flat over 4 f" },
  { f: 1842, w: 221, who: "reflection", act: "eyes widen: realisation" },
  { f: 1875, w: 225, who: "kevin", act: "looks at the hero" },
  { f: 1906, w: 231, who: "kevin", act: "eyes go wide (shock)" },
  { f: 1920, w: 232, who: "kevin", act: "slow smug grin" },
  { f: 1933, w: 234, who: "kevin", act: "tosses his homework over his shoulder into the bin (paper flutter)" },
  { f: 1947, w: 236, who: "kevin", act: "slides down against the lockers, feet up on his backpack, hands behind his head" },
  { f: 1954, w: 237, who: "kevin", act: "eyes shut, content" },
  { f: 1991, w: 241, who: "kevin", act: "icon flips: tiny you in the necktie at the desk, tiny Kevin holding the coffee; sparkle; kick 0.6" },
];
