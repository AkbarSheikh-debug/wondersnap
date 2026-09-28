// Surface / line samplers (JS port of wondersnap/sampling.py + new primitives for machines).
// Every Part knows its measure (length or area) so points are split by measure * density, giving an
// even-looking density across a whole model. Units are whatever the model uses (m or mm), y is up.
import { makeRng } from './rng.js';
import { alignY, cross, len, sub, linspace } from './vec.js';

export const TAU = Math.PI * 2;

export class Part {
  /** pt(rng, out, i) writes one random point into out[3i..3i+2]; keep(x,y,z) -> bool cuts holes. */
  constructor(pt, measure, density = 1, keep = null) {
    this.pt = pt;
    this.measure = +measure;
    this.density = density;
    this.keep = keep;
    this.xf = null;               // list of [R, t] applied after acceptance: p' = R p + t
    this.keepRatio = 1;
    if (keep) {                   // estimate surviving fraction for fair allocation
      const rng = makeRng(123), o = new Float64Array(3);
      let k = 0;
      for (let i = 0; i < 4000; i++) { pt(rng, o, 0); if (keep(o[0], o[1], o[2])) k++; }
      this.keepRatio = Math.max(k / 4000, 1e-3);
    }
  }
  get weight() { return this.measure * this.density * this.keepRatio; }
  clone() {
    const c = Object.create(Part.prototype);
    Object.assign(c, this);
    c.xf = this.xf ? this.xf.slice() : null;
    return c;
  }
  sample(n, rng, out, off) {
    const { pt, keep, xf } = this;
    for (let i = off; i < off + n; i++) {
      const j = i * 3;
      pt(rng, out, i);
      if (keep) {
        let tries = 0;
        while (!keep(out[j], out[j + 1], out[j + 2]) && ++tries < 20000) pt(rng, out, i);
      }
      if (xf) {
        for (const [R, t] of xf) {
          const x = out[j], y = out[j + 1], z = out[j + 2];
          out[j] = R[0][0] * x + R[0][1] * y + R[0][2] * z + t[0];
          out[j + 1] = R[1][0] * x + R[1][1] * y + R[1][2] * z + t[1];
          out[j + 2] = R[2][0] * x + R[2][1] * y + R[2][2] * z + t[2];
        }
      }
    }
  }
}

export function flatten(parts, out = []) {
  if (parts instanceof Part) { out.push(parts); return out; }
  for (const p of parts) flatten(p, out);
  return out;
}

/** Largest-remainder split of n points across weights (sums to exactly n). */
export function allocate(weights, n) {
  const total = weights.reduce((a, b) => a + b, 0);
  const w = weights.map((x) => (x / total) * n);
  const base = w.map(Math.floor);
  let rem = n - base.reduce((a, b) => a + b, 0);
  const order = w.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) base[order[k][1]] += 1;
  return base;
}

export function shuffleIndex(n, rng) {
  const p = new Uint32Array(n);
  for (let i = 0; i < n; i++) p[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  return p;
}

/** Sample exactly n points over all parts, shuffled. Returns Float32Array(3n). */
export function build(parts, n, rng) {
  parts = flatten(parts);
  const counts = allocate(parts.map((p) => p.weight), n);
  const tmp = new Float64Array(n * 3);
  let off = 0;
  parts.forEach((p, i) => { p.sample(counts[i], rng, tmp, off); off += counts[i]; });
  const perm = shuffleIndex(n, rng);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = perm[i] * 3;
    out[i * 3] = tmp[s]; out[i * 3 + 1] = tmp[s + 1]; out[i * 3 + 2] = tmp[s + 2];
  }
  return out;
}

// ------------------------------------------------------------------ primitives (ported)
/** Beam / edge. Weighted like a thin surface (len * 1 unit) so lattices and walls balance. */
export function line(p0, p1, r = 0, density = 1) {
  const d = sub(p1, p0);
  return new Part((rng, o, i) => {
    const t = rng.random(), j = i * 3;
    o[j] = p0[0] + d[0] * t; o[j + 1] = p0[1] + d[1] * t; o[j + 2] = p0[2] + d[2] * t;
    if (r) { o[j] += rng.normal() * r; o[j + 1] += rng.normal() * r; o[j + 2] += rng.normal() * r; }
  }, len(d), density);
}

export function polyline(pts, r = 0, density = 1, closed = false) {
  const p = closed ? [...pts, pts[0]] : pts;
  const out = [];
  for (let i = 0; i + 1 < p.length; i++) out.push(line(p[i], p[i + 1], r, density));
  return out;
}

export function tri(a, b, c, density = 1, keep = null) {
  const ab = sub(b, a), ac = sub(c, a);
  return new Part((rng, o, i) => {
    let u = rng.random(), v = rng.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const j = i * 3;
    o[j] = a[0] + ab[0] * u + ac[0] * v; o[j + 1] = a[1] + ab[1] * u + ac[1] * v; o[j + 2] = a[2] + ab[2] * u + ac[2] * v;
  }, 0.5 * len(cross(ab, ac)), density, keep);
}

