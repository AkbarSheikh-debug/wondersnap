// The interaction features: beating heart / breathing lungs, two-hand zoom, point-to-pick + pinch-to-pull, quiz,
// voice commands (+ read aloud), cut-away cross-section, video recording and the category tabs.
import { test, expect } from '@playwright/test';
import { openApp, shot, status, play, indexOf, watchErrors } from './helpers.js';

test.describe.configure({ mode: 'serial' });

/** Select a model and form it with the keyboard (no hand in view). */
async function formModel(page, name, explode = false) {
  const i = await indexOf(page, name);
  await page.evaluate((k) => window.wonderSnap.select(k), i);
  await play(page, 0.6, null);
  await page.keyboard.press('f');
  await play(page, 2.8, null);
  if (explode) { await page.keyboard.press('e'); await play(page, 2.2, null); }
  const s = await status(page);
  expect([s.state, s.name]).toEqual(['formed', name]);
  return s;
}
/** Feed a pointing hand whose index fingertip sits on a part's label anchor. */
async function pointAtPart(page, label, seconds = 0.8) {
  await page.evaluate(async ([lab, secs]) => {
    const W = window.wonderSnap;
    const aim = () => { const a = W.anchor(lab); if (!a) throw new Error(`no anchor for ${lab}`); return W.synth({ ...W.pointAt(a.x, a.y), pose: 'point' }); };
    await W.advance(0.25, aim());                     // point, let the view settle, then re-aim (like a person does)
    await W.advance(secs, aim());
  }, [label, seconds]);
}
const brightPixels = (page) => page.evaluate(() => {
  const gl = window.wonderSnap.app.renderer.gl, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, b = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
  let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] + b[i + 1] + b[i + 2] > 150) n++;
  return n;
});

test('14 the heart beats (lub-dub at 72 bpm) and the lungs breathe', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await formModel(page, 'Human Heart');
  const samples = [];
  for (let i = 0; i < 40; i++) { await play(page, 0.05, null); samples.push((await status(page)).pulse); }
  const lo = Math.min(...samples), hi = Math.max(...samples);
  expect(lo).toBeLessThan(0.965);                 // contraction
  expect(hi).toBeGreaterThan(0.995);              // relaxation
  const beats = samples.filter((v, i) => i && v < 0.97 && samples[i - 1] >= 0.97).length;
  expect(beats).toBeGreaterThanOrEqual(2);        // ~1.2 beats per second over 2 s (lub + dub)
  expect((await status(page)).flow).toBeGreaterThan(0.9);
  await shot(page, '14a-heart-beating-with-blood-flow');
  await formModel(page, 'Lungs');
  const br = [];
  for (let i = 0; i < 30; i++) { await play(page, 0.15, null); br.push((await status(page)).pulse); }
  expect(Math.max(...br)).toBeGreaterThan(1.04);  // inhale
  expect(Math.min(...br)).toBeLessThan(1.01);     // exhale
  await shot(page, '14b-lungs-breathing');
  noErrors();
});

test('15 two hands: spread apart to zoom in, bring together to zoom out', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await formModel(page, 'Human Eye');
  await play(page, 0.4, { pose: 'fist', cx: 0.30 });                              // first hand alone = primary
  await page.evaluate(async () => {
    const W = window.wonderSnap, t0 = W.app.t, H = (cx) => W.synth({ pose: 'open', cx, cy: 0.55, s: 0.08 });
    await W.advance(0.5, H(0.30), H(0.45));
    await W.advance(1.5, H(0.30), (t) => H(0.45 + 0.35 * Math.min(1, (t - t0 - 0.5) / 1.2)));
  });
  let s = await status(page);
  expect(s.twoHands).toBe(true);
  expect(s.zoom).toBeGreaterThan(1.6);
  await shot(page, '15a-two-hands-zoom-in');
  await page.evaluate(async () => {
    const W = window.wonderSnap, t0 = W.app.t, H = (cx) => W.synth({ pose: 'open', cx, cy: 0.55, s: 0.08 });
    await W.advance(1.6, H(0.30), (t) => H(0.80 - 0.45 * Math.min(1, (t - t0) / 1.2)));
  });
  s = await status(page);
  expect(s.zoom).toBeLessThan(1.0);
  await shot(page, '15b-two-hands-zoom-out');
  await page.keyboard.press('0');
  await play(page, 1, null);
  expect(Math.abs((await status(page)).zoom - 1)).toBeLessThan(0.05);
  noErrors();
});

