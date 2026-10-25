const { test, expect } = require('@playwright/test');

async function stabilize(page){
  await page.clock.setFixedTime(new Date('2026-09-10T12:00:00+09:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(async () => { if(document.fonts?.ready) await document.fonts.ready; });
}
async function login(page){
  await page.getByRole('button', { name: 'Google SSO로 시작하기' }).click();
  await expect(page.locator('#loginScreen')).toBeHidden();
  await page.locator('img').evaluateAll(images => { images.forEach(img => { img.loading = 'eager'; }); });
  await page.waitForFunction(() => [...document.images].every(img => img.complete));
}

const screenshotOptions = { animations:'disabled', caret:'hide', maxDiffPixelRatio:0.01 };

test('로그인 카드 visual baseline', async ({ page }) => {
  await stabilize(page);
  await expect(page.locator('.login-card')).toHaveScreenshot('login-card.png', screenshotOptions);
});

test('기본 대시보드 간결한 레이아웃과 시각 증빙', async ({ page }, testInfo) => {
  await stabilize(page);
  await login(page);
  await expect(page.locator('#roleGrid .card')).toHaveCount(4);
  for(const card of await page.locator('#roleGrid .card').all()){
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('opacity','1');
  }
  await expect(page.getByRole('button',{name:'도움말',exact:true})).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  // Preserve the legacy dashboard baseline; the new opt-in AI panel has dedicated interaction tests.
  await page.locator('#aiInlinePanel, #roleExtraTools').evaluateAll(panels => { panels.forEach(panel => { panel.hidden = true; }); });
  // An intentional catalog redesign invalidates the old full-page pixel baseline.
  // Assert the layout contract and retain a new full-page capture with the CI report.
  await expect(page.locator('#workTypeFilter, #requirementFilter, #catalogSort')).toHaveCount(0);
  await expect(page.locator('.catalog-field.role-picker > span')).toBeVisible();
  await expect(page.locator('#statusFilterLabel')).toBeVisible();
  const bounds = await page.evaluate(() => {
    const role = document.querySelector('.catalog-filter-row .role-picker').getBoundingClientRect();
    const status = document.querySelector('.catalog-filter-row .catalog-status').getBoundingClientRect();
    return {role:{right:role.right,bottom:role.bottom},status:{left:status.left,top:status.top}};
  });
  if((page.viewportSize()?.width || 0) > 768){
    expect(bounds.role.right).toBeLessThan(bounds.status.left);
  }else{
    expect(bounds.role.bottom).toBeLessThan(bounds.status.top);
  }
  await testInfo.attach('dashboard-layout', {body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'});
});

test('신청 모달 visual baseline', async ({ page }) => {
  await stabilize(page);
  await login(page);
  const card = page.locator('#roleGrid .card').filter({hasText:'Microsoft Office'});
  await card.getByRole('button', {name:'신청하기'}).click();
  await expect(page.locator('.request-modal')).toHaveScreenshot('request-modal.png', screenshotOptions);
});
