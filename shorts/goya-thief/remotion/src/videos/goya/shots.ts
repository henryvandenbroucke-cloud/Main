// Timeline of "The Pensioner Who Stole a Masterpiece", timed to the voice's words.json (every event hangs off a word).
// Reference-style staging: giant deadpan foreground faces over soft backgrounds, a moonlit-blue night, toy-bright
// interiors; satisfying micro-motion on every beat (string draw-ons, flipping calendars, cut-out letters popping in,
// slamming bars, stamps, nodding jurors).
import { Outfit, FrontOpts, INK, Expr, townsfolk, P2 } from "./toon";
import { V3 } from "./story";
import { Key2, View, clamp01, easeOut, easeOutBack, smooth } from "./view";
import { poseAt, exprAt, swaps, walkAt, pop, Hands } from "./anim";
import {
  sparkle, qmark, emark, stampMark, steamWipe, puff, calendar, ringWaves, speedLines,
  goya, giltFrame, dukePortrait, evidenceBoard, thought, gang, collector, cinema, paperNote, jailBars, secretFile, lawBook, gavel, tv2, specs,
} from "./props2d";
import WORDS from "./words.json";

export const FPS = 30;
export const FLASH_AT = -99;
type Wd = { w: string; s: number; e: number };
const WS = WORDS as Wd[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const A = (ws: string | string[], after = 0): number => {
  const L = (Array.isArray(ws) ? ws : [ws]).map(norm);
  const w = WS.find((x) => L.includes(norm(x.w)) && x.s >= after - 1e-6);
  if (!w) throw new Error("word " + L.join("/") + " after " + after);
  return w.s;
};
const F = (t: number) => Math.round(t * FPS) - 2;
export const TOTAL = Math.ceil((WS[WS.length - 1].e + 0.6) * FPS);

// ---------------- word anchors (seconds) ----------------
const tTV = A("tv"), tPolice = A("police", tTV), tHunting = A("hunting", tPolice), tThieves = A("thieves", tHunting), tIts = A("it's", tThieves), t1961 = A(["1961", "nineteen"], tIts);
const tBought = A("bought", t1961), tGoya = A("goya", tBought), tDuke = A("duke", tGoya), t19 = A(["19", "nineteen"], tDuke), tGone = A("gone", t19);
const tPolice2 = A("police", tGone), tProf = A("professional", tPolice2), tMaybe = A("maybe", tProf), tCollector = A("collector", tMaybe);
const tEven = A("even", tCollector), tJoke = A("joke", tEven), tBond = A("bond", tJoke), tLair = A("lair", tBond);
const tReal = A("real", tLair), tPensioner = A("pensioner", tReal), tNewcastle = A("newcastle", tPensioner), tFurious = A("furious", tNewcastle), tLicence = A(["license", "licence"], tFurious);
const tClimbed = A("climbed", tLicence), tToilet = A("toilet", tClimbed), tRansom = A("ransom", tToilet), tGive = A("give", tRansom), tFree = A("free", tGive);
const tFour = A(["four", "4"], tFree), tGives = A("gives", tFour), tTurns = A("turns", tGives), tTrial = A("trial", tTurns), tLawyer = A("lawyer", tTrial);
const tJury = A("jury", tLawyer), tAgrees = A("agrees", tJury), tNot = A("not", tAgrees), tPaintingV = A("painting", tNot), tGuilty2 = A("guilty", tPaintingV);
const tFrame = A("frame", tGuilty2), tBecause = A("because", tFrame), tThree = A(["three", "3"], tBecause), tJail = A("jail", tThree);
const tWait = A("wait", tJail), t2012 = A(["2012", "twenty"], tWait), tFiles = A("files", t2012), tSon = A("son", tFiles), tConfessed = A("confessed", tSon);
const tClimbed2 = A("climbed", tConfessed), tWindow2 = A("window", tClimbed2), tDad = A("dad", tWindow2), tBlame = A("blame", tDad), tChanged = A("changed", tBlame), tLaw = A("law", tChanged), tBorrow = A("borrow", tLaw), tAgain = A("again", tBorrow);

// ---------------- cast (white heads, reference style) ----------------
const WHITE = "#f8f6f1";
const O = (o: Partial<Outfit>): Outfit => ({ jacket: "#3b3f52", pants: "#3b3f52", boots: INK, skin: WHITE, ...o } as Outfit);
const PENSIONER = O({ jacket: "#8a7a5a", pants: "#5a4a3a", boots: "#3a2a20", hat: "cap", cap: "#6b5a45", moustache: "#e9e6e0", buttons: "#5a4a3a", build: "stout" });
const SON = O({ jacket: "#3f6fb5", pants: "#2b2b35", hat: "hair", hair: "#3a2a20" });
const DETECTIVE = O({ jacket: "#b89a6a", pants: "#5a4a3a", hat: "cap", cap: "#4a3f35", moustache: "#3a2a20", buttons: "#3a2a20" });
const JUDGE = O({ jacket: "#8c2f39", pants: "#8c2f39", hat: "hair", hair: "#f4f1ea", buttons: "#e8c45a", build: "stout" });
const LAWYER = O({ jacket: "#1f1d24", pants: "#1f1d24", hat: "hair", hair: "#e9e6e0", buttons: "#f1ece0" });
const GUARD = O({ jacket: "#1f2a44", pants: "#1f2a44", hat: "cap", cap: "#1f2a44", buttons: "#e8c45a", moustache: "#3a2a20" });
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => ({ ...townsfolk(v), skin: WHITE } as Outfit));

export type Actor = {
  o: Outfit; okey: string; P: V3; opts: FrontOpts; seed: number; hop?: number; scale?: number;
  side?: import("./toon").SideOpts; mirror?: boolean; lean?: number; noShadow?: boolean; clip?: V3[]; alpha?: number;
  draw?: (g: CanvasRenderingContext2D, v: View) => void;
};
export type Shot = {
  id: number; a: number; b: number; plate: string; keys: Key2[]; kicks?: [number, number][];
  xfade?: number; whip?: boolean;
  cast?: (f: number) => Actor[];
  under?: (g: CanvasRenderingContext2D, v: View, f: number) => void;
  over?: (g: CanvasRenderingContext2D, v: View, f: number) => void;
};

