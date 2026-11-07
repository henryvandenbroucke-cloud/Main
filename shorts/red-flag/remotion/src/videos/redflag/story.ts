// "The Man Who Walked in Front of Cars": 3D background plates (1.5x frame). A Victorian village road along x: the
// dirt road at z -2.7..2.7, a dry-stone wall + hedges + cottages on the far side (+z), hills beyond.
export const D0 = 0;
export type V3 = [number, number, number];
export type Light = "day" | "golden" | "night";
export type Show = "none";
export type PlateDef = {
  id: string; light: Light; pos: V3; look: V3; fov: number;
  cInf: number; focus?: V3; az?: number; el?: number; show?: Show[];
  /** plate width in px (default PW); wide plates are panoramas the 2D camera tracks along */
  w?: number;
};
export const PW = 1620, PH = 2880;
export const STRIP_W = 5400;
/** the procession's lane (road centre line is z = 0; it drives on the near half) */
export const LANE = -0.6;
export const PLATES: PlateDef[] = [
  // the road side-on: a panorama the camera tracks along (x runs right-to-left on screen)
  { id: "road", light: "day", w: STRIP_W, pos: [0, 2.9, -10], look: [0, 0.95, 0], fov: 44, cInf: 6, focus: [0, 1.0, LANE], az: 150, el: 34 },
  // the same panorama, regraded warm in 2D for the November ending
  { id: "road_w", light: "day", w: STRIP_W, pos: [0, 2.9, -10], look: [0, 0.95, 0], fov: 44, cInf: 6, focus: [0, 1.0, LANE], az: 150, el: 34 },
  // high wide down the road: the village, the hills, the long road ahead
  { id: "road_wide", light: "day", pos: [-26, 7.5, -13], look: [-3, 0.6, 1.5], fov: 48, cInf: 0, az: 135, el: 38 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
