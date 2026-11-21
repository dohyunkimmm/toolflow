const {test,expect}=require('@playwright/test');

async function login(page){
  await page.goto('/?review=1');
  await page.getByRole('button',{name:'Google SSO로 시작하기'}).click();
  await expect(page.locator('#loginScreen')).toBeHidden();
}
async function createOfficeRequest(page){
  const card=page.locator('#roleGrid .card').filter({hasText:'Microsoft Office'});
  await card.getByRole('button',{name:'신청하기'}).click();
  await page.getByRole('button',{name:'신청 제출'}).click();
}

test('완료 시각을 새로고침 이후에도 유지하고 SLA 판정에 사용한다',async ({page})=>{
  await login(page);
  await createOfficeRequest(page);
  await page.locator('#adminBtn').click();
  const item=page.locator('.request-item').filter({hasText:'Microsoft Office'});
  await item.getByRole('button',{name:'IT 검토 완료'}).click();
  await page.getByRole('button',{name:'지급 완료 처리'}).click();
  const before=await page.evaluate(()=>({
    completedAt:requestState['Microsoft Office'].completedAt,
    sla:getSlaHealth(requestState['Microsoft Office']).label
  }));
  expect(typeof before.completedAt).toBe('number');
  await page.reload();
  const after=await page.evaluate(()=>({
    completedAt:requestState['Microsoft Office'].completedAt,
    sla:getSlaHealth(requestState['Microsoft Office']).label
  }));
  expect(after).toEqual(before);
});

test('IT 요청 검토 근거가 기록되고 비용 대안을 비교할 수 있다',async ({page})=>{
  await login(page);
  await createOfficeRequest(page);
  await page.locator('#moreBtn').click();
  await page.getByRole('button',{name:'IT 운영·기획 검토'}).click();
  const item=page.locator('.request-item').filter({hasText:'Microsoft Office'});
  await item.locator('.ops-review summary').click();
  await item.locator('.ops-priority').selectOption('우선');
  await item.locator('.ops-team').selectOption('GA팀');
  await item.locator('.ops-review-note').fill('부서별 도구 중복 및 검토 필요');
  await item.getByRole('button',{name:'검토 정보 저장'}).click();
  await page.locator('.request-item').filter({hasText:'Microsoft Office'}).locator('.ops-review summary').click();
  await expect(page.locator('.ops-review-note')).toHaveValue('부서별 도구 중복 및 검토 필요');
  await page.locator('.ops-planning summary').first().click();
  await page.locator('#opsSeats').fill('12');
  await page.locator('#opsUnitPrice').fill('20000');
  await page.locator('#opsReused').fill('2');
  await page.locator('#opsBudget').fill('250000');
  await page.getByRole('button',{name:'대안 비용 다시 계산'}).click();
  await expect(page.locator('#opsCostResult')).toContainText('200,000원');
  await expect(page.locator('#opsCostResult')).toContainText('40,000원');
  await page.reload();
  await page.locator('#moreBtn').click();
  await page.getByRole('button',{name:'IT 운영·기획 검토'}).click();
  const restored=page.locator('.request-item').filter({hasText:'Microsoft Office'});
  await restored.locator('.ops-review summary').click();
  await expect(restored.locator('.ops-priority')).toHaveValue('우선');
  await expect(restored.locator('.ops-team')).toHaveValue('GA팀');
  await expect(restored.locator('.ops-review-note')).toHaveValue('부서별 도구 중복 및 검토 필요');
});

test('입사 준비 체크리스트는 직군별로 분리해 저장하며 초기화할 수 있다',async ({page})=>{
  await login(page);
  await page.getByRole('button',{name:'도움말',exact:true}).click();
  await page.locator('#gaChecklist summary').click();
  await page.locator('[data-demo-check="device"]').check();
  await expect(page.locator('#gaChecklistBody')).toContainText('1/6건 표시 완료');
  await page.getByRole('button',{name:'도움말 닫기'}).click();
  await page.getByRole('combobox',{name:'직군 선택'}).selectOption('design');
  await page.getByRole('button',{name:'도움말',exact:true}).click();
  await expect(page.locator('[data-demo-check="device"]')).not.toBeChecked();
  await page.getByRole('button',{name:'도움말 닫기'}).click();
  await page.reload();
  await page.getByRole('combobox',{name:'직군 선택'}).selectOption('office');
  await page.getByRole('button',{name:'도움말',exact:true}).click();
  await page.locator('#gaChecklist summary').click();
  await expect(page.locator('[data-demo-check="device"]')).toBeChecked();
  await page.getByRole('button',{name:'도움말 닫기'}).click();
  await page.locator('#moreBtn').click();
  await page.locator('#moreMenu [data-action="reset-demo-close-more"]').click();
  await page.getByRole('button',{name:'도움말',exact:true}).click();
  await expect(page.locator('[data-demo-check="device"]')).not.toBeChecked();
});
