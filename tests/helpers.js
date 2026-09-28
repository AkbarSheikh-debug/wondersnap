// Shared helpers: open the app with a deterministic clock, drive it with synthetic hands, take screenshots.
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

export const SHOTS = 'screenshots';
mkdirSync(SHOTS, { recursive: true });

/** Collect console errors / page errors; call the returned fn at the end of a test to assert none. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

/** Open the app in manual-clock mode (frames only advance through wonderSnap.advance). */
export async function openApp(page, query = '') {
  await page.goto(`/?manual=1&dpr=1&${query}`);
  await page.waitForFunction(() => window.wonderSnap);
  await page.evaluate(() => window.wonderSnap.ready());
  await page.evaluate(() => window.wonderSnap.advance(1 / 60, null));
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export const status = (page) => page.evaluate(() => window.wonderSnap.status());
export const cloud = (page) => page.evaluate(() => window.wonderSnap.cloud());

const HAND = { cx: 0.33, cy: 0.58, s: 0.085 };

/**
 * Advance `seconds` of simulated time (60 fps render, 30 fps camera) with a synthetic hand:
 *   null                      -> no hand in view
 *   { pose: 'fist' }          -> a static pose
 *   { ramp: [f0, f1] }        -> hand opening/closing from openness f0 to f1 over the whole interval
 */
export async function play(page, seconds, hand) {
  await page.evaluate(async ([s, h, base]) => {
    const W = window.wonderSnap;
    let src = null;
    if (h && h.ramp) {
      const t0 = W.app.t;
      src = (t) => W.synth({ ...base, pose: 'partial', f: h.ramp[0] + (h.ramp[1] - h.ramp[0]) * Math.min(1, (t - t0) / s) });
    } else if (h) src = W.synth({ ...base, ...h });
    await W.advance(s, src);
  }, [seconds, hand ?? null, HAND]);
}

/** A real finger snap as the camera would see it: thumb+middle pressed, then the middle slams into the palm. */
export async function snap(page) {
  await play(page, 0.14, { pose: 'snap_pressed' });
  await play(page, 0.2, { pose: 'snap_released' });
}

export const indexOf = (page, name) => page.evaluate((n) => window.wonderSnap.CATALOG.findIndex((d) => d.name === n), name);
