// "Why People Locked Their Dead in Cages": 3D background plates (same method as the brick short). Plates are rendered
// at 1.5x the frame (1620 x 2880) so the 2D camera can push in to 1.5x and stay at native sharpness.
export const D0 = 0; // ground height (build.ts houses sit on it)
export type V3 = [number, number, number];
export type Light = "day" | "golden" | "night";
/** optional set pieces: "mound" (fresh grave), "cage" (the mortsafe over it), "headhole" (snatchers' hole at the head
 *  end + spoil heap), "pit" (grave fully open with the empty coffin) */
export type Show = "mound" | "cage" | "headhole" | "pit";
export type PlateDef = {
  id: string; light: Light; pos: V3; look: V3; fov: number;
  cInf: number; focus?: V3; az?: number; el?: number;
  show?: Show[];
};
export const PW = 1620, PH = 2880;

export const KIRK: V3 = [0, 0, 0];
export const ANAT: V3 = [60, 0, 0];
export const CLOSE: V3 = [-60, 0, 0];
/** the hero grave: head end (headstone) toward -z */
export const HERO = { x: 2.0, z0: -0.1, z1: 2.1, w: 1.0 };
export const TOWER: V3 = [11, 0, -9];
export const TABLE: V3 = [60, 0.9, -0.6];

const G = (id: string, light: Light, show: Show[], o: Partial<PlateDef> = {}): PlateDef => ({
  id, light, show, pos: [4.6, 1.55, 6.8], look: [2.0, 0.85, 0.9], fov: 44, cInf: 11, focus: [2.0, 0.9, 1.0], ...o,
});
export const PLATES: PlateDef[] = [
  // ---- the kirkyard, hero grave medium shot (variants) ----
  G("grave_n_cage", "night", ["cage", "mound"], { az: 130, el: 34 }),
  G("grave_n", "night", ["mound"], { az: 130, el: 34 }),
  G("grave_n_head", "night", ["headhole"], { az: 130, el: 34 }),
  G("grave_d", "day", ["mound"], { az: 135, el: 40 }),
  G("grave_d_cage", "day", ["cage", "mound"], { az: 135, el: 40, pos: [5.2, 1.6, 7.4], look: [2.0, 1.0, 0.6] }),
  // looking down into the opened grave (Wednesday)
  { id: "pit_d", light: "day", show: ["pit"], pos: [2.0, 3.6, 2.75], look: [2.0, -1.45, 0.9], fov: 46, cInf: 12, focus: [2.0, -0.6, 1.0], az: 150, el: 55 },
  // establishing night wide with the moon, the watchtower and the church
  { id: "kirk_wide_n", light: "night", show: ["mound"], pos: [13, 5.2, 19], look: [1, 2.6, -6], fov: 50, cInf: 0, az: -18, el: 17 },
  { id: "tower_n", light: "night", show: ["mound"], pos: [6.6, 1.5, -0.6], look: [11, 2.9, -9], fov: 46, cInf: 6, focus: [11, 2.5, -8], az: 125, el: 30 },
  // the ending: the old cage today, golden hour, from the other side
  { id: "cage_end_g", light: "golden", show: ["cage", "mound"], pos: [-0.6, 1.35, 5.8], look: [2.0, 1.05, 0.8], fov: 44, cInf: 9, focus: [2.0, 1.0, 1.0], az: 150, el: 10 },
  // ---- the anatomy theatre ----
  { id: "anat", light: "day", pos: [60, 2.7, 6.4], look: [60, 1.35, -1.0], fov: 48, cInf: 9, focus: [60, 1.1, -0.6], az: 170, el: 68 },
  // ---- Edinburgh Old Town close ----
  { id: "close_d", light: "day", pos: [-60, 1.7, 10], look: [-60, 3.2, -10], fov: 50, cInf: 5, focus: [-60, 1.4, 1.5], az: 150, el: 50 },
  { id: "close_n", light: "night", pos: [-60, 1.7, 10], look: [-60, 3.2, -10], fov: 50, cInf: 5, focus: [-60, 1.4, 1.5], az: 12, el: 24 },
];
export const plateOf = (id: string) => {
  const p = PLATES.find((q) => q.id === id);
  if (!p) throw new Error("no plate " + id);
  return p;
};
