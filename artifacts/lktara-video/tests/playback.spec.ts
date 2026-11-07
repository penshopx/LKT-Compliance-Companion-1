import { expect, test } from '@playwright/test';
import { BASE, DURATIONS, SCENES, expectIndex, expectScene, openIframe, prepare } from './helpers';

test.beforeEach(async ({ page }) => prepare(page));

test('iframe: pause freezes scene, progress, DOM animation and audio; resume uses remaining time', async ({ page }) => {
  const frame = await openIframe(page);
  await expectScene(frame, 0);
  await expect(frame.locator('audio')).toHaveJSProperty('paused', false);
  await frame.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'animation-probe';
    document.body.append(probe);
    probe.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100000 });
  });
  await page.clock.runFor(1200);
  await frame.getByRole('button', { name: 'Pause', exact: true }).click();
  const timer = await frame.getByRole('timer').textContent();
  await expect(frame.locator('audio')).toHaveJSProperty('paused', true);
  expect(await frame.evaluate(() => document.querySelector('#animation-probe')!.getAnimations()[0].playState)).toBe('paused');
  await page.clock.runFor(10_000);
  await expectScene(frame, 0);
  await expect(frame.getByRole('timer')).toHaveText(timer!);
  await frame.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(frame.locator('audio')).toHaveJSProperty('paused', false);
  expect(await frame.evaluate(() => document.querySelector('#animation-probe')!.getAnimations()[0].playState)).toBe('running');
  await page.clock.runFor(4790);
  await expectScene(frame, 0);
  await page.clock.runFor(20);
  await expectScene(frame, 1);
});

test('iframe: every scene jump restarts the selected scene, seeks audio and announces its source', async ({ page }) => {
  const frame = await openIframe(page);
  for (const index of [2, 5, 1, 4, 3, 0]) {
    await frame.getByRole('button', { name: 'Pause', exact: true }).click();
    await frame.getByRole('button', { name: `Jump to scene ${index + 1}`, exact: true }).click();
    await expectScene(frame, index);
    await expect(frame.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    const start = DURATIONS.slice(0, index).reduce((sum, duration) => sum + duration, 0) / 1000;
    await expect.poll(async () => frame.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
      .toBeGreaterThanOrEqual(start);
    expect(await frame.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeLessThan(start + 1);
    await expect.poll(() => page.evaluate(() => (window as unknown as {
      sceneSelections: { sceneIndex: number }[];
    }).sceneSelections.at(-1)?.sceneIndex)).toBe(index);
    const selected = await page.evaluate(() => (window as unknown as {
      sceneSelections: { filePath: string; lineNumber: number; sceneCount: number }[];
    }).sceneSelections.at(-1));
    expect(selected).toMatchObject({ sceneCount: 6, lineNumber: 1 });
    expect(selected!.filePath).toMatch(/src\/components\/video\/scenes\/\w+Scene.tsx$/);
    await page.clock.runFor(DURATIONS[index] - 20);
    await expectScene(frame, index);
    await page.clock.runFor(40);
    await expectScene(frame, (index + 1) % 6);
  }
});

test('iframe: scene lock repeats across multiple boundaries; unlock and jumping while locked work', async ({ page }) => {
  const frame = await openIframe(page);
  await frame.getByRole('button', { name: 'Jump to scene 3', exact: true }).click();
  const lock = frame.getByRole('button', { name: 'Loop current scene', exact: true });
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  for (let repeat = 0; repeat < 3; repeat++) {
    await page.clock.runFor(5420);
    await expectScene(frame, 2);
    await expectIndex(frame, (repeat + 1) % 2);
    // Each repeat mounts new scene content/audio rather than merely holding
    // the last frame and leaving the progress indicator on scene 3.
    expect(await frame.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeLessThan(12.4);
  }
  await frame.getByRole('button', { name: 'Jump to scene 5', exact: true }).click();
  await page.clock.runFor(7620);
  await expectScene(frame, 4);
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await page.clock.runFor(3820);
  await expectScene(frame, 5);
});

test('iframe: mute and unmute reach real audio and survive remount, pause and repeat', async ({ page }) => {
  const frame = await openIframe(page);
  await frame.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(frame.locator('audio')).toHaveJSProperty('muted', true);
  await frame.getByRole('button', { name: 'Jump to scene 4', exact: true }).click();
  await expect(frame.locator('audio')).toHaveJSProperty('muted', true);
  await frame.getByRole('button', { name: 'Loop current scene', exact: true }).click();
  await page.clock.runFor(6020);
  await expect(frame.locator('audio')).toHaveJSProperty('muted', true);
  await frame.getByRole('button', { name: 'Pause', exact: true }).click();
  await frame.getByRole('button', { name: 'Unmute', exact: true }).click();
  await expect(frame.locator('audio')).toHaveJSProperty('muted', false);
  await expect(frame.locator('audio')).toHaveJSProperty('paused', true);
  await frame.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(frame.locator('audio')).toHaveJSProperty('paused', false);
});

test('standalone: no controls; all six scenes play for 30 seconds, stop recording and loop', async ({ page }) => {
  await page.goto(BASE);
  const frame = page.mainFrame();
  await expect(page.locator('audio')).toBeAttached();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveJSProperty('muted', false);
  await expect(page.locator('audio')).toHaveJSProperty('paused', false);
  expect(await page.evaluate(() => window.__replitVideoTotalDurationMs)).toBe(30_000);
  expect(await page.evaluate(() => (window as unknown as { recordingStarts: number }).recordingStarts)).toBe(1);
  for (let index = 0; index < SCENES.length; index++) {
    await expectIndex(frame, index);
    await page.clock.runFor(DURATIONS[index] - 1);
    await expectIndex(frame, index);
    await page.clock.runFor(1);
  }
  await expectIndex(frame, 0);
  expect(await page.evaluate(() => (window as unknown as { recordingStops: number }).recordingStops)).toBe(1);
  await expect(page.getByRole('button')).toHaveCount(0);
});
