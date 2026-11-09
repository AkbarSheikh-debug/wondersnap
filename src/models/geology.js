// Explodable 3D geological models: structural basins, plate tectonics, and Earth's interior.
import {
  paramSurface, revolve, ring, tube, pipe, transform, Part, TAU,
} from '../lib/sampling.js';
import { COL, G } from './engines.js';

// ============================================================ 1. Faulted Anticline Basin & Igneous Intrusion
function faultedBasin() {
  const faultX = (y) => 0.55 * y;                                      // 60° dipping normal fault plane
  const throwY = -45, throwX = 45 * 0.55;                              // hanging-wall slip vector
  const foldY = (x, z, y0) => y0 + 55 * Math.cos(x / 75) * Math.cos(z / 130);

  function horizonBed(y0, thickness, side, density = 0.8) {
    const P = [];
    const u0 = side < 0 ? -200 : -40, u1 = side < 0 ? 40 : 200;
    const dx = side > 0 ? throwX : 0, dy = side > 0 ? throwY : 0;

    P.push(paramSurface((x, z) => {
      const y = foldY(x, z, y0);
      const xc = side < 0 ? Math.min(x, faultX(y)) : Math.max(x, faultX(y));
      return [xc + dx, foldY(xc, z, y0) + dy, z];
    }, u0, u1, -160, 160, { density, gu: 14, gv: 10 }));

    P.push(new Part((rng, o, i) => {
      const x = -200 + rng.random() * 400, z = -160 + rng.random() * 320;
      const y = foldY(x, z, y0) - rng.random() * thickness;
      const isHanging = x > faultX(y);
      const j = i * 3;
      if ((side < 0 && !isHanging) || (side > 0 && isHanging)) {
        o[j] = x + dx; o[j + 1] = y + dy; o[j + 2] = z;
      } else {
        const xm = side < 0 ? -150 + rng.random() * 120 : 60 + rng.random() * 130;
        o[j] = xm + dx; o[j + 1] = foldY(xm, z, y0) - rng.random() * thickness + dy; o[j + 2] = z;
      }
    }, 45000, density));
    return P;
  }

  const faultPlane = [
    paramSurface((y, z) => [faultX(y), y, z], -180, 160, -165, 165, { density: 0.7, gu: 10, gv: 16 }),
  ];

  const intrusion = [
    revolve([-200, -160, -110], [85, 65, 22], { density: 1.1 }),
    pipe([[0, -120, -40], [-30, -40, -20], [-65, 45, 0], [-85, 135, 10]], 16, 1.4),
    paramSurface((r, a) => [-65 + r * Math.cos(a), foldY(-65 + r * Math.cos(a), r * Math.sin(a), -10), r * Math.sin(a)], 0, 95, 0, TAU, { density: 1.2, gu: 6, gv: 16 }),
  ];

  const reservoirTrap = [
    paramSurface((r, a) => [r * Math.cos(a) - 35, foldY(r * Math.cos(a) - 35, r * Math.sin(a), 32), r * Math.sin(a)], 0, 75, 0, TAU, { density: 1.6, gu: 8, gv: 16 }),
  ];

  return [
    G('Crystalline Basement', COL.purple, [-90, -180, 0], 0.1, horizonBed(-100, 45, -1, 0.7),
      { info: 'Precambrian metamorphic and igneous basement rock underlying the sedimentary basin.' }),
    G('Crystalline Basement (R)', COL.purple, [140, -240, 0], 0.05, horizonBed(-100, 45, 1, 0.7), { showLabel: false }),

    G('Sandstone Reservoir', COL.gold, [-90, -40, 0], 0.15, horizonBed(-30, 40, -1, 0.85),
      { info: 'High-porosity, high-permeability eolian sandstone acting as a fluid aquifer and hydrocarbon reservoir.' }),
    G('Sandstone Reservoir (R)', COL.gold, [150, -110, 0], 0.05, horizonBed(-30, 40, 1, 0.85), { showLabel: false }),

    G('Anticline Oil & Gas Trap', COL.green, [-90, 60, -220], 0.25, reservoirTrap,
      { info: 'Structural crest where buoyant oil and natural gas accumulate beneath the impermeable shale seal.' }),

    G('Impermeable Shale Caprock', COL.teal, [-90, 90, 0], 0.18, horizonBed(35, 35, -1, 0.8),
      { info: 'Fine-grained marine mudstone and shale that seals fluids inside the underlying sandstone reservoir.' }),
    G('Impermeable Shale Caprock (R)', COL.teal, [160, 20, 0], 0.05, horizonBed(35, 35, 1, 0.8), { showLabel: false }),

    G('Footwall Limestone Uplift', COL.ice, [-90, 240, 0], 0.0, horizonBed(105, 30, -1, 0.9),
      { info: 'Upthrown carbonate platform exposed to surface weathering and karst topography.' }),
    G('Hanging-Wall Half-Graben', COL.cyan, [170, 150, 0], 0.0, horizonBed(105, 30, 1, 0.9),
      { info: 'Down-dropped hanging-wall block that slipped downward along the normal fault during crustal extension.' }),

    G('Normal Fault Plane (60° Dip)', COL.red, [0, 0, 260], 0.3, faultPlane,
      { info: 'Extensional brittle fracture plane dipping 60 degrees, offsetting sedimentary strata by 45 meters of throw.' }),
    G('Igneous Pluton, Dike & Sill', COL.orange, [0, -280, -220], 0.22, intrusion,
      { info: 'Cross-cutting magma intrusion rising from a deep stock through a vertical feeder dike into a concordant sill.' }),
  ];
}

