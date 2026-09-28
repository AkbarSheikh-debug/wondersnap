// Pure logic (ported from tests/test_all.py + new explode/peace behaviour), executed in the browser.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/?manual=1&n=5000'); await page.waitForFunction(() => window.wonderSnap); });

test('gestures: poses at 4 rotations, peace sign, openness, debouncer', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const G = await import('/src/logic/gestures.js');
    const { hand } = await import('/src/logic/synth.js');
    const poses = [0, 0.5, -0.6, 1.2].map((angle) => ['open', 'fist', 'point', 'peace'].map((pose) => G.classify(hand({ pose, angle }))));
    const open = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((f) => G.openness(hand({ pose: 'partial', f })));
    const deb = new G.PoseDebouncer(4);
    const seq = [...Array(5).fill('open'), 'fist', 'open', ...Array(4).fill('fist')];
    const changes = seq.map((p) => deb.update(p)).filter(([, c]) => c).map(([s]) => s);
    const d2 = new G.PoseDebouncer(4);
    const peaceChanges = [...Array(7).fill('peace')].map((p) => d2.update(p)[1]);
    return { poses, none: G.classify(null), snapPressed: G.classify(hand({ pose: 'snap_pressed' })), open, changes, peaceChanges };
  });
  for (const row of r.poses) expect(row).toEqual(['open', 'fist', 'point', 'peace']);
  expect(r.none).toBe('none');
  expect(r.snapPressed).not.toBe('fist');
  expect(r.open[0]).toBeLessThan(0.05);                      // fist = 0
  expect(r.open[6]).toBeGreaterThan(0.95);                   // open = 1
  for (let i = 1; i < r.open.length; i++) expect(r.open[i]).toBeGreaterThanOrEqual(r.open[i - 1]);   // monotonic
  expect(r.open[3]).toBeGreaterThan(0.3); expect(r.open[3]).toBeLessThan(0.7);
  expect(r.changes).toEqual(['open', 'fist']);               // 1-frame fist blip ignored
  expect(r.peaceChanges).toEqual([false, false, false, false, false, true, false]);   // ✌ must be held 6 frames
});

test('snap detector: real sequences fire exactly when they should', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const G = await import('/src/logic/gestures.js');
    const { hand } = await import('/src/logic/synth.js');
    const fire = (seq) => { const sn = new G.SnapDetector(); let t = 0, n = 0; for (const lm of seq) { n += sn.update(lm, t) ? 1 : 0; t += 1 / 30; } return n; };
    const P = hand({ pose: 'snap_pressed' }), R = hand({ pose: 'snap_released' }), O = hand({ pose: 'open' }), F = hand({ pose: 'fist' });
    const lerp = (a, b, k) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * k, p[1] + (b[i][1] - p[1]) * k]);
    const rep = (x, n) => Array(n).fill(x);
    return {
      clean: fire([...rep(P, 5), ...rep(R, 3)]),
      blur: fire([...rep(P, 5), null, null, ...rep(R, 3)]),
      held: fire([...rep(P, 40), ...rep(null, 30)]),
      slow: fire([...rep(P, 5), ...Array.from({ length: 30 }, (_, i) => lerp(P, O, i / 29))]),
      cooldown: fire([...rep(P, 4), ...rep(R, 2), ...rep(P, 4), ...rep(R, 2)]),
      fistOpen: fire([...rep(F, 6), ...rep(O, 4)]),
      fistOpenBlur: fire([...rep(F, 6), lerp(F, O, 0.5), O, O]),
      handOpeningForExplode: fire(Array.from({ length: 40 }, (_, i) => hand({ pose: 'partial', f: i / 39 }))),
    };
  });
  expect(r).toEqual({ clean: 1, blur: 1, held: 0, slow: 0, cooldown: 1, fistOpen: 0, fistOpenBlur: 0, handOpeningForExplode: 0 });
});

