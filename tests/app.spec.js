// End-to-end: the real app, real shaders, real GPU — driven by synthetic hands (same landmarks MediaPipe emits)
// on a deterministic clock. Every step is screenshotted into screenshots/.
import { test, expect } from '@playwright/test';
import { openApp, shot, status, cloud, play, snap, indexOf, watchErrors } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test('01 start screen, then keyboard-only mode (real-time loop)', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/?n=200000');
  await expect(page.locator('#start')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, '01a-start-screen');
  await page.click('#bStartNoCam');
  await expect(page.locator('#start')).toBeHidden();
  await page.waitForFunction(() => window.wonderSnap.status().uploaded === 0);
  await page.keyboard.press('Space');                                   // snap
  await page.waitForTimeout(1500);
  expect((await status(page)).state).toBe('sphere');
  await shot(page, '01b-realtime-sphere-after-space');
  await page.keyboard.press('f');                                       // fist
  await page.waitForTimeout(3000);
  const s = await status(page);
  expect(s.state).toBe('formed');
  expect(s.fps).toBeGreaterThan(20);
  await shot(page, '01c-realtime-turtle-tower');
  noErrors();
});

test('02 the original story: snap -> sphere -> fist -> wonder -> open -> next -> snap -> dissolve', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  expect((await status(page)).state).toBe('idle');
  await play(page, 0.5, { pose: 'open' });
  expect((await status(page)).state).toBe('idle');                      // an open hand alone does nothing

  await snap(page);
  let s = await status(page);
  expect(s.state).toBe('sphere');
  await shot(page, '02a-snap-burst');
  await play(page, 1.6, { pose: 'open' });
  const sphere = await cloud(page);
  expect(sphere.meanR).toBeGreaterThan(0.7);                            // particles swirl on a shell ~0.82
  expect(sphere.meanR).toBeLessThan(0.95);
  expect(sphere.maxR).toBeLessThan(1.1);                                // ...and never leave the globe
  await shot(page, '02b-swirling-sphere');

  await play(page, 0.25, { pose: 'fist' });
  expect((await status(page)).state).toBe('formed');
  await play(page, 0.35, { pose: 'fist' });
  await shot(page, '02c-particles-streaming-in');
  await play(page, 2.6, { pose: 'fist' });
  s = await status(page);
  expect([s.state, s.name]).toEqual(['formed', 'Turtle Tower']);
  const formed = await cloud(page);
  expect(formed.maxR).toBeLessThan(0.95);
  expect(formed.meanSpeed).toBeLessThan(0.5);                           // settled into the building
  await shot(page, '02d-formed-turtle-tower');

  await play(page, 0.4, { pose: 'open' });
  s = await status(page);
  expect([s.state, s.name]).toEqual(['sphere', 'Eiffel Tower']);        // open hand -> next wonder
  await play(page, 0.8, { pose: 'open' });
  await shot(page, '02e-sphere-morphs-to-next-colour');
  await play(page, 3, { pose: 'fist' });
  s = await status(page);
  expect([s.state, s.name]).toEqual(['formed', 'Eiffel Tower']);
  await shot(page, '02f-formed-eiffel-tower');

  await snap(page);
  expect((await status(page)).state).toBe('dissolve');
  await play(page, 0.5, null);
  await shot(page, '02g-snap-dissolve');
  await play(page, 1.0, null);
  expect((await status(page)).state).toBe('idle');
  await shot(page, '02h-idle-again');
  noErrors();
});

