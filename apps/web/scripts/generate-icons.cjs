// Rasterize the project's existing original SVG; no external image service.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const cache = path.join(root, 'node_modules/.cache/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const { chromium } = require('@playwright/test');
(async () => {
  const mark = fs.readFileSync(path.join(root, 'docs/assets/almas-mark.svg'), 'utf8');
  const paths = mark.slice(mark.indexOf('<path'), mark.lastIndexOf('</svg>'));
  const directory = path.resolve(__dirname, '../public/icons');
  fs.mkdirSync(directory, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512]]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>body{margin:0}</style><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fff"/><g transform="translate(88 130) scale(3)">${paths}</g></svg>`);
      await page.screenshot({ path: path.join(directory, name) });
    }
  } finally { await browser.close(); }
})();
