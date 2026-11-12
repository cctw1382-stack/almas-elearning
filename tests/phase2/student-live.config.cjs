const path = require('node:path');
const fs = require('node:fs');
const cache = path.resolve(__dirname, '../../node_modules/.cache/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const origin = 'http://127.0.0.1:5191';
module.exports = {
  testDir: __dirname,
  testMatch: 'student-live.spec.cjs',
  outputDir: path.resolve(__dirname, '../../test-results/student-live'),
  use: { baseURL: origin, browserName: 'chromium', serviceWorkers: 'block' },
  webServer: {
    command: 'npm --prefix apps/web run dev -- --port 5191 --strictPort',
    cwd: path.resolve(__dirname, '../..'),
    url: origin,
    env: { VITE_ALMAS_ISSUER: origin + '/fixture/realm', VITE_ALMAS_CLIENT_ID: 'fixture-web' },
  },
};
