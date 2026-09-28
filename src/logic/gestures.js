// Hand pose (OPEN / FIST / PEACE / OTHER), continuous openness, and snap detection from MediaPipe's
// 21 normalized landmarks. Port of wondersnap/gestures.py (same thresholds) + openness and peace sign.
export const WRIST = 0, THUMB_TIP = 4, MIDDLE_MCP = 9, MIDDLE_TIP = 12;
export const TIPS = [8, 12, 16, 20], PIPS = [6, 10, 14, 18], MCPS = [5, 9, 13, 17];
export const OPEN = 'open', FIST = 'fist', PEACE = 'peace', POINT = 'point', OTHER = 'other', NONE = 'none';

const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const handScale = (lm) => Math.max(d(lm[WRIST], lm[MIDDLE_MCP]), 1e-6);

/** Instant pose. Finger extended = tip clearly farther from wrist than its PIP joint (rotation-invariant). */
export function classify(lm) {
  if (!lm) return NONE;
  const ext = TIPS.map((t, i) => d(lm[t], lm[WRIST]) > d(lm[PIPS[i]], lm[WRIST]) * 1.15);
  const curled = TIPS.map((t, i) => d(lm[t], lm[WRIST]) < d(lm[MCPS[i]], lm[WRIST]) * 1.25);
  const thumbOut = d(lm[THUMB_TIP], lm[17]) > handScale(lm) * 1.1;        // thumb tip far from pinky base
  if (ext.every(Boolean) && thumbOut) return OPEN;
  if (curled.every(Boolean)) return FIST;
  if (ext[0] && ext[1] && curled[2] && curled[3]) return PEACE;           // ✌ index + middle up
  if (ext[0] && curled[1] && curled[2] && curled[3]) return POINT;        // ☝ index finger only
  return OTHER;
}

/** Pinch: thumb tip touching the index tip (not a fist, where they are also close). */
export function pinched(lm) {
  if (!lm) return false;
  return d(lm[THUMB_TIP], lm[8]) / handScale(lm) < 0.32 && classify(lm) !== FIST;
}

export const middleExtended = (lm) => d(lm[MIDDLE_TIP], lm[WRIST]) > d(lm[10], lm[WRIST]) * 1.15;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** How open the hand is, 0 = tight fist .. 1 = fully open (fingers 80 %, thumb 20 %). */
export function openness(lm) {
  if (!lm) return 0;
  let f = 0;
  for (let i = 0; i < 4; i++) {
    const ratio = d(lm[TIPS[i]], lm[WRIST]) / Math.max(d(lm[MCPS[i]], lm[WRIST]), 1e-6);
    f += clamp01((ratio - 1.05) / (1.75 - 1.05));
  }
  const thumb = clamp01((d(lm[THUMB_TIP], lm[17]) / handScale(lm) - 0.9) / (1.55 - 0.9));
  return 0.8 * (f / 4) + 0.2 * thumb;
}

/** A pose must be seen for `hold` consecutive frames (per-pose override) before it becomes the stable pose. */
export class PoseDebouncer {
  constructor(hold = 4, holdFor = { [PEACE]: 6 }) {
    this.hold = hold; this.holdFor = holdFor;
    this.stable = NONE; this.cand = NONE; this.n = 0;
  }
  update(pose) {
    if (pose === this.cand) this.n += 1;
    else { this.cand = pose; this.n = 1; }
    let changed = false;
    if (this.n >= (this.holdFor[pose] ?? this.hold) && pose !== this.stable) { this.stable = pose; changed = true; }
    return [this.stable, changed];
  }
}

/** Thumb+middle tips pressed, then released fast. A tracking dropout (motion blur) between press and
 *  release grants extra time. Rejects: slow opening, held pinch, a fist opening. */
export class SnapDetector {
  constructor({ close = 0.35, open = 0.75, maxReleaseS = 0.1, cooldownS = 0.8, dropoutS = 0.15 } = {}) {
    Object.assign(this, { close, open, maxReleaseS, cooldownS, dropoutS });
    this.pressedAt = null; this.hadDropout = false; this.lastFire = -1e9;
  }
  update(lm, t) {
    if (!lm) {
      if (this.pressedAt !== null) {
        if (t - this.pressedAt > this.maxReleaseS + this.dropoutS) this.pressedAt = null;
        else this.hadDropout = true;
      }
      return false;
    }
    const r = d(lm[THUMB_TIP], lm[MIDDLE_TIP]) / handScale(lm);
    if (r < this.close) {
      // a closed fist also brings thumb and middle tip together: that is not a snap "press"
      if (classify(lm) === FIST) this.pressedAt = null;
      else { this.pressedAt = t; this.hadDropout = false; }
      return false;
    }
    if (this.pressedAt === null) return false;
    if (t - this.pressedAt > this.maxReleaseS + (this.hadDropout ? this.dropoutS : 0)) { this.pressedAt = null; return false; }
    if (r > this.open) {
      this.pressedAt = null;
      if (middleExtended(lm)) return false;            // real snap: the middle finger slams DOWN into the palm
      if (t - this.lastFire >= this.cooldownS) { this.lastFire = t; return true; }
    }
    return false;
  }
}