test('state machine: original story, wrap-around, machines explode instead of skipping, peace = next', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const S = await import('/src/logic/state.js');
    const log = [];
    const s = new S.WonderState(8);
    log.push(s.state, s.alpha(0));
    s.update('fist', true, false, 0.1); log.push(s.state);                         // fist does nothing when idle
    s.update(null, false, true, 0.2); log.push(s.state, s.consumeKick());
    log.push(s.alpha(0.25) < 1, s.alpha(1.0));
    s.update('open', false, false, 0.3); log.push(s.consumeKick());
    s.update('fist', true, false, 1.0); log.push(s.state, s.index, s.formT(1.5));
    s.targetDirty = false;
    s.update('open', true, false, 2.0); log.push(s.state, s.index, s.targetDirty, s.alpha(2.01));
    s.update('fist', true, false, 3.0); log.push(s.state, s.index);
    s.update(null, false, true, 4.0); log.push(s.state, +s.alpha(4.6).toFixed(2));
    s.update(null, false, false, 5.3); log.push(s.state);
    s.update(null, false, true, 6.0); log.push(s.state, s.index);                   // keeps its place
    const w = new S.WonderState(3); w.update(null, false, true, 0);
    for (let i = 0; i < 7; i++) { w.update('fist', true, false, 2 * i + 1); w.update('open', true, false, 2 * i + 2); }
    const m = new S.WonderState(4, (i) => i === 2, 2); m.update(null, false, true, 0); m.update('fist', true, false, 1);
    m.update('open', true, false, 2); const machineOpen = [m.state, m.index];         // machine: open = explode, no skip
    m.update('peace', true, false, 3); const machinePeace = [m.state, m.index];
    return { log, wrap: w.index, machineOpen, machinePeace };
  });
  expect(r.log).toEqual(['idle', 0, 'idle', 'sphere', true, true, 1, false, 'formed', 0, 0.5, 'sphere', 1, true, 1,
    'formed', 1, 'dissolve', 0.5, 'idle', 'sphere', 1]);
  expect(r.wrap).toBe(7 % 3);
  expect(r.machineOpen).toEqual(['formed', 2]);
  expect(r.machinePeace).toEqual(['sphere', 3]);
});

test('controller: story from landmarks, kick survives the render tick, dissolve ends without frames', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { Controller } = await import('/src/logic/controller.js');
    const { hand } = await import('/src/logic/synth.js');
    const feed = (c, seq, t) => { for (const lm of seq) { c.onHand(lm, t); t += 1 / 30; } return t; };
    const rep = (p, n, extra = {}) => Array(n).fill(p ? hand({ pose: p, ...extra }) : null);
    const out = [];
    const c = new Controller(8);
    let t = feed(c, rep('open', 10), 0); out.push(c.state.state);
    t = feed(c, [...rep('snap_pressed', 4), ...rep('snap_released', 2)], t); out.push(c.state.state);
    t = feed(c, [...rep('open', 10), ...rep('fist', 10)], t); out.push(c.state.state, c.state.index);
    t = feed(c, [...rep('fist', 3, { angle: 0.1 }), ...rep('open', 10)], t); out.push(c.state.state, c.state.index);
    t = feed(c, [...rep(null, 5), ...rep('fist', 10)], t); out.push(c.state.state);
    const k = new Controller(8); k.keySnap(1.0); k.tick(1.01);
    const kick = [k.state.consumeKick(), k.state.consumeKick()];
    const d = new Controller(8); d.keySnap(0); d.keySnap(1); const dis = d.state.state; d.tick(2.5);
    // machine: opening the hand only changes openness, the model stays formed
    const m = new Controller(4, () => true);
    let tm = feed(m, [...rep('snap_pressed', 4), ...rep('snap_released', 2), ...rep('fist', 10)], 0);
    const op = [];
    for (let i = 0; i <= 20; i++) { m.onHand(hand({ pose: 'partial', f: i / 20 }), tm); tm += 1 / 30; op.push(+m.openness.toFixed(2)); }
    feed(m, rep('open', 10), tm);
    return { out, kick, dis, after: d.state.state, machine: [m.state.state, m.state.index], op };
  });
  expect(r.out).toEqual(['idle', 'sphere', 'formed', 0, 'sphere', 1, 'formed']);
  expect(r.kick).toEqual([true, false]);
  expect([r.dis, r.after]).toEqual(['dissolve', 'idle']);
  expect(r.machine).toEqual(['formed', 0]);
  expect(r.op[0]).toBeLessThan(0.05); expect(r.op[20]).toBeGreaterThan(0.95);
});

test('hand twist (roll) is measured at any pose and aspect, and smoothed', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { Controller } = await import('/src/logic/controller.js');
    const { hand } = await import('/src/logic/synth.js');
    const angles = [-1.0, -0.4, 0, 0.3, 0.9];
    const raw = angles.map((a) => ['open', 'fist', 'partial'].map((pose) => Controller.rollOf(hand({ pose, angle: a, f: 0.5 }))));
    // a 16:9 camera squeezes x: rollOf must undo it when told the aspect
    const squeezed = hand({ pose: 'open', angle: 0.5 }).map(([x, y]) => [0.5 + (x - 0.5) / (16 / 9), y]);
    const c = new Controller(4); let t = 0;
    for (let i = 0; i < 20; i++) { c.onHand(hand({ pose: 'fist', angle: 0.6 }), t); t += 1 / 30; }
    return { angles, raw, aspect: Controller.rollOf(squeezed, 16 / 9), smoothed: c.roll };
  });
  r.raw.forEach((row, i) => row.forEach((v) => expect(Math.abs(v - r.angles[i])).toBeLessThan(1e-6)));
  expect(Math.abs(r.aspect - 0.5)).toBeLessThan(1e-6);
  expect(Math.abs(r.smoothed - 0.6)).toBeLessThan(1e-3);
});

