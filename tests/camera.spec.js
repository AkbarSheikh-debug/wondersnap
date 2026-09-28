// Real camera pipeline: getUserMedia -> <video> -> WebGL background texture + MediaPipe HandLandmarker (Tasks API).
// Chromium's fake webcam (--use-fake-device-for-media-stream) provides the frames, so this runs on any machine.
import { test, expect, chromium } from '@playwright/test';
import { shot, status, watchErrors } from './helpers.js';

test('camera + MediaPipe hand tracker run live on the webcam feed', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/?autostart=camera&n=200000');
  await page.waitForFunction(() => window.wonderSnap?.status().camera?.running, null, { timeout: 90_000 });
  await page.waitForFunction(() => window.wonderSnap.status().camera.frames > 45, null, { timeout: 60_000 });
  let s = await status(page);
  console.log(s.camera, s.gl);
  expect(s.camera.running).toBe(true);
  expect(['GPU', 'CPU']).toContain(s.camera.delegate);
  expect(s.camera.videoW).toBeGreaterThan(0);
  expect(s.camera.fps).toBeGreaterThan(10);                              // landmarker keeps up with the camera
  expect(s.pose).toBe('none');                                           // the fake feed has no hand in it
  await expect(page.locator('#bCam')).toHaveClass(/on/);
  await shot(page, 'cam-a-live-webcam-background');

  await page.keyboard.press('Space');                                    // keyboard still works alongside the camera
  await page.waitForTimeout(1500);
  await shot(page, 'cam-b-sphere-over-webcam');
  await page.keyboard.press('f');
  await page.waitForTimeout(3000);
  s = await status(page);
  expect(s.state).toBe('formed');
  expect(s.fps).toBeGreaterThan(20);
  await shot(page, 'cam-c-wonder-over-webcam');

  await page.keyboard.press('c');                                        // camera off
  await page.waitForTimeout(300);
  expect((await status(page)).camera).toBeNull();
  noErrors();
});

test('camera denied: friendly message and the app keeps working without it', async ({ baseURL }) => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, permissions: [] });
  const page = await context.newPage();
  await page.goto(`${baseURL}/?n=100000`);
  await page.click('#bStartCam');
  await expect(page.locator('#startMsg')).toContainText(/denied|No camera|Camera error/, { timeout: 30_000 });
  await shot(page, 'cam-d-permission-denied-message');
  await page.click('#bStartNoCam');
  await expect(page.locator('#start')).toBeHidden();
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  expect((await page.evaluate(() => window.wonderSnap.status())).state).toBe('sphere');
  await browser.close();
});
