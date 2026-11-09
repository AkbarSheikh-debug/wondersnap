// Explodable 3D geological models. Same group format as engines.js & vehicles.js.
import {
  line, polyline, box, boxSurface, boxEdges, revolve, ring, transform,
  tube, pipe, disc, paramSurface, helix, ellipsoid, TAU,
} from '../lib/sampling.js';
import { linspace } from '../lib/vec.js';
import { G, COL } from './engines.js';

const Y = [0, 1, 0];
/** Gaussian bell curve helper: exp(-(d / w)^2) */
const gauss = (d, w) => Math.exp(-((d / w) ** 2));

// ============================================================ 1. Salt Dome, Listric Fault & Petroleum System
function saltDomeBasin() {
  const X0 = -210, X1 = 210, Z0 = -135, Z1 = 135;
  const domeX = -68, domeZ = 0;

  // Listric normal fault (steep near surface, flattening into basal décollement at depth)
  const faultX = (y, z = 0) => 42 + 0.42 * y + 0.0011 * (y + 130) ** 2 + 10 * Math.sin(z / 70);
  const throwY = -38, throwX = 26;

  // Piercement salt diapir radius profile from mother salt (y = -135) to mushroom cap (y = +38)
  const saltR = (y) => {
    if (y < -135 || y > 42) return 0;
    const t = (y + 135) / 177;
    return 44 * (1 - 0.55 * Math.sin(t * Math.PI * 0.85)) + 16 * gauss(t - 0.82, 0.16);
  };

  // Folded stratigraphy: anticline uplift around salt dome + rollover anticline in hanging wall
  const horizonY = (x, z, yBase) => {
    const r = Math.hypot(x - domeX, z - domeZ);
    const haloUplift = 48 * gauss(r, 92) - 10 * gauss(r - 105, 38); // dome uplift + rim syncline
    const regionalFold = 16 * Math.cos((x + 30) / 85) * Math.cos(z / 115);
    return yBase + haloUplift + regionalFold;
  };

  /**
   * Builds a watertight 3D stratigraphic block (top surface, front/back cross-section walls, outer wall,
   * fault-cut face, salt-truncation ring, and bright bedding contact polylines).
   */
  function rockUnit(yTop, yBot, side, density = 0.55) {
    const dx = side > 0 ? throwX : 0, dy = side > 0 ? throwY : 0;
    const keepSide = (x, y, z) => {
      const xOrig = x - dx, yOrig = y - dy;
      const onSide = side < 0 ? xOrig <= faultX(yOrig, z) : xOrig >= faultX(yOrig, z);
      const outsideSalt = Math.hypot(xOrig - domeX, z - domeZ) >= Math.max(0, saltR(yOrig) - 1);
      return onSide && outsideSalt;
    };

    const P = [];
    const xMin = side < 0 ? X0 : 10, xMax = side < 0 ? 115 : X1;

    // Top horizon surface with structural contour grid
    P.push(paramSurface((x, z) => [x + dx, horizonY(x, z, yTop) + dy, z], xMin, xMax, Z0, Z1,
      { density, keep: keepSide, gu: 26, gv: 16 }));

    // Front (z = Z1) and back (z = Z0) vertical cross-section walls + bright stratigraphic contact lines
    for (const z of [Z0, Z1]) {
      P.push(paramSurface((x, t) => {
        const yt = horizonY(x, z, yTop), yb = horizonY(x, z, yBot);
        return [x + dx, yb + t * (yt - yb) + dy, z];
      }, xMin, xMax, 0, 1, { density: density * 0.85, keep: keepSide, gu: 24, gv: 5 }));

      // Bright top & bottom bedding plane contacts on the cross-section faces
      for (const yb of [yTop, yBot]) {
        const pts = linspace(xMin, xMax, 48)
          .map((x) => [x + dx, horizonY(x, z, yb) + dy, z])
          .filter((p) => keepSide(p[0], p[1], p[2]));
        if (pts.length > 2) P.push(polyline(pts, 0, 3.5));
      }
    }

    // Outer boundary wall (x = X0 for footwall, x = X1 for hanging wall)
    const xEdge = side < 0 ? X0 : X1;
    P.push(paramSurface((z, t) => {
      const yt = horizonY(xEdge, z, yTop), yb = horizonY(xEdge, z, yBot);
      return [xEdge + dx, yb + t * (yt - yb) + dy, z];
    }, Z0, Z1, 0, 1, { density: density * 0.85, gu: 16, gv: 5 }));
    for (const yb of [yTop, yBot]) {
      P.push(polyline(linspace(Z0, Z1, 32).map((z) => [xEdge + dx, horizonY(xEdge, z, yb) + dy, z]), 0, 3.5));
    }

    // Fault-cutoff wall + bright fault contact trace
    P.push(paramSurface((z, t) => {
      const yMid = yBot + t * (yTop - yBot) + 12 * Math.cos(z / 115);
      const xf = faultX(yMid, z);
      return [xf + dx, horizonY(xf, z, yBot + t * (yTop - yBot)) + dy, z];
    }, Z0, Z1, 0, 1, { density: density * 0.75, gu: 16, gv: 4 }));
    P.push(polyline(linspace(Z0, Z1, 30).map((z) => {
      const xf = faultX(yTop, z);
      return [xf + dx, horizonY(xf, z, yTop) + dy, z];
    }), 0, 4));

    // If footwall unit is pierced by the salt dome, trace the bright upturned truncation ring around the salt stem
    const rSaltTop = saltR(yTop + 32);
    if (side < 0 && rSaltTop > 5) {
      P.push(polyline(linspace(0, TAU, 40).map((a) => {
        const x = domeX + (rSaltTop + 2) * Math.cos(a), z = domeZ + (rSaltTop + 2) * Math.sin(a);
        return [x, horizonY(x, z, yTop), z];
      }), 0, 4.5));
    }
    return P;
  }

  // ---- 1. Louann Mother Salt Bed & Piercement Salt Diapir (with overhang & internal halite flow folds)
  const saltDiapir = [
    paramSurface((a, y) => [domeX + saltR(y) * Math.cos(a), y, domeZ + saltR(y) * Math.sin(a)],
      0, TAU, -135, 38, { density: 0.9, gu: 24, gv: 18 }),
    paramSurface((r, a) => [domeX + r * Math.cos(a), 38 + 6 * Math.cos((r / 42) * (Math.PI / 2)), domeZ + r * Math.sin(a)],
      0, 40, 0, TAU, { density: 1.0, gu: 8, gv: 20 }),
    // Basal mother evaporite bed at y = -135..-115
    boxSurface([-35, -126, 0], [340, 18, 270], 0.45),
    boxEdges([-35, -126, 0], [340, 18, 270], 0, 2.5),
  ];
  for (const y of [-110, -75, -40, -5, 28]) {
    saltDiapir.push(ring([domeX, y, domeZ], saltR(y) + 0.5, { density: 4.5 }));
  }

  // ---- 2. Listric Normal Fault Plane with Slickenside Striations
  const faultPlane = [
    paramSurface((y, z) => [faultX(y, z), y, z], -135, 130, Z0 - 8, Z1 + 8, { density: 0.65, gu: 16, gv: 18 }),
    polyline(linspace(Z0 - 8, Z1 + 8, 32).map((z) => [faultX(130, z), 130, z]), 0, 4.5),
    polyline(linspace(Z0 - 8, Z1 + 8, 32).map((z) => [faultX(-135, z), -135, z]), 0, 4.5),
  ];
  // Dip-slip slickenside lineations along the fault mirror
  for (const z of [-100, -50, 0, 50, 100]) {
    faultPlane.push(polyline(linspace(-125, 120, 20).map((y) => [faultX(y, z) + 0.8, y, z]), 0, 3.5));
  }

  // ---- 3. Salt-Flank Pinchout & Rollover Hydrocarbon Traps (Gas Cap + Oil Leg + OWC Ring)
  const traps = [];
  for (const [r0, r1, yOff] of [[38, 68, -14], [36, 76, -24]]) {
    traps.push(paramSurface((r, a) => {
      const x = domeX + r * Math.cos(a), z = domeZ + r * Math.sin(a);
      return [x, horizonY(x, z, yOff), z];
    }, r0, r1, -Math.PI * 0.75, Math.PI * 0.75, { density: 1.5, gu: 8, gv: 20 }));
    traps.push(polyline(linspace(-Math.PI * 0.75, Math.PI * 0.75, 36).map((a) => {
      const x = domeX + r1 * Math.cos(a), z = domeZ + r1 * Math.sin(a);
      return [x, horizonY(x, z, yOff), z];
    }), 0, 5));
  }
  traps.push(paramSurface((x, z) => [x + throwX, horizonY(x, z, -12) + throwY + 2, z],
    48, 115, -65, 65, { density: 1.4, gu: 10, gv: 10 }));

  // ---- 4. Surface Production Rig + 3 Directional Horizontal Wells
  const rigX = 12, rigZ = -15, rigY = horizonY(rigX, rigZ, 95) + 2;
  const drillingSystem = [
    box([rigX, rigY + 8, rigZ], [36, 14, 32], 0.9, 3.5),
    boxEdges([rigX, rigY + 42, rigZ], [14, 56, 14], 0, 4),
    line([rigX - 7, rigY + 14, rigZ - 7], [rigX + 7, rigY + 70, rigZ + 7], 0, 3),
    line([rigX + 7, rigY + 14, rigZ - 7], [rigX - 7, rigY + 70, rigZ + 7], 0, 3),
    disc([rigX + 22, rigY + 16, rigZ], 0, 14, Y, 1.8), ring([rigX + 22, rigY + 16, rigZ], 14, { density: 5 }),
    pipe([[rigX, rigY, rigZ], [rigX, 35, rigZ], [-5, -10, -8], [-22, -26, 0], [-28, -28, 38]], 2.8, 3.5),
    pipe([[rigX - 3, rigY, rigZ + 3], [rigX - 8, 20, rigZ + 8], [-35, -35, 22], [-95, -52, 18], [-115, -54, -20]], 2.8, 3.5),
    pipe([[rigX + 3, rigY, rigZ - 3], [rigX + 18, 30, rigZ - 10], [55, -20, -15], [95, -45, -5], [135, -48, 25]], 2.8, 3.5),
  ];
  for (const x of linspace(-180, 180, 10)) {
    drillingSystem.push(ellipsoid([x, horizonY(x, -95, 95) + (x > faultX(95, -95) ? throwY : 0) + 2, -95], [3, 3, 3], 3));
  }
  drillingSystem.push(line([-180, horizonY(-180, -95, 95) + 2, -95], [30, horizonY(30, -95, 95) + 2, -95], 0, 3));

  return [
    G('Louann Salt Diapir & Mother Bed', COL.white, [-140, -190, 0], 0.38, saltDiapir,
      { info: 'Buoyant mobile halite rising from a deep evaporite layer, piercing and up-doming overlying strata to form structural traps.' }),
    G('Listric Normal Growth Fault', COL.red, [0, 0, 240], 0.32, faultPlane,
      { info: 'Curved extensional fault plane with dip-slip slickensides that flattens with depth into the basal salt décollement.' }),
    G('Pre-Rift Carbonate Basement', COL.purple, [-80, -140, 0], 0.28, rockUnit(-70, -115, -1, 0.55),
      { info: 'Deep marine platform carbonates underlying the primary clastic reservoir sequence.' }),
    G('Carbonate Basement (R)', COL.purple, [130, -180, 0], 0.22, rockUnit(-70, -115, 1, 0.55), { showLabel: false }),
    G('Lower Turbidite Sandstone', COL.amber, [-80, -55, 0], 0.22, rockUnit(-20, -70, -1, 0.58),
      { info: 'Deep-water submarine fan sandstone beds upturned steeply against the flanks of the piercing salt stock.' }),
    G('Lower Sandstone (R)', COL.amber, [145, -105, 0], 0.16, rockUnit(-20, -70, 1, 0.58), { showLabel: false }),
    G('Oil & Gas Pinchout Traps', COL.green, [0, 95, -230], 0.35, traps,
      { info: 'Multi-pay hydrocarbon accumulations trapped at the salt-dome overhang pinchout and the hanging-wall rollover anticline.' }),
    G('Marine Shale Regional Seal', COL.teal, [-80, 45, 0], 0.14, rockUnit(35, -20, -1, 0.55),
      { info: 'Low-permeability hemipelagic mudstone caprock sealing hydrocarbons beneath the unconformity.' }),
    G('Marine Shale Seal (R)', COL.teal, [160, -10, 0], 0.1, rockUnit(35, -20, 1, 0.55), { showLabel: false }),
    G('Fluvial-Deltaic Overburden', COL.gold, [-80, 165, 0], 0.05, rockUnit(95, 35, -1, 0.6),
      { info: 'Upper deltaic sequence arched over the salt dome crest with a prominent fault scarp at the surface.' }),
    G('Hanging-Wall Rollover Block', COL.cyan, [175, 110, 0], 0.04, rockUnit(95, 35, 1, 0.6),
      { info: 'Down-dropped hanging-wall half-graben thickened by syn-tectonic sediment deposition during fault slip.' }),
    G('Drilling Rig & Horizontal Wells', COL.orange, [0, 275, 0], 0.0, drillingSystem,
      { info: 'Surface production derrick with three directional horizontal wellbores targeting salt-flank and fault-rollover pay zones.' }),
  ];
}

