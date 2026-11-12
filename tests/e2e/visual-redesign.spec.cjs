const AxeBuilder = require('@axe-core/playwright').default;
const {test,expect,openApp,go} = require('./helpers.cjs');

test('landing subject discovery opens the matching lessons without a real account',async({page})=>{
  await openApp(page);
  for(const [name,id,count] of [['الأحياء','s1',2],['الكيمياء','s2',1],['الفيزياء','s3',1],['الرياضيات','s4',0]]){
    await page.locator('#explore article').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'استكشف الدروس',exact:true}).click();
    await expect(page.locator('#role')).toHaveValue('student');
    await expect(page.locator('#subjectFilter')).toHaveValue(id);
    await expect(page.locator('#resultsList .course-card')).toHaveCount(count);
    await page.reload();
    // A new visit keeps the existing route; it does not force the marketing page.
    await expect(page.locator('#nav [data-page="lessons"]')).toHaveAttribute('aria-current','page');
    await page.getByRole('button',{name:'البداية',exact:true}).click();
  }
});

test('landing registration and secondary guest entry reach the working dashboard',async({page})=>{
  await openApp(page);
  await page.getByRole('button',{name:'ابدأ الآن',exact:true}).click();
  await expect(page.getByRole('heading',{name:'إنشاء حساب تجريبي',exact:true})).toBeVisible();
  await page.getByLabel('الاسم المستعار التجريبي').fill('متعلم تجريبي');
  await page.getByRole('button',{name:'متابعة تجريبية',exact:true}).click();
  await expect(page.locator('.dashboard-hero')).toContainText('متعلم تجريبي');
  await page.getByRole('button',{name:'البداية',exact:true}).click();
  await page.getByRole('button',{name:'جرّب المنصة الآن',exact:true}).click();
  await expect(page.locator('.dashboard-hero')).toContainText('متعلم تجريبي');
  await go(page,'subjects');
  await expect(page.locator('#resultsList .course-card')).toHaveCount(4);
});

for(const theme of ['light','dark']){
  test(`public ${theme}: FAQ works with a keyboard and entry pages pass WCAG AA`,async({page},testInfo)=>{
    test.setTimeout(90_000);
    await openApp(page);
    if(theme==='dark')await page.locator('#theme').click();
    await testInfo.attach(`landing-${theme}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
    const question=page.locator('#faq summary').first();
    await question.focus();
    await question.press('Enter');
    await expect(page.locator('#faq details').first()).toHaveAttribute('open','');
    await expect(page.locator('#faq details').first().locator('p')).toBeVisible();
    for(const action of ['welcome','register','login']){
      if(action!=='welcome'){
        await page.locator(`.public-actions [data-action="${action}"]`).click();
      }
      const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      expect(result.violations,`${theme}/${action}`).toEqual([]);
      if(action!=='welcome')await page.getByRole('button',{name:'البداية',exact:true}).click();
    }
  });
}
