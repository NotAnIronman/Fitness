/* ============================================================
   APP - state, router, shell, and Home (profile/BMR/TDEE) view
   ============================================================ */

let STATE = loadState();
let UI = {
  route: 'home',
  workoutDayId: null,
  addExerciseOpenFor: null,
  addExerciseCategory: 'Cardio',
  foodDate: todayISO(),
  foodQuery: '',
  foodResults: [],
  foodSearchLoading: false,
  showCustomFood: false,
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

// ---------- Derived helpers shared across views ----------

function currentWeightKg() {
  const log = STATE.weightLog;
  if (log.length) return log[log.length - 1].weightKg;
  return STATE.profile.weightKg;
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
    stepsPerDay: STATE.workoutPlan.stepsPerDay,
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
  const active = document.activeElement;
  let focusMeta = null;
  if (active && active.dataset && active.dataset.focusId) {
    focusMeta = {
      id: active.dataset.focusId,
      selStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    };
  }

  doRender();

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

function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

// ============================================================
// SHELL / ROUTER
// ============================================================

const NAV_ITEMS = [
  { key: 'home', label: 'Home & BMR', num: '01' },
  { key: 'workouts', label: 'Workout Planner', num: '02' },
  { key: 'goals', label: 'Weight Goals', num: '03' },
  { key: 'food', label: 'Food Tracking', num: '04' },
  { key: 'themes', label: 'Themes', num: '05' },
];

function doRender() {
  applyTheme(STATE.theme);
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="shell">
      <div class="sidebar">
        <div class="brand"><span class="mark">FORGE</span><small>TRAINING LOG</small></div>
        ${NAV_ITEMS.map(item => `
          <button class="nav-item ${UI.route === item.key ? 'active' : ''}" onclick="navigate('${item.key}')">
            <span class="num">${item.num}</span>${item.label}
          </button>
        `).join('')}
        <div class="sidebar-foot">
          Data saved locally in this browser only. No account, no sync yet.
        </div>
      </div>
      <div class="main" id="main-content"></div>
    </div>
  `;
  const main = document.getElementById('main-content');
  if (UI.route === 'home') main.innerHTML = renderHome();
  else if (UI.route === 'workouts') main.innerHTML = renderWorkouts();
  else if (UI.route === 'goals') main.innerHTML = renderGoals();
  else if (UI.route === 'food') main.innerHTML = renderFood();
  else if (UI.route === 'themes') main.innerHTML = renderThemes();

  afterRenderHooks();
}

function navigate(route) {
  UI.route = route;
  render();
}

function afterRenderHooks() {
  if (UI.route === 'goals') drawGoalChart();
  if (UI.route === 'workouts') {
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
      <p class="page-sub">Set your stats once. Your activity level is inferred automatically from what you actually plan in the Workout Planner, not a guess you pick yourself.</p>
    </div>

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
          <input type="text" data-focus-id="profile-name" value="${escapeAttr(p.name)}" oninput="updateProfile('name', this.value)" placeholder="Optional">
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
            <input type="number" data-focus-id="profile-age" min="10" max="100" value="${p.age ?? ''}" oninput="updateProfile('age', numOrNull(this.value))">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Height ${isImperial ? '(ft / in)' : '(cm)'}</label>
            ${isImperial ? `
              <div class="field-row">
                <input type="number" data-focus-id="profile-height-ft" min="1" max="8" placeholder="ft" value="${p.heightCm ? Math.floor(cmToIn(p.heightCm) / 12) : ''}" oninput="updateHeightImperial(this.value, null)">
                <input type="number" data-focus-id="profile-height-in" min="0" max="11" placeholder="in" value="${p.heightCm ? Math.round(cmToIn(p.heightCm) % 12) : ''}" oninput="updateHeightImperial(null, this.value)">
              </div>
            ` : `
              <input type="number" data-focus-id="profile-height-cm" min="100" max="230" value="${p.heightCm ?? ''}" oninput="updateProfile('heightCm', numOrNull(this.value))">
            `}
          </div>
          <div class="field">
            <label>Weight ${isImperial ? '(lb)' : '(kg)'}</label>
            <input type="number" data-focus-id="profile-weight" step="0.1" value="${weightDisplay}" oninput="updateWeight(this.value)">
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
              <div class="hint">${stepBonus.stepsPerDay.toLocaleString()} steps/day vs a ${stepBonus.baselineSteps.toLocaleString()}-step baseline already built into ${lvl.label.toLowerCase()}. See the Workout Planner page for the full breakdown.</div>
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
      <div class="card-title">Why this number matters</div>
      <p class="hint" style="font-size:13px; line-height:1.6;">
        Most calculators ask you to self-report "activity level," and people reliably overestimate it.
        This app instead reads your actual <a href="#" onclick="navigate('workouts'); return false;">workout plan</a>:
        how many days you train, how long sessions run, and your typical step count, and picks the closest activity
        multiplier for you. Build out your week on the Workout Planner page to sharpen this estimate.
      </p>
    </div>
  `;
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