// ============================================================ 2. Subduction Zone, Accretionary Wedge & Stratovolcano Arc
function subductionZone() {
  const Z0 = -130, Z1 = 130;
  // Subducting plate profile: abyssal plain (-220..-75), trench bend (-75), megathrust & deep slab (-75..+195)
  const slabTopY = (x) => (x < -75 ? -28 + 5 * gauss(x + 115, 28) : -28 - 0.0024 * (x + 75) ** 2 - 0.12 * (x + 75));
  const slabDipVec = (x) => {
    const dy = x < -75 ? 0 : -0.0048 * (x + 75) - 0.12;
    const len = Math.hypot(1, dy);
    return [-dy / len, 1 / len];
  };

  // ---- 1. Subducting Oceanic Lithosphere (Oceanic Crust + Harzburgite Mantle + Seamounts + Trench Faults)
  const oceanicPlate = [
    paramSurface((x, z) => [x, slabTopY(x), z], -220, 185, Z0, Z1, { density: 0.75, gu: 28, gv: 16 }),
    paramSurface((x, z) => { const n = slabDipVec(x); return [x - n[0] * 12, slabTopY(x) - n[1] * 12, z]; }, -220, 185, Z0, Z1, { density: 0.45, gu: 20, gv: 10 }),
    paramSurface((x, z) => { const n = slabDipVec(x); return [x - n[0] * 44, slabTopY(x) - n[1] * 44, z]; }, -220, 185, Z0, Z1, { density: 0.65, gu: 24, gv: 14 }),
  ];
  for (const z of [Z0, Z1]) {
    oceanicPlate.push(paramSurface((x, t) => {
      const n = slabDipVec(x), d = t * 44;
      return [x - n[0] * d, slabTopY(x) - n[1] * d, z];
    }, -220, 185, 0, 1, { density: 0.7, gu: 28, gv: 5 }));
    for (const d of [0, 12, 44]) {
      oceanicPlate.push(polyline(linspace(-220, 185, 45).map((x) => {
        const n = slabDipVec(x);
        return [x - n[0] * d, slabTopY(x) - n[1] * d, z];
      }), 0, 4));
    }
  }
  for (const [sx, sz, sr, sh] of [[-165, -45, 22, 18], [-125, 55, 18, 15], [-82, -10, 16, 12]]) {
    oceanicPlate.push(paramSurface((r, a) => [sx + r * Math.cos(a), slabTopY(sx + r * Math.cos(a)) + sh * Math.max(0, 1 - (r / sr) ** 1.6), sz + r * Math.sin(a)],
      4, sr, 0, TAU, { density: 1.1, gu: 6, gv: 16 }));
  }

  // ---- 2. Imbricate Accretionary Wedge & Forearc Basin
  const wedgeTopY = (x) => -28 + 48 * (1 - Math.exp(-Math.max(0, x + 75) / 52));
  const accretionaryWedge = [
    paramSurface((x, z) => [x, wedgeTopY(x) + 3 * Math.sin((x + 70) * 0.35), z], -75, 25, Z0, Z1, { density: 0.7, gu: 16, gv: 14 }),
  ];
  for (const z of [Z0, Z1]) {
    accretionaryWedge.push(paramSurface((x, t) => {
      const yb = slabTopY(x), yt = wedgeTopY(x);
      return [x, yb + t * (yt - yb), z];
    }, -75, 25, 0, 1, { density: 0.75, gu: 14, gv: 5 }));
    accretionaryWedge.push(polyline(linspace(-75, 25, 24).map((x) => [x, wedgeTopY(x), z]), 0, 4));
  }
  for (const xToe of [-62, -46, -30, -12, 6]) {
    accretionaryWedge.push(paramSurface((s, z) => {
      const x = xToe + s * 28, yb = slabTopY(x), yt = wedgeTopY(xToe);
      return [x, yb + (yt - yb) * Math.sqrt(1 - s), z];
    }, 0, 1, Z0, Z1, { density: 0.6, gu: 6, gv: 12 }));
  }

  // ---- 3. Overriding Continental Crust & Lithospheric Mantle
  const arcX = 105, arcZ = -10;
  const continentTopY = (x, z) => {
    const forearcDepr = -8 * gauss(x - 32, 22);
    const cordillera = 26 / (1 + Math.exp(-(x - 45) / 14));
    return 18 + forearcDepr + cordillera + 4 * Math.cos(x / 35) * Math.sin(z / 45);
  };
  const keepOutsideVolcano = (x, y, z) => Math.hypot(x - arcX, z - arcZ) > 58 || y < 38;
  const continentalCrust = [
    paramSurface((x, z) => [x, continentTopY(x, z), z], 25, 220, Z0, Z1, { density: 0.65, keep: keepOutsideVolcano, gu: 22, gv: 16 }),
    paramSurface((x, z) => [x, -52, z], 35, 220, Z0, Z1, { density: 0.5, gu: 16, gv: 12 }),
  ];
  for (const z of [Z0, Z1]) {
    continentalCrust.push(paramSurface((x, t) => [x, -52 + t * (continentTopY(x, z) + 52), z], 25, 220, 0, 1, { density: 0.65, gu: 20, gv: 6 }));
    continentalCrust.push(polyline(linspace(25, 220, 32).map((x) => [x, continentTopY(x, z), z]), 0, 4));
    continentalCrust.push(line([35, -52, z], [220, -52, z], 0, 4));
  }

  // ---- 4. Asthenosphere Mantle Wedge & Trans-Crustal Magma Plumbing (MASH Zone -> Sill Complex -> Conduits)
  const magmaPlumbing = [
    ellipsoid([arcX, -52, arcZ], [48, 12, 42], 1.4),
    ellipsoid([arcX - 12, -32, arcZ + 8], [34, 9, 30], 1.3),
    ellipsoid([arcX, 2, arcZ], [28, 16, 24], 1.5),
    ring([arcX, 2, arcZ], 28, { density: 5 }),
    tube([arcX, -52, arcZ], [arcX, 118, arcZ], 10, 6.5, 2.5),
    pipe([[arcX, 4, arcZ], [arcX + 28, 32, arcZ + 22], [arcX + 46, 68, arcZ + 34]], 4.5, 2.5),
    pipe([[arcX, -8, arcZ], [arcX - 32, 22, arcZ - 28], [arcX - 48, 44, arcZ - 42]], 4.0, 2.2),
  ];
  for (const [dx, dz] of [[68, -45], [88, 35], [105, -10], [122, 50], [138, -35]]) {
    const sy = slabTopY(dx);
    magmaPlumbing.push(pipe([[dx, sy + 4, dz], [dx + 8, (sy - 52) / 2, dz * 0.6], [arcX + (dx - arcX) * 0.4, -52, arcZ + (dz - arcZ) * 0.4]], 4.5, 1.8));
    magmaPlumbing.push(ellipsoid([dx + 5, sy + 28, dz * 0.8], [7, 12, 7], 1.6));
  }
  for (const z of [-75, 0, 75]) {
    magmaPlumbing.push(polyline([[215, -72, z], [115, -78, z], [85, -92, z], [125, -135, z], [215, -165, z]], 0, 3.5));
  }

  // ---- 5. Stratovolcano Edifice, Summit Caldera, Lava Dome & Parasitic Cone
  const coneY = (r, a) => {
    const base = 42, h = 76 * Math.pow(Math.max(0, 1 - r / 68), 1.35);
    const gullies = 2.8 * Math.sin(a * 9) * (r / 68) * (1 - r / 68);
    return base + h + gullies;
  };
  const volcanoCone = [
    paramSurface((r, a) => [arcX + r * Math.cos(a), coneY(r, a), arcZ + r * Math.sin(a)], 14, 68, 0, TAU, { density: 1.2, gu: 14, gv: 28 }),
    paramSurface((r, a) => [arcX + r * Math.cos(a), 102 + (r - 5) * 1.3, arcZ + r * Math.sin(a)], 5, 14, 0, TAU, { density: 1.4, gu: 5, gv: 18 }),
    ellipsoid([arcX, 104, arcZ], [7, 5, 7], 2.0),
    ring([arcX, 114, arcZ], 14.5, { density: 6 }),
    paramSurface((r, a) => [arcX + 46 + r * Math.cos(a), 54 + (16 - r) * 0.9, arcZ + 34 + r * Math.sin(a)], 4, 16, 0, TAU, { density: 1.4, gu: 5, gv: 14 }),
    pipe([[arcX - 10, 112, arcZ + 8], [arcX - 26, 86, arcZ + 22], [arcX - 44, 58, arcZ + 38], [arcX - 62, 44, arcZ + 52]], 3.5, 2.5),
  ];

  // ---- 6. Plinian Eruption Column & Stratospheric Umbrella Cloud
  const ashPlume = [
    transform(revolve([112, 148, 192, 222, 238], [7, 16, 38, 92, 115], { density: 0.65 }), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [arcX, 0, arcZ]),
    transform(disc([0, 238, 0], 0, 112, Y, 0.55), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [arcX, 0, arcZ]),
    ring([arcX, 232, arcZ], 114, { density: 4.5 }),
  ];

  // ---- 7. Double Wadati-Benioff Seismic Zone (Megathrust + Intraslab Dehydration Hypocenters)
  const seismicity = [];
  for (let k = 0; k < 42; k++) {
    const x = -65 + (k / 41) * 235, z = ((k * 73) % 230) - 115;
    const isLowerPlane = k % 3 === 0 && x > 20;
    const n = slabDipVec(x), depthInSlab = isLowerPlane ? 24 : 3;
    const pos = [x - n[0] * depthInSlab, slabTopY(x) - n[1] * depthInSlab, z];
    const magR = k < 12 ? 6.5 : 4.2;
    seismicity.push(ellipsoid(pos, [magR, magR, magR], 2.2), ring(pos, magR * 1.45, { density: 4 }));
  }

  return [
    G('Subducting Oceanic Plate & Seamounts', COL.teal, [-210, -135, 0], 0.12, oceanicPlate,
      { info: 'Cold, dense oceanic lithosphere (basaltic crust over harzburgite mantle) bending into the trench with outer-rise faults and seamounts.' }),
    G('Imbricate Accretionary Wedge', COL.gold, [-140, 85, 0], 0.16, accretionaryWedge,
      { info: 'Stack of overlapping thrust-faulted sediment slices scraped off the descending oceanic plate above the basal décollement.' }),
    G('Wadati-Benioff Seismic Zone', COL.lime, [0, -40, 240], 0.28, seismicity,
      { info: 'Shallow megathrust earthquake foci in the locked zone and intermediate-to-deep double seismic planes inside the dehydrating slab.' }),
    G('Overriding Continental Crust', COL.steel, [185, 45, 0], 0.1, continentalCrust,
      { info: 'Buoyant continental crust and forearc basin separated from the underlying mantle wedge by the Mohorovičić discontinuity.' }),
    G('MASH Zone, Magma Chambers & Diapirs', COL.orange, [0, -175, -220], 0.32, magmaPlumbing,
      { info: 'Corner-flow mantle wedge, hydrous slab-fluid diapirs, lower-crustal MASH sill stack, and upper-crustal magma reservoirs.' }),
    G('Stratovolcano, Caldera & Lava Dome', COL.red, [0, 175, 0], 0.05, volcanoCone,
      { info: 'Composite volcanic arc cone featuring radial erosion gullies, summit crater lava dome, flank lava flow, and parasitic cinder cone.' }),
    G('Plinian Column & Umbrella Cloud', COL.silver, [0, 320, 0], 0.0, ashPlume,
      { info: 'Convective eruption column rising into the stratosphere and spreading laterally at the neutral buoyancy level.' }),
  ];
}

