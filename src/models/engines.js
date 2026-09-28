// Explodable engines. Every machine is a list of groups (= physical parts). Each group has a colour, an
// explode offset (where the part travels in the exploded view, same units as the model) and a stage in
// 0..1 (when, while the hand opens, that part starts to move — outer parts come off first).
// Units: mm for piston engines, cm for the turbofan, so lines/surfaces balance like the wonders do.
import {
  line, polyline, quad, boxSurface, boxEdges, box, revolve, cylinder, ring, transform, orient, tube, pipe, disc,
  paramSurface, torus, helix, gear, Part, TAU,
} from '../lib/sampling.js';
import { rotX, rotZ, matVec, deg, linspace, add, mul } from '../lib/vec.js';

export const COL = {
  steel: [0.42, 0.62, 1.0], orange: [1.0, 0.5, 0.12], gold: [1.0, 0.8, 0.2], white: [0.92, 0.95, 1.0],
  red: [1.0, 0.25, 0.22], teal: [0.2, 1.0, 0.8], purple: [0.66, 0.4, 1.0], green: [0.35, 1.0, 0.4],
  pink: [1.0, 0.42, 0.75], cyan: [0.3, 0.88, 1.0], silver: [0.75, 0.8, 0.95], lime: [0.75, 1.0, 0.3],
  amber: [1.0, 0.65, 0.25], magenta: [1.0, 0.3, 0.95], ice: [0.6, 0.85, 1.0],
};

/** A physical part of a machine. */
export const G = (label, color, offset, stage, parts, extra = {}) => ({ label, color, offset, stage, parts, ...extra });

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

/** Crank web: counterweight sector opposite the pin + arm to the pin, in the y-z plane at axial x. */
function crankWeb(x, phi, thr, rW, t, density = 1) {
  const a0 = phi + Math.PI - 1.15, a1 = phi + Math.PI + 1.15;
  const u = [Math.cos(phi), Math.sin(phi)], p = [-Math.sin(phi), Math.cos(phi)], w = 26;
  const P = [];
  for (const dx of [-t / 2, t / 2]) {
    P.push(paramSurface((r, a) => [x + dx, r * Math.cos(a), r * Math.sin(a)], 0, rW, a0, a1, { density, gu: 8, gv: 12 }));
    P.push(quad([x + dx, p[0] * w, p[1] * w], [x + dx, -p[0] * w, -p[1] * w],
      [x + dx, u[0] * (thr + 22) - p[0] * w * 0.8, u[1] * (thr + 22) - p[1] * w * 0.8],
      [x + dx, u[0] * (thr + 22) + p[0] * w * 0.8, u[1] * (thr + 22) + p[1] * w * 0.8], density));
    P.push(polyline(linspace(a0, a1, 20).map((a) => [x + dx, rW * Math.cos(a), rW * Math.sin(a)]), 0, density * 4));
  }
  P.push(paramSurface((a, s) => [x + s, rW * Math.cos(a), rW * Math.sin(a)], a0, a1, -t / 2, t / 2, { density, gu: 16, gv: 3 }));
  return P;
}

/** Cam lobe (egg profile) on a shaft along x at (cy, cz). */
function camLobe(x, cy, cz, phase, base = 16, lift = 10, width = 14, density = 1) {
  const r = (a) => base + lift * Math.max(0, Math.cos(a - phase)) ** 2;
  const pt = (a, s) => [x + s, cy + r(a) * Math.cos(a), cz + r(a) * Math.sin(a)];
  return [
    paramSurface(pt, 0, TAU, -width / 2, width / 2, { density, gu: 32, gv: 3 }),
    polyline(linspace(0, TAU, 40).map((a) => pt(a, -width / 2)), 0, density * 3),
    polyline(linspace(0, TAU, 40).map((a) => pt(a, width / 2)), 0, density * 3),
  ];
}

/** Closed belt in the plane x = const. arcs: [yc, zc, r, a0, a1] traversed in order (y = yc + r sin a, z = zc + r cos a). */
function belt(x, arcs, density = 4) {
  const pts = [];
  for (const [yc, zc, r, a0, a1] of arcs) for (const a of linspace(a0, a1, 18)) pts.push([x, yc + r * Math.sin(a), zc + r * Math.cos(a)]);
  return polyline(pts, 0, density, true);
}

