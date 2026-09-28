// World wonders built purely from math + real-world measurements (meters, y up, viewer looks along -z).
// JS port of wondersnap/wonders.py (8 wonders) + 3 new monuments (Big Ben, Christ the Redeemer, Sydney Opera House).
import {
  Part, line, polyline, tri, quad, boxSurface, boxEdges, revolve, cylinder, ring, transform, flatten, tube,
  paramSurface, ellipsoid, disc, TAU,
} from '../lib/sampling.js';
import { rotX, rotZ, matMul, deg, linspace, range } from '../lib/vec.js';

// ---------------------------------------------------------------- helpers
/** True where (u, v) is inside any arch opening. arches: [u_center, width, spring_height, v_base]. */
function archMask(u, v, arches) {
  for (const [uc, w, spring, vb] of arches) {
    const du = (u - uc) / (w / 2);
    if (Math.abs(du) >= 1 || v <= vb) continue;
    const top = vb + spring + (w / 2) * 1.15 * Math.sqrt(Math.max(1 - du * du, 0));   // slightly pointed
    if (v < top) return true;
  }
  return false;
}

/** Vertical wall on plane z=fixed (axis 'x', u=x) or x=fixed (axis 'z', u=z) with arch holes. */
export function wall(axis, fixed, u0, u1, y0, y1, arches = [], density = 1) {
  let a, b, c, d, keep = null;
  if (axis === 'x') {
    [a, b, c, d] = [[u0, y0, fixed], [u1, y0, fixed], [u1, y1, fixed], [u0, y1, fixed]];
    if (arches.length) keep = (x, y) => !archMask(x, y, arches);
  } else {
    [a, b, c, d] = [[fixed, y0, u0], [fixed, y0, u1], [fixed, y1, u1], [fixed, y1, u0]];
    if (arches.length) keep = (x, y, z) => !archMask(z, y, arches);
  }
  const parts = [quad(a, b, c, d, density, keep)];
  for (const [uc, w, spring, vb] of arches) {      // bright outline around each arch so openings read clearly
    const pts = [[uc + w / 2, vb]];
    for (const t of linspace(0, Math.PI, 24)) pts.push([uc + (w / 2) * Math.cos(t), vb + spring + (w / 2) * 1.15 * Math.sin(t)]);
    pts.push([uc - w / 2, vb]);
    parts.push(polyline(pts.map(([x, y]) => (axis === 'x' ? [x, y, fixed] : [fixed, y, x])), 0, density * 3));
  }
  return parts;
}

function rectWalls(cx, cz, w, d, y0, y1, archesW = [], archesD = [], density = 1) {
  const shift = (arr, c) => arr.map((a) => [c + a[0], a[1], a[2], a[3]]);
  return [
    wall('x', cz + d / 2, cx - w / 2, cx + w / 2, y0, y1, shift(archesW, cx), density),
    wall('x', cz - d / 2, cx - w / 2, cx + w / 2, y0, y1, shift(archesW, cx), density),
    wall('z', cx + w / 2, cz - d / 2, cz + d / 2, y0, y1, shift(archesD, cz), density),
    wall('z', cx - w / 2, cz - d / 2, cz + d / 2, y0, y1, shift(archesD, cz), density),
  ];
}

const slab = (cy, w, d, t = 0.3, density = 1) =>
  [boxSurface([0, cy, 0], [w, t, d], density), boxEdges([0, cy, 0], [w, t, d], 0, density * 3)];

