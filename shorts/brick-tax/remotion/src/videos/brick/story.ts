// "The Man Who Made Bricks Too Big": 3D background plates. Every set of the short is rendered ONCE per camera as a
// still (world ink, painted textures, two-tone light, lens blur, grade) at 1.2x the frame, then the 2D pass
// (Short.tsx) moves a virtual camera over it and draws the cast, props and effects on top, projected with the
// same camera, so the cards stand on the 3D ground at the right size.
export const D0 = 0; // ground height (build.ts houses sit on it)
export type V3 = [number, number, number];
export type Light = "day" | "golden";
export type PlateDef = {
  id: string; light: Light; pos: V3; look: V3; fov: number;
  /** lens blur: blur-disc radius (px at 1080 wide) for things at infinity, 0 = all sharp; focus = world point */
  cInf: number; focus?: V3;
  /** camera-relative sun override: az from the view axis toward screen right, el elevation (degrees) */
  az?: number; el?: number;
};
/** plates are rendered at PW x PH (1.2 x 1080 x 1920) so the 2D camera can push in / pan without upscaling */
export const PW = 1296, PH = 2304;

// set origins
export const TOWN: V3 = [0, 0, 0];
export const YARD: V3 = [60, 0, 0];
export const TRES: V3 = [-60, 0, 0];
export const WALLS: V3 = [120, 0, 0];
export const GOB_HOUSE_X = 2; // Wilkes' cottage of double bricks, north side of the street

export const PLATES: PlateDef[] = [
  // ---- Measham high street ----
  { id: "town_gob", light: "day", pos: [6.6, 1.6, 7.6], look: [4.4, 1.5, -4.0], fov: 50, cInf: 7, focus: [4.0, 1.4, -3.4], az: 140, el: 38 },
  { id: "town_ms", light: "day", pos: [5.5, 1.45, 3.0], look: [4.1, 1.1, -3.6], fov: 46, cInf: 13, focus: [4.2, 1.45, -3.5], az: 140, el: 38 },
  { id: "town_wide", light: "day", pos: [-9, 17, 30], look: [3, 2.5, -4], fov: 46, cInf: 0, az: 120, el: 45 },

  { id: "town_end_g", light: "golden", pos: [10.5, 1.3, 4.2], look: [1.5, 2.6, -5.5], fov: 46, cInf: 4, focus: [3, 2, -5.5], az: 150, el: 10 },
  // ---- Wilkes' brickyard ----
  { id: "yard_wide", light: "day", pos: [60, 6.5, 17], look: [60, 2.0, -5], fov: 50, cInf: 0, az: 120, el: 42 },
  { id: "yard_ms", light: "day", pos: [61.0, 1.55, 6.6], look: [60.3, 1.2, 0.45], fov: 42, cInf: 12, focus: [60.2, 1.5, 0.5], az: 125, el: 40 },
  { id: "yard_stack", light: "day", pos: [66.4, 1.5, 4.6], look: [64.1, 1.1, -1.0], fov: 44, cInf: 10, focus: [64.3, 1.4, -0.9], az: 120, el: 40 },
  { id: "yard_group", light: "day", pos: [60.4, 2.4, 10.2], look: [60.4, 1.05, 1.6], fov: 46, cInf: 9, focus: [60.4, 1.3, 1.8], az: 120, el: 42 },
  { id: "yard_table", light: "day", pos: [60.05, 2.55, 3.45], look: [60.05, 0.88, 1.42], fov: 50, cInf: 14, focus: [60.05, 0.95, 1.4], az: 120, el: 50 },
  { id: "yard_ms_g", light: "golden", pos: [61.0, 1.55, 6.6], look: [60.3, 1.2, 0.45], fov: 42, cInf: 10, focus: [60.2, 1.5, 0.5], az: -35, el: 8 },

  // ---- the Treasury, London ----
  { id: "tres_wide", light: "day", pos: [-60, 1.7, 17], look: [-60, 6.2, -8], fov: 54, cInf: 0, az: 140, el: 40 },
  { id: "tres_ms", light: "day", pos: [-58.4, 1.6, 5.0], look: [-59.6, 1.25, -1.2], fov: 44, cInf: 11, focus: [-59.6, 1.4, -1.2], az: 135, el: 40 },
  // ---- same wall, half the bricks ----
  { id: "walls", light: "day", pos: [120, 1.7, 11.5], look: [120, 1.55, -2], fov: 44, cInf: 6, focus: [120, 1.3, -2], az: 140, el: 42 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
