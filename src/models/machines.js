// More explodable machines: motorcycle, airliner, Saturn V rocket (vehicles) + mechanical wristwatch and EV battery pack.
import {
  line, polyline, quad, tri, box, boxSurface, boxEdges, revolve, cylinder, ring, orient, tube, disc, paramSurface, torus, helix, gear, TAU,
} from '../lib/sampling.js';
import { add, mul, norm, linspace } from '../lib/vec.js';
import { vessel, pathTube, blob, dots } from '../lib/shapes.js';
import { G, COL } from './engines.js';

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const revX = (xs, rs, opts = {}) => orient(revolve(xs, rs, opts), X, [0, 0, 0]);
// after orienting +y onto +x, the local angle a maps to world (y, z) = (-r cos a, r sin a)
const UPPER = { a0: Math.PI / 2, a1: (3 * Math.PI) / 2 }, LOWER = { a0: -Math.PI / 2, a1: Math.PI / 2 };
const FRONT = { a0: 0, a1: Math.PI }, BACK = { a0: Math.PI, a1: TAU };          // revolve around y: z = r sin a

// ============================================================ MOTORCYCLE (cm, x forward)
function motorcycle() {
  const wheel = (cx) => {
    const P = [orient(revolve([-7, -7, -5, 5, 7, 7], [24, 29, 32, 32, 29, 24], { density: 0.5 }), Z, [cx, 32, 0]),
      orient(ring([0, 0, 0], 24, { density: 4 }), Z, [cx, 32, 6]), orient(ring([0, 0, 0], 24, { density: 4 }), Z, [cx, 32, -6]), disc([cx, 32, 0], 0, 5, Z, 1.5)];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; P.push(line([cx + 4 * Math.cos(a), 32 + 4 * Math.sin(a), k % 2 ? 4 : -4], [cx + 24 * Math.cos(a + 0.2), 32 + 24 * Math.sin(a + 0.2), 0], 0, 3)); }
    return P;
  };
  const brake = (cx) => [disc([cx, 32, 9], 4, 15, Z, 1.4), torus([cx, 32, 9], 15, 0.6, Z, 3), box([cx - 11, 44, 9], [6, 8, 4], 1.2, 3)];
  const fork = [tube([58, 96, 8], [72, 32, 8], 2.6, 2.4, 1.5), tube([58, 96, -8], [72, 32, -8], 2.6, 2.4, 1.5), box([58, 96, 0], [8, 3, 22], 1, 3), box([61, 86, 0], [8, 3, 22], 1, 3),
    vessel([[52, 106, -36], [56, 104, -20], [57, 102, 0], [56, 104, 20], [52, 106, 36]], 1.6, 1.6, 2), tube([52, 106, 30], [51, 106.5, 42], 2.3, 2.3, 2), tube([52, 106, -30], [51, 106.5, -42], 2.3, 2.3, 2)];
  const frame = [];
  for (const s of [-1, 1]) {
    frame.push(vessel([[57, 94, 0], [20, 88, s * 9], [-30, 80, s * 9], [-62, 78, s * 8]], 1.6, 1.6, 1.4), vessel([[57, 92, 0], [30, 50, s * 7], [10, 36, s * 7], [-20, 42, s * 8]], 1.6, 1.6, 1.4));
    for (const [a, b] of [[[20, 88, s * 9], [30, 50, s * 7]], [[-5, 84, s * 9], [10, 36, s * 7]], [[-30, 80, s * 9], [-20, 42, s * 8]], [[-30, 80, s * 9], [-62, 78, s * 8]]]) frame.push(tube(a, b, 1.2, 1.2, 1.4));
  }
  const engine = [blob([0, 45, 0], [22, 17, 13], { density: 0.8 })];
  for (const d of [norm([0.55, 0.83, 0]), norm([-0.55, 0.83, 0])]) {
    const base = add([0, 52, 0], mul(d, 6));
    engine.push(orient(cylinder([0, 0, 0], 9, 26, { density: 0.8 }), d, base));
    for (let k = 3; k < 26; k += 3.5) engine.push(orient(ring([0, 0, 0], 12, { density: 2.5 }), d, add(base, mul(d, k))));
    engine.push(orient(box([0, 30, 0], [22, 8, 20], 0.8, 3), d, base));
  }
  const tank = [blob([22, 92, 0], [26, 11, 15], { density: 1, bump: (u, v) => 1 + 0.12 * Math.max(0, Math.sin(v)) }), orient(ring([0, 0, 0], 3.5, { density: 6 }), Y, [22, 103.5, 0])];
  const seat = [blob([-32, 84, 0], [30, 5, 13], { density: 1 })];
  const swing = [tube([-20, 42, 8], [-72, 32, 8], 2.5, 2, 1.4), tube([-20, 42, -8], [-72, 32, -8], 2.5, 2, 1.4), tube([-35, 39, -8], [-35, 39, 8], 1.5, 1.5, 1.4),
    tube([-12, 78, 0], [-40, 48, 0], 2.5, 2.5, 1.4), helix([-12, 78, 0], 4.5, 30, 7, norm([-28, -30, 0]), 3)];
  const exhaust = [vessel([[12, 72, 6], [22, 52, 14], [4, 32, 16], [-40, 36, 16], [-60, 44, 17]], 3, 3, 1.3), vessel([[-8, 72, 6], [-2, 50, 12], [-20, 34, 14]], 3, 3, 1.3), tube([-50, 44, 17], [-92, 50, 17], 6, 5, 0.9)];
  const chain = [gear([-8, 38, 11], 6, 12, { axis: Z, width: 2, density: 2 }), gear([-72, 32, 11], 12, 28, { axis: Z, width: 2, density: 2 })];
  const loop = [...linspace(-Math.PI / 2, Math.PI / 2, 12).map((a) => [-8 + 6.5 * Math.cos(a), 38 + 6.5 * Math.sin(a), 12]), ...linspace(Math.PI / 2, 1.5 * Math.PI, 16).map((a) => [-72 + 12.5 * Math.cos(a), 32 + 12.5 * Math.sin(a), 12])];
  chain.push(polyline(loop, 0, 5, true));
  const lights = [blob([68, 92, 0], [5, 9, 9], { density: 1.5 }), orient(ring([0, 0, 0], 9, { density: 8 }), X, [73, 92, 0]), box([56, 110, 0], [6, 5, 14], 1.2, 3), box([-92, 72, 0], [3, 4, 10], 1.5, 3)];
  const fenders = [paramSurface((a, w) => [72 + 36 * Math.cos(a), 32 + 36 * Math.sin(a), w * 9], 0.25, 2.2, -1, 1, { density: 0.8, gu: 20, gv: 4 }),
    paramSurface((a, w) => [-72 + 36 * Math.cos(a), 32 + 36 * Math.sin(a), w * 10], 0.9, 2.8, -1, 1, { density: 0.8, gu: 20, gv: 4 })];
  const radiator = [box([44, 62, 0], [3, 24, 28], 0.8, 3)];
  for (let y = 52; y <= 72; y += 4) radiator.push(line([45.6, y, -13], [45.6, y, 13], 0, 2));
  return [
    G('Front wheel', COL.white, [85, -15, 0], 0.1, wheel(72), { info: 'tyre, spoked rim and hub' }),
    G('Rear wheel', COL.white, [-95, -15, 0], 0.1, wheel(-72), { info: 'the chain drives this wheel' }),
    G('Disc brakes', COL.red, [70, 0, 45], 0.15, brake(72), { info: 'calipers squeeze steel discs to stop' }),
    G('Disc brakes (L)', COL.red, [-80, 0, 45], 0.15, brake(-72), { showLabel: false }),
    G('Front fork & handlebar', COL.silver, [45, 60, 0], 0.05, fork, { info: 'steers and soaks up bumps' }),
    G('Fuel tank', [1.0, 0.3, 0.25], [10, 85, 0], 0, tank, { info: '~17 litres of petrol' }),
    G('Seat', COL.purple, [-25, 80, 0], 0, seat, { info: 'foam saddle over the rear frame' }),
    G('V-twin engine', COL.orange, [0, -60, 85], 0.15, engine, { info: 'two cylinders in a 45 degree V' }),
    G('Frame', COL.steel, [0, 15, -95], 0.25, frame, { info: 'steel trellis that holds everything' }),
    G('Swingarm & rear shock', COL.lime, [-50, -30, -60], 0.15, swing, { info: 'lets the rear wheel ride over bumps' }),
    G('Exhaust', COL.amber, [0, -30, 95], 0.1, exhaust, { info: 'carries hot gases out, muffles noise' }),
    G('Chain & sprockets', COL.gold, [-30, -45, 75], 0.2, chain, { info: 'carry engine power to the rear wheel' }),
    G('Headlight & dash', COL.ice, [80, 55, 0], 0, lights, { info: 'lights and speedometer' }),
    G('Fenders', COL.teal, [0, 50, 75], 0, fenders, { info: 'keep water and mud off' }),
    G('Radiator', COL.cyan, [60, 5, 60], 0.1, radiator, { info: 'cools the engine' }),
  ];
}

