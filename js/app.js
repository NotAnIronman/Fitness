/* ============================================================
   APP - state, router, shell, and Home (profile/BMR/TDEE) view
   ============================================================ */

let STATE = loadState();
let UI = {
  route: 'home',
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
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function persist() {
  saveState(STATE);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ---------- Tooltip component ----------
// Hover shows it on desktop for free (CSS :hover). Tap toggles it on mobile via
// the delegated click listener below, since touch devices have no hover state.
function tip(label, title, bodyHtml) {
  return `<span class="tip">${label}<span class="tip-box"><span class="tip-title">${escapeAttr(title)}</span>${bodyHtml}</span></span>`;
}

// Tooltips default to centering under their trigger, which can push them off
// the left/right edge of the screen for triggers near the edge (e.g. sidebar-
// adjacent cards, or mobile). This nudges an already-open tooltip back into
// the viewport instead of letting it get clipped.
function clampTipToViewport(tipEl) {
  const box = tipEl.querySelector('.tip-box');
  if (!box) return;
  box.style.transform = '';
  requestAnimationFrame(() => {
    const rect = box.getBoundingClientRect();
    const margin = 10;
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

// ---------- Dismissible / collapsible notice component ----------
// Used for one-time explanatory tips that would otherwise clutter the page.
// Collapses to a small pill; state persists per notice id.
function notice(id, bodyHtml) {
  const collapsed = STATE.uiPrefs.collapsedNotices.includes(id);
  if (collapsed) {
    return `<div class="notice-pill" onclick="toggleNotice('${id}')"><span class="plus">+</span> Show tip</div>`;
  }
  return `<div class="notice"><div class="notice-body">${bodyHtml}</div><button class="notice-collapse-btn" onclick="toggleNotice('${id}')" title="Collapse this tip">-</button></div>`;
}
function toggleNotice(id) {
  const list = STATE.uiPrefs.collapsedNotices;
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1); else list.push(id);
  persist(); render();
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
  activeDays.forEach(d => {
    d.exercises.forEach(e => {
      const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId) || e.custom;
      if (!ex) return;
      let minutes = 0;
      if (ex.inputMode === 'duration' || ex.inputMode === 'distance') minutes = Number(e.durationMin) || 0;
      else minutes = estimateStrengthMinutes(Number(e.sets), Number(e.reps));
      totalMinutes += minutes;
      totalKcal += calcExerciseCalories(e, bw);
    });
  });
  return {
    workoutDaysPerWeek: activeDays.length,
    avgSessionMinutes: activeDays.length ? totalMinutes / activeDays.length : 0,
    totalWeeklyExerciseKcal: totalKcal,
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
  const stepsPerDay = STATE.workoutPlan.stepsPerDay;
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
    const iso = d.toISOString().slice(0, 10);
    if (STATE.workoutLog[iso] && STATE.workoutLog[iso].length > 0) loggedCount++;
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
    const iso = d.toISOString().slice(0, 10);
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
  { key: 'workouts', label: 'Workout Plan', num: '02' },
  { key: 'log', label: 'Workout Log', num: '03' },
  { key: 'progress', label: 'Progress', num: '04' },
  { key: 'goals', label: 'Weight Goals', num: '05' },
  { key: 'food', label: 'Food Tracking', num: '06' },
  { key: 'bodyfat', label: 'Body Fat', num: '07' },
  { key: 'achievements', label: 'Achievements', num: '08' },
  { key: 'pet', label: 'Pet', num: '09' }, // hidden from the nav unless STATE.pet.enabled, see doRender()
  { key: 'themes', label: 'Themes', num: '10' },
];

function doRender() {
  applyTheme(STATE.theme);

  // Idempotent (already-granted rewards/achievements are skipped), so it's safe
  // to run this on every render rather than only when visiting Pet/Achievements,
  // that way points/unlocks land the moment they're earned no matter what page
  // you're on.
  if (STATE.pet.enabled) {
    updatePetHappinessForNewDay();
    evaluatePetDailyRewards().forEach(g => toast(`+${g.points} pts: ${g.label}`));
  }
  evaluateAchievements().forEach(a => toast(`Achievement unlocked: ${a.name} (+${a.points}${STATE.pet.enabled ? ' pet pts' : ' pts'})`));

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="shell">
      <div class="sidebar">
        <div class="brand"><span class="mark">FORGE</span><small>TRAINING LOG</small></div>
        ${NAV_ITEMS.filter(item => item.key !== 'pet' || STATE.pet.enabled).map(item => `
          <button class="nav-item ${UI.route === item.key ? 'active' : ''}" onclick="navigate('${item.key}')">
            <span class="num">${item.num}</span>${item.label}
          </button>
        `).join('')}
        <div class="sidebar-foot">
          Data saved locally in this browser only. No account, no sync yet.
        </div>
      </div>
      <div class="main" id="main-content"></div>
      ${renderPetWidget(UI.route)}
    </div>
  `;
  const main = document.getElementById('main-content');
  if (UI.route === 'home') main.innerHTML = renderHome();
  else if (UI.route === 'workouts') main.innerHTML = renderWorkouts();
  else if (UI.route === 'log') main.innerHTML = renderLog();
  else if (UI.route === 'progress') main.innerHTML = renderProgress();
  else if (UI.route === 'goals') main.innerHTML = renderGoals();
  else if (UI.route === 'food') main.innerHTML = renderFood();
  else if (UI.route === 'bodyfat') main.innerHTML = renderBodyFat();
  else if (UI.route === 'achievements') main.innerHTML = renderAchievements();
  else if (UI.route === 'pet') main.innerHTML = STATE.pet.enabled ? renderPetTab() : renderHome();
  else if (UI.route === 'themes') main.innerHTML = renderThemes();

  afterRenderHooks();
}

function navigate(route) {
  if (UI.barcodeScannerOpen && typeof stopBarcodeScan === 'function') {
    stopBarcodeScan();
    UI.barcodeScannerOpen = false;
  }
  UI.route = route;
  render();
}

function afterRenderHooks() {
  if (UI.route === 'goals') drawGoalChart();
  if (UI.route === 'progress') { drawProgressChart(); drawStepsChart(); }
  if (UI.route === 'food' && typeof loadZXing === 'function') {
    // Fire-and-forget: get the scanner library loaded in the background before
    // it's needed. iOS Safari requires getUserMedia to fire very close to the
    // user's tap, if there's a network/script-load delay in between (like
    // loading this library on first tap), it can silently decline to even show
    // the permission prompt. Preloading here means by the time someone actually
    // taps "Scan barcode," the library is already cached and ready.
    loadZXing().catch(() => { /* will retry properly when Scan is tapped */ });
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

  const weightDisplay = p.weightKg
    ? (isImperial ? kgToLb(p.weightKg).toFixed(1) : p.weightKg)
    : '';

  return `
    <div class="page-head">
      <p class="page-eyebrow">Profile</p>
      <h1 class="page-title">Your numbers</h1>
      <p class="page-sub">Set your stats once. Your activity level is inferred automatically from what you actually plan in the Workout Plan, not a guess you pick yourself.</p>
    </div>

    ${renderStepCheckinSummary()}

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">
          Basic info
          <div class="pill-toggle">
            <button class="${isImperial ? 'active' : ''}" onclick="setUnitSystem('imperial')">lb / ft</button>
            <button class="${!isImperial ? 'active' : ''}" onclick="setUnitSystem('metric')">kg / cm</button>
          </div>
        </div>
        <div class="field">
          <label>Name</label>
          <input type="text" data-focus-id="profile-name" value="${escapeAttr(p.name)}" onchange="updateProfile('name', this.value)" onkeydown="if(event.key==='Enter') this.blur()" placeholder="Optional">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Sex (for BMR formula)</label>
            <select data-focus-id="profile-sex" onchange="updateProfile('sex', this.value)">
              <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option>
              <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option>
            </select>
          </div>
          <div class="field">
            <label>Age</label>
            <input type="number" data-focus-id="profile-age" min="10" max="100" value="${p.age ?? ''}" onchange="updateProfile('age', numOrNull(this.value))" onkeydown="if(event.key==='Enter') this.blur()">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Height ${isImperial ? '(ft / in)' : '(cm)'}</label>
            ${isImperial ? `
              <div class="field-row">
                <input type="number" data-focus-id="profile-height-ft" min="1" max="8" placeholder="ft" value="${p.heightCm ? Math.floor(cmToIn(p.heightCm) / 12) : ''}" onchange="updateHeightImperial(this.value, null)" onkeydown="if(event.key==='Enter') this.blur()">
                <input type="number" data-focus-id="profile-height-in" min="0" max="11" placeholder="in" value="${p.heightCm ? Math.round(cmToIn(p.heightCm) % 12) : ''}" onchange="updateHeightImperial(null, this.value)" onkeydown="if(event.key==='Enter') this.blur()">
              </div>
            ` : `
              <input type="number" data-focus-id="profile-height-cm" min="100" max="230" value="${p.heightCm ?? ''}" onchange="updateProfile('heightCm', numOrNull(this.value))" onkeydown="if(event.key==='Enter') this.blur()">
            `}
          </div>
          <div class="field">
            <label>Weight ${isImperial ? '(lb)' : '(kg)'}</label>
            <input type="number" data-focus-id="profile-weight" step="0.1" value="${weightDisplay}" onchange="updateWeight(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
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

    ${notice('home-why-activity', `
      Most calculators ask you to self-report "activity level," and people reliably overestimate it.
      This app instead reads your actual <a href="#" onclick="navigate('workouts'); return false;">workout plan</a>:
      how many days you train, how long sessions run, and your typical step count, and picks the closest activity
      multiplier for you. Build out your week on the Workout Plan page to sharpen this estimate.
    `)}
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
    <div class="card">
      <div class="card-title">
        Steps
        ${ctx.checkinStreak > 1 ? `<span class="badge badge-ok">${ctx.checkinStreak} day streak</span>` : ''}
      </div>
      <div class="grid grid-2">
        <div class="stat">
          <div class="stat-label">Today</div>
          <div class="stat-value" style="font-size:20px;">${todayEntry ? todayEntry.steps.toLocaleString() : '\u2014'}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Rolling average</div>
          <div class="stat-value accent" style="font-size:20px;">${getStepsAverage().toLocaleString()}</div>
        </div>
      </div>
      <p class="hint" style="margin-top:8px;">${todayEntry ? "Update today's number" : "Check in today's steps"} on the <a href="#" onclick="navigate('log'); return false;">Workout Log</a> page. Your rolling average is what drives your activity level here, not a one-time guess.</p>
    </div>
  `;
}

function renderStepCheckinCard(date) {
  date = date || todayISO();
  const isToday = date === todayISO();
  const entry = STATE.dailyCheckins[date];
  const ctx = buildGameContext();
  return `
    <div class="card">
      <div class="card-title">
        ${isToday ? "Today's step check-in" : 'Step check-in'}
        ${isToday && ctx.checkinStreak > 1 ? `<span class="badge badge-ok">${ctx.checkinStreak} day streak</span>` : ''}
      </div>
      <div class="field-row" style="align-items:end;">
        <div class="field" style="margin-bottom:0;">
          <label>${isToday ? 'Steps so far today' : 'Steps that day'}</label>
          <input type="number" data-focus-id="step-checkin" min="0" step="500" value="${entry ? entry.steps : ''}" placeholder="e.g. 8000" onchange="submitStepCheckin(this.value, '${date}')" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        ${entry ? `<div class="badge badge-ok" style="flex-shrink:0;">Logged</div>` : ''}
      </div>
      <p class="hint" style="margin-top:8px;">${isToday ? "Update it any time today, your latest number is what counts." : "Backfilling a missed day is fine, it still counts toward your average."} Your rolling average (currently ${getStepsAverage().toLocaleString()}/day) is what drives your activity level, not a one-time guess, so the more you check in, the more accurate it gets.</p>
    </div>
  `;
}

function submitStepCheckin(value, date) {
  date = date || todayISO();
  const steps = Math.max(0, Number(value) || 0);
  STATE.dailyCheckins[date] = { steps };
  persist();
  const granted = (date === todayISO() && typeof evaluatePetDailyRewards === 'function') ? evaluatePetDailyRewards() : [];
  render();
  granted.forEach(g => toast(`+${g.points} pts: ${g.label}`));
}

function cmToFeetInches(cm) {
  const totalIn = cmToIn(cm);
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return `${ft}'${inch}"`;
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function escapeAttr(s) {
  return (s || '').replace(/"/g, '&quot;');
}

// Small reusable prev/next arrows to sit next to any date input. shiftFnName is
// a global function that takes a signed integer (days to shift). Used anywhere
// a date field exists outside the Log page's bigger day-nav.
function renderDatePrevButton(shiftFnName) {
  return `<button class="day-nav-btn" style="width:34px; height:34px; flex-shrink:0;" onclick="${shiftFnName}(-1)" title="Previous day">\u2039</button>`;
}
function renderDateNextButton(shiftFnName) {
  return `<button class="day-nav-btn" style="width:34px; height:34px; flex-shrink:0;" onclick="${shiftFnName}(1)" title="Next day">\u203a</button>`;
}

function setUnitSystem(sys) {
  STATE.profile.unitSystem = sys;
  persist(); render();
}

function updateProfile(field, value) {
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
  p.heightCm = inToCm(newFt * 12 + newIn);
  persist(); render();
}

function updateWeight(value) {
  const n = numOrNull(value);
  const kg = STATE.profile.unitSystem === 'imperial' ? (n != null ? lbToKg(n) : null) : n;
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
  list.unshift({ key, label, snapshot });
  STATE.recentExercises = list.slice(0, 8);
}
function recordRecentFood(food) {
  const list = STATE.recentFoods.filter(r => !(r.name === food.name && r.kcal === food.kcal));
  list.unshift({ name: food.name, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat });
  STATE.recentFoods = list.slice(0, 10);
}