// ============================================================ 2. Subduction Zone & Stratovolcano Plumbing
function subductionZone() {
  const slabY = (x) => (x < -60 ? -20 : -20 - 0.0028 * (x + 60) ** 2);

  const oceanicSlab = [
    paramSurface((x, z) => [x, slabY(x), z], -220, 175, -140, 140, { density: 1.0, gu: 18, gv: 10 }),
    paramSurface((x, z) => [x, slabY(x) - 38, z], -220, 175, -140, 140, { density: 0.8, gu: 18, gv: 10 }),
  ];

  const seismicity = [
    new Part((rng, o, i) => {
      const x = -70 + rng.random() * 240, z = -135 + rng.random() * 270;
      const y = slabY(x) - rng.random() * 18 + (rng.random() - 0.5) * 8;
      const j = i * 3;
      o[j] = x; o[j + 1] = y; o[j + 2] = z;
    }, 35000, 1.8),
  ];

  const continent = [
    paramSurface((x, z) => [x, x < -60 ? -20 : Math.min(25, -20 + (x + 60) * 0.45), z], -60, 220, -140, 140, { density: 0.75, gu: 14, gv: 10 }),
    paramSurface((x, z) => [x, -55, z], 10, 220, -140, 140, { density: 0.5, gu: 10, gv: 8 }),
  ];

  const volcano = [
    paramSurface((r, a) => [85 + r * Math.cos(a), 25 + (115 - r) * 0.95 * (r > 18 ? 1 : r / 18), r * Math.sin(a)], 12, 115, 0, TAU, { density: 1.3, gu: 10, gv: 24 }),
    ring([85, 122, 0], 18, { density: 6 }),
  ];

  const magmaSystem = [
    paramSurface((u, v) => [85 + 52 * Math.cos(v) * Math.cos(u), -75 + 28 * Math.sin(v), 42 * Math.cos(v) * Math.sin(u)], 0, TAU, -Math.PI / 2, Math.PI / 2, { density: 1.4, gu: 16, gv: 8 }),
    paramSurface((u, v) => [85 + 28 * Math.cos(v) * Math.cos(u), -5 + 18 * Math.sin(v), 25 * Math.cos(v) * Math.sin(u)], 0, TAU, -Math.PI / 2, Math.PI / 2, { density: 1.4, gu: 12, gv: 6 }),
    tube([85, -135, 0], [85, 125, 0], 12, 8, 2.2),
    pipe([[85, -10, 0], [115, 25, 35], [140, 62, 55]], 6, 2.0),
    pipe([[45, slabY(45), -45], [65, -110, -25], [85, -75, 0]], 8, 1.6),
    pipe([[110, slabY(110), 45], [98, -115, 25], [85, -75, 0]], 8, 1.6),
  ];

  const plume = [
    revolve([125, 165, 210, 240], [10, 24, 65, 110], { density: 0.7 }),
  ].map((p) => transform(p, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [85, 0, 0]));

  return [
    G('Subducting Oceanic Slab', COL.teal, [-220, -140, 0], 0.05, oceanicSlab,
      { info: 'Dense basaltic oceanic lithosphere sinking into the mantle beneath the continental margin.' }),
    G('Wadati-Benioff Earthquakes', COL.lime, [-100, -40, 240], 0.2, seismicity,
      { info: 'Planar zone of shallow-to-deep earthquake hypocenters tracing brittle deformation inside the descending slab.' }),
    G('Continental Crust & Wedge', COL.steel, [180, 40, 0], 0.1, continent,
      { info: 'Buoyant granitic continental crust and scraped-off accretionary prism sediments.' }),
    G('Magma Chamber & Conduits', COL.orange, [0, -180, -220], 0.25, magmaSystem,
      { info: 'Flux melting triggered by volatiles released from the slab, feeding crustal magma reservoirs.' }),
    G('Stratovolcano Cone & Crater', COL.red, [0, 180, 0], 0.08, volcano,
      { info: 'Composite volcanic arc edifice built from alternating layers of andesitic lava flows and tephra.' }),
    G('Eruption Column & Ash Cloud', COL.silver, [0, 340, 0], 0.0, plume,
      { info: 'Buoyant Plinian eruption column dispersing volcanic ash, pumice, and gas into the stratosphere.' }),
  ];
}

