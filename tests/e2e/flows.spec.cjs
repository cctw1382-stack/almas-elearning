const { test, expect, openApp, enterAs, go, record, fillRecord } = require('./helpers.cjs');

test('welcome, guest access, and persistent theme work offline', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: /مرحباً بك/ })).toBeVisible();
  await page.getByRole('button', { name: 'تجربة كضيف', exact: true }).click();
  await expect(page.locator('#nav [data-page="home"]')).toBeVisible();
  await page.locator('#theme').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await page.locator('#theme').click();
  await expect(page.locator('body')).not.toHaveClass(/dark/);
});

test('demo login validates an alias and never requests a password', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /دخول تجريبي|تسجيل الدخول/, exact: false }).first().click();
  await page.getByRole('button', { name: 'متابعة تجريبية', exact: true }).click();
  await expect(page.locator('#accountName')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.locator('#accountName').fill('طالب اختبار');
  await page.getByRole('button', { name: 'متابعة تجريبية', exact: true }).click();
  await expect(page.locator('#nav [data-page="home"]')).toBeVisible();
  await expect(page.locator('#content')).not.toContainText('كلمة المرور');
});

for (const [role, route] of [
  ['teacher', 'subjects'], ['teacher', 'lessons'], ['teacher', 'exams'], ['teacher', 'assignments'], ['teacher', 'students'],
  ['admin', 'users'], ['admin', 'schools'], ['admin', 'classes'], ['admin', 'subjects'],
  ['admin', 'lessons'], ['admin', 'exams'], ['admin', 'subscriptions'], ['admin', 'payments'], ['admin', 'providers'], ['admin', 'permissions'],
]) {
  test(`${role} ${route}: create, read, edit, cancel, search and delete persist`, async ({ page }) => {
    await enterAs(page, role);
    await go(page, route);
    const name = `سجل اختبار ${route}`;
    const edited = `${name} معدل`;
    await page.getByRole('button', { name: 'إضافة سجل', exact: true }).click();
    await fillRecord(page, name);
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(record(page, name)).toBeVisible();
    await record(page, name).getByRole('button', { name: 'التفاصيل', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('تفاصيل محفوظة للاختبار');
    await page.keyboard.press('Escape');
    await record(page, name).getByRole('button', { name: 'تعديل', exact: true }).click();
    await fillRecord(page, `${name} ملغى`);
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء', exact: true }).click();
    await expect(record(page, name)).toBeVisible();
    await expect(record(page, `${name} ملغى`)).toHaveCount(0);
    await record(page, name).getByRole('button', { name: 'تعديل', exact: true }).click();
    await fillRecord(page, edited, 'تفاصيل معدلة');
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
    await page.reload();
    await page.locator('#role').selectOption(role);
    await go(page, route);
    await expect(record(page, edited)).toBeVisible();
    await page.locator('#search').fill('لا توجد نتيجة بهذا الاسم');
    await expect(record(page, edited)).toHaveCount(0);
    await page.locator('#search').fill(edited);
    await expect(record(page, edited)).toBeVisible();
    await page.locator('#search').fill('');
    await record(page, edited).getByRole('button', { name: 'حذف', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء', exact: true }).click();
    await expect(record(page, edited)).toBeVisible();
    await record(page, edited).getByRole('button', { name: 'حذف', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
    await expect(record(page, edited)).toHaveCount(0);
    await page.reload();
    await page.locator('#role').selectOption(role);
    await go(page, route);
    await expect(record(page, edited)).toHaveCount(0);
  });
}

test('invalid input does not create a record and dialogs trap and restore keyboard focus', async ({ page }) => {
  await enterAs(page, 'teacher');
  await go(page, 'subjects');
  const add = page.getByRole('button', { name: 'إضافة سجل', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('الاسم', { exact: true })).toBeFocused();
  await dialog.getByLabel('الاسم', { exact: true }).fill('   ');
  await dialog.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
  for (let index = 0; index < 12; index++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
  await expect(page.locator('#content')).not.toContainText('تم الحفظ');
});

test('student subjects and lessons search uses real records', async ({ page }) => {
  await enterAs(page);
  await go(page, 'subjects');
  await page.locator('#search').fill('الأحياء');
  await expect(record(page, 'الأحياء')).toBeVisible();
  await expect(record(page, 'الفيزياء')).toHaveCount(0);
  await go(page, 'lessons');
  await page.locator('#search').fill('البناء');
  await expect(page.locator('#content')).toContainText('البناء');
  await page.locator('#search').fill('درس غير موجود');
  await expect(page.locator('#content')).toContainText(/لا توجد/);
});
