/* ============================================================
   WORKOUT PLAN VIEW (weekly template)

   Model: the Plan is a reusable weekly template with base/starting
   numbers. The Log (js/log.js) is where you record what you actually
   did on a specific date, and can be copied in from the Plan then
   edited freely, that's what makes the Progress chart meaningful
   instead of a flat line.

   This file also holds the shared exercise add/edit form used by
   both the Plan and the Log (mode: 'workout' | 'log').
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
      <p class="page-sub">Your reusable weekly template with base weights and set/rep targets. Head to the <a href="#" onclick="navigate('log'); return false;">Workout Log</a> to record what you actually did on a given day (you can copy a plan day in, then adjust it).</p>
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
        <input type="number" data-focus-id="steps-per-day" step="500" value="${STATE.workoutPlan.stepsPerDay}" onchange="updateSteps(this.value)" onkeydown="if(event.key==='Enter') this.blur()" style="margin-top:6px;">
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

    ${notice('weight-vs-calories-tip', `
      <strong>Heads up on what "burning more calories" actually depends on:</strong> lifting heavier doesn't directly burn a lot
      more calories, the extra effort mostly builds strength, not calorie burn. Our estimate scales mainly with how long you're
      actively working (time under load), not how much weight is on the bar. It's also worth knowing that most of your daily
      calorie burn happens outside the gym, workouts are usually a smaller slice of the day than people assume (see the energy
      breakdown on Home). And muscle itself is built during recovery, not during the set, your body repairs and grows tissue in
      the hours and days after training, which is part of why rest and protein matter as much as the workout itself.
    `)}

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
  const rows = day.exercises.map(e => renderExerciseRow(e, bw, { scope: 'workout', dayId: day.id })).join('');
  day.exercises.forEach(e => { dayKcal += calcExerciseCalories(e, bw); });

  const sessionFeedback = day.exercises.length ? getSessionIntensityFeedback(dayKcal) : null;
  const nextTier = sessionFeedback ? getNextTierGap(dayKcal, EXERCISE_INTENSITY_BANDS.session) : null;

  return `
    <div class="card">
      <div class="card-title">
        <span>
          <input type="text" data-focus-id="day-name-${day.id}" value="${escapeAttr(day.name)}" onchange="renameDay('${day.id}', this.value)" onkeydown="if(event.key==='Enter') this.blur()"
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

      ${UI.addExerciseOpenFor === day.id ? renderAddExerciseForm({ scope: 'workout', dayId: day.id }) : `
        <button class="btn btn-primary" onclick="openAddExercise('${day.id}')">+ Add exercise</button>
      `}
    </div>
  `;
}

// Shared exercise row renderer, used by both the Plan and the Log. `target`
// identifies where edits/removals should apply: {scope:'workout',dayId} or
// {scope:'log', date}. `showCheckbox` (Log only) adds a "did I do this" toggle.
function renderExerciseRow(e, bw, target, showCheckbox) {
  const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId) || e.custom;
  const kcal = calcExerciseCalories(e, bw);
  const kcalTip = tip(`${Math.round(kcal)} kcal`, 'How this is calculated', explainExerciseCalc(e, ex, bw));
  const editAttr = target.scope === 'workout'
    ? `openEditExercise('${target.dayId}', '${e.id}')`
    : `openEditExerciseLog('${e.id}')`;
  const removeAttr = target.scope === 'workout'
    ? `removeExercise('${target.dayId}', '${e.id}')`
    : `removeLogExercise('${e.id}')`;

  // Ramping/per-set weights get their own block with one line per set, instead
  // of being crammed into a single hard-to-read row.
  if (ex.inputMode === 'setsRepsWeight' && e.perSetWeights && e.perSetWeights.length) {
    const allDone = e.perSetWeights.every(s => s.completed);
    const setRows = e.perSetWeights.map((s, i) => {
      const loadLb = Math.round(kgToLb(s.weightIsPerSide ? s.weightKg * 2 : s.weightKg));
      const checkboxAttr = target.scope === 'log' ? `onchange="toggleLogSetDone('${e.id}', ${i})"` : 'disabled';
      return `
        <div class="set-row ${s.completed ? 'set-done' : ''}">
          <span class="set-label">SET ${i + 1}</span>
          ${showCheckbox ? `<input type="checkbox" ${s.completed ? 'checked' : ''} ${checkboxAttr}>` : ''}
          <span class="set-detail">${s.reps} reps @ ${loadLb} lb${s.weightIsPerSide ? ' per side' : ''}</span>
        </div>
      `;
    }).join('');
    return `
      <div class="exercise-block">
        <div class="exercise-block-header">
          <div class="name" style="${allDone ? 'opacity:0.55;' : ''}">${escapeAttr(ex.name)}${allDone ? ' \u2713' : ''}</div>
          <div class="kcal">${kcalTip}</div>
          <button class="icon-btn" onclick="${editAttr}" title="Edit">\u270E</button>
          <button class="icon-btn" onclick="${removeAttr}" title="Remove">x</button>
        </div>
        ${setRows}
      </div>
    `;
  }

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
      ${showCheckbox ? `<input type="checkbox" ${e.completed ? 'checked' : ''} onchange="toggleLogExerciseDone('${e.id}')" style="width:auto; flex-shrink:0;" title="Mark done">` : ''}
      <div style="${e.completed ? 'opacity:0.55;' : ''}">
        <div class="name">${escapeAttr(ex.name)}${e.completed ? ' \u2713' : ''}</div>
        <div class="meta">${meta} . ${ex.bodyPart || ex.category || 'Custom'}</div>
      </div>
      <div class="kcal">${kcalTip}</div>
      <button class="icon-btn" onclick="${editAttr}" title="Edit">\u270E</button>
      <button class="icon-btn" onclick="${removeAttr}" title="Remove">x</button>
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

// ============================================================
// SHARED ADD/EDIT EXERCISE FORM
// ============================================================

function renderAddExerciseForm(target) {
  const editing = UI.editingExercise;
  const editingEntry = editing ? findExerciseEntry(editing) : null;
  const filtered = EXERCISE_LIBRARY.filter(e => e.bodyPart === UI.addExerciseCategory);
  const recents = STATE.recentExercises;

  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:6px;">
      ${editing ? `<p class="hint" style="margin-bottom:10px; color:var(--accent);">Editing existing entry</p>` : ''}

      ${!editing && recents.length ? `
        <p class="hint" style="margin-bottom:8px;">Recent:</p>
        <div class="chip-row" style="margin-bottom:14px;">
          ${recents.map(r => `<button class="chip" onclick="quickAddRecent('${escapeAttr(r.key)}', '${target.scope}', '${target.dayId || ''}')">${escapeAttr(r.label)}</button>`).join('')}
        </div>
      ` : ''}

      <p class="hint" style="margin-bottom:8px;">Filter by body part:</p>
      <div class="chip-row" style="margin-bottom:12px;">
        ${BODY_PARTS.map(c => `<button class="chip ${UI.addExerciseCategory === c ? 'active' : ''}" onclick="setExerciseCategory('${c}')">${c}</button>`).join('')}
        <button class="chip ${UI.addExerciseCategory === 'Custom' ? 'active' : ''}" onclick="setExerciseCategory('Custom')">Custom</button>
      </div>

      ${UI.addExerciseCategory === 'Cardio' ? `
        <div class="section-note">Running and walking overlap with your daily step count. If this session is already reflected in your average steps/day, log it in one place only.</div>
      ` : ''}

      ${UI.addExerciseCategory === 'Custom' ? renderCustomExerciseForm(target, editingEntry) : `
        <div class="field">
          <label>Exercise</label>
          <select id="ex-select" data-focus-id="ex-select">
            ${filtered.map(e => `<option value="${e.id}" ${editingEntry && editingEntry.exerciseId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
          </select>
        </div>
        <div id="ex-input-fields">${renderExerciseInputFields(filtered.find(e => editingEntry && e.id === editingEntry.exerciseId) || filtered[0], editingEntry)}</div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-primary" onclick="submitExerciseForm('${target.scope}', '${target.dayId || ''}')">${editing ? 'Save changes' : 'Add'}</button>
          <button class="btn btn-ghost" onclick="closeExerciseForm('${target.scope}')">Cancel</button>
        </div>
      `}
    </div>
  `;
}

function renderExerciseInputFields(ex, existingEntry) {
  if (!ex) return '';
  const perSet = existingEntry && existingEntry.perSetWeights && existingEntry.perSetWeights.length;
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    const restNote = ex.category === 'Strength' && ex.restAdjust && ex.restAdjust < 1
      ? `<p class="hint">Heads up: gym-session time is mostly rest between sets. We count about ${Math.round(ex.restAdjust * 100)}% of this as active effort so the estimate isn't inflated. For a more accurate number, log individual exercises with sets/reps/weight instead.</p>`
      : '';
    return `
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" id="f-duration" data-focus-id="f-duration" min="1" value="${existingEntry ? existingEntry.durationMin : 30}">
      </div>
      ${restNote}
    `;
  }
  if (ex.inputMode === 'setsRepsWeight') {
    const sets = existingEntry ? (existingEntry.sets || (existingEntry.perSetWeights || []).length) : 3;
    const reps = existingEntry ? existingEntry.reps : 10;
    const weightLb = existingEntry && !perSet ? Math.round(kgToLb(existingEntry.weightKg || 0)) : 45;
    _weightIsPerSide = existingEntry ? !!existingEntry.weightIsPerSide : false;
    return `
      <div class="field-row">
        <div class="field"><label>Sets</label><input type="number" id="f-sets" data-focus-id="f-sets" min="1" value="${sets}"></div>
        <div class="field"><label>Reps (if same across sets)</label><input type="number" id="f-reps" data-focus-id="f-reps" min="1" value="${reps}"></div>
        <div class="field"><label>Weight (lb, if same across sets)</label><input type="number" id="f-weight" data-focus-id="f-weight" min="0" value="${weightLb}"></div>
      </div>
      <div class="field">
        <label>Weight is</label>
        <div class="pill-toggle">
          <button type="button" id="f-weight-total-btn" class="${!_weightIsPerSide ? 'active' : ''}" onclick="setWeightMode(false)">Total (both sides)</button>
          <button type="button" id="f-weight-perside-btn" class="${_weightIsPerSide ? 'active' : ''}" onclick="setWeightMode(true)">Per arm / per side</button>
        </div>
      </div>
      <div class="field">
        <button type="button" class="btn btn-sm" onclick="togglePerSetWeights(${sets})">${perSet ? 'Edit per-set weights below' : 'Use a different weight per set (e.g. ramping sets)'}</button>
      </div>
      <div id="per-set-container">${perSet ? renderPerSetRows(existingEntry.perSetWeights) : ''}</div>
      <p class="hint">Defaults to the same reps/weight for every set. Use the button above if, say, set 1 was 25 lb, set 2 was 35 lb, set 3 was 45 lb.</p>
    `;
  }
  // setsReps (bodyweight)
  return `
    <div class="field-row">
      <div class="field"><label>Sets</label><input type="number" id="f-sets" data-focus-id="f-sets" min="1" value="${existingEntry ? existingEntry.sets : 3}"></div>
      <div class="field"><label>Reps</label><input type="number" id="f-reps" data-focus-id="f-reps" min="1" value="${existingEntry ? existingEntry.reps : 10}"></div>
    </div>
  `;
}

function renderPerSetRows(rows) {
  return `
    <div class="row-list" style="margin-bottom:8px;">
      ${rows.map((s, i) => `
        <div class="field-row" style="align-items:end;">
          <div class="field" style="margin-bottom:0;"><label>Set ${i + 1} reps</label><input type="number" class="per-set-reps" min="1" value="${s.reps}"></div>
          <div class="field" style="margin-bottom:0;"><label>Set ${i + 1} weight (lb)</label><input type="number" class="per-set-weight" min="0" value="${Math.round(kgToLb(s.weightKg || 0))}"></div>
        </div>
      `).join('')}
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

function togglePerSetWeights(defaultSets) {
  const container = document.getElementById('per-set-container');
  if (!container) return;
  if (container.innerHTML.trim()) {
    container.innerHTML = '';
    return;
  }
  const sets = Number(document.getElementById('f-sets')?.value) || defaultSets || 3;
  const reps = Number(document.getElementById('f-reps')?.value) || 10;
  const weightLb = Number(document.getElementById('f-weight')?.value) || 45;
  const rows = Array.from({ length: sets }, () => ({ reps, weightKg: lbToKg(weightLb) }));
  container.innerHTML = renderPerSetRows(rows);
}

function renderCustomExerciseForm(target, existingEntry) {
  const custom = existingEntry ? existingEntry.custom : null;
  return `
    <div class="field">
      <label>Exercise name</label>
      <input type="text" id="c-name" data-focus-id="c-name" placeholder="e.g. Kettlebell flow" value="${custom ? escapeAttr(custom.name) : ''}">
    </div>
    <div class="field-row">
      <div class="field">
        <label>MET value (intensity)</label>
        <input type="number" id="c-met" data-focus-id="c-met" step="0.1" value="${custom ? custom.met : 6.0}">
      </div>
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" id="c-duration" data-focus-id="c-duration" min="1" value="${existingEntry ? existingEntry.durationMin : 30}">
      </div>
    </div>
    <p class="hint">Not sure of MET value? 3 = light, 6 = moderate, 9 = vigorous, 12+ = very intense. <a href="https://sites.google.com/site/compendiumofphysicalactivities/" target="_blank" rel="noopener">Reference chart</a></p>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button class="btn btn-primary" onclick="submitExerciseForm('${target.scope}', '${target.dayId || ''}')">${UI.editingExercise ? 'Save changes' : 'Add'}</button>
      <button class="btn btn-ghost" onclick="closeExerciseForm('${target.scope}')">Cancel</button>
    </div>
  `;
}

// ---------- Actions: day management ----------

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
  render();
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

// ---------- Actions: add/edit exercise (shared by Plan + Log) ----------

function openAddExercise(dayId) {
  UI.addExerciseOpenFor = dayId;
  UI.editingExercise = null;
  UI.addExerciseCategory = 'Chest';
  _weightIsPerSide = false;
  render();
}
function closeExerciseForm(scope) {
  UI.addExerciseOpenFor = null;
  UI.logAddOpen = false;
  UI.editingExercise = null;
  render();
}
function setExerciseCategory(cat) {
  UI.addExerciseCategory = cat;
  if (!UI.editingExercise) _weightIsPerSide = false;
  render();
}

function findExerciseEntry(editing) {
  if (!editing) return null;
  const list = editing.scope === 'workout'
    ? STATE.workoutPlan.days.find(d => d.id === editing.dayId)?.exercises
    : STATE.workoutLog[editing.date];
  return (list || []).find(e => e.id === editing.entryId) || null;
}

function openEditExercise(dayId, entryId) {
  const entry = STATE.workoutPlan.days.find(d => d.id === dayId)?.exercises.find(e => e.id === entryId);
  if (!entry) return;
  const ex = EXERCISE_LIBRARY.find(x => x.id === entry.exerciseId);
  UI.editingExercise = { scope: 'workout', dayId, entryId };
  UI.addExerciseOpenFor = dayId;
  UI.addExerciseCategory = ex ? ex.bodyPart : 'Custom';
  render();
}

function removeExercise(dayId, exId) {
  const day = STATE.workoutPlan.days.find(d => d.id === dayId);
  if (day) day.exercises = day.exercises.filter(e => e.id !== exId);
  persist(); render();
}

// Reads the currently-open form (works for both Plan and Log, editing or adding).
function submitExerciseForm(scope, dayId) {
  const isCustom = UI.addExerciseCategory === 'Custom';
  const entry = isCustom ? buildCustomExerciseEntryFromForm() : buildExerciseEntryFromForm();
  if (!entry) return;

  const editing = UI.editingExercise;
  if (editing) {
    entry.id = editing.entryId; // preserve identity so progress history stays continuous
    entry.completed = findExerciseEntry(editing)?.completed || false;
    if (editing.scope === 'workout') {
      const day = STATE.workoutPlan.days.find(d => d.id === editing.dayId);
      const idx = day.exercises.findIndex(e => e.id === editing.entryId);
      if (idx >= 0) day.exercises[idx] = entry;
    } else {
      const list = STATE.workoutLog[editing.date];
      const idx = list.findIndex(e => e.id === editing.entryId);
      if (idx >= 0) list[idx] = entry;
    }
  } else if (scope === 'workout') {
    STATE.workoutPlan.days.find(d => d.id === dayId).exercises.push(entry);
  } else {
    ensureLogDate(UI.logDate).push(entry);
  }

  const ex = EXERCISE_LIBRARY.find(x => x.id === entry.exerciseId);
  const label = ex ? ex.name : (entry.custom ? entry.custom.name : 'Exercise');
  const key = entry.exerciseId || ('custom:' + (entry.custom ? entry.custom.name : label));
  recordRecentExercise(key, label, entry);

  UI.addExerciseOpenFor = null;
  UI.logAddOpen = false;
  UI.editingExercise = null;
  persist(); render();
}

// Shared field-reading helpers.
function buildExerciseEntryFromForm() {
  const selectEl = document.getElementById('ex-select');
  const ex = EXERCISE_LIBRARY.find(x => x.id === selectEl.value);
  const entry = { id: uid(), exerciseId: ex.id };
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    entry.durationMin = Number(document.getElementById('f-duration').value) || 0;
  } else if (ex.inputMode === 'setsRepsWeight') {
    const perSetContainer = document.getElementById('per-set-container');
    const perSetRows = perSetContainer ? perSetContainer.querySelectorAll('.field-row') : [];
    if (perSetRows.length) {
      entry.perSetWeights = Array.from(perSetRows).map(row => ({
        reps: Number(row.querySelector('.per-set-reps').value) || 0,
        weightKg: lbToKg(Number(row.querySelector('.per-set-weight').value) || 0),
        weightIsPerSide: _weightIsPerSide,
      }));
      entry.sets = entry.perSetWeights.length;
    } else {
      entry.sets = Number(document.getElementById('f-sets').value) || 0;
      entry.reps = Number(document.getElementById('f-reps').value) || 0;
      entry.weightKg = lbToKg(Number(document.getElementById('f-weight').value) || 0);
      entry.weightIsPerSide = _weightIsPerSide;
    }
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

// ---------- Recent-item quick add ----------
function quickAddRecent(key, scope, dayId) {
  const recent = STATE.recentExercises.find(r => r.key === key);
  if (!recent) return;
  const entry = { ...recent.snapshot, id: uid(), completed: false };
  if (scope === 'workout') {
    STATE.workoutPlan.days.find(d => d.id === dayId).exercises.push(entry);
  } else {
    ensureLogDate(UI.logDate).push(entry);
  }
  UI.addExerciseOpenFor = null;
  UI.logAddOpen = false;
  persist(); render();
  toast(`Added ${recent.label}`);
}

// ---------- Copy day (Plan) ----------
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
