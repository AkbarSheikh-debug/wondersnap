// More explodable anatomy: lungs (they breathe), eye, ear, tooth, skull. Every labelled part says what it does.
import { line, polyline, tube, paramSurface, ellipsoid, revolve, orient, torus, ring, disc, quad, boxSurface, boxEdges, TAU } from '../lib/sampling.js';
import { add, sub, mul, norm, cross, linspace } from '../lib/vec.js';
import { makeRng } from '../lib/rng.js';
import { vessel, pathTube, dots } from '../lib/shapes.js';
import { G } from './engines.js';

const H = Math.PI / 2;
/** Rotate direction d by angle a around a random axis perpendicular to it. */
function turn(d, a, rng) {
  const ax = norm(cross(d, [rng.random() - 0.5, rng.random() - 0.5, rng.random() - 0.5]));
  return norm(add(mul(d, Math.cos(a)), mul(cross(ax, d), Math.sin(a))));
}
/** Recursive branching tree of tubes (bronchi, vessels); tips collected for alveoli. */
export function tree(out, tips, p, d, L, r, depth, rng, spread = 0.5, density = 1.3) {
  const q = add(p, mul(d, L));
  out.push(tube(p, q, r, r * 0.8, density));
  if (depth === 0) { tips.push(q); return; }
  for (const s of [-1, 1]) tree(out, tips, q, turn(d, spread * (0.8 + 0.4 * rng.random()) * s, rng), L * 0.74, r * 0.72, depth - 1, rng, spread, density);
}

// ============================================================ LUNGS  (x = patient's left, y up, z front; ~0.5 mm units)
function lungs() {
  const lung = (s) => (u, v) => {
    const cv = Math.cos(v), sv = Math.sin(v), taper = 1 - 0.38 * Math.max(0, sv);
    let x = 68 * cv * Math.cos(u) * taper;
    const z = 60 * cv * Math.sin(u) * taper;
    if (x * s < 0) x *= 0.42;                                          // flat medial side facing the heart
    return [s * 92 + x, 20 + 150 * sv * (sv < 0 ? 0.62 : 1), z];
  };
  const obl = (z) => 5 - 1.1 * z;                                      // oblique fissure
  const notch = (x, y, z) => x < 78 && z > 18 && y < 15 && y > -70;    // cardiac notch (left lung)
  const lobe = (s, keep) => [paramSurface(lung(s), 0, TAU, -H, H, { density: 0.5, gu: 44, gv: 30, keep })];
  const RU = lobe(-1, (x, y, z) => y > obl(z) && !(y < 35 && z > -20));
  const RM = lobe(-1, (x, y, z) => y > obl(z) && y < 35 && z > -20);
  const RL = lobe(-1, (x, y, z) => y <= obl(z));
  const LU = lobe(1, (x, y, z) => y > obl(z) && !notch(x, y, z));
  const LL = lobe(1, (x, y, z) => y <= obl(z) && !notch(x, y, z));
  const trachea = [tube([0, 235, 8], [0, 112, 4], 14, 13, 1.1), ellipsoid([0, 246, 10], [20, 14, 16], 1.2)];
  for (let y = 120; y <= 228; y += 11) trachea.push(orient(ring([0, 0, 0], 15, { density: 5 }), [0, 1, 0], [0, y, 6]));   // cartilage rings
  const rng = makeRng(5), bronchi = [], tips = [];
  for (const s of [-1, 1]) {
    bronchi.push(tube([0, 112, 4], [s * 55, 72, 0], 10, 8, 1.3));
    tree(bronchi, tips, [s * 55, 72, 0], norm([s * 0.45, -0.75, 0.1]), 48, 7, 5, rng);
    tree(bronchi, tips, [s * 55, 72, 0], norm([s * 0.35, 0.9, -0.1]), 40, 6, 4, rng);
  }
  const alveoli = [dots(tips.flatMap((p) => [0, 1, 2, 3].map(() => add(p, [rng.normal() * 5, rng.normal() * 5, rng.normal() * 5]))), 3.2, 1)];
  const art = [], vein = [], dump = [];
  for (const s of [-1, 1]) {
    art.push(vessel([[0, 128, 30], [s * 30, 100, 20], [s * 50, 82, 12]], 7, 6, 1.2));
    tree(art, dump, [s * 50, 82, 12], norm([s * 0.5, -0.7, 0.2]), 40, 4, 3, rng, 0.55);
    vein.push(vessel([[s * 20, 70, -15], [s * 45, 62, -12]], 6, 6, 1.2));
    tree(vein, dump, [s * 45, 62, -12], norm([s * 0.5, -0.6, -0.3]), 40, 4, 3, rng, 0.55);
  }
  const diaphragm = [paramSurface((r, u) => [175 * r * Math.cos(u), -118 + (52 + 10 * Math.cos(2 * u)) * (1 - r * r), 110 * r * Math.sin(u)], 0, 1, 0, TAU, { density: 0.45, gu: 16, gv: 40 })];
  const L1 = [0.55, 0.8, 1.0], L2 = [0.45, 0.65, 1.0], L3 = [0.7, 0.55, 1.0];
  return [
    G('Right upper lobe', L1, [-160, 90, 0], 0, RU, { info: 'right lung has 3 lobes: air in, oxygen out' }),
    G('Right middle lobe', L3, [-170, 0, 110], 0, RM, { info: 'smallest lobe, beside the heart' }),
    G('Right lower lobe', L2, [-160, -90, -60], 0, RL, { info: 'largest lobe: most of every breath' }),
    G('Left upper lobe', L1, [160, 90, 0], 0, LU, { info: 'only 2 lobes on the left: room for the heart' }),
    G('Left lower lobe', L2, [160, -90, -60], 0, LL, { info: 'the cardiac notch cradles the heart' }),
    G('Trachea (windpipe)', [0.95, 0.95, 1.0], [0, 170, 0], 0.05, trachea, { info: 'kept open by C-shaped cartilage rings' }),
    G('Bronchial tree', [1.0, 0.85, 0.4], [0, 20, 150], 0.25, bronchi, { info: 'airways branch ~23 times to the air sacs' }),
    G('Alveoli (air sacs)', [1.0, 0.55, 0.7], [0, -20, 230], 0.35, alveoli, { info: '~480 million sacs where oxygen enters blood' }),
    G('Pulmonary arteries', [0.35, 0.5, 1.0], [0, 40, -150], 0.3, art, { info: 'bring used, oxygen-poor blood in' }),
    G('Pulmonary veins', [1.0, 0.3, 0.3], [0, -40, -190], 0.3, vein, { info: 'carry fresh oxygen-rich blood out' }),
    G('Diaphragm', [1.0, 0.5, 0.45], [0, -180, 0], 0.05, diaphragm, { info: 'dome muscle: pulls down to breathe in' }),
  ];
}

