import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,   // run sequentially — app has shared WS mock state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:1422',
    trace:  'retain-on-failure',
    screenshot: 'only-on-failure',
    video:  'off',
    // Capture console output in tests
    launchOptions: { args: [] },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npx vite --port 1422',
    port:    1422,
    env: {
      ...process.env,
      VITE_MOCK: '1',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
