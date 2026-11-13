// "Why Stamps Exist": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
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
  // the Lake District cottage: wide panorama (road, cottage, lake, fells), the doorstep close-up, and a golden version
  { id: "lake_w", light: "day", w: STRIP_W, pos: [0, 2.1, -10], look: [0, 2.4, 8], fov: 50, cInf: 3, focus: [0, 1.2, -2.5], az: 120, el: 42 },
  { id: "door_cu", light: "day", pos: [0.45, 1.75, -1.9], look: [0.05, 1.6, 4.0], fov: 44, cInf: 10, focus: [0.2, 1.4, 3.1], az: 120, el: 42 },
  { id: "door_g", light: "golden", pos: [0.45, 1.75, -1.9], look: [0.05, 1.6, 4.0], fov: 44, cInf: 10, focus: [0.2, 1.4, 3.1], az: 140, el: 9 },
  // the London street: wide panorama, a doorstep close-up
  { id: "street_w", light: "day", w: STRIP_W, pos: [-300, 2.3, -8.5], look: [-300, 3.2, 6], fov: 52, cInf: 3, focus: [-300, 1.4, 3.6], az: 110, el: 40 },
  { id: "street_cu", light: "day", pos: [-301.0, 1.75, -1.6], look: [-301.4, 1.6, 5.0], fov: 44, cInf: 10, focus: [-301.4, 1.4, 4.3], az: 110, el: 40 },
  // the Post Office sorting hall: wide (panorama), the sorting table close-up
  { id: "po_w", light: "day", w: STRIP_W, pos: [400, 2.6, -7.5], look: [400, 2.6, 6], fov: 54, cInf: 4, focus: [400, 1.4, 2.4], az: 200, el: 55 },
  { id: "po_cu", light: "day", pos: [400.4, 1.8, 0.6], look: [400, 1.0, 2.3], fov: 44, cInf: 12, focus: [400, 1.0, 2.2], az: 200, el: 55 },
  // Rowland Hill's study
  { id: "study", light: "day", pos: [460.3, 1.8, -0.9], look: [460, 1.35, 2.6], fov: 46, cInf: 10, focus: [460, 1.2, 2.5], az: 200, el: 45 },
  // today: the table top
  { id: "today", light: "day", pos: [520.2, 1.7, 0.9], look: [520, 0.8, 2.5], fov: 44, cInf: 12, focus: [520, 0.8, 2.5], az: 200, el: 30 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
