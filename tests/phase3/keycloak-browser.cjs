const { chromium } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const cache = path.resolve(__dirname, '../../node_modules/.cache/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;

async function run() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    page.setDefaultTimeout(15000);
    await page.goto('http://127.0.0.1:4174/student/exam?schoolId=00000000-0000-4000-8000-000000000011&examId=00000000-0000-4000-8000-000000000021');
    await page.getByRole('button', { name: 'دخول الطالب' }).click();
    await page.locator('#username').fill('almas-pkce-probe');
    await page.locator('#password').fill(process.env.ALMAS_OIDC_PROBE_PASSWORD);
    await page.locator('#kc-login').click();
    await page.getByRole('button', { name: 'بدء المحاولة' }).click();
    await page.getByRole('radio', { name: 'First option' }).check();
    await page.getByText('حُفظت الإجابة').waitFor();
    await page.reload();
    await page.locator('input[type=radio]:checked').waitFor();
    if (!(await page.getByRole('radio', { name: 'First option' }).isChecked())) throw new Error('saved answer missing');
    await page.getByRole('button', { name: 'تسليم المحاولة' }).click();
    await page.getByText('النتيجة 1 من 1').waitFor();
    console.log('Chromium verified Keycloak sign-in, save, refresh and final score against Go and PostgreSQL.');
  } finally {
    await browser.close();
  }
}

run().catch(() => {
  console.error('Local Keycloak browser flow failed.');
  process.exitCode = 1;
});
