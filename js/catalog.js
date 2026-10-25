'use strict';

let defaultCatalogRole = null;
// Keep filtering separate from entitlement and request state.
function catalogItemMatches(item, status, options){
  if(!item) return false;
  const text = [item.name, item.cat, options.purpose || '', item.owner, item.audience].join(' ').toLocaleLowerCase();
  const words = String(options.query || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (!options.statusGroup || options.statusGroup.has(status))
    && words.every(word => text.includes(word));
}

function matchesCatalogFilters(item, status, group){
  return catalogItemMatches(item, status, {
    query: document.getElementById('toolSearch')?.value || '',
    purpose: item ? LICENSE_PURPOSES[item.mono] || '' : '',
    statusGroup: group
  });
}

function syncCatalogUI(){
  if(defaultCatalogRole === null) defaultCatalogRole = currentRole;
  const count = document.querySelectorAll('#roleGrid .card:not(.is-hidden), #commonGrid .card:not(.is-hidden)').length;
  const result = document.getElementById('catalogResultCount');
  if(result) result.innerHTML = `검색 결과 <strong>${count}</strong>개`;
  const selected = document.getElementById('selectedCatalogFilters');
  if(!selected) return;
  const entries = [];
  if(currentRole !== defaultCatalogRole) entries.push(['role', '직군 · '+roles[currentRole].label]);
  if(selectedFilter !== 'all'){
    const chip = document.querySelector(`#filterTabs [data-filter="${selectedFilter}"]`);
    entries.push(['status', '상태 · '+chip.textContent]);
  }
  const query = document.getElementById('toolSearch')?.value.trim();
  if(query) entries.push(['query', '검색 · '+query]);
  selected.replaceChildren();
  selected.hidden = entries.length === 0;
  for(const [key,label] of entries){
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-selected-tag';
    button.dataset.catalogClear = key;
    button.setAttribute('aria-label', label+' 해제');
    const cross = document.createElement('span');
    cross.textContent = '×';
    cross.setAttribute('aria-hidden','true');
    button.append(document.createTextNode(label),cross);
    selected.append(button);
  }
}

function clearCatalogFilter(key){
  if(key === 'role'){
    setRole(defaultCatalogRole || 'office');
  } else if(key === 'status'){
    setFilter('all');
  } else {
    const id = {query:'toolSearch'}[key];
    const input = id && document.getElementById(id);
    if(input) input.value = '';
    applyFilters();
  }
}

function resetCatalogFilters(){
  document.getElementById('toolSearch').value = '';
  const common = document.getElementById('commonTools');
  if(common) common.open = true;
  if(typeof commonWasOpenBeforeSearch !== 'undefined') commonWasOpenBeforeSearch = null;
  selectedFilter = 'all';
  syncFilterUI();
  if(currentRole !== defaultCatalogRole) setRole(defaultCatalogRole || 'office');
  else applyFilters();
  saveSession();
}

document.addEventListener('click', event => {
  const clear = event.target.closest('[data-catalog-clear]');
  if(clear){
    clearCatalogFilter(clear.dataset.catalogClear);
    const control = document.getElementById({query:'toolSearch',role:'roleSelect',status:'filterTabs'}[clear.dataset.catalogClear]);
    (control?.querySelector('button') || control)?.focus();
  }
  if(event.target.closest('[data-action="reset-catalog-filters"]')) resetCatalogFilters();
});
