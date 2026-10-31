const { test, expect, enterAs, go } = require('./helpers.cjs');

const menus = {
  student: ['home', 'subjects', 'lessons', 'video', 'exams', 'assignments', 'results', 'ai', 'notifications', 'messages', 'profile'],
  teacher: ['home', 'subjects', 'lessons', 'video', 'exams', 'assignments', 'students', 'results', 'messages', 'notifications', 'profile'],
  parent: ['home', 'children', 'results', 'attendance', 'assignments', 'exams', 'notifications', 'messages', 'profile'],
  admin: ['home', 'users', 'schools', 'classes', 'subjects', 'lessons', 'video', 'exams', 'subscriptions', 'payments', 'providers', 'permissions', 'results', 'audit', 'profile'],
};

for (const [role, routes] of Object.entries(menus)) {
  test(`${role}: every navigation page is usable without document overflow`, async ({ page }) => {
    await enterAs(page, role);
    await expect(page.locator('#nav [data-page]')).toHaveCount(routes.length);
    for (const id of routes) {
      await go(page, id);
      await expect(page.locator('#content h2').first()).toBeVisible();
      await expect(page.locator(`#nav [data-page="${id}"]`)).toHaveClass(/active/);
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll, `${role}/${id} must fit the viewport`).toBeLessThanOrEqual(dimensions.width + 1);
    }
  });
}
