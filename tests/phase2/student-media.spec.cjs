const { test, expect } = require('@playwright/test');

test('student video restores the position saved to the server after reload', async ({ page }) => {
  const origin = 'http://127.0.0.1:5191';
  const school = '00000000-0000-4000-8000-000000000011';
  const asset = '00000000-0000-4000-8000-000000000070';
  const base = '/api/v1/schools/' + school + '/media/' + asset;
  let positionMs = 0;
  let saves = 0;
  await page.route('**/fixture/realm/protocol/openid-connect/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth')) {
      const callback = new URL(url.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', url.searchParams.get('state'));
      callback.searchParams.set('code', 'media-fixture');
      return route.fulfill({ status: 302, headers: { location: callback.href } });
    }
    return route.fulfill({ json: { access_token: 'fixture-access', token_type: 'Bearer', expires_in: 300 } });
  });
  await page.route(origin + base + '/**', async route => {
    expect(route.request().headers().authorization).toBe('Bearer fixture-access');
    if (route.request().url().endsWith('/link')) return route.fulfill({ status: 201, json: { url: base + '/play' } });
    if (route.request().url().endsWith('/play')) {
      return route.fulfill({ contentType: 'video/webm', path: require('node:path').resolve(__dirname, '../fixtures/lesson.webm') });
    }
    if (route.request().method() === 'PUT') {
      ({ positionMs } = route.request().postDataJSON());
      saves++;
    }
    return route.fulfill({ json: { positionMs } });
  });
  await page.goto('/student/video?schoolId=' + school + '&assetId=' + asset);
  await page.getByRole('button', { name: 'دخول الطالب' }).click({ timeout: 4000 });
  const video = page.locator('video');
  await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThan(0);
  await video.evaluate(v => { v.currentTime = 3; });
  await page.getByRole('button', { name: 'حفظ موضع المشاهدة' }).click();
  await expect.poll(() => positionMs).toBe(3000);
  await page.reload();
  await expect.poll(() => video.evaluate(v => v.currentTime)).toBe(3);
  expect(saves).toBe(1);
});
