// "Why Tea Was Locked in a Box": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
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
  { id: "dr_wide", light: "day", pos: [0, 2.0, -5.6], look: [0, 1.7, 6], fov: 52, cInf: 4, focus: [0, 1.0, 2.5], az: 200, el: 58 },
  { id: "dr_gold", light: "golden", pos: [0, 2.0, -5.6], look: [0, 1.7, 6], fov: 52, cInf: 4, focus: [0, 1.0, 2.5], az: 200, el: 25 },
  { id: "dr_cu", light: "day", pos: [0.55, 1.3, 0.75], look: [0, 0.9, 2.5], fov: 38, cInf: 14, focus: [0, 0.9, 2.5], az: 200, el: 58 },
  { id: "dr_door", light: "day", pos: [-3.0, 1.55, -1.8], look: [-5.4, 1.35, 6], fov: 44, cInf: 8, focus: [-5.4, 1.3, 5.6], az: 210, el: 58 },
  { id: "dr_desk", light: "day", pos: [3.4, 1.65, -0.6], look: [5.4, 1.1, 3.2], fov: 46, cInf: 9, focus: [5.3, 1.0, 3.0], az: 200, el: 58 },
  { id: "beach_n", light: "night", w: STRIP_W, pos: [78, 1.8, -8.0], look: [78, 1.2, 6], fov: 50, cInf: 4, focus: [80, 0.8, 0.5], az: 200, el: 40 },
  { id: "shed_d", light: "day", w: STRIP_W, pos: [160, 1.8, -5.6], look: [160, 1.4, 5], fov: 52, cInf: 5, focus: [160, 1.0, 1.4], az: 210, el: 55 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