// ---------------------------------------------------------------- wonders (ported)
/** Thap Rua, Hoan Kiem Lake, Hanoi (~8.5 m). Three stacked brick storeys with arched openings. */
function turtleTower() {
  const P = [];
  const a = (n, w, s, spacing, vb) => range(n).map((i) => [(i - (n - 1) / 2) * spacing, w, s, vb]);
  P.push(slab(0.15, 8.2, 7.0, 0.3));
  P.push(rectWalls(0, 0, 7.2, 6.0, 0.3, 3.5, a(3, 1.3, 1.5, 2.1, 0.3), a(1, 1.4, 1.5, 0, 0.3)));
  P.push(slab(3.65, 7.8, 6.6, 0.3));
  P.push(rectWalls(0, 0, 5.2, 4.4, 3.8, 6.2, a(3, 0.9, 1.0, 1.5, 4.1), a(1, 1.0, 1.0, 0, 4.1)));
  P.push(slab(6.35, 5.8, 5.0, 0.3));
  P.push(rectWalls(0, 0, 3.0, 3.0, 6.5, 7.9, a(1, 0.8, 0.5, 0, 6.8), a(1, 0.8, 0.5, 0, 6.8)));
  const e = 2.2, ridgeY = 8.9, eaveY = 7.95;                 // hip roof with upturned corners
  const corners = [[e, eaveY + 0.25, e], [-e, eaveY + 0.25, e], [-e, eaveY + 0.25, -e], [e, eaveY + 0.25, -e]];
  const top = [0, ridgeY, 0];
  for (let i = 0; i < 4; i++) {
    P.push(tri(corners[i], corners[(i + 1) % 4], top));
    P.push(polyline([corners[i], [corners[i][0] * 0.8, eaveY, corners[i][2] * 0.8], top], 0, 4));
  }
  P.push(line([0, ridgeY, 0], [0, ridgeY + 0.9, 0], 0, 6));    // finial
  for (const [y0, h, s] of [[3.8, 0.5, 3.8], [6.5, 0.45, 2.8]]) {   // balustrade posts on each terrace
    for (const x of linspace(-s, s, 7)) for (const z of [-s * 0.85, s * 0.85]) P.push(line([x, y0, z], [x, y0 + h, z], 0, 2));
  }
  return P;
}

/** 330 m incl. antenna (300 m structure). Base 125 m square; platforms at 57, 115, 276 m. */
function eiffelTower() {
  const P = [];
  const w = (y) => 58.0 * Math.exp(-y / 85.0) + 4.5 * (1 - y / 320.0);   // half-width of the envelope
  const lw = (y) => Math.max(0.36 * w(y), 3.0);                           // leg width (legs merge ~115 m)
  const facePt = (side, u, y) => {
    const ww = w(y);
    return [[u * ww, y, ww], [ww, y, -u * ww], [-u * ww, y, -ww], [-ww, y, u * ww]][side];
  };
  const ys = linspace(0, 300, 121);
  for (let side = 0; side < 4; side++) {
    P.push(polyline(ys.map((y) => facePt(side, 1, y)), 0, 4));                        // outer arris
    for (const sgn of [-1, 1]) {                                                      // inner leg edges
      P.push(polyline(ys.filter((y) => y <= 115).map((y) => facePt(side, sgn * (1 - lw(y) / w(y)), y)), 0, 3));
    }
    const lv = linspace(0, 115, 16);                                                   // lattice X-bracing
    for (let i = 0; i + 1 < lv.length; i++) {
      const y0 = lv[i], y1 = lv[i + 1];
      for (const sgn of [-1, 1]) {
        const a0 = sgn, a1 = sgn * (1 - lw(y0) / w(y0)), b0 = sgn, b1 = sgn * (1 - lw(y1) / w(y1));
        P.push(line(facePt(side, a0, y0), facePt(side, b1, y1), 0, 1.5));
        P.push(line(facePt(side, a1, y0), facePt(side, b0, y1), 0, 1.5));
      }
    }
    const uv = linspace(115, 276, 22);
    for (let i = 0; i + 1 < uv.length; i++) {
      P.push(line(facePt(side, -1, uv[i]), facePt(side, 1, uv[i + 1]), 0, 1.5));
      P.push(line(facePt(side, 1, uv[i]), facePt(side, -1, uv[i + 1]), 0, 1.5));
    }
    const span = 1 - lw(0) / w(0);                  // the decorative arch between the legs (~39 m high)
    P.push(polyline(linspace(0, Math.PI, 40).map((t) => facePt(side, span * Math.cos(t), 39 * Math.sin(t) ** 0.8)), 0, 4));
  }
  for (const [y, h] of [[57, 7], [115.7, 4], [276, 3]]) {      // platforms (girders + deck)
    const s = 2 * w(y) + (y < 200 ? 6 : 12);
    P.push(boxEdges([0, y, 0], [s, h, s], 0, 5));
    P.push(quad([-s / 2, y, s / 2], [s / 2, y, s / 2], [s / 2, y, -s / 2], [-s / 2, y, -s / 2], 0.4));
  }
  P.push(tube([0, 276, 0], [0, 300, 0], 3.5, 1.5));
  P.push(line([0, 300, 0], [0, 330, 0], 0, 6));
  return P;
}