// ============================================================ 3. Earth's Interior, Geodynamo & Seismic Ray Paths
function earthInterior() {
  const A0 = Math.PI * 0.42, A1 = TAU;

  function thickShell(rIn, rOut, density = 0.65, gu = 22, gv = 14) {
    const sph = (r, u, v) => [r * Math.cos(v) * Math.cos(u), r * Math.sin(v), r * Math.cos(v) * Math.sin(u)];
    const P = [
      paramSurface((u, v) => sph(rOut, u, v), A0, A1, -Math.PI / 2, Math.PI / 2, { density, gu, gv }),
    ];
    if (rIn > 0) {
      P.push(paramSurface((u, v) => sph(rIn, u, v), A0, A1, -Math.PI / 2, Math.PI / 2, { density: density * 0.6, gu: gu - 4, gv: gv - 2 }));
    }
    for (const a of [A0, A1]) {
      P.push(paramSurface((v, t) => sph(rIn + t * (rOut - rIn), a, v), -Math.PI / 2, Math.PI / 2, 0, 1,
        { density: density * 0.9, gu: 20, gv: 4 }));
      for (const r of [rIn, rOut]) {
        if (r > 0) P.push(polyline(linspace(-Math.PI / 2, Math.PI / 2, 42).map((v) => sph(r, a, v)), 0, 4.5));
      }
    }
    P.push(polyline(linspace(A0, A1, 48).map((u) => sph(rOut, u, 0)), 0, 3.5));
    return P;
  }

  const R_IC = 46, R_OC = 104, R_LM = 166, R_TZ = 186, R_UM = 205, R_CR = 216;
  const innerCore = [
    paramSurface((u, v) => [R_IC * Math.cos(v) * Math.cos(u), R_IC * Math.sin(v), R_IC * Math.cos(v) * Math.sin(u)],
      0, TAU, -Math.PI / 2, Math.PI / 2, { density: 1.5, gu: 18, gv: 12 }),
    ring([0, 0, 0], R_IC + 1, { density: 5 }),
  ];

  const outerCore = thickShell(R_IC + 2, R_OC, 0.72, 20, 12);
  const geodynamo = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, rCol = 68;
    const cx = rCol * Math.cos(a), cz = rCol * Math.sin(a);
    geodynamo.push(helix([cx, -52, cz], 9, 104, 5, Y, 2.4));
  }
  for (const a of [0.15, 0.65, 1.15, -0.45]) {
    const pts = linspace(-Math.PI * 0.42, Math.PI * 0.42, 36).map((v) => {
      const r = 235 * Math.cos(v) ** 2;
      return [r * Math.cos(v) * Math.cos(a), r * Math.sin(v), r * Math.cos(v) * Math.sin(a)];
    });
    geodynamo.push(polyline(pts, 0, 3.5));
  }

  const lowerMantle = thickShell(R_OC + 2, R_LM, 0.65, 22, 14);
  const mantlePlumes = [
    pipe([[24, R_OC, 18], [32, 138, 24], [38, 175, 28], [44, R_CR, 32]], 9, 2.2),
    ellipsoid([44, R_UM - 2, 32], [28, 8, 28], 1.6),
    pipe([[R_OC, -12, 15], [142, -8, 22], [182, -4, 26], [R_CR, 0, 28]], 10, 2.2),
    ellipsoid([R_OC + 8, -12, 15], [14, 34, 34], 1.4),
  ];

  const upperMantle = [
    ...thickShell(R_LM + 2, R_TZ, 0.6, 22, 12),
    ...thickShell(R_TZ + 1, R_UM, 0.62, 24, 14),
  ];

  const crust = thickShell(R_UM + 1, R_CR, 0.78, 28, 16);
  crust.push(polyline(linspace(-1.1, 1.1, 40).map((v) => {
    const u = 3.6 + 0.25 * Math.sin(v * 5), r = R_CR + 2.5;
    return [r * Math.cos(v) * Math.cos(u), r * Math.sin(v), r * Math.cos(v) * Math.sin(u)];
  }), 0, 5));

  const focus = [0, R_CR, 0];
  const seismicRays = [ellipsoid(focus, [8, 8, 8], 3), ring(focus, 14, { density: 6 })];
  for (const a of [0.25, A0]) {
    const rayPt = (r, theta) => [r * Math.sin(theta) * Math.cos(a), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(a)];
    for (const thetaEnd of [0.7, 1.25, 1.75]) {
      seismicRays.push(polyline(linspace(0, 1, 28).map((t) => {
        const th = t * thetaEnd, r = R_CR - 52 * Math.sin(t * Math.PI) * (thetaEnd / 1.75);
        return rayPt(r, th);
      }), 0, 4.5));
    }
    seismicRays.push(polyline([
      ...linspace(0, 1, 18).map((t) => rayPt(R_CR - t * (R_CR - R_OC), t * 0.62)),
      ...linspace(0, 1, 18).map((t) => rayPt(R_OC - 28 * Math.sin(t * Math.PI), 0.62 + t * 1.65)),
      ...linspace(0, 1, 18).map((t) => rayPt(R_OC + t * (R_CR - R_OC), 2.27 + t * 0.55)),
    ], 0, 4.5));
    seismicRays.push(polyline(linspace(0, 1, 32).map((t) => rayPt(R_CR * Math.cos(t * Math.PI), 0.12 * Math.sin(t * Math.PI))), 0, 4.5));
  }

  return [
    G('Solid Fe-Ni Inner Core', COL.gold, [0, 0, 280], 0.38, innerCore,
      { info: 'Solid iron-nickel sphere (radius 1,220 km, ~5,400 °C) crystallized under 330–360 GPa pressure; transmits compressional PKIKP waves.' }),
    G('Liquid Outer Core', COL.orange, [-180, -130, 150], 0.26, outerCore,
      { info: 'Molten iron-nickel shell (2,260 km thick) bounded by the Gutenberg (CMB) and Lehmann discontinuities; blocks shear S-waves.' }),
    G('Geodynamo Taylor Coils & B-Field', COL.cyan, [190, -140, 160], 0.32, geodynamo,
      { info: 'Coriolis-aligned helical convection columns in the liquid outer core generating Earth’s dipolar geomagnetic field.' }),
    G('Lower Mantle & D″ Layer', COL.red, [210, -80, -90], 0.18, lowerMantle,
      { info: 'High-pressure bridgmanite (silicate perovskite) and ferropericlase lower mantle from 660 km down to the 2,890 km Core-Mantle Boundary.' }),
    G('LLSVP Superplumes & Hotspots', COL.pink, [0, 270, 150], 0.24, mantlePlumes,
      { info: 'Buoyant thermochemical mantle plumes rising from D″ Large Low-Shear-Velocity Provinces to feed surface flood basalts and island chains.' }),
    G('Transition Zone & Asthenosphere', COL.magenta, [-220, 120, -60], 0.1, upperMantle,
      { info: 'Upper mantle and 410–660 km olivine–wadsleyite–ringwoodite phase-transition zone underlying the ductile asthenosphere.' }),
    G('P & S Seismic Wave Ray Paths', COL.lime, [0, 190, 260], 0.34, seismicRays,
      { info: 'Curved mantle P/S ray paths, core-reflected PcP waves, and refracted PKP/PKIKP rays defining the 103°–142° seismic shadow zone.' }),
    G('Tectonic Crust & Mid-Ocean Ridge', COL.teal, [210, 160, -110], 0.0, crust,
      { info: 'Rigid oceanic and continental plates (5–70 km thick) split by spreading mid-ocean ridges and transform fault systems.' }),
  ];
}

