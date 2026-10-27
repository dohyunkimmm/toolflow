'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {execFileSync} = require('child_process');
execFileSync(process.execPath,['--test','scripts/tests/ai-recommendation.test.cjs','scripts/tests/public-assets.test.cjs','scripts/tests/commit-signature-readiness.test.cjs','scripts/product-review-check.js'],{stdio:'inherit'});
const { validateReleaseContract } = require('./release-contract');
const { collectPublicAssets } = require('./public-assets');

const read = p => fs.readFileSync(p, 'utf8');
const fail = message => { console.error(`QUALITY GATE FAILED: ${message}`); process.exit(1); };

const runtimeFiles = ['index.html','js/app.js','js/a11y.js','js/analytics.js','js/events.js','js/ai-recommendation.js'];
for(const file of runtimeFiles){
  const text = read(file);
  if(/\son[a-z]+\s*=/i.test(text)) fail(`${file} still contains an inline event handler`);
  if(/\sstyle\s*=/i.test(text)) fail(`${file} still contains an inline style attribute`);
  if(/\.style\s*[.=]/.test(text)) fail(`${file} still mutates inline style`);
  if(/javascript\s*:/i.test(text)) fail(`${file} contains a javascript: URL`);
}

const readme = read('README.md');
const expectedNavigation = '[Demo](https://toolflow-dohyunkimmm.vercel.app/) · [Case Study](https://app.notion.com/p/08d21460c934838cb66601b681e85d8c)';
const readmeNavigation = readme.split('\n').find(line => line.startsWith('[Demo](')) || '';
if(readmeNavigation !== expectedNavigation) fail('README must link to the Demo and external Case Study, without a redundant GitHub self-link');
if(!read('index.html').includes('<link href="https://toolflow-dohyunkimmm.vercel.app/" rel="canonical"/>')) fail('SEO canonical URL must match the ToolFlow production domain');
const catalogHtml = read('index.html');
if(/id="(?:workTypeFilter|requirementFilter|catalogSort)"/.test(catalogHtml)) fail('Removed employee catalog dropdown has returned');
for(const id of ['roleSelect','toolSearch','filterTabs']) if(!catalogHtml.includes('id="'+id+'"')) fail('Essential catalog control missing: '+id);

