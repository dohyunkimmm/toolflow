const {test,expect}=require('@playwright/test');

async function login(page){
  await page.goto('/');
  await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
  await expect(page.locator('#loginScreen')).toBeHidden();
}

test('catalog shows only essential controls and preserves role, status, search and reset',async({page})=>{
  await login(page);
  await expect(page.locator('#workTypeFilter, #requirementFilter, #catalogSort')).toHaveCount(0);
  await expect(page.locator('#roleSelect')).toBeVisible();
  await expect(page.locator('#toolSearch')).toBeVisible();
  await expect(page.locator('.catalog-ai')).toBeVisible();
  await expect(page.locator('.catalog-field.role-picker > span')).toBeVisible();
  await expect(page.locator('#statusFilterLabel')).toBeVisible();
  await expect(page.locator('#catalogResultCount')).toContainText('9');
  await page.locator('#filterTabs [data-filter="todo"]').click();
  await expect(page.locator('#catalogResultCount')).toContainText('4');
  await page.locator('#roleSelect').selectOption('dev');
  await expect(page.locator('#catalogResultCount')).toContainText('5');
  await page.locator('#toolSearch').fill('JetBrains');
  await expect(page.locator('#catalogResultCount')).toContainText('1');
  await page.locator('[data-action="reset-catalog-filters"]').click();
  await expect(page.locator('#roleSelect')).toHaveValue('office');
  await expect(page.locator('#toolSearch')).toHaveValue('');
  await expect(page.locator('#filterTabs [data-filter="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#catalogResultCount')).toContainText('9');
});

test('simplified role and status filters fit on mobile without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await expect(page.locator('.catalog-field.role-picker > span')).toBeVisible();
  await expect(page.locator('#statusFilterLabel')).toBeVisible();
  await page.locator('#filterTabs [data-filter="done"]').click();
  await expect(page.locator('#catalogResultCount')).toContainText('5');
  const width=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
});

test('search takes a compact share while the primary AI action is larger and clear on desktop and mobile',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await login(page);
  const measures=()=>page.evaluate(()=>{
    const search=document.querySelector('.catalog-controls .tool-search').getBoundingClientRect();
    const ai=document.querySelector('.catalog-ai').getBoundingClientRect();
    return {
      searchWidth:search.width,aiWidth:ai.width,aiHeight:ai.height,
      aiBackground:getComputedStyle(document.querySelector('.catalog-ai')).backgroundColor,
      viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    };
  });
  const desktop=await measures();
  expect(desktop.searchWidth).toBeLessThan(610);
  expect(desktop.aiWidth).toBeGreaterThanOrEqual(240);
  expect(desktop.aiWidth).toBeGreaterThan(desktop.searchWidth*.45);
  expect(desktop.aiHeight).toBeGreaterThanOrEqual(48);
  expect(desktop.aiBackground).toBe('rgb(23, 99, 198)');
  await expect(page.locator('#toolSearch')).toHaveAttribute('placeholder','도구명·업무 검색');
  await page.locator('#toolSearch').fill('Notion');
  await expect(page.locator('#catalogResultCount')).toContainText('1');
  await page.locator('#toolSearch').fill('');
  await page.setViewportSize({width:390,height:844});
  const mobile=await measures();
  expect(mobile.searchWidth).toBeLessThan(240);
  expect(mobile.aiWidth).toBeGreaterThanOrEqual(130);
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.viewport);
  await page.getByRole('button',{name:'AI 추천',exact:true}).click();
  await expect(page.locator('#actionModalBackdrop')).toHaveClass(/show/);
});