/** Simple stroke font for engraved badges (letters in a 0..1 x 0..1.4 box). */
const GLYPH = {
  H: [[[0, 0], [0, 1.4]], [[1, 0], [1, 1.4]], [[0, 0.7], [1, 0.7]]],
  E: [[[1, 0], [0, 0], [0, 1.4], [1, 1.4]], [[0, 0.7], [0.8, 0.7]]],
  M: [[[0, 0], [0, 1.4], [0.5, 0.7], [1, 1.4], [1, 0]]],
  I: [[[0.5, 0], [0.5, 1.4]], [[0.2, 0], [0.8, 0]], [[0.2, 1.4], [0.8, 1.4]]],
  V: [[[0, 1.4], [0.5, 0], [1, 1.4]]],
  8: [[[0, 0], [1, 0], [1, 1.4], [0, 1.4], [0, 0]], [[0, 0.7], [1, 0.7]]],
};
/** Engrave text on a plane: origin o, right vector r, up vector u (scaled by letter size). */
export function badge(text, o, r, u, size, density = 5) {
  const P = [];
  [...text].forEach((ch, i) => {
    for (const stroke of GLYPH[ch] || []) {
      P.push(polyline(stroke.map(([a, b]) => add(o, add(mul(r, (a + i * 1.5) * size), mul(u, b * size)))), 0, density));
    }
  });
  return P;
}

