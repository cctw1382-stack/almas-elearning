const path = require('node:path');
const fs = require('node:fs');
const cache = path.resolve(__dirname, '../../node_modules/.cache/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'pwa.spec.cjs',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:5181', locale: 'ar-IQ', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/phase2/server.cjs', cwd: path.resolve(__dirname, '../..'), url: 'http://127.0.0.1:5181', reuseExistingServer: false },
});
