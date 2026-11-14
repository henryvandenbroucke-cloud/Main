// The 19 shots of "ChatGPT takes a sip of water", timed to the voice (chatgpt-water-short/audio/words.json).
// Each shot is a pure function of its local frame u: camera, lens, cards, sprites, and the set's moving parts.
// Camera grammar from the skill: an ease-out glide at the start of a shot, then every hold creeps in, small flip
// kicks on impacts, rolls of a few degrees that settle. Every visual reaction lands 0-3 frames before its word.
import * as THREE from "three";
import { Pen, bodyFront, FrontOpts, Outfit, SKIN, SKINS, INK } from "../pointing/toon";
import { TONE } from "../pointing/shade";
import { Sets } from "./sets";
import { LightName } from "./look";
import {
  robot, RobotOpts, cow, bubble, BubbleKind, fxDrop, fxSteam, fxGlow, fxCoin, fxEgg, fxSpoon, fxSpoonStack, fxFace, fxHeat, fxPile, fxSpark, fxCrowd, fxPop,
  glassProp, phoneProp, burgerProp, spoonProp, panProp,
} from "./draw";

export const FPS = 30;
export const TOTAL = 2130;
export type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov: number; roll?: number };
export type Place = { key: string; draw: (p: Pen) => void; at: V3; scale?: number; mirror?: boolean; roll?: number; yaw?: number; geo?: "body" | "cow"; shadow?: number; shadowY?: number };
export type FxP = { key: string; cw: number; ch: number; draw: (p: Pen) => void; at: V3; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; yaw?: number };
export type Out = { cam: Cam; cInf: number; focus?: V3; places: Place[]; fx: FxP[]; flash?: number };
export type Shot = { name: string; a: number; b: number; set: keyof Sets; light: LightName; az?: number; el?: number; shadowR?: number; shadowAt?: V3; run: (u: number, S: Sets) => Out };

// ---------------- helpers ----------------
const c01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const l3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const span = (u: number, a: number, b: number) => c01((u - a) / (b - a));
const eo = (x: number) => 1 - (1 - c01(x)) ** 3;
const sm = (x: number) => { const t = c01(x); return t * t * (3 - 2 * t); };
const ss = (x: number) => { const t = c01(x); return t * t * t * (t * (6 * t - 15) + 10); };
const kick = (u: number, at: number, amp = 1, dur = 7) => { const t = u - at; return t >= 0 && t < dur ? amp * (1 - t / dur) * (t % 2 ? -1 : 1) : 0; };
/** scale that pops in with a little overshoot */
const pop = (u: number, at: number, dur = 7) => { const t = (u - at) / dur; return t <= 0 ? 0 : t >= 1 ? 1 : eo(t) * (1 + 0.35 * (1 - t)); };
const blink = (f: number, seed = 0) => ((f + seed * 23) % 67 < 4 ? 1 : 0);
const hash = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 20) => Math.round(v * n) / n;
const lc = (a: Cam, b: Cam, t: number): Cam => ({ pos: l3(a.pos, b.pos, t), look: l3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll ?? 0, b.roll ?? 0, t) });
/** ease-out glide A -> B over dur frames, then a creeping push-in toward the look point */
const glide = (u: number, A: Cam, B: Cam, dur = 22, creep = 0.0014): Cam => {
  const c = lc(A, B, eo(u / dur));
  c.pos = l3(c.pos, c.look, creep * Math.max(0, u));
  return c;
};
const bump = (c: Cam, dy: number): Cam => ({ ...c, look: [c.look[0], c.look[1] + dy, c.look[2]] });

let LA = -0.96; // painted light angle of the cards (follows the sun side); set by the world before each run
export const setLightAngle = (a: number) => { LA = a; };
const keyOf = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => k + ":" + (typeof v === "number" ? q(v) : Array.isArray(v) ? v.map((x) => (typeof x === "number" ? q(x, 4) : x)).join("_") : String(v))).join(",");
const who = (id: string, fit: Outfit, at: V3, opt: FrontOpts & { hk?: string }, ex: Partial<Place> = {}): Place => {
  const { hk, hold, ...rest } = opt;
  return { key: `${id}|${hk ?? ""}|${keyOf(rest)}|${q(LA)}`, at, draw: (p) => bodyFront(p, fit, { light: LA, ...rest, hold }), ...ex };
};
const bot = (at: V3, o: RobotOpts, ex: Partial<Place> = {}): Place => ({ key: `bot|${keyOf(o)}|${q(LA)}`, at, draw: (p) => robot(p, { light: LA, ...o }), ...ex });
const bub = (kind: BubbleKind, at: V3, s = 1, tail = -1, rot = 0): FxP => ({ key: `bub|${kind}|${tail}`, cw: 400, ch: 360, draw: (p) => bubble(p, kind, tail), at, w: 0.9 * s, h: 0.81 * s, rot });
const dropF = (at: V3, s = 1, col?: string, rot = 0): FxP => ({ key: "drop" + (col ?? ""), cw: 160, ch: 220, draw: (p) => fxDrop(p, col), at, w: 0.32 * s, h: 0.44 * s, rot });
const steam = (at: V3, s: number, seed = 0, col?: string): FxP => ({ key: `steam|${seed}|${col ?? ""}`, cw: 256, ch: 256, draw: (p) => fxSteam(p, seed, col), at, w: s, h: s, soft: true });
const glow = (at: V3, s: number, col?: string, k = 0.9): FxP => ({ key: `glow|${col ?? ""}|${k}`, cw: 256, ch: 256, draw: (p) => fxGlow(p, col, k), at, w: s, h: s, soft: true });
const spark = (at: V3, s: number, rot = 0, col?: string): FxP => ({ key: "spark" + (col ?? ""), cw: 200, ch: 200, draw: (p) => fxSpark(p, col), at, w: s, h: s, rot });
const burst = (at: V3, s: number, t: number): FxP => ({ key: `burst|${q(t, 10)}`, cw: 500, ch: 500, draw: (p) => fxPop(p, c01(t)), at, w: s, h: s });
const heat = (at: V3, s: number, u: number): FxP => ({ key: `heat|${u % 12}`, cw: 300, ch: 300, draw: (p) => fxHeat(p, (u % 12) / 12 * 1.047), at, w: s, h: s });
const face = (mood: "calm" | "hot" | "drink" | "wow", at: V3, s = 1, t = 0): FxP => ({ key: `face|${mood}|${q(t, 4)}`, cw: 800, ch: 460, draw: (p) => fxFace(p, mood, t), at, w: 16 * s, h: 9.2 * s, yaw: 0 });