/** 93 m ground-to-torch: 47 m pedestal + 46 m statue (heel to torch). Faces +z (the viewer). */
function statueOfLiberty() {
  const P = [];
  for (const [y0, y1, s] of [[0, 12, 21], [12, 35, 18.5], [35, 44, 16.5], [44, 47, 14]]) {   // pedestal tiers
    P.push(boxSurface([0, (y0 + y1) / 2, 0], [s, y1 - y0, s], 0.12));
    P.push(boxEdges([0, (y0 + y1) / 2, 0], [s, y1 - y0, s], 0, 2));
  }
  const b = 47.0;
  P.push(revolve([0, 3, 10, 18, 25, 31, 34, 35.2].map((y) => b + y), [5.6, 5.2, 4.7, 4.3, 4.6, 4.3, 3.6, 1.4], { density: 2.2 }));
  P.push(revolve([35.2, 36.0, 37.5, 39.0, 40.3, 40.8].map((y) => b + y), [1.4, 2.2, 2.6, 2.4, 1.6, 0.2], { density: 3.0 }));
  for (let i = 0; i < 7; i++) {                                                            // crown rays
    const a = deg(-75 + i * 25);
    const base = [Math.sin(a) * 2.4, b + 39.6, Math.cos(a) * 2.4 * 0.6];
    const tip = [base[0] + Math.sin(a) * 3.0, base[1] + 2.0, base[2] + Math.cos(a) * 1.2];
    P.push(tube(base, tip, 0.35, 0.05, 2));
  }
  const shR = [3.4, b + 33.5, 0.2], shL = [-3.4, b + 33.5, 0.4], hand = [4.8, b + 42.5, 0.6];
  const mid = [shR[0] + (hand[0] - shR[0]) * 0.5, shR[1] + (hand[1] - shR[1]) * 0.5, shR[2] + (hand[2] - shR[2]) * 0.5];
  P.push(tube(shR, mid, 1.3, 1.0, 3.0), tube(mid, hand, 1.0, 0.8, 3.0));
  P.push(tube(hand, [hand[0], hand[1] + 2.2, hand[2]], 0.7, 1.1, 1.6));                    // torch handle
  P.push(revolve([0, 0.6, 1.6, 2.6, 3.4].map((y) => y + hand[1] + 2.2), [1.3, 1.4, 1.1, 0.6, 0.02], { center: [hand[0], 0, hand[2]], density: 6 }));
  const elbow = [-4.2, b + 27.5, 1.8];                                                     // left arm + tablet
  P.push(tube(shL, elbow, 1.2, 1.0, 2.5));
  const tabC = [-4.6, b + 26.0, 2.6];
  const tab = [boxSurface([0, 0, 0], [4.1, 7.2, 0.6], 2.5), boxEdges([0, 0, 0], [4.1, 7.2, 0.6], 0, 6)];
  P.push(transform(tab, matMul(rotZ(deg(-12)), rotX(deg(-10))), tabC));
  return P;
}

/** 828 m. Y-shaped plan (three wings, 120 deg apart) with 27 spiralling setbacks, spire from ~585 m. */
function burjKhalifa() {
  const P = [];
  const W = 19.0;
  const dirs = [90, 210, 330].map(deg);
  const setbacks = range(27).map((i) => 30 + i * 20.5);
  const L0 = 58.0, Lmin = 9.0, step = (L0 - Lmin) / 9;
  const L = [L0, L0, L0];
  let prevY = 0.0;
  const edges = [...setbacks, 585.0];
  const s0 = W / 2 / Math.tan(deg(60));
  edges.forEach((y, i) => {
    for (let k = 0; k < 3; k++) {
      const a = dirs[k], ax = [Math.cos(a), 0, Math.sin(a)], nx = [-Math.sin(a), 0, Math.cos(a)];
      const p = (s, t, yy) => [ax[0] * s + nx[0] * t, yy, ax[2] * s + nx[2] * t];
      for (const t of [-W / 2, W / 2]) P.push(quad(p(s0, t, prevY), p(L[k], t, prevY), p(L[k], t, y), p(s0, t, y)));
      P.push(quad(p(L[k], -W / 2, prevY), p(L[k], W / 2, prevY), p(L[k], W / 2, y), p(L[k], -W / 2, y)));
      P.push(line(p(L[k], -W / 2, prevY), p(L[k], -W / 2, y), 0, 4));
      P.push(line(p(L[k], W / 2, prevY), p(L[k], W / 2, y), 0, 4));
    }
    if (i < setbacks.length) {                          // spiral: step back one wing at a time
      const k = i % 3, newL = Math.max(L[k] - step, Lmin);
      const ax = [Math.cos(dirs[k]), 0, Math.sin(dirs[k])], nx = [-Math.sin(dirs[k]), 0, Math.cos(dirs[k])];
      const p = (s, t) => [ax[0] * s + nx[0] * t, y, ax[2] * s + nx[2] * t];
      P.push(quad(p(newL, -W / 2), p(L[k], -W / 2), p(L[k], W / 2), p(newL, W / 2), 1.5));
      L[k] = newL;
    }
    prevY = y;
  });
  P.push(revolve([585, 640, 700, 760, 828], [11, 8, 5, 2.5, 0.3], { density: 1.5 }));   // spire
  P.push(line([0, 700, 0], [0, 828, 0], 0, 5));
  return P;
}

