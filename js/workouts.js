/* ============================================================
   WORKOUT PLAN VIEW (weekly template)
   ============================================================ */

function renderWorkouts() {
  const days = STATE.workoutPlan.days;
  if (!UI.workoutDayId && days.length) UI.workoutDayId = days[0].id;
  const activeDay = days.find(d => d.id === UI.workoutDayId);
  const bw = currentWeightKg();
  const summary = weeklyPlanSummary();
  const lvl = getActivityLevel();
  const stepBonus = getStepBonus();
  const weeklyAssessment = assessWeeklyBurnForGoal(summary.totalWeeklyExerciseKcal);

  return `
    <div class="page-head">
      <p class="page-eyebrow">Plan</p>
      <h1 class="page-title">Workout plan</h1>
      <p class="page-sub">This is your reusable weekly template. Group exercises into training days here, then use the Workout Log to check off what you actually did on specific dates.</p>
    </div>

    ${!bw ? `<div class="section-note">Set your weight on the Home page first. Calorie estimates need it.</div>` : ''}

    <div class="grid grid-3" style="margin-bottom:16px;">
      <div class="card"><div class="stat"><div class="stat-label">Training days / week</div><div class="stat-value">${summary.workoutDaysPerWeek}</div></div></div>
      <div class="card">
        <div class="stat">
          <div class="stat-label">Weekly exercise burn</div>
          <div class="stat-value accent">
            ${tip(`${Math.round(summary.totalWeeklyExerciseKcal)}<span class="unit">kcal</span>`, `${weeklyAssessment.label} for the week`, `${weeklyAssessment.note}${weeklyAssessment.goalNote}`)}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="stat-label">Avg. daily steps</div>
        <input type="number" data-focus-id="steps-per-day" step="500" value="${STATE.workoutPlan.stepsPerDay}" oninput="updateSteps(this.value)" style="margin-top:6px;">
      </div>
    </div>

    ${summary.workoutDaysPerWeek > 0 ? `
      <div class="card">
        <div class="card-title">
          Weekly volume check
          ${tip(`<span class="badge ${weeklyAssessment.tier === 1 ? 'badge-warn' : 'badge-ok'}">${weeklyAssessment.label}</span>`, 'What this means', weeklyAssessment.note + weeklyAssessment.goalNote)}
        </div>
        <p class="hint">${summary.workoutDaysPerWeek} day(s)/week, ${Math.round(summary.totalWeeklyExerciseKcal)} kcal total. Tap the badge for details.</p>
      </div>
    ` : ''}

    <div class="card">
      <div class="card-title">
        Steps: baseline vs. bonus
        ${tip('ⓘ', 'Why steps are split this way', `Your activity level already assumes a baseline step count is happening every day, that's part of what sets your TDEE multiplier. Counting all your steps again on top of that would double count. Only steps above the baseline convert to a bonus.`)}
      </div>
      <div class="grid grid-3">
        <div class="stat"><div class="stat-label">Your avg steps/day</div><div class="stat-value" style="font-size:20px;">${stepBonus.stepsPerDay.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">Baseline for ${lvl.label.toLowerCase()}</div><div class="stat-value" style="font-size:20px;">${stepBonus.baselineSteps.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">Bonus burn</div><div class="stat-value accent" style="font-size:20px;">+${Math.round(stepBonus.dailyKcal)}<span class="unit">kcal/day</span></div></div>
      </div>
    </div>

    ${notice('cardio-step-overlap-general', `Logging running or walking as a workout below can overlap with the step count above. If a walk/run is already part of your normal daily steps, log it in one place only.`)}

    <div class="day-tabs">
      ${days.map(d => `
        <button class="day-tab ${d.id === UI.workoutDayId ? 'active' : ''}" onclick="selectDay('${d.id}')">${escapeAttr(d.name)}</button>
      `).join('')}
      <button class="day-tab" onclick="addDay()">+ Add day</button>
    </div>

    ${activeDay ? renderDayCard(activeDay, bw) : `
      <div class="card"><div class="empty-state"><div class="big">+</div>Add a training day to start building your plan.</div></div>
    `}
  `;
}

function renderDayCard(day, bw) {
  let dayKcal = 0;
  const rows = day.exercises.map(e => {
    const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId) || e.custom;
    const kcal = calcExerciseCalories(e, bw);
    dayKcal += kcal;
    let meta;
    if (ex.inputMode === 'setsRepsWeight') {
      const load = effectiveLoadKg(e);
      const loadLb = Math.round(kgToLb(load));
      meta = `${e.sets}x${e.reps} @ ${loadLb ? loadLb + ' lb total' : 'bodyweight'}${e.weightIsPerSide ? ' (per side x2)' : ''}`;
    } else if (ex.inputMode === 'setsReps') {
      meta = `${e.sets}x${e.reps}`;
    } else {
      meta = `${e.durationMin} min${ex.category === 'Strength' && ex.restAdjust && ex.restAdjust < 1 ? ` (~${Math.round(ex.restAdjust * 100)}% counted as active)` : ''}`;
    }
    return `
      <div class="exercise-row">
        <div>
          <div class="name">${escapeAttr(ex.name)}</div>
          <div class="meta">${meta} . ${ex.bodyPart || ex.category || 'Custom'}</div>
        </div>
        <div class="kcal">${Math.round(kcal)} kcal</div>
        <button class="icon-btn" onclick="removeExercise('${day.id}','${e.id}')" title="Remove">x</button>
      </div>
    `;
  }).join('');

  const sessionFeedback = day.exercises.length ? getSessionIntensityFeedback(dayKcal) : null;
  const nextTier = sessionFeedback ? getNextTierGap(dayKcal, EXERCISE_INTENSITY_BANDS.session) : null;

  return `
    <div class="card">
      <div class="card-title">
        <span>
          <input type="text" data-focus-id="day-name-${day.id}" value="${escapeAttr(day.name)}" oninput="renameDay('${day.id}', this.value)"
            style="background:transparent;border:none;font-family:var(--font-display);font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:0.02em;color:var(--text-dim);padding:0;width:auto;">
        </span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" onclick="openCopyDayMenu('${day.id}')">Copy from...</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDay('${day.id}')">Delete</button>
        </div>
      </div>

      ${UI.copyDayOpenFor === day.id ? renderCopyDayMenu(day) : ''}

      ${day.exercises.length ? `<div class="row-list">${rows}</div>` : `<div class="empty-state">No exercises yet.</div>`}

      <hr class="div">
      <div class="grid grid-2" style="align-items:end; margin-bottom:14px;">
        <div class="stat">
          <div class="stat-label">Estimated day total</div>
          <div class="stat-value accent">${Math.round(dayKcal)}<span class="unit">kcal</span></div>
        </div>
        ${sessionFeedback ? `
          <div class="stat">
            <div class="stat-label">Session feedback</div>
            <div style="font-size:13.5px; margin-top:4px;">
              ${tip(`<span class="badge badge-ok">${sessionFeedback.label}</span>`, sessionFeedback.label, `${sessionFeedback.note}${nextTier ? ` Add about ${nextTier.gapKcal} more kcal of work to reach "${nextTier.nextLabel}."` : ' This is the top band already.'}`)}
            </div>
          </div>
        ` : ''}
      </div>

      ${UI.addExerciseOpenFor === day.id ? renderAddExerciseForm(day, 'workout') : `
        <button class="btn btn-primary" onclick="openAddExercise('${day.id}')">+ Add exercise</button>
      `}
    </div>
  `;
}

function renderCopyDayMenu(day) {
  const otherDays = STATE.workoutPlan.days.filter(d => d.id !== day.id && d.exercises.length > 0);
  if (!otherDays.length) {
    return `<div class="section-note">No other days with exercises to copy from yet.</div>`;
  }
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:12px; margin-bottom:14px;">
      <p class="hint" style="margin-bottom:8px;">Copy all exercises from:</p>
      <div class="chip-row">
        ${otherDays.map(d => `<button class="chip" onclick="copyDayInto('${d.id}', '${day.id}')">${escapeAttr(d.name)}</button>`).join('')}
        <button class="chip" onclick="closeCopyDayMenu()">Cancel</button>
      </div>
    </div>
  `;
}

function renderAddExerciseForm(day, mode) {
  // mode: 'workout' (template day) or 'log' (dated log entry) - both share this UI,
  // log.js supplies its own submit handlers via the same field ids.
  const filtered = EXERCISE_LIBRARY.filter(e => e.bodyPart === UI.addExerciseCategory);

  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:6px;">
      <p class="hint" style="margin-bottom:8px;">Filter by body part:</p>
      <div class="chip-row" style="margin-bottom:12px;">
        ${BODY_PARTS.map(c => `<button class="chip ${UI.addExerciseCategory === c ? 'active' : ''}" onclick="setExerciseCategory('${c}')">${c}</button>`).join('')}
        <button class="chip ${UI.addExerciseCategory === 'Custom' ? 'active' : ''}" onclick="setExerciseCategory('Custom')">Custom</button>
      </div>

      ${UI.addExerciseCategory === 'Cardio' ? `
        <div class="section-note">Running and walking overlap with your daily step count. If this session is already reflected in your average steps/day, log it in one place only.</div>
      ` : ''}

      ${UI.addExerciseCategory === 'Custom' ? renderCustomExerciseForm(day, mode) : `
        <div class="field">
          <label>Exercise</label>
          <select id="ex-select" data-focus-id="ex-select">
            ${filtered.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
          </select>
        </div>
        <div id="ex-input-fields">${renderExerciseInputFields(filtered[0])}</div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-primary" onclick="${mode === 'log' ? `submitAddExerciseLog()` : `submitAddExercise('${day.id}')`}">Add</button>
          <button class="btn btn-ghost" onclick="${mode === 'log' ? `closeAddExerciseLog()` : `closeAddExercise()`}">Cancel</button>
        </div>
      `}
    </div>
  `;
}

function renderExerciseInputFields(ex) {
  if (!ex) return '';
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    const restNote = ex.category === 'Strength' && ex.restAdjust && ex.restAdjust < 1
      ? `<p class="hint">Heads up: gym-session time is mostly rest between sets. We count about ${Math.round(ex.restAdjust * 100)}% of this as active effort so the estimate isn't inflated. For a more accurate number, log individual exercises with sets/reps/weight instead.</p>`
      : '';
    return `
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" id="f-duration" data-focus-id="f-duration" min="1" value="30">
      </div>
      ${restNote}
    `;
  }
  if (ex.inputMode === 'setsRepsWeight') {
    return `
      <div class="field-row">
        <div class="field"><label>Sets</label><input type="number" id="f-sets" data-focus-id="f-sets" min="1" value="3"></div>
        <div class="field"><label>Reps</label><input type="number" id="f-reps" data-focus-id="f-reps" min="1" value="10"></div>
        <div class="field"><label>Weight (lb)</label><input type="number" id="f-weight" data-focus-id="f-weight" min="0" value="45"></div>
      </div>
      <div class="field">
        <label>Weight is</label>
        <div class="pill-toggle">
          <button type="button" id="f-weight-total-btn" class="active" onclick="setWeightMode(false)">Total (both sides)</button>
          <button type="button" id="f-weight-perside-btn" onclick="setWeightMode(true)">Per arm / per side</button>
        </div>
        <p class="hint">Defaults to total combined weight (e.g. 90 lb loaded on a barbell). Switch this if you entered a single dumbbell or one-side number instead.</p>
      </div>
    `;
  }
  // setsReps (bodyweight)
  return `
    <div class="field-row">
      <div class="field"><label>Sets</label><input type="number" id="f-sets" data-focus-id="f-sets" min="1" value="3"></div>
      <div class="field"><label>Reps</label><input type="number" id="f-reps" data-focus-id="f-reps" min="1" value="10"></div>
    </div>
  `;
}