if(/\[(?:직접 체험|2[–-]3분 체험 안내)\]\(|docs\/DEMO_WALKTHROUGH\.md/.test(readme)) fail('README still exposes an unrequested 2–3 minute walkthrough or stale demo label');
if(/^##\s+\d{4}-\d{2}-\d{2}\b/m.test(readme) || /Portfolio release —|\/pull\/\d+|\[릴리스 이력\]\(|\[\d{4}-\d{2}-\d{2} 제품 검토\]\(/.test(readme)) fail('README must stay product-focused; dated release and PR history belong in CHANGELOG');

const html = read('index.html');
if(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('index.html contains an inline script block');
if(/cdn\.jsdelivr\.net/i.test(html)) fail('index.html still has a jsDelivr runtime dependency');
if(!/href="fonts\/pretendard\.css"/.test(html)) fail('self-hosted Pretendard stylesheet is not linked');

let release;
let publicAssets;
try{
  release = validateReleaseContract();
  publicAssets = collectPublicAssets();
}catch(error){
  fail(error.message);
}

const fontCssPath = path.join('fonts','pretendard.css');
if(!fs.existsSync(fontCssPath)) fail('self-hosted Pretendard CSS is missing');
if(!fs.existsSync(path.join('fonts','PRETENDARD-LICENSE.txt'))) fail('Pretendard license file is missing');
const fontCss = read(fontCssPath);
const fontRefs = [...fontCss.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].trim().replace(/^['"]|['"]$/g,''));
if(!fontRefs.length) fail('Pretendard CSS has no font files');
for(const ref of fontRefs){
  if(/^https?:/i.test(ref)) fail(`Pretendard CSS still uses remote font URL: ${ref}`);
  const resolved = path.resolve(path.dirname(fontCssPath), ref);
  if(!fs.existsSync(resolved)) fail(`Pretendard font file missing: ${ref}`);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(read('js/data.js') + '\n;globalThis.__catalog={commonLicenses,roles,recommendationCases};', sandbox);
const { commonLicenses, roles, recommendationCases } = sandbox.__catalog;
const visibleCards = [...commonLicenses, ...Object.values(roles).flatMap(role => [...(role.cards || [])])];
const extraCards = Object.values(roles).flatMap(role => [...(role.extras || [])]);
const cards = [...visibleCards, ...extraCards];
if(cards.length !== 43) fail(`expected 43 licenses, found ${cards.length}`);
if(visibleCards.length !== 23) fail(`expected 23 main-list licenses, found ${visibleCards.length}`);
if(extraCards.length !== 20) fail(`expected 20 AI-only extra licenses, found ${extraCards.length}`);
if(cards.length !== visibleCards.length + extraCards.length) fail('main-list and AI-only catalog partitions do not reconcile');
const publicCatalogCount = `공통 ${commonLicenses.length}개 + 직무별 ${cards.length-commonLicenses.length}개 = 총 ${cards.length}개`;
for(const file of ['README.md','docs/DEMO_WALKTHROUGH.md']){
  const publicText = read(file);
  if(!publicText.includes(publicCatalogCount)) fail(`${file} catalog count is not synchronized with js/data.js: ${publicCatalogCount}`);
  if(/21개\s*(도구|SaaS)|공통\s*6종/.test(publicText)) fail(`${file} still advertises an outdated catalog count`);
}
const names = new Set();
const ids = new Set();
const urlOwners = new Map();
for(const item of cards){
  for(const key of ['mono','name','cat','owner','audience','status','url']) if(!item[key]) fail(`${item.name || 'unknown'} missing ${key}`);
  if(names.has(item.name)) fail(`duplicate tool name: ${item.name}`);
  names.add(item.name);
  if(ids.has(item.mono)) fail(`duplicate tool id: ${item.mono}`);
  ids.add(item.mono);
  if(!['auto','request','approval'].includes(item.status)) fail(`${item.name} has invalid base status ${item.status}`);
  if(!/^https:\/\//.test(item.url)) fail(`${item.name} URL must use https`);
  let normalizedUrl;
  try{ normalizedUrl = new URL(item.url).href.replace(/\/$/,''); }
  catch(_error){ fail(`${item.name} URL is invalid: ${item.url}`); }
  if(urlOwners.has(normalizedUrl)) fail(`duplicate tool URL: ${urlOwners.get(normalizedUrl)} and ${item.name} (${normalizedUrl})`);
  urlOwners.set(normalizedUrl,item.name);
  if(item.icon && !fs.existsSync(path.join('.', item.icon))) fail(`${item.name} icon missing: ${item.icon}`);
}
const visibleIds = new Set(visibleCards.map(item=>item.mono));
for(const item of visibleCards){
  if(item.bucket) fail(`${item.name} main-list item must not be tagged as an AI-only extra`);
}
for(const item of extraCards){
  if(visibleIds.has(item.mono)) fail(`${item.name} appears in both the main list and AI-only extras`);
  if(!['AI','협업툴','PM툴','기타'].includes(item.bucket)) fail(`${item.name} has invalid AI-only bucket: ${item.bucket || 'missing'}`);
}
for(const item of commonLicenses){
  if(item.audience !== '전사 구성원') fail(`${item.name} common-list audience must be 전사 구성원`);
}
for(const [roleName,role] of Object.entries(roles)){
  if(!role.exception){
    for(const item of [...(role.cards || []),...(role.extras || [])]){
      if(item.audience !== `${role.label} 직군`) fail(`${item.name} audience does not match role ${roleName}`);
    }
  }
}
for(const [group,cases] of Object.entries(recommendationCases)){
  for(const scenario of cases){
    for(const item of scenario.recommendations || []){
      if(!ids.has(item.toolId)) fail(`recommendation case ${group}/${scenario.id} references unknown tool id: ${item.toolId}`);
    }
  }
}
for(const roleName of ['design','dev','data','office','unmapped']) if(!roles[roleName]) fail(`missing role ${roleName}`);

const stateSource = read('js/state.js');
for(const token of ['requestStateByRole','cancelledHistoryByRole','cancelledTicketsByRole','activateRoleState','onboard-os:v4']){
  if(!stateSource.includes(token)) fail(`role-isolated state contract missing ${token}`);
}
const analyticsSource = read('js/analytics.js');
for(const token of ['ANALYTICS_FIELD_ALLOWLIST','sanitizeAnalyticsData','isSafeAnalyticsValue']){
  if(!analyticsSource.includes(token)) fail(`analytics privacy boundary missing ${token}`);
}

const config = JSON.parse(read('vercel.json'));
const allHeaders = (config.headers || []).flatMap(rule => rule.headers || []);
const headerMap = new Map(allHeaders.map(h => [h.key.toLowerCase(),h.value]));
const csp = headerMap.get('content-security-policy') || '';
for(const directive of ["default-src 'self'", "script-src-attr 'none'", "style-src-attr 'none'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", 'upgrade-insecure-requests']){
  if(!csp.includes(directive)) fail(`CSP missing ${directive}`);
}
if(csp.includes("'unsafe-eval'")) fail('CSP must not allow unsafe-eval');
if(/cdn\.jsdelivr\.net/i.test(csp)) fail('CSP still allows the removed font CDN');
if(headerMap.get('x-content-type-options') !== 'nosniff') fail('X-Content-Type-Options must be nosniff');
if(headerMap.get('x-frame-options') !== 'DENY') fail('X-Frame-Options must be DENY');
if(headerMap.get('referrer-policy') !== 'strict-origin-when-cross-origin') fail('Referrer-Policy mismatch');
const permissionsPolicy = headerMap.get('permissions-policy') || '';
for(const feature of ['camera=()','microphone=()','geolocation=()']) if(!permissionsPolicy.includes(feature)) fail(`Permissions-Policy missing ${feature}`);

const workflowDir = path.join('.github','workflows');
for(const name of fs.readdirSync(workflowDir).filter(name => /\.ya?ml$/i.test(name))){
  const workflow = read(path.join(workflowDir,name));
  for(const match of workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)){
    const target = match[1];
    if(target.startsWith('./')) continue;
    const at = target.lastIndexOf('@');
    const ref = at >= 0 ? target.slice(at+1) : '';
    if(!/^[0-9a-f]{40}$/.test(ref)) fail(`${name} uses mutable action ref: ${target}`);
  }
}

const dependabot = read(path.join('.github','dependabot.yml'));
if(!/package-ecosystem:\s*npm/.test(dependabot) || !/package-ecosystem:\s*github-actions/.test(dependabot)) fail('Dependabot must cover npm and GitHub Actions');
const e2eWorkflow = read(path.join('.github','workflows','e2e.yml'));
if(!/npm audit --audit-level=high/.test(e2eWorkflow)) fail('high+ npm audit gate missing');
if(!/scripts\/dependency-review\.js/.test(e2eWorkflow)) fail('PR dependency delta gate missing');
if(!/Security \/ failure-containment gate/.test(e2eWorkflow)) fail('v7 security CI gate missing');
if(!/npm run test:security/.test(e2eWorkflow)) fail('v7 security scenario command missing');
if(!/Interaction UX \/ accessibility state gate/.test(e2eWorkflow)) fail('v8 interaction UX CI gate missing');
if(!/npm run test:ux/.test(e2eWorkflow)) fail('v8 interaction UX scenario command missing');
if(!/Visual system \/ usability state gate/.test(e2eWorkflow)) fail('v9 visual system CI gate missing');
if(!/npm run test:visual-system/.test(e2eWorkflow)) fail('v9 visual system scenario command missing');
if(!/Design polish \/ responsive hierarchy gate/.test(e2eWorkflow)) fail('v10 design polish CI gate missing');
if(!/npm run test:design-polish/.test(e2eWorkflow)) fail('v10 design polish scenario command missing');
if(!fs.existsSync(path.join('scripts','dependency-review.js'))) fail('dependency-review.js is missing');
if(!fs.existsSync(path.join('scripts','security-summary.js'))) fail('security-summary.js is missing');
if(!fs.existsSync(path.join('scripts','ux-summary.js'))) fail('ux-summary.js is missing');
if(!fs.existsSync(path.join('tests','security.spec.js'))) fail('security.spec.js is missing');
if(!fs.existsSync(path.join('tests','ux-interaction.spec.js'))) fail('ux-interaction.spec.js is missing');
if(!fs.existsSync(path.join('tests','visual-system.spec.js'))) fail('visual-system.spec.js is missing');
if(!fs.existsSync(path.join('tests','design-polish.spec.js'))) fail('design-polish.spec.js is missing');

console.log(`Quality gate PASS: ${cards.length} tools (${visibleCards.length} main + ${extraCards.length} AI-only), ${names.size} unique names and IDs, ${fontRefs.length} self-hosted font subsets, ${publicAssets.length} manifest assets, release ${release.version} canonical contract, role isolation, R1-R8 resilience, S1-S8 security, U1-U8 interaction UX, V1-V8 visual system, D1-D8 design polish, security headers + analytics privacy boundary + SHA-pinned workflows`);
