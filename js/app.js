/* ============================================================
   APP - state, router, shell, and Home (profile/BMR/TDEE) view
   ============================================================ */

const LAST_ROUTE_KEY = 'forge.lastRoute';

// Kept deliberately independent of NAV_ITEMS (which isn't defined yet this early
// in the file) - doRender()'s route dispatch below has a safe fallback to
// 'home' for anything it doesn't recognize, so an invalid/stale stored value
// here just quietly lands on Home instead of a blank page.
function loadLastRoute() {
  try {
    return localStorage.getItem(LAST_ROUTE_KEY) || 'home';
  } catch (e) {
    return 'home';
  }
}
function saveLastRoute(route) {
  try { localStorage.setItem(LAST_ROUTE_KEY, route); } catch (e) { /* private browsing etc, not critical */ }
}

let STATE = loadState();
let UI = {
  route: loadLastRoute(),
  workoutDayId: null,
  addExerciseOpenFor: null,
  copyDayOpenFor: null,
  addExerciseCategory: 'Chest',
  foodDate: todayISO(),
  foodQuery: '',
  foodResults: [],
  foodSearchLoading: false,
  foodAdjustDraft: null,
  showCustomFood: false,
  logDate: todayISO(),
  logAddOpen: false,
  logCopyOpen: false,
  logCopyMode: 'add',
  progressExerciseId: null,
  progressLocationId: 'all',
  workoutLocationManagerOpen: false,
  yourPageManagerOpen: false,
  pageLayoutManagerOpen: {},
  draggedTileId: null,
  draggedPageModuleId: null,
  editingExercise: null, // { scope: 'workout'|'log', dayId, entryId }
  mealBuilderOpen: false,
  mealBuilderName: '',
  mealBuilderItems: [], // [{name,kcal,protein,carbs,fat,qty}]
  editingFoodIndex: null,
  secretPanelOpen: false,
  foodQuickPicksOpen: false,
  barcodeScannerOpen: false,
  barcodeStatus: '',
  petShopGroupOpen: {},
  petChangePanelOpen: false,
  petCustomizeOpen: false,
  pasteSyncOpen: false,
  qrTransferMode: null,
  qrPayloadParts: [],
  qrPartIndex: 0,
  qrScopeLabel: '',
  qrFullPartCount: 0,
  qrExpanded: false,
  qrStatus: '',
};

// Bump this alongside CACHE_VERSION in sw.js on every deploy. Shown as a hover/
// tap tooltip on the FORGE logo, the most direct way to confirm a deploy
// actually reached the browser (vs. the browser/service worker still serving
// something older), since it's visible without opening dev tools.
const APP_VERSION = 'forge-v22';

function todayISO() {
  return dateToLocalISO(new Date());
}

