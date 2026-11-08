// "The Robbers Who Never Broke a Lock": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
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
  // the Brink's building at night: wide street panorama, the entrance door close-up; and by day (the arrests)
  { id: "ext_w", light: "day", w: STRIP_W, pos: [0, 2.0, -9], look: [0, 3.0, 6], fov: 52, cInf: 4, focus: [0, 1.4, 4.5], az: 120, el: 40 },
  { id: "ext_door", light: "day", pos: [0.9, 1.6, 0.2], look: [0.4, 1.45, 6], fov: 44, cInf: 12, focus: [0.4, 1.3, 5.0], az: 120, el: 40 },
  { id: "ext_day", light: "day", pos: [0.6, 1.7, 0.2], look: [0.3, 1.5, 6], fov: 46, cInf: 12, focus: [0.3, 1.3, 4.6], az: 110, el: 45 },
  // the corridor of locked doors: wide (panorama) and the middle door's lock
  { id: "corr_w", light: "day", w: STRIP_W, pos: [60, 1.8, -5], look: [60, 1.6, 4.2], fov: 52, cInf: 5, focus: [60, 1.2, 3.4], az: 200, el: 45 },
  { id: "corr_cu", light: "day", pos: [60.5, 1.5, 0.3], look: [60.05, 1.25, 4.2], fov: 42, cInf: 14, focus: [60, 1.2, 3.9], az: 200, el: 45 },
  // the locksmith's bench, the vault room, the hideout, the hospital room
  { id: "smith", light: "day", pos: [120.3, 1.75, -0.4], look: [120, 1.15, 3.0], fov: 44, cInf: 14, focus: [120, 1.2, 2.6], az: 200, el: 45 },
  { id: "vault", light: "day", pos: [181, 2.2, -5.2], look: [180.8, 1.5, 4.0], fov: 50, cInf: 8, focus: [181, 1.2, 1.6], az: 200, el: 50 },
  { id: "hide", light: "day", pos: [240.2, 1.8, -2.4], look: [240, 1.2, 3.0], fov: 46, cInf: 12, focus: [240, 1.1, 2.2], az: 200, el: 45 },
  { id: "hosp", light: "day", pos: [300.3, 1.8, -0.8], look: [300, 1.0, 3.0], fov: 46, cInf: 12, focus: [300, 0.9, 2.8], az: 200, el: 45 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
