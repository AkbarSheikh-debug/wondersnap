// Organic / compound shape helpers shared by the anatomy, biology and machine models.
import { Part, tube, paramSurface, polyline, revolve, orient, TAU } from './sampling.js';
import { add, sub, mul, len, norm, matVec, I3 } from './vec.js';

/** Catmull-Rom spline through control points -> dense point list. */
export function spline(pts, per = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Smooth, tapering tube along control points (vessels, nerves, pipes, cables). */
export function vessel(ctrl, r0, r1 = r0, density = 1, per = 8) {
  const P = spline(ctrl, per), n = P.length - 1, out = [];
  for (let i = 0; i < n; i++) out.push(tube(P[i], P[i + 1], r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, density));
  return out;
}

/** Tube along an explicit dense path (no smoothing). */
export function pathTube(P, r, density = 1) {
  const out = [];
  for (let i = 0; i + 1 < P.length; i++) out.push(tube(P[i], P[i + 1], r, r, density));
  return out;
}

/** Deformed ellipsoid: bump(u, v) scales the radius; R rotates; keep filters world points. */
export function blob(center, [a, b, c], { R = I3, bump = null, density = 1, keep = null, v0 = -Math.PI / 2, v1 = Math.PI / 2, gu = 36, gv = 24 } = {}) {
  return paramSurface((u, v) => {
    const f = bump ? bump(u, v) : 1;
    return add(center, matVec(R, [a * f * Math.cos(v) * Math.cos(u), b * f * Math.sin(v), c * f * Math.cos(v) * Math.sin(u)]));
  }, 0, TAU, v0, v1, { density, keep, gu, gv });
}

/** Capsule between two points (mitochondria, rollers): tube with hemispherical caps. */
export function capsule(p0, p1, r, density = 1) {
  const d = sub(p1, p0), L = len(d);
  const prof = [], ys = [], n = 8;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * (i / n); ys.push(r * Math.sin(a) + r); prof.push(Math.max(r * Math.cos(a), 1e-3)); }
  for (let i = 1; i <= n; i++) { const a = (Math.PI / 2) * (i / n); ys.push(L + r + r * Math.sin(a)); prof.push(Math.max(r * Math.cos(a), 1e-3)); }
  return orient(revolve(ys, prof, { density }), d, add(p0, mul(norm(d), -r)));
}

const ball = (c, r, density) => paramSurface((u, v) => [c[0] + r * Math.cos(v) * Math.cos(u), c[1] + r * Math.sin(v), c[2] + r * Math.cos(v) * Math.sin(u)], 0, TAU, -Math.PI / 2, Math.PI / 2, { density, gu: 12, gv: 8 });
/** Bone: shaft with knobbly ends (condyles), used by the skeleton. */
export function bone(p0, p1, r, density = 1) {
  const d = norm(sub(p1, p0));
  const side = norm(Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [d[2] || 1e-3, 0, -d[0]]);
  const ends = [];
  for (const [p, k] of [[p0, 1], [p1, -1]]) for (const s of [-1, 1]) ends.push(ball(add(add(p, mul(side, s * r * 0.7)), mul(d, k * r * 0.4)), r * 1.05, density));
  return [tube(add(p0, mul(d, r * 0.8)), add(p1, mul(d, -r * 0.8)), r, r * 0.85, density), ...ends];
}
export const sphere = (c, r, density = 1) => ball(c, r, density);

/** Fuzzy dot cloud (ribosomes, jewels, markers): gaussian blobs of radius r, weighted like tiny spheres. */
export function dots(points, r, density = 1) {
  return new Part((rng, o, i) => {
    const p = points[Math.floor(rng.random() * points.length)], j = i * 3;
    o[j] = p[0] + rng.normal() * r; o[j + 1] = p[1] + rng.normal() * r; o[j + 2] = p[2] + rng.normal() * r;
  }, points.length * 4 * Math.PI * r * r, density);
}

/** Closed outline through points. */
export const loop = (pts, density = 3) => polyline(pts, 0, density, true);
