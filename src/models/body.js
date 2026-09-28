// Skeleton and full human body. Units 0.5 cm (175 cm tall = 350), y up from the soles, the body faces +z.
// The body comes apart system by system: skin, organs, nervous system, arteries, veins and skeleton.
import { line, polyline, paramSurface, ellipsoid, orient, ring, tri, TAU } from '../lib/sampling.js';
import { add, mul, sub, norm, linspace } from '../lib/vec.js';
import { spline, vessel, pathTube, blob, bone } from '../lib/shapes.js';
import { G } from './engines.js';

const SPINE = spline([[0, 302, -4], [0, 282, -6], [0, 250, -11], [0, 222, -8], [0, 205, -5], [0, 190, -9]], 8);

/** Bone groups keyed by region; side s = +1 is the body's left (+x). */
function skeletonParts() {
  const P = { skull: [], spine: [], ribs: [], shoulders: [], arms: { 1: [], [-1]: [] }, hands: { 1: [], [-1]: [] }, pelvis: [], legs: { 1: [], [-1]: [] }, feet: { 1: [], [-1]: [] } };
  P.skull.push(blob([0, 324, -1], [18, 22, 20], { density: 0.8 }), blob([0, 306, 9], [13, 11, 11], { density: 0.8 }),
    vessel([[-11, 300, -2], [-10, 293, 8], [0, 290, 14], [10, 293, 8], [11, 300, -2]], 2.4, 2.4, 1.4));   // cranium, face, jaw
  for (const s of [-1, 1]) P.skull.push(orient(ring([0, 0, 0], 4.5, { density: 5 }), [0, 0, 1], [s * 7, 314, 16]));
  const idx = linspace(0, SPINE.length - 2, 24).map(Math.round);
  for (const i of idx) {                                                  // 24 vertebrae + spinous processes
    const p = SPINE[i], d = norm(sub(SPINE[i + 1], p));
    P.spine.push(orient(paramSurface((u, h) => [5 * Math.cos(u), h * 4, 4.5 * Math.sin(u)], 0, TAU, 0, 1, { density: 1, gu: 12, gv: 2 }), d, p));
    P.spine.push(line(p, add(p, [0, -2, -8]), 0, 3));
  }
  P.spine.push(blob([0, 181, -9], [9, 10, 5], { density: 1 }));
  for (let k = 0; k < 12; k++) {                                          // 12 pairs of ribs
    const y = 282 - k * 7.4, w = 17 + 15 * Math.sin((Math.PI * (k + 2)) / 15), end = k >= 10 ? 0.2 : Math.PI / 2;
    for (const s of [-1, 1]) {
      const pts = linspace(-Math.PI / 2, end, 14).map((f) => [s * (3 + w * Math.cos(f)), y - 9 * ((f + Math.PI / 2) / Math.PI), 2 + 14 * Math.sin(f)]);
      P.ribs.push(pathTube(pts, 1.6, 1.4));
      if (k < 10) P.ribs.push(line(pts[pts.length - 1], [s * 3, 262 - k * 3, 16], 0, 2));   // costal cartilage to the sternum
    }
  }
  P.ribs.push(blob([0, 258, 16], [5, 27, 2.5], { density: 1.2 }));        // sternum
  for (const s of [-1, 1]) {
    P.shoulders.push(vessel([[s * 4, 288, 12], [s * 22, 291, 10], [s * 38, 289, 0]], 2.2, 2.2, 1.5));   // clavicle
    P.shoulders.push(tri([s * 20, 283, -13], [s * 42, 283, -8], [s * 30, 245, -13], 0.8), polyline([[s * 20, 283, -13], [s * 42, 283, -8], [s * 30, 245, -13]], 0, 3, true));   // scapula
    const A = P.arms[s], Hh = P.hands[s];
    A.push(bone([s * 40, 283, 0], [s * 47, 225, -2], 3.2, 1.1), bone([s * 47, 225, -2], [s * 52, 172, 6], 2.1, 1.1), bone([s * 45, 224, -5], [s * 50, 171, 1], 2.1, 1.1));
    Hh.push(ellipsoid([s * 52, 167, 4], [5, 4, 3], 1.3));
    for (let f = 0; f < 5; f++) {
      const b = [s * (48.5 + f * 1.9), 163, 1 + f * 1.4], dir = f === 0 ? norm([s * -0.4, -0.6, 0.7]) : norm([s * 0.05, -1, 0.08]);
      const k1 = add(b, mul(dir, 8)), k2 = add(k1, mul(dir, f === 0 ? 5 : 6)), k3 = add(k2, mul(dir, 4));
      Hh.push(polyline([b, k1, k2, k3], 0, 5));
    }
    P.legs[s].push(bone([s * 16, 181, 2], [s * 19, 100, 0], 3.8, 1.1), ellipsoid([s * 19, 102, 6], [3, 3.5, 1.6], 1.4),
      bone([s * 19, 97, 0], [s * 20, 22, -1], 3.1, 1.1), bone([s * 23, 95, -2], [s * 23, 24, -2], 1.5, 1.1));
    P.feet[s].push(ellipsoid([s * 20, 17, -2], [4, 4, 4], 1.4), ellipsoid([s * 20, 8, -7], [4, 4, 5], 1.2));
    for (let t = 0; t < 5; t++) P.feet[s].push(polyline([[s * (16 + t * 2), 12, 0], [s * (15 + t * 2.4), 5, 14], [s * (15 + t * 2.5), 2, 22]], 0, 5));
  }
  P.pelvis.push(paramSurface((u, t) => [(14 + 14 * t) * Math.cos(u) * 1.25, 172 + 22 * t, (9 + 6 * t) * Math.sin(u)], 0, TAU, 0, 1, { density: 0.8, gu: 36, gv: 8 }),
    orient(ring([0, 0, 0], 5, { density: 4 }), [1, 0, 0], [16, 180, 2]), orient(ring([0, 0, 0], 5, { density: 4 }), [1, 0, 0], [-16, 180, 2]));
  return P;
}

