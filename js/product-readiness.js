'use strict';

// Catalog policy examples for this prototype; production policy comes from IT/HR.
const REQUIRED_ROLE_TOOLS = new Set(['FG','GH','SF','DB','HG']);
const INSTALLED_TOOLS = new Set(['CC','JB','DB','HG','MO','AD']);
const INVITED_TOOLS = new Set(['SL','NT','CF','JR','JSM','GH','FG','FJ','MZ','GPT','PM','PBI','MD']);

function requirementFor(item){
  return item.status === 'auto' || REQUIRED_ROLE_TOOLS.has(item.mono) ? '필수' : '선택';
}
function employeeTiming(item){
  const req = requestState[item.name];
  if(!req) return item.status === 'auto' ? '사용 가능' : getSlaMeta(item.status).detail.replace('영업일 기준','영업일');
  if(req.status === 'rejected') return '보완 후 재신청';
  if(req.status === 'completed') return '사용 가능';
  const due = requestDueDate(req);
  const late = due && businessDayDistance(new Date(),due) < 0;
  return `${late ? '예정일 경과 · 담당팀 확인 필요' : '지급 예정'}${req.expected ? ' · '+req.expected : ''}`;
}
function requestFields(item,existing,isResubmit){
  if(item.status !== 'approval') return '';
  const permission = ['AWS','SF'].includes(item.mono);
  const scopeLabel = permission ? '권한 범위 (필수)' : '필요한 제품·플랜 (필수)';
  const options = permission
    ? ['조회·읽기 권한','업무 수행·쓰기 권한','관리 권한 · 별도 검토 필요']
    : ['Adobe Creative Cloud 전체 앱','Photoshop','Illustrator','Premiere Pro','기타 · 사용 목적에 기재'];
  const scope = existing?.scope || '';
  const period = existing?.period || '';
  return `<div class="approval-fields">
    <label for="requestScope">${scopeLabel}</label>
    <select id="requestScope" required><option value="">선택해 주세요</option>${options.map(value=>`<option value="${escapeHTML(value)}"${scope===value?' selected':''}>${escapeHTML(value)}</option>`).join('')}</select>
    <label for="requestPeriod">사용 기간 (필수)</label>
    <select id="requestPeriod" required><option value="">선택해 주세요</option>${['1개월','3개월','6개월','상시 · 재직 기간'].map(value=>`<option${period===value?' selected':''}>${value}</option>`).join('')}</select>
    <label for="requestBudget">비용 부담 부서·예산 코드 (선택)</label>
    <input id="requestBudget" type="text" maxlength="80" value="${escapeHTML(existing?.budget || '')}" placeholder="미입력 시 담당 부서가 확인합니다">
    <p class="field-note">비용·좌석 정보는 실제 시스템과 연결되지 않은 데모입니다. 담당자가 제품·권한 범위와 예산을 확인한 뒤 승인합니다.</p>
  </div>`;
}
function adminDecisionHTML(req){
  if(!findLicenseByName(req.name)) return '';
  if(drawerMode !== 'admin') return req.scope ? `<div class="decision-context"><b>신청 내용</b><dl><div><dt>제품·권한 범위</dt><dd>${escapeHTML(req.scope)}</dd></div><div><dt>사용 기간</dt><dd>${escapeHTML(req.period)}</dd></div><div><dt>예산·비용 부서</dt><dd>${escapeHTML(req.budget || '담당자 확인 필요')}</dd></div></dl></div>` : '';
  const rows = [['제품·권한 범위',req.scope || '기본 라이선스'],['사용 기간',req.period || '담당자 확인 필요'],['예산·비용 부서',req.budget || '담당자 확인 필요'],['잔여 좌석','미연동 · 실제 좌석 조회 필요'],['비용','미연동 · 제품·플랜별 견적 확인 필요']];
  return `<div class="decision-context"><b>승인 판단 정보</b><p>프로토타입 · 좌석·비용은 실제 운영 값이 아닙니다.</p><dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl></div>`;
}
function renderReadiness(){
  const el = document.getElementById('readinessSummary');
  if(!el) return;
  const role = roles[currentRole];
  const required = role.cards.filter(item=>requirementFor(item)==='필수');
  const ready = required.filter(item=>['auto','completed'].includes(getEffectiveStatus(item))).length;
  document.getElementById('currentRoleLabel').textContent = role.exception ? '직무 확인 필요' : role.label+' 직군';
  el.textContent = role.exception ? '직무 확인 필요' : `필수 라이선스 ${ready}/${required.length}개 준비 완료`;
  const queue = document.getElementById('pendingSummary');
  queue.hidden = true;
  queue.replaceChildren();
}
function nextDemoAction(){
  const requests = Object.values(requestState);
  if(requests.some(req=>req.status==='rejected')) return openDrawer('user');
  if(requests.some(req=>['pending','approved'].includes(req.status))) return openDrawer('admin');
  if(currentRole==='unmapped') return openSupportRequest('role');
  const required=roles[currentRole].cards.filter(item=>requirementFor(item)==='필수');
  if(required.length && required.every(item=>['auto','completed'].includes(getEffectiveStatus(item)))) return showActionGuideModal(required[0]);
  const suggested = getSuggestedRoleLicense();
  if(suggested) return openLicenseAction(suggested.name);
  const ready = roles[currentRole].cards.find(item=>['auto','completed'].includes(getEffectiveStatus(item)));
  if(ready) showActionGuideModal(ready);
}