test('03 gallery: every wonder, engine and the car, formed', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  const names = await page.evaluate(() => window.wonderSnap.CATALOG.map((d) => d.name));
  for (let i = 0; i < names.length; i++) {
    await page.evaluate((k) => window.wonderSnap.select(k), i);
    await play(page, 0.6, null);
    await page.keyboard.press('f');
    await play(page, 3.0, null);
    const s = await status(page);
    expect([s.state, s.index, s.uploaded]).toEqual(['formed', i, i]);
    const c = await cloud(page);
    expect(c.finite).toBe(true);
    expect(c.maxR, names[i]).toBeLessThan(0.97);
    await shot(page, `03-gallery-${String(i).padStart(2, '0')}-${names[i].replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
  }
  noErrors();
});

async function explodeStory(page, name, tag) {
  const i = await indexOf(page, name);
  await page.evaluate((k) => window.wonderSnap.select(k), i);
  await play(page, 0.8, { pose: 'open' });
  expect((await status(page)).state).toBe('sphere');
  await play(page, 3.0, { pose: 'fist' });                                 // fist -> assemble
  let s = await status(page);
  expect([s.state, s.name, s.explode]).toEqual(['formed', name, 0]);
  const assembled = await cloud(page);
  await shot(page, `${tag}a-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-assembled`);

  await play(page, 1.2, { ramp: [0, 0.5] });                               // open the hand slightly...
  await play(page, 1.0, { ramp: [0.5, 0.5] });
  s = await status(page);
  expect(s.explode).toBeGreaterThan(0.25);
  expect(s.explode).toBeLessThan(0.8);
  await shot(page, `${tag}b-hand-half-open-${Math.round(s.explode * 100)}pct`);

  await play(page, 1.0, { ramp: [0.5, 1] });                               // ...then fully
  await play(page, 1.5, { pose: 'open' });
  s = await status(page);
  expect(s.explode).toBeGreaterThan(0.97);
  expect([s.state, s.name]).toEqual(['formed', name]);                     // open hand does NOT skip a machine
  const exploded = await cloud(page);
  // the exploded view is zoomed out by s.scale to stay on screen, so compare sizes in model units
  const span = (c) => Math.max(c.hi[0] - c.lo[0], c.hi[1] - c.lo[1], c.hi[2] - c.lo[2]);
  expect(s.scale).toBeLessThan(0.95);
  expect(span(exploded) / s.scale).toBeGreaterThan(span(assembled) * 1.25);  // parts really flew apart
  expect(exploded.maxR).toBeLessThan(1.35);                                // ...but stay on screen
  await shot(page, `${tag}c-hand-open-fully-exploded`);

  await play(page, 1.5, { ramp: [1, 0] });                                 // close the hand -> contract
  await play(page, 1.5, { pose: 'fist' });
  s = await status(page);
  expect(s.explode).toBeLessThan(0.02);
  const back = await cloud(page);
  expect(Math.abs(back.meanR - assembled.meanR)).toBeLessThan(0.03);       // one single machine again
  await shot(page, `${tag}d-fist-contracted-again`);
}

test('04 Inline-4 engine: open hand = exploded view, fist = assembled', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await explodeStory(page, 'Inline-4 Engine', '04');
  noErrors();
});

test('05 Sports car: open hand shows everything inside, fist puts it back together', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await explodeStory(page, 'Sports Car', '05');
  noErrors();
});

test('06 every machine exploded (keyboard E) with part labels', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  const machines = await page.evaluate(() => window.wonderSnap.CATALOG.map((d, i) => [i, d.name, d.kind]).filter((d) => d[2] === 'machine'));
  for (const [i, name] of machines) {
    await page.evaluate((k) => window.wonderSnap.select(k), i);
    await play(page, 0.6, null);
    await page.keyboard.press('f');
    await play(page, 2.6, null);
    await page.keyboard.press('e');                                        // explode without a hand
    await play(page, 2.2, null);
    const s = await status(page);
    expect(s.explode, name).toBeGreaterThan(0.97);
    await shot(page, `06-exploded-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    await page.keyboard.press('e');                                        // and back
    await play(page, 1.5, null);
    expect((await status(page)).explode).toBeLessThan(0.02);
  }
  noErrors();
});