/** Great Pyramid: base 230.3 m square, original height 146.6 m. */
function pyramidGiza() {
  const b = 230.3 / 2, H = 146.6;
  const c = [[b, 0, b], [-b, 0, b], [-b, 0, -b], [b, 0, -b]], apex = [0, H, 0];
  const P = [];
  for (let i = 0; i < 4; i++) {
    P.push(tri(c[i], c[(i + 1) % 4], apex, 1.0));
    P.push(line(c[i], apex, 0, 25));
    P.push(line(c[i], c[(i + 1) % 4], 0, 15));
  }
  for (let y = 12; y < H; y += 12) {                  // stone courses
    const s = b * (1 - y / H);
    P.push(polyline([[s, y, s], [-s, y, s], [-s, y, -s], [s, y, -s]], 0, 5, true));
  }
  return P;
}

/** Elliptical amphitheatre 189 x 156 m, 48 m tall, 80 arches per ring; south outer ring ruined. */
function colosseum() {
  const a = 94.5, b = 78.0;
  const tiers = [[0, 10.5], [10.5, 22.0], [22.0, 33.0]];
  const outerKeep = (x, y, z) => {
    const th = Math.atan2(z / b, x / a);
    const f = (((th / TAU) * 80) % 1 + 1) % 1;
    let hole = false;
    for (const [y0, y1] of tiers) {
      const h = y1 - y0;
      const q = (f - 0.5) / 0.3;
      const insideY = y > y0 + 0.6 && y < y0 + h * 0.62 + h * 0.2 * Math.sqrt(Math.max(1 - q * q, 0));
      if (insideY && Math.abs(f - 0.5) < 0.3) hole = true;
    }
    const attic = y > 36 && y < 39 && Math.abs(((((th / TAU) * 40) % 1) + 1) % 1 - 0.5) < 0.12;
    const ruined = z < 0 && y > 20 + 8 * Math.sin(th * 7) ** 2;   // southern outer ring survives ~2 tiers
    return !(hole || attic || ruined);
  };
  const P = [revolve([0, 48.5], [1, 1], { sx: a, sz: b, keep: outerKeep, density: 3.0 })];
  for (const y of [10.5, 22.0, 33.0, 48.5]) {
    if (y > 20) P.push(new Part(ring([0, y, 0], 1, { sx: a, sz: b }).pt, TAU * 86 * 1.5, 1.0, (x, yy, z) => z >= 0));
    else P.push(ring([0, y, 0], 1, { sx: a, sz: b, density: 1.5 }));
  }
  const ai = a * 0.82, bi = b * 0.82;             // inner wall + raked seating (cavea) + arena outline
  P.push(revolve([0, 30], [1, 1], { sx: ai, sz: bi, density: 0.6 }));
  P.push(revolve([4, 30], [0.56, 1], { sx: ai, sz: bi, density: 0.35 }));
  for (const r of linspace(0.58, 0.98, 7)) P.push(ring([0, 4 + ((r - 0.56) / 0.44) * 26, 0], r, { sx: ai, sz: bi, density: 0.8 }));
  P.push(ring([0, 0.5, 0], 1, { sx: 43.5, sz: 27.5, density: 2 }));
  return P;
}

