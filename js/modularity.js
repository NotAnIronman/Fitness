/* ============================================================
   PAGE MODULARITY

   Converts each rendered page feature into a movable presentation module.
   The feature's original DOM and event handlers are moved intact; no tracker
   data is copied, filtered, or disabled. Layout state is sparse and per route.
   ============================================================ */

const NON_MODULAR_ROUTES = new Set(['yourpage']);

function getPageLayout(route) {
  const layout = STATE.uiPrefs.pageLayouts?.[route];
  return layout || { order: [], hidden: [], sizes: {} };
}

function ensurePageLayout(route) {
  if (!STATE.uiPrefs.pageLayouts) STATE.uiPrefs.pageLayouts = {};
  if (!STATE.uiPrefs.pageLayouts[route]) STATE.uiPrefs.pageLayouts[route] = { order: [], hidden: [], sizes: {} };
  return STATE.uiPrefs.pageLayouts[route];
}

function pageModuleSlug(value) {
  return String(value || 'feature').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'feature';
}

function cleanModuleTitle(element, route) {
  const known = [
    ['.compact-home-steps', 'Steps'],
    ['.goal-training-lens', 'Training lens'],
    ['.workout-location-manager', 'Training locations'],
    ['.progress-location-filter', 'Workout location filter'],
  ];
  for (const [selector, title] of known) if (element.matches(selector) || element.querySelector(selector)) return title;
  if (element.matches('.day-tabs')) return 'Training days';
  if (element.querySelector('[data-focus-id^="day-name-"]')) return 'Workout day editor';
  if (element.querySelector('input[type="date"]')) return 'Date';
  if (element.querySelector('.progress-labels')) return 'Achievement progress';
  if (element.querySelector('.empty-state')) return route === 'workouts' ? 'Workout day' : 'Getting started';
  if (element.matches('.notice, .notice-pill')) return 'Guidance';
  if (element.matches('.section-note')) return 'Important note';

  const titleNode = element.matches('.card')
    ? element.querySelector(':scope > .card-title')
    : element.querySelector('.card-title');
  if (titleNode) {
    const clone = titleNode.cloneNode(true);
    clone.querySelectorAll('button, .badge, .panel-inline-summary, .travel-count, .tip, [role="tooltip"]').forEach(node => node.remove());
    const text = clone.textContent.trim();
    if (text.startsWith('Logged today')) return 'Logged food';
    if (text.startsWith('Category reference')) return 'Body-fat category reference';
    if (/macro plan$/i.test(text)) return 'Macro plan';
    if (text) return text.slice(0, 80);
  }
  const stat = element.querySelector('.stat-label');
  if (stat?.textContent.trim()) {
    const clone = stat.cloneNode(true);
    clone.querySelectorAll('.tip, [role="tooltip"]').forEach(node => node.remove());
    return clone.textContent.trim().slice(0, 80);
  }
  const heading = element.querySelector('h2, h3, strong');
  if (heading?.textContent.trim()) return heading.textContent.trim().slice(0, 80);
  const routeFallbacks = { progress: 'Exercise progress', pet: 'Pet customization', themes: 'Hidden settings', workouts: 'Workout day' };
  return routeFallbacks[route] || 'Page feature';
}

function collectPageModules(main, route) {
  const candidates = [];
  Array.from(main.children).forEach(element => {
    if (element.classList.contains('page-head') || element.hasAttribute('data-page-layout-manager') || element.hasAttribute('data-page-module-grid')) return;
    const gridChildren = element.classList.contains('grid') ? Array.from(element.children) : [];
    if (gridChildren.length && gridChildren.every(child => child.classList.contains('card'))) {
      const defaultSize = gridChildren.length === 2 ? 'half' : gridChildren.length === 3 ? 'third' : gridChildren.length === 4 ? 'quarter' : 'half';
      gridChildren.forEach(child => candidates.push({ element: child, defaultSize }));
      element.remove();
      return;
    }
    if (element.tagName !== 'HR') candidates.push({ element, defaultSize: 'full' });
  });

  const seen = new Map();
  return candidates.map((candidate, index) => {
    const title = cleanModuleTitle(candidate.element, route);
    let base = pageModuleSlug(title);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return { ...candidate, id: count === 1 ? base : `${base}-${count}`, title: count === 1 ? title : `${title} ${count}` };
  });
}

