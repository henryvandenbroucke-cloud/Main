// Clean-animation helpers (v2): poses tween with a small overshoot instead of snapping, walkers follow paths with the
// stride locked to the distance travelled (no foot sliding), expressions change on a blink.
import { P2, Expr } from "./toon";
import { clamp01, easeOutBack, smooth } from "./view";

export type Hands = { l?: P2; r?: P2 };
/** rest pose of the hands (relative to each shoulder, in head-heights): arms hanging at the sides */
export const REST_L: P2 = [-0.2, 0.92], REST_R: P2 = [0.2, 0.92];
const full = (h: Hands): { l: P2; r: P2 } => ({ l: h.l ?? REST_L, r: h.r ?? REST_R });
/** hand targets at frame f from keys [[frame, hands], ...]: each change eases in over `dur` frames with a little
 *  overshoot (easeOutBack), so arms swing into place like the reference's 4-8 frame pose changes */
export const poseAt = (f: number, keys: [number, Hands][], dur = 7, over = 1.25): { l: P2; r: P2 } => {
  let prev = full(keys[0][1]), cur = prev, start = keys[0][0];
  for (let i = 1; i < keys.length; i++) {
    if (f < keys[i][0]) break;
    const blend = mixH(prev, cur, easeOutBack((keys[i][0] - start) / dur, over));
    prev = blend; cur = full(keys[i][1]); start = keys[i][0];
  }
  return mixH(prev, cur, easeOutBack((f - start) / dur, over));
};
const mixH = (a: { l: P2; r: P2 }, b: { l: P2; r: P2 }, u: number) => ({
  l: [a.l[0] + (b.l[0] - a.l[0]) * u, a.l[1] + (b.l[1] - a.l[1]) * u] as P2,
  r: [a.r[0] + (b.r[0] - a.r[0]) * u, a.r[1] + (b.r[1] - a.r[1]) * u] as P2,
});
/** a scalar that eases between keyed values (prop sizes, lifts, tilts) */
export const valAt = (f: number, keys: [number, number][], dur = 7, over = 1.2) => {
  let prev = keys[0][1], cur = prev, start = keys[0][0];
  for (let i = 1; i < keys.length; i++) {
    if (f < keys[i][0]) break;
    prev = prev + (cur - prev) * easeOutBack((keys[i][0] - start) / dur, over); cur = keys[i][1]; start = keys[i][0];
  }
  return prev + (cur - prev) * easeOutBack((f - start) / dur, over);
};
/** expression track + the frames where it changes (pass them to lidAt so a blink hides every swap) */
export const exprAt = (f: number, keys: [number, Expr][]) => {
  let e = keys[0][1];
  for (const [k, x] of keys) if (f >= k) e = x;
  return e;
};
export const swaps = (keys: [number, unknown][]) => keys.slice(1).map(([k]) => k);

/** walk along a path of [frame, x, z] keys: smooth start/stop on each leg, phase from the distance (0.7 m per step,
 *  1.4 m per cycle) so the planted foot never slides; dir = unit direction of travel */
export const walkAt = (f: number, path: [number, number, number][], stride = 0.7) => {
  let dist = 0, x = path[0][1], z = path[0][2], dir: P2 = [0, 1], moving = false;
  for (let i = 1; i < path.length; i++) {
    const [f0, x0, z0] = path[i - 1], [f1, x1, z1] = path[i];
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L > 1e-6) dir = [(x1 - x0) / L, (z1 - z0) / L];
    if (f >= f1) { dist += L; x = x1; z = z1; continue; }
    if (f > f0) {
      const u = (f - f0) / (f1 - f0), e = smooth(u) * 0.35 + u * 0.65; // mostly constant speed, soft ends
      dist += L * e; x = x0 + (x1 - x0) * e; z = z0 + (z1 - z0) * e; moving = L > 0.05;
    }
    break;
  }
  return { x, z, phase: ((dist / (2 * stride)) % 1 + 1) % 1, dir, moving };
};
/** pop-in amount for an effect born at frame f0 (0 before, overshoots to 1 over n frames) */
export const pop = (f: number, f0: number, n = 6, k = 2.0) => (f < f0 ? 0 : easeOutBack((f - f0) / n, k));
export const fade = (f: number, f0: number, f1: number) => clamp01((f - f0) / Math.max(1, f1 - f0));