// ---------------- life ----------------
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const LID = [0.5, 1, 1, 0.5];
export const lidAt = (f: number, i: number, sw: number[] = []) => {
  const fi = Math.round(f);
  for (const s of sw) { const k = fi - s + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= fi && n < 400; n++) { const k = fi - s; if (k >= 0 && k < 4) return LID[k]; s += Math.round(15 + 54 * hh(i * 31 + n, 13)); }
  return 0;
};
const bob = (f: number, k = 1) => Math.sin(f * 0.21) * 0.6 * k;
const stand = (o: Outfit, okey: string, P: V3, seed: number, f: number, ex: [number, Expr][], hands: [number, Hands][] = [[0, {}]],
  extra: Partial<FrontOpts> = {}, act: Partial<Actor> = {}): Actor => {
  const h = poseAt(f, hands);
  return { o, okey, P, seed, ...act, opts: { mode: "stand", expr: exprAt(f, ex), blink: lidAt(f, seed, swaps(ex)), tilt: bob(f + seed * 7), hands: h, ...extra } };
};
/** side-view walker along x (+x is screen-left on the road plate) */
const walker = (o: Outfit, okey: string, seed: number, f: number, path: [number, number, number][], expr: Expr, act: Partial<Actor> = {}): Actor => {
  const w = walkAt(f, path);
  return { o, okey, P: [w.x, 0, w.z], seed, opts: {}, mirror: w.dir[0] > 0, ...act,
    side: { mode: w.moving ? "march" : "stand", phase: w.moving ? w.phase : 0, expr, blink: lidAt(f, seed), stomp: 0.3, stride: w.moving ? 0.8 : 0.01 } };
};
/** the hand of a side-view walker (output px), with the arm swing */
const sideHand = (v: View, a: Actor, f: number): P2 => {
  const ft = v.w(a.P), m = v.ppm(a.P), dir = a.mirror ? -1 : 1, ph = a.side?.phase ?? 0;
  return [ft[0] + dir * (0.2 + 0.05 * Math.sin(ph * Math.PI * 2)) * m, ft[1] - (0.98 + 0.02 * Math.cos(ph * Math.PI * 4)) * m];
};
/** a vehicle moving along +x: position with an eased start (frames) */
const drive = (f: number, f0: number, x0: number, speed: number, ease = 20) => {
  const t = Math.max(0, f - f0), e = t < ease ? (t * t) / (2 * ease) : t - ease / 2;
  return x0 + (speed / FPS) * e;
};
const label = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number) => {
  if (age < 0) return;
  const k = easeOutBack(clamp01(age / 7), 2.2), a = 1;
  g.save(); g.font = "900 54px 'Montserrat'"; const ww = g.measureText(text).width + 48; x = Math.max(ww / 2 + 30, Math.min(1080 - ww / 2 - 30, x)); g.translate(x, y); g.scale(k, k); g.globalAlpha = a;
  g.font = "900 54px 'Montserrat'"; const w = g.measureText(text).width + 48;
  g.beginPath(); g.roundRect(-w / 2, -40, w, 80, 40); g.fillStyle = "#fff6e0"; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 3);
  g.restore();
};
const bigNum = (g: CanvasRenderingContext2D, x: number, y: number, text: string, age: number, col = "#ffd24a") => {
  if (age < 0 || age > 60) return;
  const k = easeOutBack(clamp01(age / 7), 2.4) * (1 - smooth((age - 50) / 10));
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.08);
  g.font = "900 220px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = 34; g.strokeStyle = INK; g.strokeText(text, 0, 0); g.fillStyle = col; g.fillText(text, 0, 0);
  g.restore();
};
const confetti = (g: CanvasRenderingContext2D, x: number, y: number, s: number, age: number) => {
  if (age < 0 || age > 50) return;
  for (let i = 0; i < 28; i++) {
    const a = hh(i, 1) * Math.PI * 2, sp = 0.6 + hh(i, 2), t = age / 50;
    const px = x + Math.cos(a) * sp * s * easeOut(t) * 1.4, py = y - Math.abs(Math.sin(a)) * sp * s * easeOut(t) * 1.2 + t * t * s * 1.6;
    g.save(); g.translate(px, py); g.rotate(age * 0.3 + i); g.globalAlpha = 1 - clamp01((t - 0.7) / 0.3);
    g.fillStyle = ["#d42f2f", "#f2c14e", "#3f6fb5", "#ffffff", "#5aa83c"][i % 5]; g.fillRect(-8, -5, 16, 10); g.restore();
  }
};
const warmGrade = (g: CanvasRenderingContext2D) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = "#ffdcb5"; g.fillRect(0, 0, 1080, 1920);
  g.globalCompositeOperation = "screen";
  const gl = g.createRadialGradient(1000, 150, 40, 1000, 150, 1200); gl.addColorStop(0, "rgba(255,190,110,0.5)"); gl.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = gl; g.fillRect(0, 0, 1080, 1920); g.restore();
};
const stampW = (g: CanvasRenderingContext2D, text: string, f: number, f0: number, f1: number, x = 540, y = 430, w = 520, rot = -0.1) => {
  if (f < f0 || f >= f1 + 8) return;
  g.save(); g.globalAlpha = 1 - smooth((f - f1) / 8); stampMark(g, x, y, w, text, f - f0, rot); g.restore();
};
/** whole-frame darkening + soft blur look for 2D inserts drawn over a plate */
const dim = (g: CanvasRenderingContext2D, a: number) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(16,12,28,${a})`; g.fillRect(0, 0, 1080, 1920); g.restore(); };
/** a world-space quad (for clipping actors behind furniture) */
const above = (x0: number, x1: number, y: number, z: number): V3[] => [[x0, y, z], [x1, y, z], [x1, 6, z], [x0, 6, z]];
/** anger steam from a head (output px) */
const fume = (g: CanvasRenderingContext2D, x: number, y: number, s: number, f: number, k: number) => { if (k <= 0) return; for (let i = 0; i < 4; i++) { const age = (f * 1.2 + i * 7) % 26; puff(g, x + (i % 2 ? 1 : -1) * s * 0.45, y, s * 0.35 * k, age, 26, "#f4f4f6", [(i % 2 ? 1 : -1) * 0.4, -1]); } };

// ======================================================================================================
export const SHOTS: Shot[] = [];
const add = (s: Omit<Shot, "id">) => SHOTS.push({ id: SHOTS.length + 1, ...s });
const WALL_Z = 7.9, GOYA_P: V3 = [0, 2.4, WALL_Z];
/** the Goya on the gallery wall (output px from its world point) */
const goyaOnWall = (g: CanvasRenderingContext2D, v: View, k = 1) => { if (k <= 0) return; const c = v.w(GOYA_P), m = v.ppm(GOYA_P); g.save(); g.globalAlpha = k; goya(g, c[0], c[1], 0.9 * m); g.restore(); };
const paleMark = (g: CanvasRenderingContext2D, v: View) => { const c = v.w(GOYA_P), m = v.ppm(GOYA_P), w = 0.9 * m * 1.22, h = 0.9 * m * 1.25 * 1.18; g.fillStyle = "rgba(255,220,220,0.18)"; g.fillRect(c[0] - w / 2, c[1] - h / 2, w, h); g.fillStyle = INK; g.beginPath(); g.arc(c[0], c[1] - h / 2 - 6, 5, 0, 7); g.fill(); };

// 1 — HOOK (gallery, night): "This 61-year-old stole one of the most famous paintings in Britain... to protest his TV bill."
{
  const TV = F(tTV);
  const path: [number, number, number][] = [[-10, -2.6, 3.4], [F(tPolice) + 10, 2.4, 3.4]];
  const man = (f: number) => walker(PENSIONER, "pen", 11, f, path, f < TV ? "grin" : "stern");
  add({
    a: 0, b: F(tPolice) - 4, plate: "gal_n",
    keys: [{ f: 0, at: [0.5, 0.5], z: 1.5, creep: 0.0018, follow: (f) => [walkAt(f, path).x - 0.2, 1.9, 3.4] },
      { f: TV - 4, dur: 10, at: [0.5, 0.5], z: 1.5, roll: 0.03, creep: 0.0015, punch: 0.006, pn: 14, follow: (f) => [walkAt(f, path).x, 2.0, 3.4] }],
    kicks: [[TV, 0.6]],
    cast: (f) => [man(f)],
    over: (g, v, f) => {
      paleMark(g, v);
      const a = man(f), hd = sideHand(v, a, f), m = v.ppm(a.P), bob = Math.sin((a.side?.phase ?? 0) * Math.PI * 4) * m * 0.02;
      // the painting held up in front of him (bigger than his head), gold glinting in the moonlight
      goya(g, hd[0] + (a.mirror ? -1 : 1) * m * 0.16, hd[1] - m * 0.12 + bob, m * 0.5);
      sparkle(g, hd[0] - m * 0.1, hd[1] - m * 0.95 + bob, m * 0.12, ((f % 40) / 18));
      const head = v.w([a.P[0], 1.95, a.P[2]]);
      if (f >= TV - 2) { const k = easeOutBack(clamp01((f - TV + 2) / 8), 2); g.save(); g.translate(head[0] + m * 0.85, head[1] - m * 0.45); g.scale(k, k); tv2(g, 0, 0, m * 0.55, f); g.restore();
        paperNote(g, head[0] + m * 1.35, head[1] - m * 0.05, m * 0.4, 0, 0, 0, 0.2 + Math.sin(f * 0.3) * 0.05); emark(g, head[0] - m * 0.3, head[1] - m * 0.25, m * 0.32, f - TV - 4, -0.15); }
    },
  });
}
// 2 — "And police spent years hunting a gang of master art thieves."  (detective close-up + the evidence board)
{
  const P0 = F(tPolice) - 4, HUNT = F(tHunting);
  add({
    a: P0, b: F(tIts) - 4, plate: "gal_cu", xfade: 8,
    keys: [{ f: P0, at: [0.95, 1.55, 1.6], z: 1.05, creep: 0.0025 }],
    kicks: [[F(tThieves), 0.5]],
    cast: (f) => [stand(DETECTIVE, "det", [0.95, 0, 1.6], 21, f, [[0, "stern"], [F(tThieves), "nervous"]], [[0, { r: [0.35, -0.75] }]], { facing: -1 }, { noShadow: true })],
    over: (g, v, f) => {
      evidenceBoard(g, 540, 470, 820, 600, clamp01((f - HUNT + 4) / 26), f);
      const hd = v.w([0.75, 1.6, 1.6]), m = v.ppm([0.75, 1.6, 1.6]);
      g.save(); g.lineWidth = m * 0.04; g.strokeStyle = INK; g.beginPath(); g.arc(hd[0], hd[1], m * 0.16, 0, 7); g.fillStyle = "rgba(210,235,255,0.35)"; g.fill(); g.stroke(); g.lineWidth = m * 0.05; g.beginPath(); g.moveTo(hd[0] + m * 0.11, hd[1] + m * 0.11); g.lineTo(hd[0] + m * 0.3, hd[1] + m * 0.3); g.stroke(); g.restore();
    },
  });
}
// 3 — "It's 1961, London. The National Gallery just bought a Goya portrait of the Duke of Wellington. Nineteen days
//      later... it's gone."  (day: a crowd admires it; the calendar riffles 19 pages; POOF - an empty wall)
{
  const A0 = F(tIts) - 4, GOYA = F(tGoya), N19 = F(t19), GONE = F(tGone);
  const crowd = (f: number) => [0, 1, 2, 3, 4].map((i) => stand(FOLK[i], "c" + i, [-2.4 + i * 1.2, 0, 4.6 + (i % 2) * 0.6], 30 + i, f,
    [[0, i % 2 ? "smile" : "smile_closed"], [GONE + 1, "shock"]], [[0, i === 2 ? { r: [0.3, -0.5] } : {}], [GONE + 1 + i, { l: [0.25, -0.5], r: [-0.25, -0.5] }]], { facing: 0 }, { hop: f > GONE ? Math.max(0, 0.12 * Math.sin((f - GONE - i * 2) * 0.5)) : 0 }));
  add({
    a: A0, b: F(tPolice2) - 4, plate: "gal_d", xfade: 8,
    keys: [{ f: A0, at: [0, 2.2, 6], z: 1.12, creep: 0.0018 },
      { f: GOYA - 6, dur: 18, at: [0, 2.6, 7.5], z: 1.4, creep: 0.0015 },
      { f: GONE - 3, dur: 8, at: [0, 2.5, 7.5], z: 1.55, roll: -0.03, creep: 0.0015, punch: 0.006, pn: 14 }],
    kicks: [[GONE, 1.0]],
    cast: (f) => crowd(f),
    under: (g, v, f) => { if (f < GONE) goyaOnWall(g, v); else paleMark(g, v); },
    over: (g, v, f) => {
      stampW(g, "1961", f, F(t1961), F(tBought), 540, 330, 400);
      stampW(g, "LONDON", f, F(t1961) + 22, F(tBought), 540, 590, 500, 0.08);
      const c = v.w(GOYA_P), m = v.ppm(GOYA_P);
      if (f >= GOYA && f < GONE) { label(g, c[0], c[1] + m * 0.6, "GOYA", f - GOYA); sparkle(g, c[0] + m * 0.35, c[1] - m * 0.4, m * 0.12, (f - GOYA) / 12); }
      if (f >= N19 - 2 && f < GONE + 10) { // the calendar riffles from day 2 to day 21
        const u = clamp01((f - N19 + 2) / 16), day = 2 + Math.floor(u * 19), sub = (u * 19) % 1;
        calendar(g, 830, 300, 220, "AUG " + day, day > 2 ? "AUG " + (day - 1) : null, sub, pop(f, N19 - 2, 6) * (1 - smooth((f - GONE - 2) / 8)));
      }
      if (f >= GONE && f < GONE + 16) { puff(g, c[0], c[1], m * 0.9, f - GONE, 16, "#f4f4f6"); ringWaves(g, c[0], c[1], m * 0.4, f - GONE, 1, 3); }
      for (let i = 0; i < 3; i++) emark(g, v.w([-2.4 + i * 2.4, 2.05, 4.8])[0], v.w([-2.4 + i * 2.4, 2.05, 4.8])[1], m * 0.3, f - GONE - 3 - i * 2, (i - 1) * 0.15);
    },
  });
}
// 4 — "Police think it's a professional gang. Maybe a rich secret collector."  (giant deadpan detective, thought bubbles)
{
  const A0 = F(tPolice2) - 4, PROF = F(tProf), MAYBE = F(tMaybe);
  add({
    a: A0, b: F(tEven) - 4, plate: "gal_cu", xfade: 8,
    keys: [{ f: A0, at: [0.95, 1.6, 1.6], z: 1.15, creep: 0.002 }, { f: MAYBE - 4, dur: 14, at: [0.95, 1.65, 1.6], z: 1.25, roll: 0.03, creep: 0.002 }],
    kicks: [[PROF, 0.3], [MAYBE, 0.3]],
    cast: (f) => [stand(DETECTIVE, "det", [0.95, 0, 1.6], 21, f, [[0, "stern"], [MAYBE, "nervous"]], [[0, { r: [0.15, -0.9] }]], { facing: -1, headTilt: f > MAYBE ? -6 : 0 }, { noShadow: true })],
    over: (g, v, f) => {
      const hd = v.w([0.95, 1.95, 1.6]);
      const k1 = easeOutBack(clamp01((f - PROF + 4) / 9), 1.8) * (1 - smooth((f - MAYBE + 2) / 6));
      thought(g, 540, 520, 760, 520, hd[0] - 60, hd[1] - 140, k1, () => { gang(g, 540, 600, 300, f); });
      const k2 = easeOutBack(clamp01((f - MAYBE) / 9), 1.8);
      thought(g, 540, 520, 760, 520, hd[0] - 60, hd[1] - 140, k2, () => { collector(g, 470, 640, 420, f); goya(g, 720, 520, 120); });
    },
  });
}
// 5 — "It even shows up as a joke in the very first James Bond movie, hanging in the villain's lair."  (cinema gag)
{
  const A0 = F(tEven) - 4, JOKE = F(tJoke), LAIR = F(tLair);
  add({
    a: A0, b: F(tReal) - 4, plate: "gal_d", xfade: 8,
    keys: [{ f: A0, at: [0, 2.5, 7], z: 1.2 }],
    kicks: [[JOKE, 0.4], [LAIR, 0.4]],
    over: (g, _v, f) => {
      g.save(); const z = 1 + 0.0018 * (f - A0); g.translate(540, 900); g.scale(z, z); g.translate(-540, -900); cinema(g, f, 1); g.restore();
      sparkle(g, 690, 560, 50, (f - JOKE) / 12); sparkle(g, 820, 440, 36, (f - JOKE - 4) / 12);
      if (f >= LAIR) ringWaves(g, 684, 600, 120, f - LAIR, 1, 3, "255,236,160");
    },
  });
}
// 6 — "But the real thief? A pensioner from Newcastle, furious about paying for his TV licence."  (his front room)
{
  const A0 = F(tReal) - 4, PEN = F(tPensioner), NEW = F(tNewcastle), FUR = F(tFurious), LIC = F(tLicence);
  add({
    a: A0, b: F(tClimbed) - 6, plate: "home", xfade: 8,
    keys: [{ f: A0, at: [179.6, 1.05, 1.8], z: 1.3, creep: 0.0015 }, { f: FUR - 4, dur: 12, at: [179.2, 1.15, 1.8], z: 1.6, roll: -0.03, creep: 0.0015, punch: 0.005, pn: 14 }],
    kicks: [[PEN, 0.3], [FUR, 0.6], [LIC + 8, 0.5]],
    cast: (f) => [stand(PENSIONER, "pen", [179.1, 0.18, 1.75], 11, f, [[0, "stern"], [PEN, "grin"], [FUR, "stern"], [LIC + 6, "pained"]],
      [[0, { l: [0.3, 0.3], r: [0.35, 0.3] }], [LIC - 4, { l: [0.35, -0.3], r: [0.45, -0.25] }], [LIC + 10, { r: [0.6, -0.8] }], [LIC + 18, { l: [0.3, 0.3], r: [0.35, 0.3] }]], { mode: "sit", facing: 1 }, { noShadow: true })],
    over: (g, v, f) => {
      const hd = v.w([179.1, 1.36, 1.75]), m = v.ppm([179.1, 1.3, 1.75]);
      specs(g, hd[0] + m * 0.04, hd[1] + m * 0.02, m * 0.42);
      label(g, hd[0], hd[1] - m * 0.75, "PENSIONER, 61", f - PEN);
      label(g, 540, 300, "NEWCASTLE", f - NEW);
      fume(g, hd[0], hd[1] - m * 0.4, m, f, clamp01((f - FUR) / 6));
      if (f >= FUR) { g.save(); g.globalCompositeOperation = "multiply"; g.fillStyle = `rgba(255,190,180,${0.35 * clamp01((f - FUR) / 8)})`; g.fillRect(0, 0, 1080, 1920); g.restore(); }
      // the licence bill pops up, he crumples it and lobs it at the TV
      if (f >= LIC - 6) {
        const u = clamp01((f - LIC - 4) / 8), fly = clamp01((f - LIC - 12) / 14), tvp = v.w([181.7, 1.0, 2.5]);
        const x = hd[0] + m * 0.6 + (tvp[0] - hd[0] - m * 0.6) * fly, y = hd[1] + m * 0.45 + (tvp[1] - hd[1] - m * 0.45) * fly - Math.sin(Math.PI * fly) * 260;
        if (fly < 1) paperNote(g, x, y, m * 0.55 * easeOutBack(clamp01((f - LIC + 6) / 7), 1.8), 0, 0, u, fly * 6);
        else { ringWaves(g, tvp[0], tvp[1], m * 0.2, f - LIC - 26, 0.8, 2); }
      }
    },
  });
}
// 7 — "He climbed in through a toilet window and started sending ransom notes."  (night, outside: the wiggle)
{
  const A0 = F(tClimbed) - 6, CL = F(tClimbed), TOI = F(tToilet), RAN = F(tRansom);
  const OX = 60;
  add({
    a: A0, b: F(tGive) - 4, plate: "ext_n", xfade: 8,
    keys: [{ f: A0, at: [OX, 2.1, -0.3], z: 1.2, creep: 0.002 }, { f: TOI - 4, dur: 12, at: [OX, 2.6, -0.2], z: 1.5, creep: 0.002 }],
    kicks: [[TOI + 6, 0.4], [RAN, 0.4]],
    cast: (f) => {
      // he stands on the bin, then dives into the window: rises, tips forward, legs kick, vanishes
      const u = clamp01((f - CL) / 26), dive = clamp01((f - TOI) / 22);
      const P: V3 = [OX - 0.25 + dive * 0.25, 1.12 + u * 0.55 + dive * 0.7, -0.75 + dive * 0.55];
      const kick = f > TOI ? Math.sin(f * 1.3) * 0.35 : 0;
      return dive >= 1 ? [] : [{ ...stand(PENSIONER, "pen", P, 11, f, [[0, "stern"], [TOI, "nervous"]], [[0, { l: [-0.3, -1.1], r: [0.3, -1.1] }]], { facing: 0, lift: 60 + kick * 60 }),
        lean: dive * 1.2 + kick * 0.15, scale: 1 - dive * 0.15, clip: dive > 0.25 ? [[OX - 3, 0, -0.1], [OX + 3, 0, -0.1], [OX + 3, 2.25, -0.1], [OX - 3, 2.25, -0.1]] : undefined, noShadow: true }];
    },
    over: (g, v, f) => {
      const w = v.w([60, 2.65, -0.1]), m = v.ppm([60, 2.6, -0.1]);
      if (f >= TOI + 20) { ringWaves(g, w[0], w[1], m * 0.3, f - TOI - 20, 0.7, 2, "255,210,140"); sparkle(g, w[0] + m * 0.5, w[1] - m * 0.4, m * 0.15, (f - TOI - 20) / 12); }
      label(g, w[0], w[1] - m * 1.0, "TOILET WINDOW", f - TOI - 2);
      // ransom notes flutter down
      for (let i = 0; i < 4; i++) { const t = (f - RAN - i * 5) / 30; if (t <= 0) continue; paperNote(g, 200 + i * 230 + Math.sin(t * 6 + i) * 40, -120 + t * 1300, 150, 1, 30, 0, Math.sin(t * 5 + i) * 0.4); }
    },
  });
}
// 8 — "Give the money to charity, so old people can watch TV for free."  (the ransom note assembles letter by letter)
{
  const A0 = F(tGive) - 4, GIVE = F(tGive), FREE = F(tFree);
  add({
    a: A0, b: F(tFour) - 4, plate: "home", xfade: 6,
    keys: [{ f: A0, at: [180, 1.4, 3], z: 1.3 }],
    over: (g, _v, f) => {
      dim(g, 0.55);
      const n = Math.floor(clamp01((f - GIVE) / (FREE - GIVE + 4)) * 44);
      paperNote(g, 540, 820, 760, 1, n, 0, -0.04 + Math.sin(f * 0.05) * 0.01);
      if (f >= FREE - 2) { const k = easeOutBack(clamp01((f - FREE + 2) / 8), 2); g.save(); g.translate(540, 1500); g.scale(k, k); tv2(g, 0, 0, 260, f); g.restore(); for (let i = 0; i < 4; i++) sparkle(g, 400 + i * 90, 1340 - (i % 2) * 40, 26, (f - FREE - i * 3) / 12, "#ff8fa8"); }
    },
  });
}
// 9 — "Four years later, he gives the painting back... and turns himself in."  (the years roll; hands it over; click)
{
  const A0 = F(tFour) - 4, FOUR = F(tFour), GIVES = F(tGives), TURNS = F(tTurns);
  add({
    a: A0, b: F(tTrial) - 4, plate: "gal_d", xfade: 8,
    keys: [{ f: A0, at: [0, 1.6, 4.2], z: 1.25, creep: 0.0018 }, { f: TURNS - 4, dur: 10, at: [-0.4, 1.4, 4.2], z: 1.45, creep: 0.0015, punch: 0.005, pn: 12 }],
    kicks: [[TURNS + 4, 0.6]],
    cast: (f) => [
      stand(PENSIONER, "pen", [0.9, 0, 4.2], 11, f, [[0, "smile_closed"], [TURNS, "grin"]], [[0, { l: [-0.45, -0.25], r: [-0.3, -0.3] }], [GIVES + 10, {}], [TURNS, { l: [-0.4, 0.0], r: [-0.25, 0.0] }]], { facing: -1 }),
      stand(DETECTIVE, "det", [-1.0, 0, 4.2], 21, f, [[0, "shock"], [TURNS, "stern"]], [[0, {}], [GIVES + 6, { l: [0.4, -0.3], r: [0.3, -0.3] }]], { facing: 1 }),
    ],
    under: (g, v) => paleMark(g, v),
    over: (g, v, f) => {
      // year counter rolling 1961 -> 1965
      if (f < GIVES + 10) { const u = clamp01((f - FOUR) / 18), yr = 1961 + Math.floor(u * 4.99), k = pop(f, FOUR - 2, 6) * (1 - smooth((f - GIVES - 2) / 8)); calendar(g, 540, 330, 260, String(yr), yr > 1961 ? String(yr - 1) : null, (u * 4.99) % 1, k); }
      // the canvas (no frame!) passes from his hands to the detective's
      const u = clamp01((f - GIVES) / 14), x0 = v.w([0.35, 1.25, 4.2]), x1 = v.w([-0.45, 1.3, 4.2]), m = v.ppm([0, 1.3, 4.2]);
      const p: P2 = [x0[0] + (x1[0] - x0[0]) * smooth(u), x0[1] + (x1[1] - x0[1]) * smooth(u) - Math.sin(Math.PI * u) * 40];
      dukePortrait(g, p[0], p[1], m * 0.5, m * 0.62); g.lineWidth = 5; g.strokeStyle = INK; g.strokeRect(p[0] - m * 0.25, p[1] - m * 0.31, m * 0.5, m * 0.62);
      if (f >= GIVES + 14) label(g, p[0], p[1] - m * 0.6, "NO FRAME", f - GIVES - 14);
      if (f >= TURNS + 4) { const w = v.w([0.6, 1.0, 4.2]); ringWaves(g, w[0], w[1], m * 0.15, f - TURNS - 4, 0.7, 2); label(g, w[0] + 80, w[1] + 120, "CLICK", f - TURNS - 4); }
    },
  });
}
// 10 — "At the trial, his lawyer says he never meant to keep it. And the jury agrees."  (courtroom; jurors nod in sync)
const CX = 120;
{
  const A0 = F(tTrial) - 4, LAW = F(tLawyer), AGR = F(tAgrees);
  const jurors = (f: number) => [0, 1, 2, 3, 4, 5].map((i) => {
    const row = i < 3 ? 0 : 1, P: V3 = [CX + 2.95 + (i % 3) * 0.95, row ? 0.35 : 0, 1.4 + row * 1.6];
    const nod = f >= AGR - 2 && f < AGR + 30 ? Math.max(0, Math.sin((f - AGR + 2) * 0.45)) * 0.08 : 0;
    return stand(FOLK[i], "j" + i, P, 40 + i, f, [[0, "neutral"], [AGR, "smile_closed"]], [[0, {}]], { facing: -1, headTilt: nod * 60 }, { clip: above(CX + 2.2, CX + 5.8, row ? 0.35 + 0.95 : 0.95, row ? 2.2 : 0.6), noShadow: true });
  });
  add({
    a: A0, b: F(tNot) - 4, plate: "court", xfade: 8,
    keys: [{ f: A0, at: [CX, 2.0, 3], z: 1.08, creep: 0.0015 },
      { f: LAW - 4, dur: 14, at: [CX - 1.6, 1.6, 1.4], z: 1.25, creep: 0.0015 },
      { f: AGR - 8, dur: 14, at: [CX + 3.6, 1.6, 2.0], z: 1.25, creep: 0.0015 }],
    kicks: [[AGR, 0.3]],
    cast: (f) => [
      stand(JUDGE, "judge", [CX, 1.0, 5.6], 51, f, [[0, "stern"]], [[0, { l: [0.3, 0.2], r: [-0.3, 0.2] }]], { facing: 0 }, { clip: above(CX - 3, CX + 3, 1.95, 4.85), noShadow: true }),
      stand(PENSIONER, "pen", [CX - 3.3, 0, 1.4], 11, f, [[0, "nervous"], [AGR, "relief"]], [[0, {}]], { facing: 1 }, { clip: above(CX - 4.6, CX - 2.0, 1.15, 0.3), noShadow: true }),
      stand(LAWYER, "law", [CX - 0.7, 0, 0.8], 52, f, [[0, "neutral"], [LAW, "grin"]], [[0, {}], [LAW, { r: [0.55, -0.7] }], [LAW + 18, { l: [-0.5, -0.4], r: [0.5, -0.4] }]], { facing: 1 }),
      ...jurors(f),
    ],
    over: (g, v, f) => {
      for (let i = 0; i < 6; i++) { const row = i < 3 ? 0 : 1, p = v.w([CX + 2.95 + (i % 3) * 0.95, (row ? 0.35 : 0) + 2.15, 1.4 + row * 1.6]); const age = f - AGR - i * 2; if (age >= 0 && age < 40) { const k = easeOutBack(clamp01(age / 7), 2.2); g.save(); g.translate(p[0], p[1]); g.scale(k, k); g.lineWidth = 10; g.strokeStyle = INK; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-4, 14); g.lineTo(22, -16); g.stroke(); g.lineWidth = 6; g.strokeStyle = "#5aa83c"; g.stroke(); g.restore(); } }
    },
  });
}
// 11 — "Not guilty of stealing the painting... guilty of stealing the frame. Because he never gave that back. Three
//       months in jail."  (giant judge; NOT GUILTY on the portrait; the empty frame floats in: GUILTY; bars slam)
{
  const A0 = F(tNot) - 4, NOT = F(tNot), G2 = F(tGuilty2), BEC = F(tBecause), THREE = F(tThree);
  add({
    a: A0, b: F(tWait) - 4, plate: "court_cu", xfade: 6,
    keys: [{ f: A0, at: [CX, 2.5, 5.6], z: 1.05, creep: 0.0018 }, { f: G2 - 3, dur: 8, at: [CX, 2.55, 5.6], z: 1.18, roll: 0.03, creep: 0.0015, punch: 0.005, pn: 12 }],
    kicks: [[NOT + 3, 0.7], [G2 + 3, 0.9], [THREE + 8, 1.0]],
    cast: (f) => [stand(JUDGE, "judge", [CX, 1.0, 5.6], 51, f, [[0, "stern"], [THREE, "grin"]], [[0, { r: [0.4, -0.5] }]], { facing: 0 }, { clip: above(CX - 3, CX + 3, 1.95, 4.85), noShadow: true })],
    over: (g, v, f) => {
      const hand = v.w([CX - 0.45, 2.25, 5.0]), m = v.ppm([CX, 2.2, 5.0]);
      const strike = (h: number) => (f >= h - 6 && f < h + 6 ? (f < h ? (f - h + 6) / 6 : 1 - (f - h) / 6) : 0);
      gavel(g, hand[0], hand[1], m * 0.55, Math.max(strike(NOT + 3), strike(G2 + 3)));
      // the portrait (left) gets NOT GUILTY
      const k1 = easeOutBack(clamp01((f - NOT + 4) / 8), 1.8) * (1 - smooth((f - G2 + 6) / 8));
      if (k1 > 0) { g.save(); g.translate(300, 620); g.scale(k1, k1); goya(g, 0, 0, 230); g.restore(); stampW(g, "NOT GUILTY", f, NOT + 4, G2 - 6, 300, 640, 420, -0.2); }
      // the empty frame floats in with a spotlight: GUILTY
      const k2 = easeOutBack(clamp01((f - G2 + 4) / 9), 1.6);
      if (k2 > 0) {
        const bob = Math.sin(f * 0.12) * 12, wob = f > BEC && f < BEC + 20 ? Math.sin((f - BEC) * 0.8) * 0.06 * (1 - (f - BEC) / 20) : 0;
        g.save(); const sp = g.createRadialGradient(540, 640, 40, 540, 640, 420); sp.addColorStop(0, `rgba(255,248,220,${0.45 * k2})`); sp.addColorStop(1, "rgba(255,248,220,0)"); g.fillStyle = sp; g.fillRect(0, 200, 1080, 900); g.restore();
        g.save(); g.translate(540, 640 + bob); g.rotate(wob); g.scale(k2, k2); giltFrame(g, 0, 0, 300, 375, 42); g.restore();
        stampW(g, "GUILTY", f, G2 + 4, 99999, 540, 700, 440, -0.15);
      }
      jailBars(g, clamp01((f - THREE - 2) / 12));
      if (f >= THREE + 8) { g.save(); g.translate(540, 1150); const k = easeOutBack(clamp01((f - THREE - 8) / 8), 2); g.scale(k, k); g.font = "900 150px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 28; g.strokeStyle = INK; g.strokeText("3 MONTHS", 0, 0); g.fillStyle = "#ffd24a"; g.fillText("3 MONTHS", 0, 0); g.restore(); }
    },
  });
}
// 12 — "Wait, it gets better. In 2012, secret files revealed his son had confessed..."  (the SECRET file opens)
{
  const A0 = F(tWait) - 4, WAIT = F(tWait), Y12 = F(t2012), FILES = F(tFiles), SONW = F(tSon), CONF = F(tConfessed);
  add({
    a: A0, b: F(tClimbed2) - 8, plate: "home", whip: true,
    keys: [{ f: A0, at: [180, 1.6, 3], z: 1.25, roll: -0.05, creep: 0.002 }],
    kicks: [[WAIT, 0.5], [Y12, 0.4], [CONF + 2, 0.7]],
    over: (g, _v, f) => {
      dim(g, 0.6);
      if (f < Y12) qmark(g, 540, 330, 160, f - WAIT, 0.1);
      stampW(g, "2012", f, Y12, FILES - 2, 540, 330, 380);
      secretFile(g, 540, 900, 820, clamp01((f - FILES - 2) / 12), easeOutBack(clamp01((f - Y12 + 2) / 9), 1.6), (cx, cy, s) => {
        g.save(); g.fillStyle = "#f8f6f1"; g.fillRect(cx - s / 2, cy - s * 0.6, s, s * 1.2); g.lineWidth = 6; g.strokeStyle = INK; g.strokeRect(cx - s / 2, cy - s * 0.6, s, s * 1.2);
        const show = clamp01((f - SONW) / 8);
        g.fillStyle = "#3f6fb5"; g.beginPath(); g.roundRect(cx - s * 0.32, cy + s * 0.05, s * 0.64, s * 0.5, s * 0.15); g.fill();
        g.fillStyle = "#f8f6f1"; g.beginPath(); g.arc(cx, cy - s * 0.12, s * 0.22, 0, 7); g.fill(); g.lineWidth = 5; g.stroke();
        g.globalAlpha = show; g.fillStyle = "#3a2a20"; g.beginPath(); g.ellipse(cx, cy - s * 0.25, s * 0.23, s * 0.12, 0, Math.PI, 0); g.fill();
        g.fillStyle = INK; g.beginPath(); g.arc(cx - s * 0.07, cy - s * 0.12, s * 0.025, 0, 7); g.arc(cx + s * 0.07, cy - s * 0.12, s * 0.025, 0, 7); g.fill();
        g.globalAlpha = 1 - show; g.fillStyle = INK; g.font = `900 ${s * 0.4}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", cx, cy - s * 0.1); g.globalAlpha = 1;
        g.restore();
      });
      if (f >= SONW) { g.save(); g.translate(540, 330); const k = easeOutBack(clamp01((f - SONW) / 8), 2); g.scale(k, k); g.font = "900 120px 'Montserrat'"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 24; g.strokeStyle = INK; g.strokeText("HIS SON", 0, 0); g.fillStyle = "#ffd24a"; g.fillText("HIS SON", 0, 0); g.restore(); }
      stampW(g, "CONFESSED", f, CONF + 2, 99999, 600, 1080, 520, -0.18);
    },
  });
}
// 13 — "...he was the one who climbed through that window."  (night: the son hops in easily)
{
  const A0 = F(tClimbed2) - 8, CL = F(tClimbed2), WIN = F(tWindow2);
  const OX = 60;
  add({
    a: A0, b: F(tDad) - 4, plate: "ext_n", xfade: 8,
    keys: [{ f: A0, at: [OX, 2.2, -0.3], z: 1.3, creep: 0.002 }],
    kicks: [[WIN, 0.3]],
    cast: (f) => {
      const u = clamp01((f - CL + 4) / 14), dive = clamp01((f - CL - 8) / 10);
      if (dive >= 1) return [];
      const P: V3 = [OX - 0.2 + dive * 0.2, 1.12 + u * 0.75 + dive * 0.6, -0.75 + dive * 0.55];
      return [{ ...stand(SON, "son", P, 61, f, [[0, "grin"]], [[0, { l: [-0.3, -1.1], r: [0.3, -1.1] }]], { facing: 0 }), lean: dive * 1.3, scale: 1 - dive * 0.15, noShadow: true,
        clip: dive > 0.25 ? [[OX - 3, 0, -0.1], [OX + 3, 0, -0.1], [OX + 3, 2.25, -0.1], [OX - 3, 2.25, -0.1]] : undefined }];
    },
    over: (g, v, f) => {
      const w = v.w([60, 2.65, -0.1]), m = v.ppm([60, 2.6, -0.1]);
      speedLines(g, w[0], w[1], m * 0.6, m * 1.6, (f - CL - 6) / 12, 12);
      sparkle(g, w[0] + m * 0.5, w[1] - m * 0.5, m * 0.16, (f - WIN) / 12);
    },
  });
}
// 14 — "The dad took the blame."  (home: father and son; dad winks, finger to lips)
{
  const A0 = F(tDad) - 4, DAD = F(tDad), BL = F(tBlame);
  add({
    a: A0, b: F(tChanged) - 4, plate: "home", xfade: 8,
    keys: [{ f: A0, at: [179.8, 1.1, 1.8], z: 1.35, creep: 0.002 }],
    kicks: [[BL, 0.4]],
    cast: (f) => [
      stand(PENSIONER, "pen", [179.1, 0.18, 1.75], 11, f, [[0, "smile_closed"], [BL, "grin"]], [[0, {}], [BL - 2, { r: [0.1, -0.85] }]], { mode: "sit", facing: 0 }, { noShadow: true }),
      stand(SON, "son", [180.3, 0, 1.6], 61, f, [[0, "nervous"], [BL + 6, "relief"]], [[0, {}]], { facing: -1 }),
    ],
    over: (g, v, f) => {
      const hd = v.w([179.1, 1.36, 1.75]), m = v.ppm([179.1, 1.3, 1.75]);
      specs(g, hd[0], hd[1] + m * 0.02, m * 0.42);
      if (f >= BL) { label(g, hd[0], hd[1] - m * 0.8, "SHHH", f - BL); sparkle(g, hd[0] + m * 0.25, hd[1] - m * 0.05, m * 0.12, (f - BL - 4) / 12); }
      g.save(); g.globalCompositeOperation = "multiply"; g.fillStyle = "rgba(255,225,190,0.35)"; g.fillRect(0, 0, 1080, 1920); g.restore();
    },
  });
}
// 15 — "And Britain changed the law, so nobody can 'borrow' a painting ever again."  (law book slams; the Goya back up)
{
  const A0 = F(tChanged) - 4, LAW = F(tLaw), BOR = F(tBorrow);
  add({
    a: A0, b: TOTAL, plate: "gal_d", xfade: 8,
    keys: [{ f: A0, at: [0, 2.4, 6.5], z: 1.25, creep: 0.0018 }, { f: BOR - 4, dur: 12, at: [0, 2.5, 7.4], z: 1.45, creep: 0.002 }],
    kicks: [[LAW + 6, 1.0]],
    cast: (f) => [stand(GUARD, "guard", [0.95, 0, 6.2], 71, f, [[0, "stern"], [BOR + 6, "grin"]], [[0, { l: [0.2, 0.5], r: [-0.2, 0.5] }]], { facing: -1 })],
    under: (g, v) => goyaOnWall(g, v),
    over: (g, v, f) => {
      lawBook(g, 540, 1100 + smooth((f - BOR + 10) / 10) * 1300, 720, clamp01((f - LAW + 2) / 10), "THEFT ACT", "1968");
      if (f >= LAW + 8 && f < LAW + 24) for (let i = 0; i < 6; i++) puff(g, 240 + i * 120, 1340, 70, f - LAW - 8 - i, 16, "#e1cfa8");
      const c = v.w(GOYA_P), m = v.ppm(GOYA_P);
      if (f >= BOR - 2) { const k = easeOutBack(clamp01((f - BOR + 2) / 8), 2); g.save(); g.translate(c[0], c[1] + m * 0.95); g.scale(k, k); g.beginPath(); g.roundRect(-m * 0.95, -m * 0.2, m * 1.9, m * 0.4, 14); g.fillStyle = "#fff6e0"; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.fillStyle = "#d42f2f"; g.font = `900 ${m * 0.17}px 'Montserrat'`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("PLEASE DO NOT BORROW", 0, 2); g.restore(); }
      sparkle(g, c[0] + m * 0.35, c[1] - m * 0.45, m * 0.14, (f - BOR) / 12);
    },
  });
}

export const PLATE_IDS = [...new Set(SHOTS.map((s) => s.plate))];
export const overlay = (_g: CanvasRenderingContext2D, _f: number) => undefined;