let _weightIsPerSide = false;
function setWeightMode(perSide) {
  _weightIsPerSide = perSide;
  const totalBtn = document.getElementById('f-weight-total-btn');
  const sideBtn = document.getElementById('f-weight-perside-btn');
  if (totalBtn && sideBtn) {
    totalBtn.classList.toggle('active', !perSide);
    sideBtn.classList.toggle('active', perSide);
  }
}

function renderCustomExerciseForm(day, mode) {
  return `
    <div class="field">
      <label>Exercise name</label>
      <input type="text" id="c-name" data-focus-id="c-name" placeholder="e.g. Kettlebell flow">
    </div>
    <div class="field-row">
      <div class="field">
        <label>MET value (intensity)</label>
        <input type="number" id="c-met" data-focus-id="c-met" step="0.1" value="6.0">
      </div>
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" id="c-duration" data-focus-id="c-duration" min="1" value="30">
      </div>
    </div>
    <p class="hint">Not sure of MET value? 3 = light, 6 = moderate, 9 = vigorous, 12+ = very intense. <a href="https://sites.google.com/site/compendiumofphysicalactivities/" target="_blank" rel="noopener">Reference chart</a></p>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button class="btn btn-primary" onclick="${mode === 'log' ? `submitAddCustomExerciseLog()` : `submitAddCustomExercise('${day.id}')`}">Add</button>
      <button class="btn btn-ghost" onclick="${mode === 'log' ? `closeAddExerciseLog()` : `closeAddExercise()`}">Cancel</button>
    </div>
  `;
}