function orderedPageModules(modules, layout) {
  const byId = new Map(modules.map(module => [module.id, module]));
  const ids = (layout.order || []).filter(id => byId.has(id));
  modules.forEach(module => { if (!ids.includes(module.id)) ids.push(module.id); });
  return ids.map(id => byId.get(id));
}

function renderPageLayoutManager(route, modules, layout) {
  const open = !!UI.pageLayoutManagerOpen[route];
  const hidden = new Set(layout.hidden || []);
  const customized = !!((layout.order || []).length || (layout.hidden || []).length || Object.keys(layout.sizes || {}).length);
  const manager = document.createElement('div');
  manager.className = `card page-layout-manager${open ? '' : ' panel-card-collapsed'}`;
  manager.setAttribute('data-page-layout-manager', route);
  manager.innerHTML = `<div class="card-title"><span>Customize this page</span><span class="panel-inline-summary">${modules.length} feature${modules.length === 1 ? '' : 's'}${customized ? ' · customized' : ''}</span><button class="panel-collapse-btn" onclick="togglePageLayoutManager('${route}')" aria-expanded="${open}" aria-label="${open ? 'Close' : 'Open'} page layout manager">${open ? '−' : '+'}</button></div>
    ${open ? `<p class="hint">Move, resize, or hide features on this tab. Hiding changes only the layout; Forge keeps tracking the same data.</p><div class="page-layout-store">${modules.map(module => {
      const size = layout.sizes?.[module.id] || module.defaultSize;
      return `<div class="tile-store-row"><span>${escapeAttr(module.title)}</span><span class="page-layout-store-actions"><button class="btn btn-sm" onclick="setPageModuleSize('${route}','${module.id}','${size === 'half' ? 'full' : 'half'}')" aria-label="Make ${escapeAttr(module.title)} ${size === 'half' ? 'full width' : 'half width'}">${size === 'half' ? 'Make full width' : 'Make half width'}</button><button class="btn btn-sm" onclick="togglePageModule('${route}','${module.id}')" aria-label="${hidden.has(module.id) ? 'Show' : 'Hide'} ${escapeAttr(module.title)}">${hidden.has(module.id) ? 'Show' : 'Hide'}</button></span></div>`;
    }).join('')}</div><button class="btn btn-ghost btn-sm page-layout-reset" onclick="resetPageLayout('${route}')" ${customized ? '' : 'disabled'}>Restore default layout</button>` : ''}`;
  return manager;
}

function renderPageModuleShell(route, module, index, modules, layout) {
  const hidden = new Set(layout.hidden || []);
  const size = layout.sizes?.[module.id] || module.defaultSize;
  const editing = !!UI.pageLayoutManagerOpen[route];
  const onboardingRequired = module.element.classList.contains('onboarding-focus') || !!module.element.querySelector('.onboarding-focus');
  const shell = document.createElement('section');
  shell.className = `page-module page-module-${size}${editing ? ' page-module-editing' : ''}`;
  shell.dataset.moduleId = module.id;
  shell.dataset.moduleTitle = module.title;
  shell.dataset.defaultSize = module.defaultSize;
  shell.draggable = editing;
  if (hidden.has(module.id) && !onboardingRequired) shell.hidden = true;
  if (editing) {
    shell.setAttribute('ondragstart', `startPageModuleDrag(event,'${module.id}')`);
    shell.setAttribute('ondragover', 'event.preventDefault()');
    shell.setAttribute('ondrop', `dropPageModule(event,'${route}','${module.id}')`);
    const tools = document.createElement('div');
    tools.className = 'page-module-tools';
    tools.setAttribute('aria-label', `${module.title} layout controls`);
    tools.innerHTML = `<button class="icon-btn" onclick="movePageModule('${route}','${module.id}',-1)" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escapeAttr(module.title)} earlier">↑</button><button class="icon-btn" onclick="movePageModule('${route}','${module.id}',1)" ${index === modules.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeAttr(module.title)} later">↓</button><button class="btn btn-sm" onclick="setPageModuleSize('${route}','${module.id}','${size === 'half' ? 'full' : 'half'}')" aria-label="Make ${escapeAttr(module.title)} ${size === 'half' ? 'full width' : 'half width'}">${size === 'half' ? 'Full' : 'Half'}</button><button class="icon-btn" onclick="togglePageModule('${route}','${module.id}')" aria-label="Hide ${escapeAttr(module.title)}">×</button>`;
    shell.appendChild(tools);
  }
  shell.appendChild(module.element);
  return shell;
}

