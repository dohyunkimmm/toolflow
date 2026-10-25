const { test, expect } = require('@playwright/test');

// The selected Pretendard font must already be loaded before SSO and stay stable on activation.
const selectors = [
  '.login-brand',
  '.login-eyebrow',
  '#loginTitle',
  '#loginIntro'
];

async function readMetrics(page){
  return page.evaluate(selectors => selectors.map(selector => {
    const el = document.querySelector(selector);
    if(!el) throw new Error(`Missing login metric target: ${selector}`);
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const textRect = range.getBoundingClientRect();
    return {
      selector,
      fontFamily:style.fontFamily,
      width:rect.width,
      height:rect.height,
      textWidth:textRect.width,
      textHeight:textRect.height
    };
  }), selectors);
}

test('Google SSO 클릭 전 brand font activation이 왼쪽 로그인 문구 크기를 바꾸지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', {name:'Google SSO로 시작하기'})).toBeVisible();

  await page.evaluate(async () => { await document.fonts.ready; });
  const before = await readMetrics(page);
  for(const metric of before){
    expect(metric.fontFamily.toLowerCase(), metric.selector).toContain('pretendard');
  }

  await page.evaluate(async () => {
    const stylesheet = document.getElementById('brandFontStylesheet');
    if(stylesheet) stylesheet.media = 'all';
    if(document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const after = await readMetrics(page);
  for(let i = 0; i < before.length; i += 1){
    const a = before[i];
    const b = after[i];
    expect(b.fontFamily, a.selector).toBe(a.fontFamily);
    expect(Math.abs(b.width - a.width), `${a.selector} box width`).toBeLessThanOrEqual(0.75);
    expect(Math.abs(b.height - a.height), `${a.selector} box height`).toBeLessThanOrEqual(0.75);
    expect(Math.abs(b.textWidth - a.textWidth), `${a.selector} text width`).toBeLessThanOrEqual(0.75);
    expect(Math.abs(b.textHeight - a.textHeight), `${a.selector} text height`).toBeLessThanOrEqual(0.75);
  }
});


test('inactive toast never flashes during login handoff at 320px, 390px and desktop', async ({ page }) => {
  for(const [width,height] of [[320,568],[390,667],[1440,900]]){
    await page.setViewportSize({width,height});
    await page.goto('/');
    const toast=page.locator('#toast');
    await expect(toast).toHaveAttribute('hidden','');
    await expect(toast).toBeHidden();

    // Observe actual animation frames, not only the final settled screenshot.
    await page.evaluate(()=>{
      window.__toastFirstPaintQA={frames:0,visible:[],stop:false};
      const frame=()=>{
        const qa=window.__toastFirstPaintQA;
        if(qa.stop) return;
        const el=document.querySelector('#toast');
        const style=getComputedStyle(el);
        const rect=el.getBoundingClientRect();
        const onScreen=rect.width>0 && rect.height>0 &&
          rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth;
        if(onScreen && !el.hidden && !el.classList.contains('show') &&
           style.display!=='none' && style.visibility!=='hidden' && Number(style.opacity)>.01){
          qa.visible.push({t:performance.now(),opacity:style.opacity});
        }
        qa.frames++;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
    await expect(page.locator('#loginScreen')).toBeHidden();
    await page.waitForTimeout(160);
    const observed=await page.evaluate(()=>{
      const qa=window.__toastFirstPaintQA;
      qa.stop=true;
      return {frames:qa.frames,visible:qa.visible,hidden:document.querySelector('#toast').hidden};
    });
    expect(observed.frames, `RAF frames at ${width}px`).toBeGreaterThan(1);
    expect(observed.visible, `no stray toast frame at ${width}px`).toEqual([]);
    expect(observed.hidden, `toast stays hidden at ${width}px`).toBe(true);
    await expect(toast).toBeHidden();
    await expect(toast).not.toHaveClass(/show/);
  }
});

test('real request/status toast still appears and automatically hides without an old timer race', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
  await expect(page.locator('#loginScreen')).toBeHidden();
  const toast=page.locator('#toast');
  await expect(toast).toBeHidden();
  await page.evaluate(()=>showToast('첫 번째 안내'));
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toContainText('첫 번째 안내');
  await page.waitForTimeout(300);
  await page.evaluate(()=>showToast('신청 완료 안내'));
  await expect(toast).toContainText('신청 완료 안내');
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({timeout:5000});
  await expect(toast).toHaveAttribute('hidden','');
});
