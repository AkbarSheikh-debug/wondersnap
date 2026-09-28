// Explodable vehicles. Same group format as engines.js. Units: cm, front of the car at +x, y up.
import {
  line, polyline, quad, box, boxEdges, revolve, ring, transform, orient, tube, pipe, disc, paramSurface, torus, helix, ellipsoid,
} from '../lib/sampling.js';
import { rotZ, deg, linspace, norm } from '../lib/vec.js';
import { G, COL } from './engines.js';

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

// ============================================================ Sports coupé, 440 x 185 x 130 cm, wheelbase 260 cm
function sportsCar() {
  const bottom = 16, belt = 82, wheelY = 34, archR = 40, xF = 128, xR = -132;
  const hoodY = (x) => (x <= 212 ? belt - ((x - 95) / 117) * 16 : 66 - (x - 212) * 0.9);
  const trunkY = (x) => (x >= -205 ? 90 : 90 - (-205 - x) * 0.4);
  const shoulder = (x) => (x > 95 ? hoodY(x) : x < -150 ? trunkY(x) : belt);
  const halfW = (x, y) => {
    const e = Math.max(0, (Math.abs(x) - 165) / 55);
    return 90 * (1 - 0.2 * e * e) * (1 - 0.05 * ((y - 55) / 35) ** 2);
  };
  const archKeep = (x, y) => Math.hypot(x - xF, y - wheelY) > archR && Math.hypot(x - xR, y - wheelY) > archR;

  /** Lower body side panel between x0..x1 on side sgn (+1 = +z), wheel arches cut out, bright seams. */
  const sidePanel = (x0, x1, sgn) => {
    const fn = (x, t) => { const yt = shoulder(x), y = bottom + t * (yt - bottom); return [x, y, sgn * halfW(x, y)]; };
    const P = [paramSurface(fn, x0, x1, 0, 1, { density: 0.55, keep: archKeep, gu: 30, gv: 10 })];
    P.push(polyline(linspace(x0, x1, 24).map((x) => fn(x, 1)), 0, 3), polyline(linspace(x0, x1, 24).map((x) => fn(x, 0)), 0, 2));
    for (const x of [x0, x1]) P.push(polyline(linspace(0, 1, 8).map((t) => fn(x, t)), 0, 2.5));
    for (const wx of [xF, xR]) {
      if (wx + archR < x0 || wx - archR > x1) continue;
      const arc = linspace(0, Math.PI, 30).map((a) => [wx + archR * Math.cos(a), wheelY + archR * Math.sin(a)]).filter(([x]) => x >= x0 && x <= x1);
      if (arc.length > 1) P.push(polyline(arc.map(([x, y]) => [x, y, sgn * halfW(x, y)]), 0, 4));
    }
    return P;
  };
  /** Glass quad on the greenhouse side (z shrinks toward the roof = tumblehome). */
  const gz = (y) => 86 - ((y - belt) / 46) * 22;
  const sideGlass = (pts, sgn) => {
    const q = pts.map(([x, y]) => [x, y, sgn * gz(y)]);
    return [quad(q[0], q[1], q[2], q[3], 0.18), polyline(q, 0, 3, true)];
  };

  const body = {};
  for (const [sgn, tag] of [[-1, 'L'], [1, 'R']]) {
    body['fender' + tag] = sidePanel(95, 219, sgn);
    body['quarter' + tag] = [sidePanel(-219, -60, sgn), sideGlass([[-60, belt], [-150, belt], [-150, 90], [-68, 127]], sgn)];
    body['door' + tag] = [sidePanel(-60, 95, sgn), sideGlass([[95, belt], [-60, belt], [-60, 128], [20, 126]], sgn),
      line([10, 70, sgn * 91], [30, 70, sgn * 91], 0, 6), box([88, 92, sgn * 96], [10, 8, 12], 1.2, 3)];     // handle + mirror
  }
  const hood = [
    paramSurface((x, s) => [x, hoodY(x) + 3 * (1 - s * s), s * halfW(x, hoodY(x)) * 0.97], 95, 212, -1, 1, { density: 0.6, gu: 24, gv: 12 }),
    polyline(linspace(95, 212, 20).map((x) => [x, hoodY(x) + 0.5, 0.97 * halfW(x, hoodY(x))]), 0, 3),
    polyline(linspace(95, 212, 20).map((x) => [x, hoodY(x) + 0.5, -0.97 * halfW(x, hoodY(x))]), 0, 3),
    line([200, 69, -30], [120, 82, -30], 0, 3), line([200, 69, 30], [120, 82, 30], 0, 3),                     // power bulge
  ];
  const roof = [paramSurface((x, s) => [x, 128 + 2 * (1 - s * s) + 1.5 * Math.cos(((x + 25) / 50) * Math.PI / 2), s * 64], -68, 20, -1, 1, { density: 0.6, gu: 16, gv: 10 })];
  roof.push(polyline([[-68, 129, -64], [20, 127, -64]], 0, 4), polyline([[-68, 129, 64], [20, 127, 64]], 0, 4));
  const windshield = [quad([95, belt, -86], [95, belt, 86], [20, 126, 64], [20, 126, -64], 0.2), polyline([[95, belt, -86], [95, belt, 86], [20, 126, 64], [20, 126, -64]], 0, 4, true)];
  const rearWindow = [quad([-68, 128, -64], [-68, 128, 64], [-150, 90, 86], [-150, 90, -86], 0.2), polyline([[-68, 128, -64], [-68, 128, 64], [-150, 90, 86], [-150, 90, -86]], 0, 4, true)];
  const trunk = [paramSurface((x, s) => [x, trunkY(x) + 2 * (1 - s * s), s * halfW(x, 88) * 0.97], -212, -150, -1, 1, { density: 0.6, gu: 12, gv: 12 }),
    line([-212, 92, -40], [-212, 94, 40], 0, 5)];                                                                // spoiler lip
  const fascia = (xf, sgnX, y0, y1) => paramSurface((s, t) => {
    const y = y0 + t * (y1 - y0);
    return [xf - sgnX * (8 * s * s + 3 * (t - 0.5) ** 2), y, s * halfW(xf, y) * 0.93];
  }, -1, 1, 0, 1, { density: 0.55, gu: 16, gv: 8 });
  const frontBumper = [fascia(219, 1, 20, 62), polyline([[221, 28, -42], [221, 28, 42], [221, 46, 42], [221, 46, -42]], 0, 4, true)];
  for (const y of [32, 37, 42]) frontBumper.push(line([221.2, y, -40], [221.2, y, 40], 0, 3));
  const rearBumper = [fascia(-219, -1, 20, 86)];
  const headlights = [], taillights = [];
  for (const s of [-1, 1]) {
    headlights.push(polyline(linspace(0, 2 * Math.PI, 30).map((a) => [214 - 3 * Math.sin(a), 60 + 5 * Math.sin(a), s * (62 + 16 * Math.cos(a))]), 0, 7));
    headlights.push(paramSurface((a, r) => [214, 60 + 5 * r * Math.sin(a), s * (62 + 16 * r * Math.cos(a))], 0, 2 * Math.PI, 0, 1, { density: 1.2, gu: 16, gv: 4 }));
    taillights.push(line([-220, 78, s * 30], [-219, 78, s * 82], 0, 8), line([-220, 72, s * 30], [-219, 72, s * 82], 0, 5));
  }
  taillights.push(line([-220.5, 80, -30], [-220.5, 80, 30], 0, 5));

  // ---- chassis, drivetrain, interior
  const frame = [];
  for (const s of [-1, 1]) frame.push(box([0, 22, s * 50], [400, 7, 7], 0.8, 3));
  for (const x of [-180, -90, 0, 90, 180]) frame.push(box([x, 22, 0], [6, 6, 100], 0.8, 3));
  frame.push(quad([-200, 18, -75], [200, 18, -75], [200, 18, 75], [-200, 18, 75], 0.08));
  const engine = [box([150, 45, 0], [56, 34, 48], 0.45, 3), box([150, 68, 0], [56, 12, 44], 0.5, 3), box([150, 79, 0], [58, 8, 38], 0.6, 3)];
  engine.push(tube([118, 80, -30], [182, 80, -30], 7, 7, 1));
  for (const x of [130, 143, 157, 170]) engine.push(pipe([[x, 80, -30], [x, 72, -24]], 3, 1.5), tube([x, 84, 0], [x, 88, 0], 3, 3, 3));
  engine.push(torus([122, 50, 20], 7, 2, X, 2), box([188, 62, 60], [18, 16, 14], 0.8, 3));                        // alternator + battery
  const radiator = [quad([204, 26, -60], [204, 26, 60], [204, 64, 60], [204, 64, -60], 0.5), boxEdges([204, 45, 0], [3, 38, 120], 0, 4)];
  for (let y = 30; y <= 60; y += 5) radiator.push(line([205, y, -58], [205, y, 58], 0, 1.5));
  radiator.push(disc([197, 45, 0], 3, 17, X, 1.3));
  const gearbox = [orient(revolve([0, 13, 63], [22, 18, 11], { density: 0.8 }), [-1, 0, 0], [123, 40, 0]), tube([60, 40, 0], [60, 58, 0], 2, 2, 3), ellipsoid([60, 60, 0], [3, 3, 3], 3)];
  const driveline = [tube([60, 34, 0], [-122, 34, 0], 3.2, 3.2, 2), orient(ring([0, 0, 0], 5, { density: 5 }), X, [-40, 34, 0]),
    ellipsoid([-132, 34, 0], [11, 11, 13], 1.2), tube([-132, 34, -64], [-132, 34, 64], 2.5, 2.5, 2)];
  const exhaust = [pipe([[140, 40, 26], [112, 17, 26], [-100, 17, 26], [-118, 20, 26]], 3.5, 1.2), tube([-118, 20, 26], [-190, 20, 26], 10, 10, 0.7),
    torus([-190, 20, 26], 10, 1, X, 3), tube([-190, 20, 22], [-223, 22, 30], 4, 4, 1.5), tube([-190, 20, 30], [-223, 22, -30], 4, 4, 1.5)];
  const fuel = [box([-95, 27, 0], [50, 16, 70], 0.5, 3), tube([-95, 35, 30], [-175, 70, 88], 2, 2, 2)];
  const seat = (xc, zc, w) => [box([xc, 32, zc], [46, 10, w], 0.55, 3), transform(box([0, 24, 0], [9, 48, w], 0.55, 3), rotZ(deg(12)), [xc - 25, 32, zc]),
    box([xc - 32, 80, zc], [8, 12, w * 0.5], 0.6, 3)];
  const seats = [seat(-5, -36, 42), seat(-5, 36, 42), seat(-88, -34, 38), seat(-88, 34, 38)];
  const dash = [paramSurface((z, t) => [72 + 8 * Math.cos(t * Math.PI), 50 + 22 * t, z], -80, 80, 0, 1, { density: 0.5, gu: 20, gv: 6 }),
    torus([46, 70, -36], 17, 1.8, norm([-0.8, 0.55, 0]), 3), tube([46, 70, -36], [75, 56, -36], 2, 2, 2)];
  for (const a of [0, 2.1, 4.2]) dash.push(line([46, 70, -36], [46 + 13 * Math.cos(a) * -0.55, 70 + 13 * Math.cos(a) * -0.8, -36 + 13 * Math.sin(a)], 0, 4));
  dash.push(tube([30, 22, 0], [22, 46, 0], 1.2, 1.2, 3), ellipsoid([22, 48, 0], [3, 3, 3], 3));                   // gear lever

  const wheel = (wx, sgn) => orient([
    revolve([-12, -12, -9, 9, 12, 12], [21, 29, 34, 34, 29, 21], { density: 0.45 }),
    ring([0, -6, 0], 34.3, { density: 3 }), ring([0, 6, 0], 34.3, { density: 3 }), ring([0, 12, 0], 29, { density: 3 }),
    revolve([-10, 10], [21, 21], { density: 0.6 }), ring([0, 11, 0], 21, { density: 5 }), disc([0, 11, 0], 0, 5, Y, 2),
    ...[0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * 2 * Math.PI;
      return quad([4 * Math.cos(a - 0.2), 11, 4 * Math.sin(a - 0.2)], [21 * Math.cos(a - 0.12), 10, 21 * Math.sin(a - 0.12)],
        [21 * Math.cos(a + 0.12), 10, 21 * Math.sin(a + 0.12)], [4 * Math.cos(a + 0.2), 11, 4 * Math.sin(a + 0.2)], 1.6);
    }),
  ], [0, 0, sgn], [wx, wheelY, sgn * 80]);
  const brakes = (sgn) => [xF, xR].map((wx) => [disc([wx, wheelY, sgn * 70], 5, 17, Z, 1.4), torus([wx, wheelY, sgn * 70], 17, 0.6, Z, 3), box([wx - 12, wheelY + 10, sgn * 70], [9, 12, 6], 1.3, 3)]);
  const suspension = (sgn) => [xF, xR].map((wx) => [helix([wx, wheelY + 4, sgn * 58], 5, 40, 6, Y, 3), tube([wx, wheelY, sgn * 58], [wx, wheelY + 50, sgn * 56], 1.6, 1.6, 2),
    line([wx, wheelY - 4, sgn * 70], [wx + 22, 24, sgn * 48], 0, 4), line([wx, wheelY - 4, sgn * 70], [wx - 22, 24, sgn * 48], 0, 4)]);

  const RED = [1.0, 0.18, 0.2], GLASS = [0.55, 0.85, 1.0], PANEL = [1.0, 0.3, 0.25];
  return [
    G('Chassis frame', COL.steel, [0, -30, 0], 0.5, frame),
    G('Hood', RED, [120, 115, 0], 0.0, hood),
    G('Roof', RED, [0, 175, 0], 0.0, roof),
    G('Windshield', GLASS, [65, 120, 0], 0.03, windshield),
    G('Rear window', GLASS, [-65, 120, 0], 0.03, rearWindow, { showLabel: false }),
    G('Trunk lid', RED, [-120, 105, 0], 0.0, trunk),
    G('Doors', RED, [0, 10, 165], 0.02, body.doorR),
    G('Door (L)', RED, [0, 10, -165], 0.02, body.doorL, { showLabel: false }),
    G('Front fenders', PANEL, [45, 0, 125], 0.06, body.fenderR),
    G('Front fender (L)', PANEL, [45, 0, -125], 0.06, body.fenderL, { showLabel: false }),
    G('Rear quarter panels', PANEL, [-45, 0, 125], 0.06, body.quarterR),
    G('Rear quarter (L)', PANEL, [-45, 0, -125], 0.06, body.quarterL, { showLabel: false }),
    G('Front bumper & grille', COL.silver, [160, -5, 0], 0.05, frontBumper),
    G('Headlights', COL.white, [175, 5, 0], 0.05, headlights, { showLabel: false }),
    G('Rear bumper', COL.silver, [-160, -5, 0], 0.05, rearBumper, { showLabel: false }),
    G('Tail lights', [1.0, 0.1, 0.15], [-175, 5, 0], 0.05, taillights, { showLabel: false }),
    G('Engine', COL.orange, [0, 135, 0], 0.3, engine),
    G('Radiator & fan', COL.cyan, [190, 60, 0], 0.3, radiator),
    G('Gearbox', COL.gold, [0, -75, 0], 0.35, gearbox),
    G('Driveshaft & differential', COL.amber, [0, -95, 0], 0.38, driveline),
    G('Exhaust system', COL.pink, [0, -125, 55], 0.34, exhaust),
    G('Fuel tank', COL.green, [0, -150, -40], 0.36, fuel),
    G('Seats', COL.purple, [0, 110, 0], 0.3, seats),
    G('Dashboard & steering', COL.teal, [35, 85, 0], 0.32, dash),
    G('Wheels & tyres', COL.white, [0, 0, 185], 0.15, [wheel(xF, 1), wheel(xR, 1)]),
    G('Wheels (L)', COL.white, [0, 0, -185], 0.15, [wheel(xF, -1), wheel(xR, -1)], { showLabel: false }),
    G('Brake discs & calipers', COL.red, [0, 0, 110], 0.2, brakes(1)),
    G('Brakes (L)', COL.red, [0, 0, -110], 0.2, brakes(-1), { showLabel: false }),
    G('Suspension (coil-overs)', COL.lime, [0, 25, 70], 0.25, suspension(1)),
    G('Suspension (L)', COL.lime, [0, 25, -70], 0.25, suspension(-1), { showLabel: false }),
  ];
}

export const VEHICLES = [
  { name: 'Sports Car', groups: sportsCar, color: [1.0, 0.25, 0.25], tilt: 16, viewYaw: 0.75, fact: '440 × 185 × 130 cm · 260 cm wheelbase · front engine, RWD' },
];
