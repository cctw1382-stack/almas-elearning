process.env.ALMAS_TEST_URL = 'http://127.0.0.1:5180/';
const original = require('./playwright.config.cjs');
module.exports = {
  ...original,
  // The same feature tests target built files; separate PWA tests exercise offline
  // and worker updates without routing interception or a blocked service worker.
  use: { ...original.use, offline: false, serviceWorkers: 'block' },
  projects: original.projects.map(project => ({ ...project, use: { ...project.use, offline: false, serviceWorkers: 'block' } })),
  webServer: { command: 'node apps/web/scripts/preview.mjs --port 5180', url: process.env.ALMAS_TEST_URL, reuseExistingServer: false },
};