// ============================================================ AIRLINER (0.1 m units, nose at +x)
function airliner() {
  const xs = [-188, -170, -130, 100, 125, 150, 170, 185, 188], rs = [3, 9, 20, 20, 19, 16, 11, 5, 0.5];
  const upper = [revX(xs, rs, { density: 0.3, ...UPPER }), dots(linspace(-110, 100, 44).flatMap((x) => [[x, 7, 19.6], [x, 7, -19.6]]), 1.1, 1.5),
    polyline([[168, 5, 9], [176, 5, 6], [178, 5, 0], [176, 5, -6], [168, 5, -9]], 0, 6)];
  const lower = [revX(xs, rs, { density: 0.3, ...LOWER })];
  const cabin = [quad([-120, -6, -18], [110, -6, -18], [110, -6, 18], [-120, -6, 18], 0.1)];
  for (let x = -110; x <= 95; x += 7.5) for (const z of [-15, -10.5, -6, 6, 10.5, 15]) cabin.push(boxSurface([x, -2.5, z], [4, 7, 4], 0.35, null, false, true));
  const wingF = (s, c0, c1) => [0, 1].map((top) => paramSurface((t, c) => {
    const xle = 40 - 70 * t, xte = -25 - 22 * t, y = -10 + 12 * t + (top ? 1 : -1) * 2.5 * (1 - 0.6 * t) * Math.sin(Math.PI * c);
    return [xle + (xte - xle) * c, y, s * (18 + 152 * t)];
  }, 0, 1, c0, c1, { density: 0.5, gu: 24, gv: 6 }));
  const wing = (s) => [wingF(s, 0, 0.8), polyline(linspace(0, 1, 12).map((t) => [40 - 70 * t, -10 + 12 * t, s * (18 + 152 * t)]), 0, 4),
    tri([-30, 2, s * 170], [-47, 2, s * 170], [-44, 20, s * 173], 1)];                                    // winglet
  const flaps = (s) => [wingF(s, 0.8, 1), polyline(linspace(0, 1, 12).map((t) => [-25 - 22 * t, -10 + 12 * t, s * (18 + 152 * t)]), 0, 4)];
  const engine = (s) => {
    const c = [5, -26, s * 60], P = [orient(revolve([0, 40], [11, 9], { density: 0.8 }), X, c), torus(add(c, [40, 0, 0]), 10.5, 1, X, 3), disc(add(c, [37, 0, 0]), 2, 10, X, 1)];
    for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; P.push(line(add(c, [37, 2 * Math.cos(a), 2 * Math.sin(a)]), add(c, [37, 10 * Math.cos(a + 0.3), 10 * Math.sin(a + 0.3)]), 0, 3)); }
    P.push(quad(add(c, [10, 11, 0]), add(c, [36, 11, 0]), add(c, [40, 18, 0]), add(c, [6, 18, 0]), 1));  // pylon
    return P;
  };
  const fin = [quad([-150, 18, 0], [-120, 18, 0], [-165, 78, 0], [-182, 78, 0], 0.8), polyline([[-150, 18, 0], [-120, 18, 0], [-165, 78, 0], [-182, 78, 0]], 0, 4, true)];
  const stab = (s) => [quad([-150, 10, s * 8], [-130, 10, s * 8], [-160, 14, s * 62], [-172, 14, s * 62], 0.8), polyline([[-150, 10, s * 8], [-130, 10, s * 8], [-160, 14, s * 62], [-172, 14, s * 62]], 0, 4, true)];
  const gearP = [tube([150, -18, 0], [150, -40, 0], 1.5, 1.5, 2), torus([150, -42, 3], 4, 1.5, Z, 2), torus([150, -42, -3], 4, 1.5, Z, 2)];
  for (const s of [-1, 1]) gearP.push(tube([-5, -12, s * 20], [-5, -40, s * 20], 2, 2, 2), torus([-5, -42, s * 16], 6, 2, Z, 2), torus([-5, -42, s * 24], 6, 2, Z, 2));
  return [
    G('Fuselage', [0.9, 0.93, 1.0], [0, 95, 0], 0, upper, { info: 'pressurised tube with the cabin inside' }),
    G('Fuselage (lower)', [0.9, 0.93, 1.0], [0, -95, 0], 0, lower, { showLabel: false }),
    G('Cabin & seats', COL.purple, [0, 0, 0], 0.3, cabin, { info: 'room for up to 180 passengers' }),
    G('Wings', COL.steel, [0, 15, 115], 0.1, wing(1), { info: 'make the lift; fuel is stored inside' }),
    G('Wings (L)', COL.steel, [0, 15, -115], 0.1, wing(-1), { showLabel: false }),
    G('Flaps & ailerons', COL.cyan, [-25, 25, 160], 0.15, flaps(1), { info: 'extend for landing, roll the plane' }),
    G('Flaps & ailerons (L)', COL.cyan, [-25, 25, -160], 0.15, flaps(-1), { showLabel: false }),
    G('Engines (turbofans)', COL.orange, [30, -80, 55], 0.15, engine(1), { info: 'each pushes with ~120 kN of thrust' }),
    G('Engines (L)', COL.orange, [30, -80, -55], 0.15, engine(-1), { showLabel: false }),
    G('Vertical tail & rudder', COL.red, [-60, 90, 0], 0.1, fin, { info: 'keeps it straight; the rudder yaws' }),
    G('Horizontal stabilisers', COL.lime, [-60, 40, 85], 0.1, stab(1), { info: 'elevators pitch the nose up and down' }),
    G('Horizontal stabilisers (L)', COL.lime, [-60, 40, -85], 0.1, stab(-1), { showLabel: false }),
    G('Landing gear', COL.gold, [0, -130, 0], 0.2, gearP, { info: 'folds up into the belly after take-off' }),
  ];
}