test('16 point at a part to learn it, pinch to pull it out, click works too', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await formModel(page, 'Human Brain');
  await play(page, 2.0, { pose: 'open' });                                         // open hand = exploded
  expect((await status(page)).explode).toBeGreaterThan(0.95);
  await play(page, 0.2, { ramp: [1, 0.3] });                                       // fingers curl on the way to pointing...
  await pointAtPart(page, 'Hippocampus');
  let s = await status(page);
  expect(s.selected).toBe('Hippocampus');
  expect(s.explode).toBeGreaterThan(0.9);                                          // pointing does not collapse the view
  await expect(page.locator('#partCard')).toBeVisible();
  await expect(page.locator('#partCard .pname')).toHaveText('Hippocampus');
  await expect(page.locator('#partCard .pinfo')).toContainText('memory');
  await shot(page, '16a-point-selects-hippocampus');
  await play(page, 0.35, { pose: 'pinch' });                                       // pinch = pull it out toward you
  await play(page, 0.8, { pose: 'pinch' });
  s = await status(page);
  expect(s.pulled).toBe(true);
  expect(s.pullAmt).toBeGreaterThan(0.9);
  await shot(page, '16b-pinch-pulls-part-out');
  await play(page, 0.3, null);
  await play(page, 0.4, { pose: 'pinch' });                                        // pinch again = put it back
  expect((await status(page)).pulled).toBe(false);
  await play(page, 0.5, null);
  const a = await page.evaluate(() => {                                            // a part clear of the panels and of other parts
    const W = window.wonderSnap, P = W.app.model.labels.map((l) => ({ l: l.label, ...W.anchor(l.label) }));
    const far = (p) => P.every((q) => q === p || Math.hypot(q.x - p.x, q.y - p.y) > 80);
    return P.find((p) => p.x > 360 && p.x < 1250 && p.y > 150 && p.y < 720 && p.l !== 'Hippocampus' && far(p));
  });
  await page.mouse.click(a.x, a.y);
  await play(page, 0.2, null);
  expect((await status(page)).selected).toBe(a.l);
  await shot(page, '16c-click-selects-part');
  await page.keyboard.press('Escape');
  await play(page, 0.1, null);
  expect((await status(page)).selected).toBe(null);
  noErrors();
});

test('17 quiz: find the named part by pointing, with score', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await formModel(page, 'Human Heart');
  await page.keyboard.press('q');
  await play(page, 2.4, null);
  let s = await status(page);
  expect(s.quiz.phase).toBe('ask');
  expect(s.explode).toBeGreaterThan(0.9);                                          // the quiz explodes the model
  await expect(page.locator('#quiz .q')).toContainText(`Find: ${s.quiz.target}`);
  await shot(page, '17a-quiz-question');
  await pointAtPart(page, s.quiz.target);                                          // right answer
  s = await status(page);
  expect(s.quiz.score).toBe(1);
  expect(s.quiz.feedback).toContain('Correct');
  await shot(page, '17b-quiz-correct');
  await play(page, 2.0, null);                                                     // next question appears
  s = await status(page);
  expect([s.quiz.phase, s.quiz.asked]).toEqual(['ask', 2]);
  const wrong = await page.evaluate((target) => window.wonderSnap.app.model.labels.map((l) => l.label).find((l) => l !== target && window.wonderSnap.anchor(l)), s.quiz.target);
  await pointAtPart(page, wrong);                                                  // wrong answer -> the right part is revealed
  s = await status(page);
  expect(s.quiz.score).toBe(1);
  expect(s.quiz.feedback).toContain('❌');
  await shot(page, '17c-quiz-wrong-answer-reveals-right-part');
  for (let k = 0; k < 3; k++) {                                                    // answer the rest correctly
    await play(page, 2.0, null);
    await pointAtPart(page, (await status(page)).quiz.target);
  }
  await play(page, 2.0, null);
  s = await status(page);
  expect(s.quiz.done).toBe(true);
  expect(s.quiz.score).toBe(4);
  expect(s.explode).toBeGreaterThan(0.9);                                          // regression: pointing never collapses the view
  await expect(page.locator('#quiz .qf')).toContainText('Score 4 / 5');
  await shot(page, '17d-quiz-finished-score');
  noErrors();
});

