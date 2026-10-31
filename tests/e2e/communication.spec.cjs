const { test, expect, openApp, enterAs, go, record } = require('./helpers.cjs');

test('registration enters the demo with an alias and profile edits persist per role', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'إنشاء حساب تجريبي', exact: true }).click();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.locator('#accountName').fill('اسم عرض مسجل');
  await page.getByRole('button', { name: 'متابعة تجريبية', exact: true }).click();
  await go(page, 'profile');
  await expect(page.locator('#profileName')).toHaveValue('اسم عرض مسجل');
  await page.locator('#profileName').fill('اسم الطالب المعدل');
  await page.getByRole('button', { name: 'حفظ الملف', exact: true }).click();
  await page.reload();
  await go(page, 'profile');
  await expect(page.locator('#profileName')).toHaveValue('اسم الطالب المعدل');
  await page.locator('#role').selectOption('teacher');
  await go(page, 'profile');
  await expect(page.locator('#profileName')).not.toHaveValue('اسم الطالب المعدل');
  await page.locator('#role').selectOption('student');
  await go(page, 'profile');
  await expect(page.locator('#profileName')).toHaveValue('اسم الطالب المعدل');
});

test('messages reject blank input and a saved local message survives reload', async ({ page }) => {
  await enterAs(page);
  await go(page, 'messages');
  const initialCount = await page.locator('#content .card').count();
  await page.locator('#msg').fill('   ');
  await page.getByRole('button', { name: 'إرسال تجريبي', exact: true }).click();
  await expect(page.locator('#content .card')).toHaveCount(initialCount);
  await expect(page.locator('#msg')).toBeVisible();
  const message = 'رسالة اختبار محفوظة محلياً';
  await page.locator('#msg').fill(message);
  await page.getByRole('button', { name: 'إرسال تجريبي', exact: true }).click();
  await expect(page.locator('#content .card').filter({ hasText: message })).toHaveCount(1);
  await page.reload();
  await go(page, 'messages');
  await expect(page.locator('#content .card').filter({ hasText: message })).toHaveCount(1);
});

test('marking a notification read persists its status after reload', async ({ page }) => {
  await enterAs(page);
  await go(page, 'notifications');
  const card = page.locator('#content .card').filter({ has: page.getByRole('button', { name: 'تحديد كمقروء', exact: true }) }).first();
  const title = await card.locator('h3').textContent();
  await card.getByRole('button', { name: 'تحديد كمقروء', exact: true }).click();
  const saved = page.locator('#content .card').filter({ hasText: title });
  await expect(saved).toContainText('مقروء');
  await expect(saved.getByRole('button', { name: 'تحديد كمقروء', exact: true })).toHaveCount(0);
  await page.reload();
  await go(page, 'notifications');
  await expect(saved).toContainText('مقروء');
  await expect(saved.getByRole('button', { name: 'تحديد كمقروء', exact: true })).toHaveCount(0);
});

test('parent child selection changes attendance and results and survives reload', async ({ page }) => {
  await enterAs(page, 'parent');
  await go(page, 'children');
  await page.locator('#childSelect').selectOption('c2');
  await expect(page.locator('#content')).toContainText('سارة حسن');
  await expect(page.locator('#content')).toContainText('الثالث المتوسط');
  for (const route of ['results', 'attendance', 'assignments', 'exams']) {
    await go(page, route);
    await expect(page.locator('#childSelect')).toHaveValue('c2');
    await expect(page.locator('#content')).toContainText('سارة حسن');
  }
  await page.reload();
  await go(page, 'attendance');
  await expect(page.locator('#childSelect')).toHaveValue('c2');
  await expect(page.locator('#content')).toContainText('سارة حسن');
  await page.locator('#childSelect').selectOption('c1');
  await expect(page.locator('#content')).toContainText('علي حسن');
  await expect(page.locator('#content')).toContainText('الخامس العلمي');
});

test('assignment submission validates, cancels and persists for teacher review', async ({ page }) => {
  await enterAs(page);
  await go(page, 'assignments');
  await page.getByRole('button', { name: 'تسليم الواجب', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'حفظ التسليم', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.locator('#submission').fill('تسليم لن يحفظ');
  await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await page.getByRole('button', { name: 'تسليم الواجب', exact: true }).first().click();
  await expect(page.locator('#submission')).toHaveValue('');
  await page.locator('#submission').fill('إجابة واجب محفوظة للاختبار');
  await dialog.getByRole('button', { name: 'حفظ التسليم', exact: true }).click();
  await page.reload();
  await go(page, 'assignments');
  await page.getByRole('button', { name: 'تعديل التسليم', exact: true }).first().click();
  await expect(page.locator('#submission')).toHaveValue('إجابة واجب محفوظة للاختبار');
  await page.keyboard.press('Escape');
  await page.locator('#role').selectOption('teacher');
  await go(page, 'assignments');
  await page.getByRole('button', { name: 'عرض التسليمات', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('إجابة واجب محفوظة للاختبار');
});

test('parent assignments and exams show only content assigned to the selected child', async ({ page }) => {
  await enterAs(page, 'parent');
  await go(page, 'assignments');
  await page.locator('#childSelect').selectOption('c1');
  await expect(record(page, 'واجب الأحياء')).toBeVisible();
  await expect(record(page, 'واجب الكيمياء')).toHaveCount(0);
  await page.locator('#childSelect').selectOption('c2');
  await expect(record(page, 'واجب الكيمياء')).toBeVisible();
  await expect(record(page, 'واجب الأحياء')).toHaveCount(0);
  await go(page, 'exams');
  await expect(page.locator('#childSelect')).toHaveValue('c2');
  await expect(record(page, 'اختبار الأحياء التجريبي')).toHaveCount(0);
  await page.locator('#childSelect').selectOption('c1');
  await expect(record(page, 'اختبار الأحياء التجريبي')).toBeVisible();
  await go(page, 'assignments');
  await expect(page.locator('#childSelect')).toHaveValue('c1');
  await expect(record(page, 'واجب الأحياء')).toBeVisible();
  await expect(record(page, 'واجب الكيمياء')).toHaveCount(0);
});