// ============================================================ EYE  (0.1 mm units: eyeball 24 mm; the cornea faces +z)
function eye() {
  const ball = (r, keep, density) => paramSurface((u, v) => [r * Math.cos(v) * Math.cos(u), r * Math.sin(v), r * Math.cos(v) * Math.sin(u)], 0, TAU, -H, H, { density, keep, gu: 48, gv: 32 });
  const sclera = (s) => [ball(120, (x, y, z) => z < 100 && x * s >= 0, 0.5)];
  const th = linspace(Math.acos(0.8), H, 10);
  const cornea = [orient(revolve(th.map((t) => 80 * Math.sin(t)), th.map((t) => Math.max(80 * Math.cos(t), 0.5)), { density: 0.9 }), [0, 0, 1], [0, 0, 52]),
    orient(ring([0, 0, 0], 64, { density: 6 }), [0, 0, 1], [0, 0, 100])];
  const iris = [disc([0, 0, 100], 14, 60, [0, 0, 1], 1.2), orient(ring([0, 0, 0], 14, { density: 8 }), [0, 0, 1], [0, 0, 100.5])];
  for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; iris.push(line([16 * Math.cos(a), 16 * Math.sin(a), 100.6], [58 * Math.cos(a + 0.15), 58 * Math.sin(a + 0.15), 100.6], 0, 2.5)); }
  const lens = [ellipsoid([0, 0, 82], [46, 46, 22], 1.3)];
  const ciliary = [torus([0, 0, 86], 62, 7, [0, 0, 1], 1.2)];
  for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; ciliary.push(line([56 * Math.cos(a), 56 * Math.sin(a), 86], [46 * Math.cos(a), 46 * Math.sin(a), 82], 0, 3)); }   // zonules
  const vitreous = [ellipsoid([0, 0, -10], [108, 108, 96], 0.14)];
  const retina = [ball(114, (x, y, z) => z < 55, 0.55)];
  const d0 = norm([0.16, 0.05, -1]);
  for (let k = 0; k < 7; k++) {                                          // retinal blood vessels fanning out of the optic disc
    const a = (k / 7) * TAU, t = norm(cross(d0, [Math.cos(a), Math.sin(a), 0.2]));
    retina.push(polyline(linspace(0, 1.25, 26).map((s) => mul(norm(add(mul(d0, Math.cos(s)), mul(t, Math.sin(s) + 0.05 * Math.sin(9 * s)))), 113.5)), 0, 4));
  }
  retina.push(dots([mul(norm([-0.1, 0, -1]), 113)], 5, 1));             // macula (sharpest vision)
  const choroid = [ball(117, (x, y, z) => z < 70, 0.28)];
  const nerve = [vessel([[19, 6, -114], [30, 8, -190], [45, 12, -300]], 16, 15, 1.1)];
  const apex = [45, 12, -330], muscles = [];
  for (const [ix, iy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {           // four rectus muscles converge behind the eye
    const ins = [ix * 108, iy * 108, 40], side = [-iy * 13, ix * 13, 0];
    muscles.push(quad(add(ins, side), sub(ins, side), add(apex, mul(side, -0.3)), add(apex, mul(side, 0.3)), 0.9));
  }
  return [
    G('Cornea', [0.6, 0.9, 1.0], [0, 0, 190], 0, cornea, { info: 'clear window: does 2/3 of the focusing' }),
    G('Sclera', [0.95, 0.95, 1.0], [180, 0, -20], 0, sclera(1), { info: 'tough white outer wall' }),
    G('Sclera (L)', [0.95, 0.95, 1.0], [-180, 0, -20], 0, sclera(-1), { showLabel: false }),
    G('Iris & pupil', [0.35, 0.9, 0.55], [0, 0, 135], 0.05, iris, { info: 'muscle ring that sizes the pupil' }),
    G('Ciliary body & zonules', [1.0, 0.6, 0.4], [0, 0, 80], 0.1, ciliary, { info: 'pulls on the lens to focus' }),
    G('Lens', [1.0, 0.92, 0.5], [0, 0, 30], 0.12, lens, { info: 'changes shape: near and far focus' }),
    G('Vitreous humour', [0.5, 0.7, 1.0], [0, -170, 0], 0.2, vitreous, { info: 'clear gel that keeps the eye round' }),
    G('Choroid', [0.9, 0.35, 0.5], [0, 160, -40], 0.15, choroid, { info: 'blood vessels that feed the retina' }),
    G('Retina', [1.0, 0.55, 0.3], [0, 0, -90], 0.25, retina, { info: '~120 million rods & cones sense light' }),
    G('Optic nerve', [1.0, 0.9, 0.3], [0, 0, -160], 0.2, nerve, { info: '1.2 million fibres carry images to the brain' }),
    G('Eye muscles', [1.0, 0.3, 0.3], [-150, 150, -150], 0.1, muscles, { info: 'six muscles aim the eye' }),
  ];
}

// ============================================================ EAR  (schematic cross-section: sound travels along +x)
function ear() {
  const pinna = [paramSurface((a, w) => [-255 + 62 * w * Math.cos(a), 25 + 118 * w * Math.sin(a), -18 * w * w], -0.35 * Math.PI, 1.3 * Math.PI, 0.35, 1, { density: 0.6, gu: 40, gv: 10 }),
    polyline(linspace(-0.35 * Math.PI, 1.3 * Math.PI, 50).map((a) => [-255 + 64 * Math.cos(a), 25 + 121 * Math.sin(a), -19]), 0, 5),
    ellipsoid([-240, -85, -6], [24, 26, 8], 0.8), ellipsoid([-218, -5, -4], [18, 22, 8], 0.8)];              // lobule + concha
  const canal = [vessel([[-210, -5, 0], [-150, 5, 0], [-80, -4, 0], [-8, 0, 0]], 22, 17, 0.7)];
  const drum = [orient(revolve([0, 9], [26, 1], { density: 1.6 }), [1, 0, 0], [-6, 0, 0]), orient(ring([0, 0, 0], 26, { density: 6 }), [1, 0, 0], [-6, 0, 0])];
  const ossicles = [vessel([[0, 16, 0], [12, 32, 0], [20, 44, 2]], 4.5, 5.5, 2), ellipsoid([22, 47, 2], [8, 9, 7], 2),   // malleus
    ellipsoid([34, 45, 2], [9, 8, 7], 2), vessel([[36, 38, 2], [40, 20, 2], [46, 8, 2]], 3.5, 3, 2),               // incus
    polyline([[46, 8, 2], [56, 12, 6], [64, 6, 5]], 0, 6), polyline([[46, 8, 2], [56, 3, -3], [64, 6, -5]], 0, 6),   // stapes
    orient(disc([0, 0, 0], 0, 7, [0, 1, 0], 3), [1, 0, 0], [64, 6, 0])];
  const middle = [ellipsoid([32, 18, 0], [40, 44, 28], 0.14)];
  const eust = [vessel([[30, -18, 0], [55, -70, 20], [80, -150, 40]], 7, 6, 1.2)];
  const spiral = linspace(0, 1, 90).map((t) => { const a = t * 2.75 * TAU, r = 40 * (1 - t) + 8; return [105 + r * Math.cos(a), -20 + r * Math.sin(a), 22 * t]; });
  const cochlea = [...pathTube(spiral, 9, 1.1), polyline(spiral, 0, 5)];
  const canals = [torus([95, 74, -10], 26, 3.5, [1, 0, 0], 2.2), torus([80, 62, 8], 26, 3.5, [0, 1, 0], 2.2), torus([110, 62, 6], 26, 3.5, [0, 0, 1], 2.2), ellipsoid([88, 25, 0], [22, 20, 16], 0.9)];
  const nerve = [vessel([[118, -10, 0], [170, 15, -5], [260, 30, -15]], 9, 8, 1.3)];
  return [
    G('Outer ear (pinna)', [1.0, 0.72, 0.6], [-150, 0, 0], 0, pinna, { info: 'funnels sound into the ear canal' }),
    G('Ear canal', [1.0, 0.6, 0.5], [-80, -40, 0], 0.05, canal, { info: '2.5 cm tube that guides sound in' }),
    G('Eardrum', [1.0, 0.45, 0.6], [-20, 70, 0], 0.1, drum, { info: 'thin membrane that vibrates with sound' }),
    G('Ossicles (hammer, anvil, stirrup)', [1.0, 0.95, 0.7], [10, 130, 60], 0.2, ossicles, { info: 'tiniest bones: amplify vibration ~20x' }),
    G('Middle ear', [0.6, 0.7, 1.0], [0, -90, 0], 0.15, middle, { info: 'air-filled chamber behind the eardrum' }),
    G('Eustachian tube', [0.8, 0.6, 1.0], [0, -130, 70], 0.2, eust, { info: 'equalises pressure: the pop when you fly' }),
    G('Cochlea', [0.6, 1.0, 0.4], [90, -70, 0], 0.2, cochlea, { info: '15,000 hair cells turn sound into signals' }),
    G('Semicircular canals', [0.3, 0.9, 1.0], [90, 120, 0], 0.2, canals, { info: 'balance: sense how your head turns' }),
    G('Auditory nerve', [1.0, 0.85, 0.3], [150, 0, 0], 0.25, nerve, { info: 'sends sound and balance to the brain' }),
  ];
}

// ============================================================ TOOTH  (lower molar, 0.1 mm units)
function tooth() {
  const rad = (u) => 48 * (1 + 0.06 * Math.cos(4 * u));
  const sides = paramSurface((u, h) => { const r = rad(u) * (1 - 0.08 * h * h); return [r * Math.cos(u), 8 + h * 50, 0.9 * r * Math.sin(u)]; }, 0, TAU, 0, 1, { density: 0.8, gu: 40, gv: 10 });
  const top = paramSurface((u, s) => { const r = s * rad(u) * 0.92; return [r * Math.cos(u), 58 + (3 + 13 * Math.cos(2 * u) ** 2) * Math.sin(Math.PI * s) - 4 * (1 - s), 0.9 * r * Math.sin(u)]; }, 0, TAU, 0, 1, { density: 0.9, gu: 40, gv: 10 });
  const enamel = [sides, top];
  const dentin = [paramSurface((u, h) => { const r = rad(u) * 0.78; return [r * Math.cos(u), h * 58, 0.9 * r * Math.sin(u)]; }, 0, TAU, 0, 1, { density: 0.45, gu: 32, gv: 8 })];
  const roots = [], pulp = [ellipsoid([0, 26, 0], [26, 16, 22], 1.1)], nerves = [];
  for (const s of [-1, 1]) {
    roots.push(tube([s * 22, 6, 0], [s * 32, -150, 0], 24, 7, 0.8), ellipsoid([s * 32, -152, 0], [7, 5, 7], 1));
    dentin.push(tube([s * 20, 4, 0], [s * 31, -140, 0], 18, 5, 0.4));
    pulp.push(vessel([[s * 12, 16, 0], [s * 24, -60, 0], [s * 31, -140, 0]], 6, 2, 1.4));
    for (const [dz, dx] of [[-2, 0], [0, 1.5], [2, -1]]) nerves.push(polyline([[s * 10, 22, dz], [s * 24 + dx, -60, dz], [s * 31 + dx, -140, dz], [s * 34 + dx, -195, dz * 2]], 0, 5));
  }
  const gum = [paramSurface((u, t) => { const r = 56 + 8 * Math.sin(Math.PI * t); return [r * Math.cos(u), -12 + 24 * t, 0.92 * r * Math.sin(u)]; }, 0, TAU, 0, 1, { density: 0.9, gu: 40, gv: 6 })];
  const rng = makeRng(3), marrow = [];
  for (let i = 0; i < 400; i++) marrow.push([(rng.random() - 0.5) * 150, -175 + rng.random() * 160, (rng.random() - 0.5) * 110]);
  const bone = [boxSurface([0, -92, 0], [155, 166, 115], 0.22, (x, y, z) => !(y > -10 && Math.hypot(x, z) < 60)), boxEdges([0, -92, 0], [155, 166, 115], 0, 1.5),
    dots(marrow.filter(([x, , z]) => Math.min(Math.hypot(x - 28, z), Math.hypot(x + 28, z)) > 30), 2, 0.8)];
  return [
    G('Enamel', [0.9, 0.95, 1.0], [0, 150, 0], 0, enamel, { info: 'hardest substance in the body' }),
    G('Gum (gingiva)', [1.0, 0.5, 0.6], [0, 40, 140], 0, gum, { info: 'seals the tooth against germs' }),
    G('Jaw bone', [1.0, 0.9, 0.7], [0, -60, -180], 0, bone, { info: 'holds the roots in their sockets' }),
    G('Dentin', [1.0, 0.82, 0.45], [0, 75, 0], 0.15, dentin, { info: 'yellow layer that carries sensation' }),
    G('Cementum & roots', [0.85, 0.7, 0.5], [0, -80, 0], 0.15, roots, { info: 'bone-like coat that anchors the roots' }),
    G('Pulp', [1.0, 0.35, 0.4], [0, 30, 120], 0.3, pulp, { info: 'living core: why a deep cavity hurts' }),
    G('Nerves & blood vessels', [1.0, 0.9, 0.3], [0, -30, 180], 0.35, nerves, { info: 'feed the tooth through the root tips' }),
  ];
}

// ============================================================ SKULL  (mm; faces +x)
function skull() {
  const vault = (keep) => [paramSurface((u, v) => { const f = 1 + 0.02 * Math.sin(3 * u); return [96 * f * Math.cos(v) * Math.cos(u), 30 + 88 * Math.sin(v), 76 * f * Math.cos(v) * Math.sin(u)]; }, 0, TAU, -0.45, H, { density: 0.5, gu: 48, gv: 28, keep })];
  const orbit = (x, y, z) => Math.hypot(x - 70, y - 18, Math.abs(z) - 34) < 26;
  const calvaria = vault((x, y) => y > 72);
  const frontal = vault((x, y, z) => y <= 72 && x > 38 && !orbit(x, y, z));
  const occipital = vault((x, y) => y <= 72 && x < -45);
  const base = vault((x, y) => y <= 72 && x >= -45 && x <= 38);
  calvaria.push(polyline(linspace(0, TAU, 60).map((a) => [96 * 0.87 * Math.cos(a), 72, 76 * 0.87 * Math.sin(a)]), 0, 5));   // suture line
  for (const s of [-1, 1]) base.push(orient(ring([0, 0, 0], 8, { density: 6 }), [0, 0, 1], [-5, 0, s * 74]));                // ear openings
  const orbits = [];
  for (const s of [-1, 1]) orbits.push(torus([74, 18, s * 34], 20, 3, norm([1, 0, s * 0.25]), 2), orient(revolve([0, 36], [20, 6], { density: 0.7 }), norm([-1, 0, -s * 0.25]), [74, 18, s * 34]));
  const arch = (a, dx = 0) => [85 - 40 * a * a + dx, 0, 34 * a];
  const maxilla = [paramSurface((a, t) => { const p = arch(a); return [p[0] - 8 * t, -42 + 44 * t, p[2] * (1 + 0.3 * t)]; }, -1, 1, 0, 1, { density: 0.6, gu: 24, gv: 8 }),
    polyline([[92, 0, 0], [96, -14, 9], [90, -30, 11], [86, -34, 0], [90, -30, -11], [96, -14, -9], [92, 0, 0]], 0, 5)];            // nose opening
  for (const s of [-1, 1]) maxilla.push(vessel([[60, 0, s * 52], [30, -2, s * 68], [0, 2, s * 70]], 5, 4, 1.4));                   // cheekbones
  const upper = [], lower = [];
  for (const a of linspace(-0.95, 0.95, 14)) { const p = arch(a, -2); upper.push(ellipsoid([p[0], -48, p[2] * 1.05], [5, 7, 4], 1.4)); lower.push(ellipsoid([p[0] - 3, -58, p[2]], [5, 7, 4], 1.4)); }
  const jawPath = [[-6, -12, -66], [-10, -72, -58], [40, -78, -40], [92, -78, 0], [40, -78, 40], [-10, -72, 58], [-6, -12, 66]];
  const mandible = [vessel(jawPath, 9, 9, 1.1), vessel([[-8, -40, -62], [12, -18, -56]], 4, 3, 1.4), vessel([[-8, -40, 62], [12, -18, 56]], 4, 3, 1.4)];
  return [
    G('Skull cap (calvaria)', [0.95, 0.92, 0.82], [0, 150, 0], 0, calvaria, { info: 'fused plates that protect the brain' }),
    G('Frontal bone', [1.0, 0.85, 0.6], [120, 60, 0], 0.05, frontal, { info: 'forehead and roof of the eye sockets' }),
    G('Occipital bone', [0.8, 0.85, 1.0], [-150, 20, 0], 0.05, occipital, { info: 'back of the skull: the spinal cord exits here' }),
    G('Cranial base & temporal bones', [0.75, 0.8, 0.95], [0, -10, 0], 0, base, { info: 'floor under the brain; houses the ears' }),
    G('Eye sockets (orbits)', [0.5, 0.9, 1.0], [80, 20, 0], 0.15, orbits, { info: 'bony cones that protect the eyes' }),
    G('Maxilla & cheekbones', [1.0, 0.7, 0.5], [100, -50, 0], 0.1, maxilla, { info: 'upper jaw, nose and cheeks' }),
    G('Teeth', [1.0, 1.0, 1.0], [130, -80, 0], 0.25, upper, { info: '32 in adults: cut, tear and grind' }),
    G('Teeth (lower)', [1.0, 1.0, 1.0], [110, -140, 0], 0.25, lower, { showLabel: false }),
    G('Mandible (jaw)', [1.0, 0.8, 0.45], [60, -180, 0], 0.1, mandible, { info: 'the only movable skull bone: chew & talk' }),
  ];
}

export const ANATOMY2 = [
  { name: 'Lungs', groups: lungs, color: [0.55, 0.75, 1.0], tilt: 8, viewYaw: 0.5, breath: { period: 4.5, amp: 0.06 }, fact: '~480 million alveoli · 70 m² of gas-exchange surface' },
  { name: 'Human Eye', groups: eye, color: [0.55, 0.9, 1.0], tilt: 10, viewYaw: 0.9, fact: '24 mm · 120 million rods · 6 million cones' },
  { name: 'Human Ear', groups: ear, color: [1.0, 0.75, 0.55], tilt: 5, viewYaw: 0.35, fact: 'hears 20-20,000 Hz · smallest bones in the body' },
  { name: 'Tooth (Molar)', groups: tooth, color: [0.92, 0.95, 1.0], tilt: 15, viewYaw: 0.6, fact: 'enamel, dentin, pulp · anchored by 2 roots' },
  { name: 'Skull', groups: skull, color: [0.95, 0.9, 0.8], tilt: 8, viewYaw: 0.7, fact: '22 bones · only the jaw moves' },
];