// ============================================================ 3. Earth's Interior Shells & Mantle Plume
function earthInterior() {
  const shell = (r, a0, a1, density = 0.8, gu = 18, gv = 12) =>
    paramSurface(
      (u, v) => [r * Math.cos(v) * Math.cos(u), r * Math.sin(v), r * Math.cos(v) * Math.sin(u)],
      a0, a1, -Math.PI / 2, Math.PI / 2, { density, gu, gv }
    );

  const innerCore = [shell(52, 0, TAU, 1.5, 16, 10)];
  const outerCore = [shell(105, Math.PI * 0.4, TAU, 1.0, 18, 12), ring([0, 0, 0], 105, { density: 5 })];
  const lowerMantle = [shell(165, Math.PI * 0.45, TAU, 0.85, 20, 14), ring([0, 0, 0], 165, { density: 5 })];
  const upperMantle = [shell(200, Math.PI * 0.5, TAU, 0.8, 22, 14), ring([0, 0, 0], 200, { density: 5 })];
  const crust = [shell(216, Math.PI * 0.5, TAU, 0.9, 26, 16)];

  const mantlePlume = [
    pipe([[0, 105, 0], [12, 145, 10], [20, 185, 15], [25, 218, 18]], 14, 1.8),
    paramSurface((r, a) => [25 + r * Math.cos(a), 205, 18 + r * Math.sin(a)], 0, 42, 0, TAU, { density: 1.5, gu: 6, gv: 14 }),
  ];

  return [
    G('Solid Fe-Ni Inner Core', COL.gold, [0, 0, 260], 0.3, innerCore,
      { info: 'Solid iron-nickel alloy sphere (radius 1,220 km) crystallized under 330–360 GPa of pressure.' }),
    G('Liquid Outer Core (Geodynamo)', COL.orange, [-180, -120, 160], 0.22, outerCore,
      { info: 'Convecting liquid iron-nickel shell (2,260 km thick) that generates Earth’s magnetic field.' }),
    G('Lower Mantle & D″ Layer', COL.red, [200, -100, 100], 0.15, lowerMantle,
      { info: 'Bridgmanite (silicate perovskite) and ferropericlase mantle extending from 660 km to 2,890 km depth.' }),
    G('Asthenosphere & Upper Mantle', COL.magenta, [-220, 140, 0], 0.08, upperMantle,
      { info: 'Olivine- and pyroxene-rich upper mantle and ductile asthenosphere enabling plate tectonics.' }),
    G('Deep Mantle Plume & Hotspot', COL.lime, [0, 290, 120], 0.25, mantlePlume,
      { info: 'Upwelling thermal diapir rising from the core-mantle boundary to form intra-plate hotspot volcanism.' }),
    G('Continental & Oceanic Crust', COL.cyan, [220, 160, -100], 0.0, crust,
      { info: 'Outermost rigid rocky shell (5–70 km thick) separated from the mantle by the Mohorovičić discontinuity.' }),
  ];
}

export const GEOLOGY = [
  { name: 'Faulted Anticline Basin', groups: faultedBasin, color: [1.0, 0.75, 0.25], tilt: 22, viewYaw: 0.55, fact: 'Normal fault · anticline reservoir trap · igneous dike & sill' },
  { name: 'Subduction Zone Volcano', groups: subductionZone, color: [1.0, 0.4, 0.15], tilt: 18, viewYaw: 0.45, fact: 'Oceanic slab · Wadati-Benioff earthquakes · magma plumbing' },
  { name: 'Earth Interior & Mantle Plume', groups: earthInterior, color: [0.3, 0.88, 1.0], tilt: 16, viewYaw: 0.4, fact: 'Inner & outer core · mantle shells · hotspot plume' },
];