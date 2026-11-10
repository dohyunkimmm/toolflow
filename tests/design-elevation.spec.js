const { test, expect } = require('@playwright/test');

async function demoLogin(page){
  await page.goto('/');
  if(await page.locator('#loginScreen').isVisible()){
    await page.getByRole('button', { name: 'Google SSO로 시작하기' }).click();
  }
  await expect(page.locator('#loginScreen')).toBeHidden();
}

test('visual foundation stays aligned from login to catalog', async ({page}) => {
  await page.goto('/');
  const tokens = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return {
      brand: css.getPropertyValue('--tf-brand').trim(),
      canvas: css.getPropertyValue('--tf-canvas').trim(),
      surface: css.getPropertyValue('--tf-surface').trim()
    };
  });
  expect(tokens).toEqual({brand:'#2459c2',canvas:'#f7f9fc',surface:'#ffffff'});
  await expect(page.locator('.google-btn')).toHaveCSS('background-color','rgb(36, 89, 194)');
  await expect(page.locator('.login-card')).toHaveCSS('background-color','rgb(255, 255, 255)');

  await page.getByRole('button', { name:'Google SSO로 시작하기' }).click();
  await expect(page.locator('#loginScreen')).toBeHidden();
  await expect(page.locator('.catalog-ai')).toHaveCSS('background-color','rgb(36, 89, 194)');
  await expect(page.locator('#statusBtn')).toHaveCSS('background-color','rgb(36, 89, 194)');
  await expect(page.locator('#roleGrid .card')).toHaveCount(4);
  await expect(page.locator('#commonGrid .card')).toHaveCount(5);
});

test('catalog hierarchy and card states stay legible', async ({page}) => {
  await demoLogin(page);
  const values = await page.evaluate(() => {
    const card = document.querySelector('#roleGrid .card');
    const name = card.querySelector('.card-title');
    const purpose = card.querySelector('.card-purpose');
    const meta = card.querySelector('.card-timing');
    const action = card.querySelector('.cta');
    const status = card.querySelector('.status-pill');
    const size = node => parseFloat(getComputedStyle(node).fontSize);
    const rect = node => node.getBoundingClientRect();
    return {
      label:size(name),
      purpose:size(purpose),
      meta:size(meta),
      action:rect(action).height,
      statusText:status.textContent.trim(),
      bottom:rect(action).bottom,
      cardBottom:rect(card).bottom
    };
  });
  expect(values.label).toBeGreaterThan(values.meta);
  expect(values.purpose).toBeGreaterThanOrEqual(values.meta);
  expect(values.action).toBeGreaterThanOrEqual(44);
  expect(values.statusText.length).toBeGreaterThan(0);
  expect(values.bottom).toBeLessThanOrEqual(values.cardBottom+1);
  await expect(page.locator('#roleGrid .card').first().locator('.card-title')).toHaveCSS('color','rgb(23, 37, 61)');
});

test('mobile preserves controls and initial cards without clipping', async ({page}) => {
  for(const [width,height] of [[320,568],[390,667],[768,880]]){
    await page.setViewportSize({width,height});
    await demoLogin(page);
    const metrics = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      return {
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
        cardTop: rect('#roleGrid .card').top,
        buttonHeight: rect('.catalog-ai').height,
        statusHeight: rect('#filterTabs .filter-chip').height,
        requestHeight: rect('#roleGrid .cta').height,
        searchWidth: rect('#toolSearch').width
      };
    });
    expect(metrics.scroll, 'horizontal overflow at ' + width).toBeLessThanOrEqual(metrics.viewport+1);
    expect(metrics.cardTop, 'first card off-screen at '+width).toBeLessThan(height);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(48);
    expect(metrics.statusHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.requestHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.searchWidth).toBeGreaterThan(70);
  }
});

test('request modal and reviewer drawer share the visual system', async ({page}) => {
  await demoLogin(page);
  await page.locator('#roleGrid .card').filter({hasText:'Microsoft Office'})
    .getByRole('button',{name:'신청하기'}).click();
  await expect(page.locator('#requestBackdrop')).toHaveClass(/show/);
  await expect(page.locator('.request-modal')).toHaveCSS('background-color','rgb(255, 255, 255)');
  const radius = await page.locator('.request-modal').evaluate(el => parseFloat(getComputedStyle(el).borderRadius));
  expect(radius).toBeGreaterThanOrEqual(page.viewportSize().width <= 768 ? 20 : 24);
  await page.goto('/?review=1');
  if(await page.locator('#loginScreen').isVisible()){
    await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
  }
  await expect(page.locator('#adminBtn')).toBeVisible();
  await page.locator('#adminBtn').click();
  await expect(page.locator('#drawerBackdrop')).toHaveClass(/show/);
  await expect(page.locator('.drawer')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('.admin-kpis')).toHaveCSS('position','sticky');
});