// ============================================================ Inline-4 (DOHC 16V), mm
function inline4() {
  const xs = [-136.5, -45.5, 45.5, 136.5], bore = 43, thr = 43, rod = 145, ch = 30, deck = 222;
  const phis = [0, Math.PI, Math.PI, 0];                               // cylinders 1&4 at TDC, 2&3 at BDC
  const pinY = (phi) => thr * Math.cos(phi) + Math.sqrt(rod * rod - (thr * Math.sin(phi)) ** 2);
  const bx = 205, bz = 95, by0 = -40, headTop = deck + 100, camY = deck + 128;

  const block = [
    boxSurface([0, (deck + by0) / 2, 0], [2 * bx, deck - by0, 2 * bz], 0.28, null, false, false),
    quad([-bx, deck, bz], [bx, deck, bz], [bx, deck, -bz], [-bx, deck, -bz], 0.45, (x, y, z) => xs.every((cx) => Math.hypot(x - cx, z) > bore + 3)),
    boxEdges([0, (deck + by0) / 2, 0], [2 * bx, deck - by0, 2 * bz], 0, 1.4),
  ];
  for (const cx of xs) block.push(cylinder([cx, 60, 0], bore + 1, deck - 60, { density: 0.3 }), ring([cx, deck, 0], bore + 3, { density: 5 }));
  for (const x of [-182, -91, 0, 91, 182]) block.push(box([x, -22, 0], [20, 36, 120], 0.5, 2));   // main bearing caps

  const pistons = [], rods = [], crank = [];
  xs.forEach((cx, i) => {
    const phi = phis[i], py = pinY(phi), top = py + ch;
    pistons.push(cylinder([cx, top - 55, 0], bore - 2, 55, { density: 1.1, cap: true }));
    for (const dy of [6, 11, 16]) pistons.push(ring([cx, top - dy, 0], bore - 1.5, { density: 5 }));
    pistons.push(tube([cx, py, -30], [cx, py, 30], 10, 10, 1.5));
    const pin = [cx, thr * Math.cos(phi), thr * Math.sin(phi)];
    rods.push(tube(pin, [cx, py, 0], 11, 8, 2.2), torus(pin, 30, 6, X, 1.5), torus([cx, py, 0], 16, 5, X, 1.5));
    rods.push(line(add(pin, [0, 0, 30]), add(pin, [0, -45, 30]), 0, 3), line(add(pin, [0, 0, -30]), add(pin, [0, -45, -30]), 0, 3));
    crank.push(tube([cx - 22, pin[1], pin[2]], [cx + 22, pin[1], pin[2]], 23, 23, 1.5));
    crank.push(crankWeb(cx - 30, phi, thr, 72, 14, 0.9), crankWeb(cx + 30, phi, thr, 72, 14, 0.9));
  });
  crank.push(tube([-235, 0, 0], [225, 0, 0], 26, 26, 0.7), disc([225, 0, 0], 0, 55, X, 1.3), torus([225, 0, 0], 55, 4, X, 2));

  const head = [
    boxSurface([0, (deck + headTop) / 2, 0], [2 * bx, headTop - deck, 2 * bz], 0.28, null, false, true),
    boxEdges([0, (deck + headTop) / 2, 0], [2 * bx, headTop - deck, 2 * bz], 0, 1.4),
  ];
  const valves = [], cams = [];
  xs.forEach((cx, i) => {
    head.push(ring([cx, deck, 0], bore - 3, { density: 4 }));
    for (const s of [-1, 1]) {                                           // intake (-z) & exhaust (+z) ports
      head.push(polyline(linspace(0, TAU, 28).map((a) => [cx + 24 * Math.cos(a), 265 + 14 * Math.sin(a), s * (bz + 0.5)]), 0, 4));
      for (const dx of [-17, 17]) {
        const vx = cx + dx, vz = s * 22;
        valves.push(disc([vx, deck + 6, vz], 0, 14, Y, 2), line([vx, deck + 6, vz], [vx, deck + 112, vz], 0, 5));
        valves.push(helix([vx, deck + 62, vz], 11, 42, 5, Y, 1.4), ring([vx, deck + 106, vz], 12, { density: 5 }));
        cams.push(camLobe(vx, camY, vz, i * (Math.PI / 2) + (s > 0 ? 1.2 : 0), 15, 9, 13, 1));
      }
    }
  });
  for (const s of [-1, 1]) {
    cams.push(tube([-222, camY, s * 22], [215, camY, s * 22], 10, 10, 1.2));
    for (const x of [-180, -90, 0, 90, 180]) cams.push(boxEdges([x, camY + 6, s * 22], [16, 22, 36], 0, 3));
  }

  const coverY0 = headTop + 36, coverY1 = coverY0 + 70;
  const cover = [
    boxSurface([0, (coverY0 + coverY1) / 2, 0], [2 * bx + 6, coverY1 - coverY0, 2 * bz + 6], 0.4, null, false, true),
    boxEdges([0, (coverY0 + coverY1) / 2, 0], [2 * bx + 6, coverY1 - coverY0, 2 * bz + 6], 0, 2),
    disc([-130, coverY1 + 1, 55], 0, 24, Y, 2), ring([-130, coverY1 + 1, 55], 24, { density: 6 }),
  ];
  for (const z of [-70, -45, 45, 70]) cover.push(line([-bx + 10, coverY1 + 0.5, z], [bx - 10, coverY1 + 0.5, z], 0, 2));
  const plugs = [];
  for (const cx of xs) plugs.push(tube([cx, deck + 16, 0], [cx, coverY1 + 20, 0], 9, 9, 2), box([cx, coverY1 + 42, 0], [44, 44, 70], 1.2, 3));

  const pan = [
    boxSurface([0, -95, 0], [2 * bx - 10, 110, 2 * bz - 10], 0.35, null, true, false),
    boxEdges([0, -95, 0], [2 * bx - 10, 110, 2 * bz - 10], 0, 1.6),
    box([110, -175, 0], [170, 50, 150], 0.35, 4), ring([110, -200, 0], 12, { density: 6 }),
  ];

  const intake = [tube([-190, 400, -205], [190, 400, -205], 42, 42, 0.7), disc([190, 400, -205], 0, 42, X, 1)];
  for (const cx of xs) intake.push(pipe([[cx, 400, -168], [cx, 360, -140], [cx, 300, -112], [cx, 268, -97]], 18, 1.1));
  intake.push(tube([-190, 400, -205], [-265, 400, -205], 34, 34, 1.3), torus([-265, 400, -205], 34, 3, X, 3), disc([-250, 400, -205], 0, 30, X, 1.5));

  const exhaust = [];
  for (const cx of xs) exhaust.push(pipe([[cx, 265, 97], [cx, 258, 132], [cx * 0.7, 200, 160], [cx * 0.35, 122, 172], [0, 62, 176]], 16, 1.2));
  exhaust.push(tube([0, 62, 176], [0, -140, 176], 26, 26, 1.2), torus([0, -140, 176], 34, 5, Y, 2));

  const fly = [disc([238, 0, 0], 30, 150, X, 1.1), gear([232, 0, 0], 160, 72, { axis: X, width: 16, depth: 9, hub: 150, density: 1.2 })];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; fly.push(orient(ring([0, 0, 0], 8, { density: 5 }), X, [239, 45 * Math.cos(a), 45 * Math.sin(a)])); }

  const timing = [
    gear([-262, 0, 0], 30, 20, { axis: X, width: 20, density: 1.4 }),
    gear([-258, camY, -22], 21, 18, { axis: X, width: 16, density: 1.4 }),
    gear([-258, camY, 22], 21, 18, { axis: X, width: 16, density: 1.4 }),
    belt(-250, [[0, 0, 34, Math.PI * 0.5, Math.PI * 1.5], [camY, -22, 25, Math.PI * 1.5, Math.PI * 2.0], [camY, 22, 25, 0, Math.PI * 0.5]], 5),
    disc([-290, 0, 0], 20, 72, X, 1.1), torus([-290, 0, 0], 72, 5, X, 2),
    torus([-250, 175, -40], 16, 5, X, 2),
  ];

  return [
    G('Cylinder block', COL.steel, [0, 0, 0], 0, block),
    G('Oil pan', COL.purple, [0, -360, 0], 0.08, pan),
    G('Crankshaft', COL.silver, [0, -175, 0], 0.22, crank),
    G('Connecting rods', COL.white, [0, 75, 0], 0.3, rods),
    G('Pistons', COL.gold, [0, 160, 0], 0.25, pistons),
    G('Cylinder head', COL.teal, [0, 230, 0], 0.12, head),
    G('Valves & springs', COL.pink, [0, 310, 0], 0.16, valves),
    G('Camshafts (DOHC)', COL.lime, [0, 450, 0], 0.08, cams),
    G('Valve cover', COL.red, [0, 640, 0], 0.0, cover),
    G('Coils & spark plugs', COL.ice, [0, 820, 0], 0.0, plugs),
    G('Intake manifold', COL.cyan, [0, 40, -300], 0.06, intake),
    G('Exhaust manifold', COL.orange, [0, 0, 300], 0.06, exhaust),
    G('Flywheel', COL.amber, [260, 0, 0], 0.1, fly),
    G('Timing belt & gears', COL.green, [-260, 0, 0], 0.04, timing),
  ];
}

