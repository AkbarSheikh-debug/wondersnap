// The real WebGL2 shaders on the real GPU: one transform-feedback step must equal the CPU twin (simRef.js)
// in every mode (incl. the new exploded-view terms), readbacks must not stall the simulation, and the
// rendered frame must put the model where the design says (right third of the screen, filling the height).
import { test, expect } from '@playwright/test';
import { openApp, play, shot, watchErrors } from './helpers.js';

test('GPU step == CPU reference in all modes (sphere+kick, form+explode, pulled part, dissolve, idle)', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page, 'n=20000');
  const r = await page.evaluate(async () => {
    const Sim = await import('/src/logic/simRef.js');
    const { makeRng } = await import('/src/lib/rng.js');
    const { rotX, rotY, matMul } = await import('/src/lib/vec.js');
    const R = window.wonderSnap.app.renderer, K = 2048, rng = makeRng(42);
    const state = new Float32Array(K * 6), T = new Float32Array(K * 3), O = new Float32Array(K * 4);
    for (let i = 0; i < K; i++) {
      for (let a = 0; a < 3; a++) { state[i * 6 + a] = rng.normal() * 0.6; state[i * 6 + 3 + a] = rng.normal() * 0.5; T[i * 3 + a] = rng.normal() * 0.4; O[i * 4 + a] = rng.normal() * 0.3; }
      O[i * 4 + 3] = rng.random() * 0.5;
    }
    const Pk = new Float32Array(K);
    for (let i = 0; i < K; i++) Pk[i] = Math.floor(rng.random() * 6) - 1;          // part ids -1..4
    R.setModel({ target: T, offset: O, tint: new Float32Array(K * 3), pick: Pk });
    const seeds = R.readSeeds(K);
    const rot = matMul(rotX(0.35), rotY(1.1));
    const cases = [
      { name: 'idle', mode: 0 }, { name: 'sphere+kick', mode: 1, kick: 1 }, { name: 'sphere', mode: 1 },
      { name: 'form (early, staggered)', mode: 2, formT: 0.3 }, { name: 'form + explode 0.6', mode: 2, formT: 2, explode: 0.6, scale: 0.8, exCenter: [0.1, -0.2, 0.05] },
      { name: 'form + explode 1.0', mode: 2, formT: 2, explode: 1, scale: 0.6, exCenter: [0, 0.3, 0] }, { name: 'dissolve', mode: 3 },
      { name: 'form + selected part pulled out', mode: 2, formT: 2, explode: 0.7, scale: 0.8, sel: 2, pull: [0, 0, 0.5] },
    ];
    const out = [];
    for (const c of cases) {
      const u = { dt: 1 / 60, time: 1.7, formT: 0, kick: 0, rot, sphereR: 0.85, explode: 0, scale: 1, exCenter: [0, 0, 0], ...c };
      R.writeParticles(state);
      R.step(u);
      const g = R.readParticles(K);
      let maxErr = 0;
      for (let i = 0; i < K; i++) {
        const [p, v] = Sim.stepParticle(Array.from(state.subarray(i * 6, i * 6 + 3)), Array.from(state.subarray(i * 6 + 3, i * 6 + 6)),
          Array.from(T.subarray(i * 3, i * 3 + 3)), Array.from(seeds.subarray(i * 4, i * 4 + 4)), Array.from(O.subarray(i * 4, i * 4 + 4)), u, Pk[i]);
        for (let a = 0; a < 3; a++) maxErr = Math.max(maxErr, Math.abs(g[i * 6 + a] - p[a]), Math.abs(g[i * 6 + 3 + a] - v[a]) * u.dt);
      }
      out.push({ name: c.name, maxErr });
    }
    return { out, glError: R.gl.getError() };
  });
  console.table(r.out);
  for (const c of r.out) expect(c.maxErr, c.name).toBeLessThan(2e-4);
  expect(r.glError).toBe(0);
  noErrors();
});

test('regression: reading particles back does not freeze the transform-feedback simulation', async ({ page }) => {
  await openApp(page, 'n=20000');
  await page.keyboard.press('Space');
  await play(page, 0.5, null);
  const r = await page.evaluate(async () => {
    const W = window.wonderSnap, R = W.app.renderer;
    const a = R.readParticles(64);
    await W.advance(0.5, null);
    const b = R.readParticles(64);
    await W.advance(0.5, null);
    const c = R.readParticles(64);
    const diff = (x, y) => x.reduce((m, v, i) => Math.max(m, Math.abs(v - y[i])), 0);
    return { ab: diff(a, b), bc: diff(b, c), err: R.gl.getError() };
  });
  expect(r.ab).toBeGreaterThan(1e-3);
  expect(r.bc).toBeGreaterThan(1e-3);
  expect(r.err).toBe(0);
});

test('rendered frame: model on the right third, tall tower fills the height, glow + globe drawn', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page, 'n=200000&trails=1');
  await page.evaluate(() => window.wonderSnap.select(1));                    // Eiffel Tower
  await play(page, 0.6, null);
  await page.keyboard.press('f');
  await play(page, 3.2, null);
  const px = await page.evaluate(() => {
    const gl = window.wonderSnap.app.renderer.gl, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let n = 0, sx = 0, minY = H, maxY = 0, dim = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, s = buf[i] + buf[i + 1] + buf[i + 2];
      if (s > 150) { n++; sx += x; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      else if (s > 12) dim++;
    }
    return { W, H, n, cx: sx / n, h: maxY - minY, dim, err: gl.getError() };
  });
  console.log(px);
  expect(px.n).toBeGreaterThan(2000);                     // bright particles
  expect(px.cx).toBeGreaterThan(px.W * 0.55);             // placed on the right side (hand on the left)
  expect(px.h).toBeGreaterThan(px.H * 0.6);               // the tower fills the height
  expect(px.dim).toBeGreaterThan(5000);                   // soft halo + globe lines
  expect(px.err).toBe(0);
  await shot(page, 'gpu-eiffel-render-check');
  noErrors();
});
