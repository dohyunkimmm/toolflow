const { test, expect } = require('@playwright/test');

// Pixel baselines are reviewed artifacts, not a substitute for semantic,
// accessibility, responsive, cross-browser or production smoke tests.
test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+09:00'));
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});
});

async function stableAssets(page){
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
    if(document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForFunction(() => [...document.images].every(img => img.complete));
}

async function login(page, url = '/'){
  await page.goto(url);
  await stableAssets(page);
  if(await page.locator('#loginScreen').isVisible()){
    await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
  }
  await expect(page.locator('#loginScreen')).toBeHidden();
  await expect(page.locator('#roleGrid .card')).toHaveCount(4);
  await stableAssets(page);
}

test('entry card pixel baseline', async ({page}) => {
  await page.goto('/');
  await stableAssets(page);
  await expect(page.locator('.login-card')).toHaveScreenshot('login-card.png');
});

test('catalog first viewport pixel baseline', async ({page}) => {
  await login(page);
  await page.evaluate(() => {
    document.querySelectorAll('#aiInlinePanel, #roleExtraTools')
      .forEach(panel => { panel.hidden = true; });
    window.scrollTo(0,0);
  });
  await expect(page).toHaveScreenshot('catalog-viewport.png', {fullPage:false});
});

test('request modal pixel baseline', async ({page}, testInfo) => {
  test.skip(testInfo.project.name === 'narrow-baseline', '320px is covered by the viewport snapshot and mobile layout tests');
  await login(page);
  const card = page.locator('#roleGrid .card').filter({hasText:'Microsoft Office'});
  await card.getByRole('button',{name:'신청하기'}).click();
  await expect(page.locator('#requestBackdrop')).toHaveClass(/show/);
  await stableAssets(page);
  await expect(page.locator('.request-modal')).toHaveScreenshot('request-modal.png');
});

test('reviewer queue pixel baseline', async ({page},testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline','Reviewer queue baseline is desktop; mobile drawer has behavioral/viewport tests');
  await login(page,'/?review=1');
  await page.locator('#adminBtn').click();
  await expect(page.locator('#drawerBackdrop')).toHaveClass(/show/);
  await stableAssets(page);
  await expect(page.locator('.drawer')).toHaveScreenshot('reviewer-drawer.png');
});