test('CPU physics twin: burst -> shell, form converges & is staggered, explode/contract, dissolve, idle, any fps', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const Sim = await import('/src/logic/simRef.js');
    const { makeRng } = await import('/src/lib/rng.js');
    const { buildModel } = await import('/src/models/catalog.js');
    const { rotY } = await import('/src/lib/vec.js');
    const N = 3000, rng = makeRng(0), seed = Sim.makeSeeds(N, rng);
    const mdl = buildModel(11, N);                                                 // Inline-4 (has explode offsets)
    const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const init = () => Array.from({ length: N }, () => ({ p: [rng.normal() * 1e-3, rng.normal() * 1e-3, rng.normal() * 1e-3], v: [0, 0, 0] }));
    const at = (arr, k, n) => Array.from({ length: n }, (_, j) => arr[k * n + j]);
    const run = (P, mode, secs, { dt = 1 / 60, kickFirst = false, rot = () => I, formT0 = 0, explode = 0 } = {}) => {
      const steps = Math.round(secs / dt);
      for (let i = 0; i < steps; i++) {
        const u = { dt, time: i * dt, mode, formT: formT0 + i * dt, kick: kickFirst && i === 0 ? 1 : 0, rot: rot(i * dt), sphereR: 0.85, explode, scale: 1, exCenter: [0, 0, 0] };
        for (let k = 0; k < N; k++) { const [p, v] = Sim.stepParticle(P[k].p, P[k].v, at(mdl.target, k, 3), at(seed, k, 4), at(mdl.offset, k, 4), u); P[k].p = p; P[k].v = v; }
      }
      return P;
    };
    const norm = (a) => Math.hypot(...a);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
    const errTo = (P, f) => P.map((x, k) => norm([0, 1, 2].map((a) => x.p[a] - f(k, a))));
    const out = {};
    let P = run(init(), Sim.SPHERE, 2.5, { kickFirst: true });
    const rs = P.map((x) => norm(x.p));
    out.shellMean = mean(rs); out.shell99 = pct(rs, 0.99); out.swirl = mean(P.map((x) => norm(x.v)));
    P = run(P, Sim.FORM, 2.5);
    const err = errTo(P, (k, a) => mdl.target[3 * k + a]);
    out.formMean = mean(err); out.formMax = Math.max(...err);
    let Q = run(run(init(), Sim.SPHERE, 1.5, { kickFirst: true }), Sim.FORM, 0.45);
    const e2 = errTo(Q, (k, a) => mdl.target[3 * k + a]);
    out.early = mean(e2.filter((_, k) => seed[4 * k + 3] < 0.2)); out.late = mean(e2.filter((_, k) => seed[4 * k + 3] > 0.8));
    // tracking a spinning target lags by ~r * omega * 2/sqrt(k): measured on the slim Eiffel Tower like the original test
    const eif = buildModel(1, N), spin = (t) => rotY(0.35 * t);
    Q = Array.from({ length: N }, () => ({ p: [0, 0, 0], v: [0, 0, 0] }));
    for (let i = 0; i < 240; i++) {
      const u = { dt: 1 / 60, time: i / 60, mode: Sim.FORM, formT: i / 60, kick: 0, rot: spin(i / 60), sphereR: 0.85, explode: 0, scale: 1, exCenter: [0, 0, 0] };
      for (let k = 0; k < N; k++) { const [p, v] = Sim.stepParticle(Q[k].p, Q[k].v, at(eif.target, k, 3), at(seed, k, 4), [0, 0, 0, 0], u); Q[k].p = p; Q[k].v = v; }
    }
    const R = spin(4.0 - 1 / 60);
    out.track = mean(errTo(Q, (k, a) => R[a][0] * eif.target[3 * k] + R[a][1] * eif.target[3 * k + 1] + R[a][2] * eif.target[3 * k + 2]));
    P = run(P, Sim.FORM, 2.0, { formT0: 5, explode: 1 });                          // open hand: every part at target + offset
    out.explodeErr = mean(errTo(P, (k, a) => mdl.target[3 * k + a] + mdl.offset[4 * k + a]));
    P = run(P, Sim.FORM, 2.0, { formT0: 7, explode: 0 });                          // close the hand: back together
    out.contractErr = mean(errTo(P, (k, a) => mdl.target[3 * k + a]));
    let D = Array.from({ length: N }, (_, k) => ({ p: at(mdl.target, k, 3), v: [0, 0, 0] }));
    D = run(D, Sim.DISSOLVE, 1.2);
    out.dissolveMean = mean(D.map((x) => norm(x.p)));
    const ext = [0, 1, 2].map((a) => Math.max(...D.map((x) => x.p[a])) - Math.min(...D.map((x) => x.p[a])));
    out.dissolveAniso = Math.max(...ext) / Math.min(...ext);
    D = run(D, Sim.IDLE, 1.0);
    out.idleMax = Math.max(...D.map((x) => norm(x.p))); out.idleV = Math.max(...D.map((x) => norm(x.v)));
    out.fps = [1 / 20, 1 / 30, 1 / 144].map((dt) => mean(errTo(run(run(init(), Sim.SPHERE, 1.0, { dt, kickFirst: true }), Sim.FORM, 2.5, { dt }), (k, a) => mdl.target[3 * k + a])));
    return out;
  });
  console.log(r);
  expect(Math.abs(r.shellMean - 0.85 * 0.965)).toBeLessThan(0.08);
  expect(r.shell99).toBeLessThan(1.05);
  expect(r.swirl).toBeGreaterThan(0.2);
  expect(r.formMean).toBeLessThan(0.005); expect(r.formMax).toBeLessThan(0.05);
  expect(r.early).toBeLessThan(r.late * 0.6);
  expect(r.track).toBeLessThan(0.02);
  expect(r.explodeErr).toBeLessThan(0.01);
  expect(r.contractErr).toBeLessThan(0.01);
  expect(r.dissolveMean).toBeGreaterThan(1.5); expect(r.dissolveAniso).toBeLessThan(1.6);
  expect(r.idleMax).toBeLessThan(0.01); expect(r.idleV).toBe(0);
  for (const e of r.fps) expect(e).toBeLessThan(0.01);
});