// Converts a Date object to a 'YYYY-MM-DD' string using the LOCAL calendar
// date, not UTC. Date.toISOString() always formats in UTC, which silently
// gives the wrong day whenever local time and UTC fall on different calendar
// dates (e.g. it's still Thursday evening locally but already Friday UTC).
// Every date-math spot in the app should go through this, not
// .toISOString().slice(0,10) directly.
function dateToLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function persist() {
  saveState(STATE);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ---------- Tooltip component ----------
// Hover shows it on desktop for free (CSS :hover). Tap toggles it on mobile via
// the delegated click listener below, since touch devices have no hover state.
function tip(label, title, bodyHtml) {
  return `<span class="tip" tabindex="0" role="button" aria-label="More information: ${escapeAttr(title)}">${label}<span class="tip-box" role="tooltip"><span class="tip-title">${escapeAttr(title)}</span>${bodyHtml}</span></span>`;
}

// Tooltips default to centering under their trigger, which can push them off
// the left/right edge of the screen for triggers near the edge (e.g. sidebar-
// adjacent cards, or mobile). This nudges an already-open tooltip back into
// the viewport instead of letting it get clipped.
function clampTipToViewport(tipEl) {
  const box = tipEl.querySelector('.tip-box');
  if (!box) return;
  box.removeAttribute('style');
  requestAnimationFrame(() => {
    const margin = 10;
    // The brand lives inside an overflow-scrolling mobile nav. Positioning its
    // version card against the viewport prevents that ancestor from clipping it.
    if (tipEl.classList.contains('brand')) {
      const trigger = tipEl.getBoundingClientRect();
      const width = Math.min(260, window.innerWidth - margin * 2);
      box.style.position = 'fixed';
      box.style.width = `${width}px`;
      box.style.left = `${Math.max(margin, Math.min(trigger.left, window.innerWidth - width - margin))}px`;
      box.style.top = `${Math.min(window.innerHeight - box.offsetHeight - margin, trigger.bottom + 8)}px`;
      box.style.bottom = 'auto';
      box.style.transform = 'none';
      return;
    }
    const rect = box.getBoundingClientRect();
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - rect.right;
    if (shift !== 0) box.style.transform = `translateX(calc(-50% + ${shift}px))`;
  });
}

document.addEventListener('click', (e) => {
  const target = e.target.closest ? e.target.closest('.tip') : null;
  document.querySelectorAll('.tip.tip-open').forEach(t => { if (t !== target) t.classList.remove('tip-open'); });
  if (target) {
    target.classList.toggle('tip-open');
    if (target.classList.contains('tip-open')) clampTipToViewport(target);
  }
});
// mouseover/mouseout bubble (unlike mouseenter/mouseleave), so this works via
// delegation even though tooltips are recreated on every render.
document.addEventListener('mouseover', (e) => {
  const target = e.target.closest ? e.target.closest('.tip') : null;
  if (target) clampTipToViewport(target);
});
document.addEventListener('keydown', (e) => {
  const target = e.target.closest ? e.target.closest('.tip') : null;
  if (!target || (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape')) return;
  e.preventDefault();
  if (e.key === 'Escape') target.classList.remove('tip-open');
  else {
    target.classList.toggle('tip-open');
    if (target.classList.contains('tip-open')) clampTipToViewport(target);
  }
});

// ---------- Dismissible / collapsible notice component ----------
// Used for one-time explanatory tips that would otherwise clutter the page.
// Collapses to a small pill; state persists per notice id.
function notice(id, bodyHtml, options) {
  options = options || {};
  const level = STATE.uiPrefs.knowledgeLevel || 0;
  const maxLevel = options.maxLevel == null ? 2 : options.maxLevel;
  if (level > maxLevel) return '';
  const override = STATE.uiPrefs.noticeOverrides[id];
  const legacyCollapsed = STATE.uiPrefs.collapsedNotices.includes(id);
  const defaultOpenThrough = options.defaultOpenThrough == null ? 1 : options.defaultOpenThrough;
  const isOpen = typeof override === 'boolean' ? override : (!legacyCollapsed && level <= defaultOpenThrough);
  const content = level >= 2 && options.brief ? options.brief : bodyHtml;
  if (!isOpen) {
    return `<button type="button" class="notice-pill" onclick="toggleNotice('${id}')"><span class="plus">+</span> Show tip</button>`;
  }
  return `<div class="notice"><div class="notice-body">${content}</div><button class="notice-collapse-btn" onclick="toggleNotice('${id}')" title="Collapse this tip">-</button></div>`;
}
function toggleNotice(id) {
  const current = STATE.uiPrefs.noticeOverrides[id];
  const level = STATE.uiPrefs.knowledgeLevel || 0;
  const defaultOpen = !STATE.uiPrefs.collapsedNotices.includes(id) && level <= 1;
  STATE.uiPrefs.noticeOverrides[id] = !(typeof current === 'boolean' ? current : defaultOpen);
  persist(); render();
}

const KNOWLEDGE_LEVELS = [
  { label: 'Complete Beginner', detail: 'All tips and fuller explanations' },
  { label: 'I know a little bit', detail: 'Most guidance, without beginner-only tips' },
  { label: 'I know a decent amount', detail: 'Useful tips, usually kept compact' },
  { label: 'I know a lot', detail: 'Only important guidance' },
  { label: 'I know it all!', detail: 'No optional tips or explanations' },
];

function setKnowledgeLevel(value) {
  STATE.uiPrefs.knowledgeLevel = Math.max(0, Math.min(4, Math.round(Number(value) || 0)));
  STATE.uiPrefs.knowledgeLevelTouched = true;
  if (STATE.uiPrefs.knowledgeLevel === 4 && STATE.onboarding.active) {
    STATE.onboarding.active = false;
    STATE.onboarding.dismissed = true;
  }
  persist(); render();
}

function previewKnowledgeLevel(value) {
  const index = Math.max(0, Math.min(4, Math.round(Number(value) || 0)));
  const label = document.getElementById('knowledge-level-label');
  const detail = document.getElementById('knowledge-level-detail');
  if (label) label.textContent = KNOWLEDGE_LEVELS[index].label;
  if (detail) detail.textContent = KNOWLEDGE_LEVELS[index].detail;
}

function confirmDefaultKnowledgeLevel() { setKnowledgeLevel(STATE.uiPrefs.knowledgeLevel || 0); }

function renderKnowledgeLevelCard() {
  const level = STATE.uiPrefs.knowledgeLevel || 0;
  const info = KNOWLEDGE_LEVELS[level];
  return `<div class="card knowledge-card ${STATE.onboarding.active && STATE.onboarding.step === 2 ? 'onboarding-focus' : ''}">
    <div class="card-title">How much guidance would you like?</div>
    <div class="knowledge-heading"><strong id="knowledge-level-label">${info.label}</strong><span>${level + 1} / 5</span></div>
    <input type="range" min="0" max="4" step="1" value="${level}" aria-label="Health and fitness familiarity" oninput="previewKnowledgeLevel(this.value)" onchange="setKnowledgeLevel(this.value)">
    <div class="knowledge-scale" aria-hidden="true"><span>More guidance</span><span>Cleaner app</span></div>
    <p class="hint" id="knowledge-level-detail">${info.detail}</p>
    ${!STATE.uiPrefs.knowledgeLevelTouched ? `<button class="btn btn-sm" onclick="confirmDefaultKnowledgeLevel()">Keep Complete Beginner</button>` : ''}
    <p class="hint">You can change this any time. Safety warnings and calculation limits always remain visible.</p>
  </div>`;
}

// ---------- Derived helpers shared across views ----------

function currentWeightKg() {
  const log = STATE.weightLog;
  if (log.length) return log[log.length - 1].weightKg;
  return STATE.profile.weightKg;
}

// The real, growing average from daily check-ins, replacing the old single
// self-reported number. Blends toward the actual logged average as check-ins
// build up; before you've logged much, it leans on the starting estimate from
// the Plan page so the app isn't left with no number at all on day one.
function getStepsAverage() {
  const dates = Object.keys(STATE.dailyCheckins).sort();
  const estimate = STATE.workoutPlan.stepsPerDay || 6000;
  if (!dates.length) return estimate;
  const recent = dates.slice(-30); // trailing 30 days, more weight to recent behavior
  const avg = recent.reduce((s, d) => s + (STATE.dailyCheckins[d].steps || 0), 0) / recent.length;
  if (recent.length >= 5) return Math.round(avg); // enough real data, trust it fully
  // early on, blend the few real check-ins with the estimate so one unusual day
  // doesn't swing the number wildly
  const weight = recent.length / 5;
  return Math.round(avg * weight + estimate * (1 - weight));
}

// Raw plan stats only (no activity-level dependency, to avoid circularity)
function weeklyPlanSummary() {
  const days = STATE.workoutPlan.days;
  const activeDays = days.filter(d => d.exercises.length > 0);
  const bw = currentWeightKg();
  let totalMinutes = 0;
  let totalKcal = 0;
  let aerobicMinutes = 0;
  let strengthDaysPerWeek = 0;
  activeDays.forEach(d => {
    let hasStrength = false;
    d.exercises.forEach(e => {
      const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId) || e.custom;
      if (!ex) return;
      let minutes = 0;
      if (ex.inputMode === 'duration' || ex.inputMode === 'distance') minutes = Number(e.durationMin) || 0;
      else minutes = estimateStrengthMinutesFromEntry(e);
      totalMinutes += minutes;
      if (ex.category === 'Strength') hasStrength = true;
      if (ex.category === 'Cardio' || ex.category === 'Sports') aerobicMinutes += minutes;
      totalKcal += calcExerciseCalories(e, bw);
    });
    if (hasStrength) strengthDaysPerWeek++;
  });
  return {
    workoutDaysPerWeek: activeDays.length,
    avgSessionMinutes: activeDays.length ? totalMinutes / activeDays.length : 0,
    totalWeeklyExerciseKcal: totalKcal,
    aerobicMinutes,
    strengthDaysPerWeek,
    stepsPerDay: getStepsAverage(),
  };
}

function getActivityLevel() {
  const s = weeklyPlanSummary();
  return autoDetectActivityLevel(s);
}

function getBMR() {
  return calcBMR(STATE.profile);
}

function getTDEE() {
  const bmr = getBMR();
  if (!bmr) return null;
  const lvl = getActivityLevel();
  return calcTDEE(bmr, lvl.multiplier);
}

// Steps walked above the baseline already assumed by the activity level, converted
// to a calorie bonus so ordinary daily walking isn't double counted.
function getStepBonus() {
  const lvl = getActivityLevel();
  // Use the same blended rolling average that drives activity detection. Using
  // the one-time plan estimate here made the displayed activity level and the
  // effective TDEE disagree after real check-ins had been logged.
  const stepsPerDay = getStepsAverage();
  const dailyKcal = calcBonusStepCalories(stepsPerDay, lvl.baselineSteps);
  return {
    baselineSteps: lvl.baselineSteps,
    stepsPerDay,
    extraSteps: Math.max(0, stepsPerDay - lvl.baselineSteps),
    dailyKcal,
    weeklyKcal: dailyKcal * 7,
  };
}

// TDEE plus the daily step bonus - this is the number used for goal/food-target math.
function getEffectiveTDEE() {
  const tdee = getTDEE();
  if (!tdee) return null;
  return tdee + getStepBonus().dailyKcal;
}

// Weekly exercise burn, contextualized against the person's goal direction (used
// by the hover tooltip on the weekly-burn stat).
function assessWeeklyBurnForGoal(weeklyKcal) {
  const band = getWeeklyIntensityFeedback(weeklyKcal);
  const g = STATE.goal;
  let goalNote = '';
  if (g.targetWeightKg != null && g.startWeightKg != null) {
    if (g.targetWeightKg < g.startWeightKg) {
      goalNote = ' Your goal is weight loss, so more structured exercise volume can help, alongside your food target.';
    } else if (g.targetWeightKg > g.startWeightKg) {
      goalNote = ' Your goal is weight gain, so this mostly supports strength/fitness; food intake drives the weight side more.';
    }
  }
  return { ...band, goalNote };
}

// How well recent logged workouts match the weekly plan (used on the Log page).
function getWorkoutComplianceCheck() {
  const plannedDays = STATE.workoutPlan.days.filter(d => d.exercises.length > 0).length;
  if (!plannedDays) return null;
  const today = new Date(todayISO());
  let loggedCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = dateToLocalISO(d);
    if ((STATE.workoutLog[iso] || []).some(hasCompletedWork)) loggedCount++;
  }
  const ratio = loggedCount / plannedDays;
  let status = 'good';
  let message = `You've logged ${loggedCount} of ${plannedDays} planned workout day(s) in the last 7 days. Good pace.`;
  if (ratio < 0.5) {
    status = 'way-behind';
    message = `Only ${loggedCount} of ${plannedDays} planned workout day(s) logged this week. That's a big gap from your plan, worth catching up, or adjusting the plan to match what's realistic right now.`;
  } else if (ratio < 0.85) {
    status = 'behind';
    message = `${loggedCount} of ${plannedDays} planned workout day(s) logged this week. A bit behind pace, still catchable.`;
  }
  return { status, message, loggedCount, plannedDays };
}

// How well recent logged food intake matches the calorie target (used on the Food page).
function getFoodComplianceCheck() {
  const target = getFoodTargetCalories();
  if (!target) return null;
  const today = new Date(todayISO());
  const days = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = dateToLocalISO(d);
    const entries = STATE.foodLog[iso];
    if (entries && entries.length) {
      days.push(entries.reduce((s, e) => s + e.kcal * e.qty, 0));
    }
  }
  if (days.length < 3) return null; // not enough history yet
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  const diffPct = ((avg - target) / target) * 100;
  let status = 'good';
  let message = `Your average logged intake over the last ${days.length} day(s) is ${Math.round(avg)} kcal, close to your ${Math.round(target)} kcal target.`;
  if (Math.abs(diffPct) > 25) {
    status = 'way-off';
    message = diffPct > 0
      ? `Averaging ${Math.round(avg)} kcal/day over ${days.length} logged days, about ${Math.round(diffPct)}% above your ${Math.round(target)} kcal target. That gap will slow or stall progress toward your goal date, worth tightening up portions or cutting back on extras.`
      : `Averaging ${Math.round(avg)} kcal/day over ${days.length} logged days, about ${Math.round(Math.abs(diffPct))}% below your ${Math.round(target)} kcal target. That's a large enough gap to be hard to sustain, double check you're logging everything (not under-logging).`;
  } else if (Math.abs(diffPct) > 10) {
    status = 'off';
    message = `Averaging ${Math.round(avg)} kcal/day over ${days.length} logged days vs a ${Math.round(target)} kcal target (${diffPct > 0 ? '+' : ''}${Math.round(diffPct)}%). Somewhat off pace, worth keeping an eye on.`;
  }
  return { status, message, avg, target, diffPct, sampleDays: days.length };
}