// ---------- Actions ----------

function addDay() {
  const day = { id: uid(), name: `Day ${STATE.workoutPlan.days.length + 1}`, exercises: [] };
  STATE.workoutPlan.days.push(day);
  UI.workoutDayId = day.id;
  persist(); render();
}

function selectDay(id) {
  UI.workoutDayId = id;
  UI.addExerciseOpenFor = null;
  UI.copyDayOpenFor = null;
  render();
}

function renameDay(id, name) {
  const d = STATE.workoutPlan.days.find(x => x.id === id);
  if (d) d.name = name;
  persist();
  render(); // reflect the new name in the day-tab pill immediately (focus is preserved)
}

function deleteDay(id) {
  STATE.workoutPlan.days = STATE.workoutPlan.days.filter(d => d.id !== id);
  if (UI.workoutDayId === id) UI.workoutDayId = STATE.workoutPlan.days[0]?.id || null;
  persist(); render();
}

function updateSteps(val) {
  STATE.workoutPlan.stepsPerDay = Number(val) || 0;
  persist(); render();
}

function openAddExercise(dayId) {
  UI.addExerciseOpenFor = dayId;
  UI.addExerciseCategory = 'Chest';
  _weightIsPerSide = false;
  render();
}
function closeAddExercise() {
  UI.addExerciseOpenFor = null;
  render();
}
function setExerciseCategory(cat) {
  UI.addExerciseCategory = cat;
  _weightIsPerSide = false;
  render();
}