test('07 peace sign jumps to the next model; a short blip does not', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await snap(page);
  await play(page, 3, { pose: 'fist' });
  expect((await status(page)).name).toBe('Turtle Tower');
  await play(page, 0.1, { pose: 'peace' });                                // 3 frames: ignored
  await play(page, 0.2, { pose: 'fist' });
  expect((await status(page)).name).toBe('Turtle Tower');
  await play(page, 0.4, { pose: 'peace' });
  let s = await status(page);
  expect([s.state, s.name]).toEqual(['sphere', 'Eiffel Tower']);
  await shot(page, '07a-peace-next');
  await play(page, 3, { pose: 'fist' });
  expect((await status(page)).state).toBe('formed');
  // machines also advance with ✌ (open hand explodes them instead)
  const i4 = await indexOf(page, 'Inline-4 Engine');
  await page.evaluate((k) => window.wonderSnap.select(k), i4);
  await play(page, 3, { pose: 'fist' });
  await play(page, 0.4, { pose: 'peace' });
  s = await status(page);
  expect([s.state, s.name]).toEqual(['sphere', 'Supercharged HEMI V8']);
  noErrors();
});

test('08 keyboard, mouse wheel, slider, catalog chips and help', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await page.keyboard.press('ArrowRight');                                  // next model, auto-forms after 1 s
  await play(page, 3.2, null);
  let s = await status(page);
  expect([s.state, s.name]).toEqual(['formed', 'Eiffel Tower']);
  await page.keyboard.press('ArrowLeft');
  await play(page, 3.2, null);
  expect((await status(page)).name).toBe('Turtle Tower');

  await page.locator('.tab', { hasText: 'Engines' }).click();               // category tab
  await page.getByRole('button', { name: 'Supercharged HEMI V8' }).click();  // catalog chip
  await play(page, 3.2, null);
  s = await status(page);
  expect([s.state, s.name]).toEqual(['formed', 'Supercharged HEMI V8']);
  await expect(page.locator('#explodeBox')).toBeVisible();

  await page.mouse.move(1150, 450);
  for (let k = 0; k < 6; k++) await page.mouse.wheel(0, -100);            // wheel up = explode
  await play(page, 1.5, null);
  s = await status(page);
  expect(s.explode).toBeGreaterThan(0.35);
  await page.locator('#explodeSlider').fill('100');                         // slider
  await play(page, 1.8, null);
  expect((await status(page)).explode).toBeGreaterThan(0.97);
  await shot(page, '08a-v8-exploded-by-slider');

  await page.mouse.move(1100, 450); await page.mouse.down(); await page.mouse.move(1300, 450, { steps: 5 }); await page.mouse.up();
  await play(page, 0.3, null);
  expect(await page.evaluate(() => window.wonderSnap.app.dragYaw)).toBeGreaterThan(1);

  await page.keyboard.press('h');
  await expect(page.locator('#help')).toBeVisible();
  await play(page, 0.1, null);
  await shot(page, '08b-help-panel');
  await page.keyboard.press('h');
  await page.keyboard.press('l');
  expect(await page.evaluate(() => window.wonderSnap.app.labelsOn)).toBe(false);
  await page.keyboard.press('Space');
  expect((await status(page)).state).toBe('dissolve');
  noErrors();
});

test('09 demo mode plays the whole story with a synthetic hand (real-time)', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/?autostart=nocamera&n=200000');
  await page.waitForFunction(() => window.wonderSnap?.status().uploaded === 0);
  await page.keyboard.press('d');
  await page.waitForFunction(() => window.wonderSnap.status().state === 'formed', null, { timeout: 20_000 });
  await page.waitForTimeout(1200);
  await shot(page, '09a-demo-eiffel');
  await page.waitForFunction(() => window.wonderSnap.status().explode > 0.9, null, { timeout: 40_000 });
  await page.waitForTimeout(700);
  const s = await status(page);
  expect(s.kind).toBe('machine');
  await shot(page, '09b-demo-engine-exploded-by-hand');
  noErrors();
});

test('10 phone-sized layout', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, 'n=120000');
  await page.evaluate(async () => { const W = window.wonderSnap; W.select(W.CATALOG.findIndex((d) => d.name === 'Sports Car')); });
  await play(page, 0.6, null);
  await page.keyboard.press('f');
  await play(page, 3, null);
  await shot(page, '10a-mobile-car');
  await page.keyboard.press('e');
  await play(page, 2, null);
  await shot(page, '10b-mobile-car-exploded');
  noErrors();
});

