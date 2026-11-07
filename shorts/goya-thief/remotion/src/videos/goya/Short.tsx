// "The Man Who Walked in Front of Cars" — the 2D pass over the pre-rendered plates (v2, "clean"):
// plates at 1.5x, cast on the projected 3D ground (front or side-view walkers), eased poses, motion blur on fast
// camera moves and whip-pan transitions (sub-frame accumulation), crossfades, the hook flash and one-word captions.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, getInputProps } from "remotion";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import { bodyFront, bodySide, Pen } from "./toon";
import { plateOf, PlateDef } from "./story";
import { PlateCam, View, cam2At, kickAt } from "./view";
import { SHOTS, Shot, Actor, FLASH_AT, PLATE_IDS, FPS, TOTAL, overlay } from "./shots";
import WORDS from "./words.json";

const SU = 0.00216;
const rad = (d: number) => (d * Math.PI) / 180;
const LIGHT_ANGLE: Record<string, number> = {};
const TINT: Record<string, string> = { day: "#fff4ee", golden: "#ffcf9e", night: "#9aa9e6" };

const imgs = new Map<string, HTMLImageElement>();
const pcs = new Map<string, PlateCam>();
const pcOf = (id: string) => { let p = pcs.get(id); if (!p) { p = new PlateCam(plateOf(id)); pcs.set(id, p); } return p; };
const cnv = new Map<string, HTMLCanvasElement>();
const canvas = (key: string, w: number, h: number) => {
  let c = cnv.get(key); if (!c) { c = document.createElement("canvas"); cnv.set(key, c); }
  if (c.width < w) c.width = w; if (c.height < h) c.height = h; return c;
};

const drawActor = (g: CanvasRenderingContext2D, v: View, a: Actor, p: PlateDef) => {
  const sc = a.scale ?? 1, P = a.P, ppm = v.ppm(P), k = ppm * SU * sc;
  if (k < 0.02) return;
  const ground = v.w(P), feet = v.w([P[0], P[1] + (a.hop ?? 0), P[2]]);
  if (a.alpha !== undefined && a.alpha <= 0.01) return;
  if (!a.noShadow) {
    const rx = 0.42 * ppm * sc, ry = rx * 0.32;
    g.save(); g.translate(ground[0], ground[1]); g.rotate(v.cam.roll);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    const sh = p.light === "night" ? "10,14,50" : p.light === "golden" ? "60,30,70" : "40,32,80";
    gr.addColorStop(0, `rgba(${sh},0.5)`); gr.addColorStop(0.55, `rgba(${sh},0.3)`); gr.addColorStop(1, `rgba(${sh},0)`);
    g.scale(1, ry / rx); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const W = Math.ceil(1500 * k), H = Math.ceil(1700 * k), ox = W / 2, oy = H - 80 * k;
  const c1 = canvas("c1", W, H), c2 = canvas("c2", W, H);
  const g1 = c1.getContext("2d")!, g2 = c2.getContext("2d")!;
  g1.setTransform(1, 0, 0, 1, 0, 0); g1.clearRect(0, 0, W, H);
  g1.setTransform(k, 0, 0, k, ox - 300 * k, oy - 975 * k);
  const light = LIGHT_ANGLE[p.id] ?? (p.light === "night" ? rad(-120) : rad(-55));
  if (a.side) bodySide(new Pen(g1), a.o, { ...a.side, light, seed: a.seed });
  else bodyFront(new Pen(g1), a.o, { ...a.opts, light, seed: a.seed });
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, W, H);
  g2.globalCompositeOperation = "source-over"; g2.drawImage(c1, 0, 0, W, H, 0, 0, W, H);
  g2.globalCompositeOperation = "multiply"; g2.fillStyle = TINT[p.light]; g2.fillRect(0, 0, W, H);
  g2.globalCompositeOperation = "destination-in"; g2.drawImage(c1, 0, 0, W, H, 0, 0, W, H);
  g2.globalCompositeOperation = "source-over";
  g.save();
  if (a.alpha !== undefined) g.globalAlpha *= Math.max(0, a.alpha);
  if (a.clip) { const q = a.clip.map((c) => v.w(c)); g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip(); }
  const fd = p.focus ? v.pc.depth(p.focus) : v.pc.depth(p.look), d = v.pc.depth(P);
  const coc = p.cInf * (1620 / 1080) * Math.abs(1 - fd / Math.max(0.3, d)) * v.s;
  g.save(); g.translate(feet[0], feet[1]); g.rotate(v.cam.roll + (a.lean ?? 0));
  if (a.mirror) g.scale(-1, 1);
  if (coc > 1.2) g.filter = `blur(${Math.min(14, coc * 0.5).toFixed(1)}px)`;
  g.drawImage(c2, 0, 0, W, H, -ox, -oy, W, H);
  g.restore();
  g.restore();
};

/** whip-pan offset (output px) for a shot at frame f: leaving to the left before the next shot's whip, arriving from
 *  the right at the start of its own */
const WHIP = 6;
/** whip pan: over 2*WHIP frames centred on the cut, the outgoing shot slides out to the left while the incoming one
 *  slides in right behind it (cubic in-out), so the frame is always full; motion blur smears the move */
