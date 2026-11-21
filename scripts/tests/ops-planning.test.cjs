'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const policySandbox = {
  findLicenseByName:name=>name==='Adobe Creative Cloud' ? {name,audience:'디자인 직군'} : null,
  businessDayDistance:(from,to)=>Math.round((to.getTime()-from.getTime())/86400000),
  commonLicenses:[{name:'공통 도구',mono:'GS',status:'auto'}],
  roles:{office:{cards:[
    {name:'필수 도구',mono:'HG',status:'request'},
    {name:'선택 도구',mono:'NT',status:'request'}
  ]}}
};
vm.createContext(policySandbox);
vm.runInContext(fs.readFileSync('js/product-readiness.js','utf8') +
  '\n;globalThis.policyChecks = {toolflowPolicyFor,toolflowCostScenario,toolflowServiceMetrics,toolflowPlanningDecision,toolflowMetricGuidance,toolflowRoleLicenseSummary};',policySandbox);
const {toolflowPolicyFor,toolflowCostScenario,toolflowServiceMetrics,toolflowPlanningDecision,toolflowMetricGuidance,toolflowRoleLicenseSummary}=policySandbox.policyChecks;

test('cost comparison uses explicitly illustrative values and bounds reuse to seat count',()=>{
  const scenario=toolflowCostScenario({seats:10,unitPrice:30000,reused:3,budget:300000});
  assert.equal(scenario.newCost,300000);
  assert.equal(scenario.reuseCost,210000);
  assert.equal(scenario.estimatedAvoided,90000);
  assert.equal(scenario.withinBudget,true);
  const capped=toolflowCostScenario({seats:2,unitPrice:1000,reused:50,budget:0});
  assert.equal(capped.reused,2);
  assert.equal(capped.reuseCost,0);
});

test('approval route and exception policy are auditable without real entitlement claims',()=>{
  const req={name:'Adobe Creative Cloud',baseStatus:'approval',scope:'관리 권한 · 별도 검토 필요',budget:''};
  const result=toolflowPolicyFor(req);
  assert.match(result.route,/관리자 승인/);
  assert.ok(result.flags.includes('고권한 추가 검토'));
  assert.ok(result.flags.includes('비용 부담 부서 확인'));
  const fallback=toolflowPolicyFor({name:'목록 외 도구',baseStatus:'request'});
  assert.ok(fallback.flags.includes('직무·도구 별도 확인'));
  const offRole=toolflowPolicyFor({name:'Adobe Creative Cloud',roleLabel:'경영지원·총무',baseStatus:'approval',budget:'IT 예산',scope:'조회 권한'});
  assert.ok(offRole.flags.includes('직무·도구 별도 확인'));
});

test('quality metric denominator excludes unfinished and unknown completion times',()=>{
  const requests=[
    {name:'Adobe Creative Cloud',status:'completed',dueDate:'2026-11-20T12:00:00+09:00',completedAt:Date.parse('2026-11-20T10:00:00+09:00'),history:[]},
    {name:'Adobe Creative Cloud',status:'completed',dueDate:'2026-11-20T12:00:00+09:00',completedAt:'',history:[]},
    {name:'목록 외 도구',status:'pending',roleLabel:'직무 확인 필요',history:[{label:'재신청 접수'}]}
  ];
  const value=toolflowServiceMetrics(requests);
  assert.equal(value.total,3);
  assert.equal(value.completed,2);
  assert.equal(value.measurable,1);
  assert.equal(value.onTime,1);
  assert.equal(value.rate,100);
  assert.equal(value.exception,1);
  assert.equal(value.reapplication,1);
});

test('session normalization preserves numeric completedAt and limits reviewer fields',()=>{
  const sandbox={roles:{office:{label:'경영지원·총무'}}};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('js/state.js','utf8') +
    '\n;globalThis.normalize = sanitizeRequestRecord;',sandbox);
  const record=sandbox.normalize('Microsoft Office',{
    ticket:'ITSM-1042',status:'completed',completedAt:Date.parse('2026-11-20T10:00:00+09:00'),
    priority:'unexpected',reviewTeam:'outside-team',assignedRole:'not-valid',reviewNote:'x'.repeat(300),history:[]
  },'office');
  assert.equal(record.completedAt,Date.parse('2026-11-20T10:00:00+09:00'));
  assert.equal(record.priority,'일반');
  assert.equal(record.reviewTeam,'IT팀');
  assert.equal(record.assignedRole,'미배정');
  assert.equal(record.reviewNote.length,200);
});


test('planning guidance translates illustrative costs into decision reasons without claiming ROI',()=>{
  const within=toolflowPlanningDecision(toolflowCostScenario({seats:10,unitPrice:30000,reused:3,budget:300000}));
  assert.match(within.label,/기존 좌석 활용/);
  assert.match(within.reason,/실제 계약/);
  const over=toolflowPlanningDecision(toolflowCostScenario({seats:10,unitPrice:30000,reused:0,budget:100000}));
  assert.match(over.label,/예산 초과/);
  assert.match(over.reason,/대체 도구/);
  const zero=toolflowPlanningDecision(toolflowCostScenario({seats:0,unitPrice:30000,reused:0,budget:0}));
  assert.match(zero.label,/수요 확인/);
});

test('KPI guidance distinguishes missing denominators and policy-review candidates',()=>{
  assert.match(toolflowMetricGuidance({total:0,measurable:0}),/요청 데이터가 없어/);
  assert.match(toolflowMetricGuidance({total:2,measurable:0,exception:1,reapplication:1}),/판단을 보류/);
  const note=toolflowMetricGuidance({total:5,measurable:3,rate:67,exception:1,reapplication:1});
  assert.match(note,/예시 목표\(90%\) 미달/);
  assert.match(note,/예외 요청 1건/);
  assert.match(note,/재신청 이력 1건/);
});

test('GA readiness derives from required catalog states, not manually checked tasks',()=>{
  const waiting=toolflowRoleLicenseSummary('office',{});
  assert.equal(waiting.total,2);
  assert.equal(waiting.ready,1);
  assert.equal(waiting.remaining,1);
  const fulfilled=toolflowRoleLicenseSummary('office',{'필수 도구':{status:'completed'}});
  assert.equal(fulfilled.ready,2);
  assert.equal(fulfilled.remaining,0);
  const missingRole=toolflowRoleLicenseSummary('not-a-role',{});
  assert.equal(missingRole.unmapped,true);
});