test('11 Human brain: open hand splits it open, fist puts it back together', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await explodeStory(page, 'Human Brain', '11');
  noErrors();
});

test('12 anatomy showcase: brain, heart, kidney exploded with every part named + what it does, turned by hand', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  for (const name of ['Human Brain', 'Human Heart', 'Kidney']) {
    const i = await indexOf(page, name);
    await page.evaluate((k) => window.wonderSnap.select(k), i);
    await play(page, 0.6, { pose: 'open' });
    await play(page, 3.0, { pose: 'fist' });
    const tag = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await shot(page, `12-${tag}-a-assembled`);
    await play(page, 1.5, { ramp: [0, 1] });
    await play(page, 1.0, { pose: 'open', angle: 0.35 });                   // twist the open hand -> 3/4 view
    await play(page, 1.0, { pose: 'open', angle: 0.35 });
    const s = await status(page);
    expect([s.state, s.name]).toEqual(['formed', name]);
    expect(s.explode).toBeGreaterThan(0.97);
    expect(s.handRotating).toBe(true);
    const labels = await page.evaluate(() => window.wonderSnap.app.model.labels.map((l) => [l.label, l.info]));
    expect(labels.length).toBeGreaterThanOrEqual(9);
    for (const [label, info] of labels) expect(info.length, label).toBeGreaterThan(8);
    await shot(page, `12-${tag}-b-exploded-named-parts`);
  }
  noErrors();
});

test('13 twist your hand to rotate the model, raise / lower it to tilt, G turns it off', async ({ page }) => {
  const noErrors = watchErrors(page);
  await openApp(page);
  await page.evaluate(async (k) => window.wonderSnap.select(k), await indexOf(page, 'Human Heart'));
  await play(page, 0.6, { pose: 'open' });
  await play(page, 3.0, { pose: 'fist' });
  let s = await status(page);
  expect([s.state, s.handRotating]).toEqual(['formed', true]);
  const y0 = s.yaw;
  await play(page, 1.0, { pose: 'fist' });
  expect(Math.abs((await status(page)).yaw - y0)).toBeLessThan(0.02);        // hand still -> model still (no auto-spin)
  await shot(page, '13a-heart-hand-upright');
  await play(page, 1.2, { pose: 'fist', angle: 0.5 });                          // twist clockwise 29 deg
  s = await status(page);
  expect(s.yaw - y0).toBeGreaterThan(0.95); expect(s.yaw - y0).toBeLessThan(1.25);   // ~2.2 x 0.5 rad
  await shot(page, '13b-heart-hand-twisted-right');
  await play(page, 1.2, { pose: 'fist', angle: -0.4 });                         // twist the other way
  s = await status(page);
  expect(s.yaw - y0).toBeLessThan(-0.75); expect(s.yaw - y0).toBeGreaterThan(-1.0);
  await shot(page, '13c-heart-hand-twisted-left');
  await play(page, 1.2, { pose: 'fist', angle: -0.4, cy: 0.40 });              // raise the hand -> tilt
  s = await status(page);
  expect(s.pitch).toBeLessThan(-0.3);
  await shot(page, '13d-heart-hand-raised-tilts');
  await play(page, 1.5, null);                                                  // hand gone -> auto-spin resumes
  const s2 = await status(page);
  expect(s2.handRotating).toBe(false);
  await play(page, 1.0, null);
  expect(Math.abs((await status(page)).yaw - s2.yaw)).toBeGreaterThan(0.2);
  await page.keyboard.press('g');                                               // hand rotation off
  await play(page, 0.5, { pose: 'fist' });
  const y1 = (await status(page)).yaw;
  await play(page, 1.2, { pose: 'fist', angle: 0.6 });
  s = await status(page);
  expect(s.handRotating).toBe(false);
  expect(Math.abs(s.yaw - y1 - 0.35 * 1.2)).toBeLessThan(0.1);                 // only the auto-spin moved it
  noErrors();
});
