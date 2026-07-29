/* ============================================================
   WORKOUT PLANNER VIEW
   ============================================================ */

function renderWorkouts() {
  const days = STATE.workoutPlan.days;
  if (!UI.workoutDayId && days.length) UI.workoutDayId = days[0].id;
  const activeDay = days.find(d => d.id === UI.workoutDayId);
  const bw = currentWeightKg();
  const summary = weeklyPlanSummary();

  return `
    <div class="page-head">
      <p class="page-eyebrow">Planner</p>
      <h1 class="page-title">Workout plan</h1>
      <p class="page-sub">Group exercises into training days. Each exercise's calorie burn is estimated from a MET-based formula scaled to your current bodyweight${bw ? ` (${Math.round(kgToLb(bw))} lb)` : ''}.</p>
    </div>

    ${!bw ? `<div class="section-note">Set your weight on the Home page first — calorie estimates need it.</div>` : ''}

    <div class="grid grid-3" style="margin-bottom:16px;">
      <div class="card"><div class="stat"><div class="stat-label">Training days / week</div><div class="stat-value">${summary.workoutDaysPerWeek}</div></div></div>
      <div class="card"><div class="stat"><div class="stat-label">Weekly exercise burn</div><div class="stat-value accent">${Math.round(summary.totalWeeklyExerciseKcal)}<span class="unit">kcal</span></div></div></div>
      <div class="card">
        <div class="stat-label">Avg. daily steps</div>
        <input type="number" step="500" value="${STATE.workoutPlan.stepsPerDay}" oninput="updateSteps(this.value)" style="margin-top:6px;">
      </div>
    </div>

    <div class="day-tabs">
      ${days.map(d => `
        <button class="day-tab ${d.id === UI.workoutDayId ? 'active' : ''}" onclick="selectDay('${d.id}')">${escapeAttr(d.name)}</button>
      `).join('')}
      <button class="day-tab" onclick="addDay()">+ Add day</button>
    </div>

    ${activeDay ? renderDayCard(activeDay, bw) : `
      <div class="card"><div class="empty-state"><div class="big">＋</div>Add a training day to start building your plan.</div></div>
    `}
  `;
}

