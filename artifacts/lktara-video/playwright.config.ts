import { defineConfig } from '@playwright/test';

const ci = Boolean(process.env.CI);
const ciOrigin = 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: '../../generated-artifacts/video-controls',
  reporter: 'list',
  use: {
    // Locally use the managed artifact through Replit's shared proxy.
    baseURL: process.env.VIDEO_TEST_BASE_URL ?? (ci ? ciOrigin : 'http://localhost'),
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  // CI has no managed Replit service. Locally never start a duplicate server.
  ...(ci ? {
    webServer: {
      command: 'pnpm run dev',
      env: { PORT: '5173', BASE_PATH: '/lktara-video/', NODE_ENV: 'production' },
      url: `${ciOrigin}/lktara-video/`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  } : {}),
});
