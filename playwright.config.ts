import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node apps/api/dist/index.js',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PLAYWRIGHT_TEST: 'true',
        START_SERVER: 'true',
      },
    },
    {
      command: process.env.CI_E2E
        ? 'node apps/web/.next/standalone/apps/web/server.js'
        : 'npm run dev --workspace=@forgeboard/web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PORT: '3000',
      },
    },
  ],
});