// ============================================================ Supercharged HEMI V8 (OHV pushrod, 90° V), mm
function hemiV8() {
  const xs = [-168, -56, 56, 168], bore = 50, thr = 45, rod = 157, ch = 32, deck = 238, headTop = 330;
  const pinPhi = [0, Math.PI / 2, (3 * Math.PI) / 2, Math.PI];         // cross-plane crank
  const banks = [
    { beta: deg(45), bx: 12, inner: -1, side: 1 },                   // right bank leans toward +z
    { beta: deg(-45), bx: -12, inner: 1, side: -1 },
  ];
  const parts = { block: [], heads: [], covers: [], pistons: [], rods: [], valvetrain: [], headersR: [], headersL: [] };

  parts.block.push(boxSurface([0, 10, 0], [500, 140, 300], 0.26, null, false, false), boxEdges([0, 10, 0], [500, 140, 300], 0, 1.4));
  const crank = [tube([-270, 0, 0], [255, 0, 0], 30, 30, 0.7), disc([255, 0, 0], 0, 60, X, 1.3)];
  xs.forEach((cx, i) => {
    const phi = pinPhi[i], pin = [cx, thr * Math.cos(phi), thr * Math.sin(phi)];
    crank.push(tube(add(pin, [-28, 0, 0]), add(pin, [28, 0, 0]), 25, 25, 1.5));
    crank.push(crankWeb(cx - 36, phi, thr, 80, 14, 0.9), crankWeb(cx + 36, phi, thr, 80, 14, 0.9));
  });

  for (const b of banks) {
    const R = rotX(b.beta), W = (p) => matVec(R, p);
    const local = { block: [], head: [], cover: [], valvetrain: [] };
    local.block.push(
      boxSurface([b.bx, (100 + deck) / 2, 0], [480, deck - 100, 132], 0.28, null, false, false),
      quad([b.bx - 240, deck, 66], [b.bx + 240, deck, 66], [b.bx + 240, deck, -66], [b.bx - 240, deck, -66], 0.4,
        (x, y, z) => xs.every((cx) => Math.hypot(x - cx - b.bx, z) > bore + 3)),
      boxEdges([b.bx, (100 + deck) / 2, 0], [480, deck - 100, 132], 0, 1.4));
    for (const cx of xs) local.block.push(cylinder([cx + b.bx, 110, 0], bore + 1, deck - 110, { density: 0.28 }), ring([cx + b.bx, deck, 0], bore + 3, { density: 5 }));

    local.head.push(boxSurface([b.bx, (deck + headTop) / 2, 0], [480, headTop - deck, 150], 0.26, null, false, true),
      boxEdges([b.bx, (deck + headTop) / 2, 0], [480, headTop - deck, 150], 0, 1.4));
    for (const cx of xs) {
      const x = cx + b.bx;
      // hemispherical combustion chamber + opposed, splayed valves (the "HEMI")
      local.head.push(paramSurface((u, v) => [x + 48 * Math.cos(v) * Math.cos(u), deck + 30 * Math.sin(v), 48 * Math.cos(v) * Math.sin(u)], 0, TAU, 0, Math.PI / 2, { density: 1.4, gu: 24, gv: 8 }));
      local.head.push(ring([x, deck, 0], 48, { density: 5 }));
      for (const s of [-1, 1]) {
        const seat = [x, deck + 22, s * 26], tip = [x, headTop + 20, s * 78];
        local.valvetrain.push(line(seat, tip, 0, 5), disc(seat, 0, 20, [0, 0.55, -s * 0.84], 2));
        local.valvetrain.push(helix(add(seat, mul([0, 0.83, s * 0.56], 55)), 13, 40, 5, [0, 0.83, s * 0.56], 1.4));
        local.valvetrain.push(box(add(tip, [0, 12, -s * 20]), [18, 14, 70], 1.4, 3));           // rocker arm
        local.head.push(polyline(linspace(0, TAU, 28).map((a) => [x + 26 * Math.cos(a), 290 + 18 * Math.sin(a), s * 75.5]), 0, 4));
      }
    }
    const cy0 = headTop + 28, cy1 = cy0 + 70;
    local.cover.push(boxSurface([b.bx, (cy0 + cy1) / 2, 0], [490, cy1 - cy0, 160], 0.4, null, false, true),
      boxEdges([b.bx, (cy0 + cy1) / 2, 0], [490, cy1 - cy0, 160], 0, 2));
    for (const z of [-60, 60]) local.cover.push(line([b.bx - 230, cy1 + 0.5, z], [b.bx + 230, cy1 + 0.5, z], 0, 2.5));
    local.cover.push(badge('HEMI', [b.bx - 135, cy1 + 1, -30 * b.side], [1, 0, 0], [0, 0, b.side], 42, 7));

    parts.block.push(transform(local.block, R));
    parts.heads.push(G(b.side > 0 ? 'Cylinder heads' : 'Cylinder head (L)', COL.red, mul(W(Y), 250), 0.12, transform(local.head, R), { showLabel: b.side > 0 }));
    parts.covers.push(G(b.side > 0 ? 'Valve covers' : 'Valve cover (L)', COL.magenta, mul(W(Y), 470), 0.0, transform(local.cover, R), { showLabel: b.side > 0 }));
    parts.valvetrain.push(G(b.side > 0 ? 'Valves & rockers' : 'Valves (L)', COL.pink, mul(W(Y), 350), 0.06, transform(local.valvetrain, R), { showLabel: b.side > 0 }));

    xs.forEach((cx, i) => {
      const phi = pinPhi[i], pinW = [cx + b.bx, thr * Math.cos(phi), thr * Math.sin(phi)];
      const pl = matVec(rotX(-b.beta), pinW);                          // crank pin seen in the bank frame
      const py = pl[1] + Math.sqrt(rod * rod - pl[2] * pl[2]), top = py + ch;
      const pist = [cylinder([cx + b.bx, top - 58, 0], bore - 2, 58, { density: 1.1, cap: true }), tube([cx + b.bx, py, -32], [cx + b.bx, py, 32], 11, 11, 1.5)];
      for (const dy of [6, 12, 18]) pist.push(ring([cx + b.bx, top - dy, 0], bore - 1.5, { density: 5 }));
      parts.pistons.push(G('Pistons', COL.gold, mul(W(Y), 165), 0.25, transform(pist, R), { showLabel: i === 0 && b.side > 0 }));
      const small = W([cx + b.bx, py, 0]);
      parts.rods.push(G('Connecting rods', COL.white, mul(W(Y), 80), 0.3, [tube(pinW, small, 12, 9, 2.2), torus(pinW, 32, 6, X, 1.5), torus(small, 17, 5, X, 1.5)], { showLabel: i === 0 && b.side > 0 }));
      for (const s of [-1, 1]) parts.valvetrain.push(G('Pushrods', COL.pink, mul(W(Y), 350), 0.06, [tube([cx + b.bx + s * 14, 150, b.inner * -10], W([cx + b.bx + s * 14, headTop + 12, b.inner * 40]), 4, 4, 3)], { showLabel: false }));
      const port = W([cx + b.bx, 290, -b.inner * 76]), outDir = W([0, 0, -b.inner]);
      const hdr = pipe([port, add(port, mul(outDir, 60)), [cx * 0.55 + 60, -30, b.side * 290], [150, -120, b.side * 300]], 17, 1.2);
      (b.side > 0 ? parts.headersR : parts.headersL).push(hdr);
    });
  }
  for (const [arr, s] of [[parts.headersR, 1], [parts.headersL, -1]]) arr.push(tube([150, -120, s * 300], [300, -150, s * 300], 30, 30, 1.2), torus([300, -150, s * 300], 36, 5, X, 2));

  const cam = [tube([-300, 150, 0], [240, 150, 0], 14, 14, 1.2)];
  xs.forEach((cx, i) => { for (const s of [-1, 1]) for (const bx of [-12, 12]) cam.push(camLobe(cx + bx + s * 14, 150, 0, i * 1.3 + s + bx * 0.1, 18, 8, 10, 1)); });
  cam.push(gear([-300, 150, 0], 40, 30, { axis: X, width: 16, density: 1.4 }));

  const intake = [box([0, 385, 0], [420, 70, 150], 0.45, 3)];
  for (const cx of xs) for (const b of banks) {
    const port = matVec(rotX(b.beta), [cx + b.bx, 290, b.inner * 76]);
    intake.push(pipe([[cx + b.bx, 360, b.side * 55], add(port, [0, 20, 0]), port], 20, 1.1));
  }
  const sc = [];
  for (const s of [-1, 1]) sc.push(tube([-200, 470, s * 38], [200, 470, s * 38], 46, 46, 0.7));
  sc.push(boxEdges([0, 470, 0], [400, 92, 170], 0, 3), box([0, 425, 0], [360, 12, 150], 0.6, 3));
  for (let k = 0; k < 7; k++) sc.push(line([-190 + k * 63, 518, -70], [-190 + k * 63, 518, 70], 0, 3));
  sc.push(tube([200, 470, 0], [290, 470, 0], 42, 50, 1.2), torus([290, 470, 0], 50, 4, X, 3), disc([280, 470, 0], 0, 44, X, 1.2));
  sc.push(gear([-230, 470, 0], 48, 26, { axis: X, width: 26, density: 1.3 }));
  sc.push(badge('V8', [-60, 519, 55], [1, 0, 0], [0, 0, -1], 40, 7));

  const beltDrive = [
    disc([-330, 0, 0], 20, 80, X, 1.1), torus([-330, 0, 0], 80, 5, X, 2),
    belt(-322, [[0, 0, 84, Math.PI * 0.5, Math.PI * 1.5], [470, 0, 52, Math.PI * 1.5, Math.PI * 2.5]], 5),
    torus([-322, 230, 95], 22, 6, X, 2),
  ];
  const pan = [boxSurface([0, -130, 0], [480, 140, 260], 0.34, null, true, false), boxEdges([0, -130, 0], [480, 140, 260], 0, 1.6), box([120, -220, 0], [180, 40, 180], 0.34, 4)];
  const fly = [disc([275, 0, 0], 30, 170, X, 1.1), gear([270, 0, 0], 180, 80, { axis: X, width: 16, depth: 9, hub: 170, density: 1.2 })];
  const timingCover = [box([-282, 90, 0], [12, 300, 260], 0.5, 3)];

  return [
    G('Engine block', COL.orange, [0, 0, 0], 0, parts.block),
    G('Oil pan', COL.purple, [0, -380, 0], 0.08, pan),
    G('Crankshaft', COL.silver, [0, -180, 0], 0.22, crank),
    ...parts.rods, ...parts.pistons, ...parts.heads, ...parts.covers, ...parts.valvetrain,
    G('Camshaft (in the V)', COL.lime, [-520, 0, 0], 0.32, cam),
    G('Intake manifold', COL.cyan, [0, 430, 0], 0.05, intake),
    G('Supercharger', COL.green, [0, 760, 0], 0.0, sc),
    G('Supercharger belt', COL.white, [-300, 0, 0], 0.0, beltDrive),
    G('Timing cover', COL.teal, [-200, 0, 0], 0.1, timingCover),
    G('Exhaust headers', COL.amber, [0, -60, 280], 0.06, parts.headersR),
    G('Exhaust headers (L)', COL.amber, [0, -60, -280], 0.06, parts.headersL, { showLabel: false }),
    G('Flywheel', COL.steel, [280, 0, 0], 0.1, fly),
  ];
}