/** 56.7 m, 15.5 m base diameter, 8 storeys (blind-arcade base, 6 open galleries, belfry), tilt 3.97 deg. */
function leaningTowerPisa() {
  const R = 7.75, P = [];
  P.push(cylinder([0, 0, 0], R, 11.0, { density: 0.8 }));
  for (let i = 0; i < 15; i++) {                                     // blind arcade outlines
    const a0 = (i / 15) * TAU, a1 = ((i + 1) / 15) * TAU;
    const pts = linspace(0, Math.PI, 16).map((t) => {
      const q = a0 + (a1 - a0) * (0.5 - 0.5 * Math.cos(t));
      return [R * 1.01 * Math.cos(q), 7.5 + 2.8 * Math.sin(t), R * 1.01 * Math.sin(q)];
    });
    P.push(polyline(pts, 0, 3));
    P.push(line([R * 1.01 * Math.cos(a0), 0, R * 1.01 * Math.sin(a0)], [R * 1.01 * Math.cos(a0), 7.5, R * 1.01 * Math.sin(a0)], 0, 3));
  }
  const levels = range(7).map((i) => 11.0 + 6.8 * i);             // 6 galleries: 11.0 .. 51.8
  for (let l = 0; l + 1 < levels.length; l++) {
    const y0 = levels[l], y1 = levels[l + 1];
    P.push(cylinder([0, y0, 0], R * 0.82, y1 - y0, { density: 0.35 }));   // inner wall behind colonnade
    for (let j = 0; j < 30; j++) {                                          // columns + arches
      const q = (j / 30) * TAU, q2 = ((j + 1) / 30) * TAU;
      P.push(line([R * Math.cos(q), y0, R * Math.sin(q)], [R * Math.cos(q), y1 - 1.6, R * Math.sin(q)], 0, 2.2));
      P.push(polyline(linspace(0, Math.PI, 8).map((t) => {
        const aa = q + (q2 - q) * (0.5 - 0.5 * Math.cos(t));
        return [R * Math.cos(aa), y1 - 1.6 + 0.7 * Math.sin(t), R * Math.sin(aa)];
      }), 0, 2));
    }
    P.push(ring([0, y1, 0], R * 1.04, { density: 6 }));                    // cornice
    P.push(revolve([y1, y1], [R * 1.04, R * 0.82], { density: 0.8 }));
  }
  const Rb = 5.6;
  const bellKeep = (x, y, z) => {
    const f = (((Math.atan2(z, x) / TAU) * 16) % 1 + 1) % 1;
    return !(Math.abs(f - 0.5) < 0.3 && y > 52.8 && y < 55.6);
  };
  P.push(revolve([51.8, 56.7], [Rb, Rb], { keep: bellKeep, density: 1.0 }));
  P.push(ring([0, 56.7, 0], Rb * 1.05, { density: 6 }));
  return transform(flatten(P), rotZ(deg(-3.97)));                 // leans toward +x, pivot at the base
}