// ============================================================
// FOCUS-PRESERVING RENDER
// Every input that drives a live recalculation calls render() on
// input/change. Since render() rebuilds the DOM from scratch, a naive
// version would kick focus out of whatever field the person is typing
// in (especially painful on mobile, where the keyboard closes too).
// This wrapper remembers which field had focus (via data-focus-id) and
// restores focus + cursor position after the rebuild.
// ============================================================

function render() {
  clearTimeout(_renderSoonTimer);
  _renderSoonTimer = null;

  const active = document.activeElement;
  let focusMeta = null;
  if (active && active.dataset && active.dataset.focusId) {
    // Reading selectionStart/End throws on input types that don't support text
    // selection (number, date, etc.) in some browsers - this was unguarded before
    // and would silently abort the entire render before doRender() even ran,
    // which is why typing in those fields looked broken/disabled.
    let selStart = null, selEnd = null;
    try {
      if (typeof active.selectionStart === 'number') {
        selStart = active.selectionStart;
        selEnd = active.selectionEnd;
      }
    } catch (e) { /* selection not supported on this input type, that's fine */ }
    focusMeta = { id: active.dataset.focusId, selStart, selEnd };
  }

  try {
    doRender();
  } catch (e) {
    console.error('Render failed:', e);
    return;
  }

  if (focusMeta) {
    const el = document.querySelector('[data-focus-id="' + cssEscape(focusMeta.id) + '"]');
    if (el) {
      el.focus({ preventScroll: true });
      if (focusMeta.selStart != null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(focusMeta.selStart, focusMeta.selEnd); } catch (e) { /* not a text-selectable input */ }
      }
    }
  }
}

