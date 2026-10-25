const {test,expect}=require('@playwright/test');
async function login(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
 await expect(page.locator('#loginScreen')).toBeHidden();
}
const visible='.card:not(.is-hidden)';
test('available shared cards remain actionable as guidance and never create requests',async({page})=>{
 await login(page);
 await page.locator('#filterTabs [data-filter="done"]').click();
 await expect(page.locator(visible)).toHaveCount(5);
 await expect(page.locator(visible+' .requirement-pill.provided')).toHaveCount(5);
 await expect(page.locator(visible+' .card-owner')).toHaveCount(5);
 await page.locator('#commonGrid .card[data-name="Notion"]').getByRole('button',{name:'사용 안내',exact:true}).click();
 await expect(page.locator('#actionModalTitle')).toHaveText('Notion');
 await expect(page.locator('#requestCount')).toHaveText('0');
});
test('three desktop columns and one mobile column use matching card geometry',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await login(page);
 for(const id of ['roleGrid','commonGrid']){
  const columns=await page.locator('#'+id).evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(3);
  const row=await page.locator('#'+id+' .card').evaluateAll(els=>els.slice(0,3).map(el=>{const b=el.getBoundingClientRect(),c=el.querySelector('.cta').getBoundingClientRect();return {top:b.top,bottom:b.bottom,button:c.bottom};}));
  expect(new Set(row.map(x=>Math.round(x.top))).size).toBe(1);
  expect(new Set(row.map(x=>Math.round(x.bottom))).size).toBe(1);
  expect(new Set(row.map(x=>Math.round(x.button))).size).toBe(1);
 }
 await page.setViewportSize({width:390,height:844});
 for(const id of ['roleGrid','commonGrid']){
  expect(await page.locator('#'+id).evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(page.getByRole('button',{name:'AI 추천',exact:true})).toBeVisible();
});

test('compact card actions stay at the right and never occupy the card width',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await login(page);
 for(const id of ['roleGrid','commonGrid']){
  const boxes=await page.locator('#'+id+' .card').evaluateAll(els=>els.slice(0,3).map(el=>{const card=el.getBoundingClientRect(),button=el.querySelector('.cta').getBoundingClientRect();return {width:card.width,height:card.height,buttonWidth:button.width,rightInset:card.right-button.right};}));
  for(const box of boxes){expect(box.height).toBeLessThanOrEqual(210);expect(box.buttonWidth).toBeLessThan(box.width*.5);expect(box.rightInset).toBeLessThanOrEqual(22);}
 }
 await expect(page.locator('.tool-search img')).toHaveAttribute('src','icons/tossface/u1F50D.svg');
 await expect(page.locator('#catalogTitle')).toHaveCSS('font-family',/"Pretendard Variable"/);
});
