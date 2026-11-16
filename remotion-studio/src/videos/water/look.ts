// Light presets for the water short. "day" is the skill's day preset unchanged; the others reuse its structure
// (two-tone lit / shade colours, character tint, sky stops, fog) for interiors, night, the server hall and the stage.
import { LIGHTS, LOOK, LightPreset, WorldLook } from "../pointing/lights";

export type LightName = "day" | "room" | "night" | "server" | "stage";
export type Preset = { L: LightPreset; K: WorldLook; clouds: boolean; az: number; el: number; gain: number; stars: boolean };
const D = LIGHTS.day, KD = LOOK.day;
const sky = (c: string[]): WorldLook => ({ ...KD, sky: { c, e: [0, 3, 8, 16, 40] } });

export const PRE: Record<LightName, Preset> = {
  day: { L: D, K: KD, clouds: true, az: 105, el: 46, gain: 1.03, stars: false },
  room: {
    L: { ...D, lit: [1.52, 1.42, 1.26], shade: [0.46, 0.43, 0.54], lift: [0.05, 0.05, 0.09], charShade: 0.9 },
    K: KD, clouds: true, az: 150, el: 40, gain: 1.03, stars: false,
  },
  night: {
    L: { ...D, lit: [0.5, 0.6, 1.02], shade: [0.13, 0.15, 0.32], lift: [0.02, 0.03, 0.08], charTint: [0.62, 0.72, 1.0], charShade: 0.84, sideTint: [0.8, 0.84, 1.0],
      fog: "#2a3566", fogNear: 40, fogFar: 420 },
    K: { ...sky(["#44549a", "#33428a", "#243070", "#192458", "#0f183e"]), sat: 1.0 }, clouds: false, az: 60, el: 38, gain: 0.82, stars: true,
  },
  server: {
    L: { ...D, lit: [1.0, 1.12, 1.42], shade: [0.22, 0.27, 0.46], lift: [0.03, 0.04, 0.1], charTint: [0.9, 0.96, 1.0], charShade: 0.86, fog: "#1c2444", fogNear: 12, fogFar: 46 },
    K: sky(["#1c2444", "#1a2040", "#171c3a", "#141832", "#10142a"]), clouds: false, az: 165, el: 55, gain: 0.95, stars: false,
  },
  stage: {
    L: { ...D, lit: [1.62, 1.42, 1.12], shade: [0.17, 0.14, 0.28], lift: [0.03, 0.02, 0.06], charTint: [1.0, 0.93, 0.85], charShade: 0.8, fog: "#140f1e", fogNear: 60, fogFar: 200 },
    K: sky(["#18121f", "#16101d", "#140f1b", "#120d18", "#100b16"]), clouds: false, az: 160, el: 58, gain: 1.0, stars: false,
  },
};
