const path = require('node:path');
const fs = require('node:fs');
const { test, expect, enterAs, go } = require('./helpers.cjs');

test('native local video loads, plays and pauses at its checkpoint without losing its source', async ({ page, context, browserName }, testInfo) => {
  const fixturePath = path.resolve(__dirname, '../fixtures/lesson.webm');
  if (browserName === 'webkit' && process.platform === 'win32') {
    // Probe an independent native element so an application regression can
    // never be mistaken for the Windows WebKit decoder limitation.
    const probe = await context.newPage();
    let capability;
    try {
      await probe.goto('data:text/html,<html><body><video id="probe" muted playsinline></video></body></html>');
      capability = await probe.evaluate(base64 => new Promise(resolve => {
        const video = document.getElementById('probe');
        const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(base64), character => character.charCodeAt(0))], { type: 'video/webm' }));
        let finished = false;
        const finish = result => {
          if (finished) return;
          finished = true;
          resolve({ ...result, readyState: video.readyState, errorCode: video.error?.code ?? null, advertised: video.canPlayType('video/webm; codecs="vp8"') });
          video.pause();
          URL.revokeObjectURL(url);
        };
        video.addEventListener('error', () => finish({ event: 'error' }), { once: true });
        video.addEventListener('loadedmetadata', async () => {
          try { await video.play(); finish({ event: 'playing' }); }
          catch (error) { finish({ event: 'play-rejected', playError: error.name }); }
        }, { once: true });
        video.src = url;
        video.load();
        setTimeout(() => finish({ event: 'timeout' }), 5000);
      }), fs.readFileSync(fixturePath).toString('base64'));
    } finally { await probe.close(); }
    await testInfo.attach('windows-webkit-native-media-probe', { body: JSON.stringify(capability, null, 2), contentType: 'application/json' });
    const unavailable = capability.errorCode === 4 || capability.playError === 'NotSupportedError';
    if (unavailable) testInfo.annotations.push({
      type: 'environment',
      description: `Windows WebKit standalone VP8 decoder unavailable: ${JSON.stringify(capability)}. Product media assertions were not executed; Linux CI still requires them.`,
    });
    test.skip(unavailable, 'Windows WebKit standalone native video reports MEDIA_ERR_SRC_NOT_SUPPORTED (4) or NotSupportedError despite canPlayType; see attached capability probe.');
  }
  await enterAs(page);
  await go(page, 'video');
  await page.locator('#lessonSelect').selectOption('l1');
  const supported = await page.locator('#lessonVideo').evaluate(video => video.canPlayType('video/webm; codecs="vp8"'));
  expect(supported, `The ${browserName} engine must decode the native VP8 fixture`).not.toBe('');
  await page.locator('#videoFile').setInputFiles(fixturePath);
  const video = page.locator('#lessonVideo');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  const source = await video.evaluate(element => element.currentSrc);
  expect(source).toMatch(/^blob:/);
  await video.evaluate(element => element.play());
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0);
  await video.evaluate(element => { element.currentTime = element.duration * 0.65; });
  await expect(page.locator('#checkpoint')).toBeVisible();
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
  await expect.poll(() => video.evaluate(element => element.currentTime / element.duration)).toBeLessThanOrEqual(0.52);
  await page.locator('#checkpoint').getByRole('button', { name: 'الأكسجين', exact: true }).click();
  await expect(page.locator('#checkpoint')).toBeVisible();
  await page.locator('#checkpoint').getByRole('button', { name: 'ثاني أكسيد الكربون', exact: true }).click();
  await expect(page.locator('#checkpoint')).not.toBeVisible();
  await expect(video).toHaveJSProperty('currentSrc', source);
  await page.locator('#notes').fill('ملاحظات حول البناء الضوئي');
  await page.getByRole('button', { name: 'حفظ الملاحظات', exact: true }).click();
  await expect(video).toHaveJSProperty('currentSrc', source);
  await page.getByRole('button', { name: 'حفظ علامة مرجعية', exact: true }).click();
  await expect(video).toHaveJSProperty('currentSrc', source);
  await page.locator('#speed').selectOption('1.5');
  await expect(video).toHaveJSProperty('playbackRate', 1.5);
  await page.locator('#volume').evaluate(input => {
    input.value = '0.4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(0.4, 5);
  await go(page, 'home');
  await go(page, 'video');
  await expect(page.locator('#notes')).toHaveValue('ملاحظات حول البناء الضوئي');
  await expect(page.locator('#lessonVideo')).toHaveJSProperty('currentSrc', source);
  await page.reload();
  await go(page, 'video');
  await expect(page.locator('#notes')).toHaveValue('ملاحظات حول البناء الضوئي');
  await expect(page.locator('#bookmarkStatus')).toContainText(/علامة مرجعية عند [1-9]/);
  // Browsers intentionally cannot reopen a user's local file after reload.
  await expect(page.locator('#lessonVideo')).toHaveJSProperty('currentSrc', '');
});