const whipE = (s: Shot, f: number) => { const u = Math.min(1, Math.max(0, (f - (s.a - WHIP)) / (2 * WHIP))); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };
const inWhip = (s: Shot, f: number) => !!s.whip && f >= s.a - WHIP && f < s.a + WHIP;
const whipDx = (s: Shot, f: number) => {
  const next = SHOTS[s.id];
  let dx = 0;
  if (next && inWhip(next, f)) dx -= whipE(next, f) * 1080;
  if (inWhip(s, f)) dx += (1 - whipE(s, f)) * 1080;
  return dx;
};
const viewOf = (s: Shot, f: number) => {
  const pc = pcOf(s.plate), cam = cam2At(pc, s.keys, f);
  return new View(pc, cam, kickAt(s.kicks ?? [], f), whipDx(s, f));
};
const drawShot = (g: CanvasRenderingContext2D, s: Shot, f: number) => {
  const p = plateOf(s.plate), img = imgs.get(s.plate), v = viewOf(s, f);
  g.save(); v.applyPlate(g); if (img) g.drawImage(img, 0, 0); g.restore();
  s.under?.(g, v, f);
  const cast = (s.cast?.(f) ?? []).slice().sort((a, b) => v.pc.depth(b.P) - v.pc.depth(a.P));
  for (const a of cast) { if (a.draw) a.draw(g, v); else drawActor(g, v, a, p); }
  s.over?.(g, v, f);
};

/** which shots are on screen at frame f (crossfade = the next shot fading in over `xfade` frames centred on its a;
 *  a whip shows only the outgoing shot before the cut and the incoming one after) */
const layersAt = (f: number): { s: Shot; alpha: number }[] => {
  for (const s of SHOTS) {
    if (inWhip(s, f)) return [{ s: SHOTS[s.id - 2], alpha: 1 }, { s, alpha: 1 }];
    const x = s.xfade;
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ s: SHOTS[s.id - 2], alpha: 1 }, { s, alpha: Math.min(1, (f - (s.a - x / 2) + 1) / (x + 1)) }];
  }
  return [{ s: SHOTS.find((q) => f >= q.a && f < q.b) ?? SHOTS[SHOTS.length - 1], alpha: 1 }];
};
/** screen speed of the frame centre (output px per frame) -> number of motion-blur samples */
const blurSamples = (f: number) => {
  const L = layersAt(f)[0].s;
  const a = viewOf(L, f - 0.5), b = viewOf(L, f + 0.5);
  const pa = a.fromPlate([a.cam.cx, a.cam.cy]), pb = b.fromPlate([a.cam.cx, a.cam.cy]);
  const sp = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) + Math.abs(Math.log(b.s / a.s)) * 900;
  return sp > 60 ? 6 : sp > 30 ? 3 : 1;
};

const drawFrame = (g: CanvasRenderingContext2D, f: number) => {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#000"; g.fillRect(0, 0, 1080, 1920);
  for (const L of layersAt(f)) { g.save(); g.globalAlpha = L.alpha; drawShot(g, L.s, f); g.restore(); }
  g.setTransform(1, 0, 0, 1, 0, 0); overlay(g, f);
};

type Word = { w: string; s: number; e: number };
/** the spoken "Ting" after "wine glass?" was not transcribed: add it */
const WORDS_X: Word[] = WORDS as Word[];
const FIX: Record<string, string> = {};
const wordAt = (t: number) => {
  const W = WORDS_X;
  let cur: Word | null = null;
  for (let i = 0; i < W.length; i++) if (W[i].s <= t + 0.02) { const end = i + 1 < W.length ? W[i + 1].s : W[i].e + 0.4; if (t < end) cur = W[i]; }
  return cur;
};
const drawCaption = (g: CanvasRenderingContext2D, f: number) => {
  const w = wordAt(f / FPS);
  if (!w) return;
  const txt = FIX[w.w] ?? w.w, age = f - Math.round(w.s * FPS);
  const k = age < 0 ? 1 : age < 3 ? [1.14, 1.06, 1.02][age] : 1;
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

export const GoyaShort: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(imgs.size === PLATE_IDS.length);
  const [handle] = useState(() => (ready ? null : delayRender("plates + fonts")));
  useEffect(() => {
    if (ready) return;
    const loads = PLATE_IDS.map((id) => new Promise<void>((res, rej) => {
      if (imgs.has(id)) return res();
      const im = new Image(); im.onload = () => { imgs.set(id, im); res(); }; im.onerror = () => rej(new Error("plate " + id));
      im.src = staticFile(`gyplates/${id}.png`);
    }));
    Promise.all([...loads, document.fonts.load("900 96px Montserrat"), document.fonts.load("800 50px Montserrat")])
      .then(() => { setReady(true); if (handle !== null) continueRender(handle); });
  }, [ready, handle]);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const g = ref.current.getContext("2d")!;
    const n = blurSamples(f);
    if (n === 1) drawFrame(g, f);
    else { // motion blur: average n sub-frames across the shutter (180 degrees)
      const acc = canvas("acc", 1080, 1920), ga = acc.getContext("2d")!;
      const tmp = canvas("tmp", 1080, 1920), gt = tmp.getContext("2d")!;
      for (let i = 0; i < n; i++) {
        drawFrame(gt, f + (i / (n - 1) - 0.5) * 0.5);
        ga.globalAlpha = 1 / (i + 1); ga.drawImage(tmp, 0, 0);
      }
      ga.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(acc, 0, 0);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const vg = g.createRadialGradient(540, 900, 600, 540, 960, 1250);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(10,8,40,0.3)");
    g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
    const fl = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
    if (fl) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, 1080, 1920); }
    if ((getInputProps() as { captions?: boolean }).captions !== false) drawCaption(g, f);
  }, [f, ready]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <canvas ref={ref} width={1080} height={1920} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
export const GOYA_FRAMES = TOTAL;