test('18 voice commands drive the app and parts are read aloud', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.addInitScript(() => {                                                 // capture speech output
    window.__spoken = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  });
  await openApp(page);
  await page.keyboard.press('m');                                                  // voice on (read-aloud on)
  expect((await status(page)).voice.on).toBe(true);
  expect(await page.evaluate(() => window.wonderSnap.voice('show me the human heart'))).toEqual(['Human Heart']);
  await play(page, 3.2, null);
  let s = await status(page);
  expect([s.state, s.name]).toEqual(['formed', 'Human Heart']);
  expect(await page.evaluate(() => window.wonderSnap.voice('open it up'))).toContain('explode');
  await play(page, 2.2, null);
  expect((await status(page)).explode).toBeGreaterThan(0.95);
  expect(await page.evaluate(() => window.wonderSnap.voice('where is the right atrium'))).toEqual(['Right atrium']);
  await play(page, 0.3, null);
  s = await status(page);
  expect(s.selected).toBe('Right atrium');
  expect(await page.evaluate(() => window.__spoken.some((t) => t.includes('Right atrium')))).toBe(true);
  await shot(page, '18a-voice-selects-right-atrium');
  expect(await page.evaluate(() => window.wonderSnap.voice('what does it do'))).toEqual(['describe']);
  expect(await page.evaluate(() => window.__spoken.at(-1))).toContain('receives blood from the body');
  expect(await page.evaluate(() => window.wonderSnap.voice('zoom in'))).toEqual(['zoom in']);
  expect(await page.evaluate(() => window.wonderSnap.voice('put it back together'))).toContain('assemble');
  expect(await page.evaluate(() => window.wonderSnap.voice('next one'))).toEqual(['next']);
  await play(page, 3.2, null);
  expect((await status(page)).name).toBe('Kidney');
  expect(await page.evaluate(() => window.wonderSnap.voice('go to the rocket'))).toEqual(['Saturn V Rocket']);
  await play(page, 0.2, null);
  expect((await status(page)).activeCat).toBe('Vehicles');                         // the catalog tab follows
  expect(await page.evaluate(() => window.wonderSnap.voice('blah blah'))).toEqual([]);
  await expect(page.locator('#toast')).toContainText('not understood');
  noErrors();
});

test('19 cut-away: the hand slides a cutting plane through the model', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await formModel(page, 'Human Heart');
  await page.keyboard.press('r');                                                  // hold the view still for a fair pixel count
  await play(page, 0.5, null);
  const full = await brightPixels(page);
  await page.keyboard.press('x');
  const c = await page.evaluate(() => { const W = window.wonderSnap, a = W.app; return a.toNorm([(a.projView[12] / a.projView[15] * 0.5 + 0.5) * a.overlay.width, 0])[0]; });
  await play(page, 1.2, { pose: 'fist', cx: c - 0.02, cy: 0.6 });                // palm a bit left of the model centre
  let s = await status(page);
  expect(s.cut.on).toBe(true);
  expect(s.cut.x).toBeLessThan(0.05);
  const cutPx = await brightPixels(page);
  expect(cutPx).toBeLessThan(full * 0.75);                                         // a big slice is hidden
  await shot(page, '19a-cut-away-cross-section');
  await play(page, 1.2, { pose: 'fist', cx: c + 0.12, cy: 0.6 });                // slide the plane to the right
  s = await status(page);
  expect(s.cut.x).toBeGreaterThan(0.35);
  expect(await brightPixels(page)).toBeGreaterThan(cutPx);
  await shot(page, '19b-cut-plane-moved');
  await page.keyboard.press('x');
  await play(page, 0.3, null);
  expect((await status(page)).cut.on).toBe(false);
  noErrors();
});

test('20 record a video of the session (real-time)', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/?autostart=nocamera&n=150000&model=12');
  await page.waitForFunction(() => window.wonderSnap?.status().uploaded === 12);
  await page.keyboard.press('Space');
  await page.keyboard.press('k');
  await page.waitForTimeout(600);
  await page.keyboard.press('f');
  await page.waitForTimeout(2600);
  expect((await status(page)).recording).toBe(true);
  await shot(page, '20a-recording-indicator');
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('k')]);
  const path = `.tmp/${download.suggestedFilename()}`;
  await download.saveAs(path);
  expect(download.suggestedFilename()).toMatch(/^wondersnap-.*\.webm$/);
  const s = await status(page);
  expect(s.recording).toBe(false);
  expect(s.lastRecording.size).toBeGreaterThan(20_000);
  const { statSync } = await import('node:fs');
  expect(statSync(path).size).toBe(s.lastRecording.size);
  noErrors();
});

test('21 category tabs show each collection; the catalog has 33 models', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  const tabs = await page.locator('.tab').allTextContents();
  expect(tabs.map((t) => t.split(' ·')[0])).toEqual(['Wonders', 'Anatomy', 'Biology', 'Engines', 'Vehicles', 'Machines']);
  let total = 0;
  for (const t of ['Wonders', 'Anatomy', 'Biology', 'Engines', 'Vehicles', 'Machines']) {
    await page.locator('.tab', { hasText: t }).click();
    const n = await page.locator('.chip:visible').count();
    expect(n).toBeGreaterThan(0);
    total += n;
    if (t === 'Anatomy') await shot(page, '21a-anatomy-tab');
  }
  expect(total).toBe(33);
  await page.locator('.tab', { hasText: 'Machines' }).click();
  await page.getByRole('button', { name: 'Mechanical Watch' }).click();
  await play(page, 3.2, null);
  expect((await status(page)).name).toBe('Mechanical Watch');
  await page.keyboard.press('e');
  await play(page, 2.2, null);
  await shot(page, '21b-watch-exploded-from-machines-tab');
  noErrors();
});