test('offline simulation, checkpoint answers, notes, and bookmarks remain independent per lesson', async ({ page }) => {
  await enterAs(page);
  await go(page, 'video');
  await page.locator('#lessonSelect').selectOption('l1');
  await page.getByRole('button', { name: 'إعادة التقدم', exact: true }).click();
  await page.getByRole('button', { name: 'تقدم محاكاة 25%', exact: true }).click();
  await page.getByRole('button', { name: 'تقدم محاكاة 25%', exact: true }).click();
  await expect(page.locator('#checkpoint')).toBeVisible();
  await page.locator('#checkpoint').getByRole('button', { name: 'ثاني أكسيد الكربون', exact: true }).click();
  await expect(page.locator('#checkpoint')).not.toBeVisible();
  await page.locator('#notes').fill('ملاحظة الدرس الأول');
  await page.getByRole('button', { name: 'حفظ الملاحظات', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ علامة مرجعية', exact: true }).click();
  await page.locator('#lessonSelect').selectOption('l2');
  await expect(page.locator('#notes')).toHaveValue('');
  await expect(page.locator('#videoPercent')).toContainText('0%');
  await page.getByRole('button', { name: 'تقدم محاكاة 25%', exact: true }).click();
  await expect(page.locator('#videoPercent')).toContainText('25%');
  await page.locator('#notes').fill('ملاحظة الدرس الثاني');
  await page.getByRole('button', { name: 'حفظ الملاحظات', exact: true }).click();
  await page.locator('#lessonSelect').selectOption('l1');
  await expect(page.locator('#notes')).toHaveValue('ملاحظة الدرس الأول');
  await expect(page.locator('#videoPercent')).toContainText('50%');
  await expect(page.locator('#checkpoint')).not.toBeVisible();
  await page.reload();
  await go(page, 'video');
  await page.locator('#lessonSelect').selectOption('l1');
  await expect(page.locator('#notes')).toHaveValue('ملاحظة الدرس الأول');
  await expect(page.locator('#videoPercent')).toContainText('50%');
  await page.locator('#lessonSelect').selectOption('l2');
  await expect(page.locator('#notes')).toHaveValue('ملاحظة الدرس الثاني');
  await expect(page.locator('#videoPercent')).toContainText('25%');
});

test('teacher and admin video previews keep their notes and progress separate from the student', async ({ page }) => {
  await enterAs(page);
  await go(page, 'video');
  await page.locator('#lessonSelect').selectOption('l1');
  await page.locator('#notes').fill('ملاحظات الطالب الخاصة');
  await page.getByRole('button', { name: 'حفظ الملاحظات', exact: true }).click();
  await page.getByRole('button', { name: 'تقدم محاكاة 25%', exact: true }).click();
  await expect(page.locator('#videoPercent')).toContainText('25%');

  for (const [role, note] of [['teacher', 'ملاحظات معاينة المعلم'], ['admin', 'ملاحظات معاينة الإدارة']]) {
    await page.locator('#role').selectOption(role);
    await go(page, 'video');
    const lesson = page.locator('#content tr').filter({ hasText: 'الأوراق والبناء الضوئي' });
    await lesson.getByRole('button', { name: 'معاينة الفيديو', exact: true }).click();
    await expect(page.locator('#lessonSelect')).toHaveValue('l1');
    await expect(page.locator('#notes')).toHaveValue('');
    await expect(page.locator('#videoPercent')).toContainText('0%');
    await page.locator('#notes').fill(note);
    await page.getByRole('button', { name: 'حفظ الملاحظات', exact: true }).click();
    await page.getByRole('button', { name: 'تقدم محاكاة 25%', exact: true }).click();
    await expect(page.locator('#videoPercent')).toContainText('25%');
  }

  await page.locator('#role').selectOption('student');
  await go(page, 'video');
  await page.locator('#lessonSelect').selectOption('l1');
  await expect(page.locator('#notes')).toHaveValue('ملاحظات الطالب الخاصة');
  await expect(page.locator('#videoPercent')).toContainText('25%');
  await page.locator('#role').selectOption('teacher');
  await go(page, 'video');
  await page.locator('#content tr').filter({ hasText: 'الأوراق والبناء الضوئي' }).getByRole('button', { name: 'معاينة الفيديو', exact: true }).click();
  await expect(page.locator('#notes')).toHaveValue('ملاحظات معاينة المعلم');
  await expect(page.locator('#videoPercent')).toContainText('25%');
  await page.reload();
  await go(page, 'video');
  await page.locator('#content tr').filter({ hasText: 'الأوراق والبناء الضوئي' }).getByRole('button', { name: 'معاينة الفيديو', exact: true }).click();
  await expect(page.locator('#notes')).toHaveValue('ملاحظات معاينة المعلم');
  await page.locator('#role').selectOption('student');
  await go(page, 'video');
  await expect(page.locator('#notes')).toHaveValue('ملاحظات الطالب الخاصة');
  await expect(page.locator('#videoPercent')).toContainText('25%');
});
