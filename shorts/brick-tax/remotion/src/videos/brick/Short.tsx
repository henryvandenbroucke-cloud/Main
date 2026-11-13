// "The Man Who Made Bricks Too Big" — the fast 2D pass over the pre-rendered 3D plates. Per frame: the plate through
// the shot's 2D camera (creeping push-ins, glides, rolls, impact kicks), the cast as lit flat cards standing on the
// projected 3D ground (contact shadow, scene tint, lens blur by depth), props + effects, crossfades, the hook flash
// and one-word captions.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, Audio, getInputProps } from "remotion";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import { bodyFront, Pen } from "./toon";
import { plateOf, PlateDef } from "./story";
import { PlateCam, View, cam2At, kickAt } from "./view";
import { SHOTS, Shot, Actor, layersAt, FLASH_AT, PLATE_IDS, FPS } from "./shots";
import WORDS from "./words.json";

const SU = 0.00216; // metres per design unit (template cast.ts)
const rad = (d: number) => (d * Math.PI) / 180;
/** canvas angle the key light comes FROM, per plate (sun az/el of the plate) */
const LIGHT_ANGLE: Record<string, number> = { yard_ms_g: rad(-160), town_end_g: rad(-20) };
const TINT: Record<string, string> = { day: "#fff4ee", golden: "#ffcf9e" };

const imgs = new Map<string, HTMLImageElement>();
const pcs = new Map<string, PlateCam>();
const pcOf = (id: string) => { let p = pcs.get(id); if (!p) { p = new PlateCam(plateOf(id)); pcs.set(id, p); } return p; };

let off: HTMLCanvasElement | null = null, off2: HTMLCanvasElement | null = null;
const offs = (w: number, h: number) => {
  off ??= document.createElement("canvas"); off2 ??= document.createElement("canvas");
  for (const c of [off, off2]) { if (c.width < w) c.width = w; if (c.height < h) c.height = h; }
  return [off, off2] as const;
};

const drawActor = (g: CanvasRenderingContext2D, v: View, a: Actor, p: PlateDef) => {
  const sc = a.scale ?? 1, P = a.P, ppm = v.ppm(P), k = ppm * SU * sc;
  if (k < 0.02) return;
  const ground = v.w(P), feet = v.w([P[0], P[1] + (a.hop ?? 0), P[2]]);
  // contact shadow on the ground
  const rx = 0.42 * ppm * sc, ry = rx * 0.32;
  g.save(); g.translate(ground[0], ground[1]); g.rotate(v.cam.roll);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  const sh = p.light === "golden" ? "60,30,70" : "40,32,80";
  gr.addColorStop(0, `rgba(${sh},0.5)`); gr.addColorStop(0.55, `rgba(${sh},0.32)`); gr.addColorStop(1, `rgba(${sh},0)`);
  g.scale(1, ry / rx); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
  g.restore();
  // the card: drawn at its own size into an offscreen canvas, tinted by the scene light, then placed (+ lens blur)
  const W = Math.ceil(1500 * k), H = Math.ceil(1600 * k), ox = W / 2, oy = H - 80 * k;
  const [c1, c2] = offs(W, H);
  const g1 = c1.getContext("2d")!, g2 = c2.getContext("2d")!;
  g1.setTransform(1, 0, 0, 1, 0, 0); g1.clearRect(0, 0, W, H);
  g1.setTransform(k, 0, 0, k, ox - 300 * k, oy - 975 * k);
  const light = LIGHT_ANGLE[p.id] ?? rad(-55);
  bodyFront(new Pen(g1), a.o, { ...a.opts, light, seed: a.seed });
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, W, H);
  g2.globalCompositeOperation = "source-over"; g2.drawImage(c1, 0, 0, W, H, 0, 0, W, H);
  g2.globalCompositeOperation = "multiply"; g2.fillStyle = TINT[p.light]; g2.fillRect(0, 0, W, H);
  g2.globalCompositeOperation = "destination-in"; g2.drawImage(c1, 0, 0, W, H, 0, 0, W, H);
  g2.globalCompositeOperation = "source-over";
  // lens blur: thin-lens circle of confusion relative to the plate's focus
  const fd = p.focus ? v.pc.depth(p.focus) : v.pc.depth(p.look), d = v.pc.depth(P);
  const coc = p.cInf * 1.2 * Math.abs(1 - fd / Math.max(0.3, d)) * v.s;
  g.save(); g.translate(feet[0], feet[1]); g.rotate(v.cam.roll);
  if (coc > 1.2) g.filter = `blur(${Math.min(14, coc * 0.5).toFixed(1)}px)`;
  g.drawImage(c2, 0, 0, W, H, -ox, -oy, W, H);
  g.restore();
};

