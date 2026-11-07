// "The Pensioner Who Stole a Masterpiece": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
// at the origin (back wall z = 8), the gallery's back wall outside at x = 60 (night), the courtroom at x = 120, and
// the pensioner's front room at x = 180.
export const D0 = 0;
export type V3 = [number, number, number];
export type Light = "day" | "golden" | "night";
export type Show = "none";
export type PlateDef = {
  id: string; light: Light; pos: V3; look: V3; fov: number;
  cInf: number; focus?: V3; az?: number; el?: number; show?: Show[];
  w?: number;
};
export const PW = 1620, PH = 2880;
export const STRIP_W = 5400;
export const PLATES: PlateDef[] = [
  { id: "gal_d", light: "day", pos: [0, 2.0, -6.4], look: [0, 3.0, 8], fov: 50, cInf: 5, focus: [0, 1.6, 4.5], az: 160, el: 62 },
  { id: "gal_n", light: "night", pos: [0, 2.0, -6.4], look: [0, 3.0, 8], fov: 50, cInf: 5, focus: [0, 1.6, 4.5], az: 160, el: 62 },
  // close-up: a face in the foreground (z ~ 1.7), the wall far behind and soft
  { id: "gal_cu", light: "day", pos: [1.3, 1.62, -0.6], look: [0.1, 2.3, 8], fov: 40, cInf: 16, focus: [1.0, 1.62, 1.6], az: 150, el: 60 },
  { id: "ext_n", light: "night", pos: [57.6, 1.2, -5.8], look: [60, 2.5, 0], fov: 48, cInf: 4, focus: [60, 2.5, -0.3], az: 210, el: 48 },
  { id: "court", light: "day", w: STRIP_W, pos: [120, 2.7, -8.4], look: [120, 1.8, 4], fov: 54, cInf: 5, focus: [120, 1.4, 1.5], az: 150, el: 60 },
  { id: "court_cu", light: "day", pos: [120.5, 2.35, 2.2], look: [120, 2.6, 7], fov: 40, cInf: 14, focus: [120, 2.4, 5.4], az: 150, el: 60 },
  { id: "home", light: "day", pos: [180, 1.6, -5.5], look: [180.2, 1.2, 3], fov: 54, cInf: 5, focus: [180, 1.0, 1.8], az: 200, el: 52 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
