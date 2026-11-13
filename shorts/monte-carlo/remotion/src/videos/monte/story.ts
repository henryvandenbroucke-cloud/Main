// "The casino shorts (edge-sorting + Monte Carlo)": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
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
  // the London salon: wide (baccarat table + mirrors), the table close-up (shoe, felt, chips)
  { id: "salon_w", light: "day", pos: [0, 2.2, -2.6], look: [0, 1.3, 3.0], fov: 50, cInf: 6, focus: [0, 0.9, 2.6], az: 200, el: 55 },
  { id: "salon_cu", light: "day", pos: [0.2, 1.75, 0.2], look: [0.15, 1.0, 2.8], fov: 44, cInf: 12, focus: [0.15, 0.9, 2.6], az: 200, el: 55 },
  // the UK Supreme Court, the American casino floor
  { id: "uksc", light: "day", pos: [60, 2.0, -4.0], look: [60, 1.6, 4.0], fov: 50, cInf: 8, focus: [60, 1.6, 4.0], az: 200, el: 50 },
  { id: "acity", light: "day", pos: [120, 1.8, -3.0], look: [120, 1.3, 4.0], fov: 50, cInf: 8, focus: [120, 1.2, 2.8], az: 200, el: 50 },
  // Monte Carlo: the gilded salon (panorama), a roulette table close-up (the middle wheel)
  { id: "mc_w", light: "day", w: STRIP_W, pos: [180, 2.6, -5.5], look: [180, 2.0, 5], fov: 52, cInf: 4, focus: [180, 1.0, 2.4], az: 200, el: 55 },
  { id: "mc_cu", light: "day", pos: [179.55, 1.85, 1.0], look: [179.25, 0.95, 2.4], fov: 42, cInf: 14, focus: [179.25, 0.95, 2.4], az: 200, el: 55 },
  // the Yorkshire mill, and the Yorkshire street at golden hour
  { id: "mill", light: "day", pos: [240, 2.0, -3.5], look: [240, 1.3, 4.0], fov: 50, cInf: 8, focus: [240, 1.1, 2.2], az: 200, el: 50 },
  { id: "yorks", light: "golden", pos: [300, 1.9, -5.5], look: [300, 2.6, 6], fov: 48, cInf: 6, focus: [300, 1.4, 3.6], az: 150, el: 14 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