// ============================================================ Turbofan jet engine, cm, axis along +x (intake at -x)
/** One rotor/stator row: n twisted blades between rHub and rTip, centred at axial x0. */
function bladeRow(x0, rHub, rTip, n, chord, twRoot, twTip, density = 1) {
  const bladePt = (c) => (rng, o, i) => {
    const k = Math.floor(rng.random() * n), r = rHub + (rTip - rHub) * rng.random(), cc = c ?? rng.random() - 0.5;
    const tw = twRoot + (twTip - twRoot) * (r - rHub) / (rTip - rHub);
    const th = (k / n) * TAU + (cc * chord * Math.sin(tw)) / r, j = i * 3;
    o[j] = x0 + cc * chord * Math.cos(tw); o[j + 1] = r * Math.cos(th); o[j + 2] = r * Math.sin(th);
  };
  return [
    new Part(bladePt(null), n * (rTip - rHub) * chord, density),
    new Part(bladePt(-0.5), n * (rTip - rHub), density * 3),                 // bright leading edges
    orient(revolve([-chord / 2, chord / 2], [rHub, rHub], { density }), X, [x0, 0, 0]),
  ];
}
/** Surface of revolution around the x axis: profile (xs[i], rs[i]); optional angular range for split casings. */
const revX = (xs, rs, opts = {}) => orient(revolve(xs, rs, opts), X, [0, 0, 0]);
const ringX = (x, r, density, half = {}) => orient(revolve([0, 0], [r + 0.5, r], { density, ...half }), X, [x, 0, 0]);
// after orienting +y onto +x, the local angle a maps to world (y, z) = (-r cos a, r sin a)
const UPPER = { a0: Math.PI / 2, a1: (3 * Math.PI) / 2 }, LOWER = { a0: -Math.PI / 2, a1: Math.PI / 2 };

