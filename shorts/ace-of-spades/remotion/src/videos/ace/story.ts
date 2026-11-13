// "Why the Ace of Spades Is So Fancy": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
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
  // the print shop at night: wide, the press close-up (hero), the table corner
  { id: "shop_n", light: "day", w: STRIP_W, pos: [0, 2.0, -5.5], look: [0, 1.6, 6], fov: 52, cInf: 5, focus: [0, 1.0, 3.0], az: 200, el: 50 },
  { id: "shop_cu", light: "day", pos: [0.35, 1.75, 1.4], look: [0, 1.05, 3.35], fov: 40, cInf: 14, focus: [0, 1.05, 3.35], az: 200, el: 50 },
  // the Stamp Office by day (wide panorama)
  { id: "tax_d", light: "day", w: STRIP_W, pos: [60, 2.2, -6.0], look: [60, 1.7, 6], fov: 52, cInf: 4, focus: [60, 1.2, 2.7], az: 200, el: 58 },
  // the tavern card game, warm evening
  { id: "tav_g", light: "day", pos: [120, 2.4, -2.6], look: [120, 0.9, 2.6], fov: 50, cInf: 6, focus: [120, 0.9, 2.6], az: 200, el: 25 },
  { id: "tav_cu", light: "day", pos: [120.45, 1.75, 0.55], look: [120, 0.85, 2.6], fov: 44, cInf: 12, focus: [120, 0.82, 2.6], az: 200, el: 25 },
  // the Old Bailey: wide (panorama), the judge close-up, and the dark verdict
  { id: "court", light: "day", w: STRIP_W, pos: [180, 2.7, -8.0], look: [180, 1.8, 4], fov: 54, cInf: 5, focus: [180, 1.4, 1.5], az: 150, el: 60 },
  { id: "court_cu", light: "day", pos: [180.5, 2.35, 2.2], look: [180, 2.6, 7], fov: 40, cInf: 14, focus: [180, 2.4, 5.4], az: 150, el: 60 },
  { id: "court_n", light: "night", pos: [180.5, 2.35, 2.2], look: [180, 2.6, 7], fov: 40, cInf: 14, focus: [180, 2.4, 5.4], az: 150, el: 40 },
  // today: the table top
  { id: "today", light: "day", pos: [240.2, 1.7, 0.9], look: [240, 0.8, 2.5], fov: 44, cInf: 12, focus: [240, 0.8, 2.5], az: 200, el: 30 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
