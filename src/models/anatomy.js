// Explodable human anatomy: brain, heart and kidney. Same group format as engines.js, plus `info` = what the
// part does (shown under its label in the exploded view). Units ~0.5 mm, y up, the viewer looks at the front (+z).
import { line, polyline, tube, paramSurface, ellipsoid, revolve, orient, torus, TAU } from '../lib/sampling.js';
import { rotZ, matVec, add, mul, norm, linspace } from '../lib/vec.js';
import { makeRng } from '../lib/rng.js';
import { G } from './engines.js';

// ---------------------------------------------------------------- helpers
/** Catmull-Rom spline through control points -> dense point list. */
function spline(pts, per = 10) {
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
/** Smooth, tapering vessel / tube along control points. */
function vessel(ctrl, r0, r1 = r0, density = 1, per = 8) {
  const P = spline(ctrl, per), n = P.length - 1, out = [];
  for (let i = 0; i < n; i++) out.push(tube(P[i], P[i + 1], r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, density));
  return out;
}
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ============================================================ BRAIN
// x = front (+) / back, y = up, z = right (+) / left. ~330 long, 280 wide, 190 tall.
function brain() {
  const hemi = (s) => (u, v) => {
    const cv = Math.cos(v), sv = Math.sin(v);
    let x = 165 * cv * Math.cos(u), y = 88 * sv, z = 108 * cv * Math.sin(u);
    if (z * s < 0) z *= 0.27;                                   // flat medial wall facing the other hemisphere
    if (y < 0) y *= 0.6;                                         // flatter base
    const lat = Math.max(0, (z * s) / 108);                      // the temporal lobe hangs lower, front-sideways
    y -= 32 * Math.exp(-(((x - 25) / 70) ** 2)) * Math.max(0, -sv) * lat;
    const f = 1 + 0.028 * Math.sin(11 * u + 3 * Math.sin(5 * v)) * Math.cos(9 * v + 2 * Math.sin(4 * u));   // gyri
    return [x * f, 20 + y * f, s * 32 + z * f];
  };
  const fissureY = (x) => -5 - 0.33 * (x - 60);                  // lateral (Sylvian) fissure
  const centralX = (y) => 28 - 0.38 * (y - 10);                  // central sulcus
  const region = (x, y, z) => {
    if (x < -112) return 'occipital';
    if (y < fissureY(x) && x > -125 && x < 75 && Math.abs(z) > 30) return 'temporal';
    if (x > centralX(y)) return 'frontal';
    return 'parietal';
  };
  const lobes = {};
  const rng = makeRng(11);
  for (const s of [1, -1]) {
    const fn = hemi(s), L = { frontal: [], parietal: [], temporal: [], occipital: [] };
    for (const r of Object.keys(L)) L[r].push(paramSurface(fn, 0, TAU, -Math.PI / 2, Math.PI / 2, { density: 0.55, gu: 56, gv: 32, keep: (x, y, z) => region(x, y, z) === r }));
    for (let c = 0; c < 70; c++) {                               // sulci: meandering grooves drawn brighter
      let u = rng.random() * TAU, v = -1.1 + rng.random() * 2.4, h = rng.random() * TAU, prev = fn(u, v);
      for (let k = 0; k < 16; k++) {
        h += (rng.random() - 0.5) * 1.1;
        u += Math.cos(h) * 0.07; v = Math.max(-1.35, Math.min(1.45, v + Math.sin(h) * 0.07));
        const p = fn(u, v), mid = mul(add(p, prev), 0.5);
        L[region(...mid)].push(line(prev, p, 0, 3));
        prev = p;
      }
    }
    lobes[s] = L;
  }
  // cerebellum: foliated ellipsoid tucked under the occipital lobes
  const cb = [paramSurface((u, v) => { const f = 1 + 0.04 * Math.sin(34 * v); return [-112 + 62 * Math.cos(v) * Math.cos(u) * f, -48 + 40 * Math.sin(v) * f, 100 * Math.cos(v) * Math.sin(u) * f]; }, 0, TAU, -Math.PI / 2, Math.PI / 2, { density: 0.6, gu: 40, gv: 30 })];
  for (const v of linspace(-1.2, 1.2, 18)) cb.push(polyline(linspace(0, TAU, 60).map((u) => [-112 + 63 * Math.cos(v) * Math.cos(u), -48 + 41 * Math.sin(v), 101 * Math.cos(v) * Math.sin(u)]), 0, 2.2));
  const stem = [vessel([[-12, -5, 0], [-30, -60, 0], [-42, -120, 0], [-48, -190, 0]], 27, 14, 0.9), ellipsoid([-28, -68, 4], [30, 28, 36], 0.9)];
  // corpus callosum: C-shaped band of fibres joining the hemispheres
  const ccPt = (t, z) => { const th = Math.PI * (0.02 + 0.98 * t); return [74 * Math.cos(th) - 4, 36 + 26 * Math.sin(th), z]; };
  const cc = [paramSurface((t, w) => ccPt(t, w * 36), 0, 1, -1, 1, { density: 0.9, gu: 30, gv: 10 })];
  for (const t of linspace(0.05, 0.95, 14)) cc.push(line(ccPt(t, -40), ccPt(t, 40), 0, 3));
  const thal = [ellipsoid([-15, 16, 16], [30, 19, 14], 1.2), ellipsoid([-15, 16, -16], [30, 19, 14], 1.2)];
  const hypo = [ellipsoid([18, -16, 0], [18, 11, 12], 1.3), vessel([[22, -26, 0], [26, -46, 0]], 3, 3, 3), ellipsoid([28, -54, 0], [10, 8, 11], 1.5)];
  const side = (s) => {
    const hippoPath = [[-62, 6, s * 38], [-40, -20, s * 46], [-5, -38, s * 52], [22, -42, s * 52]], hp = spline(hippoPath, 8);
    return {
      vent: vessel([[55, 30, s * 12], [0, 42, s * 15], [-55, 36, s * 17], [-82, 10, s * 26], [-52, -20, s * 40], [-6, -30, s * 44]], 9, 6, 1.1),
      bg: [vessel([[58, 20, s * 24], [10, 32, s * 27], [-45, 28, s * 29], [-70, 5, s * 33]], 14, 5, 1.0), ellipsoid([15, 2, s * 48], [32, 22, 11], 1.0)],
      hippo: [vessel(hippoPath, 10, 8, 1.2), ...linspace(0.1, 0.9, 6).map((t) => orient(revolve([0, 0], [11.5, 10.5], { density: 4 }), [1, -0.3, 0], hp[Math.round(t * (hp.length - 1))]))],
      amyg: ellipsoid([35, -40, s * 50], [13, 11, 11], 1.6),
      optic: [vessel([[95, -30, s * 34], [55, -32, s * 10], [42, -32, 0]], 5, 5, 2), vessel([[42, -32, 0], [22, -34, s * 20], [0, -30, s * 28]], 4, 4, 2)],
    };
  };
  const R = side(1), Lh = side(-1);

  const PINK = [1.0, 0.45, 0.62], BLUE = [0.5, 0.6, 1.0], GREEN = [0.4, 1.0, 0.6], AMBER = [1.0, 0.75, 0.3];
  const lobe = (name, key, color, offR, stage, info) => [
    G(name, color, offR, stage, lobes[1][key], { info }),
    G(name + ' (L)', color, [offR[0], offR[1], -offR[2]], stage, lobes[-1][key], { showLabel: false }),
  ];
  return [
    ...lobe('Frontal lobe', 'frontal', PINK, [120, 30, 170], 0, 'planning, decisions, personality, movement'),
    ...lobe('Parietal lobe', 'parietal', BLUE, [-10, 125, 170], 0, 'touch, body position, sense of space'),
    ...lobe('Temporal lobe', 'temporal', GREEN, [40, -90, 200], 0, 'hearing, language, memory'),
    ...lobe('Occipital lobe', 'occipital', AMBER, [-150, 30, 150], 0, 'vision - makes sense of what you see'),
    G('Cerebellum', [1.0, 0.55, 0.2], [-170, -120, 0], 0.05, cb, { info: 'balance, coordination, fine movement' }),
    G('Brainstem', [1.0, 0.85, 0.35], [-40, -210, 0], 0.1, stem, { info: 'breathing, heartbeat, sleep & wake' }),
    G('Corpus callosum', [0.95, 0.95, 1.0], [0, 150, 0], 0.25, cc, { info: '200 million fibres linking both halves' }),
    G('Thalamus', [0.3, 0.9, 1.0], [-20, 55, 0], 0.35, thal, { info: 'relay station for the senses' }),
    G('Hypothalamus & pituitary', [0.75, 1.0, 0.3], [70, -120, 0], 0.3, hypo, { info: 'hormones, hunger, body temperature' }),
    G('Hippocampus', [1.0, 0.95, 0.3], [-50, -60, 120], 0.3, R.hippo, { info: 'turns experiences into long-term memory' }),
    G('Hippocampus (L)', [1.0, 0.95, 0.3], [-50, -60, -120], 0.3, Lh.hippo, { showLabel: false }),
    G('Amygdala', [1.0, 0.3, 0.3], [80, -60, 120], 0.35, R.amyg, { info: 'fear and emotional reactions' }),
    G('Amygdala (L)', [1.0, 0.3, 0.3], [80, -60, -120], 0.35, Lh.amyg, { showLabel: false }),
    G('Ventricles', [0.35, 0.5, 1.0], [30, 90, 0], 0.3, [R.vent, Lh.vent], { info: 'make & circulate cerebrospinal fluid' }),
    G('Basal ganglia', [0.72, 0.45, 1.0], [30, -10, 95], 0.35, R.bg, { info: 'movement control and habits' }),
    G('Basal ganglia (L)', [0.72, 0.45, 1.0], [30, -10, -95], 0.35, Lh.bg, { showLabel: false }),
    G('Optic nerves & chiasm', [0.4, 1.0, 0.95], [160, -60, 0], 0.3, [R.optic, Lh.optic], { info: 'carry vision from the eyes' }),
  ];
}

// ============================================================ HEART
// Anterior view: +z = front of the chest, the apex points down and to the patient's left (+x).
function heart() {
  const egg = (center, [a, b, c], R, taper, sc = 1) => (u, v) => {
    const t = 1 + taper * Math.sin(v), f = 1 + 0.015 * Math.sin(7 * u) * Math.cos(5 * v);
    return add(center, matVec(R, [a * sc * Math.cos(v) * Math.cos(u) * t * f, b * sc * Math.sin(v), c * sc * Math.cos(v) * Math.sin(u) * t * f]));
  };
  const H = Math.PI / 2;
  const lvC = [25, -25, -15], rvC = [-35, -10, 28];
  const lv = egg(lvC, [60, 95, 58], rotZ(0.5), 0.3), rv = egg(rvC, [52, 80, 40], rotZ(0.35), 0.2);
  const surf = (fn, keep, density = 0.7) => paramSurface(fn, 0, TAU, -H, H * 0.8, { density, keep, gu: 44, gv: 28 });
  const frontWall = [surf(lv, (x, y, z) => z > lvC[2] + 10), surf(rv, (x, y, z) => z > rvC[2])];
  const lvBack = [surf(lv, (x, y, z) => z <= lvC[2] + 10), surf(egg(lvC, [60, 95, 58], rotZ(0.5), 0.3, 0.7), null, 0.3)];
  const rvBack = [surf(rv, (x, y, z) => z <= rvC[2]), surf(egg(rvC, [52, 80, 40], rotZ(0.35), 0.2, 0.65), null, 0.3)];
  const septum = [paramSurface((t, w) => [-6 + 44 * t + 8 * w * w, 45 - 140 * t, 4 + 34 * w * (1 - 0.6 * t)], 0, 1, -1, 1, { density: 0.9, gu: 20, gv: 10 })];
  const la = [ellipsoid([35, 72, -55], [45, 30, 38], 0.8)];
  const ra = [ellipsoid([-72, 45, 5], [40, 48, 42], 0.8), ellipsoid([-52, 86, 40], [24, 12, 16], 1.0)];   // + right auricle
  // valves: ring + cusps domed toward the centre, oriented along the flow
  const valve = (center, normal, r, cusps) => {
    const P = [];
    for (let k = 0; k < cusps; k++) {
      const a0 = (k / cusps) * TAU + 0.06, a1 = ((k + 1) / cusps) * TAU - 0.06;
      P.push(paramSurface((s, a) => [r * s * Math.cos(a), -7 * (1 - s) * (1 - s), r * s * Math.sin(a)], 0.05, 1, a0, a1, { density: 1.6, gu: 6, gv: 10 }));
      P.push(line([0, -7, 0], [r * Math.cos(a0 - 0.06), 0, r * Math.sin(a0 - 0.06)], 0, 5));
    }
    return [orient(P, normal, center), torus(center, r, 2.5, normal, 3)];
  };
  const mitral = [35, 40, -25];
  const valves = [valve(mitral, norm([0.3, 1, -0.2]), 22, 2), valve([-35, 42, 18], norm([-0.2, 1, 0.3]), 22, 3),
    valve([5, 62, 5], [0, 1, 0.1], 14, 3), valve([-15, 76, 40], norm([0.1, 1, 0.3]), 13, 3)];
  const papil = [];
  for (const [base, tip] of [[[40, -75, -38], [40, -20, -30]], [[50, -62, 6], [46, -14, -8]]]) {
    papil.push(tube(base, tip, 11, 4, 1.3));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; papil.push(line(tip, [mitral[0] + 20 * Math.cos(a), mitral[1] - 2, mitral[2] + 20 * Math.sin(a)], 0, 3)); }   // chordae tendineae
  }
  const aorta = [vessel([[5, 62, 5], [5, 120, 0], [-5, 170, -15], [35, 195, -45], [68, 158, -70], [75, 60, -80], [75, -120, -80]], 22, 20, 0.9)];
  for (const [x, z] of [[-8, -18], [14, -32], [34, -46]]) aorta.push(vessel([[x, 182, z], [x - 4, 225, z + 4], [x - 10, 262, z + 6]], 8, 7, 1.2));   // arch branches
  const pulm = [vessel([[-15, 76, 40], [0, 122, 45], [20, 150, 20]], 17, 16, 0.9), vessel([[20, 150, 20], [60, 152, -5], [100, 145, -25]], 12, 10, 1.0),
    vessel([[20, 150, 20], [-20, 150, -20], [-80, 145, -30]], 12, 10, 1.0)];
  const cavae = [vessel([[-72, 88, 2], [-73, 160, 0], [-74, 235, 0]], 17, 17, 1.0), vessel([[-62, -10, -18], [-60, -60, -22], [-58, -120, -25]], 18, 18, 1.0)];
  const pveins = [];
  for (const [x, y] of [[10, 80], [10, 62], [60, 82], [62, 62]]) { const sx = x < 30 ? -1 : 1; pveins.push(vessel([[x, y, -80], [x + sx * 30, y + 5, -115], [x + sx * 60, y + 8, -135]], 8, 7, 1.2)); }
  const coronary = [vessel([[5, 55, 32], [-35, 40, 58], [-75, 10, 48], [-82, -30, 12], [-52, -62, -24]], 3.5, 2.5, 3),       // right coronary
    vessel([[10, 55, 28], [16, 20, 46], [30, -30, 46], [50, -80, 26], [58, -115, 2]], 3.5, 2.2, 3),                              // left anterior descending
    vessel([[15, 50, 12], [60, 40, -8], [82, 20, -45], [62, 0, -78]], 3.2, 2.2, 3)];                                           // circumflex

  return [
    G('Heart wall (myocardium)', [1.0, 0.4, 0.45], [0, -10, 240], 0, frontWall, { info: 'thick muscle that squeezes ~100,000 times a day' }),
    G('Coronary arteries', [1.0, 0.82, 0.3], [0, 30, 330], 0, coronary, { info: 'feed the heart muscle itself' }),
    G('Aorta', [1.0, 0.35, 0.2], [70, 190, -50], 0.05, aorta, { info: 'main artery: oxygen-rich blood to the body' }),
    G('Pulmonary artery', [0.4, 0.55, 1.0], [-60, 170, 90], 0.05, pulm, { info: 'takes blood to the lungs for oxygen' }),
    G('Vena cavae', [0.5, 0.42, 1.0], [-180, 40, 0], 0.05, cavae, { info: 'bring used blood back from the body' }),
    G('Pulmonary veins', [1.0, 0.45, 0.8], [130, 60, -160], 0.05, pveins, { info: 'fresh oxygen-rich blood from the lungs' }),
    G('Left atrium', [1.0, 0.4, 0.75], [120, 120, -90], 0.1, la, { info: 'receives blood from the lungs' }),
    G('Right atrium', [0.55, 0.5, 1.0], [-160, 90, 30], 0.1, ra, { info: 'receives blood from the body' }),
    G('Left ventricle', [1.0, 0.25, 0.3], [100, -70, -70], 0.2, lvBack, { info: 'strongest chamber: pumps blood to the body' }),
    G('Right ventricle', [0.45, 0.6, 1.0], [-120, -70, 0], 0.2, rvBack, { info: 'pumps blood to the lungs' }),
    G('Septum', [1.0, 0.6, 0.7], [0, -45, 20], 0.3, septum, { info: 'wall between the left and right heart' }),
    G('Heart valves', [1.0, 0.95, 0.55], [0, 70, 100], 0.3, valves, { info: 'one-way doors: mitral, tricuspid, aortic, pulmonary' }),
    G('Papillary muscles & chordae', [0.95, 1.0, 0.85], [100, -40, 40], 0.35, papil, { info: 'heart strings that hold the valves shut' }),
  ];
}

