// CPU twin of the update shader in src/gl/shaders.js (UPDATE_VS). Used by the tests to check the GPU step.
// Change one -> change the other (the GPU-parity Playwright test enforces it).
export const SWIRL = 0.45, K_RAD = 14.0, DAMP = 2.2, KICK = 2.2, K_FORM = 80.0, STAGGER = 0.6, OUT_ACC = 2.5;
export const ORBIT = 1.6, RAD_DAMP = 5.0;
export const IDLE = 0, SPHERE = 1, FORM = 2, DISSOLVE = 3;
const K1 = [1.7, 2.3, 0.0], K2 = [0.0, 1.9, 2.6], K3 = [2.4, 0.0, 1.5];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function gradPhi(p, t) {
  const c1 = Math.cos(dot(K1, p) + 0.9 * t), c2 = Math.cos(dot(K2, p) - 0.7 * t), c3 = Math.cos(dot(K3, p) + 1.1 * t);
  return [K1[0] * c1 + K2[0] * c2 + K3[0] * c3, K1[1] * c1 + K2[1] * c2 + K3[1] * c3, K1[2] * c1 + K2[2] * c2 + K3[2] * c3];
}

/** One particle step. u = { dt, time, mode, formT, kick, rot (row-major 3x3), sphereR, explode, scale, exCenter, sel, pull } */
export function stepParticle(pos, vel, target, seed, offset, u, group = -1) {
  let p = pos.slice(), v = vel.slice();
  const dt = u.dt, r = Math.hypot(p[0], p[1], p[2]) + 1e-5, n = [p[0] / r, p[1] / r, p[2] / r];
  const tang = cross(n, gradPhi(p, u.time));
  let acc = [0, 0, 0];
  if (u.mode === IDLE) {
    const k = Math.exp(-10 * dt);
    return [[p[0] * k, p[1] * k, p[2] * k], [0, 0, 0]];
  } else if (u.mode === SPHERE) {
    const R = u.sphereR * (0.93 + 0.07 * seed[3]);
    const ang = seed[3] * 6.2831853;
    let axis = cross([seed[0], seed[1], seed[2]], [Math.sin(ang), 0.37, Math.cos(ang)]);
    const al = Math.hypot(...axis); axis = axis.map((x) => x / al);
    const orbit = cross(axis, p).map((x) => x * ORBIT);
    const vr = dot(v, n), cen = (dot(v, v) - vr * vr) / r;
    const radial = (R - r) * K_RAD - vr * RAD_DAMP - cen;
    acc = [0, 1, 2].map((k) => (orbit[k] + tang[k] * SWIRL - v[k]) * DAMP + n[k] * radial);
    v = [0, 1, 2].map((k) => v[k] + seed[k] * (u.kick * KICK));
  } else if (u.mode === FORM) {
    const delay = seed[3] * STAGGER, e = smoothstep(delay, delay + 0.35, u.formT), k = K_FORM * e;
    const s0 = Math.min(1, Math.max(0, (u.explode - offset[3]) / Math.max(1 - offset[3], 1e-3)));
    const s = s0 * s0 * (3 - 2 * s0);
    const q = [0, 1, 2].map((i) => (target[i] + offset[i] * s - u.exCenter[i] * u.explode) * u.scale);
    const R = u.rot, tgt = [0, 1, 2].map((i) => R[i][0] * q[0] + R[i][1] * q[1] + R[i][2] * q[2]);
    if (Math.abs(group - (u.sel ?? -100)) < 0.5) for (let i = 0; i < 3; i++) tgt[i] += (u.pull ?? [0, 0, 0])[i];
    acc = [0, 1, 2].map((i) => k * (tgt[i] - p[i]) - 2 * Math.sqrt(k) * v[i] + (1 - e) * (tang[i] * SWIRL - v[i] * DAMP));
  } else {
    const q = [p[0] * 0.5 + seed[0], p[1] * 0.5 + seed[1], p[2] * 0.5 + seed[2]], ql = Math.hypot(...q) + 1e-12;
    acc = [0, 1, 2].map((k) => (q[k] / ql) * OUT_ACC + tang[k] * 0.8 - v[k] * 0.3);
  }
  v = [0, 1, 2].map((k) => v[k] + acc[k] * dt);
  p = [0, 1, 2].map((k) => p[k] + v[k] * dt);
  return [p, v];
}

/** Random unit direction + random 0..1 per particle (same layout as the GPU seed buffer). */
export function makeSeeds(n, rng) {
  const s = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = rng.normal(), y = rng.normal(), z = rng.normal();
    const l = Math.hypot(x, y, z) || 1;
    s[i * 4] = x / l; s[i * 4 + 1] = y / l; s[i * 4 + 2] = z / l; s[i * 4 + 3] = rng.random();
  }
  return s;
}
