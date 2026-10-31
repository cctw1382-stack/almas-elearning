const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, enterAs, go } = require('./helpers.cjs');

// One audit per theme/role, across every visible route. This is an automated
// WCAG check, not a substitute for assistive-technology/device acceptance.
for (const role of ['student','teacher','parent','admin']) {
  for (const theme of ['light','dark']) {
    test(`${role} ${theme}: all routes pass automated WCAG AA checks`, async ({page}, testInfo) => {
      test.setTimeout(180_000);
      await enterAs(page, role);
      if (theme === 'dark') await page.locator('#theme').click();
      const routes = await page.locator('#nav [data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page));
      const findings = [];
      for (const route of routes) {
        await go(page, route);
        const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        findings.push(...result.violations.map(v => ({route,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
      }
      await testInfo.attach('wcag-aa-audit', {body:JSON.stringify(findings,null,2),contentType:'application/json'});
      expect(findings).toEqual([]);
    });
  }
}

test('video fullscreen opens and exits through the platform control', async ({page}) => {
  await enterAs(page);
  await go(page, 'video');
  await page.getByRole('button',{name:'ملء الشاشة',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe('lessonVideo');
  await page.evaluate(()=>document.exitFullscreen());
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement === null)).toBe(true);
});
