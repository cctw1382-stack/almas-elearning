const { test, expect } = require('@playwright/test');

async function ready(page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
async function enter(page) {
  await page.getByRole('button', { name: 'تجربة كضيف', exact: true }).click();
}
async function go(page, name) { await page.locator('#nav [data-page="' + name + '"]').click(); }

test.beforeEach(async ({ request }) => { await request.post('/__test__/release?next=false'); });

test('installed shell reloads offline with saved profile and all four roles', async ({ page, context, request }) => {
  await ready(page);
  const manifestLink = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(manifestLink)).json();
  expect(manifest.name).toContain('الماس');
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find(icon => icon.sizes === size && icon.type === 'image/png');
    expect(icon).toBeTruthy();
    expect((await request.get(icon.src)).status()).toBe(200);
  }
  await enter(page);
  await go(page, 'profile');
  await page.locator('#profileName').fill('طالب محفوظ دون إنترنت');
  await page.getByRole('button', { name: 'حفظ الملف', exact: true }).click();
  await page.locator('#theme').click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await go(page, 'profile');
  await expect(page.locator('#profileName')).toHaveValue('طالب محفوظ دون إنترنت');
  for (const role of ['teacher', 'parent', 'admin', 'student']) {
    await page.locator('#role').selectOption(role);
    await expect(page.locator('#content')).not.toBeEmpty();
  }
  await expect(page.locator('#pwaConnection')).toContainText('دون اتصال');
});

test('worker excludes API and video responses and does not replace unknown routes with the app', async ({ page, context, request }) => {
  await ready(page);
  await page.evaluate(async () => {
    await fetch('/api/account');
    await fetch('/private-video.webm');
  });
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(r => r.url)))).flat());
  expect(cached.some(url => new URL(url).pathname.startsWith('/api/') || new URL(url).pathname.endsWith('.webm')), JSON.stringify(cached)).toBe(false);
  expect((await request.get('/unknown')).status()).toBe(404);
  await context.setOffline(true);
  for (const endpoint of ['/api/account', '/private-video.webm', '/unknown']) {
    const result = await page.evaluate(async endpoint => { try { return (await fetch(endpoint)).status; } catch { return 'offline'; } }, endpoint);
    expect(result).toBe('offline');
  }
  await page.goto('/?source=offline-check');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#content')).not.toBeEmpty();
});

test('new release waits for consent, preserves a draft while deferred, and retains saved answers after update', async ({ page, request }) => {
  await ready(page);
  await enter(page);
  await go(page, 'exams');
  await page.getByRole('button', { name: 'ابدأ الاختبار', exact: true }).first().click();
  await page.getByLabel('البلاستيدة الخضراء', { exact: true }).check();
  const savedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('almas-demo-v1')).attempts);
  expect(Object.keys(savedBefore)).toHaveLength(1);
  await go(page, 'messages');
  await page.locator('#msg').fill('مسودة لم أرسلها بعد');
  await request.post('/__test__/release?next=true');
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
  await expect(page.locator('#pwaUpdate')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-test-release', 'second');
  await page.getByRole('button', { name: 'لاحقاً', exact: true }).click();
  await expect(page.locator('#msg')).toHaveValue('مسودة لم أرسلها بعد');
  // Reopening the prompt does not navigate or discard the draft.
  await page.getByRole('button', { name: 'يوجد تحديث', exact: true }).click();
  await expect(page.locator('#msg')).toHaveValue('مسودة لم أرسلها بعد');
  await page.getByRole('button', { name: 'تحديث الآن', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-test-release', 'second');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('almas-demo-v1')).attempts)).toEqual(savedBefore);
  await go(page, 'exams');
  await page.getByRole('button', { name: 'استئناف الاختبار', exact: true }).first().click();
  await expect(page.getByLabel('البلاستيدة الخضراء', { exact: true })).toBeChecked();
});

test('approving in another tab does not reload this tab or erase its unsent draft', async ({ page, context, request }) => {
  await ready(page);
  await enter(page);
  await page.evaluate(async () => { await caches.open('other-app-cache'); });
  const other = await context.newPage();
  await other.goto('/');
  await go(other, 'messages');
  await other.locator('#msg').fill('مسودة التبويب الثاني');
  await request.post('/__test__/release?next=true');
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await expect(page.locator('#pwaUpdate')).toBeVisible();
  await page.getByRole('button', { name: 'تحديث الآن', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-test-release', 'second');
  await expect(other.locator('#msg')).toHaveValue('مسودة التبويب الثاني');
  await expect(other.locator('html')).not.toHaveAttribute('data-test-release', 'second');
  await other.getByRole('button', { name: 'لاحقاً', exact: true }).click();
  await expect(other.locator('#msg')).toHaveValue('مسودة التبويب الثاني');
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.filter(name => name.startsWith('almas-shell-'))).toHaveLength(1);
  expect(cacheNames).toContain('other-app-cache');
  await other.getByRole('button', { name: 'يوجد تحديث', exact: true }).click();
  await other.getByRole('button', { name: 'تحديث الآن', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-test-release', 'second');
});

test('an incomplete release leaves the previous offline app available', async ({ page, context, request }) => {
  await ready(page);
  await enter(page);
  const cacheBefore = await page.evaluate(() => caches.keys());
  await request.post('/__test__/release?next=true&fail=true');
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return new Promise(async resolve => {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing.addEventListener('statechange', () => {
          if (['installed', 'redundant'].includes(installing.state)) resolve(installing.state);
        });
      }, { once: true });
      await registration.update();
    });
  });
  expect(state).toBe('redundant');
  expect(await page.evaluate(() => caches.keys())).toEqual(cacheBefore);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-test-release', 'second');
  await expect(page.locator('#nav [data-page="home"]')).toBeVisible();
});