/** Plinth 95 m square x 6.7 m; main hall 57 m (chamfered); onion dome to ~73 m; four 40 m minarets. */
function tajMahal() {
  const P = [];
  P.push(boxSurface([0, 3.35, 0], [95, 6.7, 95], 0.25), boxEdges([0, 3.35, 0], [95, 6.7, 95], 0, 4));
  const y0 = 6.7, y1 = 35.0, s = 28.5, ch = 8.0;
  const big = [[0, 17, 17, y0]];
  const side = [[-18.5, 5, 6, y0], [18.5, 5, 6, y0], [-18.5, 5, 5, y0 + 14], [18.5, 5, 5, y0 + 14]];
  for (const [axis, fixed] of [['x', s], ['x', -s], ['z', s], ['z', -s]]) P.push(wall(axis, fixed, -(s - ch), s - ch, y0, y1, [...big, ...side], 0.9));
  for (const sx of [1, -1]) for (const sz of [1, -1]) {             // chamfered corners
    const a = [sx * (s - ch), sz * s], bb = [sx * s, sz * (s - ch)];
    P.push(quad([a[0], y0, a[1]], [bb[0], y0, bb[1]], [bb[0], y1, bb[1]], [a[0], y1, a[1]], 0.9));
    P.push(line([a[0], y1, a[1]], [bb[0], y1, bb[1]], 0, 4));
  }
  P.push(quad([-s, y1, s], [s, y1, s], [s, y1, -s], [-s, y1, -s], 0.2));
  P.push(cylinder([0, y1, 0], 14.0, 6.5, { density: 0.8 }));        // drum
  const domeY = [0, 3, 6, 9, 12, 15, 18, 21, 24, 26].map((y) => y + y1 + 6.5);
  P.push(revolve(domeY, [14.0, 16.6, 17.5, 17.2, 15.8, 13.0, 9.5, 5.5, 2.0, 0.2], { density: 1.6 }));
  P.push(line([0, domeY[domeY.length - 1], 0], [0, 73.0, 0], 0, 6));
  for (const sx of [1, -1]) for (const sz of [1, -1]) {             // corner chattris
    const c = [sx * 17, 0, sz * 17];
    P.push(cylinder([c[0], y1, c[2]], 3.2, 4.0, { density: 0.8 }));
    P.push(revolve([0, 1.5, 3, 4.5, 5.5].map((y) => y + y1 + 4.0), [3.4, 3.6, 2.8, 1.2, 0.1], { center: [c[0], 0, c[2]], density: 1.4 }));
  }
  for (const sx of [1, -1]) for (const sz of [1, -1]) {             // minarets at plinth corners
    const c = [sx * 44, 0, sz * 44];
    P.push(revolve([6.7, 44], [2.9, 2.2], { center: c, density: 1.2 }));
    for (const y of [18, 30, 42]) P.push(ring([c[0], y, c[2]], 3.4, { density: 6 }));
    P.push(revolve([0, 1.2, 2.4, 3.4].map((y) => y + 44), [2.8, 2.6, 1.2, 0.1], { center: c, density: 1.5 }));
  }
  return P;
}

// ---------------------------------------------------------------- new monuments
/** Elizabeth Tower ("Big Ben"), London: 96 m, 12 m square shaft, 7 m clock dials centred ~55 m up. */
function bigBen() {
  const P = [], h = 6.0;                                   // half-width of the shaft
  P.push(boxSurface([0, 25.5, 0], [12, 51, 12], 0.35), boxEdges([0, 25.5, 0], [12, 51, 12], 0, 4));
  for (const s of [-1, 1]) for (const face of ['x', 'z']) {   // pilasters + string courses on the shaft
    for (const u of linspace(-h, h, 5)) {
      const p0 = face === 'x' ? [u, 2, s * h * 1.01] : [s * h * 1.01, 2, u];
      P.push(line(p0, [p0[0], 50, p0[2]], 0, 1.6));
    }
    for (let y = 8; y < 51; y += 7) {
      const a = face === 'x' ? [-h, y, s * h * 1.01] : [s * h * 1.01, y, -h];
      const b = face === 'x' ? [h, y, s * h * 1.01] : [s * h * 1.01, y, h];
      P.push(line(a, b, 0, 1.6));
    }
  }
  const cw = 13.0;                                         // clock stage, slightly proud of the shaft
  P.push(boxSurface([0, 56, 0], [cw, 10, cw], 0.25), boxEdges([0, 56, 0], [cw, 10, cw], 0, 5));
  const dial = (center, normal) => {                       // 7 m dial, hour marks, hands
    const parts = [disc(center, 0, 3.5, normal, 1.0), disc(center, 3.1, 3.5, normal, 3.0)];
    const [nx, , nz] = normal;
    const right = [nz, 0, -nx];                            // in-plane axes of the dial
    const P2 = (r, a) => [center[0] + right[0] * r * Math.cos(a), center[1] + r * Math.sin(a), center[2] + right[2] * r * Math.cos(a)];
    for (let k = 0; k < 12; k++) parts.push(line(P2(2.6, (k / 12) * TAU), P2(3.1, (k / 12) * TAU), 0, 5));
    parts.push(line(center, P2(2.0, deg(60)), 0, 7), line(center, P2(2.9, deg(160)), 0, 7));
    return parts;
  };
  const d = cw / 2 + 0.05;
  P.push(dial([0, 55.5, d], [0, 0, 1]), dial([0, 55.5, -d], [0, 0, -1]), dial([d, 55.5, 0], [1, 0, 0]), dial([-d, 55.5, 0], [-1, 0, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {    // corner pinnacles on the clock stage
    const c = [sx * (cw / 2), 61, sz * (cw / 2)];
    P.push(revolve([0, 4, 7.5], [0.7, 0.5, 0.02], { center: c, density: 2.5 }));
  }
  const bw = 11.0, arches = [[-3.2, 1.8, 3.0, 62.5], [0, 1.8, 3.0, 62.5], [3.2, 1.8, 3.0, 62.5]];
  P.push(rectWalls(0, 0, bw, bw, 61, 70, arches, arches, 0.8));   // belfry
  P.push(boxEdges([0, 70.4, 0], [bw + 0.8, 0.8, bw + 0.8], 0, 5));
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, z]) => [x * bw / 2, 71, z * bw / 2]);
  const apex = [0, 88, 0];                                 // steep gilded spire
  for (let i = 0; i < 4; i++) {
    P.push(tri(corners[i], corners[(i + 1) % 4], apex, 0.9));
    P.push(line(corners[i], apex, 0, 5));
  }
  for (const c of corners) P.push(revolve([0, 3, 6], [0.6, 0.45, 0.02], { center: c, density: 2.5 }));
  P.push(line(apex, [0, 96, 0], 0, 8), line([-0.9, 94, 0], [0.9, 94, 0], 0, 8));   // flèche + cross
  return P;
}