// ============================================================ 4. Karst Limestone Cave System & Confined Artesian Aquifer
function karstAquifer() {
  const X0 = -200, X1 = 200, Z0 = -135, Z1 = 135;

  const SINKHOLES = [
    [-85, -35, 28, 52],
    [15, 48, 24, 46],
    [105, -25, 32, 65],
    [-25, -75, 18, 35],
  ];

  const riverX = (z) => -115 + 32 * Math.sin(z / 42);
  const topoY = (x, z) => {
    const plateau = 92 + 12 * Math.cos(x / 95) * Math.sin(z / 80) + 0.08 * x;
    const gorge = -48 * gauss(x - riverX(z), 24);
    let sinkDrop = 0;
    for (const [sx, sz, sr, sd] of SINKHOLES) {
      const r = Math.hypot(x - sx, z - sz);
      if (r < sr * 1.35) sinkDrop -= sd * Math.max(0, 1 - (r / sr) ** 2);
    }
    return plateau + gorge + sinkDrop;
  };
  const keepOutsideThroats = (x, y, z) => SINKHOLES.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) > sr * 0.42);

  // ---- 1. Karst Topographic Plateau, Sinkhole Dolines & Incised River Gorge
  const karstSurface = [
    paramSurface((x, z) => [x, topoY(x, z), z], X0, X1, Z0, Z1, { density: 0.72, keep: keepOutsideThroats, gu: 30, gv: 20 }),
  ];
  for (const [sx, sz, sr] of SINKHOLES) {
    karstSurface.push(polyline(linspace(0, TAU, 32).map((a) => {
      const x = sx + sr * Math.cos(a), z = sz + sr * Math.sin(a);
      return [x, topoY(x, z), z];
    }), 0, 4.5));
    karstSurface.push(polyline(linspace(0, TAU, 24).map((a) => {
      const x = sx + sr * 0.44 * Math.cos(a), z = sz + sr * 0.44 * Math.sin(a);
      return [x, topoY(x, z), z];
    }), 0, 5));
  }
  const riverChannel = [
    pipe(linspace(Z0, Z1, 24).map((z) => [riverX(z), topoY(riverX(z), z) + 2, z]), 6.5, 2.2),
  ];

  // ---- 2. Jointed Massively Bedded Karst Limestone Block
  const limeBotY = (x) => -18 + 14 * Math.sin((x + 60) / 110);
  const limestoneBlock = [
    paramSurface((x, z) => [x, limeBotY(x), z], X0, X1, Z0, Z1, { density: 0.5, gu: 22, gv: 14 }),
  ];
  for (const z of [Z0, Z1]) {
    limestoneBlock.push(paramSurface((x, t) => {
      const yb = limeBotY(x), yt = topoY(x, z);
      return [x, yb + t * (yt - yb), z];
    }, X0, X1, 0, 1, { density: 0.65, gu: 28, gv: 8 }));
    limestoneBlock.push(polyline(linspace(X0, X1, 48).map((x) => [x, topoY(x, z), z]), 0, 4));
    limestoneBlock.push(polyline(linspace(X0, X1, 48).map((x) => [x, limeBotY(x), z]), 0, 4));
    for (const yBed of [0, 22, 44, 66]) {
      limestoneBlock.push(polyline(linspace(X0, X1, 36).map((x) => [x, Math.min(topoY(x, z), yBed + 8 * Math.sin((x + 60) / 110)), z]), 0, 2.5));
    }
  }
  for (const x of [X0, X1]) {
    limestoneBlock.push(paramSurface((z, t) => {
      const yb = limeBotY(x), yt = topoY(x, z);
      return [x, yb + t * (yt - yb), z];
    }, Z0, Z1, 0, 1, { density: 0.65, gu: 18, gv: 8 }));
  }

  // ---- 3. Vadose Shafts, Phreatic Cave Conduits, Caverns & Speleothems
  const caveSystem = [
    pipe([[145, 18, -50], [105, 12, -25], [45, 8, 15], [15, 6, 48], [-45, 10, 20], [-85, 16, -35], [riverX(-45) + 12, 42, -45]], 11, 2.2),
    pipe([[-25, 22, -75], [-45, 14, -30], [-45, 10, 20]], 8, 2.0),
    ellipsoid([35, 18, 10], [38, 18, 28], 1.5),
    ring([35, 8, 10], 34, { density: 4.5 }),
  ];
  for (const [sx, sz, sr] of SINKHOLES) {
    const yTop = topoY(sx, sz);
    caveSystem.push(tube([sx, 12, sz], [sx, yTop + 6, sz], sr * 0.36, sr * 0.44, 2.2));
  }
  for (const [dx, dz] of [[-16, -8], [-4, 10], [12, -6], [22, 8], [4, -14]]) {
    caveSystem.push(transform(revolve([4, 14, 22, 32], [4.5, 2.2, 2.0, 4.8], { density: 1.8 }), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [35 + dx, 0, 10 + dz]));
  }

  // ---- 4. Unconfined Water Table (Phreatic Surface)
  const waterTable = [
    paramSurface((x, z) => [x, 22 + 0.09 * (x + 115) + 4 * Math.cos(z / 55), z], X0 + 5, X1 - 5, Z0 + 5, Z1 - 5,
      { density: 0.55, gu: 22, gv: 14 }),
  ];

  // ---- 5. Impermeable Shale Aquitard & Confined Artesian Sandstone Aquifer + Flowing Artesian Well
  const buildDeepBed = (yTop, yBot, density = 0.6) => {
    const P = [
      paramSurface((x, z) => [x, yTop + 14 * Math.sin((x + 60) / 110), z], X0, X1, Z0, Z1, { density, gu: 24, gv: 14 }),
    ];
    for (const z of [Z0, Z1]) {
      P.push(paramSurface((x, t) => {
        const dy = 14 * Math.sin((x + 60) / 110);
        return [x, yBot + dy + t * (yTop - yBot), z];
      }, X0, X1, 0, 1, { density: density * 0.85, gu: 24, gv: 4 }));
      P.push(polyline(linspace(X0, X1, 44).map((x) => [x, yTop + 14 * Math.sin((x + 60) / 110), z]), 0, 3.5));
      P.push(polyline(linspace(X0, X1, 44).map((x) => [x, yBot + 14 * Math.sin((x + 60) / 110), z]), 0, 3.5));
    }
    return P;
  };
  const aquitard = buildDeepBed(-18, -48, 0.55);
  const artesianAquifer = [
    ...buildDeepBed(-48, -105, 0.68),
    tube([-155, -82, 45], [-155, 118, 45], 3.5, 3.5, 3.5),
    transform(revolve([118, 132, 142], [2, 12, 22], { density: 1.4 }), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [-155, 0, 45]),
  ];

  return [
    G('Karst Plateau & Solution Sinkholes', COL.green, [0, 230, 0], 0.0, karstSurface,
      { info: 'Carbonate plateau pockmarked by funnel-shaped dissolution dolines (sinkholes) and incised by a meandering river canyon.' }),
    G('Incised Canyon River & Resurgence', COL.cyan, [-180, 140, 0], 0.04, riverChannel,
      { info: 'Base-level surface river fed by karst springs emerging from phreatic cave conduits along the canyon wall.' }),
    G('Jointed Karst Limestone Formation', COL.ice, [0, 90, 220], 0.12, limestoneBlock,
      { info: 'Massively bedded soluble calcium carbonate rock fractured by orthogonal vertical joints and horizontal bedding planes.' }),
    G('Vadose Shafts, Caverns & Speleothems', COL.amber, [0, 40, -240], 0.28, caveSystem,
      { info: 'Multi-level underground drainage network featuring vertical sinkhole shafts, trunk phreatic tubes, and stalactite–stalagmite caverns.' }),
    G('Unconfined Phreatic Water Table', COL.teal, [190, 60, 0], 0.2, waterTable,
      { info: 'Upper groundwater surface separating the air-filled vadose zone above from the water-saturated phreatic zone below.' }),
    G('Impermeable Shale Aquitard', COL.purple, [0, -110, 0], 0.18, aquitard,
      { info: 'Low-permeability clay-rich confining bed preventing vertical leakage between the upper karst and lower sandstone aquifer.' }),
    G('Confined Artesian Sandstone Aquifer', COL.gold, [0, -230, 0], 0.25, artesianAquifer,
      { info: 'Pressurized regional sandstone aquifer recharged at high elevation, driving a free-flowing artesian well above ground level.' }),
  ];
}

export const GEOLOGY = [
  { name: 'Salt Dome & Faulted Basin', groups: saltDomeBasin, color: [1.0, 0.75, 0.25], tilt: 20, viewYaw: 0.65, fact: 'Piercement salt diapir · listric normal fault · 3 horizontal wells' },
  { name: 'Subduction Zone & Volcanic Arc', groups: subductionZone, color: [1.0, 0.42, 0.18], tilt: 18, viewYaw: 0.55, fact: 'Oceanic trench · imbricate thrust wedge · MASH magma plumbing' },
  { name: 'Earth Interior & Geodynamo', groups: earthInterior, color: [0.3, 0.88, 1.0], tilt: 16, viewYaw: 0.45, fact: 'Cutaway mantle shells · outer-core Taylor coils · P & S wave rays' },
  { name: 'Karst Caves & Artesian Aquifer', groups: karstAquifer, color: [0.35, 1.0, 0.65], tilt: 20, viewYaw: 0.6, fact: 'Sinkhole dolines · phreatic cave conduits · flowing artesian well' },
];