// ---------------- cast ----------------
const HERO: Outfit = { jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#5a3b2a", skin: SKIN };
const BOSS: Outfit = { jacket: "#6b7387", pants: "#2d3142", boots: "#f4f1ea", hat: "hair", hair: "#3a2a22", skin: SKINS[2] };
const SCI_A: Outfit = { jacket: "#f4f1ea", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#2a201a", skin: SKINS[3], glasses: true, buttons: "#9aa3ad" };
const SCI_B: Outfit = { jacket: "#f4f1ea", pants: "#5a3b6a", boots: "#4a3426", hat: "hair", hair: "#b5653f", skin: SKIN, glasses: true, buttons: "#9aa3ad" };
const WORKER: Outfit = { jacket: "#f2bd2a", pants: "#3b3f52", boots: INK, hat: "cap", cap: "#e2453c", skin: SKINS[1] };
const TOWN: Outfit[] = [
  { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#2a201a", skin: SKINS[0] },
  { jacket: "#3f9c62", pants: "#3b3f52", boots: "#4a3426", hat: "cap", cap: "#3f73b8", skin: SKINS[3] },
  { jacket: "#e2453c", pants: "#2d3142", boots: "#4a3426", hat: "hair", hair: "#b5653f", skin: SKINS[2] },
];

/** every moving part of every set back to its rest state (called before each shot runs) */
export function resetSets(S: Sets) {
  S.room.glassDay.visible = true; S.room.glassNight.visible = false;
  S.servers.pipeMat.color.set("#3aa0e8");
  for (const l of S.servers.lights) (l.material as THREE.MeshBasicMaterial).color.setRGB(1.5, 1.9, 2.4);
  S.outside.facade.color.set("#ffffff"); S.outside.tank.scale.set(1, 1, 1); S.outside.tank.rotation.z = 0; S.outside.night.visible = false; S.outside.straw.visible = false;
  S.stage.spoon.visible = true; S.stage.heart.visible = false; S.stage.rack.visible = false;
  S.lab.water.scale.y = 1; S.lab.bottle.rotation.z = 0;
  S.field.lake.scale.set(1, 1, 1);
  balance(S, 0, null);
}
/** the balance: tilt > 0 = left pan down; the burger sits on the left pan unless a height is given */
function balance(S: Sets, tilt: number, burgerY: number | null) {
  const F = S.field, c = Math.cos(tilt), s = Math.sin(tilt);
  F.beam.rotation.z = tilt;
  F.panL.position.set(-2.3 * c, 2.7 - 2.3 * s, 0); F.panR.position.set(2.3 * c, 2.7 + 2.3 * s, 0);
  F.burger.visible = burgerY !== null;
  F.burger.position.set(F.panL.position.x, Math.max(F.panL.position.y - 1.6, burgerY ?? 0), 0);
}
const COOL: V3 = [1.0, 1.12, 1.42], COOL_SH: V3 = [0.22, 0.27, 0.46], HOT: V3 = [1.78, 0.86, 0.5], HOT_SH: V3 = [0.38, 0.2, 0.3];
const heatLight = (S: Sets, h: number) => {
  TONE.uLitCol.value.set(...l3(COOL, HOT, h)); TONE.uShadeCol.value.set(...l3(COOL_SH, HOT_SH, h));
  for (const l of S.servers.lights) (l.material as THREE.MeshBasicMaterial).color.setRGB(lerp(1.5, 2.6, h), lerp(1.9, 1.1, h), lerp(2.4, 0.6, h));
};

// ---------------- shots ----------------
const T = (s: number) => Math.round(s * FPS);
const R1: V3 = [0, 0.45, -0.35]; // the robot on its stool behind the desk
const mk = (name: string, t0: number, t1: number, set: keyof Sets, light: LightName, run: (u: number, S: Sets, F: (s: number) => number) => Out, ex: Partial<Shot> = {}): Shot => {
  const a = T(t0), b = T(t1);
  return { name, a, b, set, light, run: (u, S) => run(u, S, (s) => s * FPS - a), ...ex };
};

export const SHOTS: Shot[] = [
  // 1. HOOK  "Every time you say thank you to ChatGPT... it takes a sip of water."
  mk("hook", 0, 3.53, "office", "room", (u, S, F) => {
    const arrive = F(1.13), sipAt = F(2.42);
    const e = eo(span(u, -10, arrive)), bp = l3([1.25, 2.95, 0.3], [0.5, 2.44, 0.15], e);
    const bs = u < sipAt ? 1 + 0.06 * Math.sin(u * 0.4) : Math.max(0, 1 - (u - sipAt) / 5);
    const sip = sm(span(u, sipAt, sipAt + 9));
    const cam = bump(glide(u, { pos: [0.75, 1.52, 4.7], look: [0.16, 1.7, -0.3], fov: 37, roll: 2.5 }, { pos: [0.5, 1.58, 3.95], look: [0.12, 1.66, -0.3], fov: 36, roll: 1 }), 0.012 * (kick(u, arrive) + kick(u, sipAt + 8)));
    const fx: FxP[] = [bub("heart", [bp[0], bp[1] + 0.04 * Math.sin(u * 0.3), bp[2]], 0.72 * bs, -1, 0.06 * Math.sin(u * 0.25))];
    if (u >= arrive && u < arrive + 7) fx.push(burst([0.3, 2.2, 0.2], 0.8, (u - arrive) / 7));
    if (u >= sipAt && u < sipAt + 6) fx.push(spark([bp[0], bp[1], bp[2]], 0.8 * (1 - (u - sipAt) / 6) + 0.2, u * 0.4));
    if (sip > 0.9) for (let k = 0; k < 2; k++) { const ph = ((u * 0.08 + k * 0.5) % 1); fx.push(dropF([0.5 + 0.2 * k, 2.2 + ph * 0.45, 0.1], 0.45 * (1 - ph))); }
    return {
      cam, cInf: 10, focus: [0, 1.62, -0.35], fx,
      places: [bot(R1, { sip, level: 0.82 - 0.34 * span(u, sipAt + 9, sipAt + 34), eye: u < arrive ? "open" : "happy", look: u < arrive ? 0.9 : 0, lookY: u < arrive ? -0.7 : 0,
        mouth: sip > 0.5 ? "o" : "smile", antenna: 0.8 * Math.sin(u * 0.6) * Math.max(0.15, 1 - Math.abs(u - arrive) / 14), tilt: 2 * kick(u, arrive, 1, 9), legs: false }, { shadow: 0 })],
    };
  }, { az: 150 }),

  // 2. "Real water. The kind YOU drink."
  mk("you-drink", 3.53, 5.27, "room", "room", (u, S, F) => {
    const fr = F(4.5), frozen = u >= fr;
    const up = frozen ? lerp(1, 0.5, eo(span(u, fr, fr + 5))) : 1;
    let cam = glide(u, { pos: [1.6, 1.3, 6.0], look: [0.42, 1.15, 1.0], fov: 38, roll: -2 }, { pos: [1.05, 1.3, 4.7], look: [0.44, 1.2, 1.0], fov: 36, roll: 0 }, 14);
    cam.pos = l3(cam.pos, cam.look, 0.1 * eo(span(u, fr, fr + 6)));
    cam = bump(cam, 0.012 * kick(u, fr));
    const fx: FxP[] = [];
    if (frozen) for (let k = 0; k < 3; k++) { const t = (u - fr) / 12; if (t < 1) fx.push(dropF([0.62 + 0.5 * t * (k - 0.6), 1.62 + 0.6 * t - 0.9 * t * t + 0.1 * k, 1.1], 0.5 * (1 - t), undefined, (k - 1) * 0.5)); }
    return {
      cam, cInf: 12, focus: [0.3, 1.44, 1.0], fx, flash: u < 4 ? [1, 0.75, 0.45, 0.2][u] : 0,
      places: [who("hero", HERO, [0.3, 0, 1.0], { mode: "stand", expr: frozen ? "shock" : "smile_closed", hold: { draw: glassProp(frozen ? 0.42 : 0.8 - 0.38 * span(u, 0, fr)), up }, hk: "glass" + q(frozen ? 0.42 : 0.8 - 0.38 * span(u, 0, fr)) + q(up),
        headTilt: frozen ? 3 : -7, look: frozen ? 1 : 0, facing: 1, seed: 2, tilt: frozen ? 2 * kick(u, fr, 1, 8) : 0 })],
    };
  }, { az: 150 }),

  // 3. "It's two a.m., and you're asking a robot if a hot dog is a sandwich."
  mk("2am", 5.27, 8.7, "room", "night", (u, S, F) => {
    S.room.glassDay.visible = false; S.room.glassNight.visible = true;
    const hd = F(7.4), sw = F(8.06), H: V3 = [-2.75, 0.46, -2.45];
    const cam = glide(u, { pos: [-0.6, 1.9, 2.6], look: [-2.6, 1.45, -2.3], fov: 40, roll: -3 }, { pos: [-1.15, 1.8, 1.3], look: [-2.7, 1.5, -2.3], fov: 38, roll: -1 }, 26, 0.001);
    const fx: FxP[] = [glow([-2.58, 0.98, -2.3], 0.6 + 0.04 * Math.sin(u * 0.5), "190,230,255", 0.4)];
    if (u < hd) fx.push(bub("dots", [-2.2, 2.3 + 0.03 * Math.sin(u * 0.2), -2.2], 0.75 * pop(u, 8), -1));
    if (u >= hd) fx.push(bub("hotdog", [-3.3, 2.32 + 0.04 * Math.sin(u * 0.3), -2.2], 0.95 * pop(u, hd), 1, -0.08));
    if (u >= sw) fx.push(bub("sandwich", [-2.05, 2.38 + 0.04 * Math.sin(u * 0.3 + 2), -2.2], 0.95 * pop(u, sw), -1, 0.08));
    if (u >= sw + 4) fx.push(spark([-2.68, 2.5, -2.15], 0.35 + 0.1 * Math.sin(u), u * 0.2));
    return {
      cam: bump(cam, 0.01 * (kick(u, hd) + kick(u, sw))), cInf: 9, focus: [-2.75, 1.36, -2.3], fx,
      places: [who("hero", HERO, H, { mode: "sit", expr: u >= sw ? "smile" : "neutral", hold: { draw: phoneProp(true), up: 0.28 + 0.03 * Math.sin(u * 0.9) }, hk: "phone" + q(0.03 * Math.sin(u * 0.9), 50), blink: blink(u, 1),
        headTilt: u >= sw ? -6 : u >= hd ? 6 : 0, look: 1, facing: 1, seed: 2 }, { shadow: 0 })],
    };
  }, { az: 150, el: 40 }),

  // 4. "Your question flies to a giant building packed with computers."
  mk("flight", 8.7, 11.73, "outside", "night", (u, S, F) => {
    S.outside.night.visible = true;
    const land = F(11.2), path = (e: number): V3 => [lerp(-72, -1, e), lerp(9, 12, e) + 10 * Math.sin(Math.PI * e), lerp(8, -7.6, e)];
    const e = sm(span(u, -6, land)), P = path(e), ec = sm(span(u, -10, 88));
    const cam: Cam = { pos: [lerp(-78, -4, ec), lerp(11, 4.5, ec), lerp(36, 46, ec)], look: l3(P, [0, 8, -10], sm(span(u, 58, 90))), fov: 46, roll: lerp(-4, 0, ec) };
    const fx: FxP[] = [];
    const bs = u < land ? 1 : Math.max(0, 1 - (u - land) / 5);
    for (let k = 5; k >= 1; k--) fx.push(glow(path(Math.max(0, e - k * 0.022)), 3.4 - k * 0.5, "190,230,255", 0.7));
    fx.push(bub("dots", P, 6 * bs, -1, -0.25 + 0.5 * e));
    if (u >= land && u < land + 9) fx.push(burst([-1, 11.6, -7.4], 7, (u - land) / 9));
    return { cam: bump(cam, 0.06 * kick(u, land)), cInf: 0, fx, places: [] };
  }, { az: 55, el: 40, shadowR: 95, shadowAt: [-30, 0, -5] }),

  // 5. "And those computers get HOT. Like, fry-an-egg hot."
  mk("hot", 11.73, 15.07, "servers", "server", (u, S, F) => {
    const hot = F(12.82), fry = F(13.55), eggAt = F(14.36);
    const h = sm(span(u, hot - 8, hot + 6)); heatLight(S, h);
    const A: Cam = { pos: [0, 1.4, 6.6 - 0.014 * u], look: [0, 1.35, -6], fov: 44, roll: 0 }, B: Cam = { pos: [1.4, 1.32, 3.55], look: [0.45, 1.14, 0.62], fov: 36, roll: -2 };
    let cam = lc(A, B, ss(span(u, fry - 6, fry + 12)));
    cam.pos = l3(cam.pos, cam.look, 0.0016 * Math.max(0, u - fry));
    cam = bump(cam, 0.012 * (kick(u, hot) + kick(u, eggAt + 4)));
    const fx: FxP[] = [];
    if (h > 0.2) [[-1.55, 2.75, -1.5], [1.55, 2.75, -3.5], [-1.55, 2.75, -7], [1.55, 2.8, 0.2], [-1.55, 2.75, 2]].forEach((p, i) => fx.push(heat(p as V3, 0.9 * h, u + i * 4)));
    const eg = u - eggAt;
    if (eg >= -6 && eg < 0) fx.push({ key: "egg", cw: 300, ch: 220, draw: (p) => fxEgg(p, 1), at: [0.5, 1.02 + 1.3 * (-eg / 6) ** 2, 0.7], w: 0.3, h: 0.22 });
    if (eg >= 0) for (let k = 0; k < 3; k++) { const ph = (u * 0.05 + k * 0.33) % 1; fx.push(steam([0.5 + 0.1 * Math.sin(k * 2 + u * 0.1), 1.15 + ph * 0.8, 0.72], 0.2 + 0.45 * ph * (1 - ph) * 2.2, k)); }
    if (eg >= 0 && eg < 7) fx.push(burst([0.5, 1.1, 0.75], 0.8, eg / 7));
    return {
      cam, cInf: lerp(5, 12, ss(span(u, fry - 6, fry + 12))), focus: [0.05, 1.44, 0.62], fx,
      places: [who("worker", WORKER, [0.05, 0, 0.62], { mode: "stand", expr: eg >= 3 ? "grin" : h > 0.5 ? "nervous" : "neutral", hold: { draw: panProp(eg >= 0 ? eo(eg / 4) : 0), up: 0.14 }, hk: "pan" + q(eg >= 0 ? eo(eg / 4) : 0),
        blink: blink(u, 3), look: eg >= 0 ? 1 : 0, facing: 1, seed: 4, tilt: 2 * kick(u, eggAt, 1, 8) })],
    };
  }),

  // 6. "So the building does what you do in July. It sweats."
  mk("sweat", 15.07, 17.8, "outside", "day", (u, S, F) => {
    const sw = F(17.05), h = sm(span(u, 0, sw - 4));
    S.outside.facade.color.setRGB(1, lerp(1, 0.62, h), lerp(1, 0.56, h));
    const cam = bump(glide(u, { pos: [5, 4.0, 54], look: [0, 6.2, -8], fov: 42, roll: 2 }, { pos: [1.5, 4.6, 43.5], look: [0, 6.5, -8], fov: 40, roll: 0 }, 24, 0.0008), 0.05 * kick(u, sw));
    const fx: FxP[] = [face(u < 10 ? "calm" : "hot", [0, 6.3, -7.9], pop(u, 0, 8))];
    for (let i = 0; i < 3; i++) fx.push(heat([-12 + i * 12, 17.5, -9], 4.2 * h, u + i * 4));
    if (u >= sw - 3) for (let i = 0; i < 9; i++) {
      const ph = ((u - sw + 3) * (0.028 + 0.012 * hash(i)) + hash(i, 2) * 0.5) % 1, x = -20 + i * 5 + 2 * hash(i, 3);
      if (Math.abs(x) < 9 && ph > 0.2 && ph < 0.85) continue; // not across the face
      fx.push(dropF([x, 12 - ph * 10.5, -7.8], 8.5 * Math.min(1, ph * 6) * (ph > 0.9 ? (1 - ph) * 10 : 1)));
    }
    return { cam, cInf: 0, fx, places: [] };
  }, { shadowR: 70, shadowAt: [0, 0, -12] }),

  // 7a. "Water runs past the machines, soaks up the heat,"
  mk("pipes", 17.8, 20.27, "servers", "server", (u, S, F) => {
    const soak = F(19.45), c = sm(span(u, soak - 6, soak + 16));
    heatLight(S, 1 - c);
    S.servers.pipeMat.color.setRGB(lerp(0.23, 0.95, c), lerp(0.63, 0.3, c), lerp(0.91, 0.22, c));
    const e = span(u, 0, 74), z = lerp(5.6, -7.5, sm(e) * 0.5 + e * 0.5);
    const cam: Cam = { pos: [0.3, lerp(1.6, 2.05, e), z], look: [0, 2.72, z - 9], fov: 46, roll: 3 - 2 * e };
    const fx: FxP[] = [];
    for (let k = 0; k < 14; k++) {
      const d = (u * 0.5 + k * 1.7) % 24, wz = z - 1.5 - d, hotK = wz < z - 3 - (1 - c) * 30 ? 1 : c;
      fx.push(dropF([k % 2 ? 0.9 : -0.9, 2.42 + 0.03 * Math.sin(u * 0.6 + k), wz], 0.85, hotK > 0.5 ? "#ff8a4a" : undefined, Math.PI / 2 * (k % 2 ? 1 : -1) * 0));
    }
    return { cam, cInf: 4, focus: [0, 2.7, z - 6], fx, places: [] };
  }),

  // 7b. "and drifts off into the sky. Gone."
  mk("gone", 20.27, 22.43, "outside", "day", (u, S) => {
    const e = span(u, 0, 65);
    const cam: Cam = { pos: [lerp(11, 9, e), lerp(2.6, 2.2, e), lerp(26, 23, e)], look: [0, lerp(16, 25, sm(e)), -18], fov: 46, roll: lerp(-4, -1, e) };
    const fx: FxP[] = [];
    S.outside.TOWERS.forEach((t, tw) => {
      for (let j = 0; j < 4; j++) {
        const ph = (u * 0.034 + j * 0.25 + tw * 0.11) % 1, born = u - ph / 0.034;
        if (born > 36) continue;
        fx.push(steam([t[0] + ph * 5 + Math.sin(j + tw) * 0.6, t[1] + ph * 17, t[2] + 0.5], (3.4 + ph * 7) * (ph > 0.7 ? (1 - ph) / 0.3 : 1), (j + tw) % 3));
      }
    });
    return { cam, cInf: 0, fx, places: [] };
  }, { shadowR: 60, shadowAt: [0, 0, -15] }),

  // 8. "One big data center can drink as much as a town of fifty thousand people."
  mk("town", 22.43, 26.17, "outside", "day", (u, S, F) => {
    S.outside.straw.visible = true;
    const drink = F(23.7), drain = sm(span(u, drink, 108));
    S.outside.tank.scale.set(1 + 0.06 * Math.sin(u * 0.9) * (u > drink ? 1 : 0), 1 - 0.55 * drain, 1 + 0.06 * Math.sin(u * 0.9) * (u > drink ? 1 : 0));
    S.outside.tank.rotation.z = u > drink ? 0.03 * Math.sin(u * 0.8) : 0;
    const gulp = u > drink ? Math.abs(Math.sin((u - drink) * 0.22)) : 0;
    const cam = bump(glide(u, { pos: [-19, 4.2, 84], look: [-22, 9, -3], fov: 48, roll: 2 }, { pos: [-22.5, 4.5, 75], look: [-22.5, 9.6, -3], fov: 46, roll: 0 }, 26, 0.0004), 0.03 * gulp * (u > drink ? 1 : 0));
    const fx: FxP[] = [face(u > drink - 4 ? "drink" : "wow", [-10, 6.3, -7.9], 1, 0)];
    if (u > drink) for (let k = 0; k < 6; k++) {
      const t = 1 - ((u - drink) * 0.022 + k / 6) % 1, pt = S.outside.strawCurve.getPoint(t);
      fx.push(dropF([pt.x, pt.y, pt.z + 0.9], 3.6 * Math.sin(Math.PI * t) ** 0.5));
    }
    const folk: [number, number, number, boolean][] = [[-24.7, 61, 28, false], [-22.5, 62.6, 46, true], [-20.3, 60.4, 36, false]];
    return {
      cam, cInf: 0, fx,
      places: folk.map(([x, z, ang, mir], i) => who("town" + i, TOWN[i], [x, 0, z], { mode: "stand", expr: u > drink + 6 + i * 5 ? "shock" : "neutral", point: u > drink + 6 + i * 5 ? [ang + 4 * Math.sin(u * 0.5 + i), 1] : undefined,
        facing: mir ? -1 : 1, look: mir ? -1 : 1, seed: 6 + i, blink: blink(u, i), headTilt: u > drink + 6 + i * 5 ? -6 : 0 }, { mirror: mir, scale: 1.25 })),
    };
  }, { shadowR: 95, shadowAt: [-22, 0, 25] }),

  // 9. "So how much is YOUR one question?"
  mk("one", 26.17, 27.86, "room", "room", (u, S, F) => {
    const up = F(26.4), one = F(27.3);
    const cam = bump(glide(u, { pos: [-1.1, 1.3, 4.8], look: [0.45, 1.42, 1.0], fov: 36, roll: 2 }, { pos: [-0.75, 1.36, 3.9], look: [0.5, 1.5, 1.0], fov: 34, roll: 0 }, 16), 0.01 * kick(u, one));
    const fx: FxP[] = [];
    if (u >= one) fx.push(bub("dots", [0.98, 2.12 + 0.03 * Math.sin(u * 0.4), 1.0], 0.5 * pop(u, one), -1));
    return {
      cam, cInf: 12, focus: [0.3, 1.44, 1.0], fx,
      places: [who("hero", HERO, [0.3, 0, 1.0], { mode: "stand", expr: u >= up ? "smile" : "neutral", point: u >= up ? [lerp(20, 78, eo((u - up) / 4)), 1] : undefined, look: u >= one ? 1 : 0, facing: 1, seed: 2, blink: blink(u, 2), headTilt: u >= up ? -3 : 0 })],
    };
  }, { az: 150 }),

  // 10. "The boss of ChatGPT says: one fifteenth of a teaspoon. Basically a raindrop."
  mk("boss", 27.86, 32.57, "stage", "stage", (u, S, F) => {
    const sp = F(29.85), dropAt = F(30.78), rain = F(31.5);
    const up = 0.6 * eo(span(u, sp, sp + 8));
    const A: Cam = { pos: [0, 1.7, 9.6 - 0.01 * u], look: [0, 2.3, 0], fov: 40, roll: 0 }, B: Cam = { pos: [0.75, 1.42, 4.4], look: [0.16, 1.25, 0.2], fov: 34, roll: -1.5 }, C: Cam = { pos: [0.55, 1.4, 3.45], look: [0.2, 1.3, 0.2], fov: 32, roll: 0 };
    let cam = lc(lc(A, B, ss(span(u, sp - 8, sp + 10))), C, eo(span(u, rain - 3, rain + 9)));
    cam.pos = l3(cam.pos, cam.look, 0.0012 * Math.max(0, u - rain));
    cam = bump(cam, 0.008 * kick(u, dropAt + 5));
    const fx: FxP[] = [glow([0, 1.7, -0.6], 5.5, "255,236,190", 0.5), { key: "crowd", cw: 1200, ch: 300, draw: (p) => fxCrowd(p), at: [0, 0.62, 5.4], w: 9.5, h: 2.4 }];
    const d = u - dropAt;
    if (d >= 0 && d < 6) fx.push(dropF([0.18, 1.3 + 1.2 * (1 - d / 6) ** 1.5, 0.26], 0.2));
    if (d >= 5 && d < 12) fx.push(burst([0.18, 1.31, 0.3], 0.6, (d - 5) / 7));
    return {
      cam, cInf: lerp(3, 13, ss(span(u, sp - 8, sp + 10))), focus: [0, 1.44, 0.2], fx,
      places: [who("boss", BOSS, [0, 0, 0.2], u < sp ? { mode: "stand", expr: "grin", wave: Math.sin(u * 0.45), seed: 9, blink: blink(u, 4) }
        : { mode: "stand", expr: u >= rain ? "smile" : "smile_closed", hold: { draw: spoonProp(d >= 5), up }, hk: "spoon" + (d >= 5) + q(up), look: 1, facing: 1, seed: 9, blink: blink(u, 4), headTilt: u >= rain ? 4 : 0 })],
    };
  }),

  // 11a. "But scientists in California ran the numbers on an older version."
  mk("lab", 32.57, 35.5, "lab", "room", (u, S, F) => {
    const old = F(34.6);
    const A: Cam = { pos: [1.0, 1.5, 9.0], look: [0.2, 1.45, -1.5], fov: 40, roll: -2 }, B: Cam = { pos: [0.6, 1.5, 8.0], look: [0.1, 1.45, -1.5], fov: 40, roll: 0 }, C: Cam = { pos: [-1.6, 1.45, 6.9], look: [-2.0, 1.3, -1.0], fov: 40, roll: 1 };
    let cam = lc(lc(A, B, eo(u / 24)), C, ss(span(u, old - 8, old + 10)));
    cam.pos = l3(cam.pos, cam.look, 0.001 * u);
    const wv = u > old ? Math.sin((u - old) * 0.5) : undefined;
    return {
      cam, cInf: 7, focus: [0, 1.4, -1.4], fx: u > old + 6 ? [spark([-2.5, 2.1, -0.6], 0.3 + 0.08 * Math.sin(u), u * 0.2, "#d9d2c4")] : [],
      places: [
        who("sciA", SCI_A, [-1.2, 0, -1.4], { mode: "stand", expr: u > old ? "smile" : "neutral", point: [30 + 5 * Math.sin(u * 0.35), 1], facing: 1, look: 1, seed: 12, blink: blink(u, 5), headTilt: 2 * Math.sin(u * 0.2) }),
        who("sciB", SCI_B, [1.5, 0, -1.2], { mode: "stand", expr: "smile", facing: -1, look: -1, seed: 14, blink: blink(u, 6), headTilt: 4 * Math.sin(u * 0.4) }, { shadow: 0 }),
        bot([-2.95, 0, -0.7], { eye: u > old ? "happy" : "sus", antenna: -0.9, bottle: false, mouth: u > old ? "smile" : "flat", wave: wv, tilt: -3 }, { scale: 0.86 }),
      ],
    };
  }, { az: 150 }),

  // 11b. "They got a whole bottle of water for every ten to fifty answers."
  mk("bottle", 35.5, 38.87, "lab", "room", (u, S, F) => {
    const start = F(37.05), d = span(u, start, F(38.6));
    S.lab.water.scale.y = Math.max(0.05, 1 - 0.95 * d);
    S.lab.bottle.rotation.z = 0.13 * Math.sin(u * 0.9) * Math.max(0, 1 - u / 14);
    const cam = bump(glide(u, { pos: [3.1, 1.9, 4.6], look: [1.55, 1.5, 0.05], fov: 36, roll: 2 }, { pos: [2.6, 1.8, 3.7], look: [1.55, 1.6, 0.05], fov: 36, roll: 0 }, 16, 0.0006), 0.006 * kick(u, start));
    cam.pos = l3(cam.pos, [2.9, 2.1, 5.0], 0.5 * sm(span(u, start, start + 30)));
    const fx: FxP[] = [];
    if (u < 9) fx.push(burst([1.5, 1.5, 0.3], 1.2, u / 9));
    for (let k = 0; k < 14; k++) {
      const age = u - (start + k * 3.1);
      if (age < 0) continue;
      const a = (-66 + (k * 67) % 133) * Math.PI / 180, r = 0.3 + (0.3 + 0.5 * hash(k)) * eo(age / 14);
      fx.push(bub("dots", [1.5 + Math.sin(a) * r, 1.86 + Math.cos(a) * r * 0.75 + 0.02 * Math.sin(u * 0.3 + k), 0.2 + 0.02 * k], 0.3 * pop(age, 0, 6), k % 2 ? 1 : -1, a * 0.3));
    }
    return {
      cam, cInf: 12, focus: [1.5, 1.4, 0.05], fx,
      places: [
        who("sciA", SCI_A, [0.35, 0, -1.2], { mode: "stand", expr: d > 0.5 ? "shock" : "neutral", facing: 1, look: 1, seed: 12, blink: blink(u, 5) }, { shadow: 0 }),
        who("sciB", SCI_B, [3.1, 0, -1.3], { mode: "stand", expr: d > 0.3 ? "shock" : "smile", facing: -1, look: -1, seed: 14, blink: blink(u, 6) }, { shadow: 0 }),
      ],
    };
  }, { az: 150 }),

  // 11c. "That's up to a hundred and fifty times MORE!"
  mk("spoons", 38.87, 41.03, "lab", "room", (u, S, F) => {
    const go = F(39.35), n = 15 * eo(span(u, go, go + 36)), SEG = 3.3, top = 0.95 + n * SEG, e = sm(span(u, go - 2, go + 10));
    const cam: Cam = { pos: [lerp(1.4, 2.6, e), Math.max(1.6, top - 2.2), lerp(6.4, 9.5, e)], look: [lerp(1.5, 2.9, e), Math.max(1.6, top - 0.6), 0.7], fov: 44, roll: lerp(2, -3, e) };
    const fx: FxP[] = [{ key: "spoon1", cw: 420, ch: 140, draw: (p) => fxSpoon(p, true), at: [0.2, 1.62 + 0.04 * Math.sin(u * 0.3), 0.7], w: 1.15, h: 0.38 }];
    for (let j = 0; j < Math.ceil(n); j++) {
      const g = Math.min(1, n - j);
      fx.push({ key: "stack", cw: 420, ch: 1000, draw: (p) => fxSpoonStack(p), at: [2.9, 0.95 + (j + 0.5 * g) * SEG, 0.7], w: 1.39, h: SEG * g });
    }
    if (u > go + 36) fx.push(burst([2.9, top + 0.6, 0.9], 4, (u - go - 36) / 9));
    return {
      cam: bump(cam, 0.03 * kick(u, go + 36)), cInf: 0, fx,
      places: [
        who("sciA", SCI_A, [0.9, 0, -1.3], { mode: "stand", expr: u > go + 6 ? "shock" : "neutral", facing: 1, look: 1, seed: 12, headTilt: u > go + 6 ? -9 : 0 }, { shadow: 0 }),
        who("sciB", SCI_B, [4.6, 0, 0.6], { mode: "stand", expr: u > go + 10 ? "shock" : "smile", facing: -1, look: -1, seed: 14, headTilt: u > go + 10 ? -9 : 0 }),
      ],
    };
  }, { az: 150, shadowR: 30, shadowAt: [1.5, 0, 0] }),

  // 12. "You see, he only counted water at the building. They also counted the water that makes the electricity."
  mk("you-see", 41.03, 45.57, "outside", "day", (u, S, F) => {
    const also = F(43.3), k = ss(span(u, also - 4, also + 22));
    const A: Cam = { pos: [-5, 3.0, 41 - 0.02 * u], look: [0, 6.8, -8], fov: 42, roll: 2 }, B: Cam = { pos: [31, 5.5, 98], look: [31, 11.5, -14], fov: 48, roll: 0 };
    const cam = lc(A, B, k);
    cam.pos = l3(cam.pos, cam.look, 0.0006 * Math.max(0, u - also - 22));
    const fx: FxP[] = [dropF([0, 18.5 + 0.3 * Math.sin(u * 0.2), -10], 6 * pop(u, F(42.1)))];
    if (k > 0.5) {
      for (let j = 0; j < 8; j++) fx.push(dropF([33 + j * 3.6, 34 + 3 * Math.sin(j * 1.9) + 0.3 * Math.sin(u * 0.2 + j), -19], 7 * pop(u, also + 20 + j * 3)));
      for (let j = 0; j < 4; j++) { const ph = (u * 0.03 + j * 0.25) % 1, t = S.outside.PLANT_PUFF; fx.push(steam([t[0] + ph * 9, t[1] + ph * 22, t[2] + 1], (6 + ph * 12) * (ph > 0.75 ? (1 - ph) * 4 : 1), j % 3)); }
      for (let j = 0; j < 3; j++) { const ph = (u * 0.045 + j / 3) % 1; fx.push(spark([lerp(30, 22, ph), 10.7, -13.6], 2.6, u * 0.5 + j, "#ffe27a")); }
    }
    return {
      cam, cInf: 0, fx,
      places: [
        who("boss", BOSS, [-2.4, 0, 27], { mode: "stand", expr: u > also ? "nervous" : "smile", point: [44, 1], facing: 1, look: 1, seed: 9, blink: blink(u, 4) }, { scale: 1.3 }),
        who("sciA", SCI_A, [29.3, 0, 82], { mode: "stand", expr: "smile", point: u > also + 10 ? [34 + 3 * Math.sin(u * 0.4), 1] : undefined, facing: 1, look: 1, seed: 12, blink: blink(u, 5) }, { scale: 1.5 }),
        who("sciB", SCI_B, [33, 0, 83.5], { mode: "stand", expr: "smile", point: u > also + 16 ? [40, 1] : undefined, facing: 1, look: 1, seed: 14, blink: blink(u, 6) }, { scale: 1.5 }),
      ],
    };
  }, { shadowR: 95, shadowAt: [24, 0, 30] }),

  // 13. "And it gets over two BILLION questions a day."
  mk("billion", 45.57, 47.87, "outside", "day", (u, S, F) => {
    const two = F(46.25), bil = F(46.5);
    const cam = bump(glide(u, { pos: [-16, 1.9, 36], look: [0, 9.5, -12], fov: 50, roll: -5 }, { pos: [-12, 2.2, 30.5], look: [0, 10.2, -12], fov: 48, roll: -2 }, 18, 0.0008), 0.07 * (kick(u, two) + kick(u, bil, 1.4)));
    const fx: FxP[] = [face("wow", [0, 6.3, -7.9], 1, u * 0.3)];
    const n = Math.round(46 * span(u, -4, bil + 4));
    for (let k = 0; k < n; k++) {
      const ph = (u * (0.022 + 0.012 * hash(k, 4)) + hash(k)) % 1;
      const s: V3 = [-46 + hash(k, 1) * 60, 44 + hash(k, 2) * 18, -6 + hash(k, 3) * 14], t: V3 = [-18 + hash(k, 5) * 36, 14, -24 + hash(k, 6) * 12];
      fx.push(bub("dots", l3(s, t, ph), (2.6 + 1.6 * hash(k, 7)) * Math.min(1, (1 - ph) * 8), k % 2 ? 1 : -1, -0.5 + hash(k, 8) * 0.4));
    }
    return { cam, cInf: 0, fx, places: [] };
  }, { shadowR: 70, shadowAt: [0, 0, -10] }),

  // 14. "But here's the twist."
  mk("twist", 47.87, 49.43, "field", "day", (u, S, F) => {
    const hit = F(48.62), fall = u < hit ? lerp(16, 1.1, span(u, hit - 9, hit) ** 2) : 0, dt = u - hit;
    balance(S, dt < 0 ? 0 : 0.24 * (1 - Math.exp(-dt / 3) * Math.cos(dt * 0.85)), u >= hit - 9 ? fall : 30);
    const cam = bump(glide(u, { pos: [2.2, 2.0, 23], look: [0, 2.2, 0], fov: 40, roll: 3 }, { pos: [1.0, 2.3, 19.5], look: [0, 2.0, 0], fov: 38, roll: 0 }, 16), 0.1 * kick(u, hit, 1.2, 9));
    const fx: FxP[] = [];
    if (dt >= 0 && dt < 10) { fx.push(burst([-2.23, 1.5, 0.9], 4.2, dt / 10)); for (let k = 0; k < 4; k++) fx.push(steam([-2.23 + (k - 1.5) * (0.9 + dt * 0.12), 0.9 + dt * 0.05, 0.8], 1.3 * (1 - dt / 10), k % 3)); }
    return { cam, cInf: 0, fx, places: [], flash: u < 4 ? [1, 0.75, 0.45, 0.2][u] : 0 };
  }, { shadowR: 30, shadowAt: [0, 0, 0] }),

  // 15. "One hamburger takes about four hundred and sixty gallons, counting everything the cow eats and drinks."
  mk("burger-cow", 49.43, 54.07, "field", "day", (u, S, F) => {
    const gal = F(50.6), toCow = F(52.3), drinks = F(53.75);
    balance(S, 0.24, 0);
    S.field.lake.scale.setScalar(1 - 0.42 * sm(span(u, drinks - 6, drinks + 14)));
    const A: Cam = { pos: [-0.4, 1.9, 5.8 - 0.008 * u], look: [-2.23, 1.25, 0], fov: 36, roll: -2 }, B: Cam = { pos: [8.6, 1.6, 9.6], look: [8.9, 0.9, -3.2], fov: 40, roll: 1 };
    const k = ss(span(u, toCow - 7, toCow + 9));
    let cam = lc(A, B, k);
    cam.pos = l3(cam.pos, cam.look, 0.0012 * Math.max(0, u - toCow - 9));
    cam = bump(cam, 0.01 * kick(u, gal));
    const fx: FxP[] = [];
    if (k < 0.9) {
      const n = Math.round(30 * span(u, gal - 10, gal + 22));
      for (let j = 0; j < n; j++) { const ph = (u * 0.055 + hash(j)) % 1; fx.push(dropF([-2.23 + (hash(j, 1) - 0.5) * 3.6, 5.2 - ph * 4.6, (hash(j, 2) - 0.5) * 2.2], 0.9 + 0.5 * hash(j, 3))); }
    }
    const down = u > toCow - 4;
    if (u > drinks) for (let j = 0; j < 2; j++) { const ph = (u * 0.09 + j * 0.5) % 1; fx.push(dropF([10.2 - 1.0 * ph, 0.25 + 0.5 * Math.sin(Math.PI * ph), -3.2], 0.5 * (1 - ph))); }
    return {
      cam, cInf: lerp(9, 7, k), focus: k < 0.5 ? [-2.23, 1.2, 0] : [8.2, 1.1, -3], fx,
      places: [{ key: `cow|${down}|${q(Math.sin(u * 0.8), 4)}|${blink(u, 7)}|${q(LA)}`, geo: "cow", at: [8.0, 0, -3.0],
        draw: (p) => cow(p, { head: down ? 1 : 0, chew: Math.round(Math.sin(u * 0.8) * 4) / 4, tail: Math.round(Math.sin(u * 0.3) * 4) / 4, blink: blink(u, 7) > 0, light: LA }) }],
    };
  }, { shadowR: 30 }),

  // 16. "Even with the scary number... that's thirty-five THOUSAND questions."
  mk("35000", 54.07, 57.73, "field", "day", (u, S, F) => {
    const level = F(56.9), g = span(u, 6, level - 4), dt = u - level;
    balance(S, dt < 0 ? 0.24 * (1 - 0.25 * sm(span(u, level - 30, level))) : 0.18 * Math.exp(-dt / 3.5) * Math.cos(dt * 0.9), 0);
    const cam = bump(glide(u, { pos: [2.0, 2.3, 23], look: [0.2, 2.4, 0], fov: 42, roll: 2 }, { pos: [1.1, 2.5, 20], look: [0.2, 2.3, 0], fov: 40, roll: 0 }, 20, 0.0006), 0.05 * kick(u, level, 1.2, 9));
    const pr = S.field.panR.position, top = pr.y - 1.6;
    const fx: FxP[] = [{ key: `pile|${q(g, 9)}`, cw: 1200, ch: 800, draw: (p) => fxPile(p, Math.ceil(g * 9) / 9), at: [pr.x, top + 1.1, 0.2], w: 3.4, h: 2.27 }];
    if (dt < 0) for (let j = 0; j < 9; j++) { const ph = (u * 0.06 + j / 9) % 1; fx.push(bub("dots", [pr.x + (hash(j) - 0.5) * 2.0, top + 6.5 - ph * (6.2 - 1.9 * g), 0.4], 0.6, j % 2 ? 1 : -1, (hash(j, 2) - 0.5))); }
    if (dt >= 0 && dt < 10) fx.push(burst([0, 3.6, 0.5], 3.6, dt / 10));
    if (dt >= 0) for (let j = 0; j < 3; j++) fx.push(spark([-1.5 + j * 1.5, 4.4 + 0.25 * Math.sin(u * 0.4 + j), 0.5], 0.7 * pop(dt, j * 2), u * 0.15 + j));
    return { cam, cInf: 0, fx, places: [] };
  }, { shadowR: 30, shadowAt: [0, 0, 0] }),

  // 17. "So the thirstiest thing in the room isn't the robot. It's your lunch."
  mk("lunch", 57.73, 61.2, "room", "room", (u, S, F) => {
    const isnt = F(59.3), its = F(60.45);
    const A: Cam = { pos: [0.5, 1.2, 8.2], look: [0.28, 1.1, 1.0], fov: 38, roll: -2 }, B: Cam = { pos: [0.35, 1.25, 7.3], look: [0.28, 1.12, 1.0], fov: 38, roll: 0 }, C: Cam = { pos: [0.0, 1.25, 4.5], look: [-0.15, 1.15, 1.1], fov: 32, roll: 1.5 };
    let cam = lc(lc(A, B, eo(u / 22)), C, ss(span(u, its - 7, its + 8)));
    cam.pos = l3(cam.pos, cam.look, 0.0012 * u);
    cam = bump(cam, 0.01 * kick(u, its + 3));
    const not = u >= isnt && u < its, at = u >= its;
    const fx: FxP[] = [];
    if (at) { if (u < its + 8) fx.push(burst([0.02, 1.08, 1.35], 0.9, (u - its) / 8)); for (let j = 0; j < 3; j++) { const ph = ((u - its) * 0.07 + j / 3) % 1; fx.push(dropF([-0.12 + j * 0.14, 0.98 - ph * 0.6, 1.3], 0.3 * (1 - ph))); } }
    return {
      cam, cInf: 9, focus: at ? [-0.25, 1.2, 1.1] : [0.28, 1.3, 1.0], fx,
      places: [
        who("hero", HERO, [-0.28, 0, 1.1], { mode: "stand", expr: at ? "shock" : "stern", hold: { draw: burgerProp(), up: at ? 0.42 : 0.3 }, hk: "burger" + at, look: 1, facing: 1, seed: 2, blink: blink(u, 2), headTilt: at ? 9 : -2, tilt: at ? 2 * kick(u, its, 1, 8) : 0 }),
        bot([0.8, 0, 0.95], { level: 0.3, eye: at ? "happy" : not ? "wide" : "open", look: -0.9, mouth: at ? "smile" : "flat", tilt: not ? 4 * Math.sin((u - isnt) * 1.1) : 0, wave: not ? Math.sin((u - isnt) * 0.9) : undefined, antenna: not ? Math.sin(u) : 0 }),
      ],
    };
  }, { az: 150 }),

  // 18. "Still... the boss says your pleases and thank-yous cost him tens of millions of dollars."
  mk("coins", 61.2, 65.6, "stage", "stage", (u, S, F) => {
    S.stage.spoon.visible = false; S.stage.heart.visible = true; S.stage.rack.visible = true; S.stage.rack.position.x = 1.0;
    const first = F(62.3), cost = F(63.6), mil = F(64.5);
    const hits: number[] = []; for (let k = 0; k < 8; k++) hits.push(first + k * 13);
    let kk = 0; for (const h of hits) kk += kick(u, h, 0.8);
    const cam = bump(glide(u, { pos: [0.1, 1.6, 9.2], look: [0.25, 1.6, 0], fov: 40, roll: 2 }, { pos: [0.25, 1.5, 6.8], look: [0.25, 1.45, 0], fov: 40, roll: 0 }, 22, 0.0006), 0.012 * kk);
    const fx: FxP[] = [glow([-0.5, 1.7, -0.5], 5, "255,236,190", 0.45), { key: "crowd", cw: 1200, ch: 300, draw: (p) => fxCrowd(p), at: [0.25, 0.7, 5.6], w: 9.5, h: 2.4 }];
    hits.forEach((h, k) => {
      const t = u - h;
      if (t >= -11 && t < 0) fx.push(bub("heart", l3([3.4, 4.9, 0.6], [1.0, 2.5, 0.1], eo((t + 11) / 11)), 0.7, 1, 0.2));
      if (t >= 0 && t < 6) fx.push(burst([1.0, 2.3, 0.3], 1.2, t / 6));
      if (t >= 0 && t < 30) for (let j = 0; j < 3; j++) {
        const vx = -(1.6 + 1.3 * hash(k, j)) * 0.07, vy = (3.2 + 1.6 * hash(k, j + 3)) * 0.045;
        fx.push({ key: `coin|${q(Math.cos(t * 0.7 + j), 4)}`, cw: 200, ch: 200, draw: (p) => fxCoin(p, Math.round(Math.cos(t * 0.7 + j) * 4) / 4), at: [0.55 + vx * t, 1.5 + vy * t - 0.0042 * t * t, 0.5 + 0.1 * j], w: 0.36, h: 0.36 });
      }
    });
    return {
      cam, cInf: 5, focus: [0, 1.5, 0.2], fx,
      places: [who("boss", BOSS, [-0.5, 0, 0.3], { mode: "stand", expr: u > mil ? "shock" : u > cost ? "pained" : u > first + 2 ? "nervous" : "smile", look: 1, facing: 1, seed: 9, blink: blink(u, 4), headTilt: u > first ? 3 + 2 * kk : 0, tilt: -kk * 1.5 })],
    };
  }),

  // 19. "So comment below: are you still saying thank you to the robot? Because one day... it might remember who didn't."
  mk("remember", 65.6, 71.0, "office", "room", (u, S, F) => {
    const are = F(66.75), because = F(68.55), rem = F(69.66), didnt = F(70.3);
    const e = sm(span(u, 0, 150));
    const cam = bump(lc({ pos: [0.8, 1.58, 5.5], look: [0.08, 1.6, -0.3], fov: 38, roll: 2 }, { pos: [0.06, 1.63, 2.45], look: [0, 1.62, -0.35], fov: 34, roll: 0 }, e), 0.012 * (kick(u, rem, 1.3, 9) + kick(u, 8)));
    const dim = sm(span(u, because, because + 22)), red = sm(span(u, rem - 2, rem + 6));
    const lit = l3(l3([1.52, 1.42, 1.26], [0.62, 0.66, 0.95], dim), [1.15, 0.42, 0.4], red), sh = l3(l3([0.46, 0.43, 0.54], [0.18, 0.18, 0.34], dim), [0.3, 0.12, 0.2], red);
    TONE.uLitCol.value.set(...lit); TONE.uShadeCol.value.set(...sh);
    const sip = sm(span(u, didnt, didnt + 9));
    const fx: FxP[] = [];
    const pops: [BubbleKind, V3, number, number][] = [["dots", [1.35, 1.75, 0.55], 8, -1], ["heart", [1.75, 2.45, 0.4], 14, -1], ["dots", [-1.5, 2.25, 0.5], 20, 1]];
    for (const [kind, at, born, tail] of pops) { const fade = 1 - sm(span(u, are + 20, are + 40)); if (u >= born && fade > 0.02) fx.push(bub(kind, [at[0], at[1] + 0.004 * (u - born) + 0.03 * Math.sin(u * 0.25 + born), at[2]], 0.8 * pop(u, born) * fade, tail)); }
    if (u >= rem && u < rem + 8) fx.push(burst([0, 1.62, 0.2], 1.6, (u - rem) / 8));
    return {
      cam, cInf: 10, focus: [0, 1.62, -0.35], fx,
      places: [bot(R1, u < are ? { eye: "happy", mouth: "smile", wave: Math.sin(u * 0.55), level: 0.48, antenna: 0.5 * Math.sin(u * 0.5), legs: false }
        : u < because ? { eye: blink(u, 1) ? "blink" : "open", look: Math.round(Math.sin((u - are) * 0.11) * 4) / 4, mouth: "flat", level: 0.48, legs: false }
          : u < rem ? { eye: "sus", mouth: "flat", level: 0.48, antenna: -0.6 * dim, legs: false }
            : { eye: "evil", mouth: sip > 0.5 ? "o" : "grin", sip, level: 0.48 - 0.3 * span(u, didnt + 9, didnt + 28), antenna: 0.3 * Math.sin(u * 0.9) * (1 - sip), tilt: 1.5 * kick(u, rem, 1, 9), legs: false }, { shadow: 0 })],
    };
  }, { az: 150 }),
];

export const shotAt = (f: number) => { let i = 0; while (i + 1 < SHOTS.length && f >= SHOTS[i + 1].a) i++; return i; };