function removeExercise(dayId, exId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  if (day) day.exercises = day.exercises.filter(e => e.id !== exId);
  persist(); render();
}

function submitAddExercise(dayId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  const entry = buildExerciseEntryFromForm();
  if (!entry) return;
  day.exercises.push(entry);
  UI.addExerciseOpenFor = null;
  persist(); render();
}

function submitAddCustomExercise(dayId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  const entry = buildCustomExerciseEntryFromForm();
  day.exercises.push(entry);
  UI.addExerciseOpenFor = null;
  persist(); render();
}

// Shared by both the Plan and Log add-exercise forms.
function buildExerciseEntryFromForm() {
  const selectEl = document.getElementById('ex-select');
  const ex = EXERCISE_LIBRARY.find(x => x.id === selectEl.value);
  const entry = { id: uid(), exerciseId: ex.id };
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    entry.durationMin = Number(document.getElementById('f-duration').value) || 0;
  } else if (ex.inputMode === 'setsRepsWeight') {
    entry.sets = Number(document.getElementById('f-sets').value) || 0;
    entry.reps = Number(document.getElementById('f-reps').value) || 0;
    entry.weightKg = lbToKg(Number(document.getElementById('f-weight').value) || 0);
    entry.weightIsPerSide = _weightIsPerSide;
  } else {
    entry.sets = Number(document.getElementById('f-sets').value) || 0;
    entry.reps = Number(document.getElementById('f-reps').value) || 0;
  }
  return entry;
}
function buildCustomExerciseEntryFromForm() {
  const name = document.getElementById('c-name').value.trim() || 'Custom exercise';
  const met = Number(document.getElementById('c-met').value) || 5;
  const duration = Number(document.getElementById('c-duration').value) || 30;
  return {
    id: uid(),
    exerciseId: null,
    custom: { name, met, inputMode: 'duration', category: 'Custom' },
    durationMin: duration,
  };
}

// ---------- Copy day ----------
function openCopyDayMenu(dayId) {
  UI.copyDayOpenFor = dayId;
  UI.addExerciseOpenFor = null;
  render();
}
function closeCopyDayMenu() {
  UI.copyDayOpenFor = null;
  render();
}
function copyDayInto(sourceDayId, targetDayId) {
  const source = STATE.workoutPlan.days.find(d => d.id === sourceDayId);
  const target = STATE.workoutPlan.days.find(d => d.id === targetDayId);
  if (!source || !target) return;
  const copied = source.exercises.map(e => ({ ...e, id: uid() }));
  target.exercises = target.exercises.concat(copied);
  UI.copyDayOpenFor = null;
  persist(); render();
  toast(`Copied ${copied.length} exercise(s) from ${source.name}`);
}
