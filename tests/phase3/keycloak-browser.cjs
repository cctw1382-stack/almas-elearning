const path = require('node:path');
const fs = require('node:fs');
const cache = path.resolve(__dirname, '../../node_modules/.cache/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const { chromium } = require('@playwright/test');

let stage = 'launch';
async function run() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    page.setDefaultTimeout(15000);
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.startsWith('/api/v1/') || pathname.endsWith('/openid-connect/token')) {
        console.log('Browser HTTP ' + response.request().method() + ' ' + response.status() + ' ' + pathname);
      }
    });
    stage = 'open student page';
    await page.goto('http://127.0.0.1:4174/student/exam?schoolId=00000000-0000-4000-8000-000000000011&examId=00000000-0000-4000-8000-000000000021');
    await page.getByRole('button', { name: 'دخول الطالب' }).click();
    stage = 'Keycloak sign-in';
    await page.locator('#username').fill('almas-pkce-probe');
    await page.locator('#password').fill(process.env.ALMAS_OIDC_PROBE_PASSWORD);
    await page.locator('#kc-login').click();
    stage = 'start attempt';
    await page.getByRole('button', { name: 'بدء المحاولة' }).click();
    stage = 'save answer';
    await page.getByRole('radio', { name: 'First option' }).check();
    await page.getByText('حُفظت الإجابة').waitFor();
    stage = 'refresh and restore';
    await page.reload();
    await page.locator('input[type=radio]:checked').waitFor();
    if (!(await page.getByRole('radio', { name: 'First option' }).isChecked())) throw new Error('saved answer missing');
    stage = 'submit and display score';
    await page.getByRole('button', { name: 'تسليم المحاولة' }).click();
    await page.getByText('النتيجة 1 من 1').waitFor();
    console.log('Chromium verified Keycloak sign-in, save, refresh and final score against Go and PostgreSQL.');
  } finally {
    await browser.close();
  }
}

run().catch(() => {
  console.error('Local Keycloak browser flow failed at: ' + stage);
  process.exitCode = 1;
});
