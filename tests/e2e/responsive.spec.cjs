const { test, expect, openApp, enterAs, go } = require('./helpers.cjs');

const menus = {
  student: ['home', 'subjects', 'lessons', 'video', 'exams', 'assignments', 'results', 'ai', 'notifications', 'messages', 'profile'],
  teacher: ['home', 'subjects', 'lessons', 'video', 'exams', 'assignments', 'students', 'results', 'messages', 'notifications', 'profile'],
  parent: ['home', 'children', 'results', 'attendance', 'assignments', 'exams', 'notifications', 'messages', 'profile'],
  admin: ['home', 'users', 'schools', 'classes', 'subjects', 'lessons', 'video', 'exams', 'subscriptions', 'payments', 'providers', 'permissions', 'results', 'audit', 'profile'],
};

test('public pages fit the viewport and teacher status words remain on one line',async({page})=>{
  await openApp(page);
  for(const theme of ['light','dark']){
    if(theme==='dark')await page.locator('#theme').click();
    for(const action of ['welcome','register','login']){
      if(action!=='welcome')await page.locator(`.public-actions [data-action="${action}"]`).click();
      const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      expect(dimensions.scroll,`${theme}/${action}`).toBeLessThanOrEqual(dimensions.width+1);
      if(action==='welcome'&&await page.locator('.public-links a').first().isVisible()){
        for(const link of await page.locator('.public-links a').all()){
          const box=await link.boundingBox();
          expect(box.height,'Landing links must be easy to tap').toBeGreaterThanOrEqual(44);
        }
      }
      if(action!=='welcome')await page.getByRole('button',{name:'البداية',exact:true}).click();
    }
  }
  await page.getByRole('button',{name:'تجربة كضيف',exact:true}).click();
  await page.locator('#role').selectOption('teacher');
  await go(page,'video');
  const statusBoxes=await page.locator('td .pill').evaluateAll(nodes=>nodes.map(node=>{
    const range=document.createRange();range.selectNodeContents(node);
    return {text:node.textContent,height:range.getBoundingClientRect().height,line:Number.parseFloat(getComputedStyle(node).lineHeight)};
  }));
  expect(statusBoxes.length).toBeGreaterThan(0);
  for(const box of statusBoxes)expect(box.height,box.text).toBeLessThan(box.line*1.5);
});

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