/** Christ the Redeemer, Rio: 30 m statue on an 8 m pedestal, 28 m arm span, atop Corcovado. */
function christRedeemer() {
  const P = [];
  P.push(revolve([-14, -8, -3, 0], [26, 17, 11, 7.5], { density: 0.25 }));   // summit of Corcovado
  P.push(boxSurface([0, 4, 0], [9, 8, 9], 0.5), boxEdges([0, 4, 0], [9, 8, 9], 0, 4));
  P.push(boxEdges([0, 8.3, 0], [10, 0.6, 10], 0, 4));
  const b = 8.6;
  // robe from feet to shoulders (x = arm axis, statue faces +z)
  P.push(revolve([0, 3, 8, 13, 17, 20, 22.4, 23.4].map((y) => b + y), [3.0, 2.7, 2.5, 2.4, 2.7, 3.0, 3.1, 1.3], { density: 1.8, sx: 1.12, sz: 0.85 }));
  P.push(revolve([23.4, 24.2, 25.6, 27.0, 28.5, 29.4].map((y) => b + y), [1.1, 1.5, 1.75, 1.7, 1.3, 0.2], { density: 3 }));   // head
  const shY = b + 22.0;
  for (const s of [-1, 1]) {                               // outstretched arms, sleeves draping below
    const sh = [s * 2.6, shY, 0], elbow = [s * 8.2, shY + 0.1, 0.1], wrist = [s * 12.6, shY - 0.2, 0.2];
    P.push(tube(sh, elbow, 1.5, 1.2, 2.5), tube(elbow, wrist, 1.2, 0.8, 2.5));
    P.push(ellipsoid([s * 13.5, shY - 0.3, 0.3], [1.0, 0.7, 0.35], 3));
    P.push(quad([s * 2.8, shY - 1.2, 0], [s * 9.5, shY - 1.0, 0], [s * 7.5, shY - 3.6, 0], [s * 2.8, shY - 6.5, 0], 1.2));  // sleeve fold
    P.push(polyline([[s * 9.5, shY - 1.0, 0], [s * 7.5, shY - 3.6, 0], [s * 2.8, shY - 6.5, 0]], 0, 5));
  }
  for (let k = -2; k <= 2; k++) P.push(line([k * 0.9, b + 1, 2.4], [k * 0.7, b + 19, 2.3], 0, 1.5));   // robe folds
  P.push(line([-2.6, shY, 0], [2.6, shY, 0], 0, 4));
  return P;
}

