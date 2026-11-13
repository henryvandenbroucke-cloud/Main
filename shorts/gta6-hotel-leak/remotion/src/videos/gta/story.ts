// "The casino shorts (edge-sorting + Monte Carlo)": 3D background plates (1.5x frame). Four sets in one scene: the gallery room
// at the origin (back wall z = 8), the gallery's back wall outside at x = 60 (night), the courtroom at x = 120, and
// the pensioner's front room at x = 180.
export const D0 = 0;
export type V3 = [number, number, number];
export type Light = "day" | "golden" | "night" | "vice";
export type Show = "none";
export type PlateDef = {
  id: string; light: Light; pos: V3; look: V3; fov: number;
  cInf: number; focus?: V3; az?: number; el?: number; show?: Show[];
  w?: number;
};
export const PW = 1620, PH = 2880;
export const STRIP_W = 5400;
export const PLATES: PlateDef[] = [
  // the hotel room: toward the bed (the TV is behind the lens), and the reverse: from the bed to the TV and the door
  { id: "hotel_w", light: "day", pos: [0.6, 1.55, -2.2], look: [0.35, 1.05, 1.8], fov: 54, cInf: 8, focus: [0, 0.9, 1.4], az: 200, el: 50 },
  { id: "hotel_tv", light: "day", pos: [0.15, 1.2, 1.0], look: [0.3, 1.15, -2.5], fov: 50, cInf: 10, focus: [0, 1.25, -2.45], az: 200, el: 50 },
  // the hotel corridor: down to room 214, and close on its door
  { id: "corr_w", light: "day", pos: [60, 1.6, -3.0], look: [60, 1.3, 12], fov: 46, cInf: 6, focus: [60, 1.2, 4.5], az: 200, el: 50 },
  { id: "corr_door", light: "day", pos: [60, 1.55, 8.2], look: [60, 1.15, 14], fov: 50, cInf: 10, focus: [60, 1.1, 13.9], az: 200, el: 50 },
  // the game studio: the office floor with the screen wall, and the screen wall close
  { id: "studio_w", light: "day", pos: [120, 1.9, -3.2], look: [120, 1.55, 5], fov: 52, cInf: 6, focus: [120, 1.3, 2.4], az: 200, el: 50 },
  { id: "studio_mon", light: "day", pos: [120, 2.25, 0.8], look: [120, 2.35, 6], fov: 52, cInf: 12, focus: [120, 2.35, 5.9], az: 200, el: 50 },
  // the Crown Court
  { id: "court", light: "day", pos: [180, 2.0, -3.5], look: [180, 1.6, 4.0], fov: 48, cInf: 8, focus: [180, 1.6, 4.0], az: 200, el: 50 },
  // Leonida at sunset: down the beach into the sun, and up at the roof billboard
  { id: "leo_w", light: "vice", pos: [243, 1.7, 1.0], look: [245.5, 2.4, 40], fov: 56, cInf: 3, focus: [245, 2, 14], az: 0, el: 5 },
  { id: "leo_bb", light: "vice", pos: [236.5, 1.8, 15.5], look: [253.6, 13.0, 15.5], fov: 56, cInf: 3, focus: [253.6, 17, 15.5], az: 150, el: 8 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