function turbofan() {
  const spinner = [revX([-190, -178, -165, -150], [0, 13, 21, 26], { density: 1.2 })];
  for (let k = 0; k < 3; k++) spinner.push(polyline(linspace(0, 1, 16).map((t) => { const x = -190 + 40 * t, r = 26 * Math.sqrt(t), a = (k / 3) * TAU + t * 2; return [x, r * Math.cos(a), r * Math.sin(a)]; }), 0, 3));
  const fan = [bladeRow(-138, 26, 98, 22, 30, deg(58), deg(22), 1.0), ringX(-138, 98, 4)];
  const booster = [];
  [-114, -104, -94].forEach((x, i) => booster.push(bladeRow(x, 30, 58 - i * 2, 30, 7, deg(45), deg(35), 1.0)));
  const hpc = [];
  for (let i = 0; i < 9; i++) hpc.push(bladeRow(-62 + i * 9.5, 30, 50 - i * 1.6, 36, 5, deg(40), deg(32), 1.0));
  hpc.push(revX([-68, 24], [51, 37], { density: 0.25 }));
  const combustor = [
    revX([24, 30, 60, 68], [36, 33, 33, 34], { density: 0.8 }), revX([24, 30, 60, 68], [42, 52, 52, 50], { density: 0.8 }),
    ringX(24, 42, 5), ringX(60, 52, 5),
  ];
  for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU; combustor.push(tube([16, 42 * Math.cos(a), 42 * Math.sin(a)], [28, 42 * Math.cos(a), 42 * Math.sin(a)], 2, 2, 3)); }
  const hpt = [bladeRow(74, 32, 50, 40, 6, deg(-40), deg(-30), 1.1), bladeRow(84, 32, 52, 40, 6, deg(-40), deg(-30), 1.1)];
  const lpt = [];
  for (let i = 0; i < 5; i++) lpt.push(bladeRow(98 + i * 11, 34, 56 + i * 3.2, 44, 7, deg(-45), deg(-30), 1.0));
  lpt.push(revX([90, 150], [57, 72], { density: 0.2 }));
  const shaft = [revX([-150, 175], [7, 7], { density: 1.4 }), revX([-60, 88], [14, 14], { density: 1.0 })];
  const nozzle = [revX([150, 185, 220], [74, 68, 58], { density: 0.8 }), ringX(220, 58, 6), revX([150, 190, 225, 240], [34, 30, 16, 0], { density: 1.0 })];
  const nacX = [-178, -170, -150, -110, -40, 30, 62], nacR = [104, 112, 116, 116, 113, 104, 98];
  const nacelle = (half) => [
    revX(nacX, nacR, { density: 0.35, ...half }), revX([-178, -165, -120, -80], [104, 100, 100, 98], { density: 0.25, ...half }),
    ...[0, 3, 4, 5, 6].map((i) => ringX(nacX[i], nacR[i], 6, half)),
  ];
  const coreCowl = (half) => [revX([-80, -20, 60, 140, 150], [62, 64, 64, 62, 60], { density: 0.3, ...half }), ringX(-20, 64, 6, half), ringX(140, 62, 6, half)];

  return [
    G('Spinner', COL.white, [-330, 0, 0], 0.1, spinner),
    G('Fan (22 blades)', COL.cyan, [-250, 0, 0], 0.1, fan),
    G('Low-pressure compressor', COL.teal, [-175, 0, 0], 0.15, booster),
    G('High-pressure compressor', COL.lime, [-80, 0, 0], 0.2, hpc),
    G('Combustion chamber', COL.orange, [20, 0, 0], 0.25, combustor),
    G('High-pressure turbine', COL.red, [110, 0, 0], 0.2, hpt),
    G('Low-pressure turbine', COL.magenta, [190, 0, 0], 0.15, lpt),
    G('Exhaust nozzle & tail cone', COL.purple, [290, 0, 0], 0.1, nozzle),
    G('Spools / shafts', COL.gold, [0, -150, 0], 0.3, shaft),
    G('Nacelle', COL.steel, [0, 190, 0], 0.0, nacelle(UPPER)),
    G('Nacelle (lower)', COL.steel, [0, -250, 0], 0.0, nacelle(LOWER), { showLabel: false }),
    G('Core cowl', COL.ice, [0, 110, 0], 0.05, coreCowl(UPPER)),
    G('Core cowl (lower)', COL.ice, [0, -190, 0], 0.05, coreCowl(LOWER), { showLabel: false }),
  ];
}