/** Sydney Opera House: podium ~183 x 120 m, highest shell 67 m above the harbour. */
function sydneyOperaHouse() {
  const P = [];
  P.push(boxSurface([-2, 4, 0], [183, 8, 120], 0.12), boxEdges([-2, 4, 0], [183, 8, 120], 0, 3));
  for (let k = 0; k < 8; k++) P.push(line([70 + k * 2.5, 8 - k, -45], [70 + k * 2.5, 8 - k, 45], 0, 2));   // monumental steps
  const y0 = 8;
  /** One shell: rear base xB, apex xa (height H above podium), footprint width W, centred on z0. */
  const shell = (xB, xa, z0, H, W) => {
    const dir = Math.sign(xa - xB), Lx = Math.abs(xa - xB);
    const ridge = (t) => [xB + (xa - xB) * (1 - (1 - t) ** 2), y0 + H * t, z0];
    const side = (t, sg) => [xa - dir * 0.18 * Lx * (1 - t), y0 + H * t ** 1.1, z0 + sg * (W / 2) * (1 - t ** 1.6)];
    const skin = (t, s) => {
      const w = s * s, sg = Math.sign(s) || 1, r = ridge(t), e = side(t, sg);
      return [r[0] * (1 - w) + e[0] * w, r[1] * (1 - w) + e[1] * w + H * 0.1 * (1 - w) * Math.sin(Math.PI * t), r[2] * (1 - w) + e[2] * w];
    };
    const edgeL = linspace(0, 1, 40).map((t) => side(t, -1)), edgeR = linspace(0, 1, 40).map((t) => side(t, 1));
    const ribs = [];
    for (const s of [-0.6, -0.3, 0.3, 0.6]) ribs.push(polyline(linspace(0, 1, 30).map((t) => skin(t, s)), 0, 1.4));
    return [
      paramSurface(skin, 0, 1, -1, 1, { density: 1.0, gu: 30, gv: 20 }),
      paramSurface((t, s) => { const a = side(t, -1), c = side(t, 1), q = (s + 1) / 2; return [a[0] + (c[0] - a[0]) * q, a[1] + (c[1] - a[1]) * q, a[2] + (c[2] - a[2]) * q]; },
        0, 1, -1, 1, { density: 0.25, gu: 16, gv: 12 }),                   // glass wall under the arch
      polyline(edgeL, 0, 5), polyline(edgeR, 0, 5),
      polyline(linspace(0, 1, 40).map(ridge), 0, 4), ribs,
    ];
  };
  // Concert Hall (z > 0) and Joan Sutherland Theatre (z < 0): three stepped shells each + a back shell
  P.push(shell(40, -30, 26, 59, 46), shell(62, 8, 26, 46, 40), shell(78, 40, 26, 32, 32), shell(20, 58, 26, 22, 26));
  P.push(shell(42, -24, -26, 53, 42), shell(63, 12, -26, 41, 36), shell(79, 44, -26, 29, 30), shell(22, 60, -26, 20, 24));
  P.push(shell(-55, -84, -42, 22, 22), shell(-45, -66, -42, 15, 18));   // Bennelong restaurant
  return P;
}

// color is RGB 0..1
export const WONDERS = [
  { name: 'Turtle Tower', build: turtleTower, color: [1.0, 0.84, 0.1], fact: 'Hoan Kiem Lake, Hanoi · 8.5 m' },
  { name: 'Eiffel Tower', build: eiffelTower, color: [1.0, 0.35, 0.95], fact: 'Paris · 330 m · 125 m base' },
  { name: 'Statue of Liberty', build: statueOfLiberty, color: [0.3, 1.0, 0.45], fact: 'New York · 93 m ground to torch' },
  { name: 'Burj Khalifa', build: burjKhalifa, color: [0.3, 0.6, 1.0], fact: 'Dubai · 828 m · Y-plan, 27 setbacks' },
  { name: 'Great Pyramid', build: pyramidGiza, color: [1.0, 0.62, 0.2], fact: 'Giza · 146.6 m · 230.3 m base' },
  { name: 'Colosseum', build: colosseum, color: [1.0, 0.45, 0.3], fact: 'Rome · 189 × 156 m · 48.5 m' },
  { name: 'Leaning Tower of Pisa', build: leaningTowerPisa, color: [0.3, 0.95, 1.0], fact: 'Pisa · 56.7 m · 3.97° tilt' },
  { name: 'Taj Mahal', build: tajMahal, color: [1.0, 0.78, 0.9], fact: 'Agra · 73 m on a 95 m plinth' },
  { name: 'Big Ben', build: bigBen, color: [1.0, 0.8, 0.45], fact: 'London · 96 m · 7 m clock dials' },
  { name: 'Christ the Redeemer', build: christRedeemer, color: [0.85, 0.92, 1.0], fact: 'Rio · 30 m statue · 28 m arm span' },
  { name: 'Sydney Opera House', build: sydneyOperaHouse, color: [0.95, 0.95, 0.8], fact: 'Sydney · shells up to 67 m' },
];