// Shared policy/finance/quality examples for reviewer mode only.
// These decisions do not authenticate users or provision SaaS licenses.
const TOOLFLOW_POLICY_VERSION = '2026.11-review.1';
const TOOLFLOW_REVIEW_TEAMS = Object.freeze(['IT팀','GA팀','HR팀']);
const TOOLFLOW_PRIORITY_LEVELS = Object.freeze(['일반','우선']);
function toolflowPolicyFor(req){
  const flags = [];
  const tool=findLicenseByName(req.name);
  const wrongRole=tool?.audience && tool.audience !== '전사 구성원' &&
    req.roleLabel && tool.audience !== req.roleLabel + ' 직군';
  if(!tool || wrongRole || req.roleLabel === '직무 확인 필요') flags.push('직무·도구 별도 확인');
  if(String(req.scope || '').includes('관리 권한')) flags.push('고권한 추가 검토');
  if(req.baseStatus === 'approval' && !String(req.budget || '').trim()) flags.push('비용 부담 부서 확인');
  return {
    version:TOOLFLOW_POLICY_VERSION,
    route:req.baseStatus === 'approval' ? 'IT 사전 검토 → 관리자 승인' : 'IT 검토',
    flags
  };
}
function toolflowServiceMetrics(requests){
  const all = Array.isArray(requests) ? requests : [];
  const completed = all.filter(req=>req.status === 'completed');
  const dated = completed.filter(req=>Number.isFinite(new Date(req.dueDate).getTime()) &&
    Number.isFinite(new Date(req.completedAt).getTime()) && !!req.completedAt);
  const within = dated.filter(req=>businessDayDistance(new Date(req.dueDate),new Date(req.completedAt)) <= 0).length;
  const exception = all.filter(req=>!findLicenseByName(req.name) || req.roleLabel === '직무 확인 필요').length;
  const reapplication = all.filter(req=>(req.history || []).some(entry=>String(entry.label || '').includes('재신청 접수'))).length;
  return {total:all.length, completed:completed.length, measurable:dated.length,
    onTime:within, exception, reapplication,
    rate:dated.length ? Math.round(within/dated.length*100) : null};
}
function toolflowCostScenario({seats=10,unitPrice=30000,reused=3,budget=300000}={}){
  const n = Math.min(200,Math.max(0,Math.trunc(Number(seats)||0)));
  const unit = Math.min(1000000,Math.max(0,Math.trunc(Number(unitPrice)||0)));
  const reuse = Math.min(n,Math.max(0,Math.trunc(Number(reused)||0)));
  const cap = Math.min(200000000,Math.max(0,Math.trunc(Number(budget)||0)));
  const newCost = n*unit;
  const reuseCost = (n-reuse)*unit;
  return {seats:n,unitPrice:unit,reused:reuse,budget:cap,newCost,reuseCost,
    estimatedAvoided:newCost-reuseCost,withinBudget:reuseCost<=cap};
}


// Prototype decision aids: recommendations are hypothetical, not realized results.
function toolflowPlanningDecision(scenario){
  if(scenario.seats === 0) return {
    label:'수요 확인 필요',
    reason:'필요 좌석이 0개입니다. 신규 도입 판단에 앞서 실제 사용 목적과 수요를 확인하는 시나리오입니다.'
  };
  if(!scenario.withinBudget) return {
    label:'예산 초과 · 대안 재검토',
    reason:'좌석 재활용을 반영해도 예시 월 예산을 초과합니다. 필요 수량·기간·대체 도구를 비교해 보세요.'
  };
  if(scenario.reused > 0) return {
    label:'기존 좌석 활용 우선 검토',
    reason:'예시 예산 내에서 기존 좌석을 재활용할 수 있습니다. 실제 계약·사용 현황 확인 전까지 구매나 절감 효과는 확정하지 않습니다.'
  };
  return {
    label:'신규 도입 조건 검토',
    reason:'예시 예산 범위에 있지만 대체 도구·승인 조건·사용 기간·권한 범위 검증이 필요합니다.'
  };
}
function toolflowMetricGuidance(stats){
  if(stats.total === 0) return '요청 데이터가 없어 운영 지표를 해석할 수 없습니다. 시연 요청을 생성한 뒤 확인하세요.';
  const notes=[];
  if(stats.measurable === 0) notes.push('완료 시각이 있는 요청이 없어 기한 준수율 판단을 보류합니다.');
  else if(stats.rate < 90) notes.push('시나리오 예시 목표(90%) 미달: 기한 초과 사례와 업무 절차를 점검하세요.');
  else notes.push('측정 가능한 완료 건의 예시 목표(90%) 이상입니다. 측정 건수와 기간을 함께 확인하세요.');
  if(stats.exception > 0) notes.push('예외 요청 '+stats.exception+'건: 승인 기준과 안내 문구를 검토하세요.');
  if(stats.reapplication > 0) notes.push('재신청 이력 '+stats.reapplication+'건: 필수 입력값과 보완 안내를 점검하세요.');
  return notes.join(' ');
}
function toolflowRoleLicenseSummary(roleName,roleRequests){
  const role=roles[roleName];
  if(!role || role.exception) return {total:0,ready:0,remaining:0,unmapped:true};
  const required=[...commonLicenses,...(role.cards||[])].filter(item=>requirementFor(item)==='필수');
  const ready=required.filter(item=>item.status==='auto' || roleRequests?.[item.name]?.status==='completed').length;
  return {total:required.length,ready,remaining:required.length-ready,unmapped:false};
}