function applyPageModularity(route) {
  if (NON_MODULAR_ROUTES.has(route)) return;
  const main = document.getElementById('main-content');
  if (!main) return;
  const modules = collectPageModules(main, route);
  if (!modules.length) return;
  const layout = getPageLayout(route);
  const ordered = orderedPageModules(modules, layout);
  const pageHead = main.querySelector(':scope > .page-head');
  const manager = renderPageLayoutManager(route, ordered, layout);
  if (pageHead) pageHead.insertAdjacentElement('afterend', manager); else main.prepend(manager);
  const grid = document.createElement('div');
  grid.className = 'page-module-grid';
  grid.setAttribute('data-page-module-grid', route);
  ordered.forEach((module, index) => grid.appendChild(renderPageModuleShell(route, module, index, ordered, layout)));
  manager.insertAdjacentElement('afterend', grid);
}

function togglePageLayoutManager(route) {
  UI.pageLayoutManagerOpen[route] = !UI.pageLayoutManagerOpen[route];
  render();
}

function currentPageModuleIds() {
  return Array.from(document.querySelectorAll('.page-module[data-module-id]')).map(element => element.dataset.moduleId);
}

function movePageModule(route, moduleId, offset) {
  const order = currentPageModuleIds();
  const index = order.indexOf(moduleId), target = Math.max(0, Math.min(order.length - 1, index + offset));
  if (index < 0 || index === target) return;
  order.splice(target, 0, order.splice(index, 1)[0]);
  ensurePageLayout(route).order = order;
  persist(); render();
}

function setPageModuleSize(route, moduleId, size) {
  if (size !== 'half' && size !== 'full') return;
  ensurePageLayout(route).sizes[moduleId] = size;
  persist(); render();
}

function togglePageModule(route, moduleId) {
  const layout = ensurePageLayout(route);
  const hidden = new Set(layout.hidden || []);
  if (hidden.has(moduleId)) hidden.delete(moduleId); else hidden.add(moduleId);
  layout.hidden = Array.from(hidden);
  persist(); render();
}

function resetPageLayout(route) {
  if (STATE.uiPrefs.pageLayouts) {
    delete STATE.uiPrefs.pageLayouts[route];
    if (!Object.keys(STATE.uiPrefs.pageLayouts).length) STATE.uiPrefs.pageLayouts = {};
  }
  persist(); render();
}

function startPageModuleDrag(event, moduleId) {
  UI.draggedPageModuleId = moduleId;
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', moduleId); }
}

function dropPageModule(event, route, targetId) {
  event.preventDefault();
  const sourceId = UI.draggedPageModuleId || event.dataTransfer?.getData('text/plain');
  UI.draggedPageModuleId = null;
  const order = currentPageModuleIds(), from = order.indexOf(sourceId), to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;
  order.splice(to, 0, order.splice(from, 1)[0]);
  ensurePageLayout(route).order = order;
  persist(); render();
}
