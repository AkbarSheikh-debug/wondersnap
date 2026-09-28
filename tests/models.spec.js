// Model geometry: exact counts, determinism, speed, REAL measurements (ported from tests/test_all.py) and
// explode-direction sanity for every engine / the car. Runs the real modules inside the browser.
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers.js';

test.beforeEach(async ({ page }) => { await page.goto('/?manual=1&n=5000'); await page.waitForFunction(() => window.wonderSnap); });

test('every model: exactly N finite points inside the globe, deterministic, fast', async ({ page }) => {
  const noErrors = watchErrors(page);
  const rows = await page.evaluate(async () => {
    const { CATALOG, buildModel } = await import('/src/models/catalog.js');
    const N = 250000, out = [];
    for (let i = 0; i < CATALOG.length; i++) {
      const m = buildModel(i, N);
      let maxR = 0, finite = true;
      for (let k = 0; k < N; k++) {
        const r = Math.hypot(m.target[3 * k], m.target[3 * k + 1], m.target[3 * k + 2]);
        if (!Number.isFinite(r)) finite = false;
        maxR = Math.max(maxR, r);
      }
      out.push({ name: CATALOG[i].name, len: m.target.length, off: m.offset.length, tint: m.tint.length, maxR, finite, ms: m.ms,
        colorOk: CATALOG[i].color.every((c) => c >= 0 && c <= 1) });
    }
    const a = buildModel(1, 5000).target, b = buildModel(1, 5000).target;
    const c = buildModel(15, 5000).offset, d = buildModel(15, 5000).offset;
    return { out, same: a.every((v, i) => v === b[i]) && c.every((v, i) => v === d[i]) };
  });
  expect(rows.out.length).toBe(33);
  for (const r of rows.out) {
    expect(r.len, r.name).toBe(250000 * 3);
    expect(r.off).toBe(250000 * 4);
    expect(r.tint).toBe(250000 * 3);
    expect(r.finite, r.name).toBe(true);
    expect(r.maxR, r.name).toBeLessThanOrEqual(0.921);
    expect(r.ms, `${r.name} took ${r.ms} ms`).toBeLessThan(3000);
    expect(r.colorOk).toBe(true);
  }
  expect(rows.same).toBe(true);
  console.table(rows.out.map((r) => ({ model: r.name, ms: Math.round(r.ms) })));
  noErrors();
});

test('wonders match real-world measurements', async ({ page }) => {
  const m = await page.evaluate(async () => {
    const { WONDERS } = await import('/src/models/wonders.js');
    const { build } = await import('/src/lib/sampling.js');
    const { makeRng } = await import('/src/lib/rng.js');
    const raw = (name, n = 60000) => {
      const i = WONDERS.findIndex((w) => w.name === name);
      const f = build(WONDERS[i].build(), n, makeRng(7 + i));
      const P = []; for (let k = 0; k < n; k++) P.push([f[3 * k], f[3 * k + 1], f[3 * k + 2]]);
      return P;
    };
    const lo = (P, a) => P.reduce((m, p) => Math.min(m, p[a]), Infinity);
    const max = (P, a) => P.reduce((m, p) => Math.max(m, p[a]), -Infinity);
    const ext = (P) => [0, 1, 2].map((a) => max(P, a) - lo(P, a));
    const r = {};
    const e = raw('Eiffel Tower'); r.eiffelH = ext(e)[1]; r.eiffelBase = ext(e.filter((p) => p[1] < 3))[0];
    const p = raw('Great Pyramid'); [r.pyrW, r.pyrH] = ext(p);
    const c = raw('Colosseum'); [r.colX, r.colH, r.colZ] = ext(c);
    r.colSouth = max(c.filter((q) => q[2] < -40), 1); r.colNorth = max(c.filter((q) => q[2] > 40), 1);
    const s = raw('Leaning Tower of Pisa');
    const ctr = (a, b) => { const sl = s.filter((q) => q[1] > a && q[1] < b); return [(max(sl, 0) + lo(sl, 0)) / 2, sl.reduce((t, q) => t + q[1], 0) / sl.length]; };
    const [c0, c1] = [ctr(2, 6), ctr(44, 48)];
    r.pisaTilt = (Math.atan2(c1[0] - c0[0], c1[1] - c0[1]) * 180) / Math.PI; r.pisaH = ext(s)[1];
    r.burjH = ext(raw('Burj Khalifa'))[1];
    const t = raw('Taj Mahal'); r.tajH = ext(t)[1]; r.tajPlinth = ext(t.filter((q) => q[1] < 6))[0];
    r.libertyTop = max(raw('Statue of Liberty'), 1);
    r.turtleH = ext(raw('Turtle Tower'))[1];
    const bb = raw('Big Ben'); r.benH = ext(bb)[1]; r.benBase = ext(bb.filter((q) => q[1] < 10))[0];
    const cr = raw('Christ the Redeemer'); r.christTop = max(cr, 1); r.christSpan = ext(cr.filter((q) => q[1] > 25))[0];
    const o = raw('Sydney Opera House'); r.operaTop = max(o, 1); [r.operaX, , r.operaZ] = ext(o);
    return r;
  });
  console.log(m);
  const near = (v, want, d) => { expect(v).toBeGreaterThan(want - d); expect(v).toBeLessThan(want + d); };
  near(m.eiffelH, 330, 3); near(m.eiffelBase, 125, 12);
  near(m.pyrH, 146.6, 1); near(m.pyrW, 230.3, 1);
  near((Math.atan(146.6 / 115.15) * 180) / Math.PI, 51.8, 0.2);
  near(m.colX, 189, 3); near(m.colZ, 156, 3); near(m.colH, 48.5, 1);
  expect(m.colSouth).toBeLessThan(30); expect(m.colNorth).toBeGreaterThan(47);         // ruined south side
  near(m.pisaTilt, 3.97, 0.4); near(m.pisaH, 56.7, 1.5);
  near(m.burjH, 828, 2);
  near(m.tajH, 73, 1.5); near(m.tajPlinth, 95, 2);
  near(m.libertyTop, 93, 2.5);
  near(m.turtleH, 9.8, 1);
  near(m.benH, 96, 2); near(m.benBase, 12.5, 1.2);                                      // new monuments
  near(m.christTop, 38, 1.5); near(m.christSpan, 28, 2);
  near(m.operaTop, 67, 2.5); near(m.operaX, 183, 4); near(m.operaZ, 120, 3);
});

