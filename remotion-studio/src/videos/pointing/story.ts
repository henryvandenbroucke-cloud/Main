// Preview shot for "Why Japanese Train Drivers Point at Nothing": 3 s hook, 90 frames at 30 fps.
// Camera grammar from the skill (SKILL.md "Camera"): one ease-out glide, then every hold creeps in, flip kicks that
// decay over 7 f on each pointing snap, a 4.5 degree roll that settles. Lens: MS, focus on the driver's eyes.
export const FPS = 30;
export const TOTAL = 90;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** where the cast stands (platform top = y 0, platform edge = x 0, track runs along z) */
export const DRIVER: V3 = [-1.45, 0, 4.4];
export const KID_AT: V3 = [-0.62, 0, 1.3];
export const EYES: V3 = [DRIVER[0], 1.5, DRIVER[2]];

/** pointing beats: [frame the arm snaps, arm angle in degrees (0 = screen right, + = up)] */
export const BEATS: [number, number][] = [[-2, 6], [26, 62], [52, -30], [74, 10]];

export type DriverPose = { angle: number; reach: number; call: boolean; tilt: number; headTilt: number; blink: number; since: number; beat: number };
export const driverPose = (f: number): DriverPose => {
  let i = 0;
  while (i + 1 < BEATS.length && f >= BEATS[i + 1][0]) i++;
  const t = f - BEATS[i][0], prev = i ? BEATS[i - 1][1] : BEATS[0][1] - 50, cur = BEATS[i][1];
  // snap in 3 frames, then a small decaying wobble (overshoot reads as a crisp stop)
  const s = 1 - (1 - clamp01(t / 3)) ** 3 + 0.1 * Math.exp(-0.45 * t) * Math.sin(1.5 * t);
  const kick = Math.max(0, 1 - t / 7);
  const blink = (f >= 40 && f < 44) || (f >= 66 && f < 70) ? (f % 4 === 1 || f % 4 === 2 ? 1 : 0.5) : 0;
  return {
    angle: lerp(prev, cur, s), reach: 1 - 0.45 * Math.max(0, 1 - t / 2.5), call: t < 11,
    tilt: 1.5 + 3.5 * kick * Math.sign(cur + 20), headTilt: cur * 0.07 + 2 * kick, blink, since: t, beat: i,
  };
};

/** the arriving train: z of its nose, easing to a stop behind the driver */
export const trainNose = (f: number) => { const u = clamp01(f / 86); return -4.0 - 8.5 * (1 - u) ** 2.2; };

export type Cam = { pos: V3; look: V3; fov: number; roll: number };
const WIDE: Cam = { pos: [-3.75, 0.62, 9.55], look: [-1.32, 1.32, 4.4], fov: 43, roll: 4.5 };
const MS: Cam = { pos: [-3.3, 0.8, 8.15], look: [-1.3, 1.2, 4.4], fov: 40, roll: 1.6 };
export const camAt = (f: number): Cam => {
  const k = 1 - (1 - clamp01(f / 20)) ** 3; // ease-out burst: fastest on frame 1
  const c: Cam = { pos: lerp3(WIDE.pos, MS.pos, k), look: lerp3(WIDE.look, MS.look, k), fov: lerp(WIDE.fov, MS.fov, k), roll: lerp(WIDE.roll, MS.roll, k) };
  const creep = 0.0015 * f; // every hold pushes in 0.15 % per frame
  c.pos = lerp3(c.pos, c.look, creep);
  for (const [bf] of BEATS) { // flip kick on every snap
    const t = f - bf;
    if (t >= 0 && t < 7) c.look[1] += 0.011 * (1 - t / 7) * (t % 2 ? -1 : 1);
  }
  return c;
};
/** lens blur: circle of confusion at infinity in px at 1080 wide */
export const DOF_CINF = 11;