/** Quad a-b-c-d (b-c on the far edge from a-d), sampled bilinearly. keep= mask cuts holes. */
export function quad(a, b, c, d, density = 1, keep = null) {
  const area = 0.5 * (len(cross(sub(b, a), sub(d, a))) + len(cross(sub(b, c), sub(d, c))));
  return new Part((rng, o, i) => {
    const u = rng.random(), v = rng.random(), j = i * 3;
    for (let k = 0; k < 3; k++) o[j + k] = (a[k] * (1 - u) + b[k] * u) * (1 - v) + (d[k] * (1 - u) + c[k] * u) * v;
  }, area, density, keep);
}

export function boxSurface(center, size, density = 1, keep = null, bottom = false, top = true) {
  const [cx, cy, cz] = center, sx = size[0] / 2, sy = size[1] / 2, sz = size[2] / 2;
  const c = (x, y, z) => [cx + x * sx, cy + y * sy, cz + z * sz];
  const f = [
    quad(c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1), density, keep),
    quad(c(1, -1, -1), c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1), density, keep),
    quad(c(1, -1, 1), c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), density, keep),
    quad(c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1), density, keep),
  ];
  if (top) f.push(quad(c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1), c(-1, 1, -1), density));
  if (bottom) f.push(quad(c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1), density));
  return f;
}

export function boxEdges(center, size, r = 0, density = 1) {
  const [cx, cy, cz] = center, sx = size[0] / 2, sy = size[1] / 2, sz = size[2] / 2;
  const v = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([cx + x * sx, cy + y * sy, cz + z * sz]);
  const e = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  return e.map(([a, b]) => line(v[a], v[b], r, density));
}

/** Solid-looking box: faces + bright edges (used a lot by machines). */
export function box(center, size, density = 1, edge = 3) {
  return [boxSurface(center, size, density, null, true, true), boxEdges(center, size, 0, density * edge)];
}

/** Surface of revolution around a vertical axis through `center`; profile (ys[i], rs[i]).
 *  sx/sz stretch the circle into an ellipse. Area-correct along each conical band. */
export function revolve(ys, rs, { center = [0, 0, 0], density = 1, sx = 1, sz = 1, keep = null, a0 = 0, a1 = TAU } = {}) {
  const [cx, cy, cz] = center;
  const nb = ys.length - 1;
  const cdf = new Float64Array(nb);
  let total = 0;
  const span = (a1 - a0);
  for (let i = 0; i < nb; i++) {
    const seg = Math.hypot(ys[i + 1] - ys[i], rs[i + 1] - rs[i]);
    const r = Math.max((rs[i] + rs[i + 1]) / 2, 1e-3);
    total += span * r * seg * (sx + sz) / 2;
    cdf[i] = total;
  }
  const pt = (rng, o, k) => {
    const x = rng.random() * total;
    let lo = 0, hi = nb - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    const i = lo, t = rng.random(), r0 = rs[i], r1 = rs[i + 1];
    let rr = r0, tt = t;
    if (Math.abs(r1 - r0) > 1e-6) {       // density along a cone band grows with r: invert the CDF
      rr = Math.sqrt(Math.max(r0 * r0 + t * (r1 * r1 - r0 * r0), 0));
      tt = (rr - r0) / (r1 - r0);
    }
    const y = ys[i] + (ys[i + 1] - ys[i]) * tt;
    const a = a0 + rng.random() * span, j = k * 3;
    o[j] = cx + rr * Math.cos(a) * sx; o[j + 1] = cy + y; o[j + 2] = cz + rr * Math.sin(a) * sz;
  };
  return new Part(pt, total, density, keep);
}

export function cylinder(center, r, h, { density = 1, keep = null, cap = false, capBottom = false } = {}) {
  const p = [revolve([0, h], [r, r], { center, density, keep })];
  if (cap) p.push(revolve([h, h], [r, 0], { center, density }));
  if (capBottom) p.push(revolve([0, 0], [r, 0], { center, density }));
  return p;
}

export function ring(center, r, { density = 1, sx = 1, sz = 1, jitter = 0 } = {}) {
  const [cx, cy, cz] = center;
  return new Part((rng, o, i) => {
    const a = rng.random() * TAU, j = i * 3;
    o[j] = cx + r * sx * Math.cos(a); o[j + 1] = cy; o[j + 2] = cz + r * sz * Math.sin(a);
    if (jitter) { o[j] += rng.normal() * jitter; o[j + 1] += rng.normal() * jitter; o[j + 2] += rng.normal() * jitter; }
  }, TAU * r * (sx + sz) / 2, density);
}

/** Apply p' = R p + t to parts (tilted / rotated sub-assemblies). Returns clones. */
export function transform(parts, R, t = [0, 0, 0]) {
  return flatten(parts).map((p) => { const c = p.clone(); c.xf = [...(c.xf || []), [R, t]]; return c; });
}

/** Build parts along +y, then lay them along `axis` starting at `origin`. */
export function orient(parts, axis, origin = [0, 0, 0]) { return transform(parts, alignY(axis), origin); }

/** Tapered cylinder between two arbitrary points (limbs, rods, pipes). */
export function tube(p0, p1, r0, r1 = null, density = 1) {
  const d = sub(p1, p0);
  return orient(revolve([0, len(d)], [r0, r1 ?? r0], { density }), d, p0);
}

