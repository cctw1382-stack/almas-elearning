const { test: base, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const prototypeURL = pathToFileURL(path.resolve(__dirname, '../../prototype/index.html')).href;
const test = base.extend({
  runtimeGuard: [async ({ page, context }, use, testInfo) => {
    const failures = [];
    if (testInfo.project.name === 'webkit' && process.platform === 'win32') {
      testInfo.annotations.push({
        type: 'environment',
        description: 'Windows WebKit cannot navigate file:// with offline emulation; HTTP(S) requests are intercepted, aborted, and fail the test.',
      });
    }
    page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') failures.push(`console: ${message.text()}`);
    });
    await context.route(/^https?:\/\//, async route => {
      failures.push(`external request: ${route.request().url()}`);
      await route.abort('internetdisconnected');
    });
    await use();
    if (failures.length) await testInfo.attach('runtime-errors', { body: failures.join('\n'), contentType: 'text/plain' });
    expect(failures, 'Offline pages must not throw runtime errors or request external resources').toEqual([]);
  }, { auto: true }],
});

async function openApp(page) {
  await page.goto(prototypeURL);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
}
async function enterAs(page, role = 'student') {
  await openApp(page);
  const guest = page.getByRole('button', { name: 'تجربة كضيف', exact: true });
  if (await guest.isVisible()) await guest.click();
  await page.locator('#role').selectOption(role);
}
async function go(page, id) {
  await page.locator(`#nav [data-page="${id}"]`).click();
  await expect(page.locator('#content')).not.toBeEmpty();
}
function record(page, name) {
  return page.locator('#content tr, #content .card').filter({ hasText: name }).last();
}
async function fillRecord(page, name, details = 'تفاصيل محفوظة للاختبار') {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('الاسم', { exact: true }).fill(name);
  await dialog.getByLabel('التفاصيل', { exact: true }).fill(details);
  const status = dialog.getByLabel('الحالة', { exact: true });
  if (await status.count()) {
    if (await status.evaluate(el => el.tagName === 'SELECT')) {
      const value = await status.locator('option').evaluateAll(options => options.find(option => option.value)?.value);
      if (value) await status.selectOption(value);
    } else await status.fill('نشط');
  }
  const question = dialog.getByLabel('السؤال', { exact: true });
  if (await question.count()) {
    await question.first().fill('ما ناتج جمع واحد وواحد؟');
    await dialog.getByLabel('الخيار الأول', { exact: true }).first().fill('اثنان');
    await dialog.getByLabel('الخيار الثاني', { exact: true }).first().fill('ثلاثة');
    await dialog.getByLabel('الخيار الثالث', { exact: true }).first().fill('أربعة');
    await dialog.getByLabel('الإجابة الصحيحة', { exact: true }).first().selectOption('0');
  }
}

module.exports = { test, expect, prototypeURL, openApp, enterAs, go, record, fillRecord };
