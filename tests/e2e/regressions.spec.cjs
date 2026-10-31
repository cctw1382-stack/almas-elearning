const { test, expect, enterAs, go, record, fillRecord } = require('./helpers.cjs');

test('a maximum-length alias can send a message that survives reload', async ({ page }) => {
  await enterAs(page);
  const alias = 'ع'.repeat(120);
  await go(page, 'profile');
  await page.locator('#profileName').fill(alias);
  await page.getByRole('button', { name: 'حفظ الملف', exact: true }).click();
  await go(page, 'messages');
  await page.locator('#msg').fill('رسالة من اسم مستعار بطول الحد الأقصى');
  await page.getByRole('button', { name: 'إرسال تجريبي', exact: true }).click();
  const saved = page.locator('#content .card').filter({ hasText: 'رسالة من اسم مستعار بطول الحد الأقصى' });
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText(alias);
  await page.reload();
  await go(page, 'messages');
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText(alias);
});

test('saved names and details containing quotes and HTML render literally without running code', async ({ page }) => {
  await page.addInitScript(() => { window.__injected = 0; });
  await enterAs(page, 'teacher');
  await go(page, 'subjects');
  const name = 'سجل \'"><img src=x onerror="window.__injected=1">';
  const details = '<script>window.__injected=2</script> & "نص حرفي"';
  await page.getByRole('button', { name: 'إضافة سجل', exact: true }).click();
  await fillRecord(page, name, details);
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(record(page, name)).toBeVisible();
  await expect(record(page, name).getByText(name, { exact: true })).toBeVisible();
  await expect(record(page, name).locator('img, script')).toHaveCount(0);
  await record(page, name).getByRole('button', { name: 'تعديل', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('الاسم', { exact: true })).toHaveValue(name);
  await expect(page.getByRole('dialog').getByLabel('التفاصيل', { exact: true })).toHaveValue(details);
  await page.keyboard.press('Escape');
  await page.reload();
  await go(page, 'subjects');
  await expect(record(page, name).getByText(name, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__injected)).toBe(0);
});

for (const mode of ['corrupt', 'denied', 'quota']) {
  test(`${mode} local storage warns clearly while the app remains usable in memory`, async ({ page }) => {
    await page.addInitScript(mode => {
      if (mode === 'corrupt') {
        localStorage.setItem('almas-demo-v1', '{invalid-json');
      } else {
        const fail = () => { throw new DOMException('Test storage unavailable', mode === 'quota' ? 'QuotaExceededError' : 'SecurityError'); };
        Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value: fail });
        if (mode === 'denied') Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, value: fail });
      }
    }, mode);
    await enterAs(page, 'teacher');
    await expect(page.locator('#storageWarning')).toBeVisible();
    await expect(page.locator('#storageWarning')).toContainText(/الجلسة/);
    await go(page, 'subjects');
    await expect(record(page, 'الأحياء')).toBeVisible();
    await page.getByRole('button', { name: 'إضافة سجل', exact: true }).click();
    await fillRecord(page, 'مادة محفوظة في الذاكرة');
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(record(page, 'مادة محفوظة في الذاكرة')).toBeVisible();
    await go(page, 'home');
    await go(page, 'subjects');
    await expect(record(page, 'مادة محفوظة في الذاكرة')).toBeVisible();
    await page.locator('#theme').click();
    await expect(page.locator('body')).toHaveClass(/dark/);
    await expect(page.locator('#storageWarning')).toBeVisible();
  });
}

test('teacher edits and deletion cannot corrupt an active attempt or a saved result; retake resets answers', async ({ page }) => {
  await enterAs(page);
  await go(page, 'exams');
  await page.getByRole('button', { name: 'ابدأ الاختبار', exact: true }).first().click();
  await page.getByLabel('البلاستيدة الخضراء', { exact: true }).check();
  await page.locator('#role').selectOption('teacher');
  await go(page, 'exams');
  const exam = record(page, 'اختبار الأحياء التجريبي');
  await exam.getByRole('button', { name: 'تعديل', exact: true }).click();
  if (await page.getByRole('dialog').isVisible()) {
    await page.getByRole('dialog').getByLabel('الاسم', { exact: true }).fill('اختبار محرف');
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(/محاولة|نتائج|تعديل/);
    await page.keyboard.press('Escape');
  } else await expect(page.locator('#toast')).toContainText(/محاولة|نتائج|تعديل/);
  await expect(exam).toBeVisible();
  await exam.getByRole('button', { name: 'حذف', exact: true }).click();
  if (await page.getByRole('dialog').isVisible()) {
    await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(/محاولة|نتائج|حذف/);
    await page.keyboard.press('Escape');
  } else await expect(page.locator('#toast')).toContainText(/محاولة|نتائج|حذف/);
  await expect(exam).toBeVisible();
  await page.locator('#role').selectOption('student');
  await go(page, 'exams');
  await page.getByRole('button', { name: 'استئناف الاختبار', exact: true }).first().click();
  await expect(page.getByLabel('البلاستيدة الخضراء', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'إرسال الاختبار', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الإرسال', exact: true }).click();
  await expect(page.locator('#content')).toContainText('1 من 3');
  await page.reload();
  await go(page, 'exams');
  await page.getByRole('button', { name: 'عرض النتيجة', exact: true }).first().click();
  await expect(page.locator('#content')).toContainText('1 من 3');
  await page.getByRole('button', { name: 'إعادة الاختبار', exact: true }).click();
  await expect(page.locator('#question')).toContainText('أين تحدث عملية البناء الضوئي؟');
  await expect(page.getByLabel('البلاستيدة الخضراء', { exact: true })).not.toBeChecked();
  await expect(page.locator('#examTimer')).toContainText('05:00');
});

test('CRUD rendering preserves selected search, status and subject filters', async ({ page }) => {
  await enterAs(page, 'teacher');
  await go(page, 'lessons');
  const name = 'درس اختبار التصفية';
  await page.getByRole('button', { name: 'إضافة سجل', exact: true }).click();
  await fillRecord(page, name);
  await page.getByRole('dialog').getByLabel('المادة', { exact: true }).selectOption('s1');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.locator('#search').fill(name);
  await page.locator('#filterStatus').selectOption('نشط');
  await page.locator('#subjectFilter').selectOption('s1');
  await record(page, name).getByRole('button', { name: 'تعديل', exact: true }).click();
  await fillRecord(page, name, 'تفاصيل معدلة مع الحفاظ على التصفية');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.locator('#search')).toHaveValue(name);
  await expect(page.locator('#filterStatus')).toHaveValue('نشط');
  await expect(page.locator('#subjectFilter')).toHaveValue('s1');
  await expect(record(page, name)).toBeVisible();
  await record(page, name).getByRole('button', { name: 'حذف', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
  await expect(page.locator('#search')).toHaveValue(name);
  await expect(page.locator('#filterStatus')).toHaveValue('نشط');
  await expect(page.locator('#subjectFilter')).toHaveValue('s1');
  await expect(record(page, name)).toHaveCount(0);
});