// ============================================================ SKELETON
function skeleton() {
  const P = skeletonParts(), BONE = [0.95, 0.93, 0.85];
  return [
    G('Skull', BONE, [0, 70, 20], 0, P.skull, { info: '22 bones that protect the brain' }),
    G('Rib cage & sternum', [0.8, 0.9, 1.0], [0, 15, 70], 0, P.ribs, { info: '12 pairs of ribs shield heart & lungs' }),
    G('Spine (vertebral column)', [1.0, 0.8, 0.5], [0, 0, -70], 0.1, P.spine, { info: '33 vertebrae guard the spinal cord' }),
    G('Shoulder girdle', [0.7, 1.0, 0.8], [0, 35, -45], 0.05, P.shoulders, { info: 'collarbones and shoulder blades' }),
    G('Arm bones', [0.6, 0.85, 1.0], [70, 10, 0], 0.05, P.arms[1], { info: 'humerus, radius and ulna' }),
    G('Arm bones (L)', [0.6, 0.85, 1.0], [-70, 10, 0], 0.05, P.arms[-1], { showLabel: false }),
    G('Hand bones', [1.0, 0.7, 0.9], [110, -20, 30], 0.1, P.hands[1], { info: '27 bones in each hand' }),
    G('Hand bones (L)', [1.0, 0.7, 0.9], [-110, -20, 30], 0.1, P.hands[-1], { showLabel: false }),
    G('Pelvis', [1.0, 0.9, 0.6], [0, -15, 50], 0.1, P.pelvis, { info: 'carries the upper body onto the legs' }),
    G('Leg bones', [0.75, 0.75, 1.0], [35, -45, 0], 0.1, P.legs[1], { info: 'the femur is the longest bone' }),
    G('Leg bones (L)', [0.75, 0.75, 1.0], [-35, -45, 0], 0.1, P.legs[-1], { showLabel: false }),
    G('Foot bones', [1.0, 0.85, 0.5], [45, -80, 40], 0.15, P.feet[1], { info: '26 bones in each foot' }),
    G('Foot bones (L)', [1.0, 0.85, 0.5], [-45, -80, 40], 0.15, P.feet[-1], { showLabel: false }),
  ];
}

