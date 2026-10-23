import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: '**/moderation.spec.ts',
  workers: 2,
  outputDir: '.tmp/playwright-moderation-results',
  reporter: [['list'], ['html', { outputFolder: '.tmp/playwright-moderation-report', open: 'never' }]],
  projects: base.projects?.filter((project) => ['desktop-chromium', 'compact-mobile-chromium', 'ipad-webkit'].includes(project.name ?? ''))
    .map((project) => ({ ...project, testMatch: '**/moderation.spec.ts' })),
  webServer: {
    ...base.webServer,
    env: { EXPO_PUBLIC_RANKINGS_API_URL: 'http://127.0.0.1:43999' },
  },
});
