import { expect, test } from '@playwright/test';
import { WORKSPACE_FIXTURE, bridgeState, expectIndex, openIframe, prepare } from './helpers';

test.beforeEach(async ({ page }) => prepare(page));

test('optional workspace wrapper: iframe pause, resume, jump and lock drive the real scene clock', async ({ page }) => {
  const frame = await openIframe(page, WORKSPACE_FIXTURE);
  const player = frame.locator('[data-scene]');
  const send = async (payload: object) => {
    await page.evaluate((payload) => {
      document.querySelector('iframe')!.contentWindow!.postMessage({
        type: 'REPLIT_VIDEO_CONTROLS_COMMAND', payload,
      }, location.origin);
    }, payload);
  };
  await page.clock.runFor(1000);
  await send({ command: 'setPaused', paused: true });
  await expect.poll(async () => (await bridgeState(frame)).paused).toBe(true);
  await page.clock.runFor(10_000);
  await expect(player).toHaveAttribute('data-fired', 'false');
  await expectIndex(frame, 0);
  await send({ command: 'setPaused', paused: false });
  await expect.poll(async () => (await bridgeState(frame)).paused).toBe(false);
  await page.clock.runFor(1001);
  await expect(player).toHaveAttribute('data-fired', 'true');
  await send({ command: 'jumpToScene', sceneIndex: 1 });
  await expectIndex(frame, 1);
  await send({ command: 'setSceneLock', locked: true });
  await expect.poll(async () => (await bridgeState(frame)).locked).toBe(true);
  const mount = await player.getAttribute('data-mount');
  await page.clock.runFor(10_820);
  await expectIndex(frame, 1);
  expect(await player.getAttribute('data-mount')).not.toBe(mount);
  expect((await bridgeState(frame)).loopEpoch).toBe(2);
  await send({ command: 'setSceneLock', locked: false });
  await expect.poll(async () => (await bridgeState(frame)).locked).toBe(false);
  await page.clock.runFor(5420);
  await expectIndex(frame, 0);
});

test('optional workspace wrapper: standalone stays unwrapped and ignores control messages', async ({ page }) => {
  await page.goto(WORKSPACE_FIXTURE);
  const player = page.locator('[data-scene]');
  await expect(player).toHaveAttribute('data-scene', 'hook');
  // No extra wrapping div on the export path.
  await expect(page.locator('#root > [data-scene]')).toHaveCount(1);
  await page.evaluate(() => window.postMessage({
    type: 'REPLIT_VIDEO_CONTROLS_COMMAND',
    payload: { command: 'setPaused', paused: true },
  }, location.origin));
  await page.clock.runFor(6020);
  await expect(player).toHaveAttribute('data-scene', 'checklist');
  expect((await bridgeState(page.mainFrame())).paused).toBe(false);
});