// ============================================================ KIDNEY
// Bean ~240 tall, 130 wide, 80 deep; the hilum (where vessels enter) faces -x.
function kidney() {
  const bean = (sc) => (u, v) => {
    const cv = Math.cos(v), du = wrapPi(u - Math.PI);
    const x = 66 * cv * Math.cos(u) + 40 * Math.exp(-(du * du) / 0.35) * cv ** 4;
    return [x * sc, 118 * Math.sin(v) * sc, 40 * cv * Math.sin(u) * sc];
  };
  const shell = (sc, keep, density) => paramSurface(bean(sc), 0, TAU, -Math.PI / 2, Math.PI / 2, { density, keep, gu: 48, gv: 30 });
  const S = [-22, 0, 0];
  const dirs = linspace(-1.75, 1.75, 8).map((p) => norm([Math.cos(p), 1.75 * Math.sin(p), 0]));
  const pyramids = [], calyces = [], nephrons = [];
  dirs.forEach((d, k) => {
    const L = 34 * (1 + 0.8 * Math.abs(d[1])), tip = add(S, mul(d, 24)), base = add(tip, mul(d, L));
    pyramids.push(orient(revolve([0, L], [4, 17], { density: 0.9 }), d, tip));
    const perp = [-d[1], d[0], 0];
    for (const o of [-12, -6, 0, 6, 12]) pyramids.push(line(add(tip, mul(perp, o * 0.15)), add(base, add(mul(perp, o), [0, 0, (o % 12) * 0.5])), 0, 2.5));   // medullary rays
    calyces.push(orient(revolve([0, 9], [13, 5], { density: 1.2 }), mul(d, -1), add(tip, mul(d, 2))));
    calyces.push(vessel([add(tip, mul(d, -8)), add(S, [-18, 0, 0]), [-45, 0, 0]], 5, 5, 1.3, 4));
    if (k % 2 === 0) for (const z of [-10, 8]) {                  // enlarged nephrons: glomerulus + loop of Henle + collecting duct
      const P = (a, b) => add(add(base, mul(d, a)), add(mul(perp, b), [0, 0, z]));
      nephrons.push(ellipsoid(P(14, 6), [4.5, 4.5, 4.5], 3));
      nephrons.push(polyline([[14, 6], [12, 9], [10, 5], [8, 9], [4, 7], [-22, 7], [-25, 4], [-22, 1], [2, 1], [6, -3], [10, -5], [8, -8], [0, -9], [-L + 6, -9]].map(([a, b]) => P(a, b)), 0, 5));
    }
  });
  calyces.push(ellipsoid([-50, -5, 0], [16, 30, 13], 1.1));      // renal pelvis
  const ureter = [vessel([[-58, -30, 0], [-72, -80, 4], [-80, -160, 8], [-78, -250, 8]], 6.5, 6, 1.3)];
  const branches = (y, z, r) => dirs.slice(0, -1).map((d, k) => { const m = norm(add(d, dirs[k + 1])); return vessel([[-68, y, z], add(S, mul(m, 20)), add(S, mul(m, 50))], r, r * 0.6, 2, 5); });
  const artery = [vessel([[-230, 30, 14], [-140, 26, 10], [-68, 20, 8]], 9, 8, 1.2), ...branches(20, 8, 2.8)];
  const vein = [vessel([[-230, -12, -10], [-140, -10, -9], [-68, -8, -7]], 11, 10, 1.1), ...branches(-8, -7, 3.2)];
  const adrenal = [paramSurface((u, v) => { const t = 1 + 0.35 * Math.max(0, Math.sin(v)); return [(42 * Math.cos(v) * Math.cos(u)) / t, 132 + 22 * Math.sin(v) * t, 18 * Math.cos(v) * Math.sin(u)]; }, 0, TAU, -Math.PI / 2, Math.PI / 2, { density: 1.1, gu: 30, gv: 16 })];

  return [
    G('Renal capsule', [1.0, 0.5, 0.45], [0, 0, 210], 0, shell(1, (x, y, z) => z > 0, 0.6), { info: 'tough protective outer layer' }),
    G('Renal capsule (back)', [1.0, 0.5, 0.45], [0, 0, -210], 0, shell(1, (x, y, z) => z <= 0, 0.6), { showLabel: false }),
    G('Renal cortex', [1.0, 0.7, 0.35], [0, 0, 125], 0.08, shell(0.9, (x, y, z) => z > 0, 0.35), { info: 'outer layer where blood is filtered' }),
    G('Renal cortex (back)', [1.0, 0.7, 0.35], [0, 0, -125], 0.08, shell(0.9, (x, y, z) => z <= 0, 0.35), { showLabel: false }),
    G('Medulla (renal pyramids)', [0.75, 0.45, 1.0], [45, 0, 0], 0.25, pyramids, { info: 'concentrate urine and save water' }),
    G('Nephrons', [0.5, 1.0, 0.45], [180, 0, 70], 0.35, nephrons, { info: '~1 million tiny filters per kidney' }),
    G('Calyces & renal pelvis', [1.0, 0.9, 0.35], [-70, 0, 0], 0.25, calyces, { info: 'collect urine and funnel it out' }),
    G('Ureter', [1.0, 0.95, 0.65], [-70, -70, 0], 0.2, ureter, { info: 'carries urine down to the bladder' }),
    G('Renal artery', [1.0, 0.25, 0.25], [-120, 80, 45], 0.15, artery, { info: '~1 L of blood per minute in to be cleaned' }),
    G('Renal vein', [0.4, 0.5, 1.0], [-120, -80, -45], 0.15, vein, { info: 'returns the cleaned blood to the body' }),
    G('Adrenal gland', [1.0, 0.82, 0.25], [0, 150, 0], 0.05, adrenal, { info: 'makes adrenaline and cortisol' }),
  ];
}

export const ANATOMY = [
  { name: 'Human Brain', groups: brain, color: [1.0, 0.5, 0.7], tilt: 12, viewYaw: 0.75, fact: '~86 billion neurons · 1.4 kg · 20 % of your energy' },
  { name: 'Human Heart', groups: heart, color: [1.0, 0.28, 0.32], tilt: 6, viewYaw: 0.35, pulse: { bpm: 72, amp: 0.05 }, fact: '4 chambers · 4 valves · ~7,000 L of blood a day' },
  { name: 'Kidney', groups: kidney, color: [1.0, 0.55, 0.45], tilt: 6, viewYaw: 0.7, fact: '12 cm · filters ~180 L of blood plasma a day' },
];
