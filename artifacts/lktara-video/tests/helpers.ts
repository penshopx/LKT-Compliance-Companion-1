import { expect, type Frame, type Page } from '@playwright/test';

export const BASE = '/lktara-video/';
const HOST = `${BASE}__controls-test-host`;
export const DURATIONS = [6000, 5400, 5400, 6000, 3800, 3400];
export const SCENES = ['hook', 'checklist', 'library', 'solve', 'honest', 'outro'];

export async function prepare(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
  await page.addInitScript(() => {
    Object.assign(window, { recordingStarts: 0, recordingStops: 0 });
    window.startRecording = async () => {
      (window as unknown as { recordingStarts: number }).recordingStarts++;
    };
    window.stopRecording = () => {
      (window as unknown as { recordingStops: number }).recordingStops++;
    };
  });
}

export async function openIframe(page: Page, src = BASE): Promise<Frame> {
  // Intercept only a synthetic parent document. The iframe loads the real app,
  // with its real React components, scene timers, animations and audio file.
  await page.route(`**${HOST}`, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<iframe title="Video test" src="${src}" style="width:1280px;height:720px;border:0"></iframe>
      <script>
        window.sceneSelections = [];
        window.addEventListener('message', e => {
          if (e.source === document.querySelector('iframe').contentWindow &&
              e.data?.type === 'REPLIT_VIDEO_SCENE_SELECTED') window.sceneSelections.push(e.data.payload);
        });
      </script>`,
  }));
  await page.goto(HOST);
  const iframe = page.frameLocator('iframe');
  await expect(iframe.locator('[data-video-aspect-ratio]')).toBeVisible();
  return (await page.locator('iframe').elementHandle())!.contentFrame().then((frame) => {
    if (!frame) throw new Error('Video iframe did not mount');
    return frame;
  });
}

export async function bridgeState(frame: Frame) {
  return frame.evaluate(async (base) => {
    const modulePath = `${base}src/lib/video/playerBridge.ts`;
    const { playerBridge } = await import(/* @vite-ignore */ modulePath);
    return playerBridge.getState() as {
      currentIndex: number;
      paused: boolean;
      locked: boolean;
      loopEpoch: number;
      remountEpoch: number;
    };
  }, BASE);
}

export async function expectIndex(frame: Frame, index: number) {
  await expect.poll(async () => (await bridgeState(frame)).currentIndex).toBe(index);
}

export async function expectScene(frame: Frame, index: number) {
  await expect(frame.getByRole('button', { name: `Jump to scene ${index + 1}`, exact: true }))
    .toHaveAttribute('aria-current', 'true');
}

// Served by Vite only during testing; never imported by the real film.
export const WORKSPACE_FIXTURE = `${BASE}tests/fixtures/workspace.html`;