test('machines: every part gets particles, explodes outward in the right direction, fits on screen', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { CATALOG, buildModel } = await import('/src/models/catalog.js');
    const out = {};
    CATALOG.forEach((d, i) => {
      if (d.kind !== 'machine') return;
      const N = 100000, m = buildModel(i, N);
      const counts = new Array(m.groups.length).fill(0);
      for (let k = 0; k < N; k++) counts[m.group[k]]++;
      const g = d.groups();
      let exR = 0;
      for (let k = 0; k < N; k++) {
        const q = [0, 1, 2].map((a) => (m.target[3 * k + a] + m.offset[4 * k + a] - m.exCenter[a]) * m.fitScale);
        exR = Math.max(exR, Math.hypot(...q));
      }
      out[d.name] = {
        groups: g.map((x, j) => ({ label: x.label, n: counts[j], off: x.offset, stage: x.stage })),
        labels: m.labels.length, labelInfo: m.labels.map((l) => l.info), fitScale: m.fitScale, exR, viewYaw: d.viewYaw,
      };
    });
    return out;
  });
  const off = (name, label) => r[name].groups.find((g) => g.label === label).off;
  for (const [name, M] of Object.entries(r)) {
    for (const g of M.groups) {
      expect(g.n, `${name} / ${g.label}`).toBeGreaterThan(30);
      expect(g.stage).toBeGreaterThanOrEqual(0); expect(g.stage).toBeLessThan(0.6);
      expect(g.off.every(Number.isFinite)).toBe(true);
    }
    expect(M.labels, name).toBeGreaterThanOrEqual(6);
    expect(M.fitScale).toBeLessThanOrEqual(1);
    expect(M.exR, name).toBeLessThanOrEqual(1.181);                     // exploded view fits the screen
    expect(typeof M.viewYaw).toBe('number');
  }
  expect(off('Inline-4 Engine', 'Valve cover')[1]).toBeGreaterThan(0);  // lifts off the top
  expect(off('Inline-4 Engine', 'Oil pan')[1]).toBeLessThan(0);          // drops out the bottom
  expect(off('Inline-4 Engine', 'Intake manifold')[2]).toBeLessThan(0);  // intake side -z, exhaust +z
  expect(off('Inline-4 Engine', 'Exhaust manifold')[2]).toBeGreaterThan(0);
  expect(off('Inline-4 Engine', 'Coils & spark plugs')[1]).toBeGreaterThan(off('Inline-4 Engine', 'Valve cover')[1]);
  expect(off('Supercharged HEMI V8', 'Supercharger')[1]).toBeGreaterThan(off('Supercharged HEMI V8', 'Intake manifold')[1]);
  expect(off('Turbofan Jet Engine', 'Fan (22 blades)')[0]).toBeLessThan(0);       // stages spread along the axis
  expect(off('Turbofan Jet Engine', 'Exhaust nozzle & tail cone')[0]).toBeGreaterThan(0);
  expect(off('Sports Car', 'Roof')[1]).toBeGreaterThan(0);
  expect(off('Sports Car', 'Doors')[2]).toBeGreaterThan(0);
  expect(off('Sports Car', 'Door (L)')[2]).toBeLessThan(0);
  expect(off('Sports Car', 'Wheels & tyres')[2]).toBeGreaterThan(off('Sports Car', 'Brake discs & calipers')[2]);  // tyre outside the brake
  expect(off('Sports Car', 'Engine')[1]).toBeGreaterThan(0);
  expect(r['Sports Car'].groups.length).toBeGreaterThanOrEqual(25);
  // anatomy: hemispheres split left/right, the heart opens at the front, the kidney splits front/back
  expect(off('Human Brain', 'Frontal lobe')[2]).toBeGreaterThan(0);
  expect(off('Human Brain', 'Frontal lobe (L)')[2]).toBeLessThan(0);
  expect(off('Human Brain', 'Frontal lobe')[0]).toBeGreaterThan(0);
  expect(off('Human Brain', 'Occipital lobe')[0]).toBeLessThan(0);
  expect(off('Human Brain', 'Cerebellum')[1]).toBeLessThan(0);
  expect(off('Human Heart', 'Heart wall (myocardium)')[2]).toBeGreaterThan(0);
  expect(off('Human Heart', 'Aorta')[1]).toBeGreaterThan(0);
  expect(off('Kidney', 'Renal capsule')[2]).toBeGreaterThan(0);
  expect(off('Kidney', 'Renal capsule (back)')[2]).toBeLessThan(0);
  expect(off('Kidney', 'Adrenal gland')[1]).toBeGreaterThan(0);
  for (const name of ['Human Brain', 'Human Heart', 'Kidney']) {                  // every labelled organ part says what it does
    expect(r[name].labelInfo.every((s) => s.length > 8), name).toBe(true);
    expect(r[name].labelInfo.length).toBeGreaterThanOrEqual(9);
  }
});