// ============================================================ 9-cylinder radial aircraft engine, mm, crank axis along z
function radial9() {
  const n = 9, cyl = [], pistons = [], intake = [], exhaust = [];
  for (let k = 0; k < n; k++) {
    const R = rotZ(-(k / n) * TAU), dir = matVec(R, Y);
    const barrel = [cylinder([0, 190, 0], 72, 180, { density: 0.35 })];
    for (let y = 205; y <= 360; y += 11) barrel.push(ring([0, y, 0], 92, { density: 2.2 }));
    barrel.push(revolve([370, 400, 440, 470], [96, 100, 90, 55], { density: 0.6 }));
    for (let y = 380; y <= 455; y += 11) barrel.push(ring([0, y, 0], 112 - (y - 380) * 0.3, { density: 2.2 }));
    for (const s of [-1, 1]) {
      barrel.push(box([s * 30, 452, 40], [30, 30, 60], 1.2, 3));                                  // rocker boxes
      barrel.push(tube([s * 20, 200, 90], [s * 28, 440, 55], 4, 4, 3));                             // pushrods
    }
    cyl.push(G('Cylinders (cooling fins)', COL.steel, mul(dir, 330), 0.08, transform(barrel, R), { showLabel: k === 0 }));
    const p = [cylinder([0, 262, 0], 68, 48, { density: 1.2, cap: true }), ring([0, 300, 0], 69, { density: 5 }), ring([0, 292, 0], 69, { density: 5 }), tube([0, 240, -40], [0, 240, 40], 12, 12, 1.5)];
    pistons.push(G('Pistons', COL.gold, mul(dir, 170), 0.2, transform(p, R), { showLabel: k === 0 }));
    intake.push(transform(pipe([[0, 150, -150], [0, 250, -150], [0, 400, -80]], 17, 1.1), R));
    exhaust.push(transform(pipe([[0, 430, 70], [0, 520, 60], [0, 560, -40]], 18, 1.2), R));
  }
  const crankcase = [
    orient(revolve([-90, -70, 70, 90], [150, 196, 196, 150], { density: 0.4 }), Z, [0, 0, 0]),
    orient(revolve([90, 160, 230], [150, 120, 75], { density: 0.5 }), Z, [0, 0, 0]),                   // nose (reduction gear) case
    orient(ring([0, 0, 0], 197, { density: 5 }), Z, [0, 0, -70]), orient(ring([0, 0, 0], 197, { density: 5 }), Z, [0, 0, 70]),
  ];
  const rods = [disc([0, 40, 0], 0, 55, Z, 1.4)];
  for (let k = 0; k < n; k++) {
    const th = (k / n) * TAU, d = [Math.sin(th), Math.cos(th), 0];
    const hub = add([0, 40, 0], mul(d, k === 0 ? 0 : 50));
    rods.push(tube(hub, mul(d, 240), k === 0 ? 14 : 9, k === 0 ? 11 : 7, 2), orient(ring([0, 0, 0], 14, { density: 5 }), Z, mul(d, 240)));
  }
  const crank = [tube([0, 0, -170], [0, 0, 330], 28, 28, 1.1), paramSurface((r, a) => [r * Math.cos(a), r * Math.sin(a), -12], 0, 110, deg(200), deg(340), { density: 1.2, gu: 8, gv: 12 })];
  const hub = [orient(revolve([330, 340, 400, 470], [0, 80, 75, 0], { density: 1.1 }), Z, [0, 0, 0]), gear([0, 0, 250], 95, 48, { axis: Z, width: 18, density: 1.2 })];
  const accessory = [orient(revolve([-90, -150, -230], [150, 140, 110], { density: 0.5 }), Z, [0, 0, 0]), box([0, -150, -200], [140, 60, 50], 0.6, 3), box([90, 90, -215], [60, 60, 60], 0.6, 3)];
  return [
    G('Crankcase', COL.silver, [0, 0, 0], 0, crankcase),
    G('Master & link rods', COL.white, [0, 0, 260], 0.28, rods),
    G('Crankshaft', COL.amber, [0, 0, 480], 0.32, crank),
    G('Propeller hub & reduction gear', COL.red, [0, 0, 760], 0.0, hub),
    G('Accessory section', COL.teal, [0, 0, -380], 0.05, accessory),
    G('Intake pipes', COL.cyan, [0, 0, -240], 0.12, intake),
    G('Exhaust stacks', COL.orange, [0, 0, 330], 0.12, exhaust),
    ...cyl, ...pistons,
  ];
}

export const ENGINES = [
  // tilt: degrees the model leans toward the viewer; viewYaw: 3/4 angle the exploded view eases to
  { name: 'Inline-4 Engine', groups: inline4, color: [0.35, 0.75, 1.0], tilt: 20, viewYaw: 0.6, fact: 'DOHC 16-valve · 4 cylinders · firing 1-3-4-2' },
  { name: 'Supercharged HEMI V8', groups: hemiV8, color: [1.0, 0.45, 0.15], tilt: 22, viewYaw: 0.55, fact: '90° V8 · pushrod OHV · hemispherical chambers' },
  { name: 'Turbofan Jet Engine', groups: turbofan, color: [0.3, 0.9, 1.0], tilt: 12, viewYaw: 0.45, fact: 'Fan → compressors → combustor → turbines → nozzle' },
  { name: 'Radial Aircraft Engine', groups: radial9, color: [1.0, 0.78, 0.35], tilt: 10, viewYaw: 0.5, fact: '9 cylinders · master & link rods · air-cooled' },
];