// ============================================================ FULL BODY
function humanBody() {
  const S = skeletonParts();
  const bones = [S.skull, S.spine, S.ribs, S.shoulders, S.arms[1], S.arms[-1], S.hands[1], S.hands[-1], S.pelvis, S.legs[1], S.legs[-1], S.feet[1], S.feet[-1]];
  const skin = (front) => {
    const keep = (x, y, z) => (front ? z >= 0 : z < 0);
    const P = [blob([0, 322, 2], [19, 25, 21], { density: 0.45, keep }), paramSurface((u, h) => [9 * Math.cos(u), 290 + 14 * h, 9 * Math.sin(u)], 0, TAU, 0, 1, { density: 0.45, keep, gu: 16, gv: 3 }),
      paramSurface((u, t) => { const y = 180 + 110 * t, w = 30 + 9 * Math.sin(Math.PI * t * 0.95) + (t > 0.85 ? (6 * (t - 0.85)) / 0.15 : 0), d = 19 + 3 * Math.sin(Math.PI * t); return [w * Math.cos(u), y, d * Math.sin(u)]; }, 0, TAU, 0, 1, { density: 0.45, keep, gu: 40, gv: 16 })];
    const limb = (pts, r0, r1) => {
      const out = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        out.push(paramSurface((u, h) => { const p = add(pts[i], mul(sub(pts[i + 1], pts[i]), h)), r = r0[i] + (r1[i] - r0[i]) * h; return [p[0] + r * Math.cos(u), p[1], p[2] + r * Math.sin(u)]; }, 0, TAU, 0, 1, { density: 0.45, keep, gu: 16, gv: 6 }));
      }
      return out;
    };
    for (const s of [-1, 1]) {
      P.push(limb([[s * 40, 283, 0], [s * 47, 225, -2], [s * 53, 170, 5]], [7.5, 5.5], [5.5, 3.8]), blob([s * 55, 157, 5], [4, 10, 3], { density: 0.45, keep }));
      P.push(limb([[s * 17, 185, 2], [s * 20, 100, 1], [s * 20, 20, -1]], [13, 8], [8.5, 5]), blob([s * 20, 7, 8], [6, 5, 14], { density: 0.45, keep }));
    }
    return P;
  };
  const organs = {
    brain: [blob([0, 325, -1], [15, 13, 17], { density: 1, bump: (u, v) => 1 + 0.04 * Math.sin(9 * u) * Math.cos(7 * v) })],
    lungs: [blob([-15, 255, 0], [12, 25, 12], { density: 0.9 }), blob([15, 255, 0], [11, 24, 12], { density: 0.9 })],
    heart: [blob([4, 246, 7], [8, 10, 7], { density: 1.4 })],
    liver: [blob([-10, 224, 4], [21, 9, 13], { density: 1 })],
    stomach: [blob([13, 220, 7], [11, 8, 8], { density: 1.1 })],
    intestines: [pathTube(spline([[-16, 212, 6], [16, 212, 8], [16, 204, 10], [-16, 204, 10], [-16, 196, 9], [16, 196, 8], [16, 189, 6], [-10, 190, 5]], 8), 3, 1.1)],
    kidneys: [blob([-12, 214, -10], [4, 7, 3], { density: 1.4 }), blob([12, 214, -10], [4, 7, 3], { density: 1.4 })],
    bladder: [blob([0, 186, 8], [6, 5, 5], { density: 1.4 })],
  };
  const nerves = [pathTube(SPINE.map((p) => add(p, [0, 0, 1])), 1.3, 1.6), vessel([[0, 318, 0], [0, 306, -2], [0, 302, -3]], 3, 1.5, 1.5)];
  for (const s of [-1, 1]) {
    nerves.push(polyline([[0, 286, -4], [s * 30, 282, -2], [s * 46, 226, -2], [s * 52, 170, 5], [s * 55, 150, 6]], 0, 3));   // arm nerves
    nerves.push(polyline([[0, 196, -6], [s * 15, 175, -4], [s * 19, 100, -2], [s * 21, 20, -3], [s * 20, 3, 18]], 0, 3));     // sciatic nerve
    for (let k = 0; k < 8; k++) nerves.push(polyline([[0, 275 - k * 8, -8], [s * 22, 270 - k * 8, 2], [s * 12, 266 - k * 8, 14]], 0, 2));   // intercostal nerves
  }
  const arteries = [vessel([[4, 250, 6], [2, 262, 2], [-2, 262, -4], [0, 240, -3], [0, 200, -2], [0, 190, 0]], 1.8, 1.4, 1.6)];
  const veins = [vessel([[-2, 250, 8], [-4, 270, 4], [-4, 240, 2], [-3, 200, 2], [-3, 190, 3]], 2, 1.6, 1.6)];
  for (const s of [-1, 1]) {
    arteries.push(polyline([[0, 262, 0], [s * 4, 300, 2], [s * 6, 318, 4]], 0, 4), polyline([[0, 262, 0], [s * 30, 281, 2], [s * 47, 225, 1], [s * 53, 168, 7], [s * 55, 152, 7]], 0, 4),
      polyline([[0, 190, 0], [s * 15, 178, 3], [s * 19, 100, 3], [s * 20, 22, 1], [s * 20, 4, 16]], 0, 4));
    veins.push(polyline([[-2, 262, 3], [s * 5, 300, 4], [s * 7, 318, 6]], 0, 4), polyline([[-2, 262, 3], [s * 31, 280, 4], [s * 49, 225, 3], [s * 55, 168, 9], [s * 57, 152, 9]], 0, 4),
      polyline([[-3, 190, 3], [s * 17, 178, 5], [s * 21, 100, 5], [s * 22, 22, 3], [s * 22, 4, 18]], 0, 4));
  }
  return [
    G('Skin', [1.0, 0.75, 0.62], [0, 0, 190], 0, skin(true), { info: 'largest organ: shields, senses, cools' }),
    G('Skin (back)', [1.0, 0.75, 0.62], [0, 0, -190], 0, skin(false), { showLabel: false }),
    G('Brain', [1.0, 0.5, 0.7], [0, 55, 100], 0.2, organs.brain, { info: 'control centre: 86 billion neurons' }),
    G('Lungs', [0.55, 0.75, 1.0], [0, 25, 110], 0.2, organs.lungs, { info: 'swap carbon dioxide for oxygen' }),
    G('Heart', [1.0, 0.25, 0.3], [0, 5, 135], 0.22, organs.heart, { info: 'pumps ~7,000 litres of blood a day' }),
    G('Liver', [0.8, 0.4, 0.25], [-35, -5, 115], 0.22, organs.liver, { info: '500+ jobs: filters, stores, makes bile' }),
    G('Stomach', [1.0, 0.65, 0.5], [35, -5, 115], 0.22, organs.stomach, { info: 'acid bath that starts digestion' }),
    G('Intestines', [1.0, 0.8, 0.55], [0, -25, 115], 0.24, organs.intestines, { info: '7 m that absorb the nutrients' }),
    G('Kidneys', [1.0, 0.55, 0.45], [0, -10, 85], 0.24, organs.kidneys, { info: 'filter the blood, make urine' }),
    G('Bladder', [1.0, 0.95, 0.5], [0, -40, 105], 0.24, organs.bladder, { info: 'stores ~0.5 L of urine' }),
    G('Nervous system', [1.0, 0.9, 0.3], [-140, 0, 0], 0.3, nerves, { info: 'brain, spinal cord and 72 km of nerves' }),
    G('Arteries', [1.0, 0.3, 0.25], [140, 0, 0], 0.3, arteries, { info: 'carry oxygen-rich blood away from the heart' }),
    G('Veins', [0.35, 0.5, 1.0], [270, 0, 0], 0.3, veins, { info: 'return blood to the heart' }),
    G('Skeleton', [0.95, 0.93, 0.85], [0, 0, -120], 0.35, bones, { info: '206 bones: frame, levers and blood factory' }),
  ];
}

export const BODY = [
  { name: 'Skeleton', groups: skeleton, color: [0.95, 0.93, 0.85], tilt: 4, viewYaw: 0.5, fact: '206 bones · the femur is the longest' },
  { name: 'Human Body', groups: humanBody, color: [1.0, 0.72, 0.6], tilt: 4, viewYaw: 0.55, fact: '11 organ systems · 37 trillion cells' },
];