// ============================================================ SATURN V (0.25 m units, y up)
function saturnV() {
  const shell = (y0, y1, r, half) => [revolve([y0, y1], [r, r], { density: 0.35, ...half }), revolve([y0, y0], [r + 0.3, r], { density: 3, ...half }), revolve([y1, y1], [r + 0.3, r], { density: 3, ...half })];
  const tank = (y0, y1, r, d = 1) => revolve([y0 - 9, y0 - 6, y0, y1, y1 + 6, y1 + 9], [0.5, r * 0.72, r, r, r * 0.72, 0.5], { density: d });
  const bell = (c, s = 1) => [revolve([-30, -20, -10, -3, 0].map((y) => c[1] + y * s), [10, 7.5, 5, 3.5, 3].map((r) => r * s), { center: [c[0], 0, c[2]], density: 1 }), ring([c[0], c[1] - 30 * s, c[2]], 10 * s, { density: 5 })];
  const F1 = [], J2 = [];
  for (const [x, z] of [[0, 0], [11, 11], [-11, 11], [11, -11], [-11, -11]]) { F1.push(bell([x, 0, z])); J2.push(bell([x * 0.9, 176, z * 0.9], 0.45)); }
  const fins = [];
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2, d = [Math.cos(a), 0, Math.sin(a)]; fins.push(quad(add(mul(d, 20), [0, 25, 0]), add(mul(d, 30), [0, 5, 0]), add(mul(d, 30), [0, -4, 0]), add(mul(d, 20), [0, 0, 0]), 1)); }
  const s4 = [revolve([268, 280], [20, 16.5], { density: 0.4, ...FRONT }), ...shell(280, 350, 16.5, FRONT)];
  const s4b = [revolve([268, 280], [20, 16.5], { density: 0.4, ...BACK }), ...shell(280, 350, 16.5, BACK)];
  const lm = [blob([0, 368, 0], [8, 6, 8], { density: 1.5 }), ...[0, 1, 2, 3].map((k) => { const a = (k / 4) * TAU + 0.78; return line([0, 366, 0], [11 * Math.cos(a), 358, 11 * Math.sin(a)], 0, 4); })];
  const sla = (half) => [revolve([355, 390], [16.5, 10], { density: 0.45, ...half })];
  const sm = [revolve([390, 408], [10, 10], { density: 0.8 }), revolve([385, 392], [5, 2], { density: 1.5 }), ...[0, 1, 2, 3].map((k) => box([10.5 * Math.cos((k * TAU) / 4), 404, 10.5 * Math.sin((k * TAU) / 4)], [2, 3, 2], 1.5, 3))];
  const cm = [revolve([408, 421], [10, 2], { density: 1.2 }), revolve([408, 408], [10, 0.5], { density: 1 }), ring([0, 408, 0], 10, { density: 6 })];
  const les = [tube([0, 432, 0], [0, 446, 0], 2.5, 2.5, 1.5), revolve([446, 452], [2.5, 0.3], { density: 2 })];
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.78; les.push(line([3 * Math.cos(a), 421, 3 * Math.sin(a)], [1.5 * Math.cos(a), 432, 1.5 * Math.sin(a)], 0, 4)); }
  const IU = [revolve([350, 355], [16.8, 16.8], { density: 2.5 })];
  const W = [0.95, 0.95, 1.0];
  return [
    G('Launch escape tower', COL.red, [0, 290, 0], 0, les, { info: 'rocket that yanks the crew to safety' }),
    G('Command module', COL.silver, [0, 235, 0], 0.02, cm, { info: 'crew capsule: the only part that came home' }),
    G('Service module', COL.steel, [0, 190, 0], 0.04, sm, { info: 'power, oxygen and the main engine' }),
    G('Lunar module', COL.gold, [70, 150, 0], 0.08, lm, { info: 'landed two astronauts on the Moon' }),
    G('Spacecraft adapter', COL.ice, [0, 140, 70], 0.06, sla(FRONT), { info: 'panels opened like petals to free the LM' }),
    G('Spacecraft adapter (back)', COL.ice, [0, 140, -70], 0.06, sla(BACK), { showLabel: false }),
    G('Instrument unit', COL.cyan, [0, 112, 0], 0.1, IU, { info: 'ring holding the guidance computer' }),
    G('Third stage (S-IVB)', W, [0, 90, 60], 0.1, s4, { info: 'fired twice: to orbit, then to the Moon' }),
    G('Third stage (back)', W, [0, 90, -60], 0.1, s4b, { showLabel: false }),
    G('Third-stage tanks', COL.teal, [0, 80, 0], 0.15, [tank(300, 345, 15), tank(286, 294, 15), bell([0, 280, 0], 0.4)], { info: 'liquid hydrogen + liquid oxygen, one J-2' }),
    G('Second stage (S-II)', W, [0, 40, 65], 0.1, shell(168, 268, 20, FRONT), { info: 'five engines, burned for 6 minutes' }),
    G('Second stage (back)', W, [0, 40, -65], 0.1, shell(168, 268, 20, BACK), { showLabel: false }),
    G('Second-stage tanks', COL.cyan, [0, 30, 0], 0.15, [tank(206, 260, 18), tank(184, 196, 18)], { info: 'hydrogen chilled to -253 degrees C' }),
    G('J-2 engines', COL.amber, [0, 5, 0], 0.2, J2, { info: 'hydrogen-burning upper-stage engines' }),
    G('First stage (S-IC)', W, [0, -30, 75], 0.1, [...shell(0, 168, 20, FRONT), fins], { info: '35,000 kN of thrust at lift-off' }),
    G('First stage (back)', W, [0, -30, -75], 0.1, shell(0, 168, 20, BACK), { showLabel: false }),
    G('First-stage tanks', COL.orange, [0, -40, 0], 0.15, [tank(20, 62, 18), tank(78, 158, 18)], { info: 'kerosene (RP-1) and liquid oxygen' }),
    G('F-1 engines', [1.0, 0.55, 0.2], [0, -120, 0], 0.2, F1, { info: 'most powerful single-nozzle engines ever flown' }),
  ];
}