function renderDayCard(day, bw) {
  let dayKcal = 0;
  const rows = day.exercises.map(e => {
    const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId) || e.custom;
    const kcal = calcExerciseCalories(e, bw);
    dayKcal += kcal;
    const meta = ex.inputMode === 'setsRepsWeight'
      ? `${e.sets}×${e.reps} @ ${e.weightKg ? Math.round(kgToLb(e.weightKg)) + ' lb' : 'bw'}`
      : ex.inputMode === 'setsReps'
      ? `${e.sets}×${e.reps}`
      : `${e.durationMin} min`;
    return `
      <div class="exercise-row">
        <div>
          <div class="name">${escapeAttr(ex.name)}</div>
          <div class="meta">${meta} · ${ex.category || 'Custom'}</div>
        </div>
        <div class="kcal">${Math.round(kcal)} kcal</div>
        <button class="icon-btn" onclick="removeExercise('${day.id}','${e.id}')" title="Remove">✕</button>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-title">
        <span>
          <input type="text" value="${escapeAttr(day.name)}" oninput="renameDay('${day.id}', this.value)"
            style="background:transparent;border:none;font-family:var(--font-display);font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:0.02em;color:var(--text-dim);padding:0;width:auto;">
        </span>
        <button class="btn btn-danger btn-sm" onclick="deleteDay('${day.id}')">Delete day</button>
      </div>

      ${day.exercises.length ? `<div class="row-list">${rows}</div>` : `<div class="empty-state">No exercises yet.</div>`}

      <hr class="div">
      <div class="stat" style="margin-bottom:14px;">
        <div class="stat-label">Estimated day total</div>
        <div class="stat-value accent">${Math.round(dayKcal)}<span class="unit">kcal</span></div>
      </div>

      ${UI.addExerciseOpenFor === day.id ? renderAddExerciseForm(day) : `
        <button class="btn btn-primary" onclick="openAddExercise('${day.id}')">+ Add exercise</button>
      `}
    </div>
  `;
}

function renderAddExerciseForm(day) {
  const categories = [...new Set(EXERCISE_LIBRARY.map(e => e.category))];
  const filtered = EXERCISE_LIBRARY.filter(e => e.category === UI.addExerciseCategory);

  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:6px;">
      <div class="pill-toggle" style="margin-bottom:12px; flex-wrap:wrap;">
        ${categories.map(c => `<button class="${UI.addExerciseCategory === c ? 'active' : ''}" onclick="setExerciseCategory('${c}')">${c}</button>`).join('')}
        <button class="${UI.addExerciseCategory === 'Custom' ? 'active' : ''}" onclick="setExerciseCategory('Custom')">Custom</button>
      </div>

      ${UI.addExerciseCategory === 'Custom' ? renderCustomExerciseForm(day) : `
        <div class="field">
          <label>Exercise</label>
          <select id="ex-select">
            ${filtered.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
          </select>
        </div>
        <div id="ex-input-fields">${renderExerciseInputFields(filtered[0])}</div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-primary" onclick="submitAddExercise('${day.id}')">Add to day</button>
          <button class="btn btn-ghost" onclick="closeAddExercise()">Cancel</button>
        </div>
      `}
    </div>
  `;
}

function renderExerciseInputFields(ex) {
  if (!ex) return '';
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    return `
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" id="f-duration" min="1" value="30">
      </div>
    `;
  }
  if (ex.inputMode === 'setsRepsWeight') {
    return `
      <div class="field-row">
        <div class="field"><label>Sets</label><input type="number" id="f-sets" min="1" value="3"></div>
        <div class="field"><label>Reps</label><input type="number" id="f-reps" min="1" value="10"></div>
        <div class="field"><label>Weight (lb)</label><input type="number" id="f-weight" min="0" value="45"></div>
      </div>
    `;
  }
  // setsReps (bodyweight)
  return `
    <div class="field-row">
      <div class="field"><label>Sets</label><input type="number" id="f-sets" min="1" value="3"></div>
      <div class="field"><label>Reps</label><input type="number" id="f-reps" min="1" value="10"></div>
    </div>
  `;
}

function renderCustomExerciseForm(day) {
  return `
    <div class="field">
      <label>Exercise name</label>
      <input type="text" id="c-name" placeholder="e.g. Kettlebell flow">
    </div>
    <div class="field-row">
      <div class="field">
        <label>MET value (intensity)</label>
        <input type="number" id="c-met" step="0.1" value="6.0">
      </div>
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" id="c-duration" min="1" value="30">
      </div>
    </div>
    <p class="hint">Not sure of MET value? 3 = light, 6 = moderate, 9 = vigorous, 12+ = very intense. <a href="https://sites.google.com/site/compendiumofphysicalactivities/" target="_blank" rel="noopener">Reference chart ↗</a></p>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button class="btn btn-primary" onclick="submitAddCustomExercise('${day.id}')">Add to day</button>
      <button class="btn btn-ghost" onclick="closeAddExercise()">Cancel</button>
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
  render();
}

function renameDay(id, name) {
  const d = STATE.workoutPlan.days.find(x => x.id === id);
  if (d) d.name = name;
  persist();
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
  UI.addExerciseCategory = 'Cardio';
  render();
}
function closeAddExercise() {
  UI.addExerciseOpenFor = null;
  render();
}
function setExerciseCategory(cat) {
  UI.addExerciseCategory = cat;
  render();
}

function removeExercise(dayId, exId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  if (day) day.exercises = day.exercises.filter(e => e.id !== exId);
  persist(); render();
}

function submitAddExercise(dayId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  const selectEl = document.getElementById('ex-select');
  const ex = EXERCISE_LIBRARY.find(x => x.id === selectEl.value);
  const entry = { id: uid(), exerciseId: ex.id };
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    entry.durationMin = Number(document.getElementById('f-duration').value) || 0;
  } else if (ex.inputMode === 'setsRepsWeight') {
    entry.sets = Number(document.getElementById('f-sets').value) || 0;
    entry.reps = Number(document.getElementById('f-reps').value) || 0;
    entry.weightKg = lbToKg(Number(document.getElementById('f-weight').value) || 0);
  } else {
    entry.sets = Number(document.getElementById('f-sets').value) || 0;
    entry.reps = Number(document.getElementById('f-reps').value) || 0;
  }
  day.exercises.push(entry);
  UI.addExerciseOpenFor = null;
  persist(); render();
}

function submitAddCustomExercise(dayId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  const name = document.getElementById('c-name').value.trim() || 'Custom exercise';
  const met = Number(document.getElementById('c-met').value) || 5;
  const duration = Number(document.getElementById('c-duration').value) || 30;
  const entry = {
    id: uid(),
    exerciseId: null,
    custom: { name, met, inputMode: 'duration', category: 'Custom' },
    durationMin: duration,
  };
  day.exercises.push(entry);
  UI.addExerciseOpenFor = null;
  persist(); render();
}