/** Tube following a path of points (pipes, belts, runners). */
export function pipe(points, r, density = 1) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) out.push(tube(points[i], points[i + 1], r, r, density));
  return out;
}

/** Flat annulus r0..r1 perpendicular to `axis` at `center`. */
export function disc(center, r0, r1, axis = [0, 1, 0], density = 1, keep = null) {
  return orient(revolve([0, 0], [r1, r0], { density, keep }), axis, center);
}

// ------------------------------------------------------------------ new primitives
/** Parametric surface fn(u, v) -> [x, y, z], sampled area-correctly via a grid of cell areas. */
export function paramSurface(fn, u0, u1, v0, v1, { density = 1, keep = null, gu = 40, gv = 24 } = {}) {
  const du = (u1 - u0) / gu, dv = (v1 - v0) / gv;
  const cdf = new Float64Array(gu * gv);
  let total = 0;
  for (let i = 0; i < gu; i++) {
    for (let j = 0; j < gv; j++) {
      const u = u0 + i * du, v = v0 + j * dv;
      const p00 = fn(u, v), p10 = fn(u + du, v), p01 = fn(u, v + dv), p11 = fn(u + du, v + dv);
      total += 0.5 * (len(cross(sub(p10, p00), sub(p01, p00))) + len(cross(sub(p10, p11), sub(p01, p11))));
      cdf[i * gv + j] = total;
    }
  }
  const nc = gu * gv;
  const pt = (rng, o, k) => {
    const x = rng.random() * total;
    let lo = 0, hi = nc - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    const i = Math.floor(lo / gv), j = lo % gv;
    const p = fn(u0 + (i + rng.random()) * du, v0 + (j + rng.random()) * dv);
    o[k * 3] = p[0]; o[k * 3 + 1] = p[1]; o[k * 3 + 2] = p[2];
  };
  return new Part(pt, total, density, keep);
}

/** Torus around `axis` (tyres, rings, belts). */
export function torus(center, R, r, axis = [0, 1, 0], density = 1) {
  const s = paramSurface((u, v) => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)],
    0, TAU, 0, TAU, { density, gu: 48, gv: 16 });
  return orient(s, axis, center);
}

export function ellipsoid(center, radii, density = 1, keep = null) {
  const [a, b, c] = radii;
  return paramSurface((u, v) => [center[0] + a * Math.cos(v) * Math.cos(u), center[1] + b * Math.sin(v), center[2] + c * Math.cos(v) * Math.sin(u)],
    0, TAU, -Math.PI / 2, Math.PI / 2, { density, keep, gu: 36, gv: 24 });
}

/** Coil spring as a dense polyline. */
export function helix(center, r, h, turns, axis = [0, 1, 0], density = 1) {
  const n = Math.max(16, Math.round(turns * 24));
  const pts = linspace(0, 1, n + 1).map((t) => [r * Math.cos(t * turns * TAU), t * h, r * Math.sin(t * turns * TAU)]);
  return orient(polyline(pts, 0, density), axis, center);
}

/** Spur gear: two faces, tooth band and bright tooth outline. Axis default +y (disc in xz plane). */
export function gear(center, r, teeth, { depth = null, width = null, hub = null, axis = [0, 1, 0], density = 1 } = {}) {
  depth = depth ?? r * 0.12; width = width ?? r * 0.25; hub = hub ?? r * 0.25;
  const toothKeep = (x, y, z) => ((Math.atan2(z, x) / TAU * teeth) % 1 + 1) % 1 < 0.5;
  const P = [
    revolve([0, width], [r - depth, r - depth], { density }),
    revolve([0, width], [r, r], { density, keep: toothKeep }),
    revolve([0, 0], [r - depth, hub], { density: density * 0.6 }),
    revolve([width, width], [r - depth, hub], { density: density * 0.6 }),
  ];
  const outline = [];
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * TAU, a1 = ((k + 0.5) / teeth) * TAU, a2 = ((k + 1) / teeth) * TAU;
    const pts = [[r - depth, a0], [r, a0], [r, a1], [r - depth, a1], [r - depth, a2]];
    for (const y of [0, width]) outline.push(polyline(pts.map(([rr, a]) => [rr * Math.cos(a), y, rr * Math.sin(a)]), 0, density * 2));
  }
  P.push(outline);
  return orient(P, axis, center);
}

/** Center the bounding box at the origin and scale so every point fits inside `radius`. */
export function normalize(pts, radius = 0.92) {
  const n = pts.length / 3;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const v = pts[i * 3 + k];
    if (v < lo[k]) lo[k] = v;
    if (v > hi[k]) hi[k] = v;
  }
  const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let m = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3] - c[0], y = pts[i * 3 + 1] - c[1], z = pts[i * 3 + 2] - c[2];
    m = Math.max(m, x * x + y * y + z * z);
  }
  const s = radius / Math.sqrt(m);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pts[i * 3 + k] = (pts[i * 3 + k] - c[k]) * s;
  return { center: c, scale: s };
}