// Debounced render for continuous-typing fields (text/number inputs on 'oninput').
// Rebuilding the whole page on every keystroke is what made typing feel broken,
// especially as the page grew. STATE is still updated/persisted immediately (no
// data loss), only the DOM rebuild is deferred until a short pause in typing.
// Discrete interactions (select, checkbox, date via 'onchange', buttons) still
// call render() directly, they fire once per interaction, not once per keystroke.
let _renderSoonTimer = null;
function renderSoon(delay) {
  clearTimeout(_renderSoonTimer);
  _renderSoonTimer = setTimeout(() => { _renderSoonTimer = null; render(); }, delay || 450);
}

function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

// ============================================================
// SHELL / ROUTER
// ============================================================

const NAV_ITEMS = [
  { key: 'home', label: 'Home & BMR', num: '01' },
  { key: 'yourpage', label: 'Your Page', num: '02' },
  { key: 'workouts', label: 'Workout Plan', num: '03' },
  { key: 'log', label: 'Workout Log', num: '04' },
  { key: 'progress', label: 'Progress', num: '05' },
  { key: 'goals', label: 'Weight Goals', num: '06' },
  { key: 'food', label: 'Food Tracking', num: '07' },
  { key: 'bodyfat', label: 'Body Fat', num: '08' },
  { key: 'achievements', label: 'Achievements', num: '09' },
  { key: 'pet', label: 'Pet', num: '10' }, // hidden from the nav unless STATE.pet.enabled, see doRender()
  { key: 'themes', label: 'Themes', num: '11' },
];