const drawShot = (g: CanvasRenderingContext2D, s: Shot, f: number) => {
  const p = plateOf(s.plate), pc = pcOf(s.plate), img = imgs.get(s.plate);
  const cam = cam2At(pc, s.keys, f), v = new View(pc, cam, kickAt(s.kicks ?? [], f));
  g.save(); v.applyPlate(g);
  if (img) g.drawImage(img, 0, 0);
  g.restore();
  if (s.night) { // moonlit blue + warm candle pool (the "You see" explanation)
    g.save(); g.globalCompositeOperation = "multiply"; g.fillStyle = "#3a4fb8"; g.fillRect(0, 0, 1080, 1920);
    g.globalCompositeOperation = "screen"; g.fillStyle = "rgba(20,30,90,0.35)"; g.fillRect(0, 0, 1080, 1920);
    const c = v.w([59.6, 1.12, 1.78]), r = v.ppm([59.6, 1, 1.78]) * 1.3;
    g.globalCompositeOperation = "screen";
    const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
    gr.addColorStop(0, "rgba(255,170,80,0.85)"); gr.addColorStop(0.45, "rgba(230,120,60,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
    g.restore();
  }
  s.under?.(g, v, f);
  const cast = (s.cast?.(f) ?? []).slice().sort((a, b) => pc.depth(b.P) - pc.depth(a.P));
  for (const a of cast) drawActor(g, v, a, p);
  s.over?.(g, v, f);
};

// ---------------- captions: one word at a time, white heavy sans with a black outline, lower middle ----------------
type Word = { w: string; s: number; e: number };
const FIX: Record<string, string> = { "Meesham.": "Measham.", "Meesham,": "Measham,", "mold,": "mould,", "Wilkes": "Wilkes'" };
const wordAt = (t: number) => {
  const W = WORDS as Word[];
  let cur: Word | null = null;
  for (let i = 0; i < W.length; i++) {
    if (W[i].s <= t + 0.02) { const end = i + 1 < W.length ? W[i + 1].s : W[i].e + 0.4; if (t < end) cur = W[i]; }
  }
  return cur;
};
const drawCaption = (g: CanvasRenderingContext2D, f: number) => {
  const t = f / FPS, w = wordAt(t);
  if (!w) return;
  const txt = FIX[w.w] ?? w.w, age = f - Math.round(w.s * FPS);
  const k = age < 0 ? 1 : age < 3 ? [1.16, 1.08, 1.03][age] : 1;
  g.save(); g.translate(540, 1390); g.scale(k, k);
  let size = 96;
  g.font = `900 ${size}px 'Montserrat'`;
  const mw = g.measureText(txt).width;
  if (mw > 900) { size = Math.floor((size * 900) / mw); g.font = `900 ${size}px 'Montserrat'`; }
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = size * 0.2; g.strokeStyle = "#000000"; g.strokeText(txt, 0, 0);
  g.fillStyle = "#ffffff"; g.fillText(txt, 0, 0);
  g.restore();
};

export const BrickShort: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(imgs.size === PLATE_IDS.length);
  const [handle] = useState(() => (ready ? null : delayRender("plates + fonts")));
  useEffect(() => {
    if (ready) return;
    const loads = PLATE_IDS.map((id) => new Promise<void>((res, rej) => {
      if (imgs.has(id)) return res();
      const im = new Image(); im.onload = () => { imgs.set(id, im); res(); }; im.onerror = () => rej(new Error("plate " + id));
      im.src = staticFile(`plates/${id}.png`);
    }));
    Promise.all([...loads, document.fonts.load("900 96px Montserrat"), document.fonts.load("800 50px Montserrat")])
      .then(() => { setReady(true); if (handle !== null) continueRender(handle); });
  }, [ready, handle]);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const g = ref.current.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
    g.fillStyle = "#000"; g.fillRect(0, 0, 1080, 1920);
    for (const L of layersAt(f)) { g.save(); g.globalAlpha = L.alpha; drawShot(g, L.s, f); g.restore(); }
    // soft vignette that ties the plates and the cards together
    const vg = g.createRadialGradient(540, 900, 600, 540, 960, 1250);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(20,10,40,0.28)");
    g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
    const fl = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
    if (fl) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, 1080, 1920); }
    if ((getInputProps() as { captions?: boolean }).captions !== false) drawCaption(g, f);
  }, [f, ready]);
  const audio = (getInputProps() as { audio?: string }).audio;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <canvas ref={ref} width={1080} height={1920} style={{ width: "100%", height: "100%" }} />
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
export const BRICK_FRAMES = SHOTS[SHOTS.length - 1].b;