// ============================================================ MECHANICAL WRISTWATCH (0.1 mm units, the dial faces +z)
function wristwatch() {
  const cz = (parts, z) => orient(parts, Z, [0, 0, z]);
  const caseP = [cz(revolve([0, 70], [200, 200], { density: 0.6 }), -40), cz(ring([0, 0, 0], 200, { density: 5 }), 30), cz(ring([0, 0, 0], 200, { density: 5 }), -40)];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) caseP.push(box([sx * 120, sy * 215, -5], [40, 60, 40], 0.7, 3));
  const bezel = [cz(revolve([0, 12], [205, 190], { density: 0.9 }), 30)];
  for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; bezel.push(line([192 * Math.cos(a), 192 * Math.sin(a), 42], [204 * Math.cos(a), 204 * Math.sin(a), 42], 0, k % 5 ? 1 : 3)); }
  const th = linspace(0, Math.PI / 2, 10);
  const crystal = [cz(revolve(th.map((t) => 22 * Math.sin(t)), th.map((t) => Math.max(188 * Math.cos(t), 0.5)), { density: 0.25 }), 42)];
  const dial = [disc([0, 0, 20], 0, 186, Z, 0.7), orient(ring([0, 0, 0], 35, { density: 4 }), Z, [0, -95, 21])];
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * TAU, u = [Math.cos(a), Math.sin(a), 0], v = [-Math.sin(a), Math.cos(a), 0];
    dial.push(quad(add(mul(u, 148), add(mul(v, -4), [0, 0, 21])), add(mul(u, 178), add(mul(v, -4), [0, 0, 21])), add(mul(u, 178), add(mul(v, 4), [0, 0, 21])), add(mul(u, 148), add(mul(v, 4), [0, 0, 21])), 3));
  }
  for (let m = 0; m < 60; m++) { const a = (m / 60) * TAU; dial.push(line([176 * Math.cos(a), 176 * Math.sin(a), 21], [183 * Math.cos(a), 183 * Math.sin(a), 21], 0, 2)); }
  const hand = (ang, len, w, z) => {
    const u = [Math.cos(ang), Math.sin(ang), 0], v = [-Math.sin(ang), Math.cos(ang), 0];
    return quad(add(mul(v, -w), [0, 0, z]), add(mul(u, len), add(mul(v, -w * 0.3), [0, 0, z])), add(mul(u, len), add(mul(v, w * 0.3), [0, 0, z])), add(mul(v, w), [0, 0, z]), 2.5);
  };
  const hands = [hand(Math.PI / 6, 100, 7, 26), hand((5 * Math.PI) / 6, 165, 5, 28), line([-30 * Math.cos(-1.2), -30 * Math.sin(-1.2), 30], [175 * Math.cos(-1.2), 175 * Math.sin(-1.2), 30], 0, 6), disc([0, 0, 31], 0, 8, Z, 3)];
  const plate = [disc([0, 0, -30], 12, 180, Z, 0.35), cz(ring([0, 0, 0], 180, { density: 4 }), -30)];
  const spiral = (c, r0, r1, turns, z) => polyline(linspace(0, 1, Math.round(turns * 30)).map((t) => [c[0] + (r0 + (r1 - r0) * t) * Math.cos(t * turns * TAU), c[1] + (r0 + (r1 - r0) * t) * Math.sin(t * turns * TAU), z]), 0, 3);
  const barrel = [gear([-65, 60, -26], 55, 60, { axis: Z, width: 10, density: 1 }), spiral([-65, 60], 10, 48, 6, -16)];
  const train = [gear([0, 0, -18], 45, 70, { axis: Z, width: 5, density: 1 }), gear([62, -40, -20], 34, 60, { axis: Z, width: 5, density: 1 }), gear([5, -95, -22], 30, 56, { axis: Z, width: 5, density: 1 }),
    gear([62, -40, -14], 7, 8, { axis: Z, width: 4, density: 2 }), gear([5, -95, -16], 7, 8, { axis: Z, width: 4, density: 2 })];
  const escape = [gear([72, -110, -22], 18, 15, { axis: Z, width: 4, depth: 6, density: 1.5 }),
    polyline([[95, -150, -18], [88, -125, -18], [80, -130, -18], [88, -125, -18], [100, -115, -18], [88, -125, -18], [110, -110, -18]], 0, 6), dots([[80, -130, -18], [100, -115, -18]], 2, 2)];
  const balance = [torus([95, 70, -12], 45, 3, Z, 1.6), spiral([95, 70], 4, 28, 8, -8), line([95, 70, -26], [95, 70, 2], 0, 4)];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; balance.push(line([95, 70, -12], [95 + 44 * Math.cos(a), 70 + 44 * Math.sin(a), -12], 0, 4)); }
  const bridges = [quad([-120, 10, 0], [-10, 10, 0], [-10, 120, 0], [-120, 120, 0], 0.5), quad([-30, -130, 0], [100, -10, 0], [80, 10, 0], [-45, -110, 0], 0.5), tri([95, 125, 0], [150, 40, 0], [60, 40, 0], 0.5),
    polyline([[-120, 10, 0], [-10, 10, 0], [-10, 120, 0], [-120, 120, 0]], 0, 3, true), polyline([[-30, -130, 0], [100, -10, 0], [80, 10, 0], [-45, -110, 0]], 0, 3, true), polyline([[95, 125, 0], [150, 40, 0], [60, 40, 0]], 0, 3, true)];
  const jewels = [dots([[-65, 60, 3], [0, 0, 3], [62, -40, 3], [5, -95, 3], [72, -110, 3], [95, -125, 3], [95, 70, 3]], 3, 3)];
  const rotor = [paramSurface((r, a) => [r * 170 * Math.cos(a), r * 170 * Math.sin(a), -50], 0.2, 1, 0, Math.PI, { density: 0.6, gu: 8, gv: 30 }), cz(ring([0, 0, 0], 20, { density: 6 }), -50)];
  const back = [disc([0, 0, -62], 0, 195, Z, 0.35), cz(ring([0, 0, 0], 120, { density: 6 }), -62)];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; back.push(line([180 * Math.cos(a), 180 * Math.sin(a), -62], [195 * Math.cos(a), 195 * Math.sin(a), -62], 0, 5)); }
  const crown = [orient(revolve([0, 34], [18, 18], { density: 1 }), X, [200, 0, 0]), tube([170, 0, -10], [200, 0, 0], 3, 3, 2)];
  for (let k = 0; k < 8; k++) crown.push(orient(ring([0, 0, 0], 18.5, { density: 4 }), X, [204 + k * 3.5, 0, 0]));
  const strap = (s) => [paramSurface((t, w) => [w * 95, s * (235 + 320 * t), -30 - 90 * t * t], 0, 1, -1, 1, { density: 0.45, gu: 20, gv: 6 }),
    ...(s < 0 ? [dots(linspace(0.3, 0.8, 6).map((t) => [0, -(235 + 320 * t), -30 - 90 * t * t + 1]), 3, 2)] : [])];
  return [
    G('Sapphire crystal', COL.ice, [0, 0, 470], 0, crystal, { info: 'scratch-proof sapphire glass' }),
    G('Bezel', COL.gold, [0, 0, 390], 0.02, bezel, { info: 'rotating ring to time events' }),
    G('Hands', COL.white, [0, 0, 310], 0.05, hands, { info: 'hour, minute and seconds' }),
    G('Dial', [0.4, 0.55, 1.0], [0, 0, 230], 0.08, dial, { info: 'the face with its hour markers' }),
    G('Bridges', COL.silver, [0, 0, 155], 0.15, bridges, { info: 'plates that hold the gear pivots' }),
    G('Jewels (rubies)', COL.red, [0, 0, 180], 0.17, jewels, { info: 'synthetic rubies: friction-free bearings' }),
    G('Balance wheel & hairspring', COL.cyan, [70, 50, 110], 0.25, balance, { info: 'the heartbeat: swings 8 times a second' }),
    G('Escapement', COL.pink, [80, -70, 90], 0.27, escape, { info: 'lets the gears advance one tick at a time' }),
    G('Gear train', COL.amber, [0, -20, 60], 0.3, train, { info: 'steps the power down to drive the hands' }),
    G('Mainspring barrel', COL.lime, [-90, 45, 40], 0.3, barrel, { info: 'coiled spring storing ~40 h of power' }),
    G('Main plate', COL.steel, [0, 0, -90], 0.2, plate, { info: 'foundation of the movement' }),
    G('Winding rotor', COL.orange, [0, 0, -200], 0.1, rotor, { info: 'your wrist motion winds the spring' }),
    G('Case back', COL.silver, [0, 0, -310], 0, back, { info: 'screw-down back with a see-through window' }),
    G('Case & lugs', [0.85, 0.88, 0.95], [0, 0, 0], 0, caseP, { info: 'steel case that seals out water' }),
    G('Crown & stem', COL.gold, [150, 0, 0], 0, crown, { info: 'wind the watch and set the time' }),
    G('Strap', [0.9, 0.55, 0.35], [0, 170, -40], 0, strap(1), { info: 'leather strap' }),
    G('Strap (L)', [0.9, 0.55, 0.35], [0, -170, -40], 0, strap(-1), { showLabel: false }),
  ];
}