function doRender() {
  applyTheme(STATE.theme);
  document.documentElement.setAttribute('data-knowledge-level', String(STATE.uiPrefs.knowledgeLevel || 0));
  const previousSidebar = document.querySelector('.sidebar');
  const previousSidebarScroll = previousSidebar ? previousSidebar.scrollLeft : 0;

  // Idempotent (already-granted rewards/achievements are skipped), so it's safe
  // to run this on every render rather than only when visiting Pet/Achievements,
  // that way points/unlocks land the moment they're earned no matter what page
  // you're on.
  if (STATE.pet.enabled) {
    updatePetHappinessDecay();
    evaluatePetDailyRewards().forEach(g => toast(`+${g.points} pts: ${g.label}`));
    if (typeof evaluateTravelArrivals === 'function') {
      evaluateTravelArrivals().forEach(s => toast(`${STATE.pet.name || 'Your pet'} arrived in ${s.name} with a ${travelTier(s.medalTier).label} medal${s.gotSouvenir ? ` and ${s.souvenir.name.toLowerCase()} souvenir ${s.souvenir.emoji}` : ''}!`));
    }
  }
  evaluateAchievements().forEach(a => toast(`Achievement unlocked: ${a.name} (+${a.points}${STATE.pet.enabled ? ' pet pts' : ' pts'})`));

  const app = document.getElementById('app');
  app.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="shell ${STATE.onboarding.active ? 'onboarding-active' : ''}">
      <div class="sidebar">
        <div class="brand tip" title="Version" style="border-bottom:none;">
          <span class="mark">FORGE</span><small>TRAINING LOG</small>
          <span class="tip-box"><span class="tip-title">Version</span>${APP_VERSION}. If this doesn't match what you expect after a deploy, do a hard refresh, or if installed as an app, close it fully and reopen (see the README for why a normal refresh alone can be one generation behind).</span>
        </div>
        ${NAV_ITEMS.filter(item => item.key !== 'pet' || STATE.pet.enabled).map(item => `
          <button class="nav-item ${UI.route === item.key ? 'active' : ''}" onclick="navigate('${item.key}')">
            <span class="num">${item.num}</span>${item.label}
          </button>
        `).join('')}
        <div class="sidebar-foot">
          Local-first. No Forge account. Transfer tools are in Themes.
        </div>
      </div>
      <main class="main" id="main-content" tabindex="-1"></main>
      ${typeof renderOnboardingGuide === 'function' ? renderOnboardingGuide() : ''}
      ${STATE.onboarding.active ? '' : renderPetWidget(UI.route)}
      ${typeof renderRestTimerWidget === 'function' ? renderRestTimerWidget() : ''}
    </div>
  `;
  const main = document.getElementById('main-content');
  if (UI.route === 'home') main.innerHTML = renderHome();
  else if (UI.route === 'yourpage') main.innerHTML = renderYourPage();
  else if (UI.route === 'workouts') main.innerHTML = renderWorkouts();
  else if (UI.route === 'log') main.innerHTML = renderLog();
  else if (UI.route === 'progress') main.innerHTML = renderProgress();
  else if (UI.route === 'goals') main.innerHTML = renderGoals();
  else if (UI.route === 'food') main.innerHTML = renderFood();
  else if (UI.route === 'bodyfat') main.innerHTML = renderBodyFat();
  else if (UI.route === 'achievements') main.innerHTML = renderAchievements();
  else if (UI.route === 'pet') main.innerHTML = STATE.pet.enabled ? renderPetTab() : renderHome();
  else if (UI.route === 'themes') main.innerHTML = renderThemes();
  else { UI.route = 'home'; main.innerHTML = renderHome(); }

  afterRenderHooks();
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.scrollLeft = previousSidebarScroll;
    requestAnimationFrame(() => {
      const active = sidebar.querySelector('.nav-item.active');
      if (!active) return;
      if (active.offsetLeft < sidebar.scrollLeft) sidebar.scrollLeft = active.offsetLeft - 12;
      else if (active.offsetLeft + active.offsetWidth > sidebar.scrollLeft + sidebar.clientWidth) {
        sidebar.scrollLeft = active.offsetLeft + active.offsetWidth - sidebar.clientWidth + 12;
      }
    });
  }
}

function navigate(route) {
  if (UI.barcodeScannerOpen && typeof stopBarcodeScan === 'function') {
    stopBarcodeScan();
    UI.barcodeScannerOpen = false;
  }
  if (UI.qrTransferMode === 'receive' && typeof stopQrReceiveScanner === 'function') stopQrReceiveScanner();
  UI.route = route;
  saveLastRoute(route);
  render();
}

function afterRenderHooks() {
  if (typeof applyPageModularity === 'function') applyPageModularity(UI.route);
  // Associate straightforward field labels with their first control. Existing
  // explicit ids/labels win; this covers the many generated forms without
  // requiring screen-reader users to infer unnamed number inputs.
  document.querySelectorAll('.field').forEach((field, index) => {
    const label = field.querySelector('label');
    const control = field.querySelector('input, select, textarea');
    if (!label || !control || label.htmlFor || control.getAttribute('aria-label')) return;
    if (!control.id) control.id = `forge-field-${UI.route}-${index}`;
    label.htmlFor = control.id;
  });
  if (UI.route === 'goals') drawGoalChart();
  if (UI.route === 'progress') { drawProgressChart(); drawStepsChart(); }
  if (UI.route === 'yourpage' && document.getElementById('steps-chart')) drawStepsChart();
  if ((UI.route === 'food' || UI.route === 'themes') && typeof loadZXing === 'function') {
    // Fire-and-forget: get the scanner library loaded in the background before
    // it's needed. iOS Safari requires getUserMedia to fire very close to the
    // user's tap, if there's a network/script-load delay in between (like
    // loading this library on first tap), it can silently decline to even show
    // the permission prompt. Preloading here means by the time someone actually
    // taps "Scan barcode," the library is already cached and ready.
    loadZXing().catch(() => { /* will retry properly when Scan is tapped */ });
  }
  if (STATE.onboarding.active) {
    requestAnimationFrame(() => {
      const focus = document.querySelector('.onboarding-focus');
      if (focus) focus.scrollIntoView({ behavior: 'smooth', block: window.matchMedia('(max-width: 600px)').matches ? 'start' : 'center' });
    });
  }
  if (UI.route === 'workouts' || UI.route === 'log') {
    const sel = document.getElementById('ex-select');
    if (sel) {
      sel.addEventListener('change', function () {
        const ex = EXERCISE_LIBRARY.find(x => x.id === this.value);
        const fields = document.getElementById('ex-input-fields');
        if (fields) fields.innerHTML = renderExerciseInputFields(ex);
      });
    }
  }
}

// ============================================================
// HOME VIEW - profile + BMR/TDEE
// ============================================================

function renderHome() {
  const p = STATE.profile;
  const bmr = getBMR();
  const lvl = getActivityLevel();
  const tdee = getTDEE();
  const stepBonus = getStepBonus();
  const summary = weeklyPlanSummary();
  const isImperial = p.unitSystem === 'imperial';
  const roundedHeightIn = p.heightCm ? Math.round(cmToIn(p.heightCm)) : null;

  const weightDisplay = p.weightKg
    ? (isImperial ? kgToLb(p.weightKg).toFixed(1) : p.weightKg)
    : '';

  return `
    <div class="page-head">
      <p class="page-eyebrow">Profile</p>
      <h1 class="page-title">Your numbers</h1>
      <p class="page-sub">Set your stats here, your activity level is automatically calculated from the Workout Plan page.</p>
    </div>

    ${renderStepCheckinSummary()}

    <div class="grid grid-2">
      <div class="card ${STATE.onboarding.active && STATE.onboarding.step === 1 ? 'onboarding-focus' : ''}">
        <div class="card-title">
          Basic info
          <div class="pill-toggle">
            <button class="${isImperial ? 'active' : ''}" onclick="setUnitSystem('imperial')">lb / ft</button>
            <button class="${!isImperial ? 'active' : ''}" onclick="setUnitSystem('metric')">kg / cm</button>
          </div>
        </div>
          <div class="field">
            <label for="profile-name">Name</label>
            <input id="profile-name" type="text" data-focus-id="profile-name" value="${escapeAttr(p.name)}" onchange="updateProfile('name', this.value)" onkeydown="if(event.key==='Enter') this.blur()" placeholder="Optional">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="profile-sex">Sex used by the BMR equation</label>
            <select id="profile-sex" data-focus-id="profile-sex" onchange="updateProfile('sex', this.value)">
              <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option>
              <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option>
            </select>
          </div>
          <div class="field">
            <label for="profile-age">Age (18+)</label>
            <input id="profile-age" type="number" data-focus-id="profile-age" min="18" max="100" value="${p.age ?? ''}" onchange="updateProfile('age', numOrNull(this.value))" onkeydown="if(event.key==='Enter') this.blur()">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Height ${isImperial ? '(ft / in)' : '(cm)'}</label>
            ${isImperial ? `
              <div class="field-row">
                <input aria-label="Height feet" type="number" data-focus-id="profile-height-ft" min="3" max="7" placeholder="ft" value="${roundedHeightIn != null ? Math.floor(roundedHeightIn / 12) : ''}" onchange="updateHeightImperial(this.value, null)" onkeydown="if(event.key==='Enter') this.blur()">
                <input aria-label="Height inches" type="number" data-focus-id="profile-height-in" min="0" max="11" placeholder="in" value="${roundedHeightIn != null ? roundedHeightIn % 12 : ''}" onchange="updateHeightImperial(null, this.value)" onkeydown="if(event.key==='Enter') this.blur()">
              </div>
            ` : `
              <input aria-label="Height in centimeters" type="number" data-focus-id="profile-height-cm" min="120" max="230" value="${p.heightCm ?? ''}" onchange="updateProfile('heightCm', numOrNull(this.value))" onkeydown="if(event.key==='Enter') this.blur()">
            `}
          </div>
          <div class="field">
            <label>Weight ${isImperial ? '(lb)' : '(kg)'}</label>
            <input aria-label="Weight in ${isImperial ? 'pounds' : 'kilograms'}" type="number" data-focus-id="profile-weight" min="1" step="0.1" value="${weightDisplay}" onchange="updateWeight(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
          </div>
        </div>
        <p class="hint">Weight updates here also log a new entry on the Weight Goals page.</p>
      </div>

      <div class="card">
        <div class="card-title">Metabolic estimate</div>
        ${bmr ? `
          <div class="grid grid-2" style="margin-bottom:16px;">
            <div class="stat">
              <div class="stat-label">BMR: resting burn</div>
              <div class="stat-value">${Math.round(bmr)}<span class="unit">kcal/day</span></div>
            </div>
            <div class="stat">
              <div class="stat-label">TDEE: total daily burn</div>
              <div class="stat-value accent">${Math.round(tdee)}<span class="unit">kcal/day</span></div>
            </div>
          </div>
          <hr class="div">
          <div class="stat" style="margin-bottom:10px;">
            <div class="stat-label">Auto-detected activity level</div>
            <div style="font-family:var(--font-display); font-size:18px; font-weight:600; margin-top:4px;">${lvl.label} <span style="color:var(--text-dim); font-family:var(--font-mono); font-size:12px; font-weight:400;">x${lvl.multiplier}</span></div>
            <div class="hint">${lvl.desc}</div>
          </div>
          <div class="hint">
            Based on your plan: <strong style="color:var(--text)">${summary.workoutDaysPerWeek}</strong> workout day(s)/week,
            avg <strong style="color:var(--text)">${Math.round(summary.avgSessionMinutes)}</strong> min/session,
            <strong style="color:var(--text)">${summary.stepsPerDay.toLocaleString()}</strong> steps/day.
          </div>
          ${stepBonus.extraSteps > 0 ? `
            <hr class="div">
            <div class="stat">
              <div class="stat-label">Bonus from extra steps</div>
              <div class="stat-value" style="font-size:18px;">+${Math.round(stepBonus.dailyKcal)}<span class="unit">kcal/day</span></div>
              <div class="hint">${stepBonus.stepsPerDay.toLocaleString()} steps/day vs a ${stepBonus.baselineSteps.toLocaleString()}-step baseline already built into ${lvl.label.toLowerCase()}. See the Workout Plan page for the full breakdown.</div>
            </div>
          ` : ''}
        ` : `
          <div class="empty-state">
            <div class="big">-</div>
            Fill in your age, height, and weight to calculate BMR and TDEE.
          </div>
        `}
        <p class="hint" style="margin-top:12px;">These estimates are designed for adults age 18 and older and are not intended for pregnancy, breastfeeding, or medical nutrition therapy. A clinician can help tailor targets when health conditions, medications, or eating-disorder history affect energy needs.</p>
      </div>
    </div>

    <div class="card">
      ${(() => {
        const breakdown = getEnergyBreakdown({ bmr, tdee, dailyExerciseKcal: summary.totalWeeklyExerciseKcal / 7 });
        if (!breakdown) return `<div class="card-title">Where your calories go</div><div class="empty-state">Fill in your profile above to see the breakdown.</div>`;
        const segs = [
          { key: 'bmr', label: 'BMR', color: 'var(--accent)', pct: breakdown.bmrPct, val: breakdown.bmr,
            title: 'BMR: Basal Metabolic Rate',
            body: 'Calories your body burns just existing: breathing, circulation, cell repair. This happens whether you move or not, and is usually the biggest single piece of your day.' },
          { key: 'neat', label: 'NEAT', color: 'var(--accent-2)', pct: breakdown.neatPct, val: breakdown.neat,
            title: 'NEAT: Non-Exercise Activity',
            body: 'Walking around, fidgeting, chores, standing up, taking the stairs: all the movement that is not a planned workout. This is often the most underestimated part of someone\u2019s day.' },
          { key: 'eat', label: 'EAT', color: '#7FD87A', pct: breakdown.eatPct, val: breakdown.eat,
            title: 'EAT: Exercise Activity',
            body: 'Calories burned specifically from the planned workouts in your log, an average of your weekly training spread across each day.' },
          { key: 'tef', label: 'TEF', color: '#F5C64C', pct: breakdown.tefPct, val: breakdown.tef,
            title: 'TEF: Thermic Effect of Food',
            body: 'Energy your body spends digesting and processing what you eat. Roughly 10% of intake for most diets; protein costs more to digest than fat or carbs.' },
        ];
        return `
          <div class="card-title">Where your calories go</div>
          <div class="energy-bar">
            ${segs.map(s => `<span class="energy-bar-seg" style="width:${Math.max(s.pct, 0.5)}%; background:${s.color};">${s.pct >= 6 ? Math.round(s.pct) + '%' : ''}</span>`).join('')}
          </div>
          <div class="energy-legend">
            ${segs.map(s => `
              <div class="energy-legend-item">
                <span class="energy-legend-dot" style="background:${s.color};"></span>
                ${tip(`<strong>${s.label}</strong> ${Math.round(s.val)} kcal`, s.title, s.body)}
              </div>
            `).join('')}
          </div>
          <p class="hint" style="margin-top:12px;">Tap or hover any label for what it means. BMR is typically 60-70% of total burn for most people; the rest comes from how much you move and eat.</p>
        `;
      })()}
    </div>

    ${renderKnowledgeLevelCard()}

    ${notice('home-movement-basics', `
      <strong>A useful starting target:</strong> current U.S. guidance recommends that adults work toward 150-300 minutes of moderate aerobic activity each week (or the vigorous equivalent), plus muscle-strengthening activity on at least 2 days. Start below that if needed and build gradually; some activity is better than none.
    `, { maxLevel: 3, defaultOpenThrough: 1, brief: '<strong>General target:</strong> work toward 150-300 weekly minutes of moderate aerobic activity plus strength work on at least 2 days; build gradually.' })}

    ${notice('home-why-activity', `
      Most calculators ask you to self-report "activity level," and people reliably overestimate it.
      This app instead reads your actual <a href="#" onclick="navigate('workouts'); return false;">workout plan</a>:
      how many days you train, how long sessions run, and your typical step count, and picks the closest activity
      multiplier for you. Build out your week on the Workout Plan page to sharpen this estimate.
    `, { maxLevel: 0, defaultOpenThrough: 0 })}
  `;
}

// Daily step check-in, replacing the old "just tell us your average" model.
// Logging an actual number each day feeds getStepsAverage() above, so the
// figure used for TDEE/activity level gets more accurate the more you use it,
// instead of staying wherever a one-time guess landed. The actual check-in
// input lives on the Workout Log page (that's the daily "what happened today"
// hub already), Home just shows a compact read-only summary with a link over.
function renderStepCheckinSummary() {
  const today = todayISO();
  const todayEntry = STATE.dailyCheckins[today];
  const ctx = buildGameContext();
  return `
    <div class="card compact-home-steps">
      <div class="card-title">Steps</div>
      <div class="compact-home-step-stats">
        <div class="stat">
          <div class="stat-label">Today</div>
          <div class="stat-value" style="font-size:20px;">${todayEntry ? todayEntry.steps.toLocaleString() : '\u2014'}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Rolling average</div>
          <div class="stat-value accent" style="font-size:20px;">${getStepsAverage().toLocaleString()}</div>
        </div>
      </div>
      <a class="compact-step-link" href="#" onclick="navigate('log'); return false;" aria-label="Open Workout Log">Log →</a>
    </div>
  `;
}

function renderStepCheckinCard(date) {
  date = date || todayISO();
  const isToday = date === todayISO();
  const entry = STATE.dailyCheckins[date];
  const ctx = buildGameContext();
  const collapsed = STATE.uiPrefs.stepCheckinCollapsed;
  const expert = (STATE.uiPrefs.knowledgeLevel || 0) >= 4;
  const stepSource = typeof formatStepSource === 'function' ? formatStepSource(entry) : '';
  return `
    <div class="card${collapsed ? ' panel-card-collapsed' : ''} ${STATE.onboarding.active && STATE.onboarding.step === 4 ? 'onboarding-focus' : ''}">
      <div class="card-title">
        <span>${isToday ? "Today's step check-in" : 'Step check-in'}</span>
        ${collapsed ? `<span class="panel-inline-summary">${entry ? `${Number(entry.steps).toLocaleString()} steps` : 'No steps logged'}</span>` : ''}
        <span class="panel-heading-actions">
          ${isToday && ctx.checkinStreak > 1 ? `<span class="badge badge-ok">${ctx.checkinStreak} day streak</span>` : ''}
          <button class="panel-collapse-btn" onclick="toggleRememberedPanel('stepCheckinCollapsed')" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand' : 'Minimize'} step check-in">${collapsed ? '+' : '−'}</button>
        </span>
      </div>
      ${collapsed ? '' : `
      <div class="field-row" style="align-items:end;">
        <div class="field" style="margin-bottom:0;">
          <label>${isToday ? 'Steps so far today' : 'Steps that day'}</label>
          <input type="number" data-focus-id="step-checkin" min="0" step="500" value="${entry ? entry.steps : ''}" placeholder="e.g. 8000" onchange="submitStepCheckin(this.value, '${date}')" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        ${entry ? `<div class="badge badge-ok" style="flex-shrink:0;">${stepSource ? `Imported · ${escapeAttr(stepSource)}` : 'Logged'}</div>` : ''}
        ${typeof renderHealthImportControl === 'function' ? renderHealthImportControl(date) : ''}
      </div>
      <p class="hint" style="margin-top:8px;">${expert ? `Rolling average: ${getStepsAverage().toLocaleString()}/day.` : `${isToday ? "Update it any time today, your latest number is what counts." : "Backfilling a missed day is fine, it still counts toward your average."} Your rolling average (currently ${getStepsAverage().toLocaleString()}/day) is what drives your activity level, not a one-time guess, so the more you check in, the more accurate it gets.`}</p>
      `}
    </div>
  `;
}

function toggleRememberedPanel(key) {
  if (!['stepCheckinCollapsed', 'restTimerPanelCollapsed', 'restTimerWidgetCollapsed', 'workoutComplianceCollapsed', 'foodGoalTimelineCollapsed', 'weeklyMovementCollapsed'].includes(key)) return;
  STATE.uiPrefs[key] = !STATE.uiPrefs[key];
  persist(); render();
}

function submitStepCheckin(value, date, source = 'manual') {
  date = date || todayISO();
  const steps = Math.max(0, Number(value) || 0);
  const safeSources = ['manual', 'apple-health', 'health-connect', 'samsung-health'];
  const safeSource = safeSources.includes(source) ? source : 'manual';
  STATE.dailyCheckins[date] = {
    steps,
    ...(safeSource === 'manual' ? {} : { source: safeSource, importedAt: new Date().toISOString() }),
  };
  persist();
  if (date === todayISO() && typeof markPetInteraction === 'function') markPetInteraction(3);
  const granted = (date === todayISO() && typeof evaluatePetDailyRewards === 'function') ? evaluatePetDailyRewards() : [];
  render();
  granted.forEach(g => toast(`+${g.points} pts: ${g.label}`));
}

// Guards against the native <input type="date"> quirk where typing a partial
// year (e.g. "2" on the way to "2026") can commit as something like
// "0002-01-15" if the field loses focus mid-entry, that's a browser-level
// behavior we can't fully control from here, but we can stop a nonsense date
// from silently corrupting logs/streaks/goal math. Returns true if the date
// looks sane enough to use.
function isReasonableDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return false;
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (year < 1900 || year > 2200) return false;
  const parsed = new Date(dateStr + 'T00:00:00');
  return !Number.isNaN(parsed.getTime()) && dateToLocalISO(parsed) === dateStr;
}

function cmToFeetInches(cm) {
  const roundedIn = Math.round(cmToIn(cm));
  const ft = Math.floor(roundedIn / 12);
  const inch = roundedIn % 12;
  return `${ft}'${inch}"`;
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Safe string literal for inline handlers that have not yet been migrated to
// addEventListener. JSON quoting handles apostrophes/backslashes; HTML escaping
// keeps the quoted literal inside the surrounding attribute.
function inlineArg(value) {
  return escapeAttr(JSON.stringify(String(value ?? '')));
}

// Small reusable prev/next arrows to sit next to any date input. shiftFnName is
// a global function that takes a signed integer (days to shift). Used anywhere
// a date field exists outside the Log page's bigger day-nav.
function renderDatePrevButton(shiftFnName) {
  return `<button class="date-nav-btn" onclick="${shiftFnName}(-1)" title="Previous day">\u2039</button>`;
}
function renderDateNextButton(shiftFnName) {
  return `<button class="date-nav-btn" onclick="${shiftFnName}(1)" title="Next day">\u203a</button>`;
}

function setUnitSystem(sys) {
  STATE.profile.unitSystem = sys;
  persist(); render();
}

function updateProfile(field, value) {
  if (field === 'age' && value != null && (value < 18 || value > 100)) {
    toast('Forge currently supports adult estimates for ages 18-100.');
    render();
    return;
  }
  if (field === 'heightCm' && value != null && (value < 120 || value > 230)) {
    toast('Enter a height between 120 and 230 cm.');
    render();
    return;
  }
  STATE.profile[field] = value;
  persist(); render();
}

function updateHeightImperial(ft, inch) {
  const p = STATE.profile;
  const curTotalIn = p.heightCm ? cmToIn(p.heightCm) : 0;
  const curFt = Math.floor(curTotalIn / 12);
  const curIn = Math.round(curTotalIn % 12);
  const newFt = ft !== null ? Number(ft) || 0 : curFt;
  const newIn = inch !== null ? Number(inch) || 0 : curIn;
  const heightCm = inToCm(newFt * 12 + newIn);
  if (heightCm < 120 || heightCm > 230 || newIn < 0 || newIn > 11) {
    toast('Enter a height between about 3 ft 11 in and 7 ft 7 in.');
    render();
    return;
  }
  p.heightCm = heightCm;
  persist(); render();
}

function updateWeight(value) {
  const n = numOrNull(value);
  const kg = STATE.profile.unitSystem === 'imperial' ? (n != null ? lbToKg(n) : null) : n;
  if (kg != null && (kg < 20 || kg > 400)) {
    toast(usesImperialUnits() ? 'Enter a weight between 44 and 882 lb.' : 'Enter a weight between 20 and 400 kg.');
    render();
    return;
  }
  STATE.profile.weightKg = kg;
  if (kg != null) {
    logWeightEntry(kg);
  }
  persist(); render();
}

function logWeightEntry(kg) {
  const today = todayISO();
  const log = STATE.weightLog;
  const existingIdx = log.findIndex(e => e.date === today);
  if (existingIdx >= 0) log[existingIdx].weightKg = kg;
  else log.push({ date: today, weightKg: kg });
  log.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Recent items (most-requested feature: quick re-add) ----------
// Exercises remember the last entry used (weight/reps/etc) so tapping a recent
// chip re-logs it exactly as before, not just the exercise name.
function recordRecentExercise(key, label, snapshot) {
  const list = STATE.recentExercises.filter(r => r.key !== key);
  list.unshift({ key, label, snapshot: cloneExerciseEntry(snapshot) });
  STATE.recentExercises = list.slice(0, 8);
}
function recordRecentFood(food) {
  const list = STATE.recentFoods.filter(r => !(r.name === food.name && r.kcal === food.kcal));
  list.unshift({ name: food.name, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat });
  STATE.recentFoods = list.slice(0, 10);
}
