// "The Man Who Hit Trains With a Hammer": 3D background plates (1.5x frame). A steam-era station: the train stands on
// the track along x; the platform is on +z, the tapper's gravel walkway on -z (wheels' outer faces toward -z).
export const D0 = 0;
export type V3 = [number, number, number];
export type Light = "day" | "golden" | "night";
export type Show = "mound" | "cage" | "headhole" | "pit";
export type PlateDef = {
  id: string; light: Light; pos: V3; look: V3; fov: number;
  cInf: number; focus?: V3; az?: number; el?: number; show?: Show[];
  /** plate width in px (default PW); wide plates are panoramas the 2D camera tracks along */
  w?: number;
};
export const PW = 1620, PH = 2880;

/** rail gauge half-width (outer wheel face plane) and the walkway side */
export const WZ = -0.72;
/** wheel centres along the train (carriage bogie wheels), radius 0.5 */
export const CAR_X0 = 2, CAR_LEN = 11, CARS = 3;
export const wheelXs = (() => {
  const xs: number[] = [];
  for (let c = 0; c < CARS; c++) { const x0 = CAR_X0 + c * (CAR_LEN + 0.8); for (const b of [1.6, CAR_LEN - 1.6]) for (const d of [-0.95, 0.95]) xs.push(x0 + b + d); }
  return xs;
})();
export const W_R = 0.5;
/** the hero wheel (cracked one) */
export const HERO_X = wheelXs[3];

/** the panoramic strip: the train side seen from the walkway, 5400 px wide (3.3 frames) */
export const STRIP_W = 5400;
export const STRIP_X = 9.5;
export const PLATES: PlateDef[] = [
  { id: "strip", light: "day", w: STRIP_W, pos: [STRIP_X, 1.25, -8.0], look: [STRIP_X, 1.35, 0], fov: 40, cInf: 7, focus: [STRIP_X, 1.0, -2.2], az: 160, el: 24 },
  // the ending: the day strip regraded warm in 2D (cleaner than the golden 3D light)
  { id: "strip_w", light: "day", w: STRIP_W, pos: [STRIP_X, 1.25, -8.0], look: [STRIP_X, 1.35, 0], fov: 40, cInf: 7, focus: [STRIP_X, 1.0, -2.2], az: 160, el: 24 },
  { id: "strip_g", light: "golden", w: STRIP_W, pos: [STRIP_X, 1.25, -8.0], look: [STRIP_X, 1.35, 0], fov: 40, cInf: 6, focus: [STRIP_X, 1.0, -2.2], az: 168, el: 13 },
  // establishing: high wide from the walkway side, loco steaming, canopy and station behind
  { id: "st_wide", light: "day", pos: [-21, 4.4, -11.5], look: [-9, 1.8, 0], fov: 50, cInf: 0, az: 120, el: 36 },
  // looking along the train at wheel height: the row of wheels recedes (the tapper walks toward the lens)
  { id: "walk_along", light: "day", pos: [HERO_X + 7.5, 1.05, -3.3], look: [HERO_X - 4, 0.7, -1.0], fov: 46, cInf: 9, focus: [HERO_X + 2.5, 0.8, -1.6], az: 125, el: 38 },
  // the tapper in medium shot beside the carriages
  { id: "walk_ms", light: "day", pos: [HERO_X + 0.6, 1.45, -6.6], look: [HERO_X, 1.1, -1.2], fov: 42, cInf: 10, focus: [HERO_X, 1.2, -1.9], az: 130, el: 40 },
  // close-up of one wheel + axle box (the satisfying taps)
  { id: "wheel_cu", light: "day", pos: [HERO_X - 1.2, 0.78, -3.4], look: [HERO_X, 0.62, -0.75], fov: 38, cInf: 13, focus: [HERO_X, 0.6, WZ - 0.05], az: 150, el: 22 },
  // the platform side: passengers and the kid with a toy hammer
  { id: "platform_ms", light: "day", pos: [HERO_X + 0.5, 1.75, 9.8], look: [HERO_X, 1.75, 3.0], fov: 44, cInf: 9, focus: [HERO_X, 1.6, 3.6], az: 140, el: 40 },
  // the ending today: the same view at golden hour (a trackside detector is drawn in 2D)
  { id: "walk_along_g", light: "golden", pos: [HERO_X + 7.5, 1.05, -3.3], look: [HERO_X - 4, 0.7, -1.0], fov: 46, cInf: 8, focus: [HERO_X + 2.5, 0.8, -1.6], az: 150, el: 9 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