// ============================================================ EV BATTERY PACK (cm)
function batteryPack() {
  const tray = [boxSurface([0, 5, 0], [200, 10, 140], 0.3, null, true, false), boxEdges([0, 5, 0], [200, 10, 140], 0, 2)];
  for (const z of [-70, 70]) tray.push(tube([-100, 10, z], [100, 10, z], 1.5, 1.5, 1.5));
  for (const x of [-100, 100]) tray.push(tube([x, 10, -70], [x, 10, 70], 1.5, 1.5, 1.5));
  const modules = [], busbars = [];
  let first = true;
  for (const mx of [-72, -24, 24, 72]) for (const mz of [-34, 34]) {
    const P = [boxSurface([mx, 7, mz], [44, 9, 30], 0.25, null, false, false), boxEdges([mx, 7, mz], [44, 9, 30], 0, 3)];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) P.push(cylinder([mx + (i - 3) * 5.6, 2.5, mz + (j - 2) * 5.6], 2.4, 8, { density: 0.9, cap: true }));
    for (let j = 0; j < 5; j++) {
      const z0 = mz + (j - 2) * 5.6;
      busbars.push(quad([mx - 20, 11.5, z0 - 1.2], [mx + 20, 11.5, z0 - 1.2], [mx + 20, 11.5, z0 + 1.2], [mx - 20, 11.5, z0 + 1.2], 2));
    }
    modules.push(G('Battery modules', [0.4, 0.75, 1.0], [mx * 0.55, 40, mz * 0.9], 0.15, P, { info: '35 lithium-ion cells each, 280 in all', showLabel: first }));
    first = false;
  }
  const snake = [];
  for (let r = 0; r < 7; r++) { const z = -60 + r * 20; snake.push(r % 2 ? [90, 1.5, z] : [-90, 1.5, z], r % 2 ? [-90, 1.5, z] : [90, 1.5, z]); }
  const cooling = [quad([-95, 1, -65], [95, 1, -65], [95, 1, 65], [-95, 1, 65], 0.1), pathTube(snake, 1.2, 1.5)];
  const bms = [box([0, 8, 60], [40, 5, 12], 0.8, 3), dots(linspace(-15, 15, 7).map((x) => [x, 11, 60]), 1.2, 2)];
  const cables = [vessel([[90, 12, -34], [97, 12, -10], [100, 10, 0]], 1.8, 1.8, 2), vessel([[90, 12, 34], [97, 12, 10], [100, 10, 0]], 1.8, 1.8, 2), box([103, 8, 0], [8, 8, 16], 1, 3)];
  const lid = [quad([-100, 16, -70], [100, 16, -70], [100, 16, 70], [-100, 16, 70], 0.12), boxEdges([0, 15, 0], [200, 2, 140], 0, 2)];
  return [
    G('Lid', [0.6, 0.65, 0.8], [0, 115, 0], 0, lid, { info: 'sealed, waterproof cover' }),
    G('Busbars', [1.0, 0.55, 0.25], [0, 75, 0], 0.1, busbars, { info: 'copper strips that link the cells' }),
    ...modules,
    G('Cooling plate', COL.cyan, [0, -40, 0], 0.15, cooling, { info: 'liquid coolant keeps the cells near 25 C' }),
    G('Tray & crash frame', COL.steel, [0, -85, 0], 0.05, tray, { info: 'protects the cells in a crash' }),
    G('Battery management (BMS)', COL.green, [0, 40, 115], 0.2, bms, { info: 'watches every cell: voltage and heat' }),
    G('HV cables & connector', COL.orange, [85, 30, 0], 0.2, cables, { info: '400 V out to the motor' }),
  ];
}

export const VEHICLES2 = [
  { name: 'Motorcycle', groups: motorcycle, color: [1.0, 0.35, 0.25], tilt: 12, viewYaw: 0.7, fact: '210 cm · V-twin · chain drive' },
  { name: 'Airliner', groups: airliner, color: [0.6, 0.8, 1.0], tilt: 18, viewYaw: 0.6, fact: '37.6 m long · 34 m wingspan · 180 seats' },
  { name: 'Saturn V Rocket', groups: saturnV, color: [0.95, 0.95, 1.0], tilt: 0, viewYaw: 0.4, fact: '110 m · 3 stages · took Apollo to the Moon' },
];
export const MACHINES = [
  { name: 'Mechanical Watch', groups: wristwatch, color: [1.0, 0.8, 0.4], tilt: 28, viewYaw: 0.9, fact: '40 mm · 28,800 beats per hour · ~40 h power reserve' },
  { name: 'EV Battery Pack', groups: batteryPack, color: [0.4, 0.8, 1.0], tilt: 30, viewYaw: 0.5, fact: '8 modules · 280 cells · ~400 V' },
];