test('point & pinch poses, and the voice-command parser', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const G = await import('/src/logic/gestures.js');
    const { hand } = await import('/src/logic/synth.js');
    const { parseCommand } = await import('/src/features.js');
    const { CATALOG, buildModel } = await import('/src/models/catalog.js');
    const heart = buildModel(CATALOG.findIndex((d) => d.name === 'Human Heart'), 5000).labels;
    const say = (t, labels = []) => parseCommand(t, CATALOG, labels).map((a) => a.type === 'model' ? a.name : a.type === 'part' ? labels[a.index].label : a.type);
    return {
      point: [0, 0.7, -0.5].map((angle) => G.classify(hand({ pose: 'point', angle }))),
      pinch: [G.pinched(hand({ pose: 'pinch' })), G.pinched(hand({ pose: 'fist' })), G.pinched(hand({ pose: 'open' })), G.pinched(hand({ pose: 'snap_pressed' }))],
      cmds: {
        a: say('show me the heart'), b: say('show me the human brain and explode it'), c: say('where is the right atrium', heart),
        d: say('left atrium please', heart), e: say('next'), f: say('start the quiz'), g: say('stop quiz'), h: say('zoom in'),
        i: say('what is this'), j: say('put it back together'), k: say('go to the rocket'), l: say('hello there'),
        m: say('show me the aorta', heart), n: say('cut it open'),
      },
    };
  });
  expect(r.point).toEqual(['point', 'point', 'point']);
  expect(r.pinch).toEqual([true, false, false, false]);
  expect(r.cmds.a).toEqual(['Human Heart']);
  expect(r.cmds.b).toEqual(['Human Brain', 'explode']);
  expect(r.cmds.c).toEqual(['Right atrium']);
  expect(r.cmds.d).toEqual(['Left atrium']);
  expect(r.cmds.e).toEqual(['next']);
  expect(r.cmds.f).toEqual(['quiz']);
  expect(r.cmds.g).toEqual(['stopQuiz']);
  expect(r.cmds.h).toEqual(['zoomIn']);
  expect(r.cmds.i).toEqual(['describe']);
  expect(r.cmds.j).toEqual(['assemble']);
  expect(r.cmds.k).toEqual(['Saturn V Rocket']);
  expect(r.cmds.l).toEqual([]);
  expect(r.cmds.m).toEqual(['Aorta']);
  expect(r.cmds.n).toEqual(['explode', 'cut']);
});
