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
    if (process.env.ALMAS_TEST_FFMPEG) {
      stage = 'upload HLS and restore video position';
      const origin = 'http://127.0.0.1:4174';
      const school = '00000000-0000-4000-8000-000000000011';
      const tokenResponse = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/openid-connect/token'));
      await page.reload();
      const token = (await (await tokenResponse).json()).access_token;
      const headers = { Authorization: 'Bearer ' + token };
      const upload = await page.request.post(origin + '/api/v1/schools/' + school + '/lessons/00000000-0000-4000-8000-000000000072/media', {
        headers: { ...headers, 'Content-Type': 'video/mp4' },
        data: await (await page.request.get(origin + '/fixture/source')).body(),
      });
      if (upload.status() !== 201) {
        stage = 'upload HTTP ' + upload.status();
        throw new Error('upload failed');
      }
      stage = 'load signed HLS in student page';
      const asset = (await upload.json()).uploadId.split('/').pop().replace(/\.mp4$/, '');
      const segmentResponse = page.waitForResponse(r => r.url().includes('segment=') && r.status() === 200);
      const manifestResponse = page.waitForResponse(r => r.url().includes('/play?') && !r.url().includes('segment=') && r.status() === 200);
      await page.goto(origin + '/student/video?schoolId=' + school + '&assetId=' + asset);
      await page.getByRole('button', { name: 'دخول الطالب' }).click();
      await segmentResponse;
      stage = 'save HLS progress';
      const manifest = await manifestResponse;
      const video = page.locator('video');
      await page.getByRole('button', { name: 'حفظ موضع المشاهدة' }).waitFor();
      await video.evaluate(v => { v.currentTime = 2; });
      await page.getByRole('button', { name: 'حفظ موضع المشاهدة' }).click();
      await page.getByText('حُفظ موضع المشاهدة').waitFor();
      stage = 'restore HLS progress';
      await page.reload();
      await page.waitForFunction(() => Math.abs(document.querySelector('video')?.currentTime - 2) < 0.1);
      stage = 'deny expired HLS URL';
      const until = Number(new URL(manifest.url()).searchParams.get('exp'));
      await new Promise(resolve => setTimeout(resolve, Math.max(0, until - Date.now() + 100)));
      if ((await page.request.get(manifest.url(), { headers })).status() !== 404) throw new Error('expired link accepted');
      console.log('Chromium verified upload, HLS segment, expired link and restored playback position.');
    }
  } finally {
    await browser.close();
  }
}

run().catch(() => {
  console.error('Local Keycloak browser flow failed at: ' + stage);
  process.exitCode = 1;
});
