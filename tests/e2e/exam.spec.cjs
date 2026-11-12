const { test, expect, enterAs, go } = require('./helpers.cjs');

async function biologyExam(page) {
  await go(page, 'exams');
  const card = page.locator('#content .card').filter({ hasText: 'الأحياء' }).first();
  const scope = await card.count() ? card : page.locator('#content');
  await scope.getByRole('button', { name: /ابدأ الاختبار|استئناف الاختبار/, exact: true }).click();
}

test('answers, current question and deadline survive navigation and reload; review produces a durable result', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-31T10:00:01Z'));
  await enterAs(page);
  await biologyExam(page);
  await expect(page.locator('#question')).toContainText('أين تحدث عملية البناء الضوئي؟');
  await page.getByLabel('البلاستيدة الخضراء', { exact: true }).check();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await expect(page.locator('#question')).toContainText('ما الغاز الذي يمتصه النبات؟');
  await page.getByLabel('ثاني أكسيد الكربون', { exact: true }).check();
  await page.clock.fastForward(65_000);
  const remaining = await page.locator('#examTimer').textContent();
  expect(remaining).not.toContain('05:00');
  await go(page, 'home');
  await biologyExam(page);
  await expect(page.locator('#question')).toContainText('ما الغاز الذي يمتصه النبات؟');
  await expect(page.getByLabel('ثاني أكسيد الكربون', { exact: true })).toBeChecked();
  await expect(page.locator('#examTimer')).toHaveText(remaining);
  await page.reload();
  await biologyExam(page);
  await expect(page.getByLabel('ثاني أكسيد الكربون', { exact: true })).toBeChecked();
  await expect(page.locator('#examTimer')).not.toContainText('05:00');
  await page.getByRole('button', { name: 'السابق', exact: true }).click();
  await expect(page.getByLabel('البلاستيدة الخضراء', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await page.getByLabel('الشمس', { exact: true }).check();
  await page.getByRole('button', { name: 'مراجعة الإجابات', exact: true }).click();
  await expect(page.locator('#examReview')).toContainText('البلاستيدة الخضراء');
  await expect(page.locator('#examReview')).toContainText('ثاني أكسيد الكربون');
  await expect(page.locator('#examReview')).toContainText('الشمس');
  await page.getByRole('button', { name: 'إرسال الاختبار', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء', exact: true }).click();
  await expect(page.locator('#examTimer')).toBeVisible();
  await page.getByRole('button', { name: 'إرسال الاختبار', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الإرسال', exact: true }).click();
  await expect(page.locator('#content')).toContainText('3 من 3');
  await page.reload();
  await go(page, 'exams');
  await page.getByRole('button', { name: 'عرض النتيجة', exact: true }).first().click();
  await expect(page.locator('#content')).toContainText('3 من 3');
  await go(page, 'results');
  await expect(page.locator('#content')).toContainText(/3 من 3|100%/);
});

test('an incomplete exam expires once even after leaving its page and reloading', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-31T10:00:01Z'));
  await enterAs(page);
  await biologyExam(page);
  await page.getByLabel('البلاستيدة الخضراء', { exact: true }).check();
  await go(page, 'home');
  await page.clock.fastForward(301_000);
  await page.reload();
  await go(page, 'exams');
  await page.getByRole('button', { name: 'عرض النتيجة', exact: true }).first().click();
  await expect(page.locator('#content')).toContainText('1 من 3');
  await expect(page.locator('#content')).toContainText(/انتهى|الوقت/);
  await page.reload();
  await go(page, 'exams');
  await page.getByRole('button', { name: 'عرض النتيجة', exact: true }).first().click();
  await expect(page.locator('#content')).toContainText('1 من 3');
});
