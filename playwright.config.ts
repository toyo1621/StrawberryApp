import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('PLAYWRIGHT_PORT must be an integer from 1024 to 65535.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/app.spec.ts',
  outputDir: '.tmp/playwright-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { outputFolder: '.tmp/playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ipad-webkit',
      testMatch: '**/ipad.spec.ts',
      use: { ...devices['iPad Pro 11'], viewport: { width: 834, height: 1194 } },
    },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    {
      name: 'compact-mobile-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: `npm run build:web:e2e && PORT=${port} npm run preview`,
    url: `http://127.0.0.1:${port}/__strawberry_preview_health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
