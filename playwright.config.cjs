const fs = require('node:fs');
const path = require('node:path');

// A project-local browser install is optional; normal Playwright installs keep
// using the platform cache. This also works in restricted desktop workspaces.
const localBrowserCache = path.join(__dirname, 'node_modules', '.cache', 'ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localBrowserCache)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserCache;
}
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    offline: true,
    locale: 'ar-IQ',
    timezoneId: 'Asia/Baghdad',
    actionTimeout: 5_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }, testIgnore: /responsive\.spec\.cjs/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /responsive\.spec\.cjs/ },
    {
      name: 'webkit',
      // WebKit rejects even minimal file:// pages when offline
      // emulation is enabled. The automatic fixture still aborts and reports
      // every HTTP(S) request, so this engine remains network-isolated.
      use: { ...devices['Desktop Safari'], offline: false },
      testIgnore: /responsive\.spec\.cjs/,
    },
    ...[360, 768, 1366].map(width => ({
      name: `chromium-${width}`,
      testMatch: /responsive\.spec\.cjs/,
      use: { browserName: 'chromium', viewport: { width, height: 900 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
    })),
  ],
});
